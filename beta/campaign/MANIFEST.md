# MANIFEST: Shatkon: The Weave, chapters 1-5 (campaign-v2)

Level design for the story campaign, reworked for **Combat v2**. Branch `campaign-v2` is made
from `origin/campaign-engine` at **1afc785** ("Combat v2: faster fights, missiles at any hex, the
sacrificial hurl, self-flying ships") and changes files under `campaign/` only. No engine, rule
or UI file is changed.

What v2 changes (playtest feedback: fights drag; the aliens visibly fail on purpose):
- **ch1** is rebuilt around the brief's beats. The player flies only Kestrel; Finch, Wren and
  Kite are `helm: script` escorts flown by `orders`. The Seed's missile kills Finch, its gun
  takes the escorts' lasers, then Kite and Wren each `ram` one end of the Seed, and Kestrel
  finishes the hulk. Sparrow is not in ch1 (`roster_add: [sparrow]` in the rewards).
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
| `ships.yaml` | Every hull, keyed `<ship>@<chapter it first flies in>`. New in v2: wren@ch1 (2 hexes), kite@ch1 (1 hex). finch@ch1 is now the unarmed scout; seed@ch1 is re-laid out; kestrel@ch2 keeps four engines; twin@ch3 back to full plates. |
| `maps/ch1_corridor.yaml` | Radius 7. The asteroid corridor, 3-4 hexes wide. South home zone 7 rows deep. |
| `maps/ch2_quiet_water.yaml` | Radius 8, new in v2. An asteroid mass in the middle (rows -3..1, \|x\| <= 4.5) splits the board into a west and an east lane. Scattered rocks and two nebula discs. Zones `belt_w` / `belt_e` (row 1 of each lane, where the charges lie), `lane_w` / `lane_e`. Home zones 6 deep, mines allowed 8 rows. |
| `maps/ch3_splitting.yaml`, `ch4a_ashfall.yaml`, `ch5_bloom.yaml` | Unchanged from v1. |
| `chapters/ch1_first_contact.yaml` … `ch5_bloom.yaml` | One file per chapter. |
| `CHECKS.md` | Per-chapter numbers and the full check outputs. |
| `tools/check.mjs` | Static checker: buildRules per chapter, ids, continuity, every trigger / action / order / knob name the engine reads, ship-entry fields (`helm: script`), `orders` / `force` order shapes, `ram` targets, and a guaranteed fallback for every beat (a `rammed` trigger counts as guaranteed when a guaranteed beat does `ram { force: true }`). Exit 1 on failure. |
| `tools/engine_check.mjs` | Engine checker: chains every chapter through `buildChapter` / `applyResult` and plays N scripted games per chapter. It reports beat rates, killing blows, rounds under fire before death and a rounds histogram. Flags: `--engine <checkout> --games N --seed N --chapter chN --no-rails --sloppy --graft --trace <seed> --out file`. |
| `tools/browser_story.cjs` | Playwright run of the whole Story campaign from the play screen (`--fix-fork`, `--graft-only`). |
| `tools/gen_maps.mjs`, `tools/lib.mjs` | Map generator and shared helpers. |

## Combat v2: how the chapters use it

| block | where | how |
|---|---|---|
| `helm: script` | ch1 finch, wren, kite | `{ id: wren, helm: script }`. The engine locks the ship for the battle and the fleet strip says "flying itself". |
| `orders` | ch1 | Finch `move_toward: seed`. Wren / Kite `hold` (guns cold), then `[hold, fire_at: seed]` at weapons free, `move_toward: kestrel` once toothless, then `ram: seed` (Wren `[move_to: [1,-1], ram: seed]` to come at the stern). Orders on an **enemy** ship work too: `orders: { ship: seed, do: [launch_at: finch] }`. |
| `launch_at` (straight-line missile) | ch1 | The Seed's two missiles at Finch: once Finch is inside 7 hexes, and again 2 rounds later. |
| `ram` | ch1 | Through `orders` (closes in, hurls once within this turn's move + 2). Fallback `ram: { ship, target: seed, force: true }` 3 rounds after the hurl. Triggers `rammed: kite` / `rammed: wren`. |
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
   next. Two rams from the same side therefore hit the same end. *Workaround:* Wren first
   `move_to: [1, -1]` (east of the Seed's stern). *Wanted:* `ram: { ..., seg: N }` (and an
   order form `{ ram: seed, seg: 1 }`).
5. **A new `orders` replaces a plan that has not run yet.** Plans run at the owner's turn
   start. A second `orders` for the same ship before that turn silently drops the first,
   including a one-shot `launch_at`. *Workaround:* the second missile is 2 rounds after the
   first. *Wanted:* `orders: { ..., append: true }`, or keep unfinished one-shot orders.
6. **`launch_at` is marked done even when nothing launched** (no free launcher, no missile,
   no start hex): `runPlan` sets `o.done` after `forced()` returns, whatever happened.
   *Wanted:* mark it done only after `doLaunch`.
7. **A beam stops on enemy missiles in flight.** That's not a bug, but it matters for scripting:
   missiles fly in the flight phase at the end of the round, so a missile launched far from its
   target sits on the board through the other side's turn, and the player's shots at the
   launcher can stop on it. ch1 launches only inside 7 hexes, so the missile lands the same round.
8. **Lock wording.** `lock: { ship: kestrel, actions: [fire, launch] }` refuses with "kestrel is
   not answering the helm" even though Kestrel can still move and scan. *Wanted:* word the
   refusal and the `locked` event by the locked actions, and hide the buttons they forbid.
9. **`munitions.mine.strikes` is not listed in `rules/world_v0.4.yaml`.** `engine/damage.js`
   reads it, but the world file has no default entry; check.mjs reports it as a note, not a
   failure.

Fixed in 1afc785 (v1 gaps now closed): `helm: script`, `orders` and every order kind,
`ram`, straight-line `launch_at`, mine `strikes`, and forced orders spending their own budget
(v1 needed `command_points.per_turn: 6` in ch1).

## Rails and fallbacks per chapter (what guarantees each beat)

| ch | rails | fallbacks |
|---|---|---|
| 1 | protect Kestrel, Wren, Kite (until end; a ram destroys the rammer regardless) and the Seed (until `crippled`); doom Finch by r6; Kestrel guns cold until `finch_down` | doom Finch r6; `disarm_fallback` r9 (switch off any escort laser still working); `ram_fallback` 3 rounds after the hurl (`ram force`); `finish_fallback` 3 rounds after `crippled` |
| 2 | protect Kestrel, Sparrow; each Seed until it is dead in the water; Kestrel revealed to the Weave | `a_fallback` / `b_fallback` r9 (a charge blast plus engines off); `finish_fallback` r17 |
| 3 | protect Kestrel until `kestrel_exposed`, Sparrow; twin_a until `kestrel_exposed`, twin_b until end | `despair` r6; `li_arrives` r7; `pinned` r16 (twin_a's drive burnt out plus doom r21) |
| 4A | protect every human ship | `husks_dark` r6 (for the gift); `tow` (for the graft) |
| 5 | protect Kestrel, Halcyon, Sparrow until the cliff | `seam_wakes` r5; `li_moves` 2 rounds after the seam |

## Notes for the story developer

- **Every shared id is used**: all 30 scenes and all 23 barks, checked by `check.mjs`.
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
  them freely.
- **New barks (v2):** b1_weapons_gone (both escort lasers gone), b1_hurl_kite / b1_hurl_wren
  (on each `rammed`), b2_dead_in_water (each Seed's `engines_out`).
- **Ship names in barks:** twin_a and twin_b only exist after `split` (r3 in sims). Halcyon
  and Tern only exist after `li_arrives` (r6).

## Assumptions (made without the user; all reversible)

1. **Finch is an unarmed scout** (core, engine, sensor, two plates). It never fires in the
   brief's beats. Its two plates let it survive a stray beam, so a missile always lands the kill
   (40/40). The engine's `nothing_but_engines` rule kills a ship left with only core and engine.
2. **First-contact protocol: Kestrel's guns are cold until Finch is lost** (`lock { kestrel,
   actions: [fire, launch], until: finch_down }`, objective "Guns cold"). This is a human rule,
   not a Weave mistake. Without it, Combat v2's lasers (3-4 hits each, 3 on Kestrel) strip the
   Seed's launcher in round 2, before it can fire at Finch, and its gun by round 3, before it can
   disarm the escorts.
3. **The Seed's missiles are scripted** (`launch_at`, hunter `launch_range: 0`). Its gun
   targets the escorts' guns (`target: [wren, kite]`, `only_targets: [wren, kite, kestrel]`):
   competent play (missiles for the scout, the gun for the armed ships), not a hold-fire. It can
   still hit Finch when the scout is in its line (it cannot see the 1-hex scout).
4. **Both escort lasers are exposed** (Wren's alone on its front cell, Kite's its only mount), so
   the Seed's first beam on each takes it (r4 / r6). Weapons free (escorts fire) only from
   `finch_down`.
5. **After losing their guns the escorts fall back on Kestrel for 2 rounds, then hurl.** Kite
   goes straight in and strikes the bow (r9); Wren swings to [1,-1] first and strikes the stern
   (r10). The rams land a turn apart, as the brief allows. **The ends are geometry:** the swing
   point assumes the Seed sits near [0,-2], where it duels Kestrel at stand-off 5 in every
   sim. If a player drags the fight elsewhere, both rams can strike the same end (gap 4). The
   `crippled` beat still switches off the Seed's engine, laser and launcher.
6. **Ram damage** is the world default: 4 hits per living rammer segment (Wren 8, Kite 4),
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
   ch2 play the same way in all 40 games. A human Kestrel that rushes the Seed after Finch dies
   can strip its gun before Kite is disarmed: `disarm_fallback` (r9) then switches the laser off.
   It can also move the duel away from the swing point (assumption 5).
2. **ch4A is short** (r5-9, avg 7) and the husks die in 1 round. It is the breather chapter;
   left as is.
3. **ch5** still wakes the seam on the r5 fallback with the stand-in, and **ch3** despair is
   always the r6 fallback (as in v1).
4. **UI fork bug** (ui/campaign.js `nodeState`): once the fork choice is saved, every other
   open node greys out, so ch5 shows as Locked after ch4A. The browser run uses `--fix-fork`.
   This is not fixable in campaign/; the one-line patch is in CHECKS.md, "Browser run".
5. The engine branch is still moving. `check.mjs`'s name lists are at the top of the file.

