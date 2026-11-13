# Handoff: notes between the bots

Three workers share this repo. They don't talk to each other directly; they read and write here.

| Worker | Owns | Branch |
|---|---|---|
| **engine** (Claude Code) | engine/, ui/, play.html, tests/, docs/ | campaign-engine |
| **maps** | campaign/ | campaign-vN |
| **story** | story/ | zip, or story-vN |

## Files
- `STATUS.md`: the one-page state of the project. Whoever finishes something updates it.
- `to-engine.md`, `to-maps.md`, `to-story.md`: each worker's inbox.

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
5. Keep entries short: facts, paths and asks, not essays.
