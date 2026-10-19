(function(){
    'use strict';
    var api=null,session=null,token=0,request=null,deadline=null,poll=null,hideTimer=null,seekTimer=null,held=false;
    var layer=null,buttons=[],buttonIndex=0,prepared=false,variants=[],quality='auto',audio=[],audioIndex=0,url='',position=0,error=null,attempts=[],serverList=[],attempted=[],sourceIndex=0,sources=[],fileChoices=[],qualityRetries=[],qualityFailures=[];
    var sourceName='',serverId='',startAt=0,wasPaused=false,qualityController=null,lastTick=0,stillSince=0,historyTimer=0;
    try{api=webapis.avplay;}catch(ignore){}
    var nativeApi=api,browserApi=null,engine='native',browserTried=false,currentSource=null,pictureCache=null,pictureAt=0,remuxInfo=null;
    function preferredQuality(){try{var value=JSON.parse(localStorage.getItem('night.quality.v1'));if(value==='auto'||[360,480,720,1080,1440,2160].indexOf(value)>=0)return value;}catch(ignore){}return 1080;}
    function saveQuality(value){try{localStorage.setItem('night.quality.v1',JSON.stringify(value));}catch(ignore){}}
    function pictureInfo(){
        if(!prepared)return null;if(pictureCache&&Date.now()-pictureAt<1000)return pictureCache;
        try{if(api.getPlaybackInfo)pictureCache=api.getPlaybackInfo();else{var video=api.getTotalTrackInfo().filter(function(t){return t.type==='VIDEO';})[0],extra=video&&JSON.parse(video.extra_info||'{}');pictureCache=extra?{width:Number(extra.Width)||0,height:Number(extra.Height)||0,bitrate:Number(extra.Bit_rate)||0,variants:[]}:null;}if(engine==='remux'&&pictureCache&&remuxInfo){pictureCache.bitrate=remuxInfo.bitrate||0;pictureCache.measuredBitrate=NightRemux.info().measuredBitrate||0;}pictureAt=Date.now();}catch(ignore){}return pictureCache;
    }
    function pictureTier(p){if(!p||!p.height)return 0;return p.height>=2160||p.width>=3800?2160:p.height>=1440?1440:p.height>=1080||p.width>=1900?1080:p.height>=720||p.width>=1200?720:p.height>=480||p.width>=800?480:p.height;}
    function selectEngine(name){
        stopHardware();engine=name;
        if(name==='browser'){if(!browserApi)browserApi=makeBrowserPlayer();api=browserApi;}
        else{api=nativeApi;if(layer&&!layer.querySelector('object')){var object=document.createElement('object');object.type='application/avplayer';object.className='player-surface';layer.insertBefore(object,layer.firstChild);}}
    }
    function state(){try{return api.getState();}catch(ignore){return 'NONE';}}
    function now(){try{return prepared?api.getCurrentTime()/1000:position;}catch(ignore){return position;}}
    function duration(){try{return prepared?api.getDuration()/1000:0;}catch(ignore){return 0;}}
    function status(text){if(layer)layer.querySelector('#play-status').textContent=text||'';}
    function clock(t){t=Math.max(0,Math.floor(t||0));return Math.floor(t/3600)+':'+('0'+Math.floor(t/60)%60).slice(-2)+':'+('0'+t%60).slice(-2);}
    function stopHardware(){try{api.stop();}catch(ignore){}try{api.close();}catch(ignore){}if(window.NightRemux)NightRemux.close();remuxInfo=null;prepared=false;pictureCache=null;pictureAt=0;}
    function cancel(){token++;clearTimeout(deadline);clearTimeout(seekTimer);if(request){request.cancel();request=null;}if(qualityController){qualityController.abort();qualityController=null;}held=false;}
    function persist(){if(session&&position>5)NightUI.saveProgress(session.meta,session.episode,position,duration(),serverId);}
    function close(){persist();cancel();clearInterval(poll);clearTimeout(hideTimer);stopHardware();if(layer)layer.remove();layer=null;session=null;error=null;document.documentElement.style.background='';document.body.style.background='';NightUI.playerClosed();}
    function show(){if(!layer)return;layer.querySelector('.player-panel').style.opacity='1';clearTimeout(hideTimer);if(prepared&&!error&&state()==='PLAYING'&&!NightUI.hasDialog())hideTimer=setTimeout(function(){if(layer)layer.querySelector('.player-panel').style.opacity='0';},4500);}
    function update(){
        if(!layer)return;var s=state();if(prepared&&(s==='PLAYING'||s==='PAUSED'))position=now();
        layer.querySelector('#play-time').textContent=clock(position)+' / '+clock(duration());
        layer.querySelector('#play-progress').style.width=(duration()?Math.min(100,position/duration()*100):0)+'%';
        buttons[0].textContent=s==='PLAYING'?'Pause':'Weiter';
        var picture=pictureInfo(),tier=pictureTier(picture);layer.querySelector('#play-source').textContent=(sourceName||'Quelle')+' · '+(tier?tier+'p Bild':quality==='auto'?'Auto':quality+'p bevorzugt')+(qualityRetries.length?' / Decoder-Fallback':quality==='auto'?' / Auto':tier&&tier<Number(quality)?' / Wunsch '+quality+'p':'');
        if(Date.now()-historyTimer>10000){historyTimer=Date.now();persist();}
        if(prepared&&s==='NONE'&&!document.hidden&&!error){fail('Der TV hat die Wiedergabe beendet.');return;}
        if(prepared&&s==='PLAYING'){
            if(position>lastTick+.1){lastTick=position;stillSince=Date.now();}
            else if(stillSince&&Date.now()-stillSince>18000){fail('Videodaten kommen nicht an.');}
        }
    }
    function play(){if(!session)return;if(error||state()==='NONE'){attempt(serverId||preferred(),position);return;}try{api.play();wasPaused=false;status('');show();}catch(e){fail('Wiedergabe konnte nicht fortgesetzt werden.');}}
    function pause(){if(prepared&&state()==='PLAYING'){try{api.pause();wasPaused=true;persist();update();show();}catch(ignore){}}}
    function toggle(){state()==='PLAYING'?pause():play();}
    function seek(delta){if(!prepared)return;var run=token,target=Math.max(0,Math.min(duration()-1,now()+delta));status('Springe ...');clearTimeout(seekTimer);seekTimer=setTimeout(function(){if(run===token){status('Springen dauert zu lange. Quelle wechseln oder erneut versuchen.');show();}},12000);try{api.seekTo(Math.round(target*1000),function(){if(run!==token)return;clearTimeout(seekTimer);position=target;lastTick=target;stillSince=Date.now();status('');update();},function(){if(run!==token)return;clearTimeout(seekTimer);status('Springen ist bei dieser Quelle nicht verfügbar.');show();});}catch(ignore){clearTimeout(seekTimer);status('Springen nicht verfügbar.');}show();}
    function tracks(){try{var all=api.getTotalTrackInfo();audio=all.filter(function(t){return t.type==='AUDIO';});audioIndex=Math.min(audioIndex,Math.max(0,audio.length-1));session.tracks=all;return all;}catch(e){NightService.log('track-info',String(e));return null;}}
    function build(){
        document.getElementById('night-app').hidden=true;document.documentElement.style.background='transparent';document.body.style.background='transparent';
        layer=document.createElement('div');layer.className='player-layer';layer.id='night-player';
        layer.innerHTML='<object type="application/avplayer" class="player-surface"></object><div class="player-panel"><div class="player-heading"><h1 id="play-title"></h1><span id="play-source" class="player-source"></span></div><div id="play-status" class="player-status" role="status"></div><div class="progress-track"><div id="play-progress" class="progress-fill"></div></div><div id="play-time" class="player-time"></div><div id="play-actions" class="player-actions"></div><div class="player-help">Pfeile: Auswählen · OK: Bestaetigen · Zurück: Film verlassen</div></div>';
        document.body.appendChild(layer);layer.querySelector('#play-title').textContent=session.meta.name+(session.episode?' · S'+session.episode.season+' E'+session.episode.episode:'');
        var labels=['Pause','−10 Sek.','+10 Sek.','Quelle','Qualität','Ton','Zurück'];var actions=[toggle,function(){seek(-10);},function(){seek(10);},sourceMenu,qualityMenu,audioMenu,close];
        buttons=[];buttonIndex=0;labels.forEach(function(label,i){var b=document.createElement('button');b.textContent=label;b.onclick=actions[i];b.onfocus=function(){buttonIndex=i;show();};layer.querySelector('#play-actions').appendChild(b);buttons.push(b);});buttons[0].focus();poll=setInterval(update,1000);
    }
    function preferred(){var saved=NightUI.progress(session.meta.id);return saved&&saved.server||'vidrift';}
    function nextServer(){var priority=['vidrift','vidrift-auto','salem','tucson','vixsrc-1','vienna','austin','zurich','lisbon','oslo','kyoto','helena'];for(var i=0;i<priority.length;i++)if(attempted.indexOf(priority[i])<0&&serverList.some(function(s){return s.id===priority[i];}))return priority[i];return null;}
    function fail(message){
        var failedHeight=quality==='auto'?Math.max.apply(Math,variants.map(function(v){return v.height;})):Number(quality);
        cancel();error=message;prepared=false;stopHardware();
        if(session&&currentSource&&(engine==='native'||engine==='remux')&&!browserTried){browserTried=true;selectEngine('browser');NightService.log('decoder-fallback',{title:session.meta.name,server:serverId});prepare(currentSource,position,quality);return;}
        var lower=currentSource&&engine==='browser'&&variants.filter(function(v){return !v.file&&v.height&&v.height<failedHeight&&qualityRetries.indexOf(v.height)<0;}).sort(function(a,b){return b.height-a.height;})[0];
        if(lower&&qualityRetries.length<2){qualityFailures.push(failedHeight);qualityRetries.push(lower.height);NightService.log('resolution-fallback',{server:serverId,from:failedHeight,to:lower.height});prepare(currentSource,position,lower.height);return;}
        var attemptInfo=attempts[attempts.length-1];if(attemptInfo){attemptInfo.status='failed';attemptInfo.error=message;}
        NightService.log('playback-failed',{title:session&&session.meta.name,server:serverId,message:message});
        if(sourceIndex+1<sources.length && sourceIndex<2){sourceIndex++;status('Alternative Videodatei wird getestet ...');useSource(sources[sourceIndex],position);return;}
        var next=attempted.length<3?nextServer():null;
        if(next){status(message+' N\u00e4chste Quelle wird getestet ...');var run=token;setTimeout(function(){if(session&&run===token)attempt(next,position);},500);}
        else{status(message+' Wähle eine andere Quelle oder versuche es erneut.');buttonIndex=3;buttons[3].focus();show();}
    }
    function prepare(source,resume,selection){
        var run=token;stopHardware();currentSource=source;url=source.url;startAt=resume||0;quality=selection||'auto';error=null;stillSince=0;
        status('Video wird vorbereitet ...');show();var began=Date.now();
        if(attempts.length)attempts[attempts.length-1].status='preparing';
        clearTimeout(deadline);deadline=setTimeout(function(){if(run===token){cancel();fail('Diese Quelle reagiert nicht auf den TV.');}},18000);
        function openMedia(openUrl){try{
            if(run!==token)return;api.open(openUrl);api.setDisplayRect(0,0,1920,1080);api.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
            try{api.setStreamingProperty('USER_AGENT',navigator.userAgent);}catch(ignore){}
            try{api.setSilent(false);}catch(ignore){}
            if(api.setQualityHeight)api.setQualityHeight(quality==='auto'?0:quality);
            if(engine==='remux'){
                try{api.setStreamingProperty('SET_MODE_4K','TRUE');}catch(ignore){}
                api.setStreamingProperty('ADAPTIVE_INFO','FIXED_MAX_RESOLUTION=3840X2160');
            }else if(quality!=='auto'){
                var known=variants.filter(function(v){return v.height;}),chosen=known.filter(function(v){return v.height<=Number(quality);}).sort(function(a,b){return b.height-a.height;})[0]||known.slice().sort(function(a,b){return a.height-b.height;})[0];
                if(!chosen)chosen=variants.slice().sort(function(a,b){return b.bitrate-a.bitrate;})[0];
                if(chosen&&chosen.bitrate)api.setStreamingProperty('ADAPTIVE_INFO','BITRATES='+chosen.bitrate+'~'+chosen.bitrate+'|STARTBITRATE='+chosen.bitrate);
            }else try{api.setStreamingProperty('ADAPTIVE_INFO','STARTBITRATE=HIGHEST|SKIPBITRATE=HIGHEST');}catch(ignore){}
            try{api.setBufferingParam('PLAYER_BUFFER_FOR_PLAY','PLAYER_BUFFER_SIZE_IN_SECOND',3);api.setBufferingParam('PLAYER_BUFFER_FOR_RESUME','PLAYER_BUFFER_SIZE_IN_SECOND',5);}catch(ignore){}
            api.setListener({onbufferingstart:function(){if(run===token){status('Video puffert ...');show();}},onbufferingcomplete:function(){if(run===token)status('');},oncurrentplaytime:function(t){if(run===token){position=t/1000;update();}},onerror:function(code){if(run===token){NightService.log('native-error',{title:session.meta.name,server:serverId,code:String(code)});cancel();fail('TV kann diese Quelle nicht wiedergeben.');}},onstreamcompleted:function(){if(run===token){persist();NightUI.playbackEnded(session.meta,session.episode);}}});
            api.prepareAsync(function(){
                if(run!==token)return;clearTimeout(deadline);prepared=true;qualityFailures=qualityFailures.filter(function(h){return h!==Number(quality);});try{api.play();}catch(e){fail('Quelle konnte nicht gestartet werden.');return;}position=0;lastTick=0;stillSince=Date.now();
                if(startAt>1){try{api.seekTo(Math.round(startAt*1000),function(){if(run===token&&wasPaused)pause();},function(){});}catch(ignore){}}else if(wasPaused)pause();
                var all=tracks(),info=attempts[attempts.length-1];if(info){info.status='playing';delete info.error;info.engine=engine;info.sourceIndex=sourceIndex;info.requestedQuality=quality;info.prepareMs=Date.now()-began;info.tracks=all;}
                setTimeout(function(){if(run!==token||!session)return;var checked=tracks();if(info&&checked){info.tracks=checked;info.picture=pictureInfo();}},4000);
                status('');update();show();NightService.log('playing',{title:session.meta.name,server:serverId,prepareMs:Date.now()-began});
            },function(){if(run===token){cancel();fail('Quelle konnte nicht vorbereitet werden.');}});
        }catch(e){if(run===token){cancel();fail('Quelle oder Qualität wird vom TV nicht unterstützt.');}}}
        if(engine==='remux')NightRemux.open(url,quality==='auto'?1080:Number(quality)).then(function(info){if(run!==token)return;remuxInfo=info;openMedia(info.url);},function(){if(run===token){cancel();fail('TV-Konverter konnte diese Quelle nicht vorbereiten.');}});
        else openMedia(url);
    }
    function attempt(id,resume){
        if(!session)return;persist();cancel();stopHardware();currentSource=null;error=null;position=resume||0;variants=[];sources=[];fileChoices=[];qualityRetries=[];qualityFailures=[];sourceIndex=0;quality=preferredQuality();serverId=id;
        sourceName=(serverList.filter(function(s){return s.id===id;})[0]||{}).label||id;
        if(attempted.indexOf(id)<0)attempted.push(id);var record={server:id,status:'resolving'};attempts.push(record);
        status(sourceName+' wird gesucht ...');show();update();var run=token;
        request=NightService.source(session.meta,session.episode,id);
        request.promise.then(function(result){if(run!==token)return;request=null;sources=result.sources.filter(function(s){return /^https?:\/\//.test(s.url||'');});sourceIndex=0;if(!sources.length){fail('Keine TV-kompatible Quelle gefunden.');return;}
            if(result.provider){sourceName=/^vidrift/.test(id)?'VidRift / '+result.provider:result.provider;record.provider=result.provider;}
            sources.forEach(function(s){var match=/^(\d{3,4})p?$/.exec(String(s.quality||''));if(match)fileChoices.push({height:Number(match[1]),width:0,bitrate:0,url:s.url,file:true,source:s});});
            if(fileChoices.length===sources.length&&fileChoices.length>1){fileChoices.sort(function(a,b){return b.height-a.height;});sources=fileChoices.map(function(v){return v.source;});}
            var first=chooseFile(preferredQuality());sourceIndex=first?sources.indexOf(first.source):0;useSource(sources[sourceIndex],position);
        },function(e){if(run!==token)return;request=null;fail(e.message||'Quelle nicht verf\u00fcgbar.');});
    }
    function useSource(source,resume){
            var run=token;variants=[];currentSource=null;qualityRetries=[];var converter=/^cinejoy/.test(serverId)&&window.NightRemux&&typeof tizentvwasm!=='undefined'&&typeof Worker!=='undefined';browserTried=!converter&&/^(vidrift|cinejoy)/.test(serverId);selectEngine(converter?'remux':browserTried?'browser':'native');
            if(!/mp4/i.test(source.type||'')&&!/\.mp4(?:$|[?&%])/i.test(source.url)){
                qualityController=new AbortController();var c=qualityController;var timer=setTimeout(function(){c.abort();},8000);
                NightService.playlist(source.url,c.signal).then(function(v){clearTimeout(timer);if(run!==token)return;variants=v.length?v:fileChoices;prepare(source,resume,preferredQuality());},function(e){clearTimeout(timer);if(run===token){variants=fileChoices;NightService.log('playlist-check',String(e));prepare(source,resume,preferredQuality());}});
            }else{variants=fileChoices;prepare(source,resume,preferredQuality());}
    }
    function chooseFile(value){var target=value==='auto'?1080:Number(value);return fileChoices.filter(function(v){return v.height<=target;}).sort(function(a,b){return b.height-a.height;})[0]||fileChoices.slice().sort(function(a,b){return a.height-b.height;})[0];}
    function sourceMenu(group){
        show();
        function row(s){var prior=attempts.filter(function(a){return a.server===s.id;}).pop();return {label:s.label+(s.id===serverId?' · Ausgewaehlt':''),hint:prior?(prior.status==='playing'?'Auf diesem TV gestartet':prior.status==='failed'?'Letzter Versuch fehlgeschlagen · Erneut pruefen':'Wird getestet'):'Fuer diesen Film noch nicht getestet',action:function(){attempted=[];wasPaused=false;attempt(s.id,position);}};}
        var cinejoy=serverList.filter(function(s){return /^cinejoy/.test(s.id);}),primary=serverList.filter(function(s){return ['movy-dallas','vidrift'].indexOf(s.id)>=0;}),other=serverList.filter(function(s){return !/^cinejoy/.test(s.id)&&['movy-dallas','vidrift'].indexOf(s.id)<0;});
        if(group==='cinejoy'){NightUI.dialog('Cinejoy-Server','Server koennen je nach Film andere Kopien liefern oder nicht verfuegbar sein. Eine 4K-Angabe garantiert keine abspielbare 4K-Kopie.',cinejoy.map(row));return;}
        if(group==='more'){NightUI.dialog('Weitere Quellen','Zusaetzliche Anbieter mit wechselnder Verfuegbarkeit. Fehlgeschlagene Quellen koennen hier erneut getestet werden.',other.map(row));return;}
        var rows=[];if(cinejoy.length)rows.push({label:'Cinejoy · '+cinejoy.length+' Server'+(/^cinejoy/.test(serverId)?' · Ausgewaehlt':''),hint:/^cinejoy/.test(serverId)?sourceName:'Nebula, Lisbon, Solara und Athens',action:function(){sourceMenu('cinejoy');}});
        rows=rows.concat(primary.map(row));var current=other.filter(function(s){return s.id===serverId;})[0];if(current)rows.push(row(current));
        if(other.length)rows.push({label:'Weitere Quellen · '+other.length,hint:'Weitere Anbieter und alternative Server ausprobieren',action:function(){sourceMenu('more');}});
        NightUI.dialog('Quelle auswählen','Waehle einen Dienst. Der aktive Server und die tatsaechliche Bildaufloesung stehen im Player.',rows);
    }
    function qualityMenu(){
        var detail='',picture=null;
        try{if(api.getPlaybackInfo){picture=api.getPlaybackInfo();if(picture.variants.length&&(fileChoices.length<2||picture.variants.length>1))variants=picture.variants;}else{var track=tracks().filter(function(t){return t.type==='VIDEO';})[0];var extra=track&&JSON.parse(track.extra_info||'{}');if(extra)picture={width:extra.Width,height:extra.Height,bitrate:extra.Bit_rate||0};}
            if(engine==='remux')picture=pictureInfo();
            if(picture&&picture.width&&picture.height){var rate=picture.measuredBitrate||picture.bitrate;detail='Aktuelles Bild: '+picture.width+' x '+picture.height+(rate?' / '+(rate/1000000).toFixed(1)+' Mbit/s '+(picture.measuredBitrate?'ca. gemessen':'angegeben'):'')+'. ';}
        }catch(ignore){}
        if(qualityRetries.length)detail+='Decoder-Fallback auf eine niedrigere Stufe. Gespeicherter Wunsch: '+preferredQuality()+'. ';
        var fixedFiles=variants.some(function(v){return v.file;}),rows=[{label:'Automatisch'+(quality==='auto'?' · Ausgewaehlt':''),hint:fixedFiles?'Standarddatei bis 1080p. Dieser Anbieter liefert feste Videodateien.':engine==='remux'?'Hoechste angebotene Stufe bis 1080p. Die Auswahl erfolgt beim Start.':'Der TV passt die Bitrate an die Verbindung an.',action:function(){changeQuality('auto');}}],seen={};
        variants.slice().sort(function(a,b){return b.height-a.height;}).forEach(function(v){var tier=pictureTier(v);if(!tier||seen[tier])return;seen[tier]=true;var failed=qualityFailures.indexOf(v.height)>=0;rows.push({label:tier+'p'+(failed?' · Erneut testen':Number(quality)===tier?' · Ausgewaehlt':''),hint:(failed?'Letzter Versuch auf diesem TV fehlgeschlagen. ':'')+(v.bitrate?(v.bitrate/1000000).toFixed(1)+' Mbit/s · ':'')+(v.file?'Separate Videodatei':'in dieser Quelle vorhanden'),action:function(){changeQuality(tier);}});});
        if(rows.length===1)rows.push({label:variants.length>1?'Streamstufen ohne Aufloesungsangabe':'Originalqualität'+(pictureTier(picture)?' / '+pictureTier(picture)+'p-Klasse':''),hint:variants.length>1?'Dieser Anbieter nennt nur Bitraten. Eine feste Aufloesung kann hier nicht zugesichert werden.':'Diese Datei bietet keine weiteren Auflösungen. Eine andere Quelle kann höher auflösen.',disabled:true});
        rows.push({label:'Andere Quelle vergleichen',hint:'Eine andere Quelle kann eine bessere Bildqualität anbieten.',action:sourceMenu});
        NightUI.dialog('Bildqualität',detail+(quality==='auto'?(engine==='remux'?'Automatische Startauswahl bis 1080p. ':'Automatische Anpassung. '):'Bevorzugt: '+quality+'p. ')+'Deine Auswahl gilt auch für weitere Filme und Quellen. '+(engine==='remux'?'Bei Pufferung eine niedrigere Stufe waehlen.':'Bei Pufferung Automatisch wählen.'),rows);
    }
    function changeQuality(value){if(!url)return;saveQuality(value);var resume=now();wasPaused=state()==='PAUSED';qualityRetries=[];cancel();var file=variants.some(function(v){return v.file;})&&chooseFile(value);if(file){sourceIndex=sources.indexOf(file.source);useSource(file.source,resume);}else prepare({url:url},resume,value);}
    function audioMenu(){
        NightUI.dialog('Tonspur','Tonspuren aus der laufenden Quelle.',audio.length?audio.map(function(t,i){var info={};try{info=JSON.parse(t.extra_info||'{}');}catch(ignore){}return {label:(info.language||'Spur '+(i+1))+(i===audioIndex?' · Ausgewaehlt':''),hint:(info.channels||'?')+' Kanäle',action:function(){try{api.setSelectTrack('AUDIO',t.index);audioIndex=i;status('Tonspur gewechselt.');show();}catch(ignore){status('Tonspur nicht verfügbar.');}}};}):[{label:'Originalton der Quelle',hint:'Diese Quelle bietet keine umschaltbaren Tonspuren an.',disabled:true}]);
    }
    window.NightPlayer={
        play:function(meta,episode,resume){if(session)close();if(!api){NightUI.notice('Samsung-Videoplayer ist nicht verfügbar.');return;}session={meta:meta,episode:episode||null,tracks:null};position=resume||0;attempts=[];attempted=[];audio=[];audioIndex=0;serverId='';sourceName='';url='';variants=[];quality=preferredQuality();wasPaused=false;build();var opening=token;NightService.servers().then(function(list){if(!session||opening!==token)return;serverList=list;attempt(preferred(),position);},function(){if(session&&opening===token){serverList=[{id:'vienna',label:'Vienna'},{id:'salem',label:'Salem'},{id:'austin',label:'Austin'}];attempt(preferred(),position);}});},
        active:function(){return !!session;},close:close,pause:pause,show:show,
        state:function(){return {active:!!session,title:session&&session.meta.name,episode:session&&session.episode,engine:engine,state:state(),prepared:prepared,picture:pictureInfo(),time:now(),duration:duration(),server:serverId,quality:quality,variants:variants.map(function(v){return {height:v.height,width:v.width,bitrate:v.bitrate};}),error:error,attempts:attempts};},
        key:function(e){var k=e.keyCode;if(!session)return false;if(!((k>=37&&k<=40)||k===13||k===27||k===10009||k===10252||k===415||k===19))return false;e.preventDefault();show();if(k===13){held=true;return true;}if(k===27||k===10009){close();return true;}if(k===10252){toggle();return true;}if(k===415){play();return true;}if(k===19){pause();return true;}if(k===37)buttonIndex=Math.max(0,buttonIndex-1);if(k===39)buttonIndex=Math.min(buttons.length-1,buttonIndex+1);buttons[buttonIndex].focus();return true;},
        keyUp:function(e){if(e.keyCode!==13||!held||!session)return false;e.preventDefault();held=false;buttons[buttonIndex].click();return true;}
    };
    document.addEventListener('visibilitychange',function(){if(document.hidden)pause();});
})();
