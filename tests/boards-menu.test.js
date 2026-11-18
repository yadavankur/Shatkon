// The landing-page picker reads boards.html, so that file is the menu:
// display order, difficulty, and links. Board file names do not change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'boards.html'), 'utf8');

const ORDER = [
  ['01_first_light', 'medium', 'First Light'],
  ['07_beacon_hill', 'easy', 'Beacon Hill'],
  ['03_cat_and_mouse', 'easy', 'Cat and Mouse'],
  ['09_fog_bank', 'easy', 'Fog Bank'],
  ['06_pawn_storm', 'easy', 'Pawn Storm'],
  ['10_gambit', 'medium', 'The Gambit'],
  ['05_kings_guard', 'medium', "King's Guard"],
  ['04_the_dogleg', 'medium', 'The Dogleg'],
  ['02_minefield', 'hard', 'The Minefield'],
  ['08_missile_alley', 'hard', 'Missile Alley'],
];
const FILL = { easy: 2, medium: 4, hard: 6 };

test('the board menu lists all ten boards in the player difficulty order, with stars and previews', () => {
  const cards = [...html.matchAll(/<a class="board" href="play\.html\?board=([^"]+)" data-difficulty="(easy|medium|hard)">([\s\S]*?)<\/a>/g)];
  assert.equal(cards.length, 10, 'ten board cards');
  cards.forEach((m, i) => {
    const [id, level, wantName] = ORDER[i];
    assert.equal(m[1], id, 'card ' + (i + 1) + ' links to the same board file');
    assert.equal(m[2], level, wantName + ' is ' + level);
    assert.match(m[3], new RegExp(wantName.replace(/[.*]/g, '\\$&')));
    const on = (m[3].match(/class="on"/g) || []).length;
    assert.equal(on, FILL[level], wantName + ' fills ' + FILL[level] + ' of 6 stars');
    const src = (m[3].match(/src="([^"]+)"/) || [])[1];
    assert.equal(src, 'icons/boards/' + id + '.svg');
    assert.ok(fs.existsSync(path.join(root, src)), src + ' is in the repo');
    assert.match(m[3], /class="about">[^<]{40,}/, wantName + ' has a short description');
  });
});

test('saved game links still use the original board file names', () => {
  for (const [id] of ORDER) {
    assert.ok(fs.existsSync(path.join(root, 'rules/boards', id + '.yaml')), id + '.yaml still there');
  }
  assert.equal(fs.readdirSync(path.join(root, 'rules/boards')).filter((f) => f.endsWith('.yaml')).length, 10);
});
