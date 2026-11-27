// Muse: a hunter computer opponent, written from scratch (Nov 2026).
//
// It plays the same game as the stock computer — the same actions, the same fog of
// war, the same engine helpers — but it thinks differently. Where the balanced
// computer fights at full laser strength, keeps its fleet together and only shoots
// what it can see clearly, Muse picks the biggest enemy ship it can see and spends
// everything trying to kill it: it closes to point-blank range, fires at the
// flagship even through a bad line, launches missiles at long range, flies Comets
// straight at the flagship to light it up and die flashing, and ignores mines, the
// beacon and its own exposure while the chase is on. It never waits for a better
// shot and never ends a turn with a ship that could still close.
//
//   const action = museMove(game, 1, 'normal');   // null when it is not this seat's turn
//
// Fairness: it reads only what its own side can see (view() for its seat, plus the
// engine's option helpers, which respect the fog of war). The enemy flagship is
// never named in the fog, so the "flagship" it hunts is a guess: the biggest ship
// it can see. Determinism: no Math.random, no Date — ties are broken by a nudge
// drawn from the game's own seed, so the same game replays exactly.

import * as E from './index.js';
import { beamHitsAt } from './actions.js';

export function museMove(state, seat, level = 'normal', opts = {}) {
  const H = E.hex, R = state.rules;
  const v = E.view(state, seat);
  if (v.phase !== 'play' || v.toMove !== seat) return null;
  const cp = v.cp, cost = R.cost || {};
  const own = v.ships.filter((s) => s.mine);
  const foes = v.ships.filter((s) => !s.mine && s.seen);
  if (!own.length) return { type: 'end' };

  const isMine = (kind) => { const m = R.munitions[kind]; return !!m && !m.speed && !!m.hits; };
  const blockSight = new Set();
  for (const t of R.terrain)
    if ((R.terrainTypes[t.type] || {}).blocks_sight) t.cells.forEach((c) => blockSight.add(H.key(c)));
  const minDist = (A, B) => {
    let m = 1e9;
    for (const a of A) for (const b of B) m = Math.min(m, H.dist(a, b));
    return m;
  };
  const shipById = (id) => v.ships.find((s) => s.id === id);
  // a nudge from the game's own seed: the same game replays exactly, a new game
  // breaks its ties differently. Same shape as the stock computer's, different numbers.
  const noise = (tag) => (E.seededRandom(E.fnv(((state.fzSalt | 0) + '|' + state.round + '|' + seat + '|' + tag)))() - 0.5) * 0.02;
  const draw = (tag) => E.seededRandom(E.fnv(((state.fzSalt | 0) + '|' + state.round + '|' + (state.seq || 0) + '|' + seat + '|' + tag)))();
  // the chosen action, checked against the engine before it leaves here
  const pick = (act) => (act && E.attempt(state, act).ok ? act : { type: 'end' });

  // The quarry: the biggest enemy ship in sight. The fog never names the flagship,
  // so size is the guess — and a guess is all a hunter needs.
  const quarry = foes.slice().sort((a, b) => b.segs.length - a.segs.length || minDist(own.flatMap((s) => s.cells), a.cells) - minDist(own.flatMap((s) => s.cells), b.cells))[0] || null;
  // Where the quarry was last seen, where something roughly is, where the enemy lives:
  // the hunt moves down this list when it has nothing in sight.
  const huntCells = (() => {
    if (quarry) return quarry.cells;
    const ghosts = (v.ghosts || []).filter((g) => g.kind === 'ship');
    if (ghosts.length) return ghosts.slice().sort((a, b) => minDist(own.flatMap((s) => s.cells), [a.pos]) - minDist(own.flatMap((s) => s.cells), [b.pos]))[0].cells || [ghosts[0].pos];
    const contacts = (v.contacts || []).filter((c) => c.kind === 'ship');
    if (contacts.length) return [contacts.slice().sort((a, b) => minDist(own.flatMap((s) => s.cells), [a.at]) - minDist(own.flatMap((s) => s.cells), [b.at]))[0].at];
    const home = museHomePoint(v, seat, R);
    return home ? [home] : [[0, 0]];
  })();
  // Enemy mines this side knows about: the flagship steers a hex clear of them, because
  // losing the flagship loses the game. Escorts do not — a hunter spends escorts.
  const knownMines = new Set();
  for (const o of v.objs) if (!o.mine && isMine(o.kind)) for (const c of H.disc(o.pos, (R.munitions[o.kind].trigger_range || 0) + 1)) knownMines.add(H.key(c));
  const ownMineHexes = new Set(v.objs.filter((o) => o.mine && isMine(o.kind)).map((o) => H.key(o.pos)));

  // Path-aware distance: how many whole-ship steps a centre is from being within
  // `want` hexes of the goal cells, walking round rocks and known mines. The
  // straight-line distance lies about a canyon: every hex round a bend looks further
  // away, so a hunter that only trusts the straight line parks at the mouth of the
  // canyon and waits for a quarry that never comes (The Dogleg: 20 draws to the
  // round limit, both flagships sitting still). The BFS is the honest distance.
  const rock = new Set((v.terrain || []).filter((t) => ((R.terrainTypes || {})[t.type] || {}).blocks_movement).flatMap((t) => t.cells.map(H.key)));
  const bfsCache = {};
  const stepsTo = (s, goals, want) => {
    const ck = s.id + ':' + goals.map(H.key).join('|') + ':' + want;
    if (!bfsCache[ck]) {
      const fits = (c) => s.segs.every((g) => {
        const x = H.add(c, g.off);
        return H.dist([0, 0], x) <= v.board.radius && !rock.has(H.key(x)) && !(s.flagship && knownMines.has(H.key(x)));
      });
      const dist = new Map(), q = [];
      for (let qq = -v.board.radius; qq <= v.board.radius; qq++)
        for (let rr = -v.board.radius; rr <= v.board.radius; rr++) {
          const c = [qq, rr];
          if (!fits(c)) continue;
          if (minDist(s.segs.map((g) => H.add(c, g.off)), goals) <= want) { dist.set(H.key(c), 0); q.push(c); }
        }
      for (let i = 0; i < q.length; i++)
        for (let d = 0; d < 6; d++) {
          const n = H.step(q[i], d), k = H.key(n);
          if (!dist.has(k) && fits(n)) { dist.set(k, dist.get(H.key(q[i])) + 1); q.push(n); }
        }
      bfsCache[ck] = dist;
    }
    const m = bfsCache[ck];
    return (c) => { const x = m.get(H.key(c)); return x === undefined ? 99 : x; };
  };

  // A ship's working beam weapons, from what its own side can see of it.
  const lasersOf = (s) => s.segs.flatMap((g) => (g.wrecked ? [] : (g.parts || []).filter((p) => p.hp > 0 && R.parts[p.t].range && R.parts[p.t].hits).map((p) => ({ off: g.off, c: R.parts[p.t] }))));
  const friendAt = new Map();
  for (const m of own) m.cells.forEach((c, i) => { if (!m.segs[i].wrecked) friendAt.set(H.key(c), m.id); });
  // The hardest this ship would hit the target with its centre on `center`, after the
  // step there (so the attack-run hit counts). 0 = no shot from there.
  const shotAt = (s, center, f) => {
    const ev = f.segs.reduce((x, g) => Math.max(x, ...(g.wrecked || !g.parts ? [] : g.parts.filter((p) => p.hp > 0).map((p) => R.parts[p.t].evades_beyond || 0))), 0);
    const run = (R.det || {}).attackRun || 0;
    let m = 0;
    for (const l of lasersOf(s)) {
      const src = H.add(center, l.off);
      f.cells.forEach((tc, i) => {
        if (f.segs[i].wrecked) return;
        const d = H.dist(src, tc);
        if (d < 1 || d > l.c.range || (ev && d > ev)) return;
        const hh = beamHitsAt(l.c, d) + run;
        if (hh <= m) return;
        const way = H.sightLine(src, tc, (c) => blockSight.has(H.key(c)));
        if (way && !way.slice(1, -1).some((c) => { const id = friendAt.get(H.key(c)); return id && id !== s.id; })) m = hh;
      });
    }
    return m;
  };
  const fullHits = (s) => lasersOf(s).reduce((m, l) => Math.max(m, beamHitsAt(l.c, 1)), 0);
  const liveSegs = (t) => t.segs.filter((g) => !g.wrecked);
  // A ship on its own drive (a Comet's afterburner, a courier's sprint drive): it flies
  // on its own, needing no thrust — and the hunter spends it like it flies.
  const onOwnDrive = (s) => s.segs.some((g) => !g.wrecked && (g.parts || []).some((p) => p.hp > 0 && R.parts[p.t].own_move));

  // ---- easy: the same hunter, but it blunders ----
  // One call in three it takes a random legal action instead of its best guess, using a
  // draw from the game's seed, so an easy game still replays exactly.
  if (level === 'easy' && (opts.rand ? opts.rand() < 0.3 : draw('blunder') < 0.3)) {
    const cands = [{ type: 'end' }];
    for (const s of own) {
      for (const t of E.beamTargets(state, s.id)) cands.push({ type: 'fire', ship: s.id, seg: t.seg, part: t.part, at: t.at });
      for (const r of E.reach(state, s.id).slice(0, 6)) cands.push({ type: 'move', ship: s.id, path: r.path });
    }
    const n = cands.length, i = Math.floor((opts.rand ? opts.rand() : draw('pick')) * n);
    return pick(cands[Math.min(i, n - 1)]);
  }

  // Out of command points: the turn is over, unless a ship is mid-salvo (its other
  // launchers fire free) — then it may still loose at the quarry.
  if (cp <= 0 && !(R.salvo && own.some((s) => (s.used || {}).salvo && E.launchOptions(state, s.id)))) return { type: 'end' };

  // ---- 1. Fire: the best shot at the quarry, or at anything big ----
  let best = null;
  for (const s of own) {
    for (const t of E.beamTargets(state, s.id)) {
      const tgt = shipById(t.target);
      let score;
      if (tgt) {
        score = t.hits * 10 + (tgt === quarry ? 30 : tgt.segs.length >= 5 ? 12 : 3);
        // a killing shot: one live segment left, and this shot is strong enough to end it
        if (liveSegs(tgt).length === 1 && t.hits >= 3) score += 25;
        // wreck the segment it strikes: its remaining working parts are within this shot
        const gi = tgt.cells.findIndex((c) => c[0] === t.at[0] && c[1] === t.at[1]);
        const g = gi >= 0 ? tgt.segs[gi] : null;
        if (g && g.parts) {
          const hp = g.parts.reduce((n, p) => n + (p.hp > 0 ? p.hp : 0), 0);
          if (hp > 0 && hp <= t.hits) score += 15;
        }
      } else {
        const o = v.objs.find((x) => x.id === t.target);
        // shoot down a missile closing on one of its own ships; mines and drones are not
        // worth a shot — the hunter does not clear the way, it goes through it
        score = o && E.isMissile(R, o.kind) && minDist([o.pos], own.flatMap((m) => m.cells)) <= 6 ? 25 : 0;
      }
      score += noise('f' + s.id + t.seg + '.' + t.part + H.key(t.at));
      if (!best || score > best.score) best = { score, ship: s, tgt, action: { type: 'fire', ship: s.id, seg: t.seg, part: t.part, at: t.at } };
    }
  }
  if (best && best.score >= 10) {
    // the attack run: this ship has not moved yet and a one-hex step would make the
    // same shot hit harder, so step first — but only when the step keeps the shot
    const s = best.ship, run = (R.det || {}).attackRun || 0;
    if (run > 0 && s.moved === 0 && cp >= (cost.fire || 1) + (cost.move || 1) && best.tgt) {
      const now = shotAt(s, s.pos, best.tgt) - run; // the shot as it stands, without the bonus
      let step = null;
      for (const r of E.reach(state, s.id)) {
        if (r.path.length !== 1) continue;
        const hh = shotAt(s, r.at, best.tgt);
        if (hh > now && (!step || hh > step.hh)) step = { hh, action: { type: 'move', ship: s.id, path: r.path } };
      }
      if (step) return pick(step.action);
    }
    return pick(best.action);
  }

  // ---- 2. Launch: a missile at the quarry, from the hex it gets there soonest ----
  // The hunter launches at long range (12 hexes) and lets the missile arrive within
  // two flight phases; a missile that cannot be forecast onto its target is not spent.
  for (const s of own) {
    const lo = E.launchOptions(state, s.id);
    if (!lo) continue;
    const mk = E.missileKinds(R, Object.fromEntries(lo.kinds.map((k) => [k, (s.load || {})[k] || 0]))).find((k) => lo.kinds.includes(k));
    if (!mk) continue;
    const targets = lo.locks.map(shipById).filter(Boolean)
      .map((t) => ({ t, d: minDist(s.cells, t.cells) }))
      .filter((x) => x.d <= 12)
      .sort((a, b) => (a.t === quarry ? -1 : b.t === quarry ? 1 : b.t.segs.length - a.t.segs.length) || a.d - b.d);
    if (!targets.length) continue;
    let launch = null;
    for (const { t } of targets) {
      for (const st of lo.starts) {
        const act = { type: 'launch', ship: s.id, kind: mk, start: st, target: t.id, route: [] };
        const fc = E.forecast(state, act);
        if (!fc || fc.ends !== 'hit' || fc.hit !== t.id || fc.rounds > 2) continue;
        if (!launch || fc.path.length < launch.n) launch = { n: fc.path.length, act };
      }
      if (launch) break;
    }
    if (launch) return pick(launch.act);
  }
  // ---- 2a. Blind fire: nothing located, so guess where the quarry is ----
  // A missile down the line at a last-seen position, a fuzzy contact, or the middle
  // of the enemy's home rows — weakest missile first, one kept back for a real lock.
  if (!foes.length) {
    for (const s of own) {
      const lo = E.launchOptions(state, s.id);
      if (!lo) continue;
      const have = Object.keys(s.load || {}).reduce((n, k) => n + (E.isMissile(R, k) ? s.load[k] || 0 : 0), 0);
      if (have <= 1) continue;
      const bk = E.missileKinds(R, s.load || {}, true)[0];
      const m = bk && R.munitions[bk];
      if (!m) continue;
      const aim = huntCells[0];
      if (!aim || minDist(s.cells, [aim]) > m.speed * (m.fuel || 1)) continue;
      if (v.objs.some((o) => o.mine && E.isMissile(R, o.kind) && !o.target && minDist([o.pos], s.cells) <= 2)) continue;
      const act = E.aimLaunch(state, s.id, bk, aim);
      if (act) return pick(act);
    }
  }

  // ---- 2b. Detonate: a drone of its own next to the quarry goes off ----
  for (const o of v.objs) {
    const m = R.munitions[o.kind];
    if (!o.mine || !m.remote_detonate || cp < (cost.detonate || 1)) continue;
    const r = m.blast_radius || 0;
    const inBlast = (x) => x.cells.filter((c, i) => !x.segs[i].wrecked && H.dist(c, o.pos) <= r).length;
    if (foes.reduce((n, f) => n + inBlast(f), 0) >= 2 && !own.some((x) => inBlast(x))) return pick({ type: 'detonate', obj: o.id });
  }

  // ---- 3. Scan: no big ship located yet, so look for one ----
  // A scan only works on a turn the ship has moved, so this fires after a move step.
  const bigSeen = foes.some((f) => f.segs.length >= 5);
  if (!bigSeen && cp >= (cost.scan || 1)) {
    const ready = own.filter((s) => !(s.used || {}).scan && s.scanR);
    if (ready.length) {
      const s = ready.slice().sort((a, b) => minDist(a.cells, huntCells) - minDist(b.cells, huntCells))[0];
      return pick({ type: 'scan', ship: s.id });
    }
  }
  // The quarry is located but unread (no scan readout): read it, so the hunter knows
  // what to break first.
  if (quarry && quarry.tier < 3 && cp >= (cost.scan || 1)) {
    const ready = own.filter((s) => !(s.used || {}).scan && s.scanR && minDist(s.cells, quarry.cells) <= s.scanR[1]);
    if (ready.length) return pick({ type: 'scan', ship: ready[0].id });
  }

  // ---- 4. Move: close on the quarry, and stay close ----
  const scorePos = (s, center) => {
    const cells = s.segs.map((g) => H.add(center, g.off));
    // the flagship never ends its move where a known mine could reach it; an escort
    // takes that hex without a second thought
    if (s.flagship && cells.some((c) => knownMines.has(H.key(c)) || ownMineHexes.has(H.key(c)))) return -1e6;
    let score = 0;
    if (quarry) {
      const d = minDist(cells, quarry.cells);
      const steps = stepsTo(s, quarry.cells, 2)(center);
      // already point-blank: the fine distance matters; on the way: the path length;
      // unreachable by path: fall back to the straight line and hope.
      score += steps >= 99 ? (d <= 2 ? 4 - d : -(d - 2) * 2) : steps === 0 ? 4 - d : -steps * 2;
      const hh = shotAt(s, center, quarry);
      score += hh <= 0 ? 0 : hh >= fullHits(s) ? 5 : 2;   // ...and a full-strength shot from there is worth more
    } else {
      const steps = stepsTo(s, huntCells, 2)(center);
      score -= steps >= 99 ? minDist(cells, huntCells) * 1.5 : steps * 1.5;   // nothing in sight: hunt, do not hold
    }
    // loose formation: an escort far ahead of the flagship is on its own, and the hunter
    // still wants its guns behind it — but only loosely, it does not wait for stragglers.
    // A ship on its own drive is exempt: a Comet flies ahead on purpose, to find the
    // quarry and die flashing, and no gunship is expected to keep up with it.
    if (!s.flagship && !onOwnDrive(s)) {
      const flag = own.find((m) => m.flagship && m.id !== s.id);
      if (flag) score -= Math.max(0, minDist(cells, flag.cells) - 8) * 0.5;
    }
    return score;
  };
  let bestMove = null, bestProgress = null;
  const goalCells = quarry ? quarry.cells : huntCells;
  for (const s of own) {
    const here = scorePos(s, s.pos);
    const stepsHere = stepsTo(s, goalCells, 2)(s.pos);
    for (const r of E.reach(state, s.id)) {
      const sc = scorePos(s, r.at);
      const gain = sc - here - r.path.length * 0.05 + noise('m' + s.id + H.key(r.at));
      if (gain > 0.5 && (!bestMove || gain > bestMove.gain)) bestMove = { gain, action: { type: 'move', ship: s.id, path: r.path } };
      // Progress the score does not see: a step that shortens the path to the goal,
      // even if it gives up a firing position to do it. The score's shot bonus can
      // outweigh one step closer; the hunt still wants the step.
      const steps = stepsTo(s, goalCells, 2)(r.at);
      if (steps < stepsHere && sc > -1e6 && (!bestProgress || steps < bestProgress.steps || (steps === bestProgress.steps && sc > bestProgress.score))) bestProgress = { steps, score: sc, action: { type: 'move', ship: s.id, path: r.path } };
    }
  }
  if (bestMove) return pick(bestMove.action);
  if (bestProgress) return pick(bestProgress.action);
  if (best) return pick(best.action); // a weak shot is better than sitting still
  return { type: 'end' };
}

// The middle of the enemy's home zone, whichever of the six edges it is on: where the
// hunter heads, and aims a blind missile, when it has nothing better to go on. The open
// hex nearest the middle of the zone's first rows, so on a canyon or alley board it is
// the mouth, never a hex inside the rock.
export function museHomePoint(v, seat, rules) {
  const H = E.hex, R = v.board.radius;
  const z = v.zones.find((zz) => zz.edge && H.EDGE[zz.edge] && zz.name.indexOf(v.players[1 - seat]) === 0);
  if (!z) return null;
  const rock = new Set((v.terrain || []).filter((t) => ((rules.terrainTypes || {})[t.type] || {}).blocks_movement).flatMap((t) => t.cells.map(H.key)));
  const cells = H.disc([0, 0], R).filter((c) => H.EDGE[z.edge](c, R) <= 1 && !rock.has(H.key(c)));
  if (!cells.length) return null;
  const q = cells.reduce((n, c) => n + c[0], 0) / cells.length, r = cells.reduce((n, c) => n + c[1], 0) / cells.length;
  return cells.reduce((best, c) => (Math.hypot(c[0] - q + (c[1] - r) / 2, (c[1] - r) * 0.866) < Math.hypot(best[0] - q + (best[1] - r) / 2, (best[1] - r) * 0.866) ? c : best));
}