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
  watch_seconds: 5,
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
  if (s.history.length > 12) s.history = s.history.slice(-12);   // keeps every copy of the game small
  return s;
}

export function rgStart(rules, seed = 1) {
  const s = start(rules, seed);
  s.rg = { last: null };
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
export function rgAct(state, a) {
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
  s.rg = { last: { seat, action: a, beat: state.round } };
  return prep(s);
}

export function rgAttempt(state, a) {
  try { return { ok: true, state: rgAct(state, a) }; }
  catch (e) { if (e instanceof Illegal) return { ok: false, why: e.message, state }; throw e; }
}

// Only when a side truly cannot do anything at all (every ship stuck or unable to act).
export function rgStuckPass(state) {
  const seat = toAct(state);
  let s = apply(state, { type: 'end' });
  s.rg = { last: { seat, action: { type: 'stuck' }, beat: state.round } };
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
    const r = rgAttempt(state, a);
    if (r.ok) return { action: a, state: r.state };
  }
  const f = forcedMove(state, null);
  if (f) { const r = rgAttempt(state, f); if (r.ok) return { action: f, state: r.state, forced: true }; }
  return { action: { type: 'stuck' }, state: rgStuckPass(state), forced: true };
}

// What `viewer` saw happen in the last action (the 5-second watch): only events they were shown.
export function seenEvents(state, viewer) {
  return (state.events || []).filter((e) => e.seenBy && e.seenBy.includes(viewer));
}
