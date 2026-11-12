// Detection, stealth and what each player currently knows.
// One rule decides everything: you see a target if
//   distance <= your sensor range + its signature (+ its flare).

import { key, dist } from './hex.js';
import { geom, footprint, cellsOf, workingParts, sumAttr, maxAttr, gap, num, emit, thing } from './state.js';

export function sensorOf(state, ship) {
  let s = 0;
  for (const x of workingParts(state, ship)) s += num(x.c.sensor_range) + num(x.c.adds_range);
  const g = geom(state.rules);
  let pen = 0;
  for (const h of footprint(ship)) { const z = g.haze.get(key(h)); if (z) pen = Math.max(pen, num(z.sensor_penalty)); }
  return Math.max(0, s - pen);
}

export function flareOf(state, x) {
  let fl = 0;
  for (const f of x.flares || []) if (f.until >= state.round) fl = Math.max(fl, f.amt);
  return fl;
}

export function signatureOf(state, x) {
  const g = geom(state.rules);
  let sig;
  if (x.segs) sig = x.segs.length - sumAttr(state, x, 'hides');
  else { const m = state.rules.munitions[x.kind]; sig = typeof m.signature === 'number' ? m.signature : state.rules.det.smallSig; }
  let bonus = 0;
  for (const h of cellsOf(x)) { const z = g.haze.get(key(h)); if (z) bonus = Math.min(bonus, num(z.signature_bonus)); }
  return sig + bonus + flareOf(state, x);
}

export const linkRange = (state, ship) => maxAttr(state, ship, 'link_range');

// How far something can see: ships by their sensors, drones by their own number, the rest not at all.
export function eyes(state, o) {
  if (o.segs) return sensorOf(state, o);
  const m = state.rules.munitions[o.kind];
  return typeof m.sensor_range === 'number' ? m.sensor_range : null;
}
export function sees(state, observer, target) {
  const r = eyes(state, observer);
  return r !== null && gap(observer, target) <= r + signatureOf(state, target);
}
export const isLit = (state, x) => (state.lit[x.id] || 0) >= state.round;

export function visibleTo(state, p) {
  const out = new Set();
  const ships = state.ships.filter((s) => !s.dead);
  const mine = ships.filter((s) => s.owner === p).concat(state.objs.filter((o) => o.owner === p && state.rules.munitions[o.kind].reports));
  const theirs = ships.filter((s) => s.owner !== p).concat(state.objs.filter((o) => o.owner !== p));
  for (const t of theirs) if (isLit(state, t) || mine.some((o) => sees(state, o, t))) out.add(t.id);
  // a drone that spots one of your ships gives itself away to you
  const myShips = ships.filter((s) => s.owner === p);
  for (const o of state.objs) {
    if (o.owner === p || out.has(o.id)) continue;
    const m = state.rules.munitions[o.kind];
    if (m.reveals_itself_on_detect && typeof m.sensor_range === 'number' && myShips.some((s) => sees(state, o, s))) out.add(o.id);
  }
  return out;
}

// The plain reason a player can see something: who spotted it and the numbers behind it.
export function whySeen(state, p, t) {
  if (isLit(state, t)) return { lit: true };
  let best = null;
  const mine = state.ships.filter((s) => !s.dead && s.owner === p).concat(state.objs.filter((o) => o.owner === p && state.rules.munitions[o.kind].reports));
  for (const o of mine) {
    const r = eyes(state, o);
    if (r === null) continue;
    const d = gap(o, t), sig = signatureOf(state, t);
    if (d <= r + sig && (!best || d < best.d)) best = { by: o.id, d, range: r, sig, flare: flareOf(state, t) };
  }
  return best || { drone: true };
}

// Ships linked by comms form networks; a ship can only shoot at what its own network sees.
export function networkOf(state, ship) {
  const fleet = state.ships.filter((s) => !s.dead && s.owner === ship.owner);
  const net = [ship], todo = [ship];
  while (todo.length) {
    const a = todo.pop();
    for (const b of fleet) {
      if (net.includes(b)) continue;
      if (gap(a, b) <= Math.max(linkRange(state, a), linkRange(state, b))) { net.push(b); todo.push(b); }
    }
  }
  return net;
}
export function networkSees(state, ship, target) {
  if (isLit(state, target)) return true;
  if (networkOf(state, ship).some((s) => sees(state, s, target))) return true;
  return state.objs.some((o) => o.owner === ship.owner && state.rules.munitions[o.kind].reports && sees(state, o, target));
}

// Bring both players' knowledge up to date: what is in view now, and "last seen here" ghosts.
export function refreshSight(state) {
  for (let p = 0; p < state.players.length; p++) {
    const pl = state.players[p], now = visibleTo(state, p), before = new Set(pl.vis);
    for (const id of now) {
      const x = thing(state, id);
      const why = whySeen(state, p, x);
      if (!before.has(id)) emit(state, { t: 'sighted', id, kind: x.segs ? 'ship' : x.kind, at: x.pos.slice(), why }, [p]);
      pl.seen[id] = { pos: x.pos.slice(), round: state.round, kind: x.segs ? 'ship' : x.kind, cells: cellsOf(x).map((c) => c.slice()), glow: !!(why.lit || why.flare) };
    }
    for (const id of before) if (!now.has(id) && thing(state, id)) {
      const x = thing(state, id), was = pl.seen[id];
      emit(state, { t: 'lost', id, faded: !!(was && was.glow && !isLit(state, x) && !flareOf(state, x)) }, [p]);
    }
    // drop a ghost once the thing is gone, or once we can see its old spot and it is not there
    const myShips = state.ships.filter((s) => !s.dead && s.owner === p);
    for (const id of Object.keys(pl.seen)) {
      if (now.has(id)) continue;
      const gh = pl.seen[id];
      if (!thing(state, id) || myShips.some((s) => Math.min(...footprint(s).map((c) => dist(c, gh.pos))) <= sensorOf(state, s))) delete pl.seen[id];
    }
    pl.vis = [...now].sort();
  }
}

export function addFlare(state, ship, kind) {
  const amt = num(state.rules.det.flare[kind]) - sumAttr(state, ship, 'flare_reduction');
  if (amt > 0) ship.flares.push({ amt, until: state.round + 1 });
}
