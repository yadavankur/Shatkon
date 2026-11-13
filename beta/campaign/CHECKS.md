# CHECKS: Shatkon: The Weave, chapters 1-5 (campaign-v2, Combat v2)

All results are on branch `campaign-v2`: `origin/campaign-engine` **1afc785** (Combat v2), with
**7f90ce7** (story pack v2; `engine/` unchanged) merged in, plus campaign/ changes. The engine
checkout used is 7f90ce7. Run on 14 Nov 2026 (Sydney time).

- **[static]** `node campaign/tools/check.mjs`: buildRules per chapter on this branch's engine,
  plus the campaign lint (ids, names, order shapes, fallbacks). **ALL CHECKS PASSED**, with one
  note (`munitions.mine.strikes` is read by engine/damage.js but is not listed in the world file).
- **[engine]** `node campaign/tools/engine_check.mjs --engine <7f90ce7 checkout> --games 40`:
  every chapter through `buildChapter` / `applyResult`, 40 scripted AI-vs-AI games each (seeds
  1-40). The Weave follow the chapter's AI profiles; the human stand-in plays the stock normal AI.
- **[browser]** `campaign/tools/browser_story.cjs` on this tree, served over http.
- `node --test` (repo root): **64/64** pass.

Combat v2 numbers (rules/world_v0.4.yaml at 1afc785):
- **Laser:** 3 hits to 4 hexes, 2 from 5-8. +1 hit if the ship moved this turn
  (`attack_run_bonus`).
- **Shields:** a shield comes back only after a round in which it wasn't hit.
- **Missile:** speed 6, fuel 3, 3 hits. It flies in the flight phase at the end of the round.
- **Ram:** 4 hits × the rammer's living segments, piercing shields, starting at the target
  segment nearest the rammer.
- **Mine:** ch2 sets `strikes: engines` and 5 hits.

## Stand-in rules (engine_check.mjs)

The human stand-in is the stock normal AI with guards added in campaign/tools, so that it plays
like a sensible player rather than throwing games:
- it skips a shot that would hit its own ship or mine (`ownGoal`), and re-checks a re-planned
  action;
- it closes in before ending a turn with nothing in range (`closeIn`);
- it closes before taking a 1-hit long shot (`closeFirst`);
- `--sloppy` drops the own-mine guard, and `--no-rails` drops every `protect`;
- `--graft` makes it issue the Graft order in ch4A;
- `--seed N` / `--trace <seed>` replay and print one game.

## Summary

| ch | result (40 games) | rounds | fallbacks needed | killing blows |
|---|---|---|---|---|
| 1 First Contact | 40 wins | 10 (all) | none (0/40 each: doom, disarm, hurl, ram, finish) | Finch by missile 40; Wren rammed the bow 40, Kite the stern 40; Seed by Kestrel's laser 40 |
| 2 Quiet Water | 40 wins | 8 (all) | none (a/b fallbacks 0, finish 0) | both Seeds by laser, after a mine left them dead in the water (40/40 each) |
| 3 The Splitting | 40 wins | 8 (34), 11 (6); avg 8.4 | despair r6 40/40 (as v1); pinned 0 | twin_a by laser 40; twin_b withdraws 40 |
| 4A Ashfall | 40 wins (grafted) | 5-9, avg 7.0 | husks_dark 17/40; tow 40/40 (23/40 with `--graft`) | husks by laser / missile |
| 5 The Bloom | 40 to_be_continued | 7 (all) | seam_wakes r5 40/40 (as v1) | - |

No `script_unknown` or `script_failed` event in any run (rails, `--no-rails`, `--sloppy`,
`--graft`).

**Small ships under focused fire (`--no-rails`, first hit to destroyed):** Finch 1 round (one missile),
Sparrow 2 (ch3), Sparrow and Halcyon 2 (ch5), the Seeds 3-4 once dead in the water (ch2). That
meets the 2-3 round target.

## Chapter 1: First Contact

No invented rules (no lock, no hold-fire): the pacing comes from deployment, hull layout, AI
targeting, `orders` and fallbacks.

Fleets: Kestrel (player; 3 lasers; deployed at the rear, [-3,7]) and three script-flown escorts
in a line across row 5, the corridor's full width (Kestrel cannot fire or pass through them):
- Wren: 1 hex, [-4,5]; a plate, then its laser.
- Finch: 1 hex, [-3,5]; the unarmed, unplated scout (3 bays).
- Kite: 2 hexes, [-2,5]-[-1,5]; a plate, then its laser on the front cell.

Against them, the Seed ([1,-5]): 2 hexes, 2 missiles, gun only at Wren and Kite
(`only_targets`), 9 hexes off Kestrel.
- Bow: core, sensor, engine | shield, shield, armour (faces the escorts).
- Stern: coupling, engine, magazine | shield, launcher, laser.

| beat | condition | fallback | 40 games |
|---|---|---|---|
| rails | start | - | protects; doom Finch r6; escorts `hold` (+ `fire_at: seed` for Wren and Kite) |
| contact | player sees the Seed | round 2 | r2 40/40 |
| missile_away (flavor) | Finch inside 7 hexes | - | r4 40/40: the Seed gets `orders: [launch_at: finch]`; lands the same round |
| **finch_down** | Finch destroyed | doom r6 | **r6 40/40, by missile 40/40** (doom 0); one missile, 1 round under fire |
| kite_disarmed / wren_disarmed | laser lost (or the fallback flag) | disarm_fallback r9 | r4 / r6 40/40, natural |
| disarm_fallback | r9, weapons not gone | - | 0/40 |
| weapons_gone | finch_down + both disarmed | (disarm_fallback) | r6 40/40; bark; Seed `duel` (hold) + `orders: move_to [-1,-1]` |
| seed_on_station (flavor) | weapons_gone + Seed in zone `narrows` | - | r7 40/40 |
| hurl | seed_on_station, or 3 rounds after weapons_gone | - | r7 40/40 (on station); scene ch1_hurl; Wren `ram`, Kite `[move_to: [0,1], ram]` |
| ram_wren / ram_kite | `rammed: wren` / `rammed: kite` | ram_fallback (4 rounds after the hurl, `ram force`) | r9 / r10 40/40, natural. **Wren hits the bow (seg 0) 40/40; Kite hits the stern (seg 1) 40/40** |
| ram_fallback | - | - | 0/40 |
| crippled | both rammed | (ram_fallback) | r10 40/40; Seed unprotected, engine/laser/launcher off, hold; objective + **guide** (Close to 4 hexes, then Fire on the Seed) |
| finish_fallback | 4 rounds after crippled | - | 0/40: Kestrel kills the hulk the same round |
| flavor | - | - | seed_shield r2, retarget_wren r4, seed_closing r8.5; finch_hit and retarget_kite 0 |

Other seeds (`--seed 101`): identical. `--sloppy` (the stand-in may shoot its own ships): 10-13
rounds (avg 11.3); disarm_fallback 20/40, ram_fallback 11/40 (then Kite hits the bow); Finch by
missile 20, by the stand-in's own laser 20. `--no-rails`: 40 wins at r3 (unprotected, the Seed
dies to the escorts' and Kestrel's fire), so the rails are what make room for the story.

How the earlier attempts failed (traces, for the record):
- Escorts in row 1 (near the Seed): both disarmed r1-2 and over by r7.
- Launcher (then magazine) in the bow: the escorts' first volleys strip it before the launch.
- A missile launched at 8 hexes did not land that round and Wren's beam shot it down; the
  Seed's own beam stopped on a second missile.
- Kite's swing to [-1,3] ties the bow and stern (its west cell is in the bow's column): both
  rams hit the bow.

## Chapter 2: Quiet Water

Fleets: Kestrel (4 engines, 2 lasers, launcher) and Sparrow, against seed_a (2 missiles) and
seed_b (1 missile).

The board: an asteroid mass in the middle. Three charges lie across row 1 of each lane: west at
[-8..-6, 1], east at [5..7, 1]. Charge signature -12, and `beams_pass_mines` is on.

| beat | condition | fallback | 40 games |
|---|---|---|---|
| rails | start | - | protects (each Seed until dead in the water); Kestrel revealed to the Weave |
| contact | either side sees a Seed | r3 | r1 |
| **a_dead** | `engines_out: seed_a` (or the fallback flag) | a_fallback r9 | **r4 40/40, natural** (west lane charge) |
| **b_dead** | `engines_out: seed_b` | b_fallback r9 | **r7 40/40, natural** (east lane charge) |
| a_fallback / b_fallback | r9, not dead | - | 0/40 (a 1-hit charge blast + engines off + flag) |
| first_mine | either dead | (fallbacks) | r4; scene ch2_first_mine |
| both_dead_in_water | both | - | r7 |
| finish_fallback | r17 | - | 0/40 |

Both Seeds come round the mass, one down each lane, and both hit a charge: the enemy arrives
from either side and hits mines on either side. The "enemy mine hits" counter shows 800 in 40
games because it counts every engine and spill-over hit. Kestrel and Sparrow then finish each
hulk in 3-6 rounds.
- `--sloppy`: identical.
- `--no-rails`: 40 wins at r7, but Sparrow dies (40/40).

## Chapter 3: The Splitting

| beat | 40 games |
|---|---|
| split | r3 40/40 (natural) |
| despair | r6 40/40 (round-6 fallback, as v1) |
| li_arrives | r6 40/40 |
| flank_open / kestrel_exposed | r7 / r8 40/40 |
| pinned (fallback, r16) | 0/40 |
| twin_b_leaves (outcome) | 40/40: r8 in 34, r11 in 6 |

v2 change: the halves are protected, twin_a until kestrel_exposed and twin_b until the end.
Before that, Combat v2 lasers let Kestrel kill twin_a at Li's arrival (34/40 at r6), or kill
twin_b first (6/40, with a tail to r14-21 that only the pinned doom ended).
- `--sloppy`: r8-10.
- `--no-rails`: 40 wins at r9, Sparrow dies in 2 rounds.

## Chapter 4A: Ashfall

| beat | 40 games |
|---|---|
| gift | r4.7 (r3-6), 40/40 |
| husks_dark (the gift's fallback) | 17/40 |
| tow | 40/40 with the stock stand-in; 23/40 with `--graft` |
| grafted | r7.0 (r5-9), 40/40 |

Carry-over: Kestrel leaves with its 6-segment hull and Tern is dropped. The husks die in 1 round
under Combat v2 lasers; ch4A stays the breather chapter.

## Chapter 5: The Bloom

40/40 to_be_continued. Nothing human dies with rails on.

| beat | round |
|---|---|
| arrival | r2 |
| seam_wakes | r5 (fallback; the stand-in never closes in) |
| li_coming | r5 |
| li_moves | r7 |
| cliff | r7 |

## Browser run [browser]

`NODE_PATH=<playwright> node campaign/tools/browser_story.cjs http://localhost:8766/play.html --fix-fork`,
on this tree served with `python3 -m http.server`, in Chromium. The player's side is driven by
`campaignMove`. Scenes now play in story/player.js (story pack v2); the script presses Skip and
picks Ashfall at the fork.
- **Map, fresh save:** First Contact open; Quiet Water, The Splitting, Ashfall and The Bloom
  "not yet"; The Long Dark locked ("Signal lost").
- **Results:** ch1 win r10, ch2 win r8, ch3 win r8, ch4A win r5 (grafted with the Graft
  button), ch5 to_be_continued r7.
- **Saved progress:** after ch1 the roster is `[kestrel, sparrow]` (escorts gone, Sparrow
  added); after ch3 Halcyon and Tern join; after ch4A Kestrel carries the 6-segment hull and
  Tern is gone.
- **Objectives** (fallback lines until the guide overlay exists): ch1 shows only "It's dead in
  the water. Close to 4 hexes and fire on the Seed."
- **Console:** no errors or warnings.

**UI bug found (not fixable in campaign/):** after ch4A, **The Bloom shows as locked**.
`drawMap`'s `nodeState` treats *every* open node other than `progress.choices.fork` as locked,
not just the fork's siblings (ch4a / ch4b). ch5 is open but is not the fork choice, so it
greys out and the campaign cannot be finished from the map. The browser run used
`--fix-fork`, which clears `choices.fork` from the save, to reach ch5; ch5 then played to the
cliff. Suggested fix in ui/campaign.js: lock only nodes that are in the `next` of the node with
`fork_scene`, e.g. `const forkKids = new Set(C.nodes.filter((p) => p.fork_scene).flatMap((p) => p.next || []))`
and `(chosen && forkKids.has(n.id) && n.id !== chosen && open.has(n.id))`.

## Appendix A: `node campaign/tools/check.mjs` (full output)

```

## ch1 "First Contact"  (maps/ch1_corridor.yaml, radius 7)
  ok: finch: helm: script (Combat v2): the engine locks it for the battle; it follows the script's orders
  ok: wren: helm: script (Combat v2): the engine locks it for the battle; it follows the script's orders
  ok: kite: helm: script (Combat v2): the engine locks it for the battle; it follows the script's orders
  ok: hulls (loader rule <id>@<chapter>): kestrel=kestrel@ch1, finch=finch@ch1, wren=wren@ch1, kite=kite@ch1, seed=seed@ch1
  world_overrides: {"turns.turn_limit":20}
  ok: buildRules: 0 problems
  ships:
    P kestrel  segs 3  thrust 4  sensor 6  signature 3  link 4  hull hp 24  lasers 3  shields 0  PD 0  load {}  FLAGSHIP
    P finch    segs 1  thrust 1  sensor 4  signature 1  link 4  hull hp 3  lasers 0  shields 0  PD 0  load {}
    P wren     segs 1  thrust 1  sensor 4  signature 1  link 4  hull hp 6  lasers 1  shields 0  PD 0  load {}
    P kite     segs 2  thrust 3  sensor 4  signature 2  link 4  hull hp 15  lasers 1  shields 0  PD 0  load {}
    W seed     segs 2  thrust 2  sensor 4  signature 2  link 4  hull hp 10  lasers 1  shields 3  PD 0  load {"missile":2}  FLAGSHIP
    Human fleet: thrust 9 for 7 segments -> move cap 2 hexes a turn
    Weave fleet: thrust 2 for 2 segments -> move cap 2 hexes a turn
  start: gap / W sees P at / P sees W at (exact; fuzzy +3)
    seed - kestrel: 12 / 7 / 8
    seed - finch: 10 / 5 / 6
    seed - wren: 10 / 5 / 6
    seed - kite: 10 / 6 / 6
  ok: zones: narrows (1), corridor_mid (11)
  ok: script: 20 entries; every beat has a condition and a guaranteed fallback: rails, contact, finch_down, wren_disarmed, kite_disarmed, disarm_fallback, weapons_gone, hurl, ram_wren, ram_kite, ram_fallback, crippled, finish_fallback
  win {"destroyed":"seed"}: must be earned in play (or ends through a scripted end)

  Board (# asteroid, ~ nebula, M mine, X Weave, capitals = human ships by initial; lower case = zones: z=narrows, :=corridor_mid; ships drawn over zones)
```
 -7        # . . . . . . #
 -6       # # . . . . . # #
 -5      # # # X X . . # # #
 -4     # # # # . . . # # # #
 -3    # # # # . . . . # # # #
 -2   # # # # # . . . # # # # #
 -1  # # # # # : : : : # # # # #
  0 # # # # # # : : : # # # # # #
  1  # # # # # : : : : # # # # #
  2   # # # # # . . . # # # # #
  3    # # # # . . . . # # # #
  4     # # # # . . . # # # #
  5      # # # W F K K # # #
  6       # # . . . . . # #
  7        # . . K K K . #
```

## ch2 "Quiet Water"  (maps/ch2_quiet_water.yaml, radius 8)
  ok: hulls (loader rule <id>@<chapter>): kestrel=kestrel@ch2, sparrow=sparrow@ch1, seed_a=seed_a@ch2, seed_b=seed_b@ch2
  note: world_overrides: "munitions.mine.strikes" is a Combat v2 world setting (read by engine/damage.js; not listed in the world file)
  world_overrides: {"turns.turn_limit":20,"munitions.mine.signature":-12,"munitions.mine.hits":5,"munitions.mine.strikes":"engines","damage.beams_pass_mines":true}
  ok: buildRules: 0 problems
  ships:
    P kestrel  segs 3  thrust 4  sensor 4  signature 3  link 4  hull hp 24  lasers 2  shields 0  PD 0  load {"missile":2}  FLAGSHIP
    P sparrow  segs 1  thrust 1  sensor 4  signature 1  link 4  hull hp 8  lasers 1  shields 0  PD 0  load {}
    W seed_a   segs 2  thrust 2  sensor 4  signature 2  link 4  hull hp 12  lasers 1  shields 2  PD 0  load {"missile":2}  FLAGSHIP
    W seed_b   segs 2  thrust 2  sensor 4  signature 2  link 4  hull hp 12  lasers 1  shields 2  PD 0  load {"missile":1}
    Human fleet: thrust 5 for 4 segments -> move cap 2 hexes a turn
    Weave fleet: thrust 4 for 4 segments -> move cap 2 hexes a turn
  start: gap / W sees P at / P sees W at (exact; fuzzy +3)
    seed_a - kestrel: 9 / 7 / 6
    seed_a - sparrow: 11 / 5 / 6
    seed_b - kestrel: 6 / 7 / 6
    seed_b - sparrow: 8 / 5 / 6
  ok: zones: belt_w (3), belt_e (3), lane_w (15), lane_e (15)
  ok: script: 11 entries; every beat has a condition and a guaranteed fallback: rails, contact, a_dead, b_dead, a_fallback, b_fallback, first_mine, both_dead_in_water, finish_fallback
  win {"all":[{"destroyed":"seed_a"},{"destroyed":"seed_b"}]}: must be earned in play (or ends through a scripted end)

  Board (# asteroid, ~ nebula, M mine, X Weave, capitals = human ships by initial; lower case = zones: z=belt_w, z=belt_e, z=lane_w, z=lane_e; ships drawn over zones)
```
 -8         . . . . . . . . .
 -7        . . . . . . . . . .
 -6       X X # . . . . # . . .
 -5      . . . . . . . . . . . .
 -4     . . . . . . . . . . . . .
 -3    z z # # # # # # # # # # X X
 -2   z z z # # # # # # # # # z z z
 -1  z z z # # # # # # # # # # z z z
  0 z z z z # # # # # # # # # z z z z
  1  M M M # # # # # # # # # # M M M
  2   . . . ~ ~ . . . . . . ~ ~ . .
  3    . . ~ ~ ~ . . K K K ~ # ~ .
  4     . . ~ ~ . . # . . . ~ ~ .
  5      . . . . . . . S . . . .
  6       . # . . . . . . . . .
  7        . . . . . . . . . .
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
  ok: script: 10 entries; every beat has a condition and a guaranteed fallback: rails, split, despair, li_arrives, kestrel_exposed, flank_open, pinned
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
  ok: all 31 shared scene ids are used
  ok: all 23 shared bark ids are used
  final roster: ["kestrel","sparrow","halcyon"]
  final capabilities: core, engine, sensor, laser, armour, coupling, launcher, magazine, missile, mine, shield, point_defence, comms, seeker_drone, docking, graft

ALL CHECKS PASSED
```

## Appendix B: `engine_check.mjs --games 40` (rails on)

```
engine: campaign-engine 7f90ce7 checkout  (games per chapter 40, seeds 1..40)

## ch1: buildChapter problems: none
  progress in: roster ["kestrel","finch","wren","kite"], capabilities 6, completed []
  fleets: kestrel* finch wren kite  vs  seed*
  results: {"win":40}; rounds played avg 10.0 (min 10, max 10)
  beats fired (games / 40, round avg / min / max):
    rails             40  1.0 / 1 / 1
    contact           40  2.0 / 2 / 2
    missile_away      40  4.0 / 4 / 4  (flavor)
    seed_shield       40  2.0 / 2 / 2  (flavor)
    finch_hit          0  -  (flavor)
    finch_down        40  6.0 / 6 / 6
    wren_disarmed     40  6.0 / 6 / 6
    kite_disarmed     40  4.0 / 4 / 4
    retarget_kite      0  -  (flavor)
    retarget_wren     40  4.0 / 4 / 4  (flavor)
    disarm_fallback    0  -
    weapons_gone      40  6.0 / 6 / 6
    seed_on_station   40  7.0 / 7 / 7  (flavor)
    hurl              40  7.0 / 7 / 7
    ram_wren          40  9.0 / 9 / 9
    ram_kite          40  10.0 / 10 / 10
    ram_fallback       0  -
    seed_closing      40  8.5 / 8 / 9  (flavor)
    crippled          40  10.0 / 10 / 10
    finish_fallback    0  -
  destroyed / removed (games): {"finch":40,"wren":40,"kite":40,"seed":40}; of those by a doom fallback: {}
  killing blow (ship:cause, games): {"finch:missile":40,"wren:rammed":40,"kite:rammed":40,"seed:laser":40}
  rams (rammer->target:segment hit, games; seg0 = bow, seg1 = stern on the Seeds): {"wren->seed:seg0":40,"kite->seed:seg1":40}
  rounds under fire before death (first hit to destroyed, avg / min / max): finch 1.0 / 1 / 1 (40 games); wren 4.0 / 4 / 4 (40 games); kite 7.0 / 7 / 7 (40 games); seed 9.0 / 9 / 9 (40 games)
  rounds played (round: games): {"10":40}
  enemy mine hits 0; player missiles stopped by PD 0; kestrel+tern grafted in 0 games
  script_unknown / script_failed events: none
  progress out (from a won game): roster ["kestrel","sparrow"]

## ch2: buildChapter problems: none
  progress in: roster ["kestrel","sparrow"], capabilities 10, completed ["ch1"]
  fleets: kestrel* sparrow  vs  seed_a* seed_b
  results: {"win":40}; rounds played avg 8.0 (min 8, max 8)
  beats fired (games / 40, round avg / min / max):
    rails             40  1.0 / 1 / 1
    contact           40  1.0 / 1 / 1
    in_the_lanes      40  1.0 / 1 / 1  (flavor)
    a_dead            40  4.0 / 4 / 4
    b_dead            40  7.0 / 7 / 7
    a_fallback         0  -
    b_fallback         0  -
    first_mine        40  4.0 / 4 / 4
    second_seed       40  4.0 / 4 / 4  (flavor)
    both_dead_in_water  40  7.0 / 7 / 7
    finish_fallback    0  -
  destroyed / removed (games): {"seed_a":40,"seed_b":40}; of those by a doom fallback: {}
  killing blow (ship:cause, games): {"seed_a:laser":40,"seed_b:laser":40}
  rounds under fire before death (first hit to destroyed, avg / min / max): seed_a 4.0 / 4 / 4 (40 games); seed_b 6.0 / 6 / 6 (40 games)
  rounds played (round: games): {"8":40}
  enemy mine hits 800; player missiles stopped by PD 0; kestrel+tern grafted in 0 games
  script_unknown / script_failed events: none
  progress out (from a won game): roster ["kestrel","sparrow"]

## ch3: buildChapter problems: none
  progress in: roster ["kestrel","sparrow"], capabilities 11, completed ["ch1","ch2"]
  fleets: kestrel* sparrow halcyon(reserve) tern(reserve)  vs  twin*
  results: {"win":40}; rounds played avg 8.4 (min 8, max 11)
  beats fired (games / 40, round avg / min / max):
    rails             40  1.0 / 1 / 1
    split             40  3.0 / 3 / 3
    pd_stopped         6  7.0 / 7 / 7  (flavor)
    hull_low           6  9.0 / 9 / 9  (flavor)
    despair           40  6.0 / 6 / 6
    li_arrives        40  6.0 / 6 / 6
    kestrel_exposed   40  8.0 / 8 / 8
    flank_open        40  7.0 / 7 / 7
    pinned             0  -
    twin_b_leaves     40  8.4 / 8 / 11  (outcome)
  destroyed / removed (games): {"twin_a":40,"twin_b(withdraw)":40}; of those by a doom fallback: {}
  killing blow (ship:cause, games): {"twin_a:laser":40}
  rounds under fire before death (first hit to destroyed, avg / min / max): twin_a 3.5 / 3 / 6 (40 games)
  rounds played (round: games): {"8":34,"11":6}
  enemy mine hits 0; player missiles stopped by PD 6; kestrel+tern grafted in 0 games
  script_unknown / script_failed events: none
  progress out (from a won game): roster ["kestrel","sparrow","halcyon","tern"]

## ch4a: buildChapter problems: none
  progress in: roster ["kestrel","sparrow","halcyon","tern"], capabilities 15, completed ["ch1","ch2","ch3"]
  fleets: kestrel* sparrow halcyon tern  vs  husk_1* husk_2 husk_3
  results: {"win":40}; rounds played avg 7.0 (min 5, max 9)
  beats fired (games / 40, round avg / min / max):
    rails             40  1.0 / 1 / 1
    too_easy          40  2.5 / 2 / 4  (flavor)
    husks_dark        17  6.0 / 6 / 6
    gift              40  4.7 / 3 / 6
    tow               40  6.7 / 5 / 8
    grafted           40  7.0 / 5 / 9
  destroyed / removed (games): {"husk_1":36,"husk_2":35,"husk_3(dark)":17,"husk_1(dark)":4,"husk_3":16}; of those by a doom fallback: {}
  killing blow (ship:cause, games): {"husk_2:laser":33,"husk_1:laser":36,"husk_3:laser":16,"husk_2:missile":2}
  rounds under fire before death (first hit to destroyed, avg / min / max): husk_2 1.2 / 1 / 2 (35 games); husk_1 1.0 / 1 / 1 (36 games); husk_3 1.0 / 1 / 1 (16 games)
  rounds played (round: games): {"5":7,"6":14,"7":2,"8":5,"9":12}
  enemy mine hits 0; player missiles stopped by PD 0; kestrel+tern grafted in 40 games
  script_unknown / script_failed events: none
  progress out (from a won game): roster ["kestrel(carried 6-segment hull)","sparrow","halcyon"]

## ch5: buildChapter problems: none
  progress in: roster ["kestrel(carried hull)","sparrow","halcyon"], capabilities 16, completed ["ch1","ch2","ch3","ch4a"]
  fleets: kestrel* halcyon sparrow  vs  bloom*(reserve)
  results: {"to_be_continued":40}; rounds played avg 7.0 (min 7, max 7)
  beats fired (games / 40, round avg / min / max):
    rails             40  1.0 / 1 / 1
    arrival           40  2.0 / 2 / 2
    seam_wakes        40  5.0 / 5 / 5
    li_coming         40  5.0 / 5 / 5  (flavor)
    li_moves          40  7.0 / 7 / 7
    cliff             40  7.0 / 7 / 7
  destroyed / removed (games): {}; of those by a doom fallback: {}
  killing blow (ship:cause, games): {}
  rounds under fire before death (first hit to destroyed, avg / min / max): -
  rounds played (round: games): {"7":40}
  enemy mine hits 0; player missiles stopped by PD 0; kestrel+tern grafted in 0 games
  script_unknown / script_failed events: none
  progress out (from a won game): roster ["kestrel(carried 6-segment hull)","sparrow","halcyon"]
```

## Appendix C: `--no-rails`

```
engine: campaign-engine 7f90ce7 checkout  (games per chapter 40, seeds 1..40, NO protect actions)

## ch1: buildChapter problems: none
  progress in: roster ["kestrel","finch","wren","kite"], capabilities 6, completed []
  fleets: kestrel* finch wren kite  vs  seed*
  results: {"win":40}; rounds played avg 3.0 (min 3, max 3)
  beats fired (games / 40, round avg / min / max):
    rails             40  1.0 / 1 / 1
    contact           40  2.0 / 2 / 2
    missile_away       0  -  (flavor)
    seed_shield       40  2.0 / 2 / 2  (flavor)
    finch_hit          0  -  (flavor)
    finch_down         0  -
    wren_disarmed      0  -
    kite_disarmed      0  -
    retarget_kite      0  -  (flavor)
    retarget_wren      0  -  (flavor)
    disarm_fallback    0  -
    weapons_gone       0  -
    seed_on_station    0  -  (flavor)
    hurl               0  -
    ram_wren           0  -
    ram_kite           0  -
    ram_fallback       0  -
    seed_closing       0  -  (flavor)
    crippled           0  -
    finish_fallback    0  -
  destroyed / removed (games): {"seed":40}; of those by a doom fallback: {}
  killing blow (ship:cause, games): {"seed:laser":40}
  rounds under fire before death (first hit to destroyed, avg / min / max): seed 2.0 / 2 / 2 (40 games)
  rounds played (round: games): {"3":40}
  enemy mine hits 0; player missiles stopped by PD 0; kestrel+tern grafted in 0 games
  script_unknown / script_failed events: none
  progress out (from a won game): roster ["kestrel","sparrow"]

## ch2: buildChapter problems: none
  progress in: roster ["kestrel","sparrow"], capabilities 10, completed ["ch1"]
  fleets: kestrel* sparrow  vs  seed_a* seed_b
  results: {"win":40}; rounds played avg 7.0 (min 7, max 7)
  beats fired (games / 40, round avg / min / max):
    rails             40  1.0 / 1 / 1
    contact           40  1.0 / 1 / 1
    in_the_lanes      40  1.0 / 1 / 1  (flavor)
    a_dead            40  4.0 / 4 / 4
    b_dead             0  -
    a_fallback         0  -
    b_fallback         0  -
    first_mine        40  4.0 / 4 / 4
    second_seed       40  4.0 / 4 / 4  (flavor)
    both_dead_in_water   0  -
    finish_fallback    0  -
  destroyed / removed (games): {"seed_a":40,"seed_b":40}; of those by a doom fallback: {}
  killing blow (ship:cause, games): {"seed_b:laser":40,"seed_a:laser":40}
  rounds under fire before death (first hit to destroyed, avg / min / max): seed_b 3.0 / 3 / 3 (40 games); seed_a 4.0 / 4 / 4 (40 games)
  rounds played (round: games): {"7":40}
  enemy mine hits 400; player missiles stopped by PD 0; kestrel+tern grafted in 0 games
  script_unknown / script_failed events: none
  progress out (from a won game): roster ["kestrel","sparrow"]

## ch3: buildChapter problems: none
  progress in: roster ["kestrel","sparrow"], capabilities 11, completed ["ch1","ch2"]
  fleets: kestrel* sparrow halcyon(reserve) tern(reserve)  vs  twin*
  results: {"win":40}; rounds played avg 9.0 (min 9, max 9)
  beats fired (games / 40, round avg / min / max):
    rails             40  1.0 / 1 / 1
    split             40  3.0 / 3 / 3
    pd_stopped        40  7.0 / 7 / 7  (flavor)
    hull_low          34  8.0 / 8 / 8  (flavor)
    despair           40  6.0 / 6 / 6
    li_arrives        40  6.0 / 6 / 6
    kestrel_exposed   40  8.0 / 8 / 8
    flank_open        40  7.0 / 7 / 7
    pinned             0  -
    twin_b_leaves     40  9.0 / 9 / 9  (outcome)
  destroyed / removed (games): {"sparrow":40,"twin_a":40,"twin_b(withdraw)":40}; of those by a doom fallback: {}
  killing blow (ship:cause, games): {"sparrow:laser":40,"twin_a:laser":40}
  rounds under fire before death (first hit to destroyed, avg / min / max): sparrow 2.0 / 2 / 2 (40 games); twin_a 4.0 / 4 / 4 (40 games)
  rounds played (round: games): {"9":40}
  enemy mine hits 0; player missiles stopped by PD 40; kestrel+tern grafted in 0 games
  script_unknown / script_failed events: none
  progress out (from a won game): roster ["kestrel","sparrow","halcyon","tern"]

## ch4a: buildChapter problems: none
  progress in: roster ["kestrel","sparrow","halcyon","tern"], capabilities 15, completed ["ch1","ch2","ch3"]
  fleets: kestrel* sparrow halcyon tern  vs  husk_1* husk_2 husk_3
  results: {"win":40}; rounds played avg 7.0 (min 5, max 9)
  beats fired (games / 40, round avg / min / max):
    rails             40  1.0 / 1 / 1
    too_easy          40  2.5 / 2 / 4  (flavor)
    husks_dark        17  6.0 / 6 / 6
    gift              40  4.7 / 3 / 6
    tow               40  6.7 / 5 / 8
    grafted           40  7.0 / 5 / 9
  destroyed / removed (games): {"husk_1":36,"husk_2":35,"husk_3(dark)":17,"husk_1(dark)":4,"husk_3":16}; of those by a doom fallback: {}
  killing blow (ship:cause, games): {"husk_2:laser":33,"husk_1:laser":36,"husk_3:laser":16,"husk_2:missile":2}
  rounds under fire before death (first hit to destroyed, avg / min / max): husk_2 1.2 / 1 / 2 (35 games); husk_1 1.0 / 1 / 1 (36 games); husk_3 1.0 / 1 / 1 (16 games)
  rounds played (round: games): {"5":7,"6":14,"7":2,"8":5,"9":12}
  enemy mine hits 0; player missiles stopped by PD 0; kestrel+tern grafted in 40 games
  script_unknown / script_failed events: none
  progress out (from a won game): roster ["kestrel(carried 6-segment hull)","sparrow","halcyon"]

## ch5: buildChapter problems: none
  progress in: roster ["kestrel(carried hull)","sparrow","halcyon"], capabilities 16, completed ["ch1","ch2","ch3","ch4a"]
  fleets: kestrel* halcyon sparrow  vs  bloom*(reserve)
  results: {"to_be_continued":40}; rounds played avg 7.0 (min 7, max 7)
  beats fired (games / 40, round avg / min / max):
    rails             40  1.0 / 1 / 1
    arrival           40  2.0 / 2 / 2
    seam_wakes        40  5.0 / 5 / 5
    li_coming         40  5.0 / 5 / 5  (flavor)
    li_moves          40  7.0 / 7 / 7
    cliff             40  7.0 / 7 / 7
  destroyed / removed (games): {"halcyon":40,"sparrow":40}; of those by a doom fallback: {}
  killing blow (ship:cause, games): {"sparrow:laser":40,"halcyon:missile":23,"halcyon:laser":17}
  rounds under fire before death (first hit to destroyed, avg / min / max): sparrow 2.0 / 2 / 2 (40 games); halcyon 2.0 / 2 / 2 (40 games)
  rounds played (round: games): {"7":40}
  enemy mine hits 0; player missiles stopped by PD 0; kestrel+tern grafted in 0 games
  script_unknown / script_failed events: none
  progress out (from a won game): roster ["kestrel(carried 6-segment hull)","sparrow","halcyon"]
```

## Appendix D: `--sloppy`

```
engine: campaign-engine 7f90ce7 checkout  (games per chapter 40, seeds 1..40, human stand-in may shoot its own mines)

## ch1: buildChapter problems: none
  progress in: roster ["kestrel","finch","wren","kite"], capabilities 6, completed []
  fleets: kestrel* finch wren kite  vs  seed*
  results: {"win":40}; rounds played avg 11.3 (min 10, max 13)
  beats fired (games / 40, round avg / min / max):
    rails             40  1.0 / 1 / 1
    contact           40  2.0 / 2 / 2
    missile_away      40  4.0 / 4 / 4  (flavor)
    seed_shield       40  2.0 / 2 / 2  (flavor)
    finch_hit          0  -  (flavor)
    finch_down        40  5.0 / 4 / 6
    wren_disarmed     40  7.5 / 6 / 9
    kite_disarmed     40  4.0 / 4 / 4
    retarget_kite      0  -  (flavor)
    retarget_wren     40  4.0 / 4 / 4  (flavor)
    disarm_fallback   20  9.0 / 9 / 9
    weapons_gone      40  7.5 / 6 / 9
    seed_on_station   40  8.0 / 7 / 9  (flavor)
    hurl              40  8.0 / 7 / 9
    ram_wren          40  10.6 / 9 / 13
    ram_kite          40  11.3 / 10 / 13
    ram_fallback      11  13.0 / 13 / 13
    seed_closing      40  9.8 / 9 / 11  (flavor)
    crippled          40  11.3 / 10 / 13
    finish_fallback    0  -
  destroyed / removed (games): {"finch":40,"wren":40,"kite":40,"seed":40}; of those by a doom fallback: {}
  killing blow (ship:cause, games): {"finch:missile":20,"wren:rammed":40,"kite:rammed":40,"seed:laser":40,"finch:laser":20}
  rams (rammer->target:segment hit, games; seg0 = bow, seg1 = stern on the Seeds): {"wren->seed:seg0":40,"kite->seed:seg1":29,"kite->seed:seg0":11}
  rounds under fire before death (first hit to destroyed, avg / min / max): finch 1.0 / 1 / 1 (40 games); wren 3.6 / 3 / 4 (31 games); kite 8.3 / 7 / 10 (40 games); seed 10.3 / 9 / 12 (40 games)
  rounds played (round: games): {"10":20,"12":9,"13":11}
  enemy mine hits 0; player missiles stopped by PD 0; kestrel+tern grafted in 0 games
  script_unknown / script_failed events: none
  progress out (from a won game): roster ["kestrel","sparrow"]

## ch2: buildChapter problems: none
  progress in: roster ["kestrel","sparrow"], capabilities 10, completed ["ch1"]
  fleets: kestrel* sparrow  vs  seed_a* seed_b
  results: {"win":40}; rounds played avg 8.0 (min 8, max 8)
  beats fired (games / 40, round avg / min / max):
    rails             40  1.0 / 1 / 1
    contact           40  1.0 / 1 / 1
    in_the_lanes      40  1.0 / 1 / 1  (flavor)
    a_dead            40  4.0 / 4 / 4
    b_dead            40  7.0 / 7 / 7
    a_fallback         0  -
    b_fallback         0  -
    first_mine        40  4.0 / 4 / 4
    second_seed       40  4.0 / 4 / 4  (flavor)
    both_dead_in_water  40  7.0 / 7 / 7
    finish_fallback    0  -
  destroyed / removed (games): {"seed_a":40,"seed_b":40}; of those by a doom fallback: {}
  killing blow (ship:cause, games): {"seed_a:laser":40,"seed_b:laser":40}
  rounds under fire before death (first hit to destroyed, avg / min / max): seed_a 3.0 / 3 / 3 (40 games); seed_b 6.0 / 6 / 6 (40 games)
  rounds played (round: games): {"8":40}
  enemy mine hits 800; player missiles stopped by PD 0; kestrel+tern grafted in 0 games
  script_unknown / script_failed events: none
  progress out (from a won game): roster ["kestrel","sparrow"]

## ch3: buildChapter problems: none
  progress in: roster ["kestrel","sparrow"], capabilities 11, completed ["ch1","ch2"]
  fleets: kestrel* sparrow halcyon(reserve) tern(reserve)  vs  twin*
  results: {"win":40}; rounds played avg 8.3 (min 8, max 10)
  beats fired (games / 40, round avg / min / max):
    rails             40  1.0 / 1 / 1
    split             40  3.0 / 3 / 3
    pd_stopped         0  -  (flavor)
    hull_low           0  -  (flavor)
    despair           40  6.0 / 6 / 6
    li_arrives        40  6.0 / 6 / 6
    kestrel_exposed   40  8.0 / 8 / 8
    flank_open        40  7.0 / 7 / 7
    pinned             0  -
    twin_b_leaves     40  8.3 / 8 / 10  (outcome)
  destroyed / removed (games): {"twin_a":40,"twin_b(withdraw)":40}; of those by a doom fallback: {}
  killing blow (ship:cause, games): {"twin_a:laser":40}
  rounds under fire before death (first hit to destroyed, avg / min / max): twin_a 3.3 / 3 / 5 (40 games)
  rounds played (round: games): {"8":34,"10":6}
  enemy mine hits 0; player missiles stopped by PD 0; kestrel+tern grafted in 0 games
  script_unknown / script_failed events: none
  progress out (from a won game): roster ["kestrel","sparrow","halcyon","tern"]

## ch4a: buildChapter problems: none
  progress in: roster ["kestrel","sparrow","halcyon","tern"], capabilities 15, completed ["ch1","ch2","ch3"]
  fleets: kestrel* sparrow halcyon tern  vs  husk_1* husk_2 husk_3
  results: {"win":40}; rounds played avg 7.0 (min 5, max 9)
  beats fired (games / 40, round avg / min / max):
    rails             40  1.0 / 1 / 1
    too_easy          40  2.5 / 2 / 4  (flavor)
    husks_dark        17  6.0 / 6 / 6
    gift              40  4.7 / 3 / 6
    tow               40  6.7 / 5 / 8
    grafted           40  7.0 / 5 / 9
  destroyed / removed (games): {"husk_1":36,"husk_2":35,"husk_3(dark)":17,"husk_1(dark)":4,"husk_3":16}; of those by a doom fallback: {}
  killing blow (ship:cause, games): {"husk_2:laser":33,"husk_1:laser":36,"husk_3:laser":16,"husk_2:missile":2}
  rounds under fire before death (first hit to destroyed, avg / min / max): husk_2 1.2 / 1 / 2 (35 games); husk_1 1.0 / 1 / 1 (36 games); husk_3 1.0 / 1 / 1 (16 games)
  rounds played (round: games): {"5":7,"6":14,"7":2,"8":5,"9":12}
  enemy mine hits 0; player missiles stopped by PD 0; kestrel+tern grafted in 40 games
  script_unknown / script_failed events: none
  progress out (from a won game): roster ["kestrel(carried 6-segment hull)","sparrow","halcyon"]

## ch5: buildChapter problems: none
  progress in: roster ["kestrel(carried hull)","sparrow","halcyon"], capabilities 16, completed ["ch1","ch2","ch3","ch4a"]
  fleets: kestrel* halcyon sparrow  vs  bloom*(reserve)
  results: {"to_be_continued":40}; rounds played avg 7.0 (min 7, max 7)
  beats fired (games / 40, round avg / min / max):
    rails             40  1.0 / 1 / 1
    arrival           40  2.0 / 2 / 2
    seam_wakes        40  5.0 / 5 / 5
    li_coming         40  5.0 / 5 / 5  (flavor)
    li_moves          40  7.0 / 7 / 7
    cliff             40  7.0 / 7 / 7
  destroyed / removed (games): {}; of those by a doom fallback: {}
  killing blow (ship:cause, games): {}
  rounds under fire before death (first hit to destroyed, avg / min / max): -
  rounds played (round: games): {"7":40}
  enemy mine hits 0; player missiles stopped by PD 0; kestrel+tern grafted in 0 games
  script_unknown / script_failed events: none
  progress out (from a won game): roster ["kestrel(carried 6-segment hull)","sparrow","halcyon"]
```

## Appendix E: ch4A `--graft`

```
## ch4a: buildChapter problems: none
  progress in: roster ["kestrel","sparrow","halcyon","tern"], capabilities 15, completed ["ch1","ch2","ch3"]
  fleets: kestrel* sparrow halcyon tern  vs  husk_1* husk_2 husk_3
  results: {"win":40}; rounds played avg 6.5 (min 5, max 9)
  beats fired (games / 40, round avg / min / max):
    rails             40  1.0 / 1 / 1
    too_easy          40  2.5 / 2 / 4  (flavor)
    husks_dark        17  6.0 / 6 / 6
    gift              40  4.7 / 3 / 6
    tow               23  7.1 / 5 / 8
    grafted           40  6.5 / 5 / 9
  destroyed / removed (games): {"husk_1":36,"husk_2":35,"husk_3(dark)":17,"husk_1(dark)":4,"husk_3":16}; of those by a doom fallback: {}
  killing blow (ship:cause, games): {"husk_2:laser":33,"husk_1:laser":36,"husk_3:laser":16,"husk_2:missile":2}
  rounds under fire before death (first hit to destroyed, avg / min / max): husk_2 1.2 / 1 / 2 (35 games); husk_1 1.0 / 1 / 1 (36 games); husk_3 1.0 / 1 / 1 (16 games)
  rounds played (round: games): {"5":23,"6":1,"8":4,"9":12}
  enemy mine hits 0; player missiles stopped by PD 0; kestrel+tern grafted in 40 games
  script_unknown / script_failed events: none
  progress out (from a won game): roster ["kestrel(carried 6-segment hull)","sparrow","halcyon"]
```
