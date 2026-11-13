// Shared helpers for the campaign tools: read YAML with the repo's own reader,
// apply world_overrides, and turn a chapter file into world + map + fleets objects
// that engine/rules.js buildRules() understands. Nothing here changes the engine.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from '../../engine/hex.js';

export const CAMPAIGN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT = path.resolve(CAMPAIGN, '..');
export const YAML = vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'lib/yaml.min.js'), 'utf8') + '\n;YAML');
export const readYaml = (abs) => YAML.parse(fs.readFileSync(abs, 'utf8'));
export const camp = (rel) => readYaml(path.join(CAMPAIGN, rel));
export const rule = (rel) => readYaml(path.join(ROOT, 'rules', rel));
export { H };

// "a.b.c" -> obj.a.b.c = value (creates missing objects). Returns false if the path is new.
export function setPath(obj, dotted, value) {
  const keys = dotted.split('.');
  let o = obj, existed = true;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof o[keys[i]] !== 'object' || o[keys[i]] === null) { o[keys[i]] = {}; existed = false; }
    o = o[keys[i]];
  }
  if (!(keys[keys.length - 1] in o)) existed = false;
  o[keys[keys.length - 1]] = value;
  return existed;
}
export function getPath(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
}

export function worldFor(ch) {
  const w = structuredClone(rule(ch.world || 'world_v0.4.yaml'));
  const notes = [];
  for (const [p, v] of Object.entries(ch.world_overrides || {})) if (!setPath(w, p, v)) notes.push(`world_overrides: "${p}" is not in the world file`);
  return { world: w, notes };
}

// Which ships.yaml hull a ship flies in a chapter, by the same rule as PR #2's chapter loader
// (engine/chapter.js hullFor): "<id>@<this chapter>", else the newest earlier "<id>@<chapter>"
// in campaign node order, else "<id>". (The loader also prefers a hull carried over from an
// earlier battle, i.e. a graft, over the newest earlier key; no chapter here relies on that.)
export function hullKeyFor(ships, id, chId, order) {
  if (ships[id + '@' + chId]) return id + '@' + chId;
  const here = order.indexOf(chId);
  let best = null, bestAt = -1;
  for (const k of Object.keys(ships)) {
    const [base, ch] = k.split('@');
    if (base !== id || !ch) continue;
    const at = order.indexOf(ch);
    if (at >= 0 && at <= here && at > bestAt) { best = k; bestAt = at; }
  }
  return best || (ships[id] ? id : null);
}

// Hull from ships.yaml -> the fleets-file ship entry (as the loader builds it). Documentation
// fields (from, joined, seams) are dropped: main's buildRules does not know them.
export function fleetShip(ships, id, hullKey, flagship) {
  const h = ships[hullKey];
  if (!h) throw new Error(`ships.yaml has no hull "${hullKey}" (for ${id})`);
  return {
    name: id, flagship: flagship ?? h.flagship === true,
    hull: h.hull.map((s) => ({ at: s.at, bays: s.bays || [], mounts: s.mounts || [] })),
    ...(h.load ? { load: h.load } : {}),
  };
}

// A chapter side (player / enemy) -> fleets-file side. Ships may be ids or { id, flagship }.
export function sideFleet(ships, side, chId, order, extraShips = []) {
  const list = [];
  for (const e of side.ships || []) {
    const id = typeof e === 'string' ? e : e.id;
    list.push(fleetShip(ships, id, hullKeyFor(ships, id, chId, order), typeof e === 'string' ? undefined : e.flagship));
  }
  for (const s of extraShips) list.push(s);
  return { ships: list, deployment: (side.deployment || []).map((d) => ({ ...d })) };
}

// Map cells helpers
export const allCells = (R) => H.disc([0, 0], R);
export const xOf = (c) => c[0] + c[1] / 2;

export function terrainSets(rulesObj) {
  const ast = new Set(), neb = new Set();
  for (const t of rulesObj.terrain) for (const c of t.cells) (t.type === 'asteroid' ? ast : neb).add(H.key(c));
  return { ast, neb };
}

// ASCII picture of a board. marks: Map key -> char (ships, mines, zones).
export function render(R, rulesObj, marks = new Map()) {
  const { ast, neb } = terrainSets(rulesObj);
  const lines = [];
  for (let r = -R; r <= R; r++) {
    let row = '';
    const cells = [];
    for (let q = -R; q <= R; q++) if (H.inHexagon([q, r], R)) cells.push(q);
    const col0 = 2 * cells[0] + r + 2 * R;
    row = ' '.repeat(col0);
    for (const q of cells) {
      const k = H.key([q, r]);
      row += (marks.get(k) || (ast.has(k) ? '#' : neb.has(k) ? '~' : '.')) + ' ';
    }
    lines.push(String(r).padStart(3) + ' ' + row.trimEnd());
  }
  return lines.join('\n');
}
