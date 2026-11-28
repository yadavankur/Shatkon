// Words for the player: the plain-English lines of the log, the impact report and the ship card.
// Kept out of the play screen so a test can run every event type through it (tests/log-words.test.js).
import * as E from '../engine/index.js';

export const pretty = (n) => String(n || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const at = (c) => '[' + c[0] + ', ' + c[1] + ']';
export const nice = (k) => String(k).replace(/_/g, ' ');
export const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : /x$/.test(w) ? 'es' : 's');
// How a ship is named: its character name when the ship_codes switch is off (story), else its code (1a, 2b).
export function shipNamer(game) {
  const names = !!game && E.sw(game, 'ship_codes') === false;
  return (id) => {
    if (!names || typeof id !== 'string') return id;
    const z = game.ships.find((q) => q.id === id);
    return z && z.name ? pretty(z.name) : id;
  };
}
// Several of the same entry in a row of parts ("shield down", "shield down") read "shield down \u00d72".
export function tally(list) {
  const n = new Map();
  for (const x of list || []) n.set(x, (n.get(x) || 0) + 1);
  return [...n].map(([x, c]) => (c > 1 ? x + ' \u00d7' + c : x));
}
const SHIELD_ONLY = (lost) => !!lost && lost.length > 0 && lost.every((s) => /^shield/.test(s));
export function whyText(w, game) {
  if (!w) return '';
  if (w.lit) return 'It is lit up by an explosion or a collision, so everyone can see it for now.';
  if (w.scanned) return 'Your scan revealed it.';
  if (w.drone) return 'It gave itself away by spotting one of your ships.';
  const by = game ? shipNamer(game)(w.by) : w.by;
  return 'Your ' + by + ' sees it from ' + plural(w.d, 'hex') + ' away: sensor ' + w.range + ' + its signature ' + w.sig + (w.flare ? ' (which includes ' + w.flare + ' of flare from firing)' : '') + ' reaches ' + (w.range + w.sig) + '.';
}
// What the player is told about a sighting. Story text is short: who saw it, no coordinates or sums
// (the ship card still has the detail).
function sightedLine(game, nm, e) {
  const thing = e.kind === 'ship' ? 'the enemy ship ' + e.id : /missile|drone/.test(e.kind) ? 'an incoming ' + nice(e.kind) : 'a ' + nice(e.kind);
  if (game && game.rules.campaign) {
    const by = e.why && e.why.by ? nm(e.why.by) : null;
    return by ? by + ' spotted ' + thing + '.' : thing.charAt(0).toUpperCase() + thing.slice(1) + ' came into view.';
  }
  return 'Spotted ' + (e.kind === 'ship' ? 'enemy ship ' + e.id : 'a ' + nice(e.kind)) + ' at ' + at(e.at) + '. ' + whyText(e.why, game);
}
// One line of the log for an event, or null when it has nothing to say (script beats, cutscenes and the like).
export function describeEvent(game, seat, e) {
  const text = lineFor(game, seat, e);
  // story text never shows board coordinates ("exploded at [-1, 1]"): that is for the detail view, not the log
  return text && game && game.rules.campaign ? text.replace(/ at \[-?\d+, -?\d+\]/g, '') : text;
}
function lineFor(game, seat, e) {
  const threeP = !!(game && game.players && game.players.length > 2), cpuName = (n) => (threeP ? 'Computer ' + n : 'The computer');
  const nm = shipNamer(game);
  e = { ...e, ship: e.t === 'ram' || e.t === 'removed' ? e.ship : nm(e.ship), into: Array.isArray(e.into) ? e.into.map(nm) : nm(e.into), id: e.t === 'sighted' || e.t === 'lost' ? nm(e.id) : e.id,
    target: e.t === 'launch' ? nm(e.target) : e.target, ships: Array.isArray(e.ships) ? e.ships.map(nm) : e.ships };
  switch (e.t) {
    case 'castle': return 'Castled: your flagship now starts at ' + at(e.to) + (e.swap ? ', and ' + e.swap + ' took its old spot' : '') + '. The enemy was not told.';
    case 'move': return e.ship + ' moved ' + plural(e.steps, 'hex') + '.';
    case 'sighted': return sightedLine(game, nm, e);
    case 'lost': return 'Lost sight of ' + e.id + (e.faded ? ': its flare faded.' : ': it is out of sensor range now.') + ' A "?" marks where it was last seen.';
    case 'fire': return e.ship + ' fired' + (e.hits ? '.' : ' and did nothing.');
    case 'damage': return e.ship + ' section ' + (e.seg + 1) + ' took ' + plural(e.hits, 'hit') + ' from a ' + nice(e.cause) + ': ' + (tally(e.lost).join(', ') || 'no effect') + '.' + (e.hull != null ? ' Hull ' + e.hull + '%.' : '');
    case 'hit': return 'Hit ' + e.ship + ' section ' + (e.seg + 1) + ' with ' + plural(e.hits, 'hit') + (e.lost && e.lost.length ? ': ' + tally(e.lost).join(', ') : '') + (e.wrecked ? ', section wrecked' : '') + '.'
      + (e.hull == null ? '' : SHIELD_ONLY(e.lost) && e.hull >= 100 ? ' The shield took it, so the hull is untouched.' : ' Its hull is at ' + e.hull + '%.');
    case 'destroyed': return (e.flagship ? 'Flagship ' : game && E.sw(game, 'ship_codes') === false ? '' : 'Ship ') + e.ship + ' was destroyed.';
    case 'blast': return 'A ' + nice(e.kind) + ' exploded at ' + at(e.at) + '.';
    case 'stopped': return 'Point defence on ' + e.ship + ' stopped a ' + nice(e.kind) + '.';
    case 'launch': return e.ship + ' launched a ' + nice(e.kind) + (e.target ? ' locked on ' + e.target : '') + '.';
    case 'scan': return e.ship + ' scanned: ' + (e.found ? plural(e.found, 'thing') + ' fully revealed within ' + e.r1 + ' hexes' : 'nothing within ' + e.r1 + ' hexes') + (e.pinged ? ', ' + plural(e.pinged, 'faint contact') + ' out to ' + e.r2 : '') + '.';
    case 'enemy_fire': return 'Enemy ' + e.ship + ' fired a laser' + (e.hits ? '.' : ' and missed.');
    case 'bump': return e.ship + ' ran into ' + e.into + '. Both are revealed.';
    case 'obj_lost': return 'Your ' + nice(e.kind) + ' ' + e.why + '.';
    case 'obj_destroyed': return 'A ' + nice(e.kind) + ' was destroyed at ' + at(e.at) + '.';
    case 'bought': return 'You bought ' + (E.BUY_WORDS[e.item] || e.item) + (e.item === 'turret' ? ': ' + e.ship + (e.laser ? ' left a laser behind' : ' put it') + ' at ' + at(e.at) : e.item === 'upgrade' ? ' for ' + e.ship + ' (' + E.UPGRADES[e.kind].label + ')' : e.item === 'resupply' ? ' for ' + e.ship + ' (+1 ' + nice(e.kind) + ')' : '') + ' for \u25c8 ' + e.cost + ' (\u25c8 ' + e.purse + ' left).';
    case 'turret_fire': return (e.owner === 0 ? 'Your turret' : 'An enemy turret') + ' fired at ' + (/^o/.test(e.target || '') ? 'a missile or turret' : e.target) + ' (' + plural(e.hits, 'hit') + ').';
    case 'turret_hit': return (e.owner === 0 ? 'Your turret' : 'An enemy turret') + ' took ' + plural(e.hits, 'hit') + ' (' + e.hp + ' left).';
    case 'turret_lit': return 'A dark turret is working again.';
    case 'turret_dark': return 'A turret went dark: not enough rekon for its upkeep.';
    case 'upkeep': return 'Turret upkeep: \u25c8 ' + e.amount + '.';
    case 'rammed': return (e.ship[0] === '1' ? 'Your ' : 'Enemy ') + e.ship + ' rammed ' + e.target + ': its segment is wrecked.';
    case 'decoy': return 'Decoy placed at ' + at(e.at) + ' for 3 ticks.';
    case 'decoy_hit': return 'A ' + nice(e.kind) + ' went for a decoy at ' + at(e.at) + '.';
    case 'decoy_gone': return 'Your decoy faded.';
    case 'woke': return e.ship + ' woke from hibernation (' + e.why + ').';
    case 'mended': return e.ship + ' mended its ' + nice(e.part) + ' while hibernating.';
    case 'stunned': return (e.ship[0] === '1' ? 'Your ' : 'Enemy ') + e.ship + ' stopped a ' + nice(e.kind) + ' but is stunned: it can\u2019t act next tick' + (e.kind === 'missile' ? ', and the Nuke still did 2 hits' : '') + '.';
    case 'idle': return 'You passed: \u2212' + e.lost + ' \u25c8 and no rekon this tick' + (e.missed ? ' (you would have earned ' + e.missed + ')' : '') + '. Sitting still costs.';
    case 'earned': return '+' + e.amount + ' rekon (' + [...new Set((e.items || []).map((i) => E.EARN_WORDS[i.why] || i.why))].join(', ') + (e.capped ? ', capped' : '') + '): \u25c8 ' + e.purse + '.';
    case 'converted': return e.ship + ' went silent: it is now a ' + (e.into === 'mine' ? 'naval mine' : 'scanner buoy') + ' at ' + at(e.at) + '.';
    case 'debris': return e.ship + ' shot a missile down close in: the debris hit it and lit it up for 3 ticks.';
    case 'ammo_lost': return e.ship + ' lost ' + plural(e.count, 'stored munition') + '.';
    case 'pass_reveal': return e.ship + ' flew past ' + e.found.join(', ') + ' under afterburner: lit up for everyone until the end of next round, and so is ' + e.ship + '.';
    case 'burnt_out': return e.ship + '\'s afterburner is burnt out. From now on it moves ' + plural(e.move, 'hex') + ' a turn.';
    case 'lured': return 'Your ' + nice(e.kind) + ' turned on a decoy emitter (' + e.to + ')' + (e.from ? ' and dropped its lock on ' + e.from : '') + '.';
    case 'mine_stir': return 'Something small moved near ' + e.near + '. A faint contact marks roughly where.';
    case 'scene': case 'bark': case 'beat': case 'objective': case 'unlocked': case 'script_unknown': case 'guide': case 'guide_clear': return null;
    case 'spawned': return e.ships.length ? 'New ships have arrived: ' + e.ships.join(', ') + '.' : null;
    case 'split': return 'The enemy ship ' + e.ship + ' split apart into ' + e.into.join(' and ') + '!';
    case 'grafted': return e.name + ' and ' + e.other + ' are grafted into one ship.';
    case 'docked': return e.name + ' and ' + e.other + ' are clamped together.';
    case 'removed': return pretty(e.name || e.ship) + (e.as === 'dark' ? ' went dark and drifted away.' : ' withdrew.');
    case 'locked': return (e.ship ? pretty(e.ship) : 'Your ships') + ' stopped answering the helm.';
    case 'forced': return null;
    case 'ram': return pretty(e.name || e.ship) + ' hurled itself into ' + pretty(e.targetName || e.target) + ': ' + e.hits + ' hits.';
    case 'disabled': return e.ship + ': ' + e.parts.map(nice).join(', ') + ' went offline.';
    case 'enabled': return e.ship + ': ' + e.parts.map(nice).join(', ') + ' back online.';
    case 'rule_changed': return /link_range/.test(e.path) ? 'Comms are jammed: your ships share less of what they see.' : null;
    case 'script_failed': return null;
    case 'objective_scored': return 'Player ' + (e.player + 1) + ' held the beacon and scored (' + e.score + (e.toWin ? ' of ' + e.toWin : '') + '). Holding it lights a ship up.';
    case 'objective_contested': return 'Both sides are on the beacon: nobody scores.';
    case 'game_over': return e.by === 'objective' ? 'Player ' + (e.winner + 1) + ' wins by holding the beacon.'
      : e.by === 'turn_limit' ? (e.winner === 'draw' ? 'The round limit was reached, so the game is a draw.' : (threeP ? 'The tick limit was reached: ' + (e.winner === 0 && seat === 'cpu' ? 'you win' : seat === 'cpu' ? cpuName(e.winner) + ' wins' : 'player ' + (e.winner + 1) + ' wins') + ' with the most of its fleet left.' : 'The round limit was reached: player ' + (e.winner + 1) + ' wins on beacon score.')) : e.winner === 'draw' ? 'The game is a draw.' : 'Player ' + (e.winner + 1) + ' wins.';
  }
  return null;
}

// The log as the player reads it: [{ e, text }] for the events that have something to say, in the order they happened.
export function logLines(game, seat, events) {
  const out = [];
  for (const e of events) { const text = describeEvent(game, seat, e); if (typeof text === 'string' && text.trim()) out.push({ e, text }); }
  return out;
}
