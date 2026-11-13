// Story scripts: the triggers and actions that steer a campaign chapter.
// A chapter's script lives in rules.campaign (static); what has happened so far lives in
// state.script (plain data, hashed with the rest of the state). Nothing here runs in a
// normal game: every entry point returns at once when state.script is missing.
//
// Hooks (called from engine/turn.js):
//   startScript(state)   after the first turn has begun
//   afterAction(state)   after every action, before the turn ends
//   onTurnStart(state)   at the start of every turn (dooms, forced moves, turn triggers)
// Player actions added here: dock, graft (see doJoin).

import { add, key, dist, step } from './hex.js';
import { no, num, emit, current, footprint, gap, hullPct, geom, occupancy, shipById } from './state.js';
import { visibleTo, refreshSight } from './detect.js';
import { doMove, doFire } from './actions.js';
import { reach, beamTargets } from './query.js';
import { buildRules } from './rules.js';

const SIDE = { player: 0, human: 0, enemy: 1, weave: 1 };
const sideOf = (s) => (typeof s === 'number' ? s : SIDE[s]);
const everyone = (state) => state.players.map((_, i) => i);
const byName = (state, name) => state.ships.find((s) => s.name === name) || null;
const live = (state, name) => { const s = byName(state, name); return s && !s.dead ? s : null; };
const zoneCells = (state, z) => (state.rules.campaign.zones || {})[z] || [];

// ---------------------------------------------------------------- start
export function startScript(state) {
  const C = state.rules.campaign;
  if (!C) return;
  state.script = {
    fired: {}, flags: {}, unlocked: {}, ai: {}, locks: [], forces: [], protect: {}, doom: [],
    objective: null, stopped: [0, 0], firedAt: {}, mineHit: [0, 0], via: {}, hits: {}, turns: 0,
    started: false, spawned: {}, gone: {}, disables: [], result: null,
  };
  for (const [k, v] of Object.entries(C.unlocked || {})) state.script.unlocked[k] = v;
  for (const s of state.ships) if (C.seams && C.seams[s.name]) s.seams = structuredClone(C.seams[s.name]);
  if (C.scenes && C.scenes.intro) emit(state, { t: 'scene', id: C.scenes.intro, at: 'intro' }, everyone(state));
  state.script.started = true;
  state.script.turns = 1;
  run(state);
}

export function afterAction(state) {
  if (!state.script || state.phase !== 'play') return;
  noteEvents(state);
  markVia(state);
  run(state);
}

export function onTurnStart(state) {
  const sc = state.script;
  if (!sc || state.phase !== 'play') return;
  sc.turns++;
  const p = current(state);
  for (const d of sc.doom) if (!d.done && state.round >= d.by_round) {
    d.done = true;
    const s = live(state, d.ship);
    if (s) destroy(state, s, 'scripted');
  }
  for (const d of sc.disables) if (!d.done && !active(state, d)) { d.done = true; act(state, { enable: { ship: d.ship, parts: d.parts } }); }
  run(state);
  // docking clamps: every extra core argues for command points
  for (const s of state.ships) if (!s.dead && s.owner === p && (s.seams || []).some((m) => m.kind === 'dock')) {
    const cores = s.segs.reduce((n, sg) => n + sg.parts.filter((x) => x.hp > 0 && state.rules.parts[x.t].required).length, 0);
    state.players[p].cp = Math.max(0, state.players[p].cp - Math.max(0, cores - 1));
  }
  // forced orders for this side's ships (a seized ship moves on its own)
  for (const f of sc.forces) if (active(state, f) && (f.each_turn || !f.done)) {
    const s = live(state, f.ship);
    if (!s || s.owner !== p) continue;
    f.done = true;
    for (const order of f.do || []) forced(state, s, order);
  }
  refreshSight(state);
  noteEvents(state);
  run(state);
}

// ---------------------------------------------------------------- the loop
function run(state) {
  const C = state.rules.campaign, sc = state.script;
  for (let pass = 0; pass < 12 && state.phase === 'play'; pass++) {
    let any = false;
    for (const e of C.script || []) {
      if (state.phase !== 'play') break;
      if (sc.fired[e.id] && !e.repeat) continue;
      if (!test(state, e.when)) continue;
      if (e.repeat && sc.fired[e.id] && sc.fired[e.id].turns === sc.turns) continue;   // repeating entries: once a turn
      sc.fired[e.id] = { round: state.round, turns: sc.turns };
      any = true;
      emit(state, { t: 'beat', id: e.id }, everyone(state));
      for (const a of e.do || []) act(state, a);
    }
    if (checkEnd(state)) return;
    if (!any) break;
  }
}

// ---------------------------------------------------------------- triggers
export function test(state, t) {
  if (t === undefined || t === null) return false;
  if (t === 'start') return state.script.started;
  if (typeof t === 'string') return !!state.script.fired[t];   // a bare id: that beat has fired
  const sc = state.script, [k] = Object.keys(t), v = t[k];
  switch (k) {
    case 'all': return v.every((x) => test(state, x));
    case 'any': return v.some((x) => test(state, x));
    case 'not': return !test(state, v);
    case 'start': return sc.started;
    case 'round': return state.round >= v;
    case 'turn': return state.round >= v.round && (v.side === undefined || current(state) === sideOf(v.side));
    case 'after': {
      const f = sc.fired[v.beat];
      if (!f) return false;
      if (v.turns !== undefined) return sc.turns - f.turns >= v.turns;
      return state.round - f.round >= num(v.rounds, 0);
    }
    case 'beat': case 'fired': return !!sc.fired[v];
    case 'destroyed': { const s = byName(state, v); return !!(s && s.dead && !s.removed); }
    case 'removed': { const s = byName(state, v); return !!(s && s.removed); }
    case 'hull_below': { const s = live(state, v.ship); return !!s && hullPct(state, s) < v.pct; }
    case 'part_lost': {
      const s = byName(state, v.ship);
      return !!s && s.segs.some((sg) => sg.parts.some((p) => p.t === v.part && (p.hp <= 0 || sg.wrecked) && !state.rules.parts[p.t].recharges));
    }
    case 'in_zone': {
      const cells = new Set(zoneCells(state, v.zone).map(key));
      const ships = v.ship ? [live(state, v.ship)].filter(Boolean) : state.ships.filter((s) => !s.dead && s.owner === sideOf(v.side));
      return ships.some((s) => footprint(s).some((c) => cells.has(key(c))));
    }
    case 'distance_below': { const a = live(state, v.a), b = live(state, v.b); return !!(a && b && gap(a, b) < v.hexes); }
    case 'sees': { const s = live(state, v.ship); return !!s && visibleTo(state, sideOf(v.side)).has(s.id); }
    case 'fired_at': return !!sc.firedAt[v.by + '>' + v.target];
    case 'stopped': return sc.stopped[sideOf(v.side)] >= num(v.count, 1);
    case 'mine_hit': return sc.mineHit[sideOf(v.side)] > 0;
    case 'grafted': case 'docked': return !!sc.flags[k + ':' + v.slice().sort().join('+')];
    case 'flag': return !!sc.flags[v];
    case 'alive': return !!live(state, v);
    default: return false;
  }
}

// What happened in the last action or flight phase, for the event-based triggers.
function noteEvents(state) {
  const sc = state.script, occ = occupancy(state);
  for (const ev of state.events) {
    if (ev._noted) continue;
    ev._noted = true;
    if (ev.t === 'fire' || ev.t === 'launch') {
      const by = state.ships.find((s) => s.id === ev.ship);
      let tgt = ev.target ? state.ships.find((s) => s.id === ev.target) : null;
      if (!tgt && ev.at) { const o = occ.get(key(ev.at)); tgt = o && o.ship; }
      if (by && tgt) sc.firedAt[by.name + '>' + tgt.name] = true;
    }
    if (ev.t === 'stopped') { const d = state.ships.find((s) => s.id === ev.ship); if (d) sc.stopped[1 - d.owner]++; }
    if (ev.t === 'damage') {
      const s = state.ships.find((x) => x.id === ev.ship);
      if (s && /mine/.test(String(ev.cause))) sc.mineHit[s.owner]++;
      if (s) { const k = (1 - s.owner) + ':' + state.round; sc.hits[k] = (sc.hits[k] || 0) + ev.hits; }
    }
  }
}

// A ship has been through the zone its profile routes it via.
function markVia(state) {
  const sc = state.script;
  for (const s of state.ships) {
    if (s.dead || sc.via[s.name]) continue;
    const prof = profileFor(state, s);
    if (!prof || !prof.path_via) continue;
    const cells = new Set(zoneCells(state, prof.path_via).map(key));
    if (footprint(s).some((c) => cells.has(key(c)))) sc.via[s.name] = true;
  }
}

// ---------------------------------------------------------------- actions
function act(state, a) {
  const sc = state.script, [k] = Object.keys(a), v = a[k], all = everyone(state);
  switch (k) {
    case 'scene': emit(state, { t: 'scene', id: v }, all); break;
    case 'bark': emit(state, { t: 'bark', id: v }, all); break;
    case 'objective': sc.objective = v; emit(state, { t: 'objective', text: v }, all); break;
    case 'flag': sc.flags[v] = true; break;
    case 'unlock': sc.unlocked[v] = true; emit(state, { t: 'unlocked', what: v }, all); break;
    case 'ai': sc.ai[v.ship || ('side:' + sideOf(v.side))] = v.profile; break;
    case 'protect': sc.protect[v.ship] = v.until || 'end'; break;
    case 'unprotect': delete sc.protect[v.ship || v]; break;
    case 'doom': sc.doom.push({ ship: v.ship, by_round: v.by_round, done: false }); break;
    case 'lock': sc.locks.push({ ...v, from: state.round, fromTurn: sc.turns }); emit(state, { t: 'locked', ship: v.ship || null, side: v.side ?? null, actions: v.actions }, all); break;
    case 'unlock_controls': sc.locks = sc.locks.filter((l) => !(l.ship === (v.ship || v) || (v.side !== undefined && l.side === v.side))); break;
    case 'force': sc.forces.push({ ...v, from: state.round, fromTurn: sc.turns, done: false }); break;
    case 'release': sc.forces = sc.forces.filter((f) => f.ship !== (v.ship || v)); break;
    case 'disable': case 'enable': {
      const s = byName(state, v.ship);
      if (!s) break;
      for (const sg of s.segs) for (const p of sg.parts) if (v.parts.includes(p.t) && !state.rules.parts[p.t].required) p.off = k === 'disable';
      if (k === 'disable' && v.until !== undefined) sc.disables.push({ ship: v.ship, parts: v.parts, until: v.until, from: state.round, done: false });
      emit(state, { t: k + 'd', ship: s.id, parts: v.parts }, all);
      break;
    }
    case 'light': { const s = live(state, v.ship || v); if (s) state.lit[s.id] = state.round + num(v.rounds, 1); break; }
    case 'reveal': {
      const s = live(state, v.ship); if (!s) break;
      for (const p of v.to !== undefined ? [sideOf(v.to)] : all) { const pl = state.players[p]; pl.revealed = pl.revealed || {}; pl.revealed[s.id] = state.round + num(v.rounds, 1); }
      break;
    }
    case 'set_rule': setRule(state, v.path, v.value); break;
    case 'spawn': spawn(state, v.group || v); break;
    case 'remove': { const s = live(state, v.ship || v); if (s) { s.dead = true; s.removed = v.as || 'withdraw'; emit(state, { t: 'removed', ship: s.id, name: s.name, as: s.removed }, all); } break; }
    case 'split': split(state, v); break;
    case 'graft': case 'dock': { const [x, y] = v; const s1 = live(state, x), s2 = live(state, y); if (s1 && s2) join(state, s1, s2, k === 'graft' ? 'weave' : 'dock', true); break; }
    case 'end': finish(state, v.result || v, 'script'); break;
    default: emit(state, { t: 'script_unknown', action: k }, all);
  }
}

// Is a lock / force still in effect?
function active(state, x) {
  const u = x.until;
  if (u === undefined || u === 'end') return true;
  if (typeof u === 'number') return state.round < x.from + u;
  if (typeof u === 'object' && u.rounds !== undefined) return state.round < x.from + u.rounds;
  return !state.script.fired[u];
}

// Called by apply() before an action: may this order be given?
export function checkLocked(state, action) {
  const sc = state.script;
  if (!sc || action.type === 'end') return;
  const s = state.ships.find((x) => x.id === action.ship);
  for (const l of sc.locks) {
    if (!active(state, l)) continue;
    const hit = (l.ship && s && s.name === l.ship) || (l.side !== undefined && sideOf(l.side) === current(state));
    if (!hit) continue;
    const acts = l.actions === 'all' || !l.actions ? 'all' : l.actions;
    if (acts === 'all' || acts.includes(action.type)) no((s ? s.name : 'that ship') + ' is not answering the helm');
  }
  if ((action.type === 'graft' || action.type === 'dock') && !sc.unlocked[action.type]) no('you do not have ' + action.type + ' technology');
}

// ---------------------------------------------------------------- mechanics
function destroy(state, s, cause) {
  s.dead = true;
  for (const pl of state.players) delete pl.seen[s.id];
  emit(state, { t: 'destroyed', ship: s.id, name: s.name, owner: s.owner, flagship: s.flagship, cause }, everyone(state));
}

function nextId(state, owner) {
  const used = new Set(state.ships.map((s) => s.id));
  for (let i = 0; i < 26 * 4; i++) {
    const id = (owner + 1) + (i < 26 ? String.fromCharCode(97 + i) : String.fromCharCode(97 + (i % 26)) + Math.floor(i / 26));
    if (!used.has(id)) return id;
  }
  return (owner + 1) + 'x' + state.nextId++;
}

// Where can this ship go? Zone hexes first (in the order listed), then outward from them.
function placeFor(state, segs, zone, taken) {
  const g = geom(state.rules), occ = occupancy(state), mines = new Set(state.objs.map((o) => key(o.pos)));
  const fits = (c) => segs.every((sg) => {
    const h = add(c, sg.off), k = key(h);
    return g.inside(h) && !g.blockMove.has(k) && !occ.has(k) && !taken.has(k) && !mines.has(k);
  });
  const seeds = zone.length ? zone : [[0, 0]], seen = new Set(seeds.map(key)), q = seeds.slice();
  for (let i = 0; i < q.length && i < 4000; i++) {
    if (fits(q[i])) return q[i];
    for (let d = 0; d < 6; d++) { const n = step(q[i], d); if (!seen.has(key(n)) && g.inside(n)) { seen.add(key(n)); q.push(n); } }
  }
  return null;
}

export function spawn(state, group) {
  const C = state.rules.campaign, G = (C.groups || {})[group], sc = state.script;
  if (!G || sc.spawned[group]) return;
  sc.spawned[group] = true;
  const p = sideOf(G.side), fleet = state.rules.fleets[p], zone = zoneCells(state, G.zone), taken = new Set(), placed = [];
  for (const name of G.ships) {
    const idx = fleet.ships.findIndex((s) => s.name === name), def = fleet.ships[idx];
    if (!def || byName(state, name)) continue;
    const segs = def.segs.map((s) => ({ off: s.off.slice(), wrecked: false, parts: s.parts.map((t) => ({ t, hp: state.rules.parts[t].hp })) }));
    const at = (G.at && G.at[name]) || placeFor(state, segs, zone, taken);
    if (!at) { emit(state, { t: 'spawn_failed', name }, everyone(state)); continue; }
    for (const sg of segs) taken.add(key(add(at, sg.off)));
    const id = (p + 1) + String.fromCharCode(97 + idx);
    const ship = { id: byIdFree(state, id) ? id : nextId(state, p), owner: p, name, flagship: !!def.flagship, pos: at.slice(), segs,
      load: { ...def.load }, dead: false, flares: [], used: {}, pd: 0, turnStart: at.slice() };
    state.ships.push(ship);
    placed.push(ship.id);
  }
  refreshSight(state);
  emit(state, { t: 'spawned', group, ships: placed }, everyone(state));
}
const byIdFree = (state, id) => !state.ships.some((s) => s.id === id);

// One ship becomes several. Each piece keeps the segments (cells), parts and damage it had.
export function split(state, v) {
  const s = live(state, v.ship);
  if (!s) return;
  const made = [];
  const pieces = v.into.map((spec) => ({ spec, segs: s.segs.filter((sg) => spec.cells.some((c) => c[0] === sg.off[0] && c[1] === sg.off[1])) }))
    .filter((x) => x.segs.length);
  let loadLeft = { ...s.load };
  for (const { spec, segs } of pieces) {
    const base = segs[0].off, pos = add(s.pos, base);
    const nsegs = segs.map((sg) => ({ ...structuredClone(sg), off: [sg.off[0] - base[0], sg.off[1] - base[1]] }));
    if (!nsegs.some((sg) => sg.parts.some((p) => state.rules.parts[p.t].required && p.hp > 0))) nsegs[0].parts.push({ t: coreName(state), hp: 1 });
    const holds = nsegs.reduce((n, sg) => n + sg.parts.filter((p) => p.hp > 0).reduce((m, p) => m + num(state.rules.parts[p.t].holds), 0), 0);
    const load = {};
    let room = holds;
    for (const kd of Object.keys(loadLeft)) { const take = Math.min(room, loadLeft[kd]); if (take) { load[kd] = take; loadLeft[kd] -= take; room -= take; } }
    const ship = { id: nextId(state, s.owner), owner: s.owner, name: spec.id, flagship: !!spec.flagship, pos, segs: nsegs, load,
      dead: false, flares: s.flares.slice(), used: {}, pd: 0, turnStart: pos.slice() };
    state.ships.push(ship);
    made.push(ship.id);
  }
  takeOff(state, s);
  refreshSight(state);
  emit(state, { t: 'split', ship: s.id, name: s.name, into: made }, everyone(state));
}
function takeOff(state, s) {
  state.ships.splice(state.ships.indexOf(s), 1);
  for (const pl of state.players) delete pl.seen[s.id];
  if (state.script) state.script.gone[s.name] = true;
}
const coreName = (state) => Object.keys(state.rules.parts).find((k) => state.rules.parts[k].required) || 'core';

// Two touching ships of one side become one. kind 'dock' (human clamps: extra cores cost
// command points) or 'weave' (Graft: no penalty, leaves a Weave seam).
export function join(state, a, b, kind, scripted) {
  if (a.owner !== b.owner) no('both ships must be yours');
  const A = footprint(a), B = footprint(b);
  if (!A.some((c) => B.some((d) => dist(c, d) === 1))) no('the ships must be touching');
  if (a.segs.length + b.segs.length > state.rules.seg.max) no('together they would be bigger than ' + state.rules.seg.max + ' segments');
  if (b.flagship && !a.flagship) [a, b] = [b, a];   // the flagship keeps its identity
  const add2 = b.segs.map((sg) => ({ ...sg, off: [b.pos[0] + sg.off[0] - a.pos[0], b.pos[1] + sg.off[1] - a.pos[1]] }));
  a.segs = a.segs.concat(add2);
  for (const [kd, n] of Object.entries(b.load)) a.load[kd] = (a.load[kd] || 0) + n;
  a.seams = (a.seams || []).concat({ kind, with: b.name, cells: add2.map((sg) => sg.off.slice()) });
  takeOff(state, b);
  const flag = (kind === 'weave' ? 'grafted:' : 'docked:') + [a.name, b.name].sort().join('+');
  if (state.script) state.script.flags[flag] = true;
  emit(state, { t: kind === 'weave' ? 'grafted' : 'docked', ship: a.id, with: b.id, name: a.name, other: b.name, scripted: !!scripted }, everyone(state));
  return a;
}

// Player orders: { type: 'graft' | 'dock', ship, with }.
export function doJoin(state, a) {
  const p = current(state), s1 = shipById(state, a.ship), s2 = shipById(state, a.with);
  if (!s1 || !s2 || s1.owner !== p || s2.owner !== p) no('pick two of your ships');
  const cost = num(state.rules.cost[a.type], 1), pl = state.players[p];
  if (pl.cp < cost) no('not enough command points');
  pl.cp -= cost;
  join(state, s1, s2, a.type === 'graft' ? 'weave' : 'dock', false);
}

// A forced order, carried out on the ship owner's turn without asking.
function forced(state, s, order) {
  const [k] = Object.keys(order), v = order[k];
  try {
    if (k === 'move_toward') {
      const t = live(state, v);
      if (!t) return;
      const opts = reach(state, s.id);
      if (!opts.length) return;
      const save = s.pos;
      let best = null;
      for (const r of opts) { s.pos = r.at; const d = gap(s, t); if (!best || d < best.d) best = { d, path: r.path }; }
      s.pos = save;
      if (best && best.d < gap(s, t)) { doMove(state, { type: 'move', ship: s.id, path: best.path }); emit(state, { t: 'forced', ship: s.id, order: 'move' }, everyone(state)); }
    } else if (k === 'fire_at') {
      const t = live(state, v);
      if (!t) return;
      const shot = beamTargets(state, s.id).find((x) => x.target === t.id);
      if (shot) { doFire(state, { type: 'fire', ship: s.id, seg: shot.seg, part: shot.part, at: shot.at }); emit(state, { t: 'forced', ship: s.id, order: 'fire' }, everyone(state)); }
    }
  } catch (e) { /* an order that can't be carried out is skipped */ }
}

// Change a world-file value mid-battle: rebuild the rules from the patched world.
function setRule(state, path, value) {
  const C = state.rules.campaign, src = structuredClone(C.src);
  setPath(src.world, path, value);
  const built = buildRules(src.world, src.map, src.fleets).rules;
  const next = { ...built, fleets: state.rules.fleets, campaign: { ...C, src } };
  state.rules = next;
  emit(state, { t: 'rule_changed', path, value }, everyone(state));
}
export function setPath(obj, path, value) {
  const ks = String(path).split('.');
  let o = obj;
  for (const k of ks.slice(0, -1)) { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; }
  o[ks[ks.length - 1]] = value;
}

// ---------------------------------------------------------------- the end
function finish(state, result, by) {
  if (state.phase !== 'play') return;
  const C = state.rules.campaign;
  state.phase = 'over';
  state.winner = result === 'win' ? 0 : result === 'lose' ? 1 : result;
  state.script.result = result;
  const sc = (C.scenes || {})[result === 'win' ? 'win' : result === 'lose' ? 'lose' : 'tbc'];
  for (const id of [].concat(sc || [])) emit(state, { t: 'scene', id, at: 'outro' }, everyone(state));
  emit(state, { t: 'game_over', winner: state.winner, by, result }, everyone(state));
}

// Chapter win / lose. Without its own conditions a chapter is won by destroying every enemy
// flagship (spawned or waiting to arrive) and lost when the player's flagship falls.
function checkEnd(state) {
  if (state.phase !== 'play') return true;
  const C = state.rules.campaign;
  const lose = C.lose && C.lose.length ? C.lose.some((t) => test(state, t)) : defaultLost(state, 0);
  if (lose) { finish(state, 'lose', 'chapter'); return true; }
  const win = C.win && C.win.length ? C.win.some((t) => test(state, t)) : defaultLost(state, 1);
  if (win) { finish(state, 'win', 'chapter'); return true; }
  return false;
}
function defaultLost(state, p) {
  const sc = state.script, flags = state.ships.filter((s) => s.owner === p && s.flagship);
  const waiting = state.rules.fleets[p].ships.some((d) => d.flagship && d.reserve && !sc.gone[d.name] && !state.ships.some((s) => s.name === d.name));
  if (waiting) return false;   // its flagship hasn't arrived yet
  return flags.length > 0 && flags.every((s) => s.dead);
}

// ---------------------------------------------------------------- the computer, per ship
export function profileFor(state, s) {
  const C = state.rules.campaign, sc = state.script;
  if (!C || !sc) return null;
  const name = sc.ai[s.name] || sc.ai['side:' + s.owner] || (C.ai || {})[s.name] || ((C.ai || {}).sides || {})[s.owner];
  return name ? (C.aiProfiles || {})[name] || null : null;
}
