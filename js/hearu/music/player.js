import { playUrl, songDetail } from '../lib/api.js?v=kiss-3';
const state={song:null,lyrics:[],playing:false,loading:false,buffering:false,error:'',closed:true,trial:false,pausedAt:0};
const listeners=new Set();
let audio, generation=0, controller, wantPlay=false, fetchedAt=0, detailNeeded=false;
let nextGetter=()=>null, onEnd=()=>{}, prepared=null, preparing=null, nextAudio=null, recovery=null;
let stallAt=0,lastPosition=-1,retries=0,lastProgress=0,skipCount=0;
const LAST='hearu.player.last.v2';
function emit(kind='state') {for(const fn of listeners) {try{fn(state,kind);}catch(e){console.error('HearU player listener',e);}}}
export function subscribe(fn) {listeners.add(fn);fn(state);return ()=>listeners.delete(fn);}
export function getState(){return state;}
export function positionMs(){return audio && Number.isFinite(audio.currentTime)?Math.round(audio.currentTime*1000):0;}
export function durationMs(){return audio && Number.isFinite(audio.duration) && audio.duration>0?Math.round(audio.duration*1000):state.song?.durationMs || 0;}
export function currentLineIndex(){return state.lyrics.findLastIndex(l=>l.timeMs<=positionMs());}
function save() {if(state.song && !state.closed) localStorage.setItem(LAST,JSON.stringify({song:state.song,position:positionMs()}));}
export function setQueueProvider(getNext,ended){nextGetter=getNext;onEnd=ended;queueChanged();}
export function queueChanged(){const next=nextGetter();if(prepared && String(next?.songId)!==prepared.id){prepared=null;if(nextAudio){nextAudio.removeAttribute('src');nextAudio.load();}} if(preparing && String(next?.songId)!==preparing.id)preparing=null; if(state.song) warmNext();}
function ensureAudio(){
  if(audio) return audio;
  audio=document.createElement('audio');audio.preload='auto';audio.dataset.hearu='player';audio.setAttribute('playsinline','');audio.hidden=true;document.body.append(audio);
  audio.addEventListener('play',()=>{if(state.loading)return;state.playing=true;state.buffering=true;state.error='';stallAt=Date.now();emit();});
  audio.addEventListener('playing',()=>{if(state.loading)return;state.playing=true;state.pausedAt=0;state.buffering=false;state.error='';skipCount=0;lastProgress=Date.now();emit();});
  audio.addEventListener('pause',()=>{state.pausedAt=Date.now();state.playing=false;state.buffering=false;emit();});
  audio.addEventListener('waiting',()=>{if(wantPlay){state.buffering=true;stallAt=Date.now();emit();}});
  audio.addEventListener('timeupdate',()=>{if(audio.currentTime!==lastPosition){lastPosition=audio.currentTime;lastProgress=Date.now();retries=0;}if(!audio.paused && audio.readyState>=3)state.buffering=false;emit('time');if(durationMs()-positionMs()<45000)warmNext();});
  audio.addEventListener('loadedmetadata',()=>emit());
  audio.addEventListener('seeked',()=>{lastProgress=Date.now();save();emit();});
  audio.addEventListener('error',()=>{if(!state.loading && wantPlay)recover();});
  audio.addEventListener('ended',()=>{
    if(state.loading || state.closed)return;
    // Short trials use actual media duration. A network drop before the end is recoverable.
    if(durationMs()>0 && positionMs()<durationMs()-5000 && retries<2){recover();return;}
    wantPlay=false;state.playing=false;state.buffering=false;save();emit();Promise.resolve(onEnd()).catch(e=>{state.error=e.message;emit();});
  });
  return audio;
}
function start(){
  if(!audio?.getAttribute('src'))return;
  wantPlay=true;lastProgress=Date.now();state.buffering=true;
  // Never await this promise: some WebKit implementations leave it pending during stalls.
  audio.play()?.catch(e=>{if(e.name==='AbortError')return;state.playing=false;state.buffering=false;wantPlay=false;state.error='点一下播放键开始';emit();});
}
async function detail(id,seq){try {const d=await songDetail(id);if(generation!==seq || state.song?.songId!==id)return;state.song={...state.song,...d};state.lyrics=d.lyrics || [];detailNeeded=false;save();emit();metadata();}catch{detailNeeded=true;}}
function metadata(){if(!('mediaSession' in navigator)||!state.song)return;try{navigator.mediaSession.metadata=new MediaMetadata({title:state.song.title,artist:state.song.artist,album:state.song.album,artwork:state.song.coverUrl?[{src:state.song.coverUrl}]:[]});}catch{}}
export async function warm(song,atMs=0){if(!song || state.playing)return;ensureAudio();const seq=++generation;state.song={...song,songId:String(song.songId)};state.closed=false;state.lyrics=[];state.error='';emit();const id=state.song.songId;detail(id,seq);try{const r=await playUrl(id);if(generation!==seq)return;audio.src=r.url;fetchedAt=Date.now();state.trial=r.trial;audio.addEventListener('loadedmetadata',()=>{if(generation===seq)audio.currentTime=atMs/1000;},{once:true});audio.load();emit();}catch(e){if(generation===seq){state.error=e.message;emit();}}}
export async function play(song,atMs=0,opts={}){
  opts.signal?.throwIfAborted(); ensureAudio();
  const id=String(song?.songId || '');if(!/^\d+$/.test(id))throw Error('歌曲 ID 无效');
  if(state.song?.songId===id && audio.getAttribute('src') && Date.now()-fetchedAt<8*60000){if(Number.isFinite(atMs))audio.currentTime=atMs/1000;start();emit();return;}
  const seq=++generation;controller?.abort();controller=new AbortController();
  const signal=opts.signal?AbortSignal.any([opts.signal,controller.signal]):controller.signal;
  const wasPlaying=state.playing;
  audio.pause();audio.removeAttribute('src');audio.load();
  // Unlock WebKit synchronously within the original click, before any network or persistence await.
  if(!wasPlaying && !opts.prepareOnly){audio.src='data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';audio.play()?.catch(()=>{});}
  wantPlay=!opts.prepareOnly;state.song={...song,songId:id};state.lyrics=song.lyrics || [];state.closed=false;state.loading=true;state.error='';state.buffering=false;retries=0;emit();
  const available=prepared?.id===id && prepared.until>Date.now()?prepared:null;
  detail(id,seq); // Details and lyrics must never delay the audio URL.
  try{
    const r=available || await playUrl(id,{signal});signal.throwIfAborted();if(generation!==seq)return;
    state.loading=false;state.trial=!!r.trial;
    audio.src=r.url;fetchedAt=Date.now();audio.load();
    const seek=()=>{if(generation===seq && Number.isFinite(atMs))audio.currentTime=Math.max(0,atMs)/1000;};
    if(audio.readyState>=1)seek();else audio.addEventListener('loadedmetadata',seek,{once:true});
    lastProgress=Date.now();metadata();save();if(!opts.prepareOnly)start();emit();
    if(available){prepared=null;if(nextAudio){nextAudio.removeAttribute('src');nextAudio.load();}}
    warmNext();
  }catch(e){if(generation!==seq)return;state.loading=false;state.buffering=false;state.playing=false;wantPlay=false;audio.pause();audio.removeAttribute('src');audio.load();if(signal.aborted){emit();throw e;}state.error=e.message;emit();if(e.code==='MUSIC_UNAVAILABLE' && skipCount<5 && nextGetter()){skipCount++;setTimeout(()=>{if(generation===seq)Promise.resolve(onEnd()).catch(()=>{});},1200);}}
}
export function toggle(){if(state.playing || wantPlay){wantPlay=false;audio?.pause();state.buffering=false;emit();return;}ensureAudio();start();if(Date.now()-fetchedAt>8*60000)recover(true);}
export function seek(ms){ensureAudio();audio.currentTime=Math.max(0,Number(ms)||0)/1000;lastProgress=Date.now();emit();save();}
export function close(){generation++;controller?.abort();wantPlay=false;audio?.pause();audio?.removeAttribute('src');audio?.load();state.closed=true;state.playing=false;state.loading=false;state.buffering=false;prepared=null;localStorage.removeItem(LAST);emit();}
async function warmNext(){
  const next=nextGetter();if(!next?.songId || preparing?.id===String(next.songId))return;
  if(prepared?.id===String(next.songId) && prepared.until>Date.now()+30000){primeBuffer();return;}
  const id=String(next.songId), token={id};preparing=token;
  try{const r=await playUrl(id);if(preparing!==token || String(nextGetter()?.songId)!==id)return;prepared={...r,id,until:r.expiresAt || Date.now()+8*60000};
    primeBuffer();
    songDetail(id).catch(()=>{});
  }catch{}finally{if(preparing===token)preparing=null;}
}
function primeBuffer(){
  if(!prepared || !wantPlay || durationMs()-positionMs()>45000)return;
  const connection=navigator.connection;if(connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || ''))return;
  if(!nextAudio){nextAudio=document.createElement('audio');nextAudio.hidden=true;nextAudio.preload='auto';document.body.append(nextAudio);}
  if(nextAudio.getAttribute('src')!==prepared.url){nextAudio.src=prepared.url;nextAudio.load();}
}
async function recover(force=false){
  if(recovery || !state.song || (!wantPlay && !force) || retries>=2)return recovery;
  const seq=generation,id=state.song.songId,position=positionMs();retries++;state.buffering=true;emit();
  recovery=(async()=>{try{const r=await playUrl(id,{fresh:true});if(seq!==generation)return;audio.src=r.url;fetchedAt=Date.now();audio.load();audio.addEventListener('loadedmetadata',()=>{if(seq===generation)audio.currentTime=position/1000;},{once:true});if(wantPlay || force)start();}catch(e){if(seq===generation){state.error=e.message;state.buffering=false;wantPlay=false;emit();}}})().finally(()=>{recovery=null;lastProgress=Date.now();});return recovery;
}
setInterval(()=>{if(!wantPlay || state.loading || state.closed)return;if(Date.now()-lastProgress>9000){if(retries<2)recover();else{wantPlay=false;state.buffering=false;state.playing=false;audio?.pause();state.error='网络暂时没有恢复，点播放继续';emit();}}},2000);
setInterval(()=>{if(state.playing)save();},5000);
window.addEventListener('online',()=>{if(state.error && state.song)recover(true);if(detailNeeded && state.song)detail(state.song.songId,generation);});
window.addEventListener('pagehide',save);
if('mediaSession' in navigator){for(const [action,fn] of Object.entries({play:()=>toggle(),pause:()=>{if(state.playing)toggle();},nexttrack:()=>onEnd(),seekto:d=>seek(d.seekTime*1000),seekbackward:d=>seek(positionMs()-(d.seekOffset||10)*1000),seekforward:d=>seek(positionMs()+(d.seekOffset||10)*1000)})){try{navigator.mediaSession.setActionHandler(action,fn);}catch{}}}
// Restore only the prepared track and position. Sound always waits for a user gesture.
try { const saved=JSON.parse(localStorage.getItem(LAST)||'null');if(saved?.song && /^\d+$/.test(String(saved.song.songId)))queueMicrotask(()=>warm(saved.song,Math.max(0,Number(saved.position)||0))); } catch {}
