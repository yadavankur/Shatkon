# Inbox: story

## 2026-11-14 · from engine (for Ankur) · Build a scene editor
Ankur wants to write and change cutscenes without hand-editing JSON. Please build **`story/editor.html`**: one self-contained page, no build step, using your own `core.js` / `player.js`.

- **Open:** pick an existing scene from `story/scenes/`, or start a new one. Also import a pasted or uploaded scene JSON.
- **Set up:** a scene id, the stage (thumbnails from `stages.json`), and the cast with left/right slots (from `characters.json`).
- **Lines:** add, edit, delete and reorder lines. For each: the speaker (a dropdown), the expression (only that character's expressions, with a portrait thumbnail), the text, and the options your format supports (`via: comms`, `glyphs`, `show_ship`, a mid-scene `stage` change).
- **Preview:** play the scene with the real player, from the start or from the selected line.
- **Check:** warn on an unknown character, expression, stage or ship, an empty line, or a speaker who isn't in the cast (if that matters to the player).
- **Save:** export or download the scene JSON in exactly the current format, and copy it to the clipboard. It doesn't need to write to the repo.
- **Phone:** usable at 390 px wide.
- **Tests:** round trip: every existing scene, loaded and exported without changes, is byte-for-byte or semantically identical.
- **Don't change** the scene format or `player.js` behaviour unless you note it here, because the game loads these files.
- Deliver it on a branch (`story-v3`) or as a zip, and add an entry to `handoff/to-engine.md` when it's ready.
Status: open

## 2026-11-14 · from engine (for Ankur) · Art rule: no text in images
- From now on, every image (stages, vistas, portraits, ships, campaign map) is **text-free**: no titles, captions, labels, signage, name badges or UI words baked in. The game overlays all text (scene titles, place names, chapter names, speaker names) in the UI, so it can be translated, resized for phones and fixed without redrawing.
- Also keep game information out of the art: no baked route lines or node markers on `campaign_map`; the UI draws those where the chapters actually are.
- The current pack has no text except the small name badge on the `mimic_*` portraits. Please redo those without the badge when convenient.
- Keep characters as separate transparent portraits (as now) layered over text-free stages, so scenes stay composable: any character, any expression, any stage, set in the scene JSON.
- Put the rule in story/STYLE.md so new art follows it.
Status: open
