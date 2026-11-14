'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) { if (k === 'text') e.textContent = v; else e.setAttribute(k, v); }
  if (parent) parent.appendChild(e);
  return e;
}
const SQ3 = Math.sqrt(3);
const hx = (q, r, s) => [s * SQ3 * (q + r / 2), s * 1.5 * r];
function hexPts(cx, cy, s) {
  const p = [];
  for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 90); p.push((cx + s * Math.cos(a)).toFixed(2) + ',' + (cy + s * Math.sin(a)).toFixed(2)); }
  return p.join(' ');
}
const hdist = (a, b) => { const dq = a[0] - b[0], dr = a[1] - b[1]; return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2; };
function disc(c, R) { const o = []; for (let dq = -R; dq <= R; dq++) for (let dr = Math.max(-R, -dq - R); dr <= Math.min(R, -dq + R); dr++) o.push([c[0] + dq, c[1] + dr]); return o; }
const K = (c) => c[0] + ',' + c[1];

/* ---------- nav + toc ---------- */
const SECTIONS = [
  ['geometry', 'The geometry', '⬢', 'var(--neon)'], ['quick', 'Quick start', '⚡', 'var(--ice)'], ['modes', 'Modes', '🎮', 'var(--mint)'], ['board', 'Board', '⬡', 'var(--cyan)'],
  ['ships', 'Ships', '🛠️', 'var(--blue)'], ['fleets', 'Sample ships', '🚀', 'var(--teal)'], ['combat', 'Combat', '💥', 'var(--cyan)'],
  ['maps', 'Maps', '🗺️', 'var(--mint)'], ['world', 'World and campaign', '🌌', 'var(--blue)'], ['story', 'Story', '📖', 'var(--enemy)'],
  ['design', 'Design guides', '✏️', 'var(--cyan)'], ['glossary', 'Glossary', '📚', 'var(--teal)'], ['roadmap', 'Roadmap', '🧭', 'var(--ice)'],
];
function initNav() {
  const nav = $('#navlinks'), toc = $('#toc');
  for (const [id, label, em, c] of SECTIONS) {
    const a = document.createElement('a'); a.href = '#' + id; a.textContent = label; nav.appendChild(a);
    const t = document.createElement('a'); t.href = '#' + id; t.style.setProperty('--c', c); t.innerHTML = `<i aria-hidden="true">${em}</i>${esc(label)}`; toc.appendChild(t);
  }
  const links = $$('a', nav);
  const obs = new IntersectionObserver((ents) => {
    for (const e of ents) if (e.isIntersecting) {
      links.forEach((l) => l.classList.toggle('on', l.getAttribute('href') === '#' + e.target.id));
      const on = links.find((l) => l.classList.contains('on'));
      if (on && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: on.offsetLeft - 40, behavior: RM ? 'auto' : 'smooth' });
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  SECTIONS.forEach(([id]) => { const s = document.getElementById(id); if (s) obs.observe(s); });
  const prog = $('#prog');
  addEventListener('scroll', () => { const h = document.documentElement; prog.style.width = (100 * h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) + '%'; }, { passive: true });
}

/* ---------- hero ---------- */
function initHero() {
  const cv = $('#stars'), ctx = cv.getContext('2d');
  let W = 0, H = 0, stars = [];
  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.round(W * H / 2600) }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Math.random() * 1 + .2, p: Math.random() * 6.28, c: Math.random() < .12 ? (Math.random() < .7 ? '#7fd8f0' : '#2fe0b0') : '#ffffff' }));
  };
  resize(); addEventListener('resize', resize);
  let t0 = performance.now(), mx = 0, my = 0;
  const draw = (now) => {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      const x = (s.x + t * 6 * s.z + mx * 14 * s.z) % W, y = (s.y + my * 10 * s.z);
      const a = .35 + .65 * Math.abs(Math.sin(s.p + t * s.z * 1.3));
      ctx.globalAlpha = a; ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(x, y, s.z * 1.2, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!RM) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  // hex parallax layers
  const mk = (svg, s, op, color) => {
    svg.setAttribute('viewBox', '0 0 1600 1000'); svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const g = el('g', { fill: 'none', stroke: color, 'stroke-width': 1, opacity: op }, svg);
    for (let r = -2; r < 1000 / (1.5 * s) + 2; r++) for (let q = -Math.ceil(r / 2) - 2; q < 1600 / (SQ3 * s) - r / 2 + 2; q++) {
      const [x, y] = hx(q, r, s);
      if (Math.random() < .55) continue;
      el('polygon', { points: hexPts(x, y, s * .96), 'stroke-opacity': (Math.random() * .8 + .2).toFixed(2) }, g);
    }
  };
  mk($('#hexA'), 46, .2, '#7fd8f0'); mk($('#hexB'), 90, .14, '#2fe0b0');
  if (!RM) {
    const A = $('#hexA'), B = $('#hexB');
    const upd = () => { const y = scrollY; A.style.transform = `translate(${mx * -14}px,${y * .25 + my * -10}px)`; B.style.transform = `translate(${mx * 24}px,${y * .45 + my * 16}px) rotate(${y * .01}deg)`; };
    addEventListener('scroll', upd, { passive: true });
    addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; upd(); }, { passive: true });
  }
}

/* ---------- quick start + modes ---------- */
function initQuick() {
  const w = D.world;
  $('#cpTurn').textContent = w.turns.command_points.per_turn; $('#cpBank').textContent = w.turns.command_points.bank_cap;
  $('#ticks').textContent = w.turns.flight_phase.ticks; $('#turnLimit').textContent = w.turns.turn_limit;
  const icons = { move: ['🚀', 'var(--mint)'], fire: ['🔴', 'var(--neon)'], launch: ['🎯', 'var(--blue)'], scan: ['📡', 'var(--cyan)'], detonate: ['💥', 'var(--ice)'], end: ['⏹', 'var(--mute)'] };
  const f = $('#flow');
  for (const [k, a] of Object.entries(w.actions)) {
    if (k === 'end') continue;
    const [em, c] = icons[k] || ['•', 'var(--cyan)'];
    const d = document.createElement('div'); d.className = 'card'; d.style.setProperty('--c', c);
    d.innerHTML = `<h3><span class="em" aria-hidden="true">${em}</span>${k[0].toUpperCase() + k.slice(1)}</h3><p style="font-size:14px;margin:0">${esc(a.note)}.</p><p class="src" style="margin:8px 0 0">cost ${a.cost} CP</p>`;
    f.appendChild(d);
  }
  const ex = (w.movement_examples || []).map((x) => esc(x)).join(' · ');
  $('#moveEx').innerHTML = ex;
  $('#segMax').textContent = w.segments.max_per_ship; $('#budget').textContent = D.budget;
  const modes = [
    ['🤖', 'Vs computer', 'Easy or normal AI. The computer only ever sees what its own ships can see.', 'var(--lime)', 'ui/play.js › seat cpu / cpu-easy'],
    ['🔁', 'Pass and play', 'One device, two players. A curtain hides the board between turns so neither player sees the other\'s fleet.', 'var(--cyan)', 'seat pass'],
    ['👁️', 'Both players (open)', 'One screen with nothing hidden. Good for learning, testing and teaching.', 'var(--gold)', 'seat all'],
    ['📲', 'Two devices', 'Each player on their own device. You send your moves by swapping short turn codes.', 'var(--magenta)', 'seat 0 / 1 · turn codes'],
    ['🧪', 'The Lab', 'Ship designer, sandbox duels and Monte-Carlo series that run many games to balance ships and rules. Its rule knobs also apply to story chapters.', 'var(--violet)', 'ui/lab.js'],
    ['🎯', 'Beacon map', 'An objective variant: hold the beacon at the centre to score points. Reach 5 to win.', 'var(--orange)', 'rules/map_beacon_story.yaml'],
    ['📖', 'Story campaign', 'Shatkon: The Weave, five chapters with cutscenes, scripted escorts and move guides. Always against the computer.', 'var(--cyan)', 'beta/ · campaign-engine 960a0f7'],
    ['🧰', 'Test a chapter', 'Campaign map → pick any chapter, change the enemy\'s AI profile and launch. Never touches your save. "Copy changes" exports the edits.', 'var(--teal)', 'docs/campaign-engine.md'],
  ];
  const mc = $('#modeCards');
  for (const [em, t, d, c, s] of modes) {
    const x = document.createElement('div'); x.className = 'card glow'; x.style.setProperty('--c', c);
    x.innerHTML = `<div style="font-size:30px" aria-hidden="true">${em}</div><h3>${t}</h3><p style="font-size:14px">${d}</p><p class="src" style="margin:0">${s}</p>` + (t === 'Story campaign' || t === 'Test a chapter' ? '<span class="tag beta" style="position:absolute;top:14px;right:14px">beta</span>' : '');
    mc.appendChild(x);
  }
}

/* ---------- board demo ---------- */
function initBoard() {
  const svg = $('#boardDemo'), R = 5, S = 30;
  const terr = new Map();
  [[2, -1]].forEach((c) => terr.set(K(c), 'asteroid'));
  [[-3, 2], [-2, 2], [-1, 2]].forEach((c) => terr.set(K(c), 'asteroid'));
  disc([1, -3], 1).forEach((c) => terr.set(K(c), 'nebula'));
  const w = SQ3 * S * (2 * R + 1) + 20, h = 1.5 * S * 2 * R + 2 * S + 20;
  svg.setAttribute('viewBox', `${-w / 2} ${-h / 2} ${w} ${h}`);
  const g = el('g', {}, svg), hud = $('#hud');
  const cells = [];
  for (const c of disc([0, 0], R)) {
    const [x, y] = hx(c[0], c[1], S), t = terr.get(K(c));
    const zone = c[1] > R - 2 ? 'p1' : c[1] < -R + 2 ? 'p2' : null;
    const fill = t === 'asteroid' ? '#3a4658' : t === 'nebula' ? 'rgba(25,150,150,.32)' : zone === 'p1' ? 'rgba(79,184,255,.16)' : zone === 'p2' ? 'rgba(255,95,200,.16)' : 'rgba(255,255,255,.035)';
    const p = el('polygon', { points: hexPts(x, y, S * .97), fill, stroke: 'rgba(140,200,230,.28)', 'stroke-width': 1, class: 'hex', tabindex: 0, role: 'button', 'aria-label': `hex ${c[0]}, ${c[1]}` }, g);
    p.dataset.base = fill; cells.push([c, p]);
    if (t === 'asteroid') el('circle', { cx: x, cy: y, r: S * .38, fill: '#5a6a80', opacity: .8 }, g);
    const lab = el('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-size': 9.5, fill: 'rgba(220,230,255,.45)', 'pointer-events': 'none', text: c[0] + ',' + c[1] }, g);
  }
  el('text', { x: 0, y: -h / 2 + 14, 'text-anchor': 'middle', 'font-size': 12, fill: '#ff8fd6', text: 'NORTH · Player 2 home' }, svg);
  el('text', { x: 0, y: h / 2 - 6, 'text-anchor': 'middle', 'font-size': 12, fill: '#9fd8ff', text: 'SOUTH · Player 1 home' }, svg);
  const show = (c) => {
    const d = hdist(c, [0, 0]);
    cells.forEach(([cc, p]) => { const dd = hdist(cc, c); p.setAttribute('fill', dd === 0 ? 'rgba(95,247,255,.7)' : dd === 1 ? 'rgba(127,216,240,.3)' : p.dataset.base); });
    const t = terr.get(K(c));
    hud.innerHTML = `[q, r] = <b style="color:#cfe8ff">[${c[0]}, ${c[1]}]</b><br>s = −q−r = ${-c[0] - c[1]}<br>distance from centre: <b>${d}</b>${t ? '<br>terrain: ' + t + (t === 'nebula' ? ' (sensor −3, sig −2)' : ' (blocks move and sight)') : ''}`;
  };
  cells.forEach(([c, p]) => { p.addEventListener('pointerenter', () => show(c)); p.addEventListener('focus', () => show(c)); p.addEventListener('click', () => show(c)); });
}
