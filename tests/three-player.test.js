// Three players (docs/design/three-player.md): homes on any edge or corner, the centre ring,
// knock-outs, the flagship bounty, kill pay to the killer only, and the computer's choice of enemy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readYaml, shippedFiles } from './helpers.js';
import * as E from '../engine/index.js';
import { checkWin } from '../engine/damage.js';

const load = (name) => {
  const b = readYaml('rules/rapid/' + name + '.yaml');
  const { rules, problems } = E.buildRules(shippedFiles().world, b, b);
  return { b, rules, problems };
};
const game = (name, seed = 11, opts = {}) => { const { b, rules } = load(name); return E.rapidStart(E.rapidRules(rules, { ...b.rapid, ...opts }), seed); };
const PASS = { type: 'pass' };
const BOARDS = ['three_edges', 'three_corners'];

// A tiny three-sided fight: one-hex armed scouts (each its side's flagship) on an empty board.
function tri(at1, at2, at3, { radius = 8, rapid = {}, edges = ['south', 'north_west', 'north_east'] } = {}) {
  const w = structuredClone(shippedFiles().world);
  const side = (at) => ({ ships: [{ name: 'S', flagship: true, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser', 'armour', 'armour'] }] }], deployment: [{ ship: 'S', at }] });
  const zones = Object.fromEntries(edges.map((e, i) => ['player_' + (i + 1) + '_home', { edge: e, depth: radius * 2 }]));
  const { rules, problems } = E.buildRules(w, { map: { board: { shape: 'hexagon', radius }, zones } }, { budget: 99999, player_1: side(at1), player_2: side(at2), player_3: side(at3) });
  assert.deepEqual(problems, []);
  return E.rapidStart(E.rapidRules(rules, { economy: 'on', ...rapid }), 3);
}

for (const name of BOARDS) {
  test(name + ': loads with no problems, 3 fleets of 8 ships (17 hexes), the copies turned round the centre', () => {
    const { problems } = load(name);
    assert.deepEqual(problems, []);
    const g = game(name);
    assert.equal(g.players.length, 3);
    for (const p of [0, 1, 2]) {
      const mine = g.ships.filter((s) => s.owner === p);
      assert.equal(mine.length, 8);
      assert.equal(mine.reduce((n, s) => n + s.segs.length, 0), 17);
      assert.equal(mine.filter((s) => s.flagship).length, 1);
    }
    for (const s of g.ships.filter((x) => x.owner === 0)) {
      assert.deepEqual(g.ships.find((x) => x.owner === 1 && x.name === s.name).pos, E.hex.rotate(s.pos, 2), s.name);
      assert.deepEqual(g.ships.find((x) => x.owner === 2 && x.name === s.name).pos, E.hex.rotate(s.pos, 4), s.name);
    }
  });

  test(name + ': every side starts at its home (progress low), the centre is the radius, nobody starts past the line', () => {
    const g = game(name), R = g.rules.board.radius;
    for (const p of [0, 1, 2]) {
      assert.equal(E.rowsForward(g, p, [0, 0]), R);
      for (const s of g.ships.filter((x) => x.owner === p)) {
        assert.ok(E.rowsForward(g, p, s.pos) < R / 2 + 1, s.id + ' starts too far forward');
        assert.ok(!E.pastLine(g, s), s.id + ' starts past the line');
      }
      assert.equal(E.unlocked(g, p), false);
    }
  });
}

test('forward is towards the centre: 2 directions from a flat edge, 3 from a corner', () => {
  const e = game('three_edges'), c = game('three_corners');
  for (const p of [0, 1, 2]) {
    assert.equal(E.forwardDirs(e, p).length, 2);
    assert.equal(E.forwardDirs(c, p).length, 3);
    for (const g of [e, c]) for (const d of E.forwardDirs(g, p)) assert.ok(E.rowsForward(g, p, E.hex.DIRS[d]) > E.rowsForward(g, p, [0, 0]));
  }
});

test('two-player boards are measured exactly as before (rows from the north or south edge)', () => {
  const b = readYaml('rules/rapid/rapid_opus.yaml');
  const { rules } = E.buildRules(shippedFiles().world, b, b);
  const g = E.rapidStart(E.rapidRules({ ...rules, rapid: b.rapid }), 5), R = g.rules.board.radius;
  assert.equal(g.out, undefined);
  assert.equal(g.lastHit, undefined);
  for (const c of E.hex.disc([0, 0], R)) {
    assert.equal(E.rowsForward(g, 0, c), R - c[1]);
    assert.equal(E.rowsForward(g, 1, c), R + c[1]);
  }
  assert.deepEqual(E.forwardDirs(g, 0), [1, 2]);
});

test('the centre ring: a ship inside it (or beyond the centre) is past the line and frees its side', () => {
  const g = tri([0, 3], [3, -6], [-6, 3], { rapid: { ring: 2 } });
  const s0 = g.ships.find((x) => x.owner === 0);
  assert.ok(!E.pastLine(g, s0));
  s0.pos = [0, 2]; assert.ok(E.pastLine(g, s0));          // on the ring
  s0.pos = [3, -1]; assert.ok(E.pastLine(g, s0));         // 3 from the centre, but beyond it (north of the centre row)
  s0.pos = [-3, 3]; assert.ok(!E.pastLine(g, s0));        // 3 from the centre, still on our side
});

test('a tick takes one action from each of the three sides, and all three happen', () => {
  let g = game('three_edges');
  const acts = [0, 1, 2].map((p) => E.forcedMoves(g, p)[0]);
  const before = acts.map((a) => g.ships.find((x) => x.id === a.ship).pos.join());
  g = E.rapidTick(g, acts);
  acts.forEach((a, i) => assert.notEqual(g.ships.find((x) => x.id === a.ship).pos.join(), before[i], 'side ' + (i + 1) + ' did not move'));
  assert.equal(g.rapid.ticks[0].acts.length, 3);
  assert.equal(g.history.slice(-3).map((h) => h.player).join(), '0,1,2');
});

test('a refused action names the side it came from', () => {
  const g = game('three_edges');
  assert.throws(() => E.rapidTick(g, [E.forcedMoves(g, 0)[0], E.forcedMoves(g, 1)[0], { type: 'move', ship: '3a', path: [0, 0, 0] }]), /player 3/);
});

test('knocked out: flagship gone, the other ships scuttle, its objects go, the killer takes its rekon plus the bounty', () => {
  const g = game('three_edges', 11, { bounty: 10 });
  g.econ.purse = [5, 7, 9];
  g.objs.push({ id: 'oX', kind: 'missile_basic', owner: 1, pos: [0, 3], dir: 0, fuel: 3, target: null, lock: false, route: [], src: null });
  const flag = g.ships.find((x) => x.owner === 1 && x.flagship);
  flag.dead = true; g.lastHit[flag.id] = 2;
  checkWin(g);
  assert.equal(g.phase, 'play');
  assert.deepEqual(g.out, [false, true, false]);
  assert.ok(g.ships.filter((x) => x.owner === 1).every((x) => x.dead));
  assert.ok(g.ships.filter((x) => x.owner === 1 && !x.flagship).every((x) => x.scuttled));
  assert.ok(!g.objs.some((o) => o.owner === 1));
  assert.deepEqual(g.econ.purse, [5, 0, 9 + 7 + 10]);
  const ev = g.events.find((e) => e.t === 'knocked_out');
  assert.equal(ev.player, 1); assert.equal(ev.by, 2); assert.equal(ev.bounty, 17);
  // an out side can only pass, and the tick goes on without it
  assert.match(E.rapidRefusal(g, 1, E.forcedMoves(g, 0)[0]) || '', /out of the game/);
  assert.equal(E.rapidRefusal(g, 1, PASS), null);
  assert.equal(E.rapidAI(g, 1).type, 'pass');
  const g2 = E.rapidTick(g, [E.forcedMoves(g, 0)[0], { type: 'move', ship: '2c', path: [0] }, E.forcedMoves(g, 2)[0]]);   // an out side's action is ignored
  assert.equal(g2.phase, 'play');
});

test('the last side standing wins; two flagships lost on the same tick with one left: that one wins', () => {
  const g = game('three_edges');
  for (const p of [1, 2]) g.ships.find((x) => x.owner === p && x.flagship).dead = true;
  checkWin(g);
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 0);
  const h = game('three_edges');
  for (const p of [0, 1, 2]) h.ships.find((x) => x.owner === p && x.flagship).dead = true;
  checkWin(h);
  assert.equal(h.winner, 'draw');
});

test('a real laser kill: the killer is credited, gets the kill pay and the bounty; the third side gets no kill pay', () => {
  // side 1's scout 2 hexes from side 2's; side 3 far away. Side 2's flagship has one hit left.
  let g = tri([0, 2], [0, 0], [6, -6], { rapid: { ring: 8, bounty: 10, econ: { kill: 2 } } });
  const t = g.ships.find((x) => x.owner === 1);
  for (const p of t.segs[0].parts) if (p.t !== 'core') p.hp = 0;
  t.segs[0].parts.find((p) => p.t === 'core').hp = 1;
  const shot = E.autoFire(g, 0, '1a', 'best');
  assert.ok(shot, 'side 1 has a shot');
  g = E.rapidTick(g, [shot, PASS, PASS]);
  assert.ok(t.id && g.ships.find((x) => x.id === t.id).dead);
  assert.equal(g.lastHit[t.id], 0);
  assert.deepEqual(g.out, [false, true, false]);
  const ko = g.events.find((e) => e.t === 'knocked_out');
  assert.equal(ko.by, 0);
  assert.ok(g.econ.purse[0] >= 10 + 2, 'killer paid: ' + g.econ.purse[0]);
  assert.ok(!g.events.some((e) => e.t === 'earned' && e.player === 2 && e.items.some((i) => i.why === 'kill')), 'side 3 was paid for a kill it did not make');
});

test('the computer shoots back at whoever hit it last', () => {
  // side 1's scout between two equal targets, one from each enemy, both 2 hexes away
  const g = tri([0, 0], [2, -2], [-2, 0], { rapid: { ring: 8 } });
  const pick = () => g.ships.find((x) => x.pos.join() === E.autoFire(g, 0, '1a', 'best').at.join()).owner;
  g.lastHit['1a'] = 2; assert.equal(pick(), 2);
  g.lastHit['1a'] = 1; assert.equal(pick(), 1);
});

test('at the tick limit the side with the most whole segments left wins', () => {
  const g = game('three_edges');
  g.ships.find((x) => x.owner === 1 && x.flagship).segs[2].wrecked = true;
  g.ships.find((x) => x.owner === 2 && x.flagship).segs[2].wrecked = true;
  assert.equal(E.pointsWinner(g), 0);
  g.ships.find((x) => x.owner === 0 && x.flagship).segs[2].wrecked = true;
  assert.equal(E.pointsWinner(g), 'draw');
});

for (const name of BOARDS) {
  test(name + ': three computers play a whole game to an end, and every action is accepted', () => {
    let g = game(name, 21);
    let rnd = 7; const r = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 400 && g.phase === 'play'; i++) {
      const acts = [0, 1, 2].map((p) => E.rapidAI(g, p, 'normal', r));
      acts.forEach((a, p) => assert.equal(E.rapidRefusal(g, p, a), null, 'side ' + (p + 1) + ' tick ' + g.round + ': ' + E.tickText(a)));
      g = E.rapidTick(g, acts);
    }
    assert.equal(g.phase, 'over');
    // the battle log replays it exactly
    const log = E.battleLog(g, { seat: 'cpu' });
    assert.equal(log.replayable, true, log.note);
  });
}
