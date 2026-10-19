"""Validate TS packaging against compressed synthetic samples and lifecycle cancellation."""
import base64,json,os,re,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
fixture=json.loads((root/'tests/fixtures/mux-synthetic.json').read_text())
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROME_EXECUTABLE') or None);page=browser.new_page();page.set_content('<html></html>')
 for n in ['mp4box.min.js','tv-ts-mux.js']:page.add_script_tag(path=str(root/'cinema'/n))
 result=page.evaluate("""a=>{
 function decode(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer}function encode(b){return btoa(String.fromCharCode.apply(null,new Uint8Array(b)))}
 var init=decode(a.init),fragment=decode(a.fragment),output=NightTsMux.convert(init,fragment.slice(0)),meta=NightTsMux.describe(init),f=MP4Box.createFile(),expected={video:[],audio:[]};
 f.onReady=function(i){i.tracks.forEach(function(t){f.setExtractionOptions(t.id,null,{nbSamples:1000})});f.start()};
 f.onSamples=function(id,u,list){var t=meta.tracks[id];list.forEach(function(s){if(t.avc){var data=s.data,pos=0;while(pos<data.length){var n=0;for(var i=0;i<t.avc.lengthSizeMinusOne+1;i++)n=n*256+data[pos++];var nal=data.subarray(pos,pos+n);if([7,8,9].indexOf(nal[0]&31)<0)expected.video.push(encode(nal));pos+=n;}}else expected.audio.push(encode(s.data));})};
 var b=init.slice(0);b.fileStart=0;f.appendBuffer(b);b=fragment.slice(0);b.fileStart=init.byteLength;f.appendBuffer(b);f.flush();
 var invalid=init.slice(0),bytes=new Uint8Array(invalid);for(var k=0;k<bytes.length-4;k++)if(bytes[k]===97&&bytes[k+1]===118&&bytes[k+2]===99&&bytes[k+3]===49){bytes[k]=104;break;}
 var rejected=false;try{NightTsMux.convert(invalid,fragment.slice(0))}catch(e){rejected=true}
 return {data:encode(output.buffer),width:output.width,height:output.height,expected:expected,rejected:rejected};
 }""",fixture)
 assert result['width']==320 and result['height']==180 and result['rejected']
 ts=base64.b64decode(result['data']);assert len(ts)%188==0
 def crc(data):
  n=0xffffffff
  for b in data:
   n^=b<<24
   for _ in range(8):n=((n<<1)^(0x04c11db7 if n&0x80000000 else 0))&0xffffffff
  return n
 streams={256:[],257:[]};current={};cc={};sections={};pcr=[]
 for pos in range(0,len(ts),188):
  packet=ts[pos:pos+188];assert packet[0]==71
  pid=((packet[1]&31)<<8)|packet[2];control=(packet[3]>>4)&3;assert control in [1,3]
  if pid in cc:assert (packet[3]&15)==(cc[pid]+1)%16
  cc[pid]=packet[3]&15;offset=4
  if control==3:
   length=packet[4]
   if length and packet[5]&16:
    b=packet[6:12];pcr.append((b[0]<<25)|(b[1]<<17)|(b[2]<<9)|(b[3]<<1)|(b[4]>>7))
   offset+=length+1
  payload=packet[offset:];start=bool(packet[1]&64)
  if pid in [0,4096]:
   assert start;section=payload[1+payload[0]:];length=((section[1]&15)<<8)|section[2];section=section[:length+3];assert crc(section)==0;sections[pid]=section
  elif pid in streams:
   if start:
    if pid in current:streams[pid].append(bytes(current[pid]))
    current[pid]=bytearray()
   assert pid in current;current[pid].extend(payload)
 for pid,b in current.items():streams[pid].append(bytes(b))
 assert set(sections)=={0,4096};assert sections[4096][12]==27 and sections[4096][17]==15
 def stamp(b):return ((b[0]>>1&7)<<30)|(b[1]<<22)|((b[2]>>1&127)<<15)|(b[3]<<7)|(b[4]>>1&127)
 actual={'video':[],'audio':[]};dts=[]
 for pid,packets in streams.items():
  for pes in packets:
   assert pes[:3]==bytes([0,0,1]);length=int.from_bytes(pes[4:6],'big');assert not length or len(pes)==length+6
   pts=stamp(pes[9:14]);dt=stamp(pes[14:19]);assert pts>=dt;dts.append(dt);body=pes[9+pes[8]:]
   if pid==256:
    for nal in re.split(b'\x00\x00\x00\x01',body)[1:]:
     if nal[0]&31 not in [7,8,9]:actual['video'].append(base64.b64encode(nal).decode())
   else:
    assert body[:2]==bytes([255,241]);size=((body[3]&3)<<11)|(body[4]<<3)|(body[5]>>5);assert size==len(body)
    actual['audio'].append(base64.b64encode(body[7:]).decode())
 assert actual==result['expected'],'Repackaging changed compressed video or audio samples'
 assert len(actual['video'])>=24 and len(actual['audio'])>40
 assert min(dts)>=80000 and len(pcr)==24
 # Late worker callbacks cannot resolve a cancelled session or alter new statistics.
 page.add_script_tag(content="window.__workers=[];window.Worker=function(){this.messages=[];this.postMessage=function(m){this.messages.push(m)};this.terminate=function(){this.terminated=true};__workers.push(this)}")
 page.add_script_tag(path=str(root/'cinema/tv-remux.js'))
 assert page.evaluate("""async()=>{var first=NightRemux.open('https://media.test/a',1080);NightRemux.close();var cancelled=await first.then(()=>false,e=>e.message==='cancelled');var second=NightRemux.open('https://media.test/b',720);__workers[0].onmessage({data:{type:'ready',url:'wrong'}});__workers[1].onmessage({data:{type:'ready',url:'right'}});var result=await second;__workers[1].onmessage({data:{type:'stats',bytes:1000000,seconds:4}});var rate=NightRemux.info().measuredBitrate;NightRemux.close();return cancelled&&result.url==='right'&&rate===2000000&&__workers[1].messages.slice(-1)[0].type==='close'}""")
 # Exercise the HTTP protocol with nonblocking partial socket writes.
 page.route('https://mux.test/**',lambda r:r.fulfill(headers={'Access-Control-Allow-Origin':'*'},body=(
  b'#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=100000,RESOLUTION=320x180\nmedia.m3u8\n' if r.request.url.endswith('master.m3u8') else
  b'#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:1\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:1,\nfragment.m4s\n#EXT-X-ENDLIST\n' if r.request.url.endswith('media.m3u8') else
  base64.b64decode(fixture['init']) if r.request.url.endswith('init.mp4') else base64.b64decode(fixture['fragment']))))
 page.add_script_tag(content=r"""
 window.__messages=[];window.postMessage=function(d){__messages.push(d)};window.importScripts=function(){};
 window.__accepted=[];window.__clients={};window.__responses={};window.__closed=[];window.__next=2;window.__bound=null;
 window.tizentvwasm={SockFlags:{SOCK_NONBLOCK:1},NetAddress:function(f,b,p){this.family=f;this.bytes=b;this.port=p},SocketsManager:{
 create:function(){return 1},bind:function(fd,address){__bound=address},listen:function(){},getSockName:function(){return {port:43210}},
 accept4:function(){if(!__accepted.length)throw Error('again');return __accepted.shift()},
 recv:function(fd,out){var c=__clients[fd];if(c.pos>=c.input.length)throw Error('again');var n=Math.min(out.length,c.input.length-c.pos);out.set(c.input.subarray(c.pos,c.pos+n));c.pos+=n;return n},
 send:function(fd,b){var n=Math.min(97,b.length);__clients[fd].output.push(b.slice(0,n));return n},
 close:function(fd){__closed.push(fd);if(fd===1)return;var c=__clients[fd],length=c.output.reduce((n,b)=>n+b.length,0),out=new Uint8Array(length),offset=0;c.output.forEach(b=>{out.set(b,offset);offset+=b.length});var text=new TextDecoder().decode(out),end=text.indexOf('\r\n\r\n');__responses[fd]={headers:text.slice(0,end),body:Array.from(out.subarray(end+4))}}
 }};
 window.__httpTest=function(path,extra,method){var fd=__next++,input=new TextEncoder().encode((method||'GET')+' '+path+' HTTP/1.1\r\nHost: localhost\r\n'+(extra||'')+'\r\n');__clients[fd]={input:input,pos:0,output:[]};__accepted.push(fd);return fd};
 """)
 page.add_script_tag(path=str(root/'cinema/tv-remux-worker.js'))
 page.evaluate("onmessage({data:{type:'open',url:'https://mux.test/master.m3u8',height:1080,token:'0123456789abcdef0123456789abcdef'}})")
 page.wait_for_function("__messages.some(m=>m.type==='ready')")
 assert page.evaluate("Array.from(__bound.bytes).join('.')")=='127.0.0.1'
 prefix='/0123456789abcdef0123456789abcdef/'
 fd=page.evaluate("p=>__httpTest(p+'index.m3u8')",prefix);page.wait_for_function('fd=>!!__responses[fd]',arg=fd)
 response=page.evaluate('fd=>__responses[fd]',fd);assert '200 OK' in response['headers'];playlist=bytes(response['body']).decode();assert '#EXT-X-MAP' not in playlist and prefix+'segment/0.ts' in playlist
 fd=page.evaluate(r"p=>__httpTest(p+'segment/0.ts','Range: bytes=0-187\r\n')",prefix);page.wait_for_function('fd=>!!__responses[fd]',arg=fd)
 response=page.evaluate('fd=>__responses[fd]',fd);assert '206 Partial Content' in response['headers'] and len(response['body'])==188 and response['body'][0]==71
 fd=page.evaluate("__httpTest('/wrong-session/index.m3u8')");page.wait_for_function('fd=>!!__responses[fd]',arg=fd);assert '404 Error' in page.evaluate('fd=>__responses[fd].headers',fd)
 fd=page.evaluate("p=>__httpTest(p+'index.m3u8','','HEAD')",prefix);page.wait_for_function('fd=>!!__responses[fd]',arg=fd);assert not page.evaluate('fd=>__responses[fd].body',fd)
 fd=page.evaluate(r"p=>__httpTest(p+'segment/0.ts','Range: bytes=99999999-\r\n')",prefix);page.wait_for_function('fd=>!!__responses[fd]',arg=fd);assert '416 Error' in page.evaluate('fd=>__responses[fd].headers',fd)
 page.evaluate("onmessage({data:{type:'close'}})");assert page.evaluate('__closed.includes(1)&&__messages.some(m=>m.type==="closed")')
 browser.close()
print('PASS: TS sync/continuity, PAT/PMT CRC, PCR/PTS/DTS, lossless AVC/AAC samples, unsupported codec rejection, converter cancellation/bitrate, loopback binding, scoped HTTP routes, Range and partial socket writes')
