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
 window.Hls=function(config){this.config=config;this.events={};this.levels=[{bitrate:3000000,height:720,width:1280},{bitrate:5000000,height:1080,width:1920}];this.audioTracks=[{lang:'en'},{lang:'de'}];instances.push(this)};
 Hls.DefaultConfig={loader:function(){this.load=function(ctx,cfg,cb){cb.onSuccess({data:ctx.fixture},'stats',ctx,'network')};this.destroy=function(){}}};
 Hls.isSupported=function(){return true};Hls.Events={BUFFER_CODECS:'codecs',MANIFEST_PARSED:'manifest',ERROR:'error',FRAG_LOADED:'fragment'};
 Hls.prototype.on=function(k,f){this.events[k]=f};Hls.prototype.loadSource=function(){};Hls.prototype.attachMedia=function(){};Hls.prototype.destroy=function(){this.destroyed=true};
 """)
 page.add_script_tag(content=(root/'cinema/tv-browser-player.js').read_text(encoding='utf-8'))
 page.evaluate("window.decoder=makeBrowserPlayer();decoder.open('https://media.test/master.m3u8');decoder.prepareAsync(function(){readyCount++},function(){failCount++})")
 page.wait_for_function('instances.length===1')
 # Synthetic MP4: correct the matched display metadata, never coded video/audio.
 page.evaluate("""window.testInit=function(ratio,width){
 function box(type,payload){var b=new Uint8Array(8+payload.length),v=new DataView(b.buffer);v.setUint32(0,b.length);for(var i=0;i<4;i++)b[4+i]=type.charCodeAt(i);b.set(payload,8);return b;}
 function cat(){var a=Array.prototype.slice.call(arguments),b=new Uint8Array(a.reduce(function(n,x){return n+x.length},0)),p=0;a.forEach(function(x){b.set(x,p);p+=x.length});return b;}
 var tk=new Uint8Array(84);new DataView(tk.buffer).setUint32(76,width*65536);
 var sample=new Uint8Array(78);new DataView(sample.buffer).setUint16(24,1920);new DataView(sample.buffer).setUint16(26,1040);
 var aspect=new Uint8Array(8),v=new DataView(aspect.buffer);v.setUint32(0,ratio);v.setUint32(4,480);
 var stsd=box('stsd',cat(new Uint8Array([0,0,0,0,0,0,0,1]),box('avc1',cat(sample,box('pasp',aspect)))));
 var track=box('trak',cat(box('tkhd',tk),box('mdia',box('minf',box('stbl',stsd)))));
 return cat(box('ftyp',new Uint8Array(8)),box('moov',track),box('mdat',new Uint8Array([1,2,3,4]))).buffer;
 };
 window.correctInit=function(buffer){var output,loader=new instances[0].config.fLoader({});loader.load({fixture:buffer},{},{onSuccess:function(r,s,c,n){if(s!=='stats'||n!=='network')throw Error('Lost loader metadata');output=r.data;}});return output;};
 """)
 checks=page.evaluate("""function(){var original=testInit(481,1924),copy=original.slice(0),fixed=correctInit(original);return {
 changed:fixed!==original,unchangedInput:Array.from(new Uint8Array(original)).join()===Array.from(new Uint8Array(copy)).join(),
 corrected:correctInit(fixed)===fixed,
 expectedMetadata:Array.from(new Uint8Array(fixed)).join()===Array.from(new Uint8Array(testInit(480,1920))).join(),
 untouchedSquare: (function(){var b=testInit(480,1920);return correctInit(b)===b})(),
 untouchedAnamorphic:(function(){var b=testInit(640,2560);return correctInit(b)===b})(),
 untouchedTruncated:(function(){var b=original.slice(0,original.byteLength-25);return correctInit(b)===b})(),
 differences:Array.from(new Uint8Array(original)).filter(function(x,i){return x!==new Uint8Array(fixed)[i]}).length
 }}""")
 assert all(checks[k] for k in checks if k!='differences'),checks
 assert checks['differences']==2,checks
 page.evaluate("window.oldVideo=document.querySelector('video');decoder.close();decoder.open('https://media.test/new.m3u8');decoder.prepareAsync(function(){readyCount++},function(){failCount++})")
 page.wait_for_function('instances.length===2')
 page.evaluate("oldVideo.dispatchEvent(new Event('loadedmetadata'));instances[0].events.error(null,{fatal:true,details:'late error'})")
 assert page.evaluate('readyCount===0&&failCount===0&&instances[0].destroyed')
 page.evaluate("document.querySelector('video').dispatchEvent(new Event('loadedmetadata'));decoder.setStreamingProperty('ADAPTIVE_INFO','BITRATES=3000000~3000000');decoder.setSelectTrack('AUDIO',1)")
 assert page.evaluate('readyCount===1&&instances[1].currentLevel===0&&instances[1].audioTrack===1')
 page.evaluate('decoder.setQualityHeight(1080)')
 assert page.evaluate('instances[1].currentLevel')==1
 assert page.evaluate('decoder.getPlaybackInfo().variants.map(v=>v.height)')==[720,1080]
 page.evaluate("instances[1].events.fragment(null,{frag:{type:'main',duration:4},payload:{byteLength:1000000}})")
 assert page.evaluate('decoder.getPlaybackInfo().measuredBitrate')==2000000
 page.evaluate('instances[1].levels=[{height:360,bitrate:800000},{height:800,bitrate:5000000}];decoder.setQualityHeight(720)')
 assert page.evaluate('instances[1].currentLevel')==0,'Unavailable preference selected a higher rendition'
 assert page.evaluate('decoder.getTotalTrackInfo().filter(t=>t.type==="AUDIO").length')==2
 page.evaluate('decoder.close()');assert page.locator('video').count()==0
 assert not errors,errors
 b.close()
print('PASS: browser quality/audio mapping; stale video events and HLS callbacks ignored; decoder cleanup')
