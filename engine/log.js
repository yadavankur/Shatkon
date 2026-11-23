// The battle log: a turn-by-turn record of a game, rebuilt on demand by replaying it.
//
// Nothing extra is stored while playing. A saved game already holds every action in
// state.history (plus this turn's in state.pending), and the engine is deterministic, so
// starting again from the same rules and seed and replaying those actions reproduces every
// hit, detection and missile exactly. battleLog() does that replay and writes down what
// happened. analyse() turns a log into a plain-English recap with the key moments.
//
//   const log = battleLog(game, { viewer: 'all', seat: 'cpu' });   // finished game: everything
//   const log = battleLog(game, { viewer: 0, seat: 'cpu' });       // mid-game: only what player 1 saw
//   const state = replayLog(log);                                  // the same game, rebuilt
//   const { text } = analyse(log);

import { newGame, current, hullPct, footprint } from './state.js';
import { begin, apply } from './turn.js';
import { startScript } from './script.js';
import { hashState, parseAction } from './codec.js';
import { visibleTo } from './detect.js';
import { bankCap } from './actions.js';
import { rapidStart, rapidTick, parseTick } from './rapid.js';
import { EARN_WORDS, BUY_WORDS } from './economy.js';

export const LOG_FORMAT = 'shatkon-battle-log';

// The rules the game started with (a story chapter can change the rules mid-battle; the
// first set is kept for replays).
export const startRules = (state) => (state.rules.campaign && state.rules.campaign.rules0) || state.rules;

// Start a game again from its rules and seed and replay turns ([{ actions: ['m1a.01', ...], pre, post }]).
// hook(prev, next, text, turnIndex) is called after every action. Throws if the replay drifts.
export function replay(rules, seed, turns, hook) {
  let s = begin(newGame(rules, seed));
  if (rules.campaign) startScript(s);
  if (hook) hook(null, s, null, -1);
  turns.forEach((t, ti) => {
    if (t.pre && s.pre !== t.pre) throw new Error('the replay drifted from the game at round ' + t.round + ' (start of turn)');
    for (const text of t.actions) {
      const prev = s;
      s = apply(s, parseAction(text));
      if (hook) hook(prev, s, text, ti);
    }
    if (t.post && hashState(s) !== t.post) throw new Error('the replay drifted from the game at round ' + t.round + ' (end of turn)');
  });
  return s;
}

// Every turn so far, the unfinished one included.
function turnsOf(state) {
  const out = state.history.map((h) => ({ round: h.round, player: h.player, pre: h.pre, post: h.post, at: h.at, actions: h.actions.slice() }));
  if (state.phase === 'play' && state.pending.length) out.push({ round: state.round, player: current(state), pre: state.pre, at: state.updated, actions: state.pending.slice() });
  return out;
}

export function sideNames(state, seat) {
  return state.players.map((pl, p) => {
    if (seat === 'cpu') return p === 0 ? 'You' : 'The computer';
    if (seat === 0 || seat === 1) return p === seat ? 'You' : 'Your opponent';
    return 'Player ' + (p + 1);
  });
}

const at = (c) => (c ? '[' + c[0] + ', ' + c[1] + ']' : '?');
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
// Thrust is per ship; the log shows a side's total over its ships on engines.
const fleetThrust = (state, p) => state.ships.filter((x) => x.owner === p && !x.dead).reduce((n, x) => n + (x.thrust || 0), 0);

function namer(state) {
  const names = {};
  for (const s of state.ships) names[s.id] = (s.flagship ? '\u2605 ' : '') + s.name + ' (' + s.id + ')';
  return (id) => names[id] || id;
}

// One plain sentence per action, from the action itself and the state before it.
function actionWords(prev, next, text, nm) {
  if (/^b:/.test(text)) { const it = text.slice(2).split('.')[0]; return 'bought ' + (BUY_WORDS[it] || it); }   // economy mode
  const a = parseAction(text), ship = a.ship && prev.ships.find((s) => s.id === a.ship);
  switch (a.type) {
    case 'move': { const to = next.ships.find((s) => s.id === a.ship); return 'moved ' + nm(a.ship) + ' ' + plural(a.path.length, 'step') + (ship ? ' from ' + at(ship.pos) : '') + (to && !to.dead ? ' to ' + at(to.pos) : ''); }
    case 'fire': return nm(a.ship) + ' fired a laser at ' + at(a.at);
    case 'launch': return nm(a.ship) + ' launched a ' + a.kind + ' from ' + at(a.start) + (a.target ? ', locked on ' + nm(a.target) : '');
    case 'scan': return nm(a.ship) + ' sent an active scan';
    case 'detonate': return 'detonated ' + a.obj;
    case 'graft': return nm(a.ship) + ' grafted onto ' + nm(a.with);
    case 'dock': return nm(a.ship) + ' docked with ' + nm(a.with);
    case 'end': return 'ended the turn';
  }
  return text;
}

// One plain sentence per event (or null for bookkeeping the recap does not need).
export function eventWords(e, nm, side) {
  switch (e.t) {
    case 'move': return nm(e.ship) + ' moved to ' + at(e.to);
    case 'bump': return nm(e.ship) + ' bumped into ' + nm(e.into) + ' and stopped';
    case 'fire': return 'laser shot at ' + at(e.at) + (e.end && (e.end[0] !== e.at[0] || e.end[1] !== e.at[1]) ? ' struck something in the way at ' + at(e.end) + ' first' : '') + ': ' + (e.hits ? plural(e.hits, 'hit') : 'no damage');
    case 'enemy_fire': return nm(e.ship) + ' fired a laser' + (e.hits ? ' and hit' : '');
    case 'damage': return nm(e.ship) + ' took ' + plural(e.hits, 'hit') + ' on segment ' + (e.seg + 1) + ' from ' + e.cause + (e.lost.length ? ' (' + e.lost.join(', ') + ')' : '') + '; hull now ' + e.hull + '%';
    case 'hit': return nm(e.ship) + ' was hit ' + plural(e.hits, 'time') + ' on segment ' + (e.seg + 1) + (e.wrecked ? ', segment wrecked' : '') + '; hull now ' + e.hull + '%';
    case 'destroyed': return nm(e.ship) + ' (' + side(e.owner) + ') was destroyed' + (e.cause ? ' by ' + e.cause : '');
    case 'sighted': return (e.seenBy ? side(e.seenBy[0]) + ' spotted ' : 'spotted ') + (e.kind === 'ship' ? nm(e.id) : 'a ' + e.kind) + ' at ' + at(e.at) + (e.why && e.why.scanned ? ' (scan)' : e.why && e.why.lit ? ' (lit up by a blast)' : e.why && e.why.by ? ' (seen by ' + nm(e.why.by) + ' at range ' + e.why.d + ')' : '');
    case 'lost': return (e.seenBy ? side(e.seenBy[0]) + ' lost sight of ' : 'lost sight of ') + nm(e.id);
    case 'launch': return 'a ' + e.kind + ' (' + e.obj + ') is away';
    case 'blast': return 'a ' + e.kind + (e.obj ? ' (' + e.obj + ')' : '') + ' exploded at ' + at(e.at);
    case 'stopped': return 'point defence on ' + nm(e.ship) + ' stopped a ' + e.kind;
    case 'obj_lost': return 'the ' + e.kind + ' ' + e.obj + ' was lost: it ' + e.why;
    case 'obj_destroyed': return 'a ' + e.kind + ' at ' + at(e.at) + ' was destroyed';
    // (found and pinged are counts; this line used to read them as lists and printed "undefined contacts")
    case 'scan': return 'scan: ' + (e.found ? plural(e.found, 'thing') + ' revealed' : 'nothing revealed') + (e.pinged ? ', ' + plural(e.pinged, 'faint contact') : '');
    case 'pass_reveal': return nm(e.ship) + ' flew past ' + (e.found || []).map(nm).join(', ') + ' under afterburner and lit ' + ((e.found || []).length === 1 ? 'it' : 'them') + ' up (and itself)';
    case 'burnt_out': return nm(e.ship) + '\u2019s afterburner burnt out: it now moves ' + e.move + (e.move === 1 ? ' hex' : ' hexes') + ' a turn';
    case 'lured': return 'the ' + e.kind + ' ' + e.obj + ' turned on the decoy emitter of ' + nm(e.to) + (e.from ? ' and dropped its lock on ' + nm(e.from) : '');
    case 'mine_stir': return 'something small crept toward ' + nm(e.near) + ' (a faint contact)';
    case 'ammo_lost': return nm(e.ship) + ' lost ' + plural(e.count, 'stored munition');
    case 'objective_scored': return side(e.player) + ' scored at the beacon (' + e.score + ' of ' + e.toWin + ')';
    case 'objective_contested': return 'the beacon is contested';
    case 'game_over': return 'game over: ' + (e.winner === 'draw' ? 'a draw' : side(e.winner) + ' won') + (e.by ? ' (' + String(e.by).replace(/_/g, ' ') + ')' : '');
    case 'bought': return side(e.player) + ' bought ' + (BUY_WORDS[e.item] || e.item) + ' for ' + e.cost + ' salvage' + (e.item === 'turret' ? ' (' + nm(e.ship) + ' left a laser behind at ' + at(e.at) + ')' : '') + ', purse ' + e.purse;
    case 'turret_fire': return 'turret ' + e.obj + ' fired at ' + (/^o/.test(e.target || '') ? 'an enemy object' : nm(e.target)) + ' at ' + at(e.at) + ' (' + plural(e.hits, 'hit') + ')';
    case 'turret_hit': return 'turret ' + e.obj + ' took ' + plural(e.hits, 'hit') + ' (' + e.hp + ' left)';
    case 'turret_lit': return 'turret ' + e.obj + ' is working again (upkeep paid)';
    case 'turret_dark': return 'turret ' + e.obj + ' went dark: no salvage for its upkeep';
    case 'upkeep': return side(e.player) + ' paid ' + e.amount + ' salvage upkeep for ' + plural(e.turrets, 'turret') + ', purse ' + e.purse;
    case 'earned': return side(e.player) + ' earned ' + e.amount + ' salvage (' + [...new Set((e.items || []).map((i) => EARN_WORDS[i.why] || i.why))].join(', ') + (e.capped ? '; capped' : '') + '), purse ' + e.purse;
    case 'converted': return nm(e.ship) + ' went silent and became a ' + (e.into === 'mine' ? 'naval mine' : 'scanner buoy') + ' at ' + at(e.at);
    case 'debris': return nm(e.ship) + ' shot down a missile close in: the debris lit it up and hit it';
    case 'ram': return nm(e.ship) + ' rammed ' + nm(e.target) + ' for ' + plural(e.hits, 'hit');
    case 'removed': return nm(e.ship) + ' left the battle';
    case 'spawned': return 'reinforcements arrived';
    case 'forced': return nm(e.ship) + ' acted on its own (' + e.order + ')';
    case 'script_failed': return 'a story step could not run (' + e.action + ': ' + e.why + ')';
  }
  return null;
}

function snapshot(state, keep) {
  return state.ships.filter((s) => keep(s)).map((s) => ({
    id: s.id, name: s.name, owner: s.owner, flagship: s.flagship, pos: s.pos.slice(), dead: !!s.dead,
    hull: s.dead ? 0 : hullPct(state, s), wrecked: s.segs.filter((g) => g.wrecked).length, segs: s.segs.length,
    cells: s.dead ? [] : footprint(s),
  }));
}

// Build the battle log for a game.
//   viewer: 'all' (everything; the default once the game is over) or a player index, in which
//   case only what that player knew goes in, and no replay data (it would reveal the enemy).
//   seat: how the game was played ('cpu', 'pass', 'all', 0 or 1), for "You" / "The computer".
export function battleLog(state, opts = {}) {
  const over = state.phase === 'over';
  const viewer = over || opts.viewer == null ? 'all' : opts.viewer;
  const full = viewer === 'all';
  const seat = opts.seat ?? null, sides = sideNames(state, seat), side = (p) => sides[p] || 'Player ' + (Number(p) + 1);
  const nm = namer(state);
  const R = state.rules;
  const log = {
    format: LOG_FORMAT, v: 1, created: opts.now || new Date().toISOString(), game: 'SHATKON',
    chapter: R.campaign ? R.campaign.title || R.campaign.id || 'story chapter' : null,
    seat, sides, viewer,
    // wall-clock times from the play page (absent in games saved before 17 Nov 2026 and in tools/tests)
    started: state.started || null, lastPlayed: state.updated || null,
    scope: full ? 'full: everything that happened on both sides (the game is over, or both players were shown)'
      : 'partial: only what ' + side(viewer) + ' could see (the game was still going when this was saved)',
    summary: [],
    result: { phase: state.phase, round: state.round, winner: state.winner, turnLimit: R.turnLimit },
    rules: { cpPerTurn: R.cp.perTurn, cpBankCap: R.cp.bankCap, thrustBankTurns: R.move.bankTurns },
    replayable: false, note: null, turns: [], setup: [],
  };
  const turns = turnsOf(state);
  if (R.rapid && state.rapid && state.seed != null) return rapidLog(state, log, full, viewer, side, nm);
  if (state.seed == null) {
    log.note = 'This game has no seed, so it cannot be replayed; only the list of actions is shown. It was started before battle logs existed (15 Nov 2026), or on the old beta page before beta became the main game (16 Nov 2026), and its save was carried over.';
    log.turns = turns.map((t) => ({ round: t.round, player: t.player, side: side(t.player), ...(t.at ? { at: t.at } : {}), actions: full || t.player === viewer ? t.actions.map((x) => ({ text: x })) : [] }));
    log.summary = analyse(log).text;
    return log;
  }
  const visible = (e) => full || (e.seenBy || []).includes(viewer);
  const clean = (e) => { const { seenBy, ...rest } = e; return full ? { ...rest, seenBy } : rest; };
  const words = (e) => eventWords(e, nm, side);
  let cur = null, moved0 = null;
  const rules0 = startRules(state);
  let final;
  try {
    final = replay(rules0, state.seed, turns, (prev, s, text, ti) => {
      if (!prev) { log.setup = s.events.filter(visible).map((e) => ({ ...clean(e), say: words(e) })).filter((e) => e.say); return; }
      const t = turns[ti];
      if (!cur || cur.i !== ti) {
        const pl = prev.players[t.player], mine = full || t.player === viewer;
        cur = { i: ti, round: t.round, player: t.player, side: side(t.player), ...(t.at ? { at: t.at } : {}), actions: [] };
        if (full) { cur.pre = t.pre; cur.rng = prev.rng; }
        if (mine) { cur.cp = { start: pl.cp }; cur.thrust = { start: fleetThrust(prev, t.player) }; }
        moved0 = new Map(prev.ships.filter((x) => x.owner === t.player && !x.dead).map((x) => [x.id, x.pos.join(',')]));
        log.turns.push(cur);
      }
      const mineTurn = full || t.player === viewer;
      const evs = s.events.filter(visible).map((e) => ({ ...clean(e), say: words(e) }));
      const rec = mineTurn ? { text, say: actionWords(prev, s, text, nm), events: evs } : { events: evs };
      if (text === 'e' && mineTurn) {
        const pl = prev.players[t.player];
        cur.cp.left = pl.cp; cur.cp.wasted = Math.max(0, pl.cp - R.cp.bankCap);
        cur.thrust.left = fleetThrust(prev, t.player);
        cur.thrust.wasted = prev.ships.filter((x) => x.owner === t.player && !x.dead).reduce((n, x) => n + Math.max(0, (x.thrust || 0) - bankCap(prev, x)), 0);
      }
      if (text === 'e' || s.phase === 'over') {
        if (full) {
          // ships that moved this turn and that the other side can see when its turn starts
          const theirEyes = new Set(s.players.flatMap((_, q) => (q === t.player ? [] : [...visibleTo(s, q)])));
          cur.movedShips = [...moved0.keys()].filter((id) => { const x = prev.ships.find((z) => z.id === id); return x && !x.dead && x.pos.join(',') !== moved0.get(id); });
          cur.exposed = cur.movedShips.filter((id) => theirEyes.has(id) && s.ships.some((z) => z.id === id && !z.dead));
          cur.post = t.post || hashState(s);
        }
        const seen = full ? null : visibleTo(s, viewer);
        cur.ships = snapshot(s, (x) => full || x.owner === viewer || (seen.has(x.id) && !x.dead));
      }
      if (!evs.length && !mineTurn) return;
      cur.actions.push(rec);
    });
  } catch (e) {
    log.note = 'The replay did not match this game (' + e.message + '), so results are missing. Please report this.';
    log.turns = turns.map((t) => ({ round: t.round, player: t.player, side: side(t.player), ...(t.at ? { at: t.at } : {}), actions: full || t.player === viewer ? t.actions.map((x) => ({ text: x })) : [] }));
    log.summary = analyse(log).text;
    return log;
  }
  log.replayable = hashState(final) === hashState(state);
  if (!log.replayable) log.note = 'The replay finished in a different position from the saved game. Results may be off; please report this.';
  if (full) log.replay = { seed: state.seed, finalHash: hashState(state), rules: rules0, turns };
  log.summary = analyse(log).text;
  return log;
}

// Rapid mode (engine/rapid.js): replay the game tick by tick from its seed and the actions both sides
// chose, and write each tick as two turns (yours with the tick's events, then the other side's).
function rapidLog(state, log, full, viewer, side, nm) {
  const visible = (e) => full || (e.seenBy || []).includes(viewer);
  const clean = (e) => { const { seenBy, ...rest } = e; return full ? { ...rest, seenBy } : rest; };
  const parse = parseTick;
  const ticks = state.rapid.ticks;
  log.rapid = true;
  let s;
  try {
    s = rapidStart(state.rules, state.seed);
    for (const k of ticks) {
      const prev = s;
      s = rapidTick(s, k.acts.map(parse));
      const evs = s.events.filter(visible).map((e) => ({ ...clean(e), say: eventWords(e, nm, side) })).filter((e) => e.say);
      for (const p of [0, 1]) {
        const mine = full || p === viewer;
        const t0 = k.acts[p].split('+');
        const rec = mine ? { text: k.acts[p], say: k.acts[p] === 'pass' ? 'passed' : t0.map((x) => actionWords(prev, s, x, nm)).join(', and its wingman ') } : {};
        if (p === 0) rec.events = evs;
        const t = { round: k.round, player: p, side: side(p), actions: mine || p === 0 ? [rec] : [] };
        // where every ship is: every 10th tick, the tick a ship is lost, and the last tick
        // (a full copy every tick made a 120-tick log almost 1 MB)
        const lost = s.events.some((e) => e.t === 'destroyed' || e.t === 'converted');
        if (p === 1 && (k.round % 10 === 1 || lost || k === ticks[ticks.length - 1])) { const seen = full ? null : visibleTo(s, viewer); t.ships = snapshot(s, (x) => full || x.owner === viewer || (seen.has(x.id) && !x.dead)); }
        log.turns.push(t);
      }
    }
  } catch (e) {
    log.note = 'Rapid mode: the replay did not match this game (' + e.message + '), so results are missing. Please report this.';
    log.turns = ticks.flatMap((k) => [0, 1].map((p) => ({ round: k.round, player: p, side: side(p), actions: full || p === viewer ? [{ text: k.acts[p] }] : [] })));
    log.summary = analyse(log).text;
    return log;
  }
  log.replayable = hashState(s) === hashState(state);
  log.note = 'Rapid mode: both sides act at once each tick; each tick is written as two turns, with the tick\u2019s events under the first.'
    + (log.replayable ? '' : ' The replay finished in a different position from the saved game, so results may be off; please report this.');
  if (full) log.replay = { seed: state.seed, finalHash: hashState(state), rules: state.rules, rapid: ticks };
  log.summary = analyse(log).text;
  return log;
}

// Rebuild the game a full log describes.
export function replayLog(log) {
  if (!log || log.format !== LOG_FORMAT) throw new Error('that is not a SHATKON battle log');
  if (!log.replay) throw new Error('this log was saved mid-game and only holds one side\u2019s view, so it cannot be replayed');
  if (log.replay.rapid) {   // rapid mode: tick by tick
    let s = rapidStart(log.replay.rules, log.replay.seed);
    for (const k of log.replay.rapid) s = rapidTick(s, k.acts.map(parseTick));
    if (log.replay.finalHash && hashState(s) !== log.replay.finalHash) throw new Error('the replay did not end where the game did');
    return s;
  }
  const s = replay(log.replay.rules, log.replay.seed, log.replay.turns);
  if (log.replay.finalHash && hashState(s) !== log.replay.finalHash) throw new Error('the replay did not end where the game did');
  return s;
}

// ---------- the recap ----------
// Who the recap is written for: the human seats.
function focusOf(log) {
  if (log.viewer !== 'all') return [log.viewer];
  if (log.seat === 'cpu') return [0];
  if (log.seat === 0 || log.seat === 1) return [log.seat];
  return [0, 1];
}

export function analyse(log) {
  const sides = log.sides || ['Player 1', 'Player 2'], side = (p) => sides[p] || 'Player ' + (p + 1);
  const names = {};
  for (const t of log.turns) for (const s of t.ships || []) names[s.id] = (s.flagship ? '\u2605 ' : '') + s.name + ' (' + s.id + ')';
  const nm = (id) => names[id] || id;
  const ownerOf = (id) => { const m = /^(\d)/.exec(id || ''); return m ? Number(m[1]) - 1 : null; };
  const lines = [], recap = [], moments = { firstSight: {}, bigHits: [], lost: [], unused: [], exposed: [], missiles: [] };
  const focus = focusOf(log);
  const allEv = [];
  for (const e of log.setup || []) allEv.push({ e, round: 0, player: null });
  for (const t of log.turns) for (const a of t.actions || []) for (const e of a.events || []) allEv.push({ e, round: t.round, player: t.player, action: a });

  // first exact sighting of an enemy ship, each way
  for (const { e, round } of allEv) {
    if (e.t !== 'sighted' || e.kind !== 'ship') continue;
    const by = e.seenBy ? e.seenBy[0] : (log.viewer !== 'all' ? log.viewer : null), victim = ownerOf(e.id);
    if (by == null || victim === by || moments.firstSight[by]) continue;
    moments.firstSight[by] = { round, id: e.id, at: e.at, how: e.why && e.why.scanned ? 'an active scan' : e.why && e.why.lit ? 'a blast lighting it up' : e.why && e.why.by ? nm(e.why.by) + '\u2019s sensors at range ' + e.why.d : 'sensors' };
  }
  // hits taken ('damage' is the owner's account, so it is complete for both sides in a full log)
  for (const { e, round } of allEv) if (e.t === 'damage') moments.bigHits.push({ round, ship: e.ship, owner: ownerOf(e.ship), hits: e.hits, cause: e.cause, lost: e.lost, hull: e.hull });
  moments.bigHits.sort((a, b) => b.hits - a.hits || a.round - b.round);
  for (const t of log.turns) for (const a of t.actions || []) (a.events || []).forEach((e, i, evs) => {
    if (e.t !== 'destroyed') return;
    const last = evs.slice(0, i).reverse().find((x) => (x.t === 'damage' || x.t === 'hit') && x.ship === e.ship);
    moments.lost.push({ round: t.round, ship: e.ship, name: e.name, owner: e.owner, flagship: e.flagship, cause: e.cause || (last && last.cause) || null, turnOf: t.player, flight: a.text === 'e' });
  });
  for (const t of log.turns) {
    if (t.cp && t.cp.left != null && (t.cp.wasted > 0 || t.thrust.wasted > 0)) moments.unused.push({ round: t.round, player: t.player, cp: t.cp.left, cpWasted: t.cp.wasted, thrust: t.thrust.left, thrustWasted: t.thrust.wasted });
    if (t.exposed && t.exposed.length) moments.exposed.push({ round: t.round, player: t.player, ships: t.exposed });
  }
  // missiles and drones: what became of each one launched
  const launched = new Map();
  for (const { e, round, player } of allEv) {
    // whose missile: the launching ship's owner (a rapid-mode tick holds both sides' events under one turn)
    const owner = e.ship ? ownerOf(e.ship) : null;
    if (e.t === 'launch') launched.set(e.obj, { obj: e.obj, kind: e.kind, round, player: owner ?? player, ship: e.ship, fate: 'still flying when the log ends', hurt: 0 });
  }
  for (const t of log.turns) for (const a of t.actions || []) {
    const evs = a.events || [];
    evs.forEach((e, i) => {
      const m = e.obj && launched.get(e.obj);
      if (e.t === 'obj_lost' && m) m.fate = 'wasted: it ' + e.why + ' (round ' + t.round + ')';
      if (e.t === 'obj_destroyed' && m) m.fate = 'wasted: shot down or caught in a blast (round ' + t.round + ')';
      if (e.t === 'blast' && m) {
        let hurt = 0;
        for (let j = i + 1; j < evs.length && evs[j].t !== 'blast'; j++) if (evs[j].t === 'damage' && ownerOf(evs[j].ship) !== m.player) hurt += evs[j].hits;
        m.hurt = hurt;
        m.fate = hurt ? 'hit for ' + plural(hurt, 'hit') + ' (round ' + t.round + ')' : 'exploded without hurting an enemy ship (round ' + t.round + ')';
      }
    });
    // point defence stops do not name the missile: match them to the side's oldest unresolved one
    for (const e of evs) if (e.t === 'stopped') {
      const victim = ownerOf(e.ship), m = [...launched.values()].find((x) => x.player !== victim && x.kind === e.kind && /still flying/.test(x.fate));
      if (m) m.fate = 'wasted: stopped by point defence on ' + nm(e.ship) + ' (round ' + t.round + ')';
    }
  }
  moments.missiles = [...launched.values()];
  // laser shots that never reached their target (something in the way) or did nothing
  moments.shots = [];
  for (const t of log.turns) for (const a of t.actions || []) (a.events || []).forEach((e, i, evs) => {
    if (e.t !== 'fire') return;
    const short = !!(e.end && (e.end[0] !== e.at[0] || e.end[1] !== e.at[1])), next = evs.slice(i + 1).find((x) => x.t === 'damage' || x.t === 'hit' || x.t === 'obj_destroyed');
    const struckShip = next && (next.t === 'damage' || next.t === 'hit') && next.at && e.end && next.at[0] === e.end[0] && next.at[1] === e.end[1];
    moments.shots.push({ round: t.round, player: t.player, at: e.at, end: e.end, hits: e.hits, blocked: short && !struckShip, by: short ? (struckShip ? 'a ship in the way' : next && next.t === 'obj_destroyed' ? 'a ' + next.kind : 'something unseen') : null });
  });

  // ---- write it out ----
  const winner = log.result && log.result.winner;
  lines.push('SHATKON battle recap' + (log.chapter ? ' \u2014 ' + log.chapter : ''));
  if (log.result) lines.push(log.result.phase === 'over' ? 'Result: ' + (winner === 'draw' ? 'a draw' : side(winner) + ' won') + ' in round ' + Math.min(log.result.round, log.result.turnLimit || 99) + '.' : 'The game was still going (round ' + log.result.round + ') when this was saved.');
  if (log.started || log.lastPlayed) lines.push('Played: ' + (log.started ? 'started ' + log.started : 'start time not recorded') + (log.lastPlayed ? ', last move ' + log.lastPlayed : '') + ' (UTC).');
  lines.push('What this covers: ' + log.scope + '.');
  if (log.note) lines.push('Note: ' + log.note);
  lines.push('');
  lines.push('KEY MOMENTS');
  for (const p of [0, 1]) {
    const f = moments.firstSight[p];
    if (f) lines.push('- First sighting: ' + side(p) + ' spotted ' + nm(f.id) + ' in round ' + f.round + ' at [' + f.at + '], through ' + f.how + '.');
    else if (log.viewer === 'all' || log.viewer === p) lines.push('- ' + side(p) + ' never got an exact fix on an enemy ship.');
  }
  for (const h of moments.bigHits.slice(0, 5)) lines.push('- Big hit, round ' + h.round + ': ' + nm(h.ship) + ' (' + side(h.owner) + ') took ' + plural(h.hits, 'hit') + ' from ' + h.cause + (h.lost.length ? ' \u2014 ' + h.lost.join(', ') : '') + '; hull ' + h.hull + '%.');
  for (const l of moments.lost) lines.push('- Ship lost, round ' + l.round + ': ' + side(l.owner) + ' lost ' + (l.flagship ? 'the flagship ' : '') + l.name + ' (' + l.ship + ')' + (l.cause ? ' to a ' + l.cause : '') + (l.flight ? ' during the flight phase' : l.turnOf !== l.owner ? ' on ' + side(l.turnOf).replace(/^You$/, 'your').replace(/^The computer$/, 'the computer\u2019s').replace(/^Your opponent$/, 'your opponent\u2019s').replace(/^(Player \d)$/, '$1\u2019s') + ' turn' : '') + '.');
  const end = moments.lost.find((l) => l.flagship && log.result && log.result.phase === 'over');
  if (end) lines.splice(2, 0, 'How it ended: ' + side(end.owner).replace(/^You$/, 'your') + (side(end.owner) === 'You' ? '' : '\u2019s') + ' flagship ' + end.name + ' was destroyed in round ' + end.round + (end.cause ? ' by a ' + end.cause : '') + '.');
  if (!moments.lost.length) lines.push('- No ships were lost.');
  lines.push('');
  lines.push('THINGS TO LOOK AT' + (focus.length === 1 ? ' (for ' + side(focus[0]) + ')' : ''));
  let tips = 0;
  for (const p of focus) {
    const un = moments.unused.filter((u) => u.player === p);
    if (un.length) { tips++; lines.push('- Points thrown away: in ' + plural(un.length, 'turn') + ' you ended with more than you can bank (' + un.slice(0, 6).map((u) => 'round ' + u.round + ': ' + (u.cpWasted ? plural(u.cpWasted, 'command point') : '') + (u.cpWasted && u.thrustWasted ? ' and ' : '') + (u.thrustWasted ? u.thrustWasted + ' thrust' : '')).join('; ') + '). Spending them on a move, scan or shot is free value.'); }
    const ex = moments.exposed.filter((u) => u.player === p);
    if (ex.length) { tips++; lines.push('- Ending a turn in sight: ' + plural(ex.length, 'time') + ' a ship you had just moved finished the turn where the enemy could see it (' + ex.slice(0, 6).map((u) => 'round ' + u.round + ': ' + u.ships.map(nm).join(', ')).join('; ') + '). Moving makes noise; ending in cover or out of range keeps you hidden.'); }
    const ms = moments.missiles.filter((m) => m.player === p);
    const wasted = ms.filter((m) => /^wasted|without hurting/.test(m.fate));
    if (ms.length) { lines.push('- Missiles and drones: ' + plural(ms.length, 'launch') + ', ' + ms.filter((m) => m.hurt).length + ' did damage, ' + wasted.length + ' wasted.'); for (const m of wasted.slice(0, 6)) lines.push('    ' + m.kind + ' ' + m.obj + ' (round ' + m.round + '): ' + m.fate + '.'); if (wasted.length) tips++; }
    const sh = moments.shots.filter((x) => x.player === p), bad = sh.filter((x) => x.blocked || !x.hits);
    if (sh.length) lines.push('- Laser shots: ' + sh.length + ' fired, ' + (sh.length - bad.length) + ' reached their target.');
    if (bad.length) { tips++; lines.push('- Shots that did not reach the target: ' + bad.slice(0, 6).map((x) => 'round ' + x.round + ' at [' + x.at + ']' + (x.blocked ? ', blocked by ' + x.by + ' at [' + x.end + ']' : ', no damage')).join('; ') + '. A mine, drone or other ship on the line of fire soaks the shot.'); }
    const took = moments.bigHits.filter((h) => h.owner === p).reduce((n, h) => n + h.hits, 0), gave = moments.bigHits.filter((h) => h.owner !== p).reduce((n, h) => n + h.hits, 0);
    if (log.viewer === 'all') lines.push('- Hits: ' + side(p) + ' dealt ' + gave + ' and took ' + took + '.');
    const first = moments.firstSight[p], theirs = moments.firstSight[1 - p];
    if (theirs && (!first || theirs.round < first.round)) { tips++; lines.push('- The enemy found you first (round ' + theirs.round + (first ? ', you found them in round ' + first.round : '') + '). Scans and keeping your engines quiet help you win the hide-and-seek.'); }
  }
  if (!tips) lines.push('- Nothing obvious: no thrown-away points, no ships left in view after moving, no wasted missiles.');
  for (const t of log.turns) {
    const head = 'Round ' + t.round + ' \u2014 ' + side(t.player) + (t.cp && t.cp.left != null ? ' (command points ' + t.cp.start + ' \u2192 ' + t.cp.left + ' left, thrust on all ships ' + t.thrust.start + ' \u2192 ' + t.thrust.left + ')' : '');
    if (log.rapid && !(t.actions || []).length) continue;   // rapid mode: the other side's hidden half of a tick says nothing
    recap.push(head);
    if (!(t.actions || []).length) recap.push('  (nothing you could see)');
    for (const a of t.actions || []) {
      if (a.say && a.text !== 'e') recap.push('  \u2022 ' + a.say.charAt(0).toUpperCase() + a.say.slice(1) + '.');
      else if (a.text && !a.say) recap.push('  \u2022 ' + a.text);
      for (const e of a.events || []) {
        if (!e.say || e.t === 'move' || e.t === 'launch') continue;
        if (log.viewer === 'all' && (e.t === 'enemy_fire' || e.t === 'hit')) continue;   // the other side's view of the same shot
        recap.push('      ' + (a.text === 'e' ? '(end of turn) ' : '') + e.say);
      }
    }
    if (t.exposed && t.exposed.length) recap.push('  ! Left in enemy view after moving: ' + t.exposed.map(nm).join(', '));
  }
  return { lines, recap, moments, text: lines.concat(['', 'TURN BY TURN']).concat(recap) };
}

// The text summary as one string (the analyser prints this; the download keeps it as lines).
export const recapText = (log) => analyse(log).text.join('\n');
