import os
"""Browser decoder lifecycle: track/quality mapping and stale media cancellation."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROME_EXECUTABLE') or None)
 page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content('<div id="night-player"><object></object></div>')
 page.add_script_tag(content="""
 window.NightService={log:function(){}};window.instances=[];window.readyCount=0;window.failCount=0;
 window.Hls=function(){this.events={};this.levels=[{bitrate:3000000},{bitrate:5000000}];this.audioTracks=[{lang:'en'},{lang:'de'}];instances.push(this)};
 Hls.isSupported=function(){return true};Hls.Events={BUFFER_CODECS:'codecs',MANIFEST_PARSED:'manifest',ERROR:'error'};
 Hls.prototype.on=function(k,f){this.events[k]=f};Hls.prototype.loadSource=function(){};Hls.prototype.attachMedia=function(){};Hls.prototype.destroy=function(){this.destroyed=true};
 """)
 page.add_script_tag(content=(root/'cinema/tv-browser-player.js').read_text(encoding='utf-8'))
 page.evaluate("window.decoder=makeBrowserPlayer();decoder.open('https://media.test/master.m3u8');decoder.prepareAsync(function(){readyCount++},function(){failCount++})")
 page.wait_for_function('instances.length===1')
 page.evaluate("window.oldVideo=document.querySelector('video');decoder.close();decoder.open('https://media.test/new.m3u8');decoder.prepareAsync(function(){readyCount++},function(){failCount++})")
 page.wait_for_function('instances.length===2')
 page.evaluate("oldVideo.dispatchEvent(new Event('loadedmetadata'));instances[0].events.error(null,{fatal:true,details:'late error'})")
 assert page.evaluate('readyCount===0&&failCount===0&&instances[0].destroyed')
 page.evaluate("document.querySelector('video').dispatchEvent(new Event('loadedmetadata'));decoder.setStreamingProperty('ADAPTIVE_INFO','BITRATES=3000000~3000000');decoder.setSelectTrack('AUDIO',1)")
 assert page.evaluate('readyCount===1&&instances[1].currentLevel===0&&instances[1].audioTrack===1')
 assert page.evaluate('decoder.getTotalTrackInfo().filter(t=>t.type==="AUDIO").length')==2
 page.evaluate('decoder.close()');assert page.locator('video').count()==0
 assert not errors,errors
 b.close()
print('PASS: browser quality/audio mapping; stale video events and HLS callbacks ignored; decoder cleanup')
