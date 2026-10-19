(function(){
    'use strict';
    if(!window.globalThis)window.globalThis=window;
    if(!window.queueMicrotask)window.queueMicrotask=function(fn){Promise.resolve().then(fn).catch(function(error){setTimeout(function(){throw error;},0);});};
    if(!Object.fromEntries)Object.fromEntries=function(pairs){var result={};Array.from(pairs).forEach(function(pair){Object.defineProperty(result,pair[0],{value:pair[1],writable:true,enumerable:true,configurable:true});});return result;};
    if(!Intl.DisplayNames)Intl.DisplayNames=function(){this.of=function(code){return code;};};
    var clients={},pending={};
    function load(name){
        if(clients[name])return Promise.resolve(clients[name]);
        if(pending[name])return pending[name];
        pending[name]=new Promise(function(resolve,reject){
            var script=document.createElement('script'),done=false;
            var timer=setTimeout(function(){finish(Error('Dienst-Client antwortet nicht'));},15000);
            function finish(error){if(done)return;done=true;clearTimeout(timer);script.onload=script.onerror=null;if(error){delete pending[name];script.remove();reject(error);}else resolve(clients[name]);}
            script.src='site-clients/'+name+'.js';
            script.onload=function(){finish(clients[name]?null:Error('Dienst-Client konnte nicht gestartet werden'));};
            script.onerror=function(){finish(Error('Dienst-Client fehlt. Optionale Site-Clients beim Bauen vorbereiten.'));};
            document.head.appendChild(script);
        });
        return pending[name];
    }
    function normalize(data){
        var list=data.sources||data.stream||[],sources=[];
        if(!Array.isArray(list))list=Object.keys(list).map(function(k){return {url:list[k],quality:k};});
        list.forEach(function(s){
            var url=s.url||s.playlist||s.file;
            if(typeof url!=='string'||!/^https?:\/\//.test(url))return;
            sources.push({url:url,type:s.type==='file'||s.type==='mp4'?'file':'hls',quality:s.quality||'auto',label:s.label||s.quality||''});
        });
        if(!sources.length)throw Error('Dieser Dienst liefert keine abspielbare Quelle');
        return sources;
    }
    function source(meta,episode,id){
        var name=id.indexOf('cinejoy')===0?'cinejoy':'movy',cancelled=false,finished=false,timer;
        var rejectRequest;
        var promise=new Promise(function(resolve,reject){
            rejectRequest=reject;
            timer=setTimeout(function(){finished=true;cancelled=true;reject(Error('Dienst antwortet nicht rechtzeitig'));},45000);
            load(name).then(function(client){
                if(cancelled)throw Error('cancelled');
                if(name==='cinejoy'){
                    var suffix=id.slice(8),provider=id==='cinejoy'?'Nebula':suffix.charAt(0).toUpperCase()+suffix.slice(1);
                    return (meta.type==='series'?client.series(provider,String(meta.tmdbId),episode.season,episode.episode,meta.id,meta.year,meta.name):client.movie(provider,String(meta.tmdbId),meta.id,meta.year,meta.name)).then(function(data){return {provider:provider,data:data};});
                }
                var requested=id==='movy'?'miami':id.slice(5);
                var provider=client.providers.filter(function(p){return p.name.toLowerCase()===requested;})[0];
                if(!provider)throw Error('Movy-Anbieter nicht verfuegbar');
                var providerName=provider.name;
                return provider.get({title:meta.name,extraData:{mediaType:meta.type==='series'?'tv':'movie',year:meta.year,tmdbId:meta.tmdbId,imdbId:meta.id,seasonId:episode?episode.season:1,episodeId:episode?episode.episode:1,totalSeasons:meta.totalSeasons}}).then(function(data){return {provider:providerName,data:data};});
            }).then(function(result){if(cancelled)return;finished=true;clearTimeout(timer);try{resolve({server:id,provider:(name==='movy'?'Movy':'Cinejoy')+' / '+result.provider,sources:normalize(result.data)});}catch(error){reject(error);}},function(error){if(cancelled)return;finished=true;clearTimeout(timer);reject(error);});
        });
        return {promise:promise,cancel:function(){if(cancelled||finished)return;cancelled=true;clearTimeout(timer);rejectRequest(Error('cancelled'));}};
    }
    window.NightSites={register:function(name,client){clients[name]=client;},source:source,servers:function(){return [
        {id:'movy-dallas',label:'Movy / Dallas'},
        {id:'cinejoy',label:'Cinejoy / Nebula'},
        {id:'cinejoy-lisbon',label:'Cinejoy / Lisbon'},
        {id:'cinejoy-solara',label:'Cinejoy / Solara'},
        {id:'cinejoy-athens',label:'Cinejoy / Athens'}
    ];}};
})();
