// The play screen. It draws one player's view from the engine and sends actions
// back. It holds no game rules: everything it shows comes from the engine.

import * as E from '../engine/index.js';
import { computerMove } from '../engine/ai.js';
import { drawBoard, partLooks, S, W, FL, setFlip, X, Y, f1 } from './board.js';
import { setLabDocs, labApplyPlayRules, labRoute, labAPI } from './lab.js';
const { hex } = E;

// ---------- tiny DOM helpers ----------
export const $ = (q) => document.querySelector(q);
function fill(e, kids) { for (const k of kids.flat(3)) if (k != null && k !== false) e.appendChild(k.nodeType ? k : document.createTextNode(String(k))); return e; }
export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  return fill(e, kids);
}

// ---------- app state ----------
export let rules = null, problems = [], game = null, looks = {};
// 'cpu' = against the computer, 'pass' = pass and play on one device,
// 'all' = both players share this screen with nothing hidden, or 0 / 1 = two devices
let seat = 'cpu';
let sel = null, look = null, mode = 'move', pending = null;
let hint = '', hintErr = false, code = '';
const cam = { x: 0, y: 0, w: 0 }; // what part of the board is on screen
let undoStack = [];               // states before undoable actions this turn
let curtain = null;               // pass and play: the player waiting behind the curtain
let aiTimer = null, aiSteps = 0, aiLevel = 'normal';
let report = null;                // last impact report shown on this screen
let pendingFx = null;             // animations held back until the curtain lifts
let ledgerOpen = false, sfxOn = true, actx = null;
export const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

async function loadRules() {
  let texts = window.SHATKON_RULES || null;
  if (!texts) {
    const stamp = '?t=' + Date.now(), get = async (n) => { const r = await fetch('rules/' + n + stamp); if (!r.ok) throw new Error('could not read rules/' + n); return r.text(); };
    const names = YAML.parse(await get('index.yaml')).files;
    texts = {};
    for (const n of names) texts[n] = await get(n);
  }
  const docs = Object.values(texts).map((t) => YAML.parse(t));
  const world = docs.find((d) => d && d.bay_parts), map = docs.find((d) => d && d.map), fleets = docs.find((d) => d && d.budget !== undefined && !d.bay_parts);
  const built = E.buildRules(world, map, fleets);
  rules = built.rules; problems = built.problems;
  setLabDocs({ world, map, fleets });   // the Lab builds its variants from the same files
  labApplyPlayRules();                  // ...and may swap in Lab fleets or rule changes
}

// The Lab replaces the rules new games use (Lab fleets, rule knobs).
export function setRules(r, p) { rules = r; problems = p; }

function save() {
  if (game) E.exportGame(game).then((c) => store.set('shatkon.game', c));
  store.set('shatkon.seat', String(seat));
}
export function say(text, err) { hint = text; hintErr = !!err; }
// Whose eyes the screen shows: both, one seat, the player to move (pass and play), or you (vs computer).
// Once a game is over everything is shown.
const who = () => (game && game.phase === 'over' && (seat === 'cpu' || seat === 'pass') ? 'all' : seat === 'all' ? 'all' : seat === 'pass' ? turnOf() : seat === 'cpu' ? 0 : seat);
const turnOf = () => game.order[game.turn];
const myTurn = () => game && game.phase === 'play' && (seat === 'all' || seat === 'pass' || (seat === 'cpu' ? turnOf() === 0 : turnOf() === seat));
const isCodes = () => seat === 0 || seat === 1;
const aiTurn = () => seat === 'cpu' && game && game.phase === 'play' && turnOf() === 1;
function curtainUp() {
  return curtain !== null && seat === 'pass';
}
function selZoom() {
  return $('#wrap').clientWidth > 600 ? 8 : 6;
}
// smooth camera moves: render at the target camera, then tween the SVG viewBox
let camTw = 0;
let camUntil = 0;
function camTween(from) {
  if (reduceMotion || !from || !(from.w > 0)) return;
  let to = { x: cam.x, y: cam.y, w: cam.w };
  if (![to.x, to.y, to.w, from.x, from.y, from.w].every(isFinite)) return;
  if (Math.abs(to.w - from.w) < 1e-3 && Math.hypot(to.x - from.x, to.y - from.y) < 1e-3) return;
  let t0 = performance.now(),
    id = ++camTw,
    dur = 380;
  camUntil = t0 + dur + 20;
  let step = (now) => {
    if (id !== camTw) return;
    let k = Math.min(1, (now - t0) / dur),
      ez = 1 - Math.pow(1 - k, 3),
      w = from.w + (to.w - from.w) * ez,
      x = from.x + (to.x - from.x) * ez,
      y = from.y + (to.y - from.y) * ez,
      box = $('#wrap'),
      svg = $('#wrap svg');
    if (svg && box && box.clientWidth) {
      let hh = (w * box.clientHeight) / box.clientWidth;
      svg.setAttribute('viewBox', [x - w / 2, y - hh / 2, w, hh].map(f1).join(' '));
    }
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
// ---------- sound ----------
// tiny sound effects (WebAudio, no files)
function tone(fa, fb, dur, type, vol) {
  if (!sfxOn || !actx) return;
  try {
    let o = actx.createOscillator(),
      g = actx.createGain(),
      t0 = actx.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(fa, t0);
    o.frequency.exponentialRampToValueAtTime(fb, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
    o.connect(g).connect(actx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch {}
}
function boom(vol) {
  if (!sfxOn || !actx) return;
  try {
    let n = Math.floor(actx.sampleRate * 0.5),
      buf = actx.createBuffer(1, n, actx.sampleRate),
      d0 = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d0[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5);
    let s = actx.createBufferSource(),
      f = actx.createBiquadFilter(),
      g = actx.createGain();
    s.buffer = buf;
    f.type = 'lowpass';
    f.frequency.value = 700;
    g.gain.value = vol;
    s.connect(f).connect(g).connect(actx.destination);
    s.start();
  } catch {}
}
function sfxFor(a, evs, viewer) {
  let seen = evs.filter((r) => r.seenBy.includes(viewer));
  if (seen.some((r) => r.t === 'destroyed')) { boom(0.5); tone(220, 55, 0.6, 'sawtooth', 0.06); return; }
  if (seen.some((r) => r.t === 'blast' || r.t === 'damage' || r.t === 'hit')) return boom(0.35);
  if (a.type === 'fire') return tone(1400, 300, 0.18, 'square', 0.05);
  if (a.type === 'launch') return tone(200, 600, 0.3, 'sawtooth', 0.05);
  if (a.type === 'move') return tone(330, 440, 0.08, 'sine', 0.06);
  if (seen.some((r) => r.t === 'sighted')) return tone(880, 880, 0.12, 'triangle', 0.05);
}
function yourTurnPing() {
  tone(660, 660, 0.09, 'sine', 0.06);
  setTimeout(() => tone(990, 990, 0.12, 'sine', 0.06), 110);
}
// undo: only for actions that revealed nothing new (see act)
function undo() {
  if (!undoStack.length || !myTurn()) return;
  game = undoStack.pop();
  pending = null;
  say('Undone.');
  save();
  render();
}
// ---------- animations: a canvas over the board ----------
let fxList = [];
let fxRaf = 0;
export const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function hexPx(h) {
  let svg = $('#wrap svg'),
    cv = $('#fx');
  if (!svg || !cv || !svg.getScreenCTM()) return null;
  let p = svg.createSVGPoint();
  p.x = X(h);
  p.y = Y(h);
  p = p.matrixTransform(svg.getScreenCTM());
  let r = cv.getBoundingClientRect();
  return [p.x - r.left, p.y - r.top];
}
function hexUnit() {
  let svg = $('#wrap svg'),
    m = svg && svg.getScreenCTM();
  return m ? m.a * W : 20;
}
function fx(dur, draw, delay) {
  fxList.push({ t0: performance.now() + (delay || 0), dur: reduceMotion ? dur * 0.5 : dur, draw });
  if (!fxRaf) fxRaf = requestAnimationFrame(fxTick);
}
function fxTick(now) {
  let cv = $('#fx'),
    wr = $('#wrap');
  if (!cv || !wr) { fxRaf = 0; return; }
  let dpr = window.devicePixelRatio || 1,
    cw = wr.clientWidth,
    ch = wr.clientHeight;
  cv.style.left = wr.offsetLeft + 'px';
  cv.style.top = wr.offsetTop + 'px';
  cv.style.width = cw + 'px';
  cv.style.height = ch + 'px';
  if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) {
    cv.width = Math.round(cw * dpr);
    cv.height = Math.round(ch * dpr);
  }
  let x = cv.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, cw, ch);
  fxList = fxList.filter((f) => now < f.t0 + f.dur);
  for (let f of fxList)
    if (now >= f.t0) {
      x.save();
      try {
        f.draw(x, Math.min(1, (now - f.t0) / f.dur), now);
      } catch {}
      x.restore();
    }
  fxRaf = fxList.length ? requestAnimationFrame(fxTick) : 0;
  if (!fxRaf) x.clearRect(0, 0, cw, ch);
}
const colOf = (p) => (p === 0 ? '#f5b942' : '#5cc8ff');
const ownerOfId = (id) => Number(String(id)[0]) - 1;
function beamFx(from, to, col, delay) {
  fx(
    520,
    (x, t) => {
      let a = hexPx(from),
        b = hexPx(to);
      if (!a || !b) return;
      let k = Math.min(1, t * 4);
      x.globalAlpha = 1 - t;
      x.strokeStyle = col;
      x.lineWidth = 5 * (1 - t) + 1;
      x.shadowColor = col;
      x.shadowBlur = 14;
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(a[0], a[1]);
      x.lineTo(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k);
      x.stroke();
      x.strokeStyle = '#fff';
      x.lineWidth = 1.5;
      x.stroke();
    },
    delay
  );
}
function ringFx(at, col, rHex, dur, delay, width) {
  fx(
    dur,
    (x, t) => {
      let a = hexPx(at);
      if (!a) return;
      x.globalAlpha = 1 - t;
      x.strokeStyle = col;
      x.lineWidth = (width || 3) * (1 - t) + 0.5;
      x.beginPath();
      x.arc(a[0], a[1], Math.max(1, hexUnit() * rHex * t), 0, 7);
      x.stroke();
    },
    delay
  );
}
function boomFx(at, delay, big) {
  let parts = Array.from({ length: big ? 28 : 16 }, () => [Math.random() * 6.283, 0.4 + Math.random() * 0.9]);
  fx(
    900,
    (x, t) => {
      let a = hexPx(at);
      if (!a) return;
      let u = hexUnit() * (big ? 1.6 : 1.1),
        g = x.createRadialGradient(a[0], a[1], 0, a[0], a[1], u * (0.4 + t));
      g.addColorStop(0, 'rgba(255,240,200,' + (1 - t) + ')');
      g.addColorStop(0.4, 'rgba(255,140,60,' + 0.8 * (1 - t) + ')');
      g.addColorStop(1, 'rgba(255,80,40,0)');
      x.fillStyle = g;
      x.beginPath();
      x.arc(a[0], a[1], u * (0.4 + t), 0, 7);
      x.fill();
      x.fillStyle = 'rgba(255,200,120,' + (1 - t) + ')';
      for (let [ang, sp] of parts) {
        x.beginPath();
        x.arc(a[0] + Math.cos(ang) * u * sp * t * 1.4, a[1] + Math.sin(ang) * u * sp * t * 1.4, 1.6, 0, 7);
        x.fill();
      }
    },
    delay
  );
  ringFx(at, '#ff8a5c', big ? 2.2 : 1.5, 800, delay, 4);
}
function textFx(at, lines, col, delay) {
  fx(
    1900,
    (x, t) => {
      let a = hexPx(at);
      if (!a) return;
      x.globalAlpha = t < 0.8 ? 1 : (1 - t) * 5;
      x.font = '700 13px ui-monospace,Menlo,monospace';
      x.textAlign = 'center';
      x.lineWidth = 4;
      x.strokeStyle = 'rgba(4,7,15,.9)';
      lines.forEach((s, i) => {
        let y = a[1] - 18 - t * 26 + i * 15;
        x.fillStyle = i ? '#e7ecf6' : col;
        x.strokeText(s, a[0], y);
        x.fillText(s, a[0], y);
      });
    },
    delay
  );
}
function impactFx(r, delay, mine) {
  let col = mine ? '#ff7a7a' : '#ffd27a';
  ringFx(r.at, col, 1.3, 700, delay, 5);
  ringFx(r.at, '#ffffff', 0.8, 450, delay, 2);
  textFx(
    r.at,
    [
      '-' + r.hits + ' hit' + (r.hits > 1 ? 's' : '') + ' \u00B7 section ' + (r.seg + 1),
      (r.lost || []).slice(0, 2).join(', ') || 'no effect',
      r.hull != null ? 'hull ' + r.hull + '%' : ''
    ].filter(Boolean),
    col,
    delay
  );
  if (mine)
    setTimeout(() => {
      let w = $('#wrap');
      if (w) {
        w.classList.remove('shake');
        void w.offsetWidth;
        w.classList.add('shake');
      }
    }, delay || 0);
}
function scanFx(r, delay) {
  let c0 = r.cells[Math.floor(r.cells.length / 2)] || r.cells[0];
  fx(
    1500,
    (x, t) => {
      let a = hexPx(c0);
      if (!a) return;
      let u = hexUnit(),
        R1 = u * r.r1,
        R2 = u * r.r2,
        rad = R2 * Math.min(1, t * 1.3);
      x.globalAlpha = 1 - t * 0.8;
      let g = x.createRadialGradient(a[0], a[1], Math.max(0, rad - 30), a[0], a[1], rad);
      g.addColorStop(0, 'rgba(88,214,160,0)');
      g.addColorStop(1, rad < R1 ? 'rgba(88,214,160,.45)' : 'rgba(245,185,66,.35)');
      x.fillStyle = g;
      x.beginPath();
      x.arc(a[0], a[1], rad, 0, 7);
      x.fill();
      x.strokeStyle = '#58d6a0';
      x.lineWidth = 1.5;
      x.setLineDash([5, 5]);
      x.beginPath();
      x.arc(a[0], a[1], R1, 0, 7);
      x.stroke();
      x.strokeStyle = '#f5b942';
      x.beginPath();
      x.arc(a[0], a[1], R2, 0, 7);
      x.stroke();
      x.setLineDash([]);
      let ang = t * 6.283 * 1.5;
      x.strokeStyle = 'rgba(140,255,200,.8)';
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(a[0], a[1]);
      x.lineTo(a[0] + Math.cos(ang) * rad, a[1] + Math.sin(ang) * rad);
      x.stroke();
    },
    delay
  );
}
function pingFx(at, label, col, delay) {
  ringFx(at, col, 1.6, 1e3, delay, 3);
  ringFx(at, col, 1.6, 1e3, (delay || 0) + 300, 2);
  if (label) textFx(at, [label], col, delay);
}
// missiles and drones flying through the flight phase, tick by tick
let fxBusyUntil = 0;
function flightFx(frames, evs, viewer) {
  let step = 300,
    sees = (ship, k) => viewer === 'all' || ship.owner === viewer || (frames[k].vis[viewer] || []).includes(ship.id),
    total = step * (frames.length - 1),
    flying = frames.some((state, k) =>
      state.objs.some((o) => (game.rules.munitions[o.kind] || {}).speed && sees(o, k))
    );
  if (!flying) return 0;
  fxBusyUntil = performance.now() + total + 600;
  fx(total + 250, (x, t, now) => {
    let el = t * (total + 250),
      k = Math.min(frames.length - 2, Math.floor(el / step)),
      f = Math.min(1, (el - k * step) / step),
      A = frames[k],
      B = frames[k + 1],
      u = hexUnit();
    for (let o of A.objs) {
      let nxt = B.objs.find((z) => z.id === o.id),
        isM = !!(game.rules.munitions[o.kind] || {}).speed;
      if (!isM || !(sees(o, k) || (nxt && sees(nxt, k + 1)))) continue;
      let a = hexPx(o.pos),
        b = hexPx((nxt || o).pos);
      if (!a || !b) continue;
      let px = a[0] + (b[0] - a[0]) * f,
        py = a[1] + (b[1] - a[1]) * f,
        ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (!nxt && f > 0.6) continue;
      // trail
      let first = frames.findIndex((state) => state.objs.some((z) => z.id === o.id)),
        tr = frames
          .slice(first, k + 1)
          .map((state) => state.objs.find((z) => z.id === o.id))
          .filter(Boolean)
          .map((z) => hexPx(z.pos));
      x.strokeStyle = colOf(o.owner);
      x.globalAlpha = 0.5;
      x.lineWidth = 2;
      x.setLineDash([4, 4]);
      x.beginPath();
      tr.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
      x.lineTo(px, py);
      x.stroke();
      x.setLineDash([]);
      x.globalAlpha = 1;
      let g = x.createRadialGradient(px, py, 0, px, py, u * 0.6);
      g.addColorStop(0, 'rgba(255,180,90,.9)');
      g.addColorStop(1, 'rgba(255,120,40,0)');
      x.fillStyle = g;
      x.beginPath();
      x.arc(px, py, u * 0.6, 0, 7);
      x.fill();
      x.translate(px, py);
      x.rotate(ang);
      x.fillStyle = colOf(o.owner);
      x.strokeStyle = '#060a14';
      x.lineWidth = 1.2;
      let s = Math.max(5, u * 0.45);
      x.beginPath();
      x.moveTo(s, 0);
      x.lineTo(-s * 0.7, s * 0.5);
      x.lineTo(-s * 0.4, 0);
      x.lineTo(-s * 0.7, -s * 0.5);
      x.closePath();
      x.fill();
      x.stroke();
      x.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    }
  });
  toast('Flight phase', 'flight');
  for (let k = 0; k < frames.length - 1; k++)
    for (let i = frames[k].ev; i < frames[k + 1].ev; i++) {
      let r = evs[i];
      if (r) eventFx(r, viewer, step * (k + 0.8));
    }
  return total;
}
function eventFx(r, viewer, delay) {
  if (!(viewer === 'all' || r.seenBy.includes(viewer))) return;
  switch (r.t) {
    case 'fire':
      if (r.from) beamFx(r.from, r.end, colOf(ownerOfId(r.ship)), delay);
      break;
    case 'enemy_fire':
      beamFx(r.from, r.end, colOf(ownerOfId(r.ship)), delay);
      break;
    case 'damage':
      if (r.at) impactFx(r, (delay || 0) + 120, viewer !== 'all');
      break;
    case 'hit':
      if (r.at) impactFx(r, (delay || 0) + 120, false);
      break;
    case 'blast':
      boomFx(r.at, delay);
      break;
    case 'stopped':
      ringFx(r.at, '#f5d142', 1.4, 700, delay, 4);
      textFx(r.at, ['point defence!'], '#f5d142', delay);
      break;
    case 'obj_destroyed':
      boomFx(r.at, delay);
      break;
    case 'scan':
      scanFx(r, delay);
      break;
    case 'sighted':
      pingFx(r.at, r.kind === 'ship' ? 'SIGHTED' : '', '#ff7a7a', (delay || 0) + 250);
      break;
  }
}
function playFx(evs, viewer, flight) {
  let inFlight = new Set();
  if (flight && flight.length > 1) {
    for (let i = flight[0].ev; i < flight[flight.length - 1].ev; i++) inFlight.add(i);
    flightFx(flight, evs, viewer);
  }
  let gotBoom = false;
  evs.forEach((r, i) => {
    if (!inFlight.has(i)) {
      if (r.t === 'destroyed') gotBoom = true;
      eventFx(r, viewer, r.t === 'sighted' && evs.some((z) => z.t === 'scan') ? 900 : 0);
    }
  });
}
function toast(text, cls) {
  let t = $('#toast');
  if (t) {
    t.textContent = text;
    t.className = '';
    void t.offsetWidth;
    t.className = 'show ' + (cls || '');
  }
}
// impact report: damage this screen is allowed to know about
function makeReport(evs, viewer) {
  let rows = evs.filter((r) => (r.t === 'damage' || r.t === 'hit') && (viewer === 'all' || r.seenBy.includes(viewer)));
  return rows.length ? rows : null;
}
function anyAction() {
  let t = turnOf();
  return game.ships.some(
    (ship) =>
      !ship.dead &&
      ship.owner === t &&
      (E.reach(game, ship.id).length ||
        E.beamTargets(game, ship.id).length ||
        E.launchOptions(game, ship.id) ||
        E.shipStatus(game, ship.id).scanReady)
  );
}
// the computer plays Player 2, one action at a time
function aiStep() {
  aiTimer = null;
  if (!aiTurn()) return;
  let a;
  try {
    a = aiSteps++ > 30 ? { type: 'end' } : computerMove(game, 1, aiLevel) || { type: 'end' };
  } catch (err) {
    console.warn('AI error', err);
    a = { type: 'end' };
  }
  if (!E.attempt(game, a).ok) a = { type: 'end' };
  if (a.type === 'end') aiSteps = 0;
  act(a, true, true);
}

export function newGame() {
  game = E.start(rules, (Date.now() % 2147483647) | 0);
  looks = partLooks(game.rules);
  sel = look = pending = null; mode = 'move'; code = ''; cam.w = 0;
  undoStack = []; curtain = null; aiSteps = 0; report = null; pendingFx = null;
  say(seat === 'cpu'
    ? 'New game against the computer. You are Player 1 (gold, bottom). Find the enemy flagship (\u2605) and destroy it. Tap one of your ships to begin.'
    : 'New game. Find the enemy flagship (\u2605) and destroy it. Tap one of your ships to begin.');
  save(); render();
}

function act(action, quiet, byAI) {
  const p = turnOf(), prev = game;
  const viewer = seat === 'cpu' ? 0 : p;      // the computer's view must never reach the hint
  const r = E.attempt(game, action);
  if (!r.ok) { say('Not allowed: ' + r.why + '.', true); return render(); }
  game = r.state; pending = null;
  const mine = game.events.filter((e) => e.seenBy.includes(viewer) && e.t !== 'lost').map(describe);
  // an action can be undone only if it told the player nothing new
  if (!byAI && game.phase === 'play' && (action.type === 'move' || action.type === 'launch')
    && game.events.every((e) => !e.seenBy.includes(p) || e.t === 'move' || e.t === 'launch' || e.t === 'lost')) undoStack.push(prev);
  else undoStack = [];
  sfxFor(action, game.events, viewer);
  // animations and the impact report. In pass and play they wait until the next player lifts the curtain.
  const fxViewer = seat === 'all' ? 'all' : viewer;
  if (seat === 'pass' && action.type === 'end' && game.phase === 'play') {
    pendingFx = [game.events, turnOf(), game.flight];
    report = makeReport(game.events, turnOf());
  } else {
    setTimeout(() => playFx(r.state.events, fxViewer, r.state.flight), 30);
    report = makeReport(game.events, fxViewer) || (byAI ? report : null);
  }
  let msg = mine.join(' ');
  if (game.phase === 'over' && game.winner === 'draw' && !/draw/.test(msg)) msg += (msg ? ' ' : '') + 'The round limit was reached, so the game is a draw.';
  if (action.type === 'end' || game.phase === 'over') {
    code = E.turnCode(game); sel = null; mode = 'move'; cam.w = 0;      // back to the whole map for the next player
    undoStack = [];
    if (seat === 'pass' && game.phase === 'play') curtain = turnOf();
    if (game.phase === 'over') curtain = null;
    if (byAI) say(game.phase === 'over' ? msg : 'The computer ended its turn. Your move: check \u201cSince your last turn\u201d below.');
    else if (!quiet) say(game.phase === 'over' ? msg : seat === 'pass' ? 'Turn ended. Pass the device to Player ' + (turnOf() + 1) + '.' : 'Turn ended.');
    if (byAI && game.phase === 'play') yourTurnPing();
    if (game.phase === 'play') {
      const next = turnOf();
      const text = seat === 'cpu' ? (next === 0 ? 'Your turn' : 'Computer\'s turn') : seat === 'pass' ? 'Pass to Player ' + (next + 1)
        : isCodes() ? (next === seat ? 'Your turn' : 'Send your turn code') : 'Player ' + (next + 1) + '\'s turn';
      setTimeout(() => toast(text, 'p' + next), game.flight && game.flight.length > 1 ? 300 * game.flight.length + 300 : 50);   // after the flight animation
    }
    if (game.phase === 'over') setTimeout(() => toast(game.winner === 'draw' ? 'Draw' : seat === 'cpu' ? (game.winner === 0 ? 'Victory!' : 'Defeat') : 'Player ' + (game.winner + 1) + ' wins', 'over'), 600);
  } else if (byAI) {
    say(msg || 'The computer is taking its turn\u2026');
  } else {
    say(msg || 'Done.');
    if (game.phase === 'play' && turnOf() === p && (game.players[p].cp <= 0 || !anyAction())) {      // nothing left to do
      const kept = hint;
      act({ type: 'end' }, true);
      say(kept + (game.players[p].cp > 0 ? ' No actions left, so the turn ended.' : ' That was your last action, so the turn ended.'));
      return render();
    }
  }
  save(); render();
}

// ---------- words ----------
const at = (c) => '[' + c[0] + ', ' + c[1] + ']';
const nice = (k) => String(k).replace(/_/g, ' ');
export const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : /x$/.test(w) ? 'es' : 's');
function whyText(w) {
  if (!w) return '';
  if (w.lit) return 'It is lit up by an explosion or a collision, so everyone can see it for now.';
  if (w.scanned) return 'Your scan revealed it.';
  if (w.drone) return 'It gave itself away by spotting one of your ships.';
  return 'Your ' + w.by + ' sees it from ' + plural(w.d, 'hex') + ' away: sensor ' + w.range + ' + its signature ' + w.sig + (w.flare ? ' (which includes ' + w.flare + ' of flare from firing)' : '') + ' reaches ' + (w.range + w.sig) + '.';
}
function describe(e) {
  switch (e.t) {
    case 'move': return e.ship + ' moved ' + plural(e.steps, 'hex') + '.';
    case 'sighted': return 'Spotted ' + (e.kind === 'ship' ? 'enemy ship ' + e.id : 'a ' + nice(e.kind)) + ' at ' + at(e.at) + '. ' + whyText(e.why);
    case 'lost': return 'Lost sight of ' + e.id + (e.faded ? ': its flare faded.' : ': it is out of sensor range now.') + ' A "?" marks where it was last seen.';
    case 'fire': return e.ship + ' fired' + (e.hits ? '.' : ' and did nothing.');
    case 'damage': return e.ship + ' section ' + (e.seg + 1) + ' took ' + plural(e.hits, 'hit') + ' from a ' + nice(e.cause) + ': ' + (e.lost.join(', ') || 'no effect') + '.' + (e.hull != null ? ' Hull ' + e.hull + '%.' : '');
    case 'hit': return 'Hit ' + e.ship + ' section ' + (e.seg + 1) + ' with ' + plural(e.hits, 'hit') + (e.lost && e.lost.length ? ': ' + e.lost.join(', ') : '') + (e.wrecked ? ', section wrecked' : '') + '.' + (e.hull != null ? ' Its hull is at ' + e.hull + '%.' : '');
    case 'destroyed': return (e.flagship ? 'Flagship ' : 'Ship ') + e.ship + ' was destroyed.';
    case 'blast': return 'A ' + nice(e.kind) + ' exploded at ' + at(e.at) + '.';
    case 'stopped': return 'Point defence on ' + e.ship + ' stopped a ' + nice(e.kind) + '.';
    case 'launch': return e.ship + ' launched a ' + nice(e.kind) + (e.target ? ' locked on ' + e.target : '') + '.';
    case 'scan': return e.ship + ' scanned: ' + (e.found ? plural(e.found, 'thing') + ' fully revealed within ' + e.r1 + ' hexes' : 'nothing within ' + e.r1 + ' hexes') + (e.pinged ? ', ' + plural(e.pinged, 'faint contact') + ' out to ' + e.r2 : '') + '.';
    case 'enemy_fire': return 'Enemy ' + e.ship + ' fired a laser' + (e.hits ? '.' : ' and missed.');
    case 'bump': return e.ship + ' ran into ' + e.into + '. Both are revealed.';
    case 'obj_lost': return 'Your ' + nice(e.kind) + ' ' + e.why + '.';
    case 'obj_destroyed': return 'A ' + nice(e.kind) + ' was destroyed at ' + at(e.at) + '.';
    case 'ammo_lost': return e.ship + ' lost ' + e.n + ' stored munition(s).';
    case 'game_over': return e.winner === 'draw' ? 'The game is a draw.' : 'Player ' + (e.winner + 1) + ' wins.';
  }
  return e.t;
}
function forecastText(f, kind) {
  if (!f) return '';
  const when = f.rounds <= 1 ? 'in this round\'s flight phase' : 'in ' + f.rounds + ' rounds';
  if (f.ends === 'hit') return 'On this path the ' + nice(kind) + ' reaches ' + f.hit + ' ' + when + ', if nothing moves.';
  if (f.ends === 'edge') return 'On this path it flies off the board ' + when + ' unless its seeker finds something within ' + game.rules.munitions[kind].seeker_range + ' hexes.';
  if (f.ends === 'asteroid') return 'On this path it hits an asteroid.';
  return 'On this path it runs out of fuel after ' + plural(f.path.length, 'hex') + ' unless its seeker finds something.';
}

function compass(a, b) {
  const dx = FL * (W * (b[0] + b[1] / 2) - W * (a[0] + a[1] / 2)), dy = FL * 1.5 * S * (b[1] - a[1]);
  return ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
}

// ---------- what a tap would do in the current mode ----------
function options(v) {
  const map = new Map();
  if (!myTurn() || (pending && pending.type !== 'move') || (!sel && mode !== 'scan' && mode !== 'detonate')) return map;
  if (mode === 'move') for (const r of E.reach(game, sel)) map.set(hex.key(r.at), { action: { type: 'move', ship: sel, path: r.path }, mark: 'move', label: r.path.length });
  if (mode === 'fire') for (const t of E.beamTargets(game, sel)) {
    const k = hex.key(t.at);
    if (!map.has(k) || map.get(k).hits < t.hits) map.set(k, { action: { type: 'fire', ship: sel, seg: t.seg, part: t.part, at: t.at }, mark: 'target', hits: t.hits, label: t.hits });
  }
  if (mode === 'missile' || mode === 'seeker_drone') {
    const lo = E.launchOptions(game, sel), me = v.ships.find((x) => x.id === sel);
    if (lo && me && lo.kinds.includes(mode)) {
      const outward = (st) => { let best = me.cells[0]; for (const c of me.cells) if (hex.dist(c, st) < hex.dist(best, st)) best = c; return [hex.dirToward(best, st)]; };
      for (const st of lo.starts) map.set(hex.key(st), { preview: { type: 'launch', ship: sel, kind: mode, start: st, target: null, route: outward(st) }, mark: 'way' });
      if (game.rules.munitions[mode].seeker_range) for (const id of lo.locks) {
        const foe = v.ships.find((x) => x.id === id);
        for (const c of foe ? foe.cells : []) {
          let st = lo.starts[0]; for (const o of lo.starts) if (hex.dist(o, c) < hex.dist(st, c)) st = o;
          map.set(hex.key(c), { preview: { type: 'launch', ship: sel, kind: mode, start: st, target: id, route: [] }, mark: 'lock' });
        }
      }
    }
  }
  if (mode === 'detonate') for (const o of v.objs) if (o.mine && game.rules.munitions[o.kind].remote_detonate) map.set(hex.key(o.pos), { action: { type: 'detonate', obj: o.id }, mark: 'target' });
  return map;
}

function tap(c, v, opts) {
  const o = opts.get(hex.key(c));
  if (o && o.action && o.action.type === 'move') {      // first tap shows where the ship would end up; second tap goes
    if (pending && pending.type === 'move' && pending.path.join('') === o.action.path.join('')) return act(pending);
    pending = o.action;
    const ship = v.ships.find((x) => x.id === sel), to = pending.path.reduce((c, d) => hex.step(c, d), ship.pos);
    say('The dashed outline shows where ' + sel + ' will end up: ' + plural(pending.path.length, 'hex') + ' ' + compass(ship.pos, to) + '. Tap it again or press Move here.');
    return render();
  }
  if (o && o.action) return act(o.action);
  if (o && o.preview) {
    pending = o.preview;
    say(forecastText(E.forecast(game, pending), pending.kind) + ' Press Launch to send it, or Cancel.');
    return render();
  }
  if (pending && pending.type !== 'move') return;
  pending = null;
  const ship = v.ships.find((x) => x.cells.some((y) => hex.same(y, c)));
  if (ship && ship.mine && myTurn()) selectShip(ship.id, v);
  else if (ship) { look = ship.id; say(ship.mine ? 'Your ship ' + ship.id + '.' : 'Enemy ship ' + ship.id + '. ' + (ship.seen ? whyText(ship.why) : 'The player to move cannot see it.')); }
  else {
    const obj = v.objs.find((x) => hex.same(x.pos, c)), gh = v.ghosts.find((x) => x.cells.some((y) => hex.same(y, c)));
    say(at(c) + (obj ? ': ' + (obj.mine ? 'your ' : 'enemy ') + nice(obj.kind) + (obj.fuel != null ? ', ' + plural(obj.fuel, 'round') + ' of fuel left' : '') + '.'
      : gh ? ': ' + (gh.kind === 'ship' ? 'an enemy ship' : 'a ' + nice(gh.kind)) + ' was last seen here in round ' + gh.round + '.' : ': empty space.'));
    if (!obj && !gh) { sel = null; look = null; mode = 'move'; }
  }
  render();
}

function selectShip(id, v) {
  sel = id; look = null; mode = 'move'; pending = null;
  const ship = v.ships.find((x) => x.id === id), st = E.shipStatus(game, id);
  say(id + ' selected. ' + (st.moveLeft > 0 ? 'Green markers show where its centre can move; the number is how many hexes that uses. Tap one to preview the move.' : 'It cannot move further this turn.'));
  frame(ship.cells.concat(E.reach(game, id).map((r) => r.at)), selZoom());   // zoom to the ship and where it can go
}

// ---------- camera ----------
function fitWidth() {
  const R = game.rules.board.radius, box = $('#wrap');
  let aspect = box.clientHeight / Math.max(1, box.clientWidth);
  if (!(aspect > 0) || !isFinite(aspect)) aspect = 1;      // the board is hidden (Lab tab)
  return Math.max(W * (2 * R + 1) + 16, (S * (3 * R + 5) + 16) / aspect);
}
export function wholeMap() { cam.x = 0; cam.y = 0; cam.w = fitWidth(); }
function frame(cells, minHexes) {       // bring a set of hexes into view, with a short glide
  const box = $('#wrap');
  let aspect = box.clientHeight / Math.max(1, box.clientWidth);
  if (!(aspect > 0) || !isFinite(aspect)) aspect = 1;
  if (!cells.length) return wholeMap();
  const xs = cells.map((c) => FL * W * (c[0] + c[1] / 2)), ys = cells.map((c) => FL * 1.5 * S * c[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const from = cam.w > 0 && isFinite(cam.w) && isFinite(cam.x) && isFinite(cam.y) ? { x: cam.x, y: cam.y, w: cam.w } : null;
  cam.x = (x0 + x1) / 2; cam.y = (y0 + y1) / 2;
  cam.w = Math.min(fitWidth(), Math.max(minHexes * W, x1 - x0 + 2.5 * W, (y1 - y0 + 4 * S) / aspect));
  camTween(from);
}
function zoomBy(k) { cam.w = Math.max(4 * W, Math.min(fitWidth(), cam.w * k)); }

// what moving further forward would do for a scan
function scanNextText(si) {
  return si.next
    ? 'Go ' +
        plural(si.next.rows, 'row') +
        ' further forward for ' +
        si.next.r[0] +
        ' / ' +
        si.next.r[1] +
        ' rings (' +
        si.next.name +
        ').'
    : 'Full strength: you are at the centre line or beyond.';
}
// itemised points: where every command point and unit of thrust came from
function ledger(l) {
  let P = game.players[turnOf()],
    y = game.rules,
    cpIn = y.cp.perTurn,
    cpBank = Math.min(P.cpBank, y.cp.bankCap),
    thIn = l.income,
    thBank = Math.min(P.thrustBank, thIn * y.move.bankTurns),
    rows = [
      ['+' + cpIn, 'command points: new this turn (' + cpIn + ' every turn)'],
      cpBank ? ['+' + cpBank, 'command points: banked from your last turn (max ' + y.cp.bankCap + ')'] : null
    ],
    nm = { m: 'Move', f: 'Fire laser', l: 'Launch', s: 'Scan', d: 'Detonate' },
    ty = { m: 'move', f: 'fire', l: 'launch', s: 'scan', d: 'detonate' };
  for (let a of game.pending) {
    let k = a[0],
      id = a.slice(1).split('.')[0];
    if (nm[k]) rows.push(['\u2212' + y.cost[ty[k]], nm[k] + (k === 'd' ? '' : ' with ' + id)]);
  }
  rows.push(['= ' + l.cp, 'command points left']);
  let th = [['+' + thIn, 'thrust: 1 from each of your ' + thIn + ' working engines']];
  if (thBank) th.push(['+' + thBank, 'thrust: banked (max ' + thIn * y.move.bankTurns + ')']);
  for (let [id, n] of Object.entries(P.moved || {})) {
    let s = game.ships.find((z) => z.id === id);
    if (s && n)
      th.push([
        '\u2212' + n * s.segs.length,
        id + ' moved ' + plural(n, 'hex') + ' \u00D7 ' + s.segs.length + ' segments'
      ]);
  }
  th.push(['= ' + l.thrust, 'thrust left']);
  let mineV = E.view(game, turnOf()).ships.filter((s) => s.mine && s.scan);
  for (let s of mineV) {
    let si = s.scan,
      why =
        si.moved < 1
          ? "can't scan yet: move it first (net " + plural(si.moved, 'hex') + ' from where it started)'
          : 'scan ' +
            si.r[0] +
            ' clear / ' +
            si.r[1] +
            ' faint (' +
            si.name +
            ', ' +
            plural(si.forward, 'row') +
            ' forward)';
    th.push([
      '\u00B7',
      s.id +
        ': ' +
        why +
        (si.next ? '. ' + plural(si.next.rows, 'row') + ' more for ' + si.next.r[0] + '/' + si.next.r[1] : '')
    ]);
    if (s.motionSig)
      th.push([
        '\u00B7',
        s.id +
          ': signature ' +
          (s.motionSig > 0 ? '+' : '\u2212') +
          Math.abs(s.motionSig) +
          (s.motionSig < 0 ? ' for sitting still and quiet this turn' : ' engine wake from a big move')
      ]);
  }
  let det = h(
    'details',
    { class: 'ledger' },
    h('summary', null, 'Why these points?'),
    h(
      'table',
      null,
      rows
        .concat(th)
        .filter(Boolean)
        .map(([a, t]) =>
          h(
            'tr',
            { class: a[0] === '=' ? 'tot' : a[0] === '+' ? 'plus' : a[0] === '\u00B7' ? 'info' : 'minus' },
            h('td', null, a),
            h('td', null, t)
          )
        )
    )
  );
  det.open = ledgerOpen;
  det.addEventListener('toggle', () => (ledgerOpen = det.open));
  return det;
}
function reportCard() {
  if (!report || !report.length) return null;
  return h(
    'div',
    { class: 'card report' },
    h('h2', null, 'Impact report'),
    report.map((r) => {
      let mine = r.t === 'damage',
        sh = game.ships.find((z) => z.id === r.ship);
      return h(
        'div',
        { class: 'rep ' + (mine ? 'mine' : 'theirs') },
        h(
          'div',
          { class: 'rephead' },
          (mine ? 'Your ' : 'Enemy ') +
            r.ship +
            (sh && sh.name && (mine || seat === 'all') ? ' "' + sh.name + '"' : '') +
            ', section ' +
            (r.seg + 1) +
            ': ' +
            plural(r.hits, 'hit') +
            ' from ' +
            nice(r.cause)
        ),
        h(
          'div',
          { class: 'parts' },
          (r.lost || []).length
            ? r.lost.map((s) => {
                let nm0 = s.replace(/ (damaged|down|destroyed)$/, ''),
                  lk = looks[nm0];
                return h(
                  'span',
                  { class: 'chip ' + (/destroyed|wrecked/.test(s) ? 'dead' : 'hurt') },
                  lk ? h('i', { style: 'background:' + lk.color }) : null,
                  s
                );
              })
            : h('span', { class: 'muted' }, r.wrecked ? 'section wrecked' : 'the hits did not get through')
        ),
        r.hull != null
          ? h(
              'div',
              { class: 'hullbar', title: 'Hull integrity ' + r.hull + '%' },
              h('span', {
                style:
                  'width:' +
                  r.hull +
                  '%;background:' +
                  (r.hull > 60 ? 'var(--good)' : r.hull > 30 ? 'var(--accent)' : 'var(--bad)')
              }),
              h('em', null, 'hull ' + r.hull + '%')
            )
          : null,
        sh && sh.dead ? h('div', { class: 'destroyed' }, 'DESTROYED') : null
      );
    })
  );
}

// ---------- panels ----------
function shipCard(x, v) {
  const lines = [];
  if (x.mine || seat === 'all') {
    const st = x.mine && myTurn() ? E.shipStatus(game, x.id) : null;
    if (st) {
      lines.push(st.moveLeft > 0 ? 'Can move ' + plural(st.moveLeft, 'more hex') + ' this turn (' + st.costPerHex + ' thrust per hex).' : 'Cannot move further this turn.');
      const w = [];
      if (st.beams) w.push(st.beamsReady + ' of ' + st.beams + ' lasers ready');
      if (st.launchers) w.push(st.launchersReady ? 'launcher ready' : 'launcher already used this turn');
      for (const [k, n] of Object.entries(st.ammo)) w.push(plural(n, nice(k)) + ' left');
      if (w.length) lines.push('Weapons: ' + w.join(', ') + '.');
    }
    lines.push('Sees small things within ' + plural(x.sensor, 'hex') + ', and bigger ships from further away.');
    // where the signature comes from, term by term
    const sb = x.sigBreak, sgn = (n) => (n > 0 ? '+' + n : '\u2212' + -n);
    const terms = !sb ? [] : ['base ' + sb.base + ' (' + plural(sb.base, 'segment') + ')']
      .concat(sb.stealth ? [sgn(-sb.used) + ' from ' + plural(sb.stealth, 'stealth part') + (sb.used < sb.stealth ? ' (floor ' + sb.floor + ': ' + plural(sb.stealth - sb.used, 'part') + ' spare)' : '')] : [])
      .concat(sb.haze ? [sgn(sb.haze) + ' nebula'] : [])
      .concat(sb.flare ? ['+' + sb.flare + ' flare from firing/launching/scanning'] : [])
      .concat(sb.motion < 0 ? ['\u22121 sitting still'] : sb.motion > 0 ? ['+' + sb.motion + ' engine wake'] : []);
    lines.push('Signature ' + x.signature + (terms.length ? ' = ' + terms.join(', ') : '') + '. An enemy with sensor ' + v.shownSensor + ' spots it from ' + plural(Math.max(0, v.shownSensor + x.signature), 'hex') + '.'
      + (x.signature < 0 ? ' Below zero means it can slip inside their sensor range unseen.' : ''));
    if (!x.mine) lines.push(x.seen ? whyText(x.why) : 'The player to move cannot see this ship.');
  } else lines.push(whyText(x.why));
  if (!x.mine && seat !== 'all') {     // how much this player knows about an enemy ship
    let hp = 0, max = 0;
    for (const sg of x.segs.filter((sg) => sg.parts)) for (const p of sg.parts) if (!game.rules.parts[p.t].recharges) { hp += sg.wrecked ? 0 : Math.max(0, p.hp); max += p.max; }
    lines.unshift(x.tier >= 3 ? 'Detection: \u25A3 full readout (tier 3 of 3). Hull about ' + (max ? Math.round((100 * hp) / max) : 0) + '%.'
      : 'Detection: \u25C6 located (tier 2 of 3). Scan it from close range for a full readout of its parts.');
  }
  const rows = x.segs.map((sg, i) => h('div', null, h('span', { class: 'muted' }, 'Segment ' + (i + 1) + (sg.wrecked ? ' (wrecked)' : '') + (sg.scanned ? ' (as scanned in round ' + sg.scanned + ')' : '')),
    h('div', { class: 'parts' }, sg.parts ? (sg.parts.length ? sg.parts.map((p) => h('span', { class: 'chip' + (p.hp <= 0 ? ' dead' : p.hp < p.max ? ' hurt' : '') }, h('i', { style: 'background:' + looks[p.t].color }), nice(p.t) + (p.max > 1 ? ' ' + p.hp + '/' + p.max : ''))) : h('span', { class: 'muted' }, 'empty')) : h('span', { class: 'muted' }, 'unknown: scan from close range to see inside'))));
  return h('div', { class: 'card who' + x.owner }, h('h2', { style: 'color:var(--me)' }, x.id + (x.name ? ' "' + x.name + '"' : '') + (x.flagship ? ' (flagship)' : '') + (x.mine ? '' : ' (enemy)')), lines.map((l) => h('p', null, l)), rows);
}
function codeBox(label, text, button) {
  const ta = h('textarea', { readonly: true, 'aria-label': label }, text);
  return h('div', { class: 'card' }, h('h2', null, label), ta, h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => {
    const done = () => { say('Copied.'); render(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => ta.select());
    else { ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} }
  } }, button)));
}
function pasteBox(label, button, onText) {
  const ta = h('textarea', { 'aria-label': label, placeholder: 'Paste here' });
  return h('div', { class: 'card' }, h('h2', null, label), ta, h('div', { class: 'row' }, h('button', { class: 'btn go', onclick: () => onText(ta.value) }, button)));
}

// ---------- render ----------
export function render() {
  // one compact game-mode picker
  const seatEl = $('#seat'); seatEl.textContent = '';
  const modeSel = h('select', { 'aria-label': 'Game mode', onchange: (ev) => {
    let val = ev.target.value;
    if (val.indexOf('cpu') === 0) { aiLevel = val === 'cpu-easy' ? 'easy' : 'normal'; store.set('shatkon.ai', aiLevel); val = 'cpu'; }
    seat = val === '0' || val === '1' ? Number(val) : val;
    sel = look = pending = null; mode = 'move'; cam.w = 0; undoStack = [];
    curtain = seat === 'pass' && game && game.phase === 'play' ? turnOf() : null;
    say({ cpu: 'Playing against the computer. You are Player 1.', pass: 'Pass and play: each player only sees what their own fleet sees. Hand the device over between turns.',
      all: 'Both players: everything is visible, handy for learning or testing.' }[seat] || 'Two devices: you are Player ' + (seat + 1) + '. Send your opponent the game code (Game card below), then swap turn codes.');
    save(); render();
  } });
  for (const [val, label] of [['cpu-easy', 'Vs computer: easy'], ['cpu', 'Vs computer: normal'], ['pass', 'Pass and play'], ['all', 'Both players (open)'], [0, 'Two devices: Player 1'], [1, 'Two devices: Player 2']]) {
    const op = h('option', { value: String(val) }, label);
    if (val === 'cpu-easy' ? seat === 'cpu' && aiLevel === 'easy' : val === 'cpu' ? seat === 'cpu' && aiLevel !== 'easy' : seat === val) op.selected = true;
    modeSel.appendChild(op);
  }
  seatEl.appendChild(modeSel);
  const sfxBtn = $('#sfx');
  if (sfxBtn) { sfxBtn.textContent = sfxOn ? '\u{1F50A}' : '\u{1F507}'; sfxBtn.setAttribute('aria-label', sfxOn ? 'Sound on' : 'Sound off'); sfxBtn.setAttribute('aria-pressed', String(sfxOn)); }
  setFlip(game && (seat === 1 || (seat === 'pass' && turnOf() === 1)) ? -1 : 1);   // your own side is always at the bottom

  // pass and play: a curtain between turns so the next player cannot see the last one's fleet
  const cur = $('#curtain');
  if (cur) {
    cur.textContent = '';
    if (game && curtainUp() && game.phase === 'play') {
      const p = curtain;
      cur.hidden = false;
      fill(cur, [h('div', { class: 'curtain-box who' + p }, h('div', { class: 'big' }, 'Player ' + (p + 1) + '\'s turn'),
        h('p', null, 'Hand the device to Player ' + (p + 1) + '. Player ' + (2 - p) + ', no peeking at the board!'),
        h('button', { class: 'btn go', onclick: () => {
          curtain = null; yourTurnPing(); render();
          const pf = pendingFx; pendingFx = null;
          if (pf) setTimeout(() => playFx(pf[0], pf[1], pf[2]), 200);
          toast('Player ' + (p + 1) + '\'s turn', 'p' + p);
        } }, 'I\'m Player ' + (p + 1) + ': show my fleet'))]);
    } else cur.hidden = true;
  }
  $('#problems').textContent = '';
  if (problems.length) $('#problems').appendChild(h('div', { class: 'card warn' }, h('h2', null, 'The rule files have problems'), problems.map((p) => h('p', null, p))));
  const bar = $('#turnbar'), fleet = $('#fleet'), tools = $('#tools'), wrap = $('#wrap'), panels = $('#panels'), hintEl = $('#hint'), camEl = $('#camera');
  for (const e of [bar, fleet, tools, panels, camEl]) e.textContent = '';
  if (!game) { hintEl.textContent = 'Loading the rules.'; return; }
  if (!cam.w) wholeMap();
  const v = E.view(game, who()), turn = turnOf(), mine = myTurn(), R = game.rules;
  if (sel && !v.ships.some((x) => x.id === sel && x.mine)) sel = null;

  // turn bar: whose turn, where we are in the round, what is left to spend
  bar.className = 'who' + (game.phase === 'over' && v.winner !== 'draw' ? v.winner : turn);
  const stepNames = game.order.map((p) => 'Player ' + (p + 1)).concat('Flight');
  fill(bar, [h('div', { class: 'big' }, game.phase === 'over' ? (v.winner === 'draw' ? 'The game is a draw' : seat === 'cpu' ? (v.winner === 0 ? 'You win!' : 'The computer wins') : isCodes() && v.winner === seat ? 'You win!' : 'Player ' + (v.winner + 1) + ' wins')
      : mine ? (seat === 'all' || seat === 'pass' ? 'Player ' + (turn + 1) + '\'s turn' : 'Your turn') : aiTurn() ? 'The computer is thinking\u2026' : 'Waiting for player ' + (turn + 1)),
    h('div', { class: 'line' }, h('span', null, 'Round ', h('b', { class: 'n' }, Math.min(v.round, R.turnLimit)), ' of ' + R.turnLimit), stepNames.map((n, i) => h('span', { class: 'stepchip' + (game.phase === 'play' && i === game.turn ? ' now' : '') }, n))),
    mine ? h('div', { class: 'line' },
      h('span', null, 'Command points ', h('span', { class: 'pips', 'aria-label': v.cp + ' command points' }, '●'.repeat(Math.min(v.cp, 12)), h('i', null, '●'.repeat(Math.max(0, R.cp.perTurn - v.cp)))), ' ', h('b', { class: 'n' }, v.cp)),
      h('span', null, 'Thrust ', h('b', { class: 'n' }, v.thrust), ' (moving costs 1 per segment per hex)'), v.cp === 1 ? h('span', { class: 'lastpill' }, 'LAST ACTION') : null) : null,
    mine ? ledger(v) : null]);

  // fleet strip: every ship of the player to move, with what it has left
  if (mine) for (const x of v.ships.filter((s) => s.mine)) {
    const st = E.shipStatus(game, x.id), stat = (label, val, zero) => h('span', { class: zero ? 'zero' : '' }, label + ' ', h('b', null, val));
    fleet.appendChild(h('button', { class: 'shipchip who' + x.owner, 'aria-pressed': String(sel === x.id), onclick: () => { selectShip(x.id, v); render(); } },
      h('div', { class: 'nm' }, (x.flagship ? '★ ' : '') + x.id + ' ' + x.name),
      h('div', { class: 'st' }, stat('Move', st.moveLeft, !st.moveLeft), st.beams ? stat('Lasers', st.beamsReady + '/' + st.beams, !st.beamsReady) : null,
        Object.entries(st.ammo).map(([k, n]) => stat(nice(k) + 's', n, !n)))));
  }

  // board
  const opts = options(v);
  const plan = pending && pending.type === 'launch' ? E.forecast(game, pending) : null;
  let ghost = null;
  if (pending && pending.type === 'move') {
    const ship = v.ships.find((x) => x.id === pending.ship), to = pending.path.reduce((c, d) => hex.step(c, d), ship.pos);
    ghost = { from: ship.pos, to, cells: ship.segs.map((sg) => [to[0] + sg.off[0], to[1] + sg.off[1]]), owner: ship.owner };
  }
  const plans = v.objs.filter((o) => o.mine && game.phase === 'play').map((o) => ({ id: o.id, f: E.forecast(game, o.id) })).filter((x) => x.f);
  wrap.textContent = '';
  wrap.appendChild(drawBoard({ view: v, rules: R, looks, cam, sel, opts, plan, plans, ghost, seat, box: wrap, onTap: (c) => tap(c, v, opts), pending, hidden: curtainUp() }));
  fill(camEl, [h('button', { 'aria-label': 'Zoom out', onclick: () => { zoomBy(1.4); render(); } }, '−'), h('button', { 'aria-label': 'Zoom in', onclick: () => { zoomBy(0.7); render(); } }, '+'),
    h('button', { onclick: () => { const from = cam.w > 0 ? { x: cam.x, y: cam.y, w: cam.w } : null; wholeMap(); render(); camTween(from); } }, 'Whole map')]);

  // actions
  if (mine && pending) {
    fill(tools, [h('button', { class: 'btn go', onclick: () => act(pending) }, pending.type === 'move' ? 'Move here' : pending.type === 'scan' ? 'Scan now' : 'Launch ' + nice(pending.kind)), h('button', { class: 'btn', onclick: () => { pending = null; say('Cancelled.'); render(); } }, 'Cancel')]);
  } else if (mine) {
    const me = sel && v.ships.find((x) => x.id === sel), st = me ? E.shipStatus(game, sel) : null, lo = me ? E.launchOptions(game, sel) : null;
    const shots = me ? E.beamTargets(game, sel) : [];
    const help = { move: 'Tap a green marker to see where the ship would end up, then tap it again to move.', fire: 'Tap a red ring to fire at it. The number is how many hits it will do.',
      missile: 'Tap an amber ring to lock on to that ship, or a blue dot to send the missile straight out that way. You will see its path before it launches.',
      seeker_drone: 'Tap a blue dot to send the drone out that way. It wanders and reports what it sees.', scan: 'Scan preview shown. Press Scan now.', detonate: 'Tap one of your drones to blow it up.' };
    const btn = (m, label, sub, on, cells) => h('button', { class: 'btn', 'aria-pressed': String(mode === m && on), disabled: !on, onclick: () => { mode = m; pending = null; say(help[m]); if (cells && cells.length) frame(cells, selZoom()); render(); } }, label, h('small', null, sub));
    const launchWhy = (kind) => !st ? 'select a ship' : !st.launchers ? 'no launcher' : !(st.ammo[kind] > 0) ? 'none left' : !st.launchersReady ? 'launcher used' : st.ammo[kind] + ' left';
    const foes = v.ships.filter((x) => !x.mine && x.seen);
    fill(tools, [
      btn('move', 'Move', !st ? 'select a ship' : st.moveLeft ? 'up to ' + st.moveLeft : 'no moves left', !!st && st.moveLeft > 0, me && me.cells),
      btn('fire', 'Fire', !st ? 'select a ship' : !st.beams ? 'no laser' : !st.beamsReady ? 'already fired' : shots.length ? plural(new Set(shots.map((t) => t.target)).size, 'target') : 'nothing in range', shots.length > 0, me ? me.cells.concat(shots.map((t) => t.at)) : null),
      btn('missile', 'Missile', launchWhy('missile'), !!lo && lo.kinds.includes('missile'), me ? me.cells.concat(foes.filter((f) => lo && lo.locks.includes(f.id)).flatMap((f) => f.cells)) : null),
      btn('seeker_drone', 'Drone', launchWhy('seeker_drone'), !!lo && lo.kinds.includes('seeker_drone'), me && me.cells),
      // a scan pings everything around the ship; it needs the ship to have moved this turn
      h('button', { class: 'btn', disabled: !(st && st.scanReady), onclick: () => {
        mode = 'scan'; pending = { type: 'scan', ship: sel }; cam.w = 0;
        const [r1, r2] = me.scanR;
        say('Scan preview (' + me.scan.name + ', ' + plural(me.scan.forward, 'row') + ' from your edge): everything inside the green ring (' + r1 + ' hexes) gets a full readout, hidden mines included. The amber ring ('
          + r2 + ' hexes) only picks up faint contacts. ' + scanNextText(me.scan) + ' Scanning lights your ship up for a round. Press Scan now.');
        render();
      } }, 'Scan', h('small', null, !st ? 'select a ship' : st.scanReady ? 'radius ' + me.scanR[0] + ' / ' + me.scanR[1] : me.used && me.used.scan ? 'already scanned' : !v.cp ? 'no points' : st.scanMoved < 1 ? 'move first' : 'not now'),
        st && !st.scanReady && st.scanMoved < 1 && !(me.used && me.used.scan) && v.cp ? h('small', null, 'then ' + me.scan.r[0] + ' / ' + me.scan.r[1]) : null),
      v.objs.some((o) => o.mine && R.munitions[o.kind].remote_detonate) ? btn('detonate', 'Detonate', 'a drone', v.cp >= R.cost.detonate, null) : null,
      h('span', { class: 'sp' }),
      undoStack.length ? h('button', { class: 'btn', onclick: undo, title: 'Undo (Ctrl+Z)' }, 'Undo', h('small', null, 'last ' + ({ m: 'move', l: 'launch' }[(game.pending[game.pending.length - 1] || '')[0]] || 'action'))) : null,
      h('button', { class: 'btn go' + (v.cp === 1 ? ' last' : ''), onclick: () => act({ type: 'end' }) }, v.cp === 1 ? 'Last action' : 'End turn',
        h('small', null, v.cp === 1 ? 'your turn ends after it \u00B7 tap to end now' : v.cp ? 'banks ' + plural(Math.min(v.cp, R.cp.bankCap), 'point') : ''),
        v.cp >= R.cost.fire && v.ships.some((z) => z.mine && E.beamTargets(game, z.id).length) ? h('small', { class: 'warnnote' }, '\u26A0 laser can fire') : null)]);
  }

  const rc = reportCard();
  if (rc) panels.appendChild(rc);
  if (game.phase === 'over') {
    const lost = (k) => game.ships.filter((z) => z.owner === k && z.dead).length + '/' + game.ships.filter((z) => z.owner === k).length;
    panels.appendChild(h('div', { class: 'card over who' + (v.winner === 'draw' ? turn : v.winner) },
      h('h2', null, v.winner === 'draw' ? 'Draw' : seat === 'cpu' ? (v.winner === 0 ? 'Victory! The enemy flagship is destroyed.' : 'Defeat. Your flagship was destroyed.') : 'Player ' + (v.winner + 1) + ' wins'),
      h('p', null, 'Finished in round ' + Math.min(v.round, R.turnLimit) + '. Ships lost: ' + game.players.map((pl, k) => 'Player ' + (k + 1) + ' ' + lost(k)).join(', ') + '. The whole board is revealed above.'),
      h('div', { class: 'row' }, h('button', { class: 'btn go', onclick: () => newGame() }, 'Play again'))));
  }

  hintEl.className = hintErr ? 'err' : '';
  hintEl.textContent = hint || (mine ? 'Tap one of your ships to select it.' : aiTurn() ? 'The computer is taking its turn\u2026' : '');

  // what happened since this player last acted
  if (game.phase === 'play' && mine && v.news.length)
    panels.appendChild(h('div', { class: 'card news' }, h('h2', null, v.round === 1 ? 'What you know so far' : 'Since your last turn'), h('ul', { class: 'feed' }, v.news.slice(-10).map((e) => h('li', null, describe(e))))));

  const shown = v.ships.find((x) => x.id === (sel || look));
  if (shown) panels.appendChild(shipCard(shown, v));
  if (game.phase === 'play' && isCodes() && !mine)
    panels.appendChild(pasteBox('Paste player ' + (turn + 1) + '\'s turn code:', 'Play their turn', (text) => {
      try { game = E.applyTurnCode(game, text); code = ''; report = makeReport(game.events, seat); setTimeout(() => playFx(game.events, seat, game.flight), 60); say('Their turn has been played. Yours now.'); save(); }
      catch (e) { say(e.message.charAt(0).toUpperCase() + e.message.slice(1) + '.', true); }
      render();
    }));
  if (code && isCodes()) panels.appendChild(codeBox('Your turn code: send this to your opponent', code, 'Copy turn code'));

  panels.appendChild(h('div', { class: 'card' }, h('h2', null, 'Key'),
    h('div', { class: 'parts' }, Object.entries(looks).map(([name, l]) => h('span', { class: 'chip' }, h('i', { style: 'background:' + l.color }), l.letter + ' ' + nice(name)))),
    h('p', { class: 'muted' }, 'Detection tiers: a red fuzzy circle with "?" means something is roughly there (tier 1); \u25C6 after a ship\u2019s name means you know exactly where it is (tier 2); \u25A3 means a fresh scan shows every part (tier 3). Zoom in to see the parts inside each segment: three inner hexagons (bays) and three corner diamonds (mounts). Dark slots are destroyed. The darker area of the board is outside your sensor range. With "Both players" chosen, faded enemy pieces are ones the player to move cannot see.')));
  if (v.feed.length) panels.appendChild(h('div', { class: 'card' }, h('h2', null, 'Earlier'), h('ul', { class: 'feed' }, v.feed.slice(-12).reverse().map((e) => h('li', null, 'Round ' + e.r + ': ' + describe(e))))));
  panels.appendChild(h('div', { class: 'card' }, h('h2', null, 'Game'), h('div', { class: 'row' },
    h('button', { class: 'btn', onclick: () => { if (!game || game.phase === 'over' || confirm('Start a new game? The current one will be replaced.')) newGame(); } }, 'New game'),
    h('button', { class: 'btn', onclick: async () => { const c = await E.exportGame(game); panels.appendChild(codeBox('Game code: the whole game, to start or recover one', c, 'Copy game code')); } }, 'Show game code')),
    h('p', { class: 'muted' }, 'To play on two phones: one player starts a new game and sends the game code. After that you only swap turn codes. Each phone holds the full game, so the fog relies on neither of you looking at the other seat.')));
  panels.appendChild(pasteBox('Load a game code', 'Load game', async (text) => {
    try { game = await E.importGame(text); looks = partLooks(game.rules); sel = look = pending = null; code = ''; cam.w = 0; say('Game loaded.'); save(); }
    catch (e) { say(e.message.charAt(0).toUpperCase() + e.message.slice(1) + '.', true); }
    render();
  }));
  // the computer moves after the animations have had time to play
  if (aiTurn() && !aiTimer) aiTimer = setTimeout(aiStep, Math.max(1000, fxBusyUntil - performance.now() + 400));
}

function initExtras() {
  let hp = $('#help'),
    showHelp = (on) => {
      hp.hidden = !on;
      if (on) $('#helpclose').focus();
      else store.set('shatkon.help', '1');
    };
  if (hp) {
    showHelp(store.get('shatkon.help') !== '1');
    $('#helpclose').addEventListener('click', () => showHelp(false));
    hp.addEventListener('click', (ev) => ev.target === hp && showHelp(false));
    document.addEventListener(
      'keydown',
      (ev) => ev.key === 'Escape' && !hp.hidden && (ev.stopImmediatePropagation(), showHelp(false)),
      { capture: true }
    );
    $('#helpbtn').addEventListener('click', () => showHelp(true));
  }
  if ($('#sfx'))
    $('#sfx').addEventListener('click', () => {
      sfxOn = !sfxOn;
      store.set('shatkon.sfx', sfxOn ? '1' : '0');
      render();
      tone(660, 660, 0.08, 'sine', 0.06);
    });
  let unlock = () => {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    } catch {}
  };
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('keydown', (ev) => {
    if (!game || /^(TEXTAREA|INPUT|SELECT)$/.test((ev.target || {}).tagName || '')) return;
    if (ev.key === 'Escape') {
      if (pending) {
        pending = null;
        say('Cancelled.');
        render();
      } else if (sel) {
        sel = look = null;
        mode = 'move';
        say('');
        render();
      }
    } else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && undoStack.length) {
      ev.preventDefault();
      undo();
    }
  });
  let wheelAcc = 0,
    wheelRaf = 0;
  $('#wrap').addEventListener(
    'wheel',
    (ev) => {
      if (!game) return;
      ev.preventDefault();
      wheelAcc += ev.deltaY;
      if (!wheelRaf)
        wheelRaf = requestAnimationFrame(() => {
          wheelRaf = 0;
          zoomBy(Math.exp(Math.max(-1, Math.min(1, wheelAcc * 0.0025))));
          wheelAcc = 0;
          render();
        });
    },
    { passive: false }
  );
}

(async function main() {
  render();
  try { await loadRules(); } catch (e) { $('#hint').textContent = 'Could not load the rule files: ' + e.message; return; }
  const savedSeat = store.get('shatkon.seat');
  if (savedSeat === '0' || savedSeat === '1') seat = Number(savedSeat);
  else if (savedSeat === 'all' || savedSeat === 'pass' || savedSeat === 'cpu') seat = savedSeat;
  sfxOn = store.get('shatkon.sfx') !== '0';
  aiLevel = store.get('shatkon.ai') === 'easy' ? 'easy' : 'normal';
  initExtras();
  const saved = store.get('shatkon.game');
  if (saved) {
    try {
      game = await E.importGame(saved); looks = partLooks(game.rules);
      if (seat === 'pass' && game.phase === 'play') curtain = turnOf();
      say('Your saved game has been restored.');
    } catch (e) { game = null; }
  }
  // a small hook for automated tests
  window.__shatkon = { get game() { return game; }, get camBusy() { return performance.now() < camUntil; }, get flip() { return FL; }, E, lab: labAPI };
  labRoute();
  if (!game) newGame(); else render();
  window.addEventListener('resize', () => { if (game) render(); });
})();
