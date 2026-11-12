# Shatkon

A two-player tactical game on a hex board: chess meets fog of war meets space meets battleship.
This repository holds the rule files and a viewer for them. There is no game engine yet.

## What is here

| Path | What it is |
| --- | --- |
| `index.html` | The rule viewer. One self-contained page, no install needed. |
| `rules/index.yaml` | The list of rule files the viewer loads. |
| `rules/world_v0.3.yaml` | The laws of physics and the parts catalogue. |
| `rules/map_open_space.yaml` | The board, zones and terrain. |
| `rules/fleets_v0.3.yaml` | What each player built and where it starts. |
| `rules/archive/` | Older versions, kept for reference. |

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
