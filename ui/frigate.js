// SHATKON player ships: clean cel-shaded sci-fi vessels built from the parts actually fitted.
// (The enemy, the Weave, keeps the organic hex hulls of ui/ships.js.)
// Look: light grey/white hull, dark grey panels and outlines, teal/cyan emissive stripes, blue
// thruster cones at the stern, light from the top left; glow only on emissives.
// Geometry stays hexagonal: ONE fused hull plate over the whole hex cluster (inset outline, outer
// corners cut at hex angles, a lit/shaded chamfer band round it, inner seams only faint lines),
// a broad armoured keel down the bow line (60-degree prow, teal stripe) and broad struts square to
// it out to off-axis hexes. The bow is the mirror line nearest the enemy (or the longest axis).
// Each hex is laid out by where it sits: bow (prow wedge, sensor nose), stern (engine block and
// plumes), flank (wing armour, hard points), core (bridge). Modules decide what appears:
//   core       bridge superstructure with a cyan canopy (flagship: command tower and a star)
//   engine     thruster bank and blue plume cones at the stern; side pods when hull is behind
//   laser      twin-barrel turret that turns toward the nearest enemy
//   launcher   VLS missile pod             point_defence  small CIWS turret
//   sensor     dish (a sensor nose on the bow)            comms  lattice antenna mast + light
//   shield     hex glass emitter panels and a hex-shaped energy skin round the hull
//   armour     a thick bolted band along the hex's outer hull (more armour, thicker)
//   stealth    graphite faceted plating with a light rim (stays visible on the dark board)
//   magazine   VLS hatches                 flare_mask  heat louvres
// Lost parts go dark and scorched or break off; a wrecked segment is charred wreckage.

import * as hex from '../engine/hex.js';
import { bowFor, partKind } from './ships.js';

const NS = 'http://www.w3.org/2000/svg';
const f2 = (n) => (Math.round(n * 100) / 100).toString();
const f1 = (n) => (Math.round(n * 10) / 10).toString();
function el(tag, attrs, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) e.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) e.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
export const FC = {
  hi: '#f3f6f9', plate: '#d5dce5', lo: '#a7b3c1', panel: '#5a6572', panelLo: '#3a434e', line: '#1a2028',
  teal: '#2fe0c8', cyan: '#5ff7ff', blue: '#3a8dff', glassHi: '#a8f3ff', glassLo: '#2a6fd0',
  dark: '#2a323c', facetA: '#3a4450', facetB: '#4a5562', dead: '#23272e', deadLine: '#353b45', soot: '#121418', ember: '#d9a441',
};
// shared defs (one set per <svg>): plate shading lit from the top left, for 12 bow directions
export function frigateDefs() {
  const d = [];
  for (let k = 0; k < 12; k++) {
    // light comes from the top left of the screen; express that in a frame turned by k*30 degrees
    const a = (-k * Math.PI) / 6, lx = -0.7, ly = -0.7, x = lx * Math.cos(a) - ly * Math.sin(a), y = lx * Math.sin(a) + ly * Math.cos(a);
    const g = (id, stops) => d.push(el('linearGradient', { id: id + k, gradientUnits: 'userSpaceOnUse', x1: f2(x), y1: f2(y), x2: f2(-x), y2: f2(-y) }, stops.map(([o, c]) => el('stop', { offset: o, 'stop-color': c }))));
    g('fgP', [['0', FC.hi], ['.5', FC.plate], ['1', FC.lo]]);
    g('fgD', [['0', '#56616e'], ['.55', '#3b444f'], ['1', '#2a313a']]);
    g('fgA', [['0', '#8b97a5'], ['.5', '#636e7b'], ['1', '#434c57']]);
  }
  const w = (id, stops) => d.push(el('linearGradient', { id, x1: '0', y1: '0', x2: '1', y2: '1' }, stops.map(([o, c]) => el('stop', { offset: o, 'stop-color': c }))));
  w('fgPw', [['0', FC.hi], ['.5', FC.plate], ['1', FC.lo]]);
  w('fgDw', [['0', '#56616e'], ['.55', '#3b444f'], ['1', '#2a313a']]);
  w('fgAw', [['0', '#97a3b1'], ['.5', '#6a7582'], ['1', '#46505b']]);
  w('fgKeel', [['0', '#7a8592'], ['.5', '#56616d'], ['1', '#3a434d']]);
  w('fgSt', [['0', '#6b7684'], ['.55', '#4c5662'], ['1', '#38414b']]);
  d.push(el('linearGradient', { id: 'fgGlass', x1: '0', y1: '0', x2: '1', y2: '1' }, el('stop', { offset: '0', 'stop-color': FC.glassHi, 'stop-opacity': '.95' }), el('stop', { offset: '.55', 'stop-color': '#3fb8e8', 'stop-opacity': '.85' }), el('stop', { offset: '1', 'stop-color': FC.glassLo, 'stop-opacity': '.9' })));
  d.push(el('linearGradient', { id: 'fgPlume', x1: '0', y1: '0', x2: '1', y2: '0' }, el('stop', { offset: '0', 'stop-color': '#3a8dff', 'stop-opacity': '0' }), el('stop', { offset: '.55', 'stop-color': '#3a8dff', 'stop-opacity': '.85' }), el('stop', { offset: '.85', 'stop-color': '#8fd6ff' }), el('stop', { offset: '1', 'stop-color': '#ffffff' })));
  d.push(el('radialGradient', { id: 'fgBubble' }, el('stop', { offset: '.6', 'stop-color': FC.cyan, 'stop-opacity': '0' }), el('stop', { offset: '1', 'stop-color': FC.cyan, 'stop-opacity': '.18' })));
  d.push(el('radialGradient', { id: 'fgScorch' }, el('stop', { offset: '0', 'stop-color': '#050506', 'stop-opacity': '.85' }), el('stop', { offset: '.6', 'stop-color': '#1d1611', 'stop-opacity': '.55' }), el('stop', { offset: '1', 'stop-color': '#1d1611', 'stop-opacity': '0' })));
  d.push(el('radialGradient', { id: 'fgEmber' }, el('stop', { offset: '0', 'stop-color': '#ffd38a', 'stop-opacity': '1' }), el('stop', { offset: '.45', 'stop-color': FC.ember, 'stop-opacity': '.6' }), el('stop', { offset: '1', 'stop-color': FC.ember, 'stop-opacity': '0' })));
  d.push(el('radialGradient', { id: 'fgNozzle' }, el('stop', { offset: '0', 'stop-color': '#ffffff', 'stop-opacity': '.9' }), el('stop', { offset: '.4', 'stop-color': FC.cyan, 'stop-opacity': '.6' }), el('stop', { offset: '1', 'stop-color': FC.blue, 'stop-opacity': '0' })));
  return el('defs', { class: 'frigate-defs' }, d);
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const corner = (c, S, i) => { const a = (Math.PI / 180) * (60 * i - 30); return [c[0] + S * Math.cos(a), c[1] + S * Math.sin(a)]; };
const poly = (pts) => 'M' + pts.map((p) => f2(p[0]) + ',' + f2(p[1])).join('L') + 'Z';
const mirrorY = (pts) => pts.concat(pts.slice().reverse().map(([x, y]) => [x, -y]));
const hexU = (r, rot = 0) => [0, 1, 2, 3, 4, 5].map((v) => { const a = (Math.PI / 180) * (60 * v + rot); return [r * Math.cos(a), r * Math.sin(a)]; });
function rnd(seed) { let t = seed | 0; return () => { t = (t + 0x6d2b79f5) | 0; let x = Math.imul(t ^ (t >>> 15), t | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const k12 = (deg) => ((Math.round(deg / 30) % 12) + 12) % 12;

const LIGHT = [-Math.SQRT1_2, -Math.SQRT1_2];   // light from the top left of the screen

let clipN = 0;
// opts as drawShip in ui/ships.js, plus target: [x, y] (drawing units) for the turrets to face.
export function drawFrigate(o) {
  const S = o.S, cells = o.cells, n = cells.length, P = cells.map(o.xy), far = !o.detail;
  const { bow: b } = bowFor(P, S, o.forward);
  const theta = (Math.atan2(b[1], b[0]) * 180) / Math.PI, perp = [-b[1], b[0]], kk = k12(theta);
  const cx = P.reduce((m, p) => m + p[0], 0) / n, cy = P.reduce((m, p) => m + p[1], 0) / n;
  // U: hexes along the bow line from the centre; V: hexes across it (local +y)
  const U = P.map((p) => dot([p[0] - cx, p[1] - cy], b) / S), Vv = P.map((p) => dot([p[0] - cx, p[1] - cy], perp) / S);
  const behind = (i) => U.some((u, j) => j !== i && u < U[i] - 0.6 && Math.abs(Vv[j] - Vv[i]) < 0.95);
  const ahead = (i) => U.some((u, j) => j !== i && u > U[i] + 0.6 && Math.abs(Vv[j] - Vv[i]) < 0.95);
  const segs = o.segs.map((sg) => {
    const k = {};
    for (const p of sg.parts || []) { const kd = partKind(p.t, o.rules && o.rules.parts ? o.rules.parts[p.t] : null); (k[kd] = k[kd] || []).push({ up: p.hp > 0, hurt: p.hp > 0 && p.hp < p.max }); }
    return { k, known: !!sg.parts, wrecked: !!sg.wrecked };
  });
  const list = (i, kd) => segs[i].k[kd] || [], cnt = (i, kd) => list(i, kd).length, up = (i, kd) => list(i, kd).filter((x) => x.up).length;
  let engUp = 0; segs.forEach((s, i) => { if (!s.wrecked) engUp += up(i, 'engine'); });
  const anyKnown = segs.some((s) => s.known);
  const power = anyKnown ? Math.min(1.2, engUp / Math.max(1, n)) : 0.6, plume = (0.8 + 0.5 * power + (o.moved ? 0.3 : 0)) * (far ? 1.35 : 1);

  // where each hex sits on the ship: decides where (not whether) the fitted parts go
  let coreI = segs.findIndex((sg, i) => cnt(i, 'core'));
  if (coreI < 0) coreI = P.map((p, i) => [Math.hypot(U[i], Vv[i] * 1.2), i]).sort((a2, z2) => a2[0] - z2[0])[0][1];
  const uTop = Math.max(...U), TAPER = n === 1 ? 0.2 : 0.36;
  const pos = P.map((p, i) => ({ front: !ahead(i), stern: !behind(i), flank: Math.abs(Vv[i]) >= 0.6, core: i === coreI, side: Vv[i] >= 0 ? 1 : -1 }));
  const isBow = (i) => (pos[i].front && U[i] >= uTop - 0.3) || n === 1;
  pos.forEach((q) => { q.role = q.core ? 'core' : q.flank ? 'flank' : q.front ? 'bow' : q.stern ? 'stern' : 'mid'; });

  const root = el('g', { class: 'frigate' });
  // 1. footprint glow on the occupied hexes
  const idx = new Map(cells.map((c, i) => [hex.key(c), i]));
  let fp = '', edge = '';
  P.forEach((p, i) => {
    fp += poly([0, 1, 2, 3, 4, 5].map((v) => corner(p, S * 0.98, v)));
    for (const dv of hex.DIRS) {
      const m = [cells[i][0] + dv[0], cells[i][1] + dv[1]]; if (idx.has(hex.key(m))) continue;
      const q = o.xy(m), mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, l = Math.hypot(q[0] - p[0], q[1] - p[1]), px = (-(q[1] - p[1]) / l) * (S / 2), py = ((q[0] - p[0]) / l) * (S / 2);
      edge += `M${f1(mx - px)},${f1(my - py)}L${f1(mx + px)},${f1(my + py)}`;
    }
  });
  root.appendChild(el('path', { d: fp, fill: FC.cyan, 'fill-opacity': far ? 0.08 : 0.05 }));
  root.appendChild(el('path', { d: edge, fill: 'none', stroke: FC.cyan, 'stroke-opacity': 0.3, 'stroke-width': f2(S * 0.05), 'stroke-linecap': 'round' }));

  const nb = cells.map((c, i) => {
    const r = [-1, -1, -1, -1, -1, -1];
    for (const dv of hex.DIRS) { const m = [c[0] + dv[0], c[1] + dv[1]], j = idx.get(hex.key(m)); if (j == null) continue; const q = o.xy(m), e = ((Math.round(Math.atan2(q[1] - P[i][1], q[0] - P[i][0]) / (Math.PI / 3)) % 6) + 6) % 6; r[e] = j; }
    return r;
  });
  // 2. one fused hull over the whole cluster: the hex-cluster outline, inset, outer corners cut at
  //    hex angles; a chamfer band all round (lit on the top-left edges, shaded bottom-right) and a
  //    raised deck inside it. Hex seams are faint panel lines only.
  // taper (strictly hexagonal: whole edges move in, parallel to themselves, corners keep 120
  // degrees): bow hexes narrow toward the prow, flank hexes thin toward the wing tip
  const taper = (i, e) => {
    const a = (Math.PI / 3) * e, nrm = [Math.cos(a), Math.sin(a)], fb = dot(nrm, b), sa = Math.abs(dot(nrm, perp)), sd = dot(nrm, perp) * pos[i].side, q = pos[i];
    let t = 0;
    if (isBow(i)) t += fb > 0.3 ? TAPER * fb : (q.flank ? sd > 0.3 : sa > 0.5) && fb > -0.3 ? 0.16 : 0;
    if (q.flank && !isBow(i) && sd > 0.3 && fb > -0.6) t += 0.13;
    return S * t;
  };
  const outer = hullLoops(P, nb, S, S * 0.07, S * 0.12, taper), inner = hullLoops(P, nb, S, S * 0.2, S * 0.09, taper);
  const hullD = outer.map(poly).join(''), deckD = inner.map(poly).join('');
  const cid = 'fgc' + (++clipN), ccl = 'fgk' + clipN;
  root.appendChild(el('clipPath', { id: cid }, el('path', { d: hullD })));
  root.appendChild(el('clipPath', { id: ccl }, el('path', { d: poly(hexU(0.995, -30 - theta)) })));
  // shield field: a hex-shaped energy skin just outside the hull
  let shUp = 0, shAll = 0; segs.forEach((s, i) => { if (!s.wrecked) { shUp += up(i, 'shield'); shAll += cnt(i, 'shield'); } });
  if (shAll) {
    const fd = hullLoops(P, nb, S, -S * 0.04, S * 0.16, taper).map(poly).join('');
    root.appendChild(el('path', { d: fd, fill: shUp ? FC.cyan : 'none', 'fill-opacity': 0.06, stroke: FC.cyan, 'stroke-width': f2(S * (0.04 + 0.015 * Math.min(4, shUp))), 'stroke-opacity': shUp ? 0.6 : 0.25, 'stroke-dasharray': shUp ? null : `${f2(S * 0.15)} ${f2(S * 0.12)}`, 'stroke-linejoin': 'miter', class: shUp ? 'sk-shield' : null }));
  }
  root.appendChild(el('path', { d: hullD, fill: 'none', stroke: FC.line, 'stroke-width': f2(S * 0.15), 'stroke-linejoin': 'miter' }));
  const g = el('g', { 'clip-path': `url(#${cid})` });
  root.appendChild(g);
  const plumes = el('g', { class: 'sk-thrust' });
  root.appendChild(plumes);
  const local = (i) => `translate(${f2(P[i][0])},${f2(P[i][1])}) rotate(${f2(theta)}) scale(${f2(S)})`;

  g.appendChild(el('path', { d: hullD, fill: FC.lo }));
  outer.forEach((lo, li) => {
    const li2 = inner[li]; if (!li2 || li2.length !== lo.length) return;
    let lit = '', shd = '', soft = '';
    lo.forEach((a, j) => {
      const z = lo[(j + 1) % lo.length], nrm = inward(a, z), d = -dot(nrm, LIGHT), q = poly([a, z, li2[(j + 1) % lo.length], li2[j]]);
      if (d > 0.3) lit += q; else if (d < -0.3) shd += q; else soft += q;
    });
    g.appendChild(el('path', { d: lit, fill: FC.hi }));
    g.appendChild(el('path', { d: soft, fill: FC.plate }));
    g.appendChild(el('path', { d: shd, fill: '#8693a2' }));
  });
  g.appendChild(el('path', { d: deckD, fill: 'url(#fgPw)', stroke: FC.line, 'stroke-width': f2(S * 0.02), 'stroke-opacity': 0.35 }));
  // per-hex plating under the structures: stealth graphite, wreck soot, armour rim, faint seams
  const plating = el('g', null);
  g.appendChild(plating);
  segs.forEach((sg, i) => {
    if (sg.wrecked) { plating.appendChild(el('path', { d: poly(hp(P[i], S, 0.99)), fill: FC.soot })); return; }
    if (up(i, 'stealth') > 0) {
      // stealth: graphite facets, still with a light rim so the ship reads on the dark board
      const h1 = hp(P[i], S, 0.8);
      plating.appendChild(el('path', { d: poly(h1), fill: 'url(#fgSt)', stroke: '#c9d3de', 'stroke-width': f2(S * 0.035), 'stroke-opacity': 0.85 }));
      if (!far) plating.appendChild(el('path', { d: [0, 2, 4].map((v) => `M${f2(P[i][0])},${f2(P[i][1])}L${f2(h1[v][0])},${f2(h1[v][1])}`).join('') + poly(hp(P[i], S, 0.45)), fill: 'none', stroke: '#8fa0b2', 'stroke-width': f2(S * 0.015), 'stroke-opacity': 0.55 }));
    } else if (cnt(i, 'stealth')) plating.appendChild(el('path', { d: poly(hp(P[i], S, 0.8)), fill: FC.dead, opacity: 0.35 }));
    const ar = Math.min(3, up(i, 'armour'));
    if (ar) {
      // armour: a thick bolted band along this hex's stretch of the outer hull; more plates, thicker
      const kO = 0.78, kI = kO - 0.1 - 0.07 * ar;
      let band = '', bolts = '';
      for (let e = 0; e < 6; e++) if (nb[i][e] < 0) {
        const a1 = corner(P[i], S * kO, e), a2 = corner(P[i], S * kO, e + 1), b1 = corner(P[i], S * kI, e), b2 = corner(P[i], S * kI, e + 1);
        band += poly([a1, a2, b2, b1]);
        const m = [(a1[0] + a2[0] + b1[0] + b2[0]) / 4, (a1[1] + a2[1] + b1[1] + b2[1]) / 4];
        bolts += `M${f2(m[0] - S * 0.03)},${f2(m[1])}a${f2(S * 0.03)},${f2(S * 0.03)} 0 1,0 ${f2(S * 0.06)},0a${f2(S * 0.03)},${f2(S * 0.03)} 0 1,0 ${f2(-S * 0.06)},0`;
      }
      if (band) {
        plating.appendChild(el('path', { d: band, fill: 'url(#fgAw)', stroke: FC.line, 'stroke-width': f2(S * 0.025), 'stroke-linejoin': 'round' }));
        if (!far) plating.appendChild(el('path', { d: bolts, fill: FC.line, opacity: 0.75 }));
      }
    }
    if (!far) for (let e = 0; e < 3; e++) if (nb[i][e] >= 0) { const a1 = corner(P[i], S, e), a2 = corner(P[i], S, e + 1); plating.appendChild(el('path', { d: `M${f2(a1[0])},${f2(a1[1])}L${f2(a2[0])},${f2(a2[1])}`, stroke: FC.line, 'stroke-width': f2(S * 0.02), 'stroke-opacity': 0.2 })); }
  });

  // 3. the keel: a broad armoured spine down the bow line, 60-degree prow point, teal stripe down
  //    its middle; broad struts (straight across, square to the keel) reach the off-axis hexes
  const live = (i) => !segs[i].wrecked;
  const kw = n <= 2 ? 0.15 : n <= 4 ? 0.17 : 0.2;
  const W2 = (u, v) => [cx + S * (u * b[0] + v * perp[0]), cy + S * (u * b[1] + v * perp[1])];
  let axis = P.map((p, i) => i).filter((i) => Math.abs(Vv[i]) < 0.6);
  // a pair of hexes either side of the bow line (the flower's prongs and tail, the H's ends) carry
  // the keel along the edge they share, so it runs the ship's full length
  const pairOf = (i) => P.findIndex((p, j) => j !== i && Math.abs(U[j] - U[i]) < 0.2 && Math.abs(Vv[j] + Vv[i]) < 0.2 && nb[i].includes(j));
  P.forEach((p, i) => { if (!axis.includes(i) && Math.abs(Vv[i]) < 0.95 && pairOf(i) >= 0) axis.push(i); });
  if (!axis.length) { const mv = Math.min(...Vv.map(Math.abs)); axis = P.map((p, i) => i).filter((i) => Math.abs(Vv[i]) < mv + 0.1); }
  const vcA = axis.reduce((m, i) => m + Vv[i], 0) / axis.length, vMid = Math.abs(vcA) < 0.3 ? 0 : vcA;
  const inside = (u, v) => P.some((p, j) => Math.hypot(U[j] - u, Vv[j] - v) < 0.84);
  const struts = [];
  P.forEach((p, i) => {
    if (axis.includes(i)) return;
    const v0 = Vv[i], s = v0 > vMid ? 1 : -1;
    let ok = true;
    for (let v = v0; Math.abs(v - vMid) > kw; v -= s * 0.2) if (!inside(U[i], v)) { ok = false; break; }
    if (ok) { struts.push([W2(U[i], v0), W2(U[i], vMid + s * kw * 0.5), i]); return; }
    let best = -1, bs = 1e9;
    nb[i].forEach((j) => { if (j < 0 || Math.abs(Vv[j]) >= Math.abs(v0) - 0.1) return; const sc = Math.abs(Vv[j]) + 0.5 * Math.abs(U[j] - U[i]); if (sc < bs) { bs = sc; best = j; } });
    if (best < 0) nb[i].forEach((j) => { if (j < 0) return; const sc = Math.abs(Vv[j]) + Math.abs(U[j] - U[i]); if (Math.abs(Vv[j]) < Math.abs(v0) + 0.1 && sc < bs) { bs = sc; best = j; } });
    if (best >= 0) struts.push([P[i], P[best], i]);
  });
  const spine = el('g', null);
  g.appendChild(spine);
  if (struts.length) {
    const d = struts.map(([a, z]) => `M${f2(a[0])},${f2(a[1])}L${f2(z[0])},${f2(z[1])}`).join('');
    spine.appendChild(el('path', { d, stroke: FC.line, 'stroke-width': f2(S * 0.3), 'stroke-linecap': 'square' }));
    spine.appendChild(el('path', { d, stroke: '#5d6875', 'stroke-width': f2(S * 0.24), 'stroke-linecap': 'square' }));
    spine.appendChild(el('path', { d, stroke: '#7c8896', 'stroke-width': f2(S * 0.08), 'stroke-linecap': 'butt', transform: `translate(${f2(LIGHT[0] * S * 0.05)},${f2(LIGHT[1] * S * 0.05)})` }));
  }
  {
    const us = axis.map((i) => U[i]), reachF = (i) => (Math.abs(Vv[i]) < 0.6 ? 0.62 : 0.42), reachB = (i) => (Math.abs(Vv[i]) < 0.6 ? 0.6 : 0.42);
    const u0 = Math.min(...axis.map((i) => U[i] - reachB(i))), u1 = Math.max(...axis.map((i) => U[i] + reachF(i))), tip = kw / Math.tan(Math.PI / 6);
    const K = (u, v) => W2(u, vMid + v);
    const outlineK = [K(u0, -kw * 0.7), K(u0 + 0.08, -kw), K(u1 - tip, -kw), K(u1, 0), K(u1 - tip, kw), K(u0 + 0.08, kw), K(u0, kw * 0.7)];
    spine.appendChild(el('path', { d: poly(outlineK), fill: 'url(#fgKeel)', stroke: FC.line, 'stroke-width': f2(S * 0.05), 'stroke-linejoin': 'miter' }));
    // lit ridge on the keel's top-left side
    const ls = dot(perp, LIGHT) > 0 ? 1 : -1;
    spine.appendChild(el('path', { d: poly([K(u0 + 0.1, ls * kw * 0.85), K(u1 - tip * 1.05, ls * kw * 0.85), K(u1 - tip * 0.35, ls * kw * 0.3), K(u1 - tip * 0.6, ls * kw * 0.3), K(u0 + 0.14, ls * kw * 0.45)]), fill: '#8c98a6', opacity: 0.8 }));
    if (!far) {
      // ribs where the keel crosses from one hex to the next
      let rib = '';
      const so = us.slice().sort((a2, z2) => a2 - z2);
      for (let j = 1; j < so.length; j++) if (so[j] - so[j - 1] > 0.4) { const u = (so[j] + so[j - 1]) / 2, a2 = K(u, -kw), z2 = K(u, kw); rib += `M${f2(a2[0])},${f2(a2[1])}L${f2(z2[0])},${f2(z2[1])}`; }
      if (rib) spine.appendChild(el('path', { d: rib, stroke: FC.line, 'stroke-width': f2(S * 0.03), 'stroke-opacity': 0.7 }));
    }
    const s0 = K(u0 + 0.2, 0), s1 = K(u1 - tip * 0.9, 0), sd = `M${f2(s0[0])},${f2(s0[1])}L${f2(s1[0])},${f2(s1[1])}`;
    spine.appendChild(el('path', { d: sd, stroke: FC.cyan, 'stroke-width': f2(S * kw * 0.9), 'stroke-opacity': 0.12, 'stroke-linecap': 'round' }));
    spine.appendChild(el('path', { d: sd, stroke: FC.teal, 'stroke-width': f2(S * (far ? 0.09 : 0.065)), 'stroke-linecap': 'butt', class: 'sk-emit' }));
    if (!far) spine.appendChild(el('path', { d: sd, stroke: '#dffcff', 'stroke-width': f2(S * 0.018), 'stroke-opacity': 0.8 }));
  }

  // 4. per hex: structures by position, parts by what is fitted
  const aimFrom = (i, x, y) => {
    if (!o.target) return 0;
    const wx = P[i][0] + S * (x * b[0] - y * b[1]), wy = P[i][1] + S * (x * b[1] + y * b[0]), dx = o.target[0] - wx, dy = o.target[1] - wy;
    return (Math.atan2(dot([dx, dy], perp), dot([dx, dy], b)) * 180) / Math.PI;
  };
  // is the hex's stern a corner (pointy) or a flat edge, in the local frame?
  const cornerAft = [0, 1, 2, 3, 4, 5].some((v) => { const a = ((((60 * v - 30 - theta) % 360) + 540) % 360) - 180; return Math.abs(Math.abs(a) - 180) < 5; });
  const xAft = cornerAft ? -0.62 : -0.8, ySp = cornerAft ? 0.17 : 0.24;
  // mid-ship deck variety: rank distinct mid-cell stations from bow to stern (mirrored cells share a rank)
  const midU = [...new Set(pos.map((q, j) => (q.role === 'mid' || (q.role === 'stern' && n > 2) ? Math.round(U[j] * 4) : null)).filter((v) => v !== null))].sort((a2, z2) => z2 - a2);
  const deckRank = (i) => (midU.indexOf(Math.round(U[i] * 4)) + (Math.abs(Vv[i]) > 0.3 ? 1 : 0) + 1) % 4;
  const detail = el('g', null);
  g.appendChild(detail);
  segs.forEach((sg, i) => {
    const q = pos[i], r = rnd(i * 7919 + n * 13 + 1), G = el('g', { transform: local(i) }), add = (e) => G.appendChild(e), deck = (e) => (far ? null : add(e));
    const C = el('g', { 'clip-path': `url(#${ccl})` }); G.appendChild(C);
    const addC = (e) => C.appendChild(e);
    if (sg.wrecked) { wreck(addC, hexU(0.86, -30 - theta), r, far); detail.appendChild(G); return; }
    const yk = vMid - Vv[i], s = q.side, ar = Math.min(3, up(i, 'armour'));
    const known = sg.known;
    // flank: a wing armour panel along the outer side, with a teal running stripe
    if (q.flank) {
      const yi = s * (0.4 - 0.06 * ar), yo = s * 0.86;
      addC(el('path', { d: poly([[0.62, yi], [0.62 + Math.abs(yo - yi) * 0.577, yo], [-0.7 - Math.abs(yo - yi) * 0.577, yo], [-0.7, yi]]), fill: up(i, 'stealth') ? 'url(#fgSt)' : 'url(#fgKeel)', stroke: FC.line, 'stroke-width': '0.03' }));
      addC(el('path', { d: `M0.48,${f2(yi + s * 0.04)}L-0.58,${f2(yi + s * 0.04)}`, stroke: '#8c98a6', 'stroke-width': '0.03', opacity: 0.8 }));
      addC(el('path', { d: `M0.4,${f2(s * 0.56)}L-0.5,${f2(s * 0.56)}`, stroke: FC.teal, 'stroke-width': far ? '0.07' : '0.045', class: 'sk-emit' }));
      if (!far && ar) for (let j = 0; j < 3; j++) addC(el('circle', { cx: f2(0.35 - j * 0.38), cy: f2(yi + s * 0.1), r: '0.025', fill: FC.line, opacity: 0.8 }));
      // big hulls: vary the deck inboard of the wing from hex to hex (radiator fins, a hatch row)
      const fv = n >= 5 && !far && !cnt(i, 'engine') ? ((Math.round(U[i] * 4) % 3) + 3) % 3 : 0;
      if (fv === 1) addC(el('path', { d: [0, 1, 2, 3, 4].map((k) => `M${f2(0.1 - k * 0.12)},${f2(yi - s * 0.04)}V${f2(yi - s * 0.2)}`).join(''), stroke: '#9aa6b4', 'stroke-width': '0.03' }));
      else if (fv === 2) for (let k = 0; k < 3; k++) addC(el('rect', { x: f2(0.05 - k * 0.17), y: f2(s > 0 ? yi - 0.2 : yi + 0.06), width: '0.13', height: '0.14', fill: FC.plate, stroke: FC.line, 'stroke-width': '0.015' }));
    } else if (q.role === 'mid' || (q.role === 'stern' && n > 2)) {
      // mid-ship decks vary along a big hull (mirror pairs match): housings, a hangar bay,
      // radiator fins, a cargo grid
      const variant = n >= 5 ? deckRank(i) % 4 : 0;
      for (const t of [-1, 1]) {
        const y0 = yk + t * (kw + 0.1); if (Math.abs(y0) > 0.7) continue;
        if (variant === 0) {
          addC(el('path', { d: poly([[0.36, y0], [0.22, y0 + t * 0.24], [-0.42, y0 + t * 0.24], [-0.56, y0]]), fill: FC.plate, stroke: FC.line, 'stroke-width': '0.025' }));
          if (!far) addC(el('path', { d: `M0.2,${f2(y0 + t * 0.12)}L-0.3,${f2(y0 + t * 0.12)}`, stroke: FC.panel, 'stroke-width': '0.03', 'stroke-dasharray': '0.08 0.05' }));
        } else if (variant === 1) {
          // hangar bay: a dark door with landing lights
          addC(el('path', { d: poly([[0.3, y0 + t * 0.02], [0.16, y0 + t * 0.3], [-0.4, y0 + t * 0.3], [-0.4, y0 + t * 0.02]]), fill: '#232a33', stroke: FC.line, 'stroke-width': '0.03' }));
          if (!far) for (let k = 0; k < 4; k++) addC(el('circle', { cx: f2(0.15 - k * 0.17), cy: f2(y0 + t * 0.06), r: '0.022', fill: FC.cyan, opacity: 0.9 }));
        } else if (variant === 2) {
          // radiator fins
          addC(el('path', { d: poly([[0.34, y0], [0.2, y0 + t * 0.26], [-0.46, y0 + t * 0.26], [-0.46, y0]]), fill: FC.panel, stroke: FC.line, 'stroke-width': '0.025' }));
          if (!far) addC(el('path', { d: [0, 1, 2, 3, 4, 5].map((k) => `M${f2(0.16 - k * 0.11)},${f2(y0 + t * 0.04)}V${f2(y0 + t * 0.22)}`).join(''), stroke: '#a7b3c1', 'stroke-width': '0.03' }));
        } else {
          // cargo grid
          addC(el('path', { d: poly([[0.3, y0], [0.16, y0 + t * 0.26], [-0.44, y0 + t * 0.26], [-0.44, y0]]), fill: FC.lo, stroke: FC.line, 'stroke-width': '0.025' }));
          if (!far) for (let k = 0; k < 4; k++) addC(el('rect', { x: f2(0.06 - k * 0.13), y: f2(t > 0 ? y0 + 0.05 : y0 - 0.2), width: '0.1', height: '0.15', fill: FC.plate, stroke: FC.panel, 'stroke-width': '0.015' }));
        }
      }
    }
    // bow: prow armour wedge (60 degree chevron) with a teal chevron light
    if (isBow(i)) {
      // the wedge sits just inside the tapered prow
      const k = q.flank ? 0.7 : 0.85, ty = q.flank ? 0 : yk, xt = (cornerAft ? 0.93 : 0.8) - TAPER * (cornerAft ? 1 : 0.9) - 0.04;
      const T = [xt, ty], A1 = [xt - 0.52 * k, ty - 0.3 * k], A2 = [xt - 0.52 * k, ty + 0.3 * k], B1 = [A1[0] - 0.26 * k, A1[1]], B2 = [A2[0] - 0.26 * k, A2[1]], Ti = [xt - 0.26 * k, ty];
      addC(el('path', { d: poly([T, A2, B2, Ti, B1, A1]), fill: up(i, 'stealth') ? 'url(#fgSt)' : 'url(#fgKeel)', stroke: FC.line, 'stroke-width': '0.03', 'stroke-linejoin': 'miter' }));
      addC(el('path', { d: `M${f2(A1[0] - 0.12 * k)},${f2(A1[1])}L${f2(T[0] - 0.13 * k)},${f2(ty)}L${f2(A2[0] - 0.12 * k)},${f2(A2[1])}`, fill: 'none', stroke: FC.teal, 'stroke-width': far ? '0.06' : '0.035', class: 'sk-emit' }));
    }
    if (!known) { detail.appendChild(G); return; }
    // engines: stern hexes carry an engine block (thruster bank) and fire plumes past the stern
    const en = list(i, 'engine').slice(0, 3);
    if (en.length && q.stern) {
      const ys = en.length === 1 ? [yk] : en.length === 2 ? [-ySp, ySp] : [-ySp * 1.5, 0, ySp * 1.5];
      const hh = Math.max(...ys.map(Math.abs)) + 0.14, x1 = xAft - 0.06;
      addC(el('path', { d: poly([[-0.2, -hh + 0.08], [-0.34, -hh], [x1, -hh], [x1, hh], [-0.34, hh], [-0.2, hh - 0.08]]), fill: 'url(#fgKeel)', stroke: FC.line, 'stroke-width': '0.03' }));
      if (!far) addC(el('path', { d: `M-0.3,${f2(-hh + 0.06)}V${f2(hh - 0.06)}`, stroke: FC.teal, 'stroke-width': '0.03', 'stroke-opacity': 0.8, class: 'sk-emit' }));
      en.forEach((e, j) => {
        const y = ys[j];
        addC(el('path', { d: poly([[-0.42, y - 0.08], [xAft, y - 0.11], [xAft, y + 0.11], [-0.42, y + 0.08]]), fill: e.up ? '#2b323b' : FC.dead, stroke: FC.line, 'stroke-width': '0.025' }));
        if (!e.up) { addC(scorch(-0.55, y, 0.18)); return; }
        addC(el('rect', { x: f2(xAft - 0.02), y: f2(y - 0.09), width: '0.05', height: '0.18', fill: FC.cyan }));
        const L = 1.0 * plume, pg = el('g', { transform: local(i) }), wd = far ? 0.14 : 0.11;
        pg.appendChild(el('path', { d: `M${f2(xAft)},${f2(y - wd * 1.5)}L${f2(xAft - L * 1.25)},${f2(y)}L${f2(xAft)},${f2(y + wd * 1.5)}Z`, fill: FC.blue, opacity: f2(0.2 + 0.12 * power) }));
        pg.appendChild(el('path', { d: `M${f2(xAft)},${f2(y - wd)}L${f2(xAft - L)},${f2(y)}L${f2(xAft)},${f2(y + wd)}Z`, fill: 'url(#fgPlume)' }));
        pg.appendChild(el('path', { d: `M${f2(xAft)},${f2(y - wd * 0.45)}L${f2(xAft - L * 0.4)},${f2(y)}L${f2(xAft)},${f2(y + wd * 0.45)}Z`, fill: '#ffffff', opacity: 0.85 }));
        plumes.appendChild(pg);
      });
    } else if (en.length) {
      // engines with hull behind them: nacelles on short pylons beside the keel (or inboard of
      // the wing), an intake at the front, a ringed exhaust bell and a glow at the back
      const sides = q.flank ? [-s] : [1, -1];
      en.forEach((e, j) => {
        const t = sides[j % sides.length], off = Math.floor(j / sides.length);
        const y = q.flank ? s * (0.06 - 0.24 * off) : yk + t * (kw + 0.2 + 0.24 * off);
        if (Math.abs(y) > 0.66) return;
        const w = 0.1, xf = 0.42, xr = -0.52, dx = w * 0.577;
        const dead = !e.up;
        if (!q.flank) { const ke = yk + t * kw; addC(el('rect', { x: '-0.22', y: f2(Math.min(y, ke)), width: '0.24', height: f2(Math.abs(y - ke)), fill: FC.panelLo, stroke: FC.line, 'stroke-width': '0.02' })); }
        addC(el('path', { d: poly([[xf, y], [xf - dx, y - w], [xr, y - w], [xr - 0.04, y - w * 0.8], [xr - 0.04, y + w * 0.8], [xr, y + w], [xf - dx, y + w]]), fill: dead ? FC.dead : 'url(#fgPw)', stroke: FC.line, 'stroke-width': '0.03', 'stroke-linejoin': 'miter' }));
        if (!far) addC(el('path', { d: `M${f2(xf - dx - 0.02)},${f2(y)}L${f2(xr + 0.06)},${f2(y)}`, stroke: dead ? FC.deadLine : FC.teal, 'stroke-width': '0.03', class: dead ? null : 'sk-emit' }));
        addC(el('path', { d: poly([[xf - 0.02, y], [xf - dx * 0.8, y - w * 0.55], [xf - dx * 0.8 - 0.06, y - w * 0.55], [xf - dx * 0.8 - 0.06, y + w * 0.55], [xf - dx * 0.8, y + w * 0.55]]), fill: FC.panelLo }));
        addC(el('path', { d: poly([[xr - 0.04, y - w * 0.8], [xr - 0.13, y - w * 1.0], [xr - 0.13, y + w * 1.0], [xr - 0.04, y + w * 0.8]]), fill: dead ? FC.dead : '#2b323b', stroke: FC.line, 'stroke-width': '0.025' }));
        if (!dead) { addC(el('rect', { x: f2(xr - 0.15), y: f2(y - w * 0.75), width: '0.035', height: f2(w * 1.5), fill: FC.cyan })); addC(el('circle', { cx: f2(xr - 0.2), cy: f2(y), r: '0.1', fill: 'url(#fgNozzle)' })); }
        else deck(scorch(-0.1, y, 0.16));
      });
    }
    // sensors: on the bow they form a sensor nose; elsewhere a dish on the deck
    list(i, 'sensor').forEach((sn, j) => {
      const nose = q.front && !q.flank && j === 0;
      const nx = (cornerAft ? 0.93 : 0.8) - TAPER - 0.22;
      const x = nose ? nx : 0.05, y = nose ? yk : yk + (j % 2 ? 1 : -1) * (kw + 0.2);
      if (nose && !far) addC(el('path', { d: poly([[nx + 0.24, yk], [nx, yk - 0.13], [nx - 0.2, yk - 0.13], [nx - 0.2, yk + 0.13], [nx, yk + 0.13]]), fill: sn.up ? FC.panel : FC.dead, stroke: FC.line, 'stroke-width': '0.025' }));
      if (!far && sn.up && !nose) add(el('path', { d: `M${f2(x - 0.3)},${f2(y)}h0.16M${f2(x - 0.26)},${f2(y + 0.06)}h0.1`, stroke: FC.cyan, 'stroke-width': '0.022', 'stroke-opacity': 0.7 }));
      deck(el('circle', { cx: f2(x), cy: f2(y), r: '0.1', fill: sn.up ? FC.plate : FC.dead, stroke: FC.line, 'stroke-width': '0.025' }));
      deck(el('circle', { cx: f2(x), cy: f2(y), r: '0.06', fill: sn.up ? FC.panelLo : '#0b0c0f' }));
      add(el('circle', { cx: f2(x), cy: f2(y), r: far ? '0.06' : '0.028', fill: sn.up ? FC.cyan : FC.deadLine, class: sn.up ? 'sk-emit' : null }));
    });
    // shield emitters: a hex glass panel set in the plate (big on the wings, small inboard)
    const sh = list(i, 'shield');
    if (sh.length) {
      const on = sh.some((x) => x.up), big = q.flank, rr = big ? 0.32 + 0.03 * sh.length : 0.15 + 0.02 * sh.length;
      const pc = big ? [0, s * 0.08] : [-0.12, yk + (q.role === 'core' ? 1 : -1) * (kw + 0.22)];
      const gp = hexU(rr, -30 - theta).map(([x, y]) => [x + pc[0], y + pc[1]]);
      add(el('path', { d: poly(gp), fill: on ? 'url(#fgGlass)' : FC.dead, stroke: FC.line, 'stroke-width': big ? '0.05' : '0.03' }));
      if (on && !far) add(el('path', { d: poly(hexU(rr * 0.6, -30 - theta).map(([x, y]) => [x + pc[0], y + pc[1]])), fill: 'none', stroke: FC.cyan, 'stroke-width': '0.02', 'stroke-opacity': 0.7 }));
      if (on && !far) add(el('path', { d: `M${f2(pc[0] - rr * 0.5)},${f2(pc[1] - rr * 0.4)}L${f2(pc[0] + rr * 0.1)},${f2(pc[1] + rr * 0.45)}`, stroke: '#ffffff', 'stroke-opacity': 0.55, 'stroke-width': '0.025' }));
    }
    if (cnt(i, 'flare_mask')) deck(el('path', { d: `M-0.5,${f2(yk - 0.3)}V${f2(yk - 0.2)}M-0.44,${f2(yk - 0.3)}V${f2(yk - 0.2)}M-0.5,${f2(yk + 0.2)}V${f2(yk + 0.3)}M-0.44,${f2(yk + 0.2)}V${f2(yk + 0.3)}`, stroke: up(i, 'flare_mask') ? FC.teal : FC.deadLine, 'stroke-width': '0.025' }));
    list(i, 'magazine').forEach((m, j) => {
      const x0 = q.stern && en.length ? -0.1 : -0.35, y0 = yk + (j % 2 ? 1 : -1) * (kw + 0.12) - 0.08;
      for (const [dx, dy] of [[0, 0], [0.09, 0], [0, 0.09], [0.09, 0.09]]) deck(el('rect', { x: f2(x0 + dx), y: f2(y0 + dy), width: '0.07', height: '0.07', fill: m.up ? FC.panelLo : FC.dead, stroke: m.up ? FC.teal : FC.deadLine, 'stroke-width': '0.012' }));
    });
    list(i, 'comms').forEach((c, j) => {
      const y = yk + (j % 2 ? -1 : 1) * (kw + 0.32);
      if (Math.abs(y) > 0.75) return;
      deck(el('path', { d: `M0.25,${f2(y)}H-0.3M0.15,${f2(y - 0.06)}V${f2(y + 0.06)}M0,${f2(y - 0.05)}V${f2(y + 0.05)}M-0.15,${f2(y - 0.04)}V${f2(y + 0.04)}`, stroke: c.up ? FC.panelLo : FC.deadLine, 'stroke-width': '0.025', 'stroke-linecap': 'round' }));
      deck(el('circle', { cx: '0.25', cy: f2(y), r: '0.035', fill: c.up ? FC.teal : FC.deadLine, class: c.up ? 'blink' : null }));
    });
    // bridge superstructure on the core hex, sat on the keel (flagship: taller tower and a star)
    if (cnt(i, 'core')) {
      const k = o.flagship ? 1.25 : 1, ok = up(i, 'core') > 0, x0 = q.front && n > 1 ? -0.15 : n === 1 ? -0.05 : 0.02, y0 = yk;
      const B = (pts) => poly(mirrorY(pts).map(([x, y]) => [x0 + x * k, y0 + y * k]));
      add(el('path', { d: B([[0.36, -0.1], [0.22, -0.22], [-0.3, -0.22], [-0.4, -0.12]]), fill: ok ? 'url(#fgKeel)' : FC.dead, stroke: FC.line, 'stroke-width': '0.035', 'stroke-linejoin': 'miter' }));
      add(el('path', { d: B([[0.3, -0.07], [0.19, -0.16], [-0.24, -0.16], [-0.32, -0.08]]), fill: ok ? FC.plate : FC.deadLine, stroke: FC.line, 'stroke-width': '0.015' }));
      add(el('path', { d: B([[0.27, -0.04], [0.17, -0.11], [0.05, -0.11], [0.03, -0.04]]), fill: ok ? 'url(#fgGlass)' : '#0b0c0f', stroke: FC.line, 'stroke-width': '0.015', class: ok ? 'sk-emit' : null }));
      if (o.flagship) { deck(el('path', { d: B([[-0.02, -0.1], [-0.08, -0.13], [-0.24, -0.13], [-0.28, -0.1]]), fill: FC.panel, stroke: FC.line, 'stroke-width': '0.012' })); deck(el('path', { d: star(x0 - 0.15 * k, y0, 0.07), fill: FC.cyan })); }
      else deck(el('path', { d: `M${f2(x0 - 0.1)},${f2(y0 - 0.1)}V${f2(y0 + 0.1)}M${f2(x0 - 0.18)},${f2(y0 - 0.1)}V${f2(y0 + 0.1)}`, stroke: FC.teal, 'stroke-width': '0.025' }));
      if (!ok) add(scorch(x0, y0, 0.3));
    }
    // hard points by position: bow mounts sit behind the wedge, wing mounts on the wing root,
    // keel mounts dorsal on the spine
    let slots;
    if (q.flank) slots = [[0.18, s * 0.12], [-0.32, s * 0.12], [0.18, -s * 0.25]];
    else if (cnt(i, 'core')) slots = [[0.58, yk], [-0.05, yk - kw - 0.24], [-0.05, yk + kw + 0.24]];
    else if (q.front && n > 1) slots = [[0.25, yk], [-0.25, yk - kw - 0.2], [-0.25, yk + kw + 0.2]];
    else slots = [[0.25, yk], [-0.25, yk], [0.25, yk - kw - 0.24]];
    if (q.front && n > 1 && list(i, 'sensor').length && !q.flank) slots[0] = [0.15, yk];
    if (q.stern && en.length && !q.flank) slots = slots.map(([x, y]) => [Math.max(x, -0.1), y]);
    let si = 0;
    for (const kd of ['laser', 'launcher', 'pd']) for (const m of list(i, kd)) {
      const [x, y] = slots[si++ % 3], dead = !m.up;
      if (far) { add(el('circle', { cx: f2(x), cy: f2(y), r: '0.12', fill: dead ? FC.dead : FC.panel, stroke: FC.line, 'stroke-width': '0.03' })); continue; }
      const tg = el('g', { transform: `translate(${f2(x)},${f2(y)})` });
      if (kd === 'laser') {
        const a = dead ? 25 : aimFrom(i, x, y);
        tg.appendChild(el('path', { d: poly(hexU(0.15, -30 - theta)), fill: dead ? FC.dead : FC.plate, stroke: FC.line, 'stroke-width': '0.03' }));
        const br = el('g', { transform: `rotate(${f2(a)})` });
        for (const sy of [-0.045, 0.045]) br.appendChild(el('rect', { x: '0.02', y: f2(sy - 0.02), width: dead ? '0.14' : '0.36', height: '0.04', fill: dead ? FC.deadLine : FC.panelLo, stroke: FC.line, 'stroke-width': '0.01' }));
        if (!dead) for (const sy of [-0.045, 0.045]) br.appendChild(el('circle', { cx: '0.38', cy: f2(sy), r: '0.022', fill: FC.cyan, class: 'sk-emit' }));
        br.appendChild(el('path', { d: poly([[0.08, -0.09], [-0.04, -0.1], [-0.11, -0.05], [-0.11, 0.05], [-0.04, 0.1], [0.08, 0.09]]), fill: dead ? FC.dead : FC.panel, stroke: FC.line, 'stroke-width': '0.02' }));
        tg.appendChild(br);
      } else if (kd === 'launcher') {
        tg.appendChild(el('path', { d: poly([[0.17, -0.09], [0.12, -0.14], [-0.17, -0.14], [-0.17, 0.14], [0.12, 0.14], [0.17, 0.09]]), fill: dead ? FC.dead : FC.panel, stroke: FC.line, 'stroke-width': '0.025' }));
        for (let a = 0; a < 3; a++) for (let c = 0; c < 2; c++) tg.appendChild(el('rect', { x: f2(-0.13 + a * 0.085), y: f2(-0.1 + c * 0.105), width: '0.065', height: '0.085', fill: dead ? '#0b0c0f' : FC.panelLo, stroke: dead ? FC.deadLine : FC.teal, 'stroke-width': '0.012' }));
      } else {
        const a = dead ? -40 : aimFrom(i, x, y);
        tg.appendChild(el('path', { d: poly(hexU(0.1, -30 - theta)), fill: dead ? FC.dead : FC.plate, stroke: FC.line, 'stroke-width': '0.025' }));
        const pdg = el('g', { transform: `rotate(${f2(a)})` });
        pdg.appendChild(el('rect', { x: '0', y: '-0.017', width: '0.2', height: '0.034', fill: dead ? FC.deadLine : FC.panelLo }));
        tg.appendChild(pdg);
        tg.appendChild(el('circle', { r: '0.035', fill: dead ? FC.deadLine : FC.cyan }));
      }
      if (dead) tg.appendChild(scorch(0, 0, 0.2));
      else if (m.hurt) tg.appendChild(crack([0, 0], r, 2, FC.ember, 0.75));
      add(tg);
    }
    // armour lost: scorched gaps; hurt plates crack
    list(i, 'armour').forEach((a, j) => {
      if (far) return;
      const yy = (j % 2 ? 1 : -1) * 0.6, x = 0.3 - Math.floor(j / 2) * 0.45;
      if (!a.up) { addC(el('path', { d: poly([[x - 0.13, yy * 0.9], [x + 0.12, yy * 0.9], [x + 0.08, yy * 1.25], [x - 0.1, yy * 1.2]]), fill: FC.soot })); addC(scorch(x, yy, 0.15)); }
      else if (a.hurt) addC(crack([x, yy], r, 2, FC.ember, 0.65));
    });
    const all = Object.values(segs[i].k).flat(), lost = all.length ? all.filter((x) => !x.up).length / all.length : 0;
    if (lost > 0.2 && !far) addC(scorch((r() - 0.5) * 0.5, (r() - 0.5) * 0.4, 0.22 + lost * 0.3));
    if (lost > 0.45) addC(crack([(r() - 0.5) * 0.3, (r() - 0.5) * 0.3], r, 3, FC.ember, 0.6));
    detail.appendChild(G);
  });
  root.dataset.shape = 'frigate';
  root.dataset.bow = String(Math.round(theta));
  return root;
}
const hp = (p, S, k) => [0, 1, 2, 3, 4, 5].map((v) => corner(p, S * k, v));

function star(x, y, r) {
  let d = '';
  for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5, rad = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + f2(x + rad * Math.cos(a)) + ',' + f2(y + rad * Math.sin(a)); }
  return d + 'Z';
}
function scorch(x, y, r) { return el('circle', { cx: f2(x), cy: f2(y), r: f2(r), fill: 'url(#fgScorch)' }); }
function crack(c, r, n, col, op) {
  let d = '';
  for (let k = 0; k < n; k++) { let a = r() * 6.283, p = c.slice(); d += `M${f2(p[0])},${f2(p[1])}`; for (let j = 0; j < 3; j++) { a += (r() - 0.5) * 1.2; const l = 0.08 + r() * 0.08; p = [p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l]; d += `L${f2(p[0])},${f2(p[1])}`; } }
  return el('path', { d, fill: 'none', stroke: col, 'stroke-opacity': op, 'stroke-width': '0.025', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
}
// The outline(s) of a hex cluster as point loops, inset by `ins`, with every outer (convex) corner
// bevelled by `bev`. nb[i][e] = index of the hex across edge e of hex i (corner e to e+1), or -1.
// Loops come out in the same order with the same point counts for any ins/bev, so two insets pair up.
export function hullLoops(P, nb, S, ins, bev, extra) {
  const vk = (p) => Math.round(p[0] * 20) + ',' + Math.round(p[1] * 20), count = new Map(), edges = new Map();
  P.forEach((p) => { for (let v = 0; v < 6; v++) { const k = vk(corner(p, S, v)); count.set(k, (count.get(k) || 0) + 1); } });
  P.forEach((p, i) => { for (let e = 0; e < 6; e++) if (nb[i][e] < 0) { const a = corner(p, S, e), z = corner(p, S, e + 1); edges.set(vk(a), { a, z, i, e }); } });
  const out = [], used = new Set();
  for (const [k0] of edges) {
    if (used.has(k0)) continue;
    const loop = []; let k = k0, guard = 0;
    while (!used.has(k) && edges.has(k) && guard++ < 300) { used.add(k); const ed = edges.get(k); loop.push(ed); k = vk(ed.z); }
    if (loop.length < 3) continue;
    const pts = [];
    loop.forEach((ed, j) => {
      const prev = loop[(j + loop.length - 1) % loop.length];
      // each edge moves in by ins plus its own taper; the corner is where the two moved edges meet,
      // so every edge stays parallel to a hex edge and every corner keeps its hex angle
      const n1 = inward(prev.a, prev.z), n2 = inward(ed.a, ed.z);
      const d1 = ins + (extra ? extra(prev.i, prev.e) : 0), d2 = ins + (extra ? extra(ed.i, ed.e) : 0);
      const det = n1[0] * n2[1] - n1[1] * n2[0];
      const x = Math.abs(det) > 1e-6 ? [(d1 * n2[1] - d2 * n1[1]) / det, (n1[0] * d2 - n2[0] * d1) / det] : [n1[0] * d1, n1[1] * d1];
      const q = [ed.a[0] + x[0], ed.a[1] + x[1]];
      if (count.get(vk(ed.a)) === 1) {
        const t1 = unitv([prev.a[0] - prev.z[0], prev.a[1] - prev.z[1]]), t2 = unitv([ed.z[0] - ed.a[0], ed.z[1] - ed.a[1]]);
        pts.push([q[0] + t1[0] * bev, q[1] + t1[1] * bev], [q[0] + t2[0] * bev, q[1] + t2[1] * bev]);
      } else pts.push(q, q);
    });
    out.push(pts);
  }
  return out;
}
const unitv = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const inward = (a, z) => unitv([-(z[1] - a[1]), z[0] - a[0]]);
// a wrecked segment: the plate broken open and charred, loose debris, embers
function wreck(add, base, r, far) {
  const pts = base.map(([x, y], j) => [x * (0.8 + r() * 0.2), y * (0.75 + r() * 0.25) + (j % 3 === 0 ? (r() - 0.5) * 0.1 : 0)]);
  add(el('path', { d: poly(pts), fill: '#1a1d22', stroke: '#000', 'stroke-width': '0.04', 'stroke-linejoin': 'round' }));
  add(el('circle', { r: '0.55', fill: 'url(#fgScorch)' }));
  add(el('path', { d: poly([[0.22, -0.05], [0.05, -0.2], [-0.18, -0.08], [-0.06, 0.14], [0.16, 0.1]]), fill: '#030304' }));
  if (far) return;
  for (let j = 0; j < 3; j++) { const x = (r() - 0.5) * 1.1, y = (r() - 0.5) * 0.9, s = 0.08 + r() * 0.08; add(el('path', { d: poly([[x, y], [x + s, y + s * 0.3], [x + s * 0.6, y + s], [x - s * 0.2, y + s * 0.7]]), fill: '#5a626d', stroke: '#000', 'stroke-width': '0.015', transform: `rotate(${f1(r() * 90)} ${f2(x)} ${f2(y)})` })); }
  add(crack([0, 0], r, 4, '#3a3f4c', 0.9));
  add(crack([0, 0], r, 2, FC.ember, 0.75));
  for (let j = 0; j < 3; j++) add(el('circle', { cx: f2((r() - 0.5) * 0.9), cy: f2((r() - 0.5) * 0.6), r: f2(0.07 + r() * 0.07), fill: 'url(#fgEmber)', class: 'sk-ember' }));
}
