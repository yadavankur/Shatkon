// The beta computer opponent (beta/engine/ai.js) and its personalities (beta/rules/world_v0.4.yaml, `ai:`).
// These run against the beta engine and the beta rule files, not the root game.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../beta/engine/index.js';
import { computerMove, personalityOf } from '../beta/engine/ai.js';
import { loadRules, playGame, policy } from '../tools/sim.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const YAML = vm.runInThisContext(fs.readFileSync(path.join(root, 'beta/lib/yaml.min.js'), 'utf8') + '\n;YAML');
const world = () => YAML.parse(fs.readFileSync(path.join(root, 'beta/rules/world_v0.4.yaml'), 'utf8'));

// A small battle on the beta engine. ships: [{ name, at, flagship, hull, load }]
function battle({ radius = 10, terrain = [], p1, p2, extra1 = [], extra2 = [], seed = 7, tweak }) {
  const w = world();
  if (tweak) tweak(w);
  const side = (ships, extra) => ({ ships: ships.map((s) => ({ name: s.name, flagship: !!s.flagship, hull: s.hull, load: s.load })), deployment: ships.map((s) => ({ ship: s.name, at: s.at })).concat(extra) });
  const built = E.buildRules(w, { map: { board: { shape: 'hexagon', radius }, terrain } }, { budget: 99999, player_1: side(p1, extra1), player_2: side(p2, extra2) });
  assert.deepEqual(built.problems, []);
  return E.start(built.rules, seed);
}
const gunboat = (name, at, more = {}) => ({ name, at, flagship: true, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser', 'armour'] }], ...more });
const endTurn = (g) => E.apply(g, { type: 'end' });

test('beta world file: three personalities, and the rules build cleanly', () => {
  const rules = loadRules();
  assert.deepEqual(Object.keys(rules.ai.personalities).sort(), ['aggressive', 'balanced', 'defensive']);
  for (const p of Object.values(rules.ai.personalities)) {
    assert.equal(p.range.length, 2);
    assert.ok(p.range[0] >= 1 && p.range[1] <= rules.parts.laser.range, 'fights from inside laser range');
    assert.ok(p.missile_range >= 1);
  }
});

test('"vs computer: normal" plays a personality; easy, story chapters and profiled ships do not', () => {
  const rules = loadRules(), g = E.start(rules, 3);
  assert.ok(personalityOf(g, 'normal'));
  assert.equal(personalityOf(g, 'normal'), personalityOf(E.start(rules, 3), 'normal'), 'the same game keeps the same opponent');
  assert.equal(personalityOf(g, 'easy'), null);
  assert.equal(personalityOf(g, 'normal', { profiles: {} }), null);
  assert.equal(personalityOf({ ...g, rules: { ...rules, campaign: {} } }, 'normal'), null);
  assert.equal(personalityOf(g, 'normal', { personality: 'defensive' }), rules.ai.personalities.defensive);
  const seen = new Set();
  for (let seed = 1; seed < 40; seed++) seen.add(personalityOf(E.start(rules, seed), 'normal').note);
  assert.equal(seen.size, 3, 'random picks every personality sooner or later');
});

test('a personality steps a hex before firing when it has a command point to spare (attack run)', () => {
  let g = battle({ p1: [gunboat('A', [0, 3])], p2: [gunboat('B', [0, -1])] });
  g = endTurn(g);   // player 2 to move, with B in clear sight 4 hexes away
  assert.equal(E.beamTargets(g, '2a')[0].hits, 3);
  const first = computerMove(g, 1, 'normal', { personality: 'balanced' });
  assert.equal(first.type, 'move', 'steps first');
  g = E.apply(g, first);
  const second = computerMove(g, 1, 'normal', { personality: 'balanced' });
  assert.equal(second.type, 'fire');
  assert.equal(E.beamTargets(g, '2a').find((t) => t.at[0] === second.at[0] && t.at[1] === second.at[1]).hits, 4, 'and the shot is one hit stronger');
  // with the bonus switched off in the world file it just fires
  let g0 = endTurn(battle({ p1: [gunboat('A', [0, 3])], p2: [gunboat('B', [0, -1])], tweak: (w) => { w.detection.attack_run_bonus = 0; } }));
  assert.equal(computerMove(g0, 1, 'normal', { personality: 'balanced' }).type, 'fire');
});

test('a personality with a target in sight but no line of fire moves to get one; it does not wait', () => {
  // an asteroid sits exactly between the two ships
  const terrain = [{ type: 'asteroid', at: [0, 1], size: 1 }];
  let g = endTurn(battle({ p1: [gunboat('A', [0, 3])], p2: [gunboat('B', [0, -1])], terrain }));
  assert.equal(E.beamTargets(g, '2a').length, 0, 'no shot from where it stands');
  for (const name of ['aggressive', 'balanced', 'defensive']) {
    let s = g, fired = false;
    for (let i = 0; i < 6 && !fired; i++) {
      const a = computerMove(s, 1, 'normal', { personality: name });
      assert.notEqual(a.type, 'end', name + ' must not end its turn with a foe in sight and no shot taken');
      fired = a.type === 'fire';
      s = E.apply(s, a);
    }
    assert.ok(fired, name + ' found a line of fire and took the shot the same turn');
  }
});

test('a personality keeps its escort near the flagship on the way in', () => {
  const rules = loadRules();
  let g = E.start(rules, 5);
  for (let i = 0; i < 400 && g.phase === 'play' && g.round <= 4; i++) {
    const seat = g.order[g.turn];
    const a = seat === 0 ? computerMove(g, 0, 'normal', { personality: 'balanced' }) : { type: 'end' };
    const r = E.attempt(g, a);
    g = r.ok ? r.state : E.apply(g, { type: 'end' });
    const mine = g.ships.filter((s) => s.owner === 0 && !s.dead);
    if (mine.length === 2) assert.ok(E.gap(mine[0], mine[1]) <= rules.ai.personalities.balanced.keep_together + 2, 'escort ran ahead: gap ' + E.gap(mine[0], mine[1]) + ' in round ' + g.round);
  }
});

test('a lone flagship boxed in by its own mine and an asteroid still goes hunting (was a 20-round stall)', () => {
  const rules = loadRules();
  const r = playGame(rules, policy('sit'), policy('defensive'), 15839);
  assert.notEqual(r.by, 'turn_limit');
  assert.ok(r.rounds < rules.turnLimit);
});

test('the personalities finish their games: no stalling to the round limit against a fleet that never moves', () => {
  const rules = loadRules();
  for (const name of ['aggressive', 'balanced', 'defensive']) for (const seed of [1, 7920]) {
    const r = playGame(rules, policy(name), policy('sit'), seed);
    assert.notEqual(r.by, 'turn_limit', name + ' seed ' + seed);
    assert.ok(r.stats[0].idleTurns <= 1, name + ' sat out ' + r.stats[0].idleTurns + ' turns');
  }
});

test('a personality that has scanned its targets sends its missile at the one without point defence', () => {
  const carrier = { name: 'C', at: [0, -2], flagship: true, load: { missile: 2 }, hull: [{ at: [0, 0], bays: ['core', 'engine', 'magazine'], mounts: ['launcher'] }, { at: [1, 0], bays: ['coupling', 'engine', 'sensor'], mounts: [] }] };
  const guarded = { name: 'Big', at: [-1, 2], flagship: true, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['point_defence'] }, { at: [1, 0], bays: ['coupling', 'engine'], mounts: ['armour'] }, { at: [-1, 0], bays: ['coupling', 'engine'], mounts: ['armour'] }] };
  const bare = { name: 'Small', at: [3, 0], hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['armour'] }] };
  let g = endTurn(battle({ p1: [guarded, bare], p2: [carrier] }));
  const before = computerMove(g, 1, 'normal', { personality: 'balanced' });
  assert.equal(before.type, 'launch');
  assert.equal(before.target, '1a', 'not scanned yet: it goes for the big ship');
  g = E.apply(g, { type: 'move', ship: '2a', path: [0] });
  g = E.apply(g, { type: 'scan', ship: '2a' });
  const after = computerMove(g, 1, 'normal', { personality: 'balanced' });
  assert.equal(after.type, 'launch');
  assert.equal(after.target, '1b', 'the scan showed point defence on the big one');
});

// ---- missiles (beta rules) ----
const launcherBoat = (name, at) => ({ name, at, flagship: true, load: { missile: 3 }, hull: [{ at: [0, 0], bays: ['core', 'engine', 'magazine'], mounts: ['launcher', 'launcher'] }, { at: [1, 0], bays: ['coupling', 'engine', 'sensor'], mounts: [] }] });
const fly = (g) => endTurn(endTurn(g));   // both seats end: the flight phase runs

test('wrecks_segment: one missile takes a whole unshielded segment, so one kills a one-hex boat', () => {
  const boat = { name: 'Boat', at: [0, 3], flagship: true, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['armour', 'armour'] }] };
  for (const on of [true, false]) {
    let g = endTurn(battle({ p1: [boat], p2: [launcherBoat('L', [0, -1])], tweak: (w) => { w.munitions.missile.wrecks_segment = on; } }));
    g = E.apply(g, E.aimLaunch(g, '2a', 'missile', [0, 3], '1a'));
    g = endTurn(g);
    assert.equal(g.ships.find((s) => s.id === '1a').dead, on, on ? 'wrecked outright' : 'three hits only dent two armour plates');
  }
});

test('wrecks_segment: a working shield takes the missile instead (shield down, ordinary hits)', () => {
  const boat = { name: 'Boat', at: [0, 3], flagship: true, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['shield', 'armour', 'armour'] }] };
  let g = endTurn(battle({ p1: [boat], p2: [launcherBoat('L', [0, -1])], tweak: (w) => { w.munitions.missile.wrecks_segment = true; } }));
  g = E.apply(g, E.aimLaunch(g, '2a', 'missile', [0, 3], '1a'));
  g = endTurn(g);
  const s = g.ships.find((x) => x.id === '1a');
  assert.equal(s.dead, false);
  assert.equal(s.segs[0].wrecked, false);
});

test('a missile flies through a wrecked segment to the one behind it', () => {
  const ship = { name: 'Long', at: [0, 3], flagship: true, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['armour'] }, { at: [0, -1], bays: ['coupling', 'engine'], mounts: [] }] };
  let g = endTurn(battle({ p1: [ship], p2: [launcherBoat('L', [0, -2])], tweak: (w) => { w.munitions.missile.wrecks_segment = true; } }));
  const front = g.ships.find((s) => s.id === '1a').segs[1];
  front.wrecked = true; front.parts.forEach((p) => { p.hp = 0; });
  g = E.apply(g, E.aimLaunch(g, '2a', 'missile', [0, 3], '1a'));
  g = endTurn(g);
  assert.equal(g.ships.find((s) => s.id === '1a').dead, true, 'it passed the wreck at [0,2] and took the core segment at [0,3]');
});

test('salvo rule: one command point fires every ready launcher on the ship', () => {
  const tgt = gunboat('T', [0, 4]);
  let g = endTurn(battle({ p1: [tgt], p2: [launcherBoat('L', [0, -1])], tweak: (w) => { w.actions.launch.salvo = true; } }));
  const cp = g.players[1].cp;
  g = E.apply(g, E.aimLaunch(g, '2a', 'missile', [0, 4]));
  assert.equal(g.players[1].cp, cp - 1);
  g = E.apply(g, E.aimLaunch(g, '2a', 'missile', [0, 4]));
  assert.equal(g.players[1].cp, cp - 1, 'the second launcher fired on the same order');
  assert.equal(E.launchOptions(g, '2a'), null, 'both launchers are spent');
});
