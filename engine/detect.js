// Detection, stealth and what each player currently knows.
// One rule decides everything: you see a target if
//   distance <= your sensor range + its signature (+ its flare).
// A ship's signature is its size, minus 1 per working stealth part (down to a floor of
// segments / 3), plus flare, plus how it moved this turn (sitting still hides it a little,
// a big move leaves an engine wake), minus any nebula it sits in.
// Just beyond that range a target shows up as a fuzzy contact: "something is in this circle".

import { key, dist } from './hex.js';
import { geom, footprint, cellsOf, workingParts, sumAttr, maxAttr, gap, num, emit, thing } from './state.js';
import { fnv, seededRandom } from './codec.js';

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

// How far a ship moved from where it started this turn (moving there and back counts as 0).
export function netMoved(state, ship) {
  return ship.turnStart ? dist(ship.turnStart, ship.pos) : 0;
}

// Stealth from motion: a ship that has not moved or used anything this turn runs silent,
// a big move leaves an engine wake. It lasts until that ship's next turn.
export function motionSig(state, ship) {
  if (!ship.turnStart) return 0;
  const d = netMoved(state, ship), quiet = !Object.keys(ship.used || {}).length, r = state.rules.det;
  return d === 0 && quiet ? r.stillSig : d >= r.wakeFrom ? r.wakeSig : 0;
}

// A ship's signature, piece by piece, so screens can explain it.
export function sigBreak(state, ship) {
  const g = geom(state.rules), base = ship.segs.length, stealth = sumAttr(state, ship, 'hides');
  const floor = Math.ceil(base / state.rules.det.stealthFloorDiv), hull = Math.max(floor, base - stealth);
  let haze = 0;
  for (const h of cellsOf(ship)) { const z = g.haze.get(key(h)); if (z) haze = Math.min(haze, num(z.signature_bonus)); }
  const flare = flareOf(state, ship), motion = motionSig(state, ship);
  return { base, stealth, used: base - hull, floor, hull, haze, flare, motion, total: hull + haze + flare + motion };
}

export function signatureOf(state, x) {
  if (x.segs) return sigBreak(state, x).total;
  const g = geom(state.rules);
  const m = state.rules.munitions[x.kind], sig = typeof m.signature === 'number' ? m.signature : state.rules.det.smallSig;
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
// The detection formulas live here only; the play screen and the Lab both use them.
// Exact position: distance <= the viewer's sensor range + the target's signature.
export function detectRange(state, observer, target) {
  const r = eyes(state, observer);
  return r === null ? -Infinity : r + signatureOf(state, target);
}
// A fuzzy contact ("something is roughly here"): a few hexes further out than that.
export function passiveRange(state, observer, target) {
  return detectRange(state, observer, target) + state.rules.det.passiveFuzzy;
}
export function sees(state, observer, target) {
  return gap(observer, target) <= detectRange(state, observer, target);
}
// A fresh scan shows everything inside its clear ring until the end of the next round.
const revealed = (state, p, t) => ((state.players[p].revealed || {})[t.id] || 0) >= state.round;
export const isLit = (state, x) => (state.lit[x.id] || 0) >= state.round;

export function visibleTo(state, p) {
  const out = new Set();
  const ships = state.ships.filter((s) => !s.dead);
  const mine = ships.filter((s) => s.owner === p).concat(state.objs.filter((o) => o.owner === p && state.rules.munitions[o.kind].reports));
  const theirs = ships.filter((s) => s.owner !== p).concat(state.objs.filter((o) => o.owner !== p));
  for (const t of theirs) if (isLit(state, t) || revealed(state, p, t) || mine.some((o) => sees(state, o, t))) out.add(t.id);
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
  if (revealed(state, p, t)) return { scanned: true };
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
  if (isLit(state, target) || revealed(state, ship.owner, target)) return true;
  if (networkOf(state, ship).some((s) => sees(state, s, target))) return true;
  return state.objs.some((o) => o.owner === ship.owner && state.rules.munitions[o.kind].reports && sees(state, o, target));
}

// Bring both players' knowledge up to date: what is in view now, and "last seen here" ghosts.
export function refreshSight(state) {
  for (let p = 0; p < state.players.length; p++) {
    const pl = state.players[p], now = visibleTo(state, p), before = new Set(pl.vis);
    // fuzzy-circle epochs: -1 while seen, a new number each time a target drops out of sight
    pl.fz = pl.fz || {};
    for (const a of state.ships.filter((x) => !x.dead && x.owner !== p).concat(state.objs.filter((x) => x.owner !== p))) {
      if (now.has(a.id)) pl.fz[a.id] = -1;
      else if (pl.fz[a.id] === undefined || pl.fz[a.id] === -1) pl.fz[a.id] = state.seq + 1;
    }
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

// Where a fuzzy contact circle sits. Its centre is the true hex moved by an offset picked
// evenly from every hex in the circle, so the target is equally likely to be anywhere inside.
// The pick is a hash of a secret per-game salt, the viewer, the target, its exact hex and the
// epoch it dropped out of sight: the circle stays put while the target sits still and moves only
// when the target does, so looking again tells you nothing new.
export function fuzzAt(state, viewer, a) {
  const R = state.rules.det.fuzzR, g = geom(state.rules), ep = (state.players[viewer].fz || {})[a.id] || 0, offs = [];
  for (let dq = -R; dq <= R; dq++) for (let dr = -R; dr <= R; dr++) {
    const c = [a.pos[0] + dq, a.pos[1] + dr];
    if (dist([0, 0], [dq, dr]) <= R && g.inside(c)) offs.push(c);
  }
  const u = seededRandom(fnv((state.fzSalt || 0) + '|' + viewer + '|' + a.id + '|' + a.pos[0] + ',' + a.pos[1] + '|' + ep))();
  return offs.length ? offs[Math.min(offs.length - 1, Math.floor(u * offs.length))] : a.pos.slice();
}

// Fuzzy contacts for player p: from a recent scan's outer ring, or passively when a target is
// just outside detection range. Mines (things that do not move) never show up passively.
export function contactsFor(state, p, vis) {
  const pings = state.players[p].pings || {}, out = [];
  const mine = state.ships.filter((s) => !s.dead && s.owner === p).concat(state.objs.filter((o) => o.owner === p && state.rules.munitions[o.kind].reports));
  for (const a of state.ships.filter((s) => !s.dead && s.owner !== p).concat(state.objs.filter((o) => o.owner !== p))) {
    if (vis.has(a.id)) continue;
    const pg = pings[a.id];
    if (pg && pg.round >= state.round - 1) { out.push({ id: a.id, at: pg.at, r: pg.r || state.rules.det.fuzzR, kind: pg.kind, src: 'scan' }); continue; }
    const mu = !a.segs && state.rules.munitions[a.kind];
    if (mu && !num(mu.speed)) continue;
    if (mine.some((o) => gap(o, a) <= passiveRange(state, o, a)))
      out.push({ id: a.id, at: fuzzAt(state, p, a), r: state.rules.det.fuzzR, kind: a.segs ? 'ship' : 'small', src: 'sensor' });
  }
  return out;
}
