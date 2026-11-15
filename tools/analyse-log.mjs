#!/usr/bin/env node
// Read a SHATKON battle log (the "Download battle log" file), replay it through the engine to
// check it, and print a plain-English recap: key moments, things to look at, turn by turn.
//
//   node tools/analyse-log.mjs shatkon-battle-2026-11-15-1630.json [--json] [--no-turns]
//
// A log saved after the game ended holds the whole game and is replayed move by move; the recap
// is then rebuilt from the replay, so it does not depend on the file's own summary. A log saved
// mid-game only holds one side's view and cannot be replayed; its recorded turns are used as-is.

import fs from 'node:fs';
import { battleLog, replayLog, analyse, LOG_FORMAT } from '../engine/index.js';

const args = process.argv.slice(2), file = args.find((a) => !a.startsWith('--'));
if (!file) { console.error('usage: node tools/analyse-log.mjs <battle-log.json> [--json] [--no-turns]'); process.exit(2); }
let log;
try { log = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error('Could not read ' + file + ': ' + e.message); process.exit(1); }
if (!log || log.format !== LOG_FORMAT) { console.error(file + ' is not a SHATKON battle log.'); process.exit(1); }

let report = log, check;
if (log.replay) {
  try {
    const state = replayLog(log);
    report = battleLog(state, { viewer: 'all', seat: log.seat, now: log.created });
    const moves = log.replay.turns.reduce((n, t) => n + t.actions.length, 0);
    check = 'Replay check: the engine replayed all ' + moves + ' actions over ' + log.replay.turns.length + ' turns and ended in exactly the saved position.';
  } catch (e) {
    check = 'Replay check FAILED: ' + e.message + '. The recap below uses the file as recorded.';
  }
} else check = 'Replay check: skipped (' + (log.note || 'this log only holds one side\u2019s view, so it cannot be replayed') + ').';

const out = analyse(report);
if (args.includes('--json')) { console.log(JSON.stringify({ check, moments: out.moments, lines: out.lines }, null, 2)); process.exit(0); }
console.log(out.lines.join('\n'));
console.log('');
console.log(check);
if (!args.includes('--no-turns')) { console.log(''); console.log('TURN BY TURN'); console.log(out.recap.join('\n')); }
