(function(){
    'use strict';
    var api=null,session=null,token=0,request=null,deadline=null,poll=null,hideTimer=null,seekTimer=null,held=false;
    var layer=null,buttons=[],buttonIndex=0,prepared=false,variants=[],quality='auto',audio=[],audioIndex=0,url='',position=0,error=null,attempts=[],serverList=[],attempted=[],sourceIndex=0,sources=[];
    var sourceName='',serverId='',startAt=0,wasPaused=false,qualityController=null,lastTick=0,stillSince=0,historyTimer=0;
    try{api=webapis.avplay;}catch(ignore){}
    var nativeApi=api,browserApi=null,engine='native',browserTried=false,currentSource=null,pictureCache=null,pictureAt=0;
    function preferredQuality(){try{var value=JSON.parse(localStorage.getItem('night.quality.v1'));if(value==='auto'||[360,480,720,1080,1440,2160].indexOf(value)>=0)return value;}catch(ignore){}return 1080;}
    function saveQuality(value){try{localStorage.setItem('night.quality.v1',JSON.stringify(value));}catch(ignore){}}
    function pictureInfo(){
        if(!prepared)return null;if(pictureCache&&Date.now()-pictureAt<1000)return pictureCache;
        try{if(api.getPlaybackInfo)pictureCache=api.getPlaybackInfo();else{var video=api.getTotalTrackInfo().filter(function(t){return t.type==='VIDEO';})[0],extra=video&&JSON.parse(video.extra_info||'{}');pictureCache=extra?{width:Number(extra.Width)||0,height:Number(extra.Height)||0,bitrate:Number(extra.Bit_rate)||0,variants:[]}:null;}pictureAt=Date.now();}catch(ignore){}return pictureCache;
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
    function stopHardware(){try{api.stop();}catch(ignore){}try{api.close();}catch(ignore){}prepared=false;pictureCache=null;pictureAt=0;}
    function cancel(){token++;clearTimeout(deadline);clearTimeout(seekTimer);if(request){request.cancel();request=null;}if(qualityController){qualityController.abort();qualityController=null;}held=false;}
    function persist(){if(session&&position>5)NightUI.saveProgress(session.meta,session.episode,position,duration(),serverId);}
    function close(){persist();cancel();clearInterval(poll);clearTimeout(hideTimer);stopHardware();if(layer)layer.remove();layer=null;session=null;error=null;document.documentElement.style.background='';document.body.style.background='';NightUI.playerClosed();}
    function show(){if(!layer)return;layer.querySelector('.player-panel').style.opacity='1';clearTimeout(hideTimer);if(prepared&&!error&&state()==='PLAYING'&&!NightUI.hasDialog())hideTimer=setTimeout(function(){if(layer)layer.querySelector('.player-panel').style.opacity='0';},4500);}
    function update(){
        if(!layer)return;var s=state();if(prepared&&(s==='PLAYING'||s==='PAUSED'))position=now();
        layer.querySelector('#play-time').textContent=clock(position)+' / '+clock(duration());
        layer.querySelector('#play-progress').style.width=(duration()?Math.min(100,position/duration()*100):0)+'%';
        buttons[0].textContent=s==='PLAYING'?'Pause':'Weiter';
        var picture=pictureInfo(),tier=pictureTier(picture);layer.querySelector('#play-source').textContent=(sourceName||'Quelle')+' · '+(tier?tier+'p Bild':quality==='auto'?'Auto':quality+'p bevorzugt')+(quality==='auto'?' / Auto':tier&&tier<Number(quality)?' / Wunsch '+quality+'p':'');
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
        cancel();error=message;prepared=false;stopHardware();
        if(session&&currentSource&&engine==='native'&&!browserTried){browserTried=true;selectEngine('browser');NightService.log('decoder-fallback',{title:session.meta.name,server:serverId});prepare(currentSource,position,quality);return;}
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
        try{
            api.open(url);api.setDisplayRect(0,0,1920,1080);api.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
            try{api.setStreamingProperty('USER_AGENT',navigator.userAgent);}catch(ignore){}
            try{api.setSilent(false);}catch(ignore){}
            if(api.setQualityHeight)api.setQualityHeight(quality==='auto'?0:quality);
            if(quality!=='auto'){
                var chosen=variants.filter(function(v){return v.height&&v.height<=Number(quality);}).sort(function(a,b){return b.height-a.height;})[0]||variants.slice().sort(function(a,b){return a.height-b.height;})[0];
                if(chosen&&chosen.bitrate)api.setStreamingProperty('ADAPTIVE_INFO','BITRATES='+chosen.bitrate+'~'+chosen.bitrate+'|STARTBITRATE='+chosen.bitrate);
            }else try{api.setStreamingProperty('ADAPTIVE_INFO','STARTBITRATE=HIGHEST|SKIPBITRATE=HIGHEST');}catch(ignore){}
            try{api.setBufferingParam('PLAYER_BUFFER_FOR_PLAY','PLAYER_BUFFER_SIZE_IN_SECOND',3);api.setBufferingParam('PLAYER_BUFFER_FOR_RESUME','PLAYER_BUFFER_SIZE_IN_SECOND',5);}catch(ignore){}
            api.setListener({onbufferingstart:function(){if(run===token){status('Video puffert ...');show();}},onbufferingcomplete:function(){if(run===token)status('');},oncurrentplaytime:function(t){if(run===token){position=t/1000;update();}},onerror:function(code){if(run===token){NightService.log('native-error',{title:session.meta.name,server:serverId,code:String(code)});cancel();fail('TV kann diese Quelle nicht wiedergeben.');}},onstreamcompleted:function(){if(run===token){persist();NightUI.playbackEnded(session.meta,session.episode);}}});
            api.prepareAsync(function(){
                if(run!==token)return;clearTimeout(deadline);prepared=true;try{api.play();}catch(e){fail('Quelle konnte nicht gestartet werden.');return;}position=0;lastTick=0;stillSince=Date.now();
                if(startAt>1){try{api.seekTo(Math.round(startAt*1000),function(){if(run===token&&wasPaused)pause();},function(){});}catch(ignore){}}else if(wasPaused)pause();
                var all=tracks(),info=attempts[attempts.length-1];if(info){info.status='playing';delete info.error;info.engine=engine;info.sourceIndex=sourceIndex;info.requestedQuality=quality;info.prepareMs=Date.now()-began;info.tracks=all;}
                setTimeout(function(){if(run!==token||!session)return;var checked=tracks();if(info&&checked){info.tracks=checked;info.picture=pictureInfo();}},4000);
                status('');update();show();NightService.log('playing',{title:session.meta.name,server:serverId,prepareMs:Date.now()-began});
            },function(){if(run===token){cancel();fail('Quelle konnte nicht vorbereitet werden.');}});
        }catch(e){if(run===token){cancel();fail('Quelle oder Qualität wird vom TV nicht unterstützt.');}}
    }
    function attempt(id,resume){
        if(!session)return;persist();cancel();stopHardware();currentSource=null;error=null;position=resume||0;variants=[];sources=[];sourceIndex=0;quality=preferredQuality();serverId=id;
        sourceName=(serverList.filter(function(s){return s.id===id;})[0]||{}).label||id;
        if(attempted.indexOf(id)<0)attempted.push(id);var record={server:id,status:'resolving'};attempts.push(record);
        status(sourceName+' wird gesucht ...');show();update();var run=token;
        request=NightService.source(session.meta,session.episode,id);
        request.promise.then(function(result){if(run!==token)return;request=null;sources=result.sources.filter(function(s){return /^https?:\/\//.test(s.url||'');});sourceIndex=0;if(!sources.length){fail('Keine TV-kompatible Quelle gefunden.');return;}
            if(result.provider&&/^vidrift/.test(id)){sourceName='VidRift / '+result.provider;record.provider=result.provider;}
            useSource(sources[0],position);
        },function(e){if(run!==token)return;request=null;fail(e.message||'Quelle nicht verf\u00fcgbar.');});
    }
    function useSource(source,resume){
            var run=token;variants=[];currentSource=null;browserTried=/^vidrift/.test(serverId);selectEngine(browserTried?'browser':'native');
            if(!/mp4/i.test(source.type||'')&&!/\.mp4(?:$|[?&%])/i.test(source.url)){
                qualityController=new AbortController();var c=qualityController;var timer=setTimeout(function(){c.abort();},8000);
                NightService.playlist(source.url,c.signal).then(function(v){clearTimeout(timer);if(run!==token)return;variants=v;prepare(source,resume,preferredQuality());},function(e){clearTimeout(timer);if(run===token){NightService.log('playlist-check',String(e));prepare(source,resume,preferredQuality());}});
            }else prepare(source,resume,preferredQuality());
    }
    function sourceMenu(){
        show();NightUI.dialog('Quelle auswählen','Eine Quelle wird direkt getestet. Bei Fehlern probiert Automatik bis zu drei Anbieter.',serverList.map(function(s){var prior=attempts.filter(function(a){return a.server===s.id;}).pop();return {label:s.label+(s.id===serverId?' · Ausgewaehlt':''),hint:prior?(prior.status==='playing'?'Auf diesem TV gestartet':prior.status==='failed'?'Letzter Versuch fehlgeschlagen':'Wird getestet'):'Noch nicht getestet',action:function(){attempted=[];wasPaused=false;attempt(s.id,position);}};}));
    }
    function qualityMenu(){
        var detail='',picture=null;
        try{if(api.getPlaybackInfo){picture=api.getPlaybackInfo();if(picture.variants.length)variants=picture.variants;}else{var track=tracks().filter(function(t){return t.type==='VIDEO';})[0];var extra=track&&JSON.parse(track.extra_info||'{}');if(extra)picture={width:extra.Width,height:extra.Height,bitrate:extra.Bit_rate||0};}
            if(picture&&picture.width&&picture.height){var rate=picture.measuredBitrate||picture.bitrate;detail='Aktuelles Bild: '+picture.width+' x '+picture.height+(rate?' / '+(rate/1000000).toFixed(1)+' Mbit/s '+(picture.measuredBitrate?'ca. gemessen':'angegeben'):'')+'. ';}
        }catch(ignore){}
        var rows=[{label:'Automatisch'+(quality==='auto'?' · Ausgewaehlt':''),hint:'Der TV passt die Bitrate an die Verbindung an.',action:function(){changeQuality('auto');}}],seen={};
        variants.slice().sort(function(a,b){return b.height-a.height;}).forEach(function(v){if(!v.height||seen[v.height])return;seen[v.height]=true;rows.push({label:v.height+'p'+(Number(quality)===v.height?' · Ausgewaehlt':''),hint:(v.bitrate/1000000).toFixed(1)+' Mbit/s · in dieser Quelle vorhanden',action:function(){changeQuality(v.height);}});});
        if(rows.length===1)rows.push({label:'Originalqualität'+(pictureTier(picture)?' / '+pictureTier(picture)+'p-Klasse':''),hint:'Diese Datei bietet keine weiteren Auflösungen. Eine andere Quelle kann höher auflösen.',disabled:true});
        if(serverId!=='vidrift')rows.push({label:'1080p-Quelle versuchen',hint:'VidRift HD an derselben Position testen. Verfügbarkeit ist titelabhängig.',action:function(){saveQuality(1080);attempted=[];wasPaused=state()==='PAUSED';attempt('vidrift',position);}});
        rows.push({label:'Andere Quelle vergleichen',hint:'Eine andere Quelle kann eine bessere Bildqualität anbieten.',action:sourceMenu});
        NightUI.dialog('Bildqualität',detail+(quality==='auto'?'Automatische Anpassung. ':'Bevorzugt: '+quality+'p. ')+'Deine Auswahl gilt auch für weitere Filme und Quellen. Bei Pufferung Automatisch wählen.',rows);
    }
    function changeQuality(value){if(!url)return;saveQuality(value);var resume=now();wasPaused=state()==='PAUSED';cancel();prepare({url:url},resume,value);}
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
