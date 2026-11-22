// Rapid Grok battle report, game log and replay (plain English, in beats).
// This is separate from the classic / Rapid Opus report in ui/postgame.js, which talks
// in rounds and command points and cannot replay a Rapid Grok game.
import * as G from '../engine/rapidgrok.js';

const $ = (id) => document.getElementById(id);
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
}

function titleOf(log) {
  const w = log.result.winner;
  if (log.result.phase !== 'over') return 'Battle paused';
  if (w === 'draw') return 'Draw';
  if (log.seat === 'cpu') return w === 0 ? 'You win!' : 'You lose';
  return log.sides[w] + ' wins';
}

function resultLine(log) {
  const w = log.result.winner, beats = log.result.beats;
  if (w === 'draw') return 'Nobody won within ' + log.result.beatLimit + ' beats. The game lasted ' + beats + ' beats.';
  if (w === 0) return 'The computer’s Flower is destroyed. The game lasted ' + beats + ' beats.';
  if (w === 1) return 'Your Flower was destroyed. The game lasted ' + beats + ' beats.';
  return log.result.text;
}

function fillReport(box, log, handlers) {
  const st = log.stats, name = (k) => log.sides[k];
  const [a, b] = st.sides;
  const bar = (label, va, vb, fmt = (x) => x) => {
    const max = Math.max(va, vb, 1);
    return h('div', { class: 'pg-h2h' },
      h('span', { class: 'pg-v s0' }, fmt(va)), h('div', { class: 'pg-bar l' }, h('i', { class: 's0', style: 'width:' + (100 * va) / max + '%' })),
      h('span', { class: 'pg-k' }, label),
      h('div', { class: 'pg-bar r' }, h('i', { class: 's1', style: 'width:' + (100 * vb) / max + '%' })), h('span', { class: 'pg-v s1' }, fmt(vb)));
  };
  const card1 = h('section', { class: 'pg-card', 'aria-label': 'Head to head' },
    h('h3', null, 'Head to head'),
    h('div', { class: 'pg-sides' }, h('b', { class: 's0' }, name(0)), h('b', { class: 's1' }, name(1))),
    bar('Hull left', a.hull, b.hull, (x) => x + '%'),
    bar('Damage done', a.dealt, b.dealt),
    bar('Ships lost', a.lost, b.lost),
    bar('Laser shots', a.shots, b.shots),
    bar('Missiles', a.missiles.fired, b.missiles.fired),
    h('p', { class: 'pg-foot' }, resultLine(log)));

  const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);
  const rateCell = (sd, i) => {
    const [n, dmg] = sd.bands[i];
    return h('td', null, h('div', { class: 'pg-rate' }, h('i', { style: 'width:' + pct(n, sd.shots) + '%' })),
      h('span', null, n ? n + (n === 1 ? ' shot' : ' shots') : '–'),
      h('small', null, n ? dmg + ' damage' : ''));
  };
  const msl = (sd) => sd.missiles.fired
    ? [sd.missiles.hit + ' hit', sd.missiles.stopped + ' shot down', sd.missiles.wasted + ' missed', sd.missiles.flying ? sd.missiles.flying + ' still flying' : null].filter(Boolean).join(' · ')
    : 'none fired';
  const card2 = h('section', { class: 'pg-card', 'aria-label': 'Shots' },
    h('h3', null, 'Laser shots by range'),
    h('table', { class: 'pg-tab' },
      h('thead', null, h('tr', null, h('th'), h('th', null, 'Close', h('small', null, '1–4')), h('th', null, 'Medium', h('small', null, '5–8')), h('th', null, 'Far', h('small', null, '9+')))),
      h('tbody', null, [0, 1].map((k) => h('tr', { class: 's' + k }, h('th', null, name(k)), [0, 1, 2].map((i) => rateCell(st.sides[k], i)))))),
    h('div', { class: 'pg-msl' }, [0, 1].map((k) => h('div', { class: 's' + k }, h('b', null, name(k) + ' missiles: ' + st.sides[k].missiles.fired), h('span', null, msl(st.sides[k]))))));

  const icon = { sight: '\u{1F441}', hit: '✸', lost: '✖', flag: '★' };
  const card3 = h('section', { class: 'pg-card', 'aria-label': 'Key moments' },
    h('h3', null, 'Key moments'),
    st.items.length
      ? h('ol', { class: 'pg-time' }, st.items.map((it) => h('li', { class: 's' + it.side + ' k-' + it.kind },
        h('span', { class: 'pg-r' }, 'B' + it.beat), h('span', { class: 'pg-i', 'aria-hidden': 'true' }, icon[it.kind] || '·'),
        it.at && handlers.onShow ? h('button', { class: 'pg-t', onclick: () => handlers.onShow(it.at) }, it.text) : h('span', { class: 'pg-t' }, it.text))))
      : h('p', { class: 'pg-foot' }, 'A quiet battle: nothing to show.'),
    h('p', { class: 'pg-foot' }, 'B is a beat (your action plus the computer’s reply). Tap a moment to see it on the board.'));

  const card4 = h('section', { class: 'pg-card', 'aria-label': 'Game log' },
    h('h3', null, 'Game log'),
    h('ol', { class: 'pg-log', id: 'rgLogList' }, log.acts.map((rec, i) => {
      const li = h('li', { class: 'seat' + rec.seat + (rec.why && rec.why !== 'play' && rec.why !== 'ai' ? ' special' : ''), 'data-i': i },
        h('span', { class: 'pg-r' }, 'B' + rec.beat),
        h('div', { class: 'pg-logbody' },
          h('div', { class: 'pg-logsay' }, rec.say),
          ...(rec.events || []).filter((e) => e.t !== 'move' || rec.action.type !== 'move').map((e) => h('div', { class: 'pg-logev' }, e.say))));
      return li;
    })),
    log.note ? h('p', { class: 'pg-foot' }, log.note) : h('p', { class: 'pg-foot' }, log.acts.length + ' actions, in order. Replayable from the seed.'));

  const cards = [card1, card2, card3, card4];
  const track = h('div', { class: 'pg-track', id: 'rgTrack' }, cards);
  const labels = ['Head to head', 'Shots', 'Key moments', 'Game log'];
  const dots = h('div', { class: 'pg-dots' }, cards.map((c, i) => h('button', { type: 'button', 'aria-label': labels[i], title: labels[i], onclick: () => track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' }) })));
  const mark = () => { const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); [...dots.children].forEach((d, j) => d.setAttribute('aria-current', String(i === j))); };
  track.addEventListener('scroll', mark, { passive: true });
  setTimeout(mark, 0);

  box.textContent = '';
  box.append(
    h('div', { class: 'pg-box who' + (log.result.winner === 'draw' || log.result.winner == null ? '' : log.result.winner) },
      h('div', { class: 'pg-top' }, h('h2', { id: 'overTitle' }, titleOf(log)), h('button', { class: 'pg-x', type: 'button', 'aria-label': 'Close', onclick: () => handlers.onClose && handlers.onClose() }, '×')),
      h('p', { class: 'pg-lead', id: 'overText' }, resultLine(log)),
      track, dots,
      h('div', { class: 'pg-btns' },
        h('button', { class: 'btn go', type: 'button', onclick: () => handlers.onAgain && handlers.onAgain() }, 'Play again'),
        h('button', { class: 'btn', type: 'button', onclick: () => handlers.onClose && handlers.onClose() }, 'See the board'),
        h('button', { class: 'btn', type: 'button', onclick: () => handlers.onReplay && handlers.onReplay() }, 'Replay'),
        h('button', { class: 'btn', type: 'button', onclick: () => handlers.onSave && handlers.onSave() }, 'Save log'),
        h('a', { class: 'btn', href: 'index.html' }, 'Home'))));
  return { track, go: (i) => track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' }) };
}

export function buildLog(game) { return G.rgBattleLog(game, { seat: 'cpu' }); }

export function showReport(game, handlers) {
  const log = buildLog(game);
  const box = $('over');
  box.hidden = false;
  box.classList.add('postgame');
  const ui = fillReport(box, log, handlers);
  return { log, ui };
}

export function hideReport() {
  const box = $('over');
  box.hidden = true;
}

export function downloadLog(log) {
  const d = new Date(), two = (n) => String(n).padStart(2, '0');
  const name = 'shatkon-rapid-grok-' + d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + '-' + two(d.getHours()) + two(d.getMinutes()) + '.json';
  const text = JSON.stringify({ ...log, recap: (log.summary || []).join('\n') }, null, 2);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return name;
}

export { titleOf, resultLine };
