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
const GAMES = Number(arg('games', 20)), ONLY = arg('chapter', null), SEED0 = Number(arg('seed', 1)), GRAFT = process.argv.includes('--graft'), SLOPPY = process.argv.includes('--sloppy'), NORAILS = process.argv.includes('--no-rails');

const campaignDoc = camp('campaign.yaml'), shipsDoc = camp('ships.yaml');
const world = (f) => readYaml(path.join(ENGINE, 'rules', f || 'world_v0.4.yaml'));
const C = campaignDoc.campaign;

// One AI-vs-AI game. Returns the final state.
function play(rules, seed, chId) {
  let g = E.start(rules, seed);
  const doomed = [];
  for (let steps = 0; g.phase === 'play' && steps < 6000; steps++) {
    const seat = S.current(g);
    let act = null;
    if (GRAFT && seat === 0 && chId === 'ch4a' && g.script.unlocked.graft) {
      const k = g.ships.find((s) => s.name === 'kestrel' && !s.dead), t = g.ships.find((s) => s.name === 'tern' && !s.dead);
      if (k && t && E.gap(k, t) === 1) act = { type: 'graft', ship: k.id, with: t.id };
    }
    act = act || E.campaignMove(g, seat);
    let r = E.attempt(g, act);
    if (!r.ok) {
      // a locked ship (the script holds its helm): plan again as if it were not ours
      const locked = new Set(g.script.locks.map((l) => l.ship).filter(Boolean));
      const g2 = { ...g, ships: g.ships.map((s) => (s.owner === seat && locked.has(s.name) ? { ...s, owner: 9 } : s)) };
      let a2 = null; try { a2 = E.campaignMove(g2, seat); } catch { a2 = null; }
      r = a2 ? E.attempt(g, a2) : r;
      if (!r.ok) r = E.attempt(g, { type: 'end' });
    }
    if (!SLOPPY && seat === 0 && r.ok && act.type === 'fire' && r.state.events.some((e) => e.t === 'obj_destroyed' && g.objs.some((o) => o.owner === 0 && o.pos[0] === e.at[0] && o.pos[1] === e.at[1])))
      r = E.attempt(g, { type: 'end' });   // hold fire rather than shoot our own mine
    g = r.state;
    for (const e of g.events) {
      if (e.t === 'destroyed' && e.cause === 'scripted') doomed.push(e.name);
      if (e.t === 'script_unknown' || e.t === 'script_failed') doomed.problems = (doomed.problems || []).concat(e.t + ':' + (e.action || '') + (e.why ? ' (' + e.why + ')' : ''));
    }
  }
  g.doomed = doomed;
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
  const results = {}, rounds = [], deaths = {}, unknown = new Set(), extra = { mineHits: 0, stopped: 0, forced: 0, grafted: 0, scriptedGraft: 0, doomed: {} };
  let firstWin = null;
  for (let i = 0; i < GAMES; i++) {
    const g = play(rules, SEED0 + i, ch.id);
    const res = g.script.result || (g.phase === 'over' ? 'limit/' + g.winner : 'stuck');
    results[res] = (results[res] || 0) + 1;
    rounds.push(g.round);
    for (const [b, f] of Object.entries(g.script.fired)) (stats[b] || (stats[b] = [])).push(f.round);
    for (const s of g.ships) if (s.dead) deaths[s.name + (s.removed ? '(' + s.removed + ')' : '')] = (deaths[s.name + (s.removed ? '(' + s.removed + ')' : '')] || 0) + 1;
    for (const n of g.doomed) extra.doomed[n] = (extra.doomed[n] || 0) + 1;
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
  log(`  enemy mine hits ${extra.mineHits}; player missiles stopped by PD ${extra.stopped}; kestrel+tern grafted in ${extra.grafted} games`);
  log(`  script_unknown / script_failed events: ${unknown.size ? [...unknown].join(', ') : 'none'}`);
  progress = E.applyResult(progress, chDoc, firstWin || { script: { result: 'win', flags: {} }, ships: [], winner: 0 });
  log(`  progress out (${firstWin ? 'from a won game' : 'synthesised win: no game won'}): roster ${JSON.stringify(progress.roster.map((r) => r.id + (r.hull ? '(carried ' + r.hull.length + '-segment hull)' : '')))}`);
}
const file = arg('out', null);
if (file) fs.writeFileSync(file, out.join('\n') + '\n');
