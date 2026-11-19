// Battle settings, the friendly-fire warning, the random Lab map and the battle report (20 Nov 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRules, start, apply, attempt, beamStop, hex } from '../engine/index.js';
import { computerMove } from '../engine/ai.js';
import { battle, scout, shippedFiles } from './helpers.js';
import { randomMap, RANDOM_RADIUS } from '../ui/randommap.js';
import { battleStats } from '../ui/postgame.js';

const laser = (g, id) => g.ships.find((s) => s.id === id).segs[0].parts.findIndex((p) => p.t === 'laser');

test('beamStop: says what a shot would stop on, and the shot really does stop there', () => {
  let { game: g } = battle({ p1: [scout('a', [0, 2])], p2: [scout('b', [0, -2])] });
  const shot = { type: 'fire', ship: '1a', seg: 0, part: laser(g, '1a'), at: [0, -2] };
  assert.equal(beamStop(g, shot).ship, '2a');
  g.objs.push({ id: 'x1', kind: 'mine', owner: 0, pos: [0, 0] });
  const st = beamStop(g, shot);
  assert.equal(st.obj, 'x1'); assert.equal(st.owner, 0); assert.deepEqual(st.at, [0, 0]);
  assert.deepEqual(st.path[0], [0, 2]); assert.deepEqual(st.path.at(-1), [0, 0]);
  const hull0 = g.ships.find((s) => s.id === '2a').segs.map((s) => s.hp);
  g = apply(g, shot);
  assert.ok(!g.objs.some((o) => o.id === 'x1'), 'the mine took the shot');
  assert.deepEqual(g.ships.find((s) => s.id === '2a').segs.map((s) => s.hp), hull0, 'the target was not hurt');
});

test('turn order: fixed keeps the same side first every round, alternate swaps', () => {
  const f = shippedFiles(), base = buildRules(f.world, f.map, f.fleets).rules;
  for (const [fp, swaps] of [['fixed', false], ['alternate', true]]) {
    let g = start({ ...base, firstPlayer: fp }, 11);
    const first = g.order[0];
    g = apply(g, { type: 'end' }); g = apply(g, { type: 'end' });
    assert.equal(g.round, 2);
    assert.equal(g.order[0] !== first, swaps, fp);
  }
});

test('random Lab map: radius 10, same seed same map, terrain mirrored through the centre, fleets fit', () => {
  const f = shippedFiles();
  for (const seed of [1, 42, 1234, 9999]) {
    const a = randomMap(f.map, seed), b = randomMap(f.map, seed);
    assert.deepEqual(a, b);
    assert.equal(a.map.board.radius, RANDOM_RADIUS);
    const key = (t) => t.type + ':' + t.at.join(',');
    const keys = new Set(a.map.terrain.map(key));
    for (const t of a.map.terrain) assert.ok(keys.has(t.type + ':' + (-t.at[0] || 0) + ',' + (-t.at[1] || 0)), 'mirror of ' + key(t));
    for (const t of a.map.terrain) assert.ok(hex.dist(t.at, [0, 0]) <= RANDOM_RADIUS - 1);
    const r = buildRules(f.world, a, f.fleets);
    // (the shipped fleets' fixed spots are for radius 8; the Lab places ships in the home zones itself)
    assert.deepEqual(r.problems.filter((p) => !/budget|outside|too far/.test(p)), [], 'seed ' + seed);
  }
  assert.notDeepEqual(randomMap(f.map, 1).map.terrain, randomMap(f.map, 2).map.terrain);
});

test('battle report: numbers add up for a whole computer-vs-computer game', () => {
  const f = shippedFiles(), rules = buildRules(f.world, f.map, f.fleets).rules;
  let g = start({ ...rules, firstPlayer: 'fixed' }, 5), steps = 0;
  for (let n = 0; g.phase === 'play' && n < 500; n++) {
    let a = steps++ > 30 ? { type: 'end' } : computerMove(g, g.order[g.turn], 'normal') || { type: 'end' };
    if (!attempt(g, a).ok) a = { type: 'end' };
    if (a.type === 'end') steps = 0;
    g = apply(g, a);
  }
  const st = battleStats(g, { seat: null });
  assert.equal(st.sides.length, 2);
  for (const s of st.sides) {
    assert.ok(s.hits <= s.shots);
    assert.equal(s.bands.reduce((n, b) => n + b[0], 0), s.shots);
    assert.equal(s.bands.reduce((n, b) => n + b[2], 0), s.blocked);
    assert.ok(s.bands.reduce((n, b) => n + b[1], 0) >= s.hits);
    assert.ok(s.hull >= 0 && s.hull <= 100);
    const m = s.missiles; assert.equal(m.hit + m.stopped + m.wasted + m.flying, m.fired);
  }
  for (let i = 1; i < st.items.length; i++) assert.ok(st.items[i].round >= st.items[i - 1].round);
  assert.ok(st.sides[0].shots + st.sides[1].shots > 0, 'some shots were fired');
});
