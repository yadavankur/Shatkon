## Latest (23 Nov evening, gamedev chat): playtest fixes (merged)
- Short battle log for rapid mode (default "Download battle log"): board, changed settings, seed, one line of moves a tick, recap; ~10x smaller. "Full log" keeps every event. Replay: `node tools/replay_short.mjs <file>`. Logs now list settings changed from the board's defaults.
- Aimed (blind) launches: a second tap on the aimed hex sends it (the Launch button was hidden in the drawer in rapid mode).
- Rapid: ship name tags only on the tapped ship. Wingman bonus: big toasts when offered and when it fires. Missile hits: big flash, shock ring, shake and a toast.
- End screen: "Went silent" row, losses coloured by whose ship it was, a Salvage card (earned, spent, upkeep, income a tick, what each purchase did).
- Settings sheet: dot marks each default, gold dot on changed settings, Reset to defaults.
- Turret range 4 -> 6 (setting 4/6/8): turrets were shot from out of reach.
- 258 tests pass. `sw.js` cache `shatkon-offline-v16`.

## Latest (23 Nov, gamedev chat): Frontier, slice 4: upgrades and resupply; smaller battle logs (merged)
- Buy → Upgrade (◈ 10, once per ship: +1 laser range, faster shields, +1 core sensor, +1 armour plate) and Resupply (◈ 5, +1 missile). Upgrades swap parts for `_up` copies added by rapidRules. Details: [docs/design/frontier.md](../docs/design/frontier.md).
- PR #56: rapid battle logs about a quarter of the size (ship snapshots every 10th tick, compact JSON download, no empty recap lines).
- 257 tests pass. `sw.js` cache `shatkon-offline-v15`.

## Latest (23 Nov, gamedev chat): Frontier, slice 3: turrets (branch `frontier-econ3`, PR open)
- Buy → Turret (◈ 8): a ship leaves one laser behind as a turret on a free hex next to it (gold T chips). 2 hp; fires 2 hits a tick at the nearest enemy it can see within 4; upkeep 1 a tick from the next tick, unpaid turrets go dark until paid. Details: [docs/design/frontier.md](../docs/design/frontier.md).
- 253 tests pass. `sw.js` cache `shatkon-offline-v13`.

## Latest (23 Nov, gamedev chat): Frontier, slice 2: the threat heatmap (branch `frontier-econ2`, PR open)
- Buy (beside Pass) opens a shop; the heatmap costs ◈ 6 and your tick, and for your next 2 ticks shades where the enemy ships you can see could hit with a laser (hits by range), plus missile reach for known launchers. Free "in enemy reach" move numbers are off in Frontier. Details: [docs/design/frontier.md](../docs/design/frontier.md).
- Fix: the `earned` event amount was clobbered by `emit`'s sequence number (`n`); renamed `amount`.
- 247 tests pass. `sw.js` cache `shatkon-offline-v12`.

## Latest (23 Nov, gamedev chat): Frontier, economy mode, slice 1 (branch `frontier-econ1`, PR open)
- Third rapid experiment: Rapid Opus plus salvage (◈), one hidden purse a fleet. Earned at the end of each tick: new ground in the enemy's half 1 (+1 by an asteroid), first across the line 3, each ship on or past the line 1 a tick, 2 a segment for a kill; cap 6 a tick. Nothing to buy yet. Details and first numbers: [docs/design/frontier.md](../docs/design/frontier.md).
- `engine/economy.js` (called by `rapidTick`; off unless `rules.rapid.economy === 'on'`), board `rules/rapid/rapid_frontier.yaml`, `ECON_SETTINGS` in `ui/settings.js`, purse / "+n" / new-ground outline in `ui/play.js` and `ui/board.js`, Play → Frontier on the landing page. `sw.js` cache `shatkon-offline-v11`.
- 243 tests pass (10 new in `tests/economy.test.js`); battle logs replay to the same purses. `tools/frontier_econ.mjs` runs computer v computer: it earns almost only from kills and holding the line, because it never goes where the money is (needs slice 5, computer styles).

## Latest (22 Nov, Sunday): Rapid Opus, fourth round (branch `rapid-round4`, PR open, not merged)
- **The opening now ends at first contact**, not first shot: the first tick either side has any contact on the other (a ship in view or a fuzzy contact). From then on: 15 s clock, 1-hex moves, 3 s watch wait, and a "Contact" toast. New setting *Opening ends* (first contact / first shot, `openEnd`).
- **A time-out moves the ship you had tapped** (flagship too) to a random forward hex; if it can't go forward, or nothing was tapped, the old random pick applies. `forcedMoves(state, p, prefer)`.
- Built apart from Grok's PR #50 (`rapid-grok`); touches no Grok files. 207 tests pass.

## Latest (22 Nov, night): Rapid Opus, third round
- One-hex ships past the line can convert into a scanner buoy or a naval mine (`canConvert`, `scan_buoy` munition added by `rapidRules`).
- Board marks for known parts in every mode: yellow shield rings; red T (turret) / E (engine) on enemies.
- Purple formation ring on select.
- Fix: rapid shields and point defence only recharged when objects were in the air.

## 22 Nov, later: Rapid Opus, second round of rules
- Five new rapid settings, all on by default (docs/design/rapid-mode.md):
  - missiles can only be shot down within 3 hexes;
  - close-in debris (1 hit, lit up for 3 ticks);
  - +2 sensor past the line;
  - attack run = moved last tick;
  - formation wingman move (`wingMoves`; tick text `<fire>+<move>`; `tickText`/`parseTick`).
- All hooks stay off unless `rules.rapid`. 202 tests and the campaign checks pass.

## 22 Nov, gamedev chat: Rapid Opus merged to main
- Rapid mode is renamed **Rapid Opus** (`rules/rapid/rapid_opus.yaml`, Play → Rapid Opus); a Grok-built rapid mode may sit beside it for comparison, so keep `rapid_<name>` boards in `rules/rapid/`.
- **Opening** (Ankur after his first game): until the first laser shot or launch, ships move up to 2 hexes, a 10 s clock, no watch wait, and those ticks don't count towards the limit. Settings: Opening clock, Opening moves.
- **Rapid battle logs replay** from the seed tick by tick (`rapidLog`, `replayLog`).
- **Battle report for rapid games** was empty (no events in the log); it now comes from the replay. Missiles are credited to the launching ship's owner, and a missile shot down by a laser counts as wasted instead of "still flying" (all modes; `obj_destroyed` events now name the object).
- **Fix for every mode:** a second tap on an aimed target never fired (the friendly-fire `warn: null` key made `sameAction` fail); `bare()` in ui/play.js now strips it.

## 21 Nov, gamedev chat: rapid mode, experimental (branch `rapid-mode`)
- **What it is.** Ankur's rapid-chess idea: both sides pick ONE action a tick and both resolve together. Moves are 1 hex. Forward only until one of your ships is on or past your line (then move any way, pass, scan). Out of time: a chosen laser, missile or scan fires by itself after a 1.5 s red Cancel; nothing chosen, the game moves a ship forward for you. Vs computer only. Full rules, settings and first numbers: [docs/design/rapid-mode.md](../docs/design/rapid-mode.md).
- **Where.** Play → Rapid Opus, or `play.html?board=rapid_opus`. Board and fleet: `rules/rapid/rapid_opus.yaml`. It is kept out of `rules/boards/` so the ten-board checks and `tools/boards.mjs` don't touch it.
- **Engine.** `engine/rapid.js` (tick, computer, auto-fire, forced move) and `engine/rapidrules.js` (forward, the line, unlocked). The hooks in actions/query/flight are all off unless `rules.rapid`, and normal games are unchanged.
- **Screen.** Rapid section in `ui/play.js` (clock bar, Cancel, Pass, both lines drawn by `drawBoard({ lines })`); `RAPID_SETTINGS` in `ui/settings.js` (sliders for watch time and the line). `sw.js` cache is `shatkon-offline-v10`.
- **Checked.** 198 tests (7 new in `tests/rapid.test.js`); check.mjs, guide_acceptance 15/15 and engine_check pass. Headless Chrome at 844x390: sheet, start, a tick, time-out forced move, auto-fire with Cancel. No console errors.
- **Watch out.** Computer vs computer: all 10 games were draws at tick 100. Rapid battle logs are not replayable yet.

## Latest (20 Nov, gamedev chat): battle settings, battle report, random Lab map
- **Battle settings** (`ui/settings.js`): a sheet before every skirmish (landing page board picker, in-game New game and Play again, Lab "Play these designs"). Turn order: **Fixed** (default, as Ankur approved 19 Nov) or Swap each round; it sets `rules.firstPlayer` for that game only, the world file still says `alternate` (tools/boards.mjs sims are unchanged). Friendly fire: **Warn me** (default) or Just fire. Kept in localStorage `shatkon.battle`. Story chapters don't ask.
- **Friendly-fire warning**: new engine query `beamStop(state, action)` (engine/query.js) mirrors doFire's beam walk without firing. If a shot would stop on your own mine, missile or drone, the board draws the beam's real path in amber, rings the thing it would hit, and the button becomes "Fire anyway"; tapping the target again does not fire. Own ships in the way were already excluded from targets.
- **Battle report** (`ui/postgame.js`): when a skirmish ends, three swipe cards: head to head (hull left, damage done, ships lost, laser shots, moves wasted), laser shots by range band 1-4 / 5-8 / 9+ with damage and blocked shots, missiles and their fates, and a key-moments timeline (first sightings, big hits, ships lost; tap one to fly the camera there). Built from `battleLog`/`analyse`, so it matches the saved log. Lasers never miss, so the card shows shots and damage per band, not a hit rate. "Battle report" in the game-over panel reopens it.
- **Lab "Play these designs"**: Map Skirmish or Random radius 10 (`ui/randommap.js`: seeded, point-mirrored asteroids and nebulae kept out of the home zones, seed box and New map); Opponent computer easy/normal, same phone or open board (`setPlayMode` in play.js).
- Tests: `tests/battle-setup.test.js` (191 pass). `sw.js` cache `shatkon-offline-v9`.

## Latest (20 Nov, maps): Strength check moved into the real Lab
- `play.html` now loads `ui/strength.js`; `lab-strength.html` forwards to `play.html#lab`. The drawer shows segment HP (now/max, per part, shield apart), hides the core choice on segments without a core, labels the columns "strip all parts" / "until it's out" (or "until the core dies"), numbers each shot and each hit, and says why it ended (wrecked, core destroyed, or only engines and core left). Test missiles and cores stay in `ui/strength-model.js` only. `sw.js` cache is `shatkon-offline-v7`.

## Latest (20 Nov, maps): experimental Lab strength check (`lab-strength.html`)
- A copy of play.html with `ui/strength.js`: tap a segment, then **Strength check** (bottom right) opens a drawer. A table shows shots per weapon to strip a segment and to kill its core. A simulator fires single shots through `engine/damage.js` `applyHits` and `explode`, including shield soak, point defence and splash, with next round and reset. Test missiles (basic 3 hits, advanced 4 hits, nuke wrecks the segment like today's missile) and cores (1 / 3 / 6 HP) live only in `ui/strength-model.js`, so `rules/world_v0.4.yaml` and real battles are unchanged. The real Lab only gains a link. Test: `tests/strength.test.js`. `sw.js` cache is `shatkon-offline-v6`.

## Latest (19 Nov, maps): board picker scrolls; living hex field
- The vs-computer board list now scrolls (cards had been wrapping into columns off to the side). The mountain photo on that screen is replaced by a dark hex field with an occasional neon pulse along the lines. Menu only. `sw.js` cache is `shatkon-offline-v5`.

# Status (updated 2026-11-19 by maps)

The project's to-do list is now [BACKLOG.md](../BACKLOG.md).



## Latest (19 Nov, maps): board picker is a list you climb
- The vs-computer board menu is now a vertical ladder (easy at the top, numbered hex steps, a path between them) with a warmer sky and a colour tint per difficulty; descriptions are no longer cut short. Menu only. `sw.js` cache is `shatkon-offline-v4`.

## Latest (19 Nov, maps): board picker by difficulty (menu only)
- The vs-computer / workshop board list is now easiest to hardest, with **First Light first** as the way in: First Light, Beacon Hill, Cat and Mouse, Fog Bank, Pawn Storm, The Gambit, King's Guard, The Dogleg, The Minefield, Missile Alley.
- Each card has a preview of the real board (hexes, terrain, starting ships), a row of 6 stars (Easy 2, Medium 4, Hard 6), a label, and a short description from the board brief. Board files and rules are unchanged; links and saves still use the old file names (`01_first_light` and so on).
- Easy: Beacon Hill, Cat and Mouse, Fog Bank, Pawn Storm. Medium: First Light, The Gambit, King's Guard, The Dogleg. Hard: The Minefield, Missile Alley. Numbers and unapproved spacing suggestions are in [BACKLOG.md](../BACKLOG.md).
- `sw.js` cache is now `shatkon-offline-v3`. No rule, ship or deflection change.

## Latest (18 Nov night, gamedev chat): phone HUD drawer, laser band 3, turn-order check (branch `hud-drawer`)
- **Laser: range 8 → 9**, so it reads 3 / 2 / 1 hits (1–4, 5–8, 9). The world file and the help text are updated. Board check (`--both --games 20`), player 1's fleet out of 40, laser 8 → 9: First Light 17→20, Minefield 11→12, Cat and Mouse 24→21, Dogleg 16→14, King's Guard 20→24, Pawn Storm 8→22, Beacon Hill 25→23, **Missile Alley 8→4** (already outside 10–30), Fog Bank 27→23, Gambit 18→23. The ch4A guide check 12b now accepts step 2 ("Graft") at the gift beat, because the run-up changed and Tern is already in place.
- **New engine option (off):** `turns.command_points.second_player_round_1_bonus` gives the side that moves second extra points on its first turn; meant for `first_player: fixed`. First-mover wins over all 10 boards (400 games each): alternate 205, fixed 168 (of 360; one board unfinished), fixed + 1 point 198. Moving first is worth little; **undecided, awaiting Ankur**. Pawn Storm's player 1 fleet falls to 1–5 of 40 under a fixed order.
- **Phone HUD:**
  - **Left side:** a slim strip (round ring, turn-order dashes, moves as diamonds, the selected ship's hull). A pulsing + opens it into a drawer over the board: the turn in words, "Why these points?", the ship's full card, the hint. The minimap stays out of the drawer.
  - **Bottom:** the orders are one row of icon buttons along the bottom (the board is fitted above them: `insets()`/`fitWidth()` count the row's height).
  - **Removed:** the thrust bar, the laser button's near/far text (it says the target count), and the "seen" / "if hit" badges (visibility is in the ship card; danger stays on the move markers).
  - **Points:** they read as "moves".
  - **Text:** nothing on the game screen can be selected.
  - **Buttons:** the fullscreen button hides in the installed app; "whole map" shows only when zoomed in.
- Checked: 174 tests, `campaign/tools/check.mjs` all pass, headless Chrome 844x390, no console errors.

## Latest (18 Nov, gamedev chat): Lab part picker (branch `lab-picker`)
- The six slot dropdowns in the Lab are now one segment drawn as the game draws it (3 interior hexes, 3 exterior corner diamonds; core in gold). Tapping a slot opens a drawer from the far side: tabs by group, part tiles (icon, name, cost), and a dock showing what changes before you Fit.
- **Everything is read from the rules:** parts from `bay_parts` / `mount_parts`; tabs from a new optional `group:` field (added to every part in `rules/world_v0.4.yaml`: propulsion, sensors, stealth, utility, defence, weapons; a part without one is guessed from what it does, or goes under "Other"); stat changes from `labStats` on a copy of the design; "can't fit" reasons are the new problems `buildRules` reports for that copy. The note shows as one line; tapping it shows the full text.
- The core can't be removed; tapping it offers to move it to another segment. No locks or Mk levels (not a concept outside the campaign yet).
- Checked: 174 tests; headless Chrome 844x390 and 1280x800: open, preview (sensor 4→6, signature 1→2, cost 47→52), a refusal ("3 segments need 2 couplings"), full note, Fit. No console errors.

## Latest (18 Nov, maps): thrust per ship is in (approved by Ankur; tow not built)
Rules from `docs/proposals/thrust-and-tow.md`: each engine gives its own ship 1 thrust a turn; a hex costs 1 thrust per segment; speed limit floor(engines / segments) + 1; a ship banks up to 2 turns of its own engines, never less than one hex; the fleet pool, `canMove` and `needs_average_of` are gone; a ship with no engine, sprint drive or afterburner is refused (Lab and hull check; no shipped ship needed an exemption). Sprint drive / afterburner unchanged. `movement.exterior_per_weight` is built but off.
- **Player sees:** the thrust bar shows the selected ship's own thrust (hidden with no ship selected); the ship card and the ledger are per ship; the Lab says "3 thrust a turn, 3 thrust a hex → about 1 hex a turn, up to 2" or "saves up and moves 1 hex every N turns" or "no engine: can't move".
- **Refits:** Minefield Dowser is now a 4-hex diamond with 3 engines and still 5 sensors (sensor 12, needed to see sleeper and proximity mines): 0.33 → 0.75 hexes a turn. Missile Alley boats: second sensor back to an engine (0.5 → 1).
- **Story:** ch1 disarm fallback also fires once the Seed's laser is gone (was stalling to round 9); ch2 Seeds stand off 2 not 3. engine_check rounds before → after: ch1 6.0 → 6.0, ch2 8 → 10 (no fallbacks), ch3 8.8 → 8.3, ch4a 6.4 → 8.8 (gift always from the round-6 backup), ch5 6 → 6; all win. browser_story (headless Chrome) wins ch1–ch4a, no console errors (ch4a still doesn't open ch5: the known save bug).
- **Sims:** stock normal v normal ×100: rounds 9.4 → 8.0, P1 46% → 52%. Boards (P1 wins /80): First Light 35 → 44, Minefield 31 → 23, Cat & Mouse 36 → 44, Dogleg 39 → 36, King's Guard 29 → 40 (first mover 28 → 14), Pawn Storm 34 → 32, Beacon Hill 39 → 51, Missile Alley 20 → 16 (4 without the refit), Fog Bank 38 → 44, Gambit 45 → 37. 174 tests pass.
- **Watch out:** `campaign/tools/browser_story.cjs` can no longer open the story map on its own (the `#seat select` mode picker went with the landing page); it was run with a local patch that opens `play.html?mode=story`. sw.js cache is v2.

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
