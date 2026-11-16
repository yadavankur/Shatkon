// Who moves first (turns.first): random from the game's seed on skirmish boards, pinned on request,
// and always the player in story chapters.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../engine/index.js';
import { loadBoard, playOut } from '../tools/boards.mjs';
import { camp, readYaml } from '../campaign/tools/lib.mjs';
import { shippedFiles } from './helpers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the shipped world picks who moves first at random; a board can pin it', () => {
  assert.equal(shippedFiles().world.turns.first, 'random');
  assert.equal(loadBoard('01_first_light').rules.firstMover, 'random');
  assert.equal(loadBoard('01_first_light', { set: { 'turns.first': 'player_2' } }).rules.firstMover, 'player_2');
  // a world file without the line: player 1 moves first, as before
  const w = structuredClone(shippedFiles().world); delete w.turns.first;
  const { doc } = loadBoard('01_first_light');
  assert.equal(E.buildRules(w, doc, doc).rules.firstMover, 'player_1');
});

test('the first mover comes from the seed: the same seed, the same first mover, and both happen', () => {
  const { rules } = loadBoard('07_beacon_hill');
  const firsts = [];
  for (let seed = 1; seed <= 40; seed++) {
    const a = E.start(rules, seed), b = E.start(rules, seed);
    assert.deepEqual(a.order, b.order);
    assert.equal(E.hashState(a), E.hashState(b));
    assert.equal(a.order[0], E.firstSeat(rules, seed));
    firsts.push(a.order[0]);
  }
  const p2 = firsts.filter((x) => x === 1).length;
  assert.ok(p2 >= 10 && p2 <= 30, 'player 2 moved first in ' + p2 + ' of 40');
  const parity = firsts.filter((x, i) => x === (i + 1) % 2).length;   // not just odd and even seeds
  assert.ok(parity > 8 && parity < 32, 'follows the seed\'s parity in ' + parity + ' of 40');
  // the order still swaps every round
  let g = E.start(rules, firsts.indexOf(1) + 1);
  assert.deepEqual(g.order, [1, 0]);
  g = E.apply(g, { type: 'end' }); g = E.apply(g, { type: 'end' });
  assert.equal(g.round, 2); assert.deepEqual(g.order, [0, 1]);
});

test('pinned first movers', () => {
  for (const [f, seat] of [['player_1', 0], ['player_2', 1]]) {
    const { rules } = loadBoard('01_first_light', { set: { 'turns.first': f } });
    for (let seed = 1; seed <= 10; seed++) assert.equal(E.start(rules, seed).order[0], seat);
  }
});

test('a game where player 2 moves first survives a game code and replays the same', async () => {
  const { rules } = loadBoard('01_first_light');
  const seed = [...Array(20)].map((_, i) => i + 1).find((s) => E.firstSeat(rules, s) === 1);
  const a = E.start(rules, seed);
  assert.equal(a.order[a.turn], 1);
  const b = await E.importGame(await E.exportGame(a));
  assert.equal(E.hashState(a), E.hashState(b));
  assert.deepEqual(b.order, [1, 0]);
  const r1 = playOut(rules, seed), r2 = playOut(rules, seed);
  assert.deepEqual(r1, r2);
  assert.equal(r1.first, 1);
});

test('story chapters keep their scripted order: the player moves first', () => {
  const campaignDoc = camp('campaign.yaml'), shipsDoc = camp('ships.yaml');
  let progress = E.newCampaign(campaignDoc), n = 0;
  for (const node of campaignDoc.campaign.nodes) {
    if (!node.file) continue;
    const chDoc = camp(node.file);
    const world = readYaml(path.join(root, 'rules', chDoc.chapter.world || 'world_v0.4.yaml'));
    const { rules } = E.buildChapter({ world, map: camp(chDoc.chapter.map), ships: shipsDoc, chapter: chDoc, campaign: campaignDoc, progress });
    assert.equal(rules.firstMover, 'player_1', chDoc.chapter.id);
    for (let seed = 1; seed <= 12; seed++) assert.equal(E.start(rules, seed).order[0], 0, chDoc.chapter.id + ' seed ' + seed);
    progress = E.applyResult(progress, chDoc, { script: { result: 'win', flags: {} }, ships: [], winner: 0 });
    n++;
  }
  assert.ok(n >= 5);
});
