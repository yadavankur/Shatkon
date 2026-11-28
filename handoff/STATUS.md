> Older entries (19 Nov and earlier) are in [archive/STATUS-2026-11-16-to-19.md](archive/STATUS-2026-11-16-to-19.md). Nothing was deleted, only moved, 27 Nov 2026.
> The project's to-do list is [BACKLOG.md](../BACKLOG.md).

## Still open (carried forward 27 Nov)

- **Contact and proximity mines `beams_pass`** — Ankur's call, still open (was in the 17 Nov "Needs attention" note and the 16 Nov AI entries; full text in the archive).
- **Variety study, Stage 2 cells** — waiting for Ankur's picks (was in "In progress / waiting").
- **Move-marker polish** — the mint `#6dffc0` is off the palette, and the chips may need to be larger on a phone now the board is bigger.
- **Handoff ownership table** — still no row for the controls work, and it still names old branches. Ankur to say how it should read (BACKLOG.md).

## Latest (28 Nov evening, gamedev chat): settings sheets fixed and slimmed (build #87)
- Sheets store only rows the player changed, so untouched rows no longer override board files, and they show the board's own values. Tuning rows are folded into a collapsed "Tuning" section: players see 2 to 4 rows.
- Found while fixing: the engine never read `interceptHurts: true` from Frontier and three-player boards (it wanted 'on'), so the 24 Nov "intercepted missile still stuns" rule was never live. It is now. `economy: true` is read too. — Claude (gamedev chat)

## Latest (28 Nov, gamedev chat): switches, one list with three levels (build #86)
- Master list in the world file (`switches:`), each kind of game's changes (`modes:` skirmish, rapid, story, tutorial, experiments), then a board's or chapter's own `switches:`. Read with `E.sw(game, name)`. Design: `docs/design/switches.md`.
- Switches today: castle, turn_order, scan_button, start_labels, ship_codes, end_turn_nag, win_now. Story and tutorial now use fixed turn order (Ankur: back-to-back turns are confusing). `turns.first_player` is gone.
- Board sims now use fixed order like real 1v1 play: Pawn Storm player 1 fleet 2/40 (to maps). — Claude (gamedev chat)

## Latest (28 Nov, gamedev chat): free castle (build #83)
- Once, before its first action, a side may secretly move its flagship anywhere legal in its home zone (a ship in the way swaps). Free and secret. Refused once the enemy has seen the flagship. Turn-based: an action in round 1. Rapid: rides with the first tick. Design and balance table: `docs/design/castle.md`.
- On/off: world file `modes:` master defaults (skirmish on, rapid on, story off, experiments off). A board can set `map: castle: true|false`.
- Board check, castling off → on (P1 fleet wins of 40): Minefield 12→16, Dogleg 14→21, King's Guard 24→11, Missile Alley 4→10, Gambit 23→18; all ten in 10–30.
- Can't castle at the start (flagship already in enemy view): First Light both sides; P2 on Minefield, Pawn Storm, Fog Bank. — Claude (gamedev chat)

## Latest (28 Nov, gamedev chat): secret starts, step 1, counting only (no game code)
- Ankur: fixed, public starts make the enemy easy to find. Before building secret numbered starts, `tools/starts.mjs` counted the legal starting layouts per side, per board, and picked 12 spread-out ones (`docs/design/starts/*.json`). Write-up with the full table and the rerun command: `docs/design/secret-starts-count.md`.
- No side has only a dozen: First Light's 2 ships already have 201 legal layouts, and the big fleets have millions or more. The flagship is the real secret: it fits in only 8 to 21 spots in a depth-3 zone. On Dogleg, Missile Alley (P1) and Fog Bank (P2) it can't stay off the front row. Only 4 of the 10 boards are exact mirrors, but all ten have one fixed start.
- Waiting for Ankur: which filter (ships apart? flagship back?), how many layouts per side, and whether maps approves each list. — Claude (gamedev chat)

## Latest (27 Nov, Muse): new AI personality "muse" ready for review (branch `muse-ai-1`, PR open)
- A second Vs-computer opponent, written from scratch in `engine/ai-muse.js`: it hunts the biggest enemy ship it can see, closes to point-blank range and spends everything trying to kill it. Select it in battle settings ("Computer opponent": Random / Muse, the hunter) or pin `ai.vs_computer: muse` in a board file. The default game is unchanged — Muse is not in `ai.personalities`, so the `random` pool is untouched.
- Measured against the stock computer over 200 games (10 a board per seat, seeds 1–10, `node tools/muse-vs-opus.mjs`): **99–100, 1 draw** overall, but board-dependent — Pawn Storm 20–0, King's Guard 15–5, Beacon Hill 14–6, Minefield 3–16, Missile Alley 5–15. Full table, sample game codes and limitations in `docs/design/muse-ai.md`.
- The harness caught a real bug (The Dogleg drew 20/20 to the round limit: straight-line scoring stalled at a canyon bend) — fixed with path-aware BFS movement, with a regression test.
- Full test suite green (340 pass, 0 fail), including 11 new tests in `tests/muse-ai.test.js`. PR open for Ankur to review and merge — only Ankur merges. — Muse

## Latest (26 Nov early morning, gamedev chat): three players, experimental (merged, build #74)
- Play → Experiments → **Three players: edges** (`play.html?board=three_edges`) or **Three players: corners** (`three_corners`). You and two computers, free for all, Frontier rules (rekon on), on the clock.
- Each fleet: Throne (7-hex flagship), Warden (3), Lancer (2), five scouts. Player 2 and 3 are player 1's fleet turned 120 and 240 degrees (`copy_of` + `turn:` in the board file).
- Forward = towards the centre (2 directions from an edge, 3 from a corner). The line is the **centre ring** (setting 2/3/4 hexes): a ship inside it, or beyond the centre, frees its fleet.
- Lose your flagship and you are out: your other ships scuttle, your mines/turrets/missiles go. The killing hit takes your rekon plus a **bounty** (setting 0/10/20). Kill pay only to the side that made the kill. Last flagship standing wins; at the tick cap, the most whole segments left.
- Engine: `engine/rapidrules.js` (homes on any edge or corner, ring), `engine/damage.js` checkOut, `state.lastHit` (who hit whom), corner zones and `hex.rotate` in `engine/hex.js`. Two-player games unchanged (golden replays pass). Design and findings: [docs/design/three-player.md](../docs/design/three-player.md). Tests: tests/three-player.test.js.
- Computer x3, 90 games: most decided (Edges 26/30, Corners 50/60); seat wins about even. Games are long (most run to the cap); so are two-player Frontier computer games (6/6 draws), so that is the computer, not three players.

## Latest (24 Nov night, gamedev chat): from Ankur's two Ram games (merged, build #72)
- Turrets no longer take a laser (Ankur never chose that; it came from Claude's economy draft). Setting "Turret uses a laser" (default No) keeps the old way.
- Buy sheet says why an item can't be bought for the selected ship (on a phone the hint line is cut to one line, so "no room in a magazine" / "no laser to leave behind" were never seen).
- Logs: a ram or decoy line broke the log's replay ("cannot read action r:…"); fixed. On a phone the log is now shared as a file (blob downloads can do nothing in the installed app); desktop still downloads.
- Clock-free games (Experiments, me v me): no watch countdown; a "Tick n" panel lists what happened last tick and stays until the next one.

## Latest (24 Nov night, gamedev chat): Ram board stalemate fixed (merged, build #71)
- Ankur's Ram game ended with two Wardens that could never shoot each other: the ram and lasers took both their engines, and the one rock at [0, 0] sat exactly between the two cores. Computer v computer on the old board: 10 of 10 draws at the tick cap. Rock moved to [2, 1] / [-2, -1]: 10 of 10 decided by tick 10. All eight Lab boards checked the same way: every game decided.

## Latest (24 Nov night, gamedev chat): chapter 4A save fixed; backlog cleaned (merged, build #70)
- ui/campaign.js: the chapter result is saved the moment the game ends (was: after the closing scenes, which could never finish, so ch4A's win was lost and ch5 stayed shut). Headless Chrome ch4A → ch5: 3 of 3.
- BACKLOG.md: resolved items moved to Done (decisions of 24 Nov: story first, computer later; upgrade prices stay; converted pieces just work; mine laser-pass per board; first mover locked).
- Branch clean-up: Claude's session can't delete GitHub branches (blocked); Ankur to do it on GitHub.

## Latest (24 Nov evening, gamedev chat): Smart mine and Decoy practice boards (PR open, build #68)
- Play → Experiments, then the Practice boards sub-list: **Smart mine** (`play.html?board=lab_stateMines`) and **Decoy** (`play.html?board=lab_decoy`), plus the existing **Ram**. Same format as the Lab board. Each board has only its own experiment on. No guided tutorials. Ghost, repair, warp and hibernate are not built yet.
- Smart mine: your healthy scout starts just past the line; convert it to a smart mine (S). Enemy scouts walk in and set it off at 3 hexes, wrecking a section. Vs the computer this happens on the first tick.
- Decoy: tap your Warden, tap Decoy, place it in the gap. Their missile turns onto the ? contact and both are gone. Vs the computer this happens on the first tick, at any keenness.
- Convert-to? sheet now names the mine from the ship's state when that experiment is on (Smart mine / 3 hexes, and so on). Off, it still says Naval mine.
- Ram's try line now says to tap Stay a ship (the scout starts past the line, so the convert sheet appears on the way to a ram). Home zones on the new boards stay in each side's own half (depth 7).
- Hard playtest in headless Chrome: complete games of Smart mine and Decoy (vs computer, me v me), Decoy and Ram at each computer keenness, every ship tapped, console clean.

## Latest (24 Nov evening, gamedev chat): #66 reviewed and merged; fixes (merged, build #67)
- Home side read from the board's home zone (engine/rapidrules.js homeSign), not the ships' average row: lab_ram had both sides "home south".
- Rapid: tapping a ship past the line crashed the action buttons (view scanR null); fixed. Eager-ram computer keeps scouts as rams. Plain Lab board no longer reset by practice-board seeding.

## Latest (24 Nov, gamedev chat): Ram practice board (PR open, build #66)
- Ankur has lost access to the maps bot. Game Dev Story now owns the maps inbox and the Experiments practice-board work.
- Play → **Ram**, or `play.html?board=lab_ram`: one tiny practice board (`rules/rapid/lab_ram.yaml`, same format as the Lab board `rules/rapid/rapid_lab.yaml`). Only the Ram switch is on; the computer rams eagerly. Your scout starts 3 hexes from their Warden, so a ram is ready on the second tick. What to try / what to look for are in the file header. The other experiment boards are not built yet (Ankur asked for Ram only first). No guided tutorials.
- The play page now also loads `lab_*` boards from `rules/rapid/`. Opening a practice board pre-sets its switches on the Experiments sheet (the sheet can still change them).

## Latest (24 Nov, gamedev chat): Lab board smaller, line movable (merged, build #65)
- Lab board: a Warden (3-hex flagship, now with the decoy emitter) and two scouts a side (was also a Lancer, a Mirage and a third scout).
- Experiments sheet: "The line" 2-12 rows of 15 (default 7); the rapid line/clock rows are hidden there. Handover to maps updated (handoff/to-maps.md, top).

## Latest (24 Nov, gamedev chat): me v me, computer uses experiments, pause (merged, build #64)
- Experiments sheet: **Who plays**: Me v computer / Me v me, pass (curtain between picks) / Me v me, no curtain. Me v me: player 1 picks, player 2 picks on the board turned round (`engine/swap.js` swapSides), then the tick resolves.
- Experiments board has **no clock** (vs computer too). Each active experiment (ram, decoy, repair, warp, hibernate) has Off / On, just me / On, computer sometimes / On, computer eager. `engine/labai.js` (labAI, chained after econAI in rapidAI); rapid option `cpuExp`.
- Every clocked rapid game (Rapid Opus, Frontier): a "Ready? Start the clock" tap before the first tick (also after reloading), a pause button (top centre), and auto-pause when the page is hidden. Resume gives a fresh full tick.
- Tool: `node tools/lab_ai.mjs 4 eager` (computer v computer with everything on). Tests: tests/selfplay.test.js. Golden replays unchanged.

## Latest (24 Nov, gamedev chat): Experiments, round 1 (merged, build #63)
- Play → **Experiments**: the Lab board (`rules/rapid/rapid_lab.yaml`, small fleets) with on/off switches for each new idea. Off by default; `tests/golden.test.js` replays recorded games to prove a switched-off experiment changes nothing.
- Built behind switches: ghost on conversion, mines from the ship's state (smart/close/lurker/dud), ram, decoys, repair/warp/hibernate in the shop. `engine/experiments.js`, `engine/labrules.js`, `tests/experiments.test.js`.
- The currency is **rekon** on screen. Handover to maps: practice set-ups per experiment, then tutorials (handoff/to-maps.md).

## Latest (24 Nov, gamedev chat): turrets retuned; build number (merged, build #62)
- Turrets: 1 hit a shot (was 2), range 7 (setting 5/7/9), signature -2 (was 1): hard to spot, so they usually shoot first.
- Build number: `ui/version.js` (BUILD = the PR number; bump it in every PR). Shown on the home screen footer, in the in-game menu by the log buttons, and as `build` in both battle logs. The service worker cache is named after it (`shatkon-offline-b62`); tests/version.test.js checks they match.

## Latest (24 Nov, gamedev chat): intercepted missiles hurt; buy fix; laser reasons; salvage table (merged)
- Frontier (`interceptHurts: on`): a missile stopped by point defence or shot down still stuns the ship that stopped it (or its locked target) for its next tick; a Nuke still does 2 hits. `stunned()` in engine/damage.js; refused in rapidRefusal, left out of legalMoves and the computer's choices; ⚡ on the board.
- Buy: the ship selected when Buy is pressed is the one the purchase is for (taps on the sheet were reaching the board and deselecting it).
- Laser button always shown with why it can't fire: no laser left, nearest enemy out of reach (distance vs reach), line blocked, no enemy in sight, stunned.
- End screen Salvage card is now one table: earned/spent/left, where it came from, what it went on, turret summary.

## Latest (23 Nov night, gamedev chat): Frontier slice 5: computer styles (merged)
- `engine/econai.js`: rush / boom / turtle, setting "Computer plays" (random by default). Tool: `node tools/frontier_styles.mjs 12 150` (about 8 minutes).
- First runs: boom beats rush 8-1 and turtle 7-3; turtle beats rush 8-4. Not a triangle yet; games run to the 150-tick cap. Details and tuning ideas: [docs/design/frontier.md](../docs/design/frontier.md).
- PR #59 before it: idle penalty (passing costs 1 and earns nothing), turret upkeep 1 every 3 ticks, upkeep shown on screen.

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

