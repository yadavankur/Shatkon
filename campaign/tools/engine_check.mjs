// Validates the campaign with PR #2's story engine (branch campaign-engine), which is not on
// main yet. Point it at a checkout of that branch; nothing in the checkout is changed.
//
//   git worktree add /tmp/ce origin/campaign-engine
//   node campaign/tools/engine_check.mjs --engine /tmp/ce [--games 20] [--chapter ch3] [--seed 1]
//
// 1. Loads every chapter with the engine's buildChapter(), chaining campaign progress with
//    newCampaign() / applyResult() (each chapter is loaded with the progress the previous
//    chapter's first won game left), and prints the loader's problems.
// 2. Plays scripted AI-vs-AI games through engine/script.js: both seats use campaignMove()
//    (seat 1 follows the chapter's AI profiles; seat 0, the human stand-in, has no profile
//    and plays the stock normal AI). Reports when each beat fired, results, rounds, deaths.
//    --graft makes the human stand-in issue the Graft order itself in ch4A once it can.
//    By default the human stand-in never fires a shot that would destroy its own mine (the
//    stock AI does not know lasers stop on objects; a player told to hold would not);
//    --sloppy turns that off. --no-rails drops every protect action (difficulty without the
//    story rails: who would have died).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { camp, readYaml, CAMPAIGN } from './lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ENGINE = path.resolve(arg('engine', process.env.SHATKON_ENGINE || '../shatkon-campaign-engine'));
if (!fs.existsSync(path.join(ENGINE, 'engine/chapter.js'))) { console.error(`no PR #2 engine at ${ENGINE} (engine/chapter.js missing); pass --engine <checkout of campaign-engine>`); process.exit(2); }
const E = await import(pathToFileURL(path.join(ENGINE, 'engine/index.js')).href);
const S = await import(pathToFileURL(path.join(ENGINE, 'engine/state.js')).href);
const GAMES = Number(arg('games', 20)), ONLY = arg('chapter', null), SEED0 = Number(arg('seed', 1)), GRAFT = process.argv.includes('--graft'), SLOPPY = process.argv.includes('--sloppy'), NORAILS = process.argv.includes('--no-rails'), TRACE = arg('trace', null) === null ? null : Number(arg('trace'));

const campaignDoc = camp('campaign.yaml'), shipsDoc = camp('ships.yaml');
const world = (f) => readYaml(path.join(ENGINE, 'rules', f || 'world_v0.4.yaml'));
const C = campaignDoc.campaign;

// The stock AI does not know that a beam stops on the first thing it meets, or where its own
// mines are. A player would not shoot through their own escort, shoot their own mine, or fly
// onto their own mine: the human stand-in skips such an action (unless --sloppy) and plays
// the best safe one instead.
function ownGoal(before, after, act) {
  if (act.type === 'fire' && after.events.some((e) => e.t === 'obj_destroyed' && before.objs.some((o) => o.owner === 0 && o.pos[0] === e.at[0] && o.pos[1] === e.at[1]))) return true;
  return after.events.some((e) => e.t === 'damage' && (after.ships.find((s) => s.id === e.ship) || {}).owner === 0 && (act.type === 'fire' || /mine/.test(String(e.cause))));
}
function safeAlternative(g, seat) {
  const locked = new Set(g.script.locks.map((l) => l.ship).filter(Boolean));
  const mine = g.ships.filter((s) => s.owner === seat && !s.dead && !locked.has(s.name));
  const foes = g.ships.filter((s) => s.owner !== seat && !s.dead);
  const near = (x) => Math.min(99, ...foes.map((f) => E.gap(x, f)));
  const tries = [];
  for (const s of mine) for (const t of E.beamTargets(g, s.id)) if (foes.some((f) => f.id === t.target)) tries.push({ score: 100 + t.hits, act: { type: 'fire', ship: s.id, seg: t.seg, part: t.part, at: t.at } });
  for (const s of mine) for (const o of E.reach(g, s.id)) { const save = s.pos; s.pos = o.at; const d = near(s); s.pos = save; tries.push({ score: 50 - d, act: { type: 'move', ship: s.id, path: o.path } }); }
  tries.sort((a, b) => b.score - a.score);
  for (const t of tries) { const r = E.attempt(g, t.act); if (r.ok && !ownGoal(g, r.state, t.act)) return r; }
  return E.attempt(g, { type: 'end' });
}

// --trace <seed>: print one game's positions each round and its events (fire, damage, beats...).
let traceRound = 0;
function traceStep(g, seat) {
  const nm = (id) => (g.ships.find((s) => s.id === id) || {}).name || id;
  if (g.round !== traceRound) { traceRound = g.round; console.log(`--- round ${g.round}: ` + g.ships.filter((s) => !s.dead).map((s) => s.name + '@' + s.pos).join(' ')); }
  for (const e of g.events) {
    if (e.t === 'beat') console.log(`   beat ${e.id}`);
    else if (['fire', 'launch', 'forced', 'destroyed', 'disabled', 'removed', 'bump', 'obj_destroyed', 'blast', 'stopped', 'burnout', 'expired', 'fizzle', 'obj_lost'].includes(e.t)) console.log(`   ${seat} ${e.t} ${nm(e.ship)}${e.order ? ' ' + e.order : ''}${e.target ? ' -> ' + nm(e.target) : ''}`);
    else if (e.t === 'damage') console.log(`   ${seat} damage ${nm(e.ship)} seg ${e.seg} x${e.hits} (${e.cause}): ${(e.lost || []).join(', ')}`);
  }
}

// The stock AI ends its turn once it holds a "cautious" range, even when every shot from there
// is soaked by shields or blocked. A player with points left closes in: before ending its turn
// the stand-in moves a ship one step nearer (to 3 hexes) the nearest enemy it can see, never
// onto its own mine.
function closeIn(g, seat) {
  const vis = new Set(g.players[seat].vis || []);
  const locked = new Set(g.script.locks.map((l) => l.ship).filter(Boolean));
  const foes = g.ships.filter((s) => s.owner !== seat && !s.dead && vis.has(s.id));
  if (!foes.length || g.players[seat].cp < 1) return null;
  let best = null;
  for (const s of g.ships.filter((x) => x.owner === seat && !x.dead && !locked.has(x.name))) {
    const now = Math.min(...foes.map((f) => E.gap(s, f)));
    if (now <= 3) continue;
    for (const o of E.reach(g, s.id)) {
      const save = s.pos; s.pos = o.at; const d = Math.min(...foes.map((f) => E.gap(s, f))); s.pos = save;
      if (d >= now || d < 2) continue;
      const act = { type: 'move', ship: s.id, path: o.path }, r = E.attempt(g, act);
      if (!r.ok || ownGoal(g, r.state, act)) continue;
      if (!best || d < best.d || (d === best.d && o.path.length < best.act.path.length)) best = { d, act };
    }
  }
  return best && best.act;
}

// The stock AI fires before it moves, so it spends its points on 1-hit long shots that a
// recharging shield soaks, and never closes. A player moves into 2-hit range (4 hexes) first:
// before a 1-hit shot from a ship that has not moved this turn, the stand-in moves that ship
// nearer its target if it can (not adjacent, never onto its own mine).
function closeFirst(g, seat, fire) {
  const s = g.ships.find((x) => x.id === fire.ship), pl = g.players[seat];
  if (!s || pl.moved[s.id]) return null;
  const shot = E.beamTargets(g, s.id).find((t) => t.seg === fire.seg && t.part === fire.part && t.at[0] === fire.at[0] && t.at[1] === fire.at[1]);
  const tgt = shot && g.ships.find((x) => x.id === shot.target);
  if (!shot || !tgt || shot.hits !== 1 || g.script.locks.some((l) => l.ship === s.name)) return null;
  const now = E.gap(s, tgt);
  let best = null;
  for (const o of E.reach(g, s.id)) {
    const save = s.pos; s.pos = o.at; const d = E.gap(s, tgt); s.pos = save;
    if (d >= now || d < 2) continue;
    const act = { type: 'move', ship: s.id, path: o.path }, r = E.attempt(g, act);
    if (!r.ok || ownGoal(g, r.state, act)) continue;
    if (!best || d < best.d) best = { d, act };
  }
  return best && best.act;
}

// One AI-vs-AI game. Returns the final state.
function play(rules, seed, chId) {
  let g = E.start(rules, seed);
  const doomed = [], lastCause = {}, killedBy = {}, firstHit = {}, ttk = {}, rams = {};
  for (let steps = 0; g.phase === 'play' && steps < 6000; steps++) {
    const seat = S.current(g);
    let act = null;
    if (GRAFT && seat === 0 && chId === 'ch4a' && g.script.unlocked.graft) {
      const k = g.ships.find((s) => s.name === 'kestrel' && !s.dead), t = g.ships.find((s) => s.name === 'tern' && !s.dead);
      if (k && t && E.gap(k, t) === 1) act = { type: 'graft', ship: k.id, with: t.id };
    }
    act = act || E.campaignMove(g, seat);
    if (seat === 0 && act && act.type === 'end' && !SLOPPY) { const c = closeIn(g, seat); if (c) act = c; }
    if (seat === 0 && act && act.type === 'fire' && !SLOPPY) { const c = closeFirst(g, seat, act); if (c) act = c; }
    let r = E.attempt(g, act);
    if (!r.ok) {
      // a locked ship (the script holds its helm): plan again as if it were not ours
      const locked = new Set(g.script.locks.map((l) => l.ship).filter(Boolean));
      const g2 = { ...g, ships: g.ships.map((s) => (s.owner === seat && locked.has(s.name) ? { ...s, owner: 9 } : s)) };
      let a2 = null; try { a2 = E.campaignMove(g2, seat); } catch { a2 = null; }
      r = a2 ? E.attempt(g, a2) : r;
      if (r.ok) act = a2;
      if (!r.ok) r = E.attempt(g, { type: 'end' });
    }
    if (!SLOPPY && seat === 0 && r.ok && ownGoal(g, r.state, act)) { if (TRACE === seed) console.log(`   (stand-in skips ${JSON.stringify(act)}: own goal)`); r = safeAlternative(g, seat); }
    else if (TRACE === seed && seat === 0 && act.type === 'end') console.log(`   (stand-in ends turn with cp ${g.players[0].cp}, thrust ${g.players[0].thrust})`);
    g = r.state;
    if (TRACE !== null && seed === TRACE) traceStep(g, seat);
    for (const e of g.events) {
      if (e.t === 'damage') { const sh = g.ships.find((x) => x.id === e.ship); if (sh) { lastCause[sh.name] = e.cause; if (!(sh.name in firstHit)) firstHit[sh.name] = g.round; } }
      if (e.t === 'destroyed' && e.name in firstHit && !(e.name in ttk)) ttk[e.name] = g.round - firstHit[e.name] + 1;
      if (e.t === 'destroyed') killedBy[e.name] = e.cause || lastCause[e.name] || '?';
      // which target segment a ram landed on (impact hex = the target segment's cell)
      if (e.t === 'ram') { const t = g.ships.find((x) => x.id === e.target); const i = t ? t.segs.findIndex((sg) => t.pos[0] + sg.off[0] === e.at[0] && t.pos[1] + sg.off[1] === e.at[1]) : -1; rams[e.name] = e.targetName + ':seg' + i; }
      if (e.t === 'destroyed' && e.cause === 'scripted') doomed.push(e.name);
      if (e.t === 'script_unknown' || e.t === 'script_failed') doomed.problems = (doomed.problems || []).concat(e.t + ':' + (e.action || '') + (e.why ? ' (' + e.why + ')' : ''));
    }
  }
  g.doomed = doomed;
  g.killedBy = killedBy;
  g.rams = rams;
  g.ttk = ttk;
  return g;
}

let progress = E.newCampaign(campaignDoc);
const out = [];
const log = (s = '') => { out.push(s); console.log(s); };
log(`PR #2 engine: ${ENGINE}  (games per chapter ${GAMES}, seeds ${SEED0}..${SEED0 + GAMES - 1}${GRAFT ? ', human stand-in grafts' : ''}${SLOPPY ? ', human stand-in may shoot its own mines' : ''}${NORAILS ? ', NO protect actions' : ''})`);
for (const node of C.nodes) {
  if (!node.file) continue;
  const chDoc = camp(node.file), ch = chDoc.chapter;
  if (NORAILS) for (const e of ch.script) e.do = (e.do || []).filter((a) => !a.protect);
  const { rules, problems } = E.buildChapter({ world: world(ch.world), map: camp(ch.map), ships: shipsDoc, chapter: chDoc, campaign: campaignDoc, progress });
  log(`\n## ${ch.id}: buildChapter problems: ${problems.length ? problems.join(' | ') : 'none'}`);
  log(`  progress in: roster ${JSON.stringify(progress.roster.map((r) => r.id + (r.hull ? '(carried hull)' : '')))}, capabilities ${progress.capabilities.length}, completed ${JSON.stringify(progress.completed)}`);
  log(`  fleets: ${rules.fleets.map((f) => f.ships.map((s) => s.name + (s.flagship ? '*' : '') + (s.reserve ? '(reserve)' : '')).join(' ')).join('  vs  ')}`);
  if (ONLY && ONLY !== ch.id) { progress = E.applyResult(progress, chDoc, { script: { result: 'win', flags: {} }, ships: [], winner: 0 }); continue; }
  const beats = ch.script.map((e) => e.id), stats = Object.fromEntries(beats.map((b) => [b, []]));
  const results = {}, rounds = [], deaths = {}, unknown = new Set(), extra = { mineHits: 0, stopped: 0, forced: 0, grafted: 0, scriptedGraft: 0, doomed: {}, killedBy: {}, ttk: {}, rams: {} };
  let firstWin = null;
  for (let i = 0; i < GAMES; i++) {
    const g = play(rules, SEED0 + i, ch.id);
    const res = g.script.result || (g.phase === 'over' ? 'limit/' + g.winner : 'stuck');
    results[res] = (results[res] || 0) + 1;
    rounds.push(g.round);
    for (const [b, f] of Object.entries(g.script.fired)) (stats[b] || (stats[b] = [])).push(f.round);
    for (const s of g.ships) if (s.dead) deaths[s.name + (s.removed ? '(' + s.removed + ')' : '')] = (deaths[s.name + (s.removed ? '(' + s.removed + ')' : '')] || 0) + 1;
    for (const n of g.doomed) extra.doomed[n] = (extra.doomed[n] || 0) + 1;
    for (const [n, r] of Object.entries(g.ttk)) (extra.ttk[n] = extra.ttk[n] || []).push(r);
    for (const [n, c] of Object.entries(g.killedBy)) { const k = n + ':' + c; extra.killedBy[k] = (extra.killedBy[k] || 0) + 1; }
    for (const [n, c] of Object.entries(g.rams)) { const k = n + '->' + c; extra.rams[k] = (extra.rams[k] || 0) + 1; }
    extra.mineHits += g.script.mineHit[1] || 0;
    extra.stopped += g.script.stopped[0] || 0;
    if (g.script.flags['grafted:kestrel+tern']) extra.grafted++;
    for (const x of g.doomed.problems || []) unknown.add(x);
    if (!firstWin && ['win', 'to_be_continued'].includes(g.script.result)) firstWin = g;
  }
  const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '-');
  log(`  results: ${JSON.stringify(results)}; rounds played avg ${avg(rounds)} (min ${Math.min(...rounds)}, max ${Math.max(...rounds)})`);
  log(`  beats fired (games / ${GAMES}, round avg / min / max):`);
  for (const [b, rs] of Object.entries(stats)) {
    const e = ch.script.find((x) => x.id === b) || {};
    log(`    ${b.padEnd(16)} ${String(rs.length).padStart(3)}  ${rs.length ? avg(rs) + ' / ' + Math.min(...rs) + ' / ' + Math.max(...rs) : '-'}${e.flavor ? '  (flavor)' : e.outcome ? '  (outcome)' : ''}`);
  }
  log(`  destroyed / removed (games): ${JSON.stringify(deaths)}; of those by a doom fallback: ${JSON.stringify(extra.doomed)}`);
  log(`  killing blow (ship:cause, games): ${JSON.stringify(extra.killedBy)}`);
  if (Object.keys(extra.rams).length) log(`  rams (rammer->target:segment hit, games; seg0 = bow, seg1 = stern on the Seeds): ${JSON.stringify(extra.rams)}`);
  log(`  rounds under fire before death (first hit to destroyed, avg / min / max): ${Object.entries(extra.ttk).map(([n, rs]) => n + ' ' + avg(rs) + ' / ' + Math.min(...rs) + ' / ' + Math.max(...rs) + ' (' + rs.length + ' games)').join('; ') || '-'}`);
  const hist = {}; for (const r of rounds) hist[r] = (hist[r] || 0) + 1;
  log(`  rounds played (round: games): ${JSON.stringify(hist)}`);
  log(`  enemy mine hits ${extra.mineHits}; player missiles stopped by PD ${extra.stopped}; kestrel+tern grafted in ${extra.grafted} games`);
  log(`  script_unknown / script_failed events: ${unknown.size ? [...unknown].join(', ') : 'none'}`);
  progress = E.applyResult(progress, chDoc, firstWin || { script: { result: 'win', flags: {} }, ships: [], winner: 0 });
  log(`  progress out (${firstWin ? 'from a won game' : 'synthesised win: no game won'}): roster ${JSON.stringify(progress.roster.map((r) => r.id + (r.hull ? '(carried ' + r.hull.length + '-segment hull)' : '')))}`);
}
const file = arg('out', null);
if (file) fs.writeFileSync(file, out.join('\n') + '\n');
