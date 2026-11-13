# MANIFEST: Shatkon: The Weave, chapters 1-5 (campaign-v1)

Level design for the story campaign. The branch is based on `main` (8c8be0a) and adds files
under `campaign/` only: no engine or rule file is changed.

The files are written for the story engine in **PR #2** (branch `campaign-engine`, head
3692a82, still open). They use its formats, field names, trigger and action names and AI-profile
knobs. Every chapter loads with its `buildChapter()` without problems, and every beat fires in
scripted games through its `script.js` (see CHECKS.md, where each result is labelled [main] or
[PR #2]).

## Files

| file | what it is |
|---|---|
| `campaign.yaml` | The campaign graph: `id`, `start`, `start_state` (`roster` as a list of ship ids, `capabilities`, `flags`) and `nodes` (ch1 → ch2 → ch3 → ch4a or ch4b(locked) → ch5). |
| `ships.yaml` | Every hull, keyed `<ship>@<chapter it first flies in>`. Kestrel has a hull per refit (ch1, ch2, ch3, ch4a, ch5); sparrow@ch1/@ch3, finch, halcyon, tern, the Seeds, the Twin (plus documented split pieces twin_a@ch3 / twin_b@ch3), the husks and the Bloom. `flagship: true` sits on the hull. |
| `maps/ch1_corridor.yaml` | Radius 7. An asteroid corridor (\|x\| ≤ 1.5, wider at the ends). Zone `corridor_mid`. |
| `maps/ch2_quiet_water.yaml` | Radius 8. An asteroid wall on rows 0-1 with one 2-3 hex gap and a 1-hex west slot. A small nebula north of the wall. Zones `choke`, `minefield`, `west_slot`. Mines allowed 6 rows past home. |
| `maps/ch3_splitting.yaml` | Radius 9. The rock cluster that hides Kestrel's start. Zones `li_arrival` (north-east corner, 8 hexes) and `cover`. |
| `maps/ch4a_ashfall.yaml` | Radius 8. The outpost wreck ring around [0,0] and small nebulae. Zone `outpost`. |
| `maps/ch5_bloom.yaml` | Radius 10. A nebula band on rows -7..-5. Zone `bloom_entry` (16 hexes). |
| `chapters/ch1_first_contact.yaml` … `ch5_bloom.yaml` | One file per chapter: `world_overrides`, `map`, `player` / `enemy` (`ships`, `deployment`, `ai`), `groups`, `ai_profiles`, `script`, `win`, `lose`, `scenes`, `rewards`. |
| `CHECKS.md` | Per-chapter numbers and results: [main] buildRules, [PR #2] buildChapter and scripted sims. |
| `tools/check.mjs` | The [main] checker. It runs buildRules per chapter (resolving hulls by the PR #2 loader's rule) and checks split pieces, the graft result, spawn groups, zones, roster/capability continuity, every shared scene/bark id, and the trigger/action/knob names PR #2 reads. It also checks that every beat has a guaranteed fallback, and draws an ASCII board. Exit code 1 on failure. Run it with `node campaign/tools/check.mjs`. |
| `tools/engine_check.mjs` | The [PR #2] checker. It loads every chapter with PR #2's `buildChapter`, chaining progress through `newCampaign` / `applyResult`, and plays N scripted AI-vs-AI games per chapter with `campaignMove`. Run it with `node campaign/tools/engine_check.mjs --engine <checkout of campaign-engine> [--games 40] [--chapter chN] [--no-rails] [--sloppy] [--graft] [--out file]`. |
| `tools/gen_maps.mjs` | Regenerates the five map files: terrain compressed into the map format's disc / line / single shapes, plus the zones. |
| `tools/lib.mjs` | Shared helpers: the repo's YAML reader, `world_overrides`, hull resolution (`hullKeyFor`, the same rule as PR #2's `hullFor`) and the ASCII board. |

## How the files map onto PR #2's engine

| need | how it is written (PR #2 name) |
|---|---|
| which hull a ship flies | No per-chapter hull list. The loader picks `<id>@<this chapter>`, else a hull carried from an earlier battle, else the newest earlier `<id>@<chapter>`. |
| flagship | `flagship: true` on the hull (kestrel@*, seed@ch1, seed_a@ch2, twin@ch3, husk_1@ch4a, bloom@ch5). The split gives `twin_a` `flagship: true`. |
| roster | `start_state.roster: [kestrel, sparrow, finch]`; `rewards.roster_remove: [finch]` (ch1); `rewards.roster_add: [halcyon, tern]` (ch3). ch4A needs no reward: `applyResult` drops Tern and carries Kestrel's grafted hull itself (`roster_remove: [tern]` is kept as belt and braces). |
| late arrivals | `groups.<name>: { side, ships, zone, at: { ship: [q, r] } }` + `spawn: <name>` (li_wing ch3, bloom_arrival ch5). The Bloom is a reserve flagship. |
| beat references | Bare beat ids (`when: li_moves`, `{ not: gift }`), `{ after: { beat, rounds \| turns } }`. `flag:` is not used for beats. |
| "next player turn after X" | `{ all: [ { after: { beat: despair, turns: 1 } }, { turn: { round: 1, side: player } } ] }` |
| protect until a later moment | `protect: { ship, until: <beat id> }` plus a helper beat (`kestrel_exposed` = 2 rounds after `li_arrives`). |
| forced moves | `force: { ship, do: [ { move_toward: <ship> } ], each_turn: true, until }` (Kestrel → Bloom in ch5, Tern → Kestrel in ch4A). |
| herding into a zone | AI profile `herd` (`stance: advance, path_via: minefield`), set with `ai: { side: enemy, profile: herd }`. |
| split | `split: { ship: twin, into: [ { id, flagship, cells } ] }`, with cells in the Twin's own offsets. The engine grows twin_b's core in its first cell ([1,-1]), where the hull keeps a bay free. |
| graft | `unlock: graft`, the player order `{ type: graft, ship, with }`, and the script action `graft: [kestrel, tern]`. Triggers: `grafted: [kestrel, tern]`. |
| results | `win` / `lose` lists (empty in ch5 → the engine's defaults). `end: { result: win \| to_be_continued }`. Scenes: `scenes.intro`, `win` (list), `lose`, `tbc` (ch5_cliff). |
| AI knobs used | `level, stance (hunt/advance/hold/flee/charge), target (smallest/flagship/list), stand_off (number or { from, hexes }), path_via, scans, avoid_mines, launch_range, fire_chance, max_hits_per_round`. |

### Fields kept that PR #2 does not read (invented, harmless)

1. **Script entry fields `flavor: true`, `outcome: true` and `fallback_for: <beat>`.** These
   are metadata for `check.mjs`'s "every beat has a fallback" analysis:
   - a flavor bark may never fire;
   - an outcome entry is part of the win itself;
   - `fallback_for` marks the entry that guarantees another beat.

   The engine ignores unknown entry fields.
2. **`campaign.yaml`: `title`, `map_art`, and the node fields `title`, `file`, `at`,
   `fork_scene` and `locked_text`.** These are for the campaign-map screen. PR #2's
   `nextNodes` reads only `id`, `next` and `locked`. The ch3 fork (see below) is not engine
   logic yet.
3. **Chapter `world` and `map` paths.** `buildChapter` takes the parsed world and map from the
   caller, so the caller must open these paths. `engine_check.mjs` does.
4. **`ships.yaml` documentation fields.** `from` is documentation. The hulls `twin_a@ch3` and
   `twin_b@ch3` are never loaded; they document, and check, what the split builds.
5. **Comments on intended turn-limit outcomes.** The old `at_turn_limit` field was removed.
   PR #2 scores a time-out as a draw, so ch1-3 put safety dooms on the enemy flagship and ch4A
   and ch5 end through the script long before their limits.

### Things the design wanted that PR #2 cannot do (worked around; requests for the engine)

1. **Scripted damage or detonation.** ch2's `first_mine` has a round-10 fallback that plays
   the scene without a real explosion. A `damage: { ship, hits, cause }` or
   `detonate: <mine at>` action would make the fallback honest.
2. **Exclusive targets.** `only_targets` was dropped: `target: [list]` is only a preference.
   The ch5 Bloom may shoot Kestrel, which is protected until the cliff.
3. **Forcing a move into a zone, and protecting a whole side.** Replaced by the herd profile
   and by one `protect` per ship.
4. **Starting damaged (`broken: [part]`).** The ch4A husks are instead built with missing
   parts.
5. **`ignore_flank`.** Accepted by PR #2 but it does nothing, so it was removed.
6. **The scripted `graft` when the ships are apart.** PR #2's join() throws "the ships must
   be touching" from inside the script. The ch4A `grafted` beat therefore fires the scripted
   graft only once a `tow` (lock + `move_toward`) has brought Tern alongside. It would be safer
   if a script-side graft on non-touching ships emitted an event instead of throwing.
7. **A canonical post-graft hull.** Because `kestrel@ch5` exists, the loader uses it in ch5
   instead of the shape the player actually grafted. That shape is still carried in the
   progress. This is deliberate, because it keeps ch5's deployment legal however the player
   grafted. Delete `kestrel@ch5` if the real grafted shape should fly.

## Notes for the story developer

- **Every shared id is used**: all 29 scenes and all 19 barks, checked by `check.mjs`.
  - Intro scenes play from `scenes.intro`.
  - Win scenes: ch1_victory + ch1_salvage, ch2_victory + ch2_salvage, ch3_victory +
    ch3_reunion.
  - Lose scenes: chN_defeat. They are unreachable while the rails hold, but kept for a retry
    screen.
- **Script-played scenes:**
  - ch1_contact, ch1_finch_down
  - ch2_contact, ch2_first_mine
  - ch3_split, ch3_despair, ch3_li_arrives
  - ch4a_graft_found, ch4a_outro (played just before `end: win`; `scenes.win` is empty)
  - ch5_bloom, ch5_seam_wakes, ch5_li_moves
  - ch5_cliff, which comes from `scenes.tbc` when the script ends `to_be_continued`.
- **ch4_fork** is the campaign-map scene after ch3. Picking ch4b plays the crew's objection
  and leaves it locked ("Signal lost"); ch4a is the only playable branch. The campaign screen
  needs to implement this; PR #2 only marks ch4b `locked`.
- **Objectives** are `objective:` strings in the scripts, in the player's voice. Rewrite
  them freely.
- **Ship names in barks:** twin_a and twin_b only exist after `split` (r3 in sims). Halcyon
  and Tern only exist after `li_arrives` (r6).

## Assumptions (made without the user; all reversible)

1. **More rails than the spec asked for, for story continuity:**
   - Sparrow is protected in ch1-3, because it is needed for the ch1 salvage and in ch4A-5.
   - Tern is protected from its arrival in ch3, because it is grafted in ch4A.
   - All human ships are protected in ch4A and until the cliff in ch5.

   Without these, Sparrow dies in 40/40 PR #2 games in ch1 and ch3 (CHECKS, Appendix C).
2. **Safety dooms on the enemy flagship:** the Seed by r19 (ch1), seed_a by r21 (ch2) and
   twin_a by r23 (ch3). No chapter can stall into PR #2's turn-limit draw.
3. **Finch's fall is guaranteed by `doom: by_round 4`.** In PR #2 sims the Seed hurts Finch
   but the doom always delivers the kill (40/40), because the Seed's stand_off from Kestrel
   keeps it cautious.
4. **The ch2 survey charges are pre-placed** in the player's deployment (4 mines in the
   gap); the player does not place them in v1. Their signature is overridden to -12, so the
   Weave can never see them.
5. **The ch2 fallbacks:**
   - **herd:** at r6 the Seeds' profile becomes "march through the minefield".
   - **first_mine:** plays at r10 even without a hit.
6. **Turn limits:** ch1 20, ch2 22, ch3 24, ch4A 15, ch5 12 (world overrides).
7. **Hull refits.** Kestrel changes hull every chapter: ch2 gets a launcher and magazine,
   ch3 a fourth segment and shields, ch4A point defence, ch5 the graft. Sparrow gains a shield
   from ch3. Rewards unlock the matching capabilities: launcher, magazine, missile and mine
   after ch1; shield after ch2; point defence, comms, seeker drone and docking after ch3;
   graft after ch4A.
8. **The canonical grafted Kestrel puts Tern at the rear**, at [-1,1] and [0,1], with Tern's
   core fused into a seam coupling (1 core). ch5 always flies this shape.
9. **The Twin split.** twin_a ([0,0], [1,0], [0,1]) is the flagship and keeps the hunt.
   twin_b grows its core in a free bay of [1,-1] and takes all 3 missiles, because only it has
   a magazine.
10. **Li's arrival.** li arrives in the north-east corner (Halcyon [6,-9], Tern [8,-9]), at
    the start of the player's turn at least one turn after Despair, or r7 at the latest.
11. **The ch5 jamming** is `bay_parts.comms.link_range` 12 → 3 and `bay_parts.core.link_range`
    4 → 2, from the Bloom's arrival (r2).
12. **The ch5 forced drift** is the engine's `move_toward`, which spends the player's thrust.
13. **The ch4B node is shown locked** ("Signal lost") and has no chapter file. ch5 follows
    ch4A only.
14. **The human stand-in in sims never shoots its own mines** (default). `--sloppy` shows
    what happens when it does (CHECKS, Appendix D).
15. **No PR #2 fields beyond what its code reads,** except the harmless ones listed above.

## Risks and open issues

1. **ch2: lasers stop on mines.** A laser stops on any object in its line, mines included.
   A player, or the Weave, firing through the gap destroys the survey charges; the stock AI
   stand-in shot all four within 5 rounds. Possible fixes:
   - tell the player to hold fire through the gap (b2_mines_set / objective);
   - give the engine a rule that beams pass mines;
   - accept the r10 fallback.
2. **ch5:** with the AI stand-in the seam always wakes on the r5 fallback, because the
   stand-in never closes on the Bloom. A real player who engages should trigger it earlier
   (it needs 5+ hexes of closing).
3. **ch3:** Despair always comes from the r6 fallback in sims. The first point-defence stop
   lands at r6-7, just after.
4. **PR #2 is still open.** If its names change, `check.mjs` (name lists at the top) and the
   files need a pass. `engine_check.mjs` pins nothing and runs against any checkout.
5. **Campaign-screen logic that is not engine logic:** the ch3 fork (ch4_fork, the ch4b
   objection) and the "To be continued" save after ch5. PR #2's `applyResult` marks ch5
   completed.
