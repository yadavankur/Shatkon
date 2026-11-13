// Shared test helpers: read the real rule files, or build a small custom battle.
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildRules, start } from '../engine/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const YAML = vm.runInThisContext(fs.readFileSync(path.join(root, 'lib/yaml.min.js'), 'utf8') + '\n;YAML');
export const readYaml = (rel) => YAML.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

export function shippedFiles() {
  const names = readYaml('rules/index.yaml').files;
  const docs = names.map((n) => readYaml('rules/' + n));
  return {
    world: docs.find((d) => d.bay_parts),
    map: docs.find((d) => d.map),
    fleets: docs.find((d) => d.budget !== undefined && !d.bay_parts),
  };
}

// A small battle on an empty board, using the real parts catalogue.
// ships: [{ name, at, flagship, hull: [{at, bays, mounts}], load }]
export function battle({ radius = 10, terrain = [], objective, p1, p2, extra1 = [], extra2 = [], world, seed = 7 }) {
  const w = structuredClone(world || shippedFiles().world);
  const side = (ships, extra) => ({
    ships: ships.map((s) => ({ name: s.name, flagship: !!s.flagship, hull: s.hull, load: s.load })),
    deployment: ships.map((s) => ({ ship: s.name, at: s.at })).concat(extra),
  });
  const built = buildRules(w, { map: { board: { shape: 'hexagon', radius }, terrain, objective } }, { budget: 99999, player_1: side(p1, extra1), player_2: side(p2, extra2) });
  return { ...built, game: start(built.rules, seed) };
}

// Handy hulls. Couplings are included so the ships are legal.
export const scout = (name, at, more = {}) => ({ name, at, flagship: true, hull: [{ at: [0, 0], bays: ['core', 'engine', 'sensor'], mounts: ['laser'] }], ...more });
export const pod = (name, at, bays, mounts = [], more = {}) => ({ name, at, flagship: true, hull: [{ at: [0, 0], bays, mounts }], ...more });
