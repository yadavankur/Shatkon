# Frontier: economy mode (third rapid experiment)

Rapid Opus plus an economy. The full design draft is in the GameDev project (`claude/shatkon-economy-mode-draft.md`); this page records what is built.

**Where.** Play → Frontier, or `play.html?board=rapid_frontier`. Board: `rules/rapid/rapid_frontier.yaml` (Rapid Opus's fleet and formation, two more asteroid pairs). Engine: `engine/economy.js`, called once at the end of each tick by `rapidTick`. It does nothing unless `rules.rapid.economy === 'on'`, so Rapid Opus is unchanged.

## Slice 1: money, with nothing to buy yet (built 23 Nov 2026)

Salvage (◈) is one purse for the fleet, hidden from the enemy (`earned` events are seen only by their own side). Paid at the end of each tick, in this order, up to the cap:

| Source | Pays | Setting / board key |
|---|---|---|
| First time a ship of yours is on or past your line | 3, once a game | `econ.cross` |
| Enemy ship destroyed (a ship that went silent doesn't count) | 2 a segment | `econ.kill` |
| Each of your ships on or past the line | 1 a tick | `econ.hold` |
| A hex your side has never entered, in the enemy's half (past the centre row) | 1, once per hex per side | `econ.newHex` |
| ...next to an asteroid | +1 | `econ.asteroid` |
| Cap a tick | 6 | sheet: Income cap 4 / 6 / 10 |
| New ground in your own half | pays nothing | sheet: Earn at home no / yes |

Starting hexes count as entered. When the cap cuts a tick short, items are paid in the order above.

**State.** `state.econ = { purse, earned, crossed, seen, perTick }`, all per side; `seen[p]` is an object of hex keys. It is part of the state hash, so a battle log replays to the same purses.

**Screen.** The ◈ purse sits by the tick ring (tap/hover for how it's earned). "+n" floats up from each ship that earned. Enemy-half hexes your side hasn't entered have a faint dashed gold outline; hexes by an asteroid are brighter. Settings sheet: Economy on/off, Income cap, Earn at home, above the rapid settings (kept in localStorage `shatkon.econ`).

**Checked.** `tests/economy.test.js` (10 tests), 243 tests pass. Headless Chrome at 844x390: sheet, purse, outlines, a +4 float when a scout reached the line, no console errors.

**First numbers** (`node tools/frontier_econ.mjs 10 100`, computer v computer, seeds 900–909):
- All 10 games were draws at the tick limit (as in Rapid Opus).
- Average salvage a game: 16.5 and 18.5. Almost all of it came from kills (136 and 130 over the 10 games) and holding the line (25 and 39). New ground paid only 1 and 7: the computer doesn't know about money, rarely goes past the centre row, and crossed first in only 4 of 20 side-games.
- First pay around tick 18. The cap cut 1 tick in 184.
- So the computer can't test the economy until it has styles (slice 5): it never goes where the money is.

**Seen along the way (not changed here).** On both rapid boards the computer's lead scout makes a contact on tick 1 (the scouts start 12 rows apart and move 2), so the fast opening lasts one tick in computer games.

## Next slices
2. Heatmap. 3. Turrets. 4. Upgrades and resupply. 5. Computer styles (rush / boom / turtle) and the triangle runs.
