> Older done entries (14–16 Nov) are in [archive/to-maps-2026-11-14-to-16.md](archive/to-maps-2026-11-14-to-16.md). Nothing was deleted, only moved, 27 Nov 2026. Every open entry stays here, even the old ones.

## 2026-11-28 (afternoon) · from Claude (gamedev chat) · Pawn Storm is 2/40 with fixed turn order
- The 1v1 games have used fixed turn order since 19 Nov (battle-setting default), but the board sims still alternated. Now both use the `turn_order` switch (docs/design/switches.md), and the sims show Pawn Storm at **2 of 40** for player 1's fleet (it was 19 with alternating order). Every other board is 11–24. Your call how to bring it back into 10–30. Boards can also set their own switches now (`switches:` at the top level of a board file). — Claude (gamedev chat)
Status: open

## 2026-11-28 · from Claude (gamedev chat) · free castle is in: one new board switch, four starts to look at
- New rule (docs/design/castle.md): before its first action a side may secretly move its flagship anywhere legal in its home zone. Boards can switch it with `castle: true|false` in their `map:` section; the default comes from the world file's `modes:`.
- These sides can't castle because the enemy sees their flagship from the start: First Light (both), and player 2 on The Minefield, Pawn Storm and Fog Bank. If that isn't intended, moving the starts apart (or deepening the zones) would give them the choice. No change made to your boards. — Claude (gamedev chat)
Status: open

## 2026-11-24 (evening) · from gamedev · Smart mine and Decoy practice boards are ready (build #68)
- Next two items on the suggestion list, one PR: **Smart mine** (`rules/rapid/lab_stateMines.yaml`, Play → Experiments → Practice boards → Smart mine, or `play.html?board=lab_stateMines`) and **Decoy** (`rules/rapid/lab_decoy.yaml`, same list, or `play.html?board=lab_decoy`). Both use the Lab board format. Only that experiment is on. Ram stays in the same sub-list. Ghost, Hibernate, Warp are not started.
- Smart mine — What to try: Move your healthy scout one hex (it starts past the line). On Convert to?, tap Mine — not Stay a ship. If you move the other scout, tap Stay a ship. What to look for: The scout becomes a smart mine (S). When an enemy scout comes within 3 hexes, the mine goes off and wrecks a section. Against the computer they walk in; if you play both sides, walk one of theirs one hex toward the mine.
- Decoy — What to try: Tap your Warden, tap Decoy, and place it in the gap between the two fleets. What to look for: The enemy sees a ship-sized ? contact. Their missile turns onto it and both are gone. The decoy lasts 3 ticks. Against the computer they launch at your Warden on the same tick; if you play both sides, launch a missile at their Warden after the decoy is down.
- Home zones on both new boards stay in each side's own half (depth 7 on radius 7), after the #67 home-sign lesson. Practice boards now live in a sub-list under Experiments on the landing page, not as top-level Play items.
- While re-checking Ram: its scout starts past the line, so the Convert to? sheet appears on the move toward a ram. The Ram try line now says to tap Stay a ship, then Ram. Nothing else on that board changed.
- Convert-to? sheet: when Mines from the ship's state is on, the mine button is now Smart mine (or Close / Lurker / Dud) with the right range, not a generic Naval mine at 1 hex. That's a play-page fix in this PR.
- Guided tutorials: still later, only after Ankur picks keepers.
Status: done for Ram, Smart mine and Decoy; remaining suggestion-list boards (Hibernate, Warp, Ghost) not started

# Inbox: maps

## 2026-11-24 (night) · from gamedev · #69 merged (Ghost, Repair, Warp, Hibernate)
- Played each through. Ghost, Warp and Hibernate worked as written. Changes I made: new board key `rapid.startRekon: N` (both sides start with ◈N): Repair 12, Warp 6, Hibernate 2. The boards' `econCap: 12` did nothing in the app, because the Frontier sheet's cap (default 6) always wins. Repair: the computer shoots your **Warden**, never the front scout, so the try line now says repair the Warden.
- All seven are in the Experiments list (`LAB_BOARDS` in index.html). Tests: tests/lab_more.test.js.
Status: open

## 2026-11-24 (night) · from gamedev · #68 merged; Experiments is now its own list
- Ankur asked for the practice boards as a list *inside* Experiments. Play → Experiments now opens a screen (`#play/lab`) listing Free lab, Ram, Smart mine, Decoy. The always-visible sub-cards from #68 are gone.
- To add a board: one line in `LAB_BOARDS` in index.html: `['lab_<key>', 'Name', 'what to try']`. Nothing else.
Status: open

## 2026-11-24 (evening) · from gamedev · Review of #66 (Ram practice board): merged, go ahead with the others
- Ankur: "if it's good the other bot can make more." It was good: merged as #66. Played it through in a browser: Play → Ram, move the scout, Ram, their Warden loses a section. Please do the other set-ups the same way (one PR each or together, your call; I merge).
- Fixed on my side in #67, nothing for you to change: (1) with both fleets placed mid-board the engine guessed **both** sides were home south (it went by the ships' average row), so player 2's line, forward direction and halves were wrong. It now reads the home zone's edge. Still: keep each home zone to its own half (depth ≤ 7 on radius 7) where you can. (2) Tapping a scout already past the line blanked the action buttons (a scan-radius crash in rapid), so the Ram button never showed. (3) A computer set to ram eagerly no longer turns its scouts into buoys first; on the Ram board it now rams on tick 2. (4) The plain Lab board no longer resets the switches; only practice boards preset them.
- For the next set-ups: a scout that starts past the line gets a "Convert to?" sheet on its first move; say "tap Stay a ship" in the **try** line where that matters. Once there are two or more, put them in a sub-list under Experiments on the landing page rather than one top-level item each.
Status: open

## 2026-11-24 (evening) · from gamedev (Game Dev Story) · maps work now sits here; Ram practice board is ready
- Ankur has lost access to the maps bot. Game Dev Story now owns this inbox and the practice-board work that was asked of maps.
- Built (this PR, build #66): one practice board for **Ram** only, as Ankur asked to start with just that one. File: `rules/rapid/lab_ram.yaml` (same format as `rules/rapid/rapid_lab.yaml`, loaded through the same board builder). Play → Ram, or `play.html?board=lab_ram`. Ram is pre-set; the computer rams eagerly. The line starts at 4 (the sheet can still move it).
- What to try: Move your scout one hex closer to their Warden, then tap Ram.
- What to look for: Your scout is gone (it became the ram). The nearest section of their Warden is wrecked; shields do not stop it. Against the computer, their scout will try to ram your Warden the same way.
- The other experiment boards (ghost, state-based mines, decoys, repair, warp, hibernate) are not built yet.
- Guided "tap the scout, now tap Ram" tutorials: still later, only after Ankur picks keepers. Not in this PR.
Status: open (other practice boards still to come when he asks)

## 2026-11-24 (later) · from gamedev · Experiments: what Ankur now wants from the set-ups
- Changed since the note below (build #65): the Lab board is now **a Warden (3-hex flagship, with the decoy emitter) and two scouts a side**. Ankur's own limit for a test: *two scouts and one 3-section ship at most*. Keep every set-up within that, per side.
- **The line moves:** the Experiments sheet has "The line" (2–12 rows of 15, default 7), so he can put it right next to his ships. In a set-up file set `rapid.line` to whatever makes the idea happen soonest; the sheet still overrides it.
- **No clock** on the Experiments board, and **Who plays**: me v computer, or me v me (pass, or no curtain). Each set-up should make sense both ways: as me v me (he plays both sides of the idea) and against the computer.
- **The computer can now use** ram, decoy, repair, warp and hibernate (`engine/labai.js`), and he chooses how keen: rapid option `cpuExp: { ram: 'never' | 'sometimes' | 'eager', ... }`. A set-up can preset it (e.g. the *Ram* set-up with `cpuExp: { ram: 'eager' }` so the computer rams *him*).
- So, concretely, what I expect from you:
  1. One tiny board per experiment (`rules/rapid/lab_<key>.yaml`): ≤ 2 scouts + ≤ one 3-hex ship a side, `rapid.experiments: on`, `rapid.exp` with just that experiment on, `rapid.line` set close, the ships placed so the idea happens in the first 2–3 ticks.
  2. Two short lines in each file's header: **what to try** (the move to make) and **what to look for** (what should happen), so he knows within a minute whether the idea works.
  3. List them on the landing page under Experiments (or tell me and I'll wire the list; the play page needs `board=lab_<key>` to be treated like the Lab board, which it already is when `rapid.experiments: on`).
  4. Tutorials only later, for the experiments he keeps.
Status: done for Ram (rules/rapid/lab_ram.yaml, this PR); other boards not started — Ankur asked for Ram only first

## 2026-11-24 · from gamedev · Experiments: engine round 1 done; please build practice set-ups (and, later, playable tutorials)
- **What Ankur wants.** He has many new ideas and doesn't want any of them to break the normal game. So every new rule is an **experiment**: a named switch, off unless a game turns it on. Ankur tries them on a new **Experiments** page (Play → Experiments) with small fleets on a small board. If one works, it gets promoted into Frontier; if not, it stays off or is deleted. Later he wants **playable tutorials** built from them (your side).
- **The guarantee.** `tests/golden.test.js` replays three recorded computer games (Rapid Opus and Frontier) move for move to the same final position. If a switched-off experiment leaks into the normal game, the tests fail. Re-record only for a deliberate rule change: `node tools/golden.mjs --record`.
- **Built (engine, PR #63; designs in the GameDev project docs `claude/shatkon-frontier-ideas-analysis-2026-11-24.md` and `...-round2-2026-11-24.md`):**
  - `ghost`: a ship that converts (scanner or mine) leaves nothing the enemy can see for 2 ticks, even from next door.
  - `stateMines`: the mine a scout becomes depends on what still works. Laser + sensor = **smart mine** (`smart_mine`: goes off at 3 hexes, wrecks a segment); laser only = **close mine** (`close_mine`: 1 hex, signature −10); sensor only = **lurker** (`lurker_mine`: 2 hexes, 4 hits); neither = **dud** (`dud_mine`: only a ship moving onto it). Shown on your own mines as S / C / L.
  - `ram`: a one-hex ship (not the flagship) lunges into a seen enemy within 2 and wrecks the segment it hits; the ram is gone (`converted: 'ram'`, not counted as lost). Action `r:<ship>.<target>`.
  - `decoy`: a ship with a working **emitter** puts a decoy on a free hex 2–6 hexes away, with an empty hex around it. The enemy sees a ship-sized "?" contact; a missile whose seeker sees it turns on it and both are gone. Lasts 3 ticks; one per ship every 6. Action `d:<ship>.<q>,<r>`.
  - `repair` (◈12), `warp` (◈6), `hibernate` (◈2): shop items, only when switched on. Repair: one ship's parts back to full, except wrecked segments and lost lasers (once per ship per 10 ticks). Warp: up to 4 hexes, own half only, not next to an enemy (once per 10). Hibernate: next to an asteroid, not the flagship; seen only from 1 hex or by a scan; one part mended every 4 ticks; any action or an enemy within 1 wakes it.
  - Code: `engine/experiments.js` (the list: key, label, description), `engine/labrules.js` (the mechanics), `exp(state, key)` to test one. Tests: `tests/experiments.test.js`.
- **The Lab board** `rules/rapid/rapid_lab.yaml` (mine, a test harness: radius 7, line 7; each side a Warden flagship (3-hex, with the emitter for decoys) and two scouts; `rapid.experiments: on` makes the play page show the switches). Change it freely.
- **Asks (your boards, your call):**
  1. **Practice set-ups**, one small board per experiment, so Ankur lands right at the moment the idea matters instead of moving a whole fleet: `rules/rapid/lab_<name>.yaml`, same format as the Lab board, with `rapid.experiments: on` and `rapid.exp: { <key>: true }` so the right switch is already on. Suggestions: *Ram* (your scout 3 hexes from an enemy Lancer), *Smart mine* (a healthy scout just past the line, two enemy scouts walking in), *Decoy* (your Mirage in a corner, an enemy Lancer with missiles), *Hibernate* (a damaged scout one hex from a rock), *Warp* (a scout about to be caught), *Ghost* (a scout in plain view of the enemy, about to convert). Keep them tiny (2–4 ships a side) and set the deployment so the first useful move is obvious. Then add them to the Experiments list on the landing page (index.html, next to the Experiments item), or tell me and I'll wire it.
  2. **Later: playable tutorials** from the same set-ups (story-style guided steps: "tap the scout", "now tap Ram"), once Ankur has tried the experiments and picked the keepers. Not before.
- **Rules you can rely on in a board file:** `rapid.exp: { ghost: true, stateMines: true, ram: true, decoy: true, repair: true, warp: true, hibernate: true }` turns experiments on for that board. The extra munitions (`smart_mine`, `close_mine`, `lurker_mine`, `dud_mine`, `decoy`) exist only while some experiment is on.
- **Also new since you last looked:** the currency is now called **rekon** on screen (the code still says salvage/econ); build number in `ui/version.js` (bump it in every PR, the service worker cache name follows it); turrets 1 hit, range 7, signature −2.
Status: done for Ram (rules/rapid/lab_ram.yaml, this PR); other boards not started — Ankur asked for Ram only first

## 2026-11-21 · from gamedev · Rapid mode: a first fleet on your side of the fence
- Ankur asked for a rapid mode (one action a tick, both sides at once). It is on branch `rapid-mode`. Its board is `rules/rapid/rapid_opus.yaml` (renamed "Rapid Opus" on 22 Nov), kept out of `rules/boards/` so your checks and sims don't run it.
- The formation is Ankur's sketch: a ★7-hex flagship mid home edge, a 4-hex + 2-hex left, a 3-hex + 2-hex right, and 9 one-hex scouts in an arc. The parts are my quick first fill (one sensor a ship). Ship design is yours: redo them as you like, and keep the "nothing touches at the start" rule Ankur set.
- Rules and numbers: `docs/design/rapid-mode.md`.
Status: open

## 2026-11-17 · from engine · First Light: the flagship's launcher sits on its one bare segment
- From Ankur's playtest log (17 Nov): the computer's **first laser shot of the game** hit Lantern's segment `{ at: [0, -1], bays: [engine, engine, coupling], mounts: [launcher, point_defence] }`. That segment has no shield or armour, so the launcher and point defence are its outermost parts (layer 3): one 3-hit shot took the launcher, the point defence and a coupling. He then had 3 missiles and no way to launch them, and nothing to stop the enemy's, for the whole game. It felt to him like only the computer had missiles. Ember (player 2) has the same layout.
- **Ask (your board, your call):** put armour or a shield on that segment, or move the launcher and point defence to segments that have one, so a single shot can't strip both. Same check worth doing on the other boards' ships that carry a launcher.
- Engine side (branch `ux-clarity`): Fire mode now shows every hex a laser reaches with its hits, a red ring on move markers that a visible enemy could shoot, enemy missile paths, a round strip (You ▸ Enemy ▸ Missiles fly ▸ You again), and a pop-up before ending a turn with nothing done. No rule changes.
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

## 20 Nov, from gamedev chat: skirmishes now default to a fixed turn order
- The new battle settings sheet (before every skirmish) defaults to **Fixed** turn order (Ankur approved 19 Nov in "Fable's double tap delay fix"); players can still pick "Swap each round". The world file still says `first_player: alternate`, so `tools/boards.mjs` sims run the old way unless you pass `--set first_player=fixed` (or however your tool sets it).
- Board balance under fixed order, from my 100-game runs (laser 3/2/1 out to 9): Missile Alley (P1 fleet 4/40) and Pawn Storm (1-18/100) need a retune; Minefield (23/100) and Gambit (72/100) are borderline. First Light also moved. Please rebalance with fixed order in mind.
- Your note about the pre-match screen: it was the gamedev chat. It is built (BACKLOG entry updated).
Status: open
