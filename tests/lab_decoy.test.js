// Decoy practice board (rules/rapid/lab_decoy.yaml): one tiny Experiments set-up, decoy already on.
// Loaded the same way as the Lab board (buildRules + rapidRules + rapidStart).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readYaml, shippedFiles } from './helpers.js';
import * as E from '../engine/index.js';
import { EXP_KEYS } from '../engine/experiments.js';

const FILE = 'rules/rapid/lab_decoy.yaml';
function start(opts = {}, seed = 5) {
  const b = readYaml(FILE);
  const { rules, problems } = E.buildRules(shippedFiles().world, b, b);
  return { b, problems, game: E.rapidStart(E.rapidRules({ ...rules, rapid: b.rapid }, { ...b.rapid, ...opts }), seed) };
}
const ship = (g, name, p = 0) => g.ships.find((x) => x.owner === p && x.name === name);
const PASS = { type: 'pass' };
const MID = [0, 0];

test('the Decoy practice board loads through the same board builder as the Lab, with no problems', () => {
  const { b, problems, game } = start();
  assert.deepEqual(problems, []);
  assert.equal(b.board.name, 'Decoy');
  assert.match(b.board.try, /tap Decoy/i);
  assert.match(b.board.idea, /missile/i);
  assert.equal(game.rules.board.radius, 7);
  assert.equal(game.rules.rapid.experiments, 'on');
  assert.equal(game.rules.rapid.line, 4);
});

test('only the decoy experiment is on', () => {
  const { game } = start();
  assert.equal(E.exp(game, 'decoy'), true);
  for (const k of EXP_KEYS) if (k !== 'decoy') assert.equal(E.exp(game, k), false, k + ' should be off');
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
  for (const x of game.ships.filter((s) => s.owner === 0)) assert.ok(x.pos[1] >= 1, x.name + ' should be in the south half');
  for (const x of game.ships.filter((s) => s.owner === 1)) assert.ok(x.pos[1] <= -1, x.name + ' should be in the north half');
  for (const p of [0, 1]) for (const x of game.ships.filter((s) => s.owner === p)) {
    assert.equal(E.view(game, p).ships.find((s) => s.id === x.id).scanR === null, false, 'rapid ships always have scan radii');
  }
});

test('both Wardens start just past the line; the scouts have not crossed yet; the centre hex is a legal decoy spot', () => {
  const { game } = start();
  assert.equal(E.pastLine(game, ship(game, 'Warden')), true);
  assert.equal(E.pastLine(game, ship(game, 'Warden', 1)), true);
  assert.equal(E.pastLine(game, ship(game, 'Pawn A')), false);
  assert.equal(E.pastLine(game, ship(game, 'Pawn B')), false);
  const me = ship(game, 'Warden');
  const spots = E.decoySpots(game, 0, me.id);
  assert.ok(spots.some((c) => c[0] === 0 && c[1] === 0), 'the empty centre hex should be a legal decoy spot');
  const a = { type: 'decoy', ship: me.id, at: MID };
  assert.equal(E.rapidRefusal(game, 0, a), null);
});

test('placing a decoy at the centre, then a missile at your Warden: the missile turns onto it and both are gone', () => {
  let { game: g } = start();
  const me = ship(g, 'Warden'), foe = ship(g, 'Warden', 1);
  g = E.rapidTick(g, [{ type: 'decoy', ship: me.id, at: MID }, PASS]);
  const d = g.objs.find((o) => o.kind === 'decoy');
  assert.ok(d, 'the decoy should be on the board');
  assert.deepEqual(d.pos, MID);
  // the enemy sees a ship-sized "?" contact, not a decoy
  const v = E.view(g, 1);
  assert.ok(!v.objs.some((o) => o.kind === 'decoy'));
  assert.ok(v.contacts.some((c) => c.kind === 'ship' && c.at[0] === 0 && c.at[1] === 0));
  const launch = E.autoLaunch(g, 1, foe.id, null, 'best');
  assert.equal(launch && launch.type, 'launch');
  assert.equal(E.rapidRefusal(g, 1, launch), null);
  g = E.rapidTick(g, [PASS, launch]);
  assert.ok(g.events.some((e) => e.t === 'lured'), 'the missile should turn onto the decoy');
  assert.ok(g.events.some((e) => e.t === 'decoy_hit'), 'the missile should go off on the decoy');
  assert.ok(!g.objs.find((o) => o.kind === 'decoy'), 'the decoy is gone');
  assert.ok(!g.objs.some((o) => String(o.kind).includes('missile')), 'the missile is gone');
});

test('against the computer, a decoy at the centre is enough: they launch, the missile is lured, both are gone', () => {
  for (const keen of ['never', 'sometimes', 'eager']) {
    for (const seed of [1, 5, 17, 42]) {
      let { game: g } = start({ cpuExp: { decoy: keen } }, seed);
      const me = ship(g, 'Warden');
      const ai = E.rapidAI(g, 1);
      assert.equal(ai.type, 'launch', 'seed ' + seed + ' keen ' + keen + ': the computer should launch, got ' + E.tickText(ai));
      g = E.rapidTick(g, [{ type: 'decoy', ship: me.id, at: MID }, ai]);
      assert.ok(g.events.some((e) => e.t === 'decoy'), 'seed ' + seed + ': a decoy should be placed');
      assert.ok(g.events.some((e) => e.t === 'lured'), 'seed ' + seed + ' keen ' + keen + ': the missile should turn onto the decoy');
      assert.ok(g.events.some((e) => e.t === 'decoy_hit'), 'seed ' + seed + ' keen ' + keen + ': the missile should go off on the decoy');
    }
  }
});

test('with decoy switched off the same action is refused: the experiment does not leak', () => {
  const { game } = start({ exp: {} });
  assert.equal(E.exp(game, 'decoy'), false);
  const me = ship(game, 'Warden');
  assert.match(E.rapidRefusal(game, 0, { type: 'decoy', ship: me.id, at: MID }), /off/);
});
