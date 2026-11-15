// The hand-made boards in beta/rules/boards/: check them, let the computer play them, and check
// that a game on each one survives being played across two devices by pasted codes.
//
//   node tools/boards.mjs                 every board: problems, cost, 10 computer-v-computer games
//   node tools/boards.mjs --games 20
//   node tools/boards.mjs --codes         two-device check: game code out and in, then every turn by turn code
//   node tools/boards.mjs --board 02_minefield
//   node tools/boards.mjs --both          each board twice: as written, and with the two fleets swapping seats (the
//                                         other fleet moves first from the same spots). On a mirror board both
//                                         halves should come out near even
//   node tools/boards.mjs --turned        the same board turned and flipped all 12 ways. A computer that does not
//                                         care which way the board faces gives much the same result each time
//   node tools/boards.mjs --events        count what happened (launches, blasts, mines, reveals) over the games
//   node tools/boards.mjs --set ai.variety.tie_break=0 --set munitions.sleeper_mine.drift=0
//                                         change world-file numbers for this run (after the board's own rules)
//
// Computer against computer says little about how a board plays for a person: the computer does not
// scan for mines, bait, or wait. The numbers are a smoke test (does it load, does it end, is it
// hopeless for one side), not a balance result. Seeds are 1..N; the seed is the game's dice.

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BETA = path.join(root, 'beta');
const E = await import('file://' + path.join(BETA, 'engine/index.js').replace(/\\/g, '/'));
const { computerMove } = await import('file://' + path.join(BETA, 'engine/ai.js').replace(/\\/g, '/'));
const YAML = vm.runInThisContext(fs.readFileSync(path.join(BETA, 'lib/yaml.min.js'), 'utf8') + '\n;YAML');

export const boardNames = () => fs.readdirSync(path.join(BETA, 'rules/boards')).filter((f) => f.endsWith('.yaml')).map((f) => f.slice(0, -5)).sort();

// The same steps the play page takes for ?board=NAME.
// opts.swap: the two fleets change seats (and home zones), so the other fleet moves first from the same spots.
// opts.set: { 'path.to.number': value } world-file changes applied after the board's own.
export function loadBoard(name, opts = {}) {
  let doc = YAML.parse(fs.readFileSync(path.join(BETA, 'rules/boards', name + '.yaml'), 'utf8'));
  if (opts.swap) {
    doc = structuredClone(doc);
    [doc.player_1, doc.player_2] = [doc.player_2, doc.player_1];
    const z = doc.map.zones; [z.player_1_home, z.player_2_home] = [z.player_2_home, z.player_1_home];
  }
  const world = YAML.parse(fs.readFileSync(path.join(BETA, 'rules/world_v0.4.yaml'), 'utf8'));
  for (const [k, v] of Object.entries((doc.board || {}).rules || {}).concat(Object.entries(opts.set || {}))) { const ks = k.split('.'); let o = world; for (const x of ks.slice(0, -1)) o = o[x] = o[x] ?? {}; o[ks.at(-1)] = v; }
  return { doc, ...E.buildRules(world, doc, doc) };
}

// The 12 ways a hexagon board can be turned and flipped, and a board's rules moved by one of them.
export const TURNS = [];
for (let k = 0; k < 6; k++) for (const flip of [0, 1]) TURNS.push({ name: (flip ? 'flip+' : 'turn ') + k * 60, f: (c) => { let v = [c[0], -c[0] - c[1], c[1]]; if (flip) v = [v[0], v[2], v[1]]; for (let i = 0; i < k; i++) v = [-v[2], -v[0], -v[1]]; return [v[0] || 0, v[2] || 0]; } });
export function turnRules(rules, f) {
  const r = structuredClone(rules), R = r.board.radius, H = E.hex;
  for (const t of r.terrain) { t.at = f(t.at); t.cells = t.cells.map(f); }
  for (const fl of r.fleets) { for (const s of fl.ships) for (const sg of s.segs) sg.off = f(sg.off); for (const d of fl.deployment) d.at = f(d.at); }
  for (const z of r.zones) { const edge = H.disc([0, 0], R).filter((c) => H.EDGE[z.edge](c, R) === 0).map(f); z.edge = Object.keys(H.EDGE).find((e) => edge.every((c) => H.EDGE[e](c, R) === 0)); }
  if (r.objective) r.objective.at = f(r.objective.at);
  return r;
}
// The turn or flip that maps fleet 1 onto fleet 2 and the terrain onto itself, if the board is an exact mirror.
export function mirrorOf(rules) {
  const H = E.hex, terr = (r) => r.terrain.flatMap((t) => t.cells.map((c) => t.type + '@' + H.key(c))).sort().join(' ');
  const fleet = (r, p) => r.fleets[p].deployment.map((d) => { const sh = d.ship && r.fleets[p].ships.find((s) => s.name === d.ship); return sh ? sh.segs.map((sg) => H.key(H.add(d.at, sg.off)) + ':' + sg.parts.slice().sort().join('+')).sort().join(';') : d.munition + '@' + H.key(d.at); }).sort().join('|');
  for (const t of TURNS.slice(1)) { const r = turnRules(rules, t.f); if (terr(r) === terr(rules) && fleet(r, 0) === fleet(rules, 1)) return t.name; }
  return null;
}

// One turn's worth of computer actions for whoever is to move. Returns the state after "end".
// count (optional): an object that collects how often each thing happened, for --events.
function playTurn(g, count) {
  const seat = g.order[g.turn], add = (k) => { if (count) count[k] = (count[k] || 0) + 1; };
  for (let i = 0; i < 60 && g.phase === 'play' && g.order[g.turn] === seat; i++) {
    let a = computerMove(g, seat, 'normal') || { type: 'end' };
    let r = E.attempt(g, a);
    if (!r.ok) { add('REFUSED ' + a.type + ' (' + r.why + ')'); a = { type: 'end' }; r = E.attempt(g, a); }
    g = r.state;
    if (count) {
      if (a.type === 'launch') add('launched ' + a.kind); else if (a.type === 'scan' || a.type === 'detonate') add(a.type);
      for (const e of g.events) {
        if (e.t === 'blast') add(e.kind + ' went off');
        else if (e.t === 'obj_destroyed') add(e.kind + ' destroyed');
        else if (['pass_reveal', 'burnt_out', 'lured', 'mine_stir', 'objective_scored'].includes(e.t)) add(e.t);
        else if (e.t === 'stopped') add(e.kind + ' stopped by point defence');
      }
    }
    if (a.type === 'end') break;
  }
  return g;
}
export function playOut(rules, seed, count) {
  let g = E.start(rules, seed), guard = 0;
  while (g.phase === 'play' && guard++ < 400) g = playTurn(g, count);
  const over = g.events.find((e) => e.t === 'game_over') || {};
  return { winner: g.winner, rounds: g.round, by: over.by || 'flagship' };
}

// Two devices, no server: A starts and sends the whole game as a game code; after that each side
// plays its turn and sends a turn code, which the other replays and checks.
async function codeCheck(rules, seed) {
  let a = E.start(rules, seed);
  let b = await E.importGame(await E.exportGame(a));
  if (E.hashState(a) !== E.hashState(b)) return 'the game code did not carry the game across';
  let turns = 0, tamper = 'not tried', replay = 'not tried', longest = 0;
  while (a.phase === 'play' && turns < 400) {
    const seat = a.order[a.turn];
    // the device whose turn it is plays; the other waits for the code
    const mover = seat === 0 ? a : b, next = playTurn(mover);
    const code = E.turnCode(next);
    longest = Math.max(longest, code.length);
    const other = seat === 0 ? b : a;
    if (turns === 2) {
      // a code with one character changed must be refused
      const i = code.lastIndexOf(':') - 3, bad = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
      try { E.applyTurnCode(other, bad); tamper = 'ACCEPTED A CHANGED CODE'; } catch (e) { tamper = 'refused'; }
    }
    let got;
    try { got = E.applyTurnCode(other, code); } catch (e) { return 'turn ' + turns + ': ' + e.message; }
    if (turns === 2) { try { E.applyTurnCode(got, code); replay = 'ACCEPTED THE SAME CODE TWICE'; } catch (e) { replay = 'refused'; } }
    if (E.hashState(got) !== E.hashState(next)) return 'turn ' + turns + ': the two devices disagree';
    a = seat === 0 ? next : got; b = seat === 0 ? got : next;
    turns++;
  }
  return `ok: ${turns} turns stayed in step to the end (winner ${a.winner === 'draw' ? 'draw' : 'player ' + (a.winner + 1)}); longest turn code ${longest} characters; changed code ${tamper}; same code twice ${replay}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
  const names = opt('board') ? opt('board').split(',') : boardNames(), games = Number(opt('games', 10));
  const set = {};
  args.forEach((a, i) => { if (a === '--set') { const [k, ...v] = args[i + 1].split('='); let x = v.join('='); try { x = JSON.parse(x); } catch (e) { /* a plain word */ } set[k] = x; } });
  if (Object.keys(set).length) console.log('with ' + Object.entries(set).map(([k, v]) => k + ' = ' + JSON.stringify(v)).join(', '));
  const series = (rules, count) => { let w = 0, l = 0, d = 0, rounds = 0, nk = 0; for (let s = 1; s <= games; s++) { const r = playOut(rules, s, count); rounds += r.rounds; if (r.by === 'turn_limit') nk++; if (r.winner === 'draw') d++; else if (r.winner === 0) w++; else l++; } return { w, l, d, rounds: (rounds / games).toFixed(1), nk }; };
  for (const n of names) {
    const { doc, rules, problems } = loadBoard(n, { set });
    if (problems.length) { console.log(n + ': PROBLEMS\n  ' + problems.join('\n  ')); continue; }
    if (args.includes('--codes')) { console.log(n.padEnd(20) + (await codeCheck(rules, 7))); continue; }
    if (args.includes('--turned')) {
      console.log(n.padEnd(20) + 'player 1 wins of ' + games + ', board turned 12 ways:  ' + TURNS.map((t) => t.name.replace(' ', '') + ' ' + series(turnRules(rules, t.f)).w).join('  '));
      continue;
    }
    const count = args.includes('--events') ? {} : null, a = series(rules, count);
    if (args.includes('--both')) {
      // seats swapped: player 1's fleet is now in seat 2, so its wins are that run's losses
      const b = series(loadBoard(n, { set, swap: true }).rules, count), mir = mirrorOf(rules);
      console.log(`${n.padEnd(20)} player 1's fleet: moving first ${a.w}-${a.l}-${a.d} (${a.rounds} rounds), moving second ${b.l}-${b.w}-${b.d} (${b.rounds} rounds), in all ${a.w + b.l} of ${2 * games}; ${a.nk + b.nk} to the round limit${mir ? '   exact mirror (' + mir + ')' : ''}`);
    } else console.log(`${n.padEnd(20)} cost ${rules.fleets.map((f) => f.cost).join(' v ').padEnd(10)} you (player 1) ${a.w}-${a.l}-${a.d} over ${games} computer-flown games, ${a.rounds} rounds, ${a.nk} to the round limit   "${doc.board.name}"`);
    if (count) console.log('    ' + (Object.entries(count).sort().map(([k, v]) => k + ' ' + v).join(', ') || 'nothing of note'));
  }
}
