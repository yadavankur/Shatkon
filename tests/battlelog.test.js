// Battle log: every turn recorded (from the saved actions + seed), survives save/reload,
// replays exactly, respects the fog mid-game, and the analyser explains it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildRules, start, apply, attempt, exportGame, importGame, turnCode, hashState, battleLog, replayLog, analyse, buildChapter, newCampaign, campaignMove } from '../engine/index.js';
import { computerMove } from '../engine/ai.js';
import { battle, scout, shippedFiles } from './helpers.js';
import { camp } from '../campaign/tools/lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const saveLike = (g) => JSON.parse(JSON.stringify((({ events, flight, ...rest }) => rest)(g)));   // what a save holds

// both sides played by the computer, as in a real game against it
function aiGame(rules, seed, cap = 400, mover = (g, p) => computerMove(g, p, 'normal')) {
  let g = start(rules, seed), steps = 0;
  for (let n = 0; g.phase === 'play' && n < cap; n++) {
    let a = steps++ > 30 ? { type: 'end' } : mover(g, g.order[g.turn]) || { type: 'end' };
    if (!attempt(g, a).ok) a = { type: 'end' };
    if (a.type === 'end') steps = 0;
    g = apply(g, a);
  }
  return g;
}
const shipped = () => { const f = shippedFiles(); return buildRules(f.world, f.map, f.fleets).rules; };

test('battle log: every action, its results and the points left are recorded', () => {
  let { game: g } = battle({ p1: [scout('a', [0, 2])], p2: [scout('b', [0, -2])] });
  g = apply(g, { type: 'move', ship: '1a', path: [5] });
  const shot = g.ships.find((s) => s.id === '2a').pos;
  g = apply(g, { type: 'fire', ship: '1a', seg: 0, part: g.ships[0].segs[0].parts.findIndex((p) => p.t === 'laser'), at: shot });
  const killed = g.phase === 'over';
  if (!killed) g = apply(g, { type: 'end' });
  const log = battleLog(g, { viewer: 'all', seat: 'cpu' });
  assert.equal(log.replayable, true);
  assert.equal(log.turns.length, 1);
  const t = log.turns[0];
  assert.deepEqual(t.actions.map((a) => a.text[0]), killed ? ['m', 'f'] : ['m', 'f', 'e']);
  assert.match(t.actions[0].say, /moved ★ a \(1a\) 1 step from \[0, 2\] to \[0, 3\]/);
  assert.ok(t.actions[1].events.some((e) => e.t === 'damage' && e.ship === '2a' && e.hits > 0 && e.say.includes('hull now')));
  assert.equal(typeof t.rng, 'number');
  if (!killed) assert.ok(t.cp.start > t.cp.left);
  else assert.ok(t.actions[1].events.some((e) => e.t === 'destroyed' && e.ship === '2a'));
  assert.equal(t.ships.length, 2);
  assert.ok(log.replay && log.replay.seed === 7 && log.replay.turns[0].actions.length === (killed ? 2 : 3));
  assert.ok(log.summary.some((l) => /KEY MOMENTS/.test(l)));
});

test('battle log: saved and reloaded games give the same log; old saves still load; codes unchanged', async () => {
  const g = aiGame(shipped(), 99, 60);
  const back = await importGame(await exportGame(g));
  const strip = (l) => JSON.stringify({ ...l, created: 0 });
  assert.equal(strip(battleLog(back, { seat: 'cpu', now: 'x' })), strip(battleLog(g, { seat: 'cpu', now: 'x' })));
  // the fingerprint ignores the seed, so turn codes match devices running the old version
  const old = structuredClone(saveLike(g)); delete old.seed;
  assert.equal(hashState(old), hashState(g));
  assert.equal(turnCode(old), turnCode(g));
  // a game saved before battle logs: no seed, still gives a log of the actions
  const ol = battleLog(old, { viewer: 'all' });
  assert.equal(ol.replayable, false);
  assert.match(ol.note, /no seed/);
  assert.equal(ol.turns.length, g.history.length + (g.pending.length && g.phase === 'play' ? 1 : 0));
  // the save holds no events: the log is rebuilt, not stored
  assert.ok(!('log' in saveLike(g)));
});

test('battle log: replaying a whole game against the computer is exact, and drift is caught', () => {
  const g = aiGame(shipped(), 4242);
  assert.equal(g.phase, 'over');
  const log = JSON.parse(JSON.stringify(battleLog(saveLike(g), { seat: 'cpu' })));   // as downloaded
  assert.equal(log.replayable, true);
  const again = replayLog(log);
  assert.equal(hashState(again), hashState(g));
  assert.equal(again.winner, g.winner);
  assert.deepEqual(again.ships.map((s) => [s.id, s.pos, s.dead]), g.ships.map((s) => [s.id, s.pos, s.dead]));
  // the same log twice is the same log
  assert.deepEqual(battleLog(again, { seat: 'cpu', now: 'x' }).turns, battleLog(g, { seat: 'cpu', now: 'x' }).turns);
  // change one action: the replay notices
  const bad = structuredClone(log), t = bad.replay.turns.find((x) => x.actions.some((a) => a[0] === 'm'));
  t.actions[t.actions.findIndex((a) => a[0] === 'm')] = 'e';
  assert.throws(() => replayLog(bad), /drift|did not end|not allowed|unknown|cannot|not yours/);
});

test('battle log: a story chapter that changes the rules mid-battle still replays exactly', () => {
  const C = camp('campaign.yaml'), chDoc = camp('chapters/ch5_bloom.yaml'), ch = chDoc.chapter;
  const world = shippedFiles().world;
  const { rules } = buildChapter({ world, map: camp(ch.map), ships: camp('ships.yaml'), chapter: chDoc, campaign: C, progress: newCampaign(C) });
  const g = aiGame(rules, 5, 600, (s, p) => campaignMove(s, p));
  const changed = !!g.rules.campaign.rules0;
  const log = battleLog(saveLike(g), { seat: 'cpu' });
  assert.equal(log.replayable, true, log.note || '');
  assert.equal(hashState(replayLog(JSON.parse(JSON.stringify(log)))), hashState(g));
  assert.ok(changed, 'ch5 jams comms mid-battle (set_rule), so the start rules are kept separately');
});

test('battle log: mid-game it only shows what that player could see, with no replay data', () => {
  let { game: g } = battle({ radius: 12, p1: [scout('a', [0, 10])], p2: [scout('b', [0, -10]), scout('c', [3, -10], { flagship: false })] });
  g = apply(g, { type: 'move', ship: '1a', path: [5] });
  g = apply(g, { type: 'end' });
  g = apply(g, { type: 'move', ship: '2b', path: [2] });
  const log = battleLog(g, { viewer: 0, seat: 'cpu' });
  const text = JSON.stringify(log);
  assert.equal(log.replay, undefined);
  assert.match(log.scope, /^partial/);
  assert.ok(!text.includes('"2b"') && !text.includes('"2c"'), 'hidden enemy ships must not appear');
  assert.ok(!/m2b/.test(text), 'the enemy\u2019s moves must not appear');
  assert.equal(log.turns[0].actions[0].text, 'm1a.5');
  // the same game, finished view: everything
  assert.ok(JSON.stringify(battleLog(g, { viewer: 'all' })).includes('m2b'));
});

test('analyser: replays the file and prints a recap with the key moments', () => {
  const g = aiGame(shipped(), 4242);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shatkon-log-')), file = path.join(dir, 'shatkon-battle-test.json');
  fs.writeFileSync(file, JSON.stringify(battleLog(saveLike(g), { seat: 'cpu' }), null, 1));
  const out = execFileSync(process.execPath, [path.join(root, 'tools/analyse-log.mjs'), file], { encoding: 'utf8' });
  assert.match(out, /Replay check: the engine replayed all \d+ actions over \d+ turns and ended in exactly the saved position/);
  assert.match(out, /KEY MOMENTS/);
  assert.match(out, /First sighting: (You|The computer) spotted/);
  assert.match(out, /Ship lost, round \d+: /);
  assert.match(out, /THINGS TO LOOK AT \(for You\)/);
  assert.match(out, /TURN BY TURN\nRound 1 \u2014 /);
  // the moments as data
  const j = JSON.parse(execFileSync(process.execPath, [path.join(root, 'tools/analyse-log.mjs'), file, '--json'], { encoding: 'utf8' }));
  assert.ok(j.moments.lost.length >= 1 && j.moments.bigHits.length >= 1);
  // a file that is not a log is refused politely
  fs.writeFileSync(file, '{"hello":1}');
  assert.throws(() => execFileSync(process.execPath, [path.join(root, 'tools/analyse-log.mjs'), file], { encoding: 'utf8', stdio: 'pipe' }), /not a SHATKON battle log/);
});

test('analyser: spots points thrown away, ships left in view, wasted missiles and blocked shots', () => {
  const log = { format: 'shatkon-battle-log', sides: ['You', 'The computer'], seat: 'cpu', viewer: 'all', scope: 'full', result: { phase: 'over', round: 3, winner: 1, turnLimit: 30 },
    setup: [], turns: [
      { round: 1, player: 0, cp: { start: 6, left: 5, wasted: 2 }, thrust: { start: 10, left: 10, wasted: 4 }, exposed: ['1a'], ships: [{ id: '1a', name: 'Kestrel', owner: 0, flagship: true }],
        actions: [{ text: 'l1a.missile.0,1..0', say: 'launched', events: [{ t: 'launch', ship: '1a', kind: 'missile', obj: 'o9', seenBy: [0] }] },
          { text: 'f1a.0.0.0,-5', say: 'fired', events: [{ t: 'fire', ship: '1a', at: [0, -5], end: [0, -2], hits: 3, seenBy: [0] }, { t: 'obj_destroyed', kind: 'mine', at: [0, -2], seenBy: [0, 1] }] }] },
      { round: 1, player: 1, actions: [{ text: 'e', say: 'ended', events: [{ t: 'obj_lost', obj: 'o9', kind: 'missile', why: 'ran out of fuel', seenBy: [0] }, { t: 'sighted', id: '1a', kind: 'ship', at: [0, 1], why: { by: '2a', d: 6 }, seenBy: [1] }] }] },
      { round: 2, player: 1, actions: [{ text: 'f2a.0.0.0,1', say: 'fired', events: [{ t: 'damage', ship: '1a', seg: 0, hits: 3, lost: ['core destroyed'], cause: 'laser', hull: 0, seenBy: [0] }, { t: 'destroyed', ship: '1a', name: 'Kestrel', owner: 0, flagship: true, seenBy: [0, 1] }] }] },
    ] };
  const text = analyse(log).lines.join('\n');
  assert.match(text, /Points thrown away: in 1 turn .*round 1: 2 command points and 4 thrust/);
  assert.match(text, /Ending a turn in sight: 1 time .*Kestrel \(1a\)/);
  assert.match(text, /missile o9 \(round 1\): wasted: it ran out of fuel/);
  assert.match(text, /blocked by a mine at \[0,-2\]/);
  assert.match(text, /The computer spotted .*Kestrel \(1a\) in round 1/);
  assert.match(text, /You never got an exact fix/);
  assert.match(text, /The enemy found you first/);
  assert.match(text, /Ship lost, round 2: You lost the flagship Kestrel \(1a\)/);
});

// The battle log was written for the old root game; the Comet, the mines and the decoy came from beta.
test('battle log: a board with Comets and mines logs, replays, and has words for every event', async () => {
  const { loadBoard } = await import('../tools/boards.mjs');
  const { eventWords } = await import('../engine/log.js');
  const g = aiGame(loadBoard('02_minefield').rules, 3, 6000);
  const log = JSON.parse(JSON.stringify(battleLog(g, { viewer: 'all', seat: 'cpu' })));
  assert.equal(hashState(replayLog(log)), hashState(g));
  assert.doesNotMatch(JSON.stringify([log.turns, log.summary]), /undefined|NaN|\[object/);
  const nm = (id) => id, side = (p) => 'P' + (p + 1);
  assert.equal(eventWords({ t: 'scan', found: 2, pinged: 1 }, nm, side), 'scan: 2 things revealed, 1 faint contact');
  assert.equal(eventWords({ t: 'scan', found: 0, pinged: 0 }, nm, side), 'scan: nothing revealed');
  for (const e of [{ t: 'pass_reveal', ship: '1a', found: ['2a'] }, { t: 'burnt_out', ship: '1a', move: 1 }, { t: 'lured', obj: 'o1', kind: 'missile', from: '2a', to: '2b' }, { t: 'mine_stir', near: '1a' }])
    assert.match(eventWords(e, nm, side) || '', /\w/, e.t + ' has no words in the log');
});
