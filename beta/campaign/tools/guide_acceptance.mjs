// GUIDE_PROPOSAL.md §11 acceptance tests (engine side), plus forced-fallback checks for the
// Combat v2 options the chapters now use (ram seg, from_mine strikes). Run from the repo root:
//   node campaign/tools/guide_acceptance.mjs [--engine .]
// Tests 10-11 (banner, taps) are browser tests: campaign/tools/browser_story.cjs --guide-ui.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { camp, readYaml } from './lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ENGINE = path.resolve(arg('engine', '.'));
const E = await import(pathToFileURL(path.join(ENGINE, 'engine/index.js')).href);
const S = await import(pathToFileURL(path.join(ENGINE, 'engine/state.js')).href);
const H = await import(pathToFileURL(path.join(ENGINE, 'engine/hex.js')).href);
const campaignDoc = camp('campaign.yaml'), shipsDoc = camp('ships.yaml'), C = campaignDoc.campaign;
const world = (f) => readYaml(path.join(ENGINE, 'rules', f || 'world_v0.4.yaml'));

// chain progress through the chapters (as engine_check does) and build one chapter's rules
function rulesFor(id, edit) {
  let progress = E.newCampaign(campaignDoc);
  for (const node of C.nodes) {
    if (!node.file) continue;
    const chDoc = structuredClone(camp(node.file));
    if (chDoc.chapter.id === id) {
      if (edit) edit(chDoc.chapter);
      return E.buildChapter({ world: world(chDoc.chapter.world), map: camp(chDoc.chapter.map), ships: shipsDoc, chapter: chDoc, campaign: campaignDoc, progress }).rules;
    }
    progress = E.applyResult(progress, chDoc, { script: { result: 'win', flags: {} }, ships: [], winner: 0 });
  }
  throw new Error('no chapter ' + id);
}
// play with the stock AI on both seats; stop(prev, g, act) returning true ends early
function play(rules, seed, stop, steer) {
  let g = E.start(rules, seed), prev = null;
  const log = g.log = g.events.slice();
  for (let n = 0; g.phase === 'play' && n < 6000; n++) {
    const seat = S.current(g);
    let act = (steer && steer(g, seat)) || E.campaignMove(g, seat);
    let r = E.attempt(g, act);
    if (!r.ok) { act = { type: 'end' }; r = E.attempt(g, act); }
    prev = g; g = r.state; g.lastAct = act;
    for (const e of g.events) {
      if (e.t === 'ram') { const t = g.ships.find((x) => x.id === e.target); e.seg = t ? t.segs.findIndex((sg) => H.same(H.add(t.pos, sg.off), e.at)) : -1; }
      log.push(e);
    }
    g.log = log;
    if (stop && stop(prev, g, act)) break;
  }
  return { g, prev };
}
const ship = (g, name) => g.ships.find((s) => s.name === name && !s.dead);
const beat = (g, id) => !!(g.script.fired || {})[id];
const events = (g, t) => (g.log || g.events).filter((e) => e.t === t);
const results = [];
const check = (n, name, ok, detail = '') => { results.push({ n, name, ok }); console.log(`${ok === null ? 'N/A ' : ok ? 'PASS' : 'FAIL'}  ${n}. ${name}${detail ? ' - ' + detail : ''}`); };

// the open hexes the guided ship could sit on within w of a target (independent of guide.js)
function nearSet(g, s, t, w, player) {
  const R = g.rules, geo = S.geom(R), vis = E.visibleTo(g, player), seen = new Set();
  for (const x of g.ships) if (!x.dead && x !== s && (x.owner === player || vis.has(x.id))) for (const c of S.footprint(x)) seen.add(H.key(c));
  const out = [], r = R.board.radius;
  for (let q = -r; q <= r; q++) for (let rr = Math.max(-r, -q - r); rr <= Math.min(r, -q + r); rr++) {
    const a = [q, rr], cells = s.segs.map((sg) => H.add(a, sg.off));
    if (!cells.every((c) => geo.inside(c) && !geo.blockMove.has(H.key(c)) && !seen.has(H.key(c)))) continue;
    if (cells.some((c) => S.footprint(t).some((d) => H.dist(c, d) <= w))) out.push(a);
  }
  return out;
}
const keys = (l) => l.map((c) => H.key(c)).sort().join(' ');

// ---------------------------------------------------------------- ch1
const r1 = rulesFor('ch1');
{
  let before = true, sawEarly = false;
  const { g, prev } = play(r1, 1, (p, g) => { if (!beat(g, 'crippled') && E.guideView(g, 0)) sawEarly = true; return beat(g, 'crippled'); });
  check(2, 'ch1: no guide before `crippled`', !sawEarly);
  const v = E.guideView(g, 0), k = ship(g, 'kestrel'), sd = ship(g, 'seed');
  const startedAt2 = v && v.step === 2;
  if (startedAt2) check(3, 'ch1: guide starts on the beat', true, 'Kestrel was already within 4: opened on step 2 (see test 5)');
  else {
    const want = nearSet(g, k, sd, 4, 0);
    check(3, 'ch1: guide starts on the beat (kestrel, 1/2, label, dest = open hexes within 4)', !!v && v.shipName === 'kestrel' && v.step === 1 && v.of === 2 && v.label === 'Close to 4 hexes' && keys(v.dest) === keys(want), v ? `dest ${v.dest.length} vs ${want.length}` : 'no guide');
    const adj = v.route.every((c, i) => !i || H.dist(c, v.route[i - 1]) === 1);
    const live = S.current(g) === 0;
    const reachOk = !live || !v.turnEnd || E.reach(g, k.id).some((x) => H.same(x.at, v.turnEnd));
    check(4, 'ch1: ghost path from Kestrel to best; turnEnd in this turn\'s reach', H.same(v.route[0], k.pos) && H.same(v.route[v.route.length - 1], v.best) && adj && reachOk, `route ${v.route.length} hexes, turnEnd ${v.turnEnd}, live ${live}`);
  }
  // 5. skip an already-done step: put Kestrel within 4 just before the beat fires
  {
    const spots = nearSet(prev, ship(prev, 'kestrel'), ship(prev, 'seed'), 4, 0);
    const p2 = { ...prev, ships: prev.ships.map((x) => (x.name === 'kestrel' && !x.dead ? { ...x, pos: spots[0].slice() } : x)) };
    const r = E.attempt(p2, g.lastAct);
    const g5 = r.ok ? r.state : p2, v5 = E.guideView(g5, 0);
    check(5, 'ch1: step 1 skipped when Kestrel is already within 4', beat(g5, 'crippled') ? !!v5 && v5.step === 2 && v5.label === 'Fire on the Seed' && !!v5.reticle : null, beat(g5, 'crippled') ? `opened on step ${v5 && v5.step}` : 'beat did not fire in the replay');
  }
  // 6. advances on reached: steer Kestrel along the guide's best hex
  {
    let at6 = null;
    const { g: g6 } = play(r1, 1, (p, gg) => { const v6 = E.guideView(gg, 0); if (v6 && v6.step === 2 && !at6) { at6 = v6; return true; } return false; },
      (gg, seat) => { if (seat !== 0) return null; const v6 = E.guideView(gg, 0); if (!v6 || v6.step !== 1) return null; const kk = ship(gg, 'kestrel'); const go = E.reach(gg, kk.id).find((x) => v6.turnEnd && H.same(x.at, v6.turnEnd)); return go && !gg.players[0].movedThisTurn ? { type: 'move', ship: kk.id, path: go.path } : null; });
    const kk = ship(g6, 'kestrel'), ss = ship(g6, 'seed');
    check(6, 'ch1: step 2 after Kestrel comes within 4, reticle solid on the Seed', !!at6 && at6.label === 'Fire on the Seed' && at6.reticle && at6.reticle.kind === 'fire' && !at6.reticle.dashed && E.gap(kk, ss) <= 4, at6 ? `gap ${E.gap(kk, ss)}, dashed ${at6.reticle && at6.reticle.dashed}` : 'never reached step 2');
  }
  // 7. clears when the Seed dies; nothing after the win
  {
    const { g: g7 } = play(r1, 1);
    const clr = events(g7, 'guide_clear').filter((e) => e.id === 'crippled');
    check(7, 'ch1: guide clears on the kill; guideView null after', g7.phase === 'over' && clr.length === 1 && E.guideView(g7, 0) === null, `why: ${clr.map((e) => e.why).join(',')}`);
  }
  // 8. blocked hex: aim the step at a hex a visible ship sits on
  {
    const g8 = structuredClone(g), gd = g8.script.guides[0];
    const sd8 = ship(g8, 'seed'), blockedHex = sd8.pos.slice();
    gd.i = 0; gd.steps[0] = { label: 'Move here', move_to: blockedHex, done: 'reached' };
    const a = E.guideView(g8, 0), b = E.guideView(g8, 0);
    const ring = a && a.dest.length && a.dest.every((c) => H.dist(c, blockedHex) === Math.min(...a.dest.map((d) => H.dist(d, blockedHex))));
    check(8, 'blocked hex: nearest legal ring, blockedFrom, stable', !!a && keys(a.blockedFrom) === H.key(blockedHex) && ring && H.same(a.best, b.best) && JSON.stringify(a) === JSON.stringify(b), a ? `best ${a.best}, ring dist ${H.dist(a.best, blockedHex)}` : 'no view');
  }
}
// 9. fog: a guide on the unseen Seed at round 1
{
  const g9 = E.start(r1, 1), sd = ship(g9, 'seed'), k = ship(g9, 'kestrel');
  const seenNow = E.visibleTo(g9, 0).has(sd.id) || !!(g9.players[0].seen || {})[sd.id];
  g9.script.guides = [{ id: 'fogtest', ship: 'kestrel', owner: 0, steps: [{ label: 'Close in', move_to: { near: 'seed', within: 4 }, fire_at: 'seed' }], clear: null, i: 0, stepFrom: 1, fired: false, launched: false }];
  const v = E.guideView(g9, 0), json = JSON.stringify(v), leak = S.footprint(sd).some((c) => json.includes(JSON.stringify(c)));
  check(9, 'fog: no dest, no reticle, anchor on Kestrel, no Seed cell in the view', !seenNow && !!v && !v.dest.length && !v.reticle && H.same(v.anchor, k.pos) && !leak, seenNow ? 'Seed already seen at round 1' : `leak ${leak}`);
}
// 12. ch4A: rails guide (zone), then the gift guide for Tern; hand graft and tow paths
{
  const r4 = rulesFor('ch4a');
  const g0 = E.start(r4, 1), v0 = E.guideView(g0, 0);
  check('12a', 'ch4A: start guide "Reach the outpost" for Kestrel, zone destination', !!v0 && v0.label === 'Reach the outpost' && v0.shipName === 'kestrel' && v0.dest.length > 0, v0 ? `${v0.dest.length} anchors` : 'none');
  let atGift = null;
  const { g: gt } = play(r4, 1, (p, gg) => { if (!atGift && beat(gg, 'gift')) atGift = E.guideView(gg, 0); return false; });
  const gc = events(gt, 'guide_clear').filter((e) => e.id === 'gift');
  check('12b', 'ch4A: gift guide for Tern, step 1 "Bring Tern here"; the tow clears it', !!atGift && atGift.shipName === 'tern' && atGift.label === 'Bring Tern here' && beat(gt, 'tow') && gc.length === 1 && gc[0].why === 'clear', `why ${gc.map((e) => e.why)}`);
  let gg2 = null, seed12 = 0;
  for (let sd = 1; sd <= 40 && !gg2; sd++) {
    const { g: x } = play(r4, sd, null, (gg, seat) => { if (seat !== 0 || !gg.script.unlocked.graft) return null; const k = ship(gg, 'kestrel'), t = ship(gg, 'tern'); return k && t && E.gap(k, t) === 1 ? { type: 'graft', ship: k.id, with: t.id } : null; });
    if (Object.keys(x.script.flags).some((f) => f.startsWith('grafted:')) && !beat(x, 'tow')) { gg2 = x; seed12 = sd; }
  }
  const gc2 = gg2 ? events(gg2, 'guide_clear').filter((e) => e.id === 'gift') : [];
  check('12c', 'ch4A: a graft by hand ends the gift guide', gg2 ? gc2.length === 1 && ['done', 'clear', 'chapter_end'].includes(gc2[0].why) && E.guideView(gg2, 0) === null : null, gg2 ? `seed ${seed12}, why ${gc2.map((e) => e.why)} (the graft wins ch4A, so the chapter end clears it)` : 'no hand graft before the tow in 40 seeds');
}
// 13. replacement: ch2 with b_dead made to fire right after a_dead, while a_dead's guide is up
{
  const r2 = rulesFor('ch2', (ch) => { ch.script.find((e) => e.id === 'b_dead').when = 'a_dead'; });
  const { g } = play(r2, 1);
  const rep = events(g, 'guide_clear').filter((e) => e.why === 'replaced');
  const after = events(g, 'guide').filter((e) => e.id === 'b_dead');
  check(13, 'replacement: a second guide for Kestrel replaces the first (guide_clear why: replaced)', rep.length === 1 && rep[0].id === 'a_dead' && after.length > 0, `cleared ${rep.map((e) => e.id + ':' + e.why)}`);
}
// ---------------------------------------------------------------- forced fallbacks with the new options
{
  // ch1: forced rams the moment the hurl fires: each hits its named end (seg) wherever the Seed is
  const r = rulesFor('ch1', (ch) => { const f = ch.script.find((e) => e.id === 'ram_fallback'); f.when = { all: [ 'hurl', { not: { all: ['ram_wren', 'ram_kite'] } } ] }; });
  const { g } = play(r, 1), rams = events(g, 'ram');
  const segOf = (e) => e.seg;
  const w = rams.find((e) => e.name === 'wren'), k = rams.find((e) => e.name === 'kite');
  check('F1', 'ch1 forced rams (ram force + seg) hit the bow (Wren) and stern (Kite)', !!w && !!k && segOf(w) === 0 && segOf(k) === 1, `wren seg ${w && segOf(w)}, kite seg ${k && segOf(k)}`);
}
{
  // ch2: the round-9 fallback forced at round 2: a 5-hit scripted charge leaves each Seed dead in the water
  const r = rulesFor('ch2', (ch) => { for (const id of ['a_fallback', 'b_fallback']) ch.script.find((e) => e.id === id).when.all[0] = { round: 2 }; });
  const { g } = play(r, 1, (p, gg) => gg.round >= 3);
  const a = ship(g, 'seed_a'), b = ship(g, 'seed_b');
  const noReach = (s) => !s || E.reach(g, s.id).length === 0;
  check('F2', 'ch2 fallback (damage from_mine, strikes: engines): engines_out, a_dead / b_dead fire, Seeds cannot move', beat(g, 'a_fallback') && beat(g, 'a_dead') && beat(g, 'b_dead') && noReach(a) && noReach(b), `a_dead ${beat(g, 'a_dead')}, b_dead ${beat(g, 'b_dead')}`);
}
{
  // ch4A tow: the partial locks carry a reason; a move order for Tern is refused with it
  const r4 = rulesFor('ch4a');
  const { g } = play(r4, 1, (p, gg) => beat(gg, 'tow') && S.current(gg) === 0 && gg.phase === 'play');
  const t = ship(g, 'tern'), k = ship(g, 'kestrel');
  const why = (sh) => { const st = { ...g, players: g.players }; const r = E.attempt(st, { type: 'move', ship: sh.id, path: [0] }); return r.ok ? '(accepted)' : r.why; };
  const wt = t ? why(t) : 'no tern', wk = k ? why(k) : 'no kestrel';
  check('F3', 'ch4A tow: lock reason is the refusal text', beat(g, 'tow') && /in tow/.test(wt) && /graft/.test(wk), `tern: "${wt}" / kestrel: "${wk}"`);
}
const fails = results.filter((r) => r.ok === false), skipped = results.filter((r) => r.ok === null);
console.log(`\n${results.length - fails.length - skipped.length} passed, ${fails.length} failed, ${skipped.length} not applicable (tests 1, 10, 11: engine_check and browser_story.cjs --guide-ui)`);
process.exit(fails.length ? 1 : 0);
