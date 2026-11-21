# Backlog

The one to-do list for Shatkon. Started 18 Nov 2026.

**How to use this**

1. Add new to-dos here, in the right section.
2. `handoff/` stays for messages between the bots, not for the to-do list.
3. When something ships, move it to **Done recently** and drop older done items.

Each item is: a short title, one sentence, an owner if known, and a link to where it came from.

---

## In progress

- **Rapid mode (branch `rapid-mode`, experimental).** One action a tick, both sides at once, against the clock; forward only until a ship crosses the line. Vs computer only. Open: game length (computer-vs-computer games all draw at tick 100), two-phone play, replayable logs, mines and fleet-by-hexes (Ankur: next iteration). Notes: [docs/design/rapid-mode.md](docs/design/rapid-mode.md). Owner: Claude (gamedev chat). Source: chat 21 Nov
- **Strength check in the Lab.** In the real [Lab](https://yadavankur.github.io/Shatkon/play.html#lab) (lab-strength.html forwards there): tap a segment, then **Strength check** for the segment's HP, shots needed per weapon, and a one-shot-per-press simulator that says why it ended. On branch `missile-tiers` it uses the real missiles and cores below. Owner: maps. Source: chat 20 Nov
- **Missile tiers and core variants (branch `missile-tiers`, PR open, waiting for Claude's review).** Basic missile (3 hits), advanced missile (4 hits), Nuke (the existing `missile`: wrecks the segment); basic, steel (3 HP) and carbon crystal (6 HP) cores. Battles that don't use them are unchanged. Open: costs, campaign unlocks, picker design (Claude). Notes: [handoff/to-engine.md](handoff/to-engine.md). Owner: maps, review: Claude. Source: chat 20 Nov

---

## Bugs

- **Chapter 4A save.** Winning Ashfall does not mark the chapter complete, so chapter 5 (The Bloom) never opens. Older bug, not from the phone-controls work. Owner: engine. Source: [handoff/STATUS.md](handoff/STATUS.md), [campaign/CHECKS.md](campaign/CHECKS.md)
- **First Light's launcher sits on a bare segment.** On Lantern (and Ember), one 3-hit laser can strip the launcher and the point defence in a single shot, leaving missiles with no way to fire them. Put a shield or armour on that segment, or move those parts; worth the same check on other boards. Owner: maps. Source: [handoff/to-maps.md](handoff/to-maps.md), [rules/boards/01_first_light.yaml](rules/boards/01_first_light.yaml)

---

## Ideas & features (not started)

- **Post-game "what went wrong" screen.** Turn a loss into a lesson: after a loss, show ships ended in enemy sight, mines that never fired, own mines/missiles you shot, and the board's advice (Ankur 20 Nov: board advice is shown here after a loss, not at the start of a battle). Ankur has ideas to share first. Owner: maps, after Ankur's input. Source: chat 19-20 Nov (Fog Bank loss analysis)
- **Core deflection ("black box" core).** A hit on the core goes to the most damaged neighbouring segment with working parts; the core only takes damage when nothing can absorb it. Tested on a copy (not in the game): fights +22% (11.8 to 14.4 rounds), core kills 1,931 to 226 of 800 games, and Fog Bank (55% to 14%), Pawn Storm (55% to 23%) and Cat and Mouse swing to the big hull. Open: adopt?, 1-segment boats, softer missile spill. Owner: Ankur decides. Source: /workspace/shatkon-deflect-test (maps' box copy), chat 19 Nov
- **Board rules announced at start.** Each challenge board could have its own rule shown in a banner when it starts (e.g. Fog Bank thick fog, sensors -1). Ideas only, none picked. Owner: Ankur decides. Source: chat 19 Nov
- **Pre-match battle settings (done, 20 Nov, gamedev chat).** Built as the battle settings sheet before every skirmish: turn order (Fixed default / Swap each round) and friendly fire (Warn me default / Just fire). Warn traces the beam and asks "Fire anyway" before a shot that would hit your own mine, missile or drone. The original request was in the gamedev chat ("Fable's double tap delay fix", 19 Nov). Later ideas for the sheet: turn limit, fog on/off. Source: chat 19-20 Nov, [ui/settings.js](ui/settings.js)
- **Board menu look (done, 19-20 Nov).** Ankur asked only for the board menu: a living hex background instead of the mountains (2766efb) and narrower cards (max 560px, 20 Nov). Not meant for the rest of the game. The field manual's "Ten boards to try" page (boards.html) still has the mountain picture. Source: chat 19-20 Nov
- **Lab core rule: Claude's picker (PR #41) covers it.** The core can't be removed or doubled and can be moved to another segment; Ankur confirmed 20 Nov that the picker and core handling are Claude's work and the reference for any Lab work. Source: chat 20 Nov, [ui/lab.js](ui/lab.js)
- **Level 2 scan** (campaign upgrade). Today a scan's rings are fixed by board position and barely use the ship's sensors, so it rarely beats passive sight. Idea: tie the scan to sensors (clear ring = sensor range, faint = double), maybe as the Mk II sensor. Discussion only; Ankur decides. Owner: maps. Source: chat 18 Nov, [engine/scan.js](engine/scan.js)
- **Tow.** A ship with a coupling could drag a crippled ship (engines shot out) along with it, paying thrust for both. Idea only — do not build this yet. Owner: engine, when Ankur says so. Source: [docs/proposals/thrust-and-tow.md](docs/proposals/thrust-and-tow.md), [rules/world_v0.4.yaml](rules/world_v0.4.yaml) (section 13)
- **Exterior parts add weight.** Shields, armour and guns would slow a ship down; stripping them would make it faster. The switch is built but off: set `movement.exterior_per_weight` (for example 6) in the world file to turn it on. A test of it made the first mover too strong. Owner: Ankur decides. Source: [docs/proposals/thrust-and-tow.md](docs/proposals/thrust-and-tow.md)
- **Missile hits and extra core hit points.** Replace a missile's "wrecks the segment outright" with a fixed hit count, and give the core more hit points so it usually survives one shot. Options: missile 4 hits with core 3 hp (preferred by maps), or missile 7 hits with core 6 hp. Ankur has not decided. Owner: Ankur decides, then engine. Source: discussed 18 Nov 2026; current rule is `wrecks_segment: true` in [rules/world_v0.4.yaml](rules/world_v0.4.yaml)
- **Part upgrades, Mk I / II / III.** Stronger versions of parts, unlocked over the campaign (for example engine Mk II = 1.5 thrust). Owner: Ankur decides, then engine / story. Source: [rules/world_v0.4.yaml](rules/world_v0.4.yaml) (section 13)
- **Lab slot picker: done.** Claude's design, merged 18 Nov as PR #41 (segment slot widget and a drawer of parts by group). The strength-check page (lab-strength.html) is built on it. Source: chat 20 Nov
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


## Notes: board difficulty (19 Nov)

Player 1 is the human in vs-computer mode (every board file, `boards.html`, and the play screen say so). Figures are 80 computer-versus-computer games as written, seeds 1–80, Normal computer. Share is (wins + half draws) / 80. 95% interval is about ±10–12 points near 50%, so neighbours in the middle band are only a good-enough rank, not exact. These numbers did not change any ships or rules.

| Menu order | File | Board | Player 1 record (share) | Label | Stars |
|---|---|---|---|---|---|
| 1 | 01_first_light | First Light | 40-40-0 (50%) | Medium | 4 / 6 |
| 2 | 07_beacon_hill | Beacon Hill | 55-25-0 (69%) | Easy | 2 / 6 |
| 3 | 03_cat_and_mouse | Cat and Mouse | 47-26-7 (63%) | Easy | 2 / 6 |
| 4 | 09_fog_bank | Fog Bank | 47-33-0 (59%) | Easy | 2 / 6 |
| 5 | 06_pawn_storm | Pawn Storm | 45-35-0 (56%) | Easy | 2 / 6 |
| 6 | 10_gambit | The Gambit | 40-38-2 (51%) | Medium | 4 / 6 |
| 7 | 05_kings_guard | King's Guard | 38-41-1 (48%) | Medium | 4 / 6 |
| 8 | 04_the_dogleg | The Dogleg | 33-47-0 (41%) | Medium | 4 / 6 |
| 9 | 02_minefield | The Minefield | 26-53-1 (33%) | Hard | 6 / 6 |
| 10 | 08_missile_alley | Missile Alley | 13-67-0 (16%) | Hard | 6 / 6 |

Beacon Hill is written as a mirror but the south / player-1 seat won 69%; some of that ease may be a seat or computer quirk. A person may find The Minefield easier than 33%, and Fog Bank harder than 59%, because the computer is weak at mines and at using Comets.

**Ladder spacing: rejected by Ankur (20 Nov).** Five ship tweaks were suggested to space the ladder (one fewer Fog Bank sleeper mine, Leviathan, Patron, Hive, Buckler). Ankur said no: boards stay as they are, and Fog Bank stays Easy; losing is a learning opportunity, handled by the post-game screen.

If core deflection is turned on later, this ladder does not hold (Fog Bank and Pawn Storm fall sharply; The Minefield eases a little) and should be ranked again.

## Done recently

- **Board picker by difficulty** (19 Nov, maps). Menu and presentation only: First Light first, then easiest to hardest; each card has a board preview, 2 / 4 / 6 of 6 stars (Easy / Medium / Hard), a label, and a short description. Board files, ships and rules were not changed. Source: chat 19 Nov.

- **Thrust per ship** (18 Nov, maps). Each ship's own engines move that ship; the shared fleet pool is gone. A ship with no engine (or sprint drive / afterburner) can't be built. The Minefield Dowser and the Missile Alley boats got more engines. Source: [docs/proposals/thrust-and-tow.md](docs/proposals/thrust-and-tow.md), [handoff/STATUS.md](handoff/STATUS.md)
- **Phone-first controls (steps 1–7)** merged: the camera stays still, landscape compact layout, phase banner, targeting confirms, ship card, and installable app. Source: [handoff/STATUS.md](handoff/STATUS.md)
- **Double-tap zoom no longer lags.** The board glides on the phone's GPU and redraws once at the end.
- **Landing page, minimal HUD, and on-board rule previews** (laser reach, danger rings, the round strip).
- **Who moves first is now random** (from the game's seed).
- **Beta retired;** the root site is the one game. Ten reworked boards, the Comet, sleeper mines and the decoy emitter are on main.
