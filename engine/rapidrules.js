// Rapid mode's board rules: which way is forward, where the line is, and what crossing it unlocks.
// Kept apart from engine/rapid.js (the tick loop and the computer) so actions.js and query.js can ask
// these questions without importing the whole tick loop.
//
// Rapid mode (idea from Ankur, 21 Nov 2026):
//   - both sides pick ONE action a tick; the two actions resolve together
//   - every move is exactly 1 hex
//   - until one of your ships is past the line, ships may only move forward (towards the enemy's
//     home edge), you cannot pass, and you cannot scan
//   - once one is past the line you may move any way, pass, and (by default) scan with the ships past it

import { DIRS, EDGE, HOME_POINT, dist } from './hex.js';
import { cellsOf } from './state.js';

export const isRapid = (state) => !!(state && state.rules && state.rules.rapid);

// +1: this side's home is the south edge (it advances north, r falling). -1: the north edge.
// Worked out once at the start from where each side's ships are deployed, and kept in state.rapid.
export function homeSign(state, p) {
  const r = state.rapid && state.rapid.sign;
  if (r && r[p]) return r[p];
  // the board's home zone says which edge is home (south = +1, north = -1); ships placed mid-board can't fool it
  const z = ((state.rules && state.rules.zones) || []).find((q) => q && q.name === 'player_' + (p + 1) + '_home');
  if (z && (z.edge === 'south' || z.edge === 'north')) return z.edge === 'south' ? 1 : -1;
  const mine = state.ships.filter((s) => s.owner === p);
  const avg = mine.reduce((n, s) => n + s.pos[1], 0) / Math.max(1, mine.length);
  return avg >= 0 ? 1 : -1;
}

// The directions that gain ground for this side: on a pointy-top board with homes on the north and
// south edges, two of the six (north-east and north-west for the south side).
export function forwardDirs(state, p) {
  const f = farHome(state, p);
  if (f) return DIRS.map((d, i) => (f(d) > f([0, 0]) + 1e-9 ? i : -1)).filter((i) => i >= 0);
  const h = homeSign(state, p);
  return DIRS.map((d, i) => (d[1] === -h ? i : -1)).filter((i) => i >= 0);
}

// How many rows forward of its own home edge a hex is (0 on the home edge).
export function rowsForward(state, p, c) {
  const z = farHome(state, p);
  if (z) return z(c);
  return state.rules.board.radius - homeSign(state, p) * c[1];
}

// ---------- three players (26 Nov 2026) ----------
// A game with more than two sides: homes can sit on any edge or corner, and "forward" means towards
// the centre. Two-player games never come here (their numbers stay exactly as before).
export const manySides = (state) => !!(state && state.players && state.players.length > 2);
// The home zone's edge or corner name, when it is not plain north or south.
function homeName(state, p) {
  const z = ((state.rules && state.rules.zones) || []).find((q) => q && q.name === 'player_' + (p + 1) + '_home');
  return z && EDGE[z.edge] && z.edge !== 'north' && z.edge !== 'south' ? z.edge : null;
}
// How far a hex is from this side's home, measured towards the centre (0 at home, the radius at the
// centre). Flat edges: rows from the edge. Corners: the straight-line progress from the corner towards
// the centre (halves happen). null when the home is north or south (the old sum handles those).
function farHome(state, p) {
  const name = homeName(state, p);
  if (!name) return null;
  const R = state.rules.board.radius;
  if (!/^corner_/.test(name)) return (c) => EDGE[name](c, R);
  const H = HOME_POINT[name](R), hc = [H[0], H[1], -H[0] - H[1]], hh = hc[0] * hc[0] + hc[1] * hc[1] + hc[2] * hc[2];
  return (c) => R * (1 - (c[0] * hc[0] + c[1] * hc[1] + (-c[0] - c[1]) * hc[2]) / hh);
}
// The centre ring (three-player line): a ship is past the line within this many hexes of the centre.
export const ringOf = (state) => { const v = Number(state.rules.rapid && state.rules.rapid.ring); return Number.isFinite(v) && v >= 0 ? v : 3; };
// Is side p still in the game? (three players: a side whose flagship is gone is out)
export const isOut = (state, p) => !!(state.out && state.out[p]);
// The sides still playing.
export const sidesIn = (state) => state.players.map((_, i) => i).filter((i) => !isOut(state, i));

// A ship is past the line when any of its segments is at least `line` rows forward of its home edge.
// (line 12 on a radius-12 board is the centre row: 50%.)
export function pastLine(state, ship) {
  if (!ship || ship.dead) return false;
  if (manySides(state)) {   // three players: the centre ring, or anywhere beyond the centre
    const ring = ringOf(state), R = state.rules.board.radius;
    return cellsOf(ship).some((c) => dist(c, [0, 0]) <= ring || rowsForward(state, ship.owner, c) > R);
  }
  const L = state.rules.rapid.line;
  return cellsOf(ship).some((c) => rowsForward(state, ship.owner, c) >= L);
}

// Ships only: missiles and drones never count as crossing.
export const shipsPast = (state, p) => state.ships.filter((s) => s.owner === p && !s.dead && pastLine(state, s));

// Is this side free (move any way, pass, scan)? 'holding': only while one of its ships is past the
// line. 'permanent': from the first crossing on.
export function unlocked(state, p) {
  if (shipsPast(state, p).length) return true;
  return state.rules.rapid.unlock === 'permanent' && !!(state.rapid && state.rapid.ever && state.rapid.ever[p]);
}

// The opening: from the start until the first sighting (either side has a contact on the other) or the
// first laser shot or missile launch, whichever comes first (setting openEnd 'shot': only the shot).
export const inOpening = (state) => !!(state.rapid && state.rapid.opening);

// How many hexes a move may go this tick: 2 during the opening (setting stride 'opening', the default),
// 2 always ('always'), or 1 ('off').
export function stride(state) {
  const m = state.rules.rapid.stride;
  return m === 'always' || (m !== 'off' && inOpening(state)) ? 2 : 1;
}

// Rapid mode: lasers may shoot a moving missile or drone only this close (0: any range).
export const shootRange = (state) => (state.rules.rapid ? Number(state.rules.rapid.shootRange) || 0 : 0);
// A moving munition (missile, drone), not a mine.
export const isMoving = (state, o) => !!(o && !o.segs && Number(state.rules.munitions[o.kind] && state.rules.munitions[o.kind].speed) > 0);
// Rapid mode, formation bonus: ships this close (touching, or one empty hex between) fly together.
export const wingGap = (state) => Number(state.rules.rapid && state.rules.rapid.wingGap) || 2;

// May this ship step in direction d this tick?
export function dirAllowed(state, ship, d) {
  return unlocked(state, ship.owner) || forwardDirs(state, ship.owner).includes(d);
}

// May this ship scan? scan 'past_line' (default): only ships past the line; 'unlocked': any ship once
// the side is free; 'always': any ship, any time.
export function scanAllowed(state, ship) {
  const mode = state.rules.rapid.scan;
  if (mode === 'always') return true;
  if (mode === 'unlocked') return unlocked(state, ship.owner);
  return pastLine(state, ship);
}
