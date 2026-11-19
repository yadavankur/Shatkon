// EXPERIMENTAL: the Strength check (lab-strength.html only). Nothing in the real game reads this file.
// It asks the game's own damage code (engine/damage.js applyHits and explode) how much punishment one
// segment of a Lab design takes, with three test missiles and three test cores that do not exist in the
// shipped rules. The world file is copied and changed here, in memory, for this page only.

import { buildRules, start } from '../engine/index.js';
import { beamHitsAt } from '../engine/actions.js';
import { applyHits, explode } from '../engine/damage.js';
import { makeObj, segHex, num } from '../engine/state.js';

// Assumed values (19-20 Nov 2026 chat with Ankur). Test values only; not balance decisions.
export const STRENGTH_LAB = {
  experimental: true,
  lasers: [
    { id: 'near', label: 'Laser, near', band: '1\u20134 hexes', dist: 1 },
    { id: 'mid', label: 'Laser, mid', band: '5\u20138 hexes', dist: 5 },
    { id: 'far', label: 'Laser, far', band: '9 hexes', dist: 9 }
  ],
  missiles: [
    { id: 'basic', label: 'Basic missile', hits: 3 },
    { id: 'advanced', label: 'Advanced missile', hits: 4 },
    { id: 'nuke', label: 'Nuke', hits: 3, wrecks: true }   // today's missile: wrecks the segment outright; vs a working shield, 3 hits
  ],
  cores: [
    { id: 'basic', label: 'Basic core', hp: 1 },
    { id: 'steel', label: 'Steel core', hp: 3 },
    { id: 'carbon', label: 'Carbon crystal core', hp: 6 }
  ]
};
export const missileKind = (id) => 'test_missile_' + id;

// The shipped world with this page's test pieces added. opts.core: core id. The nuke keeps the shipped
// missile's rule: it wrecks the segment outright (a working shield takes the blow instead: 3 hits).
export function strengthWorld(world, opts = {}) {
  const w = structuredClone(world), core = STRENGTH_LAB.cores.find((c) => c.id === opts.core) || STRENGTH_LAB.cores[0];
  w.bay_parts.core = { ...w.bay_parts.core, hp: core.hp };
  const base = w.munitions.missile;
  for (const m of STRENGTH_LAB.missiles)
    w.munitions[missileKind(m.id)] = { ...base, hits: m.hits, wrecks_segment: !!m.wrecks };
  // opts.coreOnly: only losing the core kills the ship (switches off "only engines and core left")
  if (opts.coreOnly) w.damage = { ...w.damage, ship_dead_when: ['core_destroyed'] };
  w.turns = { ...(w.turns || {}), first: 'player_1' };
  return w;
}

const cleanHull = (des) => des.hull.map((s) => ({ at: s.at.slice(), bays: (s.bays || []).filter(Boolean), mounts: (s.mounts || []).filter(Boolean) }));

// A sandbox with the design as player 1's only ship and a far-away dummy as player 2 (the shooter).
export function strengthGame(world, des, opts = {}) {
  const w = strengthWorld(world, opts);
  const target = { name: 'Target', flagship: true, hull: cleanHull(des) };
  const dummy = { name: 'Shooter', flagship: true, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser'] }] };
  const fleets = { budget: 1e9, player_1: { ships: [target], deployment: [{ ship: 'Target', at: [0, 0] }] }, player_2: { ships: [dummy], deployment: [{ ship: 'Shooter', at: [0, -9] }] } };
  const built = buildRules(w, { map: { board: { shape: 'hexagon', radius: 11 }, terrain: [] } }, fleets);
  const game = start(built.rules, opts.seed || 1);
  const ship = game.ships.find((s) => s.owner === 0);
  return { game, ship, problems: built.problems, rules: built.rules };
}

export const laserHits = (rules, dist) => beamHitsAt(rules.parts.laser, dist);

const isCore = (rules, p) => !!rules.parts[p.t].required;
export const segHasCore = (rules, sg) => sg.parts.some((p) => isCore(rules, p));

// One shot at segment si. Returns what happened, read from the engine's own event feed.
export function fire(sim, si, weapon) {
  const { game, ship } = sim, rules = game.rules, from = game.events.length;
  if (ship.dead) return { events: [], over: true };
  if (weapon.kind === 'laser') applyHits(game, ship, si, laserHits(rules, weapon.dist), 'laser');
  else {
    const kind = missileKind(weapon.id), o = makeObj(game, kind, 1, segHex(ship, si), 0);
    game.objs.push(o);
    explode(game, o, { ship, seg: si });
  }
  return { events: game.events.slice(from) };
}

// End of the round, as engine/flight.js does it: point defence reloads, shields come back if unhit.
export function nextRound(sim) {
  const game = sim.game;
  for (const s of game.ships) {
    if (s.dead) continue;
    s.pd = 0;
    for (const sg of s.segs) if (!sg.wrecked) for (const part of sg.parts) {
      const c = game.rules.parts[part.t];
      if (c.recharges && part.hp < c.hp) {
        part.down = (part.down || 0) + 1;
        const wait = num(c.recharge_every, 1), hitNow = part.hitRound === game.round;
        if (part.down >= wait && !(c.recharge_if_unhit && hitNow)) { part.hp = c.hp; part.down = 0; }
      }
    }
  }
  game.round++;
}

// Stripped: every part but the core (and shields, which come back) is at 0 hp, or the segment is wrecked.
export function segState(sim, si) {
  const { game, ship } = sim, rules = game.rules, sg = ship.segs[si];
  const stripped = sg.wrecked || sg.parts.every((p) => p.hp <= 0 || isCore(rules, p) || rules.parts[p.t].recharges);
  const coreLeft = sg.parts.some((p) => isCore(rules, p) && p.hp > 0);
  const anyCore = ship.segs.some((g) => !g.wrecked && g.parts.some((p) => isCore(rules, p) && p.hp > 0));
  const why = ship.dead ? (anyCore ? 'ship lost: only engines and core left' : 'core destroyed: ship lost') : sg.wrecked ? 'segment wrecked' : '';
  return { stripped, wrecked: !!sg.wrecked, shipLost: !!ship.dead, coreLost: segHasCore(rules, sg) && !coreLeft, why };
}

// The table: shots fired at the segment in one round (a focused volley) until it is stripped and until it
// is finished (wrecked, or for the core's segment the core destroyed). Part choice within a layer is random,
// so each weapon is tried over several seeds and the range is reported.
export function strengthTable(world, des, si, opts = {}) {
  const seeds = opts.seeds || 24, cap = opts.cap || 40, rows = [];
  const probe = strengthGame(world, des, opts), rules = probe.rules, sg0 = probe.ship.segs[si];
  const core = segHasCore(rules, sg0);
  const shield = sg0.parts.some((p) => rules.parts[p.t].recharges);
  const pd = probe.ship.segs.reduce((n, g) => n + g.parts.reduce((k, p) => k + num(rules.parts[p.t].stops_per_round), 0), 0);
  const weapons = [
    ...STRENGTH_LAB.lasers.map((l) => ({ ...l, kind: 'laser', hits: laserHits(rules, l.dist) })),
    ...STRENGTH_LAB.missiles.map((m) => ({ ...m, kind: 'missile' }))
  ];
  for (const wpn of weapons) {
    const strip = [], finish = [], why = new Set();
    for (let s = 1; s <= seeds; s++) {
      const sim = strengthGame(world, des, { ...opts, seed: s });
      let k = 0, st = segState(sim, si), stripAt = st.stripped ? 0 : null;
      while (k < cap && !st.wrecked && !st.shipLost) {
        fire(sim, si, wpn); k++;
        st = segState(sim, si);
        if (stripAt == null && st.stripped) stripAt = k;
      }
      strip.push(stripAt == null ? Infinity : stripAt);
      finish.push(st.wrecked || st.shipLost ? k : Infinity);
      if (st.why) why.add(st.why);
    }
    const notes = [];
    if (shield) notes.push(wpn.wrecks ? 'a working shield takes the blow: no wreck, shield down, ' + wpn.hits + ' hits' : 'shield soaks the first hit');
    if (wpn.kind === 'missile' && pd) notes.push('point defence shoots down the first ' + (pd > 1 ? pd + ' missiles' : 'missile') + ' of the round');
    if (wpn.kind === 'missile') notes.push('splash: 1 hit to each touching segment');
    rows.push({ id: wpn.id, kind: wpn.kind, label: wpn.label, band: wpn.band, hits: wpn.hits, strip: range(strip), finish: range(finish), result: [...why].join(' / '), notes });
  }
  return { core, shield, pd, rows };
}

function range(a) {
  const lo = Math.min(...a), hi = Math.max(...a);
  return { lo, hi, text: !isFinite(lo) ? '\u2014' : lo === hi || !isFinite(hi) ? String(lo) + (isFinite(hi) ? '' : '+') : lo + '\u2013' + hi };
}
