# MANIFEST: Shatkon: The Weave, chapters 1-5 (campaign-v2)

Level design for the story campaign, reworked for **Combat v2**. Branch `campaign-v2` was made
from `origin/campaign-engine` at **1afc785** ("Combat v2: faster fights, missiles at any hex, the
sacrificial hurl, self-flying ships"). Then `origin/campaign-engine` **7f90ce7** ("Story pack v2:
characters, 31 scenes, 23 barks, art, cutscene player") was **merged** in (merge commit 015868e;
merged rather than rebased so the already-pushed branch needs no force-push). `engine/` is the
same in both. Only files under `campaign/` are changed; no engine, rule, story or UI file is.

**Requested engine/UI features: see [GUIDE_PROPOSAL.md](GUIDE_PROPOSAL.md)** (on-map move
guides: "move here" overlay instead of the objective banner) and the list at the end of this file.

What v2 changes (playtest feedback: fights drag; the aliens visibly fail on purpose):
- **ch1** is rebuilt around the brief's beats, **with no invented rules** (no guns-cold lock,
  no hold-fire): deployment, hull layout, AI targeting, `orders` and fallbacks do the pacing.
  The player flies only Kestrel; Finch, Wren and Kite are `helm: script` escorts flown by
  `orders`, screening the corridor ahead of Kestrel. The Seed's missile kills Finch, its gun
  takes the escorts' lasers, then Wren rams the Seed's bow and Kite its stern, and an on-map
  guide (objective line as fallback) brings Kestrel in to finish the hulk. Sparrow is not in
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
| `maps/ch1_corridor.yaml` | Radius 7. The asteroid corridor, 3-4 hexes wide. South home zone 7 rows deep. Zone `narrows` ([-1,-1]): the Seed's station for the duel. |
| `maps/ch2_quiet_water.yaml` | Radius 8, new in v2. An asteroid mass in the middle (rows -3..1, \|x\| <= 4.5) splits the board into a west and an east lane. Scattered rocks and two nebula discs. Zones `belt_w` / `belt_e` (row 1 of each lane, where the charges lie), `lane_w` / `lane_e`. Home zones 6 deep, mines allowed 8 rows. |
| `maps/ch3_splitting.yaml`, `ch4a_ashfall.yaml`, `ch5_bloom.yaml` | Unchanged from v1. |
| `chapters/ch1_first_contact.yaml` … `ch5_bloom.yaml` | One file per chapter. |
| `CHECKS.md` | Per-chapter numbers and the full check outputs. |
| `GUIDE_PROPOSAL.md` | Proposal to the engine/UI developer: the `guide:` format (on-map move guides), rendering, clearing, fog and blocked-hex handling, mobile, acceptance tests. |
| `tools/check.mjs` | Static checker: buildRules per chapter, ids, continuity, every trigger / action / order / knob name the engine reads, ship-entry fields (`helm: script`), `orders` / `force` order shapes, `ram` targets, a guaranteed fallback for every beat (a `rammed` trigger counts as guaranteed when a guaranteed beat does `ram { force: true }`), and the `guide:` format of GUIDE_PROPOSAL.md. Exit 1 on failure. |
| `tools/engine_check.mjs` | Engine checker: chains every chapter through `buildChapter` / `applyResult` and plays N scripted games per chapter. It reports beat rates, killing blows, which target segment each ram hit, rounds under fire before death and a rounds histogram. Flags: `--engine <checkout> --games N --seed N --chapter chN --no-rails --sloppy --graft --trace <seed> --out file`. |
| `tools/browser_story.cjs` | Playwright run of the whole Story campaign from the play screen (`--fix-fork`, `--graft-only`). Drives story/player.js cutscenes (Skip, the fork choice). |
| `tools/gen_maps.mjs`, `tools/lib.mjs` | Map generator and shared helpers. |

## Combat v2: how the chapters use it

| block | where | how |
|---|---|---|
| `helm: script` | ch1 finch, wren, kite | `{ id: wren, helm: script }`. The engine locks the ship for the battle and the fleet strip says "flying itself". |
| `orders` | ch1 | Finch `hold` (the screen's middle); Wren / Kite `[hold, fire_at: seed]` from round 1 ("weapons free"); then `ram: seed` for Wren and `[move_to: [0,1], ram: seed]` for Kite (east of the Seed's bow column, so the stern is nearer). Orders on an **enemy** ship work too: `launch_at: finch`, and `move_to: [-1,-1]` (the narrows) once the escorts are toothless. |
| `launch_at` (straight-line missile) | ch1 | The Seed's missile at Finch, once Finch is inside 7 hexes, so it lands in the same round's flight phase. |
| `ram` | ch1 | Through `orders` (closes in, hurls once within this turn's move + 2). Fallback `ram: { ship, target: seed, force: true }` 4 rounds after the hurl. Triggers `rammed: kite` / `rammed: wren`. |
| `only_targets` | ch1, ch5 | ch1: the Seed's gun shoots only Wren and Kite (the missile is for Finch). |
| `munitions.mine.strikes: engines`, `munitions.mine.hits: 5` | ch2 world_overrides | A charge's 5 hits take both of a Seed's engines, then 3 more on the struck segment. |
| `engines_out` | ch2 | `a_dead` / `b_dead` fire on `engines_out: seed_a` / `seed_b`. |
| forced orders' own budget | ch1 | The v1 workaround `turns.command_points.per_turn: 6` is gone. |

## Engine gaps found (campaign-engine 1afc785), with exact semantics

1. **A ship with no working engine still moves.** `reach()` limits a move by the fleet's
   shared pool: `moveCap = floor(fleet thrust income / fleet segments) + cap bonus`, and
   `pl.thrust`. The ship's own engines are never checked. So seed_a, engines gone, still moves on
   seed_b's thrust. *Workaround:* the dead-in-water beats switch the Seed's AI to `stance:
   hold`. *Wanted:* `reach(state, ship)` returns `[]` (and `doMove` refuses) when the ship has no
   engine with `hp > 0 && !off`; `engines_out` would then mean "cannot move" by itself.
2. **`engines_out` ignores switched-off engines.** It tests `p.t === 'engine' && p.hp > 0`
   only. An engine turned off with `disable` (`p.off`) still counts as working. *Workaround:* the
   ch2 fallbacks set a flag next to `disable: [engine]`. *Wanted:* treat `p.off` as not working.
3. **Scripted mine damage ignores `strikes: engines`.** `damage: { from_mine: true }` calls
   `applyHits` on the given segment (outer layers first); only a real `explode()` uses
   `strikeEngines`. *Workaround:* the fallback blast is 1 hit, then `disable: [engine]`.
   *Wanted:* `from_mine` follows `munitions.mine.strikes`.
4. **A ram cannot choose the struck segment.** `ram()` sorts the target's segments by distance
   from the rammer's footprint (ties: lower index first) and starts there. On a protected ship
   the core segment can never be wrecked, so all the hits stay on it and nothing spills to the
   next. Two rams from the same side therefore hit the same end. *Workaround:* the Seed takes
   station in the narrows ([-1,-1]: bow [-1,-1], stern [0,-1]); Wren comes up the west side
   (a tie goes to the bow) and Kite first `move_to: [0, 1]` (both cells east of the bow's
   column: strictly nearer the stern). *Wanted:* `ram: { ..., seg: N }` (and an order form
   `{ ram: seed, seg: 1 }`).
5. **A new `orders` replaces a plan that has not run yet.** Plans run at the owner's turn
   start. A second `orders` for the same ship before that turn silently drops the first,
   including a one-shot `launch_at`. *Workaround:* ch1 issues one missile order. *Wanted:*
   `orders: { ..., append: true }`, or keep unfinished one-shot orders.
6. **`launch_at` is marked done even when nothing launched** (no free launcher, no missile,
   no start hex): `runPlan` sets `o.done` after `forced()` returns, whatever happened.
   *Wanted:* mark it done only after `doLaunch`.
7. **A beam stops on enemy missiles in flight.** That's not a bug, but it matters for scripting:
   missiles fly in the flight phase at the end of the round, so a missile launched far from its
   target sits on the board through the other side's turn, and the player's shots at the
   launcher can stop on it (the launcher's own later beams too). ch1 launches only inside 7
   hexes, so the missile lands the same round; launched at 8 it was shot down by Wren's beam.
8. **Lock wording.** `lock: { ship: kestrel, actions: [fire, launch] }` refuses with "kestrel is
   not answering the helm" even though Kestrel can still move and scan. *Wanted:* word the
   refusal and the `locked` event by the locked actions, and hide the buttons they forbid.
   (ch1 no longer uses a partial lock; ch4A's tow locks `all`.)
9. **`munitions.mine.strikes` is not listed in `rules/world_v0.4.yaml`.** `engine/damage.js`
   reads it, but the world file has no default entry; check.mjs reports it as a note, not a
   failure.

Fixed in 1afc785 (v1 gaps now closed): `helm: script`, `orders` and every order kind,
`ram`, straight-line `launch_at`, mine `strikes`, and forced orders spending their own budget
(v1 needed `command_points.per_turn: 6` in ch1).

## Rails and fallbacks per chapter (what guarantees each beat)

| ch | rails | fallbacks |
|---|---|---|
| 1 | protect Kestrel, Wren, Kite (until end; a ram destroys the rammer regardless) and the Seed (until `crippled`); doom Finch by r6. No locks. | doom Finch r6; `disarm_fallback` r9 (switch off any escort laser still working); `hurl` 3 rounds after `weapons_gone` if the Seed is not on station; `ram_fallback` 4 rounds after the hurl (`ram force`); `finish_fallback` 4 rounds after `crippled` |
| 2 | protect Kestrel, Sparrow; each Seed until it is dead in the water; Kestrel revealed to the Weave | `a_fallback` / `b_fallback` r9 (a charge blast plus engines off); `finish_fallback` r17 |
| 3 | protect Kestrel until `kestrel_exposed`, Sparrow; twin_a until `kestrel_exposed`, twin_b until end | `despair` r6; `li_arrives` r7; `pinned` r16 (twin_a's drive burnt out plus doom r21) |
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
  them freely. Instructions to the player are now **guides** (GUIDE_PROPOSAL.md: ch1
  `crippled`, ch2 `a_dead` / `b_dead`, ch4A `rails` and `gift`); the `objective:` line on those
  beats is only a fallback until the overlay exists. ch1 has no other objective lines.
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
5. **The Seed takes station in the narrows once both guns are gone** (duel profile `stance:
   hold`, `orders: move_to [-1,-1]`): it waits for the cutter where the corridor opens. The
   hurl fires when it is there (r7), or 3 rounds after the guns go. **The ends are geometry**
   (gap 4): Wren rams the bow (r9), Kite swings to [0,1] and rams the stern (r10), 40/40. A
   forced ram from elsewhere (the r4-after-hurl fallback) can hit the bow twice (`--sloppy`:
   11/40). The `crippled` beat still switches off the Seed's engine, laser and launcher.
6. **Ram damage** is the world default: 4 hits per living rammer segment (Wren 4, Kite 8),
   piercing shields. The Seed stays protected until both have rammed, so the rams leave a hulk
   and Kestrel makes the kill (40/40).
7. **ch2: the Seeds never scan** (they have never met mines) and **have Kestrel's scent**
   (revealed to them all battle, so they come round the mass, one down each lane). Each Seed is
   protected until it is dead in the water, so a charge's spill-over hits cannot finish it
   outright. A dead-in-water Seed holds (gap 1) and keeps shooting. Its shields now recharge
   normally (Combat v2 keeps them down under sustained fire, so v1's shield burn-out is gone).
8. **`strikes: engines` per touched segment or ship-wide:** the engine does ship-wide (the
   nearest working engine anywhere). The design relies on that: one charge does it.
9. **ch3:** both halves are protected until Li's wing turns the fight (twin_a until
   `kestrel_exposed` = Li + 2 rounds), and twin_b until the end (it withdraws). Without this
   Combat v2 lets Kestrel finish twin_a at Li's arrival (34/40 at r6), or kill twin_b instead
   (6/40, then a 14-21 round tail).
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
   ch1 10-13 rounds, disarm fallback 20/40, ram fallback 11/40.
2. **ch4A is short** (r5-9, avg 7) and the husks die in 1 round. It is the breather chapter;
   left as is.
3. **ch5** still wakes the seam on the r5 fallback with the stand-in, and **ch3** despair is
   always the r6 fallback (as in v1).
4. **UI fork bug** (ui/campaign.js `nodeState`): once the fork choice is saved, every other
   open node greys out, so ch5 shows as Locked after ch4A. The browser run uses `--fix-fork`.
   This is not fixable in campaign/; the one-line patch is in CHECKS.md, "Browser run".
5. The engine branch is still moving. `check.mjs`'s name lists are at the top of the file.

## Requested engine/UI features

1. **On-map move guides** (replaces the objective banner for instructions): the full proposal,
   with the chapter-file format, rendering, clearing rules, fog and blocked-hex handling,
   mobile behaviour and acceptance tests, is **[GUIDE_PROPOSAL.md](GUIDE_PROPOSAL.md)**. Short
   form: an entry-level `guide: { ship, clear?, steps: [ { label, move_to? (hex | hexes |
   {zone} | {near, within}), path?, fire_at? | launch_at? | graft? | dock?, done?, timeout? } ] }`
   on a beat; it starts when the beat fires, shows one step at a time, and a step clears on
   `done` (`reached` / `fired` / `launched` / `grafted` / `docked` or any script trigger).
   The current engine reads only `when` / `do`, so it ignores the field (no `script_unknown`
   in 40 games of every chapter). Used in ch1 `crippled`, ch2 `a_dead` / `b_dead`, ch4A `rails`
   and `gift`.
2. The engine gaps above, items 1-6 and 8 (each with its *Wanted* line).
