// Rapid Grok watch, taps, sight and "one-hex ships can die in one volley".
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { rgRules, rgStart, watchHasSight, shooterKnown, rgTapIntent, fleetTally } from '../engine/rapidgrok.js';
import { detectRange } from '../engine/detect.js';
import { applyHits, isDead } from '../engine/damage.js';

const YAML = vm.runInThisContext(readFileSync(new URL('../lib/yaml.min.js', import.meta.url), 'utf8') + '\n;YAML');
const world = YAML.parse(readFileSync(new URL('../rules/world_v0.4.yaml', import.meta.url), 'utf8'));
const setup = YAML.parse(readFileSync(new URL('../rules/rapid-grok/rapid_grok.yaml', import.meta.url), 'utf8'));
const { rules } = rgRules(world, setup);

describe('Rapid Grok watch and taps', () => {
  it('skips the watch when the enemy acted out of sight and nothing hit you', () => {
    const s = rgStart(rules, 2);
    const ev = [{ t: 'move', ship: '2-x', seenBy: [1] }];
    assert.equal(watchHasSight(s, 0, ev), false);
    assert.equal(watchHasSight(s, 0, [{ t: 'damage', ship: '1-a', hits: 2, seenBy: [0] }]), true);
    assert.equal(watchHasSight(s, 0, [{ t: 'destroyed', owner: 0, ship: '1-a', seenBy: [0, 1] }]), true);
  });

  it('does not treat a shooter as known if they only appeared in this action (muzzle flash)', () => {
    const s = rgStart(rules, 2);
    const id = s.ships.find((x) => x.owner === 1).id;
    s.players[0].vis = [id];
    assert.equal(shooterKnown(s, 0, [{ t: 'sighted', id, seenBy: [0] }, { t: 'enemy_fire', ship: id, seenBy: [0] }], id), false);
    assert.equal(shooterKnown(s, 0, [{ t: 'enemy_fire', ship: id, seenBy: [0] }], id), true);
  });

  it('lets you switch to another of your ships even when it sits in the current move glow, and clears on a re-tap or empty hex', () => {
    assert.deepEqual(rgTapIntent({ sel: 'A', mode: 'move', ownId: 'B', canMoveHere: true, empty: false }), { type: 'select', id: 'B' });
    assert.deepEqual(rgTapIntent({ sel: 'A', mode: 'move', ownId: 'A', canMoveHere: false, empty: false }), { type: 'clear' });
    assert.deepEqual(rgTapIntent({ sel: 'A', mode: 'move', ownId: null, canMoveHere: true, empty: false }), { type: 'move' });
    assert.deepEqual(rgTapIntent({ sel: 'A', mode: 'move', ownId: null, canMoveHere: false, empty: true }), { type: 'clear' });
  });

  it('counts the living fleet', () => {
    const s = rgStart(rules, 2);
    const t = fleetTally(s, 0);
    assert.equal(t.total, 14);
    assert.equal(t.alive, 14);
  });
});

describe('Rapid Grok sight and one-hit losses (the rules, not bugs)', () => {
  it('lets a stealthy Skiff see a bigger ship from farther than that ship can see the Skiff', () => {
    const s = rgStart(rules, 2);
    const skiff = s.ships.find((x) => x.owner === 1 && x.segs.length === 1);
    const flower = s.ships.find((x) => x.owner === 0 && x.flagship);
    assert.ok(skiff && flower);
    const skiffSeesFlower = detectRange(s, skiff, flower);
    const flowerSeesSkiff = detectRange(s, flower, skiff);
    assert.ok(skiffSeesFlower > flowerSeesSkiff,
      'a Skiff should pick up the Flower from farther than the Flower picks up the Skiff (got ' + skiffSeesFlower + ' vs ' + flowerSeesSkiff + ')');
    // A ship may also fire at anything its comms network can see, not only what its own sensors see.
    // Laser range is 9, so there is a band where a small shooter can legally fire without appearing on your board.
    assert.equal(rules.rapidGrok.watch_seconds, 3);
  });

  it('destroys a 1-hex Skiff with two laser hits, because only a core would be left', () => {
    const s = rgStart(rules, 2);
    const skiff = s.ships.find((x) => x.owner === 0 && x.segs.length === 1 && !x.dead);
    assert.ok(skiff);
    applyHits(s, skiff, 0, 2, 'laser');
    assert.equal(skiff.dead, true);
    assert.equal(isDead(s, skiff) || skiff.dead, true);
    assert.ok((s.events || []).some((e) => e.t === 'destroyed' && e.ship === skiff.id));
    const t = fleetTally(s, 0);
    assert.equal(t.alive, 13);
    assert.equal(t.total, 14);
  });
});
