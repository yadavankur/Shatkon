// The play screen. It draws one player's view from the engine and sends actions
// back. It holds no game rules: everything it shows comes from the engine.

import * as E from '../engine/index.js';
import { computerMove } from '../engine/ai.js';
import { drawBoard, partLooks, S, W, FL, setFlip, X, Y, f1, s as svgEl, setModels, modelFor } from './board.js';
import { setLabDocs, labApplyPlayRules, labRoute, labAPI } from './lab.js';
import { battleSettings, settingsForm, injectSettingsCss, rapidOptions, econOptions, expOptions } from './settings.js';
import { BUILD, buildLabel } from './version.js';
import { postGameCards } from './postgame.js';
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
let postShown = null;             // the battle report (ui/postgame.js) was closed for this finished game
// play.html?board=NAME plays the board in rules/boards/NAME.yaml (its own map, fleets and rule changes), with its own saves
const BOARD = (() => { try { const b = new URLSearchParams(location.search).get('board'); return b && /^[\w-]+$/.test(b) ? b : null; } catch (e) { return null; } })();
const KEYS = (k) => k + (BOARD ? '.board.' + BOARD : '');   // each board keeps its own saves
let boardRapid = null;            // the board file's rapid: section, when this board is played in rapid mode
const isRapidGame = () => !!(game && game.rules.rapid);
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
    // rapid-mode boards live in rules/rapid/ (kept out of rules/boards/, which the board checks and sims walk)
    const file = (/^rapid_/.test(BOARD) ? 'rules/rapid/' : 'rules/boards/') + BOARD + '.yaml';   // rapid_opus, and any other rapid_ board
    const r = await fetch(file + '?t=' + Date.now());
    if (!r.ok) throw new Error('could not read ' + file);
    const b = YAML.parse(await r.text());
    world = structuredClone(world);
    for (const [k, v] of Object.entries((b.board || {}).rules || {})) { const ks = k.split('.'); let o = world; for (const x of ks.slice(0, -1)) o = o[x] = o[x] ?? {}; o[ks.at(-1)] = v; }
    map = fleets = b;
    boardRapid = b.rapid && typeof b.rapid === 'object' ? b.rapid : null;   // a rapid-mode board (engine/rapid.js)
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
const myTurn = () => game && game.phase === 'play' && (seat === 'all' || seat === 'pass' || (seat === 'cpu' ? turnOf() === 0 : turnOf() === seat))
  && !(game.rules.rapid && RT.phase !== 'choose' && RT.phase !== 'auto');   // rapid mode: only while the clock runs
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
  // a missile, drone or mine that lands: a big flash, a second shock ring, a shake and a banner, so a
  // hit reads at a glance (a laser hit keeps the smaller rings)
  const heavy = /missile|drone|mine|ram/.test(String(r.cause || ''));
  if (heavy) {
    boomFx(r.at, delay, true, col);
    ringFx(r.at, col, 2.4, 900, (delay || 0) + 120, 6);
    setTimeout(() => toast((mine ? 'Missile hit you' : 'Missile hit!') + ' \u2212' + r.hits, mine ? 'p1' : 'p0', (r.lost || []).slice(0, 2).join(', ') || 'no damage'), delay || 0);
    mine = true;   // shake for every missile hit, yours or theirs
  }
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
    if (!isRapidGame()) setTimeout(() => toast('End of round', 'flight', 'No missiles in the air that you can see'), base);   // rapid mode: every tick has a flight; no banner
    return isRapidGame() ? 0 : 1100;
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
    case 'stunned':   // an intercepted missile still rattles the ship that stopped it
      textFx(r.at, ['\u26a1 STUNNED'], '#ffe066', delay);
      break;
    case 'rammed':   // experiment ram
      boomFx(r.at, delay, true, colOf(ownerOfId(r.ship)));
      textFx(r.at, ['RAMMED'], colOf(ownerOfId(r.ship)), delay);
      break;
    case 'turret_fire':   // economy mode: a turret's shot
      beamFx(r.from, r.at, colOf(r.owner), delay);
      break;
    case 'turret_hit':
      textFx(r.at, ['turret \u2212' + r.hits], colOf(r.owner), delay);
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
  if (boardRapid) return newRapidGame();
  // the battle settings (asked before the game): fixed turn order, or swap the first move every round
  const bs = battleSettings(), fixed = bs.turns !== 'swap';
  game = E.start({ ...rules, firstPlayer: fixed ? 'fixed' : 'alternate' }, (Date.now() % 2147483647) | 0);
  game.started = new Date().toISOString(); stampFrom = 0;
  looks = partLooks(game.rules);
  sel = look = pending = null; mode = 'move'; code = ''; cam.w = 0;
  undoStack = []; curtain = null; aiSteps = 0; report = null; pendingFx = null; moveAnims = [];
  // who moves in round 1 is picked from the game's seed (turns.first); with a fixed order it stays that way
  const first = turnOf(), swaps = fixed ? ' The same side moves first every round.' : ' The first move swaps every round.';
  say(seat === 'cpu'
    ? 'New game against the computer. You are Player 1 (teal). Find the enemy flagship (\u2605) and destroy it. ' +
      (first === 0 ? 'You move first this game.' + swaps + ' Tap one of your ships to begin.' : 'The enemy moves first this game.' + swaps + ' Watch where it goes.')
    : 'New game. Find the enemy flagship (\u2605) and destroy it. Player ' + (first + 1) + ' moves first this game.' + swaps);
  save(); render();
  setTimeout(() => toast(seat === 'cpu' ? (first === 0 ? 'You move first' : 'The enemy moves first') : 'Player ' + (first + 1) + ' moves first', 'p' + first), 300);
}

// Battle settings before a skirmish starts (ui/settings.js): the same sheet as the landing page's.
// start() runs when the player presses Start battle.
export function askSetup(start, title) {
  injectSettingsCss();
  const old = document.getElementById('bsheet'); if (old) old.remove();
  const close = () => back.remove();
  const name = title || document.title.replace(/ · Shatkon$/, '') || 'Battle';
  const back = h('div', { id: 'bsheet', class: 'bsheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Battle settings', onclick: (ev) => { if (ev.target === back) close(); } },
    h('div', { class: 'bsbox' }, h('h2', null, name === 'Shatkon' ? 'New battle' : name), h('p', { class: 'muted' }, boardRapid ? 'Rapid mode settings' : 'Battle settings'), settingsForm(null, boardRapid ? (boardRapid.experiments ? 'lab' : boardRapid.economy ? 'econ' : true) : false),
      h('div', { class: 'row bsbtns' }, h('button', { class: 'btn', onclick: close }, 'Back'), h('button', { class: 'btn go', onclick: () => { close(); start(); } }, 'Start battle'))));
  document.body.appendChild(back);
}

// Who plays (the Lab's "Play these designs" picks it): 'cpu' (with level), 'pass' (same phone) or 'all' (open board).
export function setPlayMode(m, level) {
  seat = m === 'pass' || m === 'all' ? m : 'cpu';
  if (seat === 'cpu') { aiLevel = level === 'easy' ? 'easy' : 'normal'; store.set('shatkon.ai', aiLevel); }
  store.set('shatkon.seat', String(seat));
}
export { askSetup as battleSetup };

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
  if (isRapidGame()) return rapidAct(action, quiet, false);
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

// ---------- friendly fire (battle setting "Warn me") ----------
// Before a laser shot that would stop on one of your own mines, missiles or drones, trace the beam and ask.
function ffWarn(a) {
  if (battleSettings().ff !== 'warn' || a.type !== 'fire') return null;
  const st = E.beamStop(game, a), me = game.ships.find((x) => x.id === a.ship);
  return st && st.obj && me && st.owner === me.owner ? { at: st.at, kind: st.kind, path: st.path } : null;
}
// (strips the friendly-fire note even when it is null: a kept "warn: null" made a second tap on a target never match, so it never fired)
let launchAim = null;   // the hex the pending launch was aimed at (a second tap there sends it)
const bare = (a) => { if (!a || !('warn' in a)) return a; const { warn, ...rest } = a; return rest; };
const sameAction = (a, b) => JSON.stringify(bare(a)) === JSON.stringify(bare(b));
const warnText = (w) => 'Careful: your own ' + nice(w.kind) + ' at ' + at(w.at) + ' is in the line of fire. This shot would hit it, not the target. Press \u201cFire anyway\u201d to shoot, or Cancel.';

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
    case 'bought': return 'You bought ' + (E.BUY_WORDS[e.item] || e.item) + (e.item === 'turret' ? ': ' + e.ship + ' left a laser behind at ' + at(e.at) : e.item === 'upgrade' ? ' for ' + e.ship + ' (' + E.UPGRADES[e.kind].label + ')' : e.item === 'resupply' ? ' for ' + e.ship + ' (+1 ' + nice(e.kind) + ')' : '') + ' for \u25c8 ' + e.cost + ' (\u25c8 ' + e.purse + ' left).';
    case 'turret_fire': return (e.owner === 0 ? 'Your turret' : 'An enemy turret') + ' fired at ' + (/^o/.test(e.target || '') ? 'a missile or turret' : e.target) + ' (' + plural(e.hits, 'hit') + ').';
    case 'turret_hit': return (e.owner === 0 ? 'Your turret' : 'An enemy turret') + ' took ' + plural(e.hits, 'hit') + ' (' + e.hp + ' left).';
    case 'turret_lit': return 'A dark turret is working again.';
    case 'turret_dark': return 'A turret went dark: not enough rekon for its upkeep.';
    case 'upkeep': return 'Turret upkeep: \u25c8 ' + e.amount + '.';
    case 'rammed': return (e.ship[0] === '1' ? 'Your ' : 'Enemy ') + e.ship + ' rammed ' + e.target + ': its segment is wrecked.';
    case 'decoy': return 'Decoy placed at ' + at(e.at) + ' for 3 ticks.';
    case 'decoy_hit': return 'A ' + nice(e.kind) + ' went for a decoy at ' + at(e.at) + '.';
    case 'decoy_gone': return 'Your decoy faded.';
    case 'woke': return e.ship + ' woke from hibernation (' + e.why + ').';
    case 'mended': return e.ship + ' mended its ' + nice(e.part) + ' while hibernating.';
    case 'stunned': return (e.ship[0] === '1' ? 'Your ' : 'Enemy ') + e.ship + ' stopped a ' + nice(e.kind) + ' but is stunned: it can\u2019t act next tick' + (e.kind === 'missile' ? ', and the Nuke still did 2 hits' : '') + '.';
    case 'idle': return 'You passed: \u2212' + e.lost + ' \u25c8 and no rekon this tick' + (e.missed ? ' (you would have earned ' + e.missed + ')' : '') + '. Sitting still costs.';
    case 'earned': return '+' + e.amount + ' rekon (' + [...new Set((e.items || []).map((i) => E.EARN_WORDS[i.why] || i.why))].join(', ') + (e.capped ? ', capped' : '') + '): \u25c8 ' + e.purse + '.';
    case 'converted': return e.ship + ' went silent: it is now a ' + (e.into === 'mine' ? 'naval mine' : 'scanner buoy') + ' at ' + at(e.at) + '.';
    case 'debris': return e.ship + ' shot a missile down close in: the debris hit it and lit it up for 3 ticks.';
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
  // economy mode, placing a turret: the free hexes next to the chosen ship (T)
  if (isRapidGame() && RT.pick) return map;
  if (isRapidGame() && RT.place) {   // experiments: warp destination, decoy spot
    for (const c of RT.place.spots) { const a = RT.place.act(c); map.set(hex.key(c), { action: a, wingAct: a, mark: 'turret', label: RT.place.label }); }
    return map;
  }
  if (isRapidGame() && RT.ramFor) {   // experiment ram: enemy ships it can reach
    for (const t of game.ships.filter((z) => z.owner === 1 && !z.dead && !E.ramRefusal(game, 0, { type: 'ram', ship: RT.ramFor, target: z.id }))) {
      const a = { type: 'ram', ship: RT.ramFor, target: t.id };
      for (const c of E.footprint(t)) map.set(hex.key(c), { action: a, wingAct: a, mark: 'turret', label: 'R' });
    }
    return map;
  }
  if (isRapidGame() && RT.turretFor) {
    for (const c of E.turretSpots(game, 0, RT.turretFor)) { const a = { type: 'buy', item: 'turret', ship: RT.turretFor, at: c }; map.set(hex.key(c), { action: a, wingAct: a, mark: 'turret', label: 'T' }); }
    return map;
  }
  // rapid mode, wingman step: the friends of the ship that fires: a shot of their own (W and its hits on the
  // target) or, for one with nothing to shoot, a 1-hex move (W)
  if (isRapidGame() && RT.wingFor) {
    for (const m of RT.wingOpts || []) {
      if (m.type === 'fire') {
        const k = hex.key(m.at), was = map.get(k);
        const act = { type: 'fire', ship: m.ship, seg: m.seg, part: m.part, at: m.at };
        if (!was || (was.hits || 0) < m.hits) map.set(k, { action: act, wingAct: { ...RT.wingFor, wing: act }, mark: 'target', hits: m.hits, label: 'W\u2212' + m.hits });
        continue;
      }
      const x = v.ships.find((z) => z.id === m.ship);
      if (x) map.set(hex.key(hex.step(x.pos, m.path[0])), { action: m, wingAct: { ...RT.wingFor, wing: m }, mark: 'move', label: 'W' });
    }
    return map;
  }
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
  if (isRapidGame() && game.phase === 'play' && RT.phase !== 'choose') return;   // rapid mode: watching, or the game is choosing for you
  if (isRapidGame() && RT.wingFor) { const w = opts.get(hex.key(c)); if (w && w.wingAct) rapidAct(w.wingAct); return; }
  if (isRapidGame() && RT.pick) {   // economy mode: choosing the ship a purchase is for
    const x = game.ships.find((z) => z.owner === 0 && !z.dead && E.footprint(z).some((q) => q[0] === c[0] && q[1] === c[1])), item = RT.pick;
    RT.pick = null;
    if (x) { sel = x.id; return rapidForShip(item); }
    say('Cancelled.'); return render();
  }
  if (isRapidGame() && (RT.place || RT.ramFor)) { const w = opts.get(hex.key(c)); RT.place = RT.ramFor = null; if (w && w.wingAct) rapidAct(w.wingAct); else { say('Cancelled.'); render(); } return; }
  if (isRapidGame() && RT.turretFor) { const w = opts.get(hex.key(c)); if (w && w.wingAct) { RT.turretFor = null; rapidAct(w.wingAct); } else { RT.turretFor = null; say('Turret cancelled.'); render(); } return; }   // wingman step: a marker or nothing
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
    if (pending && sameAction(pending, o.action)) {
      if (pending.warn) { say(warnText(pending.warn)); return render(); }   // a warned shot needs the button
      return act(bare(pending));
    }
    pending = o.action;
    if (o.action.type === 'fire') pending = { ...o.action, warn: ffWarn(o.action) };
    say(pending.warn ? warnText(pending.warn) : o.action.type === 'fire' ? 'Aimed: the laser will do ' + plural(o.hits, 'hit') + ' here. Tap the target again or press Fire. A shot cannot be taken back.'
      : 'Tap the drone again or press Detonate to blow it up. It cannot be taken back.');
    return render();
  }
  if (o && o.action) return act(o.action);
  // a launch: the first tap aims (you see the path), a second tap on the same hex sends it (the Launch
  // button does too). Rapid mode had only the button, hidden in the drawer, so aimed launches never went.
  if ((o && o.preview) || (!o && isLaunchKind(mode))) {
    if (pending && pending.type === 'launch' && launchAim && hex.same(launchAim, c)) { launchAim = null; return act(bare(pending)); }
  }
  if (o && o.preview) {
    pending = o.preview; launchAim = c;
    say(forecastText(E.forecast(game, pending), pending.kind) + ' Tap it again or press Launch to send it.');
    return render();
  }
  // missiles and drones can be aimed at any hex: they fly the straight line toward it
  if (!o && isLaunchKind(mode) && sel && myTurn() && !v.ships.some((x) => x.mine && x.cells.some((y) => hex.same(y, c)))) {
    const aimed = E.aimLaunch(game, sel, mode, c);
    if (aimed) {
      pending = aimed; launchAim = c;
      say('Aimed straight at ' + at(c) + '. ' + forecastText(E.forecast(game, pending), pending.kind) + ' Tap it again or press Launch to send it.');
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
  const wing = isRapidGame() && game.rules.rapid.wingman !== 'off' ? (rapidFormation() || new Set()).size - 1 : 0;
  say(shipName(ship) + ' selected. ' + (st.moveLeft > 0 ? 'Tap a green marker to see the move, then tap it again to go.' : 'It cannot move further this turn.')
    + (wing > 0 ? ' Formation bonus: when it fires, one of the ' + (wing === 1 ? 'ship' : wing + ' ships') + ' ringed in purple gets a free wingman ' + (game.rules.rapid.wingman === 'move' ? 'move' : 'shot (or a move if it has nothing to shoot)') + '.' : ''));
}
// Rapid mode: the selected ship and the friends close enough to be its wingman (within wingGap hexes).
function rapidFormation() {
  if (!isRapidGame() || !sel || game.rules.rapid.wingman === 'off') return null;
  const me = game.ships.find((x) => x.id === sel && !x.dead && x.owner === 0);
  if (!me) return null;
  const near = game.ships.filter((x) => x.owner === 0 && !x.dead && E.gap(x, me) <= (game.rules.rapid.wingGap || 2));
  return near.length > 1 ? new Set(near.map((x) => x.id)) : null;
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
  buy: 'M12 3l8 9-8 9-8-9z', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', x: 'M6 6l12 12M18 6L6 18',
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
// Rapid mode saves the short log by default: board, changed settings, seed and one line of moves a
// tick (like a chess score sheet) plus the recap. "Full log" keeps every event, turn by turn.
function changedSettings() {
  if (!isRapidGame() || !game.rules.rapid) return null;
  const base = { ...E.RAPID_DEFAULTS, ...(boardRapid || {}) }, out = {};
  for (const [k, v] of Object.entries(game.rules.rapid)) if (k in base && JSON.stringify(v) !== JSON.stringify(base[k]) && k !== 'econ') out[k] = { now: v, was: base[k] };
  return out;
}
function battleLogFile(kind = 'short') {
  const opts = { viewer: who(), seat, settings: changedSettings(), board: BOARD, build: BUILD };
  const short = kind === 'short' && isRapidGame();
  const log = short ? E.shortLog(game, opts) : E.battleLog(game, opts);
  const d = new Date(), two = (n) => String(n).padStart(2, '0');
  const name = 'shatkon-battle-' + d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + '-' + two(d.getHours()) + two(d.getMinutes()) + (short ? '-short' : '') + '.json';
  return { log, name, text: JSON.stringify(log) };   // compact: indenting doubled the file
}
function downloadLog(kind) {
  try {
    const { name, text, log } = battleLogFile(kind === 'full' ? 'full' : 'short');
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = h('a', { href: url, download: name, style: 'display:none' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    say('Battle log saved as ' + name + ' (' + Math.ceil(text.length / 1024) + ' KB)' + (log.viewer === 'all' ? '.' : ', only what you could see, since the game is still going.'));
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
// The battle report at the end of a skirmish: three swipe cards (ui/postgame.js), shown once per finished game.
const gameKey = () => game.seed + ':' + game.round + ':' + game.winner;
const sideName = (k) => seat === 'cpu' ? (k === 0 ? 'You' : 'Computer') : isCodes() ? (k === seat ? 'You' : 'Opponent') : 'Player ' + (k + 1);
function showReport() {
  const old = document.getElementById('postgame');
  if (postShown === gameKey() || game.rules.campaign) { if (old) old.remove(); return; }
  if (old) return;
  const close = () => { postShown = gameKey(); render(); };
  let box;
  try {
    box = postGameCards(game, { seat: seat === 'cpu' ? 0 : typeof seat === 'number' ? seat : null, sideName,
      title: seat === 'cpu' ? (game.winner === 0 ? 'Victory' : 'Defeat') : null,
      onClose: close, onAgain: () => { postShown = gameKey(); askSetup(newGame); render(); }, onSave: () => downloadLog('short'),
      onShow: (at) => { postShown = gameKey(); const from = { x: cam.x, y: cam.y, w: cam.w }; cam.w = Math.min(cam.w, fitWidth() * 0.6); cam.x = X(at); cam.y = Y(at); render(); camTween(from); } });
  } catch (e) { console.error(e); postShown = gameKey(); return; }
  box.id = 'postgame';
  document.body.appendChild(box);
}

const logButtons = () => [
  h('button', { class: 'btn', onclick: () => downloadLog('short'), title: isRapidGame() ? 'The short log: moves like a chess score sheet, plus the recap' : 'Save a file with everything that happened, turn by turn' }, 'Download battle log'),
  isRapidGame() ? h('button', { class: 'btn', onclick: () => downloadLog('full'), title: 'Every event, turn by turn (much bigger)' }, 'Full log') : null,
  h('button', { class: 'btn', onclick: copyLog, title: 'Copy the battle log (for phones)' }, 'Copy log'),
  h('small', { class: 'muted buildtag' }, buildLabel())];

function pasteBox(label, button, onText) {
  const ta = h('textarea', { 'aria-label': label, placeholder: 'Paste here' });
  return h('div', { class: 'card' }, h('h2', null, label), ta, h('div', { class: 'row' }, h('button', { class: 'btn go', onclick: () => onText(ta.value) }, button)));
}

// ---------- render ----------
export function render() {
  renders++;
  if (!game || game.phase !== 'over' || game.rules.campaign) { const pg = document.getElementById('postgame'); if (pg) pg.remove(); }
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
    : R.rapid ? ({ choose: 'Your move', auto: 'Out of time', watch: 'Watch' }[RT.phase] || 'Both sides act\u2026')
    : mine ? (seat === 'all' || seat === 'pass' ? 'Player ' + (turn + 1) + '\'s turn' : 'Your turn') : aiTurn() ? 'The computer is thinking\u2026' : 'Waiting for player ' + (turn + 1);
  const rapidChips = R.rapid && game.phase === 'play' ? [0, 1].map((k) => { const free = E.unlocked(game, k), past = E.shipsPast(game, k).length;
    return h('span', { class: 'stepchip s' + k + (free ? ' now' : ''), title: (k === 0 ? 'You' : 'Enemy') + ': ' + (free ? 'free to stop, turn back, pass and scan' + (past ? ' (' + plural(past, 'ship') + ' past the line)' : '') : 'forward only until a ship is on or past the line') },
      (k === 0 ? 'You' : 'Enemy') + (free ? ': free' : ': forward')); }) : null;
  fill(bar, [h('div', { class: 'line top' },
      roundRing(v.round, R.turnLimit + (R.rapid && game.rapid ? game.rapid.openTicks || 0 : 0)),   // rapid: the opening's ticks don't count
      E.econOn(game) ? pursePill() : null,   // economy mode: your rekon (the enemy's is hidden)
      R.rapid ? h('span', { class: 'tbwho' }, h('span', { class: 'big' }, title), h('span', { class: 'steps' }, rapidChips)) :
      h('span', { class: 'tbwho' }, h('span', { class: 'big' }, title), h('span', { class: 'steps', title: 'This round: both turns, then every missile and drone moves. The first move swaps every round.' },
        stepNames.map((n, i) => [i ? h('i', { class: 'stepsep' }, '\u25B8') : null, h('span', { class: 'stepchip' + (game.phase === 'play' && i === game.turn ? ' now' : '') + (i === stepNames.length - 1 ? ' fly' : ' s' + game.order[i]), title: n }, n)]),
        game.phase === 'play' && v.round < R.turnLimit && R.firstPlayer !== 'fixed' ? [h('i', { class: 'stepsep' }, '\u25B8'), h('span', { class: 'stepchip next s' + nextFirst, title: seatName(nextFirst) + ' next' }, seatName(nextFirst) + (nextFirst === game.order[game.order.length - 1] ? ' again' : ' next'))] : null)),
      mine && !R.rapid ? h('span', { class: 'meters' }, cpPips(v.cp, R.cp.perTurn, !!pending)) : null,
      mine && v.cp === 1 && !R.rapid ? h('span', { class: 'lastpill' }, 'LAST ACTION') : null,
      compact ? h('button', { class: 'infobtn' + (detailsOpen ? ' open' : ''), 'aria-expanded': String(detailsOpen), 'aria-label': detailsOpen ? 'Close details' : 'More: the turn, your ship, the rules', title: detailsOpen ? 'Close' : 'More',
        onclick: () => { detailsOpen = !detailsOpen; render(); } }, ico(detailsOpen ? 'x' : 'plus', 20)) : null),
    v.objective ? h('div', { class: 'line' }, h('span', { title: 'Beacon: start your turn with a ship on it and no enemy ship on it to score 1' }, '\u2726 Beacon ', v.scores.map((sc, k) => h('b', { class: 'n' }, (k ? ' \u00b7 ' : '') + 'P' + (k + 1) + ' ' + sc)), v.objective.toWin ? ' (first to ' + v.objective.toWin + ')' : '')) : null,
    v.story && storyObjective() && !guideNow() ? h('div', { class: 'line objective' }, '\u{1F3AF} ', storyObjective()) : null,
    mine && !R.rapid ? ledger(v) : null]);
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
  // economy mode: no free reach labels; a bought heatmap puts its own numbers on the moves instead
  const heat = isRapidGame() ? rapidHeat() : null;
  const danger = mine && sel && mode === 'move' && !hid ? (E.econOn(game) ? (heat ? new Map(heat.filter((t) => t.hits).map((t) => [hex.key(t.at), t.hits])) : null) : E.dangerMap(game, eyes)) : null;
  const incoming = game.phase === 'play' && !hid ? E.incoming(game, eyes) : null;
  wrap.appendChild(drawBoard({ guide, view: v, rules: R, looks, cam, sel, opts, plan, plans, ghost, seat, box: wrap, onTap: (c, viaChip, t) => tap(c, v, opts, viaChip, t), pending, hidden: hid, field, danger, incoming,
    halo, idle, style: shipStyle, modelBase: 'story/', offsets: shipOffset, nameOf: R.campaign ? (x) => (x.name ? shipName(x) : null) : null, onCam: () => render(), onView: miniView, lines: rapidLines(), formation: rapidFormation(), ground: E.econOn(game) && game.phase === 'play' ? E.newGround(game, 0) : null, earn: RT.earn, heat, heatLabels: labelsOn, tagsOn: isRapidGame() ? 'tap' : 'all', look }));
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
    fill(tools, [h('button', { class: 'btn go' + (pending.warn ? ' warnfire' : ''), onclick: () => act(bare(pending)) }, pending.warn ? 'Fire anyway' : ({ move: 'Move here', scan: 'Scan now', fire: 'Fire', detonate: 'Detonate', graft: 'Graft', dock: 'Dock' })[pending.type] || 'Launch ' + munName(pending.kind)), h('button', { class: 'btn', onclick: () => { pending = null; say('Cancelled.'); render(); } }, 'Cancel')]);
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
    const meStunned = !!me.stunned;
    const scanLocked = !st.scanReady && st.scanMoved < 1 && !(me.used && me.used.scan);
    fill(tools, [
      btn('move', 'move', 'Move', st.moveLeft ? 'up to ' + plural(st.moveLeft, 'hex') : 'no moves left', st.moveLeft > 0),
      // the laser's damage close up and far away is the point: closer hits harder
      // always shown, so "why can't I fire?" has an answer: no laser left, out of reach, blocked, nothing seen
      st.beams ? btn('fire', 'laser', 'Laser', meStunned ? 'stunned' : !st.beamsReady ? 'already fired' : v.cp < R.cost.fire ? 'no moves' : targets ? plural(targets, 'target') : noShotWhy(sel), st.beamsReady && v.cp >= R.cost.fire && !meStunned,
        { pips: Array.from({ length: st.beams }, (_, i) => i < st.beamsReady), badge: st.beamsReady && targets ? targets : null, title: targets ? plural(targets, 'target') + ' in reach' : noShotWhy(sel) })
        : btn('fire', 'laser', 'Laser', 'no laser left', false, { title: me.id + ' has no working laser: they were shot away' + (isRapidGame() && E.econOn(game) ? ' or left behind as turrets' : '') + '. It can still move.' }),
      // one button per missile kind the ship carries, weakest first (basic, advanced, Nuke)
      ...E.missileKinds(game.rules, Object.fromEntries(Object.keys(st.ammo).map((k) => [k, 1])), true).filter(has).map((k) => btn(k, 'missile', munName(k), launchWhy(k), !!lo && lo.kinds.includes(k), { pips: ammoPips(k), pipCls: 'amber' })),
      has('seeker_drone') ? btn('seeker_drone', 'drone', 'Drone', launchWhy('seeker_drone'), !!lo && lo.kinds.includes('seeker_drone'), { pips: ammoPips('seeker_drone'), pipCls: 'amber' }) : null,
      // a scan pings everything around the ship; it needs the ship to have moved this turn
      ibtn({ icon: 'scan', label: 'Scan', on: st.scanReady && !barred('scan'), lock: scanLocked, pressed: mode === 'scan',
        sub: st.scanReady ? 'radius ' + me.scanR[0] + ' / ' + me.scanR[1] : me.used && me.used.scan ? 'already scanned' : !v.cp ? 'no points' : R.rapid ? (R.rapid.scan === 'past_line' ? 'past the line only' : 'after crossing') : st.scanMoved < 1 ? 'move first' : 'not now',
        title: scanLocked && v.cp ? 'Move this ship first, then scan ' + me.scan.r[0] + ' / ' + me.scan.r[1] : null, onclick: () => {
        mode = 'scan'; pending = { type: 'scan', ship: sel };
        const [r1, r2] = me.scanR;
        say('Scan preview (' + me.scan.name + ', ' + plural(me.scan.forward, 'row') + ' from your edge): everything inside the green ring (' + r1 + ' hexes) gets a full readout, hidden mines included. The amber ring ('
          + r2 + ' hexes) only picks up faint contacts. ' + scanNextText(me.scan) + ' Scanning lights your ship up for a round. Press Scan now.');
        render();
      } }),
      // experiments: ram (a one-hex ship) and decoys (a ship with an emitter)
      isRapidGame() && E.exp(game, 'ram') && me.segs.length === 1 && !me.flagship ? ibtn({ icon: 'fire', label: 'Ram', on: RT.phase === 'choose', sub: 'into a ship within 2', onclick: () => {
        const ok = game.ships.some((z) => z.owner === 1 && !z.dead && !E.ramRefusal(game, 0, { type: 'ram', ship: sel, target: z.id }));
        if (!ok) { say('Ram: no enemy ship you can see within 2 hexes of ' + sel + '.'); return render(); }
        RT.ramFor = sel; pending = null; say('Ram: tap an enemy ship marked R. ' + sel + ' is lost; the segment it hits is wrecked.'); render(); } }) : null,
      isRapidGame() && E.exp(game, 'decoy') && E.decoySpots(game, 0, sel).length ? ibtn({ icon: 'scan', label: 'Decoy', on: RT.phase === 'choose' && !E.decoyRefusal(game, 0, { type: 'decoy', ship: sel, at: E.decoySpots(game, 0, sel)[0] }), sub: E.decoyRefusal(game, 0, { type: 'decoy', ship: sel, at: E.decoySpots(game, 0, sel)[0] }) ? 'recharging' : 'place a fake contact', onclick: () => {
        RT.place = { item: 'decoy', ship: sel, spots: E.decoySpots(game, 0, sel), act: (c) => ({ type: 'decoy', ship: sel, at: c }), label: 'D' }; pending = null;
        say('Decoy: tap a marked hex (D). The enemy sees a "?" there for 3 ticks; missiles that see it go for it.'); render(); } }) : null,
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
        h('div', { class: 'row' }, h('button', { class: 'btn go', onclick: () => askSetup(newGame) }, 'Play again'), h('button', { class: 'btn', onclick: () => { postShown = null; render(); } }, 'Battle report'), logButtons())]);
    }
    showReport();
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
  if (mine && !hid && R.rapid && (RT.turretFor || RT.pick || RT.place || RT.ramFor)) {
    fill(tb, [h('button', { class: 'btn ib endb', 'aria-label': 'Cancel', onclick: () => { RT.turretFor = RT.pick = RT.place = RT.ramFor = null; say('Cancelled.'); render(); } },
      h('span', { class: 'ibic' }, ico('x', 22)), h('span', { class: 'tl name' }, 'Cancel'), h('small', { class: 'tl' }, 'buy nothing'))]);
  } else if (mine && !hid && R.rapid && RT.wingFor) {
    fill(tb, [h('button', { class: 'btn go ib endb', 'aria-label': 'Fire with no wingman move', onclick: () => rapidAct(RT.wingFor) },
      h('span', { class: 'ibic' }, ico('end', 24)), h('span', { class: 'tl name' }, 'Fire alone'), h('small', { class: 'tl' }, 'no wingman'))]);
  } else if (mine && !hid && R.rapid) {
    const ok = RT.phase === 'choose' && E.passAllowed(game, 0);
    const shop = E.econOn(game) ? (() => { const can = RT.phase === 'choose' && Object.keys(E.shopItems(game)).some((k) => E.purse(game, 0) >= E.price(game, k));
      return h('button', { class: 'btn ib buyb' + (can ? '' : ' off'), 'aria-label': 'Buy: spend rekon, using this tick', disabled: RT.phase !== 'choose', onclick: rapidShop },
        h('span', { class: 'ibic' }, ico('buy', 22)), h('span', { class: 'tl name' }, 'Buy'), h('small', { class: 'tl' }, 'uses the tick')); })() : null;
    fill(tb, [shop, h('button', { class: 'btn go ib endb' + (ok ? '' : ' off'), disabled: !ok, 'aria-label': 'Pass: do nothing this tick',
      onclick: () => rapidAct({ type: 'pass' }) },
      h('span', { class: 'ibic' }, ico('end', 24)), h('span', { class: 'tl name' }, 'Pass'), h('small', { class: 'tl' }, !ok ? 'once past the line' : E.econOn(game) && E.econConfig(game.rules).idle ? '\u2212' + E.econConfig(game.rules).idle + ' \u25c8, earn nothing' : 'do nothing this tick'))]);
  } else if (mine && !hid) fill(tb, [
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
    h('button', { class: 'btn', onclick: () => { if (!game || game.phase === 'over' || confirm('Start a new game? The current one will be replaced.')) { drawerOpen = false; askSetup(newGame); render(); } } }, 'New game'),
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
  rapidEnsure();
  // the computer moves after the animations have had time to play
  if (aiTurn() && !aiTimer) aiTimer = setTimeout(aiStep, Math.max(1000, fxBusyUntil - performance.now() + 400));
}

// ---------- rapid mode (rules/rapid/rapid_opus.yaml, engine/rapid.js) ----------
// Both sides pick one action a tick and they resolve together. The screen runs a clock:
//   watch  : what both sides just did plays out; the controls sleep (battle setting "Time to watch")
//   choose : the bar shrinks; pick one action (battle setting "Time to act")
//   auto   : out of time. A chosen laser, missile or scan fires on its own after a 1.5 s red Cancel
//            button; with nothing chosen the game picks a ship and moves it forward (or passes, once free)
// The computer picks its action the moment you pick yours, from its own view of the board.
const RT = { place: null, ramFor: null, pick: null, turretFor: null, phase: 'idle', start: 0, end: 0, timer: 0, raf: 0, wingFor: null, wingOpts: null, convertFor: null };   // convertFor: a move waiting for "convert to?"   // wingFor: a chosen shot waiting for its wingman move
function rapidClear() {
  clearTimeout(RT.timer); RT.timer = 0;
  const cv = document.getElementById('rapidconvert'); if (cv) cv.remove();
  const sh = document.getElementById('rapidbuy'); if (sh) sh.remove();
  const c = document.getElementById('rapidcancel'); if (c) c.remove();
  document.body.classList.remove('rapid-auto');
}
function rapidReset() { rapidClear(); RT.phase = 'idle'; rapidBar(); }
// Each side's line across the board: a ship on the far side of it (or on it) frees its fleet.
function rapidLines() {
  if (!isRapidGame()) return null;
  const R = game.rules, L = R.rapid.line, B = R.board.radius;
  return [0, 1].map((k) => {
    const hs = E.homeSign(game, k);
    return { row: hs > 0 ? B - L + 0.5 : -(B - L) - 0.5, side: k, col: k === 0 ? '#7fd8f0' : '#ff8bd8', label: k === 0 ? 'your line' : 'enemy line' };
  });
}
function newRapidGame() {
  rapidReset();
  seat = 'cpu'; store.set('shatkon.seat', 'cpu');
  game = E.rapidStart(E.rapidRules(rules, { ...boardRapid, ...rapidOptions(), ...(boardRapid.economy ? econOptions() : {}), ...(boardRapid.experiments ? expOptions() : {}) }), (Date.now() % 2147483647) | 0);
  game.started = new Date().toISOString(); stampFrom = 0;
  looks = partLooks(game.rules);
  sel = look = pending = null; mode = 'move'; code = ''; cam.w = 0;
  undoStack = []; curtain = null; aiSteps = 0; report = null; pendingFx = null; moveAnims = [];
  const r = game.rules.rapid;
  const econ = E.econOn(game), title = econ ? 'Frontier' : 'Rapid Opus';
  say(title + ': you and the computer each pick ONE action a tick, and both happen at once. Forward only until one of your ships is on or past your line (dashed). '
    + (r.stride === 'off' ? '' : 'Until the first contact' + (r.openEnd === 'shot' ? ' (the first shot)' : '') + ', ships move 2 hexes and you get ' + (r.openTimer || 10) + ' s. ') + 'Then ' + r.timer + ' s a tick: run out and a chosen laser or missile fires by itself, or the game moves a ship forward for you (the one you tapped, if any).'
    + (econ ? ' Rekon (\u25c8): fly through the outlined hexes in the enemy\u2019s half (2 by an asteroid), be first across the line (3), hold ships past it (1 each a tick), destroy enemy ships (2 a segment). At most ' + E.econConfig(game.rules).cap + ' a tick. Buy (bottom right): a threat heatmap for \u25c8 ' + E.price(game, 'heatmap') + ' shows where the enemy ships you can see could hit, for your next 2 ticks. Buying uses your tick.' : ''));
  save(); render();
  setTimeout(() => toast(title, 'p0', econ ? 'earn rekon in the enemy\u2019s half' : 'forward until you cross the line'), 300);
}
// Called by render: starts the clock for a game that has none running (a new game, or one loaded from a save).
function rapidEnsure() {
  if (!isRapidGame() || game.phase !== 'play') { if (RT.phase !== 'idle') rapidReset(); else rapidBar(); return; }
  if (RT.phase === 'idle') { RT.phase = 'starting'; setTimeout(rapidChoose, 50); }
  rapidBar();
}
function rapidWatch(ms) {
  rapidClear();
  if (ms <= 0) return rapidChoose();
  RT.phase = 'watch'; RT.start = performance.now(); RT.end = RT.start + ms;
  RT.timer = setTimeout(rapidChoose, ms);
  rapidBar();
}
function rapidChoose() {
  if (!isRapidGame() || game.phase !== 'play') return rapidReset();
  rapidClear();
  RT.wingFor = RT.wingOpts = RT.convertFor = RT.turretFor = RT.pick = RT.place = RT.ramFor = null;
  const secs = E.inOpening(game) ? game.rules.rapid.openTimer || 10 : game.rules.rapid.timer;   // the opening runs on a shorter clock
  RT.phase = 'choose'; RT.start = performance.now(); RT.end = RT.start + secs * 1000;
  RT.timer = setTimeout(rapidTimeout, secs * 1000);
  yourTurnPing();
  render();
}
// Out of time.
function rapidTimeout() {
  if (!isRapidGame() || RT.phase !== 'choose' || game.phase !== 'play') return;
  if (RT.wingFor) return rapidAct(RT.wingFor, true, true);   // out of time choosing a wingman: the shot goes alone
  if (RT.convertFor) return rapidAct(RT.convertFor, true, true);   // out of time at "convert to?": it stays a ship
  RT.turretFor = RT.pick = RT.place = RT.ramFor = null;   // out of time placing a turret or choosing a ship: nothing bought, the usual time-out applies
  // the rules card or the menu is open: the clock starts again rather than acting behind it
  if ((document.getElementById('help') && !document.getElementById('help').hidden) || drawerOpen || document.getElementById('bsheet')) return rapidChoose();
  const R = game.rules.rapid;
  if (pending && pending.type === 'move') return rapidAct(pending, true, true);   // chosen, just not confirmed
  let a = null;
  if (pending && ['fire', 'launch', 'scan', 'detonate'].includes(pending.type)) a = bare(pending);
  else if (sel && mode === 'fire') a = E.autoFire(game, 0, sel, R.autofire);
  else if (sel && isLaunchKind(mode)) a = E.autoLaunch(game, 0, sel, mode, R.autofire);
  if (a && !E.rapidRefusal(game, 0, a)) return rapidAutoAsk(a);
  rapidForced();
}
// A chosen laser, missile or scan goes by itself unless Cancel is pressed within 1.5 s.
function rapidAutoAsk(a) {
  rapidClear();
  RT.phase = 'auto'; RT.start = performance.now(); RT.end = RT.start + 1500;
  pending = a; sel = a.ship || sel; mode = a.type === 'launch' ? a.kind : a.type === 'fire' ? 'fire' : mode;
  document.body.classList.add('rapid-auto');
  say('Out of time: ' + ({ fire: 'your laser fires', launch: 'your ' + munName(a.kind).toLowerCase() + ' launches', scan: 'your scan goes', detonate: 'your drone goes off' }[a.type]) + ' by itself. Cancel to stop it.');
  document.body.appendChild(h('button', { id: 'rapidcancel', class: 'rapidcancel', onclick: () => { rapidClear(); pending = null; rapidForced(); } }, 'Cancel', h('small', null, 'auto ' + (a.type === 'launch' ? 'launch' : a.type))));
  RT.timer = setTimeout(() => { const c = document.getElementById('rapidcancel'); if (c) c.remove(); rapidAct(a, true, true); }, 1500);
  render();
}
// Nothing chosen: pass once free; otherwise move a ship forward at random. A ship you had tapped is the
// one that goes (to a random forward hex); if it has none, or nothing was tapped, the game spins through
// the ships that can go forward and picks one.
function rapidForced() {
  rapidClear();
  if (!isRapidGame() || game.phase !== 'play') return;
  if (E.passAllowed(game, 0) && E.unlocked(game, 0)) { say('Out of time: you passed.'); return rapidAct({ type: 'pass' }, true, true); }
  const moves = E.forcedMoves(game, 0, sel);
  if (!moves.length) return rapidAct({ type: 'pass' }, true, true);
  RT.phase = 'auto'; RT.start = performance.now(); RT.end = RT.start + 1600;
  document.body.classList.add('rapid-auto');
  const pick = moves[Math.floor(Math.random() * moves.length)], ids = [...new Set(moves.map((m) => m.ship))];
  if (sel && pick.ship === sel) {   // the tapped ship goes, no spinning
    mode = 'move'; pending = pick; render();
    say('Out of time: your selected ship moves forward by itself.');
    RT.timer = setTimeout(() => rapidAct(pick, true, true), 700);
    return;
  }
  let i = 0;
  const steps = Math.min(10, 4 + ids.length);
  say('Out of time: the game picks one of your ships and moves it forward.');
  const spin = () => {
    if (!isRapidGame() || RT.phase !== 'auto') return;
    if (i < steps) { sel = ids[(i * 7 + steps) % ids.length]; mode = 'move'; pending = null; i++; render(); RT.timer = setTimeout(spin, 110); return; }
    sel = pick.ship; mode = 'move'; pending = pick; render();
    RT.timer = setTimeout(() => rapidAct(pick, true, true), 500);
  };
  spin();
}
// One tick: your action and the computer's, together.
function rapidAct(action, quiet, auto) {
  if (!isRapidGame() || game.phase !== 'play') return;
  if (!auto && RT.phase !== 'choose') { say('Watch first: the controls wake up when the bar at the top refills.'); return render(); }
  const a = !action || action.type === 'end' ? { type: 'pass' } : bare(action);
  const why = E.rapidRefusal(game, 0, a);
  if (why) {
    say('Not allowed: ' + why + '.', true);
    if (auto) rapidForced();          // an automatic choice went stale: fall back to the forced move
    return render();
  }
  // formation: a shot by a ship with friends close by first offers one of them a free 1-hex move
  if (!auto && a.type === 'fire' && !a.wing && !RT.wingFor && game.rules.rapid.wingman !== 'off') {
    const ws = E.wingShots(game, 0, a.ship), wm = E.wingMoves(game, 0, a.ship);
    if (ws.length || wm.length) {
      RT.wingFor = a; RT.wingOpts = ws.concat(wm); pending = null;
      toast('Wingman bonus', 'p0 wingt', ws.length ? 'a free 2nd shot: tap a red W' : 'a free move: tap a green W');   // big and plain, so the bonus can't be missed
      say('Formation bonus: a free wingman ' + (ws.length ? 'shot' : 'move') + '. Tap a W marker: '
        + (ws.length ? 'a red one fires a ship next to ' + a.ship + ' at that target' + (wm.length ? ', a green one moves a ship with nothing to shoot' : '') : 'it moves a ship next to ' + a.ship + ' 1 hex')
        + '. Or press Fire alone.');
      return render();
    }
  }
  // going silent: a one-hex ship moving on or past the line is asked whether it becomes a scanner or a mine
  if (!auto && a.type === 'move' && !a.convert && !RT.convertFor && game.rules.rapid.convert !== 'off' && E.canConvert(game, 0, a)) {
    RT.convertFor = a; pending = null;
    const pick = (into) => { const c = document.getElementById('rapidconvert'); if (c) c.remove(); rapidAct(into ? { ...a, convert: into } : a); };
    const [r1, r2] = game.rules.rapid.buoyScan || [4, 8];
    document.body.appendChild(h('div', { id: 'rapidconvert', class: 'rapidconv', role: 'dialog', 'aria-label': 'Convert to?' },
      h('b', null, 'Convert ' + a.ship + ' to?'),
      h('small', null, 'It goes silent: the ship is gone (not lost) and something quieter stays in its place.'),
      h('button', { class: 'btn go', onclick: () => pick('scanner') }, 'Scanner buoy', h('small', null, 'scans every tick: full readout within ' + r1 + ', contacts within ' + r2)),
      h('button', { class: 'btn go', onclick: () => pick('mine') }, 'Naval mine', h('small', null, 'goes off when an enemy comes within 1 hex')),
      h('button', { class: 'btn', onclick: () => pick(null) }, 'Stay a ship')));
    say('Past the line: convert ' + a.ship + ' to a scanner buoy or a mine, or keep it a ship.');
    return render();
  }
  RT.wingFor = RT.wingOpts = RT.convertFor = RT.turretFor = RT.pick = RT.place = RT.ramFor = null;
  rapidClear(); RT.phase = 'busy';
  let ai = { type: 'pass' };
  try {
    ai = E.rapidAI(game, 1, aiLevel) || ai;
    if (E.rapidRefusal(game, 1, ai)) ai = E.forcedMoves(game, 1)[0] || { type: 'pass' };
    if (E.rapidRefusal(game, 1, ai)) ai = { type: 'pass' };
  } catch (err) { console.warn('AI error', err); ai = { type: 'pass' }; }
  const wasOpening = E.inOpening(game);
  game = E.rapidTick(game, [a, ai]);
  rapidEarnFx();
  { const idle = game.events.find((e) => e.t === 'idle' && e.player === 0); if (idle) setTimeout(() => toast('Idle: \u2212' + idle.lost + ' \u25c8', 'p1', 'passing earns nothing and costs rekon'), 120); }
  if (a.wing) {   // say what the wingman's free action did
    const w = game.events.find((e) => e.t === 'fire' && e.ship === a.wing.ship);
    setTimeout(() => toast(w ? 'Wingman fired too' : 'Wingman moved', 'p0 wingt', w ? a.wing.ship + ' added a shot of ' + plural(w.hits, 'hit') : a.wing.ship + ' moved 1 hex for free'), 150);
  }
  if (a.type === 'buy' && a.item === 'heatmap' && E.econOn(game)) {   // the heatmap is only as good as what you can see
    const t = [...E.threatMap(game, 0).values()].filter((x) => x.hits).length;
    setTimeout(() => toast('Heatmap', 'p0', t ? 'red: where the enemy ships you can see could hit you next tick' : 'no enemy ship in view, so nothing to shade yet (it updates if one appears)'), 200);
  }
  pending = null; endArmed = false; undoStack = []; mode = 'move';
  if (sel && !game.ships.some((x) => x.id === sel && !x.dead)) sel = null;
  sfxFor(a, game.events, 0);
  const ran = playFx(game.events, 0, game.flight, false);
  report = makeReport(game.events, 0);
  const news = game.events.filter((e) => e.seenBy.includes(0) && e.t !== 'lost').map(describe).filter((x) => x && x !== 'game_over');
  say((a.type === 'pass' ? 'You passed. ' : '') + (news.join(' ') || 'Nothing you could see happened.'));
  save();
  if (game.phase === 'over') {
    rapidReset();
    setTimeout(() => toast(game.winner === 'draw' ? 'Draw' : game.winner === 0 ? 'Victory!' : 'Defeat', 'over'), 600);
    return render();
  }
  // the opening just ended: tell the player the pace has changed
  if (wasOpening && !E.inOpening(game)) toast(game.rapid.openEnded === 'shot' ? 'First shot' : 'Contact', 'p0', 'the clock is now ' + game.rules.rapid.timer + ' s and ships move 1 hex');
  // no waiting in the opening (nothing to watch but moves); after it ends, the watch setting
  const w = E.inOpening(game) ? 0 : game.rules.rapid.watch * 1000;
  rapidWatch(w > 0 ? Math.max(w, Math.min(6000, ran + 300)) : 0);
  render();
}
// Economy mode: the purse by the tick ring, and "+n" floating up from each ship that earned this tick.
function pursePill() {
  if (!document.getElementById('rapid-css')) document.head.appendChild(h('style', { id: 'rapid-css' }, RAPID_CSS));
  const n = E.purse(game, 0), last = (game.econ.perTick[0] || []).slice(-1)[0] || 0;
  return h('span', { class: 'purse' + (RT.earnAt && Date.now() - RT.earnAt < 1800 ? ' up' : ''), role: 'img', 'aria-label': 'Rekon ' + n, title: 'Rekon: ' + n + ' (earned ' + game.econ.earned[0] + ' this game' + (last ? ', +' + last + ' last tick' : '') + '). Earn it in the enemy\u2019s half: outlined hexes 1, by an asteroid 2; first across the line 3; each ship past it 1 a tick; 2 a segment for a kill. At most ' + E.econConfig(game.rules).cap + ' a tick. Turrets cost ' + E.econConfig(game.rules).turretUpkeep + ' a tick each. Hidden from the enemy.' },
    h('i', null, '\u25c8'), h('b', null, String(n)),
    (() => { const ts = game.objs.filter((o) => o.kind === E.TURRET && o.owner === 0), c = E.econConfig(game.rules);
      if (!ts.length || !c.turretUpkeep) return null;
      const due = ts.length * c.turretUpkeep, short = E.purse(game, 0) < due;
      return h('span', { class: 'upchip' + (short ? ' short' : ''), title: ts.length + ' turret' + (ts.length > 1 ? 's' : '') + ': upkeep \u25c8 ' + due + ' every ' + c.turretEvery + ' ticks' + (short ? '. Not enough rekon: the oldest will go dark.' : '') }, 'T' + ts.length + ' \u2212' + due + '/' + c.turretEvery + 't'); })(),
    E.heatOn(game, 0) ? h('span', { class: 'heatchip', title: 'Heatmap showing: ' + plural(game.econ.heat[0] - game.round + 1, 'tick') + ' left' }, '\u25a6 ' + (game.econ.heat[0] - game.round + 1)) : null);
}
// The shop (economy mode): what rekon buys. Buying is the tick's whole action, like Pass.
const SOON = [];
// What turret upkeep costs, in words (economy mode)
// Why the selected ship has no laser target: nothing seen, out of reach (how far vs its reach), or blocked.
function noShotWhy(id) {
  const x = game.ships.find((z) => z.id === id);
  if (!x) return 'no target';
  const vis = new Set(game.players[0].vis), foes = game.ships.filter((z) => z.owner !== x.owner && !z.dead && vis.has(z.id));
  if (!foes.length) return 'no enemy in sight';
  let reachMax = 0;
  for (const sg of x.segs) if (!sg.wrecked) for (const q of sg.parts) { const c = game.rules.parts[q.t]; if (q.hp > 0 && c && +c.range && +c.hits) reachMax = Math.max(reachMax, +c.range); }
  const d = Math.min(...foes.map((f) => Math.min(...E.footprint(f).flatMap((c) => E.footprint(x).map((m) => hex.dist(c, m))))));
  return d > reachMax ? 'nearest ' + d + ' away, reach ' + reachMax : 'line blocked';
}
function upkeepWords() {
  const c = E.econConfig(game.rules);
  if (!c.turretUpkeep) return 'No upkeep.';
  return 'Upkeep: \u25c8 ' + c.turretUpkeep + ' per turret every ' + (c.turretEvery > 1 ? c.turretEvery + ' ticks' : 'tick') + '. Can\u2019t pay? It goes dark (stops firing) until you can. Rekon never goes below 0.';
}
function rapidShop() {
  if (RT.phase !== 'choose') return;
  const old = document.getElementById('rapidbuy'); if (old) { old.remove(); return; }
  const close = () => { const c = document.getElementById('rapidbuy'); if (c) c.remove(); };
  const purse = E.purse(game, 0);
  const forShip = sel;   // the ship selected when Buy was pressed is the one a purchase is for
  const rows = Object.entries(E.shopItems(game)).map(([k, it]) => {
    const cost = E.price(game, k), why = E.buyRefusal(game, 0, { type: 'buy', item: k });
    const short = purse < cost;
    return h('button', { class: 'btn go' + (short ? ' off' : ''), disabled: short, onclick: () => { close(); if (forShip) sel = forShip; it.needsShip ? rapidForShip(k) : rapidAct({ type: 'buy', item: k }); } },
      h('span', { class: 'shoprow' }, h('span', null, it.label), h('b', null, '\u25c8 ' + cost)), h('small', null, short ? 'need ' + (cost - purse) + ' more' : it.about + (k === 'heatmap' ? ', shown for your next ' + E.econConfig(game.rules).heatTicks + ' ticks' : k === 'resupply' ? '' : k === 'turret' ? '; ' + E.econConfig(game.rules).turretHits + ' hits a tick within ' + E.econConfig(game.rules).turretRange + '. ' + upkeepWords() : '')));
  });
  const later = SOON.map(([n, about, c]) => h('button', { class: 'btn off', disabled: true }, h('span', { class: 'shoprow' }, h('span', null, n), h('b', null, '\u25c8 ' + c)), h('small', null, about + ' (coming later)')));
  const sheet = h('div', { id: 'rapidbuy', class: 'rapidconv', role: 'dialog', 'aria-label': 'Buy' },
    h('b', null, 'Buy \u00b7 \u25c8 ' + purse + (forShip ? ' \u00b7 for ' + forShip : '')),
    h('small', null, 'Buying is your action for this tick: your ships hold still. The enemy doesn\u2019t see it.'),
    ...rows, ...later,
    h('button', { class: 'btn', onclick: close }, 'Back'));
  // taps on the sheet must not reach the board underneath (a tap there on empty space deselected the ship)
  for (const ev of ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend']) sheet.addEventListener(ev, (e) => e.stopPropagation());
  document.body.appendChild(sheet);
}
// A purchase for one ship: the selected one, or the one the player taps next.
function rapidForShip(item) {
  if (item === 'turret') return rapidTurretStart();
  const x = sel && game.ships.find((z) => z.id === sel && z.owner === 0 && !z.dead);
  if (!x) { RT.pick = item; pending = null; say(item[0].toUpperCase() + item.slice(1) + ': tap the ship it is for.'); return render(); }
  if (item === 'warp') {   // experiment: tap where it goes
    const spots = E.warpSpots(game, 0, x.id);
    if (!spots.length) { say('No free spot within 4 hexes in your half for ' + x.id + '.'); return render(); }
    RT.place = { item: 'warp', ship: x.id, spots, act: (c) => ({ type: 'buy', item: 'warp', ship: x.id, at: c }), label: 'W' };
    say('Warp: tap a marked hex (W) for ' + x.id + '. Anything else cancels.'); return render();
  }
  if (item === 'repair' || item === 'hibernate') {   // experiments
    const why = E.buyRefusal(game, 0, { type: 'buy', item, ship: x.id });
    if (why) { say(item[0].toUpperCase() + item.slice(1) + ': ' + why + '.'); return render(); }
    return rapidAct({ type: 'buy', item, ship: x.id });
  }
  if (item === 'resupply') {
    const why = E.resupplyRefusal(game, 0, x.id);
    if (why) { say('Resupply: ' + why + '.'); return render(); }
    return rapidAct({ type: 'buy', item: 'resupply', ship: x.id });
  }
  // upgrade: choose which
  const close = () => { const c = document.getElementById('rapidbuy'); if (c) c.remove(); };
  close(); render();
  const rows = Object.entries(E.UPGRADES).map(([k, u]) => {
    const why = E.upgradeRefusal(game, 0, x.id, k);
    return h('button', { class: 'btn go' + (why ? ' off' : ''), disabled: !!why, onclick: () => { close(); rapidAct({ type: 'buy', item: 'upgrade', ship: x.id, kind: k }); } }, u.label, h('small', null, why || ({ range: 'every laser on it reaches 1 hex further', shield: 'its shields come back 1 tick sooner', sensor: 'its core sees 1 hex further', armour: 'one armour plate takes 1 more hit' })[k]));
  });
  const sheet = h('div', { id: 'rapidbuy', class: 'rapidconv', role: 'dialog', 'aria-label': 'Upgrade' },
    h('b', null, 'Upgrade ' + x.id + ' \u00b7 \u25c8 ' + E.price(game, 'upgrade')), h('small', null, 'One upgrade per ship, for good. It uses your tick. A scan shows it to the enemy.'),
    ...rows, h('button', { class: 'btn', onclick: close }, 'Back'));
  for (const ev of ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend']) sheet.addEventListener(ev, (e) => e.stopPropagation());
  document.body.appendChild(sheet);
}
// Buying a turret: the selected ship (or the one to tap next) shows the free hexes next to it; tap one.
function rapidTurretStart() {
  const x = sel && game.ships.find((z) => z.id === sel && z.owner === 0 && !z.dead);
  if (!x) { RT.pick = 'turret'; pending = null; say('Turret: tap the ship that will leave one of its lasers behind.'); return render(); }
  if (!E.droppableLaser(game, x)) { say(x.id + ' has no working laser to leave behind.'); return render(); }
  if (!E.turretSpots(game, 0, x.id).length) { say('No free hex next to ' + x.id + ' for a turret.'); return render(); }
  RT.turretFor = x.id; pending = null;
  say('Tap a hex marked T next to ' + x.id + ' for the turret. It takes one of ' + x.id + '\u2019s lasers.');
  render();
}
// The heatmap (economy mode, bought): every hex the enemy ships you can see could hit next tick.
function rapidHeat() {
  if (!E.econOn(game) || game.phase !== 'play' || !E.heatOn(game, 0)) return null;
  return [...E.threatMap(game, 0).values()];
}
function rapidEarnFx() {
  if (!E.econOn(game)) return;
  const now = Date.now(), e = game.events.find((x) => x.t === 'earned' && x.player === 0);
  RT.earn = (RT.earn || []).filter((f) => now - f.born < 1800);
  if (!e) return;
  const by = new Map();   // one float per ship: the sum of what it earned
  for (const it of e.items) {
    const x = game.ships.find((q) => q.id === it.ship);
    const at = it.why === 'kill' || !x || x.dead ? it.at : x.pos;   // a kill floats from the wreck
    const k = it.why === 'kill' ? 'k' + it.ship : it.ship;
    const f = by.get(k) || { at, n: 0, born: now };
    f.n += it.n; by.set(k, f);
  }
  RT.earn.push(...by.values());
  RT.earnAt = now;
  setTimeout(() => { if (RT.earn && RT.earn.length && Date.now() - RT.earnAt >= 1800) { RT.earn = []; render(); } }, 1900);
}
// The clock: a bar across the top of the screen. Teal while you choose (red in the last 5 s), grey while you watch.
function rapidBar() {
  let bar = document.getElementById('rapidbar');
  if (!isRapidGame() || game.phase !== 'play' || RT.phase === 'idle') { if (bar) bar.hidden = true; cancelAnimationFrame(RT.raf); RT.raf = 0; return; }
  if (!bar) {
    if (!document.getElementById('rapid-css')) document.head.appendChild(h('style', { id: 'rapid-css' }, RAPID_CSS));
    bar = h('div', { id: 'rapidbar', role: 'timer', 'aria-live': 'off' }, h('i'), h('span'));
    document.body.appendChild(bar);
  }
  bar.hidden = false;
  if (!RT.raf) RT.raf = requestAnimationFrame(rapidFrame);
}
function rapidFrame() {
  RT.raf = 0;
  const bar = document.getElementById('rapidbar');
  if (!bar || !isRapidGame() || RT.phase === 'idle') return;
  const now = performance.now(), left = Math.max(0, RT.end - now), frac = RT.end > RT.start ? left / (RT.end - RT.start) : 0;
  const fillEl = bar.firstChild, text = bar.lastChild;
  bar.className = RT.phase + (RT.phase === 'choose' && left < 5000 ? ' low' : '');
  // watching: the bar fills back up; choosing: it shrinks
  fillEl.style.width = (RT.phase === 'watch' ? 100 * (1 - frac) : RT.phase === 'busy' || RT.phase === 'starting' ? 0 : 100 * frac).toFixed(2) + '%';
  text.textContent = RT.phase === 'choose' ? 'Tick ' + game.round + ' · ' + Math.ceil(left / 1000) + ' s'
    : RT.phase === 'watch' ? 'Watch · tick ' + game.round : RT.phase === 'auto' ? 'Out of time' : '';
  RT.raf = requestAnimationFrame(rapidFrame);
}
const RAPID_CSS = `
#tbar .purse,.purse{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:999px;border:1px solid rgba(232,196,106,.45);color:#ffd77a;font:700 14px system-ui,sans-serif;white-space:nowrap}
.purse i{font-style:normal;font-size:15px}.purse.up{background:rgba(232,196,106,.18);box-shadow:0 0 10px rgba(255,215,122,.45)}
.earnup{animation:earnup 1.8s ease-out forwards;transform-box:fill-box}
@keyframes earnup{0%{opacity:0;transform:translateY(4px)}12%{opacity:1}70%{opacity:1}100%{opacity:0;transform:translateY(-14px)}}
@media (prefers-reduced-motion:reduce){.earnup{animation:none}}
#toast.wingt{border-color:#c58cff!important;box-shadow:0 0 18px rgba(197,140,255,.55)}
#rapidbar{position:fixed;left:0;right:0;top:0;height:7px;z-index:60;background:rgba(10,20,36,.75);pointer-events:none}
#rapidbar i{display:block;height:100%;width:0;background:#7fd8f0;box-shadow:0 0 10px rgba(127,216,240,.7);margin:0 auto}
#rapidbar.watch i{background:#8f9cba;box-shadow:none}
#rapidbar.low i{background:#ff5a6e;box-shadow:0 0 12px rgba(255,90,110,.8)}
#rapidbar.auto i{background:#ff5a6e}
#rapidbar span{position:absolute;top:8px;left:50%;transform:translateX(-50%);font:600 11px system-ui,sans-serif;color:#c6d0e4;background:rgba(4,10,20,.7);padding:1px 8px;border-radius:0 0 6px 6px;white-space:nowrap}
#rapidbar span:empty{display:none}
.rapidcancel{position:fixed;left:50%;bottom:22%;transform:translateX(-50%);z-index:70;min-width:150px;min-height:56px;border:0;border-radius:14px;background:#e0283f;color:#fff;font:700 20px system-ui,sans-serif;box-shadow:0 6px 24px rgba(224,40,63,.55);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer}
.rapidcancel small{font-size:11px;font-weight:600;opacity:.85}
.rapidconv{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:70;width:min(340px,92vw);background:#0b1426;border:1px solid #7fd8f0;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;box-shadow:0 10px 40px rgba(0,0,0,.6)}
.rapidconv>b{font:700 17px system-ui,sans-serif;color:#e8f2ff}.rapidconv>small{color:#9fb0cc;font-size:12px}
.rapidconv button{display:flex;flex-direction:column;align-items:flex-start;text-align:left;min-height:48px;padding:6px 12px}
.rapidconv .shoprow{display:flex;justify-content:space-between;width:100%;gap:12px}.rapidconv .shoprow b{color:#ffd77a}
.rapidconv button.off{opacity:.45}
.buyb .ibic{color:#ffd77a}
.purse .upchip{margin-left:4px;padding:0 5px;border-radius:6px;background:rgba(232,196,106,.18);color:#ffd77a;font-size:12px}.purse .upchip.short{background:rgba(255,90,110,.3);color:#ffc2ca}
.purse .heatchip{margin-left:4px;padding:0 5px;border-radius:6px;background:rgba(255,59,82,.25);color:#ffb3bd;font-size:12px}
.rapidconv button small{font-size:11px;opacity:.8;font-weight:500}
body.rapid-auto #rail,body.rapid-auto #ctx,body.rapid-auto #dock,body.rapid-auto #turnbtns{pointer-events:none;opacity:.6}
.endb.off{opacity:.45}
`;

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
