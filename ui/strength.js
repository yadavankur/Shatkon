// EXPERIMENTAL: the Strength check drawer for lab-strength.html (a special build of the Lab).
// Tap a segment in the Lab, then "Strength check": a drawer shows how many shots of each weapon it takes
// to strip and finish that segment, and lets you fire single shots at it. All damage is done by the
// game's own engine/damage.js; the test missiles and cores come from ui/strength-model.js only.

import { labAPI } from './lab.js';
import { STRENGTH_LAB, strengthGame, strengthTable, fire, nextRound, segState, laserHits, segHasCore } from './strength-model.js';

const LAB = labAPI.LAB;
const S = { side: 'a', si: 0, core: 'basic', coreOnly: false, sim: null, log: [], flash: new Set(), world: null, open: false };

const el = (tag, attrs, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : String(k));
  return e;
};
const pretty = (t) => t.replace(/^test_missile_/, '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

async function loadWorld() {
  if (S.world) return S.world;
  const get = async (n) => { const r = await fetch('rules/' + n + '?t=' + Date.now()); if (!r.ok) throw new Error('could not read rules/' + n); return r.text(); };
  const names = YAML.parse(await get('index.yaml')).files;
  for (const n of names) { const d = YAML.parse(await get(n)); if (d && d.bay_parts) return (S.world = d); }
  throw new Error('no world file');
}

const design = () => LAB[S.side];
const opts = () => ({ core: S.core, coreOnly: S.coreOnly });
function reset() {
  S.sim = strengthGame(S.world, design(), opts());
  S.log = [];
  S.flash = new Set();
  S.shots = 0;
  S.endShot = 0;
}

// ---------- styles (this page only) ----------
const CSS = `
/* the first-visit "How to play" card is about battles: not over the Lab on this page */
html[data-strength] body:has(#lab:not([hidden])) #help{display:none!important}
body:has(.pk-back) #sx-open{display:none}
#sx-open{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:60;display:flex;align-items:center;gap:8px;min-height:46px;padding:6px 16px 6px 10px;border-radius:999px;border:1px solid rgba(21,32,51,.25);background:linear-gradient(90deg,#e8c15a,#fff8ec 70%);color:#152033;font:700 14px/1.1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:pointer}
#sx-open small{display:block;font-weight:500;font-size:11px;color:#334155}
#sx-open .hx{width:26px;height:30px;clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);background:#d39a1c;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px}
#sx-open.pulse{animation:sxpulse .7s ease}
@keyframes sxpulse{0%{transform:scale(1)}40%{transform:scale(1.08);box-shadow:0 0 0 6px rgba(232,193,90,.45)}100%{transform:scale(1)}}
#sx-open[hidden]{display:none}
#sx-veil{position:fixed;inset:0;z-index:70;background:rgba(4,8,18,.45);opacity:0;pointer-events:none;transition:opacity .25s}
#sx-veil.on{opacity:1;pointer-events:auto}
#sx-drawer{position:fixed;left:0;right:0;bottom:0;z-index:71;max-height:min(88dvh,760px);display:flex;flex-direction:column;transform:translateY(105%);transition:transform .3s cubic-bezier(.2,.8,.2,1);color:#152033;font:14px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#fff8ec;border-radius:18px 18px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.45);border-top:3px solid #d39a1c;max-width:1180px;margin:0 auto}
#sx-drawer.on{transform:none}
#sx-drawer::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.07;border-radius:inherit;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='48' viewBox='0 0 28 48'><path fill='none' stroke='%23152033' stroke-width='0.7' d='M14 0v8.5l-14 8v15l14 8 14-8v-15l-14-8zM0 16.5l14 8 14-8M0 31.5l14 8 14-8'/></svg>");background-size:28px 48px}
.sx-head{display:flex;align-items:center;gap:10px;padding:8px 12px 6px;border-bottom:1px solid rgba(21,32,51,.12);position:relative}
.sx-head h2{margin:0;font-size:16px;font-weight:300;letter-spacing:.12em;text-transform:uppercase}
.sx-head .tag{font:700 10px/1 system-ui;letter-spacing:.1em;text-transform:uppercase;background:#e05a32;color:#fff;padding:3px 6px;border-radius:4px}
.sx-head .who{color:#334155;font-size:13px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx-x{width:40px;height:40px;border-radius:50%;border:1px solid rgba(21,32,51,.2);background:#fff;font-size:22px;line-height:1;cursor:pointer;color:#152033}
.sx-scroll{overflow:auto;padding:8px 12px 14px;position:relative;-webkit-overflow-scrolling:touch}
.sx-opts{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin-bottom:6px;font-size:12.5px}
.sx-opts .lbl{font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:11px;color:#556678}
.sx-chips{display:inline-flex;border:1px solid rgba(21,32,51,.2);border-radius:999px;overflow:hidden;background:#fff}
.sx-chips button{border:0;background:transparent;padding:6px 10px;font:600 12.5px/1 system-ui;color:#334155;cursor:pointer;min-height:32px}
.sx-chips button.on{background:#152033;color:#fff8ec}
.sx-chk{display:inline-flex;gap:5px;align-items:center}
.sx-body{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:12px}
@media (max-width:720px){.sx-body{grid-template-columns:1fr}.sx-body>.sx-sim{order:-1}}
.sx-card{background:#fff;border:1px solid rgba(21,32,51,.14);border-radius:12px;padding:8px 10px;box-shadow:0 3px 10px rgba(21,32,51,.08)}
.sx-card h3{margin:0 0 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#556678}
table.sx-t{width:100%;border-collapse:collapse;font-size:12.5px}
.sx-t th{text-align:left;font-weight:600;color:#556678;padding:3px 6px 3px 0;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
.sx-t td{padding:4px 6px 4px 0;border-top:1px solid rgba(21,32,51,.08);vertical-align:top}
.sx-t td.n{font:700 15px/1.1 ui-monospace,monospace;text-align:center;white-space:nowrap}
.sx-t td.w b{display:block}.sx-t td.w small,.sx-t td.nt{color:#556678;font-size:11.5px}
.sx-t tr.missile td.w b{color:#9a3d1a}.sx-t tr.laser td.w b{color:#1e5a8a}
.sx-assume{margin:6px 0 0;font-size:11.5px;color:#556678}
.sx-fire{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px}
.sx-fire button,.sx-ctl button{min-height:38px;padding:4px 10px;border-radius:10px;border:1px solid rgba(21,32,51,.2);font:700 12.5px/1.1 system-ui;cursor:pointer;color:#fff}
.sx-fire button small{display:block;font-weight:500;font-size:10.5px;opacity:.9}
.sx-fire .laser{background:linear-gradient(#3a8fd0,#1e5a8a)}
.sx-fire .missile{background:linear-gradient(#ef7a4a,#c2451e)}
.sx-fire button:disabled{opacity:.4;cursor:default}
.sx-ctl{display:flex;gap:6px;margin:6px 0;flex-wrap:wrap;align-items:center}
.sx-ctl button{background:#fff;color:#152033}
.sx-ctl .rnd{font:700 12px/1 ui-monospace,monospace;color:#556678}
.sx-parts{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:4px}
.sx-part{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:8px;background:#f4efe4;font-size:12.5px;transition:background .3s}
.sx-part.dead{opacity:.45;text-decoration:line-through}
.sx-part.hit{animation:sxhit .9s ease}
@keyframes sxhit{0%{background:#ffb08a}100%{background:#f4efe4}}
.sx-part .ly{font:700 10px/1 ui-monospace,monospace;color:#fff;background:#556678;border-radius:4px;padding:2px 4px}
.sx-part .nm{flex:1;min-width:0}
.sx-pips{display:inline-flex;gap:2px}.sx-pips i{width:8px;height:9px;clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);background:#2f9e62}.sx-pips i.off{background:#d5ccbd}
.sx-status{margin:6px 0;padding:6px 10px;border-radius:10px;font-weight:700;font-size:13px;background:#e9f6ee;color:#1e7a4a}
.sx-status.bad{background:#fde3da;color:#c2451e}.sx-status.warn{background:#fff1cf;color:#9a6e0c}
.sx-log{margin:6px 0 0;padding:0;list-style:none;font-size:12px;max-height:150px;overflow:auto}
.sx-log li{padding:3px 0;border-top:1px solid rgba(21,32,51,.08)}
.sx-log li b{color:#152033}
.sx-log .r{font:700 10.5px/1 ui-monospace,monospace;color:#556678;margin-right:4px}
.sx-hp{position:sticky;top:-8px;z-index:3;margin:0 0 6px;box-shadow:0 4px 10px rgba(21,32,51,.2);padding:6px 10px;border-radius:10px;background:#152033;color:#fff8ec;font-size:13px}.sx-hp b{color:#e8c15a}.sx-hp .sh{color:#a7c7e0}
.nocore{font-size:12.5px;color:#556678;font-style:italic}
.sx-rand{font-size:11.5px;color:#556678;margin:4px 0 0}
@media (max-height:540px) and (orientation:landscape){#sx-drawer{max-height:94dvh}.sx-head{padding:4px 10px}.sx-x{width:34px;height:34px}.sx-scroll{padding:6px 10px 10px}.sx-fire button{min-height:34px}}
@media (prefers-reduced-motion:reduce){#sx-drawer,#sx-veil{transition:none}.sx-part.hit,#sx-open.pulse{animation:none}}
`;

// ---------- the floating button ----------
let btn, veil, drawer;
function segLabel() {
  const des = design(), sg = des && des.hull[S.si];
  const core = sg && (sg.bays || []).includes('core');
  return 'Ship ' + S.side.toUpperCase() + ' \u00b7 segment ' + (S.si + 1) + (core ? ' (core)' : '');
}
function syncButton() {
  if (!btn) return;
  btn.hidden = location.hash !== '#lab' || S.open;
  if (design()) S.si = Math.max(0, Math.min(LAB.sel[S.side] || 0, design().hull.length - 1));
  btn.querySelector('small').textContent = segLabel();
}

function build() {
  document.head.append(el('style', null, CSS));
  btn = el('button', { id: 'sx-open', type: 'button', onclick: openDrawer, 'aria-haspopup': 'dialog' },
    el('span', { class: 'hx', 'aria-hidden': 'true' }, '\u2726'), el('span', null, 'Strength check', el('small')));
  veil = el('div', { id: 'sx-veil', onclick: closeDrawer });
  drawer = el('section', { id: 'sx-drawer', role: 'dialog', 'aria-label': 'Strength check', 'aria-hidden': 'true' });
  document.body.append(btn, veil, drawer);
  // which segment was tapped: the Lab's own hull editor sets LAB.sel; note the side here
  document.addEventListener('click', (ev) => {
    const g = ev.target.closest && ev.target.closest('#lab .lab-hex.on');
    if (!g) return;
    const card = g.closest('.lab-ship'), name = card && card.querySelector('b');
    const side = name && /Ship B/.test(name.textContent) ? 'b' : 'a';
    setTimeout(() => {
      S.side = side; S.si = Math.max(0, Math.min(LAB.sel[side], LAB[side].hull.length - 1));
      syncButton();
      btn.classList.remove('pulse'); void btn.offsetWidth; btn.classList.add('pulse');
    }, 0);
  }, true);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && S.open) closeDrawer(); });
  window.addEventListener('hashchange', syncButton);
  syncButton();
}

async function openDrawer() {
  if (!design()) return;
  S.si = Math.max(0, Math.min(LAB.sel[S.side] || 0, design().hull.length - 1));
  try { await loadWorld(); } catch (e) { alert('Strength check: ' + e.message); return; }
  reset();
  S.open = true;
  drawer.classList.add('on'); veil.classList.add('on'); drawer.setAttribute('aria-hidden', 'false');
  syncButton();
  renderDrawer();
}
function closeDrawer() {
  S.open = false;
  drawer.classList.remove('on'); veil.classList.remove('on'); drawer.setAttribute('aria-hidden', 'true');
  syncButton();
}

// ---------- the drawer ----------
function chips(cur, list, pick) {
  return el('span', { class: 'sx-chips', role: 'group' }, list.map(([id, label]) => el('button', { type: 'button', class: id === cur ? 'on' : null, 'aria-pressed': id === cur ? 'true' : 'false', onclick: () => pick(id) }, label)));
}
const setOpt = (fn) => (v) => { fn(v); reset(); renderDrawer(); };
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');

// "Segment HP 5/5: Armour 2/2 · Engine 1/1 · ..." (a shield is listed apart: it comes back, so it isn't hull)
function hpLine(sim, si) {
  const rules = sim.rules, sg = sim.ship.segs[si];
  let now = 0, max = 0;
  const bits = [], shields = [];
  for (const p of sg.parts.slice().sort((a, b) => rules.parts[a.t].layer - rules.parts[b.t].layer)) {
    const c = rules.parts[p.t], hp = sg.wrecked ? 0 : Math.max(0, p.hp);
    if (c.recharges) { shields.push(pretty(p.t) + (hp > 0 ? ' up' : ' down') + ' (soaks ' + plural(c.hp, 'hit') + ')'); continue; }
    now += hp; max += c.hp;
    bits.push(pretty(p.t) + ' ' + hp + '/' + c.hp);
  }
  return { now, max, text: bits.join(' \u00b7 '), shields: shields.join(', ') };
}

// Why it ended, in words. st from segState; shot: the shot number it ended on.
function endText(st, shot) {
  const on = shot ? ' on shot ' + shot : '';
  if (st.shipLost && /core destroyed/.test(st.why)) return '\u2716 Ship lost' + on + ': its core was destroyed';
  if (st.shipLost) return '\u2716 Ship lost' + on + ': only engines and the core were left working (game rule)' + (st.wrecked ? '; this segment was wrecked too' : '');
  if (st.wrecked) return '\u2716 Segment out' + on + ': all its parts were gone, and the next hit found nothing left, so it was wrecked';
  return '';
}

function renderDrawer() {
  const des = design(), sim = S.sim, rules = sim.rules, ship = sim.ship, sg = ship.segs[S.si];
  const hasCore = segHasCore(rules, sg);
  const coreSeg = ship.segs.findIndex((g) => segHasCore(rules, g));
  const coreDef = STRENGTH_LAB.cores.find((c) => c.id === S.core);
  const head = el('div', { class: 'sx-head' },
    el('h2', null, 'Strength check'), el('span', { class: 'tag' }, 'Test values'),
    el('span', { class: 'who' }, (des.name || 'Ship') + ' \u00b7 ' + segLabel()),
    el('button', { type: 'button', class: 'sx-x', 'aria-label': 'Close', onclick: closeDrawer }, '\u00d7'));
  const hp = hpLine(sim, S.si);
  const hpBox = el('div', { class: 'sx-hp' },
    el('b', null, 'Segment ' + (S.si + 1) + ' HP ' + hp.now + '/' + hp.max), el('span', null, ': ' + (hp.text || 'no parts')),
    hp.shields ? el('span', { class: 'sh' }, ' \u00b7 ' + hp.shields + ', not counted in HP') : null);
  const optsRow = el('div', { class: 'sx-opts' },
    hasCore
      ? el('span', null, el('span', { class: 'lbl' }, 'Core (test) '), chips(S.core, STRENGTH_LAB.cores.map((c) => [c.id, c.label.replace(' core', '') + ' ' + c.hp + ' HP']), setOpt((v) => (S.core = v))))
      : el('span', { class: 'nocore' }, 'No core in this segment' + (coreSeg >= 0 ? ' (the ship\u2019s core is in segment ' + (coreSeg + 1) + ', ' + coreDef.label.toLowerCase() + ', ' + coreDef.hp + ' HP)' : '')),
    el('label', { class: 'sx-chk' }, el('input', { type: 'checkbox', checked: !S.coreOnly, onchange: (e) => setOpt((v) => (S.coreOnly = v))(!e.target.checked) }), 'Ship is lost when only engines and core are left (game rule)'));

  // table
  const t = strengthTable(S.world, des, S.si, opts());
  const table = el('table', { class: 'sx-t' },
    el('tr', null, el('th', null, 'Weapon'), el('th', null, hasCore ? 'Shots to strip all parts but the core' : 'Shots to strip all parts'), el('th', null, hasCore ? 'Shots until the core dies' : 'Shots until it\u2019s out'), el('th', null, 'How it ends / notes')),
    t.rows.map((r) => el('tr', { class: r.kind },
      el('td', { class: 'w' }, el('b', null, r.label), el('small', null, r.kind === 'laser' ? r.band + ', ' + plural(r.hits, 'hit') + ' a shot' : missileText(r.id))),
      el('td', { class: 'n' }, r.strip.text),
      el('td', { class: 'n' }, r.finish.text),
      el('td', { class: 'nt' }, [r.result, ...r.notes].filter(Boolean).join('; ')))));
  const explain = el('p', { class: 'sx-assume' },
    el('b', null, 'Strip: '), 'every part in the segment is at 0 HP' + (hasCore ? ', except the core. ' : '. '),
    el('b', null, hasCore ? 'Core dies: ' : 'Out: '), hasCore ? 'the core reaches 0 HP and the ship is lost. ' : 'the segment is wrecked: once its parts are gone, the next hit wrecks it (or the ship is lost first, see the notes). ',
    'Counts are shots fired at this segment in one round, the same shots as the buttons on the right; a missile shot down still counts. \u201c\u2014\u201d: the ship was lost before that point. A range (2\u20133) means it depends on which part takes the hit: within a layer the part is picked at random (24 tries each).');
  const assume = el('p', { class: 'sx-assume' },
    'Test values, not in battles: laser ' + [1, 5, 9].map((d) => laserHits(rules, d)).join(' / ') + ' hits near / mid / far; basic missile 3 hits, advanced 4 hits, nuke wrecks the segment outright like today\u2019s missile (a working shield takes the blow: shield down, 3 hits); point defence can shoot any missile down; cores basic 1, steel 3, carbon crystal 6 HP. Hits go to the lowest layer first (shield 1, armour 2, weapons and point defence 3, bays 4\u20135, core 6).');
  const left = el('section', { class: 'sx-card' }, el('h3', null, 'How many shots'), table, explain, assume);

  // simulator
  const st = segState(sim, S.si), over = st.wrecked || st.shipLost;
  const fireBtns = el('div', { class: 'sx-fire' },
    STRENGTH_LAB.lasers.map((l) => el('button', { type: 'button', class: 'laser', disabled: over, onclick: () => shoot({ ...l, kind: 'laser' }) }, l.label.replace('Laser, ', 'Laser '), el('small', null, plural(laserHits(rules, l.dist), 'hit')))),
    STRENGTH_LAB.missiles.map((m) => el('button', { type: 'button', class: 'missile', disabled: over, onclick: () => shoot({ ...m, kind: 'missile' }) }, m.label, el('small', null, m.wrecks ? 'wrecks segment' : m.hits + ' hits'))));
  const pdLeft = Math.max(0, t.pd - (ship.pd || 0));
  const ctl = el('div', { class: 'sx-ctl' },
    el('span', { class: 'rnd' }, 'Round ' + sim.game.round + ' \u00b7 ' + plural(S.shots, 'shot') + ' fired'),
    el('button', { type: 'button', disabled: st.shipLost, onclick: () => { nextRound(sim); S.log.unshift({ r: sim.game.round, txt: 'Next round: point defence reloads; a shield not hit last round comes back.' }); S.flash = new Set(); renderDrawer(); } }, 'Next round \u21bb'),
    el('button', { type: 'button', onclick: () => { reset(); renderDrawer(); } }, 'Reset'),
    el('span', { class: 'rnd' }, 'PD ' + (t.pd ? pdLeft + '/' + t.pd + ' left' : 'none') + ' \u00b7 whole ship hull ' + E_hull(sim) + '%'));
  const order = sg.parts.map((p, i) => ({ p, i, c: rules.parts[p.t] })).sort((a, b) => a.c.layer - b.c.layer);
  const parts = el('div', { class: 'sx-parts' }, order.map(({ p, i, c }) => el('div', { class: 'sx-part' + (p.hp <= 0 || sg.wrecked ? ' dead' : '') + (S.flash.has(i) ? ' hit' : '') },
    el('span', { class: 'ly', title: 'layer ' + c.layer }, 'L' + c.layer),
    el('span', { class: 'nm' }, pretty(p.t) + (c.recharges && p.hp <= 0 && !sg.wrecked ? ' (down)' : '')),
    el('span', { class: 'sx-pips' }, Array.from({ length: c.hp }, (_, k) => el('i', { class: k < Math.max(0, sg.wrecked ? 0 : p.hp) ? null : 'off' }))))));
  const ended = endText(st, S.endShot);
  const status = ended ? el('div', { class: 'sx-status bad' }, ended)
    : st.stripped && hasCore ? el('div', { class: 'sx-status warn' }, 'Stripped: only the core is left (' + sg.parts.filter((p) => rules.parts[p.t].required).map((p) => p.hp).join('') + ' HP); the next hit goes to the core')
    : st.stripped ? el('div', { class: 'sx-status warn' }, 'Stripped: every part is gone; the next hit wrecks the segment')
    : el('div', { class: 'sx-status' }, 'Holding: ' + hp.now + '/' + hp.max + ' HP left' + (S.shots ? ' after ' + plural(S.shots, 'shot') : ''));
  const log = el('ul', { class: 'sx-log', 'aria-live': 'polite' }, S.log.map((x) => el('li', null, el('span', { class: 'r' }, (x.n ? 'Shot ' + x.n + ' \u00b7 ' : '') + 'R' + x.r), x.head ? el('b', null, x.head + ': ') : null, x.txt)));
  const right = el('section', { class: 'sx-card sx-sim' }, el('h3', null, 'Fire at it: one press, one shot'), fireBtns, ctl, status, parts,
    el('p', { class: 'sx-rand' }, 'Each hit takes 1 HP from a working part in the lowest layer; when a layer has several parts, which one is hit is random. Missiles also splash 1 hit on touching segments of the same ship. Newest shot at the top.'), log);

  const old = drawer.querySelector('.sx-scroll'), keep = old ? old.scrollTop : 0;   // a shot must not jump the view
  const scroll = el('div', { class: 'sx-scroll' }, hpBox, optsRow, el('div', { class: 'sx-body' }, left, right));
  drawer.replaceChildren(head, scroll);
  scroll.scrollTop = keep;
}

function missileText(id) {
  const m = STRENGTH_LAB.missiles.find((x) => x.id === id);
  return m.wrecks ? 'wrecks the segment (today\u2019s missile); vs a shield: ' + m.hits + ' hits' : m.hits + ' hits';
}

function E_hull(sim) {
  let left = 0, full = 0;
  for (const g of sim.ship.segs) for (const p of g.parts) { const c = sim.rules.parts[p.t]; if (c.recharges) continue; full += c.hp; left += g.wrecked ? 0 : Math.max(0, p.hp); }
  return full ? Math.round((100 * left) / full) : 0;
}

// The engine's "lost" list, one entry per hit, as "hit 1 → armour (2→1)".
function hitText(lost, partsBefore) {
  const hp = { ...partsBefore };
  return lost.map((x, k) => {
    const m = /^(.*) (damaged|destroyed|down)$/.exec(x), n = 'hit ' + (k + 1) + ' \u2192 ';
    if (!m) return n + (x === 'segment wrecked' ? 'nothing left to hit: segment wrecked' : x);
    if (m[2] === 'down') return n + pretty(m[1]) + ' soaked it (shield down)';
    return n + pretty(m[1]) + (m[2] === 'destroyed' ? ' destroyed' : ' damaged');
  }).join(', ');
}

let lastShot = 0;
function shoot(w) {
  const now = Date.now();
  if (now - lastShot < 250) return;   // one press, one shot (no double taps)
  lastShot = now;
  const sim = S.sim, before = sim.ship.segs[S.si].parts.map((p) => p.hp);
  const { events } = fire(sim, S.si, w);
  S.shots++;
  const name = w.kind === 'laser' ? w.label.replace('Laser, ', 'Laser ') + ' (' + plural(laserHits(sim.rules, w.dist), 'hit') + ')' : w.label + (w.wrecks ? ' (wrecks the segment)' : ' (' + w.hits + ' hits)');
  const bits = [];
  for (const e of events) {
    if (e.t === 'stopped' && e.ship === sim.ship.id) bits.push('point defence shot it down, no damage');
    if (e.t === 'damage' && e.ship === sim.ship.id) {
      const what = hitText(e.lost) || 'nothing left to hit';
      bits.push(e.seg === S.si ? what : 'splash on segment ' + (e.seg + 1) + ': ' + what);
    }
  }
  const st = segState(sim, S.si);
  if ((st.wrecked || st.shipLost) && !S.endShot) { S.endShot = S.shots; bits.push('result: ' + st.why); }
  S.flash = new Set(sim.ship.segs[S.si].parts.map((p, i) => (p.hp < before[i] ? i : -1)).filter((i) => i >= 0));
  S.log.unshift({ n: S.shots, r: sim.game.round, head: name, txt: bits.join('; ') || 'no effect' });
  renderDrawer();
}

build();
// for tests
window.SHATKON_STRENGTH = { S, openDrawer, closeDrawer };
