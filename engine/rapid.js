// Rapid mode: both sides choose ONE action a tick and the two resolve together.
//
//   const r = rapidRules(rules, { timer: 15, line: 12 });   // turn a board's rules into rapid rules
//   let g = rapidStart(r, seed);                            // a game that is always "player 1 to act"
//   g = rapidTick(g, [myAction, rapidAI(g, 1)]);            // resolve one tick
//
// A tick, in order (everyone acts on the board as it was when the tick started):
//   1. shots, launches, scans and detonations, both sides. Laser hits are held back and land
//      together, so two ships that shoot each other both get hit (a ship shot this tick still fires).
//   2. moves, both sides (1 hex each). A ship that died in step 1 does not move.
//   3. missiles and drones fly (their speed per tick is a third of their speed per round).
//   4. the tick count goes up; flares and shields count down in ticks.
//
// Between ticks the state rests as "player 1's turn with 1 point", so every screen query
// (reach, beamTargets, launchOptions, shipStatus) works unchanged for the human; the computer's
// action is worked out on a copy where it is player 2's turn.

import { Illegal, no, num, shipById, emit, cellsOf, gap, nearestCell } from './state.js';
import { refreshSight } from './detect.js';
import { applyHits, checkWin } from './damage.js';
import { doMove, doFire, doLaunch, doScan, doDetonate } from './actions.js';
import { runFlight } from './flight.js';
import { limitWinner } from './objective.js';
import { hashState, actionText } from './codec.js';
import { reach, beamTargets, launchOptions, aimLaunch, shipStatus } from './query.js';
import { begin } from './turn.js';
import { newGame } from './state.js';
import { dist, step } from './hex.js';
import { homeSign, forwardDirs, pastLine, shipsPast, unlocked, rowsForward, scanAllowed } from './rapidrules.js';

export { homeSign, forwardDirs, pastLine, shipsPast, unlocked, rowsForward, scanAllowed };

// The battle settings rapid mode reads (ui/settings.js shows them). Numbers are in ticks or seconds.
export const RAPID_DEFAULTS = {
  timer: 15,          // seconds to choose an action
  watch: 5,           // seconds to watch what just happened before the controls wake up
  autofire: 'best',   // at time-out a chosen laser or missile picks: 'best' or 'nearest' target
  launch: 'sighted',  // 'sighted': a launch must lock onto a ship you can see. 'blind': any hex
  unlock: 'holding',  // 'holding': free only while a ship of yours is past the line. 'permanent': from the first crossing
  line: 12,           // rows from your own home edge (12 on a radius-12 board = halfway)
  scan: 'past_line',  // who may scan: 'past_line', 'unlocked' (any ship once free) or 'always'
  cap: 100,           // ticks before the game is a draw
  scale: 3,           // ticks to a round: missile speeds are divided by it, fuel, shields and flares multiplied
};

// Rapid rules from a board's ordinary rules. Nothing in the world file changes; only this game's copy.
export function rapidRules(rules, opts = {}) {
  const o = { ...RAPID_DEFAULTS, ...(rules.rapid || {}), ...opts };
  const k = Math.max(1, num(o.scale, 3));
  const munitions = {};
  let fastest = 1;
  for (const [name, m] of Object.entries(rules.munitions)) {
    const sp = num(m.speed);
    munitions[name] = sp ? { ...m, speed: Math.max(1, Math.round(sp / k)), fuel: typeof m.fuel === 'number' ? m.fuel * k : m.fuel } : { ...m };
    fastest = Math.max(fastest, num(munitions[name].speed));
  }
  const parts = {};
  for (const [name, c] of Object.entries(rules.parts)) parts[name] = c.recharges ? { ...c, recharge_every: num(c.recharge_every, 1) * k } : c;
  const fr = {};
  for (const f of ['fire', 'beamHit', 'launch', 'pd', 'scan']) fr[f] = k;
  return {
    ...rules,
    rapid: o,
    cp: { perTurn: 1, bankCap: 0, secondBonus: 0 },
    firstPlayer: 'fixed', firstMover: 'player_1',
    ticks: fastest,               // one flight step per hex of the fastest munition
    turnLimit: num(o.cap, 60),
    move: { ...rules.move, minMove: 0 },
    det: { ...rules.det, flareRounds: fr },
    munitions, parts,
  };
}

// A new rapid game (rules from rapidRules).
export function rapidStart(rules, seed = 1) {
  const s = begin(newGame(rules, seed));
  s.rapid = { sign: [homeSign(s, 0), homeSign(s, 1)], ever: [false, false], ticks: [] };
  rest(s);
  s.pre = hashState(s);
  return s;
}

// Make player p the one to act, with one point.
function asCurrent(s, p) {
  s.order = p === 0 ? [0, 1] : [1, 0];
  s.turn = 0;
  s.players[p].cp = 1;
}
// Between ticks: player 1 to act, every ship fresh (nothing used, nothing moved this tick).
function rest(s) {
  for (const pl of s.players) { pl.cp = 1; pl.cpBank = 0; pl.moved = {}; }
  for (const x of s.ships) { x.used = {}; x.turnStart = x.pos.slice(); }
  asCurrent(s, 0);
  s.pending = [];
}
const copy = (state) => { const { rules, ...r } = state; const s = structuredClone(r); s.rules = rules; return s; };

const DO = { move: doMove, fire: doFire, launch: doLaunch, scan: doScan, detonate: doDetonate };

// Every 1-hex move side p may make now (the flagship last), as move actions.
export function legalMoves(state, p) {
  const s = copy(state); asCurrent(s, p);
  const out = [];
  for (const x of s.ships) if (x.owner === p && !x.dead) for (const r of reach(s, x.id)) if (r.path.length === 1) out.push({ type: 'move', ship: x.id, path: r.path });
  return out;
}
// Forward moves only (what a time-out may pick), never the flagship while anything else can go.
export function forcedMoves(state, p) {
  const s = copy(state); asCurrent(s, p);
  const fw = forwardDirs(s, p), all = legalMoves(state, p).filter((a) => fw.includes(a.path[0]));
  const escorts = all.filter((a) => !shipById(s, a.ship).flagship);
  return escorts.length ? escorts : all;
}
// May side p do nothing this tick? Once free, yes. Before that only when it has no move at all.
export function passAllowed(state, p) {
  return unlocked(state, p) || !legalMoves(state, p).length;
}

// Would this action be accepted for side p right now? (null when fine, else the reason)
export function rapidRefusal(state, p, a) {
  if (state.phase !== 'play') return 'the game is over';
  if (!a || a.type === 'pass' || a.type === 'end') return passAllowed(state, p) ? null : 'you must act: move a ship forward, fire or launch. Passing is allowed once one of your ships is past the line';
  if (!DO[a.type]) return 'that is not a rapid-mode action';
  if (a.type === 'move' && (!Array.isArray(a.path) || a.path.length !== 1)) return 'in rapid mode a ship moves one hex at a time';
  const s = copy(state); asCurrent(s, p);
  try { DO[a.type](s, a); return null; } catch (e) { if (e instanceof Illegal) return e.message; throw e; }
}

const FIRST = { fire: 0, launch: 0, scan: 0, detonate: 0, move: 1 };

// Resolve one tick. acts[p] is side p's action ({ type: 'pass' } to do nothing).
export function rapidTick(state, acts) {
  for (const p of [0, 1]) { const why = rapidRefusal(state, p, acts[p]); if (why) no((p === 0 ? '' : 'player 2: ') + why); }
  const s = copy(state);
  s.events = []; s.flight = null;
  const texts = [null, null];
  // 1. shots, launches, scans: hits land together afterwards
  s.deferHits = [];
  for (const p of [0, 1]) {
    const a = acts[p];
    if (!a || !(a.type in FIRST) || FIRST[a.type] !== 0) continue;
    asCurrent(s, p);
    texts[p] = actionText(a);
    // both sides shot the same missile: the second shot has nothing left to hit and fizzles
    try { DO[a.type](s, a); } catch (e) { if (!(e instanceof Illegal)) throw e; }
  }
  const held = s.deferHits; delete s.deferHits;
  for (const h of held) {
    const ship = shipById(s, h.ship);
    if (ship) applyHits(s, ship, h.seg, h.hits, h.cause);
  }
  refreshSight(s); checkWin(s);
  // 2. moves
  for (const p of [0, 1]) {
    const a = acts[p];
    if (s.phase !== 'play' || !a || a.type !== 'move') continue;
    texts[p] = actionText(a);
    if (!shipById(s, a.ship)) continue;          // shot down before it could move
    asCurrent(s, p);
    try { doMove(s, a); } catch (e) { if (!(e instanceof Illegal)) throw e; }   // a hidden ship now in the way: it just doesn't go
  }
  refreshSight(s); checkWin(s);
  // 3. missiles and drones
  if (s.phase === 'play' && s.objs.length) runFlight(s);
  // 4. the tick ends
  for (const p of [0, 1]) if (shipsPast(s, p).length) s.rapid.ever[p] = true;
  for (const p of [0, 1]) if (acts[p] && acts[p].type === 'scan') { s.rapid.lastScan = s.rapid.lastScan || [0, 0]; s.rapid.lastScan[p] = s.round; }
  const rec = { round: s.round, acts: texts.map((t) => t || 'pass') };
  s.rapid.ticks.push(rec);
  s.history.push({ round: s.round, player: 0, actions: [rec.acts[0]], pre: state.pre, rapid: true });
  s.history.push({ round: s.round, player: 1, actions: [rec.acts[1]], pre: state.pre, rapid: true });
  if (s.phase === 'play') {
    s.round++;
    for (const x of s.ships) x.flares = x.flares.filter((f) => f.until >= s.round);
    for (const id of Object.keys(s.lit)) if (s.lit[id] < s.round) delete s.lit[id];
    if (s.round > s.rules.turnLimit) {
      s.phase = 'over';
      s.winner = limitWinner(s);
      emit(s, { t: 'game_over', winner: s.winner, by: 'turn_limit' }, [0, 1]);
    }
  }
  rest(s);
  refreshSight(s);
  s.pre = hashState(s);
  s.lastTurn = rec;
  return s;
}

// ---------- automatic choices ----------
// The time-out picks for you, and the computer uses the same scoring.

// Score a laser shot: hits, more for the flagship, more for a ship close to dying, some for an
// incoming missile that is close to one of our ships.
function shotScore(s, p, t) {
  const tgt = shipById(s, t.target);
  if (tgt) return t.hits * (tgt.flagship ? 3 : 1) + (tgt.segs.length === 1 ? 1 : 0);
  const o = s.objs.find((x) => x.id === t.target);
  if (!o) return 0;
  const near = s.ships.some((x) => x.owner === p && !x.dead && gap(x, o) <= 4);
  return near ? 2.5 : 0.2;
}
// The shot a chosen laser ship takes at time-out ('best': highest score, 'nearest': closest target).
export function autoFire(state, p, shipId, mode = 'best') {
  const s = copy(state); asCurrent(s, p);
  const ship = shipById(s, shipId);
  const opts = beamTargets(s, shipId);
  if (!ship || !opts.length) return null;
  let best = null, bv = -Infinity;
  for (const t of opts) {
    const v = mode === 'nearest' ? -dist(t.at, nearestCell(ship, t.at)) + t.hits * 0.01 : shotScore(s, p, t);
    if (v > bv) { bv = v; best = t; }
  }
  return { type: 'fire', ship: shipId, seg: best.seg, part: best.part, at: best.at };
}
// The launch a chosen missile ship makes at time-out: at the best (flagship first) or nearest ship it can lock.
export function autoLaunch(state, p, shipId, kind, mode = 'best') {
  const s = copy(state); asCurrent(s, p);
  const lo = launchOptions(s, shipId), ship = shipById(s, shipId);
  if (!lo || !ship) return null;
  const k = kind && lo.kinds.includes(kind) ? kind : lo.kinds[0];
  const m = s.rules.munitions[k], reachHexes = num(m.speed) * num(m.fuel, 1);
  const cands = lo.locks.map((id) => shipById(s, id)).filter((t) => t && gap(ship, t) <= reachHexes);
  if (!cands.length) return null;
  cands.sort((a, b) => (mode === 'nearest' ? 0 : (b.flagship ? 1 : 0) - (a.flagship ? 1 : 0)) || gap(ship, a) - gap(ship, b));
  const t = cands[0];
  return aimLaunch(s, shipId, k, nearestCell(t, ship.pos), t.id);
}

// ---------- the computer ----------
// One action for side p, chosen on its own view of the board. level 'easy' takes the first shot it
// finds and otherwise advances at random.
export function rapidAI(state, p = 1, level = 'normal', rnd = Math.random) {
  if (state.phase !== 'play') return { type: 'pass' };
  const s = copy(state); asCurrent(s, p);
  const mine = s.ships.filter((x) => x.owner === p && !x.dead);
  // 1. the best laser shot anywhere in the fleet
  let shot = null, sv = 0;
  for (const x of mine) for (const t of beamTargets(s, x.id)) {
    const v = shotScore(s, p, t) + (level === 'easy' ? rnd() * 3 : 0);
    if (v > sv) { sv = v; shot = { type: 'fire', ship: x.id, seg: t.seg, part: t.part, at: t.at }; }
  }
  if (shot && sv >= 1) return shot;
  // 2. a missile at a ship it can see and reach, unless one of ours is already after it
  for (const x of mine) {
    const a = autoLaunch(state, p, x.id, null, 'best');
    if (!a || !a.target) continue;
    if (s.objs.some((o) => o.owner === p && o.target === a.target)) continue;
    if (level === 'easy' && rnd() < 0.5) continue;
    if (!rapidRefusal(state, p, a)) return a;
  }
  if (shot) return shot;   // shoot down a far-off missile rather than nothing
  // 3. a scan when it is allowed and nothing of the enemy is in view
  const seen = s.players[p].vis.some((id) => s.ships.some((x) => x.id === id && x.owner !== p));
  const scannedLately = (s.rapid.lastScan || [])[p] > s.round - 3;
  if (!seen && !scannedLately) for (const x of mine) if (shipStatus(s, x.id).scanReady && rnd() < 0.5) return { type: 'scan', ship: x.id };
  // 4. move
  const free = unlocked(s, p);
  const enemies = s.ships.filter((x) => x.owner !== p && !x.dead && s.players[p].vis.includes(x.id));
  if (free) {
    // free: close on what it can see with an armed escort; with nothing in view, keep pushing forward
    if (!enemies.length) return advance(s, state, p, mine, enemies, forcedMoves(state, p), level, rnd) || { type: 'pass' };
    let best = null, bv = Infinity;
    for (const a of legalMoves(state, p)) {
      const x = shipById(s, a.ship);
      if (x.flagship) continue;
      const moved = { ...x, pos: step(x.pos, a.path[0]) };
      const d = Math.min(...enemies.map((e) => gap(e, moved)));
      if (d < 3) continue;   // don't park on top of them
      const v = d + rnd() * 0.5;
      if (v < bv) { bv = v; best = a; }
    }
    return best || { type: 'pass' };
  }
  return advance(s, state, p, mine, enemies, forcedMoves(state, p), level, rnd) || { type: 'pass' };
}

function advance(s, state, p, mine, enemies, moves, level, rnd) {
  if (!moves.length) return null;
  if (level === 'easy') return moves[Math.floor(rnd() * moves.length)];
  // advance as a fleet, not one scout at a time: the scouts lead (the most forward one goes, but no more
  // than 3 rows ahead of the middle of the scout line); the escorts follow about 2 rows behind the scouts,
  // or lead once fewer than 3 scouts are left; the flagship follows 2 rows behind its escorts.
  // Moving into guns it can see counts against a move.
  const progOf = (x) => Math.max(...cellsOf(x).map((c) => rowsForward(s, p, c)));
  const scouts = mine.filter((x) => x.segs.length === 1), escorts = mine.filter((x) => x.segs.length > 1 && !x.flagship);
  const scoutProg = scouts.map(progOf).sort((a, b) => a - b);
  const mid = scoutProg.length ? scoutProg[Math.floor(scoutProg.length / 2)] : 0;
  const escProg = escorts.map(progOf);
  const front = scouts.length >= 3 ? mid - 2 : (escProg.length ? Math.max(...escProg) + 1 : 99);
  const escMin = escProg.length ? Math.min(...escProg) : 99;
  let best = null, bv = -Infinity;
  for (const a of moves) {
    const x = shipById(s, a.ship), prog = progOf(x);
    const danger = enemies.filter((e) => gap(e, x) <= 10).length;
    let v;
    if (x.segs.length === 1) v = scouts.length >= 3 ? prog - 4 * Math.max(0, prog - (mid + 3)) : front - prog;
    else if (!x.flagship) v = front - prog + (scouts.length >= 3 ? 0 : 2);
    else v = escMin - 2 - prog - 1;
    v += -danger * 3 + rnd() * 2;
    if (v > bv) { bv = v; best = a; }
  }
  return best;
}
