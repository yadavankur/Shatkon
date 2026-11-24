// The flight phase: after both players have acted, everything that flies moves at once.
// The phase is cut into ticks so a fast missile and a slow drone interleave fairly.

import { key, step, dist, turnDiff, turnToward, dirToward } from './hex.js';
import { num, geom, rand, shipById, objById, occupancy, gap, nearestCell, emit, workingParts, segHex } from './state.js';
import { refreshSight, signatureOf, networkSees, fuzzAt } from './detect.js';
import { explode, removeObj, checkWin } from './damage.js';

const seekerSees = (state, o, m, t) => gap(o, t) <= num(m.seeker_range) + signatureOf(state, t);
// lures_missiles (a decoy emitter): a seeker that can see a ship carrying a working emitter goes for it,
// whatever it was locked on and whatever route it was given.
const isLure = (state, s) => workingParts(state, s).some((x) => x.c.lures_missiles === true);
function lureFor(state, o, m) {
  if (!num(m.seeker_range)) return null;
  let best = null, bd = Infinity;
  for (const s of state.ships) {
    if (s.dead || s.owner === o.owner || !isLure(state, s) || !seekerSees(state, o, m, s)) continue;
    const d = gap(o, s);
    if (d < bd) { bd = d; best = s; }
  }
  // experiment decoy: an enemy decoy object its seeker can see wins too
  for (const d of state.objs) {
    if (d.owner === o.owner || !(state.rules.munitions[d.kind] || {}).lures_missiles || gap(o, d) > num(m.seeker_range) + 2) continue;
    const dd = gap(o, d);
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}

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
    const lure = lureFor(state, o, m);
    if (lure && o.target !== lure.id) {
      const was = o.target;
      o.target = lure.id; o.lock = true; o.route = [];
      emit(state, { t: 'lured', obj: o.id, kind: o.kind, from: was, to: lure.id }, [p]);
    }
    if (o.lock) {
      const t = shipById(state, o.target) || objById(state, o.target), src = o.src && shipById(state, o.src);   // (a decoy object, experiment)
      if (t && (seekerSees(state, o, m, t) || (src && networkSees(state, src, t)))) goal = nearestCell(t, o.pos);
      else { o.lock = false; o.target = null; }
    }
    if (o.route.length) o.dir = o.route.shift();
    else {
      if (!goal && num(m.seeker_range)) { // nothing locked: take the nearest enemy its own seeker can find
        let best = null, bd = Infinity;
        for (const s of state.ships) {
          if (s.dead || s.owner === p || !seekerSees(state, o, m, s)) continue;
          const d = gap(o, s) - (isLure(state, s) ? 100 : 0);   // an emitter wins the choice
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
  // wrecked segments are passed, as beams pass them (world file: "shots pass through it")
  const oc0 = occ.get(k), oc = oc0 && !oc0.ship.segs[oc0.seg].wrecked ? oc0 : null;
  const passes = oc && oc.ship.owner === p && state.rules.ownMissilesPass;
  if (oc && !passes && (oc.ship.owner !== p || state.rules.friendlyFire)) { explode(state, o, { ship: oc.ship, seg: oc.seg }); return turnsLeft; }
  // experiment decoy: a missile that reaches an enemy decoy goes off on it, and both are gone
  const dec = state.objs.find((d) => d.owner !== o.owner && d.kind === 'decoy' && d.pos[0] === np[0] && d.pos[1] === np[1]);
  if (dec) { removeObj(state, dec); emit(state, { t: 'decoy_hit', obj: dec.id, by: o.id, kind: o.kind, at: np.slice() }, state.players.map((_, i) => i)); o.pos = np; explode(state, o, null); return turnsLeft; }
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

// drift (a deep mine that is "very slightly smart"): at the end of the flight phase a mine with an
// enemy ship within drift_sense hexes creeps drift hexes toward it (prefers: largest picks the ship
// with the most segments standing, otherwise the nearest). It never enters rock, a ship or another
// object, and it checks its trigger after each hex. A mine that crept and did not go off is heard:
// the ship it is creeping toward gets a faint contact (drift_quiet: true switches that off).
function driftMines(state) {
  const g = geom(state.rules);
  for (const id of state.objs.map((o) => o.id)) {
    const o = objById(state, id);
    if (!o) continue;
    const m = state.rules.munitions[o.kind], n = num(m.drift);
    if (!n || num(m.speed)) continue;
    const standing = (s) => s.segs.filter((sg) => !sg.wrecked).length;
    const near = state.ships.filter((s) => !s.dead && s.owner !== o.owner && gap(o, s) <= num(m.drift_sense, 3));
    if (!near.length) continue;
    near.sort((a, b) => (m.prefers === 'largest' ? standing(b) - standing(a) : 0) || gap(o, a) - gap(o, b) || (a.id < b.id ? -1 : 1));
    const t = near[0], trig = num(m.trigger_range);
    if (gap(o, t) <= trig) continue;   // already as close as it needs to be: it waits for a move
    let crept = false;
    for (let i = 0; i < n && objById(state, id); i++) {
      const occ = occupancy(state), goal = nearestCell(t, o.pos), here = dist(o.pos, goal);
      let best = null, bd = here;
      for (let d = 0; d < 6; d++) {
        const h = step(o.pos, d), k = key(h);
        if (!g.inside(h) || g.blockMove.has(k) || occ.has(k) || state.objs.some((x) => x.pos[0] === h[0] && x.pos[1] === h[1])) continue;
        const dd = dist(h, goal);
        if (dd < bd) { bd = dd; best = h; }
      }
      if (!best) break;
      o.pos = best; crept = true;
      // trigger: the nearest standing enemy segment now inside trigger range
      let hit = null, hd = Infinity;
      for (const s of state.ships) {
        if (s.dead || s.owner === o.owner) continue;
        s.segs.forEach((sg, si) => { if (sg.wrecked) return; const dd = dist(segHex(s, si), o.pos); if (dd <= trig && dd < hd) { hd = dd; hit = { ship: s, seg: si }; } });
      }
      if (hit) { explode(state, o, hit); break; }
    }
    if (crept && objById(state, id) && m.drift_quiet !== true) {
      const pl = state.players[t.owner];
      pl.pings = pl.pings || {};
      pl.pings[o.id] = { round: state.round, at: fuzzAt(state, t.owner, o), r: state.rules.det.fuzzR, kind: 'small' };
      emit(state, { t: 'mine_stir', near: t.id }, [t.owner]);
    }
  }
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
  if (state.phase === 'play' && state.objs.some((o) => num(state.rules.munitions[o.kind].drift))) { driftMines(state); refreshSight(state); checkWin(state); state.flight.push(flightFrame(state)); }
  // end of the round: fuel burns down, shields come back, point defence reloads
  for (const o of state.objs.slice()) {
    if (o.fuel === null) continue;
    if (--o.fuel <= 0) { removeObj(state, o); emit(state, { t: 'obj_lost', obj: o.id, kind: o.kind, why: 'ran out of fuel' }, [o.owner]); }
  }
  for (const s of state.ships) {
    if (s.dead) continue;
    // point defence reloads every round; in rapid mode a round is `scale` ticks (one tick per flight)
    if (!state.rules.rapid || state.round % state.rules.rapid.scale === 0) s.pd = 0;
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
