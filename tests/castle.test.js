// Free castle (engine/castle.js): once, before its first action, a side may secretly move its flagship
// to any legal spot in its home zone. Free, secret, refused once the enemy has seen the flagship.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as E from '../engine/index.js';
import { computerMove, aiCastle } from '../engine/ai.js';
import { loadBoard, boardNames } from '../tools/boards.mjs';

const YAML = vm.runInThisContext(fs.readFileSync('lib/yaml.min.js', 'utf8') + '\n;YAML');
const world = () => YAML.parse(fs.readFileSync('rules/world_v0.4.yaml', 'utf8'));
const rapidBoard = (name, extra = {}) => {
  const b = YAML.parse(fs.readFileSync('rules/rapid/' + name + '.yaml', 'utf8'));
  const { rules, problems } = E.buildRules(world(), b, b);
  assert.deepEqual(problems, []);
  return E.rapidRules({ ...rules, ...extra }, { ...b.rapid });
};
const flagOf = (g, p) => g.ships.find((x) => x.owner === p && x.flagship);
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

test('on by default for skirmish boards and rapid; off for story and experiments; a board can switch it', () => {
  const { rules } = loadBoard('07_beacon_hill');
  assert.equal(E.modeOf(rules), 'skirmish');
  assert.equal(E.castleOn(rules), true);
  assert.equal(E.castleOn({ ...rules, castleBoard: false }), false, 'map: castle: false wins');
  assert.equal(E.castleOn({ ...rules, campaign: { id: 'ch1' } }), false, 'story');
  assert.equal(E.castleOn({ ...rules, campaign: { id: 'ch1' }, castleBoard: true }), true, 'a chapter could still ask for it');
  assert.equal(E.castleOn(rapidBoard('rapid_opus')), true, 'rapid');
  assert.equal(E.castleOn(rapidBoard('lab_ram')), false, 'experiments');
  assert.equal(E.castleOn({ ...rules, modes: {} }), false, 'a world file with no modes: off (older saves)');
});

test('the spots: inside the home zone, on the board, off rocks and mines, a ship in the way swaps', () => {
  for (const name of boardNames()) {
    const { rules } = loadBoard(name);
    const g = E.start(rules, 2);
    for (const p of [0, 1]) {
      const f = flagOf(g, p), zone = rules.zones.find((z) => z.name.indexOf(rules.fleets[p].name) === 0);
      for (const s of E.castleSpots(g, p)) {
        for (const sg of f.segs) {
          const c = E.hex.add(s.at, sg.off);
          assert.ok(E.hex.inHexagon(c, rules.board.radius), name + ' on the board');
          assert.ok(E.hex.EDGE[zone.edge](c, rules.board.radius) < zone.depth, name + ' in the zone');
        }
        if (s.swap) assert.equal(g.ships.find((x) => x.id === s.swap).owner, p, 'only your own ship swaps');
        // every spot is one the engine accepts
        if (g.order[g.turn] === p && !E.castleBlocked(g, p)) assert.ok(E.attempt(g, { type: 'castle', at: s.at }).ok, name + ' spot ' + s.at + ' is accepted');
      }
    }
  }
});

test('a castle is free and secret: no points spent, only its own side is told, the enemy view is unchanged', () => {
  const { rules } = loadBoard('07_beacon_hill');
  const g = E.start(rules, 5), p = g.order[g.turn], q = 1 - p, f = flagOf(g, p);
  const spot = E.castleSpots(g, p).find((s) => s.swap);
  assert.ok(spot, 'Beacon Hill has a swap spot');
  const before = E.view(g, q);
  const g2 = E.apply(g, { type: 'castle', at: spot.at });
  assert.ok(same(flagOf(g2, p).pos, spot.at));
  assert.ok(same(g2.ships.find((x) => x.id === spot.swap).pos, f.pos), 'the swapped ship takes the old spot');
  assert.equal(g2.players[p].cp, g.players[p].cp, 'no command points spent');
  assert.deepEqual(g2.events.filter((e) => e.t === 'castle').map((e) => e.seenBy), [[p]]);
  assert.deepEqual(E.view(g2, q).ships, before.ships, 'the enemy sees nothing new');
});

test('only once, only before the first action, only while the enemy has not seen the flagship', () => {
  const { rules } = loadBoard('07_beacon_hill');
  const g = E.start(rules, 5), p = g.order[g.turn], q = 1 - p, [a, b] = E.castleSpots(g, p);
  const once = E.apply(g, { type: 'castle', at: a.at });
  assert.match(E.attempt(once, { type: 'castle', at: b.at }).why, /already castled/);
  // after any other action
  const acted = E.apply(g, { type: 'end' });
  const back = E.apply(acted, { type: 'end' });
  assert.equal(back.round, 2);
  assert.match(E.attempt(back, { type: 'castle', at: a.at }).why, /very start|first action/);
  // the second side still may, in its own first turn
  assert.equal(E.castleBlocked(acted, q), null);
  // seen by the enemy
  const seen = structuredClone(g); seen.rules = g.rules;
  seen.players[q].vis.push(flagOf(g, p).id);
  assert.match(E.attempt(seen, { type: 'castle', at: a.at }).why, /already seen/);
  // a bad spot
  assert.match(E.attempt(g, { type: 'castle', at: [0, 0] }).why, /cannot start there/);
});

test('off: refused, and the computer never castles', () => {
  const { rules } = loadBoard('07_beacon_hill');
  const g = E.start({ ...rules, castleBoard: false }, 5), p = g.order[g.turn];
  assert.match(E.attempt(g, { type: 'castle', at: [-7, 9] }).why, /off on this board/);
  assert.equal(aiCastle(g, p), null);
  assert.notEqual((computerMove(g, p) || {}).type, 'castle');
});

test('the action travels in turn codes and battle logs, and a game with a castle replays', () => {
  assert.deepEqual(E.parseAction(E.actionText({ type: 'castle', at: [-7, 9] })), { type: 'castle', at: [-7, 9] });
  const { rules } = loadBoard('07_beacon_hill');
  let g = E.start(rules, 9);
  for (let i = 0; i < 40 && g.phase === 'play'; i++) {
    const a = computerMove(g, g.order[g.turn]) || { type: 'end' };
    const r = E.attempt(g, a); g = r.ok ? r.state : E.apply(g, { type: 'end' });
  }
  assert.ok(g.history.some((h) => h.actions.some((t) => t[0] === 'c')), 'a castle was played');
  const log = E.battleLog(g, { seat: 'cpu' });
  assert.equal(log.replayable, true);
  assert.equal(E.hashState(E.replayLog(log)), E.hashState(g));
});

test('the computer castles the same way every time for the same game, and only to legal spots', () => {
  let castles = 0;
  for (const name of boardNames()) {
    const { rules } = loadBoard(name);
    for (const seed of [1, 2, 3]) {
      const g = E.start(rules, seed), p = g.order[g.turn];
      const a = aiCastle(g, p), b = aiCastle(g, p);
      assert.deepEqual(a, b, 'seeded');
      if (a) { castles++; assert.ok(E.attempt(g, a).ok, name + ' legal'); }
    }
  }
  assert.ok(castles > 10, 'it castles most games (' + castles + ' of 30)');
});

test('computer v computer games on every board still finish with castling on', () => {
  for (const name of boardNames()) {
    const { rules } = loadBoard(name);
    let g = E.start(rules, 4);
    for (let i = 0; i < 2000 && g.phase === 'play'; i++) {
      const a = computerMove(g, g.order[g.turn]) || { type: 'end' };
      const r = E.attempt(g, a); g = r.ok ? r.state : E.apply(g, { type: 'end' });
    }
    assert.equal(g.phase, 'over', name);
  }
});

test('rapid: the first tick carries the castle; both sides castle together; tick 2 is too late', () => {
  for (const name of ['rapid_opus', 'rapid_frontier', 'three_edges']) {
    let g = E.rapidStart(rapidBoard(name), 3);
    const spot = E.castleSpots(g, 0)[3], at = spot.at;
    const acts = g.players.map((_, p) => E.rapidAI(g, p));
    const mv = E.legalMoves(g, 0).find((m) => m.ship !== flagOf(g, 0).id && m.ship !== spot.swap);
    acts[0] = { ...mv, castle: at };
    assert.equal(E.rapidRefusal(g, 0, { type: 'pass', castle: [0, 0] }), 'your flagship cannot start there');
    const t = E.tickText(acts[0]);
    assert.deepEqual(E.parseTick(t), E.parseTick(E.tickText(E.parseTick(t))), name + ' tick text round trip');
    assert.deepEqual(E.parseTick(t).castle, at);
    assert.equal(E.rapidRefusal(g, 0, acts[0]), null);
    const g2 = E.rapidTick(g, acts);
    assert.ok(same(flagOf(g2, 0).pos, at), name);
    assert.match(E.castleBlocked(g2, 0), /already castled/);
    assert.match(E.castleBlocked(g2, 1) || 'none', /very start|already castled/, name + ' the other side is closed after tick 1 too');
  }
});

test('rapid: the computer castles with its first tick, and the tick is still legal', () => {
  let g = E.rapidStart(rapidBoard('rapid_opus'), 6);
  const a = E.rapidAI(g, 1);
  if (a.castle) assert.equal(E.rapidRefusal(g, 1, a), null);
  g = E.rapidTick(g, [E.rapidAI(g, 0), a]);
  assert.equal(E.rapidAI(g, 1).castle, undefined, 'never again');
});
