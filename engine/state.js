// The game state and the small helpers every system uses to read it.
// The state is plain data (no functions), so it can be copied, hashed and sent as text.

import { add, key, dist, inHexagon, dirToward } from './hex.js';
import { fnv, stable } from './codec.js';

export class Illegal extends Error {}
export const no = (why) => { throw new Illegal(why); };
export const num = (v, d = 0) => (typeof v === 'number' ? v : d);

// Seeded random numbers kept inside the state, so two devices replaying the
// same actions always get the same "random" results.
export function rand(state) {
  let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const pick = (state, arr) => arr[Math.floor(rand(state) * arr.length)];

// Facts about the board that never change during a game.
const geomCache = new WeakMap();
export function geom(rules) {
  let g = geomCache.get(rules);
  if (g) return g;
  const R = rules.board.radius, blockMove = new Set(), blockSight = new Set(), haze = new Map();
  for (const t of rules.terrain) {
    const ty = rules.terrainTypes[t.type] || {};
    for (const c of t.cells) {
      const k = key(c);
      if (ty.blocks_movement) blockMove.add(k);
      if (ty.blocks_sight) blockSight.add(k);
      if (ty.sensor_penalty || ty.signature_bonus) haze.set(k, ty);
    }
  }
  g = { R, inside: (c) => inHexagon(c, R), blockMove, blockSight, haze };
  geomCache.set(rules, g);
  return g;
}

export const segHex = (ship, i) => add(ship.pos, ship.segs[i].off);
export const footprint = (ship) => ship.segs.map((s) => add(ship.pos, s.off));
export const cellsOf = (x) => (x.segs ? footprint(x) : [x.pos]);
export const shipById = (state, id) => state.ships.find((s) => s.id === id && !s.dead) || null;
export const objById = (state, id) => state.objs.find((o) => o.id === id) || null;
export const thing = (state, id) => shipById(state, id) || objById(state, id);
export const current = (state) => state.order[state.turn];

export function workingParts(state, ship) {
  const out = [];
  ship.segs.forEach((sg, si) => {
    if (sg.wrecked) return;
    sg.parts.forEach((p, pi) => { if (p.hp > 0 && !p.off) out.push({ p, si, pi, c: state.rules.parts[p.t] }); });   // p.off: switched off by a story script
  });
  return out;
}
// A ship built with engines that has none working (destroyed or switched off) is dead in the
// water: it can't move. (A ship designed with no engines at all is carried by the fleet as before.)
export function deadInWater(state, ship) {
  let had = false;
  for (const sg of ship.segs) for (const p of sg.parts) if (state.rules.parts[p.t] && num(state.rules.parts[p.t].thrust) > 0) {
    had = true;
    if (!sg.wrecked && p.hp > 0 && !p.off) return false;
  }
  return had;
}

// Story campaigns can protect a ship until a story beat has happened (see engine/script.js).
export function isProtected(state, ship) {
  const sc = state.script;
  if (!sc || !sc.protect) return false;
  const k = ship.name in sc.protect ? ship.name : 'side:' + ship.owner;
  if (!(k in sc.protect)) return false;
  const until = sc.protect[k];
  return until === 'end' || !sc.fired[until];
}
export const sumAttr = (state, ship, attr) => workingParts(state, ship).reduce((n, x) => n + num(x.c[attr]), 0);
export const maxAttr = (state, ship, attr) => workingParts(state, ship).reduce((n, x) => Math.max(n, num(x.c[attr])), 0);

// What is left of a ship's hull, as a percentage of its starting hit points (shields not counted).
export function hullPct(state, ship) {
  let left = 0, full = 0;
  for (const sg of ship.segs) for (const p of sg.parts) {
    const c = state.rules.parts[p.t];
    if (c.recharges) continue;
    full += c.hp;
    left += sg.wrecked ? 0 : Math.max(0, p.hp);
  }
  return full ? Math.round((100 * left) / full) : 0;
}

// Which ship segment sits on each hex.
export function occupancy(state) {
  const m = new Map();
  for (const s of state.ships) {
    if (s.dead) continue;
    s.segs.forEach((sg, i) => m.set(key(add(s.pos, sg.off)), { ship: s, seg: i }));
  }
  return m;
}
// Shortest distance between two things, counting every segment of a ship.
export function gap(a, b) {
  let d = Infinity;
  for (const p of cellsOf(a)) for (const q of cellsOf(b)) d = Math.min(d, dist(p, q));
  return d;
}
export function nearestCell(x, from) {
  let best = null, bd = Infinity;
  for (const c of cellsOf(x)) { const d = dist(c, from); if (d < bd) { bd = d; best = c; } }
  return best;
}

// Every change is announced as an event. "seenBy" lists the players who get to know.
export function emit(state, ev, seenBy) {
  ev.r = state.round;
  ev.n = state.seq++;
  state.events.push({ ...ev, seenBy });
  for (const p of seenBy) {
    const feed = state.players[p].feed;
    feed.push(ev);
    if (feed.length > 60) feed.splice(0, feed.length - 60);
  }
}

export function makeObj(state, kind, owner, pos, dir, extra) {
  const m = state.rules.munitions[kind];
  return { id: 'o' + state.nextId++, kind, owner, pos: pos.slice(), dir, fuel: typeof m.fuel === 'number' ? m.fuel : null,
    target: null, lock: false, route: [], src: null, ...(extra || {}) };
}

export function newGame(rules, seed = 1) {
  const state = {
    v: 1, rules, rid: fnv(stable(rules)).toString(36), rng: seed | 0,
    fzSalt: fnv('fz:' + (seed | 0)) | 0,   // secret per-game salt for where fuzzy contact circles sit
    round: 1, order: [0, 1], turn: 0, phase: 'play', winner: null, nextId: 1, seq: 0,
    players: [], ships: [], objs: [], lit: {},
    events: [], history: [], pending: [], pre: '', lastTurn: null,
  };
  rules.fleets.forEach((fl, p) => {
    state.players.push({ name: fl.name, cp: 0, cpBank: 0, thrust: 0, thrustBank: 0, canMove: false, moved: {}, vis: [], seen: {}, intel: {}, feed: [], readSeq: 0, turnSeq: 0, score: 0 });
    fl.ships.forEach((sh, i) => {
      const dep = fl.deployment.find((d) => d.ship === sh.name);
      if (!dep) return;
      state.ships.push({
        id: (p + 1) + String.fromCharCode(97 + i), owner: p, name: sh.name, flagship: !!sh.flagship, pos: dep.at.slice(),
        segs: sh.segs.map((s) => ({ off: s.off.slice(), wrecked: false, parts: s.parts.map((t) => ({ t, hp: rules.parts[t].hp })) })),
        load: { ...sh.load }, dead: false, flares: [], used: {}, pd: 0,
      });
    });
    for (const d of fl.deployment) if (d.munition) state.objs.push(makeObj(state, d.munition, p, d.at, dirToward(d.at, [0, 0])));
  });
  return state;
}
