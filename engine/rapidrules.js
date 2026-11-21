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

import { DIRS } from './hex.js';
import { cellsOf } from './state.js';

export const isRapid = (state) => !!(state && state.rules && state.rules.rapid);

// +1: this side's home is the south edge (it advances north, r falling). -1: the north edge.
// Worked out once at the start from where each side's ships are deployed, and kept in state.rapid.
export function homeSign(state, p) {
  const r = state.rapid && state.rapid.sign;
  if (r && r[p]) return r[p];
  const mine = state.ships.filter((s) => s.owner === p);
  const avg = mine.reduce((n, s) => n + s.pos[1], 0) / Math.max(1, mine.length);
  return avg >= 0 ? 1 : -1;
}

// The directions that gain ground for this side: on a pointy-top board with homes on the north and
// south edges, two of the six (north-east and north-west for the south side).
export function forwardDirs(state, p) {
  const h = homeSign(state, p);
  return DIRS.map((d, i) => (d[1] === -h ? i : -1)).filter((i) => i >= 0);
}

// How many rows forward of its own home edge a hex is (0 on the home edge).
export function rowsForward(state, p, c) {
  return state.rules.board.radius - homeSign(state, p) * c[1];
}

// A ship is past the line when any of its segments is at least `line` rows forward of its home edge.
// (line 12 on a radius-12 board is the centre row: 50%.)
export function pastLine(state, ship) {
  if (!ship || ship.dead) return false;
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

// The opening: from the start until the first laser shot or missile launch (either side).
export const inOpening = (state) => !!(state.rapid && state.rapid.opening);

// How many hexes a move may go this tick: 2 during the opening (setting stride 'opening', the default),
// 2 always ('always'), or 1 ('off').
export function stride(state) {
  const m = state.rules.rapid.stride;
  return m === 'always' || (m !== 'off' && inOpening(state)) ? 2 : 1;
}

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
