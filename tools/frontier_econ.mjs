// Frontier (economy mode), slice 1: how much salvage the computer earns, where it comes from and when.
// Computer v computer (normal v normal, mirrored fleets), nothing to buy yet.
// Usage: node tools/frontier_econ.mjs [games] [tick cap]      e.g.  node tools/frontier_econ.mjs 20 100
import { readYaml, shippedFiles } from '../tests/helpers.js';
import * as E from '../engine/index.js';

const N = +process.argv[2] || 10, cap = +process.argv[3] || 100;
const b = readYaml('rules/rapid/rapid_frontier.yaml');
const { rules, problems } = E.buildRules(shippedFiles().world, b, b);
if (problems.length) { console.log('PROBLEMS', problems); process.exit(1); }

const rows = [];
const why = { cross: 0, kill: 0, hold: 0, ground: 0, rock: 0 }, whyBy = [{ ...why }, { ...why }];
let cappedTicks = 0, payTicks = 0;
for (let i = 0; i < N; i++) {
  let seed = i * 13 + 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let g = E.rapidStart(E.rapidRules({ ...rules, rapid: b.rapid }, { cap }), 900 + i);
  let first = [null, null], openTicks = 0;
  while (g.phase === 'play') {
    const acts = [0, 1].map((p) => { let a = E.rapidAI(g, p, 'normal', rnd); if (E.rapidRefusal(g, p, a)) a = E.forcedMoves(g, p)[0] || { type: 'pass' }; return E.rapidRefusal(g, p, a) ? { type: 'pass' } : a; });
    g = E.rapidTick(g, acts);
    for (const e of g.events.filter((x) => x.t === 'earned')) {
      if (first[e.player] == null) first[e.player] = g.round - 1;
      payTicks++; if (e.capped) cappedTicks++;
      for (const it of e.items) whyBy[e.player][it.why] += it.n;
    }
  }
  openTicks = g.rapid.openTicks;
  rows.push({ seed: 900 + i, winner: g.winner, ticks: g.round, openTicks, purse: g.econ.purse.slice(), first, peak: g.econ.perTick.map((t) => Math.max(0, ...t)) });
}

const avg = (f) => (rows.reduce((n, r) => n + f(r), 0) / rows.length).toFixed(1);
console.log(`Frontier economy, computer v computer, ${N} games, tick cap ${cap} (opening ticks not counted)`);
console.log('seed  winner  ticks  opening  salvage P1  salvage P2  first pay (tick) P1/P2  best tick P1/P2');
for (const r of rows) console.log([r.seed, String(r.winner).padEnd(6), String(r.ticks).padStart(5), String(r.openTicks).padStart(8), String(r.purse[0]).padStart(11), String(r.purse[1]).padStart(11), ('  ' + r.first.join(' / ')).padStart(24), ('  ' + r.peak.join(' / ')).padStart(16)].join('  '));
console.log(`\nAverage salvage a game: P1 ${avg((r) => r.purse[0])}, P2 ${avg((r) => r.purse[1])}; average length ${avg((r) => r.ticks)} ticks; first pay around tick ${avg((r) => r.first[0] ?? r.ticks)}.`);
console.log('Where it came from (total over all games):');
for (const p of [0, 1]) console.log('  P' + (p + 1) + ': ' + Object.entries(whyBy[p]).map(([k, n]) => E.EARN_WORDS[k] + ' ' + n).join(', '));
console.log(`Ticks that paid: ${payTicks}; of those, cut by the cap: ${cappedTicks}.`);
console.log('Wins: P1 ' + rows.filter((r) => r.winner === 0).length + ', P2 ' + rows.filter((r) => r.winner === 1).length + ', draws ' + rows.filter((r) => r.winner === 'draw').length + '.');
