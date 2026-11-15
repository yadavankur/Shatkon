// The engine changes asked for by the maps rework (beta/docs/maps-rework.md, maps-rework-engine.md):
// the Comet's afterburner, the sleeper mine, the decoy emitter, fair lines of sight, and the
// computer's variety and tricks. All on the beta engine and the beta rule files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../beta/engine/index.js';
import { computerMove, enemyHomePoint } from '../beta/engine/ai.js';
import { boardNames, loadBoard, playOut, TURNS, turnRules, mirrorOf } from '../tools/boards.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const YAML = vm.runInThisContext(fs.readFileSync(path.join(root, 'beta/lib/yaml.min.js'), 'utf8') + '\n;YAML');
const world = () => YAML.parse(fs.readFileSync(path.join(root, 'beta/rules/world_v0.4.yaml'), 'utf8'));
const H = E.hex;

function build({ radius = 10, terrain = [], objective, p1, p2, extra1 = [], extra2 = [], tweak }) {
  const w = world();
  if (tweak) tweak(w);
  const side = (ships, extra) => ({ ships: ships.map((s) => ({ name: s.name, flagship: !!s.flagship, hull: s.hull, load: s.load })), deployment: ships.map((s) => ({ ship: s.name, at: s.at })).concat(extra) });
  return E.buildRules(w, { map: { board: { shape: 'hexagon', radius }, terrain, objective } }, { budget: 99999, player_1: side(p1, extra1), player_2: side(p2, extra2) });
}
function battle(o) { const b = build(o); assert.deepEqual(b.problems, []); return E.start(b.rules, o.seed || 7); }
const flag = (name, at) => ({ name, at, flagship: true, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser', 'armour'] }] });
const comet = (name, at) => ({ name, at, hull: [{ at: [0, 0], bays: ['core', 'afterburner', 'sensor'] }] });
const boat = (name, at, more = {}) => ({ name, at, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser', 'shield'] }, { at: [1, 0], bays: ['coupling', 'engine', 'engine'], mounts: ['laser', 'armour'] }], ...more });
const line3 = (name, at, more = {}) => ({ name, at, hull: [{ at: [-1, 0], bays: ['engine', 'coupling'], mounts: ['armour', 'shield'] }, { at: [0, 0], bays: ['core', 'sensor'], mounts: ['shield'] }, { at: [1, 0], bays: ['engine', 'coupling'], mounts: ['armour', 'shield'] }], ...more });
const end = (g) => E.apply(g, { type: 'end' });
// End player 1's turn and come back round to player 1's next one (the order swaps every round).
const myNext = (g) => { g = end(g); while (g.phase === 'play' && g.order[g.turn] !== 0) g = end(g); return g; };
const ship = (g, name) => g.ships.find((s) => s.name === name);
const east = (n) => Array(n).fill(0);

// ---------- the Comet ----------

test('a Comet under afterburner lights up enemy ships within 2 hexes of its path, and itself; mines stay hidden', () => {
  let g = battle({ p1: [flag('F', [-8, 8]), comet('C', [-6, 0])], p2: [flag('E', [0, -9]), boat('Near', [1, -2]), boat('Far', [0, 5])], extra2: [{ mine: [-3, 1] }] });
  assert.ok(!g.players[0].vis.includes(ship(g, 'Near').id), 'not in view to start with');
  g = E.apply(g, { type: 'move', ship: ship(g, 'C').id, path: east(8) });
  const near = ship(g, 'Near'), far = ship(g, 'Far'), c = ship(g, 'C');
  assert.equal(g.lit[near.id], g.round + 1, 'the ship 2 hexes off the path is lit to the end of next round');
  assert.equal(g.lit[c.id], g.round + 1, 'so is the Comet');
  assert.ok(!g.lit[far.id], 'a ship 5 hexes off the path is not');
  assert.ok(g.players[0].vis.includes(near.id) && g.players[1].vis.includes(c.id));
  assert.ok(!g.players[0].vis.some((id) => id.startsWith('o')), 'the mine one hex from the path is not shown');
  assert.ok(g.events.some((e) => e.t === 'pass_reveal' && e.found.includes(near.id)));
});

test('the afterburner burns for 3 turns on which the Comet moves, then it crawls 1 hex a turn', () => {
  let g = battle({ radius: 14, p1: [flag('F', [-8, 8]), comet('C', [-12, 0])], p2: [flag('E', [0, -13])] });
  const id = ship(g, 'C').id, far = () => Math.max(...E.reach(g, id).map((r) => r.path.length));
  assert.equal(E.shipStatus(g, id).burnLeft, 3);
  for (let turn = 1; turn <= 3; turn++) {
    assert.equal(far(), 8, 'turn ' + turn + ': 8 hexes on offer');
    g = E.apply(g, { type: 'move', ship: id, path: east(2) });
    assert.equal(far(), 6, 'the rest of this turn\'s 8 is still there');
    g = myNext(g);
  }
  assert.equal(E.shipStatus(g, id).burnLeft, 0);
  assert.equal(far(), 1, 'burnt out');
  assert.ok(!E.attempt(g, { type: 'move', ship: id, path: east(2) }).ok);
  g = myNext(myNext(g));                                           // let the glare of its last burn fade
  g = E.apply(g, { type: 'move', ship: id, path: east(1) });
  assert.ok(!g.lit[id] || g.lit[id] < g.round, 'a burnt-out Comet no longer lights itself up');
});

test('a turn the Comet sits still does not use up a burn turn', () => {
  let g = battle({ radius: 14, p1: [flag('F', [-8, 8]), comet('C', [-12, 0])], p2: [flag('E', [0, -13])] });
  const id = ship(g, 'C').id;
  g = end(end(end(end(g))));
  assert.equal(E.shipStatus(g, id).burnLeft, 3);
});

test('the burn counter travels in the game code and the turn code', async () => {
  let a = battle({ radius: 14, p1: [flag('F', [-8, 8]), comet('C', [-12, 0])], p2: [flag('E', [0, -13])] });
  let b = await E.importGame(await E.exportGame(a));
  a = E.apply(a, { type: 'move', ship: ship(a, 'C').id, path: east(3) });
  a = end(a);
  b = E.applyTurnCode(b, E.turnCode(a));
  assert.equal(ship(b, 'C').burn, 1);
  assert.equal(E.hashState(a), E.hashState(b));
  const c = await E.importGame(await E.exportGame(a));
  assert.equal(ship(c, 'C').burn, 1);
});

test('at most 2 afterburner ships a fleet', () => {
  const two = build({ p1: [flag('F', [-8, 8]), comet('C1', [-6, 0]), comet('C2', [-6, 2])], p2: [flag('E', [0, -9])] });
  assert.deepEqual(two.problems, []);
  const three = build({ p1: [flag('F', [-8, 8]), comet('C1', [-6, 0]), comet('C2', [-6, 2]), comet('C3', [-6, 4])], p2: [flag('E', [0, -9])] });
  assert.equal(three.problems.length, 1);
  assert.match(three.problems[0], /3 ships carry "afterburner"; the limit is 2/);
});

test('a Comet or a courier on the beacon neither scores it nor contests it', () => {
  const objective = { at: [0, 0], radius: 1, points_to_win: 3 };
  let g = battle({ objective, p1: [flag('F', [-8, 8]), comet('C', [0, 0])], p2: [flag('E', [0, -9])] });
  assert.deepEqual(E.holders(g).map((l) => l.length), [0, 0]);
  for (let i = 0; i < 6; i++) g = end(g);
  assert.equal(g.players[0].score, 0, 'three rounds sitting on it score nothing');
  // an ordinary ship holds it even with an enemy courier parked beside it
  const courier = { name: 'Dart', at: [1, 0], hull: [{ at: [0, 0], bays: ['core', 'sprint_drive', 'sensor'] }] };
  g = battle({ objective, p1: [flag('F', [0, 0])], p2: [flag('E', [0, -9]), courier] });
  assert.deepEqual(E.holders(g).map((l) => l.length), [1, 0]);
  for (let i = 0; i < 4; i++) g = end(g);
  assert.ok(g.players[0].score >= 1, 'the courier did not block the score');
});

test('a ship on its own drive is not offered a move the engine would refuse (fleet may not move)', () => {
  const g = battle({ p1: [flag('F', [-8, 8]), comet('C', [-6, 0])], p2: [flag('E', [0, -9])] });
  const id = ship(g, 'C').id;
  assert.equal(E.shipStatus(g, id).moveLeft, 8);
  g.players[0].canMove = false;
  assert.equal(E.shipStatus(g, id).moveLeft, 0);
  assert.equal(E.reach(g, id).length, 0);
  assert.ok(!E.attempt(g, { type: 'move', ship: id, path: [0] }).ok);
});

// ---------- the sleeper mine ----------

const sleeper = (at) => ({ sleeper_mine: at });
const noDrift = (w) => { w.munitions.sleeper_mine.drift = 0; };

test('a scan shows a sleeper mine within 2 hexes of the scanning ship and not from 3, with no faint contact either', () => {
  for (const [d, want] of [[2, true], [3, false]]) {
    let g = battle({ p1: [flag('F', [-3, 0])], p2: [flag('E', [0, -9])], extra2: [sleeper([-2 + d, 0])], tweak: noDrift });
    const f = ship(g, 'F').id;
    g = E.apply(g, { type: 'move', ship: f, path: [0] });          // now at [-2, 0]: the mine is d hexes east
    g = E.apply(g, { type: 'scan', ship: f });
    const mine = g.objs[0];
    assert.equal(g.players[0].vis.includes(mine.id), want, d + ' hexes');
    assert.ok(!(g.players[0].pings || {})[mine.id], 'no faint contact');
  }
});

test('a sleeper mine wrecks two segments and a shield does not help: a two-hex boat dies', () => {
  let g = battle({ p1: [flag('F', [-8, 8]), boat('B', [-3, 0])], p2: [flag('E', [0, -9])], extra2: [sleeper([0, 0])], tweak: noDrift });
  g = E.apply(g, { type: 'move', ship: ship(g, 'B').id, path: [0] });   // its east segment comes next to the mine
  assert.ok(g.events.some((e) => e.t === 'blast' && e.kind === 'sleeper_mine'));
  assert.ok(g.ships.find((s) => s.name === 'B').dead);
});

test('a sleeper mine against the end of a three-hex ship takes the two ends and spares the core', () => {
  let g = battle({ p1: [flag('F', [-8, 8]), line3('L', [-3, 0])], p2: [flag('E', [0, -9])], extra2: [sleeper([0, 0])], tweak: noDrift });
  g = E.apply(g, { type: 'move', ship: ship(g, 'L').id, path: [0] });
  const l = g.ships.find((s) => s.name === 'L');
  assert.deepEqual(l.segs.map((sg) => sg.wrecked), [true, false, true]);
  assert.ok(!l.dead, 'one mine does not sink a three-hex ship unless it goes off against the core');
  assert.equal(l.segs[1].parts.find((p) => p.t === 'shield').hp, 1, 'no splash on the rest of the ship');
});

test('a sleeper mine takes exactly two segments off a seven-hex ship', () => {
  const big = { name: 'Big', at: [-4, 0], hull: [{ at: [0, 0], bays: ['core', 'sensor'] }].concat(H.DIRS.map((d) => ({ at: d, bays: ['engine', 'coupling'], mounts: ['shield', 'armour'] }))) };
  let g = battle({ p1: [flag('F', [-8, 8]), big], p2: [flag('E', [0, -9])], extra2: [sleeper([-1, 0])], tweak: noDrift });
  g = E.apply(g, { type: 'move', ship: ship(g, 'Big').id, path: [0] });
  const b = g.ships.find((s) => s.name === 'Big');
  assert.equal(b.segs.filter((sg) => sg.wrecked).length, 2);
  assert.ok(!b.dead);
});

test('a sleeper mine creeps 1 hex toward an enemy within 3 hexes, stays put at 4, and is heard', () => {
  let g = battle({ p1: [flag('F', [-3, 0])], p2: [flag('E', [0, -9])], extra2: [sleeper([0, 0]), sleeper([1, 5])] });
  g = end(end(g));                                                 // one flight phase
  const [a, b] = g.objs;
  assert.deepEqual(a.pos, [-1, 0], 'three hexes away: it crept one');
  assert.deepEqual(b.pos, [1, 5], 'nothing within 3: it stayed');
  assert.ok(g.view === undefined && E.view(g, 0).contacts.some((c) => c.id === a.id), 'the ship it is after gets a faint contact');
  assert.ok(!g.players[0].vis.includes(a.id), 'but still cannot see it');
});

test('a creeping sleeper mine goes off when it arrives next to a ship', () => {
  let g = battle({ p1: [flag('F', [-8, 8]), boat('B', [-3, 0])], p2: [flag('E', [0, -9])], extra2: [sleeper([0, 0])] });
  g = end(end(g));                                                 // B's east segment is at [-2, 0]: the mine creeps to [-1, 0]
  assert.equal(g.objs.length, 0);
  assert.ok(g.ships.find((s) => s.name === 'B').dead);
});

test('a sleeper mine prefers the largest ship in range', () => {
  let g = battle({ p1: [flag('F', [-3, -2]), line3('L', [4, 0])], p2: [flag('E', [0, -9])], extra2: [sleeper([0, 0])] });
  g.ships.find((s) => s.name === 'F').pos = [-2, 0];               // one hex nearer than the big ship's nearest segment at [3, 0]
  g = end(end(g));
  assert.deepEqual(g.objs[0].pos, [1, 0], 'toward the three-hex ship, not the nearer one-hex ship');
});

test('a laser aimed at something else flies over a sleeper mine; a shot aimed at the mine destroys it', () => {
  let g = battle({ p1: [flag('F', [-3, 0])], p2: [flag('E', [0, -9]), boat('T', [1, 0])], extra2: [sleeper([-1, 0])], tweak: noDrift });
  const f = ship(g, 'F'), t = ship(g, 'T'), mine = g.objs[0];
  g.lit = { [t.id]: 99 };
  let r = E.apply(g, { type: 'fire', ship: f.id, seg: 0, part: 3, at: [1, 0] });
  assert.equal(r.objs.length, 1, 'the mine is still there');
  assert.ok(r.events.some((e) => e.t === 'fire' && e.hits > 0), 'and the shot went through to its target');
  g.lit[mine.id] = 99;
  r = E.apply(g, { type: 'fire', ship: f.id, seg: 0, part: 3, at: [-1, 0] });
  assert.equal(r.objs.length, 0);
});

// ---------- the decoy emitter ----------

test('an emitter adds 3 to a ship\'s signature', () => {
  const lure = { name: 'Lure', at: [-6, 0], hull: [{ at: [0, 0], bays: ['core', 'engine', 'emitter'] }] };
  const plain = { name: 'Plain', at: [-6, 3], hull: [{ at: [0, 0], bays: ['core', 'engine'] }] };
  const g = battle({ p1: [flag('F', [-8, 8]), lure, plain], p2: [flag('E', [0, -9])] });
  assert.equal(E.signatureOf(g, ship(g, 'Lure')) - E.signatureOf(g, ship(g, 'Plain')), 3);
  assert.equal(E.sigBreak(g, ship(g, 'Lure')).emitter, 3);
  assert.equal(E.shipStats(g.rules, g.rules.fleets[0].ships[1]).signature, 4);
});

test('a missile locked on another ship turns on a decoy emitter its seeker can see', () => {
  const carrier = { name: 'C', at: [-6, 0], flagship: true, load: { missile: 1 }, hull: [{ at: [0, 0], bays: ['core', 'engine', 'magazine'], mounts: ['launcher'] }, { at: [-1, 0], bays: ['coupling', 'engine', 'sensor'] }] };
  const lure = { name: 'Lure', at: [0, 2], hull: [{ at: [0, 0], bays: ['core', 'engine', 'emitter'] }] };
  for (const withLure of [true, false]) {
    let g = battle({ p1: [carrier], p2: [flag('E', [0, -9]), line3('T', [3, 0])].concat(withLure ? [lure] : []) });
    const t = ship(g, 'T');
    g.lit = { [t.id]: 99 };
    g = E.apply(g, { type: 'launch', ship: ship(g, 'C').id, kind: 'missile', start: [-5, 0], target: t.id, route: [] });
    let lured = false;
    for (let i = 0; i < 4 && g.phase === 'play' && g.objs.length; i++) { g = end(g); lured = lured || g.events.some((e) => e.t === 'lured'); }
    assert.equal(lured, withLure);
    if (withLure) assert.ok(g.ships.find((s) => s.name === 'Lure').dead, 'the Lure took the missile');
    else assert.ok(g.ships.find((s) => s.name === 'T').segs.some((sg) => sg.wrecked || sg.parts.some((p) => p.hp < g.rules.parts[p.t].hp)), 'with no Lure it reaches its target');
  }
});

// ---------- fair lines of sight ----------

test('lines of sight are the same from both ends and on a mirrored board', () => {
  for (const n of boardNames()) {
    const { rules } = loadBoard(n), mir = mirrorOf(rules);
    if (!mir) continue;
    const f = TURNS.find((t) => t.name === mir).f, R = rules.board.radius;
    const rock = new Set(rules.terrain.filter((t) => rules.terrainTypes[t.type].blocks_sight).flatMap((t) => t.cells.map(H.key)));
    const clear = (a, b) => !!H.sightLine(a, b, (c) => rock.has(H.key(c)));
    const cells = H.disc([0, 0], R).filter((c) => !rock.has(H.key(c)));
    let odd = 0;
    for (const a of cells) for (const b of cells) { const d = H.dist(a, b); if (d >= 2 && d <= 8 && (clear(a, b) !== clear(f(a), f(b)) || clear(a, b) !== clear(b, a))) odd++; }
    assert.equal(odd, 0, n);
  }
});

test('four boards are exact mirrors (terrain, hulls and starts)', () => {
  const mirrors = boardNames().filter((n) => mirrorOf(loadBoard(n).rules));
  assert.deepEqual(mirrors, ['01_first_light', '04_the_dogleg', '05_kings_guard', '07_beacon_hill']);
});

// ---------- the computer ----------

test('the computer heads for the enemy\'s real home edge, on open ground, on every board', () => {
  for (const n of boardNames()) {
    const { rules } = loadBoard(n), g = E.start(rules, 1), R = rules.board.radius;
    const rock = new Set(rules.terrain.filter((t) => rules.terrainTypes[t.type].blocks_movement).flatMap((t) => t.cells.map(H.key)));
    for (const seat of [0, 1]) {
      const hp = enemyHomePoint(E.view(g, seat), seat, rules), z = rules.zones.find((x) => x.name.startsWith(rules.fleets[1 - seat].name));
      assert.ok(hp && !rock.has(H.key(hp)), n + ': open ground');
      assert.ok(H.EDGE[z.edge](hp, R) <= 2, n + ': inside the first rows of the enemy zone');
    }
  }
});

test('the same seed replays the same game; different seeds open differently', () => {
  const { rules } = loadBoard('05_kings_guard');
  const opening = (seed) => { let g = E.start(rules, seed); const acts = []; for (let i = 0; i < 30 && g.round <= 2; i++) { const a = computerMove(g, g.order[g.turn], 'normal') || { type: 'end' }; acts.push(E.actionText(a)); g = E.apply(g, a); } return acts.join(';'); };
  assert.equal(opening(5), opening(5));
  assert.ok(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(opening)).size >= 4, 'at least four different openings (first two rounds) in eight games');
});

test('a mirror board no longer comes out one-sided, whichever way it is turned', () => {
  const { rules } = loadBoard('01_first_light');
  for (const t of [TURNS[0], TURNS[6]]) {                           // as written, and turned half round
    const r = turnRules(rules, t.f);
    let w = 0;
    for (let seed = 1; seed <= 12; seed++) if (playOut(r, seed).winner === 0) w++;
    assert.ok(w >= 1 && w <= 11, t.name + ': player 1 won ' + w + ' of 12');
  }
});

test('the computer\'s carrier launches a drone when it has nothing located', () => {
  let g = E.start(loadBoard('04_the_dogleg').rules, 2), launched = false;
  for (let i = 0; i < 12 && g.round === 1 && g.turn === 0; i++) { const a = computerMove(g, 0, 'normal') || { type: 'end' }; if (a.type === 'launch' && a.kind === 'seeker_drone') launched = true; g = E.apply(g, a); }
  assert.ok(launched);
});

test('the computer shoots a mine it can see near its ships', () => {
  const g = battle({ p1: [flag('F', [-3, 0])], p2: [flag('E', [0, -9])], extra2: [{ mine: [-1, 0] }] });
  g.lit = { [g.objs[0].id]: 99 };
  E.refreshSight(g);
  const a = computerMove(g, 0, 'normal', { personality: 'balanced' });
  assert.equal(a.type, 'fire');
  assert.deepEqual(a.at, [-1, 0]);
});

test('Cat and Mouse keeps to the two-Comet limit', () => {
  const { rules, problems } = loadBoard('03_cat_and_mouse');
  assert.deepEqual(problems, []);
  assert.equal(rules.fleets[0].ships.filter((s) => s.segs.some((sg) => sg.parts.includes('afterburner'))).length, 2);
});
