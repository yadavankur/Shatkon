# Shatkon

A two-player tactical game on a hex board: chess meets fog of war meets space meets battleship.
This repository holds the rule files, the game engine, the game itself and a viewer for the rules.

## What is here

| Path | What it is |
| --- | --- |
| `play.html` | The game: against the computer, pass and play on one device, or on two phones by swapping turn codes. Its Lab tab is a ship designer and test range. |
| `index.html` | The rule viewer. One self-contained page that shows the rule files. |
| `rules/` | The rule files: the world (physics and parts), the map, and the fleets. `rules/index.yaml` lists which ones are loaded. |
| `engine/` | The game logic. No screen code in here. |
| `ui/` | The play screen (`play.js`), the board drawing (`board.js`) and the Ship Lab (`lab.js`). No game rules in here. |
| `tests/` | Automated tests for the engine. |
| `lib/` | The YAML reader used by both pages. |

## Playing

Open `play.html` from GitHub Pages. It needs to be served from a website, so it will not run by double-clicking the file.

Pick a mode at the top right:

- **Vs computer** (easy or normal): you are Player 1; the computer plays Player 2 and only uses what its own fleet can see.
- **Pass and play:** one device, each player sees only what their own fleet sees, with a hand-over screen between turns.
- **Both players (open):** one screen, everything visible. Enemy pieces the player to move cannot see are drawn faded.
- **Two devices:** one player starts a new game, taps "Show game code" and sends it. The other pastes it under "Load a game code". Each of you picks your seat. From then on, ending a turn gives a short turn code to send; the other player pastes it to play that turn on their phone.

Each phone holds the whole game, so the fog of war relies on neither player looking at the other seat.

On the board: tap a ship (or its card above the board) to select it and zoom in. Green markers are places it can move; tap one to preview the move, tap again to go. The turn ends by itself when the command points run out. Zoomed in, each segment shows its three bays and three mounts, coloured by part. The darker part of the board is outside your sensor range.

Detection has three tiers: a red fuzzy circle means something is roughly there, ◆ after a ship's name means you know exactly where it is, and ▣ means a fresh scan shows every part. A ship's signature is its size minus its working stealth parts (down to a floor), plus flare from firing, launching or scanning, minus one for sitting still and plus one for a big move. A ship can scan once per turn and only after it has moved; the further forward it is, the bigger the scan rings. The **?** button explains all of this in the game. Moves and launches that revealed nothing new can be undone (Ctrl+Z on a desktop).

The **Lab** tab lets you design two ships, see who spots whom from how far, try "what if" changes, fight sandbox duels or a Monte Carlo series of them, change rule numbers, and then play a real game with your designs. Every number in it comes from the same engine as the game.

The default map is `rules/map_skirmish.yaml`, a small board where the fleets meet within a round or two. `rules/map_open_space.yaml` is the big one; the fleets file says which starting positions to use for it.

## How the engine is laid out

| File | Job |
| --- | --- |
| `engine/hex.js` | Hex geometry: distance, steps, lines. A different kind of space would replace this file. |
| `engine/rules.js` | Reads the rule files, prices fleets, and reports every problem it finds. |
| `engine/state.js` | The game state and helpers to read it. |
| `engine/detect.js` | Sensors, stealth, flare, comms networks, and what each player knows. |
| `engine/damage.js` | Hits, explosions, ship death, the win check. |
| `engine/actions.js` | Move, fire, launch, scan, detonate. |
| `engine/scan.js` | How strong a scan is from where the ship stands. |
| `engine/flight.js` | The flight phase: missiles and drones. |
| `engine/turn.js` | The turn loop. |
| `engine/view.js` | Cuts the full state down to what one player may see. |
| `engine/query.js` | "Where can this ship go? What can it shoot?" |
| `engine/codec.js`, `engine/sync.js` | Turn codes and game codes. |
| `engine/ai.js` | The computer opponent: `computerMove(game, seat, level)` returns its next action, using only that seat's view. |

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
