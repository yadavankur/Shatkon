// The view filter: takes the full game state and returns only what one player
// is allowed to know. Screens and AI players are given this, never the raw state.
// Pass "all" instead of a player number for a referee's view of everything.

import { current, footprint, workingParts, hullPct } from './state.js';
import { sensorOf, signatureOf, linkRange, flareOf, whySeen, eyes, sigBreak, netMoved, motionSig, contactsFor } from './detect.js';
import { scanInfo, scanRadii } from './scan.js';
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
      // detection tier for enemies: 2 = located, 3 = full readout (from a fresh scan)
      tier: open ? 3 : s.segs.every((_, i) => intel[i] && intel[i].round >= state.round - 1) ? 3 : 2,
      hull: open ? hullPct(state, s) : null,
      scan: mine ? scanInfo(state, s) : null,
      scanR: mine && netMoved(state, s) >= 1 ? scanRadii(state, s) : null,
      motionSig: open ? motionSig(state, s) : null,
      sigBreak: open ? sigBreak(state, s) : null,
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
    contacts: all ? [] : contactsFor(state, p, vis),   // fuzzy contacts: "something is roughly here"
    news: pl.feed.filter((e) => e.n >= pl.readSeq && e.n < pl.turnSeq),   // what happened since this player's last turn
    // everything of this player's that can see, and how far: used to draw the edge of the fog
    eyes: state.ships.filter((s) => !s.dead && s.owner === p).concat(state.objs.filter((o) => o.owner === p && rules.munitions[o.kind].reports))
      .map((o) => ({ id: o.id, cells: cellsOf(o), range: eyes(state, o) })),
    shownSensor: rules.det.shownSensor,
    objective: rules.objective, scores: state.players.map((x) => x.score || 0), turnLimit: rules.turnLimit,
    // story chapters: the current objective, ships the player can't command, tech switched on mid-battle
    story: state.script ? { chapter: rules.campaign.id, objective: state.script.objective,
      locked: state.script.locks.filter((l) => l.ship && (l.actions === 'all' || !l.actions)).map((l) => l.ship), auto: state.script.auto || [],
      // ships with some orders forbidden (e.g. "guns cold"): { name: { actions: [...], reason } }
      limits: Object.fromEntries(state.script.locks.filter((l) => l.ship && Array.isArray(l.actions) && (l.until === undefined || l.until === 'end' || !state.script.fired[l.until])).map((l) => [l.ship, { actions: l.actions, reason: l.reason || null }])), unlocked: Object.keys(state.script.unlocked).filter((k) => state.script.unlocked[k]),
      result: state.script.result } : null,
  };
}
