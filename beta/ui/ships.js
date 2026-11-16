// SHATKON ship kit: draws a ship as one hull that fills exactly the hexes it occupies.
// The footprint never changes; only small touches make a cluster read as a ship:
//   - the bow is one of the shape's own mirror lines (the one closest to "forward"), so every
//     hull is drawn symmetrically: a slightly pointed prow, tucked-in shoulders, chamfered
//     stern corners and soft rounded corners all round;
//   - seams between segments are drawn soft, so the cluster fuses into one hull;
//   - what is inside is never shown as icons. The parts change the SURFACE instead:
//       engines      stern nozzles and glow (more working engines, brighter, longer plume)
//       armour       heavier, bumpier plating texture and a thicker plate edge
//       stealth      darker, matte, low-contrast finish, dimmer trim
//       sensors      thin emissive lines across the plate
//       comms        a faint emissive arc
//       weapons      hard-point accents on the hull edge (laser dash, launcher ports, PD dot)
//       shield       a faint hex bubble over the segment (dashed and dim while down)
//       core         a soft bridge canopy
//   - damage: lost parts scorch the plate; a wrecked segment is charred and cracked.
// Pure SVG; textures are a few shared <pattern>s built once from SVG filters (see shipDefs).

import * as hex from '../engine/hex.js';

const NS = 'http://www.w3.org/2000/svg';
const f1 = (n) => (Math.round(n * 10) / 10).toString();
function el(tag, attrs, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) e.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) e.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}

// Team colours: 0 = teal/blue (the player side), 1 = purple/pink (the enemy side).
export const TEAM = [
  { main: '#7fd8f0', neon: '#5ff7ff', accent: '#2fe0b0', hi: '#3d84a6', mid: '#163a56', lo: '#08182a', ink: '#04101c' },
  { main: '#ff8bd8', neon: '#ff5fc8', accent: '#b48bff', hi: '#8a4aa6', mid: '#3c1a52', lo: '#160a26', ink: '#0d0517' },
];
export const teamOf = (o) => TEAM[o === 1 ? 1 : 0];

// ---------- what a part is, worked out from what it does (names are only a hint) ----------
export function partKind(name, c) {
  c = c || {};
  if (c.required) return 'core';
  if (c.thrust || c.own_move) return 'engine';      // beta: a courier's sprint drive and a Comet's afterburner read as engines
  if (c.adds_range) return 'sensor';
  if (c.hides) return 'stealth';
  if (c.flare_reduction) return 'flare_mask';
  if (c.holds) return 'magazine';
  if (c.couples) return 'coupling';
  if (c.link_range) return 'comms';
  if (c.adds_signature || c.lures_missiles) return 'comms';   // beta: a decoy emitter glows like a comms arc
  if (c.recharges) return 'shield';
  if (c.hits) return 'laser';
  if (c.launches) return 'launcher';
  if (c.stops_per_round) return 'pd';
  if ((c.hp || 0) > 1) return 'armour';
  return name || 'part';
}

// ---------- shapes ----------
const cube = (c) => [c[0], -c[0] - c[1], c[1]];
// The same key for a shape however it is turned or mirrored.
export function shapeKey(cells) {
  let best = null;
  for (let m = 0; m < 2; m++) for (let k = 0; k < 6; k++) {
    const t = cells.map((c) => { let v = cube(c); if (m) v = [v[0], v[2], v[1]]; for (let i = 0; i < k; i++) v = [-v[2], -v[0], -v[1]]; return [v[0], v[2]]; });
    const mq = Math.min(...t.map((c) => c[0])), mr = Math.min(...t.map((c) => c[1]));
    const key = t.map((c) => [c[0] - mq, c[1] - mr]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((c) => c.join(',')).join(' ');
    if (!best || key < best) best = key;
  }
  return best;
}
// The hull classes: one designed look per footprint. `round` = corner softness, `taper` = how
// pointed the prow is, `deco` = the class's own trim (keel line, ring, twin keels, wing trim).
export const SHAPES = [
  { id: 'skiff', name: 'Skiff', cells: [[0, 0]], round: 0.2, taper: 0.2, deco: 'keel' },
  { id: 'dart', name: 'Dart', cells: [[0, 0], [1, 0]], round: 0.22, taper: 0.22, deco: 'keel' },
  { id: 'cutter', name: 'Cutter', cells: [[-1, 0], [0, 0], [1, 0]], round: 0.2, taper: 0.2, deco: 'wing' },
  { id: 'arrow', name: 'Arrow', cells: [[0, 0], [1, 0], [0, 1]], round: 0.18, taper: 0.26, deco: 'keel' },
  { id: 'lance', name: 'Lance', cells: [[0, -1], [1, -1], [-1, 0], [0, 0]], round: 0.18, taper: 0.24, deco: 'keel' },
  { id: 'tristar', name: 'Tri-star', cells: [[0, 0], [1, 0], [0, -1], [-1, 1]], round: 0.3, taper: 0.14, deco: 'ring' },
  { id: 'catamaran', name: 'Catamaran', cells: [[0, -1], [1, -1], [0, 0], [-1, 1], [0, 1]], round: 0.24, taper: 0.2, deco: 'twin' },
  { id: 'crescent', name: 'Crescent', cells: [[-1, -1], [-1, 0], [0, 0], [1, 0], [2, -1]], round: 0.26, taper: 0.2, deco: 'wing' },
  { id: 'wedge', name: 'Wedge', cells: [[0, 0], [1, 0], [2, 0], [1, -1], [2, -1], [2, -2]], round: 0.16, taper: 0.28, deco: 'keel' },
  { id: 'twin', name: 'Twin', cells: [[0, 0], [1, 0], [0, 1], [1, -1], [2, -1], [2, -2]], round: 0.24, taper: 0.2, deco: 'twin' },
  { id: 'weave', name: 'Weave hull', cells: [[0, -1], [-1, 0], [0, 0], [1, -1], [-1, 1], [0, 1]], round: 0.24, taper: 0.2, deco: 'twin' },
  { id: 'flower', name: 'Flower', cells: [[0, 0], [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]], round: 0.32, taper: 0.16, deco: 'ring' },
];
const BY_KEY = new Map(SHAPES.map((s) => [shapeKey(s.cells), s]));
export const shapeClass = (cells) => BY_KEY.get(shapeKey(cells)) || null;

// ---------- shared defs: gradients and textures, built once per <svg> ----------
const DIR12 = [...Array(12).keys()];
export function shipDefs() {
  const d = [];
  TEAM.forEach((t, ti) => {
    // hull shading, lit from the bow: one gradient per team per 30-degree bow direction
    for (const k of DIR12) {
      const a = (k * Math.PI) / 6, x = Math.cos(a) / 2, y = Math.sin(a) / 2;
      d.push(el('linearGradient', { id: `skh${ti}-${k}`, x1: f1(0.5 + x), y1: f1(0.5 + y), x2: f1(0.5 - x), y2: f1(0.5 - y) },
        el('stop', { offset: '0', 'stop-color': t.hi }), el('stop', { offset: '.45', 'stop-color': t.mid }), el('stop', { offset: '1', 'stop-color': t.lo })));
    }
    d.push(el('radialGradient', { id: `skg${ti}` }, el('stop', { offset: '0', 'stop-color': '#ffffff', 'stop-opacity': '.95' }), el('stop', { offset: '.3', 'stop-color': t.neon, 'stop-opacity': '.8' }), el('stop', { offset: '1', 'stop-color': t.neon, 'stop-opacity': '0' })));
    d.push(el('radialGradient', { id: `skb${ti}` }, el('stop', { offset: '.55', 'stop-color': t.neon, 'stop-opacity': '0' }), el('stop', { offset: '1', 'stop-color': t.neon, 'stop-opacity': '.22' })));
  });
  d.push(el('radialGradient', { id: 'skscorch' }, el('stop', { offset: '0', 'stop-color': '#0a0808', 'stop-opacity': '.95' }), el('stop', { offset: '.6', 'stop-color': '#1c1410', 'stop-opacity': '.75' }), el('stop', { offset: '1', 'stop-color': '#2a1c14', 'stop-opacity': '.2' })));
  d.push(el('radialGradient', { id: 'skember' }, el('stop', { offset: '0', 'stop-color': '#ffd38a', 'stop-opacity': '.95' }), el('stop', { offset: '.4', 'stop-color': '#d9a441', 'stop-opacity': '.6' }), el('stop', { offset: '1', 'stop-color': '#d9a441', 'stop-opacity': '0' })));
  // textures: lit noise (bump) rendered into small repeating tiles, so the filter runs per tile, not per ship
  const tex = (id, size, freq, oct, scale, extra) => {
    const fid = id + 'f';
    d.push(el('filter', { id: fid, x: '0', y: '0', width: '100%', height: '100%', filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' },
      el('feTurbulence', { type: 'fractalNoise', baseFrequency: freq, numOctaves: oct, seed: 7, stitchTiles: 'stitch', result: 'n' }),
      el('feDiffuseLighting', { in: 'n', surfaceScale: scale, diffuseConstant: '1', 'lighting-color': '#ffffff', result: 'l' }, el('feDistantLight', { azimuth: '235', elevation: '50' })),
      el('feColorMatrix', { in: 'l', type: 'matrix', values: '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  ' + (extra || '0.9 0 0 0 -0.62') })));
    const fid2 = id + 'd';
    d.push(el('filter', { id: fid2, x: '0', y: '0', width: '100%', height: '100%', filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' },
      el('feTurbulence', { type: 'fractalNoise', baseFrequency: freq, numOctaves: oct, seed: 7, stitchTiles: 'stitch', result: 'n' }),
      el('feDiffuseLighting', { in: 'n', surfaceScale: scale, diffuseConstant: '1', 'lighting-color': '#ffffff', result: 'l' }, el('feDistantLight', { azimuth: '235', elevation: '50' })),
      el('feColorMatrix', { in: 'l', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.1 0 0 0 0.52' })));
    d.push(el('pattern', { id, width: size, height: size, patternUnits: 'userSpaceOnUse' },
      el('rect', { width: size, height: size, fill: '#fff', filter: `url(#${fid})` }), el('rect', { width: size, height: size, fill: '#000', filter: `url(#${fid2})` })));
  };
  tex('sktex', 24, '0.32', 2, '1.2');            // every hull: fine panel grain
  tex('skarm', 24, '0.14', 3, '2.6', '1.3 0 0 0 -0.8'); // armour: heavy, bumpy plating
  // stealth: fine dark matte grain
  d.push(el('filter', { id: 'skmattef', x: '0', y: '0', width: '100%', height: '100%', filterUnits: 'userSpaceOnUse' },
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '1.2', numOctaves: 1, seed: 3, stitchTiles: 'stitch' }),
    el('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0.02  0 0 0 0 0.03  0 0 0 0 0.06  0 0 0 -0.9 1' })));
  d.push(el('pattern', { id: 'skmatte', width: 16, height: 16, patternUnits: 'userSpaceOnUse' }, el('rect', { width: 16, height: 16, fill: '#000', filter: 'url(#skmattef)' })));
  // scorch: blotchy soot for damage
  d.push(el('filter', { id: 'sksootf', x: '0', y: '0', width: '100%', height: '100%', filterUnits: 'userSpaceOnUse' },
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.22', numOctaves: 3, seed: 11, stitchTiles: 'stitch' }),
    el('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0.07  0 0 0 0 0.05  0 0 0 0 0.04  0 0 0 -3.2 2.1' })));
  d.push(el('pattern', { id: 'sksoot', width: 30, height: 30, patternUnits: 'userSpaceOnUse' }, el('rect', { width: 30, height: 30, fill: '#000', filter: 'url(#sksootf)' })));
  // armour plating lines: a small vector hex-tile pattern
  const hx = 3.4, hy = hx * Math.sqrt(3);
  d.push(el('pattern', { id: 'skplate', width: f1(hx * 3), height: f1(hy), patternUnits: 'userSpaceOnUse' },
    el('path', { d: `M0,${f1(hy / 2)}L${f1(hx / 2)},0H${f1(hx * 1.5)}L${f1(hx * 2)},${f1(hy / 2)}L${f1(hx * 1.5)},${f1(hy)}H${f1(hx / 2)}ZM${f1(hx * 2)},${f1(hy / 2)}H${f1(hx * 3)}`, fill: 'none', stroke: '#cfe8ff', 'stroke-width': '.25', 'stroke-opacity': '.5' })));
  return el('defs', { class: 'ship-defs' }, d);
}

// ---------- geometry helpers ----------
const V = (a, b) => [b[0] - a[0], b[1] - a[1]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const len = (a) => Math.hypot(a[0], a[1]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const vk = (p) => Math.round(p[0] * 20) + ',' + Math.round(p[1] * 20);
const corner = (c, S, i) => { const a = (Math.PI / 180) * (60 * i - 30); return [c[0] + S * Math.cos(a), c[1] + S * Math.sin(a)]; };
function rnd(seed) { let t = seed | 0; return () => { t = (t + 0x6d2b79f5) | 0; let x = Math.imul(t ^ (t >>> 15), t | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }

// A closed path through pts with each corner rounded by its own radius (r[i], in drawing units).
function roundedPath(pts, r) {
  const n = pts.length; let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const la = len(V(p, a)), lb = len(V(p, b)), k = Math.min(r[i], la / 2.05, lb / 2.05);
    const p1 = lerp(p, a, k / (la || 1)), p2 = lerp(p, b, k / (lb || 1));
    d += (i ? 'L' : 'M') + f1(p1[0]) + ',' + f1(p1[1]) + 'Q' + f1(p[0]) + ',' + f1(p[1]) + ' ' + f1(p2[0]) + ',' + f1(p2[1]);
  }
  return d + 'Z';
}

// The mirror lines of a set of points (directions, in 30-degree steps, through the centroid).
function mirrorDirs(P, S) {
  const cx = P.reduce((n, p) => n + p[0], 0) / P.length, cy = P.reduce((n, p) => n + p[1], 0) / P.length, out = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 6, c2 = Math.cos(2 * a), s2 = Math.sin(2 * a);
    const ok = P.every((p) => { const x = p[0] - cx, y = p[1] - cy, qx = cx + x * c2 + y * s2, qy = cy + x * s2 - y * c2; return P.some((o) => Math.hypot(o[0] - qx, o[1] - qy) < S * 0.1); });
    if (ok) out.push(a);
  }
  return { out, cx, cy };
}

// Pick the bow. A mirror line that points (almost) straight at the enemy wins: the ship is
// symmetric about its keel. Otherwise (the Lance, the Tri-star, the grafted Weave hull, the Twin)
// the ship simply points straight at the enemy, snapped to the nearest 30 degrees, rather than
// flying crabwise along a diagonal mirror line.
export function bowFor(P, S, forward) {
  const { out } = mirrorDirs(P, S);
  const fw = unit(forward || [0, -1]);
  let best = null, bd = -2;
  for (const a of out.flatMap((x) => [x, x + Math.PI])) { const v = [Math.cos(a), Math.sin(a)], d = dot(v, fw); if (d > bd + 1e-6) { bd = d; best = v; } }
  if (!best || bd < 0.97) {
    const a = Math.round(Math.atan2(fw[1], fw[0]) / (Math.PI / 6)) * (Math.PI / 6);
    return { bow: [Math.cos(a), Math.sin(a)], symmetric: false };
  }
  return { bow: best, symmetric: true };
}

// ---------- the ship ----------
// opts: { cells: [[q, r]...] board hexes, segs: [{ parts: [{t, hp, max}] | null, wrecked }], owner,
//   rules (for rules.parts), xy: (cell) => [x, y], S: hex radius in drawing units, forward: [x, y],
//   detail: 0 = far (silhouette, glow, wrecks), 1 = near (full surface), moved: hexes moved this turn,
//   flagship, id (for clip ids), seen }
let clipN = 0;
export function drawShip(o) {
  const S = o.S, T = teamOf(o.owner), ti = o.owner === 1 ? 1 : 0, cells = o.cells, n = cells.length;
  const P = cells.map(o.xy);
  const cls = shapeClass(cells.map((c) => [c[0] - cells[0][0], c[1] - cells[0][1]]));
  const look = cls || { id: 'custom', name: 'Hull', round: 0.22, taper: 0.18, deco: 'keel' };
  const { bow: b } = bowFor(P, S, o.forward);
  const proj = P.map((p) => dot(p, b)), pMax = Math.max(...proj), pMin = Math.min(...proj);
  const front = (i) => proj[i] >= pMax - 0.3 * S, stern = (i) => proj[i] <= pMin + 0.3 * S;
  const ax = [P.reduce((m, p) => m + p[0], 0) / n, P.reduce((m, p) => m + p[1], 0) / n];
  const offAxis = (p) => Math.abs((p[0] - ax[0]) * -b[1] + (p[1] - ax[1]) * b[0]);   // distance from the bow line
  const fMax = Math.max(...P.map((p, i) => proj[i])) + S;
  // neighbours across each edge (edge e lies between corners e and e+1, its normal at 60e degrees)
  const idx = new Map(cells.map((c, i) => [hex.key(c), i]));
  const nb = cells.map((c, i) => {
    const r = [-1, -1, -1, -1, -1, -1];
    for (const dv of hex.DIRS) {
      const m = [c[0] + dv[0], c[1] + dv[1]], j = idx.get(hex.key(m));
      if (j == null) continue;
      const v = V(P[i], o.xy(m)), e = ((Math.round(Math.atan2(v[1], v[0]) / (Math.PI / 3)) % 6) + 6) % 6;
      r[e] = j;
    }
    return r;
  });
  const vcount = new Map();
  P.forEach((p) => { for (let v = 0; v < 6; v++) { const k = vk(corner(p, S, v)); vcount.set(k, (vcount.get(k) || 0) + 1); } });
  // outer boundary loops (corners in clockwise order)
  const edges = new Map();
  P.forEach((p, i) => { for (let e = 0; e < 6; e++) if (nb[i][e] < 0) { const a = corner(p, S, e), bb = corner(p, S, e + 1); edges.set(vk(a), { a, b: bb, cell: i, e }); } });
  const loops = [], used = new Set();
  for (const [k0] of edges) {
    if (used.has(k0)) continue;
    const loop = []; let k = k0, guard = 0;
    while (!used.has(k) && edges.has(k) && guard++ < 200) { used.add(k); const ed = edges.get(k); loop.push(ed); k = vk(ed.b); }
    if (loop.length > 2) loops.push(loop);
  }
  const taper = look.taper * S, rr = look.round * S;
  let hullD = '';
  for (const loop of loops) {
    const pts = [], rad = [];
    loop.forEach((ed, i) => {
      const prev = loop[(i + loop.length - 1) % loop.length].a, next = ed.b, p = ed.a, c = P[ed.cell];
      const convex = vcount.get(vk(p)) === 1;
      if (convex) {
        const u = unit(V(c, p)), du = dot(u, b);
        if (du < -0.55 && stern(ed.cell)) { pts.push(lerp(p, prev, 0.27), lerp(p, next, 0.27)); rad.push(rr * 0.6, rr * 0.6); }
        else if (du > 0.95 && front(ed.cell) && offAxis(p) < S * 0.3) { pts.push([p[0] + u[0] * taper, p[1] + u[1] * taper]); rad.push(S * 0.05); }
        else if (du > 0.95 && front(ed.cell)) { pts.push([p[0] - u[0] * taper * 0.35, p[1] - u[1] * taper * 0.35]); rad.push(rr * 1.3); }
        else if (du > 0.45 && front(ed.cell)) { pts.push([p[0] - u[0] * taper * 0.3, p[1] - u[1] * taper * 0.3]); rad.push(rr); }
        else { pts.push(p); rad.push(rr); }
      } else if (offAxis(p) < S * 0.2 && dot(p, b) > fMax - S * 1.9) {
        // the notch between two bow segments, right on the bow line: fill it into a prow
        pts.push([p[0] + b[0] * S * 0.62, p[1] + b[1] * S * 0.62]); rad.push(S * 0.08);
      } else { pts.push(p); rad.push(rr * 0.5); }
      const nrm = unit([next[1] - p[1], -(next[0] - p[0])]);
      if (dot(nrm, b) > 0.95 && front(ed.cell) && offAxis(lerp(p, next, 0.5)) < S * 0.3) { const m = lerp(p, next, 0.5); pts.push([m[0] + nrm[0] * taper * 1.15, m[1] + nrm[1] * taper * 1.15]); rad.push(S * 0.05); }
    });
    hullD += roundedPath(pts, rad);
  }
  const g = el('g', { class: 'ship-hull' });
  const far = !o.detail;
  const dir12 = ((Math.round(Math.atan2(b[1], b[0]) / (Math.PI / 6)) % 12) + 12) % 12;
  // what each segment carries
  const kinds = o.segs.map((sg) => {
    const out = {};
    if (!sg.parts) return null;
    for (const p of sg.parts) {
      const k = partKind(p.t, o.rules && o.rules.parts ? o.rules.parts[p.t] : null);
      (out[k] = out[k] || { n: 0, up: 0, hp: 0, max: 0 }).n++;
      if (p.hp > 0) out[k].up++;
      out[k].hp += Math.max(0, p.hp); out[k].max += p.max || 1;
    }
    return out;
  });
  const has = (i, k) => (kinds[i] && kinds[i][k] ? kinds[i][k] : null);
  const stealthN = kinds.reduce((m, k) => m + (k && k.stealth ? k.stealth.up : 0), 0), stealthShare = Math.min(1, stealthN / Math.max(1, n));
  const glowK = 1 - stealthShare * 0.45;   // stealthy ships carry dimmer trim

  // 1. halo hugging the hull (no filters: two soft strokes)
  g.appendChild(el('path', { d: hullD, fill: 'none', stroke: T.neon, 'stroke-width': f1(S * 0.42), 'stroke-opacity': f1(0.07 * glowK), 'stroke-linejoin': 'round' }));
  g.appendChild(el('path', { d: hullD, fill: 'none', stroke: T.neon, 'stroke-width': f1(S * 0.2), 'stroke-opacity': f1(0.13 * glowK), 'stroke-linejoin': 'round' }));
  // 2. shields: a faint hex bubble per shielded segment (dashed while down)
  o.segs.forEach((sg, i) => {
    const sh = has(i, 'shield'); if (!sh || sg.wrecked) return;
    const up = sh.up > 0, d = [0, 1, 2, 3, 4, 5].map((v) => corner(P[i], S * 1.13, v)), path = roundedPath(d, d.map(() => S * 0.25));
    g.appendChild(el('path', { d: path, fill: up ? `url(#skb${ti})` : 'none', stroke: T.neon, 'stroke-width': f1(S * (up ? 0.07 : 0.05)), 'stroke-opacity': up ? 0.55 : 0.25, 'stroke-dasharray': up ? null : f1(S * 0.18) + ' ' + f1(S * 0.14), class: up ? 'sk-shield' : null }));
  });
  // 3. engines: stern nozzles; the working engines light them (count, not position, decides)
  const nozzles = [];
  P.forEach((p, i) => { for (let e = 0; e < 6; e++) if (nb[i][e] < 0) { const nrm = [Math.cos((e * Math.PI) / 3), Math.sin((e * Math.PI) / 3)], sd = -dot(nrm, b); if (sd > 0.45 && stern(i)) nozzles.push({ i, e, nrm, sd }); } });
  nozzles.sort((a, z) => z.sd - a.sd);
  let engUp = 0, engAll = 0;
  kinds.forEach((k, i) => { if (k && k.engine && !o.segs[i].wrecked) { engUp += k.engine.up; engAll += k.engine.n; } });
  const unknown = kinds.every((k) => !k);
  if (unknown) engUp = engAll = Math.max(1, nozzles.length);           // unscanned: just show it can move
  const power = Math.min(1, engUp / Math.max(1, n)), plume = 0.55 + 0.45 * power + (o.moved ? 0.35 : 0);
  const glows = el('g', { class: 'sk-thrust' });
  nozzles.forEach((nz, j) => {
    const p = P[nz.i], a = corner(p, S, nz.e), z = corner(p, S, nz.e + 1), m = lerp(a, z, 0.5), t = unit(V(a, z)), N = nz.nrm;
    const lit = !o.segs[nz.i].wrecked && j < engUp;
    const w = S * 0.2, out = S * 0.13;
    const q = (s, k) => [m[0] + t[0] * s + N[0] * k, m[1] + t[1] * s + N[1] * k];
    const bell = [q(-w * 0.8, -S * 0.1), q(w * 0.8, -S * 0.1), q(w, out), q(-w, out)];
    g.appendChild(el('path', { d: 'M' + bell.map((p2) => f1(p2[0]) + ',' + f1(p2[1])).join('L') + 'Z', fill: T.ink, stroke: T.hi, 'stroke-width': f1(S * 0.04), 'stroke-linejoin': 'round' }));
    if (lit) {
      const L = S * 0.55 * plume, c2 = q(0, out + L * 0.45);
      glows.appendChild(el('ellipse', { cx: f1(c2[0]), cy: f1(c2[1]), rx: f1(w * (0.9 + power * 0.4)), ry: f1(L * 0.6), fill: `url(#skg${ti})`, opacity: f1(0.55 + 0.45 * power), transform: `rotate(${f1((Math.atan2(N[1], N[0]) * 180) / Math.PI - 90)} ${f1(c2[0])} ${f1(c2[1])})` }));
      const c3 = q(0, out * 0.7);
      glows.appendChild(el('ellipse', { cx: f1(c3[0]), cy: f1(c3[1]), rx: f1(w * 0.75), ry: f1(S * 0.06), fill: '#ffffff', opacity: 0.85, transform: `rotate(${f1((Math.atan2(t[1], t[0]) * 180) / Math.PI)} ${f1(c3[0])} ${f1(c3[1])})` }));
    }
  });
  // 4. the hull itself
  g.appendChild(el('path', { d: hullD, fill: `url(#skh${ti}-${dir12})`, 'fill-rule': 'evenodd' }));
  const cid = 'skc' + (++clipN);
  const inner = el('g', { 'clip-path': `url(#${cid})` });
  g.appendChild(el('clipPath', { id: cid }, el('path', { d: hullD, 'clip-rule': 'evenodd' })));
  g.appendChild(inner);
  const cellPoly = (i, k) => 'M' + [0, 1, 2, 3, 4, 5].map((v) => { const c = corner(P[i], S * k, v); return f1(c[0]) + ',' + f1(c[1]); }).join('L') + 'Z';
  if (!far) inner.appendChild(el('path', { d: hullD, fill: 'url(#sktex)', opacity: 0.32 }));
  // per-segment surface: stealth matte, armour plating, sensor and comms emissives, damage
  const perp = [-b[1], b[0]];
  o.segs.forEach((sg, i) => {
    const p = P[i], k = kinds[i];
    if (sg.wrecked) return;
    if (!k) { if (!far) inner.appendChild(el('path', { d: cellPoly(i, 0.62), fill: 'none', stroke: T.main, 'stroke-opacity': 0.14, 'stroke-width': f1(S * 0.04), 'stroke-dasharray': f1(S * 0.1) + ' ' + f1(S * 0.1) })); return; }
    const st = k.stealth ? k.stealth.up : 0, ar = k.armour ? k.armour.up : 0;
    if (st) inner.appendChild(el('path', { d: cellPoly(i, 1.02), fill: '#04060c', opacity: f1(Math.min(0.55, 0.2 + 0.14 * st)) }));
    if (st && !far) inner.appendChild(el('path', { d: cellPoly(i, 1.02), fill: 'url(#skmatte)', opacity: f1(Math.min(0.9, 0.35 + 0.2 * st)) }));
    if (ar && !far) {
      inner.appendChild(el('path', { d: cellPoly(i, 0.98), fill: 'url(#skarm)', opacity: f1(Math.min(0.85, 0.4 + 0.15 * ar)) }));
      inner.appendChild(el('path', { d: cellPoly(i, 0.98), fill: 'url(#skplate)', opacity: f1(Math.min(0.8, 0.3 + 0.15 * ar)) }));
    }
    if (!far) inner.appendChild(el('path', { d: cellPoly(i, ar ? 0.8 : 0.74), fill: 'none', stroke: ar ? '#cfe8ff' : T.main, 'stroke-opacity': f1((ar ? 0.32 : 0.16) * (st ? 0.6 : 1)), 'stroke-width': f1(S * (ar ? 0.09 : 0.035)) }));
    // sensors: thin emissive lines across the plate, perpendicular to the bow
    const se = k.sensor;
    if (se && !far) for (let j = 0; j < se.n; j++) {
      const off = S * (0.18 + j * 0.16), c = [p[0] + b[0] * off, p[1] + b[1] * off], hl = S * (0.38 - j * 0.06), on = j < se.up;
      inner.appendChild(el('line', { x1: f1(c[0] - perp[0] * hl), y1: f1(c[1] - perp[1] * hl), x2: f1(c[0] + perp[0] * hl), y2: f1(c[1] + perp[1] * hl), stroke: on ? T.neon : '#2a3346', 'stroke-width': f1(S * 0.045), 'stroke-opacity': on ? f1(0.85 * glowK) : 0.7, 'stroke-linecap': 'round', class: on ? 'sk-emit' : null }));
    }
    // comms: a faint emissive arc toward the stern
    const cm = k.comms;
    if (cm && !far) {
      const c = [p[0] - b[0] * S * 0.12, p[1] - b[1] * S * 0.12], r1 = S * 0.36, a0 = Math.atan2(-b[1], -b[0]);
      const arc = (r) => `M${f1(c[0] + r * Math.cos(a0 - 0.75))},${f1(c[1] + r * Math.sin(a0 - 0.75))}A${f1(r)},${f1(r)} 0 0 1 ${f1(c[0] + r * Math.cos(a0 + 0.75))},${f1(c[1] + r * Math.sin(a0 + 0.75))}`;
      inner.appendChild(el('path', { d: arc(r1) + arc(r1 * 0.66), fill: 'none', stroke: cm.up ? T.accent : '#2a3346', 'stroke-width': f1(S * 0.035), 'stroke-opacity': cm.up ? f1(0.7 * glowK) : 0.6, 'stroke-linecap': 'round' }));
    }
    // damage: lost parts scorch the plate
    let hp = 0, mx = 0; for (const q of Object.values(k)) { hp += q.hp; mx += q.max; }
    const lost = mx ? 1 - hp / mx : 0;
    if (lost > 0.01) {
      const r = rnd(i * 977 + n * 31 + (o.owner || 0) * 7), c = [p[0] + (r() - 0.5) * S * 0.5, p[1] + (r() - 0.5) * S * 0.5];
      inner.appendChild(el('circle', { cx: f1(c[0]), cy: f1(c[1]), r: f1(S * (0.35 + 0.5 * lost)), fill: 'url(#skscorch)', opacity: f1(0.35 + 0.5 * lost) }));
      if (!far) inner.appendChild(el('path', { d: cellPoly(i, 0.95), fill: 'url(#sksoot)', opacity: f1(Math.min(0.9, lost * 1.3)) }));
      if (lost > 0.3) inner.appendChild(crack(c, S, r, 2 + Math.round(lost * 3), '#d9a441', 0.55));
    }
  });
  // fused seams between segments: a soft dark groove with a light lip
  if (!far) {
    let sd = '';
    P.forEach((p, i) => { for (let e = 0; e < 3; e++) { const j = nb[i][e]; if (j < 0) continue; const a = corner(p, S, e), z = corner(p, S, e + 1), a2 = lerp(a, z, 0.12), z2 = lerp(a, z, 0.88); sd += `M${f1(a2[0])},${f1(a2[1])}L${f1(z2[0])},${f1(z2[1])}`; } });
    if (sd) { inner.appendChild(el('path', { d: sd, stroke: '#000000', 'stroke-opacity': 0.45, 'stroke-width': f1(S * 0.09), 'stroke-linecap': 'round' })); inner.appendChild(el('path', { d: sd, stroke: T.main, 'stroke-opacity': 0.18, 'stroke-width': f1(S * 0.025), transform: `translate(${f1(-S * 0.04)},${f1(-S * 0.04)})` })); }
  }
  // class trim: keel, twin keels, wing line or ring (drawn once per hull, faint)
  if (!far) inner.appendChild(classTrim(look.deco, P, b, S, T, pMin, pMax, glowK));
  // wrecked segments: charred, cracked, a broken notch, a few embers
  o.segs.forEach((sg, i) => {
    if (!sg.wrecked) return;
    const p = P[i], r = rnd(i * 4243 + n * 17 + 5);
    inner.appendChild(el('path', { d: cellPoly(i, 1.04), fill: '#0b0c10', opacity: 0.88 }));
    inner.appendChild(el('path', { d: cellPoly(i, 1.04), fill: 'url(#sksoot)', opacity: 0.9 }));
    inner.appendChild(el('circle', { cx: f1(p[0]), cy: f1(p[1]), r: f1(S * 0.9), fill: 'url(#skscorch)' }));
    const v0 = Math.floor(r() * 6), a = corner(p, S * 1.05, v0), z = corner(p, S * 1.05, v0 + 1), m = lerp(a, z, 0.5), into = lerp(m, p, 0.45 + r() * 0.15);
    inner.appendChild(el('path', { d: `M${f1(lerp(a, z, 0.18)[0])},${f1(lerp(a, z, 0.18)[1])}L${f1(lerp(m, into, 0.6)[0] + (r() - 0.5) * S * 0.2)},${f1(lerp(m, into, 0.6)[1])}L${f1(into[0])},${f1(into[1])}L${f1(lerp(a, z, 0.62)[0])},${f1(lerp(a, z, 0.62)[1])}L${f1(lerp(a, z, 0.82)[0])},${f1(lerp(a, z, 0.82)[1])}Z`, fill: '#020203' }));
    inner.appendChild(crack(p, S, r, 4, '#3a3f4c', 0.9));
    inner.appendChild(crack(p, S, r, 2, '#d9a441', 0.7));
    for (let j = 0; j < 2 + Math.floor(r() * 2); j++) inner.appendChild(el('circle', { cx: f1(p[0] + (r() - 0.5) * S * 1.1), cy: f1(p[1] + (r() - 0.5) * S * 1.1), r: f1(S * (0.12 + r() * 0.14)), fill: 'url(#skember)', class: 'sk-ember' }));
  });
  // 5. hard points: weapons as accents on the hull edge, facing bow and beam
  if (!far) o.segs.forEach((sg, i) => {
    const k = kinds[i]; if (!k || sg.wrecked) return;
    const list = [];
    for (const w of ['laser', 'launcher', 'pd']) if (k[w]) for (let j = 0; j < k[w].n; j++) list.push([w, j < k[w].up]);
    if (!list.length) return;
    const p = P[i];
    let sides = [];
    for (let e = 0; e < 6; e++) { const nrm = [Math.cos((e * Math.PI) / 3), Math.sin((e * Math.PI) / 3)]; sides.push({ e, nrm, out: nb[i][e] < 0, f: dot(nrm, b) }); }
    sides = sides.filter((x) => x.f > -0.6).sort((x, y) => (y.out - x.out) || (y.f - x.f));
    list.forEach(([w, on], j) => {
      const sd = sides[j % sides.length], a = corner(p, S, sd.e), z = corner(p, S, sd.e + 1), t = unit(V(a, z)), N = sd.nrm;
      const sh = (Math.floor(j / sides.length) - 0) * 0.22, m0 = lerp(a, z, 0.5 + sh), m = [m0[0] - N[0] * S * 0.17, m0[1] - N[1] * S * 0.17];
      const ang = (Math.atan2(t[1], t[0]) * 180) / Math.PI, col = on ? T.neon : '#3a4256', op = on ? f1(0.95 * glowK) : 0.8;
      if (w === 'laser') {
        inner.appendChild(el('rect', { x: f1(m[0] - S * 0.2), y: f1(m[1] - S * 0.055), width: f1(S * 0.4), height: f1(S * 0.11), rx: f1(S * 0.05), fill: T.ink, transform: `rotate(${f1(ang)} ${f1(m[0])} ${f1(m[1])})` }));
        inner.appendChild(el('rect', { x: f1(m[0] - S * 0.15), y: f1(m[1] - S * 0.025), width: f1(S * 0.3), height: f1(S * 0.05), rx: f1(S * 0.025), fill: col, opacity: op, transform: `rotate(${f1(ang)} ${f1(m[0])} ${f1(m[1])})`, class: on ? 'sk-emit' : null }));
      } else if (w === 'launcher') {
        for (const s2 of [-1, 1]) { const c = [m[0] + t[0] * s2 * S * 0.1, m[1] + t[1] * s2 * S * 0.1]; inner.appendChild(el('rect', { x: f1(c[0] - S * 0.065), y: f1(c[1] - S * 0.065), width: f1(S * 0.13), height: f1(S * 0.13), rx: f1(S * 0.02), fill: T.ink, stroke: col, 'stroke-width': f1(S * 0.03), 'stroke-opacity': op, transform: `rotate(${f1(ang)} ${f1(c[0])} ${f1(c[1])})` })); }
      } else {
        inner.appendChild(el('circle', { cx: f1(m[0]), cy: f1(m[1]), r: f1(S * 0.09), fill: T.ink, stroke: col, 'stroke-width': f1(S * 0.03), 'stroke-opacity': op }));
        inner.appendChild(el('circle', { cx: f1(m[0]), cy: f1(m[1]), r: f1(S * 0.035), fill: col, opacity: op }));
      }
    });
  });
  // 6. bridge canopy over the core segment (the only nod to what is inside: where the crew sits)
  o.segs.forEach((sg, i) => {
    if (sg.wrecked || !has(i, 'core') || far) return;
    const p = P[i], c = [p[0] + b[0] * S * 0.05, p[1] + b[1] * S * 0.05], ang = (Math.atan2(b[1], b[0]) * 180) / Math.PI;
    inner.appendChild(el('ellipse', { cx: f1(c[0]), cy: f1(c[1]), rx: f1(S * 0.3), ry: f1(S * 0.13), fill: T.mid, stroke: T.main, 'stroke-opacity': 0.6, 'stroke-width': f1(S * 0.03), transform: `rotate(${f1(ang)} ${f1(c[0])} ${f1(c[1])})` }));
    inner.appendChild(el('ellipse', { cx: f1(c[0] + b[0] * S * 0.08), cy: f1(c[1] + b[1] * S * 0.08), rx: f1(S * 0.17), ry: f1(S * 0.07), fill: T.neon, opacity: f1(0.65 * glowK), transform: `rotate(${f1(ang)} ${f1(c[0])} ${f1(c[1])})`, class: 'sk-emit' }));
    if (o.flagship) inner.appendChild(el('path', { d: starPath([c[0] - b[0] * S * 0.36, c[1] - b[1] * S * 0.36], S * 0.13), fill: T.neon, opacity: 0.85 }));
  });
  // 7. rim: dark gap, then a crisp team-coloured edge
  g.appendChild(el('path', { d: hullD, fill: 'none', stroke: T.ink, 'stroke-width': f1(S * 0.14), 'stroke-opacity': 0.8, 'stroke-linejoin': 'round' }));
  g.appendChild(el('path', { d: hullD, fill: 'none', stroke: T.main, 'stroke-width': f1(S * (far ? 0.09 : 0.06)), 'stroke-opacity': f1(0.95 * (1 - stealthShare * 0.3)), 'stroke-linejoin': 'round' }));
  g.appendChild(glows);
  g.dataset.shape = look.id;
  return g;
}

function starPath(c, r) {
  let d = '';
  for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6 - Math.PI / 2, rad = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + f1(c[0] + rad * Math.cos(a)) + ',' + f1(c[1] + rad * Math.sin(a)); }
  return d + 'Z';
}
function crack(c, S, r, n, col, op) {
  let d = '';
  for (let k = 0; k < n; k++) {
    let a = r() * Math.PI * 2, p = c.slice(); d += `M${f1(p[0])},${f1(p[1])}`;
    for (let j = 0; j < 3; j++) { a += (r() - 0.5) * 1.1; const l = S * (0.18 + r() * 0.18); p = [p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l]; d += `L${f1(p[0])},${f1(p[1])}`; }
  }
  return el('path', { d, fill: 'none', stroke: col, 'stroke-opacity': op, 'stroke-width': f1(S * 0.04), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
}
function classTrim(deco, P, b, S, T, pMin, pMax, glowK) {
  const cx = P.reduce((n, p) => n + p[0], 0) / P.length, cy = P.reduce((n, p) => n + p[1], 0) / P.length, perp = [-b[1], b[0]];
  const along = (t, side) => { const base = dot([cx, cy], b), o = pMin - base + (pMax - pMin) * t; return [cx + b[0] * o + perp[0] * side, cy + b[1] * o + perp[1] * side]; };
  const g = el('g', { fill: 'none', stroke: T.main, 'stroke-linecap': 'round', 'stroke-opacity': f1(0.28 * glowK), 'stroke-width': f1(S * 0.035) });
  const line = (a, z) => g.appendChild(el('path', { d: `M${f1(a[0])},${f1(a[1])}L${f1(z[0])},${f1(z[1])}` }));
  const span = pMax - pMin;
  if (deco === 'keel') { const a = [cx + b[0] * (pMin - dot([cx, cy], b) - S * 0.55), cy + b[1] * (pMin - dot([cx, cy], b) - S * 0.55)], z = [cx + b[0] * (pMax - dot([cx, cy], b) + S * 0.75), cy + b[1] * (pMax - dot([cx, cy], b) + S * 0.75)]; line(a, z); }
  if (deco === 'twin') for (const s2 of [-1, 1]) line(along(-0.4, s2 * S * 0.45), along(1.4, s2 * S * 0.45));
  if (deco === 'wing') { const w = P.reduce((m, p) => Math.max(m, Math.abs(dot([p[0] - cx, p[1] - cy], perp))), 0) + S * 0.6; for (const s2 of [-1, 1]) line([cx + perp[0] * s2 * S * 0.3 - b[0] * S * 0.25, cy + perp[1] * s2 * S * 0.3 - b[1] * S * 0.25], [cx + perp[0] * s2 * w - b[0] * S * 0.55, cy + perp[1] * s2 * w - b[1] * S * 0.55]); }
  if (deco === 'ring') { const r = Math.max(S * 0.75, span * 0.42); g.appendChild(el('circle', { cx: f1(cx), cy: f1(cy), r: f1(r) })); g.appendChild(el('circle', { cx: f1(cx), cy: f1(cy), r: f1(r * 0.55), 'stroke-opacity': f1(0.18 * glowK) })); }
  return g;
}
