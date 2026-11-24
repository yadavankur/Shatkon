# Frontier ideas, round 2

24 Nov 2026, following Ankur's notes on round 1 (`claude/shatkon-frontier-ideas-analysis-2026-11-24.md`). As before, everything is priced in **hits** (damage done or avoided), and numbers come from the rule files (`rules/world_v0.4.yaml`, Frontier board, rapid scaling) and the engine code. *(guess)* marks what needs a game to settle.

Decided in your notes, so not re-argued here: buying the wrong thing is part of the strategy (no rebalancing for fairness); missile relay goes to the backlog; cold and heat fronts go to the backlog (later, as rare moving events you can steer with special missiles); missile pods are dropped. Build order: **ghost → smart mine, decoy, ram → repair, warp, hibernation → upgrade prices.**

## 0. A correction to round 1

I said a stopped missile costs the enemy "about 2 hits of fire" because the ship that stopped it is stunned. **That overstates it.** A stun stops one ship, and the fleet still gets its one action a tick from any other ship. So a stun only costs something when the stunned ship was the one that would have fired: the only ship in range, the closest one, or half of a wingman pair.

| Who stopped it | What the stun really costs them |
|---|---|
| Their only ship in range of you | about 2 hits (their whole tick) |
| One of several ships in range | about 0–1 (they fire from another ship, usually from further away) |
| One of a wingman pair | the free second shot (about 2) |

A laser shoot-down is different: it uses the fleet's action for that tick, so it always costs them about 2 hits. Point defence costs them nothing but the stun.

**Option, if missiles still feel weak after a few games:** an intercepted missile also **drops the shield** on the segment it was heading for. Then a laser shot the next tick lands in full. That gives the attacker something concrete in every case.

## 1. Turrets, mines and scanners only after crossing

Your rule: none of these can be bought or made until your side has crossed. Today, conversions already need a one-hex ship past the line, but **turrets can be bought anywhere**, so the rule adds one real restriction.

| Question | Answer |
|---|---|
| Unlocked by crossing once, or only while you hold a ship past the line? | **While you hold one** (like scans). Crossing once would unlock them for good after a single early scout dash, and the centre wouldn't matter again |
| Where can they be placed? | Anywhere your ship is; the unlock comes from holding the line |
| Who does it help? | The side that wins the centre. Rush (first across) gains; turtle loses its "turrets on my own line from the start" plan and must take the centre first |
| Side effect | The first crossing becomes a big moment: it unlocks the economy's best tools. The ◈3 crossing bonus may no longer be needed |

**Verdict:** good. It turns the centre into the thing worth fighting for, which is what chess does with its middle squares.

## 2. Missiles: three kinds, three scenarios

How missiles really work (engine/flight.js, engine/damage.js):
- They fly **2 hexes a tick**, turning at most 60° a hex.
- A missile **keeps its lock while its own seeker sees the target** (2 hexes plus the target's signature, so about 3 for a scout), **or while the launching ship or a comms-linked friend sees it**.
- On impact, the segment hit takes the missile's hits, **outer layers first** (shield, then armour, then guns), and every other segment within 1 hex takes 1 hit (blast).
- Point defence stops 1 missile per ship every 3 ticks: no blast, plus the stun from build #61.

The two targets: a **scout** (dies at 5 hits: shield 1, armour 2, laser 1, core), and the **core segment of a Warden** (6 hits: shield, laser, point defence, sensor, magazine, core; the ship dies with its core).

### Scenario A: it hits

| Missile | vs scout | vs Warden core segment | Notes |
|---|---|---|---|
| Basic (3 hits) | 3: shield and armour gone, scout survives with 2 left | 3: shield, laser and point defence gone | Plus 1 blast hit to each neighbouring segment |
| Advanced (4) | 4: scout left with 1 | 4: also loses its sensor | — |
| Nuke, **shield up** | shield takes the blow: shield down + 3 hits = **4**; scout survives with 1 | 4 | A raised shield turns the Nuke into an advanced missile |
| Nuke, **shield down** | **segment wrecked: scout dead** | **segment wrecked: the core goes, and the ship dies** | The Nuke's real use: knock the shield down first, then Nuke the core |

**The combo:** a laser hit drops the core segment's shield, and the shield stays down for at least 3 ticks (longer while it keeps being hit). A Nuke arriving in that window kills a Warden or a Throne outright. That's the "big ships use missiles" play you described, and it's a real one.

### Scenario B: point defence stops it

| Missile | Damage | Other effect |
|---|---|---|
| Basic | 0 | Stopper stunned for its next tick (see section 0 for what that's worth) |
| Advanced | 0 | same |
| Nuke | 2 hits to the nearest segment | same |

Point defence stops **one missile per ship per 3 ticks**, so:

| Volley at one Warden (one point defence) | Expected damage |
|---|---|
| 1 basic | 0 (stun only) |
| 2 basic, same tick | 3 (one stopped, one hits) |
| 1 basic, then a Nuke the next tick | Nuke hits: 4, or a kill if the shield is down |
| 2 Nukes, same tick | 2 (stopped one) + 4 or a kill |

**Verdict:** firing missiles singly at a ship with point defence is a waste. **Volleys of two, with the decoy (basic) first, are the play.**

### Scenario C: the target moves 2 hexes back just before impact

In rapid mode a ship moves 1 hex a tick (2 in the opening), and **the fleet moves one ship a tick**. So moving one ship 2 hexes back costs **2 of the fleet's ticks (about 4 hits of fire not fired)**.

| Missile | Still locked (its seeker, the launcher or a linked friend still sees the target) | Lock lost (target out of sight) |
|---|---|---|
| Basic | Homes in: arrives **1 tick later**, same damage, and has one more tick to be shot down | Flies straight on: hits whatever is in its path, an asteroid, or burns out (9 ticks of fuel) |
| Advanced | same | same |
| Nuke | same | same |

**What it means:** stepping back almost never dodges a locked missile; it only delays it, and costs the dodger 2 ticks. **Real dodges:** put an asteroid between you and the missile (3 of your 8 missiles on 23 Nov flew into asteroids), break line of sight so the lock is lost, or shoot it down (which costs 1 tick and now a stun).

**So, as you said:** lasers for small ships, missiles for big ones. And the missile game is about **volleys, shield-then-Nuke timing, and rocks**.

## 3. Mines that depend on the ship that made them

Your idea: the mine a ship becomes depends on what still works on it. **One snag: scouts have no stealth part** (a Pawn is core, engine, sensor, laser, shield, armour). The sensor is the nearest match ("it can still feel things coming"), so I've used that.

| Working when it converts | Becomes | Triggers | Effect | Seen from (scout looking) | Rough value *(guess)* |
|---|---|---|---|---|---|
| Laser **and** sensor | **Smart mine** | an enemy within 3; it fires first | shaped charge: wrecks the nearest segment | 1 hex (signature −8) | wrecks a segment: 6–7 hits, or a scout. Covers 37 hexes, 5× today's |
| Laser, no sensor | **Close mine** | an enemy within 1 | wrecks the segment + 4 hits blast (today's naval mine) | almost never (signature −10, no engine, no core) | today's mine, harder to find |
| Sensor, no laser | **Lurker** | an enemy within 2 | 4 hits, no wreck | 1 hex | about 4 × the trigger chance |
| Neither | **Dud mine** | an enemy **moving onto** its hex | 4 hits | 2 hexes | low: a nuisance |

Why it fits: the healthiest scout makes the best mine, so converting a healthy ship is a choice, not just a way to dispose of a wreck. The **ghost** (section 4) is what lets any of them survive the first tick.

## 4. The ghost (agreed)

When a ship converts, the enemy keeps seeing **the ship** where it was, fading out over 2 ticks. Their shots at it hit nothing. The new object starts unseen. That's all; no numbers needed.

## 5. Nebula, and fronts later

**Nebula today** (world file): a ship inside has **sensor −3** (sees less) and **signature −2** (is harder to see). It's static terrain placed by the board. A cold front would be the moving, rarer cousin. Backlogged as you said.

## 6. Repair, warp, hibernation: worked out (nothing is free)

| | Repair (buy) | Warp (buy) | Hibernation (cheap) |
|---|---|---|---|
| Price | ◈12 + your tick | ◈6 + your tick | **◈2** to start; the ship sits out |
| Where | anywhere | jump up to 4 hexes, ending in **your own half** | **next to an asteroid**, not the flagship |
| Effect | one ship: every working part back to full; **wrecked segments and lost lasers stay lost** | the ship lands on a free hex; can't land next to an enemy | one part back every **4 ticks**, outer layer first |
| While it works | — | — | seen only from **1 hex** or by a scan within 3. **Any action, or an enemy coming within 1, wakes it** (repairs so far are kept) |
| Limit | once per ship every 10 ticks | once per ship every 10 ticks | — |
| Worth | a scout from 1 hit left back to 5: **4 hits**, now | saves a ship (5–7 hits) when it works; also pulls a formation together | the same 4 hits as repair, over **12–16 ticks**, for ◈2 |
| The choice | time vs money | — | money vs time, and risk: rocks are places the enemy learns to check |

## 7. Your extras

### Countermeasures (your point-defence buoy idea, and chaff)

Aircraft use **flares** (hot decoys against heat-seeking missiles) and **chaff** (clouds of metal strips against radar-guided ones). Folding #10 and #13 together:

| | Flares (big ships) | Chaff (any ship, as a purchase) |
|---|---|---|
| Use | **automatic**: when a missile comes within 2 hexes of a ship with flares left, the missile is decoyed and lost | the ship drops a cloud on its own hex |
| Load | 2 per ship with a magazine (resupply refills them) | ◈4 + your tick |
| Size | — | **1 hex, for 2 ticks**: lasers can't pass through it, and missile locks on anything inside are broken |
| Worth | 3–4 hits per missile decoyed. It stacks with point defence, so a Throne can shrug off a volley of 3 | saves 2–4 hits, once; small enough that it isn't a wall |
| Verdict | **Yes.** It gives big ships a missile defence that runs out, so volleys and resupply matter on both sides | **Yes, at 1 hex.** Bigger clouds become walls |

### Decoy (your spec)

- **Made by** a ship with a working **emitter** (the existing decoy-emitter part; its rules already pull missiles toward it) or, in Frontier, a converted scout.
- **Placed** by tapping a hex 1–6 hexes from the maker, at least 1 hex from any ship or object. The game shows the hexes you can use.
- **It looks like** a contact the size of the space it fits in (1 to 3 hexes).
- **It lasts** 3 ticks, then the maker waits 3 ticks before the next one (one every 6).
- **It pulls missiles:** a missile whose seeker sees it turns on it.

| Against | What it buys | Worth *(guess)* |
|---|---|---|
| The computer | It fires at any contact it believes: 1–3 wasted shots a decoy | 2–6 hits each time |
| You | You'll learn the tells; only first sightings fool you | low, unless it **pulls a missile volley** |
| Missiles | A launched volley chases it | 3–8 hits saved |
| Cost | Placing it uses your tick | −2 |

**Verdict:** good against the computer and missiles. To fool people, it must look like an ordinary contact (a faint "?"), not a sharp sighting. Your corner-hiding play is exactly how it should be used.

### Snare (your spec)

1 hex, **can't be destroyed**, **invisible to the enemy**, fizzles after 18 ticks. Two things to settle:
- **Its effect.** I'd make it: a ship that enters it is **held for 3 ticks** (can't move; can still fire).
- **Who makes it.** I'd say a conversion or a ◈6 purchase, placed only past the line (your rule 1).

| Placed | Chance an enemy enters it in 18 ticks *(guess)* | Worth |
|---|---|---|
| Open space | low (1 hex on a 469-hex board) | about 0 |
| A gap between two asteroids, or right in front of a ship that must come forward | high | a ship pinned for 3 ticks: free shots, about 6 hits |

**Verdict:** only good at chokepoints. The Frontier board has a few (the asteroid pairs). Worth trying, cheap to build.

### Jammer: how the real thing works, and a version for the game

Real radar jamming has three properties worth copying:
1. **It hides where you are, but not that you're there.** A noise jammer shows on the enemy's screen as a **bearing**: a line pointing at it, without the distance.
2. **Burn-through.** Close enough in, the radar is stronger than the jammer and sees through it.
3. **Home-on-jam.** Some missiles are built to fly down the jammer's own signal.

| Jammer (a converted scout, or a part on big ships) | |
|---|---|
| While on | enemy ships within **4 hexes** can't see or lock onto anything within 4 of the jammer, **except from 1 hex (burn-through)** |
| What the enemy sees | a **line** from each of its ships toward the jammer, no distance |
| How it dies | missiles launched along the line **home on it** (home-on-jam); a scan within 2 finds it; any ship within 1 sees it |
| Limit | runs for 12 ticks, then it's a dead hulk |
| Worth | protects your ships within 4 for 12 ticks; the enemy must spend missiles or close in to find it |

**Verdict:** this is the strongest idea on the list and the most interesting to play against, because it's stealth you can see coming but can't pin down. Keep it in one-on-one, as you want, and build it after the first batch.

### The currency name, and how the economy works now

**How salvage is earned today** (Frontier, per side, end of every tick, at most ◈6 a tick):

| Source | Pays |
|---|---|
| A ship enters a hex your side has never entered, in the enemy's half | 1 (2 next to an asteroid) |
| The first time one of your ships is on or past the line | 3, once |
| **Each ship on or past the line** | **1 every tick** |
| Destroying an enemy ship | 2 per segment |
| Passing (doing nothing) | earns nothing that tick and costs 1 |

So yes, **you already earn for being in the enemy half.** A salvage beacon that also earns there would pay twice. The **treasury ship** version doesn't: one of your ships carries the fleet's purse (or part of it), and **whoever destroys it takes what it carries**. That makes money something you can lose, gives the enemy a target worth hunting, and fits your loot idea. Worth trying later.

**Names.** *Shatkon* is षट्कोण: *shat*, six + *kon*, angle. Some options that grow from it:

| Name | From | Why |
|---|---|---|
| **Kon** (or **Kona**) | कोण, "angle", the second half of Shatkon | Short and cute. A hexagon has six of them, so the coin's symbol is the hexagon. "◈12 kon" |
| **Repex** | rupee + hex | Your idea; easy to say. It does lean on rupee |
| **Shard** | salvage, broken pieces | English, plain, fits "salvage" |
| **Mani** | मणि, "gem, jewel" | Short, cute, a hexagonal crystal; nothing to do with rupees |

My pick: **kon**. It ties the money to the game's name.

### Ram

In story mode the ram is autonomous. For one-on-one: a scout past the line converts into a ram, which **lunges up to 2 hexes into a seen enemy and wrecks the segment it hits** (shields don't stop it). The lunge happens within the same tick, so the enemy can't react.

| | |
|---|---|
| Hits when | an enemy is within 2 hexes and seen |
| Worth | 6–7 hits (a segment), or a kill on a scout or an unshielded core |
| Costs | the scout (5 hits if healthy, about 1 if crippled) + your tick |
| Verdict | **Yes.** Reliable because you choose the target. Best from a crippled scout that's about to die anyway |

## 8. Campaign or one-on-one

Your binary: everything can work in campaign; the question is what's also right for one-on-one.

| Idea | One-on-one | Campaign only | Why |
|---|---|---|---|
| Ghost on conversion | ✓ | | a rule fix |
| Smart / close / lurker / dud mines | ✓ | | the conversion choice is the strategy |
| Decoy | ✓ | | your corner play |
| Ram | ✓ | | simple, decisive |
| Repair, warp, hibernation | ✓ | | economy choices |
| Flares, chaff (1 hex) | ✓ | | the missile counter-game |
| Jammer | ✓ | | your call; strongest idea |
| Snare | ✓ (chokepoints) | | cheap; needs boards with gaps |
| Turrets past the line | ✓ | | rule 1 |
| Heatmap, upgrades, resupply | ✓ | | already in |
| Repair drone | | ✓ | slows the game; better as a map feature |
| Treasury ship | | ✓ (first) | try in a story map before one-on-one |
| Cold and heat fronts, cold missiles | | ✓ (later) | rare events; you said later |
| Missile relay | | backlog | too strong |
| Echo bot (moving mirage) | | ✓ | the decoy covers it in one-on-one |
| Radioactive zone | | ✓ | needs fronts |
| Missile pods | | dropped | — |

## 9. What still needs a game

- How often mines and snares trigger: it depends on where fleets go.
- Whether volleys of two plus flares make missile fights fun or a stalemate.
- Whether the jammer's "line without a distance" is readable on a phone.
- ~~Whether "unlocked while you hold the line"…~~ Dropped (Ankur, 24 Nov): converted pieces just work.
