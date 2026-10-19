/* Lazy browser decoder for HLS sources that AVPlay cannot consume. */
(function(){
    'use strict';
    var loading=null;
    function library(){if(window.Hls)return Promise.resolve();if(loading)return loading;loading=new Promise(function(resolve,reject){var script=document.createElement('script');script.src='hls.min.js';script.onload=resolve;script.onerror=function(){loading=null;reject(Error('Videomodul konnte nicht geladen werden'));};document.head.appendChild(script);});return loading;}
    window.makeBrowserPlayer=function(){
        var video=null,hls=null,source='',mode='NONE',listener={},onReady=null,onFail=null,bandwidth=null,qualityHeight=0,ready=false,codecAudio=null,codecVideo=null,generation=0,rateSamples=[];
        function applyQuality(){if(!hls)return;var index=-1;if(qualityHeight){var best=-1;hls.levels.forEach(function(l,i){var height=l.height||0;if(height<=qualityHeight&&(height>best||(height===best&&index>=0&&l.bitrate>hls.levels[index].bitrate))){best=height;index=i;}});if(index<0&&hls.levels.length)index=0;}else if(bandwidth){var distance=Infinity;hls.levels.forEach(function(l,i){var d=Math.abs(l.bitrate-bandwidth);if(d<distance){distance=d;index=i;}});}hls.currentLevel=index;}
        function create(){
            var stamp=generation;function on(name,handler){video.addEventListener(name,function(e){if(stamp===generation)handler(e);});}
            video=document.createElement('video');video.setAttribute('playsinline','');video.setAttribute('preload','auto');video.className='player-surface';video.style.cssText='position:fixed;left:0;top:0;width:1920px;height:1080px;z-index:0;background:transparent;object-fit:contain';
            var object=document.querySelector('#night-player object');if(object)object.replaceWith(video);else document.getElementById('night-player').insertBefore(video,document.getElementById('night-player').firstChild);
            on('loadedmetadata',function(){if(ready)return;ready=true;mode='READY';if(onReady)onReady();});
            on('timeupdate',function(){if(video&&listener.oncurrentplaytime)listener.oncurrentplaytime(video.currentTime*1000);});
            on('waiting',function(){if(listener.onbufferingstart)listener.onbufferingstart();});
            on('playing',function(){mode='PLAYING';if(listener.onbufferingcomplete)listener.onbufferingcomplete();});
            on('ended',function(){if(listener.onstreamcompleted)listener.onstreamcompleted();});
            on('error',function(){if(!video)return;if(!ready){if(onFail)onFail('Media error');}else if(listener.onerror)listener.onerror('Media error');});
        }
        return {engine:'browser',
            open:function(url){generation++;source=url;mode='IDLE';ready=false;create();},
            setDisplayRect:function(){},setDisplayMethod:function(){},setSilent:function(value){if(video)video.muted=value;},setBufferingParam:function(){},
            setStreamingProperty:function(key,value){if(key==='ADAPTIVE_INFO'){var m=/BITRATES=(\d+)/.exec(value);bandwidth=m?Number(m[1]):null;if(hls)applyQuality();}},
            setQualityHeight:function(value){qualityHeight=Number(value)||0;if(hls)applyQuality();},
            getPlaybackInfo:function(){var level=hls&&hls.levels[hls.currentLevel],bytes=0,seconds=0;rateSamples.forEach(function(s){bytes+=s.bytes;seconds+=s.seconds;});return {width:video&&video.videoWidth||0,height:video&&video.videoHeight||0,bitrate:level&&level.bitrate||0,measuredBitrate:seconds?Math.round(bytes*8/seconds):0,variants:hls?hls.levels.filter(function(l){return l.height;}).map(function(l){return {height:l.height,width:l.width,bitrate:l.bitrate};}):[],error:video&&video.error?{code:video.error.code,message:video.error.message||''}:null};},
            setListener:function(value){listener=value;},
            prepareAsync:function(ok,bad){var run=generation;onReady=ok;onFail=bad;if(/\.mp4(?:$|[?&])/i.test(source)){video.src=source;return;}library().then(function(){if(!video||run!==generation)return;if(Hls.isSupported()){
                hls=new Hls({enableWorker:false,abrEwmaDefaultEstimate:5000000,maxBufferLength:30,maxMaxBufferLength:45,backBufferLength:15,manifestLoadingMaxRetry:1,fragLoadingMaxRetry:2,manifestLoadingTimeOut:12000,fragLoadingTimeOut:12000});
                hls.on(Hls.Events.BUFFER_CODECS,function(e,data){codecAudio=data.audio;codecVideo=data.video;});
                hls.on(Hls.Events.MANIFEST_PARSED,applyQuality);
                hls.on(Hls.Events.FRAG_LOADED,function(e,data){if(run!==generation||!data.frag||data.frag.type!=='main')return;var bytes=data.payload&&data.payload.byteLength,seconds=data.frag.duration;if(bytes>0&&seconds>0){rateSamples.push({bytes:bytes,seconds:seconds});if(rateSamples.length>8)rateSamples.shift();}});
                hls.on(Hls.Events.ERROR,function(e,data){if(run!==generation||!data.fatal)return;if(!ready){if(onFail)onFail(data.details);}else if(listener.onerror)listener.onerror(data.details);});
                hls.loadSource(source);hls.attachMedia(video);
            }else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=source;}else bad('HLS not supported');},function(){if(run===generation)bad('Player module unavailable');});},
            play:function(){if(!video)return;mode='PLAYING';var promise=video.play();if(promise&&promise.catch)promise.catch(function(){mode='PAUSED';NightService.log('autoplay','User gesture required');});},
            pause:function(){if(video)video.pause();mode='PAUSED';},
            stop:function(){if(video)video.pause();mode='IDLE';},
            close:function(){generation++;listener={};onReady=null;onFail=null;if(hls)hls.destroy();hls=null;if(video){video.removeAttribute('src');video.load();video.remove();}video=null;codecAudio=null;codecVideo=null;rateSamples=[];mode='NONE';},
            getState:function(){return mode;},getCurrentTime:function(){return video?video.currentTime*1000:0;},getDuration:function(){return video&&isFinite(video.duration)?video.duration*1000:0;},
            seekTo:function(ms,ok,bad){try{video.currentTime=ms/1000;if(ok)ok();}catch(e){if(bad)bad(e);}},
            getTotalTrackInfo:function(){var result=[];if(video&&video.videoWidth)result.push({type:'VIDEO',index:0,extra_info:JSON.stringify({Width:video.videoWidth,Height:video.videoHeight,fourCC:codecVideo&&codecVideo.codec||'H264'})});var tracks=hls&&hls.audioTracks||[];if(tracks.length)tracks.forEach(function(t,i){result.push({type:'AUDIO',index:i,extra_info:JSON.stringify({language:t.lang||t.name||'',fourCC:t.audioCodec||codecAudio&&codecAudio.codec||''})});});else if(codecAudio)result.push({type:'AUDIO',index:0,extra_info:JSON.stringify({language:'',fourCC:codecAudio.codec})});return result;},
            setSelectTrack:function(type,index){if(type==='AUDIO'&&hls&&hls.audioTracks.length>1)hls.audioTrack=index;}
        };
    };
})();
