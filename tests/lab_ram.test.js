// Ram practice board (rules/rapid/lab_ram.yaml): calm target practice, Ram already on.
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
const ship = (g, name, p = 0) => g.ships.find((x) => x.owner === p && x.name === name);
const PASS = { type: 'pass' };

test('the Ram practice board loads through the same board builder as the Lab, with no problems', () => {
  const { b, problems, game } = start();
  assert.deepEqual(problems, []);
  assert.equal(b.board.name, 'Ram');
  assert.equal(b.board.try, 'Tap a scout, then tap Ram.');
  assert.match(b.board.idea, /wrecked/i);
  assert.equal(game.rules.board.radius, 7);
  assert.equal(game.rules.rapid.experiments, 'on');
  assert.equal(game.rules.rapid.line, 7);
  assert.equal(game.rules.rapid.economy, 'off');
});

test('only the ram experiment is on, and the computer is set never to ram', () => {
  const { game } = start();
  assert.equal(E.exp(game, 'ram'), true);
  for (const k of EXP_KEYS) if (k !== 'ram') assert.equal(E.exp(game, k), false, k + ' should be off');
  assert.equal(game.rules.rapid.cpuExp.ram, 'never');
});

test('you have two scouts already within ram range; the dummy Warden has no scout and you are not past the line', () => {
  const { game } = start();
  const mine = game.ships.filter((s) => s.owner === 0 && !s.dead);
  const foe = game.ships.filter((s) => s.owner === 1 && !s.dead);
  assert.equal(mine.filter((s) => s.segs.length === 3).length, 1);
  assert.equal(mine.filter((s) => s.segs.length === 1).length, 2);
  assert.equal(foe.length, 1);
  assert.equal(foe[0].name, 'Warden');
  assert.equal(foe[0].segs.length, 3);
  const target = ship(game, 'Warden', 1);
  for (const n of ['Pawn A', 'Pawn B']) {
    const me = ship(game, n);
    assert.equal(E.pastLine(game, me), false, n + ' should start on your side of the line');
    assert.ok(E.gap(me, target) <= 2, n + ' should already be within ram range, gap ' + E.gap(me, target));
    assert.ok(game.players[0].vis.includes(target.id), 'you should already see their Warden');
    assert.equal(E.rapidRefusal(game, 0, { type: 'ram', ship: me.id, target: target.id }), null);
    assert.equal(E.canConvert(game, 0, { type: 'move', ship: me.id, path: [1] }) && E.pastLine(game, me), false);
  }
  assert.equal(E.homeSign(game, 0), 1);
  assert.equal(E.homeSign(game, 1), -1);
});

test('a ram on tick 1 wrecks a section of their Warden; the scout is gone; the dummy does not shoot', () => {
  let { game: g } = start();
  const me = ship(g, 'Pawn A'), foe = ship(g, 'Warden', 1);
  const a = { type: 'ram', ship: me.id, target: foe.id };
  const ai = E.rapidAI(g, 1);
  assert.notEqual(ai.type, 'ram', 'the dummy should not ram');
  assert.notEqual(ai.type, 'fire', 'the dummy should not shoot');
  assert.notEqual(ai.type, 'launch', 'the dummy should not launch');
  g = E.rapidTick(g, [a, ai]);
  assert.ok(g.ships.find((x) => x.id === me.id).dead);
  assert.equal(g.ships.find((x) => x.id === me.id).converted, 'ram');
  const target = g.ships.find((x) => x.id === foe.id);
  assert.ok(target.segs.some((sg) => sg.wrecked), 'a section of the Warden should be wrecked');
  assert.equal(target.dead, false, 'the flagship should still be alive, so you can see the wrecked section');
  // the second scout can still ram
  const b = ship(g, 'Pawn B');
  assert.equal(E.rapidRefusal(g, 0, { type: 'ram', ship: b.id, target: foe.id }), null);
});

test('with ram switched off the same move is refused: the experiment does not leak', () => {
  const { game } = start({ exp: {} });
  const me = ship(game, 'Pawn A'), foe = ship(game, 'Warden', 1);
  assert.match(E.rapidRefusal(game, 0, { type: 'ram', ship: me.id, target: foe.id }), /off/);
  assert.equal(E.exp(game, 'ram'), false);
});
