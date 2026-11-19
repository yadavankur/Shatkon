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
const STORE = 'shatkon.battle';
export function battleSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) {}
  const out = {};
  for (const d of SETTINGS) out[d.key] = d.options.some((o) => o[0] === s[d.key]) ? s[d.key] : d.options[0][0];
  return out;
}
export function setBattleSetting(k, v) {
  const s = battleSettings(); s[k] = v;
  try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {}
}

// The form: one row of choices per setting, the chosen one's sentence under it. Plain DOM, so both the
// landing page and the play screen can use it.
export function settingsForm(onChange) {
  const box = document.createElement('div');
  box.className = 'bs-form';
  const draw = () => {
    box.textContent = '';
    const cur = battleSettings();
    for (const d of SETTINGS) {
      const row = document.createElement('div'); row.className = 'bs-row';
      const lab = document.createElement('div'); lab.className = 'bs-label'; lab.textContent = d.label;
      const seg = document.createElement('div'); seg.className = 'bs-seg'; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', d.label);
      for (const [v, name] of d.options) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = name; b.setAttribute('aria-pressed', String(cur[d.key] === v));
        b.addEventListener('click', () => { setBattleSetting(d.key, v); draw(); if (onChange) onChange(battleSettings()); });
        seg.append(b);
      }
      const why = document.createElement('div'); why.className = 'bs-why';
      why.textContent = (d.options.find((o) => o[0] === cur[d.key]) || d.options[0])[2];
      row.append(lab, seg, why);
      box.append(row);
    }
  };
  draw();
  return box;
}

// The look, shared by both pages (injected once).
export const SETTINGS_CSS = `
.bs-form{display:flex;flex-direction:column;gap:14px}
.bs-row{display:grid;grid-template-columns:120px 1fr;grid-template-areas:"l s" ". w";gap:4px 12px;align-items:center}
.bs-label{grid-area:l;font-size:14px;color:#c6d0e4}
.bs-seg{grid-area:s;display:inline-flex;justify-self:start;border:1px solid rgba(127,216,240,.3);border-radius:999px;overflow:hidden}
.bs-seg button{border:0;background:transparent;color:#a7b3cc;min-height:40px;padding:0 16px;font:inherit;font-size:13.5px;cursor:pointer}
.bs-seg button[aria-pressed="true"]{background:#7fd8f0;color:#04101c;font-weight:700}
.bs-why{grid-area:w;font-size:12.5px;color:#8f9cba;line-height:1.35}
@media (max-width:520px){.bs-row{grid-template-columns:1fr;grid-template-areas:"l" "s" "w"}}
`;
export function injectSettingsCss() {
  if (document.getElementById('bs-css')) return;
  const st = document.createElement('style'); st.id = 'bs-css'; st.textContent = SETTINGS_CSS; document.head.append(st);
}
