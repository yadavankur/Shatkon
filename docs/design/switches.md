# Switches: one list, three levels

Ankur, 28 Nov 2026. While writing tutorial mode, it wasn't clear where rules like "chapter 1 has no Scan" should live. Reviewing PR #85 showed why: with nowhere to put them, chapter-specific rules ended up in the screen code, keyed on the chapter's name (`isCh1()`, `WIN_NOW_CHAPTERS = { ch1, ch2 }`). The engine already had a way for a chapter to lock actions, but nothing listed what could be switched, so it wasn't found.

## The idea

A switch is an on/off (or pick-one) rule that differs between kinds of game. Every switch lives in one list with its default. Each level below changes only what it names, and **the last level that names a switch wins**:

| Level | Where | Example |
|---|---|---|
| 1. Master list | world file `switches:` | `scan_button: true` |
| 2. Kind of game | world file `modes:` (skirmish, rapid, story, tutorial, experiments) | `tutorial: { end_turn_nag: false, win_now: true }` |
| 3. Board or chapter | a board file's top-level `switches:`, or a chapter's `switches:` inside `chapter:` | ch1: `switches: { win_now: true }` |

A switch has to be in the master list before anything can use it. A name that isn't there, or a value of the wrong kind, is reported as a problem by the rules loader and by `campaign/tools/check.mjs`. That catches typos.

**Rule numbers aren't switches.** Laser damage, prices and ranges stay in the world file's sections and in boards' `rules:` path overrides. Chapters keep `world_overrides`. Locks were left out on purpose: almost nothing would ever be locked.

## The switches today

| Switch | Default | What it does | Changed by |
|---|---|---|---|
| `castle` | false | Free castle before your first action (`docs/design/castle.md`) | skirmish, rapid: true |
| `turn_order` | alternate | Who moves first each round: `alternate` (back-to-back turns possible) or `fixed` | skirmish, story, tutorial: fixed |
| `scan_button` | true | The player's Scan button is offered | ch1: false |
| `start_labels` | true | "YOUR START / ENEMY START" on the home zones | story, tutorial: false |
| `ship_codes` | true | Ship codes (1a, 2b) next to names on the ship card | story, tutorial: false |
| `end_turn_nag` | true | "End turn?" with points left, and the empty-turn pop-up | tutorial: false; ch1: false |
| `win_now` | false | Offer "Take the win" once you can't lose | tutorial: true; ch1, ch2: true |
| `hud_coach` | false | Extra HUD captions that teach the turn order and laser reach, and hold back leftover-laser nags until the lesson has | ch1: true |

Ankur, 28 Nov: back-to-back turns are confusing, so story and tutorial use fixed order, as the 1v1 games already did through the battle setting. The world file's old `turns.first_player` is replaced by `turn_order`.

## Using it

- **Engine and screen:** `E.sw(game, 'scan_button')` (it also takes the rules). The screen can also read `view.switches`. Never write `if chapter is X` again.
- **A tutorial lesson:** `mode: tutorial` inside `chapter:`. The lesson gets the tutorial defaults and can still set its own `switches:`.
- **A new switch:** add it to the master list with a one-line comment, then read it with `sw()`.

## What changed with fixed turn order

- **Story chapters** still win 20 of 20 in `engine_check` (ch1b now takes 9 rounds, not 10; ch2 takes 10.6, not 8.6). All story-chapter and guide checks pass. Guide check 8 now puts Kestrel in sight of the Seed itself, because with the new order the Seed can be out of view at that beat.
- **Board sims** (`tools/boards.mjs --both --games 20`, player 1's fleet wins of 40, with castling) now match what players actually got:

  | Board | Wins |
  |---|---|
  | First Light | 23 |
  | The Minefield | 18 |
  | Cat and Mouse | 16 |
  | The Dogleg | 17 |
  | King's Guard | 20 |
  | **Pawn Storm** | **2** |
  | Beacon Hill | 17 |
  | Missile Alley | 11 |
  | Fog Bank | 13 |
  | The Gambit | 24 |

  Pawn Storm is far outside the 10–30 range. It was already that lopsided in real 1v1 play, where fixed order was the battle-setting default; only the sims hadn't shown it. Handed to the maps bot.
- **Tests** that are about back-to-back turns (beacon contesting, the old first-player test) now ask for `alternate` explicitly. The `first_fixed` variant now sets `modes.skirmish.turn_order`.

## Code

`engine/switches.js` (`sw`, `allSwitches`, `modeOf`, `switchProblems`); the rules loader (`engine/rules.js`, `engine/chapter.js`); castling now reads its switch; `view.switches`. On screen: the start labels (`ui/board.js`), and win-now, the Scan button, the end-turn nag and ship codes (`ui/play.js`).

— Claude (gamedev chat)
