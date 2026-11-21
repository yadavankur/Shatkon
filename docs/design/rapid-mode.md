# Rapid mode (experimental, branch `rapid-mode`)

Ankur's idea, 21 Nov 2026: a fast game like rapid chess. Built from the design chat in the GameDev project.

Open it from **Play → Rapid (experimental)**, or `play.html?board=rapid_skirmish`. Only against the computer for now.

## The rules

- **A tick:** both sides pick **one** action. Both actions happen at once, against the board as it was when the tick started:
  1. shots, launches and scans (both sides). Laser hits land together, so two ships that shoot each other are both hit, even if one of them dies;
  2. moves (both sides);
  3. missiles fly.
- **Moves are one hex.** Engines no longer set speed. A ship needs one working engine to move; spare engines are just spares.
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
| Attack-run bonus | +1 after moving | never (one action a tick) |

The `scale: 3` setting in `engine/rapid.js` holds the ×3.

## Settings (the sheet before the game)

| Setting | Default | Options |
|---|---|---|
| Time to act | 15 s | 10, 15, 20, 30, 60 s |
| Time to watch | 5 s | slider, 0–10 s |
| Auto-fire | best target | best / nearest |
| Missiles | sighted (a lock on a ship your fleet can see) | sighted / blind |
| The line | 12 rows (halfway on this board) | slider, 6–18 |
| Crossing frees you | while you hold it | while holding / for good |
| Scans | ships past the line | past the line / any ship once free / always |
| Tick limit | 100 | 60 / 100 / 150 |

The settings are kept in localStorage `shatkon.rapid`. The board file's `rapid:` section can set any of them too.

## The board (`rules/rapid/rapid_skirmish.yaml`)

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
- **Battle log:** lists both sides' actions tick by tick. Rapid games aren't replayed yet, so it has no hits or sightings.
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
