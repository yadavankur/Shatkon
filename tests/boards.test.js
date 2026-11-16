// The new kinds of ship (courier, proximity mine) and the hand-made boards.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../engine/index.js';
import { boardNames, loadBoard } from '../tools/boards.mjs';

// these tests give player 1's ships orders on turn 1, so player 1 moves first (boards pick at random)
const pinned = (n, o = {}) => loadBoard(n, { ...o, set: { 'turns.first': 'player_1', ...(o.set || {}) } });

test('all ten boards load with no problems', () => {
  const names = boardNames();
  assert.equal(names.length, 10);
  for (const n of names) assert.deepEqual(loadBoard(n).problems, [], n);
});

test('a courier moves 5 hexes on its own drive and takes no fleet thrust', () => {
  const g = E.start(pinned('09_fog_bank').rules, 3);
  const dart = g.ships.find((s) => s.name === 'Swift');
  const far = E.reach(g, dart.id).filter((r) => r.path.length === 5);
  assert.ok(far.length > 0, 'a 5-hex move is on offer');
  assert.ok(!E.reach(g, dart.id).some((r) => r.path.length > 5));
  const before = g.players[0].thrust, r = E.attempt(g, { type: 'move', ship: dart.id, path: far[0].path });
  assert.ok(r.ok);
  assert.equal(r.state.players[0].thrust, before);
});

test('a laser cannot hit a courier from more than 3 hexes, and can from 3', () => {
  let g = E.start(pinned('09_fog_bank').rules, 3);
  const dart = g.ships.find((s) => s.name === 'Swift'), gun = g.ships.find((s) => s.name === 'Fang');
  g = E.attempt(g, { type: 'end' }).state;                       // the computer's side to move
  // an open straight line on this board: [1, 2] to [1, 7]
  const put = (d) => { const s = structuredClone({ ...g, rules: undefined }); s.rules = g.rules; s.ships.find((x) => x.id === gun.id).pos = [1, 2]; s.ships.find((x) => x.id === dart.id).pos = [1, 2 + d]; s.lit = { [dart.id]: 99 }; return s; };
  const shots = (s) => { const t = E.attempt(s, { type: 'move', ship: gun.id, path: [] }); return E.beamTargets(s, gun.id).filter((x) => x.target === dart.id); };
  assert.equal(shots(put(5)).length, 0, 'out of reach at 5 hexes');
  assert.ok(shots(put(3)).length > 0, 'a shot at 3 hexes');
});

test('a Comet (afterburner, defined in its board file) moves 8 hexes on its own drive', () => {
  const g = E.start(pinned('03_cat_and_mouse').rules, 3);
  const c = g.ships.find((s) => s.name === 'Comet 2');
  assert.ok(E.reach(g, c.id).some((r) => r.path.length === 8), 'an 8-hex move is on offer');
  assert.ok(!E.reach(g, c.id).some((r) => r.path.length > 8));
});

test('a sleeper mine: the Dowser (sensor 12) sees it from 2 hexes, a gunboat next to it does not', () => {
  const g = E.start(pinned('02_minefield').rules, 3);
  const mine = g.objs.find((o) => o.kind === 'sleeper_mine' && o.pos[0] === 2 && o.pos[1] === -4);
  const dowser = g.ships.find((s) => s.name === 'Dowser'), mallet = g.ships.find((s) => s.name === 'Mallet');
  dowser.pos = [-1, -4];                                         // nearest segment [0, -4], 2 hexes from the mine
  assert.ok(E.visibleTo(g, 0).has(mine.id), 'the Dowser sees it');
  dowser.pos = [5, 6]; mallet.pos = [3, -4];                     // the gunboat right next to it
  assert.ok(!E.visibleTo(g, 0).has(mine.id), 'the gunboat does not');
});

test('a sleeper mine goes off when an enemy comes next to it and wrecks the segment', () => {
  let g = E.start(pinned('02_minefield').rules, 3);
  const mallet = g.ships.find((s) => s.name === 'Mallet');
  mallet.pos = [-4, -2];
  const step = E.reach(g, mallet.id).find((r) => r.path.length === 1 && r.at[0] === -3 && r.at[1] === -2);
  assert.ok(step);
  const r = E.attempt(g, { type: 'move', ship: mallet.id, path: step.path });
  assert.ok(r.ok);
  assert.ok(r.state.events.some((e) => e.t === 'blast' && e.kind === 'sleeper_mine'));
  const after = r.state.ships.find((s) => s.id === mallet.id);
  assert.ok(after.dead || after.segs.some((sg) => sg.wrecked));
});

test('The Minefield has exactly one clean lane, and it is not through the middle', () => {
  const { rules } = loadBoard('02_minefield');
  const R = rules.board.radius, D = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const rock = new Set(rules.terrain.filter((t) => rules.terrainTypes[t.type].blocks_movement).flatMap((t) => t.cells.map(String)));
  const mines = rules.fleets[1].deployment.filter((d) => d.munition);
  const safe = (c) => E.hex.inHexagon(c, R) && !rock.has(String(c)) && !mines.some((m) => E.hex.dist(m.at, c) <= (rules.munitions[m.munition].trigger_range || 0));
  const through = (allowed) => {
    const start = E.hex.disc([0, 0], R).filter((c) => R - c[0] - c[1] < 3 && safe(c) && allowed(c));
    const seen = new Set(start.map(String)), todo = start.slice();
    while (todo.length) { const c = todo.pop(); if (R + c[0] + c[1] < 5) return true; for (const d of D) { const n = [c[0] + d[0], c[1] + d[1]]; if (!seen.has(String(n)) && safe(n) && allowed(n)) { seen.add(String(n)); todo.push(n); } } }
    return false;
  };
  assert.ok(through(() => true), 'there is a clean lane');
  assert.ok(!through((c) => c[0] - c[1] > -8), 'every lane but the south-west one is mined');
});

test('a proximity mine goes off when an enemy comes next to it, and takes the segment', () => {
  let g = E.start(pinned('09_fog_bank').rules, 3);
  g = E.attempt(g, { type: 'end' }).state;
  const gun = g.ships.find((s) => s.name === 'Fang');
  gun.pos = [1, 3];                                              // two hexes from the mine at [0, 2]
  const step = E.reach(g, gun.id).find((r) => r.path.length === 1 && r.at[0] === 1 && r.at[1] === 2);
  assert.ok(step, 'the hex next to the mine is reachable (the mine is not in view)');
  const r = E.attempt(g, { type: 'move', ship: gun.id, path: step.path });
  assert.ok(r.ok);
  assert.ok(r.state.events.some((e) => e.t === 'blast' && e.kind === 'naval_mine'));
  const after = r.state.ships.find((s) => s.id === gun.id);
  assert.ok(after.dead || after.segs.some((sg) => sg.wrecked));
  assert.ok(!r.state.objs.some((o) => o.kind === 'naval_mine' && o.pos[0] === 0 && o.pos[1] === 2));
});
