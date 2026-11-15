// The new kinds of ship (courier, proximity mine) and the hand-made boards.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../beta/engine/index.js';
import { boardNames, loadBoard } from '../tools/boards.mjs';

test('all ten boards load with no problems', () => {
  const names = boardNames();
  assert.equal(names.length, 10);
  for (const n of names) assert.deepEqual(loadBoard(n).problems, [], n);
});

test('a courier moves 5 hexes on its own drive and takes no fleet thrust', () => {
  const g = E.start(loadBoard('09_fog_bank').rules, 3);
  const dart = g.ships.find((s) => s.name === 'Swift');
  const far = E.reach(g, dart.id).filter((r) => r.path.length === 5);
  assert.ok(far.length > 0, 'a 5-hex move is on offer');
  assert.ok(!E.reach(g, dart.id).some((r) => r.path.length > 5));
  const before = g.players[0].thrust, r = E.attempt(g, { type: 'move', ship: dart.id, path: far[0].path });
  assert.ok(r.ok);
  assert.equal(r.state.players[0].thrust, before);
});

test('a laser cannot hit a courier from more than 3 hexes, and can from 3', () => {
  let g = E.start(loadBoard('09_fog_bank').rules, 3);
  const dart = g.ships.find((s) => s.name === 'Swift'), gun = g.ships.find((s) => s.name === 'Fang');
  g = E.attempt(g, { type: 'end' }).state;                       // the computer's side to move
  const put = (d) => { const s = structuredClone({ ...g, rules: undefined }); s.rules = g.rules; s.ships.find((x) => x.id === gun.id).pos = [-6, -2]; s.ships.find((x) => x.id === dart.id).pos = [-6, -2 + d]; s.lit = { [dart.id]: 99 }; return s; };
  const shots = (s) => { const t = E.attempt(s, { type: 'move', ship: gun.id, path: [] }); return E.beamTargets(s, gun.id).filter((x) => x.target === dart.id); };
  assert.equal(shots(put(5)).length, 0, 'out of reach at 5 hexes');
  assert.ok(shots(put(3)).length > 0, 'a shot at 3 hexes');
});

test('a proximity mine goes off when an enemy comes next to it, and takes the segment', () => {
  let g = E.start(loadBoard('09_fog_bank').rules, 3);
  g = E.attempt(g, { type: 'end' }).state;
  const gun = g.ships.find((s) => s.name === 'Fang');
  gun.pos = [-1, 0];                                             // two hexes from the mine at [0, 2]
  const step = E.reach(g, gun.id).find((r) => r.path.length === 1 && r.at[0] === -1 && r.at[1] === 1);
  assert.ok(step, 'the hex next to the mine is reachable (the mine is not in view)');
  const r = E.attempt(g, { type: 'move', ship: gun.id, path: step.path });
  assert.ok(r.ok);
  assert.ok(r.state.events.some((e) => e.t === 'blast' && e.kind === 'naval_mine'));
  const after = r.state.ships.find((s) => s.id === gun.id);
  assert.ok(after.dead || after.segs.some((sg) => sg.wrecked));
  assert.ok(!r.state.objs.some((o) => o.kind === 'naval_mine' && o.pos[0] === 0 && o.pos[1] === 2));
});
