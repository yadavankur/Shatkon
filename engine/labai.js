// How the computer uses the experiments (engine/experiments.js) that are switched on. For each one the
// Experiments page sets how keen it is: 'never', 'sometimes' (the default) or 'eager', as the rapid
// option cpuExp: { ram: 'eager', ... }. Like the economy styles (engine/econai.js), this only replaces the
// normal computer's choice when that choice is a move or a pass, except an eager ram, which may replace
// a shot when the ram would do more. Seeded through rnd, so computer games replay.
import { exp } from './experiments.js';
import { ramRefusal, decoySpots, decoyRefusal, warpSpots } from './labrules.js';
import { buyRefusal, econOn } from './economy.js';
import { legalMoves, rapidRefusal } from './rapid.js';
import { shipById, gap, num } from './state.js';
import { dist, DIRS } from './hex.js';

export const KEENNESS = ['never', 'sometimes', 'eager'];
export const keen = (state, k) => { const v = ((state.rules.rapid || {}).cpuExp || {})[k]; return KEENNESS.includes(v) ? v : 'sometimes'; };

// hits a ship has lost: parts below full, not counting wrecked segments
const missing = (state, x) => x.segs.reduce((n, sg) => n + (sg.wrecked ? 0 : sg.parts.reduce((m, q) => { const c = state.rules.parts[q.t]; return m + (c && !q.dropped ? Math.max(0, num(c.hp, 1) - Math.max(0, q.hp)) : 0); }, 0)), 0);
const hpLeft = (x) => x.segs.reduce((n, sg) => n + (sg.wrecked ? 0 : sg.parts.reduce((m, q) => m + Math.max(0, q.hp), 0)), 0);

export function labAI(state, p, a, rnd = Math.random) {
  const R = state.rules.rapid || {};
  if (!R.exp || state.phase !== 'play') return a;
  const quiet = !a || a.type === 'move' || a.type === 'pass';
  const mine = state.ships.filter((x) => x.owner === p && !x.dead);
  const vis = new Set(state.players[p].vis);
  const foes = state.ships.filter((x) => x.owner !== p && !x.dead && vis.has(x.id));
  const near = (x, r) => foes.filter((e) => gap(x, e) <= r);
  const ok = (b) => !rapidRefusal(state, p, b);

  // ram: a crippled scout (sometimes) or any scout (eager) next to an enemy worth more than it
  if (exp(state, 'ram') && keen(state, 'ram') !== 'never' && (quiet || keen(state, 'ram') === 'eager')) {
    for (const x of mine.filter((z) => z.segs.length === 1 && !z.flagship)) {
      const crippled = missing(state, x) >= 3 || hpLeft(x) <= 2;   // badly hurt
      if (keen(state, 'ram') === 'sometimes' && !crippled) continue;
      const targets = near(x, 2).filter((t) => !ramRefusal(state, p, { type: 'ram', ship: x.id, target: t.id }))
        .sort((u, v) => (v.flagship ? 10 : 0) + v.segs.length - ((u.flagship ? 10 : 0) + u.segs.length));
      if (targets.length && (targets[0].segs.length > 1 || crippled)) return { type: 'ram', ship: x.id, target: targets[0].id };
    }
  }
  // eager ram: a scout within 9 of a bigger enemy closes in, to ram next tick (half the time even instead of a shot)
  if (exp(state, 'ram') && keen(state, 'ram') === 'eager' && (quiet || rnd() < 0.5)) {
    const big = foes.filter((e) => e.segs.length > 1);
    const best = (m) => { const x = shipById(state, m.ship); if (!x || x.segs.length !== 1 || x.flagship) return null;
      const now = Math.min(...big.map((e) => gap(x, e))); if (now > 9) return null;
      const to = { ...x, pos: m.path.reduce((c, d) => [c[0] + DIRS[d][0], c[1] + DIRS[d][1]], x.pos) };
      const then = Math.min(...big.map((e) => gap(to, e))); return then < now ? then : null; };
    if (big.length) {
      const ms = legalMoves(state, p).map((m) => [m, best(m)]).filter((z) => z[1] != null).sort((u, v) => u[1] - v[1]);
      if (ms.length) return ms[0][0];
    }
  }
  if (!quiet) return a;

  // decoy: when enemy missiles are flying at us (sometimes), or whenever the enemy is in sight (eager)
  if (exp(state, 'decoy') && keen(state, 'decoy') !== 'never') {
    const incoming = state.objs.some((o) => o.owner !== p && num((state.rules.munitions[o.kind] || {}).speed) > 0 && vis.has(o.id));
    if (incoming || (keen(state, 'decoy') === 'eager' && foes.length)) {
      for (const x of mine) {
        const spots = decoySpots(state, p, x.id);
        if (!spots.length) continue;
        // between our fleet and the nearest enemy: the spot closest to the enemy we can see, else forward
        const goal = foes.length ? foes[0].pos : x.pos;
        spots.sort((u, v) => dist(u, goal) - dist(v, goal));
        const b = { type: 'decoy', ship: x.id, at: spots[Math.min(spots.length - 1, Math.floor(rnd() * 3))] };
        if (!decoyRefusal(state, p, b) && ok(b)) return b;
      }
    }
  }

  if (econOn(state)) {
    // warp: a damaged ship with enemies close gets out (sometimes: crippled; eager: any hit ship)
    if (exp(state, 'warp') && keen(state, 'warp') !== 'never') {
      for (const x of mine) {
        const hurt = keen(state, 'warp') === 'eager' ? missing(state, x) > 0 : missing(state, x) >= 3 || hpLeft(x) <= 2;
        if (!hurt || !near(x, 4).length) continue;
        const spots = warpSpots(state, p, x.id);
        if (!spots.length) continue;
        const far = (c) => Math.min(...foes.map((e) => dist(e.pos, c)));
        spots.sort((u, v) => far(v) - far(u));
        const b = { type: 'buy', item: 'warp', ship: x.id, at: spots[0] };
        if (!buyRefusal(state, p, b) && ok(b)) return b;
      }
    }
    // repair: a ship missing 3+ parts (sometimes) or any (eager), when rekon allows
    if (exp(state, 'repair') && keen(state, 'repair') !== 'never') {
      const need = keen(state, 'repair') === 'eager' ? 1 : 3;
      const x = mine.filter((z) => missing(state, z) >= need).sort((u, v) => v.segs.length - u.segs.length)[0];
      if (x) { const b = { type: 'buy', item: 'repair', ship: x.id }; if (!buyRefusal(state, p, b) && ok(b)) return b; }
    }
    // hibernate: a damaged ship next to a rock with no enemy within 3
    if (exp(state, 'hibernate') && keen(state, 'hibernate') !== 'never') {
      const need = keen(state, 'hibernate') === 'eager' ? 1 : 2;
      for (const x of mine.filter((z) => !z.flagship && !z.hib && missing(state, z) >= need && !near(z, 3).length)) {
        const b = { type: 'buy', item: 'hibernate', ship: x.id };
        if (!buyRefusal(state, p, b) && ok(b)) return b;
      }
    }
  }
  // a hibernating ship stays put: if the choice was to move it, move another
  if (a && a.type === 'move') {
    const x = shipById(state, a.ship);
    if (x && x.hib) {
      const alt = legalMoves(state, p).filter((m) => !shipById(state, m.ship).hib);
      if (alt.length) return alt[Math.floor(rnd() * alt.length)];
    }
  }
  return a;
}
