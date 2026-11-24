// The ui files aren't imported by the other tests (they need a browser), so check they at least parse:
// a syntax slip there blanks the whole page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

test('every ui/*.js file parses', () => {
  for (const f of readdirSync('ui').filter((n) => n.endsWith('.js'))) {
    assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', 'ui/' + f], { stdio: 'pipe' }), 'ui/' + f);
  }
});
