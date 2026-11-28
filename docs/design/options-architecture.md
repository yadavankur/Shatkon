# Options: what we have, what's wrong, and a simpler shape

> **Update 28 Nov, evening.** Steps 1 and 2 below are done (build #87).
> - The sheets store only rows the player changed. An untouched row shows and uses the board file's own value. Old saves are cleaned automatically, because a stored value equal to the default counts as untouched.
> - Tuning rows sit in a collapsed "Tuning" section. Players see: computer opponent and friendly fire (battle); time to act, time to watch and tick limit (rapid); computer style (Frontier, three players); everything on the Lab's own sheet.
> - Fixing step 1 exposed two board switches the engine never read, because the boards write `true` where the engine expected `'on'`. Frontier's `economy` had been kept on only by the sheet's untouched row. Its `interceptHurts` (24 Nov: an intercepted missile still stuns the ship that stopped it) was never on at all. The engine now reads both, so Frontier and the three-player boards play that rule for the first time.
> - Steps 3 and 4 wait. Switches (`docs/design/switches.md`) now cover the on/off rules that differ by kind of game.

Claude (gamedev chat), 28 Nov 2026. Ankur: "Think again about the entire architecture of options; we've got too many now." This is a review and a proposal only. Nothing has been built from it yet.

## What exists today

Five places can set the same game:

| Layer | Where | What's in it |
|---|---|---|
| 1. World file | `rules/world_v0.4.yaml` (525 lines) | Every rule number for turn-based play, the AI personalities, and (new today) `modes:`, the per-mode master defaults (castle). |
| 2. Engine constants | `RAPID_DEFAULTS` in `engine/rapid.js` (about 30 keys), `ECON_DEFAULTS` in `engine/economy.js` (21), experiments in `engine/experiments.js` | Every rapid, economy and experiment default. These are not in the world file, so the "everything in hand-editable text files" rule only holds for turn-based play. |
| 3. Board files | `board.rules` (world-file overrides by path), `map:` (`castle`), `rapid:` (`line`, `economy`, `interceptHurts`, `econ`, `ring`, `bounty`, `experiments`, `exp`, `cpuExp`, `startRekon`) | Per-board changes. Nine of the ten boards use `board.rules` only to pin the computer's personality. |
| 4. Battle-settings sheets | `ui/settings.js`, five localStorage stores | 42 rows in all: battle 3, rapid 16, economy 11, three-player 3, Experiments 7 + 2. |
| 5. Elsewhere | Landing page Settings (labels, sound), `?guides=off`, URL `?level=`, story chapter files, tools' `--set` | Display and testing switches. |

What a player actually sees before a battle:

| Game | Rows on the sheet |
|---|---|
| The ten boards | 3 |
| Rapid Opus | 16 |
| Frontier | 27 (economy 11 + rapid 16) |
| Three players | 27 |
| Experiments | 33 |

## What's wrong

1. **Sheets silently beat board files.** For every key that has a sheet row, the sheet's value always wins, even when the player never touched it: an unset row returns its default, and that default overrides the board. A board's `rapid: line:` is ignored once the line slider exists. The Experiments boards needed a workaround (`seedExpFromBoard` writes the board's values into the player's saved settings) to get round it. A board designer can't trust their own file.
2. **Defaults are written twice.** Each sheet row repeats the engine's default (`def:`). They match today, but nothing keeps them matched.
3. **Two default systems.** Turn-based rules live in the world file. Rapid and economy rules live in JavaScript. Tuning Frontier means editing code, which is what the text rule files were meant to avoid.
4. **Player choices and tuning knobs sit side by side.** Frontier's 27 rows mix "how long do I get to act?" (a player choice) with "turret upkeep every 3 ticks" (a balance number being tuned). Most players should never see the second kind.
5. **Settings leak between boards.** One store per sheet, so a turret price chosen on Frontier carries over to the three-player boards, and a line set on one Experiments board can carry over to the next.
6. **Some rows are already decided.** Turn order "swap" was dropped (fixed order is locked), yet the world file still says `first_player: alternate`; the sheet's "Fixed" quietly overrides it in play, while tools and sims that read only the world file still alternate. "Economy off" on the Frontier board is just Rapid Opus. The rows remain.
7. **"Random" isn't always random.** Most boards pin the computer's personality in `board.rules`, so the opponent row's "Random" quietly means "whatever this board says".

## Proposal: one list of options, four layers, three audiences

**One registry.** A single text file (for example `rules/options.yaml`) lists every option once, with:
- its key and label;
- the kinds of game it applies to (skirmish, rapid, frontier, three-player, story, experiments);
- its choices, each with the sentence that explains it;
- its default;
- its audience: **player**, **tuning** or **retired**.

The engine reads its defaults from here, and the sheets build their rows from here. That removes the duplicate `def:` values and the JavaScript-only defaults. `RAPID_DEFAULTS` and `ECON_DEFAULTS` become this file.

**Four layers with an explicit order.** Each one only changes what it names:
1. The registry default.
2. The mode default (the world file's `modes:`, as castle already does).
3. The board file.
4. The player's choice, but only for rows the player actually changed. The sheet stores changes, not every row, and shows a "Reset" button.

Story scripts and tools' `--set` stay on top for their own uses.

**Three audiences:**
- **Player** (on the sheet, at most about five rows per kind of game): see the table below.
- **Tuning** (behind a collapsed "Tuning" section on the same sheet, or on the Workshop page): every balance number. Ankur can still jump into a board and tweak settings before launching, which he asked for, without every player seeing 27 rows.
- **Retired:** removed from the sheet. The engine keeps the value as a fixed rule.

### First pass at sorting today's 42 rows

| Row | Today on | Suggest |
|---|---|---|
| Computer opponent (Random / Muse) | battle | player |
| Friendly fire warn / just fire | battle | player (could move to the landing page's global Settings: it's a comfort choice, not a rule) |
| Turn order fixed / swap | battle | retired (fixed is locked) |
| Time to act | rapid | player |
| Time to watch | rapid | player |
| Tick limit | rapid | player |
| Auto-fire best / nearest | rapid | tuning |
| Opening clock, opening ends, opening moves | rapid | tuning |
| Missiles sighted / blind | rapid | tuning |
| The line, crossing frees you, scans | rapid | tuning |
| Shooting down missiles, close-in debris, eyes past the line, attack run, formation | rapid | tuning |
| Computer plays (rush / boom / turtle / random) | economy | player |
| Economy on / off | economy | retired (pick Frontier or Rapid Opus instead) |
| Income cap, prices (heatmap, turret, upgrade), turret range, turret uses a laser, upkeep, idle penalty, earn at home | economy | tuning |
| Computer 2 plays | three | player |
| Centre ring, flagship bounty | three | tuning |
| Who plays, the line | Experiments | player (the Experiments page is a test bench) |
| Each experiment's switch | Experiments | player |

Result: the ten boards show 3 rows, down to 2 if friendly fire moves to Settings. Rapid Opus shows 3 rows, Frontier 4, three players 4. Experiments stays as it is, because it is the test bench. Tuning is still one tap away for anyone who opens it.

## Order of work, if agreed

1. **Fix the precedence bug first.** Sheets store only changed rows, and the board file beats an untouched row. This is small, can ship alone, and stops boards being overridden.
2. **Add the audience tag** to every sheet row and fold tuning rows into a collapsed "Tuning" section. This is a screen change only.
3. **Move the defaults into the registry file** (out of `RAPID_DEFAULTS`, `ECON_DEFAULTS` and the sheet `def:`s), with a test that every option has exactly one default.
4. **Remove the retired rows**, and decide where friendly fire lives.

Each step is its own PR, and each keeps the golden games replaying.

## Questions for Ankur

- Is the player / tuning / retired split right? Anything you want visible to players that is marked tuning here, or the other way round?
- Should Tuning sit on the same sheet (collapsed) or only on a Workshop page?
- Should friendly fire move to the global Settings?

— Claude (gamedev chat)
