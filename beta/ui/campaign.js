// The story campaign around the play screen: the campaign map, saved progress, cutscenes and
// radio barks, the chapter 4 fork, and what happens when a chapter ends.
//
// Cutscenes come from the story developer's story/player.js (playScene / showBark / loadStory).
// Until that folder exists, scenes fall back to a plain text card (from story/scenes/<id>.json
// when there is one), so the campaign is playable either way.

import * as E from '../engine/index.js';

const C_DIR = 'campaign/', STORY_DIR = 'story/', KEY = 'shatkon.story';
const KEYS = (k) => (/\/beta\//.test(location.pathname) ? k.replace(/^shatkon\./, 'shatkon.beta.') : k);   // the beta page keeps its own saves
const store = { get(k) { try { return localStorage.getItem(KEYS(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(KEYS(k), v); } catch (e) {} } };
let hooks = null;              // from the play screen: { h, startStoryGame, render, say }
let data = null;               // { campaign, ships, chapters: { id: doc }, docs }
let progress = null;           // see engine/chapter.js newCampaign / applyResult
let player = null;             // story/player.js, when present
let barkMod = null;
let queue = [], busy = false;  // scenes waiting to play; the computer waits while one plays
let objective = null;

const text = async (path) => { const r = await fetch(path + '?t=' + Date.now()); if (!r.ok) throw new Error('could not read ' + path); return r.text(); };
const yaml = async (path) => window.YAML.parse(await text(path));
const settings = () => { try { return JSON.parse(store.get(KEY + '.settings') || '{}'); } catch (e) { return {}; } };
const setSettings = (s) => store.set(KEY + '.settings', JSON.stringify({ ...settings(), ...s }));

export function initStory(h) { hooks = h; }
export const storyBusy = () => busy;
export const storyObjective = () => objective;

// ---------------------------------------------------------------- loading
async function loadAll() {
  if (data) return data;
  const campaign = await yaml(C_DIR + 'campaign.yaml');
  const ships = await yaml(C_DIR + 'ships.yaml');
  const chapters = {}, docs = {};
  for (const n of campaign.campaign.nodes) {
    if (!n.file) continue;
    const doc = await yaml(C_DIR + n.file), ch = doc.chapter || doc;
    chapters[n.id] = doc;
    const mapPath = C_DIR + ch.map, worldPath = 'rules/' + (ch.world || 'world_v0.4.yaml');
    docs[mapPath] = docs[mapPath] || await yaml(mapPath);
    docs[worldPath] = docs[worldPath] || await yaml(worldPath);
  }
  data = { campaign, ships, chapters, docs };
  try { player = await import('../' + STORY_DIR + 'player.js'); await player.loadStory(STORY_DIR); } catch (e) { player = null; }
  try { barkMod = await import('../' + STORY_DIR + 'bark.js'); } catch (e) { barkMod = null; }
  return data;
}

function loadProgress() {
  try { progress = JSON.parse(store.get(KEY) || 'null'); } catch (e) { progress = null; }
  if (!progress || progress.campaign !== (data.campaign.campaign.id || 'campaign')) progress = E.newCampaign(data.campaign);
  return progress;
}
const saveProgress = () => store.set(KEY, JSON.stringify(progress));

// ---------------------------------------------------------------- the campaign map
export async function openCampaign() {
  const box = document.getElementById('story');
  box.hidden = false;
  box.textContent = 'Loading the campaign…';
  try { await loadAll(); } catch (e) { box.textContent = 'The campaign files could not be loaded: ' + e.message; return; }
  loadProgress();
  drawMap();
}
export function closeCampaign() { document.getElementById('story').hidden = true; }

function drawMap() {
  const { h } = hooks, box = document.getElementById('story'), C = data.campaign.campaign;
  const open = new Set(E.nextNodes(data.campaign, progress).map((n) => n.id)), done = new Set(progress.completed);
  const chosen = progress.choices && progress.choices.fork;
  const forkKids = new Set(C.nodes.filter((p) => p.fork_scene).flatMap((p) => p.next || []));   // only the fork's own branches lock
  const nodeState = (n) => done.has(n.id) ? 'done' : n.locked || (chosen && forkKids.has(n.id) && n.id !== chosen && open.has(n.id)) ? 'locked' : open.has(n.id) ? 'open' : 'later';
  const art = h('div', { class: 'cm-art' });
  const bg = STORY_DIR + 'img/stages/' + (C.map_art || 'campaign_map') + '.webp';
  art.style.backgroundImage = 'url(' + bg + '), radial-gradient(ellipse at 50% 60%, #1a2550 0%, #070b18 70%)';
  // lanes between nodes
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('class', 'cm-lanes');
  for (const n of C.nodes) for (const to of n.next || []) {
    const m = C.nodes.find((x) => x.id === to);
    if (!m || !n.at || !m.at) continue;
    const l = document.createElementNS(svg.namespaceURI, 'line');
    l.setAttribute('x1', n.at[0] * 100); l.setAttribute('y1', n.at[1] * 100); l.setAttribute('x2', m.at[0] * 100); l.setAttribute('y2', m.at[1] * 100);
    l.setAttribute('class', done.has(n.id) && nodeState(m) !== 'locked' ? 'lit' : '');
    svg.appendChild(l);
  }
  art.appendChild(svg);
  for (const n of C.nodes) {
    if (!n.at) continue;
    const st = nodeState(n);
    const b = h('button', { class: 'cm-node ' + st, style: `left:${n.at[0] * 100}%;top:${n.at[1] * 100}%`, disabled: st !== 'open' && st !== 'done',
      'aria-label': n.title + ' (' + ({ done: 'completed', open: 'ready to play', locked: n.locked_text || 'locked', later: 'not yet' }[st]) + ')',
      onclick: () => (st === 'open' || st === 'done') && pickNode(n) },
    h('span', { class: 'dot' }), h('span', { class: 'lbl' }, n.title, st === 'locked' ? h('small', null, n.locked_text || 'Locked') : st === 'done' ? h('small', null, 'Replay') : null));
    art.appendChild(b);
  }
  const s = settings();
  box.textContent = '';
  box.appendChild(h('div', { class: 'cm' },
    h('div', { class: 'cm-top' }, h('h2', null, C.title || 'Campaign'), h('button', { class: 'btn', onclick: () => closeCampaign() }, 'Back to skirmish')),
    h('div', { class: 'cm-scroll' }, art),
    h('div', { class: 'cm-foot' },
      h('label', null, 'Captain ', h('select', { onchange: (ev) => setSettings({ captain: ev.target.value }) },
        h('option', { value: 'captain_a', selected: s.captain !== 'captain_b' }, 'Look A'), h('option', { value: 'captain_b', selected: s.captain === 'captain_b' }, 'Look B'))),
      h('span', { class: 'muted' }, player ? '' : 'Cutscenes show as text until the story files arrive.'),
      h('button', { class: 'btn', onclick: () => drawTest() }, 'Test a chapter'),
      h('button', { class: 'btn', onclick: () => { if (confirm('Start the campaign again from chapter 1? Progress is lost.')) { progress = E.newCampaign(data.campaign); saveProgress(); drawMap(); } } }, 'Restart campaign'))));
  const sc = box.querySelector('.cm-scroll');
  if (sc) sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2;   // the chapters sit in the middle
}

// The fork after a chapter: the node's fork_scene plays (with its choice) before the next chapter.
async function pickNode(n) {
  const C = data.campaign.campaign;
  const parent = C.nodes.find((p) => p.fork_scene && (p.next || []).includes(n.id));
  if (parent && !(progress.choices && progress.choices.fork)) {
    const res = await playScenes([parent.fork_scene]);
    const choice = res && res.choice && C.nodes.some((x) => x.id === res.choice && !x.locked) ? res.choice : (parent.next || []).find((id) => !C.nodes.find((x) => x.id === id).locked);
    progress.choices = { ...(progress.choices || {}), fork: choice };
    saveProgress();
    if (choice !== n.id) return drawMap();
  }
  startChapter(n.id);
}

export function startChapter(id, test = false) {
  store.set(KEY + '.test', test ? '1' : '');
  const chapter = tweaked(id), ch = chapter.chapter || chapter;
  let start;
  if (test) start = testStart(id).progress;
  else {
    // a replay starts from the progress the crew had back then (ships merged later would be missing)
    progress.before = progress.before || {};
    if (!progress.before[id]) { const { before, ...snap } = progress; progress.before[id] = structuredClone(snap); saveProgress(); }
    start = progress.before[id];
  }
  const { rules, problems } = E.buildChapter({
    world: knobbedWorld(data.docs['rules/' + (ch.world || 'world_v0.4.yaml')]), map: data.docs[C_DIR + ch.map],
    ships: data.ships, chapter, campaign: data.campaign, progress: start,
  });
  if (problems.length) { hooks.say('This chapter has problems: ' + problems.join(' '), true); console.warn(problems); }
  objective = null;
  store.set(KEY + '.playing', id);
  closeCampaign();
  hooks.startStoryGame(rules, (test ? 'Test: ' : '') + (ch.title || id));
  const n = Object.keys(knobs()).length + Object.keys(tweaks()[id] || {}).length;
  if (test || n) hooks.toast([test ? 'Test run' : '', n ? n + ' change' + (n === 1 ? '' : 's') : ''].filter(Boolean).join(' · '), 'info');
}

// ---------------------------------------------------------------- events from the engine
// Called by the play screen after every action. Returns at once; scenes play in order.
export function storyEvents(game) {
  if (!game.rules.campaign) return;
  for (const e of game.events) {
    if (e.t === 'scene') queue.push(e.id);
    else if (e.t === 'bark') bark(e.id);
    else if (e.t === 'objective') objective = e.text;
  }
  if (game.phase === 'over') queue.push({ end: game });
  pump();
}

async function pump() {
  if (busy || !queue.length) return;
  busy = true;
  while (queue.length) {
    const item = queue.shift();
    if (item && item.end) await chapterOver(item.end);
    else await playScenes([item]);
  }
  busy = false;
  hooks.render();
}

async function playScenes(ids) {
  let last = null;
  for (const id of ids) {
    const mount = sceneMount();
    try {
      last = player ? await player.playScene(id, mount, { captain: settings().captain || 'captain_a', textSpeed: 'normal', skippable: true }) : await fallbackScene(id, mount);
    } catch (e) { console.warn('scene ' + id, e); last = await fallbackScene(id, mount); }
    mount.remove();
  }
  return last;
}

function sceneMount() {
  const m = document.createElement('div');
  m.className = 'story-stage';
  document.body.appendChild(m);
  return m;
}

// No story/player.js yet: show the scene's lines as text, or just its id.
async function fallbackScene(id, mount) {
  const { h } = hooks;
  let scene = null;
  try { scene = JSON.parse(await text(STORY_DIR + 'scenes/' + id + '.json')); } catch (e) { scene = null; }
  const lines = scene ? (scene.lines || []).filter((l) => l.text).map((l) => (l.speaker ? l.speaker.replace(/_/g, ' ') + ': ' : '') + l.text) : [];
  return new Promise((resolve) => {
    const finish = (choice) => resolve({ choice: choice || null });
    const opts = scene && scene.choice ? scene.choice.options : null;
    mount.appendChild(h('div', { class: 'story-card' },
      h('div', { class: 'muted' }, 'Scene · ' + id),
      lines.length ? h('div', { class: 'story-lines' }, lines.map((l) => h('p', null, l))) : h('p', { class: 'muted' }, 'The cutscene for this moment will play here.'),
      opts ? h('div', { class: 'row' }, opts.map((o) => h('button', { class: 'btn', onclick: () => finish(o.id) }, o.label || o.id)))
        : id === 'ch4_fork' ? h('div', { class: 'row' }, h('button', { class: 'btn go', onclick: () => finish('ch4a') }, 'Answer the distress call'), h('button', { class: 'btn', disabled: true }, 'The Long Dark · signal lost'))
          : h('div', { class: 'row' }, h('button', { class: 'btn go', onclick: () => finish(null) }, 'Continue'))));
    mount.querySelector('button:not([disabled])').focus();
  });
}

function bark(id) {
  const mount = document.getElementById('barks');
  if (barkMod && mount) { barkMod.showBark(id, mount, { captain: settings().captain || 'captain_a' }).catch(() => {}); return; }
  hooks.toast('\u{1F4E1} ' + id.replace(/^b\d+a?_/, '').replace(/_/g, ' '), 'bark');
}

// ---------------------------------------------------------------- chapter end
async function chapterOver(game) {
  const id = store.get(KEY + '.playing') || game.rules.campaign.id, chapter = data && data.chapters[id];
  if (!data) await loadAll();
  if (!progress) loadProgress();
  const result = game.script && game.script.result;
  const replay = progress.completed.includes(id) || store.get(KEY + '.test') === '1';   // a replay or a test run earns nothing new
  if (chapter && !replay && (result === 'win' || result === 'to_be_continued')) {
    const before = progress.before;
    progress = E.applyResult(progress, data.chapters[id], game);
    progress.before = before;
    saveProgress();
  }
  hooks.render();
}

// For the "game over" card on the play screen.
export function storyOverText(game) {
  const r = game.script && game.script.result;
  return r === 'win' ? 'Chapter complete.' : r === 'to_be_continued' ? 'To be continued…' : 'The chapter is lost. Try again?';
}
export function retryChapter(game) {
  const id = store.get(KEY + '.playing') || game.rules.campaign.id;
  (async () => { await loadAll(); loadProgress(); startChapter(id, store.get(KEY + '.test') === '1'); })();
}

// ---------------------------------------------------------------- tuning and test runs
// Rule knobs come from the Lab (the same ones the skirmish uses). Chapter tweaks are per chapter,
// paths inside the chapter (for now the computer's ai_profiles). Both live in this browser only;
// "Copy changes" gives text to paste to whoever edits the files.
const LAB_KEY = 'shatkon.labKnobs', TWEAK_KEY = KEY + '.tweaks';
const readJson = (k) => { try { return JSON.parse(store.get(k) || '{}') || {}; } catch (e) { return {}; } };
const knobs = () => readJson(LAB_KEY);
const tweaks = () => readJson(TWEAK_KEY);
const setPath = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); for (const k of ks) o = o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}; o[last] = v; };
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function knobbedWorld(w) { const out = structuredClone(w); for (const [p, v] of Object.entries(knobs())) setPath(out, p, v); return out; }
function tweaked(id) {
  const doc = structuredClone(data.chapters[id]), ch = doc.chapter || doc;
  for (const [p, v] of Object.entries(tweaks()[id] || {})) setPath(ch, p, v);
  return doc;
}
// Where a test starts: your own save from just before that chapter if you have one,
// otherwise a crew that won every chapter on the way (taking the first branch at a fork).
function testStart(id) {
  if (!progress) loadProgress();
  if (progress.before && progress.before[id]) return { progress: progress.before[id], from: 'your save' };
  let p = E.newCampaign(data.campaign);
  for (let i = 0; i < 12 && !E.nextNodes(data.campaign, p).some((n) => n.id === id); i++) {
    const n = E.nextNodes(data.campaign, p).find((x) => !x.locked && data.chapters[x.id]);
    if (!n) break;
    p = E.applyResult(p, data.chapters[n.id], { script: { result: 'win', flags: {} }, ships: [], winner: 0 });
  }
  return { progress: p, from: 'a crew that won every chapter before it (merged ships start unmerged)' };
}

const AI_FIELDS = [
  ['level', 'Skill', ['easy', 'normal']],
  ['stance', 'Personality', ['', 'hunt', 'charge', 'hold', 'advance', 'flee']],
  ['stand_off', 'Keeps this many hexes away', 'num'],
  ['target', 'Goes after (flagship, smallest, nearest, or ship names)', 'text'],
  ['launch_range', 'Launches missiles within (hexes)', 'num'],
  ['scans', 'Scans', 'bool'],
];
const STANCE_HELP = 'hunt: closes to a shooting distance and fights. charge: rams into close range. hold: never moves. advance: marches to its goal, ignoring you. flee: keeps as far away as it can. (blank: the stock computer)';

function drawTest(sel) {
  const { h } = hooks, box = document.getElementById('story'), C = data.campaign.campaign;
  const ids = C.nodes.filter((n) => n.file && data.chapters[n.id]).map((n) => n.id);
  const id = sel && ids.includes(sel) ? sel : store.get(KEY + '.testsel') && ids.includes(store.get(KEY + '.testsel')) ? store.get(KEY + '.testsel') : ids[0];
  store.set(KEY + '.testsel', id);
  const node = C.nodes.find((n) => n.id === id), base = data.chapters[id].chapter || data.chapters[id];
  const T = tweaks(), mine = T[id] || {}, K = knobs();
  const save = (p, v) => { const all = tweaks(); all[id] = all[id] || {}; if (v === undefined || JSON.stringify(v) === JSON.stringify(getPath(base, p))) delete all[id][p]; else all[id][p] = v; if (!Object.keys(all[id]).length) delete all[id]; store.set(TWEAK_KEY, JSON.stringify(all)); drawTest(id); };
  const profiles = base.ai_profiles || {};
  const field = (pname, [f, label, kind]) => {
    const p = 'ai_profiles.' + pname + '.' + f, cur = p in mine ? mine[p] : getPath(base, p), changed = p in mine;
    let input;
    if (Array.isArray(kind)) input = h('select', { onchange: (e) => save(p, e.target.value || undefined) }, ...kind.map((o) => h('option', { value: o, selected: (cur || '') === o }, o || '(stock)')));
    else if (kind === 'bool') input = h('input', { type: 'checkbox', checked: !!cur, onchange: (e) => save(p, e.target.checked) });
    else if (kind === 'num') input = h('input', { type: 'number', inputmode: 'numeric', value: cur == null ? '' : typeof cur === 'object' ? '' : cur, placeholder: cur && typeof cur === 'object' ? JSON.stringify(cur) : '', onchange: (e) => save(p, e.target.value === '' ? undefined : Number(e.target.value)) });
    else input = h('input', { type: 'text', value: cur == null ? '' : Array.isArray(cur) ? cur.join(', ') : String(cur), onchange: (e) => { const v = e.target.value.trim(); save(p, !v ? undefined : /,/.test(v) || !['flagship', 'smallest', 'nearest'].includes(v) ? v.split(',').map((x) => x.trim()).filter(Boolean) : v); } });
    return h('label', { class: 'tune-f' + (changed ? ' changed' : '') }, h('span', null, label), input);
  };
  const st = testStart(id), nk = Object.keys(K).length;
  const copyText = () => {
    const lines = ['# Shatkon tuning (from the Test a chapter screen)'];
    if (nk) { lines.push('# rules/world_v0.4.yaml'); for (const [p, v] of Object.entries(K)) lines.push(p + ': ' + JSON.stringify(v)); }
    for (const [cid, t] of Object.entries(tweaks())) { lines.push('# campaign chapter ' + cid); for (const [p, v] of Object.entries(t)) lines.push(p + ': ' + JSON.stringify(v)); }
    return lines.join('\n');
  };
  box.textContent = '';
  box.appendChild(h('div', { class: 'cm tune' },
    h('div', { class: 'cm-top' }, h('h2', null, 'Test a chapter'), h('button', { class: 'btn', onclick: () => drawMap() }, 'Back to map')),
    h('div', { class: 'tune-body' },
      h('label', { class: 'tune-f' }, h('span', null, 'Chapter'), h('select', { onchange: (e) => drawTest(e.target.value) }, ...ids.map((x) => h('option', { value: x, selected: x === id }, (C.nodes.find((n) => n.id === x).title || x) + (tweaks()[x] ? ' *' : ''))))),
      h('p', { class: 'muted' }, 'Starts from ' + st.from + '. A test run never changes your campaign save.'),
      h('h3', null, 'Rule knobs ', h('small', { class: 'muted' }, nk ? nk + ' changed' : 'none changed')),
      h('p', { class: 'muted' }, 'Lasers, shields, missiles, detection… are set in the Lab and apply to skirmish and story alike. ',
        h('button', { class: 'btn sm', onclick: () => { closeCampaign(); location.hash = '#lab'; } }, 'Open the Lab knobs')),
      nk ? h('ul', { class: 'tune-list' }, ...Object.entries(K).map(([p, v]) => h('li', null, p + ' = ' + JSON.stringify(v)))) : null,
      h('h3', null, 'Enemy personalities in this chapter'),
      h('p', { class: 'muted' }, STANCE_HELP),
      Object.keys(profiles).length
        ? h('div', null, ...Object.keys(profiles).map((pn) => h('fieldset', { class: 'tune-p' }, h('legend', null, pn.replace(/_/g, ' ')), ...AI_FIELDS.map((f) => field(pn, f)))))
        : h('p', { class: 'muted' }, 'This chapter has no computer profiles to tune.'),
      h('div', { class: 'row tune-go' },
        h('button', { class: 'btn go', onclick: () => startChapter(id, true) }, 'Launch test'),
        h('button', { class: 'btn', disabled: !mine || !Object.keys(mine).length, onclick: () => { const all = tweaks(); delete all[id]; store.set(TWEAK_KEY, JSON.stringify(all)); drawTest(id); } }, 'Reset this chapter'),
        h('button', { class: 'btn', onclick: (e) => { const t = copyText(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { e.target.textContent = 'Copied'; }, () => window.prompt('Copy these changes:', t)); } }, 'Copy changes')))));
}
