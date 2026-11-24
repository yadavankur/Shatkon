// Experiments: new rules that are switched off unless a game turns them on, so they can be tried
// without touching the normal game (24 Nov 2026). A game turns them on with the rapid option
// `exp: { <key>: true }` (the Experiments page sets it; boards can too). Switched off, an experiment
// must change nothing: tests/golden.test.js replays recorded games to the same position to prove it.
//
// Each entry: key, label, a one-line description, and where it is used. Designs and numbers:
// GameDev project docs claude/shatkon-frontier-ideas-analysis-2026-11-24.md and ...-round2-2026-11-24.md.
export const EXPERIMENTS = [
  { key: 'ghost', label: 'Ghost on conversion', about: 'A ship that goes silent leaves the enemy chasing where it was: whatever it becomes stays hidden for 2 ticks, even if they were looking right at it.' },
  { key: 'stateMines', label: 'Mines from the ship’s state', about: 'A scout that becomes a mine makes a better one the more it has left: laser and sensor working = smart mine (goes off at 3 hexes, wrecks a segment); laser only = close mine (1 hex, very hard to find); sensor only = lurker (2 hexes, 4 hits); neither = dud (only if a ship moves onto it).' },
  { key: 'ram', label: 'Ram', about: 'A one-hex ship (not the flagship) lunges into a seen enemy up to 2 hexes away and wrecks the segment it hits. The ram is gone; shields don’t stop it.' },
  { key: 'decoy', label: 'Decoys', about: 'A ship with a working emitter puts a decoy on a free hex 2–6 hexes away (at least one empty hex from anything). The enemy sees an ordinary “?” contact; missiles that see it go for it. It lasts 3 ticks; one every 6 ticks per ship.' },
  { key: 'repair', label: 'Repair (shop)', about: 'Buy → Repair, ◈12: one ship’s parts back to full, except wrecked segments and lost lasers. Once per ship every 10 ticks.' },
  { key: 'warp', label: 'Warp (shop)', about: 'Buy → Warp, ◈6: one ship jumps up to 4 hexes to a free spot in your own half, not next to an enemy. Once per ship every 10 ticks.' },
  { key: 'hibernate', label: 'Hibernation (shop)', about: 'Buy → Hibernate, ◈2: a ship next to an asteroid (not the flagship) shuts down. Seen only from 1 hex or by a scan; one part comes back every 4 ticks. Any action, or an enemy within 1, wakes it.' },
];
export const EXP_KEYS = EXPERIMENTS.map((e) => e.key);

// Is experiment `key` on in this game?
export const exp = (state, key) => {
  const r = (state && state.rules ? state.rules : state || {}).rapid;
  return !!(r && r.exp && r.exp[key]);
};
