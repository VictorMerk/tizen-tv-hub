/* Lossless AVC/AAC fMP4 -> MPEG-TS packaging for Samsung's native HLS player. */
(function(root){
    'use strict';
    function concat(parts){var length=0;parts.forEach(function(p){length+=p.length;});var result=new Uint8Array(length),offset=0;parts.forEach(function(p){result.set(p,offset);offset+=p.length;});return result;}
    function description(init){
        var file=MP4Box.createFile(),info=null,b=init.slice(0);file.onReady=function(i){info=i;};file.onError=function(e){throw Error(String(e));};b.fileStart=0;file.appendBuffer(b);
        if(!info||info.tracks.length!==2)throw Error('Converter requires one AVC and one AAC track');
        var result={tracks:{},width:0,height:0};
        info.tracks.forEach(function(t){
            var entry=file.getTrackById(t.id).mdia.minf.stbl.stsd.entries[0],track={info:t,offset:0};
            (t.edits||[]).some(function(e){if(e.media_time<0){track.offset+=e.segment_duration/t.movie_timescale;return false;}track.offset-=e.media_time/t.timescale;return true;});
            if(t.video){
                if(entry.type!=='avc1'||!entry.avcC||result.video)throw Error('Unsupported video track');
                track.avc=entry.avcC;result.video=track;result.width=t.video.width;result.height=t.video.height;
            }else if(t.audio){
                var d=entry.esds&&entry.esds.esd;function specific(x){if(x.tag===5)return x.data;for(var i=0;i<(x.descs||[]).length;i++){var r=specific(x.descs[i]);if(r)return r;}return null;}
                var asc=d&&specific(d);if(entry.type!=='mp4a'||!asc||asc.length<2||result.audio)throw Error('Unsupported audio track');
                track.object=asc[0]>>3;track.frequency=((asc[0]&7)<<1)|(asc[1]>>7);track.channels=(asc[1]>>3)&15;
                if(track.object!==2||track.frequency>12||track.channels<1||track.channels>7)throw Error('Converter supports AAC-LC only');
                result.audio=track;
            }else throw Error('Unsupported media track');
            result.tracks[t.id]=track;
        });
        if(!result.video||!result.audio||result.width>4096||result.height>2160)throw Error('Unsupported converter configuration');return result;
    }
    function crc(bytes){var value=0xffffffff;for(var i=0;i<bytes.length;i++){value^=bytes[i]<<24;for(var bit=0;bit<8;bit++)value=(value<<1)^((value&0x80000000)?0x04c11db7:0);}return value>>>0;}
    function section(bytes){var b=new Uint8Array(bytes),c=crc(b);return concat([new Uint8Array([0]),b,new Uint8Array([c>>>24,c>>>16,c>>>8,c])]);}
    function timestamp(value,prefix){var n=((Math.round(value*90000)%8589934592)+8589934592)%8589934592;return new Uint8Array([(prefix<<4)|(Math.floor(n/1073741824)<<1)|1,Math.floor(n/4194304)&255,((Math.floor(n/32768)&127)<<1)|1,Math.floor(n/128)&255,((n&127)<<1)|1]);}
    function annexB(data,avc,key){
        var parts=[new Uint8Array([0,0,0,1,9,240])],start=new Uint8Array([0,0,0,1]);
        if(key){avc.SPS.concat(avc.PPS).forEach(function(n){parts.push(start,n.nalu);});}
        var size=avc.lengthSizeMinusOne+1,p=0;
        while(p<data.length){if(p+size>data.length)throw Error('Truncated AVC length');var n=0;for(var i=0;i<size;i++)n=n*256+data[p++];if(!n||p+n>data.length)throw Error('Invalid AVC sample');parts.push(start,data.subarray(p,p+n));p+=n;}
        return concat(parts);
    }
    function adts(data,track){var n=data.length+7;if(n>8191)throw Error('AAC frame too large');return concat([new Uint8Array([255,241,64|(track.frequency<<2)|(track.channels>>2),((track.channels&3)<<6)|(n>>11),n>>3,((n&7)<<5)|31,252]),data]);}
    function convert(init,fragment){
        if(fragment.byteLength>33554432)throw Error('Media fragment too large');
        var meta=description(init),file=MP4Box.createFile(),samples=[],packets=[],cc={},first={};
        file.onReady=function(info){info.tracks.forEach(function(t){file.setExtractionOptions(t.id,null,{nbSamples:1000});});file.start();};
        file.onError=function(e){throw Error(String(e));};file.onSamples=function(id,user,list){list.forEach(function(s){samples.push({track:meta.tracks[id],sample:s});});};
        var b=init.slice(0);b.fileStart=0;file.appendBuffer(b);fragment.fileStart=init.byteLength;file.appendBuffer(fragment);file.flush();
        if(!samples.length)throw Error('No elementary packets');
        function packetize(pid,data,pcr){
            var offset=0,begin=true;
            while(offset<data.length){
                var packet=new Uint8Array(188);packet.fill(255);var clock=begin&&pcr!==null,discontinuity=!first[pid],minimum=clock?8:discontinuity?2:0,count=Math.min(184-minimum,data.length-offset),adapt=count<184;
                packet[0]=71;packet[1]=(pid>>8)|(begin?64:0);packet[2]=pid;packet[3]=(adapt?48:16)|(cc[pid]||0);cc[pid]=((cc[pid]||0)+1)&15;var pos=4;
                if(adapt){var length=183-count;packet[pos++]=length;if(length){packet[pos]=(clock?16:0)|(discontinuity?128:0);if(clock){var base=((Math.round(pcr*90000)%8589934592)+8589934592)%8589934592;packet[pos+1]=Math.floor(base/33554432);packet[pos+2]=Math.floor(base/131072);packet[pos+3]=Math.floor(base/512);packet[pos+4]=Math.floor(base/2);packet[pos+5]=((base&1)<<7)|126;packet[pos+6]=0;}pos+=length;}}
                packet.set(data.subarray(offset,offset+count),pos);packets.push(packet);offset+=count;begin=false;first[pid]=true;
            }
        }
        packetize(0,section([0,176,13,0,1,193,0,0,0,1,240,0]),null);
        var language=meta.audio.info.language||'und';if(!/^[a-z]{3}$/.test(language))language='und';
        packetize(4096,section([2,176,29,0,1,193,0,0,225,0,240,0,27,225,0,240,0,15,225,1,240,6,10,4,language.charCodeAt(0),language.charCodeAt(1),language.charCodeAt(2),0]),null);
        samples.sort(function(a,b){return a.sample.dts/a.sample.timescale+a.track.offset-b.sample.dts/b.sample.timescale-b.track.offset;});
        samples.forEach(function(item){
            var s=item.sample,t=item.track,video=!!t.avc,pid=video?256:257,pts=s.cts/s.timescale+t.offset+1,dts=s.dts/s.timescale+t.offset+1,payload=video?annexB(s.data,t.avc,s.is_sync):adts(s.data,t),length=payload.length+13;
            if(video&&length>65535)length=0;
            var header=new Uint8Array([0,0,1,video?224:192,length>>8,length,128,192,10]);packetize(pid,concat([header,timestamp(pts,3),timestamp(dts,1),payload]),video?dts:null);
        });
        return {buffer:concat(packets).buffer,width:meta.width,height:meta.height,samples:samples.length};
    }
    root.NightTsMux={describe:description,convert:convert};
})(self);
