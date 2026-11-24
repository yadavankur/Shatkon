// Smart mine practice board (rules/rapid/lab_stateMines.yaml): one tiny Experiments set-up, stateMines already on.
// Loaded the same way as the Lab board (buildRules + rapidRules + rapidStart).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readYaml, shippedFiles } from './helpers.js';
import * as E from '../engine/index.js';
import { EXP_KEYS } from '../engine/experiments.js';

const FILE = 'rules/rapid/lab_stateMines.yaml';
function start(opts = {}, seed = 5) {
  const b = readYaml(FILE);
  const { rules, problems } = E.buildRules(shippedFiles().world, b, b);
  return { b, problems, game: E.rapidStart(E.rapidRules({ ...rules, rapid: b.rapid }, { ...b.rapid, ...opts }), seed) };
}
const ship = (g, name, p = 0) => g.ships.find((x) => x.owner === p && x.name === name);
const PASS = { type: 'pass' };

test('the Smart mine practice board loads through the same board builder as the Lab, with no problems', () => {
  const { b, problems, game } = start();
  assert.deepEqual(problems, []);
  assert.equal(b.board.name, 'Smart mine');
  assert.match(b.board.try, /tap Mine/i);
  assert.match(b.board.try, /Stay a ship/i);
  assert.match(b.board.idea, /smart mine/i);
  assert.equal(game.rules.board.radius, 7);
  assert.equal(game.rules.rapid.experiments, 'on');
  assert.equal(game.rules.rapid.line, 6);
});

test('only the stateMines experiment is on', () => {
  const { game } = start();
  assert.equal(E.exp(game, 'stateMines'), true);
  for (const k of EXP_KEYS) if (k !== 'stateMines') assert.equal(E.exp(game, k), false, k + ' should be off');
});

test('each side has at most one 3-hex ship and two scouts; home zones stay in each side\'s own half', () => {
  const { game } = start();
  for (const p of [0, 1]) {
    const mine = game.ships.filter((s) => s.owner === p && !s.dead);
    const big = mine.filter((s) => s.segs.length === 3);
    const scouts = mine.filter((s) => s.segs.length === 1);
    assert.ok(big.length <= 1 && scouts.length <= 2);
    assert.equal(big[0].name, 'Warden');
  }
  assert.equal(E.homeSign(game, 0), 1);
  assert.equal(E.homeSign(game, 1), -1);
  const R = game.rules.board.radius;
  for (const z of game.rules.zones.filter((q) => q.name === 'player_1_home' || q.name === 'player_2_home')) {
    assert.ok(z.depth <= R, z.name + ' depth ' + z.depth + ' would cross the mid-line');
  }
  // south depth 7 on radius 7 is r >= 1; north is r <= -1 (the equator is no-man's-land)
  for (const x of game.ships.filter((s) => s.owner === 0)) assert.ok(x.pos[1] >= 1, x.name + ' should be in the south half');
  for (const x of game.ships.filter((s) => s.owner === 1)) assert.ok(x.pos[1] <= -1, x.name + ' should be in the north half');
  for (const p of [0, 1]) for (const x of game.ships.filter((s) => s.owner === p)) {
    assert.equal(E.view(game, p).ships.find((s) => s.id === x.id).scanR === null, false, 'rapid ships always have scan radii');
  }
});

test('your two scouts start just past the line; theirs have not crossed yet', () => {
  const { game } = start();
  assert.equal(E.pastLine(game, ship(game, 'Pawn A')), true);
  assert.equal(E.pastLine(game, ship(game, 'Pawn B')), true);
  assert.equal(E.pastLine(game, ship(game, 'Warden')), false);
  assert.equal(E.pastLine(game, ship(game, 'Pawn A', 1)), false);
  assert.equal(E.pastLine(game, ship(game, 'Pawn B', 1)), false);
  assert.equal(E.rowsForward(game, 0, ship(game, 'Pawn A').pos), 6);
});

test('moving the healthy scout one hex north and converting lays a smart mine at the centre', () => {
  let { game: g } = start();
  const me = ship(g, 'Pawn A');
  assert.equal(E.mineKindFor(g, me), 'smart_mine');
  const act = { type: 'move', ship: me.id, path: [2], convert: 'mine' };
  assert.equal(E.canConvert(g, 0, { type: 'move', ship: me.id, path: [2] }), true);
  assert.equal(E.rapidRefusal(g, 0, act), null);
  // player 2 cannot pass yet (none of their ships is past the line). Move their Warden
  // one hex forward, well outside the mine's 3-hex range, so the mine is laid without going off.
  const ward = ship(g, 'Warden', 1);
  const step = { type: 'move', ship: ward.id, path: [5] };
  assert.equal(E.rapidRefusal(g, 1, step), null);
  g = E.rapidTick(g, [act, step]);
  assert.ok(g.ships.find((x) => x.id === me.id).dead);
  assert.equal(g.ships.find((x) => x.id === me.id).converted, 'mine');
  const mine = g.objs.find((o) => o.kind === 'smart_mine');
  assert.ok(mine, 'a smart mine should be on the board (their Warden stayed outside its range)');
  assert.deepEqual(mine.pos, [0, 0]);
  // Pawn B is still past the line, so you can pass after converting
  assert.equal(E.rapidRefusal(g, 0, PASS), null);
});

test('when an enemy scout walks within 3 hexes, the smart mine goes off and wrecks that scout', () => {
  let { game: g } = start();
  const me = ship(g, 'Pawn A');
  const ward = ship(g, 'Warden', 1);
  g = E.rapidTick(g, [{ type: 'move', ship: me.id, path: [2], convert: 'mine' }, { type: 'move', ship: ward.id, path: [5] }]);
  assert.ok(g.objs.find((o) => o.kind === 'smart_mine'));
  const foe = ship(g, 'Pawn A', 1);
  // dir 5: one hex south, from [0,-4] to [0,-3], gap 3 from the mine at [0,0]
  g = E.rapidTick(g, [PASS, { type: 'move', ship: foe.id, path: [5] }]);
  assert.ok(g.events.some((e) => e.t === 'blast' && e.kind === 'smart_mine'), 'the mine should go off');
  assert.ok(!g.objs.find((o) => o.kind === 'smart_mine'), 'the mine is spent');
  const got = g.ships.find((x) => x.id === foe.id);
  assert.ok(got.dead || got.segs.some((sg) => sg.wrecked), 'the scout that walked in should be wrecked');
});

test('against the computer, converting on tick 1 is enough: a walking scout sets the mine off and is wrecked', () => {
  for (const seed of [1, 2, 5, 9, 17, 42]) {
    let { game: g } = start({}, seed);
    const me = ship(g, 'Pawn A');
    const ai = E.rapidAI(g, 1);
    g = E.rapidTick(g, [{ type: 'move', ship: me.id, path: [2], convert: 'mine' }, ai]);
    assert.ok(g.events.some((e) => e.t === 'converted' && e.into === 'mine'), 'seed ' + seed + ': the scout should convert');
    assert.ok(g.events.some((e) => e.t === 'blast' && e.kind === 'smart_mine'), 'seed ' + seed + ': the mine should go off on the same tick (they walk in during the opening)');
    const wrecked = g.ships.filter((x) => x.owner === 1 && (x.dead || x.segs.some((sg) => sg.wrecked)));
    assert.ok(wrecked.some((x) => x.name.startsWith('Pawn')), 'seed ' + seed + ': an enemy scout should be wrecked, got ' + wrecked.map((x) => x.name));
  }
});

test('with stateMines switched off the same convert is a naval mine, not a smart mine: the experiment does not leak', () => {
  let { game: g } = start({ exp: {} });
  assert.equal(E.exp(g, 'stateMines'), false);
  const me = ship(g, 'Pawn A');
  assert.equal(E.mineKindFor(g, me), 'naval_mine');
  const ward = ship(g, 'Warden', 1);
  g = E.rapidTick(g, [{ type: 'move', ship: me.id, path: [2], convert: 'mine' }, { type: 'move', ship: ward.id, path: [5] }]);
  assert.ok(g.objs.find((o) => o.kind === 'naval_mine'), 'without the experiment it should be an ordinary naval mine');
  assert.ok(!g.objs.find((o) => o.kind === 'smart_mine'));
});
