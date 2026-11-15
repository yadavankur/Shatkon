# Status (updated 2026-11-15 23:45 Sydney by gamedev)

## Branches and PRs
- **main is the only branch** (39577f7, 15 Nov 23:40 Sydney). Merged today: #19 engine-fixes, #23 battle-log, #20 ship facelift, #22 move markers, #25 feature-campaign-fixes. All other branches were deleted (every one was fully merged). 98 tests pass.
- **Rule for every worker:** start new work from the latest main (`git checkout main && git pull`), use a short-lived branch, open a PR to main, delete the branch after merge.
- **Heads-up:** feature-campaign-fixes was made directly in beta/ (Ankur's playtest), so beta/ now has changes the root game does not (ship panel, halos, outlines, animated moves, ch1 redeploy, Kestrel refit). Do not refresh beta/ from the root game without carrying these over first.

## Older notes (14 Nov, before PR #2 merged)
- **main**: live game + /beta/. Beta = campaign-engine 960a0f7.
- **campaign-engine**: PR #2 → main (open, for Ankur's review). Contains campaign-v2, story v2, all engine work.
- **campaign-v2**: maps bot's final v2 (ch1 rework, guide data in ch1/ch2/ch4A); fully merged into campaign-engine.
- **campaign-v1**: PR #3 closed (superseded).
- **campaign-v3**: maps bot, b83263a, from campaign-engine d508720. Merged into campaign-engine.

## Done recently
- engine-fixes (PR, 15 Nov): undo is refused once a move reveals anything (sighting, lost contact, fuzzy contact, ghost, scan, hit, story beat); a ship hidden in a launch hex no longer blocks it (the missile goes off on it); missiles and drones fly through wrecked segments like beams; the AI reads laser range/hits/falloff from the rules; one hits formula (`beamHits`); game codes are sealed and checked on load; story orders report real bugs as `script_failed`. guide_acceptance 15/15, 86 tests pass. (PR #2 is merged: main = campaign engine.)
- engine 960a0f7: AI moves to find a clear line instead of waiting; campaign map "Test a chapter" (any chapter, enemy personalities, Lab knobs apply to story; never touches the save). PR #3 closed.
- engine e04cd99: campaign-v3 merged; campaign map fork bug fixed (ch5 opens after ch4A); guide overlay off switch `?guides=off`. Browser run ch1→ch5 clean, guide-ui clean, §11 15/15, 75 tests.
- campaign-v3 (maps): no objective lines on guided beats; workarounds for gaps 1–6, 8, 9 removed (ch1 rams use `seg`, ch2 fallback is a 5-hit `from_mine` charge, ch4A locks have a `reason`); ch3's round-21 tail fixed (8 or 11 rounds). ALL CHECKS PASSED, 40/40 games finish every chapter, §11 guide tests 15/15, 75 tests pass.
- campaign-v2 final merged: all 5 chapters build, ALL CHECKS PASSED, 40/40 games finish each; guides show in ch1, ch2, ch4A with no errors. 75 tests pass.
- Engine gaps 1–6, 8, 9 from campaign/MANIFEST.md fixed (7 not a bug). See docs/campaign-engine.md "Combat v2".
- Move guides (campaign/GUIDE_PROPOSAL.md) implemented: lifecycle, `guideView`, map overlay, taps. docs/campaign-engine.md "Move guides".
- All 5 chapters load and finish in engine_check. 74 tests pass.

## In progress / waiting
- **For Ankur to merge: branch `maps-rework-engine`** (16 Nov, PR #28 to main; it contains `variety-study` with the review fixes, `maps-rework`, and the engine for it): ten reworked boards, Comet scout, sleeper mine, decoy emitter, lines of sight that are fair on a mirrored board, and a computer that no longer plays the same game every time. Start at `beta/docs/maps-rework-engine.md`. Merging changes beta for players (see the PR).
- **Reviewed: branch `variety-study`** (16 Nov, pushed, no PR of its own): Stage 1 of the variety study, two new ship kinds (courier, proximity mine) and ten hand-playable boards (`beta/boards.html`). Reviewers start at `handoff/REVIEW-variety-study.md`.
- **Variety study** (16 Nov, branch variety-study, pushed; corrected after review on `maps-rework-engine`: the seat effect in finding 1 was mostly the start spots): Stage 1 screening done, 6,100 games across fleets of 1 to 5 ships, 47 rule variants and 12 pilots. Waiting for Ankur to pick the Stage 2 cells. Findings and candidates: `beta/docs/balance-evidence.md`; summary in to-gamedev.md.
- **balance-and-ai** (16 Nov, PR #27 open to main, beta/ only; everything in it is also in `variety-study` and `maps-rework-engine`, so #27 can be closed once that PR merges): computer opponent with three personalities (aggressive, balanced, defensive) that moves for a shot instead of waiting; missiles wreck a segment, salvo launches; fleet-against-fleet simulation tools (`tools/sim.mjs`, `scenarios.mjs`, `counter.mjs`, test fleets in `beta/rules/sim_fleets.yaml`). Moving now beats sitting still 66 to 73% (the old computer: 22%). 110 tests pass. Results table, bugs not fixed and open questions: to-gamedev.md.
- **feature-campaign-fixes** (now merged into main as #25; made directly in beta/): full-screen board with a ship panel instead of the ship strip, halos on ships you can command, ship outlines, animated ship moves and rams, ship art option, symmetric-hull rule, ch1 redeployed, Kestrel refit reshaped. Not yet on campaign-engine: a beta refresh from that branch would undo it. See to-maps.md and to-story.md.
- story: scene editor `story/editor.html`; no text in art (see to-story.md).
