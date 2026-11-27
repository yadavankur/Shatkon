# Free castle

Ankur, 28 Nov 2026: every board's start is fixed and public, so the enemy flagship is easy to find. Measured in [secret-starts-count.md](secret-starts-count.md): the flagship is the real secret, and a short numbered list of layouts gives it away after one sighting. His pick: a free castle, chess style.

## The rule

- **What:** once, before its first action of the game, a side may move its flagship to any legal spot in its own home zone. If one of its own ships is in the way, that ship takes the flagship's old spot (a swap). Everything else stays where the board file puts it.
- **Cost and secrecy:** it's free (no command point, no tick), and the other side is told nothing. Only the castling side gets the event. Battle logs show it to the other side only after the game, like every other action.
- **When:**
  - **Turn-based games:** in round 1, before the side's first action. The side that moves second castles in its own first turn.
  - **Rapid games:** with the first tick's action (tick text `c:<q>,<r>|<action>`). Both sides castle together, before anything else in the tick.
- **Refused when:** the enemy has already seen the flagship, so a side can't dodge a shot it has already drawn; when castling is off; or after the side's first action.
- **Legal spots** (`castleSpots`): every flagship hex is on the board, inside the home zone, and off blocking terrain and mines. A swap needs the other ship to fit at the flagship's old spot.

## On or off

| Where | Default |
|---|---|
| World file `modes:` (master defaults) | skirmish **on**, rapid **on**, story off, experiments off |
| A board file's `map:` section | `castle: true` or `castle: false` overrides the mode default for that board |

The mode comes from the rules: a story chapter is `story`, an Experiments board is `experiments`, any other rapid board is `rapid`, and everything else is `skirmish`. Saved games keep the rules they started with, so a game saved before this change plays on with castling off.

## Playing it

Tap your flagship (★), then **Castle** (only shown while you can still castle). Marked hexes show where it can go; ⇄ marks a swap. Tap one to see the dashed outline, then tap again or press **Castle here**. In rapid games the board shows the castled flagship at once, and the castle happens with your first tick's action.

The computer castles too (`aiCastle`), seeded from the game so it always plays the same game the same way. Aggressive and Muse lean forward, defensive leans back, and the rest pick anywhere. One time in four it stays put, so the board's own start is still a fair guess but never a certainty.

## Where it can't happen today

The enemy can see the flagship from the start on First Light (both sides), and for player 2 on The Minefield, Pawn Storm and Fog Bank, so castling is refused there. If that's not intended, the maps bot can move those starts apart.

## Balance check

`node tools/boards.mjs --both --games 20`, player 1's fleet wins of 40, castling off (`--set modes.skirmish.castle=false`) → on:

| Board | Off | On |
|---|---|---|
| First Light | 20 | 20 |
| The Minefield | 12 | 16 |
| Cat and Mouse | 21 | 21 |
| The Dogleg | 14 | 21 |
| King's Guard | 24 | 11 |
| Pawn Storm | 22 | 19 |
| Beacon Hill | 23 | 19 |
| Missile Alley | 4 | 10 |
| Fog Bank | 23 | 23 |
| The Gambit | 23 | 18 |

All ten are within the 10–30 target with castling on. Missile Alley moved into it from 4.

## Code

`engine/castle.js` (rule, spots, computer pick), plus hooks in `engine/turn.js` (the action), `engine/rapid.js` (the first tick), `engine/codec.js` (`c<q>,<r>`), `engine/log.js`, `engine/ai.js` and `engine/rules.js` (`modes`, `castleBoard`). On screen: `ui/play.js` (Castle button, markers, preview) and `ui/board.js`. Tests: `tests/castle.test.js`.

The three golden rapid games still replay move for move. Their final hashes changed only because the rules gained `modes`, which is part of the rules fingerprint.

— Claude (gamedev chat)
