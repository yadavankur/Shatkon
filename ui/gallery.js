// The ship gallery (ui/ships-gallery.html): every hull class, loadout comparisons, every fleet and
// campaign ship for both teams, intact and damaged. Reads the rule files; draws with ui/ships.js.
import { hex } from '../engine/index.js';
import { drawShip, shipDefs, SHAPES, shapeClass } from './ships.js';

const NS = 'http://www.w3.org/2000/svg';
const S = 10, W = Math.sqrt(3) * S;
const xy = (c) => [W * (c[0] + c[1] / 2), 1.5 * S * c[1]];
const out = document.getElementById('out');
const h = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : String(k)); return e; };
const get = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(u + ': ' + r.status); return YAML.parse(await r.text()); };
function rnd(seed) { let t = seed | 0; return () => { t = (t + 0x6d2b79f5) | 0; let x = Math.imul(t ^ (t >>> 15), t | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }

let parts = {};
const segsOf = (hull) => hull.map((sg) => ({ parts: [...(sg.bays || []), ...(sg.mounts || [])].filter((t) => t && parts[t]).map((t) => ({ t, hp: parts[t].hp || 1, max: parts[t].hp || 1 })), wrecked: false }));
// damage: knock out a share of the parts (never the core) and, if asked, wreck a non-core segment
function damage(segs, share, wreck, seed) {
  const r = rnd(seed), o = segs.map((sg) => ({ wrecked: sg.wrecked, parts: sg.parts.map((p) => ({ ...p })) }));
  for (const sg of o) for (const p of sg.parts) if (!parts[p.t].required && r() < share) p.hp = r() < 0.5 && p.max > 1 ? p.max - 1 : 0;
  if (wreck) { const k = o.map((sg, i) => i).filter((i) => !o[i].parts.some((p) => parts[p.t].required)); if (k.length) { const i = k[Math.floor(r() * k.length)]; o[i].wrecked = true; o[i].parts.forEach((p) => (p.hp = 0)); } }
  return o;
}
function shipSvg(cells, segs, owner, opts = {}) {
  const P = cells.map(xy), x0 = Math.min(...P.map((p) => p[0])) - W * 0.95, x1 = Math.max(...P.map((p) => p[0])) + W * 0.95, y0 = Math.min(...P.map((p) => p[1])) - S * 1.6, y1 = Math.max(...P.map((p) => p[1])) + S * 1.6;
  const pad = opts.pad || 0, vw = Math.max(x1 - x0, W * 3.2) + pad, vh = Math.max(y1 - y0, S * 4.2) + pad, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', [cx - vw / 2, cy - vh / 2, vw, vh].map((n) => n.toFixed(1)).join(' '));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', opts.label || 'ship');
  if (opts.maxH) svg.style.maxHeight = opts.maxH;
  svg.appendChild(shipDefs());
  // a few faint hexes of board under the ship, so the footprint reads against the grid
  const grid = document.createElementNS(NS, 'path');
  let d = '';
  const ring = new Map();
  for (const c of cells) for (const n of hex.disc(c, 1)) ring.set(hex.key(n), n);
  for (const c of ring.values()) { const [px, py] = xy(c); for (let i = 0; i < 6; i++) { const a = (Math.PI / 180) * (60 * i - 30); d += (i ? 'L' : 'M') + (px + S * 0.97 * Math.cos(a)).toFixed(1) + ',' + (py + S * 0.97 * Math.sin(a)).toFixed(1); } d += 'Z'; }
  grid.setAttribute('d', d); grid.setAttribute('fill', 'none'); grid.setAttribute('stroke', '#2b5a85'); grid.setAttribute('stroke-width', '.35'); grid.setAttribute('stroke-opacity', '.5');
  svg.appendChild(grid);
  svg.appendChild(drawShip({ cells, segs, owner, rules: { parts }, xy, S, forward: [0, owner === 1 ? 1 : -1], detail: opts.far ? 0 : 1, moved: opts.moved || 0, flagship: opts.flagship }));
  return svg;
}
// A plausible default loadout for any footprint: core in the middle, couplings, engines aft, guns forward.
function loadout(cells, kind) {
  const P = cells.map(xy), cx = P.reduce((n, p) => n + p[0], 0) / P.length, cy = P.reduce((n, p) => n + p[1], 0) / P.length;
  const core = P.map((p, i) => [Math.hypot(p[0] - cx, p[1] - cy) + (p[1] - cy) * 0.01, i]).sort((a, b) => a[0] - b[0])[0][1];
  const L = {
    standard: { bays: ['engine', 'sensor', 'engine'], mounts: ['laser', 'armour', ''] },
    brawler: { bays: ['engine', 'engine', 'magazine'], mounts: ['laser', 'armour', 'armour'] },
    ghost: { bays: ['stealth', 'stealth', 'engine'], mounts: ['laser', '', ''] },
    picket: { bays: ['sensor', 'sensor', 'comms'], mounts: ['point_defence', '', ''] },
    bulwark: { bays: ['engine', 'flare_mask', 'magazine'], mounts: ['shield', 'shield', 'launcher'] },
    runner: { bays: ['engine', 'engine', 'engine'], mounts: ['', '', ''] },
    unknown: null,
  }[kind];
  return cells.map((c, i) => {
    if (!L) return { at: c, bays: [], mounts: [] };
    const bays = L.bays.slice(), mounts = L.mounts.slice();
    if (i === core) bays[0] = 'core'; else bays[2] = 'coupling';
    if (i === core && cells.length > 1) bays[1] = kind === 'ghost' ? 'stealth' : 'sensor';
    return { at: c, bays, mounts };
  });
}
function section(title, note, cls) { out.append(h('h2', null, title)); if (note) out.append(h('p', 'note', note)); const g = h('div', 'grid' + (cls ? ' ' + cls : '')); out.append(g); return g; }
function card(title, sub, body, team) { return h('div', 'card' + (team ? ' t' + team : ''), h('h3', null, title[0], h('small', null, title[1] || '')), h('div', 'sub', sub || ''), body); }
const pair = (a, b, la, lb) => h('div', 'pair', h('div', null, a, h('div', 'tag', la)), h('div', null, b, h('div', 'tag', lb)));

async function main() {
  const world = await get('../rules/world_v0.4.yaml');
  parts = { ...(world.bay_parts || {}), ...(world.mount_parts || {}) };
  const fleets = await get('../rules/fleets_v0.4.yaml');
  let camp = {};
  try { camp = await get('../campaign/ships.yaml'); } catch (e) {}

  // 1. every hull class, both teams
  let g = section('Hull classes · 1 to 7 segments', 'One designed silhouette per footprint. Same standard loadout on each; left your side, right the enemy (bows face each other).');
  for (const sh of SHAPES) {
    const hull = loadout(sh.cells, 'standard');
    g.append(card([sh.name, sh.cells.length + ' seg'], 'axial ' + JSON.stringify(sh.cells).replace(/,/g, ', ').slice(0, 64), pair(shipSvg(sh.cells, segsOf(hull), 0, { label: sh.name }), shipSvg(sh.cells, segsOf(hull), 1, { label: sh.name + ' enemy' }), 'you', 'enemy')));
  }
  // 2. same shape, different loadouts
  g = section('Same hull, different loadouts', 'The footprint is identical; what is fitted changes the finish, the trim and the glow.', 'wide');
  const kinds = [['standard', 'Standard'], ['brawler', 'Brawler: armour + lasers'], ['ghost', 'Ghost: stealth'], ['picket', 'Picket: sensors + comms'], ['bulwark', 'Bulwark: shields + launcher'], ['runner', 'Runner: all engines'], ['unknown', 'Unscanned contact']];
  for (const id of ['cutter', 'lance', 'flower']) {
    const sh = SHAPES.find((x) => x.id === id);
    for (const [k, label] of kinds) {
      const hull = loadout(sh.cells, k), segs = k === 'unknown' ? sh.cells.map(() => ({ parts: null, wrecked: false })) : segsOf(hull);
      const team = k === 'unknown' || k === 'ghost' ? 1 : 0;
      g.append(card([sh.name, label], '', shipSvg(sh.cells, segs, team, { label: sh.name + ' ' + label }), team));
    }
  }
  // 3. every fleet and campaign ship, intact and damaged
  g = section('Every ship in the rule files', 'Skirmish fleets (rules/fleets_v0.4.yaml) and the campaign hulls (campaign/ships.yaml). Intact, then damaged: about 40% of parts lost and one segment wrecked.', 'wide');
  const list = [];
  for (const p of ['player_1', 'player_2']) for (const sh of (fleets[p] && fleets[p].ships) || []) list.push(['skirmish: ' + sh.name, sh, p === 'player_2' ? 1 : 0]);
  const enemy = /seed|twin|husk|bloom/;
  for (const [k, sh] of Object.entries(camp)) if (sh && sh.hull) list.push([k, sh, enemy.test(k) ? 1 : 0]);
  list.forEach(([name, sh, team], n) => {
    const cells = sh.hull.map((x) => x.at), segs = segsOf(sh.hull), cls = shapeClass(cells);
    for (const t of [team, 1 - team]) {
      const a = shipSvg(cells, segs, t, { flagship: sh.flagship, label: name }), b = shipSvg(cells, damage(segs, 0.4, cells.length > 1, n * 13 + t), t, { flagship: sh.flagship, label: name + ' damaged' });
      g.append(card([name, (cls ? cls.name : 'custom hull') + (t !== team ? ' · other side' : '')], cells.length + ' segments' + (sh.joined ? ' · joined' : ''), pair(a, b, 'intact', 'damaged'), t));
    }
  });
  // 4. damage progression and far zoom
  g = section('Damage, step by step', 'Kestrel (ch3 refit): lost parts scorch the plate and put out the trim; a wrecked segment is charred and cracked but still part of the hull.', 'wide');
  const k3 = camp['kestrel@ch3'] || { hull: loadout(SHAPES[4].cells, 'brawler') }, kc = k3.hull.map((x) => x.at), ks = segsOf(k3.hull);
  [[0, false, 'intact'], [0.25, false, '25% lost'], [0.55, false, '55% lost'], [0.55, true, 'one segment wrecked'], [0.8, true, 'crippled']].forEach(([sh, wr, label], i) => {
    let segs = damage(ks, sh, wr, 99 + i);
    if (label === 'crippled') segs = damage(segs, 0.6, true, 7);
    g.append(card(['Kestrel', label], '', shipSvg(kc, segs, 0, { flagship: true, label: 'Kestrel ' + label }), 0));
  });
  g = section('Far zoom (board overview, phone)', 'Zoomed out the kit drops the fine surface and keeps silhouette, team rim, engine glow, shields and wrecks.', '');
  for (const id of ['skiff', 'cutter', 'lance', 'wedge', 'flower']) {
    const sh = SHAPES.find((x) => x.id === id), segs = segsOf(loadout(sh.cells, 'bulwark'));
    g.append(card([sh.name, 'far'], '', pair(shipSvg(sh.cells, segs, 0, { far: true, label: sh.name }), shipSvg(sh.cells, damage(segs, 0.5, sh.cells.length > 1, 3), 1, { far: true, label: sh.name }), 'you', 'enemy, hit')));
  }
}
main().catch((e) => { document.getElementById('err').textContent = 'Could not load the rule files: ' + e.message + ' (open this page through a web server).'; console.error(e); });
