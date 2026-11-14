// Hex geometry. Every other module asks this one for distances, steps and lines,
// so a different kind of space (doughnut, warped hexes) only has to replace this file.
// Coordinates are axial [q, r] on a pointy-top grid; r grows towards the south.

export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const DIR_NAMES = ['E', 'NE', 'NW', 'W', 'SW', 'SE'];

export const key = (c) => c[0] + ',' + c[1];
export const unkey = (k) => k.split(',').map(Number);
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const same = (a, b) => a[0] === b[0] && a[1] === b[1];
export const step = (c, d) => [c[0] + DIRS[d][0], c[1] + DIRS[d][1]];

export function dist(a, b) {
  const dq = a[0] - b[0], dr = a[1] - b[1];
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function cubeRound(q, r) {
  const y = -q - r;
  let rx = Math.round(q), ry = Math.round(y), rz = Math.round(r);
  const dx = Math.abs(rx - q), dy = Math.abs(ry - y), dz = Math.abs(rz - r);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return [rx || 0, rz || 0];
}

// Every hex a straight line passes through, from a to b inclusive.
// The tiny nudge makes lines that run exactly along an edge fall the same way every time.
export function line(a, b) {
  const n = dist(a, b);
  if (!n) return [[a[0], a[1]]];
  const aq = a[0] + 1e-6, ar = a[1] + 2e-6, bq = b[0] + 1e-6, br = b[1] + 2e-6;
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(cubeRound(aq + (bq - aq) * t, ar + (br - ar) * t));
  }
  return out;
}

// Signed number of 60-degree turns from one direction to another (-2..3).
export function turnDiff(from, to) {
  const d = (((to - from) % 6) + 6) % 6;
  return d > 3 ? d - 6 : d;
}
export function turnToward(dir, want, max) {
  const d = turnDiff(dir, want);
  const t = Math.max(-max, Math.min(max, d));
  return (((dir + t) % 6) + 6) % 6;
}
// The direction whose step gets closest to the goal (lowest direction wins ties).
export function dirToward(from, to) {
  let best = 0, bd = Infinity;
  for (let d = 0; d < 6; d++) {
    const x = dist(step(from, d), to);
    if (x < bd) { bd = x; best = d; }
  }
  return best;
}

export function disc(c, r) {
  const out = [];
  for (let q = -r; q <= r; q++)
    for (let s = Math.max(-r, -q - r); s <= Math.min(r, -q + r); s++) out.push([c[0] + q, c[1] + s]);
  return out;
}

export const inHexagon = (c, R) => Math.max(Math.abs(c[0]), Math.abs(c[1]), Math.abs(c[0] + c[1])) <= R;

// How many rows a hex is from each edge of a hexagon board (0 = on the edge).
export const EDGE = {
  north: (c, R) => c[1] + R,
  south: (c, R) => R - c[1],
  north_east: (c, R) => R - c[0],
  south_west: (c, R) => c[0] + R,
  north_west: (c, R) => R + c[0] + c[1],
  south_east: (c, R) => R - c[0] - c[1],
};

export function connected(cells) {
  if (!cells.length) return true;
  const all = new Set(cells.map(key)), seen = new Set([key(cells[0])]), todo = [cells[0]];
  while (todo.length) {
    const c = todo.pop();
    for (let d = 0; d < 6; d++) {
      const n = step(c, d), k = key(n);
      if (all.has(k) && !seen.has(k)) { seen.add(k); todo.push(n); }
    }
  }
  return seen.size === all.size;
}

// Is this set of hexes symmetrical? True when a mirror line or a turn (60, 120 or 180 degrees)
// maps the shape onto itself. The centre of the symmetry need not be a hex centre.
// Returns 'mirror', 'turn' or null. One or two hexes are always symmetrical.
const SYM = [];
for (let k = 0; k < 6; k++) {
  // cube coordinates [x, y, z] = [q, -q-r, r]; a 60-degree turn is (x, y, z) -> (-z, -x, -y)
  const turn = (c) => { let v = [c[0], -c[0] - c[1], c[1]]; for (let i = 0; i < k; i++) v = [-v[2], -v[0], -v[1]]; return v; };
  if (k) SYM.push({ kind: 'turn', f: (c) => { const v = turn(c); return [v[0], v[2]]; } });
  SYM.push({ kind: 'mirror', f: (c) => { const v = turn(c); return [v[0], v[1]]; } });   // swap y and z, then turn
}
const shapeKey = (cells) => {
  const mq = Math.min(...cells.map((c) => c[0])), mr = Math.min(...cells.filter((c) => c[0] === mq).map((c) => c[1]));
  return cells.map((c) => (c[0] - mq) + ',' + (c[1] - mr)).sort().join(' ');
};
export function symmetry(cells) {
  if (cells.length <= 2) return 'mirror';
  const want = shapeKey(cells);
  let turn = false;
  for (const s of SYM) if (shapeKey(cells.map(s.f)) === want) { if (s.kind === 'mirror') return 'mirror'; turn = true; }
  return turn ? 'turn' : null;
}

// How many hex sides of a shape face open space (fewer = more compact), and the fewest
// possible for that many hexes (a spiral around one hex).
export function exposedSides(cells) {
  const all = new Set(cells.map(key));
  let n = 0;
  for (const c of cells) for (let d = 0; d < 6; d++) if (!all.has(key(step(c, d)))) n++;
  return n;
}
export const fewestSides = (n) => (n < 1 ? 0 : 2 * Math.ceil(Math.sqrt(12 * n - 3)));
