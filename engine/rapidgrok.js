// RAPID GROK: rapid mode as a thin layer on top of the classic engine.
//
// Plain English: the classic engine already plays "player A's turn, player B's turn, then missiles
// fly". Rapid mode keeps that, but every turn is exactly ONE action (a move up to that ship's speed,
// one laser shot, one launch order, or one scan) and then the turn ends by itself. So:
//   one classic "turn"  = one rapid action
//   one classic "round" = one rapid BEAT (my action + the opponent's action)
// and the classic end-of-round work (missiles fly 6 hexes, shields recharge, point defence reloads,
// flares and scans wear off) happens at the end of every beat for free.
//
// What this file changes, without touching classic games:
// - command points: 1 per turn, nothing banked (so one action, then the turn ends)
// - movement: 1-hex and 2-hex ships move up to 3 hexes; 3-hex, 4-hex and 7-hex ships move up to 2,
//   to any reachable hex within that circle (clear step-by-step path, keeping orientation)
// - no attack-run bonus, no "scan only after moving", strict alternation (fixed order)
// - salvo stays: one launch order fires every ready launcher on that ship
// - no passing: rgAct always ends the turn after an action; when the clock runs out the screen
//   uses autoFire / forcedMove from here; the computer uses aiTurn, which also never passes.
// Nothing here sets `rules.rapid` or `state.rapid`, so other rapid code in the engine stays off.

import { buildRules, start, apply, view, reach, beamTargets, launchOptions, aimLaunch } from './index.js';
import { Illegal, shipById, nearestCell, footprint, gap, deadInWater } from './state.js';
import { shipWeight } from './actions.js';
import { computerMove } from './ai.js';
import { fnv, seededRandom } from './codec.js';
import { dist, step } from './hex.js';

export const RG_DEFAULTS = {
  act_seconds: 15,
  watch_seconds: 3,
  cancel_seconds: 1.5,
  beat_limit: 150,
  move_speed: { 1: 3, 2: 3, 3: 2, 4: 2, 7: 2 },
};

// How many hexes a ship may move in one move action (0 if its engines are all gone).
export function moveSpeed(state, ship) {
  if (!ship || ship.dead || deadInWater(state, ship)) return 0;
  const map = (state.rules.rapidGrok && state.rules.rapidGrok.move_speed) || RG_DEFAULTS.move_speed;
  const n = ship.segs.length;
  const v = map[n] ?? map[String(n)];
  return typeof v === 'number' ? v : (n <= 2 ? 3 : 2);
}

// world: parsed rules/world_v0.4.yaml. setup: parsed rules/rapid-grok/rapid_grok.yaml.
export function rgRules(world, setup) {
  const w = structuredClone(world);
  w.turns = { ...(w.turns || {}), first: 'random', first_player: 'fixed' };
  const { rules, problems } = buildRules(w, { map: setup.map }, setup.fleets);
  const cfg = {
    ...RG_DEFAULTS,
    ...(setup.rapid_grok || {}),
    move_speed: { ...RG_DEFAULTS.move_speed, ...((setup.rapid_grok && setup.rapid_grok.move_speed) || {}) },
  };
  rules.cp = { perTurn: 1, bankCap: 0, secondBonus: 0 };      // one action a turn, nothing saved up
  for (const k of Object.keys(rules.cost)) rules.cost[k] = 1;
  rules.firstPlayer = 'fixed';                                 // strict A, B, A, B ... never two in a row
  rules.turnLimit = cfg.beat_limit;                            // a "round" is a beat here
  rules.det.attackRun = 0;                                     // no attack-run bonus in rapid
  rules.move = { ...rules.move, minMove: 0, capBonus: Math.max(4, rules.move.capBonus) };
  rules.rapidGrok = cfg;
  return { rules, problems };
}

// Every ship of the side about to act gets thrust for its full rapid move speed.
function prep(s) {
  if (s.phase !== 'play') return s;
  const p = s.order[s.turn];
  for (const x of s.ships) if (x.owner === p && !x.dead) x.thrust = moveSpeed(s, x) * shipWeight(s, x);
  if (s.history.length > 12) s.history = s.history.slice(-12);   // classic history is trimmed; the rapid log lives in s.rg.acts
  return s;
}

export function rgStart(rules, seed = 1) {
  const s = start(rules, seed);
  s.rg = { last: null, acts: [] };
  return prep(s);
}

export const toAct = (s) => (s.phase === 'play' ? s.order[s.turn] : null);
export const beatOf = (s) => s.round;

// classic only lets a ship scan on a turn it has moved; rapid drops that rule. We make the
// engine think the ship moved 1 hex (too little to leave an engine wake), then put it back.
function applyOne(s, a) {
  if (a.type !== 'scan') return apply(s, a);
  const ship = shipById(s, a.ship);
  if (!ship) return apply(s, a);
  const was = ship.turnStart ? ship.turnStart.slice() : null;
  const near = [ship.pos[0] + 1, ship.pos[1]];
  const tmp = { ...s, ships: s.ships.map((x) => (x === ship ? { ...x, turnStart: near } : x)) };
  const out = apply(tmp, a);
  const after = out.ships.find((x) => x.id === ship.id);
  if (after) after.turnStart = was;
  return out;
}

function attachTrail(ev, path) {
  const steps = path.slice(0, ev.steps);
  const trail = [ev.from.slice()];
  let cur = ev.from;
  for (const d of steps) { cur = step(cur, d); trail.push(cur.slice()); }
  ev.path = steps;
  ev.trail = trail;
}

// One rapid action for the side whose turn it is. It always ends that side's turn.
// Returns the new state; its .events holds everything that happened (the action, any salvo,
// and the end-of-beat flight when this action finished a beat). Throws Illegal when refused.
export function rgAct(state, a, meta = {}) {
  if (state.phase !== 'play') throw new Illegal('the game is over');
  if (!a || !['move', 'fire', 'launch', 'scan'].includes(a.type)) throw new Illegal('in rapid mode you can move, fire, launch or scan');
  if (a.type === 'move') {
    const sh = shipById(state, a.ship);
    const max = sh ? moveSpeed(state, sh) : 0;
    if (!Array.isArray(a.path) || !a.path.length || a.path.length > max)
      throw new Illegal('in rapid mode this ship can move at most ' + max + ' hex' + (max === 1 ? '' : 'es') + ' per move');
  }
  const seat = toAct(state), events = [];
  let s = applyOne(state, a);
  if (a.type === 'move') for (const ev of s.events) if (ev.t === 'move' && ev.ship === a.ship) attachTrail(ev, a.path);
  events.push(...s.events);
  if (a.type === 'launch' && s.phase === 'play') {   // salvo: the ship's other ready launchers fire on the same order
    for (let i = 0; i < 6 && s.phase === 'play'; i++) {
      const sh = shipById(s, a.ship), lo = sh && sh.used.salvo ? launchOptions(s, a.ship) : null;
      if (!lo) break;
      const kind = lo.kinds.includes(a.kind) ? a.kind : lo.kinds[0];
      const t = a.target && shipById(s, a.target);
      const aim = t ? nearestCell(t, sh.pos) : a.aim || null;
      const more = aim ? aimLaunch(s, a.ship, kind, aim, a.target || null) : null;
      if (!more) break;
      try { s = apply(s, more); events.push(...s.events); } catch (e) { if (e instanceof Illegal) break; throw e; }
    }
  }
  if (s.phase === 'play') { s = apply(s, { type: 'end' }); events.push(...s.events); }
  s.events = events;
  const rec = { beat: state.round, seat, action: compactAction(a), why: meta.why || 'play', events: events.map(compactEvent) };
  const acts = ((state.rg && state.rg.acts) || []).concat([rec]);
  s.rg = { last: { seat, action: rec.action, beat: rec.beat, why: rec.why }, acts };
  return prep(s);
}

export function rgAttempt(state, a, meta = {}) {
  try { return { ok: true, state: rgAct(state, a, meta) }; }
  catch (e) { if (e instanceof Illegal) return { ok: false, why: e.message, state }; throw e; }
}

// Only when a side truly cannot do anything at all (every ship stuck or unable to act).
export function rgStuckPass(state, meta = {}) {
  const seat = toAct(state);
  let s = apply(state, { type: 'end' });
  const rec = { beat: state.round, seat, action: { type: 'stuck' }, why: meta.why || 'stuck', events: (s.events || []).map(compactEvent) };
  const acts = ((state.rg && state.rg.acts) || []).concat([rec]);
  s.rg = { last: { seat, action: rec.action, beat: rec.beat, why: rec.why }, acts };
  return prep(s);
}

// ---------- choosing for a player: the clock ran out ----------
const rnd = (s, tag) => seededRandom(fnv((s.fzSalt | 0) + '|' + s.round + '|' + s.turn + '|' + tag));
// Where "forward" is: the middle of the other side's starting fleet.
function enemyHome(s, seat) {
  const dep = (s.rules.fleets[1 - seat] || {}).deployment || [];
  if (!dep.length) return [0, 0];
  return [Math.round(dep.reduce((n, d) => n + d.at[0], 0) / dep.length), Math.round(dep.reduce((n, d) => n + d.at[1], 0) / dep.length)];
}
// guess at the flagship from the shape (both fleet lists are open): the 7-hex ship
const looksFlag = (t) => t && t.segs && t.segs.length >= 7;

// The best laser shot for this ship (what the computer would pick): most hits, the flagship first.
export function bestShot(state, shipId) {
  const v = view(state, toAct(state));
  let best = null, bestScore = -1;
  for (const o of beamTargets(state, shipId)) {
    const t = v.ships.find((x) => x.id === o.target);
    let score = o.hits * 10;
    if (t) score += (looksFlag(t) ? 25 : 0) + t.segs.length;
    else score += 4;   // a missile in flight
    if (score > bestScore) { best = o; bestScore = score; }
  }
  return best ? { type: 'fire', ship: shipId, seg: best.seg, part: best.part, at: best.at, target: best.target, hits: best.hits } : null;
}

// The best missile launch for this ship: lock on to the flagship if seen, otherwise the closest enemy it sees.
export function bestLaunch(state, shipId) {
  const lo = launchOptions(state, shipId), ship = shipById(state, shipId);
  if (!lo || !lo.locks.length || !ship) return null;
  const ts = lo.locks.map((id) => shipById(state, id)).filter(Boolean);
  ts.sort((a, b) => (looksFlag(b) - looksFlag(a)) || gap(ship, a) - gap(ship, b));
  const t = ts[0], kind = lo.kinds[0];
  const a = aimLaunch(state, shipId, kind, nearestCell(t, ship.pos), t.id);
  return a ? { ...a, aim: nearestCell(t, ship.pos) } : null;
}

// What the clock does with a selected laser or missile: the best shot, or null (then the ship moves).
export function autoFire(state, shipId, weapon) {
  return weapon === 'laser' ? bestShot(state, shipId) : weapon === 'missile' ? bestLaunch(state, shipId) : null;
}

// One forced move up to the ship's full range. With a ship given, that ship moves toward the enemy
// as far as it can; with none (or if it cannot move), a random Skiff or the front-most ship moves.
export function forcedMove(state, shipId = null) {
  const seat = toAct(state);
  if (seat === null) return null;
  const home = enemyHome(state, seat), r = rnd(state, 'force:' + (shipId || '-'));
  const stepFor = (id) => {
    const opts = reach(state, id);
    if (!opts.length) return null;
    const ship = shipById(state, id), d0 = dist(ship.pos, home);
    const minD = Math.min(...opts.map((o) => dist(o.at, home)));
    let pool;
    if (minD < d0) {
      const best = opts.filter((o) => dist(o.at, home) === minD);
      const minLen = Math.min(...best.map((o) => o.path.length));
      pool = best.filter((o) => o.path.length === minLen);
    } else {
      const same = opts.filter((o) => dist(o.at, home) === d0);
      pool = same.length ? same : opts;
    }
    const o = pool[Math.floor(r() * pool.length)];
    return { type: 'move', ship: id, path: o.path };
  };
  if (shipId) { const a = stepFor(shipId); if (a) return a; }
  const mine = state.ships.filter((x) => x.owner === seat && !x.dead && reach(state, x.id).length);
  if (!mine.length) return null;
  const singles = mine.filter((x) => x.segs.length === 1);
  const big = mine.filter((x) => x.segs.length > 1).sort((a, b) => Math.min(...footprint(a).map((c) => dist(c, home))) - Math.min(...footprint(b).map((c) => dist(c, home))));
  const pool = singles.concat(big.length ? [big[0]] : []);
  const pickFrom = pool.length ? pool : mine;
  const ship = pickFrom[Math.floor(r() * pickFrom.length)];
  return stepFor(ship.id);
}

// The computer's march when it has nothing to shoot at: the classic computer was written for
// 3 points a turn and often holds still, so here the fleet walks forward as a screen using full
// move range. Skiffs lead, the bigger ships keep about 3 hexes behind the front Skiff and the
// Flower about 5 behind. The ship furthest behind its place moves.
export function advanceMove(state, seat) {
  const home = enemyHome(state, seat), r = rnd(state, 'march');
  const prog = (x) => Math.min(...footprint(x).map((c) => dist(c, home)));
  const mine = state.ships.filter((x) => x.owner === seat && !x.dead);
  const skiffs = mine.filter((x) => x.segs.length === 1);
  const front = skiffs.length ? Math.min(...skiffs.map(prog)) : Math.min(...mine.map(prog));
  const slot = (x) => (x.segs.length === 1 ? 0 : x.flagship ? 5 : 3);
  const movesFor = (x) => {
    const all = reach(state, x.id), d0 = dist(x.pos, home);
    if (!all.length) return [];
    const minD = Math.min(...all.map((o) => dist(o.at, home)));
    if (minD >= d0) return [];
    const best = all.filter((o) => dist(o.at, home) === minD);
    const minLen = Math.min(...best.map((o) => o.path.length));
    return best.filter((o) => o.path.length === minLen);
  };
  const can = mine.map((x) => ({ x, lag: prog(x) - (front + slot(x)) + r() * 0.5, st: movesFor(x) })).filter((o) => o.st.length);
  if (!can.length) return null;
  can.sort((a, b) => b.lag - a.lag);
  let pick = can[0];
  if (pick.lag <= 0.5) { const sk = can.filter((o) => o.x.segs.length === 1); if (sk.length) pick = sk[Math.floor(r() * sk.length)]; }
  const o = pick.st[Math.floor(r() * pick.st.length)];
  return { type: 'move', ship: pick.x.id, path: o.path };
}

// The computer's one action: the classic computer player picks its best single action using each
// ship's full rapid move range. With no enemy in sight it marches instead (advanceMove). Never passes.
export function aiTurn(state, seat, level = 'normal') {
  let a = null;
  try { a = computerMove(state, seat, level); } catch (e) { a = null; }
  if (a && a.type === 'move' && Array.isArray(a.path)) {
    const sh = shipById(state, a.ship), max = sh ? moveSpeed(state, sh) : 1;
    if (a.path.length > max) a = { ...a, path: a.path.slice(0, max) };
  }
  const v = view(state, seat), foes = v.ships.some((x) => !x.mine && x.seen);
  if ((!a || a.type === 'end' || (a.type === 'move' && !foes))) { const m = advanceMove(state, seat); if (m) a = m; }
  if (a && ['move', 'fire', 'launch', 'scan'].includes(a.type)) {
    if (a.type === 'launch' && a.target) { const t = shipById(state, a.target), sh = shipById(state, a.ship); if (t && sh) a = { ...a, aim: nearestCell(t, sh.pos) }; }
    const r = rgAttempt(state, a, { why: 'ai' });
    if (r.ok) return { action: a, state: r.state };
  }
  const f = forcedMove(state, null);
  if (f) { const r = rgAttempt(state, f, { why: 'ai' }); if (r.ok) return { action: f, state: r.state, forced: true }; }
  return { action: { type: 'stuck' }, state: rgStuckPass(state, { why: 'stuck' }), forced: true };
}

// What `viewer` saw happen in the last action (the 5-second watch): only events they were shown.
export function seenEvents(state, viewer) {
  return (state.events || []).filter((e) => e.seenBy && e.seenBy.includes(viewer));
}

// ---------- battle log, recap and replay (Rapid Grok's own, not the classic/Opus log) ----------
// Classic battleLog() cannot replay a Rapid Grok game: the classic engine will not give ships their
// rapid move speeds, and this mode trims classic history so it would only cover the last few actions
// anyway. Everything below is built from state.rg.acts, which records every action of the game.

const CLASS_NAME = { 1: 'Skiff', 2: 'Dart', 3: 'Arrow', 4: 'Lance', 7: 'Flower' };
const KIND_NAME = { missile: 'Nuke', missile_advanced: 'Advanced missile', missile_basic: 'Basic missile', seeker_drone: 'drone', mine: 'mine' };
const kindName = (k) => KIND_NAME[k] || String(k || 'munition').replace(/_/g, ' ');
const atHex = (c) => (Array.isArray(c) ? '[' + c[0] + ', ' + c[1] + ']' : '?');
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const ownerOf = (id) => { const m = /^(\d)/.exec(id || ''); return m ? Number(m[1]) - 1 : null; };

function compactAction(a) {
  const o = { type: a.type };
  for (const k of ['ship', 'path', 'seg', 'part', 'at', 'kind', 'start', 'target', 'route', 'aim', 'hits']) {
    if (a[k] != null) o[k] = Array.isArray(a[k]) ? a[k].slice() : a[k];
  }
  return o;
}
function compactEvent(e) {
  const o = { t: e.t };
  for (const k of ['ship', 'from', 'to', 'path', 'trail', 'steps', 'hits', 'at', 'end', 'kind', 'owner', 'flagship', 'name', 'why', 'found', 'pinged', 'cause', 'hull', 'wrecked', 'lost', 'obj', 'target', 'id', 'into', 'seg']) {
    if (e[k] != null) o[k] = Array.isArray(e[k]) ? e[k].slice() : e[k];
  }
  if (Array.isArray(e.seenBy)) o.seenBy = e.seenBy.slice();
  return o;
}

function shipLabel(state, id, audience) {
  const x = state.ships.find((s) => s.id === id);
  if (!x) return id || 'a ship';
  if (audience == null || x.owner === audience) return (x.flagship ? '★ ' : '') + x.name;
  return 'enemy ' + (CLASS_NAME[x.segs.length] || 'ship') + (x.flagship ? ' (flagship)' : '');
}

export function sideNamesRg(seat) {
  return seat === 'cpu' || seat === 0 ? ['You', 'The computer'] : ['Player 1', 'Player 2'];
}

function eventSay(e, label, side) {
  switch (e.t) {
    case 'move': return label(e.ship) + ' moved' + (e.steps > 1 ? ' ' + e.steps + ' hexes' : '') + (e.from && e.to ? ' from ' + atHex(e.from) + ' to ' + atHex(e.to) : e.to ? ' to ' + atHex(e.to) : '');
    case 'bump': return label(e.ship) + ' bumped into a hidden ship and stopped';
    case 'fire': return label(e.ship) + ' fired a laser' + (e.at ? ' at ' + atHex(e.at) : '') + (e.hits ? ' (' + plural(e.hits, 'hit') + ')' : ' (no damage)');
    case 'enemy_fire': return label(e.ship) + ' fired a laser' + (e.hits ? ' and hit' : '');
    case 'damage': case 'hit': return label(e.ship) + ' took ' + plural(e.hits || 0, 'hit') + (e.wrecked ? ', a segment wrecked' : '') + (e.cause ? ' from a ' + String(e.cause).replace(/_/g, ' ') : '') + (e.hull != null ? '; hull now ' + e.hull + '%' : '');
    case 'destroyed': return (e.flagship ? 'Flagship ' : '') + (e.name || label(e.ship)) + (e.owner != null ? ' (' + side(e.owner) + ')' : '') + ' was destroyed' + (e.cause ? ' by a ' + String(e.cause).replace(/_/g, ' ') : '');
    case 'sighted': return (e.kind === 'ship' ? label(e.id) : 'an enemy ' + kindName(e.kind)) + ' was spotted' + (e.at ? ' at ' + atHex(e.at) : '');
    case 'lost': return 'lost sight of ' + label(e.id);
    case 'launch': return label(e.ship) + ' launched a ' + kindName(e.kind) + (e.target ? ' at ' + label(e.target) : '');
    case 'blast': return 'a ' + kindName(e.kind) + ' exploded' + (e.at ? ' at ' + atHex(e.at) : '');
    case 'stopped': return 'Point defence on ' + label(e.ship) + ' shot down a ' + kindName(e.kind);
    case 'obj_lost': return 'a ' + kindName(e.kind) + ' was lost' + (e.why ? ': it ' + e.why : '');
    case 'obj_destroyed': return 'a ' + kindName(e.kind) + ' was shot down' + (e.at ? ' at ' + atHex(e.at) : '');
    case 'scan': return label(e.ship) + ' scanned: ' + (e.found ? plural(e.found, 'thing') + ' revealed' : 'nothing revealed') + (e.pinged ? ', ' + plural(e.pinged, 'faint contact') : '');
    case 'game_over': return 'Game over: ' + (e.winner === 'draw' ? 'a draw' : side(e.winner) + ' won') + (e.by === 'turn_limit' ? ' (beat limit)' : '');
    default: return null;
  }
}

function actionSay(rec, label, side) {
  const a = rec.action || {}, who = side(rec.seat);
  const tag = rec.why === 'timeout-autofire' ? 'Time ran out, so this was auto-fired. '
    : rec.why === 'timeout-move' ? 'Time ran out, so this ship was moved. '
    : rec.why === 'cancel-move' ? 'Auto-fire was cancelled, so this ship moved instead. '
    : rec.why === 'stuck' ? 'Nothing this side could do. '
    : '';
  let core;
  if (a.type === 'move') core = who + ' moved ' + label(a.ship) + (a.path && a.path.length ? ' ' + a.path.length + ' hex' + (a.path.length === 1 ? '' : 'es') : '');
  else if (a.type === 'fire') core = who + ': ' + label(a.ship) + ' fired a laser' + (a.target ? ' at ' + label(a.target) : a.at ? ' at ' + atHex(a.at) : '');
  else if (a.type === 'launch') core = who + ': ' + label(a.ship) + ' launched a ' + kindName(a.kind) + (a.target ? ' at ' + label(a.target) : '');
  else if (a.type === 'scan') core = who + ': ' + label(a.ship) + ' scanned';
  else if (a.type === 'stuck') core = who + ' could not act';
  else core = who + ' acted';
  return tag + core;
}

function namesFor(state) {
  const map = {};
  for (const x of state.ships) map[x.id] = { name: x.name, owner: x.owner, size: x.segs.length, flagship: !!x.flagship };
  return map;
}

// A finished (or mid-game) Rapid Grok log: every action, in order, in plain English, plus numbers
// for the battle report. Replayable from the seed and the recorded actions.
export function rgBattleLog(state, opts = {}) {
  const seat = opts.seat ?? 'cpu';
  const sides = sideNamesRg(seat);
  const side = (p) => (p === 0 || p === 1 ? sides[p] : 'Someone');
  const names = namesFor(state);
  const label = (id) => {
    const x = names[id];
    if (!x) return id || 'a ship';
    return (x.flagship ? '★ ' : '') + x.name;
  };
  const acts = ((state.rg && state.rg.acts) || []).map((rec) => ({
    beat: rec.beat,
    seat: rec.seat,
    side: side(rec.seat),
    why: rec.why || 'play',
    action: rec.action,
    say: actionSay(rec, label, side),
    events: (rec.events || []).map((e) => ({ ...e, say: eventSay(e, label, side) })).filter((e) => e.say),
  }));
  const beatLimit = state.rules.turnLimit;
  const winner = state.winner;
  // After the last allowed beat the classic loop bumps round one past the cap, so a draw at the
  // 150-beat limit would otherwise read "151 beats".
  const beats = (state.phase === 'over' && winner === 'draw' && state.round > beatLimit) ? beatLimit : state.round;
  const result = {
    phase: state.phase,
    beats,
    beatLimit,
    winner,
    text: state.phase !== 'over' ? 'The game is still going (beat ' + beats + ').'
      : winner === 'draw' ? 'Draw: nobody won within ' + beatLimit + ' beats.'
      : side(winner) + ' won in ' + beats + ' beat' + (beats === 1 ? '' : 's') + '.',
  };
  let replayable = false, note = null, replayed = null;
  if (state.seed != null && state.rules) {
    try {
      replayed = rgReplayFrom(state.rules, state.seed, (state.rg && state.rg.acts) || []);
      replayable = replayed.phase === state.phase && replayed.winner === state.winner
        && replayed.round === state.round
        && replayed.ships.every((x) => {
          const y = state.ships.find((z) => z.id === x.id);
          return y && y.dead === x.dead && (y.dead || (y.pos[0] === x.pos[0] && y.pos[1] === x.pos[1]));
        });
      if (!replayable) note = 'The replay finished in a different position from the saved game. Results may be off; please report this.';
    } catch (e) {
      note = 'The replay did not match this game (' + e.message + '). Results may be off; please report this.';
    }
  }
  const stats = rgStatsFrom(state, acts);
  const summary = rgRecap({ result, stats, acts, sides, note });
  return {
    format: 'shatkon-rapid-grok-log', v: 1, game: 'SHATKON Rapid Grok',
    created: opts.now || new Date().toISOString(),
    seed: state.seed, seat, sides, result, note, replayable, summary, stats, acts,
    replay: { seed: state.seed, acts: ((state.rg && state.rg.acts) || []).map((r) => ({ action: r.action, why: r.why, beat: r.beat, seat: r.seat })) },
  };
}

export function rgReplayFrom(rules, seed, acts) {
  let s = rgStart(rules, seed);
  for (const rec of acts) {
    if (s.phase !== 'play') break;
    if (rec.action && rec.action.type === 'stuck') s = rgStuckPass(s, { why: rec.why || 'stuck' });
    else {
      const r = rgAttempt(s, rec.action, { why: rec.why || 'play' });
      if (!r.ok) throw new Error('could not replay ' + (rec.action && rec.action.type) + ': ' + r.why);
      s = r.state;
    }
  }
  return s;
}

export function rgStats(state) {
  return rgStatsFrom(state, ((state.rg && state.rg.acts) || []).map((rec) => ({ ...rec, events: rec.events || [] })));
}

function rgStatsFrom(state, acts) {
  const evs = acts.flatMap((r) => (r.events || []).map((e) => ({ e, beat: r.beat, seat: r.seat, why: r.why })));
  const sides = [0, 1].map((k) => {
    const ships = state.ships.filter((z) => z.owner === k);
    return {
      ships: ships.length,
      lost: ships.filter((z) => z.dead).length,
      alive: ships.filter((z) => !z.dead).length,
      hull: 0, dealt: 0, shots: 0, hits: 0,
      bands: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
      missiles: { fired: 0, hit: 0, stopped: 0, wasted: 0, flying: 0 },
      timeouts: 0, autofires: 0, cancels: 0,
    };
  });
  for (const k of [0, 1]) {
    const ships = state.ships.filter((z) => z.owner === k);
    const living = ships.filter((z) => !z.dead);
    sides[k].hull = living.length ? Math.round(living.reduce((n, z) => n + hullPctFrom(state, z), 0) / living.length) : 0;
  }
  for (const rec of acts) {
    if (rec.why === 'timeout-move' || rec.why === 'timeout-autofire') sides[rec.seat].timeouts++;
    if (rec.why === 'timeout-autofire') sides[rec.seat].autofires++;
    if (rec.why === 'cancel-move') sides[rec.seat].cancels++;
  }
  const launched = new Map();
  for (const { e, beat, seat } of evs) {
    if (e.t === 'damage' || e.t === 'hit') {
      const vic = ownerOf(e.ship);
      if (vic != null && sides[1 - vic]) sides[1 - vic].dealt += e.hits || 0;
    }
    if (e.t === 'fire') {
      const p = ownerOf(e.ship); if (p == null || !sides[p]) continue;
      const d = e.from && e.at ? dist(e.from, e.at) : 1, band = d <= 4 ? 0 : d <= 8 ? 1 : 2;
      sides[p].shots++; sides[p].bands[band][0]++; sides[p].bands[band][1] += e.hits || 0;
      if (e.hits > 0) sides[p].hits++;
    }
    if (e.t === 'launch') launched.set(e.obj, { obj: e.obj, kind: e.kind, player: ownerOf(e.ship) ?? seat, hurt: 0, fate: 'flying' });
    if (e.t === 'blast' && e.obj && launched.has(e.obj)) {
      // damage events nearby are counted below
    }
    if ((e.t === 'damage' || e.t === 'hit') && launched.size) {
      // last blast's missile gets the hurt; handled after we see blast+damage order
    }
    if (e.t === 'stopped' && e.kind) {
      // point defence: find a launched missile of the other side still flying, most recent
      const list = [...launched.values()].filter((m) => m.fate === 'flying' && kindName(m.kind) && m.player !== ownerOf(e.ship));
      const m = list[list.length - 1];
      if (m) m.fate = 'stopped';
    }
    if (e.t === 'obj_lost' && launched.has(e.obj)) launched.get(e.obj).fate = 'wasted';
    if (e.t === 'obj_destroyed' && (e.obj ? launched.has(e.obj) : true)) {
      if (e.obj && launched.has(e.obj)) launched.get(e.obj).fate = 'wasted';
    }
  }
  // credit missile hits: a blast event followed by damage to the other side
  for (let i = 0; i < evs.length; i++) {
    const { e } = evs[i];
    if (e.t !== 'blast' || !e.obj || !launched.has(e.obj)) continue;
    const m = launched.get(e.obj);
    let hurt = 0;
    for (let j = i + 1; j < evs.length && j <= i + 8; j++) {
      const n = evs[j].e;
      if (n.t === 'blast' || n.t === 'launch' || n.t === 'game_over') break;
      if ((n.t === 'damage' || n.t === 'hit') && ownerOf(n.ship) !== m.player) hurt += n.hits || 0;
      if (n.t === 'destroyed' && n.owner !== m.player) { /* still a hit */ }
    }
    m.hurt = hurt;
    if (m.fate === 'flying' || m.fate === 'wasted') m.fate = hurt ? 'hit' : (m.fate === 'wasted' ? 'wasted' : 'flying');
    if (hurt && m.fate === 'flying') m.fate = 'hit';
    if (hurt) m.fate = 'hit';
  }
  // remaining live missiles on the board
  const live = new Set((state.objs || []).map((o) => o.id));
  for (const m of launched.values()) {
    if (m.fate === 'flying' && !live.has(m.obj)) m.fate = 'wasted';
    const sd = sides[m.player]; if (!sd) continue;
    sd.missiles.fired++;
    if (m.fate === 'hit') sd.missiles.hit++;
    else if (m.fate === 'stopped') sd.missiles.stopped++;
    else if (m.fate === 'flying') sd.missiles.flying++;
    else sd.missiles.wasted++;
  }

  const firstSight = {};
  const bigHits = [];
  const lost = [];
  for (const { e, beat, seat } of evs) {
    if (e.t === 'sighted' && e.kind === 'ship') {
      const by = (e.seenBy && e.seenBy[0] != null) ? e.seenBy[0] : (seat === 0 ? 0 : 1);
      // sighted events are emitted per viewer in seenBy
      const viewers = e.seenBy || [seat];
      for (const v of viewers) if (firstSight[v] == null) firstSight[v] = { beat, id: e.id, at: e.at };
    }
    if ((e.t === 'damage' || e.t === 'hit') && (e.hits || 0) >= 2) bigHits.push({ beat, ship: e.ship, owner: ownerOf(e.ship), hits: e.hits, cause: e.cause, hull: e.hull });
    if (e.t === 'destroyed') lost.push({ beat, ship: e.ship, name: e.name, owner: e.owner, flagship: !!e.flagship, cause: e.cause });
  }
  bigHits.sort((a, b) => b.hits - a.hits || a.beat - b.beat);
  const items = [];
  for (const [by, f] of Object.entries(firstSight)) {
    const viewer = Number(by), seen = state.ships.find((z) => z.id === f.id);
    const seenName = seen ? ((seen.flagship ? '★ ' : '') + seen.name) : (f.id || 'a ship');
    items.push({ beat: f.beat, side: viewer, kind: 'sight', at: f.at, text: (viewer === 0 ? 'You' : 'The computer') + ' first spotted ' + seenName });
  }
  for (const b of bigHits.slice(0, 5)) {
    const x = state.ships.find((z) => z.id === b.ship);
    const nm = x ? ((x.flagship ? '★ ' : '') + x.name) : (b.ship || 'a ship');
    items.push({ beat: b.beat, side: 1 - (b.owner ?? 0), kind: 'hit', ship: b.ship, text: nm + ' takes ' + b.hits + ' hits' + (b.cause ? ' (' + String(b.cause).replace(/_/g, ' ') + ')' : '') });
  }
  for (const l of lost) {
    const nm = l.name || l.ship;
    items.push({ beat: l.beat, side: 1 - (l.owner ?? 0), kind: l.flagship ? 'flag' : 'lost', ship: l.ship, text: (l.flagship ? 'Flagship ' : '') + nm + ' destroyed' + (l.cause ? ' by a ' + String(l.cause).replace(/_/g, ' ') : '') });
  }
  items.sort((a, b) => a.beat - b.beat || (a.kind === 'flag') - (b.kind === 'flag'));
  return { sides, items, firstSight, lost, bigHits };
}

function hullPctFrom(state, ship) {
  if (ship.dead) return 0;
  let max = 0, now = 0;
  for (const g of ship.segs) for (const p of g.parts || []) {
    const hp = (state.rules.parts[p.t] && state.rules.parts[p.t].hp) || 1;
    max += hp; now += p.hp || 0;
  }
  return max ? Math.round((100 * now) / max) : 0;
}

export function rgRecap(log) {
  const lines = ['SHATKON Rapid Grok — battle recap', log.result.text];
  if (log.note) lines.push('Note: ' + log.note);
  const st = log.stats, sides = log.sides || ['You', 'The computer'];
  lines.push('', 'HEAD TO HEAD');
  for (const k of [0, 1]) {
    const s = st.sides[k], m = s.missiles;
    lines.push('- ' + sides[k] + ': ' + s.alive + ' of ' + s.ships + ' ships left (hull ' + s.hull + '%), dealt ' + s.dealt + ' hits, ' + s.shots + ' laser shot' + (s.shots === 1 ? '' : 's') + ', ' + m.fired + ' missile' + (m.fired === 1 ? '' : 's') + ' launched (' + m.hit + ' hit, ' + m.stopped + ' shot down, ' + m.wasted + ' wasted' + (m.flying ? ', ' + m.flying + ' still flying' : '') + ').');
  }
  if (st.lost && st.lost.length) {
    lines.push('', 'SHIPS LOST');
    for (const l of st.lost) lines.push('- Beat ' + l.beat + ': ' + (l.flagship ? 'flagship ' : '') + (l.name || l.ship) + ' (' + sides[l.owner] + ') destroyed' + (l.cause ? ' by a ' + String(l.cause).replace(/_/g, ' ') : '') + '.');
  }
  if (st.items && st.items.length) {
    lines.push('', 'KEY MOMENTS');
    for (const it of st.items) lines.push('- Beat ' + it.beat + ': ' + it.text + '.');
  }
  return lines;
}

export function logHasProblem(log) {
  const bad = [];
  const walk = (v, path) => {
    if (v == null) return;
    if (typeof v === 'number' && !Number.isFinite(v)) bad.push(path + '=' + v);
    if (typeof v === 'string' && /undefined|NaN/.test(v)) bad.push(path + '=' + JSON.stringify(v));
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, path + '[' + i + ']'));
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], path + '.' + k);
  };
  walk(log.summary, 'summary');
  walk(log.acts && log.acts.map((a) => a.say), 'acts.say');
  walk(log.acts && log.acts.flatMap((a) => (a.events || []).map((e) => e.say)), 'events.say');
  walk(log.result && log.result.text, 'result');
  return bad;
}


// How many ships a side still has (for the "Your fleet 13/14" count).
export function fleetTally(state, owner) {
  const ships = (state.ships || []).filter((x) => x.owner === owner);
  return { total: ships.length, alive: ships.filter((x) => !x.dead).length };
}

// Did the viewer already know this ship's position, or did it only appear because of this action
// (typically the flash of a hit lighting the shooter up)? Hidden positions stay hidden on the watch.
export function shooterKnown(state, viewer, events, shipId) {
  if (!state || shipId == null) return false;
  const vis = new Set((state.players[viewer] && state.players[viewer].vis) || []);
  if (!vis.has(shipId)) return false;
  return !(events || []).some((e) => e.t === 'sighted' && e.id === shipId);
}

// Is there anything on the board worth a watch pause? Damage or a loss on your side always counts.
// An enemy action only counts if you could already see the ship (not a just-revealed muzzle flash).
export function watchHasSight(state, viewer, events) {
  return (events || []).some((e) => {
    if (e.t === 'damage') return true;
    if (e.t === 'destroyed' && e.owner === viewer) return true;
    if (e.t === 'bump' || e.t === 'sighted') return true;
    if (e.t === 'blast' || e.t === 'stopped' || e.t === 'obj_destroyed') return true;
    if (e.t === 'enemy_fire' || e.t === 'move' || e.t === 'launch' || e.t === 'fire') return shooterKnown(state, viewer, events, e.ship);
    return false;
  });
}

// Own-ship taps always select (or clear if you tap the already-selected ship in move mode).
// A move/fire/launch on a glowing hex only happens when you did not tap one of your ships.
export function rgTapIntent({ sel, mode, ownId, canMoveHere, canFireHere, canLaunchHere, empty }) {
  if (ownId) return ownId === sel && (mode === 'move' || !mode) ? { type: 'clear' } : { type: 'select', id: ownId };
  if (sel && mode === 'move' && canMoveHere) return { type: 'move' };
  if (sel && mode === 'laser' && canFireHere) return { type: 'fire' };
  if (sel && mode === 'missile' && canLaunchHere) return { type: 'launch' };
  if (sel && empty) return { type: 'clear' };
  return { type: 'none' };
}
