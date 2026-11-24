// The replay guarantee: the golden games (tools/golden.mjs) replay move for move to the same final
// position. A new experiment that is switched off must not change them; if one does, it leaks into the
// normal game. Re-record only on purpose (a deliberate rule change): node tools/golden.mjs --record
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as E from '../engine/index.js';
import { rulesFor } from '../tools/golden.mjs';

for (const f of readdirSync('tests/golden').filter((n) => n.endsWith('.json'))) {
  test('golden game ' + f + ' replays to the same position', () => {
    const g = JSON.parse(readFileSync('tests/golden/' + f, 'utf8'));
    let s = E.rapidStart(rulesFor(g), g.seed);
    for (const m of g.moves) s = E.rapidTick(s, m.split(' ').map(E.parseTick));
    assert.equal(E.hashState(s), g.finalHash);
  });
}
