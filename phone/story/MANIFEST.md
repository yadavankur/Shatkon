# MANIFEST: Shatkon story pack v2 (chapters 1–5, "The Weave")

> **v2:** chapter 1 is rebuilt (Kestrel plus escorts Finch, Wren and Kite; new scene `ch1_hurl`), the ch2 mines leave Seeds dead in the water, and Nanda no longer survives. See `CHANGES.md`.

The characters, dialogue, art and a standalone cutscene player for chapters 1–5. Everything is
static: vanilla ES modules, JSON and WebP. There is no build step, no storage and no network
beyond relative fetches. Open `demo.html` from any static server (for example
`python3 -m http.server` at the repo root, then go to `/story/demo.html`).

## Runtime API

```js
import { loadStory, playScene, preloadScenes } from './story/player.js';
import { showBark } from './story/bark.js';

await loadStory('./story/');                 // base URL of this folder (resolved against document.baseURI)
await preloadScenes(['ch1_intro', 'ch1_contact']);  // warms every image both captains could need
const { choice } = await playScene('ch1_intro', mountEl, {
  captain: 'captain_a',            // or 'captain_b' (the same character, Captain Vey; never gendered)
  textSpeed: 'normal',             // 'slow' | 'normal' | 'instant'
  skippable: true,                 // shows Skip; a choice can never be skipped
  onLine: (line) => {},            // optional, called for each line shown
});                                // choice is null, except ch4_fork, which always returns 'ch4a'
showBark('b1_seed_shield', battleEl, { captain: 'captain_a' });  // non-blocking toast; queued per element
```

* All CSS is injected once as `<style id="sk-story-css">` and scoped under `.sk-story`.
* `mountEl` gets `position:relative` only while a scene plays, and only if it was `static`.
* Tap, click, Space or Enter advances. A press while text is typing completes the line first.
  `prefers-reduced-motion` forces instant text and turns the effects down. Every line is also
  written to an `aria-live` log.
* Effects: `shake` 450 ms, `flash` 380 ms, `glitch` 600 ms, `fade_out` 800 ms.

## Scene and bark ids

All 29 originally required scenes, plus `ch5_defeat` (added) and `ch1_hurl` (v2), are present: 31 scenes. All 23 barks are present (19 original plus 4 from v2). Nothing was renamed.

| chapter | scenes |
|---|---|
| 1 First Contact | ch1_intro, ch1_contact*, ch1_finch_down*, **ch1_hurl* (v2)**, ch1_victory, ch1_salvage (unlocks launcher, missiles), ch1_defeat |
| 2 Quiet Water | ch2_intro, ch2_contact*, ch2_first_mine*, ch2_victory, ch2_salvage (unlocks shield), ch2_defeat |
| 3 The Splitting | ch3_intro, ch3_split*, ch3_despair*, ch3_li_arrives*, ch3_victory (point_defence), ch3_reunion (comms, seeker_drone, docking_clamps, halcyon, tern), ch3_defeat |
| 4 The Fork / Ashfall | ch4_fork (choice), ch4a_intro, ch4a_graft_found (hull_graft), ch4a_outro, ch4a_defeat |
| 5 The Bloom | ch5_intro, ch5_bloom*, ch5_seam_wakes*, ch5_li_moves*, ch5_cliff, **ch5_defeat (added)** |

`*` marks mid-battle scenes, which have 3–8 lines (checked). Defeat scenes have 2–3 lines and push for another try.

Barks: b1_scouts_ahead, b1_contact_glyphs, b1_finch_hit, b1_seed_shield, b1_seed_closing,
b2_mines_set, b2_choke, b2_mine_boom, b2_second_seed, b3_cover, b3_pd_stopped, b3_hull_low,
b3_flank_open, b4_too_easy, b4_graft_hint, b4_seam_hums, b5_jammed, b5_kestrel_unresponsive,
b5_li_coming. **v2:** b1_weapons_gone, b1_hurl_wren, b1_hurl_kite, b2_dead_in_water.

### Additions (ids and fields not in the brief)

| addition | why |
|---|---|
| scene `ch1_hurl` (`added: true`, v2) | Asked for in the v2 brief. Plays between ch1_finch_down and ch1_victory. Its trigger is in Engine requests. |
| characters `wren_pilot`, `kite_pilot` and ships `wren`, `kite` (v2) | ch1 escorts. Characters can carry `short` and `bio`, which the player ignores. |
| scene `ch5_defeat` (`added: true`) | Every other chapter has a defeat scene. Unused by campaign-v1, which has `lose: null` for ch5, but harmless. |
| speakers `narrator` (caption, no portrait) and `weave` (portraits `calm`, `pulse`, `hostile`) | Narration lines and the untranslated or partly translated Weave pulses. |
| `ships.json` | Ship names, sides, axial segments and images for `show_ship`. |
| line field `show_ship: <ship id>` and `hide_ship: true` | Shows a ship figure on the stage. It persists until the stage changes and drops lower during comms or glyph lines. |
| line field `glyphs: true` (on `weave` lines) | Shows the hex-glyph panel. The text is the translator's partial output. |
| line field `via: "comms"` | Shows the speaker in the comms frame (comms_screen art) instead of in a portrait slot. |
| bark field `expression` | The portrait used in the toast. |
| scene meta `chapter`, `kind`, `unlocks`, `added` | For engine and tooling. The player ignores them. |
| `stages.json` → `campaign_map.spots` | Normalised node positions for ch1 to ch5 and ch4b. |
| `scenes/index.json` | `{scenes:[…], barks:[…]}` for tools and demo.html. |
| `core.js` | Shared state, URL helpers and the scoped CSS, used by player.js and bark.js. |
| ship ids `kestrel_refit`, `kestrel_grafted`, `twin_a`, `twin_b`, `husk`, `husk_1..3`, `seed_a`, `seed_b`, `bloom` | See the ship table below. |

## Ships (`ships.json`, pointy-top axial [q, r])

| id | segments | note |
|---|---|---|
| kestrel | [-1,0] [0,0] [1,0] | ch1 and **ch2**. The ch2 launcher is bolted onto the existing hull: no new segment. |
| kestrel_refit | + [0,-1] | **ch3–ch4a** refit with the 4th, SHIELD segment from the ch2 salvage. |
| kestrel_grafted | refit + [-1,1] [0,1] | ch5 (grafted in ch4a_outro). Kestrel plus Tern, with a glowing Weave seam. |
| sparrow, finch | [0,0] | Finch is a ch1 escort, destroyed in ch1_finch_down. Sparrow first flies in ch2. |
| wren (v2) | [0,0] | ch1 AI escort, one gun hex. Not in campaign-v1 yet. |
| kite (v2) | [0,0] [1,0] | ch1 AI escort, cockpit plus gun. Not in campaign-v1 yet. |
| halcyon | [0,0] [1,0] [0,1] | |
| tern | [0,0] [1,0] | |
| seed, seed_a, seed_b | [0,0] [1,0] | seed_a and seed_b are aliases (same image) for campaign `seed_a@ch2` / `seed_b@ch2`. |
| twin | twin_a + twin_b | Two triangles joined at [1,0]–[1,-1]. |
| twin_a | [0,0] [1,0] [0,1] | |
| twin_b | [1,-1] [2,-1] [2,-2] | **Unsplit-frame offsets** (where the cells sit inside the Twin). campaign-v1's `twin_b@ch3` re-centres on its first cell: [0,0] [1,0] [1,-1]. The same shape, translated by (-1,+1). |
| husk_1 | [0,0] | |
| husk_2 | [0,0] [1,0] | Two cells east. ch4a_intro shows this one. |
| husk_3 | [0,0] | One cell. |
| husk | [0,0] [1,0] | Generic alias, the same shape as husk_2. |
| bloom | centre + a full ring (7) | |

## Engine requests (for the play screen, not done here)

1. On the engine event `{t:'scene', id, at}`, `await playScene(id, mountEl, {captain})` and
   **pause turn processing while it plays**. PR #2's engine emits the event but does not wait.
2. Map `{t:'bark', id}` to `showBark(id, battleEl, {captain})`. It does not block.
3. Let the player pick `captain_a` or `captain_b` once (new campaign) and pass it to every call.
4. Per chapter, `scenes.lose` → `chN_defeat`. ch5 has `lose: null` in campaign-v1, so
   `ch5_defeat` is optional.
5. **v2 ch1:**
   * Roster: kestrel (player) plus AI escorts finch, wren and kite. No sparrow.
   * Script: `finch_down` → `b1_weapons_gone` (both escorts' weapons destroyed, with a round fallback) → `b1_hurl_wren` + `b1_hurl_kite` → scene `ch1_hurl`. Then remove wren and kite and strip the Seed's shield (or ram both end cells).
   * `roster_remove: [finch, wren, kite]`.
   * ch2: a mine hit sets the Seed's thrust to 0. Fire `b2_dead_in_water`.
6. `ch4_fork` returns `{choice:'ch4a'}` (ch4b locks itself after its talk-down). Route it to node `ch4a`.
7. **Hull → ship-image lookup** (campaign hull key → `ships.json` id):

| campaign hull | story ship id |
|---|---|
| kestrel@ch1, kestrel@ch2 | kestrel |
| kestrel@ch3, kestrel@ch4a | kestrel_refit |
| kestrel@ch5 | kestrel_grafted |
| finch@ch1, wren@ch1, kite@ch1 | finch, wren, kite |
| seed@ch1 | seed |
| seed_a@ch2, seed_b@ch2 | seed (aliases seed_a, seed_b also exist) |
| twin@ch3, twin_a@ch3, twin_b@ch3 | twin, twin_a, twin_b (twin_b offsets: see above) |
| husk_1@ch4a, husk_2@ch4a, husk_3@ch4a | husk_1, husk_2, husk_3 |
| others (`<id>@chN`) | strip `@chN` |

## Alignment with PR #2 (`campaign-engine`, read-only, head 3692a82) and campaign-v1 (read-only, re-checked at 25992f1 for v2)

**v2:** campaign-v1 at 25992f1 still has ch1 as `[kestrel, sparrow, finch]` with `roster_remove: [finch]` ("the pilot lives"). The v2 brief supersedes that. The ids `wren`, `kite`, `wren_pilot`, `kite_pilot` and `ch1_hurl` are proposed here for the engine to adopt.

Both were read without reviewing, commenting or writing. I aligned with them only where the
brief's fixed ids were unaffected.

* **Ids that match:** every scene, bark, stage and zone id they use exists here: ch1_intro,
  ch1_contact, ch1_finch_down, ch1_victory, ch1_salvage (the `win` list order), ch1_defeat,
  b1_seed_closing, ch3_split, ch3_li_arrives, ch4a_outro, ch5_intro, ch5_cliff, and the rest.
* **Scene slots:** PR #2's chapters use `scenes: {intro, win:[…], lose, tbc}`. campaign-v1 has
  `tbc: ch5_cliff` and `lose: null` for ch5.
* **Hull shapes that match:** kestrel@ch1 [-1,0][0,0][1,0]; sparrow [0,0]; tern [0,0][1,0];
  halcyon [0,0][1,0][0,1]; seed [0,0][1,0]; twin_a = the split piece [0,0][1,0][0,1].
* **Changed to match campaign-v1:** ch2_intro now shows `kestrel` (3 hexes) instead of
  `kestrel_refit`. kestrel_refit (with the [0,-1] shield segment) first appears in ch3_intro.
  husk_2 is now [0,0][1,0] and husk_3 is [0,0]. seed_a and seed_b were added. ch4a_intro uses husk_2.
* **Seam:** `{kind:'weave'}` on Kestrel plus Tern cells [-1,1],[0,1], which matches the seam art on kestrel_grafted.
* **PR #2 engine test fixtures (not campaign data):** the twin_b [1,-1][2,-1][2,0] split and the 5-hex Kestrel+Tern graft exist only in engine test fixtures. campaign-v1 is the source of truth: Twin is two triangles, [1,-1][2,-1][2,-2], and the graft is the refit (4) plus Tern (2), which makes 6. This pack follows campaign-v1.
* **Not modelled by the engines:** neither engine branch has a `show_ship`, glyph or comms line concept. Those
  stay inside the player.

## Assumptions

* The campaign-plan .md attached to the brief was not on the box. Only a .yaml was there. I
  worked from the written brief, the id lists in it, and later PR #2 and campaign-v1 for shapes.
* **v2 cast:**
  * Priya "Nanda" Nandakumar is Finch's newly appointed captain and dies in ch1_finch_down (she/her).
  * Sefa Lowe (Wren) is a late-40s Samoan veteran with a grey-streaked braid, laugh lines, a chin scar and a tan shoulder stripe (she/her).
  * Dov Ancell (Kite) is mid-30s with a shaved head, a dark beard, a silver earring and a violet stripe; laconic (he/him).
  * After ch1, Moss and Teo cover sensors in ch2–3, and Hollis does from ch4.
  * Running joke: "Permission to panic?" / "Denied." It's echoed in ch3_despair.
* **v2:** Sparrow rides in Kestrel's cradle in ch1, with Teo at Kestrel's helm on a training rotation. Sparrow first flies in ch2_intro.
* The captain is one character, Captain Vey, with two looks (`captain_a`, `captain_b`). The
  dialogue is identical and has no gendered words or pronouns for the captain (checked by
  verify.mjs). The captain_b portrait may read as feminine to some players, but no text depends on it.
* Li uses they/them. The other crew have pronouns only where natural, and verify.mjs flags any
  pronoun near a captain reference.
* A bark's `lines` are shown together in one toast (3.5 s + 1.2 s per extra line), not picked at random.
* Barks are queued per mount element, so they never overlap.
* The ship figure persists until the next stage change.
* The right-hand portrait is mirrored so faces turn inward.
* A speaker not in the cast takes a free side, or replaces the non-captain side.
* The Skip button ends the lines but still shows ch4_fork's choice. Choosing ch4b plays its
  talk-down, locks it ("Signal lost") and shows the choice again. Only ch4a resolves.
* Ch5 ends on Li turning Halcyon toward Kestrel ("See you at Meridian, Vey.", then a fade and
  "End of Chapter Five."). Li's sacrifice is not written.
* Replay tells:
  * The Ashfall mimic says "any human ship" and "We have room for you", and its call loops with the same cough.
  * The graft rig has no maker's stamp, is warm and self-powered, and its couplings "just meet".
  * Hollis asks where a mining outpost got the money for a miracle, then calls the seam's hum "almost like counting".
  * The translator starts catching words in ch4a_intro, and ch5_seam_wakes reads "CELL. YOU ARE ALREADY PART."
* **Stage art:** the image generator outputs 1280×720, so stages were upscaled with Lanczos and
  an unsharp mask to 1920×1080. They are a little soft at 1:1.
* **Portraits** were generated on flat green and chroma-keyed. Hair edges carry a faint despill.
* **Programmatic art:** ships, Weave portraits and the campaign-map overlay are drawn with
  Pillow. They are not generated images, so every hex matches its segments exactly.
* **Delivery:** a zip with `story/` at its root. v2 is delivered as a zip only; nothing was pushed to GitHub. `story/tools/` holds the authoring and check scripts. The raw art sources (`src/`) are not shipped.

## Verification

* `node story/tools/verify.mjs` checks:
  * every id, path and character expression;
  * WebP size, dimensions and alpha;
  * stage focus and map spots;
  * ship shapes (including the campaign-v1 alignment) and connectivity;
  * line schema and mid-battle counts;
  * the ch4_fork schema;
  * gendered words around the captain;
  * v2 rules: the ch1 scene order, no Sparrow in ch1, no lines or casting for Finch, Wren or Kite pilots after ch1, and no leftover "Nanda survives" lines;
  * code rules (no storage, no absolute URLs, local imports, scoped CSS).
* `story/tools/headless_test.py` (Playwright and Chrome):
  * serves the repo root, plays every scene at `textSpeed:'instant'` with both captains;
  * clicks ch4b, then ch4a, at the fork;
  * tests Skip and fires all barks;
  * fails on any console error or warning, page error, failed request or HTTP status ≥ 400;
  * writes screenshots to `screens/`.
* The tools find the story folder whether they live in `tools/` or `story/tools/`.
  `process_art.py` needs the art sources in `src/`, which are not shipped.

## Files

147 files. Image counts: portraits 69, stages 12, ships 18.

| file | size | notes |
|---|---|---|
| `CHANGES.md` | 5.0 KB | v2 change note |
| `MANIFEST.md` | — | this file |
| `STYLE.md` | 6.3 KB | art and writing style guide |
| `bark.js` | 2.6 KB | exports showBark |
| `barks.json` | 3.6 KB | 23 barks: speaker, expression, lines |
| `characters.json` | 5.8 KB | speakers, names, titles, accent colours, portrait paths |
| `core.js` | 16.7 KB | shared state, URL helpers, scoped CSS |
| `demo.html` | 6.8 KB | every scene and bark; captain and text-speed toggles; window.skDemo for tests |
| `img/portraits/captain_a_determined.webp` | 73.9 KB | 768×1024 |
| `img/portraits/captain_a_hurt.webp` | 81.7 KB | 768×1024 |
| `img/portraits/captain_a_neutral.webp` | 75.5 KB | 768×1024 |
| `img/portraits/captain_a_shock.webp` | 75.9 KB | 768×1024 |
| `img/portraits/captain_a_smile.webp` | 70.8 KB | 768×1024 |
| `img/portraits/captain_a_worried.webp` | 74.8 KB | 768×1024 |
| `img/portraits/captain_b_determined.webp` | 79.4 KB | 768×1024 |
| `img/portraits/captain_b_hurt.webp` | 84.1 KB | 768×1024 |
| `img/portraits/captain_b_neutral.webp` | 76.3 KB | 768×1024 |
| `img/portraits/captain_b_shock.webp` | 83.1 KB | 768×1024 |
| `img/portraits/captain_b_smile.webp` | 78.9 KB | 768×1024 |
| `img/portraits/captain_b_worried.webp` | 79.7 KB | 768×1024 |
| `img/portraits/engineer_determined.webp` | 101.9 KB | 768×1024 |
| `img/portraits/engineer_hurt.webp` | 108.8 KB | 768×1024 |
| `img/portraits/engineer_neutral.webp` | 102.9 KB | 768×1024 |
| `img/portraits/engineer_shock.webp` | 97.7 KB | 768×1024 |
| `img/portraits/engineer_smile.webp` | 102.2 KB | 768×1024 |
| `img/portraits/engineer_worried.webp` | 102.1 KB | 768×1024 |
| `img/portraits/finch_pilot_determined.webp` | 84.9 KB | 768×1024 |
| `img/portraits/finch_pilot_hurt.webp` | 93.1 KB | 768×1024 |
| `img/portraits/finch_pilot_neutral.webp` | 82.5 KB | 768×1024 |
| `img/portraits/finch_pilot_shock.webp` | 90.9 KB | 768×1024 |
| `img/portraits/finch_pilot_smile.webp` | 89.0 KB | 768×1024 |
| `img/portraits/finch_pilot_worried.webp` | 90.3 KB | 768×1024 |
| `img/portraits/kite_pilot_determined.webp` | 72.5 KB | 768×1024 |
| `img/portraits/kite_pilot_hurt.webp` | 75.1 KB | 768×1024 |
| `img/portraits/kite_pilot_neutral.webp` | 74.7 KB | 768×1024 |
| `img/portraits/kite_pilot_shock.webp` | 74.9 KB | 768×1024 |
| `img/portraits/kite_pilot_smile.webp` | 74.0 KB | 768×1024 |
| `img/portraits/kite_pilot_worried.webp` | 74.1 KB | 768×1024 |
| `img/portraits/li_determined.webp` | 85.8 KB | 768×1024 |
| `img/portraits/li_hurt.webp` | 86.5 KB | 768×1024 |
| `img/portraits/li_neutral.webp` | 87.6 KB | 768×1024 |
| `img/portraits/li_shock.webp` | 89.9 KB | 768×1024 |
| `img/portraits/li_smile.webp` | 86.5 KB | 768×1024 |
| `img/portraits/li_worried.webp` | 85.1 KB | 768×1024 |
| `img/portraits/meridian_determined.webp` | 87.4 KB | 768×1024 |
| `img/portraits/meridian_hurt.webp` | 113.6 KB | 768×1024 |
| `img/portraits/meridian_neutral.webp` | 87.5 KB | 768×1024 |
| `img/portraits/meridian_shock.webp` | 91.0 KB | 768×1024 |
| `img/portraits/meridian_smile.webp` | 88.9 KB | 768×1024 |
| `img/portraits/meridian_worried.webp` | 90.0 KB | 768×1024 |
| `img/portraits/mimic_determined.webp` | 81.0 KB | 768×1024 |
| `img/portraits/mimic_hurt.webp` | 79.9 KB | 768×1024 |
| `img/portraits/mimic_neutral.webp` | 82.3 KB | 768×1024 |
| `img/portraits/mimic_shock.webp` | 85.5 KB | 768×1024 |
| `img/portraits/mimic_smile.webp` | 82.3 KB | 768×1024 |
| `img/portraits/mimic_worried.webp` | 83.2 KB | 768×1024 |
| `img/portraits/sparrow_pilot_determined.webp` | 86.0 KB | 768×1024 |
| `img/portraits/sparrow_pilot_hurt.webp` | 96.7 KB | 768×1024 |
| `img/portraits/sparrow_pilot_neutral.webp` | 88.1 KB | 768×1024 |
| `img/portraits/sparrow_pilot_shock.webp` | 91.3 KB | 768×1024 |
| `img/portraits/sparrow_pilot_smile.webp` | 90.7 KB | 768×1024 |
| `img/portraits/sparrow_pilot_worried.webp` | 85.9 KB | 768×1024 |
| `img/portraits/tern_pilot_determined.webp` | 91.2 KB | 768×1024 |
| `img/portraits/tern_pilot_hurt.webp` | 91.7 KB | 768×1024 |
| `img/portraits/tern_pilot_neutral.webp` | 89.9 KB | 768×1024 |
| `img/portraits/tern_pilot_shock.webp` | 88.8 KB | 768×1024 |
| `img/portraits/tern_pilot_smile.webp` | 91.9 KB | 768×1024 |
| `img/portraits/tern_pilot_worried.webp` | 89.6 KB | 768×1024 |
| `img/portraits/weave_calm.webp` | 43.4 KB | 768×1024 |
| `img/portraits/weave_hostile.webp` | 54.4 KB | 768×1024 |
| `img/portraits/weave_pulse.webp` | 68.0 KB | 768×1024 |
| `img/portraits/wren_pilot_determined.webp` | 81.9 KB | 768×1024 |
| `img/portraits/wren_pilot_hurt.webp` | 81.2 KB | 768×1024 |
| `img/portraits/wren_pilot_neutral.webp` | 80.6 KB | 768×1024 |
| `img/portraits/wren_pilot_shock.webp` | 81.8 KB | 768×1024 |
| `img/portraits/wren_pilot_smile.webp` | 82.2 KB | 768×1024 |
| `img/portraits/wren_pilot_worried.webp` | 80.7 KB | 768×1024 |
| `img/ships/bloom.webp` | 114.2 KB | 1024×768 |
| `img/ships/finch.webp` | 42.6 KB | 1024×768 |
| `img/ships/halcyon.webp` | 48.9 KB | 1024×768 |
| `img/ships/husk.webp` | 97.2 KB | 1024×768 |
| `img/ships/husk_1.webp` | 75.2 KB | 1024×768 |
| `img/ships/husk_2.webp` | 96.5 KB | 1024×768 |
| `img/ships/husk_3.webp` | 73.5 KB | 1024×768 |
| `img/ships/kestrel.webp` | 44.0 KB | 1024×768 |
| `img/ships/kestrel_grafted.webp` | 51.8 KB | 1024×768 |
| `img/ships/kestrel_refit.webp` | 58.3 KB | 1024×768 |
| `img/ships/kite.webp` | 54.1 KB | 1024×768 |
| `img/ships/seed.webp` | 93.2 KB | 1024×768 |
| `img/ships/sparrow.webp` | 41.9 KB | 1024×768 |
| `img/ships/tern.webp` | 55.2 KB | 1024×768 |
| `img/ships/twin.webp` | 69.3 KB | 1024×768 |
| `img/ships/twin_a.webp` | 92.1 KB | 1024×768 |
| `img/ships/twin_b.webp` | 91.7 KB | 1024×768 |
| `img/ships/wren.webp` | 43.7 KB | 1024×768 |
| `img/stages/ashfall_outpost.webp` | 218.1 KB | 1920×1080 |
| `img/stages/campaign_map.webp` | 204.1 KB | 1920×1080 |
| `img/stages/comms_screen.webp` | 49.7 KB | 1920×1080 |
| `img/stages/halcyon_bridge.webp` | 269.3 KB | 1920×1080 |
| `img/stages/kestrel_bridge.webp` | 147.6 KB | 1920×1080 |
| `img/stages/kestrel_engine_bay.webp` | 266.2 KB | 1920×1080 |
| `img/stages/meridian_dark.webp` | 135.5 KB | 1920×1080 |
| `img/stages/salvage_wreck.webp` | 295.7 KB | 1920×1080 |
| `img/stages/vista_bloom.webp` | 212.2 KB | 1920×1080 |
| `img/stages/vista_corridor.webp` | 217.6 KB | 1920×1080 |
| `img/stages/vista_quiet_water.webp` | 126.5 KB | 1920×1080 |
| `img/stages/weave_lattice.webp` | 192.0 KB | 1920×1080 |
| `player.js` | 15.7 KB | exports loadStory, playScene, preloadScenes |
| `scenes/ch1_contact.json` | 1.5 KB | ch1 mid_battle, stage vista_corridor, 9 lines |
| `scenes/ch1_defeat.json` | 0.5 KB | ch1 defeat, stage kestrel_bridge, 3 lines |
| `scenes/ch1_finch_down.json` | 1.2 KB | ch1 mid_battle, stage vista_corridor, 10 lines |
| `scenes/ch1_hurl.json` | 1.6 KB | ch1 mid_battle, stage vista_corridor, 15 lines |
| `scenes/ch1_intro.json` | 3.7 KB | ch1 intro, stage kestrel_bridge, 25 lines |
| `scenes/ch1_salvage.json` | 1.8 KB | ch1 salvage, stage salvage_wreck, 11 lines |
| `scenes/ch1_victory.json` | 1.2 KB | ch1 victory, stage vista_corridor, 8 lines |
| `scenes/ch2_contact.json` | 1.0 KB | ch2 mid_battle, stage vista_quiet_water, 6 lines |
| `scenes/ch2_defeat.json` | 0.6 KB | ch2 defeat, stage vista_quiet_water, 2 lines |
| `scenes/ch2_first_mine.json` | 1.2 KB | ch2 mid_battle, stage vista_quiet_water, 8 lines |
| `scenes/ch2_intro.json` | 1.9 KB | ch2 intro, stage kestrel_engine_bay, 14 lines |
| `scenes/ch2_salvage.json` | 1.4 KB | ch2 salvage, stage salvage_wreck, 7 lines |
| `scenes/ch2_victory.json` | 1.0 KB | ch2 victory, stage vista_quiet_water, 5 lines |
| `scenes/ch3_defeat.json` | 0.5 KB | ch3 defeat, stage meridian_dark, 2 lines |
| `scenes/ch3_despair.json` | 1.2 KB | ch3 mid_battle, stage meridian_dark, 8 lines |
| `scenes/ch3_intro.json` | 1.5 KB | ch3 intro, stage meridian_dark, 11 lines |
| `scenes/ch3_li_arrives.json` | 1.0 KB | ch3 mid_battle, stage meridian_dark, 9 lines |
| `scenes/ch3_reunion.json` | 2.3 KB | ch3 reunion, stage halcyon_bridge, 15 lines |
| `scenes/ch3_split.json` | 0.9 KB | ch3 mid_battle, stage meridian_dark, 8 lines |
| `scenes/ch3_victory.json` | 0.8 KB | ch3 victory, stage meridian_dark, 4 lines |
| `scenes/ch4_fork.json` | 2.6 KB | ch4 fork, stage campaign_map, 8 lines + choice |
| `scenes/ch4a_defeat.json` | 0.5 KB | ch4 defeat, stage ashfall_outpost, 2 lines |
| `scenes/ch4a_graft_found.json` | 2.3 KB | ch4 salvage, stage salvage_wreck, 13 lines |
| `scenes/ch4a_intro.json` | 1.4 KB | ch4 intro, stage ashfall_outpost, 9 lines |
| `scenes/ch4a_outro.json` | 1.5 KB | ch4 outro, stage kestrel_bridge, 11 lines |
| `scenes/ch5_bloom.json` | 0.9 KB | ch5 mid_battle, stage vista_bloom, 6 lines |
| `scenes/ch5_cliff.json` | 1.2 KB | ch5 cliff, stage vista_bloom, 11 lines |
| `scenes/ch5_defeat.json` | 0.5 KB | ch5 defeat, stage vista_bloom, 2 lines |
| `scenes/ch5_intro.json` | 1.6 KB | ch5 intro, stage halcyon_bridge, 11 lines |
| `scenes/ch5_li_moves.json` | 0.7 KB | ch5 mid_battle, stage halcyon_bridge, 4 lines |
| `scenes/ch5_seam_wakes.json` | 1.1 KB | ch5 mid_battle, stage kestrel_bridge, 9 lines |
| `scenes/index.json` | 1.0 KB | scene and bark id lists |
| `ships.json` | 4.6 KB | ship names, sides, axial segments, images |
| `stages.json` | 1.4 KB | stage images, focus points, campaign_map.spots |
| `tools/build_story.py` | 35.4 KB | source of truth for all dialogue; writes the JSON |
| `tools/headless_test.py` | 8.1 KB | Playwright run of every scene, both captains, plus screenshots |
| `tools/make_programmatic_art.py` | 14.6 KB | renders ships, Weave portraits and the campaign map |
| `tools/process_art.py` | 2.0 KB | chroma key and resize of generated art (needs src/, not shipped) |
| `tools/verify.mjs` | 14.4 KB | static checks (node) |
