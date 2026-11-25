# Three-player Shatkon (experimental build)

Started 26 Nov 2026 (gamedev chat). Ankur asked for a third experimental build: **three players, free for all, smaller fleets**, built in four parts while he sleeps:

1. analysis (this page)
2. code
3. tests and bug fixes
4. two boards: fleets at alternate **corners**, and at alternate **flat edges**; then merge

Nothing here changes two-player play. Every change is keyed off "this game has 3 fleets" or a board setting, and `tests/golden.test.js` (recorded two-player games replayed move for move) must still pass.

## What Ankur decided
- Free for all. No alliances, no shared sight between players.
- Smaller fleets than 1v1.

## What I decided (he was asleep; all are settings or easy to change)

| Question | Decision | Why |
|---|---|---|
| Which rules? | **Rapid rules** (one action a tick, everyone at once). Frontier economy on. | Simultaneous ticks scale to 3 with no turn-order advantage; taking turns would always favour whoever reacts last. |
| Who plays | You (player 1) vs two computers. Open board (watch 3 computers) for testing. | Three phones on one 15 s clock over WhatsApp can't work; me v me v me can come later. |
| Fleet (each) | 5 scouts, one 2-hex, one 3-hex, a 7-hex flagship: 8 ships, 17 hexes. | 24 ships on the board in total, a little under a 1v1 game (26). |
| Board | Radius 12. | Same size as Rapid Opus; three smaller fleets fit with a contested middle. |
| "Forward" | Towards the centre. Edge starts have 2 forward directions (as now); corner starts have 3 (Ankur's own "the 3 hexes facing the enemy"). | One rule covers both maps. |
| The line | A **centre ring**: a ship is past the line when it is within `ring` hexes of the centre (default 3), or further from its home than the centre is. | There is no single "other side" with two enemies. Reaching the middle is what unlocks free movement, passing, scans, converting and the shop's turrets/mines, as the line does now. |
| Winning | Last flagship standing. | Same as now. |
| Knocked out | When your flagship dies you are out: your other ships **scuttle** (destroyed where they are), your mines, buoys, turrets and missiles go too. The game goes on between the other two. | Leaving orphan ships on the board is confusing and would let an eliminated player still decide the game. |
| Bounty | Whoever lands the **killing hit** on a flagship takes the dead player's rekon, plus a bounty (setting, default 10). Ship kills pay only the side that made them (today every enemy gets paid). | Counters "let the other two fight": the fighter gets richer. |
| Who did it | The engine remembers who last hit each ship (laser, missile, turret, mine, ram). A ship that dies is credited to that side. | Needed for kill pay and bounties. |
| Tick cap | 100 ticks, then the most points wins: alive (flagship hull %) + kills. | A cautious pair must not stall for ever. |
| Flares | Unchanged: a laser hit lights you up for everyone. | The bounty is the counterweight; making flares one-way is a later experiment if waiting still pays. |
| The computer | Picks a target among two enemies: finish off what's weakest, shoot back at whoever hit it last tick, otherwise the nearest. | A computer that only ever fights one side would be easy to exploit. |
| Colours | You blue, player 2 pink (as now), player 3 amber. | |

## What has to change in the code

Most of the engine is already N-player: `newGame` loops over fleets, `detect.js` loops over players, `actions.js` has `foe()`, `checkWin` maps over players. The two-player places:

| Where | Today | Change |
|---|---|---|
| `engine/rules.js` | "exactly 2 players" | 2 or 3. `copy_of` gains `turn: 120` / `turn: 240` (rotate hulls and deployment around the centre) next to `mirror_*`. |
| `engine/hex.js` | `EDGE` has the six flat edges | add six corners (`corner_e`, `corner_ne`, ..., rows = distance from the corner hex) so a zone can be a corner. |
| `engine/rapidrules.js` | `homeSign` = north or south | a **home point** per side (edge midpoint or corner) in cube coordinates. `rowsForward` = progress from home towards the centre (0 at home, radius at the centre: exactly today's number on north/south boards). `forwardDirs` = steps that gain progress. `pastLine` gets the ring rule when the game has 3 sides. |
| `engine/rapid.js` | `for (const p of [0, 1])` (about 12 places), `rapidTick(g, [a, b])`, `asCurrent` order | loop over `s.players`; `acts` has one entry per player; knock-out handling after each damage step; bounty; who-hit-whom. |
| `engine/damage.js` `checkWin` | any flagship down ends the game | 3 sides: a side whose flagship is down is **out** (`s.out[p]`, scuttle), the game ends when one side is left (or none: draw). |
| `engine/economy.js` | `[0, 1]`; kill pay to every enemy | loop players; kill pay only to the killer; bounty. |
| `engine/objective.js` `limitWinner` | compares two scores | most points; tie = draw. |
| `engine/log.js` | `[0, 1]` | loop players (short log: one action per player per tick). |
| `engine/rapid.js` AI | the enemy = "not me" | already works with 2 enemies; add target choice (above). |
| `ui/play.js` | player 1 is you, player 2 the computer | the computer plays every seat that isn't you; colours, names ("Computer 1", "Computer 2"), end screen and chips for 3. Me v me stays 2-player only. |
| `ui/ships.js`, `ui/board.js` | `TEAM[o === 1 ? 1 : 0]` | a third team colour; `TEAM[o]`. Ship bows point away from their own home (`board.js` already does this from the home zone). |
| `ui/postgame.js` | two columns | one per side. |
| Settings | | "Centre ring" (2/3/4) and "Bounty" (0/10/20) on 3-player boards only. |

## Risks
- **`ui/play.js` is 2,500 lines written for two sides.** The most likely place for bugs; part 3 plays complete games in headless Chrome.
- **The two-player numbers must not move.** `rowsForward` on a north/south board must give exactly today's values; the golden replays prove it.
- **Waiting may still pay.** Watch the computer games in part 3: if the side that fights least wins most, raise the bounty or try one-way flares next.
- **Corner starts** put a fleet's wings closer to the other two homes than its middle. The zone depth on that board must keep ships out of the other homes' first rows.

## Findings
(Parts 2 to 4 add theirs here.)
