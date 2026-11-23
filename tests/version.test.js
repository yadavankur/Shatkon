// The build number (ui/version.js) is a whole number and the service worker's cache carries it,
// so a phone fetches a new build instead of serving the old one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUILD, buildLabel } from '../ui/version.js';

test('the build number is a whole number, shown as "build #n", and names the offline cache', () => {
  assert.ok(Number.isInteger(BUILD) && BUILD > 0);
  assert.match(buildLabel(), new RegExp('build #' + BUILD));
  assert.match(readFileSync('sw.js', 'utf8'), new RegExp("'shatkon-offline-b" + BUILD + "'"));
});
