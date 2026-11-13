// A computer opponent. It plays fair: it only uses what its own side can see
// (view() for its seat, plus the engine's own option helpers, which respect the fog of war).
// "easy" makes random choices some of the time; "normal" plays its best guess every time.
//
//   const action = computerMove(game, 1, 'normal');   // null when it is not this seat's turn

import * as E from './index.js';

export function computerMove(state, seat, level = 'normal') {
  const easy = level === 'easy';
  const H = E.hex,
    R = state.rules;
  const v = E.view(state, seat);
  if (v.phase !== 'play' || v.toMove !== seat) return null;
  const P = state.players[seat];
  if (P.cp <= 0) return { type: 'end' };
  const mine = v.ships.filter((s) => s.mine);
  const foes = v.ships.filter((s) => !s.mine && s.seen);
  const blockSight = new Set();
  for (const t of R.terrain)
    if ((R.terrainTypes[t.type] || {}).blocks_sight) t.cells.forEach((c) => blockSight.add(H.key(c)));
  const minDist = (A, B) => {
    let m = 1e9;
    for (const a of A) for (const b of B) m = Math.min(m, H.dist(a, b));
    return m;
  };
  const clearLine = (a, b) => {
    const l = H.line(a, b);
    for (let i = 1; i < l.length - 1; i++) if (blockSight.has(H.key(l[i]))) return false;
    return true;
  };
  const shipById = (id) => v.ships.find((s) => s.id === id);
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
  // 1. Fire: best laser shot available (prefer flagship, then most hits, then incoming missiles)
  let best = null;
  for (const s of mine) {
    for (const t of E.beamTargets(state, s.id)) {
      const tgt = shipById(t.target);
      let score = t.hits * 10;
      if (tgt)
        score += tgt.segs.length >= 5 ? 6 : 3; // enemy flagship is unknown; guess the big one
      else {
        const o = v.objs.find((o) => o.id === t.target);
        // shoot down missiles that are close to my ships
        score =
          o &&
          o.kind === 'missile' &&
          minDist(
            [o.pos],
            mine.flatMap((m) => m.cells)
          ) <= 6
            ? 25
            : 2;
      }
      if (!best || score > best.score)
        best = { score, action: { type: 'fire', ship: s.id, seg: t.seg, part: t.part, at: t.at } };
    }
  }
  // easy: fires at whatever it happens to pick, not the best target
  if (easy && best && best.score >= 10) {
    const all = mine.flatMap((s) =>
      E.beamTargets(state, s.id).map((t) => ({ type: 'fire', ship: s.id, seg: t.seg, part: t.part, at: t.at }))
    );
    if (all.length && Math.random() < 0.5) return all[Math.floor(Math.random() * all.length)];
  }
  if (best && best.score >= 10) return best.action;
  // 2. Launch a locked missile at a visible ship within sensible range
  for (const s of mine) {
    const lo = E.launchOptions(state, s.id);
    if (!lo || !lo.kinds.includes('missile') || !lo.locks.length) continue;
    const targets = lo.locks
      .map(shipById)
      .filter(Boolean)
      .map((t) => ({ t, d: minDist(s.cells, t.cells) }))
      .filter((x) => x.d <= (easy ? 3 : 5)) // close range: little time to react, point defence gets fewer shots
      .sort((a, b) => b.t.segs.length - a.t.segs.length || a.d - b.d);
    if (!targets.length) continue;
    const t = targets[0].t;
    let start = lo.starts[0];
    for (const st of lo.starts) if (minDist([st], t.cells) < minDist([start], t.cells)) start = st;
    const act = { type: 'launch', ship: s.id, kind: 'missile', start, target: t.id, route: [] };
    if (easy && Math.random() < 0.5) continue; // easy: hesitates
    return act;
  }
  // 2b. Scan when blind: no enemy located and a scan is ready. Scans only work on a
  // turn the ship has moved, and get stronger the further forward it is, so the
  // computer pushes forward first (step 3) and scans once it is out of its home rows.
  // (the enemy flagship is stealthy now: keep scanning until a big ship is located)
  const bigSeen = foes.some((f) => f.segs.length >= 5);
  if (!easy && !bigSeen && P.cp >= 1) {
    const ready = mine.filter(
      (s) => !(s.used || {}).scan && s.scanR && (s.scan.tier >= 1 || (v.contacts || []).length)
    );
    const contacts = v.contacts || [];
    if (ready.length && (contacts.length || v.round >= 3 || foes.length)) {
      const goal = contacts.length ? contactCells : [[0, 0]];
      const s = ready.slice().sort((a, b) => minDist(a.cells, goal) - minDist(b.cells, goal))[0];
      if (!contacts.length || minDist(s.cells, goal) <= s.scanR[1]) return { type: 'scan', ship: s.id };
    }
  }
  // easy: often wanders instead of picking the best move
  if (easy && Math.random() < 0.35) {
    const opts = mine.flatMap((s) => E.reach(state, s.id).map((r) => ({ type: 'move', ship: s.id, path: r.path })));
    if (opts.length) return opts[Math.floor(Math.random() * opts.length)];
  }
  // 3. Move: pick the ship whose best destination improves its position the most
  const enemyHome = v.zones.find((z) => z.name.indexOf(v.players[seat]) !== 0);
  const homePoint = enemyHome
    ? enemyHome.edge === 'north'
      ? [0, -(v.board.radius - 2)]
      : [0, v.board.radius - 2]
    : [0, 0];
  // the map objective: hold it to score; behind on points means push harder
  const obj = v.objective;
  const myScore = (v.scores || [])[seat] || 0, theirScore = (v.scores || [])[1 - seat] || 0;
  const objPull = !obj ? 0 : theirScore > myScore ? 2 : theirScore === myScore ? 1.2 : 0.6;
  const onObj = (cells) => obj && cells.some((c) => H.dist(c, obj.at) <= obj.radius);
  const knownMines = new Set(
    v.objs.filter((o) => !o.mine && R.munitions[o.kind] && !R.munitions[o.kind].speed).map((o) => H.key(o.pos))
  );
  const goalCells = foes.length
    ? null
    : (v.contacts || []).length
      ? v.contacts.map((c) => c.at) /* head for the circle's centre: the best single guess */
      : v.ghosts.length
        ? v.ghosts.flatMap((g) => g.cells)
        : obj
          ? [obj.at]
          : [homePoint];
  // path-aware approach: BFS over centres where the whole ship fits, so a ship parked
  // behind an asteroid works its way round instead of stalling
  const blockMove = new Set();
  for (const t of R.terrain) {
    const tt = R.terrainTypes[t.type] || {};
    if (tt.blocks_sight || tt.blocks_movement || tt.blocks_move) t.cells.forEach((c) => blockMove.add(H.key(c)));
  }
  const bfsCache = {};
  const stepsToRange = (s, target, want) => {
    const ck = s.id + ':' + want;
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
  const scorePos = (s, center) => {
    const cells = s.segs.map((g) => H.add(center, g.off));
    if (cells.some((c) => knownMines.has(H.key(c)))) return -1e6;
    let score = 0;
    const hasLaser = s.segs.some((g) => (g.parts || []).some((p) => p.hp > 0 && R.parts[p.t].range));
    if (foes.length) {
      const target = foes
        .slice()
        .sort((a, b) => b.segs.length - a.segs.length || minDist(s.cells, a.cells) - minDist(s.cells, b.cells))[0];
      const d = minDist(cells, target.cells);
      let want = (easy ? [2, 3] : v.round > 8 ? [3, 4] : [5, 6])[s.flagship ? 1 : 0]; // normal keeps a cautious stand-off distance
      score -= d > want ? stepsToRange(s, target, want)(center) * 3 : (want - d) * 3;
      if (hasLaser) {
        // a clear 2-hit shot (4 hexes) is worth much more than a 1-hit plink that shields soak
        let shot = 0;
        for (const c of cells)
          for (const tc of target.cells) {
            const dd = H.dist(c, tc);
            if (dd >= 1 && dd <= 8 && clearLine(c, tc)) shot = Math.max(shot, dd <= 4 ? 5 : 2);
          }
        score += shot;
      }
      if (d <= 1) score -= 4; // don't ram
    } else {
      // scout ahead, flagship trails the scout a little
      const d = minDist(cells, goalCells);
      score -= d * (s.flagship ? 0.7 : 1);
      const others = mine.filter((m) => m.id !== s.id);
      if (s.flagship && others.length) score -= Math.max(0, minDist(cells, others[0].cells) - 5) * 0.8;
    }
    if (obj) {
      // the scout goes for the beacon; the flagship joins in when behind on points
      const w = s.flagship ? (theirScore > myScore ? objPull * 0.6 : 0.2) : objPull;
      score += onObj(cells) ? 3 * w : -minDist(cells, [obj.at]) * 0.5 * w;
    }
    return score;
  };
  let bestMove = null;
  for (const s of mine) {
    const here = scorePos(s, s.pos);
    for (const r of E.reach(state, s.id)) {
      const gain = scorePos(s, r.at) - here - r.path.length * 0.05;
      if (gain > (easy ? 1.5 : 0.5) && (!bestMove || gain > bestMove.gain))
        bestMove = { gain, action: { type: 'move', ship: s.id, path: r.path } };
    }
  }
  if (bestMove) return bestMove.action;
  if (best) return best.action; // a weak shot is better than nothing
  return { type: 'end' };
}
