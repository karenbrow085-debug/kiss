// HearU: each browser carries its own Netease cookie in a POST body.
export const API_BASE = '/hearu-local';
export const GATEWAY = 'https://netease-music-gateway.petrusoclarnon.workers.dev';
const COOKIE_KEY = 'hearu.netease.cookie.v2';
const ACCOUNT_KEY = 'hearu.netease.account.v2';
const memo = new Map(), inflight = new Map();
let accountEpoch = 0;
export class ApiError extends Error {
  constructor(message, {status=0, code=''}={}) { super(message); this.status=status; this.code=code; }
}
export function cookie() { return localStorage.getItem(COOKIE_KEY) || ''; }
function withoutRegion(profile){if(!profile)return profile;const {city,province,country,location,...rest}=profile;return rest;}
export function accountSnapshot() { try { const a=JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null');if(a?.profile)a.profile=withoutRegion(a.profile);return a; } catch { return null; } }
export function acceptLoginSession() {}
export function ensureMusicSession() { return Promise.resolve(cookie()); }
export function musicLoginUrl() { return Promise.resolve(GATEWAY); }
export function clearSession() { accountEpoch++; localStorage.removeItem(COOKIE_KEY); localStorage.removeItem(ACCOUNT_KEY); memo.clear(); inflight.clear(); }
export async function netease(path, params={}, opts={}) {
  const auth = opts.cookie ?? cookie();
  const body = new URLSearchParams();
  for (const [k,v] of Object.entries(params)) if (v !== undefined && v !== null) body.set(k, String(v));
  if (auth) body.set('cookie', auth);
  body.set('timestamp', String(Date.now()));
  const signals = [AbortSignal.timeout(opts.timeout || 12000)];
  if (opts.signal) signals.push(opts.signal);
  let res, data;
  try {
    res = await fetch(GATEWAY + path + '?timestamp=' + Date.now() + '&hearuRequest=' + crypto.randomUUID(), {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body, cache:'no-store', credentials:'omit', signal:AbortSignal.any(signals)});
    data = await res.json();
  } catch (e) {
    if (opts.signal?.aborted) throw new DOMException('已取消','AbortError');
    throw new ApiError(e.name==='TimeoutError' ? '网易云响应超时，请重试' : '暂时连不上网易云，请检查网络', {code:'MUSIC_TIMEOUT'});
  }
  const code = Number(data.code ?? data.data?.code ?? 200);
  if ([301,302,401].includes(code)) { if(auth)clearSession(); throw new ApiError('网易云登录已过期，请重新扫码', {code:'MUSIC_LOGIN_EXPIRED',status:401}); }
  if (!res.ok || code >= 400 && ![800,801,802,803].includes(code)) throw new ApiError(data.message || data.msg || `网易云暂时无法完成此操作（${code}）`, {code:'MUSIC_UPSTREAM_ERROR',status:res.status});
  return data;
}
export function normSong(s={}) {
  if (s.songId) return s;
  const al=s.al || s.album || {};
  return {songId:String(s.id),title:s.name || '未命名',artist:(s.ar || s.artists || []).map(a=>a.name).filter(Boolean).join(' / '),album:al.name || '',coverUrl:(al.picUrl || s.picUrl || '').replace(/^http:/,'https:'),durationMs:Number(s.dt || s.duration || 0)};
}
export function parseLrc(raw) {
  const lines=[]; let offset=Number(String(raw||'').match(/\[offset:([+-]?\d+)\]/)?.[1] || 0);
  for (const row of String(raw||'').split(/\r?\n/)) {
    const text=row.replace(/\[[^\]]*\]/g,'').trim(); if (!text) continue;
    for (const m of row.matchAll(/\[(\d+):(\d+)(?:[.:](\d{1,3}))?\]/g)) lines.push({timeMs:Math.max(0,+m[1]*60000 + +m[2]*1000 + +(m[3]||'0').padEnd(3,'0') + offset),text});
  }
  return lines.sort((a,b)=>a.timeMs-b.timeMs);
}
export function mergeLyrics(raw, trans) {
  const translations=parseLrc(trans); let j=0;
  return parseLrc(raw).map((l,index)=>{while(j<translations.length && translations[j].timeMs<l.timeMs-300) j++;return {...l,index,trans:Math.abs((translations[j]?.timeMs ?? -10000)-l.timeMs)<=300 ? translations[j].text : ''};});
}
async function cached(key, ttl, fn, signal) {
  signal?.throwIfAborted();
  const hit=memo.get(key); if (hit && hit.until>Date.now()) return structuredClone(hit.data);
  // Cancellable AI calls are independent; cancelling one must never cancel another caller.
  if (!signal && inflight.has(key)) return structuredClone(await inflight.get(key));
  const epoch=accountEpoch;
  const promise=fn().then(data=>{if(epoch===accountEpoch) memo.set(key,{until:Math.min(Date.now()+ttl,data?.expiresAt || Infinity),data});return data;});
  if (!signal) inflight.set(key,promise);
  try { return structuredClone(await promise); } finally { if(inflight.get(key)===promise) inflight.delete(key); }
}
export async function searchSongs(query, opts={}) {
  const q=String(query||'').trim().slice(0,100); if (!q) return [];
  return cached('search:'+q,60000,async()=>{
    let d;
    try { d=await netease('/cloudsearch',{keywords:q,type:1,limit:opts.limit || 30},opts); }
    catch(e) { if(opts.signal?.aborted || e.code==='MUSIC_LOGIN_EXPIRED') throw e; d=await netease('/search',{keywords:q,type:1,limit:opts.limit || 30},opts); }
    return (d.result?.songs || []).map(normSong);
  },opts.signal);
}
export async function songDetail(id, opts={}) {
  if(!/^\d+$/.test(String(id))) throw new ApiError('歌曲 ID 无效');
  return cached('detail:'+id,3600000,async()=>{
    const [detail,lyric]=await Promise.allSettled([netease('/song/detail',{ids:id},opts),netease('/lyric',{id},opts)]);
    if(detail.status==='rejected') throw detail.reason;
    const s=detail.value.songs?.find(s=>String(s.id)===String(id)); if(!s) throw new ApiError('未找到歌曲');
    const l=lyric.status==='fulfilled' ? lyric.value : {};
    return {...normSong(s),lyrics:mergeLyrics(l.lrc?.lyric,l.tlyric?.lyric)};
  },opts.signal);
}
export async function playUrl(id, opts={}) {
  const key='url:'+id; if(opts.fresh) memo.delete(key);
  return cached(key,8*60000,async()=>{
    let d;
    try { d=await netease('/song/url/v1',{id,level:'standard'},opts); }
    catch(e) { if(opts.signal?.aborted || e.code==='MUSIC_LOGIN_EXPIRED') throw e; d=await netease('/song/url',{id,br:128000},opts); }
    let item=d.data?.find(s=>String(s.id)===String(id));
    if(!item?.url) { const fallback=await netease('/song/url',{id,br:128000},opts); item=fallback.data?.find(s=>String(s.id)===String(id)); }
    if(!item?.url) throw new ApiError('这首歌暂时无法播放，可能受会员、版权或地区限制',{code:'MUSIC_UNAVAILABLE'});
    const url=new URL(item.url); if(url.protocol==='http:') url.protocol='https:';
    // Keep the signed path and query intact; only this documented music host is substituted.
    if(url.hostname==='m801.music.126.net') url.hostname='m701.music.126.net';
    return {url:url.href,trial:!!item.freeTrialInfo,expiresAt:Date.now()+Math.min(480000,Number(item.expi || 480)*1000)};
  },opts.signal);
}
export async function readAccount(opts={}) {
  if(!cookie()) return {connected:false};
  const epoch=accountEpoch;
  const d=await netease('/login/status',{},opts), base=d.data || d, p=base.profile;
  if(!p?.userId) throw new ApiError('网易云登录已过期，请重新扫码',{code:'MUSIC_LOGIN_EXPIRED'});
  const uid=p.userId;
  const detail=await netease('/user/detail',{uid},opts);
  if(epoch!==accountEpoch) throw new DOMException('账号已更换','AbortError');
  if(detail.profile?.userId && String(detail.profile.userId)!==String(uid)) throw new ApiError('账号信息不一致，请重新登录');
  const result={connected:true,uid:String(uid),profile:withoutRegion({...p,...detail.profile}),account:base.account || {},level:detail.level,listenSongs:detail.listenSongs,createTime:detail.createTime,identify:detail.identify,peopleCanSeeMyPlayRecord:detail.peopleCanSeeMyPlayRecord};
  localStorage.setItem(ACCOUNT_KEY,JSON.stringify(result)); return result;
}
export async function qrCreate(opts={}) {
  const d=await netease('/login/qr/key',{}, {...opts,cookie:''}), key=d.data?.unikey || d.unikey;
  if(!key) throw new ApiError('无法生成二维码');
  const q=await netease('/login/qr/create',{key,qrimg:true},{...opts,cookie:''});
  return {key,image:q.data?.qrimg,url:q.data?.qrurl};
}
export async function qrCheck(key, opts={}) {
  const d=await netease('/login/qr/check',{key},{...opts,cookie:''});
  if(+d.code===803) {
    if(!d.cookie || !/MUSIC_U=/.test(d.cookie)) throw new ApiError('扫码已确认，但接口未返回有效凭证，请重新扫码');
    clearSession(); localStorage.setItem(COOKIE_KEY,d.cookie);
    try { await readAccount(opts); } catch(e) { clearSession(); throw e; }
  }
  return +d.code;
}
export async function logout() { try {await netease('/logout');} finally {clearSession();} }
export async function allPlaylists(uid, opts={}) {
  const list=[], seen=new Set(); let offset=0;
  for(let page=0;page<100;page++) {
    const d=await netease('/user/playlist',{uid,limit:100,offset},opts), rows=d.playlist || [];
    for(const p of rows) if(!seen.has(String(p.id))) {seen.add(String(p.id));list.push({...p,kind:String(p.creator?.userId)===String(uid)?'created':'saved'});}
    offset+=rows.length;
    if(!d.more || !rows.length) return list;
  }
  throw new ApiError('歌单数量过多，读取未完成，请重试');
}
export async function playlistSongs(id, opts={}) {
  const d=await netease('/playlist/detail',{id},opts), p=d.playlist;
  if(!p) throw new ApiError('无法读取歌单');
  const ids=(p.trackIds || []).map(x=>String(x.id));
  if(!ids.length) return (p.tracks || []).map(normSong);
  const songs=[];
  for(let i=0;i<ids.length;i+=200) {const r=await netease('/song/detail',{ids:ids.slice(i,i+200).join(',')},opts); songs.push(...(r.songs||[]).map(normSong));}
  const map=new Map(songs.map(s=>[s.songId,s])); return ids.map(id=>map.get(id)).filter(Boolean);
}
export async function homeFeed(opts={}) {
  const definitions=[['public','/personalized',{limit:12}],['newSongs','/personalized/newsong',{}]];
  if(cookie()) definitions.push(['daily','/recommend/songs',{}],['recommended','/recommend/resource',{}],['fm','/personal_fm',{}],['radar','/personalized',{limit:50}]);
  const responses=await Promise.allSettled(definitions.map(([,p,q])=>netease(p,q,opts))), data={errors:{}};
  responses.forEach((r,i)=>{const key=definitions[i][0]; if(r.status==='rejected') {data.errors[key]=r.reason.message; return;} const d=r.value;
    if(key==='daily') data.daily=(d.data?.dailySongs||d.recommend||[]).map(normSong);
    else if(key==='fm') data.fm=(d.data||[]).map(normSong);
    else if(key==='newSongs') data.newSongs=(d.result||[]).map(x=>normSong(x.song||x));
    else if(key==='roam') data.roam=(d.data?.songs || d.data?.recommend || []).filter(s=>s.id).map(normSong);
    else if(key==='radar') data.radar=(d.result||[]).filter(p=>/雷达/.test(p.name));
    else data[key]=d.result||d.recommend||[];
  }); return data;
}
export async function intelligenceSongs(opts={}) {
  const a=accountSnapshot(); if(!a?.uid) throw new ApiError('先登录网易云');
  const lists=await allPlaylists(a.uid,opts), likes=lists.find(p=>p.specialType===5 && String(p.creator?.userId)===a.uid);
  if(!likes) throw new ApiError('没有找到账号的我喜欢的音乐');
  const songs=await playlistSongs(likes.id,opts); if(!songs.length) throw new ApiError('先在网易云收藏一些音乐');
  const d=await netease('/playmode/intelligence/list',{pid:likes.id,id:songs[0].songId,sid:songs[0].songId},opts);
  return (d.data||[]).map(x=>normSong(x.songInfo||x));
}
export async function apiRequest(path, opts={}) {
  const p=path.replace(API_BASE,'');
  if(p==='/status') return readAccount(opts);
  if(p.startsWith('/search?')) return {songs:await searchSongs(new URLSearchParams(p.split('?')[1]).get('q'),opts)};
  const m=p.match(/^\/song\/(\d+)(\/url)?$/);
  if(m) return m[2] ? playUrl(m[1],opts) : {song:await songDetail(m[1],opts)};
  if(p==='/sources') {const a=await readAccount(opts);if(!a.connected)throw new ApiError('先登录网易云');return {playlists:await allPlaylists(a.uid,opts),specials:[{id:'daily',name:'每日推荐'},{id:'fm',name:'私人 FM'},{id:'heart',name:'心动模式'}]};}
  const source=p.match(/^\/source\/([^/]+)\/songs$/);
  if(source) {const id=source[1]; if(id==='heart') return {songs:await intelligenceSongs(opts)}; if(['daily','fm'].includes(id)) {const d=await homeFeed(opts);if(d.errors[id])throw new ApiError(d.errors[id]);return {songs:d[id] || []};}return {songs:await playlistSongs(id,opts)};}
  if(p==='/now-playing') return {ok:true};
  throw new ApiError('未知音乐操作');
}
export async function fmSongs(mode='DEFAULT',submode='',opts={}) {
  const d=await netease('/personal/fm/mode',{mode,submode:submode || undefined,limit:30},opts);
  return (d.data || []).map(normSong);
}
export async function privateDjSongs(opts={}) {
  const d=await netease('/aidj/content/rcmd',{},opts), songs=[],seen=new Set();
  function walk(v,depth=0){if(!v || typeof v!=='object' || depth>12)return;
    if(v.id && v.name && (Array.isArray(v.ar)||Array.isArray(v.artists))){const song=normSong(v);if(!seen.has(song.songId)){seen.add(song.songId);songs.push(song);}return;}
    for(const value of Object.values(v))walk(value,depth+1);
  }
  walk(d.data);return songs;
}
