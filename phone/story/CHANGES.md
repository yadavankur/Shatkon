# CHANGES: story pack v2 (chapter 1 rebuild)

Same formats, same player API (`loadStory`, `playScene`, `preloadScenes`, `showBark`). All 30
v1 scene ids are kept; one scene is added. Nothing was pushed.

## Chapter 1, rebuilt
The player flies only Kestrel. Finch, Wren and Kite fly escort on their own. Sparrow sits in its
cradle, and Teo Marsh has Kestrel's helm (on the bridge, not on comms).

Beat order: `ch1_intro` → `ch1_contact` → `ch1_finch_down` → **`ch1_hurl` (new)** → `ch1_victory` → `ch1_salvage` (+ `ch1_defeat`).

* **ch1_intro:** warm comms banter before contact. Nanda, Finch's newly appointed captain, keeps checking her spacing. Sefa and Dov tease. Li sends "See you at Meridian". **Running joke:** "Permission to panic?" / "Denied. Captains panic in private."
* **ch1_contact:** Nanda calls the contact. Wren and Kite move out to the flanks, and Nanda holds the middle ("Not panicking. Logging everything.").
* **ch1_finch_down:** a missile goes through Finch's shield (flash, shake, hide_ship). There's no pod, and Nanda is gone. It's quick and not graphic.
* **ch1_hurl (new, mid-battle):** the Seed has cut away Wren's and Kite's guns. Sefa takes the bow and Dov the stern. Vey orders them back, and they refuse kindly. Both hit, and the Seed's shield drops.
* **ch1_victory / ch1_salvage:** grief alongside the launcher salvage. Teo sees the guns were *cut* off ("like it wanted the pieces"). A delayed relay message from Li says "see you at Meridian", and Vey answers "I'm holding you to it." Kestrel logs the three names.
* **ch1_defeat:** no Sparrow; "make it come to us".

## Chapter 2
* Survey charges now **burn out the Seeds' engines and leave them dead in the water**. This changes `ch2_intro` (Moss retunes the fuses), `ch2_first_mine` and `ch2_victory`.
* Teo flies Sparrow for real for the first time in `ch2_intro` ("I'm flying this one for Nanda, Sefa and Dov"), and `show_ship: sparrow` moves there.
* Nanda's heat-and-motion insight now comes from **Finch's last logs**, which Moss reads.

## Removed: "Nanda survives injured"
Every later Nanda line was reassigned (no scene id changed):
* **ch2:** her sensor lines go to Moss on the bridge and Teo in Sparrow (ch2_contact, ch2_salvage, ch2_defeat).
* **ch3:** they go to Moss (ch3_intro, ch3_split, ch3_despair), and ch3_defeat goes to Teo.
* **ch4 and ch5:** Hollis takes sensors (ch4_fork, ch4a_intro, ch4a_outro's "almost like counting", ch5_bloom, ch5_seam_wakes, ch5_defeat). In the fork, the "somebody came for me" line becomes Moss: "We couldn't reach Finch, Wren or Kite in time. We can still reach Ashfall."
* **Remembrance:** in `ch3_despair` Teo asks "permission to panic?" and Vey answers "...Denied. Nanda asked me that, too." In `ch3_reunion` Li asks where Nanda is.

## New ids
* **Portraits:** `wren_pilot` (Sefa Lowe) and `kite_pilot` (Dov Ancell), with all 6 expressions, 768×1024 WebP with alpha.
* **Ships:** `wren` is 1 hex `[[0,0]]` (gun). `kite` is 2 hexes `[[0,0],[1,0]]` (cockpit and gun). Both are drawn by `make_programmatic_art.py`, which gains a `gun` role.
* **Barks:** `b1_weapons_gone` (Sefa), `b1_hurl_wren` (Sefa), `b1_hurl_kite` (Dov), `b2_dead_in_water` (Teo).
* **Changed existing barks (same ids):**
  * `b1_scouts_ahead` is now Nanda: "Finch, Wren and Kite running ahead."
  * `b1_seed_closing` now reads "It's closing on Kestrel. Teo, keep our guns on it!"
  * `b2_second_seed` is now Teo.
  * `b5_jammed` is now Hollis.

## Engine notes (campaign-v1 at 25992f1 doesn't model escorts yet)
* Add AI-controlled escorts `wren` and `kite` to ch1 alongside `finch`, and drop `sparrow` from the ch1 roster. Sparrow first deploys in ch2.
* Suggested ch1 script:
  * `finch_down` as today.
  * Fire `b1_weapons_gone` when both escorts' weapons are destroyed (fallback: N rounds after finch_down).
  * At that point, fire `b1_hurl_wren` and `b1_hurl_kite`, then scene **`ch1_hurl`**. Destroy wren and kite, and strip the Seed's shield or apply ram damage to both end cells.
  * Win by `destroyed: seed`, then `ch1_victory` and `ch1_salvage`.
  * `rewards.roster_remove: [finch, wren, kite]`.
* ch2: a mine hit sets the Seed's thrust to 0 (dead in the water). Fire `b2_dead_in_water` on the first one.
* PR #2's `twin_b` shape and 5-hex graft are engine test fixtures only. campaign-v1 is the source of truth, and this pack follows it.

## Assumptions
* Nanda uses she/her, Sefa she/her, and Dov he/him. The captain stays ungendered (checked).
* Sparrow is carried in Kestrel's cradle during ch1 because it's a training run, with Teo rotating through Kestrel's helm.
* Wren and Kite are line escorts with lasers, and only Finch carries the sensor fit (its art is unchanged).

## Checks
* `verify.mjs`: 0 errors, 0 warnings. 31 scenes and 23 barks. New rules: ch1 order, no Sparrow in ch1, the dead escorts never speak after ch1, and no leftover "Nanda survives" lines.
* Headless Chrome: 67 runs with 0 problems. That covers all 31 scenes with both captains, Skip, the fork, all 23 barks and the new hurl barks.
