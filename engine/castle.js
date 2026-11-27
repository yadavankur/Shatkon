// Free castle (Ankur, 28 Nov 2026): once, before its first action of the game, a side may secretly
// move its flagship to any legal spot in its own home zone. It costs nothing and the other side is
// told nothing. If one of its own ships is in the way, that ship takes the flagship's old spot (a swap).
// Everything else stays where the board file puts it. Why: every board's start is fixed and public, so
// the enemy flagship was easy to find. Evidence: docs/design/secret-starts-count.md.
//
// On or off: a board's `map: castle: true|false` wins; otherwise the world file's master default for
// the kind of game (`modes:` skirmish, rapid, story, experiments). Off when neither says.
// When:
//   turn-based games: in round 1, before the side's first action (it can't be undone)
//   rapid games:      on the first tick, carried by that tick's action ({ ..., castle: [q, r] });
//                     both sides' castles happen together, before anything else in the tick
// Refused once any enemy has seen the flagship, so a side can't dodge a shot it has already drawn.

import { key, add, inHexagon, EDGE } from './hex.js';
import { no, emit, shipById } from './state.js';
import { refreshSight } from './detect.js';

export function modeOf(rules) {
  if (rules.campaign) return 'story';
  if (rules.rapid) return rules.rapid.experiments === 'on' || rules.rapid.experiments === true ? 'experiments' : 'rapid';
  return 'skirmish';
}
export function castleOn(rules) {
  if (typeof rules.castleBoard === 'boolean') return rules.castleBoard;
  const m = (rules.modes || {})[modeOf(rules)] || {};
  return m.castle === true;
}

const flagshipOf = (state, p) => state.ships.find((x) => x.owner === p && x.flagship && !x.dead);
const zoneOf = (state, p) => {
  const fl = state.rules.fleets[p];
  return fl && state.rules.zones.find((z) => z.name.indexOf(fl.name) === 0);
};

// Where side p's flagship may castle to: [{ at, swap }] (swap: the id of the ship that takes its old spot).
export function castleSpots(state, p) {
  const R = state.rules, f = flagshipOf(state, p), zone = zoneOf(state, p);
  if (!f || !zone) return [];
  const rad = R.board.radius;
  const blocked = new Set();
  for (const tr of R.terrain) if ((R.terrainTypes[tr.type] || {}).blocks_movement) tr.cells.forEach((c) => blocked.add(key(c)));
  for (const o of state.objs) blocked.add(key(o.pos));
  const inZone = (c) => inHexagon(c, rad) && !blocked.has(key(c)) && EDGE[zone.edge](c, rad) < zone.depth;
  const cellsAt = (x, at) => x.segs.map((g) => key(add(at, g.off)));
  const others = state.ships.filter((x) => !x.dead && x.id !== f.id);
  const owner = new Map();
  for (const x of others) for (const k of cellsAt(x, x.pos)) owner.set(k, x);
  const out = [];
  for (let q = -rad; q <= rad; q++) for (let r = -rad; r <= rad; r++) {
    const at = [q, r];
    if (at[0] === f.pos[0] && at[1] === f.pos[1]) continue;
    const mine = f.segs.map((g) => add(at, g.off));
    if (!mine.every(inZone)) continue;
    const hit = new Set(mine.map(key).map((k) => owner.get(k)).filter(Boolean));
    if (!hit.size) { out.push({ at, swap: null }); continue; }
    if (hit.size > 1) continue;
    const [x] = hit;
    if (x.owner !== p) continue;
    // the swap: x takes the flagship's old anchor, clear of the flagship's new spot and every other ship
    const taken = new Set(mine.map(key));
    for (const y of others) if (y.id !== x.id) cellsAt(y, y.pos).forEach((k) => taken.add(k));
    const theirs = x.segs.map((g) => add(f.pos, g.off));
    if (theirs.every((c) => inZone(c) && !taken.has(key(c)))) out.push({ at, swap: x.id });
  }
  return out;
}

// Why side p can't castle now (null when it can, ignoring the spot).
export function castleBlocked(state, p) {
  if (!castleOn(state.rules)) return 'castling is off on this board';
  if (state.phase !== 'play') return 'the game is over';
  if ((state.castle || {})[p]) return 'you have already castled';
  if (state.rules.rapid ? (state.rapid && state.rapid.ticks.length > 0) : state.round !== 1) return 'castling is only at the very start';
  // turn-based: closed once the side has done anything (an earlier turn, or an action this turn)
  if (!state.rules.rapid && (state.history.some((h) => h.player === p) || (state.order[state.turn] === p && state.pending.length))) return 'castling is only before your first action';
  const f = flagshipOf(state, p);
  if (!f) return 'no flagship';
  if (state.players.some((pl, i) => i !== p && ((pl.vis || []).includes(f.id) || (pl.seen || {})[f.id]))) return 'the enemy has already seen your flagship';
  return null;
}
export function castleRefusal(state, p, at) {
  const why = castleBlocked(state, p);
  if (why) return why;
  if (!Array.isArray(at) || !castleSpots(state, p).some((s) => s.at[0] === at[0] && s.at[1] === at[1])) return 'your flagship cannot start there';
  return null;
}
// Move side p's flagship (and the swapped ship). Only side p is told.
export function doCastle(state, p, at) {
  const why = castleRefusal(state, p, at);
  if (why) no(why);
  const f = flagshipOf(state, p), spot = castleSpots(state, p).find((s) => s.at[0] === at[0] && s.at[1] === at[1]);
  const from = f.pos.slice();
  if (spot.swap) { const x = shipById(state, spot.swap); x.pos = from.slice(); x.turnStart = x.pos.slice(); }
  f.pos = at.slice(); f.turnStart = f.pos.slice();
  state.castle = { ...(state.castle || {}), [p]: 'done' };
  emit(state, { t: 'castle', ship: f.id, from, to: at.slice(), swap: spot.swap }, [p]);
  refreshSight(state);
}

// A copy of the game with side p castled (rapid screens show it while the first tick is being chosen;
// the real castle travels with that tick's action).
export function castledCopy(state, p, at) {
  const { rules, ...r } = state, s = structuredClone(r);
  s.rules = rules; s.events = [];
  doCastle(s, p, at);
  return s;
}

// The computer's castle: where its flagship should start, by how it plays. Seeded from the game, so the
// same game always castles the same way. style: 'forward' | 'back' | 'any'. Returns [q, r] or null (stay).
export function castlePick(state, p, style = 'any', rand = Math.random) {
  if (castleBlocked(state, p)) return null;
  const spots = castleSpots(state, p), zone = zoneOf(state, p), rad = state.rules.board.radius;
  if (!spots.length) return null;
  const row = (at) => EDGE[zone.edge](at, rad);
  let pool = spots;
  if (style !== 'any') {
    const rows = spots.map((s) => row(s.at)), best = style === 'forward' ? Math.max(...rows) : Math.min(...rows);
    pool = spots.filter((s) => (style === 'forward' ? row(s.at) >= best - 1 : row(s.at) <= best + 1));
  }
  // one in four times, stay put: the board's own start is still a fair guess, never a certainty
  if (rand() < 0.25) return null;
  return pool[Math.floor(rand() * pool.length)].at.slice();
}
