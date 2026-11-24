// Experiments (engine/experiments.js, engine/labrules.js) on the Lab board (rules/rapid/rapid_lab.yaml).
// Each is checked switched on; switched off they must change nothing (tests/golden.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readYaml, shippedFiles } from './helpers.js';
import * as E from '../engine/index.js';
import { dist } from '../engine/hex.js';

const lab = (on = [], opts = {}, seed = 5, free = true) => {
  const b = readYaml('rules/rapid/rapid_lab.yaml');
  const { rules } = E.buildRules(shippedFiles().world, b, b);
  const g = E.rapidStart(E.rapidRules({ ...rules, rapid: b.rapid }, { unlock: 'permanent', exp: Object.fromEntries(on.map((k) => [k, true])), ...opts }), seed);
  if (free) g.rapid.ever = [true, true];   // both sides free to pass and move anywhere, so a test can set up a scene
  return g;
};
const PASS = { type: 'pass' };
const fwd = (g, p) => E.forcedMoves(g, p)[0] || PASS;
const ship = (g, name, p = 0) => g.ships.find((x) => x.owner === p && x.name === name);
const clone = (g) => { const s = structuredClone({ ...g, rules: undefined }); s.rules = g.rules; return s; };

test('the Lab board loads; every experiment is listed with a label and a description', () => {
  const g = lab();
  assert.ok(E.econOn(g));
  assert.equal(g.rules.board.radius, 7);
  for (const e of E.EXPERIMENTS) { assert.ok(e.key && e.label && e.about.length > 20); }
  assert.equal(E.exp(g, 'ghost'), false);
  assert.equal(E.exp(lab(['ghost']), 'ghost'), true);
});

// put an enemy scout right next to one of ours, past the line, and see each other
function faceOff(on) {
  const g = lab(on);
  const me = ship(g, 'Pawn A'), foe = ship(g, 'Pawn A', 1);
  me.pos = [1, -1]; foe.pos = [1, -3];   // past player 1's line (row 7 = r 0), 2 apart
  return { g, me, foe };
}

test('ghost: a ship that converts leaves nothing to see for 2 ticks, even right in front of the enemy', () => {
  for (const on of [[], ['ghost']]) {
    let { g, me } = faceOff(on);
    g = E.rapidTick(g, [{ type: 'move', ship: me.id, path: [3], convert: 'scanner' }, PASS]);
    const buoy = g.objs.find((o) => o.owner === 0 && o.kind === 'scan_buoy');
    assert.ok(buoy, 'no buoy');
    const seen = g.players[1].vis.includes(buoy.id);
    if (on.length) assert.ok(!seen, 'ghost on, but the enemy sees the buoy at once');
    else assert.ok(seen, 'ghost off: the buoy 1 hex from an enemy should be seen (as before)');
    if (on.length) {
      g = E.rapidTick(g, [PASS, PASS]);
      assert.ok(!g.players[1].vis.includes(buoy.id));
      g = E.rapidTick(g, [PASS, PASS]);
      assert.ok(g.players[1].vis.includes(buoy.id), 'still hidden after 2 ticks');
    }
  }
});

test('mines from the ship’s state: laser+sensor smart, laser close, sensor lurker, neither dud', () => {
  const kinds = [];
  for (const strip of [[], ['sensor'], ['laser'], ['laser', 'sensor']]) {
    let { g, me } = faceOff(['stateMines']);
    for (const q of me.segs[0].parts) if (strip.includes(q.t)) q.hp = 0;
    me.pos = [1, -1];
    g = E.rapidTick(g, [{ type: 'move', ship: me.id, path: [0], convert: 'mine' }, PASS]);
    kinds.push(g.objs.find((o) => o.owner === 0 && E.MINE_KINDS.includes(o.kind)).kind);
  }
  assert.deepEqual(kinds, ['smart_mine', 'close_mine', 'lurker_mine', 'dud_mine']);
  // switched off: always the naval mine
  let { g, me } = faceOff([]);
  g = E.rapidTick(g, [{ type: 'move', ship: me.id, path: [0], convert: 'mine' }, PASS]);
  assert.ok(g.objs.some((o) => o.owner === 0 && o.kind === 'naval_mine'));
});

test('a smart mine goes off when an enemy comes within 3 and wrecks the nearest segment', () => {
  let { g, me, foe } = faceOff(['stateMines']);
  me.pos = [-3, 0]; foe.pos = [3, -5];
  g = E.rapidTick(g, [{ type: 'move', ship: me.id, path: [0], convert: 'mine' }, PASS]);
  const mine = g.objs.find((o) => o.kind === 'smart_mine');
  assert.ok(mine);
  // walk the enemy scout towards it until it goes off
  let boom = false;
  for (let i = 0; i < 12 && !boom; i++) {
    const f = g.ships.find((x) => x.id === foe.id);
    if (f.dead) break;
    // pick the move that ends closest to the mine
    let best = null, bd = 99;
    for (const mv of E.legalMoves(g, 1).filter((a) => a.ship === foe.id)) {
      const t = clone(g); try { const r = E.rapidTick(t, [PASS, mv]); const y = r.ships.find((x) => x.id === foe.id); const d = y.dead ? -1 : dist(y.pos, mine.pos); if (d < bd) { bd = d; best = mv; } } catch (e) { /* skip */ }
    }
    if (!best) break;
    g = E.rapidTick(g, [PASS, best]);
    boom = g.events.some((e) => e.t === 'blast' && e.kind === 'smart_mine');
    if (boom) assert.ok(Math.min(...E.footprint(g.ships.find((x) => x.id === foe.id)).map((c) => dist(c, mine.pos))) <= 3);
  }
  assert.ok(boom, 'the smart mine never went off');
});

test('ram: a scout within 2 of a seen enemy wrecks its nearest segment and is gone', () => {
  let { g, me, foe } = faceOff(['ram']);
  g.players[0].vis = [...g.players[0].vis, foe.id];
  const a = { type: 'ram', ship: me.id, target: foe.id };
  assert.equal(E.rapidRefusal(lab(), 0, { ...a }) !== null, true);   // off: refused
  assert.equal(E.rapidRefusal(g, 0, a), null);
  assert.match(E.rapidRefusal(g, 0, { ...a, ship: ship(g, 'Warden').id }), /one-hex/);
  g = E.rapidTick(g, [a, PASS]);
  assert.ok(g.ships.find((x) => x.id === me.id).dead);
  assert.equal(g.ships.find((x) => x.id === me.id).converted, 'ram');
  assert.ok(g.ships.find((x) => x.id === foe.id).dead, 'a scout hit by a ram should be gone');
  assert.equal(g.rapid.ticks[0].acts[0], 'r:' + me.id + '.' + foe.id);
});

test('decoy: a ship with an emitter places one 2–6 hexes away; it fades after 3 ticks; once every 6', () => {
  let g = lab(['decoy']);
  const m = ship(g, 'Warden');
  const spots = E.decoySpots(g, 0, m.id);
  assert.ok(spots.length > 5);
  assert.match(E.rapidRefusal(g, 0, { type: 'decoy', ship: ship(g, 'Pawn A').id, at: spots[0] }), /emitter/);
  const a = { type: 'decoy', ship: m.id, at: spots[0] };
  assert.equal(E.rapidRefusal(g, 0, a), null);
  g = E.rapidTick(g, [a, fwd(g, 1)]);
  const d = g.objs.find((o) => o.kind === 'decoy');
  assert.ok(d);
  assert.match(E.rapidRefusal(g, 0, { ...a, at: E.decoySpots(g, 0, m.id)[0] }), /next decoy/);
  for (let i = 0; i < 3; i++) g = E.rapidTick(g, [fwd(g, 0), fwd(g, 1)]);
  assert.ok(!g.objs.some((o) => o.kind === 'decoy'), 'still there after 3 ticks');
  // the enemy sees it as a ship-sized "?", not as a decoy
  let h = lab(['decoy']);
  const hm = ship(h, 'Warden');
  h = E.rapidTick(h, [{ type: 'decoy', ship: hm.id, at: E.decoySpots(h, 0, hm.id)[0] }, PASS]);
  const v = E.view(h, 1);
  assert.ok(!v.objs.some((o) => o.kind === 'decoy'));
  assert.ok(v.contacts.some((c) => c.kind === 'ship' && c.decoy === undefined && h.objs.some((o) => o.kind === 'decoy' && o.pos[0] === c.at[0] && o.pos[1] === c.at[1])));
});

test('repair, warp and hibernate are for sale only when switched on, and do what they say', () => {
  let g = lab(['repair', 'warp', 'hibernate']);
  assert.ok(E.shopItems(g).repair && E.shopItems(g).warp && E.shopItems(g).hibernate);
  assert.ok(!E.shopItems(lab()).repair);
  g.econ.purse[0] = 40;
  // repair: knock a scout about, repair it
  const sc = ship(g, 'Pawn A');
  for (const q of sc.segs[0].parts) if (q.t === 'armour' || q.t === 'sensor') q.hp = 0;
  const lz = sc.segs[0].parts.find((q) => q.t === 'laser'); lz.hp = 0;
  g = E.rapidTick(g, [{ type: 'buy', item: 'repair', ship: sc.id }, PASS]);
  const r = g.ships.find((x) => x.id === sc.id).segs[0].parts;
  assert.equal(r.find((q) => q.t === 'armour').hp, 2);
  assert.equal(r.find((q) => q.t === 'sensor').hp, 1);
  assert.equal(r.find((q) => q.t === 'laser').hp, 0, 'a lost laser stays lost');
  assert.match(E.rapidRefusal(g, 0, { type: 'buy', item: 'repair', ship: sc.id }) || '', /again on tick|nothing to repair/);
  // warp: somewhere 1-4 hexes away in the own half
  const w = ship(g, 'Pawn B'), spots = E.warpSpots(g, 0, w.id);
  assert.ok(spots.length);
  assert.ok(spots.every((c) => c[1] >= 0), 'warp left the own half');
  g = E.rapidTick(g, [{ type: 'buy', item: 'warp', ship: w.id, at: spots[0] }, PASS]);
  assert.deepEqual(g.ships.find((x) => x.id === w.id).pos, spots[0]);
  // hibernate: only next to an asteroid; hidden; mends a part every 4 ticks
  const hb = ship(g, 'Pawn A');
  assert.match(E.rapidRefusal(g, 0, { type: 'buy', item: 'hibernate', ship: hb.id }) || '', /asteroid/);
  hb.pos = [-3, 3];   // next to the rock at [-3, 2]
  hb.segs[0].parts.find((q) => q.t === 'armour').hp = 0;
  assert.equal(E.rapidRefusal(g, 0, { type: 'buy', item: 'hibernate', ship: hb.id }), null);
  g = E.rapidTick(g, [{ type: 'buy', item: 'hibernate', ship: hb.id }, PASS]);
  assert.ok(g.ships.find((x) => x.id === hb.id).hib);
  for (let i = 0; i < 4; i++) g = E.rapidTick(g, [PASS, PASS]);
  assert.equal(g.ships.find((x) => x.id === hb.id).segs[0].parts.find((q) => q.t === 'armour').hp, 2, 'no part mended in 4 ticks');
  // hidden from an enemy 2 hexes away, seen from 1
  const foe = ship(g, 'Pawn A', 1); foe.pos = [-3, 5];
  assert.ok(!E.visibleTo(g, 1).has(hb.id) || false);
  foe.pos = [-2, 3];
  assert.ok(E.visibleTo(g, 1).has(hb.id));
});

test('an experiments game replays from its log', () => {
  let g = lab(['ghost', 'stateMines', 'ram', 'decoy', 'repair', 'warp', 'hibernate'], { unlock: 'hold' }, 9, false);
  let r = 9; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  const m = ship(g, 'Warden');
  g = E.rapidTick(g, [{ type: 'decoy', ship: m.id, at: E.decoySpots(g, 0, m.id)[0] }, fwd(g, 1)]);
  for (let i = 0; i < 30 && g.phase === 'play'; i++) g = E.rapidTick(g, [0, 1].map((p) => { const a = E.rapidAI(g, p, 'normal', rnd); return E.rapidRefusal(g, p, a) ? fwd(g, p) : a; }));
  const log = E.battleLog(g, { seat: 'cpu' });
  assert.equal(log.replayable, true, log.note);
});
