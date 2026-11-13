// Static verification for the story/ deliverable. Run: node tools/verify.mjs
import fs from 'node:fs'; import path from 'node:path';
const HERE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ROOT = path.basename(HERE) === 'story' ? HERE : path.join(HERE, 'story'); // works from tools/ or story/tools/
let errors = 0, warns = 0; const err = (m) => { errors++; console.log('  ✗ ' + m); }; const warn = (m) => { warns++; console.log('  ! ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

function webpInfo(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') { const f = b[20]; return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3), alpha: !!(f & 0x10), size: b.length }; }
  if (chunk === 'VP8L') { const v = b.readUInt32LE(21); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1, alpha: !!((v >> 28) & 1), size: b.length }; }
  if (chunk === 'VP8 ') { return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff, alpha: false, size: b.length }; }
  return null;
}
function checkImg(rel, { w, h, maxKB, alpha, wOnly }) {
  const f = path.join(ROOT, rel);
  if (!fs.existsSync(f)) return err(`missing image ${rel}`);
  const i = webpInfo(f); if (!i) return err(`not a WebP: ${rel}`);
  if (wOnly ? i.w !== w : (i.w !== w || i.h !== h)) err(`${rel} is ${i.w}x${i.h}, want ${wOnly ? w + ' wide' : w + 'x' + h}`);
  if (maxKB && i.size >= maxKB * 1000) err(`${rel} is ${(i.size / 1000).toFixed(1)} KB (limit ${maxKB} KB)`);
  if (alpha && !i.alpha) err(`${rel} has no alpha channel`);
  return i;
}

const REQ_SCENES = 'ch1_intro ch1_contact ch1_finch_down ch1_hurl ch1_victory ch1_salvage ch1_defeat ch2_intro ch2_contact ch2_first_mine ch2_victory ch2_salvage ch2_defeat ch3_intro ch3_split ch3_despair ch3_li_arrives ch3_victory ch3_reunion ch3_defeat ch4_fork ch4a_intro ch4a_graft_found ch4a_outro ch4a_defeat ch5_intro ch5_bloom ch5_seam_wakes ch5_li_moves ch5_cliff'.split(' ');
const REQ_BARKS = 'b1_scouts_ahead b1_contact_glyphs b1_finch_hit b1_seed_shield b1_seed_closing b2_mines_set b2_choke b2_mine_boom b2_second_seed b3_cover b3_pd_stopped b3_hull_low b3_flank_open b4_too_easy b4_graft_hint b4_seam_hums b5_jammed b5_kestrel_unresponsive b5_li_coming b1_weapons_gone b1_hurl_wren b1_hurl_kite b2_dead_in_water'.split(' ');
const REQ_CHARS = 'captain_a captain_b li engineer sparrow_pilot finch_pilot wren_pilot kite_pilot tern_pilot meridian mimic'.split(' ');
const EXPR = 'neutral determined worried smile shock hurt'.split(' ');
const REQ_STAGES = 'kestrel_bridge kestrel_engine_bay halcyon_bridge comms_screen salvage_wreck meridian_dark ashfall_outpost weave_lattice vista_corridor vista_quiet_water vista_bloom campaign_map'.split(' ');
const REQ_SHIPS = 'kestrel kestrel_refit kestrel_grafted sparrow finch halcyon tern seed twin twin_a twin_b husk husk_1 husk_2 husk_3 seed_a seed_b bloom wren kite'.split(' ');
const EFFECTS = new Set(['shake', 'flash', 'glitch', 'fade_out']);
const MID = new Set(['ch1_contact', 'ch1_finch_down', 'ch1_hurl', 'ch2_contact', 'ch2_first_mine', 'ch3_split', 'ch3_despair', 'ch3_li_arrives', 'ch5_bloom', 'ch5_seam_wakes', 'ch5_li_moves']);

console.log('characters.json'); const chars = J('characters.json');
for (const c of REQ_CHARS) { if (!chars[c]) { err(`missing character ${c}`); continue; } for (const e of EXPR) { const p = chars[c].portraits[e]; if (!p) err(`${c} lacks ${e}`); else checkImg(p, { w: 768, h: 1024, maxKB: 150, alpha: true }); } }
if (!chars.weave) err('missing weave'); else for (const e of ['calm', 'pulse', 'hostile']) { const p = chars.weave.portraits[e]; if (!p) err(`weave lacks ${e}`); else checkImg(p, { w: 768, h: 1024, maxKB: 150, alpha: true }); }
const nP = Object.values(chars).reduce((n, c) => n + Object.keys(c.portraits).length, 0); ok(`${Object.keys(chars).length} characters, ${nP} portraits checked`);

console.log('stages.json'); const stages = J('stages.json');
for (const s of REQ_STAGES) { if (!stages[s]) err(`missing stage ${s}`); }
for (const [id, s] of Object.entries(stages)) { checkImg(s.img, { w: 1920, h: 1080, maxKB: 350 }); if (!Array.isArray(s.focus) || s.focus.length !== 2 || s.focus.some((v) => v < 0 || v > 1)) err(`${id} bad focus`); }
const spots = stages.campaign_map?.spots || {}; for (const [k, v] of Object.entries({ ch1: [0.5, 0.9], ch2: [0.5, 0.72], ch3: [0.5, 0.55], ch4a: [0.3, 0.38], ch4b: [0.72, 0.38], ch5: [0.5, 0.2] })) if (JSON.stringify(spots[k]) !== JSON.stringify(v)) err(`campaign_map spot ${k} mismatch`);
ok(`${Object.keys(stages).length} stages checked`);

console.log('ships.json'); const ships = J('ships.json');
for (const s of REQ_SHIPS) if (!ships[s]) err(`missing ship ${s}`);
for (const [id, s] of Object.entries(ships)) checkImg(s.img, { w: 1024, wOnly: true, alpha: true });
const seg = (id) => JSON.stringify(ships[id]?.segments);
if (seg('kestrel') !== '[[-1,0],[0,0],[1,0]]') err('kestrel segments');
if (seg('kestrel_refit') !== '[[-1,0],[0,0],[1,0],[0,-1]]') err('kestrel_refit segments');
if (ships.kestrel_grafted?.segments.length !== 6) err('kestrel_grafted must have 6');
if (seg('halcyon') !== '[[0,0],[1,0],[0,1]]') err('halcyon segments');
if (seg('tern') !== '[[0,0],[1,0]]') err('tern segments');
for (const e of ['finch', 'wren', 'kite']) { const n = ships[e]?.segments.length; if (!(n >= 1 && n <= 2) || ships[e]?.side !== 'player') err(`${e} must be a 1-2 hex player escort`); }
if (ships.seed?.segments.length !== 2) err('seed 2'); if (ships.twin?.segments.length !== 6) err('twin 6');
if (ships.twin_a?.segments.length !== 3 || ships.twin_b?.segments.length !== 3) err('twin halves 3');
if (ships.bloom?.segments.length !== 7) err('bloom 7');
// campaign-v1 alignment
if (seg('husk_2') !== '[[0,0],[1,0]]') err('husk_2 must be [0,0],[1,0] (campaign-v1)');
if (seg('husk_3') !== '[[0,0]]') err('husk_3 must be [0,0] (campaign-v1)');
for (const a of ['seed_a', 'seed_b']) if (seg(a) !== seg('seed') || ships[a]?.img !== ships.seed?.img) err(`${a} must alias seed`);
if (seg('twin_a') !== '[[0,0],[1,0],[0,1]]' || seg('twin_b') !== '[[1,-1],[2,-1],[2,-2]]') err('twin halves frame');
// hex adjacency sanity: every ship is one connected piece (pointy-top axial neighbours)
const N6 = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
for (const [id, s] of Object.entries(ships)) { const set = new Set(s.segments.map((c) => c.join())); const seen = new Set([s.segments[0].join()]); const st = [s.segments[0]]; while (st.length) { const [q, r] = st.pop(); for (const [dq, dr] of N6) { const k = [q + dq, r + dr].join(); if (set.has(k) && !seen.has(k)) { seen.add(k); st.push([q + dq, r + dr]); } } } if (seen.size !== set.size) err(`${id} segments not connected`); }
ok(`${Object.keys(ships).length} ships checked`);

console.log('scenes'); const idx = J('scenes/index.json');
const speakers = new Set([...Object.keys(chars), 'captain']);
const allText = [];
function checkLines(sid, lines, ctx) {
  let dialogue = 0;
  for (const [i, ln] of (lines || []).entries()) {
    const where = `${sid}${ctx}[${i}]`;
    const keys = Object.keys(ln);
    if (ln.stage !== undefined) { if (!stages[ln.stage]) err(`${where} unknown stage ${ln.stage}`); continue; }
    if (ln.effect !== undefined) { if (!EFFECTS.has(ln.effect)) err(`${where} bad effect ${ln.effect}`); continue; }
    if (ln.show_ship !== undefined) { if (!ships[ln.show_ship]) err(`${where} unknown ship ${ln.show_ship}`); if (/^ch[12]_/.test(sid) && /^kestrel_(refit|grafted)$/.test(ln.show_ship)) err(`${where} shows ${ln.show_ship} before ch3 (campaign-v1: Kestrel is 3 hexes in ch1-2)`); if (sid === 'ch4a_intro' && ln.show_ship === 'husk') err(`${where} should use husk_2`); continue; }
    if (ln.hide_ship !== undefined) continue;
    if (!ln.speaker) { err(`${where} has no speaker/stage/effect/show_ship (${keys})`); continue; }
    if (!speakers.has(ln.speaker)) err(`${where} unknown speaker ${ln.speaker}`);
    if (typeof ln.text !== 'string' || !ln.text.trim()) err(`${where} empty text`);
    if (ln.via !== undefined && ln.via !== 'comms') err(`${where} bad via ${ln.via}`);
    if (ln.speaker !== 'narrator') {
      const ids = ln.speaker === 'captain' ? ['captain_a', 'captain_b'] : [ln.speaker];
      for (const id of ids) if (!chars[id]?.portraits[ln.expression]) err(`${where} ${id} has no expression "${ln.expression}"`);
    }
    if (ln.glyphs && ln.speaker !== 'weave') warn(`${where} glyphs on non-weave speaker`);
    dialogue++; allText.push({ where, speaker: ln.speaker, text: ln.text });
  }
  return dialogue;
}
for (const id of REQ_SCENES) if (!idx.scenes.includes(id)) err(`index lacks ${id}`);
const files = fs.readdirSync(path.join(ROOT, 'scenes')).filter((f) => f.endsWith('.json') && f !== 'index.json');
for (const id of REQ_SCENES) if (!files.includes(id + '.json')) err(`missing scene file ${id}.json`);
for (const f of files) {
  const s = J('scenes/' + f), id = f.slice(0, -5);
  if (s.id !== id) err(`${f} id mismatch (${s.id})`);
  if (!stages[s.stage]) err(`${id} unknown start stage`);
  for (const c of s.cast || []) { if (!speakers.has(c.id)) err(`${id} cast ${c.id}`); if (!['left', 'right', 'center'].includes(c.side)) err(`${id} cast side ${c.side}`); }
  const n = checkLines(id, s.lines, '');
  if (MID.has(id) && (n < 3 || n > 8)) err(`${id} mid-battle scene has ${n} dialogue lines (want 3-8)`);
  if (/_defeat$/.test(id) && n > 4) warn(`${id} defeat scene has ${n} lines`);
  if (!('choice' in s)) err(`${id} lacks choice key`);
  if (s.choice) {
    const c = s.choice; if (!c.prompt || !Array.isArray(c.options)) err(`${id} bad choice`);
    for (const o of c.options) { if (!o.id || !o.label) err(`${id} option missing id/label`); if (o.then) checkLines(id, o.then, `.choice.${o.id}`); }
    if (c.repeat_until && !c.options.some((o) => o.id === c.repeat_until)) err(`${id} repeat_until not an option`);
  }
}
const fork = J('scenes/ch4_fork.json');
const b = fork.choice?.options?.find((o) => o.id === 'ch4b');
if (!(fork.choice?.repeat_until === 'ch4a' && b?.lock_after === true && b?.locked_label === 'Signal lost' && b?.then?.length && fork.choice.options.some((o) => o.id === 'ch4a'))) err('ch4_fork choice schema mismatch'); else ok('ch4_fork choice schema matches brief');
ok(`${files.length} scene files checked`);

console.log('v2 chapter-1 rules');
{
  const idx = J('scenes/index.json').scenes; const want = ['ch1_intro', 'ch1_contact', 'ch1_finch_down', 'ch1_hurl', 'ch1_victory', 'ch1_salvage', 'ch1_defeat'];
  if (JSON.stringify(idx.slice(0, 7)) !== JSON.stringify(want)) err('scenes/index.json ch1 order should be ' + want.join(' > '));
  const walk = (lines, f) => { for (const ln of lines || []) f(ln); };
  for (const id of idx) {
    const sc = J(`scenes/${id}.json`); const all = [...(sc.lines || [])]; for (const o of sc.choice?.options || []) all.push(...(o.then || []));
    if (/^ch1_/.test(id)) walk(all, (ln) => { if (ln.show_ship === 'sparrow') err(`${id} shows Sparrow (not in the ch1 battle)`); if (ln.speaker === 'sparrow_pilot' && ln.via === 'comms' && id !== 'ch1_salvage') err(`${id}: Teo is at Kestrel's helm in ch1, not on comms`); });
    else { walk(all, (ln) => { if (['finch_pilot', 'wren_pilot', 'kite_pilot'].includes(ln.speaker)) err(`${id}: ${ln.speaker} speaks after ch1 (killed in ch1)`); if (['finch', 'wren', 'kite'].includes(ln.show_ship)) err(`${id} shows ${ln.show_ship} after ch1`); }); for (const c of sc.cast || []) if (['finch_pilot', 'wren_pilot', 'kite_pilot'].includes(c.id)) err(`${id} casts ${c.id} after ch1`); }
    walk(all, (ln) => { if (/med bay|punch out|pod's away|alive!/i.test(ln.text || '') && /nanda|finch/i.test(JSON.stringify(sc))) err(`${id}: leftover 'Nanda survives' line: ${ln.text}`); });
  }
  ok('ch1 order, Sparrow absent from ch1, escorts silent after ch1');
}
console.log('barks.json'); const barks = J('barks.json');
for (const id of REQ_BARKS) { const bk = barks[id]; if (!bk) { err(`missing bark ${id}`); continue; } if (!speakers.has(bk.speaker)) err(`${id} speaker`); if (!Array.isArray(bk.lines) || bk.lines.length < 1 || bk.lines.length > 3) err(`${id} needs 1-3 lines`); for (const t of bk.lines) allText.push({ where: id, speaker: bk.speaker, text: t }); if (bk.expression) { const ids = bk.speaker === 'captain' ? ['captain_a', 'captain_b'] : [bk.speaker]; for (const c of ids) if (!chars[c]?.portraits[bk.expression]) err(`${id} expression`); } }
ok(`${Object.keys(barks).length} barks checked`);

console.log('captain is never gendered');
const honor = /\b(sir|ma'?am|madam|mister|mr\.?|mrs\.?|ms\.?|miss|lady|ladies|gentlem[ae]n|lad|lass|husband|wife|boyfriend|girlfriend|king|queen|brother|sister|son|daughter|guy|guys|dude|man|woman|boy|girl)\b/i;
const pron = /\b(he|she|him|her|his|hers|himself|herself)\b/i;
for (const t of allText) {
  if (honor.test(t.text)) err(`gendered word in ${t.where}: "${t.text}"`);
  const m = t.text.match(pron);
  if (m) {
    if (t.speaker === 'captain' || /\b(captain|vey)\b/i.test(t.text)) err(`pronoun near captain reference in ${t.where}: "${t.text}"`);
    else warn(`pronoun "${m[0]}" (not about captain, review) in ${t.where}: "${t.text}"`);
  }
}
ok(`${allText.length} lines scanned`);

console.log('code rules');
for (const f of ['core.js', 'player.js', 'bark.js', 'demo.html']) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  if (/localStorage|sessionStorage|indexedDB/.test(src)) err(`${f} uses storage`);
  if (/https?:\/\//.test(src.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, ''))) err(`${f} references an absolute URL`);
  if (/\bimport\s.*from\s+['"](?!\.\/)/.test(src)) err(`${f} imports a non-local module`);
}
const css = fs.readFileSync(path.join(ROOT, 'core.js'), 'utf8').split('const CSS = `')[1].split('`;')[0];
const bad = css.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{')[0].trim()).filter((sel) => sel && !sel.startsWith('@') && sel.split(',').some((x) => !x.trim().startsWith('.sk-story')));
if (bad.length) err('unscoped CSS selectors: ' + bad.join(' | ')); else ok('all CSS selectors scoped under .sk-story');

console.log(`\n${errors} error(s), ${warns} warning(s)`);
process.exit(errors ? 1 : 0);
