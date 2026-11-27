# Muse, the hunter — a new computer opponent

A second computer personality for Vs-computer skirmish, written from scratch
in `engine/ai-muse.js`. It plays measurably differently from the stock computer:
over 200 games against it, the overall score is dead even (99–100, 1 draw),
but the per-board results swing from 20–0 to 3–16 — the hunter wins the boards
where closing and killing wins, and loses the boards where patience wins.

## The design

Where the balanced computer fights at full laser strength, keeps its fleet
together and only shoots what it can see clearly, Muse picks the biggest enemy
ship it can see, closes to point-blank range, and spends everything — missiles,
Comets, its own escorts — trying to kill it. It fires at the flagship even
through a bad line, launches missiles at long range (12 hexes, forecast must
land within 2 flight phases), flies Comets straight at the flagship to light it
up and die flashing, and ignores mines, the beacon and its own exposure while
the chase is on. It never waits for a better shot and never ends a turn with a
ship that could still close. The enemy flagship is a guess — the biggest ship
seen — since the fog of war never names it.

How that differs from the balanced computer, decision by decision:

| Situation | Balanced computer | Muse |
|---|---|---|
| A shot at the biggest ship, bad line | Holds fire, waits for a clean line | Fires anyway (+30 for the quarry) |
| A shot that wrecks a segment | Takes it if it is the best shot | Takes it, and steps first for the attack-run +1 |
| A missile lock at 12 hexes | Only inside its preferred range | Launches if the forecast lands within 2 flight phases |
| Nothing in sight | Holds position, scans from safety | Hunts the enemy home; blind-fires a missile at the last-seen spot |
| A mine in the way | Routes round it | The flagship steers clear; escorts walk straight through |
| The beacon (Beacon Hill) | Contests it | Ignores it — kills the flagship instead |
| A ship that has moved, with CP left | Ends the turn if nothing scores | Moves again if any step shortens the path to the quarry |

## How to select it

- **In the game:** before a Vs-computer skirmish, the battle settings sheet has
  a "Computer opponent" row: **Random** (the default — the game as it ships)
  or **Muse, the hunter**. The choice is stored in `shatkon.battle` and only
  affects Vs-computer play.
- **In a board file:** `ai.vs_computer: muse` in the board's `rules:` block,
  the same way boards pin `balanced` / `aggressive` / `defensive` today.
- **In code:** `computerMove(state, seat, 'normal', { personality: 'muse' })`,
  or `museMove(state, seat, level, opts)` from `engine/ai-muse.js` directly.

Muse is deliberately **not** in the world file's `ai.personalities`, so the
`random` pool is unchanged and the default game is untouched. Easy mode is the
same hunter with a 30% blunder rate (a random legal action, drawn from the
game seed, so easy games still replay exactly).

## Matches: Muse vs the stock computer

`node tools/muse-vs-opus.mjs` — Muse (`computerMove` with
`{ personality: 'muse' }`) against the stock computer (`computerMove` normal,
which plays whatever personality the board pins). 10 games a board per seat,
seeds 1–10, 200 games. "Opus" below is the stock computer, not a person.

| Board | Opus personality | Muse | Opus | Draw | Avg rounds | Muse as seat 1 | Muse as seat 2 |
|---|---|---|---|---|---|---|---|
| 01_first_light | random (world default) | 9 | 11 | 0 | 6.1 | 3–7 | 6–4 |
| 02_minefield | balanced | 3 | 16 | 1 | 12.8 | 1–8–1 | 2–8 |
| 03_cat_and_mouse | balanced | 6 | 14 | 0 | 14.7 | 4–6 | 2–8 |
| 04_the_dogleg | balanced | 9 | 11 | 0 | 15.3 | 5–5 | 4–6 |
| 05_kings_guard | balanced | 15 | 5 | 0 | 9.9 | 5–5 | 10–0 |
| 06_pawn_storm | balanced | 20 | 0 | 0 | 8.3 | 10–0 | 10–0 |
| 07_beacon_hill | balanced | 14 | 6 | 0 | 13.6 | 7–3 | 7–3 |
| 08_missile_alley | aggressive | 5 | 15 | 0 | 10.6 | 3–7 | 2–8 |
| 09_fog_bank | aggressive | 10 | 10 | 0 | 7.8 | 2–8 | 8–2 |
| 10_gambit | defensive | 8 | 12 | 0 | 10.8 | 3–7 | 5–5 |
| **Total** | | **99** | **100** | **1** | **11.0** | **43–56** | **56–43** |

Smoke run first (3 games a board per seat on First Light, Minefield, Fog Bank,
18 games): Muse 7 – Opus 11, same shape — Minefield 0–6, Fog Bank 5–1.

What the table says:

- **The hunter is real.** Pawn Storm 20–0, King's Guard 15–5, Beacon Hill
  14–6: on open boards the chase works, and Beacon Hill wins by killing the
  flagship before the beacon decides anything — the objective Muse ignores
  turns out not to decide many games.
- **The hunter pays for it.** Minefield 3–16 (it walks into mines), Missile
  Alley 5–15 (it closes into missile range and eats the reply), Cat and Mouse
  6–14 (the stealth board: it cannot find what it is hunting).
- **Moving second suits the hunter.** Muse wins 43 as seat 1 and 56 as seat 2
  (of 100 games each). Moving second, the enemy has already moved into range
  and into sight, so the fire-first logic gets a target on turn one; moving
  first, Muse closes and then eats the reply. The stock computer shows the
  same seat effect in reverse, so this is a property of the matchup, not of
  one side's fleet.
- **One draw:** a single Minefield game reached the 30-round limit with both
  flagships alive.

Re-run it: `node tools/muse-vs-opus.mjs --games 10 --codes` (about 75 seconds
for the full 200). `--games 20` is the 40-games-a-board run (400 games).
`--board 04_the_dogleg` limits it to one board. `--codes` saves the
representative game codes below.

### The Dogleg bug the harness found

The first full run drew **20 of 20** on The Dogleg, every game to the round
limit. Diagnosis: Muse scored a move by straight-line distance to the quarry,
so every hex round a bend of the canyon looked further away than staying put —
its flagship parked at the mouth of the canyon and waited, and the stock
computer, seeing nothing, waited too. The stock computer against itself
finishes The Dogleg 20 of 20 (7–13, ~15 rounds), so this was Muse's bug, not
the board's.

The fix (`engine/ai-muse.js`, `stepsTo`): score a move by path-aware distance —
a BFS over centres where the whole ship fits, walking round rocks and known
mines — plus a progress fallback that takes a step shortening the path even
when the score's shot bonus argues against it. After the fix The Dogleg is
9–11 over 20 games, 0 to the round limit, 15.3 rounds, and there is a
regression test (`tests/muse-ai.test.js`, "Muse does not stall in a canyon").

## Sample game codes

One finished game per board, a Muse win where there was one, saved under
`docs/design/muse-ai-codes/`. Each was verified to round-trip through
`importGame` (same state hash out as in). Load one in the game — drawer
(☰, top right) → **Load a game code** — to see the final position. The full
code is in the file; the prefix below identifies it.

| Board | Code file | Result |
|---|---|---|
| 01_first_light | `docs/design/muse-ai-codes/01_first_light.txt` | Muse wins as seat 1, seed 1 — `SKG1:eJztXV1v6zaT.isEb9oCStaSbCfxuWq7LXa…` |
| 02_minefield | `docs/design/muse-ai-codes/02_minefield.txt` | Muse wins as seat 2, seed 4 — `SKG1:eJzlPdmO4ziSvyLoZWYA2avD8lVP3T3TmAW…` |
| 03_cat_and_mouse | `docs/design/muse-ai-codes/03_cat_and_mouse.txt` | Muse wins as seat 1, seed 1 — `SKG1:eJztPWuP4zaSf0XQl00AuU8Py6.5tMlucAd…` |
| 04_the_dogleg | `docs/design/muse-ai-codes/04_the_dogleg.txt` | Muse wins as seat 2, seed 2 — `SKG1:eJzlXVuP47ix.iuCXpIA6j66um3P0-6eLHK…` |
| 05_kings_guard | `docs/design/muse-ai-codes/05_kings_guard.txt` | Muse wins as seat 2, seed 1 — `SKG1:eJzdXd2ToziS.1cIXnY2gqozYGyX-2lnbif…` |
| 06_pawn_storm | `docs/design/muse-ai-codes/06_pawn_storm.txt` | Muse wins as seat 1, seed 1 — `SKG1:eJzdPNuO47aSv0LwJQkg91ryrdvzlGRPsAs…` |
| 07_beacon_hill | `docs/design/muse-ai-codes/07_beacon_hill.txt` | Muse wins as seat 1, seed 1 — `SKG1:eJzNXV9z2ziS.yosvuxuFaUjSEmWlaeZ2Z3…` |
| 08_missile_alley | `docs/design/muse-ai-codes/08_missile_alley.txt` | Muse wins as seat 1, seed 3 — `SKG1:eJztPWtv4ziSf0XQl50FFJ.18qs.zczt4A7…` |
| 09_fog_bank | `docs/design/muse-ai-codes/09_fog_bank.txt` | Muse wins as seat 1, seed 1 — `SKG1:eJztPduO47qRvyLwJQmg9upiubs9T8nZDLJ…` |
| 10_gambit | `docs/design/muse-ai-codes/10_gambit.txt` | Muse wins as seat 2, seed 1 — `SKG1:eJztPV2P47iRf0XQSxJA7bMky1.zlOxlkQO…` |

Note: a game code holds the finished position, including both fleets — loading
one shows the end of the game, not a replay. To watch a game from the start,
re-run the harness for that board and seed and load the code it prints, or
play the board against Muse yourself.

## Honest limitations

- **Mines.** The flagship steers a hex clear of known mines, but escorts walk
  through them, and the hunter never scans to find mines it has not seen.
  Minefield is 3–16 for a reason. A mine-aware escort would cost the chase.
- **Objectives.** Muse ignores the beacon, and any future objective that is
  not "kill the flagship". Beacon Hill still goes 14–6 because the flagship
  usually dies first — but on a board where the objective decides games
  before the flagship dies, Muse will lose games it could have won by
  contesting it.
- **Seeker drones.** Muse never launches seeker drones (The Dogleg's carrier
  load) — its launch step only handles missiles. On The Dogleg it wins by
  walking the canyon, not by scouting it. A drone-launching hunter would find
  the quarry sooner there.
- **The quarry is a guess.** The fog of war never names the flagship, so Muse
  hunts the biggest ship it can see. Against a fleet where the biggest ship
  is a decoy or a non-flagship brawler, it spends the game killing the wrong
  ship. (A decoy emitter makes a small ship look 3 segments bigger.)
- **Moving first.** The seat split (43 as seat 1, 56 as seat 2) says the
  hunter wants the second move. As player 1 it closes into a reply it cannot
  take back.
- **It does not learn.** No memory between games, no adaptation to an
  opponent that keeps doing the same thing. The same seed always plays the
  same game.
- **20 games a board is small.** The per-board numbers are suggestive, not
  precise: a 9–11 board could easily be 11–9 on the next 20 seeds. The
  20–0 and 3–16 boards are the ones to trust.

## Files

- `engine/ai-muse.js` — the personality, from scratch (~19 KB).
- `engine/ai.js` — minimal wiring: dispatches to `museMove` when
  `opts.personality === 'muse'` or the board pins `ai.vs_computer: muse`.
- `engine/index.js` — exports `museMove`.
- `ui/settings.js` — "Computer opponent" row in battle settings (Random /
  Muse, the hunter).
- `ui/play.js` — `aiStep()` passes the setting through as
  `{ personality: 'muse' }`.
- `tests/muse-ai.test.js` — 11 tests: legal actions across full games,
  fog-of-war fairness, determinism, finishing games, quarry focus, closing,
  home hunting, easy mode, not-its-turn, the Dogleg stall regression.
- `tools/muse-vs-opus.mjs` — the match harness.
- `docs/design/muse-ai.md` — this file.
- `docs/design/muse-ai-codes/` — one representative game code per board.
