// The mechanics behind the experiments in engine/experiments.js. Every function here does nothing
// unless its experiment is on (exp(state, key)), so the normal game is untouched.
//
//   ghost       convertShip: the new object is hidden from the enemy for 2 ticks
//   stateMines  convertShip: which mine a scout becomes depends on its laser and sensor
//   ram         a { type: 'ram', ship, target } action
//   decoy       a { type: 'decoy', ship, at } action; decoys expire; missiles go for them
//   repair, warp, hibernate: shop items (engine/economy.js calls labBuyRefusal / labBuy)
import { exp } from './experiments.js';
import { shipById, objById, footprint, cellsOf, geom, occupancy, makeObj, emit, gap, num, no, segHex } from './state.js';
import { key, dist, add, DIRS } from './hex.js';
import { visibleTo } from './detect.js';
import { applyHits, removeObj } from './damage.js';
import { rowsForward } from './rapidrules.js';

// ---------- extra munitions (rapidRules adds them when any experiment is on) ----------
export const LAB_MUNITIONS = {
  // stateMines: what a converted scout becomes
  smart_mine: { label: 'Smart mine', speed: 0, hits: 4, blast_radius: 0, signature: -8, trigger_range: 3, wrecks_segment: true, setup_only: true, max_per_player: 99, cost: 0, note: 'laser and sensor were working: it fires a shaped charge at the first enemy within 3 and wrecks the nearest segment' },
  close_mine: { label: 'Close mine', speed: 0, hits: 4, blast_radius: 1, blast_hits: 4, signature: -10, trigger_range: 1, wrecks_segment: true, setup_only: true, max_per_player: 99, cost: 0, note: 'laser only: goes off at 1 hex; very hard to find' },
  lurker_mine: { label: 'Lurker', speed: 0, hits: 4, blast_radius: 0, signature: -8, trigger_range: 2, setup_only: true, max_per_player: 99, cost: 0, note: 'sensor only: goes off at 2 hexes, 4 hits' },
  dud_mine: { label: 'Dud mine', speed: 0, hits: 4, blast_radius: 0, signature: -4, trigger_range: 0, setup_only: true, max_per_player: 99, cost: 0, note: 'nothing left working: goes off only if a ship moves onto it' },
  // decoy: looks like a ship contact to the enemy; missiles that see it go for it
  decoy: { label: 'Decoy', speed: 0, hits: 0, blast_radius: 0, signature: 2, lures_missiles: true, setup_only: true, max_per_player: 99, cost: 0, note: 'a fake contact: lasts 3 ticks' },
};
export const MINE_KINDS = ['naval_mine', 'smart_mine', 'close_mine', 'lurker_mine', 'dud_mine'];

const works = (state, x, test) => x.segs.some((sg) => !sg.wrecked && sg.parts.some((q) => q.hp > 0 && !q.off && test(state.rules.parts[q.t] || {})));
const hasLaser = (state, x) => works(state, x, (c) => num(c.range) > 0 && num(c.hits) > 0);
const hasSensor = (state, x) => works(state, x, (c) => num(c.adds_range) > 0);

// stateMines: the mine a scout becomes
export function mineKindFor(state, x) {
  if (!exp(state, 'stateMines')) return 'naval_mine';
  const l = hasLaser(state, x), s = hasSensor(state, x);
  return l && s ? 'smart_mine' : l ? 'close_mine' : s ? 'lurker_mine' : 'dud_mine';
}
// ghost: how long a new object stays hidden from the enemy
export const ghostUntil = (state) => (exp(state, 'ghost') ? state.round + 2 : 0);
// detect.visibleTo asks this: is this object or ship hidden from side p right now?
export function hiddenFrom(state, p, t) {
  if (t.hidden && t.hidden >= state.round && t.owner !== p) return true;
  if (t.hib && t.owner !== p) {   // hibernating: seen only from 1 hex (a scan finds it too: detect's revealed())
    const close = state.ships.some((s) => !s.dead && s.owner === p && gap(s, t) <= 1);
    return !close;
  }
  return false;
}

// ---------- ram ----------
export function ramRefusal(state, p, a) {
  if (!exp(state, 'ram')) return 'ramming is an experiment that is off in this game';
  const x = shipById(state, a.ship), t = shipById(state, a.target);
  if (!x || x.owner !== p || x.dead) return 'choose one of your ships to ram';
  if (x.flagship || x.segs.length !== 1) return 'only a one-hex ship (not the flagship) can ram';
  if (!t || t.dead || t.owner === p) return 'ram an enemy ship';
  if (!visibleTo(state, p).has(t.id)) return 'you can only ram a ship you can see';
  if (gap(x, t) > 2) return t.id + ' is ' + gap(x, t) + ' hexes away: a ram reaches 2';
  return null;
}
// The ram is gone; the target's segment nearest the ram takes every hit it can hold (shields too).
export function doRam(s, p, a) {
  const x = shipById(s, a.ship), t = shipById(s, a.target);
  const cells = footprint(t);
  let si = 0;
  cells.forEach((c, i) => { if (!t.segs[i].wrecked && dist(c, x.pos) < dist(cells[si], x.pos)) si = i; });
  const all = t.segs[si].parts.reduce((n, q) => n + Math.max(0, q.hp), 0) + 1;
  x.dead = true; x.converted = 'ram';
  emit(s, { t: 'rammed', ship: x.id, target: t.id, seg: si, at: segHex(t, si) }, s.players.map((_, i) => i));
  if (s.deferHits) s.deferHits.push({ ship: t.id, seg: si, hits: all, cause: 'ram', owner: p });
  else if (s.lastHit) { const was = s.attacker; s.attacker = p; applyHits(s, t, si, all, 'ram'); s.attacker = was; } else applyHits(s, t, si, all, 'ram');
}

// ---------- decoys ----------
const DECOY_MIN = 2, DECOY_MAX = 6, DECOY_LIFE = 3, DECOY_EVERY = 6;
const hasEmitter = (state, x) => works(state, x, (c) => c.lures_missiles === true);
export function decoySpots(state, p, shipId) {
  const x = shipById(state, shipId);
  if (!x || x.owner !== p || x.dead || !hasEmitter(state, x)) return [];
  const g = geom(state.rules), out = [];
  const things = state.ships.filter((z) => !z.dead).flatMap((z) => footprint(z)).concat(state.objs.map((o) => o.pos));
  const R = state.rules.board.radius;
  for (let q = -R; q <= R; q++) for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) {
    const c = [q, r], d = Math.min(...footprint(x).map((h) => dist(h, c)));
    if (d < DECOY_MIN || d > DECOY_MAX || g.blockMove.has(key(c))) continue;
    if (things.some((h) => dist(h, c) < 2)) continue;   // at least one empty hex from anything
    out.push(c);
  }
  return out;
}
export function decoyRefusal(state, p, a) {
  if (!exp(state, 'decoy')) return 'decoys are an experiment that is off in this game';
  const x = shipById(state, a.ship);
  if (!x || x.owner !== p || x.dead) return 'choose one of your ships';
  if (!hasEmitter(state, x)) return x.id + ' has no working emitter';
  if (x.decoyAt != null && state.round < x.decoyAt + DECOY_EVERY) return x.id + ' can make its next decoy on tick ' + (x.decoyAt + DECOY_EVERY);
  if (!Array.isArray(a.at) || !decoySpots(state, p, a.ship).some((c) => c[0] === a.at[0] && c[1] === a.at[1])) return 'a decoy goes 2–6 hexes away, with an empty hex around it';
  return null;
}
export function doDecoy(s, p, a) {
  const x = shipById(s, a.ship);
  x.decoyAt = s.round;
  const o = makeObj(s, 'decoy', p, a.at, 0, { until: s.round + DECOY_LIFE, from: x.id });
  s.objs.push(o);
  emit(s, { t: 'decoy', ship: x.id, at: a.at.slice(), obj: o.id, until: o.until }, [p]);
}

// ---------- end of every tick ----------
export function labTick(s) {
  // decoys fade
  for (const o of s.objs.slice()) if (o.kind === 'decoy' && o.until != null && s.round >= o.until) { removeObj(s, o); emit(s, { t: 'decoy_gone', obj: o.id, at: o.pos.slice() }, [o.owner]); }
  // hibernating ships: an enemy within 1 wakes them; otherwise a part comes back every 4 ticks
  for (const x of s.ships) {
    if (!x.hib || x.dead) continue;
    if (s.ships.some((e) => !e.dead && e.owner !== x.owner && gap(e, x) <= 1)) { wake(s, x, 'an enemy came close'); continue; }
    if (s.round >= x.hib.next) { x.hib.next = s.round + 4; mendOne(s, x); }
  }
}
export function wake(s, x, why) {
  if (!x.hib) return;
  delete x.hib;
  emit(s, { t: 'woke', ship: x.id, why, at: x.pos.slice() }, s.players.map((_, i) => i).filter((i) => i === x.owner));
}
// one part back: the outermost broken one (lowest layer), not wrecked segments or dropped lasers
function mendOne(s, x) {
  let best = null;
  x.segs.forEach((sg, si) => { if (!sg.wrecked) sg.parts.forEach((q) => { const c = s.rules.parts[q.t]; if (!c || q.dropped || q.hp >= num(c.hp, 1)) return; if (!best || num(c.layer) < num(s.rules.parts[best.q.t].layer)) best = { q, si }; }); });
  if (!best) return;
  best.q.hp = num(s.rules.parts[best.q.t].hp, 1);
  emit(s, { t: 'mended', ship: x.id, part: best.q.t, seg: best.si }, [x.owner]);
}

// ---------- shop items: repair, warp, hibernate ----------
export const LAB_SHOP = {
  repair: { label: 'Repair', about: 'one ship: every part back to full, except wrecked segments and lost lasers', needsShip: true, exp: 'repair', price: 12 },
  warp: { label: 'Warp', about: 'one ship jumps up to 4 hexes, staying in your own half', needsShip: true, exp: 'warp', price: 6, place: true },
  hibernate: { label: 'Hibernate', about: 'a ship next to an asteroid shuts down: hidden, mends a part every 4 ticks', needsShip: true, exp: 'hibernate', price: 2 },
};
const COOLDOWN = 10;
export function warpSpots(state, p, shipId) {
  const x = shipById(state, shipId);
  if (!x || x.owner !== p || x.dead) return [];
  const g = geom(state.rules), occ = occupancy(state), R = state.rules.board.radius, out = [];
  const shape = footprint(x).map((c) => [c[0] - x.pos[0], c[1] - x.pos[1]]);
  for (let q = -4; q <= 4; q++) for (let r = Math.max(-4, -q - 4); r <= Math.min(4, -q + 4); r++) {
    if (!q && !r) continue;
    const at = [x.pos[0] + q, x.pos[1] + r], cells = shape.map((d) => [at[0] + d[0], at[1] + d[1]]);
    if (cells.some((c) => !g.inside(c) || g.blockMove.has(key(c)) || (occ.has(key(c)) && occ.get(key(c)).ship.id !== x.id))) continue;
    if (cells.some((c) => rowsForward(state, p, c) > R)) continue;   // your own half only
    if (state.ships.some((e) => !e.dead && e.owner !== p && footprint(e).some((h) => cells.some((c) => dist(h, c) <= 1)))) continue;
    out.push(at);
  }
  return out;
}
const nextToRock = (state, x) => { const g = geom(state.rules); return footprint(x).some((c) => DIRS.some((d) => g.blockMove.has(key(add(c, d))))); };
export function labBuyRefusal(state, p, a) {
  const it = LAB_SHOP[a.item];
  if (!exp(state, it.exp)) return a.item + ' is an experiment that is off in this game';
  const x = shipById(state, a.ship);
  if (!x || x.owner !== p || x.dead) return 'choose one of your ships';
  if (a.item !== 'hibernate' && x['last_' + a.item] != null && state.round < x['last_' + a.item] + COOLDOWN) return x.id + ' can ' + a.item + ' again on tick ' + (x['last_' + a.item] + COOLDOWN);
  if (a.item === 'warp' && (!Array.isArray(a.at) || !warpSpots(state, p, x.id).some((c) => c[0] === a.at[0] && c[1] === a.at[1]))) return 'warp to a free spot up to 4 hexes away, in your own half, not next to an enemy';
  if (a.item === 'hibernate') {
    if (x.flagship) return 'the flagship can’t hibernate';
    if (x.hib) return x.id + ' is already hibernating';
    if (!nextToRock(state, x)) return 'a ship hibernates next to an asteroid';
  }
  if (a.item === 'repair' && !x.segs.some((sg) => !sg.wrecked && sg.parts.some((q) => !q.dropped && q.hp < num((state.rules.parts[q.t] || {}).hp, 1)))) return x.id + ' has nothing to repair';
  return null;
}
export function labBuy(s, p, a) {
  const x = shipById(s, a.ship), extra = { ship: x.id };
  x['last_' + a.item] = s.round;
  if (a.item === 'repair') {
    for (const sg of x.segs) if (!sg.wrecked) for (const q of sg.parts) { const c = s.rules.parts[q.t]; if (c && !q.dropped && !(num(c.range) && num(c.hits) && q.hp <= 0)) q.hp = num(c.hp, 1); }
  }
  if (a.item === 'warp') { extra.from = x.pos.slice(); x.pos = a.at.slice(); extra.at = a.at.slice(); }
  if (a.item === 'hibernate') x.hib = { since: s.round, next: s.round + 4 };
  return extra;
}
export { cellsOf, objById };
