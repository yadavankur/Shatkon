# Status (updated 2026-11-16 by controls)

## Latest (16 Nov, controls): phone-first controls, step 1 of 8 (branch `phone-camera`, PR to main)
- **Why:** a first-time player on a small phone lost the board every time they tapped a ship (the view jumped from 12px hexes to about 60px). Ankur's brief and the approved sequence: (1) camera holds still, (2) landscape layout with fixed zones, (3) phase banner, (4) ships drawn at about 0.70 of their tiles with state on the tile, (5) targeting previews and confirms, (6) info card, (7) PWA, (8) chapter 1 hint, then story as the default entry.
- **Step 1 done:** the view never moves by itself. Selecting a ship, the order buttons, Scan, ending a turn and a new story guide step no longer zoom or pan (pass and play still starts each player on the whole map, because the board turns round). Double-tap one of your own ships that can take orders to zoom in on it, double-tap it again (or the whole-map button) to zoom out; enemy ships never answer a double tap. A minimap (bottom left, only while zoomed in, drawn from the player's own view) shows where you are and where the story guide points; tap it to look there. The page's own double-tap zoom is off (`touch-action`).
- **Decided:** tapping the hull of the selected ship selects it (a one-hex move that ends on its own hull is taken from its green chip only), so a double tap can never start a move. `ui/` only: no rules or engine changes.
- **Checked:** 165 tests pass; headless Chrome at 800x360 with touch: select and order buttons leave the view alone, double tap zooms in and out, enemy double tap ignored, end of turn keeps the view. Not checked on a real phone. The whole board is still too small on a phone (12px hexes) until step 2.

## Latest (16 Nov, controls): phone-first controls, step 2 of 8 (branch `phone-layout`, stacked on `phone-camera`)
- **Landscape phone layout** (`body.compact`: landscape and at most 540px tall, set in `ui/play.js`): the header is hidden and the board fills the screen; whole-board hexes are 22px on an 800x360 phone (were 12px). The board is about as tall as it is wide, so the controls sit in the empty corners beside it: status top left (turn, round, command points, thrust, story objective), minimap, ship card and hint bottom left, view buttons top right (whole map, full screen, menu), orders in a two-column grid with End turn under them bottom right. End turn is always in that corner.
- **Moved in compact:** the mode picker, sound, help and the Play/Lab tabs are at the top of the menu; the order buttons leave the ship card for the bottom right; "Why these points?", the step chips and the +/- zoom buttons are hidden (pinch and double tap zoom). Other screen sizes keep the old layout.
- **Also:** safe-area insets (`viewport-fit=cover`); a full-screen button that also locks landscape where the browser can; a "turn your phone sideways" card on an upright phone, with "Play upright anyway" (kept for the session). **For browser tools that drive an upright phone viewport** (`campaign/tools/browser_story.cjs`): add `?upright` to the URL or set `sessionStorage['shatkon.upright'] = '1'`, or the card covers the page.
- **Checked:** 165 tests; headless Chrome at 800x360 and 667x375 with touch, and 360x800 for the card. Not checked: a real phone, notches, iPhone Safari (it has no full screen for pages: only the installed app, step 7, hides the browser bars there).

## Latest (16 Nov, controls): phone-first controls, step 3 of 8 (branch `phone-banner`, stacked on `phone-layout`)
- **Phase banner:** the small pill is now a band right across the board with a second line: "Your turn" (round, command points), "Enemy turn", "Flight phase", who moves first, the result. It shows on every phase change, including a turn that ends by itself.
- **Decided:** the flight banner shows at the end of every round, whether or not the player can see anything fly ("Nothing in the air that you can see"). Showing it only when something flew would tell the player about hidden missiles. A round with no visible flight is 1.1 seconds longer for it. Against the computer the banner says "Enemy turn" (was "Computer's turn"). The line shown on selecting a ship is shorter.

## Latest (16 Nov, controls): phone-first controls, step 4 of 8 (branch `phone-scale`, stacked on `phone-banner`)
- **Ships are drawn at 0.70 of their tiles** (`SHIP_SCALE` in `ui/board.js`, one number to tune), shrunk about the ship's own centre. A long ship is shrunk less so every segment stays inside its own hex. All three ship styles (ships, schematic, models) go through it; no ship art was changed.
- **State is on the tiles:** every hex a ship occupies is tinted in its owner's colour; a pulsing white rim on the tiles marks a ship you can order (was a blurred halo round the hull); the selected ship's tiles are lit with a solid white rim. Name tags, move markers, targets and the move ghost were already tile-based.
- **Checked:** headless Chrome at 800x360: silhouettes still read at 22px hexes. To be tuned by eye on a real phone.

## Latest (16 Nov, controls): phone-first controls, step 5 of 8 (branch `phone-targeting`, stacked on `phone-scale`)
- **Move preview** follows the hexes the ship will really cross (was one straight arrow).
- **Lasers aim, then fire:** the first tap on a red target draws the beam's line from the gun and a reticle with the hits it will do; the second tap, or the Fire button, shoots; Cancel backs out. Detonate works the same way. Graft and Dock ask in the panel before they happen. The aim line runs only between the player's own ship and a target already in view, so it shows nothing hidden.
- **End turn asks once more** (a second press on the same button) only when there are command points left and a ship that can still act. A turn that ends by itself is unchanged.
- **For the engine and maps bots:** `campaign/tools/browser_story.cjs` now presses the confirm button after "Graft tern" and skips the upright-phone card. I could not run that tool here (no Playwright), so please run it once.
- **Checked:** 165 tests; headless Chrome at 800x360: path preview, first tap does not fire, second tap fires, End turn asks then ends.

## Latest (16 Nov, controls): phone-first controls, step 6 of 8 (branch `phone-card`, stacked on `phone-targeting`)
- **Ship card:** next to hull, moves, lasers and ammo it now shows the launcher (ready / used), the scan (ready / move first / used), and what is making the ship easier or harder to see right now (lit up, engine wake, nebula).
- **Decided: no facing on the card.** A ship's bow is art only (it points away from home or at the nearest enemy in view) and lasers fire in every direction, so showing a facing would teach a rule the game does not have.
- **Words:** the white halo is now a white rim on the ship's hexes (step 4), so the hint lines, the key and the rules card say "white rim". A story chapter opens with one line on double-tap zoom. In the compact layout the status says "Points".

## Latest (16 Nov, maps): who moves first is random
- `turns.first: random` (world file): round 1's first mover comes from the game's seed, so replays and codes agree; boards can pin it; story chapters always start with the player. The play screen says who moves first, and the computer opens by itself when it is first.
- `boards.mjs --both --games 20`: player 1's fleet 12 to 22 of 40 on every board, with a split by moving first / second. King's Guard favours moving second (31 v 16 of 60). Details `docs/design/first-mover.md`; engine review asked in to-engine.md.

## Latest (16 Nov, maps): board follow-ups to the engine bot's AI work
- Reviewed the engine bot's seven commits: 160 tests, campaign checks and page loads all clean, nothing to fix.
- **Cat and Mouse:** Tom's sensor became an engine, so the Hounds move 2 a turn. 17-19 rounds (was 22-25), 21 of 40.
- **Pawn Storm:** radius 12, skiffs start out of reach, a fifth laser on the Leviathan's core. Even by seat (21 v 20 of 40 over 80 games).
- **Beacon Hill:** radius 9, ships 2 rows back. The first mover won 98 of 120 (its missiles landed first); now 64 of 120. The seed-picks-first-player rule is not needed for this board.
- **King's Guard** left (47 of 120 over 60 seeds). All ten boards 14 to 25 of 40 (`boards.mjs --both --games 20`).
- Still Ankur's call: contact and proximity mines `beams_pass`.


## Latest (16 Nov, engine): computer plays the new pieces; post-merge review
- **Done, on main** (commits 891c1a9 to the top of main): the computer handles mines, missiles, decoys, Comets and drones; the beta-to-main merge was reviewed and three things fixed. Write-up: `docs/design/ai-pieces.md`. Notes and asks for maps: top of `to-maps.md`.
- **Numbers:** all ten boards 11 to 25 of 40 for player 1 (`boards.mjs --both --games 20`); King's Guard is the 11 (47 of 120 over 60 seeds). Games to the round limit 32 → 14 of 400. Missiles that go off 16% → 42%. 160 tests pass. Campaign: check.mjs ALL CHECKS PASSED, guide_acceptance 15/15, engine_check all chapters won, **ch3 8.7 rounds (8 or 9)**, unchanged by the AI work.
- **Merge review:** the hand merge was clean. Found and fixed: a laser stopped on a Comet it could not hit (0 hits, a shield nobody could shoot through); the battle log had no words for Comet, sleeper and decoy events and printed "undefined contacts" for scans; `attackRunFor` was dead code. The three adjusted tests are right.
- **Engine changes players will see:** a mine's last-seen mark stays when a ship comes near; beams pass a nimble ship they cannot hit.
- **For Ankur to decide:** (1) contact and proximity mines `beams_pass` like sleepers: Minefield 34 → 26 of 80 for player 1, Fog Bank 36 → 35, numbers in the write-up; not applied. (2) Beacon Hill is won by whoever moves first (98 of 120); a rule that picks the first player from the game's seed would even out mirror boards.
- **Left:** Comet fly-past paths and the death flash on purpose; decoys still draw half the missiles on The Gambit; Cat and Mouse hounds move 1 hex a turn (board, see to-maps). Not played by hand.

## Earlier (16 Nov, maps)
- **Beta is now the main game; beta/ removed** (maps, 16 Nov, Ankur's call): the root site is beta's version merged with root-only work (battle log, sealed codes, engine fixes, gallery). Boards at `boards.html`, design notes in `docs/design/`, old /beta/ links forward to the root. Everyone works on root paths now. See to-engine.md.
- **Beta draws real-looking ships now** (maps, 16 Nov): the facelift hull renderer ported into beta/ui (default "Ships"), Field manual (../docs/) linked from the beta pages. See to-engine.md.
- **PR #28 merged to main** (0ca3d4b): ten reworked boards in beta (`beta/boards.html`), Comet scout, sleeper mine, decoy emitter, fair sight lines, a computer that varies its game, variety-study with review fixes. PR #27 is included (shows as merged). Maps retuned Cat and Mouse, Pawn Storm and Missile Alley afterwards; every board is 10 to 23 of 40. 148 tests pass. Not yet played by hand.
- Remote branches maps-rework, maps-rework-engine, variety-study and balance-and-ai are fully merged and can be deleted.


## Branches and PRs
- **main is the only branch** (39577f7, 15 Nov 23:40 Sydney). Merged today: #19 engine-fixes, #23 battle-log, #20 ship facelift, #22 move markers, #25 feature-campaign-fixes. All other branches were deleted (every one was fully merged). 98 tests pass.
- **Rule for every worker:** start new work from the latest main (`git checkout main && git pull`), use a short-lived branch, open a PR to main, delete the branch after merge.
- **Heads-up:** feature-campaign-fixes was made directly in beta/ (Ankur's playtest), so beta/ now has changes the root game does not (ship panel, halos, outlines, animated moves, ch1 redeploy, Kestrel refit). Do not refresh beta/ from the root game without carrying these over first.

## Older notes (14 Nov, before PR #2 merged)
- **main**: live game + /beta/. Beta = campaign-engine 960a0f7.
- **campaign-engine**: PR #2 → main (open, for Ankur's review). Contains campaign-v2, story v2, all engine work.
- **campaign-v2**: maps bot's final v2 (ch1 rework, guide data in ch1/ch2/ch4A); fully merged into campaign-engine.
- **campaign-v1**: PR #3 closed (superseded).
- **campaign-v3**: maps bot, b83263a, from campaign-engine d508720. Merged into campaign-engine.

## Done recently
- engine-fixes (PR, 15 Nov): undo is refused once a move reveals anything (sighting, lost contact, fuzzy contact, ghost, scan, hit, story beat); a ship hidden in a launch hex no longer blocks it (the missile goes off on it); missiles and drones fly through wrecked segments like beams; the AI reads laser range/hits/falloff from the rules; one hits formula (`beamHits`); game codes are sealed and checked on load; story orders report real bugs as `script_failed`. guide_acceptance 15/15, 86 tests pass. (PR #2 is merged: main = campaign engine.)
- engine 960a0f7: AI moves to find a clear line instead of waiting; campaign map "Test a chapter" (any chapter, enemy personalities, Lab knobs apply to story; never touches the save). PR #3 closed.
- engine e04cd99: campaign-v3 merged; campaign map fork bug fixed (ch5 opens after ch4A); guide overlay off switch `?guides=off`. Browser run ch1→ch5 clean, guide-ui clean, §11 15/15, 75 tests.
- campaign-v3 (maps): no objective lines on guided beats; workarounds for gaps 1–6, 8, 9 removed (ch1 rams use `seg`, ch2 fallback is a 5-hit `from_mine` charge, ch4A locks have a `reason`); ch3's round-21 tail fixed (8 or 11 rounds). ALL CHECKS PASSED, 40/40 games finish every chapter, §11 guide tests 15/15, 75 tests pass.
- campaign-v2 final merged: all 5 chapters build, ALL CHECKS PASSED, 40/40 games finish each; guides show in ch1, ch2, ch4A with no errors. 75 tests pass.
- Engine gaps 1–6, 8, 9 from campaign/MANIFEST.md fixed (7 not a bug). See docs/campaign-engine.md "Combat v2".
- Move guides (campaign/GUIDE_PROPOSAL.md) implemented: lifecycle, `guideView`, map overlay, taps. docs/campaign-engine.md "Move guides".
- All 5 chapters load and finish in engine_check. 74 tests pass.

## In progress / waiting
- **Merged 16 Nov (was: for Ankur to merge): branch `maps-rework-engine`** (16 Nov, PR #28 to main; it contains `variety-study` with the review fixes, `maps-rework`, and the engine for it): ten reworked boards, Comet scout, sleeper mine, decoy emitter, lines of sight that are fair on a mirrored board, and a computer that no longer plays the same game every time. Start at `beta/docs/maps-rework-engine.md`. Merging changes beta for players (see the PR).
- **Reviewed: branch `variety-study`** (16 Nov, pushed, no PR of its own): Stage 1 of the variety study, two new ship kinds (courier, proximity mine) and ten hand-playable boards (`beta/boards.html`). Reviewers start at `handoff/REVIEW-variety-study.md`.
- **Variety study** (16 Nov, branch variety-study, pushed; corrected after review on `maps-rework-engine`: the seat effect in finding 1 was mostly the start spots): Stage 1 screening done, 6,100 games across fleets of 1 to 5 ships, 47 rule variants and 12 pilots. Waiting for Ankur to pick the Stage 2 cells. Findings and candidates: `beta/docs/balance-evidence.md`; summary in to-gamedev.md.
- **balance-and-ai** (16 Nov, PR #27 open to main, beta/ only; everything in it is also in `variety-study` and `maps-rework-engine`, so #27 can be closed once that PR merges): computer opponent with three personalities (aggressive, balanced, defensive) that moves for a shot instead of waiting; missiles wreck a segment, salvo launches; fleet-against-fleet simulation tools (`tools/sim.mjs`, `scenarios.mjs`, `counter.mjs`, test fleets in `beta/rules/sim_fleets.yaml`). Moving now beats sitting still 66 to 73% (the old computer: 22%). 110 tests pass. Results table, bugs not fixed and open questions: to-gamedev.md.
- **feature-campaign-fixes** (now merged into main as #25; made directly in beta/): full-screen board with a ship panel instead of the ship strip, halos on ships you can command, ship outlines, animated ship moves and rams, ship art option, symmetric-hull rule, ch1 redeployed, Kestrel refit reshaped. Not yet on campaign-engine: a beta refresh from that branch would undo it. See to-maps.md and to-story.md.
- story: scene editor `story/editor.html`; no text in art (see to-story.md).
