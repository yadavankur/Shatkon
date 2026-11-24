# Frontier: do the new ideas work? A paper analysis

24 Nov 2026, written while Ankur was away. No game engine was run for this; it uses the numbers in the rule files (`rules/world_v0.4.yaml`, `rules/rapid/rapid_frontier.yaml`, as scaled for rapid mode) and the two Frontier battle logs from 23 Nov. Anything I had to guess is marked *(guess)*.

## 1. How to compare things that aren't alike

Everything below is priced in one currency: **hits** (damage done, or damage avoided).

| Quantity | Value | Where it comes from |
|---|---|---|
| A laser shot at 1–4 hexes | 3 hits (+1 if the ship moved last tick) | `laser: hits 3, loses_1_hit_every 4` |
| ...at 5–8 hexes | 2 hits | same |
| ...at 9 hexes | 1 hit | same |
| **One tick in combat** (what you give up to buy or convert) | **about 2 hits** | most fights happen at 5–8 hexes (both logs) |
| One tick out of combat | about 0 hits, plus a little salvage from moving | nothing to shoot |
| A scout (Pawn) | dies to **5 hits** | shield 1, armour 2, laser, then core |
| A big ship's core segment (Warden, Bastion, Throne) | **6–7 hits** | the ship dies with its core |
| Shield | soaks 1 hit, back after 3 ticks without being hit | `recharge_every 1` × 3 ticks |
| Sight: a scout sees another scout at | 5 hexes (sensor 4 + signature 1) | `sensorOf` / `signatureOf` |
| ...a ship that just hit something | 8 hexes for 3 ticks (+3 flare) | `flare.beamHit 3` |
| A turret (signature −2) is seen at | **2 hexes** | sensor 4 − 2 |
| Missile | 2 hexes a tick, 9 ticks of fuel; 3 hits (basic), 4 (advanced), a segment (Nuke) | munitions, speeds ÷ 3 |
| Point defence | stops 1 missile per ship every 3 ticks | `stops_per_round 1` |
| Salvage income | You: 1.3 a tick (187 over 140 ticks, earning at home on). The computer: about 0.3 a tick | your 23 Nov log; `tools/frontier_styles.mjs` |

**The most important fact: your whole fleet gets one action a tick** (plus the wingman). Fourteen ships don't fire fourteen times, so most of a scout's worth is as a body (5 hits), a pair of eyes and a place to shoot from. **Anything that acts by itself every tick (a turret, a mine, a buoy) is an extra action outside that limit.** That makes autonomous objects the strongest thing the economy can buy, so they need careful pricing.

The second fact: **a purchase is cheap in a quiet tick and dear in a fight.** In combat it costs about 2 hits of lost fire; with nothing to shoot it costs almost nothing.

## 2. Missiles, before and after the stun (build #61)

A launch uses the tick, so it replaces a laser shot worth about 2 hits.

| Target | Before #61 | After #61 (stopped missile stuns the stopper) |
|---|---|---|
| Scout (no point defence), missile not shot down | 3 hits (basic): **better than a 2-hit laser** | same |
| Scout that shoots it down | 0, and they spent a tick doing it (about 2 hits of their fire) | 0 + their tick + their **next** tick (stun): **about 4 hits of their fire lost** |
| Big ship with point defence, first missile in 3 ticks | stopped for free: **0**. Missiles were a waste | stopped, but stunned: **about 2 hits of its fire lost** |
| Same, second missile in the same 3 ticks | 3–4 hits | same |
| Nuke, stopped | 0 | 2 hits + stun: **about 4** |

**Verdict:** with the stun, a missile is roughly equal to a mid-range laser shot even when it's stopped, and better when it lands. A volley of two at a point-defence ship is now clearly good. Missiles arrive 2–4 ticks late, so they suit targets at 6+ hexes. I'd leave their damage alone and watch a few games.

## 3. Purchases

"Net" = the hits the purchase is worth, minus 2 for the tick when it's bought in a fight. Prices are build #62's, or my proposals for the new ones.

| Purchase | Price | What it's worth (hits) | Net in a fight | Verdict |
|---|---|---|---|---|
| **Heatmap** | ◈6 + tick | Only if it stops you moving into fire: maybe one shot avoided (2) over its 2 ticks *(guess)* | about 0 | **Weak.** A careful player can see the same thing. Make it free of the tick, or last 4 ticks |
| **Turret** (now: 1 hit, range 7, seen at 2) | ◈8 + tick + ◈1 per 3 ticks + one laser | 1 hit a tick while an enemy is within 3–7 hexes, and hard to answer, since it's seen at 2 | +5 if 7 ticks of targets; +15 if 17 | **Strong, maybe too strong** where fights happen. **Drop it from a big ship** (the Throne has 5 lasers and fires one a tick, so a spare costs nothing). From a scout you trade a moving 2–3-hit gun for a fixed 1-hit one |
| Upgrade: +1 laser range | ◈10 + tick | One more 1-hit ring at 10 hexes; enemies are rarely seen that far (scouts at 5, a firing ship at 8) | about −1 | **Weak.** Change it to +1 hit in the 5–8 band |
| Upgrade: shields a tick sooner | ◈10 + tick | 1 extra hit soaked per segment per 6 ticks of light fire; nothing under steady fire (it must go unhit) | +1 to +3 on a 6-shield ship over a game | **Fine on big ships, poor on scouts** |
| Upgrade: +1 sensor | ◈10 + tick | Sees scouts at 6, not 5: usually **the first shot** (2–3 hits), again and again | +2 or more | **Best of the four** |
| Upgrade: +1 armour | ◈10 + tick | exactly 1 hit | **−1** | **Bad.** Make it +2, or one plate on every segment |
| **Resupply** | ◈5 + tick | One missile (about 3) | about +1, and **+3 in a quiet tick** | **Good**, if bought between fights |
| **Repair** (new) | ◈12 + tick | One segment's shield and 2 armour/hull: about 3 | about +1 | **OK, but dear for what it gives.** At ◈12, restore a whole scout, or make it ◈8 |
| **Warp** (new: jump 4 hexes, own half only) | ◈6 + tick | Saves a ship about to die: a scout is 5 hits, a Warden 6–7; also regroups a formation for the wingman shot | +3 to +5 when it saves a ship; 0 otherwise | **Good.** Rare but decisive, and the own-half limit stops it being an attack tool |
| **Hibernation** (new: free; next to an asteroid; 4 ticks per part; seen only from 1 hex or by a scan within 3) | free; the ship sits out | Rebuilds a scout (laser, sensor, armour: 3 parts) in **12 ticks**, under 10% of a game | **+4 at no salvage** (the fleet's one action goes to other ships anyway) | **Good, and the cheap partner to Repair.** Two cautions: the flagship mustn't hibernate (an invisible flagship can't lose), and there are only 9 asteroids, so they become places worth scouting |

**What the purchases tell us:** the first upgrades priced every option at ◈10, but they're worth −1 to +3. That spread is why boom's upgrades decided games while armour did nothing. They need different prices or bigger effects.

## 4. Conversions (one-hex ships past the line)

A conversion gives up a scout. A healthy scout is worth about 5 hits as a body plus its eyes. **A crippled scout (1–2 hits left) is worth almost nothing, so conversions are best done from wrecks**, as you were trying to do. The problem was that a wreck has usually just been seen.

**Value = (effect per tick) × (ticks it stays active) × (chance it isn't found) − (what the scout was still worth).**

| Conversion | Effect | Likely value *(guess where marked)* | Problem | Verdict |
|---|---|---|---|---|
| **Ghost** (fix, applies to all) | The enemy keeps a fading contact where the ship was for 2 ticks; the new object starts unseen | Saves the new object from the shot already aimed at that hex (both your scanners were found where the ship had been seen) | none | **Do it first.** Everything else depends on it |
| Scanner buoy (now) | A free scan every tick, rings 4 and 8 | An extra action of pure information, every tick | Signature −2: found at 2 hexes (yours were found at 2 and 4) | OK. Better once ghosted |
| Naval mine (now) | Wrecks a segment (6–7 hits) if an enemy comes within 1 | 6–7 × chance of a trigger | The one mine in your logs **wasn't found** (it lasted 109 ticks), but it **wasn't triggered** either. 7 hexes is a small net on a 469-hex board | Detection isn't the issue, reach is |
| **Smart mine** | Trigger within 2 (19 hexes, 2.7× the area); a shaped charge wrecks the nearest segment | 6–7 hits × about 2.7× the old chance | Could become a no-go zone, but the enemy can scan | **Yes.** This is the one mine worth keeping |
| Stealthy mine | Found later | Little: mines already go unfound | none | **Fold into the smart mine.** Not worth a separate kind |
| **Echo bot** (mirage) | A fake ship contact that crawls 1 hex every 2 ticks and disappears when shot or scanned | Wastes 1 enemy shot (2 hits) each time it's believed; the computer will believe it every time | Against you it's spotted fast; against the computer it's strong | **Yes, cheap and fun.** Let it take 2 shots to dispel |
| Cold front (slows ships inside) | Ships inside move only every other tick | **Close to nothing**: a fleet moves one ship a tick anyway | Doesn't bite in rapid mode | **Change it**: ships inside can't fire (a dampening field), or drop it |
| Radioactive heat | 1 hit every 3 ticks to ships inside, about 7 hexes | 0.33 hits a tick per ship that stays | Only bites ships that sit: holders of the line, turtles, hibernators | **Niche.** A good anti-turtle tool; place it on the line |
| Missile pod | Fires its missiles at the first enemy in range | 3+ hits a missile | **Scouts carry no missiles**, so a converted scout has nothing to fire | Only if conversion opens to Lancers |
| Missile relay | Missiles lock on anything the fleet sees | Makes each launch more likely to land | Small | Later |
| Point-defence buoy | Stops 1 missile every 3 ticks within 2 | 3 hits a stop; the computer fires about 1 missile in 10 ticks *(guess)* | Little to stop | Later |
| Decoy hulk | Keeps the ship's outline for 3 ticks | 1–3 enemy shots wasted (2–6) | Overlaps the echo bot and the ghost | **Fold into the ghost** |
| Snare | Stuns an enemy that moves next to it | Same reach problem as the old mine | small net | No |
| Chaff cloud | Blocks lasers through it for 3 ticks | Saves a retreating group: 2–6 hits, once | Situational | Maybe later, as a purchase |
| Repair drone | Fixes 1 hit a tick for 3 ticks on a friend | 3 hits, from a scout worth about 5 healthy, or about 1 crippled | Only worth it from a wreck | **Yes, from crippled scouts only.** It fits your "the ship's state decides" idea |
| Jammer | Enemies within 3 see 2 hexes less | Wins the first shot nearby (2–3 hits, often) | Strong; a scan beats it | Maybe |
| Salvage beacon | +1 a tick while undiscovered in the enemy half | 30 salvage over 30 ticks: 3 upgrades | Could snowball | Maybe, capped |
| **Ram** | Lunges 2 hexes and wrecks the segment it hits | 6–7 hits for a scout worth 5 (or 1 if crippled) | none: you choose the target, so it's reliable | **Yes.** It's decisive, and it's the "sacrificial hurl" you asked for before |

## 5. What I'd do, in order

1. **The ghost** for every conversion.
2. **What a ship can convert into follows its state.** Healthy scout: smart mine or scanner. No laser: echo bot or ram. Crippled: repair drone or ram.
3. **Repair and warp in the shop. Hibernation as the free alternative to repair.** Flagships can't hibernate.
4. **Reprice the upgrades:** +1 sensor stays at ◈10; +1 armour becomes +2 (or every segment); +1 range becomes +1 hit at 5–8; shields stay as they are.
5. **Heatmap: no tick cost**, or 4 ticks long.
6. **Turrets**: watch them. At 1 hit, range 7 and seen only from 2, a big ship dropping them could be too strong. Teach the computer's turtle to drop them from big ships.
7. **Cold front: change to "can't fire inside" or drop it.** Slowing movement does nothing when each side moves one ship a tick.

## 6. What this can't tell us

- The chance that a mine or snare triggers depends on where fleets actually go. That's why every *(guess)* above needs a game.
- How often a player believes an echo bot. The computer always will.
- Whether turrets become a no-go wall. A few computer runs with the turtle dropping them from big ships would show it.
