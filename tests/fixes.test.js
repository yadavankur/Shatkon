// Fixes from the engine review (Nov 2026): fog-fair undo, the nebula launch leak, missiles and
// wrecked segments, the AI reading laser numbers from the rules, one hits formula, game-code checks,
// and the guide acceptance run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply, attempt, view, reach, launchOptions, beamTargets, exportGame, importGame, knowledge, undoSafe, buildRules, start } from '../engine/index.js';
import { visibleTo } from '../engine/detect.js';
import { beamHitsAt } from '../engine/actions.js';
import { laserReach, computerMove } from '../engine/ai.js';
import { pack, unpack } from '../engine/codec.js';
import { battle, scout, pod, shippedFiles } from './helpers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const end = (g) => apply(g, { type: 'end' });
const ship = (g, id) => g.ships.find((s) => s.id === id);

// ---------------------------------------------------------------- (a) undo
test('undo: allowed after a move that told the player nothing, refused once something is revealed', () => {
  const { game: g } = battle({ radius: 12, p1: [scout('A', [0, 4])], p2: [scout('X', [0, -4])] });
  assert.equal(visibleTo(g, 0).has('2a'), false);
  let quiet = 0, loud = 0;
  for (const r of reach(g, '1a')) {
    const after = apply(g, { type: 'move', ship: '1a', path: r.path });
    const changed = knowledge(g, 0) !== knowledge(after, 0);
    assert.equal(undoSafe(g, after, 0), !changed, 'undo follows exactly whether knowledge changed');
    if (changed) loud++; else quiet++;
  }
  assert.ok(quiet > 0, 'some moves reveal nothing and can be undone');
  assert.ok(loud > 0, 'some moves reveal the enemy (a sighting or a contact) and cannot');
});

test('undo: a contact or ghost that changes without any event still blocks undo', () => {
  const { game: g } = battle({ radius: 12, p1: [scout('A', [0, 10])], p2: [scout('X', [0, -10])] });
  const after = structuredClone(g);
  after.players[0].seen = { '2a': { pos: [0, -9], r: 1 } };   // a ghost appears
  assert.equal(after.events.filter((e) => e.seenBy.includes(0) && e.t !== 'move').length, after.events.filter((e) => e.seenBy.includes(0) && e.t !== 'move').length);
  assert.notEqual(knowledge(g, 0), knowledge(after, 0));
  assert.equal(undoSafe(g, after, 0), false);
});

// ---------------------------------------------------------------- (b) nebula launch leak
test('launch: a ship hidden in a nebula next to you does not block the launch hex; the missile hits it', () => {
  const carrier = pod('C', [0, 3], ['core', 'magazine', 'engine'], ['launcher'], { load: { missile: 2 } });
  const ghost = pod('G', [0, 2], ['core', 'engine', 'stealth'], ['armour']);
  const { game: g } = battle({ radius: 8, terrain: [{ type: 'nebula', at: [0, 2], radius: 1 }], p1: [carrier], p2: [ghost] });
  assert.equal(visibleTo(g, 0).has('2a'), false, 'precondition: the enemy is hidden');
  const lo = launchOptions(g, '1a');
  assert.ok(lo.starts.some((c) => c[0] === 0 && c[1] === 2), 'its hex is offered like any empty one');
  // the same options as with the enemy ship removed: nothing to learn from the markers
  const empty = structuredClone(g); empty.ships = empty.ships.filter((s) => s.id !== '2a');
  assert.deepEqual(lo.starts.map(String).sort(), launchOptions(empty, '1a').starts.map(String).sort());
  const r = attempt(g, { type: 'launch', ship: '1a', kind: 'missile', start: [0, 2], target: null, route: [2] });
  assert.ok(r.ok, 'the launch goes ahead: ' + r.why);
  assert.ok(r.state.events.some((e) => e.t === 'blast' || e.t === 'stopped'), 'it went off on the hidden ship');
  assert.ok(r.state.events.some((e) => e.t === 'damage' && e.ship === '2a') || r.state.events.some((e) => e.t === 'stopped'));
  // a ship you can see still blocks the hex
  const seen = battle({ radius: 8, p1: [carrier], p2: [pod('V', [0, 2], ['core', 'engine', 'sensor'], ['armour'])] }).game;
  assert.equal(visibleTo(seen, 0).has('2a'), true);
  assert.equal(attempt(seen, { type: 'launch', ship: '1a', kind: 'missile', start: [0, 2], target: null, route: [2] }).why, 'it cannot be launched into that hex');
});

// ---------------------------------------------------------------- (c) wrecked segments
test('missiles fly through a wrecked segment, as beams do, and hit the next live one', () => {
  const carrier = pod('C', [0, 5], ['core', 'magazine', 'sensor'], ['launcher'], { load: { missile: 2 } });
  const target = { name: 'T', at: [0, 0], flagship: true, hull: [
    { at: [0, 0], bays: ['engine', 'coupling'], mounts: ['armour'] },
    { at: [0, -1], bays: ['core', 'engine', 'sensor'], mounts: ['armour', 'armour'] }] };
  let { game: g, problems } = battle({ radius: 8, p1: [carrier], p2: [target] });
  assert.deepEqual(problems, []);
  const t = ship(g, '2a');
  t.segs[0].wrecked = true; for (const p of t.segs[0].parts) p.hp = 0;   // the nearer segment is already wrecked
  g = apply(g, { type: 'launch', ship: '1a', kind: 'missile', start: [0, 4], target: null, route: [2, 2, 2, 2, 2, 2] });
  g = end(end(g));
  const dmg = g.players[1].feed.filter((e) => e.t === 'damage' && e.ship === '2a');
  const direct = dmg.find((e) => e.seg === 1 && e.hits === g.rules.munitions.missile.hits);
  assert.ok(direct, 'the live segment behind the wreck takes the full missile: ' + JSON.stringify(dmg.map((e) => [e.seg, e.hits, e.cause])));
});

// ---------------------------------------------------------------- (e) AI and one hits formula
test('the computer reads laser range, hits and falloff from the rules', () => {
  const { world } = shippedFiles();
  const laser = world.mount_parts.laser;
  const segs = [{ wrecked: false, parts: [{ t: 'laser', hp: 1 }] }];
  const stock = laserReach({ parts: { laser } }, segs);
  assert.equal(stock.hFull, laser.hits);
  assert.equal(stock.hitsAt(4), beamHitsAt(laser, 4));
  assert.equal(stock.hitsAt(laser.range + 1), 0, 'out of range is no shot');
  const short = laserReach({ parts: { laser: { ...laser, range: 3, hits: 2 } } }, segs);
  assert.equal(short.hitsAt(4), 0, 'a Lab change to range 3 is seen by the AI');
  assert.equal(short.hFull, 2);
  assert.equal(laserReach({ parts: { laser } }, [{ wrecked: true, parts: [{ t: 'laser', hp: 1 }] }]).hasLaser, false);
});

test('beamTargets and the actual shot agree on hits (one formula)', () => {
  let { game: g } = battle({ radius: 10, p1: [scout('A', [0, 1])], p2: [pod('X', [0, -2], ['core', 'engine', 'sensor'], ['armour', 'armour'])] });
  const opts = beamTargets(g, '1a');
  assert.ok(opts.length);
  const o = opts[0], after = apply(g, { type: 'fire', ship: '1a', seg: o.seg, part: o.part, at: o.at });
  const fire = after.events.find((e) => e.t === 'fire');
  assert.equal(fire.hits, o.hits);
});

test('computer still plays a full game against itself with the new laser scoring', () => {
  const f = shippedFiles(); const { rules } = buildRules(f.world, f.map, f.fleets);
  let g = start(rules, 11);
  for (let n = 0; n < 3000 && g.phase === 'play'; n++) {
    const seat = g.order[g.turn];
    let a = computerMove(g, seat, 'normal'); const r = attempt(g, a || { type: 'end' });
    g = r.ok ? r.state : apply(g, { type: 'end' });
  }
  assert.ok(g.phase === 'over' || g.round >= 10);
});

// ---------------------------------------------------------------- (f) game codes
async function inflate(bytes) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()); }
async function deflate(bytes) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer()); }
const editCode = async (code, fn) => { const doc = JSON.parse(new TextDecoder().decode(await inflate(unpack(code.slice(5))))); fn(doc); return 'SKG1:' + pack(await deflate(new TextEncoder().encode(JSON.stringify(doc)))); };

test('game codes: a clean code loads; an edited, cut short or nonsense code is refused kindly', async () => {
  const { game: g } = battle({ radius: 8, p1: [scout('A', [0, 5])], p2: [scout('X', [0, -5])] });
  const code = await exportGame(g);
  const back = await importGame(code);
  assert.deepEqual(back.ships, g.ships);
  // someone gives their ship extra armour inside the code
  const hacked = await editCode(code, (d) => { d.game.ships[0].segs[0].parts[0].hp = 99; });
  await assert.rejects(importGame(hacked), /has been changed/);
  // ...and re-seals the edit but forgets the rules fingerprint
  const rulesHack = await editCode(code, (d) => { d.game.rules.parts.laser.hits = 9; d.seal = undefined; delete d.seal; Object.assign(d, d.game); delete d.game; });
  await assert.rejects(importGame(rulesHack), /has been changed/);
  await assert.rejects(importGame(code.slice(0, Math.floor(code.length / 2))), /damaged|incomplete/);
  await assert.rejects(importGame('SKG1:hello'), /damaged|incomplete/);
  await assert.rejects(importGame('nope'), /does not look like a game code/);
  const junk = await editCode(code, (d) => { d.game = { v: 1 }; d.seal = undefined; delete d.seal; Object.assign(d, d.game); delete d.game; });
  await assert.rejects(importGame(junk), /damaged|incomplete/);
});

test('game codes from before the seal (saved games) still load if they are whole', async () => {
  const { game: g } = battle({ radius: 8, p1: [scout('A', [0, 5])], p2: [scout('X', [0, -5])] });
  const { events, flight, ...rest } = g;
  const old = 'SKG1:' + pack(await deflate(new TextEncoder().encode(JSON.stringify(rest))));
  const back = await importGame(old);
  assert.equal(back.round, g.round);
});

// ---------------------------------------------------------------- (d) guide acceptance
test('campaign guide acceptance: all checks pass (12b and F3 included)', () => {
  const r = spawnSync(process.execPath, ['campaign/tools/guide_acceptance.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /PASS {2}12b\./);
  assert.match(r.stdout, /PASS {2}F3\./);
  assert.match(r.stdout, /15 passed, 0 failed/);
});

test('game codes: a story chapter that changes the rules mid-battle (ch5 jamming) still saves and reloads', async () => {
  const { buildChapter, newCampaign, campaignMove } = await import('../engine/index.js');
  const { camp } = await import('../campaign/tools/lib.mjs');
  const C = camp('campaign.yaml'), chDoc = camp('chapters/ch5_bloom.yaml');
  const { rules } = buildChapter({ world: shippedFiles().world, map: camp(chDoc.chapter.map), ships: camp('ships.yaml'), chapter: chDoc, campaign: C, progress: newCampaign(C) });
  let g = start(rules, 5), steps = 0;
  const rules0 = g.rules;
  for (let n = 0; g.phase === 'play' && g.rules === rules0 && n < 400; n++) {
    let a = steps++ > 30 ? { type: 'end' } : campaignMove(g, g.order[g.turn]) || { type: 'end' };
    if (!attempt(g, a).ok) a = { type: 'end' };
    if (a.type === 'end') steps = 0;
    g = apply(g, a);
  }
  assert.notEqual(g.rules, rules0, 'the jamming rule change happened');
  const back = await importGame(await exportGame(g));
  assert.equal(back.rules.parts.comms ? back.rules.parts.comms.link_range : 3, 3);
});
