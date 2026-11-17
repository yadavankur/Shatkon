// The SHATKON launch splash: the logo draws itself, then the wordmark, over a dark star field, then the
// splash fades away. It is the same animation as the opening of the Field Manual (docs/), sped up to fit
// about 3 seconds. The drawing comes from the manual's own geometry: tools/make-splash.mjs writes it into
// the ART block below.
//
// How it is used: index.html carries a tiny inline snippet that decides whether to show the splash
// (once per browser session, never when the page was opened with a game or a deep link in the address).
// If so it puts a dark full-screen <div id="splash"> on the page straight away, so the page underneath
// never flashes, and loads this file, which fills that box in and runs the show.
//   - tap, click or any key skips it
//   - "reduce motion" setting: the finished logo is shown, still, for under a second
//   - add ?splash to the address to see it again
(function () {
  'use strict';
/* ART:BEGIN (written by tools/make-splash.mjs, do not edit by hand) */
const MARK = "<defs><linearGradient id=\"spG\" x1=\"-80\" y1=\"-100\" x2=\"80\" y2=\"100\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#cfe8ff\"/><stop offset=\".5\" stop-color=\"#7fd8f0\"/><stop offset=\"1\" stop-color=\"#2fe0b0\"/></linearGradient><filter id=\"spBlur\" x=\"-40%\" y=\"-40%\" width=\"180%\" height=\"180%\"><feGaussianBlur stdDeviation=\"7\"/></filter><filter id=\"spGlow\" x=\"-30%\" y=\"-30%\" width=\"160%\" height=\"160%\"><feGaussianBlur stdDeviation=\"2.2\" result=\"b\"/><feMerge><feMergeNode in=\"b\"/><feMergeNode in=\"SourceGraphic\"/></feMerge></filter><radialGradient id=\"spN\"><stop offset=\"0\" stop-color=\"#fff\"/><stop offset=\".35\" stop-color=\"#5ff7ff\"/><stop offset=\"1\" stop-color=\"#5ff7ff\" stop-opacity=\"0\"/></radialGradient></defs><path class=\"sp-glow\" d=\"M0 -100L86.6 -50M86.6 -50L86.6 50M86.6 50L0 100M0 100L-86.6 50M-86.6 50L-86.6 -50M-86.6 -50L0 -100M0 -40L51.96 -70M0 -40L-51.96 -70M34.64 20L34.64 80M34.64 20L86.6 -10M-34.64 20L-86.6 -10M-34.64 20L-34.64 80M0 -40L0 40M34.64 -20L-34.64 20M34.64 20L-34.64 -20M34.64 -60L34.64 -20M34.64 -20L69.28 0M34.64 60L0 40M0 40L-34.64 60M-69.28 0L-34.64 -20M-34.64 -20L-34.64 -60\" fill=\"none\" stroke=\"#7fd8f0\" stroke-width=\"9\" filter=\"url(#spBlur)\"/><g fill=\"none\" stroke=\"url(#spG)\" stroke-width=\"3.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" filter=\"url(#spGlow)\"><polygon class=\"sp-l sp-outer\" pathLength=\"1\" points=\"0,-100 86.6,-50 86.6,50 0,100 -86.6,50 -86.6,-50\"/><g class=\"sp-bloom\"><polygon class=\"sp-l sp-star\" pathLength=\"1\" points=\"0,0 0,-40 34.64,-60 34.64,-20\"/><polygon class=\"sp-l sp-star\" pathLength=\"1\" points=\"0,0 34.64,-20 69.28,0 34.64,20\"/><polygon class=\"sp-l sp-star\" pathLength=\"1\" points=\"0,0 34.64,20 34.64,60 0,40\"/><polygon class=\"sp-l sp-star\" pathLength=\"1\" points=\"0,0 0,40 -34.64,60 -34.64,20\"/><polygon class=\"sp-l sp-star\" pathLength=\"1\" points=\"0,0 -34.64,20 -69.28,0 -34.64,-20\"/><polygon class=\"sp-l sp-star\" pathLength=\"1\" points=\"0,0 -34.64,-20 -34.64,-60 0,-40\"/></g><polygon class=\"sp-l sp-hex\" pathLength=\"1\" points=\"51.96,-70 86.6,-50 86.6,-10 69.28,0 34.64,-20 34.64,-60\"/><polygon class=\"sp-l sp-hex\" pathLength=\"1\" points=\"34.64,80 0,100 -34.64,80 -34.64,60 0,40 34.64,60\"/><polygon class=\"sp-l sp-hex\" pathLength=\"1\" points=\"-86.6,-10 -86.6,-50 -51.96,-70 -34.64,-60 -34.64,-20 -69.28,0\"/></g><g fill=\"none\" stroke=\"#fff\" stroke-width=\"3.6\" stroke-linecap=\"round\"><polygon class=\"sp-shim\" pathLength=\"1\" points=\"0,0 0,-40 34.64,-60 34.64,-20\"/><polygon class=\"sp-shim\" pathLength=\"1\" points=\"0,0 34.64,-20 69.28,0 34.64,20\"/><polygon class=\"sp-shim\" pathLength=\"1\" points=\"0,0 34.64,20 34.64,60 0,40\"/><polygon class=\"sp-shim\" pathLength=\"1\" points=\"0,0 0,40 -34.64,60 -34.64,20\"/><polygon class=\"sp-shim\" pathLength=\"1\" points=\"0,0 -34.64,20 -69.28,0 -34.64,-20\"/><polygon class=\"sp-shim\" pathLength=\"1\" points=\"0,0 -34.64,-20 -34.64,-60 0,-40\"/></g><circle class=\"sp-node\" r=\"11\" fill=\"url(#spN)\"/>";
const WORD = "<defs><linearGradient id=\"spW\" x1=\"0\" y1=\"0\" x2=\"353.76319313961056\" y2=\"0\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#cfe8ff\"/><stop offset=\".55\" stop-color=\"#7fd8f0\"/><stop offset=\"1\" stop-color=\"#2fe0b0\"/></linearGradient></defs><path class=\"sp-wl\" pathLength=\"1\" d=\"M34.64 -10L17.32 -20L0 -10L34.64 10L17.32 20L0 10M55.64 -20L55.64 20M83.64 -20L83.64 20M55.64 0L83.64 0M104.64 20L104.64 -10L121.96 -20L139.28 -10L139.28 20M104.64 3L139.28 3M160.28 -20L194.92 -20M177.6 -20L177.6 20M215.92 -20L215.92 20M250.56 -20L215.92 0L250.56 20M290.62 -22L309.67 -11L309.67 11L290.62 22L271.56 11L271.56 -11L290.62 -22M330.67 20L330.67 -20L353.76 20L353.76 -20\" fill=\"none\" stroke=\"url(#spW)\" stroke-width=\"3\" stroke-linecap=\"square\" stroke-linejoin=\"miter\"/><circle class=\"sp-wn\" cx=\"215.9\" cy=\"0.0\" r=\"3\" fill=\"#5ff7ff\"/><circle class=\"sp-wn\" cx=\"290.6\" cy=\"0.0\" r=\"3\" fill=\"#5ff7ff\"/>";
const WORD_VIEWBOX = "-6 -28 365.8 56";
/* ART:END */

  const HOLD_MS = 2900;       // from first frame to the start of the fade (the drawing itself ends at ~2.5 s)
  const FADE_MS = 450;
  const STILL_MS = 800;       // reduce-motion: how long the finished logo shows
  const FAST_MS = 220;        // fade after a tap

  // Timings are the manual's, multiplied by --k (0.6) so the whole drawing fits in about 2.5 seconds.
  const CSS = `
#splash.sp-root{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:radial-gradient(900px 600px at 80% -10%,#0a2a44 0,transparent 60%),radial-gradient(700px 500px at -10% 40%,#06323a 0,transparent 55%),#040812;
  display:flex;align-items:center;justify-content:center;opacity:1;transition:opacity ${FADE_MS}ms ease;cursor:pointer;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;--k:.6}
#splash.sp-out{opacity:0}
#splash.sp-out.sp-fast{transition-duration:${FAST_MS}ms}
#splash .sp-stars{position:absolute;inset:0;pointer-events:none}
#splash .sp-stars i{position:absolute;left:0;top:0;width:1px;height:1px;border-radius:50%;background:transparent}
#splash .sp-stars .sp-tw{animation:sp-twinkle 3.2s ease-in-out infinite alternate}
#splash .sp-logo{position:relative;display:flex;flex-direction:column;align-items:center;gap:clamp(10px,3.4vmin,28px);padding:0 4vmin}
#splash .sp-mark{width:clamp(96px,52vmin,380px);height:auto;overflow:visible;display:block}
#splash .sp-word{width:clamp(200px,86vmin,640px);height:auto;display:block}
#splash .sp-hint{position:absolute;left:0;right:0;bottom:max(14px,env(safe-area-inset-bottom));text-align:center;color:#8ea3bd;font:12px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.2em;text-transform:uppercase;opacity:0;animation:sp-fade .8s ease 1.2s forwards;pointer-events:none}
#splash .sp-l{stroke-dasharray:1;stroke-dashoffset:1;animation:sp-draw calc(1.1s*var(--k)) cubic-bezier(.6,.1,.3,1) forwards}
#splash .sp-outer{animation-delay:calc(.2s*var(--k))}
#splash .sp-star{animation-delay:calc(1.25s*var(--k));animation-duration:calc(1.2s*var(--k))}
#splash .sp-hex{animation-delay:calc(2.25s*var(--k));animation-duration:calc(1.3s*var(--k))}
#splash .sp-bloom{transform-origin:0 0;transform:scale(.15) rotate(-60deg);opacity:0;animation:sp-bloom calc(1.3s*var(--k)) cubic-bezier(.2,.8,.2,1) calc(1.2s*var(--k)) forwards}
#splash .sp-node{opacity:0;animation:sp-fade calc(.6s*var(--k)) calc(1.1s*var(--k)) forwards,sp-breath 2.4s ease-in-out calc(3.6s*var(--k)) infinite}
#splash .sp-glow{opacity:0;animation:sp-glowin calc(1s*var(--k)) calc(3.3s*var(--k)) forwards}
#splash .sp-shim{stroke-dasharray:.08 .92;stroke-dashoffset:1;opacity:0;animation:sp-shimmer .9s linear calc(3.8s*var(--k)) forwards}
#splash .sp-wl{stroke-dasharray:1;stroke-dashoffset:1;animation:sp-draw calc(1.4s*var(--k)) ease forwards calc(2.6s*var(--k))}
#splash .sp-wn{opacity:0;animation:sp-fade calc(.6s*var(--k)) calc(3.6s*var(--k)) forwards}
@keyframes sp-draw{to{stroke-dashoffset:0}}
@keyframes sp-bloom{to{transform:none;opacity:1}}
@keyframes sp-fade{to{opacity:1}}
@keyframes sp-glowin{to{opacity:.55}}
@keyframes sp-breath{0%,100%{opacity:1}50%{opacity:.55}}
@keyframes sp-shimmer{0%{opacity:1;stroke-dashoffset:1}85%{opacity:1}100%{opacity:0;stroke-dashoffset:0}}
@keyframes sp-twinkle{from{opacity:.35}to{opacity:1}}
/* reduce motion: the finished logo, no movement */
#splash.sp-rm *,#splash.sp-rm{animation:none!important}
#splash.sp-rm .sp-l,#splash.sp-rm .sp-wl{stroke-dashoffset:0}
#splash.sp-rm .sp-bloom{transform:none;opacity:1}
#splash.sp-rm .sp-node,#splash.sp-rm .sp-wn,#splash.sp-rm .sp-hint{opacity:1}
#splash.sp-rm .sp-glow{opacity:.45}
#splash.sp-rm .sp-shim{opacity:0}
@media (prefers-reduced-motion:reduce){#splash,#splash *{animation:none!important}#splash .sp-l,#splash .sp-wl{stroke-dashoffset:0}#splash .sp-bloom{transform:none;opacity:1}#splash .sp-node,#splash .sp-wn,#splash .sp-hint{opacity:1}#splash .sp-glow{opacity:.45}#splash .sp-shim{opacity:0}#splash.sp-out{transition:opacity ${FADE_MS}ms ease}}
`;

  // A few dozen stars at fixed (made-up but repeatable) places.
  function starField() {
    let s = 20260;                                             // tiny seeded random generator: same sky every time
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const layer = (n, cls, size) => {
      const shadows = [];
      for (let i = 0; i < n; i++) shadows.push(`${(rnd() * 100).toFixed(1)}vw ${(rnd() * 100).toFixed(1)}vh 0 ${size * (0.4 + rnd() * 0.6)}px rgba(${rnd() < .25 ? '127,216,240' : '207,232,255'},${(0.35 + rnd() * 0.55).toFixed(2)})`);
      return `<i class="${cls}" style="box-shadow:${shadows.join(',')}"></i>`;
    };
    return layer(70, '', 1) + layer(22, 'sp-tw', 1.5);
  }

  function show() {
    let root = document.getElementById('splash');
    if (!root) {                                                 // used without the inline snippet: make the box here
      root = document.createElement('div'); root.id = 'splash';
      document.documentElement.appendChild(root);
    }
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    const still = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const touch = !!(window.matchMedia && matchMedia('(hover: none)').matches);
    root.className = 'sp-root' + (still ? ' sp-rm' : '');
    root.setAttribute('role', 'img'); root.setAttribute('aria-label', 'SHATKON');
    root.style.cssText = '';                                     // the snippet's plain dark box gives way to the stylesheet
    root.innerHTML = `<div class="sp-stars" aria-hidden="true">${starField()}</div>`
      + `<div class="sp-logo" aria-hidden="true"><svg class="sp-mark" viewBox="-118 -118 236 236">${MARK}</svg><svg class="sp-word" viewBox="${WORD_VIEWBOX}">${WORD}</svg></div>`
      + `<div class="sp-hint" aria-hidden="true">${touch ? 'Tap' : 'Click'} to skip</div>`;

    let done = false, timer = 0;
    const skip = (ev) => { if (ev && ev.type === 'keydown') { if (ev.ctrlKey || ev.metaKey || ev.altKey) return; ev.preventDefault(); } ev && ev.stopPropagation(); end(true); };
    function end(fast) {
      if (done) return; done = true; clearTimeout(timer);
      document.removeEventListener('pointerdown', skip, true); document.removeEventListener('keydown', skip, true);
      root.classList.add('sp-out'); if (fast) root.classList.add('sp-fast');
      setTimeout(() => { root.remove(); style.remove(); }, (fast ? FAST_MS : FADE_MS) + 40);
    }
    document.addEventListener('pointerdown', skip, true);        // tap or click anywhere...
    document.addEventListener('keydown', skip, true);            // ...or press any key
    timer = setTimeout(() => end(false), still ? STILL_MS : HOLD_MS);
  }

  window.ShatkonSplash = { show, MARK, WORD, WORD_VIEWBOX };
  if (document.getElementById('splash')) show();
})();
