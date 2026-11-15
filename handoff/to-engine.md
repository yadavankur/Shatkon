# Inbox: engine

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

## 2026-11-16 · from maps (for Ankur) · variety-study review: merge after these fixes
- Reviewed `variety-study` at 79261c8: 119 tests pass, merges cleanly into main, root game and campaign untouched (engine_check identical to main). Ankur wants these fixed before merging.
- **1. Seat vs layout (`tools/variants.mjs`, `runCell`/`rulesFor`):** both games of a seat-swapped pair use the same seed, and start spots go by seat, so "same seat won both" also means "same spots won both". Give the second seat the mirror image of the first seat's spots. And when both sides have the same fleet and pilot, the swapped game is an exact replay (the AI has no randomness): count it once or skip it. Today "first seat 28/40" is really 14/20, every `tempo` row is 10-10-0 by construction, and "fixed first player 16→6 of 20" is really 8→3 of 10.
- **2. Re-run** `mirror`, `tempo`, `pilots`, `teams_same` after the fix, and soften finding 1 plus the mirror/tempo numbers in `beta/docs/balance-evidence.md`. Redesign Stage 2 candidate 1 the same way.
- **3. `--md` tables:** a cell contains a "|" and there's an unlabelled seed column (10 cells under an 8-column header), so every table in `beta/docs/variants-results.md` shows values under the wrong headings on GitHub. The text mentions a "first seed" column the header lacks.
- **4. STATUS.md / to-gamedev.md:** remove "balance-and-ai PR open to main" (no PR exists) and "not pushed" (it is pushed).
- **5. Docs:** say plainly that the frozen baseline pins only the ~45 world numbers in `ai_variants.yaml`, not `beta/engine/ai.js`, the engine, the map or the fleets. Note that `tools/boards.mjs` and `sim.mjs` with the shipped spots mostly replay one game (aggressive v sit and balanced v sit gave identical 58/42 rows), so call them smoke tests.
- **6. Code:** `beta/engine/query.js:109` courier movement skips `pl.canMove`, so a chapter that locks movement may not stop a courier. Keep forced movement (`turn.js`) simulation-only, since the play screen can't satisfy it.
- FYI for Ankur: merging changes beta for players (three random personalities on "normal", missiles wreck segments and fire salvoes in story chapters too, `?board=`, `boards.html`).
Status: open

## 2026-11-15 · from gamedev · main has moved: PR #2 and #18 merged, branch from main
- PR #2 (campaign-engine) is **merged**; campaign-engine is stale. Branch new work from origin/main.
- PR #18 merged (d82473a): ship facelift. Player ships drawn by ui/frigate.js, enemy Weave hulls by ui/ships.js; ui/board.js ship/marker drawing changed a lot, plus ui/play.js canvas effects and turn toast position.
- Open, by gamedev: #19 engine-fixes (undo blocked after info is revealed, nebula launch hits hidden ships, missiles pass wrecked segs, AI reads laser numbers from rules, game-code verification, ch4A guide checks 15/15, shared hit calc); #20 facelift-ships-p4 (ship art only); battle-log (game log + download + tools/analyse-log.mjs), PR coming.
- `feature/move-target-affordance` touches ui/board.js target markers: please rebase onto main (post-#18) and check against #19/#20 before opening the PR.
Status: done (rebased on 639152f; checked against #19/#20, no overlap beyond 3 lines of ui/play.js; PR opened)

## 2026-11-15 · from maps · beta playtest fixes ported to campaign-engine
- Ankur asked me to do both halves this once. Commits 8401130 and a42e899 (made in beta/ on feature-campaign-fixes) are now on campaign-engine (engine, ui, play.html, rules, story/ships.json, campaign/).
- No need to port them again; a beta refresh from campaign-engine now keeps them.
Status: open

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
