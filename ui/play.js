// The play screen. It draws one player's view from the engine and sends actions
// back. It holds no game rules: everything it shows comes from the engine.

import * as E from '../engine/index.js';
import { drawBoard, partLooks, S, W } from './board.js';
const { hex } = E;

// ---------- tiny DOM helpers ----------
const $ = (q) => document.querySelector(q);
function fill(e, kids) { for (const k of kids.flat(3)) if (k != null && k !== false) e.appendChild(k.nodeType ? k : document.createTextNode(String(k))); return e; }
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  return fill(e, kids);
}

// ---------- app state ----------
let rules = null, problems = [], game = null, looks = {};
let seat = 'all';                 // 'all' = both players share this screen, or 0 / 1
let sel = null, look = null, mode = 'move', pending = null;
let hint = '', hintErr = false, code = '';
const cam = { x: 0, y: 0, w: 0 }; // what part of the board is on screen
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

async function loadRules() {
  let texts = window.SHATKON_RULES || null;
  if (!texts) {
    const stamp = '?t=' + Date.now(), get = async (n) => { const r = await fetch('rules/' + n + stamp); if (!r.ok) throw new Error('could not read rules/' + n); return r.text(); };
    const names = YAML.parse(await get('index.yaml')).files;
    texts = {};
    for (const n of names) texts[n] = await get(n);
  }
  const docs = Object.values(texts).map((t) => YAML.parse(t));
  const built = E.buildRules(docs.find((d) => d && d.bay_parts), docs.find((d) => d && d.map), docs.find((d) => d && d.budget !== undefined && !d.bay_parts));
  rules = built.rules; problems = built.problems;
}

function save() {
  if (game) E.exportGame(game).then((c) => store.set('shatkon.game', c));
  store.set('shatkon.seat', String(seat));
}
function say(text, err) { hint = text; hintErr = !!err; }
const who = () => (seat === 'all' ? 'all' : seat);
const turnOf = () => game.order[game.turn];
const myTurn = () => game && game.phase === 'play' && (seat === 'all' || turnOf() === seat);

function newGame() {
  game = E.start(rules, (Date.now() % 2147483647) | 0);
  looks = partLooks(game.rules);
  sel = look = pending = null; mode = 'move'; code = ''; cam.w = 0;
  say('New game. Find the enemy flagship and destroy it. Tap one of your ships to begin.');
  save(); render();
}

function act(action, quiet) {
  const p = turnOf();
  const r = E.attempt(game, action);
  if (!r.ok) { say('Not allowed: ' + r.why + '.', true); return render(); }
  game = r.state; pending = null;
  const mine = game.events.filter((e) => e.seenBy.includes(p) && e.t !== 'lost').map(describe);
  if (action.type === 'end' || game.phase === 'over') {
    code = E.turnCode(game); sel = null; mode = 'move'; cam.w = 0;      // back to the whole map for the next player
    if (!quiet) say(game.phase === 'over' ? mine.join(' ') : 'Turn ended.');
  } else {
    say(mine.join(' ') || 'Done.');
    if (game.phase === 'play' && turnOf() === p && game.players[p].cp <= 0) {      // nothing left to spend
      const kept = hint;
      act({ type: 'end' }, true);
      say(kept + ' No command points left, so the turn ended.');
      return render();
    }
  }
  save(); render();
}

// ---------- words ----------
const at = (c) => '[' + c[0] + ', ' + c[1] + ']';
const nice = (k) => String(k).replace(/_/g, ' ');
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : /x$/.test(w) ? 'es' : 's');
function whyText(w) {
  if (!w) return '';
  if (w.lit) return 'It is lit up by an explosion or a collision, so everyone can see it for now.';
  if (w.drone) return 'It gave itself away by spotting one of your ships.';
  return 'Your ' + w.by + ' sees it from ' + plural(w.d, 'hex') + ' away: sensor ' + w.range + ' + its signature ' + w.sig + (w.flare ? ' (which includes ' + w.flare + ' of flare from firing)' : '') + ' reaches ' + (w.range + w.sig) + '.';
}
function describe(e) {
  switch (e.t) {
    case 'move': return e.ship + ' moved ' + plural(e.steps, 'hex') + '.';
    case 'sighted': return 'Spotted ' + (e.kind === 'ship' ? 'enemy ship ' + e.id : 'a ' + nice(e.kind)) + ' at ' + at(e.at) + '. ' + whyText(e.why);
    case 'lost': return 'Lost sight of ' + e.id + (e.faded ? ': its flare faded.' : ': it is out of sensor range now.') + ' A "?" marks where it was last seen.';
    case 'fire': return e.ship + ' fired' + (e.hits ? '.' : ' and did nothing.');
    case 'damage': return e.ship + ' segment ' + (e.seg + 1) + ' took ' + plural(e.hits, 'hit') + ' from a ' + nice(e.cause) + ': ' + e.lost.join(', ') + '.';
    case 'hit': return 'Hit ' + e.ship + ' with ' + plural(e.hits, 'hit') + (e.wrecked ? ' and wrecked the segment.' : '.');
    case 'destroyed': return (e.flagship ? 'Flagship ' : 'Ship ') + e.ship + ' was destroyed.';
    case 'blast': return 'A ' + nice(e.kind) + ' exploded at ' + at(e.at) + '.';
    case 'stopped': return 'Point defence on ' + e.ship + ' stopped a ' + nice(e.kind) + '.';
    case 'launch': return e.ship + ' launched a ' + nice(e.kind) + (e.target ? ' locked on ' + e.target : '') + '.';
    case 'scan': return 'Scanned ' + e.target + ', segment ' + (e.seg + 1) + '.';
    case 'bump': return e.ship + ' ran into ' + e.into + '. Both are revealed.';
    case 'obj_lost': return 'Your ' + nice(e.kind) + ' ' + e.why + '.';
    case 'obj_destroyed': return 'A ' + nice(e.kind) + ' was destroyed at ' + at(e.at) + '.';
    case 'ammo_lost': return e.ship + ' lost ' + e.n + ' stored munition(s).';
    case 'game_over': return e.winner === 'draw' ? 'The game is a draw.' : 'Player ' + (e.winner + 1) + ' wins.';
  }
  return e.t;
}
function forecastText(f, kind) {
  if (!f) return '';
  const when = f.rounds <= 1 ? 'in this round\'s flight phase' : 'in ' + f.rounds + ' rounds';
  if (f.ends === 'hit') return 'On this path the ' + nice(kind) + ' reaches ' + f.hit + ' ' + when + ', if nothing moves.';
  if (f.ends === 'edge') return 'On this path it flies off the board ' + when + ' unless its seeker finds something within ' + game.rules.munitions[kind].seeker_range + ' hexes.';
  if (f.ends === 'asteroid') return 'On this path it hits an asteroid.';
  return 'On this path it runs out of fuel after ' + plural(f.path.length, 'hex') + ' unless its seeker finds something.';
}

function compass(a, b) {
  const dx = W * (b[0] + b[1] / 2) - W * (a[0] + a[1] / 2), dy = 1.5 * S * (b[1] - a[1]);
  return ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
}

// ---------- what a tap would do in the current mode ----------
function options(v) {
  const map = new Map();
  if (!myTurn() || (pending && pending.type !== 'move') || (!sel && mode !== 'scan' && mode !== 'detonate')) return map;
  if (mode === 'move') for (const r of E.reach(game, sel)) map.set(hex.key(r.at), { action: { type: 'move', ship: sel, path: r.path }, mark: 'move', label: r.path.length });
  if (mode === 'fire') for (const t of E.beamTargets(game, sel)) {
    const k = hex.key(t.at);
    if (!map.has(k) || map.get(k).hits < t.hits) map.set(k, { action: { type: 'fire', ship: sel, seg: t.seg, part: t.part, at: t.at }, mark: 'target', hits: t.hits, label: t.hits });
  }
  if (mode === 'missile' || mode === 'seeker_drone') {
    const lo = E.launchOptions(game, sel), me = v.ships.find((x) => x.id === sel);
    if (lo && me && lo.kinds.includes(mode)) {
      const outward = (st) => { let best = me.cells[0]; for (const c of me.cells) if (hex.dist(c, st) < hex.dist(best, st)) best = c; return [hex.dirToward(best, st)]; };
      for (const st of lo.starts) map.set(hex.key(st), { preview: { type: 'launch', ship: sel, kind: mode, start: st, target: null, route: outward(st) }, mark: 'way' });
      if (game.rules.munitions[mode].seeker_range) for (const id of lo.locks) {
        const foe = v.ships.find((x) => x.id === id);
        for (const c of foe ? foe.cells : []) {
          let st = lo.starts[0]; for (const o of lo.starts) if (hex.dist(o, c) < hex.dist(st, c)) st = o;
          map.set(hex.key(c), { preview: { type: 'launch', ship: sel, kind: mode, start: st, target: id, route: [] }, mark: 'lock' });
        }
      }
    }
  }
  if (mode === 'scan') for (const x of v.ships) if (!x.mine && x.seen) x.cells.forEach((c, i) => map.set(hex.key(c), { action: { type: 'scan', target: x.id, seg: i }, mark: 'lock' }));
  if (mode === 'detonate') for (const o of v.objs) if (o.mine && game.rules.munitions[o.kind].remote_detonate) map.set(hex.key(o.pos), { action: { type: 'detonate', obj: o.id }, mark: 'target' });
  return map;
}

function tap(c, v, opts) {
  const o = opts.get(hex.key(c));
  if (o && o.action && o.action.type === 'move') {      // first tap shows where the ship would end up; second tap goes
    if (pending && pending.type === 'move' && pending.path.join('') === o.action.path.join('')) return act(pending);
    pending = o.action;
    const ship = v.ships.find((x) => x.id === sel), to = pending.path.reduce((c, d) => hex.step(c, d), ship.pos);
    say('The dashed outline shows where ' + sel + ' will end up: ' + plural(pending.path.length, 'hex') + ' ' + compass(ship.pos, to) + '. Tap it again or press Move here.');
    return render();
  }
  if (o && o.action) return act(o.action);
  if (o && o.preview) {
    pending = o.preview;
    say(forecastText(E.forecast(game, pending), pending.kind) + ' Press Launch to send it, or Cancel.');
    return render();
  }
  if (pending && pending.type !== 'move') return;
  pending = null;
  const ship = v.ships.find((x) => x.cells.some((y) => hex.same(y, c)));
  if (ship && ship.mine && myTurn()) selectShip(ship.id, v);
  else if (ship) { look = ship.id; say(ship.mine ? 'Your ship ' + ship.id + '.' : 'Enemy ship ' + ship.id + '. ' + (ship.seen ? whyText(ship.why) : 'The player to move cannot see it.')); }
  else {
    const obj = v.objs.find((x) => hex.same(x.pos, c)), gh = v.ghosts.find((x) => x.cells.some((y) => hex.same(y, c)));
    say(at(c) + (obj ? ': ' + (obj.mine ? 'your ' : 'enemy ') + nice(obj.kind) + (obj.fuel != null ? ', ' + plural(obj.fuel, 'round') + ' of fuel left' : '') + '.'
      : gh ? ': ' + (gh.kind === 'ship' ? 'an enemy ship' : 'a ' + nice(gh.kind)) + ' was last seen here in round ' + gh.round + '.' : ': empty space.'));
    if (!obj && !gh) { sel = null; look = null; mode = 'move'; }
  }
  render();
}

function selectShip(id, v) {
  sel = id; look = null; mode = 'move'; pending = null;
  const ship = v.ships.find((x) => x.id === id), st = E.shipStatus(game, id);
  say(id + ' selected. ' + (st.moveLeft > 0 ? 'Green markers show where its centre can move; the number is how many hexes that uses. Tap one to preview the move.' : 'It cannot move further this turn.'));
  frame(ship.cells, 9);
}

// ---------- camera ----------
function fitWidth() {
  const R = game.rules.board.radius, box = $('#wrap'), aspect = box.clientHeight / Math.max(1, box.clientWidth);
  return Math.max(W * (2 * R + 1) + 16, (S * (3 * R + 2) + 16) / aspect);
}
function wholeMap() { cam.x = 0; cam.y = 0; cam.w = fitWidth(); }
function frame(cells, minHexes) {       // bring a set of hexes into view
  const box = $('#wrap'), aspect = box.clientHeight / Math.max(1, box.clientWidth);
  const xs = cells.map((c) => W * (c[0] + c[1] / 2)), ys = cells.map((c) => 1.5 * S * c[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  cam.x = (x0 + x1) / 2; cam.y = (y0 + y1) / 2;
  cam.w = Math.min(fitWidth(), Math.max(minHexes * W, x1 - x0 + 4 * W, (y1 - y0 + 6 * S) / aspect));
}
function zoomBy(k) { cam.w = Math.max(7 * W, Math.min(fitWidth(), cam.w * k)); }

// ---------- panels ----------
function shipCard(x, v) {
  const lines = [];
  if (x.mine || seat === 'all') {
    const st = x.mine && myTurn() ? E.shipStatus(game, x.id) : null;
    if (st) {
      lines.push(st.moveLeft > 0 ? 'Can move ' + plural(st.moveLeft, 'more hex') + ' this turn (' + st.costPerHex + ' thrust per hex).' : 'Cannot move further this turn.');
      const w = [];
      if (st.beams) w.push(st.beamsReady + ' of ' + st.beams + ' lasers ready');
      if (st.launchers) w.push(st.launchersReady ? 'launcher ready' : 'launcher already used this turn');
      for (const [k, n] of Object.entries(st.ammo)) w.push(plural(n, nice(k)) + ' left');
      if (w.length) lines.push('Weapons: ' + w.join(', ') + '.');
    }
    lines.push('Sees small things within ' + plural(x.sensor, 'hex') + ', and bigger ships from further away.');
    const quiet = x.signature - x.flare;
    lines.push('Signature ' + x.signature + (x.flare ? ' (' + quiet + ' normally, +' + x.flare + ' flare from firing until the end of next round)' : '') + ': an enemy with sensor ' + v.shownSensor + ' spots it from ' + plural(Math.max(0, v.shownSensor + x.signature), 'hex') + '.'
      + (x.signature < 0 ? ' Below zero means it can slip inside their sensor range unseen.' : ''));
    if (!x.mine) lines.push(x.seen ? whyText(x.why) : 'The player to move cannot see this ship.');
  } else lines.push(whyText(x.why));
  const rows = x.segs.map((sg, i) => h('div', null, h('span', { class: 'muted' }, 'Segment ' + (i + 1) + (sg.wrecked ? ' (wrecked)' : '') + (sg.scanned ? ' (as scanned in round ' + sg.scanned + ')' : '')),
    h('div', { class: 'parts' }, sg.parts ? (sg.parts.length ? sg.parts.map((p) => h('span', { class: 'chip' + (p.hp <= 0 ? ' dead' : p.hp < p.max ? ' hurt' : '') }, h('i', { style: 'background:' + looks[p.t].color }), nice(p.t) + (p.max > 1 ? ' ' + p.hp + '/' + p.max : ''))) : h('span', { class: 'muted' }, 'empty')) : h('span', { class: 'muted' }, 'unknown: use Scan to find out'))));
  return h('div', { class: 'card who' + x.owner }, h('h2', { style: 'color:var(--me)' }, x.id + (x.name ? ' "' + x.name + '"' : '') + (x.flagship ? ' (flagship)' : '') + (x.mine ? '' : ' (enemy)')), lines.map((l) => h('p', null, l)), rows);
}
function codeBox(label, text, button) {
  const ta = h('textarea', { readonly: true, 'aria-label': label }, text);
  return h('div', { class: 'card' }, h('h2', null, label), ta, h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => {
    const done = () => { say('Copied.'); render(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => ta.select());
    else { ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} }
  } }, button)));
}
function pasteBox(label, button, onText) {
  const ta = h('textarea', { 'aria-label': label, placeholder: 'Paste here' });
  return h('div', { class: 'card' }, h('h2', null, label), ta, h('div', { class: 'row' }, h('button', { class: 'btn go', onclick: () => onText(ta.value) }, button)));
}

// ---------- render ----------
function render() {
  const seatEl = $('#seat'); seatEl.textContent = '';
  for (const [val, label] of [['all', 'Both players'], [0, 'Player 1'], [1, 'Player 2']])
    seatEl.appendChild(h('button', { 'aria-pressed': String(seat === val), onclick: () => { seat = val; sel = look = pending = null; mode = 'move'; cam.w = 0; save(); render(); } }, label));
  $('#problems').textContent = '';
  if (problems.length) $('#problems').appendChild(h('div', { class: 'card warn' }, h('h2', null, 'The rule files have problems'), problems.map((p) => h('p', null, p))));
  const bar = $('#turnbar'), fleet = $('#fleet'), tools = $('#tools'), wrap = $('#wrap'), panels = $('#panels'), hintEl = $('#hint'), camEl = $('#camera');
  for (const e of [bar, fleet, tools, panels, camEl]) e.textContent = '';
  if (!game) { hintEl.textContent = 'Loading the rules.'; return; }
  if (!cam.w) wholeMap();
  const v = E.view(game, who()), turn = turnOf(), mine = myTurn(), R = game.rules;
  if (sel && !v.ships.some((x) => x.id === sel && x.mine)) sel = null;

  // turn bar: whose turn, where we are in the round, what is left to spend
  bar.className = 'who' + (game.phase === 'over' && v.winner !== 'draw' ? v.winner : turn);
  const stepNames = game.order.map((p) => 'Player ' + (p + 1)).concat('Flight');
  fill(bar, [h('div', { class: 'big' }, game.phase === 'over' ? (v.winner === 'draw' ? 'The game is a draw' : 'Player ' + (v.winner + 1) + ' wins') : mine ? (seat === 'all' ? 'Player ' + (turn + 1) + '\'s turn' : 'Your turn') : 'Waiting for player ' + (turn + 1)),
    h('div', { class: 'line' }, h('span', null, 'Round ', h('b', { class: 'n' }, v.round), ' of ' + R.turnLimit), stepNames.map((n, i) => h('span', { class: 'stepchip' + (game.phase === 'play' && i === game.turn ? ' now' : '') }, n))),
    mine ? h('div', { class: 'line' },
      h('span', null, 'Command points ', h('span', { class: 'pips', 'aria-label': v.cp + ' command points' }, '●'.repeat(Math.min(v.cp, 12)), h('i', null, '●'.repeat(Math.max(0, R.cp.perTurn - v.cp)))), ' ', h('b', { class: 'n' }, v.cp)),
      h('span', null, 'Thrust ', h('b', { class: 'n' }, v.thrust), ' (moving costs 1 per segment per hex)')) : null]);

  // fleet strip: every ship of the player to move, with what it has left
  if (mine) for (const x of v.ships.filter((s) => s.mine)) {
    const st = E.shipStatus(game, x.id), stat = (label, val, zero) => h('span', { class: zero ? 'zero' : '' }, label + ' ', h('b', null, val));
    fleet.appendChild(h('button', { class: 'shipchip who' + x.owner, 'aria-pressed': String(sel === x.id), onclick: () => { selectShip(x.id, v); render(); } },
      h('div', { class: 'nm' }, (x.flagship ? '★ ' : '') + x.id + ' ' + x.name),
      h('div', { class: 'st' }, stat('Move', st.moveLeft, !st.moveLeft), st.beams ? stat('Lasers', st.beamsReady + '/' + st.beams, !st.beamsReady) : null,
        Object.entries(st.ammo).map(([k, n]) => stat(nice(k) + 's', n, !n)))));
  }

  // board
  const opts = options(v);
  const plan = pending && pending.type === 'launch' ? E.forecast(game, pending) : null;
  let ghost = null;
  if (pending && pending.type === 'move') {
    const ship = v.ships.find((x) => x.id === pending.ship), to = pending.path.reduce((c, d) => hex.step(c, d), ship.pos);
    ghost = { from: ship.pos, to, cells: ship.segs.map((sg) => [to[0] + sg.off[0], to[1] + sg.off[1]]), owner: ship.owner };
  }
  const plans = v.objs.filter((o) => o.mine && myTurn()).map((o) => ({ id: o.id, f: E.forecast(game, o.id) })).filter((x) => x.f);
  wrap.textContent = '';
  wrap.appendChild(drawBoard({ view: v, rules: R, looks, cam, sel, opts, plan, plans, ghost, seat, box: wrap, onTap: (c) => tap(c, v, opts) }));
  fill(camEl, [h('button', { 'aria-label': 'Zoom out', onclick: () => { zoomBy(1.4); render(); } }, '−'), h('button', { 'aria-label': 'Zoom in', onclick: () => { zoomBy(0.7); render(); } }, '+'),
    h('button', { onclick: () => { wholeMap(); render(); } }, 'Whole map')]);

  // actions
  if (mine && pending) {
    fill(tools, [h('button', { class: 'btn go', onclick: () => act(pending) }, pending.type === 'move' ? 'Move here' : 'Launch ' + nice(pending.kind)), h('button', { class: 'btn', onclick: () => { pending = null; say('Cancelled.'); render(); } }, 'Cancel')]);
  } else if (mine) {
    const me = sel && v.ships.find((x) => x.id === sel), st = me ? E.shipStatus(game, sel) : null, lo = me ? E.launchOptions(game, sel) : null;
    const shots = me ? E.beamTargets(game, sel) : [];
    const help = { move: 'Tap a green marker to see where the ship would end up, then tap it again to move.', fire: 'Tap a red ring to fire at it. The number is how many hits it will do.',
      missile: 'Tap an amber ring to lock on to that ship, or a blue dot to send the missile straight out that way. You will see its path before it launches.',
      seeker_drone: 'Tap a blue dot to send the drone out that way. It wanders and reports what it sees.', scan: 'Tap a segment of an enemy ship to see its parts.', detonate: 'Tap one of your drones to blow it up.' };
    const btn = (m, label, sub, on, cells) => h('button', { class: 'btn', 'aria-pressed': String(mode === m && on), disabled: !on, onclick: () => { mode = m; pending = null; say(help[m]); if (cells && cells.length) frame(cells, 9); render(); } }, label, h('small', null, sub));
    const launchWhy = (kind) => !st ? 'select a ship' : !st.launchers ? 'no launcher' : !(st.ammo[kind] > 0) ? 'none left' : !st.launchersReady ? 'launcher used' : st.ammo[kind] + ' left';
    const foes = v.ships.filter((x) => !x.mine && x.seen);
    fill(tools, [
      btn('move', 'Move', !st ? 'select a ship' : st.moveLeft ? 'up to ' + st.moveLeft : 'no moves left', !!st && st.moveLeft > 0, me && me.cells),
      btn('fire', 'Fire', !st ? 'select a ship' : !st.beams ? 'no laser' : !st.beamsReady ? 'already fired' : shots.length ? plural(new Set(shots.map((t) => t.target)).size, 'target') : 'nothing in range', shots.length > 0, me ? me.cells.concat(shots.map((t) => t.at)) : null),
      btn('missile', 'Missile', launchWhy('missile'), !!lo && lo.kinds.includes('missile'), me ? me.cells.concat(foes.filter((f) => lo && lo.locks.includes(f.id)).flatMap((f) => f.cells)) : null),
      btn('seeker_drone', 'Drone', launchWhy('seeker_drone'), !!lo && lo.kinds.includes('seeker_drone'), me && me.cells),
      btn('scan', 'Scan', foes.length ? 'enemy in sight' : 'no enemy in sight', foes.length > 0 && v.cp >= R.cost.scan, foes.flatMap((f) => f.cells)),
      v.objs.some((o) => o.mine && R.munitions[o.kind].remote_detonate) ? btn('detonate', 'Detonate', 'a drone', v.cp >= R.cost.detonate, null) : null,
      h('span', { class: 'sp' }), h('button', { class: 'btn go', onclick: () => act({ type: 'end' }) }, 'End turn', h('small', null, v.cp ? 'banks ' + Math.min(v.cp, R.cp.bankCap) + ' points' : ''))]);
  }

  hintEl.className = hintErr ? 'err' : '';
  hintEl.textContent = hint || (mine ? 'Tap one of your ships to select it.' : '');

  // what happened since this player last acted
  if (game.phase === 'play' && mine && v.news.length)
    panels.appendChild(h('div', { class: 'card news' }, h('h2', null, v.round === 1 ? 'What you know so far' : 'Since your last turn'), h('ul', { class: 'feed' }, v.news.slice(-10).map((e) => h('li', null, describe(e))))));

  const shown = v.ships.find((x) => x.id === (sel || look));
  if (shown) panels.appendChild(shipCard(shown, v));
  if (game.phase === 'play' && seat !== 'all' && !mine)
    panels.appendChild(pasteBox('Paste player ' + (turn + 1) + '\'s turn code:', 'Play their turn', (text) => {
      try { game = E.applyTurnCode(game, text); code = ''; say('Their turn has been played. Yours now.'); save(); }
      catch (e) { say(e.message.charAt(0).toUpperCase() + e.message.slice(1) + '.', true); }
      render();
    }));
  if (code && seat !== 'all') panels.appendChild(codeBox('Your turn code: send this to your opponent', code, 'Copy turn code'));

  panels.appendChild(h('div', { class: 'card' }, h('h2', null, 'Key'),
    h('div', { class: 'parts' }, Object.entries(looks).map(([name, l]) => h('span', { class: 'chip' }, h('i', { style: 'background:' + l.color }), l.letter + ' ' + nice(name)))),
    h('p', { class: 'muted' }, 'Zoom in to see the parts inside each segment: three inner hexagons (bays) and three corner diamonds (mounts). Dark slots are destroyed. The darker area of the board is outside your sensor range. With "Both players" chosen, faded enemy pieces are ones the player to move cannot see.')));
  if (v.feed.length) panels.appendChild(h('div', { class: 'card' }, h('h2', null, 'Earlier'), h('ul', { class: 'feed' }, v.feed.slice(-12).reverse().map((e) => h('li', null, 'Round ' + e.r + ': ' + describe(e))))));
  panels.appendChild(h('div', { class: 'card' }, h('h2', null, 'Game'), h('div', { class: 'row' },
    h('button', { class: 'btn', onclick: () => { if (!game || game.phase === 'over' || confirm('Start a new game? The current one will be replaced.')) newGame(); } }, 'New game'),
    h('button', { class: 'btn', onclick: async () => { const c = await E.exportGame(game); panels.appendChild(codeBox('Game code: the whole game, to start or recover one', c, 'Copy game code')); } }, 'Show game code')),
    h('p', { class: 'muted' }, 'To play on two phones: one player starts a new game and sends the game code. After that you only swap turn codes. Each phone holds the full game, so the fog relies on neither of you looking at the other seat.')));
  panels.appendChild(pasteBox('Load a game code', 'Load game', async (text) => {
    try { game = await E.importGame(text); looks = partLooks(game.rules); sel = look = pending = null; code = ''; cam.w = 0; say('Game loaded.'); save(); }
    catch (e) { say(e.message.charAt(0).toUpperCase() + e.message.slice(1) + '.', true); }
    render();
  }));
}

(async function main() {
  render();
  try { await loadRules(); } catch (e) { $('#hint').textContent = 'Could not load the rule files: ' + e.message; return; }
  const savedSeat = store.get('shatkon.seat');
  if (savedSeat === '0' || savedSeat === '1') seat = Number(savedSeat);
  const saved = store.get('shatkon.game');
  if (saved) {
    try {
      game = await E.importGame(saved); looks = partLooks(game.rules);
      say('Your saved game has been restored.');
    } catch (e) { game = null; }
  }
  window.__shatkon = { get game() { return game; }, E };
  if (!game) newGame(); else render();
  window.addEventListener('resize', () => { if (game) render(); });
})();
