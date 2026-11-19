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
  assert.equal(w.munitions.test_missile_nuke.wrecks_segment, true);
  assert.equal(w.munitions.test_missile_advanced.hits, 4);
  assert.equal(w.munitions.test_missile_advanced.wrecks_segment, false);
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
  assert.equal(row(carbon, 'advanced').finish.text, '3');   // 4 + 4 + 4 hits for 9 hp
  assert.equal(row(carbon, 'nuke').finish.text, '1');       // the nuke wrecks the segment whatever the core
  assert.match(row(carbon, 'nuke').result, /core destroyed/);
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
  // a nuke against a working shield: no wreck, the shield goes down and the segment takes 3 hits
  const sim2 = strengthGame(world, des, { core: 'steel', coreOnly: true });
  sim2.ship.pd = 1;                                       // point defence already used this round
  fire(sim2, 0, { kind: 'missile', id: 'nuke' });
  assert.equal(sim2.ship.segs[0].wrecked, false);
  assert.equal(sim2.ship.segs[0].parts.find((p) => p.t === 'shield').hp, 0);
  fire(sim2, 0, { kind: 'missile', id: 'nuke' });         // shield down: the next one wrecks it, core and all
  assert.equal(sim2.ship.segs[0].wrecked, true);
  assert.equal(sim2.ship.dead, true);
  nextRound(sim);                                         // hit this round: the shield stays down, PD reloads
  assert.equal(sim.ship.pd, 0);
  assert.equal(sim.ship.segs[0].parts.find((p) => p.t === 'shield').hp, 0);
  nextRound(sim);
  assert.equal(sim.ship.segs[0].parts.find((p) => p.t === 'shield').hp, 1);
});

// Blob A, segment 1 (no core): engine, stealth, coupling + armour = 5 HP. Ankur's "wrecked in one hit".
const blobA = { hull: [
  { at: [-1, 0], bays: ['engine', 'stealth', 'coupling'], mounts: ['armour'] },
  { at: [0, 0], bays: ['core', 'engine', 'coupling'] },
  { at: [1, 0], bays: ['sensor', 'engine', 'stealth'], mounts: ['laser'] }
] };

test('a segment without a core: the core choice does not change it, and the table says 2 near lasers', () => {
  const tables = ['basic', 'steel', 'carbon'].map((core) => strengthTable(world, blobA, 0, { core }));
  for (const t of tables) {
    assert.equal(t.core, false);
    assert.equal(row(t, 'near').strip.text, '2');
    assert.equal(row(t, 'near').finish.text, '2');
    assert.equal(row(t, 'near').result, 'segment wrecked');
  }
  assert.deepEqual(tables[0].rows.map((r) => r.finish.text), tables[2].rows.map((r) => r.finish.text));
});

test('Blob A segment 1: one near laser never wrecks it; two do, leaving the ship at 58% hull', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const sim = strengthGame(world, blobA, { seed });
    fire(sim, 0, { kind: 'laser', dist: 1 });
    const st = segState(sim, 0);
    assert.equal(st.wrecked, false, 'seed ' + seed);
    const sg = sim.ship.segs[0];
    assert.equal(sg.parts.find((p) => p.t === 'armour').hp, 0);   // 3 hits: armour 2, then one bay part
    assert.equal(sg.parts.reduce((n, p) => n + Math.max(0, p.hp), 0), 2);
    fire(sim, 0, { kind: 'laser', dist: 1 });                      // 2 parts left + a wrecking hit
    assert.equal(segState(sim, 0).wrecked, true);
    assert.equal(segState(sim, 0).why, 'segment wrecked');
    assert.equal(segState(sim, 0).shipLost, false);
  }
});
