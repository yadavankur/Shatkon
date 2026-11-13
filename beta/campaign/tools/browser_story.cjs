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
// the Graft button. Screenshots go to $SHOTS (default /tmp).
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
      await page.click('#story .cm-top button'); await openMap();
      node = await page.$(`#story .cm-node.open:has-text("${title}")`);
    }
    if (!node) { log('NO OPEN NODE', title, await page.$$eval('#story .cm-node', (bs) => bs.map((b) => b.className + ' ' + b.textContent))); break; }
    await node.click();
    let steps = 0, last = '';
    while (steps++ < 4000) {
      await page.waitForTimeout(40);
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
        if (await page.$('.story-stage .story-card')) continue;
        log(`${st.id} over: ${st.result} in round ${st.round}`);
        if (st.id === 'ch1') await page.screenshot({ path: SHOTS + '/story-ch1-over.png' });
        if (st.id === 'ch5') await page.screenshot({ path: SHOTS + '/story-ch5-over.png' });
        break;
      }
      if (st.seat === 0) {
        // try the Graft button when it shows (ch4A), else let campaignMove decide
        if (st.id === 'ch4a' && !graftSeen) graftSeen = await page.evaluate(() => { const v = window.__shatkon.game; return !!(v.script.unlocked.graft); }) && await (async () => { const has = await page.evaluate(() => { const E = window.__E, g = window.__shatkon.game, k = g.ships.find((s) => s.name === 'kestrel' && !s.dead), t = g.ships.find((s) => s.name === 'tern' && !s.dead); return !!(k && t && E.gap(k, t) === 1) && k.id; }); if (!has) return false; const chips = await page.$$('#fleet button'); for (const b of chips) if ((await b.textContent()).includes(has + ' ')) { await b.click(); break; } await page.waitForTimeout(100); const btn = await page.$('#tools button:has-text("Graft tern")'); log('  Graft button shown with Kestrel selected and Tern touching:', !!btn); if (btn) { await page.screenshot({ path: SHOTS + '/story-graft-button.png' }); await btn.click(); await page.waitForTimeout(200); log('  grafted by the button:', await page.evaluate(() => !!window.__shatkon.game.script.flags['grafted:kestrel+tern'])); } return true; })();
        const g = await page.evaluate(() => { const E = window.__E, g = window.__shatkon.game; if (g.script.unlocked.graft) { const k = g.ships.find((s) => s.name === 'kestrel' && !s.dead), t = g.ships.find((s) => s.name === 'tern' && !s.dead); if (k && t && E.gap(k, t) === 1) return { type: 'graft', ship: k.id, with: t.id }; } return null; });
        await page.evaluate((ga) => { const E = window.__E, g = window.__shatkon.game; let a = ga || E.campaignMove(g, 0); const r = E.attempt(g, a); if (!r.ok) a = { type: 'end' }; window.__shatkon.act(a); }, g);
        if (st.round + ':' + st.seat !== last) { last = st.round + ':' + st.seat; if (st.id === 'ch1' && st.round === 2) await page.screenshot({ path: SHOTS + '/story-ch1-r2.png' }); }
      }
    }
    const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('shatkon.story') || 'null'));
    log('  saved progress: completed', JSON.stringify(prog && prog.completed), 'roster', JSON.stringify(prog && prog.roster.map((r) => r.id + (r.hull ? '(hull ' + r.hull.length + ')' : ''))), 'choices', JSON.stringify(prog && prog.choices));
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
      for (const b of await page.$$('#fleet button')) if ((await b.textContent()).includes(kid + ' ')) { await b.click(); break; }
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
(process.argv.includes('--graft-only') ? graftOnly() : campaignRun()).catch((e) => { console.error('FAILED', e); process.exit(1); });
