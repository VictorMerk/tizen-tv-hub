(function(){
    'use strict';
    var worker=null,rejectPending=null,generation=0,samples=[];
    function close(){generation++;if(rejectPending){rejectPending(Error('cancelled'));rejectPending=null;}if(worker){var old=worker;worker=null;var timeout=setTimeout(function(){old.terminate();},1000);old.onmessage=function(e){if(e.data.type==='closed'){clearTimeout(timeout);old.terminate();}};try{old.postMessage({type:'close'});}catch(ignore){clearTimeout(timeout);old.terminate();}}}
    function open(url,height){
        close();samples=[];var run=generation;
        return new Promise(function(resolve,reject){
            var bytes=new Uint8Array(16);crypto.getRandomValues(bytes);var token=Array.prototype.map.call(bytes,function(b){return ('0'+b.toString(16)).slice(-2);}).join('');
            var own=new Worker('tv-remux-worker.js');worker=own;rejectPending=reject;
            var timeout=setTimeout(function(){if(run===generation){rejectPending=null;reject(Error('TV converter timed out'));close();}},18000);
            own.onmessage=function(e){if(run!==generation)return;var d=e.data;if(d.type==='ready'){clearTimeout(timeout);rejectPending=null;resolve(d);}else if(d.type==='stats'){if(d.bytes>0&&d.seconds>0){samples.push(d);if(samples.length>8)samples.shift();}}else if(d.type==='error'){clearTimeout(timeout);rejectPending=null;reject(Error(d.message));close();}};
            own.onerror=function(){if(run!==generation)return;clearTimeout(timeout);rejectPending=null;reject(Error('TV converter unavailable'));close();};
            own.postMessage({type:'open',url:url,height:height,token:token});
        });
    }
    window.NightRemux={open:open,close:close,info:function(){var bytes=0,seconds=0;samples.forEach(function(s){bytes+=s.bytes;seconds+=s.seconds;});return {measuredBitrate:seconds?Math.round(bytes*8/seconds):0};}};
})();
