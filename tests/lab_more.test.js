// The Ghost, Repair, Warp and Hibernate practice boards (rules/rapid/lab_*.yaml): each loads, only its
// own switch is on, each side's home is its own edge, and the thing to try works on tick 1 or 2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readYaml, shippedFiles } from './helpers.js';
import * as E from '../engine/index.js';

const start = (k) => {
  const b = readYaml('rules/rapid/lab_' + k + '.yaml');
  const { rules, problems } = E.buildRules(shippedFiles().world, b, b);
  assert.deepEqual(problems, [], k);
  // as the play page builds it: the Frontier sheet's cap (6) applies, not anything the board says
  return E.rapidStart(E.rapidRules({ ...rules, rapid: b.rapid }, { ...b.rapid, econCap: 6 }), 42);
};
const ship = (g, n, p = 0) => g.ships.find((x) => x.owner === p && x.name === n);

for (const [k, key] of [['ghost', 'ghost'], ['repair', 'repair'], ['warp', 'warp'], ['hibernate', 'hibernate']]) {
  test(k + ': loads, only its switch on, at most one 3-hex ship and two scouts a side, homes on their own edges', () => {
    const g = start(k);
    for (const x of E.EXP_KEYS) assert.equal(E.exp(g, x), x === key, x);
    assert.equal(E.homeSign(g, 0), 1); assert.equal(E.homeSign(g, 1), -1);
    for (const p of [0, 1]) {
      const s = g.ships.filter((x) => x.owner === p);
      assert.ok(s.filter((x) => x.segs.length === 3).length <= 1 && s.filter((x) => x.segs.length === 1).length <= 2);
    }
  });
}

test('startRekon: both sides start with it; boards without it start at 0', () => {
  assert.deepEqual(start('repair').econ.purse, [12, 12]);
  assert.deepEqual(start('warp').econ.purse, [6, 6]);
  assert.deepEqual(start('hibernate').econ.purse, [2, 2]);
  assert.deepEqual(start('ghost').econ.purse, [0, 0]);
});

test('warp and hibernate can be bought on tick 1', () => {
  let g = start('warp'); const a = ship(g, 'Pawn A');
  const at = E.warpSpots(g, 0, a.id)[0];
  assert.equal(E.rapidRefusal(g, 0, { type: 'buy', item: 'warp', ship: a.id, at }), null);
  g = start('hibernate');
  const b = { type: 'buy', item: 'hibernate', ship: ship(g, 'Pawn A').id };
  assert.equal(E.rapidRefusal(g, 0, b), null);
  g = E.rapidTick(g, [b, E.rapidAI(g, 1, 'normal', () => 0.5)]);
  assert.ok(g.ships.find((x) => x.id === b.ship).hib);
  assert.ok(!E.visibleTo(g, 1).has(b.ship));
});
