/* SHATKON geometry: the logo, traced from brand/src/logo_original.jpg and rebuilt exactly.
   Unit hexagon (circumradius 1, pointy-top). k = inner hexagon radius (0.4 in the logo).
   Everything is generated from k, so the flower designer can vary it. */
const SKG = (() => {
  const S3 = Math.sqrt(3) / 2;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, s) => [a[0] * s, a[1] * s];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const V = [0, 1, 2, 3, 4, 5].map((i) => { const a = (Math.PI / 180) * (-90 + 60 * i); return [Math.cos(a), Math.sin(a)]; });
  function build(k = 0.4) {
    const C = [0, 0];
    const I = V.map((v) => mul(v, k));                 // inner hexagon vertices (I0 top, clockwise)
    const P = I.map((p, m) => add(p, I[(m + 1) % 6])); // star points: I[m] + I[m+1]
    const Ep = {}, Em = {};                              // where each tip rhombus meets the outer edges
    for (const i of [0, 2, 4]) { Ep[i] = lerp(V[i], V[(i + 1) % 6], 1 - k); Em[i] = lerp(V[i], V[(i + 5) % 6], 1 - k); }
    // ---- lines (corrected, clean 120 degree symmetry) ----
    const outer = V.map((v, i) => [v, V[(i + 1) % 6]]);
    const tips = [0, 2, 4].flatMap((i) => [[I[i], Ep[i]], [I[i], Em[i]]]);
    const diam = [[I[0], I[3]], [I[1], I[4]], [I[2], I[5]]];
    const shorts = [1, 3, 5].flatMap((j) => [[P[j - 1], I[j]], [I[j], P[j]]]);
    // ---- the flaw in the original artwork: from the bottom inner node I3 both short lines run on to the outer edge ----
    const hit = (a, b, e0, e1) => { // intersection of ray a->b with segment e0-e1
      const d = sub(b, a), e = sub(e1, e0), den = d[0] * e[1] - d[1] * e[0];
      const t = ((e0[0] - a[0]) * e[1] - (e0[1] - a[1]) * e[0]) / den; return add(a, mul(d, t));
    };
    const flawR = hit(I[3], P[2], V[2], V[3]), flawL = hit(I[3], P[3], V[3], V[4]);
    const flawLines = [[P[2], flawR], [P[3], flawL]];
    const flawTris = [[P[2], flawR, Ep[2]], [P[3], flawL, Em[4]]];
    // ---- cells ----
    const tip = [0, 2, 4].map((i) => ({ id: 'T' + i, kind: 'tip', shape: 'rhombus', pts: [V[i], Ep[i], I[i], Em[i]] }));
    const rh = [0, 1, 2, 3, 4, 5].map((m) => ({ id: 'R' + m, kind: 'inner', shape: 'rhombus', pts: [C, I[m], P[m], I[(m + 1) % 6]] }));
    const hexOuter = [1, 3, 5].map((j) => ({ id: 'H' + j, kind: 'outer', shape: 'hexagon', pts: [Ep[j - 1], V[j], Em[(j + 1) % 6], P[j], I[j], P[j - 1]] }));
    // the designer's decomposition: three core hexagons meeting at the centre + three peripheral tips
    const core = [1, 3, 5].map((j) => ({ id: 'K' + j, kind: 'core', shape: 'hexagon', pts: [Ep[j - 1], V[j], Em[(j + 1) % 6], I[(j + 1) % 6], C, I[j - 1]], merges: ['H' + j, 'R' + (j - 1), 'R' + j] }));
    return { k, C, V, I, P, Ep, Em, lines: { outer, tips, diam, shorts }, flawLines, flawTris, cells: { tip, rh, hexOuter, core } };
  }
  const allLines = (g, flaw) => [...g.lines.outer, ...g.lines.tips, ...g.lines.diam, ...g.lines.shorts, ...(flaw ? g.flawLines : [])];
  const centroid = (pts) => { let x = 0, y = 0; pts.forEach((p) => { x += p[0]; y += p[1]; }); return [x / pts.length, y / pts.length]; };
  const f = (n) => (Math.round(n * 100) / 100).toString();
  const T = (p, s, o) => [o[0] + p[0] * s, o[1] + p[1] * s];
  const pathOf = (lines, s = 1, o = [0, 0]) => lines.map(([a, b]) => { const A = T(a, s, o), B = T(b, s, o); return `M${f(A[0])} ${f(A[1])}L${f(B[0])} ${f(B[1])}`; }).join('');
  const polyOf = (pts, s = 1, o = [0, 0]) => pts.map((p) => T(p, s, o).map(f).join(',')).join(' ');
  // core & periphery colours: core cells in teal/blue tones, peripherals in a lighter ice accent
  const CP = { K5: '#4a8cff', K1: '#19c3b3', K3: '#2f9fd8', T0: '#cfe8ff', T2: '#cfe8ff', T4: '#cfe8ff' };
  /* ---- the geometric wordmark: strokes at 0, 30, 60 and 90 degrees only; O is the hexagon ---- */
  const r3 = Math.sqrt(3);
  const GLYPH = {
    // each: width, list of polylines in a box y -1..1 starting x=0
    S: { w: r3, p: [[[r3, -0.5], [r3 / 2, -1], [0, -0.5], [r3, 0.5], [r3 / 2, 1], [0, 0.5]]] },
    H: { w: 1.4, p: [[[0, -1], [0, 1]], [[1.4, -1], [1.4, 1]], [[0, 0], [1.4, 0]]] },
    A: { w: r3, p: [[[0, 1], [0, -0.5], [r3 / 2, -1], [r3, -0.5], [r3, 1]], [[0, 0.15], [r3, 0.15]]] },
    T: { w: r3, p: [[[0, -1], [r3, -1]], [[r3 / 2, -1], [r3 / 2, 1]]] },
    K: { w: r3, p: [[[0, -1], [0, 1]], [[r3, -1], [0, 0], [r3, 1]]], node: [0, 0] },
    O: { w: 2 * 1.1 * S3, p: [V.map((v) => [v[0] * 1.1 + 1.1 * S3, v[1] * 1.1]).concat([[1.1 * S3, -1.1]])], node: [1.1 * S3, 0] },
    N: { w: 2 / r3, p: [[[0, 1], [0, -1], [2 / r3, 1], [2 / r3, -1]]] },
  };
  function wordmark(text = 'SHATKON', opts = {}) {
    const gap = opts.gap === undefined ? 1.05 : opts.gap, sc = opts.scale || 20;
    let x = 0; const parts = [], nodes = [];
    for (const ch of text) {
      const g = GLYPH[ch]; if (!g) { x += 1; continue; }
      g.p.forEach((pl) => parts.push('M' + pl.map((q) => f((x + q[0]) * sc) + ' ' + f(q[1] * sc)).join('L')));
      if (g.node) nodes.push([(x + g.node[0]) * sc, g.node[1] * sc]);
      x += g.w + gap;
    }
    return { d: parts.join(''), width: (x - gap) * sc, height: 2.2 * sc, nodes };
  }
  return { build, allLines, centroid, pathOf, polyOf, CP, wordmark, V, S3 };
})();
if (typeof module !== 'undefined') module.exports = SKG;
