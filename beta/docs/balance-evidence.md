# Balance evidence, Stage 1 (screening)

16 Nov 2026. Stage 1 is a screen: about 10 games a cell across 597 cells (6,100 games). It can only show big effects. Every number here is from `beta/docs/variants-results.md`; the suite is named so the rows can be found. Nothing has been confirmed at 40 games yet.

**Labels.** *Clear*: the 95% interval excludes 50%. *Leaning*: 65/35 or beyond, interval still includes 50%. *Unclear*: neither. **Measured** means the number is in a table. **Inferred** means it is my reading of why.

## The five most useful findings

### 1. Where you start and who moves first decides more games than the pilot does

- **What it means for play:** two equal fleets do not get an equal fight; one seat is usually ahead before a decision is made.
- **Measured:** each seed is played twice with the seats swapped. The same *seat* won both games in 67 of 90 pairs in `pilots` (16 of its 18 cells have the same fleet on both sides, flown by different pilots) and in 39 of 45 pairs in `teams_same` (identical ships, different pilots). With different fleets it was 302 of 600 pairs (`fleets`). In the 40-game mirror the first seat won 28 of 40. In other mirrors the favoured seat changed with the fleet: `solo` first seat 2 of 20, `stock` 16 of 20 (`tempo`).
- **Inferred:** the first player alternates each round, so each player gets two turns back to back every other round. Whoever gets a double turn as the fleets come into range fires twice before the reply. Which seat that is depends on closing speed and the random start. I did not prove this mechanism.
- **Label:** clear that the seat matters (106 of 135 pairs in those two suites). Unclear what causes it.
- **Variant tried:** `first_fixed` (same player first every round, a new switch). First-seat wins in five mirrors went from 16, 2, 12, 12, 10 of 20 to 6, 10, 8, 10, 6 of 20. Leaning towards more even, not proven.

### 2. Personality barely matters when the ships are identical

- **What it means for play:** aggressive, balanced and defensive are different to watch but not different in strength. That is fair, and it also means a clever pilot cannot yet rescue a bad start.
- **Measured:** `teams_same`, nine cells at 3v3, 4v4 and 5v5: eight were exactly 5-5 and one was 3-7 (5v5 balanced against defensive, leaning). In `pilots`, aggressive beat defensive 7-3 (stock), 8-2 (guns3) and 8-2 (mixed5) but lost 4-6 on mixed4. Aggressive against balanced was 5-5, 5-5, 5-5 and 4-6.
- **Mixed teams** (`teams_mixed`, 20 to 40 ships per personality, so thin): at 5v5 defensive ships were alive at the end 75% of the time and first to die 5% of the time, against 53% and 28% for aggressive ones. At 3v3 the three were within 10 points of each other. Kills per ship ranged from 0.30 to 0.55 with no pattern.
- **Label:** leaning that aggressive beats defensive on mixed-type fleets; unclear on identical ships; leaning that defensive ships survive longer in a 5-ship mixed team.

### 3. Missiles are lost at the launch rail, not at the target

- **What it means for play:** making warheads stronger changes nothing. Letting ships launch earlier is what makes a missile fleet work.
- **Measured** (`missiles`, per battle, side A): with the old launch rules a 15-missile fleet launched 1.7 to 2.0 missiles against guns3, and 0.2 against mixed4. With salvo and launching from 8 hexes it launched 6.8 to 7.7 and 2.8 to 3.0. Launching from 8 hexes without salvo gave 7.0 and 2.9. Salvo without the longer range gave 2.7 and 0.2. Against a 3-hit warhead, warheads of 5, 6 and 9 hits gave the same win-loss in 12 of 18 comparisons and moved it by one or two games in the other 6, all on one match-up.
- **Where the launched ones go** (baseline, missiles3 against guns3): of 7.7 launched, 1.9 landed, 1.5 were shot down by lasers, 0.9 ran out of fuel or left the board, none were stopped by point defence, and 3.4 were either caught in another missile's blast or still flying when the game ended. The tool cannot yet tell those last two apart.
- **Point defence** set to 0 or 2 stops changed at most one game in any cell.
- **Label:** clear for launches (a three- to fifteen-fold change in every cell). Unclear for win rate: missiles3 against guns3 stayed 0-10 or 1-9 in this suite whatever the rule.
- **A caution from the same data:** this suite had missiles3 losing to guns3 1-9. The `fleets` suite, same fleets, same pilots, different seeds and the sides the other way round, had it 4-6. Ten games is that noisy.

### 4. The attack-run bonus is the only rule that clearly rewards moving

- **What it means for play:** it should stay. Without it the sitter and the stand-off pilot do better.
- **Measured** (`rules_a`): with the bonus off, balanced against a sitter (stock) went from 8-2 to 5-5, and aggressive against defensive (mixed5) from 8-2 to 3-7. A bonus of 2 gave 8-2 and 4-6. Four other match-ups moved by one game or less.
- **Label:** leaning (no single cell is clear; two of six moved by 3 to 5 games in the expected direction).

### 5. Forced movement beats the camper, but only at the top levels, and it does not end a stall

- **What it means for play:** making every fleet move 1 or 2 hexes a turn changes nothing; a camper already does that. Making it spend all its thrust does hurt the camper. Two sitters still never meet.
- **Measured** (`forced`): balanced against the camper with the stock fleet was 3-7 at baseline, 2-8 with 1 hex, 2 hexes or 50% of thrust, and 6-4 with 3 hexes or 100%. With guns3 it was 7-3 at baseline and 10-0 at 3 hexes (clear), 9-1 at 100% (clear). Sitter against sitter reached the round cap in 10 of 10 games at every level, on both fleets.
- **Side effect, measured:** in the two ordinary fights the forced levels moved results by up to 4 games in no steady direction (mixed5 aggressive against defensive 8-2 to 4-6 at 2 hexes; guns3 against snipers3 7-3 to 4-6).
- **Inferred:** a forced move costs a command point, so at high levels a fleet has fewer orders left to shoot with. That taxes everyone, not just the camper.
- **Label:** leaning for the stock fleet, clear for guns3 at the top levels. Unclear side effects.

## Five variants that did nothing

| Variant | What was measured | Label |
|---|---|---|
| Command-point bank cap 2 or unlimited (baseline 6) | Identical to baseline in all 12 cells | clear that it does nothing here: fights last 4 to 9 rounds and the computer rarely leaves points unspent |
| Thrust bank 1 turn or unlimited (baseline 2) | Identical to baseline in all 12 cells | same |
| Warhead strength 3, 5, 6 or 9 hits | Same win-loss as 3 hits in 12 of 18 comparisons, one or two games different in the rest | unclear to nil |
| Scan lights the scanner for 2 or 3 rounds (baseline 1) | Identical in 10 of 12 cells, one game different in 2 | nil with the computer flying: it seldom scans once it has a target |
| Lasers light up the shooter even on a miss | Identical to baseline in all 6 cells | nil |

Point defence at 0 or 2 stops, shields that soak 2 hits or none, and a scan that lights the scanner not at all or twice as far, also moved no cell by more than one or two games.

**Banking, checked first as asked.** The current caps are 6 banked command points (`turns.command_points.bank_cap`) and 2 turns of engine output for thrust (`movement.bank_turns`). No banking of command points gave 5-5 against the sitter (baseline 8-2) and stayed within one game of baseline in the other five cells. No banking of thrust gave 5-3-2 against the sitter and 5-4-1 on mixed5 (baseline 8-2 in both). Both are unclear.

## Other findings

| Finding | What it means for play | Measured | Label |
|---|---|---|---|
| Sitting loses to all three personalities with the stock fleet | The computer no longer loses to a player who waits | 9-1, 8-2, 7-3 (`sitting`) | one clear, two leaning |
| Sitting is closer on bigger fleets | A sitter with more guns is harder to dig out | 6-4 on guns3, mixed4 and mixed5; 6-3-1 on missiles3; 10-0 on solo | unclear, except solo (clear) |
| The camper still beats balanced with the stock fleet | Staying home and stepping one hex before each shot is the best lazy plan with the starter fleet | 3-7; but 7-3, 6-4, 7-3 against the camper on guns3, mixed4, mixed5 | leaning each way |
| Both-sit never ends | With two passive players the game is a 30-round draw | 20 of 20 games hit the cap; camper against sitter also 20 of 20 | clear |
| Sensors and stealth swing stealth fleets hard | Detection range is a strong lever | guns3 against snipers3: 7-3 at baseline, 10-0 with cores seeing 4 hexes, 10-0 with stealth switched off, 4-6 with cores seeing 1. stealth4 against guns4: 5-5, then 3-7, 2-8, 3-7 | two clear cells, the rest leaning |
| A sitting ship that is easier to see | Little effect | +3 signature: 6-4 against the sitter (baseline 8-2), 9-1 for guns3 against snipers3 | unclear |
| An exploding magazine punishes missile ships | Hit location starts to matter | guns3 against missiles3: 6-4 at baseline, 8-2 with 1 hit to neighbours, 9-1 with 3. Other cells within one game | one clear cell |
| One big ship beats most fleets | The 255-point dreadnought is under-priced or small ships are over-priced | solo 112-38 overall, 9-1 or 10-0 against eight fleets; lost to guns3 4-6, guns4 3-7, stealth4 2-8 (`fleets`) | clear in eight cells |
| The stock fleet is weak | The starter fleet (178 points) is the cheapest and nearly the worst | 43-107; only decoys5 (40-110) did worse | clear in four cells |
| Unarmed decoys do not pay | Every order to a decoy is an order not given to a gun | decoys5 40-110; bait pilot 5-5, 5-5 and 3-7 | leaning |
| Blind missile fire helps a missile swarm | A real "trick" for a chapter | blind against guns4 8-2; against its own fleet 6-4; in the counter search it took swarm5 against mixed5 from 3 to 6 wins and missile5 against solo from 0 to 4 | leaning |
| Counter fleets: three of five worked | Point defence everywhere beats missile fleets; one tough hull beats swarms | anti_missile3 7-3, 7-3, 8-2. heavy2 7-3, 9-1, 7-3. anti_stealth3 3-7, 6-4, 7-3. standoff3 6-4, 5-5, 6-4. wolfpack4 0-10, 5-5, 2-8 (the many-missiles counter to one big ship failed outright) | one clear each way, the rest leaning or unclear |
| Scanner pilot (scans first, shoots the most dangerous ship) | No gain against the baseline computer | 5-5, 5-5, 4-5-1, 5-5 | unclear |
| Scanner pilot with wider scans | Worse, if anything | 2-8, 4-6, 3-7, 6-4 | leaning worse |
| Hunter pilot (same target choice, no extra scans) | No gain | 5-5 and 5-5, the same under both scan variants | unclear |
| Sacrifice pilot (smallest armed escort sent ahead) | Costs a ship and buys nothing against this computer | 6-4, 4-6, 2-8, 0-10, 2-8 | one clear loss, the rest leaning or unclear |

**Why the human-style pilots did not win (inferred).** Fights are over in 3 to 7 rounds and the win is the flagship. A scan costs one of three command points, and choosing the "most dangerous" ship pulls fire off the flagship. The bait works on a human who reacts to it; the baseline computer just shoots whatever is in range and moves on. These are tests against the computer, so they say little about how the tricks play against a person.

## Not tested, and why

- **Forward-arc movement for small ships.** Ships have no facing in the engine: a ship is a position and a set of segment offsets, and "ships that rotate" is on the parked list in the world file. It would need a facing stored on each ship, a turn cost, moves limited to three directions, a facing arrow in the play screen, and the computer's path search made facing-aware.
- **Scan cost and scan range against a human.** Tested only with computer pilots, who scan rarely.
- **Anti-missile "strength levels" beyond stops per round**, missile speed, fuel and seeker range: not run in this stage (seeker range and point defence off were tried on 16 Nov with no effect).

## Candidates for Stage 2 (40 games each): your choice

Each line is one or two cells. I recommend the first five.

1. **Seat effect and the fixed first player.** `baseline` and `first_fixed` on the stock, solo and team3 mirrors. If fixed order evens the seats, it is the cheapest fairness fix found.
2. **Attack run as the control.** `baseline` and `attack_run_off` on stock balanced against sitter, and mixed5 aggressive against defensive.
3. **Forced movement against the camper.** `baseline`, `move_3` and `move_100pct` on stock and guns3 balanced against camper, plus guns3 against snipers3 to measure the side effect.
4. **Launch range against salvo.** `m_old_1x`, `m_salvo_only`, `m_range_only` and `baseline` on missile5 against mixed4 and missiles3 against guns3.
5. **Detection as a lever.** `baseline`, `sensors_long` and `stealth_off` on guns3 against snipers3 and stealth4 against guns4.
6. **Exploding magazines.** `baseline` and `magazine_3` on guns3 against missiles3 and mixed4 against missile5.
7. **Aggressive against defensive.** Baseline on stock, guns3, mixed4 and mixed5 (three leaned one way, one the other).
8. **The dreadnought.** solo against guns3, guns4, stealth4 and mixed5, to see whether it is a pricing problem.
9. **Thrust bank off.** `baseline` and `thrust_bank_none` on stock balanced against sitter (the only variant that produced draws).
10. **Blind fire as a chapter trick.** missile5 blind against guns4, and swarm5 against mixed5 head-on and blind.
