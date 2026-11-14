// Generates the brand/ SVGs from geom.js. Run: node brand.js
const fs = require('fs'); const path = require('path'); const G = require('./geom.js');
const OUT = path.join(__dirname, '../../brand'); fs.mkdirSync(OUT, { recursive: true });
const PAL = { bg: '#040812', bg2: '#08111f', ice: '#cfe8ff', cyan: '#7fd8f0', mint: '#2fe0b0', blue: '#4a8cff', teal: '#19c3b3', neon: '#5ff7ff', purple: '#9b6bff', pink: '#ff5fc8', amber: '#d9a441', text: '#dcecff', muted: '#7f93ad' };
const R = 100, O = [0, 0];
const defs = (id = 'g') => `<defs>
  <linearGradient id="${id}s" x1="-80" y1="-100" x2="80" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${PAL.ice}"/><stop offset=".5" stop-color="${PAL.cyan}"/><stop offset="1" stop-color="${PAL.mint}"/></linearGradient>
  <radialGradient id="${id}n"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${PAL.neon}"/><stop offset="1" stop-color="${PAL.neon}" stop-opacity="0"/></radialGradient>
  <filter id="${id}glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;
function mark(flaw, id = 'g', extra = '') {
  const g = G.build(0.4);
  const d = G.pathOf(G.allLines(g, flaw), R, O);
  const nodes = flaw ? [[g.C, 9], [g.I[3], 6]] : [[g.C, 9]];
  return `${defs(id)}
${extra}<path d="${d}" fill="none" stroke="url(#${id}s)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#${id}glow)"/>
${nodes.map(([p, r]) => `<circle cx="${p[0] * R}" cy="${p[1] * R}" r="${r}" fill="url(#${id}n)"/>`).join('')}`;
}
const svg = (vb, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><title>${title}</title>\n${body}\n</svg>\n`;
const VB = '-115 -115 230 230';
// 1. faithful trace (flaw included)
fs.writeFileSync(`${OUT}/logo_original_trace.svg`, svg(VB, `<!-- Traced from brand/src/logo_original.jpg. Faithful, including the flaw: the two lines from the bottom inner node run on to the outer edge and cut two small triangles. The original's slight vertical stretch is normalised to a regular hexagon. -->\n` + mark(true, 't'), 'SHATKON mark: faithful trace of the original logo (flaw included)'));
// 2. corrected
fs.writeFileSync(`${OUT}/logo.svg`, svg(VB, `<!-- Corrected from the original logo: those two lines stop at the star points, giving clean 120 degree rotational symmetry. 21 lines, 12 cells. -->\n` + mark(false, 'c'), 'SHATKON mark (corrected from the original logo)'));
// 2b. mono
{ const g = G.build(0.4); fs.writeFileSync(`${OUT}/logo-mono.svg`, svg(VB, `<path d="${G.pathOf(G.allLines(g, false), R, O)}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle r="6" fill="currentColor"/>`, 'SHATKON mark, one colour')); }
// 3. core & periphery: the designer's reading of the logo, as crisp cells
{
  const g = G.build(0.4);
  const cells = [...g.cells.core, ...g.cells.tip];
  const fills = cells.map((c) => `<polygon points="${G.polyOf(c.pts, R, O)}" fill="${G.CP[c.id]}" fill-opacity="${c.kind === 'core' ? .34 : .22}" stroke="none"/>`).join('\n');
  const labels = cells.map((c) => { const p = G.centroid(c.pts); return `<text x="${(p[0] * R).toFixed(1)}" y="${(p[1] * R + 3).toFixed(1)}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="8.5" fill="${PAL.text}" text-anchor="middle">${c.kind === 'core' ? 'core' : 'periphery'}</text>`; }).join('\n');
  fs.writeFileSync(`${OUT}/logo-core-periphery.svg`, svg('-115 -125 230 250', `<!-- Core & periphery: the designer's reading of the logo. Three core hexagons meet at the centre (they host the bays); three tip rhombi form the periphery (they host the mounts). -->\n<rect x="-115" y="-125" width="230" height="250" fill="${PAL.bg}"/>\n${fills}\n${mark(false, 'o')}\n${labels}\n<text x="0" y="118" font-family="ui-sans-serif,system-ui,sans-serif" font-size="8" fill="${PAL.muted}" text-anchor="middle" letter-spacing="1.5">CORE &amp; PERIPHERY</text>`, 'SHATKON mark: core and periphery'));
}
// 4. wordmark + lockup
const W = G.wordmark('SHATKON', { scale: 20 });
const wmBody = (id) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="${W.width}" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${PAL.ice}"/><stop offset=".55" stop-color="${PAL.cyan}"/><stop offset="1" stop-color="${PAL.mint}"/></linearGradient></defs>
<path d="${W.d}" fill="none" stroke="url(#${id})" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter"/>
${W.nodes.map((n) => `<circle cx="${n[0].toFixed(1)}" cy="${n[1].toFixed(1)}" r="3.2" fill="${PAL.neon}"/>`).join('')}`;
fs.writeFileSync(`${OUT}/wordmark.svg`, svg(`-6 -28 ${(W.width + 12).toFixed(1)} 56`, `<!-- Geometric wordmark: strokes at 0, 30, 60 and 90 degrees only (square, hexagon and rhombus angles). The O is the hexagon. -->\n` + wmBody('w'), 'SHATKON wordmark'));
fs.writeFileSync(`${OUT}/lockup.svg`, svg(`-150 -125 300 330`, `${mark(false, 'l')}\n<g transform="translate(${(-W.width * 0.55 / 2).toFixed(1)} 160) scale(.55)">${wmBody('lw')}</g>`, 'SHATKON lockup'));
// 4b. star (the flower) and the 3D hexagon cell
{ const g = G.build(0.4);
  const star = g.cells.rh.map((c) => `<polygon points="${G.polyOf(c.pts, R, O)}" fill="${PAL.mint}" fill-opacity=".1"/>`).join('') + `<path d="${g.cells.rh.map((c) => 'M' + G.polyOf(c.pts, R, O).split(' ').join('L') + 'Z').join('')}" fill="none" stroke="url(#ss)" stroke-width="3.2" stroke-linejoin="round" filter="url(#sglow)"/><circle r="7" fill="url(#sn)"/>`;
  fs.writeFileSync(`${OUT}/star.svg`, svg('-75 -75 150 150', `<!-- The flower: the six-rhombus star at the heart of the logo, the six petals meeting at the centre node. -->\n${defs('s')}${star}`, 'SHATKON star (the flower)'));
  const H = g.cells.hexOuter[0], j = 1;
  const hex3d = `<path d="${G.pathOf(G.allLines(g, false), R, O)}" fill="none" stroke="url(#hs)" stroke-width="2.6" stroke-linecap="round" opacity=".35"/><polygon points="${G.polyOf(H.pts, R, O)}" fill="${PAL.ice}" fill-opacity=".45"/><polygon points="${G.polyOf(g.cells.rh[0].pts, R, O)}" fill="${PAL.cyan}" fill-opacity=".28"/><polygon points="${G.polyOf(g.cells.rh[1].pts, R, O)}" fill="${PAL.cyan}" fill-opacity=".1"/><polygon points="${G.polyOf(g.cells.core[0].pts, R, O)}" fill="none" stroke="${PAL.neon}" stroke-width="3" stroke-linejoin="round" filter="url(#hglow)"/><polygon points="${G.polyOf(H.pts, R, O)}" fill="none" stroke="${PAL.neon}" stroke-width="2" stroke-linejoin="round"/>`;
  fs.writeFileSync(`${OUT}/hex3d.svg`, svg(VB, `<!-- The "3D hexagon": the irregular hexagon (light face) plus its two petals (mid and dark faces) read as a cube. It repeats every 120 degrees. -->\n${defs('h')}${hex3d}`, 'SHATKON 3D hexagon cell'));
}
// 5. favicon
{ const g = G.build(0.4); fs.writeFileSync(`${OUT}/favicon-mark.svg`, svg(VB, `<rect x="-115" y="-115" width="230" height="230" rx="40" fill="${PAL.bg}"/><path d="${G.pathOf(G.allLines(g, false), R * .95, O)}" fill="none" stroke="${PAL.cyan}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><circle r="13" fill="${PAL.neon}"/>`, 'SHATKON favicon (full mark)'));
  fs.writeFileSync(`${OUT}/favicon.svg`, svg('-80 -80 160 160', `<rect x="-80" y="-80" width="160" height="160" rx="30" fill="${PAL.bg}"/><path d="${g.cells.rh.map((c) => 'M' + G.polyOf(c.pts, R * 1.6, O).split(' ').join('L') + 'Z').join('')}" fill="${PAL.mint}" fill-opacity=".18" stroke="${PAL.cyan}" stroke-width="9" stroke-linejoin="round"/><circle r="11" fill="${PAL.neon}"/>`, 'SHATKON favicon (the star)')); }
// 6. motif sheet (variations)
{
  const variants = [
    ['lines', (g) => ''], ['star (isolated)', 'staronly'], ['3D hexagon', 'hex3d'], ['cube', 'cube'], ['core', 'core'], ['flower', 'star'], ['tips', 'tips'], ['recursion', 'rec'], ['enemy', 'enemy'], ['k = 0.25', 0.25], ['k = 0.55', 0.55]];
  let body = `<rect x="0" y="0" width="800" height="300" fill="${PAL.bg}"/>${defs('m')}`;
  variants.forEach(([name, v], i) => {
    const cx = 50 + i * 70, cy = 120, s = 34; const k = typeof v === 'number' ? v : 0.4; const g = G.build(k);
    let fill = '';
    if (v === 'cube') { const sh = { T0: .55, T2: .55, T4: .55, R5: .28, R0: .12, R1: .28, R2: .12, R3: .28, R4: .12 }; [...g.cells.tip, ...g.cells.rh].forEach((c) => { fill += `<polygon points="${G.polyOf(c.pts, s, [cx, cy])}" fill="${PAL.cyan}" fill-opacity="${sh[c.id]}"/>`; }); }
    if (v === 'core') g.cells.core.forEach((c, j) => { fill += `<polygon points="${G.polyOf(c.pts, s, [cx, cy])}" fill="${[PAL.blue, PAL.teal, PAL.cyan][j]}" fill-opacity=".35"/>`; });
    if (v === 'star') g.cells.rh.forEach((c) => { fill += `<polygon points="${G.polyOf(c.pts, s, [cx, cy])}" fill="${PAL.mint}" fill-opacity=".4"/>`; });
    if (v === 'tips') g.cells.tip.forEach((c) => { fill += `<polygon points="${G.polyOf(c.pts, s, [cx, cy])}" fill="${PAL.ice}" fill-opacity=".35"/>`; });
    const col = v === 'enemy' ? PAL.pink : PAL.cyan;
    if (v === 'hex3d') { fill += `<polygon points="${G.polyOf(g.cells.hexOuter[0].pts, s, [cx, cy])}" fill="${PAL.neon}" fill-opacity=".35" stroke="${PAL.neon}" stroke-width="1.6"/>`; }
    let lines = G.allLines(g, false); if (v === 'staronly') { lines = g.cells.rh.flatMap((c) => c.pts.map((p, q) => [p, c.pts[(q + 1) % 4]])); fill += g.cells.rh.map((c) => `<polygon points="${G.polyOf(c.pts, s, [cx, cy])}" fill="${PAL.mint}" fill-opacity=".15"/>`).join(''); } if (v === 'rec') { lines = lines.filter((l) => !g.lines.diam.includes(l)); const g2 = G.build(0.4); lines = lines.concat(G.allLines(g2, false).map((l) => l.map((p) => [p[0] * .4, p[1] * .4]))); }
    body += `${fill}<path d="${G.pathOf(lines, s, [cx, cy])}" fill="none" stroke="${col}" stroke-width="1.4" stroke-linejoin="round"/><text x="${cx}" y="${cy + 56}" font-family="ui-sans-serif,system-ui" font-size="10" fill="${PAL.muted}" text-anchor="middle">${name}</text>`;
  });
  body += `<text x="20" y="34" font-family="ui-sans-serif,system-ui" font-size="13" fill="${PAL.text}" letter-spacing="2">SHATKON MOTIF VARIATIONS</text>`;
  const sw = Object.entries(PAL); sw.forEach(([n, c], i) => { body += `<rect x="${20 + i * 57}" y="220" width="46" height="30" rx="5" fill="${c}" stroke="#1d2b40"/><text x="${43 + i * 57}" y="266" font-family="ui-monospace,monospace" font-size="8" fill="${PAL.muted}" text-anchor="middle">${n}</text><text x="${43 + i * 57}" y="278" font-family="ui-monospace,monospace" font-size="7" fill="${PAL.muted}" text-anchor="middle">${c}</text>`; });
  fs.writeFileSync(`${OUT}/motifs.svg`, svg('0 0 800 300', body, 'SHATKON motif variations and palette'));
}
fs.writeFileSync(`${OUT}/palette.json`, JSON.stringify({ ...PAL, notes: 'Base near-black navy; teal/blue primary; neon only as hints; enemy purple/pink; muted amber for warnings only.' }, null, 2));
console.log('brand written', fs.readdirSync(OUT));
