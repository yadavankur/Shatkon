# CHECKS: Shatkon: The Weave, chapters 1-5

The results here come from two sources, and each one is labelled:

- **[main]**: `node campaign/tools/check.mjs` on this branch, which is based on `main` at
  8c8be0a. It runs main's `engine/rules.js` `buildRules`, the stock engine formulas
  (`shipStats`, `sensorOf`, `signatureOf`, `gap`) and the campaign lint. It needs nothing
  outside main.
- **[PR #2]**: `node campaign/tools/engine_check.mjs --engine <checkout of campaign-engine>`,
  run against PR #2 (branch `campaign-engine`, head **7f51643**, re-run on 14 Nov 2026 after the
  campaign UI commits) in a temporary worktree. Nothing in that worktree was changed. It does
  two things:
  - It loads every chapter with PR #2's `buildChapter()`, chaining campaign progress with
    `newCampaign()` and `applyResult()`.
  - It plays scripted AI-vs-AI games through `engine/script.js`. Both seats use
    `campaignMove()`: the Weave follow the chapter's AI profiles, and the human stand-in has no
    profile, so it plays PR #2's stock normal AI.

  By default the stand-in never fires a shot that would destroy one of its own mines. Since
  ch2 now sets `damage.beams_pass_mines`, this makes almost no difference (`--sloppy` turns it
  off). Other flags: `--no-rails` drops every `protect`, and `--graft` makes the stand-in issue
  the Graft order itself.
- **[browser]**: `campaign/tools/browser_story.cjs` (Playwright), on a temporary merge of
  campaign-v1 into campaign-engine 7f51643 served over http. It plays the whole Story campaign
  from the play screen's mode picker (see "Browser run" below).

Each set has 40 games per chapter (seeds 1-40). The engine is deterministic for a given seed,
and the stock normal AI makes few random choices, so some chapters play the same way every
time. That is a property of the AI, not of the script.

Engine numbers used throughout (world_v0.4):
- **Laser:** 2 hits out to 4 hexes, 1 hit from 5 to 8. The line must be clear of asteroids
  *and of objects*, mines included.
- **Missile:** speed 6, fuel 3, 3 hits plus 1 blast hit within 1. Point defence stops 1 missile
  per mount each round.
- **Sight:** exact at sensor + signature, fuzzy contact 3 further. The nebula takes 2 off
  signature. Asteroids do not block detection.
- **Movement:** the fleet move cap is floor(fleet thrust / fleet segments) + 1 hexes a turn, and
  a ship pays its segment count in thrust for each hex.

## Summary

| ch | map (radius) | start gap, nearest pair | first sighting (designed / PR #2 sims) | buildRules [main] | buildChapter [PR #2] | PR #2 sims (40 games) |
|---|---|---|---|---|---|---|
| 1 | ch1_corridor (7) | Seed-Finch 9, Seed-Kestrel 12 | r1-2, fallback r2 / **r1** (40/40) | 0 problems | 0 problems | 40 wins, r8; finch_down r4 (doom) |
| 2 | ch2_quiet_water (8) | seed_b-Kestrel 11 | r1-3, fallback r3 / **r2.3** (r1-3) | 0 problems | 0 problems | 40 wins, r6-21 (avg 13.7); 36 mine hits; first_mine 34/40 (the other 6 were won before r10) |
| 3 | ch3_splitting (9) | Twin-Kestrel 13 | r3-4, fallback r4 / split **r3** (40/40) | 0 problems; split pieces and li_wing 0 problems | 0 problems | 40 wins, r9-23 (avg 10.8); li r6 |
| 4A | ch4a_ashfall (8) | husks-Kestrel 9 | r1-3 / gift r3-6 | 0 problems; graft result 0 problems | 0 problems | 40 wins (grafted), r5-9 |
| 5 | ch5_bloom (10) | Bloom-Kestrel 13 (on arrival, r2) | lit on arrival r2 / r2 | 0 problems (with the Bloom in place) | 0 problems; the Bloom held in reserve | 40 to_be_continued, cliff r6 |

The [main] check prints **ALL CHECKS PASSED**, with one note: ch2's
`damage.beams_pass_mines` is a PR #2 world setting that main's world file lacks; main's engine
ignores it. On the merged tree (PR #2 world) the check also passes with no note. The [PR #2] loader reports **no problems** for
any chapter. In the PR #2 games every non-flavor beat fired in every game, with two exceptions, both in ch2.
`first_mine` did not fire in the 6 games that were won before round 10. `herd` and
`mine_fallback` fire only when they are needed. No `script_unknown` or `script_failed` event
appeared.

Tests: `node --test` passes 35/35 on this branch (main's tests) and 58/58 on the merge of
campaign-v1 and campaign-engine.

## Chapter 1: First Contact (ch1_corridor, radius 7)

**[main] buildRules: 0 problems.**
- Kestrel: 3 segments, thrust 4, sensor 6, signature 3, 3 lasers, 24 hull points.
- Sparrow and Finch: 1 segment each, sensor 4, signature 1, 1 laser.
- Seed: 2 segments, thrust 2, sensor 4, signature 2, 1 laser, 2 shields, 2 missiles, 12 hull points.
- Move caps: humans 2 hexes a turn. The Seed's cap is also 2, but at 2 thrust a hex it moves 1 hex a turn, or 2 using banked thrust.

| beat | condition | fallback | numbers |
|---|---|---|---|
| rails | start | - | Kestrel and Sparrow are protected until the end. Finch is doomed by round 4. |
| contact | player sees the Seed | round 2 | Gaps: Finch 9, Sparrow 10, Kestrel 12. A scout sees the Seed at 4+2 = 6 exactly and 9 as a fuzzy contact, so Finch has a fuzzy contact from turn 1. Closing speed is ~3 hexes a round (scout 2 + Seed 1), so the exact sighting comes in round 1-2. **PR #2: r1 in 40/40.** |
| finch_down | Finch destroyed | doom by_round 4 (the doom set in rails) | The Seed sees a scout at 4+1 = 5, so its laser does 1 hit at 5 and 2 hits at 4 or less. Its missile launch_range is 5 (3 hits plus blast); missile reach (6 × 3 fuel) is not the limit. Finch has 6 hull points: 1 missile + 1-2 laser hits. stand_off 6 from Kestrel keeps the Seed cautious. **PR #2: r4 in 40/40, always by the doom.** The Seed lands hits (finch_hit 35/40) but never finishes Finch inside 3 rounds. |
| charge | round 15 | itself; its doom kills the Seed by round 19 | Kestrel's 3 lasers do 6 hits a round inside 4 hexes, against the Seed's 12 hull points + 2 shields. **PR #2: never needed (0/40). The Seed dies in r8 to Kestrel in 40/40.** |
| flavor | seed_shield (first human shot at the Seed), finch_hit, seed_closing (within 6 of Kestrel after Finch) | - | PR #2: r2, r1 and r5 respectively. |

**Difficulty:** tutorial. **[PR #2 --no-rails]**: 40/40 wins by r5, but Sparrow dies in 40/40. Protecting Sparrow is what keeps it for the ch2 salvage.

## Chapter 2: Quiet Water (ch2_quiet_water, radius 8)

**[main] buildRules: 0 problems.**
- Kestrel: 2 lasers, launcher, 2 missiles, thrust 3.
- seed_a and seed_b: as the ch1 Seed (seed_b carries 1 missile).
- 4 mines at [-1,0], [1,0], [0,1], [0,-1]. They are legal: they sit inside home depth 4 + 6 rows.
- Mine signature is overridden to -12, so a Seed sensor of 4 gives a negative sight range: the Seeds can never see the mines. `scans: false` stops them scanning, and `avoid_mines: false` makes them ignore any mine they know about.

| beat | condition | fallback | numbers |
|---|---|---|---|
| rails | start | - | Kestrel and Sparrow are protected until the end. |
| contact | player sees either Seed | round 3 | Kestrel sees a Seed at 6+2 = 8. Start gaps are 11-13, closing ~3 a round. **PR #2: avg r2.3 (r1-3).** |
| herd | round 6 and no mine hit yet | - (it is first_mine's fallback) | Switches both Seeds to `herd`: stance advance, path_via minefield. They march through the gap and ignore the humans while moving. **PR #2: needed in 21/40 games.** |
| mine_fallback | round 10 and no first_mine yet | - (it is first_mine's fallback) | A PR #2 `damage: { ship: seed_a, hits: 4, from_mine: true }` uses up the nearest charge and counts as a mine hit. **PR #2: 11/40.** |
| first_mine | an enemy mine hit | round 11 | Every 2-hex path through the gap crosses the mines on row 0 or 1. `damage.beams_pass_mines: true` means nobody shoots the charges away. **PR #2: 34/40, avg r6.6 (r3-11), with 36 mine hits in all. The other 6 games were won before r10.** |
| charge | round 16 | itself; doom seed_a by round 21 | **PR #2: reached in 18/40; the doom killed seed_a in 8/40.** |
| seed_b_leaves (outcome) | seed_a destroyed | - | seed_b withdraws. **PR #2: 33/40 withdrew; seed_b had already been killed in 7/40.** |
| flavor | choke (enemy in the choke zone), second_seed | - | PR #2: r3.3 and r6.7 respectively. |

**Mines and lasers [PR #2 --sloppy]:** in the first PR #2 run (3692a82) a laser stopped on any
mine in its line, and the stock AI shot all four charges by round 5 (only 2 mine hits in 40
games). With `damage.beams_pass_mines` that is fixed: `--sloppy` now gives 39 mine hits in 40
games and first_mine fires in 34/40.

**Difficulty:** normal. **[PR #2 --no-rails]**: 30 wins / 10 losses. Kestrel dies 10/40 and Sparrow 36/40.

## Chapter 3: The Splitting (ch3_splitting, radius 9)

**[main] buildRules: 0 problems.**
- Kestrel@ch3: 4 segments, 2 lasers, 4 shields, 4 missiles, sensor 6, signature 4.
- Twin: 6 segments, thrust 6, sensor 6, signature 5, 3 lasers, 6 shields, 2 PD, 3 missiles, 35 hull points.
- The split pieces and the li_wing group also each pass buildRules as fleets:
  - twin_a at [3,-7] and twin_b at [4,-8].
  - twin_b's core is grown in the free bay of its first cell, [1,-1], exactly as PR #2's split() does.
  - The documented hulls twin_a@ch3 and twin_b@ch3 match the pieces the engine builds.

| beat | condition | fallback | numbers |
|---|---|---|---|
| rails | start | - | Kestrel is protected until `kestrel_exposed` (2 rounds after li). Sparrow is protected until the end. |
| split | the Twin sees Kestrel, or Twin hull below 75 | round 4 | Gap 13. The Twin sees Kestrel at 6+4 = 10 exactly and 13 fuzzy, so it has a fuzzy contact from turn 1. It walks 1 hex a turn (6 thrust, 6 segments). Kestrel sees the Twin at 6+5 = 11. **PR #2: r3 in 40/40 (natural).** |
| despair | split and (2 player missiles stopped, or Kestrel hull below 60) | round 6 | After the split there are 2 PD mounts (1 per half), and Kestrel has 4 missiles. The cluster blocks lines from the north to Kestrel's start cells, so Kestrel's hull rarely drops. **PR #2: r6 in 40/40 (fallback). The first PD stop came at r6-7 (40/40).** |
| li_arrives | the player's turn, at least 1 turn after despair | round 7 | Spawns Halcyon at [6,-9] and Tern at [8,-9] (exact `at` spots, all cells in li_arrival). twin_a turns to the newcomers, twin_b keeps pressing Kestrel. **PR #2: r6 in 40/40.** |
| kestrel_exposed | 2 rounds after li_arrives | - | Ends Kestrel's protection. **PR #2: r8.** |
| flank_open | 1 turn after li_arrives | - | **PR #2: r7.** |
| charge | round 18 | itself; doom twin_a by round 23 | **PR #2: reached in 5/40, and the doom ended those 5.** Before the doom was added, 5/40 games were draws on the turn limit. |
| twin_b_leaves (outcome) | twin_a destroyed | - | **PR #2: 40/40, avg r10.8 (r9-23); 35 by r10, 5 by the r23 doom.** |

**Difficulty:** hard until li arrives, then a turn. **[PR #2 --no-rails]**: 40/40 wins and Kestrel never dies (the cover works), but Sparrow dies in 40/40.

## Chapter 4A: Ashfall (ch4a_ashfall, radius 8)

**[main] buildRules: 0 problems.**
- Husks: husk_1 has 1 segment and 1 laser (4 hull points). husk_2 has 2 segments, stealth and no weapon (8). husk_3 has 1 segment and no weapon (5).
- The canonical grafted hull kestrel@ch5 is checked to be exactly:
  - kestrel@ch4a + tern@ch3, with Tern at offset [-1,1] and touching;
  - Tern's core fused into a coupling;
  - `joined: true` and `seams: [{kind: weave, with: tern, cells}]`.

| beat | condition | fallback | numbers |
|---|---|---|---|
| rails | start | - | All four human ships are protected until the end (one protect per ship). |
| husks_dark | round 6 and no gift yet | - (it is gift's fallback) | The husks still on the board are removed ("dark"). **PR #2: 34/40.** |
| gift | all husks destroyed, or a player ship in the outpost ring, or husks_dark | husks_dark at r6 | Sparrow and Kestrel start 5 hexes from the ring. **PR #2: avg r5.5 (r3-6).** Unlocks graft. |
| tow | 2 rounds after the gift and not yet grafted | - (it is grafted's fallback) | Locks Kestrel and Tern, and forces Tern `move_toward: kestrel` each turn. Tern moves 2 hexes a turn and starts 1 hex from Kestrel. **PR #2: needed in 40/40 with the stock stand-in, 9/40 with `--graft`.** |
| grafted | the player grafted Kestrel and Tern, or (after the gift) docked them, or tow done and the two within 1 hex | - | The scripted `graft: [kestrel, tern]` runs only once they touch, because PR #2's join() refuses ships that are not touching. **PR #2: 40/40, r5-9. With `--graft`: 40/40, r4-9 (31 by the player's own order).** It then plays the outro and ends with a win. |
| flavor | too_easy (a husk destroyed) | - | PR #2: 34/40, r3-5. |

**Docking:** docking was earned in ch3, and the play screen offers "Dock tern". A dock now
also ends the chapter, once the gift has played. A scripted check: dock at r1, then the gift
and grafted beats both fire at r6, and the chapter is won. Without this the chapter stalled.

**[PR #2] carry-over:**
- `applyResult` carries Kestrel out with its 6-segment joined hull and seams, and drops Tern from the roster.
- ch5 still flies the canonical kestrel@ch5, because `<id>@<this chapter>` wins in hullFor.

**Difficulty:** breather. Nothing can die, and the husks have 1 laser between them.

## Chapter 5: The Bloom (ch5_bloom, radius 10)

**[main] buildRules: 0 problems** (checked with the Bloom in place at [4,-8]).
- Kestrel@ch5: 6 segments, thrust 7, sensor 8, signature 6, 4 lasers, 5 shields, 1 PD, 4 missiles, 38 hull points.
- Bloom: 7 segments, sensor 8, signature 5, 3 lasers, 7 shields, 3 PD, 6 missiles, 41 hull points.

**[PR #2] load:** the Bloom is loaded as a *reserve flagship*, and the chapter cannot be won while it waits.

| beat | condition | fallback | numbers |
|---|---|---|---|
| rails | start | - | Kestrel, Halcyon and Sparrow are protected until the cliff. The siege profile uses `only_targets: [sparrow, halcyon]` (PR #2), so the Bloom never fires at Kestrel. |
| arrival | round 2 | - | Spawns the Bloom at [4,-8], 13 from Kestrel, and lights it for 2 rounds. `set_rule` cuts comms link to 3 and core link to 2 (the rules are rebuilt). **PR #2: r2 in 40/40.** |
| seam_wakes | Kestrel fires at the Bloom, or comes within 6 of it | round 5 | Kestrel's laser reaches 8, so it needs 5+ hexes of closing at ~1 hex a turn (6 thrust a hex). The siege profile holds still. Effects: locks Kestrel, disables its shields and PD, lights it for 99 rounds, and forces `move_toward: bloom` each turn. **PR #2: r5 in 40/40, by the fallback: the stand-in never closed in.** Forced moves were seen in r5 and r6. |
| li_moves | Halcyon within 2 of Kestrel, at least 1 turn after the seam | 2 rounds after the seam (r7 at the latest) | Halcyon starts 4 from Kestrel, cap 2 a turn. **PR #2: r6 in 40/40.** |
| cliff | li_moves | - | `end: to_be_continued`, which plays `scenes.tbc` = ch5_cliff. **PR #2: r6, 40/40 to_be_continued.** |
| flavor | li_coming (1 turn after the seam) | - | PR #2: r5. |

**Difficulty:** scripted. Nothing can die before the cliff. The siege AI lands at most 2 hits a round.

## Browser run [browser]

Setup:
- A temporary merge of campaign-v1 into campaign-engine 7f51643. It merged cleanly; only
  campaign/tools changed.
- Served with `python3 -m http.server`, played in Chromium through Playwright.
- Command: `node campaign/tools/browser_story.cjs http://localhost:8765/play.html --fix-fork`,
  plus `--graft-only`.

Loading and the map:
- **The campaign files load.** ui/campaign.js reads `campaign/campaign.yaml`, then each
  `campaign/<node.file>`, `campaign/<chapter.map>` and `rules/<chapter.world>`. Every path
  resolves (HTTP 200).
- **The map from a fresh save:** First Contact is open. Quiet Water, The Splitting, Ashfall
  and The Bloom are "not yet". The Long Dark is locked and shows "Signal lost".

Playing every chapter from the map:
- The player's side is driven by `campaignMove` through `window.__shatkon.act`.
- Every scene arrives as a text card, in this order: ch1_intro ch1_contact ch1_finch_down
  ch1_victory ch1_salvage ch2_intro ch2_contact ch2_first_mine ch2_victory ch2_salvage
  ch3_intro ch3_split ch3_despair ch3_li_arrives ch3_victory ch3_reunion **ch4_fork**
  ch4a_intro ch4a_graft_found ch4a_outro ch5_intro ch5_bloom ch5_seam_wakes ch5_li_moves
  ch5_cliff. That is all 25 chapter scenes, plus the fork card.
- Results:
  - ch1: win, r8.
  - ch2: win, r10 (r19-21 in earlier runs: the UI seeds each game from the clock).
  - ch3: win, r9.
  - ch4A: win (grafted), r8.
  - ch5: to_be_continued, r6.
- Saved progress after each chapter matches applyResult:
  - Finch is gone after ch1.
  - Halcyon and Tern join after ch3.
  - After ch4A, Kestrel carries a 6-segment hull and Tern is gone; the fork choice is ch4a.
- The objective banner showed each of the 13 `objective:` strings as it was set.

The Graft button (`--graft-only`):
- ch4A was started from a prepared save, and the player held still until the gift beat (r6).
- With Kestrel selected and touching Tern, the tool bar shows **"Graft tern · fuse into one
  ship"**, and also "Dock tern", because docking was earned in ch3.
- Clicking Graft grafts the two ships, plays ch4a_outro and wins the chapter.

**Console:** no script errors or warnings. The only console errors are 34 "404 Not Found"
loads, all under `story/`: player.js, bark.js, scenes/<id>.json, img/stages/campaign_map.webp.
The story developer has not delivered that folder yet, and the UI falls back to text cards as
designed.

**UI bug found (not fixable in campaign/):** after ch4A, **The Bloom shows as locked**.
`drawMap`'s `nodeState` treats *every* open node other than `progress.choices.fork` as locked,
not just the fork's siblings (ch4a / ch4b). ch5 is open but is not the fork choice, so it
greys out and the campaign cannot be finished from the map. The browser run used
`--fix-fork`, which clears `choices.fork` from the save, to reach ch5; ch5 then played to the
cliff. Suggested fix in ui/campaign.js: lock only nodes that are in the `next` of the node with
`fork_scene`, e.g. `const forkKids = new Set(C.nodes.filter((p) => p.fork_scene).flatMap((p) => p.next || []))`
and `(chosen && forkKids.has(n.id) && n.id !== chosen && open.has(n.id))`.

## Appendix A: [main] `node campaign/tools/check.mjs` (full output)

    
    ## ch1 "First Contact"  (maps/ch1_corridor.yaml, radius 7)
      ok: hulls (loader rule <id>@<chapter>): kestrel=kestrel@ch1, sparrow=sparrow@ch1, finch=finch@ch1, seed=seed@ch1
      world_overrides: {"turns.turn_limit":20}
      ok: buildRules: 0 problems
      ships:
        P kestrel  segs 3  thrust 4  sensor 6  signature 3  link 4  hull hp 24  lasers 3  shields 0  PD 0  load {}  FLAGSHIP
        P sparrow  segs 1  thrust 1  sensor 4  signature 1  link 4  hull hp 6  lasers 1  shields 0  PD 0  load {}
        P finch    segs 1  thrust 1  sensor 4  signature 1  link 4  hull hp 6  lasers 1  shields 0  PD 0  load {}
        W seed     segs 2  thrust 2  sensor 4  signature 2  link 4  hull hp 12  lasers 1  shields 2  PD 0  load {"missile":2}  FLAGSHIP
        Human fleet: thrust 6 for 5 segments -> move cap 2 hexes a turn
        Weave fleet: thrust 2 for 2 segments -> move cap 2 hexes a turn
      start: gap / W sees P at / P sees W at (exact; fuzzy +3)
        seed - kestrel: 12 / 7 / 8
        seed - sparrow: 10 / 5 / 6
        seed - finch: 9 / 5 / 6
      ok: zones: corridor_mid (11)
      ok: script: 7 entries; every beat has a condition and a guaranteed fallback: rails, contact, finch_down, charge
      win {"destroyed":"seed"}: guaranteed by a doom / fallback
    
      Board (# asteroid, ~ nebula, M mine, X Weave, capitals = human ships by initial; lower case = zones: :=corridor_mid; ships drawn over zones)
    ```
     -7        # . . . . . . #
     -6       # # . X X . . # #
     -5      # # # . . . . # # #
     -4     # # # # . . . # # # #
     -3    # # # # . . . . # # # #
     -2   # # # # # . . . # # # # #
     -1  # # # # # : : : : # # # # #
      0 # # # # # # : : : # # # # # #
      1  # # # # # : : : : # # # # #
      2   # # # # # . . . # # # # #
      3    # # # # . F . . # # # #
      4     # # # # S . . # # # #
      5      # # # . . . . # # #
      6       # # . K K K . # #
      7        # . . . . . . #
    ```
    
    ## ch2 "Quiet Water"  (maps/ch2_quiet_water.yaml, radius 8)
      ok: hulls (loader rule <id>@<chapter>): kestrel=kestrel@ch2, sparrow=sparrow@ch1, seed_a=seed_a@ch2, seed_b=seed_b@ch2
      note: world_overrides: "damage.beams_pass_mines" is a PR #2 world setting (not in main's world file; main's engine ignores it)
      world_overrides: {"turns.turn_limit":22,"munitions.mine.signature":-12,"damage.beams_pass_mines":true}
      ok: buildRules: 0 problems
      ships:
        P kestrel  segs 3  thrust 3  sensor 6  signature 3  link 4  hull hp 24  lasers 2  shields 0  PD 0  load {"missile":2}  FLAGSHIP
        P sparrow  segs 1  thrust 1  sensor 4  signature 1  link 4  hull hp 6  lasers 1  shields 0  PD 0  load {}
        W seed_a   segs 2  thrust 2  sensor 4  signature 2  link 4  hull hp 12  lasers 1  shields 2  PD 0  load {"missile":2}  FLAGSHIP
        W seed_b   segs 2  thrust 2  sensor 4  signature 2  link 4  hull hp 12  lasers 1  shields 2  PD 0  load {"missile":1}
        Human fleet: thrust 4 for 4 segments -> move cap 2 hexes a turn
        Weave fleet: thrust 4 for 4 segments -> move cap 2 hexes a turn
      start: gap / W sees P at / P sees W at (exact; fuzzy +3)
        seed_a - kestrel: 12 / 7 / 8
        seed_a - sparrow: 13 / 5 / 6
        seed_b - kestrel: 11 / 7 / 8
        seed_b - sparrow: 12 / 5 / 6
      ok: zones: choke (17), minefield (4), west_slot (2)
      ok: script: 9 entries; every beat has a condition and a guaranteed fallback: rails, contact, herd, mine_fallback, first_mine, charge
      win {"destroyed":"seed_a"}: guaranteed by a doom / fallback
    
      Board (# asteroid, ~ nebula, M mine, X Weave, capitals = human ships by initial; lower case = zones: c=choke, m=minefield, w=west_slot; ships drawn over zones)
    ```
     -8         . . . . . . . . .
     -7        . . . . X X . . . .
     -6       . . . X X . . . . . .
     -5      . . . . . . . . . # . .
     -4     . . . . . . ~ # . . . . .
     -3    . . . . c c c c . . . . . .
     -2   . # . . . c c c . . . . . . .
     -1  . . . . . . c M . . . . . . . .
      0 w # # # # # # M c M # # # # # # #
      1  w # # # # # # c M # # # # # # #
      2   . . . . . . . c c c . . . . .
      3    . . . . . . . . . . . . # .
      4     . . . . # . . . . . . . .
      5      . . . . . K K K . . . .
      6       . . . S . . . . . . .
      7        . . . . . . # . . .
      8         . . . . . . . . .
    ```
    
    ## ch3 "The Splitting"  (maps/ch3_splitting.yaml, radius 9)
      ok: hulls (loader rule <id>@<chapter>): kestrel=kestrel@ch3, sparrow=sparrow@ch3, twin=twin@ch3, halcyon=halcyon@ch3, tern=tern@ch3
      world_overrides: {"turns.turn_limit":24}
      ok: buildRules: 0 problems
      ships:
        P kestrel  segs 4  thrust 4  sensor 6  signature 4  link 4  hull hp 25  lasers 2  shields 4  PD 0  load {"missile":4}  FLAGSHIP
        P sparrow  segs 1  thrust 1  sensor 4  signature 1  link 4  hull hp 6  lasers 1  shields 1  PD 0  load {}
        W twin     segs 6  thrust 6  sensor 6  signature 5  link 4  hull hp 35  lasers 3  shields 6  PD 2  load {"missile":3}  FLAGSHIP
        Human fleet: thrust 5 for 5 segments -> move cap 2 hexes a turn
        Weave fleet: thrust 6 for 6 segments -> move cap 2 hexes a turn
      start: gap / W sees P at / P sees W at (exact; fuzzy +3)
        twin - kestrel: 13 / 10 / 11
        twin - sparrow: 13 / 7 / 9
      ok: zones: li_arrival (8), cover (8)
      ok: group li_wing: buildRules 0 problems as a standalone fleet (home-zone check replaced by zone li_arrival)
      ok: group li_wing: every "at" cell is inside zone li_arrival
      ok: split twin -> twin_a at [3,-7] + twin_b at [4,-8] (core grown at [1,-1]): buildRules 0 problems at the Twin's start hex; matches the ships.yaml piece hulls
      ok: script: 10 entries; every beat has a condition and a guaranteed fallback: rails, split, despair, li_arrives, kestrel_exposed, flank_open, charge
      win {"destroyed":"twin_a"}: guaranteed by a doom / fallback
    
      Board (# asteroid, ~ nebula, M mine, X Weave, capitals = human ships by initial; lower case = zones: l=li_arrival, ,=cover; ships drawn over zones)
    ```
     -9          . . . . . X H H T T
     -8         . . . . . X X H l l l
     -7        . . . . . X X . . . . .
     -6       . . . . . . X . . # . . .
     -5      . . . . . # . . . . . . . .
     -4     . . . . . . . . . . . . . . .
     -3    . . . # . . . . . . . # . . . .
     -2   . . . . . . . # . . . # . . . . .
     -1  . . # . . . . . . . . . . . . . . .
      0 . . . . . . . . . . . # . . . . . . .
      1  . . . . # . . . . . . . . . . . . .
      2   . . . # . . . . # # . . . . . . .
      3    . . . . . . . # # # . . # . . .
      4     . . . . . . # # # # . . . . .
      5      . . # . . , # # # , . . . .
      6       . . . . , # # # , . . . .
      7        . . . . , K , , S . . .
      8         . . . . K K K . . . .
      9          . . . . . . . . . .
    ```
    
    ## ch4a "Ashfall"  (maps/ch4a_ashfall.yaml, radius 8)
      ok: hulls (loader rule <id>@<chapter>): kestrel=kestrel@ch4a, sparrow=sparrow@ch3, halcyon=halcyon@ch3, tern=tern@ch3, husk_1=husk_1@ch4a, husk_2=husk_2@ch4a, husk_3=husk_3@ch4a
      world_overrides: {"turns.turn_limit":15}
      ok: buildRules: 0 problems
      ships:
        P kestrel  segs 4  thrust 4  sensor 6  signature 4  link 4  hull hp 24  lasers 2  shields 4  PD 1  load {"missile":4}  FLAGSHIP
        P sparrow  segs 1  thrust 1  sensor 4  signature 1  link 4  hull hp 6  lasers 1  shields 1  PD 0  load {}
        P halcyon  segs 3  thrust 3  sensor 4  signature 3  link 12  hull hp 18  lasers 2  shields 3  PD 0  load {"missile":2,"seeker_drone":1}
        P tern     segs 2  thrust 3  sensor 4  signature 2  link 4  hull hp 14  lasers 2  shields 1  PD 0  load {}
        W husk_1   segs 1  thrust 1  sensor 4  signature 1  link 4  hull hp 4  lasers 1  shields 0  PD 0  load {}  FLAGSHIP
        W husk_2   segs 2  thrust 2  sensor 4  signature 1  link 4  hull hp 8  lasers 0  shields 0  PD 0  load {}
        W husk_3   segs 1  thrust 1  sensor 4  signature 1  link 4  hull hp 5  lasers 0  shields 0  PD 0  load {}
        Human fleet: thrust 11 for 10 segments -> move cap 2 hexes a turn
        Weave fleet: thrust 4 for 4 segments -> move cap 2 hexes a turn
      start: gap / W sees P at / P sees W at (exact; fuzzy +3)
        husk_1 - kestrel: 9 / 8 / 7
        husk_1 - sparrow: 9 / 5 / 5
        husk_1 - halcyon: 10 / 7 / 5
        husk_1 - tern: 9 / 6 / 5
        husk_2 - kestrel: 9 / 8 / 7
        husk_2 - sparrow: 9 / 5 / 5
        husk_2 - halcyon: 10 / 7 / 5
        husk_2 - tern: 10 / 6 / 5
        husk_3 - kestrel: 12 / 8 / 7
        husk_3 - sparrow: 12 / 5 / 5
        husk_3 - halcyon: 13 / 7 / 5
        husk_3 - tern: 12 / 6 / 5
      ok: zones: outpost (6)
      ok: graft [kestrel, tern] -> canonical kestrel@ch5: tern at offset [-1,1] (rear), parts, cells and seams match (built at ch5 below)
      ok: script: 6 entries; every beat has a condition and a guaranteed fallback: rails, husks_dark, gift, tow, grafted
      win {"grafted":["kestrel","tern"]}: must be earned in play (or ends through a scripted end)
    
      Board (# asteroid, ~ nebula, M mine, X Weave, capitals = human ships by initial; lower case = zones: o=outpost; ships drawn over zones)
    ```
     -8         . . . . . . . . .
     -7        . . . . . . . . . .
     -6       . . . X . . ~ ~ . . .
     -5      . . . . . . . . . . . .
     -4     . . . . . . . . . . . . .
     -3    . . X X . . . X # . . . . .
     -2   . ~ . . . . # . # . . . . . .
     -1  . ~ ~ . . . # o o # . . . . . .
      0 . . . . . . . o # o . . . . . . .
      1  . . . . . . # o o # . . . . . .
      2   . . . . . . # . . . . . . . .
      3    . . . . . . . # . . . . . .
      4     . . . . . . . . . . . . .
      5      . . . . . . . . . . . .
      6       . . S . . K . T T . .
      7        . H H . K K K . . .
      8         . H . . . . . . .
    ```
    
    ## ch4b "The Long Dark": no battle (locked: true, "Signal lost")
    
    ## ch5 "The Bloom"  (maps/ch5_bloom.yaml, radius 10)
      ok: hulls (loader rule <id>@<chapter>): kestrel=kestrel@ch5, halcyon=halcyon@ch3, sparrow=sparrow@ch3, bloom=bloom@ch5
      world_overrides: {"turns.turn_limit":12}
      ok: buildRules: 0 problems (enemy side checked with its spawn groups in place: it starts empty)
      ships:
        P kestrel  segs 6  thrust 7  sensor 8  signature 6  link 4  hull hp 38  lasers 4  shields 5  PD 1  load {"missile":4}  FLAGSHIP
        P halcyon  segs 3  thrust 3  sensor 4  signature 3  link 12  hull hp 18  lasers 2  shields 3  PD 0  load {"missile":2,"seeker_drone":1}
        P sparrow  segs 1  thrust 1  sensor 4  signature 1  link 4  hull hp 6  lasers 1  shields 1  PD 0  load {}
        W bloom    segs 7  thrust 6  sensor 8  signature 5  link 4  hull hp 41  lasers 3  shields 7  PD 3  load {"missile":6}  FLAGSHIP
        Human fleet: thrust 11 for 10 segments -> move cap 2 hexes a turn
        Weave fleet: thrust 6 for 7 segments -> move cap 1 hexes a turn
      start: gap / W sees P at / P sees W at (exact; fuzzy +3)
        bloom - kestrel: 13 / 11 / 11
        bloom - halcyon: 13 / 8 / 7
        bloom - sparrow: 13 / 6 / 7
      ok: zones: bloom_entry (16)
      ok: group bloom_arrival: buildRules 0 problems as a standalone fleet (home-zone check replaced by zone bloom_entry)
      ok: group bloom_arrival: every "at" cell is inside zone bloom_entry
      ok: script: 6 entries; every beat has a condition and a guaranteed fallback: rails, arrival, seam_wakes, li_moves, cliff
    
      Board (# asteroid, ~ nebula, M mine, X Weave, capitals = human ships by initial; lower case = zones: b=bloom_entry; ships drawn over zones)
    ```
    -10           . . . . b b b . . . .
     -9          . . . . b X X b . . . .
     -8         . . . . b X X X b . . . .
     -7        ~ ~ ~ ~ ~ b X X b ~ ~ ~ ~ ~
     -6       ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ # ~ ~
     -5      . . . ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ . . .
     -4     . . . . . . . . . . . . . . . . .
     -3    . . . . . . . . . . . . . . # . . .
     -2   . . . . . . . . . . . . . . . . . . .
     -1  # . . . . . . # . . . . . . # . . . . .
      0 . . . . # . . . . . . . . . . . . . . . .
      1  . . . . . . . . . . . . . . . . . . . .
      2   . . . . . . . . . . . . # . . . . . .
      3    . . . . . . . # . . # . . . . . . .
      4     . . . # . . . . . . . . . . . . .
      5      . . . . . . . . . . . . . . . .
      6       . . . . S . . K . . . . H H .
      7        . . . . . . K K K . . . H .
      8         . . . . . . K K . . . . .
      9          . . . . . . . . . . . .
     10           . . . . . . . . . . .
    ```
    
    ## Shared ids
      ok: all 29 shared scene ids are used
      ok: all 19 shared bark ids are used
      final roster: ["kestrel","sparrow","halcyon"]
      final capabilities: core, engine, sensor, laser, armour, coupling, launcher, magazine, missile, mine, shield, point_defence, comms, seeker_drone, docking, graft
    
    ALL CHECKS PASSED

## Appendix B: [PR #2 7f51643] `engine_check.mjs --games 40` (rails on)

    PR #2 engine: <campaign-engine worktree>  (games per chapter 40, seeds 1..40)
    
    ## ch1: buildChapter problems: none
      progress in: roster ["kestrel","sparrow","finch"], capabilities 6, completed []
      fleets: kestrel* sparrow finch  vs  seed*
      results: {"win":40}; rounds played avg 8.0 (min 8, max 8)
      beats fired (games / 40, round avg / min / max):
        rails             40  1.0 / 1 / 1
        contact           40  1.0 / 1 / 1
        seed_shield       40  2.0 / 2 / 2  (flavor)
        finch_hit         35  1.0 / 1 / 1  (flavor)
        finch_down        40  4.0 / 4 / 4
        seed_closing      40  5.0 / 5 / 5  (flavor)
        charge             0  -
      destroyed / removed (games): {"finch":40,"seed":40}; of those by a doom fallback: {"finch":40}
      enemy mine hits 0; player missiles stopped by PD 0; kestrel+tern grafted in 0 games
      script_unknown / script_failed events: none
      progress out (from a won game): roster ["kestrel","sparrow"]
    
    ## ch2: buildChapter problems: none
      progress in: roster ["kestrel","sparrow"], capabilities 10, completed ["ch1"]
      fleets: kestrel* sparrow  vs  seed_a* seed_b
      results: {"win":40}; rounds played avg 13.7 (min 6, max 21)
      beats fired (games / 40, round avg / min / max):
        rails             40  1.0 / 1 / 1
        contact           40  2.3 / 1 / 3
        choke             40  3.3 / 2 / 8  (flavor)
        herd              26  6.0 / 6 / 6
        mine_fallback     11  10.0 / 10 / 10
        first_mine        34  6.6 / 3 / 11
        second_seed       32  6.7 / 3 / 11  (flavor)
        charge            18  16.0 / 16 / 16
        seed_b_leaves     40  13.7 / 6 / 21  (outcome)
      destroyed / removed (games): {"seed_a":40,"seed_b(withdraw)":33,"seed_b":7}; of those by a doom fallback: {"seed_a":8}
      enemy mine hits 36; player missiles stopped by PD 0; kestrel+tern grafted in 0 games
      script_unknown / script_failed events: none
      progress out (from a won game): roster ["kestrel","sparrow"]
    
    ## ch3: buildChapter problems: none
      progress in: roster ["kestrel","sparrow"], capabilities 11, completed ["ch1","ch2"]
      fleets: kestrel* sparrow halcyon(reserve) tern(reserve)  vs  twin*
      results: {"win":40}; rounds played avg 10.8 (min 9, max 23)
      beats fired (games / 40, round avg / min / max):
        rails             40  1.0 / 1 / 1
        split             40  3.0 / 3 / 3
        pd_stopped        40  7.0 / 7 / 7  (flavor)
        hull_low           0  -  (flavor)
        despair           40  6.0 / 6 / 6
        li_arrives        40  6.0 / 6 / 6
        kestrel_exposed   40  8.0 / 8 / 8
        flank_open        40  7.0 / 7 / 7
        charge             5  18.0 / 18 / 18
        twin_b_leaves     40  10.8 / 9 / 23  (outcome)
      destroyed / removed (games): {"twin_a":40,"twin_b(withdraw)":40}; of those by a doom fallback: {"twin_a":5}
      enemy mine hits 0; player missiles stopped by PD 40; kestrel+tern grafted in 0 games
      script_unknown / script_failed events: none
      progress out (from a won game): roster ["kestrel","sparrow","halcyon","tern"]
    
    ## ch4a: buildChapter problems: none
      progress in: roster ["kestrel","sparrow","halcyon","tern"], capabilities 15, completed ["ch1","ch2","ch3"]
      fleets: kestrel* sparrow halcyon tern  vs  husk_1* husk_2 husk_3
      results: {"win":40}; rounds played avg 7.6 (min 5, max 9)
      beats fired (games / 40, round avg / min / max):
        rails             40  1.0 / 1 / 1
        too_easy          34  3.4 / 3 / 5  (flavor)
        husks_dark        34  6.0 / 6 / 6
        gift              40  5.5 / 3 / 6
        tow               40  7.5 / 5 / 8
        grafted           40  7.6 / 5 / 9
      destroyed / removed (games): {"husk_1":28,"husk_2(dark)":5,"husk_3(dark)":34,"husk_2":30,"husk_1(dark)":6}; of those by a doom fallback: {}
      enemy mine hits 0; player missiles stopped by PD 0; kestrel+tern grafted in 40 games
      script_unknown / script_failed events: none
      progress out (from a won game): roster ["kestrel(carried 6-segment hull)","sparrow","halcyon"]
    
    ## ch5: buildChapter problems: none
      progress in: roster ["kestrel(carried hull)","sparrow","halcyon"], capabilities 16, completed ["ch1","ch2","ch3","ch4a"]
      fleets: kestrel* halcyon sparrow  vs  bloom*(reserve)
      results: {"to_be_continued":40}; rounds played avg 6.0 (min 6, max 6)
      beats fired (games / 40, round avg / min / max):
        rails             40  1.0 / 1 / 1
        arrival           40  2.0 / 2 / 2
        seam_wakes        40  5.0 / 5 / 5
        li_coming         40  5.0 / 5 / 5  (flavor)
        li_moves          40  6.0 / 6 / 6
        cliff             40  6.0 / 6 / 6
      destroyed / removed (games): {}; of those by a doom fallback: {}
      enemy mine hits 0; player missiles stopped by PD 0; kestrel+tern grafted in 0 games
      script_unknown / script_failed events: none
      progress out (from a won game): roster ["kestrel(carried 6-segment hull)","sparrow","halcyon"]

## Appendix C: [PR #2] `--no-rails` (difficulty without protect)

    PR #2 engine: <campaign-engine worktree>  (games per chapter 40, seeds 1..40, NO protect actions)
    
    ## ch1: buildChapter problems: none
      results: {"win":40}; rounds played avg 5.0 (min 5, max 5)
      beats fired (games / 40, round avg / min / max):
        rails             40  1.0 / 1 / 1
        contact           40  1.0 / 1 / 1
        seed_shield       40  2.0 / 2 / 2  (flavor)
        finch_hit         35  1.0 / 1 / 1  (flavor)
        finch_down        40  4.0 / 4 / 4
        seed_closing       0  -  (flavor)
        charge             0  -
      destroyed / removed (games): {"sparrow":40,"finch":40,"seed":40}; of those by a doom fallback: {"finch":40}
      enemy mine hits 0; player missiles stopped by PD 0; kestrel+tern grafted in 0 games
      script_unknown / script_failed events: none
    
    ## ch2: buildChapter problems: none
      results: {"lose":10,"win":30}; rounds played avg 10.8 (min 6, max 19)
      beats fired (games / 40, round avg / min / max):
        rails             40  1.0 / 1 / 1
        contact           40  2.3 / 1 / 3
        choke             40  3.2 / 2 / 8  (flavor)
        herd              25  6.0 / 6 / 6
        mine_fallback      6  10.0 / 10 / 10
        first_mine        34  6.1 / 3 / 11
        second_seed       29  5.9 / 3 / 10  (flavor)
        charge             6  16.0 / 16 / 16
        seed_b_leaves     30  10.0 / 6 / 19  (outcome)
      destroyed / removed (games): {"kestrel":10,"sparrow":36,"seed_a":30,"seed_b(withdraw)":26,"seed_b":8}; of those by a doom fallback: {}
      enemy mine hits 41; player missiles stopped by PD 0; kestrel+tern grafted in 0 games
      script_unknown / script_failed events: none
    
    ## ch3: buildChapter problems: none
      results: {"win":40}; rounds played avg 11.6 (min 7, max 23)
      beats fired (games / 40, round avg / min / max):
        rails             40  1.0 / 1 / 1
        split             40  3.0 / 3 / 3
        pd_stopped         6  7.0 / 7 / 7  (flavor)
        hull_low           0  -  (flavor)
        despair           40  6.0 / 6 / 6
        li_arrives        40  6.0 / 6 / 6
        kestrel_exposed   35  8.0 / 8 / 8
        flank_open        40  7.0 / 7 / 7
        charge             6  18.0 / 18 / 18
        twin_b_leaves     40  11.6 / 7 / 23  (outcome)
      destroyed / removed (games): {"sparrow":40,"twin_a":40,"twin_b(withdraw)":40}; of those by a doom fallback: {"twin_a":6}
      enemy mine hits 0; player missiles stopped by PD 6; kestrel+tern grafted in 0 games
      script_unknown / script_failed events: none
    
    ## ch4a: buildChapter problems: none
      results: {"win":40}; rounds played avg 7.6 (min 5, max 9)
      beats fired (games / 40, round avg / min / max):
        rails             40  1.0 / 1 / 1
        too_easy          34  3.4 / 3 / 5  (flavor)
        husks_dark        34  6.0 / 6 / 6
        gift              40  5.5 / 3 / 6
        tow               40  7.5 / 5 / 8
        grafted           40  7.6 / 5 / 9
      destroyed / removed (games): {"husk_1":28,"husk_2(dark)":5,"husk_3(dark)":34,"husk_2":30,"husk_1(dark)":6}; of those by a doom fallback: {}
      enemy mine hits 0; player missiles stopped by PD 0; kestrel+tern grafted in 40 games
      script_unknown / script_failed events: none
    
    ## ch5: buildChapter problems: none
      results: {"to_be_continued":40}; rounds played avg 6.0 (min 6, max 6)
      beats fired (games / 40, round avg / min / max):
        rails             40  1.0 / 1 / 1
        arrival           40  2.0 / 2 / 2
        seam_wakes        40  5.0 / 5 / 5
        li_coming         40  5.0 / 5 / 5  (flavor)
        li_moves          40  6.0 / 6 / 6
        cliff             40  6.0 / 6 / 6
      destroyed / removed (games): {}; of those by a doom fallback: {}
      enemy mine hits 0; player missiles stopped by PD 0; kestrel+tern grafted in 0 games
      script_unknown / script_failed events: none

## Appendix D: [PR #2] ch2 `--sloppy` (human stand-in may shoot its own mines)

    ## ch2: buildChapter problems: none
      progress in: roster ["kestrel","sparrow"], capabilities 10, completed ["ch1"]
      fleets: kestrel* sparrow  vs  seed_a* seed_b
      results: {"win":40}; rounds played avg 13.9 (min 6, max 21)
      beats fired (games / 40, round avg / min / max):
        rails             40  1.0 / 1 / 1
        contact           40  2.3 / 1 / 3
        choke             40  3.3 / 2 / 8  (flavor)
        herd              25  6.0 / 6 / 6
        mine_fallback      9  10.0 / 10 / 10
        first_mine        34  6.4 / 3 / 11
        second_seed       33  6.6 / 3 / 11  (flavor)
        charge            19  16.0 / 16 / 16
        seed_b_leaves     40  13.9 / 6 / 21  (outcome)
      destroyed / removed (games): {"seed_a":40,"seed_b(withdraw)":32,"seed_b":8}; of those by a doom fallback: {"seed_a":9}
      enemy mine hits 39; player missiles stopped by PD 0; kestrel+tern grafted in 0 games
      script_unknown / script_failed events: none
      

## Appendix E: [PR #2] ch4A `--graft` (human stand-in grafts itself)

    ## ch4a: buildChapter problems: none
      progress in: roster ["kestrel","sparrow","halcyon","tern"], capabilities 15, completed ["ch1","ch2","ch3"]
      fleets: kestrel* sparrow halcyon tern  vs  husk_1* husk_2 husk_3
      results: {"win":40}; rounds played avg 6.2 (min 4, max 9)
      beats fired (games / 40, round avg / min / max):
        rails             40  1.0 / 1 / 1
        too_easy          34  3.4 / 3 / 5  (flavor)
        husks_dark        34  6.0 / 6 / 6
        gift              40  5.5 / 3 / 6
        tow                9  7.7 / 5 / 8
        grafted           40  6.2 / 4 / 9
      destroyed / removed (games): {"husk_1":28,"husk_2(dark)":5,"husk_3(dark)":34,"husk_2":30,"husk_1(dark)":6}; of those by a doom fallback: {}
      enemy mine hits 0; player missiles stopped by PD 0; kestrel+tern grafted in 40 games
      script_unknown / script_failed events: none
      

## Appendix F: [browser] `browser_story.cjs --fix-fork` and `--graft-only` output

    map nodes: [
     "cm-node open | First Contact (ready to play)",
     "cm-node later | Quiet Water (not yet)",
     "cm-node later | The Splitting (not yet)",
     "cm-node later | Ashfall (not yet)",
     "cm-node locked | The Long Dark (Signal lost)",
     "cm-node later | The Bloom (not yet)"
    ]
    ch1 over: win in round 8
      saved progress: completed ["ch1"] roster ["kestrel","sparrow"] choices {}
    ch2 over: win in round 10
      saved progress: completed ["ch1","ch2"] roster ["kestrel","sparrow"] choices {}
    ch3 over: win in round 9
      saved progress: completed ["ch1","ch2","ch3"] roster ["kestrel","sparrow","halcyon","tern"] choices {}
    ch4a over: win in round 8
      saved progress: completed ["ch1","ch2","ch3","ch4a"] roster ["kestrel(hull 6)","sparrow","halcyon"] choices {"fork":"ch4a"}
    WORKAROUND: clearing progress.choices.fork so The Bloom opens
    ch5 over: to_be_continued in round 6
      saved progress: completed ["ch1","ch2","ch3","ch4a","ch5"] roster ["kestrel(hull 6)","sparrow","halcyon"] choices {}
    map at the end: ["done First ContactReplay","done Quiet WaterReplay","done The SplittingReplay","done AshfallReplay","locked The Long DarkSignal lost","done The BloomReplay"]
    scenes shown: ch1_intro ch1_contact ch1_finch_down ch1_victory ch1_salvage ch2_intro ch2_contact ch2_first_mine ch2_victory ch2_salvage ch3_intro ch3_split ch3_despair ch3_li_arrives ch3_victory ch3_reunion ch4_fork ch4a_intro ch4a_graft_found ch4a_outro ch5_intro ch5_bloom ch5_seam_wakes ch5_li_moves ch5_cliff
    objectives: ch1: Scout the corridor. Keep the scouts ahead of Kestrel. || ch1: Unknown contact. Bring it down. || ch1: Finch is down. Lure the Seed onto Kestrel's lasers. || ch2: Hold south of the wall. Let them come through the gap. || ch3: Meridian is silent. Stay behind the rocks and survive. || ch3: Hold on. || ch3: Li is here. Hit twin_a while it turns. || ch4a: Ashfall Outpost is calling for help. Reach the outpost. || ch4a: Bring Tern alongside Kestrel and Graft them || ch4a: The rig is pulling Tern in. || ch5: Hold the line at the nebula front. || ch5: Engage the Bloom. || ch5: Kestrel isn't answering. Get Halcyon to Kestrel.
    (plus 34 console errors "Failed to load resource: 404", all story/ files)

    round 6 graft unlocked; Graft button: Graft ternfuse into one ship
      scene Scene · ch4a_outro
    grafted flag: true result: win
    console errors: none (only story/ 404s)
