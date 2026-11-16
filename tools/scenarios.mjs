// Fleet against fleet: every test fleet in rules/sim_fleets.yaml plays every other one.
// A handful of games per pairing is enough here; the information is in the spread across
// different fleets, tactics and rule numbers, not in repeating one match-up.
//
//   node tools/scenarios.mjs                          the whole matrix, 10 games a cell
//   node tools/scenarios.mjs --fleets stock,guns3,decoys5
//   node tools/scenarios.mjs --games 6
//   node tools/scenarios.mjs --ai balanced            who flies every fleet (default: balanced; ships with their own `ai:` keep it)
//   node tools/scenarios.mjs --ai-rows camp --ai-cols balanced     different pilots for the row fleet and the column fleet
//   node tools/scenarios.mjs --set munitions.missile.hits=5 --set detection.passive_fuzzy_extra=5
//   node tools/scenarios.mjs --pset blind_fire=true   add a field to every personality (here: fire missiles blind)
//   node tools/scenarios.mjs --radius 12              a bigger board than the skirmish map
//   node tools/scenarios.mjs --missiles 6             every ship that carries missiles carries this many (magazines permitting)
//
// Each cell is the row fleet's result against the column fleet: wins-losses-draws, from both seats
// and from random starting positions in the home rows.

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playGame, policy, shuffled } from './sim.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BETA = root;
const E = await import('file://' + path.join(BETA, 'engine/index.js').replace(/\\/g, '/'));
const YAML = vm.runInThisContext(fs.readFileSync(path.join(BETA, 'lib/yaml.min.js'), 'utf8') + '\n;YAML');
const readYaml = (rel) => YAML.parse(fs.readFileSync(path.join(BETA, 'rules', rel), 'utf8'));

function setPath(obj, dotted, value) {
  const keys = dotted.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] = o[k] ?? {};
  o[keys.at(-1)] = value;
}

// One side of a fleets file from a test fleet: unique names, a placeholder start (shuffled later).
function side(lib, fleetName, missiles) {
  const list = lib.fleets[fleetName];
  if (!list) throw new Error('no test fleet called ' + fleetName);
  const count = {};
  const ships = list.map((e) => {
    const d = lib.designs[e.ship];
    if (!d) throw new Error(fleetName + ': no design called ' + e.ship);
    count[e.ship] = (count[e.ship] || 0) + 1;
    const load = { ...(d.load || {}) };
    const want = e.missiles ?? (missiles != null && load.missile ? missiles : null);
    if (want != null) {
      const holds = d.hull.reduce((n, sg) => n + (sg.bays || []).filter((b) => b === 'magazine').length * 3, 0);
      load.missile = Math.min(want, holds);
    }
    return { name: e.ship + ' ' + count[e.ship], flagship: e.flag === true, hull: d.hull, load, ...(e.ai ? { ai: e.ai } : {}) };
  });
  return { ships, deployment: ships.map((s) => ({ ship: s.name, at: [0, 0] })) };
}

export function versus(lib, a, b, { sets = [], psets = [], radius = null, missiles = null } = {}) {
  const world = readYaml('world_v0.4.yaml'), map = readYaml('map_skirmish.yaml');
  world.turns.first = 'player_1';   // this tool swaps seats itself: seat 1 moves first (the shipped world picks at random)
  for (const s of sets) { const i = s.indexOf('='); setPath(world, s.slice(0, i), YAML.parse(s.slice(i + 1))); }
  for (const s of psets) { const i = s.indexOf('='); for (const p of Object.values(world.ai.personalities)) p[s.slice(0, i)] = YAML.parse(s.slice(i + 1)); }
  if (radius) { map.map.board.radius = radius; map.map.terrain = map.map.terrain.map((t) => ({ ...t, at: t.at.map((x) => Math.round((x * radius) / 8)) })); }
  const built = E.buildRules(world, map, { budget: 99999, player_1: side(lib, a, missiles), player_2: side(lib, b, missiles) });
  const real = built.problems.filter((p) => !/starts|outside|overlap/.test(p));
  if (real.length) throw new Error(a + ' v ' + b + ': ' + real.join(' | '));
  return built.rules;
}

// Row fleet a against column fleet b. Returns { w, l, d, rounds, noKill } from a's side.
export function cell(lib, a, b, games, opts = {}) {
  const out = { w: 0, l: 0, d: 0, rounds: 0, noKill: 0 };
  const pa = policy(opts.aiRows || opts.ai || 'balanced'), pb = policy(opts.aiCols || opts.ai || 'balanced');
  for (let i = 0; i < games; i++) {
    const swap = i % 2 === 1, seed = 11 + (i >> 1) * 7919;
    const rules = shuffled(swap ? versus(lib, b, a, opts) : versus(lib, a, b, opts), seed);
    const r = swap ? playGame(rules, pb, pa, seed) : playGame(rules, pa, pb, seed);
    const aSeat = swap ? 1 : 0;
    out.rounds += r.rounds;
    if (r.by === 'turn_limit') out.noKill++;
    if (r.winner === 'draw') out.d++; else if (r.winner === aSeat) out.w++; else out.l++;
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name, d) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : d; };
  const optAll = (name) => args.flatMap((x, i) => (x === '--' + name ? [args[i + 1]] : []));
  const lib = readYaml('sim_fleets.yaml');
  const names = opt('fleets') ? opt('fleets').split(',') : Object.keys(lib.fleets);
  const cols = opt('against') ? opt('against').split(',') : names;
  const games = Number(opt('games', 10));
  const opts = { sets: optAll('set'), psets: optAll('pset'), radius: opt('radius') ? Number(opt('radius')) : null, missiles: opt('missiles') != null ? Number(opt('missiles')) : null, ai: opt('ai'), aiRows: opt('ai-rows'), aiCols: opt('ai-cols') };
  const cost = Object.fromEntries([...new Set(names.concat(cols))].map((n) => [n, versus(lib, n, n, opts).fleets[0].cost]));
  console.log(`${games} games a cell (wins-losses-draws for the row fleet), pilots: rows ${opts.aiRows || opts.ai || 'balanced'}, columns ${opts.aiCols || opts.ai || 'balanced'}` +
    (opts.sets.length ? ', rules: ' + opts.sets.join(', ') : '') + (opts.psets.length ? ', every personality: ' + opts.psets.join(', ') : '') + (opts.radius ? ', board radius ' + opts.radius : '') + (opts.missiles != null ? ', missiles per carrier ' + opts.missiles : ''));
  const w = 11;
  console.log('fleet (cost)'.padEnd(18) + cols.map((c) => c.padStart(w)).join('') + '   total'.padStart(10) + '  rounds  no kill');
  for (const a of names) {
    let line = (a + ' (' + cost[a] + ')').padEnd(18), tw = 0, tl = 0, td = 0, rounds = 0, nk = 0, n = 0;
    for (const b of cols) {
      if (a === b && !opts.aiRows && !opts.aiCols) { line += '-'.padStart(w); continue; }
      const c = cell(lib, a, b, games, opts);
      line += `${c.w}-${c.l}-${c.d}`.padStart(w);
      tw += c.w; tl += c.l; td += c.d; rounds += c.rounds; nk += c.noKill; n += games;
    }
    console.log(line + `${tw}-${tl}-${td}`.padStart(10) + (n ? (rounds / n).toFixed(1) : '-').padStart(8) + String(nk).padStart(9));
  }
}
