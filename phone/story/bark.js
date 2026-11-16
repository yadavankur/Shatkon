// SHATKON battle barks: small non-blocking comms toasts that queue.
// export showBark(barkId, mountEl, { captain }) -> Promise<void> (resolves when this bark has hidden)
import { ensureLoaded, state, charId, portraitUrl, displayName, character, injectCss, prefersReducedMotion, sleep } from './core.js';

const queues = new WeakMap(); // mountEl -> Promise chain
const BASE_MS = 3500, PER_EXTRA_LINE_MS = 1200;

function container(mountEl) {
  let c = mountEl.querySelector(':scope > .sk-story.sk-barks');
  if (!c) {
    c = document.createElement('div');
    c.className = 'sk-story sk-barks';
    c.setAttribute('aria-live', 'polite');
    c.setAttribute('role', 'status');
    mountEl.appendChild(c);
  }
  return c;
}

async function present(bark, barkId, mountEl, captain) {
  const id = charId(bark.speaker, captain);
  const c = character(id);
  const wrap = container(mountEl);
  const t = document.createElement('div');
  t.className = 'sk-bark';
  t.dataset.bark = barkId;
  t.style.setProperty('--sk-accent', c.color || '#e8c15a');
  const face = document.createElement('div'); face.className = 'sk-face';
  const u = portraitUrl(id, bark.expression || 'neutral');
  if (u) { const img = document.createElement('img'); img.src = u; img.alt = ''; face.appendChild(img); }
  const body = document.createElement('div');
  const who = document.createElement('div'); who.className = 'sk-who'; who.textContent = displayName(id);
  const say = document.createElement('div'); say.className = 'sk-say';
  for (const line of bark.lines || []) { const p = document.createElement('p'); p.textContent = line; say.appendChild(p); }
  body.append(who, say); t.append(face, body);
  wrap.appendChild(t);
  void t.offsetWidth;
  t.classList.add('sk-shown');
  const n = Math.max(1, (bark.lines || []).length);
  await sleep(BASE_MS + PER_EXTRA_LINE_MS * (n - 1));
  t.classList.remove('sk-shown');
  await sleep(prefersReducedMotion() ? 0 : 260);
  t.remove();
  if (!wrap.childElementCount) wrap.remove();
}

export async function showBark(barkId, mountEl, opts = {}) {
  if (!mountEl) throw new Error('[sk-story] showBark needs a mount element');
  await ensureLoaded();
  injectCss();
  const bark = state.barks && state.barks[barkId];
  if (!bark) { console.warn('[sk-story] unknown bark', barkId); return; }
  if (getComputedStyle(mountEl).position === 'static') mountEl.style.position = 'relative';
  const prev = queues.get(mountEl) || Promise.resolve();
  const mine = prev.then(() => present(bark, barkId, mountEl, opts.captain)).catch((e) => console.error(e));
  queues.set(mountEl, mine);
  return mine;
}
