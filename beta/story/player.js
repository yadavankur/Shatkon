// SHATKON story cutscene player.
// export loadStory(baseUrl = "story/"), playScene(sceneId, mountEl, opts), preloadScenes(ids)
import {
  state, loadStory as coreLoad, ensureLoaded, getScene, charId, character, portraitUrl, displayName,
  stageUrl, stageFocus, shipInfo, preloadImage, prefersReducedMotion, sleep, resolveUrl, injectCss,
} from './core.js';

export function loadStory(baseUrl = 'story/') { return coreLoad(baseUrl); }

const SPEED_MS = { slow: 45, normal: 24, instant: 0 }; // ms per character
const FX_MS = { shake: 450, flash: 380, glitch: 600, fade_out: 800 };

function el(tag, cls, parent, attrs) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// Deterministic hex glyph strip for a Weave line (seeded by its text).
function glyphSvg(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  const n = 5, R = 26, gap = 70, W = gap * n, H = 80;
  const corner = (cx, cy, i, r = R) => { const a = (Math.PI / 180) * (60 * i - 30); return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  let out = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">`;
  for (let g = 0; g < n; g++) {
    const cx = gap / 2 + g * gap, cy = H / 2;
    const pts = [0, 1, 2, 3, 4, 5].map((i) => corner(cx, cy, i).map((v) => v.toFixed(1)).join(',')).join(' ');
    let d = '';
    const strokes = 2 + Math.floor(rnd() * 3);
    for (let s = 0; s < strokes; s++) {
      const a = Math.floor(rnd() * 6), b = (a + 2 + Math.floor(rnd() * 3)) % 6;
      const [x1, y1] = corner(cx, cy, a, R * 0.78), [x2, y2] = corner(cx, cy, b, R * 0.78);
      d += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${cx} ${cy}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }
    if (rnd() > 0.5) d += `M${cx - 4} ${cy}a4 4 0 1 0 8 0a4 4 0 1 0 -8 0`;
    out += `<g class="sk-g" style="animation-delay:${(g * 0.18).toFixed(2)}s"><polygon points="${pts}"/><path d="${d}"/></g>`;
  }
  return out + '</svg>';
}

function collectUrls(scene) {
  const urls = new Set();
  const addStage = (id) => { const u = stageUrl(id); if (u) urls.add(u); };
  const addLine = (ln) => {
    if (ln.stage) addStage(ln.stage);
    if (ln.show_ship) urls.add(shipInfo(ln.show_ship).img);
    if (ln.speaker && ln.speaker !== 'narrator') {
      const ids = ln.speaker === 'captain' ? ['captain_a', 'captain_b'] : [ln.speaker];
      for (const id of ids) { const u = portraitUrl(id, ln.expression || 'neutral'); if (u) urls.add(u); }
    }
    if (ln.via === 'comms') addStage('comms_screen');
  };
  addStage(scene.stage);
  for (const c of scene.cast || []) {
    const ids = c.id === 'captain' ? ['captain_a', 'captain_b'] : [c.id];
    for (const id of ids) { const u = portraitUrl(id, 'neutral'); if (u) urls.add(u); }
  }
  (scene.lines || []).forEach(addLine);
  for (const o of (scene.choice && scene.choice.options) || []) (o.then || []).forEach(addLine);
  return [...urls];
}

export async function preloadScenes(ids = []) {
  await ensureLoaded();
  const scenes = await Promise.all(ids.map((id) => getScene(id)));
  await Promise.all(scenes.flatMap((s) => collectUrls(s).map(preloadImage)));
}

export async function playScene(sceneId, mountEl, opts = {}) {
  if (!mountEl) throw new Error('[sk-story] playScene needs a mount element');
  await ensureLoaded();
  injectCss();
  const scene = await getScene(sceneId);
  const o = { captain: 'captain_a', textSpeed: 'normal', skippable: true, ...opts };
  const reduced = prefersReducedMotion();
  const speed = reduced ? 0 : (SPEED_MS[o.textSpeed] ?? SPEED_MS.normal);
  const fast = o.textSpeed === 'instant';
  // Load what the first frame needs; the rest streams in the background.
  await Promise.all([preloadImage(stageUrl(scene.stage)), ...(scene.cast || []).map((c) => preloadImage(portraitUrl(charId(c.id, o.captain), 'neutral')))]);
  collectUrls(scene).forEach(preloadImage);

  // ----------------------------------------------------------------- DOM
  let restorePos = null;
  if (getComputedStyle(mountEl).position === 'static') { restorePos = mountEl.style.position; mountEl.style.position = 'relative'; }
  const root = el('div', 'sk-story sk-story-root', mountEl, { role: 'dialog', 'aria-label': 'Story scene', tabindex: '-1', 'data-scene': scene.id });
  const stage = el('div', 'sk-stage', root);
  const bgA = el('div', 'sk-bg', stage), bgB = el('div', 'sk-bg', stage);
  el('div', 'sk-vignette', stage);
  const ship = el('figure', 'sk-ship', root); const shipImg = el('img', '', ship, { alt: '' }); const shipCap = el('figcaption', '', ship);
  const castEl = el('div', 'sk-cast', root);
  const comms = el('div', 'sk-comms', root); comms.style.backgroundImage = `url("${stageUrl('comms_screen')}")`;
  const commsTag = el('div', 'sk-tag', comms); const screen = el('div', 'sk-screen', comms); const commsImg = el('img', '', screen, { alt: '' });
  const glyphs = el('div', 'sk-glyphs', root); const weaveImg = el('img', 'sk-weave', glyphs, { alt: '' }); const glyphStrip = el('div', '', glyphs);
  const fx = el('div', 'sk-fx', root);
  const box = el('div', 'sk-box', root); const nameEl = el('div', 'sk-name', box); const textEl = el('div', 'sk-text', box); el('div', 'sk-next', box, { 'aria-hidden': 'true' }).textContent = '▸';
  const choiceEl = el('div', 'sk-choice', root); choiceEl.hidden = true;
  const live = el('div', 'sk-live', root, { 'aria-live': 'polite', role: 'log', 'aria-atomic': 'false' });
  let skipBtn = null;
  if (o.skippable !== false) { skipBtn = el('button', 'sk-skip', root, { type: 'button', 'aria-label': 'Skip scene' }); skipBtn.textContent = 'Skip ▸▸'; }

  // ------------------------------------------------------------- state
  let skipped = false, finishTyping = null, advanceWaiter = null, inChoice = false, frontBg = bgA, curStage = null;
  const slots = new Map(); // side -> { id, el, img }
  function slot(side) {
    if (!slots.has(side)) {
      const e = el('div', `sk-por sk-${side}`, castEl); const img = el('img', '', e, { alt: '' });
      slots.set(side, { id: null, el: e, img });
    }
    return slots.get(side);
  }
  function putOnSide(side, id, expression) {
    const s = slot(side); s.id = id;
    const u = portraitUrl(id, expression || 'neutral');
    if (u && s.img.getAttribute('src') !== u) s.img.src = u;
    s.img.alt = displayName(id);
    s.el.classList.toggle('sk-shown', !!u);
  }
  for (const c of scene.cast || []) putOnSide(c.side || 'left', charId(c.id, o.captain), 'neutral');

  function setStage(id) {
    const u = stageUrl(id); if (!u) return;
    curStage = id;
    const [fx_, fy] = stageFocus(id);
    const back = frontBg === bgA ? bgB : bgA;
    back.style.backgroundImage = `url("${u}")`;
    back.style.backgroundPosition = `${fx_ * 100}% ${fy * 100}%`;
    back.classList.add('sk-on'); frontBg.classList.remove('sk-on'); frontBg = back;
    root.classList.remove('sk-fx-fade');
  }
  setStage(scene.stage);

  function highlight(id) { for (const s of slots.values()) s.el.classList.toggle('sk-speaking', !!id && s.id === id); }
  function hideShip() { ship.classList.remove('sk-shown'); }

  // --------------------------------------------------------- input
  const advance = () => {
    if (inChoice) return;
    if (finishTyping) { finishTyping(); return; }
    if (advanceWaiter) { const w = advanceWaiter; advanceWaiter = null; w(); }
  };
  const onPointer = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('.sk-skip,.sk-choice')) return;
    advance();
  };
  const onKey = (e) => {
    if (!root.isConnected) return;
    const t = e.target;
    if (t && (t.closest?.('input,textarea,select,[contenteditable="true"]'))) return;
    if (t && t.closest?.('.sk-story button')) return; // buttons handle their own Space/Enter
    if (e.key === ' ' || e.key === 'Enter' || e.code === 'Space') { e.preventDefault(); advance(); }
  };
  root.addEventListener('click', onPointer);
  document.addEventListener('keydown', onKey);
  const doSkip = () => {
    skipped = true;
    if (finishTyping) finishTyping();
    if (advanceWaiter) { const w = advanceWaiter; advanceWaiter = null; w(); }
  };
  if (skipBtn) skipBtn.addEventListener('click', (e) => { e.stopPropagation(); doSkip(); });
  try { root.focus({ preventScroll: true }); } catch { /* ignore */ }

  const waitAdvance = () => new Promise((r) => { advanceWaiter = r; });
  const pause = (ms) => (skipped ? Promise.resolve() : sleep(fast ? Math.min(ms, 120) : ms));

  function announce(who, text) {
    const p = document.createElement('p'); p.textContent = who ? `${who}: ${text}` : text;
    live.appendChild(p); while (live.childNodes.length > 4) live.removeChild(live.firstChild);
  }

  function typeOut(text) {
    box.classList.remove('sk-done');
    if (speed === 0 || skipped) { textEl.textContent = text; box.classList.add('sk-done'); return Promise.resolve(); }
    return new Promise((resolve) => {
      let i = 0, raf = 0; const start = performance.now();
      const done = () => { cancelAnimationFrame(raf); textEl.textContent = text; finishTyping = null; box.classList.add('sk-done'); resolve(); };
      finishTyping = done;
      const step = (now) => {
        const n = Math.min(text.length, Math.floor((now - start) / speed) + 1);
        if (n !== i) { i = n; textEl.textContent = text.slice(0, i); }
        if (i >= text.length) done(); else raf = requestAnimationFrame(step);
      };
      textEl.textContent = '';
      raf = requestAnimationFrame(step);
    });
  }

  async function effect(name) {
    if (name === 'fade_out') { root.classList.add('sk-fx-fade'); void fx.offsetWidth; await pause(FX_MS.fade_out); return; }
    const cls = { shake: 'sk-fx-shake', flash: 'sk-fx-flash', glitch: 'sk-fx-glitch' }[name];
    if (!cls) { console.warn('[sk-story] unknown effect', name); return; }
    root.classList.remove(cls); void root.offsetWidth; root.classList.add(cls);
    await pause(FX_MS[name]);
    root.classList.remove(cls);
  }

  async function sayLine(ln) {
    const isNarr = ln.speaker === 'narrator';
    const id = isNarr ? null : charId(ln.speaker, o.captain);
    const c = id ? character(id) : null;
    const who = isNarr ? '' : (ln.speaker === 'weave' ? (c.name || 'The Weave') : displayName(id));
    box.classList.toggle('sk-narration', isNarr);
    box.classList.toggle('sk-glyphline', !!ln.glyphs);
    box.style.setProperty('--sk-accent', (c && c.color) || '#e8c15a');
    nameEl.textContent = '';
    if (who) { const n = el('span', '', nameEl); n.textContent = who; }
    if (ln.via === 'comms') { const v = el('span', 'sk-via', nameEl); v.textContent = 'COMMS'; }
    if (ln.glyphs) { const v = el('span', 'sk-via', nameEl); v.textContent = 'PULSE'; }

    // visuals
    glyphs.classList.remove('sk-shown');
    comms.classList.remove('sk-shown');
    ship.classList.toggle('sk-low', !!ln.glyphs || ln.via === 'comms');
    if (isNarr) {
      highlight(null);
    } else if (ln.glyphs) {
      highlight(null);
      glyphs.className = `sk-glyphs sk-shown sk-${ln.expression || 'pulse'}`;
      const u = portraitUrl('weave', ln.expression || 'pulse'); if (u) weaveImg.src = u;
      glyphStrip.innerHTML = glyphSvg(ln.text || '');
    } else if (ln.via === 'comms') {
      highlight(null);
      const u = portraitUrl(id, ln.expression);
      if (u) commsImg.src = u;
      commsImg.alt = who;
      commsTag.textContent = `Comms · ${who}`;
      comms.classList.toggle('sk-mimic', id === 'mimic');
      comms.classList.add('sk-shown');
    } else {
      // on stage: find the speaker's slot, or bring them on
      let side = [...slots.entries()].find(([, s]) => s.id === id)?.[0];
      if (!side) {
        const free = ['left', 'right'].find((sd) => !slots.has(sd) || !slots.get(sd).id);
        if (free) side = free;
        else {
          const capId = charId('captain', o.captain);
          side = slots.get('right').id === capId ? 'left' : 'right';
        }
      }
      putOnSide(side, id, ln.expression);
      highlight(id);
    }
    announce(who, ln.text || '');
    if (typeof o.onLine === 'function') { try { o.onLine(ln); } catch (e) { console.error(e); } }
    await typeOut(ln.text || '');
    if (skipped) return;
    await waitAdvance();
  }

  async function runLines(lines) {
    for (const ln of lines || []) {
      if (skipped) return;
      if (ln.stage) { setStage(ln.stage); hideShip(); if (typeof o.onLine === 'function') o.onLine(ln); await pause(420); continue; }
      if (ln.effect) { if (typeof o.onLine === 'function') o.onLine(ln); await effect(ln.effect); continue; }
      if (ln.show_ship) {
        const info = shipInfo(ln.show_ship);
        shipImg.src = info.img; shipCap.textContent = info.name;
        ship.classList.toggle('sk-weave', info.side === 'weave');
        ship.classList.add('sk-shown');
        if (typeof o.onLine === 'function') o.onLine(ln);
        await pause(500); continue;
      }
      if (ln.hide_ship) { hideShip(); continue; }
      if (ln.speaker) { await sayLine(ln); continue; }
    }
  }

  function askChoice(choice, locked) {
    return new Promise((resolve) => {
      inChoice = true;
      choiceEl.innerHTML = '';
      const pr = el('div', 'sk-prompt', choiceEl, { id: `sk-prompt-${scene.id}` }); pr.textContent = choice.prompt || '';
      choiceEl.setAttribute('role', 'group'); choiceEl.setAttribute('aria-labelledby', pr.id);
      let first = null;
      for (const opt of choice.options || []) {
        const b = el('button', 'sk-opt', choiceEl, { type: 'button', 'data-option': opt.id });
        const isLocked = locked.has(opt.id);
        const lab = el('span', '', b); lab.textContent = opt.label || opt.id;
        if (isLocked) { b.disabled = true; const sm = el('small', '', b); sm.textContent = opt.locked_label || 'Locked'; b.setAttribute('aria-label', `${opt.label} (${opt.locked_label || 'locked'})`); }
        else {
          if (!first) first = b;
          b.addEventListener('click', (e) => { e.stopPropagation(); choiceEl.hidden = true; root.classList.remove('sk-choosing'); inChoice = false; resolve(opt); });
        }
      }
      choiceEl.hidden = false; root.classList.add('sk-choosing');
      announce('', `Choice: ${choice.prompt}`);
      if (first) setTimeout(() => { try { first.focus({ preventScroll: true }); } catch { /* ignore */ } }, 30);
    });
  }

  // ----------------------------------------------------------- run
  let result = null;
  try {
    await runLines(scene.lines);
    const ch = scene.choice;
    if (ch && ch.options && ch.options.length) {
      const locked = new Set();
      for (;;) {
        skipped = false; // a choice cannot be skipped
        hideShip(); glyphs.classList.remove('sk-shown'); comms.classList.remove('sk-shown');
        const opt = await askChoice(ch, locked);
        if (opt.then && opt.then.length) { await runLines(opt.then); }
        if (opt.lock_after) locked.add(opt.id);
        if (!ch.repeat_until || opt.id === ch.repeat_until) { result = opt.id; break; }
        if ((ch.options || []).every((x) => locked.has(x.id))) { result = ch.repeat_until; break; }
      }
    }
  } finally {
    document.removeEventListener('keydown', onKey);
    root.removeEventListener('click', onPointer);
    root.remove();
    if (restorePos !== null) mountEl.style.position = restorePos;
  }
  return { choice: result };
}

export { resolveUrl, state as _state };
