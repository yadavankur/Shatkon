import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRules, start, apply, attempt, view, reach, beamTargets, launchOptions, shipStatus, forecast, turnCode, applyTurnCode, exportGame, importGame, hashState, hex, shipStats } from '../engine/index.js';
import { applyHits } from '../engine/damage.js';
import { sensorOf, signatureOf, visibleTo, sigBreak, detectRange, passiveRange } from '../engine/detect.js';
import { scanInfo } from '../engine/scan.js';
import { computerMove } from '../engine/ai.js';
import { shippedFiles, battle, scout, pod } from './helpers.js';

const end = (g) => apply(g, { type: 'end' });
const ship = (g, id) => g.ships.find((s) => s.id === id);

test('the shipped rule files are valid and the fleets fit the budget', () => {
  const f = shippedFiles();
  const { rules, problems } = buildRules(f.world, f.map, f.fleets);
  assert.deepEqual(problems, []);
  assert.equal(rules.fleets.length, 2);
  // stealth parts are free (they only cost a bay), so both fleets come in under the 200 budget
  assert.equal(rules.fleets[0].cost, 188);
  assert.equal(rules.fleets[1].cost, 188);
  const a = shipStats(rules, rules.fleets[0].ships[0]);
  assert.deepEqual([a.segments, a.thrust, a.sensor, a.signature, a.cost], [3, 3, 4, 1, 47]);
  const b = shipStats(rules, rules.fleets[0].ships[1]);
  assert.deepEqual([b.segments, b.thrust, b.sensor, b.signature, b.cost], [7, 7, 4, 3, 131], 'the flagship: 7 segments - 4 stealth = 3, its floor');
  const g = start(rules, 1);
  assert.equal(g.ships.length, 4);
  assert.equal(g.objs.length, 4);
  // player 2 is player 1 turned around
  assert.deepEqual(ship(g, '2a').pos, ship(g, '1a').pos.map((n) => -n));
});

test('the rules checker reports broken fleets', () => {
  const { problems } = battle({
    p1: [{ name: 'Bad', at: [0, 3], flagship: true, hull: [{ at: [0, 0], bays: ['engine', 'engine', 'engine', 'engine'] }, { at: [2, 0], bays: ['laser', 'warp_drive'] }] }],
    p2: [scout('Ok', [0, -3])],
  });
  const all = problems.join('\n');
  for (const want of ['4 bay parts', 'unknown part "warp_drive"', 'mount part but sits in a bay', 'not all joined', 'exactly one core', 'couplings'])
    assert.ok(all.includes(want), 'missing problem: ' + want + '\n' + all);
});

test('hex maths: distance, lines and turning', () => {
  assert.equal(hex.dist([0, 0], [3, -1]), 3);
  assert.equal(hex.dist([-2, 5], [4, -3]), 8);
  const l = hex.line([0, 0], [4, -2]);
  assert.equal(l.length, 5);
  for (let i = 1; i < l.length; i++) assert.equal(hex.dist(l[i - 1], l[i]), 1);
  assert.equal(hex.turnDiff(0, 5), -1);
  assert.equal(hex.turnToward(0, 3, 1), 1);
  assert.equal(hex.disc([0, 0], 2).length, 19);
});

test('movement: three engines for four segments can move one ship now, or both after banking', () => {
  const two = (name, at, engines, flagship) => ({ name, at, flagship, hull: [{ at: [0, 0], bays: ['core'].concat(Array(Math.min(2, engines)).fill('engine')) }, { at: [1, 0], bays: ['coupling'].concat(Array(Math.max(0, engines - 2)).fill('engine')) }] });
  const fleets = { p1: [two('A', [0, 5], 2, true), two('B', [0, 7], 1, false)], p2: [scout('X', [0, -8])] };
  let { game: g, problems } = battle(fleets);
  assert.deepEqual(problems, []);
  let v = view(g, 0);
  assert.deepEqual([v.income, v.segments, v.thrust, v.canMove, v.moveCap], [3, 4, 3, true, 1]);
  g = apply(g, { type: 'move', ship: '1a', path: [0] });
  assert.equal(view(g, 0).thrust, 1);
  assert.equal(attempt(g, { type: 'move', ship: '1b', path: [0] }).why, 'not enough thrust');
  g = end(end(end(g)));
  assert.equal(view(g, 0).thrust, 4, '1 banked + 3 new: now both ships can move');
  // the optional rule: no movement at all until the fleet has a full hex per segment banked
  const strict = structuredClone(shippedFiles().world); strict.movement.needs_average_of = 1;
  let s = battle({ ...fleets, world: strict }).game;
  assert.equal(view(s, 0).canMove, false);
  assert.equal(attempt(s, { type: 'move', ship: '1a', path: [0] }).ok, false);
  s = end(end(end(s)));
  assert.equal(view(s, 0).canMove, true);
});

test('movement: thrust is shared, so one ship can take more than its share', () => {
  const two = (name, at, flagship) => ({ name, at, flagship, hull: [{ at: [0, 0], bays: ['core', 'engine', 'engine'] }, { at: [1, 0], bays: ['coupling', 'engine', 'engine'] }] });
  let { game: g, problems } = battle({ p1: [two('A', [0, 5], true), two('B', [0, 7], false)], p2: [scout('X', [0, -8])] });
  assert.deepEqual(problems, []);
  const v = view(g, 0);
  assert.deepEqual([v.income, v.segments, v.moveCap], [8, 4, 3], '8 engines / 4 segments = 2, so a ship may move up to 3');
  g = apply(g, { type: 'move', ship: '1a', path: [0, 0, 0] });
  assert.equal(view(g, 0).thrust, 2);
  g = apply(g, { type: 'move', ship: '1b', path: [0] });
  assert.equal(view(g, 0).thrust, 0);
  assert.equal(attempt(g, { type: 'move', ship: '1b', path: [0] }).why, 'not enough thrust');
  g = end(end(end(g)));
  assert.equal(view(g, 0).thrust, 8, 'nothing was left to bank');
});

test('movement is refused off the board, through asteroids and through known ships', () => {
  let { game: g } = battle({ radius: 5, terrain: [{ type: 'asteroid', at: [1, 4], size: 1 }], p1: [scout('A', [0, 4]), { ...scout('B', [-1, 4]), flagship: false }], p2: [scout('X', [0, -4])] });
  assert.equal(attempt(g, { type: 'move', ship: '1a', path: [0] }).why, 'an asteroid is in the way');
  assert.equal(attempt(g, { type: 'move', ship: '1a', path: [3] }).why, 'another ship is in the way');
  assert.equal(attempt(g, { type: 'move', ship: '1a', path: [5, 5] }).why, 'that would leave the board');
  assert.ok(reach(g, '1a').every((r) => hex.key(r.at) !== '1,4' && hex.key(r.at) !== '-1,4'));
});

test('damage peels a segment from the outside in: shield, armour, weapons, bays, engines, core', () => {
  const { game: g } = battle({ p1: [pod('A', [0, 3], ['core', 'engine', 'sensor'], ['shield', 'armour', 'laser'])], p2: [scout('X', [0, -3])] });
  const s = ship(g, '1a'), hp = () => Object.fromEntries(s.segs[0].parts.map((p) => [p.t, p.hp]));
  applyHits(g, s, 0, 1, 'test'); assert.equal(hp().shield, 0);
  applyHits(g, s, 0, 2, 'test'); assert.equal(hp().armour, 0); assert.equal(hp().laser, 1);
  applyHits(g, s, 0, 1, 'test'); assert.equal(hp().laser, 0); assert.equal(hp().sensor, 1);
  applyHits(g, s, 0, 1, 'test'); assert.equal(hp().sensor, 0); assert.equal(hp().engine, 1);
  assert.equal(s.dead, true, 'only engines and the core are left, so the ship is dead');
});

test('a hit with nothing left to damage wrecks the segment; losing the core kills the ship', () => {
  const { game: g } = battle({ p1: [{ name: 'A', at: [0, 3], flagship: true, hull: [{ at: [0, 0], bays: ['core', 'sensor'] }, { at: [1, 0], bays: ['coupling'] }] }], p2: [scout('X', [0, -3])] });
  const s = ship(g, '1a');
  applyHits(g, s, 1, 1, 'test'); assert.equal(s.segs[1].wrecked, false);
  applyHits(g, s, 1, 1, 'test'); assert.equal(s.segs[1].wrecked, true);
  assert.equal(s.dead, false);
  applyHits(g, s, 0, 2, 'test');
  assert.equal(s.dead, true);
});

test('detection: sensor + signature decides who sees whom, and stealth stops at a floor', () => {
  const quiet = pod('Q', [0, 0], ['core', 'stealth', 'stealth']);
  const { game: g } = battle({ p1: [scout('A', [0, 6])], p2: [quiet] });
  const a = ship(g, '1a'), q = ship(g, '2a');
  assert.equal(sensorOf(g, a), 4);
  assert.equal(signatureOf(g, q), 1, '1 segment: 2 stealth parts cannot take it below its floor of 1');
  assert.deepEqual(sigBreak(g, q), { base: 1, stealth: 2, used: 0, floor: 1, hull: 1, haze: 0, flare: 0, motion: 0, total: 1 });
  assert.equal(visibleTo(g, 0).has('2a'), false, 'range 6 needs sensor 4 + signature 1 = 5');
  q.pos = [0, 4];
  assert.equal(visibleTo(g, 0).has('2a'), true);
  assert.equal(signatureOf(g, a), 0, 'the scout has not moved yet this turn, so it runs silent: 1 - 1');
  assert.equal(visibleTo(g, 1).has('1a'), true, 'the quiet ship has only its core sensor (2): 2 hexes <= 2 + 0');
});

test('stealth from motion: sitting still hides a ship a little, a big move leaves a wake', () => {
  let { game: g } = battle({ radius: 12, p1: [pod('A', [0, 6], ['core', 'engine', 'engine'])], p2: [scout('X', [0, -6])] });
  const det = g.rules.det;
  assert.equal(signatureOf(g, ship(g, '1a')), 1 + det.stillSig, 'has not moved or acted this turn');
  g = apply(g, { type: 'move', ship: '1a', path: [2] });
  assert.equal(signatureOf(g, ship(g, '1a')), 1, 'a 1-hex move: no bonus, no wake');
  g = apply(g, { type: 'move', ship: '1a', path: [2] });
  assert.equal(signatureOf(g, ship(g, '1a')), 1 + det.wakeSig, '2 hexes from where it started: engine wake');
});

test('fuzzy contacts sit in a circle that does not move while the target sits still', () => {
  const { game: g } = battle({ radius: 12, p1: [scout('A', [0, 6])], p2: [scout('X', [0, -1])] });
  const d = hex.dist([0, 6], [0, -1]);
  const exact = detectRange(g, ship(g, '1a'), ship(g, '2a'));
  assert.ok(d > exact && d <= passiveRange(g, ship(g, '1a'), ship(g, '2a')), 'just outside exact range, inside the fuzzy band');
  const c1 = view(g, 0).contacts, c2 = view(g, 0).contacts;
  assert.equal(c1.length, 1);
  assert.deepEqual(c1, c2, 'looking again tells you nothing new');
  assert.ok(hex.dist(c1[0].at, ship(g, '2a').pos) <= c1[0].r, 'the target is inside its circle');
});

test('fog: a player view holds only what that player can see', () => {
  const { game: g } = battle({ radius: 12, p1: [scout('A', [0, 10])], p2: [scout('X', [0, -10])] });
  assert.equal(view(g, 0).ships.length, 1);
  assert.equal(view(g, 'all').ships.length, 2);
  const g2 = structuredClone({ ...g, rules: undefined }); g2.rules = g.rules;
  ship(g2, '2a').pos = [0, 6];
  const seen = view(start(g.rules, 1), 0);        // fresh game: still hidden
  assert.equal(seen.ships.length, 1);
  const { game: near } = battle({ radius: 12, p1: [scout('A', [0, 4])], p2: [scout('X', [0, 0])] });
  const v = view(near, 0), foe = v.ships.find((s) => !s.mine);
  assert.ok(foe, 'the enemy is in range');
  assert.equal(foe.name, null);
  assert.equal(foe.segs[0].parts, null, 'its parts stay hidden until scanned');
  assert.equal(attempt(near, { type: 'scan', ship: '1a' }).ok, false, 'a ship can only scan on a turn it has moved');
  const moved = apply(near, { type: 'move', ship: '1a', path: [0] });
  const scanned = view(apply(moved, { type: 'scan', ship: '1a' }), 0).ships.find((s) => !s.mine);
  assert.deepEqual(scanned.segs[0].parts.map((p) => p.t), ['core', 'engine', 'sensor', 'laser']);
  assert.equal(scanned.tier, 3, 'a fresh scan gives the full readout');
});

test('scans get stronger the further forward the ship is', () => {
  const f = shippedFiles();
  const { rules } = buildRules(f.world, f.map, f.fleets);
  const g = start(rules, 1), s = ship(g, '1a');
  const home = scanInfo(g, s);
  assert.equal(home.tier, 0);
  s.pos = [0, 0];
  const centre = scanInfo(g, s);
  assert.equal(centre.tier, 2);
  assert.ok(centre.r[0] > home.r[0] && centre.r[1] > home.r[1]);
});

test('lasers: range, falloff, asteroids, and firing lights the shooter up when it hits', () => {
  let { game: g } = battle({ terrain: [{ type: 'asteroid', at: [3, 0], size: 1 }], p1: [scout('A', [0, 2])], p2: [pod('X', [0, -1], ['core', 'engine', 'sensor'], ['armour'])], extra2: [] });
  const shots = beamTargets(g, '1a');
  assert.equal(shots.length, 1);
  assert.equal(shots[0].hits, 2);
  g = apply(g, { type: 'fire', ship: '1a', seg: shots[0].seg, part: shots[0].part, at: shots[0].at });
  assert.equal(ship(g, '2a').segs[0].parts.find((p) => p.t === 'armour').hp, 0);
  assert.equal(attempt(g, { type: 'fire', ship: '1a', seg: 0, part: 3, at: [0, -1] }).why, 'that weapon has already fired this turn');
  assert.equal(signatureOf(g, ship(g, '1a')), 1 + 3, 'a hit adds flare 3');
  // far target: one hit only; blocked target: refused
  let far = battle({ p1: [scout('A', [0, 3])], p2: [scout('X', [0, -2])] }).game;
  assert.equal(beamTargets(far, '1a')[0].hits, 1);
  let blocked = battle({ terrain: [{ type: 'asteroid', at: [0, 0], size: 1 }], p1: [scout('A', [0, 2])], p2: [scout('X', [0, -2])] }).game;
  assert.equal(beamTargets(blocked, '1a').length, 0);
  assert.equal(attempt(blocked, { type: 'fire', ship: '1a', seg: 0, part: 3, at: [0, -2] }).why, 'an asteroid blocks the line of fire');
});

const carrier = (name, at, more = {}) => ({ name, at, flagship: true, hull: [{ at: [0, 0], bays: ['core', 'magazine', 'sensor'], mounts: ['launcher'] }], load: { missile: 2, seeker_drone: 1 }, ...more });

test('a locked missile flies to its target in the flight phase and does 3 hits', () => {
  let { game: g } = battle({ p1: [carrier('C', [0, 3])], p2: [pod('X', [0, -2], ['core', 'engine', 'sensor'], ['armour', 'laser'])] });
  const opt = launchOptions(g, '1a');
  assert.deepEqual(opt.locks, ['2a']);
  g = apply(g, { type: 'launch', ship: '1a', kind: 'missile', start: [0, 2], target: '2a', route: [] });
  assert.equal(ship(g, '1a').load.missile, 1);
  assert.equal(attempt(g, { type: 'launch', ship: '1a', kind: 'missile', start: [0, 2], target: '2a', route: [] }).why, 'this ship has no launcher ready');
  g = end(g);
  assert.ok(view(g, 1).objs.some((o) => o.kind === 'missile'), 'the defender can see it coming');
  g = end(g);
  assert.equal(g.round, 2);
  assert.equal(g.objs.length, 0);
  const parts = ship(g, '2a').segs[0].parts;
  assert.equal(parts.find((p) => p.t === 'armour').hp, 0);
  assert.equal(parts.find((p) => p.t === 'laser').hp, 0);
  assert.equal(parts.find((p) => p.t === 'sensor').hp, 1);
});

test('point defence stops one missile a round and lights the ship up', () => {
  let { game: g } = battle({ p1: [carrier('C', [0, 3])], p2: [pod('X', [0, -2], ['core', 'engine', 'sensor'], ['point_defence', 'armour'])] });
  g = apply(g, { type: 'launch', ship: '1a', kind: 'missile', start: [0, 2], target: '2a', route: [] });
  g = end(end(g));
  assert.equal(g.objs.length, 0);
  assert.equal(ship(g, '2a').segs[0].parts.find((p) => p.t === 'armour').hp, 2, 'no damage got through');
  assert.ok(g.players[0].feed.some((e) => e.t === 'stopped'));
});

test('an unlocked missile follows its route, then finds prey with its own seeker', () => {
  let { game: g } = battle({ radius: 12, p1: [pod('C', [0, 8], ['core', 'magazine'], ['launcher'], { load: { missile: 1 } })], p2: [scout('X', [0, 0])] });
  assert.equal(visibleTo(g, 0).has('2a'), false, 'the launcher cannot see the target');
  assert.equal(attempt(g, { type: 'launch', ship: '1a', kind: 'missile', start: [0, 7], target: '2a', route: [] }).why, 'this ship cannot see that target');
  g = apply(g, { type: 'launch', ship: '1a', kind: 'missile', start: [0, 7], target: null, route: [2, 2, 2, 2] });
  g = end(end(g));
  assert.equal(g.objs.length, 1, 'still flying after one round');
  g = end(end(g));
  assert.equal(g.objs.length, 0, 'it found the ship and exploded');
  assert.ok(ship(g, '2a') === undefined || ship(g, '2a').segs[0].parts.some((p) => p.hp === 0));
  assert.equal(attempt(battle({ p1: [carrier('C', [0, 3])], p2: [scout('X', [0, -3])] }).game, { type: 'launch', ship: '1a', kind: 'missile', start: [0, 2], target: null, route: [0, 3] }).why, 'that route turns too sharply');
});

test('a mine goes off under a ship that moves onto it and stops the move', () => {
  let { game: g } = battle({ p1: [pod('A', [0, 5], ['core', 'engine', 'engine'], ['armour'])], p2: [scout('X', [0, -6])], extra2: [{ mine: [0, 3] }] });
  assert.equal(view(g, 0).objs.length, 0, 'the mine is hidden: the ship has only its core sensor');
  g = apply(g, { type: 'move', ship: '1a', path: [2, 2] });
  const s = g.ships.find((x) => x.id === '1a');
  assert.deepEqual(s.pos, [0, 3], 'the move stopped on the mine');
  assert.equal(s.segs[0].parts.find((p) => p.t === 'armour').hp, 0);
  assert.equal(g.objs.length, 0);
});

test('running into an unseen ship stops the move and reveals both', () => {
  let { game: g } = battle({ p1: [pod('A', [0, 2], ['core', 'engine', 'engine'])], p2: [pod('Q', [0, 0], ['core', 'stealth', 'stealth'])] });
  ship(g, '2a').segs[0].parts.push({ t: 'stealth', hp: 1 }, { t: 'stealth', hp: 1 });
  ship(g, '1a').segs[0].parts.find((p) => p.t === 'core').hp = 1;
  g.rules.parts.core = { ...g.rules.parts.core, sensor_range: 0 };   // a blind ship: it cannot see even next door
  g.players[0].vis = [];
  assert.equal(visibleTo(g, 0).has('2a'), false);
  g = apply(g, { type: 'move', ship: '1a', path: [2, 2] });
  assert.deepEqual(ship(g, '1a').pos, [0, 1]);
  assert.equal(visibleTo(g, 0).has('2a'), true);
  assert.equal(view(g, 0).thrust, 2 - 1, 'only the hex actually moved is paid for');
});

test('destroying the flagship wins the game', () => {
  let { game: g } = battle({ p1: [scout('A', [0, 1])], p2: [pod('X', [0, 0], ['core'])] });
  g = apply(g, { type: 'fire', ship: '1a', seg: 0, part: 3, at: [0, 0] });
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 0);
  assert.throws(() => apply(g, { type: 'end' }), /over/);
});

test('command points bank up to the cap', () => {
  let { game: g } = battle({ p1: [scout('A', [0, 6])], p2: [scout('X', [0, -6])] });
  assert.equal(view(g, 0).cp, 3);
  for (let i = 0; i < 6; i++) g = end(g);
  assert.equal(view(g, g.order[g.turn]).cp, 3 + 6);
});

// ---- two devices, kept in step by turn codes ----
function randomTurn(g, pick) {
  const p = g.order[g.turn];
  for (const s of g.ships.filter((x) => !x.dead && x.owner === p)) {
    if (g.phase !== 'play') break;
    const shots = beamTargets(g, s.id);
    if (shots.length && pick(3)) { const t = shots[pick(shots.length)]; g = apply(g, { type: 'fire', ship: s.id, seg: t.seg, part: t.part, at: t.at }); if (g.phase !== 'play') break; }
    const lo = launchOptions(g, s.id);
    if (lo && pick(2)) {
      const kind = lo.kinds[pick(lo.kinds.length)], st = lo.starts[pick(lo.starts.length)];
      const lock = g.rules.munitions[kind].seeker_range && lo.locks.length ? lo.locks[pick(lo.locks.length)] : null;
      g = apply(g, { type: 'launch', ship: s.id, kind, start: st, target: lock, route: lock ? [] : [pick(6)] });
    }
    const spots = reach(g, s.id);
    if (spots.length && pick(4)) g = apply(g, { type: 'move', ship: s.id, path: spots[pick(spots.length)].path });
    if (g.phase !== 'play') break;
    const foes = view(g, p).ships.filter((x) => !x.mine);
    const st = shipStatus(g, s.id);
    if (st && st.scanReady && !pick(4)) g = apply(g, { type: 'scan', ship: s.id });
  }
  const drone = g.objs.find((o) => o.owner === p && g.rules.munitions[o.kind].remote_detonate);
  if (g.phase === 'play' && drone && !pick(5) && g.players[p].cp >= 1) g = apply(g, { type: 'detonate', obj: drone.id });
  return g.phase === 'play' ? apply(g, { type: 'end' }) : g;
}

test('two devices stay identical through whole random games, passing only turn codes', async () => {
  const big = (name, at, flagship) => ({ name, at, flagship, load: { missile: 2, seeker_drone: 1 }, hull: [
    { at: [0, 0], bays: ['core', 'magazine', 'sensor'], mounts: ['launcher', 'shield'] },
    { at: [1, 0], bays: ['engine', 'engine', 'coupling'], mounts: ['laser', 'armour', 'point_defence'] },
    { at: [0, 1], bays: ['engine', 'engine', 'coupling'], mounts: ['laser'] }] });
  let finished = 0, turns = 0;
  for (let seed = 1; seed <= 12; seed++) {
    let n = seed * 7919;
    const pick = (k) => { n = (Math.imul(n, 1103515245) + 12345) >>> 0; return (n >>> 8) % k; };
    const { rules, problems } = battle({ radius: 7, terrain: [{ type: 'asteroid', at: [2, 0], size: 1 }, { type: 'nebula', at: [-3, 0], radius: 1 }],
      p1: [big('A', [0, 4], true), { ...scout('S', [-3, 5]), flagship: false }], p2: [big('X', [0, -4], true), { ...scout('T', [3, -5]), flagship: false }],
      extra1: [{ mine: [1, 2] }], extra2: [{ mine: [-1, -2] }], seed });
    assert.deepEqual(problems, []);
    let a = start(rules, seed);
    let b = await importGame(await exportGame(a));      // device B starts from a game code
    assert.equal(hashState(a), hashState(b));
    for (let t = 0; t < 80 && a.phase === 'play'; t++) {
      a = randomTurn(a, pick);
      const code = turnCode(a);
      assert.match(code, /^SK1:[0-9]+:[12]:[0-9a-z]+:[A-Za-z0-9.-]*:[0-9a-z]+$/);
      b = applyTurnCode(b, code);
      assert.equal(hashState(a), hashState(b), 'seed ' + seed + ' turn ' + t);
      turns++;
    }
    if (a.phase === 'over') finished++;
    assert.equal(b.phase, a.phase);
    assert.equal(b.winner, a.winner);
  }
  assert.ok(turns > 100);
  assert.ok(finished >= 1, 'at least one random game should reach a result (finished ' + finished + ')');
});

test('a turn code for the wrong moment, or one that has been altered, is refused', async () => {
  let { game: a } = battle({ p1: [scout('A', [0, 6])], p2: [scout('X', [0, -6])] });
  let b = await importGame(await exportGame(a));
  a = apply(a, { type: 'move', ship: '1a', path: [2] });
  a = end(a);
  const code = turnCode(a);
  assert.ok(!code.includes('m1a'), 'the moves cannot be read by eye');
  const parts = code.split(':');
  assert.throws(() => applyTurnCode(b, [...parts.slice(0, 5), '0000000'].join(':')), /replayed differently/);
  assert.throws(() => applyTurnCode(b, ['SK1', '3', parts[2], ...parts.slice(3)].join(':')), /round 3/);
  b = applyTurnCode(b, '  ' + code.slice(0, 9) + '\n' + code.slice(9) + ' ');     // pasted with stray spaces and a line break
  assert.equal(hashState(a), hashState(b));
  assert.throws(() => applyTurnCode(b, code), /waiting for/);
});

test('the same seed always plays out the same way', () => {
  const run = (seed) => {
    let { game: g } = battle({ p1: [carrier('C', [0, 3])], p2: [pod('X', [0, -2], ['core', 'engine', 'sensor'], ['armour', 'laser', 'shield'])], seed });
    g = apply(g, { type: 'launch', ship: '1a', kind: 'seeker_drone', start: [0, 2], target: null, route: [] });
    for (let i = 0; i < 6; i++) g = end(g);
    return hashState(g);
  };
  assert.equal(run(5), run(5));
  assert.notEqual(run(5), run(6));
});

test('a game code taken in the middle of a turn still lines up with that turn\'s code', async () => {
  let { game: a } = battle({ p1: [scout('A', [0, 6])], p2: [scout('X', [0, -6])] });
  a = apply(a, { type: 'move', ship: '1a', path: [2] });
  let b = await importGame(await exportGame(a));       // sent after the first action
  a = end(a);
  b = applyTurnCode(b, turnCode(a));
  assert.equal(hashState(a), hashState(b));
  assert.deepEqual(b.ships[0].pos, [0, 5]);
});

test('the game explains why something came into view and why it was lost', () => {
  let { game: g } = battle({ radius: 12, p1: [pod('A', [0, 6], ['core', 'engine', 'sensor'])], p2: [pod('X', [0, 0], ['core', 'engine', 'engine'], ['laser'])] });
  assert.equal(view(g, 0).ships.length, 1);
  g = apply(g, { type: 'move', ship: '1a', path: [2] });
  const seen = g.players[0].feed.find((e) => e.t === 'sighted');
  assert.deepEqual([seen.why.by, seen.why.d, seen.why.range, seen.why.sig], ['1a', 5, 4, 1]);
  assert.deepEqual(view(g, 0).ships.find((s) => !s.mine).why.by, '1a');
  g = end(g);
  g = apply(g, { type: 'move', ship: '2a', path: [2] });
  const lost = g.players[0].feed.find((e) => e.t === 'lost');
  assert.equal(lost.faded, false, 'it moved away; nothing faded');
  assert.equal(view(g, 0).ghosts.length, 1, 'a last-seen marker stays behind');
});

test('ship status and missile forecasts tell the player what to expect', () => {
  let { game: g } = battle({ p1: [carrier('C', [0, 3])], p2: [pod('X', [0, -2], ['core', 'engine', 'sensor'], ['armour'])] });
  let st = shipStatus(g, '1a');
  assert.deepEqual([st.launchers, st.launchersReady, st.ammo.missile, st.beams], [1, 1, 2, 0]);
  const plan = forecast(g, { type: 'launch', ship: '1a', kind: 'missile', start: [0, 2], target: '2a', route: [] });
  assert.deepEqual([plan.ends, plan.hit, plan.path.length, plan.rounds], ['hit', '2a', 4, 1]);
  g = apply(g, { type: 'launch', ship: '1a', kind: 'missile', start: [0, 2], target: '2a', route: [] });
  st = shipStatus(g, '1a');
  assert.deepEqual([st.launchersReady, st.ammo.missile], [0, 1]);
  const flying = forecast(g, g.objs[0].id);
  assert.equal(flying.hit, '2a');
  const blind = forecast(g, { type: 'launch', ship: '1a', kind: 'missile', start: [1, 3], target: null, route: [0] });
  assert.equal(blind.ends, 'edge');
});

test('the computer only plays legal moves and games against itself finish', () => {
  const f = shippedFiles();
  const { rules } = buildRules(f.world, f.map, f.fleets);
  for (const seed of [1, 2, 3]) {
    let g = start(rules, seed), steps = 0;
    while (g.phase === 'play' && steps < 2000) {
      const seat = g.order[g.turn];
      const a = computerMove(g, seat, seed === 3 ? 'easy' : 'normal');
      assert.ok(a, 'it always has an action on its own turn');
      const r = attempt(g, a);
      assert.ok(r.ok, 'illegal action ' + JSON.stringify(a) + ': ' + r.why);
      g = r.state; steps++;
    }
    assert.equal(g.phase, 'over', 'seed ' + seed + ' finished');
    // not its turn: no action
    assert.equal(computerMove(g, 0), null);
  }
});

test('losing a magazine reports how many munitions went with it', () => {
  const { game, problems } = battle({
    p1: [pod('Hauler', [0, 3], ['core', 'magazine', 'magazine'], ['launcher'], { load: { missile: 5 } })],
    p2: [scout('Picket', [0, -3])],
  });
  assert.deepEqual(problems, []);
  const g = structuredClone(game);
  g.rules = game.rules;
  g.events = [];
  const ship = g.ships.find((s) => s.name === 'Hauler');
  applyHits(g, ship, 0, 2); // the launcher (outer layer) goes first, then one magazine
  const ev = g.events.find((e) => e.t === 'ammo_lost');
  assert.ok(ev, 'an ammo_lost event was sent');
  assert.equal(ev.count, 2, '5 missiles, room left for 3: 2 lost');
  assert.equal(ship.load.missile, 3);
});
