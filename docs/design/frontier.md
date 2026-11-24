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

## Slice 3: turrets (built 23 Nov 2026, Ankur away: decisions below are mine, all easy to change)

- **Buy → Turret** (◈ 8, setting 6 / 8 / 10). With a ship selected, gold **T** chips mark the free hexes next to it; with none, you tap the ship first. Tapping anything else cancels. Buying is the tick's action, written `b:turret.<ship>.<q>,<r>`.
- The ship gives up its working laser nearest that hex (the part is left at 0 hp, marked `dropped`), so a scout that drops its only laser has none left.
- **The turret** (`kind: 'turret'`, engine/economy.js): 2 hp, signature 1, a small sensor (2) whose sight is shared with its side like a drone's. Every tick, with both sides' shots, it fires 2 hits at the nearest enemy ship, missile, drone or turret its side can see within 4 hexes, with a clear line. Hits on ships land with the tick's other laser hits; a missile it hits is destroyed. A laser hit of 1 leaves it at 1 hp; a missile blast destroys it.
- **Upkeep** 1 a turret a tick, **from the tick after it is placed** (otherwise buying with your last 8 salvage made it go dark at once). Paid newest first; a turret that can't be paid **goes dark until a later tick pays for it again** (the draft said the oldest goes dark; I made it temporary rather than permanent). Dark turrets are grey and don't fire.
- Enemy turrets you can see are on the heatmap (2 hits within 4).
- Decided (Ankur, 24 Nov; draft open question 3): turrets can't be picked back up, and they fire at missiles too.
- The computer doesn't buy turrets yet (slice 5).
- **Checked:** 6 new tests (placement and refusals, laser removed, firing, 2 hp, upkeep and going dark and waking, heatmap, replay); 253 pass. Headless Chrome 844x390: Buy → Turret → tap ship → T chips → placed, purse charged; no console errors.

## Slice 4: upgrades and resupply (built 23 Nov 2026)

- **Buy → Upgrade** (◈ 10, setting 8 / 10 / 12), one per ship, for good. Tap the ship (or have it selected), then pick one: **+1 laser range** (every laser on it), **shields back a tick sooner** (every shield), **+1 sensor range** (its core's own sensor; the sensor part already adds 2), **+1 armour** (one plate: the core segment's, else the first).
- How: rapidRules adds an `_up` copy of each part that can be upgraded (`laser_up`, `shield_up`, `core_up`, `armour_up`…) and the upgrade swaps the ship's parts to it, so every rule that reads a part's numbers (firing, the heatmap, the computer) uses the better one, and a scan shows it to the enemy (draft open question 4: yes). They are drawn like the part they upgrade.
- **Buy → Resupply** (◈ 5): +1 missile of the kind the ship carries most, if it has a working launcher and room in a working magazine.
- Log text: `b:upgrade.<ship>.<kind>`, `b:resupply.<ship>`.
- **Checked:** 4 new tests (range, shields, core sensor, armour, refusals, once per ship, resupply room and launcher, replay); 257 pass. Headless Chrome 844x390: Buy → Upgrade → tap ship → four choices → bought; no console errors.

## Idle penalty and cheaper upkeep (23 Nov 2026, PR #59)
- A tick you pass earns no salvage and costs 1 (never below 0). Setting: Idle penalty.
- Turret upkeep 1 every 3 ticks (was every tick). Setting: None / every 3 ticks / every tick. Shown on screen: shop text, a T-count chip by the purse (red when short), Pass shows its cost.

## Slice 5: the computer's styles (built 23 Nov 2026)

`engine/econai.js`. Each side plays a style, chosen at the start: setting "Computer plays" (Random / Rush / Boom / Turtle; `cpuStyle`, and `cpuStyle0` for player 1 in tools). Random picks from the seed. The normal rapid computer still chooses; a style replaces only a move or a pass, so it never gives up a shot, missile or scan. No style passes while it can move.
- **Rush:** buys nothing before tick 20, then resupply (missiles).
- **Boom:** from tick 10 with 20 salvage, upgrades its biggest ships (+1 range, else shields, else armour); otherwise moves ships through the most valuable new ground (asteroid hexes first), away from what it can see.
- **Turtle:** a heatmap when an enemy is within 10 and none is showing; turrets from ships on the line (up to 3, keeping upkeep money); moves that would go well past its line are swapped for ones that don't, unless an enemy is within 6.
- The end screen's Salvage card says which style the computer played.

**The triangle runs** (`node tools/frontier_styles.mjs 12 150`, 12 games a pairing, sides swapped; a game with no flagship lost by tick 150 is judged on enemy segments destroyed):

| Pairing | Result | Outright wins |
|---|---|---|
| rush v boom | boom 8, rush 1, draws 3 | 1 |
| boom v turtle | boom 7, turtle 3, draws 2 | 2 |
| turtle v rush | turtle 8, rush 4 | 0 |

By style: boom won 15, lost 4; turtle 11–11; rush 5–16. Earned a game: boom 51, turtle 41, rush 37.

**So it isn't a triangle yet.** Boom beats both; rush, which should beat boom, loses to everything. Games run to the 150-tick cap (target: under 60), and only 3 of 36 ended with a flagship kill.
- Rush isn't a rush: it is the normal computer that buys missiles late. It never concentrates on the enemy flagship early.
- Boom's upgrades (+1 laser range on its biggest ships) look strong for 10 salvage.
- Turtle spent most of its money on heatmaps (546 salvage over 24 games), which do nothing for the computer (it already acts on everything it sees), and few turrets (4).

Next: tuning, to be decided with Ankur (a real rush at the flagship, dearer or weaker upgrades, the turtle spending on turrets rather than heatmaps).
