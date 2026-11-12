# Shatkon

A two-player tactical game on a hex board: chess meets fog of war meets space meets battleship.
This repository holds the rule files and a viewer for them. There is no game engine yet.

## What is here

| Path | What it is |
| --- | --- |
| `play.html` | The game. Play both sides on one screen, or on two phones by swapping turn codes. |
| `index.html` | The rule viewer. One self-contained page that shows the rule files. |
| `rules/` | The rule files: the world (physics and parts), the map, and the fleets. `rules/index.yaml` lists which ones are loaded. |
| `engine/` | The game logic. No screen code in here. |
| `ui/` | The play screen. No game rules in here. |
| `tests/` | Automated tests for the engine. |
| `lib/` | The YAML reader used by both pages. |

## Playing

Open `play.html` from GitHub Pages. It needs to be served from a website, so it will not run by double-clicking the file.

- **One screen:** leave the seat on "Both players" and take turns.
- **Two phones:** one player starts a new game, taps "Show game code" and sends it. The other pastes it under "Load a game code". Each of you picks your seat. From then on, ending a turn gives a short turn code to send; the other player pastes it to play that turn on their phone.

Each phone holds the whole game, so the fog of war relies on neither player looking at the other seat.

## How the engine is laid out

| File | Job |
| --- | --- |
| `engine/hex.js` | Hex geometry: distance, steps, lines. A different kind of space would replace this file. |
| `engine/rules.js` | Reads the rule files, prices fleets, and reports every problem it finds. |
| `engine/state.js` | The game state and helpers to read it. |
| `engine/detect.js` | Sensors, stealth, flare, comms networks, and what each player knows. |
| `engine/damage.js` | Hits, explosions, ship death, the win check. |
| `engine/actions.js` | Move, fire, launch, scan, detonate. |
| `engine/flight.js` | The flight phase: missiles and drones. |
| `engine/turn.js` | The turn loop. |
| `engine/view.js` | Cuts the full state down to what one player may see. |
| `engine/query.js` | "Where can this ship go? What can it shoot?" |
| `engine/codec.js`, `engine/sync.js` | Turn codes and game codes. |

The engine reads the numbers on each part, not its name. Add a part with `hits` and `range` to the world file and it is a beam weapon; give one `thrust` and it is an engine.

To run the tests: `node --test` (Node 20 or newer, nothing to install).

## Using the viewer

- **On GitHub Pages:** in the repository go to Settings, then Pages, choose "Deploy from a branch",
  pick `main` and `/ (root)`, and save. After a minute the viewer is live at
  `https://<your-username>.github.io/<repository-name>/` and reads the `rules` folder by itself.
- **On your own device:** open `index.html`, tap "Open files" and choose your `.yaml` files.
  Opened this way the page cannot read the `rules` folder, so it shows built-in examples until you choose files.

## Changing the rules

Edit any `.yaml` file and reload the viewer. Lines starting with `#` are notes, and the viewer shows them next to the value they describe.

To add a new file, put it in `rules/` and add its name to `rules/index.yaml`.

## How the viewer decides what to draw

The viewer knows no game rules. It only looks at the shape of the data:

- A group of simple values becomes a list of names and values.
- A group of similar entries becomes a table.
- A list of `[q, r]` coordinates becomes a small hex drawing.
- Anything with a `shape` and a `radius` is treated as a board, and a "Board" tab appears.
- Any list of things with an `at: [q, r]` position is drawn on the board, except lists called `hull`, which are a ship's own layout.
- An entry with an `edge` and a `depth` is shaded as a zone.
- `copy_of: <name>` shows the named entry's pieces again, mirrored when a `mirror...` setting is true.
