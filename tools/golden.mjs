// Record (or check) the golden games: finished computer-v-computer games on the shipped rapid boards.
// Every build must replay them move for move to the same final position, so a switched-off experiment
// can't leak into the normal game. tests/golden.test.js checks them; re-record only on purpose:
//   node tools/golden.mjs --record
import { writeFileSync, readFileSync } from 'node:fs';
import { readYaml, shippedFiles } from '../tests/helpers.js';
import * as E from '../engine/index.js';

export const GOLDEN = [
  { board: 'rapid_opus', seed: 4101, ticks: 90 },
  { board: 'rapid_frontier', seed: 4202, ticks: 90, opts: { cpuStyle0: 'boom', cpuStyle: 'turtle' } },
  { board: 'rapid_frontier', seed: 4303, ticks: 90, opts: { cpuStyle0: 'rush', cpuStyle: 'boom' } },
];
export function rulesFor(g) {
  const b = readYaml('rules/rapid/' + g.board + '.yaml');
  const { rules } = E.buildRules(shippedFiles().world, b, b);
  return E.rapidRules({ ...rules, rapid: b.rapid }, g.opts || {});
}
export function play(g) {
  let r = g.seed;
  const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  let s = E.rapidStart(rulesFor(g), g.seed);
  for (let i = 0; i < g.ticks && s.phase === 'play'; i++) {
    const acts = [0, 1].map((p) => { const a = E.rapidAI(s, p, 'normal', rnd); return E.rapidRefusal(s, p, a) ? (E.forcedMoves(s, p)[0] || { type: 'pass' }) : a; });
    s = E.rapidTick(s, acts);
  }
  return s;
}
if (process.argv.includes('--record')) {
  for (const g of GOLDEN) {
    const s = play(g);
    const out = { ...g, moves: s.rapid.ticks.map((k) => k.acts.join(' ')), finalHash: E.hashState(s), round: s.round, phase: s.phase };
    writeFileSync('tests/golden/' + g.board + '-' + g.seed + '.json', JSON.stringify(out));
    console.log(g.board, g.seed, 'ticks', out.moves.length, 'hash', out.finalHash);
  }
}
