// Secret starts: how long should each side's numbered list be?
// For lists of N layouts (picked as in tools/starts.mjs: today's start first, then spread out),
// assume the opponent knows the whole list and each layout is equally likely. Then measure:
//   spots        how many different spots the flagship has across the list
//   hit-1        the chance of naming the flagship's exact spot in one guess (the commonest spot)
//   aim          how far, on average, the flagship is from the single best hex to aim at (hexes)
//   1 seen / 2 seen
//                after spotting one (or two) of the other ships at their exact starting spot:
//                layouts still possible, and how often the flagship's spot is then certain.
// Only exact sightings are used. Not seeing a ship somewhere also tells you something, so real
// play gives away a little more than this shows.
//   node tools/starts-how-many.mjs [--board NAME] [--sizes 1,3,6,12,24,48] [--seed 1]

import { loadBoard, boardNames } from './boards.mjs';
import { rng, sideSetup, pickSpread, randomLayout } from './starts.mjs';
import * as H from '../engine/hex.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const SIZES = opt('sizes', '1,3,6,12,24,48').split(',').map(Number);
const SEED = Number(opt('seed', 1));
const boards = opt('board') ? [opt('board')] : boardNames();
const pct = (x) => Math.round(100 * x) + '%';

function measure(list, layouts, zoneCells) {
  const fi = list.findIndex((s) => s.flagship), N = layouts.length;
  const freq = new Map();
  for (const L of layouts) { const k = H.key(L[fi]); freq.set(k, (freq.get(k) || 0) + 1); }
  const spots = freq.size, hit1 = Math.max(...freq.values()) / N;
  let aim = Infinity;
  for (const h of zoneCells) aim = Math.min(aim, layouts.reduce((t, L) => t + H.dist(h, L[fi]), 0) / N);
  // a sighting: ship i of the true layout seen at its spot; consistent = some ship of the same kind there
  const others = list.map((_, i) => i).filter((i) => i !== fi);
  const consistent = (L, seen) => seen.every(([sig, k]) => list.some((s, j) => s.sig === sig && H.key(L[j]) === k));
  const after = (n) => {
    if (others.length < n) return null;
    let left = 0, pinned = 0, cases = 0;
    for (const T of layouts) {
      const combos = n === 1 ? others.map((i) => [i]) : others.flatMap((i, a) => others.slice(a + 1).map((j) => [i, j]));
      for (const c of combos) {
        const seen = c.map((i) => [list[i].sig, H.key(T[i])]);
        const keep = layouts.filter((L) => consistent(L, seen));
        left += keep.length; cases++;
        if (new Set(keep.map((L) => H.key(L[fi]))).size === 1) pinned++;
      }
    }
    return { left: left / cases, pinned: pinned / cases };
  };
  return { N, spots, hit1, aim, a1: after(1), a2: after(2) };
}

const fmtAfter = (a) => (a ? `${a.left.toFixed(1)} left, flagship certain ${pct(a.pinned)}` : 'n/a');
console.log('Opponent knows the list; layouts equally likely. "any" = 600 random apart layouts, a stand-in for no list at all.\n');
for (const b of boards) {
  const { rules } = loadBoard(b);
  for (let p = 0; p < rules.fleets.length; p++) {
    const S = sideSetup(rules, p);
    console.log(`${b} player ${p + 1} (${S.list.length} ships, flagship fits ${S.list.find((s) => s.flagship).cand.length} spots)`);
    console.log('  N    | flagship spots | hit in 1 guess | aim error | after 1 ship seen | after 2 ships seen');
    for (const n of SIZES) {
      const { picked } = pickSpread(S.list, 'apart', rng(SEED * 1000 + p * 97 + b.length), n);
      const m = measure(S.list, picked, S.zoneCells);
      console.log(`  ${String(m.N).padEnd(4)} | ${String(m.spots).padEnd(14)} | ${pct(m.hit1).padEnd(14)} | ${m.aim.toFixed(1).padEnd(9)} | ${fmtAfter(m.a1).padEnd(36)} | ${fmtAfter(m.a2)}`);
    }
    const rand = rng(SEED * 7 + p), any = [];
    for (let t = 0; t < 2000 && any.length < 600; t++) { const L = randomLayout(S.list, 'apart', rand); if (L) any.push(L); }
    const m = measure(S.list, any, S.zoneCells);
    console.log(`  any  | ${String(m.spots).padEnd(14)} | ${pct(m.hit1).padEnd(14)} | ${m.aim.toFixed(1).padEnd(9)} | ${fmtAfter(m.a1).padEnd(36)} | ${fmtAfter(m.a2)}`);
  }
}
