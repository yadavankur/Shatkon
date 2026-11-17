// Draws the SHATKON logo (the mark and the wordmark) for the launch splash, from the same geometry
// the Field Manual uses (docs/tools/src/geom.js), and writes it into lib/splash.js between the
// "ART" markers. Run:  node tools/make-splash.mjs        (rewrite lib/splash.js)
//                      node tools/make-splash.mjs --check (fail if lib/splash.js is out of date)
// The drawing code below is the manual's own initHeroMark() (docs/tools/src/app6.js), with the class
// names prefixed "sp-" so the splash styles never touch the manual.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKG = vm.runInNewContext(fs.readFileSync(path.join(root, 'docs/tools/src/geom.js'), 'utf8') + '\n;SKG');
const MR = 100;
const C = { ice: '#cfe8ff', cyan: '#7fd8f0', mint: '#2fe0b0', neon: '#5ff7ff' };
const grad = (id) => `<linearGradient id="${id}" x1="-80" y1="-100" x2="80" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.ice}"/><stop offset=".5" stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.mint}"/></linearGradient>`;
const glow = (id, sd) => `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${sd}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

export function art() {
  const g = SKG.build(0.4);
  const P = (pts, cls) => `<polygon class="${cls}" pathLength="1" points="${SKG.polyOf(pts, MR)}"/>`;
  const star = g.cells.rh.map((c) => c.pts);
  const outer = P(g.V, 'sp-l sp-outer');
  const stars = star.map((p) => P(p, 'sp-l sp-star')).join('');
  const hexes = g.cells.hexOuter.map((c) => P(c.pts, 'sp-l sp-hex')).join('');
  const all = SKG.pathOf(SKG.allLines(g, false), MR);
  const mark = `<defs>${grad('spG')}<filter id="spBlur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="7"/></filter>${glow('spGlow', 2.2)}<radialGradient id="spN"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${C.neon}"/><stop offset="1" stop-color="${C.neon}" stop-opacity="0"/></radialGradient></defs>`
    + `<path class="sp-glow" d="${all}" fill="none" stroke="${C.cyan}" stroke-width="9" filter="url(#spBlur)"/>`
    + `<g fill="none" stroke="url(#spG)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#spGlow)">${outer}<g class="sp-bloom">${stars}</g>${hexes}</g>`
    + `<g fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round">${star.map((p) => `<polygon class="sp-shim" pathLength="1" points="${SKG.polyOf(p, MR)}"/>`).join('')}</g>`
    + `<circle class="sp-node" r="11" fill="url(#spN)"/>`;
  const W = SKG.wordmark('SHATKON', { scale: 20 });
  const word = `<defs><linearGradient id="spW" x1="0" y1="0" x2="${W.width}" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.ice}"/><stop offset=".55" stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.mint}"/></linearGradient></defs>`
    + `<path class="sp-wl" pathLength="1" d="${W.d}" fill="none" stroke="url(#spW)" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"/>`
    + W.nodes.map((n) => `<circle class="sp-wn" cx="${n[0].toFixed(1)}" cy="${n[1].toFixed(1)}" r="3" fill="${C.neon}"/>`).join('');
  const wordViewBox = `-6 -28 ${(W.width + 12).toFixed(1)} 56`;
  return { mark, word, wordViewBox };
}

const BEGIN = '/* ART:BEGIN (written by tools/make-splash.mjs, do not edit by hand) */';
const END = '/* ART:END */';
export function block() {
  const a = art();
  return `${BEGIN}\nconst MARK = ${JSON.stringify(a.mark)};\nconst WORD = ${JSON.stringify(a.word)};\nconst WORD_VIEWBOX = ${JSON.stringify(a.wordViewBox)};\n${END}`;
}
export function applyTo(src) {
  const i = src.indexOf(BEGIN), j = src.indexOf(END);
  if (i < 0 || j < 0) throw new Error('lib/splash.js has no ART markers');
  return src.slice(0, i) + block() + src.slice(j + END.length);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = path.join(root, 'lib/splash.js'), cur = fs.readFileSync(file, 'utf8'), next = applyTo(cur);
  if (process.argv.includes('--check')) { if (cur !== next) { console.error('lib/splash.js is out of date: run node tools/make-splash.mjs'); process.exit(1); } console.log('lib/splash.js is up to date'); }
  else { fs.writeFileSync(file, next); console.log('lib/splash.js written'); }
}
