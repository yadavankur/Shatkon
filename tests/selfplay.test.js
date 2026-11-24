// Me v me (engine/swap.js) and the computer using experiments (engine/labai.js) on the Lab board.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readYaml, shippedFiles } from './helpers.js';
import * as E from '../engine/index.js';

const lab = (on = [], opts = {}, seed = 5) => {
  const b = readYaml('rules/rapid/rapid_lab.yaml');
  const { rules } = E.buildRules(shippedFiles().world, b, b);
  const g = E.rapidStart(E.rapidRules({ ...rules, rapid: b.rapid }, { unlock: 'permanent', exp: Object.fromEntries(on.map((k) => [k, true])), ...opts }), seed);
  g.rapid.ever = [true, true];
  return g;
};
const ship = (g, name, p) => g.ships.find((x) => x.owner === p && x.name === name);
const see = (g) => { for (const p of [0, 1]) g.players[p].vis = g.ships.filter((x) => !x.dead).map((x) => x.id); };

test('swapSides: player 2 sees the same game as player 1 would, and their choices are the same actions', () => {
  let s = lab(['decoy', 'ram'], {}, 7);
  let checked = 0;
  for (let t = 0; t < 12 && s.phase === 'play'; t++) {
    const w = E.swapSides(s);
    assert.equal(E.purse(w, 0), E.purse(s, 1));
    assert.deepEqual(w.ships.filter((x) => x.owner === 0).map((x) => x.id), s.ships.filter((x) => x.owner === 1).map((x) => x.id));
    for (const m of E.legalMoves(s, 1)) { checked++; assert.equal(E.rapidRefusal(w, 0, m), E.rapidRefusal(s, 1, m)); }
    const two = E.rapidAI(w, 0, 'normal', () => 0.4);
    assert.equal(E.rapidRefusal(s, 1, two), null, 'a pick made on the swapped game is legal for player 2');
    s = E.rapidTick(s, [E.rapidAI(s, 0, 'normal', () => 0.3), two]);
  }
  assert.ok(checked > 20);
  assert.equal(E.swapSides(E.swapSides(s)).swapped, false);
});

test('labAI: nothing switched on, nothing changes', () => {
  const s = lab([]);
  const a = { type: 'pass' };
  assert.equal(E.labAI(s, 1, a), a);
});

test('labAI ram: a crippled scout next to a big ship rams it; never means never', () => {
  for (const k of ['sometimes', 'eager', 'never']) {
    const g = lab(['ram'], { cpuExp: { ram: k } });
    const me = ship(g, 'Pawn A', 1), big = ship(g, 'Warden', 0);
    me.pos = [big.pos[0], big.pos[1] - 2];
    me.segs[0].parts.slice(0, 3).forEach((q) => { q.hp = 0; });   // lost half its parts
    see(g);
    const free = E.legalMoves(g, 1).find((m) => m.ship !== me.id) || { type: 'pass' };
    const a = E.labAI(g, 1, free, () => 0.9);
    if (k === 'never') assert.notEqual(a.type, 'ram');
    else { assert.equal(a.type, 'ram', k); assert.equal(a.target, big.id); assert.equal(E.rapidRefusal(g, 1, a), null); }
  }
});

test('labAI repair and hibernate: a damaged ship gets mended when the computer can pay', () => {
  const g = lab(['repair'], { cpuExp: { repair: 'sometimes' } });
  const x = ship(g, 'Warden', 1);
  let n = 0; for (const sg of x.segs) for (const q of sg.parts) if (n < 3 && q.hp > 0) { q.hp = 0; n++; }
  g.econ.purse[1] = 20;
  const a = E.labAI(g, 1, { type: 'pass' });
  assert.equal(a.type, 'buy'); assert.equal(a.item, 'repair');
  g.econ.purse[1] = 3;
  assert.notEqual(E.labAI(g, 1, { type: 'pass' }).item, 'repair', 'no rekon, no repair');
});

test('labAI decoy: eager puts one out when it can see the enemy', () => {
  const g = lab(['decoy'], { cpuExp: { decoy: 'eager' } });
  see(g);
  const a = E.labAI(g, 1, { type: 'pass' }, () => 0);
  assert.equal(a.type, 'decoy');
  assert.equal(E.rapidRefusal(g, 1, a), null);
});

test('computer v computer with everything on and eager plays to the end without an illegal pick', () => {
  const all = Object.fromEntries(E.EXP_KEYS.map((k) => [k, true]));
  let s = lab([], { exp: all, cpuExp: { ram: 'eager', decoy: 'eager', repair: 'eager', warp: 'eager', hibernate: 'eager' }, cap: 25 }, 11);
  let r = 3; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const used = new Set();
  while (s.phase === 'play') {
    const acts = [0, 1].map((p) => E.rapidAI(s, p, 'normal', rnd));
    acts.forEach((a, p) => { assert.equal(E.rapidRefusal(s, p, a), null, E.tickText(a)); used.add(a.type === 'buy' ? a.item : a.type); });
    s = E.rapidTick(s, acts);
  }
  assert.ok(s.phase === 'over');
});
