// Active scans. A ship can scan once per turn, and only on a turn it has moved.
// The further forward it is, the stronger the scan: everything inside the clear ring
// is fully revealed, the faint ring only picks up fuzzy contacts.

import { EDGE } from './hex.js';
import { footprint } from './state.js';
import { sensorOf, netMoved } from './detect.js';

const homeZone = (state, ship) => state.rules.zones.find((z) => z.name.indexOf('player_' + (ship.owner + 1)) === 0) || null;

// Rows forward from the ship's own board edge, counted from its most advanced segment.
function rowsForward(state, ship) {
  const z = homeZone(state, ship), R = state.rules.board.radius;
  return z ? Math.max(...footprint(ship).map((c) => EDGE[z.edge](c, R))) : R;
}

// Scan strength tiers by rows forward: near home, mid-field, centre line and beyond.
function scanSteps(state, ship) {
  const z = homeZone(state, ship), R = state.rules.board.radius, d = state.rules.det;
  const mid = z ? z.depth + d.scanMidAhead : Math.ceil(R / 2);
  return [
    { from: 0, r: d.scanTiers[0], name: 'near home' },
    { from: mid, r: d.scanTiers[1], name: 'mid-field' },
    { from: R, r: d.scanTiers[2], name: 'centre line and beyond' },
  ];
}

// Everything a screen needs to explain a ship's scan. "force" picks a tier (the Lab uses it).
export function scanInfo(state, ship, force) {
  const f = rowsForward(state, ship), st = scanSteps(state, ship);
  let k = 0;
  for (let i = 0; i < st.length; i++) if (f >= st[i].from) k = i;
  if (force != null) k = Math.max(0, Math.min(st.length - 1, force));
  // a damaged sensor shrinks the clear ring (never above sensor range + the scan bonus)
  const cap = sensorOf(state, ship) + state.rules.det.scanClear, [c, w] = st[k].r, clear = Math.max(0, Math.min(c, cap)), nx = st[k + 1];
  return {
    moved: netMoved(state, ship), forward: f, tier: k, tiers: st.length, name: st[k].name,
    r: [clear, Math.max(clear, w - (c - clear))],
    next: nx ? { rows: nx.from - f, r: nx.r, name: nx.name } : null,
  };
}
export const scanRadii = (state, ship) => scanInfo(state, ship).r;
