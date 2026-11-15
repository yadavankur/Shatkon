# Maps rework: ten different boards, two new ideas

16 Nov 2026 · from maps (GameBuilderMaps), for Ankur · branch `maps-rework` (from `variety-study`)

Ankur's brief: *don't have the same maps with the same ships. The point of discovery for a human is to find how to change the way you play to your advantage. Design new ships if you have to, and bend the rules a little.* He also asked for two things: a super-fast throwaway scout, and mines that are far more stealthy and far deadlier.

## What was wrong with the first ten

- Nine of ten were the same radius-8 hexagon, one side starting north and the other south, with ships in almost the same starting spots.
- The Minefield and The Strait were the same map: a rock wall across the middle with gaps.
- The Minefield's "clean" right-hand gap had a contact mine two hexes past it.
- Nobody had played them for fairness or fun. (Still true: see "What the simulations say" below.)

## What the engine already lets a board do

Everything below loads in today's engine. Nothing in `beta/engine/` was changed.

- **Shape:** the board is always a hexagon, but the radius can change (6 to 11 here). With asteroid discs (`radius:` on an asteroid) a board can be carved into a canyon or a corridor.
- **Starts:** each side's home is any of the six edges (`north`, `south`, `north_east`, `south_west`, `north_west`, `south_east`) with any depth. Opposite edges give a head-on start, neighbouring edges a flank start, and a very deep zone an encirclement.
- **New parts and mines in one board file:** a board's `rules:` can add a whole new part (`bay_parts.afterburner: {...}`) or a new mine (`munitions.sleeper_mine: {...}`). The engine reads parts by their numbers, not their names, so these work today without touching the world file.
- **Per-ship computer behaviour:** `ai: defensive` (or `runner`) on a ship changes only how the computer flies that ship.

## The boards

"You" are player 1. The computer is player 2.

| # | Board | Shape and start | Fleets | What a human finds out |
|---|---|---|---|---|
| 1 | First Light | Radius 6 (smallest), north against south, five rocks. A true mirror: hulls are flipped too. | Corvette and gunboat each. | The basics: the attack run, and how to fire from a rock's edge so only one enemy has a line on you. |
| 2 | The Minefield | Radius 9, diagonal (south-east against north-west). No wall: scattered rocks and two nebulas. | You: corvette, **Dowser** (minesweeper), two gunboats. Them: corvette and two snipers dug in behind 3 sleeper, 4 proximity and 4 contact mines. | The field looks open and is not. The Dowser sees a sleeper mine from 2 hexes, so lead with it, stop, and shoot the mine. Nebulas blind the Dowser too, and the mines sit at their edges. One lane is clean (it hugs the south-west edge). A test checks that it is clean and that every other way through is mined. |
| 3 | Cat and Mouse | Radius 11 (biggest), four nebula banks. Stealth doubled, cores see 1 hex. | You (the cat): an unarmed comms flagship, three **Hounds**, three **Comets**. Them (the mouse): a shadow and two snipers. | A Comet is built to be lost. Its death flash shows everything within 5 hexes, so the skill is having the Hounds ready where it will die, and never spending all three Comets at once. |
| 4 | The Dogleg (was The Strait) | Radius 9, a canyon with two right-angle bends through solid rock. Mouths at opposite corners. Point-symmetric. | Each side: a brawler, a **carrier** with 4 seeker drones, and a gunboat. | No laser sees round a corner, so whoever comes round a bend first is shot first. Drones go round corners and report back. You learn to scout with drones, then fight at the bend. |
| 5 | King's Guard | Radius 8, flank start on neighbouring edges (south and south-west), mirrored across the corner. Kings sit at the far ends. | Unarmed king, two gunboats, a sniper, and a Comet as the "Knight". | The corner is where the fight starts, not where it is won. Hold it with one ship and send the rest the long way round to their king. |
| 6 | Pawn Storm | Encircled: the dreadnought starts in the centre in a broken ring of rock, and you deploy all round it. | You: corvette and six one-laser skiffs. Them: the dreadnought. | A shield soaks the first hit each round, so put two skiffs on the same segment, from opposite sides so it cannot back away from both. The skiff it chases should run, not fight. |
| 7 | Beacon Hill | Radius 7, north against south, mirrored. The beacon sits in a rock crater with openings only to the east and west. | Light fleets on both sides: a small flagship, two couriers, three skiffs. | Only two lines of fire reach the beacon. Cover both openings and the enemy holder is a sitting duck. Couriers get there first but die there. |
| 8 | Missile Alley | Radius 10, a five-hex-wide alley 13 rows long between walls of rock. | You: 18 missiles (missile flagship and three missile boats). Them: a bastion, two point-defence escorts and a gunboat. | Nowhere to spread out: missile blasts hit the ship next to the target too, and point defence has to be saturated in one round. |
| 9 | Fog Bank | Radius 8. You are dug in from the south-west up to the middle, and they attack from the north-east. A big nebula is your moat. | You: starter flagship, sniper, gunboat, courier, and 3 sleeper, 1 proximity and 3 contact mines. Them: a brawler and three gunboats (aggressive). | You defend, outgunned. Show a ship just beyond a mine and let them come to you through it. Only a scan finds your mines, and a scan lights up the ship that sends it. |
| 10 | The Gambit | Radius 9, angled start (south-east against north). Nebulas on their side. | You: corvette, two snipers, three Lures (decoys). Them: shadow, two snipers and a **Volley** (three launchers that fire on one order). | Ankur's point about salvoes: the first ship they see takes a salvo. So make that ship a Lure, then strike while they reload. |

No two boards share a starting layout or a main idea, and each fleet mix is used on one board only.

## New ships

All of these are built from parts that exist now. The two new pieces, the afterburner part and the sleeper mine, are defined inside the board files that use them.

| Ship | Hull | Numbers | Job |
|---|---|---|---|
| **Comet** (boards 3, 5) | One hex: core, **afterburner**, sensor. No mounts. | Moves 8 hexes a turn on its own drive (a courier does 5, a missile 6). Lasers only hit it from 2 hexes or closer. When it dies, every ship within 5 hexes is lit up for everyone, and so is the ship that shot it. Cost 18. | Ankur's super-fast scout: it goes in, probably dies, and the dying is the point. |
| **Dowser** (board 2) | A 3-hex line with five sensors, one engine, a laser, two armour and a shield. | Sensor 12. It sees a sleeper mine (signature -10) from 2 hexes, a proximity mine (-8) from 4 and a contact mine (-6) from 6. In a nebula it loses 3. | The minesweeper, and the "other level of stealth looking for it" that Ankur described. |
| **Hound** (board 3) | A gunboat that gives up an engine for a second sensor. | Two lasers, sensor 6 (5 on Cat and Mouse). | Hunts what the Comets find. |
| **Carrier** (board 4) | A 3-hex line with two launchers and two magazines. | Carries 4 seeker drones (speed 3, they see 3, and they report). | Scouts round corners. |
| **Volley** (board 10) | A 3-hex line with three launchers. | 6 missiles. With salvo on, one order fires all three. | Makes the first sighting deadly, so a decoy has something to stop. |
| **Sleeper mine** (boards 2, 9) | A mine, not a ship. | Signature -10, so only a ship with sensor 11 or more ever sees it, and then only from 1 hex (2 hexes with sensor 12). It goes off when an enemy segment comes next to it: that segment is wrecked outright (a working shield takes the blow instead), and every segment beside it takes 5 hits. Up to 3 a side, cost 15. | Ankur's mine: passive, almost undetectable, and it goes off before you can react. Most ships can never see it at all. |

### How the scout works today, and what it needs

Today (data only): `own_move: 8` (moves outside the fleet's thrust pool), `evades_beyond: 2` (beams from further away miss) and `death_flash: 5`. This already works as a throwaway: it can reach the far side of a radius-8 board in two turns, and its death shows you the enemy.

What is missing, and why Ankur said it "wouldn't work in the current engine":
1. **It only reveals when it dies.** A real scout should see as it flies. Proposed: `reveals_on_pass: 2`. Every hex it passes through lights up enemy ships within 2 hexes until the end of the next round. Guard: the Comet is lit too while it flies (it is loud), so it gets shot.
2. **It can scout forever.** Proposed: `burn_turns: 3`. The afterburner works for 3 turns on which it moves, then the ship moves 1 hex a turn. That makes it a one-shot dash.
3. **It could take the beacon.** A 5- to 8-hex ship can step onto an objective every turn. Proposed: `holds_objective: false` on any part with `own_move`, so these ships cannot score a beacon. This matters for Beacon Hill's couriers today.
4. **Cap.** Proposed: `max_per_fleet: 2` on the afterburner part. buildRules reports a problem above that.

### How the mine works today, and what it needs

Today (data only): signature -10, `trigger_range: 1`, `wrecks_segment: true`, `blast_radius: 1`, `blast_hits: 5`. "Invisible unless something looks hard for it" already falls out of the detection rule, because distance must be at most sensor + signature. With sensor 4 you need -6 or better; with -10 only a dedicated sweeper ever sees it.

What is missing:
1. **Scans find it too easily.** A scan reveals everything in its clear ring (up to 6 hexes), whatever the signature. Proposed: `scan_resist: 2`. A scan only reveals this mine within 2 hexes of the scanning ship. That keeps the sweeper as the real answer.
2. **"Takes two segments".** Today the trigger segment is wrecked and its neighbours take 5 hits each, which is usually 1 to 3 segments and depends on the dice. Proposed: `wrecks_segments: 2`. Wreck the trigger segment and the nearest other segment of that ship outright. `ignores_shields: true` means a shield does not save it. A one-hex ship dies, a two-hex ship dies, and a 7-hex flagship loses two segments. That is the WWII "broke its back" feel without one mine sinking a flagship.
3. **"Very slightly smart".** Proposed: `drift: 1, drift_sense: 3`. In the flight phase, a sleeper mine that has an enemy ship within 3 hexes moves 1 hex toward it, never into rock or another piece. And `prefers: largest`: if several enemy ships are in range, it drifts toward the one with the most segments. Guard: it drifts only toward enemies, and only 1 hex a round. A ship moving 2 or more hexes a turn outruns it.

### The decoy (board 10)

A Lure is a one-hex core and engine. It only draws fire when it is the only thing they can see. Proposed: an `emitter` bay part with `adds_signature: 3` and `lures_missiles: true`. A Lure would then look like a bigger ship to sensors (seen from further away, and a bigger rough contact), and a missile seeker that has a choice would pick the emitter. Guard: it costs a bay slot, and the extra signature also makes the carrier easier to find.

## What the simulations say (a smoke test only)

`node tools/boards.mjs --games 20` (the computer flies both sides; seat 1 is you):

| Board | You-W-L | Rounds |
|---|---|---|
| 1 First Light | 0-20 | 5.7 |
| 2 The Minefield | 16-4 | 14.0 |
| 3 Cat and Mouse | 0-20 | 19.1 |
| 4 The Dogleg | 0-20 | 10.3 |
| 5 King's Guard | 20-0 | 11.0 |
| 6 Pawn Storm | 20-0 | 7.0 |
| 7 Beacon Hill | 3-17 | 12.4 |
| 8 Missile Alley | 9-11 | 7.7 |
| 9 Fog Bank | 6-14 | 6.2 |
| 10 The Gambit | 10-10 | 12.3 |

Every board loads, every game finishes (none reached the round limit), and every board passes the two-device pasted-code check (`--codes`).

To separate "which seat" from "which board", each board was also played with the seats swapped: same positions, but the other fleet moves first. That was 20 games each way, with a scratch script that is not committed. The figures below are player 1's fleet's wins out of 40:

| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|
| 20 | 16 | 15 | 2 | 40 | 20 | 23 | 25 | 11 | 13 |

How to read this:
- **The computer plays the same game every time.** Its moves have no randomness; only the dice change. So results come in 20-0 blocks, and on First Light and Pawn Storm the seat alone decides (20-0 one way, 0-20 the other).
- **Boards 4 and 5 are exact mirrors, yet one side wins every game.** On a mirror board that cannot be the board. It is the computer: mirrored positions make it break ties differently. I have flagged it for the engine bot. It does not tell us whether a person would find these boards fair.
- **Fixed during this work:** The Minefield went from 0 wins in 20 to 16 in 40, after weakening the dug-in flagship and flying the defenders `ai: defensive`. Cat and Mouse went from 2 in 20 to 15 in 40, with one sniper fewer for the mouse, an unarmed comms flagship for the cat, and a third Hound. Pawn Storm went from 0 to 20 in 40: its flagship was dying to the dreadnought's opening missiles, so it now has an armoured, shielded core.
- **Meant to be hard:** Fog Bank (11 of 40 for the defender) and The Gambit (13 of 40). The computer does not use your mines as bait or the Lures as decoys, and those are the tricks the boards are about.
- **Not yet done:** nobody has played these by hand. That is the real test.

## Limits

- The computer never launches seeker drones, so the computer's carrier on The Dogleg is only a hull.
- The computer does not shoot mines and does not use its Comets cleverly. It flies them with the `runner` personality.
- When the computer cannot see its enemy, it heads for the middle of the north edge, or else the south edge (`ai.js`, `homePoint`). On diagonal and flank boards that is the wrong edge. In play this rarely matters, because it knows where the enemy started. It is on the engine list.
