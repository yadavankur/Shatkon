// Frontier, slice 5: the rush / boom / turtle triangle, computer v computer.
// Each pairing is played N games, half with each style on each side (the board is mirrored).
// A game with no flagship lost by the tick cap is judged on points: enemy segments destroyed.
// The triangle works if each style beats one other more than 55% of the time and loses to the third.
// Usage: node tools/frontier_styles.mjs [games per pairing] [tick cap]     e.g. node tools/frontier_styles.mjs 20 150
import { readYaml, shippedFiles } from '../tests/helpers.js';
import * as E from '../engine/index.js';

const N = +process.argv[2] || 20, cap = +process.argv[3] || 150;
const b = readYaml('rules/rapid/rapid_frontier.yaml');
const { rules } = E.buildRules(shippedFiles().world, b, b);
const pairs = [['rush', 'boom'], ['boom', 'turtle'], ['turtle', 'rush']];

function play(s0, s1, seed) {
  let r = seed;
  const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  let g = E.rapidStart(E.rapidRules({ ...rules, rapid: b.rapid }, { cap, cpuStyle0: s0, cpuStyle: s1 }), seed);
  while (g.phase === 'play') {
    const acts = [0, 1].map((p) => { let a = E.rapidAI(g, p, 'normal', rnd); if (E.rapidRefusal(g, p, a)) a = E.forcedMoves(g, p)[0] || { type: 'pass' }; return E.rapidRefusal(g, p, a) ? { type: 'pass' } : a; });
    g = E.rapidTick(g, acts);
  }
  const lost = [0, 1].map((p) => g.ships.filter((x) => x.owner === p && x.dead && !x.converted).length);
  // no flagship lost by the tick cap: judge on points, the enemy segments destroyed (a draw if equal)
  const segs = [0, 1].map((p) => g.ships.filter((x) => x.owner !== p && x.dead && !x.converted).reduce((n, x) => n + x.segs.length, 0));
  const onPoints = g.winner === 'draw' || g.winner == null ? (segs[0] > segs[1] ? 0 : segs[1] > segs[0] ? 1 : 'draw') : g.winner;
  return { winner: onPoints, outright: g.winner === 0 || g.winner === 1, ticks: g.round, earned: g.econ.earned.slice(), spent: g.econ.spent.map((x) => ({ ...x })), lost };
}

const t0 = Date.now();
console.log(`Frontier styles, computer v computer, ${N} games a pairing, tick cap ${cap}\n`);
const score = { rush: { w: 0, l: 0, d: 0 }, boom: { w: 0, l: 0, d: 0 }, turtle: { w: 0, l: 0, d: 0 } };
const spentBy = { rush: {}, boom: {}, turtle: {} }, earnedBy = { rush: [], boom: [], turtle: [] };
for (const [A, B] of pairs) {
  let a = 0, bb = 0, d = 0, len = 0, kills = [0, 0], outright = 0;
  for (let i = 0; i < N; i++) {
    const swap = i % 2 === 1, s0 = swap ? B : A, s1 = swap ? A : B;
    const r = play(s0, s1, 1000 + i * 7 + A.length * 31 + B.length);
    len += r.ticks; if (r.outright) outright++;
    const st = [s0, s1];
    for (const p of [0, 1]) { earnedBy[st[p]].push(r.earned[p]); for (const [k, v] of Object.entries(r.spent[p])) spentBy[st[p]][k] = (spentBy[st[p]][k] || 0) + v; }
    const lostA = r.lost[swap ? 1 : 0], lostB = r.lost[swap ? 0 : 1]; kills[0] += lostB; kills[1] += lostA;
    if (r.winner === 'draw' || r.winner == null) { d++; score[A].d++; score[B].d++; continue; }
    const won = st[r.winner];
    if (won === A) { a++; score[A].w++; score[B].l++; } else { bb++; score[B].w++; score[A].l++; }
  }
  console.log(`${A.padEnd(6)} v ${B.padEnd(6)}  ${A} ${a}, ${B} ${bb}, draws ${d} (${outright} won outright, the rest on points)   average ${(len / N).toFixed(0)} ticks   ships destroyed: by ${A} ${kills[0]}, by ${B} ${kills[1]}`);
}
console.log('\nBy style (all games):');
for (const s of Object.keys(score)) {
  const e = earnedBy[s], avg = (e.reduce((x, y) => x + y, 0) / Math.max(1, e.length)).toFixed(0);
  console.log(`  ${s.padEnd(6)} won ${score[s].w}, lost ${score[s].l}, drew ${score[s].d}; earned ${avg} a game; spent (total) ${Object.entries(spentBy[s]).map(([k, v]) => k + ' ' + v).join(', ') || 'nothing'}`);
}
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
