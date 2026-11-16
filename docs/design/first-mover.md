# Who moves first (16 Nov 2026, maps, with Ankur's go-ahead)

Ankur: "Random first is an obvious call." Before this, player 1 (the person, against the computer)
always moved in round 1, and the first move then swapped every round.

## The rule
- World file `turns.first: random | player_1 | player_2` (`rules/world_v0.4.yaml` ships `random`).
  A board can pin it in its `rules:` block (`turns.first: player_1`). A world file without the line
  means `player_1`, as before.
- `random` is worked out from the game's seed (`firstSeat` in `engine/state.js`: a mixed hash of the
  seed, not a roll of the game's dice, so nothing else about the game changes). The same seed always
  gives the same first mover, so replays, battle logs, game codes and turn codes agree.
  `state.order` starts as `[1, 0]` when player 2 moves first; everything after that is unchanged
  (`turns.first_player: alternate` still swaps it every round).
- Story chapters keep their scripted order: `buildChapter` sets `firstMover: 'player_1'` and
  `firstSeat` returns 0 for any campaign game.
- Play screen: the new-game message and a toast say "You move first" / "The enemy moves first"
  (or "Player N moves first" in pass-and-play and code games). When the computer moves first it
  takes its turn at once, but waits while the first-visit rules card is open. The rules card has a
  line for it, and the field manual's turn paragraph says so.
- Tools that swap seats themselves pin `player_1`: `tools/sim.mjs`, `variants.mjs`, `scenarios.mjs`,
  and the Lab's duels (`labWorld(knobs, true)`). Tests that give player 1 orders on turn 1 pin it too
  (`tests/helpers.js battle`, `tests/boards.test.js pinned`). `tests/first-mover.test.js` covers the rule.

## boards.mjs
`--both` still plays each board as written and with the fleets swapping seats. Each line now also
says how player 1's fleet did when it moved first and when it moved second, and how often the first
mover won. Over seeds 1..N the two halves are complementary, so player 1's fleet moves first in
exactly N of the 2N games. `--set turns.first=player_1` gives the old fixed order.

`node tools/boards.mjs --both --games 20` after the change (player 1's fleet, of 40):

| Board | In all | Moving first | Moving second | First mover won |
|---|---|---|---|---|
| 01 First Light | 22 | 10 of 20 | 12 of 20 | 18 of 40 |
| 02 Minefield | 18 | 12 | 6 | 23 |
| 03 Cat and Mouse | 21 | 11 | 10 | 19 |
| 04 Dogleg | 21 | 10 | 11 | 19 |
| 05 King's Guard | 12 | 5 | 7 | 14 |
| 06 Pawn Storm | 14 | 9 | 5 | 24 |
| 07 Beacon Hill | 21 | 11 | 10 | 21 |
| 08 Missile Alley | 12 | 7 | 5 | 22 |
| 09 Fog Bank | 19 | 8 | 11 | 17 |
| 10 Gambit | 21 | 12 | 9 | 22 |

King's Guard over 60 seeds (`--games 60`): 47 of 120 for player 1's fleet; moving first 16 of 60,
moving second 31 of 60; the first mover won 37 of 120 (20 to the round limit). Moving second looks like an edge
there (the second mover in round 1 also moves first in round 2: two turns in a row). Worth a look
by the maps bot; a computer-v-computer smoke test, not a balance result.
