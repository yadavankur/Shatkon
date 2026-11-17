# Status (updated 2026-11-17 by gamedev)



## Latest (17 Nov, gamedev chat): story cutscenes fit a phone held sideways (branch `cutscene-landscape`, PR to main)
From Ankur: cutscenes look clean in portrait but worse in landscape, and the game is played in landscape. In landscape the dialogue box covered the bottom half of the centre ship art and hid its label ("SEED").
- **Only short landscape screens change** (wider than 6:5 and under 540 px tall). Portrait and desktop are untouched: 116 portrait screenshots at 390x844 are pixel-identical before and after.
- **Dialogue box** is compact (smaller type and padding, three lines tall) and sits between the two portraits (60% of the width). **Centre ship art** is scaled to fit entirely in the space above the box, with its label showing. The **comms frame** and the **Weave glyph row** are fitted the same way; a ship left on screen behind them is dimmed.
- Code: one CSS block at the end of the story CSS (`story/core.js`) plus a small `ResizeObserver` in `story/player.js` that tells the CSS how tall the box is (`--sk-boxh`). No rotate-your-phone screen was added.
- Checked: 165 tests; headless Chrome 800x360, 844x390, 932x430, 1024x461: 14 scenes across chapters 1-5 (ship, comms, glyphs, no-art), nothing runs under the box. Choice screens already fit and are unchanged. Not checked on a real phone. Screenshots: `/workspace/cutscene-shots/` on the box (not in the repo).

## Latest (17 Nov, gamedev chat): the Field Manual fits a phone on its side (branch `manual-landscape`, stacked on `fix-manual-exit`)
From Ankur's screenshot (~1024x461): the logo demo filled the screen, the top bar was tall and overflowed, the sliders took a lot of room.
- **`docs/index.html` + `docs/tools/src/template.html`:** one new block, `@media (max-height:500px)` only, so desktop and portrait are unchanged. Slim 48 px header (Back button + brand + a nav that scrolls sideways), demo drawings capped at 55% of the screen height (aspect kept), smaller hero logo, tighter section gaps, type, cards and sliders, decorative watermarks hidden. Edited by hand in both files (build.py can't run here), so they match.
- Checked: 165 tests; headless Chrome 800x360, 844x390, 932x430: no sideways overflow; logo demo, board, ships, combat and maps sections screenshotted. Before/after in `/workspace/manual-exit-shots/before|after`.

## Latest (17 Nov, gamedev chat): a way out of the Field Manual (branch `fix-manual-exit`, PR to main)
From Ankur: "if I launch the documentation I can't seem to get out of it". The installed game is full screen, so there is no browser back button, and the manual had no link back at all.
- **Field Manual (`docs/index.html` + source `docs/tools/src/template.html`):** a fixed "Back to game" button, top left, 44 px tall, always on screen. It returns to the page you opened the manual from (the landing page, the play screen on the same board so the saved game resumes, the rule viewer). If it can't tell, it goes to the landing page. The build script (`build.py`) writes to `/workspace/shatkon-guide`, which isn't here, so the same edit was made by hand in the template and the built page; they match.
- **Play screen menu:** "Field manual" opens in the same tab (it used to open a new window).
- **Other pages:** `rules.html`, `boards.html` and `ui/ships-gallery.html` got a sticky "Back to game" bar at the top (to the landing page). `story/demo.html` is a developer page, not linked from the game: left alone.
- Checked: 165 tests; headless Chrome 800x360 and 1280x800: landing → manual → Back lands on the landing page; play screen (First Light, one turn ended) → menu → Field manual → Back resumes the same game, ships in the same places; each extra page's button works. Screenshots in `/workspace/manual-exit-shots/`.
- Watch out: a plain `play.html?continue=1` loses the board (saves are kept per board), so a link back to the play screen must keep its `?board=` address. The manual copies the exact address it came from.

## Latest (17 Nov, gamedev chat): landing page (branch `landing`, PR to main)
Ankur's plan (project doc `shatkon-landing-plan-2026-11-17.md`): one simple front door, menus you tap down through.
- **`index.html` is now the landing page:** Continue (the last unfinished game, from `localStorage shatkon.last`), then three doors: **Story** (start here), **Play** → Vs computer (Easy/Normal + board) / Same phone (board) / Two phones (Start: board, you get the game code / Join: paste one), **Workshop** → Ship Lab, Test a chapter, Open board (no fog), Ship gallery, Rule viewer. Footer: How to play (docs/), Settings (labels, sound). The board list is read from `boards.html`, still the one list of boards.
- **The rule viewer moved to `rules.html`.** The manifest's start page is `index.html`.
- **play.html takes `?mode=`**: story, test, cpu (`&level=easy|normal`), pass, all, p1, join; `&new=1` starts a fresh game. The query is dropped afterwards so a reload continues. The in-game mode dropdown is gone: the header (or the compact menu) shows ⌂ Home and the mode being played. The drawer's Rule viewer/Boards links became Home. The campaign map's "Back to skirmish" became ⌂ Home. `openTest()` exported from `ui/campaign.js`.
- Sound is now also kept globally (`shatkon.sfx`), so the landing page's setting reaches every board.
- Checked: 165 tests; headless Chrome 800x360: every landing screen, Vs computer → Cat and Mouse easy starts with that mode, Continue appears afterwards, Story opens the map, `?mode=test` opens Test a chapter, `?mode=p1` shows the game code. No console errors. Not checked on a real phone; `browser_story.cjs` not run (no Node Playwright here).

## Latest (17 Nov, gamedev chat): minimal HUD, icons and bars with labels (branch `hud-minimal`, PR to main)
From Ankur: the screen was too busy and repeated itself. Mock-ups: https://claude.ai/artifact/DPcT5WDa8v2MiB444hhwTQ (project doc `shatkon-hud-redesign-2026-11-17.md`).
- **Turn bar:** round ring, the round strip (words with labels, coloured dashes without), point diamonds (hollow = spent this turn), thrust as one block per point (as long as it needs; a single bar past 24), the part a previewed move spends lit green. The compact layout measures the bar's height (`--hudh`) instead of a fixed 84px.
- **Ship card:** one hull block per segment, badges for signature, "In enemy reach" (−N if hit), lit up / wake / nebula / "there" for a previewed move. Everything else (the sentences, every part) is behind the cut corner tab; on a phone it opens as an overlay. `statChips` is gone (its numbers moved onto the buttons and badges).
- **Order buttons:** icon + pips or a count + label underneath. Laser shows the damage near and far for this ship now (move-first bonus included): "−3 near · −2 far". Scan shows a padlock until the ship has moved. Missile/Drone ammo pips sit on their buttons. End turn and Undo are icon buttons; the laser warning is a badge; "End turn?" and "Last action" always show their words.
- **Labels:** on by default; the "Aa" button (top right, captioned "Labels" even with labels off) hides them. `localStorage shatkon.labels`. Graft/Dock and the confirm row (Move here / Fire / Cancel) keep their text.
- Checked: 165 tests; headless Chrome 800x360, 667x375 and 1280x720: idle, selected, details open, labels off, no console errors. **Not run:** `campaign/tools/browser_story.cjs` (no Node Playwright here); it uses `#tools button:has-text("Graft")` and `#tools .btn.go`, both kept. Not checked on a real phone.

## Latest (17 Nov, engine): the board explains the rules while you play (branch `ux-clarity`, PR to main)
From Ankur's playtest: the game felt one-sided because the rules behind it were invisible (the enemy's 3-hit shots were the move-first bonus, his launcher died to the first shot, double turns looked like the computer cheating, he skipped a turn by double-tapping End turn).
- **Fire mode** shades every hex the selected ship's lasers reach, with −3 / −2 on each hex and a big −N on enemies in reach; the hint spells out "move 1 hex first: +1". Fire opens whenever a laser is ready ("show reach"), not only with a target. `E.beamField`.
- **Move mode**: a red ring on move markers where a visible enemy could shoot the ship next turn (worst case: it steps closer and fires, with the strongest laser in the rules, since you may not know what it carries); the ship panel says "In enemy reach −N" / "There −N" for a previewed move. `E.dangerMap`.
- **Incoming enemy missiles** you can see: red dashed line along their heading for this round, red ring and "missile hits this round" where it runs into your ship. Uses only position and heading (no lock or route). `E.incoming`.
- **"Flight phase" is now "Missiles fly"** (banner, help, hints). A round with nothing in the air shows "End of round".
- **Round strip** in the turn bar, now also on phones: You ▸ Enemy ▸ Missiles fly ▸ You again. The "Your turn" banner says "You go again: the first move swaps every round" on a double turn.
- **Ending a turn with nothing done** opens a pop-up (Keep playing / End turn anyway; the end button wakes after 0.6 s). Ending with points left after acting still asks on the button, and a second press within 0.5 s is ignored.
- Help text fixed: lasers are 3 hits up to 4 hexes, 2 up to 8, +1 after moving (it said 2 and 1).
- Checked: 165 tests; headless Chrome 800x360 phone: screenshots of each piece, no console errors; browser_story ch1–ch4a win (ch4a save bug unchanged).
## Latest (17 Nov, engine): battle logs carry times; the "no seed" puzzle explained (branch `log-timestamps`, PR to main)
- **Times:** the play page writes `started` (new game or chapter), `at` on each finished turn, and `updated` (every save) into the save; the battle log shows `started`, `lastPlayed` and each turn's `at`, plus a "Played:" line in the summary. Times are UTC. They are kept out of `hashState` (codec SKIP), so replays and the two-phone sync are unaffected. Turns from an older save or from the other phone's game code are not back-stamped.
- **Why a game played today had no seed:** on 16 Nov the boards lived in `beta/`, whose engine had no seed (it went into the main engine on 15 Nov). When beta became the main game, the page copied the beta saves across, so opening `?board=NAME` can restore a seedless beta game. Every new game since has a seed: 48 of 48 test games (default board, all 10 boards, all 5 chapters, saved and reloaded) replay exactly. The log's note now says this instead of "started before battle logs existed".
- Checked: 165 tests; headless Chrome on `?board=01_first_light`: times present across a reload, log replays.
## Latest (17 Nov, engine): double-tap zoom no longer lags (branch `smooth-zoom`, PR to main)
- **Why:** double-tap zoom felt slow on a phone. Two causes: the second tap rebuilt the whole board before the glide could start (51–115 ms blocked on a 4x-slowed CPU), and the glide changed the SVG `viewBox` every frame, so the whole board (glows, ship art) was redrawn about 60 times a second.
- **Fix (`ui/play.js` camTween, `play.html`):** the glide now moves the picture already on screen with a CSS transform on the board's own GPU layer and redraws once, at the end, at the new detail level. Its clock starts on the first frame. A finger on the board ends a glide at once, and the end-of-glide redraw waits for that finger to lift, so a tap is never lost. Double-tap timing uses the touch's own timestamp (`ev.timeStamp`), so a busy phone cannot turn a double tap into two single taps.
- **Checked:** 165 tests; headless Chrome 800x360, touch, CPU 4x slower: the tap handler now blocks 1–6 ms (was 51–115). Glide frame times look about the same in headless, which draws in software, so the GPU part needs a real phone. browser_story.cjs: ch1–ch4a win, no console errors (the ch4a save bug is unchanged). **Not checked on a real phone.**


## Latest (17 Nov, maps): phone controls merged
- Ankur tested the phone controls on his phone and signed off. phone-pwa (steps 1–7) is merged to main. 165 tests pass. browser_story.cjs: ch1–ch4a play through with no errors, but **ch4a is not saved as complete, so ch5 never opens** (the same before the merge).
- Next for controls: step 8, story chapter 1 as the default entry for new players (signed off by playing it).

## Needs attention (17 Nov, a quick read of the handoff notes by controls; nothing here was re-tested)
- **For Ankur, controls:** seven stacked branches are pushed with no PRs open (`phone-camera` → `phone-layout` → `phone-banner` → `phone-scale` → `phone-targeting` → `phone-card` → `phone-pwa`; the last one holds everything). main has not moved since they were cut (223ac1c). Not yet tried on a real phone. Story as the default entry waits for your sign-off.
- **For engine or maps:** run `campaign/tools/browser_story.cjs` once on `phone-pwa`. Controls edited it (Graft confirm, upright-phone card) without being able to run it. The whole play screen changed, so anyone with open work on `ui/play.js`, `ui/board.js` or `play.html` should expect conflicts.
- **Ownership table in `handoff/README.md`** has no row for the controls work (it touched `ui/` and `play.html`, listed under engine) and still names old branches (`campaign-engine`, `campaign-vN`). Ankur to say how he wants it listed.
- **Move-marker polish from #22** (to-engine.md, 15 Nov): the wrong hint wording is gone (controls step 3 replaced that line). Still open: the mint `#6dffc0` is off the palette. The chips measured about 24px before; with the bigger board they should be larger on a phone, not re-measured.
- **Ankur's open calls, unchanged:** contact and proximity mines `beams_pass`; Stage 2 cells for the variety study and the questions with it (to-gamedev.md, "Status: open", twice). Some of the older questions there look answered by later work (missiles in the story, computer variety, root-or-beta) and could be closed by whoever owns them.
- **Stale lines further down this file:** "main is the only branch" (15 Nov) is no longer true; remote branches `maps-rework`, `maps-rework-engine`, `variety-study` and `balance-and-ai` are merged and still on GitHub, waiting to be deleted; the "In progress / waiting" list still describes PR #27 and #28 as pending although both are merged.

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

## Latest (16 Nov, controls): phone-first controls, step 7 of 8 (branch `phone-pwa`, stacked on `phone-card`)
- **Installable:** `manifest.webmanifest` (full screen, landscape, starts at `play.html`), icons in `icons/` (the brand star from `docs/brand/favicon.svg`, drawn inside the maskable safe zone), and `sw.js`. The menu's Game card has an "Install Shatkon" button where the browser offers one, and otherwise says how to add the game to the home screen.
- **`sw.js` is network first:** with a connection every file comes fresh from the server, so a deploy by any worker is never held back by an old copy; the kept copy (one per file, `?t=` ignored) is used only with no signal. It covers the whole site folder, so the rule viewer, boards page and field manual also open offline once visited. **If a page ever seems stale, it is not the worker**: it only answers from its copy when the network fails.
- **Checked:** headless Chrome on localhost: the manifest and icons load, the worker activates and controls the page, and the game opens with the network switched off. Not checked: the install prompt itself, iPhone "Add to Home Screen", the landscape lock of the installed app, notch insets.
- **Left for Ankur (step 8):** story chapter 1 as the default entry for new players. Not changed, as agreed, until the controls are signed off on a phone.

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
