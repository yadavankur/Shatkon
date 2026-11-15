// The hand-made boards in beta/rules/boards/: check them, let the computer play them, and check
// that a game on each one survives being played across two devices by pasted codes.
//
//   node tools/boards.mjs                 every board: problems, cost, 10 computer-v-computer games
//   node tools/boards.mjs --games 20
//   node tools/boards.mjs --codes         two-device check: game code out and in, then every turn by turn code
//   node tools/boards.mjs --board 02_minefield
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
export function loadBoard(name) {
  const doc = YAML.parse(fs.readFileSync(path.join(BETA, 'rules/boards', name + '.yaml'), 'utf8'));
  const world = YAML.parse(fs.readFileSync(path.join(BETA, 'rules/world_v0.4.yaml'), 'utf8'));
  for (const [k, v] of Object.entries((doc.board || {}).rules || {})) { const ks = k.split('.'); let o = world; for (const x of ks.slice(0, -1)) o = o[x] = o[x] ?? {}; o[ks.at(-1)] = v; }
  return { doc, ...E.buildRules(world, doc, doc) };
}

// One turn's worth of computer actions for whoever is to move. Returns the state after "end".
function playTurn(g) {
  const seat = g.order[g.turn];
  for (let i = 0; i < 60 && g.phase === 'play' && g.order[g.turn] === seat; i++) {
    let a = computerMove(g, seat, 'normal') || { type: 'end' };
    let r = E.attempt(g, a);
    if (!r.ok) { a = { type: 'end' }; r = E.attempt(g, a); }
    g = r.state;
    if (a.type === 'end') break;
  }
  return g;
}
function playOut(rules, seed) {
  let g = E.start(rules, seed), guard = 0;
  while (g.phase === 'play' && guard++ < 400) g = playTurn(g);
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
  const names = opt('board') ? [opt('board')] : boardNames(), games = Number(opt('games', 10));
  for (const n of names) {
    const { doc, rules, problems } = loadBoard(n);
    if (problems.length) { console.log(n + ': PROBLEMS\n  ' + problems.join('\n  ')); continue; }
    if (args.includes('--codes')) { console.log(n.padEnd(20) + (await codeCheck(rules, 7))); continue; }
    let w = 0, l = 0, d = 0, rounds = 0, nk = 0;
    for (let s = 1; s <= games; s++) { const r = playOut(rules, s); rounds += r.rounds; if (r.by === 'turn_limit') nk++; if (r.winner === 'draw') d++; else if (r.winner === 0) w++; else l++; }
    console.log(`${n.padEnd(20)} cost ${rules.fleets.map((f) => f.cost).join(' v ').padEnd(10)} you (south) ${w}-${l}-${d} over ${games} computer-flown games, ${(rounds / games).toFixed(1)} rounds, ${nk} to the round limit   "${doc.board.name}"`);
  }
}
