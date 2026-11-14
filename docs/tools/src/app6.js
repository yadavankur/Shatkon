/* ---------- SHATKON motif system, animated hero mark, geometry section ---------- */
const MR = 100; // mark radius in svg units (viewBox about -115..115)
const MCOL = { ice: '#cfe8ff', cyan: '#7fd8f0', mint: '#2fe0b0', blue: '#4a8cff', teal: '#19c3b3', neon: '#5ff7ff', pink: '#ff5fc8', purple: '#9b6bff', amber: '#d9a441' };
let _uid = 0; const uid = (p) => p + (++_uid);
const gradDef = (id, a = MCOL.ice, b = MCOL.cyan, c = MCOL.mint) => `<linearGradient id="${id}" x1="-80" y1="-100" x2="80" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`;
const glowDef = (id, sd = 2.4) => `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${sd}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
const poly = (pts, attrs = '', s = MR) => `<polygon points="${SKG.polyOf(pts, s)}" ${attrs}/>`;
const starPolys = (g) => g.cells.rh.map((c) => c.pts);
// recursion: replace the diameters (the only lines inside the inner hexagon) with a k-scaled copy, depth times
function recLines(g, depth, scale = 1) {
  const L = [...g.lines.outer, ...g.lines.tips, ...g.lines.shorts].map((l) => l.map((p) => [p[0] * scale, p[1] * scale]));
  if (depth <= 0) return L.concat(g.lines.diam.map((l) => l.map((p) => [p[0] * scale, p[1] * scale])));
  return L.concat(recLines(g, depth - 1, scale * g.k));
}
/* motif variants: returns inner svg markup for viewBox -115 -115 230 230 */
function motif(variant, o = {}) {
  const k = variant === 'k25' ? 0.25 : variant === 'k55' ? 0.55 : 0.4, g = SKG.build(k);
  const enemy = variant === 'enemy' || o.enemy;
  const gid = uid('mg'), sw = o.sw || 7;
  const [a, b, c] = enemy ? ['#ffd6f2', MCOL.pink, MCOL.purple] : [MCOL.ice, MCOL.cyan, MCOL.mint];
  let fill = '', lines = SKG.allLines(g, false), node = true, lineOp = 1;
  const F = (pts, col, op) => poly(pts, `fill="${col}" fill-opacity="${op}"`);
  if (variant === 'star') { lines = null; fill = starPolys(g).map((p) => poly(p, `fill="${MCOL.mint}" fill-opacity=".16" stroke="url(#${gid})" stroke-width="${sw}" stroke-linejoin="round"`)).join(''); }
  if (variant === 'cube') g.cells.core.forEach((K, i) => { const j = [1, 3, 5][i]; fill += F(g.cells.hexOuter[i].pts, b, .5) + F(g.cells.rh[j - 1].pts, b, .26) + F(g.cells.rh[j].pts, b, .1); });
  if (variant === 'core') g.cells.core.forEach((K, i) => { fill += F(K.pts, [MCOL.blue, MCOL.teal, MCOL.cyan][i], .32); });
  if (variant === 'tips') g.cells.tip.forEach((T) => { fill += F(T.pts, MCOL.ice, .32); });
  if (variant === 'hex3d') { fill = F(g.cells.hexOuter[0].pts, MCOL.neon, .3) + poly(g.cells.hexOuter[0].pts, `fill="none" stroke="${MCOL.neon}" stroke-width="${sw * 1.1}" stroke-linejoin="round"`); lineOp = .45; }
  if (variant === 'inner') { fill = poly(g.I, `fill="${MCOL.neon}" fill-opacity=".18" stroke="${MCOL.neon}" stroke-width="${sw}" stroke-dasharray="10 8"`); lineOp = .6; }
  if (variant === 'recursion') lines = recLines(g, 2);
  if (o.hl !== undefined) { const cells = [...g.cells.tip, ...g.cells.rh, ...g.cells.hexOuter]; fill += F(cells[o.hl % 12].pts, o.hlc || MCOL.neon, .35); }
  return `<defs>${gradDef(gid, a, b, c)}</defs>${fill}${lines ? `<path d="${SKG.pathOf(lines, MR)}" fill="none" stroke="url(#${gid})" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${lineOp}"/>` : ''}${node ? `<circle r="${sw * 1.4}" fill="${enemy ? '#ffd6f2' : MCOL.neon}"/>` : ''}`;
}
const motifSvg = (variant, cls = 'km', o = {}) => `<svg class="${cls}" viewBox="-115 -115 230 230" aria-hidden="true"${o.style ? ` style="${o.style}"` : ''}>${motif(variant, o)}</svg>`;
const MOTIF_BY_SECTION = { geometry: 'star', quick: 'lines', modes: 'cube', board: 'inner', ships: 'core', fleets: 'tips', combat: 'hex3d', maps: 'k25', world: 'recursion', story: 'enemy', design: 'k55', glossary: 'star', roadmap: 'cube' };
function initMotifs() {
  // nav mark, star bullet
  const nm = $('#navMark'); if (nm) nm.innerHTML = motif('lines', { sw: 9 });
  const starUri = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-115 -115 230 230">${motif('star', { sw: 12 })}</svg>`);
  document.documentElement.style.setProperty('--star', `url("${starUri}")`);
  $$('section.sec').forEach((sec, i) => {
    const v = MOTIF_BY_SECTION[sec.id] || 'lines';
    const kk = $('.kicker', sec);
    if (kk) kk.insertAdjacentHTML('afterbegin', motifSvg(v, 'km'));
    sec.insertAdjacentHTML('afterbegin', motifSvg(v, 'wmk', { sw: 3, style: `transform:rotate(${(i % 2) * 30}deg)` }));
    if (i > 0) sec.insertAdjacentHTML('beforebegin', `<div class="divider" aria-hidden="true">${motifSvg(i % 3 === 0 ? 'cube' : i % 3 === 1 ? 'star' : 'hex3d', '', { sw: 9 })}</div>`);
  });
  $$('#toc a').forEach((a) => { const id = a.getAttribute('href').slice(1), i = $('i', a); if (i) i.innerHTML = motifSvg(MOTIF_BY_SECTION[id] || 'lines', 'km'); });
}
/* ---------- hero: the mark assembles ---------- */
function initHeroMark() {
  const svg = $('#heroMark'); if (!svg) return;
  const g = SKG.build(0.4);
  const P = (pts, cls) => `<polygon class="${cls}" pathLength="1" points="${SKG.polyOf(pts, MR)}"/>`;
  const outer = P(g.V, 'hm-l hm-outer');
  const star = starPolys(g).map((p) => P(p, 'hm-l hm-star')).join('');
  const hexes = g.cells.hexOuter.map((c) => P(c.pts, 'hm-l hm-hex')).join('');
  const all = SKG.pathOf(SKG.allLines(g, false), MR);
  svg.innerHTML = `<defs>${gradDef('hmG')}<filter id="hmBlur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="7"/></filter>${glowDef('hmGlow', 2.2)}<radialGradient id="hmN"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${MCOL.neon}"/><stop offset="1" stop-color="${MCOL.neon}" stop-opacity="0"/></radialGradient></defs>
  <path class="hm-glow" d="${all}" fill="none" stroke="${MCOL.cyan}" stroke-width="9" filter="url(#hmBlur)"/>
  <g fill="none" stroke="url(#hmG)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#hmGlow)">${outer}<g class="hm-bloom">${star}</g>${hexes}</g>
  <g fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round">${starPolys(g).map((p) => `<polygon class="hm-shim" pathLength="1" points="${SKG.polyOf(p, MR)}"/>`).join('')}</g>
  <circle class="hm-node" r="11" fill="url(#hmN)"/>`;
  const W = SKG.wordmark('SHATKON', { scale: 20 }), ws = $('#heroWord');
  ws.setAttribute('viewBox', `-6 -28 ${(W.width + 12).toFixed(1)} 56`);
  ws.innerHTML = `<defs><linearGradient id="wmG" x1="0" y1="0" x2="${W.width}" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${MCOL.ice}"/><stop offset=".55" stop-color="${MCOL.cyan}"/><stop offset="1" stop-color="${MCOL.mint}"/></linearGradient></defs><path class="wm-l" pathLength="1" d="${W.d}" fill="none" stroke="url(#wmG)" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"/>${W.nodes.map((n) => `<circle class="wm-n" cx="${n[0].toFixed(1)}" cy="${n[1].toFixed(1)}" r="3" fill="${MCOL.neon}"/>`).join('')}`;
}
/* ---------- geometry section ---------- */
const GEO_MODES = [
  ['all', 'Whole mark'], ['outer', 'Outer hexagon'], ['star', 'The flower'], ['hex3d', '3D hexagons'],
  ['designer', 'Core & periphery'], ['engine', 'Bays and mounts'], ['fine', 'All 12 cells'], ['flaw', 'Original (flaw)'],
];
const GEO_INFO = {
  all: '<h3>The mark</h3><p>One outer hexagon and 21 straight lines in three directions (vertical, +30°, −30°). The glowing node is the centre, where the six petals of the flower meet.</p>',
  outer: '<h3>Layer 1 · the outer hexagon</h3><p>The board tile and the ship segment: radius 1, pointy-top. Everything else sits at offsets of <b>0, ±0.4 and ±1</b> × the apothem, so the whole drawing fits on one small lattice.</p>',
  star: '<h3>Layer 2 · the flower</h3><p>Six rhombi (side 0.4, angles 60° and 120°) meet at the centre node and make a six-pointed star. This is the heart of the logo. The petal tips are the star points; the points between petals are the inner hexagon.</p>',
  hex3d: '<h3>Layer 3 · the 3D hexagons</h3><p>Around the flower sit three irregular hexagons (sides 0.4, 0.4, 0.2, repeating). Each is the light face of a cube; with its two neighbouring petals it reads as a block in 3D. The same cell repeats on each third of the logo, 120° apart. The dashed hexagon is the <b>hexagon inside the hexagon</b> (radius 0.4).</p>',
  designer: '<h3>Layer 4 · core &amp; periphery</h3><p>The designer\'s reading of the logo, and the one the ships are built on. <b>3 core hexagons</b> meet at the centre; each = one 3D hexagon + two petals. <b>3 peripheral tips</b> sit at the top and the two lower corners. 6 cells tile the hexagon exactly. The 6 petals and the 3 small hexagons aren\'t separate cells in this reading; the core hexagons absorb them.</p>',
  engine: '<h3>What the engine calls them</h3><p>Core hexagons hold the 3 <b>bays</b> (inside, layers 4–6). Tips hold the 3 <b>mounts</b> (outside, layers 1–3). Hits land on mounts first and on the heart last, just as the drawing suggests: the tips stick out, the core is wrapped round the centre.</p>',
  fine: '<h3>All 12 cells (corrected)</h3><p><b>3 tip rhombi</b> (side 0.6) + <b>6 petals</b> (side 0.4) + <b>3 irregular hexagons</b> (0.4/0.4/0.2). Their areas add up to exactly the hexagon\'s.</p>',
  flaw: '<h3>The original, flaw included</h3><p>In the original, the two lines from the bottom inner node run on to the outer edge and cut off <b>two triangles</b> (amber). That makes 14 cells instead of 12: 3 hexagons, 6 petals, the clean top tip, 2 clipped pentagons and 2 triangles.</p>',
};
function initGeometry() {
  const svg = $('#geoSvg'); if (!svg) return;
  const g = SKG.build(0.4), info = $('#geoInfo'), split = $('#geoSplit');
  let mode = 'designer', isSplit = false;
  const cellInfo = {};
  const engineName = { K5: 'bay · core', K1: 'bay · engine', K3: 'bay · sensor', T0: 'mount · shield', T2: 'mount · laser', T4: 'mount · armour' };
  const cpName = { K5: 'core', K1: 'core', K3: 'core', T0: 'periphery', T4: 'periphery', T2: 'periphery' };
  function cellsFor(m) {
    const L = [];
    const add = (pts, col, op, lab, inf, stroke) => L.push({ pts, col, op, lab, inf, stroke });
    if (m === 'star') g.cells.rh.forEach((c, i) => add(c.pts, MCOL.mint, .3, 'petal ' + (i + 1), 'Petal: a rhombus of side 0.4 with angles 60° and 120°.'));
    if (m === 'hex3d') g.cells.hexOuter.forEach((c, i) => { const j = [1, 3, 5][i]; add(c.pts, MCOL.ice, .42, '3D hexagon', 'The light face of a cube: sides 0.4, 0.4, 0.2 repeating, all angles 120°.', MCOL.neon); add(g.cells.rh[j - 1].pts, MCOL.cyan, .22, '', 'A petal working as the mid-tone side face of the cube.'); add(g.cells.rh[j].pts, MCOL.cyan, .08, '', 'A petal working as the dark side face of the cube.'); });
    if (m === 'designer') [...g.cells.core, ...g.cells.tip].forEach((c) => add(c.pts, SKG.CP[c.id], c.kind === 'core' ? .4 : .26, cpName[c.id], c.kind === 'core' ? 'Core hexagon: equiangular, sides 0.6/0.4/0.4 repeating. One 3D hexagon + two petals. Hosts a bay.' : 'Periphery: a rhombus of side 0.6 at a corner of the hexagon (the lower two read as squares). Hosts a mount.'));
    if (m === 'engine') [...g.cells.core, ...g.cells.tip].forEach((c) => { const p = engineName[c.id].split(' · ')[1].replace(' ', '_'); add(c.pts, PART[p] ? PART[p][1] : MCOL.cyan, .5, engineName[c.id], `${engineName[c.id]}: ${c.kind === 'core' ? 'inside the hull (layers 4–6)' : 'on the outside (layers 1–3)'}.`); });
    if (m === 'fine') { g.cells.tip.forEach((c) => add(c.pts, MCOL.ice, .3, 'tip', 'Tip rhombus, side 0.6.')); g.cells.rh.forEach((c) => add(c.pts, MCOL.mint, .3, '', 'Petal, side 0.4.')); g.cells.hexOuter.forEach((c) => add(c.pts, MCOL.blue, .3, 'hexagon', 'Irregular hexagon, sides 0.4/0.4/0.2.')); }
    if (m === 'flaw') g.flawTris.forEach((t) => add(t, MCOL.amber, .75, '', 'The flaw: a triangle with side 0.2, cut off by a line that should have stopped at the star point.', MCOL.amber));
    return L;
  }
  const modes = $('#geoModes');
  GEO_MODES.forEach(([id, label]) => { const b = document.createElement('button'); b.className = 'ghost'; b.textContent = label; b.dataset.m = id; b.addEventListener('click', () => { mode = id; render(); }); modes.appendChild(b); });
  function render() {
    $$('button', modes).forEach((b) => b.setAttribute('aria-pressed', b.dataset.m === mode ? 'true' : 'false'));
    const flaw = mode === 'flaw';
    const lines = SKG.allLines(g, flaw);
    const cells = cellsFor(mode);
    let h = `<defs>${gradDef('geoG')}${glowDef('geoGl', 2)}</defs>`;
    h += '<g class="lay">' + cells.map((c, i) => { const ct = SKG.centroid(c.pts); return `<g class="cellp" data-i="${i}" tabindex="0" role="button" aria-label="${esc(c.lab || 'cell')}" data-dx="${(ct[0] * MR * .32).toFixed(1)}" data-dy="${(ct[1] * MR * .32).toFixed(1)}" style="fill:${c.col};fill-opacity:${c.op}">${poly(c.pts, c.stroke ? `stroke="${c.stroke}" stroke-width="2.2" stroke-linejoin="round"` : 'stroke="none"')}${c.lab ? `<text class="clab" x="${(ct[0] * MR).toFixed(1)}" y="${(ct[1] * MR + 3).toFixed(1)}" text-anchor="middle" font-size="${c.lab.length > 9 ? 7 : 8.5}" fill="#e8f6ff" style="fill-opacity:1">${esc(c.lab)}</text>` : ''}</g>`; }).join('') + '</g>';
    const lineOp = mode === 'all' ? 1 : mode === 'outer' ? .25 : .7;
    h += `<path d="${SKG.pathOf(lines, MR)}" fill="none" stroke="url(#geoG)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity="${lineOp}" filter="url(#geoGl)" pointer-events="none" class="geolines"/>`;
    if (mode === 'outer') h += poly(g.V, `fill="none" stroke="${MCOL.neon}" stroke-width="4.2" stroke-linejoin="round" filter="url(#geoGl)"`);
    if (mode === 'hex3d') h += poly(g.I, `fill="none" stroke="${MCOL.neon}" stroke-width="1.6" stroke-dasharray="5 4" pointer-events="none"`);
    if (flaw) h += g.flawTris.map((t) => { const c = SKG.centroid(t); return `<circle cx="${c[0] * MR}" cy="${c[1] * MR}" r="13" fill="none" stroke="${MCOL.amber}" stroke-width="1.6" stroke-dasharray="3 3"/>`; }).join('');
    h += `<circle r="5" fill="${MCOL.neon}" pointer-events="none"/>`;
    svg.innerHTML = h;
    info.innerHTML = GEO_INFO[mode];
    $$('.cellp', svg).forEach((el2) => {
      const c = cells[+el2.dataset.i];
      const show = () => { info.innerHTML = GEO_INFO[mode] + `<p class="src" style="margin:0">${esc(c.lab || 'cell')}: ${esc(c.inf || '')}</p>`; };
      el2.addEventListener('click', show); el2.addEventListener('focus', show); el2.addEventListener('mouseenter', show);
    });
    applySplit();
  }
  function applySplit() {
    split.setAttribute('aria-pressed', isSplit ? 'true' : 'false');
    split.textContent = isSplit ? '⇱ Put them back' : '⇲ Separate the cells';
    $$('.cellp', svg).forEach((c) => { c.style.transform = isSplit ? `translate(${c.dataset.dx}px,${c.dataset.dy}px)` : ''; });
    const gl = $('.geolines', svg); if (gl) { gl.style.transition = 'opacity .5s'; gl.style.opacity = isSplit ? '.12' : ''; }
  }
  split.addEventListener('click', () => { isSplit = !isSplit; applySplit(); });
  render();
  // scroll-triggered demo: core and peripherals separate, relabel as bays and mounts, then come back
  if (!RM) {
    let done = false;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting || done) return; done = true;
      setTimeout(() => { isSplit = true; applySplit(); }, 500);
      setTimeout(() => { mode = 'engine'; render(); }, 2200);
      setTimeout(() => { isSplit = false; applySplit(); }, 3800);
      setTimeout(() => { mode = 'designer'; render(); }, 5400);
    }), { threshold: .5 });
    io.observe(svg);
  }
  initIdeas(g); initFlaw(g); initKit(); initDesigner();
}
function initIdeas(g) {
  // 2D -> 3D: cube shading
  const cube = $('#ideaCube');
  cube.innerHTML = motif('cube', { sw: 3.2 });
  // hexagon in hexagon: rotor through the three 3D hexagons
  const hx3 = $('#ideaHex');
  const base = `<defs>${gradDef('ihG')}</defs><path d="${SKG.pathOf(SKG.allLines(g, false), MR)}" fill="none" stroke="url(#ihG)" stroke-width="3" stroke-linecap="round" opacity=".55"/>` + poly(g.I, `fill="${MCOL.neon}" fill-opacity=".1" stroke="${MCOL.neon}" stroke-width="2.4" stroke-dasharray="6 5"`);
  const hl = (j, op) => poly(g.cells.hexOuter[j].pts, `fill="${MCOL.ice}" fill-opacity="${op * .4}" stroke="${MCOL.neon}" stroke-width="3.4" stroke-linejoin="round" opacity="${op}"`);
  if (RM) hx3.innerHTML = base + [0, 1, 2].map((j) => hl(j, .7)).join('');
  else { let j = 0; const tick = () => { hx3.innerHTML = base + hl(j % 3, 1) + hl((j + 2) % 3, .25); j++; }; tick(); setInterval(tick, 1300); }
  // fractal zoom
  const z = $('#ideaZoom'), note = $('#zoomNote');
  const clip = SKG.polyOf(SKG.V, MR);
  z.innerHTML = `<defs>${gradDef('izG')}<clipPath id="izC"><polygon points="${clip}"/></clipPath></defs><g clip-path="url(#izC)"><path id="izP" fill="none" stroke="url(#izG)" stroke-width="2.6" stroke-linecap="round" vector-effect="non-scaling-stroke"/></g><polygon points="${clip}" fill="none" stroke="${MCOL.ice}" stroke-width="3"/><circle r="4" fill="${MCOL.neon}"/>`;
  const P = $('#izP');
  const frame = (zz) => { const L = []; for (let n = 0; n <= 3; n++) { const sc = Math.pow(g.k, n) * zz; const ls = n < 3 ? [...g.lines.outer, ...g.lines.tips, ...g.lines.shorts] : SKG.allLines(g, false); ls.forEach((l) => L.push(l.map((p) => [p[0] * sc, p[1] * sc]))); } P.setAttribute('d', SKG.pathOf(L, MR)); };
  if (RM) { frame(1); note.textContent = 'Reduced motion is on, so this shows three nested levels, without the zoom.'; return; }
  note.textContent = 'Zooming 2.5× every 3.5 s, three levels deep.';
  let vis = false; new IntersectionObserver((es) => { vis = es[0].isIntersecting; }).observe(z);
  const t0 = performance.now();
  const loop = (now) => { if (vis) { const ph = ((now - t0) / 3500) % 1; const e = ph < .5 ? 2 * ph * ph : 1 - Math.pow(-2 * ph + 2, 2) / 2; frame(Math.pow(1 / g.k, e)); } requestAnimationFrame(loop); };
  frame(1); requestAnimationFrame(loop);
}
function initFlaw(g) {
  const svg = $('#flawSvg'), bo = $('#flawOrig'), bf = $('#flawFix');
  const draw = (flaw) => {
    bo.setAttribute('aria-pressed', flaw); bf.setAttribute('aria-pressed', !flaw);
    let h = `<defs>${gradDef('flG')}</defs>`;
    h += g.flawTris.map((t) => poly(t, flaw ? `fill="${MCOL.amber}" fill-opacity=".8" stroke="${MCOL.amber}" stroke-width="1.5"` : `fill="${MCOL.mint}" fill-opacity=".12" stroke="none"`)).join('');
    h += `<path d="${SKG.pathOf(SKG.allLines(g, false), MR)}" fill="none" stroke="url(#flG)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (flaw) h += `<path d="${SKG.pathOf(g.flawLines, MR)}" fill="none" stroke="${MCOL.amber}" stroke-width="3.4" stroke-linecap="round"/>` + g.flawTris.map((t) => { const c = SKG.centroid(t); return `<circle cx="${c[0] * MR}" cy="${c[1] * MR}" r="14" fill="none" stroke="${MCOL.amber}" stroke-width="1.6" stroke-dasharray="3 3"><animate attributeName="r" values="12;16;12" dur="2s" repeatCount="indefinite"/></circle>`; }).join('') + `<text x="0" y="112" text-anchor="middle" font-size="10" fill="${MCOL.amber}">original: 23 lines · 14 cells · mirror symmetry only</text>`;
    else h += `<text x="0" y="112" text-anchor="middle" font-size="10" fill="${MCOL.mint}">corrected: 21 lines · 12 cells · 120° symmetric</text>`;
    h += `<circle r="5" fill="${MCOL.neon}"/>`;
    svg.innerHTML = h;
    if (RM) $$('animate', svg).forEach((a) => a.remove());
  };
  bo.addEventListener('click', () => draw(true)); bf.addEventListener('click', () => draw(false)); draw(true);
}
function initKit() {
  const kit = $('#motifKit');
  [['lines', 'the mark'], ['star', 'the flower · bullet, favicon'], ['hex3d', '3D hexagon'], ['cube', 'cube shading'], ['core', 'core'], ['tips', 'peripherals'], ['inner', 'hexagon in hexagon'], ['recursion', 'recursion'], ['enemy', 'the Weave'], ['k25', 'k = 0.25'], ['k55', 'k = 0.55']]
    .forEach(([v, l]) => kit.insertAdjacentHTML('beforeend', `<div class="mk-tile">${motifSvg(v, '', { sw: 6 })}${l}</div>`));
}
function initDesigner() {
  const svg = $('#flowerSvg'); const I = (id) => $('#' + id);
  const ctl = ['fk', 'fr', 'fd', 'fs', 'ffill', 'fpal', 'fglow'];
  const def = { fk: '0.4', fr: '0', fd: '0', fs: '3', ffill: 'lines', fpal: 'team' };
  function draw() {
    const k = +I('fk').value, rot = +I('fr').value, depth = +I('fd').value, sw = +I('fs').value, fm = I('ffill').value, pal = I('fpal').value, glow = I('fglow').checked;
    I('fkOut').textContent = k.toFixed(2); I('frOut').textContent = rot + '°'; I('fdOut').textContent = depth; I('fsOut').textContent = sw.toFixed(1);
    const g = SKG.build(k);
    const C = pal === 'enemy' ? ['#ffd6f2', MCOL.pink, MCOL.purple] : pal === 'mono' ? ['#ffffff', MCOL.ice, '#a9c8e6'] : [MCOL.ice, MCOL.cyan, MCOL.mint];
    const F = (pts, col, op, sc = 1) => `<polygon points="${SKG.polyOf(pts, MR * sc)}" fill="${col}" fill-opacity="${op}"/>`;
    let fills = '';
    for (let n = 0; n <= depth; n++) {
      const sc = Math.pow(k, n);
      if (fm === 'star') g.cells.rh.forEach((c) => { fills += F(c.pts, C[2], .25, sc); });
      if (fm === 'cube') g.cells.hexOuter.forEach((c, i) => { const j = [1, 3, 5][i]; fills += F(c.pts, C[1], .5, sc) + F(g.cells.rh[j - 1].pts, C[1], .25, sc) + F(g.cells.rh[j].pts, C[1], .08, sc); });
      if (fm === 'hex3d') g.cells.hexOuter.forEach((c) => { fills += F(c.pts, C[0], .35, sc); });
      if (fm === 'core') { g.cells.core.forEach((c, i) => { fills += F(c.pts, pal === 'enemy' ? [MCOL.purple, MCOL.pink, '#c58cff'][i] : [MCOL.blue, MCOL.teal, MCOL.cyan][i], .3, sc); }); g.cells.tip.forEach((c) => { fills += F(c.pts, C[0], .14, sc); }); }
      if (fm === 'lines' || n === depth) break;
    }
    const L = recLines(g, depth);
    svg.innerHTML = `<defs>${gradDef('fdG', ...C)}${glowDef('fdGl', 2.4)}</defs><rect x="-120" y="-120" width="240" height="240" fill="#040812"/><g transform="rotate(${rot})">${fills}<path d="${SKG.pathOf(L, MR)}" fill="none" stroke="url(#fdG)" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${glow ? 'filter="url(#fdGl)"' : ''}/><circle r="${sw * 1.6}" fill="${pal === 'enemy' ? '#ffd6f2' : MCOL.neon}"/></g>`;
  }
  ctl.forEach((id) => I(id).addEventListener('input', draw));
  I('freset').addEventListener('click', () => { Object.entries(def).forEach(([k, v]) => { I(k).value = v; }); I('fglow').checked = true; draw(); });
  I('fdl').addEventListener('click', () => {
    const s = svg.outerHTML.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'image/svg+xml' })); a.download = `shatkon-flower-k${(+I('fk').value).toFixed(2)}.svg`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  draw();
}
