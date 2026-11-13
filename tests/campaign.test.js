// Story campaign engine: chapter loading, script triggers and actions, new mechanics.
// Uses a small fixture campaign written here, not the real chapters (those come later).
import test from 'node:test';
import assert from 'node:assert/strict';
import { start, apply, attempt, buildChapter, applyResult, newCampaign, nextNodes, campaignMove, importGame, exportGame } from '../engine/index.js';
import { applyHits } from '../engine/damage.js';
import { shippedFiles } from './helpers.js';

const { world } = shippedFiles();

const map = { map: {
  name: 'Fixture', board: { shape: 'hexagon', radius: 8 },
  zones: {
    player_1_home: { edge: 'south', depth: 3 }, player_2_home: { edge: 'north', depth: 3 },
    li_arrival: [[0, -5], [2, -5], [-2, -5]], outpost: [[0, 0], [1, 0]],
  },
  setup: { mines: { own_home_zone: true, rows_into_no_mans_land: 6 } },
  terrain: [],
} };

const ships = { ships: {
  'kestrel@ch1': { flagship: true, hull: [
    { at: [-1, 0], bays: ['engine', 'coupling', 'sensor'], mounts: ['laser'] },
    { at: [0, 0], bays: ['core', 'engine', 'magazine'], mounts: ['shield', 'point_defence'] },
    { at: [1, 0], bays: ['engine', 'coupling'], mounts: ['laser', 'armour'] }] },
  sparrow: { hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser'] }] },
  tern: { hull: [{ at: [0, 0], bays: ['core', 'engine', 'coupling'], mounts: ['laser'] }, { at: [1, 0], bays: ['engine', 'sensor'], mounts: ['armour'] }] },
  halcyon: { hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser'] }, { at: [1, 0], bays: ['engine', 'coupling'] }, { at: [0, 1], bays: ['engine', 'coupling'] }] },
  seed: { flagship: true, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser', 'shield'] }, { at: [1, 0], bays: ['engine', 'coupling'], mounts: ['armour'] }] },
  twin: { flagship: true, hull: [
    { at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser'] },
    { at: [1, 0], bays: ['engine', 'coupling'], mounts: ['armour'] },
    { at: [0, 1], bays: ['engine', 'coupling'], mounts: ['point_defence'] },
    { at: [1, -1], bays: ['engine', 'coupling', 'sensor'], mounts: ['laser'] },
    { at: [2, -1], bays: ['engine', 'coupling'], mounts: ['armour'] },
    { at: [2, 0], bays: ['engine', 'coupling'], mounts: ['shield'] }] },
} };

const campaign = { campaign: { id: 'fixture', start: 'ch1', start_state: { roster: ['kestrel', 'sparrow'], capabilities: ['laser'] },
  nodes: [{ id: 'ch1', next: ['ch2'] }, { id: 'ch2', next: ['ch3a', 'ch3b'] }, { id: 'ch3a', next: [] }, { id: 'ch3b', locked: true }] } };

const chapter = (extra) => ({ chapter: {
  id: 'ch1', title: 'Fixture',
  player: { ships: ['kestrel', 'sparrow'], deployment: [{ ship: 'kestrel', at: [0, 7] }, { ship: 'sparrow', at: [2, 6] }] },
  enemy: { ships: ['seed'], deployment: [{ ship: 'seed', at: [0, -7] }], ai: { default: 'hunter' } },
  ai_profiles: { hunter: { level: 'normal', stance: 'hunt' }, sitter: { stance: 'hold' } },
  scenes: { intro: 'ch1_intro', win: ['ch1_victory', 'ch1_salvage'], lose: 'ch1_defeat' },
  ...extra,
} });

const load = (ch, progress) => {
  const r = buildChapter({ world, map, ships, chapter: ch, campaign, progress: progress || newCampaign(campaign) });
  assert.deepEqual(r.problems, []);
  return r.rules;
};
const ship = (g, name) => g.ships.find((s) => s.name === name);
const ends = (g, n) => { for (let i = 0; i < n && g.phase === 'play'; i++) g = apply(g, { type: 'end' }); return g; };
const all = (g) => g.history.length; // keeps lint quiet about unused helpers in some runs

test('a chapter loads: names are campaign ids, the intro scene plays, groups wait off the board', () => {
  const rules = load(chapter({ groups: { li_wing: { side: 'player', ships: ['halcyon', 'tern'], zone: 'li_arrival' } } }));
  const g = start(rules, 3);
  assert.deepEqual(g.ships.map((s) => s.name).sort(), ['kestrel', 'seed', 'sparrow']);
  assert.ok(g.events.some((e) => e.t === 'scene' && e.id === 'ch1_intro'));
  assert.equal(g.phase, 'play');
  assert.ok(all(g) >= 0);
});

test('world overrides apply to that chapter only', () => {
  const rules = load(chapter({ world_overrides: { 'turns.turn_limit': 7, 'bay_parts.comms.link_range': 3 } }));
  assert.equal(rules.turnLimit, 7);
  assert.equal(rules.parts.comms.link_range, 3);
  assert.notEqual(load(chapter()).turnLimit, 7);
});

test('triggers: round fallback, beats chained with after, bark and objective events', () => {
  const g0 = start(load(chapter({ script: [
    { id: 'contact', when: { any: [{ sees: { side: 'player', ship: 'seed' } }, { round: 2 }] }, do: [{ scene: 'ch1_contact' }, { reveal: { ship: 'seed', to: 'player', rounds: 1 } }] },
    { id: 'later', when: { after: { beat: 'contact', rounds: 1 } }, do: [{ bark: 'b1_seed_closing' }, { objective: 'Hold the line' }] },
  ] })), 3);
  assert.ok(!g0.script.fired.contact);
  let g = ends(g0, 2);
  assert.ok(g.script.fired.contact, 'fires at the round fallback');
  assert.ok(g.events.some((e) => e.t === 'scene' && e.id === 'ch1_contact'));
  g = ends(g, 2);
  assert.ok(g.script.fired.later);
  assert.equal(g.script.objective, 'Hold the line');
});

test('doom destroys a ship on time, and destroyed triggers a scene', () => {
  let g = start(load(chapter({ script: [
    { id: 'fate', when: 'start', do: [{ doom: { ship: 'sparrow', by_round: 2 } }] },
    { id: 'down', when: { destroyed: 'sparrow' }, do: [{ scene: 'ch1_finch_down' }] },
  ] })), 3);
  g = ends(g, 2);
  assert.equal(ship(g, 'sparrow').dead, true);
  assert.ok(g.script.fired.down);
  assert.equal(g.phase, 'play', 'losing a non-flagship does not end the chapter');
});

test('default result: destroying the enemy flagship wins and plays the win scenes in order', () => {
  let g = start(load(chapter()), 3);
  const seed = ship(g, 'seed');
  for (let i = 0; i < 20 && !seed.dead; i++) applyHits(g, seed, 0, 1, 'test');
  g = apply(g, { type: 'end' });
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 0);
  assert.deepEqual(g.events.filter((e) => e.t === 'scene').map((e) => e.id), ['ch1_victory', 'ch1_salvage']);
});

test('protect keeps a ship alive until its beat has fired', () => {
  const g = start(load(chapter({ script: [{ id: 'rails', when: 'start', do: [{ protect: { ship: 'kestrel', until: 'free' } }] }] })), 3);
  const k = ship(g, 'kestrel');
  for (let i = 0; i < 3; i++) applyHits(g, k, 1, 10, 'test');
  assert.equal(k.dead, false);
  assert.ok(k.segs[1].parts.some((p) => p.t === 'core' && p.hp > 0));
  g.script.fired.free = { round: 1, turns: 1 };
  applyHits(g, k, 1, 10, 'test');
  assert.equal(k.dead, true);
});

test('split: one ship becomes two, keeping cells and damage; a piece without a core gets one', () => {
  const ch = chapter({ enemy: { ships: ['twin'], deployment: [{ ship: 'twin', at: [-1, -7] }] },
    win: [{ destroyed: 'twin_a' }],
    script: [{ id: 'split', when: { round: 2 }, do: [{ split: { ship: 'twin', into: [
      { id: 'twin_a', flagship: true, cells: [[0, 0], [1, 0], [0, 1]] }, { id: 'twin_b', cells: [[1, -1], [2, -1], [2, 0]] }] } }, { scene: 'ch3_split' }] }] });
  let g = start(load(ch), 3);
  applyHits(g, ship(g, 'twin'), 4, 1, 'test');   // dent the armour on the piece that becomes twin_b
  g = ends(g, 2);
  assert.equal(ship(g, 'twin'), undefined, 'the original is gone from the board');
  const a = ship(g, 'twin_a'), b = ship(g, 'twin_b');
  assert.equal(a.flagship, true);
  assert.equal(a.segs.length, 3);
  assert.equal(b.segs.length, 3);
  assert.ok(b.segs.some((sg) => sg.parts.some((p) => p.t === 'core')), 'twin_b was given a core');
  assert.ok(b.segs.some((sg) => sg.parts.some((p) => p.t === 'armour' && p.hp === 1)), 'damage carried over');
  assert.deepEqual(a.pos, [-1, -7]);
  assert.deepEqual(b.pos, [0, -8]);
  for (let i = 0; i < 30 && !b.dead; i++) applyHits(g, b, 0, 1, 'test');
  g = apply(g, { type: 'end' });
  assert.equal(g.phase, 'play', 'only twin_a ends this chapter');
});

test('spawn: a group arrives in its zone and the player controls it', () => {
  const ch = chapter({ groups: { li_wing: { side: 'player', ships: ['halcyon', 'tern'], zone: 'li_arrival' } },
    script: [{ id: 'arrive', when: { turn: { round: 2, side: 'player' } }, do: [{ spawn: 'li_wing' }, { scene: 'ch3_li_arrives' }] }] });
  let g = start(load(ch), 3);
  g = ends(g, 2);
  while (g.order[g.turn] !== 0) g = ends(g, 1);
  const h = ship(g, 'halcyon'), t = ship(g, 'tern');
  assert.ok(h && t);
  assert.equal(h.owner, 0);
  assert.ok([[0, -5], [2, -5], [-2, -5]].some((c) => c[0] === h.pos[0] && c[1] === h.pos[1]));
  assert.ok(attempt(g, { type: 'move', ship: h.id, path: [5] }).ok, 'the player can order it');
});

test('a reserve enemy flagship does not hand the player a win before it arrives', () => {
  const ch = chapter({ enemy: { ships: [], deployment: [] }, groups: { bloom: { side: 'enemy', ships: ['seed'], zone: 'li_arrival' } },
    script: [{ id: 'arrival', when: { round: 3 }, do: [{ spawn: 'bloom' }] }] });
  let g = start(load(ch), 3);
  g = ends(g, 3);
  assert.equal(g.phase, 'play');
  g = ends(g, 2);
  assert.ok(ship(g, 'seed'));
  assert.equal(g.phase, 'play');
});

test('seize: lock the helm, switch shields off, force a move toward the enemy each turn', () => {
  const ch = chapter({ script: [{ id: 'seam', when: { round: 2 }, do: [
    { lock: { ship: 'kestrel', actions: 'all', until: 'end' } },
    { disable: { ship: 'kestrel', parts: ['shield', 'point_defence'] } },
    { force: { ship: 'kestrel', do: [{ move_toward: 'seed' }], each_turn: true } },
    { light: { ship: 'kestrel', rounds: 5 } }] }] });
  let g = start(load(ch), 3);
  g = ends(g, 2);
  while (g.order[g.turn] !== 0) g = ends(g, 1);
  const k = ship(g, 'kestrel');
  assert.ok(g.script.fired.seam);
  assert.notDeepEqual(k.pos, [0, 7], 'kestrel moved on its own');
  assert.ok(k.segs[1].parts.find((p) => p.t === 'shield').off);
  const r = attempt(g, { type: 'fire', ship: k.id, seg: 0, part: 3, at: [0, 0] });
  assert.equal(r.ok, false);
  assert.match(r.why, /not answering/);
  const other = attempt(g, { type: 'scan', ship: ship(g, 'sparrow').id });
  assert.doesNotMatch(other.why || '', /not answering/, 'other ships still obey');
});

test('graft: locked until unlocked, then two touching ships become one and the beat fires', () => {
  const ch = chapter({
    player: { ships: ['kestrel', 'tern'], deployment: [{ ship: 'kestrel', at: [0, 7] }, { ship: 'tern', at: [-3, 7] }] },
    script: [
      { id: 'gift', when: 'start', do: [{ unlock: 'graft' }, { objective: 'Graft them' }] },
      { id: 'joined', when: { grafted: ['kestrel', 'tern'] }, do: [{ scene: 'ch4a_outro' }, { end: { result: 'win' } }] }],
  });
  const noTech = chapter({ player: { ships: ['kestrel', 'tern'], deployment: [{ ship: 'kestrel', at: [0, 7] }, { ship: 'tern', at: [-3, 7] }] } });
  const g0 = start(load(noTech), 3);
  assert.match(attempt(g0, { type: 'graft', ship: ship(g0, 'kestrel').id, with: ship(g0, 'tern').id }).why, /technology/);
  let g = start(load(ch), 3);
  g = apply(g, { type: 'graft', ship: ship(g, 'kestrel').id, with: ship(g, 'tern').id });
  const k = ship(g, 'kestrel');
  assert.equal(k.segs.length, 5);
  assert.equal(ship(g, 'tern'), undefined);
  assert.equal(k.seams[0].kind, 'weave');
  assert.equal(g.phase, 'over');
  assert.equal(g.script.result, 'win');
  // the grafted hull carries into the next chapter, two cores and all
  const progress = applyResult(newCampaign(campaign), ch, g);
  assert.deepEqual(progress.completed, ['ch1']);
  assert.ok(!progress.roster.some((r) => r.id === 'tern'));
  const next = { chapter: { id: 'ch2', player: { ships: ['kestrel'], deployment: [{ ship: 'kestrel', at: [0, 7] }] },
    enemy: { ships: ['seed'], deployment: [{ ship: 'seed', at: [0, -7] }] } } };
  const r = buildChapter({ world, map, ships, chapter: next, campaign, progress });
  assert.deepEqual(r.problems, []);
  const g2 = start(r.rules, 1);
  assert.equal(ship(g2, 'kestrel').segs.length, 5);
  assert.equal(ship(g2, 'kestrel').seams[0].kind, 'weave', 'the seam came along');
});

test('docking clamps: the joined ship pays a command point per extra core', () => {
  const ch = chapter({
    player: { ships: ['kestrel', 'tern'], deployment: [{ ship: 'kestrel', at: [0, 7] }, { ship: 'tern', at: [-3, 7] }] },
    script: [{ id: 'clamps', when: 'start', do: [{ unlock: 'dock' }] }] });
  const toNextTurn = (g) => { g = ends(g, 1); while (g.order[g.turn] !== 0) g = ends(g, 1); return g; };
  let docked = start(load(ch), 3), apart = start(load(ch), 3);
  docked = apply(docked, { type: 'dock', ship: ship(docked, 'kestrel').id, with: ship(docked, 'tern').id });
  docked = toNextTurn(docked); apart = toNextTurn(apart);
  assert.equal(ship(docked, 'kestrel').segs.length, 5);
  // docking cost 1 point (so 1 less banked) and the second core costs 1 more at the turn start
  assert.equal(apart.players[0].cp - docked.players[0].cp, 2);
});

test('set_rule changes a world value mid-battle; remove takes a ship off without a kill', () => {
  const ch = chapter({ script: [
    { id: 'jam', when: { round: 2 }, do: [{ set_rule: { path: 'bay_parts.comms.link_range', value: 2 } }, { remove: { ship: 'sparrow', as: 'withdraw' } }] }] });
  let g = start(load(ch), 3);
  assert.equal(g.rules.parts.comms.link_range, 12);
  g = ends(g, 2);
  assert.equal(g.rules.parts.comms.link_range, 2);
  assert.ok(g.rules.campaign, 'the chapter survives the rebuild');
  assert.equal(ship(g, 'sparrow').removed, 'withdraw');
  assert.ok(!g.script.fired.dead_sparrow);
});

test('end: to_be_continued stops the chapter and counts as progress', () => {
  const ch = chapter({ scenes: { intro: 'ch5_intro', tbc: 'ch5_cliff' }, script: [{ id: 'cliff', when: { round: 2 }, do: [{ end: { result: 'to_be_continued' } }] }] });
  let g = start(load(ch), 3);
  g = ends(g, 2);
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 'to_be_continued');
  assert.ok(g.events.some((e) => e.t === 'scene' && e.id === 'ch5_cliff'));
  assert.deepEqual(applyResult(newCampaign(campaign), ch, g).completed, ['ch1']);
});

test('campaign graph: start node first, forks open after, locked nodes never', () => {
  let p = newCampaign(campaign);
  assert.deepEqual(nextNodes(campaign, p).map((n) => n.id), ['ch1']);
  p.completed = ['ch1', 'ch2'];
  assert.deepEqual(nextNodes(campaign, p).map((n) => n.id), ['ch3a']);
});

test('the computer follows its profile and its choices are repeatable', () => {
  const ch = chapter({ enemy: { ships: ['seed'], deployment: [{ ship: 'seed', at: [0, -7] }], ai: { default: 'sitter' } } });
  let g = start(load(ch), 3);
  g = ends(g, 1);
  for (let i = 0; i < 4; i++) {
    const a = campaignMove(g, 1), b = campaignMove(g, 1);
    assert.deepEqual(a, b);
    assert.notEqual(a.type, 'move', 'a "hold" ship never moves');
    g = apply(g, a);
    if (a.type === 'end') break;
  }
});

test('a story chapter survives export and import', async () => {
  const ch = chapter({ script: [{ id: 'contact', when: { round: 2 }, do: [{ scene: 'ch1_contact' }] }] });
  let g = start(load(ch), 3);
  g = ends(g, 2);
  const code = await exportGame(g);
  const back = await importGame(code);
  assert.ok(back.script.fired.contact);
  assert.ok(back.rules.campaign);
});

test('triggers: zone, distance, hull, part lost, fired at', () => {
  const ch = chapter({ script: [
    { id: 'zone', when: { in_zone: { side: 'player', zone: 'outpost' } }, do: [{ flag: 'z' }] },
    { id: 'near', when: { distance_below: { a: 'kestrel', b: 'seed', hexes: 20 } }, do: [] },
    { id: 'hurt', when: { hull_below: { ship: 'seed', pct: 90 } }, do: [] },
    { id: 'armour', when: { part_lost: { ship: 'seed', part: 'armour' } }, do: [] },
    { id: 'shot', when: { fired_at: { by: 'kestrel', target: 'seed' } }, do: [] }] });
  let g = start(load(ch), 3);
  assert.ok(g.script.fired.near, 'everything on this board is within 20 hexes');
  assert.ok(!g.script.fired.zone && !g.script.fired.hurt);
  const seed = ship(g, 'seed');
  applyHits(g, seed, 1, 3, 'test');                       // strips the armour (2 hp) and more
  const k = ship(g, 'kestrel');
  k.pos = [0, 0];                                         // teleport into the outpost and laser range
  g = apply(g, { type: 'end' });
  g = apply(g, { type: 'end' });
  assert.ok(g.script.fired.zone && g.script.flags.z);
  assert.ok(g.script.fired.hurt && g.script.fired.armour);
  while (g.order[g.turn] !== 0) g = apply(g, { type: 'end' });
  const kk = ship(g, 'kestrel');
  const laser = kk.segs[0].parts.findIndex((p) => p.t === 'laser');
  const r = attempt(g, { type: 'fire', ship: kk.id, seg: 0, part: laser, at: ship(g, 'seed').pos });
  if (r.ok) assert.ok(r.state.script.fired.shot, 'firing at the seed fires the beat');
});

test('path_via: an advancing ship heads for its zone first', () => {
  const ch = chapter({ enemy: { ships: ['seed'], deployment: [{ ship: 'seed', at: [-2, -6] }], ai: { default: 'route' } },
    ai_profiles: { route: { stance: 'advance', path_via: 'outpost', scans: false, avoid_mines: false } } });
  let g = start(load(ch), 3);
  g = ends(g, 1);
  const before = ship(g, 'seed').pos.slice();
  let a = campaignMove(g, 1);
  for (let i = 0; i < 4 && a.type !== 'move'; i++) { g = apply(g, a); a = campaignMove(g, 1); }
  assert.equal(a.type, 'move');
  g = apply(g, a);
  const d = (p) => Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[0] + p[1]));
  assert.ok(d(ship(g, 'seed').pos) < d(before), 'closer to the outpost in the middle');
});
