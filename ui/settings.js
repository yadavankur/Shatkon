// Battle settings: asked before every skirmish starts (the landing page's board picker, the in-game
// "New game" and "Play again", and the Lab's "Play these designs"). Kept in localStorage, so the last
// choice is the default next time. Story chapters don't ask: their script decides.
//   turns  'fixed' (default): the same side moves first every round
//          'swap':            the first move swaps every round (two turns in a row for one side)
//   ff     'warn' (default):  before a laser shot that would hit your own mine, missile or drone,
//                             the board traces the beam and asks again
//          'free':            fire as aimed, no question
export const SETTINGS = [
  { key: 'turns', label: 'Turn order', options: [
    ['fixed', 'Fixed', 'The same side moves first every round.'],
    ['swap', 'Swap each round', 'The first move swaps every round, so one side sometimes gets two turns in a row.']] },
  { key: 'ff', label: 'Friendly fire', options: [
    ['warn', 'Warn me', 'If a laser shot would hit your own mine, missile or drone, the board traces the beam and asks again.'],
    ['free', 'Just fire', 'Shots go as aimed, no question. Your own mines and missiles in the way still take the hit.']] },
];
// Rapid mode (rules/rapid/rapid_opus.yaml, engine/rapid.js): its own sheet. A row with `range`
// is a slider; the others are buttons. The first option (or `def`) is the default.
export const RAPID_SETTINGS = [
  { key: 'timer', label: 'Time to act', def: '15', options: ['10', '15', '20', '30', '60'].map((v) => [v, v + ' s', 'Seconds to pick your action each tick. Run out and the game acts for you.']) },
  { key: 'openTimer', label: 'Opening clock', def: '10', options: ['5', '10', '15'].map((v) => [v, v + ' s', 'Seconds a tick until the first contact (either side sees the other) or the first shot. No waiting between ticks, and these ticks don\u2019t count towards the tick limit.']) },
  { key: 'openEnd', label: 'Opening ends', options: [['sighting', 'At first contact', 'The fast opening ends the first tick either side has any contact on the other. The clock slows and you get time to watch.'], ['shot', 'At first shot', 'The fast opening runs until the first laser shot or missile launch.']] },
  { key: 'stride', label: 'Opening moves', options: [['opening', '2 hexes in the opening', 'Ships move up to 2 hexes until the opening ends, then 1.'], ['always', '2 hexes always', 'Ships always move up to 2 hexes.'], ['off', '1 hex', 'Ships always move 1 hex.']] },
  { key: 'watch', label: 'Time to watch', range: [0, 10, 1], def: 3, why: (v) => v + ' s to see what both sides did before the controls wake up, once the shooting has started.' },
  { key: 'autofire', label: 'Auto-fire', options: [['best', 'Best target', 'Out of time with a laser or missile chosen: it fires at the best target (the flagship first, then the most damage).'], ['nearest', 'Nearest', 'Out of time with a laser or missile chosen: it fires at the nearest target.']] },
  { key: 'launch', label: 'Missiles', options: [['sighted', 'Sighted', 'A missile must lock onto an enemy ship your fleet can see.'], ['blind', 'Blind', 'Fire a missile at any hex, seen or not. A wasted missile is gone.']] },
  { key: 'line', label: 'The line', range: [6, 18, 1], def: 12, why: (v) => v + ' rows from your own edge (' + Math.round((100 * v) / 24) + '% of the way on this board). A ship on or past it frees your fleet.' },
  { key: 'unlock', label: 'Crossing frees you', options: [['holding', 'While you hold it', 'You may stop, turn back and pass only while one of your ships is on or past the line.'], ['permanent', 'For good', 'From the first crossing on, even if that ship dies or comes back.']] },
  { key: 'scan', label: 'Scans', options: [['past_line', 'Past the line', 'Only a ship on or past the line can scan.'], ['unlocked', 'Once free', 'Any ship can scan once your fleet is free.'], ['always', 'Always', 'Any ship, any time.']] },
  { key: 'shootRange', label: 'Shooting down missiles', def: '3', options: [['3', 'Within 3 hexes', 'A laser can only hit a missile or drone 3 hexes away or closer. Further off it is too small: the beam flies past.'], ['5', 'Within 5', 'A laser can only hit a missile or drone 5 hexes away or closer.'], ['0', 'Any range', 'A laser can hit a missile or drone anywhere in its reach.']] },
  { key: 'debris', label: 'Close-in debris', options: [['on', 'On', 'Shoot a missile down within 2 hexes and the blast lights you up: 1 hit to your ship, and the enemy sees it, parts and all, for 3 ticks.'], ['off', 'Off', 'Shooting a missile down costs nothing but the action.']] },
  { key: 'forwardEyes', label: 'Eyes past the line', def: '2', options: [['2', '+2 sensor', 'A ship past the line sees 2 hexes further.'], ['3', '+3 sensor', 'A ship past the line sees 3 hexes further.'], ['0', 'None', 'Crossing gives no extra sight.']] },
  { key: 'attackRun', label: 'Attack run', options: [['last_tick', 'Moved last tick', '+1 laser hit for a ship that moved on the tick before it fires.'], ['off', 'Off', 'No bonus for moving before firing.']] },
  { key: 'wingman', label: 'Formation', options: [['fire_or_move', 'Wingman fires', 'When a ship fires, one friend within 2 hexes of it (touching, or one empty hex between) fires too in the same tick, or moves 1 hex if it has nothing to shoot.'], ['move', 'Wingman moves', 'When a ship fires, one friend within 2 hexes of it may move 1 hex in the same tick.'], ['off', 'Off', 'One action a tick, nothing more.']] },
  { key: 'cap', label: 'Tick limit', def: '100', options: ['60', '100', '150'].map((v) => [v, v, 'After ' + v + ' ticks of shooting the game is a draw (the opening doesn\u2019t count).']) },
];
// Economy mode (Frontier, rules/rapid/rapid_frontier.yaml, engine/economy.js): shown under the rapid
// settings on boards with an economy, kept in their own store.
export const ECON_SETTINGS = [
  { key: 'economy', label: 'Economy', options: [['on', 'On', 'Ships earn salvage (\u25c8) by flying through new ground in the enemy\u2019s half (more by asteroids), crossing the line, holding it and destroying enemy ships. Spend it on a threat heatmap, turrets, upgrades and missiles.'], ['off', 'Off', 'Plain Rapid Opus on this board: no salvage.']] },
  { key: 'econCap', label: 'Income cap', def: '6', options: ['4', '6', '10'].map((v) => [v, v + ' a tick', 'A side earns at most ' + v + ' salvage a tick, so a lead can\u2019t snowball without limit.']) },
  { key: 'econHeatmap', label: 'Heatmap cost', def: '6', options: ['4', '6', '8'].map((v) => [v, '\u25c8 ' + v, 'The threat heatmap costs ' + v + ' salvage and your action for that tick. It shows where the enemy ships you can see could hit, for your next 2 ticks.']) },
  { key: 'econTurret', label: 'Turret cost', def: '8', options: ['6', '8', '10'].map((v) => [v, '\u25c8 ' + v, 'A ship leaves one of its lasers behind as a turret for ' + v + ' salvage and your tick. Each turret costs 1 a tick to keep working.']) },
  { key: 'econTurretRange', label: 'Turret range', def: '6', options: ['4', '6', '8'].map((v) => [v, v + ' hexes', 'A turret fires at the nearest enemy it can see within ' + v + ' hexes. Lasers reach 9, so a turret can be shot from out of its reach.']) },
  { key: 'econUpkeepEvery', label: 'Turret upkeep', def: '3', options: [['0', 'None', 'Turrets cost nothing to keep.'], ['3', '1 every 3 ticks', 'Each turret costs 1 salvage every 3 ticks. If you can\u2019t pay, it goes dark until you can.'], ['1', '1 a tick', 'Each turret costs 1 salvage every tick (expensive).']] },
  { key: 'econIdle', label: 'Idle penalty', def: '1', options: [['1', '\u22121 a pass', 'A tick you pass earns no salvage and costs 1. Sitting still shouldn\u2019t pay.'], ['0', 'None', 'Passing is free.']] },
  { key: 'econUpgrade', label: 'Upgrade cost', def: '10', options: ['8', '10', '12'].map((v) => [v, '\u25c8 ' + v, 'One upgrade per ship for ' + v + ' salvage and your tick: +1 laser range, faster shields, +1 sensor or +1 armour.']) },
  { key: 'econOwnHalf', label: 'Earn at home', options: [['no', 'No', 'New ground pays only in the enemy\u2019s half: no farming at home.'], ['yes', 'Yes', 'New ground pays in your own half too.']] },
];
const STORE = 'shatkon.battle', RSTORE = 'shatkon.rapid', ESTORE = 'shatkon.econ';
const defOf = (d) => (d.def !== undefined ? d.def : d.options[0][0]);
const okVal = (d, v) => (d.range ? Number.isFinite(Number(v)) && Number(v) >= d.range[0] && Number(v) <= d.range[1] : d.options.some((o) => o[0] === v));
function readSet(store, list) {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(store) || '{}') || {}; } catch (e) {}
  const out = {};
  for (const d of list) out[d.key] = okVal(d, s[d.key]) ? (d.range ? Number(s[d.key]) : s[d.key]) : defOf(d);
  return out;
}
function writeSet(store, list, k, v) {
  const s = readSet(store, list); s[k] = v;
  try { localStorage.setItem(store, JSON.stringify(s)); } catch (e) {}
}
export const battleSettings = () => readSet(STORE, SETTINGS);
export const setBattleSetting = (k, v) => writeSet(STORE, SETTINGS, k, v);
export const rapidSettings = () => readSet(RSTORE, RAPID_SETTINGS);
// The rapid settings as engine options (numbers where the engine wants numbers).
export function rapidOptions() {
  const r = rapidSettings();
  return { ...r, timer: Number(r.timer), openTimer: Number(r.openTimer), watch: Number(r.watch), line: Number(r.line), cap: Number(r.cap), shootRange: Number(r.shootRange), forwardEyes: Number(r.forwardEyes) };
}

export const econSettings = () => readSet(ESTORE, ECON_SETTINGS);
export function econOptions() {
  const r = econSettings();
  return { economy: r.economy, econCap: Number(r.econCap), econOwnHalf: r.econOwnHalf, econHeatmap: Number(r.econHeatmap), econTurret: Number(r.econTurret), econUpgrade: Number(r.econUpgrade), econTurretRange: Number(r.econTurretRange), econUpkeepEvery: Number(r.econUpkeepEvery), econIdle: Number(r.econIdle) };
}

// The form: one row of choices per setting, the chosen one's sentence under it. Plain DOM, so both the
// landing page and the play screen can use it.
// rapid: false (battle settings), true (rapid mode) or 'econ' (rapid mode with the economy rows first).
export function settingsForm(onChange, rapid = false) {
  const box = document.createElement('div');
  box.className = 'bs-form';
  const groups = rapid === 'econ' ? [[ECON_SETTINGS, ESTORE], [RAPID_SETTINGS, RSTORE]] : [[rapid ? RAPID_SETTINGS : SETTINGS, rapid ? RSTORE : STORE]];
  const draw = () => {
    box.textContent = '';
    for (const [list, store] of groups) drawGroup(list, store);
  };
  const drawGroup = (list, store) => {
    const cur = readSet(store, list);
    for (const d of list) {
      const row = document.createElement('div'); row.className = 'bs-row';
      const lab = document.createElement('div'); lab.className = 'bs-label'; lab.textContent = d.label;
      if (d.range) {   // a slider, with its value in the sentence under it
        const why = document.createElement('div'); why.className = 'bs-why'; why.textContent = d.why(cur[d.key]);
        const sl = document.createElement('input');
        Object.assign(sl, { type: 'range', min: d.range[0], max: d.range[1], step: d.range[2], value: cur[d.key] });
        sl.className = 'bs-range'; sl.setAttribute('aria-label', d.label);
        sl.addEventListener('input', () => { why.textContent = d.why(Number(sl.value)); });
        sl.addEventListener('change', () => { writeSet(store, list, d.key, Number(sl.value)); if (onChange) onChange(readSet(store, list)); });
        row.append(lab, sl, why); box.append(row); continue;
      }
      const seg = document.createElement('div'); seg.className = 'bs-seg'; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', d.label);
      for (const [v, name] of d.options) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = name; b.setAttribute('aria-pressed', String(cur[d.key] === v));
        if (v === defOf(d)) { b.classList.add('bs-def'); b.title = 'the default'; }   // a small dot marks the default
        b.addEventListener('click', () => { writeSet(store, list, d.key, v); draw(); if (onChange) onChange(readSet(store, list)); });
        seg.append(b);
      }
      if (cur[d.key] !== defOf(d)) { lab.classList.add('bs-changed'); lab.title = 'changed from the default'; }
      const why = document.createElement('div'); why.className = 'bs-why';
      why.textContent = (d.options.find((o) => o[0] === cur[d.key]) || d.options[0])[2];
      row.append(lab, seg, why);
      box.append(row);
    }
  };
  // every setting is remembered on this device until changed; this puts them all back
  const drawAll = draw;
  const reset = () => { for (const [list, store] of groups) { try { localStorage.removeItem(store); } catch (e) {} if (onChange) onChange(readSet(store, list)); } drawAll(); };
  const wrap = document.createElement('div');
  const foot = document.createElement('div'); foot.className = 'bs-foot';
  const note = document.createElement('span'); note.textContent = 'Kept on this device. \u2022 marks each default; a changed setting has a gold dot by its name.';
  const rb = document.createElement('button'); rb.type = 'button'; rb.className = 'btn bs-reset'; rb.textContent = 'Reset to defaults'; rb.addEventListener('click', reset);
  foot.append(note, rb);
  draw();
  wrap.append(box, foot);
  return wrap;
}

// The look, shared by both pages (injected once).
export const SETTINGS_CSS = `
.bs-form{display:flex;flex-direction:column;gap:14px}
.bs-row{display:grid;grid-template-columns:120px 1fr;grid-template-areas:"l s" ". w";gap:4px 12px;align-items:center}
.bs-label{grid-area:l;font-size:14px;color:#c6d0e4}
.bs-def::after{content:' \u2022';opacity:.7}.bs-changed::after{content:' \u25cf';color:#ffd77a;font-size:10px;vertical-align:middle}
.bs-foot{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;justify-content:space-between;margin-top:10px;font-size:12.5px;color:#a7b3cc}.bs-reset{min-height:36px}
.bs-seg{grid-area:s;display:inline-flex;justify-self:start;border:1px solid rgba(127,216,240,.3);border-radius:999px;overflow:hidden}
.bs-seg button{border:0;background:transparent;color:#a7b3cc;min-height:40px;padding:0 16px;font:inherit;font-size:13.5px;cursor:pointer}
.bs-seg button[aria-pressed="true"]{background:#7fd8f0;color:#04101c;font-weight:700}
.bs-range{grid-area:s;width:100%;max-width:260px;accent-color:#7fd8f0}
.bs-why{grid-area:w;font-size:12.5px;color:#8f9cba;line-height:1.35}
@media (max-width:520px){.bs-row{grid-template-columns:1fr;grid-template-areas:"l" "s" "w"}}
`;
export function injectSettingsCss() {
  if (document.getElementById('bs-css')) return;
  const st = document.createElement('style'); st.id = 'bs-css'; st.textContent = SETTINGS_CSS; document.head.append(st);
}
