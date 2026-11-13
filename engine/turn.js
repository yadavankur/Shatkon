// The turn loop: start a turn, apply one action, end a turn, run the flight phase.
// apply() never changes the state it is given; it returns a new one.

import { Illegal, no, current, emit } from './state.js';
import { refreshSight } from './detect.js';
import { checkWin } from './damage.js';
import { doMove, doFire, doLaunch, doScan, doDetonate, thrustIncome, fleetSegs } from './actions.js';
import { runFlight } from './flight.js';
import { scoreObjective, markObjective, limitWinner } from './objective.js';
import { hashState, actionText } from './codec.js';
import { afterAction, onTurnStart, checkLocked, doJoin } from './script.js';

export function startTurn(state) {
  const p = current(state), pl = state.players[p], R = state.rules;
  pl.cp = Math.min(pl.cpBank, R.cp.bankCap) + R.cp.perTurn;
  const income = thrustIncome(state, p), segs = fleetSegs(state, p);
  pl.thrust = Math.min(pl.thrustBank, income * R.move.bankTurns) + income;
  pl.canMove = segs > 0 && pl.thrust >= segs * R.move.needsAverage;
  pl.moved = {};
  for (const s of state.ships) if (s.owner === p) { s.used = {}; s.turnStart = s.pos.slice(); }
  pl.turnSeq = state.seq;       // events before this happened while the player was away
  state.pending = [];
  state.pre = hashState(state);
}

export function begin(state) {
  refreshSight(state);
  startTurn(state);
  return state;
}

function closeTurn(state, rec) {
  rec.post = hashState(state);
  state.lastTurn = rec;
  state.history.push(rec);
}

function endTurn(state) {
  const p = current(state), pl = state.players[p], R = state.rules;
  pl.cpBank = Math.min(pl.cp, R.cp.bankCap);
  pl.thrustBank = pl.thrust;
  pl.readSeq = state.seq;       // everything up to here the player has watched happen
  const rec = { round: state.round, player: p, actions: state.pending.slice(), pre: state.pre };
  markObjective(state, p);
  if (state.turn === 0) state.turn = 1;
  else {
    runFlight(state);
    if (state.phase === 'play') {
      state.round++;
      state.order = [state.order[1], state.order[0]];
      state.turn = 0;
      for (const s of state.ships) s.flares = s.flares.filter((f) => f.until >= state.round);
      for (const id of Object.keys(state.lit)) if (state.lit[id] < state.round) delete state.lit[id];
      if (state.round > R.turnLimit) {
        state.phase = 'over';
        state.winner = limitWinner(state);
        emit(state, { t: 'game_over', winner: state.winner, by: 'turn_limit' }, state.players.map((_, i) => i));
      }
    }
  }
  if (state.phase === 'play') scoreObjective(state, current(state));   // held the beacon through the other side's turn?
  if (state.phase === 'play') { refreshSight(state); startTurn(state); }
  if (state.phase === 'play' && state.script) onTurnStart(state);   // story scripts: dooms, forced orders, turn triggers
  closeTurn(state, rec);
}

const DO = { move: doMove, fire: doFire, launch: doLaunch, scan: doScan, detonate: doDetonate, graft: doJoin, dock: doJoin };

export function apply(state, action) {
  if (state.phase !== 'play') no('the game is over');
  if (!action || (action.type !== 'end' && !DO[action.type])) no('unknown action');
  const { rules, ...rest } = state;
  const s = structuredClone(rest);
  s.rules = rules;
  s.events = [];
  s.flight = null;   // the flight replay, filled in by the flight phase
  const rec = { round: s.round, player: current(s), pre: s.pre };
  if (s.script) checkLocked(s, action);
  if (action.type !== 'end') DO[action.type](s, action);
  s.pending.push(actionText(action));
  refreshSight(s);
  if (s.script && action.type !== 'end') afterAction(s);
  checkWin(s);
  if (s.phase === 'over') { rec.actions = s.pending.slice(); closeTurn(s, rec); }
  else if (action.type === 'end') endTurn(s);
  return s;
}

// Same as apply, but reports a refusal instead of throwing.
export function attempt(state, action) {
  try { return { ok: true, state: apply(state, action) }; }
  catch (e) { if (e instanceof Illegal) return { ok: false, why: e.message, state }; throw e; }
}
