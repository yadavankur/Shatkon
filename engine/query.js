// Questions a screen or an AI asks before acting: where can this ship go,
// what can it shoot, what can it lock on to. These use only what the player knows.

import { key, add, step, dist, line } from './hex.js';
import { geom, current, shipById, segHex, footprint, workingParts, occupancy, num, cellsOf } from './state.js';
import { networkSees } from './detect.js';
import { moveCap } from './actions.js';

// Every hex the ship's centre can reach this turn, with the path to get there.
export function reach(state, shipId) {
  const p = current(state), pl = state.players[p], ship = shipById(state, shipId);
  if (!ship || ship.owner !== p || !pl.canMove || pl.cp < state.rules.cost.move) return [];
  const n = ship.segs.length;
  const max = Math.min(moveCap(state, p) - (pl.moved[ship.id] || 0), Math.floor(pl.thrust / n));
  if (max <= 0) return [];
  const g = geom(state.rules), occ = occupancy(state), vis = new Set(pl.vis);
  const free = (pos) => ship.segs.every((sg) => {
    const h = add(pos, sg.off), k = key(h), o = occ.get(k);
    return g.inside(h) && !g.blockMove.has(k) && !(o && o.ship !== ship && (o.ship.owner === p || vis.has(o.ship.id)));
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
  for (const w of workingParts(state, ship)) {
    if (!num(w.c.range) || !num(w.c.hits) || ship.used[w.si + '.' + w.pi]) continue;
    const src = segHex(ship, w.si);
    for (const t of enemies) cellsOf(t).forEach((c, i) => {
      if (t.segs && t.segs[i].wrecked) return;
      const d = dist(src, c);
      if (d < 1 || d > w.c.range) return;
      const cells = line(src, c);
      for (let j = 1; j < cells.length - 1; j++) if (g.blockSight.has(key(cells[j]))) return;
      const hits = Math.max(0, w.c.hits - (w.c.loses_1_hit_every ? Math.floor((d - 1) / w.c.loses_1_hit_every) : 0));
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
