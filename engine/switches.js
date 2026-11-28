// Switches: one named list of the on/off (and pick-one) rules that differ between kinds of game.
// Ankur, 28 Nov 2026: a master list with defaults, a level for each kind of game, then the board or
// chapter. Design: docs/design/switches.md.
//
//   1. master    world file `switches:`        every switch and its default (the only place a switch is born)
//   2. mode      world file `modes:<mode>`      what this kind of game changes (skirmish, rapid, story, tutorial, experiments)
//   3. board     a board file's `switches:`     or a chapter file's `switches:` (inside `chapter:`)
// The last level that names a switch wins. Players' battle settings stay where they are (ui/settings.js).
//
// Read a switch with sw(rules, 'name') (or sw(state, 'name')) from the engine and the screen alike,
// so no code asks "is this chapter 1?" again. Rule numbers (damage, prices) are not switches; they
// stay in the world file and board `rules:` overrides.

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

// The kind of game. A chapter can say `mode: tutorial`; every other chapter is story.
export function modeOf(rules) {
  if (rules.campaign) return rules.campaign.mode || 'story';
  if (rules.rapid) return rules.rapid.experiments === 'on' || rules.rapid.experiments === true ? 'experiments' : 'rapid';
  return 'skirmish';
}

export function sw(rulesOrState, name) {
  const rules = rulesOrState && rulesOrState.rules && !rulesOrState.switchDefaults ? rulesOrState.rules : rulesOrState;
  if (!rules) return undefined;
  const board = rules.switchBoard || {}, mode = (rules.modes || {})[modeOf(rules)] || {};
  if (name in board) return board[name];
  if (name in mode) return mode[name];
  return (rules.switchDefaults || {})[name];
}
// Every switch, resolved (for the screen, which reads them through the view).
export function allSwitches(rules) {
  const out = {};
  for (const k of Object.keys(rules.switchDefaults || {})) out[k] = sw(rules, k);
  return out;
}

// Problems with a switches block: a name that isn't in the master list (a typo), or a value of the wrong kind.
export function switchProblems(defaults, block, where) {
  const out = [];
  if (block == null) return out;
  if (!isObj(block)) return [where + ': switches must be a list of name: value'];
  for (const [k, v] of Object.entries(block)) {
    if (!(k in (defaults || {}))) out.push(`${where}: unknown switch "${k}" (the list is in the world file under switches:)`);
    else if (typeof v !== typeof defaults[k]) out.push(`${where}: switch "${k}" should be ${typeof defaults[k]}, not ${JSON.stringify(v)}`);
  }
  return out;
}
