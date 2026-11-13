// Story campaigns: turn a chapter file into game rules, and carry results between chapters.
// The engine stays file-agnostic: callers parse the YAML and pass plain objects in.
//
//   const { rules, problems } = buildChapter({ world, map, ships, chapter, campaign, progress });
//   let game = start(rules, seed);          // the chapter's script runs from here
//   ...
//   progress = applyResult(progress, chapter, game);
//
// Files (see the campaign plan): campaign/campaign.yaml, campaign/ships.yaml,
// campaign/chapters/<id>.yaml, campaign/maps/<id>.yaml.

import { buildRules } from './rules.js';
import { setPath } from './script.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const inner = (doc, k) => (isObj(doc) && isObj(doc[k]) ? doc[k] : doc || {});

// A new player's progress through a campaign.
export function newCampaign(campaignDoc) {
  const C = inner(campaignDoc, 'campaign'), st = C.start_state || {};
  return {
    campaign: C.id || 'campaign', completed: [], choices: {}, flags: { ...(st.flags || {}) },
    capabilities: (st.capabilities || []).slice(),
    roster: (st.roster || []).map((r) => (typeof r === 'string' ? { id: r } : { ...r })),
  };
}

// Which chapters can be played now: the start node, and anything a completed node leads to.
export function nextNodes(campaignDoc, progress) {
  const C = inner(campaignDoc, 'campaign'), done = new Set(progress.completed);
  const open = new Set(done.size ? [] : [C.start]);
  for (const n of C.nodes || []) if (done.has(n.id)) for (const x of n.next || []) open.add(x);
  return (C.nodes || []).filter((n) => open.has(n.id) && !done.has(n.id) && !n.locked);
}

// Pick a ship's hull for this chapter: "<id>@<chapter>" beats a carried-over hull (a graft
// made in an earlier battle), which beats the newest earlier "<id>@<chapter>", then "<id>".
function hullFor(shipsDoc, id, chapterId, order, progress) {
  const S = inner(shipsDoc, 'ships');
  if (S[id + '@' + chapterId]) return { ...S[id + '@' + chapterId] };
  const carried = (progress && progress.roster || []).find((r) => r.id === id && r.hull);
  if (carried) return { hull: carried.hull, load: carried.load, flagship: carried.flagship, joined: carried.joined, seams: carried.seams };
  const here = order.indexOf(chapterId);
  let best = null, bestAt = -1;
  for (const k of Object.keys(S)) {
    const [base, ch] = k.split('@');
    if (base !== id || !ch) continue;
    const at = order.indexOf(ch);
    const ok = here < 0 || at < 0 ? ch <= chapterId : at <= here;
    if (ok && (at > bestAt || (at < 0 && !best))) { best = S[k]; bestAt = at; }
  }
  return best ? { ...best } : S[id] ? { ...S[id] } : null;
}

export function buildChapter({ world, map, ships, chapter, campaign, progress }) {
  const ch = inner(chapter, 'chapter'), problems = [];
  const order = ((inner(campaign, 'campaign').nodes) || []).map((n) => n.id);
  // the world, with this chapter's changes
  const w = structuredClone(world);
  for (const [path, value] of Object.entries(ch.world_overrides || {})) setPath(w, path, value);
  // map zones for scripts: lists of hexes, under map.zones next to the home zones (or top-level zones)
  const m = structuredClone(map), md = inner(m, 'map'), zones = {};
  for (const src of [md.zones, md.campaign_zones, m.zones]) if (isObj(src)) for (const [k, v] of Object.entries(src)) if (Array.isArray(v)) zones[k] = v;
  // fleets: the player (seat 0) and the enemy (seat 1), plus groups that arrive later
  const seams = {};
  const side = (who, seat) => {
    const S = ch[who] || {}, list = [], seen = new Set();
    const addShip = (entry, reserve) => {
      const id = typeof entry === 'string' ? entry : entry.id;
      if (!id || seen.has(id)) return;
      seen.add(id);
      const h = hullFor(ships, id, ch.id, order, seat === 0 ? progress : null);
      if (!h) { problems.push(`${who}: no hull for ship "${id}" in ships.yaml.`); return; }
      const extra = typeof entry === 'string' ? {} : entry;
      if (h.seams) seams[id] = h.seams;
      list.push({ name: id, flagship: extra.flagship ?? h.flagship === true, hull: extra.hull || h.hull, load: extra.load || h.load || {},
        ...(reserve ? { reserve: true } : {}), ...(h.joined || (h.seams && h.seams.length) ? { joined: true } : {}) });
    };
    for (const e of S.ships || []) addShip(e, false);
    for (const g of Object.values(ch.groups || {})) if ((g.side === 'player' ? 0 : g.side === 'enemy' ? 1 : g.side) === seat) for (const e of g.ships || []) addShip(e, true);
    return { ships: list, deployment: (S.deployment || []).map((d) => ({ ...d })) };
  };
  const fleets = { budget: 99999, player_1: side('player', 0), player_2: side('enemy', 1) };
  const built = buildRules(w, m, fleets);
  problems.push(...built.problems.filter((p) => !/budget/.test(p)));
  const enemyAi = (ch.enemy || {}).ai || {}, playerAi = (ch.player || {}).ai || {};
  const ai = { sides: [playerAi.default || null, enemyAi.default || null] };
  for (const [k, v] of Object.entries({ ...playerAi, ...enemyAi })) if (k !== 'default') ai[k] = v;
  const caps = new Set((progress && progress.capabilities) || []);
  built.rules.campaign = {
    id: ch.id, title: ch.title, script: ch.script || [], win: ch.win || [], lose: ch.lose || [],
    groups: ch.groups || {}, aiProfiles: ch.ai_profiles || {}, ai, zones, scenes: ch.scenes || {},
    unlocked: { graft: caps.has('graft'), dock: caps.has('docking') || caps.has('dock') }, seams,
    src: { world: w, map: m, fleets },
  };
  return { rules: built.rules, problems };
}

// A ship as a hull entry again (for carrying a grafted ship into the next chapter).
// Parts come back repaired: crews patch ships between battles.
export function shipToHull(rules, ship) {
  return {
    flagship: ship.flagship, joined: !!(ship.seams && ship.seams.length), seams: ship.seams || [], load: { ...ship.load },
    hull: ship.segs.map((sg) => ({ at: sg.off.slice(),
      bays: sg.parts.filter((p) => rules.parts[p.t] && rules.parts[p.t].slot === 'bay').map((p) => p.t),
      mounts: sg.parts.filter((p) => rules.parts[p.t] && rules.parts[p.t].slot === 'mount').map((p) => p.t) })),
  };
}

// After a chapter: completed list, rewards, roster changes, carried-over hulls.
export function applyResult(progress, chapter, game) {
  const ch = inner(chapter, 'chapter'), p = structuredClone(progress), sc = game.script || {};
  p.last = { chapter: ch.id, result: sc.result || (game.winner === 0 ? 'win' : 'lose') };
  if (p.last.result !== 'win' && p.last.result !== 'to_be_continued') return p;
  if (!p.completed.includes(ch.id)) p.completed.push(ch.id);
  const R = ch.rewards || {};
  for (const c of R.capabilities || []) if (!p.capabilities.includes(c)) p.capabilities.push(c);
  for (const id of R.roster_remove || []) p.roster = p.roster.filter((r) => r.id !== id);
  for (const id of R.roster_add || []) if (!p.roster.some((r) => r.id === id)) p.roster.push({ id });
  // ships that merged keep their new shape; ships merged into another leave the roster
  for (const s of game.ships) if (s.owner === 0 && !s.dead && s.seams && s.seams.length) {
    const r = p.roster.find((x) => x.id === s.name);
    const h = shipToHull(game.rules, s);
    if (r) Object.assign(r, h); else p.roster.push({ id: s.name, ...h });
    for (const m of s.seams) p.roster = p.roster.filter((x) => x.id !== m.with);
  }
  for (const [k, v] of Object.entries(R.flags || {})) p.flags[k] = v;
  for (const [k, v] of Object.entries(sc.flags || {})) if (!k.includes(':')) p.flags[k] = v;
  return p;
}
