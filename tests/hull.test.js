// Ship art geometry: hulls stay strictly hexagonal when tapered, and every hull points at the enemy.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as hex from '../engine/hex.js';
import { SHAPES, bowFor } from '../ui/ships.js';
import { hullLoops } from '../ui/frigate.js';

const S = 10;
const xy = ([q, r]) => [S * Math.sqrt(3) * (q + r / 2), S * 1.5 * r];
function cluster(cells) {
  const P = cells.map(xy), idx = new Map(cells.map((c, i) => [hex.key(c), i]));
  const nb = cells.map((c, i) => {
    const r = [-1, -1, -1, -1, -1, -1];
    for (const dv of hex.DIRS) { const m = [c[0] + dv[0], c[1] + dv[1]], j = idx.get(hex.key(m)); if (j == null) continue; const q = xy(m), e = ((Math.round(Math.atan2(q[1] - P[i][1], q[0] - P[i][0]) / (Math.PI / 3)) % 6) + 6) % 6; r[e] = j; }
    return r;
  });
  return { P, nb };
}
const dedupe = (pts) => pts.filter((p, j) => { const q = pts[(j + 1) % pts.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6; });
const area = (pts) => Math.abs(pts.reduce((s, p, j) => { const q = pts[(j + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

test('tapered hulls keep only hex-edge directions and 120/240 degree corners', () => {
  for (const sh of SHAPES) {
    const { P, nb } = cluster(sh.cells);
    // an uneven taper, like the bow and flank taper the ships use
    const taper = (i, e) => ((i * 3 + e) % 4) * 0.08 * S;
    for (const loop of hullLoops(P, nb, S, 0.07 * S, 0, taper)) {
      const pts = dedupe(loop);
      pts.forEach((p, j) => {
        const q = pts[(j + 1) % pts.length], r = pts[(j + 2) % pts.length];
        const a = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI;
        const off = (((a - 30) % 60) + 60) % 60;
        assert.ok(Math.min(off, 60 - off) < 0.01, `${sh.id}: edge at ${a.toFixed(2)} degrees is not a hex edge`);
        const b = (Math.atan2(r[1] - q[1], r[0] - q[0]) * 180) / Math.PI, turn = Math.abs(((b - a + 540) % 360) - 180);
        assert.ok(Math.abs(turn - 60) < 0.01, `${sh.id}: corner turns ${turn.toFixed(2)} degrees`);
      });
    }
  }
});

test('the taper really slims the hull', () => {
  const { P, nb } = cluster(SHAPES.find((s) => s.id === 'wedge').cells);
  const plain = hullLoops(P, nb, S, 0.07 * S, 0)[0], slim = hullLoops(P, nb, S, 0.07 * S, 0, () => 0.2 * S)[0];
  assert.ok(area(dedupe(slim)) < area(dedupe(plain)) * 0.9);
});

test('every hull points (almost) straight at the enemy, diagonal-bow hulls included', () => {
  const dirs = [[0, -1], [1, 0], [0.6, 0.8], [-Math.sqrt(3) / 2, -0.5]];
  for (const sh of SHAPES) for (const f of dirs) {
    const { P } = cluster(sh.cells), { bow } = bowFor(P, S, f);
    const d = bow[0] * f[0] + bow[1] * f[1];
    assert.ok(d >= 0.96, `${sh.id} facing ${f} points ${bow.map((v) => v.toFixed(2))}`);
  }
});

test('symmetric hulls still fly along their mirror line', () => {
  const { P } = cluster([[0, 0]]);
  assert.equal(bowFor(P, S, [0, -1]).symmetric, true);
  const lance = cluster(SHAPES.find((s) => s.id === 'lance').cells);
  assert.equal(bowFor(lance.P, S, [0, -1]).symmetric, false);
});
