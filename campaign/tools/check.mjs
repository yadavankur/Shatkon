// Campaign checker (runs on main: needs only engine/rules.js and friends). For every chapter it
// assembles world (+ world_overrides) + map + fleets the way PR #2's chapter loader does
// (hulls picked by <id>@<chapter>, flagship from the hull), runs buildRules (budget ignored), and
// also checks the pieces buildRules never sees at the start of a battle: split pieces, the
// grafted Kestrel, spawn groups, zones, hull continuity across the campaign, and the script
// (ids, references, and that every beat has a condition and a fallback).
// Run: node campaign/tools/check.mjs          (exit code 1 if anything fails)
import { buildRules, shipStats, start } from '../../engine/index.js';
import { sensorOf, signatureOf } from '../../engine/detect.js';
import { gap } from '../../engine/state.js';
import { camp, worldFor, fleetShip, sideFleet, hullKeyFor, H, render, terrainSets } from './lib.mjs';

const SCENES = 'ch1_intro ch1_contact ch1_finch_down ch1_hurl ch1_victory ch1_salvage ch1_defeat ch2_intro ch2_contact ch2_first_mine ch2_victory ch2_salvage ch2_defeat ch3_intro ch3_split ch3_despair ch3_li_arrives ch3_victory ch3_reunion ch3_defeat ch4_fork ch4a_intro ch4a_graft_found ch4a_outro ch4a_defeat ch5_intro ch5_bloom ch5_seam_wakes ch5_li_moves ch5_cliff'.split(' ');
const BARKS = 'b1_scouts_ahead b1_contact_glyphs b1_finch_hit b1_seed_shield b1_seed_closing b1_weapons_gone b1_hurl_wren b1_hurl_kite b2_mines_set b2_choke b2_mine_boom b2_second_seed b2_dead_in_water b3_cover b3_pd_stopped b3_hull_low b3_flank_open b4_too_easy b4_graft_hint b4_seam_hums b5_jammed b5_kestrel_unresponsive b5_li_coming'.split(' ');
const SHIP_IDS = 'kestrel sparrow finch wren kite halcyon tern seed seed_a seed_b twin twin_a twin_b husk_1 husk_2 husk_3 bloom'.split(' ');
const ZONES = ['choke', 'minefield', 'li_arrival', 'outpost', 'bloom_entry'];
// Trigger, action and AI-knob names exactly as PR #2's engine/script.js and engine/ai.js read them.
const TRIGGERS = ['start', 'round', 'turn', 'after', 'beat', 'fired', 'destroyed', 'removed', 'alive', 'hull_below', 'part_lost', 'in_zone', 'distance_below', 'sees', 'fired_at', 'stopped', 'mine_hit', 'grafted', 'docked', 'flag', 'all', 'any', 'not', 'rammed', 'engines_out'];
const ACTIONS = ['scene', 'bark', 'objective', 'flag', 'unlock', 'ai', 'protect', 'unprotect', 'doom', 'lock', 'unlock_controls', 'force', 'release', 'disable', 'enable', 'light', 'reveal', 'set_rule', 'spawn', 'remove', 'split', 'graft', 'dock', 'end', 'damage', 'orders', 'ram'];
const KNOBS = ['level', 'stance', 'target', 'stand_off', 'path_via', 'scans', 'avoid_mines', 'launch_range', 'fire_chance', 'max_hits_per_round', 'only_targets'];
const STANCES = ['hold', 'charge', 'advance', 'flee', 'hunt', 'patrol'];
const FORCE_ORDERS = ['move_toward', 'fire_at', 'move_to', 'follow', 'hold', 'launch_at', 'ram'];

const ships = camp('ships.yaml');
const campaign = camp('campaign.yaml').campaign;
const order = campaign.nodes.map((n) => n.id);
let failures = 0;
const out = [];
const log = (s = '') => out.push(s);
const fail = (s) => { failures++; log('  FAIL: ' + s); };
const ok = (s) => log('  ok: ' + s);
const idOf = (e) => (typeof e === 'string' ? e : e.id);

const usedScenes = new Set(), usedBarks = new Set();

// ---- roster continuity across the campaign (as PR #2's newCampaign / applyResult keep it) ----
if (!Array.isArray(campaign.start_state.roster)) fail('campaign.start_state.roster must be a list of ship ids');
let roster = (campaign.start_state.roster || []).map(idOf);
const caps = new Set(campaign.start_state.capabilities);
const PART_CAP = { shield: 'shield', launcher: 'launcher', magazine: 'magazine', point_defence: 'point_defence', comms: 'comms' };

for (const node of campaign.nodes) {
  if (!node.file) { log(`\n## ${node.id} "${node.title}": no battle (locked: ${!!node.locked}, "${node.locked_text || ''}")`); continue; }
  const ch = camp(node.file).chapter;
  if (ch.id !== node.id) fail(`${node.file}: chapter id ${ch.id} != node ${node.id}`);
  const map = camp(ch.map);
  const R = map.map.board.radius;
  const hk = (id) => hullKeyFor(ships, id, ch.id, order);
  log(`\n## ${ch.id} "${ch.title}"  (${ch.map}, radius ${R})`);
  for (const s of ch.scenes ? [ch.scenes.intro, ...[].concat(ch.scenes.win || []), ch.scenes.lose, ...[].concat(ch.scenes.tbc || [])] : []) if (s) usedScenes.add(s);
  if (node.fork_scene) usedScenes.add(node.fork_scene);

  // roster: every player ship must be in the campaign roster; groups bring new ones
  const pIds = (ch.player.ships || []).map(idOf);
  for (const id of pIds) if (!roster.includes(id)) fail(`roster has no ${id} at the start of ${ch.id}`);
  // ship entries: an id or { id, flagship?, hull?, load?, helm? }. helm: script is Combat v2
  // (the player cannot command the ship; it flies on orders). The engine at 7f51643 ignores it.
  for (const e of [...(ch.player.ships || []), ...(ch.enemy.ships || [])]) if (typeof e === 'object') {
    for (const k of Object.keys(e)) if (!['id', 'flagship', 'hull', 'load', 'helm'].includes(k)) fail(`ship entry ${e.id}: unknown field ${k}`);
    if (e.helm !== undefined && e.helm !== 'script') fail(`ship entry ${e.id}: helm must be script`);
    if (e.helm === 'script') ok(`${e.id}: helm: script (Combat v2): the engine locks it for the battle; it follows the script's orders`);
  }
  for (const [g, grp] of Object.entries(ch.groups || {})) if (grp.side === 'player') for (const id of grp.ships) if (roster.includes(id)) fail(`group ${g}: ${id} is already in the roster`);
  for (const id of [...pIds, ...(ch.enemy.ships || []).map(idOf), ...Object.values(ch.groups || {}).flatMap((g) => g.ships.map(idOf))]) if (!hk(id)) fail(`no hull for ${id} in ships.yaml`);
  ok(`hulls (loader rule <id>@<chapter>): ${[...pIds, ...(ch.enemy.ships || []).map(idOf), ...Object.values(ch.groups || {}).flatMap((g) => g.ships.map(idOf))].map((id) => id + '=' + hk(id)).join(', ')}`);
  for (const k of ['flagship', 'hulls']) for (const sd of ['player', 'enemy']) if (ch[sd][k] !== undefined) fail(`${sd}.${k} is not read by the chapter loader (flagship comes from the hull)`);
  // capabilities: human parts must be unlocked
  for (const id of pIds) for (const seg of ships[hk(id)].hull) for (const p of [...(seg.bays || []), ...(seg.mounts || [])])
    if (PART_CAP[p] && !caps.has(PART_CAP[p])) fail(`${id} carries ${p} before the capability is earned`);

  // ---- world + overrides ----
  const { world, notes, infos } = worldFor(ch);
  notes.forEach(fail);
  infos.forEach((x) => log('  note: ' + x));
  log(`  world_overrides: ${JSON.stringify(ch.world_overrides || {})}`);

  // ---- main fleets ----
  const enemy = { ...ch.enemy };
  const groupShips = (side) => Object.values(ch.groups || {}).filter((g) => g.side === side);
  let enemyNote = '';
  if (!(enemy.ships || []).length) {
    // the enemy has nothing on the board at the start: check it as it stands once its groups have spawned
    const gs = groupShips('enemy');
    enemy.ships = gs.flatMap((g) => g.ships);
    enemy.deployment = gs.flatMap((g) => Object.entries(g.at || {}).map(([ship, at]) => ({ ship, at })));
    enemyNote = ' (enemy side checked with its spawn groups in place: it starts empty)';
  }
  const fleets = { world: 'world_v0.4.yaml', map: ch.map, budget: 99999, player_1: sideFleet(ships, ch.player, ch.id, order), player_2: sideFleet(ships, enemy, ch.id, order) };
  const built = buildRules(world, map, fleets);
  const probs = built.problems.filter((p) => !/budget/.test(p));
  if (probs.length) probs.forEach((p) => fail('buildRules: ' + p)); else ok(`buildRules: 0 problems${enemyNote}`);
  const rules = built.rules;
  // headline stats
  log('  ships:');
  for (const fl of rules.fleets) for (const s of fl.ships) {
    const st = shipStats(rules, s);
    let hp = 0; for (const sg of s.segs) for (const p of sg.parts) if (!rules.parts[p].recharges) hp += rules.parts[p].hp;
    const count = (n) => s.segs.reduce((a, sg) => a + sg.parts.filter((p) => p === n).length, 0);
    log(`    ${fl.name === 'player_1' ? 'P' : 'W'} ${s.name.padEnd(8)} segs ${st.segments}  thrust ${st.thrust}  sensor ${st.sensor}  signature ${st.signature}  link ${st.link}  hull hp ${hp}  lasers ${count('laser')}  shields ${count('shield')}  PD ${count('point_defence')}  load ${JSON.stringify(s.load)}${s.flagship ? '  FLAGSHIP' : ''}`);
  }
  for (const [i, fl] of rules.fleets.entries()) {
    const th = fl.ships.reduce((n, s) => n + shipStats(rules, s).thrust, 0), sg = fl.ships.reduce((n, s) => n + s.segs.length, 0);
    log(`    ${i ? 'Weave' : 'Human'} fleet: thrust ${th} for ${sg} segments -> move cap ${Math.floor(th / sg) + 1} hexes a turn`);
  }

  // start distances and sight ranges (engine formulas, start of the game)
  const g = start(rules, 1);
  const P = g.ships.filter((s) => s.owner === 0), W = g.ships.filter((s) => s.owner === 1);
  log('  start: gap / W sees P at / P sees W at (exact; fuzzy +3)');
  for (const w of W) for (const p of P)
    log(`    ${w.name} - ${p.name}: ${gap(w, p)} / ${sensorOf(g, w) + signatureOf(g, p)} / ${sensorOf(g, p) + signatureOf(g, w)}`);

  // ---- zones ----
  const { ast } = terrainSets(rules);
  const zones = Object.fromEntries(Object.entries(map.map.zones).filter(([, z]) => Array.isArray(z)));
  for (const [z, cells] of Object.entries(zones)) {
    const bad = cells.filter((c) => !H.inHexagon(c, R) || ast.has(H.key(c)));
    if (bad.length) fail(`zone ${z}: off-board or blocked cells ${JSON.stringify(bad)}`);
    if (!cells.length) fail(`zone ${z} is empty`);
  }
  ok(`zones: ${Object.entries(zones).map(([z, c]) => `${z} (${c.length})`).join(', ')}`);

  // ---- spawn groups as standalone fleets ----
  for (const [gname, grp] of Object.entries(ch.groups || {})) {
    if (grp.zone && !zones[grp.zone]) { fail(`group ${gname}: zone ${grp.zone} missing from the map`); continue; }
    for (const id of grp.ships) if (!(grp.at || {})[id]) log(`  note: group ${gname}: ${id} has no "at" spot; the engine places it on the first free zone hex`);
    const zk = new Set((zones[grp.zone] || []).map(H.key));
    const list = grp.ships.map((id, i) => fleetShip(ships, id, hk(id), grp.side === 'enemy' ? undefined : i === 0));
    const dep = Object.entries(grp.at || {}).map(([ship, at]) => ({ ship, at }));
    const f2 = { budget: 99999, ['spawn_' + gname]: { ships: list, deployment: dep }, [grp.side === 'player' ? 'player_2' : 'player_1']: sideFleet(ships, grp.side === 'player' ? ch.enemy : ch.player, ch.id, order) };
    const pr = buildRules(world, map, f2).problems.filter((p) => !/budget|flagship/.test(p) || p.startsWith('spawn_'));
    const real = pr.filter((p) => !(p.includes('flagship') && !p.startsWith('spawn_')));
    if (real.length) real.forEach((p) => fail(`group ${gname}: ${p}`)); else ok(`group ${gname}: buildRules 0 problems as a standalone fleet (home-zone check replaced by zone ${grp.zone})`);
    for (const d of dep) {
      const cells = ships[hk(d.ship)].hull.map((s) => H.add(d.at, s.at));
      const out2 = cells.filter((c) => !zk.has(H.key(c)));
      if (out2.length) fail(`group ${gname}: ${d.ship} cells ${JSON.stringify(out2)} are outside zone ${grp.zone}`);
    }
    ok(`group ${gname}: every "at" cell is inside zone ${grp.zone}`);
  }

  // ---- script: split and graft as fleets (engine semantics) ----
  const allIds = new Set([...pIds, ...(ch.enemy.ships || []).map(idOf), ...Object.values(ch.groups || {}).flatMap((g) => g.ships)]);
  const actionsOf = (e) => e.do || [];
  const norm = (l) => l.slice().sort().join(',');
  for (const e of ch.script) for (const a of actionsOf(e)) {
    if (a.split) {
      // PR #2 split(): each piece keeps the parent's segments whose offsets are in `cells`, in the
      // parent's hull order; its position is its first segment's hex; a piece with no core grows
      // one in its first segment; load goes to pieces with magazine room.
      const sp = a.split, parent = ships[hk(sp.ship)], dep = enemy.deployment.find((d) => d.ship === sp.ship);
      const used = new Set(), pieces = [];
      for (const piece of sp.into) {
        allIds.add(piece.id);
        for (const k of Object.keys(piece)) if (!['id', 'flagship', 'cells'].includes(k)) fail(`split ${piece.id}: field ${k} is not read by the engine`);
        const segs = parent.hull.filter((sg) => piece.cells.some((c) => H.key(c) === H.key(sg.at)));
        if (segs.length !== piece.cells.length) fail(`split ${piece.id}: some cells are not ${sp.ship} cells`);
        segs.forEach((sg) => used.add(H.key(sg.at)));
        const o = segs[0].at;
        const hull = segs.map((sg, i) => ({ at: [sg.at[0] - o[0], sg.at[1] - o[1]], bays: [...(sg.bays || [])], mounts: [...(sg.mounts || [])] }));
        let grown = '';
        if (!hull.some((sg) => sg.bays.includes('core'))) { hull[0].bays.push('core'); grown = ` (core grown at [${segs[0].at}])`; }
        // the documented piece hull in ships.yaml must match what the engine makes
        const doc = ships[piece.id + '@' + ch.id];
        if (doc) {
          const same = doc.hull.length === hull.length && hull.every((sg) => { const d = doc.hull.find((x) => H.key(x.at) === H.key(sg.at)); return d && norm(d.bays || []) === norm(sg.bays) && norm(d.mounts || []) === norm(sg.mounts); });
          if (!same) fail(`split ${piece.id}: ${piece.id}@${ch.id} in ships.yaml differs from the piece the engine builds`);
        }
        pieces.push({ ship: { name: piece.id, flagship: !!piece.flagship, hull }, at: H.add(dep.at, o), grown });
      }
      if (used.size !== parent.hull.length) fail(`split ${sp.ship}: pieces cover ${used.size} of ${parent.hull.length} cells`);
      const side = { ships: pieces.map((p) => p.ship), deployment: pieces.map((p) => ({ ship: p.ship.name, at: p.at })) };
      const f3 = { budget: 99999, player_1: sideFleet(ships, ch.player, ch.id, order), player_2: side };
      const pr = buildRules(world, map, f3).problems.filter((p) => !/budget/.test(p));
      if (pr.length) pr.forEach((p) => fail(`split ${sp.ship}: ${p}`));
      else ok(`split ${sp.ship} -> ${pieces.map((p) => p.ship.name + ' at [' + p.at + ']' + p.grown).join(' + ')}: buildRules 0 problems at the Twin's start hex; matches the ships.yaml piece hulls`);
    }
    if (a.graft) {
      // PR #2 join() keeps every part and appends B's segments at their real offset. Here: check
      // that the canonical next-chapter hull (kestrel@<next chapter>) is A + B with B touching A.
      const [A, B] = a.graft, next = campaign.nodes.find((n) => n.id === node.next[0]);
      const resKey = hullKeyFor(ships, A, next.id, order), res = ships[resKey], ha = ships[hk(A)], hb = ships[hk(B)];
      const aKeys = new Set(ha.hull.map((s) => H.key(s.at)));
      const rest = res.hull.filter((s) => !aKeys.has(H.key(s.at)));
      const t = [rest[0].at[0] - hb.hull[0].at[0], rest[0].at[1] - hb.hull[0].at[1]];
      const mapped = hb.hull.map((s) => H.key(H.add(s.at, t))).sort().join(' ');
      if (mapped !== rest.map((s) => H.key(s.at)).sort().join(' ')) fail(`graft: ${resKey} cells are not ${A} + ${B}`);
      const all = (l) => l.flatMap((s) => [...(s.bays || []), ...(s.mounts || [])]);
      const want = [...all(ha.hull), ...all(hb.hull)].sort();
      want.splice(want.indexOf('core'), 1, 'coupling'); // canonical hull: B's core fused into a seam coupling
      if (want.sort().join(',') !== all(res.hull).sort().join(',')) fail(`graft: ${resKey} parts != ${A} + ${B} (B's core as a coupling)`);
      const seam = (res.seams || []).find((x) => x.kind === 'weave' && x.with === B);
      if (!res.joined || !seam || norm(seam.cells.map(H.key)) !== norm(rest.map((s) => H.key(s.at)))) fail(`graft: ${resKey} needs joined: true and seams [{ kind: weave, with: ${B}, cells: B's cells }]`);
      if (!ha.hull.some((x) => rest.some((y) => H.dist(x.at, y.at) === 1))) fail('graft: the two parts do not touch');
      ok(`graft [${A}, ${B}] -> canonical ${resKey}: ${B} at offset [${t}] (rear), parts, cells and seams match (built at ch5 below)`);
    }
  }

  // ---- script lint (PR #2 trigger / action names) ----
  const ids = ch.script.map((e) => e.id);
  if (new Set(ids).size !== ids.length) fail('duplicate script ids');
  const profiles = Object.keys(ch.ai_profiles || {});
  const flagsSet = new Set();
  for (const e of ch.script) for (const a of actionsOf(e)) if (a.flag) flagsSet.add(a.flag);
  const byId = Object.fromEntries(ch.script.map((e) => [e.id, e]));
  const dooms = new Map();
  const checkShip = (id, where) => { if (id && !allIds.has(id)) fail(`${where}: unknown ship ${id}`); };
  const checkBeat = (id, where) => { if (id !== 'start' && !byId[id]) fail(`${where}: unknown beat ${id}`); };
  const walk = (t, where) => {
    if (typeof t === 'string') return checkBeat(t, where);
    if (!t || typeof t !== 'object') { fail(`${where}: cannot read trigger ${JSON.stringify(t)}`); return; }
    const ks = Object.keys(t);
    if (ks.length !== 1) fail(`${where}: a trigger has one key, got ${ks.join(', ')}`);
    const [k] = ks, v = t[k];
    if (!TRIGGERS.includes(k)) fail(`${where}: unknown trigger ${k}`);
    if (k === 'all' || k === 'any') v.forEach((x) => walk(x, where));
    else if (k === 'not') walk(v, where);
    else if (['destroyed', 'removed', 'alive'].includes(k)) checkShip(v, where);
    else if (k === 'beat' || k === 'fired') checkBeat(v, where);
    else if (k === 'flag') { if (!flagsSet.has(v)) fail(`${where}: flag ${v} is never set by a flag action (beat ids need a bare string or beat:)`); }
    else if (k === 'after') { checkBeat(v.beat, where); if (v.rounds === undefined && v.turns === undefined) fail(`${where}: after needs rounds or turns`); }
    else if (k === 'turn') { if (typeof v.round !== 'number') fail(`${where}: turn needs a round`); if (Object.keys(v).some((x) => !['round', 'side'].includes(x))) fail(`${where}: turn reads only round and side`); }
    else if (k === 'in_zone') { if (!zones[v.zone]) fail(`${where}: zone ${v.zone} not on the map`); checkShip(v.ship, where); }
    else if (k === 'grafted' || k === 'docked') v.forEach((x) => checkShip(x, where));
    else if (k === 'part_lost' && rules.parts[v.part] && rules.parts[v.part].recharges) fail(`${where}: part_lost ignores recharging parts (${v.part}): it can never fire`);
    else if (typeof v === 'object' && v) { for (const f of ['ship', 'a', 'b', 'by', 'target']) checkShip(v[f], where); }
  };
  // guaranteed: true if the trigger will become true by some round whatever the player does
  const guar = (t, seen = new Set()) => {
    if (t === 'start') return true;
    if (typeof t === 'string') return guarBeat(t, seen);
    if (!t || typeof t !== 'object') return false;
    if (t.round) return true;
    if (t.turn) return typeof t.turn.round === 'number';
    if (t.after) return guarBeat(t.after.beat, seen);
    if (t.beat || t.fired) return guarBeat(t.beat || t.fired, seen);
    if (t.any) return t.any.some((x) => guar(x, seen));
    // inside all: a `not` or `alive` only stops a fallback that is no longer needed
    if (t.all) return t.all.every((x) => (x.not || x.alive ? true : guar(x, seen)));
    // a flag is guaranteed when a guaranteed beat sets it
    if (t.flag) return ch.script.some((f) => actionsOf(f).some((a) => a.flag === t.flag) && guarBeat(f.id, seen));
    // rammed: guaranteed when a guaranteed beat hurls that ship with force: true
    if (t.rammed) return ch.script.some((f) => actionsOf(f).some((a) => a.ram && a.ram.ship === t.rammed && a.ram.force === true) && guarBeat(f.id, seen));
    if (t.destroyed) return dooms.has(t.destroyed) && guarBeat(dooms.get(t.destroyed), seen);
    return false;
  };
  const guarBeat = (id, seen) => {
    if (seen.has(id)) return false;
    seen = new Set(seen).add(id);
    const e = byId[id];
    if (!e) return false;
    if (guar(e.when, seen)) return true;
    return ch.script.some((f) => f.fallback_for === id && guar(f.when, seen));
  };
  for (const e of ch.script) for (const a of actionsOf(e)) if (a.doom) dooms.set(a.doom.ship, e.id);
  for (const e of ch.script) {
    const where = `${ch.id}/${e.id}`;
    for (const k of Object.keys(e)) if (!['id', 'when', 'do', 'flavor', 'outcome', 'fallback_for'].includes(k)) fail(`${where}: unknown entry field ${k}`);
    walk(e.when, where);
    for (const a of actionsOf(e)) {
      const keys = Object.keys(a);
      if (keys.length !== 1 || !ACTIONS.includes(keys[0])) fail(`${where}: cannot read action ${JSON.stringify(a)}`);
      const [k] = keys, v = a[k];
      if (k === 'scene') { usedScenes.add(v); if (!SCENES.includes(v)) log(`  note: ${where} uses extra scene ${v}`); }
      if (k === 'bark') { usedBarks.add(v); if (!BARKS.includes(v)) log(`  note: ${where} uses extra bark ${v}`); }
      if (k === 'spawn' && !(ch.groups || {})[v]) fail(`${where}: unknown group ${v}`);
      if (k === 'ai' && !profiles.includes(v.profile)) fail(`${where}: unknown ai profile ${v.profile}`);
      if (k === 'ai' && !v.ship && !v.side) fail(`${where}: ai needs ship or side`);
      if (typeof v === 'object' && v && !Array.isArray(v)) checkShip(v.ship, where);
      if (k === 'set_rule' && (() => { const w2 = structuredClone(world); return v.path.split('.').reduce((o, x) => (o && x in o ? o[x] : undefined), w2) === undefined; })()) fail(`${where}: set_rule path ${v.path} not in world`);
      if (k === 'force' || k === 'orders') {
        if (!v.ship) fail(`${where}: ${k} needs a ship`);
        if (!Array.isArray(v.do) || !v.do.length) fail(`${where}: ${k} needs a do list`);
        for (const d of v.do || []) {
          const [o, ...more] = Object.keys(d), x = d[o];
          if (more.length) fail(`${where}: one order per entry (${Object.keys(d).join(', ')})`);
          if (!FORCE_ORDERS.includes(o)) { fail(`${where}: order ${o} is not one the engine runs`); continue; }
          const hex = (c) => Array.isArray(c) && c.length === 2 && c.every(Number.isInteger);
          if (['move_toward', 'fire_at', 'ram'].includes(o)) checkShip(x, where);
          else if (o === 'move_to' && !hex(x)) fail(`${where}: move_to needs a hex [q, r]`);
          else if (o === 'follow' && !(Array.isArray(x) && x.length && x.every(hex))) fail(`${where}: follow needs a list of hexes`);
          else if (o === 'launch_at') { if (typeof x === 'string') checkShip(x, where); else if (!hex(x)) fail(`${where}: launch_at needs a ship or a hex`); }
          else if (o === 'hold' && x !== true) fail(`${where}: hold: true`);
        }
      }
      if (k === 'ram') { checkShip(v.ship, where); checkShip(v.target, where); if (v.force !== undefined && typeof v.force !== 'boolean') fail(`${where}: ram force must be true or false`); }
      if (k === 'protect') { if (!v.ship) fail(`${where}: protect needs a ship`); if (typeof v.until !== 'string' || (v.until !== 'end' && !byId[v.until])) fail(`${where}: protect until must be a beat id or end`); }
      if (k === 'doom' && typeof v.by_round !== 'number') fail(`${where}: doom needs by_round`);
      if (['lock', 'force', 'disable'].includes(k) && v.until !== undefined && !(v.until === 'end' || typeof v.until === 'number' || (typeof v.until === 'object' && typeof v.until.rounds === 'number') || byId[v.until])) fail(`${where}: ${k} until ${JSON.stringify(v.until)}`);
      if (k === 'end' && !['win', 'lose', 'to_be_continued'].includes(v.result || v)) fail(`${where}: end result`);
      if (k === 'end' && (v.result || v) === 'to_be_continued' && !(ch.scenes || {}).tbc) log(`  note: ${where} ends to_be_continued with no scenes.tbc`);
    }
    if (!e.flavor && !e.outcome) {
      const g2 = guarBeat(e.id, new Set());
      if (!g2) fail(`${where}: beat has no fallback (it may never fire)`);
    }
  }
  for (const [k, p] of Object.entries(ch.ai_profiles || {})) {
    for (const kn of Object.keys(p)) if (kn === 'ignore_flank') log(`  note: profile ${k}: ignore_flank is accepted but does nothing in PR #2`); else if (!KNOBS.includes(kn)) fail(`profile ${k}: unknown knob ${kn}`);
    if (p.stance && !STANCES.includes(p.stance)) fail(`profile ${k}: unknown stance ${p.stance}`);
    if (p.path_via && !zones[p.path_via]) fail(`profile ${k}: path_via zone ${p.path_via} not on the map`);
  }
  for (const sd of ['player', 'enemy']) for (const [kk, p] of Object.entries(ch[sd].ai || {})) if (!profiles.includes(p)) fail(`${sd}.ai.${kk} uses unknown profile ${p}`);
  for (const id of allIds) if (!SHIP_IDS.includes(id)) log(`  note: extra ship id ${id}`);
  for (const w of [...(ch.win || []), ...(ch.lose || [])]) walk(w, `${ch.id}/win-lose`);
  for (const k of Object.keys(ch)) if (!['id', 'title', 'world', 'world_overrides', 'map', 'player', 'enemy', 'groups', 'ai_profiles', 'script', 'win', 'lose', 'scenes', 'rewards'].includes(k)) fail(`chapter field ${k} is not read by the chapter loader`);
  for (const k of Object.keys(ch.rewards || {})) if (!['capabilities', 'roster_add', 'roster_remove', 'flags'].includes(k)) fail(`rewards.${k} is not read by applyResult`);
  for (const k of ['roster_add', 'roster_remove']) if (ch.rewards && ch.rewards[k] && !Array.isArray(ch.rewards[k])) fail(`rewards.${k} must be a list`);
  const beats = ch.script.filter((e) => !e.flavor && !e.outcome).map((e) => e.id);
  ok(`script: ${ch.script.length} entries; every beat has a condition and a guaranteed fallback: ${beats.join(', ')}`);
  for (const w of ch.win || []) log(`  win ${JSON.stringify(w)}: ${guar(w) ? 'guaranteed by a doom / fallback' : 'must be earned in play (or ends through a scripted end)'}`);

  // board picture
  const zc = { choke: 'c', minefield: 'm', li_arrival: 'l', outpost: 'o', bloom_entry: 'b', west_slot: 'w', cover: ',', corridor_mid: ':' };
  const marks = new Map();
  for (const [z, cells] of Object.entries(zones)) for (const c of cells) marks.set(H.key(c), zc[z] || 'z');
  for (const d of ch.player.deployment) if (d.mine) marks.set(H.key(d.mine), 'M');
  // humans: first letter of the ship id in capitals; every Weave ship: X
  for (const s of g.ships) for (const c of s.segs.map((x) => H.add(s.pos, x.off))) marks.set(H.key(c), s.owner ? 'X' : s.name[0].toUpperCase());
  for (const grp of Object.values(ch.groups || {})) for (const [id, at] of Object.entries(grp.at || {})) for (const sg of ships[hk(id)].hull) marks.set(H.key(H.add(at, sg.at)), grp.side === 'enemy' ? 'X' : id[0].toUpperCase());
  log('\n  Board (# asteroid, ~ nebula, M mine, X Weave, capitals = human ships by initial; lower case = zones: ' + Object.keys(zones).map((z) => (zc[z] || 'z') + '=' + z).join(', ') + '; ships drawn over zones)');
  log('```\n' + render(R, rules, marks) + '\n```');

  // ---- apply rewards for the next chapter (as applyResult does) ----
  const rw = ch.rewards || {};
  for (const c of rw.capabilities || []) caps.add(c);
  roster = roster.filter((id) => !(rw.roster_remove || []).includes(id));
  for (const id of rw.roster_add || []) if (!roster.includes(id)) roster.push(id);
  for (const a of ch.script.flatMap(actionsOf)) if (a.graft) roster = roster.filter((id) => id !== a.graft[1]); // the merged ship leaves the roster
}
log('\n## Shared ids');
const missS = SCENES.filter((s) => !usedScenes.has(s)), missB = BARKS.filter((b) => !usedBarks.has(b));
if (missS.length) fail('scenes never used: ' + missS.join(', ')); else ok(`all ${SCENES.length} shared scene ids are used`);
if (missB.length) fail('barks never used: ' + missB.join(', ')); else ok(`all ${BARKS.length} shared bark ids are used`);
log(`  final roster: ${JSON.stringify(roster)}`);
log(`  final capabilities: ${[...caps].join(', ')}`);
log(`\n${failures ? failures + ' FAILURE(S)' : 'ALL CHECKS PASSED'}`);
console.log(out.join('\n'));
process.exit(failures ? 1 : 0);
