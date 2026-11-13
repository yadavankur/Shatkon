# Status (updated 2026-11-14 by engine)

## Branches and PRs
- **main**: live game + /beta/. Beta = campaign-engine 960a0f7.
- **campaign-engine**: PR #2 → main (open, for Ankur's review). Contains campaign-v2, story v2, all engine work.
- **campaign-v2**: maps bot's final v2 (ch1 rework, guide data in ch1/ch2/ch4A); fully merged into campaign-engine.
- **campaign-v1**: PR #3 closed (superseded).
- **campaign-v3**: maps bot, b83263a, from campaign-engine d508720. Merged into campaign-engine.

## Done recently
- engine 960a0f7: AI moves to find a clear line instead of waiting; campaign map "Test a chapter" (any chapter, enemy personalities, Lab knobs apply to story; never touches the save). PR #3 closed.
- engine e04cd99: campaign-v3 merged; campaign map fork bug fixed (ch5 opens after ch4A); guide overlay off switch `?guides=off`. Browser run ch1→ch5 clean, guide-ui clean, §11 15/15, 75 tests.
- campaign-v3 (maps): no objective lines on guided beats; workarounds for gaps 1–6, 8, 9 removed (ch1 rams use `seg`, ch2 fallback is a 5-hit `from_mine` charge, ch4A locks have a `reason`); ch3's round-21 tail fixed (8 or 11 rounds). ALL CHECKS PASSED, 40/40 games finish every chapter, §11 guide tests 15/15, 75 tests pass.
- campaign-v2 final merged: all 5 chapters build, ALL CHECKS PASSED, 40/40 games finish each; guides show in ch1, ch2, ch4A with no errors. 75 tests pass.
- Engine gaps 1–6, 8, 9 from campaign/MANIFEST.md fixed (7 not a bug). See docs/campaign-engine.md "Combat v2".
- Move guides (campaign/GUIDE_PROPOSAL.md) implemented: lifecycle, `guideView`, map overlay, taps. docs/campaign-engine.md "Move guides".
- All 5 chapters load and finish in engine_check. 74 tests pass.

## In progress / waiting
- story: scene editor `story/editor.html`; no text in art (see to-story.md).
