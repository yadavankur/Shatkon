# Handoff: notes between the bots

Several workers share this repo. They don't talk to each other directly; they read and write here.

| Worker | Owns | Branch |
|---|---|---|
| **engine** (Claude Code) | engine/, ui/, play.html, tests/, docs/ | campaign-engine |
| **maps** (now Game Dev Story, Grok Bot — Ankur lost access to the maps bot) | campaign/, Experiments practice boards (`rules/rapid/lab_*.yaml`) | short-lived branches from main |
| **story** | story/ | zip, or story-vN |
| **gamedev** (Game Dev Story, Grok Bot) | ship art (ui/ships.js, ui/frigate.js, gallery), engine fixes and tools by agreement | facelift-*, engine-fixes, battle-log |
| **Muse** (new 27 Nov) | handoff housekeeping (archived the old entries); anything else still to be agreed with Ankur | short-lived branches from main |

## Files
- `STATUS.md`: the one-page state of the project. Whoever finishes something updates it.
- `archive/`: older handoff entries, moved here to keep the live files short. Nothing is deleted.
- `to-engine.md`, `to-maps.md`, `to-story.md`, `to-gamedev.md`: each worker's inbox.

## Rules
1. **Read your inbox and STATUS.md first** at the start of every session.
2. **To ask or tell someone something,** add an entry to the **top** of their inbox:
   ```
   ## 2026-11-14 · from engine · Guides are live
   - what changed / what you need from them
   - links: file paths, commits, PRs
   Status: open
   ```
3. **When you've handled an entry,** change `Status: open` to `Status: done (<commit or one line>)`. Don't delete entries. Trim anything older than about a month.
4. **Write it on main** (this folder only, via a small PR) so everyone sees the same mailbox whatever branch they're on. If you can't, put it on your own branch and tell Ankur the path.
5. **Branch from the latest origin/main** (`git fetch` first). Feature branches like campaign-engine are merged and stale once their PR lands; check `gh pr list --state all` before trusting branch notes.
6. **Two workers, one file:** if your change touches a file another open PR changes, say so in that worker's inbox; the later PR rebases after the first merges. Ankur merges, or a bot he has said may (Claude in the gamedev chat merges its own PRs and ones it has reviewed).
7. Keep entries short: facts, paths and asks, not essays.
8. **Sign off.** End every inbox entry, STATUS entry and PR description with your name, e.g. `— Muse` or `— Claude (gamedev chat)`, so later readers know which bot wrote it. Nothing unsigned should read as Ankur's own words.
9. **Commit under your own name** (e.g. `git -c user.name="Muse" commit …`), not Ankur's, so `git log` shows who made each change.
