import os
"""TV Start behavior: native launches, long-press favorites, reorder and remote grid."""
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

MOCK = r"""
window.__launches=[]; window.__hidden=false; window.__discoveries=0;
Object.defineProperty(document,'hidden',{get:function(){return window.__hidden;}});
window.tizen={application:{
 launch:function(id,ok){window.__launches.push(id);ok();},
 getAppsInfo:function(ok){window.__discoveries++;ok(window.TV_APPS.map(function(a){return {id:a.id};}));}
}};
window.webapis={productinfo:{getModel:function(){return 'Q60T';},getFirmware:function(){return '2743.0';}}};
"""

with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROME_EXECUTABLE') or None)
    pg=b.new_page(viewport={'width':1920,'height':1080})
    errors=[]; requests=[]
    pg.on('pageerror',lambda e:errors.append(str(e)))
    pg.on('request',lambda r:requests.append(r.url))
    pg.add_init_script(MOCK)
    def local_files(route):
        name=urlparse(route.request.url).path.lstrip('/')
        if '$WEBAPIS' in name:
            route.fulfill(content_type='application/javascript',body='')
        else:
            route.fulfill(path=str(Path(__file__).resolve().parents[2]/'launcher'/name))
    pg.route('http://127.0.0.1:8123/**',local_files)
    pg.goto('http://127.0.0.1:8123/start.html')
    pg.wait_for_load_state('networkidle')
    assert pg.locator('.app').count()==12
    assert pg.evaluate('document.activeElement.getAttribute("data-id")')=='org.tizen.netflix-app'
    pg.screenshot(path=str(Path(__file__).resolve().parents[2]/'docs/images/launcher.png'))
    pg.keyboard.press('Enter')
    pg.keyboard.press('Enter')
    assert pg.evaluate('__launches')==['org.tizen.netflix-app'], 'Duplicate launch must be blocked'
    pg.evaluate("__hidden=true;document.dispatchEvent(new Event('visibilitychange'));__hidden=false;document.dispatchEvent(new Event('visibilitychange'))")
    assert pg.evaluate('__launcher.state().pending') is None
    pg.keyboard.press('ArrowRight')
    pg.keyboard.press('Enter')
    assert pg.evaluate('__launches[1]')=='org.tizen.primevideo'
    pg.evaluate("__hidden=true;document.dispatchEvent(new Event('visibilitychange'));__hidden=false;document.dispatchEvent(new Event('visibilitychange'))")
    pg.keyboard.press('ArrowLeft')
    pg.keyboard.down('Enter'); pg.wait_for_timeout(800); pg.keyboard.up('Enter')
    assert pg.locator('.app').count()==11
    assert len(pg.evaluate('__launches'))==2, 'Holding OK must not open an app'
    pg.reload(); pg.wait_for_load_state('networkidle')
    assert pg.locator('.app').count()==11
    pg.locator('#nav-all').click()
    assert pg.locator('.app').count()==23
    pg.locator('[data-id="org.tizen.netflix-app"]').focus()
    pg.keyboard.down('Enter'); pg.wait_for_timeout(800); pg.keyboard.up('Enter')
    assert 'org.tizen.netflix-app' in pg.evaluate('__launcher.state().favorites')
    pg.keyboard.press('ArrowDown');pg.keyboard.press('ArrowDown');pg.keyboard.press('ArrowDown')
    assert pg.evaluate('document.getElementById("grid").scrollTop')>0
    pg.keyboard.press('Escape')
    assert pg.evaluate('__launcher.state().view')=='home'
    before=pg.evaluate('__launcher.state().favorites')
    pg.locator('#nav-order').click()
    selected=pg.evaluate('__launcher.state().selected')
    i=before.index(selected)
    direction='ArrowLeft' if i%6 else 'ArrowRight'
    pg.keyboard.press(direction)
    after=pg.evaluate('__launcher.state().favorites')
    assert before!=after and sorted(before)==sorted(after)
    pg.keyboard.press('Enter')
    assert not pg.evaluate('__launcher.state().reorder')
    pg.reload();pg.wait_for_load_state('networkidle')
    assert pg.evaluate('__launcher.state().favorites')==after
    pg.locator('#nav-settings').click()
    assert pg.locator('#settings').is_visible()
    box=pg.locator('#settings').bounding_box()
    assert box['x']==0 and box['y']==0 and box['height']==1080
    assert pg.evaluate('document.body.classList.contains("fast")')
    pg.locator('#setting-speed').click()
    assert not pg.evaluate('document.body.classList.contains("fast")')
    pg.locator('#setting-speed').click()
    pg.keyboard.press('Escape')
    assert not pg.locator('#settings').is_visible()
    assert pg.locator('footer').bounding_box()['y']<1040
    assert pg.evaluate('__discoveries')==1
    assert not [u for u in requests if u.startswith('https://')], 'Launcher must not need external assets'
    assert not errors, errors
    print('PASS: 12 local favorites; exact Netflix/Prime launch IDs; duplicate gate; hold-OK pinning; persistence; reorder; all 23 apps reachable; settings/back; no external requests or page errors')
    b.close()
