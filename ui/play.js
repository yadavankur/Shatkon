// The play screen. It only ever draws a player's view from the engine and sends
// actions back; it contains no game rules of its own.

import * as E from '../engine/index.js';
const { hex } = E;

// ---------- tiny DOM helpers ----------
const SVGNS = 'http://www.w3.org/2000/svg';
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
function s(tag, attrs, ...kids) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) e.setAttribute(k, v);
  return fill(e, kids);
}

// ---------- app state ----------
let rules = null, problems = [], game = null;
let seat = 'all';          // 'all' = both players at one screen, or 0 / 1
let sel = null, look = null, mode = 'move', zoom = window.innerWidth < 700 ? 2 : 1;
let hint = '', hintErr = false, code = '', centreOn = null;
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

function save() { if (game) E.exportGame(game).then((c) => store.set('shatkon.game', c)); store.set('shatkon.seat', String(seat)); }
function say(text, err) { hint = text; hintErr = !!err; }
function newGame() {
  game = E.start(rules, (Date.now() % 2147483647) | 0);
  sel = look = null; mode = 'move'; code = ''; centreOn = 'flag';
  say('New game. ' + (seat === 'all' ? 'Both players share this screen.' : 'Send the game code to your opponent so you both start from the same game.'));
  save(); render();
}
function act(action) {
  const r = E.attempt(game, action);
  if (!r.ok) { say('Not allowed: ' + r.why + '.', true); return render(); }
  const before = game; game = r.state;
  if (action.type === 'end' || game.phase === 'over') { code = E.turnCode(game); sel = null; mode = 'move'; }
  const mine = game.events.filter((e) => e.seenBy.includes(before.order[before.turn]) && e.t !== 'sighted' && e.t !== 'lost');
  say(mine.length ? mine.map(describe).join(' ') : 'Done.');
  save(); render();
}

const who = () => (seat === 'all' ? 'all' : seat);
const myTurn = () => game && game.phase === 'play' && (seat === 'all' || game.order[game.turn] === seat);

// ---------- words ----------
const at = (c) => '[' + c[0] + ', ' + c[1] + ']';
function describe(e) {
  switch (e.t) {
    case 'move': return e.ship + ' moved ' + e.steps + (e.steps === 1 ? ' hex.' : ' hexes.');
    case 'sighted': return 'Spotted a ' + e.kind.replace('_', ' ') + ' at ' + at(e.at) + '.';
    case 'lost': return 'Lost sight of ' + e.id + '.';
    case 'fire': return e.ship + ' fired' + (e.hits ? '' : ' and did nothing') + '.';
    case 'damage': return e.ship + ' segment ' + (e.seg + 1) + ' took ' + e.hits + (e.hits === 1 ? ' hit: ' : ' hits: ') + e.lost.join(', ') + '.';
    case 'hit': return 'Hit ' + e.ship + ' (' + e.hits + ')' + (e.wrecked ? ', segment wrecked.' : '.');
    case 'destroyed': return (e.flagship ? 'Flagship ' : 'Ship ') + e.ship + ' was destroyed.';
    case 'blast': return 'A ' + e.kind.replace('_', ' ') + ' exploded at ' + at(e.at) + '.';
    case 'stopped': return 'Point defence on ' + e.ship + ' stopped a ' + e.kind.replace('_', ' ') + '.';
    case 'launch': return e.ship + ' launched a ' + e.kind.replace('_', ' ') + (e.target ? ' locked on ' + e.target : '') + '.';
    case 'scan': return 'Scanned ' + e.target + ', segment ' + (e.seg + 1) + '.';
    case 'bump': return e.ship + ' ran into ' + e.into + '.';
    case 'obj_lost': return 'Your ' + e.kind.replace('_', ' ') + ' ' + e.why + '.';
    case 'obj_destroyed': return 'A ' + e.kind.replace('_', ' ') + ' was destroyed at ' + at(e.at) + '.';
    case 'ammo_lost': return e.ship + ' lost ' + e.n + ' stored munition(s).';
    case 'game_over': return e.winner === 'draw' ? 'The game is a draw.' : 'Player ' + (e.winner + 1) + ' wins.';
  }
  return e.t;
}

// ---------- board ----------
const S = 10, W = Math.sqrt(3) * S;
const X = (c) => W * (c[0] + c[1] / 2), Y = (c) => 1.5 * S * c[1];
function hexPath(c, k = 1) {
  let d = '';
  for (let i = 0; i < 6; i++) { const a = (Math.PI / 180) * (60 * i - 30); d += (i ? 'L' : 'M') + (X(c) + S * k * Math.cos(a)).toFixed(1) + ',' + (Y(c) + S * k * Math.sin(a)).toFixed(1); }
  return d + 'Z';
}
const col = (owner) => 'var(--p' + owner + ')';

function options(v) {            // what tapping a hex would do in the current mode
  const map = new Map();
  if (!myTurn() || !sel && mode !== 'scan' && mode !== 'detonate') return map;
  if (mode === 'move') for (const r of E.reach(game, sel)) map.set(hex.key(r.at), { action: { type: 'move', ship: sel, path: r.path }, mark: 'dot' });
  if (mode === 'fire') for (const t of E.beamTargets(game, sel)) { const k = hex.key(t.at); if (!map.has(k) || map.get(k).hits < t.hits) map.set(k, { action: { type: 'fire', ship: sel, seg: t.seg, part: t.part, at: t.at }, mark: 'ring', hits: t.hits, label: t.hits }); }
  if (mode === 'missile' || mode === 'seeker_drone') {
    const lo = E.launchOptions(game, sel), me = v.ships.find((x) => x.id === sel);
    if (lo && me && lo.kinds.includes(mode)) {
      const straight = (st) => { let best = me.cells[0]; for (const c of me.cells) if (hex.dist(c, st) < hex.dist(best, st)) best = c; return [hex.dirToward(best, st)]; };
      for (const st of lo.starts) map.set(hex.key(st), { action: { type: 'launch', ship: sel, kind: mode, start: st, target: null, route: straight(st) }, mark: 'dot' });
      if (game.rules.munitions[mode].seeker_range) for (const id of lo.locks) {
        const foe = v.ships.find((x) => x.id === id);
        for (const c of foe ? foe.cells : []) {
          let st = lo.starts[0]; for (const o of lo.starts) if (hex.dist(o, c) < hex.dist(st, c)) st = o;
          map.set(hex.key(c), { action: { type: 'launch', ship: sel, kind: mode, start: st, target: id, route: [] }, mark: 'ring', label: 'lock' });
        }
      }
    }
  }
  if (mode === 'scan') for (const x of v.ships) if (!x.mine) x.cells.forEach((c, i) => map.set(hex.key(c), { action: { type: 'scan', target: x.id, seg: i }, mark: 'ring' }));
  if (mode === 'detonate') for (const o of v.objs) if (o.mine && game.rules.munitions[o.kind].remote_detonate) map.set(hex.key(o.pos), { action: { type: 'detonate', obj: o.id }, mark: 'ring' });
  return map;
}

function board(v, opts) {
  const R = v.board.radius, pad = 6;
  const vb = [-W * (R + 0.5) - pad, -S * (1.5 * R + 1) - pad, W * (2 * R + 1) + 2 * pad, S * (3 * R + 2) + 2 * pad];
  const svg = s('svg', { viewBox: vb.map((n) => n.toFixed(1)).join(' '), style: 'display:block;width:' + zoom * 100 + '%;height:auto', role: 'img', 'aria-label': 'Game board' });
  let grid = '';
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (hex.inHexagon([q, r], R)) grid += hexPath([q, r], 0.96);
  svg.appendChild(s('path', { d: grid, class: 'grid' }));
  for (const t of v.terrain) {
    const solid = (game.rules.terrainTypes[t.type] || {}).blocks_movement;
    svg.appendChild(s('path', { d: t.cells.map((c) => hexPath(c, 0.96)).join(''), fill: solid ? 'var(--rock)' : 'var(--haze)', 'fill-opacity': solid ? 0.85 : 0.18 }));
  }
  for (const g of v.ghosts) {
    svg.appendChild(s('path', { d: g.cells.map((c) => hexPath(c, 0.9)).join(''), fill: 'none', stroke: 'var(--muted)', 'stroke-width': 0.8, 'stroke-dasharray': '2 2' }));
    svg.appendChild(s('text', { x: X(g.pos).toFixed(1), y: Y(g.pos).toFixed(1) }, '?'));
  }
  for (const x of v.ships) {
    x.segs.forEach((sg, i) => svg.appendChild(s('path', { d: hexPath(x.cells[i], 0.96), fill: col(x.owner), 'fill-opacity': sg.wrecked ? 0.15 : 0.8,
      stroke: x.id === sel ? 'var(--text)' : col(x.owner), 'stroke-width': x.id === sel ? 1.6 : 0.6, 'stroke-dasharray': sg.wrecked ? '1.5 1.5' : null })));
    svg.appendChild(s('text', { x: X(x.pos).toFixed(1), y: Y(x.pos).toFixed(1), style: 'fill:var(--bg);font-weight:700' }, x.id + (x.flagship ? '*' : '')));
  }
  for (const o of v.objs) {
    const cx = X(o.pos), cy = Y(o.pos), m = game.rules.munitions[o.kind];
    if (!m.speed) svg.appendChild(s('path', { d: `M${cx},${cy - 5}L${cx + 5},${cy}L${cx},${cy + 5}L${cx - 5},${cy}Z`, fill: col(o.owner), stroke: 'var(--bg)', 'stroke-width': 0.8 }));
    else if (m.patrol) svg.appendChild(s('circle', { cx, cy, r: 4, fill: 'var(--bg)', stroke: col(o.owner), 'stroke-width': 1.6 }));
    else svg.appendChild(s('path', { d: 'M6,0L-4,4L-4,-4Z', fill: col(o.owner), stroke: 'var(--bg)', 'stroke-width': 0.6, transform: `translate(${cx.toFixed(1)},${cy.toFixed(1)}) rotate(${-60 * o.dir})` }));
  }
  for (const [k, o] of opts) {
    const c = hex.unkey(k);
    if (o.mark === 'dot') svg.appendChild(s('circle', { cx: X(c).toFixed(1), cy: Y(c).toFixed(1), r: 2.6, fill: 'var(--hl)', 'fill-opacity': 0.75 }));
    else svg.appendChild(s('path', { d: hexPath(c, 1.02), fill: 'none', stroke: 'var(--hl)', 'stroke-width': 1.8 }));
  }
  svg.addEventListener('click', (ev) => {
    const m = svg.getScreenCTM(); if (!m) return;
    let p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; p = p.matrixTransform(m.inverse());
    const c = hex.cubeRound(((Math.sqrt(3) / 3) * p.x - p.y / 3) / S, ((2 / 3) * p.y) / S);
    if (hex.inHexagon(c, R)) tap(c, v, opts);
  });
  return svg;
}

function tap(c, v, opts) {
  const o = opts.get(hex.key(c));
  if (o) return act(o.action);
  const ship = v.ships.find((x) => x.cells.some((y) => hex.same(y, c)));
  if (ship && ship.mine && myTurn()) { sel = ship.id; look = null; mode = 'move'; say(ship.id + ' selected. Green dots show where it can move.'); }
  else if (ship) { look = ship.id; say('Looking at ' + ship.id + '.'); }
  else {
    const obj = v.objs.find((x) => hex.same(x.pos, c)), gh = v.ghosts.find((x) => x.cells.some((y) => hex.same(y, c)));
    say(at(c) + (obj ? ': ' + (obj.mine ? 'your ' : 'enemy ') + obj.kind.replace('_', ' ') + (obj.fuel != null ? ', fuel ' + obj.fuel : '') : gh ? ': ' + gh.kind.replace('_', ' ') + ' last seen here in round ' + gh.round : ''));
    if (!obj && !gh) { sel = null; look = null; }
  }
  render();
}

// ---------- panels ----------
function shipCard(x) {
  const rows = x.segs.map((sg, i) => h('div', null, h('span', { class: 'muted' }, 'Segment ' + (i + 1) + (sg.wrecked ? ' (wrecked)' : '') + (sg.scanned ? ' (scanned in round ' + sg.scanned + ')' : '')),
    h('div', { class: 'parts' }, sg.parts ? (sg.parts.length ? sg.parts.map((p) => h('span', { class: 'chip' + (p.hp <= 0 ? ' dead' : p.hp < p.max ? ' hurt' : '') }, p.t + (p.max > 1 ? ' ' + p.hp + '/' + p.max : ''))) : h('span', { class: 'muted' }, 'empty')) : h('span', { class: 'muted' }, 'unknown: scan it to find out'))));
  const load = x.load ? Object.entries(x.load).filter(([, n]) => n > 0).map(([k, n]) => n + ' ' + k.replace('_', ' ')).join(', ') : '';
  return h('div', { class: 'card' }, h('h2', { class: 'who' + x.owner }, x.id + (x.name ? ' "' + x.name + '"' : '') + (x.flagship ? ' (flagship)' : '') + (x.mine ? '' : ' (enemy)')),
    x.sensor != null ? h('p', null, 'Sensor range ' + x.sensor + ', signature ' + x.signature + ', comms link ' + x.link + ', engines ' + x.thrust + (load ? ', carrying ' + load : '') + '.') : null, rows);
}

function codeBox(label, text, button) {
  const ta = h('textarea', { readonly: true, 'aria-label': label }, text);
  return h('div', { class: 'card' }, h('h2', null, label), ta, h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => {
    const done = () => { say('Copied.'); render(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => { ta.select(); });
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
    seatEl.appendChild(h('button', { 'aria-pressed': String(seat === val), onclick: () => { seat = val; sel = look = null; mode = 'move'; centreOn = 'flag'; save(); render(); } }, label));
  $('#problems').textContent = '';
  if (problems.length) $('#problems').appendChild(h('div', { class: 'card warn' }, h('h2', null, 'The rule files have problems'), problems.map((p) => h('p', null, p))));
  const status = $('#status'), tools = $('#tools'), wrap = $('#wrap'), panels = $('#panels'), hintEl = $('#hint');
  status.textContent = ''; tools.textContent = ''; panels.textContent = '';
  if (!game) { wrap.textContent = ''; hintEl.textContent = 'Loading the rules.'; return; }
  const v = E.view(game, who()), turn = game.order[game.turn], mine = myTurn();
  if (sel && !v.ships.some((x) => x.id === sel && x.mine)) sel = null;

  fill(status, [h('span', null, 'Round ', h('b', null, v.round), ' of ' + game.rules.turnLimit + '. '),
    game.phase === 'over' ? h('b', null, v.winner === 'draw' ? 'Draw.' : 'Player ' + (v.winner + 1) + ' wins.') : h('span', { class: 'who' + turn }, 'Player ' + (turn + 1) + ' to move. '),
    game.phase === 'play' && (mine || seat === 'all') ? h('span', null, 'Command points ', h('b', null, v.cp), ', thrust ', h('b', null, v.thrust), v.canMove ? ' (a ship moves up to ' + v.moveCap + ').' : ' (not enough to move yet: needs ' + v.segments * game.rules.move.needsAverage + ').') : null]);

  const me = sel && v.ships.find((x) => x.id === sel), lo = me ? E.launchOptions(game, sel) : null;
  const modeBtn = (m, label, on) => h('button', { class: 'btn', 'aria-pressed': String(mode === m), disabled: !on, onclick: () => { mode = m; say(help[m]); render(); } }, label);
  const help = { move: 'Tap a green dot to move the selected ship.', fire: 'Tap a ringed hex to fire at it.', missile: 'Tap a ringed enemy to lock on, or a green dot to launch straight out.',
    seeker_drone: 'Tap a green dot next to the ship to launch the drone that way.', scan: 'Tap a segment of an enemy ship to see its parts.', detonate: 'Tap one of your drones to blow it up.' };
  if (mine) {
    fill(tools, [modeBtn('move', 'Move', !!me), modeBtn('fire', 'Fire', !!me && E.beamTargets(game, sel).length > 0),
      modeBtn('missile', 'Missile', !!lo && lo.kinds.includes('missile')), modeBtn('seeker_drone', 'Drone', !!lo && lo.kinds.includes('seeker_drone')),
      modeBtn('scan', 'Scan', v.ships.some((x) => !x.mine) && v.cp >= game.rules.cost.scan),
      modeBtn('detonate', 'Detonate', v.objs.some((o) => o.mine && game.rules.munitions[o.kind].remote_detonate) && v.cp >= game.rules.cost.detonate),
      h('span', { class: 'sp' }), h('button', { class: 'btn go', onclick: () => act({ type: 'end' }) }, 'End turn')]);
  }
  fill(tools, [mine ? null : h('span', { class: 'sp' }), h('span', { class: 'seg' }, [1, 2, 3].map((z) => h('button', { 'aria-pressed': String(zoom === z), onclick: () => { zoom = z; centreOn = sel || look || 'flag'; render(); } }, z + 'x')))]);

  const keep = [wrap.scrollLeft, wrap.scrollTop];
  wrap.textContent = '';
  const svg = board(v, options(v)); wrap.appendChild(svg);
  if (centreOn) {                // bring a ship into the middle of the scrolling board
    const tgt = centreOn === 'flag' ? v.ships.find((x) => x.mine && x.flagship) || v.ships.find((x) => x.mine) : v.ships.find((x) => x.id === centreOn);
    const vb = svg.viewBox.baseVal;
    if (tgt && vb && vb.width) { const k = svg.clientWidth / vb.width; wrap.scrollLeft = (X(tgt.pos) - vb.x) * k - wrap.clientWidth / 2; wrap.scrollTop = (Y(tgt.pos) - vb.y) * k - wrap.clientHeight / 2; }
    centreOn = null;
  } else { wrap.scrollLeft = keep[0]; wrap.scrollTop = keep[1]; }

  hintEl.className = hintErr ? 'err' : ''; hintEl.textContent = hint || (mine ? 'Tap one of your ships to select it.' : '');

  const shown = v.ships.find((x) => x.id === (sel || look));
  if (shown) panels.appendChild(shipCard(shown));
  if (game.phase === 'play' && seat !== 'all' && !mine)
    panels.appendChild(pasteBox('Waiting for player ' + (turn + 1) + '. Paste their turn code:', 'Play their turn', (text) => {
      try { game = E.applyTurnCode(game, text); code = ''; say('Their turn has been played. ' + game.events.filter((e) => e.seenBy.includes(seat) && e.t !== 'lost').map(describe).join(' ')); save(); }
      catch (e) { say(e.message.charAt(0).toUpperCase() + e.message.slice(1) + '.', true); }
      render();
    }));
  if (code && seat !== 'all') panels.appendChild(codeBox('Your turn code: send this to your opponent', code, 'Copy turn code'));
  if (v.feed.length) panels.appendChild(h('div', { class: 'card' }, h('h2', null, 'What ' + (seat === 'all' ? 'player ' + (turn + 1) + ' knows' : 'you know') + ' happened'),
    h('ul', { class: 'feed' }, v.feed.slice(-8).reverse().map((e) => h('li', null, 'Round ' + e.r + ': ' + describe(e))))));
  const gameCard = h('div', { class: 'card' }, h('h2', null, 'Game'), h('div', { class: 'row' },
    h('button', { class: 'btn', onclick: () => { if (!game || game.phase === 'over' || confirm('Start a new game? The current one will be replaced.')) newGame(); } }, 'New game'),
    h('button', { class: 'btn', onclick: async () => { const c = await E.exportGame(game); panels.appendChild(codeBox('Game code: the whole game, to start or recover one', c, 'Copy game code')); } }, 'Show game code')),
    h('p', { class: 'muted' }, 'To play on two phones: one player starts a new game and sends the game code. After that you only swap turn codes. Each phone holds the full game, so the fog relies on neither of you peeking at the other seat.'));
  panels.appendChild(gameCard);
  panels.appendChild(pasteBox('Load a game code', 'Load game', async (text) => {
    try { game = await E.importGame(text); sel = look = null; code = ''; centreOn = 'flag'; say('Game loaded.'); save(); }
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
  if (saved) { try { game = await E.importGame(saved); centreOn = 'flag'; say('Your saved game has been restored.'); } catch (e) { game = null; } }
  if (!game) newGame(); else render();
  window.__shatkon = { get game() { return game; }, E };
})();
