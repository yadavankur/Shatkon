// Turns the three rule files (already parsed into plain objects) into one tidy
// "rules" object the engine can use, and lists every problem it finds on the way:
// unknown parts, overfull segments, missing couplings, budget, bad placements.

import { key, add, dist, disc, inHexagon, EDGE, connected } from './hex.js';

const num = (v, d) => (typeof v === 'number' ? v : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const listOf = (v) => (Array.isArray(v) ? v : isObj(v) ? Object.values(v) : []);
const neg = (c) => [-c[0] || 0, -c[1] || 0];

function terrainCells(t) {
  if (typeof t.radius === 'number') return disc(t.at, t.radius);
  if (t.size === 3) return [add(t.at, [-1, 0]), t.at, add(t.at, [1, 0])];
  if (t.size === 7) return disc(t.at, 1);
  return [t.at];
}

// The map's objective: a beacon to hold. null when the map has none.
function readObjective(o) {
  if (!isObj(o) || !Array.isArray(o.at)) return null;
  return {
    at: o.at.slice(), radius: num(o.radius, 1), toWin: num(o.points_to_win, 0),
    reveals: o.reveals_holder !== false, scoreAtLimit: o.decides_turn_limit !== false,
  };
}

export function buildRules(world, mapFile, fleetsFile) {
  const problems = [];
  const w = world || {}, m = (mapFile && mapFile.map) || mapFile || {}, f = fleetsFile || {};
  const t = w.turns || {}, cp = t.command_points || {}, mv = w.movement || {}, det = w.detection || {};
  const seg = w.segments || {}, dmg = w.damage || {}, fl = det.flare || {}, act = w.actions || {};

  const parts = {};
  for (const [slot, cat] of [['bay', w.bay_parts], ['mount', w.mount_parts]])
    for (const [name, p] of Object.entries(cat || {}))
      parts[name] = { ...p, name, slot, hp: num(p.hp, 1), layer: num(p.layer, slot === 'mount' ? 3 : 4), cost: num(p.cost, 0) };
  const munitions = {};
  for (const [name, p] of Object.entries(w.munitions || {})) munitions[name] = { ...p, name, cost: num(p.cost, 0) };

  const rules = {
    name: (w.meta && w.meta.name) || 'game',
    version: String((w.meta && w.meta.version) || ''),
    cp: { perTurn: num(cp.per_turn, 3), bankCap: num(cp.bank_cap, 6) },
    ticks: Math.max(1, num((t.flight_phase || {}).ticks, 6)),
    turnLimit: num(t.turn_limit, 30),
    cost: {},
    seg: { max: num(seg.max_per_ship, 7), cost: num(seg.cost, 3), bays: num(seg.bays, 3), mounts: num(seg.mounts, 3), couplings: seg.couplings_required !== false },
    move: { needsAverage: num(mv.needs_average_of, 0), capBonus: num(mv.max_above_average, 1), bankTurns: num(mv.bank_turns, 2) },
    det: {
      smallSig: num(det.small_object_signature, 1), lightsUp: num(det.detonation_lights_up, 4), shownSensor: num(det.shown_enemy_sensor, 4),
      flare: { fire: num(fl.fire_beam, 0), beamHit: num(fl.beam_hit, 3), launch: num(fl.launch, 2), pd: num(fl.point_defence_shot, 2), scan: num(fl.scan, 2) },
      // scans: [clear, faint] rings near home / mid-field / centre line and beyond
      scanClear: num(det.scan_clear_bonus, 2),
      scanTiers: Array.isArray(det.scan_tiers) && det.scan_tiers.length === 3 ? det.scan_tiers.map((x) => [num(x[0], 0), num(x[1], 0)]) : [[2, 4], [4, 7], [6, 10]],
      scanMidAhead: num(det.scan_mid_rows_past_home, 2),
      scanFuzzy: num(det.scan_fuzzy_extra, 4),
      // stealth from motion and the stealth floor
      stillSig: num(det.still_signature_bonus, -1), wakeSig: num(det.move_signature_penalty, 1), wakeFrom: num(det.move_signature_from_hexes, 2),
      stealthFloorDiv: num(det.stealth_floor_segments_per_point, 3),
      // fuzzy contacts
      fuzzR: num(det.fuzzy_contact_radius, 2), passiveFuzzy: num(det.passive_fuzzy_extra, 3),
      attackRun: num(det.attack_run_bonus, 0),
    },
    deadWhen: Array.isArray(dmg.ship_dead_when) ? dmg.ship_dead_when : ['core_destroyed'],
    friendlyFire: dmg.friendly_fire !== false,
    ownMissilesPass: dmg.own_munitions_pass_own_ships === true,   // your missiles and drones fly through your own hulls
    beamsPassOwnMunitions: dmg.beams_pass_own_munitions === true, // your beams fly past your own missiles and drones
    parts, munitions,
    terrainTypes: w.terrain || {},
    board: { radius: num((m.board || {}).radius, 10) },
    zones: Object.entries(m.zones || {}).filter(([, z]) => isObj(z) && EDGE[z.edge] && typeof z.depth === 'number').map(([name, z]) => ({ name, edge: z.edge, depth: z.depth })),
    mineRows: num(((m.setup || {}).mines || {}).rows_into_no_mans_land, 0),
    terrain: listOf(m.terrain).filter((x) => isObj(x) && Array.isArray(x.at)).map((x) => ({ type: x.type, at: x.at, cells: terrainCells(x) })),
    objective: readObjective(m.objective),
    budget: num(f.budget, Infinity),
    fleets: [],
  };
  for (const a of ['move', 'fire', 'launch', 'scan', 'detonate']) rules.cost[a] = num((act[a] || {}).cost, 1);

  const R = rules.board.radius;
  const blocked = new Set();
  for (const tr of rules.terrain) if ((rules.terrainTypes[tr.type] || {}).blocks_movement) tr.cells.forEach((c) => blocked.add(key(c)));

  // ---- fleets ----
  const names = Object.keys(f).filter((k) => isObj(f[k]) && (f[k].ships || f[k].copy_of));
  if (names.length !== 2) problems.push(`The fleets file should describe exactly 2 players; it has ${names.length}.`);
  for (const name of names) {
    let src = f[name], mirrorShips = false, mirrorDeploy = false;
    if (src.copy_of) {
      mirrorShips = src.mirror_ships === true; mirrorDeploy = src.mirror_deployment === true;
      const from = f[src.copy_of];
      if (!isObj(from) || !from.ships) { problems.push(`${name}: copy_of "${src.copy_of}" does not point at a player with ships.`); continue; }
      src = from;
    }
    const fleet = { name, ships: [], deployment: [], cost: 0 };
    for (const sh of listOf(src.ships)) {
      const label = `${name} / ${sh.name || '(unnamed ship)'}`;
      const ship = { name: String(sh.name || ''), flagship: sh.flagship === true, segs: [], load: {}, cost: 0, ...(sh.reserve === true ? { reserve: true } : {}) };
      let couplings = 0, cores = 0, holds = 0, launchers = 0;
      for (const hx of listOf(sh.hull)) {
        if (!Array.isArray(hx.at)) { problems.push(`${label}: a hull entry has no "at".`); continue; }
        const bays = listOf(hx.bays), mounts = listOf(hx.mounts);
        if (bays.length > rules.seg.bays) problems.push(`${label}: segment [${hx.at}] has ${bays.length} bay parts; the limit is ${rules.seg.bays}.`);
        if (mounts.length > rules.seg.mounts) problems.push(`${label}: segment [${hx.at}] has ${mounts.length} mount parts; the limit is ${rules.seg.mounts}.`);
        const list = [];
        for (const [slot, names2] of [['bay', bays], ['mount', mounts]]) for (const pn of names2) {
          const p = parts[pn];
          if (!p) { problems.push(`${label}: unknown part "${pn}".`); continue; }
          if (p.slot !== slot) problems.push(`${label}: "${pn}" is a ${p.slot} part but sits in a ${slot} slot.`);
          list.push(pn); ship.cost += p.cost;
          if (p.couples) couplings++;
          if (p.required) cores++;
          if (p.launches) launchers++;
          holds += num(p.holds, 0);
        }
        ship.segs.push({ off: mirrorShips ? neg(hx.at) : hx.at.slice(), parts: list });
        ship.cost += rules.seg.cost;
      }
      const n = ship.segs.length;
      if (!n) { problems.push(`${label}: the ship has no segments.`); continue; }
      if (n > rules.seg.max) problems.push(`${label}: ${n} segments; the limit is ${rules.seg.max}.`);
      if (new Set(ship.segs.map((s) => key(s.off))).size !== n) problems.push(`${label}: two segments share the same hex.`);
      if (!connected(ship.segs.map((s) => s.off))) problems.push(`${label}: the segments are not all joined together.`);
      const joined = sh.joined === true;   // docked or grafted ships keep every core and need no extra couplings
      if (joined ? cores < 1 : cores !== 1) problems.push(`${label}: needs exactly one core; it has ${cores}.`);
      if (!joined && rules.seg.couplings && couplings < n - 1) problems.push(`${label}: ${n} segments need ${n - 1} couplings; it has ${couplings}.`);
      let loaded = 0;
      for (const [kind, count] of Object.entries(isObj(sh.load) ? sh.load : {})) {
        const mu = munitions[kind];
        if (!mu) { problems.push(`${label}: unknown munition "${kind}" in load.`); continue; }
        ship.load[kind] = count; loaded += count; ship.cost += mu.cost * count;
      }
      if (loaded > holds) problems.push(`${label}: carries ${loaded} munitions but its magazines hold ${holds}.`);
      if (loaded && !launchers) problems.push(`${label}: carries munitions but has no launcher.`);
      fleet.ships.push(ship); fleet.cost += ship.cost;
    }
    if (fleet.ships.filter((s) => s.flagship).length !== 1) problems.push(`${name}: needs exactly one flagship.`);

    // ---- starting positions ----
    const zone = rules.zones.find((z) => z.name.indexOf(name) === 0);
    const taken = new Map(), counts = {};
    for (const d of listOf(src.deployment)) {
      if (!isObj(d)) continue;
      if (typeof d.ship === 'string' && Array.isArray(d.at)) {
        const ship = fleet.ships.find((s) => s.name === d.ship);
        if (!ship) { problems.push(`${name}: deployment mentions unknown ship "${d.ship}".`); continue; }
        const at = mirrorDeploy ? neg(d.at) : d.at.slice();
        fleet.deployment.push({ ship: ship.name, at });
        for (const sg of ship.segs) {
          const c = add(at, sg.off), k = key(c);
          if (!inHexagon(c, R)) problems.push(`${name} / ${ship.name}: starts partly off the board at [${c}].`);
          else if (blocked.has(k)) problems.push(`${name} / ${ship.name}: starts on blocked terrain at [${c}].`);
          else if (zone && EDGE[zone.edge](c, R) >= zone.depth) problems.push(`${name} / ${ship.name}: [${c}] is outside ${zone.name}.`);
          if (taken.has(k)) problems.push(`${name}: ${ship.name} and ${taken.get(k)} overlap at [${c}].`);
          taken.set(k, ship.name);
        }
      } else {
        const kind = Object.keys(d).find((k) => munitions[k] && Array.isArray(d[k]));
        if (!kind) { problems.push(`${name}: cannot read deployment entry ${JSON.stringify(d)}.`); continue; }
        const at = mirrorDeploy ? neg(d[kind]) : d[kind].slice();
        fleet.deployment.push({ munition: kind, at });
        fleet.cost += munitions[kind].cost; counts[kind] = (counts[kind] || 0) + 1;
        if (!inHexagon(at, R)) problems.push(`${name}: ${kind} at [${at}] is off the board.`);
        else if (zone && EDGE[zone.edge](at, R) >= zone.depth + rules.mineRows) problems.push(`${name}: ${kind} at [${at}] is too far from ${zone.name}.`);
      }
    }
    for (const s of fleet.ships) if (!s.reserve && !fleet.deployment.some((d) => d.ship === s.name)) problems.push(`${name} / ${s.name}: has no starting position.`);
    for (const [kind, c] of Object.entries(counts)) {
      const max = munitions[kind].max_per_player;
      if (typeof max === 'number' && c > max) problems.push(`${name}: ${c} ${kind}s; the limit is ${max}.`);
    }
    if (fleet.cost > rules.budget) problems.push(`${name}: fleet costs ${fleet.cost}; the budget is ${rules.budget}.`);
    rules.fleets.push(fleet);
  }
  return { rules, problems };
}

// Used by tests and by screens that want to show a ship's headline numbers before a game starts.
export function shipStats(rules, ship) {
  let thrust = 0, sensor = 0, hides = 0, link = 0;
  for (const sg of ship.segs) for (const pn of sg.parts) {
    const p = rules.parts[pn] || {};
    thrust += num(p.thrust, 0); sensor += num(p.sensor_range, 0) + num(p.adds_range, 0); hides += num(p.hides, 0);
    link = Math.max(link, num(p.link_range, 0));
  }
  const floor = Math.ceil(ship.segs.length / num((rules.det || {}).stealthFloorDiv, 3));
  return { segments: ship.segs.length, thrust, sensor, signature: Math.max(floor, ship.segs.length - hides), link, cost: ship.cost };
}

export { dist };
