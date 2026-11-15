# Inbox: maps

## 2026-11-16 · from engine · maps-rework reviewed: what I built, what I changed, new win rates
- Branch `maps-rework-engine` (from `maps-rework` 03b3fc1 + main), PR to main. Full write-up with every command: `beta/docs/maps-rework-engine.md`. Raw output: `beta/docs/logs/maps-rework-engine/`. 148 tests pass; all ten boards load and pass `--codes`.
- **Lopsided mirrors: it was the computer's tie-breaking, as you thought, plus an engine bug.** King's Guard turned 12 ways gave 10-0 or 0-10 by facing alone. A seeded tie-break took it from 40 to 20 of 40 and The Dogleg from 2 to 18. Also: 2% to 7% of sight lines were not the same as their mirror image (a line along a rock edge always fell the same way). Fixed (`hex.sightLine`). Now: First Light 20, Dogleg 23, King's Guard 19, Beacon Hill 21 of 40.
- **Built as asked:** `reveals_on_pass`, `burn_turns`/`burnt_move`, `max_per_fleet`, `holds_objective: false` (also on the courier's sprint drive; such a ship does not contest either), `scan_resist`, `wrecks_segments` + `ignores_shields`, `drift`/`drift_sense`/`prefers`, the `emitter` part, and the AI list: real home edge, drones, shoots mines it sees, unarmed escorts as bait, seeded variety and opening lanes.
- **Changed from your spec, on purpose:** (1) the mine's second segment is the nearest one that is *not* the core's, so one mine cannot sink a three-hex flagship from the end; (2) a mine that creeps and does not go off gives its target a faint contact (`drift_quiet: false`), otherwise there is no turn to react; (3) a scan gives no faint contact on a sleeper beyond 2 hexes either.
- **Rejected:** mine-baiting as a default for the computer. It stalls against a player who also waits (two existing tests failed). It is `ai.tricks.mines_as_bait_rounds`, 0 in the world file.
- **I touched your board files, as little as I could. Please check and keep or undo:**
  - 02, 03, 05, 09: removed the board-level `bay_parts.afterburner` / `munitions.sleeper_mine` lines. Both parts (and `emitter`) are now in `world_v0.4.yaml` with the new numbers; a board copy would hide them.
  - 03 Cat and Mouse: **Comet 3 removed** (Ankur's cap of 2 a fleet). The "never spend all three" lesson needs rewording; the cat may need something back (18 of 40 now).
  - 10 The Gambit: the three Lures carry `emitter`.
  - 02 and 09: `ai.tricks.mines_as_bait_rounds: 8`.
- **Bug that was hiding your mines:** any laser crossing a mine's hex destroyed it unseen, mostly the layer's own guns (37 sleepers swept against 7 that went off, in 20 games). Sleepers now have `beams_pass: true`. Contact and proximity mines still have it (world rule; Ankur to decide).
- **Asks for you (your boards, your call):**
  - **Pawn Storm:** all six skiffs start 6 hexes from the Leviathan with a clear line (42 shots on turn 1), and the Leviathan's centre can only ever reach 7 hexes. It was 20-0 / 0-20 by who moved first. Start the skiffs out of sight; say on the board if the cage is meant.
  - **Missile Alley:** 3 of 40 for the missile fleet once the computer stops replaying one game. Partly the computer's missile-boat flying. Please play it by hand.
  - **Pawn Storm, Fog Bank:** a very deep home zone also changes scan strength (it goes by rows from the home edge).
  - **maps-rework.md** still says three Comets and describes the mine and scout as asks.
- **New win rates** (`node tools/boards.mjs --both --games 20`, player 1's fleet of 40, was → now): 1 First Light 20 → 20 · 2 Minefield 16 → 13 · 3 Cat and Mouse 15 → 18 · 4 Dogleg 2 → 23 · 5 King's Guard 40 → 19 · 6 Pawn Storm 20 → 10 · 7 Beacon Hill 23 → 21 · 8 Missile Alley 25 → 3 · 9 Fog Bank 11 → 10 · 10 Gambit 13 → 22. Under about 6 of 40 is noise. Switch-by-switch table in the doc: drift is what makes the mine bite (Minefield 22 without it, 13 with); the emitter works through its signature (plain Lure 13, emitter 22), not by drawing missiles.
- New tool options: `--both`, `--turned`, `--events`, `--set path=value`.
Status: open

## 2026-11-15 · from engine (for Ankur) · Playtest fixes made in beta/campaign: please take them over
- Ankur playtested ch1 and asked for these. They were made directly in `beta/` on branch `feature-campaign-fixes`, so **port them to your branch** or the next beta refresh will undo them.
- **ch1 deployment:** escorts now hold row 1 (wren [-2,1], finch [-1,1], kite [0,1]), Kestrel [-2,4], Seed [1,-6]. They start 7 hexes from the Seed instead of 10, so the hurl is a short run. engine_check 40 games: 40 wins, 5 to 7 rounds (was 9), every beat natural, no fallback.
- **New rule: hulls must be symmetrical** (world `segments.symmetric_hulls`, default true; `joined` hulls are exempt). buildRules reports a lopsided hull as a problem. Prefer compact shapes (triangle, rhombus, flower).
- **Kestrel's refit was the only lopsided hull.** kestrel@ch3 / @ch4a: the [1,0] segment moved to [1,-1] (a rhombus: [0,-1] [1,-1] [-1,0] [0,0]). kestrel@ch5: same change, so the empty ring hex is now [1,0]. Tern in ch4a starts at [0,6] so it doesn't touch Kestrel at the start.
- Results with all of it: check.mjs ALL CHECKS PASSED; engine_check 40 games: ch1 6.1, ch2 8, ch3 8.8 (8 to 10, no `pinned`), ch4a 6.6, ch5 6 rounds. guide_acceptance 14/15 (F3 failed before these changes too; test 6's stand-in now holds fire while closing).
- `browser_story.cjs`: the ship strip (`#fleet`) is gone; it now selects with `window.__shatkon.select(id)`. Not re-run here (no Playwright in this checkout); CHECKS.md is not updated.
Status: open

## 2026-11-14 · from engine · AI change: no more waiting blind
- Ankur wants the computer to move for a shot rather than sit. engine 960a0f7: when no ship has a clear line, positions with a line on any foe now score higher, and staying blind costs a little.
- 1v1 sims unchanged. engine_check: ch1 9, ch2 8, ch4A 6.5, ch5 6 rounds; **ch3 rose from ~8.4 to ~12.7 rounds** (11–13). Please re-tune ch3 if that's too long (playtests said fights drag).
- New: campaign map → "Test a chapter" lets Ankur edit `ai_profiles` per chapter and send you a "Copy changes" list (paths inside the chapter, e.g. `ai_profiles.hunt_contacts.stance: "charge"`). Expect those as requests.
Status: open

## 2026-11-14 · from engine · v3 merged
- campaign-v3 is merged into campaign-engine (e04cd99) and on /beta/.
- Fork bug fixed as you suggested; `--fix-fork` is no longer needed.
- Overlay off switch for §11 test 10: open `play.html?guides=off`, or set localStorage `shatkon.guides` (`shatkon.beta.guides` on /beta/) to `off`. Add it to `--guide-ui` if you want test 10 automated.
- "Should the AI move to get a shot when every shot is blocked?" Parked for now (low priority); your `twin_a_adrift` fix covers ch3.
Status: open

## 2026-11-14 · from engine · v2 final merged, guides checked
- campaign-v2 (91a512f) is merged into campaign-engine (781a5a1) and on /beta/. check.mjs passes; engine_check 40 games: every chapter finishes, no script_unknown.
- Guides run in ch1 (`crippled`), ch2 and ch4A (`rails`, `gift`), with no errors from `guideView`.
- One engine change from your data: `move_to: { zone }` now offers anchors where **any cell** of the ship is in the zone (same rule as `reached`). Before, the 3-hex Kestrel couldn't fit the ch4A outpost ring and showed as blocked.
- ch3: 6 of 40 games run to round 21 (the rest end at 8). Worth a look if that's not the doom fallback you meant.
- Next for you: remove the `objective:` lines on guided beats (the banner is already hidden while a guide is up) and any workarounds for the fixed gaps (1–6, 8). Branch from campaign-engine and push as campaign-v3.
Status: done (campaign-v3 b83263a)

## 2026-11-14 · from engine · Gaps fixed, guides live
- MANIFEST gaps 1–6, 8, 9 are fixed on campaign-engine (8c9d910). Gap 7 needs nothing. You can remove the workarounds.
  - New options: `ram: { ..., seg: n }`, `orders: { ..., append: true }`, `lock: { ..., reason: "..." }`, world `munitions.mine.strikes`.
- GUIDE_PROPOSAL.md is implemented as written. Please add the `guide:` data to ch1, ch2 and ch4A, and remove the `objective:` lines on guided beats (the banner is hidden while a guide is up anyway).
- Check it with: `node campaign/tools/engine_check.mjs --engine . --games 40`, and `guideView(state, 0)` from engine/index.js for the acceptance tests in §11.
- Branch from campaign-engine (it has everything) and push as campaign-v3.
Status: done (guide data landed in campaign-v2 91a512f)
