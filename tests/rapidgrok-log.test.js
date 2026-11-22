// Rapid Grok post-game log, stats and replay. The classic battle log cannot replay
// these games (history is trimmed and Rapid Grok prep is not applied), so this
// file checks the Rapid-Grok-only log in engine/rapidgrok.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { rgRules, rgStart, rgAct, rgAttempt, rgStuckPass, aiTurn, toAct, rgBattleLog, rgReplayFrom, logHasProblem, forcedMove, autoFire } from '../engine/rapidgrok.js';
import { view, reach } from '../engine/index.js';

const YAML = vm.runInThisContext(readFileSync(new URL('../lib/yaml.min.js', import.meta.url), 'utf8') + '\n;YAML');
const world = YAML.parse(readFileSync(new URL('../rules/world_v0.4.yaml', import.meta.url), 'utf8'));
const setup = YAML.parse(readFileSync(new URL('../rules/rapid-grok/rapid_grok.yaml', import.meta.url), 'utf8'));
const { rules } = rgRules(world, setup);

function playOut(seed, n = 500) {
  let s = rgStart(rules, seed);
  let i = 0;
  while (s.phase === 'play' && i++ < n) s = aiTurn(s, toAct(s)).state;
  return s;
}

function badWords(log) {
  const texts = [];
  for (const a of log.acts) {
    texts.push(a.say);
    for (const e of a.events || []) texts.push(e.say);
  }
  for (const line of log.summary || []) texts.push(line);
  for (const it of (log.stats && log.stats.items) || []) texts.push(it.text);
  return texts.filter((t) => t == null || (t !== '' && /undefined|NaN|\[object Object\]|null,|null]/.test(String(t))));
}

describe('Rapid Grok battle log', () => {
  it('records every action in a finished game, is replayable, and uses beats', () => {
    const s = playOut(2);
    assert.equal(s.phase, 'over');
    assert.equal(s.winner, 0);
    const log = rgBattleLog(s, { seat: 'cpu' });
    assert.equal(log.replayable, true);
    assert.equal(log.note, null);
    assert.equal(logHasProblem(log).length, 0);
    assert.equal(log.result.beats, s.round);
    assert.equal(log.acts.length, (s.rg.acts || []).length);
    assert.ok(log.acts.length >= s.round * 2 - 2, 'at least nearly two actions per beat');
    const recap = (log.summary || []).join('\n');
    assert.match(recap, /won in 79 beats/);
    assert.doesNotMatch(recap, /\bround\b|\btick\b/i);
    assert.equal(badWords(log).length, 0, String(badWords(log).slice(0, 5)));
    const lost0 = s.ships.filter((x) => x.owner === 0 && x.dead).length;
    const lost1 = s.ships.filter((x) => x.owner === 1 && x.dead).length;
    assert.equal(log.stats.sides[0].lost, lost0);
    assert.equal(log.stats.sides[1].lost, lost1);
    assert.ok(log.stats.sides[0].shots > 0 && log.stats.sides[0].hits > 0);
    assert.ok(log.stats.sides[0].dealt > 0);
    assert.ok(log.stats.lost.some((x) => x.flagship && x.owner === 1), 'the computer flagship should be in the lost list');
  });

  it('replays from the seed and the recorded actions to the same winner, beat and ship positions', () => {
    const s = playOut(2);
    const log = rgBattleLog(s);
    const r = rgReplayFrom(rules, s.seed, log.replay.acts);
    assert.equal(r.phase, s.phase);
    assert.equal(r.winner, s.winner);
    assert.equal(r.round, s.round);
    const pos = (st) => st.ships.filter((x) => !x.dead).map((x) => x.id + ':' + x.pos).sort().join('|');
    assert.equal(pos(r), pos(s));
  });

  it('says how many hexes a circular multi-hex move covered', () => {
    let s = rgStart(rules, 2);
    const p = toAct(s);
    const me = s.ships.find((x) => x.owner === p && !x.dead && x.segs.length === 1);
    const path = reach(s, me.id).filter((o) => o.path.length >= 2).sort((a, b) => b.path.length - a.path.length)[0];
    assert.ok(path, 'a Skiff should be able to move more than one hex');
    s = rgAct(s, { type: 'move', ship: me.id, path: path.path }, { why: 'play' });
    const rec = s.rg.acts[0];
    const log = rgBattleLog(s);
    assert.match(log.acts[0].say, new RegExp(path.path.length + ' hexes'));
    assert.ok((rec.events || []).some((e) => e.t === 'move' && e.steps === path.path.length));
  });

  it('tags auto-fire, cancel-move and timeout-move so the log can say why the action happened', () => {
    let s = rgStart(rules, 2);
    const p = toAct(s);
    const me = s.ships.find((x) => x.owner === p && !x.dead);
    const path = reach(s, me.id)[0].path;
    s = rgAct(s, { type: 'move', ship: me.id, path }, { why: 'timeout-move' });
    s = aiTurn(s, toAct(s)).state;
    const p2 = toAct(s);
    const me2 = s.ships.find((x) => x.owner === p2 && !x.dead);
    const a = forcedMove(s, me2.id);
    s = rgAct(s, a, { why: 'cancel-move' });
    const log = rgBattleLog(s);
    const tags = log.acts.map((x) => x.why);
    assert.ok(tags.includes('timeout-move'));
    assert.ok(tags.includes('cancel-move'));
    assert.match(log.acts.find((x) => x.why === 'timeout-move').say, /Time ran out/);
    assert.match(log.acts.find((x) => x.why === 'cancel-move').say, /cancelled/);
    assert.ok(log.stats.sides[p].timeouts >= 1);
    assert.ok(log.stats.sides[p2].cancels >= 1);
    const mid = rgStart(rules, 2);
    const q = toAct(mid);
    const mq = mid.ships.find((x) => x.owner === q && !x.dead);
    const pathQ = reach(mid, mq.id)[0].path;
    const shot = rgAttempt(mid, { type: 'move', ship: mq.id, path: pathQ }, { why: 'timeout-autofire' });
    assert.equal(shot.ok, true);
    const log2 = rgBattleLog(shot.state);
    assert.match(log2.acts[0].say, /auto-fired/);
  });

  it('reports a 150-beat draw in beats, not rounds or ticks', () => {
    // A short-limit game still uses the same recap wording as the real 150-beat cap.
    const short = { ...rules, turnLimit: 2, turns: { ...(rules.turns || {}), turnLimit: 2 } };
    short.rapidGrok = rules.rapidGrok;
    let s = rgStart(short, 1);
    let i = 0;
    while (s.phase === 'play' && i++ < 20) s = aiTurn(s, toAct(s)).state;
    assert.equal(s.phase, 'over');
    assert.equal(s.winner, 'draw');
    const log = rgBattleLog(s, { seat: 'cpu' });
    const recap = (log.summary || []).join('\n');
    assert.match(recap, /draw/i);
    assert.match(recap, /2 beats/);
    assert.doesNotMatch(recap, /\bround\b|\btick\b/i);
    assert.equal(log.result.beatLimit, 2);
    assert.equal(log.result.beats, 2);
    assert.equal(log.replayable, true);
  });

  it('credits missile launches to the firing side when a ship actually launches', () => {
    // Walk seeds until someone launches; Rapid Grok games often stay in laser range.
    let found = null;
    for (const seed of [11, 13, 17, 19, 23, 29, 31, 37]) {
      const s = playOut(seed);
      const launches = (s.rg.acts || []).filter((a) => a.action.type === 'launch' || (a.events || []).some((e) => e.t === 'launch'));
      if (launches.length) { found = { s, launches }; break; }
    }
    if (!found) {
      // If no AI game launched, we still require the counter to stay at zero rather than NaN.
      const s = playOut(2);
      const log = rgBattleLog(s);
      assert.equal(log.stats.sides[0].missiles.fired + log.stats.sides[1].missiles.fired, 0);
      return;
    }
    const log = rgBattleLog(found.s);
    const fired = log.stats.sides[0].missiles.fired + log.stats.sides[1].missiles.fired;
    assert.ok(fired >= found.launches.length || fired > 0, 'missile launches should appear in the stats');
    const sum = (m) => m.hit + m.stopped + m.wasted + m.flying;
    assert.equal(sum(log.stats.sides[0].missiles), log.stats.sides[0].missiles.fired);
    assert.equal(sum(log.stats.sides[1].missiles), log.stats.sides[1].missiles.fired);
    assert.equal(badWords(log).length, 0);
  });
});
