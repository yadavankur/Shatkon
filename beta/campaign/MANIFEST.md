# MANIFEST: Shatkon: The Weave, chapters 1-5 (campaign-v3)

Level design for the story campaign. Branch `campaign-v3` was made from `origin/campaign-engine`
at **d508720** ("Merge main"; it has engine 781a5a1: Combat v2 fixes for gaps 1-6, 8 and 9, and
the move guides of GUIDE_PROPOSAL.md built as `guideView`). Only files under `campaign/` are
changed; no engine, rule, story or UI file is.

What v3 changes (on top of v2, below):
- **No `objective:` line on a guided beat.** The overlay replaces the banner (the UI hides the
  banner while a guide is up). ch1 `crippled`, ch4A `rails` / `gift` lost theirs, and so did
  ch2 `first_mine` / `both_dead_in_water` (the fallback lines for the `a_dead` / `b_dead`
  guides); the remaining objectives are on beats with no guide.
- **Workarounds for the fixed gaps are gone** (section "Engine gaps" below): no narrows station
  or hold profile in ch1, no `dead_in_water` profile or forced flags in ch2, no `pinned` hold
  profile in ch3, no `munitions.mine.strikes` special case in tools/lib.mjs.
- **ch1 rams name their ends:** `{ ram: seed, seg: 0 }` (Wren, bow) and `{ ram: seed, seg: 1 }`
  (Kite, stern), 40/40 with and without `--sloppy`. A rammer whose engine was shot out (it can
  no longer move: gap 1 fix) hurls anyway (`wren_stranded` / `kite_stranded`: `ram { force,
  seg }`), so the chapter keeps its 9 rounds.
- **ch2's fallback** is one scripted 5-hit charge `damage { from_mine: true }`, which now strikes
  engines like a real one, so `engines_out` alone sets a Seed dead in the water.
- **ch3's round-21 tail is gone** (6/40 games ran to the `pinned` doom): when twin_a is dead in
  the water after Li, twin_b withdraws (`twin_a_adrift`) and a guide takes Kestrel to finish it.
  ch3 is now 8 rounds (34/40) or 11 (6/40); `pinned` is still the last resort, unused.
- **ch4A's tow locks** carry a `reason` ("The rig has Tern in tow", "Holding still for the graft").
- **tools:** check.mjs lints `seg` (on ram orders and actions), `orders append`, `lock reason`;
  new `guide_acceptance.mjs` (GUIDE_PROPOSAL.md §11 tests on the engine, plus forced-fallback
  checks) and `browser_story.cjs --guide-ui` (§11 tests 10-11 at desktop and phone size).

v2 (kept): what v2 changed (playtest feedback: fights drag; the aliens visibly fail on purpose):
- **ch1** is rebuilt around the brief's beats, **with no invented rules** (no guns-cold lock,
  no hold-fire): deployment, hull layout, AI targeting, `orders` and fallbacks do the pacing.
  The player flies only Kestrel; Finch, Wren and Kite are `helm: script` escorts flown by
  `orders`, screening the corridor ahead of Kestrel. The Seed's missile kills Finch, its gun
  takes the escorts' lasers, then Wren rams the Seed's bow and Kite its stern, and an on-map
  guide brings Kestrel in to finish the hulk. Sparrow is not in
  ch1 (`roster_add: [sparrow]` in the rewards).
- **ch2** is rebuilt so the mines decide it: charges on both flanks, `munitions.mine.strikes:
  engines` with 5 hits, and `engines_out` sets a Seed dead in the water.
- **ch3-5** re-checked against the new numbers. In ch3 the halves are protected until Li's
  wing turns the fight (the Twin's trimmed plate is restored). Every `charge`, `herd`, `timid`
  and `fire_chance` "blunder" profile is gone; the Weave play the stock normal AI with story
  knobs (targets, stand-off, hold when crippled or dark).

See CHECKS.md for the numbers.

## Files

| file | what it is |
|---|---|
| `campaign.yaml` | The campaign graph. `start_state.roster: [kestrel, finch, wren, kite]`. ch1's rewards remove the escorts and add Sparrow. |
| `ships.yaml` | Every hull, keyed `<ship>@<chapter it first flies in>`. New in v2: wren@ch1 (1 hex) and kite@ch1 (2 hexes), the shapes in story/ships.json; finch@ch1 is the unarmed, unplated scout; seed@ch1 has its bow (shields, plate) facing the escorts and launcher, magazine and laser in the stern; kestrel@ch2 keeps four engines; twin@ch3 back to full plates. |
| `maps/ch1_corridor.yaml` | Radius 7. The asteroid corridor, 3-4 hexes wide. South home zone 7 rows deep. (v3: the `narrows` zone is gone; the rams name their segment.) |
| `maps/ch2_quiet_water.yaml` | Radius 8, new in v2. An asteroid mass in the middle (rows -3..1, \|x\| <= 4.5) splits the board into a west and an east lane. Scattered rocks and two nebula discs. Zones `belt_w` / `belt_e` (row 1 of each lane, where the charges lie), `lane_w` / `lane_e`. Home zones 6 deep, mines allowed 8 rows. |
| `maps/ch3_splitting.yaml`, `ch4a_ashfall.yaml`, `ch5_bloom.yaml` | Unchanged from v1. |
| `chapters/ch1_first_contact.yaml` … `ch5_bloom.yaml` | One file per chapter. |
| `CHECKS.md` | Per-chapter numbers and the full check outputs. |
| `GUIDE_PROPOSAL.md` | Proposal to the engine/UI developer: the `guide:` format (on-map move guides), rendering, clearing, fog and blocked-hex handling, mobile, acceptance tests. |
| `tools/check.mjs` | Static checker: buildRules per chapter, ids, continuity, every trigger / action / order / knob name the engine reads, ship-entry fields (`helm: script`), `orders` / `force` order shapes, `ram` targets, a guaranteed fallback for every beat (a `rammed` trigger counts as guaranteed when a guaranteed beat does `ram { force: true }`), and the `guide:` format of GUIDE_PROPOSAL.md. Exit 1 on failure. |
| `tools/engine_check.mjs` | Engine checker: chains every chapter through `buildChapter` / `applyResult` and plays N scripted games per chapter. It reports beat rates, killing blows, which target segment each ram hit, rounds under fire before death and a rounds histogram. Flags: `--engine <checkout> --games N --seed N --chapter chN --no-rails --sloppy --graft --trace <seed> --out file`. |
| `tools/browser_story.cjs` | Playwright run of the whole Story campaign from the play screen (`--fix-fork`, `--graft-only`, `--guide-ui`). Drives story/player.js cutscenes (Skip, the fork choice). |
| `tools/guide_acceptance.mjs` | GUIDE_PROPOSAL.md §11 tests 2-9, 12-13 against the engine's `guideView` and script, plus forced-fallback checks (ch1 `ram seg`, ch2 `from_mine` strikes, ch4A `lock reason`). `node campaign/tools/guide_acceptance.mjs --engine .`; exit 1 on failure. |
| `tools/gen_maps.mjs`, `tools/lib.mjs` | Map generator and shared helpers. |

## Combat v2: how the chapters use it

| block | where | how |
|---|---|---|
| `helm: script` | ch1 finch, wren, kite | `{ id: wren, helm: script }`. The engine locks the ship for the battle and the fleet strip says "flying itself". |
| `orders` | ch1 | Finch `hold` (the screen's middle); Wren / Kite `[hold, fire_at: seed]` from round 1 ("weapons free"); then `{ ram: seed, seg: 0 }` for Wren and `{ ram: seed, seg: 1 }` for Kite. Orders on an **enemy** ship work too: `launch_at: finch`. |
| `launch_at` (straight-line missile) | ch1 | The Seed's missile at Finch, once Finch is inside 7 hexes, so it lands in the same round's flight phase. |
| `ram` (+ `seg`) | ch1 | Through `orders` (closes in, hurls once within this turn's move + 2), striking the named segment first. A stranded rammer (no engine) and the fallback 4 rounds after the hurl use `ram: { ship, target: seed, force: true, seg }`. Triggers `rammed: kite` / `rammed: wren`. |
| `only_targets` | ch1, ch5 | ch1: the Seed's gun shoots only Wren and Kite (the missile is for Finch). |
| `munitions.mine.strikes: engines`, `munitions.mine.hits: 5` | ch2 world_overrides | A charge's 5 hits take both of a Seed's engines, then 3 more on the struck segment. |
| `engines_out` | ch1, ch2, ch3 | ch2 `a_dead` / `b_dead`; ch1 `wren_stranded` / `kite_stranded`; ch3 `twin_a_adrift`. With no engine a ship cannot move. |
| `damage { from_mine }` | ch2 fallbacks | 5 hits that follow `munitions.mine.strikes: engines`, like a real charge. |
| `lock { reason }` | ch4A tow | The refusal text (checked in guide_acceptance.mjs F3). |
| `guide` | ch1, ch2, ch3, ch4A | Built in the engine (`guideView`); ch3 `twin_a_adrift` is new in v3. |
| forced orders' own budget | ch1 | The v1 workaround `turns.command_points.per_turn: 6` is gone. |

## Engine gaps: status at d508720

v2 reported these against 1afc785. All but 7 (not a bug) are fixed in engine 781a5a1, and the
v3 chapters drop the workarounds:

| # | gap | fix (781a5a1) | workaround removed in v3 |
|---|---|---|---|
| 1 | a ship with no working engine still moved (fleet thrust pool) | it cannot move | ch2 `dead_in_water` hold profile; ch1 `hulk` hold profile; ch3 `pinned` hold profile |
| 2 | `engines_out` ignored switched-off engines | `off` counts as out | ch2 flags set next to `disable: [engine]` |
| 3 | scripted `damage from_mine` ignored `strikes: engines` | it follows the setting | ch2 1-hit blast + `disable: [engine]` (now one 5-hit charge) |
| 4 | a ram could not choose the struck segment | `ram { seg }`, order `{ ram, seg }` | ch1 narrows station (`move_to [-1,-1]`, zone `narrows`), Kite's `move_to [0,1]` approach |
| 5 | a new `orders` dropped an unrun plan | `append: true`; an unfired `launch_at` is kept | nothing to remove (ch1 issues one missile order; `append` unused) |
| 6 | `launch_at` marked done with nothing launched | done only after a launch | nothing to remove |
| 7 | a beam stops on enemy missiles in flight | (not a bug) | ch1 still launches inside 7 hexes |
| 8 | lock wording | `lock { reason }` | ch4A tow locks now say why |
| 9 | `munitions.mine.strikes` not in the world file | listed | tools/lib.mjs special case |

Verified by `guide_acceptance.mjs` with the fallbacks forced early: rams hit seg 0 / seg 1 from
wherever the escorts are (F1); a scripted 5-hit charge sets `engines_out` and the Seeds' reach
is empty (F2); the tow refusal reads the reason (F3). The `seg` order form is played in every
ch1 game (rams wren->seed:seg0 and kite->seed:seg1, 40/40).

## Rails and fallbacks per chapter (what guarantees each beat)

| ch | rails | fallbacks |
|---|---|---|
| 1 | protect Kestrel, Wren, Kite (until end; a ram destroys the rammer regardless) and the Seed (until `crippled`); doom Finch by r6. No locks. | doom Finch r6; `disarm_fallback` r9 (switch off any escort laser still working); `hurl` 1 round after `weapons_gone`; a stranded rammer hurls at once (`wren_stranded` / `kite_stranded`, flavor); `ram_fallback` 4 rounds after the hurl (`ram force seg`); `finish_fallback` 4 rounds after `crippled` |
| 2 | protect Kestrel, Sparrow; each Seed until it is dead in the water; Kestrel revealed to the Weave | `a_fallback` / `b_fallback` r9 (a scripted 5-hit charge, `from_mine`); `finish_fallback` r17 |
| 3 | protect Kestrel until `kestrel_exposed`, Sparrow; twin_a until `kestrel_exposed`, twin_b until end (or its withdrawal) | `despair` r6; `li_arrives` r7; `twin_a_adrift` (flavor: twin_b withdraws once twin_a is dead in the water); `pinned` r16 (twin_a's drive burnt out plus doom r21, last resort) |
| 4A | protect every human ship | `husks_dark` r6 (for the gift); `tow` (for the graft) |
| 5 | protect Kestrel, Halcyon, Sparrow until the cliff | `seam_wakes` r5; `li_moves` 2 rounds after the seam |

## Notes for the story developer

- **Every shared id is used**: all 31 scenes and all 23 barks of story pack v2 (7f90ce7), checked by `check.mjs`. ch5's lose scene is now `ch5_defeat` (new in the pack).
  - Intro scenes play from `scenes.intro`.
  - Win scenes: ch1_victory + ch1_salvage, ch2_victory + ch2_salvage, ch3_victory +
    ch3_reunion.
  - Lose scenes: chN_defeat. They are unreachable while the rails hold, but kept for a retry
    screen.
- **Script-played scenes:**
  - ch1_contact, ch1_finch_down, ch1_hurl
  - ch2_contact, ch2_first_mine
  - ch3_split, ch3_despair, ch3_li_arrives
  - ch4a_graft_found, ch4a_outro (played just before `end: win`; `scenes.win` is empty)
  - ch5_bloom, ch5_seam_wakes, ch5_li_moves
  - ch5_cliff, which comes from `scenes.tbc` when the script ends `to_be_continued`.
- **ch4_fork** is the campaign-map scene after ch3. Picking ch4b plays the crew's objection
  and leaves it locked ("Signal lost"); ch4a is the only playable branch. The campaign screen
  needs to implement this; PR #2 only marks ch4b `locked`.
- **Objectives** are `objective:` strings in the scripts, in the player's voice. Rewrite
  them freely. Instructions to the player are **guides** (GUIDE_PROPOSAL.md: ch1 `crippled`,
  ch2 `a_dead` / `b_dead`, ch3 `twin_a_adrift`, ch4A `rails` and `gift`); no guided beat has
  an `objective:` line (v3). ch1 has no objective lines; the remaining ones are ch2 `rails`,
  ch3 `rails` / `despair` / `li_arrives` / `pinned`, ch4A `tow`, ch5 `rails` / `arrival` /
  `seam_wakes`.
- **twin_b withdraws** in ch3 when twin_a is dead in the water (`remove: { ship: twin_b, as:
  withdraw }`, 6/40 sims). A line or bark for it would help; none is used now.
- **New barks (v2):** b1_weapons_gone (both escort lasers gone), b1_hurl_kite / b1_hurl_wren
  (on each `rammed`), b2_dead_in_water (each Seed's `engines_out`).
- **Ship names in barks:** twin_a and twin_b only exist after `split` (r3 in sims). Halcyon
  and Tern only exist after `li_arrives` (r6).

## Assumptions (made without the user; all reversible)

1. **Finch is an unarmed, unplated scout** (core, engine, sensor; no mounts), so one missile
   (3 hits) kills it ("straight through my shield"), and the Seed's gun never targets it
   (`only_targets: [kite, wren]`). Result: the missile kills Finch in 40/40 (doom fallback
   unused). A player's own stray beam can still kill it (the `--sloppy` stand-in: 20/40).
2. **No guns-cold rule.** Kestrel is kept out of the opening by geometry: the three escorts hold
   a line across row 5, the corridor's full width, two rows ahead of Kestrel. A laser cannot
   fire through your own ships and the 3-hex cutter cannot pass the line (Finch's gap is one
   hex). The Seed also keeps 9 hexes off Kestrel (`stand_off`), beyond its laser reach.
3. **The Seed's missile is scripted** (`launch_at` once Finch is inside 7 hexes; hunter
   `launch_range: 0`). Its gun targets the escorts' guns: competent play (the missile for the
   scout, the gun for the armed ships), not a hold-fire. Its hull is laid out so the escorts'
   long shots mostly hit the bow (shields, plate); launcher, magazine and laser are in the
   stern, so it gets its missile away (the magazine in the bow was shot out first in a sim).
4. **Each escort laser has one plate in front** (about two Seed beams): Kite is disarmed r4,
   Wren r6. Both fire at the Seed from round 1 ("weapons free"); Finch holds the middle.
5. **Once both guns are gone the Seed duels Kestrel** (duel profile: hunts Kestrel only,
   keeps 9 hexes off, `launch_range: 5`). The hurl fires the round after the guns go (r7).
   **The ends are named** (`seg`): Wren rams the bow, Kite the stern, 40/40 with and without
   `--sloppy`. A rammer stranded by a shot-out engine hurls where it is (`force`); a forced
   ram with `seg` still strikes its end first. The `crippled` beat still switches off the
   Seed's engine, laser and launcher.
6. **Ram damage** is the world default: 4 hits per living rammer segment (Wren 4, Kite 8),
   piercing shields. The Seed stays protected until both have rammed, so the rams leave a hulk
   and Kestrel makes the kill (40/40).
7. **ch2: the Seeds never scan** (they have never met mines) and **have Kestrel's scent**
   (revealed to them all battle, so they come round the mass, one down each lane). Each Seed is
   protected until it is dead in the water, so a charge's spill-over hits cannot finish it
   outright. A dead-in-water Seed cannot move (gap 1 fixed) and keeps shooting. Its shields now recharge
   normally (Combat v2 keeps them down under sustained fire, so v1's shield burn-out is gone).
8. **`strikes: engines` per touched segment or ship-wide:** the engine does ship-wide (the
   nearest working engine anywhere). The design relies on that: one charge does it.
9. **ch3:** both halves are protected until Li's wing turns the fight (twin_a until
   `kestrel_exposed` = Li + 2 rounds), and twin_b until the end (it withdraws). Without this
   Combat v2 lets Kestrel finish twin_a at Li's arrival (34/40 at r6), or kill twin_b instead
   (6/40, then a 14-21 round tail). **v3:** if twin_a is dead in the water after Li, twin_b
   withdraws (it is not destroyed) so the stand-off ends; 6/40 sims, chapter r11.
10. **ch4A / ch5 profiles:** `timid` became `guard` (`stance: hold`, no scans); `dark` husks
    have laser and engine switched off by the gift; the ch5 siege holds with
    `only_targets: [sparrow, halcyon]`.
11. **Sparrow** is protected in ch2-3 (it is needed through ch5). Tern and Halcyon are
    protected from their arrival.
12. Earlier v1 assumptions still hold: canonical grafted kestrel@ch5, the ch4B node shown
    locked, the ch5 jamming via `set_rule`, and turn limits.

## Risks and open issues

1. **The sims are close to deterministic** (the stock AI makes few random choices), so ch1 and
   ch2 play the same way in all 40 games. Kestrel can fire through Finch's gap once Finch is
   gone; the Seed is protected, and its laser sits in the stern, but a human who strips it
   leaves the escorts' guns to `disarm_fallback` (r9). The `--sloppy` stand-in shows the spread:
   ch1 9-13 rounds, disarm fallback 20/40, Kite stranded 12/40, ram fallback 0/40.
2. **ch4A is short** (r5-9, avg 7) and the husks die in 1 round. It is the breather chapter;
   left as is.
3. **ch5** still wakes the seam on the r5 fallback with the stand-in, and **ch3** despair is
   always the r6 fallback (as in v1).
4. **UI fork bug** (ui/campaign.js `nodeState`): once the fork choice is saved, every other
   open node greys out, so ch5 shows as Locked after ch4A. The browser run uses `--fix-fork`.
   This is not fixable in campaign/; the one-line patch is in CHECKS.md, "Browser run".
5. The engine branch is still moving. `check.mjs`'s name lists are at the top of the file.
6. **The stand-in AI does not close in when blocked** (ch3: twin_a out of every line of fire
   behind the protected twin_b). A human would move; the `twin_a_adrift` withdrawal covers it.

## Requested engine/UI features

1. **On-map move guides:** built (781a5a1 `guideView`, UI overlay). GUIDE_PROPOSAL.md §11
   acceptance tests pass (CHECKS.md, "Guide acceptance"); the one wording difference is that a
   guide whose last target dies with the chapter's win ends with `why: chapter_end` (ch4A hand
   graft) or `clear` (ch1), which §3.4 allows.
2. Open requests (handoff/to-engine.md): the stand-in AI closing in when every shot is blocked;
   a ram `seg` choice for the player's own Graft-era rams, if wanted; a test-only overlay-off
   switch for §11 test 10 (the banner/overlay toggle does not exist, so only "banner hidden
   while a guide is up" is tested).
