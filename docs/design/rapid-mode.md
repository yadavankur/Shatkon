# Rapid Opus: rapid mode (experimental)

Ankur's idea, 21 Nov 2026: a fast game like rapid chess. Built by Claude Opus from the design chat in the GameDev project. The name "Rapid Opus" is so it can sit beside a Grok-built version of the same idea, for comparing code quality.

Open it from **Play → Rapid Opus**, or `play.html?board=rapid_opus`. Only against the computer for now.

## The rules

- **A tick:** both sides pick **one** action. Both actions happen at once, against the board as it was when the tick started:
  1. shots, launches and scans (both sides). Laser hits land together, so two ships that shoot each other are both hit, even if one of them dies;
  2. moves (both sides);
  3. missiles fly.
- **The opening:** until the first laser shot or missile launch (either side), ships move **up to 2 hexes**, the clock is **10 s**, there is no watch wait between ticks, and these ticks don't count towards the tick limit (Ankur, 21 Nov, after his first game: the walk-up was too slow).
- **After that, moves are one hex.** Engines no longer set speed. A ship needs one working engine to move; spare engines are just spares.
- **Forward only** until one of your ships is on or past **your line**:
  - On this board, forward means two of the six directions: north-east and north-west for the south side.
  - There is no sideways move, so you can't stall by shuffling.
  - Missiles and drones never count as crossing.
- **Crossing frees you.** Once a ship is on or past the line, you may move any way, pass and scan. By default only ships past the line can scan.
  - **While you hold it (default):** you stay free only while one of your ships stays past the line.
  - **For good:** you stay free from the first crossing on.
- **Out of time:**
  - If you chose a laser, missile or scan, it goes by itself after a red **Cancel** button has shown for 1.5 s. The laser or missile aims at the best or the nearest target (a setting).
  - If you chose a move but didn't confirm it, that move goes.
  - If nothing was chosen, the game spins through your ships and moves one forward. It never picks the flagship while another ship can go.
  - Once you're free, running out of time just passes.
- **Watch:** after each tick the controls sleep for the watch time while both sides' actions play out. A bar across the top shows the clock.
- **Win:** destroy the enemy flagship (the 7-hex ship). If neither flagship is destroyed by the tick limit, it's a draw.

## Second round of rules (22 Nov, after Ankur's second game)

Each one is a setting, on by default:
- **Shooting down missiles:** a laser can only hit a missile or drone within **3 hexes** (5, or any range, on the sheet). Further off, the beam flies past it. Shooting one down still costs your action; point defence stays free and automatic.
- **Close-in debris:** shoot a missile or drone down within 2 hexes and the shooter takes **1 hit** and is **lit up for 3 ticks**, parts readout included (log event `debris`).
- **Eyes past the line:** a ship on or past the line gets **+2 sensor range** (+3, or none). The first idea was a free rough-contact ring, but rough contacts already reach 3 hexes past normal sight, so it would have added nothing.
- **Attack run:** **+1 laser hit** for a ship that moved on the tick before it fires (`state.rapid.movedLast`). Before this there was no bonus at all in rapid mode.
- **Formation (wingman move):** when a ship fires, **one** friend within 2 hexes (touching, or one empty hex between) may also move 1 hex in the same tick. It is chosen after the shot (W markers; "Fire alone" skips it, and so does running out of time). It's written in the log as `<fire>+<move>`. Missile blasts still hit everything within 1 hex, so bunching up has a price.

Why ships seemed to shoot you unseen: a scout sees a scout from 5 hexes, but lasers reach 9, and a fleet shares what it sees. So one enemy spotter lets its other ships fire from 6–9 hexes. A hit shows the shooter only within 8. "Eyes past the line" and the attack run are partly aimed at this.

## Third round (22 Nov, night)

- **Going silent:** a one-hex ship (not the flagship) that ends a move on or past the line is asked **"Convert to?"**:
  - **Scanner buoy:** every tick, free, a full readout (parts too) within **4** hexes and rough contacts within 8. It is quiet (signature −2) and one hit kills it.
  - **Naval mine:** goes off when an enemy comes within 1 hex.
  - **Stay a ship.**

  The ship is gone, but it doesn't count as lost. Running out of time keeps it a ship. The computer converts its first scout past the line into a buoy, and later ones into mines when an enemy is within 2. Setting: `convert` (on/off); `buoyScan` [4, 8]. Tick text `<move>~scanner` or `~mine`.
- **Board marks** (every mode), wherever parts are known (your own ships, or an enemy read out by a scan or buoy):
  - a **yellow ring** on each segment whose shield is up;
  - on enemies, a red **T** on each segment with a working laser;
  - once an enemy has no working laser, a red **E** on each segment with a working engine.
- **Formation:** selecting a ship rings it and its possible wingmen (friends within 2 hexes) in **purple**. The hint says "Formation bonus: when it fires, a free wingman move…".
- **Fixed:** shields and point defence only recharged in ticks where something was in the air. The flight step, which does that upkeep, was skipped when there were no missiles. It now runs every tick, and its "End of round" banner is not shown in rapid games.

## Wingman fires (22 Nov, night, Ankur)

- The formation bonus is now a **shot**. When a ship fires, one friend within 2 hexes fires too in the same volley, at any target it has.
- A friend with nothing to shoot may move 1 hex instead.
- Ankur's picture: ship A is being shot at and brings ship B up behind it. Next tick A fires and B fires too, so two hits go back.
- In the wingman step:
  - red **W−n** markers sit on targets: B fires there for n hits;
  - green **W** markers are moves for friends with no shot;
  - "Fire alone" skips the wingman.
- Setting `wingman`: `fire_or_move` (default), `move`, or `off`. Tick text `<fire>+<fire>`.
- The computer picks its wingman's best shot first.
- Watch for: this doubles a formation's firepower. The counter is the missile blast, which hits everything within 1 hex.
- **Fixed:** when a game ended partway through a tick, the other side's action was recorded as "pass". So the last tick of a log, and the replay, could be wrong.

## Rules counted in ticks (1 round ≈ 3 ticks)

| Rule | Normal game | Rapid mode |
|---|---|---|
| Missile speed | 6 a round | 2 a tick |
| Missile fuel | 3 rounds | 9 ticks (same 18-hex reach) |
| Drone | 3 a round, 6 rounds | 1 a tick, 18 ticks |
| Shield recharge | 1 round unhit | 3 ticks unhit |
| Flares, scan reveal | to the end of next round | 3 ticks |
| Point defence | 1 a round | 1 every 3 ticks |
| Command points | 3 a turn, bank 6 | 1, no bank |
| Attack-run bonus | +1 after moving this turn | +1 if the ship moved last tick |

The `scale: 3` setting in `engine/rapid.js` holds the ×3.

## Settings (the sheet before the game)

| Setting | Default | Options |
|---|---|---|
| Time to act | 15 s | 10, 15, 20, 30, 60 s |
| Opening clock | 10 s | 5, 10, 15 s |
| Opening moves | 2 hexes till the first shot | 2 hexes till first shot / 2 hexes always / 1 hex |
| Time to watch (after the first shot) | 3 s | slider, 0–10 s |
| Auto-fire | best target | best / nearest |
| Missiles | sighted (a lock on a ship your fleet can see) | sighted / blind |
| The line | 12 rows (halfway on this board) | slider, 6–18 |
| Crossing frees you | while you hold it | while holding / for good |
| Scans | ships past the line | past the line / any ship once free / always |
| Tick limit (opening not counted) | 100 | 60 / 100 / 150 |

The settings are kept in localStorage `shatkon.rapid`. The board file's `rapid:` section can set any of them too.

## The board (`rules/rapid/rapid_opus.yaml`)

- **Board:** radius 12. Your home is the south edge, and player 2 is the same layout turned round.
- **Fleet:** a ★7-hex flagship in the middle; a 4-hex and a 2-hex on the left wing; a 3-hex and a 2-hex on the right; nine one-hex scouts in an arc bulging around the flagship.
- **Spacing:** nothing touches at the start.
- **Ship parts** are a first fill to tune by playing:
  - One sensor per ship, so the big ships rely on scouts to spot for them.
  - The flagship carries 2 Nukes, 3 advanced and 3 basic missiles.
- **Why `rules/rapid/`:** rapid boards live there, not in `rules/boards/`, so the ten-board checks and `tools/boards.mjs` don't run them under normal rules.

## Code

- `engine/rapidrules.js`: forward directions, the line, unlocked, who may scan. Read by `actions.js` and `query.js`.
- `engine/rapid.js`: `rapidRules`, `rapidStart`, `rapidTick`, `rapidAI`, `rapidRefusal`, `forcedMoves`, `autoFire`, `autoLaunch`.
  - Between ticks the state rests as "player 1 to act, 1 point", so `reach`, `beamTargets` and the rest work unchanged for the screen.
- Small hooks in the normal engine (all off unless `rules.rapid`):
  - `doMove` (1 hex, forward rule)
  - `movesLeft`
  - `doFire` (hits held back while `state.deferHits` is set)
  - `doLaunch` (sighted)
  - `doScan` (who may scan; no "moved first" rule)
  - `reach` (forward only)
  - `shipStatus.scanReady`
  - point-defence reload in `runFlight`
- `ui/play.js` (section "rapid mode"): the clock, auto-fire with Cancel, the forced move, the Pass button, and both lines on the board (`drawBoard({ lines })`).
- `ui/settings.js`: `RAPID_SETTINGS`, with sliders for the watch time and the line.
- **Battle log:** replays the game from its seed tick by tick (`rapidLog` in `engine/log.js`), so it has hits, sightings and a working recap; `replayLog` rebuilds a rapid game too. Logs saved before 22 Nov have no seed and only list the actions.
- **Tests:** `tests/rapid.test.js`.

## First computer-vs-computer numbers (10 games, normal v normal, tick limit 100)

- First ship lost: tick 17–21.
- First crossing: tick 44–84.
- **Every game was a draw at tick 100**, with 5–8 ships left a side.
- Actions per game: about 120 moves, 60 shots, 12 launches, 6 scans.
- Flagships were barely scratched: 83–100% hull at the end, and in 2 games of 10 never hit. The computer keeps its flagship home, and the two flagships start 20 hexes apart.

What this suggests, all untested:
- One action a tick for 14 ships is slow. Options:
  - fewer ships;
  - the line closer to home;
  - shields that recharge less often;
  - a shrinking board;
  - a flagship that must cross too.
- The computer only uses the flagship as a last resort. A human may play very differently.
- The opening missile volley is gone in sighted mode. With one sensor a ship, nothing sees anything at the start.

## Variants (21 Nov, after the computer learned to advance as a fleet)

Reproduce with `node tools/rapid_variants.mjs 10 <tick cap> [name]`. Each line is 10 games, computer v computer.

| Variant | Tick cap | Won / drawn | Avg ticks | First ship lost | Flagship damage |
|---|---|---|---|---|---|
| As built | 100 | 0 / 10 | 100 | tick 22 | 2% |
| As built | 200 | 4 / 6 | 196 | tick 22 | 28% |
| Smaller fleet (5 scouts, no 4-hex) | 100 | 0 / 10 | 100 | tick 10 | 1% |
| Missiles wreck a segment, 3 hexes a tick | 100 | 0 / 10 | 100 | tick 22 | 2% |
| Shields recharge after 9 ticks | 100 | 0 / 10 | 100 | tick 22 | 2% |
| Line at 8 rows | 100 | 0 / 10 | 100 | tick 16 | 1% |
| Fleets start 4 rows closer, line 8 | 100 | 0 / 10 (both flagships died the same tick) | 28 | tick 12 | 38% |

Reading:
- **Distance is the bottleneck.** You move one ship one hex a tick, so walking a fleet 10 rows takes about 50 of your ticks. Neither a smaller fleet nor stronger missiles shortens that walk. Starting closer does, about 7 times over.
- **Missiles barely land.** About 1 blast a game. A launch costs one action and so does shooting the missile down, and at 2 hexes a tick there is time to do it.
- **The draws at "4 rows closer" are mutual kills.** Mirrored fleets with the same computer go for each other's flagships at the same time. Against a person that won't be the pattern.

## Ankur's first game (21 Nov) and what changed

- He found it plays well, but the walk-up was slow and the 15 s clock too long while nothing was happening. Hence the opening rules above.
- **"The laser controls died after I crossed the line."** His log was from before logs could be replayed, so the exact cause can't be proven. Rebuilding the game from its actions (positions match; damage dice differ) showed his ships did have targets on most ticks after the crossing, and the engine accepted those shots.
- **Found and fixed:** tapping a target a second time never fired, in every game mode. A friendly-fire check left an empty `warn` note on the aimed shot, so the second tap never matched it. Only the Fire button worked. Under a 15 s clock that looks like dead controls.
- Also likely: lasers sit right under shields and armour, so two 2-hit shots strip a scout's laser. The ship card shows it, but it's easy to miss in a rush.
- **His battle report was empty** (0 shots, 0 damage, a "quiet battle") for the same reason: the old rapid log held no events. Fixed by the replay. Missiles in the report are credited to the launching ship's owner, and missiles shot down count as wasted.
- Logs are now replayable, so the next time something like this happens the log will show exactly why.
