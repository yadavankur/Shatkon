/* ---------- combat walkthrough ---------- */
function initCombat() {
  const svg = $('#combatSvg'), R = 6, S = 21, OX = 300, OY = 262;
  const P = (c) => { const [x, y] = hx(c[0], c[1], S); return [OX + x, OY + y]; };
  const defs = el('defs', {}, svg);
  defs.innerHTML = `<radialGradient id="cg1"><stop offset="0" stop-color="#2fe0b0" stop-opacity=".5"/><stop offset="1" stop-color="#4a8cff" stop-opacity=".12"/></radialGradient>
  <radialGradient id="cg2"><stop offset="0" stop-color="#ff5fc8" stop-opacity=".5"/><stop offset="1" stop-color="#9b6bff" stop-opacity=".14"/></radialGradient>
  <radialGradient id="boom"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#cfe8ff"/><stop offset="1" stop-color="#7fd8f0" stop-opacity="0"/></radialGradient>
  <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <clipPath id="boardClip"><rect x="40" y="30" width="525" height="470" rx="16"/></clipPath>`;
  const base = el('g', { 'clip-path': 'url(#boardClip)' }, svg);
  for (const c of disc([0, 0], R)) { const [x, y] = P(c); el('polygon', { points: hexPts(x, y, S * .96), fill: 'rgba(255,255,255,.03)', stroke: 'rgba(140,200,230,.18)' }, base); }
  el('text', { x: OX, y: 46, 'text-anchor': 'middle', 'font-size': 12, fill: '#ff8fd6', text: 'north · the Weave' }, svg);
  el('text', { x: OX, y: 496, 'text-anchor': 'middle', 'font-size': 12, fill: '#9fd8ff', text: 'south · Kestrel and Sparrow' }, svg);
  const dyn = el('g', { 'clip-path': 'url(#boardClip)' }, svg), panel = el('g', {}, svg);
  // ---- part state ----
  const KP = () => ({ name: 'Kestrel', side: 'h', segs: [
    { lab: 'W', parts: [['engine', 1], ['engine', 1], ['coupling', 1], ['laser', 1], ['armour', 2], ['armour', 2]] },
    { lab: 'C', parts: [['core', 1], ['sensor', 1], ['engine', 1], ['laser', 1], ['armour', 2], ['armour', 2]] },
    { lab: 'E', parts: [['coupling', 1], ['engine', 1], ['sensor', 1], ['laser', 1], ['armour', 2], ['armour', 2]] }] });
  const SP = () => ({ name: 'Seed', side: 'w', segs: [
    { lab: 'bow', parts: [['core', 1], ['sensor', 1], ['engine', 1], ['shield', 1], ['shield', 1], ['armour', 2]] },
    { lab: 'stern', parts: [['coupling', 1], ['engine', 1], ['magazine', 1], ['shield', 1], ['launcher', 1], ['laser', 1]] }] });
  // damage applied at the END of each step: [ship, seg, partIndex, newHp] ; 'wreck'
  const DMG = {
    3: [['k', 1, 4, 1], ['k', 1, 5, 1], ['k', 1, 4, 0], ['k', 0, 4, 1], ['k', 2, 4, 1]],
    4: [['s', 1, 3, 0], ['s', 1, 5, 0], ['s', 1, 4, 0], ['s', 1, 0, 0]],
    5: [['s', 1, 3, 1]],
    6: [['s', 1, 3, 0], ['s', 1, 2, 0], ['s', 1, 1, 0], ['s', 1, 'wreck']],
  };
  const stateAt = (step) => { const k = KP(), s = SP(); for (let i = 0; i < step; i++) (DMG[i] || []).forEach(([w, si, pi, hp]) => { const sh = w === 'k' ? k : s; if (pi === 'wreck') sh.segs[si].wrecked = true; else sh.segs[si].parts[pi][1] = hp; }); return { k, s }; };
  // positions
  const kAt = (row) => [[-1, row], [0, row], [1, row]];
  const sAt = (row) => [[0, row], [1, row]];
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const posLerp = (A, B, t) => A.map((c, i) => { const p = P(c), q = P(B[i]); return [lerp(p[0], q[0], t), lerp(p[1], q[1], t)]; });
  function drawShipAt(pts, side, opts = {}) {
    const g = el('g', { opacity: opts.op === undefined ? 1 : opts.op }, dyn);
    pts.forEach(([x, y], i) => {
      const wr = opts.wrecked && opts.wrecked[i];
      el('polygon', { points: hexPts(x, y, S * .94), fill: wr ? '#1c2230' : `url(#${side === 'h' ? 'cg1' : 'cg2'})`, stroke: wr ? '#3a4658' : side === 'h' ? '#5fd8f0' : '#ff5fc8', 'stroke-width': 2, 'stroke-dasharray': opts.ghost ? '4 3' : null, filter: opts.ghost ? null : 'url(#glow)' }, g);
      if (opts.shield && opts.shield[i]) el('polygon', { points: hexPts(x, y, S * 1.12), fill: 'none', stroke: '#9fe8ff', 'stroke-width': 1.6, opacity: opts.shield[i], 'stroke-dasharray': '2 3' }, g);
      if (wr) el('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-size': 10, fill: '#ff8fd6', text: '✖' }, g);
    });
    if (opts.label) { const [x, y] = pts[Math.floor(pts.length / 2)] || pts[0]; el('text', { x: x + (opts.lx || 0), y: y + (opts.ly || -S * 1.3), 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: side === 'h' ? '#cfe8ff' : '#ffc4ec', text: opts.label }, g); }
    return g;
  }
  const beam = (a, b, t, c = '#5ff7ff') => { const [x1, y1] = a, [x2, y2] = b; const e = el('line', { x1, y1, x2: lerp(x1, x2, Math.min(1, t * 2)), y2: lerp(y1, y2, Math.min(1, t * 2)), stroke: c, 'stroke-width': 3, 'stroke-linecap': 'round', filter: 'url(#glow)', opacity: t > .8 ? (1 - t) * 5 : 1 }, dyn); return e; };
  const burst = (p, r, op, col = 'url(#boom)') => el('circle', { cx: p[0], cy: p[1], r, fill: col, opacity: op }, dyn);
  const label = (p, t, c = '#cfe8ff', dy = 0) => el('text', { x: p[0], y: p[1] + dy, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, fill: c, stroke: '#040812', 'stroke-width': 3, 'paint-order': 'stroke', text: t }, dyn);
  // ---- steps ----
  const STEPS = [
    { t: 'Fog of war', d: 3200, cap: '<b>Fog of war.</b> Kestrel (sensor 6) spots a target at sensor + signature. The Seed has signature 2, so Kestrel sees it at 8. It is 9 hexes away, so all Kestrel gets is a <b>fuzzy contact</b> (within 8 + 3): a pink circle of radius 2. The dashed outline is where it really is.' },
    { t: 'Contact', d: 3200, cap: '<b>Contact!</b> The Seed spends banked thrust on a 2-hex dash. A big move adds +1 signature (now 3), so Kestrel sees it at 9. At 7 hexes it snaps to an exact ◆ contact, and the Seed sees Kestrel too (sensor 4 + Kestrel\'s signature 3 = 7).' },
    { t: 'Missile launch', d: 2600, cap: '<b>Launch (1 CP).</b> The Seed launches a missile <b>locked</b> on Kestrel from the hex next to its bow. Launching flares the Seed (+2 signature) for everyone watching.' },
    { t: 'Flight phase', d: 5200, cap: '<b>Flight phase.</b> Missiles fly after both turns, in 6 ticks (speed 6 = 1 hex a tick). At tick 6 it hits Kestrel\'s centre segment for <b>3 hits</b>. Kestrel has no shields, so the armour (layer 2) soaks all three and the core stays untouched. The blast (radius 1) hits each neighbouring segment once.' },
    { t: 'Shield hit', d: 4200, cap: '<b>Round 2: volley at 5 hexes.</b> Each laser does 1 hit at 5–8 hexes. Kestrel\'s 3 lasers and Sparrow\'s 1 aim at the stern. The first hit is soaked by the <b>shield</b> (layer 1). The rest strip the layer-3 parts (laser, launcher) and then the coupling. (Return fire is left out to keep this short.)' },
    { t: 'Recharge', d: 3000, cap: '<b>End of round.</b> Shields come back (main rules: every round). The hunting Seed closes to 4 hexes, which is laser range for 2 hits.' },
    { t: 'Segment lost', d: 4600, cap: '<b>Round 3: volley at 4 hexes, 2 hits per laser.</b> The shield soaks one again, then the magazine and the engine go. The next hit finds <b>nothing left</b>, so the stern is <b>wrecked</b>.' },
    { t: 'Aftermath', d: 3600, cap: '<b>Aftermath.</b> The wrecked stern stays attached and still weighs the ship down: 2 segments to move, 1 engine left. Shots pass through it now. The core in the bow is still alive, and the Seed only dies when that core goes. (Illustrative example: real hits pick at random among the lowest layer.)' },
  ];
  const TOTAL = STEPS.reduce((a, s) => a + s.d, 0);
  const sh = (seed, i) => { const st = seed.segs[1].parts[3][1]; return i === 1 ? st : seed.segs[0].parts[3][1]; };
  function render(step, t) {
    dyn.innerHTML = '';
    const HIT = { 3: .8, 4: .6, 5: .5, 6: .85 }, applied = t >= (HIT[step] !== undefined ? HIT[step] : 1);
    const { k, s } = stateAt(step + (applied ? 1 : 0));
    const st = stateAt(step);
    const kRow = step >= 4 ? 3 : 4;
    const spAt = step >= 4 ? [-3, 3] : [-3, 5];
    let kp = kAt(kRow).map(P), spp = [P(spAt)];
    let sRowA = step === 0 ? -5 : step === 1 ? -5 : step <= 3 ? -3 : step === 4 ? -2 : -1;
    let sp = sAt(sRowA).map(P);
    if (step === 1) sp = posLerp(sAt(-5), sAt(-3), ease(Math.min(1, t * 1.6)));
    if (step === 4 && t < .3) { const tt = ease(t / .3); sp = posLerp(sAt(-3), sAt(-2), tt); kp = posLerp(kAt(4), kAt(3), tt); spp = posLerp([[-3, 5]], [[-3, 3]], tt); }
    if (step === 5) sp = posLerp(sAt(-2), sAt(-1), ease(Math.min(1, t * 1.4)));
    const seen = step >= 1 && !(step === 1 && t < .55);
    // sensor ring
    if (step === 0 || step === 1) {
      const kc = P([0, 4]), rr = (step === 0 ? 8 : 9) * S * SQ3;
      const pulse = RM ? 1 : (t * 2) % 1;
      el('circle', { cx: kc[0], cy: kc[1], r: rr * (step === 1 && t < .55 ? pulse : 1), fill: 'none', stroke: '#7fd8f0', 'stroke-width': 1.5, 'stroke-dasharray': '6 6', opacity: .55 }, dyn);
      label([kc[0] + 110, kc[1] - rr + 30], `sight on Seed: ${step === 0 || t < .55 ? 8 : 9}`, '#7fd8f0');
    }
    // seed
    const sShield = [sh(applied ? s : st.s, 0) ? 1 : 0, sh(applied ? s : st.s, 1) ? 1 : 0];
    if (!seen) {
      drawShipAt(sp, 'w', { ghost: true, op: .35, label: 'Seed (unseen)' });
      const c = P([1, -4]);
      el('circle', { cx: c[0], cy: c[1], r: 2 * S * SQ3, fill: 'rgba(255,95,200,.10)', stroke: '#ff5fc8', 'stroke-width': 2, 'stroke-dasharray': '5 5', opacity: RM ? 1 : .6 + .4 * Math.sin(t * 12) }, dyn);
      label(c, '? fuzzy contact', '#ff8fd6', 4);
    } else {
      const wre = [false, !!(applied ? s : st.s).segs[1].wrecked];
      if (step === 6 && t > .85) wre[1] = true;
      drawShipAt(sp, 'w', { label: '◆ Seed', shield: sShield, wrecked: wre });
    }
    drawShipAt(kp, 'h', { label: 'Kestrel', ly: S * 1.7 });
    drawShipAt(spp, 'h', { label: 'Sparrow', ly: S * 1.6 });
    if (step === 2) { burst(sp[0], 30 * Math.min(1, t * 3), Math.max(0, 1 - t * 1.3), 'rgba(255,95,200,.5)'); label([sp[0][0] - 60, sp[0][1] - 26], 'flare +2', '#ff8fd6'); const m = P([0, -2]); el('circle', { cx: m[0], cy: m[1], r: 5, fill: '#ffc4ec', filter: 'url(#glow)', opacity: Math.min(1, t * 3) }, dyn); el('line', { x1: m[0], y1: m[1], x2: kp[1][0], y2: kp[1][1], stroke: '#ff8fd6', 'stroke-dasharray': '3 6', opacity: .6 * Math.min(1, t * 2) }, dyn); label([m[0] + 40, m[1] + 4], 'lock', '#ff8fd6'); }
    if (step === 3) {
      const tick = Math.min(6, Math.floor(t / .8 * 6) + 1), tt = Math.min(1, t / .8 * 6 / 6);
      const a = P([0, -2]), b = P([0, 4]);
      if (t < .8) {
        const x = lerp(a[0], b[0], tt), y = lerp(a[1], b[1], tt);
        for (let i = 1; i < 8; i++) el('circle', { cx: x, cy: y - i * 5, r: 4 - i * .45, fill: '#ff5fc8', opacity: .5 - i * .06 }, dyn);
        el('circle', { cx: x, cy: y, r: 5.5, fill: '#ffd6f2', filter: 'url(#glow)' }, dyn);
      } else { const bt = (t - .8) / .2; burst(b, 18 + 60 * bt, 1 - bt); el('polygon', { points: hexPts(b[0], b[1], S * 2.6), fill: 'none', stroke: '#cfe8ff', 'stroke-dasharray': '4 4', opacity: 1 - bt }, dyn); label([b[0] + 70, b[1] - 10], '3 hits + blast', '#ff8fd6'); }
      el('text', { x: 64, y: 70, 'font-size': 15, 'font-weight': 800, fill: '#cfe8ff', text: `FLIGHT PHASE · tick ${tick}/6` }, dyn);
    }
    if (step === 4 || step === 6) {
      const target = sp[1];
      const shooters = [kp[0], kp[1], kp[2], spp[0]];
      shooters.forEach((p, i) => { const lt = (t - .3 - i * .12) / .25; if (lt > 0 && lt < 1) beam(p, target, lt); });
      if (t > .38 && t < .62) { burst(target, S * 1.4, .7, 'rgba(159,232,255,.45)'); label([target[0] + 60, target[1] - 18], 'SHIELD HIT', '#9fe8ff'); }
      if (step === 6 && t > .85) { burst(target, 50 * (t - .85) / .15 + 10, 1 - (t - .85) / .15); label([target[0] + 70, target[1] + 4], 'SEGMENT WRECKED', '#ff8fd6'); }
      el('text', { x: 64, y: 70, 'font-size': 15, 'font-weight': 800, fill: '#cfe8ff', text: step === 4 ? 'ROUND 2 · range 5 · 1 hit per laser' : 'ROUND 3 · range 4 · 2 hits per laser' }, dyn);
    }
    if (step === 5) { if (t > .5) { burst(sp[1], S * 1.3, .5 * (1 - (t - .5) * 2), 'rgba(159,232,255,.5)'); label([sp[1][0] + 70, sp[1][1] - 16], 'shield back', '#9fe8ff'); } }
    if (step === 7) { label([sp[1][0] + 80, sp[1][1] + 4], 'wreck: shots pass through', '#ff8fd6'); label([sp[0][0] - 80, sp[0][1] - 20], 'core alive', '#cfe8ff'); }
    drawPanel(applied ? k : st.k, applied ? s : st.s, step, t);
  }
  function drawPanel(k, s, step, t) {
    panel.innerHTML = '';
    el('rect', { x: 585, y: 30, width: 300, height: 470, rx: 16, fill: 'rgba(5,8,25,.75)', stroke: 'rgba(140,200,230,.18)' }, panel);
    let y = 58;
    for (const ship of [k, s]) {
      el('text', { x: 602, y, 'font-size': 14, 'font-weight': 800, fill: ship.side === 'h' ? '#9fd8ff' : '#ff8fd6', text: ship.name + (ship.side === 'h' ? ' · kestrel@ch1' : ' · seed@ch1 ★') }, panel);
      y += 14;
      ship.segs.forEach((sg) => {
        el('text', { x: 602, y: y + 18, 'font-size': 11, fill: sg.wrecked ? '#d9a441' : '#7f93ad', text: sg.wrecked ? sg.lab + ' ✖' : sg.lab }, panel);
        sg.parts.forEach(([p, hp], i) => {
          const x = 645 + i * 39, max = D.parts[p].hp || 1, dead = hp <= 0 || sg.wrecked;
          el('rect', { x, y: y + 4, width: 36, height: 22, rx: 5, fill: dead ? 'rgba(80,80,90,.35)' : partCol(p, ship.side), 'fill-opacity': dead ? 1 : .85, stroke: dead ? '#555' : '#040812' }, panel);
          el('text', { x: x + 18, y: y + 19, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 800, fill: dead ? '#777' : '#040812', 'text-decoration': dead ? 'line-through' : null, text: PART[p][0] }, panel);
          for (let h = 0; h < max; h++) el('rect', { x: x + 4 + h * 9, y: y + 29, width: 7, height: 3, rx: 1, fill: h < hp && !sg.wrecked ? '#2fe0b0' : '#26344a' }, panel);
          el('title', { text: `${pname(p)}: ${Math.max(0, hp)}/${max} hp` }, panel);
        });
        y += 40;
      });
      y += 22;
    }
    el('text', { x: 602, y: y + 4, 'font-size': 11, fill: '#7f93ad', text: 'Hits go to the lowest layer first:' }, panel);
    el('text', { x: 602, y: y + 20, 'font-size': 11, fill: '#7f93ad', text: 'shield 1 → armour 2 → guns 3 → bays 4' }, panel);
    el('text', { x: 602, y: y + 36, 'font-size': 11, fill: '#7f93ad', text: '→ engine 5 → core 6' }, panel);
    el('text', { x: 602, y: 486, 'font-size': 11, fill: '#5d6f88', text: 'rules: main v0.4 · hulls: beta/campaign/ships.yaml' }, panel);
  }
  // ---- controls ----
  let cur = 0, prog = 0, playing = false, last = 0, raf = 0;
  const cap = $('#combatCap'), bar = $('#cBar'), lab = $('#cStep'), play = $('#cPlay'), stepsBox = $('#cSteps');
  STEPS.forEach((s, i) => { const b = document.createElement('button'); b.textContent = (i + 1) + '. ' + s.t; b.addEventListener('click', () => go(i, true)); stepsBox.appendChild(b); });
  const ui = () => {
    cap.innerHTML = STEPS[cur].cap; lab.textContent = `step ${cur + 1}/${STEPS.length}`;
    const done = STEPS.slice(0, cur).reduce((a, s) => a + s.d, 0) + prog * STEPS[cur].d;
    bar.style.width = (100 * done / TOTAL) + '%';
    $$('button', stepsBox).forEach((b, i) => b.classList.toggle('cur', i === cur));
    play.textContent = playing ? '❚❚ Pause' : (cur === STEPS.length - 1 && prog >= 1 ? '↺ Replay' : '▶ Play');
    svg.dataset.step = cur; svg.dataset.prog = prog.toFixed(2); svg.dataset.done = (cur === STEPS.length - 1 && prog >= 1) ? '1' : '0';
  };
  const frame = (now) => {
    if (!playing) return;
    const dt = now - last; last = now;
    prog += dt / STEPS[cur].d;
    if (prog >= 1) { if (cur < STEPS.length - 1) { render(cur, 1); cur++; prog = 0; } else { prog = 1; playing = false; } }
    render(cur, Math.min(1, prog)); ui();
    if (playing) raf = requestAnimationFrame(frame);
  };
  function go(i, animate) {
    cancelAnimationFrame(raf);
    cur = Math.max(0, Math.min(STEPS.length - 1, i));
    if (RM || !animate) { playing = false; prog = 1; render(cur, 1); ui(); return; }
    prog = 0; playing = true; last = performance.now(); raf = requestAnimationFrame(frame); ui();
  }
  play.addEventListener('click', () => {
    if (playing) { playing = false; ui(); return; }
    if (cur === STEPS.length - 1 && prog >= 1) { cur = 0; prog = 0; }
    else if (prog >= 1) { cur++; prog = 0; }
    if (RM) { go(cur, false); return; }
    playing = true; last = performance.now(); raf = requestAnimationFrame(frame); ui();
  });
  $('#cNext').addEventListener('click', () => { const n = prog >= 1 ? cur + 1 : (prog === 0 && cur === 0 && !playing && svg.dataset.started !== '1' ? 0 : cur + 1); svg.dataset.started = '1'; go(n, false); });
  $('#cPrev').addEventListener('click', () => go(cur - 1, false));
  window.combatRunAll = () => { cancelAnimationFrame(raf); cur = 0; prog = 0; playing = true; last = performance.now(); raf = requestAnimationFrame(frame); };
  const layout = () => {
    const narrow = svg.getBoundingClientRect().width < 640;
    svg.setAttribute('viewBox', narrow ? '30 20 560 1290' : '0 0 900 590');
    panel.setAttribute('transform', narrow ? 'translate(70 515) scale(1.6) translate(-585 -30)' : '');
  };
  layout(); addEventListener('resize', layout);
  render(0, 0); ui();
  // pause when off-screen
  new IntersectionObserver((e) => { if (!e[0].isIntersecting && playing) { playing = false; ui(); } }).observe($('#combatStage'));
}
