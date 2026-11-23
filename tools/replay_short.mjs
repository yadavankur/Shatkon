// Replay a short (chess-style) rapid-mode log and print the full battle log or its recap.
// Usage: node tools/replay_short.mjs <short-log.json> [--full]
//   It rebuilds the rules from the board file the log names, the world file and the log's changed
//   settings, replays every tick from the seed and checks it ends where the game did.
import { readFileSync } from 'node:fs';
import { readYaml, shippedFiles } from '../tests/helpers.js';
import * as E from '../engine/index.js';

const [file, flag] = process.argv.slice(2);
if (!file) { console.log('usage: node tools/replay_short.mjs <short-log.json> [--full]'); process.exit(1); }
const short = JSON.parse(readFileSync(file, 'utf8'));
const b = readYaml('rules/rapid/' + short.board + '.yaml');
const { rules } = E.buildRules(shippedFiles().world, b, b);
const now = Object.fromEntries(Object.entries(short.settings || {}).map(([k, v]) => [k, v.now]));
const g = E.replayShort(short, E.rapidRules({ ...rules, rapid: b.rapid }, now));
const log = E.battleLog(g, { seat: 'cpu' });
console.log(flag === '--full' ? JSON.stringify(log) : E.recapText(log));
