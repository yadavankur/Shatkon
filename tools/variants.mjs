// Variants: rule and pilot variations played against each other on many fleets.
// Everything it runs is described in beta/rules/ai_variants.yaml (baseline, variants, pilots, suites)
// and beta/rules/sim_fleets.yaml (ship designs and fleets).
//
//   node tools/variants.mjs --list                      suites, variants, pilots, fleets (with cost)
//   node tools/variants.mjs --suite pilots              run a suite (several: --suite pilots,sitting)
//   node tools/variants.mjs --suite fleets --games 10 --seed 11
//   node tools/variants.mjs --cell "baseline | stock:balanced v stock:sitter" --games 40
//   node tools/variants.mjs --suite missiles --md       markdown tables (for beta/docs/variants-results.md)
//   node tools/variants.mjs --suite pilots --log games.csv     one line per game: cell, seed, seats, winner, rounds
//   add --missiles or --ships to any run for the missile counts or the per-personality table
//
// A cell is "variant | fleet:pilot v fleet:pilot". The first side is A. Every match-up gets its own
// first seed, worked out from --seed and the match-up's text (so different match-ups start from
// different layouts, and every variant of one match-up plays the same games). Game i of a cell uses
// seed = first seed + floor(i / 2) * 7919; odd games swap the seats. The seed sets the random starting
// positions (every ship somewhere in its own home rows), the game's own dice, and, for a
// mix(...) pilot, which ship flies which personality. So a cell, its seed and its game count
// reproduce the same games exactly.
//
// Each cell reports wins-losses-draws for side A, A's share (a draw counts half), a 95% Wilson
// interval on that share, and a label: clear (the interval excludes 50%), leaning (share at or
// beyond 65/35 but the interval still includes 50%) or unclear.

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shuffled } from './sim.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BETA = path.join(root, 'beta');
const E = await import('file://' + path.join(BETA, 'engine/index.js').replace(/\\/g, '/'));
const { computerMove } = await import('file://' + path.join(BETA, 'engine/ai.js').replace(/\\/g, '/'));
const YAML = vm.runInThisContext(fs.readFileSync(path.join(BETA, 'lib/yaml.min.js'), 'utf8') + '\n;YAML');
const readYaml = (rel) => YAML.parse(fs.readFileSync(path.join(BETA, 'rules', rel), 'utf8'));

export const V = readYaml('ai_variants.yaml');
export const LIB = readYaml('sim_fleets.yaml');

function setPath(obj, dotted, value) {
  const keys = dotted.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] = o[k] ?? {};
  o[keys.at(-1)] = value;
}
// variant names may contain a dot (m_old_1.5x), world paths never start with one of those
const applySets = (world, sets) => { for (const [k, v] of Object.entries(sets || {})) setPath(world, k, structuredClone(v)); };

function mulberry(seed) {
  let t = seed | 0;
  return () => { t = (t + 0x6d2b79f5) | 0; let x = Math.imul(t ^ (t >>> 15), t | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

// A pilot block from the variants file, with `base` laid underneath and the variant's `pilots:` on top.
function pilotBlock(name, variant) {
  const p = V.pilots[name];
  if (!p) throw new Error('no pilot called ' + name);
  const { base, note, ...own } = p;
  return { ...(base ? pilotBlock(base, null) : {}), ...own, ...((variant && variant.pilots) || {}) };
}

export function parseCell(text) {
  const m = /^\s*(\S+)\s*\|\s*(\S+?):(\S+)\s+v\s+(\S+?):(\S+)\s*$/.exec(text);
  if (!m) throw new Error('cannot read cell: ' + text);
  const pilot = (s) => { const x = /^mix\((.+)\)$/.exec(s); return x ? { mix: x[1].split(',') } : { name: s }; };
  return { text: text.trim().replace(/\s+/g, ' '), variant: m[1], a: { fleet: m[2], pilot: pilot(m[3]) }, b: { fleet: m[4], pilot: pilot(m[5]) } };
}

// One side of a fleets file. With a mix pilot, the personalities are dealt over the ships by the
// seed, and so is the flagship (the ships are identical, so any of them can carry the flag).
function side(spec, rnd) {
  const list = LIB.fleets[spec.fleet];
  if (!list) throw new Error('no test fleet called ' + spec.fleet);
  let ai = null, flag = list.findIndex((e) => e.flag === true);
  if (spec.pilot.mix) {
    if (spec.pilot.mix.length !== list.length) throw new Error(spec.fleet + ': mix needs ' + list.length + ' pilots');
    ai = spec.pilot.mix.slice();
    for (let i = ai.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ai[i], ai[j]] = [ai[j], ai[i]]; }
    flag = Math.floor(rnd() * list.length);
  }
  const count = {};
  const ships = list.map((e, i) => {
    const d = LIB.designs[e.ship];
    if (!d) throw new Error(spec.fleet + ': no design called ' + e.ship);
    count[e.ship] = (count[e.ship] || 0) + 1;
    const load = { ...(d.load || {}) };
    if (e.missiles != null) load.missile = e.missiles;
    const pers = ai ? ai[i] : e.ai;
    return { name: e.ship + ' ' + count[e.ship], flagship: i === flag, hull: d.hull, load, ...(pers ? { ai: 'p_' + pers } : {}) };
  });
  return { ships, deployment: ships.map((s) => ({ ship: s.name, at: [0, 0] })) };
}

// The rules for one game of a cell: world file + baseline + variant + pilots, the two fleets, random starts.
export function rulesFor(cell, seed, swap) {
  const variant = cell.variant === 'baseline' ? {} : V.variants[cell.variant];
  if (!variant) throw new Error('no variant called ' + cell.variant);
  const world = readYaml('world_v0.4.yaml'), map = readYaml('map_skirmish.yaml');
  applySets(world, V.baseline.set);
  applySets(world, variant.set);
  world.ai = world.ai || {}; world.ai.personalities = world.ai.personalities || {};
  for (const name of Object.keys(V.pilots)) world.ai.personalities['p_' + name] = pilotBlock(name, variant);
  const rnd = mulberry(seed ^ 0x5bd1e995);
  const sa = side(cell.a, rnd), sb = side(cell.b, rnd);
  const built = E.buildRules(world, map, { budget: 99999, player_1: swap ? sb : sa, player_2: swap ? sa : sb });
  const real = built.problems.filter((p) => !/starts|outside|overlap/.test(p));
  if (real.length) throw new Error(cell.text + ': ' + real.join(' | '));
  return shuffled(built.rules, seed);
}

const policy = (spec) => {
  const personality = 'p_' + (spec.pilot.mix ? 'balanced' : spec.pilot.name);   // a mix: every ship carries its own
  return (g, seat) => computerMove(g, seat, 'normal', { personality });
};

// A rule that makes a fleet move (movement.min_move) can refuse an action. The pilot then makes the
// smallest legal move: its smallest ship, one hex, to the hex nearest where that ship started the game.
function drift(g, seat, home) {
  const ships = g.ships.filter((s) => s.owner === seat && !s.dead).sort((a, b) => a.segs.length - b.segs.length || (a.flagship ? 1 : 0) - (b.flagship ? 1 : 0));
  for (const s of ships) {
    const opts = E.reach(g, s.id).filter((r) => r.path.length === 1);
    if (!opts.length) continue;
    opts.sort((x, y) => E.hex.dist(x.at, home[s.id]) - E.hex.dist(y.at, home[s.id]));
    return { type: 'move', ship: s.id, path: opts[0].path };
  }
  return null;
}

// Plays one game. seats[0] and seats[1] are the cell sides sitting in each seat.
export function playGame(rules, pols, seed) {
  let g = E.start(rules, seed);
  const home = Object.fromEntries(g.ships.map((s) => [s.id, s.pos.slice()]));
  const st = [0, 1].map(() => ({ hexes: 0, shots: 0, scans: 0, idle: 0, turns: 0, forced: 0, launched: 0, stopped: 0, shot: 0, lost: 0, landed: 0, mkills: 0 }));
  const ships = Object.fromEntries(g.ships.map((s) => [s.id, { owner: s.owner, ai: (((rules.fleets[s.owner].ships.find((d) => d.name === s.name) || {}).ai) || '').replace(/^p_/, ''), flagship: !!s.flagship, died: null, first: false, kills: 0 }]));
  const launcher = {}, objOwner = {};
  let acted = 0, guard = 0;
  while (g.phase === 'play' && guard++ < 30000) {
    const seat = g.order[g.turn], round = g.round;
    let a = pols[seat](g, seat) || { type: 'end' };
    let r = E.attempt(g, a);
    if (!r.ok) { a = { type: 'end' }; r = E.attempt(g, a); }
    if (!r.ok) { a = drift(g, seat, home); st[seat].forced++; if (!a) throw new Error('stuck: ' + r.why); r = E.attempt(g, a); if (!r.ok) throw new Error('stuck: ' + r.why); }
    const s = st[seat];
    if (a.type === 'move') { s.hexes += a.path.length; acted++; }
    else if (a.type === 'fire') { s.shots++; acted++; }
    else if (a.type === 'launch') acted++;
    else if (a.type === 'scan') { s.scans++; acted++; }
    else if (a.type === 'end') { s.turns++; if (!acted) s.idle++; acted = 0; }
    let lastObj = null;
    for (const e of r.state.events) {
      if (e.t === 'launch' && e.kind === 'missile') { st[seat].launched++; launcher[e.obj] = e.ship; objOwner[e.obj] = seat; }
      else if (e.t === 'stopped' && e.kind === 'missile') st[1 - ships[e.ship].owner].stopped++;
      else if (e.t === 'obj_destroyed' && e.kind === 'missile') st[a.type === 'fire' ? 1 - seat : 0].shot += a.type === 'fire' ? 1 : 0;
      else if (e.t === 'obj_lost' && e.kind === 'missile') st[objOwner[e.obj] ?? seat].lost++;
      else if (e.t === 'blast' && e.kind === 'missile') { st[e.owner].landed++; lastObj = e.obj; }
      else if (e.t === 'blast') lastObj = null;
      else if (e.t === 'destroyed') {
        const x = ships[e.ship];
        x.died = round;
        if (!Object.values(ships).some((y) => y !== x && y.owner === x.owner && y.died != null)) x.first = true;
        const killer = a.type === 'fire' ? a.ship : lastObj != null ? launcher[lastObj] : null;
        if (killer != null && ships[killer] && ships[killer].owner !== x.owner) ships[killer].kills++;
        if (a.type !== 'fire' && lastObj != null && objOwner[lastObj] != null) st[objOwner[lastObj]].mkills++;
      }
    }
    g = r.state;
  }
  const over = g.events.find((e) => e.t === 'game_over') || {};
  return { winner: g.winner, rounds: g.round, by: over.by || 'flagship', st, ships: Object.values(ships) };
}

// 95% Wilson interval for a share p out of n.
export function wilson(p, n) {
  const z = 1.96, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)];
}
export function label(p, lo, hi) { return lo > 0.5 || hi < 0.5 ? 'clear' : p >= 0.65 || p <= 0.35 ? 'leaning' : 'unclear'; }

// The first seed of a match-up: the base seed plus a number made from the match-up's text.
export function cellSeed(cell, base) {
  let h = 2166136261;
  for (const ch of cell.text.slice(cell.text.indexOf('|') + 1).trim()) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return base + ((h >>> 0) % 9973) * 13;
}

export function runCell(cell, games, base, log) {
  const seed0 = cellSeed(cell, base);
  const out = { cell: cell.text, games, seed0, w: 0, l: 0, d: 0, noKill: 0, rounds: 0, seat0: 0, A: {}, B: {}, ships: [] };
  const add = (into, s) => { for (const k of Object.keys(s)) into[k] = (into[k] || 0) + s[k]; };
  const pa = policy(cell.a), pb = policy(cell.b);
  for (let i = 0; i < games; i++) {
    const swap = i % 2 === 1, seed = seed0 + (i >> 1) * 7919, aSeat = swap ? 1 : 0;
    const r = playGame(rulesFor(cell, seed, swap), swap ? [pb, pa] : [pa, pb], seed);
    out.rounds += r.rounds;
    if (r.by === 'turn_limit') out.noKill++;
    if (r.winner === 'draw') out.d++; else if (r.winner === aSeat) out.w++; else out.l++;
    if (r.winner === 0) out.seat0++;
    add(out.A, r.st[aSeat]); add(out.B, r.st[1 - aSeat]);
    out.ships.push(...r.ships.map((s) => ({ ...s, rounds: r.rounds, won: r.winner === s.owner })));
    if (log) fs.appendFileSync(log, `"${cell.text}",${seed},${swap ? 'B' : 'A'},${r.winner === 'draw' ? 'draw' : r.winner === aSeat ? 'A' : 'B'},${r.rounds},${r.by}\n`);
  }
  out.p = (out.w + out.d / 2) / games;
  [out.lo, out.hi] = wilson(out.p, games);
  out.label = label(out.p, out.lo, out.hi);
  return out;
}

// The cells of a suite.
export function suiteCells(name) {
  const s = V.suites[name];
  if (!s) throw new Error('no suite called ' + name);
  if (s.cells) return s.cells.map(parseCell);
  if (s.roundrobin) {
    const out = [], f = s.roundrobin, p = s.pilot || 'balanced';
    for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) out.push(parseCell(`${(s.variants || ['baseline'])[0]} | ${f[i]}:${p} v ${f[j]}:${p}`));
    return out;
  }
  return s.matchups.flatMap((m) => s.variants.map((v) => parseCell(v + ' | ' + m)));
}

const pc = (x) => Math.round(100 * x) + '%';
const per = (x, n) => (x / n).toFixed(1);
function missileLine(r) {
  const f = (s) => `launched ${per(s.launched, r.games)}, stopped by point defence ${per(s.stopped, r.games)}, shot down ${per(s.shot, r.games)}, ran out or flew off ${per(s.lost, r.games)}, landed ${per(s.landed, r.games)}, ships sunk ${per(s.mkills, r.games)}`;
  return `missiles per battle: A ${f(r.A)} | B ${f(r.B)}`;
}
function shipTable(r) {
  const by = {};
  for (const s of r.ships) { const k = s.ai || '(fleet pilot)'; (by[k] = by[k] || []).push(s); }
  const rows = Object.entries(by).map(([k, list]) => {
    const dead = list.filter((s) => s.died != null), esc = list.filter((s) => !s.flagship), escDead = esc.filter((s) => s.died != null);
    return `| ${k} | ${list.length} | ${pc((list.length - dead.length) / list.length)} | ${esc.length ? pc((esc.length - escDead.length) / esc.length) : '-'} | ${dead.length ? (dead.reduce((n, s) => n + s.died, 0) / dead.length).toFixed(1) : '-'} | ${pc(list.filter((s) => s.first).length / list.length)} | ${(list.reduce((n, s) => n + s.kills, 0) / list.length).toFixed(2)} | ${pc(list.filter((s) => s.flagship && s.won).length / Math.max(1, list.filter((s) => s.flagship).length))} (${list.filter((s) => s.flagship).length}) |`;
  });
  return ['| personality | ships | alive at end | escorts alive at end | average round of death | first of its fleet to die | kills per ship | games won when it flew the flagship (times) |', '|---|---|---|---|---|---|---|---|'].concat(rows).join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name, d) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : d; };
  const has = (name) => args.includes('--' + name);
  if (has('list')) {
    console.log('suites:'); for (const [k, s] of Object.entries(V.suites)) console.log(`  ${k.padEnd(14)} ${String(suiteCells(k).length).padStart(4)} cells  ${s.note}`);
    console.log('variants:'); for (const [k, s] of Object.entries(V.variants)) console.log(`  ${k.padEnd(22)} ${s.note}  [rule: ${s.rule}]`);
    console.log('pilots:'); for (const [k, s] of Object.entries(V.pilots)) console.log(`  ${k.padEnd(12)} ${s.note}`);
    console.log('fleets (cost, ships):');
    for (const k of Object.keys(LIB.fleets)) { const c = parseCell(`baseline | ${k}:balanced v ${k}:balanced`); console.log(`  ${k.padEnd(15)} ${String(rulesFor(c, 1, false).fleets[0].cost).padStart(4)}  ${LIB.fleets[k].map((e) => e.ship).join(', ')}`); }
    process.exit(0);
  }
  const md = has('md'), log = opt('log'), seed0 = Number(opt('seed', 11));
  const jobs = opt('cell') ? [{ name: 'cell', note: '', cells: [parseCell(opt('cell'))], s: {} }] : opt('suite').split(',').map((n) => ({ name: n, note: V.suites[n].note, cells: suiteCells(n), s: V.suites[n] }));
  let total = 0;
  const t00 = Date.now();
  for (const job of jobs) {
    const games = Number(opt('games', job.s.games || 10)), t0 = Date.now();
    const seeds = `first seed + 7919k, k = 0..${Math.ceil(games / 2) - 1}, each from both seats (base seed ${seed0})`;
    const flags = (job.s.missiles || has('missiles') ? ' --missiles' : '') + (job.s.ships || has('ships') ? ' --ships' : '');
    if (md) {
      console.log(`\n### Suite: ${job.name}\n\n${job.note}\n\nCommand: \`node tools/variants.mjs --suite ${job.name} --games ${games} --seed ${seed0}\`. Seeds: ${seeds}. One row alone: \`node tools/variants.mjs --games ${games} --seed ${seed0}${flags} --cell "<cell>"\`.\n`);
      console.log('| cell (A is the first side) | W-L-D for A | A share | 95% interval | label | rounds | no kill | first seat won |\n|---|---|---|---|---|---|---|---|');
    } else console.log(`\n== ${job.name}: ${job.note} (${job.cells.length} cells, ${games} games each, seeds ${seeds})`);
    let seat0 = 0, n = 0;
    for (const c of job.cells) {
      const r = runCell(c, games, seed0, log);
      total += games; seat0 += r.seat0; n += games;
      const iv = `${pc(r.lo)} to ${pc(r.hi)}`;
      if (md) console.log(`| ${r.cell} | ${r.seed0} | ${r.w}-${r.l}-${r.d} | ${pc(r.p)} | ${iv} | ${r.label} | ${per(r.rounds, games)} | ${r.noKill} | ${r.seat0} |`);
      else {
        console.log(`${r.cell.padEnd(64)} ${`${r.w}-${r.l}-${r.d}`.padStart(8)}  A ${pc(r.p).padStart(4)}  [${iv}]  ${r.label.padEnd(8)} rounds ${per(r.rounds, games).padStart(5)}  no kill ${String(r.noKill).padStart(2)}  first seed ${r.seed0}  first-seat wins ${r.seat0}  forced moves ${r.A.forced}/${r.B.forced}`);
        console.log(`    reproduce: node tools/variants.mjs --games ${games} --seed ${seed0}${flags} --cell "${r.cell}"`);
      }
      if (job.s.missiles || has('missiles')) console.log((md ? '| ↳ ' : '    ') + missileLine(r) + (md ? ' | | | | | | | | |' : ''));
      if (job.s.ships || has('ships')) console.log('\n' + shipTable(r) + '\n' + (md ? '\n| cell (A is the first side) | W-L-D for A | A share | 95% interval | label | rounds | no kill | first seat won |\n|---|---|---|---|---|---|---|---|' : ''));
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    console.log(`${md ? '\n' : ''}${job.name}: ${job.cells.length} cells, ${n} games, ${secs} s. First seat won ${seat0} of ${n}.`);
  }
  if (jobs.length > 1) console.log(`\nTotal: ${total} games, ${((Date.now() - t00) / 1000).toFixed(0)} s.`);
}
