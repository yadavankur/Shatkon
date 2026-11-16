// A computer opponent. It plays fair: it only uses what its own side can see
// (view() for its seat, plus the engine's own option helpers, which respect the fog of war).
// "easy" makes random choices some of the time; "normal" plays its best guess every time.
//
//   const action = computerMove(game, 1, 'normal');   // null when it is not this seat's turn

import * as E from './index.js';
import { beamHitsAt } from './actions.js';

// opts (story campaigns, see campaignMove): profiles { shipId: profile }, rand (seeded),
// nameOf(id), via { shipName: true } (already went through its path_via zone), hitsSoFar.
// opts.personality: a name from the world file's `ai.personalities` (aggressive, defensive, balanced).
// A "normal" skirmish game with no personality given plays the world file's `ai.vs_computer`.
export function computerMove(state, seat, level = 'normal', opts = {}) {
  const easy = level === 'easy';
  const rnd = opts.rand || Math.random, P0 = opts.profiles || {};
  const pers = personalityOf(state, level, opts);
  // a ship can carry its own personality (fleets file: `ai: aggressive` on the ship), so one fleet
  // can mix a cautious flagship with a reckless escort
  const own = {};
  if (pers) for (const x of state.ships) if (x.owner === seat && !x.dead) {
    const def = (((state.rules.fleets[seat] || {}).ships || []).find((d) => d.name === x.name) || {}).ai;
    if (def && ((state.rules.ai || {}).personalities || {})[def]) own[x.id] = state.rules.ai.personalities[def];
  }
  const prof = (s) => P0[s.id] || own[s.id] || pers || {};
  const nameOf = opts.nameOf || (() => null);
  const capHit = (() => { const caps = Object.values(P0).map((p) => p.max_hits_per_round).filter((x) => typeof x === 'number'); return caps.length && (opts.hitsSoFar || 0) >= Math.min(...caps); })();
  const H = E.hex,
    R = state.rules;
  // ai.variety and ai.tricks (world file): personalities only. Story chapters and "easy" are untouched.
  const V = (pers && (R.ai || {}).variety) || {}, T = (pers && (R.ai || {}).tricks) || {};
  // tie_break: equal choices used to go to whichever came first in the list (the lowest direction,
  // the first ship), so the same board turned round played a different game and a mirror board came
  // out 20-0. Now each choice gets a tiny nudge from the game's own seed: the same game replays
  // exactly, a new game breaks its ties differently.
  const TB = typeof V.tie_break === 'number' ? V.tie_break : 0;
  const noise = (tag) => (TB ? (E.seededRandom(E.fnv((state.fzSalt | 0) + '|' + state.round + '|' + seat + '|' + tag))() - 0.5) * TB : 0);
  const isMine = (kind) => { const m = R.munitions[kind]; return !!m && !m.speed && !!m.hits; };
  const v = E.view(state, seat);
  if (v.phase !== 'play' || v.toMove !== seat) return null;
  const P = state.players[seat];
  const mine = v.ships.filter((s) => s.mine);
  // out of command points: the turn is over, unless a ship is mid-salvo (its other launchers fire free)
  if (P.cp <= 0 && !(R.salvo && mine.some((s) => (s.used || {}).salvo && E.launchOptions(state, s.id)))) return { type: 'end' };
  const foes = v.ships.filter((s) => !s.mine && s.seen);
  const blockSight = new Set();
  for (const t of R.terrain)
    if ((R.terrainTypes[t.type] || {}).blocks_sight) t.cells.forEach((c) => blockSight.add(H.key(c)));
  const minDist = (A, B) => {
    let m = 1e9;
    for (const a of A) for (const b of B) m = Math.min(m, H.dist(a, b));
    return m;
  };
  const clearLine = (a, b) => !!H.sightLine(a, b, (c) => blockSight.has(H.key(c)));
  const shipById = (id) => v.ships.find((s) => s.id === id);
  // an enemy whose every part a scan has shown, with nothing left to shoot or launch: a decoy, or disarmed
  const harmless = (t) => !!t && !t.mine && t.segs.every((g) => g.wrecked || g.parts) &&
    !t.segs.some((g) => !g.wrecked && g.parts.some((p) => p.hp > 0 && ((R.parts[p.t].range && R.parts[p.t].hits) || R.parts[p.t].launches)));
  // fuzzy contacts: the computer only knows "somewhere in this circle", so it treats
  // every hex of the circle as a possible position (same info the human gets)
  const circleCells = (c) => {
    const out = [];
    const r = c.r || 2;
    for (let dq = -r; dq <= r; dq++)
      for (let dr = -r; dr <= r; dr++) if (H.dist([0, 0], [dq, dr]) <= r) out.push([c.at[0] + dq, c.at[1] + dr]);
    return out;
  };
  const contactCells = (v.contacts || []).flatMap(circleCells);
  // scans: eager = a scanner pilot spends a point on a scan before it shoots, when a ship that has
  // moved has an enemy it has never read inside its clear ring (it wants to know what to shoot first)
  const unread = (f) => !f.segs.every((g) => g.wrecked || g.parts);
  if (pers && P.cp >= 2) for (const s of mine) {
    if (prof(s).scans !== 'eager' || (s.used || {}).scan || !s.scanR) continue;
    if (foes.some((f) => unread(f) && minDist(s.cells, f.cells) <= s.scanR[0])) { const act = { type: 'scan', ship: s.id }; if (E.attempt(state, act).ok) return act; }
  }
  // target_priority: threat = with a scan readout, go for the ship with the most working weapons
  // and the least protection, and for the segment that carries a weapon and no working shield
  const liveParts = (g) => (g && !g.wrecked && g.parts ? g.parts.filter((p) => p.hp > 0) : []);
  const isWeapon = (p) => (R.parts[p.t].range && R.parts[p.t].hits) || R.parts[p.t].launches;
  const threat = (tgt, at) => {
    const all = tgt.segs.flatMap(liveParts), g = tgt.segs[tgt.cells.findIndex((c) => c[0] === at[0] && c[1] === at[1])];
    return 3 * all.filter(isWeapon).length - all.filter((p) => R.parts[p.t].recharges || R.parts[p.t].hp > 1).length +
      (liveParts(g).some(isWeapon) ? 4 : 0) - (liveParts(g).some((p) => R.parts[p.t].recharges) ? 3 : 0);
  };
  // 1. Fire: best laser shot available (prefer flagship, then most hits, then incoming missiles)
  let best = null;
  for (const s of mine) {
    const pr = prof(s);
    if (capHit) break;
    if (typeof pr.fire_chance === 'number' && rnd() > pr.fire_chance) continue;
    for (const t of E.beamTargets(state, s.id)) {
      const tgt = shipById(t.target);
      if (Array.isArray(pr.only_targets) && !(tgt && pr.only_targets.includes(nameOf(tgt.id)))) continue;   // story: shoot these and nothing else
      let score = t.hits * 10;
      if (tgt && Array.isArray(pr.target) && pr.target.includes(nameOf(tgt.id))) score += 15;
      if (tgt && pr.target === 'smallest') score += 8 - tgt.segs.length;
      if (tgt && pers && pr.target_priority === 'threat' && !unread(tgt)) score += threat(tgt, t.at);
      else if (tgt)
        score += tgt.segs.length >= 5 ? 6 : 3; // enemy flagship is unknown; guess the big one
      else {
        const o = v.objs.find((o) => o.id === t.target);
        // shoot down missiles that are close to my ships
        const near = o ? minDist([o.pos], mine.flatMap((m) => m.cells)) : 99;
        score = o && o.kind === 'missile' && near <= 6 ? 25
          // shoots_mines: N = a mine it can see within N hexes of one of its ships is worth a shot (it is in the way)
          : o && isMine(o.kind) && typeof T.shoots_mines === 'number' && near <= T.shoots_mines ? 12
          : 2;
      }
      score += noise('f' + s.id + t.seg + '.' + t.part + H.key(t.at));
      // a personality told to ignore harmless ships does not spend a shot (and light itself up) on one
      if (pers && tgt && pr.ignores_harmless === true && harmless(tgt)) score = 1;
      if (!best || score > best.score)
        best = { score, hits: t.hits, ship: s, tgt, action: { type: 'fire', ship: s.id, seg: t.seg, part: t.part, at: t.at } };
    }
  }
  // easy: fires at whatever it happens to pick, not the best target
  if (easy && best && best.score >= 10) {
    const all = mine.flatMap((s) =>
      E.beamTargets(state, s.id).map((t) => ({ type: 'fire', ship: s.id, seg: t.seg, part: t.part, at: t.at }))
    );
    if (all.length && rnd() < 0.5) return all[Math.floor(rnd() * all.length)];
  }
  if (best && best.score >= 10) {
    const run = attackRun(best);   // a personality steps a hex first when that earns the attack-run hit
    return run || best.action;
  }
  // 2. Launch a locked missile at a visible ship within sensible range
  for (const s of capHit ? [] : mine) {
    const lo = E.launchOptions(state, s.id);
    if (!lo || !lo.kinds.includes('missile') || !lo.locks.length) continue;
    const targets = lo.locks
      .map(shipById)
      .filter(Boolean)
      .filter((t) => !Array.isArray(prof(s).only_targets) || prof(s).only_targets.includes(nameOf(t.id)))
      .map((t) => ({ t, d: minDist(s.cells, t.cells) }))
      .filter((x) => x.d <= (prof(s).launch_range ?? prof(s).missile_range ?? (easy ? 3 : 5))) // close range: little time to react, point defence gets fewer shots
      .sort((a, b) => (prof(s).target === 'smallest' ? a.t.segs.length - b.t.segs.length : b.t.segs.length - a.t.segs.length) || a.d - b.d);
    if (Array.isArray(prof(s).target)) targets.sort((a, b) => (prof(s).target.includes(nameOf(b.t.id)) ? 1 : 0) - (prof(s).target.includes(nameOf(a.t.id)) ? 1 : 0));
    // a personality that has scanned its targets saves its missiles for one with no working point defence
    if (pers && prof(s).missiles_avoid_point_defence !== false) {
      const pd = (t) => (t.segs.some((g) => !g.wrecked && (g.parts || []).some((p) => p.hp > 0 && R.parts[p.t].stops_per_round)) ? 1 : 0);
      targets.sort((a, b) => pd(a.t) - pd(b.t));
    }
    if (!targets.length) continue;
    const t = targets[0].t;
    let start = lo.starts[0];
    for (const st of lo.starts) if (minDist([st], t.cells) < minDist([start], t.cells)) start = st;
    const act = { type: 'launch', ship: s.id, kind: 'missile', start, target: t.id, route: [] };
    if (easy && rnd() < 0.5) continue; // easy: hesitates
    return act;
  }
  // 2c. Drones (tricks.launches_drones): a carrier with nothing located sends a reporting drone toward
  // where it thinks the enemy is, and keeps `drones_in_flight` up. A drone next to two or more
  // enemy segments (and none of its own side's) is blown up there.
  if (T.launches_drones === true && !capHit) {
    const scouts = Object.keys(R.munitions).filter((k) => R.munitions[k].reports && R.munitions[k].speed);
    for (const o of v.objs) {
      const m = R.munitions[o.kind];
      if (!o.mine || !m.remote_detonate || P.cp < R.cost.detonate) continue;
      const r = m.blast_radius || 0, inBlast = (x) => x.cells.filter((c, i) => !x.segs[i].wrecked && H.dist(c, o.pos) <= r).length;
      if (r > 0 && foes.reduce((n, f) => n + inBlast(f), 0) >= 2 && !mine.some((x) => inBlast(x))) return { type: 'detonate', obj: o.id };
    }
    const flying = v.objs.filter((o) => o.mine && scouts.includes(o.kind)).length;
    if (!foes.length && flying < (T.drones_in_flight ?? 2)) for (const s of mine) {
      const lo = E.launchOptions(state, s.id), kind = lo && lo.kinds.find((k) => scouts.includes(k));
      if (!kind) continue;
      const spots = (v.contacts || []).filter((c) => c.kind === 'ship').map((c) => c.at).concat(v.ghosts.filter((g) => g.kind === 'ship').map((g) => g.pos));
      const aim = spots.sort((a, b) => minDist(s.cells, [a]) - minDist(s.cells, [b]))[0] || enemyHomePoint(v, seat, R);
      const act = aim && E.aimLaunch(state, s.id, kind, aim);
      if (act && E.attempt(state, act).ok) return act;
    }
  }
  // 2a. Blind fire: no lock needed. A personality with `blind_fire` sends a missile down the line
  // to where it believes the enemy is (a rough contact, a last-seen position, or, with
  // `blind_fire_at_home`, the middle of the enemy's home rows) and lets the missile's own seeker
  // do the rest. It keeps `blind_fire_keeps` missiles back for a proper lock.
  if (pers && !capHit && !foes.length) {
    for (const s of mine) {
      const pr = prof(s);
      if (!pr.blind_fire) continue;
      const have = (s.load || {}).missile || 0;
      if (have <= (pr.blind_fire_keeps ?? 1)) continue;
      const m = R.munitions.missile;
      if (!m) continue;
      const reachHex = m.speed * (m.fuel || 1);
      const spots = (v.contacts || []).filter((c) => c.kind === 'ship').map((c) => c.at).concat(v.ghosts.filter((g) => g.kind === 'ship').map((g) => g.pos));
      if (!spots.length && pr.blind_fire_at_home && v.round >= (pr.blind_fire_from_round ?? 2)) {
        const hp = enemyHomePoint(v, seat, R);
        if (hp) spots.push(hp);
      }
      const aim = spots.filter((c) => minDist(s.cells, [c]) <= reachHex).sort((a, b) => minDist(s.cells, [a]) - minDist(s.cells, [b]))[0];
      if (!aim) continue;
      // one blind shot per target area per round: don't empty the magazine at the same guess
      if (v.objs.some((o) => o.mine && o.kind === 'missile' && !o.target && minDist([o.pos], s.cells) <= 2)) continue;
      const act = E.aimLaunch(state, s.id, 'missile', aim);
      if (act && E.attempt(state, act).ok) return act;
    }
  }
  // 2b. Scan when blind: no enemy located and a scan is ready. Scans only work on a
  // turn the ship has moved, and get stronger the further forward it is, so the
  // computer pushes forward first (step 3) and scans once it is out of its home rows.
  // (the enemy flagship is stealthy now: keep scanning until a big ship is located)
  const bigSeen = foes.some((f) => f.segs.length >= 5);
  if (!easy && !bigSeen && P.cp >= 1) {
    const ready = mine.filter(
      (s) => prof(s).scans !== false && !(s.used || {}).scan && s.scanR && (s.scan.tier >= 1 || (v.contacts || []).length)
    );
    const contacts = v.contacts || [];
    if (ready.length && (contacts.length || v.round >= 3 || foes.length)) {
      const goal = contacts.length ? contactCells : [[0, 0]];
      const s = ready.slice().sort((a, b) => minDist(a.cells, goal) - minDist(b.cells, goal))[0];
      if (!contacts.length || minDist(s.cells, goal) <= s.scanR[1]) return { type: 'scan', ship: s.id };
    }
  }
  // easy: often wanders instead of picking the best move
  if (easy && rnd() < 0.35) {
    const opts = mine.flatMap((s) => E.reach(state, s.id).map((r) => ({ type: 'move', ship: s.id, path: r.path })));
    if (opts.length) return opts[Math.floor(rnd() * opts.length)];
  }
  // 3. Move: pick the ship whose best destination improves its position the most
  const homePoint = enemyHomePoint(v, seat, R) || [0, 0];
  // the map objective: hold it to score; behind on points means push harder
  const obj = v.objective;
  const myScore = (v.scores || [])[seat] || 0, theirScore = (v.scores || [])[1 - seat] || 0;
  const objPull = !obj ? 0 : theirScore > myScore ? 2 : theirScore === myScore ? 1.2 : 0.6;
  const onObj = (cells) => obj && cells.some((c) => H.dist(c, obj.at) <= obj.radius);
  const canHold = (s) => !s.segs.some((g) => (g.parts || []).some((p) => R.parts[p.t].holds_objective === false));
  // variety.opening_lanes: with nothing located yet, each game the fleet comes up the left, the middle
  // or the right (picked from the game's seed) for the first lane_rounds rounds, instead of always
  // marching down the same line
  const lanePoint = (() => {
    if (V.opening_lanes !== true || obj || v.round > (V.lane_rounds ?? 4)) return null;
    const side = (E.fnv('lane|' + (state.fzSalt | 0) + '|' + seat) % 3) - 1, home = enemyHomePoint(v, 1 - seat, R);
    if (!side || !home || !enemyHomePoint(v, seat, R)) return null;
    const a = home, b = homePoint, d = [b[0] - a[0], b[1] - a[1]], len = H.dist(a, b) || 1;
    // a quarter turn in cube coordinates: (turn +60) minus (turn -60) is square to the line home-to-home
    const x = d[0], z = d[1], y = -x - z, perp = [-z + y, -y + x];
    for (let w = v.board.radius * 0.45; w >= 1; w -= 1) {
      const k = (side * w) / (len * Math.sqrt(3));
      const c = H.cubeRound((a[0] + b[0]) / 2 + perp[0] * k, (a[1] + b[1]) / 2 + perp[1] * k);
      if (H.dist([0, 0], c) <= v.board.radius - 1 && !blockSight.has(H.key(c))) return c;
    }
    return null;
  })();
  const knownMines = mine.length && mine.every((s) => prof(s).avoid_mines === false) ? new Set() : new Set(
    // (a personality also plans round its own mines: with friendly fire on, it may not cross them either)
    v.objs.filter((o) => (!o.mine || (pers && R.friendlyFire)) && R.munitions[o.kind] && !R.munitions[o.kind].speed).map((o) => H.key(o.pos))
  );
  const goalCells = foes.length
    ? null
    : (v.contacts || []).length
      ? v.contacts.map((c) => c.at) /* head for the circle's centre: the best single guess */
      : v.ghosts.length
        ? v.ghosts.flatMap((g) => g.cells)
        : obj
          ? [obj.at]
          : [lanePoint || homePoint];
  // tricks.mines_as_bait_rounds: N = for the first N rounds a side that laid mines waits behind them and
  // stands where a mine lies between its ships and the enemy, so the enemy comes to it through the
  // field. 0 (the world file's setting) = never: against a player who also waits, it would be a stall.
  const myMines = v.round <= (T.mines_as_bait_rounds || 0) ? v.objs.filter((o) => o.mine && isMine(o.kind)) : [];
  const holdAt = (() => {
    if (myMines.length < 2) return null;
    const home = enemyHomePoint(v, 1 - seat, R);
    if (!home) return null;
    // the mine nearest home, and two hexes behind it
    const m = myMines.slice().sort((a, b) => H.dist(a.pos, home) - H.dist(b.pos, home))[0];
    const l = H.line(m.pos, home);
    return l[Math.min(2, l.length - 1)];
  })();
  // path-aware approach: BFS over centres where the whole ship fits, so a ship parked
  // behind an asteroid works its way round instead of stalling
  const blockMove = new Set();
  for (const t of R.terrain) {
    const tt = R.terrainTypes[t.type] || {};
    if (tt.blocks_sight || tt.blocks_movement || tt.blocks_move) t.cells.forEach((c) => blockMove.add(H.key(c)));
  }
  const bfsCache = {};
  const stepsToRange = (s, target, want, tag = '') => {
    const ck = s.id + ':' + want + tag;
    if (!bfsCache[ck]) {
      const fits = (c) =>
        s.segs.every((g) => {
          const x = H.add(c, g.off);
          return H.dist([0, 0], x) <= v.board.radius && !blockMove.has(H.key(x)) && !knownMines.has(H.key(x));
        });
      const dist = new Map(),
        q = [];
      for (let qq = -v.board.radius; qq <= v.board.radius; qq++)
        for (let rr = -v.board.radius; rr <= v.board.radius; rr++) {
          const c = [qq, rr];
          if (!fits(c)) continue;
          if (
            minDist(
              s.segs.map((g) => H.add(c, g.off)),
              target.cells
            ) <= want
          ) {
            dist.set(H.key(c), 0);
            q.push(c);
          }
        }
      for (let i = 0; i < q.length; i++)
        for (let d = 0; d < 6; d++) {
          const n = H.step(q[i], d),
            k = H.key(n);
          if (!dist.has(k) && fits(n)) {
            dist.set(k, dist.get(H.key(q[i])) + 1);
            q.push(n);
          }
        }
      bfsCache[ck] = dist;
    }
    return (c) => {
      const x = bfsCache[ck].get(H.key(c));
      return x === undefined ? 99 : x;
    };
  };
  // A ship's working beam weapons, and the most hits any of them would do on foe f with the ship
  // centred on `center` (0 = no shot: out of range, an asteroid in the way, or only wrecks in reach).
  const lasersOf = (s) => s.segs.flatMap((g) => (g.wrecked ? [] : (g.parts || []).filter((p) => p.hp > 0 && R.parts[p.t].range && R.parts[p.t].hits).map((p) => ({ off: g.off, c: R.parts[p.t] }))));
  const hitsFrom = (s, center, f) => {
    let m = 0;
    for (const l of lasersOf(s)) {
      const src = H.add(center, l.off);
      f.cells.forEach((tc, i) => {
        if (f.segs[i].wrecked) return;
        const dd = H.dist(src, tc);
        if (dd < 1 || dd > l.c.range) return;
        const hh = l.c.hits - (l.c.loses_1_hit_every ? Math.floor((dd - 1) / l.c.loses_1_hit_every) : 0);
        if (hh > m && clearLine(src, tc)) m = hh;
      });
    }
    return m;
  };
  // unarmed_ships: bait = a ship with no weapons (a decoy, a picket) runs ahead of the fleet instead
  // of sitting beside the flagship: the enemy that shoots it lights itself up
  // bait_ship: smallest = the smallest escort is sent ahead as bait even if it is armed (a sacrifice)
  const baitId = (mine.filter((m) => !m.flagship).sort((a, b) => a.segs.length - b.segs.length || a.id - b.id)[0] || {}).id;
  // (tricks.decoys_as_bait: every unarmed escort is bait, whatever its personality says)
  const bait = (s) => !!pers && !s.flagship && ((prof(s).bait_ship === 'smallest' && mine.length > 1 && s.id === baitId) || ((prof(s).unarmed_ships === 'bait' || T.decoys_as_bait === true) && !lasersOf(s).length &&
    !(Object.values(s.load || {}).some((n) => n > 0) && s.segs.some((g) => !g.wrecked && (g.parts || []).some((p) => p.hp > 0 && R.parts[p.t].launches)))));
  const zoneOf = (z) => ((R.campaign && R.campaign.zones) || {})[z] || [];
  const scorePos = (s, center) => {
    const cells = s.segs.map((g) => H.add(center, g.off));
    if (cells.some((c) => knownMines.has(H.key(c)))) return -1e6;
    let score = 0;
    const pr = prof(s);
    // story profiles: a route to follow first, a ship to keep away from, running away, marching on
    const via = pr.path_via && !(opts.via || {})[nameOf(s.id)] ? zoneOf(pr.path_via) : null;
    if (pr.stand_off && typeof pr.stand_off === 'object') {
      const from = foes.find((f) => nameOf(f.id) === pr.stand_off.from);
      if (from) { const d0 = minDist(cells, from.cells); if (d0 < pr.stand_off.hexes) score -= (pr.stand_off.hexes - d0) * 6; }
    }
    if (pr.stance === 'flee') return score + (foes.length ? minDist(cells, foes.flatMap((f) => f.cells)) : 0);
    if (pr.stance === 'advance' || (via && via.length && !foes.length)) {
      const goal = via && via.length ? via : [homePoint];
      return score - minDist(cells, goal) * 1.2;
    }
    const { hasLaser, hFull, hitsAt } = laserReach(R, s.segs);
    if (foes.length) {
      let pool = foes.slice();
      if (pers && pr.ignores_harmless === true) { const armed = pool.filter((f) => !harmless(f)); if (armed.length) pool = armed; }
      if (Array.isArray(pr.target)) { const named = pool.filter((f) => pr.target.includes(nameOf(f.id))); if (named.length) pool = named; }
      const target = pool
        .sort((a, b) => (pr.target === 'smallest' ? a.segs.length - b.segs.length : pr.target === 'nearest' ? 0 : b.segs.length - a.segs.length) || minDist(s.cells, a.cells) - minDist(s.cells, b.cells))[0];
      const d = minDist(cells, target.cells);
      let want = (easy ? [2, 3] : v.round > 8 ? [3, 4] : [5, 6])[s.flagship ? 1 : 0]; // normal keeps a cautious stand-off distance
      if (Array.isArray(pr.range)) want = pr.range[s.flagship ? 1 : 0];   // a personality fights from its own range
      if (bait(s)) want = 2;   // a decoy goes right up to them: something to shoot at, and eyes up close
      if (typeof pr.stand_off === 'number') want = pr.stand_off;
      if (pr.stance === 'charge') want = 1;
      score -= d > want ? stepsToRange(s, target, want)(center) * 3 : (want - d) * 3;
      if (hasLaser) {
        // a clear full-strength shot is worth much more than a weakened long-range plink that
        // shields soak (stock laser: full strength out to 4 hexes, weaker from 5 to 8)
        let shot = 0;
        if (pers) {
          // personalities measure the real shot: from the hexes their working lasers sit on, to a
          // segment that is still standing, at the strength the rules give at that distance
          const full = lasersOf(s).reduce((m, l) => Math.max(m, l.c.hits), 0);
          const hh = hitsFrom(s, center, target);
          shot = hh <= 0 ? 0 : hh >= full ? 5 : 2;
          if (!shot) for (const f of foes) if (f !== target) { const h2 = hitsFrom(s, center, f); if (h2 > 0) shot = Math.max(shot, h2 >= full ? 3 : 1.5); }
        } else {
        for (const c of cells)
          for (const tc of target.cells) {
            const hh = hitsAt(H.dist(c, tc));
            if (hh > 0 && clearLine(c, tc)) shot = Math.max(shot, hh >= hFull ? 5 : 2);
          }
        // no clear line on the target: a clear line on any other foe still beats sitting blind
        if (!shot)
          for (const f of foes) {
            if (f === target) continue;
            for (const c of cells) for (const tc of f.cells) { const hh = hitsAt(H.dist(c, tc)); if (hh > 0 && clearLine(c, tc)) shot = Math.max(shot, hh >= hFull ? 3 : 1.5); }
          }
        }
        // nothing to shoot from here at all: don't wait, look for a line (cornered defence gains little)
        if (!shot && d <= want + 2) score -= 2.5;
        score += shot;
      }
      if (d <= 1 && pr.stance !== 'charge') score -= 4; // don't ram
      if (myMines.length && !bait(s)) {
        // a mine of ours between this ship and its target, two to four hexes in front of the ship
        let a = cells[0], b = target.cells[0];
        for (const c of cells) for (const tc of target.cells) if (H.dist(c, tc) < H.dist(a, b)) { a = c; b = tc; }
        const way = H.line(a, b);
        if (myMines.some((m) => { const ds = H.dist(a, m.pos); return ds >= 2 && ds <= 4 && H.dist(m.pos, b) < H.dist(a, b) && way.some((c) => H.dist(c, m.pos) <= 1); })) score += 2.5;
      }
    } else if (holdAt && !bait(s)) {
      score -= minDist(cells, [holdAt]) * (s.flagship ? 1 : 0.8);
    } else {
      // scout ahead, flagship trails the scout a little
      let d = minDist(cells, goalCells);
      // a personality counts the hexes of the way round, so an asteroid in between does not strand it
      if (pers && d > 1) { const way = stepsToRange(s, { cells: goalCells }, 1, 'goal')(center); if (way < 99) d = way + 1; }
      score -= d * (s.flagship ? 0.7 : bait(s) && T.decoys_as_bait === true ? 1.4 : 1);
      const others = mine.filter((m) => m.id !== s.id);
      if (s.flagship && others.length) score -= Math.max(0, minDist(cells, others[0].cells) - 5) * 0.8;
    }
    // a personality keeps its fleet together: an escort that runs ahead alone is picked off
    if (pers && pr.keep_together && !s.flagship) {
      const flag = mine.find((m) => m.flagship && m.id !== s.id);
      // bait runs ahead, but only `bait_lead` hexes: far enough to be shot at first, near enough for the guns behind it to answer
      if (flag) score -= Math.max(0, minDist(cells, flag.cells) - (bait(s) ? pr.bait_lead ?? 4 : pr.keep_together)) * 2;
    }
    if (obj && canHold(s)) {
      // the scout goes for the beacon; the flagship joins in when behind on points
      const w = s.flagship ? (theirScore > myScore ? objPull * 0.6 : 0.2) : objPull;
      score += onObj(cells) ? 3 * w : -minDist(cells, [obj.at]) * 0.5 * w;
    }
    return score;
  };
  // The attack run (world: detection.attack_run_bonus): a ship that has moved this turn hits harder.
  // Before a personality fires, it steps to a hex that keeps the same shot, if it has a command
  // point to spare for the step. Works only from what this seat can see.
  function attackRun(b) {
    const s = b.ship, pr = prof(s);
    if (!pers || pr.attack_run === false || !R.det.attackRun || !b.tgt || s.moved > 0 || (pr.stance === 'hold' && !pr.steps_while_holding)) return null;
    const shots = mine.reduce((n, m) => n + new Set(E.beamTargets(state, m.id).map((t) => t.seg + '.' + t.part)).size, 0);
    if (P.cp < shots + 1) return null;
    const weapon = R.parts[s.segs[b.action.seg].parts[b.action.part].t], off = s.segs[b.action.seg].off;
    const base = (d) => (d >= 1 && d <= weapon.range ? Math.max(0, weapon.hits - (weapon.loses_1_hit_every ? Math.floor((d - 1) / weapon.loses_1_hit_every) : 0)) : 0);
    const mineCells = new Set(mine.filter((m) => m.id !== s.id).flatMap((m) => m.cells.map(H.key)));
    const seenMines = new Set(v.objs.filter((o) => !o.mine && R.munitions[o.kind] && !R.munitions[o.kind].speed).map((o) => H.key(o.pos)));
    // of the steps that keep the shot, take the one nearest the range this ship likes to fight from
    const want = Array.isArray(pr.range) ? pr.range[s.flagship ? 1 : 0] : 4;
    let pick = null;
    for (const r of E.reach(state, s.id)) {
      if (r.path.length > 1) continue;
      const src = H.add(r.at, off);
      let ok = false;
      for (let i = 0; i < b.tgt.cells.length && !ok; i++) {
        if (b.tgt.segs[i].wrecked) continue;
        const tc = b.tgt.cells[i];
        if (base(H.dist(src, tc)) < b.hits || !clearLine(src, tc)) continue;
        ok = !H.line(src, tc).slice(1, -1).some((c) => mineCells.has(H.key(c)));
      }
      if (!ok) continue;
      const cells = s.segs.map((g) => H.add(r.at, g.off));
      if (cells.some((c) => seenMines.has(H.key(c)))) continue;
      const sc = -Math.abs(minDist(cells, b.tgt.cells) - want);
      if (!pick || sc > pick.sc) pick = { sc, action: { type: 'move', ship: s.id, path: r.path } };
    }
    return pick && pick.action;
  }
  let bestMove = null;
  for (const s of mine) {
    if (prof(s).stance === 'hold') continue;
    const here = scorePos(s, s.pos);
    for (const r of E.reach(state, s.id)) {
      const gain = scorePos(s, r.at) - here - r.path.length * 0.05 + noise('m' + s.id + H.key(r.at));
      if (gain > (easy ? 1.5 : 0.5) && (!bestMove || gain > bestMove.gain))
        bestMove = { gain, action: { type: 'move', ship: s.id, path: r.path } };
    }
  }
  if (bestMove) return bestMove.action;
  if (best) return best.action; // a weak shot is better than nothing
  return { type: 'end' };
}

// The middle of the enemy's home zone, whichever of the six edges it is on: where the computer
// heads, and aims a blind missile, when it has nothing better to go on. (It used to assume the
// enemy was north or else south, so on a flank or diagonal board it marched at its own corner.)
// It is the open hex nearest the middle of the open hexes of the zone's first rows, so on a canyon or
// alley board it is the mouth, never a hex inside the rock.
export function enemyHomePoint(v, seat, rules) {
  const H = E.hex, R = v.board.radius;
  const z = v.zones.find((zz) => zz.edge && H.EDGE[zz.edge] && zz.name.indexOf(v.players[1 - seat]) === 0);
  if (!z) return null;
  const rock = new Set((v.terrain || []).filter((t) => ((rules.terrainTypes || {})[t.type] || {}).blocks_movement).flatMap((t) => t.cells.map(H.key)));
  const rows = Math.min(2, Math.max(0, z.depth - 1));
  const cells = H.disc([0, 0], R).filter((c) => H.EDGE[z.edge](c, R) <= rows && !rock.has(H.key(c)));
  if (!cells.length) return null;
  const q = cells.reduce((n, c) => n + c[0], 0) / cells.length, r = cells.reduce((n, c) => n + c[1], 0) / cells.length;
  return cells.reduce((best, c) => (Math.hypot(c[0] - q + (c[1] - r) / 2, (c[1] - r) * 0.866) < Math.hypot(best[0] - q + (best[1] - r) / 2, (best[1] - r) * 0.866) ? c : best));
}

// Which personality a seat plays. Story chapters and ships with their own profiles have none.
// "random" in the world file picks one per game (from the game's own secret salt, so a reloaded
// game keeps the same opponent).
export function personalityOf(state, level, opts = {}) {
  const AI = state.rules.ai || {}, all = AI.personalities || {}, names = Object.keys(all);
  if (opts.personality) return all[opts.personality] || null;
  if (opts.personality === false || level !== 'normal' || opts.profiles || state.rules.campaign || !names.length) return null;
  const want = AI.vs_computer;
  if (want === 'random') return all[names[Math.abs(state.fzSalt | 0) % names.length]];
  return all[want] || null;
}

// The computer in a story chapter: each ship follows its profile from the chapter file.
// Randomness is seeded from the game state, so a replay makes the same choices.
export function campaignMove(state, seat) {
  const C = state.rules.campaign, sc = state.script;
  if (!C || !sc) return computerMove(state, seat, 'normal');
  const profiles = {};
  let level = 'normal';
  for (const s of state.ships) if (!s.dead && s.owner === seat) {
    const name = sc.ai[s.name] || sc.ai['side:' + seat] || C.ai[s.name] || (C.ai.sides || [])[seat];
    const p = name ? C.aiProfiles[name] : null;
    if (p) { profiles[s.id] = p; if (p.level === 'easy') level = 'easy'; }
  }
  let t = (state.rng ^ Math.imul(state.seq + 1, 2654435761)) | 0;
  const rand = () => { t = (t + 0x6d2b79f5) | 0; let x = Math.imul(t ^ (t >>> 15), t | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const names = Object.fromEntries(state.ships.map((s) => [s.id, s.name]));
  return computerMove(state, seat, level, { profiles, rand, nameOf: (id) => names[id] || null, via: sc.via, hitsSoFar: sc.hits[seat + ':' + state.round] || 0 });
}

// A ship's working lasers, straight from the rules (range, hits, falloff), so Combat v2's 3-hit
// laser or a Lab rule change moves the computer's idea of a good firing spot with them.
// segs: the ship's segments as view() gives them. hitsAt(d): best hits at d hexes (0 = out of
// range); hFull: hits at point-blank range (a "full-strength" shot).
export function laserReach(R, segs) {
  const lasers = segs.flatMap((g) => (g.wrecked ? [] : (g.parts || []).filter((p) => p.hp > 0 && R.parts[p.t] && R.parts[p.t].range && R.parts[p.t].hits).map((p) => R.parts[p.t])));
  return {
    hasLaser: lasers.length > 0,
    hFull: lasers.reduce((m, c) => Math.max(m, beamHitsAt(c, 1)), 0),
    hitsAt: (d) => lasers.reduce((m, c) => (d >= 1 && d <= c.range ? Math.max(m, beamHitsAt(c, d)) : m), 0),
  };
}
