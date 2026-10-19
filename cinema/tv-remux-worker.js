/* Local-only HLS converter. No disk writes, external proxy, or transcoding. */
importScripts('mp4box.min.js','tv-ts-mux.js');
(function(){
    'use strict';
    var sockets=null,listener=null,timer=null,active=true,clients=[],controllers=[],prefix='',playlist='',init=null,segments=[],durations=[],cache={},cacheOrder=[],pending={};
    var encoder=new TextEncoder(),decoder=new TextDecoder();
    function upstream(url){var u=new URL(url);if(!/^https?:$/.test(u.protocol)||/^(localhost|127\.|\[?::1)/i.test(u.hostname))throw Error('Invalid media URL');return u.href;}
    function bytes(url,limit){
        var controller=new AbortController(),timeout=setTimeout(function(){controller.abort();},15000);controllers.push(controller);
        return fetch(upstream(url),{signal:controller.signal}).then(function(r){
            if(!r.ok||Number(r.headers.get('Content-Length'))>limit){if(r.body)r.body.cancel();controller.abort();throw Error(r.ok?'Media response too large':'Media HTTP '+r.status);}
            if(!r.body)return r.arrayBuffer();var reader=r.body.getReader(),chunks=[],total=0;
            function read(){return reader.read().then(function(part){if(part.done){var result=new Uint8Array(total),offset=0;chunks.forEach(function(c){result.set(c,offset);offset+=c.length;});return result.buffer;}total+=part.value.length;if(total>limit){reader.cancel();controller.abort();throw Error('Media response too large');}chunks.push(part.value);return read();});}return read();
        }).then(function(b){if(b.byteLength>limit)throw Error('Media response too large');return b;}).then(function(b){clearTimeout(timeout);controllers.splice(controllers.indexOf(controller),1);if(!active)throw Error('cancelled');return b;},function(e){clearTimeout(timeout);var i=controllers.indexOf(controller);if(i>=0)controllers.splice(i,1);throw e;});
    }
    function text(url){return bytes(url,524288).then(function(b){var s=decoder.decode(b);if(s.trim().indexOf('#EXTM3U')!==0)throw Error('Invalid HLS playlist');return s;});}
    function media(url,height){return text(url).then(function(s){
        var lines=s.split(/\r?\n/),variants=[];
        lines.forEach(function(line,i){if(line.indexOf('#EXT-X-STREAM-INF:')!==0)return;if(/AUDIO=/.test(line))throw Error('Separate audio groups are not supported');var h=/RESOLUTION=\d+x(\d+)/.exec(line),b=/BANDWIDTH=(\d+)/.exec(line),next=lines[i+1];if(next&&next[0]!=='#')variants.push({height:h?Number(h[1]):0,bitrate:b?Number(b[1]):0,url:upstream(new URL(next,url).href)});});
        if(!variants.length)return {url:url,text:s,bitrate:0};
        var available=variants.filter(function(v){return !v.height||v.height<=height;});if(!available.length)available=variants;
        available.sort(function(a,b){return b.height-a.height||b.bitrate-a.bitrate;});var chosen=available[0];
        return text(chosen.url).then(function(body){return {url:chosen.url,text:body,bitrate:chosen.bitrate};});
    });}
    function segment(index){
        if(cache[index])return Promise.resolve(cache[index]);if(pending[index])return pending[index];
        pending[index]=bytes(segments[index],33554432).then(function(b){var result=new Uint8Array(NightTsMux.convert(init,b).buffer);postMessage({type:'stats',bytes:b.byteLength,seconds:durations[index]});cache[index]=result;cacheOrder.push(String(index));while(cacheOrder.length>2)delete cache[cacheOrder.shift()];delete pending[index];return result;}).catch(function(e){delete pending[index];throw e;});return pending[index];
    }
    function resource(path){
        if(path===prefix+'index.m3u8')return Promise.resolve({body:encoder.encode(playlist),mime:'application/vnd.apple.mpegurl'});
        var match=new RegExp('^'+prefix+'segment/(\\d+)\\.ts$').exec(path),index=match&&Number(match[1]);
        if(!match||index>=segments.length)return Promise.resolve({body:encoder.encode('Not found'),mime:'text/plain',status:404});
        return segment(index).then(function(b){return {body:b,mime:'video/mp2t'};});
    }
    function drop(client){try{sockets.close(client.fd);}catch(ignore){}var i=clients.indexOf(client);if(i>=0)clients.splice(i,1);}
    function response(client,result){
        if(!active||clients.indexOf(client)<0)return;
        var body=result.body,lo=0,hi=body.length-1,status=result.status||200,range=status===200?/^bytes=(\d+)-(\d*)$/i.exec(client.range||''):null;
        if(status===200&&client.range&&!range){status=416;body=new Uint8Array(0);}
        else if(range){lo=Number(range[1]);hi=range[2]?Math.min(hi,Number(range[2])):hi;if(lo>hi){status=416;body=new Uint8Array(0);}else status=206;}
        var header='HTTP/1.1 '+status+' '+(status===200?'OK':status===206?'Partial Content':'Error')+'\r\nContent-Type: '+result.mime+'\r\nConnection: close\r\nCache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\nAccept-Ranges: bytes\r\n';
        if(status===206){header+='Content-Range: bytes '+lo+'-'+hi+'/'+body.length+'\r\n';body=body.subarray(lo,hi+1);}
        if(status===416)header+='Content-Range: bytes */'+result.body.length+'\r\n';
        header+='Content-Length: '+body.length+'\r\n\r\n';client.out=[encoder.encode(header),client.head?new Uint8Array(0):body];client.part=0;client.offset=0;client.at=Date.now();
    }
    function tick(){
        if(!active)return;
        for(var a=0;a<4&&clients.length<6;a++){try{clients.push({fd:sockets.accept4(listener,tizentvwasm.SockFlags.SOCK_NONBLOCK),input:'',at:Date.now(),loading:false,out:null});}catch(ignore){break;}}
        clients.slice().forEach(function(c){
            if(Date.now()-c.at>25000){drop(c);return;}
            if(c.out){try{for(var n=0;n<8;n++){if(c.part>=c.out.length){drop(c);return;}var chunk=c.out[c.part];if(c.offset===chunk.length){c.part++;c.offset=0;continue;}var count=sockets.send(c.fd,chunk.subarray(c.offset,Math.min(chunk.length,c.offset+65536)),0);if(count<=0)return;c.offset+=count;c.at=Date.now();}}catch(ignore){}return;}
            if(c.loading)return;
            try{var buffer=new Uint8Array(4096),read=sockets.recv(c.fd,buffer,0);if(read===0){drop(c);return;}c.input+=decoder.decode(buffer.subarray(0,read));}catch(ignore){return;}
            if(c.input.length>8192){drop(c);return;}if(c.input.indexOf('\r\n\r\n')<0)return;
            var line=/^(GET|HEAD) ([^ ]+) HTTP\/1\.[01]\r\n/.exec(c.input);if(!line){drop(c);return;}c.head=line[1]==='HEAD';var range=/\r\nRange:\s*([^\r\n]+)/i.exec(c.input);c.range=range&&range[1];c.loading=true;
            resource(line[2]).then(function(r){response(c,r);},function(){response(c,{body:encoder.encode('Media conversion failed'),mime:'text/plain',status:502});});
        });
    }
    function stop(){active=false;clearInterval(timer);controllers.slice().forEach(function(c){c.abort();});clients.slice().forEach(drop);if(listener!==null)try{sockets.close(listener);}catch(ignore){}listener=null;cache={};pending={};postMessage({type:'closed'});}
    onmessage=function(event){
        var data=event.data;if(data.type==='close'){stop();return;}if(data.type!=='open'||listener!==null)return;
        if(!/^[a-f0-9]{32}$/.test(data.token)){postMessage({type:'error',message:'Invalid converter session'});return;}prefix='/'+data.token+'/';
        media(upstream(data.url),Number(data.height)||1080).then(function(m){
            var lines=m.text.split(/\r?\n/),map=null,output=['#EXTM3U','#EXT-X-VERSION:3'],durationPending=false,seconds=0;
            lines.forEach(function(line){
                if(/^#EXT-X-KEY:/.test(line)&&!/^#EXT-X-KEY:METHOD=NONE\s*$/.test(line))throw Error('Encrypted streams are not converted');
                if(/^#EXT-X-BYTERANGE:/.test(line))throw Error('Byte-range streams are not converted');
                if(/^#EXT-X-MAP:/.test(line)){var match=/URI="([^"]+)"/.exec(line);if(!match)throw Error('Invalid initialization segment');var next=upstream(new URL(match[1],m.url).href);if(map&&map!==next)throw Error('Changing initialization segments are not supported');map=next;}
                else if(/^#EXTINF:/.test(line)){seconds=Number(line.slice(8).split(',')[0]);if(!(seconds>0&&seconds<120))throw Error('Invalid segment duration');output.push(line);durationPending=true;}
                else if(line&&line[0]!=='#'){if(!durationPending)throw Error('Missing segment duration');output.push(prefix+'segment/'+segments.length+'.ts');segments.push(upstream(new URL(line,m.url).href));durations.push(seconds);durationPending=false;}
                else if(/^#EXT-X-(TARGETDURATION|MEDIA-SEQUENCE|DISCONTINUITY-SEQUENCE|DISCONTINUITY|ENDLIST)(:|$)/.test(line))output.push(line);
            });
            if(!map||!segments.length||segments.length>10000||durationPending||m.text.indexOf('#EXT-X-ENDLIST')<0)throw Error('Converter requires a finite fMP4 HLS playlist');
            playlist=output.join('\n')+'\n';return bytes(map,262144).then(function(b){init=b;var info=NightTsMux.describe(init);return {width:info.width,height:info.height,bitrate:m.bitrate};});
        }).then(function(info){
            if(!active)return;sockets=tizentvwasm.SocketsManager;if(!sockets)throw Error('TV sockets are unavailable');listener=sockets.create('af_inet','sock_stream',tizentvwasm.SockFlags.SOCK_NONBLOCK);
            sockets.bind(listener,new tizentvwasm.NetAddress('af_inet',new Uint8Array([127,0,0,1]),0));sockets.listen(listener,4);timer=setInterval(tick,8);
            postMessage({type:'ready',url:'http://127.0.0.1:'+sockets.getSockName(listener).port+prefix+'index.m3u8',width:info.width,height:info.height,bitrate:info.bitrate});
        }).catch(function(e){if(active)postMessage({type:'error',message:String(e)});});
    };
})();
