// Rapid mode (engine/rapid.js, rules/rapid/rapid_opus.yaml): one action a side per tick, resolved together.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readYaml, shippedFiles, battle, pod } from './helpers.js';
import * as E from '../engine/index.js';

const board = () => {
  const b = readYaml('rules/rapid/rapid_opus.yaml');
  const { rules, problems } = E.buildRules(shippedFiles().world, b, b);
  return { b, rules, problems };
};
const rapidGame = (opts = {}, seed = 5) => { const { b, rules } = board(); return E.rapidStart(E.rapidRules({ ...rules, rapid: b.rapid }, opts), seed); };
// a small fight on an empty radius-12 board, in rapid mode
function small(p1, p2, opts = {}) {
  const { rules } = battle({ radius: 12, p1, p2 });
  return E.rapidStart(E.rapidRules(rules, opts), 3);
}
const PASS = { type: 'pass' };
const two = (g) => E.forcedMoves(g, 1)[0] || PASS;   // player 2 just walks forward

test('the rapid board loads with no problems: 14 ships a side, nothing touching, player 2 turned round', () => {
  const { problems } = board();
  assert.deepEqual(problems, []);
  const g = rapidGame();
  assert.equal(g.ships.filter((s) => s.owner === 0).length, 14);
  assert.equal(g.ships.filter((s) => s.owner === 1).length, 14);
  const mine = g.ships.filter((s) => s.owner === 0);
  for (const a of mine) for (const b of mine) if (a !== b) assert.ok(E.gap(a, b) >= 2, a.name + ' touches ' + b.name);
  for (const s of mine) {
    const t = g.ships.find((x) => x.owner === 1 && x.name === s.name);
    assert.deepEqual(t.pos, [-s.pos[0] || 0, -s.pos[1] || 0]);
  }
  assert.equal(g.ships.filter((s) => s.flagship && s.segs.length === 7).length, 2);
});

test('rapid rules: missiles fly a third as far a tick but three times as long; one point, no bank', () => {
  const g = rapidGame();
  assert.equal(g.rules.munitions.missile.speed, 2);
  assert.equal(g.rules.munitions.missile.fuel, 9);
  assert.equal(g.rules.cp.perTurn, 1);
  assert.equal(g.rules.cp.bankCap, 0);
  assert.equal(g.rules.turnLimit, E.RAPID_DEFAULTS.cap);
  assert.deepEqual(E.forwardDirs(g, 0), [1, 2]);    // north-east, north-west for the south side
  assert.deepEqual(E.forwardDirs(g, 1), [4, 5]);
});

test('forward only: before crossing, a ship cannot step back or sideways and the side cannot pass', () => {
  const g = rapidGame();
  const pawn = g.ships.find((s) => s.owner === 0 && s.name === 'Pawn A');
  assert.match(E.rapidRefusal(g, 0, { type: 'move', ship: pawn.id, path: [5] }), /forward only/);
  assert.match(E.rapidRefusal(g, 0, { type: 'move', ship: pawn.id, path: [0] }), /forward only/);
  assert.equal(E.rapidRefusal(g, 0, { type: 'move', ship: pawn.id, path: [2] }), null);
  assert.match(E.rapidRefusal(g, 0, PASS), /must act/);
  // the screen's move markers agree
  const firsts = [...new Set(E.legalMoves(g, 0).filter((a) => a.ship === pawn.id).flatMap((a) => a.path))].sort();
  assert.deepEqual(firsts, [1, 2]);
  // a time-out never picks the flagship while an escort can go
  assert.ok(E.forcedMoves(g, 0).every((a) => !g.ships.find((s) => s.id === a.ship).flagship));
});

test('crossing the line frees the side: any direction, passing and scanning (while holding, by default)', () => {
  const scoutHull = [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser'] }];
  let g = small([pod('Flag', [0, 12], ['core', 'engine'], ['laser'], { hull: scoutHull }), { name: 'Run', at: [3, 1], hull: scoutHull }],
    [pod('Flag2', [0, -12], ['core', 'engine'], ['laser'], { hull: scoutHull })], { line: 12 });
  const run = g.ships.find((s) => s.name === 'Run');
  assert.equal(E.unlocked(g, 0), false);
  assert.match(E.rapidRefusal(g, 0, { type: 'scan', ship: run.id }), /past the line/);
  g = E.rapidTick(g, [{ type: 'move', ship: run.id, path: [2] }, two(g)]);   // [3,1] -> [3,0]: on the centre row
  const r2 = g.ships.find((s) => s.name === 'Run');
  assert.deepEqual(r2.pos, [3, 0]);
  assert.equal(E.pastLine(g, r2), true);
  assert.equal(E.unlocked(g, 0), true);
  assert.equal(E.rapidRefusal(g, 0, PASS), null);
  assert.equal(E.rapidRefusal(g, 0, { type: 'scan', ship: r2.id }), null);
  const flag = g.ships.find((s) => s.name === 'Flag');
  assert.match(E.rapidRefusal(g, 0, { type: 'scan', ship: flag.id }), /past the line/);   // only ships past it scan
  assert.equal(E.rapidRefusal(g, 0, { type: 'move', ship: r2.id, path: [5] }), null);     // back is fine now
  // holding: step back behind the line and the side is locked again
  g = E.rapidTick(g, [{ type: 'move', ship: r2.id, path: [5] }, two(g)]);
  assert.equal(E.unlocked(g, 0), false);
  // permanent: once crossed, free for good
  let p = small([pod('Flag', [0, 12], ['core', 'engine'], ['laser'], { hull: scoutHull }), { name: 'Run', at: [3, 1], hull: scoutHull }],
    [pod('Flag2', [0, -12], ['core', 'engine'], ['laser'], { hull: scoutHull })], { unlock: 'permanent' });
  const pr = p.ships.find((s) => s.name === 'Run');
  p = E.rapidTick(p, [{ type: 'move', ship: pr.id, path: [2] }, two(p)]);
  p = E.rapidTick(p, [{ type: 'move', ship: pr.id, path: [5] }, two(p)]);
  assert.equal(E.unlocked(p, 0), true);
});

test('both sides act at once: two ships that shoot each other in the same tick are both hit', () => {
  const frail = (name, at) => ({ name, at, flagship: true, hull: [{ at: [0, 0], bays: ['core', 'engine'], mounts: ['laser'] }] });
  let g = small([frail('A', [0, 2])], [frail('B', [0, -1])], { scan: 'always' });
  const a = g.ships.find((s) => s.owner === 0), b = g.ships.find((s) => s.owner === 1);
  // they see each other at 3 hexes
  const fa = E.autoFire(g, 0, a.id), fb = E.autoFire(g, 1, b.id);
  assert.ok(fa && fb, 'both have a shot');
  g = E.rapidTick(g, [fa, fb]);
  const dmg = g.events.filter((e) => e.t === 'damage').map((e) => e.ship).sort();
  assert.deepEqual(dmg, [a.id, b.id]);
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 'draw');   // both flagships fell in the same tick
});

test('sighted launches need a lock on a ship the fleet can see; blind launches go anywhere', () => {
  const g = rapidGame();
  const flag = g.ships.find((s) => s.owner === 0 && s.flagship);
  const blindShot = E.aimLaunch(g, flag.id, 'missile', [0, -10]);
  assert.ok(blindShot);
  assert.match(E.rapidRefusal(g, 0, blindShot), /sighted launches only/);
  const g2 = rapidGame({ launch: 'blind' });
  const f2 = g2.ships.find((s) => s.owner === 0 && s.flagship);
  assert.equal(E.rapidRefusal(g2, 0, E.aimLaunch(g2, f2.id, 'missile', [0, -10])), null);
});

test('the computer plays a whole rapid game without an illegal action', () => {
  let g = rapidGame({ cap: 80 }, 11);
  let seed = 9;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let fights = 0;
  while (g.phase === 'play') {
    const a0 = E.rapidAI(g, 0, 'normal', rnd), a1 = E.rapidAI(g, 1, 'easy', rnd);
    assert.equal(E.rapidRefusal(g, 0, a0), null, JSON.stringify(a0));
    assert.equal(E.rapidRefusal(g, 1, a1), null, JSON.stringify(a1));
    g = E.rapidTick(g, [a0, a1]);
    if (g.events.some((e) => e.t === 'damage')) fights++;
  }
  assert.ok(g.round > 10);
  assert.ok(fights > 0, 'the fleets met');
  assert.ok(g.rapid.ticks.length >= 10);
  // the battle log lists ticks without trying to replay them
  const log = E.battleLog(g, { seat: 'cpu' });
  assert.ok(log.turns.length >= 2);
});

test('the opening: 2-hex moves and the short clock until the first shot, and its ticks are free', () => {
  let g = rapidGame({ cap: 5 });
  assert.equal(E.inOpening(g), true);
  assert.equal(E.stride(g), 2);
  const pawn = g.ships.find((s) => s.owner === 0 && s.name === 'Pawn A');
  assert.equal(E.rapidRefusal(g, 0, { type: 'move', ship: pawn.id, path: [2, 2] }), null);
  assert.match(E.rapidRefusal(g, 0, { type: 'move', ship: pawn.id, path: [2, 5] }), /forward only/);
  // a time-out takes the full 2 hexes
  assert.ok(E.forcedMoves(g, 0).every((a) => a.path.length === 2));
  // eight ticks of walking: past the 5-tick limit, but opening ticks don't count
  for (let i = 0; i < 8; i++) g = E.rapidTick(g, [E.forcedMoves(g, 0)[0], E.forcedMoves(g, 1)[0]]);
  assert.equal(g.phase, 'play');
  assert.equal(g.rapid.openTicks, 8);
  // the first shot (or launch) ends the opening: back to 1 hex
  const flag = g.ships.find((s) => s.owner === 0 && s.flagship);
  const shot = E.autoLaunch({ ...g, rules: { ...g.rules, rapid: { ...g.rules.rapid, launch: 'blind' } } }, 0, flag.id, 'missile_basic') ||
    E.aimLaunch({ ...g, rules: { ...g.rules, rapid: { ...g.rules.rapid, launch: 'blind' } } }, flag.id, 'missile_basic', [0, 0]);
  const blind = { ...g, rules: { ...g.rules, rapid: { ...g.rules.rapid, launch: 'blind' } } };
  g = E.rapidTick(blind, [shot, E.forcedMoves(blind, 1)[0]]);
  assert.equal(E.inOpening(g), false);
  assert.equal(E.stride(g), 1);
  // 'off' keeps every move at one hex from the start
  assert.equal(E.stride(rapidGame({ stride: 'off' })), 1);
});

test('a rapid battle log replays the game tick by tick: hits and sightings are in it', () => {
  let g = rapidGame({ cap: 40 }, 21);
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  while (g.phase === 'play') g = E.rapidTick(g, [E.rapidAI(g, 0, 'normal', rnd), E.rapidAI(g, 1, 'normal', rnd)]);
  const log = E.battleLog(g, { seat: 'cpu' });
  assert.equal(log.replayable, true, log.note);
  const evs = log.turns.flatMap((t) => t.actions.flatMap((a) => a.events || []));
  assert.ok(evs.some((e) => e.t === 'damage'));
  assert.ok(evs.some((e) => e.t === 'sighted'));
  assert.ok(log.replay && log.replay.rapid && log.replay.rapid.length === g.rapid.ticks.length);
});

test('missiles: shot down only up close, and close-in debris hits and lights up the shooter', () => {
  const ship = (name, at, flagship) => ({ name, at, flagship, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser', 'armour', 'launcher'] }], load: { missile_basic: 0 } });
  let g = small([ship('A', [0, 6], true)], [ship('B', [0, -12], true)], { stride: 'off' });
  const a = g.ships.find((s) => s.owner === 0);
  // an enemy missile flying at A, 5 hexes off, then 2 hexes off
  const put = (st, at) => { const s2 = structuredClone({ ...st, rules: undefined }); s2.rules = st.rules;
    s2.objs.push({ id: 'o9', kind: 'missile_basic', owner: 1, pos: at, fuel: 9, target: a.id, route: [] }); return s2; };
  let far = put(g, [0, 1]);
  assert.ok(!E.beamTargets(far, a.id).some((t) => t.target === 'o9'), 'no shot at a missile 5 hexes off');
  let near = put(g, [0, 4]);
  const shot = E.beamTargets(near, a.id).find((t) => t.target === 'o9');
  assert.ok(shot, 'a shot at a missile 2 hexes off');
  near = E.rapidTick(near, [{ type: 'fire', ship: a.id, seg: shot.seg, part: shot.part, at: shot.at }, E.forcedMoves(near, 1)[0]]);
  assert.ok(near.events.some((e) => e.t === 'debris'));
  assert.ok(near.events.some((e) => e.t === 'damage' && e.ship === a.id && e.cause === 'debris'));
  assert.ok(E.view(near, 1).ships.some((x) => x.id === a.id), 'the enemy sees the shooter');
});

test('formation: a ship that fires lets a friend within 2 hexes move in the same tick; attack run is last tick', () => {
  const scout = (name, at, flagship) => ({ name, at, flagship, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser', 'shield', 'armour'] }] });
  let g = small([scout('A', [0, 2], true), scout('W', [2, 2]), scout('Far', [-6, 6])], [scout('B', [0, -2], true)], { stride: 'off', scan: 'always' });
  const A = g.ships.find((s) => s.name === 'A'), W = g.ships.find((s) => s.name === 'W'), Far = g.ships.find((s) => s.name === 'Far');
  const shot = E.autoFire(g, 0, A.id);
  assert.ok(shot);
  const wings = E.wingMoves(g, 0, A.id);
  assert.ok(wings.some((m) => m.ship === W.id) && !wings.some((m) => m.ship === Far.id));
  const wing = wings.find((m) => m.ship === W.id);
  assert.match(E.rapidRefusal(g, 0, { ...shot, wing: { type: 'move', ship: Far.id, path: [2] } }), /wingman/);
  const before = W.pos.join();
  g = E.rapidTick(g, [{ ...shot, wing }, two(g)]);
  assert.notEqual(g.ships.find((s) => s.id === W.id).pos.join(), before);
  assert.match(g.rapid.ticks[0].acts[0], /\+m/);
  assert.equal(g.rapid.movedLast[W.id], 1);
  // the log replays the wingman move
  const log = E.battleLog(g, { seat: 'cpu' });
  assert.equal(log.replayable, true);
});

test('going silent: a scout on or past the line can become a scanner buoy or a mine as it moves', () => {
  const scout = (name, at, flagship) => ({ name, at, flagship, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser', 'shield', 'armour'] }] });
  let g = small([scout('Flag', [0, 12], true), scout('S', [3, 1])], [scout('E', [3, -6], true)], { stride: 'off' });
  const S = g.ships.find((x) => x.name === 'S');
  assert.match(E.rapidRefusal(g, 0, { type: 'move', ship: g.ships.find((x) => x.name === 'Flag').id, path: [2], convert: 'mine' }), /go silent/);
  const mv = { type: 'move', ship: S.id, path: [2], convert: 'scanner' };   // [3,1] -> [3,0]: onto the line
  assert.equal(E.rapidRefusal(g, 0, mv), null);
  g = E.rapidTick(g, [mv, two(g)]);
  const gone = g.ships.find((x) => x.id === S.id);
  assert.ok(gone.dead && gone.converted === 'scanner');
  const buoy = g.objs.find((o) => o.kind === 'scan_buoy' && o.owner === 0);
  assert.deepEqual(buoy.pos, [3, 0]);
  assert.equal(g.rapid.ticks[0].acts[0], E.tickText(mv));
  // the buoy reads out the enemy flagship within 4 hexes (it is 6 off here, so a rough contact)... move it closer
  let h = g;
  for (let i = 0; i < 3 && h.phase === 'play'; i++) h = E.rapidTick(h, [E.forcedMoves(h, 0)[0] || { type: 'pass' }, { type: 'move', ship: h.ships.find((x) => x.owner === 1).id, path: [5] }]);
  const ev = h.ships.find((x) => x.owner === 1);
  assert.ok(E.view(h, 0).ships.some((x) => x.id === ev.id && x.tier === 3), 'buoy gives a full readout');
  // the log replays it
  assert.equal(E.battleLog(h, { seat: 'cpu' }).replayable, true);
});

test('shields come back in rapid mode even with no missiles in the air (3 ticks unhit)', () => {
  const ship = (name, at, flagship) => ({ name, at, flagship, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser', 'shield', 'armour'] }] });
  let g = small([ship('A', [0, 2], true)], [ship('B', [0, -1], true)], { stride: 'off', scan: 'always', wingman: 'off' });
  const a = g.ships.find((s) => s.owner === 0), b = g.ships.find((s) => s.owner === 1);
  g = E.rapidTick(g, [E.autoFire(g, 0, a.id), { type: 'pass' }].map((x, i) => i === 1 ? two(g) : x));
  const shieldOf = (st) => st.ships.find((s) => s.id === b.id).segs[0].parts.find((q) => q.t === 'shield').hp;
  assert.equal(shieldOf(g), 0);
  for (let i = 0; i < 4; i++) g = E.rapidTick(g, [{ type: 'pass' }, { type: 'pass' }].map((x, k) => (E.passAllowed(g, k) ? x : E.forcedMoves(g, k)[0])));
  assert.equal(shieldOf(g), 1);
});
