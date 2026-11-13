// SHATKON story runtime: shared data store, asset URLs and scoped CSS.
// Vanilla ES module. No libraries, no network beyond this folder, no storage.
const state = {
  base: null, characters: null, stages: null, barks: null, ships: null,
  scenes: new Map(), images: new Map(), loading: null,
};
export { state };

export function resolveUrl(path) {
  if (!state.base) throw new Error('[sk-story] loadStory() has not been called');
  return new URL(path, state.base).href;
}

async function fetchJSON(path, optional = false) {
  const res = await fetch(resolveUrl(path));
  if (!res.ok) {
    if (optional) return null;
    throw new Error(`[sk-story] could not load ${path} (${res.status})`);
  }
  return res.json();
}

export function loadStory(baseUrl = 'story/') {
  const b = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const base = new URL(b, document.baseURI).href;
  if (state.loading && state.base === base) return state.loading;
  state.base = base;
  state.scenes.clear();
  state.loading = (async () => {
    const [characters, stages, barks, ships] = await Promise.all([
      fetchJSON('characters.json'), fetchJSON('stages.json'),
      fetchJSON('barks.json'), fetchJSON('ships.json', true),
    ]);
    Object.assign(state, { characters, stages, barks, ships: ships || {} });
    injectCss();
  })();
  return state.loading;
}

export async function ensureLoaded() {
  if (!state.loading) await loadStory();
  else await state.loading;
}

export async function getScene(id) {
  await ensureLoaded();
  if (!state.scenes.has(id)) {
    state.scenes.set(id, fetchJSON(`scenes/${encodeURIComponent(id)}.json`).catch((e) => {
      state.scenes.delete(id); throw e;
    }));
  }
  return state.scenes.get(id);
}

export function charId(speaker, captain) {
  if (speaker === 'captain') return captain === 'captain_b' ? 'captain_b' : 'captain_a';
  return speaker;
}

export function character(id) {
  return (state.characters && state.characters[id]) || { name: id, portraits: {} };
}

export function portraitUrl(id, expression) {
  const c = character(id);
  const p = c.portraits || {};
  const rel = p[expression] || p.neutral || p.calm || Object.values(p)[0];
  return rel ? resolveUrl(rel) : null;
}

export function displayName(id) {
  const c = character(id);
  return c.short || c.name || '';
}

export function stageUrl(id) {
  const s = state.stages && state.stages[id];
  return s ? resolveUrl(s.img) : null;
}
export function stageFocus(id) {
  const s = state.stages && state.stages[id];
  return (s && s.focus) || [0.5, 0.5];
}
export function shipInfo(id) {
  const s = (state.ships && state.ships[id]) || {};
  return { name: s.name || id, img: resolveUrl(s.img || `img/ships/${id}.webp`), side: s.side || 'player' };
}

export function preloadImage(url) {
  if (!url) return Promise.resolve();
  if (!state.images.has(url)) {
    state.images.set(url, new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => { console.warn('[sk-story] image failed to load:', url); resolve(null); };
      img.src = url;
    }));
  }
  return state.images.get(url);
}

export function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- CSS
// Every selector is scoped under .sk-story so nothing leaks into the game page.
const CSS = `
.sk-story{--sk-bg:#070b16;--sk-panel:rgba(12,19,38,.94);--sk-line:#25325a;--sk-text:#e7ecf6;--sk-muted:#8f9cba;
 --sk-gold:#e8c15a;--sk-blue:#5cc8ff;--sk-red:#ff5a8a;--sk-violet:#9a5cff;
 font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--sk-text);box-sizing:border-box;
 -webkit-tap-highlight-color:transparent}
.sk-story *,.sk-story *::before,.sk-story *::after{box-sizing:border-box}
.sk-story.sk-story-root{position:absolute;inset:0;overflow:hidden;background:var(--sk-bg);user-select:none;-webkit-user-select:none;
 container-type:size;container-name:skstory;outline:none;cursor:pointer;z-index:1}
.sk-story .sk-stage{position:absolute;inset:0}
.sk-story .sk-bg{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat;opacity:0;transition:opacity .45s ease}
.sk-story .sk-bg.sk-on{opacity:1}
.sk-story .sk-vignette{position:absolute;inset:0;pointer-events:none;
 background:linear-gradient(to top,rgba(7,11,22,.92) 0%,rgba(7,11,22,.35) 32%,rgba(7,11,22,0) 55%),radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(0,0,0,.45) 100%)}
/* portraits */
.sk-story .sk-cast{position:absolute;inset:0;pointer-events:none}
.sk-story .sk-por{position:absolute;bottom:0;height:min(78cqh,118cqw);aspect-ratio:3/4;transition:filter .25s ease,transform .25s ease,opacity .25s ease;opacity:0;
 filter:brightness(.42) saturate(.55);transform:translateY(2%)}
.sk-story .sk-por.sk-shown{opacity:1}
.sk-story .sk-por.sk-speaking{filter:none;transform:translateY(0) scale(1.02);z-index:2}
.sk-story .sk-por img{width:100%;height:100%;object-fit:contain;object-position:bottom;display:block}
.sk-story .sk-por.sk-left{left:max(-6cqw,-60px)}
.sk-story .sk-por.sk-right{right:max(-6cqw,-60px)}
.sk-story .sk-por.sk-right img{transform:scaleX(-1)}
.sk-story .sk-por.sk-center{left:50%;translate:-50% 0}
@container skstory (max-aspect-ratio: 4/5){
 .sk-story .sk-por{height:min(62cqh,110cqw)}
 .sk-story .sk-por.sk-left{left:-16cqw}.sk-story .sk-por.sk-right{right:-16cqw}
}
/* ship display */
.sk-story .sk-ship{position:absolute;left:50%;top:8cqh;width:min(64cqw,560px);transform:translateX(-50%) scale(.92);opacity:0;transition:opacity .35s ease,transform .35s ease;pointer-events:none;text-align:center;z-index:3}
.sk-story .sk-ship.sk-shown{opacity:1;transform:translateX(-50%) scale(1)}
.sk-story .sk-ship.sk-low{top:30cqh;width:min(46cqw,400px)}
.sk-story .sk-ship img{width:100%;display:block;filter:drop-shadow(0 0 18px rgba(92,200,255,.25));animation:sk-float 5s ease-in-out infinite}
.sk-story .sk-ship.sk-weave img{filter:drop-shadow(0 0 22px rgba(255,90,138,.35))}
.sk-story .sk-ship figcaption{font:600 12px/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.18em;text-transform:uppercase;color:var(--sk-blue);margin-top:-4%}
.sk-story .sk-ship.sk-weave figcaption{color:var(--sk-red)}
@keyframes sk-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5%)}}
/* comms frame */
.sk-story .sk-comms{position:absolute;left:50%;top:max(10px,3cqh);width:min(84cqw,560px);aspect-ratio:16/9;transform:translateX(-50%) scale(.96);opacity:0;
 transition:opacity .25s ease,transform .25s ease;pointer-events:none;z-index:4;background-size:cover;background-position:center;border-radius:8px;
 box-shadow:0 10px 40px rgba(0,0,0,.55)}
.sk-story .sk-comms.sk-shown{opacity:1;transform:translateX(-50%) scale(1)}
.sk-story .sk-comms .sk-screen{position:absolute;left:16.5%;right:16.5%;top:19%;bottom:22%;overflow:hidden;border-radius:3px;background:radial-gradient(ellipse at 50% 100%,rgba(92,200,255,.22),rgba(4,8,18,.6))}
.sk-story .sk-comms .sk-screen img{position:absolute;left:50%;top:4%;height:230%;transform:translateX(-50%);filter:saturate(.9) contrast(1.05)}
.sk-story .sk-comms .sk-screen::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(to bottom,rgba(255,255,255,.05) 0 1px,transparent 1px 3px);
 animation:sk-scan 3s linear infinite;mix-blend-mode:screen}
.sk-story .sk-comms .sk-tag{position:absolute;left:17%;top:8.5%;font:600 11px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.16em;color:var(--sk-gold);text-transform:uppercase}
.sk-story .sk-comms.sk-mimic .sk-screen img{animation:sk-mimic 7s steps(1) infinite}
@keyframes sk-scan{from{background-position:0 0}to{background-position:0 30px}}
@keyframes sk-mimic{0%,93%,100%{filter:none;transform:translateX(-50%)}94%{filter:hue-rotate(300deg) saturate(2);transform:translateX(-49%)}96%{filter:none;transform:translateX(-51%)}}
/* weave glyphs */
.sk-story .sk-glyphs{position:absolute;left:50%;top:6cqh;width:min(90cqw,620px);transform:translateX(-50%);opacity:0;transition:opacity .3s ease;pointer-events:none;z-index:4;text-align:center}
.sk-story .sk-glyphs.sk-shown{opacity:1}
.sk-story .sk-glyphs .sk-weave{width:min(34cqh,46cqw);margin:0 auto -12%;display:block;opacity:.85;mix-blend-mode:screen;animation:sk-breathe 2.6s ease-in-out infinite}
.sk-story .sk-glyphs svg{width:100%;height:auto;overflow:visible;display:block}
.sk-story .sk-glyphs .sk-g{transform-box:fill-box;transform-origin:center;animation:sk-glyph 1.6s ease-in-out infinite}
.sk-story .sk-glyphs .sk-g path,.sk-story .sk-glyphs .sk-g polygon{fill:none;stroke:var(--sk-red);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.sk-story .sk-glyphs .sk-g polygon{stroke:var(--sk-violet);fill:rgba(154,92,255,.12)}
.sk-story .sk-glyphs.sk-hostile .sk-g path{stroke:#ff3355}
.sk-story .sk-glyphs.sk-calm .sk-g{animation-duration:2.8s}
@keyframes sk-glyph{0%,100%{opacity:.35;transform:scale(.92);filter:none}45%{opacity:1;transform:scale(1.06);filter:drop-shadow(0 0 6px #ff5a8a)}}
@keyframes sk-breathe{0%,100%{opacity:.6;transform:scale(.98)}50%{opacity:.95;transform:scale(1.02)}}
/* dialogue box */
.sk-story .sk-box{position:absolute;left:50%;bottom:max(12px,2.5cqh);transform:translateX(-50%);width:min(calc(100% - 20px),max(900px,52cqw));min-height:112px;
 background:var(--sk-panel);border:1px solid var(--sk-line);border-left:4px solid var(--sk-accent,var(--sk-gold));border-radius:10px;padding:12px 16px 14px;z-index:5;
 box-shadow:0 8px 30px rgba(0,0,0,.45);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.sk-story .sk-name{font:700 clamp(13px,.75cqw,18px)/1.2 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--sk-accent,var(--sk-gold));min-height:16px;margin-bottom:6px;display:flex;gap:8px;align-items:center}
.sk-story .sk-name .sk-via{font:600 10px/1 ui-monospace,Menlo,monospace;color:var(--sk-muted);border:1px solid var(--sk-line);border-radius:999px;padding:3px 7px;letter-spacing:.12em}
.sk-story .sk-text{font-size:clamp(15px,max(min(2.2cqw + 9px,19px),1.3cqw),26px);line-height:1.5;min-height:3em;white-space:pre-wrap;overflow-wrap:anywhere}
.sk-story .sk-box.sk-narration{border-left-color:var(--sk-muted);background:rgba(7,11,22,.86)}
.sk-story .sk-box.sk-narration .sk-text{font-style:italic;color:#c8d1e6}
.sk-story .sk-box.sk-glyphline .sk-text{font-style:italic;color:#ffc2d6;letter-spacing:.02em}
.sk-story .sk-next{position:absolute;right:14px;bottom:8px;color:var(--sk-gold);opacity:0;font-size:14px}
.sk-story .sk-box.sk-done .sk-next{opacity:1;animation:sk-nudge 1s ease-in-out infinite}
@keyframes sk-nudge{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}
/* choice */
.sk-story .sk-choice{position:absolute;inset:0;z-index:7;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:10px;padding:16px 12px max(14px,3cqh);
 background:linear-gradient(to top,rgba(7,11,22,.95),rgba(7,11,22,.55) 60%,rgba(7,11,22,.1));cursor:default}
.sk-story .sk-choice[hidden]{display:none}
.sk-story.sk-choosing .sk-box{opacity:0;visibility:hidden}
.sk-story .sk-prompt{font:700 clamp(15px,.85cqw,20px)/1.3 system-ui,sans-serif;letter-spacing:.06em;color:var(--sk-gold);text-transform:uppercase;text-align:center;margin-bottom:4px}
.sk-story .sk-opt{width:min(100%,max(560px,34cqw));min-height:52px;font-size:clamp(15px,1.05cqw,22px);border:1px solid var(--sk-line);background:rgba(16,24,48,.96);color:var(--sk-text);border-radius:10px;padding:10px 16px;
 font-family:inherit;line-height:1.35;text-align:left;cursor:pointer;display:flex;align-items:center;gap:10px}
.sk-story .sk-opt::before{content:"";width:12px;height:14px;flex:none;background:var(--sk-gold);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
.sk-story .sk-opt:hover,.sk-story .sk-opt:focus-visible{border-color:var(--sk-gold);outline:none;box-shadow:inset 0 0 0 1px var(--sk-gold)}
.sk-story .sk-opt:disabled{cursor:not-allowed;color:var(--sk-muted);background:rgba(12,19,38,.7)}
.sk-story .sk-opt:disabled>span{text-decoration:line-through;text-decoration-color:rgba(255,122,122,.6)}
.sk-story .sk-opt:disabled::before{background:#ff7a7a}
.sk-story .sk-opt small{margin-left:auto;font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;color:#ff7a7a;text-decoration:none;display:inline-block}
/* chrome */
.sk-story .sk-skip{position:absolute;top:max(8px,1.5cqh);right:max(8px,1.5cqw);z-index:8;min-height:40px;min-width:64px;padding:6px 14px;border-radius:8px;border:1px solid var(--sk-line);
 background:rgba(16,24,48,.85);color:var(--sk-muted);font:600 clamp(13px,.7cqw,17px)/1 system-ui,sans-serif;letter-spacing:.08em;cursor:pointer}
.sk-story .sk-skip:hover,.sk-story .sk-skip:focus-visible{color:var(--sk-gold);border-color:var(--sk-gold);outline:none}
.sk-story .sk-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
/* effects */
.sk-story .sk-fx{position:absolute;inset:0;pointer-events:none;z-index:6;opacity:0;background:#fff}
.sk-story.sk-fx-flash .sk-fx{animation:sk-flash .38s ease-out}
.sk-story.sk-fx-fade .sk-fx{background:#000;opacity:1;transition:opacity .8s ease}
.sk-story.sk-fx-shake .sk-stage,.sk-story.sk-fx-shake .sk-cast,.sk-story.sk-fx-shake .sk-ship{animation:sk-shake .45s linear}
.sk-story.sk-fx-glitch .sk-stage,.sk-story.sk-fx-glitch .sk-cast{animation:sk-glitch .6s steps(2,end)}
.sk-story.sk-fx-glitch .sk-fx{background:linear-gradient(transparent 0 40%,rgba(255,90,138,.25) 40% 43%,transparent 43% 70%,rgba(92,200,255,.25) 70% 72%,transparent 72%);animation:sk-glitchbar .6s steps(3,end)}
@keyframes sk-flash{0%{opacity:0}15%{opacity:.85}100%{opacity:0}}
@keyframes sk-shake{0%,100%{transform:translate(0,0)}15%{transform:translate(-1.2%,.6%)}30%{transform:translate(1%,-.8%)}45%{transform:translate(-.8%,-.4%)}60%{transform:translate(.8%,.6%)}80%{transform:translate(-.4%,.2%)}}
@keyframes sk-glitch{0%{transform:translateX(0);filter:none}25%{transform:translateX(-1.5%);filter:hue-rotate(60deg) saturate(1.6)}50%{transform:translateX(1.2%);filter:hue-rotate(-40deg) contrast(1.4)}75%{transform:translateX(-.6%);filter:none}100%{transform:none;filter:none}}
@keyframes sk-glitchbar{0%{opacity:1;transform:translateY(-20%)}50%{opacity:1;transform:translateY(25%)}100%{opacity:0;transform:translateY(0)}}
/* barks */
.sk-story.sk-barks{position:absolute;top:max(8px,1.5vh);right:8px;left:auto;z-index:50;display:flex;flex-direction:column;gap:8px;align-items:flex-end;pointer-events:none;width:min(360px,calc(100% - 16px))}
.sk-story .sk-bark{display:flex;gap:10px;align-items:flex-start;width:100%;background:rgba(12,19,38,.95);border:1px solid var(--sk-line);border-left:3px solid var(--sk-accent,var(--sk-gold));
 border-radius:10px;padding:8px 12px 8px 8px;box-shadow:0 6px 24px rgba(0,0,0,.45);opacity:0;transform:translateX(16px);transition:opacity .25s ease,transform .25s ease}
.sk-story .sk-bark.sk-shown{opacity:1;transform:none}
.sk-story .sk-bark .sk-face{width:52px;height:52px;flex:none;border-radius:8px;overflow:hidden;background:radial-gradient(circle at 50% 30%,#1d2b52,#0b1124);border:1px solid var(--sk-line)}
.sk-story .sk-bark .sk-face img{width:100%;height:160%;object-fit:cover;object-position:50% 8%;display:block}
.sk-story .sk-bark .sk-who{font:700 11px/1.2 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--sk-accent,var(--sk-gold));margin:2px 0 3px}
.sk-story .sk-bark .sk-say{font-size:14px;line-height:1.35}
.sk-story .sk-bark .sk-say p{margin:0}
@media (prefers-reduced-motion: reduce){
 .sk-story .sk-bg,.sk-story .sk-por,.sk-story .sk-ship,.sk-story .sk-comms,.sk-story .sk-bark{transition:none}
 .sk-story .sk-ship img,.sk-story .sk-glyphs .sk-g,.sk-story .sk-glyphs .sk-weave,.sk-story .sk-comms .sk-screen::after,.sk-story .sk-box.sk-done .sk-next,.sk-story .sk-comms.sk-mimic .sk-screen img{animation:none}
 .sk-story.sk-fx-shake .sk-stage,.sk-story.sk-fx-shake .sk-cast,.sk-story.sk-fx-shake .sk-ship,.sk-story.sk-fx-glitch .sk-stage,.sk-story.sk-fx-glitch .sk-cast{animation:none}
 .sk-story.sk-fx-flash .sk-fx{animation:sk-flash-soft .3s linear}
 .sk-story.sk-fx-glitch .sk-fx{animation:sk-flash-soft .3s linear;background:rgba(255,90,138,.3)}
 @keyframes sk-flash-soft{0%,100%{opacity:0}50%{opacity:.25}}
}
`;
export function injectCss() {
  if (document.getElementById('sk-story-css')) return;
  const el = document.createElement('style');
  el.id = 'sk-story-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}
