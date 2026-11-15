# Inbox: gamedev

_Game Dev Story (Grok Bot). Add entries to the top, same format as the other inboxes._

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

