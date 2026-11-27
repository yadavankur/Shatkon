// The hunter computer (engine/ai-muse.js): it plays only legal actions, only on what
// it can see, deterministically — and it really does hunt differently from the
// stock computer.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../engine/index.js';
import { computerMove } from '../engine/ai.js';
import { museMove, museHomePoint } from '../engine/ai-muse.js';
import { battle, readYaml } from './helpers.js';
import { loadBoard } from '../tools/boards.mjs';
import { loadRules, playGame, policy } from '../tools/sim.mjs';

// A small battle with home zones, so the hunter has an enemy home to hunt for.
function zonedBattle({ p1, p2, radius = 10, seed = 7 }) {
  const w = readYaml('rules/world_v0.4.yaml');
  w.turns = { ...(w.turns || {}), first: 'player_1' };   // player 1 moves first
  const side = (ships) => ({ ships: ships.map((s) => ({ name: s.name, flagship: !!s.flagship, hull: s.hull, load: s.load })), deployment: ships.map((s) => ({ ship: s.name, at: s.at })) });
  const built = E.buildRules(w, { map: { board: { shape: 'hexagon', radius }, zones: { player_1_home: { edge: 'south', depth: 3 }, player_2_home: { edge: 'north', depth: 3 } }, terrain: [] } }, { budget: 99999, player_1: side(p1), player_2: side(p2) });
  assert.deepEqual(built.problems, []);
  return E.start(built.rules, seed);
}

// A small battle on the engine, like tests/ai.test.js.
const gunboat = (name, at, more = {}) => ({ name, at, flagship: true, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser', 'armour'] }], ...more });
// The shipped world file with one number changed (helpers' battle() takes no tweak).
const worldWith = (fn) => {
  const w = readYaml('rules/world_v0.4.yaml');
  w.turns = { ...(w.turns || {}), first: 'player_1' };
  fn(w);
  return w;
};
const endTurn = (g) => E.apply(g, { type: 'end' });
const muse = (g, seat) => computerMove(g, seat, 'normal', { personality: 'muse' });

// Play one side's turn with Muse, asserting every action the engine accepts.
function museTurn(g, seat) {
  for (let i = 0; i < 60 && g.phase === 'play' && g.order[g.turn] === seat; i++) {
    const a = museMove(g, seat, 'normal');
    assert.ok(a, 'museMove returned nothing on its own turn');
    const r = E.attempt(g, a);
    assert.ok(r.ok, 'museMove returned an illegal action: ' + a.type + ' (' + (r.why || 'no reason') + ')');
    g = r.state;
    if (a.type === 'end') break;
  }
  return g;
}
function playOut(g, a, b) {
  let guard = 0;
  while (g.phase === 'play' && guard++ < 400) {
    const seat = g.order[g.turn];
    g = seat === 0 ? a(g, 0) : b(g, 1);
  }
  return g;
}

test('museMove is exported from the engine front door, and is not a world-file personality', () => {
  assert.equal(typeof E.museMove, 'function');
  const rules = loadRules();
  assert.equal(rules.ai.personalities.muse, undefined, 'muse is not in ai.personalities: the random pool is unchanged');
  const g = E.start(rules, 3);
  assert.deepEqual(computerMove(g, 0, 'normal', { personality: 'muse' }), museMove(g, 0, 'normal'), 'opts.personality muse dispatches');
});

test('Muse plays only legal actions across full games, on several boards', () => {
  for (const name of ['01_first_light', '02_minefield', '09_fog_bank']) {
    const { rules, problems } = loadBoard(name);
    assert.deepEqual(problems, []);
    for (const seed of [1, 7]) {
      let g = E.start(rules, seed);
      g = playOut(g, museTurn, (s, seat) => { // the other seat plays the stock computer
        for (let i = 0; i < 60 && s.phase === 'play' && s.order[s.turn] === seat; i++) {
          const a = computerMove(s, seat, 'normal') || { type: 'end' };
          const r = E.attempt(s, a);
          s = r.ok ? r.state : E.apply(s, { type: 'end' });
          if (a.type === 'end') break;
        }
        return s;
      });
      assert.equal(g.phase, 'over', name + ' seed ' + seed + ' did not finish');
      assert.notEqual(g.winner, undefined);
    }
  }
});

test('Muse finishes its games: no stalling to the round limit against a fleet that never moves', () => {
  const rules = loadRules();
  for (const seed of [1, 7920]) {
    const r = playGame(rules, policy('muse'), policy('sit'), seed);
    assert.notEqual(r.by, 'turn_limit', 'muse stalled against a sitter, seed ' + seed);
    assert.ok(r.stats[0].idleTurns <= 1, 'muse sat out ' + r.stats[0].idleTurns + ' turns');
  }
});

test('Muse is deterministic: the same game, twice, plays the same actions', () => {
  const rules = loadRules();
  const once = () => {
    const acts = [];
    let g = E.start(rules, 5);
    for (let guard = 0; guard < 20000 && g.phase === 'play'; guard++) {
      const seat = g.order[g.turn];
      const a = (seat === 0 ? muse : (s, t) => computerMove(s, t, 'normal', { personality: 'balanced' }))(g, seat) || { type: 'end' };
      const r = E.attempt(g, a);
      acts.push(E.actionText(a));
      g = r.ok ? r.state : E.apply(g, { type: 'end' });
    }
    return { acts, hash: E.hashState(g) };
  };
  const a = once(), b = once();
  assert.deepEqual(b.acts, a.acts, 'same seed, different action list');
  assert.equal(b.hash, a.hash, 'same seed, different final position');
});

test('Muse does not act on a ship it cannot see', () => {
  // The enemy flagship sits at home, 16 hexes away and out of sight, in one of two
  // places. What Muse can see is identical either way (checked below), so its
  // decisions must be identical too — if it read the hidden position, they would differ.
  const mk = (at) => {
    const w = battle({ radius: 10, p1: [gunboat('A', [0, 8])], p2: [gunboat('B', at)] });
    return w.game;
  };
  const g1 = mk([0, -8]), g2 = mk([5, -6]);
  assert.equal(E.view(g1, 0).ships.filter((s) => !s.mine).length, 0, 'premise: nothing in sight');
  assert.equal(E.knowledge(g1, 0), E.knowledge(g2, 0), 'premise: what Muse knows is identical in both games');
  const firstTurn = (g) => {
    const acts = [];
    for (let i = 0; i < 60 && g.phase === 'play' && g.order[g.turn] === 0; i++) {
      const a = museMove(g, 0, 'normal');
      acts.push(E.actionText(a));
      g = E.apply(g, a);
      if (a.type === 'end') break;
    }
    return acts;
  };
  assert.deepEqual(firstTurn(g2), firstTurn(g1), 'Muse played differently for a hidden ship in a different place');
  // ...and in neither game does it shoot at something it cannot see
  for (const g of [g1, g2]) {
    let s = g;
    for (let i = 0; i < 60 && s.phase === 'play' && s.order[s.turn] === 0; i++) {
      const a = museMove(s, 0, 'normal');
      assert.notEqual(a.type, 'fire', 'fired with nothing in sight');
      assert.notEqual(a.type, 'launch', 'launched with nothing locked');
      s = E.apply(s, a);
      if (a.type === 'end') break;
    }
  }
});

test('Muse fires at the biggest ship it can see — the quarry — not the nearest', () => {
  const big = { name: 'Big', at: [0, -1], flagship: true, hull: [
    { at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser'] },
    { at: [1, 0], bays: ['coupling', 'engine'], mounts: ['armour'] },
    { at: [-1, 0], bays: ['coupling', 'engine'], mounts: ['armour'] },
    { at: [0, -1], bays: ['coupling', 'engine'], mounts: [] }] };
  const small = { name: 'Small', at: [3, 0], hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['armour'] }] };
  // Muse is player 1; both enemy ships are in sight from the start. Attack run off,
  // so the first action is the shot itself, not the step before it.
  let g = battle({ p1: [gunboat('A', [0, 3])], p2: [big, small], world: worldWith((w) => { w.detection.attack_run_bonus = 0; }) }).game;
  assert.equal(E.view(g, 0).ships.filter((s) => !s.mine).length, 2, 'premise: both enemy ships in sight');
  const a = museMove(g, 0, 'normal');
  assert.equal(a.type, 'fire', 'must shoot, not move: both targets are in range');
  const tgt = E.beamTargets(g, '1a').find((t) => t.seg === a.seg && t.part === a.part && t.at[0] === a.at[0] && t.at[1] === a.at[1]);
  assert.equal(tgt.target, '2a', 'fired at the small ship instead of the big one');
  // ...and with the attack run on, it steps first, then fires at the same ship
  let g2 = battle({ p1: [gunboat('A', [0, 3])], p2: [big, small] }).game;
  const first = museMove(g2, 0, 'normal');
  assert.equal(first.type, 'move', 'steps first for the attack-run hit');
  g2 = E.apply(g2, first);
  const second = museMove(g2, 0, 'normal');
  assert.equal(second.type, 'fire');
  const tgt2 = E.beamTargets(g2, '1a').find((t) => t.seg === second.seg && t.part === second.part && t.at[0] === second.at[0] && t.at[1] === second.at[1]);
  assert.equal(tgt2.target, '2a', 'after the step it still shoots the big ship');
});

test('Muse closes on a quarry it can see but cannot yet shoot', () => {
  // a long-sighted hunter (two sensors: sensor 6) and a seven-segment flagship
  // (signature 7) eleven hexes off: in sight (6 + 7), past the 9-hex laser even
  // from its nearest segment, so there is no shot yet and the only honest action
  // is to close.
  const far = { name: 'Far', at: [0, -8], flagship: true, hull: [
    { at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser'] },
    { at: [1, 0], bays: ['coupling', 'engine'], mounts: ['armour'] },
    { at: [-1, 0], bays: ['coupling', 'engine'], mounts: ['armour'] },
    { at: [0, -1], bays: ['coupling', 'engine'], mounts: ['armour'] },
    { at: [0, 1], bays: ['coupling', 'engine'], mounts: ['armour'] },
    { at: [1, -1], bays: ['coupling', 'engine'], mounts: [] },
    { at: [-1, 1], bays: ['coupling', 'engine'], mounts: [] }] };
  const hunter = { name: 'H', at: [0, 3], flagship: true, hull: [
    { at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser', 'armour'] },
    { at: [1, 0], bays: ['coupling', 'engine', 'sensor'], mounts: [] }] };
  let g = battle({ p1: [hunter], p2: [far] }).game;
  const v = E.view(g, 0);
  assert.equal(v.ships.filter((s) => !s.mine).length, 1, 'premise: the quarry is in sight');
  assert.equal(E.beamTargets(g, '1a').length, 0, 'premise: no shot from 11 hexes');
  const before = E.hex.dist([0, 3], [0, -8]);
  const a = museMove(g, 0, 'normal');
  assert.equal(a.type, 'move', 'must close, not shoot from 11 hexes');
  const dest = a.path.reduce((c, d) => E.hex.step(c, d), [0, 3]);
  assert.ok(E.hex.dist(dest, [0, -8]) < before, 'the move went the wrong way: ' + JSON.stringify(dest));
});

test('Muse hunts for the enemy home when it has nothing in sight', () => {
  let g = zonedBattle({ p1: [gunboat('A', [0, 8])], p2: [gunboat('B', [0, -8])], seed: 11 });
  const v = E.view(g, 0);
  assert.equal(v.ships.filter((s) => !s.mine).length, 0, 'premise: nothing in sight on turn 1');
  const home = museHomePoint(v, 0, g.rules);
  assert.ok(home, 'no home point found');
  const a = museMove(g, 0, 'normal');
  assert.equal(a.type, 'move', 'first action with nothing in sight should be a move');
  const dest = a.path.reduce((c, d) => E.hex.step(c, d), v.ships.find((s) => s.id === a.ship).pos);
  const start = v.ships.find((s) => s.id === a.ship).pos;
  assert.ok(E.hex.dist(dest, home) < E.hex.dist(start, home), 'the move did not head for the enemy home');
});

test('Muse on easy still plays legal, deterministic actions', () => {
  const { rules } = loadBoard('01_first_light');
  const run = () => {
    let g = E.start(rules, 4), acts = [];
    for (let guard = 0; guard < 20000 && g.phase === 'play'; guard++) {
      const seat = g.order[g.turn];
      const a = seat === 0 ? museMove(g, 0, 'easy') : computerMove(g, 1, 'normal', { personality: 'balanced' });
      const r = E.attempt(g, a || { type: 'end' });
      assert.ok(r.ok, 'easy muse returned an illegal action');
      acts.push(E.actionText(a || { type: 'end' }));
      g = r.state;
    }
    return { acts, hash: E.hashState(g), over: g.phase };
  };
  const a = run(), b = run();
  assert.deepEqual(b.acts, a.acts, 'easy muse is not deterministic');
  assert.equal(a.over, 'over', 'easy game did not finish');
});

test('Muse returns null when it is not its turn', () => {
  const g = E.start(loadBoard('01_first_light').rules, 2);
  const toMove = g.order[g.turn], other = 1 - toMove;
  assert.equal(museMove(g, other, 'normal'), null, 'seat ' + other + ' is not to move');
  assert.notEqual(museMove(g, toMove, 'normal'), null, 'seat ' + toMove + ' is to move and got nothing');
});

// Regression: The Dogleg is a bent canyon through solid rock. Muse used to score
// a move by straight-line distance to the quarry, so every hex round a bend looked
// further away than staying put — it parked its flagship at the mouth of the canyon
// and waited, and all 20 games against the stock computer drew to the round limit.
// The fix scores a move by the path round the rocks (BFS over centres where the
// whole ship fits). This test plays the board both seats and asserts the games end.
test('Muse does not stall in a canyon: The Dogleg finishes', () => {
  const play = (rules, seed, museSeat) => {
    let g = E.start(rules, seed), guard = 0;
    while (g.phase === 'play' && guard++ < 400) {
      const seat = g.order[g.turn];
      for (let i = 0; i < 60 && g.phase === 'play' && g.order[g.turn] === seat; i++) {
        const a = (seat === museSeat ? museMove : (x, s) => computerMove(x, s, 'normal'))(g, seat, 'normal') || { type: 'end' };
        const r = E.attempt(g, a);
        assert.ok(r.ok, 'illegal action on The Dogleg: ' + JSON.stringify(a));
        g = r.state;
        if (a.type === 'end') break;
      }
    }
    return g;
  };
  for (const seed of [1, 2]) {
    for (const [rules, museSeat] of [[loadBoard('04_the_dogleg').rules, 0], [loadBoard('04_the_dogleg', { swap: true }).rules, 1]]) {
      const g = play(rules, seed, museSeat);
      assert.equal(g.phase, 'over', 'The Dogleg did not finish (seed ' + seed + ', muse seat ' + (museSeat + 1) + ')');
      assert.notEqual(g.winner, 'draw', 'The Dogleg drew to the round limit (seed ' + seed + ', muse seat ' + (museSeat + 1) + ')');
    }
  }
});
