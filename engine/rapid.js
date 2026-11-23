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

import { Illegal, no, num, shipById, emit, cellsOf, gap, nearestCell, makeObj } from './state.js';
import { fuzzAt } from './detect.js';
import { parseAction } from './codec.js';
import { refreshSight, visibleTo, contactsFor } from './detect.js';
import { applyHits, checkWin } from './damage.js';
import { doMove, doFire, doLaunch, doScan, doDetonate } from './actions.js';
import { runFlight } from './flight.js';
import { limitWinner } from './objective.js';
import { hashState, actionText } from './codec.js';
import { reach, beamTargets, launchOptions, aimLaunch, shipStatus } from './query.js';
import { begin } from './turn.js';
import { newGame } from './state.js';
import { dist, step } from './hex.js';
import { econStart, econTick, ECON_DEFAULTS, buyRefusal, doBuy, turretsFire, TURRET, econConfig, upgradeParts } from './economy.js';
import { homeSign, forwardDirs, pastLine, shipsPast, unlocked, rowsForward, scanAllowed, inOpening, stride, shootRange, wingGap } from './rapidrules.js';

export { homeSign, forwardDirs, pastLine, shipsPast, unlocked, rowsForward, scanAllowed, inOpening, stride, shootRange };

// A tick's action as text, and back: a shot with a wingman shot or move is "<fire>+<fire>" or "<fire>+<move>".
// A move that converts the ship is "<move>~scanner" or "<move>~mine".
export const tickText = (a) => (!a || a.type === 'pass' ? 'pass' : a.type === 'buy' ? 'b:' + a.item + (a.ship ? '.' + a.ship + (a.at ? '.' + a.at.join(',') : a.kind ? '.' + a.kind : '') : '') : actionText(a) + (a.wing ? '+' + actionText(a.wing) : '') + (a.convert ? '~' + a.convert : ''));
export function parseTick(t) {
  if (t === 'pass') return { type: 'pass' };
  if (/^b:/.test(t)) {   // economy mode: a purchase, "b:heatmap" or "b:turret.<ship>.<q>,<r>"
    const [item, ship, more] = t.slice(2).split('.');
    if (!ship) return { type: 'buy', item };
    if (item === 'turret') return { type: 'buy', item, ship, at: more.split(',').map(Number) };
    return more ? { type: 'buy', item, ship, kind: more } : { type: 'buy', item, ship };
  }
  const [body, convert] = String(t).split('~');
  const [main, wing] = body.split('+');
  const a = parseAction(main);
  if (wing) a.wing = parseAction(wing);
  if (convert) a.convert = convert;
  return a;
}

// ---------- going silent: scanner buoys and mines ----------
// A one-hex ship (not the flagship) that ends a move on or past its line may convert, as part of that
// move, into a scanner buoy (scans around itself every tick for free) or a naval mine. The ship is gone
// (not destroyed: it doesn't count as lost) and the enemy loses sight of it.
export const BUOY = 'scan_buoy';
export function canConvert(state, p, a) {
  const R = state.rules.rapid;
  if (!R || R.convert === 'off' || !a || a.type !== 'move') return false;
  const s = copy(state); asCurrent(s, p);
  const x = shipById(s, a.ship);
  if (!x || x.flagship || x.segs.length !== 1) return false;
  try { doMove(s, { ...a, convert: undefined }); } catch (e) { if (e instanceof Illegal) return false; throw e; }
  const y = shipById(s, a.ship);
  return !!y && pastLine(s, y);
}
function convertShip(s, x, into) {
  const kind = into === 'mine' ? 'naval_mine' : BUOY;
  s.objs.push(makeObj(s, kind, x.owner, x.pos, 0));
  x.dead = true; x.converted = into;
  emit(s, { t: 'converted', ship: x.id, into, at: x.pos.slice() }, [x.owner]);
}
// Every tick each buoy scans for its side: a full readout inside the first ring, rough contacts in the second.
function buoysScan(s) {
  const [r1, r2] = s.rules.rapid.buoyScan || [4, 8];
  for (const b of s.objs.filter((o) => o.kind === BUOY)) {
    const pl = s.players[b.owner];
    pl.revealed = pl.revealed || {}; pl.pings = pl.pings || {};
    for (const t of s.ships.filter((x) => !x.dead && x.owner !== b.owner).concat(s.objs.filter((o) => o.owner !== b.owner && o.kind !== BUOY))) {
      const d = gap(b, t);
      if (!t.segs && num(s.rules.munitions[t.kind].scan_resist) && d > num(s.rules.munitions[t.kind].scan_resist)) continue;
      if (d <= r1) {
        pl.revealed[t.id] = Math.max(pl.revealed[t.id] || 0, s.round + 1);
        if (t.segs) {
          const intel = (pl.intel[t.id] = pl.intel[t.id] || {});
          t.segs.forEach((g, i) => { intel[i] = { round: s.round, wrecked: g.wrecked, parts: g.parts.map((q) => ({ t: q.t, hp: q.hp })) }; });
        }
      } else if (d <= r2 && t.segs) pl.pings[t.id] = { round: s.round, at: fuzzAt(s, b.owner, t), r: s.rules.det.fuzzR, kind: 'ship' };
    }
  }
}

// Formation (wingman): when side p's ship `shooter` fires, ONE friend within wingGap hexes of it acts too,
// in the same tick: it fires (setting wingman 'fire_or_move', the default) if it has a target, or else
// moves 1 hex. Setting 'move': it can only move. 'off': no wingman.
const wingMode = (state) => { const m = state.rules.rapid && state.rules.rapid.wingman; return m === 'off' ? 'off' : m === 'move' || m === 'on' ? 'move' : 'fire_or_move'; };
const wingmen = (s, p, shooter) => { const sh = shipById(s, shooter); return sh ? s.ships.filter((x) => x.owner === p && !x.dead && x.id !== shooter && gap(x, sh) <= wingGap(s)) : []; };
// The shots its wingmen could take (fire actions), one per target hex and laser.
export function wingShots(state, p, shooter) {
  if (!state.rules.rapid || wingMode(state) !== 'fire_or_move') return [];
  const s = copy(state); asCurrent(s, p);
  const out = [];
  for (const x of wingmen(s, p, shooter)) for (const t of beamTargets(s, x.id)) out.push({ type: 'fire', ship: x.id, seg: t.seg, part: t.part, at: t.at, hits: t.hits, target: t.target });
  return out;
}
// The 1-hex moves its wingmen could make (only those with no shot, when wingmen fire).
export function wingMoves(state, p, shooter) {
  if (!state.rules.rapid || wingMode(state) === 'off') return [];
  const s = copy(state); asCurrent(s, p);
  const sh = shipById(s, shooter);
  if (!sh) return [];
  const firing = new Set(wingShots(state, p, shooter).map((f) => f.ship));
  return legalMoves(state, p).filter((a) => a.path.length === 1 && a.ship !== shooter && !firing.has(a.ship) && gap(shipById(s, a.ship), sh) <= wingGap(s));
}

// The battle settings rapid mode reads (ui/settings.js shows them). Numbers are in ticks or seconds.
export const RAPID_DEFAULTS = {
  timer: 15,          // seconds to choose an action once the shooting has started
  openTimer: 10,      // seconds to choose during the opening (until the first sighting, or the first shot if that comes sooner)
  openEnd: 'sighting', // what ends the opening: 'sighting' (the first tick either side has any contact on the other) or 'shot' (the first laser shot or missile launch)
  stride: 'opening',  // moves of 2 hexes: 'opening' (until it ends), 'always' or 'off'
  watch: 3,           // seconds to watch what just happened before the controls wake up (none in the opening)
  autofire: 'best',   // at time-out a chosen laser or missile picks: 'best' or 'nearest' target
  launch: 'sighted',  // 'sighted': a launch must lock onto a ship you can see. 'blind': any hex
  unlock: 'holding',  // 'holding': free only while a ship of yours is past the line. 'permanent': from the first crossing
  line: 12,           // rows from your own home edge (12 on a radius-12 board = halfway)
  scan: 'past_line',  // who may scan: 'past_line', 'unlocked' (any ship once free) or 'always'
  cap: 100,           // ticks before the game is a draw (opening ticks don't count)
  shootRange: 3,      // lasers may shoot a missile or drone down only this close (0: any range)
  debris: 'on',       // a missile shot down within 2 hexes: the shooter takes 1 hit and is lit up, parts and all, for 3 ticks
  forwardEyes: 2,     // extra sensor range for a ship past the line (0: none)
  attackRun: 'last_tick', // +1 laser hit for a ship that moved last tick ('off': none)
  wingman: 'fire_or_move', // formation: a ship that fires brings one friend within wingGap hexes: it fires too, or moves 1 hex if it has no target ('move': moves only; 'off')
  wingGap: 2,         // touching (1) or one empty hex between (2)
  convert: 'on',      // a one-hex ship that moves on or past the line may go silent: become a scanner buoy or a naval mine
  buoyScan: [4, 8],   // a scanner buoy's rings, every tick, free: full readout within the first, rough contacts within the second
  econHeatmap: ECON_DEFAULTS.heatmap, // what the threat heatmap costs
  econTurret: ECON_DEFAULTS.turret,   // what a turret costs
  econUpgrade: ECON_DEFAULTS.upgrade, // what an upgrade costs
  econTurretRange: ECON_DEFAULTS.turretRange, // how far a turret shoots
  econUpkeepEvery: ECON_DEFAULTS.turretEvery, // turret upkeep: 1 salvage every this many ticks (0: no upkeep)
  econIdle: ECON_DEFAULTS.idle,       // salvage lost on a tick you pass (0: none)
  scale: 3,           // ticks to a round: missile speeds are divided by it, fuel, shields and flares multiplied
  economy: 'off',     // 'on': the Frontier economy (engine/economy.js): ships earn salvage by flying through the board
  econCap: ECON_DEFAULTS.cap,        // most salvage a side earns in one tick
  econOwnHalf: 'no',  // 'yes': new ground in your own half pays too
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
  let parts = {};
  for (const [name, c] of Object.entries(rules.parts)) parts[name] = c.recharges ? { ...c, recharge_every: num(c.recharge_every, 1) * k } : c;
  if (o.economy === 'on') parts = { ...parts, ...upgradeParts(parts) };   // economy mode: the upgraded copies of parts
  const fr = {};
  for (const f of ['fire', 'beamHit', 'launch', 'pd', 'scan']) fr[f] = k;
  // the scanner buoy a one-hex ship can become past the line: still, quiet (seen only from 2 hexes by a
  // standard sensor), one hit kills it
  // economy mode: the turret a ship can leave behind (engine/economy.js): still, seen from about 1 hex
  // further than a scout, it watches 2 hexes around itself for its side and fires on its own every tick
  munitions[TURRET] = { label: 'Turret', speed: 0, hits: 0, blast_radius: 0, signature: 1, sensor_range: 2, reports: true, setup_only: true, max_per_player: 99, cost: 0 };
  munitions[BUOY] = { label: 'Scanner buoy', speed: 0, hits: 0, blast_radius: 0, signature: -2, setup_only: true, max_per_player: 99, cost: 0 };
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
  s.rapid = { sign: [homeSign(s, 0), homeSign(s, 1)], ever: [false, false], ticks: [], opening: true, openTicks: 0 };
  if (rules.rapid.economy === 'on') econStart(s);
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
  for (const x of s.ships) if (x.owner === p && !x.dead) for (const r of reach(s, x.id)) out.push({ type: 'move', ship: x.id, path: r.path });
  return out;
}
// Forward moves only (what a time-out may pick), as far as a move may go (2 hexes in the opening),
// never the flagship while anything else can go. With `prefer` (the ship the player had tapped), that
// ship's forward moves come first and alone, flagship or not; if it has none, the usual pick stands.
export function forcedMoves(state, p, prefer) {
  const s = copy(state); asCurrent(s, p);
  const fw = forwardDirs(s, p), fwd = legalMoves(state, p).filter((a) => a.path.every((d) => fw.includes(d)));
  const far = new Map();
  for (const a of fwd) far.set(a.ship, Math.max(far.get(a.ship) || 0, a.path.length));
  const all = fwd.filter((a) => a.path.length === far.get(a.ship));
  const mine = prefer ? all.filter((a) => a.ship === prefer) : [];
  if (mine.length) return mine;
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
  if (a.type === 'buy') return buyRefusal(state, p, a);   // economy mode: buying is the tick's action
  if (!DO[a.type]) return 'that is not a rapid-mode action';
  if (a.convert) {
    if (!['scanner', 'mine'].includes(a.convert)) return 'a ship can become a scanner or a mine';
    if (!canConvert(state, p, a)) return 'only a one-hex ship that ends its move on or past the line can go silent';
    a = { ...a }; delete a.convert;
  }
  if (a.wing) {
    if (a.type !== 'fire') return 'only a laser shot brings a wingman';
    const w = a.wing;
    if (w && w.type === 'fire') {
      if (!wingShots(state, p, a.ship).some((f) => f.ship === w.ship && f.seg === w.seg && f.part === w.part && f.at[0] === w.at[0] && f.at[1] === w.at[1])) return 'that ship cannot fire as a wingman: it must be within ' + wingGap(state) + ' hexes of the ship that fires, with a target of its own';
    } else if (!w || w.type !== 'move' || !wingMoves(state, p, a.ship).some((m) => m.ship === w.ship && m.path.join() === (w.path || []).join())) return 'that ship cannot make a wingman move: it must be within ' + wingGap(state) + ' hexes of the ship that fires, have no shot of its own, and move 1 hex';
    a = { ...a }; delete a.wing;
  }
  if (a.type === 'move' && (!Array.isArray(a.path) || !a.path.length || a.path.length > stride(state))) return stride(state) > 1 ? 'a ship moves up to 2 hexes in the opening' : 'once the shooting starts a ship moves one hex at a time';
  const s = copy(state); asCurrent(s, p);
  try { DO[a.type](s, a); return null; } catch (e) { if (e instanceof Illegal) return e.message; throw e; }
}

const FIRST = { fire: 0, launch: 0, scan: 0, detonate: 0, move: 1 };

// Resolve one tick. acts[p] is side p's action ({ type: 'pass' } to do nothing).
export function rapidTick(state, acts) {
  for (const p of [0, 1]) { const why = rapidRefusal(state, p, acts[p]); if (why) no((p === 0 ? '' : 'player 2: ') + why); }
  const s = copy(state);
  s.events = []; s.flight = null;
  const texts = acts.map((a) => tickText(a));   // what each side chose, even if the game ends before it happens
  const start = new Map(s.ships.map((x) => [x.id, x.pos.join()]));
  // 0. purchases (economy mode): paid before anything else, so this tick's earnings can't pay for them
  for (const p of [0, 1]) if (acts[p] && acts[p].type === 'buy') doBuy(s, p, acts[p]);
  // 1. shots, launches, scans: hits land together afterwards
  s.deferHits = [];
  for (const p of [0, 1]) {
    const a = acts[p];
    if (!a || !(a.type in FIRST) || FIRST[a.type] !== 0) continue;
    asCurrent(s, p);
    texts[p] = tickText(a);
    // both sides shot the same missile: the second shot has nothing left to hit and fizzles
    try { DO[a.type](s, a); } catch (e) { if (!(e instanceof Illegal)) throw e; }
    // the wingman's shot, in the same volley
    if (a.wing && a.wing.type === 'fire') { asCurrent(s, p); try { doFire(s, a.wing); } catch (e) { if (!(e instanceof Illegal)) throw e; } }
  }
  turretsFire(s);   // economy mode: turrets shoot with everyone else (nothing when the economy is off)
  const held = s.deferHits; delete s.deferHits;
  for (const h of held) {
    const ship = shipById(s, h.ship);
    const n0 = s.events.length;
    if (ship) applyHits(s, ship, h.seg, h.hits, h.cause);
    if (h.by) for (const e of s.events.slice(n0)) if (e.t === 'damage') e.by = h.by;   // a turret's hits: which turret
  }
  refreshSight(s); checkWin(s);
  // 2. moves
  for (const p of [0, 1]) {
    const a = acts[p];
    if (s.phase !== 'play' || !a || a.type !== 'move') continue;
    texts[p] = tickText(a);
    if (!shipById(s, a.ship)) continue;          // shot down before it could move
    asCurrent(s, p);
    try { doMove(s, a); } catch (e) { if (!(e instanceof Illegal)) throw e; }   // a hidden ship now in the way: it just doesn't go
    const x = a.convert && shipById(s, a.ship);
    if (x && x.segs.length === 1 && pastLine(s, x)) convertShip(s, x, a.convert);
  }
  // 2b. wingman moves: the friend of a ship that fired this tick
  for (const p of [0, 1]) {
    const w = acts[p] && acts[p].wing;
    if (s.phase !== 'play' || !w || w.type !== 'move' || !shipById(s, w.ship)) continue;
    asCurrent(s, p);
    try { doMove(s, w); } catch (e) { if (!(e instanceof Illegal)) throw e; }
  }
  refreshSight(s); checkWin(s);
  // ships that moved this tick get the attack-run bonus next tick
  s.rapid.movedLast = {};
  for (const x of s.ships) if (!x.dead && start.get(x.id) !== x.pos.join()) s.rapid.movedLast[x.id] = 1;
  // 3. missiles and drones
  // every tick, even with nothing in the air: the flight also recharges shields and reloads point defence
  if (s.phase === 'play') runFlight(s);
  if (s.phase === 'play') buoysScan(s);
  // 4. the tick ends
  econTick(s, state, acts);   // economy mode: salvage for both sides (does nothing when the economy is off)
  for (const p of [0, 1]) if (shipsPast(s, p).length) s.rapid.ever[p] = true;
  // the opening ends at the first sighting (either side has a contact on the other) or, if that comes
  // sooner, the first laser shot or missile launch; its ticks don't count towards the limit
  if (s.rapid.opening) {
    s.rapid.openTicks = (s.rapid.openTicks || 0) + 1;
    const shot = acts.some((a) => a && (a.type === 'fire' || a.type === 'launch'));
    const sighted = s.rules.rapid.openEnd !== 'shot' && firstContact(s);
    if (shot || sighted) { s.rapid.opening = false; s.rapid.openEnded = shot ? 'shot' : 'sighting'; }
  }
  for (const p of [0, 1]) if (acts[p] && acts[p].type === 'scan') { s.rapid.lastScan = s.rapid.lastScan || [0, 0]; s.rapid.lastScan[p] = s.round; }
  const rec = { round: s.round, acts: texts };
  s.rapid.ticks.push(rec);
  s.history.push({ round: s.round, player: 0, actions: [rec.acts[0]], pre: state.pre, rapid: true });
  s.history.push({ round: s.round, player: 1, actions: [rec.acts[1]], pre: state.pre, rapid: true });
  if (s.phase === 'play') {
    s.round++;
    for (const x of s.ships) x.flares = x.flares.filter((f) => f.until >= s.round);
    for (const id of Object.keys(s.lit)) if (s.lit[id] < s.round) delete s.lit[id];
    if (s.round - (s.rapid.openTicks || 0) > s.rules.turnLimit) {
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

// Has either side any contact on the other: a ship or munition in view, or a fuzzy contact just out of range?
function firstContact(s) {
  for (const p of [0, 1]) {
    const vis = visibleTo(s, p);
    if (vis.size || contactsFor(s, p, vis).length) return true;
  }
  return false;
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
  const a = chooseAI(state, p, level, rnd);
  // a scout that reaches the line goes silent: a scanner buoy if the side has none, a mine if an enemy is close
  if (a && a.type === 'move' && level !== 'easy' && canConvert(state, p, a)) {
    const s = copy(state), x = shipById(s, a.ship), to = { ...x, pos: a.path.reduce((c, d) => step(c, d), x.pos) };
    if (!s.objs.some((o) => o.owner === p && o.kind === BUOY)) return { ...a, convert: 'scanner' };
    if (s.ships.some((e) => e.owner !== p && !e.dead && s.players[p].vis.includes(e.id) && gap(e, to) <= 2)) return { ...a, convert: 'mine' };
  }
  return a;
}
function chooseAI(state, p, level, rnd) {
  if (state.phase !== 'play') return { type: 'pass' };
  const s = copy(state); asCurrent(s, p);
  const mine = s.ships.filter((x) => x.owner === p && !x.dead);
  // 1. the best laser shot anywhere in the fleet
  let shot = null, sv = 0;
  for (const x of mine) for (const t of beamTargets(s, x.id)) {
    const v = shotScore(s, p, t) + (level === 'easy' ? rnd() * 3 : 0);
    if (v > sv) { sv = v; shot = { type: 'fire', ship: x.id, seg: t.seg, part: t.part, at: t.at }; }
  }
  // a shot also brings a wingman (formation bonus): its best shot, or else a move as the fleet would advance
  const enemiesSeen = s.ships.filter((x) => x.owner !== p && !x.dead && s.players[p].vis.includes(x.id));
  const withWing = (a) => {
    if (!a || a.type !== 'fire') return a;
    let ws = null, wv = 0;
    for (const f of wingShots(state, p, a.ship)) { const v = shotScore(s, p, f); if (v > wv) { wv = v; ws = f; } }
    if (ws) return { ...a, wing: { type: 'fire', ship: ws.ship, seg: ws.seg, part: ws.part, at: ws.at } };
    const fw = forwardDirs(s, p), wm = wingMoves(state, p, a.ship).filter((m) => fw.includes(m.path[0]));
    const w = advance(s, state, p, mine, enemiesSeen, wm, level, rnd);
    return w ? { ...a, wing: w } : a;
  };
  if (shot && sv >= 1) return withWing(shot);
  // 2. a missile at a ship it can see and reach, unless one of ours is already after it
  for (const x of mine) {
    const a = autoLaunch(state, p, x.id, null, 'best');
    if (!a || !a.target) continue;
    if (s.objs.some((o) => o.owner === p && o.target === a.target)) continue;
    if (level === 'easy' && rnd() < 0.5) continue;
    if (!rapidRefusal(state, p, a)) return a;
  }
  if (shot) return withWing(shot);   // shoot down a missile rather than nothing
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
      const moved = { ...x, pos: a.path.reduce((c, d) => step(c, d), x.pos) };
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
