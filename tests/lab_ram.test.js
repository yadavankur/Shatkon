// Ram practice board (rules/rapid/lab_ram.yaml): one tiny Experiments set-up, Ram already on.
// Loaded the same way as the Lab board (buildRules + rapidRules + rapidStart).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readYaml, shippedFiles } from './helpers.js';
import * as E from '../engine/index.js';
import { EXP_KEYS } from '../engine/experiments.js';

const FILE = 'rules/rapid/lab_ram.yaml';
function start(opts = {}, seed = 5) {
  const b = readYaml(FILE);
  const { rules, problems } = E.buildRules(shippedFiles().world, b, b);
  return { b, problems, game: E.rapidStart(E.rapidRules({ ...rules, rapid: b.rapid }, { ...b.rapid, ...opts }), seed) };
}
const clone = (g) => { const s = structuredClone({ ...g, rules: undefined }); s.rules = g.rules; return s; };
const ship = (g, name, p = 0) => g.ships.find((x) => x.owner === p && x.name === name);
const PASS = { type: 'pass' };

test('the Ram practice board loads through the same board builder as the Lab, with no problems', () => {
  const { b, problems, game } = start();
  assert.deepEqual(problems, []);
  assert.equal(b.board.name, 'Ram');
  assert.match(b.board.try, /Move your scout/i);
  assert.match(b.board.idea, /wrecked/i);
  assert.equal(game.rules.board.radius, 7);
  assert.equal(game.rules.rapid.experiments, 'on');
  assert.equal(game.rules.rapid.line, 4);
});

test('only the ram experiment is on, and the computer is set to ram eagerly', () => {
  const { game } = start();
  assert.equal(E.exp(game, 'ram'), true);
  for (const k of EXP_KEYS) if (k !== 'ram') assert.equal(E.exp(game, k), false, k + ' should be off');
  assert.equal(game.rules.rapid.cpuExp.ram, 'eager');
});

test('each side has at most one 3-hex ship and two scouts; the scout starts 3 hexes from their Warden', () => {
  const { game } = start();
  for (const p of [0, 1]) {
    const mine = game.ships.filter((s) => s.owner === p && !s.dead);
    const big = mine.filter((s) => s.segs.length === 3);
    const scouts = mine.filter((s) => s.segs.length === 1);
    assert.ok(big.length <= 1 && scouts.length <= 2);
    assert.equal(big[0].name, 'Warden');
    assert.equal(scouts[0].name, 'Pawn A');
  }
  // engine/hex.js dist is imported by the engine; gap() is the ship-to-ship distance the ram rule uses
  assert.equal(E.gap(ship(game, 'Pawn A'), ship(game, 'Warden', 1)), 3);
  assert.equal(E.gap(ship(game, 'Pawn A', 1), ship(game, 'Warden')), 3);
  assert.ok(game.players[0].vis.includes(ship(game, 'Warden', 1).id), 'you should already see their Warden');
});

test('after one hex closer, Ram is legal; the scout is gone and the nearest Warden section is wrecked', () => {
  let { game: g } = start();
  const me = ship(g, 'Pawn A'), foe = ship(g, 'Warden', 1);
  assert.ok(E.rapidRefusal(g, 0, { type: 'ram', ship: me.id, target: foe.id }));   // too far at the start
  g = E.rapidTick(g, [{ type: 'move', ship: me.id, path: [3] }, PASS]);            // dir 3: one hex closer
  const a = { type: 'ram', ship: me.id, target: foe.id };
  assert.equal(E.rapidRefusal(g, 0, a), null);
  g = E.rapidTick(g, [a, PASS]);
  assert.ok(g.ships.find((x) => x.id === me.id).dead);
  assert.equal(g.ships.find((x) => x.id === me.id).converted, 'ram');
  const target = g.ships.find((x) => x.id === foe.id);
  assert.ok(target.segs.some((sg) => sg.wrecked), 'a section of the Warden should be wrecked');
  assert.equal(target.dead, false, 'the flagship should still be alive, so you can see the wrecked section');
});

test('with ram switched off the same move is refused: the experiment does not leak', () => {
  const { game } = start({ exp: {} });
  const me = ship(game, 'Pawn A'), foe = ship(game, 'Warden', 1);
  assert.match(E.rapidRefusal(game, 0, { type: 'ram', ship: me.id, target: foe.id }), /off/);
  assert.equal(E.exp(game, 'ram'), false);
});

test('each side knows its own home edge, even with ships placed mid-board (player 2 is home north)', () => {
  const { game } = start();
  assert.equal(E.homeSign(game, 0), 1);
  assert.equal(E.homeSign(game, 1), -1);
  for (const n of ['Warden', 'Pawn A']) assert.equal(E.rowsForward(game, 1, ship(game, n, 1).pos), E.rowsForward(game, 0, ship(game, n).pos), n + ': mirrored ships are the same rows forward');
  for (const p of [0, 1]) for (const x of game.ships.filter((s) => s.owner === p)) assert.equal(E.view(game, p).ships.find((s) => s.id === x.id).scanR === null, false, 'rapid ships always have scan radii');
});
