/* ---------- ships ---------- */
const PART = {
  core: ['C', '#e6f6ff'], engine: ['E', '#2fe0b0'], sensor: ['S', '#7fd8f0'], stealth: ['St', '#6f86a6'], flare_mask: ['Fm', '#8fa8c8'],
  magazine: ['Mg', '#3fa0a0'], comms: ['Co', '#56b8ff'], coupling: ['Cp', '#4a6a8a'],
  shield: ['Sh', '#9fe8ff'], armour: ['Ar', '#8aa0b4'], laser: ['L', '#5ff7ff'], launcher: ['Ln', '#4a8cff'], point_defence: ['PD', '#2fc0d0'],
};
// enemy (Weave) tints: purple for bays, pink for mounts
const PARTW = { core: '#f3e6ff', engine: '#c79bff', sensor: '#b48cff', stealth: '#7d6a9e', flare_mask: '#9c86c0', magazine: '#a070d0', comms: '#b98cff', coupling: '#6d5a8c',
  shield: '#ffc4ec', armour: '#b49ab8', laser: '#ff5fc8', launcher: '#e070ff', point_defence: '#ff8fd6' };
const partCol = (p, side) => (side === 'w' ? PARTW[p] : (PART[p] || [0, '#7f93ad'])[1]) || '#7f93ad';
const LOGO = SKG.build(0.4);
// bays live in the three core hexagons, mounts in the three tip rhombi (see "Shatkon: the geometry")
const BAY_CELLS = [LOGO.cells.core[2], LOGO.cells.core[0], LOGO.cells.core[1]]; // K5 upper-left, K1 upper-right, K3 bottom
const MOUNT_CELLS = [LOGO.cells.tip[0], LOGO.cells.tip[1], LOGO.cells.tip[2]];  // T0 top, T2 lower-right, T4 lower-left
const LOGO_LINES = SKG.allLines(LOGO, false);
const pname = (p) => p.replace('_', ' ');
function shipStats(hull, load) {
  const n = hull.length, cnt = {};
  hull.forEach((s) => [...(s.bays || []), ...(s.mounts || [])].forEach((p) => { cnt[p] = (cnt[p] || 0) + 1; }));
  const P = D.parts, M = D.munitions;
  let cost = 3 * n;
  for (const [p, c] of Object.entries(cnt)) if (P[p]) cost += P[p].cost * c;
  for (const [k, v] of Object.entries(load || {})) if (M[k]) cost += M[k].cost * v;
  const sig = Math.max(n - (cnt.stealth || 0), Math.ceil(n / 3));
  return { n, cnt, cost, sensor: 2 + 2 * (cnt.sensor || 0), sig, thrust: cnt.engine || 0, lasers: cnt.laser || 0, armour: 2 * (cnt.armour || 0), shields: cnt.shield || 0, pd: cnt.point_defence || 0, hold: 3 * (cnt.magazine || 0), link: cnt.comms ? 12 : 4 };
}
function connected(cells) {
  if (!cells.length) return true;
  const set = new Set(cells.map(K)), seen = new Set([K(cells[0])]), st = [cells[0]];
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  while (st.length) { const c = st.pop(); for (const d of DIRS) { const k = K([c[0] + d[0], c[1] + d[1]]); if (set.has(k) && !seen.has(k)) { seen.add(k); st.push([c[0] + d[0], c[1] + d[1]]); } } }
  return seen.size === cells.length;
}
function validate(hull, load, multiCoreOk) {
  const pr = [], P = D.parts, st = shipStats(hull, load);
  hull.forEach((s, i) => {
    if ((s.bays || []).length > 3) pr.push(`segment [${s.at}] has ${(s.bays || []).length} bay parts; the limit is 3.`);
    if ((s.mounts || []).length > 3) pr.push(`segment [${s.at}] has ${(s.mounts || []).length} mount parts; the limit is 3.`);
  });
  if (st.n > D.world.segments.max_per_ship) pr.push(`${st.n} segments; the limit is ${D.world.segments.max_per_ship}.`);
  if (!connected(hull.map((s) => s.at))) pr.push('the segments are not all joined together.');
  const cores = st.cnt.core || 0;
  if (cores !== 1 && !(multiCoreOk && cores > 1)) pr.push(`needs exactly one core; it has ${cores}.`);
  if ((st.cnt.coupling || 0) < st.n - 1) pr.push(`${st.n} segments need ${st.n - 1} couplings; it has ${st.cnt.coupling || 0}.`);
  const loaded = Object.values(load || {}).reduce((a, b) => a + b, 0);
  if (loaded > st.hold) pr.push(`carries ${loaded} munitions but its magazines hold ${st.hold}.`);
  if (loaded && !st.cnt.launcher) pr.push('carries munitions but has no launcher.');
  return pr;
}
function drawShip(svg, hull, opts = {}) {
  svg.innerHTML = '';
  const S = opts.size || 46, side = opts.side || 'h';
  const pts = hull.map((s) => hx(s.at[0], s.at[1], S));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const pad = S * 1.15;
  const minx = Math.min(...xs) - pad, maxx = Math.max(...xs) + pad, miny = Math.min(...ys) - pad, maxy = Math.max(...ys) + pad;
  svg.setAttribute('viewBox', `${minx} ${miny} ${maxx - minx} ${maxy - miny}`);
  const col = side === 'w' ? '#ff5fc8' : '#7fd8f0', col2 = side === 'w' ? '#9b6bff' : '#2fe0b0';
  const defs = el('defs', {}, svg);
  const gid = 'g' + Math.random().toString(36).slice(2, 8);
  const rg = el('radialGradient', { id: gid }, defs);
  el('stop', { offset: '0', 'stop-color': col2, 'stop-opacity': .22 }, rg); el('stop', { offset: '1', 'stop-color': col, 'stop-opacity': .05 }, rg);
  const big = S >= 30, sc = S * .97;
  hull.forEach((s, i) => {
    const [x, y] = pts[i];
    const g = el('g', { class: 'seg', 'data-i': i, style: opts.onPick ? 'cursor:pointer' : '' }, svg);
    if (opts.onPick) { g.setAttribute('tabindex', 0); g.setAttribute('role', 'button'); g.setAttribute('aria-label', `segment ${s.at}: ${[...(s.bays || []), ...(s.mounts || [])].join(', ') || 'empty'}`); }
    const sel = opts.sel === i;
    el('polygon', { points: hexPts(x, y, sc), fill: s.wrecked ? '#1c2230' : `url(#${gid})`, stroke: 'none' }, g);
    const cell = (c, p, kind) => {
      const fill = p ? partCol(p, side) : 'none';
      const poly = el('polygon', { points: SKG.polyOf(c.pts, sc, [x, y]), fill, 'fill-opacity': p ? (kind === 'bay' ? .62 : .78) : 0, stroke: 'none' }, g);
      if (p === 'shield') poly.setAttribute('filter', `drop-shadow(0 0 ${S * .06}px ${partCol(p, side)})`);
      if (p) {
        const [cx, cy] = SKG.centroid(c.pts).map((v, k) => v * sc + [x, y][k]);
        if (big) el('text', { x: cx, y: cy + S * (kind === 'bay' ? .065 : .05), 'text-anchor': 'middle', 'font-size': S * (kind === 'bay' ? .17 : .14), 'font-weight': 800, fill: '#040812', text: (PART[p] || ['?'])[0] }, g);
        el('title', { text: pname(p) + (kind === 'bay' ? ' (bay · core cell)' : ' (mount · peripheral cell)') }, poly);
      }
    };
    (BAY_CELLS).forEach((c, j) => cell(c, (s.bays || [])[j], 'bay'));
    (MOUNT_CELLS).forEach((c, j) => cell(c, (s.mounts || [])[j], 'mount'));
    // extra parts beyond 3 (invalid designs) are still listed in the info panel
    el('path', { d: SKG.pathOf(LOGO_LINES.filter((l) => !LOGO.lines.outer.includes(l)), sc, [x, y]), fill: 'none', stroke: col, 'stroke-width': Math.max(.6, S * .025), 'stroke-opacity': .55, 'stroke-linejoin': 'round' }, g);
    el('polygon', { points: hexPts(x, y, sc), fill: 'none', stroke: sel ? '#5ff7ff' : col, 'stroke-width': sel ? Math.max(2, S * .06) : Math.max(1, S * .035), 'stroke-opacity': sel ? 1 : .85, filter: sel ? `drop-shadow(0 0 ${S * .1}px #5ff7ff)` : null }, g);
    if (opts.onPick) { g.addEventListener('click', () => opts.onPick(i)); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onPick(i); } }); }
  });
  return svg;
}
function initShips() {
  const onion = $('#onion'), layers = {};
  for (const [k, p] of Object.entries(D.parts)) (layers[p.layer] = layers[p.layer] || []).push(k);
  const lc = { 1: '#9fe8ff', 2: '#8aa0b4', 3: '#5ff7ff', 4: '#56b8ff', 5: '#2fe0b0', 6: '#e6f6ff' };
  const ln = { 1: 'outermost: hit first', 6: 'the heart: hit last' };
  Object.keys(layers).sort((a, b) => a - b).forEach((L) => {
    const d = document.createElement('div'); d.style.setProperty('--c', lc[L]); d.style.marginLeft = (L - 1) * 10 + 'px';
    d.innerHTML = `<b>${L}</b><span>${layers[L].map(pname).join(', ')}</span>${ln[L] ? `<small style="margin-left:auto;color:var(--mute)">${ln[L]}</small>` : ''}`;
    onion.appendChild(d);
  });
  // anatomy
  const an = $('#anatomy');
  const seg = [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['shield', 'laser', 'armour'] }];
  const S = 92, cx0 = 210, cy0 = 150;
  const tmp = el('svg', { x: cx0 - 1.25 * S, y: cy0 - 1.25 * S, width: 2.5 * S, height: 2.5 * S }, an); drawShip(tmp, seg, { size: S });
  const C = (c) => { const p = SKG.centroid(c.pts); return [cx0 + p[0] * S * .97, cy0 + p[1] * S * .97]; };
  const lab = (pt, tx, ty, t, c, anchor) => { el('line', { x1: pt[0], y1: pt[1], x2: tx, y2: ty, stroke: c, 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }, an); el('circle', { cx: pt[0], cy: pt[1], r: 2.5, fill: c }, an); el('text', { x: tx + (anchor === 'start' ? 5 : -5), y: ty + 4, 'text-anchor': anchor, 'font-size': 13, 'font-weight': 600, fill: c, text: t }, an); };
  lab(C(BAY_CELLS[0]), 112, 60, 'bay · core', PART.core[1], 'end');
  lab(C(BAY_CELLS[1]), 312, 60, 'bay · engine', PART.engine[1], 'start');
  lab(C(BAY_CELLS[2]), 300, 262, 'bay · sensor', PART.sensor[1], 'start');
  lab(C(MOUNT_CELLS[0]), 130, 22, 'mount · shield', PART.shield[1], 'end');
  lab(C(MOUNT_CELLS[1]), 318, 200, 'mount · laser', PART.laser[1], 'start');
  lab(C(MOUNT_CELLS[2]), 104, 214, 'mount · armour', PART.armour[1], 'end');
  el('text', { x: cx0, y: 292, 'text-anchor': 'middle', 'font-size': 12, fill: '#7f93ad', text: 'core hexagons = bays (inside) · tip rhombi = mounts (outside)' }, an);
  // parts table
  const T = $('#partsTable');
  T.innerHTML = '<tr><th>Part</th><th>Slot</th><th>Layer</th><th>Cost</th><th>HP</th><th>What it does</th></tr>' + Object.entries(D.parts).map(([k, p]) => {
    const [ab, c] = PART[k];
    const fx = [p.required ? 'required' : '', p.sensor_range ? `sensor ${p.sensor_range}` : '', p.link_range ? `link ${p.link_range}` : '', p.thrust ? `thrust +${p.thrust}` : '', p.adds_range ? `range +${p.adds_range}` : '', p.hides ? `signature −${p.hides}` : '', p.flare_reduction ? `flare −${p.flare_reduction}` : '', p.holds ? `holds ${p.holds}` : '', p.couples ? 'couples' : '', p.hits ? `${p.hits} hits · range ${p.range} · −1 hit every ${p.loses_1_hit_every}` : '', p.stops_per_round ? `stops ${p.stops_per_round}/round` : '', p.recharges ? 'recharges' : '', p.launches ? 'launches' : ''].filter(Boolean).map((x) => `<span class="tag">${x}</span>`).join('');
    return `<tr><td><span class="chip"><span class="dot" style="--c:${c}"></span><b>${pname(k)}</b></span></td><td>${p.slot}</td><td class="mono">${p.layer}</td><td class="mono">${p.cost}</td><td class="mono">${p.hp || 1}</td><td>${fx}<div style="font-size:13px;color:var(--mute)">${esc(p.note)}</div></td></tr>`;
  }).join('');
  initExplorer();
}
let EXP = null;
function shipCatalog() {
  const L = [];
  D.fleet.forEach((s) => L.push({ id: 'fleet:' + s.name, label: `${s.name}${s.flagship ? ' ★' : ''} (skirmish fleet)`, hull: s.hull, load: s.load, side: 'h', src: 'rules/fleets_v0.4.yaml' }));
  const weave = /^(seed|twin|husk|bloom)/;
  D.cships.forEach((s) => L.push({ id: 'camp:' + s.key, label: `${s.key}${s.flagship ? ' ★' : ''} (campaign)`, hull: s.hull, load: s.load, side: weave.test(s.key) ? 'w' : 'h', src: 'beta/campaign/ships.yaml', joined: s.joined || (s.stats.parts.core > 1) }));
  return L;
}
function initExplorer() {
  const cat = shipCatalog(), pick = $('#shipPick');
  cat.forEach((s) => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.label; pick.appendChild(o); });
  const load = (id) => {
    const s = cat.find((x) => x.id === id);
    EXP = { s, hull: JSON.parse(JSON.stringify(s.hull)), sel: s.hull.findIndex((h) => (h.bays || []).includes('core')) };
    if (EXP.sel < 0) EXP.sel = 0;
    render();
  };
  const render = () => {
    const { s, hull } = EXP;
    drawShip($('#shipSvg'), hull, { size: 46, side: s.side, sel: EXP.sel, onPick: (i) => { EXP.sel = i; render(); } });
    const st = shipStats(hull, s.load);
    const box = (v, l) => `<div class="stat"><b>${v}</b><small>${l}</small></div>`;
    $('#shipStats').innerHTML = box(st.n, 'segments') + box(st.cost, 'cost') + box(st.sensor, 'sensor') + box(st.sig, 'signature') + box(st.thrust, 'thrust') + box(st.lasers, 'lasers') + box(st.shields + '/' + st.armour, 'shield/armour hp') + box(Object.entries(s.load || {}).map(([k, v]) => v + ' ' + k.replace('seeker_drone', 'drone')).join(', ') || '—', 'load');
    const pr = validate(hull, s.load, s.joined);
    const ul = $('#shipProblems');
    ul.className = 'problems' + (pr.length ? '' : ' ok');
    ul.innerHTML = pr.length ? pr.map((p) => `<li>${esc(p)}</li>`).join('') : `<li>✓ valid under rules/world_v0.4.yaml${s.joined ? ' (grafted: several cores allowed in the campaign)' : ''}</li>`;
    const seg = hull[EXP.sel];
    const row = (p, slot, j) => `<div class="partrow"><span><span class="dot" style="--c:${partCol(p, s.side)}"></span> ${pname(p)} <small style="color:var(--dim)">${slot} · layer ${D.parts[p].layer} · ${D.parts[p].cost} pts</small></span><button data-slot="${slot}" data-j="${j}" aria-label="Remove ${pname(p)}">✕</button></div>`;
    $('#segInfo').innerHTML = seg ? `<h4 style="margin-bottom:6px">Segment [${seg.at}] ${seg.at[0] === 0 && seg.at[1] === 0 ? '· origin' : ''}</h4>` +
      ((seg.bays || []).map((p, j) => row(p, 'bays', j)).join('') + (seg.mounts || []).map((p, j) => row(p, 'mounts', j)).join('') || '<p class="src">empty segment</p>') +
      `<p class="src" style="margin:8px 0 0">${(seg.bays || []).length}/3 bays · ${(seg.mounts || []).length}/3 mounts · from ${s.src}</p>` : '';
    $$('#segInfo button').forEach((b) => b.addEventListener('click', () => { seg[b.dataset.slot].splice(+b.dataset.j, 1); render(); }));
  };
  const pal = $('#palette');
  Object.entries(D.parts).forEach(([k, p]) => {
    const b = document.createElement('button'); b.className = 'ghost'; b.innerHTML = `<span class="dot" style="--c:${PART[k][1]}"></span> ${pname(k)}`;
    b.addEventListener('click', () => { const seg = EXP.hull[EXP.sel]; const sl = p.slot === 'bay' ? 'bays' : 'mounts'; seg[sl] = seg[sl] || []; seg[sl].push(k); render(); });
    pal.appendChild(b);
  });
  pick.addEventListener('change', () => load(pick.value));
  $('#resetShip').addEventListener('click', () => load(pick.value));
  window.openInBuilder = (id) => { pick.value = id; load(id); document.getElementById('builder').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); };
  load(cat.find((x) => x.id === 'camp:kestrel@ch1') ? 'camp:kestrel@ch1' : cat[0].id);
  pick.value = EXP.s.id;
}
function shipArt(key) {
  const id = key.split('@')[0], ch = key.split('@')[1] || '';
  if (id === 'kestrel') return ch === 'ch5' ? 'kestrel_grafted' : (ch === 'ch3' || ch === 'ch4a') ? 'kestrel_refit' : 'kestrel';
  const have = ['bloom', 'finch', 'halcyon', 'husk_1', 'husk_2', 'husk_3', 'kite', 'seed', 'sparrow', 'tern', 'twin', 'twin_a', 'twin_b', 'wren'];
  if (id === 'seed_a' || id === 'seed_b') return 'seed';
  return have.includes(id) ? id : null;
}
function shipCard(name, hull, load, stats, side, flag, src, id, art) {
  const d = document.createElement('div'); d.className = 'card shipcard glow ' + (side === 'w' ? 'side-w' : 'side-h'); d.style.cursor = 'pointer';
  d.tabIndex = 0; d.setAttribute('role', 'button'); d.setAttribute('aria-label', `Open ${name} in the ship builder`);
  const kv = (v, l) => `<div>${l}<br><b>${v}</b></div>`;
  d.innerHTML = (art ? `<div class="art" role="img" aria-label="${esc(name)} concept art" style="background-image:url(img/ships/${art}.webp)"></div>` : '') +
    `<div class="row" style="justify-content:space-between"><h3 style="margin:0">${esc(name)}</h3><span>${flag ? '<span class="tag" style="color:var(--neon)">★ flagship</span>' : ''}<span class="tag" style="color:${side === 'w' ? '#ff8fd6' : '#9fd8ff'};border-color:${side === 'w' ? 'rgba(255,95,200,.45)' : 'rgba(127,216,240,.4)'}">${side === 'w' ? 'Weave' : 'human'}</span></span></div>` +
    `<svg class="mini" role="img" aria-label="${esc(name)} hull layout"></svg>` +
    `<div class="kv">${kv(stats.n, 'segments')}${kv(stats.cost, 'cost')}${kv(stats.thrust, 'thrust')}${kv(stats.sensor, 'sensor')}${kv(stats.sig, 'signature')}${kv(stats.lasers, 'lasers')}${kv(stats.shields, 'shields')}${kv(stats.armour, 'armour hp')}${kv(Object.entries(load || {}).map(([k, v]) => v + ' ' + k.replace('seeker_drone', 'drone')).join(', ') || '—', 'load')}</div>` +
    `<p class="src" style="margin:0">${src}</p>`;
  drawShip($('svg.mini', d), hull, { size: 22, side });
  const go = () => window.openInBuilder(id);
  d.addEventListener('click', go); d.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  return d;
}
function initFleets() {
  const fc = $('#fleetCards');
  D.fleet.forEach((s) => fc.appendChild(shipCard(s.name, s.hull, s.load, shipStats(s.hull, s.load), 'h', s.flagship, `rules/fleets_v0.4.yaml · ${s.flagship ? 'the flagship' : 'escort'}`, 'fleet:' + s.name, s.name === 'Blob B' ? null : null)));
  const note = document.createElement('div'); note.className = 'callout'; note.style.gridColumn = '1/-1';
  const tot = D.fleet.reduce((a, s) => a + shipStats(s.hull, s.load).cost, 0);
  note.innerHTML = `Each player fields both Blobs plus <b>2 mines</b> (5 each): <b>${tot} + 10 = ${tot + 10}</b> of the ${D.budget}-point budget. Player 2 is a mirrored copy of Player 1 (<code>copy_of</code>, <code>mirror_ships</code>, <code>mirror_deployment</code>).`;
  fc.appendChild(note);
  const hc = $('#hullCards'), filt = $('#hullFilter');
  const weave = /^(seed|twin|husk|bloom)/;
  const cards = D.cships.map((s) => {
    const side = weave.test(s.key) ? 'w' : 'h';
    const c = shipCard(s.key, s.hull, s.load, shipStats(s.hull, s.load), side, s.flagship, `ships.yaml › ${s.key}${s.joined ? ' · grafted' : ''}`, 'camp:' + s.key, shipArt(s.key));
    c.dataset.side = side; c.dataset.ch = s.key.split('@')[1] || ''; hc.appendChild(c); return c;
  });
  const F = [['all', 'All'], ['h', 'Humans'], ['w', 'The Weave'], ['ch1', 'ch1'], ['ch2', 'ch2'], ['ch3', 'ch3'], ['ch4a', 'ch4a'], ['ch5', 'ch5']];
  F.forEach(([v, l], i) => {
    const b = document.createElement('button'); b.className = 'ghost'; b.textContent = l; b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    b.addEventListener('click', () => { $$('button', filt).forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); cards.forEach((c) => { c.style.display = v === 'all' || c.dataset.side === v || c.dataset.ch === v ? '' : 'none'; }); });
    filt.appendChild(b);
  });
}
