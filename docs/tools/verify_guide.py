"""Open index.html straight from disk (file://) in headless Chrome at 1440 and 390 px.
Fails on console errors, page errors, failed requests, broken nav links, horizontal overflow,
or a combat walkthrough that doesn't reach the end. Saves screenshots to ../screens/."""
import os, sys, time
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(HERE, 'index.html')
SH = os.path.join(HERE, 'screens'); os.makedirs(SH, exist_ok=True)
problems = []
def hook(p, tag):
    p.on('console', lambda m: problems.append(f'[{tag}] console.{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    p.on('pageerror', lambda e: problems.append(f'[{tag}] pageerror: {e}'))
    p.on('requestfailed', lambda r: problems.append(f'[{tag}] requestfailed: {r.url}'))
def scroll_all(p):
    h = p.evaluate('document.body.scrollHeight')
    for y in range(0, h, 600): p.evaluate(f'window.scrollTo(0,{y})'); p.wait_for_timeout(40)
    p.evaluate('window.scrollTo(0,0)')
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
    # ---------- desktop ----------
    p = b.new_page(viewport={'width': 1440, 'height': 900}); hook(p, '1440')
    p.goto(URL); p.wait_for_timeout(1750)
    p.screenshot(path=f'{SH}/00_hero_assembling_1440.png')  # mid-assembly: outer drawn, star blooming
    p.wait_for_timeout(3600)
    p.screenshot(path=f'{SH}/01_hero_1440.png')
    # ---- geometry section ----
    p.evaluate("document.getElementById('geometry').scrollIntoView({behavior:'instant'})"); p.wait_for_timeout(400)
    p.evaluate("window.scrollBy(0,-70)"); p.wait_for_timeout(1700)  # auto-demo: cells separate
    p.screenshot(path=f'{SH}/13_geometry_separating_1440.png')
    p.wait_for_timeout(5000)
    for m, nm in [('star', 'flower'), ('hex3d', '3d_hexagons'), ('designer', 'core_periphery'), ('engine', 'bays_mounts')]:
        p.click(f'#geoModes button[data-m="{m}"]'); p.wait_for_timeout(250)
        if m == 'designer': p.click('#geoSplit'); p.wait_for_timeout(1100)
        p.locator('#geometry .geo').screenshot(path=f'{SH}/14_geometry_{nm}_1440.png')
        if m == 'designer': p.click('#geoSplit'); p.wait_for_timeout(300)
    n = p.evaluate("document.querySelectorAll('#geoSvg .cellp').length"); print('engine cells:', n)
    if n != 6: problems.append(f'engine mode shows {n} cells, expected 6')
    p.click('#geoModes button[data-m="fine"]'); n = p.evaluate("document.querySelectorAll('#geoSvg .cellp').length"); print('fine cells:', n)
    if n != 12: problems.append(f'fine mode shows {n} cells, expected 12')
    p.evaluate("document.querySelector('#geometry .ideas').scrollIntoView({behavior:'instant',block:'center'})"); p.wait_for_timeout(1900)
    p.locator('#geometry .ideas').screenshot(path=f'{SH}/15_geometry_ideas_1440.png')
    p.click('#flawOrig'); p.wait_for_timeout(200)
    p.locator('#flawSvg').evaluate("e=>e.closest('.grid').scrollIntoView({behavior:'instant',block:'center'})"); p.wait_for_timeout(300)
    p.locator('#flawSvg').evaluate("e=>e.closest('.grid')").__class__
    p.locator('#geometry .grid.g2').screenshot(path=f'{SH}/16_geometry_flaw_1440.png')
    p.click('#flawFix'); p.wait_for_timeout(200)
    p.locator('#flawSvg').screenshot(path=f'{SH}/16b_flaw_corrected_1440.png')
    p.fill('#fk', '0.3'); p.dispatch_event('#fk', 'input'); p.select_option('#ffill', 'cube'); p.fill('#fd', '2'); p.dispatch_event('#fd', 'input')
    p.evaluate("document.querySelector('#geometry .designer').scrollIntoView({behavior:'instant',block:'center'})"); p.wait_for_timeout(300)
    p.locator('#geometry .designer').screenshot(path=f'{SH}/17_flower_designer_1440.png')
    with p.expect_download() as dl: p.click('#fdl')
    print('designer download:', dl.value.suggested_filename)
    p.evaluate("document.getElementById('motifKit').scrollIntoView({behavior:'instant',block:'center'})"); p.wait_for_timeout(200)
    p.locator('#motifKit').screenshot(path=f'{SH}/18_motif_kit_1440.png')
    p.evaluate("window.scrollTo(0,0)"); p.wait_for_timeout(300)
    links = p.evaluate("[...document.querySelectorAll('a[href^=\"#\"]')].map(a=>a.getAttribute('href'))")
    bad = [h for h in set(links) if h != '#' and not p.evaluate(f"!!document.getElementById({h[1:]!r})")]
    print('nav links checked:', len(set(links)), 'broken:', bad)
    if bad: problems.append(f'broken links {bad}')
    for h in ['#quick', '#combat', '#story', '#roadmap']:
        p.click(f'#navlinks a[href="{h}"]'); p.wait_for_timeout(1800)
        top = p.evaluate(f"document.querySelector('{h}').getBoundingClientRect().top")
        if abs(top) > 120: problems.append(f'nav {h} landed at {top}')
    scroll_all(p)
    # builder
    p.evaluate("document.getElementById('builder').scrollIntoView({behavior:'instant'})"); p.wait_for_timeout(300)
    p.click('#shipSvg g.seg[data-i="1"]'); p.wait_for_timeout(200)
    p.click('#segInfo .partrow:nth-child(6) button')  # remove a mount (armour)
    p.wait_for_timeout(150)
    p.click('#palette button:nth-child(13)')  # add point defence
    p.wait_for_timeout(200)
    p.evaluate("window.scrollBy(0,-70)")
    p.screenshot(path=f'{SH}/02_ship_builder_1440.png')
    print('builder problems after adding a part:', p.inner_text('#shipProblems'))
    p.select_option('#shipPick', 'camp:bloom@ch5'); p.wait_for_timeout(200)
    print('bloom stats:', p.inner_text('#shipStats').replace('\n', ' '))
    # combat: real play button, run to the end
    p.evaluate("document.getElementById('combatStage').scrollIntoView({behavior:'instant',block:'start'}); window.scrollBy(0,-66)"); p.wait_for_timeout(300)
    p.click('#cPlay'); t0 = time.time(); mid = False
    while True:
        st = p.evaluate("[+document.getElementById('combatSvg').dataset.step, +document.getElementById('combatSvg').dataset.prog, document.getElementById('combatSvg').dataset.done]")
        if not mid and st[0] == 3 and st[1] > .45:
            p.locator('#combatStage').screenshot(path=f'{SH}/03_combat_missile_1440.png'); mid = True
        if st[0] == 6 and st[1] > .5 and not os.path.exists(f'{SH}/.shield'):
            p.locator('#combatStage').screenshot(path=f'{SH}/04_combat_shield_hit_1440.png'); open(f'{SH}/.shield', 'w').close()
        if st[2] == '1': break
        if time.time() - t0 > 90: problems.append('combat did not finish'); break
        p.wait_for_timeout(100)
    os.path.exists(f'{SH}/.shield') and os.remove(f'{SH}/.shield')
    print('combat finished in %.1fs, final step %s' % (time.time() - t0, st))
    p.locator('#combatStage').screenshot(path=f'{SH}/05_combat_end_1440.png')
    # step controls
    p.click('#cPrev'); p.click('#cPrev'); p.click('#cNext')
    print('after prev,prev,next:', p.inner_text('#cStep'))
    # story
    p.evaluate("document.getElementById('story').scrollIntoView({behavior:'instant'})"); p.wait_for_timeout(300)
    p.click('#tGo'); p.wait_for_timeout(9800)
    p.evaluate("document.getElementById('teaser').scrollIntoView({behavior:'instant',block:'start'})"); p.wait_for_timeout(300)
    p.screenshot(path=f'{SH}/06_story_teaser_1440.png')
    p.click('#spoilBtn'); p.evaluate("document.getElementById('timeline').scrollIntoView({behavior:'instant'})"); p.wait_for_timeout(1200)
    p.evaluate("window.scrollBy(0,-80)"); p.wait_for_timeout(900)
    p.screenshot(path=f'{SH}/07_story_timeline_1440.png')
    for sec in ['maps', 'world', 'fleets', 'ships', 'board']:
        p.evaluate(f"document.getElementById('{sec}').scrollIntoView({{behavior:'instant'}})"); p.wait_for_timeout(500)
        p.screenshot(path=f'{SH}/08_{sec}_1440.png')
    p.hover('#boardDemo polygon:nth-of-type(40)'); p.wait_for_timeout(200)
    print('board hud:', p.inner_text('#hud').replace('\n', ' | '))
    p.screenshot(path=f'{SH}/08_board_1440.png')
    # ---------- phone ----------
    m = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True); hook(m, '390')
    m.goto(URL); m.wait_for_timeout(1000)
    m.screenshot(path=f'{SH}/09_phone_hero_390.png')
    scroll_all(m)
    ov = m.evaluate("document.documentElement.scrollWidth")
    print('phone scrollWidth', ov)
    if ov > 392: problems.append(f'phone horizontal overflow: {ov}px')
    wide = m.evaluate("[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.right>392&&r.width>0&&!e.closest('.nav-links,.tbl,pre')}).slice(0,8).map(e=>e.tagName+'.'+e.className+' '+Math.round(e.getBoundingClientRect().right))")
    if wide: print('wide elements:', wide)
    for sec, name in [('combat', '10_phone_combat_390'), ('builder', '11_phone_builder_390'), ('story', '12_phone_story_390')]:
        m.evaluate(f"document.getElementById('{sec}').scrollIntoView({{behavior:'instant'}})"); m.wait_for_timeout(900)
        m.screenshot(path=f'{SH}/{name}.png')
    m.evaluate("window.combatRunAll()"); m.wait_for_timeout(500)
    m.evaluate("document.getElementById('combatStage').scrollIntoView({behavior:'instant'})"); m.wait_for_timeout(9000)
    m.screenshot(path=f'{SH}/10_phone_combat_390.png')
    # ---------- reduced motion ----------
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce'); r = ctx.new_page(); hook(r, 'rm')
    r.goto(URL); r.wait_for_timeout(500)
    off = r.evaluate("getComputedStyle(document.querySelector('#heroMark .hm-outer')).strokeDashoffset")
    op = r.evaluate("getComputedStyle(document.querySelector('#heroMark .hm-bloom')).opacity")
    print('reduced motion: outer dashoffset', off, 'star opacity', op, 'zoom note:', r.inner_text('#zoomNote'))
    if off not in ('0', '0px') or op != '1': problems.append('reduced motion: hero mark not shown complete')
    r.screenshot(path=f'{SH}/19_reduced_motion_hero_1440.png')
    r.evaluate("document.querySelector('#geometry .ideas').scrollIntoView({behavior:'instant',block:'center'})"); r.wait_for_timeout(300)
    r.locator('#geometry .ideas').screenshot(path=f'{SH}/20_reduced_motion_ideas_1440.png')
    m.evaluate("document.getElementById('geometry').scrollIntoView({behavior:'instant'})"); m.wait_for_timeout(1500)
    m.screenshot(path=f'{SH}/21_phone_geometry_390.png')
    b.close()
print('\n'.join(problems) or 'NO PROBLEMS')
sys.exit(1 if problems else 0)
