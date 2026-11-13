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
