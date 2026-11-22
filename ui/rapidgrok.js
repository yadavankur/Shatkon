// RAPID GROK: the rapid-mode screen (rapid-grok.html).
// One action each, against the clock: 15 s to act, 5 s to watch. Game logic lives in
// engine/rapidgrok.js; this file only draws the board, runs the clock and turns taps into actions.
// It does not touch classic play (ui/play.js, ui/board.js).

import * as E from '../engine/index.js';
import * as G from '../engine/rapidgrok.js';
import { scanRadii } from '../engine/scan.js';
import { drawShip, shipDefs, TEAM } from './ships.js';
import { drawFrigate, frigateDefs } from './frigate.js';
import * as PG from './rapidgrok-postgame.js';

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
let watch = null;              // what to highlight during the watch
let log = [];
let toastTimer = 0;
let wrecks = [];               // { id, name, owner, cells, at, beat }
let flashes = new Map();       // shipId -> end time
let lastHot = new Map();
const moveAnims = new Map();   // shipId -> { trail, to, start, dur }
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

function say(text, cls = '') { log.unshift({ text, cls, beat: game ? game.round : 0 }); log = log.slice(0, 200); fillLogPane(); }
function toast(text, foe = false, ms = 2600) {
  const t = $('toast'); t.textContent = text; t.hidden = false; t.className = foe ? 'foe' : '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

// Plain-English lines for the events a player was shown.
function describe(e, viewer) {
  const mine = (id) => { const s = game.ships.find((x) => x.id === id); return s && s.owner === viewer; };
  switch (e.t) {
    case 'move': return mine(e.ship) ? null : [nameOf(e.ship) + ' moved' + (e.steps > 1 ? ' (' + e.steps + ' hexes)' : ''), 'foe'];
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


function noteOutcomes(events) {
  const now = performance.now();
  for (const e of events || []) {
    if ((e.t === 'damage' || e.t === 'hit' || e.t === 'destroyed') && e.ship) flashes.set(e.ship, now + 1600);
    if (e.t === 'destroyed') {
      const sh = game.ships.find((x) => x.id === e.ship);
      const vis = (game.players[ME] && game.players[ME].vis) || [];
      const known = e.owner === ME || G.shooterKnown(game, ME, events, e.ship) || (sh && vis.includes(e.ship));
      if (sh && (e.owner === ME || known)) {
        const cells = sh.segs.map((g) => [sh.pos[0] + g.off[0], sh.pos[1] + g.off[1]]);
        wrecks = wrecks.filter((w) => w.id !== e.ship);
        wrecks.push({ id: e.ship, name: e.owner === ME ? (e.name || sh.name) : 'enemy wreck', owner: e.owner, cells, at: cells[0], beat: game.round });
      }
    }
  }
}

function targetNameFromEvents(events, fire) {
  const hit = events.find((e) => (e.t === 'damage' || e.t === 'destroyed') && game.ships.some((x) => x.id === e.ship && x.owner === ME));
  if (hit) return nameOf(hit.ship);
  if (fire && fire.end) {
    const at = (x) => x.segs.some((g) => { const c = [x.pos[0] + g.off[0], x.pos[1] + g.off[1]]; return c[0] === fire.end[0] && c[1] === fire.end[1]; });
    const sh = game.ships.find((x) => x.owner === ME && at(x));
    if (sh) return sh.name;
  }
  return null;
}

function summarizeWatch(events) {
  const ev = events || [];
  const lost = ev.filter((e) => e.t === 'destroyed' && e.owner === ME);
  const dmg = ev.filter((e) => e.t === 'damage' && game.ships.some((x) => x.id === e.ship && x.owner === ME));
  const fire = ev.find((e) => e.t === 'enemy_fire');
  const known = fire ? G.shooterKnown(game, ME, ev, fire.ship) : false;
  const victim = lost[0] ? (lost[0].name || nameOf(lost[0].ship)) : (dmg[0] ? nameOf(dmg[0].ship) : targetNameFromEvents(ev, fire));
  if (lost.length) {
    const more = lost.length > 1 ? ' and ' + (lost.length - 1) + ' more' : '';
    const how = fire ? (known ? ' by ' + nameOf(fire.ship) : ' by fire from the fog') : '';
    return { text: 'Your ' + victim + ' was destroyed' + how + more + '.', foe: true, mustWatch: true, known, extra: null };
  }
  if (dmg.length) {
    const e = dmg[0];
    const bits = ['Your ' + nameOf(e.ship) + ' took ' + (e.hits || 0) + ' hit' + ((e.hits || 0) === 1 ? '' : 's')];
    if (e.lost && String(e.lost).includes('wrecked')) bits.push('a segment is wrecked');
    if (e.hull != null) bits.push('hull now ' + e.hull + '%');
    const from = fire ? (known ? ' from ' + nameOf(fire.ship) : ' from the fog') : '';
    return { text: bits.join(', ') + from + '.', foe: true, mustWatch: true, known, extra: null };
  }
  if (fire && known) {
    return { text: nameOf(fire.ship) + ' fired at ' + (victim ? 'your ' + victim : 'you') + (fire.hits ? ' (' + fire.hits + ' hit' + (fire.hits === 1 ? '' : 's') + ')' : ' (missed)') + '.', foe: true, mustWatch: true, known, extra: null };
  }
  if (fire && !known) {
    return { text: (victim ? 'An unseen enemy fired at your ' + victim + ' from the fog.' : 'An unseen enemy fired from the fog.'), foe: true, mustWatch: true, known: false, extra: null };
  }
  const foeMove = ev.find((e) => e.t === 'move' && game.ships.some((x) => x.id === e.ship && x.owner === CPU) && G.shooterKnown(game, ME, ev, e.ship));
  if (foeMove) return { text: nameOf(foeMove.ship) + ' moved' + (foeMove.steps > 1 ? ' ' + foeMove.steps + ' hexes' : '') + '.', foe: true, mustWatch: true, known: true, extra: null };
  if (ev.some((e) => e.t === 'sighted')) return { text: 'Enemy spotted.', foe: true, mustWatch: true, known: true, extra: null };
  return { text: 'The enemy acted out of your sight.', foe: true, mustWatch: false, known: false, extra: 'The enemy acted out of your sight.' };
}

function fillLogPane() {
  const box = $('loglist'); if (!box) return;
  box.textContent = '';
  for (const l of log) {
    const li = document.createElement('li'); li.className = l.cls || '';
    li.textContent = (l.beat ? 'B' + l.beat + ' · ' : '') + l.text;
    box.appendChild(li);
  }
}

function toggleLogPane(show) {
  const pane = $('logpane');
  if (!pane) return;
  const on = show == null ? pane.hidden : show;
  pane.hidden = !on;
  fillLogPane();
}

function queueAnims(events, perHexMs) {
  const now = performance.now();
  for (const e of events) {
    if (e.t === 'move' && e.trail && e.trail.length > 1) {
      moveAnims.set(e.ship, { trail: e.trail, to: e.to, start: now, dur: perHexMs * (e.trail.length - 1) });
    }
  }
}

function animOffset(id, now) {
  const a = moveAnims.get(id);
  if (!a) return null;
  const u = (now - a.start) / a.dur;
  if (u >= 1) { moveAnims.delete(id); return null; }
  const segs = a.trail.length - 1;
  const f = Math.max(0, u) * segs;
  const i = Math.min(segs - 1, Math.floor(f));
  const t = f - i;
  const ax = X(a.trail[i]) * (1 - t) + X(a.trail[i + 1]) * t;
  const ay = Y(a.trail[i]) * (1 - t) + Y(a.trail[i + 1]) * t;
  return [ax - X(a.to), ay - Y(a.to)];
}

// ---------- the flow: act -> (auto-fire) -> computer -> watch -> act ----------
function newGame() {
  const seed = qs.has('seed') ? Number(qs.get('seed')) : (Date.now() % 100000) + 1;
  game = G.rgStart(rules, seed);
  sel = null; mode = 'move'; log = []; watch = null; autoAct = null; pausedLeft = null;
  moveAnims.clear(); wrecks = []; flashes.clear(); ended = null; reportLog = null; reviewing = false; stopReplayTimer();
  document.body.classList.remove('review');
  document.body.classList.remove('postgame-open');
  $('intro').hidden = true; $('over').hidden = true;
  if (qs.get('selfplay') === '1') { selfPlayToEnd(); return; }
  if (G.toAct(game) === CPU) { say('The computer moves first.', 'beat'); toast('The computer moves first'); computerTurn([]); }
  else { say('You move first.', 'beat'); toast('You move first'); startAct(); }
}

function selfPlayToEnd() {
  let n = 0;
  while (game.phase === 'play' && n++ < 500) game = G.aiTurn(game, G.toAct(game), level).state;
  finish();
}

function startAct() {
  if (game.phase !== 'play') return finish();
  phase = 'act'; watch = null;
  sel = null;   // start every turn with nothing selected (a timeout then picks a random front/single ship)
  mode = 'move';
  setClock(ACT());
  document.body.classList.add('yourturn');
  setTimeout(() => document.body.classList.remove('yourturn'), 1200);
  render();
}

function skipWatch() {
  if (phase !== 'watch') return;
  startAct();
}

function setClock(ms) { total = ms; deadline = performance.now() + ms; pausedLeft = null; }

// The player's action (from a tap, or from the clock). Then the computer replies.
function play(action, why = null, meta = { why: 'play' }) {
  const r = G.rgAttempt(game, action, meta);
  if (!r.ok) { toast('Not allowed: ' + r.why); return false; }
  const before = game;
  game = r.state;
  if (why) say(why, 'me');
  const mineEvents = G.seenEvents(game, ME);
  queueAnims(mineEvents, 150);
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
    queueAnims(seen, 280);
    noteOutcomes(seen);
    const summary = summarizeWatch(seen);
    for (const e of seen) { const d = describe(e, ME); if (d) say(d[0], d[1]); }
    if (summary.extra) say(summary.extra, summary.foe ? 'foe' : 'me');
    if (before.round !== game.round && game.phase === 'play') say('— beat ' + game.round + ' —', 'beat');
    watch = { events: myEvents.concat(seen), text: summary.text, known: summary.known };
    if (game.phase !== 'play') return finish();
    if (!G.watchHasSight(game, ME, seen) && !summary.mustWatch) {
      startAct();
      return;
    }
    phase = 'watch';
    setClock(WATCH());
    toast(summary.text, summary.foe, Math.min(WATCH(), 3500));
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
    toast('No target for the ' + mode + ': ' + ship.name + ' moves forward instead');
  }
  forced(ship ? ship.id : null, ship && mode === 'scan' ? 'Time up: scans never fire by themselves, so ' + ship.name + ' moves forward' : null);
}

function forced(shipId, why) {
  const a = G.forcedMove(game, shipId);
  if (!a) {   // nothing at all can move: the only time a turn goes by with nothing done
    game = G.rgStuckPass(game, { why: 'stuck' }); say('Time up: none of your ships could move', 'me');
    if (game.phase !== 'play') return finish();
    return computerTurn([]);
  }
  const msg = why || ('Time up: ' + nameOf(a.ship) + ' moves forward' + (shipId ? '' : ' (picked at random)'));
  toast(msg);
  play(a, msg, { why: forcedWhy || 'timeout-move' });
}

let forcedWhy = 'timeout-move';
function cancelAuto() {
  if (phase !== 'cancel' || !autoAct) return;
  const id = autoAct.ship; autoAct = null; $('cancel').hidden = true;
  forcedWhy = 'cancel-move';
  forced(id, 'Auto-fire cancelled: ' + nameOf(id) + ' moves forward instead');
  forcedWhy = 'timeout-move';
}

let ended = null, reportLog = null, replayTimer = null, reviewing = false;

function finish() {
  stopReplayTimer();
  phase = 'over'; reviewing = false; ended = game; $('cancel').hidden = true;
  document.body.classList.remove('review');
  document.body.classList.remove('postgame-open');
  document.body.classList.add('postgame-open');
  render();
  const shown = PG.showReport(game, {
    onAgain: () => newGame(),
    onClose: () => seeBoard(),
    onReplay: () => startReplay(),
    onSave: () => PG.downloadLog(reportLog || PG.buildLog(ended || game)),
    onShow: (at) => { seeBoard(); if (at) highlightHex(at); },
  });
  reportLog = shown.log;
}

function seeBoard() {
  stopReplayTimer();
  phase = 'over'; reviewing = true;
  if (ended) game = ended;
  PG.hideReport();
  document.body.classList.remove('postgame-open');
  document.body.classList.add('review');
  $('replayRange').hidden = true;
  $('replayPlay').hidden = true;
  $('reviewLabel').textContent = 'Game over · beat ' + (ended || game).round;
  render();
}

function startReplay() {
  if (!ended) ended = game;
  const acts = (ended.rg && ended.rg.acts) || [];
  reportLog = reportLog || PG.buildLog(ended);
  PG.hideReport();
  document.body.classList.remove('postgame-open');
  document.body.classList.add('review');
  phase = 'replay'; reviewing = true;
  const range = $('replayRange');
  range.hidden = false; range.min = '0'; range.max = String(acts.length); range.value = '0';
  $('replayPlay').hidden = false; $('replayPlay').textContent = 'Play';
  jumpReplay(0);
}

function jumpReplay(i) {
  if (!ended) return;
  const acts = (ended.rg && ended.rg.acts) || [];
  i = Math.max(0, Math.min(acts.length, Number(i) || 0));
  game = G.rgReplayFrom(rules, ended.seed, acts.slice(0, i));
  phase = 'replay'; reviewing = true;
  $('replayRange').value = String(i);
  const rec = acts[i - 1];
  $('reviewLabel').textContent = i === 0
    ? 'Replay · start'
    : 'Replay · beat ' + rec.beat + ' · ' + i + ' of ' + acts.length + (rec.say ? '' : '');
  render();
}

function stopReplayTimer() {
  if (replayTimer) { clearInterval(replayTimer); replayTimer = null; }
  const b = $('replayPlay'); if (b) b.textContent = 'Play';
}

function toggleReplayPlay() {
  if (phase !== 'replay') startReplay();
  if (replayTimer) { stopReplayTimer(); return; }
  const acts = (ended.rg && ended.rg.acts) || [];
  $('replayPlay').textContent = 'Pause';
  replayTimer = setInterval(() => {
    let i = Number($('replayRange').value) + 1;
    if (i > acts.length) { stopReplayTimer(); return; }
    jumpReplay(i);
    if (i >= acts.length) stopReplayTimer();
  }, 180);
}

function highlightHex(at) {
  const svg = $('board');
  const old = svg.querySelector('.rg-jump'); if (old) old.remove();
  const g = document.createElementNS(NS, 'path');
  g.setAttribute('class', 'rg-jump');
  g.setAttribute('d', cellPath(at, 1.02));
  g.setAttribute('fill', 'none');
  g.setAttribute('stroke', '#ffe38a');
  g.setAttribute('stroke-width', '2.4');
  g.setAttribute('pointer-events', 'none');
  svg.appendChild(g);
}

// ---------- the clock ----------
function frame(now) {
  requestAnimationFrame(frame);
  if (moveAnims.size) {
    const svg = $('board');
    for (const id of [...moveAnims.keys()]) {
      const g = svg.querySelector(`g[data-ship="${id}"]`);
      const off = animOffset(id, now);
      if (g) {
        if (off) g.setAttribute('transform', `translate(${f1(off[0])},${f1(off[1])})`);
        else g.removeAttribute('transform');
      }
    }
  }
  if (!game || phase === 'intro' || phase === 'over' || phase === 'ai' || phase === 'replay') { if (phase === 'ai') $('clocktext').textContent = 'Enemy is thinking…'; if (phase === 'over' || phase === 'replay') $('clocktext').textContent = phase === 'replay' ? 'Replay' : 'Game over'; return; }
  const left = pausedLeft !== null ? pausedLeft : Math.max(0, deadline - now);
  const bar = $('bar');
  const pct = ((left / total) * 100).toFixed(2) + '%';
  bar.style.width = pct;
  bar.style.setProperty('--left', pct);
  bar.className = phase === 'watch' ? 'watch' : (phase === 'cancel' || left < 5000) ? 'low' : '';
  const secs = Math.ceil(left / 1000);
  $('clocktext').textContent = pausedLeft !== null ? 'Paused' : phase === 'act' ? 'Your turn · ' + secs + 's' : phase === 'watch' ? 'Watch · ' + secs + 's · tap to skip' : 'Auto-firing…';
  if (phase === 'cancel') $('cancel').querySelector('i').style.width = ((1 - left / total) * 100).toFixed(1) + '%';
  if (pausedLeft !== null || left > 0) return;
  if (phase === 'act') timeUp();
  else if (phase === 'watch') startAct();
  else if (phase === 'cancel' && autoAct) { const a = autoAct; autoAct = null; $('cancel').hidden = true; play(a.action, 'Time up: ' + nameOf(a.ship) + ' auto-fired its ' + a.weapon + ' at ' + nameOf(a.action.target), { why: 'timeout-autofire' }); }
}

function togglePause() {
  if (!game || phase === 'intro' || phase === 'over' || phase === 'ai' || phase === 'replay') return;
  if (pausedLeft === null) { pausedLeft = Math.max(0, deadline - performance.now()); $('pause').textContent = 'Resume'; }
  else { deadline = performance.now() + pausedLeft; pausedLeft = null; $('pause').textContent = 'Pause'; }
}

// ---------- taps ----------
function myShipAt(c, v) { return v.ships.find((x) => x.mine && x.cells.some((z) => H.same(z, c))); }
function onCell(c) {
  if (phase === 'watch' && pausedLeft === null) { skipWatch(); return; }
  if (phase !== 'act' || pausedLeft !== null) return;
  const v = E.view(game, ME), k = H.key(c);
  const own = myShipAt(c, v);
  const reach = sel && mode === 'move' ? E.reach(game, sel).find((o) => H.key(o.at) === k) : null;
  const shot = sel && mode === 'laser' ? bestAt(E.beamTargets(game, sel), k) : null;
  const lo = sel && mode === 'missile' ? E.launchOptions(game, sel) : null;
  const canLaunch = !!(lo && H.inHexagon(c, rules.board.radius) && !own);
  const intent = G.rgTapIntent({
    sel, mode, ownId: own && own.id,
    canMoveHere: !!reach, canFireHere: !!shot, canLaunchHere: canLaunch,
    empty: !own && !lastHot.has(k) && !v.ships.some((x) => !x.mine && x.cells.some((z) => H.same(z, c))),
  });
  if (intent.type === 'select') { sel = intent.id; mode = 'move'; render(); return; }
  if (intent.type === 'clear') { sel = null; mode = 'move'; render(); return; }
  if (intent.type === 'move' && reach) { play({ type: 'move', ship: sel, path: reach.path }); return; }
  if (intent.type === 'fire' && shot) { play({ type: 'fire', ship: sel, seg: shot.seg, part: shot.part, at: shot.at }); return; }
  if (intent.type === 'launch' && canLaunch) {
    const foe = v.ships.find((x) => !x.mine && x.cells.some((z) => H.same(z, c)));
    const target = foe && lo.locks.includes(foe.id) ? foe.id : null;
    const a = E.aimLaunch(game, sel, lo.kinds[0], c, target);
    if (a) { play({ ...a, aim: c }); return; }
  }
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
  const viewAs = (phase === 'over' || phase === 'replay') ? 'all' : ME;
  const v = E.view(game, viewAs), svg = $('board'), R = rules.board.radius, now = performance.now();
  const beatShow = (game.phase === 'over' && game.winner === 'draw' && game.round > rules.turnLimit) ? rules.turnLimit : game.round;
  $('beat').textContent = 'Beat ' + beatShow + ' / ' + rules.turnLimit;
  const fl = G.fleetTally(game, ME);
  const fleetEl = $('fleet');
  if (fleetEl) fleetEl.textContent = 'Your fleet ' + fl.alive + '/' + fl.total;
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
    if (mode === 'move') for (const o of E.reach(game, sel)) hot.set(H.key(o.at), { cls: 'move' });
    if (mode === 'laser') for (const t of E.beamTargets(game, sel)) { const k = H.key(t.at), h = hot.get(k); if (!h || h.label < t.hits) hot.set(k, { cls: 'laser', label: t.hits }); }
    if (mode === 'missile') { const lo = E.launchOptions(game, sel); if (lo) for (const id of lo.locks) { const t = v.ships.find((x) => x.id === id); if (t) for (const c of t.cells) hot.set(H.key(c), { cls: 'lock' }); } }
  }
  if (phase === 'cancel' && autoAct) {
    const a = autoAct.action, t = a.target && v.ships.find((x) => x.id === a.target);
    if (a.type === 'fire') hot.set(H.key(a.at), { cls: 'laser', label: a.hits });
    if (t) for (const c of t.cells) hot.set(H.key(c), { cls: 'auto' });
  }
  lastHot = hot;

  const cells = el('g');
  for (const c of H.disc([0, 0], R)) {
    const k = H.key(c), tt = terrain.get(k);
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

  // what the last actions did (drawn beneath ships so trails stay legible)
  if (watch && (phase === 'watch' || phase === 'act')) {
    const faint = phase === 'act' ? 0.35 : 1;
    for (const e of watch.events) {
      if (e.t === 'move') {
        const pts = e.trail && e.trail.length > 1 ? e.trail : [e.from, e.to];
        const d = 'M' + pts.map((c) => f1(X(c)) + ',' + f1(Y(c))).join('L');
        const isCpu = game.ships.some((x) => x.id === e.ship && x.owner === CPU);
        if (isCpu) {
          root.appendChild(el('path', { d, fill: 'none', stroke: TEAM[1].neon, 'stroke-width': 1.6, 'stroke-opacity': faint, 'stroke-linejoin': 'round', 'marker-end': 'url(#rgArrow)', 'pointer-events': 'none' }));
        } else if (phase === 'watch' && pts.length > 1) {
          root.appendChild(el('path', { d, fill: 'none', stroke: TEAM[0].accent, 'stroke-width': 1.2, 'stroke-opacity': 0.5, 'stroke-dasharray': '2 2', 'stroke-linejoin': 'round', 'pointer-events': 'none' }));
        }
      }
      if ((e.t === 'enemy_fire' || e.t === 'fire') && e.from && e.end) {
        const known = e.t === 'fire' || (watch && watch.known) || G.shooterKnown(game, ME, watch ? watch.events : [], e.ship);
        if (known) {
          const T = TEAM[e.t === 'fire' ? 0 : 1];
          root.appendChild(el('line', { x1: f1(X(e.from)), y1: f1(Y(e.from)), x2: f1(X(e.end)), y2: f1(Y(e.end)), stroke: T.neon, 'stroke-width': 1.8, 'stroke-opacity': faint, 'stroke-linecap': 'round', 'pointer-events': 'none' }));
        }
      }
      if ((e.t === 'hit' || e.t === 'damage') && e.at) root.appendChild(el('path', { d: cellPath(e.at, 0.9), fill: '#ff4d5e', 'fill-opacity': 0.35 * faint, stroke: '#ff4d5e', 'stroke-width': 1, 'pointer-events': 'none' }));
      if (e.t === 'blast' && e.at) root.appendChild(el('circle', { cx: f1(X(e.at)), cy: f1(Y(e.at)), r: f1(S * 1.6), fill: '#ffb347', 'fill-opacity': 0.3 * faint, stroke: '#ffb347', 'pointer-events': 'none' }));
    }
  }

  // wreck markers (your lost ships, and any enemy wreck you actually saw)
  for (const w of wrecks) {
    const T = TEAM[w.owner === ME ? 0 : 1];
    root.appendChild(el('path', { d: outlinePath(w.cells), stroke: T.main, 'stroke-width': 1.1, 'stroke-dasharray': '1.8 1.4', 'stroke-opacity': 0.85, fill: '#ff4d5e', 'fill-opacity': 0.12, 'pointer-events': 'none' }));
    const cx = w.cells.reduce((n, c) => n + X(c), 0) / w.cells.length, cy = w.cells.reduce((n, c) => n + Y(c), 0) / w.cells.length;
    const flash = flashes.get(w.id) && flashes.get(w.id) > now;
    root.appendChild(el('path', { d: `M${f1(cx - S * 0.45)},${f1(cy - S * 0.45)}L${f1(cx + S * 0.45)},${f1(cy + S * 0.45)}M${f1(cx + S * 0.45)},${f1(cy - S * 0.45)}L${f1(cx - S * 0.45)},${f1(cy + S * 0.45)}`, stroke: flash ? '#ffe38a' : T.neon, 'stroke-width': 1.3, 'stroke-opacity': 0.9, 'pointer-events': 'none' }));
  }

  // ships
  const canShoot = new Set();
  if (phase === 'act') {
    for (const x of v.ships.filter((z) => z.mine)) {
      const st2 = E.shipStatus(game, x.id) || {};
      if ((st2.beamsReady && E.beamTargets(game, x.id).length) || E.launchOptions(game, x.id)) canShoot.add(x.id);
    }
  }
  const hideJustSeen = new Set();
  if (phase === 'watch' && watch) for (const ev of watch.events || []) if (ev.t === 'sighted' && ev.id) hideJustSeen.add(ev.id);
  for (const x of v.ships) {
    if (hideJustSeen.has(x.id)) continue;   // fired from out of sight: the hit-flash must not give their position away
    const cx = x.cells.reduce((n, c) => n + X(c), 0) / x.cells.length, cy = x.cells.reduce((n, c) => n + Y(c), 0) / x.cells.length;
    const T = TEAM[x.owner === ME ? 0 : 1];
    const off = animOffset(x.id, now);
    const wrap = el('g', { 'data-ship': x.id, transform: off ? `translate(${f1(off[0])},${f1(off[1])})` : null, 'pointer-events': 'none' });
    const flashing = flashes.get(x.id) && flashes.get(x.id) > now;
    wrap.appendChild(el('path', { d: outlinePath(x.cells), stroke: flashing ? '#ffe38a' : (x.id === sel ? '#ffffff' : T.neon), 'stroke-width': flashing || x.id === sel ? 2 : (canShoot.has(x.id) ? 1.4 : 0.8), 'stroke-opacity': x.id === sel || flashing ? 1 : 0.55, fill: flashing ? '#ff4d5e' : 'none', 'fill-opacity': flashing ? 0.25 : 0 }));
    if (canShoot.has(x.id)) wrap.appendChild(el('circle', { cx: f1(cx + S * 0.85), cy: f1(cy - S * 0.7), r: 2.1, fill: '#ffe38a', stroke: '#041018', 'stroke-width': 0.4 }));
    const art = el('g', { transform: `translate(${f1(cx)},${f1(cy)}) scale(0.92) translate(${f1(-cx)},${f1(-cy)})` });
    try {
      const so = { cells: x.cells, segs: x.segs, owner: x.owner, rules, xy: (c) => [X(c), Y(c)], S, forward: x.owner === ME ? [-1, 0] : [1, 0], detail: 1, moved: 0, flagship: x.flagship, seen: true };
      art.appendChild(x.owner === ME ? drawFrigate(so) : drawShip(so));
    } catch (e) {
      for (const c of x.cells) art.appendChild(el('path', { d: cellPath(c, 0.8), fill: T.mid, stroke: T.neon, 'stroke-width': 0.8 }));
    }
    wrap.appendChild(art);
    if (x.mine) {
      const short = x.name.startsWith('Skiff ') ? x.name.slice(6) : x.flagship ? '★' : x.name[0];
      wrap.appendChild(label(cx + S * 0.6, cy - S * 0.6, short, T.neon, pr, 6.5));
    }
    root.appendChild(wrap);
  }

  // missiles and drones
  for (const o of v.objs) {
    const T = TEAM[o.mine ? 0 : 1];
    if (o.mine) { const fc = E.forecast(game, o.id); if (fc && fc.path.length) root.appendChild(el('path', { d: 'M' + [o.pos].concat(fc.path).map((c) => f1(X(c)) + ',' + f1(Y(c))).join('L'), stroke: T.neon, 'stroke-width': 0.7, 'stroke-dasharray': '1.5 2', fill: 'none', 'pointer-events': 'none' })); }
    if (o.last && phase === 'watch') root.appendChild(el('line', { x1: f1(X(o.last)), y1: f1(Y(o.last)), x2: f1(X(o.pos)), y2: f1(Y(o.pos)), stroke: T.neon, 'stroke-width': 1, 'stroke-opacity': 0.6, 'pointer-events': 'none' }));
    root.appendChild(el('path', { d: `M${f1(X(o.pos))},${f1(Y(o.pos) - 4)}L${f1(X(o.pos) + 3)},${f1(Y(o.pos))}L${f1(X(o.pos))},${f1(Y(o.pos) + 4)}L${f1(X(o.pos) - 3)},${f1(Y(o.pos))}Z`, fill: T.neon, stroke: '#000', 'stroke-width': 0.5, 'pointer-events': 'none' }));
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
    btn('Move' + (st2.moveLeft ? ' (' + st2.moveLeft + ')' : ''), mode === 'move', can && st2.moveLeft > 0, () => { mode = 'move'; render(); });
    btn('Laser' + (st2.beamsReady ? ' (' + shots.length + ')' : ''), mode === 'laser', can && st2.beamsReady > 0, () => setMode('laser'));
    btn('Missile' + (st2.launchers ? ' ×' + ammo : ''), mode === 'missile', can && !!lo, () => setMode('missile'));
    btn('Scan', mode === 'scan', can, () => setMode('scan'));
    if (mode === 'scan') btn('Scan now', false, can, () => play({ type: 'scan', ship: sel }), 'go');
    const hint = { move: 'tap any glowing hex to move (up to ' + st2.moveLeft + ' hex' + (st2.moveLeft === 1 ? '' : 'es') + ')', laser: shots.length ? 'tap a red hex to fire (number = hits)' : 'no target in sight and in range', missile: lo && lo.locks.length ? 'tap a lit enemy to lock on, or any empty hex to fire blind' : 'no enemy in sight to lock on: tap any hex to fire blind', scan: 'shows the scan rings; press Scan now' }[mode];
    st.innerHTML = '';
    const b = document.createElement('b'); b.textContent = ship.name; st.append(b, ' · hull ' + (ship.hull ?? 100) + '% · ' + hint);
    if (full && st2.moveLeft === 0 && mode === 'move') st.append(' (this ship cannot move now)');
  } else {
    st.textContent = phase === 'act' ? 'Your move: tap one of your ships (teal). Do nothing and a random ship moves forward.'
      : phase === 'watch' ? 'Watching the enemy: ' + (watch ? watch.text : '') + '.'
      : phase === 'cancel' ? 'Time up! Auto-firing ' + (autoAct ? autoAct.weapon + ' at ' + nameOf(autoAct.action.target) : '') + ' — press Cancel to move forward instead.'
      : phase === 'ai' ? 'The enemy is choosing…' : phase === 'over' ? 'Game over.' : '';
  }
  $('log').innerHTML = '';
  for (const l of log.slice(0, 3)) { const d = document.createElement('div'); d.className = l.cls; d.textContent = l.text; $('log').appendChild(d); }
}

// ---------- start ----------
$('startNormal').onclick = () => { level = 'normal'; newGame(); };
$('startEasy').onclick = () => { level = 'easy'; newGame(); };
$('cancel').onclick = cancelAuto;
$('pause').onclick = () => { togglePause(); render(); };
$('logbtn').onclick = () => toggleLogPane();
$('logclose').onclick = () => toggleLogPane(false);
$('clock').addEventListener('click', () => { if (phase === 'watch') skipWatch(); });
$('btnAgain').onclick = () => newGame();
$('btnReport').onclick = () => { if (ended) { game = ended; finish(); } };
$('btnLog').onclick = () => { if (ended) { game = ended; finish(); requestAnimationFrame(() => { const t = document.getElementById('rgTrack'); if (t) t.scrollTo({ left: t.clientWidth * 3 }); }); } };
$('btnReplay').onclick = () => startReplay();
$('replayRange').oninput = () => jumpReplay($('replayRange').value);
$('replayPlay').onclick = () => toggleReplayPlay();
addEventListener('resize', () => render());
addEventListener('keydown', (e) => { if (e.key === 'Escape' && phase === 'cancel') cancelAuto(); });
load().then(() => {
  $('status').textContent = 'Press Start.';
  requestAnimationFrame(frame);
  if (qs.get('autostart') === '1') { level = qs.get('level') === 'easy' ? 'easy' : 'normal'; newGame(); }
}).catch((e) => { $('status').textContent = 'Could not load the rules: ' + e.message; console.error(e); });
// for automated checks only
window.__rapid = {
  get game() { return game; },
  set game(st) { game = st; $('intro').hidden = true; startAct(); },
  select(id, m = 'move') { sel = id; mode = m; render(); },
  get phase() { return phase; },
  get sel() { return sel; },
  get mode() { return mode; },
  get anims() { return moveAnims.size; },
  timeUp, cancelAuto, finish, seeBoard, startReplay, jumpReplay, play, skipWatch,
  get log() { return reportLog; },
  get ended() { return ended; },
  get liveLog() { return log; },
  get wrecks() { return wrecks; },
};
