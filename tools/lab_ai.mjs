// Computer v computer on the Experiments board with every experiment on: how often each side uses
// each one, by keenness. node tools/lab_ai.mjs [games=6] [keen=sometimes|eager]
import { readYaml, shippedFiles } from '../tests/helpers.js';
import * as E from '../engine/index.js';
const N = Number(process.argv[2] || 6), K = process.argv[3] || 'sometimes';
const b = readYaml('rules/rapid/rapid_lab.yaml');
const { rules } = E.buildRules(shippedFiles().world, b, b);
const keys = ['ram', 'decoy', 'repair', 'warp', 'hibernate'];
const all = Object.fromEntries(E.EXP_KEYS.map((k) => [k, true]));
const tally = {}, res = { 0: 0, 1: 0, draw: 0 };
for (let i = 0; i < N; i++) {
  let s = E.rapidStart(E.rapidRules({ ...rules, rapid: b.rapid }, { exp: all, cpuExp: Object.fromEntries(keys.map((k) => [k, K])), cap: 80 }), 900 + i);
  let r = 1000 + i; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  while (s.phase === 'play') {
    const acts = [0, 1].map((p) => { let a = E.rapidAI(s, p, 'normal', rnd); if (E.rapidRefusal(s, p, a)) a = E.forcedMoves(s, p)[0] || { type: 'pass' }; return a; });
    for (const a of acts) { const k = a.type === 'buy' ? a.item : a.type; tally[k] = (tally[k] || 0) + 1; if (a.convert) tally['to ' + a.convert] = (tally['to ' + a.convert] || 0) + 1; }
    s = E.rapidTick(s, acts);
    for (const e of s.events) if (['mended', 'woke', 'decoy_hit', 'rammed'].includes(e.t)) tally['ev ' + e.t] = (tally['ev ' + e.t] || 0) + 1;
  }
  res[s.winner]++;
}
console.log(K, N + ' games', JSON.stringify(res));
console.log(tally);
