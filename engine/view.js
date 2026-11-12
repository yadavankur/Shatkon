// The view filter: takes the full game state and returns only what one player
// is allowed to know. Screens and AI players are given this, never the raw state.
// Pass "all" instead of a player number for a referee's view of everything.

import { current, footprint, workingParts } from './state.js';
import { sensorOf, signatureOf, linkRange, flareOf, whySeen, eyes } from './detect.js';
import { cellsOf } from './state.js';
import { thrustIncome, fleetSegs, moveCap } from './actions.js';

export function view(state, who) {
  const all = who === 'all', p = all ? current(state) : who, pl = state.players[p], rules = state.rules;
  const vis = new Set(pl.vis);
  const ships = [];
  for (const s of state.ships) {
    if (s.dead) continue;
    const mine = s.owner === p, open = mine || all;
    if (!open && !vis.has(s.id)) continue;
    const intel = pl.intel[s.id] || {};
    ships.push({
      id: s.id, owner: s.owner, mine, seen: mine || vis.has(s.id), pos: s.pos.slice(), cells: footprint(s),
      name: open ? s.name : null, flagship: open ? s.flagship : null,
      segs: s.segs.map((sg, i) => ({
        off: sg.off.slice(), wrecked: sg.wrecked,
        parts: open ? sg.parts.map((x) => ({ t: x.t, hp: x.hp, max: rules.parts[x.t].hp })) : intel[i] ? intel[i].parts.map((x) => ({ t: x.t, hp: x.hp, max: rules.parts[x.t].hp })) : null,
        scanned: !open && intel[i] ? intel[i].round : null,
      })),
      load: open ? { ...s.load } : null,
      sensor: open ? sensorOf(state, s) : null,
      signature: open ? signatureOf(state, s) : null,
      flare: open ? flareOf(state, s) : null,
      why: mine ? null : whySeen(state, p, s),
      link: open ? linkRange(state, s) : null,
      thrust: open ? workingParts(state, s).reduce((n, x) => n + (x.c.thrust || 0), 0) : null,
      moved: open ? state.players[s.owner].moved[s.id] || 0 : null,
      used: open ? { ...s.used } : null,
    });
  }
  const objs = [];
  for (const o of state.objs) {
    const mine = o.owner === p, open = mine || all;
    if (!open && !vis.has(o.id)) continue;
    objs.push({ id: o.id, kind: o.kind, owner: o.owner, mine, seen: mine || vis.has(o.id), pos: o.pos.slice(), dir: o.dir, last: o.last || null, fuel: open ? o.fuel : null, target: open ? o.target : null });
  }
  const ghosts = all ? [] : Object.keys(pl.seen).filter((id) => !vis.has(id)).map((id) => ({ id, ...pl.seen[id] }));
  return {
    round: state.round, phase: state.phase, winner: state.winner, toMove: current(state), me: all ? 'all' : p,
    players: state.players.map((x) => x.name),
    board: { radius: rules.board.radius }, terrain: rules.terrain, zones: rules.zones,
    cp: pl.cp, thrust: pl.thrust, canMove: pl.canMove, income: thrustIncome(state, p), segments: fleetSegs(state, p), moveCap: moveCap(state, p),
    ships, objs, ghosts, feed: pl.feed.slice(),
    news: pl.feed.filter((e) => e.n >= pl.readSeq && e.n < pl.turnSeq),   // what happened since this player's last turn
    // everything of this player's that can see, and how far: used to draw the edge of the fog
    eyes: state.ships.filter((s) => !s.dead && s.owner === p).concat(state.objs.filter((o) => o.owner === p && rules.munitions[o.kind].reports))
      .map((o) => ({ id: o.id, cells: cellsOf(o), range: eyes(state, o) })),
    shownSensor: rules.det.shownSensor,
  };
}
