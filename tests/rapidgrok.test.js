// Rapid mode, Grok build (rapid-grok.html, engine/rapidgrok.js, rules/rapid-grok/rapid_grok.yaml).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readYaml, shippedFiles } from './helpers.js';
import { buildRules, view, beamTargets, launchOptions, aimLaunch, hex } from '../engine/index.js';
import * as G from '../engine/rapidgrok.js';

const world = () => readYaml('rules/world_v0.4.yaml');
const setup = () => readYaml('rules/rapid-grok/rapid_grok.yaml');
const real = (seed = 3) => { const { rules, problems } = G.rgRules(world(), setup()); assert.deepEqual(problems, []); return G.rgStart(rules, seed); };
const skiff = (name, at, more = {}) => ({ name, at, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser'] }], ...more });
const lance = (name, at, more = {}) => ({ name, at, load: { missile_advanced: 3 }, hull: [
  { at: [0, 0], bays: ['core', 'magazine', 'sensor'], mounts: ['laser', 'shield'] },
  { at: [1, 0], bays: ['coupling', 'engine', 'stealth'], mounts: ['launcher', 'point_defence'] },
  { at: [0, 1], bays: ['coupling', 'engine', 'stealth'], mounts: ['laser', 'armour'] }], ...more });
// a small hand-built rapid fight; player 1 always acts first
function small(p1, p2, seed = 5) {
  const side = (ships) => ({ ships: ships.map(({ at, ...s }) => s), deployment: ships.map((s) => ({ ship: s.name, at: s.at })) });
  const st = { map: { board: { shape: 'hexagon', radius: 12 } }, fleets: { budget: 99999, player_1: side(p1), player_2: side(p2) } };
  const w = world();
  const { rules, problems } = G.rgRules(w, st);
  assert.deepEqual(problems, []);
  rules.firstMover = 'player_1';
  return G.rgStart(rules, seed);
}
const ship = (s, name, owner = 0) => s.ships.find((x) => x.name === name && x.owner === owner);

test('rapid grok: the board and fleet are the agreed ones (radius 12, 9 Skiffs, 2 Darts, Arrow, Lance, Flower flagship, mirrored)', () => {
  const s = real();
  assert.equal(s.rules.board.radius, 12);
  for (const p of [0, 1]) {
    const mine = s.ships.filter((x) => x.owner === p);
    const sizes = mine.map((x) => x.segs.length).sort((a, b) => a - b);
    assert.deepEqual(sizes, [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 4, 7]);
    const flag = mine.filter((x) => x.flagship);
    assert.equal(flag.length, 1); assert.equal(flag[0].segs.length, 7);
  }
  for (const a of s.ships.filter((x) => x.owner === 0)) {
    const b = ship(s, a.name, 1);
    assert.deepEqual(b.pos, [0 - a.pos[0] || 0, 0 - a.pos[1] || 0], a.name + ' is mirrored');
  }
  assert.equal(s.objs.length, 0, 'no mines in v1');
});

test('rapid grok: building rapid rules leaves the classic world and classic rules alone', () => {
  const w = world(), before = JSON.stringify(w);
  G.rgRules(w, setup());
  assert.equal(JSON.stringify(w), before);
  const f = shippedFiles(), { rules } = buildRules(f.world, f.map, f.fleets);
  assert.equal(rules.cp.perTurn, 3);
  assert.equal(rules.rapidGrok, undefined);
  assert.equal(rules.rapid, undefined);
  const rg = G.rgRules(world(), setup()).rules;
  assert.equal(rg.rapid, undefined, 'never switches on the other rapid code in the engine');
});

test('rapid grok: one action ends the turn, and the two sides strictly alternate', () => {
  let s = real(3);
  const seq = [];
  for (let i = 0; i < 12; i++) { seq.push(G.toAct(s)); s = G.aiTurn(s, G.toAct(s)).state; }
  for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1], 'never the same side twice in a row');
  assert.equal(s.round, 7, '12 actions = 6 beats done, now in beat 7');
});

test('rapid grok: a ship steps exactly 1 hex (even the 7-hex Flower), and a 2-hex move is refused', () => {
  let s = small([skiff('A', [6, 0], { flagship: true }), skiff('B', [6, 2])], [skiff('Z', [-8, 0], { flagship: true })]);
  assert.throws(() => G.rgAct(s, { type: 'move', ship: ship(s, 'A').id, path: [3, 3] }), /1 hex/);
  s = G.rgAct(s, { type: 'move', ship: ship(s, 'A').id, path: [3] });
  assert.deepEqual(ship(s, 'A').pos, [5, 0]);
  assert.equal(G.toAct(s), 1, 'the turn passed to the other side');
  let r = real(3);
  const p = G.toAct(r), flower = r.ships.find((x) => x.owner === p && x.flagship);
  const from = flower.pos.slice();
  const opt = G.forcedMove(r, flower.id);
  assert.ok(opt && opt.ship === flower.id && opt.path.length === 1);
  r = G.rgAct(r, opt);
  assert.equal(hex.dist(from, r.ships.find((x) => x.id === flower.id).pos), 1);
});

test('rapid grok: no passing, no command points left over, and scans do not need a move first', () => {
  let s = small([skiff('A', [6, 0], { flagship: true })], [skiff('Z', [-8, 0], { flagship: true })]);
  assert.throws(() => G.rgAct(s, { type: 'end' }));
  assert.equal(s.players[0].cp, 1);
  s = G.rgAct(s, { type: 'scan', ship: ship(s, 'A').id });   // has not moved: still allowed
  assert.ok(s.events.some((e) => e.t === 'scan'));
  assert.equal(s.players[0].cpBank, 0);
});

test('rapid grok: at the end of a beat missiles fly 6 hexes, and point defence reloads', () => {
  let s = small([lance('L', [6, 0], { flagship: true })], [skiff('Z', [-11, 0], { flagship: true })]);
  const L = ship(s, 'L');
  const a = aimLaunch(s, L.id, 'missile_advanced', [-10, 0], null);
  s = G.rgAct(s, a);
  const m = s.objs.find((o) => o.owner === 0);
  const start = m.pos.slice();
  assert.equal(s.round, 1, 'beat 1 still running: the missile has not flown yet');
  s = G.rgAct(s, { type: 'move', ship: ship(s, 'Z', 1).id, path: [0] });
  assert.equal(s.round, 2);
  const m2 = s.objs.find((o) => o.id === m.id);
  assert.ok(m2, 'still flying');
  assert.equal(hex.dist(start, m2.pos), 6);
  assert.equal(m2.fuel, 2, 'fuel for 3 beats, one used');
  for (const x of s.ships) assert.equal(x.pd, 0);
});

test('rapid grok: lasers have no attack-run bonus', () => {
  const s = small([skiff('A', [2, 0], { flagship: true })], [skiff('Z', [-1, 0], { flagship: true })]);
  const t = beamTargets(s, ship(s, 'A').id);
  assert.equal(t.length, 1);
  assert.equal(t[0].hits, 3, '3 hits at 3 hexes, nothing extra');
});

test('rapid grok: timeout with a laser picked fires at the best target; with nothing to shoot it returns null', () => {
  const s = small([skiff('A', [3, 0], { flagship: true }), skiff('B', [11, -6])], [lance('Big', [-2, 0], { flagship: true }), skiff('Z', [0, 3])]);
  const a = G.autoFire(s, ship(s, 'A').id, 'laser');
  assert.equal(a.type, 'fire');
  assert.equal(a.target, ship(s, 'Big', 1).id, 'the bigger target first');
  assert.equal(G.autoFire(s, ship(s, 'B').id, 'laser'), null, 'B sees nothing in range');
  assert.equal(G.autoFire(s, ship(s, 'A').id, 'scan'), null, 'a scan is never auto-run');
  const after = G.rgAct(s, a);
  assert.ok(after.events.some((e) => e.t === 'fire' && e.hits > 0));
});

test('rapid grok: timeout with a missile picked locks on to a seen enemy', () => {
  const s = small([lance('L', [5, 0], { flagship: true })], [skiff('Z', [0, 0], { flagship: true })]);
  const lo = launchOptions(s, ship(s, 'L').id);
  assert.ok(lo.locks.length);
  const a = G.autoFire(s, ship(s, 'L').id, 'missile');
  assert.equal(a.type, 'launch'); assert.equal(a.target, ship(s, 'Z', 1).id);
  const after = G.rgAct(s, a);
  assert.ok(after.objs.some((o) => o.owner === 0 && o.target === a.target));
});

test('rapid grok: forced moves step the picked ship toward the enemy; with nothing picked a Skiff or the front ship steps', () => {
  const s = real(9);
  const p = G.toAct(s), sk = s.ships.find((x) => x.owner === p && x.name === 'Skiff 5');
  const a = G.forcedMove(s, sk.id);
  assert.equal(a.ship, sk.id); assert.equal(a.path.length, 1);
  const to = hex.step(sk.pos, a.path[0]);
  assert.ok(Math.abs(to[0]) <= Math.abs(sk.pos[0]), 'it steps toward the middle (forward)');
  const counts = {};
  for (let seed = 1; seed <= 30; seed++) {
    const r = real(seed), q = G.toAct(r), f = G.forcedMove(r, null), x = r.ships.find((y) => y.id === f.ship);
    assert.equal(x.owner, q);
    counts[x.segs.length === 1 ? 'skiff' : 'big'] = (counts[x.segs.length === 1 ? 'skiff' : 'big'] || 0) + 1;
  }
  assert.ok(counts.skiff > 0);
  assert.deepEqual(G.forcedMove(s, null), G.forcedMove(s, null), 'same game, same pick (replays agree)');
});

test('rapid grok: the 5-second watch only shows enemy moves the player can see', () => {
  let s = small([skiff('A', [11, 0], { flagship: true })], [skiff('Z', [-11, 0], { flagship: true }), skiff('Y', [-6, 0])]);
  s = G.rgAct(s, { type: 'move', ship: ship(s, 'A').id, path: [3] });
  s = G.rgAct(s, { type: 'move', ship: ship(s, 'Z', 1).id, path: [0] });
  assert.equal(G.seenEvents(s, 0).filter((e) => e.t === 'move').length, 0, 'far away: hidden');
  assert.equal(view(s, 0).ships.filter((x) => !x.mine).length, 0);
  let n = small([skiff('A', [3, 0], { flagship: true })], [skiff('Z', [-11, 0], { flagship: true }), skiff('Y', [0, 0])]);
  n = G.rgAct(n, { type: 'move', ship: ship(n, 'A').id, path: [0] });
  n = G.rgAct(n, { type: 'move', ship: ship(n, 'Y', 1).id, path: [0] });
  assert.equal(G.seenEvents(n, 0).filter((e) => e.t === 'move').length, 1, 'close by: seen');
});

test('rapid grok: the computer always acts (never passes) and a computer-vs-computer game finishes', () => {
  let s = real(11), n = 0;
  while (s.phase === 'play' && n < 400) {
    const r = G.aiTurn(s, G.toAct(s));
    assert.notEqual(r.action.type, 'end');
    s = r.state; n++;
  }
  assert.equal(s.phase, 'over');
  assert.ok(s.round <= s.rules.turnLimit + 1);
});
