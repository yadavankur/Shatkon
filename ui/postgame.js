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
    return { ships: ships.length, lost: ships.filter((z) => z.dead).length,
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
  for (const b of moments.bigHits.filter((x) => x.hits >= 2).slice(0, 4)) items.push({ round: b.round, side: 1 - b.owner, kind: 'hit', at: null, ship: b.ship, text: nm(b.ship) + ' takes ' + b.hits + ' hits' + (b.cause ? ' (' + String(b.cause).replace(/_/g, ' ') + ')' : '') });
  for (const l of moments.lost) items.push({ round: l.round, side: 1 - l.owner, kind: l.flagship ? 'flag' : 'lost', ship: l.ship, text: (l.flagship ? 'Flagship ' : '') + (l.name || nm(l.ship)) + ' destroyed' });
  items.sort((a, b) => a.round - b.round || (a.kind === 'flag') - (b.kind === 'flag'));
  for (const it of items) if (!it.at && it.ship) { const z = game.ships.find((s) => s.id === it.ship); if (z) it.at = z.pos.slice(); }
  return { sides, items, rounds: game.rules.rapid ? game.round : Math.min(game.round, game.rules.turnLimit), winner: game.winner, log };   // rapid: ticks, the opening included
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

  const icon = { sight: '\u{1F441}', hit: '✸', lost: '✖', flag: '★' };
  const card3 = h('section', { class: 'pg-card', 'aria-label': 'Key moments' }, h('h3', null, 'Key moments'),
    st.items.length ? h('ol', { class: 'pg-time' }, st.items.map((it) => h('li', { class: 's' + it.side + ' k-' + it.kind },
      h('span', { class: 'pg-r' }, 'R' + it.round), h('span', { class: 'pg-i', 'aria-hidden': 'true' }, icon[it.kind]),
      it.at && opts.onShow ? h('button', { class: 'pg-t', onclick: () => opts.onShow(it.at) }, it.text) : h('span', { class: 'pg-t' }, it.text))))
      : h('p', { class: 'pg-foot' }, 'A quiet battle: nothing to show.'),
    opts.onShow ? h('p', { class: 'pg-foot' }, 'Tap a moment to see where it happened.') : null);

  const cards = [card1, card2, card3];
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
