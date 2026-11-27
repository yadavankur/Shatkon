# Secret starts, step 1: how many starting layouts does each board allow?

Claude (gamedev chat), 28 Nov 2026. Evidence only: no game code changed.

## Why

Ankur, 27 Nov: "It's easy to guess enemy location because boards are mirror." Every board's starting spots are fixed and written in the board file, so after one or two games you know where every enemy ship is on turn 1. His idea: work out every legal start in advance, number them, and let a seed pick one in secret for each side, Chess960 style. If a fleet only has a dozen or so layouts, just use them all.

This step answers two questions before anything is built: how many legal starts does each side have, and can about 12 be found that are really different?

## How it was counted

`tools/starts.mjs`. Rerun it with:

```
node tools/starts.mjs --json docs/design/starts            (add --md FILE to also write the table to FILE.table)
```

Defaults: `--seed 1 --samples 200000 --pick 12 --filter apart`. About 45 seconds for all ten boards.

- **A layout** is where every ship of one side starts. Ships keep the hull and facing the board file gives them; only the spot moves. Starting mines stay where they are, and no ship may start on one.
- **Legal:** what the engine already accepts (`engine/rules.js`): on the board, off blocked terrain, inside the side's home zone (`map.zones`), no two ships on the same hex.
- **Apart:** legal, and no two ships touching (one clear hex between them).
- **Apart + flagship back:** apart, and the flagship not in the zone's front row (the row nearest the enemy).
- Exact copies of a ship (same hull, same parts) count once, because swapping two of them gives the same picture.
- Counts without a `~` are exact (a full search). Counts with a `~` were estimated by sampling: pick every ship's spot at random 200,000 times, see what share passes, and scale by the number of combinations. Treat those as order-of-magnitude figures.
- **The 12 picks:** the board's own start comes first, so today's layout stays as layout 1. Then come random layouts that pass "apart", each next pick being the one furthest from all those already picked. The distance between two layouts is the sum of hex distances between the same ship's spots, with the flagship counted three times. The picks are in `docs/design/starts/<board>.json`, one line per layout, with ships in the order listed there.

## Results

| Board | Side | Ships | Home zone | Legal | Apart | Apart + flagship back | Flagship spots (off front row) | Today's start is apart | Flagship spots in the 12 picks |
|---|---|---|---|---|---|---|---|---|---|
| 01_first_light | 1 | 2 | south depth 3 (24 hexes) | 201 | 118 | 53 | 13 (6) | yes | 11 of 12 |
| 01_first_light | 2 | 2 | north depth 3 (24 hexes) | 201 | 118 | 53 | 13 (6) | yes | 11 of 12 |
| 02_minefield | 1 | 4 | south_east depth 3 (33 hexes) | 18816 | 1920 | 840 | 19 (9) | no | 12 of 12 |
| 02_minefield | 2 | 3 | north_west depth 3 (33 hexes) | 540 | 231 | 105 | 19 (9) | yes | 10 of 12 |
| 03_cat_and_mouse | 1 | 7 | south depth 3 (39 hexes) | ~5.7e8 | 2664562 | 1295930 | 33 (21) | no | 12 of 12 |
| 03_cat_and_mouse | 2 | 3 | north depth 4 (54 hexes) | 18758 | 8739 | 5395 | 32 (21) | yes | 12 of 12 |
| 04_the_dogleg | 1 | 3 | south_west depth 3 (33 hexes) | 2392 | 712 | 0 | 9 (0) | yes | 7 of 12 |
| 04_the_dogleg | 2 | 3 | north_east depth 3 (33 hexes) | 2392 | 712 | 0 | 9 (0) | yes | 8 of 12 |
| 05_kings_guard | 1 | 5 | south depth 3 (30 hexes) | 222210 | 1254 | 688 | 17 (12) | no | 9 of 12 |
| 05_kings_guard | 2 | 5 | south_west depth 3 (30 hexes) | 222210 | 1254 | 688 | 17 (12) | no | 10 of 12 |
| 06_pawn_storm | 1 | 7 | south depth 8 (132 hexes) | ~5.0e11 | ~1.6e11 | ~1.3e11 | 102 (87) | yes | 12 of 12 |
| 06_pawn_storm | 2 | 1 | north depth 15 (294 hexes) | 173 | 173 | 159 | 173 (159) | yes | 12 of 12 |
| 07_beacon_hill | 1 | 6 | south depth 3 (33 hexes) | ~2.3e7 | 533730 | 246680 | 19 (9) | no | 10 of 12 |
| 07_beacon_hill | 2 | 6 | north depth 3 (33 hexes) | ~2.3e7 | 533730 | 246680 | 19 (9) | no | 11 of 12 |
| 08_missile_alley | 1 | 4 | south depth 3 (36 hexes) | 14956 | 2040 | 0 | 10 (0) | no | 8 of 12 |
| 08_missile_alley | 2 | 4 | north depth 3 (36 hexes) | 155340 | 19452 | 8892 | 21 (10) | no | 11 of 12 |
| 09_fog_bank | 1 | 4 | south_west depth 6 (69 hexes) | 2372104 | 714737 | 504323 | 33 (25) | yes | 9 of 12 |
| 09_fog_bank | 2 | 4 | north_east depth 3 (30 hexes) | 1820 | 112 | 0 | 8 (0) | yes | 8 of 12 |
| 10_gambit | 1 | 6 | south_east depth 4 (46 hexes) | ~2.8e7 | 547846 | 294477 | 30 (19) | no | 8 of 12 |
| 10_gambit | 2 | 4 | north depth 4 (46 hexes) | 290511 | 31341 | 17169 | 30 (19) | no | 12 of 12 |

Mirror check (`mirrorOf` in `tools/boards.mjs`): only First Light, The Dogleg, Beacon Hill (turned 180°) and King's Guard (flipped) are exact mirrors. The other six are deliberately lopsided. All ten still have one fixed, public start, so the guessing problem is the same on every board.

## What it shows

1. **There are never only a dozen.** Even the smallest fleet, First Light's two ships, has 201 legal starts, and the big fleets run to millions or more. So it isn't a case of using every layout: a numbered shortlist has to be picked, as these tools do.
2. **The flagship is the real secret, and it has far fewer spots.** In a depth-3 zone a big flagship fits in only 8 to 21 places. The other ships multiply the layout count, but finding the flagship is what wins. A shortlist of 12 only helps if the flagship moves around within it. The 12 picks give 7 to 12 different flagship spots per side.
3. **Three sides can't keep the flagship out of the front row.** On The Dogleg (both sides), Missile Alley (player 1) and Fog Bank (player 2), the flagship is too long for a 3-row zone and always reaches the front row. If "flagship back" became a rule, those zones would need to be deeper.
4. **Half of today's starts have ships touching.** On Minefield (player 1), Cat and Mouse (player 1), King's Guard, Beacon Hill, Missile Alley and Gambit, the board file's own start has ships side by side. That's fine, since boards are allowed to do it. But if "apart" became the rule for new layouts, layout 1 (today's start) would be the only one with ships touching.
5. **Pawn Storm's player 2 is a single ship** in a 15-row zone, so it already has 173 spots, one per hex. That side was never guessable in this way.

## Open questions for Ankur

- **Which filter?** Should picked layouts keep ships apart? Should the flagship stay off the front row, which means deepening three zones?
- **How many layouts per side?** The tool picks 12 by default, but any number works (`--pick N`). Fewer layouts mean more deduction from an early sighting. More layouts leave the start closer to unknown.
- **Should the board designer approve each list?** The picks are random and spread out, but not tactically sensible. One might park a gunboat behind a rock where it can't get out. The maps bot (or Ankur) could keep, drop or swap layouts before they're used.

## Next step, once those are decided

Write the chosen lists into the board files (a `starts:` list per side), add a "Starting layout: fixed / secret" battle setting with fixed as the default, and let each side draw its own number from its own seed. On two phones, each phone draws and keeps its own number, the game code carries it scrambled, and the log reveals it after the game. The computer draws from its own seed and never sees yours.

— Claude (gamedev chat)
