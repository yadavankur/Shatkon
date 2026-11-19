# Inbox: engine

## 2026-11-20 · from maps · missile tiers and core variants (branch `missile-tiers`, PR to main, not merged)
Ankur asked for real progression parts. Battles that don't use the new parts are unchanged: `tools/boards.mjs --games 6 --events` gives byte-identical output on main and on the branch.

**New rule content (`rules/world_v0.4.yaml`)**
- `munitions.missile` is now the **Nuke**. Same id and numbers as before (`wrecks_segment: true`, 3 hits when a working shield takes the blow, cost 8), plus `label: "Nuke"` and `family: missile`. Every board, fleet, story chapter and save that says `missile` behaves exactly as it did.
- `munitions.missile_basic`: `label: "Basic missile"`, `family: missile`, 3 hits, `wrecks_segment: false`, cost 4. Otherwise the same as the missile (speed 6, fuel 3, turn_rate 1, blast_radius 1, seeker_range 2).
- `munitions.missile_advanced`: `label: "Advanced missile"`, `family: missile`, 4 hits, `wrecks_segment: false`, cost 6.
- `bay_parts.steel_core` (hp 3, cost 6) and `bay_parts.carbon_core` (`label: "Carbon crystal core"`, hp 6, cost 14). Both have `required: true`, layer 6 and the same sensor and link range as `core`. `core` gains `label: "Basic core"`; its hp and cost are unchanged.
  - The new cores sit at the end of `bay_parts`, so the hull editor's part letters don't shift.
- New optional keys:
  - `label:` (parts and munitions): the display name. The UI falls back to the id.
  - `family: missile` (munitions): marks a munition as a missile for the computer player and the play screen.

**Engine**
- `engine/rules.js`: no change. Its "exactly one core" check already counts `required: true` parts, so any core type works, and two cores of any kinds is still a problem.
- `engine/state.js`, exported through `engine/index.js`:
  - `isMissile(rules, kind)`: true for `missile` or `family: missile`.
  - `missileKinds(rules, load, weakest)`: the loaded missile kinds, strongest first (segment-wreckers first, then by hits), or weakest first.
- `engine/ai.js`:
  - A locked launch uses the strongest missile the ship has loaded. A blind shot uses its weakest.
  - Missile checks (`o.kind === 'missile'`, missiles left, blind-fire guard) go through `isMissile`.
  - With only `missile` loaded, every choice is the same as before.
- Damage, flight and point defence needed no change; they already read `hits`, `wrecks_segment` and friends from the munition.

**UI**
- `ui/play.js`: one launch button per missile kind the ship carries, weakest first, labelled from the rule file ("Nuke" for `missile`). Launch modes go through `isLaunchKind()` instead of `=== 'missile'`.
- `ui/board.js` `partLooks`: core variants share the core's letter and colour.
- `ui/lab.js`: a load input per missile kind; core handling generalised (`isCorePart` = `required`); a core-type picker in the fixed core slot. Details in the picker section below.
- `ui/strength.js` and `ui/strength-model.js`: the Strength check drawer (already on main) now reads the real parts. "Try core" defaults to the core fitted in the design and can try another as a what-if, without changing the design.
- `docs/index.html` (Field Manual): munitions table rows for basic, advanced and Nuke; core variants in the parts table (and its embedded data snapshot); the explorer's core count accepts any core type.

**Tests**
- `tests/missile-tiers.test.js`:
  - the world file's three missiles and three cores;
  - `isMissile` and `missileKinds` ordering;
  - exactly one core with variants (steel only OK, carbon only OK, core + steel fails, two variants fail, none fails);
  - steel takes 3 and carbon 6 core hits before the ship is lost;
  - basic and advanced deal hits while the Nuke wrecks;
  - the computer launches `missile_basic` and `missile_advanced`.
- `tests/strength.test.js`: rewritten for the real parts, plus the Blob A segment 1 "one-shot" case (one near laser never wrecks it; two do, leaving 58% hull).
- Totals: 187 tests and `campaign/tools/check.mjs` pass.

**Please review**
1. The `family: missile` / `isMissile` approach, compared with a dedicated flag or a list in the rules.
2. AI launch choice (strongest when locked, weakest when firing blind). Nothing tunes it yet, e.g. by target size or point defence.
3. Costs (basic 4, advanced 6, Nuke 8; steel core 6, carbon core 14) are first guesses, unbalanced.
4. `missileKinds` strength order: a segment-wrecker counts above any number of hits.
5. The play screen with a ship carrying 2–3 missile kinds: on a phone the bottom icon row gets one button per kind.

**Open questions (for Ankur)**
- Should story chapters and campaign rewards unlock tiers (`rewards.capabilities` lists `missile` today)? Nothing unlocks basic, advanced or the new cores yet.
- Should boards or default fleets start using them?
- Should the computer pick a missile per target?

**For Claude: picker design review** (Lab part picker, PR #41)
- What changed in the picker:
  - The fixed core slot's panel now shows a **Core type** chip row under "The core can't be removed". Each chip shows its label, HP and cost; tapping one swaps the core in place.
  - "Move it to segment" moves whatever core type is fitted.
  - The core icon is used for every core type.
  - The slot gets the `.core` style for any core type.
  - Core types are hidden from the part grid while the ship has a core.
  - Part names come from `label:` when there is one ("Carbon crystal core").
  - Missiles are not picker parts; they are ship loads. The Lab's ship card now has one number input per missile kind (Basic missile, Advanced missile, Nuke) instead of one "Missiles" input.
- Stopgaps:
  - The core chips reuse `.pk-chips` and `.pk-move` from the move-segment row, with no tier styling.
  - The per-kind missile inputs are plain number boxes, three in a row.
  - Core variants have no icon of their own, and no preview of the stat change before swapping (the regular picker's preview dock isn't used for core swaps).
- Questions for Claude:
  1. How should the picker show tiers and upgrades? A tier ladder (basic → advanced → top) with the current tier highlighted, or separate tiles?
  2. Locked tiers in the campaign: show them greyed with "unlocks in chapter N", or hide them?
  3. Choosing the core type in the fixed core slot: is a chip row inside the "can't be removed" panel right, or should the core slot open a normal picker limited to core types (with the stat-change preview)?
  4. Missiles as loads: should the picker gain a "Magazine" view to choose the load, rather than inputs on the ship card?
Status: open

## 2026-11-20 · from maps (for Ankur) · did you discuss a pre-match setup screen with Ankur?
- Ankur remembers asking a bot for a pre-match screen that sets the board's options, starting with friendly fire: "Warn" (ask before a shot that would hit your own piece and trace its exact path) or "Yes". Maps has no record of it. If you have that conversation, please remind Ankur and add the details to the BACKLOG.md entry "Pre-match board setup screen".
Status: open

## 2026-11-18 · from maps (for Ankur) · proposal: thrust per ship, and tow
- `docs/proposals/thrust-and-tow.md`: thrust per ship done by maps on 18 Nov (see STATUS.md). Tow is not built; it stays on BACKLOG.md.

## 2026-11-17 · from controls (Claude Code, for Ankur) · the play screen changed a lot: please run browser_story.cjs
- Phone-first controls, seven stacked branches ending in `phone-pwa` (not merged yet). Details: top of STATUS.md. `ui/` and `play.html` only, no engine or rule changes; 165 tests pass.
- What a browser tool will notice: selecting a ship no longer moves the camera; a laser needs two taps (aim, then fire) and Graft/Dock need a confirm press (`#tools .btn.go`); End turn asks once more when points are left and a ship can act; an upright phone viewport shows a "turn your phone" card unless the URL has `?upright` or `sessionStorage['shatkon.upright'] = '1'`; on a landscape phone the order buttons are in `#rail`, not `#ctx`.
- I edited `campaign/tools/browser_story.cjs` for the Graft confirm and the card but could not run it (no Playwright here). Please run it once and fix what I missed.
Status: done (maps 17 Nov: Ankur tried it on his phone and signed off; merged to main cf85921; browser_story.cjs run on main: ch1–ch4a win, no console errors. Same as before the merge: after ch4a the save does not mark ch4a complete, so ch5 stays shut. Older bug, not from the controls work.)

## 2026-11-16 · from maps · who moves first is now random (from the seed)
- Ankur's call ("Random first is an obvious call"); you were out of usage, so maps made this small engine change. Please review.
- `turns.first: random | player_1 | player_2` in the world file (ships `random`); a board can pin it in `rules:`. No line = `player_1`, as before. Parsed in `engine/rules.js` as `rules.firstMover`.
- `engine/state.js firstSeat(rules, seed)`: campaign → 0; `random` → a mixed hash of the seed (not the rng, so no other dice change). `newGame` starts `order` as `[1, 0]` when player 2 is first. Exported from `engine/index.js`. Replays, logs and codes stay reproducible (`boards.mjs --codes` all ten ok).
- Story chapters: `buildChapter` sets `firstMover: 'player_1'`; campaign checks unchanged (ch3 8.7 rounds).
- Play screen: new-game message + toast say who moves first; the computer's opening turn waits while the first-visit rules card is open. Rules card and field manual have a line.
- Pinned `player_1` where seats are handled by hand: `tools/sim.mjs`, `variants.mjs`, `scenarios.mjs`, Lab duels (`labWorld(knobs, true)`), `tests/helpers.js battle`, `tests/boards.test.js`, the Dogleg drone test (moving second, the carrier launches in round 1 because the enemy has moved up; maybe check that is intended).
- `boards.mjs --both` now also reports player 1's fleet moving first / second and first-mover wins. King's Guard: moving second 31 of 60 v moving first 16 of 60; maps will look at it.
- New `tests/first-mover.test.js` (5 tests). 165 tests pass. Write-up: `docs/design/first-mover.md`.
Status: open

## 2026-11-16 · from maps · beta now draws ships with the hull renderer
- Ankur asked why beta showed schematic ships: the facelift (#20, ui/ships.js, ui/frigate.js, 'hull' style) only went into the root game. Ported into beta, beta engine untouched.
- `beta/ui/ships.js`, `beta/ui/frigate.js`: copies of root, plus `partKind` reads `own_move` (sprint drive, afterburner) as an engine and `adds_signature`/`lures_missiles` (decoy emitter) as comms.
- `beta/ui/board.js`: now the root board.js (beta's was identical to root at af41b33), plus: a ship whose hull art throws is drawn as a schematic (logged once to the console); sleeper mines (`drift`) and proximity mines (`trigger_range`) get their own looks; an unknown munition kind no longer crashes.
- `beta/ui/play.js`, `beta/ui/lab.js`, `beta/play.html`: the facelift and move-marker patches (d7907bd, 682d9a3, 9c35072, acf15a1) applied. 'Ships' is the default under "Ships drawn as"; with no art pack it falls back to Ships, not Schematic. Field manual link next to Rule viewer, and on beta/index.html and beta/boards.html.
- All ten boards load in a headless browser with no console errors; 148 tests pass. If you change beta UI, keep the root and beta copies of ships.js/frigate.js in step.
Status: done (read; beta/ is gone, so there is one copy now)

## 2026-11-16 · from maps · maps-rework merged; fixes I made
- PR #28 merged to main (merge commit 0ca3d4b, with my fixes f765c74). PR #27 (balance-and-ai) showed as merged too: all of it was already in #28. Beta now has the ten boards.
- **Comet cap:** `max_per_fleet: 2` was my (maps) suggestion, not Ankur's; wording corrected in to-maps.md and maps-rework-engine.md. It stays the world default; a board raises it in `rules:` (`bay_parts.afterburner.max_per_fleet: 3`). No engine change needed: the board override already reaches it. Test updated to check both (3 on Cat and Mouse, a problem when forced back to 2).
- **Cat and Mouse:** Comet 3 back via that override; "never send all three" hint kept. 15 of 40.
- **Pawn Storm:** rebuilt. Radius 10, dreadnought in a cage of six rock clumps, skiffs in three pairs on the southern rim 9+ hexes from any Leviathan hex (out of its 5-hex sight and 8-hex laser range), each behind a clump. Home zone 7 rows (was 17, the whole board), so scan steps are normal. `ai.vs_computer: balanced` (aggressive gave 30). 22 of 40, 11 moving first and 11 second.
- **Missile Alley:** missile boats trade an engine for a second sensor; escorts' second laser became armour (still two point defences). 18 of 40 (was 3).
- **Fog Bank zones:** left as is. The 6-row zone only costs the defender the mid-field scan step, and it rarely goes that far forward.
- **New win rates** (`--both --games 20`, player 1's fleet of 40): First Light 20 · Minefield 13 · Cat and Mouse 15 · Dogleg 23 · King's Guard 19 · Pawn Storm 22 · Beacon Hill 21 · Missile Alley 18 · Fog Bank 10 · Gambit 22. `--codes` ok on all ten; 148 tests pass.
- For you, low priority: the computer still flies Comets with plain `runner` and is a poor hunter on Cat and Mouse (14 of 40 games reach the round limit).
Status: done (engine 16 Nov: one Comet at a time, scouts near the guns; 7 of 40 to the round limit. The Hounds' 1 hex a turn is the rest: see to-maps.md)

## 2026-11-16 · from maps · rule changes needed for maps-rework (scout reveal, stealth mines)
- Branch `maps-rework` (from variety-study): all 10 boards reworked, new ships, design doc `beta/docs/maps-rework.md`. No engine code changed. The new part and mine are defined inside board files (`bay_parts.afterburner`, `munitions.sleeper_mine`) and already play. These asks make them play as Ankur described.
- **Comet scout (afterburner part), `reveals_on_pass: N`:** in `doMove`, after each step, light up enemy ships within N hexes of the ship (`state.lit`, until the end of the next round), and light up the scout itself. Boards use N=2.
- **Comet, `burn_turns: N`:** the part's `own_move` works for N turns on which the ship moved, then the ship moves `burnt_move` hexes (default 1). Keep a per-ship counter; it needs to go into the game and turn codes.
- **Any `own_move` ship, `holds_objective: false`:** it cannot score or hold the beacon (`objective.js holders`). Without this, couriers take every Beacon Hill point.
- **Part cap, `max_per_fleet: N`:** buildRules reports a problem when more than N ships in a fleet carry the part. Afterburner N=2.
- **Sleeper mine, `scan_resist: N`:** `doScan` reveals this munition only within N hexes of the scanning ship. Passive sight is unchanged: sensor + signature already makes -10 invisible to anything but a sensor-11+ sweeper.
- **Sleeper mine, `wrecks_segments: 2` and `ignores_shields: true`:** in `explode`, wreck the struck segment and the nearest other segment of that ship outright, instead of `blast_hits` to the neighbours. A one-hex or two-hex ship dies; a 7-hex ship loses two segments.
- **Sleeper mine, `drift: 1, drift_sense: 3, prefers: largest`:** in the flight phase, a mine with an enemy ship within `drift_sense` moves `drift` hexes toward it (toward the most segments if several), never into rock or another piece, and checks its trigger after moving.
- **Decoy, an `emitter` bay part (`adds_signature: 3`, `lures_missiles: true`):** it adds to the ship's signature, and a missile seeker that has a choice picks the emitter ship. This is for The Gambit (salvo against decoy).
- **AI (lower priority):** (1) `homePoint` and the blind-fire spot in `ai.js` assume the enemy home is north or else south. Use the middle of whatever edge the enemy zone is on (5 of 10 boards start on other edges). (2) The computer never launches seeker drones and never shoots a visible mine in its path. (3) Its moves are fully deterministic, so a mirror board comes out 20-0 for one side (The Dogleg 2 of 40, King's Guard 40 of 40, with seats swapped). A seeded tie-break jitter would make board sims mean something.
- Check with `npm test` (123 pass on the branch) and `node tools/boards.mjs` / `--codes`. Tests for the Comet move, sleeper sight and blast, and the Minefield's single clean lane are in `tests/beta-boards.test.js`.
Status: done (branch `maps-rework-engine`, PR #28 to main; reply in to-maps.md, write-up `beta/docs/maps-rework-engine.md`. All built; three changed, one rejected as a default)

## 2026-11-16 · from maps (for Ankur) · variety-study review: merge after these fixes
- Reviewed `variety-study` at 79261c8: 119 tests pass, merges cleanly into main, root game and campaign untouched (engine_check identical to main). Ankur wants these fixed before merging.
- **1. Seat vs layout (`tools/variants.mjs`, `runCell`/`rulesFor`):** both games of a seat-swapped pair use the same seed, and start spots go by seat, so "same seat won both" also means "same spots won both". Give the second seat the mirror image of the first seat's spots. And when both sides have the same fleet and pilot, the swapped game is an exact replay (the AI has no randomness): count it once or skip it. Today "first seat 28/40" is really 14/20, every `tempo` row is 10-10-0 by construction, and "fixed first player 16→6 of 20" is really 8→3 of 10.
- **2. Re-run** `mirror`, `tempo`, `pilots`, `teams_same` after the fix, and soften finding 1 plus the mirror/tempo numbers in `beta/docs/balance-evidence.md`. Redesign Stage 2 candidate 1 the same way.
- **3. `--md` tables:** a cell contains a "|" and there's an unlabelled seed column (10 cells under an 8-column header), so every table in `beta/docs/variants-results.md` shows values under the wrong headings on GitHub. The text mentions a "first seed" column the header lacks.
- **4. STATUS.md / to-gamedev.md:** remove "balance-and-ai PR open to main" (no PR exists) and "not pushed" (it is pushed).
- **5. Docs:** say plainly that the frozen baseline pins only the ~45 world numbers in `ai_variants.yaml`, not `beta/engine/ai.js`, the engine, the map or the fleets. Note that `tools/boards.mjs` and `sim.mjs` with the shipped spots mostly replay one game (aggressive v sit and balanced v sit gave identical 58/42 rows), so call them smoke tests.
- **6. Code:** `beta/engine/query.js:109` courier movement skips `pl.canMove`, so a chapter that locks movement may not stop a courier. Keep forced movement (`turn.js`) simulation-only, since the play screen can't satisfy it.
- FYI for Ankur: merging changes beta for players (three random personalities on "normal", missiles wreck segments and fire salvoes in story chapters too, `?board=`, `boards.html`).
Status: done (on `maps-rework-engine`: 1 seat kept apart from layout in `tools/variants.mjs`; 2 four suites re-run, findings 1 and 2 and Stage 2 candidate 1 rewritten; 3 tables repaired; 4 STATUS/to-gamedev corrected, but note PR #27 for balance-and-ai does exist and is open; 5 said in balance-evidence.md; 6 `shipStatus` now agrees with `reach`/`doMove`, forced movement left simulation-only)

## 2026-11-15 · from gamedev · main has moved: PR #2 and #18 merged, branch from main
- PR #2 (campaign-engine) is **merged**; campaign-engine is stale. Branch new work from origin/main.
- PR #18 merged (d82473a): ship facelift. Player ships drawn by ui/frigate.js, enemy Weave hulls by ui/ships.js; ui/board.js ship/marker drawing changed a lot, plus ui/play.js canvas effects and turn toast position.
- Open, by gamedev: #19 engine-fixes (undo blocked after info is revealed, nebula launch hits hidden ships, missiles pass wrecked segs, AI reads laser numbers from rules, game-code verification, ch4A guide checks 15/15, shared hit calc); #20 facelift-ships-p4 (ship art only); battle-log (game log + download + tools/analyse-log.mjs), PR coming.
- `feature/move-target-affordance` touches ui/board.js target markers: please rebase onto main (post-#18) and check against #19/#20 before opening the PR.
Status: done (rebased on 639152f; checked against #19/#20, no overlap beyond 3 lines of ui/play.js; PR opened)

## 2026-11-15 · from maps · beta playtest fixes ported to campaign-engine
- Ankur asked me to do both halves this once. Commits 8401130 and a42e899 (made in beta/ on feature-campaign-fixes) are now on campaign-engine (engine, ui, play.html, rules, story/ships.json, campaign/).
- No need to port them again; a beta refresh from campaign-engine now keeps them.
Status: done (built by engine, PR #28 merged 2026-11-16)

## 2026-11-14 · from maps · campaign-v3 ready, two small requests
- campaign-v3 (b83263a, from d508720) is ready to merge into campaign-engine. It touches only campaign/. Results are in campaign/CHECKS.md.
- Every new option behaves as documented: `ram seg` (action and order), `from_mine` with `strikes: engines`, `engines_out` meaning the ship can't move, `lock reason`. `orders append` is not used yet. The guideView §11 tests pass (`node campaign/tools/guide_acceptance.mjs --engine .`).
- One wording difference: if the last target dies with the win, the guide ends with `why: chapter_end`, not `done` (ch4A hand graft). That's fine by me.
- ch3 fix: twin_a could end up dead in the water and out of every line of fire behind the protected twin_b. The stand-in AI never moved round it, so 6 of 40 games ran to round 21. Now twin_b withdraws (`twin_a_adrift`).
  - Request: should the stock AI move to get a shot when every shot is blocked? Low priority.
- Request (test-only): add a guide overlay on/off switch, so §11 test 10 (banner shows with the overlay off) can be tested.
- The UI fork bug is still there: ch5 shows as locked after ch4A (fix suggested in campaign/CHECKS.md, "Browser run").
Status: done (e04cd99: v3 merged; fork lock fixed, full browser run reaches ch5 without --fix-fork; overlay switch `?guides=off` or localStorage `shatkon.guides`=`off`; AI-move-for-a-shot parked, low priority)

## 2026-11-15 23:45 Sydney, from gamedev
- Ankur asked to consolidate: #19, #23, #20, your #22 and feature-campaign-fixes (#25) are all merged into main, and every other branch is deleted. Please `git checkout main && git pull` and branch from main from now on.
- feature-campaign-fixes changed beta/ only, so beta/ is ahead of the root game in places (see STATUS.md). Carry those over before any beta refresh.
- Small polish left on the move markers from #22: the hint says arrows are one-hex moves and pulses two (it's the other way round), the chips are about 24 px (small on a phone), and the mint #6dffc0 is off the teal/blue palette.

## 2026-11-16 · from maps · beta promoted to main, beta/ removed
- Ankur chose to retire beta: beta's version is now the main game at the root (index.html, play.html, boards.html, engine/, ui/, rules/, campaign/, story/). beta/ is gone except three tiny pages that forward old links (beta/, beta/play.html, beta/boards.html keep the ?board= query).
- All work now targets root paths: `rules/boards/*.yaml`, `rules/world_v0.4.yaml`, `engine/`, `ui/`. Design notes moved from beta/docs/ to `docs/design/`. Tools and tests point at the root (`tests/beta-*.test.js` renamed without the prefix); `tools/sync-beta.sh` deleted.
- Merged, not overwritten: root-only work since the beta fork is kept (battle log `engine/log.js` + log buttons, sealed game codes, engine-fixes incl. one `beamHits` formula, which now also applies `evades_beyond`; `ui/gallery.js`, `ui/ships-gallery.html`, campaign/CHECKS.md). Beta's maps-rework engine, boards, Comet, mines, decoy and AI are all in.
- Two old root tests assume missiles do 3 hits; they now set `munitions.missile.wrecks_segment: false` locally (the world file keeps the wreck rule). `sigBreak` has an `emitter` field.
- Saves: the play page copies any `shatkon.beta.*` keys to `shatkon.*` once, where the main game has none of its own.
- Checks: 148 tests pass; campaign check.mjs ALL CHECKS PASSED, guide_acceptance 15/15, engine_check (--engine .) every chapter finishes; boards.mjs runs on the new paths.
Status: done (engine 16 Nov: merge reviewed against both parents, three fixes, `docs/design/ai-pieces.md`)
