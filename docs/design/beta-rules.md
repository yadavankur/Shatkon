# Beta rules, pilots and tools

16 Nov 2026. The rules are the numbers in `rules/world_v0.4.yaml`. This page lists every rule in that file and says whether I checked it against the engine code in `engine/` while writing this.

- **Checked** = I read the code that applies it during this study.
- **Not re-checked** = taken from the world file's own notes; I did not read the code for it this time.

## How to play, in short

1. Each player has a fleet. Lose your flagship and you lose. *(Checked: `damage.js` `checkWin`. A fleet with no flagship loses when every ship is dead.)*
2. Ships start hidden in their own home rows (3 rows deep on the skirmish map).
3. On your turn you get 3 command points. Each order costs one: move a ship, fire one laser, launch, scan, or detonate a drone.
4. Your fleet shares one pool of thrust. Moving a ship one hex costs 1 thrust per segment of that ship.
5. You only see an enemy that is close enough to your sensors, or that has just fired, launched or scanned.
6. A laser hits harder up close (3 hits out to 4 hexes, 2 out to 8), and one more if the ship moved first this turn.
7. Missiles fly in a phase after both players have moved. One that gets through wrecks the segment it strikes, unless a working shield takes the blow.
8. After round 30 with both flagships alive the game is a draw (or decided on points on a map with an objective). *(Checked: `turn.js`, `objective.js` `limitWinner`.)*

## Rules in the world file

### 1. Turns

| Rule | Value | Status |
|---|---|---|
| Command points per turn | 3 | Checked (`turn.js` `startTurn`) |
| Most unspent points carried over | 6 | Checked |
| Round: player, player, then the flight phase | | Checked (`endTurn`) |
| First player | swaps every round | Checked. Note: the engine ignored this line and always swapped; it now also accepts `fixed` (simulation switch) |
| Flight phase steps | 6 | Not re-checked |
| Turn limit | 30 rounds | Checked |

### 2. Actions

| Action | Cost | Rule | Status |
|---|---|---|---|
| Move | 1 | one ship moves, you choose how far | Checked (`actions.js` `doMove`) |
| Fire | 1 | one laser; each weapon once a turn | Checked (`doFire`, `query.js` `beamTargets`) |
| Launch | 1 | each launcher once a turn. Salvo: a ship's first launch costs the point, its other launchers fire free on the same order | Salvo written on 16 Nov; not re-read this time |
| Scan | 1 | once per ship per turn, only after it has moved | Checked (`doScan`) |
| Detonate | 1 | blow up one of your own drones | Checked (`doDetonate`) |
| Ram | story only | 4 hits per living segment, reach +2, pierces shields | Not re-checked |
| End turn | 0 | unspent points go to the bank | Checked |

### 3. Segments and slots

| Rule | Value | Status |
|---|---|---|
| Segments per ship | 1 to 7 | Not re-checked |
| Bays and mounts per segment | 3 and 3 | Not re-checked |
| Cost per segment | 3 | Not re-checked |
| A coupling in every segment after the first | on | Not re-checked |
| Hulls must be symmetrical | on | Not re-checked (the 16 Nov pass compared the check with an independent one on 20,000 hulls) |

### 4. Movement

| Rule | Value | Status |
|---|---|---|
| Each working engine adds 1 thrust to the fleet pool each turn | | Checked (`thrustIncome`) |
| Moving 1 hex costs 1 thrust per segment | | Checked (`doMove`) |
| A weak fleet may still move one ship (`needs_average_of: 0`) | | Checked |
| No ship moves further than engines ÷ segments (rounded down) + 1 in a turn | | Checked (`moveCap`). With the stock fleet that is 1 hex a turn per ship |
| Thrust carried over | at most 2 turns of engine output | Checked |
| A move stops when the ship bumps into something it could not see; both are lit up | | Checked |
| A move stops on a mine and the mine goes off | | Checked |

### 5. Detection

| Rule | Value | Status |
|---|---|---|
| You see a target if distance ≤ your sensor range + its signature | | Not re-checked (`detect.js`) |
| Sensor range | core 2, each sensor +2 | Not re-checked |
| Signature | segments − 1 per stealth part, never below segments ÷ 3 rounded up | Not re-checked |
| Missiles and drones have signature 1 | | Not re-checked |
| Flare (extra signature) | laser fired 0, laser hit 3, launch 2, point defence 2, scan 2 | Amounts read from `rules.js`. Checked that a flare lasts until the end of the next round (`addFlare`) |
| Scan rings [clear, faint] | [2,4] near home, [4,7] mid-field, [6,10] from the centre line | Checked (`scan.js`) |
| Clear ring never wider than sensor range + 2 | | Checked |
| Mid-field starts 2 rows past your home rows | | Checked |
| A scan reads out every part of every ship in the clear ring | | Checked (`doScan`) |
| Attack run | +1 laser hit if the ship has moved at least 1 hex this turn | Checked (`attackRunFor`) |
| A ship that did nothing | no signature change (was −1) | Value checked; the code that applies it not re-read |
| Engine wake | +1 signature after 2 or more hexes of net movement | Not re-checked |
| Rough contacts | within 3 hexes beyond sight; the circle is 2 hexes across | Not re-checked |
| A blast reveals everything within 4 hexes | | Checked (`explode`) |
| `scan_fuzzy_extra`, `shown_enemy_sensor` | old or display-only | Not re-checked |

### 6. Comms

Ships are linked when within the longer of their two link ranges (core 4, comms part 12); a ship may fire at or lock onto anything its network sees. *Checked only that firing uses the network (`beamTargets` calls `networkSees`).*

### 7. Damage

| Rule | Status |
|---|---|
| Each hit takes 1 hp from a random working part in the outermost layer of the segment | Checked (`applyHits`) |
| A hit that finds nothing left wrecks the segment | Checked |
| A wrecked segment stays attached and still costs thrust; lasers and missiles pass through it | Checked for lasers (`beamTargets`); missiles ported on 16 Nov, not re-read |
| A ship dies when its core is destroyed, or when it has lost parts and only engines and the core still work | Checked (`isDead`) |
| Friendly fire is on | Checked for blasts and mines |
| Your missiles and drones fly through your own hulls | Not re-checked |
| Lasers stop on mines and on your own missiles | Not re-checked |

### 8 and 9. Parts

| Part | What it does | Cost | Status |
|---|---|---|---|
| Core | required; sensor 2, link 4 | 0 | Death rule checked |
| Engine | +1 thrust | 6 | Checked |
| Sensor | +2 sensor range | 5 | Not re-checked |
| Stealth | −1 signature | 0 | Not re-checked |
| Flare mask | −1 to this ship's flares | 5 | Checked (`addFlare`) |
| Magazine | holds 3 munitions; a ship cannot carry more than its surviving magazines hold | 3 | Checked (`clampLoad`) |
| Comms | link range 12 | 5 | Not re-checked |
| Coupling | joins a segment to the ship | 0 | Not re-checked |
| Shield | soaks the first hit on its segment; back after a round without being hit | 8 | Soaking checked; recharge not re-checked |
| Armour | 2 hp, does not come back | 5 | Checked (it is an outer layer in `applyHits`) |
| Laser | 3 hits, range 8, loses 1 hit every 4 hexes; needs a clear line; will not fire through your own ships | 10 | Checked |
| Launcher | launches from the ship's magazines | 4 | Not re-checked |
| Point defence | stops 1 enemy missile or drone a round about to hit **this** ship; lights the ship up | 7 | Checked (`explode`) |

### 10. Munitions

| Rule | Value | Status |
|---|---|---|
| Missile speed, fuel, turn rate, seeker range | 6 hexes a round, 3 rounds, 1 turn a step, 2 hexes | Not re-checked (`flight.js`) |
| Missile strike | wrecks the segment it strikes; if that segment has a working shield, 3 hits instead | Checked (`explode`) |
| Missile blast | 1 hit to every other segment within 1 hex, yours included; destroys other small objects within 1 hex | Checked |
| Seeker drone | speed 3, fuel 6, sees 3, 2 hits, can be detonated | Not re-checked |
| Mine | 4 hits, nearly invisible, placed before the game, 6 at most | Hits checked; the rest not re-checked |

### 11. Terrain

Asteroids block movement and sight *(checked: `doMove`, `beamTargets`)*. A nebula cuts sensors by 3 and signature by 2 inside it *(not re-checked)*.

### 12. The computer opponent

"Vs computer: normal" plays one of three personalities, picked per game from the game's own secret number. *(Checked: `ai.js` `personalityOf`.)* Easy level and story chapters do not use them.

| Personality | Fights from (escorts, flagship) | Escorts stay within | Launches from |
|---|---|---|---|
| Aggressive | 2 and 3 hexes | 3 hexes of the flagship | 8 hexes |
| Balanced | 3 and 4 hexes | 3 hexes | 8 hexes |
| Defensive | 5 and 6 hexes | 2 hexes | 8 hexes |

All three *(checked in `ai.js`)*:

- fire the best laser shot they have before anything else, and step one hex first for the attack-run hit when they have a point to spare;
- launch at a located ship inside their launch range, choosing one with no working point defence if a scan has shown it;
- scan when they have not located a big enemy ship;
- otherwise move the ship whose position improves most, round asteroids and known mines.

Optional switches for pilots, all off in the game: `blind_fire`, `unarmed_ships: bait`, `ignores_harmless`, and, added in this study, `scans: eager`, `target_priority: threat`, `bait_ship: smallest`.

### Simulation-only rule switches (added in this study, off in the game)

| Switch | What it does | Checked |
|---|---|---|
| `turns.first_player: fixed` | the same player moves first every round | test in `tests/beta-variants.test.js` |
| `movement.min_move: N` or `"N%"` | the turn cannot end, and the last command point cannot be spent on anything else, until the fleet has moved N hexes or spent N% of this turn's thrust, unless no ship can move | test, for N = 1 |
| `detection.flare_rounds.scan: N` | a scan lights the scanner for N rounds | no test; ran in the `scan_b` suite |
| `damage.magazine_explodes: N` | a destroyed magazine on a ship that still carries munitions wrecks its segment and does N hits to each neighbouring segment | no test; ran in the `scan_b` suite |

The play screen does not know about these. `min_move` in particular would refuse "End turn" with only a text reason.

## Tools

| Tool | What it is for | Example |
|---|---|---|
| `tools/variants.mjs` | Named rule and pilot variants on many fleets, with intervals, seeds and a per-game log. Driven by `rules/ai_variants.yaml` | `node tools/variants.mjs --list` · `node tools/variants.mjs --suite forced --md` · `node tools/variants.mjs --games 40 --cell "baseline \| stock:balanced v stock:sitter"` |
| `tools/counter.mjs` | Flies a losing fleet nine ways to find one tactic that turns the match-up | `node tools/counter.mjs --fleets swarm5 --against mixed5` |
| `tools/scenarios.mjs` | Every fleet against every other with rule numbers changed on the command line | `node tools/scenarios.mjs --fleets stock,guns3 --set munitions.missile.hits=5` |
| `tools/sim.mjs` | The shipped two-ship fleet with different pilots | `node tools/sim.mjs --pairs balanced/sit --deploy random --games 20` |
| `npm test` | 115 tests | |

Fleets and ship designs for all four are in `rules/sim_fleets.yaml` (25 fleets, costs from `--list`).
