# Maps rework: what the engine did with it

16 Nov 2026 · from engine (Claude Code), for Ankur and maps · branch `maps-rework-engine` (from `maps-rework`, with `main` merged in)

This answers `docs/design/maps-rework.md` and the asks in `handoff/to-engine.md`. Every number below comes from a command printed beside it; the raw output is in `docs/design/logs/maps-rework-engine/`. Computer against computer is a smoke test, not a balance result. At 40 games a board, a difference of fewer than about 6 games is noise.

## 1. Why the mirror boards came out 20-0

King's Guard and The Dogleg are exact mirrors (so are First Light and Beacon Hill: `tools/boards.mjs` now checks and says so). They came out 40 of 40 and 2 of 40. The cause was the computer's tie-breaking, as maps suspected, plus an engine bug nobody had asked about.

**Test.** Turn the same board the 12 ways a hexagon can be turned and flipped and play 10 games each (`node tools/boards.mjs --turned --games 10 --board 05_kings_guard`). A computer that does not care which way the board faces gives much the same result every time.

| King's Guard, player 1 wins of 10, turned 12 ways | |
|---|---|
| Variety off (`--set ai.variety.tie_break=0 --set ai.variety.opening_lanes=false`) | 10, 0, 10, 0, 10, 10, 0, 0, 10, 10, 9, 0 |
| Now | 3, 1, 4, 1, 3, 6, 4, 4, 2, 6, 5, 2 |

So the same board, same fleets, same dice gave 10-0 or 0-10 depending only on which way it faced. Three things caused it:

1. **Ties went to whatever came first in a list** (the lowest direction number, the first ship). A tiny seeded nudge on every move and shot score (`ai.variety.tie_break: 0.02`) took King's Guard from 40 of 40 to 20 of 40 and The Dogleg from 2 to 18 of 40 with nothing else changed but the home-edge fix in point 3, which by itself moved neither. This is the main cause.
2. **Lines of sight were not mirror-fair (engine bug).** A straight line that runs exactly along the edge between two hexes always fell on the same one, so on a mirrored board one side could shoot along a rock face and the other could not. 2% to 7% of sight lines within 8 hexes differed from their mirror image (First Light 776 of 10,984; Beacon Hill 840 of 15,250). `hex.sightLine` now calls a line clear when either way of drawing it is clear: 0 differ, and a test holds it there. This matters to people, not just the computer.
3. **The computer assumed the enemy home was north or else south.** On King's Guard the south player marched at its own corner. It now heads for the open middle of the enemy's real home edge (`enemyHomePoint`), which on a canyon or alley board is the mouth, never a hex in the rock.

Now, 20 games each way round (`node tools/boards.mjs --both --games 20`):

| Mirror board | Player 1's fleet, moving first | moving second | of 40 |
|---|---|---|---|
| 1 First Light | 5-14-1 | 15-5-0 | 20 |
| 4 The Dogleg | 8-12-0 | 15-5-0 | 23 |
| 5 King's Guard | 7-13-0 | 12-6-2 | 19 |
| 7 Beacon Hill | 10-10-0 | 11-9-0 | 21 |

**A real effect is left: whoever moves second in round 1 won 81 of 120 games on boards 1, 4 and 5** (68%; Beacon Hill shows none, 21 of 40). The first player alternates each round, so the round-1 second mover gets the first back-to-back pair of turns, just as the fleets come into range. That is a rules question for Ankur, not a board fault.

## 2. Review of the ten boards and the new ships

All ten load with no problems, every game finishes or reaches the round limit, and all ten pass the two-device code check with the new rules (`--codes`). The parts are used as the rules intend, with these exceptions.

**Exploits and bugs found**

- **Any laser shot across a mine's hex destroyed the mine, seen or not.** A beam stops at the first thing it meets. In 10 games each of The Minefield and Fog Bank, 37 sleeper mines were swept by a shot aimed at something else and 7 went off. Mostly it was the mine-layer's own guns firing through its own field. A person could clear a lane by shooting across it at anything. Fixed for the sleeper mine (`beams_pass: true`: only a shot aimed at the mine hits it). **Not fixed for contact and proximity mines**, where it is the standing world rule (`damage.beams_pass_mines: false`): in 10 games each of the same two boards on today's engine, the owner's own beams swept 23 of them and enemy beams 7. Ankur to decide; it would change story chapter 2.
- **A missile over a hidden mine could not be shot.** The engine picked the hidden mine as the target and refused the shot. Fixed.
- **`max_per_fleet: 2` against three Comets on Cat and Mouse.** The cap won: I removed Comet 3 so the board loads. (Correction from maps, 16 Nov: the cap of 2 was the maps bot's suggestion, not Ankur's. It stays the world default; Cat and Mouse now raises it to 3 in its own `rules:` and has its third Comet back.)

**Balance flags for maps (boards are yours; I changed nothing here)**

- **Pawn Storm is decided on turn 1.** Every skiff starts 6 hexes from the Leviathan with a clear line, so player 1 has 42 shots on offer before anything moves; before variety it was 20-0 moving first and 0-20 in 3 rounds moving second. The Leviathan is also caged: its centre can only ever be on 7 hexes, so the "aggressive" computer cannot come out. If the cage is meant, say so on the board; either way start the skiffs out of sight.
- **Pawn Storm and Fog Bank use a very deep home zone to place ships.** Scan strength goes by rows forward from the home edge, so on Pawn Storm the skiffs north of the centre scan at full strength from turn 1 and the ones south of it at the weakest.
- **Missile Alley: 3 of 40 for the missile fleet** (it was 25 of 40 before variety; switching the tie-break off brings back 24). The computer flies missile boats badly (one escort sat at home in the game I traced), so this is partly the pilot. Worth a hand playtest before trusting either number.
- **First Light, The Dogleg, King's Guard:** fair as boards; see the second-mover effect above.

## 3. What was built

All numbers live in `rules/world_v0.4.yaml`. The afterburner, the emitter and the sleeper mine are now defined there once; the copies inside board files 2, 3, 5 and 9 are gone (they would have hidden the new numbers).

| Ask | Built | How it works |
|---|---|---|
| Comet reveals along its path | yes | `reveals_on_pass: 2`. After each hex, enemy ships within 2 are lit for everyone to the end of next round, and so is the Comet. Mines are not shown. Only while the afterburner still burns. |
| Afterburner burns out after 3 turns | yes | `burn_turns: 3`, `burnt_move: 1`. A turn only counts if the Comet moved. The counter is in the game code and turn codes (tested). |
| Max 2 per fleet | yes | `max_per_fleet: 2` on any part; buildRules reports a problem above it. |
| Cannot score the beacon | yes, and wider | `holds_objective: false` on the afterburner **and the courier's sprint drive**. Such a ship neither scores nor contests, so it cannot block a score by parking either. |
| Sleeper: scans see it only within 2 | yes | `scan_resist: 2`. No faint contact beyond that either. |
| Sleeper: wrecks 2 segments, shields don't help | yes, with one guard | `wrecks_segments: 2`, `ignores_shields: true`. **The core's segment is taken last**, so one mine sinks a one- or two-hex ship but not a three-hex flagship unless it goes off against the core itself (maps-rework.md asked for exactly that outcome). The struck ship takes no splash on top. |
| Sleeper: drifts 1 toward an enemy within 3 | yes, with one guard | `drift: 1`, `drift_sense: 3`, `prefers: largest`, at the end of each flight phase, trigger checked after the move. **A mine that crept and did not go off gives the ship it is after a faint contact** (`drift_quiet: false`), so there is one turn to react. |
| Decoy emitter | yes | New bay part `emitter`: `adds_signature: 3`, `lures_missiles: true`. Any missile whose seeker can see an emitter ship drops its lock and its route and turns on it. I fitted it to the three Lures on The Gambit, as the ask described. |
| Computer launches drones | yes | `ai.tricks.launches_drones`: with nothing located it sends a reporting drone toward where it thinks you are, keeps two up, and blows one up beside two or more segments. 160 launches in 40 games of The Dogleg. |
| Computer shoots mines | yes | `ai.tricks.shoots_mines: 4`: a mine it can see within 4 hexes of one of its ships. |
| Decoys as bait | yes | `ai.tricks.decoys_as_bait`: every unarmed escort runs ahead of the fleet. |
| Mines as bait | yes, off by default | `ai.tricks.mines_as_bait_rounds`: 0 in the world file, 8 on The Minefield and Fog Bank. See "Rejected" below. |
| Stops playing the same game | yes | `ai.variety`: seeded tie-breaks, and until it finds you it comes up the left, middle or right (one lane per game). The same seed still replays exactly. 26 to 40 different openings in 40 games on every board but Beacon Hill (14); `--events` prints the count. |

## 4. Rejected or changed, and why

- **Mine-baiting everywhere: rejected as a default.** A computer that waits behind its mines stalls against a player who also waits, and two tests that guard against exactly that failed (`tests/beta-ai.test.js`, "no stalling to the round limit"). It is a per-board switch.
- **"Wreck the nearest other segment" as written: changed.** On a three-hex ship with the core in the middle, the nearest other segment is always the core. An object almost nothing can see would then end the game in one hex of movement. Core last.
- **Silent drift: changed.** With trigger-after-drift, a ship that ends its turn within 2 hexes of a mine it cannot see is hit in the flight phase with no warning. The faint contact is the reaction window. The numbers say drift is the strongest part of the mine (see below), so if anything is still too strong it is this.
- **Scout reveal beyond burn-out, and revealing mines: not built.** Mines stay the Dowser's job.
- **A minesweeping pilot (lead with the Dowser, stop, shoot): not built.** The computer flying The Minefield's attackers still walks into the field. It only matters when the computer plays your side.

## 5. New win rates

`node tools/boards.mjs --both --games 20` (player 1's fleet out of 40, both seat orders). "Before" is the same count on `maps-rework` as it arrived.

| # | Board | Before | Now | Rounds | To the round limit |
|---|---|---|---|---|---|
| 1 | First Light (mirror) | 20 | 20 | 7.7 | 1 |
| 2 | The Minefield | 16 | 13 | 16.0 | 5 |
| 3 | Cat and Mouse (two Comets now) | 15 | 18 | 25.3 | 7 |
| 4 | The Dogleg (mirror) | 2 | 23 | 13.0 | 0 |
| 5 | King's Guard (mirror) | 40 | 19 | 10.9 | 2 |
| 6 | Pawn Storm | 20 | 10 | 7.3 | 1 |
| 7 | Beacon Hill (mirror) | 23 | 21 | 11.2 | 0 |
| 8 | Missile Alley | 25 | 3 | 10.5 | 0 |
| 9 | Fog Bank | 11 | 10 | 9.4 | 1 |
| 10 | The Gambit | 13 | 22 | 13.2 | 4 |

Most of the "before" column came in 20-0 blocks (one game replayed with different dice), so it was never a rate. Do not read 25 to 3 on Missile Alley as the board getting harder.

**Each rule switched off in turn** (`--set`, same 40 games; `logs/maps-rework-engine/switches.txt`):

| Board | As built | Switched off | Player 1 of 40 |
|---|---|---|---|
| The Minefield (player 1 attacks) | 13 | mine drift | 22 |
| | | the whole new mine (back to maps-rework's) | 25 |
| | | computer does not wait behind its mines | 17 |
| Fog Bank (player 1 laid the mines) | 10 | mine drift | 12 |
| | | the whole new mine | 6 |
| The Gambit | 22 | emitter draws no missiles | 26 |
| | | plain Lure (no emitter at all) | 13 |
| Beacon Hill | 21 (16 beacon points scored) | couriers may hold the beacon | 15 (53 points) |
| Cat and Mouse | 18 | Comet does not reveal | 22 |
| | | Comet never burns out | 19 |
| King's Guard | 19 | Comet does not reveal | 17 |
| The Dogleg | 23 | no drones | 21 |

What that says, as far as 40 computer games can:

- **Drift is what makes the sleeper mine bite.** It costs the attacker on The Minefield about 9 games of 40. Most detonations are a mine creeping up in the flight phase (41 went off on Fog Bank in 40 games, 20 on The Minefield).
- **The emitter works through its signature, not its lure.** A Lure that looks like a four-hex ship is seen and shot at first: 13 to 22 or 26 of 40. Drawing missiles (88 turned in 40 games) adds nothing measurable on top.
- **Couriers were taking the beacon.** With them shut out, beacon points fall from 53 to 16 and the mirror goes from 1-19 and 14-6 by seat to 10-10 and 11-9.
- **The Comet's reveal and burn-out do not show up** in computer games: the computer does not hunt on what a Comet lights. This needs a hand playtest.

## 6. Checks

- `npm test`: 148 pass (123 before; 25 new in `tests/beta-maps-rework.test.js`).
- Story chapters (`node campaign/tools/engine_check.mjs --engine beta`): all five still load, 20 of 20 games end the same way. Only chapter 4A moved (average 6.8 to 6.5 rounds), from the sight-line fix. The computer's variety and tricks do not apply to story chapters or to "easy".
- The root game is untouched (`engine/`, `ui/`, `rules/`, `campaign/`, `story/`).
- The sight-line bug is also in the root game's `engine/hex.js`. Not changed here.
