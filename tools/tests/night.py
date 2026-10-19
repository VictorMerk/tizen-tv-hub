import os
"""TV UI and native-player integration regressions, using public catalogue fixtures."""
import json
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[2]
fixture=json.loads((root/'tests/fixtures/catalogue.json').read_text())['items']
series=dict(fixture[0],id='tt0903747',type='series',name='Breaking Bad',tmdbId='1396',episodes=[{'season':1,'episode':1,'title':'Pilot'},{'season':1,'episode':2,'title':'Cat in the Bag'}])
mock=r"""
window.__av={s:'NONE',pos:5000,playCalls:0,callbacks:[],lock:'',tracks:[],delay:false,
 stop:function(){this.s='IDLE'},close:function(){this.s='NONE'},open:function(u){this.url=u;this.s='IDLE'},
 setDisplayRect:function(){},setDisplayMethod:function(){},setSilent:function(){},setBufferingParam:function(){},
 setStreamingProperty:function(k,v){this.lock=v},getState:function(){return this.s},
 setListener:function(l){this.listener=l},prepareAsync:function(ok){this.callbacks.push(ok);if(!this.delay)setTimeout(()=>{this.s='READY';ok()},20)},
 play:function(){this.s='PLAYING';this.playCalls++},pause:function(){this.s='PAUSED'},
 getCurrentTime:function(){return this.pos},getDuration:function(){return 7200000},
 seekTo:function(t,ok){this.pos=t;ok()},
 getTotalTrackInfo:function(){return [{type:'VIDEO',index:0,extra_info:JSON.stringify({Width:this.lock.includes('5692000')?'1920':'1280',Height:this.lock.includes('5692000')?'1080':'720'})},{type:'AUDIO',index:1,extra_info:'{"language":"en","channels":"2"}'},{type:'AUDIO',index:2,extra_info:'{"language":"de","channels":"2"}'}]},
 setSelectTrack:function(t,i){this.audio=i}};
window.webapis={avplay:__av};window.tizen={tvinputdevice:{registerKeyBatch:function(){}},application:{launch:function(){}}};
window.EventSource=function(url){this.url=url;this.closed=false;this.close=function(){this.closed=true};this.addEventListener=function(name,fn){if(name==='done')setTimeout(()=>{if(!this.closed)fn({data:JSON.stringify({sources:[{type:'hls',quality:'auto',url:'https://media.test/master.m3u8?server='+new URL(url).searchParams.get('server')}]})})},15)}};
"""
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROME_EXECUTABLE') or None)
    page=browser.new_page(viewport={'width':1920,'height':1080})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script(mock)
    def files(route):
        name=urlparse(route.request.url).path.lstrip('/') or 'index.html'
        path=root/'cinema'/name
        if name=='tv-browser-player.js':
            route.fulfill(content_type='application/javascript',body="window.makeBrowserPlayer=function(){__av.engine='browser';return __av};")
            return
        if '$WEBAPIS' in name:route.fulfill(content_type='application/javascript',body='');return
        route.fulfill(path=str(path))
    page.route('http://night.test/**',files)
    def api(route):
        path=urlparse(route.request.url).path
        if path=='/api/servers':data={'servers':[{'id':s.lower(),'label':s} for s in ['Vienna','Salem','Austin']]}
        elif '/meta/series/' in path:data=series
        elif '/meta/' in path:
            item=next((x for x in fixture if x['id']==path.split('/')[-1]),fixture[0]);data=dict(item,tmdbId=item.get('tmdbId') or '1368337',description=item.get('description') or 'A film for your next evening.')
        elif '/search' in path:data={'items':fixture[:2]}
        else:
            number=int(parse_qs(urlparse(route.request.url).query).get('page',['1'])[0])
            entries=[series] if 'type=series' in route.request.url else fixture
            if number>1:entries=[dict(x,id=x['id']+'-page'+str(number),name=x['name']+' page '+str(number)) for x in entries]
            data={'items':entries,'page':number,'totalPages':3}
        route.fulfill(content_type='application/json',headers={'Access-Control-Allow-Origin':'http://night.test','Access-Control-Allow-Credentials':'true'},body=json.dumps(data))
    page.route('https://movienig.ht/api/**',api)
    page.route('https://embed.vidrift.in/embed/**',lambda r:r.fulfill(body='<script>var embedMeta = {"playbackToken":"public-fixture"};</script>',headers={'Access-Control-Allow-Origin':'*'}))
    source_requests=[]
    def vidrift_source(route):
        source_requests.append(parse_qs(urlparse(route.request.url).query))
        route.fulfill(content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps({'provider':'atlas','streams':[{'type':'hls','url':'https://media.test/master.m3u8'}]}))
    page.route('https://embed.vidrift.in/api/source/**',vidrift_source)
    page.route('https://media.test/**',lambda r:r.fulfill(headers={'Access-Control-Allow-Origin':'*'},body='#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2628000,RESOLUTION=1280x720\n720.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=5692000,RESOLUTION=1920x1080\n1080.m3u8\n'))
    def artwork(route):
        index=next((i for i,x in enumerate(fixture) if '/demo-'+str(i)+'.jpg' in route.request.url),0)
        colors=['#25565d','#755849','#35486f','#716836','#6a435b','#3c6757']
        svg='<svg xmlns="http://www.w3.org/2000/svg" width="180" height="230"><rect width="180" height="230" fill="'+colors[index%len(colors)]+'"/><circle cx="130" cy="67" r="49" fill="#f0dbb6" opacity=".7"/><path d="M0 220L180 80V230H0Z" fill="#101b26" opacity=".65"/><text x="16" y="40" font-family="sans-serif" font-size="12" fill="white" letter-spacing="3">TV HUB</text><text x="16" y="200" font-family="sans-serif" font-size="30" fill="white">'+str(index+1).zfill(2)+'</text></svg>'
        route.fulfill(content_type='image/svg+xml',body=svg)
    page.route('https://image.tmdb.org/**',artwork);page.route('https://images.metahub.space/**',artwork);page.route('https://m.media-amazon.com/**',artwork)
    page.goto('http://night.test/');page.wait_for_selector('.poster');page.wait_for_load_state('networkidle')
    assert page.locator('.poster').count()==13
    page.screenshot(path=str(root/'docs/images/catalogue.png'))
    page.keyboard.press('ArrowRight');page.keyboard.press('ArrowRight');selected=page.evaluate('NightUI.state().selected')
    page.keyboard.press('Enter');page.wait_for_selector('#detail-play:not([disabled])')
    page.screenshot(path=str(root/'docs/images/details.png'))
    page.keyboard.press('Escape');assert page.evaluate('NightUI.state().selected')==selected
    page.keyboard.press('Enter');page.wait_for_selector('#detail-play:not([disabled])');page.keyboard.press('Enter')
    page.wait_for_function('() => NightPlayer.state().state==="PLAYING"')
    page.wait_for_function('() => NightPlayer.state().variants.length===2')
    assert page.evaluate('NightPlayer.state().engine')=='browser'
    assert page.evaluate('NightPlayer.state().quality')==1080
    assert source_requests[0]['provider']==['atlas'] and source_requests[0]['hevc']==['0']
    page.keyboard.press('Enter');assert page.evaluate('NightPlayer.state().state')=='PAUSED'
    page.keyboard.press('Enter');assert page.evaluate('NightPlayer.state().state')=='PLAYING'
    page.locator('#play-actions button').nth(4).click();assert page.get_by_role('button',name=re.compile('^1080p')).count()==1
    page.get_by_role('button',name=re.compile('^1080p')).click();page.wait_for_function('() => NightPlayer.state().state==="PLAYING"')
    assert page.evaluate('NightPlayer.state().quality')==1080
    assert '5692000' in page.evaluate('__av.lock')
    page.locator('#play-actions button').nth(4).click();page.get_by_role('button',name=re.compile('^720p')).click()
    page.wait_for_function('() => NightPlayer.state().prepared && NightPlayer.state().quality===720')
    page.locator('#play-actions button').nth(3).click();page.get_by_role('button',name=re.compile('^Salem')).click()
    page.wait_for_function('() => NightPlayer.state().server==="salem" && NightPlayer.state().prepared')
    assert page.evaluate('NightPlayer.state().engine')=='native'
    assert page.evaluate('NightPlayer.state().quality')==720
    assert '2628000' in page.evaluate('__av.lock'),'Changing provider reset the requested resolution'
    page.locator('#play-actions button').nth(5).click();page.get_by_role('button',name=re.compile('^de')).click();assert page.evaluate('__av.audio')==2
    page.evaluate('__av.listener.onerror("native-format-error")')
    page.wait_for_function('() => NightPlayer.state().engine==="browser" && NightPlayer.state().prepared')
    assert page.evaluate('NightPlayer.state().server')=='salem','Decoder fallback unnecessarily changed provider'
    page.keyboard.press('Escape');assert not page.evaluate('NightPlayer.active()')
    # A prepare callback delivered after leaving must never restart playback.
    page.evaluate('__av.delay=true');page.locator('#detail-play').click();page.wait_for_timeout(80)
    count=page.evaluate('__av.playCalls');page.keyboard.press('Escape');page.evaluate('__av.callbacks[__av.callbacks.length-1]()')
    assert page.evaluate('__av.playCalls')==count,'Late prepare callback restarted a closed player'
    page.evaluate('__av.delay=false')
    page.evaluate('NightUI.details('+json.dumps(series)+')');page.wait_for_selector('#detail-play:not([disabled])');page.locator('#detail-play').click()
    page.get_by_text('Staffel 1',exact=True).click();page.get_by_text('Folge 1 · Pilot',exact=True).click()
    page.wait_for_function('() => NightPlayer.state().prepared');assert page.evaluate('NightPlayer.state().episode.episode')==1
    assert page.evaluate('NightPlayer.state().quality')==720,'Opening another title reset the preference'
    page.evaluate('__av.listener.onstreamcompleted()');page.wait_for_function('() => NightPlayer.state().episode.episode===2 && NightPlayer.state().prepared')
    page.evaluate("NightPlayer.close();NightUI.browse('movie')")
    page.wait_for_function('() => !NightUI.state().loading')
    assert page.evaluate('NightUI.state().pages')==3
    page.locator('.poster').last.focus();page.keyboard.press('ArrowDown')
    assert page.evaluate('document.activeElement.getAttribute("data-page")')=='next'
    page.keyboard.press('Enter');page.wait_for_function('() => NightUI.state().page===2 && !NightUI.state().loading')
    assert 'page 2' in page.locator('.poster').first.inner_text()
    page.keyboard.press('Enter');page.wait_for_selector('#detail-play:not([disabled])');page.keyboard.press('Escape')
    assert page.evaluate('NightUI.state().page')==2
    page.locator('[data-page=previous]').click();page.wait_for_function('() => NightUI.state().page===1 && !NightUI.state().loading')
    page.locator('[data-nav=series]').click();page.wait_for_function('() => NightUI.state().view==="series" && !NightUI.state().loading')
    page.locator('[data-page=next]').click();page.wait_for_function('() => NightUI.state().page===2 && !NightUI.state().loading')
    assert 'page 2' in page.locator('.poster').first.inner_text()
    page.reload();page.wait_for_selector('.poster')
    page.evaluate('NightUI.details('+json.dumps(fixture[0])+')');page.wait_for_selector('#detail-play:not([disabled])');page.locator('#detail-play').click()
    page.wait_for_function('() => NightPlayer.state().prepared')
    assert page.evaluate('NightPlayer.state().quality')==720,'App reload lost the quality preference'
    page.locator('#play-actions button').nth(4).click();page.get_by_role('button',name=re.compile('^Automatisch')).click()
    page.wait_for_function('() => NightPlayer.state().prepared && NightPlayer.state().quality==="auto"')
    page.evaluate('NightPlayer.close();NightUI.details('+json.dumps(fixture[1])+')');page.wait_for_selector('#detail-play:not([disabled])');page.locator('#detail-play').click()
    page.wait_for_function('() => NightPlayer.state().prepared')
    assert page.evaluate('NightPlayer.state().quality')=='auto','Auto preference was not retained'
    page.evaluate('NightPlayer.close()')
    assert not errors,errors
    browser.close()
print('PASS: remote grid/detail/back focus; native play/pause; real quality options and bitrate lock; source/audio selection; late callback cancellation; series and auto-next; paged movies/series and page restoration')
