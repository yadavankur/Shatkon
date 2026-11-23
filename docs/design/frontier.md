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

**Fix (slice 2 PR):** the `earned` event's amount was stored as `n`, which `emit` overwrites with the event's sequence number, so the log and the message line showed nonsense amounts (the purse, floats and tests were right). It is now `amount`.

## Slice 2: the threat heatmap (built 23 Nov 2026)

- **Buy** (bottom right, beside Pass) opens the shop. Only the Heatmap is for sale; Turret, Upgrade and Resupply are listed greyed out as "coming later". Buying is the tick's whole action, `{ type: 'buy', item: 'heatmap' }`, written `b:heatmap` in the tick log. It is paid before the tick's shots, so this tick's earnings can't pay for it, and the enemy gets no event.
- **Price** ◈ 6 (setting: Heatmap cost 4 / 6 / 8). It shows on your next 2 ticks (`econ.heatTicks`), and a red chip by the purse counts them down.
- **What it shows** (`threatMap(state, p)` in engine/economy.js): every hex an enemy ship you can see right now could hit with a laser next tick, shaded by the hits one shot would do there (falling off by range, +1 attack run if that ship moved last tick), and darker where more than one ship reaches. Numbers (−3, −2×2…) show when zoomed in with labels on. Amber dashes: where a known launcher's missiles could reach in 2 ticks. Built only from what you know: hidden ships and fuzzy contacts don't count; a scanned ship uses its real working lasers and launchers; an unscanned one is assumed to carry the best laser on every segment and no known launcher. It is worked out again each time you look, so it follows enemies you see moving.
- **The free "in enemy reach" numbers on moves are off in Frontier.** While a heatmap is showing, the move options show its numbers instead. Rapid Opus and the other modes are unchanged.
- The computer doesn't buy yet (slice 5).
- **Checked:** 4 new tests (price and refusals, the tick used, 2-tick duration, only visible ships, falloff by range, replay with a purchase); 247 pass. Headless Chrome 844x390: shop, purchase, shading, countdown chip, no console errors.
- **Seen in play:** two unscanned enemy ships at the centre shaded most of the board, because an unscanned ship is assumed to have the best laser (range 9) on all its segments. Scanning first makes the heatmap much sharper. A tuning question for later.

## Next slices
3. Turrets. 4. Upgrades and resupply. 5. Computer styles (rush / boom / turtle) and the triangle runs.
