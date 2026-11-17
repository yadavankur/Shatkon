// The launch splash: the logo drawing is current, and the "show it once per session" rule behaves.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTo } from '../tools/make-splash.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('lib/splash.js carries the current logo drawing (run node tools/make-splash.mjs if this fails)', () => {
  const cur = read('lib/splash.js');
  assert.equal(applyTo(cur), cur);
  assert.ok(cur.includes('sp-outer') && cur.includes('sp-wl'), 'the mark and the wordmark are both in there');
});

test('the Field Manual is left alone: its own hero animation still uses its own class names', () => {
  assert.ok(read('docs/tools/src/template.html').includes('.hm-l{stroke-dasharray:1'));
});

test('the service worker keeps the splash file for offline launches', () => {
  assert.match(read('sw.js'), /c\.add\('lib\/splash\.js'\)/);
});

// Run index.html's inline snippet against a pretend page.
function runSnippet(search, hash, store) {
  const html = read('index.html');
  const code = /<script>\n\/\/ Launch splash[\s\S]*?<\/script>/.exec(html)[0].replace(/^<script>/, '').replace(/<\/script>$/, '');
  const added = [];
  const el = () => ({ style: {}, setAttribute() {}, remove() {} });
  const document = { documentElement: { appendChild: (n) => added.push(n.id || n.src) }, head: { appendChild: (n) => added.push(n.src) }, createElement: el };
  const ctx = { document, sessionStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } }, location: { search, hash }, setTimeout() {}, window: {} };
  vm.runInNewContext(code, ctx);
  return added;
}

test('splash shows on the first launch of a session, then not again', () => {
  const store = {};
  assert.deepEqual(runSnippet('', '', store), ['splash', 'lib/splash.js']);
  assert.deepEqual(runSnippet('', '', store), []);
});
test('splash is skipped when the address says where to go, and counts as seen', () => {
  for (const [s, h] of [['?continue=1', ''], ['', '#play'], ['?board=first_light&mode=cpu', '']]) {
    const store = {};
    assert.deepEqual(runSnippet(s, h, store), []);
    assert.deepEqual(runSnippet('', '', store), [], 'and not shown later this session either');
  }
});
test('?splash shows it again on request', () => {
  const store = { 'shatkon.splash': '1' };
  assert.deepEqual(runSnippet('?splash', '', store), ['splash', 'lib/splash.js']);
});
