// Browser test of the Story campaign on the play screen (needs PR #2's ui/campaign.js, i.e. a
// merge of campaign-v1 and campaign-engine, served over http, and Playwright).
//
//   (cd <merged checkout> && python3 -m http.server 8765) &
//   NODE_PATH=<dir with node_modules/playwright> node campaign/tools/browser_story.cjs http://localhost:8765/play.html [--ch1] [--fix-fork] [--graft-only]
//
// Default: from a fresh save, opens "Story campaign", plays every chapter from the map (the
// player's side is driven by campaignMove through window.__shatkon.act; scene cards are
// clicked), and reports scenes, objectives, saved progress and console errors.
// --fix-fork: clears progress.choices.fork when a node fails to open (works around the UI bug
// where the fork choice locks ch5). --graft-only: starts ch4A from a prepared save and presses
// the Graft button. --guide-ui: GUIDE_PROPOSAL.md §11 tests 10-11 on ch1's move guide, at
// desktop and phone size (banner hidden while a guide is up; tapping the glowing hex or the
// reticle only previews). Screenshots go to $SHOTS (default /tmp).
const { chromium } = require('playwright');
const SHOTS = process.env.SHOTS || '/tmp';
async function open(file, vp, {fresh=true, help=false, seat=null}={}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: vp.width<500?2:1, hasTouch: vp.width<500 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type()==='error' || m.type()==='warning') errors.push(m.type()+': '+m.text()); });
  page.on('pageerror', e => errors.push('pageerror: '+e.message));
  page.on('dialog', d => d.accept());
  await page.goto(/^https?:/.test(file)?file:'file://'+file);
  if (fresh) { await page.evaluate(([help,seat])=>{localStorage.clear(); if(!help) localStorage.setItem('shatkon.help','1'); if(seat!==null) localStorage.setItem('shatkon.seat',seat);},[help,seat]); await page.reload(); }
  await page.waitForFunction(()=>window.__shatkon && window.__shatkon.game);
  await page.waitForTimeout(150); if (await page.$('#curtain:not([hidden]) button')) await page.click('#curtain button');
  return { browser, page, errors };
}
const URL = process.argv[2] || 'http://localhost:8765/play.html';
const ONLY_CH1 = process.argv.includes('--ch1');
async function campaignRun() {
  const { browser, page, errors } = await open(URL, { width: 1280, height: 860 });
  const log = (...a) => console.log(...a);
  await page.evaluate(async () => { const m = await import('/engine/index.js'); window.__E = m; });
  const scenes = [], barks = [], objectives = new Set(); let graftSeen = false;
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') log('  console', m.type(), m.text()); });
  const openMap = async () => {
    await page.selectOption('#seat select', 'story');
    await page.waitForSelector('#story .cm', { timeout: 10000 });
  };
  // story/player.js (story pack v2) plays scenes in a .story-stage overlay: pick a choice (the
  // fork: Ashfall) or press Skip. Returns true if it acted. The text fallback (.story-card) is
  // handled where it was.
  const playerStep = async () => {
    const opts = await page.$$('.story-stage .sk-opt:not([disabled])');
    if (opts.length) {
      let pick = opts[0];
      for (const o of opts) if ((await o.getAttribute('data-option')) === 'ch4a') pick = o;
      scenes.push('choice:' + (await pick.getAttribute('data-option')));
      await pick.click(); return true;
    }
    const skip = await page.$('.story-stage .sk-skip');
    if (skip) { scenes.push('scene'); await skip.click().catch(() => {}); return true; }
    if (await page.$('.story-stage .sk-box')) { await page.click('.story-stage .sk-box').catch(() => {}); return true; }
    return false;
  };
  const drain = async () => { for (let i = 0; i < 200; i++) { await page.waitForTimeout(60); if (!(await playerStep()) && !(await page.$('.story-stage'))) return; } };
  await openMap();
  const nodes = await page.$$eval('#story .cm-node', (bs) => bs.map((b) => b.className + ' | ' + b.getAttribute('aria-label')));
  log('map nodes:', JSON.stringify(nodes, null, 1));
  await page.screenshot({ path: SHOTS + '/story-map.png' });
  const order = ONLY_CH1 ? ['First Contact'] : ['First Contact', 'Quiet Water', 'The Splitting', 'Ashfall', 'The Bloom'];
  for (const title of order) {
    let node = await page.$(`#story .cm-node.open:has-text("${title}")`);
    if (!node && process.argv.includes('--fix-fork')) {
      // UI bug workaround (test only): the fork choice greys out every other open node, ch5 too
      log('WORKAROUND: clearing progress.choices.fork so', title, 'opens');
      await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('shatkon.story')); delete p.choices.fork; localStorage.setItem('shatkon.story', JSON.stringify(p)); });
      await drain(); await page.click('#story .cm-top button'); await openMap();
      node = await page.$(`#story .cm-node.open:has-text("${title}")`);
    }
    if (!node) { log('NO OPEN NODE', title, await page.$$eval('#story .cm-node', (bs) => bs.map((b) => b.className + ' ' + b.textContent))); break; }
    await node.click();
    let steps = 0, last = '';
    while (steps++ < 4000) {
      await page.waitForTimeout(40);
      if (await playerStep()) continue;
      const card = await page.$('.story-stage .story-card');
      if (card) {
        const id = (await card.$eval('.muted', (e) => e.textContent)).replace('Scene · ', '');
        scenes.push(id);
        if (id === 'ch4_fork') await page.screenshot({ path: SHOTS + '/story-fork.png' });
        if (scenes.length === 1) await page.screenshot({ path: SHOTS + '/story-intro.png' });
        await card.$eval('button:not([disabled])', (b) => b.click());
        continue;
      }
      const st = await page.evaluate(() => { const g = window.__shatkon.game; return g && { phase: g.phase, round: g.round, seat: g.order[g.turn], story: !!g.rules.campaign, id: g.rules.campaign && g.rules.campaign.id, result: g.script && g.script.result, obj: g.script && g.script.objective }; });
      if (!st || !st.story) { if (await page.$('#story .cm')) { /* still on the map (e.g. after the fork) */ const n2 = await page.$(`#story .cm-node.open:has-text("${title}")`); if (n2) await n2.click(); } continue; }
      if (st.obj) objectives.add(st.id + ': ' + st.obj);
      if (st.phase === 'over') {
        await page.waitForTimeout(300);
        if (await page.$('.story-stage')) continue;
        log(`${st.id} over: ${st.result} in round ${st.round}`);
        if (st.id === 'ch1') await page.screenshot({ path: SHOTS + '/story-ch1-over.png' });
        if (st.id === 'ch5') await page.screenshot({ path: SHOTS + '/story-ch5-over.png' });
        break;
      }
      if (st.seat === 0) {
        // try the Graft button when it shows (ch4A), else let campaignMove decide
        if (st.id === 'ch4a' && !graftSeen) graftSeen = await page.evaluate(() => { const v = window.__shatkon.game; return !!(v.script.unlocked.graft); }) && await (async () => { const has = await page.evaluate(() => { const E = window.__E, g = window.__shatkon.game, k = g.ships.find((s) => s.name === 'kestrel' && !s.dead), t = g.ships.find((s) => s.name === 'tern' && !s.dead); return !!(k && t && E.gap(k, t) === 1) && k.id; }); if (!has) return false; await page.evaluate((id) => window.__shatkon.select(id), has); await page.waitForTimeout(100); const btn = await page.$('#tools button:has-text("Graft tern")'); log('  Graft button shown with Kestrel selected and Tern touching:', !!btn); if (btn) { await page.screenshot({ path: SHOTS + '/story-graft-button.png' }); await btn.click(); await page.waitForTimeout(200); log('  grafted by the button:', await page.evaluate(() => !!window.__shatkon.game.script.flags['grafted:kestrel+tern'])); } return true; })();
        const g = await page.evaluate(() => { const E = window.__E, g = window.__shatkon.game; if (g.script.unlocked.graft) { const k = g.ships.find((s) => s.name === 'kestrel' && !s.dead), t = g.ships.find((s) => s.name === 'tern' && !s.dead); if (k && t && E.gap(k, t) === 1) return { type: 'graft', ship: k.id, with: t.id }; } return null; });
        await page.evaluate((ga) => { const E = window.__E, g = window.__shatkon.game; let a = ga || E.campaignMove(g, 0); const r = E.attempt(g, a); if (!r.ok) a = { type: 'end' }; window.__shatkon.act(a); }, g);
        if (st.round + ':' + st.seat !== last) { last = st.round + ':' + st.seat; if (st.id === 'ch1' && st.round === 2) await page.screenshot({ path: SHOTS + '/story-ch1-r2.png' }); }
      }
    }
    const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('shatkon.story') || 'null'));
    log('  saved progress: completed', JSON.stringify(prog && prog.completed), 'roster', JSON.stringify(prog && prog.roster.map((r) => r.id + (r.hull ? '(hull ' + r.hull.length + ')' : ''))), 'choices', JSON.stringify(prog && prog.choices));
    await drain();
    const back = await page.$('button:has-text("Campaign map")');
    if (back) await back.click(); else await openMap();
    await page.waitForSelector('#story .cm', { timeout: 10000 });
  }
  await page.screenshot({ path: SHOTS + '/story-map-end.png' });
  log('map at the end:', JSON.stringify(await page.$$eval('#story .cm-node', (bs) => bs.map((b) => b.className.replace('cm-node ', '') + ' ' + b.textContent))));
  log('scenes shown:', scenes.join(' '));
  log('objectives:', [...objectives].join(' || '));
  log('console errors/warnings:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
}

async function graftOnly() {
  const { browser, page, errors } = await open(URL, { width: 1280, height: 860 });
  await page.evaluate(() => localStorage.setItem('shatkon.story', JSON.stringify({ campaign: 'the_weave', completed: ['ch1', 'ch2', 'ch3'], choices: { fork: 'ch4a' }, flags: {},
    capabilities: ['core', 'engine', 'sensor', 'laser', 'armour', 'coupling', 'launcher', 'magazine', 'missile', 'mine', 'shield', 'point_defence', 'comms', 'seeker_drone', 'docking'],
    roster: [{ id: 'kestrel' }, { id: 'sparrow' }, { id: 'halcyon' }, { id: 'tern' }] })));
  await page.selectOption('#seat select', 'story');
  await page.waitForSelector('#story .cm');
  await page.click('#story .cm-node.open:has-text("Ashfall")');
  for (let i = 0; i < 2000; i++) {
    await page.waitForTimeout(40);
    const card = await page.$('.story-stage .story-card'); if (card) { await card.$eval('button:not([disabled])', (b) => b.click()); continue; }
    const st = await page.evaluate(() => { const g = window.__shatkon.game; return { seat: g.order[g.turn], phase: g.phase, round: g.round, un: !!(g.script && g.script.unlocked.graft) }; });
    if (st.phase !== 'play') { console.log('game over before the test'); break; }
    if (st.seat !== 0) continue;
    if (st.un) {
      const kid = await page.evaluate(() => window.__shatkon.game.ships.find((s) => s.name === 'kestrel').id);
      await page.evaluate((id) => window.__shatkon.select(id), kid);
      await page.waitForTimeout(150);
      const btn = await page.$('#tools button:has-text("Graft")');
      console.log('round', st.round, 'graft unlocked; Graft button:', btn ? await btn.textContent() : 'MISSING');
      if (btn) { await page.screenshot({ path: SHOTS + '/story-graft-button.png' }); await btn.click(); await page.waitForTimeout(500);
        for (let j = 0; j < 20; j++) { const c = await page.$('.story-stage .story-card'); if (!c) break; console.log('  scene', await c.$eval('.muted', (e) => e.textContent)); await c.$eval('button', (b) => b.click()); await page.waitForTimeout(200); }
        console.log('grafted flag:', await page.evaluate(() => !!window.__shatkon.game.script.flags['grafted:kestrel+tern']), 'result:', await page.evaluate(() => window.__shatkon.game.script.result)); }
      break;
    }
    await page.evaluate(() => window.__shatkon.act({ type: 'end' }));   // hold still: Kestrel and Tern start touching
  }
  console.log('console errors:', errors.filter((e) => !/Failed to load resource/.test(e)).join('\n') || 'none (only story/ 404s)');
  await browser.close();
}
async function guideUi(vp, tag) {
  const { browser, page, errors } = await open(URL, vp);
  await page.evaluate(async () => { const m = await import('/engine/index.js'); window.__E = m; });
  await page.selectOption('#seat select', 'story');
  await page.waitForSelector('#story .cm', { timeout: 10000 });
  await page.click('#story .cm-node.open:has-text("First Contact")');
  const out = { vp: tag };
  const skipScenes = async () => { for (let i = 0; i < 50; i++) { const b = await page.$('.story-stage .sk-skip, .story-stage .story-card button:not([disabled])'); if (!b) return; await b.click().catch(() => {}); await page.waitForTimeout(80); } };
  const guideState = () => page.evaluate(() => { const g = window.__shatkon.game, v = window.__E.guideView(g, 0); const k = g.ships.find((s) => s.name === 'kestrel' && !s.dead);
    return { phase: g.phase, seat: g.order[g.turn], v: v && { step: v.step, label: v.label, best: v.best, reticle: v.reticle, dest: v.dest.length }, kpos: k && k.pos, obj: g.script.objective || null }; });
  const tapEl = async (sel) => { const el = await page.$(sel); if (!el) return false; const b = await el.boundingBox(); if (!b) return false; const x = b.x + b.width / 2, y = b.y + b.height / 2; if (vp.width < 500) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); await page.waitForTimeout(250); return true; };
  const hint = () => page.evaluate(() => document.body.innerText);
  let stepSeen = {};
  for (let n = 0; n < 3000; n++) {
    await page.waitForTimeout(30);
    if (await page.$('.story-stage')) { await skipScenes(); continue; }
    const st = await guideState();
    if (st.phase !== 'play') { out.over = true; break; }
    if (st.v && process.env.DBG) console.log('  guide up', st.seat, JSON.stringify(st.v));
    if (st.seat === 0 && st.v && !stepSeen[st.v.step]) {
      for (let w = 0; w < 40 && (await page.evaluate(() => window.__shatkon.camBusy)); w++) await page.waitForTimeout(50);
      stepSeen[st.v.step] = true;
      await page.waitForTimeout(400);
      const r = { step: st.v.step, label: st.v.label, overlay: await page.$$eval('svg g.guide', (l) => l.length), banner: await page.$$eval('.line.objective', (l) => l.length), objectiveSet: st.obj };
      await page.screenshot({ path: `${SHOTS}/guide-${tag}-step${st.v.step}.png` });
      if (st.v.best) { const ok = await tapEl('svg g.guide path[fill-opacity="0.28"]'); const t = await hint(); const after = await guideState();
        r.tapDest = ok && /dashed outline shows where/.test(t) && JSON.stringify(after.kpos) === JSON.stringify(st.kpos) ? 'preview only (ship not moved)' : 'NO PREVIEW';
        await page.screenshot({ path: `${SHOTS}/guide-${tag}-step${st.v.step}-tapped.png` }); }
      if (st.v.reticle) { const ships = () => page.evaluate(() => JSON.stringify(window.__shatkon.game.ships)); const b0 = await ships(); const ok = await tapEl('svg g.guide circle[stroke-width="1.3"]'); const t = await hint(); const same = b0 === (await ships());
        r.tapReticle = ok && /Fire mode for/.test(t) ? (same ? 'fire mode, nothing fired' : 'FIRE MODE BUT SHIPS CHANGED') : 'NO FIRE MODE'; }
      (out.steps = out.steps || []).push(r);
      if (stepSeen[2]) break;
    }
    if (st.seat === 0) await page.evaluate(() => { const E = window.__E, g = window.__shatkon.game, v = E.guideView(g, 0); let a = null;
      if (v && v.step === 1 && v.turnEnd) { const go = E.reach(g, v.ship).find((x) => x.at[0] === v.turnEnd[0] && x.at[1] === v.turnEnd[1]); if (go) a = { type: 'move', ship: v.ship, path: go.path }; }
      if (a && !E.attempt(g, a).ok) a = null;
      a = a || E.campaignMove(g, 0); if (!E.attempt(g, a).ok) a = { type: 'end' }; window.__shatkon.act(a); });
  }
  console.log('guide-ui', JSON.stringify(out));
  console.log('  console errors:', errors.filter((e) => !/Failed to load resource/.test(e)).join('\n') || 'none');
  await browser.close();
}
(process.argv.includes('--guide-ui') ? (async () => { await guideUi({ width: 1280, height: 860 }, 'desktop'); await guideUi({ width: 390, height: 844 }, 'phone'); })()
  : process.argv.includes('--graft-only') ? graftOnly() : campaignRun()).catch((e) => { console.error('FAILED', e); process.exit(1); });
