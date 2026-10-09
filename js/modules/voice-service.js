/* Voice service v1 — MiniMax CN/Global, Fish Audio and configurable relays. */
(() => {
'use strict';
const CATALOG = {
 minimax: ['speech-2.8-hd','speech-2.8-turbo','speech-2.6-hd','speech-2.6-turbo','speech-02-hd','speech-02-turbo','speech-01-hd','speech-01-turbo'],
 fish: ['s2.1-pro','s2.1-pro-free','s2-pro','s1','drama-3-preview']
};
const PRESETS = [
 ['minimax-cn','MiniMax · 中国版','minimax','https://api.minimax.cn',true],
 ['minimax-global','MiniMax · 国际版','minimax','https://api.minimax.io',true],
 ['minimax-relay','MiniMax · 自定义中转','minimax','',false],
 ['fish','Fish Audio · 官方','fish','https://api.fish.audio',true],
 ['fish-relay','Fish Audio · 自定义中转','fish','',false]
];
const clone = x => JSON.parse(JSON.stringify(x));
function profile(id) {
 const p=PRESETS.find(x=>x[0]===id)||PRESETS[0],fish=p[2]==='fish';
 return {id:p[0],name:p[1],family:p[2],official:p[4],protocol:p[2],baseUrl:p[3],key:'',model:CATALOG[p[2]][0],voiceId:'',
 speed:1,volume:1,pitch:0,emotion:'',language:'auto',fishVolume:0,temperature:0.7,topP:0.7,latency:'normal',format:'mp3',
 ttsPath:fish?'/v1/tts':'/v1/t2a_v2',modelsPath:'/v1/models',voicesPath:fish?'/model':'/v1/get_voice',
 voicesMethod:fish?'GET':'POST',voicesBody:fish?'{}':'{"voice_type":"all"}',modelsMethod:'GET',modelsBody:'{}',
 authMode:'bearer',authHeader:'X-API-Key',groupId:'',headers:'{}',extraBody:'{}',template:'',
 responseType:'auto',audioPath:'',modelsArrayPath:'',voicesArrayPath:'',modelIdPath:'',voiceIdPath:'',voiceNamePath:'',
 timeout:90,models:[],voices:[]};
}
function settings() {
 const saved=(typeof db!=='undefined'&&db.apiSettings&&db.apiSettings.voice)||{};
 const profiles={}; PRESETS.forEach(p=>profiles[p[0]]={...profile(p[0]),...(saved.profiles||{})[p[0]]});
 return {...saved,version:1,enabled:!!saved.enabled,defaultProfile:saved.defaultProfile||'minimax-cn',cacheEnabled:saved.cacheEnabled!==false,callEnabled:!!saved.callEnabled,profiles,bindings:saved.bindings||{}};
}
function getPath(obj,path) {
 if(!path)return obj;
 return String(path).replace(/\[(\d+)\]/g,'.$1').split('.').filter(Boolean).reduce((a,k)=>a==null?undefined:a[k],obj);
}
function parseObject(text,label) {
 let v;try{v=JSON.parse(text||'{}');}catch{throw new Error(label+'不是有效 JSON');}
 if(!v||Array.isArray(v)||typeof v!=='object')throw new Error(label+'需要 JSON 对象');
 return v;
}
function merge(target,source) {
 for(const [k,v] of Object.entries(source)) {
  if(['__proto__','constructor','prototype'].includes(k))continue;
  if(v&&typeof v==='object'&&!Array.isArray(v))target[k]=merge(target[k]&&typeof target[k]==='object'?target[k]:{},v);
  else target[k]=v;
 }return target;
}
function substitute(value,vars) {
 if(Array.isArray(value))return value.map(v=>substitute(v,vars));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['__proto__','constructor','prototype'].includes(k)).map(([k,v])=>[k,substitute(v,vars)]));
 if(typeof value!=='string')return value;
 const exact=value.match(/^\{(\w+)\}$/);if(exact&&Object.hasOwn(vars,exact[1]))return vars[exact[1]];
 return value.replace(/\{(\w+)\}/g,(s,k)=>Object.hasOwn(vars,k)?String(vars[k]):s);
}
// Relay URLs include /v1 by default; official URLs are left untouched.
function relayBase(base) {
 const text=String(base||'').trim();if(!text)return '';
 try{const url=new URL(text);if(!/^https?:$/.test(url.protocol))return text;let pathname=url.pathname.replace(/\/+$/,'');if(!/\/v1$/i.test(pathname))pathname+='/v1';url.pathname=pathname;return url.href.replace(/\/$/,'');}catch{return text;}
}
function endpoint(base,path) {
 let url;
 try {
  const b=new URL(base);if(!/^https?:$/.test(b.protocol)||b.username||b.password)throw 0;
  if(/^https?:\/\//i.test(path))url=new URL(path);
  else {const root=b.pathname.replace(/\/+$/,'');let tail=String(path||'');if(/\/v1$/i.test(root)&&/^\/?v1(?:\/|$)/i.test(tail))tail=tail.replace(/^\/?v1(?:\/|$)/i,'');const relative=new URL(tail||'.','https://relative.invalid/');url=new URL(b.href);url.pathname=root+'/'+(tail?relative.pathname.replace(/^\/+/,''):'');for(const [k,v] of relative.searchParams)url.searchParams.set(k,v);if(relative.hash)url.hash=relative.hash;}
  if(!/^https?:$/.test(url.protocol)||url.username||url.password)throw 0;
 } catch {throw new Error('请填写有效的 HTTP / HTTPS 接口地址');}
 return url;
}
function validate(p,kind='tts') {
 if(!p.baseUrl)throw new Error('请填写接口地址');
 if(p.authMode!=='none'&&!p.key.trim())throw new Error('请填写 API Key');
 if(kind==='tts'&&(!p.model.trim()||!p.voiceId.trim()))throw new Error('请填写生成模型和音色 ID');
 const ranges={speed:[0.5,2],volume:[0.1,10],pitch:[-12,12],fishVolume:[-20,20],temperature:[0,1],topP:[0,1],timeout:[10,300]};
 for(const [name,[min,max]] of Object.entries(ranges)){if(!Number.isFinite(Number(p[name]))||Number(p[name])<min||Number(p[name])>max)throw new Error('参数 '+name+' 的范围为 '+min+'–'+max);}
 parseObject(p.headers,'自定义请求头');parseObject(p.extraBody,'补充参数');
 if(p.protocol==='template'&&kind==='tts')parseObject(p.template,'请求模板');
}
function variables(p,text='') {return {key:p.key,text,model:p.model,voice_id:p.voiceId,reference_id:p.voiceId,speed:Number(p.speed),volume:Number(p.volume),pitch:Number(p.pitch),format:p.format,emotion:p.emotion};}
function buildRequest(p,text,kind='tts',options={}) {
 validate(p,kind);
 const vars=variables(p,text),headers=new Headers();
 if(p.authMode==='bearer')headers.set('Authorization','Bearer '+p.key.trim());
 else if(p.authMode==='header')headers.set(p.authHeader||'X-API-Key',p.key.trim());
 let method=kind==='tts'?'POST':(p[kind+'Method']||'GET');let body;
 if(kind==='tts') {
  if(p.protocol==='minimax') {
   body={model:p.model,text,stream:false,output_format:'hex',voice_setting:{voice_id:p.voiceId,speed:Number(p.speed),vol:Number(p.volume),pitch:Number(p.pitch)},audio_setting:{format:p.format,sample_rate:32000,bitrate:128000,channel:1}};
   if(p.emotion)body.voice_setting.emotion=p.emotion;if(p.language)body.language_boost=p.language;
  } else if(p.protocol==='fish') {
   headers.set('model',p.model);
   body={text,reference_id:p.voiceId,format:p.format,prosody:{speed:Number(p.speed),volume:Number(p.fishVolume)},temperature:Number(p.temperature),top_p:Number(p.topP),latency:p.latency};
  } else if(p.protocol==='openai')body={model:p.model,input:text,voice:p.voiceId,response_format:p.format,speed:Number(p.speed)};
  else body=substitute(parseObject(p.template,'请求模板'),vars);
  merge(body,substitute(parseObject(p.extraBody,'补充参数'),vars));
 } else if(method!=='GET')body=substitute(parseObject(p[kind+'Body'],'列表请求体'),vars);
 if(body!==undefined)headers.set('Content-Type','application/json');
 for(const [k,v] of Object.entries(substitute(parseObject(p.headers,'自定义请求头'),vars)))headers.set(k,String(v));
 const url=endpoint(p.official?p.baseUrl:relayBase(p.baseUrl),p[kind==='tts'?'ttsPath':kind+'Path']);
 if(p.groupId)url.searchParams.set('GroupId',p.groupId);
 if(kind==='voices'&&p.official&&p.family==='fish') {
  url.searchParams.set('page_size','50');url.searchParams.set('page_number',String(options.page||1));url.searchParams.set('self',String(options.scope!=='public'));if(options.search)url.searchParams.set('title',options.search);
 }
 return {url:url.href,init:{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',redirect:'error'}};
}
function safeError(message,p) {
 let s=String(message||'请求失败');if(p.key)s=s.split(p.key).join('[隐藏密钥]');
 return s.replace(/Bearer\s+[^\s"<>]+/gi,'Bearer [隐藏密钥]').replace(/<[^>]+>/g,' ').slice(0,240);
}
function apiError(data) {
 if(data&&data.base_resp&&Number(data.base_resp.status_code)!==0)return data.base_resp.status_msg||'语音服务返回错误';
 if(data&&data.error)return typeof data.error==='string'?data.error:data.error.message||'接口返回错误';
 if(data&&Number(data.status)>=400)return data.message||data.reason||'接口返回错误';
 return '';
}
async function request(p,text,kind,options={}) {
 const r=buildRequest(p,text,kind,options),controller=new AbortController();let timedOut=false;
 const cancel=()=>controller.abort();if(options.signal){if(options.signal.aborted)cancel();else options.signal.addEventListener('abort',cancel,{once:true});}
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},Math.max(10,Number(p.timeout)||90)*1000);
 try {
  const response=await fetch(r.url,{...r.init,signal:controller.signal});
  if(!response.ok){let msg='';try{const d=await response.json();msg=apiError(d)||d.message||d.detail||d.reason||'';}catch{}
   const tips={401:'密钥无效或账号不匹配',402:'额度不足或当前模型没有使用权限',403:'没有访问权限',404:'接口路径不存在',429:'请求过多，请稍后重试'};
   throw new Error('HTTP '+response.status+' · '+(msg||tips[response.status]||'服务暂时不可用'));
  }
  // Consume the response within the timeout; streaming binaries are also bounded.
  const blob=await response.blob();return {blob,type:(response.headers.get('Content-Type')||'').toLowerCase()};
 }catch(e){
  if(e.name==='AbortError')throw new Error(timedOut?'语音请求超时，请稍后重试':'已停止');
  if(e.name==='TypeError')throw new Error('连接失败：检查地址、网络与跨域许可；可改用支持 CORS 的中转地址');
  throw new Error(safeError(e.message,p));
 }finally{clearTimeout(timer);if(options.signal)options.signal.removeEventListener('abort',cancel);}
}
function normalizeList(data,kind,p) {
 const path=p[kind+'ArrayPath'];let items=path?getPath(data,path):null;
 if(!path) {
  if(kind==='voices'&&(data.system_voice||data.voice_cloning||data.voice_generation))items=[...(data.system_voice||[]),...(data.voice_cloning||[]),...(data.voice_generation||[])];
  else for(const value of [data, data.data,data.items,data.models,data.voices,data.list,data.results,data.data&&data.data.items,data.data&&data.data.voices,data.data&&data.data.models])if(Array.isArray(value)){items=value;break;}
 }
 if(!Array.isArray(items))throw new Error('没有找到列表数组；请在高级兼容中填写返回数组路径');
 const unique=new Map();
 items.forEach(item=>{
  const id=typeof item==='string'?item:((kind==='models'?p.modelIdPath:p.voiceIdPath)?getPath(item,kind==='models'?p.modelIdPath:p.voiceIdPath):null)||item.voice_id||item.reference_id||item.id||item._id||item.model_id||item.name;
  if(id==null||typeof id==='object')return;
  const name=typeof item==='string'?item:(p.voiceNamePath?getPath(item,p.voiceNamePath):null)||item.voice_name||item.title||item.display_name||item.name||String(id);
  unique.set(String(id),{id:String(id),name:String(name)});
 });return [...unique.values()];
}
async function list(p,kind,options={}) {
 if(kind==='models'&&p.official)return {items:CATALOG[p.family].map(id=>({id,name:id})),catalog:true,hasMore:false};
 const r=await request(p,'',kind,options);let data;
 try{data=JSON.parse(await r.blob.text());}catch{throw new Error('列表接口没有返回 JSON；请检查接口路径');}
 const err=apiError(data);if(err)throw new Error(safeError(err,p));
 const items=normalizeList(data,kind,p),page=options.page||1;
 const hasMore=p.official&&p.family==='fish'&&(data.has_more===true||(data.has_more==null&&items.length===50&&(typeof data.total!=='number'||page*50<data.total)));
 return {items,hasMore,total:data.total};
}
function decodeAudio(value,type,format='mp3') {
 if(typeof value!=='string'||!value.trim())throw new Error('音频内容为空');let s=value.trim();const mime=format==='wav'?'audio/wav':format==='opus'?'audio/ogg':'audio/mpeg';
 if(type==='hex'){if(!/^(?:[0-9a-f]{2})+$/i.test(s))throw new Error('音频不是有效的十六进制数据');return new Blob([Uint8Array.from(s.match(/../g),x=>parseInt(x,16))],{type:mime});}
 if(s.startsWith('data:')){const match=s.match(/^data:(audio\/[^;,]+);base64,(.*)$/s);if(!match)throw new Error('不支持的音频 data 地址');s=match[2];}
 try{return new Blob([Uint8Array.from(atob(s),c=>c.charCodeAt(0))],{type:mime});}catch{throw new Error('音频不是有效的 Base64 数据');}
}
async function audioFromResponse(r,p,options={}) {
 if(p.responseType==='audio'||(p.responseType==='auto'&&!/json|text|html/.test(r.type))) {
  if(!r.blob.size)throw new Error('服务返回了空音频');return r.blob;
 }
 let data;try{data=JSON.parse(await r.blob.text());}catch{throw new Error('服务没有返回音频或有效 JSON，请检查协议和返回格式');}
 const err=apiError(data);if(err)throw new Error(safeError(err,p));
 let value=p.audioPath?getPath(data,p.audioPath):data.data?.audio??data.audio??data.audio_url??data.url??data.data?.audio_url??data.data?.url??data.audio_base64??data.data?.audio_base64;
 if(value&&typeof value==='object')value=value.url||value.data;
 let type=p.responseType;
 if(type==='auto')type=/^https?:\/\//i.test(value||'')?'url':(p.protocol==='minimax'&&/^(?:[0-9a-f]{2})+$/i.test(value||'')?'hex':'base64');
 if(type==='url') {
  let url;try{url=new URL(String(value));if(!/^https?:$/.test(url.protocol)||url.username||url.password)throw 0;}catch{throw new Error('音频下载地址无效');}const controller=new AbortController();let timedOut=false;
  const cancel=()=>controller.abort();if(options.signal){if(options.signal.aborted)cancel();else options.signal.addEventListener('abort',cancel,{once:true});}
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},(Number(p.timeout)||90)*1000);
  try{const response=await fetch(url.href,{signal:controller.signal,credentials:'omit'});if(!response.ok)throw new Error('音频下载失败 · HTTP '+response.status);const blob=await response.blob();if(!blob.size||/json|html/.test(blob.type))throw new Error('下载地址没有返回音频');return blob;}
  catch(e){if(e.name==='AbortError')throw new Error(timedOut?'音频下载超时':'已停止');throw new Error(safeError(e.message,p));}
  finally{clearTimeout(timer);options.signal?.removeEventListener('abort',cancel);}
 }
 return decodeAudio(value,type,p.format);
}
let cacheDb;
function openCache(){if(!window.indexedDB)return Promise.resolve(null);if(!cacheDb)cacheDb=new Promise(resolve=>{const r=indexedDB.open('kiss-voice-audio-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('audio',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);r.onblocked=()=>resolve(null);});return cacheDb;}
async function cacheOp(mode,action){try{const d=await openCache();if(!d)return null;return await new Promise(resolve=>{const tx=d.transaction('audio',mode);let result;const req=action(tx.objectStore('audio'));if(req)req.onsuccess=()=>result=req.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>resolve(null);tx.onabort=()=>resolve(null);});}catch{return null;}}
async function hash(value){if(!window.crypto?.subtle)return null;const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');}
async function cacheStats(){const rows=await cacheOp('readonly',s=>s.getAll())||[];return {count:rows.length,bytes:rows.reduce((a,x)=>a+x.blob.size,0)};}
async function clearCache(){await cacheOp('readwrite',s=>s.clear());}
async function synthesize(p,text,options={}) {
 validate(p);if(!text.trim())throw new Error('请输入需要朗读的文字');if(text.length>=10000)throw new Error('单条语音文字过长，请分段生成');
 const built=buildRequest(p,text),useCache=options.cache!==false&&settings().cacheEnabled;
 const id=useCache?await hash(built.url+'\n'+JSON.stringify([...built.init.headers])+'\n'+built.init.body):null;
 if(id){const saved=await cacheOp('readonly',s=>s.get(id));if(saved){saved.time=Date.now();await cacheOp('readwrite',s=>s.put(saved));return saved.blob;}}
 const r=await request(p,text,'tts',options),blob=await audioFromResponse(r,p,options);
 if(options.signal?.aborted)throw new Error('已停止');
 if(id&&blob.size<=30*1024*1024){const rows=await cacheOp('readonly',s=>s.getAll())||[];let size=rows.reduce((a,x)=>a+x.blob.size,0)+blob.size;rows.sort((a,b)=>a.time-b.time);const removed=[];while(rows.length&&(size>30*1024*1024||rows.length>=100)){const x=rows.shift();size-=x.blob.size;removed.push(x.id);}await cacheOp('readwrite',s=>{removed.forEach(x=>s.delete(x));return s.put({id,blob,time:Date.now()});});}
 return blob;
}
function resolveProfile(charId) {
 const s=settings(),binding=s.bindings[charId]||{},id=binding.profileId||s.defaultProfile;
 if(binding.disabled)return null;
 const p=s.profiles[id];if(!p)return null;
 return {...p,voiceId:binding.voiceId||p.voiceId,speed:binding.speed==null?p.speed:Number(binding.speed)};
}
window.KissVoiceService={CATALOG,PRESETS,profile,settings,clone,getPath,parseObject,relayBase,endpoint,buildRequest,validate,list,normalizeList,decodeAudio,audioFromResponse,synthesize,resolveProfile,cacheStats,clearCache};
})();
