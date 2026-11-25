// Economy mode (Frontier), slice 5: how the computer plays the economy. Three styles, the corners of
// the rush / boom / turtle triangle (design: claude/shatkon-economy-mode-draft.md, section 5):
//
//   rush   - buys nothing before tick 20, then only missiles (resupply). Pushes forward and fights.
//   boom   - flies scouts through new ground in the enemy's half (asteroid hexes first) and buys upgrades
//            once it has 20 salvage: income now, a better fleet later.
//   turtle - drops turrets once it has a ship on the line, buys a heatmap when an enemy is within 10,
//            and keeps its fleet near its own line so the enemy has to come to it.
//
// The normal rapid computer (chooseAI in engine/rapid.js) still picks the action; a style only
// replaces it when that action is a move or a pass, so a style never gives up a shot, a missile or a
// scan. No style passes while it has a legal move (passing costs salvage). Everything here is seeded
// through `rnd` and the state, so computer games replay.
import { econOn, econConfig, newGround, droppableLaser, turretSpots, upgradeRefusal, resupplyRefusal, heatOn, price, isTurret } from './economy.js';
import { legalMoves, forcedMoves, rapidRefusal } from './rapid.js';
import { pastLine, rowsForward } from './rapidrules.js';
import { footprint, shipById } from './state.js';
import { dist, step } from './hex.js';

export const STYLES = ['rush', 'boom', 'turtle'];

// The style side p plays: state.econ.style (chosen at the start), else rush.
export const styleOf = (state, p) => (state.econ && state.econ.style && state.econ.style[p]) || 'rush';

// Pick each side's style at the start: rules.rapid.cpuStyle for player 2 (and cpuStyle0 for player 1,
// used by the computer-v-computer tools); 'random' picks one from the seed.
export function pickStyles(s) {
  const o = s.rules.rapid || {};
  const pick = (v, salt) => (STYLES.includes(v) ? v : STYLES[(Math.abs(Number(s.seed) || 0) + salt) % 3]);
  s.econ.style = [pick(o.cpuStyle0, 1), pick(o.cpuStyle, 0)];
  if (s.players.length > 2) s.econ.style.push(pick(o.cpuStyle2, 2));   // three players: the second computer's style
}

const gapTo = (a, b) => Math.min(...footprint(a).flatMap((c) => footprint(b).map((d) => dist(c, d))));
const endCells = (x, path) => { const to = path.reduce((c, d) => step(c, d), x.pos); return footprint({ ...x, pos: to }); };

// The style's choice for side p, given the normal computer's choice `a` (or `a` itself).
export function econAI(state, p, a, rnd = Math.random) {
  if (!econOn(state) || state.phase !== 'play') return a;
  const style = styleOf(state, p), cfg = econConfig(state.rules), purse = state.econ.purse[p];
  const combat = a && ['fire', 'launch', 'scan'].includes(a.type);
  if (combat) return a;
  const mine = state.ships.filter((x) => x.owner === p && !x.dead);
  const vis = new Set(state.players[p].vis);
  const enemies = state.ships.filter((x) => x.owner !== p && !x.dead && vis.has(x.id));
  const nearest = (x) => (enemies.length ? Math.min(...enemies.map((e) => gapTo(x, e))) : Infinity);
  const ok = (b) => b && !rapidRefusal(state, p, b);

  if (style === 'rush') {
    if (state.round >= 20 && purse >= price(state, 'resupply')) {
      const x = mine.find((z) => !resupplyRefusal(state, p, z.id));
      if (x && ok({ type: 'buy', item: 'resupply', ship: x.id })) return { type: 'buy', item: 'resupply', ship: x.id };
    }
  }

  if (style === 'boom') {
    // an upgrade once it can afford one with some to spare: the biggest armed ship first, +1 range
    if (state.round >= 10 && purse >= 20) {
      const big = mine.filter((z) => !z.upgraded).sort((u, v) => v.segs.length - u.segs.length);
      for (const z of big) for (const kind of ['range', 'shield', 'armour']) {
        const b = { type: 'buy', item: 'upgrade', ship: z.id, kind };
        if (!upgradeRefusal(state, p, z.id, kind) && ok(b)) return b;
      }
    }
    // new ground: the move that enters the most valuable unentered hexes, out of reach of what it sees
    const ground = newGround(state, p);
    if (ground.length) {
      const value = new Map(ground.map((g) => [g.at.join(), g.rock ? 2 : 1]));
      let best = null, bv = 0;
      for (const m of legalMoves(state, p)) {
        const x = shipById(state, m.ship);
        if (x.flagship) continue;
        const cells = endCells(x, m.path);
        let v = cells.reduce((n, c) => n + (value.get(c.join()) || 0), 0);
        // or a step towards the nearest new ground, for the small ships
        if (!v && x.segs.length === 1) {
          const before = Math.min(...ground.map((g) => dist(x.pos, g.at))), after = Math.min(...ground.map((g) => dist(cells[0], g.at)));
          if (after < before) v = 0.4;
        }
        if (!v) continue;
        const safe = !enemies.length || Math.min(...enemies.map((e) => Math.min(...footprint(e).flatMap((c) => cells.map((d) => dist(c, d)))))) >= 4;
        if (!safe) v -= 1.5;
        v += rnd() * 0.2;
        if (v > bv) { bv = v; best = m; }
      }
      if (best && bv > 0.3) return best;
    }
  }

  if (style === 'turtle') {
    // a heatmap when an enemy is close, if none is showing
    if (!heatOn(state, p) && enemies.length && mine.some((z) => nearest(z) <= 10) && purse >= price(state, 'heatmap') + 2) {
      const b = { type: 'buy', item: 'heatmap' };
      if (ok(b)) return b;
    }
    // turrets from ships on the line, up to 3 working, keeping enough for upkeep
    const live = state.objs.filter((o) => isTurret(o) && o.owner === p && !o.dark).length;
    if (live < 3 && purse >= price(state, 'turret') + live * cfg.turretUpkeep + 1) {
      for (const z of mine.filter((q) => pastLine(state, q) && !q.flagship && turretSpots(state, p, q.id).length)) {
        const spots = turretSpots(state, p, z.id);
        if (!spots.length) continue;
        // the spot that faces the enemy most
        spots.sort((u, v) => rowsForward(state, p, v) - rowsForward(state, p, u));
        const b = { type: 'buy', item: 'turret', ship: z.id, at: spots[0] };
        if (ok(b)) return b;
      }
    }
    // hold near the line: a move that would take a ship well past it is swapped for one that doesn't
    const L = state.rules.rapid.line;
    if (a && a.type === 'move') {
      const x = shipById(state, a.ship);
      const far = (m) => { const z = shipById(state, m.ship); return endCells(z, m.path).some((c) => rowsForward(state, p, c) > L + 1); };
      if (far(a) && !enemies.some((e) => gapTo(x, e) <= 6)) {
        const alt = legalMoves(state, p).filter((m) => !far(m) && !shipById(state, m.ship).flagship);
        if (alt.length) return alt[Math.floor(rnd() * alt.length)];
      }
    }
  }

  // nobody passes while it can move: passing costs salvage
  if ((!a || a.type === 'pass') && cfg.idle) {
    const moves = forcedMoves(state, p);
    const m = moves.length ? moves : legalMoves(state, p);
    if (m.length) return m[Math.floor(rnd() * m.length)];
  }
  return a;
}
