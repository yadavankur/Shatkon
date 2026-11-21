// Rapid mode (engine/rapid.js, rules/rapid/rapid_skirmish.yaml): one action a side per tick, resolved together.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readYaml, shippedFiles, battle, pod } from './helpers.js';
import * as E from '../engine/index.js';

const board = () => {
  const b = readYaml('rules/rapid/rapid_skirmish.yaml');
  const { rules, problems } = E.buildRules(shippedFiles().world, b, b);
  return { b, rules, problems };
};
const rapidGame = (opts = {}, seed = 5) => { const { b, rules } = board(); return E.rapidStart(E.rapidRules({ ...rules, rapid: b.rapid }, opts), seed); };
// a small fight on an empty radius-12 board, in rapid mode
function small(p1, p2, opts = {}) {
  const { rules } = battle({ radius: 12, p1, p2 });
  return E.rapidStart(E.rapidRules(rules, opts), 3);
}
const PASS = { type: 'pass' };
const two = (g) => E.forcedMoves(g, 1)[0] || PASS;   // player 2 just walks forward

test('the rapid board loads with no problems: 14 ships a side, nothing touching, player 2 turned round', () => {
  const { problems } = board();
  assert.deepEqual(problems, []);
  const g = rapidGame();
  assert.equal(g.ships.filter((s) => s.owner === 0).length, 14);
  assert.equal(g.ships.filter((s) => s.owner === 1).length, 14);
  const mine = g.ships.filter((s) => s.owner === 0);
  for (const a of mine) for (const b of mine) if (a !== b) assert.ok(E.gap(a, b) >= 2, a.name + ' touches ' + b.name);
  for (const s of mine) {
    const t = g.ships.find((x) => x.owner === 1 && x.name === s.name);
    assert.deepEqual(t.pos, [-s.pos[0] || 0, -s.pos[1] || 0]);
  }
  assert.equal(g.ships.filter((s) => s.flagship && s.segs.length === 7).length, 2);
});

test('rapid rules: missiles fly a third as far a tick but three times as long; one point, no bank', () => {
  const g = rapidGame();
  assert.equal(g.rules.munitions.missile.speed, 2);
  assert.equal(g.rules.munitions.missile.fuel, 9);
  assert.equal(g.rules.cp.perTurn, 1);
  assert.equal(g.rules.cp.bankCap, 0);
  assert.equal(g.rules.turnLimit, E.RAPID_DEFAULTS.cap);
  assert.deepEqual(E.forwardDirs(g, 0), [1, 2]);    // north-east, north-west for the south side
  assert.deepEqual(E.forwardDirs(g, 1), [4, 5]);
});

test('forward only: before crossing, a ship cannot step back or sideways and the side cannot pass', () => {
  const g = rapidGame();
  const pawn = g.ships.find((s) => s.owner === 0 && s.name === 'Pawn A');
  assert.match(E.rapidRefusal(g, 0, { type: 'move', ship: pawn.id, path: [5] }), /forward only/);
  assert.match(E.rapidRefusal(g, 0, { type: 'move', ship: pawn.id, path: [0] }), /forward only/);
  assert.equal(E.rapidRefusal(g, 0, { type: 'move', ship: pawn.id, path: [2] }), null);
  assert.match(E.rapidRefusal(g, 0, PASS), /must act/);
  // the screen's move markers agree
  const dirs = E.legalMoves(g, 0).filter((a) => a.ship === pawn.id).map((a) => a.path[0]).sort();
  assert.deepEqual(dirs, [1, 2]);
  // a time-out never picks the flagship while an escort can go
  assert.ok(E.forcedMoves(g, 0).every((a) => !g.ships.find((s) => s.id === a.ship).flagship));
});

test('crossing the line frees the side: any direction, passing and scanning (while holding, by default)', () => {
  const scoutHull = [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser'] }];
  let g = small([pod('Flag', [0, 12], ['core', 'engine'], ['laser'], { hull: scoutHull }), { name: 'Run', at: [3, 1], hull: scoutHull }],
    [pod('Flag2', [0, -12], ['core', 'engine'], ['laser'], { hull: scoutHull })], { line: 12 });
  const run = g.ships.find((s) => s.name === 'Run');
  assert.equal(E.unlocked(g, 0), false);
  assert.match(E.rapidRefusal(g, 0, { type: 'scan', ship: run.id }), /past the line/);
  g = E.rapidTick(g, [{ type: 'move', ship: run.id, path: [2] }, two(g)]);   // [3,1] -> [3,0]: on the centre row
  const r2 = g.ships.find((s) => s.name === 'Run');
  assert.deepEqual(r2.pos, [3, 0]);
  assert.equal(E.pastLine(g, r2), true);
  assert.equal(E.unlocked(g, 0), true);
  assert.equal(E.rapidRefusal(g, 0, PASS), null);
  assert.equal(E.rapidRefusal(g, 0, { type: 'scan', ship: r2.id }), null);
  const flag = g.ships.find((s) => s.name === 'Flag');
  assert.match(E.rapidRefusal(g, 0, { type: 'scan', ship: flag.id }), /past the line/);   // only ships past it scan
  assert.equal(E.rapidRefusal(g, 0, { type: 'move', ship: r2.id, path: [5] }), null);     // back is fine now
  // holding: step back behind the line and the side is locked again
  g = E.rapidTick(g, [{ type: 'move', ship: r2.id, path: [5] }, two(g)]);
  assert.equal(E.unlocked(g, 0), false);
  // permanent: once crossed, free for good
  let p = small([pod('Flag', [0, 12], ['core', 'engine'], ['laser'], { hull: scoutHull }), { name: 'Run', at: [3, 1], hull: scoutHull }],
    [pod('Flag2', [0, -12], ['core', 'engine'], ['laser'], { hull: scoutHull })], { unlock: 'permanent' });
  const pr = p.ships.find((s) => s.name === 'Run');
  p = E.rapidTick(p, [{ type: 'move', ship: pr.id, path: [2] }, two(p)]);
  p = E.rapidTick(p, [{ type: 'move', ship: pr.id, path: [5] }, two(p)]);
  assert.equal(E.unlocked(p, 0), true);
});

test('both sides act at once: two ships that shoot each other in the same tick are both hit', () => {
  const frail = (name, at) => ({ name, at, flagship: true, hull: [{ at: [0, 0], bays: ['core', 'engine'], mounts: ['laser'] }] });
  let g = small([frail('A', [0, 2])], [frail('B', [0, -1])], { scan: 'always' });
  const a = g.ships.find((s) => s.owner === 0), b = g.ships.find((s) => s.owner === 1);
  // they see each other at 3 hexes
  const fa = E.autoFire(g, 0, a.id), fb = E.autoFire(g, 1, b.id);
  assert.ok(fa && fb, 'both have a shot');
  g = E.rapidTick(g, [fa, fb]);
  const dmg = g.events.filter((e) => e.t === 'damage').map((e) => e.ship).sort();
  assert.deepEqual(dmg, [a.id, b.id]);
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 'draw');   // both flagships fell in the same tick
});

test('sighted launches need a lock on a ship the fleet can see; blind launches go anywhere', () => {
  const g = rapidGame();
  const flag = g.ships.find((s) => s.owner === 0 && s.flagship);
  const blindShot = E.aimLaunch(g, flag.id, 'missile', [0, -10]);
  assert.ok(blindShot);
  assert.match(E.rapidRefusal(g, 0, blindShot), /sighted launches only/);
  const g2 = rapidGame({ launch: 'blind' });
  const f2 = g2.ships.find((s) => s.owner === 0 && s.flagship);
  assert.equal(E.rapidRefusal(g2, 0, E.aimLaunch(g2, f2.id, 'missile', [0, -10])), null);
});

test('the computer plays a whole rapid game without an illegal action', () => {
  let g = rapidGame({ cap: 80 }, 11);
  let seed = 9;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let fights = 0;
  while (g.phase === 'play') {
    const a0 = E.rapidAI(g, 0, 'normal', rnd), a1 = E.rapidAI(g, 1, 'easy', rnd);
    assert.equal(E.rapidRefusal(g, 0, a0), null, JSON.stringify(a0));
    assert.equal(E.rapidRefusal(g, 1, a1), null, JSON.stringify(a1));
    g = E.rapidTick(g, [a0, a1]);
    if (g.events.some((e) => e.t === 'damage')) fights++;
  }
  assert.ok(g.round > 10);
  assert.ok(fights > 0, 'the fleets met');
  assert.ok(g.rapid.ticks.length >= 10);
  // the battle log lists ticks without trying to replay them
  const log = E.battleLog(g, { seat: 'cpu' });
  assert.match(log.note, /Rapid mode/);
  assert.ok(log.turns.length >= 2);
});
