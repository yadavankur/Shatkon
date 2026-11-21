// RAPID GROK: the rapid-mode screen (rapid-grok.html).
// One action each, against the clock: 15 s to act, 5 s to watch. Game logic lives in
// engine/rapidgrok.js; this file only draws the board, runs the clock and turns taps into actions.
// It does not touch classic play (ui/play.js, ui/board.js).

import * as E from '../engine/index.js';
import * as G from '../engine/rapidgrok.js';
import { scanRadii } from '../engine/scan.js';
import { drawShip, shipDefs, TEAM } from './ships.js';
import { drawFrigate, frigateDefs } from './frigate.js';

const H = E.hex, ME = 0, CPU = 1;
const NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);

// ---------- drawing helpers ----------
const S = 10, W = Math.sqrt(3) * S;
const X = (c) => W * (c[0] + c[1] / 2), Y = (c) => 1.5 * S * c[1];
const f1 = (n) => n.toFixed(1);
function el(tag, attrs, ...kids) {
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
const cellPath = (c, k = 0.94) => hexPath(X(c), Y(c), S * k);
function outlinePath(cells) {
  const inside = new Set(cells.map(H.key));
  let d = '';
  for (const c of cells) for (let k = 0; k < 6; k++) {
    const n = H.step(c, k);
    if (inside.has(H.key(n))) continue;
    const vx = X(n) - X(c), vy = Y(n) - Y(c), len = Math.hypot(vx, vy), mx = X(c) + vx / 2, my = Y(c) + vy / 2, px = (-vy / len) * (S / 2 + 0.6), py = (vx / len) * (S / 2 + 0.6);
    d += 'M' + f1(mx - px) + ',' + f1(my - py) + 'L' + f1(mx + px) + ',' + f1(my + py);
  }
  return d;
}

// ---------- names in plain English ----------
const CLASS = { 1: 'Skiff', 2: 'Dart', 3: 'Arrow', 4: 'Lance', 7: 'Flower' };
const KIND = { missile: 'Nuke', missile_advanced: 'Advanced missile', missile_basic: 'Basic missile', seeker_drone: 'drone', mine: 'mine' };
const kindName = (k) => KIND[k] || String(k).replace(/_/g, ' ');
function nameOf(id) {
  const s = game && game.ships.find((x) => x.id === id);
  if (!s) return 'a ship';
  if (s.owner === ME) return s.name;
  return 'enemy ' + (CLASS[s.segs.length] || 'ship');
}

// ---------- game state ----------
let rules = null, cfg = null, game = null, level = 'normal';
let phase = 'intro';           // intro | act | cancel | ai | watch | over
let sel = null, mode = 'move'; // selected ship id, and what its next tap does
let deadline = 0, total = 1, pausedLeft = null;
let autoAct = null;            // the auto-fire waiting behind the red cancel button
let watch = null;              // what to highlight during the 5-second watch
let log = [];
let toastTimer = 0;
const ACT = () => (qs.has('act') ? Number(qs.get('act')) : cfg.act_seconds) * 1000;
const WATCH = () => (qs.has('watch') ? Number(qs.get('watch')) : cfg.watch_seconds) * 1000;
const CANCEL = () => (qs.has('cancel') ? Number(qs.get('cancel')) : cfg.cancel_seconds) * 1000;

async function load() {
  const txt = async (p) => (await fetch(p, { cache: 'no-cache' })).text();
  const [world, setup] = await Promise.all([txt('rules/world_v0.4.yaml'), txt('rules/rapid-grok/rapid_grok.yaml')]).then((a) => a.map((t) => YAML.parse(t)));
  const built = G.rgRules(world, setup);
  if (built.problems.length) throw new Error(built.problems.join('\n'));
  rules = built.rules; cfg = rules.rapidGrok;
}

function say(text, cls = '') { log.unshift({ text, cls }); log = log.slice(0, 30); }
function toast(text, foe = false, ms = 2600) {
  const t = $('toast'); t.textContent = text; t.hidden = false; t.className = foe ? 'foe' : '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

// Plain-English lines for the events a player was shown.
function describe(e, viewer) {
  const mine = (id) => { const s = game.ships.find((x) => x.id === id); return s && s.owner === viewer; };
  switch (e.t) {
    case 'move': return mine(e.ship) ? null : [nameOf(e.ship) + ' moved', 'foe'];
    case 'fire': return [nameOf(e.ship) + ' fired a laser' + (e.hits ? ' (' + e.hits + ' hit' + (e.hits > 1 ? 's' : '') + ')' : ' (missed)'), 'me'];
    case 'enemy_fire': return [nameOf(e.ship) + ' fired a laser at you', 'foe'];
    case 'launch': return [nameOf(e.ship) + ' launched a ' + kindName(e.kind) + (e.target ? ' at ' + nameOf(e.target) : ''), 'me'];
    case 'scan': return [nameOf(e.ship) + ' scanned: ' + e.found + ' found, ' + e.pinged + ' faint', 'me'];
    case 'hit': case 'damage': return [(mine(e.ship) ? 'Your ' + nameOf(e.ship) : nameOf(e.ship)[0].toUpperCase() + nameOf(e.ship).slice(1)) + ' took ' + e.hits + ' hit' + (e.hits > 1 ? 's' : '') + (e.wrecked ? ', a segment is wrecked' : ''), mine(e.ship) ? 'foe' : 'me'];
    case 'destroyed': return [(e.owner === viewer ? 'Your ' + e.name : 'Enemy ' + (CLASS[(game.ships.find((x) => x.id === e.ship) || { segs: [] }).segs.length] || 'ship')) + ' was destroyed' + (e.flagship ? ' (the flagship!)' : ''), e.owner === viewer ? 'foe' : 'me'];
    case 'stopped': return ['Point defence shot down a ' + kindName(e.kind), 'beat'];
    case 'blast': return ['A ' + kindName(e.kind) + ' exploded', 'beat'];
    case 'obj_lost': return ['Your ' + kindName(e.kind) + ' ' + e.why, 'beat'];
    case 'obj_destroyed': return ['A ' + kindName(e.kind) + ' was shot down', 'beat'];
    case 'sighted': return e.kind === 'ship' ? ['Spotted ' + nameOf(e.id), 'foe'] : ['Spotted an enemy ' + kindName(e.kind), 'foe'];
    case 'bump': return [nameOf(e.ship) + ' bumped into a hidden ship', 'foe'];
    default: return null;
  }
}

// ---------- the flow: act -> (auto-fire) -> computer -> watch -> act ----------
function newGame() {
  const seed = qs.has('seed') ? Number(qs.get('seed')) : (Date.now() % 100000) + 1;
  game = G.rgStart(rules, seed);
  sel = null; mode = 'move'; log = []; watch = null; autoAct = null; pausedLeft = null;
  $('intro').hidden = true; $('over').hidden = true;
  if (G.toAct(game) === CPU) { say('The computer moves first.', 'beat'); toast('The computer moves first'); computerTurn([]); }
  else { say('You move first.', 'beat'); toast('You move first'); startAct(); }
}

function startAct() {
  if (game.phase !== 'play') return finish();
  phase = 'act'; watch = null;
  if (sel && !E.view(game, ME).ships.some((x) => x.id === sel && x.mine)) sel = null;
  mode = 'move';
  setClock(ACT());
  render();
}

function setClock(ms) { total = ms; deadline = performance.now() + ms; pausedLeft = null; }

// The player's action (from a tap, or from the clock). Then the computer replies.
function play(action, why = null) {
  const r = G.rgAttempt(game, action);
  if (!r.ok) { toast('Not allowed: ' + r.why); return false; }
  const before = game;
  game = r.state;
  if (why) say(why, 'me');
  const mineEvents = G.seenEvents(game, ME);
  for (const e of mineEvents) { const d = describe(e, ME); if (d) say(d[0], d[1]); }
  if (before.round !== game.round && game.phase === 'play') say('— beat ' + game.round + ' —', 'beat');
  autoAct = null; $('cancel').hidden = true;
  if (game.phase !== 'play') return finish(), true;
  computerTurn(mineEvents);
  return true;
}

function computerTurn(myEvents) {
  phase = 'ai'; render();
  setTimeout(() => {
    const before = game;
    const r = G.aiTurn(game, CPU, level);
    game = r.state;
    const seen = G.seenEvents(game, ME);
    const foeMove = seen.find((e) => e.t === 'move' && game.ships.some((x) => x.id === e.ship && x.owner === CPU));
    const foeFire = seen.find((e) => e.t === 'enemy_fire');
    let text;
    if (foeFire) text = nameOf(foeFire.ship) + ' fired at you';
    else if (foeMove) text = nameOf(foeMove.ship) + ' moved';
    else if (seen.some((e) => e.t === 'sighted')) text = 'Enemy spotted';
    else text = 'The enemy acted out of your sight';
    for (const e of seen) { const d = describe(e, ME); if (d) say(d[0], d[1]); }
    if (!foeMove && !foeFire && !seen.some((e) => e.t === 'hit' || e.t === 'damage')) say(text, 'foe');
    if (before.round !== game.round && game.phase === 'play') say('— beat ' + game.round + ' —', 'beat');
    watch = { events: myEvents.concat(seen), text };
    if (game.phase !== 'play') return finish();
    phase = 'watch';
    setClock(WATCH());
    toast('Enemy: ' + text, true, Math.min(WATCH(), 3500));
    render();
  }, 60);
}

// The clock ran out on the player's turn.
function timeUp() {
  const ship = sel && game.ships.find((x) => x.id === sel && !x.dead && x.owner === ME);
  if (ship && (mode === 'laser' || mode === 'missile')) {
    const a = G.autoFire(game, ship.id, mode);
    if (a) {
      autoAct = { action: a, ship: ship.id, weapon: mode };
      phase = 'cancel';
      setClock(CANCEL());
      $('cancel').hidden = false;
      render();
      return;
    }
    toast('No target for the ' + mode + ': ' + ship.name + ' steps forward instead');
  }
  forced(ship ? ship.id : null, ship && mode === 'scan' ? 'Time up: scans never fire by themselves, so ' + ship.name + ' steps forward' : null);
}

function forced(shipId, why) {
  const a = G.forcedMove(game, shipId);
  if (!a) {   // nothing at all can move: the only time a turn goes by with nothing done
    game = G.rgStuckPass(game); say('Time up: none of your ships could move', 'me');
    if (game.phase !== 'play') return finish();
    return computerTurn([]);
  }
  const msg = why || ('Time up: ' + nameOf(a.ship) + ' steps forward' + (shipId ? '' : ' (picked at random)'));
  toast(msg);
  play(a, msg);
}

function cancelAuto() {
  if (phase !== 'cancel' || !autoAct) return;
  const id = autoAct.ship; autoAct = null; $('cancel').hidden = true;
  forced(id, 'Auto-fire cancelled: ' + nameOf(id) + ' steps forward instead');
}

function finish() {
  phase = 'over'; $('cancel').hidden = true; render();
  const w = game.winner;
  $('overTitle').textContent = w === ME ? 'You win!' : w === CPU ? 'You lose' : 'Draw';
  $('overText').textContent = (w === ME ? 'The enemy Flower is destroyed.' : w === CPU ? 'Your Flower was destroyed.' : 'Nobody won within ' + rules.turnLimit + ' beats.') + ' The game lasted ' + game.round + ' beats.';
  $('over').hidden = false;
}

// ---------- the clock ----------
function frame(now) {
  requestAnimationFrame(frame);
  if (!game || phase === 'intro' || phase === 'over' || phase === 'ai') { if (phase === 'ai') $('clocktext').textContent = 'Enemy is thinking…'; return; }
  const left = pausedLeft !== null ? pausedLeft : Math.max(0, deadline - now);
  const bar = $('bar');
  bar.style.width = ((left / total) * 100).toFixed(2) + '%';
  bar.className = phase === 'watch' ? 'watch' : (phase === 'cancel' || left < 5000) ? 'low' : '';
  const secs = Math.ceil(left / 1000);
  $('clocktext').textContent = pausedLeft !== null ? 'Paused' : phase === 'act' ? 'Your move · ' + secs + 's' : phase === 'watch' ? 'Watch the enemy · ' + secs + 's' : 'Auto-firing…';
  if (phase === 'cancel') $('cancel').querySelector('i').style.width = ((1 - left / total) * 100).toFixed(1) + '%';
  if (pausedLeft !== null || left > 0) return;
  if (phase === 'act') timeUp();
  else if (phase === 'watch') startAct();
  else if (phase === 'cancel' && autoAct) { const a = autoAct; autoAct = null; $('cancel').hidden = true; play(a.action, 'Time up: ' + nameOf(a.ship) + ' auto-fired its ' + a.weapon + ' at ' + nameOf(a.action.target)); }
}

function togglePause() {
  if (!game || phase === 'intro' || phase === 'over' || phase === 'ai') return;
  if (pausedLeft === null) { pausedLeft = Math.max(0, deadline - performance.now()); $('pause').textContent = 'Resume'; }
  else { deadline = performance.now() + pausedLeft; pausedLeft = null; $('pause').textContent = 'Pause'; }
}

// ---------- taps ----------
function myShipAt(c, v) { return v.ships.find((x) => x.mine && x.cells.some((z) => H.same(z, c))); }
function onCell(c) {
  if (phase !== 'act' || pausedLeft !== null) return;
  const v = E.view(game, ME), k = H.key(c);
  if (sel && mode === 'move') {
    const r = E.reach(game, sel).find((o) => o.path.length === 1 && H.key(o.at) === k);
    if (r) { play({ type: 'move', ship: sel, path: r.path }); return; }
  }
  if (sel && mode === 'laser') {
    const t = bestAt(E.beamTargets(game, sel), k);
    if (t) { play({ type: 'fire', ship: sel, seg: t.seg, part: t.part, at: t.at }); return; }
  }
  if (sel && mode === 'missile') {
    const lo = E.launchOptions(game, sel);
    if (lo && H.inHexagon(c, rules.board.radius) && !myShipAt(c, v)) {
      const foe = v.ships.find((x) => !x.mine && x.cells.some((z) => H.same(z, c)));
      const target = foe && lo.locks.includes(foe.id) ? foe.id : null;
      const a = E.aimLaunch(game, sel, lo.kinds[0], c, target);
      if (a) { play({ ...a, aim: c }); return; }
    }
  }
  const own = myShipAt(c, v);
  if (own) { sel = own.id === sel && mode === 'move' ? null : own.id; mode = 'move'; render(); return; }
  const foe = v.ships.find((x) => !x.mine && x.cells.some((z) => H.same(z, c)));
  if (foe) toast(nameOf(foe.id) + ' — pick one of your ships, then Laser or Missile to attack it');
}
function bestAt(list, k) {
  let best = null;
  for (const t of list) if (H.key(t.at) === k && (!best || t.hits > best.hits)) best = t;
  return best;
}
function setMode(m) {
  if (phase !== 'act' || !sel) return;
  mode = mode === m ? 'move' : m;
  render();
}

// ---------- drawing ----------
const portrait = () => innerHeight > innerWidth * 1.05;
function render() {
  if (!game) return;
  const v = E.view(game, ME), svg = $('board'), R = rules.board.radius;
  $('beat').textContent = 'Beat ' + game.round + ' / ' + rules.turnLimit;
  const pr = portrait();
  const bw = W * (2 * R + 1.6), bh = S * (3 * R + 3.2);
  svg.setAttribute('viewBox', pr ? `${f1(-bh / 2)} ${f1(-bw / 2)} ${f1(bh)} ${f1(bw)}` : `${f1(-bw / 2)} ${f1(-bh / 2)} ${f1(bw)} ${f1(bh)}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.textContent = '';
  svg.appendChild(el('defs', null,
    el('radialGradient', { id: 'rgHaze' }, el('stop', { offset: '0', 'stop-color': '#6f86ff', 'stop-opacity': '.5' }), el('stop', { offset: '1', 'stop-color': '#3a3fb8', 'stop-opacity': '.08' })),
    el('radialGradient', { id: 'rgRock', cx: '35%', cy: '30%', r: '80%' }, el('stop', { offset: '0', 'stop-color': '#a3abbf' }), el('stop', { offset: '.5', 'stop-color': '#5d6478' }), el('stop', { offset: '1', 'stop-color': '#262a38' })),
    el('marker', { id: 'rgArrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 4, markerHeight: 4, orient: 'auto' }, el('path', { d: 'M0,0L10,5L0,10Z', fill: TEAM[1].neon })),
    ...shipDefs().childNodes, ...frigateDefs().childNodes));
  // portrait screens: turn the board a quarter so your side (the right) sits at the bottom
  const root = el('g', { transform: pr ? 'rotate(90)' : null });
  svg.appendChild(root);

  // what each hex is
  const terrain = new Map();
  for (const t of rules.terrain) for (const c of t.cells) terrain.set(H.key(c), t.type);
  const sensed = new Set();
  for (const e of v.eyes) for (const c of e.cells) for (const d of H.disc(c, e.range)) sensed.add(H.key(d));
  // what a tap does right now
  const hot = new Map();   // key -> { cls, label }
  const selShip = sel && v.ships.find((x) => x.id === sel);
  if (phase === 'act' && selShip) {
    if (mode === 'move') for (const o of E.reach(game, sel)) if (o.path.length === 1) hot.set(H.key(o.at), { cls: 'move' });
    if (mode === 'laser') for (const t of E.beamTargets(game, sel)) { const k = H.key(t.at), h = hot.get(k); if (!h || h.label < t.hits) hot.set(k, { cls: 'laser', label: t.hits }); }
    if (mode === 'missile') { const lo = E.launchOptions(game, sel); if (lo) for (const id of lo.locks) { const t = v.ships.find((x) => x.id === id); if (t) for (const c of t.cells) hot.set(H.key(c), { cls: 'lock' }); } }
  }
  if (phase === 'cancel' && autoAct) {
    const a = autoAct.action, t = a.target && v.ships.find((x) => x.id === a.target);
    if (a.type === 'fire') hot.set(H.key(a.at), { cls: 'laser', label: a.hits });
    if (t) for (const c of t.cells) hot.set(H.key(c), { cls: 'auto' });
  }

  const cells = el('g');
  for (const c of H.disc([0, 0], R)) {
    const k = H.key(c), tt = terrain.get(k), h = hot.get(k);
    let fill = sensed.has(k) ? '#0d1d33' : '#070f1c', stroke = '#13243b';
    if (tt === 'nebula') fill = sensed.has(k) ? '#1b2350' : '#141a3c';
    const p = el('path', { d: cellPath(c), fill, stroke, 'stroke-width': 0.5 });
    p.addEventListener('click', () => onCell(c));
    cells.appendChild(p);
    if (tt === 'nebula') cells.appendChild(el('circle', { cx: f1(X(c)), cy: f1(Y(c)), r: f1(S * 0.9), fill: 'url(#rgHaze)', 'pointer-events': 'none' }));
    if (tt === 'asteroid') cells.appendChild(el('circle', { cx: f1(X(c)), cy: f1(Y(c)), r: f1(S * 0.62), fill: 'url(#rgRock)', 'pointer-events': 'none' }));
  }
  root.appendChild(cells);
  // home edges, faint
  root.appendChild(el('path', { d: outlinePath(H.disc([0, 0], R)), stroke: '#1f3552', 'stroke-width': 1, fill: 'none', 'pointer-events': 'none' }));

  // scan rings for a ship about to scan
  if (phase === 'act' && selShip && mode === 'scan') {
    const [r1, r2] = scanRadii(game, game.ships.find((x) => x.id === sel));
    const ring = (r) => outlinePath(selShip.cells.flatMap((c) => H.disc(c, r)).filter((c, i, a) => a.findIndex((z) => H.same(z, c)) === i));
    root.appendChild(el('path', { d: ring(r2), stroke: TEAM[0].accent, 'stroke-width': 0.8, 'stroke-dasharray': '2 2', fill: 'none', 'pointer-events': 'none' }));
    root.appendChild(el('path', { d: ring(r1), stroke: TEAM[0].neon, 'stroke-width': 1.2, fill: 'none', 'pointer-events': 'none' }));
  }

  // ghosts (where an enemy was last seen) and fuzzy contacts
  for (const gh of v.ghosts) {
    if (gh.kind !== 'ship') continue;
    root.appendChild(el('path', { d: outlinePath(gh.cells), stroke: TEAM[1].main, 'stroke-width': 0.9, 'stroke-dasharray': '1.5 1.5', 'stroke-opacity': 0.6, fill: 'none', 'pointer-events': 'none' }));
    const cx = gh.cells.reduce((n, c) => n + X(c), 0) / gh.cells.length, cy = gh.cells.reduce((n, c) => n + Y(c), 0) / gh.cells.length;
    root.appendChild(label(cx, cy, '?', TEAM[1].main, pr));
  }
  for (const ct of v.contacts) {
    root.appendChild(el('circle', { cx: f1(X(ct.at)), cy: f1(Y(ct.at)), r: f1((ct.r + 0.5) * W), fill: TEAM[1].neon, 'fill-opacity': 0.06, stroke: TEAM[1].neon, 'stroke-opacity': 0.5, 'stroke-width': 0.7, 'stroke-dasharray': '2 2', 'pointer-events': 'none' }));
  }

  // ships
  for (const x of v.ships) {
    const cx = x.cells.reduce((n, c) => n + X(c), 0) / x.cells.length, cy = x.cells.reduce((n, c) => n + Y(c), 0) / x.cells.length;
    const T = TEAM[x.owner === ME ? 0 : 1];
    root.appendChild(el('path', { d: outlinePath(x.cells), stroke: x.id === sel ? '#ffffff' : T.neon, 'stroke-width': x.id === sel ? 1.6 : 0.8, 'stroke-opacity': x.id === sel ? 1 : 0.55, fill: 'none', 'pointer-events': 'none' }));
    const art = el('g', { transform: `translate(${f1(cx)},${f1(cy)}) scale(0.92) translate(${f1(-cx)},${f1(-cy)})`, 'pointer-events': 'none' });
    try {
      const so = { cells: x.cells, segs: x.segs, owner: x.owner, rules, xy: (c) => [X(c), Y(c)], S, forward: x.owner === ME ? [-1, 0] : [1, 0], detail: 1, moved: 0, flagship: x.flagship, seen: true };
      art.appendChild(x.owner === ME ? drawFrigate(so) : drawShip(so));
    } catch (e) {
      for (const c of x.cells) art.appendChild(el('path', { d: cellPath(c, 0.8), fill: T.mid, stroke: T.neon, 'stroke-width': 0.8 }));
    }
    root.appendChild(art);
    if (x.mine) {
      const short = x.name.startsWith('Skiff ') ? x.name.slice(6) : x.flagship ? '★' : x.name[0];
      root.appendChild(label(cx + S * 0.6, cy - S * 0.6, short, T.neon, pr, 6.5));
    }
  }

  // missiles and drones
  for (const o of v.objs) {
    const T = TEAM[o.mine ? 0 : 1];
    if (o.mine) { const fc = E.forecast(game, o.id); if (fc && fc.path.length) root.appendChild(el('path', { d: 'M' + [o.pos].concat(fc.path).map((c) => f1(X(c)) + ',' + f1(Y(c))).join('L'), stroke: T.neon, 'stroke-width': 0.7, 'stroke-dasharray': '1.5 2', fill: 'none', 'pointer-events': 'none' })); }
    if (o.last && phase === 'watch') root.appendChild(el('line', { x1: f1(X(o.last)), y1: f1(Y(o.last)), x2: f1(X(o.pos)), y2: f1(Y(o.pos)), stroke: T.neon, 'stroke-width': 1, 'stroke-opacity': 0.6, 'pointer-events': 'none' }));
    root.appendChild(el('path', { d: `M${f1(X(o.pos))},${f1(Y(o.pos) - 4)}L${f1(X(o.pos) + 3)},${f1(Y(o.pos))}L${f1(X(o.pos))},${f1(Y(o.pos) + 4)}L${f1(X(o.pos) - 3)},${f1(Y(o.pos))}Z`, fill: T.neon, stroke: '#000', 'stroke-width': 0.5, 'pointer-events': 'none' }));
  }

  // what the last actions did (shown while watching)
  if (watch && (phase === 'watch' || phase === 'act')) {
    const faint = phase === 'act' ? 0.35 : 1;
    for (const e of watch.events) {
      if (e.t === 'move' && game.ships.some((x) => x.id === e.ship && x.owner === CPU)) {
        root.appendChild(el('line', { x1: f1(X(e.from)), y1: f1(Y(e.from)), x2: f1(X(e.to)), y2: f1(Y(e.to)), stroke: TEAM[1].neon, 'stroke-width': 1.6, 'stroke-opacity': faint, 'marker-end': 'url(#rgArrow)', 'pointer-events': 'none' }));
      }
      if (e.t === 'enemy_fire' || e.t === 'fire') {
        const T = TEAM[e.t === 'fire' ? 0 : 1];
        root.appendChild(el('line', { x1: f1(X(e.from)), y1: f1(Y(e.from)), x2: f1(X(e.end)), y2: f1(Y(e.end)), stroke: T.neon, 'stroke-width': 1.8, 'stroke-opacity': faint, 'stroke-linecap': 'round', 'pointer-events': 'none' }));
      }
      if ((e.t === 'hit' || e.t === 'damage') && e.at) root.appendChild(el('path', { d: cellPath(e.at, 0.9), fill: '#ff4d5e', 'fill-opacity': 0.35 * faint, stroke: '#ff4d5e', 'stroke-width': 1, 'pointer-events': 'none' }));
      if (e.t === 'blast' && e.at) root.appendChild(el('circle', { cx: f1(X(e.at)), cy: f1(Y(e.at)), r: f1(S * 1.6), fill: '#ffb347', 'fill-opacity': 0.3 * faint, stroke: '#ffb347', 'pointer-events': 'none' }));
    }
  }

  // tap targets on top
  for (const [k, h] of hot) {
    const c = H.unkey(k);
    const col = h.cls === 'move' ? TEAM[0].accent : h.cls === 'lock' ? TEAM[0].neon : '#ff4d5e';
    const p = el('path', { d: cellPath(c, 0.86), fill: col, 'fill-opacity': h.cls === 'move' ? 0.22 : 0.3, stroke: col, 'stroke-width': 1.2 });
    p.addEventListener('click', () => onCell(c));
    root.appendChild(p);
    if (h.label) root.appendChild(label(X(c), Y(c), h.label, '#fff', pr, 6));
  }
  renderPanel(v);
}

function label(x, y, text, color, pr, size = 6) {
  return el('text', { x: f1(x), y: f1(y), fill: color, 'font-size': size, 'font-weight': 700, 'text-anchor': 'middle', 'dominant-baseline': 'central', transform: pr ? `rotate(-90 ${f1(x)} ${f1(y)})` : null, 'pointer-events': 'none', style: 'paint-order:stroke;stroke:#000;stroke-width:1.2px' }, String(text));
}

function renderPanel(v) {
  const acts = $('acts'), st = $('status');
  acts.textContent = '';
  const btn = (text, on, enabled, fn, cls = '') => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.className = (on ? 'on ' : '') + cls; b.disabled = !enabled; b.onclick = fn; acts.appendChild(b); return b; };
  const ship = sel && v.ships.find((x) => x.id === sel);
  const can = phase === 'act' && pausedLeft === null;
  if (phase === 'act' && ship) {
    const full = game.ships.find((x) => x.id === sel);
    const st2 = E.shipStatus(game, sel) || {};
    const shots = E.beamTargets(game, sel), lo = E.launchOptions(game, sel), ammo = Object.values(ship.load || {}).reduce((n, x) => n + x, 0);
    btn('Move', mode === 'move', can && st2.moveLeft > 0, () => { mode = 'move'; render(); });
    btn('Laser' + (st2.beamsReady ? ' (' + shots.length + ')' : ''), mode === 'laser', can && st2.beamsReady > 0, () => setMode('laser'));
    btn('Missile' + (st2.launchers ? ' ×' + ammo : ''), mode === 'missile', can && !!lo, () => setMode('missile'));
    btn('Scan', mode === 'scan', can, () => setMode('scan'));
    if (mode === 'scan') btn('Scan now', false, can, () => play({ type: 'scan', ship: sel }), 'go');
    const hint = { move: 'tap a glowing hex to step 1 hex', laser: shots.length ? 'tap a red hex to fire (number = hits)' : 'no target in sight and in range', missile: lo && lo.locks.length ? 'tap a lit enemy to lock on, or any empty hex to fire blind' : 'no enemy in sight to lock on: tap any hex to fire blind', scan: 'shows the scan rings; press Scan now' }[mode];
    st.innerHTML = '';
    const b = document.createElement('b'); b.textContent = ship.name; st.append(b, ' · hull ' + (ship.hull ?? 100) + '% · ' + hint);
    if (full && st2.moveLeft === 0 && mode === 'move') st.append(' (this ship cannot move now)');
  } else {
    st.textContent = phase === 'act' ? 'Your move: tap one of your ships (teal). Do nothing and a random ship steps forward.'
      : phase === 'watch' ? 'Watching the enemy: ' + (watch ? watch.text : '') + '.'
      : phase === 'cancel' ? 'Time up! Auto-firing ' + (autoAct ? autoAct.weapon + ' at ' + nameOf(autoAct.action.target) : '') + ' — press Cancel to step forward instead.'
      : phase === 'ai' ? 'The enemy is choosing…' : phase === 'over' ? 'Game over.' : '';
  }
  $('log').innerHTML = '';
  for (const l of log.slice(0, 3)) { const d = document.createElement('div'); d.className = l.cls; d.textContent = l.text; $('log').appendChild(d); }
}

// ---------- start ----------
$('startNormal').onclick = () => { level = 'normal'; newGame(); };
$('startEasy').onclick = () => { level = 'easy'; newGame(); };
$('again').onclick = () => newGame();
$('cancel').onclick = cancelAuto;
$('pause').onclick = () => { togglePause(); render(); };
addEventListener('resize', () => render());
addEventListener('keydown', (e) => { if (e.key === 'Escape' && phase === 'cancel') cancelAuto(); });
load().then(() => {
  $('status').textContent = 'Press Start.';
  requestAnimationFrame(frame);
  if (qs.get('autostart') === '1') { level = qs.get('level') === 'easy' ? 'easy' : 'normal'; newGame(); }
}).catch((e) => { $('status').textContent = 'Could not load the rules: ' + e.message; console.error(e); });
// for automated checks only
window.__rapid = { get game() { return game; }, set game(st) { game = st; $('intro').hidden = true; startAct(); }, select(id, m = 'move') { sel = id; mode = m; render(); }, get phase() { return phase; }, get sel() { return sel; }, get mode() { return mode; } };
