// The Ship Lab: design ships, compare how they see and hide from each other,
// and fight sandbox duels. Everything here calls the game's own engine: rules
// are built by buildRules (the same YAML parser and validator Play uses), ships
// are real engine ships inside a sandbox game from start(), and every number
// (signature, sensor, detection, scan rings, damage, shields, point defence,
// missiles, thrust, cost) comes from engine helpers or engine actions.

import * as E from '../engine/index.js';
import { computerMove } from '../engine/ai.js';
import { s as svgEl, partLooks } from './board.js';
import { $, h, rules, game, store, say, reduceMotion, newGame, plural, wholeMap, render, setRules } from './play.js';
const { hex } = E;

let labDocs = null;     // the parsed rule files { world, map, fleets }
export function setLabDocs(docs) { labDocs = docs; }


const LAB = {
  a: null,
  b: null,
  sel: { a: 0, b: 0 },
  knobs: {},
  situ: { a: {}, b: {} },
  tier: { a: 2, b: 2 },
  dist: 6,
  sim: { dist: 9, polA: 'close', polB: 'hold', first: 'a', runs: 200, missiles: true, jitter: true },
  simOut: null,
  mcOut: null,
  whatOut: null,
  play: { p1: ['A'], p2: ['B'], sandbox: false },
  busy: false
};

const LAB_KNOBS = [
  // [label, path in world YAML, kind, hint]
  ['Still bonus (signature)', 'detection.still_signature_bonus', 'num', 'added to a ship that did nothing on its turn'],
  ['Big-move wake (signature)', 'detection.move_signature_penalty', 'num', 'added after a big move'],
  ['Big move = hexes', 'detection.move_signature_from_hexes', 'num', ''],
  [
    'Stealth floor: segments per point',
    'detection.stealth_floor_segments_per_point',
    'num',
    'floor = ceil(segments / this)'
  ],
  ['Stealth part: signature per part', 'bay_parts.stealth.hides', 'num', ''],
  ['Sensor part: + range', 'bay_parts.sensor.adds_range', 'num', ''],
  ['Core: sensor range', 'bay_parts.core.sensor_range', 'num', ''],
  [
    'Passive rough-area margin',
    'detection.passive_fuzzy_extra',
    'num',
    'rough contacts appear this far beyond detection'
  ],
  ['Scan tiers [clear, faint]', 'detection.scan_tiers', 'tiers', 'near home / mid-field / forward'],
  ['Flare: laser fired (miss)', 'detection.flare.fire_beam', 'num', ''],
  ['Flare: laser hit', 'detection.flare.beam_hit', 'num', ''],
  ['Flare: launch', 'detection.flare.launch', 'num', ''],
  ['Flare: point defence', 'detection.flare.point_defence_shot', 'num', ''],
  ['Flare: scan', 'detection.flare.scan', 'num', ''],
  [
    'Shield: hits soaked per round',
    'mount_parts.shield.hp',
    'num',
    'a shield soaks this many hits on its segment each round'
  ],
  ['Shield: recharges each round', 'mount_parts.shield.recharges', 'bool', ''],
  ['Shield: cost', 'mount_parts.shield.cost', 'num', ''],
  ['Armour: hit points', 'mount_parts.armour.hp', 'num', ''],
  ['Laser: hits', 'mount_parts.laser.hits', 'num', ''],
  ['Laser: range', 'mount_parts.laser.range', 'num', ''],
  ['Laser: loses 1 hit every N hexes', 'mount_parts.laser.loses_1_hit_every', 'num', ''],
  [
    'Point defence: stops per round',
    'mount_parts.point_defence.stops_per_round',
    'num',
    'PD is certain, not a chance: it stops this many incoming per round'
  ],
  ['Missile: speed', 'munitions.missile.speed', 'num', ''],
  ['Missile: fuel (rounds)', 'munitions.missile.fuel', 'num', ''],
  ['Missile: hits', 'munitions.missile.hits', 'num', ''],
  ['Missile: blast radius', 'munitions.missile.blast_radius', 'num', '']
];

// ---------- rules plumbing (shared with Play) ----------
function labGet(o, p) {
  for (let k of p.split('.')) o = o == null ? undefined : o[k];
  return o;
}

function labSet(o, p, val) {
  let ks = p.split('.'),
    last = ks.pop();
  for (let k of ks) o = o[k] = o[k] || {};
  o[last] = val;
}

function labWorld(knobs) {
  let w = structuredClone(labDocs.world);
  for (let [p, val] of Object.entries(knobs || {})) labSet(w, p, val);
  return w;
}

function labStoredKnobs() {
  try {
    return JSON.parse(store.get('shatkon.labKnobs') || '{}') || {};
  } catch {
    return {};
  }
}

// the lab arena: an empty board big enough for long-range tests
function labArena(R, terrain) {
  let m = structuredClone(labDocs.map);
  m.map = {
    ...m.map,
    name: 'Lab arena',
    board: { shape: 'hexagon', radius: R },
    terrain: terrain || [],
    setup: { ...(m.map.setup || {}), mines: { own_home_zone: true, rows_into_no_mans_land: 0 } }
  };
  return m;
}

function labClean(d) {
  return {
    name: d.name || 'Ship',
    ...(d.flagship ? { flagship: true } : {}),
    ...(d.load && Object.values(d.load).some((x) => x > 0) ? { load: { ...d.load } } : {}),
    hull: d.hull.map((s) => ({
      at: s.at.slice(),
      bays: (s.bays || []).filter(Boolean),
      ...((s.mounts || []).filter(Boolean).length ? { mounts: s.mounts.filter(Boolean) } : {})
    }))
  };
}

// find starting spots inside a player's home zone (uses the engine's zone edges)
function labPlace(rulesProbe, designs, player, map) {
  let mm = (map && map.map) || map,
    R = mm.board.radius,
    zn = mm.zones['player_' + (player + 1) + '_home'],
    edge = hex.EDGE[zn.edge],
    blocked = new Set(),
    used = new Set(),
    out = [];
  for (let t of rulesProbe.terrain) {
    if ((rulesProbe.terrainTypes[t.type] || {}).blocks_movement) t.cells.forEach((c) => blocked.add(hex.key(c)));
  }
  let cands = hex
    .disc([0, 0], R)
    .filter((c) => edge(c, R) < zn.depth)
    .sort((p, q) => Math.abs(p[0] + p[1] / 2) - Math.abs(q[0] + q[1] / 2) || edge(q, R) - edge(p, R));
  for (let d of designs) {
    let spot = null;
    for (let c of cands) {
      let cells = d.hull.map((s) => hex.add(c, s.at));
      if (
        cells.every(
          (x) => hex.inHexagon(x, R) && edge(x, R) < zn.depth && !blocked.has(hex.key(x)) && !used.has(hex.key(x))
        )
      ) {
        spot = c;
        cells.forEach((x) => used.add(hex.key(x)));
        break;
      }
    }
    out.push(spot || [0, 0]);
  }
  return out;
}

// build engine rules for two fleets (arrays of designs) on a map
function labRules(p1, p2, opt) {
  opt = opt || {};
  let world = labWorld(opt.knobs != null ? opt.knobs : LAB.knobs),
    map = opt.map || labArena(opt.R || 14, opt.terrain),
    probe = E.buildRules(world, map, labDocs.fleets).rules,
    fix = (arr) => {
      let names = new Set();
      return arr.map((d, i) => {
        let c = labClean(d),
          n = c.name;
        for (let k = 2; names.has(n); k++) n = c.name + ' ' + k;
        names.add(n);
        c.name = n;
        return c;
      });
    },
    f1 = fix(p1),
    f2 = fix(p2);
  for (let f of [f1, f2]) {
    if (!(f.some((s) => s.flagship) || f.length === 0))
      f.reduce((a, s) => (s.hull.length > a.hull.length ? s : a), f[0]).flagship = true;
  }
  for (let f of [f1, f2]) {
    let seen = false;
    for (let s of f) {
      if (s.flagship)
        if (seen) delete s.flagship;
        else seen = true;
    }
  }
  let pos1 = labPlace(probe, f1, 0, map),
    pos2 = labPlace(probe, f2, 1, map),
    fleets = {
      world: labDocs.fleets.world,
      map: labDocs.fleets.map,
      budget: opt.sandbox ? 1e9 : labDocs.fleets.budget,
      player_1: { ships: f1, deployment: f1.map((s, i) => ({ ship: s.name, at: pos1[i] })) },
      player_2: { ships: f2, deployment: f2.map((s, i) => ({ ship: s.name, at: pos2[i] })) }
    },
    r = E.buildRules(world, map, fleets);
  return { rules: r.rules, problems: r.problems, fleets };
}

// ---------- sandbox duel: ship A (player 1) and ship B (player 2) ----------
function labDuel(A, Bd, d, opt) {
  opt = opt || {};
  let terrain = [];
  let R = 14,
    pa = [0, 9];
  // where B will sit for distance d (straight up the board from A); measured with the engine's gap()
  let probeShip = (des, pos, owner) => ({ id: 'x', owner, pos, segs: des.hull.map((s) => ({ off: s.at, parts: [] })) }),
    k = 1,
    // optional jitter (Monte Carlo): shift B sideways by up to 2 hexes and the gap by up to 1
    rng = opt.jitter ? E.seededRandom(E.fnv('lab:' + opt.seed)) : null,
    side = rng ? Math.floor(rng() * 5) - 2 : 0;
  if (rng) d = Math.max(1, d + Math.floor(rng() * 3) - 1);
  let pb = [side, pa[1] - k];
  for (; k < 40; k++) {
    pb = [side, pa[1] - k - (side > 0 ? side : 0)];
    if (E.gap(probeShip(A, pa, 0), probeShip(Bd, pb, 1)) >= d) break;
  }
  if (opt.nebA) terrain.push({ type: 'nebula', at: pa.slice(), radius: 2 });
  if (opt.nebB) terrain.push({ type: 'nebula', at: pb.slice(), radius: 2 });
  let built = labRules([A], [Bd], { R, terrain, sandbox: true, knobs: opt.knobs }),
    e = E.start(built.rules, opt.seed || 1),
    sa = e.ships.find((ship) => ship.owner === 0),
    sb = e.ships.find((ship) => ship.owner === 1);
  if (!sa || !sb) return { e, sa, sb, problems: built.problems, d: null };
  sa.pos = pa.slice();
  sb.pos = pb.slice();
  for (let s of [sa, sb]) s.turnStart = s.pos.slice();
  E.refreshSight(e);
  return { e, sa, sb, problems: built.problems, d: E.gap(sa, sb), rules: built.rules };
}

// situational toggles, applied with engine helpers
function labSitu(state, ship, t) {
  if (!t) return;
  let R = state.rules.det;
  if (t.moved) ship.turnStart = hex.add(ship.pos, [0, R.wakeFrom]); // anything that is an action also ends "sitting still" (exactly as in the game, where it sets used)
  if (t.acted || t.fire || t.hit || t.launch || t.scan || t.pd) ship.used = { ...ship.used, acted: 1 };
  if (t.fire) E.addFlare(state, ship, 'fire');
  if (t.hit) E.addFlare(state, ship, 'beamHit');
  if (t.launch) E.addFlare(state, ship, 'launch');
  if (t.scan) E.addFlare(state, ship, 'scan');
  if (t.pd) E.addFlare(state, ship, 'pd');
  let kill = (key) => {
    for (let g of ship.segs)
      for (let p of g.parts)
        if (p.hp > 0 && state.rules.parts[p.t][key]) {
          p.hp = 0;
          return;
        }
  };
  if (t.dmgSensor) kill('adds_range');
  if (t.dmgStealth) kill('hides');
}

// detection numbers for viewer v looking at target t (all from engine helpers)
function labSees(e, ship, t, tier) {
  let si = E.scanInfo(e, ship, tier),
    exact = E.detectRange(e, ship, t),
    rough = E.passiveRange(e, ship, t),
    dd = E.gap(ship, t),
    vis = E.visibleTo(e, ship.owner),
    cont = E.contactsFor(e, ship.owner, vis).some((c) => c.id === t.id);
  return {
    d: dd,
    exact,
    rough,
    scanClear: si.r[0],
    scanFaint: si.r[1],
    scanTierName: si.name,
    // what the engine says right now at this distance
    seesExact: vis.has(t.id),
    seesRough: !vis.has(t.id) && cont,
    scanFull: dd <= si.r[0],
    scanPing: dd > si.r[0] && dd <= si.r[1],
    sensor: E.eyes(e, ship),
    sig: E.sigBreak(e, t)
  };
}

function labProfile(A, Bd, d, situ, tiers, knobs) {
  situ = situ || {};
  let D = labDuel(A, Bd, d, { nebA: (situ.a || {}).neb, nebB: (situ.b || {}).neb, knobs });
  if (!D.sa || !D.sb) return { problems: D.problems };
  labSitu(D.e, D.sa, situ.a);
  labSitu(D.e, D.sb, situ.b);
  E.refreshSight(D.e);
  return {
    d: D.d,
    aSeesB: labSees(D.e, D.sa, D.sb, (tiers || {}).a ?? 2),
    bSeesA: labSees(D.e, D.sb, D.sa, (tiers || {}).b ?? 2),
    problems: D.problems,
    e: D.e,
    sa: D.sa,
    sb: D.sb
  };
}

// ship stats from the engine (ship built inside a sandbox)
// How a hull's outline rates: it has to be symmetrical, and compact shapes show fewer sides.
function shapeText(cells) {
  let sym = hex.symmetry(cells),
    sides = hex.exposedSides(cells),
    best = hex.fewestSides(cells.length);
  return (
    (sym === 'mirror' ? 'symmetrical (mirror)' : sym === 'turn' ? 'symmetrical (by a half or third turn)' : '⚠ lopsided: not allowed') +
    '; ' + sides + ' open sides' +
    (sides <= best ? ' (as compact as ' + plural(cells.length, 'segment') + ' can be)' : ' (a compact shape has ' + best + ': prefer a triangle, diamond or flower)')
  );
}
function labStats(des) {
  let built = labRules([des], [], { R: 14 }),
    fleetProblems = built.problems.filter(
      (p) => p.indexOf('player_1') === 0 && !/needs exactly one flagship|describe exactly 2/.test(p)
    ),
    sandbox = labRules([des], [des], { R: 14, sandbox: true }),
    e = E.start(sandbox.rules, 1),
    s = e.ships.find((ship) => ship.owner === 0),
    st = E.shipStats(e.rules, e.rules.fleets[0].ships[0]),
    parts = {},
    shields = [],
    armourHp = 0,
    hullHp = 0;
  s.turnStart = s.pos.slice();
  s.segs.forEach((g, i) =>
    g.parts.forEach((p) => {
      let c = e.rules.parts[p.t];
      parts[p.t] = (parts[p.t] || 0) + 1;
      if (c.recharges) shields.push(i + 1);
      else hullHp += c.hp;
      if (p.t === 'armour') armourHp += c.hp;
    })
  );
  let lasers = E.workingParts(e, s)
    .filter((x) => E.num(x.c.range) && E.num(x.c.hits))
    .map((x) => x.c);
  return {
    cost: e.rules.fleets[0].ships[0].cost,
    budget: labDocs.fleets.budget,
    problems: fleetProblems.map((p) => p.replace(/^player_1 \/ [^:]*: /, '').replace(/^player_1: /, '')),
    segments: st.segments,
    thrust: st.thrust,
    speed: E.moveCap(e, 0),
    sensor: E.sensorOf(e, s),
    sig: E.sigBreak(e, s),
    parts,
    hullHp,
    shields: shields.length,
    shieldHp: shields.length ? E.num(e.rules.parts.shield ? e.rules.parts.shield.hp : 1) : 0,
    shieldSegs: shields,
    armourHp,
    lasers,
    launchers: E.workingParts(e, s).filter((x) => x.c.launches).length,
    magazine: E.sumAttr(e, s, 'holds'),
    load: { ...s.load },
    pd: E.sumAttr(e, s, 'stops_per_round'),
    layers: Object.entries(e.rules.parts)
      .filter(([k]) => parts[k])
      .sort((p, q) => p[1].layer - q[1].layer)
      .map(([k, c]) => k + ' (' + c.layer + ')')
  };
}

// ---------- combat sim: real engine actions ----------
function labAct(state, seat, pol, opt) {
  let mine = state.ships.filter((ship) => ship.owner === seat && !ship.dead),
    v = E.view(state, seat),
    foes = v.ships.filter((s) => !s.mine && s.seen),
    P = state.players[seat];
  if (P.cp <= 0) return { type: 'end' };
  if (pol === 'ai') return computerMove(state, seat, 'normal') || { type: 'end' };
  let s = mine[0];
  if (!s) return { type: 'end' };
  // where is the enemy? (fog-fair: what this side can see, else rough contacts, else their home)
  let goal = foes.length
    ? foes.flatMap((f) => f.cells)
    : (v.contacts || []).length
      ? v.contacts.map((c) => c.at)
      : [[0, -state.rules.board.radius + 2]];
  if (seat === 1 && !foes.length && !(v.contacts || []).length) goal = [[0, state.rules.board.radius - 2]];
  let dTo = (cells) => Math.min(...cells.flatMap((a) => goal.map((g) => hex.dist(a, g)))),
    want = pol === 'close' ? 1 : pol === 'range' ? opt.keep || 6 : null;
  if (want != null && !(P.moved || {})[s.id]) {
    let here = Math.abs(dTo(E.footprint(s)) - want),
      best = null;
    for (let r of E.reach(state, s.id)) {
      let cells = s.segs.map((g) => hex.add(r.at, g.off)),
        sc = Math.abs(dTo(cells) - want);
      if (sc < here && (!best || sc < best.sc)) best = { sc, a: { type: 'move', ship: s.id, path: r.path } };
    }
    if (best) return best.a;
  }
  if (!foes.length) {
    let ss = E.shipStatus(state, s.id);
    if (ss.scanReady) return { type: 'scan', ship: s.id };
  }
  let shots = E.beamTargets(state, s.id).sort((p, q) => q.hits - p.hits);
  if (shots.length) return { type: 'fire', ship: s.id, seg: shots[0].seg, part: shots[0].part, at: shots[0].at };
  if (opt.missiles) {
    let lo = E.launchOptions(state, s.id);
    if (lo && lo.kinds.includes('missile') && lo.locks.length) {
      let t = state.ships.find((x) => x.id === lo.locks[0]),
        st = lo.starts.slice().sort((p, q) => E.gap({ pos: p }, t) - E.gap({ pos: q }, t))[0];
      return { type: 'launch', ship: s.id, kind: 'missile', start: st, target: lo.locks[0], route: [] };
    }
  }
  return { type: 'end' };
}

function labBattle(A, Bd, o, seed, record) {
  // A is "a"; if B goes first, B plays as player 1
  let bFirst = o.first === 'b',
    D = labDuel(bFirst ? Bd : A, bFirst ? A : Bd, o.dist, { seed, knobs: o.knobs, jitter: o.jitter });
  if (!D.sa || !D.sb) return null;
  let e = D.e,
    seatOf = (side) => (side === 'a' ? (bFirst ? 1 : 0) : bFirst ? 0 : 1),
    sideOf = (seat) => (seat === seatOf('a') ? 'a' : 'b'),
    pol = { [seatOf('a')]: o.polA, [seatOf('b')]: o.polB },
    st = {
      a: {
        volleys: 0,
        volleyHits: 0,
        launched: 0,
        mHits: 0,
        stopped: 0,
        mMiss: 0,
        shieldBlock: 0,
        armourBlock: 0,
        systemHits: 0,
        hitsTaken: 0,
        byCause: {}
      },
      b: {
        volleys: 0,
        volleyHits: 0,
        launched: 0,
        mHits: 0,
        stopped: 0,
        mMiss: 0,
        shieldBlock: 0,
        armourBlock: 0,
        systemHits: 0,
        hitsTaken: 0,
        byCause: {}
      }
    },
    log = [],
    launchedBy = {},
    n = 0,
    limit = o.rounds || e.rules.turnLimit,
    ownerSide = (id) => sideOf(Number(String(id)[0]) - 1),
    dist = () => {
      let a = e.ships.find((ship) => ship.owner === 0),
        b = e.ships.find((ship) => ship.owner === 1);
      return a && b ? E.gap(a, b) : null;
    };
  for (; e.phase === 'play' && e.round <= limit && n < 2000; n++) {
    let seat = e.order[e.turn],
      a = labAct(e, seat, pol[seat], o),
      x = E.attempt(e, a);
    if (!x.ok) x = E.attempt(e, { type: 'end' });
    e = x.state;
    let side = sideOf(seat),
      line = [];
    for (let ev of e.events) {
      if (ev.t === 'fire') {
        st[side].volleys++;
        st[side].volleyHits += ev.hits;
        if (record) line.push(side.toUpperCase() + ' fires a laser: ' + plural(ev.hits, 'hit'));
      } else if (ev.t === 'launch') {
        launchedBy[ev.obj] = ownerSide(ev.ship);
        st[ownerSide(ev.ship)].launched++;
        if (record) line.push(ownerSide(ev.ship).toUpperCase() + ' launches a ' + ev.kind);
      } else if (ev.t === 'stopped') {
        st[ownerSide(ev.ship) === 'a' ? 'b' : 'a'].stopped++;
        if (record) line.push(ownerSide(ev.ship).toUpperCase() + "'s point defence stops a " + ev.kind);
      } else if (ev.t === 'obj_lost') {
        if (launchedBy[ev.obj]) st[launchedBy[ev.obj]].mMiss++;
      } else if (ev.t === 'damage') {
        let vs = ownerSide(ev.ship),
          at = vs === 'a' ? 'b' : 'a',
          sh = ev.lost.filter((l) => /^shield /.test(l)).length,
          ar = ev.lost.filter((l) => /^armour /.test(l)).length,
          sy = ev.lost.length - sh - ar;
        st[vs].shieldBlock += sh;
        st[vs].armourBlock += ar;
        st[vs].systemHits += sy;
        st[vs].hitsTaken += ev.hits;
        let c = String(ev.cause);
        st[vs].byCause[c] = st[vs].byCause[c] || { hits: 0, shield: 0, armour: 0, system: 0 };
        st[vs].byCause[c].hits += ev.hits;
        st[vs].byCause[c].shield += sh;
        st[vs].byCause[c].armour += ar;
        st[vs].byCause[c].system += sy;
        if (/missile/.test(c) && c === 'missile') st[at].mHits++;
        if (record)
          line.push(
            vs.toUpperCase() +
              ' section ' +
              (ev.seg + 1) +
              ' takes ' +
              plural(ev.hits, 'hit') +
              ' (' +
              c +
              '): ' +
              ev.lost.join(', ') +
              ' \u2192 hull ' +
              ev.hull +
              '%'
          );
      } else if (ev.t === 'destroyed' && record && ev.ship) line.push(ownerSide(ev.ship).toUpperCase() + ' destroyed');
    }
    if (record && (a.type !== 'end' || line.length))
      log.push({
        round: e.round,
        side,
        act: labActText(a),
        lines: line,
        dist: dist(),
        hull: {
          a: (() => {
            let s = e.ships.find((ship) => ship.owner === seatOf('a'));
            return s ? E.hullPct(e, s) : 0;
          })(),
          b: (() => {
            let s = e.ships.find((ship) => ship.owner === seatOf('b'));
            return s ? E.hullPct(e, s) : 0;
          })()
        },
        vis: { a: E.visibleTo(e, seatOf('a')).size > 0, b: E.visibleTo(e, seatOf('b')).size > 0 }
      });
  }
  let surv = {};
  for (let side of ['a', 'b']) {
    let s = e.ships.find((ship) => ship.owner === seatOf(side));
    surv[side] = {};
    if (s)
      for (let g of s.segs)
        for (let p of g.parts) {
          let k = (surv[side][p.t] = surv[side][p.t] || [0, 0]);
          k[1]++;
          if (!g.wrecked && !s.dead && (p.hp > 0 || e.rules.parts[p.t].recharges)) k[0]++;
        }
  }
  let w = e.winner === 'draw' || e.winner == null ? 'draw' : sideOf(e.winner);
  return { winner: w, rounds: e.round, st, surv, log };
}

function labActText(a) {
  return a.type === 'move'
    ? 'moves ' + plural(a.path.length, 'hex')
    : a.type === 'fire'
      ? 'fires a laser'
      : a.type === 'launch'
        ? 'launches a ' + a.kind
        : a.type === 'scan'
          ? 'scans'
          : a.type === 'end'
            ? 'ends its turn'
            : a.type;
}

function labMonteCarlo(A, Bd, o, runs, onProg, done) {
  let res = { a: 0, b: 0, draw: 0, roundsKill: [], acc: null, surv: { a: {}, b: {} }, runs: 0 },
    i = 0,
    step = () => {
      let t0 = performance.now();
      for (; i < runs && performance.now() - t0 < 40; i++) {
        let r = labBattle(A, Bd, o, 1000 + i * 7919, false);
        if (!r) continue;
        res[r.winner]++;
        res.runs++;
        if (r.winner !== 'draw') res.roundsKill.push(r.rounds);
        if (!res.acc) res.acc = structuredClone(r.st);
        else
          for (let s of ['a', 'b'])
            for (let [k, val] of Object.entries(r.st[s]))
              if (typeof val == 'number') res.acc[s][k] += val;
              else
                for (let [c, o2] of Object.entries(val)) {
                  let t = (res.acc[s].byCause[c] = res.acc[s].byCause[c] || {
                    hits: 0,
                    shield: 0,
                    armour: 0,
                    system: 0
                  });
                  for (let kk in o2) t[kk] += o2[kk];
                }
        for (let s of ['a', 'b'])
          for (let [p, [alive, tot]] of Object.entries(r.surv[s])) {
            let t = (res.surv[s][p] = res.surv[s][p] || [0, 0]);
            t[0] += alive;
            t[1] += tot;
          }
      }
      if (onProg) onProg(i / runs);
      if (i < runs) setTimeout(step, 0);
      else done(res);
    };
  step();
}

// ---------- designs ----------
function labPresets() {
  let p = labDocs.fleets.player_1.ships || [];
  return p.map((s) => labEditable(s));
}

function labEditable(s) {
  return {
    name: s.name || 'Ship',
    flagship: !!s.flagship,
    load: { missile: 0, ...(s.load || {}) },
    hull: (s.hull || []).map((g) => ({
      at: g.at.slice(),
      bays: [0, 1, 2].map((i) => (g.bays || [])[i] || ''),
      mounts: [0, 1, 2].map((i) => (g.mounts || [])[i] || '')
    }))
  };
}

function labLibrary() {
  try {
    return JSON.parse(store.get('shatkon.lab.designs') || '[]') || [];
  } catch {
    return [];
  }
}

function labSaveLib(lib) {
  store.set('shatkon.lab.designs', JSON.stringify(lib));
}

function labVariant(des, kind) {
  // add one part of `kind` into the first free slot (bay or mount, by part type)
  let d = structuredClone(des),
    slot = labDocs.world.mount_parts && labDocs.world.mount_parts[kind] ? 'mounts' : 'bays';
  for (let g of d.hull) {
    let i = g[slot].indexOf('');
    if (i >= 0) { g[slot][i] = kind; return d; }
  }
  return null;
}

function labDrop(des, kind) {
  let d = structuredClone(des);
  for (let g of d.hull)
    for (let k of ['bays', 'mounts']) {
      let i = g[k].indexOf(kind);
      if (i >= 0) { g[k][i] = ''; return d; }
    }
  return null;
}

// ---------- view ----------
function labRender() {
  let root = $('#lab');
  if (!root || !labDocs) return;
  if (!LAB.a) LAB.a = labPresets()[0];
  if (!LAB.b) LAB.b = labPresets()[1] || labPresets()[0];
  let y = window.scrollY;
  root.replaceChildren(
    h(
      'div',
      { class: 'lab-intro card' },
      h('b', null, 'Ship Lab'),
      " \u2014 design two ships, see who spots whom from how far, and fight them using the game's own rules. Every number here is computed by the same engine as Play."
    ),
    h('div', { class: 'lab-grid' }, labDesigner('a'), labDesigner('b')),
    labDetectPanel(),
    labSimPanel(),
    labKnobPanel(),
    labPlayPanel()
  );
  window.scrollTo(0, y);
}

function labRerender() {
  labRender();
}

const LAB_COLORS = { a: '#f5b942', b: '#5cc8ff' };

function labDesigner(side) {
  let des = LAB[side],
    st = labStats(des),
    pal = partLooks(rules),
    bayParts = Object.keys(labDocs.world.bay_parts || {}),
    mountParts = Object.keys(labDocs.world.mount_parts || {}),
    sel = Math.min(LAB.sel[side], des.hull.length - 1),
    seg = des.hull[sel],
    set = (fn) => () => {
      fn();
      labRerender();
    };
  // hex layout editor (offsets within 2 of the centre)
  let S = 13,
    W = Math.sqrt(3) * S,
    px = (h) => [W * (h[0] + h[1] / 2), 1.5 * S * h[1]],
    svg = svgEl('svg', {
      viewBox: [-W * 2.9, -S * 4.1, W * 5.8, S * 8.2].join(' '),
      class: 'lab-hull',
      role: 'img',
      'aria-label': 'Hull layout for ship ' + side.toUpperCase()
    }),
    has = new Map(des.hull.map((g, i) => [hex.key(g.at), i]));
  for (let h of hex.disc([0, 0], 2)) {
    let [x, y2] = px(h),
      i = has.get(hex.key(h)),
      adj = i == null && des.hull.length < rules.seg.max && hex.DIRS.some((dv) => has.has(hex.key(hex.add(h, dv)))),
      pts = [0, 1, 2, 3, 4, 5]
        .map((k) => {
          let a = (Math.PI / 3) * k + Math.PI / 6;
          return (x + S * 0.95 * Math.cos(a)).toFixed(1) + ',' + (y2 + S * 0.95 * Math.sin(a)).toFixed(1);
        })
        .join(' '),
      g = svgEl('g', {
        class: 'lab-hex' + (i != null ? ' on' : adj ? ' add' : ''),
        tabindex: i != null || adj ? 0 : null
      });
    g.appendChild(
      svgEl('polygon', {
        points: pts,
        fill: i != null ? (i === sel ? '#2a3550' : '#1b2338') : 'none',
        stroke: i === sel ? LAB_COLORS[side] : i != null ? '#5a6890' : adj ? '#3b4766' : '#222b40',
        'stroke-dasharray': adj ? '3 3' : null,
        'stroke-width': i === sel ? 2 : 1
      })
    );
    if (i != null) {
      let segd = des.hull[i];
      segd.bays.forEach((p, k) => {
        if (!p) return;
        let ang = (Math.PI * 2 * k) / 3 - Math.PI / 2,
          cx = x + S * 0.42 * Math.cos(ang),
          cy = y2 + S * 0.42 * Math.sin(ang);
        g.appendChild(
          svgEl('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: 3.6, fill: (pal[p] || {}).color || '#888' })
        );
        g.appendChild(
          svgEl(
            'text',
            {
              x: cx.toFixed(1),
              y: (cy + 2).toFixed(1),
              'font-size': 5,
              class: 'mid',
              fill: '#10131c',
              'font-weight': 700
            },
            (pal[p] || {}).letter || '?'
          )
        );
      });
      segd.mounts.forEach((p, k) => {
        if (!p) return;
        let ang = (Math.PI * 2 * k) / 3 + Math.PI / 6,
          cx = x + S * 0.78 * Math.cos(ang),
          cy = y2 + S * 0.78 * Math.sin(ang);
        g.appendChild(
          svgEl('rect', {
            x: (cx - 2.4).toFixed(1),
            y: (cy - 2.4).toFixed(1),
            width: 4.8,
            height: 4.8,
            transform: 'rotate(45 ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ')',
            fill: (pal[p] || {}).color || '#888'
          })
        );
      });
      if (des.flagship && i === 0)
        g.appendChild(
          svgEl(
            'text',
            { x: x.toFixed(1), y: (y2 - S * 0.55).toFixed(1), 'font-size': 6, class: 'mid', fill: '#f5b942' },
            '\u2605'
          )
        );
    } else if (adj)
      g.appendChild(
        svgEl('text', { x: x.toFixed(1), y: (y2 + 3).toFixed(1), 'font-size': 9, class: 'mid', fill: '#5a6890' }, '+')
      );
    if (i != null || adj) {
      g.addEventListener('click', () => {
        if (i != null) LAB.sel[side] = i;
        else {
          des.hull.push({ at: h.slice(), bays: ['coupling', '', ''], mounts: ['', '', ''] });
          LAB.sel[side] = des.hull.length - 1;
        }
        labRerender();
      });
      g.addEventListener(
        'keydown',
        (ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), g.dispatchEvent(new Event('click')))
      );
    }
    svg.appendChild(g);
  }
  let slotSel = (arr, k, opts) =>
    h(
      'select',
      {
        'aria-label': (opts === bayParts ? 'Bay ' : 'Mount ') + (k + 1),
        onchange: (ev) => {
          arr[k] = ev.target.value;
          return labRerender();
        }
      },
      h('option', { value: '' }, '\u2014 empty \u2014'),
      ...opts.map((p) => h('option', { value: p, selected: arr[k] === p }, p.replace(/_/g, ' ')))
    );
  let lib = labLibrary();
  let sig = st.sig,
    sigTxt = labSigText(sig);
  return h(
    'section',
    { class: 'card lab-ship', style: 'border-top:3px solid ' + LAB_COLORS[side] },
    h(
      'div',
      { class: 'lab-row' },
      h('b', { style: 'color:' + LAB_COLORS[side] }, 'Ship ' + side.toUpperCase()),
      h('input', {
        class: 'lab-name',
        value: des.name,
        'aria-label': 'Ship name',
        onchange: (ev) => {
          des.name = ev.target.value || 'Ship';
          return labRerender();
        }
      }),
      h(
        'label',
        { class: 'lab-chk' },
        h('input', {
          type: 'checkbox',
          checked: des.flagship,
          onchange: (ev) => {
            des.flagship = ev.target.checked;
            return labRerender();
          }
        }),
        ' flagship'
      )
    ),
    h(
      'div',
      { class: 'lab-row lab-btns' },
      ...labPresets().map((p) =>
        h(
          'button',
          {
            class: 'btn sm',
            onclick: set(() => {
              LAB[side] = structuredClone(p);
              return (LAB.sel[side] = 0);
            })
          },
          'Preset: ' + p.name
        )
      ),
      h(
        'button',
        {
          class: 'btn sm',
          onclick: set(() => {
            LAB[side] = {
              name: 'New ship',
              flagship: false,
              load: { missile: 0 },
              hull: [{ at: [0, 0], bays: ['core', 'engine', ''], mounts: ['', '', ''] }]
            };
            return (LAB.sel[side] = 0);
          })
        },
        'Blank'
      ),
      lib.length
        ? h(
            'select',
            {
              'aria-label': 'Load from library',
              onchange: (ev) => {
                let d = lib[Number(ev.target.value)];
                if (d) {
                  LAB[side] = labEditable(d);
                  LAB.sel[side] = 0;
                  labRerender();
                }
              }
            },
            h('option', { value: '' }, 'Library\u2026'),
            ...lib.map((d, i) => h('option', { value: i }, d.name))
          )
        : null
    ),
    h(
      'div',
      { class: 'lab-two' },
      svg,
      h(
        'div',
        { class: 'lab-seg' },
        h('div', { class: 'muted' }, 'Segment ' + (sel + 1) + ' of ' + des.hull.length + ' \u00B7 tap + to add one'),
        h(
          'div',
          { class: 'lab-slots' },
          h('small', null, 'Bays'),
          ...[0, 1, 2].map((k) => slotSel(seg.bays, k, bayParts))
        ),
        h(
          'div',
          { class: 'lab-slots' },
          h('small', null, 'Mounts'),
          ...[0, 1, 2].map((k) => slotSel(seg.mounts, k, mountParts))
        ),
        h(
          'div',
          { class: 'lab-row' },
          h(
            'button',
            {
              class: 'btn sm',
              disabled: des.hull.length <= 1 || (seg.at[0] === 0 && seg.at[1] === 0 && des.hull.length > 1),
              onclick: set(() => {
                des.hull.splice(sel, 1);
                return (LAB.sel[side] = 0);
              })
            },
            'Remove segment'
          ),
          h(
            'label',
            { class: 'lab-chk' },
            'Missiles ',
            h('input', {
              type: 'number',
              min: 0,
              max: 20,
              value: des.load.missile || 0,
              style: 'width:3.5em',
              onchange: (ev) => {
                des.load.missile = Math.max(0, Number(ev.target.value) || 0);
                return labRerender();
              }
            })
          )
        )
      )
    ),
    h(
      'table',
      { class: 'lab-stats' },
      ...[
        ['Cost', st.cost + ' of ' + st.budget + (st.cost > st.budget ? ' \u26A0 over budget' : '')],
        ['Segments', st.segments + ' (max ' + rules.seg.max + ')'],
        ['Shape', shapeText(des.hull.map((g) => g.at))],
        ['Thrust / speed', st.thrust + ' thrust \u2192 up to ' + plural(st.speed, 'hex') + ' a turn on its own'],
        ['Sensor range', plural(st.sensor, 'hex')],
        ['Signature', sigTxt],
        [
          'Hull',
          st.hullHp +
            ' hit points in ' +
            Object.values(st.parts).reduce((a, c) => a + c, 0) +
            ' parts; armour ' +
            st.armourHp
        ],
        [
          'Shields',
          st.shields
            ? st.shields +
              ' (on segment' +
              (st.shieldSegs.length > 1 ? 's ' : ' ') +
              st.shieldSegs.join(', ') +
              '): each soaks the first ' +
              plural(st.shieldHp, 'hit') +
              ' on its segment every round'
            : 'none'
        ],
        [
          'Weapons',
          (st.lasers.length
            ? st.lasers.length +
              ' laser' +
              (st.lasers.length > 1 ? 's' : '') +
              ' (' +
              st.lasers[0].hits +
              ' hits to ' +
              (st.lasers[0].loses_1_hit_every || st.lasers[0].range) +
              ' hexes, then fewer, max ' +
              st.lasers[0].range +
              ')'
            : 'no lasers') +
            '; ' +
            (st.launchers
              ? st.launchers + ' launcher, ' + (st.load.missile || 0) + ' of ' + st.magazine + ' missiles'
              : 'no launcher')
        ],
        [
          'Point defence',
          st.pd ? 'stops ' + st.pd + ' incoming missile' + (st.pd > 1 ? 's' : '') + ' a round' : 'none'
        ],
        ['Damage order', st.layers.join(' \u2192 ')]
      ].map(([k, val]) => h('tr', null, h('th', null, k), h('td', null, val)))
    ),
    st.problems.length ? h('div', { class: 'lab-warn' }, '\u26A0 ' + st.problems.join(' ')) : null,
    h(
      'div',
      { class: 'lab-row lab-btns' },
      h(
        'button',
        {
          class: 'btn sm',
          onclick: () => {
            let L = labLibrary().filter((d) => d.name !== des.name);
            L.push(labClean(des));
            labSaveLib(L);
            say('Saved ' + des.name + ' to the Lab library.');
            labRerender();
          }
        },
        'Save to library'
      ),
      h(
        'button',
        {
          class: 'btn sm',
          onclick: () => {
            let t = JSON.stringify(labClean(des));
            if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {});
            labToast('Design copied as JSON');
          }
        },
        'Copy JSON'
      ),
      h(
        'button',
        {
          class: 'btn sm',
          onclick: () => {
            let t = prompt('Paste a ship design (JSON):');
            if (!t) return;
            try {
              let d = JSON.parse(t);
              if (!d.hull) throw 0;
              LAB[side] = labEditable(d);
              LAB.sel[side] = 0;
              labRerender();
            } catch {
              labToast("That isn't a ship design");
            }
          }
        },
        'Paste JSON'
      ),
      lib.some((d) => d.name === des.name)
        ? h(
            'button',
            {
              class: 'btn sm',
              onclick: () => {
                labSaveLib(labLibrary().filter((d) => d.name !== des.name));
                labRerender();
              }
            },
            'Delete from library'
          )
        : null
    )
  );
}

function labSigText(sig) {
  let t = 'Signature ' + sig.total + ' = base ' + sig.base;
  if (sig.stealth)
    t +=
      ', \u2212' +
      sig.used +
      ' from ' +
      plural(sig.stealth, 'stealth part') +
      (sig.used < sig.stealth
        ? ' (floor ' + sig.floor + ', ' + (sig.stealth - sig.used) + ' spare)'
        : sig.hull === sig.floor
          ? ' (at floor ' + sig.floor + ')'
          : '');
  if (!sig.stealth) t += ' (floor ' + sig.floor + ')';
  if (sig.haze) t += ', ' + sig.haze + ' nebula';
  if (sig.flare) t += ', +' + sig.flare + ' flare';
  if (sig.motion)
    t += sig.motion < 0 ? ', \u2212' + -sig.motion + ' sitting still' : ', +' + sig.motion + ' engine wake';
  return t;
}

function labToast(t) {
  let el = $('#labtoast');
  if (el) {
    el.textContent = t;
    el.className = 'show';
    clearTimeout(labToast.t);
    labToast.t = setTimeout(() => (el.className = ''), 1800);
  }
}

const LAB_SITU = [
  ['acted', 'sat still? (off = still)', 'did something this turn (no still bonus)'],
  ['moved', 'moved big', 'moved 2+ hexes this turn'],
  ['fire', 'fired (miss)', ''],
  ['hit', 'fired & hit', ''],
  ['launch', 'launched', ''],
  ['scan', 'scanned', ''],
  ['neb', 'in nebula', ''],
  ['dmgSensor', 'sensor damaged', ''],
  ['dmgStealth', 'stealth damaged', '']
];

function labDetectPanel() {
  let P = labProfile(LAB.a, LAB.b, LAB.dist, LAB.situ, LAB.tier);
  if (!P.aSeesB)
    return h('section', { class: 'card' }, "These designs can't be placed: " + (P.problems || []).join(' '));
  let rowsFor = (side) => {
    let s = LAB.situ[side];
    return h(
      'div',
      { class: 'lab-situ' },
      h('b', { style: 'color:' + LAB_COLORS[side] }, side.toUpperCase() + ':'),
      ...LAB_SITU.map(([k, lab, tip]) =>
        h(
          'label',
          { class: 'lchip' + (s[k] ? ' on' : ''), title: tip },
          h('input', {
            type: 'checkbox',
            checked: !!s[k],
            onchange: (ev) => {
              s[k] = ev.target.checked;
              return labRerender();
            }
          }),
          k === 'acted' ? 'acted (no still bonus)' : lab
        )
      ),
      h(
        'label',
        { class: 'lchip' },
        'scan from ',
        h(
          'select',
          {
            onchange: (ev) => {
              LAB.tier[side] = Number(ev.target.value);
              return labRerender();
            }
          },
          ...['near home', 'mid-field', 'forward'].map((n, i) =>
            h('option', { value: i, selected: LAB.tier[side] === i }, n)
          )
        )
      )
    );
  };
  let ab = P.aSeesB,
    ba = P.bSeesA,
    maxD = Math.max(12, ab.rough, ba.rough, ab.scanFaint, ba.scanFaint) + 2,
    chart = labRangeChart(ab, ba, maxD),
    say = (x, who, whom) =>
      x.seesExact
        ? who +
          ' sees ' +
          whom +
          "'s exact position (tier 2) passively." +
          (x.scanFull ? ' A scan would give a full readout (tier 3).' : '')
        : x.seesRough
          ? who +
            ' only knows ' +
            whom +
            ' is somewhere in a rough area (tier 1).' +
            (x.scanFull ? ' A scan would reveal everything (tier 3).' : x.scanPing ? ' A scan would only ping it.' : '')
          : x.scanFull
            ? who + " can't see " + whom + ' passively, but a scan would give a full readout (tier 3).'
            : x.scanPing
              ? who + " can't see " + whom + '; a scan would show a rough area.'
              : who + ' has no idea ' + whom + ' is there.',
    first =
      ab.exact === ba.exact
        ? 'Both spot each other at the same range (' + plural(ab.exact, 'hex') + ').'
        : ab.exact > ba.exact
          ? 'A spots B ' + plural(ab.exact - ba.exact, 'hex') + ' further out than B spots A: A gets the first look.'
          : 'B spots A ' + plural(ba.exact - ab.exact, 'hex') + ' further out than A spots B: B gets the first look.';
  return h(
    'section',
    { class: 'card lab-detect' },
    h('h3', null, 'Detection matchup'),
    h(
      'p',
      { class: 'muted' },
      'Seen exactly when distance \u2264 their sensor + your signature. A rough area shows up to ' +
        rules.det.passiveFuzzy +
        ' hexes beyond that. Scans give a full readout inside the clear ring (the ship must have moved this turn).'
    ),
    rowsFor('a'),
    rowsFor('b'),
    h(
      'table',
      { class: 'lab-stats lab-dt' },
      h('tr', null, h('th', null, ''), h('th', null, 'A spots B'), h('th', null, 'B spots A')),
      ...[
        ['Sensor + signature', ab.sensor + ' + ' + ab.sig.total, ba.sensor + ' + ' + ba.sig.total],
        ['Rough area (tier 1) from', plural(ab.rough, 'hex'), plural(ba.rough, 'hex')],
        ['Exact position (tier 2) from', plural(ab.exact, 'hex'), plural(ba.exact, 'hex')],
        [
          'Scan full readout (tier 3) within',
          plural(ab.scanClear, 'hex') + ' (' + ab.scanTierName + ')',
          plural(ba.scanClear, 'hex') + ' (' + ba.scanTierName + ')'
        ],
        ['Scan rough ping within', plural(ab.scanFaint, 'hex'), plural(ba.scanFaint, 'hex')],
        ['Target signature', labSigText(ab.sig), labSigText(ba.sig)]
      ].map((r) => h('tr', null, ...r.map((c, i) => h(i ? 'td' : 'th', null, c))))
    ),
    h('p', null, h('b', null, first)),
    h(
      'div',
      { class: 'lab-row' },
      h('label', { for: 'labdist' }, 'Distance: ', h('b', null, plural(LAB.dist, 'hex'))),
      h('input', {
        id: 'labdist',
        type: 'range',
        min: 1,
        max: maxD,
        value: LAB.dist,
        style: 'flex:1',
        oninput: (ev) => {
          LAB.dist = Number(ev.target.value);
          labRerender();
        }
      })
    ),
    chart,
    h('p', null, 'At ' + plural(P.d, 'hex') + ': ' + say(ab, 'A', 'B') + ' ' + say(ba, 'B', 'A')),
    labWhatIf(P)
  );
}

function labRangeChart(ab, ba, maxD) {
  let W = Math.max(380, Math.min(1000, ($('#lab') && $('#lab').clientWidth) || 1000)),
    rowH = 17,
    left = 110,
    sx = (d) => left + ((W - left - 10) * d) / maxD,
    svg = svgEl('svg', {
      viewBox: '0 0 ' + W + ' ' + (rowH * 9 + 24),
      class: 'lab-chart',
      role: 'img',
      'aria-label': 'Detection ranges'
    }),
    rows = [
      ['A sees B', null, LAB_COLORS.a],
      ['rough', ab.rough, '#ff7a7a'],
      ['exact', ab.exact, LAB_COLORS.a],
      ['scan clear', ab.scanClear, '#58d6a0'],
      ['B sees A', null, LAB_COLORS.b],
      ['rough', ba.rough, '#ff7a7a'],
      ['exact', ba.exact, LAB_COLORS.b],
      ['scan clear', ba.scanClear, '#58d6a0']
    ];
  rows.forEach(([lab, d, col], i) => {
    let y = 6 + i * rowH;
    svg.appendChild(
      svgEl(
        'text',
        {
          x: d == null ? 4 : 14,
          y: y + 12,
          'font-size': 11,
          fill: d == null ? col : '#aab3c8',
          'font-weight': d == null ? 700 : 400
        },
        lab
      )
    );
    if (d != null) {
      svg.appendChild(
        svgEl('rect', {
          x: sx(0),
          y: y + 3,
          width: Math.max(0, sx(d) - sx(0)),
          height: rowH - 7,
          rx: 3,
          fill: col,
          'fill-opacity': 0.35,
          stroke: col,
          'stroke-opacity': 0.8
        })
      );
      svg.appendChild(svgEl('text', { x: sx(d) + 4, y: y + 12, 'font-size': 10, fill: '#dfe5f2' }, String(d)));
    }
  });
  for (let d = 0; d <= maxD; d += 2)
    svg.appendChild(
      svgEl('text', { x: sx(d), y: rowH * 8 + 22, 'font-size': 9, fill: '#6b7591', class: 'mid' }, String(d))
    );
  let xd = sx(LAB.dist);
  svg.appendChild(
    svgEl('line', {
      x1: xd,
      x2: xd,
      y1: 2,
      y2: rowH * 8 + 10,
      stroke: '#fff',
      'stroke-width': 2,
      'stroke-dasharray': '4 3'
    })
  );
  return svg;
}

function labWhatIf(P) {
  let base = P,
    tryVar = (side, kind, drop) => {
      let d = drop ? labDrop(LAB[side], kind) : labVariant(LAB[side], kind);
      if (!d) return null;
      let pa = side === 'a' ? d : LAB.a,
        pb = side === 'b' ? d : LAB.b;
      return labProfile(pa, pb, LAB.dist, LAB.situ, LAB.tier);
    },
    fmt = (n) => (n > 0 ? '+' + n : n < 0 ? '\u2212' + -n : '\u00B10'),
    items = [];
  for (let side of ['a', 'b']) {
    let o = side === 'a' ? 'b' : 'a',
      S = side.toUpperCase(),
      O = o.toUpperCase(),
      get = (Q, who) => (who === 'a' ? Q.aSeesB : Q.bSeesA);
    let v1 = tryVar(side, 'sensor');
    items.push(
      v1
        ? '+1 sensor on ' +
            S +
            ': ' +
            S +
            ' spots ' +
            O +
            ' ' +
            fmt(get(v1, side).exact - get(base, side).exact) +
            ' hexes'
        : '+1 sensor on ' + S + ': no free bay'
    );
    let v2 = tryVar(side, 'stealth');
    items.push(
      v2
        ? '+1 stealth on ' +
            S +
            ': ' +
            O +
            ' spots ' +
            S +
            ' ' +
            fmt(get(v2, o).exact - get(base, o).exact) +
            ' hexes' +
            (get(v2, o).exact === get(base, o).exact ? ' (already at the floor)' : '')
        : '+1 stealth on ' + S + ': no free bay'
    );
    let v3 = tryVar(side, 'stealth', true);
    if (v3)
      items.push(
        'lose 1 stealth on ' +
          S +
          ': ' +
          O +
          ' spots ' +
          S +
          ' ' +
          fmt(get(v3, o).exact - get(base, o).exact) +
          ' hexes'
      );
    let v4 = labVariant(LAB[side], 'shield');
    items.push(
      v4
        ? '+1 shield on ' +
            S +
            ': soaks 1 more hit a round (' +
            labStats(v4).shields +
            ' shields), cost +' +
            (labStats(v4).cost - labStats(LAB[side]).cost) +
            '. Run the sim below to see the effect.'
        : '+1 shield on ' + S + ': no free mount'
    );
  }
  return h(
    'div',
    { class: 'lab-what' },
    h('b', null, 'What if\u2026'),
    h('ul', null, ...items.map((t) => h('li', null, t))),
    h(
      'button',
      { class: 'btn sm', disabled: LAB.busy, onclick: () => labWhatIfSim() },
      'Simulate the shield / armour what-ifs (100 runs each)'
    ),
    LAB.whatOut ? h('ul', null, ...LAB.whatOut.map((t) => h('li', null, t))) : null
  );
}

function labSimOpts() {
  return {
    dist: LAB.sim.dist,
    polA: LAB.sim.polA,
    polB: LAB.sim.polB,
    first: LAB.sim.first,
    missiles: LAB.sim.missiles,
    keep: 6,
    jitter: LAB.sim.jitter
  };
}

function labWhatIfSim() {
  let jobs = [['base', LAB.a, LAB.b]];
  for (let side of ['a', 'b'])
    for (let k of ['shield', 'armour']) {
      let v2 = labVariant(LAB[side], k);
      if (v2)
        jobs.push(['+1 ' + k + ' on ' + side.toUpperCase(), side === 'a' ? v2 : LAB.a, side === 'b' ? v2 : LAB.b]);
    }
  let out = [],
    baseWin = null;
  LAB.busy = true;
  let next = () => {
    let j = jobs.shift();
    if (!j) { LAB.busy = false; LAB.whatOut = out; return labRerender(); }
    labMonteCarlo(j[1], j[2], labSimOpts(), 100, null, (r) => {
      let wa = Math.round((100 * r.a) / Math.max(1, r.runs));
      if (j[0] === 'base') {
        baseWin = wa;
        out.push('Now: A wins ' + wa + '%');
      } else out.push(j[0] + ': A wins ' + wa + '% (' + (wa - baseWin >= 0 ? '+' : '') + (wa - baseWin) + ' points)');
      next();
    });
  };
  next();
}

function labSimPanel() {
  let s = LAB.sim,
    pol = (k) =>
      h(
        'select',
        {
          onchange: (ev) => {
            s[k] = ev.target.value;
            return labRerender();
          }
        },
        ...[
          ['close', 'close in'],
          ['hold', 'hold position (sit still)'],
          ['range', 'keep ~6 hexes away'],
          ['ai', 'the computer (normal)']
        ].map(([vv, n]) => h('option', { value: vv, selected: s[k] === vv }, n))
      ),
    mc = LAB.mcOut,
    one = LAB.simOut;
  return h(
    'section',
    { class: 'card lab-sim' },
    h('h3', null, 'Combat sim'),
    h(
      'p',
      { class: 'muted' },
      'Runs the real game: both ships start at the chosen distance in an empty arena, take turns with 3 command points, and lasers, shields, armour, missiles and point defence all follow the rules (and the knobs below). Each side only knows what it can detect.'
    ),
    h(
      'div',
      { class: 'lab-row lab-wrap' },
      h(
        'label',
        null,
        'Start ',
        h('input', {
          type: 'number',
          min: 1,
          max: 22,
          value: s.dist,
          style: 'width:3.5em',
          onchange: (ev) => {
            s.dist = Math.max(1, Math.min(22, Number(ev.target.value) || 1));
            return labRerender();
          }
        }),
        ' hexes apart'
      ),
      h('label', null, 'A: ', pol('polA')),
      h('label', null, 'B: ', pol('polB')),
      h(
        'label',
        null,
        'First: ',
        h(
          'select',
          {
            onchange: (ev) => {
              s.first = ev.target.value;
              return labRerender();
            }
          },
          h('option', { value: 'a', selected: s.first === 'a' }, 'A'),
          h('option', { value: 'b', selected: s.first === 'b' }, 'B')
        )
      ),
      h(
        'label',
        { class: 'lab-chk' },
        h('input', {
          type: 'checkbox',
          checked: s.missiles,
          onchange: (ev) => {
            s.missiles = ev.target.checked;
            return labRerender();
          }
        }),
        ' missiles'
      ),
      h(
        'label',
        {
          class: 'lab-chk',
          title:
            'Each Monte Carlo run shifts B sideways by up to 2 hexes and the gap by up to 1. Without it, battles from the same start are almost identical: the only dice in the game pick which part in a layer gets hit.'
        },
        h('input', {
          type: 'checkbox',
          checked: s.jitter,
          onchange: (ev) => {
            s.jitter = ev.target.checked;
            return labRerender();
          }
        }),
        ' vary start positions'
      )
    ),
    h(
      'div',
      { class: 'lab-row lab-btns' },
      h(
        'button',
        {
          class: 'btn',
          disabled: LAB.busy,
          onclick: () => {
            LAB.simOut = labBattle(LAB.a, LAB.b, labSimOpts(), (Date.now() % 1e6) | 0, true);
            LAB.simStep = 0;
            labRerender();
            labPlayLog();
          }
        },
        'Run one battle'
      ),
      h(
        'label',
        null,
        h(
          'select',
          { onchange: (ev) => (s.runs = Number(ev.target.value)) },
          ...[100, 200, 500, 1000].map((n) => h('option', { value: n, selected: s.runs === n }, n + ' runs'))
        )
      ),
      h('button', { class: 'btn', disabled: LAB.busy, onclick: () => labRunMC() }, 'Monte Carlo'),
      h('span', { id: 'labprog', class: 'muted' })
    ),
    one ? labOneView(one) : null,
    mc ? labMCView(mc) : null
  );
}

function labRunMC() {
  LAB.busy = true;
  labRerender();
  labMonteCarlo(
    LAB.a,
    LAB.b,
    labSimOpts(),
    LAB.sim.runs,
    (p) => {
      let el = $('#labprog');
      if (el) el.textContent = Math.round(p * 100) + '%';
    },
    (r) => {
      LAB.busy = false;
      LAB.mcOut = r;
      return labRerender();
    }
  );
}

function labStrip(ent) {
  let W = 600,
    H = 54,
    maxD = Math.max(LAB.sim.dist, 8) + 1,
    d = ent ? ent.dist || 0 : LAB.sim.dist,
    sx = (k) => 30 + ((W - 60) * k) / maxD,
    svg = svgEl('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      class: 'lab-strip',
      role: 'img',
      'aria-label': 'Battle distance'
    });
  for (let k = 0; k <= maxD; k++)
    svg.appendChild(
      svgEl('polygon', {
        points: [0, 1, 2, 3, 4, 5]
          .map((j) => {
            let a = (Math.PI / 3) * j + Math.PI / 6,
              r = ((W - 60) / maxD) * 0.52;
            return (sx(k) + r * Math.cos(a)).toFixed(1) + ',' + (24 + r * Math.sin(a)).toFixed(1);
          })
          .join(' '),
        fill: '#141a2a',
        stroke: '#26304a'
      })
    );
  let ax = sx(0),
    bx = sx(d);
  if (ent && ent.lines.some((l) => /fires/.test(l)))
    svg.appendChild(
      svgEl('line', {
        x1: ent.side === 'a' ? ax : bx,
        x2: ent.side === 'a' ? bx : ax,
        y1: 24,
        y2: 24,
        stroke: LAB_COLORS[ent.side],
        'stroke-width': 2.5,
        class: 'lab-beam'
      })
    );
  if (ent && ent.lines.some((l) => /launches/.test(l)))
    svg.appendChild(
      svgEl('circle', { cx: ((ax + bx) / 2).toFixed(1), cy: 24, r: 4, fill: '#fff', class: 'lab-missile' })
    );
  for (let [side, x] of [
    ['a', ax],
    ['b', bx]
  ]) {
    let hp = ent ? ent.hull[side] : 100;
    svg.appendChild(
      svgEl('circle', {
        cx: x,
        cy: 24,
        r: 9,
        fill: LAB_COLORS[side],
        'fill-opacity': ent && ent.lines.some((l) => l.indexOf(side.toUpperCase() + ' section') === 0) ? 0.35 : 0.9,
        class: ent && ent.lines.some((l) => l.indexOf(side.toUpperCase() + ' section') === 0) ? 'lab-hit' : null
      })
    );
    svg.appendChild(
      svgEl(
        'text',
        { x, y: 28, 'font-size': 11, class: 'mid', 'font-weight': 700, fill: '#10131c' },
        side.toUpperCase()
      )
    );
    svg.appendChild(svgEl('rect', { x: x - 16, y: 40, width: 32, height: 5, fill: '#2a3044' }));
    svg.appendChild(
      svgEl('rect', {
        x: x - 16,
        y: 40,
        width: (32 * hp) / 100,
        height: 5,
        fill: hp > 50 ? '#58d6a0' : hp > 25 ? '#f5b942' : '#ff6b6b'
      })
    );
  }
  return svg;
}

function labOneView(r) {
  let i = Math.min(LAB.simStep || 0, r.log.length - 1),
    ent = r.log[i];
  return h(
    'div',
    { class: 'lab-one' },
    h(
      'b',
      null,
      'One battle: ' + (r.winner === 'draw' ? 'draw' : r.winner.toUpperCase() + ' wins') + ' in round ' + r.rounds
    ),
    labStrip(ent),
    h(
      'div',
      { class: 'lab-row lab-btns' },
      h(
        'button',
        {
          class: 'btn sm',
          onclick: () => {
            LAB.simStep = Math.max(0, i - 1);
            return labRerender();
          }
        },
        '\u25C0 Step'
      ),
      h(
        'button',
        {
          class: 'btn sm',
          onclick: () => {
            LAB.simStep = Math.min(r.log.length - 1, i + 1);
            return labRerender();
          }
        },
        'Step \u25B6'
      ),
      h('button', { class: 'btn sm', onclick: () => labPlayLog() }, 'Play'),
      h('span', { class: 'muted' }, 'step ' + (i + 1) + ' of ' + r.log.length)
    ),
    ent
      ? h(
          'div',
          { class: 'lab-ev' },
          h(
            'b',
            null,
            'Round ' +
              ent.round +
              ', ' +
              ent.side.toUpperCase() +
              ': ' +
              ent.act +
              ' \u00B7 ' +
              plural(ent.dist, 'hex') +
              ' apart' +
              (ent.vis[ent.side] ? '' : " \u00B7 can't see the enemy")
          ),
          ...ent.lines.map((l) => h('div', null, l))
        )
      : null,
    labHitTable(r.st, 'This battle')
  );
}

function labPlayLog() {
  clearInterval(labPlayLog.t);
  let r = LAB.simOut;
  if (!r) return;
  labPlayLog.t = setInterval(
    () => {
      if (!LAB.simOut || (LAB.simStep || 0) >= r.log.length - 1 || !$('#lab') || $('#lab').hidden)
        return clearInterval(labPlayLog.t);
      LAB.simStep = (LAB.simStep || 0) + 1;
      labRerender();
    },
    reduceMotion ? 900 : 450
  );
}

function labHitTable(st, title) {
  let row = (side, k, f) => f(st[side]),
    pct = (a, t) => (t ? Math.round((100 * a) / t) + '%' : '\u2013');
  return h(
    'table',
    { class: 'lab-stats lab-hits' },
    h('tr', null, h('th', null, title), h('th', null, 'A'), h('th', null, 'B')),
    ...[
      [
        'Laser volleys / avg hits',
        (s) => s.volleys + ' / ' + (s.volleys ? (s.volleyHits / s.volleys).toFixed(2) : '\u2013')
      ],
      ['Missiles launched', (s) => s.launched],
      ['\u2026hit target', (s) => s.mHits + ' (' + pct(s.mHits, s.launched) + ')'],
      ['\u2026stopped by enemy PD', (s) => s.stopped],
      ['Hits taken', (s) => s.hitsTaken],
      ['\u2026soaked by shields', (s) => s.shieldBlock + ' (' + pct(s.shieldBlock, s.hitsTaken) + ')'],
      ['\u2026soaked by armour', (s) => s.armourBlock + ' (' + pct(s.armourBlock, s.hitsTaken) + ')'],
      ['\u2026hit systems', (s) => s.systemHits],
      [
        'Shield soak vs lasers / missiles',
        (s) =>
          (s.byCause.laser ? s.byCause.laser.shield : 0) +
          ' / ' +
          Object.entries(s.byCause)
            .filter(([c]) => /missile/.test(c))
            .reduce((a, [, o]) => a + o.shield, 0)
      ]
    ].map(([k, f]) =>
      h('tr', null, h('th', null, k), h('td', null, String(row('a', k, f))), h('td', null, String(row('b', k, f))))
    )
  );
}

function labMCView(r) {
  let n = Math.max(1, r.runs),
    avg = r.roundsKill.length ? (r.roundsKill.reduce((a, c) => a + c, 0) / r.roundsKill.length).toFixed(1) : '\u2013',
    per = (x) => (x / n).toFixed(2),
    st = r.acc,
    surv = (side) =>
      h(
        'div',
        { class: 'lab-surv' },
        h('b', { style: 'color:' + LAB_COLORS[side] }, side.toUpperCase() + ' parts surviving'),
        ...Object.entries(r.surv[side])
          .sort()
          .map(([p, [al, tot]]) =>
            h(
              'div',
              { class: 'lab-bar' },
              h('span', null, p.replace(/_/g, ' ')),
              h('i', { style: 'width:' + Math.round((100 * al) / Math.max(1, tot)) + '%' }),
              h('em', null, Math.round((100 * al) / Math.max(1, tot)) + '%')
            )
          )
      );
  return h(
    'div',
    { class: 'lab-mc' },
    h(
      'div',
      { class: 'lab-win' },
      ...[
        ['a', r.a],
        ['b', r.b],
        ['draw', r.draw]
      ].map(([k, c]) =>
        h(
          'div',
          { style: 'flex:' + Math.max(c, 0.001) + ';background:' + (LAB_COLORS[k] || '#4a5168') },
          (k === 'draw' ? 'draw' : k.toUpperCase()) + ' ' + Math.round((100 * c) / n) + '%'
        )
      )
    ),
    h(
      'p',
      null,
      n +
        ' battles. Average rounds to a kill: ' +
        avg +
        '. Expected damage per laser volley: A ' +
        (st.a.volleys ? (st.a.volleyHits / st.a.volleys).toFixed(2) : '\u2013') +
        ', B ' +
        (st.b.volleys ? (st.b.volleyHits / st.b.volleys).toFixed(2) : '\u2013') +
        ' hits. Missile hit rate after point defence: A ' +
        (st.a.launched ? Math.round((100 * st.a.mHits) / st.a.launched) + '%' : '\u2013') +
        ', B ' +
        (st.b.launched ? Math.round((100 * st.b.mHits) / st.b.launched) + '%' : '\u2013') +
        '.'
    ),
    labHitTable(
      Object.fromEntries(
        ['a', 'b'].map((s) => [
          s,
          Object.fromEntries(
            Object.entries(st[s]).map(([k, val]) => [
              k,
              typeof val == 'number'
                ? Number(per(val))
                : Object.fromEntries(
                    Object.entries(val).map(([c, o2]) => [
                      c,
                      Object.fromEntries(Object.entries(o2).map(([kk, x]) => [kk, Number(per(x))]))
                    ])
                  )
            ])
          )
        ])
      ),
      'Per battle (average)'
    ),
    h('div', { class: 'lab-two' }, surv('a'), surv('b'))
  );
}

function labKnobPanel() {
  let def = labDocs.world,
    K = LAB.knobs,
    applied = labStoredKnobs();
  return h(
    'section',
    { class: 'card lab-knobs' },
    h('h3', null, 'Rules knobs'),
    h(
      'p',
      { class: 'muted' },
      "Change a rule and every number above updates (they're fed into the same rules builder Play uses). Changed values are highlighted."
    ),
    h(
      'div',
      { class: 'lab-kgrid' },
      ...LAB_KNOBS.map(([lab, path, kind, tip]) => {
        let cur = path in K ? K[path] : labGet(def, path),
          orig = labGet(def, path),
          changed = path in K && JSON.stringify(K[path]) !== JSON.stringify(orig),
          input =
            kind === 'bool'
              ? h('input', {
                  type: 'checkbox',
                  checked: !!cur,
                  onchange: (ev) => {
                    K[path] = ev.target.checked;
                    return labRerender();
                  }
                })
              : kind === 'tiers'
                ? h('input', {
                    value: JSON.stringify(cur),
                    style: 'width:9em',
                    onchange: (ev) => {
                      try {
                        let t = JSON.parse(ev.target.value);
                        if (Array.isArray(t) && t.length === 3) K[path] = t;
                      } catch {}
                      labRerender();
                    }
                  })
                : h('input', {
                    type: 'number',
                    value: cur == null ? '' : cur,
                    style: 'width:4.5em',
                    onchange: (ev) => {
                      K[path] = Number(ev.target.value);
                      return labRerender();
                    }
                  });
        return h('label', { class: 'lab-knob' + (changed ? ' changed' : ''), title: tip }, h('span', null, lab), input);
      })
    ),
    h(
      'div',
      { class: 'lab-row lab-btns' },
      h(
        'button',
        {
          class: 'btn sm',
          onclick: () => {
            LAB.knobs = {};
            return labRerender();
          }
        },
        'Reset to game rules'
      ),
      h(
        'button',
        {
          class: 'btn sm',
          onclick: () => {
            store.set('shatkon.labKnobs', JSON.stringify(LAB.knobs));
            labApplyPlayRules();
            labToast('Rules applied: new games in Play use them');
            labRerender();
          }
        },
        'Apply to Play'
      ),
      Object.keys(applied).length
        ? h(
            'button',
            {
              class: 'btn sm',
              onclick: () => {
                store.set('shatkon.labKnobs', '{}');
                labApplyPlayRules();
                labToast('Play is back on the standard rules');
                labRerender();
              }
            },
            'Remove from Play'
          )
        : null,
      Object.keys(applied).length
        ? h('span', { class: 'muted' }, 'Play is using ' + plural(Object.keys(applied).length, 'changed rule') + '.')
        : null
    )
  );
}

function labDesignChoices() {
  let lib = labLibrary(),
    L = [
      ['A', 'Ship A: ' + LAB.a.name, LAB.a],
      ['B', 'Ship B: ' + LAB.b.name, LAB.b]
    ];
  for (let p of labPresets()) L.push(['P:' + p.name, 'Preset: ' + p.name, p]);
  lib.forEach((d, i) => L.push(['L:' + d.name, 'Library: ' + d.name, labEditable(d)]));
  return L;
}

function labPlayPanel() {
  let ch = labDesignChoices(),
    pl = LAB.play,
    pick = (k) =>
      h(
        'div',
        { class: 'lab-pick' },
        h('b', null, k === 'p1' ? 'Player 1 (you, gold)' : 'Player 2 (computer / opponent, blue)'),
        ...ch.map(([id, n]) =>
          h(
            'label',
            { class: 'lchip' + (pl[k].includes(id) ? ' on' : '') },
            h('input', {
              type: 'checkbox',
              checked: pl[k].includes(id),
              onchange: (ev) => {
                pl[k] = ev.target.checked ? pl[k].concat(id) : pl[k].filter((x) => x !== id);
                labRerender();
              }
            }),
            n
          )
        )
      ),
    res = labPlayRules(),
    bad = res.problems.filter((p) => (pl.sandbox ? !/budget/.test(p) : true));
  return h(
    'section',
    { class: 'card lab-play' },
    h('h3', null, 'Play these designs'),
    h(
      'p',
      { class: 'muted' },
      'Start a real game on the Skirmish map with these fleets (using the current rules knobs). Ships are placed in each home zone automatically. Mode (vs computer, pass and play\u2026) is whatever is chosen in Play.'
    ),
    h('div', { class: 'lab-two' }, pick('p1'), pick('p2')),
    h(
      'label',
      { class: 'lab-chk' },
      h('input', {
        type: 'checkbox',
        checked: pl.sandbox,
        onchange: (ev) => {
          pl.sandbox = ev.target.checked;
          return labRerender();
        }
      }),
      ' Sandbox: ignore the budget (' + labDocs.fleets.budget + ')'
    ),
    bad.length
      ? h('div', { class: 'lab-warn' }, '\u26A0 ' + bad.join(' '))
      : h(
          'div',
          { class: 'muted' },
          'Fleets are valid.' + (res.problems.length ? ' (Over budget, but sandbox is on.)' : '')
        ),
    h(
      'div',
      { class: 'lab-row lab-btns' },
      h(
        'button',
        {
          class: 'btn primary',
          disabled: bad.length > 0 || !pl.p1.length || !pl.p2.length,
          onclick: () => labStartPlay()
        },
        'Start game in Play'
      )
    )
  );
}

function labPlayRules(cfg, knobs) {
  cfg = cfg || {
    p1: LAB.play.p1,
    p2: LAB.play.p2,
    sandbox: LAB.play.sandbox,
    designs: Object.fromEntries(labDesignChoices().map(([id, , d]) => [id, labClean(d)]))
  };
  let p1 = cfg.p1.map((id) => cfg.designs[id]).filter(Boolean),
    p2 = cfg.p2.map((id) => cfg.designs[id]).filter(Boolean);
  return labRules(p1, p2, {
    map: structuredClone(labDocs.map),
    sandbox: cfg.sandbox,
    knobs: knobs != null ? knobs : LAB.knobs
  });
}

function labStartPlay() {
  let cfg = {
    p1: LAB.play.p1,
    p2: LAB.play.p2,
    sandbox: LAB.play.sandbox,
    designs: Object.fromEntries(labDesignChoices().map(([id, , d]) => [id, labClean(d)]))
  };
  store.set('shatkon.labPlay', JSON.stringify(cfg));
  store.set('shatkon.labKnobs', JSON.stringify(LAB.knobs));
  labApplyPlayRules();
  newGame();
  labCamStale = true;
  location.hash = '#play';
  labRoute();
}

// Play's rules = standard files + applied knobs (+ Lab fleets if chosen)
export function labApplyPlayRules() {
  if (!labDocs) return;
  let knobs = labStoredKnobs(),
    cfg = null;
  try {
    cfg = JSON.parse(store.get('shatkon.labPlay') || 'null');
  } catch {}
  let r = cfg ? labPlayRules(cfg, knobs) : E.buildRules(labWorld(knobs), labDocs.map, labDocs.fleets),
    bad = r.problems.filter((p) => (cfg && cfg.sandbox ? !/budget/.test(p) : true));
  if (cfg && bad.length) {
    store.set('shatkon.labPlay', '');
    r = E.buildRules(labWorld(knobs), labDocs.map, labDocs.fleets);
  }
  setRules(r.rules, r.problems.filter((p) => !(cfg && cfg.sandbox && /budget/.test(p))));
  labBanner();
}

function labBanner() {
  let el = $('#labbanner');
  if (!el) return;
  let k = Object.keys(labStoredKnobs()).length,
    cfg = store.get('shatkon.labPlay');
  if (!k && !cfg) { el.hidden = true; return; }
  el.hidden = false;
  el.replaceChildren(
    h(
      'span',
      null,
      '\u{1F9EA} ' +
        (cfg ? 'Lab fleets' : '') +
        (cfg && k ? ' + ' : '') +
        (k ? plural(k, 'Lab rule change') : '') +
        ' active for new games.'
    ),
    h(
      'button',
      {
        class: 'btn sm',
        onclick: () => {
          store.set('shatkon.labPlay', '');
          store.set('shatkon.labKnobs', '{}');
          labApplyPlayRules();
          newGame();
        }
      },
      'Back to standard'
    ),
    h('a', { href: '#lab', class: 'btn sm' }, 'Open Lab')
  );
}

let labCamStale = false;

export function labRoute() {
  let lab = location.hash === '#lab',
    L = $('#lab'),
    M = $('main');
  if (!L || !M) return;
  L.hidden = !lab;
  M.hidden = lab;
  for (let t of document.querySelectorAll('#tabs a'))
    t.setAttribute('aria-current', (t.getAttribute('href') === '#lab') === lab ? 'page' : 'false');
  if (lab) labRender();
  else if (game) {
    if (labCamStale) {
      wholeMap();
      labCamStale = false;
    }
    render();
  }
  labBanner();
}

window.addEventListener('hashchange', labRoute);

// engine-level helpers for tests
export const labAPI = {
  labRules,
  labDuel,
  labProfile,
  labStats,
  labBattle,
  labMonteCarlo,
  labPresets,
  labVariant,
  labSitu,
  labPlayRules,
  labApplyPlayRules,
  LAB
};