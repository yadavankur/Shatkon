// The simulation-only rule switches (beta engine) and the variants runner.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../beta/engine/index.js';
import { parseCell, rulesFor, runCell, V } from '../tools/variants.mjs';

const game = (variant, seed = 5) => E.start(rulesFor(parseCell(variant + ' | stock:balanced v stock:balanced'), seed, false), seed);
const endTurn = (g) => E.attempt(g, { type: 'end' });

test('a cell replays exactly from its seed', () => {
  const c = parseCell('baseline | stock:balanced v stock:sitter');
  const a = runCell(c, 4, 11), b = runCell(c, 4, 11);
  assert.deepEqual([a.w, a.l, a.d, a.rounds, a.seed0], [b.w, b.l, b.d, b.rounds, b.seed0]);
});

test('every variant names the rule it changes and builds', () => {
  for (const [name, v] of Object.entries(V.variants)) {
    assert.ok(v.note && v.rule, name + ' needs a note and a rule');
    assert.ok(game(name), name);
  }
});

test('the switches are off at baseline: a fleet may end its turn without moving, and first player alternates', () => {
  let g = game('baseline');
  assert.deepEqual(g.order, [0, 1]);
  g = endTurn(g); assert.ok(g.ok);
  g = endTurn(g.state); assert.ok(g.ok);
  assert.equal(g.state.round, 2);
  assert.deepEqual(g.state.order, [1, 0]);
});

test('movement.min_move: the turn cannot end until the fleet has moved', () => {
  const g = game('move_1');
  const r = endTurn(g);
  assert.equal(r.ok, false);
  assert.match(r.why, /must move first/);
  const ship = g.ships.find((s) => s.owner === 0 && E.reach(g, s.id).length);
  const moved = E.attempt(g, { type: 'move', ship: ship.id, path: E.reach(g, ship.id)[0].path.slice(0, 1) });
  assert.ok(moved.ok);
  assert.ok(endTurn(moved.state).ok);
});

test('turns.first_player: fixed keeps the same player first every round', () => {
  let g = endTurn(game('first_fixed'));
  g = endTurn(g.state);
  assert.equal(g.state.round, 2);
  assert.deepEqual(g.state.order, [0, 1]);
});
