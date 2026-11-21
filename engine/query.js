// Questions a screen or an AI asks before acting: where can this ship go,
// what can it shoot, what can it lock on to. These use only what the player knows.

import { key, add, step, dist, line, sightLine, turnToward, dirToward } from './hex.js';
import { deadInWater, geom, current, shipById, objById, segHex, footprint, workingParts, occupancy, num, cellsOf, nearestCell, maxAttr } from './state.js';
import { networkSees, netMoved } from './detect.js';
import { movesLeft, shipWeight, beamHits, beamHitsAt, knownTo, ownMove, hasOwnDrive, burnLeft } from './actions.js';
import { dirAllowed, scanAllowed, shootRange, isMoving } from './rapidrules.js';

// Every hex the ship's centre can reach this turn, with the path to get there.
export function reach(state, shipId) {
  const p = current(state), pl = state.players[p], ship = shipById(state, shipId);
  if (!ship || ship.owner !== p || pl.cp < state.rules.cost.move || deadInWater(state, ship)) return [];
  const max = movesLeft(state, ship);
  if (max <= 0) return [];
  const g = geom(state.rules), occ = occupancy(state), vis = new Set(pl.vis);
  // things the player knows would blow up under the ship: their own mines, and enemy objects in view
  const danger = new Set(state.objs.filter((o) => {
    const m = state.rules.munitions[o.kind];
    if (!num(m.hits)) return false;
    return o.owner === p ? !num(m.speed) && state.rules.friendlyFire : vis.has(o.id);
  }).map((o) => key(o.pos)));
  const free = (pos) => ship.segs.every((sg) => {
    const h = add(pos, sg.off), k = key(h), o = occ.get(k);
    return g.inside(h) && !g.blockMove.has(k) && !danger.has(k) && !(o && o.ship !== ship && (o.ship.owner === p || vis.has(o.ship.id)));
  });
  const seen = new Map([[key(ship.pos), []]]);
  let edge = [ship.pos];
  for (let i = 0; i < max; i++) {
    const next = [];
    for (const pos of edge) for (let d = 0; d < 6; d++) {
      const np = step(pos, d), k = key(np);
      if (seen.has(k) || !free(np)) continue;
      seen.set(k, seen.get(key(pos)).concat(d));
      next.push(np);
    }
    edge = next;
  }
  seen.delete(key(ship.pos));
  const out = [...seen].map(([k, path]) => ({ at: k.split(',').map(Number), path }));
  // rapid mode: forward only until one of this side's ships is past the line
  return state.rules.rapid ? out.filter((x) => x.path.every((d) => dirAllowed(state, ship, d))) : out;
}

// Every shot available to a ship right now: which weapon, which hex, how many hits.
export function beamTargets(state, shipId) {
  const p = current(state), ship = shipById(state, shipId), out = [];
  if (!ship || ship.owner !== p || state.players[p].cp < state.rules.cost.fire) return out;
  const g = geom(state.rules);
  const enemies = state.ships.filter((s) => !s.dead && s.owner !== p).concat(state.objs.filter((o) => o.owner !== p)).filter((t) => networkSees(state, ship, t));
  const occ = occupancy(state);
  for (const w of workingParts(state, ship)) {
    if (!num(w.c.range) || !num(w.c.hits) || ship.used[w.si + '.' + w.pi]) continue;
    const src = segHex(ship, w.si);
    for (const t of enemies) cellsOf(t).forEach((c, i) => {
      if (t.segs && t.segs[i].wrecked) return;
      const d = dist(src, c);
      if (d < 1 || d > w.c.range) return;
      if (shootRange(state) && isMoving(state, t) && d > shootRange(state)) return;   // rapid mode: missiles only up close
      const cells = sightLine(src, c, (h) => g.blockSight.has(key(h)));
      if (!cells) return;
      // never offer a shot whose beam would hit one of your own ships first
      for (let j = 1; j < cells.length - 1; j++) { const o = occ.get(key(cells[j])); if (o && o.ship !== ship && o.ship.owner === p && !o.ship.segs[o.seg].wrecked) return; }
      let hits = beamHits(state, ship, w.c, d);
      if (t.segs && d > (maxAttr(state, t, 'evades_beyond') || Infinity)) hits = 0;   // too nimble to hit from this far
      if (hits > 0) out.push({ seg: w.si, part: w.pi, weapon: w.p.t, at: c, target: t.id, hits });
    });
  }
  return out;
}

// What a laser shot would stop on, without firing it (the play screen's friendly-fire warning).
// Mirrors doFire's walk along the beam: the first ship segment or object it meets, by the same rules
// (wrecked segments and nimble ships are skipped, objects that beams pass are ignored). Only the
// shooter's own objects are reported by the caller, so nothing hidden is given away.
export function beamStop(state, a) {
  const ship = shipById(state, a.ship);
  if (!ship || !Array.isArray(a.at)) return null;
  const p = ship.owner, src = segHex(ship, a.seg), g = geom(state.rules);
  const cells = sightLine(src, a.at, (c) => g.blockSight.has(key(c)));
  if (!cells) return null;
  const occ = occupancy(state), R = state.rules;
  const target = state.ships.find((s) => !s.dead && s.owner !== p && cellsOf(s).some((c) => c[0] === a.at[0] && c[1] === a.at[1]))
    || state.objs.find((o) => o.pos[0] === a.at[0] && o.pos[1] === a.at[1]);
  for (let i = 1; i < cells.length; i++) {
    const o = occ.get(key(cells[i]));
    if (o && o.ship !== ship && !o.ship.segs[o.seg].wrecked && !(i > (maxAttr(state, o.ship, 'evades_beyond') || Infinity))) return { ship: o.ship.id, owner: o.ship.owner, at: cells[i], path: cells.slice(0, i + 1) };
    const ob = state.objs.find((x) => x.pos[0] === cells[i][0] && x.pos[1] === cells[i][1] && !(x.owner === p && R.beamsPassOwnMunitions && num(R.munitions[x.kind].speed) > 0)
      && !(R.beamsPassMines && !num(R.munitions[x.kind].speed)) && !(R.munitions[x.kind].beams_pass === true && x !== target));
    if (ob) return { obj: ob.id, kind: ob.kind, owner: ob.owner, at: cells[i], path: cells.slice(0, i + 1) };
  }
  return null;
}

// ---------- what the board shows to explain the rules while you play ----------
// All three use only what the current player can see: hidden ships never block or show.

// Where this ship's lasers can reach right now and how hard they hit there (every hex, not only enemy
// ones), so the range rings explain themselves. A hex counts when one of the ship's ready lasers is in
// range, the line is clear of asteroids and of your own ships, and nothing you can see stands in front
// of it (a beam stops at the first thing it meets). runBonus: the extra hit a move first would add
// (attack run), when this ship has not moved yet this turn and still can.
//   -> null, or { cells: [{ at, hits }], range, moved, runBonus }
export function beamField(state, shipId) {
  const p = current(state), pl = state.players[p], ship = shipById(state, shipId);
  if (!ship || ship.owner !== p || pl.cp < state.rules.cost.fire) return null;
  const guns = workingParts(state, ship).filter((w) => num(w.c.range) && num(w.c.hits) && !ship.used[w.si + '.' + w.pi]);
  if (!guns.length) return null;
  const g = geom(state.rules), occ = occupancy(state), vis = new Set(pl.vis);
  const mine = new Set(footprint(ship).map(key));
  const stops = (h) => {      // something this player knows would take the beam before it goes further
    const o = occ.get(key(h));
    if (o && o.ship !== ship && !o.ship.segs[o.seg].wrecked && (o.ship.owner === p || vis.has(o.ship.id))) return true;
    return state.objs.some((x) => x.pos[0] === h[0] && x.pos[1] === h[1] && (x.owner === p || vis.has(x.id))
      && !(x.owner === p && state.rules.beamsPassOwnMunitions && num(state.rules.munitions[x.kind].speed) > 0)
      && !(state.rules.beamsPassMines && !num(state.rules.munitions[x.kind].speed))
      && state.rules.munitions[x.kind].beams_pass !== true);
  };
  const ownInWay = (h) => { const o = occ.get(key(h)); return o && o.ship !== ship && o.ship.owner === p && !o.ship.segs[o.seg].wrecked; };
  const best = new Map();
  let range = 0;
  for (const w of guns) {
    const src = segHex(ship, w.si), R = num(w.c.range);
    range = Math.max(range, R);
    for (let q = -R; q <= R; q++) for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) {
      const c = [src[0] + q, src[1] + r], k = key(c), d = dist(src, c);
      if (d < 1 || mine.has(k) || !g.inside(c)) continue;
      const cells = sightLine(src, c, (h) => g.blockSight.has(key(h)));
      if (!cells) continue;
      let blocked = false;
      for (let j = 1; j < cells.length - 1 && !blocked; j++) blocked = ownInWay(cells[j]) || stops(cells[j]);
      if (blocked || ownInWay(c)) continue;
      const hits = beamHits(state, ship, w.c, d);
      if (hits > 0 && (best.get(k) || 0) < hits) best.set(k, hits);
    }
  }
  const moved = netMoved(state, ship) >= 1, run = num(state.rules.det.attackRun);
  const canMove = reach(state, shipId).length > 0;
  return { cells: [...best].map(([k, hits]) => ({ at: k.split(',').map(Number), hits })), range, moved, runBonus: !moved && canMove && pl.cp >= state.rules.cost.fire + state.rules.cost.move ? run : 0 };
}

// How hard visible enemy ships could hit each hex on their next turn, at worst: as if each carried the
// strongest laser in the rules, stepped one hex closer and fired (with the attack-run hit). The player
// may not know what an enemy ship carries, so this is the rule, not a reading of its parts.
//   -> Map(hexKey -> hits)
export function dangerMap(state, viewer) {
  const pl = state.players[viewer], vis = new Set(pl.vis), g = geom(state.rules), out = new Map();
  let gun = null;
  for (const c of Object.values(state.rules.parts)) if (num(c.range) && num(c.hits) && (!gun || num(c.hits) > num(gun.hits))) gun = c;
  if (!gun) return out;
  const run = num(state.rules.det.attackRun), R = num(gun.range) + 1;
  for (const e of state.ships) {
    if (e.dead || e.owner === viewer || !vis.has(e.id)) continue;
    for (const src of footprint(e)) for (let q = -R; q <= R; q++) for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) {
      const c = [src[0] + q, src[1] + r], k = key(c), d = dist(src, c);
      if (d < 1 || !g.inside(c)) continue;
      const reachD = Math.max(1, d - 1);
      if (reachD > num(gun.range) || !sightLine(src, c, (h) => g.blockSight.has(key(h)))) continue;
      const hits = beamHitsAt(gun, reachD) + run;
      if (hits > 0 && (out.get(k) || 0) < hits) out.set(k, hits);
    }
  }
  return out;
}

// Where the enemy missiles this player can see are heading this round: straight along their current
// heading for one round's flight (a seeker may still turn toward a ship it finds), stopping at an
// asteroid, the board edge, or a ship this player knows is there.
//   -> [{ id, from, path, ends: 'hit' | 'edge' | 'asteroid' | 'open', hit }]
export function incoming(state, viewer) {
  const pl = state.players[viewer], vis = new Set(pl.vis), g = geom(state.rules), occ = occupancy(state), out = [];
  for (const o of state.objs) {
    const m = state.rules.munitions[o.kind];
    if (o.owner === viewer || !vis.has(o.id) || !num(m.speed) || m.patrol || o.dir == null) continue;
    let pos = o.pos, ends = 'open', hit = null;
    const path = [];
    for (let i = 0; i < num(m.speed); i++) {
      const np = step(pos, o.dir), k = key(np);
      if (!g.inside(np)) { ends = 'edge'; break; }
      if (g.blockMove.has(k)) { ends = 'asteroid'; break; }
      path.push(np); pos = np;
      const oc = occ.get(k);
      if (oc && (oc.ship.owner === viewer || vis.has(oc.ship.id)) && oc.ship.owner !== o.owner) { ends = 'hit'; hit = oc.ship.id; break; }
    }
    out.push({ id: o.id, kind: o.kind, from: o.pos.slice(), path, ends, hit, seeker: num(m.seeker_range) });
  }
  return out;
}

// What a ship could launch, where from, and which enemy ships it could lock on to.
export function launchOptions(state, shipId) {
  const p = current(state), ship = shipById(state, shipId);
  if (!ship || ship.owner !== p || (state.players[p].cp < state.rules.cost.launch && !(state.rules.salvo && ship.used.salvo))) return null;
  if (!workingParts(state, ship).some((x) => x.c.launches && !ship.used[x.si + '.' + x.pi])) return null;
  const kinds = Object.keys(ship.load).filter((k) => ship.load[k] > 0);
  if (!kinds.length) return null;
  const g = geom(state.rules), occ = occupancy(state), starts = new Map();
  for (const h of footprint(ship)) for (let d = 0; d < 6; d++) {
    const c = step(h, d), k = key(c);
    const o = occ.get(k);   // a ship this player can't see doesn't block (that would give it away)
    if (g.inside(c) && !g.blockMove.has(k) && !(o && knownTo(state, p, o.ship))) starts.set(k, c);
  }
  const locks = state.ships.filter((s) => !s.dead && s.owner !== p && networkSees(state, ship, s)).map((s) => s.id);
  return { kinds, starts: [...starts.values()], locks };
}

// A launch aimed at any hex: the missile (or drone) leaves from the launch hex nearest the aim and
// flies the straight hex line toward it, then carries straight on (and its seeker can take over).
// Returns a normal launch action ({ start, route }), or null if this ship can't launch now.
export function aimLaunch(state, shipId, kind, aim, target = null) {
  const lo = launchOptions(state, shipId), m = state.rules.munitions[kind];
  if (!lo || !m || !lo.kinds.includes(kind) || !lo.starts.length || !Array.isArray(aim)) return null;
  let start = lo.starts[0];
  for (const st of lo.starts) if (dist(st, aim) < dist(start, aim)) start = st;
  const ship = shipById(state, shipId), cells = line(start, aim), route = [];
  for (let i = 1; i < cells.length; i++) route.push(dirToward(cells[i - 1], cells[i]));
  if (!route.length) { let near = footprint(ship)[0]; for (const c of footprint(ship)) if (dist(c, start) < dist(near, start)) near = c; route.push(dirToward(near, start)); }
  const max = num(m.speed) * num(m.fuel, 1);
  return { type: 'launch', ship: shipId, kind, start, target: target && lo.locks.includes(target) ? target : null, route: route.slice(0, max) };
}

// A plain summary of what a ship can still do this turn, and why not when it cannot.
export function shipStatus(state, shipId) {
  const p = current(state), pl = state.players[p], ship = shipById(state, shipId);
  if (!ship || ship.owner !== p) return null;
  const parts = workingParts(state, ship), n = ship.segs.length;
  const beams = parts.filter((x) => num(x.c.range) && num(x.c.hits)), launchers = parts.filter((x) => x.c.launches);
  const ready = (list) => list.filter((x) => !ship.used[x.si + '.' + x.pi]).length;
  return {
    moveLeft: movesLeft(state, ship),
    costPerHex: hasOwnDrive(state, ship) ? 0 : shipWeight(state, ship),
    thrust: hasOwnDrive(state, ship) ? null : ship.thrust || 0,   // this ship's own thrust (null: it flies on its own drive)
    burnLeft: burnLeft(state, ship),   // afterburner turns left (null: no afterburner)
    beams: beams.length, beamsReady: ready(beams),
    launchers: launchers.length, launchersReady: ready(launchers),
    scanReady: !ship.used.scan && pl.cp >= state.rules.cost.scan && (state.rules.rapid ? scanAllowed(state, ship) : netMoved(state, ship) >= 1),
    scanMoved: netMoved(state, ship),
    ammo: { ...ship.load },
  };
}

// Where a missile or drone is expected to fly, using only what its owner knows.
// "o" is a real object's id, or a launch action that has not happened yet.
export function forecast(state, o) {
  const p = current(state);
  let obj = typeof o === 'string' ? objById(state, o) : null;
  if (!obj && o && o.type === 'launch') {
    const ship = shipById(state, o.ship), t = o.target && shipById(state, o.target), route = o.route || [];
    if (!ship) return null;
    obj = { kind: o.kind, owner: ship.owner, pos: o.start, target: o.target || null, lock: !!o.target, route,
      dir: route.length ? route[0] : t ? dirToward(o.start, nearestCell(t, o.start)) : dirToward(nearestCell(ship, o.start), o.start), fuel: null };
  }
  if (!obj) return null;
  const m = state.rules.munitions[obj.kind], speed = num(m.speed);
  if (!speed || m.patrol) return null;
  const g = geom(state.rules), occ = occupancy(state), pl = state.players[obj.owner], vis = new Set(pl.vis);
  const fuel = obj.fuel === null ? num(m.fuel, 1) : obj.fuel;
  const t = obj.lock && obj.target ? shipById(state, obj.target) : null;
  const goalOf = (pos) => (t && vis.has(t.id) ? nearestCell(t, pos) : null);
  let pos = obj.pos, dir = obj.dir;
  const route = obj.route.slice(), path = [];
  let ends = 'fuel', hit = null;
  for (let i = 0; i < speed * fuel; i++) {
    if (route.length) dir = route.shift();
    else { const goal = goalOf(pos); if (goal) dir = turnToward(dir, dirToward(pos, goal), num(m.turn_rate, 1)); }
    const np = step(pos, dir), k = key(np);
    if (!g.inside(np)) { ends = 'edge'; break; }
    if (g.blockMove.has(k)) { ends = 'asteroid'; break; }
    path.push(np); pos = np;
    const oc = occ.get(k);
    if (oc && (oc.ship.owner === obj.owner || vis.has(oc.ship.id))) { ends = 'hit'; hit = oc.ship.id; break; }
  }
  return { from: obj.pos.slice(), path, perRound: speed, rounds: Math.ceil(path.length / speed), ends, hit, lock: t && vis.has(t.id) ? t.id : null };
}
