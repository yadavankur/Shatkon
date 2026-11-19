// EXPERIMENTAL Strength check (lab-strength.html): the shot counts come from the engine's own damage code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { shippedFiles } from './helpers.js';
import { strengthTable, strengthGame, strengthWorld, fire, nextRound, segState } from '../ui/strength-model.js';

const { world } = shippedFiles();
const one = (bays, mounts) => ({ hull: [{ at: [0, 0], bays, mounts }] });
const row = (t, id) => t.rows.find((r) => r.id === id);

test('strength lab leaves the shipped world alone', () => {
  const before = JSON.stringify(world);
  const w = strengthWorld(world, { core: 'carbon' });
  assert.equal(w.bay_parts.core.hp, 6);
  assert.equal(w.munitions.test_missile_nuke.hits, 7);
  assert.equal(JSON.stringify(world), before);
  assert.equal(world.bay_parts.core.hp, undefined);
});

test('a bare one-hex boat: lasers by range, missiles by core strength', () => {
  const boat = one(['core', 'sensor', 'magazine'], ['laser']);   // 3 parts of 1 hp before the core
  const basic = strengthTable(world, boat, 0, { core: 'basic', coreOnly: true });
  assert.equal(basic.core, true);
  assert.equal(row(basic, 'near').finish.text, '2');   // 3 hits strip it, the 4th kills the 1-hp core
  assert.equal(row(basic, 'far').finish.text, '4');
  assert.equal(row(basic, 'basic').finish.text, '2');
  assert.equal(row(basic, 'nuke').finish.text, '1');
  const carbon = strengthTable(world, boat, 0, { core: 'carbon', coreOnly: true });
  assert.equal(row(carbon, 'near').finish.text, '3');  // 3 + 6 = 9 hp
  assert.equal(row(carbon, 'far').finish.text, '9');
  assert.equal(row(carbon, 'nuke').finish.text, '2');
  // today's rule: one missile wrecks the segment whatever the core
  const today = strengthTable(world, boat, 0, { core: 'carbon', todayRule: true });
  assert.equal(row(today, 'basic').finish.text, '1');
});

test('shield soaks a hit, point defence eats the first missile of a round, next round reloads', () => {
  const des = one(['core', 'sensor', 'magazine'], ['shield', 'point_defence', 'laser']);
  const sim = strengthGame(world, des, { core: 'steel', coreOnly: true });
  const ev = fire(sim, 0, { kind: 'missile', id: 'basic' }).events;
  assert.ok(ev.some((e) => e.t === 'stopped'));
  assert.equal(sim.ship.segs[0].parts.find((p) => p.t === 'shield').hp, 1);
  fire(sim, 0, { kind: 'missile', id: 'basic' });       // gets through: the shield takes the first of 3 hits
  assert.equal(sim.ship.segs[0].parts.find((p) => p.t === 'shield').hp, 0);
  assert.equal(segState(sim, 0).shipLost, false);
  nextRound(sim);                                         // hit this round: the shield stays down, PD reloads
  assert.equal(sim.ship.pd, 0);
  assert.equal(sim.ship.segs[0].parts.find((p) => p.t === 'shield').hp, 0);
  nextRound(sim);
  assert.equal(sim.ship.segs[0].parts.find((p) => p.t === 'shield').hp, 1);
});
