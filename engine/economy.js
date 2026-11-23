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

import { cellsOf, emit, geom, footprint, num, no } from './state.js';
import { key, DIRS, add, dist, sightLine } from './hex.js';
import { beamHitsAt } from './actions.js';
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
};

export const econOn = (state) => !!(state && state.rules.rapid && state.rules.rapid.economy === 'on' && state.econ);

// The economy numbers for this game: the defaults, then the board file's `econ:`, then the settings sheet.
export function econConfig(rules) {
  const o = (rules && rules.rapid) || {};
  const c = { ...ECON_DEFAULTS, ...(o.econ || {}) };
  if (o.econCap != null && o.econCap !== '') c.cap = Number(o.econCap);
  if (o.econOwnHalf != null) c.ownHalf = o.econOwnHalf === true || o.econOwnHalf === 'yes';
  if (o.econHeatmap != null && o.econHeatmap !== '') c.heatmap = Number(o.econHeatmap);
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
export function econTick(s, before) {
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
    E.perTick[p].push(total);
    if (!total) continue;
    E.purse[p] += total; E.earned[p] += total;
    emit(s, { t: 'earned', player: p, amount: total, purse: E.purse[p], items: paid, capped: items.reduce((a, it) => a + it.n, 0) > total }, [p]);
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
};
export const price = (state, item) => num(econConfig(state.rules)[item]);

// Why side p can't buy this now (null when it can).
export function buyRefusal(state, p, a) {
  if (!econOn(state)) return 'there is nothing to buy in this game';
  if (!SHOP[a.item]) return 'that is not for sale';
  const cost = price(state, a.item);
  if (state.econ.purse[p] < cost) return 'not enough salvage: ' + a.item + ' costs ' + cost + ', you have ' + state.econ.purse[p];
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
  emit(s, { t: 'bought', player: p, item: a.item, cost, purse: E.purse[p] }, [p]);
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
  return out;
}

// Words for the log and the screen.
export const BUY_WORDS = { heatmap: 'a threat heatmap' };
export const EARN_WORDS = { cross: 'first across the line', kill: 'enemy ship destroyed', hold: 'holding past the line', ground: 'new ground', rock: 'new ground by an asteroid' };
