// Muse vs Opus: the hunter against the stock computer, across the ten boards.
// Each board is played --games times as written and the same number with the fleets
// swapping seats, so each side plays each fleet: 2 * --games games a board.
//   node tools/muse-vs-opus.mjs                      10 games a board, both seats (200 games)
//   node tools/muse-vs-opus.mjs --games 2 --board 01_first_light
//   node tools/muse-vs-opus.mjs --codes               also save one representative game code
//                                                     per board (a Muse win when there is one)
//                                                     under docs/design/muse-ai-codes/
//   node tools/muse-vs-opus.mjs --games 20           the full 40-games-a-board run (400 games)
//
// "Opus" here is the stock computer as the game ships it: computerMove normal, with
// whatever personality the board pins in its rules: (most boards pin balanced or
// aggressive). "Muse" is the hunter: computerMove with personality 'muse'. Seeds are
// 1..N; the seed is the game's dice, so a run replays exactly.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E = await import('file://' + path.join(root, 'engine/index.js').replace(/\\/g, '/'));
const { computerMove } = await import('file://' + path.join(root, 'engine/ai.js').replace(/\\/g, '/'));
const { loadBoard, boardNames } = await import('file://' + path.join(root, 'tools/boards.mjs').replace(/\\/g, '/'));

const muse = (g, seat) => computerMove(g, seat, 'normal', { personality: 'muse' });
const opus = (g, seat) => computerMove(g, seat, 'normal');

// One turn's worth of actions for whoever is to move, from that side's computer.
function playTurn(g, move) {
  const seat = g.order[g.turn];
  for (let i = 0; i < 60 && g.phase === 'play' && g.order[g.turn] === seat; i++) {
    let a = move(g, seat) || { type: 'end' };
    let r = E.attempt(g, a);
    if (!r.ok) { a = { type: 'end' }; r = E.attempt(g, a); }
    g = r.state;
    if (a.type === 'end') break;
  }
  return g;
}

function playGame(rules, seed, museSeat) {
  let g = E.start(rules, seed);
  const move = (state, seat) => (seat === museSeat ? muse(state, seat) : opus(state, seat));
  let guard = 0;
  while (g.phase === 'play' && guard++ < 400) g = playTurn(g, move);
  const over = g.events.find((e) => e.t === 'game_over') || {};
  return { game: g, winner: g.winner, rounds: g.round, by: over.by || 'flagship' };
}

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const games = Number(opt('games', 10));
const names = opt('board') ? opt('board').split(',') : boardNames();
const saveCodes = args.includes('--codes');
const codesDir = path.join(root, 'docs/design/muse-ai-codes');
if (saveCodes) fs.mkdirSync(codesDir, { recursive: true });

const totals = { muse: 0, opus: 0, draws: 0, rounds: 0, n: 0, limit: 0 };
console.log(`Muse v Opus, ${games} games a board per seat (${2 * games} a board), seeds 1..${games}`);
for (const n of names) {
  const { rules, problems } = loadBoard(n);
  if (problems.length) { console.log(n + ': PROBLEMS\n  ' + problems.join('\n  ')); continue; }
  const swapped = loadBoard(n, { swap: true }).rules;
  // per seat: [muse wins, opus wins, draws, rounds, to the limit]
  const per = { 0: [0, 0, 0, 0, 0], 1: [0, 0, 0, 0, 0] };
  let repCode = null, repWin = false, repNote = '';
  for (let s = 1; s <= games; s++) {
    for (const [rs, museSeat] of [[rules, 0], [swapped, 1]]) {
      const r = playGame(rs, s, museSeat), p = per[museSeat];
      p[3] += r.rounds;
      if (r.by === 'turn_limit') p[4]++;
      if (r.winner === 'draw') p[2]++;
      else if (r.winner === museSeat) p[0]++;
      else p[1]++;
      // representative game: the first Muse win; if none, the first game of the board
      if (saveCodes && (!repCode || (r.winner === museSeat && !repWin))) {
        const code = await E.exportGame(r.game);
        const back = await E.importGame(code);
        if (E.hashState(back) !== E.hashState(r.game)) { console.log('  ' + n + ': WARNING the saved game code does not round-trip'); continue; }
        repCode = code;
        repWin = r.winner === museSeat;
        repNote = repWin ? `Muse wins as seat ${museSeat + 1}, seed ${s}` : `first game, seed ${s}`;
      }
    }
  }
  const all = [0, 1, 2, 3, 4].map((i) => per[0][i] + per[1][i]);
  totals.muse += all[0]; totals.opus += all[1]; totals.draws += all[2]; totals.rounds += all[3]; totals.n += 2 * games; totals.limit += all[4];
  if (saveCodes && repCode) fs.writeFileSync(path.join(codesDir, n + '.txt'), repCode + '\n');
  console.log(`${n.padEnd(20)} Muse ${String(all[0]).padStart(2)} - Opus ${String(all[1]).padStart(2)} - draw ${String(all[2]).padStart(2)}  ` +
    `(as seat 1: ${per[0][0]}-${per[0][1]}-${per[0][2]}, as seat 2: ${per[1][0]}-${per[1][1]}-${per[1][2]}), ` +
    `${(all[3] / (2 * games)).toFixed(1)} rounds, ${all[4]} to the round limit` +
    (saveCodes ? `  [code: ${repNote}]` : ''));
}
console.log(`TOTAL                Muse ${totals.muse} - Opus ${totals.opus} - draw ${totals.draws} over ${totals.n} games, ${(totals.rounds / totals.n).toFixed(1)} rounds, ${totals.limit} to the round limit`);
if (saveCodes) console.log('game codes saved under docs/design/muse-ai-codes/ — load one in the game (drawer: Load a game code) to watch it');
