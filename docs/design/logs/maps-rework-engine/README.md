# Logs for docs/design/maps-rework-engine.md

Made on branch `maps-rework-engine`, 16 Nov 2026. Each file is the unedited output of the command on its first line here.

| File | Command |
|---|---|
| `boards-both-20.txt` | `node tools/boards.mjs --both --games 20 --events` |
| `turned-now.txt` | `node tools/boards.mjs --turned --games 10 --board 01_first_light,04_the_dogleg,05_kings_guard,07_beacon_hill` |
| `turned-no-variety.txt` | the same with `--set ai.variety.tie_break=0 --set ai.variety.opening_lanes=false` |
| `mirrors-no-variety.txt` | `node tools/boards.mjs --both --games 20 --board <the four mirrors> --set ai.variety.tie_break=0 --set ai.variety.opening_lanes=false` |
| `switches.txt` | `node tools/boards.mjs --both --games 20 --board <boards> --set <one rule off>`; the `--set` used is printed above each block |

Seeds are 1 to N for every board. The "before" figures in the document are the same `--both` count on `origin/maps-rework` at 03b3fc1, taken with a scratch copy of the seat-swap that is now `--both`.
