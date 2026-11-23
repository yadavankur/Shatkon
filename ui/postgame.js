// The battle report shown when a skirmish ends: three cards you swipe through.
//   1. Head to head  - who won, fleet hull left, damage done, ships lost, side by side as bars
//   2. Shots         - laser shots by range band (1-4, 5-8, 9+): how many, the damage they did, how many
//                      were blocked on the way; missiles and what became of them. (Lasers never miss: what
//                      decides a shot is the range and what is in the way.)
//   3. Key moments   - a timeline by round: first sightings, big hits, ships lost; tap one to see it on the board
// Everything comes from the battle log (engine/log.js), which replays the game from its seed, so the
// numbers match the saved log file exactly.
import * as E from '../engine/index.js';

function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
}
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const ownerOf = (id) => { const m = /^(\d)/.exec(id || ''); return m ? Number(m[1]) - 1 : null; };

// The numbers, for both sides. Exported for the tests.
export function battleStats(game, opts = {}) {
  const log = E.battleLog(game, { seat: opts.seat ?? null });
  const { moments } = E.analyse(log);
  const sides = [0, 1].map((k) => {
    const ships = game.ships.filter((z) => z.owner === k);
    return { ships: ships.length, lost: ships.filter((z) => z.dead && !z.converted).length,   // a ship that went silent (rapid mode) isn't lost
      converted: ships.filter((z) => z.converted).length,   // ...but it is gone from the fleet, so it is counted on its own
      hull: ships.length ? Math.round(ships.reduce((n, z) => n + (z.dead ? 0 : E.hullPct(game, z)), 0) / ships.length) : 0,
      dealt: 0, shots: 0, hits: 0, bands: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], blocked: 0, missiles: { fired: 0, hit: 0, stopped: 0, wasted: 0, flying: 0 }, unused: 0 };
  });
  const evs = [];
  for (const t of log.turns) for (const a of t.actions || []) for (const e of a.events || []) evs.push({ e, round: t.round, player: t.player });
  for (const { e } of evs) {
    if (e.t === 'damage') { const vic = ownerOf(e.ship); if (vic != null && sides[1 - vic]) sides[1 - vic].dealt += e.hits; }
    if (e.t === 'fire') {
      const p = ownerOf(e.ship), sd = sides[p]; if (!sd) continue;
      const d = e.from ? E.hex.dist(e.from, e.at) : 1, band = d <= 4 ? 0 : d <= 8 ? 1 : 2;
      const short = !!(e.end && (e.end[0] !== e.at[0] || e.end[1] !== e.at[1]));
      sd.shots++; sd.bands[band][0]++; sd.bands[band][1] += e.hits || 0;
      if (short) { sd.blocked++; sd.bands[band][2]++; }
      if (e.hits > 0) sd.hits++;
    }
  }
  for (const m of moments.missiles) {
    const sd = sides[m.player]; if (!sd || m.kind === 'drone') continue;
    sd.missiles.fired++;
    if (/^hit for/.test(m.fate)) sd.missiles.hit++;
    else if (/point defence/.test(m.fate)) sd.missiles.stopped++;
    else if (/still flying/.test(m.fate)) sd.missiles.flying++;
    else sd.missiles.wasted++;
  }
  for (const u of moments.unused) if (sides[u.player]) sides[u.player].unused += u.cpWasted || 0;

  // the timeline
  const names = {};
  for (const z of game.ships) names[z.id] = z.name || z.id;
  const nm = (id) => names[id] || id;
  const items = [];
  for (const [by, f] of Object.entries(moments.firstSight)) items.push({ round: f.round, side: Number(by), kind: 'sight', at: f.at, text: 'First sight of ' + nm(f.id) + ' (by ' + f.how.replace(/\s*\(.*$/, '') + ')' });
  for (const b of moments.bigHits.filter((x) => x.hits >= 2).slice(0, 4)) items.push({ round: b.round, side: b.owner, kind: 'hit', at: null, ship: b.ship, text: nm(b.ship) + ' takes ' + b.hits + ' hits' + (b.cause ? ' (' + String(b.cause).replace(/_/g, ' ') + ')' : '') });
  // coloured by whose ship it was: your losses in your colour, theirs in theirs
  for (const l of moments.lost) items.push({ round: l.round, side: l.owner, kind: l.flagship ? 'flag' : 'lost', ship: l.ship, text: (l.owner === 0 ? 'Your ' : 'Their ') + (l.flagship ? 'flagship ' : '') + (l.name || nm(l.ship)) + ' destroyed' });
  for (const z of game.ships.filter((x) => x.converted)) { const ev = evs.find(({ e }) => e.t === 'converted' && e.ship === z.id); if (ev) items.push({ round: ev.round, side: z.owner, kind: 'conv', ship: z.id, at: ev.e.at, text: nm(z.id) + ' went silent as a ' + (z.converted === 'mine' ? 'mine' : 'scanner') }); }
  items.sort((a, b) => a.round - b.round || (a.kind === 'flag') - (b.kind === 'flag'));
  for (const it of items) if (!it.at && it.ship) { const z = game.ships.find((s) => s.id === it.ship); if (z) it.at = z.pos.slice(); }
  const econ = game.econ ? econStats(game, evs) : null;
  return { econ, sides, items, rounds: game.rules.rapid ? game.round : Math.min(game.round, game.rules.turnLimit), winner: game.winner, log };   // rapid: ticks, the opening included
}

// Economy mode (Frontier): what each side earned, what it bought and what the purchases did.
function econStats(game, evs) {
  const E2 = game.econ, out = [0, 1].map((p) => ({ earned: E2.earned[p], purse: E2.purse[p], spent: { ...E2.spent[p] }, perTick: E2.perTick[p].slice(), from: {}, buys: [] }));
  const turrets = new Map();   // obj id -> { side, round, shots, dmg, gone }
  for (const { e, round } of evs) {
    if (e.t === 'earned') for (const it of e.items || []) out[e.player].from[it.why] = (out[e.player].from[it.why] || 0) + it.n;
    if (e.t === 'bought') {
      out[e.player].buys.push({ round, item: e.item, kind: e.kind, ship: e.ship, obj: e.obj, cost: e.cost });
      if (e.obj) turrets.set(e.obj, { side: e.player, round, shots: 0, dmg: 0, gone: null });
    }
    if (e.t === 'turret_fire' && turrets.has(e.obj)) turrets.get(e.obj).shots++;
    if (e.t === 'damage' && e.cause === 'turret') { const t = turrets.get(e.by); if (t) t.dmg += e.hits; }
    if (e.t === 'obj_destroyed' && turrets.has(e.obj) && turrets.get(e.obj).gone == null) turrets.get(e.obj).gone = round;
  }
  for (const side of out) for (const b of side.buys) if (b.obj) b.turret = turrets.get(b.obj);
  return out;
}

// The overlay. opts: { seat, title, sideName(k), onAgain(), onClose(), onSave(), onShow(at) }
export function postGameCards(game, opts = {}) {
  const st = battleStats(game, opts);
  const name = opts.sideName || ((k) => 'Player ' + (k + 1));
  const [a, b] = st.sides;
  const bar = (label, va, vb, fmt = (x) => x) => {
    const max = Math.max(va, vb, 1);
    return h('div', { class: 'pg-h2h' },
      h('span', { class: 'pg-v s0' }, fmt(va)), h('div', { class: 'pg-bar l' }, h('i', { class: 's0', style: 'width:' + (100 * va) / max + '%' })),
      h('span', { class: 'pg-k' }, label),
      h('div', { class: 'pg-bar r' }, h('i', { class: 's1', style: 'width:' + (100 * vb) / max + '%' })), h('span', { class: 'pg-v s1' }, fmt(vb)));
  };
  const head = h('div', { class: 'pg-sides' }, h('b', { class: 's0' }, name(0)), h('b', { class: 's1' }, name(1)));
  const card1 = h('section', { class: 'pg-card', 'aria-label': 'Head to head' }, h('h3', null, 'Head to head'), head,
    bar('Hull left', a.hull, b.hull, (x) => x + '%'), bar('Damage done', a.dealt, b.dealt), bar('Ships lost', a.lost, b.lost, (x) => x),
    a.converted || b.converted ? bar('Went silent', a.converted, b.converted, (x) => x) : null,
    bar('Laser shots', a.shots, b.shots), bar('Moves wasted', a.unused, b.unused),
    h('p', { class: 'pg-foot' }, 'Finished in round ' + st.rounds + '.'));

  const rateCell = (sd, i) => { const [n, dmg, blk] = sd.bands[i];
    return h('td', null, h('div', { class: 'pg-rate' }, h('i', { style: 'width:' + pct(n, sd.shots) + '%' })), h('span', null, n ? n + (n === 1 ? ' shot' : ' shots') : '–'),
      h('small', null, n ? dmg + ' damage' + (blk ? ' · ' + blk + ' blocked' : '') : '')); };
  const msl = (sd) => sd.missiles.fired ? [sd.missiles.hit + ' hit', sd.missiles.stopped + ' shot down', sd.missiles.wasted + ' missed', sd.missiles.flying ? sd.missiles.flying + ' still flying' : null].filter(Boolean).join(' · ') : 'none fired';
  const card2 = h('section', { class: 'pg-card', 'aria-label': 'Shots' }, h('h3', null, 'Laser shots by range'),
    h('table', { class: 'pg-tab' },
      h('thead', null, h('tr', null, h('th'), h('th', null, 'Close', h('small', null, '1–4')), h('th', null, 'Medium', h('small', null, '5–8')), h('th', null, 'Far', h('small', null, '9+')))),
      h('tbody', null, [0, 1].map((k) => h('tr', { class: 's' + k }, h('th', null, name(k)), [0, 1, 2].map((i) => rateCell(st.sides[k], i)))))),
    h('div', { class: 'pg-msl' }, [0, 1].map((k) => h('div', { class: 's' + k }, h('b', null, name(k) + ' missiles: ' + st.sides[k].missiles.fired), h('span', null, msl(st.sides[k]))))));

  const icon = { sight: '\u{1F441}', hit: '✸', lost: '✖', flag: '★', conv: '◌' };
  const card3 = h('section', { class: 'pg-card', 'aria-label': 'Key moments' }, h('h3', null, 'Key moments'),
    st.items.length ? h('ol', { class: 'pg-time' }, st.items.map((it) => h('li', { class: 's' + it.side + ' k-' + it.kind },
      h('span', { class: 'pg-r' }, 'R' + it.round), h('span', { class: 'pg-i', 'aria-hidden': 'true' }, icon[it.kind]),
      it.at && opts.onShow ? h('button', { class: 'pg-t', onclick: () => opts.onShow(it.at) }, it.text) : h('span', { class: 'pg-t' }, it.text))))
      : h('p', { class: 'pg-foot' }, 'A quiet battle: nothing to show.'),
    opts.onShow ? h('p', { class: 'pg-foot' }, 'Tap a moment to see where it happened.') : null);

  // 4. economy mode: salvage in and out, and what each purchase did
  let card4 = null;
  if (st.econ) {
    const spark = (vals, cls) => { const w = 220, hgt = 36, n = Math.max(1, vals.length - 1), mx = Math.max(1, ...vals);
      const pts = vals.map((v, i) => (i * w / n).toFixed(1) + ',' + (hgt - (v / mx) * (hgt - 2) - 1).toFixed(1)).join(' ');
      const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s2.setAttribute('viewBox', '0 0 ' + w + ' ' + hgt); s2.setAttribute('class', 'pg-spark ' + cls);
      const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); pl.setAttribute('points', pts); s2.appendChild(pl); return s2; };
    const words = { cross: 'first across', kill: 'kills', hold: 'holding the line', ground: 'new ground', rock: 'by asteroids' };
    const buyText = (b) => b.item === 'turret' ? 'Turret from ' + b.ship + ': ' + (b.turret.shots ? b.turret.shots + ' shots, ' + b.turret.dmg + ' damage' : 'never fired') + (b.turret.gone != null ? ', destroyed R' + b.turret.gone : ', still standing')
      : b.item === 'upgrade' ? 'Upgrade ' + b.ship + ': ' + E.UPGRADES[b.kind].label : b.item === 'resupply' ? 'Resupply ' + b.ship + ': +1 ' + String(b.kind).replace(/_/g, ' ') : 'Heatmap';
    card4 = h('section', { class: 'pg-card', 'aria-label': 'Economy' }, h('h3', null, 'Salvage \u25c8'), head,
      bar('Earned', st.econ[0].earned, st.econ[1].earned), bar('Spent', Object.values(st.econ[0].spent).reduce((x, y) => x + y, 0), Object.values(st.econ[1].spent).reduce((x, y) => x + y, 0)),
      bar('Turret upkeep', st.econ[0].spent.upkeep || 0, st.econ[1].spent.upkeep || 0),
      h('div', { class: 'pg-msl' }, [0, 1].map((k) => h('div', { class: 's' + k },
        h('b', null, name(k) + ': income a tick'), spark(st.econ[k].perTick, 's' + k),
        h('span', null, Object.entries(st.econ[k].from).map(([w, n]) => (words[w] || w) + ' ' + n).join(' · ') || 'nothing earned'),
        h('span', null, st.econ[k].buys.length ? st.econ[k].buys.map((b) => 'R' + b.round + ' ' + buyText(b)).join('; ') : 'bought nothing')))));
  }
  const cards = [card1, card2, card3, card4].filter(Boolean);
  const track = h('div', { class: 'pg-track' }, cards);
  const dots = h('div', { class: 'pg-dots' }, cards.map((c, i) => h('button', { 'aria-label': c.getAttribute('aria-label'), onclick: () => track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' }) })));
  const mark = () => { const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); [...dots.children].forEach((d, j) => d.setAttribute('aria-current', String(i === j))); };
  track.addEventListener('scroll', mark, { passive: true });
  setTimeout(mark, 0);
  const result = st.winner === 'draw' ? 'Draw' : opts.title || name(st.winner) + ' wins';
  const box = h('div', { class: 'pg', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Battle report' },
    h('div', { class: 'pg-box who' + (st.winner === 'draw' ? '' : st.winner) },
      h('div', { class: 'pg-top' }, h('h2', null, result), h('button', { class: 'pg-x', 'aria-label': 'Close', onclick: () => opts.onClose && opts.onClose() }, '×')),
      track, dots,
      h('div', { class: 'pg-btns' },
        opts.onAgain ? h('button', { class: 'btn go', onclick: () => opts.onAgain() }, 'Play again') : null,
        h('button', { class: 'btn', onclick: () => opts.onClose && opts.onClose() }, 'See the board'),
        opts.onSave ? h('button', { class: 'btn', onclick: () => opts.onSave() }, 'Save log') : null)));
  return box;
}
