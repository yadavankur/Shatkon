# The computer and the new pieces (engine, 16 Nov 2026)

What changed in how the computer plays mines, missiles, decoys, Comets and drones, what the
post-merge review found, and the numbers. Raw output is in `docs/design/logs/ai-pieces/`.

Everything here is for "Vs computer: normal" (the personalities). Story chapters and "easy" are
untouched: `engine_check` output is the same before and after, line for line.

## How to read the numbers

`node tools/boards.mjs --both --games 20` plays each board 40 times, computer against computer:
20 seeds as written and the same 20 with the fleets swapping seats. "17 of 40" is how often
player 1's fleet won. It is a smoke test, not a balance result: both sides are the same computer.
A difference of about 6 of 40 is noise. On every board the person is player 1 and moves first in
round 1, so the "as written" half is closest to what a person meets.

## Win rates, before and after

| Board | Before | After | As written (W-L-D) | To the round limit (before, after) |
|---|---|---|---|---|
| 01 First Light | 20 | 25 | 11-9-0 | 1, 0 |
| 02 The Minefield | 13 | 21 | 10-10-0 | 5, 1 |
| 03 Cat and Mouse | 15 | 19 | 12-7-1 | 14, 7 |
| 04 The Dogleg | 23 | 18 | 9-11-0 | 0, 0 |
| 05 King's Guard | 19 | 11 | 4-14-2 | 2, 5 |
| 06 Pawn Storm | 22 | 23 | 16-4-0 | 5, 0 |
| 07 Beacon Hill | 21 | 20 | 16-4-0 | 0, 0 |
| 08 Missile Alley | 18 | 14 | 7-13-0 | 0, 0 |
| 09 Fog Bank | 10 | 17 | 8-12-0 | 1, 0 |
| 10 The Gambit | 22 | 25 | 14-6-0 | 4, 1 |

Games that ran to the round limit: 32 of 400 before, 14 after. `--codes` is ok on all ten.

King's Guard at 11 is a low draw of the seeds: over 60 seeds it is 47 of 120 (about 16 of 40).

## What the computer does now

Each is a switch under `ai.tricks` in `rules/world_v0.4.yaml`, so a board can turn one off in its
`rules:` block.

**Mines** (`sweeps_mines`, always-on parts need no switch)
- It keeps every hex inside a known mine's trigger range closed, not just the mine's own hex.
  Proximity and deep mines go off a hex away, and it used to walk into that ring.
- It remembers a mine it saw earlier. This needed an engine fix: a mine's last-seen mark used to
  vanish as soon as any ship came within sensor range, which is exactly when it matters, because
  a mine is far too quiet to see from there. The mark now stays until a ship that could see that
  kind of mine is close enough and does not. Players get this too.
- It never fires a laser across one of its own mines. The mine would take the shot. Before, the
  side that laid the field swept it with its own guns.
- A rough contact on something small (a mine that stirred, a missile) is no longer a place to go.
  A ship backs three hexes off a stir.
- Once it knows the other fleet has mines (the fleet list shows them, or it has met one), its lead
  ship scans each turn it is in ground where mines may be laid. It reads only how many mines the
  rule file lists, never where they are.

**Missiles** (`aims_missiles`, `missile_flight_rounds: 1`)
- It uses the engine's own flight forecast before it launches: the launch hex that gets there
  soonest, and no launch when every way ends on a rock or the board edge.
- It launches only when the missile lands in the same round, so the target gets no turn to shoot
  it down or step aside.
- Over the seven boards with missiles: 236 of 1476 went off before (16%), 396 of 950 after (42%).
  Beacon Hill: 80 of 240 before (the rest flew into asteroids), 113 of 126 after.

**Decoys** (`minds_decoys`)
- Once it knows a ship carries a decoy emitter (a scan showed it, or one of its missiles was pulled
  onto it), its lasers shoot the decoy first while it has missiles left, no missile is launched
  past one, and at most one missile is spent on the decoy itself.

**Comets and couriers** (`scouts: { lead, lead_varies, one_at_a_time, burn_worth }`)
- Of several Comets only one flies. The rest wait, because any move at all uses a burn turn.
- A Comet with burn left moves only when the move is worth a burn turn.
- A scout stays within 8 hexes (give or take 2, different each game) of a friendly ship that can
  shoot, and shadows from one hex outside laser reach instead of flying right up to the enemy.
- On Cat and Mouse the three Comets used to fly at once on turn 1 and were all burnt out by turn
  4, with the guns 15 hexes behind. Now 61 burn-outs in 40 games instead of 115, and the cat loses
  14 games instead of 11 but draws 7 instead of 14.

**Drones** (`drone_range: 12`)
- A carrier keeps its drones until the place it wants looked at is 12 hexes off. On The Dogleg all
  160 drones were launched from the home corners and ran dry over empty space. Now 126 launched,
  28 went off, 7 detonated by hand; in a 20-game count, 36 ship sightings by drones against 0.

**Finding a shot**
- It knows its own ships block its line of fire (the rules refuse those shots) and that a nimble
  ship cannot be hit from far, and it counts the steps to the nearest hex it could shoot from.
  Two crippled fleets used to stand either side of an asteroid, in sight and out of line, to the
  round limit.

## Post-merge review (commits 81fdb65 and 1ed414d)

I compared every merged engine and screen file against both parents (old root and old beta).
The hand merge is clean: no old rule came back and no root-only fix was lost. What I found:

1. **Beam stopped by a ship it could not hit** (`engine/actions.js`, from joining the one hits
   formula with `evades_beyond`). A beam ended on the first ship in its line even when that ship
   was too nimble to hit from there, for 0 hits. A Comet on the line was a shield nothing could
   shoot through or at, and the computer fired 0-hit shots into it. Fixed: the beam carries on.
2. **Battle log did not know the beta pieces** (`engine/log.js`, root-only code meeting beta-only
   events). No words for `pass_reveal`, `burnt_out`, `lured`, `mine_stir`, so the log skipped what
   Comets, sleepers and decoys did. A scan line printed "scan found undefined contacts" (older than
   the merge). Fixed. Logs of all ten boards replay exactly.
3. **Dead code**: `attackRunFor` had no caller left. Removed.
4. **The three adjusted tests** are right. The two missile tests switch `wrecks_segment` off only
   to count hits; I added the same test under the shipped wreck rule. `sigBreak`'s `emitter: 0` is
   the new field and correct.

## Mine rule: should contact and proximity mines get `beams_pass` too? (for Ankur)

Not applied. 40 seeds, both seats, 80 games a row:

| | Minefield, player 1 | Fog Bank, player 1 | Proximity mines shot away (Minefield, Fog Bank) |
|---|---|---|---|
| As shipped (deep mine only) | 34 of 80 | 36 of 80 | 93, 30 |
| Contact and proximity too | 26 of 80 | 35 of 80 | 28, 11 |

Run it with `--set munitions.mine.beams_pass=true --set munitions.naval_mine.beams_pass=true`.

- It matters for the proximity mine. As shipped, 93 of 160 on The Minefield are destroyed by
  lasers, most by a shot at something else that happened to cross the hex. With the rule on, 28.
- Contact mines barely change (167 against 159 destroyed): they are mostly shot on purpose after a
  scan shows them.
- Fog Bank does not move. The Minefield moves about 4 of 40 toward the side that laid the field.

My view: turn it on for both, so one sentence covers all three mines ("a mine is only destroyed
by a shot aimed at it"), and let maps retune The Minefield if 13 of 40 is too hard.

## Campaign (ch3 length)

`node campaign/tools/engine_check.mjs --engine .`, 20 games a chapter: ch1 6.2 rounds (5 to 7),
ch2 8.0, **ch3 8.7 (8 or 9)**, ch4a 6.5 (6 to 9), ch5 6.0. All won, no script failures. Identical
to before the AI work, because story ships follow their chapter profiles, not the personalities.
`check.mjs`: ALL CHECKS PASSED. `guide_acceptance.mjs`: 15 of 15.

## Not done, and known weak spots

- **Comet passes.** The Comet's best move is to fly within 2 hexes of a hidden ship and out again
  in one turn, lighting it up for the guns. The computer does not plan that path. It keeps Comets
  alive but uses them less: King's Guard `pass_reveal` fell from 128 to 8 in 40 games. It also does
  not throw a Comet away on purpose for the death flash.
- **Decoys only half work.** On The Gambit about half of all missiles are still lured (88 of 192
  before, 42 of 85 after). The rule only helps once the computer knows which ship is the decoy.
- **A sweeper leading the fleet.** I built "the Dowser leads and the rest stay in what it can see"
  and took it out: computer against computer, the fleets fight in mid-board before anyone enters
  the mined ground, so it changed no game and could not be checked.
- **Beacon Hill is decided by who moves first**: 32 of 40 for the first mover (98 of 120 over 60
  seeds), and only 4 different openings in 40 games (14 before). With scouts flown the old way it
  swings the other way (27 of 40 for the second mover). It is a mirror of one-hex boats where the
  first shot wins, so whichever side reaches range on its own half of the round takes it.
- **King's Guard** leans to the second mover (67 of 120 against 38).
