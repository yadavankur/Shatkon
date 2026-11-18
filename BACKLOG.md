# Backlog

The one to-do list for Shatkon. Started 18 Nov 2026.

**How to use this**

1. Add new to-dos here, in the right section.
2. `handoff/` stays for messages between the bots, not for the to-do list.
3. When something ships, move it to **Done recently** and drop older done items.

Each item is: a short title, one sentence, an owner if known, and a link to where it came from.

---

## In progress

- Nothing right now.

---

## Bugs

- **Chapter 4A save.** Winning Ashfall does not mark the chapter complete, so chapter 5 (The Bloom) never opens. Older bug, not from the phone-controls work. Owner: engine. Source: [handoff/STATUS.md](handoff/STATUS.md), [campaign/CHECKS.md](campaign/CHECKS.md)
- **First Light's launcher sits on a bare segment.** On Lantern (and Ember), one 3-hit laser can strip the launcher and the point defence in a single shot, leaving missiles with no way to fire them. Put a shield or armour on that segment, or move those parts; worth the same check on other boards. Owner: maps. Source: [handoff/to-maps.md](handoff/to-maps.md), [rules/boards/01_first_light.yaml](rules/boards/01_first_light.yaml)

---

## Ideas & features (not started)

- **Tow.** A ship with a coupling could drag a crippled ship (engines shot out) along with it, paying thrust for both. Idea only — do not build this yet. Owner: engine, when Ankur says so. Source: [docs/proposals/thrust-and-tow.md](docs/proposals/thrust-and-tow.md), [rules/world_v0.4.yaml](rules/world_v0.4.yaml) (section 13)
- **Exterior parts add weight.** Shields, armour and guns would slow a ship down; stripping them would make it faster. The switch is built but off: set `movement.exterior_per_weight` (for example 6) in the world file to turn it on. A test of it made the first mover too strong. Owner: Ankur decides. Source: [docs/proposals/thrust-and-tow.md](docs/proposals/thrust-and-tow.md)
- **Missile hits and extra core hit points.** Replace a missile's "wrecks the segment outright" with a fixed hit count, and give the core more hit points so it usually survives one shot. Options: missile 4 hits with core 3 hp (preferred by maps), or missile 7 hits with core 6 hp. Ankur has not decided. Owner: Ankur decides, then engine. Source: discussed 18 Nov 2026; current rule is `wrecks_segment: true` in [rules/world_v0.4.yaml](rules/world_v0.4.yaml)
- **Part upgrades, Mk I / II / III.** Stronger versions of parts, unlocked over the campaign (for example engine Mk II = 1.5 thrust). Owner: Ankur decides, then engine / story. Source: [rules/world_v0.4.yaml](rules/world_v0.4.yaml) (section 13)
- **Lab slot picker.** Replace the native part dropdowns with a pop-over: group tabs, part tiles, a live "what this changes" line, and Fit. The mock-up is ready; nothing goes into the real Lab until Ankur approves it. Owner: maps, after Ankur approves. Source: [mockups/slot-picker.html](mockups/slot-picker.html)
- **King's Guard may favour the second mover.** It is stronger since thrust per ship (18 Nov): the side that moves first won only 14 of 80 bot games (28 of 80 before; earlier figure 31 of 60 for the second mover). Check whether the board needs a tweak. Owner: maps. Source: [docs/design/first-mover.md](docs/design/first-mover.md), [handoff/STATUS.md](handoff/STATUS.md)
- **Upright-phone layout.** An upright phone currently gets a "turn your phone" card, with "Play upright anyway" as a way out. A proper portrait layout for the play screen is still to do. Owner: controls. Source: [handoff/STATUS.md](handoff/STATUS.md), [play.html](play.html)
- **Turn summary.** Show a short recap of the other side's turn on the play screen when it comes back to you. The full recap already lives in the battle log, in the menu. Owner: controls. Source: [engine/log.js](engine/log.js)
- **Story chapter 1 as the default start.** For a new player, open chapter 1 of the story instead of leaving them on the landing page. This is step 8 of the phone-controls plan; Ankur signed off the earlier steps by playing them. Owner: controls, after Ankur says go. Source: [handoff/STATUS.md](handoff/STATUS.md)
- **Chapter 4B, "The Long Dark".** It is on the campaign map but locked ("Signal lost"), with no chapter file yet. Owner: story / maps. Source: [campaign/campaign.yaml](campaign/campaign.yaml)
- **What happens after chapter 5.** The campaign ends on a cliffhanger ("To be continued"). Owner: story. Source: [campaign/campaign.yaml](campaign/campaign.yaml)
- **Tutorial channels.** Five tutorial channels were noted in the Field Manual, but the map and fleet files are not written. Owner: maps / story. Source: [docs/index.html](docs/index.html)
- **Contact and proximity mines: should lasers pass over them?** Sleepers already have `beams_pass`, so a shot across their hex does not destroy them unseen. The same change for contact and proximity mines is waiting on Ankur (it would also change story chapter 2). Owner: Ankur decides, then engine. Source: [docs/design/ai-pieces.md](docs/design/ai-pieces.md), [handoff/STATUS.md](handoff/STATUS.md)
- **Variety study, Stage 2.** Stage 1 screening is done (6,100 games). Waiting for Ankur to pick which cells to run at 40 games, and to answer the open questions (dreadnought price, stock fleet, and so on). Owner: Ankur decides, then engine. Source: [docs/design/balance-evidence.md](docs/design/balance-evidence.md), [handoff/to-gamedev.md](handoff/to-gamedev.md)
- **Scene editor.** A self-contained `story/editor.html` so cutscenes can be written and changed without hand-editing JSON. Owner: story. Source: [handoff/to-story.md](handoff/to-story.md)
- **Redraw Kestrel's refit and grafted ship art.** The hulls changed to a symmetrical rhombus, but both pictures still show the old shape, so those ships fall back to the schematic. Owner: story. Source: [handoff/to-story.md](handoff/to-story.md), [story/ships.json](story/ships.json)
- **Redo the mimic portraits without the name badge.** Art should have no baked-in text; the current pack is clean except those portraits. Owner: story. Source: [handoff/to-story.md](handoff/to-story.md)
- **Play the ten boards by hand.** The computer-versus-computer numbers are in, but nobody has played the reworked boards as a person yet. Owner: Ankur / maps. Source: [docs/design/maps-rework.md](docs/design/maps-rework.md)
- **Comet "fly past and out again".** The computer does not yet fly a Comet through and out the other side on purpose, and it does not use the death flash as a tactic. Owner: engine. Source: [handoff/to-maps.md](handoff/to-maps.md), [docs/design/ai-pieces.md](docs/design/ai-pieces.md)
- **A hidden ship that moves into view gives away the hex it came from.** The move event still carries `from`, and the glide shows it. Left as a judgement call, not fixed. Owner: Ankur decides, then engine. Source: [handoff/to-gamedev.md](handoff/to-gamedev.md)
- **A flagship with all its guns shot off sits in view.** Teaching it to run only produced draws, so it was left. Owner: engine. Source: [handoff/to-gamedev.md](handoff/to-gamedev.md)
- **Parked world ideas** (from section 13 of the world file; not started). Ships that rotate; a destroyed coupling breaking the ship in two, or twins that split on purpose; cutting a wrecked segment loose to shed its weight; tractor (a large ship swallows a small one); tunnel / wormhole devices; distortion stealth (appear bigger or smaller than you are); space rivers, gravity wells, warped hexes, sphere or doughnut boards; campaign branching, unlocks, salvage collectors, raw materials between battles, and a planet-sized final boss. Owner: Ankur decides. Source: [rules/world_v0.4.yaml](rules/world_v0.4.yaml) (section 13)
- **Other board-game ideas, not built.** A minelayer order; promotion (a small ship that reaches the enemy home calls in a reserve); ko / no-repeat positions to stop the one-hex camp; scoring for hexes your sensors cover. Owner: Ankur decides. Source: [docs/design/ships-and-boards.md](docs/design/ships-and-boards.md)
- **Ashfall (ch4a) runs longer.** The Sparrow is slower under thrust per ship, so the gift now always comes from its round-6 backup and the graft lands in rounds 8–10 (the whole chapter went from 6.4 to 8.8 rounds). Still wins every time. Owner: maps / story. Source: [handoff/STATUS.md](handoff/STATUS.md)

---

## Tech / tidy-up

- **browser_story.cjs can't open the story map.** It still picks story mode from `#seat select`, which went with the landing page; open `play.html?mode=story` instead. Owner: maps / controls. Source: [handoff/STATUS.md](handoff/STATUS.md)
- **Delete old remote branches.** `balance-and-ai`, `maps-rework`, `maps-rework-engine` and `variety-study` are fully merged and still on GitHub. Waiting for Ankur's yes before deleting them. Owner: Ankur decides. Source: [handoff/STATUS.md](handoff/STATUS.md)
- **Stale "Needs a new rule" comments** on four board files (Minefield `scan_resist`, Beacon Hill `holds_objective`, Fog Bank sleeper drift, The Gambit emitter). Those rules are in the engine now; the comments still say they are missing. Owner: maps. Source: [rules/boards/02_minefield.yaml](rules/boards/02_minefield.yaml), [rules/boards/07_beacon_hill.yaml](rules/boards/07_beacon_hill.yaml), [rules/boards/09_fog_bank.yaml](rules/boards/09_fog_bank.yaml), [rules/boards/10_gambit.yaml](rules/boards/10_gambit.yaml)
- **Handoff ownership table is out of date.** It has no row for the controls work, and it still names old branches (`campaign-engine`, `campaign-vN`). Owner: Ankur decides how it should read, then whoever updates [handoff/README.md](handoff/README.md). Source: [handoff/STATUS.md](handoff/STATUS.md)
- **STATUS.md "In progress / waiting" is stale.** It still describes PR #27 and #28 as pending, though both are merged. Owner: anyone updating handoff. Source: [handoff/STATUS.md](handoff/STATUS.md)
- **Move-marker colour.** The mint `#6dffc0` on move chips is off the teal/blue palette; the chips may also need to be larger on a phone now the board is bigger. Owner: controls. Source: [handoff/to-engine.md](handoff/to-engine.md), [handoff/STATUS.md](handoff/STATUS.md)
- **Confirm phone zoom on a real device.** The lag fix (the board glides with a CSS transform and redraws once at the end) was checked in headless Chrome, not on a real phone. No remaining "performance plan items 1–6" were found in the handoff notes; that zoom/redraw work has already shipped. Owner: controls / Ankur. Source: [handoff/STATUS.md](handoff/STATUS.md)
- **Engine review of random first mover.** Maps shipped `turns.first: random` while engine was out of usage; a review was asked for. Owner: engine. Source: [handoff/to-engine.md](handoff/to-engine.md)
- **Two-phone game codes not checked by hand.** Engine tests pass on all ten boards; the buttons in the browser, and whether WhatsApp mangles a long game code, have not been tried. Owner: Ankur / maps. Source: [docs/design/ships-and-boards.md](docs/design/ships-and-boards.md)

---

## Done recently

- **Thrust per ship** (18 Nov, maps). Each ship's own engines move that ship; the shared fleet pool is gone. A ship with no engine (or sprint drive / afterburner) can't be built. The Minefield Dowser and the Missile Alley boats got more engines. Source: [docs/proposals/thrust-and-tow.md](docs/proposals/thrust-and-tow.md), [handoff/STATUS.md](handoff/STATUS.md)
- **Phone-first controls (steps 1–7)** merged: the camera stays still, landscape compact layout, phase banner, targeting confirms, ship card, and installable app. Source: [handoff/STATUS.md](handoff/STATUS.md)
- **Double-tap zoom no longer lags.** The board glides on the phone's GPU and redraws once at the end.
- **Landing page, minimal HUD, and on-board rule previews** (laser reach, danger rings, the round strip).
- **Who moves first is now random** (from the game's seed).
- **Beta retired;** the root site is the one game. Ten reworked boards, the Comet, sleeper mines and the decoy emitter are on main.
