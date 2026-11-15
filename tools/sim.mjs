// Computer-vs-computer simulations on the beta rules (beta/rules, beta/engine).
//
//   node tools/sim.mjs                         the standard table (every policy pairing)
//   node tools/sim.mjs --games 200             more games per pairing (default 100)
//   node tools/sim.mjs --a normal --b sit      one pairing
//   node tools/sim.mjs --set detection.still_signature_bonus=-1   try a rule change without editing the file
//   node tools/sim.mjs --map map_open_space.yaml
//   node tools/sim.mjs --fleet missile          a stock fleet variant (see FLEETS below)
//
//   node tools/sim.mjs --pairs balanced/sit,old/sit       several pairings
//
// Policies: easy, normal (the stock levels), old (normal as it was before personalities),
// sit (old, but never moves a ship), sit:balanced (that personality, but never moves a ship),
// and any personality named in the world file's `ai.personalities` (aggressive, defensive, balanced).
// Each pairing is played from both seats with the same seeds, so seat and first-move luck cancel.
// Columns: "no kill" = games that ran to the round limit; "hexes" = hexes moved per game;
// "idle" = turns ended without doing anything; "P1 win" = games won from the first seat.

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BETA = path.join(root, 'beta');
const E = await import('file://' + path.join(BETA, 'engine/index.js').replace(/\\/g, '/'));
const { computerMove } = await import('file://' + path.join(BETA, 'engine/ai.js').replace(/\\/g, '/'));
const YAML = vm.runInThisContext(fs.readFileSync(path.join(BETA, 'lib/yaml.min.js'), 'utf8') + '\n;YAML');
const readYaml = (rel) => YAML.parse(fs.readFileSync(path.join(BETA, 'rules', rel), 'utf8'));

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : d; };
const optAll = (name) => args.flatMap((a, i) => (a === '--' + name ? [args[i + 1]] : []));

// Stock fleet variants for the "does it hold for other fleets" question.
const seg = (at, bays, mounts = []) => ({ at, bays, mounts });
export const FLEETS = {
  // a flagship that is mostly missiles: 16 of them and three launchers (the 13 Nov findings' worry)
  missile: (f) => {
    const flag = f.player_1.ships.find((s) => s.flagship);
    flag.load = { missile: 16 };
    flag.hull = [
      seg([0, 0], ['core', 'magazine', 'magazine']),
      seg([1, 0], ['engine', 'magazine', 'coupling'], ['launcher', 'shield']),
      seg([1, -1], ['engine', 'sensor', 'coupling'], ['launcher', 'point_defence']),
      seg([0, -1], ['engine', 'magazine', 'coupling'], ['armour', 'laser']),
      seg([-1, 0], ['engine', 'magazine', 'coupling'], ['launcher']),
      seg([-1, 1], ['engine', 'magazine', 'coupling'], ['armour']),
      seg([0, 1], ['engine', 'engine', 'coupling']),
    ];
    f.budget = 999;
  },
  // two laser boats and no missiles
  guns: (f) => {
    const flag = f.player_1.ships.find((s) => s.flagship);
    flag.load = {};
    flag.hull = [
      seg([0, 0], ['core', 'sensor', 'comms']),
      seg([1, 0], ['engine', 'engine', 'coupling'], ['laser', 'shield']),
      seg([1, -1], ['engine', 'sensor', 'coupling'], ['laser', 'shield']),
      seg([0, -1], ['engine', 'coupling', 'stealth'], ['armour']),
      seg([-1, 0], ['engine', 'coupling', 'stealth'], ['laser']),
      seg([-1, 1], ['engine', 'coupling', 'stealth'], ['armour']),
      seg([0, 1], ['engine', 'coupling', 'stealth']),
    ];
    f.budget = 999;
  },
};

function setPath(obj, dotted, value) {
  const keys = dotted.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] = o[k] ?? {};
  o[keys.at(-1)] = value;
}

export function loadRules({ map, fleet, sets = [] } = {}) {
  const world = readYaml('world_v0.4.yaml'), fleets = readYaml('fleets_v0.4.yaml');
  const mapName = map || fleets.map;
  const mapFile = readYaml(mapName);
  if (mapName === 'map_open_space.yaml') {
    fleets.player_1.deployment = [{ ship: 'Blob A', at: [2, 16] }, { ship: 'Blob B', at: [-2, 18] }, { mine: [0, 12] }, { mine: [-5, 13] }];
  }
  if (fleet) FLEETS[fleet](fleets);
  for (const s of sets) { const [k, v] = s.split('='); setPath(world, k, YAML.parse(v)); }
  const built = E.buildRules(world, mapFile, fleets);
  if (built.problems.length) throw new Error('rule problems: ' + built.problems.join(' | '));
  return built.rules;
}

// One policy = how a seat chooses its next action.
export function policy(name) {
  if (name === 'sit') return (g, seat) => {
    const profiles = Object.fromEntries(g.ships.filter((s) => s.owner === seat).map((s) => [s.id, { stance: 'hold' }]));
    return computerMove(g, seat, 'normal', { profiles });
  };
  // sit:balanced = that personality's shooting and launching, but it never moves a ship
  if (name.startsWith('sit:')) return (g, seat) => {
    const pers = name.slice(4), base = ((g.rules.ai || {}).personalities || {})[pers] || {};
    const profiles = Object.fromEntries(g.ships.filter((s) => s.owner === seat).map((s) => [s.id, { ...base, stance: 'hold' }]));
    return computerMove(g, seat, 'normal', { profiles, personality: pers });
  };
  if (name === 'old') return (g, seat) => computerMove(g, seat, 'normal', { personality: false });   // the stock AI before personalities
  if (name === 'easy' || name === 'normal') return (g, seat) => computerMove(g, seat, name);
  return (g, seat) => computerMove(g, seat, 'normal', { personality: name });
}

// Plays one game. Returns { winner (0, 1 or 'draw'), rounds, by, stats per seat }.
export function playGame(rules, polA, polB, seed) {
  let g = E.start(rules, seed);
  const pols = [polA, polB];
  const stats = [0, 1].map(() => ({ moves: 0, hexes: 0, shots: 0, hits: 0, launches: 0, scans: 0, idleTurns: 0, turns: 0 }));
  let acted = 0, guard = 0;
  while (g.phase === 'play' && guard++ < 20000) {
    const seat = g.order[g.turn];
    let a = pols[seat](g, seat) || { type: 'end' };
    let r = E.attempt(g, a);
    if (!r.ok) { a = { type: 'end' }; r = E.attempt(g, a); }
    const st = stats[seat];
    if (a.type === 'move') { st.moves++; st.hexes += a.path.length; acted++; }
    else if (a.type === 'fire') { st.shots++; acted++; if (r.state.events.some((e) => e.t === 'fire' && e.hits > 0 && r.state.events.some((x) => x.t === 'damage'))) st.hits++; }
    else if (a.type === 'launch') { st.launches++; acted++; }
    else if (a.type === 'scan') { st.scans++; acted++; }
    else if (a.type === 'end') { st.turns++; if (!acted) st.idleTurns++; acted = 0; }
    g = r.state;
  }
  const over = g.events.find((e) => e.t === 'game_over') || {};
  return { winner: g.winner, rounds: g.round, by: over.by || (g.winner === 'draw' ? 'both flagships' : 'flagship'), stats };
}

// Plays a pairing from both seats. Returns totals from A's point of view.
export function series(rules, a, b, games, seed0 = 1) {
  const pa = policy(a), pb = policy(b);
  const out = { a, b, games: 0, winA: 0, winB: 0, draws: 0, timeouts: 0, seat0: 0, rounds: 0, A: null, B: null };
  const addStats = (into, s) => { for (const k of Object.keys(s)) into[k] = (into[k] || 0) + s[k]; return into; };
  out.A = {}; out.B = {};
  for (let i = 0; i < games; i++) {
    const swap = i % 2 === 1, seed = seed0 + (i >> 1) * 7919;
    const r = swap ? playGame(rules, pb, pa, seed) : playGame(rules, pa, pb, seed);
    const aSeat = swap ? 1 : 0;
    out.games++; out.rounds += r.rounds;
    if (r.by === 'turn_limit') out.timeouts++;
    if (r.winner === 'draw') out.draws++; else if (r.winner === aSeat) out.winA++; else out.winB++;
    if (r.winner === 0) out.seat0++;
    addStats(out.A, r.stats[aSeat]); addStats(out.B, r.stats[1 - aSeat]);
  }
  return out;
}

const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0) + '%';
export function row(r) {
  const idle = (s) => pct(s.idleTurns, s.turns);
  return `${(r.a + ' v ' + r.b).padEnd(26)} ${pct(r.winA, r.games).padStart(5)} ${pct(r.winB, r.games).padStart(5)} ${pct(r.draws, r.games).padStart(5)} ${pct(r.timeouts, r.games).padStart(8)} ${(r.rounds / r.games).toFixed(1).padStart(7)} ${(r.A.hexes / r.games).toFixed(1).padStart(7)} ${(r.B.hexes / r.games).toFixed(1).padStart(7)} ${idle(r.A).padStart(6)} ${idle(r.B).padStart(6)} ${pct(r.seat0, r.games).padStart(6)}`;
}
export const HEAD = `${'pairing (A v B)'.padEnd(26)} ${'A win'.padStart(5)} ${'B win'.padStart(5)} ${'draw'.padStart(5)} ${'no kill'.padStart(8)} ${'rounds'.padStart(7)} ${'A hexes'.padStart(7)} ${'B hexes'.padStart(7)} ${'A idle'.padStart(6)} ${'B idle'.padStart(6)} ${'P1 win'.padStart(6)}`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const games = Number(opt('games', 100)), sets = optAll('set'), map = opt('map'), fleet = opt('fleet');
  const rules = loadRules({ map, fleet, sets });
  const names = Object.keys((rules.ai || {}).personalities || {});
  let pairs;
  if (opt('a')) pairs = [[opt('a'), opt('b', 'normal')]];
  else if (opt('pairs')) pairs = opt('pairs').split(',').map((x) => x.split('/'));
  else {
    pairs = [['normal', 'normal'], ['normal', 'sit'], ['normal', 'easy']];
    for (const n of names) pairs.push([n, 'sit']);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) pairs.push([names[i], names[j]]);
  }
  console.log(`map ${map || 'default'}, fleet ${fleet || 'stock'}, ${games} games per pairing${sets.length ? ', with ' + sets.join(', ') : ''}`);
  console.log(HEAD);
  for (const [a, b] of pairs) console.log(row(series(rules, a, b, games)));
}
