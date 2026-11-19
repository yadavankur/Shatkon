// The Lab's Strength check (ui/strength-model.js): shot counts come from the engine's own damage code,
// with the real missiles (missile_basic, missile_advanced, missile = Nuke) and cores from the world file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { shippedFiles } from './helpers.js';
import { strengthTable, strengthGame, strengthWorld, fire, nextRound, segState, missileInfo, coreInfo } from '../ui/strength-model.js';

const { world } = shippedFiles();
const one = (bays, mounts) => ({ hull: [{ at: [0, 0], bays, mounts }] });
const row = (t, id) => t.rows.find((r) => r.id === id);

test('strength check reads the real missiles and cores, and leaves the world alone', () => {
  const before = JSON.stringify(world);
  strengthWorld(world, { coreOnly: true });
  assert.equal(JSON.stringify(world), before);
  assert.deepEqual(['basic', 'advanced', 'nuke'].map((id) => [missileInfo(world, id).hits, missileInfo(world, id).wrecks]), [[3, false], [4, false], [3, true]]);
  assert.equal(missileInfo(world, 'nuke').label, 'Nuke');
  assert.deepEqual(['basic', 'steel', 'carbon'].map((id) => coreInfo(world, id).hp), [1, 3, 6]);
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
  assert.equal(row(carbon, 'nuke').finish.text, '1');       // the Nuke wrecks the segment whatever the core
  assert.match(row(carbon, 'nuke').result, /core destroyed/);
  // the same boat built with a carbon core in the design (no what-if) gives the same table
  const fitted = strengthTable(world, one(['carbon_core', 'sensor', 'magazine'], ['laser']), 0, { coreOnly: true });
  assert.deepEqual(fitted.rows.map((r) => r.finish.text), carbon.rows.map((r) => r.finish.text));
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
  // a Nuke against a working shield: no wreck, the shield goes down and the segment takes 3 hits
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
    const sg = sim.ship.segs[0];
    assert.equal(segState(sim, 0).wrecked, false, 'seed ' + seed);
    assert.equal(sg.parts.find((p) => p.t === 'armour').hp, 0);   // 3 hits: armour 2, then one bay part
    assert.equal(sg.parts.reduce((n, p) => n + Math.max(0, p.hp), 0), 2);
    fire(sim, 0, { kind: 'laser', dist: 1 });                      // 2 parts left + a wrecking hit
    assert.equal(segState(sim, 0).wrecked, true);
    assert.equal(segState(sim, 0).why, 'segment wrecked');
    const left = sim.ship.segs.flatMap((g) => (g.wrecked ? [] : g.parts)).reduce((n, p) => n + Math.max(0, p.hp), 0);
    assert.equal(Math.round((100 * left) / 12), 58);               // the 58% hull Ankur saw: two shots, not one
  }
});
