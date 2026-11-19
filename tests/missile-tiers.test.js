// Missile tiers and core variants (20 Nov 2026): missile_basic (3 hits), missile_advanced (4 hits), and the
// existing missile, now labelled Nuke (wrecks the segment). Cores: core (1 HP), steel_core (3), carbon_core (6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { battle, shippedFiles } from './helpers.js';
import { buildRules, apply, isMissile, missileKinds } from '../engine/index.js';
import { explode, applyHits } from '../engine/damage.js';
import { makeObj } from '../engine/state.js';
import { computerMove } from '../engine/ai.js';

const { world } = shippedFiles();
const hull1 = (bays, mounts = []) => [{ at: [0, 0], bays, mounts }];

test('the world file has three missiles and three cores', () => {
  const m = world.munitions, p = world.bay_parts;
  assert.equal(m.missile.label, 'Nuke');
  assert.equal(m.missile.wrecks_segment, true);
  assert.equal(m.missile_basic.hits, 3); assert.equal(m.missile_basic.wrecks_segment, false);
  assert.equal(m.missile_advanced.hits, 4); assert.equal(m.missile_advanced.wrecks_segment, false);
  for (const k of ['missile_basic', 'missile_advanced']) for (const key of ['speed', 'fuel', 'turn_rate', 'seeker_range', 'blast_radius']) assert.equal(m[k][key], m.missile[key], k + '.' + key);
  assert.ok(m.missile_basic.cost < m.missile_advanced.cost && m.missile_advanced.cost < m.missile.cost);
  for (const [k, hp] of [['core', undefined], ['steel_core', 3], ['carbon_core', 6]]) { assert.equal(p[k].required, true); assert.equal(p[k].hp, hp); assert.equal(p[k].layer, 6); }
});

test('isMissile and missileKinds: strongest first, weakest first on request', () => {
  const { rules } = buildRules(world, { map: { board: { shape: 'hexagon', radius: 6 }, terrain: [] } }, {});
  assert.ok(isMissile(rules, 'missile') && isMissile(rules, 'missile_basic') && isMissile(rules, 'missile_advanced'));
  assert.ok(!isMissile(rules, 'seeker_drone') && !isMissile(rules, 'mine'));
  const load = { missile_basic: 1, missile: 2, missile_advanced: 1, seeker_drone: 1 };
  assert.deepEqual(missileKinds(rules, load), ['missile', 'missile_advanced', 'missile_basic']);
  assert.deepEqual(missileKinds(rules, load, true), ['missile_basic', 'missile_advanced', 'missile']);
  assert.deepEqual(missileKinds(rules, { missile_basic: 0, missile: 1 }), ['missile']);
});

test('exactly one core, of any type', () => {
  const side = (hull) => ({ ships: [{ name: 'S', flagship: true, hull }], deployment: [{ ship: 'S', at: [0, 4] }] });
  const check = (hull) => buildRules(world, { map: { board: { shape: 'hexagon', radius: 8 }, terrain: [] } }, { budget: 999, player_1: side(hull), player_2: side(hull1(['core', 'engine'])) }).problems.filter((p) => /core/.test(p));
  assert.deepEqual(check(hull1(['steel_core', 'engine'])), []);
  assert.deepEqual(check(hull1(['carbon_core', 'engine'])), []);
  assert.equal(check(hull1(['core', 'steel_core', 'engine'])).length, 1);
  assert.equal(check(hull1(['carbon_core', 'steel_core', 'engine'])).length, 1);
  assert.equal(check(hull1(['engine', 'sensor'])).length, 1);
});

test('a steel core takes 3 hits and a carbon core 6 before the ship is lost', () => {
  for (const [core, hp] of [['core', 1], ['steel_core', 3], ['carbon_core', 6]]) {
    const { game } = battle({ p1: [{ name: 'T', at: [0, 3], flagship: true, hull: [{ at: [0, 0], bays: [core, 'sensor'] }, { at: [1, 0], bays: ['engine', 'coupling', 'sensor'], mounts: ['laser'] }] }],
      p2: [{ name: 'X', at: [0, -5], flagship: true, hull: hull1(['core', 'engine']) }] });
    const s = game.ships.find((x) => x.owner === 0);
    assert.equal(s.segs[0].parts.find((p) => p.t === core).hp, hp);
    applyHits(game, s, 0, hp, 'test');        // the sensor, then all but the core's last hit point
    assert.equal(s.dead, false, core);
    applyHits(game, s, 0, 1, 'test');
    assert.equal(s.dead, true, core);
  }
});

test('basic and advanced missiles deal hits; the Nuke still wrecks the segment', () => {
  const run = (kind) => {
    const { game } = battle({ p1: [{ name: 'T', at: [0, 3], flagship: true, hull: [{ at: [0, 0], bays: ['carbon_core', 'engine', 'sensor'], mounts: ['armour', 'armour', 'laser'] }, { at: [1, 0], bays: ['engine', 'coupling', 'magazine'] }] }],
      p2: [{ name: 'X', at: [0, -5], flagship: true, hull: hull1(['core', 'engine']) }] });
    const s = game.ships.find((x) => x.owner === 0), o = makeObj(game, kind, 1, [0, 3], 0);
    game.objs.push(o);
    explode(game, o, { ship: s, seg: 0 });
    return s;
  };
  const b = run('missile_basic'), a = run('missile_advanced'), n = run('missile');
  assert.equal(b.segs[0].wrecked, false); assert.equal(a.segs[0].wrecked, false);
  // basic: 3 hits take 3 of the 4 armour points; advanced: 4 take both plates
  assert.equal(b.segs[0].parts.filter((p) => p.t === 'armour').reduce((x, p) => x + p.hp, 0), 1);
  assert.equal(a.segs[0].parts.filter((p) => p.t === 'armour').reduce((x, p) => x + p.hp, 0), 0);
  assert.equal(n.segs[0].wrecked, true);
  assert.equal(n.dead, true);   // the core was in that segment
});

test('the computer launches the new missiles too', () => {
  for (const kind of ['missile_basic', 'missile_advanced']) {
    const { game, problems } = battle({
      p1: [{ name: 'Big', at: [0, 4], flagship: true, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['armour'] }, { at: [1, 0], bays: ['engine', 'coupling', 'sensor'] }, { at: [-1, 0], bays: ['engine', 'coupling', 'sensor'] }] }],
      p2: [{ name: 'L', at: [0, 0], flagship: true, load: { [kind]: 2 }, hull: [{ at: [0, 0], bays: ['core', 'engine', 'magazine'], mounts: ['launcher'] }] }]
    });
    assert.deepEqual(problems.filter((p) => !/budget/.test(p)), []);
    let g = apply(game, { type: 'end' });   // player 1 passes
    let launched = null;
    for (let i = 0; i < 6 && g.phase === 'play' && g.order[g.turn] === 1; i++) {
      const a = computerMove(g, 1);
      if (a.type === 'launch') { launched = a; break; }
      g = apply(g, a);
    }
    assert.ok(launched, 'no launch with ' + kind);
    assert.equal(launched.kind, kind);
  }
});
