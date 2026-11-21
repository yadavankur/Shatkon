// Rapid-mode variants, computer v computer (normal v normal, mirrored fleets).
// Usage: node tools/rapid_variants.mjs <games> <tick cap> [name filter]   e.g.  node tools/rapid_variants.mjs 10 100 closer
import { readYaml, shippedFiles } from '../tests/helpers.js';
import * as E from '../engine/index.js';
const N = +process.argv[2] || 10, cap = +process.argv[3] || 100;
const { world } = shippedFiles();
const base = readYaml('rules/rapid/rapid_opus.yaml');
const clone = (x) => JSON.parse(JSON.stringify(x));
const small = (b) => { // 5 scouts (C, D/B centre arc: A,B,C,D,E), no 4-hex
  const keep = new Set(['Throne', 'Warden', 'Lancer L', 'Lancer R', 'Pawn A', 'Pawn B', 'Pawn C', 'Pawn D', 'Pawn E']);
  b.player_1.ships = b.player_1.ships.filter((s) => keep.has(s.name));
  b.player_1.deployment = b.player_1.deployment.filter((d) => keep.has(d.ship));
  return b;
};
const strongMissiles = (r) => { for (const m of Object.values(r.munitions)) if (m.family === 'missile') { m.wrecks_segment = true; m.speed = 3; m.fuel = 6; } return r; };
const slowShields = (r) => { for (const c of Object.values(r.parts)) if (c.recharges) c.recharge_every = 9; return r; };
const shift = (k) => (b) => { b.map.zones.player_1_home.depth = 7 + k; b.map.zones.player_2_home.depth = 7 + k; for (const d of b.player_1.deployment) d.at = [d.at[0] + Math.floor(k / 2), d.at[1] - k]; return b; };
const only = process.argv[4];
const V = {
  'as built': {},
  'smaller fleet (9 ships)': { board: small },
  'missiles wreck + 3 hex/tick': { rules: strongMissiles },
  'shields recharge after 9 ticks': { rules: slowShields },
  'line at 8 rows': { opts: { line: 8 } },
  'smaller + strong missiles': { board: small, rules: strongMissiles },
  'smaller + strong missiles + slow shields': { board: small, rules: (r) => slowShields(strongMissiles(r)) },
  'start 4 rows closer': { board: shift(4), opts: { line: 8 } },
  'smaller + start 4 rows closer': { board: (b) => shift(4)(small(b)), opts: { line: 8 } },
  'smaller + 4 closer + strong missiles': { board: (b) => shift(4)(small(b)), opts: { line: 8 }, rules: strongMissiles },
};
if (only) for (const k of Object.keys(V)) if (!k.includes(only)) delete V[k];
for (const [name, v] of Object.entries(V)) {
  const b = v.board ? v.board(clone(base)) : clone(base);
  const { rules, problems } = E.buildRules(world, b, b);
  if (problems.length) { console.log(name, 'PROBLEMS', problems); continue; }
  const res = { 0: 0, 1: 0, draw: 0 }; let ticks = 0, firstLoss = 0, flagDmg = 0, launched = 0, landed = 0;
  for (let i = 0; i < N; i++) {
    let r = E.rapidRules({ ...rules, rapid: b.rapid }, { cap, ...(v.opts || {}) });
    if (v.rules) { r = { ...r, munitions: clone(r.munitions), parts: clone(r.parts) }; r = v.rules(r); }
    let g = E.rapidStart(r, 500 + i); let seed = i * 13 + 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    let fl = null;
    while (g.phase === 'play') {
      g = E.rapidTick(g, [E.rapidAI(g, 0, 'normal', rnd), E.rapidAI(g, 1, 'normal', rnd)]);
      if (fl === null && g.ships.some((s) => s.dead)) fl = g.round;
      for (const e of g.events) { if (e.t === 'launch' && e.seenBy.includes(e.owner ?? 0)) launched++; if (e.t === 'blast') landed++; }
    }
    res[g.winner]++; ticks += g.round; firstLoss += fl || cap;
    flagDmg += g.ships.filter((s) => s.flagship).reduce((n, s) => n + (100 - E.hullPct(g, s)), 0) / 2;
  }
  console.log(`${name.padEnd(42)} wins P1/P2/draw ${res[0]}/${res[1]}/${res.draw}  avg ticks ${(ticks / N).toFixed(0)}  first loss t${(firstLoss / N).toFixed(0)}  flagship damage ${(flagDmg / N).toFixed(0)}%  blasts ${(landed / N).toFixed(1)}`);
}
