/* KISS voice playback: optional MP3 streaming, with the same response retained for fallback. */
(()=>{'use strict';
function aborted(){return new DOMException('已停止','AbortError');}
function stream(player,{signal,onPlaying=()=>{}}={}){
 if(!window.MediaSource?.isTypeSupported?.('audio/mpeg'))return null;
 const source=new MediaSource(),url=URL.createObjectURL(source),queue=[];let buffer=null,finished=false,closed=false,failed=false,received=false,starting=false,started=false,settled=false;
 let resolve;const ended=new Promise(r=>resolve=r);const settle=value=>{if(!settled){settled=true;resolve(value);}};
 function fail(){failed=true;queue.length=0;settle(false);}
 function tryPlay(){if(started||starting||failed||closed||signal?.aborted)return;starting=true;Promise.resolve().then(()=>player.play()).then(()=>{if(closed||signal?.aborted)return;started=true;onPlaying();},fail).finally(()=>starting=false);}
 function drain(){if(closed||failed||!buffer||buffer.updating||source.readyState!=='open')return;try{if(queue.length){buffer.appendBuffer(queue.shift());tryPlay();}else if(finished){source.endOfStream();}}catch{fail();}}
 function opened(){if(closed)return;try{buffer=source.addSourceBuffer('audio/mpeg');buffer.addEventListener('updateend',drain);buffer.addEventListener('error',fail);drain();}catch{fail();}}
 function done(){settle(!failed);}
 function cancel(){settle(false);}
 source.addEventListener('sourceopen',opened);player.addEventListener('error',fail);player.addEventListener('ended',done);signal?.addEventListener('abort',cancel,{once:true});player.src=url;
 return {push(bytes){if(closed||failed||signal?.aborted)return;received=true;queue.push(bytes.slice().buffer);drain();},async complete(){finished=true;if(!received)fail();else drain();return ended;},dispose(){if(closed)return;closed=true;settle(false);source.removeEventListener('sourceopen',opened);player.removeEventListener('error',fail);player.removeEventListener('ended',done);signal?.removeEventListener('abort',cancel);buffer?.removeEventListener('updateend',drain);buffer?.removeEventListener('error',fail);queue.length=0;URL.revokeObjectURL(url);}};
}
function buffered(player,blob,{signal,onPlaying=()=>{}}={}){
 if(signal?.aborted)return Promise.reject(aborted());
 return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob);let settled=false;const finish=(error)=>{if(settled)return;settled=true;player.removeEventListener('ended',done);player.removeEventListener('error',failed);signal?.removeEventListener('abort',cancel);URL.revokeObjectURL(url);error?reject(error):resolve();};const done=()=>finish(),failed=()=>finish(Error('音频无法解码，请检查服务返回格式')),cancel=()=>{player.pause();finish(aborted());};player.addEventListener('ended',done);player.addEventListener('error',failed);signal?.addEventListener('abort',cancel,{once:true});player.src=url;Promise.resolve().then(()=>{if(signal?.aborted)throw aborted();return player.play();}).then(()=>{if(!settled)onPlaying();},finish);});
}
async function play(service,profile,text,{player,signal,onPlaying=()=>{},onDuration=()=>{},onPart=()=>{}}={}){
 const plan=service.plan(profile,text),p=plan.profile,parts=plan.parts;
 if(!parts.length)throw Error('没有可朗读的文字');let prefetch=null,totalDuration=0;
 for(let i=0;i<parts.length;i++){
  if(signal?.aborted)throw aborted();
  const live=i===0&&p.family==='fish'&&p.streaming!==false&&p.format==='mp3'?stream(player,{signal,onPlaying}):null;
  try{
   const result=prefetch?await prefetch:await service.synthesize(p,parts[i],{signal,prepared:true,onChunk:live?bytes=>live.push(bytes):undefined}).then(blob=>({blob}),error=>({error}));prefetch=null;
   if(result.error)throw result.error;if(signal?.aborted)throw aborted();
   // Prefetch one next segment while this one plays. Each synthesis remains one request.
   if(i+1<parts.length)prefetch=service.synthesize(p,parts[i+1],{signal,prepared:true}).then(blob=>({blob}),error=>({error}));
   onPart(i+1,parts.length);const played=live?await live.complete():false;
   if(signal?.aborted)throw aborted();live?.dispose();
   if(!played)await buffered(player,result.blob,{signal,onPlaying});
   if(Number.isFinite(player.duration)){totalDuration+=player.duration;onDuration(totalDuration,i+1===parts.length);}
  }finally{live?.dispose();}
 }
}
window.KissVoicePlayer={stream,buffered,play};
})();
