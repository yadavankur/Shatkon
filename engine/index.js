// The engine's front door. Screens, AI players and tests import from here only.
//
//   const { rules, problems } = buildRules(world, map, fleets);   // parsed YAML in
//   let game = start(rules, seed);
//   game = apply(game, { type: 'move', ship: '1a', path: [2, 2] });
//   const mine = view(game, 0);            // what player 1 is allowed to see
//   const code = turnCode(game);           // after 'end': send this to the other player

import { newGame } from './state.js';
import { begin } from './turn.js';
import { startScript } from './script.js';

export { buildRules, shipStats } from './rules.js';
export { apply, attempt } from './turn.js';
export { view, knowledge, undoSafe } from './view.js';
export { reach, beamTargets, beamStop, launchOptions, shipStatus, forecast, aimLaunch, beamField, dangerMap, incoming } from './query.js';
export { turnCode, readTurnCode, applyTurnCode, exportGame, importGame } from './sync.js';
export { hashState, actionText, parseAction } from './codec.js';
export { Illegal } from './state.js';
export * as hex from './hex.js';

// Building blocks the play screen, the Lab and the computer player use to explain
// and simulate the rules. They read the state; only apply() changes the game.
export { sigBreak, signatureOf, sensorOf, eyes, detectRange, passiveRange, sees, visibleTo, contactsFor, netMoved, motionSig, refreshSight, addFlare } from './detect.js';
export { scanInfo } from './scan.js';
export { moveCap, movesLeft, shipWeight, bankCap, hasOwnDrive, ownMove } from './actions.js';
export { holders } from './objective.js';
export { hullPct, num, footprint, workingParts, sumAttr, gap, firstSeat, isMissile, missileKinds } from './state.js';
export { fnv, seededRandom } from './codec.js';

export function start(rules, seed = 1) {
  const g = begin(newGame(rules, seed));
  if (rules.campaign) startScript(g);   // a story chapter: its script takes over from here
  return g;
}

// Story campaigns: build a chapter's rules, run its script, carry results to the next chapter.
export { buildChapter, applyResult, nextNodes, newCampaign, shipToHull } from './chapter.js';
export { campaignMove } from './ai.js';
export { guideView } from './guide.js';

// Rapid mode: one action a side per tick, both resolved together (engine/rapid.js).
export { STYLES, styleOf, econAI } from './econai.js';
// Experiments (switched off unless a game turns them on): engine/experiments.js, engine/labrules.js
export { EXPERIMENTS, EXP_KEYS, exp } from './experiments.js';
export { LAB_SHOP, mineKindFor, ramRefusal, decoyRefusal, decoySpots, warpSpots, MINE_KINDS } from './labrules.js';
// Economy mode (Frontier): salvage earned by flying through the board (engine/economy.js).
export { shopItems, UPGRADES, upgradeRefusal, resupplyRefusal, magazineRoom, TURRET, turretSpots, hitObject, droppableLaser, isTurret, turretLive, SHOP, price, buyRefusal, heatOn, threatMap, BUY_WORDS, ECON_DEFAULTS, econOn, econTick, econConfig, purse, newGround, hexValue, inEnemyHalf, nextToAsteroid, EARN_WORDS } from './economy.js';
export { rapidRules, rapidStart, rapidTick, rapidAI, rapidRefusal, legalMoves, forcedMoves, passAllowed, autoFire, autoLaunch, RAPID_DEFAULTS, homeSign, forwardDirs, pastLine, shipsPast, unlocked, rowsForward, scanAllowed, inOpening, stride, wingMoves, wingShots, tickText, parseTick, canConvert } from './rapid.js';

// Battle logs: replay a saved game turn by turn, and a plain-English recap of it.
export { battleLog, replayLog, shortLog, replayShort, SHORT_FORMAT, analyse, recapText, LOG_FORMAT } from './log.js';
