# Status (updated 2026-11-14 by engine)

## Branches and PRs
- **main**: live game + /beta/. Beta = campaign-engine 8c9d910 (PR #7).
- **campaign-engine**: PR #2 → main (open, for Ankur's review). Contains campaign-v2, story v2, all engine work.
- **campaign-v2**: maps bot's latest; fully merged into campaign-engine.
- **campaign-v1**: PR #3, superseded by v2 (closing).

## Done recently
- Engine gaps 1–6, 8, 9 from campaign/MANIFEST.md fixed (7 not a bug). See docs/campaign-engine.md "Combat v2".
- Move guides (campaign/GUIDE_PROPOSAL.md) implemented: lifecycle, `guideView`, map overlay, taps. docs/campaign-engine.md "Move guides".
- All 5 chapters load and finish in engine_check. 74 tests pass.

## In progress / waiting
- maps: add `guide:` data to ch1, ch2, ch4A; then drop duplicate `objective:` lines and gap workarounds (see to-maps.md).
