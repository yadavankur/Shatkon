# Variety study, Stage 1: raw results

16 Nov 2026, branch `balance-and-ai`. Every table below is the unedited output of `tools/variants.mjs --md`. Nothing was re-tuned after a result; where a run was repeated the reason is given here.

## How to read a row

- A cell is `variant | fleet:pilot v fleet:pilot`. Side A is the first one. Variants, pilots and suites are in `beta/rules/ai_variants.yaml`; fleets and their costs are in `beta/rules/sim_fleets.yaml`.
- **W-L-D** is wins, losses and draws for side A. **A share** counts a draw as half a win.
- **95% interval** is a Wilson interval on A's share.
- **Label:** *clear* means the interval excludes 50%. *Leaning* means the share is 65/35 or beyond but the interval still includes 50%. *Unclear* is everything else. At 10 games only 9-1 or better is clear. A leaning cell is a reason to look again, not a result.
- **No kill** is the number of games that reached the round cap of 30 with both flagships alive.
- **First seat won** is the number of games won by the player who moves first in round 1.
- **Seeds:** each match-up has its own first seed (the "first seed" column). Game *i* uses first seed + 7919 × floor(*i* / 2); odd games swap seats. The seed sets the random starting positions, the game's dice and, for `mix(...)`, which ship flies which personality. Every variant of one match-up plays the same seeds, so rows of the same match-up are paired.
- **Reproduce:** the command is printed above each table. Every game is also logged, one line each, in `beta/docs/logs/stage1-<suite>.csv` (cell, seed, which seat A sat in, winner, rounds, how it ended).

## Stage 1 totals

| Part | Cells | Games | Run time |
|---|---|---|---|
| 1A, rules the engine already had (9 suites) | 374 | 3,770 | 7 min |
| 1B, rules and pilots behind new switches (4 suites) | 124 | 1,340 | 4 min |
| Counter-tactic search (`tools/counter.mjs`, 11 match-ups, 9 tactics) | 99 | 990 | 2 min |
| **Stage 1** | **597** | **6,100** | **13 min** |

One cell of 10 games takes 1 to 2 seconds, so cost was never the limit.

**One repeated run.** Stage 1A was first run with the same five seeds in every cell. Before reading any win-loss figure I saw that the "first seat won" totals were lopsided, traced it to every cell replaying the same five starting layouts, changed the tool so each match-up gets its own seeds, and ran 1A again. The first run's tables were never read and are not reported. The seed change is the only difference.

**Not Stage 2.** Nothing here has been confirmed at 40 games, except the mirror cell, which was 40 games by design.

## Counter-tactic search

Command: `node tools/counter.mjs --fleets <row fleet> --against <other fleet>` (10 games a cell, seeds 11 + 7919k for k = 0..4, both seats, the other fleet flown by `balanced`). Each number is games won out of 10 by the row fleet flown that way. Tactics are in `beta/rules/sim_fleets.yaml`.

| match-up | head_on | aggressive | defensive | camp | spread_out | max_range | long_missiles | blind_fire | bait | best |
|---|---|---|---|---|---|---|---|---|---|---|
| stock v missiles3 | 4 | 3 | 3 | 2 | 1 | 3 | 4 | 3 | 2 | none |
| stock v snipers3 | 2 | 2 | 3 | 2 | 3 | 1 | 3 | 3 | 3 | none |
| stock v shields3 | 1 | 1 | 1 | 0 | 3 | 2 | 1 | 1 | 2 | none |
| cheap5 v mixed5 | 2 | 2 | 2 | 4 | 2 | 5 | 1 | 3 | 1 | max_range (5) |
| decoys5 v mixed5 | 1 | 1 | 2 | 1 | 2 | 0 | 1 | 2 | 1 | none |
| swarm5 v mixed5 | 3 | 2 | 4 | 3 | 5 | 5 | 4 | 6 | 3 | **blind_fire (6): turns it** |
| wolfpack4 v solo | 0 | 0 | 0 | 4 | 1 | 0 | 2 | 2 | 0 | camp (4) |
| pair_guns v solo | 1 | 1 | 1 | 1 | 0 | 1 | 0 | 1 | 0 | none |
| missile5 v solo | 0 | 0 | 0 | 1 | 2 | 1 | 3 | 4 | 1 | blind_fire (4) |
| pair_guns v guns3 | 2 | 2 | 1 | 0 | 2 | 1 | 0 | 0 | 2 | none |
| pair_guns v shields3 | 1 | 1 | 1 | 2 | 2 | 3 | 2 | 3 | 2 | none |

"Turns it" is the tool's own test: 3 or fewer wins head-on and 6 or more with the tactic. The match-ups searched on 16 Nov before this study (missile5 against decoys5, stock, guns3 and missiles3; missiles3 and swarm5 against snipers3; decoys5 against mixed3) are in `handoff/to-gamedev.md` and were not repeated.

## Tables

### Suite: mirror

seat bias check: the same fleet and pilot on both sides

Command: `node tools/variants.mjs --suite mirror --games 40 --seed 11`. Seeds: first seed + 7919k, k = 0..19, each from both seats (base seed 11). One row alone: `node tools/variants.mjs --games 40 --seed 11 --cell "<cell>"`.

| cell (A is the first side) | W-L-D for A | A share | 95% interval | label | rounds | no kill | first seat won |
|---|---|---|---|---|---|---|---|
| baseline | stock:balanced v stock:balanced | 48904 | 20-20-0 | 50% | 35% to 65% | unclear | 6.8 | 0 | 28 |

mirror: 1 cells, 40 games, 3 s. First seat won 28 of 40.

### Suite: pilots

pilot against pilot on four fleets of different size

Command: `node tools/variants.mjs --suite pilots --games 10 --seed 11`. Seeds: first seed + 7919k, k = 0..4, each from both seats (base seed 11). One row alone: `node tools/variants.mjs --games 10 --seed 11 --cell "<cell>"`.

| cell (A is the first side) | W-L-D for A | A share | 95% interval | label | rounds | no kill | first seat won |
|---|---|---|---|---|---|---|---|
| baseline | stock:aggressive v stock:balanced | 76750 | 5-5-0 | 50% | 24% to 76% | unclear | 6.1 | 0 | 6 |
| baseline | stock:aggressive v stock:defensive | 13804 | 7-3-0 | 70% | 40% to 89% | leaning | 6.0 | 0 | 4 |
| baseline | stock:balanced v stock:defensive | 99435 | 3-7-0 | 30% | 11% to 60% | leaning | 5.8 | 0 | 6 |
| baseline | guns3:aggressive v guns3:balanced | 77010 | 5-5-0 | 50% | 24% to 76% | unclear | 5.4 | 0 | 6 |
| baseline | guns3:aggressive v guns3:defensive | 26024 | 8-2-0 | 80% | 49% to 94% | leaning | 4.8 | 0 | 7 |
| baseline | guns3:balanced v guns3:defensive | 7174 | 6-4-0 | 60% | 31% to 83% | unclear | 5.1 | 0 | 5 |
| baseline | mixed4:aggressive v mixed4:balanced | 97992 | 5-5-0 | 50% | 24% to 76% | unclear | 4.6 | 0 | 8 |
| baseline | mixed4:aggressive v mixed4:defensive | 59018 | 4-6-0 | 40% | 17% to 69% | unclear | 4.8 | 0 | 7 |
| baseline | mixed4:balanced v mixed4:defensive | 129452 | 5-5-0 | 50% | 24% to 76% | unclear | 4.0 | 0 | 8 |
| baseline | mixed5:aggressive v mixed5:balanced | 64335 | 4-6-0 | 40% | 17% to 69% | unclear | 6.0 | 0 | 5 |
| baseline | mixed5:aggressive v mixed5:defensive | 75645 | 8-2-0 | 80% | 49% to 94% | leaning | 5.3 | 0 | 3 |
| baseline | mixed5:balanced v mixed5:defensive | 55846 | 4-6-0 | 40% | 17% to 69% | unclear | 6.8 | 0 | 5 |
| baseline | guns3:spread v guns3:balanced | 65349 | 6-4-0 | 60% | 31% to 83% | unclear | 4.7 | 0 | 7 |
| baseline | mixed4:long v mixed4:balanced | 55495 | 5-5-0 | 50% | 24% to 76% | unclear | 4.9 | 0 | 8 |
| baseline | decoys5:decoy v decoys5:balanced | 9735 | 5-5-0 | 50% | 24% to 76% | unclear | 7.6 | 0 | 6 |
| baseline | decoys5:decoy v guns3:balanced | 98486 | 5-5-0 | 50% | 24% to 76% | unclear | 5.5 | 0 | 6 |
| baseline | missile5:blind v missile5:balanced | 44172 | 6-4-0 | 60% | 31% to 83% | unclear | 5.5 | 0 | 9 |
| baseline | missile5:blind v guns4:balanced | 115503 | 8-2-0 | 80% | 49% to 94% | leaning | 5.7 | 0 | 5 |

pilots: 18 cells, 180 games, 30 s. First seat won 111 of 180.

### Suite: sitting

sitting and camping against the three personalities, and the both-sit stall (round cap 30)

Command: `node tools/variants.mjs --suite sitting --games 10 --seed 11`. Seeds: first seed + 7919k, k = 0..4, each from both seats (base seed 11). One row alone: `node tools/variants.mjs --games 10 --seed 11 --cell "<cell>"`.

| cell (A is the first side) | W-L-D for A | A share | 95% interval | label | rounds | no kill | first seat won |
|---|---|---|---|---|---|---|---|
| baseline | stock:aggressive v stock:sitter | 20304 | 9-1-0 | 90% | 60% to 98% | clear | 8.8 | 0 | 6 |
| baseline | stock:balanced v stock:sitter | 126774 | 8-2-0 | 80% | 49% to 94% | leaning | 8.7 | 0 | 5 |
| baseline | stock:defensive v stock:sitter | 68586 | 7-3-0 | 70% | 40% to 89% | leaning | 7.8 | 0 | 2 |
| baseline | stock:balanced v stock:camper | 102633 | 3-7-0 | 30% | 11% to 60% | leaning | 8.7 | 0 | 2 |
| baseline | guns3:balanced v guns3:sitter | 87098 | 6-4-0 | 60% | 31% to 83% | unclear | 7.0 | 0 | 5 |
| baseline | guns3:balanced v guns3:camper | 93546 | 7-3-0 | 70% | 40% to 89% | leaning | 6.5 | 0 | 6 |
| baseline | mixed4:balanced v mixed4:sitter | 22631 | 6-4-0 | 60% | 31% to 83% | unclear | 4.6 | 0 | 9 |
| baseline | mixed4:balanced v mixed4:camper | 9163 | 6-4-0 | 60% | 31% to 83% | unclear | 4.8 | 0 | 9 |
| baseline | mixed5:balanced v mixed5:sitter | 68638 | 6-4-0 | 60% | 31% to 83% | unclear | 7.7 | 0 | 3 |
| baseline | mixed5:balanced v mixed5:camper | 129348 | 7-3-0 | 70% | 40% to 89% | leaning | 6.9 | 0 | 4 |
| baseline | missiles3:balanced v missiles3:sitter | 17639 | 6-3-1 | 65% | 35% to 86% | leaning | 10.3 | 1 | 4 |
| baseline | solo:balanced v solo:sitter | 28455 | 10-0-0 | 100% | 72% to 100% | clear | 4.5 | 0 | 5 |
| baseline | stock:sitter v stock:sitter | 82912 | 0-0-10 | 50% | 24% to 76% | unclear | 31.0 | 10 | 0 |
| baseline | mixed4:sitter v mixed4:sitter | 43483 | 0-0-10 | 50% | 24% to 76% | unclear | 31.0 | 10 | 0 |
| baseline | stock:camper v stock:sitter | 19329 | 0-0-10 | 50% | 24% to 76% | unclear | 31.0 | 10 | 0 |
| baseline | mixed4:camper v mixed4:sitter | 90127 | 0-0-10 | 50% | 24% to 76% | unclear | 31.0 | 10 | 0 |

sitting: 16 cells, 160 games, 19 s. First seat won 60 of 160.

### Suite: fleets

fleet against fleet, both flown by balanced, sizes 1 to 5

Command: `node tools/variants.mjs --suite fleets --games 10 --seed 11`. Seeds: first seed + 7919k, k = 0..4, each from both seats (base seed 11). One row alone: `node tools/variants.mjs --games 10 --seed 11 --cell "<cell>"`.

| cell (A is the first side) | W-L-D for A | A share | 95% interval | label | rounds | no kill | first seat won |
|---|---|---|---|---|---|---|---|
| baseline | solo:balanced v stock:balanced | 51868 | 9-1-0 | 90% | 60% to 98% | clear | 4.4 | 0 | 4 |
| baseline | solo:balanced v pair_guns:balanced | 77738 | 10-0-0 | 100% | 72% to 100% | clear | 2.7 | 0 | 5 |
| baseline | solo:balanced v guns3:balanced | 71641 | 4-6-0 | 40% | 17% to 69% | unclear | 4.1 | 0 | 5 |
| baseline | solo:balanced v missiles3:balanced | 122978 | 8-2-0 | 80% | 49% to 94% | leaning | 4.1 | 0 | 7 |
| baseline | solo:balanced v snipers3:balanced | 45719 | 9-1-0 | 90% | 60% to 98% | clear | 3.7 | 0 | 6 |
| baseline | solo:balanced v shields3:balanced | 110693 | 6-4-0 | 60% | 31% to 83% | unclear | 3.2 | 0 | 9 |
| baseline | solo:balanced v mixed3:balanced | 91661 | 7-3-0 | 70% | 40% to 89% | leaning | 4.5 | 0 | 6 |
| baseline | solo:balanced v guns4:balanced | 12348 | 3-7-0 | 30% | 11% to 60% | leaning | 3.7 | 0 | 6 |
| baseline | solo:balanced v mixed4:balanced | 81859 | 9-1-0 | 90% | 60% to 98% | clear | 3.1 | 0 | 4 |
| baseline | solo:balanced v stealth4:balanced | 32836 | 2-8-0 | 20% | 6% to 51% | leaning | 4.0 | 0 | 5 |
| baseline | solo:balanced v decoys5:balanced | 9254 | 9-1-0 | 90% | 60% to 98% | clear | 4.5 | 0 | 6 |
| baseline | solo:balanced v swarm5:balanced | 53155 | 9-1-0 | 90% | 60% to 98% | clear | 3.0 | 0 | 4 |
| baseline | solo:balanced v cheap5:balanced | 60630 | 9-1-0 | 90% | 60% to 98% | clear | 3.3 | 0 | 6 |
| baseline | solo:balanced v missile5:balanced | 65349 | 10-0-0 | 100% | 72% to 100% | clear | 4.0 | 0 | 5 |
| baseline | solo:balanced v mixed5:balanced | 94469 | 8-2-0 | 80% | 49% to 94% | leaning | 3.2 | 0 | 5 |
| baseline | stock:balanced v pair_guns:balanced | 105662 | 5-5-0 | 50% | 24% to 76% | unclear | 5.2 | 0 | 8 |
| baseline | stock:balanced v guns3:balanced | 55651 | 2-8-0 | 20% | 6% to 51% | leaning | 6.1 | 0 | 7 |
| baseline | stock:balanced v missiles3:balanced | 64140 | 0-10-0 | 0% | 0% to 28% | clear | 5.6 | 0 | 5 |
| baseline | stock:balanced v snipers3:balanced | 123940 | 1-9-0 | 10% | 2% to 40% | clear | 6.4 | 0 | 6 |
| baseline | stock:balanced v shields3:balanced | 22280 | 1-9-0 | 10% | 2% to 40% | clear | 4.2 | 0 | 6 |
| baseline | stock:balanced v mixed3:balanced | 87878 | 2-8-0 | 20% | 6% to 51% | leaning | 5.8 | 0 | 5 |
| baseline | stock:balanced v guns4:balanced | 82665 | 3-7-0 | 30% | 11% to 60% | leaning | 5.9 | 0 | 8 |
| baseline | stock:balanced v mixed4:balanced | 125357 | 3-7-0 | 30% | 11% to 60% | leaning | 5.5 | 0 | 8 |
| baseline | stock:balanced v stealth4:balanced | 89373 | 3-7-0 | 30% | 11% to 60% | leaning | 6.4 | 0 | 8 |
| baseline | stock:balanced v decoys5:balanced | 121028 | 6-4-0 | 60% | 31% to 83% | unclear | 6.8 | 0 | 5 |
| baseline | stock:balanced v swarm5:balanced | 9033 | 5-5-0 | 50% | 24% to 76% | unclear | 5.1 | 0 | 10 |
| baseline | stock:balanced v cheap5:balanced | 102334 | 5-5-0 | 50% | 24% to 76% | unclear | 5.3 | 0 | 10 |
| baseline | stock:balanced v missile5:balanced | 82314 | 4-6-0 | 40% | 17% to 69% | unclear | 7.1 | 0 | 5 |
| baseline | stock:balanced v mixed5:balanced | 125565 | 2-8-0 | 20% | 6% to 51% | leaning | 5.0 | 0 | 7 |
| baseline | pair_guns:balanced v guns3:balanced | 112942 | 2-8-0 | 20% | 6% to 51% | leaning | 3.8 | 0 | 7 |
| baseline | pair_guns:balanced v missiles3:balanced | 5575 | 3-7-0 | 30% | 11% to 60% | leaning | 4.0 | 0 | 8 |
| baseline | pair_guns:balanced v snipers3:balanced | 14480 | 5-5-0 | 50% | 24% to 76% | unclear | 4.0 | 0 | 6 |
| baseline | pair_guns:balanced v shields3:balanced | 65557 | 2-8-0 | 20% | 6% to 51% | leaning | 3.8 | 0 | 7 |
| baseline | pair_guns:balanced v mixed3:balanced | 118545 | 3-7-0 | 30% | 11% to 60% | leaning | 4.4 | 0 | 8 |
| baseline | pair_guns:balanced v guns4:balanced | 81820 | 3-7-0 | 30% | 11% to 60% | leaning | 3.9 | 0 | 8 |
| baseline | pair_guns:balanced v mixed4:balanced | 112734 | 3-7-0 | 30% | 11% to 60% | leaning | 2.9 | 0 | 8 |
| baseline | pair_guns:balanced v stealth4:balanced | 12972 | 2-8-0 | 20% | 6% to 51% | leaning | 4.0 | 0 | 7 |
| baseline | pair_guns:balanced v decoys5:balanced | 110134 | 4-6-0 | 40% | 17% to 69% | unclear | 5.4 | 0 | 9 |
| baseline | pair_guns:balanced v swarm5:balanced | 37737 | 4-6-0 | 40% | 17% to 69% | unclear | 3.1 | 0 | 9 |
| baseline | pair_guns:balanced v cheap5:balanced | 103062 | 4-6-0 | 40% | 17% to 69% | unclear | 4.1 | 0 | 7 |
| baseline | pair_guns:balanced v missile5:balanced | 105636 | 7-3-0 | 70% | 40% to 89% | leaning | 3.7 | 0 | 8 |
| baseline | pair_guns:balanced v mixed5:balanced | 6797 | 5-5-0 | 50% | 24% to 76% | unclear | 3.9 | 0 | 8 |
| baseline | guns3:balanced v missiles3:balanced | 10996 | 6-4-0 | 60% | 31% to 83% | unclear | 5.1 | 0 | 5 |
| baseline | guns3:balanced v snipers3:balanced | 83588 | 7-3-0 | 70% | 40% to 89% | leaning | 5.5 | 0 | 4 |
| baseline | guns3:balanced v shields3:balanced | 90413 | 5-5-0 | 50% | 24% to 76% | unclear | 5.0 | 0 | 8 |
| baseline | guns3:balanced v mixed3:balanced | 112474 | 6-4-0 | 60% | 31% to 83% | unclear | 6.1 | 0 | 7 |
| baseline | guns3:balanced v guns4:balanced | 124707 | 6-4-0 | 60% | 31% to 83% | unclear | 5.0 | 0 | 5 |
| baseline | guns3:balanced v mixed4:balanced | 100111 | 7-3-0 | 70% | 40% to 89% | leaning | 4.1 | 0 | 8 |
| baseline | guns3:balanced v stealth4:balanced | 33616 | 6-4-0 | 60% | 31% to 83% | unclear | 5.2 | 0 | 7 |
| baseline | guns3:balanced v decoys5:balanced | 81846 | 8-2-0 | 80% | 49% to 94% | leaning | 5.9 | 0 | 3 |
| baseline | guns3:balanced v swarm5:balanced | 46746 | 8-2-0 | 80% | 49% to 94% | leaning | 4.3 | 0 | 7 |
| baseline | guns3:balanced v cheap5:balanced | 3053 | 6-4-0 | 60% | 31% to 83% | unclear | 4.5 | 0 | 9 |
| baseline | guns3:balanced v missile5:balanced | 28338 | 8-2-0 | 80% | 49% to 94% | leaning | 4.7 | 0 | 5 |
| baseline | guns3:balanced v mixed5:balanced | 58615 | 5-5-0 | 50% | 24% to 76% | unclear | 5.3 | 0 | 6 |
| baseline | missiles3:balanced v snipers3:balanced | 37620 | 7-3-0 | 70% | 40% to 89% | leaning | 6.6 | 0 | 4 |
| baseline | missiles3:balanced v shields3:balanced | 110849 | 4-6-0 | 40% | 17% to 69% | unclear | 4.5 | 0 | 7 |
| baseline | missiles3:balanced v mixed3:balanced | 111590 | 5-5-0 | 50% | 24% to 76% | unclear | 6.9 | 0 | 6 |
| baseline | missiles3:balanced v guns4:balanced | 38062 | 8-2-0 | 80% | 49% to 94% | leaning | 5.0 | 0 | 5 |
| baseline | missiles3:balanced v mixed4:balanced | 18354 | 9-1-0 | 90% | 60% to 98% | clear | 3.2 | 0 | 6 |
| baseline | missiles3:balanced v stealth4:balanced | 27844 | 3-7-0 | 30% | 11% to 60% | leaning | 6.0 | 0 | 8 |
| baseline | missiles3:balanced v decoys5:balanced | 55586 | 8-2-0 | 80% | 49% to 94% | leaning | 6.9 | 0 | 5 |
| baseline | missiles3:balanced v swarm5:balanced | 48423 | 8-2-0 | 80% | 49% to 94% | leaning | 3.7 | 0 | 7 |
| baseline | missiles3:balanced v cheap5:balanced | 80338 | 8-2-0 | 80% | 49% to 94% | leaning | 4.6 | 0 | 7 |
| baseline | missiles3:balanced v missile5:balanced | 122822 | 9-1-0 | 90% | 60% to 98% | clear | 3.8 | 0 | 6 |
| baseline | missiles3:balanced v mixed5:balanced | 44471 | 5-5-0 | 50% | 24% to 76% | unclear | 4.6 | 0 | 4 |
| baseline | snipers3:balanced v shields3:balanced | 55703 | 4-6-0 | 40% | 17% to 69% | unclear | 5.8 | 0 | 9 |
| baseline | snipers3:balanced v mixed3:balanced | 27285 | 8-2-0 | 80% | 49% to 94% | leaning | 7.4 | 0 | 5 |
| baseline | snipers3:balanced v guns4:balanced | 59213 | 4-6-0 | 40% | 17% to 69% | unclear | 5.9 | 0 | 5 |
| baseline | snipers3:balanced v mixed4:balanced | 117050 | 6-4-0 | 60% | 31% to 83% | unclear | 4.7 | 0 | 7 |
| baseline | snipers3:balanced v stealth4:balanced | 125006 | 5-5-0 | 50% | 24% to 76% | unclear | 6.3 | 0 | 4 |
| baseline | snipers3:balanced v decoys5:balanced | 106611 | 9-1-0 | 90% | 60% to 98% | clear | 7.4 | 0 | 6 |
| baseline | snipers3:balanced v swarm5:balanced | 86162 | 3-7-0 | 30% | 11% to 60% | leaning | 4.8 | 0 | 8 |
| baseline | snipers3:balanced v cheap5:balanced | 100267 | 8-2-0 | 80% | 49% to 94% | leaning | 5.7 | 0 | 5 |
| baseline | snipers3:balanced v missile5:balanced | 80871 | 6-4-0 | 60% | 31% to 83% | unclear | 4.9 | 0 | 9 |
| baseline | snipers3:balanced v mixed5:balanced | 43080 | 5-4-1 | 55% | 27% to 80% | unclear | 8.7 | 1 | 4 |
| baseline | shields3:balanced v mixed3:balanced | 88346 | 7-3-0 | 70% | 40% to 89% | leaning | 5.3 | 0 | 8 |
| baseline | shields3:balanced v guns4:balanced | 97264 | 7-3-0 | 70% | 40% to 89% | leaning | 4.7 | 0 | 8 |
| baseline | shields3:balanced v mixed4:balanced | 18380 | 4-6-0 | 40% | 17% to 69% | unclear | 4.3 | 0 | 9 |
| baseline | shields3:balanced v stealth4:balanced | 13440 | 7-3-0 | 70% | 40% to 89% | leaning | 4.8 | 0 | 6 |
| baseline | shields3:balanced v decoys5:balanced | 55066 | 8-2-0 | 80% | 49% to 94% | leaning | 5.7 | 0 | 7 |
| baseline | shields3:balanced v swarm5:balanced | 29638 | 6-4-0 | 60% | 31% to 83% | unclear | 3.6 | 0 | 9 |
| baseline | shields3:balanced v cheap5:balanced | 94651 | 7-3-0 | 70% | 40% to 89% | leaning | 4.1 | 0 | 8 |
| baseline | shields3:balanced v missile5:balanced | 127333 | 8-2-0 | 80% | 49% to 94% | leaning | 5.4 | 0 | 5 |
| baseline | shields3:balanced v mixed5:balanced | 25309 | 7-3-0 | 70% | 40% to 89% | leaning | 5.4 | 0 | 8 |
| baseline | mixed3:balanced v guns4:balanced | 24204 | 3-7-0 | 30% | 11% to 60% | leaning | 5.2 | 0 | 6 |
| baseline | mixed3:balanced v mixed4:balanced | 54962 | 7-3-0 | 70% | 40% to 89% | leaning | 4.3 | 0 | 8 |
| baseline | mixed3:balanced v stealth4:balanced | 55014 | 4-6-0 | 40% | 17% to 69% | unclear | 6.0 | 0 | 7 |
| baseline | mixed3:balanced v decoys5:balanced | 49424 | 9-1-0 | 90% | 60% to 98% | clear | 5.2 | 0 | 6 |
| baseline | mixed3:balanced v swarm5:balanced | 26635 | 5-5-0 | 50% | 24% to 76% | unclear | 5.9 | 0 | 10 |
| baseline | mixed3:balanced v cheap5:balanced | 71394 | 8-2-0 | 80% | 49% to 94% | leaning | 4.3 | 0 | 7 |
| baseline | mixed3:balanced v missile5:balanced | 40831 | 6-4-0 | 60% | 31% to 83% | unclear | 5.0 | 0 | 7 |
| baseline | mixed3:balanced v mixed5:balanced | 24607 | 4-6-0 | 40% | 17% to 69% | unclear | 6.6 | 0 | 5 |
| baseline | guns4:balanced v mixed4:balanced | 104765 | 7-3-0 | 70% | 40% to 89% | leaning | 4.0 | 0 | 8 |
| baseline | guns4:balanced v stealth4:balanced | 80169 | 8-2-0 | 80% | 49% to 94% | leaning | 5.3 | 0 | 5 |
| baseline | guns4:balanced v decoys5:balanced | 48930 | 9-1-0 | 90% | 60% to 98% | clear | 6.2 | 0 | 4 |
| baseline | guns4:balanced v swarm5:balanced | 79935 | 6-4-0 | 60% | 31% to 83% | unclear | 4.5 | 0 | 7 |
| baseline | guns4:balanced v cheap5:balanced | 98655 | 7-3-0 | 70% | 40% to 89% | leaning | 5.0 | 0 | 8 |
| baseline | guns4:balanced v missile5:balanced | 22553 | 7-3-0 | 70% | 40% to 89% | leaning | 4.4 | 0 | 6 |
| baseline | guns4:balanced v mixed5:balanced | 5471 | 4-6-0 | 40% | 17% to 69% | unclear | 6.1 | 0 | 7 |
| baseline | mixed4:balanced v stealth4:balanced | 39687 | 5-5-0 | 50% | 24% to 76% | unclear | 5.2 | 0 | 8 |
| baseline | mixed4:balanced v decoys5:balanced | 44445 | 6-4-0 | 60% | 31% to 83% | unclear | 5.4 | 0 | 7 |
| baseline | mixed4:balanced v swarm5:balanced | 77881 | 4-6-0 | 40% | 17% to 69% | unclear | 4.5 | 0 | 9 |
| baseline | mixed4:balanced v cheap5:balanced | 70614 | 4-6-0 | 40% | 17% to 69% | unclear | 4.1 | 0 | 7 |
| baseline | mixed4:balanced v missile5:balanced | 78687 | 6-4-0 | 60% | 31% to 83% | unclear | 4.6 | 0 | 9 |
| baseline | mixed4:balanced v mixed5:balanced | 6212 | 4-6-0 | 40% | 17% to 69% | unclear | 5.1 | 0 | 7 |
| baseline | stealth4:balanced v decoys5:balanced | 85811 | 8-2-0 | 80% | 49% to 94% | leaning | 6.4 | 0 | 7 |
| baseline | stealth4:balanced v swarm5:balanced | 22761 | 4-6-0 | 40% | 17% to 69% | unclear | 5.5 | 0 | 9 |
| baseline | stealth4:balanced v cheap5:balanced | 51374 | 6-4-0 | 60% | 31% to 83% | unclear | 5.1 | 0 | 9 |
| baseline | stealth4:balanced v missile5:balanced | 37620 | 6-4-0 | 60% | 31% to 83% | unclear | 6.5 | 0 | 9 |
| baseline | stealth4:balanced v mixed5:balanced | 14649 | 5-5-0 | 50% | 24% to 76% | unclear | 4.9 | 0 | 8 |
| baseline | decoys5:balanced v swarm5:balanced | 20824 | 3-7-0 | 30% | 11% to 60% | leaning | 7.8 | 0 | 6 |
| baseline | decoys5:balanced v cheap5:balanced | 6810 | 5-5-0 | 50% | 24% to 76% | unclear | 6.4 | 0 | 6 |
| baseline | decoys5:balanced v missile5:balanced | 102386 | 5-5-0 | 50% | 24% to 76% | unclear | 6.9 | 0 | 8 |
| baseline | decoys5:balanced v mixed5:balanced | 48735 | 1-9-0 | 10% | 2% to 40% | clear | 7.1 | 0 | 4 |
| baseline | swarm5:balanced v cheap5:balanced | 45498 | 4-6-0 | 40% | 17% to 69% | unclear | 4.6 | 0 | 9 |
| baseline | swarm5:balanced v missile5:balanced | 43743 | 6-4-0 | 60% | 31% to 83% | unclear | 4.8 | 0 | 9 |
| baseline | swarm5:balanced v mixed5:balanced | 64491 | 2-8-0 | 20% | 6% to 51% | leaning | 4.3 | 0 | 7 |
| baseline | cheap5:balanced v missile5:balanced | 120950 | 7-3-0 | 70% | 40% to 89% | leaning | 6.8 | 0 | 6 |
| baseline | cheap5:balanced v mixed5:balanced | 94781 | 1-9-0 | 10% | 2% to 40% | clear | 4.6 | 0 | 6 |
| baseline | missile5:balanced v mixed5:balanced | 126722 | 2-8-0 | 20% | 6% to 51% | leaning | 5.3 | 0 | 5 |

fleets: 120 cells, 1200 games, 127 s. First seat won 806 of 1200.

### Suite: counters

each counter fleet against the fleets it was built to beat

Command: `node tools/variants.mjs --suite counters --games 10 --seed 11`. Seeds: first seed + 7919k, k = 0..4, each from both seats (base seed 11). One row alone: `node tools/variants.mjs --games 10 --seed 11 --cell "<cell>"`.

| cell (A is the first side) | W-L-D for A | A share | 95% interval | label | rounds | no kill | first seat won |
|---|---|---|---|---|---|---|---|
| baseline | anti_missile3:balanced v missiles3:balanced | 79480 | 7-3-0 | 70% | 40% to 89% | leaning | 4.9 | 0 | 8 |
| baseline | anti_missile3:balanced v missile5:balanced | 10827 | 7-3-0 | 70% | 40% to 89% | leaning | 4.9 | 0 | 8 |
| baseline | anti_missile3:balanced v wolfpack4:balanced | 99916 | 8-2-0 | 80% | 49% to 94% | leaning | 3.7 | 0 | 7 |
| baseline | anti_stealth3:balanced v snipers3:balanced | 72941 | 3-7-0 | 30% | 11% to 60% | leaning | 3.9 | 0 | 8 |
| baseline | anti_stealth3:balanced v stealth4:balanced | 11984 | 6-4-0 | 60% | 31% to 83% | unclear | 4.6 | 0 | 7 |
| baseline | anti_stealth3:balanced v decoys5:balanced | 119728 | 7-3-0 | 70% | 40% to 89% | leaning | 4.5 | 0 | 8 |
| baseline | standoff3:long v guns3:balanced | 37880 | 6-4-0 | 60% | 31% to 83% | unclear | 5.8 | 0 | 7 |
| baseline | standoff3:long v guns4:balanced | 39622 | 5-5-0 | 50% | 24% to 76% | unclear | 5.4 | 0 | 6 |
| baseline | standoff3:long v shields3:balanced | 25582 | 6-4-0 | 60% | 31% to 83% | unclear | 4.5 | 0 | 9 |
| baseline | heavy2:balanced v swarm5:balanced | 31458 | 7-3-0 | 70% | 40% to 89% | leaning | 3.5 | 0 | 8 |
| baseline | heavy2:balanced v cheap5:balanced | 88944 | 9-1-0 | 90% | 60% to 98% | clear | 3.4 | 0 | 6 |
| baseline | heavy2:balanced v guns5:balanced | 40168 | 7-3-0 | 70% | 40% to 89% | leaning | 4.1 | 0 | 2 |
| baseline | wolfpack4:balanced v solo:balanced | 97641 | 0-10-0 | 0% | 0% to 28% | clear | 3.2 | 0 | 5 |
| baseline | wolfpack4:balanced v stock:balanced | 38465 | 5-5-0 | 50% | 24% to 76% | unclear | 6.2 | 0 | 8 |
| baseline | wolfpack4:balanced v heavy2:balanced | 97589 | 2-8-0 | 20% | 6% to 51% | leaning | 4.4 | 0 | 7 |

counters: 15 cells, 150 games, 13 s. First seat won 104 of 150.

### Suite: teams_mixed

identical ships, one personality each, slots and flagship shuffled per game (per-personality table follows each cell)

Command: `node tools/variants.mjs --suite teams_mixed --games 10 --seed 11`. Seeds: first seed + 7919k, k = 0..4, each from both seats (base seed 11). One row alone: `node tools/variants.mjs --games 10 --seed 11 --ships --cell "<cell>"`.

| cell (A is the first side) | W-L-D for A | A share | 95% interval | label | rounds | no kill | first seat won |
|---|---|---|---|---|---|---|---|
| baseline | team3:mix(aggressive,balanced,defensive) v team3:mix(aggressive,balanced,defensive) | 81937 | 5-5-0 | 50% | 24% to 76% | unclear | 5.7 | 0 | 6 |

| personality | ships | alive at end | escorts alive at end | average round of death | first of its fleet to die | kills per ship | games won when it flew the flagship (times) |
|---|---|---|---|---|---|---|---|
| aggressive | 20 | 70% | 100% | 7.0 | 10% | 0.35 | 50% (12) |
| balanced | 20 | 60% | 63% | 4.5 | 40% | 0.40 | 50% (4) |
| defensive | 20 | 60% | 63% | 6.0 | 25% | 0.35 | 50% (4) |

| cell (A is the first side) | W-L-D for A | A share | 95% interval | label | rounds | no kill | first seat won |
|---|---|---|---|---|---|---|---|
| baseline | team4:mix(aggressive,balanced,defensive,balanced) v team4:mix(aggressive,balanced,defensive,balanced) | 33473 | 6-4-0 | 60% | 31% to 83% | unclear | 7.1 | 0 | 5 |

| personality | ships | alive at end | escorts alive at end | average round of death | first of its fleet to die | kills per ship | games won when it flew the flagship (times) |
|---|---|---|---|---|---|---|---|
| balanced | 40 | 55% | 59% | 6.4 | 23% | 0.40 | 38% (8) |
| defensive | 20 | 55% | 50% | 5.7 | 25% | 0.55 | 75% (4) |
| aggressive | 20 | 50% | 50% | 5.3 | 30% | 0.50 | 50% (8) |

| cell (A is the first side) | W-L-D for A | A share | 95% interval | label | rounds | no kill | first seat won |
|---|---|---|---|---|---|---|---|
| baseline | team5:mix(aggressive,aggressive,balanced,defensive,defensive) v team5:mix(aggressive,aggressive,balanced,defensive,defensive) | 73422 | 4-6-0 | 40% | 17% to 69% | unclear | 9.6 | 0 | 5 |

| personality | ships | alive at end | escorts alive at end | average round of death | first of its fleet to die | kills per ship | games won when it flew the flagship (times) |
|---|---|---|---|---|---|---|---|
| defensive | 40 | 75% | 81% | 10.3 | 5% | 0.53 | 50% (8) |
| aggressive | 40 | 53% | 47% | 7.6 | 28% | 0.30 | 75% (8) |
| balanced | 20 | 45% | 56% | 8.3 | 25% | 0.35 | 0% (4) |

| cell (A is the first side) | W-L-D for A | A share | 95% interval | label | rounds | no kill | first seat won |
|---|---|---|---|---|---|---|---|

teams_mixed: 3 cells, 30 games, 6 s. First seat won 16 of 30.

### Suite: teams_same

identical ships, one personality per team

Command: `node tools/variants.mjs --suite teams_same --games 10 --seed 11`. Seeds: first seed + 7919k, k = 0..4, each from both seats (base seed 11). One row alone: `node tools/variants.mjs --games 10 --seed 11 --cell "<cell>"`.

| cell (A is the first side) | W-L-D for A | A share | 95% interval | label | rounds | no kill | first seat won |
|---|---|---|---|---|---|---|---|
| baseline | team3:aggressive v team3:balanced | 80546 | 5-5-0 | 50% | 24% to 76% | unclear | 6.4 | 0 | 0 |
| baseline | team3:aggressive v team3:defensive | 41247 | 5-5-0 | 50% | 24% to 76% | unclear | 6.5 | 0 | 8 |
| baseline | team3:balanced v team3:defensive | 14584 | 5-5-0 | 50% | 24% to 76% | unclear | 4.5 | 0 | 0 |
| baseline | team4:aggressive v team4:balanced | 57627 | 5-5-0 | 50% | 24% to 76% | unclear | 5.7 | 0 | 6 |
| baseline | team4:aggressive v team4:defensive | 56587 | 5-5-0 | 50% | 24% to 76% | unclear | 7.8 | 0 | 6 |
| baseline | team4:balanced v team4:defensive | 93962 | 5-5-0 | 50% | 24% to 76% | unclear | 8.0 | 0 | 6 |
| baseline | team5:aggressive v team5:balanced | 48137 | 5-5-0 | 50% | 24% to 76% | unclear | 7.0 | 0 | 4 |
| baseline | team5:aggressive v team5:defensive | 4132 | 5-5-0 | 50% | 24% to 76% | unclear | 7.6 | 0 | 6 |
| baseline | team5:balanced v team5:defensive | 38244 | 3-7-0 | 30% | 11% to 60% | leaning | 9.8 | 0 | 8 |

teams_same: 9 cells, 90 games, 14 s. First seat won 44 of 90.

### Suite: rules_a

rule variants the engine already supports, each on six reference match-ups (the baseline row is the comparison)

Command: `node tools/variants.mjs --suite rules_a --games 10 --seed 11`. Seeds: first seed + 7919k, k = 0..4, each from both seats (base seed 11). One row alone: `node tools/variants.mjs --games 10 --seed 11 --cell "<cell>"`.

| cell (A is the first side) | W-L-D for A | A share | 95% interval | label | rounds | no kill | first seat won |
|---|---|---|---|---|---|---|---|
| baseline | stock:balanced v stock:sitter | 126774 | 8-2-0 | 80% | 49% to 94% | leaning | 8.7 | 0 | 5 |
| attack_run_off | stock:balanced v stock:sitter | 126774 | 5-5-0 | 50% | 24% to 76% | unclear | 9.3 | 0 | 6 |
| attack_run_2 | stock:balanced v stock:sitter | 126774 | 8-2-0 | 80% | 49% to 94% | leaning | 8.1 | 0 | 5 |
| cp_bank_none | stock:balanced v stock:sitter | 126774 | 5-5-0 | 50% | 24% to 76% | unclear | 8.7 | 0 | 2 |
| cp_bank_low | stock:balanced v stock:sitter | 126774 | 8-2-0 | 80% | 49% to 94% | leaning | 8.7 | 0 | 5 |
| cp_bank_uncapped | stock:balanced v stock:sitter | 126774 | 8-2-0 | 80% | 49% to 94% | leaning | 8.7 | 0 | 5 |
| thrust_bank_none | stock:balanced v stock:sitter | 126774 | 5-3-2 | 60% | 31% to 83% | unclear | 13.8 | 2 | 1 |
| thrust_bank_low | stock:balanced v stock:sitter | 126774 | 8-2-0 | 80% | 49% to 94% | leaning | 8.7 | 0 | 5 |
| thrust_bank_uncapped | stock:balanced v stock:sitter | 126774 | 8-2-0 | 80% | 49% to 94% | leaning | 8.7 | 0 | 5 |
| still_lit_1 | stock:balanced v stock:sitter | 126774 | 8-2-0 | 80% | 49% to 94% | leaning | 8.2 | 0 | 5 |
| still_lit_3 | stock:balanced v stock:sitter | 126774 | 6-4-0 | 60% | 31% to 83% | unclear | 8.6 | 0 | 3 |
| scan_wide | stock:balanced v stock:sitter | 126774 | 7-3-0 | 70% | 40% to 89% | leaning | 9.0 | 0 | 6 |
| scan_free | stock:balanced v stock:sitter | 126774 | 7-3-0 | 70% | 40% to 89% | leaning | 8.7 | 0 | 4 |
| scan_cost_2 | stock:balanced v stock:sitter | 126774 | 7-3-0 | 70% | 40% to 89% | leaning | 9.1 | 0 | 4 |
| scan_quiet | stock:balanced v stock:sitter | 126774 | 9-1-0 | 90% | 60% to 98% | clear | 9.0 | 0 | 6 |
| scan_loud | stock:balanced v stock:sitter | 126774 | 6-4-0 | 60% | 31% to 83% | unclear | 8.6 | 0 | 3 |
| sensors_long | stock:balanced v stock:sitter | 126774 | 6-4-0 | 60% | 31% to 83% | unclear | 8.5 | 0 | 3 |
| sensors_short | stock:balanced v stock:sitter | 126774 | 8-2-0 | 80% | 49% to 94% | leaning | 9.1 | 0 | 5 |
| fuzzy_far | stock:balanced v stock:sitter | 126774 | 7-3-0 | 70% | 40% to 89% | leaning | 9.2 | 0 | 6 |
| fuzzy_none | stock:balanced v stock:sitter | 126774 | 9-1-0 | 90% | 60% to 98% | clear | 9.2 | 0 | 6 |
| stealth_strong | stock:balanced v stock:sitter | 126774 | 6-4-0 | 60% | 31% to 83% | unclear | 9.8 | 0 | 7 |
| stealth_off | stock:balanced v stock:sitter | 126774 | 6-4-0 | 60% | 31% to 83% | unclear | 8.1 | 0 | 3 |
| loud_guns | stock:balanced v stock:sitter | 126774 | 8-2-0 | 80% | 49% to 94% | leaning | 8.7 | 0 | 5 |
| shield_2 | stock:balanced v stock:sitter | 126774 | 8-2-0 | 80% | 49% to 94% | leaning | 8.7 | 0 | 5 |
| shield_off | stock:balanced v stock:sitter | 126774 | 8-2-0 | 80% | 49% to 94% | leaning | 8.9 | 0 | 5 |
| baseline | mixed4:balanced v mixed4:camper | 9163 | 6-4-0 | 60% | 31% to 83% | unclear | 4.8 | 0 | 9 |
| attack_run_off | mixed4:balanced v mixed4:camper | 9163 | 5-5-0 | 50% | 24% to 76% | unclear | 5.6 | 0 | 10 |
| attack_run_2 | mixed4:balanced v mixed4:camper | 9163 | 6-4-0 | 60% | 31% to 83% | unclear | 4.6 | 0 | 9 |
| cp_bank_none | mixed4:balanced v mixed4:camper | 9163 | 6-4-0 | 60% | 31% to 83% | unclear | 5.3 | 0 | 9 |
| cp_bank_low | mixed4:balanced v mixed4:camper | 9163 | 6-4-0 | 60% | 31% to 83% | unclear | 5.1 | 0 | 9 |
| cp_bank_uncapped | mixed4:balanced v mixed4:camper | 9163 | 6-4-0 | 60% | 31% to 83% | unclear | 4.8 | 0 | 9 |
| thrust_bank_none | mixed4:balanced v mixed4:camper | 9163 | 7-3-0 | 70% | 40% to 89% | leaning | 5.5 | 0 | 8 |
| thrust_bank_low | mixed4:balanced v mixed4:camper | 9163 | 6-4-0 | 60% | 31% to 83% | unclear | 4.8 | 0 | 9 |
| thrust_bank_uncapped | mixed4:balanced v mixed4:camper | 9163 | 6-4-0 | 60% | 31% to 83% | unclear | 4.8 | 0 | 9 |
| still_lit_1 | mixed4:balanced v mixed4:camper | 9163 | 6-4-0 | 60% | 31% to 83% | unclear | 4.2 | 0 | 9 |
| still_lit_3 | mixed4:balanced v mixed4:camper | 9163 | 6-4-0 | 60% | 31% to 83% | unclear | 3.4 | 0 | 9 |
| scan_wide | mixed4:balanced v mixed4:camper | 9163 | 6-4-0 | 60% | 31% to 83% | unclear | 4.6 | 0 | 9 |
| scan_free | mixed4:balanced v mixed4:camper | 9163 | 6-4-0 | 60% | 31% to 83% | unclear | 4.6 | 0 | 9 |
| scan_cost_2 | mixed4:balanced v mixed4:camper | 9163 | 4-5-1 | 45% | 20% to 73% | unclear | 7.5 | 1 | 9 |
| scan_quiet | mixed4:balanced v mixed4:camper | 9163 | 6-4-0 | 60% | 31% to 83% | unclear | 5.3 | 0 | 9 |
| scan_loud | mixed4:balanced v mixed4:camper | 9163 | 6-4-0 | 60% | 31% to 83% | unclear | 4.8 | 0 | 9 |
| sensors_long | mixed4:balanced v mixed4:camper | 9163 | 7-3-0 | 70% | 40% to 89% | leaning | 4.1 | 0 | 8 |
| sensors_short | mixed4:balanced v mixed4:camper | 9163 | 4-5-1 | 45% | 20% to 73% | unclear | 8.7 | 1 | 9 |
| fuzzy_far | mixed4:balanced v mixed4:camper | 9163 | 5-5-0 | 50% | 24% to 76% | unclear | 4.9 | 0 | 10 |
| fuzzy_none | mixed4:balanced v mixed4:camper | 9163 | 6-4-0 | 60% | 31% to 83% | unclear | 4.8 | 0 | 9 |
| stealth_strong | mixed4:balanced v mixed4:camper | 9163 | 6-4-0 | 60% | 31% to 83% | unclear | 4.9 | 0 | 9 |
| stealth_off | mixed4:balanced v mixed4:camper | 9163 | 7-3-0 | 70% | 40% to 89% | leaning | 5.0 | 0 | 8 |
| loud_guns | mixed4:balanced v mixed4:camper | 9163 | 6-4-0 | 60% | 31% to 83% | unclear | 4.8 | 0 | 9 |
| shield_2 | mixed4:balanced v mixed4:camper | 9163 | 6-4-0 | 60% | 31% to 83% | unclear | 4.8 | 0 | 9 |
| shield_off | mixed4:balanced v mixed4:camper | 9163 | 7-3-0 | 70% | 40% to 89% | leaning | 4.9 | 0 | 8 |
| baseline | guns3:balanced v snipers3:balanced | 83588 | 7-3-0 | 70% | 40% to 89% | leaning | 5.5 | 0 | 4 |
| attack_run_off | guns3:balanced v snipers3:balanced | 83588 | 6-4-0 | 60% | 31% to 83% | unclear | 5.6 | 0 | 5 |
| attack_run_2 | guns3:balanced v snipers3:balanced | 83588 | 4-6-0 | 40% | 17% to 69% | unclear | 4.8 | 0 | 7 |
| cp_bank_none | guns3:balanced v snipers3:balanced | 83588 | 8-2-0 | 80% | 49% to 94% | leaning | 6.8 | 0 | 7 |
| cp_bank_low | guns3:balanced v snipers3:balanced | 83588 | 7-3-0 | 70% | 40% to 89% | leaning | 5.5 | 0 | 4 |
| cp_bank_uncapped | guns3:balanced v snipers3:balanced | 83588 | 7-3-0 | 70% | 40% to 89% | leaning | 5.5 | 0 | 4 |
| thrust_bank_none | guns3:balanced v snipers3:balanced | 83588 | 6-4-0 | 60% | 31% to 83% | unclear | 7.7 | 0 | 3 |
| thrust_bank_low | guns3:balanced v snipers3:balanced | 83588 | 7-3-0 | 70% | 40% to 89% | leaning | 5.5 | 0 | 4 |
| thrust_bank_uncapped | guns3:balanced v snipers3:balanced | 83588 | 7-3-0 | 70% | 40% to 89% | leaning | 5.5 | 0 | 4 |
| still_lit_1 | guns3:balanced v snipers3:balanced | 83588 | 8-2-0 | 80% | 49% to 94% | leaning | 5.3 | 0 | 3 |
| still_lit_3 | guns3:balanced v snipers3:balanced | 83588 | 9-1-0 | 90% | 60% to 98% | clear | 4.1 | 0 | 6 |
| scan_wide | guns3:balanced v snipers3:balanced | 83588 | 7-3-0 | 70% | 40% to 89% | leaning | 5.6 | 0 | 8 |
| scan_free | guns3:balanced v snipers3:balanced | 83588 | 6-4-0 | 60% | 31% to 83% | unclear | 5.5 | 0 | 5 |
| scan_cost_2 | guns3:balanced v snipers3:balanced | 83588 | 6-4-0 | 60% | 31% to 83% | unclear | 5.9 | 0 | 5 |
| scan_quiet | guns3:balanced v snipers3:balanced | 83588 | 7-3-0 | 70% | 40% to 89% | leaning | 5.5 | 0 | 4 |
| scan_loud | guns3:balanced v snipers3:balanced | 83588 | 7-3-0 | 70% | 40% to 89% | leaning | 5.5 | 0 | 4 |
| sensors_long | guns3:balanced v snipers3:balanced | 83588 | 10-0-0 | 100% | 72% to 100% | clear | 4.1 | 0 | 5 |
| sensors_short | guns3:balanced v snipers3:balanced | 83588 | 4-6-0 | 40% | 17% to 69% | unclear | 6.4 | 0 | 3 |
| fuzzy_far | guns3:balanced v snipers3:balanced | 83588 | 6-4-0 | 60% | 31% to 83% | unclear | 5.4 | 0 | 5 |
| fuzzy_none | guns3:balanced v snipers3:balanced | 83588 | 7-3-0 | 70% | 40% to 89% | leaning | 5.4 | 0 | 4 |
| stealth_strong | guns3:balanced v snipers3:balanced | 83588 | 8-2-0 | 80% | 49% to 94% | leaning | 6.0 | 0 | 3 |
| stealth_off | guns3:balanced v snipers3:balanced | 83588 | 10-0-0 | 100% | 72% to 100% | clear | 3.4 | 0 | 5 |
| loud_guns | guns3:balanced v snipers3:balanced | 83588 | 7-3-0 | 70% | 40% to 89% | leaning | 5.5 | 0 | 4 |
| shield_2 | guns3:balanced v snipers3:balanced | 83588 | 8-2-0 | 80% | 49% to 94% | leaning | 5.5 | 0 | 3 |
| shield_off | guns3:balanced v snipers3:balanced | 83588 | 7-3-0 | 70% | 40% to 89% | leaning | 5.3 | 0 | 4 |
| baseline | stealth4:balanced v guns4:balanced | 76204 | 5-5-0 | 50% | 24% to 76% | unclear | 5.2 | 0 | 8 |
| attack_run_off | stealth4:balanced v guns4:balanced | 76204 | 4-6-0 | 40% | 17% to 69% | unclear | 5.7 | 0 | 9 |
| attack_run_2 | stealth4:balanced v guns4:balanced | 76204 | 5-5-0 | 50% | 24% to 76% | unclear | 4.9 | 0 | 8 |
| cp_bank_none | stealth4:balanced v guns4:balanced | 76204 | 5-5-0 | 50% | 24% to 76% | unclear | 5.2 | 0 | 8 |
| cp_bank_low | stealth4:balanced v guns4:balanced | 76204 | 5-5-0 | 50% | 24% to 76% | unclear | 5.2 | 0 | 8 |
| cp_bank_uncapped | stealth4:balanced v guns4:balanced | 76204 | 5-5-0 | 50% | 24% to 76% | unclear | 5.2 | 0 | 8 |
| thrust_bank_none | stealth4:balanced v guns4:balanced | 76204 | 4-6-0 | 40% | 17% to 69% | unclear | 6.2 | 0 | 9 |
| thrust_bank_low | stealth4:balanced v guns4:balanced | 76204 | 5-5-0 | 50% | 24% to 76% | unclear | 5.2 | 0 | 8 |
| thrust_bank_uncapped | stealth4:balanced v guns4:balanced | 76204 | 5-5-0 | 50% | 24% to 76% | unclear | 5.2 | 0 | 8 |
| still_lit_1 | stealth4:balanced v guns4:balanced | 76204 | 4-6-0 | 40% | 17% to 69% | unclear | 4.8 | 0 | 7 |
| still_lit_3 | stealth4:balanced v guns4:balanced | 76204 | 3-7-0 | 30% | 11% to 60% | leaning | 5.0 | 0 | 8 |
| scan_wide | stealth4:balanced v guns4:balanced | 76204 | 5-5-0 | 50% | 24% to 76% | unclear | 5.5 | 0 | 8 |
| scan_free | stealth4:balanced v guns4:balanced | 76204 | 6-4-0 | 60% | 31% to 83% | unclear | 5.1 | 0 | 9 |
| scan_cost_2 | stealth4:balanced v guns4:balanced | 76204 | 4-6-0 | 40% | 17% to 69% | unclear | 5.7 | 0 | 7 |
| scan_quiet | stealth4:balanced v guns4:balanced | 76204 | 5-5-0 | 50% | 24% to 76% | unclear | 5.2 | 0 | 8 |
| scan_loud | stealth4:balanced v guns4:balanced | 76204 | 5-5-0 | 50% | 24% to 76% | unclear | 5.2 | 0 | 8 |
| sensors_long | stealth4:balanced v guns4:balanced | 76204 | 3-7-0 | 30% | 11% to 60% | leaning | 4.8 | 0 | 8 |
| sensors_short | stealth4:balanced v guns4:balanced | 76204 | 3-7-0 | 30% | 11% to 60% | leaning | 6.3 | 0 | 8 |
| fuzzy_far | stealth4:balanced v guns4:balanced | 76204 | 5-5-0 | 50% | 24% to 76% | unclear | 4.5 | 0 | 10 |
| fuzzy_none | stealth4:balanced v guns4:balanced | 76204 | 3-7-0 | 30% | 11% to 60% | leaning | 5.5 | 0 | 6 |
| stealth_strong | stealth4:balanced v guns4:balanced | 76204 | 6-4-0 | 60% | 31% to 83% | unclear | 5.8 | 0 | 9 |
| stealth_off | stealth4:balanced v guns4:balanced | 76204 | 2-8-0 | 20% | 6% to 51% | leaning | 4.7 | 0 | 7 |
| loud_guns | stealth4:balanced v guns4:balanced | 76204 | 5-5-0 | 50% | 24% to 76% | unclear | 5.2 | 0 | 8 |
| shield_2 | stealth4:balanced v guns4:balanced | 76204 | 4-6-0 | 40% | 17% to 69% | unclear | 5.3 | 0 | 9 |
| shield_off | stealth4:balanced v guns4:balanced | 76204 | 6-4-0 | 60% | 31% to 83% | unclear | 5.4 | 0 | 9 |
| baseline | mixed5:aggressive v mixed5:defensive | 75645 | 8-2-0 | 80% | 49% to 94% | leaning | 5.3 | 0 | 3 |
| attack_run_off | mixed5:aggressive v mixed5:defensive | 75645 | 3-7-0 | 30% | 11% to 60% | leaning | 7.3 | 0 | 4 |
| attack_run_2 | mixed5:aggressive v mixed5:defensive | 75645 | 4-6-0 | 40% | 17% to 69% | unclear | 5.5 | 0 | 5 |
| cp_bank_none | mixed5:aggressive v mixed5:defensive | 75645 | 8-2-0 | 80% | 49% to 94% | leaning | 5.3 | 0 | 3 |
| cp_bank_low | mixed5:aggressive v mixed5:defensive | 75645 | 8-2-0 | 80% | 49% to 94% | leaning | 5.3 | 0 | 3 |
| cp_bank_uncapped | mixed5:aggressive v mixed5:defensive | 75645 | 8-2-0 | 80% | 49% to 94% | leaning | 5.3 | 0 | 3 |
| thrust_bank_none | mixed5:aggressive v mixed5:defensive | 75645 | 5-4-1 | 55% | 27% to 80% | unclear | 9.6 | 1 | 4 |
| thrust_bank_low | mixed5:aggressive v mixed5:defensive | 75645 | 8-2-0 | 80% | 49% to 94% | leaning | 5.3 | 0 | 3 |
| thrust_bank_uncapped | mixed5:aggressive v mixed5:defensive | 75645 | 8-2-0 | 80% | 49% to 94% | leaning | 5.3 | 0 | 3 |
| still_lit_1 | mixed5:aggressive v mixed5:defensive | 75645 | 7-3-0 | 70% | 40% to 89% | leaning | 5.7 | 0 | 2 |
| still_lit_3 | mixed5:aggressive v mixed5:defensive | 75645 | 4-6-0 | 40% | 17% to 69% | unclear | 6.1 | 0 | 5 |
| scan_wide | mixed5:aggressive v mixed5:defensive | 75645 | 5-5-0 | 50% | 24% to 76% | unclear | 6.6 | 0 | 6 |
| scan_free | mixed5:aggressive v mixed5:defensive | 75645 | 8-2-0 | 80% | 49% to 94% | leaning | 5.4 | 0 | 3 |
| scan_cost_2 | mixed5:aggressive v mixed5:defensive | 75645 | 8-2-0 | 80% | 49% to 94% | leaning | 5.1 | 0 | 3 |
| scan_quiet | mixed5:aggressive v mixed5:defensive | 75645 | 8-2-0 | 80% | 49% to 94% | leaning | 5.1 | 0 | 3 |
| scan_loud | mixed5:aggressive v mixed5:defensive | 75645 | 8-2-0 | 80% | 49% to 94% | leaning | 5.3 | 0 | 3 |
| sensors_long | mixed5:aggressive v mixed5:defensive | 75645 | 5-5-0 | 50% | 24% to 76% | unclear | 5.6 | 0 | 6 |
| sensors_short | mixed5:aggressive v mixed5:defensive | 75645 | 8-2-0 | 80% | 49% to 94% | leaning | 8.2 | 0 | 3 |
| fuzzy_far | mixed5:aggressive v mixed5:defensive | 75645 | 7-3-0 | 70% | 40% to 89% | leaning | 4.9 | 0 | 4 |
| fuzzy_none | mixed5:aggressive v mixed5:defensive | 75645 | 7-3-0 | 70% | 40% to 89% | leaning | 5.6 | 0 | 4 |
| stealth_strong | mixed5:aggressive v mixed5:defensive | 75645 | 5-5-0 | 50% | 24% to 76% | unclear | 7.8 | 0 | 4 |
| stealth_off | mixed5:aggressive v mixed5:defensive | 75645 | 6-4-0 | 60% | 31% to 83% | unclear | 4.9 | 0 | 3 |
| loud_guns | mixed5:aggressive v mixed5:defensive | 75645 | 8-2-0 | 80% | 49% to 94% | leaning | 5.3 | 0 | 3 |
| shield_2 | mixed5:aggressive v mixed5:defensive | 75645 | 8-2-0 | 80% | 49% to 94% | leaning | 5.3 | 0 | 3 |
| shield_off | mixed5:aggressive v mixed5:defensive | 75645 | 8-2-0 | 80% | 49% to 94% | leaning | 5.5 | 0 | 3 |
| baseline | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 4.1 | 0 | 8 |
| attack_run_off | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 4.1 | 0 | 8 |
| attack_run_2 | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 3.8 | 0 | 8 |
| cp_bank_none | shields3:balanced v missiles3:balanced | 36151 | 6-4-0 | 60% | 31% to 83% | unclear | 4.5 | 0 | 9 |
| cp_bank_low | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 4.1 | 0 | 8 |
| cp_bank_uncapped | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 4.1 | 0 | 8 |
| thrust_bank_none | shields3:balanced v missiles3:balanced | 36151 | 6-4-0 | 60% | 31% to 83% | unclear | 4.5 | 0 | 9 |
| thrust_bank_low | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 4.1 | 0 | 8 |
| thrust_bank_uncapped | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 4.1 | 0 | 8 |
| still_lit_1 | shields3:balanced v missiles3:balanced | 36151 | 4-6-0 | 40% | 17% to 69% | unclear | 3.8 | 0 | 9 |
| still_lit_3 | shields3:balanced v missiles3:balanced | 36151 | 4-6-0 | 40% | 17% to 69% | unclear | 3.8 | 0 | 9 |
| scan_wide | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 4.1 | 0 | 8 |
| scan_free | shields3:balanced v missiles3:balanced | 36151 | 6-4-0 | 60% | 31% to 83% | unclear | 4.0 | 0 | 9 |
| scan_cost_2 | shields3:balanced v missiles3:balanced | 36151 | 6-4-0 | 60% | 31% to 83% | unclear | 4.0 | 0 | 9 |
| scan_quiet | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 4.1 | 0 | 8 |
| scan_loud | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 4.1 | 0 | 8 |
| sensors_long | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 3.7 | 0 | 10 |
| sensors_short | shields3:balanced v missiles3:balanced | 36151 | 6-4-0 | 60% | 31% to 83% | unclear | 4.2 | 0 | 9 |
| fuzzy_far | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 3.8 | 0 | 8 |
| fuzzy_none | shields3:balanced v missiles3:balanced | 36151 | 4-6-0 | 40% | 17% to 69% | unclear | 3.7 | 0 | 9 |
| stealth_strong | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 4.1 | 0 | 8 |
| stealth_off | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 4.1 | 0 | 8 |
| loud_guns | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 4.1 | 0 | 8 |
| shield_2 | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 4.1 | 0 | 8 |
| shield_off | shields3:balanced v missiles3:balanced | 36151 | 4-6-0 | 40% | 17% to 69% | unclear | 4.0 | 0 | 7 |

rules_a: 150 cells, 1500 games, 166 s. First seat won 952 of 1500.

### Suite: missiles

warhead strength, with the old launch rules and with salvo + 8 hexes; missile counts per battle follow each cell

Command: `node tools/variants.mjs --suite missiles --games 10 --seed 11`. Seeds: first seed + 7919k, k = 0..4, each from both seats (base seed 11). One row alone: `node tools/variants.mjs --games 10 --seed 11 --missiles --cell "<cell>"`.

| cell (A is the first side) | W-L-D for A | A share | 95% interval | label | rounds | no kill | first seat won |
|---|---|---|---|---|---|---|---|
| m_old_1x | missiles3:balanced v guns3:balanced | 2975 | 0-10-0 | 0% | 0% to 28% | clear | 4.9 | 0 | 5 |
| ↳ missiles per battle: A launched 1.9, stopped by point defence 0.0, shot down 0.4, ran out or flew off 0.1, landed 0.9, caught in another blast or still flying at the end 0.5, ships sunk 0.4 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| m_old_1.5x | missiles3:balanced v guns3:balanced | 2975 | 0-10-0 | 0% | 0% to 28% | clear | 5.0 | 0 | 5 |
| ↳ missiles per battle: A launched 2.0, stopped by point defence 0.0, shot down 0.5, ran out or flew off 0.1, landed 0.7, caught in another blast or still flying at the end 0.7, ships sunk 0.2 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| m_old_2x | missiles3:balanced v guns3:balanced | 2975 | 0-10-0 | 0% | 0% to 28% | clear | 5.0 | 0 | 5 |
| ↳ missiles per battle: A launched 2.0, stopped by point defence 0.0, shot down 0.5, ran out or flew off 0.1, landed 0.7, caught in another blast or still flying at the end 0.7, ships sunk 0.2 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| m_old_3x | missiles3:balanced v guns3:balanced | 2975 | 0-10-0 | 0% | 0% to 28% | clear | 5.0 | 0 | 5 |
| ↳ missiles per battle: A launched 1.8, stopped by point defence 0.0, shot down 0.5, ran out or flew off 0.1, landed 0.7, caught in another blast or still flying at the end 0.5, ships sunk 0.3 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| m_old_wreck | missiles3:balanced v guns3:balanced | 2975 | 0-10-0 | 0% | 0% to 28% | clear | 4.8 | 0 | 5 |
| ↳ missiles per battle: A launched 1.7, stopped by point defence 0.0, shot down 0.3, ran out or flew off 0.1, landed 0.8, caught in another blast or still flying at the end 0.5, ships sunk 0.4 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| m_new_1x | missiles3:balanced v guns3:balanced | 2975 | 1-9-0 | 10% | 2% to 40% | clear | 4.9 | 0 | 6 |
| ↳ missiles per battle: A launched 6.8, stopped by point defence 0.0, shot down 1.1, ran out or flew off 0.9, landed 1.5, caught in another blast or still flying at the end 3.3, ships sunk 0.4 | B launched 0.0, stopped by point defence 0.0, shot down 0.4, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.4, ships sunk 0.0 | | | | | | | | |
| m_new_1.5x | missiles3:balanced v guns3:balanced | 2975 | 1-9-0 | 10% | 2% to 40% | clear | 5.3 | 0 | 4 |
| ↳ missiles per battle: A launched 7.5, stopped by point defence 0.0, shot down 2.4, ran out or flew off 0.8, landed 1.7, caught in another blast or still flying at the end 2.6, ships sunk 0.8 | B launched 0.0, stopped by point defence 0.0, shot down 0.5, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.5, ships sunk 0.0 | | | | | | | | |
| m_new_2x | missiles3:balanced v guns3:balanced | 2975 | 1-9-0 | 10% | 2% to 40% | clear | 5.2 | 0 | 4 |
| ↳ missiles per battle: A launched 7.5, stopped by point defence 0.0, shot down 2.4, ran out or flew off 0.8, landed 1.7, caught in another blast or still flying at the end 2.6, ships sunk 0.8 | B launched 0.0, stopped by point defence 0.0, shot down 0.5, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.5, ships sunk 0.0 | | | | | | | | |
| m_new_3x | missiles3:balanced v guns3:balanced | 2975 | 1-9-0 | 10% | 2% to 40% | clear | 5.2 | 0 | 4 |
| ↳ missiles per battle: A launched 7.5, stopped by point defence 0.0, shot down 2.4, ran out or flew off 0.8, landed 1.7, caught in another blast or still flying at the end 2.6, ships sunk 0.8 | B launched 0.0, stopped by point defence 0.0, shot down 0.5, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.5, ships sunk 0.0 | | | | | | | | |
| baseline | missiles3:balanced v guns3:balanced | 2975 | 1-9-0 | 10% | 2% to 40% | clear | 5.2 | 0 | 6 |
| ↳ missiles per battle: A launched 7.7, stopped by point defence 0.0, shot down 1.5, ran out or flew off 0.9, landed 1.9, caught in another blast or still flying at the end 3.4, ships sunk 0.6 | B launched 0.0, stopped by point defence 0.0, shot down 0.3, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.3, ships sunk 0.0 | | | | | | | | |
| m_salvo_only | missiles3:balanced v guns3:balanced | 2975 | 0-10-0 | 0% | 0% to 28% | clear | 5.1 | 0 | 5 |
| ↳ missiles per battle: A launched 2.7, stopped by point defence 0.0, shot down 0.6, ran out or flew off 0.1, landed 0.9, caught in another blast or still flying at the end 1.1, ships sunk 0.3 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| m_range_only | missiles3:balanced v guns3:balanced | 2975 | 0-10-0 | 0% | 0% to 28% | clear | 5.5 | 0 | 5 |
| ↳ missiles per battle: A launched 7.0, stopped by point defence 0.0, shot down 2.6, ran out or flew off 0.8, landed 1.7, caught in another blast or still flying at the end 1.9, ships sunk 0.3 | B launched 0.0, stopped by point defence 0.0, shot down 0.2, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.2, ships sunk 0.0 | | | | | | | | |
| pd_none | missiles3:balanced v guns3:balanced | 2975 | 1-9-0 | 10% | 2% to 40% | clear | 5.2 | 0 | 6 |
| ↳ missiles per battle: A launched 7.7, stopped by point defence 0.0, shot down 1.5, ran out or flew off 0.9, landed 1.9, caught in another blast or still flying at the end 3.4, ships sunk 0.6 | B launched 0.0, stopped by point defence 0.0, shot down 0.3, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.3, ships sunk 0.0 | | | | | | | | |
| pd_2 | missiles3:balanced v guns3:balanced | 2975 | 1-9-0 | 10% | 2% to 40% | clear | 5.2 | 0 | 6 |
| ↳ missiles per battle: A launched 7.7, stopped by point defence 0.0, shot down 1.5, ran out or flew off 0.9, landed 1.9, caught in another blast or still flying at the end 3.4, ships sunk 0.6 | B launched 0.0, stopped by point defence 0.0, shot down 0.3, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.3, ships sunk 0.0 | | | | | | | | |
| m_old_1x | missile5:balanced v mixed4:balanced | 53987 | 2-8-0 | 20% | 6% to 51% | leaning | 3.7 | 0 | 7 |
| ↳ missiles per battle: A launched 0.2, stopped by point defence 0.0, shot down 0.2, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| m_old_1.5x | missile5:balanced v mixed4:balanced | 53987 | 2-8-0 | 20% | 6% to 51% | leaning | 3.7 | 0 | 7 |
| ↳ missiles per battle: A launched 0.2, stopped by point defence 0.0, shot down 0.2, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| m_old_2x | missile5:balanced v mixed4:balanced | 53987 | 2-8-0 | 20% | 6% to 51% | leaning | 3.7 | 0 | 7 |
| ↳ missiles per battle: A launched 0.2, stopped by point defence 0.0, shot down 0.2, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| m_old_3x | missile5:balanced v mixed4:balanced | 53987 | 2-8-0 | 20% | 6% to 51% | leaning | 3.7 | 0 | 7 |
| ↳ missiles per battle: A launched 0.2, stopped by point defence 0.0, shot down 0.2, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| m_old_wreck | missile5:balanced v mixed4:balanced | 53987 | 2-8-0 | 20% | 6% to 51% | leaning | 3.7 | 0 | 7 |
| ↳ missiles per battle: A launched 0.2, stopped by point defence 0.0, shot down 0.2, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| m_new_1x | missile5:balanced v mixed4:balanced | 53987 | 4-6-0 | 40% | 17% to 69% | unclear | 4.1 | 0 | 9 |
| ↳ missiles per battle: A launched 3.0, stopped by point defence 0.3, shot down 1.2, ran out or flew off 0.1, landed 0.4, caught in another blast or still flying at the end 1.0, ships sunk 0.2 | B launched 1.3, stopped by point defence 0.0, shot down 0.7, ran out or flew off 0.1, landed 0.3, caught in another blast or still flying at the end 0.2, ships sunk 0.1 | | | | | | | | |
| m_new_1.5x | missile5:balanced v mixed4:balanced | 53987 | 4-6-0 | 40% | 17% to 69% | unclear | 3.8 | 0 | 9 |
| ↳ missiles per battle: A launched 2.8, stopped by point defence 0.2, shot down 1.0, ran out or flew off 0.2, landed 0.5, caught in another blast or still flying at the end 0.9, ships sunk 0.5 | B launched 0.9, stopped by point defence 0.0, shot down 0.4, ran out or flew off 0.0, landed 0.2, caught in another blast or still flying at the end 0.3, ships sunk 0.2 | | | | | | | | |
| m_new_2x | missile5:balanced v mixed4:balanced | 53987 | 4-6-0 | 40% | 17% to 69% | unclear | 3.8 | 0 | 9 |
| ↳ missiles per battle: A launched 2.8, stopped by point defence 0.2, shot down 1.0, ran out or flew off 0.2, landed 0.5, caught in another blast or still flying at the end 0.9, ships sunk 0.5 | B launched 0.9, stopped by point defence 0.0, shot down 0.4, ran out or flew off 0.0, landed 0.2, caught in another blast or still flying at the end 0.3, ships sunk 0.2 | | | | | | | | |
| m_new_3x | missile5:balanced v mixed4:balanced | 53987 | 4-6-0 | 40% | 17% to 69% | unclear | 3.8 | 0 | 9 |
| ↳ missiles per battle: A launched 2.8, stopped by point defence 0.2, shot down 1.0, ran out or flew off 0.2, landed 0.5, caught in another blast or still flying at the end 0.9, ships sunk 0.5 | B launched 0.9, stopped by point defence 0.0, shot down 0.4, ran out or flew off 0.0, landed 0.2, caught in another blast or still flying at the end 0.3, ships sunk 0.2 | | | | | | | | |
| baseline | missile5:balanced v mixed4:balanced | 53987 | 4-6-0 | 40% | 17% to 69% | unclear | 3.8 | 0 | 9 |
| ↳ missiles per battle: A launched 2.8, stopped by point defence 0.2, shot down 1.0, ran out or flew off 0.1, landed 0.5, caught in another blast or still flying at the end 1.0, ships sunk 0.4 | B launched 1.0, stopped by point defence 0.0, shot down 0.5, ran out or flew off 0.0, landed 0.3, caught in another blast or still flying at the end 0.2, ships sunk 0.3 | | | | | | | | |
| m_salvo_only | missile5:balanced v mixed4:balanced | 53987 | 2-8-0 | 20% | 6% to 51% | leaning | 3.7 | 0 | 7 |
| ↳ missiles per battle: A launched 0.2, stopped by point defence 0.0, shot down 0.2, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| m_range_only | missile5:balanced v mixed4:balanced | 53987 | 4-6-0 | 40% | 17% to 69% | unclear | 4.5 | 0 | 9 |
| ↳ missiles per battle: A launched 2.9, stopped by point defence 0.1, shot down 2.0, ran out or flew off 0.0, landed 0.6, caught in another blast or still flying at the end 0.2, ships sunk 0.3 | B launched 1.1, stopped by point defence 0.0, shot down 0.5, ran out or flew off 0.0, landed 0.2, caught in another blast or still flying at the end 0.4, ships sunk 0.0 | | | | | | | | |
| pd_none | missile5:balanced v mixed4:balanced | 53987 | 4-6-0 | 40% | 17% to 69% | unclear | 3.7 | 0 | 9 |
| ↳ missiles per battle: A launched 2.5, stopped by point defence 0.0, shot down 1.0, ran out or flew off 0.0, landed 0.5, caught in another blast or still flying at the end 1.0, ships sunk 0.4 | B launched 1.0, stopped by point defence 0.0, shot down 0.5, ran out or flew off 0.0, landed 0.3, caught in another blast or still flying at the end 0.2, ships sunk 0.3 | | | | | | | | |
| pd_2 | missile5:balanced v mixed4:balanced | 53987 | 3-7-0 | 30% | 11% to 60% | leaning | 4.7 | 0 | 8 |
| ↳ missiles per battle: A launched 3.3, stopped by point defence 0.7, shot down 1.1, ran out or flew off 0.1, landed 0.4, caught in another blast or still flying at the end 1.0, ships sunk 0.3 | B launched 1.6, stopped by point defence 0.0, shot down 0.5, ran out or flew off 0.3, landed 0.3, caught in another blast or still flying at the end 0.5, ships sunk 0.3 | | | | | | | | |
| m_old_1x | wolfpack4:balanced v shields3:balanced | 121899 | 1-9-0 | 10% | 2% to 40% | clear | 4.4 | 0 | 6 |
| ↳ missiles per battle: A launched 0.8, stopped by point defence 0.0, shot down 0.5, ran out or flew off 0.0, landed 0.3, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| m_old_1.5x | wolfpack4:balanced v shields3:balanced | 121899 | 2-8-0 | 20% | 6% to 51% | leaning | 4.4 | 0 | 7 |
| ↳ missiles per battle: A launched 0.9, stopped by point defence 0.0, shot down 0.7, ran out or flew off 0.0, landed 0.2, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| m_old_2x | wolfpack4:balanced v shields3:balanced | 121899 | 2-8-0 | 20% | 6% to 51% | leaning | 4.4 | 0 | 7 |
| ↳ missiles per battle: A launched 0.9, stopped by point defence 0.0, shot down 0.7, ran out or flew off 0.0, landed 0.2, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| m_old_3x | wolfpack4:balanced v shields3:balanced | 121899 | 2-8-0 | 20% | 6% to 51% | leaning | 4.4 | 0 | 7 |
| ↳ missiles per battle: A launched 0.8, stopped by point defence 0.0, shot down 0.6, ran out or flew off 0.0, landed 0.2, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| m_old_wreck | wolfpack4:balanced v shields3:balanced | 121899 | 1-9-0 | 10% | 2% to 40% | clear | 4.3 | 0 | 6 |
| ↳ missiles per battle: A launched 0.8, stopped by point defence 0.0, shot down 0.5, ran out or flew off 0.0, landed 0.3, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| m_new_1x | wolfpack4:balanced v shields3:balanced | 121899 | 2-8-0 | 20% | 6% to 51% | leaning | 5.1 | 0 | 7 |
| ↳ missiles per battle: A launched 3.6, stopped by point defence 0.2, shot down 1.6, ran out or flew off 0.0, landed 1.1, caught in another blast or still flying at the end 0.7, ships sunk 0.1 | B launched 0.0, stopped by point defence 0.0, shot down 0.1, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.1, ships sunk 0.0 | | | | | | | | |
| m_new_1.5x | wolfpack4:balanced v shields3:balanced | 121899 | 3-7-0 | 30% | 11% to 60% | leaning | 4.7 | 0 | 8 |
| ↳ missiles per battle: A launched 3.8, stopped by point defence 0.2, shot down 1.6, ran out or flew off 0.0, landed 1.0, caught in another blast or still flying at the end 1.0, ships sunk 0.3 | B launched 0.0, stopped by point defence 0.0, shot down 0.3, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.3, ships sunk 0.0 | | | | | | | | |
| m_new_2x | wolfpack4:balanced v shields3:balanced | 121899 | 3-7-0 | 30% | 11% to 60% | leaning | 4.7 | 0 | 8 |
| ↳ missiles per battle: A launched 3.8, stopped by point defence 0.2, shot down 1.6, ran out or flew off 0.0, landed 1.0, caught in another blast or still flying at the end 1.0, ships sunk 0.3 | B launched 0.0, stopped by point defence 0.0, shot down 0.3, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.3, ships sunk 0.0 | | | | | | | | |
| m_new_3x | wolfpack4:balanced v shields3:balanced | 121899 | 4-6-0 | 40% | 17% to 69% | unclear | 4.2 | 0 | 9 |
| ↳ missiles per battle: A launched 3.2, stopped by point defence 0.4, shot down 1.5, ran out or flew off 0.0, landed 0.7, caught in another blast or still flying at the end 0.6, ships sunk 0.6 | B launched 0.0, stopped by point defence 0.0, shot down 0.1, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.1, ships sunk 0.0 | | | | | | | | |
| baseline | wolfpack4:balanced v shields3:balanced | 121899 | 2-8-0 | 20% | 6% to 51% | leaning | 5.1 | 0 | 7 |
| ↳ missiles per battle: A launched 3.7, stopped by point defence 0.2, shot down 1.6, ran out or flew off 0.0, landed 1.1, caught in another blast or still flying at the end 0.8, ships sunk 0.3 | B launched 0.0, stopped by point defence 0.0, shot down 0.2, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.2, ships sunk 0.0 | | | | | | | | |
| m_salvo_only | wolfpack4:balanced v shields3:balanced | 121899 | 1-9-0 | 10% | 2% to 40% | clear | 4.4 | 0 | 6 |
| ↳ missiles per battle: A launched 1.0, stopped by point defence 0.0, shot down 0.6, ran out or flew off 0.0, landed 0.3, caught in another blast or still flying at the end 0.1, ships sunk 0.1 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| m_range_only | wolfpack4:balanced v shields3:balanced | 121899 | 3-7-0 | 30% | 11% to 60% | leaning | 4.7 | 0 | 8 |
| ↳ missiles per battle: A launched 3.3, stopped by point defence 0.2, shot down 0.9, ran out or flew off 0.1, landed 1.2, caught in another blast or still flying at the end 0.9, ships sunk 0.3 | B launched 0.0, stopped by point defence 0.0, shot down 0.1, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.1, ships sunk 0.0 | | | | | | | | |
| pd_none | wolfpack4:balanced v shields3:balanced | 121899 | 2-8-0 | 20% | 6% to 51% | leaning | 5.1 | 0 | 7 |
| ↳ missiles per battle: A launched 3.7, stopped by point defence 0.0, shot down 1.6, ran out or flew off 0.0, landed 1.1, caught in another blast or still flying at the end 1.0, ships sunk 0.3 | B launched 0.0, stopped by point defence 0.0, shot down 0.2, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.2, ships sunk 0.0 | | | | | | | | |
| pd_2 | wolfpack4:balanced v shields3:balanced | 121899 | 2-8-0 | 20% | 6% to 51% | leaning | 5.1 | 0 | 7 |
| ↳ missiles per battle: A launched 3.7, stopped by point defence 0.4, shot down 1.6, ran out or flew off 0.0, landed 0.9, caught in another blast or still flying at the end 0.8, ships sunk 0.3 | B launched 0.0, stopped by point defence 0.0, shot down 0.2, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.2, ships sunk 0.0 | | | | | | | | |

missiles: 42 cells, 420 games, 57 s. First seat won 284 of 420.

### Suite: tempo

who moves first: alternating (baseline) against fixed. Mirror cells are here on purpose, to measure the seat

Command: `node tools/variants.mjs --suite tempo --games 20 --seed 11`. Seeds: first seed + 7919k, k = 0..9, each from both seats (base seed 11). One row alone: `node tools/variants.mjs --games 20 --seed 11 --cell "<cell>"`.

| cell (A is the first side) | W-L-D for A | A share | 95% interval | label | rounds | no kill | first seat won |
|---|---|---|---|---|---|---|---|
| baseline | stock:balanced v stock:balanced | 48904 | 10-10-0 | 50% | 30% to 70% | unclear | 6.9 | 0 | 16 |
| first_fixed | stock:balanced v stock:balanced | 48904 | 10-10-0 | 50% | 30% to 70% | unclear | 5.9 | 0 | 6 |
| baseline | solo:balanced v solo:balanced | 12764 | 10-10-0 | 50% | 30% to 70% | unclear | 3.5 | 0 | 2 |
| first_fixed | solo:balanced v solo:balanced | 12764 | 10-10-0 | 50% | 30% to 70% | unclear | 4.1 | 0 | 10 |
| baseline | team3:balanced v team3:balanced | 129335 | 10-10-0 | 50% | 30% to 70% | unclear | 6.4 | 0 | 12 |
| first_fixed | team3:balanced v team3:balanced | 129335 | 10-10-0 | 50% | 30% to 70% | unclear | 7.3 | 0 | 8 |
| baseline | guns4:balanced v guns4:balanced | 78466 | 10-10-0 | 50% | 30% to 70% | unclear | 4.9 | 0 | 12 |
| first_fixed | guns4:balanced v guns4:balanced | 78466 | 10-10-0 | 50% | 30% to 70% | unclear | 5.1 | 0 | 10 |
| baseline | mixed5:balanced v mixed5:balanced | 79792 | 10-10-0 | 50% | 30% to 70% | unclear | 6.7 | 0 | 10 |
| first_fixed | mixed5:balanced v mixed5:balanced | 79792 | 10-10-0 | 50% | 30% to 70% | unclear | 7.1 | 0 | 6 |

tempo: 10 cells, 200 games, 34 s. First seat won 92 of 200.

### Suite: forced

forced movement at five levels, against sitters, campers, both-sit, and two ordinary fights

Command: `node tools/variants.mjs --suite forced --games 10 --seed 11`. Seeds: first seed + 7919k, k = 0..4, each from both seats (base seed 11). One row alone: `node tools/variants.mjs --games 10 --seed 11 --cell "<cell>"`.

| cell (A is the first side) | W-L-D for A | A share | 95% interval | label | rounds | no kill | first seat won |
|---|---|---|---|---|---|---|---|
| baseline | stock:balanced v stock:sitter | 126774 | 8-2-0 | 80% | 49% to 94% | leaning | 8.7 | 0 | 5 |
| move_1 | stock:balanced v stock:sitter | 126774 | 7-3-0 | 70% | 40% to 89% | leaning | 9.4 | 0 | 4 |
| move_2 | stock:balanced v stock:sitter | 126774 | 8-2-0 | 80% | 49% to 94% | leaning | 9.0 | 0 | 5 |
| move_3 | stock:balanced v stock:sitter | 126774 | 9-1-0 | 90% | 60% to 98% | clear | 8.4 | 0 | 6 |
| move_50pct | stock:balanced v stock:sitter | 126774 | 8-2-0 | 80% | 49% to 94% | leaning | 9.0 | 0 | 5 |
| move_100pct | stock:balanced v stock:sitter | 126774 | 9-1-0 | 90% | 60% to 98% | clear | 8.4 | 0 | 6 |
| baseline | mixed4:balanced v mixed4:sitter | 22631 | 6-4-0 | 60% | 31% to 83% | unclear | 4.6 | 0 | 9 |
| move_1 | mixed4:balanced v mixed4:sitter | 22631 | 6-4-0 | 60% | 31% to 83% | unclear | 4.7 | 0 | 9 |
| move_2 | mixed4:balanced v mixed4:sitter | 22631 | 6-4-0 | 60% | 31% to 83% | unclear | 4.7 | 0 | 9 |
| move_3 | mixed4:balanced v mixed4:sitter | 22631 | 6-4-0 | 60% | 31% to 83% | unclear | 5.2 | 0 | 9 |
| move_50pct | mixed4:balanced v mixed4:sitter | 22631 | 6-4-0 | 60% | 31% to 83% | unclear | 5.3 | 0 | 9 |
| move_100pct | mixed4:balanced v mixed4:sitter | 22631 | 6-4-0 | 60% | 31% to 83% | unclear | 5.7 | 0 | 9 |
| baseline | stock:balanced v stock:camper | 102633 | 3-7-0 | 30% | 11% to 60% | leaning | 8.7 | 0 | 2 |
| move_1 | stock:balanced v stock:camper | 102633 | 2-8-0 | 20% | 6% to 51% | leaning | 8.9 | 0 | 3 |
| move_2 | stock:balanced v stock:camper | 102633 | 2-8-0 | 20% | 6% to 51% | leaning | 8.7 | 0 | 3 |
| move_3 | stock:balanced v stock:camper | 102633 | 6-4-0 | 60% | 31% to 83% | unclear | 9.4 | 0 | 5 |
| move_50pct | stock:balanced v stock:camper | 102633 | 2-8-0 | 20% | 6% to 51% | leaning | 8.6 | 0 | 3 |
| move_100pct | stock:balanced v stock:camper | 102633 | 6-4-0 | 60% | 31% to 83% | unclear | 9.2 | 0 | 5 |
| baseline | guns3:balanced v guns3:camper | 93546 | 7-3-0 | 70% | 40% to 89% | leaning | 6.5 | 0 | 6 |
| move_1 | guns3:balanced v guns3:camper | 93546 | 7-3-0 | 70% | 40% to 89% | leaning | 6.8 | 0 | 6 |
| move_2 | guns3:balanced v guns3:camper | 93546 | 7-3-0 | 70% | 40% to 89% | leaning | 7.5 | 0 | 6 |
| move_3 | guns3:balanced v guns3:camper | 93546 | 10-0-0 | 100% | 72% to 100% | clear | 8.1 | 0 | 5 |
| move_50pct | guns3:balanced v guns3:camper | 93546 | 8-2-0 | 80% | 49% to 94% | leaning | 7.6 | 0 | 7 |
| move_100pct | guns3:balanced v guns3:camper | 93546 | 9-1-0 | 90% | 60% to 98% | clear | 7.9 | 0 | 6 |
| baseline | stock:sitter v stock:sitter | 82912 | 0-0-10 | 50% | 24% to 76% | unclear | 31.0 | 10 | 0 |
| move_1 | stock:sitter v stock:sitter | 82912 | 0-0-10 | 50% | 24% to 76% | unclear | 31.0 | 10 | 0 |
| move_2 | stock:sitter v stock:sitter | 82912 | 0-0-10 | 50% | 24% to 76% | unclear | 31.0 | 10 | 0 |
| move_3 | stock:sitter v stock:sitter | 82912 | 0-0-10 | 50% | 24% to 76% | unclear | 31.0 | 10 | 0 |
| move_50pct | stock:sitter v stock:sitter | 82912 | 0-0-10 | 50% | 24% to 76% | unclear | 31.0 | 10 | 0 |
| move_100pct | stock:sitter v stock:sitter | 82912 | 0-0-10 | 50% | 24% to 76% | unclear | 31.0 | 10 | 0 |
| baseline | mixed4:sitter v mixed4:sitter | 43483 | 0-0-10 | 50% | 24% to 76% | unclear | 31.0 | 10 | 0 |
| move_1 | mixed4:sitter v mixed4:sitter | 43483 | 0-0-10 | 50% | 24% to 76% | unclear | 31.0 | 10 | 0 |
| move_2 | mixed4:sitter v mixed4:sitter | 43483 | 0-0-10 | 50% | 24% to 76% | unclear | 31.0 | 10 | 0 |
| move_3 | mixed4:sitter v mixed4:sitter | 43483 | 0-0-10 | 50% | 24% to 76% | unclear | 31.0 | 10 | 0 |
| move_50pct | mixed4:sitter v mixed4:sitter | 43483 | 0-0-10 | 50% | 24% to 76% | unclear | 31.0 | 10 | 0 |
| move_100pct | mixed4:sitter v mixed4:sitter | 43483 | 0-0-10 | 50% | 24% to 76% | unclear | 31.0 | 10 | 0 |
| baseline | mixed5:aggressive v mixed5:defensive | 75645 | 8-2-0 | 80% | 49% to 94% | leaning | 5.3 | 0 | 3 |
| move_1 | mixed5:aggressive v mixed5:defensive | 75645 | 7-3-0 | 70% | 40% to 89% | leaning | 6.1 | 0 | 4 |
| move_2 | mixed5:aggressive v mixed5:defensive | 75645 | 4-6-0 | 40% | 17% to 69% | unclear | 8.1 | 0 | 3 |
| move_3 | mixed5:aggressive v mixed5:defensive | 75645 | 5-5-0 | 50% | 24% to 76% | unclear | 7.5 | 0 | 2 |
| move_50pct | mixed5:aggressive v mixed5:defensive | 75645 | 7-3-0 | 70% | 40% to 89% | leaning | 8.7 | 0 | 4 |
| move_100pct | mixed5:aggressive v mixed5:defensive | 75645 | 5-5-0 | 50% | 24% to 76% | unclear | 7.6 | 0 | 2 |
| baseline | guns3:balanced v snipers3:balanced | 83588 | 7-3-0 | 70% | 40% to 89% | leaning | 5.5 | 0 | 4 |
| move_1 | guns3:balanced v snipers3:balanced | 83588 | 4-6-0 | 40% | 17% to 69% | unclear | 5.8 | 0 | 5 |
| move_2 | guns3:balanced v snipers3:balanced | 83588 | 4-6-0 | 40% | 17% to 69% | unclear | 5.5 | 0 | 7 |
| move_3 | guns3:balanced v snipers3:balanced | 83588 | 5-5-0 | 50% | 24% to 76% | unclear | 5.6 | 0 | 6 |
| move_50pct | guns3:balanced v snipers3:balanced | 83588 | 4-6-0 | 40% | 17% to 69% | unclear | 6.2 | 0 | 7 |
| move_100pct | guns3:balanced v snipers3:balanced | 83588 | 5-5-0 | 50% | 24% to 76% | unclear | 5.8 | 0 | 6 |

forced: 48 cells, 480 games, 119 s. First seat won 195 of 480.

### Suite: scan_b

longer scan exposure and exploding magazines

Command: `node tools/variants.mjs --suite scan_b --games 10 --seed 11`. Seeds: first seed + 7919k, k = 0..4, each from both seats (base seed 11). One row alone: `node tools/variants.mjs --games 10 --seed 11 --missiles --cell "<cell>"`.

| cell (A is the first side) | W-L-D for A | A share | 95% interval | label | rounds | no kill | first seat won |
|---|---|---|---|---|---|---|---|
| baseline | stock:balanced v stock:sitter | 126774 | 8-2-0 | 80% | 49% to 94% | leaning | 8.7 | 0 | 5 |
| ↳ missiles per battle: A launched 1.7, stopped by point defence 0.3, shot down 0.5, ran out or flew off 0.3, landed 0.2, caught in another blast or still flying at the end 0.4, ships sunk 0.0 | B launched 1.6, stopped by point defence 0.2, shot down 1.2, ran out or flew off 0.1, landed 0.4, caught in another blast or still flying at the end -0.3, ships sunk 0.1 | | | | | | | | |
| scan_exposed_2 | stock:balanced v stock:sitter | 126774 | 8-2-0 | 80% | 49% to 94% | leaning | 8.7 | 0 | 5 |
| ↳ missiles per battle: A launched 1.7, stopped by point defence 0.3, shot down 0.5, ran out or flew off 0.3, landed 0.2, caught in another blast or still flying at the end 0.4, ships sunk 0.0 | B launched 1.6, stopped by point defence 0.2, shot down 1.2, ran out or flew off 0.1, landed 0.4, caught in another blast or still flying at the end -0.3, ships sunk 0.1 | | | | | | | | |
| scan_exposed_3 | stock:balanced v stock:sitter | 126774 | 8-2-0 | 80% | 49% to 94% | leaning | 8.7 | 0 | 5 |
| ↳ missiles per battle: A launched 1.7, stopped by point defence 0.3, shot down 0.5, ran out or flew off 0.3, landed 0.2, caught in another blast or still flying at the end 0.4, ships sunk 0.0 | B launched 1.6, stopped by point defence 0.2, shot down 1.2, ran out or flew off 0.1, landed 0.4, caught in another blast or still flying at the end -0.3, ships sunk 0.1 | | | | | | | | |
| magazine_1 | stock:balanced v stock:sitter | 126774 | 9-1-0 | 90% | 60% to 98% | clear | 8.1 | 0 | 4 |
| ↳ missiles per battle: A launched 1.7, stopped by point defence 0.3, shot down 0.5, ran out or flew off 0.2, landed 0.2, caught in another blast or still flying at the end 0.5, ships sunk 0.1 | B launched 1.5, stopped by point defence 0.2, shot down 1.2, ran out or flew off 0.1, landed 0.3, caught in another blast or still flying at the end -0.3, ships sunk 0.2 | | | | | | | | |
| magazine_3 | stock:balanced v stock:sitter | 126774 | 9-1-0 | 90% | 60% to 98% | clear | 8.1 | 0 | 4 |
| ↳ missiles per battle: A launched 1.7, stopped by point defence 0.3, shot down 0.5, ran out or flew off 0.2, landed 0.2, caught in another blast or still flying at the end 0.5, ships sunk 0.1 | B launched 1.5, stopped by point defence 0.2, shot down 1.2, ran out or flew off 0.1, landed 0.3, caught in another blast or still flying at the end -0.3, ships sunk 0.2 | | | | | | | | |
| baseline | guns3:balanced v snipers3:balanced | 83588 | 7-3-0 | 70% | 40% to 89% | leaning | 5.5 | 0 | 4 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.4, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.4, ships sunk 0.0 | B launched 1.1, stopped by point defence 0.0, shot down 0.5, ran out or flew off 0.1, landed 0.1, caught in another blast or still flying at the end 0.4, ships sunk 0.1 | | | | | | | | |
| scan_exposed_2 | guns3:balanced v snipers3:balanced | 83588 | 7-3-0 | 70% | 40% to 89% | leaning | 5.5 | 0 | 4 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.4, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.4, ships sunk 0.0 | B launched 1.1, stopped by point defence 0.0, shot down 0.5, ran out or flew off 0.1, landed 0.1, caught in another blast or still flying at the end 0.4, ships sunk 0.1 | | | | | | | | |
| scan_exposed_3 | guns3:balanced v snipers3:balanced | 83588 | 7-3-0 | 70% | 40% to 89% | leaning | 5.5 | 0 | 4 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.4, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.4, ships sunk 0.0 | B launched 1.1, stopped by point defence 0.0, shot down 0.5, ran out or flew off 0.1, landed 0.1, caught in another blast or still flying at the end 0.4, ships sunk 0.1 | | | | | | | | |
| magazine_1 | guns3:balanced v snipers3:balanced | 83588 | 7-3-0 | 70% | 40% to 89% | leaning | 5.3 | 0 | 4 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.4, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.4, ships sunk 0.0 | B launched 1.1, stopped by point defence 0.0, shot down 0.5, ran out or flew off 0.1, landed 0.1, caught in another blast or still flying at the end 0.4, ships sunk 0.1 | | | | | | | | |
| magazine_3 | guns3:balanced v snipers3:balanced | 83588 | 7-3-0 | 70% | 40% to 89% | leaning | 5.3 | 0 | 4 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.4, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.4, ships sunk 0.0 | B launched 1.1, stopped by point defence 0.0, shot down 0.5, ran out or flew off 0.1, landed 0.1, caught in another blast or still flying at the end 0.4, ships sunk 0.1 | | | | | | | | |
| baseline | stealth4:balanced v guns4:balanced | 76204 | 5-5-0 | 50% | 24% to 76% | unclear | 5.2 | 0 | 8 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| scan_exposed_2 | stealth4:balanced v guns4:balanced | 76204 | 4-6-0 | 40% | 17% to 69% | unclear | 5.3 | 0 | 7 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| scan_exposed_3 | stealth4:balanced v guns4:balanced | 76204 | 4-6-0 | 40% | 17% to 69% | unclear | 5.3 | 0 | 7 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| magazine_1 | stealth4:balanced v guns4:balanced | 76204 | 5-5-0 | 50% | 24% to 76% | unclear | 5.2 | 0 | 8 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| magazine_3 | stealth4:balanced v guns4:balanced | 76204 | 5-5-0 | 50% | 24% to 76% | unclear | 5.2 | 0 | 8 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | B launched 0.0, stopped by point defence 0.0, shot down 0.0, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end 0.0, ships sunk 0.0 | | | | | | | | |
| baseline | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 4.1 | 0 | 8 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.4, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.4, ships sunk 0.0 | B launched 9.3, stopped by point defence 1.9, shot down 3.0, ran out or flew off 0.2, landed 1.8, caught in another blast or still flying at the end 2.4, ships sunk 0.5 | | | | | | | | |
| scan_exposed_2 | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 4.1 | 0 | 8 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.4, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.4, ships sunk 0.0 | B launched 9.3, stopped by point defence 1.9, shot down 3.0, ran out or flew off 0.2, landed 1.8, caught in another blast or still flying at the end 2.4, ships sunk 0.5 | | | | | | | | |
| scan_exposed_3 | shields3:balanced v missiles3:balanced | 36151 | 5-5-0 | 50% | 24% to 76% | unclear | 4.1 | 0 | 8 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.4, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.4, ships sunk 0.0 | B launched 9.3, stopped by point defence 1.9, shot down 3.0, ran out or flew off 0.2, landed 1.8, caught in another blast or still flying at the end 2.4, ships sunk 0.5 | | | | | | | | |
| magazine_1 | shields3:balanced v missiles3:balanced | 36151 | 6-4-0 | 60% | 31% to 83% | unclear | 3.7 | 0 | 9 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.4, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.4, ships sunk 0.0 | B launched 7.9, stopped by point defence 1.7, shot down 2.6, ran out or flew off 0.0, landed 1.3, caught in another blast or still flying at the end 2.3, ships sunk 0.5 | | | | | | | | |
| magazine_3 | shields3:balanced v missiles3:balanced | 36151 | 6-4-0 | 60% | 31% to 83% | unclear | 3.7 | 0 | 9 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.4, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.4, ships sunk 0.0 | B launched 7.9, stopped by point defence 1.7, shot down 2.6, ran out or flew off 0.0, landed 1.3, caught in another blast or still flying at the end 2.3, ships sunk 0.5 | | | | | | | | |
| baseline | guns3:balanced v missiles3:balanced | 10996 | 6-4-0 | 60% | 31% to 83% | unclear | 5.1 | 0 | 5 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.1, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.1, ships sunk 0.0 | B launched 10.6, stopped by point defence 0.0, shot down 2.1, ran out or flew off 0.9, landed 2.4, caught in another blast or still flying at the end 5.2, ships sunk 0.8 | | | | | | | | |
| scan_exposed_2 | guns3:balanced v missiles3:balanced | 10996 | 6-4-0 | 60% | 31% to 83% | unclear | 5.1 | 0 | 5 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.1, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.1, ships sunk 0.0 | B launched 10.6, stopped by point defence 0.0, shot down 2.1, ran out or flew off 0.9, landed 2.4, caught in another blast or still flying at the end 5.2, ships sunk 0.8 | | | | | | | | |
| scan_exposed_3 | guns3:balanced v missiles3:balanced | 10996 | 6-4-0 | 60% | 31% to 83% | unclear | 5.2 | 0 | 5 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.2, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.2, ships sunk 0.0 | B launched 10.9, stopped by point defence 0.0, shot down 2.1, ran out or flew off 0.9, landed 2.5, caught in another blast or still flying at the end 5.4, ships sunk 0.9 | | | | | | | | |
| magazine_1 | guns3:balanced v missiles3:balanced | 10996 | 8-2-0 | 80% | 49% to 94% | leaning | 4.6 | 0 | 5 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.1, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.1, ships sunk 0.0 | B launched 8.5, stopped by point defence 0.0, shot down 1.6, ran out or flew off 0.8, landed 1.9, caught in another blast or still flying at the end 4.2, ships sunk 0.7 | | | | | | | | |
| magazine_3 | guns3:balanced v missiles3:balanced | 10996 | 9-1-0 | 90% | 60% to 98% | clear | 4.2 | 0 | 4 |
| ↳ missiles per battle: A launched 0.0, stopped by point defence 0.0, shot down 0.1, ran out or flew off 0.0, landed 0.0, caught in another blast or still flying at the end -0.1, ships sunk 0.0 | B launched 6.8, stopped by point defence 0.0, shot down 1.1, ran out or flew off 0.7, landed 1.6, caught in another blast or still flying at the end 3.4, ships sunk 0.6 | | | | | | | | |
| baseline | mixed4:balanced v missile5:balanced | 78687 | 6-4-0 | 60% | 31% to 83% | unclear | 4.6 | 0 | 9 |
| ↳ missiles per battle: A launched 0.8, stopped by point defence 0.0, shot down 0.1, ran out or flew off 0.2, landed 0.0, caught in another blast or still flying at the end 0.5, ships sunk 0.0 | B launched 3.8, stopped by point defence 0.0, shot down 2.8, ran out or flew off 0.3, landed 0.3, caught in another blast or still flying at the end 0.4, ships sunk 0.0 | | | | | | | | |
| scan_exposed_2 | mixed4:balanced v missile5:balanced | 78687 | 6-4-0 | 60% | 31% to 83% | unclear | 4.6 | 0 | 9 |
| ↳ missiles per battle: A launched 0.8, stopped by point defence 0.0, shot down 0.1, ran out or flew off 0.2, landed 0.0, caught in another blast or still flying at the end 0.5, ships sunk 0.0 | B launched 3.8, stopped by point defence 0.0, shot down 2.8, ran out or flew off 0.3, landed 0.3, caught in another blast or still flying at the end 0.4, ships sunk 0.0 | | | | | | | | |
| scan_exposed_3 | mixed4:balanced v missile5:balanced | 78687 | 6-4-0 | 60% | 31% to 83% | unclear | 4.6 | 0 | 9 |
| ↳ missiles per battle: A launched 0.8, stopped by point defence 0.0, shot down 0.1, ran out or flew off 0.2, landed 0.0, caught in another blast or still flying at the end 0.5, ships sunk 0.0 | B launched 3.8, stopped by point defence 0.0, shot down 2.8, ran out or flew off 0.3, landed 0.3, caught in another blast or still flying at the end 0.4, ships sunk 0.0 | | | | | | | | |
| magazine_1 | mixed4:balanced v missile5:balanced | 78687 | 5-5-0 | 50% | 24% to 76% | unclear | 4.2 | 0 | 10 |
| ↳ missiles per battle: A launched 0.8, stopped by point defence 0.0, shot down 0.4, ran out or flew off 0.2, landed 0.0, caught in another blast or still flying at the end 0.2, ships sunk 0.0 | B launched 3.9, stopped by point defence 0.1, shot down 2.2, ran out or flew off 0.5, landed 0.4, caught in another blast or still flying at the end 0.7, ships sunk 0.1 | | | | | | | | |
| magazine_3 | mixed4:balanced v missile5:balanced | 78687 | 5-5-0 | 50% | 24% to 76% | unclear | 4.2 | 0 | 10 |
| ↳ missiles per battle: A launched 0.8, stopped by point defence 0.0, shot down 0.4, ran out or flew off 0.2, landed 0.0, caught in another blast or still flying at the end 0.2, ships sunk 0.0 | B launched 3.9, stopped by point defence 0.1, shot down 2.2, ran out or flew off 0.5, landed 0.4, caught in another blast or still flying at the end 0.7, ships sunk 0.1 | | | | | | | | |

scan_b: 30 cells, 300 games, 31 s. First seat won 194 of 300.

### Suite: humans

human-style pilots against the baseline computer (balanced)

Command: `node tools/variants.mjs --suite humans --games 10 --seed 11`. Seeds: first seed + 7919k, k = 0..4, each from both seats (base seed 11). One row alone: `node tools/variants.mjs --games 10 --seed 11 --cell "<cell>"`.

| cell (A is the first side) | W-L-D for A | A share | 95% interval | label | rounds | no kill | first seat won |
|---|---|---|---|---|---|---|---|
| baseline | mixed4:scanner v mixed4:balanced | 93455 | 5-5-0 | 50% | 24% to 76% | unclear | 3.7 | 0 | 10 |
| scan_wide | mixed4:scanner v mixed4:balanced | 93455 | 2-8-0 | 20% | 6% to 51% | leaning | 5.6 | 0 | 5 |
| scan_free | mixed4:scanner v mixed4:balanced | 93455 | 5-5-0 | 50% | 24% to 76% | unclear | 4.2 | 0 | 10 |
| baseline | team3:scanner v team3:balanced | 57718 | 5-5-0 | 50% | 24% to 76% | unclear | 5.4 | 0 | 2 |
| scan_wide | team3:scanner v team3:balanced | 57718 | 4-6-0 | 40% | 17% to 69% | unclear | 5.3 | 0 | 1 |
| scan_free | team3:scanner v team3:balanced | 57718 | 5-5-0 | 50% | 24% to 76% | unclear | 5.8 | 0 | 4 |
| baseline | mixed5:scanner v mixed5:balanced | 4119 | 4-5-1 | 45% | 20% to 73% | unclear | 11.5 | 1 | 1 |
| scan_wide | mixed5:scanner v mixed5:balanced | 4119 | 3-7-0 | 30% | 11% to 60% | leaning | 10.1 | 0 | 6 |
| scan_free | mixed5:scanner v mixed5:balanced | 4119 | 5-4-1 | 55% | 27% to 80% | unclear | 10.4 | 1 | 2 |
| baseline | guns3:scanner v snipers3:balanced | 53506 | 5-5-0 | 50% | 24% to 76% | unclear | 5.6 | 0 | 6 |
| scan_wide | guns3:scanner v snipers3:balanced | 53506 | 6-4-0 | 60% | 31% to 83% | unclear | 7.1 | 0 | 7 |
| scan_free | guns3:scanner v snipers3:balanced | 53506 | 6-4-0 | 60% | 31% to 83% | unclear | 5.5 | 0 | 7 |
| baseline | mixed4:hunter v mixed4:balanced | 24399 | 5-5-0 | 50% | 24% to 76% | unclear | 6.4 | 0 | 6 |
| scan_wide | mixed4:hunter v mixed4:balanced | 24399 | 5-5-0 | 50% | 24% to 76% | unclear | 4.4 | 0 | 8 |
| scan_free | mixed4:hunter v mixed4:balanced | 24399 | 5-5-0 | 50% | 24% to 76% | unclear | 5.0 | 0 | 6 |
| baseline | team3:hunter v team3:balanced | 118480 | 5-5-0 | 50% | 24% to 76% | unclear | 6.0 | 0 | 0 |
| scan_wide | team3:hunter v team3:balanced | 118480 | 5-5-0 | 50% | 24% to 76% | unclear | 5.7 | 0 | 4 |
| scan_free | team3:hunter v team3:balanced | 118480 | 5-5-0 | 50% | 24% to 76% | unclear | 5.2 | 0 | 0 |
| baseline | mixed4:baiter v mixed4:balanced | 35644 | 6-4-0 | 60% | 31% to 83% | unclear | 2.8 | 0 | 9 |
| scan_wide | mixed4:baiter v mixed4:balanced | 35644 | 6-4-0 | 60% | 31% to 83% | unclear | 2.8 | 0 | 9 |
| scan_free | mixed4:baiter v mixed4:balanced | 35644 | 5-5-0 | 50% | 24% to 76% | unclear | 2.9 | 0 | 8 |
| baseline | team3:baiter v team3:balanced | 83523 | 4-6-0 | 40% | 17% to 69% | unclear | 5.7 | 0 | 5 |
| scan_wide | team3:baiter v team3:balanced | 83523 | 5-5-0 | 50% | 24% to 76% | unclear | 4.4 | 0 | 4 |
| scan_free | team3:baiter v team3:balanced | 83523 | 4-6-0 | 40% | 17% to 69% | unclear | 5.8 | 0 | 5 |
| baseline | cheap5:baiter v guns3:balanced | 107053 | 2-8-0 | 20% | 6% to 51% | leaning | 4.8 | 0 | 7 |
| scan_wide | cheap5:baiter v guns3:balanced | 107053 | 2-8-0 | 20% | 6% to 51% | leaning | 4.6 | 0 | 7 |
| scan_free | cheap5:baiter v guns3:balanced | 107053 | 2-8-0 | 20% | 6% to 51% | leaning | 4.4 | 0 | 7 |
| baseline | swarm5:baiter v guns4:balanced | 92389 | 0-10-0 | 0% | 0% to 28% | clear | 5.3 | 0 | 5 |
| scan_wide | swarm5:baiter v guns4:balanced | 92389 | 2-8-0 | 20% | 6% to 51% | leaning | 5.3 | 0 | 7 |
| scan_free | swarm5:baiter v guns4:balanced | 92389 | 0-10-0 | 0% | 0% to 28% | clear | 4.5 | 0 | 5 |
| baseline | stealth4:baiter v guns4:balanced | 26687 | 2-8-0 | 20% | 6% to 51% | leaning | 5.7 | 0 | 7 |
| scan_wide | stealth4:baiter v guns4:balanced | 26687 | 4-6-0 | 40% | 17% to 69% | unclear | 5.9 | 0 | 9 |
| scan_free | stealth4:baiter v guns4:balanced | 26687 | 3-7-0 | 30% | 11% to 60% | leaning | 5.4 | 0 | 8 |
| baseline | decoys5:decoy v mixed3:balanced | 106052 | 3-7-0 | 30% | 11% to 60% | leaning | 5.7 | 0 | 6 |
| scan_wide | decoys5:decoy v mixed3:balanced | 106052 | 1-9-0 | 10% | 2% to 40% | clear | 7.0 | 0 | 6 |
| scan_free | decoys5:decoy v mixed3:balanced | 106052 | 4-6-0 | 40% | 17% to 69% | unclear | 5.7 | 0 | 7 |

humans: 36 cells, 360 games, 44 s. First seat won 206 of 360.
