// The map objective: a beacon both sides want to hold.
// At the start of your turn, if one of your ships touches the beacon area and no enemy ship
// does, you score a point: you have to hold it through the opponent's whole turn and the
// flight phase, so neither seat gets the last word. Holding it lights the holder up for everyone, so a
// stealthy ship cannot sit on it unseen. The first to points_to_win wins; at the turn
// limit the higher score wins (a tie is a draw).

import { dist } from './hex.js';
import { emit, footprint } from './state.js';

export function holders(state) {
  const o = state.rules.objective;
  if (!o) return [];
  const on = (s) => footprint(s).some((c) => dist(c, o.at) <= o.radius);
  return state.players.map((_, p) => state.ships.filter((s) => !s.dead && s.owner === p && on(s)));
}

export function scoreObjective(state, p) {
  const o = state.rules.objective;
  if (!o || state.phase !== 'play') return;
  const h = holders(state), present = h.map((list) => list.length > 0);
  const everyone = state.players.map((_, i) => i);
  if (!present[p]) return;
  if (present.some((x, q) => x && q !== p)) { emit(state, { t: 'objective_contested', at: o.at.slice() }, everyone); return; }
  const pl = state.players[p];
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
