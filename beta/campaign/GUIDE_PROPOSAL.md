# Proposal: on-map move guides ("move here" overlay)

**To:** the engine / UI developer (`engine/`, `ui/`)
**From:** campaign level design (`campaign/`, branch `campaign-v2`)
**Status:** proposal. The current engine safely ignores the data, so the chapter files can carry it today (see §8). The guide data in ch1, ch2 and ch4A lands in the next campaign-v2 commit.

## 1. Why

At certain points the campaign needs to teach the player a move. Examples:
- ch1: "close on the crippled Seed and finish it";
- ch2: "finish the Seed that's dead in the water";
- ch4A: "bring Tern alongside Kestrel and Graft them".

Today the only tool is `objective:`, a line of text in a banner. The user doesn't want a banner. They want the game to show the move **on the map**:
- a glowing destination hex;
- a ghost path to it;
- a reticle on the target;
- a short label pinned to the map.

Level design can't (and mustn't) make the move for the player. We can only *suggest* it, as data in the chapter file. This doc defines that data and what the engine and UI should do with it.

## 2. Where it lives in a chapter file

A guide is an optional `guide:` field on a script entry (a beat), next to `when` and `do`. It **starts when that beat fires**, at the same moment as the beat's `do` actions.

```yaml
- id: crippled                       # any script entry
  when: { all: [ ram_wren, ram_kite ] }
  do:
    - objective: "Close to 4 hexes and fire on the Seed."   # fallback, see §7
  guide:
    ship: kestrel                    # required: a ship the player commands
    clear: { destroyed: seed }       # optional: drop the whole guide when this holds
    steps:                           # required: an ordered list, one step shown at a time
      - label: "Close to 4 hexes"
        move_to: { near: seed, within: 4 }
        done: reached
      - label: "Fire on the Seed"
        fire_at: seed
        done: { destroyed: seed }
```

### 2.1 Guide fields

| field | required | meaning |
|---|---|---|
| `ship` | yes | The player ship the guide is for (by chapter ship id). It must be a ship the player commands, not `helm: script`. |
| `steps` | yes | A non-empty ordered list of steps (§2.2). |
| `clear` | no | A normal script trigger (same grammar as `when`). When it holds, the whole guide is removed whatever step it's on. |
| `id` | no | Defaults to the beat id. Only used in events and logs. |

### 2.2 Step fields

Each step has **at least one** of a movement part and a target part. It may have one of each, e.g. "move here, then fire at that".

| field | kind | meaning |
|---|---|---|
| `label` | text, required | Shown on the map. **24 characters at most.** An imperative, e.g. "Move here", "Close to 4 hexes", "Fire on the Seed", "Graft". |
| `move_to` | movement | Where to go. Any one of these forms:<br>`[q, r]`: one hex.<br>`[[q, r], [q, r], ...]`: any of these hexes.<br>`{ zone: <map zone id> }`: any hex of a map zone.<br>`{ near: <ship id>, within: n }`: any hex whose placement leaves the guided ship within `n` hexes of the named ship (engine `gap`, every segment counted; `within: 1` means touching). |
| `path` | movement, optional | A list of waypoint hexes for the ghost path. Without it, the UI draws the engine's own shortest legal route (`reach()`). |
| `fire_at` | target | A ship id: draw a weapon reticle on it. |
| `launch_at` | target | A ship id, or an `[q, r]` hex: a launch reticle. |
| `graft` / `dock` | target | A ship id: draw a join marker between the guided ship and this ship. |
| `done` | trigger, optional | When the step is finished (§3). |
| `timeout` | optional | `{ rounds: n }`: skip the step after `n` full rounds even if it isn't done. This stops a guide from getting stuck. |

Hexes are axial `[q, r]`, as everywhere else in the chapter files. A multi-hex ship "is on" a hex when its **anchor** (the `at` of segment 0, i.e. `ship.pos`) is there. A ship "is in" a zone when **any** of its cells is in the zone.

## 3. When a step and a guide clear

`done` is either a **reserved word** or a **script trigger**. Script triggers use exactly the grammar and evaluator the script already uses: `round`, `after`, beat ids, `destroyed`, `in_zone`, `distance_below`, `fired_at`, `grafted`, `docked`, `all` / `any` / `not`, and the rest.

| `done` | holds when |
|---|---|
| `reached` | The guided ship meets the step's `move_to`: the anchor is on one of the listed hexes, any cell is in the zone, or it's within `n` of the `near` ship. |
| `fired` | The guided ship has fired a beam at the `fire_at` target since the step began. A `fire` event by that ship whose beam reaches the target counts, hit or not. |
| `launched` | The guided ship has launched at the `launch_at` target or hex since the step began. |
| `grafted` / `docked` | The guided ship is grafted or docked with the `graft` / `dock` ship. |
| any trigger | That trigger holds, e.g. `{ destroyed: seed }`, `{ round: 9 }`, `{ after: { beat: gift, rounds: 2 } }`, `tow`. |

**Default `done`** when the field is left out: the target part's word (`fired`, `launched`, `grafted`, `docked`), or else `reached`.

### Lifecycle

1. **Start:** the beat with `guide:` fires. Step 1 becomes active. One guide per guided ship at a time: a new guide for the same ship replaces the old one.
2. **Evaluation:** check `done`, `timeout` and `clear` at the same points the script checks its triggers (turn start, and after every action and event batch). The overlay then always matches the board after each move or shot.
3. **Advance:** when the active step's `done` holds, go to the next step. Steps only move forward. If the next step's `done` already holds, skip it in the same pass. For example, Kestrel may already be within 4 hexes when ch1's `crippled` fires, so step 1 is skipped at once and the reticle shows.
4. **End:** the guide is removed in any of these cases:
   - the last step is done;
   - `clear` holds;
   - a step times out on the last step;
   - the guided ship is destroyed or removed;
   - the chapter ends (win or lose).

   A step whose `fire_at` / `launch_at` / `graft` / `dock` / `near` ship is destroyed or removed counts as **done**.
5. **Engine events** (proposed, for the UI and logs):
   - `{t:'guide', id, ship, step, steps}` at start and on each advance;
   - `{t:'guide_clear', id, ship, why}` at the end (`why` is one of `done`, `clear`, `timeout`, `ship_lost`, `replaced`, `chapter_end`).

   Send them only to the guided ship's player.

## 4. How it renders (no banner)

Draw it on the map layer, above terrain and ships and below the UI chrome. It shows only on the guided player's own screen, and during their own turn it's drawn at full strength. During the enemy turn it's dimmed to about 40% (still visible so the plan reads, but plainly not live).

| element | when | look |
|---|---|---|
| **Destination glow** | the step has `move_to` | The legal destination hexes (§5) get a soft pulsing outline in the guide colour. The **best** one (the legal hex nearest the ship along its route) is filled and brighter. A multi-hex ship also gets a faint ghost of its footprint at that anchor. |
| **Ghost path** | the step has `move_to` | A route from the guided ship to the best hex: solid for the part reachable **this turn** (the engine's `reach()` with the current thrust and command points), dotted beyond it. A small tick marks where this turn's move ends. If `path:` is given, the route goes through those waypoints in order. |
| **Target reticle** | `fire_at` / `launch_at` | A ring and crosshair on the target's nearest **visible** cell. Solid when the target is in weapon range and line of fire from the guided ship's current spot; hollow or dashed when it isn't yet. |
| **Join marker** | `graft` / `dock` | A short bracket between the facing cells of the two ships. |
| **Label** | always | The `label` in a small pill pinned on the map, placed by the first rule that applies:<br>1. next to the best destination hex;<br>2. else next to the reticle;<br>3. else next to the guided ship.<br>Text stays the same size on screen at any zoom and moves aside to avoid ships and other labels. A multi-step guide gets a tiny step count ("1/2"). |

Use one guide colour (e.g. the UI accent or a soft cyan) that can't be mistaken for the red of enemy fire or the yellow of a selection. No modal and no banner, and the guide never takes the player's input away.

## 5. Blocked or unreachable destinations

Resolve the destination again on every evaluation (§3). It comes from the player's view only (§6).

1. **Candidates:** the hexes the `move_to` names (one hex, a list, the zone's cells, or every hex that puts the ship within `n` of the `near` ship).
2. **Legal:** keep the candidates where the guided ship's whole footprint can sit with its anchor there:
   - on the board;
   - not asteroid or other blocking terrain;
   - not occupied by a ship the player can see.
3. **None legal (blocked):** use the nearest legal hexes **toward** the original. Search outward ring by ring from the original candidates (hex distance) and take the first ring that has legal hexes. Break ties by the shortest route from the guided ship, then by the lower `q`, then the lower `r`, so the choice is deterministic. Draw the original hex with a faint "x" outline so the player sees what was meant.
4. **Legal but beyond this turn's move:** still glow the destination. Mark this turn's stop on the ghost path: the reachable hex that ends nearest the destination, by route length to it.
5. **No route at all** (walled off, or no thrust left): glow the reachable hex nearest the destination. If the ship can't move at all (no thrust, or `lock`ed), show the label and the reticle only, with no destination glow.
6. **Never** move the ship or spend anything for the player. The overlay is advice only, and the player's command still goes through the normal move validation.

## 6. Fog of war: the overlay never leaks

All guide geometry comes from **the guided player's view**, never the true state:
- the ships that player currently sees (`visibleTo`, plus script `reveal`s);
- the last-known contact ghosts the UI already shows;
- the terrain.

Rules:
- **Reticle and `near`:** if the target ship is currently visible, use its real cells. If it's not visible but the UI shows a last-known ghost, anchor to the ghost and draw the reticle **dashed**. If the player has never seen it, draw **no** reticle and **no** `near` destination, and pin the label to the guided ship.
- **Occupancy:** in §5, block a hex only for ships the player can see. A hidden ship must not make a hex look blocked, because that would give its position away. If the move then fails on the hidden ship, that's normal engine behaviour.
- **Mines, cloaked or unseen objects:** never count them, never mark them.
- **Events:** send `guide` / `guide_clear` only to the guided player, and never put coordinates in them that the player can't see.
- **Done words** (`reached` / `fired` …) are about the player's own ship, so they leak nothing. Script triggers in `done` / `clear` are evaluated by the script as usual, and only their *effect* (the step advancing) shows.

## 7. Objective text as a fallback

Until the overlay ships, the chapter files keep an `objective:` line on each beat that has a guide. It's a single plain string with the same instruction ("Close to 4 hexes and fire on the Seed."), so today's banner still teaches the move. ui/campaign.js stores `e.text` and play.js renders a string, so objectives stay strings.

Once the overlay is in:
- When a beat that has a `guide` also emits an `objective`, the UI **doesn't show that objective as a banner**. The guide replaces it. It can stay in a log or journal if one exists.
- Objectives from beats without a guide aren't instructions. Treat them as chapter status: show them however the UI shows status, or not at all. Level design will cut them to a minimum.
- When the overlay is confirmed, tell us and we'll remove the duplicate `objective:` lines from guided beats.

## 8. Compatibility with the current engine (checked)

- The script runner (`engine/script.js`) reads only an entry's `when` and `do`, so the extra entry field `guide` is ignored. No `script_unknown` or `script_failed` event comes from it. `guide` must **not** be an action inside `do`: an unknown action emits `script_unknown`.
- `campaign/tools/check.mjs` will validate guides against this format (it lands with the ch1 rework commit that adds the guide data):
  - field names;
  - a player-commanded `ship`;
  - `label` of 24 characters or fewer;
  - legal `move_to` forms, with listed hexes on the map and open;
  - known ship ids;
  - `done` / `clear` triggers go through the same trigger lint as `when`.

## 9. Suggested engine shape (non-binding)

- `script.js`: when an entry with `guide` fires, push `{ id, ship, steps, i: 0, from: round }` onto `sc.guides`, replacing any guide for the same ship.
  - Evaluate guides at the end of the existing trigger pass. `done` triggers reuse `cond()`; the reserved words are small helpers; `fired` / `launched` look at this step's events.
  - Emit `guide` and `guide_clear`.
- A pure function `guideView(state, player)` returns what the UI draws. That makes it testable without a DOM:

  ```js
  { ship, step, of, label, dest: [[q,r]...], best: [q,r]|null, blockedFrom: [[q,r]...],
    route: [[q,r]...], turnEnd: [q,r]|null, reticle: { at:[q,r], kind:'fire'|'launch', dashed:bool }|null,
    join: { with, cells }|null, anchor: [q,r] }
  ```
- `ui/`: one overlay layer that draws `guideView`, and the banner suppression from §7.

## 10. Mobile and tap behaviour

- **Tap the glowing (best or any legal) destination hex:** select the guided ship and preview the move to that hex, exactly as if the player had picked it by hand. The usual confirm still applies; nothing moves on the tap alone.
- **Tap the reticle:** select the guided ship and enter fire (or launch) mode with that target pre-selected. The usual confirm applies.
- **Tap the label:** select the guided ship and centre the camera on the step. A small "×" on the label hides the guide until the next step or the next guide. It isn't a permanent opt-out; a settings toggle can be that.
- Only the glow, the reticle and the label take pointer events. Every other hex works as normal, so the overlay never blocks play.
- Touch targets are at least 44 × 44 CSS px, whatever the map zoom. Labels keep their on-screen size when pinching. If a label would cover the HUD or the selected ship's card, it collapses to a chip with an arrow pointing to the step.
- On first show, pan the camera so the guided ship and the destination are both in view (if they fit). Don't pan again on every re-evaluation.

## 11. Acceptance tests (run against ch1, plus ch4A)

The harness can be `campaign/tools/engine_check.mjs`. It runs chapters with a stand-in player; use `--trace <seed>` to see each round. Or write unit tests on `guideView`.

1. **Loads clean:** all chapters build, and 40 simulated games of each emit **no** `script_unknown` or `script_failed` events: `node campaign/tools/engine_check.mjs --engine . --games 40`. (Already checked against the current engine: a ch1 file carrying an entry-level `guide` ran 40 games with no such events.)
2. **Inactive before its beat:** in ch1 before `crippled` fires, `guideView(state, 0)` is `null`.
3. **Starts on the beat:** play ch1 until `crippled` fires. There's exactly one guide, for `kestrel`, on step 1/2 with label "Close to 4 hexes". `dest` is exactly the open hexes that put Kestrel within 4 hexes of the Seed's cells. `best` is the one with the shortest route from Kestrel.
4. **Ghost path:** `route` starts at Kestrel's position and ends at `best`. `turnEnd` is the furthest hex on the route that Kestrel can reach this turn (`reach()`).
5. **Skips an already-done step:** set Kestrel within 4 hexes of the Seed before `crippled` fires. The guide opens on step 2/2 (reticle on the Seed, label "Fire on the Seed").
6. **Advances on `reached`:** move Kestrel within 4. In the same evaluation, step 2/2 shows with a solid reticle on the Seed.
7. **Clears:** destroy the Seed. `guide_clear` with `why: clear` (or `done`) is emitted, `guideView` is `null`, and nothing draws on the win screen.
8. **Blocked hex:** a test chapter (or a ch1 state with the guide rewritten) has `move_to: [q, r]` on a hex occupied by a visible ship. `best` is the nearest legal hex toward it, `blockedFrom` holds the original, and the result is stable from run to run.
9. **Fog:** in ch1 at round 1, before contact, give Kestrel a test guide with `fire_at: seed` and `move_to: { near: seed, within: 4 }` while the Seed isn't visible to seat 0. `reticle` and `dest` are empty and `anchor` is Kestrel's hex. Also: no coordinate of a Seed cell appears anywhere in `guideView` or in the `guide` events.
10. **Fallback banner:** with the overlay feature off, the `crippled` objective string shows as today. With it on, it doesn't show as a banner, and the overlay does.
11. **Mobile:** in a 390 × 844 viewport (e.g. Playwright), tapping the best hex opens the normal move preview to it; tapping the reticle opens fire mode on the Seed; tapping any other hex behaves as without the overlay. Nothing moves or fires without the normal confirm.
12. **ch4A graft:**
    - When `gift` fires there's a guide for `tern`: step 1 "Bring Tern here" (`near: kestrel, within: 1`), then step 2 "Graft" (join marker to Kestrel).
    - Grafting by hand ends it with `done`.
    - If the `tow` fallback fires first, `clear` removes it (`why: clear`).
13. **Replacement:** a second guide for the same ship replaces the first, with `guide_clear why: replaced`.

## 12. Worked examples

### 12.1 ch1: finishing the crippled Seed

The two escorts have rammed both ends of the Seed. The `crippled` beat switches off its engines, laser and launcher and sets its AI to hold: a sitting duck. The guide brings Kestrel in to finish it.

```yaml
    - id: crippled
      when: { all: [ ram_wren, ram_kite ] }
      do:
        - unprotect: seed
        - disable: { ship: seed, parts: [engine, laser, launcher] }
        - ai: { ship: seed, profile: hulk }
        - objective: "It's dead in the water. Close to 4 hexes and fire on the Seed."   # fallback (§7)
      guide:
        ship: kestrel
        clear: { destroyed: seed }
        steps:
          - label: "Close to 4 hexes"          # lasers do 3 hits at 4 hexes, 2 at 5-8
            move_to: { near: seed, within: 4 }
            done: reached
          - label: "Fire on the Seed"
            fire_at: seed
            done: { destroyed: seed }
            timeout: { rounds: 4 }               # the chapter's finish_fallback acts after 4 rounds too
```

### 12.2 ch4A: the graft

The outpost's prototype rig has been found (`gift`). The player must bring Tern alongside Kestrel and give the Graft order. The `tow` fallback (2 rounds later) takes over if they don't, and that clears the guide.

```yaml
    - id: gift
      when:
        any:
          - all: [ { destroyed: husk_1 }, { destroyed: husk_2 }, { destroyed: husk_3 } ]
          - { in_zone: { side: player, zone: outpost } }
          - husks_dark
      do:
        # ... husks go dark, scene ch4a_graft_found, unlock: graft ...
        - objective: "Bring Tern alongside Kestrel and Graft them"   # fallback (§7)
      guide:
        ship: tern
        clear: { any: [ tow, { grafted: [kestrel, tern] } ] }
        steps:
          - label: "Bring Tern here"
            move_to: { near: kestrel, within: 1 }  # touching: the Graft order needs touching ships
            done: reached
          - label: "Graft"
            graft: kestrel
            done: grafted
```

### 12.3 A fixed route with a path (format illustration)

```yaml
      guide:
        ship: kestrel
        steps:
          - label: "Into the lane"
            move_to: { zone: lane_w }
            path: [ [-3, 2], [-3, 0] ]              # ghost path through these waypoints
          - label: "Hold here"
            move_to: [-3, -1]
            done: { after: { beat: first_mine, rounds: 1 } }
```

## 13. Where this is used in the campaign

| chapter | beat | guided ship | steps |
|---|---|---|---|
| ch1 | `crippled` | kestrel | close to 4 hexes, then fire on the Seed |
| ch2 | `first_mine` | kestrel | close on the Seed that's dead in the water, then fire |
| ch4A | `gift` | tern | bring Tern alongside, then Graft |

Other chapters may add guides later in the same format. MANIFEST.md lists this proposal under "Requested engine/UI features".
