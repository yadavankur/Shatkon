# Proposal: thrust per ship, and tow

Status: **waiting for Ankur's approval. Nothing here is built.** No game code or rules were changed for this
write-up. The test runs below used a throwaway copy of the repo that was then thrown away.

## Summary

- **Thrust per ship is a medium job, but most of it is small.** The rule itself lives in about 6 functions
  in 4 engine files (about 40 lines). The rest is knock-on work: the play screen's thrust bar, the Lab speed
  line, the battle log, the help text, and 8 tests that check the old pooled rule. One focused session can do
  it all, including the retests.
- **Proposed rule:** each engine gives **its own ship** 1 thrust a turn. Moving 1 hex costs 1 thrust per
  segment, the same price as today. Each ship banks its own unspent thrust, and can always bank enough for
  one hex. Ships with sprint drives or afterburners don't change.
- **The "sitting duck" fix goes away.** It isn't needed: every ship in the game already has an engine or
  its own drive. Instead, the Lab refuses a ship with nothing that moves it.
- **Rough check over 186 ships in 56 fleets:** no ship becomes stuck and none becomes absurdly fast. Most
  ships keep about the speed they have now. A few ships with 1 engine get slow (one board ship ends up at a
  hex every 3 turns).
- **Weight from exterior parts** (strip the shields and armour to go faster) works well as an optional extra
  setting. Every 6 exterior parts would weigh as much as 1 segment. 1 per 3 slows everything far too much.
- **Tow:** a ship with a working coupling hooks onto a friendly ship it is touching. The pair then moves
  together, and the tug pays thrust for both ships' segments. It's small to medium work (about 150 lines),
  with no new parts.

---

## Task 1: How complex is thrust per ship?

### What actually happens today

- At the start of a turn, every working engine in the fleet adds 1 thrust to **one shared pool**
  (`engine/turn.js:17-18`). Unspent thrust is banked, up to 2 turns of income.
- Moving any ship 1 hex costs 1 thrust per segment of that ship (`engine/actions.js:69`, `:114`).
- No ship may move further in a turn than *(fleet engines ÷ fleet segments, rounded down) + 1*. That is
  `max_above_average: 1` (`engine/actions.js:46-49`).
- `needs_average_of: 0` means the fleet never has to sit still to save up (`engine/turn.js:19`).
- Sprint drive and afterburner ships use their own fixed moves (5, or 8 then 1). They're left out of both
  the pool and the average (`engine/actions.js:26-45`).
- **Worth knowing:** shot-out engines already strand a ship today. A ship that was *built* with engines
  and has lost them all is "dead in the water" and can't move, even with thrust in the pool
  (`engine/state.js:58-66`, `engine/actions.js:62`). The pool only carries ships that were **built
  with no engine at all**. That's the sitting-duck fix, and no ship in the shipped game uses it
  (checked below). So the "shoot the engines" tactic exists already; per-ship thrust just makes it fairer.

### (a) Every place that depends on the pool

| File:line | What it does with the pool | Change needed |
|---|---|---|
| `rules/world_v0.4.yaml:81-95` | Section 4: the rule text, `needs_average_of`, `max_above_average`, `bank_turns`, examples | Rewrite the text. Retire `needs_average_of`. Keep the other two, now counted per ship |
| `rules/world_v0.4.yaml:176, 206-207, 215` | Engine note "adds 1 thrust to the fleet pool"; sprint drive and afterburner "outside the fleet's thrust pool" | Note text only |
| `engine/rules.js:55` | Reads the movement settings | Read any new setting (+1 line) |
| `engine/rules.js:200-210` | `shipStats`: thrust per ship (already per ship) | None |
| `engine/actions.js:24-25` | `thrustIncome`: fleet total of engines | Add a per-ship version. Keep the fleet total for the log and `min_move` |
| `engine/actions.js:46-49` | `fleetSegs`, `moveCap`: fleet average + 1 | Per ship: *own engines ÷ own weight, rounded down, + 1* |
| `engine/actions.js:61-69, 114` | `doMove`: refuses when the pool is short, then subtracts from it | Check and subtract the ship's own thrust |
| `engine/turn.js:17-19` | `startTurn`: fills the pool, applies the bank cap, sets `canMove` | Fill each ship's thrust. `canMove` is always true |
| `engine/turn.js:42` | `endTurn`: banks the pool | Bank each ship |
| `engine/turn.js:68-77, 93` | `min_move` switch (off), "spend 50% of thrust" | Works as is with the fleet total |
| `engine/query.js:14` | `reach`: how far a ship can go (pool ÷ segments, cap) | Use the ship's own thrust and cap. **The AI and the story script both get their moves from here, so they follow automatically** |
| `engine/query.js:205-206` | `shipStatus.moveLeft`, `costPerHex` | Same as above |
| `engine/state.js:58-66` | `deadInWater`; the comment says engineless designs are "carried by the fleet" | No engine and no own drive means no move. Update the comment |
| `engine/state.js:154` | Player record holds `thrust`, `thrustBank` | Ships get `thrust`, `thrustBank`. The player fields go, or become sums for display |
| `engine/script.js:415-419` | `free()`: story-flown ships get 999 pool thrust | Give the story-flown *ship* the thrust instead. **Care needed:** story orders move ships outside their owner's turn (see the check below) |
| `engine/view.js:55, 78` | What the screen sees: fleet thrust, income, segments, `moveCap` | Per-ship thrust and speed in each ship's entry |
| `engine/log.js:150, 174-185, 260, 320, 336` | Battle log: "thrust start → left", "thrust thrown away" | Sum over ships, or per ship |
| `engine/ai.js` | No thrust logic of its own. It uses `reach()` (`:82`, `:337`) | None. Retest only |
| `ui/play.js:1152-1182` | Itemised "+N thrust from your N engines, +banked" | Per selected ship |
| `ui/play.js:1306, 1377-1383, 1540-1548` | Fleet thrust bar in the top bar, "costs N per hex" | Move the bar to the selected ship's panel |
| `play.html:493` | Help: "Your fleet shares one pool of thrust" | Text |
| `ui/lab.js:361-362, 989` | Lab "Thrust / speed": already says "on its own" via `moveCap(e, 0)` on a one-ship fleet | Call the per-ship cap. Show "can't move" when there's no engine |
| `docs/index.html:317, 489, 513-514, 563, 1539, 1598` | Rules site text about the shared pool | Text |
| `campaign/chapters/ch5_bloom.yaml:14-16, 37` | Comments: "Fleet thrust 11 for 10 segments", Kestrel forced move "paid from the player's thrust" | Comments, and retest the timing |
| `campaign/CHECKS.md:278-279`, `campaign/MANIFEST.md:88` | Generated "fleet thrust N for M segments → cap" lines | Regenerate |
| `tests/engine.test.js:60-87, 268` | 3 tests built around the shared pool ("one ship can take more than its share") | Rewrite for per ship |
| `tests/maps-rework.test.js:114, 153-160` and 4 others | Set-ups that move a 1-engine, many-segment ship further than it could alone | Give the test ship more engines |

### (b) The proposed rule (minimal)

**Each ship moves on its own engines.**

1. At the start of your turn, each ship gets **1 thrust per working engine it carries**, plus what it banked.
   *(Existing number: engine `thrust: 1`.)*
2. Moving that ship 1 hex costs **1 thrust per segment** of the ship. *(Existing rule, unchanged.)*
3. A ship may move at most **(its engines ÷ its segments, rounded down) + 1** hexes in a turn.
   *(Existing `max_above_average: 1`, now counted per ship.)*
4. A ship banks up to **2 turns** of its own engine output, **but always at least enough for one hex**.
   *(Existing `bank_turns: 2`. The "at least one hex" floor is the only new rule, and it adds no new
   number.)* Without it, a big ship with too few engines could never save enough to move. Example:
   7 segments and 1 engine, bank cap 2, so it never reaches the 7 thrust one hex costs. With the floor, it
   crawls 1 hex every 7 turns, which is honest.
5. **No engine, no move.** A ship built with no engine and no own drive is a build problem: the Lab and
   `buildRules` refuse it, the same way they refuse a missing core. A ship whose engines are shot out is
   dead in the water, as today, and tow is the answer to that.
6. Sprint drive and afterburner don't change (5 hexes; 8 for 3 turns, then 1).
7. `needs_average_of` is retired. Per ship, it has nothing left to measure.

**What replaces the sitting-duck fix, and why this option.** I looked at three options.
- A core that gives a base 1 thrust: every crippled ship would still crawl. That weakens "shoot the
  engines" and makes tow pointless.
- A minimum crawl of 1 hex every other turn: that's a new number and a new counter on every ship.
- A build rule (every ship needs something that moves it), plus the bank floor in rule 4: this needs no new
  number and only about 3 lines of code. No shipped ship breaks, because all 186 already have an engine or
  their own drive.

**I recommend the build rule plus the bank floor.**

**Optional extra setting, off at first: exterior weight.** This is Ankur's "strip the shields to go
faster" idea. `movement.exterior_per_weight: 6` *(new number, proposal)* means every 6 exterior parts
weigh as much as 1 segment, both in the cost per hex and in the speed limit. Under that setting:
- A Kestrel with 9 plates and guns weighs 4 instead of 3.
- A bare 1-segment skiff loses nothing.

At 3 *(tried and rejected)*, most ships lose a third to half of their speed, and every campaign chapter
would need retiming. I'd switch it on only after the basic rule has been played for a while.

**Ideas that fit later and need no work now:**
- **The afterburner as a stronger engine** (for example, 3 thrust while it burns). It becomes a part field
  change once thrust is per ship.
- **More engines on small ships:** a 1-segment ship can already carry a core and 2 engines. Under this
  rule that gives 2 hexes a turn, or 3 with banked thrust, so no change is needed.
- **Mk I/II/III parts:** each level is just a different `thrust:` number on the part. The parked list
  already has "engine mk2 = 1.5 thrust".

### (c) Change list, size and risk

| File | Rough lines | Risk |
|---|---|---|
| `engine/actions.js` (per-ship income, weight, cap, `doMove`) | 20–30 | Low. A small, well-tested function |
| `engine/turn.js` (fill and bank each ship) | 8–12 | Low |
| `engine/query.js` (`reach`, `shipStatus`) | 4–6 | Low. The AI and the script inherit it |
| `engine/state.js` (ship fields, `deadInWater` comment) | 3–5 | Low |
| `engine/rules.js` (new setting, "needs a drive" build problem) | 4–6 | Low |
| `engine/script.js` (`free()` gives the story-flown ship thrust) | 5–15 | **Medium:** story ships move outside their owner's turn |
| `engine/view.js`, `engine/log.js` | 15–25 | Low. Display and log only |
| `ui/play.js`, `play.html` (thrust bar per selected ship) | 30–50 | Medium. A visible UI change on the phone layout |
| `ui/lab.js` | 5–10 | Low |
| `rules/world_v0.4.yaml`, `docs/index.html`, chapter comments, CHECKS/MANIFEST | 30–40 (text) | None |
| `tests/` (3 rewritten, about 5 set-ups given more engines, new tests for the bank floor and the build rule) | 60–90 | Low |
| **Total** | **about 190–290 lines in about 14 files**, of which about 40 lines are the rule itself | |

**What has to be retested:**
- **AI:** no AI code changes, but it now plays with different speeds. Rerun `tools/sim.mjs` and
  `tools/scenarios.mjs`.
- **Boards:** `tools/boards.mjs --games 40 --both`, plus small fixes where 1-engine ships became crawlers
  (Minefield's Dowser, Missile Alley's three 2-segment missile boats).
- **Campaign:** `campaign/tools/engine_check.mjs` for every chapter, and `browser_story.cjs` for ch1–ch4a.
  ch1, ch2 and ch5 lean on story-forced moves and rams.
- **Lab:** the speed line, plus the build refusal for a ship with no drive.
- **Battle log:** replays have to stay exact. In my rough patch, one replay test broke because of the new
  per-ship field, so the field needs saving properly.
- **The 2-device turn codes:** `tools/boards.mjs --codes`.

### (d) Rough check

**Speeds on paper.** I checked every ship in the stock game, all 10 boards (both sides), the 31 test fleets
in `rules/sim_fleets.yaml`, and all 5 campaign chapters (both sides): 186 ships in 56 fleets. Sprint drive
and afterburner ships are left out, because their speed doesn't change. "Old" is the fleet's shared average;
a single ship could take more of the pool. Speeds are in hexes per turn, averaged over turns.

| Ship (where) | Segments / engines / exterior | Old: pool average (max) | New (max) | New + exterior weight 6 |
|---|---|---|---|---|
| Blob A (stock) | 3 / 3 / 2 | 1.00 (2) | 1.00 (2) | 1.00 |
| Blob B (stock flagship) | 7 / 7 / 6 | 1.00 (2) | 1.00 (2) | 0.88 |
| Kestrel ch1–ch2 | 3 / 4 / 9 | 1.33 (2) | 1.33 (2) | 1.00 |
| Kestrel ch3–ch4a | 4 / 4 / 12 | 1.10 (2) | 1.00 (2) | 0.67 |
| Kestrel ch5 (grafted) | 6 / 7 / 18 | 1.10 (2) | 1.17 (2) | 0.78 |
| Tern ch3 | 2 / 3 / 6 | 1.10 (2) | 1.50 (2) | 1.00 |
| Seed ch1, Twin ch3 | 2/2/6, 6/6/18 | 1.00 (2) | 1.00 (2) | 0.67 |
| Bloom ch5 | 7 / 6 / 21 | 0.86 (1) | 0.86 (1) | 0.60 |
| Leviathan (Pawn Storm), dreadnought (sim) — fastest | 7 / 12 / 18-19 | 1.71 (2) | 1.71 (2) | 1.20 |
| Dowser (Minefield) — slowest | 3 / 1 / 4 | 1.18 (2) | **0.33 (1)** | 0.33 |
| Quiver, Sling, Sheaf (Missile Alley) | 2 / 1 / 3 | 0.85 (1) | **0.50 (1)** | 0.50 |
| 3-segment, 2-engine snipers and bishops (several boards) | 3 / 2 / 2 | 0.70–1.00 | 0.67 (1) | 0.67 |

- **Stuck ships: none.** Every ship has an engine or its own drive. Dowser needs the bank floor only when
  exterior weight is on.
- **Absurdly fast ships: none.** The fastest is 1.71 hexes a turn, the same as today. Stripped 1-segment
  2-engine ships would do 2 (3 with banked thrust), still below a sprint drive's 5.
- **Slowed down:** ships that relied on the fleet's spare engines, mostly 1-engine missile boats and
  3-segment 2-engine snipers.

**Computer-v-computer games, with a throwaway patch** (about 25 lines in a copy of the repo, behind a switch):

| Run | Old (pool) | New per ship | New + exterior weight 6 | New + exterior weight 3 |
|---|---|---|---|---|
| Stock game, 100 games, normal v normal: rounds / hexes per side / P1 wins | 9.4 / 12.3 / 46% | 8.0 / 11.0 / 52% | 9.6 / 11.3 / 68% | 9.0 / 11.1 / 70% |
| Boards, 40 games each: player 1 wins out of 40, biggest changes | — | Minefield 13→8, Beacon Hill 19→30, Missile Alley 9→3 | Missile Alley 9→23, Gambit 26→14 | Missile Alley 9→26, King's Guard 15→27, Cat & Mouse draws 5→10 |
| Engine tests (171), with per ship switched on | 171 pass | 163 pass, 8 fail (all set up around the pool, as expected) | | |

- The basic rule moves the game very little. The stock game is about as even as before, and most boards
  stay inside the noise of 40 games.
- Missile Alley, Minefield and Beacon Hill shift because their 1-engine ships slow down. Each needs one
  small hull tweak.
- With exterior weight, the first mover wins more (68–70% in the stock game). Slower ships favour
  whoever closes first, which is another reason to keep it off at first.
- Campaign (`engine_check`, 10 games a chapter): every chapter still ends the way it should. **However, ch1
  went from about 6 to 11 rounds, ch2 from 8 to 13, and ch4a from 6.4 to 8.8**, mostly because the story's forced moves and rams stopped firing in my rough
  patch. That's a gap in my throwaway patch (story-flown ships move on the other player's turn), not in the
  rule. It's exactly the `engine/script.js` risk listed above, and the real change has to handle it. In ch4a the
  slower player ships also reach the husks later, so the gift beat comes 2 rounds later. ch3 went from
  8.8 to 8.4 rounds; ch5 didn't change.

### (e) Verdict

**Medium overall, small at the core.** The rule itself is about 40 lines in four engine files. The computer
player and the story script get their moves through one function, `reach()`, so they follow
automatically. The work is in the knock-on changes:
- the thrust bar on the play screen,
- the Lab line and battle log,
- 8 pool-based tests,
- story-flown ships moving on the other side's turn,
- a hull tweak on 2–3 boards.

Total: about 200–300 lines. **One focused session can do it**, including tests and the board and campaign
reruns, as long as exterior weight stays a separate later switch. It doesn't need a two-pass rewrite.

---

## Task 2: Tow (short)

**What coupling does now:** it's purely structural. Every segment after the first needs one, and it takes
up a bay (`engine/rules.js:125, 142`). It has no effect in play. ch4a already fakes a tow with story orders
(`ch4a_ashfall.yaml:111-119`: "the rig has Tern in tow").

**Proposal:**

| | |
|---|---|
| **Hook up** | A new **Tow** order, like Dock. The tug must have a working coupling and touch the other ship. Both ships must be yours. It costs 1 command point (the same as Dock); letting go is free. No new part: a ship with 2 or more segments already carries couplings. A 1-segment ship can't tow, which is the price of being small |
| **Moving** | The tug moves and the towed ship follows on the same path, keeping its place beside it. Both footprints must be clear. The towed ship can't move on its own while hooked |
| **Cost** | Per hex, the tug pays thrust for **both** ships' segments. Its speed limit is *(tug engines ÷ combined segments, rounded down) + 1*. For example, a Kestrel (4 engines, 3 segments) towing a 2-segment Tern pays 5 thrust a hex out of 4 a turn: about 4 hexes every 5 turns, never more than 1 in a turn |
| **Limits** | One tow per tug, and no chains. The tow breaks if either ship dies or the tug's last working coupling is shot out. Sprint drive and afterburner ships can't tow (they have no thrust to spend). Towing enemy ships (boarding, prizes) is parked for later |
| **With per-ship thrust** | Tow only makes sense once thrust is per ship: it's how a fleet rescues a ship whose engines were shot out. Under today's pool it would still work, but the pool already hides who pays |
| **Size** | Small to medium, about 150 lines: engine order and joint move about 70 (Dock's join code and `reach()` can be reused), screen button and tow line about 40, tests about 40. The AI ignores tow at first. ch4a could later switch its scripted tow to the real one |
