/* ---------- maps ---------- */
function drawMap(svg, m) {
  const R = m.radius, S = Math.max(4, 120 / R);
  const w = SQ3 * S * (2 * R + 1) + 8, h = 1.5 * S * 2 * R + 2 * S + 8;
  svg.setAttribute('viewBox', `${-w / 2} ${-h / 2} ${w} ${h}`);
  const tmap = new Map();
  m.terrain.forEach((t) => t.cells.forEach((c) => tmap.set(K(c), t.type)));
  const z1 = new Set((m.zones.player_1_home || []).map(K)), z2 = new Set((m.zones.player_2_home || []).map(K));
  const other = new Map();
  Object.entries(m.zones).forEach(([n, cells]) => { if (!/player_\d_home/.test(n)) cells.forEach((c) => other.set(K(c), n)); });
  const obj = m.objective ? new Set(disc(m.objective.at, m.objective.radius).map(K)) : new Set();
  const g = el('g', {}, svg);
  for (const c of disc([0, 0], R)) {
    const [x, y] = hx(c[0], c[1], S), k = K(c), t = tmap.get(k);
    let fill = 'rgba(255,255,255,.04)';
    if (z1.has(k)) fill = 'rgba(79,184,255,.22)'; else if (z2.has(k)) fill = 'rgba(255,95,200,.22)'; else if (other.has(k)) fill = 'rgba(47,224,176,.10)';
    if (obj.has(k)) fill = 'rgba(127,216,240,.35)';
    if (t === 'nebula') fill = 'rgba(25,150,150,.32)';
    if (t === 'asteroid') fill = '#3a4658';
    el('polygon', { points: hexPts(x, y, S * .95), fill, stroke: 'rgba(140,200,230,.12)', 'stroke-width': .6 }, g);
  }
  m.deploy.forEach((d) => {
    const col = d.side === 0 ? '#4fb8ff' : '#ff5fc8';
    d.cells.forEach((c) => { const [x, y] = hx(c[0], c[1], S); if (d.mine) el('text', { x, y: y + S * .35, 'text-anchor': 'middle', 'font-size': S * 1.1, fill: col, text: '◆' }, g); else el('polygon', { points: hexPts(x, y, S * .9), fill: col, 'fill-opacity': .85, stroke: '#fff', 'stroke-width': .5 }, g); });
    if (!d.mine && S >= 9) { const [x, y] = hx(d.cells[0][0], d.cells[0][1], S); el('text', { x, y: y - S * 1.1, 'text-anchor': 'middle', 'font-size': Math.max(7, S * .75), fill: col, 'font-weight': 700, stroke: '#040812', 'stroke-width': 2, 'paint-order': 'stroke', text: d.label }, g); }
  });
  if (m.objective) { const [x, y] = hx(m.objective.at[0], m.objective.at[1], S); el('text', { x, y: y + S * .4, 'text-anchor': 'middle', 'font-size': S * 1.3, fill: '#5ff7ff', text: '◎' }, g); }
}
function initMaps() {
  const grid = $('#mapGrid');
  D.maps.forEach((m) => {
    const d = document.createElement('div'); d.className = 'card mapcard';
    const ast = m.terrain.filter((t) => t.type === 'asteroid').reduce((a, t) => a + t.cells.length, 0), neb = m.terrain.filter((t) => t.type === 'nebula').reduce((a, t) => a + t.cells.length, 0);
    const zones = Object.keys(m.zones).filter((z) => !/player_\d_home/.test(z));
    d.innerHTML = `<div class="row" style="justify-content:space-between"><h3>${esc(m.title ? m.chapter + ' · ' + m.name : m.name)}</h3><span class="tag ${m.kind === 'campaign' ? 'beta' : ''}">${m.kind === 'campaign' ? 'campaign' : 'rules'}</span></div>
      <p class="src" style="margin:0 0 8px">${esc(m.file)}</p><svg role="img" aria-label="${esc(m.name)} map, radius ${m.radius}"></svg>
      <p style="font-size:13px;margin:8px 0 0;color:var(--mute)">radius <b style="color:#fff">${m.radius}</b> · ${ast} asteroid hexes · ${neb} nebula hexes${zones.length ? ' · zones: ' + zones.map((z) => `<code>${esc(z)}</code>`).join(' ') : ''}${m.deploy.length ? '' : ' · deployment chosen in play'}${m.kind === 'rules' && m.deploy.length ? ' · fleet file deployment' : ''}</p>`;
    drawMap($('svg', d), m); grid.appendChild(d);
  });
  const ob = D.maps.find((m) => m.objective).objective;
  $('#beaconTxt').innerHTML = `A beacon sits at <code>[${ob.at}]</code> with radius <b>${ob.radius}</b>. If you start your turn with a ship touching it and no enemy ship touching it, you score <b>1 point</b>. First to <b>${ob.points_to_win}</b> wins. <code>reveals_holder: ${ob.reveals_holder}</code>: holding it gives away your position. <code>decides_turn_limit: ${ob.decides_turn_limit}</code>: if the turn limit arrives, the score decides the game.`;
}

/* ---------- campaign + world map ---------- */
function initWorld() {
  const svg = $('#campSvg'), W = 520, H = 560;
  const nodes = D.campaign.nodes, pos = {};
  nodes.forEach((n) => { pos[n.id] = [n.at[0] * W, n.at[1] * H]; });
  const defs = el('defs', {}, svg);
  defs.innerHTML = '<linearGradient id="edge" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#7fd8f0"/><stop offset="1" stop-color="#ff5fc8"/></linearGradient><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="#cfe8ff"/></marker>';
  for (let i = 0; i < 70; i++) el('circle', { cx: Math.random() * W, cy: Math.random() * H, r: Math.random() * 1.2 + .2, fill: '#fff', opacity: Math.random() * .6 + .1 }, svg);
  nodes.forEach((n) => (n.next || []).forEach((m) => {
    const a = pos[n.id], b = pos[m]; if (!b) return;
    const lock = nodes.find((x) => x.id === m).locked;
    el('line', { x1: a[0], y1: a[1] - 26, x2: b[0], y2: b[1] + 30, stroke: lock ? '#666' : '#cfe8ff', 'stroke-width': 2, 'stroke-dasharray': lock ? '5 5' : null, 'marker-end': 'url(#arr)', opacity: .8 }, svg);
  }));
  const chById = Object.fromEntries(D.chapters.map((c) => [c.id, c]));
  nodes.forEach((n) => {
    const [x, y] = pos[n.id], lock = !!n.locked;
    const g = el('g', {}, svg);
    el('polygon', { points: hexPts(x, y, 28), fill: lock ? '#0d1420' : 'rgba(127,216,240,.15)', stroke: lock ? '#666' : '#cfe8ff', 'stroke-width': 2 }, g);
    el('text', { x, y: y + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, fill: lock ? '#888' : '#fff', text: n.id }, g);
    el('text', { x: x + (n.at[0] < .4 ? -36 : 36), y: y - 2, 'text-anchor': n.at[0] < .4 ? 'end' : 'start', 'font-size': 14, 'font-weight': 700, fill: lock ? '#888' : '#dff2ff', text: n.title }, g);
    const sub = lock ? (n.locked_text || 'locked') : n.fork_scene ? 'fork: ' + n.fork_scene : chById[n.id] ? chById[n.id].map.replace('maps/', '').replace('.yaml', '') : '';
    el('text', { x: x + (n.at[0] < .4 ? -36 : 36), y: y + 14, 'text-anchor': n.at[0] < .4 ? 'end' : 'start', 'font-size': 11, fill: '#7f93ad', text: sub }, g);
  });
  el('text', { x: W / 2, y: 26, 'text-anchor': 'middle', 'font-size': 12, fill: '#ff8fd6', text: 'ch5 ends: to be continued' }, svg);
  const rw = $('#campRewards');
  const st = D.campaign.start_state;
  rw.innerHTML = `<h4 style="margin-top:10px">Progress: what each chapter unlocks</h4><div class="tbl"><table><tr><th>Start</th><td>roster ${st.roster.map((x) => `<code>${x}</code>`).join(' ')} · parts ${st.capabilities.map((x) => `<code>${x}</code>`).join(' ')}</td></tr>` +
    D.chapters.filter((c) => !c.locked).map((c) => { const r = c.rewards || {}; return `<tr><th>${c.id}</th><td>${(r.capabilities || []).map((x) => `<span class="tag ok">+${x}</span>`).join('')}${(r.roster_add || []).map((x) => `<span class="tag">+ship ${x}</span>`).join('')}${(r.roster_remove || []).map((x) => `<span class="tag ndef">−${x}</span>`).join('')}${!Object.keys(r).length ? '<span class="tag">to be continued</span>' : ''}</td></tr>`; }).join('') + '</table></div>';
  // world draft
  const w = $('#wmSvg'), secY = {}, chs = WM.channels;
  const posC = {};
  WM.sectors.forEach((s) => { secY[s.id] = s.at; });
  chs.forEach((c) => { const a = secY[c.sector] || [0, 0]; posC[c.id] = [260 + a[0] * 85, 580 - a[1] * 88]; });
  WM.sectors.forEach((s) => { const y = 580 - s.at[1] * 88; el('text', { x: s.at[0] < 0 ? 12 : s.at[0] > 0 ? 508 : 12, y: y - 26, 'text-anchor': s.at[0] > 0 ? 'end' : 'start', 'font-size': 10.5, fill: '#6f9bd8', 'letter-spacing': '.12em', text: s.name.toUpperCase() }, w); });
  WM.connections.forEach((c) => { const a = posC[c.from], b = posC[c.to]; if (!a || !b) return; el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#6f9bd8', 'stroke-width': 2, opacity: .55 }, w); const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; el('text', { x: mx + 6, y: my + 3, 'font-size': 9.5, fill: '#6f86a6', text: c.via }, w); });
  chs.forEach((c) => {
    const [x, y] = posC[c.id], ready = c.status === 'ready';
    el('polygon', { points: hexPts(x, y, 22), fill: ready ? 'rgba(47,224,176,.18)' : 'rgba(120,150,200,.15)', stroke: ready ? '#2fe0b0' : '#6f9bd8', 'stroke-width': 2, 'stroke-dasharray': ready ? null : '4 3' }, w);
    el('text', { x, y: y + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, fill: '#fff', text: c.order }, w);
    el('text', { x: x + 28, y: y + 4, 'font-size': 12, fill: ready ? '#c4f7e8' : '#c8d8f0', text: c.name }, w);
    el('title', { text: `${c.name} (${c.status}) · ${c.map}` }, w);
  });
  // chapter mechanics
  const cm = $('#chapterMech');
  const items = [
    ['📜', 'Script beats', 'Each entry has <code>when</code> (a trigger) and <code>do</code> (actions). It fires once, or every turn with <code>repeat</code>. Triggers include <code>sees</code>, <code>hull_below</code>, <code>destroyed</code>, <code>engines_out</code>, <code>rammed</code> and <code>docked</code>.'],
    ['🎬', 'Scenes and barks', '<code>scene</code>, <code>bark</code> and <code>objective</code> send events for the story player to show. The engine doesn\'t wait for them.'],
    ['🧭', 'Escorts that fly themselves', '<code>{ id: wren, helm: script }</code> ships follow <code>orders</code>: <code>move_to</code>, <code>follow</code>, <code>hold</code>, <code>ram</code>, <code>fire_at</code>, <code>launch_at</code>. They spend their own budget, not yours.'],
    ['🤖', 'AI profiles', 'Each enemy gets a profile: <code>stance</code> (hold, charge, advance, flee, hunt, patrol), <code>target</code>, <code>stand_off</code>, <code>launch_range</code>, <code>only_targets</code> and more.'],
    ['🧬', 'Graft and dock', 'Join two touching ships of yours (7 segments at most, 1 CP). A docked ship pays 1 CP per extra core every turn; a grafted one doesn\'t. Either way it leaves a seam.'],
    ['✂️', 'Split', 'Script-only: a hull separates into pieces at given cells, the way the Twin does in ch3. Load moves to the pieces that have magazine room.'],
    ['✨', 'Move guides', 'On-map hints: glowing destination hexes, a ghost path, a reticle and a label. Steps advance on <code>reached</code>, <code>fired</code>, <code>grafted</code> and so on. Turn them off with <code>?guides=off</code>.'],
    ['🏁', 'Results', 'Without win or lose lists, you win when every enemy flagship is destroyed and lose when yours falls. <code>end: { result: to_be_continued }</code> leaves a chapter on a cliffhanger.'],
  ];
  items.forEach(([e, t, d]) => { const x = document.createElement('div'); x.className = 'card'; x.innerHTML = `<h3><span class="em" aria-hidden="true">${e}</span>${t}</h3><p style="font-size:14px;margin:0">${d}</p>`; cm.appendChild(x); });
  const s = document.createElement('p'); s.className = 'src'; s.style.gridColumn = '1/-1'; s.textContent = 'docs/campaign-engine.md (campaign-engine a73412a) · beta/campaign/GUIDE_PROPOSAL.md'; cm.appendChild(s);
}
