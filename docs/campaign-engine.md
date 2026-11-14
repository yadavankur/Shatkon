# Story campaign engine

How the engine runs a story chapter. The data formats are the ones in the campaign plan
("Shatkon: The Weave", Prompt 2); this page records exactly what the engine does with them,
including a few additions.

## Loading a chapter

```js
import { buildChapter, start, apply, campaignMove, applyResult, newCampaign, nextNodes } from './engine/index.js';
let progress = newCampaign(campaignDoc);                       // campaign/campaign.yaml, parsed
const { rules, problems } = buildChapter({ world, map, ships, chapter, campaign: campaignDoc, progress });
let game = start(rules, seed);                                 // runs the intro scene and 'start' beats
// human turns: apply(game, action); computer turns: apply(game, campaignMove(game, 1))
progress = applyResult(progress, chapter, game);               // after the chapter ends
```

- `world_overrides` uses dotted world-file paths (`"bay_parts.comms.link_range": 3`).
- Ship names in the game are the campaign ids (`kestrel`, `seed`). Hulls come from `ships.yaml`:
  `<id>@<this chapter>` first, then a hull carried over from an earlier chapter (a graft),
  then the newest earlier `<id>@<chapter>`, then `<id>`.
- Zones are lists of hexes, either under `map.zones` (next to the home zones) or a top-level `zones:`.
- Ships in `groups` are loaded as reserves: no starting position, placed by `spawn`.
- Budget is ignored. Ships that were docked or grafted may carry several cores.

## When the script runs

After the first turn starts, after every action, and at the start of every turn (after
`doom`s and forced orders). Entries fire once (or once a turn with `repeat: true`), in file
order, and are re-checked until nothing new fires. Each firing emits a `beat` event.

## Triggers

As in the plan, plus: a bare string (`when: contact`) means "that beat has fired";
`beat: id`; `alive: ship`; `removed: ship`; `docked: [a, b]`.
`sees` is an exact sighting. `hull_below` uses the hull percentage the play screen shows
(shields not counted). `stopped` counts missiles of that side stopped by point defence.

## Actions

As in the plan, plus: `damage: { ship, hits, seg?, cause?, from_mine? }` (scripted hits; `from_mine` uses up the nearest enemy mine, shows a blast and counts as a mine hit), `protect: { side, until }` (a whole side, later arrivals too), `unprotect: ship`, `unlock_controls: { ship }`, `release: ship` (ends forced
orders), and `disable: { ship, parts, until }` re-enables the parts when `until` passes.
`until` can be a beat id, a number of rounds, `{ rounds: N }` or `end`.

- `scene` / `bark` / `objective` emit events (`t: 'scene' | 'bark' | 'objective'`) for the screen
  to play; the engine doesn't wait for them.
- `spawn` places each ship of the group on the first zone hex where it fits (in listed order),
  then searches outward. A group can also give exact spots: `at: { halcyon: [q, r] }`.
- `split` pieces: `cells` are offsets in the original hull's coordinates; a piece's position
  becomes its first segment's hex. Load goes to pieces with magazine room, in order.
- `force` orders: `move_toward: ship` (the reachable spot closest to it) and `fire_at: ship`.
  They run at the start of the owner's turn and spend that player's points and thrust.
- `protect`: hits never destroy the core and the ship can't die while protected.
- A scripted `graft` / `dock` on ships that aren't touching emits `script_failed`; the rest of the beat still runs.
- World setting `damage.beams_pass_mines` (default false): lasers fly over mines.
- `end: { result }` with `win`, `lose` or `to_be_continued`. Scenes: `scenes.win` (list),
  `scenes.lose`, `scenes.tbc`.

## Results

Without `win` / `lose` lists a chapter is won when every enemy flagship is destroyed (one still
waiting in a group doesn't count yet) and lost when the player's flagship falls. The normal
flagship rule is off in story chapters.

## New player orders

`{ type: 'graft' | 'dock', ship, with }`: needs the tech (`unlock: graft` in the script, or the
`graft` / `docking` capability in the campaign progress), two touching ships of yours, 7 segments
at most, 1 command point. Docked ships lose 1 command point per extra core each turn; grafted
ships don't. Both leave a seam on the ship (`seams: [{ kind: 'dock' | 'weave', with }]`).
Turn-code letters: `g` (graft), `k` (dock).

## Computer profiles

`campaignMove(game, seat)` applies each ship's profile (ship-specific, then the side's default),
with randomness seeded from the game state. Knobs: `level`, `stance` (`hold` never moves,
`charge` closes to 1, `advance` marches on its `path_via` zone then the enemy home, `flee`
keeps away, `hunt` / `patrol` are the normal behaviour), `target` (`smallest`, `nearest`,
`flagship`, or a list of ids), `stand_off` (hexes, or `{ from, hexes }`), `path_via`, `scans`,
`avoid_mines`, `launch_range`, `fire_chance`, `max_hits_per_round`, `only_targets` (shoot and lock only these ids). `ignore_flank` is accepted
and does nothing.

## Combat v2 (faster fights, straight missiles, the hurl)

**World numbers** (`rules/world_v0.4.yaml`, change them there):
- Lasers do 3 hits out to 4 hexes and 2 hits out to 8 (was 2 / 1).
- `detection.attack_run_bonus: 1`: a ship that moved at least 1 hex this turn before firing does +1 hit.
- Shields (`recharge_if_unhit: true`) only come back after a round in which they weren't hit, so
  sustained fire keeps them down. `recharge_every: N` makes them wait N rounds.
- In simulations a Seed-sized ship falls to focused fire in 2 rounds at any range (was 2 up close,
  6 at range), and a full skirmish takes about 9 rounds (was 11.5). The current chapters
  get much shorter as a result and need rebalancing (ch1 now ends around round 2–3).

**Missiles aimed at any hex.** `aimLaunch(state, ship, kind, [q, r], target?)` returns a normal launch
action: it leaves from the launch hex nearest the aim and flies the straight hex line toward it,
then carries straight on (its seeker can still take over). The play screen: tap any hex in
Missile or Drone mode. Turn codes are unchanged (it's still `start` + `route`).

**Mines that hit engines.** `munitions.mine.strikes: engines` (world or `world_overrides`): each
mine hit lands on the working engine nearest the impact, anywhere on the ship; once the engines
are gone, the rest hit the struck segment as usual. `munitions.mine.hits` sets the strength.
Trigger `engines_out: ship` fires when a ship has no working engine left.

**The sacrificial hurl (`ram`).** World settings under `actions.ram`: `hits_per_segment` (4),
`reach_bonus` (2), `pierces_shields` (true). The rammer is destroyed; the target takes
hits_per_segment x the rammer's living segments, one at a time, starting with its segment nearest
the rammer and spilling to the next. A ram reaches the target if it is within the rammer's move
this turn + reach_bonus (script action `ram: { ship, target, force: true }` skips that check).
There is no player button. Trigger `rammed: ship` fires after that ship has rammed.

**Ships that fly themselves.** In a chapter's ship list: `{ id: wren, helm: script }`. The player
can't command it (the fleet strip says "flying itself"); it follows `orders`:

```yaml
- id: escorts
  when: start
  do:
    - orders: { ship: wren, do: [ { follow: [[2, 3], [1, 0]] }, { ram: seed } ] }
    - orders: { ship: kite, do: [ { move_to: [-2, 1] }, { hold: true } ] }
```

Each turn, on its side's turn start, the first unfinished movement order runs (`move_to: [q, r]`,
`follow: [[q, r], ...]` one waypoint at a time, `move_toward: ship`, `hold`, `ram: ship`: it closes
in and hurls itself once in reach), and every `fire_at: ship` / `launch_at: ship | [q, r]` order
fires (`launch_at` once). A new `orders` action replaces that ship's plan. Orders and forced moves
spend their own budget: the player's command points and thrust are untouched. `force` takes the
same order kinds.

**More order options.** `orders: { ship, do: [...], append: true }` adds to the plan instead of
replacing it. A `launch_at` that hasn't fired yet survives a replacing `orders` (it is a one-shot
and is only marked done after a real launch). `ram: { ship, target, seg: n }` strikes segment `n` of
the target first.

**Dead in the water.** A ship built with engines whose engines are all destroyed or `off` can't
move (`reach` is empty, a move is refused with a reason). `engines_out` uses the same test. A
scripted `damage` with `from_mine: true` follows the mine's `strikes` setting.

**Partial locks.** `lock: { ship, actions: [fire, launch], until, reason: "Guns cold" }`. The
refusal text is the `reason`; the play screen greys just those buttons and shows the reason.
`actions: all` is the old full lock ("not answering").

## Move guides (on-map "go here" hints)

Format: `campaign/GUIDE_PROPOSAL.md`. A script entry may carry `guide: { ship, steps, clear }` next
to `when`/`do`. It starts when the entry fires; one guide per ship (a new one replaces it).

- Lifecycle (`engine/script.js`): `state.script.guides`. Steps advance on `done` (a trigger or a
  reserved word: `reached`, `fired`, `launched`, `grafted`, `docked`; the default comes from the
  step's kind), skip steps already done, time out with `timeout: { rounds }`, and drop on `clear`,
  the ship's loss or the chapter's end. Events `guide` / `guide_clear` (`why`: done, clear,
  timeout, ship_lost, replaced, chapter_end) go to the owner only.
- `guideView(state, player)` (`engine/guide.js`, exported) is pure and fog-safe: `dest`, `best`,
  `blockedFrom` (occupied targets fall back ring by ring), `route` (open-hex search; through `path`
  waypoints if given), `turnEnd` (furthest route hex in `reach` this turn), `reticle` (dashed when
  out of range or on a last-known ghost; none if never seen), `join`, `label`, `step`/`of`,
  `anchor`, `live`.
- Play screen: cyan glow on the destinations (best one filled), ghost path solid to this turn's
  end then dotted, reticle, join marker and a label pill; 40% opacity on the enemy turn. Tap a
  glowing hex to preview that move (or this turn's part of it); tap the reticle for Fire mode, or
  an aimed launch. The camera frames the step when it first shows. While a guide is up the
  objective banner is hidden.

## Testing and tuning a chapter (play screen)

Campaign map → **Test a chapter**: pick any chapter, change the computer's `ai_profiles` (skill,
personality/stance, stand-off, target, launch range, scans), and **Launch test**. A test starts from
your save just before that chapter, or else from a crew that won everything before it; it never
changes the campaign save. Rule knobs from the Lab (`shatkon.labKnobs`) apply to story chapters as
well as skirmish. Chapter changes are kept per browser (`shatkon.story.tweaks`, paths inside the
chapter); **Copy changes** gives a text list of every changed path and value to hand to the file owner.
