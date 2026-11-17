// Draws the board as vector graphics: space, terrain, fog, ships with their
// slots, missiles with their expected paths, and whatever can be tapped.

import { hex } from '../engine/index.js';
import { drawShip, shipDefs, TEAM } from './ships.js';
import { drawFrigate, frigateDefs } from './frigate.js';

const NS = 'http://www.w3.org/2000/svg';
export const S = 10, W = Math.sqrt(3) * S;
// How big a ship is drawn next to the hexes it occupies (1 = it fills them). Tuned by eye on a phone screen.
export const SHIP_SCALE = 0.7;
// FL is -1 when the board is drawn upside down, so the player at the top
// (Player 2) still sees their own side at the bottom.
export let FL = 1;
export function setFlip(v) { FL = v < 0 ? -1 : 1; }
export const X = (c) => FL * W * (c[0] + c[1] / 2), Y = (c) => FL * 1.5 * S * c[1];
export const f1 = (n) => n.toFixed(1);
const animSeen = new Set();      // explosions that have already played their burst
export function s(tag, attrs, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) e.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) e.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
function hexPath(cx, cy, r) {
  let d = '';
  for (let i = 0; i < 6; i++) { const a = (Math.PI / 180) * (60 * i - 30); d += (i ? 'L' : 'M') + f1(cx + r * Math.cos(a)) + ',' + f1(cy + r * Math.sin(a)); }
  return d + 'Z';
}
const cellPath = (c, k = 0.96) => hexPath(X(c), Y(c), S * k);
// The outline of a group of hexes: only the sides that face a hex outside the group.
function outlinePath(cells) {
  const inside = new Set(cells.map(hex.key));
  let d = '';
  for (const c of cells) for (let k = 0; k < 6; k++) {
    const n = hex.step(c, k);
    if (inside.has(hex.key(n))) continue;
    const vx = X(n) - X(c), vy = Y(n) - Y(c), len = Math.hypot(vx, vy), mx = X(c) + vx / 2, my = Y(c) + vy / 2, px = (-vy / len) * (S / 2), py = (vx / len) * (S / 2);
    d += 'M' + f1(mx - px) + ',' + f1(my - py) + 'L' + f1(mx + px) + ',' + f1(my + py);
  }
  return d;
}

// ---------- ship models (art) ----------
// A model is a top-down picture of a hull on a clear background: { img, segments: [[q, r]...] }.
// The picture is measured once (the box around its solid pixels) and scaled so that box is as wide
// as the hull's hexes, with the tops lined up; pictures of any size or scale work. A ship uses a
// model only when its hull is exactly the model's shape, so a refit without new art falls back
// to the schematic. Add entries with setModels(); story/ships.json is in this format.
let MODELS = {};
export function setModels(m) { MODELS = m || {}; }
const shapeOf = (offs) => { const mq = Math.min(...offs.map((c) => c[0])), mr = Math.min(...offs.filter((c) => c[0] === mq).map((c) => c[1])); return offs.map((c) => (c[0] - mq) + ',' + (c[1] - mr)).sort().join(' '); };
// Find the solid part of a picture: { w, h, x0, x1, y0 } in the picture's own pixels.
function measure(m, href, done) {
  if (m._fit || m._busy) return;
  m._busy = true;
  const im = new Image();
  im.onload = () => {
    try {
      const k = Math.min(1, 256 / im.naturalWidth), cw = Math.max(1, Math.round(im.naturalWidth * k)), ch = Math.max(1, Math.round(im.naturalHeight * k));
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, cw, ch);
      const d = cx.getImageData(0, 0, cw, ch).data;
      let x0 = cw, x1 = -1, y0 = ch;
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 200) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; }
      if (x1 > x0) m._fit = { w: im.naturalWidth, h: im.naturalHeight, x0: x0 / k, x1: (x1 + 1) / k, y0: y0 / k };
    } catch (e) {}
    if (!m._fit) m._bad = true;
    if (done) done();
  };
  im.onerror = () => { m._bad = true; };
  im.src = href;
}
export function modelFor(name, offs) {
  if (!name) return null;
  const want = shapeOf(offs), keys = Object.keys(MODELS).filter((k) => k === name || k.indexOf(name + '_') === 0).sort((a, b) => a.length - b.length);
  for (const k of keys) { const m = MODELS[k]; if (m && m.img && Array.isArray(m.segments) && shapeOf(m.segments) === want) return m; }
  return null;
}
function rnd(seed) { let t = seed | 0; return () => { t = (t + 0x6d2b79f5) | 0; let x = Math.imul(t ^ (t >>> 15), t | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }

// A colour and a letter for every part, worked out from what the part does.
export function partLooks(rules) {
  const out = {}, used = new Set();
  for (const [name, c] of Object.entries(rules.parts)) {
    const color = c.required ? '#f4f6fb' : c.thrust ? '#ff9d4d' : c.adds_range ? '#5cc8ff' : c.hides || c.flare_reduction ? '#b98cf5' : c.holds ? '#d3bd84'
      : c.couples ? '#7b8397' : c.link_range ? '#58d6a0' : c.recharges || c.stops_per_round || c.hp > 1 ? '#f5d142' : c.hits || c.launches ? '#ff6b6b' : '#9aa5c0';
    let letter = '?';
    for (const ch of name.toUpperCase().replace(/[^A-Z]/g, '')) if (!used.has(ch)) { letter = ch; break; }
    used.add(letter);
    out[name] = { color, letter, recharges: !!c.recharges };
  }
  return out;
}

// The six slots of a segment, as drawn: three inner hexagons and three corner diamonds.
const BAYS = [[-Math.sqrt(3) / 4, -1 / 4], [Math.sqrt(3) / 4, -1 / 4], [0, 1 / 2]];
const DIAMOND = [[0, -1], [-Math.sqrt(3) / 4, -3 / 4], [0, -1 / 2], [Math.sqrt(3) / 4, -3 / 4]];
function diamond(cx, cy, k) {
  const a = (k * 2 * Math.PI) / 3, cs = Math.cos(a), sn = Math.sin(a);
  const pts = DIAMOND.map(([x, y]) => [x * cs - y * sn, x * sn + y * cs]);
  const mx = pts.reduce((n, p) => n + p[0], 0) / 4, my = pts.reduce((n, p) => n + p[1], 0) / 4;
  return { d: pts.map(([x, y], i) => (i ? 'L' : 'M') + f1(cx + S * (mx + (x - mx) * 0.8)) + ',' + f1(cy + S * (my + (y - my) * 0.8))).join('') + 'Z', x: cx + S * mx, y: cy + S * my };
}

const drawFail = new Set();   // ships whose hull art threw once: they are drawn as schematics, logged once
export function drawBoard({ view: v, rules, looks, cam, sel, opts, plan, plans, ghost, seat, box, onTap, pending = null, hidden = false, guide = null,
  halo = null, idle = null, style = 'hull', modelBase = '', offsets = null, nameOf = null, onCam = null, onView = null }) {
  // nothing to draw while the board has no size (Lab tab open, mid-resize)
  if (!box.clientWidth || !box.clientHeight || !(cam.w > 0) || !isFinite(cam.w)) return s('svg', { role: 'img', 'aria-label': 'Game board' });
  const R = v.board.radius, aspect = box.clientHeight / Math.max(1, box.clientWidth), vw = cam.w, vh = cam.w * aspect;
  const svg = s('svg', { viewBox: [cam.x - vw / 2, cam.y - vh / 2, vw, vh].map(f1).join(' '), role: 'img', 'aria-label': 'Game board' });
  const px = box.clientWidth / vw;              // screen pixels per drawing unit
  const detailed = S * 2 * px >= 30;            // big enough to show the slots inside each segment
  const col = (o) => (o === 0 ? TEAM[0].main : TEAM[1].main);
  const fs = (pxSize) => f1(pxSize / px);       // a font size that stays readable at any zoom

  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  svg.appendChild(s('defs', null,
    s('radialGradient', { id: 'space', cx: '50%', cy: '42%', r: '78%' }, s('stop', { offset: '0', 'stop-color': '#0c1c36' }), s('stop', { offset: '.55', 'stop-color': '#07101f' }), s('stop', { offset: '1', 'stop-color': '#03060d' })),
    ...[['neb0', '#19c3b3', 0.16], ['neb1', '#4a8cff', 0.14], ['neb2', '#9b6bff', 0.09]].map(([id, c, a]) => s('radialGradient', { id }, s('stop', { offset: '0', 'stop-color': c, 'stop-opacity': a }), s('stop', { offset: '.6', 'stop-color': c, 'stop-opacity': a / 3 }), s('stop', { offset: '1', 'stop-color': c, 'stop-opacity': 0 }))),
    s('radialGradient', { id: 'fuzz' }, s('stop', { offset: '0', 'stop-color': TEAM[1].neon, 'stop-opacity': '.32' }), s('stop', { offset: '.7', 'stop-color': TEAM[1].neon, 'stop-opacity': '.1' }), s('stop', { offset: '1', 'stop-color': TEAM[1].neon, 'stop-opacity': '0' })),
    s('radialGradient', { id: 'haze' }, s('stop', { offset: '0', 'stop-color': '#6f86ff', 'stop-opacity': '.42' }), s('stop', { offset: '.55', 'stop-color': '#4a5bd8', 'stop-opacity': '.18' }), s('stop', { offset: '1', 'stop-color': '#3a3fb8', 'stop-opacity': '0' })),
    s('radialGradient', { id: 'haze2' }, s('stop', { offset: '0', 'stop-color': '#2fb7c9', 'stop-opacity': '.3' }), s('stop', { offset: '1', 'stop-color': '#2fb7c9', 'stop-opacity': '0' })),
    s('radialGradient', { id: 'rock', cx: '35%', cy: '30%', r: '80%' }, s('stop', { offset: '0', 'stop-color': '#a3abbf' }), s('stop', { offset: '.5', 'stop-color': '#5d6478' }), s('stop', { offset: '1', 'stop-color': '#262a38' })),
    s('radialGradient', { id: 'star4' }, s('stop', { offset: '0', 'stop-color': '#ffffff', 'stop-opacity': '1' }), s('stop', { offset: '.25', 'stop-color': '#cfe8ff', 'stop-opacity': '.6' }), s('stop', { offset: '1', 'stop-color': '#cfe8ff', 'stop-opacity': '0' })),
    s('pattern', { id: 'fogpat', width: 4, height: 4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(30)' }, s('path', { d: 'M0,0V4', stroke: '#7f93ad', 'stroke-width': 0.25, 'stroke-opacity': 0.18 })),
    s('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, s('feGaussianBlur', { stdDeviation: '1.6' })),
    ...shipDefs().childNodes, ...frigateDefs().childNodes));

  // space: deep navy, three faint nebula washes, then three layers of stars (a few twinkle)
  const bw = W * (2 * R + 6), bh = S * (3 * R + 10);
  svg.appendChild(s('rect', { x: -bw, y: -bh, width: 2 * bw, height: 2 * bh, fill: 'url(#space)' }));
  const neb = rnd(R * 131 + 7);
  for (let i = 0; i < 5; i++) svg.appendChild(s('ellipse', { cx: f1((neb() - 0.5) * bw * 1.2), cy: f1((neb() - 0.5) * bh * 1.2), rx: f1(bw * (0.35 + neb() * 0.35)), ry: f1(bh * (0.2 + neb() * 0.25)), fill: `url(#neb${i % 3})`, transform: `rotate(${f1(neb() * 180)})` }));
  const star = rnd(R * 977 + 13), stars = s('g', { fill: '#cfe8ff' });
  for (let i = 0; i < 170; i++) stars.appendChild(s('circle', { cx: f1((star() - 0.5) * bw * 1.6), cy: f1((star() - 0.5) * bh * 1.6), r: f1(0.18 + star() * 0.35), opacity: f1(0.2 + star() * 0.45) }));
  for (let i = 0; i < 45; i++) stars.appendChild(s('circle', { cx: f1((star() - 0.5) * bw * 1.6), cy: f1((star() - 0.5) * bh * 1.6), r: f1(0.5 + star() * 0.4), opacity: f1(0.45 + star() * 0.4), fill: star() < 0.3 ? '#9fe9ff' : star() < 0.15 ? '#ffd9f2' : null, class: !reduce && i % 5 === 0 ? 'twinkle' : null, style: !reduce && i % 5 === 0 ? `animation-delay:${f1(-star() * 6)}s` : null }));
  for (let i = 0; i < 10; i++) { const x = (star() - 0.5) * bw * 1.5, y = (star() - 0.5) * bh * 1.5, r = 2.2 + star() * 2; stars.appendChild(s('circle', { cx: f1(x), cy: f1(y), r: f1(r), fill: 'url(#star4)' })); stars.appendChild(s('path', { d: `M${f1(x - r * 1.6)},${f1(y)}H${f1(x + r * 1.6)}M${f1(x)},${f1(y - r * 1.6)}V${f1(y + r * 1.6)}`, stroke: '#cfe8ff', 'stroke-width': 0.15, 'stroke-opacity': 0.5 })); }
  svg.appendChild(stars);

  // start zones, tinted and named
  const all = [];
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (hex.inHexagon([q, r], R)) all.push([q, r]);
  const me = v.me === 'all' ? null : v.me;
  const home = {};                // each side's start zone centre: its ships' bows point away from it
  for (const z of v.zones) {
    const owner = v.players.findIndex((n) => z.name.indexOf(n) === 0);
    if (owner < 0 || !hex.EDGE[z.edge]) continue;
    const cells = all.filter((c) => hex.EDGE[z.edge](c, R) < z.depth);
    svg.appendChild(s('path', { d: cells.map((c) => cellPath(c)).join(''), fill: col(owner), 'fill-opacity': 0.07 }));
    const mid = cells.reduce((a, c) => [a[0] + X(c) / cells.length, a[1] + Y(c) / cells.length], [0, 0]);
    if (cells.length && !home[owner]) home[owner] = mid;
    if (cam.w >= W * (2 * R + 1) * 0.8) svg.appendChild(s('text', { x: f1(mid[0]), y: f1(mid[1] + (hex.EDGE[z.edge]([0, R], R) === 0 ? 1 : -1) * FL * S * 1.5 * (z.depth / 2 + 0.2)), 'font-size': fs(10), fill: col(owner), 'fill-opacity': 0.55, 'letter-spacing': f1(1.5 / px) },
      me === null ? 'PLAYER ' + (owner + 1) + ' START' : owner === me ? 'YOUR START' : 'ENEMY START'));
  }

  // terrain: nebula cells get an indigo wash, soft clouds and a dashed edge; asteroids are shaded rocks
  for (const t of v.terrain) {
    const solid = (rules.terrainTypes[t.type] || {}).blocks_movement;
    if (!solid) {
      svg.appendChild(s('path', { d: t.cells.map((c) => cellPath(c, 1.01)).join(''), fill: '#4a5bd8', 'fill-opacity': 0.09 }));
      for (const c of t.cells) {
        const r = rnd(c[0] * 7919 + c[1] * 104729 + 5);
        svg.appendChild(s('circle', { cx: f1(X(c) + (r() - 0.5) * 5), cy: f1(Y(c) + (r() - 0.5) * 5), r: f1(S * (1.2 + r() * 0.6)), fill: 'url(#haze)' }));
        if (r() < 0.45) svg.appendChild(s('circle', { cx: f1(X(c) + (r() - 0.5) * 8), cy: f1(Y(c) + (r() - 0.5) * 8), r: f1(S * (0.6 + r() * 0.5)), fill: 'url(#haze2)' }));
      }
      svg.appendChild(s('path', { d: outlinePath(t.cells), fill: 'none', stroke: '#8fa2ff', 'stroke-opacity': 0.4, 'stroke-width': 0.5, 'stroke-dasharray': '1.2 1.6', 'stroke-linecap': 'round' }));
      continue;
    }
    svg.appendChild(s('path', { d: t.cells.map((c) => cellPath(c, 0.98)).join(''), fill: '#1a1d28', 'fill-opacity': 0.55, stroke: '#3a4054', 'stroke-width': 0.4 }));
    for (const c of t.cells) {
      const r = rnd(c[0] * 7919 + c[1] * 104729 + 5);
      const rock = (cx, cy, base, k) => {
        let d = '';
        for (let i = 0; i < 11; i++) { const a = (i / 11) * 2 * Math.PI, rad = base * (0.72 + r() * 0.32); d += (i ? 'L' : 'M') + f1(cx + rad * Math.cos(a)) + ',' + f1(cy + rad * Math.sin(a) * k); }
        svg.appendChild(s('path', { d: d + 'Z', fill: 'url(#rock)', stroke: '#1b1e2a', 'stroke-width': 0.5, 'stroke-linejoin': 'round' }));
        svg.appendChild(s('path', { d: `M${f1(cx - base * 0.55)},${f1(cy - base * 0.3)}Q${f1(cx - base * 0.2)},${f1(cy - base * 0.75)} ${f1(cx + base * 0.4)},${f1(cy - base * 0.55)}`, fill: 'none', stroke: '#d8deec', 'stroke-opacity': 0.35, 'stroke-width': 0.4, 'stroke-linecap': 'round' }));
        for (let j = 0; j < 2; j++) svg.appendChild(s('circle', { cx: f1(cx + (r() - 0.5) * base), cy: f1(cy + (r() - 0.3) * base * 0.8), r: f1(base * (0.1 + r() * 0.12)), fill: '#2a2f3e', opacity: 0.75 }));
      };
      rock(X(c) + (r() - 0.5) * 2, Y(c) + (r() - 0.5) * 2, S * (0.55 + r() * 0.15), 0.85 + r() * 0.2);
      if (r() < 0.7) rock(X(c) + (r() < 0.5 ? -1 : 1) * S * 0.55, Y(c) + (r() - 0.5) * S * 0.9, S * (0.18 + r() * 0.1), 1);
    }
  }

  // the beacon: hold it to score (gold ring; brighter in the colour of whoever scored last)
  if (v.objective) {
    const o = v.objective, oc = all.filter((c) => hex.dist(c, o.at) <= o.radius);
    const lastScore = v.feed.filter((e) => e.t === 'objective_scored').pop();
    const tint = lastScore ? col(lastScore.player) : '#e8c15a';
    svg.appendChild(s('path', { d: oc.map((c) => cellPath(c, 0.92)).join(''), fill: '#e8c15a', 'fill-opacity': 0.08, stroke: tint, 'stroke-width': 0.9, 'stroke-opacity': 0.8, 'stroke-dasharray': '2 1.5' }));
    let d = '';
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 2 * Math.PI - Math.PI / 2, rad = S * (i % 2 ? 0.18 : 0.42); d += (i ? 'L' : 'M') + f1(X(o.at) + rad * Math.cos(a)) + ',' + f1(Y(o.at) + rad * Math.sin(a)); }
    svg.appendChild(s('path', { d: d + 'Z', fill: '#e8c15a', 'fill-opacity': 0.9 }));
  }

  // fog: everything outside this player's sensor range is darker
  const dark = all.filter((c) => !v.eyes.some((e) => e.range !== null && e.cells.some((x) => hex.dist(x, c) <= e.range)));
  if (dark.length) { const dd = dark.map((c) => cellPath(c, 1.01)).join(''); svg.appendChild(s('path', { d: dd, fill: '#020611', 'fill-opacity': 0.55 })); svg.appendChild(s('path', { d: dd, fill: 'url(#fogpat)' })); }
  svg.appendChild(s('path', { d: all.map((c) => cellPath(c, 0.97)).join(''), fill: 'none', stroke: '#2b5a85', 'stroke-width': 0.35, 'stroke-opacity': 0.55 }));
  svg.appendChild(s('path', { d: outlinePath(all), fill: 'none', stroke: TEAM[0].neon, 'stroke-width': 0.6, 'stroke-opacity': 0.35, 'stroke-linecap': 'round' }));

  // what happened lately: arrows for ship moves, bursts for explosions
  const recent = v.feed.filter((e) => e.r >= v.round - 1);
  const lastMove = {};
  for (const e of recent) if (e.t === 'move' && e.steps > 0) lastMove[e.ship] = e;
  for (const e of Object.values(lastMove)) {
    const owner = Number(e.ship[0]) - 1;
    svg.appendChild(s('line', { x1: f1(X(e.from)), y1: f1(Y(e.from)), x2: f1(X(e.to)), y2: f1(Y(e.to)), stroke: col(owner), 'stroke-width': 1.2, 'stroke-opacity': 0.45, 'stroke-dasharray': '1 2.5', 'stroke-linecap': 'round' }));
    svg.appendChild(s('circle', { cx: f1(X(e.from)), cy: f1(Y(e.from)), r: 1.6, fill: 'none', stroke: col(owner), 'stroke-opacity': 0.5, 'stroke-width': 0.7 }));
  }
  for (const e of recent) if (e.t === 'blast' || e.t === 'stopped') {
    let d = '';
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 2 * Math.PI, rad = S * (i % 2 ? 0.55 : 1.15); d += (i ? 'L' : 'M') + f1(X(e.at) + rad * Math.cos(a)) + ',' + f1(Y(e.at) + rad * Math.sin(a)); }
    svg.appendChild(s('path', { d: d + 'Z', fill: 'none', stroke: e.t === 'blast' ? '#ff8a5c' : '#f5d142', 'stroke-width': 0.9, 'stroke-opacity': e.r === v.round ? 0.9 : 0.45,
      class: e.r >= v.round - 1 && !animSeen.has(e.n) && !hidden ? (animSeen.add(e.n), 'boom') : null }));
  }

  // last-seen markers
  for (const g of v.ghosts) {
    svg.appendChild(s('path', { d: g.cells.map((c) => cellPath(c, 0.9)).join(''), fill: '#b48bff', 'fill-opacity': 0.06 }));
    svg.appendChild(s('path', { d: outlinePath(g.cells), fill: 'none', stroke: '#c9b6ff', 'stroke-opacity': 0.55, 'stroke-width': 0.7, 'stroke-dasharray': '1.6 1.8', 'stroke-linecap': 'round', class: 'ghost' }));
    svg.appendChild(s('text', { x: f1(X(g.pos)), y: f1(Y(g.pos)), 'font-size': fs(12), fill: '#d9ccff', 'fill-opacity': 0.8 }, '?'));
  }

  // tier 1: fuzzy contacts, "something is roughly here"
  for (const x of v.contacts || []) {
    const cx = X(x.at), cy = Y(x.at), rr = W * ((x.r || 2) + 0.5);
    svg.appendChild(s('circle', { cx: f1(cx), cy: f1(cy), r: f1(rr), fill: 'url(#fuzz)', class: 'fuzz' }));
    svg.appendChild(s('circle', { cx: f1(cx), cy: f1(cy), r: f1(rr), fill: 'none', stroke: TEAM[1].neon, 'stroke-width': f1(1 / px + 0.3), 'stroke-dasharray': '2 3', 'stroke-opacity': 0.6 }));
    svg.appendChild(s('circle', { cx: f1(cx), cy: f1(cy), r: f1(rr * 0.55), fill: 'none', stroke: TEAM[1].main, 'stroke-width': f1(0.6 / px + 0.2), 'stroke-dasharray': '0.8 2.4', 'stroke-opacity': 0.45 }));
    svg.appendChild(s('text', { x: f1(cx), y: f1(cy), 'font-size': fs(12), fill: '#ffc2ea', 'font-weight': 700 }, x.kind === 'ship' ? '?' : '·?'));
  }

  // ships. Each one is a single outlined shape, so ships that touch still read as separate.
  const tags = [];
  for (const x of v.ships) {
    const c0 = col(x.owner), off = offsets ? offsets(x.id, x.pos) : null;
    const g = s('g', { 'data-ship': x.id, opacity: x.seen ? null : 0.4, transform: off ? `translate(${f1(off[0])},${f1(off[1])})` : null });
    const rim = outlinePath(x.cells);
    // State goes on the tiles: every hex the ship occupies is tinted in its owner's colour, a white rim marks a ship
    // you can give orders to, and the selected one is lit. The ship itself is drawn smaller than its tiles
    // (SHIP_SCALE, about its own centre), so there is room around every piece. A long ship is shrunk less, so
    // that each of its segments stays inside its own hex.
    const sx = x.cells.reduce((n, c) => n + X(c), 0) / x.cells.length, sy = x.cells.reduce((n, c) => n + Y(c), 0) / x.cells.length;
    const far = Math.max(...x.cells.map((c) => Math.hypot(X(c) - sx, Y(c) - sy)));
    const k = Math.max(SHIP_SCALE, far > 0 ? 1 - (0.45 * W) / far : 0);
    const isSel = x.id === sel, canOrder = !!(halo && halo.has(x.id) && !hidden);
    if (isSel) g.appendChild(s('path', { d: x.cells.map((c) => cellPath(c, 1.12)).join(''), fill: c0, 'fill-opacity': 0.35, filter: 'url(#glow)' }));
    g.appendChild(s('path', { d: x.cells.map((c) => cellPath(c, 0.95)).join(''), fill: c0, 'fill-opacity': isSel ? 0.3 : 0.13, stroke: c0, 'stroke-width': 0.5, 'stroke-opacity': 0.55 }));
    if (isSel) g.appendChild(s('path', { d: rim, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.5, 'stroke-linecap': 'round' }));
    else if (canOrder) g.appendChild(s('path', { d: rim, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-opacity': 0.75, class: 'halo' }));
    const art = s('g', { transform: `translate(${f1(sx)},${f1(sy)}) scale(${k.toFixed(3)}) translate(${f1(-sx)},${f1(-sy)})` });
    let model = style === 'model' ? modelFor(x.name, x.segs.map((sg) => sg.off)) : null;
    if (model && !model._fit) { if (!model._bad) measure(model, modelBase + model.img, onCam); model = null; }   // schematic until the picture is measured
    let drawn = false;
    if (!model && style === 'hull') try {
      const hm = home[x.owner], fwd = hm && Math.hypot(hm[0], hm[1]) > S ? [-hm[0], -hm[1]] : [0, (x.owner === 0 ? -1 : 1) * FL];
      // your side (seat 1) flies classic sci-fi ships built from their modules; the Weave side keeps the hex hulls
      const foe = v.ships.filter((z) => z.owner !== x.owner && z.seen).map((z) => [X(z.pos), Y(z.pos)]).sort((a, z) => Math.hypot(a[0] - X(x.pos), a[1] - Y(x.pos)) - Math.hypot(z[0] - X(x.pos), z[1] - Y(x.pos)))[0] || null;
      const so = { cells: x.cells, segs: x.segs, owner: x.owner, rules, xy: (c) => [X(c), Y(c)], S, forward: fwd, detail: detailed ? 1 : 0, moved: x.moved, flagship: x.flagship, target: foe };
      art.appendChild(x.owner === 0 ? drawFrigate(so) : drawShip(so));
      drawn = true;
    } catch (e) { if (!drawFail.has(x.id)) { drawFail.add(x.id); console.warn('ship art failed for', x.id, '- drawn as a schematic', e); } }
    if (!drawn) {
    // the hull plate: one fused shape under the segments
    art.appendChild(s('path', { d: x.cells.map((c) => cellPath(c, 1)).join(''), fill: model ? '#0b1226' : c0, 'fill-opacity': model ? 0.9 : detailed ? 0.3 : 0.5 }));
    if (model) {
      const us = x.segs.map((sg) => [W * (sg.off[0] + sg.off[1] / 2), 1.5 * S * sg.off[1]]);
      // the hull's own box (unflipped, relative to the ship's centre hex): left, right, top
      const hx0 = Math.min(...us.map((p) => p[0])) - W / 2, hx1 = Math.max(...us.map((p) => p[0])) + W / 2, hy0 = Math.min(...us.map((p) => p[1])) - S;
      const F = model._fit, k = (hx1 - hx0) / (F.x1 - F.x0), iw = F.w * k, ih = F.h * k, ix = hx0 - F.x0 * k, iy = hy0 - F.y0 * k;
      const ox = X(x.pos), oy = Y(x.pos);   // draw it unflipped around the ship's centre, then turn it with the board
      art.appendChild(s('image', { href: modelBase + model.img, x: f1(ox + ix), y: f1(oy + iy), width: f1(iw), height: f1(ih), transform: FL < 0 ? `rotate(180 ${f1(ox)} ${f1(oy)})` : null, 'pointer-events': 'none' }));
    }
    x.segs.forEach((sg, i) => {
      const c = x.cells[i], cx = X(c), cy = Y(c);
      if (sg.wrecked) {
        art.appendChild(s('path', { d: cellPath(c), fill: '#151a28', 'fill-opacity': model ? 0.85 : 1, stroke: '#566080', 'stroke-width': 0.7, 'stroke-dasharray': '1.5 1.5' }));
        art.appendChild(s('path', { d: `M${f1(cx - 4)},${f1(cy - 3)}L${f1(cx + 1)},${f1(cy)}L${f1(cx - 2)},${f1(cy + 4)}M${f1(cx + 4)},${f1(cy - 4)}L${f1(cx + 1)},${f1(cy)}`, stroke: '#566080', 'stroke-width': 0.6, fill: 'none' }));
        return;
      }
      if (model) return;
      if (!detailed || !sg.parts) {
        art.appendChild(s('path', { d: cellPath(c, 0.9), fill: c0, 'fill-opacity': sg.parts ? 0.9 : 0.6 }));
        if (detailed) art.appendChild(s('text', { x: f1(cx), y: f1(cy), 'font-size': fs(12), fill: '#0a0f1e' }, '?'));
        return;
      }
      art.appendChild(s('path', { d: cellPath(c, 0.93), fill: '#141d38', stroke: c0, 'stroke-width': 0.9 }));
      const cat = (p) => rules.parts[p.t].slot;
      const bays = sg.parts.filter((p) => cat(p) === 'bay'), mounts = sg.parts.filter((p) => cat(p) === 'mount');
      const slot = (p, d, tx, ty) => {
        const L = p ? looks[p.t] : null, dead = p && p.hp <= 0;
        art.appendChild(s('path', { d, fill: !p ? 'none' : dead ? (L.recharges ? 'none' : '#262b3a') : L.color, 'fill-opacity': p && !dead && p.hp < p.max ? 0.6 : 1,
          stroke: !p ? '#33406b' : dead && L.recharges ? L.color : '#0a0f1e', 'stroke-width': 0.45, 'stroke-dasharray': dead && L.recharges ? '1 1' : null }));
        if (p && S * px >= 19) art.appendChild(s('text', { x: f1(tx), y: f1(ty), 'font-size': f1(3.6), 'font-weight': 700, fill: dead ? '#6b7592' : '#0a0f1e' }, L.letter));
        if (dead && !L.recharges) art.appendChild(s('path', { d: `M${f1(tx - 1.6)},${f1(ty - 1.6)}L${f1(tx + 1.6)},${f1(ty + 1.6)}M${f1(tx + 1.6)},${f1(ty - 1.6)}L${f1(tx - 1.6)},${f1(ty + 1.6)}`, stroke: '#ff7a7a', 'stroke-width': 0.5 }));
      };
      BAYS.forEach(([bx, by], k) => slot(bays[k], hexPath(cx + S * bx, cy + S * by, S * 0.4), cx + S * bx, cy + S * by));
      for (let k = 0; k < 3; k++) { const dm = diamond(cx, cy, k); slot(mounts[k], dm.d, dm.x, dm.y); }
    });
    // the rim: a dark gap all round, then the owner's colour on it
    art.appendChild(s('path', { d: rim, fill: 'none', stroke: '#04070f', 'stroke-width': 2.6, 'stroke-linecap': 'round' }));
    art.appendChild(s('path', { d: rim, fill: 'none', stroke: c0, 'stroke-width': 0.8, 'stroke-linecap': 'round', 'stroke-opacity': 0.95 }));
    }
    g.appendChild(art);
    // name tag under the ship (above it when another tag is already there)
    const low = x.cells.reduce((a, c) => (Y(c) > Y(a) || (Y(c) === Y(a) && Math.abs(X(c) - X(x.pos)) < Math.abs(X(a) - X(x.pos))) ? c : a), x.cells[0]);
    const high = x.cells.reduce((a, c) => (Y(c) < Y(a) ? c : a), x.cells[0]);
    const roomy = W * px >= 44 || x.id === sel, nm = nameOf && roomy ? nameOf(x) : null;
    const label = (x.flagship ? '★ ' : '') + (nm || x.id) + (x.mine || v.me === 'all' ? '' : x.tier >= 3 ? ' ▣' : ' ◆'), tw = (label.length * 7.2 + 8) / px, th = 15 / px;
    const mid = x.cells.reduce((n, c) => n + X(c), 0) / x.cells.length, quiet = idle && idle.has(x.id);
    let lx = mid, ly = Y(low) + S + th * 0.7;
    const hit = (ax, ay) => tags.some((r) => Math.abs(r[0] - ax) < (r[2] + tw) / 2 && Math.abs(r[1] - ay) < th * 1.05);
    if (hit(lx, ly)) { const up = Y(high) - S - th * 0.7; if (!hit(lx, up)) ly = up; }
    tags.push([lx, ly, tw]);
    g.appendChild(s('rect', { x: f1(lx - tw / 2), y: f1(ly - th / 2), width: f1(tw), height: f1(th), rx: f1(th / 2), fill: '#060a14', 'fill-opacity': 0.85, stroke: quiet ? '#6b7592' : c0, 'stroke-width': f1(1 / px), 'stroke-dasharray': quiet ? f1(3 / px) + ' ' + f1(2 / px) : null }));
    g.appendChild(s('text', { x: f1(lx), y: f1(ly), 'font-size': fs(11), 'font-weight': 700, fill: quiet ? '#9aa5c0' : c0 }, label));
    svg.appendChild(g);
  }

  // missiles, drones and mines
  for (const o of v.objs) {
    const cx = X(o.pos), cy = Y(o.pos), m = rules.munitions[o.kind] || { speed: 1 }, c0 = col(o.owner), fade = o.seen ? null : 0.4;
    if (o.last && !hex.same(o.last, o.pos)) svg.appendChild(s('line', { x1: f1(X(o.last)), y1: f1(Y(o.last)), x2: f1(cx), y2: f1(cy), stroke: c0, 'stroke-width': 1, 'stroke-opacity': 0.35, 'stroke-linecap': 'round' }));
    const ink = '#050a14', neon = o.owner === 1 ? TEAM[1].neon : TEAM[0].neon, rot = -60 * o.dir + (FL < 0 ? 180 : 0);
    if (!m.speed && m.drift) {
      // sleeper mine: a dark, low disc with a faint dashed ring (it creeps toward ships)
      const mg = s('g', { opacity: fade });
      mg.appendChild(s('circle', { cx: f1(cx), cy: f1(cy), r: 5.2, fill: 'none', stroke: c0, 'stroke-width': 0.5, 'stroke-opacity': 0.45, 'stroke-dasharray': '1 1.6', class: 'rotor' }));
      mg.appendChild(s('circle', { cx: f1(cx), cy: f1(cy), r: 3.4, fill: ink, stroke: c0, 'stroke-width': 0.7 }));
      for (let i = 0; i < 3; i++) { const a = (i / 3) * 2 * Math.PI - Math.PI / 2; mg.appendChild(s('path', { d: `M${f1(cx + 1.4 * Math.cos(a))},${f1(cy + 1.4 * Math.sin(a))}L${f1(cx + 3 * Math.cos(a))},${f1(cy + 3 * Math.sin(a))}`, stroke: c0, 'stroke-width': 0.5, 'stroke-opacity': 0.7 })); }
      mg.appendChild(s('circle', { cx: f1(cx), cy: f1(cy), r: 0.9, fill: neon, class: 'minepulse' }));
      svg.appendChild(mg);
    } else if (!m.speed && m.trigger_range) {
      // proximity (naval) mine: a round sea-mine with six horns
      const mg = s('g', { opacity: fade });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * 2 * Math.PI; mg.appendChild(s('path', { d: `M${f1(cx + 3 * Math.cos(a))},${f1(cy + 3 * Math.sin(a))}L${f1(cx + 5.2 * Math.cos(a))},${f1(cy + 5.2 * Math.sin(a))}`, stroke: c0, 'stroke-width': 0.9, 'stroke-linecap': 'round' })); mg.appendChild(s('circle', { cx: f1(cx + 5.2 * Math.cos(a)), cy: f1(cy + 5.2 * Math.sin(a)), r: 0.7, fill: c0 })); }
      mg.appendChild(s('circle', { cx: f1(cx), cy: f1(cy), r: 3.4, fill: ink, stroke: c0, 'stroke-width': 0.8 }));
      mg.appendChild(s('circle', { cx: f1(cx), cy: f1(cy), r: 1.2, fill: neon, class: 'minepulse' }));
      svg.appendChild(mg);
    } else if (!m.speed) {
      // contact mine: a spiked hexagon with a pulsing core
      let d = '';
      for (let i = 0; i < 12; i++) { const a = (i / 12) * 2 * Math.PI - Math.PI / 2, rad = i % 2 ? 3.1 : 5.4; d += (i ? 'L' : 'M') + f1(cx + rad * Math.cos(a)) + ',' + f1(cy + rad * Math.sin(a)); }
      const mg = s('g', { opacity: fade });
      mg.appendChild(s('path', { d: d + 'Z', fill: ink, stroke: c0, 'stroke-width': 0.8, 'stroke-linejoin': 'round' }));
      mg.appendChild(s('path', { d: hexPath(cx, cy, 2.4), fill: 'none', stroke: c0, 'stroke-width': 0.5, 'stroke-opacity': 0.6 }));
      mg.appendChild(s('circle', { cx: f1(cx), cy: f1(cy), r: 1.3, fill: neon, class: 'minepulse' }));
      svg.appendChild(mg);
    } else if (m.patrol) {
      // seeker drone: a small hex body, a rotor ring, a sensor eye looking where it flies
      const dg = s('g', { transform: `translate(${f1(cx)},${f1(cy)}) rotate(${rot})`, opacity: fade });
      dg.appendChild(s('circle', { r: 5, fill: 'none', stroke: c0, 'stroke-width': 0.5, 'stroke-opacity': 0.5, 'stroke-dasharray': '1.4 1.2', class: 'rotor' }));
      dg.appendChild(s('path', { d: hexPath(0, 0, 3.4), fill: ink, stroke: c0, 'stroke-width': 1 }));
      dg.appendChild(s('path', { d: 'M3.4,0L7.2,0', stroke: c0, 'stroke-width': 0.9, 'stroke-linecap': 'round' }));
      dg.appendChild(s('circle', { cx: 1.2, cy: 0, r: 1.2, fill: neon }));
      svg.appendChild(dg);
    } else {
      // missile: a slim dart with fins and a hot exhaust
      const g = s('g', { transform: `translate(${f1(cx)},${f1(cy)}) rotate(${rot})`, opacity: fade });
      g.appendChild(s('ellipse', { cx: -7.5, cy: 0, rx: 3.6, ry: 1.3, fill: `url(#skg${o.owner === 1 ? 1 : 0})`, class: 'thrust' }));
      g.appendChild(s('path', { d: 'M-4.5,0L-6.5,2.8L-3,1.2ZM-4.5,0L-6.5,-2.8L-3,-1.2Z', fill: c0, 'fill-opacity': 0.8 }));
      g.appendChild(s('path', { d: 'M7,0Q4,1.7 0,1.7L-5,1.4L-5,-1.4L0,-1.7Q4,-1.7 7,0Z', fill: ink, stroke: c0, 'stroke-width': 0.7, 'stroke-linejoin': 'round' }));
      g.appendChild(s('path', { d: 'M6.2,0Q4.6,0.8 3.4,0.8L3.4,-0.8Q4.6,-0.8 6.2,0Z', fill: neon }));
      svg.appendChild(g);
      if (!o.mine) { const a = hex.step(hex.step(o.pos, o.dir), o.dir); svg.appendChild(s('line', { x1: f1(cx), y1: f1(cy), x2: f1(X(a)), y2: f1(Y(a)), stroke: c0, 'stroke-width': 0.8, 'stroke-dasharray': '1.5 2', 'stroke-opacity': 0.7 })); }
    }
  }

  // scan preview: full readout inside the green ring, faint contacts inside the amber one
  if (pending && pending.type === 'scan') {
    const me0 = v.ships.find((x) => x.id === pending.ship);
    if (me0 && me0.scanR) {
      const [r1, r2] = me0.scanR, dd = (c) => Math.min(...me0.cells.map((x) => hex.dist(x, c)));
      const inner = all.filter((c) => dd(c) <= r1), outer = all.filter((c) => dd(c) > r1 && dd(c) <= r2);
      svg.appendChild(s('path', { d: outer.map((c) => cellPath(c, 1)).join(''), fill: '#f5b942', 'fill-opacity': 0.17, stroke: '#f5b942', 'stroke-opacity': 0.45, 'stroke-width': 0.4, class: 'scanprev' }));
      svg.appendChild(s('path', { d: inner.map((c) => cellPath(c, 1)).join(''), fill: '#58d6a0', 'fill-opacity': 0.16, stroke: '#58d6a0', 'stroke-opacity': 0.5, 'stroke-width': 0.4, class: 'scanprev' }));
      const top = me0.cells.reduce((a, b) => (Y(b) < Y(a) ? b : a));
      for (const [r, colr, txt] of [[r1, '#58d6a0', 'CLEAR ' + r1], [r2, '#f5b942', 'FAINT ' + r2]])
        svg.appendChild(s('text', { x: f1(X(top)), y: f1(Y(top) - 1.5 * S * r - S * 0.4), 'font-size': fs(11), fill: colr, 'font-weight': 700 }, txt));
    }
  }

  // expected flight paths: own missiles in the air, and the launch being considered
  const drawPlan = (f, strong) => {
    if (!f || !f.path.length) return;
    const pts = [f.from].concat(f.path), seg = (a, b, op) => s('polyline', { points: pts.slice(a, b + 1).map((c) => f1(X(c)) + ',' + f1(Y(c))).join(' '), fill: 'none', stroke: '#ffffff',
      'stroke-width': strong ? 1.6 : 1, 'stroke-opacity': op, 'stroke-dasharray': '3 2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'flow' });
    const first = Math.min(f.perRound, f.path.length);
    svg.appendChild(seg(0, first, strong ? 0.95 : 0.6));
    if (f.path.length > first) svg.appendChild(seg(first, f.path.length, strong ? 0.5 : 0.3));
    const end = pts[pts.length - 1];
    if (f.ends === 'hit') svg.appendChild(s('path', { d: cellPath(end, 1.05), fill: 'none', stroke: '#ff6b6b', 'stroke-width': 1.6 }));
    else svg.appendChild(s('path', { d: `M${f1(X(end) - 3)},${f1(Y(end) - 3)}L${f1(X(end) + 3)},${f1(Y(end) + 3)}M${f1(X(end) + 3)},${f1(Y(end) - 3)}L${f1(X(end) - 3)},${f1(Y(end) + 3)}`, stroke: '#ffffff', 'stroke-width': 1, 'stroke-opacity': 0.8 }));
    if (f.path.length > first) { const c = pts[first]; svg.appendChild(s('circle', { cx: f1(X(c)), cy: f1(Y(c)), r: 1.8, fill: '#ffffff', 'fill-opacity': 0.9 })); }
  };
  for (const pl of plans) drawPlan(pl.f, false);
  drawPlan(plan, true);

  // choosing where to move: dim the rest of the board so the ways out stand out. The ship itself stays bright.
  const moves = [...opts].filter(([, o]) => o.mark === 'move');
  const mover = moves.length ? v.ships.find((x) => x.id === sel) : null;
  if (mover) {
    svg.querySelector('defs').appendChild(s('mask', { id: 'movescrim', maskUnits: 'userSpaceOnUse', x: f1(-bw), y: f1(-bh), width: f1(2 * bw), height: f1(2 * bh) },
      s('rect', { x: f1(-bw), y: f1(-bh), width: f1(2 * bw), height: f1(2 * bh), fill: '#fff' }),
      s('path', { d: mover.cells.map((c) => cellPath(c, 1.08)).join(''), fill: '#000' })));
    svg.appendChild(s('rect', { x: f1(-bw), y: f1(-bh), width: f1(2 * bw), height: f1(2 * bh), fill: '#02040a', 'fill-opacity': 0.55, mask: 'url(#movescrim)', 'pointer-events': 'none', class: 'movescrim' }));
  }

  if (ghost) {
    const gr = ghost.route && ghost.route.length > 1 ? ghost.route : [ghost.from, ghost.to], ga = gr[gr.length - 2];   // the path, hex by hex; the arrowhead follows its last step
    const gc = col(ghost.owner), ax = X(ga), ay = Y(ga), bx = X(ghost.to), by = Y(ghost.to), ang = Math.atan2(by - ay, bx - ax), hd = 5;
    svg.appendChild(s('path', { d: ghost.cells.map((c) => cellPath(c, 1.0)).join(''), fill: gc, 'fill-opacity': 0.18, stroke: '#ffffff', 'stroke-width': 1.3, 'stroke-dasharray': '3 2' }));
    svg.appendChild(s('polyline', { points: (ghost.route || [ghost.from, ghost.to]).map((c) => f1(X(c)) + ',' + f1(Y(c))).join(' '), fill: 'none', stroke: '#ffffff', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    svg.appendChild(s('path', { d: `M${f1(bx)},${f1(by)}L${f1(bx - hd * Math.cos(ang - 0.5))},${f1(by - hd * Math.sin(ang - 0.5))}L${f1(bx - hd * Math.cos(ang + 0.5))},${f1(by - hd * Math.sin(ang + 0.5))}Z`, fill: '#ffffff' }));
  }

  // move guide (campaign/GUIDE_PROPOSAL.md): a cyan hint of where to go and what to hit. Never blocks a tap.
  if (guide && !hidden) {
    const gc = '#6fe7ff', gl = s('g', { opacity: guide.live ? 1 : 0.4, 'pointer-events': 'none', class: 'guide' });
    for (const c of guide.blockedFrom) {
      const cx = X(c), cy = Y(c), k = S * 0.45;
      gl.appendChild(s('path', { d: cellPath(c, 0.85), fill: 'none', stroke: gc, 'stroke-opacity': 0.35, 'stroke-width': 0.6, 'stroke-dasharray': '1.5 1.5' }));
      gl.appendChild(s('path', { d: `M${f1(cx - k)},${f1(cy - k)}L${f1(cx + k)},${f1(cy + k)}M${f1(cx + k)},${f1(cy - k)}L${f1(cx - k)},${f1(cy + k)}`, stroke: gc, 'stroke-opacity': 0.45, 'stroke-width': 0.8 }));
    }
    if (guide.dest.length) gl.appendChild(s('path', { d: guide.dest.map((c) => cellPath(c, 0.88)).join(''), fill: gc, 'fill-opacity': 0.06, stroke: gc, 'stroke-width': 0.9, class: 'guidepulse' }));
    const gs = v.ships.find((x) => x.id === guide.ship);
    if (guide.best) {
      if (gs && gs.segs.length > 1) gl.appendChild(s('path', { d: gs.segs.map((sg) => cellPath([guide.best[0] + sg.off[0], guide.best[1] + sg.off[1]], 0.9)).join(''), fill: gc, 'fill-opacity': 0.08, stroke: gc, 'stroke-opacity': 0.4, 'stroke-width': 0.6, 'stroke-dasharray': '2 1.5' }));
      gl.appendChild(s('path', { d: cellPath(guide.best, 0.88), fill: gc, 'fill-opacity': 0.28, stroke: gc, 'stroke-width': 1.4 }));
    }
    if (guide.route.length > 1) {
      const cut = guide.turnEnd ? guide.route.findIndex((c) => hex.same(c, guide.turnEnd)) : 0;
      const pts = (a, b) => guide.route.slice(a, b).map((c) => f1(X(c)) + ',' + f1(Y(c))).join(' ');
      if (cut > 0) gl.appendChild(s('polyline', { points: pts(0, cut + 1), fill: 'none', stroke: gc, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-opacity': 0.9 }));
      if (cut < guide.route.length - 1) gl.appendChild(s('polyline', { points: pts(Math.max(0, cut), guide.route.length), fill: 'none', stroke: gc, 'stroke-width': 1.3, 'stroke-dasharray': '0.1 3.2', 'stroke-linecap': 'round', 'stroke-opacity': 0.8 }));
      if (guide.turnEnd) gl.appendChild(s('circle', { cx: f1(X(guide.turnEnd)), cy: f1(Y(guide.turnEnd)), r: 2.2, fill: '#060a14', stroke: gc, 'stroke-width': 1.2 }));
    }
    if (guide.join) {
      const [a, b] = guide.join.cells;
      gl.appendChild(s('line', { x1: f1(X(a)), y1: f1(Y(a)), x2: f1(X(b)), y2: f1(Y(b)), stroke: gc, 'stroke-width': 1.4, 'stroke-dasharray': '2 1.5' }));
      for (const c of [a, b]) gl.appendChild(s('circle', { cx: f1(X(c)), cy: f1(Y(c)), r: 2.4, fill: 'none', stroke: gc, 'stroke-width': 1 }));
    }
    if (guide.reticle) {
      const c = guide.reticle.at, cx = X(c), cy = Y(c), r = S * 0.8, dash = guide.reticle.dashed ? '2 1.6' : null;
      gl.appendChild(s('circle', { cx: f1(cx), cy: f1(cy), r: f1(r), fill: 'none', stroke: gc, 'stroke-width': 1.3, 'stroke-dasharray': dash }));
      gl.appendChild(s('path', { d: `M${f1(cx - r * 1.3)},${f1(cy)}H${f1(cx - r * 0.45)}M${f1(cx + r * 0.45)},${f1(cy)}H${f1(cx + r * 1.3)}M${f1(cx)},${f1(cy - r * 1.3)}V${f1(cy - r * 0.45)}M${f1(cx)},${f1(cy + r * 0.45)}V${f1(cy + r * 1.3)}`, stroke: gc, 'stroke-width': 1.1 }));
    }
    if (guide.label) {
      const txt = guide.label + (guide.of > 1 ? '  ' + guide.step + '/' + guide.of : ''), fpx = 11 / px, w = (txt.length * 6.3 + 14) / px, hgt = 20 / px;
      const lx = X(guide.anchor), ly = Y(guide.anchor) - FL * (S * 1.2) - hgt / 2;
      gl.appendChild(s('rect', { x: f1(lx - w / 2), y: f1(ly - hgt / 2), width: f1(w), height: f1(hgt), rx: f1(hgt / 2), fill: '#06202a', 'fill-opacity': 0.92, stroke: gc, 'stroke-width': f1(1 / px) }));
      gl.appendChild(s('text', { x: f1(lx), y: f1(ly), 'font-size': f1(fpx), 'font-weight': 700, fill: gc }, txt));
    }
    svg.appendChild(gl);
  }

  // what can be tapped right now
  for (const [k, o] of opts) {
    const c = hex.unkey(k), cx = f1(X(c)), cy = f1(Y(c));
    if (o.mark === 'move') {
      // The centre hex of a big ship's one-step move lies under the ship itself, so a marker there says nothing.
      // Those get their chip and an arrow on the ship's outer edge, on the side it would move towards.
      const path = o.action.path, own = mover && mover.cells.some((x) => hex.same(x, c));
      const chosen = pending && pending.type === 'move' && pending.ship === sel && pending.path.length === path.length && pending.path.every((d, i) => d === path[i]);
      const rc = Math.min(S * 0.62, (chosen ? 14 : 12) / px), green = chosen ? '#ffffff' : '#6dffc0';
      let qx = X(c), qy = Y(c), ux = 0, uy = 0;
      if (own && path.length === 1) {
        const set = new Set(mover.cells.map(hex.key)), d = path[0];
        const mx = mover.cells.reduce((n, x) => n + X(x), 0) / mover.cells.length, my = mover.cells.reduce((n, x) => n + Y(x), 0) / mover.cells.length;
        const edge = mover.cells.filter((x) => !set.has(hex.key(hex.step(x, d))));
        const from = (edge.length ? edge : mover.cells).reduce((a, b) => (Math.hypot(X(b) - mx, Y(b) - my) < Math.hypot(X(a) - mx, Y(a) - my) ? b : a));
        const to = hex.step(from, d), vx = X(to) - X(from), vy = Y(to) - Y(from), len = Math.hypot(vx, vy) || 1;
        ux = vx / len; uy = vy / len; qx = X(from) + vx * 0.82; qy = Y(from) + vy * 0.82;
      }
      const g = s('g', { 'data-tap': k, class: 'movechip' });
      if (!own) g.appendChild(s('path', { d: cellPath(c, 0.94), fill: '#58f0b0', 'fill-opacity': 0.22, stroke: '#6dffc0', 'stroke-width': f1(1.5), class: 'movepulse' }));
      g.appendChild(s('circle', { cx: f1(qx), cy: f1(qy), r: f1(rc), fill: 'none', stroke: green, 'stroke-width': f1(1.6 / px), 'stroke-opacity': 0.7, class: 'moveping' }));
      if (ux || uy) {   // a pointer on the outward side of the chip
        const tx = qx + ux * rc * 1.9, ty = qy + uy * rc * 1.9, bx = qx + ux * rc * 0.8, by = qy + uy * rc * 0.8, nx = -uy * rc * 0.75, ny = ux * rc * 0.75;
        g.appendChild(s('path', { d: `M${f1(tx)},${f1(ty)}L${f1(bx + nx)},${f1(by + ny)}L${f1(bx - nx)},${f1(by - ny)}Z`, fill: green, stroke: '#06140e', 'stroke-width': f1(1 / px), 'stroke-linejoin': 'round' }));
      }
      g.appendChild(s('circle', { cx: f1(qx), cy: f1(qy), r: f1(rc), fill: green, stroke: '#06140e', 'stroke-width': f1(1.2 / px) }));
      g.appendChild(s('text', { x: f1(qx), y: f1(qy), 'font-size': fs(chosen ? 13 : 12), 'font-weight': 800, fill: '#06140e' }, chosen ? '✓' : o.label));
      svg.appendChild(g);
    } else if (o.mark === 'way') svg.appendChild(s('circle', { cx, cy, r: 3, fill: '#5cc8ff', 'fill-opacity': 0.85, stroke: '#060a14', 'stroke-width': 0.6 }));
    else {
      const colr = o.mark === 'target' ? '#ff6b6b' : '#f5b942';
      svg.appendChild(s('path', { d: cellPath(c, 1.06), fill: colr, 'fill-opacity': 0.12, stroke: colr, 'stroke-width': 1.8 }));
      if (o.label != null) {
        const r = 7.5 / px;
        svg.appendChild(s('circle', { cx: f1(X(c) + S * 0.75), cy: f1(Y(c) - S * 0.75), r: f1(r), fill: colr }));
        svg.appendChild(s('text', { x: f1(X(c) + S * 0.75), y: f1(Y(c) - S * 0.75), 'font-size': fs(10), 'font-weight': 700, fill: '#0a0f1e' }, o.label));
      }
    }
  }

  // a shot being aimed: the beam's line from the gun to the target and a reticle on it, before anything is fired.
  // It is drawn only between the player's own ship and a target they can already see, so it shows nothing new.
  if (pending && (pending.type === 'fire' || pending.type === 'detonate') && !hidden) {
    const me0 = v.ships.find((x) => x.id === pending.ship), src = pending.type === 'fire' && me0 ? me0.cells[pending.seg] : null;
    const tc = pending.type === 'fire' ? pending.at : (v.objs.find((o) => o.id === pending.obj) || {}).pos, red = '#ff6b6b';
    if (tc) {
      const cx = X(tc), cy = Y(tc), r = S * 0.8, pg = s('g', { 'pointer-events': 'none', class: 'aim' });
      if (src) {
        pg.appendChild(s('line', { x1: f1(X(src)), y1: f1(Y(src)), x2: f1(cx), y2: f1(cy), stroke: red, 'stroke-width': 2.2, 'stroke-opacity': 0.55, 'stroke-linecap': 'round' }));
        pg.appendChild(s('line', { x1: f1(X(src)), y1: f1(Y(src)), x2: f1(cx), y2: f1(cy), stroke: '#ffffff', 'stroke-width': 0.8, 'stroke-dasharray': '3 2.5', 'stroke-linecap': 'round', class: 'flow' }));
      }
      pg.appendChild(s('circle', { cx: f1(cx), cy: f1(cy), r: f1(r), fill: red, 'fill-opacity': 0.18, stroke: '#ffffff', 'stroke-width': 1.4 }));
      pg.appendChild(s('path', { d: `M${f1(cx - r * 1.45)},${f1(cy)}H${f1(cx - r * 0.45)}M${f1(cx + r * 0.45)},${f1(cy)}H${f1(cx + r * 1.45)}M${f1(cx)},${f1(cy - r * 1.45)}V${f1(cy - r * 0.45)}M${f1(cx)},${f1(cy + r * 0.45)}V${f1(cy + r * 1.45)}`, stroke: '#ffffff', 'stroke-width': 1.2, 'stroke-linecap': 'round' }));
      svg.appendChild(pg);
    }
  }

  // taps, dragging and pinching. One finger (or the mouse) drags the view, two fingers zoom it; a tap is passed on.
  let down = null, dragged = false, pinch = null;
  const touches = new Map();
  const showCam = () => { svg.setAttribute('viewBox', [cam.x - cam.w / 2, cam.y - (cam.w * aspect) / 2, cam.w, cam.w * aspect].map(f1).join(' ')); if (onView) onView(cam); };
  const clampCam = () => { cam.x = Math.max(-W * (R + 0.5), Math.min(W * (R + 0.5), cam.x)); cam.y = Math.max(-1.5 * S * R, Math.min(1.5 * S * R, cam.y)); };
  svg.style.touchAction = 'none';
  svg.addEventListener('pointerdown', (ev) => {
    touches.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinch = { d: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])), w: cam.w, maxW: Math.max(cam.w, cam.max || cam.w), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, cx: cam.x, cy: cam.y };
      dragged = true; down = null;
    } else { down = { x: ev.clientX, y: ev.clientY, cx: cam.x, cy: cam.y, k: cam.w / box.clientWidth }; dragged = false; }
  });
  svg.addEventListener('pointermove', (ev) => {
    if (touches.has(ev.pointerId)) touches.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pinch && touches.size >= 2) {
      const [a, b] = [...touches.values()], d = Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]));
      const k0 = pinch.w / box.clientWidth;
      cam.w = Math.max(4 * W, Math.min(pinch.maxW, (pinch.w * pinch.d) / d));
      const k1 = cam.w / box.clientWidth, r = box.getBoundingClientRect(), ox = pinch.mx - r.left - r.width / 2, oy = pinch.my - r.top - r.height / 2;
      // keep the point between the fingers where it was, and follow the fingers as they slide
      cam.x = pinch.cx + ox * (k0 - k1) - ((a[0] + b[0]) / 2 - pinch.mx) * k1;
      cam.y = pinch.cy + oy * (k0 - k1) - ((a[1] + b[1]) / 2 - pinch.my) * k1;
      clampCam(); showCam();
      return;
    }
    if (!down) return;
    const dx = ev.clientX - down.x, dy = ev.clientY - down.y;
    if (!dragged && Math.hypot(dx, dy) < 8) return;
    dragged = true;
    try { svg.setPointerCapture(ev.pointerId); } catch (e) {}
    cam.x = down.cx - dx * down.k; cam.y = down.cy - dy * down.k;
    clampCam(); showCam();
  });
  const lift = (ev) => {
    touches.delete(ev.pointerId);
    if (pinch && touches.size < 2) { pinch = null; down = null; if (onCam) setTimeout(onCam, 0); }   // redraw at the new zoom (detail level, text sizes)
    if (!touches.size) down = null;
  };
  svg.addEventListener('pointerup', lift);
  svg.addEventListener('pointercancel', lift);
  svg.addEventListener('click', (ev) => {
    if (dragged) { dragged = false; return; }
    const chip = ev.target.closest && ev.target.closest('[data-tap]');      // a move chip stands for its destination hex
    if (chip) { onTap(hex.unkey(chip.getAttribute('data-tap')), true); return; }
    const m = svg.getScreenCTM(); if (!m) return;
    let p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; p = p.matrixTransform(m.inverse());
    p.x *= FL; p.y *= FL;               // back to unflipped board coordinates
    const c = hex.cubeRound(((Math.sqrt(3) / 3) * p.x - p.y / 3) / S, ((2 / 3) * p.y) / S);
    if (hex.inHexagon(c, R)) onTap(c, false, ev.timeStamp);
  });
  return svg;
}
