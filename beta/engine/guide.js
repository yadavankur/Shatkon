// What a move guide looks like right now, for one player (campaign/GUIDE_PROPOSAL.md §4–6).
// Pure: reads the state, changes nothing. Everything comes from what that player can see:
// visible ships, last-known ghosts, terrain. Hidden ships never block a hex or anchor a reticle.
//
// guideView(state, player) -> null, or
//   { id, ship, shipName, step, of, label, live, dest, best, blockedFrom, route, turnEnd,
//     reticle: { at, kind, dashed } | null, join: { with, cells } | null, anchor }

import { add, key, dist, line, step as stepHex } from './hex.js';
import { geom, current, footprint, num, deadInWater, workingParts } from './state.js';
import { visibleTo } from './detect.js';
import { reach } from './query.js';

export function guideView(state, player) {
  const sc = state.script;
  if (!sc || !sc.guides || !sc.guides.length || state.phase !== 'play') return null;
  const gd = sc.guides.find((g) => g.owner === player && state.ships.some((s) => s.name === g.ship && !s.dead));
  if (!gd) return null;
  const s = state.ships.find((x) => x.name === gd.ship && !x.dead), st = gd.steps[gd.i];
  if (!st) return null;
  const R = state.rules, g = geom(R), vis = visibleTo(state, player), pl = state.players[player];
  const liveTurn = current(state) === player;

  // what this player knows about a named ship: real cells if in view, a ghost if seen before
  const known = (name) => {
    const t = state.ships.find((x) => x.name === name && !x.dead);
    if (!t) return null;
    if (t.owner === player || vis.has(t.id)) return { cells: footprint(t), dashed: false, ship: t };
    const gh = pl.seen && pl.seen[t.id];
    if (gh && gh.cells) return { cells: gh.cells, dashed: true, ship: t };
    return null;
  };
  // hexes the guided ship could sit on (anchor), judged only by what this player can see
  const seenCells = new Set();
  for (const x of state.ships) if (!x.dead && x !== s && (x.owner === player || vis.has(x.id))) for (const c of footprint(x)) seenCells.add(key(c));
  const fits = (a) => s.segs.every((sg) => { const c = add(a, sg.off), k = key(c); return g.inside(c) && !g.blockMove.has(k) && !seenCells.has(k); });
  const board = g.cells || allHexes(R);

  // 1. candidates
  let cand = [], mv = st.move_to;
  if (mv && !deadInWater(state, s) && !(sc.locks || []).some((l) => l.ship === gd.ship && (l.actions === 'all' || (Array.isArray(l.actions) && l.actions.includes('move'))))) {
    if (Array.isArray(mv) && typeof mv[0] === 'number') cand = [mv];
    else if (Array.isArray(mv)) cand = mv;
    else if (mv.zone) cand = ((R.campaign && R.campaign.zones) || {})[mv.zone] || [];
    else if (mv.near) {
      const t = known(mv.near);
      if (t) {
        const w = num(mv.within, 1);
        cand = board.filter((a) => s.segs.some((sg) => t.cells.some((c) => dist(add(a, sg.off), c) <= w)));
      }
    }
  }
  // 2–3. legal ones, or the nearest legal ring toward them
  let dest = cand.filter(fits), blockedFrom = [];
  if (cand.length && !dest.length) {
    blockedFrom = cand.slice();
    for (let d = 1; d <= 12 && !dest.length; d++) dest = board.filter((a) => fits(a) && Math.min(...cand.map((c) => dist(a, c))) === d);
  }
  // routes from the ship over hexes it could sit on (a breadth-first search on the board)
  const prev = new Map([[key(s.pos), null]]), q = [s.pos];
  for (let i = 0; i < q.length && i < 5000; i++) for (let d = 0; d < 6; d++) {
    const n = stepHex(q[i], d), k = key(n);
    if (!prev.has(k) && fits(n)) { prev.set(k, q[i]); q.push(n); }
  }
  const pathTo = (a) => { const out = []; let c = a; while (c && prev.has(key(c))) { out.unshift(c); c = prev.get(key(c)); } return out.length && key(out[0]) === key(s.pos) ? out : null; };
  let best = null, route = [];
  for (const a of dest.slice().sort((x, y) => x[0] - y[0] || x[1] - y[1])) {
    const p = pathTo(a);
    if (p && (!best || p.length < route.length)) { best = a; route = p; }
  }
  if (!best && dest.length) best = dest.slice().sort((x, y) => dist(s.pos, x) - dist(s.pos, y) || x[0] - y[0] || x[1] - y[1])[0];
  if (best && st.path && st.path.length) {         // through the given waypoints, in order
    const legs = [s.pos].concat(st.path, [best]);
    route = [s.pos];
    for (let i = 1; i < legs.length; i++) { const p = pathFrom(legs[i - 1], legs[i], fits); route = route.concat(p.slice(1)); }
  }
  if (best && route.length < 2 && key(best) !== key(s.pos)) route = line(s.pos, best);   // no open way round: a straight hint
  // 4. where this turn's move ends along the route
  let turnEnd = null;
  if (liveTurn && route.length > 1) {
    const reachable = new Set(reach(state, s.id).map((r) => key(r.at)));
    for (let i = route.length - 1; i > 0; i--) if (reachable.has(key(route[i]))) { turnEnd = route[i]; break; }
  }

  // reticle and join marker
  let reticle = null, join = null;
  const shot = st.fire_at ? ['fire', st.fire_at] : st.launch_at ? ['launch', st.launch_at] : null;
  if (shot) {
    if (Array.isArray(shot[1])) reticle = { at: shot[1], kind: 'launch', dashed: false };
    else {
      const t = known(shot[1]);
      if (t) {
        const at = t.cells.slice().sort((a, b) => Math.min(...footprint(s).map((c) => dist(c, a))) - Math.min(...footprint(s).map((c) => dist(c, b))))[0];
        const range = shot[0] === 'fire' ? Math.max(0, ...workingParts(state, s).filter((w) => num(w.c.hits)).map((w) => num(w.c.range))) : 99;
        const inRange = !t.dashed && Math.min(...footprint(s).map((c) => dist(c, at))) <= range;
        reticle = { at, kind: shot[0], dashed: t.dashed || !inRange };
      }
    }
  }
  const other = st.graft || st.dock;
  if (other) {
    const t = known(other);
    if (t) {
      let pair = null;
      for (const a of footprint(s)) for (const b of t.cells) if (!pair || dist(a, b) < dist(pair[0], pair[1])) pair = [a, b];
      join = { with: other, cells: pair };
    }
  }
  return {
    id: gd.id, ship: s.id, shipName: s.name, step: gd.i + 1, of: gd.steps.length, label: st.label || '', live: liveTurn,
    dest, best, blockedFrom, route, turnEnd, reticle, join, anchor: best || (reticle && reticle.at) || s.pos.slice(),
  };
}

function pathFrom(a, b, fits) {
  const prev = new Map([[key(a), null]]), q = [a];
  for (let i = 0; i < q.length && i < 5000; i++) {
    if (key(q[i]) === key(b)) break;
    for (let d = 0; d < 6; d++) { const n = stepHex(q[i], d), k = key(n); if (!prev.has(k) && (fits(n) || key(n) === key(b))) { prev.set(k, q[i]); q.push(n); } }
  }
  const out = []; let c = b;
  while (c && prev.has(key(c))) { out.unshift(c); c = prev.get(key(c)); }
  return out.length ? out : [a, b];
}

function allHexes(R) {
  const r = R.board.radius, out = [];
  for (let q = -r; q <= r; q++) for (let s = Math.max(-r, -q - r); s <= Math.min(r, -q + r); s++) out.push([q, s]);
  return out;
}
