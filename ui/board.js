// Draws the board as vector graphics: space, terrain, fog, ships with their
// slots, missiles with their expected paths, and whatever can be tapped.

import { hex } from '../engine/index.js';

const NS = 'http://www.w3.org/2000/svg';
export const S = 10, W = Math.sqrt(3) * S;
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

export function drawBoard({ view: v, rules, looks, cam, sel, opts, plan, plans, ghost, seat, box, onTap, pending = null, hidden = false, guide = null }) {
  // nothing to draw while the board has no size (Lab tab open, mid-resize)
  if (!box.clientWidth || !box.clientHeight || !(cam.w > 0) || !isFinite(cam.w)) return s('svg', { role: 'img', 'aria-label': 'Game board' });
  const R = v.board.radius, aspect = box.clientHeight / Math.max(1, box.clientWidth), vw = cam.w, vh = cam.w * aspect;
  const svg = s('svg', { viewBox: [cam.x - vw / 2, cam.y - vh / 2, vw, vh].map(f1).join(' '), role: 'img', 'aria-label': 'Game board' });
  const px = box.clientWidth / vw;              // screen pixels per drawing unit
  const detailed = S * 2 * px >= 30;            // big enough to show the slots inside each segment
  const col = (o) => (o === 0 ? '#f5b942' : '#5cc8ff');
  const fs = (pxSize) => f1(pxSize / px);       // a font size that stays readable at any zoom

  svg.appendChild(s('defs', null,
    s('radialGradient', { id: 'space', cx: '50%', cy: '45%', r: '75%' }, s('stop', { offset: '0', 'stop-color': '#131c3a' }), s('stop', { offset: '1', 'stop-color': '#04070f' })),
    s('radialGradient', { id: 'fuzz' }, s('stop', { offset: '0', 'stop-color': '#ff7a7a', 'stop-opacity': '.35' }), s('stop', { offset: '.7', 'stop-color': '#ff7a7a', 'stop-opacity': '.12' }), s('stop', { offset: '1', 'stop-color': '#ff7a7a', 'stop-opacity': '0' })),
    s('radialGradient', { id: 'haze' }, s('stop', { offset: '0', 'stop-color': '#b07cf0', 'stop-opacity': '.55' }), s('stop', { offset: '1', 'stop-color': '#6a3fd0', 'stop-opacity': '0' })),
    s('linearGradient', { id: 'rock', x1: '0', y1: '0', x2: '1', y2: '1' }, s('stop', { offset: '0', 'stop-color': '#9aa1b5' }), s('stop', { offset: '1', 'stop-color': '#4a5065' })),
    s('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, s('feGaussianBlur', { stdDeviation: '1.6' }))));

  // space and stars
  const bw = W * (2 * R + 6), bh = S * (3 * R + 10);
  svg.appendChild(s('rect', { x: -bw, y: -bh, width: 2 * bw, height: 2 * bh, fill: 'url(#space)' }));
  const star = rnd(R * 977 + 13), stars = s('g', { fill: '#cfd8ff' });
  for (let i = 0; i < 160; i++) stars.appendChild(s('circle', { cx: f1((star() - 0.5) * bw * 1.6), cy: f1((star() - 0.5) * bh * 1.6), r: f1(0.25 + star() * 0.6), opacity: f1(0.25 + star() * 0.6) }));
  svg.appendChild(stars);

  // start zones, tinted and named
  const all = [];
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (hex.inHexagon([q, r], R)) all.push([q, r]);
  const me = v.me === 'all' ? null : v.me;
  for (const z of v.zones) {
    const owner = v.players.findIndex((n) => z.name.indexOf(n) === 0);
    if (owner < 0 || !hex.EDGE[z.edge]) continue;
    const cells = all.filter((c) => hex.EDGE[z.edge](c, R) < z.depth);
    svg.appendChild(s('path', { d: cells.map((c) => cellPath(c)).join(''), fill: col(owner), 'fill-opacity': 0.07 }));
    const mid = cells.reduce((a, c) => [a[0] + X(c) / cells.length, a[1] + Y(c) / cells.length], [0, 0]);
    if (cam.w >= W * (2 * R + 1) * 0.8) svg.appendChild(s('text', { x: f1(mid[0]), y: f1(mid[1] + (hex.EDGE[z.edge]([0, R], R) === 0 ? 1 : -1) * FL * S * 1.5 * (z.depth / 2 + 0.2)), 'font-size': fs(10), fill: col(owner), 'fill-opacity': 0.55, 'letter-spacing': f1(1.5 / px) },
      me === null ? 'PLAYER ' + (owner + 1) + ' START' : owner === me ? 'YOUR START' : 'ENEMY START'));
  }

  // terrain: soft nebula clouds, lumpy asteroids
  for (const t of v.terrain) {
    const solid = (rules.terrainTypes[t.type] || {}).blocks_movement;
    for (const c of t.cells) {
      const r = rnd(c[0] * 7919 + c[1] * 104729 + 5);
      if (!solid) { svg.appendChild(s('circle', { cx: f1(X(c) + (r() - 0.5) * 4), cy: f1(Y(c) + (r() - 0.5) * 4), r: f1(S * (1.25 + r() * 0.5)), fill: 'url(#haze)' })); continue; }
      let d = '';
      for (let i = 0; i < 9; i++) { const a = (i / 9) * 2 * Math.PI, rad = S * (0.55 + r() * 0.33); d += (i ? 'L' : 'M') + f1(X(c) + rad * Math.cos(a)) + ',' + f1(Y(c) + rad * Math.sin(a)); }
      svg.appendChild(s('path', { d: d + 'Z', fill: 'url(#rock)', stroke: '#2c3145', 'stroke-width': 0.7, 'stroke-linejoin': 'round' }));
      svg.appendChild(s('circle', { cx: f1(X(c) - 2 + r() * 3), cy: f1(Y(c) - 1 + r() * 3), r: f1(1 + r()), fill: '#3a4056', opacity: 0.7 }));
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
  if (dark.length) svg.appendChild(s('path', { d: dark.map((c) => cellPath(c, 1.01)).join(''), fill: '#02040a', 'fill-opacity': 0.5 }));
  svg.appendChild(s('path', { d: all.map((c) => cellPath(c)).join(''), fill: 'none', stroke: '#33427a', 'stroke-width': 0.5, 'stroke-opacity': 0.75 }));

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
    svg.appendChild(s('path', { d: g.cells.map((c) => cellPath(c, 0.9)).join(''), fill: '#8f9cba', 'fill-opacity': 0.08, stroke: '#8f9cba', 'stroke-width': 0.8, 'stroke-dasharray': '2 2' }));
    svg.appendChild(s('text', { x: f1(X(g.pos)), y: f1(Y(g.pos)), 'font-size': fs(13), fill: '#c5cee6' }, '?'));
  }

  // tier 1: fuzzy contacts, "something is roughly here"
  for (const x of v.contacts || []) {
    const cx = X(x.at), cy = Y(x.at), rr = W * ((x.r || 2) + 0.5);
    svg.appendChild(s('circle', { cx: f1(cx), cy: f1(cy), r: f1(rr), fill: 'url(#fuzz)', class: 'fuzz' }));
    svg.appendChild(s('circle', { cx: f1(cx), cy: f1(cy), r: f1(rr), fill: 'none', stroke: '#ff7a7a', 'stroke-width': f1(1 / px + 0.3), 'stroke-dasharray': '2 3', 'stroke-opacity': 0.7 }));
    svg.appendChild(s('text', { x: f1(cx), y: f1(cy), 'font-size': fs(12), fill: '#ffb3b3', 'font-weight': 700 }, x.kind === 'ship' ? '?' : '·?'));
  }

  // ships
  for (const x of v.ships) {
    const c0 = col(x.owner), g = s('g', x.seen ? null : { opacity: 0.4 });
    if (x.id === sel) g.appendChild(s('path', { d: x.cells.map((c) => cellPath(c, 1.12)).join(''), fill: c0, 'fill-opacity': 0.35, filter: 'url(#glow)' }));
    x.segs.forEach((sg, i) => {
      const c = x.cells[i], cx = X(c), cy = Y(c);
      if (sg.wrecked) {
        g.appendChild(s('path', { d: cellPath(c), fill: '#151a28', stroke: '#566080', 'stroke-width': 0.7, 'stroke-dasharray': '1.5 1.5' }));
        g.appendChild(s('path', { d: `M${f1(cx - 4)},${f1(cy - 3)}L${f1(cx + 1)},${f1(cy)}L${f1(cx - 2)},${f1(cy + 4)}M${f1(cx + 4)},${f1(cy - 4)}L${f1(cx + 1)},${f1(cy)}`, stroke: '#566080', 'stroke-width': 0.6, fill: 'none' }));
        return;
      }
      if (!detailed || !sg.parts) {
        g.appendChild(s('path', { d: cellPath(c), fill: c0, 'fill-opacity': sg.parts ? 0.85 : 0.6, stroke: c0, 'stroke-width': 0.8 }));
        if (detailed) g.appendChild(s('text', { x: f1(cx), y: f1(cy), 'font-size': fs(12), fill: '#0a0f1e' }, '?'));
        return;
      }
      g.appendChild(s('path', { d: cellPath(c), fill: '#141d38', stroke: c0, 'stroke-width': 1.1 }));
      const cat = (p) => rules.parts[p.t].slot;
      const bays = sg.parts.filter((p) => cat(p) === 'bay'), mounts = sg.parts.filter((p) => cat(p) === 'mount');
      const slot = (p, d, tx, ty) => {
        const L = p ? looks[p.t] : null, dead = p && p.hp <= 0;
        g.appendChild(s('path', { d, fill: !p ? 'none' : dead ? (L.recharges ? 'none' : '#262b3a') : L.color, 'fill-opacity': p && !dead && p.hp < p.max ? 0.6 : 1,
          stroke: !p ? '#33406b' : dead && L.recharges ? L.color : '#0a0f1e', 'stroke-width': 0.45, 'stroke-dasharray': dead && L.recharges ? '1 1' : null }));
        if (p && S * px >= 19) g.appendChild(s('text', { x: f1(tx), y: f1(ty), 'font-size': f1(3.6), 'font-weight': 700, fill: dead ? '#6b7592' : '#0a0f1e' }, L.letter));
        if (dead && !L.recharges) g.appendChild(s('path', { d: `M${f1(tx - 1.6)},${f1(ty - 1.6)}L${f1(tx + 1.6)},${f1(ty + 1.6)}M${f1(tx + 1.6)},${f1(ty - 1.6)}L${f1(tx - 1.6)},${f1(ty + 1.6)}`, stroke: '#ff7a7a', 'stroke-width': 0.5 }));
      };
      BAYS.forEach(([bx, by], k) => slot(bays[k], hexPath(cx + S * bx, cy + S * by, S * 0.42), cx + S * bx, cy + S * by));
      for (let k = 0; k < 3; k++) { const dm = diamond(cx, cy, k); slot(mounts[k], dm.d, dm.x, dm.y); }
    });
    // name tag under the ship
    const low = x.cells.reduce((a, c) => (Y(c) > Y(a) || (Y(c) === Y(a) && Math.abs(X(c) - X(x.pos)) < Math.abs(X(a) - X(x.pos))) ? c : a), x.cells[0]);
    const label = (x.flagship ? '★ ' : '') + x.id + (x.mine || v.me === 'all' ? '' : x.tier >= 3 ? ' ▣' : ' ◆'), tw = (label.length * 7.2 + 8) / px, th = 15 / px;
    const lx = X(x.pos), ly = Y(low) + S + th * 0.7;
    g.appendChild(s('rect', { x: f1(lx - tw / 2), y: f1(ly - th / 2), width: f1(tw), height: f1(th), rx: f1(th / 2), fill: '#060a14', 'fill-opacity': 0.85, stroke: c0, 'stroke-width': f1(1 / px) }));
    g.appendChild(s('text', { x: f1(lx), y: f1(ly), 'font-size': fs(11), 'font-weight': 700, fill: c0 }, label));
    svg.appendChild(g);
  }

  // missiles, drones and mines
  for (const o of v.objs) {
    const cx = X(o.pos), cy = Y(o.pos), m = rules.munitions[o.kind], c0 = col(o.owner), fade = o.seen ? null : 0.4;
    if (o.last && !hex.same(o.last, o.pos)) svg.appendChild(s('line', { x1: f1(X(o.last)), y1: f1(Y(o.last)), x2: f1(cx), y2: f1(cy), stroke: c0, 'stroke-width': 1, 'stroke-opacity': 0.35, 'stroke-linecap': 'round' }));
    if (!m.speed) {
      let d = '';
      for (let i = 0; i < 16; i++) { const a = (i / 16) * 2 * Math.PI, rad = i % 2 ? 2.6 : 5.2; d += (i ? 'L' : 'M') + f1(cx + rad * Math.cos(a)) + ',' + f1(cy + rad * Math.sin(a)); }
      svg.appendChild(s('path', { d: d + 'Z', fill: '#0b1020', stroke: c0, 'stroke-width': 0.9, opacity: fade }));
      svg.appendChild(s('circle', { cx: f1(cx), cy: f1(cy), r: 1.2, fill: c0, opacity: fade }));
    } else if (m.patrol) {
      svg.appendChild(s('circle', { cx: f1(cx), cy: f1(cy), r: 4.2, fill: '#0b1020', stroke: c0, 'stroke-width': 1.3, opacity: fade }));
      svg.appendChild(s('circle', { cx: f1(cx), cy: f1(cy), r: 1.5, fill: c0 }));
      svg.appendChild(s('path', { d: 'M4.2,0L7.5,0', stroke: c0, 'stroke-width': 1.1, transform: `translate(${f1(cx)},${f1(cy)}) rotate(${-60 * o.dir + (FL < 0 ? 180 : 0)})` }));
    } else {
      const g = s('g', { transform: `translate(${f1(cx)},${f1(cy)}) rotate(${-60 * o.dir + (FL < 0 ? 180 : 0)})`, opacity: fade });
      g.appendChild(s('path', { d: 'M-4,0L-9,2L-7,0L-9,-2Z', fill: '#ff9d4d', opacity: 0.85 }));
      g.appendChild(s('path', { d: 'M7,0L1,3L-4,3L-4,-3L1,-3Z', fill: c0, stroke: '#060a14', 'stroke-width': 0.6 }));
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

  if (ghost) {
    const gc = col(ghost.owner), ax = X(ghost.from), ay = Y(ghost.from), bx = X(ghost.to), by = Y(ghost.to), ang = Math.atan2(by - ay, bx - ax), hd = 5;
    svg.appendChild(s('path', { d: ghost.cells.map((c) => cellPath(c, 1.0)).join(''), fill: gc, 'fill-opacity': 0.18, stroke: '#ffffff', 'stroke-width': 1.3, 'stroke-dasharray': '3 2' }));
    svg.appendChild(s('line', { x1: f1(ax), y1: f1(ay), x2: f1(bx), y2: f1(by), stroke: '#ffffff', 'stroke-width': 1.6, 'stroke-linecap': 'round' }));
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
      svg.appendChild(s('path', { d: cellPath(c, 0.9), fill: '#58d6a0', 'fill-opacity': 0.1, stroke: '#58d6a0', 'stroke-width': 0.6, 'stroke-opacity': 0.7 }));
      svg.appendChild(s('circle', { cx, cy, r: f1(Math.min(S * 0.5, 8.5 / px)), fill: '#58d6a0', stroke: '#06140e', 'stroke-width': f1(1 / px) }));
      svg.appendChild(s('text', { x: cx, y: cy, 'font-size': fs(10), 'font-weight': 700, fill: '#06140e' }, o.label));
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

  // taps and dragging. A drag moves the view; a tap is passed on.
  let down = null, dragged = false;
  const zoomed = cam.w < W * (2 * R + 1);
  svg.style.touchAction = zoomed ? 'none' : 'pan-y';
  svg.addEventListener('pointerdown', (ev) => { down = { x: ev.clientX, y: ev.clientY, cx: cam.x, cy: cam.y }; dragged = false; });
  svg.addEventListener('pointermove', (ev) => {
    if (!down || !zoomed) return;
    const dx = ev.clientX - down.x, dy = ev.clientY - down.y;
    if (!dragged && Math.hypot(dx, dy) < 8) return;
    dragged = true;
    try { svg.setPointerCapture(ev.pointerId); } catch (e) {}
    cam.x = Math.max(-W * (R + 0.5), Math.min(W * (R + 0.5), down.cx - dx / px));
    cam.y = Math.max(-1.5 * S * R, Math.min(1.5 * S * R, down.cy - dy / px));
    svg.setAttribute('viewBox', [cam.x - vw / 2, cam.y - vh / 2, vw, vh].map(f1).join(' '));
  });
  svg.addEventListener('pointerup', () => { down = null; });
  svg.addEventListener('pointercancel', () => { down = null; });
  svg.addEventListener('click', (ev) => {
    if (dragged) { dragged = false; return; }
    const m = svg.getScreenCTM(); if (!m) return;
    let p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; p = p.matrixTransform(m.inverse());
    p.x *= FL; p.y *= FL;               // back to unflipped board coordinates
    const c = hex.cubeRound(((Math.sqrt(3) / 3) * p.x - p.y / 3) / S, ((2 / 3) * p.y) / S);
    if (hex.inHexagon(c, R)) onTap(c);
  });
  return svg;
}
