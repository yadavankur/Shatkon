// The same game seen from the other side: player 1 and player 2 swapped. The play screen always lets
// "player 0" choose, so for "me v me" it lets you choose player 2's action on swapSides(game) and then
// resolves the tick on the real game. Ship ids and hexes don't change, so an action chosen on the
// swapped game is the same action for the real player 2. (Nothing here is ever resolved: rapidTick
// only runs on the real game.)
const copy = (state) => { const { rules, ...r } = state; const s = structuredClone(r); s.rules = rules; return s; };

const flip = (v) => (v === 0 ? 1 : v === 1 ? 0 : v);
const rev = (a) => (Array.isArray(a) && a.length === 2 ? [a[1], a[0]] : a);

export function swapSides(state) {
  const s = copy(state);
  s.players = rev(s.players);
  for (const x of s.ships) x.owner = flip(x.owner);
  for (const o of s.objs) o.owner = flip(o.owner);
  s.winner = flip(s.winner);
  s.events = (s.events || []).map((e) => ({ ...e, seenBy: (e.seenBy || []).map(flip), ...(e.player === 0 || e.player === 1 ? { player: flip(e.player) } : {}) }));
  if (s.rapid) for (const k of ['sign', 'ever', 'lastScan']) if (s.rapid[k]) s.rapid[k] = rev(s.rapid[k]);
  if (s.econ) for (const k of Object.keys(s.econ)) s.econ[k] = rev(s.econ[k]);
  if (s.lastTurn && s.lastTurn.acts) s.lastTurn.acts = rev(s.lastTurn.acts);
  if (s.flight) s.flight = s.flight.map((f) => ({ ...f, objs: (f.objs || []).map((o) => ({ ...o, owner: flip(o.owner) })), vis: rev(f.vis) }));
  s.swapped = !state.swapped;
  return s;
}
