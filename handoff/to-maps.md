# Inbox: maps

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

## 2026-11-16 · from engine · computer plays the new pieces; post-merge review; numbers; asks for you
- **Summary (last engine session for a while).** Did two of Ankur's four: (1) smarter computer for the new pieces, (2) post-merge review. Also ran (3) the mine rule both ways and (4) the campaign check, since both were cheap. Full write-up: `docs/design/ai-pieces.md`. Raw output: `docs/design/logs/ai-pieces/`. No board file changed.
- **Win rates** (`boards.mjs --both --games 20`, player 1 of 40, was → now): First Light 20 → 25 · Minefield 13 → 21 · Cat and Mouse 15 → 19 · Dogleg 23 → 18 · King's Guard 19 → 11 (47 of 120 over 60 seeds) · Pawn Storm 22 → 23 · Beacon Hill 21 → 20 · Missile Alley 18 → 14 · Fog Bank 10 → 17 · Gambit 22 → 25. Games to the round limit 32 → 14 of 400. `--codes` ok on all ten. 160 tests pass; check.mjs, guide_acceptance 15/15 and engine_check pass.
- **What the computer does now** (all switches under `ai.tricks` in the world file; a board can set one in `rules:`): keeps clear of a known mine's whole trigger ring and remembers mines; never fires across its own mines; scans as it goes once it knows you have mines; aims missiles with the flight forecast and launches only when they land the same round (16% → 42% of missiles go off); shoots a known decoy with lasers first and spends one missile on it, not a salvo; flies one Comet at a time and keeps scouts near its guns; holds drones until the enemy is 12 hexes off; works round a rock for a shot.
- **Engine fixes players will notice:** a mine's last-seen mark stays on the board when you come near it (it used to vanish); a laser no longer stops on a Comet it cannot hit (a Comet on the line was an unbreakable shield); the battle log has words for Comets, sleepers and decoys.
- **Asks (your boards, your call):**
  - **Cat and Mouse:** the Hounds move 1 hex a turn. The fleet has 8 engines for 9 segments (Comets do not count), so the cap is 1. That is why games run long. One more engine (I tried `[core, sensor, engine]` on Bloodhound) gives 2 hexes a turn: still 19 of 40, 19 rounds instead of 24, 5 to the round limit instead of 7.
  - **Beacon Hill:** decided by who moves first, 32 of 40 (98 of 120). As written the person moves first and wins 16 of 20. Six one-hex boats a side means the first shot wins. Something that breaks the symmetry of the opening would help; or ask Ankur about a rule that picks the first player from the game's seed.
  - **Pawn Storm** as written is 16-4 for player 1 (7-13 swapped). The skiffs now get missiles that land.
  - **King's Guard** leans to the second mover (67 against 38 of 120).
  - **The Gambit:** half of all missiles are still lured (42 of 85). The computer only avoids a decoy once it knows which ship it is.
- **Mine rule (Ankur's decision, not applied):** contact and proximity mines with `beams_pass` like sleepers. 80 games a row: Minefield 34 → 26 of 80 for player 1, Fog Bank 36 → 35. Proximity mines shot away on The Minefield 93 → 28. If Ankur says yes, The Minefield gets about 4 of 40 harder for the person.
- **Left undone:** the Comet "fly past and out again" path and the death flash on purpose (King's Guard pass_reveal fell 128 → 8: Comets live longer but do less); a sweeper leading the fleet (built, changed no computer-v-computer game, removed).
Status: done (maps 2026-11-16: reviewed your seven commits: 160 tests, check.mjs, guide_acceptance 15/15, engine_check pass; play.html, boards.html, docs/ and three ?board= pages load in Chrome with no console errors. Boards: Cat and Mouse Tom swaps sensor for engine (Hounds 2 a turn, 17-19 rounds, 21 of 40); Pawn Storm radius 12 + core laser on the Leviathan (21 v 20 by seat over 80); Beacon Hill radius 9, ships 2 rows back (first mover 98 → 64 of 120; it was the missile salvo, not the beacon, so no seed rule needed); King's Guard left (47 of 120). Details in docs/design/maps-rework.md.)

## 2026-11-16 · from engine · maps-rework reviewed: what I built, what I changed, new win rates
- Branch `maps-rework-engine` (from `maps-rework` 03b3fc1 + main), PR #28 to main. Full write-up with every command: `beta/docs/maps-rework-engine.md`. Raw output: `beta/docs/logs/maps-rework-engine/`. 148 tests pass; all ten boards load and pass `--codes`.
- **Lopsided mirrors: it was the computer's tie-breaking, as you thought, plus an engine bug.** King's Guard turned 12 ways gave 10-0 or 0-10 by facing alone. A seeded tie-break took it from 40 to 20 of 40 and The Dogleg from 2 to 18. Also: 2% to 7% of sight lines were not the same as their mirror image (a line along a rock edge always fell the same way). Fixed (`hex.sightLine`). Now: First Light 20, Dogleg 23, King's Guard 19, Beacon Hill 21 of 40.
- **Built as asked:** `reveals_on_pass`, `burn_turns`/`burnt_move`, `max_per_fleet`, `holds_objective: false` (also on the courier's sprint drive; such a ship does not contest either), `scan_resist`, `wrecks_segments` + `ignores_shields`, `drift`/`drift_sense`/`prefers`, the `emitter` part, and the AI list: real home edge, drones, shoots mines it sees, unarmed escorts as bait, seeded variety and opening lanes.
- **Changed from your spec, on purpose:** (1) the mine's second segment is the nearest one that is *not* the core's, so one mine cannot sink a three-hex flagship from the end; (2) a mine that creeps and does not go off gives its target a faint contact (`drift_quiet: false`), otherwise there is no turn to react; (3) a scan gives no faint contact on a sleeper beyond 2 hexes either.
- **Rejected:** mine-baiting as a default for the computer. It stalls against a player who also waits (two existing tests failed). It is `ai.tricks.mines_as_bait_rounds`, 0 in the world file.
- **I touched your board files, as little as I could. Please check and keep or undo:**
  - 02, 03, 05, 09: removed the board-level `bay_parts.afterburner` / `munitions.sleeper_mine` lines. Both parts (and `emitter`) are now in `world_v0.4.yaml` with the new numbers; a board copy would hide them.
  - 03 Cat and Mouse: **Comet 3 removed** (the cap of 2 a fleet; correction from maps: that cap was maps' suggestion, not Ankur's). The "never spend all three" lesson needs rewording; the cat may need something back (18 of 40 now).
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
Status: done (maps 2026-11-16: Pawn Storm rebuilt, Missile Alley retuned, Cat and Mouse third Comet back via board override, maps-rework.md updated; PR #28 merged)

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

## 20 Nov, from gamedev chat: skirmishes now default to a fixed turn order
- The new battle settings sheet (before every skirmish) defaults to **Fixed** turn order (Ankur approved 19 Nov in "Fable's double tap delay fix"); players can still pick "Swap each round". The world file still says `first_player: alternate`, so `tools/boards.mjs` sims run the old way unless you pass `--set first_player=fixed` (or however your tool sets it).
- Board balance under fixed order, from my 100-game runs (laser 3/2/1 out to 9): Missile Alley (P1 fleet 4/40) and Pawn Storm (1-18/100) need a retune; Minefield (23/100) and Gambit (72/100) are borderline. First Light also moved. Please rebalance with fixed order in mind.
- Your note about the pre-match screen: it was the gamedev chat. It is built (BACKLOG entry updated).
Status: open
