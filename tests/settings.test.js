// Battle-settings sheets (ui/settings.js): only rows the player changed are stored and passed to the
// engine, so an untouched row never overrides the board file (28 Nov 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const S = await import('../ui/settings.js');
const E = await import('../engine/index.js');
const T = S._settingsTest;

test('nothing changed: the sheets pass nothing, so the board and the engine defaults decide', () => {
  mem.clear();
  assert.deepEqual(S.rapidOptions(), {});
  assert.deepEqual(S.econOptions(), {});
  assert.deepEqual(S.threeOptions(), {});
});

test('older saves stored every row: values equal to the default count as untouched', () => {
  mem.clear();
  const all = Object.fromEntries(T.RAPID_SETTINGS.map((d) => [d.key, d.def !== undefined ? d.def : d.options[0][0]]));
  mem.set(T.RSTORE, JSON.stringify({ ...all, timer: '20' }));
  assert.deepEqual(S.rapidOptions(), { timer: 20 }, 'only the real change survives');
});

test('a change is stored; choosing the default (or the board value) again un-changes the row', () => {
  mem.clear();
  T.writeSet(T.RSTORE, T.RAPID_SETTINGS, 'timer', '20');
  assert.deepEqual(S.rapidOptions(), { timer: 20 });
  T.writeSet(T.RSTORE, T.RAPID_SETTINGS, 'timer', '15');
  assert.deepEqual(S.rapidOptions(), {});
  const board = { line: 7 };
  T.writeSet(T.RSTORE, T.RAPID_SETTINGS, 'line', 9, board);
  assert.deepEqual(S.rapidOptions(), { line: 9 });
  T.writeSet(T.RSTORE, T.RAPID_SETTINGS, 'line', 7, board);
  assert.deepEqual(S.rapidOptions(), {}, 'the board value is the default on that board');
});

test('untouched rows show the board file\'s own values', () => {
  mem.clear();
  const cur = T.readSet(T.RSTORE, T.RAPID_SETTINGS, { line: 7 });
  assert.equal(cur.line, 7);
  const econ = T.readSet(T.ESTORE, T.ECON_SETTINGS, { economy: true, econ: { cap: 10 } });
  assert.equal(econ.economy, 'on', 'true reads as On');
  assert.equal(econ.econCap, '10', 'the board econ: cap fills the Income cap row');
  assert.equal(T.readSet(T.TSTORE, T.THREE_SETTINGS, { ring: 4 }).ring, '4');
});

test('players see a few rows; the rest are tuning', () => {
  const seen = (list) => list.filter(T.isPlayerRow).map((d) => d.key);
  assert.deepEqual(seen(T.SETTINGS), ['ff', 'opponent'].filter((k) => T.SETTINGS.some((d) => d.key === k)).sort((a, b) => T.SETTINGS.findIndex((d) => d.key === a) - T.SETTINGS.findIndex((d) => d.key === b)));
  assert.deepEqual(seen(T.RAPID_SETTINGS).sort(), ['cap', 'timer', 'watch']);
  assert.deepEqual(seen(T.ECON_SETTINGS), ['cpuStyle']);
  assert.deepEqual(seen(T.THREE_SETTINGS), ['cpuStyle2']);
});

test('the engine reads a board\'s true/false switches: Frontier\'s economy and interceptHurts are on', () => {
  const YAML = vm.runInThisContext(fs.readFileSync('lib/yaml.min.js', 'utf8') + '\n;YAML');
  const world = YAML.parse(fs.readFileSync('rules/world_v0.4.yaml', 'utf8'));
  for (const name of ['rapid_frontier', 'three_edges']) {
    const b = YAML.parse(fs.readFileSync('rules/rapid/' + name + '.yaml', 'utf8'));
    const { rules } = E.buildRules(world, b, b);
    const R = E.rapidRules(rules, { ...b.rapid });   // what the play screen does when no sheet row was changed
    assert.equal(R.rapid.economy, 'on', name + ' economy');
    assert.equal(R.rapid.interceptHurts, 'on', name + ' interceptHurts');
    const g = E.rapidStart(R, 1);
    assert.ok(g.econ, name + ' starts with an economy');
  }
});
