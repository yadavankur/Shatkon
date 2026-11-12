// Text forms: a short notation for each action (like chess moves), a fingerprint
// of the game state, and a compact alphabet that survives being pasted into a chat.

export function stable(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
}
export function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// Things that are bookkeeping, not part of the position on the board.
const SKIP = new Set(['rules', 'history', 'lastTurn', 'pending', 'pre', 'events', 'flight']);
// A small seeded random number generator (mulberry32). Same seed, same sequence, on every device.
export function seededRandom(seed) {
  let t = seed | 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashState(state) {
  const o = {};
  for (const k of Object.keys(state)) if (!SKIP.has(k)) o[k] = state[k];
  return fnv(stable(o)).toString(36).padStart(7, '0');
}

// ---- action notation ----
//   m1a.0012          move ship 1a along directions 0,0,1,2
//   f1a.2.1.4,-3      ship 1a fires the weapon in segment 2, part 1, at hex [4,-3]
//   l1b.missile.3,15.2a.01   ship 1b launches a missile from hex [3,15], locked on 2a, route 0,1
//   s1a               ship 1a sends an active scan around itself
//   do7               detonate own object o7
//   e                 end turn
export function actionText(a) {
  switch (a.type) {
    case 'move': return 'm' + a.ship + '.' + a.path.join('');
    case 'fire': return 'f' + a.ship + '.' + a.seg + '.' + a.part + '.' + a.at.join(',');
    case 'launch': return 'l' + a.ship + '.' + a.kind + '.' + a.start.join(',') + '.' + (a.target || '') + '.' + (a.route || []).join('');
    case 'scan': return 's' + a.ship;
    case 'detonate': return 'd' + a.obj;
    case 'end': return 'e';
  }
  throw new Error('unknown action type: ' + a.type);
}
const coord = (s) => s.split(',').map(Number);
const dirs = (s) => (s ? s.split('').map(Number) : []);
export function parseAction(text) {
  const k = text[0], f = text.slice(1).split('.');
  switch (k) {
    case 'm': return { type: 'move', ship: f[0], path: dirs(f[1]) };
    case 'f': return { type: 'fire', ship: f[0], seg: Number(f[1]), part: Number(f[2]), at: coord(f[3]) };
    case 'l': return { type: 'launch', ship: f[0], kind: f[1], start: coord(f[2]), target: f[3] || null, route: dirs(f[4]) };
    case 's': return { type: 'scan', ship: f[0] };
    case 'd': return { type: 'detonate', obj: f[0] };
    case 'e': return { type: 'end' };
  }
  throw new Error('cannot read action "' + text + '"');
}

// ---- chat-safe packing: letters, digits, "-" and "." only (nothing a chat app restyles) ----
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-.';
export function pack(bytes) {
  let out = '', i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += ALPHA[n >> 18] + ALPHA[(n >> 12) & 63] + ALPHA[(n >> 6) & 63] + ALPHA[n & 63];
  }
  if (i + 1 === bytes.length) { const n = bytes[i] << 16; out += ALPHA[n >> 18] + ALPHA[(n >> 12) & 63]; }
  else if (i + 2 === bytes.length) { const n = (bytes[i] << 16) | (bytes[i + 1] << 8); out += ALPHA[n >> 18] + ALPHA[(n >> 12) & 63] + ALPHA[(n >> 6) & 63]; }
  return out;
}
export function unpack(text) {
  const vals = [];
  for (const ch of text) { const v = ALPHA.indexOf(ch); if (v < 0) throw new Error('unexpected character in code'); vals.push(v); }
  const out = [];
  for (let i = 0; i < vals.length; i += 4) {
    const a = vals[i], b = vals[i + 1] || 0, c = vals[i + 2] || 0, d = vals[i + 3] || 0;
    const n = (a << 18) | (b << 12) | (c << 6) | d, left = vals.length - i;
    out.push((n >> 16) & 255);
    if (left > 2) out.push((n >> 8) & 255);
    if (left > 3) out.push(n & 255);
  }
  return new Uint8Array(out);
}

// Scrambles bytes with a keystream so a turn code cannot be read by eye.
// This keeps honest players honest; it is not encryption.
export function scramble(bytes, seedText) {
  let s = fnv(seedText) | 0;
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    out[i] = bytes[i] ^ ((t ^ (t >>> 14)) & 255);
  }
  return out;
}
