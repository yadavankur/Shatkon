// The flight phase: after both players have acted, everything that flies moves at once.
// The phase is cut into ticks so a fast missile and a slow drone interleave fairly.

import { key, step, turnDiff, turnToward, dirToward } from './hex.js';
import { num, geom, rand, shipById, objById, occupancy, gap, nearestCell, emit } from './state.js';
import { refreshSight, signatureOf, networkSees } from './detect.js';
import { explode, removeObj, checkWin } from './damage.js';

const seekerSees = (state, o, m, t) => gap(o, t) <= num(m.seeker_range) + signatureOf(state, t);

// One hex of movement for one object. Returns the turns it has left this tick.
function stepObj(state, o, m, turnsLeft) {
  const g = geom(state.rules), p = o.owner, occ = occupancy(state);
  if (m.patrol) {
    const ok = (d) => {
      const h = step(o.pos, d), oc = occ.get(key(h));
      return g.inside(h) && !g.blockMove.has(key(h)) && !(oc && oc.ship.owner === p);
    };
    if (m.patrol === 'circle') o.dir = (o.dir + 1) % 6;
    else if (m.patrol === 'random') {
      const opts = [o.dir, (o.dir + 1) % 6, (o.dir + 5) % 6].filter(ok);
      o.dir = opts.length ? opts[Math.floor(rand(state) * opts.length)] : (o.dir + 3) % 6;
    }
    if (!ok(o.dir)) o.dir = (o.dir + 3) % 6;
    if (!ok(o.dir)) return turnsLeft;
  } else {
    let goal = null;
    if (o.lock) {
      const t = shipById(state, o.target), src = o.src && shipById(state, o.src);
      if (t && (seekerSees(state, o, m, t) || (src && networkSees(state, src, t)))) goal = nearestCell(t, o.pos);
      else { o.lock = false; o.target = null; }
    }
    if (o.route.length) o.dir = o.route.shift();
    else {
      if (!goal && num(m.seeker_range)) { // nothing locked: take the nearest enemy its own seeker can find
        let best = null, bd = Infinity;
        for (const s of state.ships) {
          if (s.dead || s.owner === p || !seekerSees(state, o, m, s)) continue;
          const d = gap(o, s);
          if (d < bd) { bd = d; best = s; }
        }
        if (best) { o.target = best.id; o.lock = true; goal = nearestCell(best, o.pos); }
      }
      if (goal) {
        const nd = turnToward(o.dir, dirToward(o.pos, goal), turnsLeft);
        turnsLeft -= Math.abs(turnDiff(o.dir, nd));
        o.dir = nd;
      }
    }
  }
  const np = step(o.pos, o.dir), k = key(np);
  if (!g.inside(np) || g.blockMove.has(k)) {
    removeObj(state, o);
    emit(state, { t: 'obj_lost', obj: o.id, kind: o.kind, why: g.inside(np) ? 'hit an asteroid' : 'left the board' }, [p]);
    return turnsLeft;
  }
  const oc = occ.get(k);
  const passes = oc && oc.ship.owner === p && state.rules.ownMissilesPass;
  if (oc && !passes && (oc.ship.owner !== p || state.rules.friendlyFire)) { explode(state, o, { ship: oc.ship, seg: oc.seg }); return turnsLeft; }
  o.pos = np;
  return turnsLeft;
}

// A snapshot of every object after each tick, so screens can replay the flight hex by hex.
function flightFrame(state) {
  return {
    objs: state.objs.map((o) => ({ id: o.id, kind: o.kind, owner: o.owner, pos: o.pos.slice(), dir: o.dir })),
    ev: state.events.length,
    vis: state.players.map((p) => p.vis.slice()),
  };
}

export function runFlight(state) {
  const T = state.rules.ticks;
  for (const o of state.objs) o.last = o.pos.slice();   // where each thing started this flight, for drawing trails
  state.flight = [flightFrame(state)];
  for (let t = 0; t < T && state.phase === 'play'; t++) {
    for (const id of state.objs.map((o) => o.id)) {
      const o = objById(state, id);
      if (!o) continue;
      const m = state.rules.munitions[o.kind], sp = num(m.speed);
      const n = Math.floor((sp * (t + 1)) / T) - Math.floor((sp * t) / T);
      let turns = num(m.turn_rate, 1);
      for (let i = 0; i < n && objById(state, id); i++) turns = stepObj(state, o, m, turns);
    }
    refreshSight(state);
    checkWin(state);
    state.flight.push(flightFrame(state));
  }
  // end of the round: fuel burns down, shields come back, point defence reloads
  for (const o of state.objs.slice()) {
    if (o.fuel === null) continue;
    if (--o.fuel <= 0) { removeObj(state, o); emit(state, { t: 'obj_lost', obj: o.id, kind: o.kind, why: 'ran out of fuel' }, [o.owner]); }
  }
  for (const s of state.ships) {
    if (s.dead) continue;
    s.pd = 0;
    for (const sg of s.segs) if (!sg.wrecked) for (const part of sg.parts) {
      const c = state.rules.parts[part.t];
      // shields come back after `recharge_every` rounds (default 1), and not at all in a round they were hit if `recharge_if_unhit`
      if (c.recharges && part.hp < c.hp) {
        part.down = (part.down || 0) + 1;
        const wait = num(c.recharge_every, 1), hitNow = part.hitRound === state.round;
        if (part.down >= wait && !(c.recharge_if_unhit && hitNow)) { part.hp = c.hp; part.down = 0; }
      }
    }
  }
}
