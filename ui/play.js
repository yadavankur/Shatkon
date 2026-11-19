// The play screen. It draws one player's view from the engine and sends actions
// back. It holds no game rules: everything it shows comes from the engine.

import * as E from '../engine/index.js';
import { computerMove } from '../engine/ai.js';
import { drawBoard, partLooks, S, W, FL, setFlip, X, Y, f1, s as svgEl, setModels, modelFor } from './board.js';
import { setLabDocs, labApplyPlayRules, labRoute, labAPI } from './lab.js';
import { initStory, openCampaign, openTest, resumeStory, storyEvents, storyBusy, storyObjective, storyOverText, retryChapter } from './campaign.js';
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
// A phone held sideways gets the compact layout: the board fills the whole screen and the controls sit
// in the empty corners beside it (status top left, ship card bottom left, orders and End turn bottom right).
const compactMQ = window.matchMedia ? matchMedia('(orientation: landscape) and (max-height: 540px)') : null;
const isCompact = () => !!(compactMQ && compactMQ.matches) && !!$('main') && !$('main').hidden;
let wasCompact = null;
const put = (node, parent) => { if (node && parent && node.parentNode !== parent) parent.appendChild(node); };
const HDR = { seat: $('#seat'), sfx: $('#sfx'), help: $('#helpbtn'), menu: $('#menubtn'), tabs: $('#tabs') };
// Installing the game (a home-screen icon that opens full screen, sideways, with no browser bars).
let installEvt = null;
window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); installEvt = ev; if (game) render(); });
window.addEventListener('appinstalled', () => { installEvt = null; if (game) render(); });
const installed = () => !!((window.matchMedia && (matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches)) || navigator.standalone);
async function toggleFull() {      // full screen, and held sideways where the browser can do that (not on iPhones)
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); try { await screen.orientation.lock('landscape'); } catch (e) {} }
  } catch (e) {}
}
let undoStack = [];               // states before undoable actions this turn
let endArmed = false;             // End turn was pressed once with points still to spend: the next press ends it
let endArmedAt = 0;               // ...when (a second press this soon is a double tap, not a decision)
let curtain = null;               // pass and play: the player waiting behind the curtain
let aiTimer = null, aiSteps = 0, aiLevel = 'normal';
let report = null;                // last impact report shown on this screen
let pendingFx = null;             // animations held back until the curtain lifts
let ledgerOpen = false, sfxOn = true, actx = null;
let shipStyle = 'hull', haveModels = false;   // how ships are drawn: 'hull' (ui/ships.js), 'schematic' (parts and slots) or 'model' (art, where a ship has some)
let drawerOpen = false, drawerSeen = '', detailsOpen = false;
// play.html?board=NAME plays the board in rules/boards/NAME.yaml (its own map, fleets and rule changes), with its own saves
const BOARD = (() => { try { const b = new URLSearchParams(location.search).get('board'); return b && /^[\w-]+$/.test(b) ? b : null; } catch (e) { return null; } })();
const KEYS = (k) => k + (BOARD ? '.board.' + BOARD : '');   // each board keeps its own saves
export const store = { get(k) { try { return localStorage.getItem(KEYS(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(KEYS(k), v); } catch (e) {} } };
// The old /beta/ page kept its saves under shatkon.beta.*. Beta is now the main game: once, copy those saves
// across to the main names where the main game has nothing of its own yet (the beta copies are left alone).
try {
  if (!localStorage.getItem('shatkon.betaMoved')) {
    const old = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('shatkon.beta.')) old.push(k); }
    for (const k of old) { const to = 'shatkon.' + k.slice(13); if (localStorage.getItem(to) === null) localStorage.setItem(to, localStorage.getItem(k)); }
    localStorage.setItem('shatkon.betaMoved', '1');
  }
} catch (e) {}

async function loadRules() {
  let texts = window.SHATKON_RULES || null;
  if (!texts) {
    const stamp = '?t=' + Date.now(), get = async (n) => { const r = await fetch('rules/' + n + stamp); if (!r.ok) throw new Error('could not read rules/' + n); return r.text(); };
    const names = YAML.parse(await get('index.yaml')).files;
    texts = {};
    for (const n of names) texts[n] = await get(n);
  }
  const parsed = Object.fromEntries(Object.entries(texts).map(([n, t]) => [n, YAML.parse(t)])), docs = Object.values(parsed);
  let world = docs.find((d) => d && d.bay_parts), fleets = docs.find((d) => d && d.budget !== undefined && !d.bay_parts);
  // the fleets file names its map; with several maps listed, that one is played
  const named = fleets && parsed[fleets.map];
  let map = named && named.map ? named : docs.find((d) => d && d.map);
  if (BOARD) {   // one file holds the board's map, both fleets, and the world numbers it changes
    const r = await fetch('rules/boards/' + BOARD + '.yaml?t=' + Date.now());
    if (!r.ok) throw new Error('could not read rules/boards/' + BOARD + '.yaml');
    const b = YAML.parse(await r.text());
    world = structuredClone(world);
    for (const [k, v] of Object.entries((b.board || {}).rules || {})) { const ks = k.split('.'); let o = world; for (const x of ks.slice(0, -1)) o = o[x] = o[x] ?? {}; o[ks.at(-1)] = v; }
    map = fleets = b;
    if (b.board && b.board.name) document.title = b.board.name + ' · Shatkon';
  }
  const built = E.buildRules(world, map, fleets);
  rules = built.rules; problems = built.problems;
  setLabDocs({ world, map, fleets });   // the Lab builds its variants from the same files
  labApplyPlayRules();                  // ...and may swap in Lab fleets or rule changes
}

// The Lab replaces the rules new games use (Lab fleets, rule knobs).
export function setRules(r, p) { rules = r; problems = p; }

// Wall-clock times go into the save (and so into the battle log): when the game started, when each turn
// ended, and when it was last played. Only turns played on this page are stamped: a save loaded from an older
// version, or a game code from the other phone, keeps whatever times it came with (stampFrom).
let stampFrom = 0;
function stampTimes() {
  const now = new Date().toISOString(), hist = game.history || [];
  for (let i = Math.min(stampFrom, hist.length); i < hist.length; i++) if (!hist[i].at) hist[i].at = now;
  stampFrom = hist.length;
  game.updated = now;
}
function save() {
  if (game) { stampTimes(); E.exportGame(game).then((c) => store.set('shatkon.game', c)); rememberLast(); }
  store.set('shatkon.seat', String(seat));
}
// what the landing page's Continue shows: the last game played, wherever it was
function rememberLast() {
  try {
    const C = game.rules.campaign;
    localStorage.setItem('shatkon.last', JSON.stringify({ board: BOARD, seat, story: !!C, title: C ? C.title : null, round: Math.min(game.round, game.rules.turnLimit), over: game.phase === 'over', at: Date.now() }));
  } catch (e) {}
}
export function say(text, err) { hint = text; hintErr = !!err; }
// Whose eyes the screen shows: both, one seat, the player to move (pass and play), or you (vs computer).
// Once a game is over everything is shown.
const who = () => (game && game.phase === 'over' && (seat === 'cpu' || seat === 'pass') ? 'all' : seat === 'all' ? 'all' : seat === 'pass' ? turnOf() : seat === 'cpu' ? 0 : seat);
const turnOf = () => game.order[game.turn];
const myTurn = () => game && game.phase === 'play' && (seat === 'all' || seat === 'pass' || (seat === 'cpu' ? turnOf() === 0 : turnOf() === seat));
const isCodes = () => seat === 0 || seat === 1;
const aiTurn = () => seat === 'cpu' && game && game.phase === 'play' && turnOf() === 1;
// A ship the player can give orders to right now. Story chapters fly some ships themselves
// (helm: script) or lock them; those take no orders, so tapping them opens no panel.
function canCommand(x, v) {
  if (!x || !x.mine || !myTurn() || curtainUp()) return false;
  return !(v.story && (v.story.locked.includes(x.name) || (v.story.auto || []).includes(x.name)));
}
const pretty = (n) => String(n || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
// what to call a ship: its name in a story chapter, its name or id otherwise
const shipName = (x) => (x && x.name ? (game && game.rules.campaign ? pretty(x.name) : x.name) : x ? x.id : '');
function curtainUp() {
  return curtain !== null && seat === 'pass';
}
function selZoom() {
  return $('#wrap').clientWidth > 600 ? 9 : 6;
}
// Smooth camera moves. The board is drawn once, at the target camera. During the glide the SVG keeps
// one fixed viewBox (the wider of the two views, so nothing is cut off) and only its CSS transform
// changes: the phone's GPU moves the picture it already has instead of redrawing every hex, ship and
// glow on every frame (changing the viewBox each frame did that, which made double-tap zoom feel slow).
// The sharp view is put back at the end. The clock starts on the first frame, so a slow redraw just
// before the glide cannot eat into it.
// `after` (optional) runs when the glide ends: double-tap zoom passes render, so the glide starts at once
// on the picture already on screen and the board is redrawn at the new detail level when it stops.
let camTw = 0, renders = 0;
let camUntil = 0;
let glideEnd = null;            // finishes the running glide at once (a new glide, or a finger on the board)
function camTween(from, after) {
  if (glideEnd) glideEnd();
  const now0 = () => { if (after) after(); };
  if (reduceMotion || !from || !(from.w > 0)) return now0();
  const to = { x: cam.x, y: cam.y, w: cam.w };
  if (![to.x, to.y, to.w, from.x, from.y, from.w].every(isFinite)) return now0();
  if (Math.abs(to.w - from.w) < 1e-3 && Math.hypot(to.x - from.x, to.y - from.y) < 1e-3) return now0();
  const id = ++camTw, dur = 380, V = from.w >= to.w ? from : to;      // the fixed view drawn during the glide
  let t0 = 0, held = null;
  camUntil = performance.now() + dur + 60;
  const vbox = (c, box) => { const hh = (c.w * box.clientHeight) / box.clientWidth; return [c.x - c.w / 2, c.y - hh / 2, c.w, hh].map(f1).join(' '); };
  const r0 = renders;
  const finish = (fingerDown) => {
    if (glideEnd !== finish) return;
    glideEnd = null; camUntil = 0;
    const box = $('#wrap'), svg = $('#wrap svg');
    if (svg) { svg.style.transform = ''; if (box && box.clientWidth) svg.setAttribute('viewBox', vbox(cam, box)); }
    miniView(cam);
    if (!after) return;
    // A finger landed mid-glide: redraw once it lifts (and only if its tap did not redraw already), so the
    // board is not swapped out from under a tap that is still in progress.
    if (fingerDown) addEventListener('pointerup', () => setTimeout(() => { if (renders === r0) after(); }, 0), { once: true });
    else if (renders === r0) after();
  };
  glideEnd = finish;
  const step = (now) => {
    if (id !== camTw || glideEnd !== finish) return;
    if (!t0) t0 = now;
    const box = $('#wrap'), svg = $('#wrap svg');
    if (!svg || !box || !box.clientWidth) return finish();
    const k = Math.min(1, (now - t0) / dur), ez = 1 - Math.pow(1 - k, 3);
    if (k >= 1) return finish();
    if (held !== svg) {          // first frame, or the board was redrawn mid-glide: set it up for the glide
      held = svg;
      svg.style.transformOrigin = '50% 50%';
      svg.setAttribute('viewBox', vbox(V, box));
    }
    const w = from.w + (to.w - from.w) * ez, x = from.x + (to.x - from.x) * ez, y = from.y + (to.y - from.y) * ez;
    const px = box.clientWidth / w;     // screen pixels per board unit at this point of the glide
    svg.style.transform = 'translate(' + ((V.x - x) * px).toFixed(2) + 'px,' + ((V.y - y) * px).toFixed(2) + 'px) scale(' + (V.w / w).toFixed(4) + ')';
    miniView({ x, y, w });
    requestAnimationFrame(step);
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
  moveAnims = [];
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
const colOf = (p) => (p === 0 ? '#7fd8f0' : '#ff8bd8');   // team colours (ui/ships.js TEAM)
const col2Of = (p) => (p === 0 ? '#3a8dff' : '#c46bff');  // second team tone: blue / violet
const WARN = '#e0a84a';                                     // muted amber: warnings only (your ship hurt)
const rgbaOf = (hx, a) => 'rgba(' + [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16)).join(',') + ',' + a + ')';
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
function boomFx(at, delay, big, col) {
  col = col || '#cfe8ff';
  let parts = Array.from({ length: big ? 28 : 16 }, () => [Math.random() * 6.283, 0.4 + Math.random() * 0.9]);
  fx(
    900,
    (x, t) => {
      let a = hexPx(at);
      if (!a) return;
      let u = hexUnit() * (big ? 1.6 : 1.1),
        g = x.createRadialGradient(a[0], a[1], 0, a[0], a[1], u * (0.4 + t));
      g.addColorStop(0, 'rgba(255,255,255,' + (1 - t) + ')');
      g.addColorStop(0.4, rgbaOf(col, 0.8 * (1 - t)));
      g.addColorStop(1, rgbaOf(col, 0));
      x.fillStyle = g;
      x.beginPath();
      x.arc(a[0], a[1], u * (0.4 + t), 0, 7);
      x.fill();
      x.fillStyle = rgbaOf(col, 1 - t);
      for (let [ang, sp] of parts) {
        x.beginPath();
        x.arc(a[0] + Math.cos(ang) * u * sp * t * 1.4, a[1] + Math.sin(ang) * u * sp * t * 1.4, 1.6, 0, 7);
        x.fill();
      }
    },
    delay
  );
  ringFx(at, col, big ? 2.2 : 1.5, 800, delay, 4);
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
// a hit: on your own ship it is a warning (amber); on theirs it is in the attacker's colours
function impactFx(r, delay, mine) {
  let col = mine ? WARN : colOf(1 - ownerOfId(r.ship));
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
  const own = ownerOfId(r.ship), c1 = colOf(own), c2 = col2Of(own);
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
      g.addColorStop(0, rgbaOf(c1, 0));
      g.addColorStop(1, rad < R1 ? rgbaOf(c1, 0.45) : rgbaOf(c2, 0.35));
      x.fillStyle = g;
      x.beginPath();
      x.arc(a[0], a[1], rad, 0, 7);
      x.fill();
      x.strokeStyle = c1;
      x.lineWidth = 1.5;
      x.setLineDash([5, 5]);
      x.beginPath();
      x.arc(a[0], a[1], R1, 0, 7);
      x.stroke();
      x.strokeStyle = c2;
      x.beginPath();
      x.arc(a[0], a[1], R2, 0, 7);
      x.stroke();
      x.setLineDash([]);
      let ang = t * 6.283 * 1.5;
      x.strokeStyle = rgbaOf(c1, 0.8);
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
// Ships glide from hex to hex. The board always draws the true position; while a move is being
// shown, the ship's drawing is shifted back along the way it came and the shift shrinks to nothing.
let moveAnims = [];   // { id, from: [q, r], to: [q, r], t0, dur }
let animRaf = 0;
function animPos(id, now) {
  let last = null;
  for (const a of moveAnims) {
    if (a.id !== id) continue;
    if (now < a.t0) return last ? last.to : a.from;
    if (now < a.t0 + a.dur) { const k = (now - a.t0) / a.dur, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; return [a.from[0] + (a.to[0] - a.from[0]) * e, a.from[1] + (a.to[1] - a.from[1]) * e]; }
    last = a;
  }
  return null;
}
function shipOffset(id, pos) {
  if (!moveAnims.length) return null;
  const p = animPos(id, performance.now());
  return p ? [X(p) - X(pos), Y(p) - Y(pos)] : null;
}
function animTick(now) {
  animRaf = 0;
  const wrap = $('#wrap'), live = new Set();
  for (const a of moveAnims) if (now < a.t0 + a.dur) live.add(a.id);
  for (const id of new Set(moveAnims.map((a) => a.id))) {
    const g = wrap && wrap.querySelector('g[data-ship="' + id + '"]');
    if (!g) continue;
    const s0 = game && game.ships.find((z) => z.id === id), off = live.has(id) && s0 ? shipOffset(id, s0.pos) : null;
    if (off) g.setAttribute('transform', 'translate(' + f1(off[0]) + ',' + f1(off[1]) + ')'); else g.removeAttribute('transform');
  }
  moveAnims = moveAnims.filter((a) => live.has(a.id));
  if (moveAnims.length) animRaf = requestAnimationFrame(animTick);
}
function moveFx(r, delay) {
  if (reduceMotion) return 0;
  const dur = Math.min(950, 280 + 170 * r.steps);
  moveAnims.push({ id: r.ship, from: r.from, to: r.to, t0: performance.now() + delay, dur });
  if (!animRaf) animRaf = requestAnimationFrame(animTick);
  return dur;
}
// the hurl: the ship is gone from the state, so its hexes are drawn flying into the target
function ramFx(r, delay) {
  if (!r.from || !r.from.length) return 0;
  const near = r.from.reduce((a, c) => (hex.dist(c, r.at) < hex.dist(a, r.at) ? c : a), r.from[0]), col = colOf(ownerOfId(r.ship)), dur = reduceMotion ? 200 : 620;
  fx(dur, (x, k) => {
    const a = hexPx(near), b = hexPx(r.at);
    if (!a || !b) return;
    const e = k * k, dx = (b[0] - a[0]) * e, dy = (b[1] - a[1]) * e, rad = hexUnit() / Math.sqrt(3);
    for (const c of r.from) {
      const p = hexPx(c);
      if (!p) continue;
      x.beginPath();
      for (let i = 0; i < 6; i++) { const an = (Math.PI / 180) * (60 * i - 30), px = p[0] + dx + rad * Math.cos(an), py = p[1] + dy + rad * Math.sin(an); if (i) x.lineTo(px, py); else x.moveTo(px, py); }
      x.closePath();
      x.fillStyle = col; x.globalAlpha = 0.9; x.fill();
      x.strokeStyle = '#04070f'; x.lineWidth = 2; x.stroke();
    }
    // a streak behind it
    x.globalAlpha = 0.5 * k; x.strokeStyle = col; x.lineWidth = 3; x.lineCap = 'round';
    x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(a[0] + dx, a[1] + dy); x.stroke();
  }, delay);
  return dur;
}
// missiles and drones flying after both turns of a round ("Missiles fly"), tick by tick
let fxBusyUntil = 0;
function flightFx(frames, evs, viewer, base = 0) {
  let step = 300,
    sees = (ship, k) => viewer === 'all' || ship.owner === viewer || (frames[k].vis[viewer] || []).includes(ship.id),
    total = step * (frames.length - 1),
    flying = frames.some((state, k) =>
      state.objs.some((o) => (game.rules.munitions[o.kind] || {}).speed && sees(o, k))
    );
  if (!flying) {
    for (let i = frames[0].ev; i < frames[frames.length - 1].ev; i++) if (evs[i]) eventFx(evs[i], viewer, base + 500);
    setTimeout(() => toast('End of round', 'flight', 'No missiles in the air that you can see'), base);
    return 1100;
  }
  fxBusyUntil = Math.max(fxBusyUntil, performance.now() + base + total + 600);
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
      g.addColorStop(0, rgbaOf(colOf(o.owner), 0.9));
      g.addColorStop(1, rgbaOf(col2Of(o.owner), 0));
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
  }, base);
  setTimeout(() => toast('Missiles fly', 'flight', 'After both turns, every missile and drone moves'), base);
  for (let k = 0; k < frames.length - 1; k++)
    for (let i = frames[k].ev; i < frames[k + 1].ev; i++) {
      let r = evs[i];
      if (r) eventFx(r, viewer, base + step * (k + 0.8));
    }
  return total + 250;
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
      boomFx(r.at, delay, false, r.owner != null ? colOf(r.owner) : null);
      break;
    case 'stopped':
      ringFx(r.at, colOf(ownerOfId(r.ship)), 1.4, 700, delay, 4);
      textFx(r.at, ['point defence!'], colOf(ownerOfId(r.ship)), delay);
      break;
    case 'obj_destroyed':
      boomFx(r.at, delay);
      break;
    case 'scan':
      scanFx(r, delay);
      break;
    case 'sighted':
      pingFx(r.at, r.kind === 'ship' ? 'SIGHTED' : '', r.kind === 'ship' ? colOf(ownerOfId(r.id)) : WARN, (delay || 0) + 250);
      break;
  }
}
function playFx(evs, viewer, flight, roundEnded) {
  const sees = (r) => viewer === 'all' || r.seenBy.includes(viewer);
  const fl = flight && flight.length > 1 ? flight : null, f0 = fl ? fl[0].ev : -1, f1x = fl ? fl[fl.length - 1].ev : -1;
  const scanned = evs.some((z) => z.t === 'scan');
  let t = 0, flown = false;
  evs.forEach((r, i) => {
    if (fl && !flown && i >= f0) { flown = true; t += flightFx(fl, evs, viewer, t); }
    if (fl && i >= f0 && i < f1x) return;                    // shown by the flight replay
    if (r.t === 'move' && r.steps > 0 && sees(r)) { const d = moveFx(r, t); if (d) t += d + 140; return; }
    if (r.t === 'ram' && sees(r)) { t += ramFx(r, t); return; }   // the blast and the damage follow it
    eventFx(r, viewer, t + (r.t === 'sighted' && scanned ? 900 : 0));
  });
  if (fl && !flown) t += flightFx(fl, evs, viewer, t);
  if (!fl && roundEnded) { const at0 = t; setTimeout(() => toast('End of round', 'flight', 'No missiles in the air that you can see'), at0); t += 1100; }
  if (t > 0) fxBusyUntil = Math.max(fxBusyUntil, performance.now() + t + 250);
  return t;
}
// Cutscenes wait for the animation that caused them (the missile lands, then the scene plays).
let storyAt = 0, storyWait = 0;
function storyLater(g, dur) {
  const now = performance.now(), wants = g.events.some((e) => e.t === 'scene') || g.phase === 'over';
  const at = Math.max(storyAt, now + (wants ? Math.min(dur || 0, 6000) : 0));
  if (at <= now + 5 && !storyWait) return storyEvents(g);
  storyAt = at; storyWait++;
  setTimeout(() => { storyWait--; storyEvents(g); }, Math.max(0, at - now));
}
// The phase banner: a band right across the board whenever the phase changes (your turn, enemy turn, flight).
function toast(text, cls, sub) {
  let t = $('#toast');
  if (t) {
    t.textContent = text;
    if (sub) t.appendChild(h('small', null, sub));
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
// salvo rule: a ship that has launched this turn may still fire its other launchers with no points left
const salvoLeft = (p) => !!game.rules.salvo && game.ships.some((x) => !x.dead && x.owner === p && x.used && x.used.salvo && E.launchOptions(game, x.id));
function anyAction() {
  let t = turnOf();
  return game.ships.some(
    (ship) =>
      !ship.dead &&
      ship.owner === t &&
      !(game.script && game.script.locks.some((l) => l.ship === ship.name)) &&
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
  const helpUp = $('#help') && !$('#help').hidden;   // the rules card is open (first visit): wait, so the player sees the computer's opening move
  if (storyBusy() || storyWait > 0 || helpUp) { aiTimer = setTimeout(aiStep, 400); return; }   // a cutscene is playing, or about to
  let a;
  try {
    a = aiSteps++ > 30 ? { type: 'end' } : (game.rules.campaign ? E.campaignMove(game, 1) : computerMove(game, 1, aiLevel)) || { type: 'end' };
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
  game.started = new Date().toISOString(); stampFrom = 0;
  looks = partLooks(game.rules);
  sel = look = pending = null; mode = 'move'; code = ''; cam.w = 0;
  undoStack = []; curtain = null; aiSteps = 0; report = null; pendingFx = null; moveAnims = [];
  // who moves in round 1 is picked from the game's seed (turns.first); after that it swaps every round
  const first = turnOf(), swaps = ' The first move swaps every round.';
  say(seat === 'cpu'
    ? 'New game against the computer. You are Player 1 (teal). Find the enemy flagship (\u2605) and destroy it. ' +
      (first === 0 ? 'You move first this game.' + swaps + ' Tap one of your ships to begin.' : 'The enemy moves first this game.' + swaps + ' Watch where it goes.')
    : 'New game. Find the enemy flagship (\u2605) and destroy it. Player ' + (first + 1) + ' moves first this game.' + swaps);
  save(); render();
  setTimeout(() => toast(seat === 'cpu' ? (first === 0 ? 'You move first' : 'The enemy moves first') : 'Player ' + (first + 1) + ' moves first', 'p' + first), 300);
}

// A story chapter (from ui/campaign.js): always against the computer.
export function startStoryGame(chRules, title) {
  game = E.start(chRules, (Date.now() % 2147483647) | 0);
  game.started = new Date().toISOString(); stampFrom = 0;
  looks = partLooks(game.rules);
  seat = 'cpu';
  sel = look = pending = null; mode = 'move'; code = ''; cam.w = 0;
  undoStack = []; curtain = null; aiSteps = 0; report = null; pendingFx = null; moveAnims = [];
  say(title + '. Tap a ship with a white rim to give it orders. Double-tap it to zoom in, and again to zoom back out.');
  save(); render();
  storyEvents(game);
}

function act(action, quiet, byAI) {
  const p = turnOf(), prev = game;
  endArmed = false;
  const viewer = seat === 'cpu' ? 0 : p;      // the computer's view must never reach the hint
  const r = E.attempt(game, action);
  if (!r.ok) { say('Not allowed: ' + r.why + '.', true); return render(); }
  game = r.state; pending = null;
  const mine = game.events.filter((e) => e.seenBy.includes(viewer) && e.t !== 'lost').map(describe);
  // an action can be undone only if it told the player nothing new: no news for them and no change
  // to what they know (a sighting, a lost contact, a fuzzy contact, a ghost clearing, a hit...)
  if (!byAI && (action.type === 'move' || action.type === 'launch') && E.undoSafe(prev, game, p)) undoStack.push(prev);
  else undoStack = [];
  sfxFor(action, game.events, viewer);
  // animations and the impact report. In pass and play they wait until the next player lifts the curtain.
  const fxViewer = seat === 'all' ? 'all' : viewer;
  if (seat === 'pass' && action.type === 'end' && game.phase === 'play') {
    pendingFx = [game.events, turnOf(), game.flight, game.round > prev.round];
    report = makeReport(game.events, turnOf());
  } else {
    const ran = playFx(game.events, fxViewer, game.flight, game.round > prev.round);
    report = makeReport(game.events, fxViewer) || (byAI ? report : null);
    if (game.rules.campaign) storyLater(game, ran);   // cutscenes, barks, objectives, chapter end
  }
  let msg = mine.join(' ');
  if (game.phase === 'over' && game.winner === 'draw' && !/draw/.test(msg)) msg += (msg ? ' ' : '') + 'The round limit was reached' + (game.rules.objective && game.rules.objective.scoreAtLimit ? ' with the beacon score tied' : '') + ', so the game is a draw.';
  if (action.type === 'end' || game.phase === 'over') {
    code = E.turnCode(game); sel = null; mode = 'move';
    if (seat === 'pass') cam.w = 0;      // the board turns round for the next player: start them on the whole map
    undoStack = [];
    if (seat === 'pass' && game.phase === 'play') curtain = turnOf();
    if (game.phase === 'over') curtain = null;
    if (byAI) say(game.phase === 'over' ? msg : 'The enemy ended its turn. Your move.' + (report ? ' Open \u2630 for the impact report.' : ''));
    else if (!quiet) say(game.phase === 'over' ? msg : seat === 'pass' ? 'Turn ended. Pass the device to Player ' + (turnOf() + 1) + '.' : isCodes() ? 'Turn ended. Your turn code is in the panel on the right: send it to your opponent.' : 'Turn ended.');
    if (isCodes() && game.phase === 'play') drawerOpen = true;
    if (byAI && game.phase === 'play') yourTurnPing();
    if (game.phase === 'play') {
      const next = turnOf();
      const text = seat === 'cpu' ? (next === 0 ? 'Your turn' : 'Enemy turn') : seat === 'pass' ? 'Pass to Player ' + (next + 1)
        : isCodes() ? (next === seat ? 'Your turn' : 'Send your turn code') : 'Player ' + (next + 1) + '\'s turn';
      // the first move swaps every round, so whoever moved last also moves first next round: say so
      const again = game.round > prev.round && next === p;
      const name = seat === 'cpu' ? (next === 0 ? 'You go' : 'The enemy goes') : isCodes() ? (next === seat ? 'You go' : 'They go') : 'Player ' + (next + 1) + ' goes';
      const sub = again ? name + ' again: the first move swaps every round'
        : 'Round ' + Math.min(game.round, game.rules.turnLimit) + (seat === 'cpu' && next === 1 ? ' \u00B7 the computer is moving' : seat === 'cpu' || (isCodes() && next === seat) ? ' \u00B7 ' + plural(game.players[next].cp, 'command point') : '');
      setTimeout(() => toast(text, 'p' + next, sub), Math.max(50, fxBusyUntil - performance.now()));   // after the animations
    }
    if (game.phase === 'over') setTimeout(() => toast(game.winner === 'draw' ? 'Draw' : seat === 'cpu' ? (game.winner === 0 ? 'Victory!' : 'Defeat') : 'Player ' + (game.winner + 1) + ' wins', 'over'), 600);
  } else if (byAI) {
    say(msg || 'The computer is taking its turn\u2026');
  } else {
    say(msg || 'Done.');
    if (game.phase === 'play' && turnOf() === p && ((game.players[p].cp <= 0 && !salvoLeft(p)) || !anyAction())) {      // nothing left to do
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
// a munition's display name (its `label:` in the rules: the id "missile" reads "Nuke")
const munName = (k) => (((game && game.rules.munitions) || {})[k] || {}).label || nice(k);
// a launch order mode: any missile kind (basic, advanced, Nuke) or the seeker drone
const isLaunchKind = (k) => k === 'seeker_drone' || (!!game && !!game.rules.munitions[k] && E.isMissile(game.rules, k));
export const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : /x$/.test(w) ? 'es' : 's');
function whyText(w) {
  if (!w) return '';
  if (w.lit) return 'It is lit up by an explosion or a collision, so everyone can see it for now.';
  if (w.scanned) return 'Your scan revealed it.';
  if (w.drone) return 'It gave itself away by spotting one of your ships.';
  return 'Your ' + w.by + ' sees it from ' + plural(w.d, 'hex') + ' away: sensor ' + w.range + ' + its signature ' + w.sig + (w.flare ? ' (which includes ' + w.flare + ' of flare from firing)' : '') + ' reaches ' + (w.range + w.sig) + '.';
}
function describe(e) {
  if (game && game.rules.campaign) {     // story chapters talk about ships by name
    const N = (id) => { const z = typeof id === 'string' && game.ships.find((q) => q.id === id); return z && z.name ? pretty(z.name) : id; };
    e = { ...e, ship: e.t === 'ram' || e.t === 'removed' ? e.ship : N(e.ship), into: Array.isArray(e.into) ? e.into.map(N) : N(e.into), id: e.t === 'sighted' || e.t === 'lost' ? N(e.id) : e.id,
      target: e.t === 'launch' ? N(e.target) : e.target, ships: Array.isArray(e.ships) ? e.ships.map(N) : e.ships };
  }
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
    case 'ammo_lost': return e.ship + ' lost ' + plural(e.count, 'stored munition') + '.';
    case 'pass_reveal': return e.ship + ' flew past ' + e.found.join(', ') + ' under afterburner: lit up for everyone until the end of next round, and so is ' + e.ship + '.';
    case 'burnt_out': return e.ship + '\'s afterburner is burnt out. From now on it moves ' + plural(e.move, 'hex') + ' a turn.';
    case 'lured': return 'Your ' + nice(e.kind) + ' turned on a decoy emitter (' + e.to + ')' + (e.from ? ' and dropped its lock on ' + e.from : '') + '.';
    case 'mine_stir': return 'Something small moved near ' + e.near + '. A faint contact marks roughly where.';
    case 'scene': case 'bark': case 'beat': case 'objective': case 'unlocked': case 'script_unknown': return null;
    case 'spawned': return e.ships.length ? 'New ships have arrived: ' + e.ships.join(', ') + '.' : null;
    case 'split': return 'The enemy ship ' + e.ship + ' split apart into ' + e.into.join(' and ') + '!';
    case 'grafted': return e.name + ' and ' + e.other + ' are grafted into one ship.';
    case 'docked': return e.name + ' and ' + e.other + ' are clamped together.';
    case 'removed': return pretty(e.name || e.ship) + (e.as === 'dark' ? ' went dark and drifted away.' : ' withdrew.');
    case 'locked': return (e.ship ? pretty(e.ship) : 'Your ships') + ' stopped answering the helm.';
    case 'forced': return null;
    case 'ram': return pretty(e.name || e.ship) + ' hurled itself into ' + pretty(e.targetName || e.target) + ': ' + e.hits + ' hits.';
    case 'disabled': return e.ship + ': ' + e.parts.map(nice).join(', ') + ' went offline.';
    case 'enabled': return e.ship + ': ' + e.parts.map(nice).join(', ') + ' back online.';
    case 'rule_changed': return /link_range/.test(e.path) ? 'Comms are jammed: your ships share less of what they see.' : null;
    case 'script_failed': return null;
    case 'objective_scored': return 'Player ' + (e.player + 1) + ' held the beacon and scored (' + e.score + (e.toWin ? ' of ' + e.toWin : '') + '). Holding it lights a ship up.';
    case 'objective_contested': return 'Both sides are on the beacon: nobody scores.';
    case 'game_over': return e.by === 'objective' ? 'Player ' + (e.winner + 1) + ' wins by holding the beacon.'
      : e.by === 'turn_limit' ? (e.winner === 'draw' ? 'The round limit was reached, so the game is a draw.' : 'The round limit was reached: player ' + (e.winner + 1) + ' wins on beacon score.') : e.winner === 'draw' ? 'The game is a draw.' : 'Player ' + (e.winner + 1) + ' wins.';
  }
  return e.t;
}
function forecastText(f, kind) {
  if (!f) return '';
  const when = f.rounds <= 1 ? 'at the end of this round, when missiles fly' : 'in ' + f.rounds + ' rounds';
  if (f.ends === 'hit') return 'On this path the ' + munName(kind).toLowerCase() + ' reaches ' + f.hit + ' ' + when + ', if nothing moves.';
  if (f.ends === 'edge') return 'On this path it flies off the board ' + when + ' unless its seeker finds something within ' + game.rules.munitions[kind].seeker_range + ' hexes.';
  if (f.ends === 'asteroid') return 'On this path it hits an asteroid.';
  return 'On this path it runs out of fuel after ' + plural(f.path.length, 'hex') + ' unless its seeker finds something.';
}

function compass(a, b) {
  const dx = FL * (W * (b[0] + b[1] / 2) - W * (a[0] + a[1] / 2)), dy = FL * 1.5 * S * (b[1] - a[1]);
  return ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
}

// What the Fire button says: the hit numbers come from the rules (laser: 3 out to 4 hexes, 2 out to 8, 1 at 9),
// and the attack-run bonus is spelled out while this ship could still earn it.
function fireHelp(id) {
  const f = E.beamField(game, id), R = game.rules;
  let gun = null;
  for (const c of Object.values(R.parts)) if (c.range && c.hits && (!gun || c.hits > gun.hits)) gun = c;
  const step = gun && gun.loses_1_hit_every, rule = gun ? (step ? gun.hits + ' up to ' + step + ' hexes, ' + (gun.hits - 1) + ' up to ' + Math.min(gun.range, 2 * step) : gun.hits + ' up to ' + gun.range) + ' hexes' : '';
  const targets = E.beamTargets(game, id).length;
  return 'Red: your laser reach and the hits a shot does there (' + rule + ').'
    + (f && f.moved && R.det.attackRun ? ' Moved this turn: +' + R.det.attackRun + ' on every shot.' : '')
    + (f && f.runBonus ? ' Move 1 hex first: +' + f.runBonus + '.' : '')
    + (targets ? ' Tap a ringed enemy, then tap again to fire.' : ' No enemy in reach yet.');
}

// "End your turn without doing anything?" A real pop-up: Keep playing is the big button, End turn sits apart
// from where the End turn button was, and it only wakes up after a moment, so a double tap can't skip a turn.
function confirmEmptyTurn(cp) {
  if ($('#endask')) return;
  const close = () => { const m = $('#endask'); if (m) m.remove(); };
  const end = h('button', { class: 'btn', disabled: true, onclick: () => { close(); act({ type: 'end' }); } }, 'End turn anyway');
  const keep = h('button', { class: 'btn go', onclick: close }, 'Keep playing');
  const bank = game.rules.cp.bankCap;
  const box = h('div', { id: 'endask', class: 'modal', role: 'dialog', 'aria-modal': 'true', onclick: (e) => { if (e.target.id === 'endask') close(); } },
    h('div', { class: 'card modal-box endask' },
      h('h2', null, 'End your turn without doing anything?'),
      h('p', null, 'You have ' + plural(cp, 'command point') + ' and at least one ship that can still move, fire, launch or scan. '
        + (bank ? 'Unspent points are kept for next turn, up to ' + bank + '.' : 'Unspent points are lost.')),
      h('div', { class: 'row' }, end, keep)));
  document.body.appendChild(box);
  setTimeout(() => { end.disabled = false; }, 600);
  keep.focus();
}

// ---------- what a tap would do in the current mode ----------
function options(v) {
  const map = new Map();
  if (!myTurn() || (pending && !['move', 'fire', 'detonate'].includes(pending.type)) || (!sel && mode !== 'scan' && mode !== 'detonate')) return map;
  if (mode === 'move') for (const r of E.reach(game, sel)) map.set(hex.key(r.at), { action: { type: 'move', ship: sel, path: r.path }, mark: 'move', label: r.path.length });
  if (mode === 'fire') for (const t of E.beamTargets(game, sel)) {
    const k = hex.key(t.at);
    if (!map.has(k) || map.get(k).hits < t.hits) map.set(k, { action: { type: 'fire', ship: sel, seg: t.seg, part: t.part, at: t.at }, mark: 'target', hits: t.hits, label: '\u2212' + t.hits });
  }
  if (isLaunchKind(mode)) {
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

// The camera only moves when the player asks. Double-tapping one of your own ships that can take
// orders zooms in on it; double-tapping it again zooms back out. Enemy ships never answer this
// (it would give away where a hidden one is).
let lastTap = { id: null, t: 0 }, zoomShip = null;
function zoomOnShip(ship) {
  if (zoomShip === ship.id && cam.w < fitWidth() * 0.98) {
    const from = { x: cam.x, y: cam.y, w: cam.w };
    wholeMap(); say('The whole board. Double-tap one of your ships to zoom in on it.'); camTween(from, render);
  } else {
    say('Zoomed in on ' + shipName(ship) + '. Double-tap it again, or press \u26F6, to see the whole board.');
    zoomShip = ship.id;
    frame(ship.cells.concat(E.reach(game, ship.id).map((r) => r.at)), selZoom(), render);
  }
}

function tap(c, v, opts, viaChip, t) {
  let o = opts.get(hex.key(c));
  endArmed = false;
  const under = v.ships.find((x) => x.cells.some((y) => hex.same(y, c)));
  if (!viaChip) {
    const id = under && canCommand(under, v) ? under.id : null, now = t || performance.now();   // when the finger landed, not when the tap was handled: a busy phone must not turn a double tap into two single taps
    if (id && lastTap.id === id && now - lastTap.t < 400) { lastTap = { id: null, t: 0 }; return zoomOnShip(under); }
    lastTap = { id, t: now };
    // a one-hex move of a big ship ends on its own hull: only its chip stands for that move, the hull is the ship
    if (o && o.action && o.action.type === 'move' && under && under.id === sel) o = null;
  } else lastTap = { id: null, t: 0 };
  if (o && o.action && o.action.type === 'move') {      // first tap shows where the ship would end up; second tap goes
    if (pending && pending.type === 'move' && pending.path.join('') === o.action.path.join('')) return act(pending);
    pending = o.action;
    const ship = v.ships.find((x) => x.id === sel), to = pending.path.reduce((c, d) => hex.step(c, d), ship.pos);
    say('The dashed outline shows where ' + sel + ' will end up: ' + plural(pending.path.length, 'hex') + ' ' + compass(ship.pos, to) + '. Tap it again or press Move here.');
    return render();
  }
  if (o && o.action && (o.action.type === 'fire' || o.action.type === 'detonate')) {      // things that cannot be taken back: first tap aims, second tap does it
    if (pending && JSON.stringify(pending) === JSON.stringify(o.action)) return act(pending);
    pending = o.action;
    say(o.action.type === 'fire' ? 'Aimed: the laser will do ' + plural(o.hits, 'hit') + ' here. Tap the target again or press Fire. A shot cannot be taken back.'
      : 'Tap the drone again or press Detonate to blow it up. It cannot be taken back.');
    return render();
  }
  if (o && o.action) return act(o.action);
  if (o && o.preview) {
    pending = o.preview;
    say(forecastText(E.forecast(game, pending), pending.kind) + ' Press Launch to send it, or Cancel.');
    return render();
  }
  // missiles and drones can be aimed at any hex: they fly the straight line toward it
  if (!o && isLaunchKind(mode) && sel && myTurn() && !v.ships.some((x) => x.mine && x.cells.some((y) => hex.same(y, c)))) {
    const aimed = E.aimLaunch(game, sel, mode, c);
    if (aimed) {
      pending = aimed;
      say('Aimed straight at ' + at(c) + '. ' + forecastText(E.forecast(game, pending), pending.kind) + ' Press Launch to send it, or Cancel.');
      return render();
    }
  }
  if (!o && guideTap(c, v, guideNow())) return;
  if (pending && pending.type !== 'move') return;
  pending = null;
  const ship = v.ships.find((x) => x.cells.some((y) => hex.same(y, c)));
  if (ship && canCommand(ship, v)) selectShip(ship.id, v);
  else if (ship && ship.mine) {            // one of yours that takes no orders: no panel, just the reason
    look = null;
    const auto = v.story && (v.story.auto || []).includes(ship.name), held = v.story && v.story.locked.includes(ship.name);
    say(auto ? shipName(ship) + ' is flying itself: its crew follow their own orders, so there is nothing for you to command. Ships with a white rim are yours to command.'
      : held ? shipName(ship) + ' is not answering the helm.' : !myTurn() ? 'Your ship ' + shipName(ship) + '. It is not your turn.' : 'Your ship ' + shipName(ship) + '.');
  }
  else if (ship) { look = ship.id; say('Enemy ship ' + shipName(ship) + '. ' + (ship.seen ? whyText(ship.why) : 'The player to move cannot see it.')); }
  else {
    const obj = v.objs.find((x) => hex.same(x.pos, c)), gh = v.ghosts.find((x) => x.cells.some((y) => hex.same(y, c)));
    say(at(c) + (obj ? ': ' + (obj.mine ? 'your ' : 'enemy ') + nice(obj.kind) + (obj.fuel != null ? ', ' + plural(obj.fuel, 'round') + ' of fuel left' : '') + '.'
      : gh ? ': ' + (gh.kind === 'ship' ? 'an enemy ship' : 'a ' + nice(gh.kind)) + ' was last seen here in round ' + gh.round + '.' : ': empty space.'));
    if (!obj && !gh) { sel = null; look = null; mode = 'move'; }
  }
  render();
}

// the move guide for whoever is looking at the board (story chapters only)
// overlay off switch (tests, or a player who wants only the banner): ?guides=off, or localStorage shatkon.guides = off
function guidesOff() {
  try { return new URLSearchParams(location.search).get('guides') === 'off' || localStorage.getItem(KEYS('shatkon.guides')) === 'off'; } catch { return false; }
}
function guideNow() {
  if (!game || !game.rules.campaign || game.phase !== 'play' || guidesOff()) return null;
  const w = who();
  return E.guideView(game, typeof w === 'number' ? w : 0);
}

function guideTap(c, v, gv) {
  if (!gv || !myTurn()) return false;
  const gs = v.ships.find((x) => x.id === gv.ship);
  if (!gs) return false;
  if (gv.reticle && hex.same(c, gv.reticle.at)) {
    selectShip(gs.id, v);
    if (gv.reticle.kind === 'fire') { mode = 'fire'; say('Fire mode for ' + gs.id + ': tap the red target to shoot.'); }
    else {
      const kind = [...E.missileKinds(game.rules, Object.fromEntries(Object.keys(game.rules.munitions).map((k) => [k, 1]))), 'seeker_drone'].find((k) => E.aimLaunch(game, gs.id, k, c));
      if (kind) { mode = kind; pending = E.aimLaunch(game, gs.id, kind, c); say('Aimed at the marked target. ' + forecastText(E.forecast(game, pending), pending.kind) + ' Press Launch to send it, or Cancel.'); }
    }
    render(); return true;
  }
  if (gv.dest.some((d) => hex.same(d, c))) {
    selectShip(gs.id, v);
    const r = E.reach(game, gs.id), go = r.find((x) => hex.same(x.at, c)) || (gv.turnEnd && r.find((x) => hex.same(x.at, gv.turnEnd)));
    if (go) { pending = { type: 'move', ship: gs.id, path: go.path }; say('The dashed outline shows where ' + gs.id + ' will end up' + (hex.same(go.at, c) ? '' : ' this turn, on the way') + '. Tap it again or press Move here.'); }
    render(); return true;
  }
  return false;
}

function selectShip(id, v) {
  sel = id; look = null; mode = 'move'; pending = null; endArmed = false;
  const ship = v.ships.find((x) => x.id === id), st = E.shipStatus(game, id);
  say(shipName(ship) + ' selected. ' + (st.moveLeft > 0 ? 'Tap a green marker to see the move, then tap it again to go.' : 'It cannot move further this turn.'));
}

// ---------- camera ----------
// How much of each edge of the board the floating controls cover, in screen pixels.
function insets() {
  const st = $('#stage'), w = st ? st.clientWidth : 0, h = st ? st.clientHeight : 0, wide = w >= 760, open = !!(sel || look);
  if (isCompact()) return { t: 8, b: railH() + 8, l: (($('#lower') || {}).offsetWidth || 0) + 16, r: 8 };   // the orders are a row along the bottom
  const sheet = !wide && open ? Math.min(h * 0.46, ($('#ctx') && !$('#ctx').hidden && $('#ctx').offsetHeight) || 190) + 8 : 0;
  return { t: 58, b: 62 + sheet, l: 0, r: wide && open ? 336 : wide ? 0 : 0 };
}
function fitWidth() {
  const R = game.rules.board.radius, box = $('#wrap'), bw = Math.max(1, box.clientWidth), bh = box.clientHeight;
  if (!(bh > 0)) return W * (2 * R + 1) + 16;      // the board is hidden (Lab tab)
  const free = isCompact() ? bh - 10 - railH() : Math.max(bh * 0.5, bh - 120);        // leave the turn bar and the hint clear (compact: the order row along the bottom)
  return Math.max(W * (2 * R + 1) + 16, ((S * (3 * R + 2) + 16) * bw) / free);
}
// compact: the height of the order row along the bottom (at least a button's, so the board doesn't jump when it fills)
function railH() { const r = $('#rail'); return isCompact() ? Math.max(58, (r && r.offsetHeight) || 0) : 0; }
export function wholeMap() {
  cam.x = 0; cam.w = fitWidth(); zoomShip = null;
  const box = $('#wrap'), bw = Math.max(1, (box && box.clientWidth) || 1);
  cam.y = isCompact() ? ((cam.w / bw) * (railH() + 8 - 8)) / 2 : 0;     // centred in the space above the order row
}
function frame(cells, minHexes, after) {       // bring a set of hexes into view, with a short glide (only ever on a player's gesture)
  const box = $('#wrap'), bw = Math.max(1, box.clientWidth), bh = Math.max(1, box.clientHeight);
  if (!cells.length) { wholeMap(); if (after) after(); return; }
  const xs = cells.map((c) => FL * W * (c[0] + c[1] / 2)), ys = cells.map((c) => FL * 1.5 * S * c[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const from = cam.w > 0 && isFinite(cam.w) && isFinite(cam.x) && isFinite(cam.y) ? { x: cam.x, y: cam.y, w: cam.w } : null;
  const I = insets(), aw = Math.max(140, bw - I.l - I.r), ah = Math.max(140, bh - I.t - I.b);
  const perPx = Math.max((minHexes * W) / bw, (x1 - x0 + 2.5 * W) / aw, (y1 - y0 + 4 * S) / ah);     // board units per screen pixel
  cam.w = Math.min(fitWidth(), perPx * bw);
  const k = cam.w / bw;
  cam.x = (x0 + x1) / 2 + (k * (I.r - I.l)) / 2; cam.y = (y0 + y1) / 2 + (k * (I.b - I.t)) / 2;       // centre it in the free part
  camTween(from, after);
}
function zoomBy(k) { cam.w = Math.max(4 * W, Math.min(fitWidth(), cam.w * k)); }

// ---------- minimap ----------
// A small outline of the board with a white box for the part on screen. It shows only while the
// view is zoomed in, and it is drawn from the player's own view, so it holds nothing the board does not.
function miniView(c) {
  const r = document.getElementById('minirect'), box = $('#wrap');
  if (!r || !box || !box.clientWidth) return;
  const hh = (c.w * box.clientHeight) / box.clientWidth;
  r.setAttribute('x', f1(c.x - c.w / 2)); r.setAttribute('y', f1(c.y - hh / 2)); r.setAttribute('width', f1(c.w)); r.setAttribute('height', f1(hh));
}
function drawMini(v, guide, hid) {
  const el = $('#mini');
  if (!el) return;
  el.textContent = '';
  el.hidden = hid || !(cam.w < cam.max * 0.98);
  if (el.hidden) return;
  const R = game.rules.board.radius, bw = (W * (2 * R + 1)) / 2 + S, bh = S * (1.5 * R + 1) + S, px = 96;
  const svg = svgEl('svg', { viewBox: [-bw, -bh, 2 * bw, 2 * bh].map(f1).join(' '), width: px, height: Math.round((px * bh) / bw), role: 'img', 'aria-label': 'Where you are on the board. Tap to move the view there.' });
  const corners = [[R, 0], [0, R], [-R, R], [-R, 0], [0, -R], [R, -R]];
  svg.appendChild(svgEl('polygon', { points: corners.map((c) => f1(X(c)) + ',' + f1(Y(c))).join(' '), fill: '#0a1730', stroke: '#2b5a85', 'stroke-width': f1(S * 1.6), 'stroke-linejoin': 'round' }));
  for (const x of v.ships) svg.appendChild(svgEl('circle', { cx: f1(X(x.pos)), cy: f1(Y(x.pos)), r: f1(S * (x.id === sel ? 1.9 : 1.4)), fill: colOf(x.owner), opacity: x.seen ? null : 0.4, stroke: x.id === sel ? '#ffffff' : null, 'stroke-width': x.id === sel ? f1(S * 0.5) : null }));
  const gt = guide && (guide.best || (guide.reticle && guide.reticle.at));
  if (gt) svg.appendChild(svgEl('circle', { cx: f1(X(gt)), cy: f1(Y(gt)), r: f1(S * 1.8), fill: 'none', stroke: '#6fe7ff', 'stroke-width': f1(S * 0.6), class: 'guidepulse' }));
  svg.appendChild(svgEl('rect', { id: 'minirect', fill: '#ffffff', 'fill-opacity': 0.1, stroke: '#ffffff', 'stroke-width': f1(S * 0.5), rx: f1(S * 0.4) }));
  svg.addEventListener('click', (ev) => {       // tap the minimap: look there (same zoom)
    const m = svg.getScreenCTM(); if (!m) return;
    let p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; p = p.matrixTransform(m.inverse());
    const from = { x: cam.x, y: cam.y, w: cam.w };
    cam.x = Math.max(-W * (R + 0.5), Math.min(W * (R + 0.5), p.x)); cam.y = Math.max(-1.5 * S * R, Math.min(1.5 * S * R, p.y));
    render(); camTween(from);
  });
  el.appendChild(svg);
  miniView(cam);
}

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
  // thrust is per ship: each ship's own engines fill its own tank
  let th = [];
  for (let x of l.ships.filter((z) => z.mine && z.thrustNow != null && !game.ships.find((g) => g.id === z.id && g.dead))) {
    let n = (P.moved || {})[x.id] || 0;
    th.push([
      '= ' + x.thrustNow,
      x.id + ' thrust left: +' + x.thrust + ' a turn from its engines, banks up to ' + x.bankCap + ', ' + x.weight + ' a hex' +
        (n ? '; moved ' + plural(n, 'hex') + ' (\u2212' + n * x.weight + ')' : '')
    ]);
  }
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
      if (st.thrust != null) lines.push('Thrust ' + st.thrust + ': +' + x.thrust + ' a turn from its own engines, banks up to ' + x.bankCap + (st.thrust < st.costPerHex && x.thrust ? ' (saving up for its next hex)' : '') + '.');
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
      .concat(sb.emitter ? ['+' + sb.emitter + ' decoy emitter'] : [])
      .concat(sb.flare ? ['+' + sb.flare + ' flare from firing/launching/scanning'] : [])
      .concat(sb.motion < 0 ? ['\u2212' + -sb.motion + ' sitting still'] : sb.motion > 0 ? ['+' + sb.motion + ' engine wake'] : []);
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
// ---------- the compact HUD: icons, pips and bars (labels underneath, on by default, toggled with "Aa") ----------
let labelsOn = (() => { try { return localStorage.getItem('shatkon.labels') !== 'off'; } catch (e) { return true; } })();
function setLabels(on) { labelsOn = on; try { localStorage.setItem('shatkon.labels', on ? 'on' : 'off'); } catch (e) {} render(); }
const ICONS = {
  move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
  laser: 'M13 2L4 14h7l-1 8 9-12h-7z',
  missile: 'M12 2c3 2 5 6 5 10l-2 5H9l-2-5c0-4 2-8 5-10zM9 17l-2 4M15 17l2 4',
  drone: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 4l4 4M20 4l-4 4M4 20l4-4M20 20l-4-4',
  scan: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 12l6-6',
  boom: 'M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M19 19l-3.5-3.5M19 5l-3.5 3.5M5 19l3.5-3.5',
  end: 'M4 12h12M11 6l6 6-6 6M20 5v14',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  hit: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 1v5M12 18v5M1 12h5M18 12h5',
  flame: 'M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z',
  sensor: 'M5 19a10 10 0 0 1 0-14M19 5a10 10 0 0 1 0 14M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M12 11v2',
  plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', x: 'M6 6l12 12M18 6L6 18',
};
const FILLED = { laser: 1 };
function ico(name, size = 20) {
  return svgEl('svg', { class: 'ico', width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: FILLED[name] ? 'currentColor' : 'none', stroke: FILLED[name] ? 'none' : 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svgEl('path', { d: ICONS[name] }));
}
const lbl = (text, cls) => h('span', { class: 'tl' + (cls ? ' ' + cls : '') }, text);
// round progress: a ring that fills as the rounds go by
function roundRing(round, limit) {
  const c = 2 * Math.PI * 15, done = Math.min(round, limit) / limit;
  return h('span', { class: 'ring', role: 'img', 'aria-label': 'Round ' + Math.min(round, limit) + ' of ' + limit, title: 'Round ' + Math.min(round, limit) + ' of ' + limit },
    svgEl('svg', { width: 34, height: 34, viewBox: '0 0 36 36', 'aria-hidden': 'true' },
      svgEl('circle', { cx: 18, cy: 18, r: 15, fill: 'none', stroke: 'var(--line)', 'stroke-width': 3 }),
      svgEl('circle', { cx: 18, cy: 18, r: 15, fill: 'none', stroke: 'var(--me,var(--accent))', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-dasharray': (c * done).toFixed(1) + ' ' + c.toFixed(1), transform: 'rotate(-90 18 18)' })),
    h('b', null, Math.min(round, limit)));
}
// command points: a diamond each; hollow ones are points already spent this turn
function cpPips(cp, perTurn, spendNext) {
  const out = [];
  for (let i = 0; i < Math.min(cp, 12); i++) out.push(h('i', { class: 'dia' + (spendNext && i === cp - 1 ? ' next' : '') }));
  for (let i = 0; i < Math.max(0, perTurn - cp); i++) out.push(h('i', { class: 'dia used' }));
  return h('span', { class: 'meter cp', role: 'img', 'aria-label': plural(cp, 'command point'), title: plural(cp, 'command point') + ' (each order costs 1; unspent points carry over)' },
    h('span', { class: 'pipsrow' }, out, cp > 12 ? h('b', null, '+' + (cp - 12)) : null), lbl(plural(cp, 'move')));
}
// hull: one block per segment, filled by what is left of that segment's parts (unknown for an unscanned enemy segment)
function hullBlocks(x, R) {
  return h('span', { class: 'hullsegs', role: 'img', 'aria-label': 'Hull ' + (x.hull != null ? x.hull + '%' : 'unknown') + ', ' + plural(x.segs.length, 'segment') },
    x.segs.map((sg) => {
      if (!sg.parts) return h('i', { class: 'unk', title: 'not scanned' });
      let hp = 0, max = 0;
      for (const p of sg.parts) if (!(R.parts[p.t] || {}).recharges) { hp += sg.wrecked ? 0 : Math.max(0, p.hp); max += p.max; }
      const pc = sg.wrecked ? 0 : max ? Math.round((100 * hp) / max) : 100;
      return h('i', { class: pc > 60 ? 'ok' : pc > 0 ? 'hurt' : 'gone', title: sg.wrecked ? 'wrecked' : pc + '%' }, h('span', { style: 'width:' + pc + '%' }));
    }));
}
// the few numbers worth showing at a glance; everything else is behind the corner tab
function shipStrip(x, v) {
  const R = game.rules, out = [hullBlocks(x, R)], row = [];
  const badge = (icon, text, cls, label, title) => row.push(h('span', { class: 'sbadge ' + cls, title, role: 'img', 'aria-label': title }, ico(icon, 15), text != null ? h('b', null, text) : null, label ? lbl(label) : null));
  if (x.mine || seat === 'all') {
    const sb = x.sigBreak;
    if (sb && sb.flare) badge('flame', '+' + sb.flare, 'warn', 'lit up', 'Lit up +' + sb.flare + ' (fired, launched or scanned): easier to see for now');
    if (sb && sb.motion > 0) badge('flame', '+' + sb.motion, 'warn', 'wake', 'Engine wake +' + sb.motion + ' from a big move');
    if (sb && sb.haze) badge('eye', (sb.haze > 0 ? '+' : '−') + Math.abs(sb.haze), 'sig', 'nebula', 'In a nebula');
  } else {
    badge('scan', x.tier >= 3 ? '▣' : '◆', 'sig', x.tier >= 3 ? 'full scan' : 'located', x.tier >= 3 ? 'Full readout from a scan' : 'Located: scan it from close range to see its parts');
  }
  out.push(h('div', { class: 'srow' }, row));
  return out;
}
// an order button: an icon, its pips or badge, and a label underneath (hidden with labels off)
function ibtn({ icon, label, sub, on, pressed, pips, pipCls, badge, lock, title, onclick, cls }) {
  return h('button', { class: 'btn ib' + (cls ? ' ' + cls : ''), 'aria-pressed': pressed == null ? null : String(pressed), disabled: !on, title: title || null, 'aria-label': label + (sub ? ': ' + sub : ''), onclick },
    h('span', { class: 'ibic' }, ico(icon, 22), lock ? h('span', { class: 'lockb' }, ico('lock', 11)) : null, badge != null ? h('b', { class: 'cnt' }, badge) : null),
    pips ? h('span', { class: 'ibpips' + (pipCls ? ' ' + pipCls : '') }, pips.map((full) => h('i', { class: full ? 'on' : null }))) : null,
    lbl(label, 'name'), sub ? h('small', { class: 'tl' }, sub) : null);
}
function codeBox(label, text, button) {
  const ta = h('textarea', { readonly: true, 'aria-label': label }, text);
  return h('div', { class: 'card' }, h('h2', null, label), ta, h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => {
    const done = () => { say('Copied.'); render(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => ta.select());
    else { ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} }
  } }, button)));
}
// ---------- battle log ----------
// One JSON file: a readable recap ("summary") at the top, then every turn, then the replay data.
// Mid-game it only holds what the player whose eyes the screen shows could see.
function battleLogFile() {
  const log = E.battleLog(game, { viewer: who(), seat });
  const d = new Date(), two = (n) => String(n).padStart(2, '0');
  const name = 'shatkon-battle-' + d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + '-' + two(d.getHours()) + two(d.getMinutes()) + '.json';
  return { log, name, text: JSON.stringify(log, null, 1) };
}
function downloadLog() {
  try {
    const { name, text, log } = battleLogFile();
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = h('a', { href: url, download: name, style: 'display:none' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    say('Battle log saved as ' + name + (log.viewer === 'all' ? '.' : ' (only what you could see, since the game is still going).'));
  } catch (e) { say('Could not make the battle log: ' + e.message + '.', true); }
  render();
}
function copyLog() {
  let f;
  try { f = battleLogFile(); } catch (e) { say('Could not make the battle log: ' + e.message + '.', true); return render(); }
  const show = () => { drawerOpen = true; logBox = f.text; say('Your browser would not copy it automatically: the log is in the menu (\u2630). Select it all and copy.'); render(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(f.text).then(() => { say('Battle log copied. Paste it into a message or a note to keep it.'); render(); }, show);
  else show();
}
let logBox = null, shareCode = null;   // shareCode: a new two-phone game's code, shown in the menu until it is closed
const logButtons = () => [
  h('button', { class: 'btn', onclick: downloadLog, title: 'Save a file with everything that happened, turn by turn' }, 'Download battle log'),
  h('button', { class: 'btn', onclick: copyLog, title: 'Copy the battle log (for phones)' }, 'Copy log')];

function pasteBox(label, button, onText) {
  const ta = h('textarea', { 'aria-label': label, placeholder: 'Paste here' });
  return h('div', { class: 'card' }, h('h2', null, label), ta, h('div', { class: 'row' }, h('button', { class: 'btn go', onclick: () => onText(ta.value) }, button)));
}

// ---------- render ----------
export function render() {
  renders++;
  // one compact game-mode picker
  const compact = isCompact();
  document.body.classList.toggle('compact', compact);
  document.body.classList.toggle('nolabels', !labelsOn);
  document.body.classList.toggle('info-open', compact && detailsOpen);
  if (compact !== wasCompact) { wasCompact = compact; cam.w = 0; }      // the board has a new size: start from the whole map
  // compact: the header is hidden, so the mode picker, sound, help and the Play/Lab tabs live at the top of the menu
  const dh = $('#drawerhdr'), hr = $('.hdr-r'), hl = $('.hdr-l');
  if (compact) for (const n of [HDR.tabs, HDR.seat, HDR.sfx, HDR.help]) put(n, dh);
  else { put(HDR.tabs, hl); for (const n of [HDR.seat, HDR.sfx, HDR.help, HDR.menu]) put(n, hr); }
  // the game mode is chosen on the landing page (index.html), not here: this only says what is being played
  const seatEl = $('#seat'); seatEl.textContent = '';
  const modeName = game && game.rules.campaign ? 'Story' : ({ cpu: aiLevel === 'easy' ? 'Vs computer: easy' : 'Vs computer: normal', pass: 'Same phone', all: 'Open board' }[seat] || 'Two phones: Player ' + (seat + 1));
  seatEl.appendChild(h('a', { class: 'homebtn', href: 'index.html', title: 'Home: choose another game' }, '\u2302 Home'));
  seatEl.appendChild(h('span', { class: 'modename' }, modeName));
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
          curtain = null; yourTurnPing();
          const pf = pendingFx; pendingFx = null;
          if (pf) playFx(pf[0], pf[1], pf[2], pf[3]);
          render();
          toast('Player ' + (p + 1) + '\'s turn', 'p' + p);
        } }, 'I\'m Player ' + (p + 1) + ': show my fleet'))]);
    } else cur.hidden = true;
  }
  $('#problems').textContent = '';
  if (problems.length) $('#problems').appendChild(h('div', { class: 'card warn' }, h('h2', null, 'The rule files have problems'), problems.map((p) => h('p', null, p))));
  const bar = $('#turnbar'), wrap = $('#wrap'), panels = $('#panels'), hintEl = $('#hint'), camEl = $('#camera'), ctx = $('#ctx'), tb = $('#turnbtns'), drawer = $('#drawer');
  for (const e of [bar, panels, camEl, ctx, tb]) e.textContent = '';
  if (!game) { hintEl.textContent = 'Loading the rules.'; return; }
  if (!cam.w) wholeMap();
  cam.max = fitWidth();
  const v = E.view(game, who()), turn = turnOf(), mine = myTurn(), R = game.rules, hid = curtainUp();
  if (sel && !canCommand(v.ships.find((x) => x.id === sel), v)) sel = null;
  if (pending || (look && !v.ships.some((x) => x.id === look))) look = null;

  // turn bar (top left): whose turn, where we are in the round, what is left to spend
  bar.className = 'who' + (game.phase === 'over' && v.winner !== 'draw' ? v.winner : turn);
  // The round, step by step: both turns, then the missiles fly; then the next round starts with whoever just
  // moved last (the first move swaps every round), so a double turn is visible before it happens.
  const seatName = (p) => seat === 'cpu' ? (p === 0 ? 'You' : 'Enemy') : isCodes() ? (p === seat ? 'You' : 'Them') : 'P' + (p + 1);
  const stepNames = game.order.map(seatName).concat('Missiles fly');
  const nextFirst = R.firstPlayer === 'fixed' ? game.order[0] : game.order[game.order.length - 1];
  const title = game.phase === 'over' ? (v.winner === 'draw' ? 'The game is a draw' : seat === 'cpu' ? (v.winner === 0 ? 'You win!' : 'The computer wins') : isCodes() && v.winner === seat ? 'You win!' : 'Player ' + (v.winner + 1) + ' wins')
    : mine ? (seat === 'all' || seat === 'pass' ? 'Player ' + (turn + 1) + '\'s turn' : 'Your turn') : aiTurn() ? 'The computer is thinking\u2026' : 'Waiting for player ' + (turn + 1);
  fill(bar, [h('div', { class: 'line top' },
      roundRing(v.round, R.turnLimit),
      h('span', { class: 'tbwho' }, h('span', { class: 'big' }, title), h('span', { class: 'steps', title: 'This round: both turns, then every missile and drone moves. The first move swaps every round.' },
        stepNames.map((n, i) => [i ? h('i', { class: 'stepsep' }, '\u25B8') : null, h('span', { class: 'stepchip' + (game.phase === 'play' && i === game.turn ? ' now' : '') + (i === stepNames.length - 1 ? ' fly' : ' s' + game.order[i]), title: n }, n)]),
        game.phase === 'play' && v.round < R.turnLimit ? [h('i', { class: 'stepsep' }, '\u25B8'), h('span', { class: 'stepchip next s' + nextFirst, title: seatName(nextFirst) + ' next' }, seatName(nextFirst) + (nextFirst === game.order[game.order.length - 1] ? ' again' : ' next'))] : null)),
      mine ? h('span', { class: 'meters' }, cpPips(v.cp, R.cp.perTurn, !!pending)) : null,
      mine && v.cp === 1 ? h('span', { class: 'lastpill' }, 'LAST ACTION') : null,
      compact ? h('button', { class: 'infobtn' + (detailsOpen ? ' open' : ''), 'aria-expanded': String(detailsOpen), 'aria-label': detailsOpen ? 'Close details' : 'More: the turn, your ship, the rules', title: detailsOpen ? 'Close' : 'More',
        onclick: () => { detailsOpen = !detailsOpen; render(); } }, ico(detailsOpen ? 'x' : 'plus', 20)) : null),
    v.objective ? h('div', { class: 'line' }, h('span', { title: 'Beacon: start your turn with a ship on it and no enemy ship on it to score 1' }, '\u2726 Beacon ', v.scores.map((sc, k) => h('b', { class: 'n' }, (k ? ' \u00b7 ' : '') + 'P' + (k + 1) + ' ' + sc)), v.objective.toWin ? ' (first to ' + v.objective.toWin + ')' : '')) : null,
    v.story && storyObjective() && !guideNow() ? h('div', { class: 'line objective' }, '\u{1F3AF} ', storyObjective()) : null,
    mine ? ledger(v) : null]);
  if (compact) { const ht = $('#hudtop'); if (ht) document.body.style.setProperty('--hudh', Math.ceil(ht.getBoundingClientRect().bottom - ($('#stage').getBoundingClientRect().top || 0) + 2) + 'px'); }

  // board: it fills the screen. Ships you can command wear a halo; the rest of yours are marked as busy.
  const opts = options(v);
  const plan = pending && pending.type === 'launch' ? E.forecast(game, pending) : null;
  let ghost = null;
  if (pending && pending.type === 'move') {
    const ship = v.ships.find((x) => x.id === pending.ship), to = pending.path.reduce((c, d) => hex.step(c, d), ship.pos);
    const route = pending.path.reduce((a, d) => a.concat([hex.step(a[a.length - 1], d)]), [ship.pos]);
    ghost = { from: ship.pos, to, route, cells: ship.segs.map((sg) => [to[0] + sg.off[0], to[1] + sg.off[1]]), owner: ship.owner };
  }
  const plans = v.objs.filter((o) => o.mine && game.phase === 'play').map((o) => ({ id: o.id, f: E.forecast(game, o.id) })).filter((x) => x.f);
  const guide = guideNow();   // drawn on the board and marked on the minimap; the view never moves to it by itself
  const halo = new Set(v.ships.filter((x) => canCommand(x, v)).map((x) => x.id));
  const idle = new Set(v.ships.filter((x) => x.mine && mine && !halo.has(x.id)).map((x) => x.id));
  wrap.textContent = '';
  // what the board explains while you play: your lasers' reach (Fire), where visible enemies could hit the
  // selected ship (Move), and enemy missiles heading somewhere. All from what this screen may know.
  const eyes = typeof who() === 'number' ? who() : turnOf();
  const field = mine && sel && mode === 'fire' && !hid ? E.beamField(game, sel) : null;
  const danger = mine && sel && mode === 'move' && !hid ? E.dangerMap(game, eyes) : null;
  const incoming = game.phase === 'play' && !hid ? E.incoming(game, eyes) : null;
  wrap.appendChild(drawBoard({ guide, view: v, rules: R, looks, cam, sel, opts, plan, plans, ghost, seat, box: wrap, onTap: (c, viaChip, t) => tap(c, v, opts, viaChip, t), pending, hidden: hid, field, danger, incoming,
    halo, idle, style: shipStyle, modelBase: 'story/', offsets: shipOffset, nameOf: R.campaign ? (x) => (x.name ? shipName(x) : null) : null, onCam: () => render(), onView: miniView }));
  drawMini(v, guide, hid);
  if (moveAnims.length && !animRaf) animRaf = requestAnimationFrame(animTick);
  fill(camEl, [h('button', { class: 'zoom', 'aria-label': 'Zoom in', title: 'Zoom in', onclick: () => { zoomBy(0.7); render(); } }, '+'), h('button', { class: 'zoom', 'aria-label': 'Zoom out', title: 'Zoom out', onclick: () => { zoomBy(1.4); render(); } }, '\u2212'),
    compact && !(cam.max && cam.w < cam.max * 0.98) ? null : h('button', { 'aria-label': 'Whole map', title: 'Whole map', onclick: () => { const from = cam.w > 0 ? { x: cam.x, y: cam.y, w: cam.w } : null; wholeMap(); render(); camTween(from); } }, '\u26F6'),
    document.fullscreenEnabled && !(installed() && !document.fullscreenElement) ? h('button', { 'aria-label': 'Full screen', title: 'Full screen', 'aria-pressed': String(!!document.fullscreenElement), onclick: toggleFull }, '\u2922') : null]);
  // labels under the icons: on by default; the Aa button keeps its own caption so it can always be found
  if (compact) camEl.appendChild(h('a', { class: 'camhome', href: 'index.html', 'aria-label': 'Home', title: 'Home' }, '\u2302'));
  camEl.appendChild(h('span', { class: 'aawrap' }, h('button', { class: 'aa', 'aria-pressed': String(labelsOn), 'aria-label': labelsOn ? 'Hide labels' : 'Show labels', title: labelsOn ? 'Hide labels' : 'Show labels', onclick: () => setLabels(!labelsOn) }, 'Aa'), h('span', { class: 'aacap' }, 'Labels')));
  if (compact) camEl.appendChild(HDR.menu);

  // the ship panel: orders and key numbers for the ship you tapped (what is known, for an enemy)
  const shown = hid ? null : v.ships.find((x) => x.id === (look || sel));
  const tools = h('div', { id: 'tools' });
  if (mine && pending) {
    fill(tools, [h('button', { class: 'btn go', onclick: () => act(pending) }, ({ move: 'Move here', scan: 'Scan now', fire: 'Fire', detonate: 'Detonate', graft: 'Graft', dock: 'Dock' })[pending.type] || 'Launch ' + munName(pending.kind)), h('button', { class: 'btn', onclick: () => { pending = null; say('Cancelled.'); render(); } }, 'Cancel')]);
  } else if (mine && sel) {
    const me = v.ships.find((x) => x.id === sel), st = E.shipStatus(game, sel), lo = E.launchOptions(game, sel);
    const shots = E.beamTargets(game, sel);
    const help = { move: 'Tap a glowing green marker to see where the ship would end up, then tap it again (white tick) to move.', fire: fireHelp(sel),
      missile: 'Tap an amber ring to lock on to that ship, or tap any hex to fire straight at it. You will see its path before it launches.',
      seeker_drone: 'Tap any hex to send the drone straight toward it. It then wanders and reports what it sees.', scan: 'Scan preview shown. Press Scan now.', detonate: 'Tap one of your drones, then tap it again to blow it up.' };
    // story chapters can forbid some orders for a ship ("guns cold"): grey those buttons out with the reason
    const lim = v.story ? (v.story.limits || {})[me.name] : null;
    const barred = (m) => !!lim && lim.actions.includes(isLaunchKind(m) ? 'launch' : { move: 'move', fire: 'fire', scan: 'scan' }[m]);
    const btn = (m, icon, label, sub, on, extra = {}) => ibtn({ icon, label, sub: barred(m) ? (lim.reason ? lim.reason.slice(0, 22) : 'locked') : sub, on: on && !barred(m), pressed: mode === m && on && !barred(m),
      title: barred(m) ? (lim.reason || 'not allowed right now') : null, onclick: () => { mode = m; pending = null; say(help[m] || help.missile); render(); }, ...extra });
    const launchWhy = (kind) => !st.launchers ? 'no launcher' : !(st.ammo[kind] > 0) ? 'none left' : !st.launchersReady ? 'launcher used' : st.ammo[kind] + ' left';
    const has = (kind) => st.launchers > 0 && kind in st.ammo;      // only offer what this ship carries
    const ammoPips = (kind) => Array.from({ length: Math.min(8, st.ammo[kind] || 0) }, () => st.launchersReady > 0);
    const targets = new Set(shots.map((x) => x.target)).size;
    const scanLocked = !st.scanReady && st.scanMoved < 1 && !(me.used && me.used.scan);
    fill(tools, [
      btn('move', 'move', 'Move', st.moveLeft ? 'up to ' + plural(st.moveLeft, 'hex') : 'no moves left', st.moveLeft > 0),
      // the laser's damage close up and far away is the point: closer hits harder
      st.beams ? btn('fire', 'laser', 'Laser', !st.beamsReady ? 'already fired' : v.cp < R.cost.fire ? 'no moves' : targets ? plural(targets, 'target') : 'show reach', st.beamsReady && v.cp >= R.cost.fire,
        { pips: Array.from({ length: st.beams }, (_, i) => i < st.beamsReady), badge: st.beamsReady && targets ? targets : null, title: targets ? plural(targets, 'target') + ' in reach' : 'show where the lasers reach' }) : null,
      // one button per missile kind the ship carries, weakest first (basic, advanced, Nuke)
      ...E.missileKinds(game.rules, Object.fromEntries(Object.keys(st.ammo).map((k) => [k, 1])), true).filter(has).map((k) => btn(k, 'missile', munName(k), launchWhy(k), !!lo && lo.kinds.includes(k), { pips: ammoPips(k), pipCls: 'amber' })),
      has('seeker_drone') ? btn('seeker_drone', 'drone', 'Drone', launchWhy('seeker_drone'), !!lo && lo.kinds.includes('seeker_drone'), { pips: ammoPips('seeker_drone'), pipCls: 'amber' }) : null,
      // a scan pings everything around the ship; it needs the ship to have moved this turn
      ibtn({ icon: 'scan', label: 'Scan', on: st.scanReady && !barred('scan'), lock: scanLocked, pressed: mode === 'scan',
        sub: st.scanReady ? 'radius ' + me.scanR[0] + ' / ' + me.scanR[1] : me.used && me.used.scan ? 'already scanned' : !v.cp ? 'no points' : st.scanMoved < 1 ? 'move first' : 'not now',
        title: scanLocked && v.cp ? 'Move this ship first, then scan ' + me.scan.r[0] + ' / ' + me.scan.r[1] : null, onclick: () => {
        mode = 'scan'; pending = { type: 'scan', ship: sel };
        const [r1, r2] = me.scanR;
        say('Scan preview (' + me.scan.name + ', ' + plural(me.scan.forward, 'row') + ' from your edge): everything inside the green ring (' + r1 + ' hexes) gets a full readout, hidden mines included. The amber ring ('
          + r2 + ' hexes) only picks up faint contacts. ' + scanNextText(me.scan) + ' Scanning lights your ship up for a round. Press Scan now.');
        render();
      } }),
      v.objs.some((o) => o.mine && R.munitions[o.kind].remote_detonate) ? btn('detonate', 'boom', 'Detonate', 'a drone', v.cp >= R.cost.detonate) : null,
      ...(v.story ? v.story.unlocked.filter((k) => k === 'graft' || k === 'dock').flatMap((k) => {
        const a = game.ships.find((z) => z.id === me.id);
        return game.ships.filter((z) => !z.dead && z.owner === a.owner && z.id !== a.id && E.gap(a, z) === 1).map((z) =>
          h('button', { class: 'btn', disabled: v.cp < 1, onclick: () => {      // asks first: press Graft / Dock in the panel to go ahead
            pending = { type: k, ship: a.id, with: z.id };
            say((k === 'graft' ? 'Graft ' + pretty(a.name) + ' and ' + pretty(z.name) + ' into one ship? It cannot be undone. Press Graft to go ahead, or Cancel.' : 'Dock ' + pretty(a.name) + ' and ' + pretty(z.name) + '? It costs a point a turn. Press Dock to go ahead, or Cancel.'));
            render();
          } }, (k === 'graft' ? 'Graft' : 'Dock') + ' ' + z.name,
            h('small', null, k === 'graft' ? 'fuse into one ship' : 'clamp together (costs a point a turn)')));
      }) : [])]);
  }
  let railTools = null;
  const closeBtn = (fn) => h('button', { class: 'ctx-x', 'aria-label': 'Close', onclick: () => { fn(); render(); } }, '\u00D7');
  if (game.phase === 'over' && !hid) {
    ctx.hidden = false;
    if (R.campaign) {
      ctx.className = 'who' + (game.winner === 0 ? 0 : 1);
      fill(ctx, [h('div', { class: 'ctx-head' }, h('h2', null, storyOverText(game))),
        h('div', { class: 'row' },
          h('button', { class: 'btn go', onclick: () => openCampaign() }, 'Campaign map'),
          game.script && game.script.result === 'lose' ? h('button', { class: 'btn', onclick: () => retryChapter(game) }, 'Retry chapter') : null),
        h('div', { class: 'row' }, logButtons())]);
    } else {
      const lost = (k) => game.ships.filter((z) => z.owner === k && z.dead).length + '/' + game.ships.filter((z) => z.owner === k).length;
      ctx.className = 'who' + (v.winner === 'draw' ? turn : v.winner);
      fill(ctx, [h('div', { class: 'ctx-head' }, h('h2', null, v.winner === 'draw' ? 'Draw' : seat === 'cpu' ? (v.winner === 0 ? 'Victory! The enemy flagship is destroyed.' : 'Defeat. Your flagship was destroyed.') : 'Player ' + (v.winner + 1) + ' wins')),
        h('p', { class: 'muted' }, 'Finished in round ' + Math.min(v.round, R.turnLimit) + '. Ships lost: ' + game.players.map((pl, k) => 'Player ' + (k + 1) + ' ' + lost(k)).join(', ') + '. The whole board is revealed.'),
        h('div', { class: 'row' }, h('button', { class: 'btn go', onclick: () => newGame() }, 'Play again'), logButtons())]);
    }
  } else if (shown) {
    const own = shown.id === sel && !look;
    ctx.hidden = false;
    ctx.className = 'who' + shown.owner + (detailsOpen ? ' open' : '');
    // the cut corner: tap it for every number and every part (an overlay over the board)
    const tab = h('button', { class: 'chamfer', 'aria-expanded': String(detailsOpen), 'aria-label': detailsOpen ? 'Hide ship details' : 'Show all ship details', title: detailsOpen ? 'Hide details' : 'All details',
      onclick: () => { detailsOpen = !detailsOpen; render(); } }, ico(detailsOpen ? 'minus' : 'plus', 11));
    fill(ctx, [compact ? null : tab, h('div', { class: 'ctx-head' },
        h('h2', null, (shown.flagship ? '\u2605 ' : '') + shipName(shown), ' ', h('span', { class: 'sub' }, (shown.name ? shown.id + ' \u00b7 ' : '') + (shown.mine ? plural(shown.segs.length, 'segment') : 'enemy'))),
        closeBtn(() => { if (look) look = null; else { sel = null; mode = 'move'; pending = null; } detailsOpen = false; say(''); })),
      shipStrip(shown, v),
      own && !compact ? tools : null,
      detailsOpen ? h('div', { class: 'more' }, shipCard(shown, v)) : null]);
    if (own && compact) railTools = tools;
  } else { ctx.hidden = true; ctx.className = ''; }

  // compact: the orders and End turn stack in the bottom right corner, beside the board
  const rail = $('#rail');
  if (rail) { rail.textContent = ''; if (compact) { if (railTools && !hid) rail.appendChild(railTools); rail.appendChild(tb); } else put(tb, $('#dock')); }
  // end of turn (bottom right): always in the same place
  if (mine && !hid) fill(tb, [
    undoStack.length ? ibtn({ icon: 'undo', label: 'Undo', sub: 'last ' + ({ m: 'move', l: 'launch' }[(game.pending[game.pending.length - 1] || '')[0]] || 'action'), on: true, title: 'Undo (Ctrl+Z)', onclick: undo, cls: 'undo' }) : null,
    // Ending a turn in which nothing was done, while a ship could act, asks in a pop-up (two separate
    // buttons, so a double tap can't skip a turn). Ending with points left after doing something asks once
    // more on the same button, and a second press within half a second counts as the same tap.
    (() => {
      const laserLeft = v.cp >= R.cost.fire && v.ships.some((z) => halo.has(z.id) && E.beamTargets(game, z.id).length);
      const name = endArmed ? 'End turn?' : v.cp === 1 ? 'Last action' : 'End turn';
      const sub = endArmed ? 'press again to end' : v.cp === 1 ? 'ends after it \u00B7 tap to end now' : v.cp ? 'banks ' + plural(Math.min(v.cp, R.cp.bankCap), 'point') : '';
      return h('button', { class: 'btn go ib endb' + (v.cp === 1 || endArmed ? ' last' : '') + (endArmed ? ' armed' : ''), 'aria-label': name + (sub ? ': ' + sub : '') + (laserLeft ? '. A laser can still fire' : ''), onclick: () => {
          if (endArmed && performance.now() - endArmedAt < 500) return;
          if (!game.pending.length && v.cp > 0 && anyAction()) return confirmEmptyTurn(v.cp);
          if (!endArmed && v.cp > 0 && anyAction()) { endArmed = true; endArmedAt = performance.now(); say('You still have ' + plural(v.cp, 'command point') + ' and a ship that can act. Press End turn again to end anyway' + (R.cp.bankCap ? ' (up to ' + R.cp.bankCap + ' unspent points are kept for next turn).' : '.')); render(); }
          else act({ type: 'end' });
        } },
        h('span', { class: 'ibic' }, ico('end', 24), laserLeft ? h('b', { class: 'cnt warnb', title: 'A laser can still fire' }, ico('laser', 11)) : null),
        h('span', { class: 'tl name' + (endArmed || v.cp === 1 ? ' keep' : '') }, name), sub ? h('small', { class: 'tl' }, sub) : null,
        laserLeft ? h('small', { class: 'tl warnnote' }, 'laser can fire') : null);
    })()]);

  hintEl.className = hintErr ? 'err' : '';
  hintEl.textContent = hint || (mine ? 'Tap one of your ships (white rim) to give it orders.' : aiTurn() ? 'The computer is taking its turn\u2026' : isCodes() && game.phase === 'play' ? 'Waiting for player ' + (turn + 1) + '. Open \u2630 to paste their turn code.' : '');

  // the drawer (\u2630): impact report, what happened, display settings, the key, game codes
  const rc = reportCard();
  if (rc) panels.appendChild(rc);
  if (game.phase === 'play' && mine && v.news.length)
    panels.appendChild(h('div', { class: 'card news' }, h('h2', null, v.round === 1 ? 'What you know so far' : 'Since your last turn'), h('ul', { class: 'feed' }, v.news.slice(-10).map((e) => h('li', null, describe(e))))));
  if (game.phase === 'play' && isCodes() && !mine)
    panels.appendChild(pasteBox('Paste player ' + (turn + 1) + '\'s turn code:', 'Play their turn', (text) => {
      try { game = E.applyTurnCode(game, text); code = ''; report = makeReport(game.events, seat); playFx(game.events, seat, game.flight); drawerOpen = false; say('Their turn has been played. Yours now.'); save(); }
      catch (e) { say(e.message.charAt(0).toUpperCase() + e.message.slice(1) + '.', true); }
      render();
    }));
  if (shareCode) panels.appendChild(codeBox('Game code: send this to your friend', shareCode, 'Copy game code'));
  if (logBox) panels.appendChild(codeBox('Battle log', logBox, 'Copy log'));
  if (code && isCodes()) panels.appendChild(codeBox('Your turn code: send this to your opponent', code, 'Copy turn code'));
  const styleBtn = (val, label, on) => h('button', { 'aria-pressed': String(shipStyle === val), disabled: !on, onclick: () => { shipStyle = val; store.set('shatkon.ships', val); render(); } }, label);
  const artCount = v.ships.filter((x) => modelFor(x.name, x.segs.map((sg) => sg.off))).length;
  panels.appendChild(h('div', { class: 'card' }, h('h2', null, 'Display'),
    h('div', { class: 'row', style: 'align-items:center' }, h('span', null, 'Ships drawn as'), h('div', { class: 'seg', role: 'group', 'aria-label': 'How ships are drawn' }, styleBtn('hull', 'Ships', true), styleBtn('schematic', 'Schematic', true), styleBtn('model', 'Models', haveModels))),
    h('p', { class: 'muted' }, 'Schematic shows every part in its slot. Models draws a ship\u2019s art where it has some and the schematic where it does not'
      + (haveModels ? ' (' + artCount + ' of ' + plural(v.ships.length, 'ship') + ' on this board have art).' : ' (no art pack was found).') + ' A ship\u2019s parts are always listed in its panel.')));
  panels.appendChild(h('div', { class: 'card' }, h('h2', null, 'Key'),
    h('div', { class: 'parts' }, Object.entries(looks).map(([name, l]) => h('span', { class: 'chip' }, h('i', { style: 'background:' + l.color }), l.letter + ' ' + nice(name)))),
    h('p', { class: 'muted' }, 'A white rim round a ship\u2019s hexes marks a ship you can give orders to; a ship with a grey dashed name tag is busy or flying itself. Detection tiers: a red fuzzy circle with "?" means something is roughly there (tier 1); \u25C6 after a ship\u2019s name means you know exactly where it is (tier 2); \u25A3 means a fresh scan shows every part (tier 3). Zoom in to see the parts inside each segment: three inner hexagons (bays) and three corner diamonds (mounts). Dark slots are destroyed. The darker area of the board is outside your sensor range. With "Both players" chosen, faded enemy pieces are ones the player to move cannot see.')));
  if (v.feed.length) panels.appendChild(h('div', { class: 'card' }, h('h2', null, 'Earlier'), h('ul', { class: 'feed' }, v.feed.slice(-12).reverse().map((e) => h('li', null, 'Round ' + e.r + ': ' + describe(e))))));
  panels.appendChild(h('div', { class: 'card' }, h('h2', null, 'Game'), h('div', { class: 'row' },
    h('button', { class: 'btn', onclick: () => { if (!game || game.phase === 'over' || confirm('Start a new game? The current one will be replaced.')) { drawerOpen = false; newGame(); } } }, 'New game'),
    h('button', { class: 'btn', onclick: async () => { const c = await E.exportGame(game); panels.appendChild(codeBox('Game code: the whole game, to start or recover one', c, 'Copy game code')); } }, 'Show game code'),
    h('a', { class: 'btn', href: 'index.html', style: 'text-decoration:none;display:inline-flex;align-items:center' }, 'Home'),
    h('a', { class: 'btn', href: 'docs/', style: 'text-decoration:none;display:inline-flex;align-items:center' }, 'Field manual'),
    null),
    installed() ? null : h('div', { class: 'row', style: 'align-items:center' },
      installEvt ? h('button', { class: 'btn go', onclick: async () => { const e = installEvt; installEvt = null; try { await e.prompt(); } catch (err) {} render(); } }, 'Install Shatkon', h('small', null, 'full screen, from your home screen')) : null,
      h('span', { class: 'muted' }, installEvt ? '' : 'To play full screen from your home screen: open the browser\u2019s menu and choose "Add to Home Screen" (iPhone: the Share button first) or "Install app".')),
    h('div', { class: 'row' }, logButtons()),
    h('p', { class: 'muted' }, 'The battle log is every turn of this game, what each ship did and what it hit, with a short recap at the top. Before the game ends it only holds what you could see.'),
    h('p', { class: 'muted' }, 'To play on two phones: one player starts a new game and sends the game code. After that you only swap turn codes. Each phone holds the full game, so the fog relies on neither of you looking at the other seat.')));
  panels.appendChild(pasteBox('Load a game code', 'Load game', async (text) => {
    try { game = await E.importGame(text); stampFrom = game.history.length; looks = partLooks(game.rules); sel = look = pending = null; code = ''; cam.w = 0; moveAnims = []; drawerOpen = false; say('Game loaded.'); save(); }
    catch (e) { say(e.message.charAt(0).toUpperCase() + e.message.slice(1) + '.', true); }
    render();
  }));
  // a red dot on \u2630 while there is a report or news the player has not opened yet
  const newsKey = rc || (mine && v.news.length) ? game.round + ':' + game.turn + ':' + (report ? report.length : 0) : '';
  if (drawerOpen && newsKey) drawerSeen = newsKey;
  drawer.hidden = !drawerOpen || hid;
  const mb = $('#menubtn');
  if (mb) { mb.classList.toggle('dot', !!newsKey && newsKey !== drawerSeen); mb.setAttribute('aria-expanded', String(drawerOpen)); }
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
  const setDrawer = (on) => { drawerOpen = on; if (!on) logBox = shareCode = null; render(); };
  if ($('#menubtn')) $('#menubtn').addEventListener('click', () => setDrawer(!drawerOpen));
  if ($('#drawerclose')) $('#drawerclose').addEventListener('click', () => setDrawer(false));
  if ($('#sfx'))
    $('#sfx').addEventListener('click', () => {
      sfxOn = !sfxOn;
      store.set('shatkon.sfx', sfxOn ? '1' : '0'); try { localStorage.setItem('shatkon.sfx', sfxOn ? '1' : '0'); } catch (e) {}
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
      if (drawerOpen) {
        drawerOpen = false;
        render();
      } else if (pending) {
        pending = null;
        say('Cancelled.');
        render();
      } else if (sel || look) {
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
  // held upright on a phone: a card asks for the phone to be turned (or to go full screen, which turns it where the browser can)
  const rot = $('#rotate'), upright = () => { document.body.classList.add('upright'); try { sessionStorage.setItem('shatkon.upright', '1'); } catch (e) {} };
  try { if (sessionStorage.getItem('shatkon.upright') === '1' || new URLSearchParams(location.search).has('upright')) document.body.classList.add('upright'); } catch (e) {}
  if (rot) {
    $('#rotstay').addEventListener('click', upright);
    if (document.fullscreenEnabled) $('#rotfull').addEventListener('click', toggleFull); else $('#rotfull').hidden = true;
  }
  if (compactMQ && compactMQ.addEventListener) compactMQ.addEventListener('change', () => render());
  document.addEventListener('fullscreenchange', () => render());
  const stage = $('#stage');   // the page's own double-tap and pinch zoom must not fight the board's
  if (stage) for (const n of ['dblclick', 'gesturestart', 'gesturechange']) stage.addEventListener(n, (ev) => ev.preventDefault());
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
  sfxOn = (localStorage.getItem('shatkon.sfx') ?? store.get('shatkon.sfx')) !== '0';
  { const st = store.get('shatkon.ships'); shipStyle = st === 'model' || st === 'schematic' ? st : 'hull'; }
  // ship art: any pack in the story/ships.json format (see ui/board.js). Without one, ships stay schematic.
  try { const r = await fetch('story/ships.json'); if (r.ok) { setModels(await r.json()); haveModels = true; } } catch (e) {}
  if (!haveModels && shipStyle === 'model') shipStyle = 'hull';   // no art pack: the built-in ship hulls still work
  aiLevel = store.get('shatkon.ai') === 'easy' ? 'easy' : 'normal';
  initExtras();
  initStory({ h, startStoryGame, render, say, toast });
  const saved = store.get('shatkon.game');
  if (saved) {
    try {
      game = await E.importGame(saved); stampFrom = game.history.length; looks = partLooks(game.rules);
      if (seat === 'pass' && game.phase === 'play') curtain = turnOf();
      say('Your saved game has been restored.');
    } catch (e) { game = null; }
  }
  // a small hook for automated tests
  window.__shatkon = { get game() { return game; }, act: (a) => act(a, true), select: (id) => { const v = E.view(game, who()), x = v.ships.find((z) => z.id === id); if (canCommand(x, v)) { selectShip(id, v); render(); return true; } return false; }, get sel() { return sel; }, get camBusy() { return performance.now() < camUntil; }, get flip() { return FL; }, E, lab: labAPI };
  labRoute();
  // the landing page opens the game with ?mode=: story, test, cpu (&level=easy|normal), pass, all, p1, join;
  // &new=1 starts a fresh game in that mode. The query is then dropped, so a reload continues the game.
  if (game && game.rules.campaign) await resumeStory();   // cutscene art for a story chapter carried on from a save
  const q = new URLSearchParams(location.search), qm = q.get('mode');
  // play.html opened bare (an old home-screen icon or bookmark) shows the landing page first;
  // the landing page's own links always say what to open (?mode=, ?board= or ?continue=1)
  if (!location.search && !/^#lab/.test(location.hash)) { location.replace('index.html'); return; }
  if (qm) {
    if (qm === 'cpu') { seat = 'cpu'; aiLevel = q.get('level') === 'easy' ? 'easy' : 'normal'; store.set('shatkon.ai', aiLevel); }
    else if (qm === 'pass' || qm === 'all') seat = qm;
    else if (qm === 'p1') seat = 0;
    else if (qm === 'join') seat = 1;
    if (seat !== null) store.set('shatkon.seat', String(seat));
    const fresh = q.get('new') === '1' || (game && game.rules.campaign && qm !== 'story' && qm !== 'test');
    if (qm !== 'story' && qm !== 'test' && qm !== 'join' && (fresh || !game)) newGame();
    else if (!game) newGame(); else render();
    if (qm === 'story') openCampaign();
    if (qm === 'test') openCampaign().then(() => openTest());
    if (qm === 'p1') E.exportGame(game).then((c) => { shareCode = c; drawerOpen = true; say('Send the game code in the menu to your friend. They choose Play \u2192 Two phones \u2192 Join.'); render(); });
    if (qm === 'join') { drawerOpen = true; say('Paste the game code your friend sent you into "Load a game code" in the menu.'); render(); }
    q.delete('mode'); q.delete('new'); q.delete('level');
    if (!q.toString()) q.set('continue', '1');   // a reload continues this game instead of going to the landing page
    try { history.replaceState(null, '', location.pathname + '?' + q + location.hash); } catch (e) {}
  } else if (!game) newGame(); else render();
  // the service worker (sw.js): installable, and the game still opens with no signal. Never fatal.
  try { if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
  $('#wrap').addEventListener('pointerdown', () => { if (glideEnd) glideEnd(true); }, true);   // a finger on the board ends a camera glide, so a drag starts from what is on screen
  window.addEventListener('resize', () => { if (!game) return; if (cam.max && cam.w >= cam.max * 0.98) cam.w = 0; render(); });   // a whole-map view stays a whole-map view
})();
