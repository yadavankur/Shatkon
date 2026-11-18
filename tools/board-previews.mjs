// Draw a small map preview of each board in rules/boards/, using the same hex
// layout as ui/board.js (pointy-top, unflipped). Writes icons/boards/<id>.svg.
//
//   node tools/board-previews.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardNames, loadBoard } from './boards.mjs';
import { hex } from '../engine/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'icons/boards');

const S = 10, W = Math.sqrt(3) * S;
const X = (c) => W * (c[0] + c[1] / 2);
const Y = (c) => 1.5 * S * c[1];
const f1 = (n) => n.toFixed(1);

function hexPath(cx, cy, r) {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    d += (i ? 'L' : 'M') + f1(cx + r * Math.cos(a)) + ',' + f1(cy + r * Math.sin(a));
  }
  return d + 'Z';
}
const cellPath = (c, k = 0.96) => hexPath(X(c), Y(c), S * k);

function outlinePath(cells) {
  const inside = new Set(cells.map(hex.key));
  let d = '';
  for (const c of cells) for (let k = 0; k < 6; k++) {
    const n = hex.step(c, k);
    if (inside.has(hex.key(n))) continue;
    const vx = X(n) - X(c), vy = Y(n) - Y(c), len = Math.hypot(vx, vy) || 1;
    const mx = X(c) + vx / 2, my = Y(c) + vy / 2, px = (-vy / len) * (S / 2), py = (vx / len) * (S / 2);
    d += 'M' + f1(mx - px) + ',' + f1(my - py) + 'L' + f1(mx + px) + ',' + f1(my + py);
  }
  return d;
}

function rnd(seed) {
  let s = seed | 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

const TEAM = ['#7fd8f0', '#ff8bd8'];
const TEAM_INK = ['#0a3040', '#3a1030'];

function render(name) {
  const { rules } = loadBoard(name);
  const R = rules.board.radius;
  const all = [];
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (hex.inHexagon([q, r], R)) all.push([q, r]);

  const parts = [];
  const push = (tag, attrs, inner) => {
    const a = Object.entries(attrs).filter(([, v]) => v != null && v !== false).map(([k, v]) => `${k}="${v}"`).join(' ');
    parts.push(inner == null ? `<${tag} ${a}/>` : `<${tag} ${a}>${inner}</${tag}>`);
  };

  // home zones
  for (const z of rules.zones) {
    const owner = z.name.indexOf('player_2') === 0 ? 1 : z.name.indexOf('player_1') === 0 ? 0 : -1;
    if (owner < 0 || !hex.EDGE[z.edge]) continue;
    const cells = all.filter((c) => hex.EDGE[z.edge](c, R) < z.depth);
    if (cells.length) push('path', { d: cells.map((c) => cellPath(c)).join(''), fill: TEAM[owner], 'fill-opacity': 0.1 });
  }

  // terrain
  for (const t of rules.terrain) {
    const solid = (rules.terrainTypes[t.type] || {}).blocks_movement;
    if (!solid) {
      push('path', { d: t.cells.map((c) => cellPath(c, 1.01)).join(''), fill: '#4a5bd8', 'fill-opacity': 0.16 });
      for (const c of t.cells) {
        const r = rnd(c[0] * 7919 + c[1] * 104729 + 5);
        push('circle', { cx: f1(X(c) + (r() - 0.5) * 5), cy: f1(Y(c) + (r() - 0.5) * 5), r: f1(S * (1.1 + r() * 0.5)), fill: '#6a7cff', 'fill-opacity': 0.14 });
      }
      push('path', { d: outlinePath(t.cells), fill: 'none', stroke: '#8fa2ff', 'stroke-opacity': 0.55, 'stroke-width': 0.5, 'stroke-dasharray': '1.2 1.6', 'stroke-linecap': 'round' });
      continue;
    }
    push('path', { d: t.cells.map((c) => cellPath(c, 0.98)).join(''), fill: '#1a1d28', 'fill-opacity': 0.7, stroke: '#3a4054', 'stroke-width': 0.35 });
    for (const c of t.cells) {
      const r = rnd(c[0] * 7919 + c[1] * 104729 + 5);
      const cx = X(c) + (r() - 0.5) * 2, cy = Y(c) + (r() - 0.5) * 2, base = S * (0.55 + r() * 0.15), k = 0.85 + r() * 0.2;
      let d = '';
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * 2 * Math.PI, rad = base * (0.72 + r() * 0.32);
        d += (i ? 'L' : 'M') + f1(cx + rad * Math.cos(a)) + ',' + f1(cy + rad * Math.sin(a) * k);
      }
      push('path', { d: d + 'Z', fill: '#6a7186', stroke: '#1b1e2a', 'stroke-width': 0.4, 'stroke-linejoin': 'round' });
      push('path', { d: `M${f1(cx - base * 0.55)},${f1(cy - base * 0.3)}Q${f1(cx - base * 0.2)},${f1(cy - base * 0.75)} ${f1(cx + base * 0.4)},${f1(cy - base * 0.55)}`, fill: 'none', stroke: '#d8deec', 'stroke-opacity': 0.4, 'stroke-width': 0.35, 'stroke-linecap': 'round' });
    }
  }

  // beacon
  if (rules.objective) {
    const o = rules.objective;
    const oc = all.filter((c) => hex.dist(c, o.at) <= o.radius);
    push('path', { d: oc.map((c) => cellPath(c, 0.92)).join(''), fill: '#e8c15a', 'fill-opacity': 0.12, stroke: '#e8c15a', 'stroke-width': 0.8, 'stroke-opacity': 0.85, 'stroke-dasharray': '2 1.5' });
    let d = '';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 2 * Math.PI - Math.PI / 2, rad = S * (i % 2 ? 0.18 : 0.42);
      d += (i ? 'L' : 'M') + f1(X(o.at) + rad * Math.cos(a)) + ',' + f1(Y(o.at) + rad * Math.sin(a));
    }
    push('path', { d: d + 'Z', fill: '#e8c15a', 'fill-opacity': 0.95 });
  }

  // hex grid on top of terrain, under ships
  push('path', { d: all.map((c) => cellPath(c, 0.97)).join(''), fill: 'none', stroke: '#2b5a85', 'stroke-width': 0.35, 'stroke-opacity': 0.55 });
  push('path', { d: outlinePath(all), fill: 'none', stroke: '#5ff7ff', 'stroke-width': 0.55, 'stroke-opacity': 0.35, 'stroke-linecap': 'round' });

  // mines and ships
  rules.fleets.forEach((fl, pi) => {
    for (const d of fl.deployment) {
      if (d.munition) {
        const x = X(d.at), y = Y(d.at);
        push('circle', { cx: f1(x), cy: f1(y), r: f1(S * 0.28), fill: '#f0c35a', stroke: '#8a5a10', 'stroke-width': 0.4 });
        push('circle', { cx: f1(x), cy: f1(y), r: f1(S * 0.12), fill: '#3a2010' });
        continue;
      }
      const sh = fl.ships.find((s) => s.name === d.ship);
      if (!sh) continue;
      const cells = sh.segs.map((sg) => hex.add(d.at, sg.off));
      push('path', { d: cells.map((c) => cellPath(c, 0.86)).join(''), fill: TEAM[pi], 'fill-opacity': 0.88, stroke: TEAM_INK[pi], 'stroke-width': 0.55, 'stroke-linejoin': 'round' });
      if (sh.flagship) {
        const core = cells[0];
        push('circle', { cx: f1(X(core)), cy: f1(Y(core)), r: f1(S * 0.22), fill: '#fff', 'fill-opacity': 0.9 });
      }
    }
  });

  // tight box around the hexagon
  const xs = all.map(X), ys = all.map(Y);
  const pad = S * 2.2;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  const bw = maxX - minX, bh = maxY - minY;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f1(minX)} ${f1(minY)} ${f1(bw)} ${f1(bh)}" width="640" height="${Math.round(640 * bh / bw)}" role="img" aria-hidden="true">
  <title>${name}</title>
  <rect x="${f1(minX)}" y="${f1(minY)}" width="${f1(bw)}" height="${f1(bh)}" fill="#040812"/>
  <ellipse cx="0" cy="0" rx="${f1(bw * 0.45)}" ry="${f1(bh * 0.38)}" fill="#12305a" fill-opacity="0.35"/>
  ${parts.join('\n  ')}
</svg>
`;
}

fs.mkdirSync(outDir, { recursive: true });
for (const name of boardNames()) {
  const dest = path.join(outDir, name + '.svg');
  fs.writeFileSync(dest, render(name));
  console.log('wrote ' + path.relative(root, dest));
}
