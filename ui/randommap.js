// A random radius-10 battle map for the Lab's "Play these designs": the Skirmish map's zones and setup
// rules, on a bigger board, with terrain scattered from a seed and mirrored through the centre so both
// sides get the same board. The same seed always gives the same map.
import { seededRandom, hex } from '../engine/index.js';

export const RANDOM_RADIUS = 10;

export function randomMap(baseDoc, seed) {
  const doc = structuredClone(baseDoc || { map: {} });
  const m = doc.map || (doc.map = {});
  const R = RANDOM_RADIUS, rnd = seededRandom(seed | 0), depth = 3;
  m.name = 'Random ' + seed;
  m.board = { ...(m.board || {}), shape: 'hexagon', radius: R };
  m.zones = { player_1_home: { edge: 'south', depth }, player_2_home: { edge: 'north', depth }, no_mans_land: { everything_else: true } };
  const pick = (n) => Math.floor(rnd() * n);
  const placed = [];
  const terrain = [];
  // an optional nebula on the centre line
  if (rnd() < 0.6) { const at = [0, 0]; terrain.push({ type: 'nebula', at, radius: 1 }); placed.push({ at, r: 1 }); }
  // mirrored pairs: 3-4 asteroids and 1-2 nebulae, kept out of the home zones (|r| <= R - depth - 2) and off the edge
  const want = [...Array(3 + pick(2)).fill('asteroid'), ...Array(1 + pick(2)).fill('nebula')];
  for (const type of want) {
    const r0 = type === 'nebula' ? 1 + pick(2) : 1;
    for (let tries = 0; tries < 60; tries++) {
      const r = pick(2 * (R - depth - 2) + 1) - (R - depth - 2), q = pick(2 * R + 1) - R, at = [q, r];
      if (hex.dist(at, [0, 0]) > R - r0 - 1) continue;
      const mirror = [-q, -r];
      if (hex.dist(at, mirror) < 2 * r0 + 2) continue;
      if (placed.some((p) => hex.dist(p.at, at) < p.r + r0 + 2 || hex.dist(p.at, mirror) < p.r + r0 + 2)) continue;
      const one = type === 'nebula' ? { type, radius: r0 } : { type, size: r0 };
      terrain.push({ ...one, at }, { ...one, at: mirror });
      placed.push({ at, r: r0 }, { at: mirror, r: r0 });
      break;
    }
  }
  m.terrain = terrain;
  return doc;
}

export const newSeed = () => 1000 + Math.floor(Math.random() * 9000);
