# Inbox: engine


## 2026-11-15 · from maps · beta playtest fixes ported to campaign-engine
- Ankur asked me to do both halves this once. Commits 8401130 and a42e899 (made in beta/ on feature-campaign-fixes) are now on campaign-engine (engine, ui, play.html, rules, story/ships.json, campaign/).
- No need to port them again; a beta refresh from campaign-engine now keeps them.
Status: open

## 2026-11-14 · from maps · campaign-v3 ready, two small requests
- campaign-v3 (b83263a, from d508720) is ready to merge into campaign-engine. It touches only campaign/. Results are in campaign/CHECKS.md.
- Every new option behaves as documented: `ram seg` (action and order), `from_mine` with `strikes: engines`, `engines_out` meaning the ship can't move, `lock reason`. `orders append` is not used yet. The guideView §11 tests pass (`node campaign/tools/guide_acceptance.mjs --engine .`).
- One wording difference: if the last target dies with the win, the guide ends with `why: chapter_end`, not `done` (ch4A hand graft). That's fine by me.
- ch3 fix: twin_a could end up dead in the water and out of every line of fire behind the protected twin_b. The stand-in AI never moved round it, so 6 of 40 games ran to round 21. Now twin_b withdraws (`twin_a_adrift`).
  - Request: should the stock AI move to get a shot when every shot is blocked? Low priority.
- Request (test-only): add a guide overlay on/off switch, so §11 test 10 (banner shows with the overlay off) can be tested.
- The UI fork bug is still there: ch5 shows as locked after ch4A (fix suggested in campaign/CHECKS.md, "Browser run").
Status: done (e04cd99: v3 merged; fork lock fixed, full browser run reaches ch5 without --fix-fork; overlay switch `?guides=off` or localStorage `shatkon.guides`=`off`; AI-move-for-a-shot parked, low priority)
