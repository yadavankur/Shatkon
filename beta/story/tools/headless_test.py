"""Serve the folder, open story/demo.html headless, play every scene with both captains, fail on console errors."""
import http.server, threading, functools, json, sys, time
from playwright.sync_api import sync_playwright
import os as _os
_H=_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
_PROJ=_os.path.dirname(_H) if _os.path.basename(_H)=='story' else _H  # works from tools/ or story/tools/
ROOT=_PROJ
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*a,**k): super().__init__(*a,directory=ROOT,**k)
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8765),Q); threading.Thread(target=srv.serve_forever,daemon=True).start()
URL='http://127.0.0.1:8765/story/demo.html'
problems=[]
def hook(page,tag):
    page.on('console', lambda m: problems.append(f'[{tag}] console.{m.type}: {m.text}') if m.type in ('error','warning') else None)
    page.on('pageerror', lambda e: problems.append(f'[{tag}] pageerror: {e}'))
    page.on('requestfailed', lambda r: problems.append(f'[{tag}] requestfailed: {r.url}'))
    page.on('response', lambda r: problems.append(f'[{tag}] HTTP {r.status}: {r.url}') if r.status>=400 else None)

def drive(page, sid, captain, picks=('ch4b','ch4a'), screenshot=None, shot_at=None):
    page.evaluate("([id,c])=>{window.__done=null; window.skDemo.play(id,{captain:c,textSpeed:'instant'}).then(r=>window.__done=r||{failed:true})}",[sid,captain])
    picks=list(picks); n=0; t0=time.time(); shots=dict(shot_at or {})
    while True:
        done=page.evaluate("window.__done")
        if done is not None: return done, n
        if time.time()-t0>60: raise RuntimeError(f'{sid} timed out')
        opt=page.query_selector('.sk-choice:not([hidden]) .sk-opt:not([disabled])')
        if opt:
            if n in shots: page.screenshot(path=shots.pop(n))
            if 'locked' in shots and page.query_selector('.sk-choice:not([hidden]) .sk-opt[disabled]'): page.wait_for_timeout(300); page.screenshot(path=shots.pop('locked'))
            if 'choice' in shots: page.wait_for_timeout(300); page.screenshot(path=shots.pop('choice'))
            want=picks.pop(0) if picks else 'ch4a'
            b=page.query_selector(f'.sk-choice:not([hidden]) .sk-opt[data-option="{want}"]:not([disabled])') or opt
            b.click(); n+=1; page.wait_for_timeout(60); continue
        if page.query_selector('.sk-story-root .sk-box.sk-done'):
            ll=page.evaluate("window.__lastLine||{}")
            for k in [k for k in shots if isinstance(k,str) and k.startswith('sp:')]:
                sp,via=(k[3:].split('/')+[None])[:2]
                if ll.get('speaker')==sp and (via is None or ll.get('via')==via or (via=='glyphs' and ll.get('glyphs'))): page.wait_for_timeout(350); page.screenshot(path=shots.pop(k))
            if n in shots: page.wait_for_timeout(350); page.screenshot(path=shots.pop(n))
            page.keyboard.press('Enter' if n%2 else 'Space'); n+=1
        page.wait_for_timeout(25)

with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    results={}
    for captain in ('captain_a','captain_b'):
        ctx=b.new_context(viewport={'width':1280,'height':720}); page=ctx.new_page(); hook(page,captain)
        page.goto(URL); page.wait_for_function('window.skDemo')
        ids=page.evaluate('window.skDemo.index.scenes')
        for sid in ids:
            r,n=drive(page,sid,captain)
            results[f"{captain}:{sid}"]=(r,n); print(captain,sid,r,n,flush=True)
            if sid=='ch4_fork' and r.get('choice')!='ch4a': problems.append(f'ch4_fork resolved {r}')
            if page.query_selector('.sk-story-root'): problems.append(f'{sid} left its root in the DOM')
        ctx.close()
    # skip button + barks + no-choice result + a 'normal' speed run for typing
    ctx=b.new_context(viewport={'width':1280,'height':720}); page=ctx.new_page(); hook(page,'skip')
    page.goto(URL); page.wait_for_function('window.skDemo')
    page.evaluate("()=>{window.__done=null; window.skDemo.play('ch1_intro',{captain:'captain_a',textSpeed:'normal'}).then(r=>window.__done=r)}")
    page.wait_for_selector('.sk-skip'); page.wait_for_timeout(400); page.click('.sk-skip'); page.wait_for_function('window.__done!==null')
    print('skip phase',flush=True); results['skip:ch1_intro']=(page.evaluate('window.__done'),0)
    page.evaluate("()=>{window.__done=null; window.skDemo.play('ch4_fork',{captain:'captain_b',textSpeed:'normal'}).then(r=>window.__done=r)}")
    page.wait_for_selector('.sk-skip'); page.click('.sk-skip'); page.wait_for_selector('.sk-choice:not([hidden])')
    results['skip:ch4_fork reaches choice']=('ok',0)
    page.click('.sk-opt[data-option="ch4a"]'); page.wait_for_function('window.__done!==null'); results['skip:ch4_fork']=(page.evaluate('window.__done'),0)
    nb=page.evaluate("()=>{window.__barks=0; const ids=window.skDemo.index.barks; ids.forEach(id=>window.skDemo.showBark(id).then(()=>window.__barks++)); return ids.length}")
    page.wait_for_timeout(800); page.screenshot(path=f'{ROOT}/screens/desktop_barks.png')
    page.wait_for_function(f"window.__barks==={nb}", timeout=180000)
    print('barks ok',flush=True); results['barks queued and cleared']=('ok',0)
    ctx.close()
    # screenshots: mobile portrait and desktop
    ctx=b.new_context(viewport={'width':360,'height':740},device_scale_factor=2,is_mobile=True,has_touch=True); page=ctx.new_page(); hook(page,'mobile')
    page.goto(URL); page.wait_for_function('window.skDemo')
    drive(page,'ch1_intro','captain_a',shot_at={4:f'{ROOT}/screens/mobile_ch1_intro_dialogue.png','sp:li/comms':f'{ROOT}/screens/mobile_ch1_intro_comms_li.png'})
    drive(page,'ch4_fork','captain_b',shot_at={'choice':f'{ROOT}/screens/mobile_ch4_fork_choice.png','locked':f'{ROOT}/screens/mobile_ch4_fork_locked_choice.png'})
    drive(page,'ch1_contact','captain_b',shot_at={2:f'{ROOT}/screens/mobile_ch1_contact_comms_seed.png'})
    drive(page,'ch4a_intro','captain_a',shot_at={'sp:mimic/comms':f'{ROOT}/screens/mobile_ch4a_mimic_comms.png','sp:weave/glyphs':f'{ROOT}/screens/mobile_ch4a_glyph_translation.png'})
    page.screenshot(path=f'{ROOT}/screens/mobile_demo_list.png')
    ctx.close()
    ctx=b.new_context(viewport={'width':1920,'height':1080}); page=ctx.new_page(); hook(page,'desktop')
    page.goto(URL); page.wait_for_function('window.skDemo')
    drive(page,'ch3_reunion','captain_b',shot_at={2:f'{ROOT}/screens/desktop_ch3_reunion.png'})
    # v2 chapter 1 shots
    drive(page,'ch1_intro','captain_a',shot_at={'sp:finch_pilot/comms':f'{ROOT}/screens/desktop_ch1_intro_nanda.png'})
    drive(page,'ch1_finch_down','captain_b',shot_at={'sp:sparrow_pilot':f'{ROOT}/screens/desktop_ch1_finch_down.png'})
    drive(page,'ch1_hurl','captain_a',shot_at={'sp:wren_pilot/comms':f'{ROOT}/screens/desktop_ch1_hurl_wren.png','sp:sparrow_pilot':f'{ROOT}/screens/desktop_ch1_hurl_after.png'})
    drive(page,'ch1_salvage','captain_b',shot_at={'sp:li/comms':f'{ROOT}/screens/desktop_ch1_salvage_li.png'})
    page.evaluate("()=>{window.__b=0; window.skDemo.showBark('b1_hurl_wren').then(()=>window.__b++); window.skDemo.showBark('b1_hurl_kite').then(()=>window.__b++)}")
    page.wait_for_timeout(700); page.screenshot(path=f'{ROOT}/screens/desktop_bark_hurl_wren.png')
    page.wait_for_function("window.__b===2", timeout=60000); results['v2 hurl barks']=('ok',0)
    drive(page,'ch5_cliff','captain_a',shot_at={3:f'{ROOT}/screens/desktop_ch5_cliff_weave.png'})
    drive(page,'ch2_intro','captain_a',shot_at={2:f'{ROOT}/screens/desktop_ch2_intro_ship.png'})
    drive(page,'ch5_seam_wakes','captain_b',shot_at={'sp:weave/glyphs':f'{ROOT}/screens/desktop_ch5_seam_wakes_glyphs.png'})
    drive(page,'ch4_fork','captain_a',shot_at={'choice':f'{ROOT}/screens/desktop_ch4_fork_choice.png'})
    ctx.close(); b.close()
srv.shutdown()
print(json.dumps({k:v for k,v in results.items()},indent=0)[:4000])
print(f'{len(results)} runs; problems: {len(problems)}')
for x in problems: print('  ',x)
sys.exit(1 if problems else 0)
