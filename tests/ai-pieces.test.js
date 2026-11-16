// The computer and the newer pieces: mines, missiles, decoys, Comets, drones (engine/ai.js, world `ai.tricks`).
// Each test sets up the smallest position that shows the behaviour, or plays a board from rules/boards.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../engine/index.js';
import { computerMove } from '../engine/ai.js';
import { loadBoard } from '../tools/boards.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const YAML = vm.runInThisContext(fs.readFileSync(path.join(root, 'lib/yaml.min.js'), 'utf8') + '\n;YAML');
const world = () => YAML.parse(fs.readFileSync(path.join(root, 'rules/world_v0.4.yaml'), 'utf8'));
const H = E.hex;

function battle({ radius = 10, terrain = [], p1, p2, extra1 = [], extra2 = [], seed = 7, tweak }) {
  const w = world();
  if (tweak) tweak(w);
  const side = (ships, extra) => ({ ships: ships.map((s) => ({ name: s.name, flagship: !!s.flagship, hull: s.hull, load: s.load })), deployment: ships.map((s) => ({ ship: s.name, at: s.at })).concat(extra) });
  const built = E.buildRules(w, { map: { board: { shape: 'hexagon', radius }, zones: { player_1_home: { edge: 'south', depth: 21 }, player_2_home: { edge: 'north', depth: 21 } }, setup: { mines: { own_home_zone: true, rows_into_no_mans_land: 0 } }, terrain } },
    { budget: 99999, player_1: side(p1, extra1), player_2: side(p2, extra2) });
  assert.deepEqual(built.problems, []);
  return E.start(built.rules, seed);
}
const gunboat = (name, at, more = {}) => ({ name, at, flagship: true, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser', 'armour'] }], ...more });
const ship = (g, id) => g.ships.find((s) => s.id === id);
const mineOf = (g, owner) => g.objs.find((o) => o.owner === owner);
// the computer plays one whole turn for the seat to move; `each` sees every action before it is applied
function aiTurn(g, each, opts = { personality: 'balanced' }) {
  const seat = g.order[g.turn];
  for (let i = 0; i < 40 && g.phase === 'play' && g.order[g.turn] === seat; i++) {
    let a = computerMove(g, seat, 'normal', opts) || { type: 'end' };
    if (!E.attempt(g, a).ok) a = { type: 'end' };
    if (each) each(a, g);
    g = E.apply(g, a);
  }
  return g;
}
const pass = (g) => E.apply(g, { type: 'end' });

// ---------------------------------------------------------------- mines
test('mines: the computer keeps a hex clear of a proximity mine it has seen, all the way round it', () => {
  // (A has no laser, so it has to go round: a ship with one shoots the mine from where it stands)
  const tug = { name: 'A', at: [0, 6], flagship: true, hull: [{ at: [0, 0], bays: ['core', 'engine', 'engine'], mounts: ['armour', 'armour'] }] };
  let g = battle({ p1: [tug], p2: [gunboat('B', [0, -6])], extra2: [{ naval_mine: [0, 2] }] });
  const m = mineOf(g, 1);
  g.players[0].revealed = { [m.id]: 99 };   // as if a scan had shown it, for the whole game
  for (let r = 0; r < 14 && g.phase === 'play'; r++) {
    g = g.order[g.turn] === 0 ? aiTurn(g) : pass(g);
    assert.ok(mineOf(g, 1), 'the mine has not gone off (round ' + g.round + ')');
    assert.ok(H.dist(ship(g, '1a').pos, m.pos) > 1, 'A stopped at ' + ship(g, '1a').pos + ', inside the trigger ring');
  }
  assert.ok(ship(g, '1a').pos[1] < 1, 'and it got past the mine: ' + ship(g, '1a').pos);
});

test('mines: the mark on a mine you have seen stays when a ship comes near; a ship that could see it clears it', () => {
  // a gunboat (sensor 4) cannot see a proximity mine (signature -8) at any range
  let g = battle({ p1: [gunboat('A', [0, 6])], p2: [gunboat('B', [0, -6])], extra2: [{ naval_mine: [0, 2] }] });
  const m = mineOf(g, 1);
  g.players[0].revealed = { [m.id]: g.round };   // seen this round only
  g = pass(g);
  assert.ok(E.view(g, 0).objs.some((o) => o.id === m.id), 'in sight while the scan lasts');
  while (!(g.round === 2 && g.order[g.turn] === 0)) g = pass(g);
  g = E.apply(g, { type: 'move', ship: '1a', path: [2] });   // next round: the scan has worn off, and A is 3 hexes from it
  const v = E.view(g, 0);
  assert.equal(v.objs.some((o) => o.id === m.id), false, 'no longer in sight');
  assert.deepEqual(v.ghosts.filter((x) => x.id === m.id).map((x) => x.pos), [[0, 2]], 'but its last-seen mark is still on the board');
});

test('mines: the computer does not fire a laser across its own mine (the mine would take the shot)', () => {
  let g = battle({ p1: [gunboat('A', [0, 5])], p2: [gunboat('B', [0, -1])], extra1: [{ mine: [0, 2] }] });
  for (const s of g.ships) g.lit[s.id] = 99;
  assert.ok(E.beamTargets(g, '1a').length > 0, 'the rules offer the shot');
  g = aiTurn(g, (a, s) => {
    if (a.type !== 'fire') return;
    const src = H.add(ship(s, '1a').pos, ship(s, '1a').segs[a.seg].off);
    assert.ok(!H.line(src, a.at).some((c) => c[0] === 0 && c[1] === 2), 'fired from ' + src + ' across its own mine');
  });
  assert.ok(mineOf(g, 0), 'its mine is still there');
});

// ---------------------------------------------------------------- missiles
test('missiles: every locked missile the computer launches is one the forecast says will hit', () => {
  let launches = 0;
  for (const seed of [1, 2, 3]) {
    let g = E.start(loadBoard('07_beacon_hill').rules, seed);
    for (let t = 0; t < 24 && g.phase === 'play'; t++) g = aiTurn(g, (a, s) => {
      if (a.type !== 'launch' || !a.target) return;
      launches++;
      const fc = E.forecast(s, a);
      assert.equal(fc.ends, 'hit', 'seed ' + seed + ' round ' + s.round + ': launched into ' + fc.ends);
      assert.equal(fc.hit, a.target);
      assert.ok(fc.rounds <= s.rules.ai.tricks.missile_flight_rounds, 'and it lands within missile_flight_rounds');
    }, {});
  }
  assert.ok(launches >= 3, 'the computer did launch (' + launches + ')');
});

// ---------------------------------------------------------------- decoys
test('decoys: with a known decoy beside the target, the computer spends one missile on the decoy, not a salvo', () => {
  const volley = { name: 'V', at: [0, 4], flagship: true, load: { missile: 6 }, hull: [{ at: [0, 0], bays: ['core', 'engine', 'magazine'], mounts: ['launcher', 'launcher'] }, { at: [1, 0], bays: ['coupling', 'magazine', 'sensor'], mounts: ['launcher'] }] };
  const prize = { name: 'T', at: [0, -1], flagship: true, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['armour'] }, { at: [1, 0], bays: ['coupling', 'engine'], mounts: ['armour'] }] };
  const lure = { name: 'L', at: [0, 1], hull: [{ at: [0, 0], bays: ['core', 'engine', 'emitter'], mounts: [] }] };
  let g = battle({ p1: [volley], p2: [prize, lure] });
  for (const s of g.ships) g.lit[s.id] = 99;
  // the scan readout that tells player 1 what L carries
  g.players[0].intel['2b'] = { 0: { round: g.round, wrecked: false, parts: ship(g, '2b').segs[0].parts.map((p) => ({ t: p.t, hp: p.hp })) } };
  const launched = [];
  g = aiTurn(g, (a) => { if (a.type === 'launch') launched.push(a.target); });
  assert.deepEqual(launched, ['2b'], 'one missile, at the decoy; the other launchers hold');
  // without the trick it fires the whole salvo at the big ship, straight past the decoy
  let g0 = battle({ p1: [volley], p2: [prize, lure], tweak: (w) => { w.ai.tricks.minds_decoys = false; } });
  for (const s of g0.ships) g0.lit[s.id] = 99;
  const old = [];
  aiTurn(g0, (a) => { if (a.type === 'launch') old.push(a.target); });
  assert.ok(old.length >= 2 && old.every((t) => t === '2a'), 'the old way: ' + JSON.stringify(old));
});

// ---------------------------------------------------------------- Comets
test('Comets: only one flies at a time, and the ones waiting do not move (a move uses a burn turn)', () => {
  let g = E.start(loadBoard('03_cat_and_mouse').rules, 1);
  const comets = g.ships.filter((s) => s.owner === 0 && /^Comet/.test(s.name)).map((s) => s.id);
  assert.equal(comets.length, 3);
  const moved = new Set();
  for (let t = 0; t < 6 && g.phase === 'play'; t++) g = g.order[g.turn] === 0 ? aiTurn(g, (a) => { if (a.type === 'move' && comets.includes(a.ship)) moved.add(a.ship); }, {}) : pass(g);
  assert.equal(moved.size, 1, 'in the first three rounds: ' + [...moved]);
  assert.equal(comets.filter((id) => (ship(g, id).burn || 0) === 0).length, 2, 'two still have all their burn');
});

test('Comets: a beam does not stop on one it cannot hit, and the computer does not shoot at one out of reach', () => {
  const comet = { name: 'K', at: [0, 1], hull: [{ at: [0, 0], bays: ['core', 'afterburner', 'sensor'], mounts: [] }] };
  let g = battle({ p1: [gunboat('A', [0, 4])], p2: [gunboat('B', [0, -2]), comet] });
  for (const s of g.ships) g.lit[s.id] = 99;
  g = aiTurn(g, (a, s) => { if (a.type === 'fire') assert.ok(E.beamTargets(s, '1a').some((t) => t.at[0] === a.at[0] && t.at[1] === a.at[1] && t.hits > 0), 'a shot the rules offer, for real hits'); });
  assert.ok(ship(g, '2a').segs[0].parts.some((p) => p.hp < (g.rules.parts[p.t].hp || 1)), 'B, behind the Comet, was hit');
});

// ---------------------------------------------------------------- drones
test('drones: a carrier keeps its drones until the enemy is near (none launched from the home corner)', () => {
  let g = E.start(loadBoard('04_the_dogleg').rules, 1);
  const rounds = [];
  for (let t = 0; t < 60 && g.phase === 'play' && g.round <= 12; t++) g = aiTurn(g, (a, s) => { if (a.type === 'launch' && a.kind === 'seeker_drone') rounds.push(s.round); }, {});
  assert.ok(!rounds.includes(1), 'launched in round 1: ' + rounds);
});

// ---------------------------------------------------------------- finding a shot
test('a ship with a target in sight behind a rock works round it for a shot, one hex a turn', () => {
  const terrain = [{ type: 'asteroid', at: [0, 1], size: 1 }];
  // one engine on two segments: the fleet moves one hex a turn
  const slow = (name, at) => ({ name, at, flagship: true, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser', 'armour'] }, { at: [1, 0], bays: ['coupling', 'sensor'], mounts: ['armour'] }] });
  let g = battle({ p1: [slow('A', [0, 3])], p2: [slow('B', [0, -1])], terrain });
  for (const s of g.ships) g.lit[s.id] = 99;
  let fired = false;
  for (let t = 0; t < 10 && !fired && g.phase === 'play'; t++) g = g.order[g.turn] === 0 ? aiTurn(g, (a) => { if (a.type === 'fire') fired = true; }) : pass(g);
  assert.ok(fired, 'it found a line within five rounds');
});
