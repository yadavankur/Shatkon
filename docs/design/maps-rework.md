# Maps rework: ten different boards, two new ideas

16 Nov 2026 · from maps (GameBuilderMaps), for Ankur · first on branch `maps-rework`, now merged to main with the engine work (PR #28)

> **Status (16 Nov 2026, after the merge):** the engine bot built the rule changes this doc first proposed (Comet reveal-as-it-flies and burn-out, the sleeper mine's drift and two-segment wreck, `scan_resist`, the decoy `emitter`, and a computer that varies its game). The afterburner, sleeper mine and emitter now live in `world_v0.4.yaml`, not in the board files. Its write-up, with the changes it made to the spec on purpose, is `docs/maps-rework-engine.md`. The sections below say what is built; the current win rates are at the end.

Ankur's brief: *don't have the same maps with the same ships. The point of discovery for a human is to find how to change the way you play to your advantage. Design new ships if you have to, and bend the rules a little.* He also asked for two things: a super-fast throwaway scout, and mines that are far more stealthy and far deadlier.

## What was wrong with the first ten

- Nine of ten were the same radius-8 hexagon, one side starting north and the other south, with ships in almost the same starting spots.
- The Minefield and The Strait were the same map: a rock wall across the middle with gaps.
- The Minefield's "clean" right-hand gap had a contact mine two hexes past it.
- Nobody had played them for fairness or fun. (Still true: see "What the simulations say" below.)

## What the engine already lets a board do

Everything below loads in today's engine.

- **Shape:** the board is always a hexagon, but the radius can change (6 to 11 here). With asteroid discs (`radius:` on an asteroid) a board can be carved into a canyon or a corridor.
- **Starts:** each side's home is any of the six edges (`north`, `south`, `north_east`, `south_west`, `north_west`, `south_east`) with any depth. Opposite edges give a head-on start, neighbouring edges a flank start, and a very deep zone an encirclement.
- **Changing world numbers for one board:** a board's `rules:` sets any world-file path for that board only (`bay_parts.afterburner.max_per_fleet: 3`, `ai.vs_computer: "balanced"`). It can also add a whole new part or mine; the engine reads parts by their numbers, not their names. (The afterburner, sleeper mine and emitter started that way and are now in the world file.)
- **Per-ship computer behaviour:** `ai: defensive` (or `runner`) on a ship changes only how the computer flies that ship.

## The boards

"You" are player 1. The computer is player 2.

| # | Board | Shape and start | Fleets | What a human finds out |
|---|---|---|---|---|
| 1 | First Light | Radius 6 (smallest), north against south, five rocks. A true mirror: hulls are flipped too. | Corvette and gunboat each. | The basics: the attack run, and how to fire from a rock's edge so only one enemy has a line on you. |
| 2 | The Minefield | Radius 9, diagonal (south-east against north-west). No wall: scattered rocks and two nebulas. | You: corvette, **Dowser** (minesweeper), two gunboats. Them: corvette and two snipers dug in behind 3 sleeper, 4 proximity and 4 contact mines. | The field looks open and is not. The Dowser sees a sleeper mine from 2 hexes, so lead with it, stop, and shoot the mine. Nebulas blind the Dowser too, and the mines sit at their edges. One lane is clean (it hugs the south-west edge). A test checks that it is clean and that every other way through is mined. |
| 3 | Cat and Mouse | Radius 11 (biggest), four nebula banks. Stealth doubled, cores see 1 hex. | You (the cat): an unarmed comms flagship, three **Hounds**, three **Comets** (this board raises the Comet limit from 2 to 3). Them (the mouse): a shadow and two snipers. | A Comet is built to be lost. It lights up what it flies past and, when it dies, everything within 5 hexes, so the skill is having the Hounds ready where it will die, and never spending all three Comets at once. |
| 4 | The Dogleg (was The Strait) | Radius 9, a canyon with two right-angle bends through solid rock. Mouths at opposite corners. Point-symmetric. | Each side: a brawler, a **carrier** with 4 seeker drones, and a gunboat. | No laser sees round a corner, so whoever comes round a bend first is shot first. Drones go round corners and report back. You learn to scout with drones, then fight at the bend. |
| 5 | King's Guard | Radius 8, flank start on neighbouring edges (south and south-west), mirrored across the corner. Kings sit at the far ends. | Unarmed king, two gunboats, a sniper, and a Comet as the "Knight". | The corner is where the fight starts, not where it is won. Hold it with one ship and send the rest the long way round to their king. |
| 6 | Pawn Storm | Radius 10. The dreadnought starts in the centre inside a cage of six rock clumps; your skiffs start on the southern half of the rim in three pairs (west, south, east), each behind a clump, 9+ hexes away: out of its 5-hex sight and its 8-hex laser range. | You: corvette and six one-laser skiffs (they see it from 11). Them: the dreadnought. | Come in under cover and arrive together. A shield soaks the first hit each round, so put two skiffs on the same segment, from opposite sides so it cannot back away from both. The skiff it chases should run, not fight. |
| 7 | Beacon Hill | Radius 7, north against south, mirrored. The beacon sits in a rock crater with openings only to the east and west. | Light fleets on both sides: a small flagship, two couriers, three skiffs. | Only two lines of fire reach the beacon. Cover both openings and the enemy holder is a sitting duck. Couriers get there first but die there. |
| 8 | Missile Alley | Radius 10, a five-hex-wide alley 13 rows long between walls of rock. | You: 18 missiles (missile flagship and three missile boats that carry two sensors each, so they see first). Them: a bastion, two point-defence escorts (two point defences, one laser each) and a gunboat. | Nowhere to spread out: missile blasts hit the ship next to the target too, and point defence has to be saturated in one round. |
| 9 | Fog Bank | Radius 8. You are dug in from the south-west up to the middle, and they attack from the north-east. A big nebula is your moat. | You: starter flagship, sniper, gunboat, courier, and 3 sleeper, 1 proximity and 3 contact mines. Them: a brawler and three gunboats (aggressive). | You defend, outgunned. Show a ship just beyond a mine and let them come to you through it. Only a scan finds your mines, and a scan lights up the ship that sends it. |
| 10 | The Gambit | Radius 9, angled start (south-east against north). Nebulas on their side. | You: corvette, two snipers, three Lures (decoys). Them: shadow, two snipers and a **Volley** (three launchers that fire on one order). | Ankur's point about salvoes: the first ship they see takes a salvo. So make that ship a Lure, then strike while they reload. |

No two boards share a starting layout or a main idea, and each fleet mix is used on one board only.

## New ships

The new pieces (the afterburner part, the sleeper mine and the decoy emitter) are in `world_v0.4.yaml` with the numbers the engine bot built.

| Ship | Hull | Numbers | Job |
|---|---|---|---|
| **Comet** (boards 3, 5) | One hex: core, **afterburner**, sensor. No mounts. | Moves 8 hexes a turn on its own drive (a courier does 5, a missile 6). Lasers only hit it from 2 hexes or closer. It lights up enemies within 2 hexes of every hex it passes (and is lit itself while it flies). When it dies, every ship within 5 hexes is lit up for everyone, and so is the ship that shot it. The afterburner burns out after 3 turns and it cannot hold a beacon. At most 2 a fleet (world default); a board can raise it. Cost 18. | Ankur's super-fast scout: it goes in, probably dies, and the dying is the point. |
| **Dowser** (board 2) | A 3-hex line with five sensors, one engine, a laser, two armour and a shield. | Sensor 12. It sees a sleeper mine (signature -10) from 2 hexes, a proximity mine (-8) from 4 and a contact mine (-6) from 6. In a nebula it loses 3. | The minesweeper, and the "other level of stealth looking for it" that Ankur described. |
| **Hound** (board 3) | A gunboat that gives up an engine for a second sensor. | Two lasers, sensor 6 (5 on Cat and Mouse). | Hunts what the Comets find. |
| **Carrier** (board 4) | A 3-hex line with two launchers and two magazines. | Carries 4 seeker drones (speed 3, they see 3, and they report). | Scouts round corners. |
| **Volley** (board 10) | A 3-hex line with three launchers. | 6 missiles. With salvo on, one order fires all three. | Makes the first sighting deadly, so a decoy has something to stop. |
| **Sleeper mine** (boards 2, 9) | A mine, not a ship. | Signature -10, so only a ship with sensor 11 or more ever sees it, and then only from 1 hex (2 hexes with sensor 12). A scan only finds it within 2 hexes. It drifts 1 hex a round toward the biggest enemy within 3 (a drifting mine gives a faint contact). When an enemy segment comes next to it, that segment and the nearest other segment are wrecked outright, shields or not (never the core as the second, so one mine cannot sink a flagship). Lasers pass over it. Up to 3 a side, cost 15. | Ankur's mine: passive, almost undetectable, and it goes off before you can react. Most ships can never see it at all. |

### Built (was "asks" in the first version of this doc)

**Comet:** `own_move: 8`, `evades_beyond: 2`, `death_flash: 5`, plus `reveals_on_pass: 2`, `burn_turns: 3` (then `burnt_move`), `holds_objective: false` and `max_per_fleet: 2`. The cap of 2 a fleet was my suggestion (maps), not a rule Ankur asked for; it stops a swarm of scouts lighting the whole board. It is a world default, and a board can change it in `rules:` (Cat and Mouse sets 3).

**Sleeper mine:** signature -10, `scan_resist: 2`, `wrecks_segments: 2` with `ignores_shields`, `drift: 1`, `drift_sense: 3`, `prefers: largest`, `beams_pass: true`. Changed by the engine bot on purpose, and I agree: the second wrecked segment is never the core's (so one mine cannot sink a three-hex flagship), a creeping mine gives its target a faint contact (so there is a turn to react), and lasers no longer sweep sleepers by accident.

**Decoy emitter:** a bay part that adds signature, so a Lure looks like a bigger ship. The Gambit's Lures carry it. It works through its signature, not by pulling missiles.

**Not built, on purpose:** the computer using mines as bait by default (it stalls against a player who also waits). It is `ai.tricks.mines_as_bait_rounds`, 0 in the world file, 8 on The Minefield and Fog Bank.

## What the simulations say (a smoke test only)

`node tools/boards.mjs --both --games 20`, after the merge and my retunes (16 Nov 2026). Each board is played 20 times as written and 20 times with the seats swapped (the other fleet moves first from the same spots). The figure is player 1's fleet's wins out of 40. Under about 6 of 40 either way is noise.

| # | Board | Before the engine work | Engine bot's run | Now | Rounds |
|---|---|---|---|---|---|
| 1 | First Light | 20 | 20 | 20 | 7.7 |
| 2 | The Minefield | 16 | 13 | 13 | 16.0 |
| 3 | Cat and Mouse | 15 | 18 (two Comets) | 15 (three Comets) | 27.3 |
| 4 | The Dogleg | 2 | 23 | 23 | 13.0 |
| 5 | King's Guard | 40 | 19 | 19 | 10.9 |
| 6 | Pawn Storm | 20 | 10 | 22 (rebuilt) | 13.3 |
| 7 | Beacon Hill | 23 | 21 | 21 | 11.2 |
| 8 | Missile Alley | 25 | 3 | 18 (retuned) | 9.8 |
| 9 | Fog Bank | 11 | 10 | 10 | 9.4 |
| 10 | The Gambit | 13 | 22 | 22 | 13.2 |

Every board loads, passes the two-device pasted-code check (`--codes`), and the mirror boards (1, 4, 5, 7) now come out near even. Cat and Mouse ends at the round limit in 14 of 40 games: the computer is a poor hunter, which is the point of the board.

- **Cat and Mouse:** third Comet back (board sets `bay_parts.afterburner.max_per_fleet: 3`), "never send all three" hint kept. 15 of 40.
- **Pawn Storm:** rebuilt so nobody can shoot on turn 1 (see the board table). Home zone is now 7 rows, not the whole board, so scans keep their normal steps. The computer flies the dreadnought "balanced" (aggressive gave 30 of 40). 22 of 40, and the seat no longer decides it (11 and 11).
- **Missile Alley:** missile boats trade an engine for a second sensor, the escorts' second laser became armour. 18 of 40 (was 3).
- **Fog Bank** is meant to be hard (10 of 40 for the defender): the computer does not fight from behind its mines the way a person would. Its 6-row home zone costs the defender only the mid-field scan step, and the defender rarely goes that far forward, so I left it.
- **Not yet done:** nobody has played these by hand. That is the real test.

## Limits

- The computer now launches drones, shoots mines it can see, and varies its game, but it does not use Comets cleverly (it flies them with the `runner` personality) and does not wait behind its own mines unless a board turns that on.
