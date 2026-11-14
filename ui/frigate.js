// SHATKON player ships: clean cel-shaded sci-fi vessels built from the parts actually fitted.
// (The enemy, the Weave, keeps the organic hex hulls of ui/ships.js.)
// Look: light grey/white hull plates, dark grey panels and outlines, teal/cyan emissive stripes,
// blue thruster cones at the stern, panel lines, light from the top left; glow only on emissives.
// Build: every hex is a hull plate, and every pair of joined hexes is linked by a hull beam, so
// the silhouette follows the hex cluster (an H gets a spine and four pods, a flower an armoured
// core, a crescent a ring...). The bow is the shape's mirror line that faces the enemy. Then the
// modules are fitted on top, so a ship visibly changes as parts are added or lost:
//   core       bridge block with a cyan canopy (flagship: bigger command tower and a star)
//   engine     thruster housings and blue plume cones at the stern (more engines, more cones)
//   laser      twin-barrel turret that turns toward the nearest enemy
//   launcher   VLS missile pod             point_defence  small CIWS turret
//   sensor     dish plus circuit lines     comms          lattice antenna mast with a light
//   shield     a translucent hex glass pod and a faint bubble
//   armour     bolt-on plates: a dark armour rim that widens the plate (more armour, wider)
//   stealth    dark angular faceted plating            magazine  VLS hatches
//   coupling   teal joint lights where the beams meet  flare_mask heat louvres
// Lost parts go dark and scorched or break off; a wrecked segment is charred wreckage.
// The hull stays inside the ship's own hexes (clipped), over a faint footprint glow.

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
  d.push(el('linearGradient', { id: 'fgGlass', x1: '0', y1: '0', x2: '1', y2: '1' }, el('stop', { offset: '0', 'stop-color': FC.glassHi, 'stop-opacity': '.95' }), el('stop', { offset: '.55', 'stop-color': '#3fb8e8', 'stop-opacity': '.85' }), el('stop', { offset: '1', 'stop-color': FC.glassLo, 'stop-opacity': '.9' })));
  d.push(el('linearGradient', { id: 'fgPlume', x1: '0', y1: '0', x2: '1', y2: '0' }, el('stop', { offset: '0', 'stop-color': '#3a8dff', 'stop-opacity': '0' }), el('stop', { offset: '.55', 'stop-color': '#3a8dff', 'stop-opacity': '.85' }), el('stop', { offset: '.85', 'stop-color': '#8fd6ff' }), el('stop', { offset: '1', 'stop-color': '#ffffff' })));
  d.push(el('radialGradient', { id: 'fgBubble' }, el('stop', { offset: '.6', 'stop-color': FC.cyan, 'stop-opacity': '0' }), el('stop', { offset: '1', 'stop-color': FC.cyan, 'stop-opacity': '.18' })));
  d.push(el('radialGradient', { id: 'fgScorch' }, el('stop', { offset: '0', 'stop-color': '#050506', 'stop-opacity': '.85' }), el('stop', { offset: '.6', 'stop-color': '#1d1611', 'stop-opacity': '.55' }), el('stop', { offset: '1', 'stop-color': '#1d1611', 'stop-opacity': '0' })));
  d.push(el('radialGradient', { id: 'fgEmber' }, el('stop', { offset: '0', 'stop-color': '#ffd38a', 'stop-opacity': '1' }), el('stop', { offset: '.45', 'stop-color': FC.ember, 'stop-opacity': '.6' }), el('stop', { offset: '1', 'stop-color': FC.ember, 'stop-opacity': '0' })));
  return el('defs', { class: 'frigate-defs' }, d);
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const corner = (c, S, i) => { const a = (Math.PI / 180) * (60 * i - 30); return [c[0] + S * Math.cos(a), c[1] + S * Math.sin(a)]; };
const poly = (pts) => 'M' + pts.map((p) => f2(p[0]) + ',' + f2(p[1])).join('L') + 'Z';
const mirrorY = (pts) => pts.concat(pts.slice().reverse().map(([x, y]) => [x, -y]));
const hexU = (r, rot = 0) => [0, 1, 2, 3, 4, 5].map((v) => { const a = (Math.PI / 180) * (60 * v + rot); return [r * Math.cos(a), r * Math.sin(a)]; });
function rnd(seed) { let t = seed | 0; return () => { t = (t + 0x6d2b79f5) | 0; let x = Math.imul(t ^ (t >>> 15), t | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const k12 = (deg) => ((Math.round(deg / 30) % 12) + 12) % 12;

// plate outlines in hex units (bow = +x), mirrored from half outlines
const PLATE = {
  mid: (w) => mirrorY([[0.72, -0.26 * w], [0.52, -0.5 * w], [-0.56, -0.5 * w], [-0.72, -0.32 * w]]),
  prow: (w) => mirrorY([[0.92, -0.05], [0.58, -0.32 * w], [0.3, -0.5 * w], [-0.56, -0.5 * w], [-0.72, -0.32 * w]]),
  stealth: (w) => mirrorY([[0.84, -0.04], [0.26, -0.48 * w], [-0.62, -0.42 * w], [-0.5, -0.08]]),
};

let clipN = 0;
// opts as drawShip in ui/ships.js, plus target: [x, y] (drawing units) for the turrets to face.
export function drawFrigate(o) {
  const S = o.S, cells = o.cells, n = cells.length, P = cells.map(o.xy), far = !o.detail;
  const { bow: b } = bowFor(P, S, o.forward);
  const theta = (Math.atan2(b[1], b[0]) * 180) / Math.PI, perp = [-b[1], b[0]], kk = k12(theta);
  const cx = P.reduce((m, p) => m + p[0], 0) / n, cy = P.reduce((m, p) => m + p[1], 0) / n;
  const U = P.map((p) => dot([p[0] - cx, p[1] - cy], b) / S), Vv = P.map((p) => dot([p[0] - cx, p[1] - cy], perp) / S);
  const uMax = Math.max(...U);
  const behind = (i) => U.some((u, j) => j !== i && u < U[i] - 0.6 && Math.abs(Vv[j] - Vv[i]) < 0.95);
  const segs = o.segs.map((sg) => {
    const k = {};
    for (const p of sg.parts || []) { const kd = partKind(p.t, o.rules && o.rules.parts ? o.rules.parts[p.t] : null); (k[kd] = k[kd] || []).push({ up: p.hp > 0, hurt: p.hp > 0 && p.hp < p.max }); }
    return { k, known: !!sg.parts, wrecked: !!sg.wrecked };
  });
  const list = (i, kd) => segs[i].k[kd] || [], cnt = (i, kd) => list(i, kd).length, up = (i, kd) => list(i, kd).filter((x) => x.up).length;
  let engUp = 0; segs.forEach((s, i) => { if (!s.wrecked) engUp += up(i, 'engine'); });
  const anyKnown = segs.some((s) => s.known);
  const power = anyKnown ? Math.min(1.2, engUp / Math.max(1, n)) : 0.6, plume = 0.75 + 0.45 * power + (o.moved ? 0.3 : 0);

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
  const cid = 'fgc' + (++clipN);
  root.appendChild(el('clipPath', { id: cid }, el('path', { d: fp })));
  const g = el('g', { 'clip-path': `url(#${cid})` });
  root.appendChild(g);
  const plumes = el('g', { class: 'sk-thrust' });
  root.appendChild(plumes);
  const local = (i) => `translate(${f2(P[i][0])},${f2(P[i][1])}) rotate(${f2(theta)}) scale(${f2(S)})`;

  // 2. hull body: the hex cluster itself, slightly inset, with small hex-angle bevels on the outer
  //    corners, one dark outline round it and a seam on every inner edge. Each hex is a bevelled
  //    plate: an inner hex face with lit (top-left) and shaded (bottom-right) facets around it.
  const nb = cells.map((c, i) => {
    const r = [-1, -1, -1, -1, -1, -1];
    for (const dv of hex.DIRS) { const m = [c[0] + dv[0], c[1] + dv[1]], j = idx.get(hex.key(m)); if (j == null) continue; const q = o.xy(m), e = ((Math.round(Math.atan2(q[1] - P[i][1], q[0] - P[i][0]) / (Math.PI / 3)) % 6) + 6) % 6; r[e] = j; }
    return r;
  });
  const hullD = hullPath(P, nb, S, S * 0.07, S * 0.16);
  const plates = P.map((p, i) => ({ st: up(i, 'stealth') > 0, prow: U[i] >= uMax - 0.3 && Math.abs(Vv[i]) < 0.6, ar: up(i, 'armour') }));
  g.appendChild(el('path', { d: hullD, fill: 'none', stroke: FC.line, 'stroke-width': f2(S * 0.16), 'stroke-linejoin': 'miter' }));
  g.appendChild(el('path', { d: hullD, fill: 'url(#fgPw)' }));
  const body = el('g', null), detail = el('g', null), top = el('g', null);
  g.appendChild(body); g.appendChild(detail); g.appendChild(top);
  const hp = (i, k) => [0, 1, 2, 3, 4, 5].map((v) => corner(P[i], S * k, v));
  segs.forEach((sg, i) => {
    const pl = plates[i], o1 = hp(i, 0.98), face = hp(i, pl.ar ? 0.62 : 0.8), mid = hp(i, 0.8);
    if (sg.wrecked) { body.appendChild(el('path', { d: poly(o1), fill: FC.soot })); return; }
    if (pl.st) body.appendChild(el('path', { d: poly(o1), fill: 'url(#fgDw)' }));
    // facets: corners 3,4,5 face the top-left light, 0,1,2 the shade
    if (!far) for (let v = 0; v < 6; v++) {
      const w = (v + 1) % 6, lit = v >= 3 && v <= 4 || (v === 5 && false);
      const shade = v === 0 || v === 1 ? 0.16 : v === 2 ? 0.08 : v === 5 ? 0.03 : 0;
      const quad = [o1[v], o1[w], face[w], face[v]];
      if (shade) body.appendChild(el('path', { d: poly(quad), fill: '#000', opacity: f2(shade * (pl.st ? 0.6 : 1)) }));
      else if (lit) body.appendChild(el('path', { d: poly(quad), fill: '#fff', opacity: pl.st ? 0.06 : 0.28 }));
    }
    if (pl.ar) {
      // bolt-on armour: a darker ring of plates, thicker for each working plate, bolts at the corners
      const ring = hp(i, 0.7 + 0.06 * Math.min(3, pl.ar));
      body.appendChild(el('path', { d: poly(ring) + poly(face.slice().reverse()), fill: `url(#fgAw)`, stroke: FC.line, 'stroke-width': f2(S * 0.03), 'fill-rule': 'evenodd' }));
      if (!far) { const bolts = hp(i, (0.62 + 0.7 + 0.06 * Math.min(3, pl.ar)) / 2); for (const q of bolts) body.appendChild(el('circle', { cx: f2(q[0]), cy: f2(q[1]), r: f2(S * 0.03), fill: FC.line, opacity: 0.8 })); }
    }
    body.appendChild(el('path', { d: poly(face), fill: pl.st ? 'url(#fgDw)' : 'url(#fgPw)', stroke: FC.line, 'stroke-width': f2(S * 0.025), 'stroke-opacity': 0.7 }));
    if (!far) body.appendChild(el('path', { d: [0, 1, 2, 3, 4, 5].map((v) => `M${f2(face[v][0])},${f2(face[v][1])}L${f2(o1[v][0])},${f2(o1[v][1])}`).join(''), stroke: FC.line, 'stroke-width': f2(S * 0.015), 'stroke-opacity': 0.45 }));
    // seams on inner edges
    if (!far) for (let e = 0; e < 3; e++) if (nb[i][e] >= 0) { const a1 = corner(P[i], S, e), a2 = corner(P[i], S, e + 1); body.appendChild(el('path', { d: `M${f2(a1[0])},${f2(a1[1])}L${f2(a2[0])},${f2(a2[1])}`, stroke: FC.line, 'stroke-width': f2(S * 0.05), 'stroke-opacity': 0.6 })); }
    void mid;
  });
  // the spine: from the core out to every segment (a tree over the joined hexes), a dark keel
  //    with a teal light down the middle; along the bow line it runs the full length of the ship
  {
    let root = segs.findIndex((sg, i) => cnt(i, 'core'));
    if (root < 0) root = P.map((p, i) => [Math.hypot(U[i], Vv[i]), i]).sort((a2, z2) => a2[0] - z2[0])[0][1];
    const seen = new Set([root]), q = [root], tree = [];
    while (q.length) { const i = q.shift(); for (let e = 0; e < 6; e++) { const j = nb[i][e]; if (j >= 0 && !seen.has(j)) { seen.add(j); q.push(j); tree.push([i, j]); } } }
    let d = '';
    for (const [i, j] of tree) d += `M${f2(P[i][0])},${f2(P[i][1])}L${f2(P[j][0])},${f2(P[j][1])}`;
    const axisCells = P.map((p, i) => i).filter((i) => Math.abs(Vv[i]) < 0.3);
    if (axisCells.length) {
      const us = axisCells.map((i) => U[i]), a0 = Math.min(...us) - 0.6, a1 = Math.max(...us) + 0.62;
      d += `M${f2(cx + b[0] * a0 * S)},${f2(cy + b[1] * a0 * S)}L${f2(cx + b[0] * a1 * S)},${f2(cy + b[1] * a1 * S)}`;
    }
    if (d) {
      detail.appendChild(el('path', { d, stroke: FC.line, 'stroke-width': f2(S * 0.2), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-opacity': 0.8 }));
      detail.appendChild(el('path', { d, stroke: FC.panel, 'stroke-width': f2(S * 0.14), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      detail.appendChild(el('path', { d, stroke: FC.cyan, 'stroke-width': f2(S * 0.16), 'stroke-opacity': 0.1, 'stroke-linecap': 'round' }));
      detail.appendChild(el('path', { d, stroke: FC.teal, 'stroke-width': f2(S * (far ? 0.08 : 0.045)), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'sk-emit' }));
    }
  }

  // 3. per segment: panels, stripe, modules
  const aimFrom = (i, x, y) => {
    if (!o.target) return 0;
    const wx = P[i][0] + S * (x * b[0] - y * b[1]), wy = P[i][1] + S * (x * b[1] + y * b[0]), dx = o.target[0] - wx, dy = o.target[1] - wy;
    return (Math.atan2(dot([dx, dy], perp), dot([dx, dy], b)) * 180) / Math.PI;
  };
  segs.forEach((sg, i) => {
    const pl = plates[i], r = rnd(i * 7919 + n * 13 + 1), G = el('g', { transform: local(i) }), add = (e) => G.appendChild(e), deck = (e) => (far ? null : add(e));
    const stern = !behind(i);
    if (sg.wrecked) { wreck(add, hexU(0.86, -30 - theta), r, far); detail.appendChild(G); return; }
    const W = 1;
    if (!sg.known) { detail.appendChild(G); return; }
    // off-axis plates get a short teal running light across the bow side
    if (!far && !pl.st && Math.abs(Vv[i]) >= 0.3) add(el('path', { d: 'M0.42,-0.2L0.42,0.2', stroke: FC.teal, 'stroke-width': '0.05', 'stroke-opacity': 0.8, class: 'sk-emit' }));
    // shield: translucent hex glass pod + faint bubble
    const sh = list(i, 'shield');
    if (sh.length) {
      const on = sh.some((x) => x.up);
      add(el('ellipse', { rx: '0.84', ry: '0.76', fill: on ? 'url(#fgBubble)' : 'none', stroke: FC.cyan, 'stroke-width': '0.03', 'stroke-opacity': on ? 0.5 : 0.2, 'stroke-dasharray': on ? null : '0.12 0.1', class: on ? 'sk-shield' : null }));
      const pod = hexU(0.3 + 0.05 * sh.length, 0), pc = [-0.05, 0];
      add(el('path', { d: poly(pod.map(([x, y]) => [x + pc[0], y + pc[1]])), fill: on ? 'url(#fgGlass)' : FC.dead, stroke: FC.line, 'stroke-width': '0.035', opacity: on ? 0.92 : 1 }));
      if (on && !far) add(el('path', { d: `M${f2(pc[0] - 0.12)},${f2(-0.18)}L${f2(pc[0] + 0.1)},${f2(0.16)}M${f2(pc[0] + 0.14)},-0.2L${f2(pc[0] + 0.22)},-0.05`, stroke: '#ffffff', 'stroke-opacity': 0.5, 'stroke-width': '0.025' }));
    }
    // flare mask: louvres
    if (cnt(i, 'flare_mask')) deck(el('path', { d: 'M-0.62,-0.2V-0.07M-0.56,-0.2V-0.07M-0.62,0.07V0.2M-0.56,0.07V0.2', stroke: up(i, 'flare_mask') ? FC.teal : FC.deadLine, 'stroke-width': '0.025' }));
    // magazine: VLS hatches
    list(i, 'magazine').forEach((m, j) => {
      const x0 = -0.5, y0 = j ? 0.06 : -0.16;
      for (const [dx, dy] of [[0, 0], [0.09, 0], [0, 0.09], [0.09, 0.09]]) deck(el('rect', { x: f2(x0 + dx), y: f2(y0 + dy), width: '0.07', height: '0.07', fill: m.up ? FC.panelLo : FC.dead, stroke: m.up ? FC.teal : FC.deadLine, 'stroke-width': '0.012' }));
    });
    // sensors: dish and circuit lines
    list(i, 'sensor').forEach((s, j) => {
      const y = j % 2 ? 0.24 : -0.24, x = 0.1;
      if (!far && s.up) add(el('path', { d: `M${f2(x - 0.5)},${f2(y * 0.6)}h0.2l0.08,${f2(y * 0.4)}h0.18M${f2(x - 0.42)},${f2(-y * 0.25)}h0.16l0.06,${f2(-y * 0.3)}`, fill: 'none', stroke: FC.cyan, 'stroke-width': '0.022', 'stroke-opacity': 0.75 }));
      deck(el('circle', { cx: f2(x), cy: f2(y), r: '0.11', fill: s.up ? FC.plate : FC.dead, stroke: FC.line, 'stroke-width': '0.025' }));
      deck(el('circle', { cx: f2(x), cy: f2(y), r: '0.065', fill: s.up ? FC.panelLo : '#0b0c0f' }));
      deck(el('circle', { cx: f2(x), cy: f2(y), r: '0.03', fill: s.up ? FC.cyan : FC.deadLine, class: s.up ? 'sk-emit' : null }));
    });
    list(i, 'comms').forEach((c, j) => {
      const y = j % 2 ? -0.3 : 0.3;
      deck(el('path', { d: `M0.3,${f2(y)}H-0.3M0.2,${f2(y - 0.06)}V${f2(y + 0.06)}M0.05,${f2(y - 0.05)}V${f2(y + 0.05)}M-0.1,${f2(y - 0.04)}V${f2(y + 0.04)}`, stroke: c.up ? FC.panelLo : FC.deadLine, 'stroke-width': '0.025', 'stroke-linecap': 'round' }));
      deck(el('circle', { cx: '0.3', cy: f2(y), r: '0.035', fill: c.up ? FC.teal : FC.deadLine, class: c.up ? 'blink' : null }));
    });
    // engines: housings at the back; plumes only out of the stern
    const en = list(i, 'engine');
    const ys = en.length === 1 ? [0] : en.length === 2 ? [-0.22, 0.22] : [-0.3, 0, 0.3];
    en.slice(0, 3).forEach((e, j) => {
      const y = ys[j] * W;
      add(el('path', { d: poly([[-0.4, y - 0.12], [-0.68, y - 0.15], [-0.78, y - 0.1], [-0.78, y + 0.1], [-0.68, y + 0.15], [-0.4, y + 0.12]]), fill: e.up ? `url(#fgD${kk})` : FC.dead, stroke: FC.line, 'stroke-width': '0.03' }));
      if (!far) add(el('path', { d: `M-0.5,${f2(y - 0.1)}V${f2(y + 0.1)}M-0.6,${f2(y - 0.11)}V${f2(y + 0.11)}`, stroke: e.up ? FC.teal : FC.deadLine, 'stroke-width': '0.02', 'stroke-opacity': 0.7 }));
      if (!e.up) { deck(scorch(-0.55, y, 0.16)); return; }
      if (stern) {
        const L = 0.6 * plume, pg = el('g', { transform: local(i) });
        pg.appendChild(el('path', { d: `M-0.77,${f2(y - 0.1)}L${f2(-0.78 - L)},${f2(y)}L-0.77,${f2(y + 0.1)}Z`, fill: 'url(#fgPlume)' }));
        pg.appendChild(el('path', { d: `M-0.77,${f2(y - 0.15)}L${f2(-0.78 - L * 1.2)},${f2(y)}L-0.77,${f2(y + 0.15)}Z`, fill: FC.blue, opacity: f2(0.18 + 0.12 * power) }));
        pg.appendChild(el('ellipse', { cx: '-0.77', cy: f2(y), rx: '0.03', ry: '0.08', fill: '#ffffff', opacity: 0.9 }));
        plumes.appendChild(pg);
      } else add(el('ellipse', { cx: '-0.77', cy: f2(y), rx: '0.03', ry: '0.07', fill: FC.cyan, opacity: 0.7 }));
    });
    // bridge on the core segment (flagship: command tower and star)
    if (cnt(i, 'core')) {
      const k = o.flagship ? 1.22 : 1, ok = up(i, 'core') > 0, x0 = pl.prow ? 0.12 : 0.02;
      add(el('path', { d: poly(mirrorY([[x0 + 0.3 * k, -0.07 * k], [x0 + 0.18 * k, -0.17 * k], [x0 - 0.22 * k, -0.19 * k], [x0 - 0.3 * k, -0.1 * k]])), fill: ok ? `url(#fgD${kk})` : FC.dead, stroke: FC.line, 'stroke-width': '0.03', 'stroke-linejoin': 'round' }));
      add(el('path', { d: poly(mirrorY([[x0 + 0.24 * k, -0.035 * k], [x0 + 0.15 * k, -0.1 * k], [x0 + 0.02 * k, -0.1 * k], [x0 + 0.0, -0.035 * k]])), fill: ok ? 'url(#fgGlass)' : FC.deadLine, stroke: FC.line, 'stroke-width': '0.015', class: ok ? 'sk-emit' : null }));
      if (o.flagship) deck(el('path', { d: star(x0 - 0.13, 0, 0.065), fill: FC.cyan, opacity: 0.95 }));
      else deck(el('path', { d: `M${f2(x0 - 0.06)},-0.08V0.08M${f2(x0 - 0.14)},-0.09V0.09`, stroke: FC.teal, 'stroke-width': '0.02', 'stroke-opacity': 0.8 }));
    }
    // mounts: lasers, missile pods, CIWS on three hard points
    const slots = [[0.46, 0], [-0.08, -0.3], [-0.08, 0.3]];
    if (cnt(i, 'core')) slots[0] = [pl.prow ? 0.58 : 0.5, 0];
    if (sh.length) { slots[1] = [0.3, -0.3]; slots[2] = [0.3, 0.3]; }
    let si = 0;
    for (const kd of ['laser', 'launcher', 'pd']) for (const m of list(i, kd)) {
      const [x, y] = slots[si++ % 3], dead = !m.up;
      if (far) { add(el('circle', { cx: f2(x), cy: f2(y), r: '0.1', fill: dead ? FC.dead : FC.panel })); continue; }
      const tg = el('g', { transform: `translate(${f2(x)},${f2(y)})` });
      if (kd === 'laser') {
        const a = dead ? 25 : aimFrom(i, x, y);
        tg.appendChild(el('circle', { r: '0.14', fill: dead ? FC.dead : FC.plate, stroke: FC.line, 'stroke-width': '0.03' }));
        const br = el('g', { transform: `rotate(${f2(a)})` });
        for (const s of [-0.045, 0.045]) br.appendChild(el('rect', { x: '0.02', y: f2(s - 0.02), width: dead ? '0.14' : '0.34', height: '0.04', fill: dead ? FC.deadLine : FC.panelLo, stroke: FC.line, 'stroke-width': '0.01' }));
        if (!dead) for (const s of [-0.045, 0.045]) br.appendChild(el('circle', { cx: '0.36', cy: f2(s), r: '0.022', fill: FC.cyan, class: 'sk-emit' }));
        br.appendChild(el('rect', { x: '-0.09', y: '-0.085', width: '0.15', height: '0.17', rx: '0.04', fill: dead ? FC.dead : FC.panel, stroke: FC.line, 'stroke-width': '0.02' }));
        tg.appendChild(br);
      } else if (kd === 'launcher') {
        tg.appendChild(el('rect', { x: '-0.15', y: '-0.12', width: '0.3', height: '0.24', rx: '0.03', fill: dead ? FC.dead : FC.panel, stroke: FC.line, 'stroke-width': '0.025' }));
        for (let a = 0; a < 3; a++) for (let c = 0; c < 2; c++) tg.appendChild(el('rect', { x: f2(-0.12 + a * 0.085), y: f2(-0.09 + c * 0.095), width: '0.065', height: '0.075', fill: dead ? '#0b0c0f' : FC.panelLo, stroke: dead ? FC.deadLine : FC.teal, 'stroke-width': '0.012' }));
      } else {
        const a = dead ? -40 : aimFrom(i, x, y);
        tg.appendChild(el('circle', { r: '0.095', fill: dead ? FC.dead : FC.plate, stroke: FC.line, 'stroke-width': '0.025' }));
        tg.appendChild(el('rect', { x: '0', y: '-0.017', width: '0.19', height: '0.034', fill: dead ? FC.deadLine : FC.panelLo, transform: `rotate(${f2(a)})` }));
        tg.appendChild(el('circle', { r: '0.035', fill: dead ? FC.deadLine : FC.cyan }));
      }
      if (dead) tg.appendChild(scorch(0, 0, 0.2));
      else if (m.hurt) tg.appendChild(crack([0, 0], r, 2, FC.ember, 0.75));
      add(tg);
    }
    // armour that is lost: scorched gaps in the rim; hurt plates crack
    list(i, 'armour').forEach((a, j) => {
      if (far) return;
      const s = j % 2 ? 1 : -1, x = 0.3 - Math.floor(j / 2) * 0.5;
      if (!a.up) { add(el('path', { d: poly([[x - 0.12, s * 0.44 * W], [x + 0.12, s * 0.44 * W], [x + 0.08, s * 0.54 * W], [x - 0.1, s * 0.52 * W]]), fill: FC.soot })); add(scorch(x, s * 0.42 * W, 0.14)); }
      else if (a.hurt) add(crack([x, s * 0.42 * W], r, 2, FC.ember, 0.65));
    });
    // general damage
    const all = Object.values(segs[i].k).flat(), lost = all.length ? all.filter((x) => !x.up).length / all.length : 0;
    if (lost > 0.2 && !far) add(scorch((r() - 0.5) * 0.5, (r() - 0.5) * 0.4, 0.22 + lost * 0.3));
    if (lost > 0.45) add(crack([(r() - 0.5) * 0.3, (r() - 0.5) * 0.3], r, 3, FC.ember, 0.6));
    detail.appendChild(G);
  });
  root.dataset.shape = 'frigate';
  return root;
}

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
// The outline of a hex cluster, inset by `ins`, with every outer (convex) corner bevelled by `bev`.
// nb[i][e] = index of the hex across edge e of hex i (edge e runs from corner e to e+1), or -1.
function hullPath(P, nb, S, ins, bev) {
  const vk = (p) => Math.round(p[0] * 20) + ',' + Math.round(p[1] * 20), count = new Map(), edges = new Map();
  P.forEach((p) => { for (let v = 0; v < 6; v++) { const k = vk(corner(p, S, v)); count.set(k, (count.get(k) || 0) + 1); } });
  P.forEach((p, i) => { for (let e = 0; e < 6; e++) if (nb[i][e] < 0) { const a = corner(p, S, e), z = corner(p, S, e + 1); edges.set(vk(a), { a, z }); } });
  let d = '';
  const used = new Set();
  for (const [k0] of edges) {
    if (used.has(k0)) continue;
    const loop = []; let k = k0, guard = 0;
    while (!used.has(k) && edges.has(k) && guard++ < 300) { used.add(k); const ed = edges.get(k); loop.push(ed); k = vk(ed.z); }
    if (loop.length < 3) continue;
    const pts = [];
    loop.forEach((ed, j) => {
      const prev = loop[(j + loop.length - 1) % loop.length];
      const n1 = inward(prev.a, prev.z), n2 = inward(ed.a, ed.z), den = 1 + dot(n1, n2);
      const q = [ed.a[0] + (ins * (n1[0] + n2[0])) / den, ed.a[1] + (ins * (n1[1] + n2[1])) / den];
      if (count.get(vk(ed.a)) === 1) {
        // convex: cut the corner square to its bisector (the cut runs at a hex angle)
        const t1 = unitv([prev.a[0] - prev.z[0], prev.a[1] - prev.z[1]]), t2 = unitv([ed.z[0] - ed.a[0], ed.z[1] - ed.a[1]]);
        pts.push([q[0] + t1[0] * bev, q[1] + t1[1] * bev], [q[0] + t2[0] * bev, q[1] + t2[1] * bev]);
      } else pts.push(q);
    });
    d += poly(pts);
  }
  return d;
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
