// The player's log: every line that reaches the screen is real text (never null, undefined or empty),
// story ships go by their names with no codes, and repeats are merged.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../engine/index.js';
import { computerMove } from '../engine/ai.js';
import { loadBoard } from '../tools/boards.mjs';
import { camp, readYaml } from '../campaign/tools/lib.mjs';
import { describeEvent, logLines, tally, shipNamer } from '../ui/words.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function chapterRules(id) {
  const campaignDoc = camp('campaign.yaml'), shipsDoc = camp('ships.yaml');
  let progress = E.newCampaign(campaignDoc);
  for (const node of campaignDoc.campaign.nodes) {
    if (!node.file) continue;
    const chDoc = camp(node.file);
    if (chDoc.chapter.id === id) {
      const world = readYaml(path.join(root, 'rules', chDoc.chapter.world || 'world_v0.4.yaml'));
      return E.buildChapter({ world, map: camp(chDoc.chapter.map), ships: shipsDoc, chapter: chDoc, campaign: campaignDoc, progress }).rules;
    }
    progress = E.applyResult(progress, chDoc, { script: { result: 'win', flags: {} }, ships: [], winner: 0 });
  }
  throw new Error('no chapter ' + id);
}

// Play a whole game with the computer on both seats. Returns every event with the game it came from.
function playAll(rules, seed, mover) {
  let g = E.start(rules, seed), all = [];
  for (let n = 0; g.phase === 'play' && n < 600; n++) {
    const seat = g.order[g.turn];
    let a = mover(g, seat), r = E.attempt(g, a);
    if (!r.ok) { a = { type: 'end' }; r = E.attempt(g, a); }
    g = r.state;
    for (const e of g.events) all.push({ g, e });
  }
  return { g, all };
}

const bad = (text) => typeof text !== 'string' || !text.trim() || /\b(null|undefined)\b|\[object/.test(text);

for (const id of ['ch1', 'ch2']) {
  test(`${id}: no log line is null, undefined or empty, and ships go by name`, () => {
    const { g, all } = playAll(chapterRules(id), 1, (s, seat) => E.campaignMove(s, seat));
    let lines = 0;
    for (const seat of [0, 1]) {
      for (const { g: gg, e } of all) {
        if (!e.seenBy.includes(seat)) continue;
        for (const l of logLines(gg, seat, [e])) {
          lines++;
          assert.ok(!bad(l.text), `${e.t}: ${JSON.stringify(l.text)}`);
          assert.ok(!/\b[12][a-z]\b/.test(l.text), `a ship code in "${l.text}"`);
          assert.ok(!/"[a-z]+"/.test(l.text), `a lowercase quoted name in "${l.text}"`);
          assert.ok(!/\[-?\d+, -?\d+\]/.test(l.text), `a raw coordinate in "${l.text}"`);
        }
      }
    }
    assert.ok(lines > 10);
    // the lists the screen builds from the player's feed: nothing empty, and nothing in both
    const v = E.view(g, 0), inNews = new Set(v.news.map((e) => e.n));
    const earlier = logLines(g, 0, v.feed.filter((e) => !inNews.has(e.n)));
    for (const l of [...logLines(g, 0, v.news), ...earlier]) assert.ok(!bad(l.text), l.text);
    assert.ok(v.feed.some((e) => !describeEvent(g, 0, e)), 'premise: the feed holds script-only events that have no words');
  });
}

test('a skirmish game keeps ship codes, and its lines are never null or empty either', () => {
  const { rules } = loadBoard('01_first_light');
  const { all } = playAll(rules, 3, (s, seat) => computerMove(s, seat, 'normal') || { type: 'end' });
  let codes = 0;
  for (const { g, e } of all) {
    for (const l of logLines(g, 0, [e])) { assert.ok(!bad(l.text), `${e.t}: ${JSON.stringify(l.text)}`); if (/\b[12][a-z]\b/.test(l.text)) codes++; }
  }
  assert.ok(codes > 0, 'the ship_codes switch is on there, so codes stay');
});

test('repeats are merged, and a shield that took every hit says the hull is untouched', () => {
  assert.deepEqual(tally(['shield down', 'shield down', 'sensor destroyed']), ['shield down \u00d72', 'sensor destroyed']);
  const g = E.start(chapterRules('ch1'), 1);
  const seed = g.ships.find((s) => s.name === 'seed');
  const text = describeEvent(g, 0, { t: 'hit', ship: seed.id, seg: 0, hits: 2, lost: ['shield down', 'shield down'], hull: 100, seenBy: [0] });
  assert.match(text, /Hit Seed section 1 with 2 hits: shield down \u00d72\./);
  assert.match(text, /hull is untouched/);
  assert.equal(shipNamer(g)(seed.id), 'Seed');
});

test('a sighting in story reads in a short sentence: who saw it, no coordinates or sums', () => {
  const g = E.start(chapterRules('ch1'), 1);
  const finch = g.ships.find((s) => s.name === 'finch');
  const text = describeEvent(g, 0, { t: 'sighted', kind: 'missile', at: [1, -4], id: 'o3', why: { by: finch.id, d: 5, range: 4, sig: 1 }, seenBy: [0] });
  assert.equal(text, 'Finch spotted an incoming missile.');
});
