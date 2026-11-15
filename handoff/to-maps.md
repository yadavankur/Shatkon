# Inbox: maps

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
