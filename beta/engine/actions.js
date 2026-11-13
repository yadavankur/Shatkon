// What a player can do on their turn: move, fire, launch, scan, detonate.
// Each function checks the action is allowed, then changes the state.

import { key, add, step, dist, line, turnDiff, dirToward } from './hex.js';
import { no, num, geom, current, shipById, objById, segHex, footprint, workingParts, sumAttr, occupancy, gap, emit, makeObj, nearestCell } from './state.js';
import { refreshSight, networkSees, addFlare, visibleTo, netMoved, fuzzAt } from './detect.js';
import { scanRadii } from './scan.js';
import { applyHits, explode, removeObj } from './damage.js';

const foe = (state, p) => state.players.map((_, i) => i).filter((i) => i !== p);

function ownShip(state, id, p) {
  const ship = shipById(state, id);
  if (!ship) no('there is no such ship');
  if (ship.owner !== p) no('that ship is not yours');
  return ship;
}
function pay(state, p, what) {
  const pl = state.players[p], cost = state.rules.cost[what];
  if (pl.cp < cost) no('not enough command points');
  return () => { pl.cp -= cost; };
}

// ---- thrust: one pool for the whole fleet ----
export const thrustIncome = (state, p) => state.ships.filter((s) => !s.dead && s.owner === p).reduce((n, s) => n + sumAttr(state, s, 'thrust'), 0);
export const fleetSegs = (state, p) => state.ships.filter((s) => !s.dead && s.owner === p).reduce((n, s) => n + s.segs.length, 0);
export function moveCap(state, p) {
  const segs = fleetSegs(state, p);
  return segs ? Math.floor(thrustIncome(state, p) / segs) + state.rules.move.capBonus : 0;
}

// Does this small object go off when this ship touches it?
function touches(state, o, ship) {
  const m = state.rules.munitions[o.kind];
  if (!num(m.hits)) return false;
  if (!num(m.speed)) return state.rules.friendlyFire || o.owner !== ship.owner; // mines are dumb
  return o.owner !== ship.owner;
}

export function doMove(state, a) {
  const p = current(state), pl = state.players[p], ship = ownShip(state, a.ship, p), spend = pay(state, p, 'move');
  if (!pl.canMove) no('the fleet does not have enough thrust banked to move this turn');
  const path = a.path;
  if (!Array.isArray(path) || !path.length || path.some((d) => !(Number.isInteger(d) && d >= 0 && d < 6))) no('that path cannot be read');
  const n = ship.segs.length, cap = moveCap(state, p), done = pl.moved[ship.id] || 0;
  if (done + path.length > cap) no('a ship can move at most ' + cap + ' hexes a turn');
  if (path.length * n > pl.thrust) no('not enough thrust');
  // refuse paths through things the player knows about
  const g = geom(state.rules), occ = occupancy(state), vis = new Set(pl.vis);
  let pos = ship.pos;
  for (const d of path) {
    pos = step(pos, d);
    for (const sg of ship.segs) {
      const h = add(pos, sg.off), k = key(h);
      if (!g.inside(h)) no('that would leave the board');
      if (g.blockMove.has(k)) no('an asteroid is in the way');
      const o = occ.get(k);
      if (o && o.ship !== ship && (o.ship.owner === p || vis.has(o.ship.id))) no('another ship is in the way');
    }
  }
  spend();
  const from = ship.pos.slice();
  let taken = 0;
  for (const d of path) {
    const np = step(ship.pos, d), occ2 = occupancy(state);
    let bump = null;
    for (const sg of ship.segs) { const o = occ2.get(key(add(np, sg.off))); if (o && o.ship !== ship) { bump = o.ship; break; } }
    if (bump) { // ran into something it could not see: both are revealed, the move stops
      state.lit[bump.id] = state.round + 1; state.lit[ship.id] = state.round + 1;
      emit(state, { t: 'bump', ship: ship.id, into: bump.id }, state.players.map((_, i) => i));
      break;
    }
    ship.pos = np; taken++;
    let boom = false;
    for (let i = 0; i < ship.segs.length && !ship.dead; i++) {
      const h = segHex(ship, i);
      for (const o of state.objs.slice()) {
        if (!objById(state, o.id) || o.pos[0] !== h[0] || o.pos[1] !== h[1] || !touches(state, o, ship)) continue;
        explode(state, o, { ship, seg: i }); boom = true;
        if (ship.dead) break;
      }
    }
    refreshSight(state);
    if (boom || ship.dead) break;
  }
  pl.thrust -= taken * n;
  pl.moved[ship.id] = done + taken;
  const seen = [p].concat(foe(state, p).filter((q) => visibleTo(state, q).has(ship.id)));
  emit(state, { t: 'move', ship: ship.id, from, to: ship.pos.slice(), steps: taken }, seen);
}

// The enemy thing on a hex: a ship segment that is still standing, or a small object.
function enemyAt(state, at, p) {
  const o = occupancy(state).get(key(at));
  if (o && o.ship.owner !== p && !o.ship.segs[o.seg].wrecked) return o.ship;
  return state.objs.find((x) => x.owner !== p && x.pos[0] === at[0] && x.pos[1] === at[1]) || null;
}

export function doFire(state, a) {
  const p = current(state), ship = ownShip(state, a.ship, p), spend = pay(state, p, 'fire');
  const sg = ship.segs[a.seg], part = sg && !sg.wrecked ? sg.parts[a.part] : null, c = part && state.rules.parts[part.t];
  if (!part || part.hp <= 0 || !num(c.range) || !num(c.hits)) no('there is no working beam weapon there');
  const used = a.seg + '.' + a.part;
  if (ship.used[used]) no('that weapon has already fired this turn');
  if (!Array.isArray(a.at)) no('no target given');
  const src = segHex(ship, a.seg), d = dist(src, a.at);
  if (d < 1 || d > c.range) no('the target is out of range');
  const target = enemyAt(state, a.at, p);
  if (!target) no('there is nothing to shoot at on that hex');
  if (!networkSees(state, ship, target)) no('this ship cannot see that target');
  const g = geom(state.rules), cells = line(src, a.at);
  for (let i = 1; i < cells.length - 1; i++) if (g.blockSight.has(key(cells[i]))) no('an asteroid blocks the line of fire');
  spend(); ship.used[used] = 1;
  // the beam stops at the first thing it meets, even something the shooter could not see
  const occ = occupancy(state);
  let hitShip = null, hitSeg = -1, hitObj = null, hd = 0;
  for (let i = 1; i < cells.length && !hd; i++) {
    const o = occ.get(key(cells[i]));
    if (o && o.ship !== ship && !o.ship.segs[o.seg].wrecked) { hitShip = o.ship; hitSeg = o.seg; hd = i; break; }
    const ob = state.objs.find((x) => x.pos[0] === cells[i][0] && x.pos[1] === cells[i][1] && !(x.owner === p && state.rules.beamsPassOwnMunitions && num(state.rules.munitions[x.kind].speed) > 0)   // own mines still stop it
      && !(state.rules.beamsPassMines && !num(state.rules.munitions[x.kind].speed)));
    if (ob) { hitObj = ob; hd = i; }
  }
  let hits = Math.max(0, c.hits - (c.loses_1_hit_every ? Math.floor((hd - 1) / c.loses_1_hit_every) : 0));
  if (hits > 0 && state.rules.det.attackRun && netMoved(state, ship) >= 1) hits += state.rules.det.attackRun;
  addFlare(state, ship, hd && hits > 0 ? 'beamHit' : 'fire');
  const end = cells[hd || cells.length - 1].slice();
  emit(state, { t: 'fire', ship: ship.id, at: a.at.slice(), hits, from: src.slice(), end }, [p]);
  // anyone who can see the shooter sees the beam
  state.players.forEach((_, q) => { if (q !== p && visibleTo(state, q).has(ship.id)) emit(state, { t: 'enemy_fire', ship: ship.id, from: src.slice(), end, hits }, [q]); });
  if (hitShip && hits > 0) applyHits(state, hitShip, hitSeg, hits, part.t);
  else if (hitObj && hits > 0) { removeObj(state, hitObj); emit(state, { t: 'obj_destroyed', kind: hitObj.kind, at: hitObj.pos.slice() }, state.players.map((_, i) => i)); }
}

export function doLaunch(state, a) {
  const p = current(state), ship = ownShip(state, a.ship, p), spend = pay(state, p, 'launch');
  const m = state.rules.munitions[a.kind];
  if (!m || !num(m.speed) || m.setup_only) no('that cannot be launched');
  if (!(ship.load[a.kind] > 0)) no('this ship has none of those left');
  const L = workingParts(state, ship).find((x) => x.c.launches && !ship.used[x.si + '.' + x.pi]);
  if (!L) no('this ship has no launcher ready');
  const g = geom(state.rules), start = a.start;
  if (!Array.isArray(start) || !g.inside(start) || g.blockMove.has(key(start)) || occupancy(state).has(key(start))) no('it cannot be launched into that hex');
  if (!footprint(ship).some((h) => dist(h, start) === 1)) no('it must be launched into a hex next to the ship');
  const route = Array.isArray(a.route) ? a.route : [];
  if (route.some((d) => !(Number.isInteger(d) && d >= 0 && d < 6))) no('that route cannot be read');
  if (route.length > num(m.speed) * num(m.fuel, 1)) no('that route is longer than its fuel allows');
  const tr = num(m.turn_rate, 1);
  for (let i = 1; i < route.length; i++) if (Math.abs(turnDiff(route[i - 1], route[i])) > tr) no('that route turns too sharply');
  let target = null;
  if (a.target) {
    const t = shipById(state, a.target);
    if (!t || t.owner === p) no('that is not an enemy ship');
    if (!num(m.seeker_range)) no('that munition cannot lock on');
    if (!networkSees(state, ship, t)) no('this ship cannot see that target');
    target = t;
  }
  spend(); ship.used[L.si + '.' + L.pi] = 1; ship.load[a.kind]--;
  const dir = route.length ? route[0] : target ? dirToward(start, nearestCell(target, start)) : dirToward(nearestCell(ship, start), start);
  const obj = makeObj(state, a.kind, p, start, dir, { target: target ? target.id : null, lock: !!target, route: route.slice(), src: ship.id });
  state.objs.push(obj);
  addFlare(state, ship, 'launch');
  emit(state, { t: 'launch', ship: ship.id, kind: a.kind, obj: obj.id, target: obj.target }, [p]);
}

// An active scan around one of your ships. Everything inside the clear ring is revealed
// (with a full readout of enemy ships) until the end of next round; the faint ring only
// gives fuzzy contacts. Once per ship per turn, only after it has moved, and it flares the ship.
export function doScan(state, a) {
  const p = current(state), pl = state.players[p], spend = pay(state, p, 'scan');
  const sh = ownShip(state, a.ship, p);
  if (sh.used.scan) no('this ship has already scanned this turn');
  if (netMoved(state, sh) < 1) no('move this ship first: a ship can only scan on a turn it has moved');
  const [r1, r2] = scanRadii(state, sh);
  spend();
  sh.used.scan = 1;
  pl.revealed = pl.revealed || {};
  pl.pings = pl.pings || {};
  let found = 0, pinged = 0;
  for (const t of state.ships.filter((x) => !x.dead && x.owner !== p).concat(state.objs.filter((x) => x.owner !== p))) {
    const d = gap(sh, t);
    if (d <= r1) {
      pl.revealed[t.id] = state.round + 1;
      found++;
      if (t.segs) {
        const intel = (pl.intel[t.id] = pl.intel[t.id] || {});
        t.segs.forEach((g, i) => { intel[i] = { round: state.round, wrecked: g.wrecked, parts: g.parts.map((x) => ({ t: x.t, hp: x.hp })) }; });
      }
    } else if (d <= r2) {
      pinged++;
      pl.pings[t.id] = { round: state.round, at: fuzzAt(state, p, t), r: state.rules.det.fuzzR, kind: t.segs ? 'ship' : t.kind };
    }
  }
  addFlare(state, sh, 'scan');
  emit(state, { t: 'scan', ship: sh.id, r1, r2, found, pinged, cells: footprint(sh) }, [p]);
}

export function doDetonate(state, a) {
  const p = current(state), spend = pay(state, p, 'detonate');
  const o = objById(state, a.obj);
  if (!o || o.owner !== p) no('that is not yours to detonate');
  if (!state.rules.munitions[o.kind].remote_detonate) no('that cannot be detonated from afar');
  spend();
  explode(state, o, null);
}
