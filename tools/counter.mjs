// The trick that turns a losing fight. For each match-up, the row fleet is flown every way listed
// under `tactics:` in beta/rules/sim_fleets.yaml against an opponent that simply fights head-on.
// A match-up that is lost head-on but won with one tactic is the raw material for a campaign
// chapter: the computer cannot think of the trick, the player has to.
//
//   node tools/counter.mjs                                  every fleet against every other
//   node tools/counter.mjs --fleets stock --against guns3,snipers3
//   node tools/counter.mjs --games 10 --set munitions.missile.wrecks_segment=true
//
// Each cell: games won by the row fleet out of --games (default 10), flown that way.

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cell } from './scenarios.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const YAML = vm.runInThisContext(fs.readFileSync(path.join(root, 'beta/lib/yaml.min.js'), 'utf8') + '\n;YAML');
const lib = YAML.parse(fs.readFileSync(path.join(root, 'beta/rules/sim_fleets.yaml'), 'utf8'));
const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : d; };
const optAll = (name) => args.flatMap((x, i) => (x === '--' + name ? [args[i + 1]] : []));

const games = Number(opt('games', 10)), sets = optAll('set'), psets = optAll('pset');
const rows = opt('fleets') ? opt('fleets').split(',') : Object.keys(lib.fleets);
const cols = opt('against') ? opt('against').split(',') : Object.keys(lib.fleets);
const tactics = Object.entries(lib.tactics);
// tactics written out in the file become personalities for this run
const extra = tactics.filter(([, t]) => typeof t === 'object').map(([name, t]) => 'ai.personalities.t_' + name + '=' + JSON.stringify(t));
const pilot = ([name, t]) => (typeof t === 'string' ? t : 't_' + name);

console.log(`${games} games a cell: games won by the row fleet flown that way, against the other fleet fighting head-on` + (sets.length ? ' | rules: ' + sets.join(', ') : ''));
console.log('match-up'.padEnd(24) + tactics.map(([n]) => n.padStart(14)).join('') + '   best');
for (const a of rows) for (const b of cols) {
  if (a === b) continue;
  let line = (a + ' v ' + b).padEnd(24), best = null, base = null;
  for (const t of tactics) {
    const c = cell(lib, a, b, games, { sets: sets.concat(extra), psets, aiRows: pilot(t), aiCols: 'balanced' });
    line += String(c.w).padStart(14);
    if (t[0] === 'head_on') base = c.w;
    if (!best || c.w > best.w) best = { w: c.w, name: t[0] };
  }
  const turned = base <= games * 0.3 && best.w >= games * 0.6;
  console.log(line + '   ' + best.name + (turned ? '  <-- turns it' : ''));
}
