// Economy mode, slice 1 (engine/economy.js, rules/rapid/rapid_frontier.yaml): salvage earned by
// flying through the board. Nothing to buy yet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readYaml, shippedFiles } from './helpers.js';
import * as E from '../engine/index.js';
import { dist } from '../engine/hex.js';

const board = (file = 'rules/rapid/rapid_frontier.yaml') => {
  const b = readYaml(file);
  const { rules, problems } = E.buildRules(shippedFiles().world, b, b);
  return { b, rules, problems };
};
const frontier = (opts = {}, seed = 5) => { const { b, rules } = board(); return E.rapidStart(E.rapidRules({ ...rules, rapid: b.rapid }, opts), seed); };
const PASS = { type: 'pass' };
const fwd = (g, p) => E.forcedMoves(g, p)[0] || PASS;
// play n ticks with both sides walking forward (the same rule for both, so the board stays mirrored)
function walk(g, n) { for (let i = 0; i < n && g.phase === 'play'; i++) g = E.rapidTick(g, [fwd(g, 0), fwd(g, 1)]); return g; }

test('the Frontier board loads with no problems and starts with empty purses', () => {
  assert.deepEqual(board().problems, []);
  const g = frontier();
  assert.ok(E.econOn(g));
  assert.deepEqual(g.econ.purse, [0, 0]);
  // starting hexes count as entered
  for (const x of g.ships) for (const c of E.footprint(x)) assert.ok(g.econ.seen[x.owner][c.join()]);
});

test('Rapid Opus is unchanged: no economy, no purse, no earned events', () => {
  const { b, rules } = board('rules/rapid/rapid_opus.yaml');
  let g = E.rapidStart(E.rapidRules({ ...rules, rapid: b.rapid }), 5);
  assert.equal(g.econ, undefined);
  g = walk(g, 15);
  assert.equal(g.econ, undefined);
  assert.ok(!g.events.some((e) => e.t === 'earned'));
});

test('own half pays nothing; the enemy half pays 1 a new hex and +1 by an asteroid', () => {
  const g = frontier();
  const R = g.rules.board.radius;
  // player 1 is the south side: r > 0 is home, r < 0 is the enemy half, the centre row r = 0 is neither
  assert.equal(E.hexValue(g, 0, [3, 5]), 0);
  assert.equal(E.hexValue(g, 0, [3, 0]), 0);
  assert.equal(E.hexValue(g, 0, [3, -2]), 1);
  assert.ok(E.nextToAsteroid(g.rules, [1, -6]));
  assert.equal(E.hexValue(g, 0, [1, -6]), 2);
  // and the other way round for player 2
  assert.equal(E.hexValue(g, 1, [3, -2]), 0);
  assert.equal(E.hexValue(g, 1, [-1, 6]), 2);
  assert.ok(R === 12);
  // with "earn in own half" on, home pays too
  const h = frontier({ econOwnHalf: 'yes' });
  assert.equal(E.hexValue(h, 0, [3, 5]), 1);
});

test('walking forward earns salvage once past the centre; both sides earn the same on a mirrored walk', () => {
  let g = frontier();
  let firstPay = null;
  for (let i = 0; i < 40 && g.phase === 'play'; i++) {
    g = E.rapidTick(g, [fwd(g, 0), fwd(g, 1)]);
    if (firstPay == null && g.econ.purse[0] > 0) firstPay = i;
  }
  assert.ok(g.econ.purse[0] > 0, 'player 1 earned nothing in 40 ticks');
  assert.ok(firstPay > 2, 'paid before reaching the enemy half');
  // every earned event is seen only by its own side (the purse is hidden), and says what this tick paid
  for (const e of g.events.filter((x) => x.t === 'earned')) {
    assert.deepEqual(e.seenBy, [e.player]);
    assert.equal(e.amount, g.econ.perTick[e.player].slice(-1)[0]);
    assert.equal(e.amount, e.items.reduce((a, it) => a + it.n, 0));
  }
  // the board, the fleets and the forced-move rule are mirror images, so the purses match
  assert.equal(g.econ.purse[0], g.econ.purse[1]);
});

test('a hex pays once per side, ever', () => {
  let g = frontier();
  g = walk(g, 30);
  const paid = new Map();
  // rebuild from the log of events: no hex paid twice to the same side
  // (events list only the last tick, so walk again tick by tick)
  let s = frontier();
  for (let i = 0; i < 30 && s.phase === 'play'; i++) {
    s = E.rapidTick(s, [fwd(s, 0), fwd(s, 1)]);
    for (const e of s.events.filter((x) => x.t === 'earned')) for (const it of e.items) {
      if (it.why !== 'ground' && it.why !== 'rock') continue;
      const k = e.player + ':' + it.at.join();
      assert.ok(!paid.has(k), 'hex ' + it.at + ' paid twice');
      paid.set(k, 1);
    }
  }
  assert.equal(s.econ.purse[0], g.econ.purse[0]);
});

test('first across the line pays 3 once; ships past the line pay 1 a tick', () => {
  let g = frontier();
  let crossTicks = 0, holds = 0;
  for (let i = 0; i < 40 && g.phase === 'play'; i++) {
    g = E.rapidTick(g, [fwd(g, 0), fwd(g, 1)]);
    for (const e of g.events.filter((x) => x.t === 'earned' && x.player === 0)) {
      crossTicks += e.items.filter((it) => it.why === 'cross').length;
      holds += e.items.filter((it) => it.why === 'hold').length;
    }
  }
  assert.ok(g.econ.crossed[0]);
  assert.equal(crossTicks, 1);
  assert.ok(holds > 0);
});

test('income is capped a tick; the cap is a setting', () => {
  for (const cap of [4, 6]) {
    let g = frontier({ econCap: cap });
    for (let i = 0; i < 40 && g.phase === 'play'; i++) {
      g = E.rapidTick(g, [fwd(g, 0), fwd(g, 1)]);
      for (const n of g.econ.perTick[0]) assert.ok(n <= cap, 'earned ' + n + ' with cap ' + cap);
    }
  }
  // a cap of 1 earns at most 1 a tick
  let g = frontier({ econCap: 1 });
  g = walk(g, 40);
  assert.ok(g.econ.purse[0] <= g.econ.perTick[0].length);
});

test('destroying an enemy ship pays 2 a segment; a ship that goes silent pays nothing', () => {
  const g = frontier();
  const before = structuredClone({ ...g, rules: undefined }); before.rules = g.rules;
  const s = structuredClone({ ...g, rules: undefined }); s.rules = g.rules;
  s.events = [];
  const victim = s.ships.find((x) => x.owner === 1 && x.name === 'Warden');
  const scout = s.ships.find((x) => x.owner === 1 && x.segs.length === 1);
  victim.dead = true;
  scout.dead = true; scout.converted = 'mine';
  E.econTick(s, before);
  const e = s.events.find((x) => x.t === 'earned' && x.player === 0);
  assert.ok(e);
  assert.deepEqual(e.items.map((i) => [i.why, i.n]), [['kill', 6]]);   // 3 segments; capped at 6
  assert.ok(!s.events.some((x) => x.t === 'earned' && x.player === 1));
});

test('a Frontier game replays from its battle log to the same purses', () => {
  let g = frontier({}, 11);
  for (let i = 0; i < 45 && g.phase === 'play'; i++) g = E.rapidTick(g, [E.rapidAI(g, 0, 'normal', () => 0.4), E.rapidAI(g, 1, 'normal', () => 0.6)]);
  const log = E.battleLog(g, { seat: 'cpu' });
  const r = E.replayLog(log);
  assert.deepEqual(r.econ.purse, g.econ.purse);
  assert.ok(log.replayable);
  const words = log.turns.flatMap((t) => (t.actions || []).flatMap((a) => (a.events || []).map((e) => e.say))).filter((w) => /salvage/.test(w || ''));
  assert.ok(words.length > 0, 'no salvage lines in the log');
});

test('new ground lists unentered enemy-half hexes and shrinks as ships fly through', () => {
  let g = frontier();
  const n0 = E.newGround(g, 0).length;
  assert.ok(n0 > 100);
  assert.ok(E.newGround(g, 0).every((h) => h.at[1] < 0));
  assert.ok(E.newGround(g, 0).some((h) => h.rock));
  g = walk(g, 40);
  assert.ok(E.newGround(g, 0).length < n0);
});

// ---------- slice 2: the threat heatmap ----------
// a game where player 1 has some salvage and an enemy ship in view
function withEnemyInView(seed = 5) {
  let g = frontier({}, seed);
  for (let i = 0; i < 60 && g.phase === 'play'; i++) {
    if (g.players[0].vis.some((id) => g.ships.some((x) => x.id === id && x.owner === 1))) break;
    g = E.rapidTick(g, [fwd(g, 0), fwd(g, 1)]);
  }
  return g;
}

test('heatmap: costs its price and the whole tick; refused without the salvage', () => {
  let g = frontier();
  assert.match(E.rapidRefusal(g, 0, { type: 'buy', item: 'heatmap' }), /not enough salvage/);
  assert.match(E.rapidRefusal(g, 0, { type: 'buy', item: 'lunch' }), /not for sale/);
  g.econ.purse[0] = 9;
  assert.equal(E.rapidRefusal(g, 0, { type: 'buy', item: 'heatmap' }), null);
  const before = g.ships.filter((x) => x.owner === 0).map((x) => x.pos.join());
  g = E.rapidTick(g, [{ type: 'buy', item: 'heatmap' }, fwd(g, 1)]);
  assert.equal(g.econ.purse[0], 3);
  assert.equal(g.econ.spent[0].heatmap, 6);
  assert.deepEqual(g.ships.filter((x) => x.owner === 0).map((x) => x.pos.join()), before);   // nothing moved
  assert.equal(g.rapid.ticks[0].acts[0], 'b:heatmap');
  // the enemy sees nothing of it
  const b = g.events.find((e) => e.t === 'bought');
  assert.deepEqual(b.seenBy, [0]);
  // not in the opening's forward-only rule's way: buying is allowed while you can't pass
  assert.equal(E.passAllowed(g, 0), false);
});

test('heatmap: shows on your next 2 ticks, then fades', () => {
  let g = frontier();
  g.econ.purse[0] = 6;
  assert.ok(!E.heatOn(g, 0));
  g = E.rapidTick(g, [{ type: 'buy', item: 'heatmap' }, fwd(g, 1)]);
  assert.ok(E.heatOn(g, 0)); assert.ok(!E.heatOn(g, 1));
  g = E.rapidTick(g, [fwd(g, 0), fwd(g, 1)]);
  assert.ok(E.heatOn(g, 0));
  g = E.rapidTick(g, [fwd(g, 0), fwd(g, 1)]);
  assert.ok(!E.heatOn(g, 0));
});

test('heatmap: built only from enemy ships you can see, with hits falling off by range', () => {
  const g = withEnemyInView();
  const seen = g.ships.filter((x) => x.owner === 1 && !x.dead && g.players[0].vis.includes(x.id));
  assert.ok(seen.length, 'no enemy came into view');
  const m = E.threatMap(g, 0);
  assert.ok(m.size > 0);
  // every threatened hex is within laser range of a ship you can see
  const range = Math.max(...Object.values(g.rules.parts).filter((c) => +c.range && +c.hits).map((c) => +c.range));
  for (const t of m.values()) if (t.hits) assert.ok(seen.some((e) => E.footprint(e).some((c) => dist(c, t.at) <= range)), 'threat at ' + t.at + ' from no visible ship');
  // closer is worse: a hex next to a seen ship is hit at least as hard as one at long range
  const one = structuredClone({ ...g, rules: undefined }); one.rules = g.rules; one.players[0].vis = [seen[0].id];
  const m1 = E.threatMap(one, 0);
  const e = seen[0], near = [...m1.values()].filter((t) => t.hits && E.footprint(e).some((c) => dist(c, t.at) === 1));
  const far = [...m1.values()].filter((t) => t.hits && E.footprint(e).every((c) => dist(c, t.at) >= range - 1));
  assert.ok(near.length && far.length);
  assert.ok(Math.max(...near.map((t) => t.hits)) >= Math.max(...far.map((t) => t.hits)));
  // a side that sees nothing gets an empty map
  const blind = structuredClone({ ...g, rules: undefined }); blind.rules = g.rules; blind.players[0].vis = [];
  assert.equal(E.threatMap(blind, 0).size, 0);
});

test('a game with a purchase replays from its log', () => {
  let g = frontier({}, 12), bought = false;
  for (let i = 0; i < 80 && g.phase === 'play'; i++) {
    const buy = !bought && g.econ.purse[0] >= 6;
    g = E.rapidTick(g, [buy ? { type: 'buy', item: 'heatmap' } : fwd(g, 0), fwd(g, 1)]);
    bought = bought || buy;
  }
  assert.ok(bought, 'never had 6 salvage');
  const log = E.battleLog(g, { seat: 'cpu' });
  assert.equal(log.replayable, true);
  assert.deepEqual(E.replayLog(log).econ, g.econ);
  assert.ok(log.turns.some((t) => (t.actions || []).some((a) => /bought a threat heatmap/.test(a.say || ''))));
});

// ---------- slice 3: turrets ----------
const scoutOf = (g, p) => g.ships.find((x) => x.owner === p && x.segs.length === 1 && !x.dead);
function dropTurret(g, p = 0, ship = scoutOf(g, p)) {
  g.econ.purse[p] = Math.max(g.econ.purse[p], 20);
  const at = E.turretSpots(g, p, ship.id)[0];
  return { a: { type: 'buy', item: 'turret', ship: ship.id, at }, ship, at };
}

test('turret: a ship leaves a laser behind on a free hex next to it; it costs 8 and the tick', () => {
  let g = frontier();
  const { a, ship, at } = dropTurret(g);
  assert.ok(at, 'no free hex');
  const lasersBefore = ship.segs.flatMap((sg) => sg.parts).filter((q) => q.t === 'laser' && q.hp > 0).length;
  assert.match(E.rapidRefusal(g, 0, { ...a, at: [99, 99] }), /free hex next to the ship/);
  assert.match(E.rapidRefusal(g, 0, { ...a, ship: g.ships.find((x) => x.owner === 1).id }), /your ships/);
  assert.equal(E.rapidRefusal(g, 0, a), null);
  g = E.rapidTick(g, [a, fwd(g, 1)]);
  const t = g.objs.find((o) => o.kind === E.TURRET);
  assert.ok(t); assert.deepEqual(t.pos, at); assert.equal(t.owner, 0); assert.equal(t.hp, 2);
  const after = g.ships.find((x) => x.id === ship.id).segs.flatMap((sg) => sg.parts).filter((q) => q.t === 'laser' && q.hp > 0).length;
  assert.equal(after, lasersBefore - 1);
  assert.equal(g.econ.spent[0].turret, 8);
  // a scout that has dropped its only laser can't drop another
  assert.equal(E.turretSpots(g, 0, ship.id).length, 0);
});

test('turret: fires 2 hits at the nearest enemy it can see within 4 hexes', () => {
  let g = frontier();
  const enemy = g.ships.find((x) => x.owner === 1 && x.segs.length === 1);
  // put a turret 3 hexes from an enemy scout and let player 1 see it
  const at = [enemy.pos[0], enemy.pos[1] + 3];
  g.objs.push({ id: 'o90', kind: E.TURRET, owner: 0, pos: at, dir: 0, fuel: null, target: null, lock: false, route: [], src: null, hp: 2, born: 0 });
  g.players[0].vis = [...g.players[0].vis, enemy.id];
  const hullBefore = E.hullPct(g, enemy);
  g = E.rapidTick(g, [fwd(g, 0), fwd(g, 1)]);
  const shot = g.events.find((e) => e.t === 'turret_fire');
  if (shot) {
    assert.equal(shot.hits, 2);
    const x = g.ships.find((s) => s.id === shot.target);
    assert.ok(x.dead || E.hullPct(g, x) < 100);
  } else assert.fail('the turret did not fire (enemy at ' + enemy.pos + ', hull ' + hullBefore + ')');
});

test('turret: takes 2 hits to destroy; a laser hit of 1 only damages it', () => {
  let g = frontier();
  const t = { id: 'o91', kind: E.TURRET, owner: 1, pos: [0, 2], dir: 0, fuel: null, target: null, lock: false, route: [], src: null, hp: 2, born: 0 };
  g.objs.push(t);
  const s = structuredClone({ ...g, rules: undefined }); s.rules = g.rules; s.events = [];
  E.hitObject(s, s.objs.find((o) => o.id === 'o91'), 1);
  assert.equal(s.objs.find((o) => o.id === 'o91').hp, 1);
  E.hitObject(s, s.objs.find((o) => o.id === 'o91'), 1);
  assert.ok(!s.objs.some((o) => o.id === 'o91'));
});

test('turret: upkeep (setting: every tick) from the tick after it is placed; short of salvage, the oldest goes dark until paid', () => {
  let g = frontier({ econUpkeepEvery: 1 });
  const mk = (id, born, pos) => ({ id, kind: E.TURRET, owner: 0, pos, dir: 0, fuel: null, target: null, lock: false, route: [], src: null, hp: 2, born });
  g.objs.push(mk('o80', 0, [-11, 3]), mk('o81', 1, [-11, 4]));   // o81 placed in tick 1: free this tick
  g.econ.purse[0] = 2;
  g = E.rapidTick(g, [fwd(g, 0), fwd(g, 1)]);   // tick 1: o80 pays 1 (nothing earned at home)
  assert.equal(g.econ.purse[0], 1);
  assert.ok(!g.objs.some((o) => o.dark));
  g = E.rapidTick(g, [fwd(g, 0), fwd(g, 1)]);   // tick 2: 1 left for 2 turrets: the newest is paid, the oldest goes dark
  assert.equal(g.objs.find((o) => o.id === 'o80').dark, true);
  assert.ok(!g.objs.find((o) => o.id === 'o81').dark);
  assert.equal(g.econ.purse[0], 0);
  g.econ.purse[0] = 5;
  g = E.rapidTick(g, [fwd(g, 0), fwd(g, 1)]);   // salvage again: both paid, the dark one wakes
  assert.ok(!g.objs.some((o) => o.dark));
  assert.equal(g.econ.purse[0], 3);
});

test('turret: enemy turrets you can see show on the heatmap', () => {
  const g = frontier();
  g.objs.push({ id: 'o70', kind: E.TURRET, owner: 1, pos: [0, -3], dir: 0, fuel: null, target: null, lock: false, route: [], src: null, hp: 2, born: 0 });
  const s = structuredClone({ ...g, rules: undefined }); s.rules = g.rules; s.players[0].vis = ['o70'];
  const m = E.threatMap(s, 0);
  assert.ok(m.get('0,-1') && m.get('0,-1').hits === 2);
  assert.ok(m.get('3,0'));    // 6 away: in its range (6)
  assert.ok(!m.get('5,0'));   // 8 away: out of it
});

test('a game with a turret replays from its log', () => {
  let g = frontier({}, 14), done = false;
  for (let i = 0; i < 40 && g.phase === 'play'; i++) {
    let a = fwd(g, 0);
    if (!done && g.econ.purse[0] >= 8) { const sc = scoutOf(g, 0), at = sc && E.turretSpots(g, 0, sc.id)[0]; if (at) { a = { type: 'buy', item: 'turret', ship: sc.id, at }; done = true; } }
    g = E.rapidTick(g, [a, fwd(g, 1)]);
  }
  assert.ok(done, 'never afforded a turret');
  const log = E.battleLog(g, { seat: 'cpu' });
  assert.equal(log.replayable, true);
});

// ---------- slice 4: upgrades and resupply ----------
const lasersOf = (g, x) => x.segs.flatMap((sg) => sg.parts).filter((q) => g.rules.parts[q.t].range && g.rules.parts[q.t].hits && q.hp > 0);

test('upgrade +1 laser range: every laser on the ship reaches one hex further; once per ship; costs 10', () => {
  let g = frontier();
  g.econ.purse[0] = 25;
  const x = g.ships.find((s) => s.owner === 0 && s.name === 'Bastion');
  const r0 = Math.max(...lasersOf(g, x).map((q) => g.rules.parts[q.t].range));
  const a = { type: 'buy', item: 'upgrade', ship: x.id, kind: 'range' };
  assert.equal(E.rapidRefusal(g, 0, a), null);
  g = E.rapidTick(g, [a, fwd(g, 1)]);
  const y = g.ships.find((s) => s.id === x.id);
  assert.ok(lasersOf(g, y).every((q) => q.t.endsWith('_up') && g.rules.parts[q.t].range === r0 + 1));
  assert.equal(g.econ.purse[0] >= 15 && g.econ.purse[0] <= 21, true);
  assert.match(E.rapidRefusal(g, 0, { ...a, kind: 'sensor' }), /already has its upgrade/);
  assert.equal(g.rapid.ticks[0].acts[0], 'b:upgrade.' + x.id + '.range');
});

test('upgrades: shields come back a tick sooner, sensors see further, one armour plate takes a hit more', () => {
  const g = frontier();
  const P = g.rules.parts;
  assert.equal(P.shield_up.recharge_every, P.shield.recharge_every - 1);
  assert.equal(P.core_up.sensor_range, P.core.sensor_range + 1);
  assert.ok(!P.sensor_up);
  assert.equal(P.armour_up.hp, P.armour.hp + 1);
  let s = frontier();
  s.econ.purse[0] = 30;
  const scout = s.ships.find((x) => x.owner === 0 && x.segs.length === 1);
  s = E.rapidTick(s, [{ type: 'buy', item: 'upgrade', ship: scout.id, kind: 'armour' }, fwd(s, 1)]);
  const plate = s.ships.find((x) => x.id === scout.id).segs[0].parts.find((q) => q.t === 'armour_up');
  assert.ok(plate); assert.equal(plate.hp, 3);
  // nothing to improve, no upgrade: a scout that has lost its laser can't take +1 range; a shield that is
  // only down still counts
  const t = frontier(); t.econ.purse[0] = 30;
  const sc = t.ships.find((x) => x.owner === 0 && x.segs.length === 1);
  for (const q of sc.segs[0].parts) if (q.t === 'laser' || q.t === 'shield') q.hp = 0;
  assert.match(E.rapidRefusal(t, 0, { type: 'buy', item: 'upgrade', ship: sc.id, kind: 'range' }), /no working part/);
  assert.equal(E.rapidRefusal(t, 0, { type: 'buy', item: 'upgrade', ship: sc.id, kind: 'shield' }), null);
});

test('resupply: +1 missile of the kind it carries most; needs a working launcher and room', () => {
  let g = frontier();
  g.econ.purse[0] = 20;
  const lancer = g.ships.find((x) => x.owner === 0 && x.name === 'Lancer L');
  const scout = g.ships.find((x) => x.owner === 0 && x.segs.length === 1);
  assert.match(E.rapidRefusal(g, 0, { type: 'buy', item: 'resupply', ship: scout.id }), /no working launcher/);
  assert.match(E.rapidRefusal(g, 0, { type: 'buy', item: 'resupply', ship: lancer.id }), /no room/);   // 3 basic missiles in one magazine of 3
  // after a launch there is room
  lancer.load.missile_basic = 2;
  const a = { type: 'buy', item: 'resupply', ship: lancer.id };
  assert.equal(E.rapidRefusal(g, 0, a), null);
  g = E.rapidTick(g, [a, fwd(g, 1)]);
  assert.equal(g.ships.find((x) => x.id === lancer.id).load.missile_basic, 3);
  assert.equal(g.econ.spent[0].resupply, 5);
});

test('a game with an upgrade and a resupply replays from its log', () => {
  let g = frontier({}, 15), up = false;
  for (let i = 0; i < 45 && g.phase === 'play'; i++) {
    let a = fwd(g, 0);
    if (!up && g.econ.purse[0] >= 10) { const x = g.ships.find((s) => s.owner === 0 && !s.dead && s.name === 'Warden'); if (x) { a = { type: 'buy', item: 'upgrade', ship: x.id, kind: 'shield' }; up = true; } }
    g = E.rapidTick(g, [a, fwd(g, 1)]);
  }
  assert.ok(up, 'never afforded an upgrade');
  const log = E.battleLog(g, { seat: 'cpu' });
  assert.equal(log.replayable, true);
  assert.ok(log.turns.some((t) => (t.actions || []).some((a) => /bought an upgrade/.test(a.say || ''))));
});

// ---------- the short (chess-style) log ----------
test('short log: a few KB, one line a tick, replays to the same game; settings that changed are listed', () => {
  let g = frontier({ econCap: 10 }, 21);
  for (let i = 0; i < 60 && g.phase === 'play'; i++) g = E.rapidTick(g, [E.rapidAI(g, 0, 'normal', () => 0.3), E.rapidAI(g, 1, 'normal', () => 0.7)]);
  const settings = { econCap: { now: 10, was: 6 } };
  const short = E.shortLog(g, { seat: 'cpu', board: 'rapid_frontier', settings });
  assert.equal(short.moves.length, g.rapid.ticks.length);
  const full = E.battleLog(g, { seat: 'cpu', settings });
  assert.ok(JSON.stringify(short).length * 10 < JSON.stringify(full).length, 'short ' + JSON.stringify(short).length + ' vs full ' + JSON.stringify(full).length);
  assert.ok(short.summary.some((l) => /econCap 10 \(default 6\)/.test(l)));
  const { b, rules } = board();
  const r = E.replayShort(short, E.rapidRules({ ...rules, rapid: b.rapid }, { econCap: 10 }));
  assert.deepEqual(r.econ, g.econ);
  // the wrong settings don't match
  assert.throws(() => E.replayShort(short, E.rapidRules({ ...rules, rapid: b.rapid }, {})), /did not end where/);
});

test('turret upkeep is due every 3 ticks by default; 0 turns it off', () => {
  let g = frontier();
  g.objs.push({ id: 'o60', kind: E.TURRET, owner: 0, pos: [-11, 3], dir: 0, fuel: null, target: null, lock: false, route: [], src: null, hp: 2, born: 0 });
  g.econ.purse[0] = 5;
  for (let i = 0; i < 6; i++) g = E.rapidTick(g, [fwd(g, 0), fwd(g, 1)]);   // ticks 1-6: due on 3 and 6
  assert.equal(g.econ.spent[0].upkeep, 2);
  let h = frontier({ econUpkeepEvery: 0 });
  h.objs.push({ id: 'o61', kind: E.TURRET, owner: 0, pos: [-11, 3], dir: 0, fuel: null, target: null, lock: false, route: [], src: null, hp: 2, born: 0 });
  h.econ.purse[0] = 5;
  for (let i = 0; i < 6; i++) h = E.rapidTick(h, [fwd(h, 0), fwd(h, 1)]);
  assert.equal(h.econ.spent[0].upkeep || 0, 0);
});

test('passing costs: no salvage that tick and 1 lost (never below 0); 0 turns it off', () => {
  let g = frontier();
  g = walk(g, 30);
  assert.ok(E.passAllowed(g, 0), 'player 1 can pass by now');
  const before = g.econ.purse[0];
  g = E.rapidTick(g, [PASS, fwd(g, 1)]);
  assert.equal(g.econ.purse[0], Math.max(0, before - 1) - (g.econ.spent[0].upkeep || 0));
  assert.equal(g.econ.perTick[0].slice(-1)[0], -Math.min(1, before));
  assert.ok(g.events.some((e) => e.t === 'idle' && e.player === 0));
  let z = frontier(); z = walk(z, 30); z.econ.purse[0] = 0;
  z = E.rapidTick(z, [PASS, fwd(z, 1)]);
  assert.equal(z.econ.purse[0], 0);
  let o = frontier({ econIdle: 0 }); o = walk(o, 30); const b0 = o.econ.purse[0];
  o = E.rapidTick(o, [PASS, fwd(o, 1)]);
  assert.ok(o.econ.purse[0] >= b0);
});
