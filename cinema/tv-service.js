(function(){
    'use strict';
    var base='https://movienig.ht',prefix='night.catalog.v3.',memory={},servers=null;
    try{Object.keys(localStorage).filter(function(k){return k.indexOf('tvcompat.catalog.')===0;}).forEach(function(k){localStorage.removeItem(k);});}catch(ignore){}
    window.__nightLog=[];
    function log(name,data){__nightLog.push({at:Date.now(),name:name,data:data});if(__nightLog.length>100)__nightLog.shift();}
    function json(path){
        var cached=memory[path];
        if(!cached)try{cached=JSON.parse(localStorage.getItem(prefix+path));}catch(ignore){}
        if(cached&&Date.now()-cached.at<1800000)return Promise.resolve(cached.value);
        var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},12000);
        return fetch(base+path,{credentials:'include',signal:controller.signal}).then(function(r){if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).then(function(value){
            clearTimeout(timer);memory[path]={at:Date.now(),value:value};var memoryKeys=Object.keys(memory);if(memoryKeys.length>40)delete memory[memoryKeys[0]];
            if(path.indexOf('/api/discover/')===0){setTimeout(function(){try{var text=JSON.stringify(memory[path]);if(text.length<200000){var keys=Object.keys(localStorage).filter(function(k){return k.indexOf(prefix)===0;});if(keys.length>=24&&keys.indexOf(prefix+path)<0)localStorage.removeItem(keys[0]);localStorage.setItem(prefix+path,text);}}catch(ignore){}},100);}
            return value;
        },function(e){clearTimeout(timer);throw e;});
    }
    function source(meta,episode,server,onTrying){
        if(server==='vidrift')return vidrift(meta,episode);
        var type=meta.type==='series'?'tv':'movie';
        var path='/api/stream/v1/'+type+'/'+encodeURIComponent(meta.tmdbId)+(type==='tv'?'/'+episode.season+'/'+episode.episode:'');
        var q=new URLSearchParams({title:meta.name,imdbId:meta.id,year:meta.year||'',server:server,only:'1',fresh:'1'});
        var stream=null,timer=null,settled=false,rejectRequest;
        var promise=new Promise(function(resolve,reject){
            rejectRequest=reject;stream=new EventSource(base+path+'?'+q.toString(),{withCredentials:true});
            function finish(error,result){if(settled)return;settled=true;clearTimeout(timer);stream.close();if(error)reject(error);else resolve(result);}
            timer=setTimeout(function(){finish(Error('Quelle antwortet nicht'));},16000);
            stream.addEventListener('trying',function(e){if(onTrying)onTrying(e.data);});
            stream.addEventListener('done',function(e){try{var result=JSON.parse(e.data);if(!result.sources||!result.sources.length)throw Error('Keine Videodatei gefunden');finish(null,result);}catch(error){finish(error);}});
            stream.addEventListener('stream-error',function(e){var message='Quelle nicht verfuegbar';try{message=JSON.parse(e.data).message||message;}catch(ignore){}finish(Error(message));});
            stream.onerror=function(){finish(Error('Verbindung zur Quelle fehlgeschlagen'));};
        });
        return {promise:promise,cancel:function(){if(settled)return;settled=true;clearTimeout(timer);if(stream)stream.close();rejectRequest(Error('cancelled'));}};
    }
    function vidrift(meta,episode){
        var origin='https://embed.vidrift.in',path=meta.type==='series'?'tv/'+meta.tmdbId+'/'+episode.season+'/'+episode.episode:'movie/'+meta.tmdbId;
        var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},35000);
        function get(url){return fetch(url,{signal:controller.signal}).then(function(r){if(!r.ok)throw Error('VidRift HTTP '+r.status);return r.text();});}
        var promise=get(origin+'/embed/'+path).then(function(text){
            var match=/var embedMeta = (\{.*?\});<\/script>/.exec(text);if(!match)throw Error('VidRift liefert keine Playerdaten');var data=JSON.parse(match[1]);
            if(data.unreleased)throw Error('Titel auf VidRift noch nicht verfuegbar');if(!data.playbackToken)throw Error('VidRift hat keinen Playback-Token ausgegeben');
            return get(origin+'/api/source/'+path+'?token='+encodeURIComponent(data.playbackToken));
        }).then(function(text){var data=JSON.parse(text),list=[];(data.streams||[]).forEach(function(s){var first=s.url||s.proxyUrl;if(first)list.push({url:new URL(first,origin).href,type:s.type||'hls',quality:s.quality||'auto'});if(s.proxyUrl&&s.proxyUrl!==first)list.push({url:new URL(s.proxyUrl,origin).href,type:s.type||'hls',quality:s.quality||'auto'});});if(!list.length)throw Error('VidRift hat keine Quelle gefunden');clearTimeout(timer);return {server:'vidrift',sources:list};},function(e){clearTimeout(timer);throw e;});
        return {promise:promise,cancel:function(){clearTimeout(timer);controller.abort();}};
    }
    function playlist(url,signal){return fetch(url,{signal:signal}).then(function(r){if(!r.ok)throw Error('Playlist HTTP '+r.status);if(!r.body)return r.text();var reader=r.body.getReader(),decoder=new TextDecoder(),text='',bytes=0;function read(){return reader.read().then(function(chunk){if(chunk.done)return text+decoder.decode();bytes+=chunk.value.length;if(bytes>500000){reader.cancel();throw Error('Keine gueltige Playlist');}text+=decoder.decode(chunk.value,{stream:true});return read();});}return read();}).then(function(text){
        if(text.trim().indexOf('#EXTM3U')!==0)throw Error('Quelle liefert keine Video-Playlist');
        var lines=text.split(/\r?\n/),variants=[];
        lines.forEach(function(line,i){if(line.indexOf('#EXT-X-STREAM-INF:')!==0)return;var resolution=/RESOLUTION=(\d+)x(\d+)/i.exec(line),bandwidth=/BANDWIDTH=(\d+)/.exec(line);var next=lines[i+1];if(next&&next.charAt(0)!=='#')variants.push({height:resolution?Number(resolution[2]):0,width:resolution?Number(resolution[1]):0,bitrate:bandwidth?Number(bandwidth[1]):0,url:new URL(next,url).href});});
        return variants;
    });}
    window.NightService={json:json,source:source,playlist:playlist,log:log,servers:function(){if(servers)return Promise.resolve(servers);return json('/api/servers').then(function(r){servers=[{id:'vidrift',label:'VidRift'}].concat(r.servers||[]);return servers;},function(){servers=[{id:'vidrift',label:'VidRift'},{id:'salem',label:'Salem'},{id:'tucson',label:'Tucson'}];return servers;});}};
})();
