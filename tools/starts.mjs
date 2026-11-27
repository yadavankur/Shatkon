// Secret starts, step 1: how many legal starting layouts does each side of each board have,
// and can ~12 of them be picked that are really different from each other?
//
// A layout is where every ship of one side starts. Ships keep the hull and facing the board file
// gives them; only the spot moves. Three filters, each inside the one before:
//   legal       what the engine already accepts (rules.js): on the board, not on blocked terrain,
//               inside the side's home zone, no two ships sharing a hex, not on a starting mine
//   apart       + no ship touching another (one clear hex between every two ships)
//   apart+back  + the flagship not in the zone's front row (the row nearest the enemy)
// Ships that are exact copies (same hull, same parts) count once: swapping two of them is the same picture.
//
// Counting: an exact search when the number is small; otherwise an estimate (sample every ship's spot
// at random, see what share of samples passes, scale by the number of combinations). The report says which.
// Picking: random legal layouts, then the board's own start first and each next pick the one furthest
// from all picked so far (hex distance between the same ship's spots, the flagship counted x3).
//
//   node tools/starts.mjs                      all boards, report to the screen
//   node tools/starts.mjs --board 01_first_light
//   node tools/starts.mjs --md docs/design/secret-starts-count.md --json docs/design/starts
//   --pick 12  --samples 200000  --seed 1  --filter apart (which filter the picks must pass)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBoard, boardNames } from './boards.mjs';
import * as H from '../engine/hex.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const PICK = Number(opt('pick', 12)), SAMPLES = Number(opt('samples', 200000)), SEED = Number(opt('seed', 1));
const FILTER = opt('filter', 'apart'), EXACT_CAP = 5e6;
const boards = opt('board') ? [opt('board')] : boardNames();

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export function sideSetup(rules, p) {
  const R = rules.board.radius, fleet = rules.fleets[p];
  const zone = rules.zones.find((z) => z.name.indexOf(fleet.name) === 0);
  const blocked = new Set();
  for (const tr of rules.terrain) if ((rules.terrainTypes[tr.type] || {}).blocks_movement) tr.cells.forEach((c) => blocked.add(H.key(c)));
  for (const d of fleet.deployment) if (d.munition) blocked.add(H.key(d.at));          // own starting mines stay put
  const rowOf = (c) => H.EDGE[zone.edge](c, R);
  const zoneCells = H.disc([0, 0], R).filter((c) => rowOf(c) < zone.depth);
  const ok = (c) => H.inHexagon(c, R) && !blocked.has(H.key(c)) && rowOf(c) < zone.depth;
  const ships = fleet.ships.filter((s) => !s.reserve && fleet.deployment.some((d) => d.ship === s.name));
  const sig = (s) => s.segs.map((g) => H.key(g.off) + ':' + g.parts.slice().sort().join('+')).sort().join(';');
  const list = ships.map((s) => {
    const cand = [];
    for (const a of zoneCells) {
      const cells = s.segs.map((g) => H.add(a, g.off));
      if (cells.every(ok)) cand.push({ at: a, cells, keys: cells.map(H.key), front: Math.max(...cells.map(rowOf)) === zone.depth - 1 });
    }
    return { name: s.name, flagship: s.flagship, sig: sig(s), cand, own: fleet.deployment.find((d) => d.ship === s.name).at };
  });
  // biggest ships first (fewest spots), copies next to each other so they can be kept in order
  list.sort((a, b) => a.cand.length - b.cand.length || a.sig.localeCompare(b.sig));
  for (let i = 0; i < list.length; i++) list[i].sameAsPrev = i > 0 && list[i - 1].sig === list[i].sig;
  return { zone, zoneCells, list };
}

const NB = (k) => { const c = H.unkey(k); return H.DIRS.map((d) => H.key(H.add(c, d))); };
export function fits(placed, cand, filter, isFlag) {
  if (filter === 'apart+back' && isFlag && cand.front) return false;
  for (const k of cand.keys) {
    if (placed.has(k)) return false;
    if (filter !== 'legal') for (const n of NB(k)) if (placed.has(n)) return false;
  }
  return true;
}

// exact count, stopping at EXACT_CAP
export function countExact(list, filter) {
  let n = 0, capped = false;
  const placed = new Set();
  const go = (i, minIdx) => {
    if (capped) return;
    if (i === list.length) { if (++n >= EXACT_CAP) capped = true; return; }
    const s = list[i];
    for (let j = s.sameAsPrev ? minIdx + 1 : 0; j < s.cand.length; j++) {
      const c = s.cand[j];
      if (!fits(placed, c, filter, s.flagship)) continue;
      c.keys.forEach((k) => placed.add(k));
      go(i + 1, j);
      c.keys.forEach((k) => placed.delete(k));
      if (capped) return;
    }
  };
  go(0, -1);
  return { n, exact: !capped };
}
// estimate: share of fully random choices that pass, times all combinations, over the copies' orderings
export function countEstimate(list, filter, rand) {
  let hit = 0;
  for (let t = 0; t < SAMPLES; t++) {
    const placed = new Set(); let good = true;
    for (const s of list) {
      const c = s.cand[Math.floor(rand() * s.cand.length)];
      if (!fits(placed, c, filter, s.flagship)) { good = false; break; }
      c.keys.forEach((k) => placed.add(k));
    }
    if (good) hit++;
  }
  let combos = 1, dup = 1, run = 1;
  for (let i = 0; i < list.length; i++) { combos *= list[i].cand.length; if (list[i].sameAsPrev) { run++; dup *= run; } else run = 1; }
  return { n: hit ? combos * hit / SAMPLES / dup : 0, hits: hit, upper: combos / dup };
}
// one random layout that passes the filter (random order, backtracking), or null
export function randomLayout(list, filter, rand) {
  const placed = new Set(), out = [];
  let steps = 0;
  const go = (i) => {
    if (i === list.length) return true;
    if (++steps > 20000) return false;
    const s = list[i], order = s.cand.map((_, j) => j);
    for (let j = order.length - 1; j > 0; j--) { const r = Math.floor(rand() * (j + 1)); [order[j], order[r]] = [order[r], order[j]]; }
    for (const j of order) {
      const c = s.cand[j];
      if (!fits(placed, c, filter, s.flagship)) continue;
      c.keys.forEach((k) => placed.add(k)); out[i] = c.at;
      if (go(i + 1)) return true;
      c.keys.forEach((k) => placed.delete(k));
    }
    return false;
  };
  return go(0) ? out.slice() : null;
}
// distance between two layouts: the same ship's spots, flagship x3; copies matched in the cheaper order (greedy)
export function layoutDist(list, a, b) {
  let d = 0;
  for (let i = 0; i < list.length;) {
    let j = i + 1; while (j < list.length && list[j].sameAsPrev) j++;
    const w = list[i].flagship ? 3 : 1;
    const left = b.slice(i, j);
    for (let x = i; x < j; x++) {
      let best = 0, bd = Infinity;
      left.forEach((c, y) => { const dd = H.dist(a[x], c); if (dd < bd) { bd = dd; best = y; } });
      d += w * bd; left.splice(best, 1);
    }
    i = j;
  }
  return d;
}

export function pickSpread(list, filter, rand, pick = PICK) {
  const own = list.map((s) => s.own);
  const pool = []; const seen = new Set([JSON.stringify(own)]);
  for (let t = 0; t < 3000 && pool.length < 1500; t++) {
    const L = randomLayout(list, filter, rand); if (!L) continue;
    const k = JSON.stringify(L); if (!seen.has(k)) { seen.add(k); pool.push(L); }
  }
  const picked = [own];
  while (picked.length < pick && pool.length) {
    let bi = -1, bv = -1;
    pool.forEach((L, i) => { const v = Math.min(...picked.map((P) => layoutDist(list, L, P))); if (v > bv) { bv = v; bi = i; } });
    picked.push(pool.splice(bi, 1)[0]);
  }
  const fi = list.findIndex((s) => s.flagship);
  const flagSpots = new Set(picked.map((L) => H.key(L[fi])));
  let minPair = Infinity, minFlag = Infinity;
  for (let i = 0; i < picked.length; i++) for (let j = i + 1; j < picked.length; j++) {
    minPair = Math.min(minPair, layoutDist(list, picked[i], picked[j]));
    minFlag = Math.min(minFlag, H.dist(picked[i][fi], picked[j][fi]));
  }
  return { picked, flagSpots: flagSpots.size, minPair, minFlag, poolSize: pool.length + picked.length - 1 };
}

const fmt = (c) => (c.exact ? String(c.n) : c.n === 0 ? `0 of ${SAMPLES} samples (upper bound ${sci(c.upper)})` : '~' + sci(c.n));
function sci(x) { if (x < 1e4) return String(Math.round(x)); const e = Math.floor(Math.log10(x)); return (x / 10 ** e).toFixed(1) + 'e' + e; }

// run as a command (not when another tool imports the counting functions)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const rows = [], jsonOut = {};
for (const b of boards) {
  const { rules, problems } = loadBoard(b);
  if (problems && problems.length) { console.log(b + ': board problems, skipped: ' + problems[0]); continue; }
  jsonOut[b] = {};
  for (let p = 0; p < rules.fleets.length; p++) {
    const rand = rng(SEED * 1000 + p * 97 + b.length);
    const S = sideSetup(rules, p);
    const counts = {};
    for (const f of ['legal', 'apart', 'apart+back']) {
      const e = countExact(S.list, f);
      counts[f] = e.exact ? e : countEstimate(S.list, f, rand);
    }
    const sp = pickSpread(S.list, FILTER, rand);
    const fl = S.list.find((x) => x.flagship);
    const flagCand = fl.cand.length, flagBack = fl.cand.filter((c) => !c.front).length;
    // does the board's own start pass "apart"?
    const placed = new Set(); let ownApart = true;
    for (const x of S.list) { const c = x.cand.find((cc) => H.same(cc.at, x.own)); if (!c || !fits(placed, c, 'apart', false)) { ownApart = false; if (!c) break; } if (c) c.keys.forEach((k) => placed.add(k)); }
    const row = { flagCand, flagBack, ownApart, board: b, side: p + 1, zone: `${S.zone.edge} depth ${S.zone.depth} (${S.zoneCells.length} hexes)`, ships: S.list.length, counts, ...sp };
    rows.push(row);
    jsonOut[b]['player_' + (p + 1)] = { filter: FILTER, seed: SEED, ships: S.list.map((s) => s.name), layouts: sp.picked.map((L) => L.map((c) => c.join(',')).join(' ')) };
    console.log(`${b} P${p + 1}: ${S.list.length} ships, zone ${row.zone} | legal ${fmt(counts.legal)} | apart ${fmt(counts.apart)} | apart+back ${fmt(counts['apart+back'])} | flagship can sit in ${flagCand} spots (${flagBack} off the front row) | own start apart: ${ownApart ? 'yes' : 'no'} | picked ${sp.picked.length}, ${sp.flagSpots} flagship spots, closest two layouts ${sp.minPair}, closest two flagships ${sp.minFlag} hexes`);
  }
}

if (opt('json')) {
  const dir = opt('json'); fs.mkdirSync(dir, { recursive: true });
  for (const [b, v] of Object.entries(jsonOut)) fs.writeFileSync(path.join(dir, b + '.json'), JSON.stringify(v, null, 1) + '\n');
}
if (opt('md')) {
  const line = (r) => `| ${r.board} | ${r.side} | ${r.ships} | ${r.zone} | ${fmt(r.counts.legal)} | ${fmt(r.counts.apart)} | ${fmt(r.counts['apart+back'])} | ${r.flagCand} (${r.flagBack}) | ${r.ownApart ? 'yes' : 'no'} | ${r.flagSpots} of ${r.picked.length} |`;
  const md = `| Board | Side | Ships | Home zone | Legal | Apart | Apart + flagship back | Flagship spots (off front row) | Today's start is apart | Flagship spots in the 12 picks |\n|---|---|---|---|---|---|---|---|---|---|\n` + rows.map(line).join('\n') + '\n';
  fs.writeFileSync(opt('md') + '.table', md);
}
}
