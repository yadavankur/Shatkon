// The map objective: a beacon both sides want to hold.
// You score 1 at the start of your turn when one of your ships was alone on the beacon at the
// end of your previous turn, the opponent has since had a whole turn (and the flight phase)
// to contest it, and you are still alone on it. Turn order swaps every round, so the player
// who goes last in a round also goes first in the next; without the "opponent has had a
// turn" check they could step on and score before the other side ever moved.
// Holding it lights the holder up for everyone, so a stealthy ship cannot sit on it unseen.
// The first to points_to_win wins; at the turn limit the higher score wins (a tie is a draw).

import { dist } from './hex.js';
import { emit, footprint } from './state.js';

export function holders(state) {
  const o = state.rules.objective;
  if (!o) return [];
  const on = (s) => footprint(s).some((c) => dist(c, o.at) <= o.radius);
  return state.players.map((_, p) => state.ships.filter((s) => !s.dead && s.owner === p && on(s)));
}

const alone = (h, p) => h[p] && h[p].length > 0 && h.every((list, q) => q === p || !list.length);

// Call at the end of player p's turn, before the flight phase.
export function markObjective(state, p) {
  if (!state.rules.objective) return;
  state.objClock = (state.objClock || 0) + 1;
  const pl = state.players[p];
  pl.objLastEnd = state.objClock;
  pl.objHoldMark = alone(holders(state), p) ? state.objClock : null;
}

// Call at the start of player p's turn.
export function scoreObjective(state, p) {
  const o = state.rules.objective;
  if (!o || state.phase !== 'play') return;
  const h = holders(state), everyone = state.players.map((_, i) => i);
  const contested = h.filter((list) => list.length).length > 1;
  if (contested && !state.objContested) emit(state, { t: 'objective_contested', at: o.at.slice() }, everyone);
  state.objContested = contested;
  const pl = state.players[p];
  const others = state.players.filter((_, q) => q !== p);
  const heldThrough = pl.objHoldMark != null && others.every((x) => (x.objLastEnd || 0) > pl.objHoldMark);
  if (!alone(h, p) || !heldThrough) return;
  pl.objHoldMark = null;
  pl.score = (pl.score || 0) + 1;
  if (o.reveals) for (const s of h[p]) state.lit[s.id] = state.round + 1;
  emit(state, { t: 'objective_scored', player: p, score: pl.score, toWin: o.toWin, ships: h[p].map((s) => s.id) }, everyone);
  if (o.toWin && pl.score >= o.toWin) {
    state.phase = 'over';
    state.winner = p;
    emit(state, { t: 'game_over', winner: p, by: 'objective' }, everyone);
  }
}

// Turn limit reached: the objective score decides, if the map says so.
export function limitWinner(state) {
  const o = state.rules.objective;
  if (!o || !o.scoreAtLimit) return 'draw';
  const sc = state.players.map((x) => x.score || 0);
  return sc[0] === sc[1] ? 'draw' : sc[0] > sc[1] ? 0 : 1;
}
