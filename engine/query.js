// Questions a screen or an AI asks before acting: where can this ship go,
// what can it shoot, what can it lock on to. These use only what the player knows.

import { key, add, step, dist, line, turnToward, dirToward } from './hex.js';
import { geom, current, shipById, objById, segHex, footprint, workingParts, occupancy, num, cellsOf, nearestCell } from './state.js';
import { networkSees, netMoved } from './detect.js';
import { moveCap } from './actions.js';

// Every hex the ship's centre can reach this turn, with the path to get there.
export function reach(state, shipId) {
  const p = current(state), pl = state.players[p], ship = shipById(state, shipId);
  if (!ship || ship.owner !== p || !pl.canMove || pl.cp < state.rules.cost.move) return [];
  const n = ship.segs.length;
  const max = Math.min(moveCap(state, p) - (pl.moved[ship.id] || 0), Math.floor(pl.thrust / n));
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
  return [...seen].map(([k, path]) => ({ at: k.split(',').map(Number), path }));
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
      const cells = line(src, c);
      for (let j = 1; j < cells.length - 1; j++) if (g.blockSight.has(key(cells[j]))) return;
      // never offer a shot whose beam would hit one of your own ships first
      for (let j = 1; j < cells.length - 1; j++) { const o = occ.get(key(cells[j])); if (o && o.ship !== ship && o.ship.owner === p && !o.ship.segs[o.seg].wrecked) return; }
      let hits = Math.max(0, w.c.hits - (w.c.loses_1_hit_every ? Math.floor((d - 1) / w.c.loses_1_hit_every) : 0));
      if (hits > 0 && state.rules.det.attackRun && netMoved(state, ship) >= 1) hits += state.rules.det.attackRun;
      if (hits > 0) out.push({ seg: w.si, part: w.pi, weapon: w.p.t, at: c, target: t.id, hits });
    });
  }
  return out;
}

// What a ship could launch, where from, and which enemy ships it could lock on to.
export function launchOptions(state, shipId) {
  const p = current(state), ship = shipById(state, shipId);
  if (!ship || ship.owner !== p || state.players[p].cp < state.rules.cost.launch) return null;
  if (!workingParts(state, ship).some((x) => x.c.launches && !ship.used[x.si + '.' + x.pi])) return null;
  const kinds = Object.keys(ship.load).filter((k) => ship.load[k] > 0);
  if (!kinds.length) return null;
  const g = geom(state.rules), occ = occupancy(state), starts = new Map();
  for (const h of footprint(ship)) for (let d = 0; d < 6; d++) {
    const c = step(h, d), k = key(c);
    if (g.inside(c) && !g.blockMove.has(k) && !occ.has(k)) starts.set(k, c);
  }
  const locks = state.ships.filter((s) => !s.dead && s.owner !== p && networkSees(state, ship, s)).map((s) => s.id);
  return { kinds, starts: [...starts.values()], locks };
}

// A plain summary of what a ship can still do this turn, and why not when it cannot.
export function shipStatus(state, shipId) {
  const p = current(state), pl = state.players[p], ship = shipById(state, shipId);
  if (!ship || ship.owner !== p) return null;
  const parts = workingParts(state, ship), n = ship.segs.length;
  const beams = parts.filter((x) => num(x.c.range) && num(x.c.hits)), launchers = parts.filter((x) => x.c.launches);
  const ready = (list) => list.filter((x) => !ship.used[x.si + '.' + x.pi]).length;
  return {
    moveLeft: pl.canMove ? Math.max(0, Math.min(moveCap(state, p) - (pl.moved[ship.id] || 0), Math.floor(pl.thrust / n))) : 0,
    costPerHex: n,
    beams: beams.length, beamsReady: ready(beams),
    launchers: launchers.length, launchersReady: ready(launchers),
    scanReady: !ship.used.scan && pl.cp >= state.rules.cost.scan && netMoved(state, ship) >= 1,
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
