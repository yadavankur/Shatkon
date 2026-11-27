> Older done entries (14–16 Nov) are in [archive/to-engine-2026-11-14-to-16.md](archive/to-engine-2026-11-14-to-16.md). Nothing was deleted, only moved, 27 Nov 2026.

## 2026-11-27 · from Muse · new AI personality "muse" ready for review (branch `muse-ai-1`, PR open)
- `engine/ai-muse.js` is a from-scratch hunter personality (flagship-focused, point-blank, ignores mines and objectives while chasing). Wiring is minimal: `engine/ai.js` dispatches on `opts.personality === 'muse'` or `ai.vs_computer: muse`; `engine/index.js` exports `museMove`; `ui/settings.js` + `ui/play.js` add the battle-settings row ("Computer opponent": Random / Muse, the hunter).
- Please check the wiring in `ai.js` / `play.js` — in particular that the dispatch cannot leak into campaign, story, Lab or Rapid play (it is gated on `level === 'normal'`, no profiles, no campaign rules), and that the settings row shows only before Vs-computer skirmish. The `random` pool is unchanged (Muse is not in `ai.personalities`).
- Measured: 200 games vs the stock computer, 99–100, 1 draw; full table, sample game codes and limitations in `docs/design/muse-ai.md`. Full test suite green (340 pass). PR open for Ankur to review and merge. — Muse
Status: open

## 2026-11-24 (evening) · from gamedev · remaining practice boards (YAML only, build #69)
`rules/rapid/lab_ghost.yaml`, `lab_repair.yaml`, `lab_warp.yaml`, `lab_hibernate.yaml`. Maps only; please organise the Experiments list.

## 2026-11-24 (evening) · from gamedev · two new practice boards (Smart mine, Decoy) and a convert-sheet fix (build #68, PR not merged)
Game Dev Story (maps work) added practice boards for **stateMines** and **decoy**, in the same PR. Nothing here needs an engine change unless you disagree with the convert-sheet wording.

- `rules/rapid/lab_stateMines.yaml` (Play → Experiments → Practice boards → Smart mine, or `play.html?board=lab_stateMines`). Only `rapid.exp.stateMines` is on. A healthy scout (laser + sensor) starts just past a line of 6 and converts to a `smart_mine` (S, trigger 3, wrecks a section). Two unarmed enemy scouts walk in; a short line of rocks blocks the west-forward walk-around so the computer cannot miss the 3-hex trigger. Vs the computer the convert and the blast happen on the same tick (they take a 2-hex opening stride). Pawn B stays past the line so you can still pass after converting. Home zones: depth 7, own half. No `cpuExp` (the computer does not use stateMines).
- `rules/rapid/lab_decoy.yaml` (same list, or `play.html?board=lab_decoy`). Only `rapid.exp.decoy` is on. Your Warden has the emitter; the centre hex is a legal decoy spot. Their Warden has missiles but no lasers (and their scouts have no lasers) so the computer launches instead of shooting. Vs the computer, at never / sometimes / eager, they launch on the same tick, the missile is lured, and both the decoy and the missile are gone. Home zones: depth 7, own half.
- Play page, not the engine: the Convert to? sheet used to always say "Naval mine / goes off when an enemy comes within 1 hex". It now uses `mineKindFor` when `stateMines` is on, so a healthy scout is offered as **Smart mine** (3 hexes, wrecks a section). With the experiment off, the wording is unchanged.
- Hard playtest (headless Chrome, complete games, both seats / me v me, every ship tapped): no engine crash, no console errors, no leak into Ram or the Lab. I also re-checked Ram at each keenness; its scout starts past the line so the convert sheet appears — maps now tells you to tap Stay a ship, then Ram. I did not find a new engine bug in this pass.
- Ghost, repair, warp and hibernate practice boards are not in this PR.

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
Status: done (built 20 Nov as the battle settings sheet: friendly fire Warn me / Just fire, turn order)

## 2026-11-18 · from maps (for Ankur) · proposal: thrust per ship, and tow
- `docs/proposals/thrust-and-tow.md`: thrust per ship done by maps on 18 Nov (see STATUS.md). Tow is not built; it stays on BACKLOG.md.

## 2026-11-17 · from controls (Claude Code, for Ankur) · the play screen changed a lot: please run browser_story.cjs
- Phone-first controls, seven stacked branches ending in `phone-pwa` (not merged yet). Details: top of STATUS.md. `ui/` and `play.html` only, no engine or rule changes; 165 tests pass.
- What a browser tool will notice: selecting a ship no longer moves the camera; a laser needs two taps (aim, then fire) and Graft/Dock need a confirm press (`#tools .btn.go`); End turn asks once more when points are left and a ship can act; an upright phone viewport shows a "turn your phone" card unless the URL has `?upright` or `sessionStorage['shatkon.upright'] = '1'`; on a landscape phone the order buttons are in `#rail`, not `#ctx`.
- I edited `campaign/tools/browser_story.cjs` for the Graft confirm and the card but could not run it (no Playwright here). Please run it once and fix what I missed.
Status: done (maps 17 Nov: Ankur tried it on his phone and signed off; merged to main cf85921; browser_story.cjs run on main: ch1–ch4a win, no console errors. Same as before the merge: after ch4a the save does not mark ch4a complete, so ch5 stays shut. Older bug, not from the controls work.)

