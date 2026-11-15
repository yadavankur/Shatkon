# New kinds of ship, and ten boards to try

16 Nov 2026. This follows Ankur's note: the simulations only show how the computer plays, so here are boards to play by hand. Open `beta/boards.html` for the list.

## Rethinking what a ship is

A ship is a hull of hexes with parts in it. What kind of ship it is comes from what it leaves out.

| Kind | What it leaves out | What that buys | Status |
|---|---|---|---|
| **Proximity mine** (`naval_mine`) | core and engine | Room for a big charge and almost no signature (-8). It goes off when an enemy segment comes within 1 hex. The segment that trips it is wrecked (a working shield takes the blow instead) and every other segment within 1 hex takes 4 hits: two or three segments in all. Only an active scan finds it. Cost 12, 4 a side. | In the engine, tested |
| **Courier** (`sprint_drive` part; the `dart` design) | weapons, armour, fleet engines | Moves 5 hexes a turn on its own drive, outside the fleet's thrust pool (a missile does 6). Sees 4 hexes and can scan. A laser only hits it from 3 hexes or closer, and one hit there kills it. When it dies, every ship within 3 hexes is lit up for everyone, and so is the ship that shot it. Cost 16. | In the engine, tested |
| **King** (the `king` design) | every weapon | A flagship that is all armour, shields and point defence. The fleet has to guard it. No new rule needed. | Design only |
| **Contact mine** (`mine`) | | Unchanged: 4 hits on touch. The story chapters use it, so it was left alone. | As before |

Both new things are new entries in `beta/rules/world_v0.4.yaml`. Nothing that existed was changed, and the campaign check gives the same output as before.

**Limits you will notice.**
- The move preview does not warn you about the ring round a proximity mine you have found, only the mine's own hex.
- The computer does not scan for mines and walks into them. It flies its own couriers ahead only on Cat and Mouse.
- The contact mine was not rebuilt as a "ship with no core"; a mine is still a piece on the board. In play the difference is invisible.

## Ideas from chess and other board games (not built)

| Idea | From | What it would be here |
|---|---|---|
| The king | chess | Done as a design: an unarmed flagship (board 5). |
| Promotion | chess | A small ship that reaches the enemy's home rows scores, or calls in a reserve ship. The map objective code could carry it. |
| Gambit | chess | Give up a decoy to make the enemy show itself (board 10). Works today because a laser hit lights up the shooter. |
| Fork | chess | A courier that threatens to find two hidden groups at once; the enemy can only shoot it from one. |
| Tempo | chess | Simulations suggest who shoots first decides many games. A fixed first player, or a "pass" that banks a point, would make tempo a choice rather than luck. |
| Ko / no repeats | go | A fleet may not return to the hexes it left last turn: ends the one-hex shuffle camper without forcing movement on everyone. |
| Territory | go | Score for hexes your sensors cover at the end, not only for the flagship. |
| Minelayer | naval games | A ship that lays mines during play. Needs a new order. |
| Hidden pieces | Stratego | Already the heart of the game; a ship that reads as a different size on sensors is on the parked list. |

**Progression for a campaign (a sketch).** Start with guns only (boards 1, 4). Add mines and the scan (2, 9). Add couriers when stealth upgrades arrive (3). Add missiles and point defence as a pair (8). Late chapters give one side a weak fleet and one trick (6, 9, 10).

## The ten boards

> **Reworked on branch `maps-rework` (16 Nov 2026).** The boards below are the first versions. Each board now has its own shape, start and fleet, and there are new ships (Comet, Dowser, Hound, carrier, Volley) and a new sleeper mine. See `maps-rework.md`. The Strait is now The Dogleg (`04_the_dogleg`). The table below is kept as the record of the first round.

You are south (player 1); the computer is north. Each board is one file in `beta/rules/boards/` holding its map, both fleets and any rule numbers it changes.

"Computer-flown" is 10 games with the computer on both sides (`node tools/boards.mjs`, seeds 1 to 10). **It is a smoke test, not a balance result**: the computer does not use the trick each board is about, and with fixed starting positions it replays nearly the same game.

| # | Board | The point of it | New things | Computer-flown, south |
|---|---|---|---|---|
| 1 | First Light | Learn the controls on an even duel | | 10-0 |
| 2 | The Minefield | Find the clean gap by scanning | proximity mines, couriers | 9-1 |
| 3 | Cat and Mouse | Extreme stealth; couriers are the only eyes | couriers, stealth ×2, cores see 1 hex | 10-0 |
| 4 | The Strait | A chokepoint held by shields | | 10-0 |
| 5 | King's Guard | Unarmed flagships | king, courier | 2-8 |
| 6 | Pawn Storm | Six skiffs against one dreadnought | | 10-0 |
| 7 | Beacon Hill | Hold the centre for points | objective, courier | 0-10 |
| 8 | Missile Alley | Saturate point defence in the open | | 6-4 |
| 9 | Fog Bank | Outgunned, with four mines already laid | proximity mines | 0-10 |
| 10 | The Gambit | Sacrifice a decoy to reveal snipers | | 4-3-3 |

**What the quick runs do show.**
- Every board loads, plays to an end and (in a headless browser, boards 2, 3, 7 and 9) runs with no page errors.
- Boards 1 and 7 are the same fleet on both sides, yet one seat won all ten. That fits the Stage 1 finding that the seat decides.
- On board 1's first version the flagship died to the opening shot: a core segment with nothing in its mounts is destroyed by one 3-hit laser shot (sensor, magazine, core). The stock flagship and several test flagships have a bare core segment. This may be part of why the first shot decides so much. Not proven.
- Fog Bank is 0-10 computer-flown because the computer on your side does not use the mines as bait. That is the board working as designed, not a result.

## Playing a friend by pasted codes

Checked at the engine level on all ten boards (`node tools/boards.mjs --codes`):

- The **game code** carries the whole game, board included, so your friend needs no board link. It is about 3,600 to 4,200 characters.
- After that each turn is a **turn code** of 50 to 222 characters (the long ones are missile turns). Two devices stayed in step for whole games on every board, up to 60 turns.
- A turn code with one character changed was refused. The same code pasted twice was refused. A code for the wrong round or player is refused with a message saying which it is for.

**Not checked:** the buttons in the browser by hand, and WhatsApp itself (whether it mangles a 4,000-character code).

**Weaknesses, for the record.**
- The beta game code holds both fleets in the clear (compressed, not sealed), so a friend who decodes it sees your starting positions and mines. The root game seals its game codes; beta has not had that fix.
- A turn code is scrambled with a key made from its own header, so it stops accidents and casual edits, not a determined cheat. That matches "trust is assumed".
