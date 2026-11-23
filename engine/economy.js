// Economy mode ("Frontier", the third rapid experiment; design: GameDev project doc
// claude/shatkon-economy-mode-draft.md). Slice 1: earning salvage. Slice 2: the first thing to buy,
// the threat heatmap (see "Spending" below).
//
// Salvage (◈) is one purse for the whole fleet, hidden from the enemy. It is earned at the end of
// every tick (engine/rapid.js calls econTick), in this order, up to a cap a tick:
//   - first crossing: the first time a ship of yours is on or past your line        3, once a game
//   - kills: an enemy ship destroyed (not one that went silent)                       2 a segment
//   - holding: each of your ships on or past the line                                 1 a tick
//   - new ground: a hex your side has never entered, in the enemy's half              1 a hex
//     (past the centre row; with ownHalf on, anywhere), and +1 if it is next to an asteroid
// Hexes your ships start on count as entered. Every amount and the cap are settings (ECON_DEFAULTS);
// everything lives in state.econ, so a replay from the seed rebuilds the purse exactly.

import { cellsOf, emit, geom, footprint, num, no, occupancy, makeObj, objById, shipById, nearestCell, segHex } from './state.js';
import { key, DIRS, add, dist, sightLine } from './hex.js';
import { beamHitsAt } from './actions.js';
import { visibleTo } from './detect.js';
import { applyHits, removeObj } from './damage.js';
import { pastLine, rowsForward } from './rapidrules.js';

export const ECON_DEFAULTS = {
  cap: 6,          // most salvage a side can earn in one tick
  ownHalf: false,  // does new ground in your own half pay too?
  newHex: 1,       // a hex never entered before, in the enemy's half
  asteroid: 1,     // extra when that hex is next to an asteroid
  cross: 3,        // the first time one of your ships is on or past your line (once a game)
  hold: 1,         // each of your ships on or past the line, every tick
  kill: 2,         // each segment of an enemy ship destroyed
  heatmap: 6,      // the heatmap's price
  heatTicks: 2,    // how many of your next ticks it is shown for
  turret: 8,       // a turret's price
  turretUpkeep: 1, // salvage for each turret every turretEvery ticks (from the tick after it is placed); short of it, the oldest go dark until paid again
  turretEvery: 3,  // ticks between upkeep payments (23 Nov: every tick made turrets cost more than they gave)
  idle: 1,         // a side that passes (no ship moves or acts, nothing bought) earns nothing that tick and loses this
  turretHits: 1,   // hits a turret's shot does (24 Nov: 2 -> 1, traded for reach and stealth)
  turretRange: 7,  // how far a turret shoots (4, then 6: turrets were picked off from out of reach)
  turretSig: -2,   // a turret's signature: seen from about 2 hexes closer than a scout (was 1)
  turretHp: 2,     // hits a turret takes before it is destroyed
  upgrade: 10,     // one upgrade for one ship (once per ship)
  resupply: 5,     // +1 missile for a ship with a working magazine and room
};
export const TURRET = 'turret';

export const econOn = (state) => !!(state && state.rules.rapid && state.rules.rapid.economy === 'on' && state.econ);

// The economy numbers for this game: the defaults, then the board file's `econ:`, then the settings sheet.
export function econConfig(rules) {
  const o = (rules && rules.rapid) || {};
  const c = { ...ECON_DEFAULTS, ...(o.econ || {}) };
  if (o.econCap != null && o.econCap !== '') c.cap = Number(o.econCap);
  if (o.econOwnHalf != null) c.ownHalf = o.econOwnHalf === true || o.econOwnHalf === 'yes';
  if (o.econHeatmap != null && o.econHeatmap !== '') c.heatmap = Number(o.econHeatmap);
  if (o.econTurret != null && o.econTurret !== '') c.turret = Number(o.econTurret);
  if (o.econUpgrade != null && o.econUpgrade !== '') c.upgrade = Number(o.econUpgrade);
  if (o.econTurretRange != null && o.econTurretRange !== '') c.turretRange = Number(o.econTurretRange);
  if (o.econUpkeepEvery != null && o.econUpkeepEvery !== '') { const v = Number(o.econUpkeepEvery); c.turretEvery = v > 0 ? v : 1; if (v === 0) c.turretUpkeep = 0; }
  if (o.econIdle != null && o.econIdle !== '') c.idle = Number(o.econIdle);
  return c;
}

// Hexes next to an asteroid (worked out once per rules).
const nearRock = new WeakMap();
function rockSide(rules) {
  let m = nearRock.get(rules);
  if (m) return m;
  m = new Set();
  const rock = new Set();
  for (const t of rules.terrain || []) if (t.type === 'asteroid') for (const c of t.cells) rock.add(key(c));
  for (const k of rock) {
    const c = k.split(',').map(Number);
    for (const d of DIRS) { const n = key(add(c, d)); if (!rock.has(n)) m.add(n); }
  }
  nearRock.set(rules, m);
  return m;
}
export const nextToAsteroid = (rules, c) => rockSide(rules).has(key(c));

// Is hex c in side p's enemy half (past the centre row)?
export const inEnemyHalf = (state, p, c) => rowsForward(state, p, c) > state.rules.board.radius;

// Start the economy (rapidStart calls this when the economy is on).
export function econStart(s) {
  s.econ = { purse: [0, 0], earned: [0, 0], spent: [{}, {}], crossed: [false, false], seen: [{}, {}], perTick: [[], []], heat: [0, 0] };
  for (const x of s.ships) if (!x.dead) for (const c of cellsOf(x)) s.econ.seen[x.owner][key(c)] = 1;
}

// What a hex pays side p the first time it enters it.
export function hexValue(state, p, c, cfg = econConfig(state.rules)) {
  if (!cfg.ownHalf && !inEnemyHalf(state, p, c)) return 0;
  return cfg.newHex + (nextToAsteroid(state.rules, c) ? cfg.asteroid : 0);
}

// End of a tick: pay both sides. `before` is the state the tick started from (to tell who died this tick).
export function econTick(s, before, acts = []) {
  if (!econOn(s)) return;
  const cfg = econConfig(s.rules), E = s.econ;
  const wasAlive = new Set(before.ships.filter((x) => !x.dead).map((x) => x.id));
  for (const p of [0, 1]) {
    const items = [];   // { ship, why, n, at }
    const mine = s.ships.filter((x) => x.owner === p && !x.dead);
    const past = mine.filter((x) => pastLine(s, x));
    if (past.length && !E.crossed[p]) { E.crossed[p] = true; if (cfg.cross) items.push({ ship: past[0].id, why: 'cross', n: cfg.cross, at: past[0].pos.slice() }); }
    for (const x of s.ships) if (x.owner !== p && x.dead && !x.converted && wasAlive.has(x.id) && cfg.kill) items.push({ ship: x.id, why: 'kill', n: cfg.kill * x.segs.length, at: x.pos.slice() });
    if (cfg.hold) for (const x of past) items.push({ ship: x.id, why: 'hold', n: cfg.hold, at: x.pos.slice() });
    for (const x of mine) for (const c of cellsOf(x)) {
      const k = key(c);
      if (E.seen[p][k]) continue;
      E.seen[p][k] = 1;
      const v = hexValue(s, p, c, cfg);
      if (v) items.push({ ship: x.id, why: nextToAsteroid(s.rules, c) && v > cfg.newHex ? 'rock' : 'ground', n: v, at: c.slice() });
    }
    // the cap: items are paid in order until it is reached (the last one may be cut short)
    let left = Number.isFinite(cfg.cap) && cfg.cap > 0 ? cfg.cap : Infinity, total = 0;
    const paid = [];
    for (const it of items) {
      if (left <= 0) break;
      const n = Math.min(it.n, left);
      left -= n; total += n; paid.push(n === it.n ? it : { ...it, n, capped: true });
    }
    // sitting still costs: a side that passed earns nothing this tick and loses `idle` (never below 0)
    if (cfg.idle && acts[p] && acts[p].type === 'pass') {
      const loss = Math.min(cfg.idle, E.purse[p]);
      E.purse[p] -= loss; E.spent[p].idle = (E.spent[p].idle || 0) + loss;
      E.perTick[p].push(-loss);
      emit(s, { t: 'idle', player: p, lost: loss, missed: total, purse: E.purse[p] }, [p]);
      payUpkeep(s, p, cfg);
      continue;
    }
    E.perTick[p].push(total);
    if (total) {
      E.purse[p] += total; E.earned[p] += total;
      emit(s, { t: 'earned', player: p, amount: total, purse: E.purse[p], items: paid, capped: items.reduce((a, it) => a + it.n, 0) > total }, [p]);
    }
    payUpkeep(s, p, cfg);
  }
}

export const purse = (state, p) => (state.econ ? state.econ.purse[p] : 0);

// Enemy-half hexes side p has not entered yet (the screen outlines them: where the money is).
export function newGround(state, p) {
  if (!econOn(state)) return [];
  const R = state.rules.board.radius, out = [], seen = state.econ.seen[p];
  const cfg = econConfig(state.rules);
  for (let q = -R; q <= R; q++) for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) {
    const c = [q, r];
    if (seen[key(c)] || geom(state.rules).blockMove.has(key(c)) || !hexValue(state, p, c, cfg)) continue;
    out.push({ at: c, rock: nextToAsteroid(state.rules, c) });
  }
  return out;
}

// ---------- spending ----------
// Buying is the side's whole action for the tick: { type: 'buy', item }. Paid before the tick's shots,
// so this tick's earnings can't pay for it. The enemy sees nothing of it.
export const SHOP = {
  heatmap: { label: 'Heatmap', about: 'where the enemy ships you know of could hit next tick' },
  turret: { label: 'Turret', about: 'the selected ship leaves one laser behind as a turret on a free hex next to it', needsShip: true },
  upgrade: { label: 'Upgrade', about: 'one ship, once: +1 laser range, faster shields, +1 sensor or +1 armour', needsShip: true },
  resupply: { label: 'Resupply', about: '+1 missile for a ship with a working magazine and room', needsShip: true },
};

// ---------- upgrades ----------
// Each upgrade swaps a ship's parts for an "_up" copy of the part (rapidRules adds the copies when the
// economy is on), so every rule that reads a part's numbers sees the better one, and a scan shows it.
//   range:  every laser +1 range            shield: every shield comes back 1 tick sooner
//   sensor: the core sees 1 hex further      armour: one armour plate +1 hp (the core segment's first)
export const UPGRADES = {
  range: { label: '+1 laser range', test: (c) => num(c.range) > 0 && num(c.hits) > 0 },
  shield: { label: 'Shields back a tick sooner', test: (c) => !!c.recharges },
  sensor: { label: '+1 sensor range', test: (c) => !!c.required && num(c.sensor_range) > 0 },   // the core's own sensor: +1 in all
  armour: { label: '+1 armour', test: (c) => num(c.hp) > 1 && !c.recharges && !c.required && !num(c.hits) && !c.launches && !c.thrust && !c.holds },
};
const UP = '_up';
// The "_up" part copies for a game's parts (called by rapidRules; parts already scaled to ticks).
export function upgradeParts(parts) {
  const out = {};
  for (const [name, c] of Object.entries(parts)) {
    if (name.endsWith(UP)) continue;
    let u = null;
    if (UPGRADES.range.test(c)) u = { ...c, range: num(c.range) + 1 };
    else if (UPGRADES.shield.test(c)) u = { ...c, recharge_every: Math.max(1, num(c.recharge_every, 1) - 1) };
    else if (UPGRADES.sensor.test(c)) u = { ...c, sensor_range: num(c.sensor_range) + 1 };
    else if (UPGRADES.armour.test(c)) u = { ...c, hp: num(c.hp) + 1 };
    if (u) out[name + UP] = { ...u, upgraded: true, label: (c.label || name) + ' (upgraded)', note: (c.note ? c.note + ' ' : '') + '(upgraded)' };
  }
  return out;
}
// The parts an upgrade would change on this ship: [{ p, si, pi }]
function upgradeTargets(state, x, kind) {
  const U = UPGRADES[kind];
  if (!U) return [];
  const out = [];
  x.segs.forEach((sg, si) => { if (!sg.wrecked) sg.parts.forEach((part, pi) => { const c = state.rules.parts[part.t]; if (c && (part.hp > 0 || c.recharges) && U.test(c) && !part.t.endsWith(UP) && state.rules.parts[part.t + UP]) out.push({ p: part, si, pi }); }); });
  if (kind === 'armour' && out.length > 1) { const core = out.find((o) => x.segs[o.si].parts.some((q) => state.rules.parts[q.t] && state.rules.parts[q.t].required)); return [core || out[0]]; }
  return out;
}
// Why this ship can't take this upgrade (null when it can).
export function upgradeRefusal(state, p, shipId, kind) {
  const x = shipById(state, shipId);
  if (!x || x.owner !== p) return 'choose one of your ships';
  if (x.upgraded) return x.id + ' already has its upgrade (' + UPGRADES[x.upgraded].label + ')';
  if (!UPGRADES[kind]) return 'there is no such upgrade';
  if (!upgradeTargets(state, x, kind).length) return x.id + ' has no working part that upgrade improves';
  return null;
}
// ---------- resupply ----------
// Room for missiles: what the ship's working magazines hold, less what it carries.
export function magazineRoom(state, x) {
  let holds = 0;
  for (const sg of x.segs) if (!sg.wrecked) for (const part of sg.parts) if (part.hp > 0) holds += num(state.rules.parts[part.t].holds);
  const loaded = Object.values(x.load || {}).reduce((a, n) => a + num(n), 0);
  return holds ? holds - loaded : 0;
}
// The missile a resupply adds: the kind the ship carries most of, else the most basic missile there is.
function resupplyKind(state, x) {
  const have = Object.entries(x.load || {}).filter(([k]) => state.rules.munitions[k]).sort((a, b) => b[1] - a[1]);
  if (have.length && have[0][1] > 0) return have[0][0];
  if (have.length) return have[0][0];
  const mis = Object.entries(state.rules.munitions).filter(([, m]) => m.family === 'missile').sort((a, b) => num(a[1].cost) - num(b[1].cost));
  return mis.length ? mis[0][0] : null;
}
export function resupplyRefusal(state, p, shipId) {
  const x = shipById(state, shipId);
  if (!x || x.owner !== p) return 'choose one of your ships';
  if (!x.segs.some((sg) => !sg.wrecked && sg.parts.some((q) => q.hp > 0 && state.rules.parts[q.t].launches))) return x.id + ' has no working launcher';
  if (magazineRoom(state, x) <= 0) return x.id + ' has no room in a working magazine';
  if (!resupplyKind(state, x)) return 'no missile to load';
  return null;
}
export const price = (state, item) => num(econConfig(state.rules)[item]);

// Why side p can't buy this now (null when it can).
export function buyRefusal(state, p, a) {
  if (!econOn(state)) return 'there is nothing to buy in this game';
  if (!SHOP[a.item]) return 'that is not for sale';
  const cost = price(state, a.item);
  if (state.econ.purse[p] < cost) return 'not enough salvage: ' + a.item + ' costs ' + cost + ', you have ' + state.econ.purse[p];
  if (a.item === 'upgrade') return upgradeRefusal(state, p, a.ship, a.kind);
  if (a.item === 'resupply') return resupplyRefusal(state, p, a.ship);
  if (a.item === 'turret') {
    const x = shipById(state, a.ship);
    if (!x || x.owner !== p) return 'choose one of your ships to leave the turret';
    if (!droppableLaser(state, x)) return 'that ship has no working laser to leave behind';
    if (!Array.isArray(a.at) || !turretSpots(state, p, a.ship).some((c) => c[0] === a.at[0] && c[1] === a.at[1])) return 'a turret goes on a free hex next to the ship';
  }
  return null;
}
export function doBuy(s, p, a) {
  const why = buyRefusal(s, p, a);
  if (why) no(why);
  const cost = price(s, a.item), E = s.econ;
  E.purse[p] -= cost;
  E.spent[p][a.item] = (E.spent[p][a.item] || 0) + cost;
  // the heatmap shows on this side's next heatTicks ticks (the tick it is bought in is already spent)
  if (a.item === 'heatmap') E.heat[p] = s.round + num(econConfig(s.rules).heatTicks, 2);
  let extra = {};
  if (a.item === 'turret') {
    // the ship gives up one working laser (the one nearest the turret's hex) and the turret appears there
    const x = shipById(s, a.ship), las = droppableLaser(s, x, a.at);
    las.p.hp = 0; las.p.dropped = true;
    const o = makeObj(s, TURRET, p, a.at, 0, { hp: num(econConfig(s.rules).turretHp, 2), born: s.round, from: x.id });
    s.objs.push(o);
    extra = { ship: x.id, at: a.at.slice(), obj: o.id };
  }
  if (a.item === 'upgrade') {
    const x = shipById(s, a.ship);
    for (const t of upgradeTargets(s, x, a.kind)) { t.p.t += UP; if (a.kind === 'armour') t.p.hp += 1; }
    x.upgraded = a.kind;
    extra = { ship: x.id, kind: a.kind };
  }
  if (a.item === 'resupply') {
    const x = shipById(s, a.ship), k = resupplyKind(s, x);
    x.load = { ...(x.load || {}) }; x.load[k] = (x.load[k] || 0) + 1;
    extra = { ship: x.id, kind: k };
  }
  emit(s, { t: 'bought', player: p, item: a.item, cost, purse: E.purse[p], ...extra }, [p]);
}

// ---------- turrets ----------
const isLaser = (state, part) => { const c = state.rules.parts[part.t]; return !!(c && num(c.range) && num(c.hits)) && part.hp > 0 && !part.off; };
// A working laser the ship could leave behind (the one nearest hex `near`, if given), or null.
export function droppableLaser(state, x, near) {
  let best = null, bd = Infinity;
  x.segs.forEach((sg, si) => {
    if (sg.wrecked) return;
    sg.parts.forEach((part, pi) => {
      if (!isLaser(state, part)) return;
      const d = near ? dist(segHex(x, si), near) : 0;
      if (d < bd) { bd = d; best = { p: part, si, pi }; }
    });
  });
  return best;
}
// Free hexes next to the ship where its turret could go: on the board, no asteroid, no ship, no object.
export function turretSpots(state, p, shipId) {
  const x = shipById(state, shipId);
  if (!x || x.owner !== p || !droppableLaser(state, x)) return [];
  const g = geom(state.rules), occ = occupancy(state), taken = new Set(state.objs.map((o) => key(o.pos))), out = new Map();
  for (const c of footprint(x)) for (const d of DIRS) {
    const n = add(c, d), k = key(n);
    if (out.has(k) || !g.inside(n) || g.blockMove.has(k) || occ.has(k) || taken.has(k)) continue;
    out.set(k, n);
  }
  return [...out.values()];
}
export const isTurret = (o) => !!o && o.kind === TURRET;
export const turretLive = (o) => isTurret(o) && !o.dark;

// The turrets fire (rapidTick, with both sides' shots): each working turret shoots the nearest enemy
// ship, missile, drone or turret its side can see, within its range and with a clear line. Hits on
// ships are held back with the tick's other laser hits; missiles and turrets are hit at once.
export function turretsFire(s) {
  if (!econOn(s)) return;
  const cfg = econConfig(s.rules), g = geom(s.rules);
  for (const t of s.objs.filter(turretLive)) {
    const p = t.owner, vis = visibleTo(s, p);
    let best = null, bd = Infinity;
    const consider = (thing, at, seg) => {
      const d = dist(t.pos, at);
      if (d < 1 || d > cfg.turretRange || d >= bd || !sightLine(t.pos, at, (h) => g.blockSight.has(key(h)))) return;
      bd = d; best = { thing, at, seg };
    };
    for (const x of s.ships) {
      if (x.dead || x.owner === p || !vis.has(x.id)) continue;
      const c = nearestCell(x, t.pos), si = footprint(x).findIndex((h) => h[0] === c[0] && h[1] === c[1]);
      if (!x.segs[si].wrecked) consider(x, c, si);
    }
    for (const o of s.objs) if (o.owner !== p && vis.has(o.id) && (num(s.rules.munitions[o.kind].speed) > 0 || isTurret(o))) consider(o, o.pos, -1);
    if (!best) continue;
    const hits = cfg.turretHits, seenBy = [...new Set([p, best.thing.owner])];
    emit(s, { t: 'turret_fire', obj: t.id, owner: p, from: t.pos.slice(), at: best.at.slice(), target: best.thing.id, hits }, seenBy);
    if (best.thing.segs) { if (s.deferHits) s.deferHits.push({ ship: best.thing.id, seg: best.seg, hits, cause: 'turret', by: t.id }); else applyHits(s, best.thing, best.seg, hits, 'turret'); }
    else hitObject(s, best.thing, hits);
  }
}
// A laser or turret shot on an object: turrets soak hits (hp); anything else is destroyed.
export function hitObject(s, o, hits) {
  if (!objById(s, o.id)) return;
  if (isTurret(o) && num(o.hp) > hits) {
    o.hp -= hits;
    emit(s, { t: 'turret_hit', obj: o.id, owner: o.owner, at: o.pos.slice(), hits, hp: o.hp }, s.players.map((_, i) => i));
    return;
  }
  removeObj(s, o);
  emit(s, { t: 'obj_destroyed', kind: o.kind, obj: o.id, at: o.pos.slice() }, s.players.map((_, i) => i));
}
// Upkeep, at the end of each tick after earnings: each turret costs its side turretUpkeep, starting the
// tick after it was placed. Paid newest first; a turret that can't be paid is dark (doesn't fire) until a
// later tick pays for it again, so the oldest go dark first when salvage runs short.
function payUpkeep(s, p, cfg) {
  const all = s.objs.filter((o) => isTurret(o) && o.owner === p).sort((a, b) => b.born - a.born || (a.id < b.id ? 1 : -1));
  if (!all.length) return;
  if (cfg.turretUpkeep && s.round % Math.max(1, cfg.turretEvery) !== 0) return;   // upkeep falls due every turretEvery ticks
  let paid = 0, n = 0;
  for (const o of all) {
    if (o.born >= s.round) { o.dark = false; continue; }   // placed this tick: first upkeep next tick
    const was = !!o.dark;
    if (s.econ.purse[p] - paid >= cfg.turretUpkeep) { paid += cfg.turretUpkeep; n++; o.dark = false; if (was) emit(s, { t: 'turret_lit', obj: o.id, at: o.pos.slice() }, [p]); }
    else { o.dark = true; if (!was) emit(s, { t: 'turret_dark', obj: o.id, at: o.pos.slice() }, [p]); }
  }
  if (!paid) return;
  s.econ.purse[p] -= paid;
  s.econ.spent[p].upkeep = (s.econ.spent[p].upkeep || 0) + paid;
  emit(s, { t: 'upkeep', player: p, amount: paid, turrets: n, purse: s.econ.purse[p] }, [p]);
}
// Is side p's heatmap showing now? (between ticks, state.round is the tick about to be chosen)
export const heatOn = (state, p) => econOn(state) && (state.econ.heat || [0, 0])[p] >= state.round;

// The threat heatmap: every hex a known enemy ship could hit with a laser next tick, and the hits a
// single shot would do there; and where its missiles could reach within the heatmap's 2 ticks.
// Built only from what side p knows: enemy ships it can see now (hidden ones don't show). A ship it has
// scanned uses its known working lasers and launchers; one it hasn't is assumed to carry the best laser
// on every segment and no known launcher.
//   -> Map(hexKey -> { at, hits, n, missile })   hits: the most one shot could do; n: how many ships reach it
export function threatMap(state, p) {
  const pl = state.players[p], vis = new Set(pl.vis), g = geom(state.rules), out = new Map();
  const P = state.rules.parts;
  let best = null;
  for (const c of Object.values(P)) if (num(c.range) && num(c.hits) && (!best || num(c.hits) > num(best.hits))) best = c;
  let mSpeed = 0;
  for (const m of Object.values(state.rules.munitions)) if (m.family === 'missile') mSpeed = Math.max(mSpeed, num(m.speed));
  const R = state.rules.rapid || {};
  const run = R.attackRun !== 'off' ? num(state.rules.det.attackRun) : 0;
  const ticks = num(econConfig(state.rules).heatTicks, 2);
  const get = (c) => { const k = key(c); let o = out.get(k); if (!o) { o = { at: c, hits: 0, n: 0, missile: false }; out.set(k, o); } return o; };
  const ring = (src, rad, f) => { for (let q = -rad; q <= rad; q++) for (let r = Math.max(-rad, -q - rad); r <= Math.min(rad, -q + rad); r++) { const c = [src[0] + q, src[1] + r]; if (g.inside(c) && !g.blockMove.has(key(c))) f(c, dist(src, c)); } };
  for (const e of state.ships) {
    if (e.dead || e.owner === p || !vis.has(e.id)) continue;
    const intel = pl.intel[e.id];
    const cells = footprint(e);
    // the guns: [source hex, part rules]
    const guns = [];
    let launcher = false;
    if (intel && Object.keys(intel).length) {
      e.segs.forEach((sg, i) => {
        const it = intel[i];
        if (!it || it.wrecked) return;
        for (const q of it.parts) {
          const c = P[q.t];
          if (!c || q.hp <= 0) continue;
          if (num(c.range) && num(c.hits)) guns.push([cells[i], c]);
          if (c.launches) launcher = true;
        }
      });
    } else if (best) for (const c of cells) guns.push([c, best]);
    const ran = run && state.rapid && state.rapid.movedLast && state.rapid.movedLast[e.id] ? run : 0;
    const hitBy = new Map();   // this ship's best shot on each hex
    for (const [src, c] of guns) ring(src, num(c.range), (h, d) => {
      if (d < 1 || !sightLine(src, h, (x) => g.blockSight.has(key(x)))) return;
      const hits = beamHitsAt(c, d) + ran;
      const k = key(h);
      if (hits > 0 && (hitBy.get(k) || [0])[0] < hits) hitBy.set(k, [hits, h]);
    });
    for (const [, [hits, h]] of hitBy) { const o = get(h); o.n++; if (hits > o.hits) o.hits = hits; }
    if (launcher && mSpeed) for (const src of cells) ring(src, mSpeed * ticks, (h, d) => { if (d >= 1) get(h).missile = true; });
  }
  // enemy turrets you can see: their fixed shot within their range
  const tc = econConfig(state.rules);
  for (const t of state.objs) {
    if (!turretLive(t) || t.owner === p || !vis.has(t.id)) continue;
    ring(t.pos, tc.turretRange, (h, d) => {
      if (d < 1 || !sightLine(t.pos, h, (x) => g.blockSight.has(key(x)))) return;
      const o = get(h); o.n++; if (tc.turretHits > o.hits) o.hits = tc.turretHits;
    });
  }
  return out;
}

// Words for the log and the screen.
export const BUY_WORDS = { heatmap: 'a threat heatmap', turret: 'a turret', upgrade: 'an upgrade', resupply: 'a missile' };
export const EARN_WORDS = { cross: 'first across the line', kill: 'enemy ship destroyed', hold: 'holding past the line', ground: 'new ground', rock: 'new ground by an asteroid' };
