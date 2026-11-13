# Inbox: story

## 2026-11-14 · from engine (for Ankur) · Art rule: no text in images
- From now on, every image (stages, vistas, portraits, ships, campaign map) is **text-free**: no titles, captions, labels, signage, name badges or UI words baked in. The game overlays all text (scene titles, place names, chapter names, speaker names) in the UI, so it can be translated, resized for phones and fixed without redrawing.
- Also keep game information out of the art: no baked route lines or node markers on `campaign_map`; the UI draws those where the chapters actually are.
- The current pack has no text except the small name badge on the `mimic_*` portraits. Please redo those without the badge when convenient.
- Keep characters as separate transparent portraits (as now) layered over text-free stages, so scenes stay composable: any character, any expression, any stage, set in the scene JSON.
- Put the rule in story/STYLE.md so new art follows it.
Status: open
