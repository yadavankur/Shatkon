# Scanning and defence variants

16 Nov 2026, Stage 1 screening (about 10 games a cell). Numbers are wins-losses-draws for side A, from the `rules_a`, `missiles`, `scan_b` and `humans` suites in `docs/design/variants-results.md`. All pilots are the computer, which matters most for scanning: the computer scans only while it has not found a big enemy ship, and seldom after.

## What a scan does today (checked in `engine/scan.js` and `actions.js`)

- Costs 1 command point, once per ship per turn, and only on a turn the ship has moved.
- Has a clear ring and a faint ring. They grow the further forward the ship is: [2, 4] near home, [4, 7] in mid-field, [6, 10] from the centre line on. The clear ring is never wider than the ship's sensor range + 2.
- Inside the clear ring every enemy ship and object is revealed until the end of the next round, **and every part in every segment is read out** (what it is and how damaged). So "a scan reveals the segment layout" and "a scan shows which segment holds point defence or a magazine" are already true at close range.
- Inside the faint ring it gives a rough contact only.
- It lights up the scanner: +2 signature until the end of the next round.

## Scan variants

| Variant | Rule changed | Cost to the scanner | Result against baseline (same seeds) | Label |
|---|---|---|---|---|
| `scan_wide` | rings [4,7], [6,10], [8,13]; clear ring up to sensor + 6 | as now | Six reference fights: within one game in five; mixed5 aggressive against defensive 8-2 to 5-5. With the scanner pilot: 2-8, 4-6, 3-7, 6-4 (baseline 5-5, 5-5, 4-5-1, 5-5) | unclear; leaning worse for the pilot that scans most |
| `scan_free` | scan costs 0 points | none | Within one game in all six fights; scanner pilot 5-5, 5-5, 5-4-1, 6-4 | unclear |
| `scan_cost_2` | scan costs 2 points | two of a turn's three orders | Within one or two games in all six | unclear |
| `scan_quiet` | scanning does not light the scanner | none | Within one game in all six | nil |
| `scan_loud` | scanning adds +4 signature | easier to see for a round | stock against sitter 8-2 to 6-4; the other five identical | unclear |
| `scan_exposed_2`, `scan_exposed_3` | the scanner stays lit 2 or 3 rounds (new switch `detection.flare_rounds.scan`) | lit longer | Identical in 10 of 12 cells, one game different in 2 | nil |
| Layout readout at close range | none needed: already in the game | | Used by the hunter and scanner pilots, below | |
| Readout of point defence and magazines | none needed: already in the game | | The computer already sends missiles to targets with no working point defence when it has a readout | not separately measured |

**Pilots that use the readout** (`humans` suite, against balanced):

| Pilot | What it does | Result | Label |
|---|---|---|---|
| scanner | scans a ship it has not read before shooting, then prefers the ship with most weapons and least protection, and the segment with a weapon and no shield | 5-5, 5-5, 4-5-1, 5-5 | unclear |
| hunter | same target choice, no extra scans | 5-5, 5-5 | unclear |
| baiter | sends its smallest armed escort 4 hexes ahead | 6-4, 4-6, 2-8, 0-10, 2-8 | leaning worse; one clear loss |
| decoy | runs unarmed ships 3 hexes ahead | 5-5, 5-5, 3-7 | unclear |

**What this says about scanning.** None of the scan variants changed a result by more than noise. With the computer flying, the scan is not where games are decided: fights last 3 to 7 rounds, ships see each other without scanning once they close, and a scan spends a third of a turn. Whether a costlier or riskier scan is *interesting for a person* cannot be read from these tables. That is untested.

**Untested:** a scan that needs no move first; a scan whose readout is partial (layout only, or weapons only); scan variants on a bigger board, where finding the enemy takes longer.

## Detection and stealth

| Variant | Rule changed | guns3 against snipers3 | stealth4 against guns4 | Label |
|---|---|---|---|---|
| baseline | | 7-3 | 5-5 | |
| `sensors_long` | every core sees 4 hexes (was 2) | 10-0 | 3-7 | one clear |
| `sensors_short` | every core sees 1 hex | 4-6 | 3-7 | leaning / unclear |
| `stealth_off` | stealth parts hide nothing | 10-0 | 2-8 | one clear, one leaning |
| `stealth_strong` | a stealth part hides 2, floor 1 for every hull | 8-2 | 6-4 | unclear |
| `fuzzy_far` | rough contacts from 6 hexes beyond sight (was 3) | 6-4 | 5-5 | nil |
| `fuzzy_none` | no rough contacts | 7-3 | 3-7 | unclear |
| `still_lit_1`, `still_lit_3` | a ship that did nothing has +1 or +3 signature | 8-2, 9-1 | 4-6, 3-7 | leaning at +3 |
| `loud_guns` | firing lights the shooter even on a miss | 7-3 | 5-5 | nil |

Stealth fleets depend on stealth: take it away, or give everyone longer eyes, and the gun fleet wins outright. Stronger stealth did not help the stealth fleet as much as weaker stealth hurt it.

## Missile and defence levels

| Variant | Rule changed | Result | Label |
|---|---|---|---|
| Warhead 3, 5, 6, 9 hits, old launch rules | `munitions.missile.hits`, no salvo, launch from 5 | missiles3 against guns3 0-10 at every level; missile5 against mixed4 2-8 at every level; wolfpack4 against shields3 1-9 or 2-8 | nil |
| Warhead 3, 5, 6, 9 hits, salvo + launch from 8 | `munitions.missile.hits` | 1-9 at every level; 4-6 at every level; 2-8, 3-7, 3-7, 4-6 | nil to unclear |
| Wrecks the segment (baseline) | `munitions.missile.wrecks_segment` | 1-9, 4-6, 2-8: the same as 3 hits | nil on win rate |
| Salvo only | `actions.launch.salvo` | 0-10, 2-8, 1-9; launches 2.7, 0.2, 1.0 | nil |
| Launch from 8 hexes only | pilot habit, not a rule | 0-10, 4-6, 3-7; launches 7.0, 2.9, 3.3 | clear on launches |
| `pd_none` | point defence stops nothing | identical to baseline in all three | nil |
| `pd_2` | each point defence stops 2 a round | identical in two, 3-7 for 4-6 in one | nil |
| `shield_2` | a shield soaks 2 hits | within one game in all six reference fights | nil |
| `shield_off` | shields soak nothing | within one game in all six | nil |
| `magazine_1`, `magazine_3` | a destroyed loaded magazine wrecks its segment and does 1 or 3 hits to neighbouring segments (new switch `damage.magazine_explodes`) | guns3 against missiles3 6-4 to 8-2 and 9-1; stock against sitter 8-2 to 9-1; four other cells within one game | one clear cell |
| Blind fire (no lock) | pilot habit; the rule already allows it | missile5 blind against guns4 8-2; against missile5 6-4 | leaning |
| Anti-missile fleet (point defence and shields on every ship) | fleet design | 7-3, 7-3, 8-2 against the three missile fleets | leaning in all three |

**Where missiles are lost** (baseline, per battle, the missile side): missiles3 against guns3 launched 7.7 of 15: 1.9 landed, 1.5 shot down by lasers, 0.9 out of fuel or off the board, 0 stopped by point defence, 3.4 caught in another blast or still flying at the end. missile5 against mixed4 launched 2.8 of 15: 0.5 landed, 1.0 shot down, 0.2 stopped by point defence. wolfpack4 against shields3 launched 3.7 of 12: 1.1 landed, 1.6 shot down.

**What this says.** Most missiles never leave the ship, because the game ends first. Of those that do, lasers shoot down as many as land. Point defence is nearly irrelevant because few missiles reach a hull that has it. Hit location matters only once magazines explode, and then only against ships that carry missiles.

**Untested:** point defence that covers neighbouring ships; missiles that cannot be shot down by lasers; magazine explosions in the story chapters; any of this against a human.
