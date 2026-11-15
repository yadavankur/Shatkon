// Damage: whole hits, a random part from the outermost layer still standing.
// Also explosions, ship death and the win check.

import { dist } from './hex.js';
import { rand, num, emit, segHex, workingParts, sumAttr, cellsOf, objById, hullPct, isProtected } from './state.js';
import { addFlare, visibleTo } from './detect.js';

const others = (state, p) => state.players.map((_, i) => i).filter((i) => i !== p);

export function removeObj(state, obj) {
  const i = state.objs.indexOf(obj);
  if (i >= 0) state.objs.splice(i, 1);
  for (const pl of state.players) delete pl.seen[obj.id];
}

// A ship cannot carry more munitions than its surviving magazines hold.
function clampLoad(state, ship) {
  const cap = sumAttr(state, ship, 'holds');
  const kinds = Object.keys(ship.load);
  let total = kinds.reduce((n, k) => n + ship.load[k], 0), lost = 0;
  for (let i = kinds.length - 1; total > cap && i >= 0; ) {
    if (ship.load[kinds[i]] > 0) { ship.load[kinds[i]]--; total--; lost++; } else i--;
  }
  if (lost) emit(state, { t: 'ammo_lost', ship: ship.id, count: lost }, [ship.owner]);
}

export function isDead(state, ship) {
  const rules = state.rules, live = [];   // switched-off parts still count as there
  for (const sg of ship.segs) if (!sg.wrecked) for (const p of sg.parts) if (p.hp > 0) live.push({ p, c: rules.parts[p.t] });
  for (const cond of rules.deadWhen) {
    if (cond === 'core_destroyed' && !live.some((x) => x.c.required)) return true;
    if (cond === 'all_segments_wrecked' && ship.segs.every((s) => s.wrecked)) return true;
    if (cond === 'nothing_but_engines') {
      const lostAny = ship.segs.some((s) => s.wrecked || s.parts.some((p) => p.hp <= 0 && !rules.parts[p.t].recharges));
      if (lostAny && live.every((x) => x.c.thrust || x.c.required)) return true;
    }
  }
  return false;
}

// opts.pierce: shields don't soak these hits. opts.prefer: a part type hit first, ignoring layers
// (mines with strikes: engines leave a ship dead in the water).
export function applyHits(state, ship, si, n, cause, opts = {}) {
  if (ship.dead || n <= 0) return;
  const sg = ship.segs[si], lost = [], guard = isProtected(state, ship);
  for (let i = 0; i < n && !sg.wrecked; i++) {
    let live = sg.parts.map((p) => ({ p, c: state.rules.parts[p.t] })).filter((x) => x.p.hp > 0 && !x.p.off && !(opts.pierce && x.c.recharges));
    // a protected ship (story rails) never loses its core: the hit lands elsewhere or is shrugged off
    if (guard) { live = live.filter((x) => !(x.c.required && x.p.hp <= 1)); if (!live.length) continue; }   // nothing said: the rails stay invisible
    if (!live.length) {
      sg.wrecked = true;
      for (const p of sg.parts) p.hp = 0;
      lost.push('segment wrecked');
      break;
    }
    const preferred = opts.prefer ? live.filter((x) => x.p.t === opts.prefer) : [];
    const layer = Math.min(...live.map((x) => x.c.layer));
    const pool = preferred.length ? preferred : live.filter((x) => x.c.layer === layer);
    const x = pool[Math.floor(rand(state) * pool.length)];
    x.p.hp--;
    x.p.hitRound = state.round;
    lost.push(x.p.t + (x.p.hp > 0 ? ' damaged' : x.c.recharges ? ' down' : ' destroyed'));
  }
  // damage.magazine_explodes (off unless set): a magazine destroyed while the ship still carries
  // munitions goes up, wrecking its segment and hitting every neighbouring segment of the ship
  const mx = state.rules.magazineExplodes, boom = mx > 0 && !guard && !opts.chain && lost.includes('magazine destroyed') && Object.values(ship.load || {}).some((k) => k > 0);
  if (boom && !sg.wrecked) { sg.wrecked = true; for (const p of sg.parts) p.hp = 0; lost.push('magazine exploded: segment wrecked'); }
  const hull = hullPct(state, ship), at = segHex(ship, si);
  clampLoad(state, ship);
  emit(state, { t: 'damage', ship: ship.id, seg: si, hits: n, lost, cause, hull, at }, [ship.owner]);
  // the shooter sees what the hit knocked off
  for (const q of others(state, ship.owner))
    if (visibleTo(state, q).has(ship.id)) emit(state, { t: 'hit', ship: ship.id, seg: si, hits: n, wrecked: sg.wrecked, cause, lost, hull, at }, [q]);
  if (boom) ship.segs.forEach((g, i) => { if (i !== si && !g.wrecked && dist(segHex(ship, i), at) <= 1) applyHits(state, ship, i, mx, 'magazine', { chain: true }); });
  if (!guard && !ship.dead && isDead(state, ship)) {
    ship.dead = true;
    // death_flash: a ship built to be lost lights up every ship within this many hexes as it goes
    const flash = Math.max(0, ...ship.segs.flatMap((g) => g.parts.map((x) => num(state.rules.parts[x.t].death_flash))));
    if (flash) for (const x of state.ships) if (!x.dead && Math.min(...cellsOf(x).map((c) => dist(c, at))) <= flash) state.lit[x.id] = state.round + 1;
    for (const pl of state.players) delete pl.seen[ship.id];
    emit(state, { t: 'destroyed', ship: ship.id, name: ship.name, owner: ship.owner, flagship: ship.flagship }, state.players.map((_, i) => i));
  }
}

// An object blows up. "struck" is the ship segment it ran into, if any.
export function explode(state, obj, struck) {
  const m = state.rules.munitions[obj.kind], everyone = state.players.map((_, i) => i);
  const center = struck ? segHex(struck.ship, struck.seg) : obj.pos.slice();
  let sparesShip = null;
  removeObj(state, obj);
  // point defence gets the first say against enemy missiles and drones
  if (struck && struck.ship.owner !== obj.owner && num(m.speed) > 0) {
    const cap = sumAttr(state, struck.ship, 'stops_per_round');
    if (struck.ship.pd < cap) {
      struck.ship.pd++;
      addFlare(state, struck.ship, 'pd');
      emit(state, { t: 'stopped', kind: obj.kind, ship: struck.ship.id, at: center }, everyone);
      return;
    }
  }
  emit(state, { t: 'blast', kind: obj.kind, owner: obj.owner, obj: obj.id, at: center }, everyone);
  const lit = state.rules.det.lightsUp;
  for (const x of state.ships.filter((s) => !s.dead).concat(state.objs))
    if (Math.min(...cellsOf(x).map((c) => dist(c, center))) <= lit) state.lit[x.id] = state.round + 1;
  if (struck && m.strikes === 'engines') strikeEngines(state, struck, num(m.hits), obj.kind);
  else if (struck) {
    // wrecks_segment: a warhead that gets through takes the whole segment. A working shield on
    // that segment takes the blow instead: the shield goes down and the hull takes the usual hits.
    // wrecks_segments: N (a deep mine): the struck segment and the nearest other segments of the same
    // ship, N in all, are wrecked outright. The core's segment is taken last, so one charge does not
    // sink a three-hex flagship unless it goes off against the core itself.
    // ignores_shields: a shield does not take the blow.
    const s = struck.ship, sg = s.segs[struck.seg], pierce = m.ignores_shields === true;
    const many = Math.max(m.wrecks_segment === true ? 1 : 0, num(m.wrecks_segments));
    const all = (g) => g.parts.reduce((n, p) => n + (p.off ? 0 : Math.max(0, p.hp)), 1);
    const shielded = !pierce && sg.parts.some((p) => p.hp > 0 && !p.off && state.rules.parts[p.t].recharges);
    const at = segHex(s, struck.seg);
    const rest = many > 1 ? s.segs.map((g, i) => ({ g, i, d: dist(segHex(s, i), at), core: g.parts.some((p) => state.rules.parts[p.t].required) ? 1 : 0 }))
      .filter((x) => x.i !== struck.seg && !x.g.wrecked).sort((a, b) => a.core - b.core || a.d - b.d || a.i - b.i).slice(0, many - 1) : [];
    applyHits(state, s, struck.seg, many && !shielded ? all(sg) : num(m.hits), obj.kind, pierce ? { pierce: true } : {});
    for (const x of rest) applyHits(state, s, x.i, all(x.g), obj.kind, pierce ? { pierce: true } : {});
    if (many > 1) sparesShip = s;   // its other segments get no splash on top
  }
  const r = num(m.blast_radius);
  for (const s of state.ships) {
    if (s.dead || (!state.rules.friendlyFire && s.owner === obj.owner)) continue;
    for (let i = 0; i < s.segs.length && !s.dead; i++) {
      if (s.segs[i].wrecked || (struck && s === struck.ship && (i === struck.seg || s === sparesShip))) continue;
      if (dist(center, segHex(s, i)) <= r && (struck || r > 0)) applyHits(state, s, i, num(m.blast_hits) || 1, obj.kind + ' blast');   // blast_hits: a big charge does more than 1
    }
  }
  if (r > 0) for (const o of state.objs.slice()) {
    if (objById(state, o.id) && dist(center, o.pos) <= r) { removeObj(state, o); emit(state, { t: 'obj_destroyed', kind: o.kind, at: o.pos.slice() }, everyone); }
  }
}

// A blast that goes for the engines: each hit lands on the working engine nearest the impact,
// anywhere on the ship, so a strong enough mine leaves a ship dead in the water.
export function strikeEngines(state, struck, n, cause) {
  const s = struck.ship, at = segHex(s, struck.seg);
  for (let k = 0; k < n && !s.dead; k++) {
    let best = -1, bd = Infinity;
    s.segs.forEach((sg, i) => {
      if (sg.wrecked || !sg.parts.some((p) => p.t === 'engine' && p.hp > 0)) return;
      const d = dist(segHex(s, i), at);
      if (d < bd) { bd = d; best = i; }
    });
    applyHits(state, s, best >= 0 ? best : struck.seg, 1, cause, best >= 0 ? { prefer: 'engine' } : {});
  }
}

export function checkWin(state) {
  if (state.phase !== 'play' || state.script) return;   // story chapters decide the result in engine/script.js
  const lost = state.players.map((_, p) => {
    const mine = state.ships.filter((s) => s.owner === p);
    const flag = mine.filter((s) => s.flagship);
    return flag.length ? flag.every((s) => s.dead) : mine.every((s) => s.dead);
  });
  if (!lost.some(Boolean)) return;
  state.phase = 'over';
  state.winner = lost.every(Boolean) ? 'draw' : lost.indexOf(false);
  emit(state, { t: 'game_over', winner: state.winner }, state.players.map((_, i) => i));
}
