# Inbox: gamedev

_Game Dev Story (Grok Bot). Add entries to the top, same format as the other inboxes._

## 2026-11-20 · from maps (for Ankur) · did you discuss a pre-match setup screen with Ankur?
- Ankur remembers asking a bot for a pre-match screen that sets the board's options, starting with friendly fire: "Warn" (ask before a shot that would hit your own piece and trace its exact path) or "Yes". Maps has no record of it. If you have that conversation, please remind Ankur and add the details to the BACKLOG.md entry "Pre-match board setup screen".
Status: open

## 2026-11-16 · from engine (Claude Code, for Ankur) · Variety study, Stage 1 done, waiting for your Stage 2 picks (branch variety-study, pushed; findings 1 and 2 corrected 16 Nov, see `beta/docs/balance-evidence.md`)

Stage 1 screening is finished: 597 cells, 6,100 games, 13 minutes of run time. `npm test`: 110 pass at the start, 115 at the end (5 new). Story chapters and art untouched; campaign `engine_check` output is identical with the new switches in.

**Where everything is**
- `beta/docs/balance-evidence.md`: findings, each labelled clear / leaning / unclear, and the Stage 2 candidate list.
- `beta/docs/variants-results.md`: every raw table with its command and seeds. Per-game logs in `beta/docs/logs/`.
- `beta/docs/scanning-and-defence.md`, `beta/docs/beta-rules.md`.
- `beta/rules/ai_variants.yaml` (frozen baseline, 47 variants, 12 pilots, 13 suites), `tools/variants.mjs`, 17 new fleets in `beta/rules/sim_fleets.yaml` (sizes 1 to 5, five counter fleets).

**What was done**
- Baseline frozen; one 40-game mirror for seat bias; pilots, sitting and both-sit, 16-fleet round robin, counter fleets, 3v3 / 4v4 / 5v5 personality teams (mixed and same-trait), 24 rule variants the engine already had, the missile strength series with missile counts.
- Behind new switches, all off in the game: forced movement (5 levels), fixed first player, longer scan exposure, exploding magazines; scanner, hunter and sacrifice pilots.
- Counter-tactic search on 11 lost match-ups.

**Headline findings (10 games a cell: only the ones marked clear are safe)**
1. Start position and turn order decide more games than the pilot: with the same fleet both sides, the same seat won both games of a seed in 106 of 135 pairs. Clear. Cause not proven (I suspect the back-to-back turns from the alternating first player).
2. The three personalities are equal on identical ships: eight of nine team cells were exactly 5-5.
3. Missiles are lost at the launch rail. Launching from 8 hexes raised launches from about 2 to about 7 a battle; salvo alone and warhead strength (3 to 9 hits) did nothing.
4. The attack-run bonus is the only rule that rewards moving (off: 8-2 against the sitter becomes 5-5). Leaning.
5. Forced movement only hurts the camper at the top levels (3 hexes or 100% of thrust: guns3 10-0, clear) and never ends a both-sit stall (20 of 20 games still hit round 30).
- Did nothing: both bank caps (identical results), warhead strength, scan exposure time, loud guns.
- One tactic that turns a lost match-up: swarm5 against mixed5, 3 wins head-on, 6 firing blind.

**What was not done**
- Stage 2 (40 games on chosen cells): waiting for you.
- Forward-arc movement: untested, ships have no facing in the engine. What it would need is in balance-evidence.md.
- Scan variants against a human; scan without moving first; partial scan readouts; bigger boards.
- The missile count cannot yet separate "caught in another blast" from "still flying at the end".
- No bug was proven, so nothing was fixed. One dead setting: `turns.first_player` in the world file was never read (the engine always alternated); it now also accepts `fixed`.

**One repeated run, for the record.** Stage 1A first ran with the same five seeds in every cell. I caught it from the seat totals before reading any result, gave each match-up its own seeds, and re-ran. Nothing was tuned after a result.

**Open questions for Ankur**
1. Which Stage 2 cells? My five: seat effect with fixed first player; attack-run control; forced movement against the camper; launch range against salvo; sensors and stealth. The full list of ten is at the end of balance-evidence.md.
2. The seat effect is the biggest thing found. Do you want me to dig into the cause before Stage 2, or just confirm it? **(Corrected 16 Nov after review: it was mostly the start spots, not the seat. Re-run with the two kept apart, the first seat won 272 of 510. See finding 1 in balance-evidence.md.)**
3. The dreadnought (one 255-point ship) went 112-38. Reprice it, or is one big ship meant to be strong?
4. The stock fleet went 43-107 against the others. Is it only a starter fleet, or should it be competitive?
5. The human-style pilots did not beat the computer. Should I test them on a bigger board, where finding the enemy takes longer, or leave tricks to chapter scripts?
Status: open


## 2026-11-16 · from engine (Claude Code, for Ankur) · Balance and computer-opponent pass on beta/ (branch balance-and-ai)

Everything is in `beta/` only (engine, rules, one line of `ui/play.js`), plus `tools/` and `tests/`. Story, campaign files and ship art are untouched. `npm test`: 98 pass before, 110 pass after. Campaign `engine_check` (20 games a chapter) gives the same output as main; `check.mjs` ALL CHECKS PASSED.

**What changed**
- **Computer opponent** (`beta/engine/ai.js`): "Vs computer: normal" now plays one of three personalities, picked per game: aggressive, balanced, defensive. Their numbers are in `beta/rules/world_v0.4.yaml` under `ai:` (`vs_computer: random` or a name). They keep the fleet together, step a hex before firing for the attack-run hit, measure real lines of fire (the old one counted shots from segments with no gun and at wrecked segments, then sat still), route round asteroids and their own mines, and save missiles for targets without point defence. Easy level and story chapters still use the old logic, unchanged.
- **Missiles** (Ankur's call, 16 Nov): `munitions.missile.wrecks_segment: true`. A missile that gets through wrecks the segment it strikes; a working shield on that segment takes the blow instead. One missile sinks a one-hex boat.
- **Salvo**: `actions.launch.salvo: true`. A ship's first launch of the turn costs the command point; its other launchers fire on the same order. The computer now launches from 8 hexes, not 5.
- **Missiles pass wrecked segments** (ported from the root engine; beta still stopped them on wrecks).
- A ship in the fleets file can carry its own personality: `ai: aggressive`.
- Optional computer tactics, off by default, for chapter design: `blind_fire` (missiles at a rough contact, a last-seen spot or the enemy's home rows, no lock), `unarmed_ships: bait`, `ignores_harmless`.
- **Tools**: `tools/sim.mjs` (one fleet, many pilots), `tools/scenarios.mjs` (every test fleet against every other; fleets in `beta/rules/sim_fleets.yaml`), `tools/counter.mjs` (flies the weaker fleet nine different ways to find the tactic that turns a lost match-up).

**Sitting still against moving** (stock fleet, random starting positions)

| Mover | Before: mover / sitter / no kill | After |
|---|---|---|
| Old computer | 22% / 58% / 20% (100 games) | unchanged: easy level only |
| Aggressive | did not exist | 72% / 28% / 0% (100 games); 60% / 40% on the new missile rules (20 games) |
| Balanced | did not exist | 73% / 27% / 0%; 70% / 30% |
| Defensive | did not exist | 66% / 34% / 0%; 65% / 35% |

The 13 Nov note had the sitter at 44 to 47%. I could not open the "shatkon-sim-findings-2026-11-13" doc, so that figure comes from the balance commit and the world file's notes. Personalities against each other: 50/50, 51/49, 46/54 (100 games each). Balanced beats the old computer 79 to 21 and easy 77 to 22. Idle turns: old computer 35%, personalities 0 to 1%.

**Rule changes tried on the stock fleet and not kept** (100 games each, mover's win rate against the sitter)
- Attack-run bonus 0: 33 to 39%. It is the only thing that makes moving pay. Bonus 2: 74%, no better than 1. Kept at 1.
- Silent running back on (-1): 65 to 67%, with draws. Kept at 0.
- No engine wake, scan flare 1, beams passing own missiles: no real change.
- "Attack run only when closing on the target": did not stop the camper (below). Removed.

**Fleet against fleet** (10 games a cell, 70 per fleet, both piloted by balanced; wins-losses-draws)

| Fleet (cost) | Old rules | New missile rules |
|---|---|---|
| stock (178) | 30-40-0 | 28-42-0 |
| guns3 (266) | 51-19-0 | 46-24-0 |
| missiles3 (334) | 23-47-0 | 40-29-1 |
| snipers3 (233) | 43-27-0 | 45-24-1 |
| decoys5 (205) | 28-42-0 | 26-44-0 |
| mixed3 (256) | 42-28-0 | 39-31-0 |
| swarm5 (325) | 37-33-0 | 31-39-0 |
| missile5 (376) | 26-44-0 | 24-46-0 |

- Under the old rules a missile fleet carried 15 missiles and got 4 to 7 away per battle. Hitting harder (5 hits), a wider seeker and no point defence each changed nothing. Wrecking a segment changed nothing by itself either; it needed salvo and the 8-hex launch range. At 12 hexes the missile fleet won 52-17.
- Decoys are not free: every order costs one of 3 command points. Decoys run ahead as bait, opponent not knowing: 8-62. On a 4-hex lead: 30-39, same as leaving them home. Against an opponent that ignores scanned harmless ships: 26-44.
- 5 command points a turn helps gun fleets most (guns3 59-11, stock 16-54).
- Staying home and shuffling a hex each turn ("camp") wins 80% with the stock fleet but loses with most others (guns3 2-8, snipers3 2-8 against the same fleet coming at it).

**Tactics that turn a lost match-up** (`tools/counter.mjs`, wins out of 10: head-on, then the tactic)
- missile5 v decoys5: 3, blind fire 9. missile5 v stock: 4, blind fire 10. missile5 v guns3: 4, blind fire 7.
- missile5 v missiles3: 2, fighting at maximum range 8.
- missiles3 v snipers3: 3, maximum range 6.
- swarm5 v snipers3: 3, spreading out 7. decoys5 v mixed3: 1, spreading out 6.
These are candidates for chapters the player can only win with one tactic.

**Bugs found, not fixed**
- A move that brings a hidden ship into view tells the opponent which hex it came from (the `move` event's `from`); beta's glide animation shows it. Repro: a ship 5 hexes from a sensor-2 enemy moves 2 closer; the enemy's event has `from: [0,5]`. Judgement call, left alone.
- beta/engine still lacks the root engine fixes (a hidden ship blocks a launch hex and gives itself away, fog-fair undo, sealed game codes, AI reading laser numbers). Only missiles-pass-wrecks was ported.
- `beta/campaign/tools/guide_acceptance.mjs` is the old copy: F3 fails (14/15); root's passes 15/15.
- ch1 header comment says the screen is 6 hexes from the Seed; the deployment is 7.
- Open Space map: the 30-round limit ends 55 to 91% of games with no kill.
- A flagship whose weapons are all shot off sits in view. Making it run only produced draws, so I left it.
- No clear bug found in the merged ship panel, halos, animation or symmetric-hull code. The symmetry check agrees with an independent geometric check on 20,000 random hulls. The play screen ran 9 rounds against the computer in headless Chrome with no page errors; touch, pinch and the Lab were not tested by hand.

**Open questions for Ankur**
1. Missiles now wreck a segment and fire in salvoes in every beta game, story chapters included. engine_check came out identical, but a human with missiles will feel it. Keep it on for the story?
2. The computer has no dice: a given personality opens the same way every game from the same start. Add some variety? A small random nudge cost it about 5 points of win rate and a few draws.
3. Want a picker (Vs computer: aggressive / balanced / defensive) instead of a random one per game?
4. The camper beats the computer 80% with the stock fleet. Fix the stock fleet (the flagship has one laser and moves 1 hex a turn) or teach the computer to out-wait a camper?
5. Should these changes go to the root game too? The root engine is ahead of beta in other ways, so it is a merge, not a copy.
6. The salvo rule is not mentioned in the in-game help sheet yet.
Status: open


## 2026-11-16 · from maps · beta promoted to main, beta/ removed
- Ankur chose to retire beta: beta's version is now the main game at the root (index.html, play.html, boards.html, engine/, ui/, rules/, campaign/, story/). beta/ is gone except three tiny pages that forward old links (beta/, beta/play.html, beta/boards.html keep the ?board= query).
- All work now targets root paths: `rules/boards/*.yaml`, `rules/world_v0.4.yaml`, `engine/`, `ui/`. Design notes moved from beta/docs/ to `docs/design/`. Tools and tests point at the root (`tests/beta-*.test.js` renamed without the prefix); `tools/sync-beta.sh` deleted.
- Merged, not overwritten: root-only work since the beta fork is kept (battle log `engine/log.js` + log buttons, sealed game codes, engine-fixes incl. one `beamHits` formula, which now also applies `evades_beyond`; `ui/gallery.js`, `ui/ships-gallery.html`, campaign/CHECKS.md). Beta's maps-rework engine, boards, Comet, mines, decoy and AI are all in.
- Two old root tests assume missiles do 3 hits; they now set `munitions.missile.wrecks_segment: false` locally (the world file keeps the wreck rule). `sigBreak` has an `emitter` field.
- Saves: the play page copies any `shatkon.beta.*` keys to `shatkon.*` once, where the main game has none of its own.
- Checks: 148 tests pass; campaign check.mjs ALL CHECKS PASSED, guide_acceptance 15/15, engine_check (--engine .) every chapter finishes; boards.mjs runs on the new paths.
Status: open
