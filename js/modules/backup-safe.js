/* Shared KISS / 1900 backup engine, 2026-10-22.
 * Public files contain ordinary JSON / OVO records. Disk-only references never leave exports.
 * Heavy arrays are stored separately; the home screen only reads previews.
 */
(function (global) {
'use strict';
const CORE = ['characters','groups','worldBooks','myStickers'];
const DENY = new Set(['__proto__','prototype','constructor']);
const H = '__phoneHistory', A = '__phoneArchive', PART = '__phonePart';
const assetRE = /data:[^,\s"'<>]{1,160};base64,[A-Za-z0-9+/=]+/g;
const tokenRE = /phone-asset:[a-f0-9-]+/g;
const mimeByURL=new Map();
const pins = new WeakMap(), accessEpoch = new WeakMap(), writeVersions=new WeakMap();
const cold = new WeakMap(), urls = new Map(), reverse = new Map(), pending = new WeakMap();
let busy = false, serial = Promise.resolve(), queuedSave = null;
const knownAssets=new Set();
const uid=()=>global.crypto?.randomUUID?.()||Array.from(global.crypto?.getRandomValues?.(new Uint8Array(16))||Uint8Array.from({length:16},()=>Math.random()*256),b=>b.toString(16).padStart(2,'0')).join('');
const pause = () => new Promise(r => setTimeout(r, 0));
const object = x => x && typeof x === 'object' && !Array.isArray(x);
const table = () => dexieDB.safeParts;
const clone = v => structuredClone(v);
async function part(value,kind='value') { const id=uid(); await table().put({id,kind,value}); return id; }
async function get(id) { const row=await table().get(id); if(!row)throw Error('备份数据块缺失，请重新导入原备份');return row.value; }
function assertKey(k) { if(DENY.has(k))throw Error('备份含非法字段'); }
async function storeString(s) {
 s=s.replace(/blob:[A-Za-z0-9:/._-]+/g,url=>reverse.get(url)||url);
 const re=new RegExp(assetRE.source,'g');let out='',last=0,m;
 while((m=re.exec(s))) {
  if(m[0].length<8192)continue;
  const digest=global.crypto?.subtle?.digest?await crypto.subtle.digest('SHA-256',new TextEncoder().encode(m[0])):null;
  const id=digest?Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''):uid();
  if(!knownAssets.has(id)){await table().put({id,kind:'asset',value:new Blob([m[0]],{type:'text/plain'})});knownAssets.add(id);}
  const token='phone-asset:'+id;
  out+=s.slice(last,m.index)+token;last=m.index+m[0].length;
 }
 return last?out+s.slice(last):s;
}
async function assetURL(token) {
 if(urls.has(token))return urls.get(token);
 const text=await (await get(token.slice(12))).text(),comma=text.indexOf(',');
 const binary=atob(text.slice(comma+1)),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 const url=URL.createObjectURL(new Blob([bytes],{type:text.slice(5,text.indexOf(';'))}));
 urls.set(token,url);reverse.set(url,token);mimeByURL.set(url,text.slice(5,text.indexOf(';')));return url;
}
async function displayString(s) {
 const matches=[...new Set(s.match(tokenRE)||[])];for(const token of matches)s=s.split(token).join(await assetURL(token));return s;
}
async function transform(value,decode=false) {
 if(typeof value==='string')return decode?displayString(value):storeString(value);
 if(!value||typeof value!=='object'||value instanceof Blob||value instanceof ArrayBuffer||ArrayBuffer.isView(value))return value;
 const out=Array.isArray(value)?[]:{};
 for(const k of Object.keys(value)){assertKey(k);out[k]=await transform(value[k],decode);}
 return out;
}
// Reuse unchanged JSON history chunks instead of creating a second copy on every save.
function isJsonHistory(value) {
 if(value===null||typeof value==='string'||typeof value==='boolean')return true;
 if(typeof value==='number')return Number.isFinite(value);
 if(Array.isArray(value))return value.every(isJsonHistory);
 if(value&&Object.getPrototypeOf(value)===Object.prototype)return Object.values(value).every(isJsonHistory);
 return false;
}
async function historyPart(value) {
 if(!isJsonHistory(value)||!global.crypto?.subtle?.digest)return part(value,'history');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));
 const id='history-'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(!await table().get(id))await table().put({id,kind:'history',value});
 return id;
}
async function packHistory(history) {
 if(object(history)&&history[H])return history;
 if(!Array.isArray(history))throw Error('聊天记录必须是数组');
 if(history.some(v=>typeof v==='string'))return history; // legacy chunk references
 const ids=[];for(let i=0;i<history.length;i+=50)ids.push(await historyPart(await transform(history.slice(i,i+50))));
 return {[H]:ids,count:history.length,tail:await transform(history.slice(-8))};
}
async function* messages(ref) { for(const id of ref[H])for(const m of await get(id))yield m; }
async function unpackHistory(ref,decode=true) {
 if(!ref?.[H])return decode?transform(ref||[],true):ref||[];
 const result=[];for await(const m of messages(ref))result.push(decode?await transform(m,true):m);return result;
}
async function normalizeChat(chat) {
 if(!chat||!['string','number'].includes(typeof chat.id)||chat.id==='')throw Error('角色或群聊缺少有效 ID');
 if(chat.archives!==undefined&&!Array.isArray(chat.archives))throw Error('聊天存档必须是数组');
 // Resolve the old active snapshot without loading its history. Keep divergent snapshots.
 const active=chat.archives?.find(a=>a.id===chat.activeArchiveId);
 if(active && active.data?.[A]){
  const data=await get(active.data[A]);
  const keys=Object.keys(data),meta=new Set(['id','archives','activeArchiveId','isPinned','unreadCount','realName','remarkName','name','avatar','folderId','folderIds']);
  let same=true;
  for(const k of keys){if(meta.has(k))continue;
   if(k==='history'&&data.history?.[H]&&chat.history?.[H]){
    const x=data.history,y=chat.history;
    if(x.count!==y.count){same=false;break;}
    // Compare chunks sequentially; references differ between duplicated snapshots.
    const xi=messages(x),yi=messages(y);for(;;){const a=await xi.next(),b=await yi.next();if(a.done||b.done){if(a.done!==b.done)same=false;break;}if(JSON.stringify(a.value)!==JSON.stringify(b.value)){same=false;break;}}
   }else if(JSON.stringify(data[k])!==JSON.stringify(chat[k]))same=false;
   if(!same)break;
  }
  if(active.dataStoredOnChat===true||same){
   if(!same){const kept={...active,id:'archive_'+uid(),name:(active.name||'存档')+'（保留快照）',data:active.data};delete kept.dataStoredOnChat;chat.archives.push(kept);}
   active.data={};active.dataStoredOnChat=true;
  }
  else if(Array.isArray(chat.history)||chat.history?.[H]){
   const id='archive_'+uid();chat.archives.push({id,name:'当前聊天',createdAt:Date.now(),updatedAt:Date.now(),data:{},dataStoredOnChat:true});chat.activeArchiveId=id;
  }else {Object.assign(chat,data);active.data={};active.dataStoredOnChat=true;}
 }
 return chat;
}
async function packArchiveData(data) {
 if(data?.[A])return data;
 if(!object(data))throw Error('聊天存档数据无效');
 const out=await compact(data);
 if(Array.isArray(data.history))out.history=await packHistory(data.history);
 const id=await part(out,'archive');
 return {[A]:id,messageCount:out.history?.count??out.history?.length??0,journalCount:out.memoryJournals?.length||0};
}
async function compact(value,key='') {
 if(typeof value==='string')return storeString(value);
 if(!value||typeof value!=='object'||value instanceof Blob||value instanceof ArrayBuffer||ArrayBuffer.isView(value))return value;
 if(value[H]||value[A])return value;
 const out=Array.isArray(value)?[]:{};
 for(const k of Object.keys(value)){assertKey(k);
  if(k==='data'&&key==='archive')out[k]=await packArchiveData(value[k]);
  else if(k==='archives'&&Array.isArray(value[k])){out[k]=[];for(const a of value[k])out[k].push(await compact(a,'archive'));}
  else out[k]=await compact(value[k],k);
 }
 return out;
}
function pinChat(chat) {
 if(!chat)return ()=>{};
 pins.set(chat,(pins.get(chat)||0)+1);accessEpoch.set(chat,(accessEpoch.get(chat)||0)+1);
 let released=false;return ()=>{if(released)return;released=true;const n=(pins.get(chat)||1)-1;if(n)pins.set(chat,n);else pins.delete(chat);};
}
function historyCount(chat) {
 const state=cold.get(chat);
 if(state&&chat.history===state.preview)return Math.max(0,(Number(state.ref.count)||0)+chat.history.length-state.length);
 return chat?.history?.[H]?Number(chat.history.count)||0:Array.isArray(chat?.history)?chat.history.length:0;
}
async function readChatHistory(chat) {
 if(!chat)return [];
 const state=cold.get(chat),history=chat.history;
 if(!state)return Array.isArray(history)?history.slice():unpackHistory(history,true);
 if(history!==state.preview)throw Error('聊天仍处于预览状态，完整记录尚未加载；已阻止用预览覆盖原记录');
 const preview=clone(history),changed=JSON.stringify(preview)!==state.signature;
 const full=await unpackHistory(state.ref,true);
 return changed?full.slice(0,Math.max(0,full.length-state.length)).concat(await transform(preview,true)):full;
}
async function diskChat(chat) {
 const state=cold.get(chat),preview=state&&chat.history===state.preview;
 if(state&&!preview&&chat.history!==undefined)throw Error('完整聊天尚未加载，已阻止覆盖；请重新打开聊天');
 // Freeze one record before the first await so an archive switch cannot mix two branches.
 const snapshot=clone(chat),out={};
 for(const k of Object.keys(snapshot)){
  if(k===H)continue;
  if(k==='history'){
   if(state){
    if(JSON.stringify(snapshot.history)===state.signature)out.history=state.ref;
    else {const full=await unpackHistory(state.ref,false);out.history=await packHistory(full.slice(0,Math.max(0,full.length-state.length)).concat(await transform(snapshot.history)));}
   }else out.history=await packHistory(snapshot.history||[]);
  }else if(k==='archives'&&Array.isArray(snapshot.archives)){
   out.archives=[];for(const a of snapshot.archives){const copy={...a};if(copy.dataStoredOnChat&& !Object.keys(copy.data||{}).length)copy.data={};else copy.data=await packArchiveData(copy.data||{});out.archives.push(await transform(copy));}
  }else out[k]=await compact(snapshot[k],k);
 }
 if(snapshot.history===undefined&&state)out.history=state.ref;
 return normalizeChat(out);
}
async function runtimeChat(row) {
 const ref=row.history?.[H]?row.history:null;
 const out={...row};delete out[H];delete out.__kissWriteRevision;writeVersions.set(out,Number(row.__kissWriteRevision)||0);
 if(ref){out.history=clone(ref.tail||[]);cold.set(out,{ref,preview:out.history,length:out.history.length,signature:JSON.stringify(out.history)});}
 // Only decode metadata. Old messages and archive snapshots stay on disk.
 for(const k of Object.keys(out))if(k!=='history'&&k!=='archives')out[k]=await transform(out[k],true);
 const journal=await dexieDB.safeMeta.get('chat-outbox:'+row.id);
 if(journal?.archiveId===row.activeArchiveId&&journal?.messages?.length){const full=await unpackHistory(row.history,true),ids=new Set(full.map(m=>m.id));for(const m of journal.messages)if(!ids.has(m.id)){full.push(await transform(m,true));ids.add(m.id);}out.history=full;cold.delete(out);}
 return out;
}
async function hydrateChat(chat) {
 if(!chat)return;
 accessEpoch.set(chat,(accessEpoch.get(chat)||0)+1);
 if(pending.has(chat))return pending.get(chat);
 const state=cold.get(chat);if(!state)return;
 const job=(async()=>{
  const branch=chat.activeArchiveId;
  let history=await unpackHistory(state.ref,true);
  if(cold.get(chat)!==state||chat.activeArchiveId!==branch)throw Error('聊天分支已变化，请重新打开当前聊天');
  if(chat.history!==state.preview)throw Error('聊天预览已被替换，原记录未覆盖，请重新打开');
  if(JSON.stringify(chat.history)!==state.signature)history=history.slice(0,Math.max(0,history.length-state.length)).concat(await transform(clone(chat.history),true));
  if(cold.get(chat)!==state||chat.activeArchiveId!==branch||chat.history!==state.preview)throw Error('聊天分支已变化，原记录未覆盖');
  chat.history=history;
  cold.delete(chat);
 })();pending.set(chat,job);try{await job;}finally{pending.delete(chat);}
}
async function hydrateArchive(archive) { if(archive?.data?.[A]){const ref=archive.data;const data=await get(ref[A]);const full=await transform({...data,history:await unpackHistory(data.history,true)},true);if(archive.data===ref)archive.data=full;} }
function isActiveChat(chat) {
 return typeof currentChatId!=='undefined'&&currentChatId===chat.id;
}
function generationInProgress(){return typeof isGenerating!=='undefined'?!!isGenerating:!!global.isGenerating;}
function evictOthers(keep) {
 const run=async()=>{
  if(generationInProgress())return;
  for(const chat of [...(db.characters||[]),...(db.groups||[])]){
   if(chat===keep||isActiveChat(chat)||pins.has(chat)||pending.has(chat)||cold.has(chat)||!Array.isArray(chat.history))continue;
   const history=chat.history,length=history.length,last=history.at(-1),branch=chat.activeArchiveId,epoch=accessEpoch.get(chat)||0;
   const unchanged=()=>!generationInProgress()&&!isActiveChat(chat)&&!pins.has(chat)&&!pending.has(chat)&&!cold.has(chat)&&chat.history===history&&history.length===length&&history.at(-1)===last&&chat.activeArchiveId===branch&&(accessEpoch.get(chat)||0)===epoch;
   const row=await diskChat(chat);if(!unchanged())continue;
   await dexieDB[db.characters.includes(chat)?'characters':'groups'].put(row);
   if(!unchanged())continue;
   const ref=row.history;if(!ref?.[H])continue;
   chat.history=clone(ref.tail);cold.set(chat,{ref,preview:chat.history,length:chat.history.length,signature:JSON.stringify(chat.history)});
   for(const a of chat.archives||[]){const packed=row.archives?.find(item=>item.id===a.id);if(!a.dataStoredOnChat&&packed?.data?.[A])a.data=packed.data;}
  }
 };
 const job=serial.then(run);serial=job.catch(()=>{});return job;
}
function waitForWrites(){return serial;}
async function inspectChat(chat) {
 const key=(db.characters||[]).includes(chat)?'characters':'groups';
 const row=await dexieDB[key].get(chat.id);
 const report={chatId:chat.id,activeArchiveId:chat.activeArchiveId,memoryPreviewCount:Array.isArray(chat.history)?chat.history.length:0,currentMessageCount:historyCount(chat),cold:cold.has(chat),persistedMessageCount:row?.history?.count??row?.history?.length??0,archives:[]};
 for(const a of chat.archives||[]){const data=a.dataStoredOnChat===true&&a.id===chat.activeArchiveId?chat:a.data;report.archives.push({id:a.id,name:a.name,current:a.id===chat.activeArchiveId,messageCount:data===chat?historyCount(chat):data?.messageCount??data?.history?.count??data?.history?.length??0,journalCount:data?.journalCount??data?.memoryJournals?.length??0});}
 return report;
}
async function exportChatSafety(chat) {
 const key=(db.characters||[]).includes(chat)?'characters':'groups';
 const row=await dexieDB[key].get(chat.id);if(!row)throw Error('未找到已保存的聊天，未改动任何数据');
 // Read the persisted snapshot directly: this export must never save or clean the live DB.
 const report=await inspectChat(chat),parts=[new Blob(['{"format":"kiss-chat-safety-v1","createdAt":'+Date.now()+',"report":'+JSON.stringify(report)+',"chat":'])];
 let chunks=[],size=0;
 for await(const piece of json(row)){chunks.push(piece);size+=piece.length;if(size>=262144){parts.push(new Blob(chunks));chunks=[];size=0;await pause();}}
 if(chunks.length)parts.push(new Blob(chunks));for(const [name,metaKey] of [['previousSavedChat','chat-checkpoint:'+key+':'+chat.id],['pendingMessages','chat-outbox:'+chat.id]]){const stored=await dexieDB.safeMeta.get(metaKey);if(stored){parts.push(new Blob([','+JSON.stringify(name)+':']));for await(const piece of json(name==='previousSavedChat'?stored.chat:stored))parts.push(new Blob([piece]));}}parts.push(new Blob(['}']));
 download(new Blob(parts,{type:'application/json'}),'KISS-聊天保护副本-'+Date.now()+'.json');
 return report;
}
// Incremental JSON reader. No whole-file .text(), joined legacy strings, or full-db clone.
class JSONReader {
 constructor(stream,reduce){this.reader=stream.pipeThrough(new TextDecoderStream()).getReader();this.buf='';this.pos=0;this.done=false;this.reduce=reduce;this.depth=0;}
 async fill(){if(this.pos<this.buf.length)return true;if(this.done)return false;const n=await this.reader.read();this.buf=n.value||'';this.pos=0;this.done=n.done;return this.buf.length?true:!this.done&&this.fill();}
 async peek(){return await this.fill()?this.buf[this.pos]:'';}
 async space(){while(await this.fill()){const m=/\S/.exec(this.buf.slice(this.pos));if(m){this.pos+=m.index;return;}this.pos=this.buf.length;}}
 async expect(c){await this.space();if(await this.peek()!==c)throw Error('备份 JSON 结构不完整');this.pos++;}
 async string(){await this.expect('"');const pieces=['"'];let escaped=false;
  for(;;){if(!await this.fill())throw Error('备份字符串被截断');let start=this.pos;
   while(this.pos<this.buf.length){const c=this.buf[this.pos++];if(escaped){escaped=false;continue;}if(c==='\\'){escaped=true;continue;}if(c==='"'){pieces.push(this.buf.slice(start,this.pos));return JSON.parse(pieces.join(''));}}
   pieces.push(this.buf.slice(start));
  }
 }
 async value(path=[]){if(++this.depth>180)throw Error('备份嵌套过深');await this.space();const c=await this.peek();let v;
  if(c==='"')v=await this.string();
  else if(c==='{'||c==='['){const arr=c==='[';this.pos++;v=arr?[]:{};const close=arr?']':'}';await this.space();let i=0;
   if(await this.peek()!==close)for(;;){let key=arr?i++:await this.string();if(!arr){assertKey(key);await this.expect(':');if(Object.hasOwn(v,key))throw Error('备份有重复字段');}
    if(typeof key==='string'&&key.startsWith('__phone'))throw Error('备份含内部存储字段，请使用导出功能生成备份');
    const item=await this.value([...path,key]);if(item!==OMIT)v[key]=item;
    await this.space();const next=await this.peek();if(next===close)break;if(next!==',')throw Error('备份 JSON 分隔符无效');this.pos++;await this.space();if(await this.peek()===close)throw Error('备份 JSON 含尾逗号');
   }
   await this.expect(close);
  }else {let token='';while(await this.fill()){const m=/[\s,\]}]/.exec(this.buf.slice(this.pos));const end=m?this.pos+m.index:this.buf.length;token+=this.buf.slice(this.pos,end);this.pos=end;if(m)break;}try{v=JSON.parse(token);}catch{throw Error('备份含无效值');}if(v&&typeof v==='object')throw Error('备份含无效值');}
  this.depth--;return this.reduce?await this.reduce(path,v):v;
 }
 async close(){await this.reader.cancel();this.reader.releaseLock();}
}
const OMIT=Symbol('omit');
function historyPath(path){if(path.at(-1)!=='history')return false;const p=path[0]==='modules'?path.slice(1):path;return p.length===3&&['characters','groups'].includes(p[0])||p.at(-2)==='data'&&p.at(-4)==='archives';}
async function readFile(blob) {
 const magic=new Uint8Array(await blob.slice(0,2).arrayBuffer());let stream=blob.stream();
 if(magic[0]===31&&magic[1]===139){if(typeof DecompressionStream==='undefined')throw Error('当前浏览器不支持解压，请升级浏览器后重试');stream=stream.pipeThrough(new DecompressionStream('gzip'));}
 const histories=new Map();let reader,parsed=0;
 const reduce=async(path,v)=>{
  if(typeof v==='string')v=await storeString(v);
  if(path.length&&typeof path.at(-1)==='number'&&path.at(-2)==='history'&&historyPath(path.slice(0,-1))){
   // Legacy string chunk ids must still go through legacy normalization.
   if(typeof v==='string')return v;
   const key=JSON.stringify(path.slice(0,-1));let s=histories.get(key);if(!s){s={ids:[],batch:[],tail:[],count:0};histories.set(key,s);}
   s.batch.push(v);s.tail.push(v);if(s.tail.length>8)s.tail.shift();s.count++;
   if(s.batch.length>=50){s.ids.push(await part(s.batch,'history'));s.batch=[];}
   return OMIT;
  }
  if(historyPath(path)&&Array.isArray(v)){
   const key=JSON.stringify(path),s=histories.get(key);histories.delete(key);
   if(s){if(v.length)throw Error('聊天记录混用了分块和消息格式');if(s.batch.length)s.ids.push(await part(s.batch,'history'));return {[H]:s.ids,count:s.count,tail:s.tail};}
   return v;
  }
  if(path.at(-1)==='data'&&typeof path.at(-2)==='number'&&path.at(-3)==='archives')return packArchiveData(v);
  if(++parsed%2500===0)await pause();
  return v;
 };
 reader=new JSONReader(stream,reduce);
 try {
  const first=await reader.value();await reader.space();
  let data;
  if(first?.type==='header'&&first.format==='ovo-stream-backup'){
   if(first.formatRevision!==1||!Array.isArray(first.dataKeys))throw Error('不支持的 OVO 流式备份版本');
   first.dataKeys.forEach(assertKey);data={};const containers=new Map();let current=null,count=1,footer=false;
   while(await reader.peek()){
    const r=await reader.value();await reader.space();
    if(footer)throw Error('备份结束标记后存在多余数据');
    if(r.type==='footer'){if(!r.completed||r.recordCount!==count||current||containers.size)throw Error('备份记录数不匹配或文件不完整');footer=true;continue;}
    count++;const {key,value}=r;if(!first.dataKeys.includes(key))throw Error('备份包含清单之外的数据');assertKey(key);
    switch(r.type){
     case 'value':if(containers.has(key)||Object.hasOwn(data,key))throw Error('重复备份字段');data[key]=await compact(value,key);break;
     case 'array-start':case 'object-start':if(Object.hasOwn(data,key))throw Error('重复备份字段');data[key]=r.type==='array-start'?[]:{};containers.set(key,r.type);break;
     case 'array-item':if(containers.get(key)!=='array-start'||current||r.index!==data[key].length)throw Error('备份数组顺序错误');data[key].push(await compact(value,key==='archives'?'archive':''));break;
     case 'object-entry':if(containers.get(key)!=='object-start'||typeof r.property!=='string'||Object.hasOwn(data[key],r.property))throw Error('备份对象结构错误');assertKey(r.property);data[key][r.property]=await compact(value);break;
     case 'chat-start':if(!['characters','groups'].includes(key)||containers.get(key)!=='array-start'||current||r.chatIndex!==data[key].length||!object(value))throw Error('聊天起始记录错误');current={key,index:r.chatIndex,value:await compact(value),ids:[],tail:[],count:0};break;
     case 'chat-history':if(!current||current.key!==key||current.index!==r.chatIndex||!Array.isArray(value))throw Error('聊天记录顺序错误');for(let i=0;i<value.length;i+=50){const batch=await transform(value.slice(i,i+50));current.ids.push(await part(batch,'history'));current.tail=current.tail.concat(batch).slice(-8);current.count+=batch.length;}break;
     case 'chat-end':if(!current||current.key!==key||current.index!==r.chatIndex)throw Error('聊天结束记录错误');current.value.history={[H]:current.ids,count:current.count,tail:current.tail};data[key].push(await normalizeChat(current.value));current=null;break;
     case 'array-end':case 'object-end':if(current||containers.get(key)!==(r.type==='array-end'?'array-start':'object-start'))throw Error('备份容器结束错误');containers.delete(key);break;
     default:throw Error('不支持的备份记录类型：'+r.type);
    }
    if(count%40===0)await pause();
   }
   if(!footer)throw Error('备份缺少完成标记');data._exportVersion=first.exportVersion;data._exportTimestamp=first.exportTimestamp;data._exportTables=first.exportTables;
  }else {if(await reader.peek())throw Error('JSON 备份后存在多余内容');data=first;}
  if(object(data?.modules))data={...data.modules,_exportVersion:data._exportVersion||data.modules._exportVersion};
  if(!object(data))throw Error('备份根节点格式错误');
  if(data.format==='kiss-chat-safety-v1')throw Error('这是聊天保护副本，供诊断与定向恢复使用；不能作为完整备份导入覆盖。');
  // Older OVO partial exports group settings/theater fields in containers.
  if(object(data.globalSettings)){Object.assign(data,data.globalSettings);delete data.globalSettings;}
  if(object(data.theaterData)){Object.assign(data,data.theaterData);delete data.theaterData;}
  const chunks=data.__chunks__;
  async function oldHistory(x){
   if(!Array.isArray(x)||!x.some(v=>typeof v==='string'))return x;
   if(!chunks||!x.every(v=>typeof v==='string'))throw Error('旧备份分块缺失');
   const ids=[];let count=0,tail=[];
   for(const id of x){if(!Object.hasOwn(chunks,id))throw Error('旧备份分块缺失');let batch=chunks[id];if(typeof batch==='string')batch=JSON.parse(batch);if(!Array.isArray(batch))throw Error('旧备份分块无效');const ref=await packHistory(batch);ids.push(...ref[H]);count+=ref.count;tail=tail.concat(ref.tail).slice(-8);}
   return {[H]:ids,count,tail};
  }
  async function resolveLegacy(value,path=[]) {
   if(value?.[H])return value;
   if(value?.[A]){const payload=await resolveLegacy(await get(value[A]),path);return packArchiveData(payload);}
   if(!value||typeof value!=='object'||value instanceof Blob||value instanceof ArrayBuffer||ArrayBuffer.isView(value))return value;
   const out=Array.isArray(value)?[]:{};
   for(const k of Object.keys(value)){if(k==='__chunks__')continue;out[k]=historyPath([...path,Array.isArray(value)?Number(k):k])?await oldHistory(value[k]):await resolveLegacy(value[k],[...path,Array.isArray(value)?Number(k):k]);}
   return out;
  }
  if(chunks)data=await resolveLegacy(data);
  for(const key of CORE){if(data[key]===undefined)continue;if(!Array.isArray(data[key]))throw Error(key+' 必须是数组');const ids=new Set();
   for(let i=0;i<data[key].length;i++){
    let row=data[key][i];if(!object(row)||!['number','string'].includes(typeof row.id)||row.id===''||ids.has(row.id))throw Error(key+' 存在无效或重复 ID');ids.add(row.id);
    if(key==='characters'||key==='groups'){row.history=await oldHistory(row.history);if(Array.isArray(row.history))row.history=await packHistory(row.history);if(row.history===undefined)delete row.history;row=await compact(row);row=await normalizeChat(row);}
    else row=await compact(row);
    data[key][i]=row;
   }
  }
  delete data.__chunks__;
  if(!CORE.some(k=>data[k])&&!Object.keys(data).some(k=>!k.startsWith('_export')))throw Error('文件没有可识别的备份数据');
  // Convert middles only for genuinely old exports, including 3.0_partial.
  if(data._exportVersion&&!String(data._exportVersion).startsWith('3.0')&&data.worldBooks)for(const x of data.worldBooks)if(x.type==='entry'&&['middle','center'].includes(x.position)){x.position='before';x.depth=300;}
  Object.defineProperty(data,'__phonePrepared',{value:true,enumerable:false});
  return data;
 }finally{await reader.close();}
}
async function selectPrepared(data,selected) {
 const out={_exportVersion:'3.0'};
 const groups={personas:['myPersonaPresets','homeSignature','activePersonaId'],worldbooks:['worldBooks'],wallpapers:['wallpaper','bubbleCssPresets','globalCss','globalCssPresets','myStickers','moreProfileCardBg','themeSettings','themePresets'],fonts:['fontUrl','fontPresets']};
 const categoryKeys=new Set(Object.values(groups).flat());
 for(const [cat,keys] of Object.entries(groups))if(selected[cat])for(const k of keys)if(data[k]!==undefined)out[k]=data[k];
 if(selected.settings)for(const k of Object.keys(data))if(!CORE.includes(k)&&!categoryKeys.has(k)&&k!=='appData'&&!k.startsWith('_export'))out[k]=data[k];
 for(const key of ['characters','groups'])if((selected.chats||selected.contacts)&&data[key]){
  const merged=new Map();for(const c of db[key]||[])merged.set(c.id,await diskChat(c));
  for(const c of data[key]){
   const prev=merged.get(c.id);if(!prev&&!selected.contacts)continue;
   let next=selected.contacts?{...c}: {...prev};
   const hist=['history','archives','activeArchiveId','callHistory'];
   if(!selected.chats){for(const k of hist){if(prev&&prev[k]!==undefined)next[k]=prev[k];else delete next[k];}}
   else if(!selected.contacts){for(const k of hist)if(c[k]!==undefined)next[k]=c[k];}
   merged.set(c.id,next);
  }
  out[key]=[...merged.values()];
 }
 if(data.appData){if(global.KissAppData){const chosen=new Set(Object.entries(selected).filter(([,v])=>v).map(([k])=>k));if(Object.keys(global.KissAppData.groups).some(k=>chosen.has(k)))out.appData=await compact(global.KissAppData.select(data.appData,chosen));}else if(selected.settings)out.appData=data.appData;}
 Object.defineProperty(out,'__phonePrepared',{value:true});return out;
}
async function save() {
 if(busy||global.kissCleanupLocked)throw Error('数据正在整理，未保存，请稍后重试');
 if(queuedSave)return queuedSave;
 const run=async()=>{
  queuedSave=null;
  if(busy||global.kissCleanupLocked)throw Error('数据正在整理，未保存，请稍后重试');
  if(typeof syncAllActiveArchives==='function')syncAllActiveArchives();
  // Pack each row separately. Cold histories remain references and never get overwritten by previews.
  let yieldedAt=performance.now();
  const yieldToUI=async()=>{if(performance.now()-yieldedAt>8){await pause();yieldedAt=performance.now();}};
  for(const key of CORE)for(const row of db[key]||[]){await yieldToUI();const packed=['characters','groups'].includes(key)?await diskChat(row):await compact(row);if(['characters','groups'].includes(key))await writeChat(key,packed,row);else await dexieDB[key].put(packed);}
  for(const key of globalSettingKeys)if(db[key]!==undefined){await yieldToUI();await dexieDB.globalSettings.put({key,value:await compact(db[key],key)});}
 };
 const job=serial.then(async()=>{await pause();return run();});queuedSave=job;serial=job.catch(()=>{});return job;
}
// Offline keystrokes save the current chat only, on the same ordered write queue.
const queuedChatSaves=new WeakMap();
async function writeChat(key,packed,chat){
 await dexieDB.transaction('rw',dexieDB[key],dexieDB.safeMeta,async()=>{
  const previous=await dexieDB[key].get(packed.id),revision=Number(previous?.__kissWriteRevision)||0;
  if(writeVersions.has(chat)&&writeVersions.get(chat)!==revision)throw Error('另一个页面已更新此聊天，已阻止旧页面覆盖记录；请先导出保护副本再重新打开');
  if(previous)await dexieDB.safeMeta.put({key:'chat-checkpoint:'+key+':'+packed.id,createdAt:Date.now(),chat:previous});
  packed.__kissWriteRevision=revision+1;await dexieDB[key].put(packed);
 });writeVersions.set(chat,packed.__kissWriteRevision);
 const pending=await dexieDB.safeMeta.get('chat-outbox:'+packed.id);
 if(pending?.messages?.length&&pending.archiveId===packed.activeArchiveId){const ids=new Set((await unpackHistory(packed.history,false)).map(m=>m.id));await dexieDB.transaction('rw',dexieDB.safeMeta,async()=>{const current=await dexieDB.safeMeta.get('chat-outbox:'+packed.id);if(current?.messages?.length&&current.archiveId===packed.activeArchiveId)await dexieDB.safeMeta.put({...current,messages:current.messages.filter(m=>!ids.has(m.id))});});}
}
function stageMessage(chat,message){
 const archiveId=chat.activeArchiveId,value=clone(message),key='chat-outbox:'+chat.id;
 const job=serial.then(async()=>{if(busy||global.kissCleanupLocked)throw Error('数据正在整理，消息尚未保存');const encoded=await transform(value);await dexieDB.transaction('rw',dexieDB.safeMeta,async()=>{const old=await dexieDB.safeMeta.get(key);if(old?.messages?.length&&old.archiveId!==archiveId)throw Error('上一存档仍有未保存消息，请先重试保存');const messages=(old?.messages||[]).filter(m=>m.id!==value.id);messages.push(encoded);await dexieDB.safeMeta.put({key,archiveId,messages,createdAt:Date.now()});});});serial=job.catch(()=>{});return job;
}

function saveChat(chat){
 if(!chat||typeof chat!=='object')return Promise.reject(Error('聊天不存在'));
 if(queuedChatSaves.has(chat))return queuedChatSaves.get(chat);
 const job=serial.then(async()=>{
  queuedChatSaves.delete(chat);await pause();
  if(busy||global.kissCleanupLocked)throw Error('数据正在整理，请稍后重试保存');
  const key=(db.characters||[]).includes(chat)?'characters':(db.groups||[]).includes(chat)?'groups':null;
  if(!key)throw Error('当前账号或聊天已切换，未写入其他账号');
  if(typeof syncChatActiveArchive==='function')syncChatActiveArchive(chat,true);
  const packed=await diskChat(chat);
  if(!(db[key]||[]).includes(chat))throw Error('聊天已移除，未恢复已删除的数据');
  await writeChat(key,packed,chat);
 });
 queuedChatSaves.set(chat,job);serial=job.catch(()=>{});return job;
}
// Desktop interactions share the existing write queue but never traverse chat tables.
function saveHomeSettings(keys) {
 const allowed=new Set(['homeLayoutMode','homeFreePositions','homeLayoutPages','homeLayoutOrder','addedWidgets']);
 const wanted=[...new Set(keys)].filter(key=>allowed.has(key));
 const job=serial.then(async()=>{
  if(busy||global.kissCleanupLocked)throw Error('数据正在整理，请稍后再试');
  const rows=[];
  for(const key of wanted)if(db[key]!==undefined)rows.push({key,value:await compact(db[key],key)});
  await dexieDB.transaction('rw',dexieDB.globalSettings,()=>dexieDB.globalSettings.bulkPut(rows));
 });
 serial=job.catch(()=>{});return job;
}
async function loadRows(name) {
 const out=[];let last,started=false;
 for(;;){let row;
  const collection=started?dexieDB[name].where(':id').above(last):dexieDB[name].orderBy(':id');row=await collection.first();if(!row)break;
  last=CORE.includes(name)?row.id:row.key;started=true;
  if(name==='characters'||name==='groups'){
   if(!row.history?.[H]){row=await diskChat(row);await dexieDB[name].put(row);}
   out.push(await runtimeChat(row));
  }else if(name==='globalSettings')out.push({key:row.key,value:row.key==='appData'?row.value:await transform(row.value,true)});
  else out.push(await transform(row,true));
  if(out.length%30===0)await pause();
 }
 return out;
}
function references(value,found) {
 if(typeof value==='string'){for(const token of value.match(tokenRE)||[])found.add(token.slice(12));return;}
 if(!value||typeof value!=='object'||value instanceof Blob)return;
 if(value[H])value[H].forEach(id=>found.add(id));if(value[A])found.add(value[A]);
 for(const [key,v]of Object.entries(value))if(key!==H&&key!==A)references(v,found);
}
async function collectUnused() {
 const keep=new Set();
 for(const t of dexieDB.tables)if(t.name!=='safeParts')await t.each(row=>references(row,keep));
 const queue=[...keep];for(let i=0;i<queue.length;i++){
  const row=await table().get(queue[i]);if(!row)throw Error('数据块缺失，请保留原备份重新导入');
  const more=new Set();references(row.value,more);for(const id of more)if(!keep.has(id)){keep.add(id);queue.push(id);}
 }
 const keys=await table().toCollection().primaryKeys();let discard=[];
 for(const id of keys)if(!keep.has(id)){discard.push(id);knownAssets.delete(id);if(discard.length===100){await table().bulkDelete(discard);discard=[];}}
 if(discard.length)await table().bulkDelete(discard);
}
async function importData(input) {
 if(busy)return {success:false,error:'正在处理备份，请稍后'};
 await save();if(busy)return {success:false,error:'正在处理备份，请稍后'};
 busy=true;await serial;const wasLocked=global.kissCleanupLocked;global.kissCleanupLocked=true;
 let rollbackApps=null,appsChanged=false;
 try{
  let data=input;if(!input?.__phonePrepared){const blob=new Blob([JSON.stringify(input)]);data=await readFile(blob);}
  const keys=Object.keys(data).filter(k=>!k.startsWith('_export')&&k!=='__phonePrepared');for(const k of keys)assertKey(k);
  if(data.appData&&global.KissAppData){
   const apps=data.appData;global.KissAppData.validate(apps);await global.KissAppData.flush();
   const previous={version:1,complete:true,apps:apps.apps||['mono','morrow','hearu'],records:[]};
   await global.KissAppData.visitRecords(async row=>previous.records.push(await compact(row)),{flush:false,apps:previous.apps});
   rollbackApps=await part(previous,'rollback-apps');
   await dexieDB.safeMeta.put({key:'app-restore',id:rollbackApps});
   appsChanged=true;await global.KissAppData.restore(apps,{skipRollback:true,decode:expand});
  }
  const refs=new Set();references(data,refs);for(const id of refs)if(!await table().where(':id').equals(id).count())throw Error('备份引用了缺失的数据块');
  const tables=[...CORE.map(k=>dexieDB[k]),dexieDB.globalSettings,dexieDB.safeMeta];
  await dexieDB.transaction('rw',tables,async()=>{
   for(const key of CORE)if(data[key]!==undefined){await dexieDB[key].clear();for(const row of data[key])await dexieDB[key].put(row);}
   for(const key of keys)if(!CORE.includes(key))await dexieDB.globalSettings.put({key,value:data[key]});
   await dexieDB.safeMeta.delete('app-restore');
  });
  // Prevent timers from saving the old in-memory db before the caller's refresh.
  for(const key of keys)if(!CORE.includes(key)&&!globalSettingKeys.includes(key))globalSettingKeys.push(key);
  try{await collectUnused();}catch(e){console.warn('备份缓存将在下次导入后清理',e.message);}
  sessionStorage.removeItem('phone-boot-pending');
  return {success:true,message:'已校验并导入，刷新后只加载聊天预览。'};
 }catch(e){if(appsChanged&&rollbackApps)try{await global.KissAppData.restore(await get(rollbackApps),{skipRollback:true,decode:expand});await dexieDB.safeMeta.delete('app-restore');}catch{e.message+='；独立应用恢复失败，请保留原备份重新导入';}global.kissCleanupLocked=wasLocked;return {success:false,error:e.message};}
 finally{busy=false;}
}
async function expand(value) {
 if(value?.[H])return expand(await unpackHistory(value,false));
 if(value?.[A])return expand(await get(value[A]));
 if(typeof value==='string'){
  const tokens=[...new Set(value.match(tokenRE)||[])];for(const t of tokens)value=value.split(t).join(await (await get(t.slice(12))).text());
  for(const [url,t]of reverse)if(value.includes(url))value=value.split(url).join(await (await get(t.slice(12))).text());return value;
 }
 if(!value||typeof value!=='object'||value instanceof Blob||value instanceof ArrayBuffer||ArrayBuffer.isView(value))return value;
 const out=Array.isArray(value)?[]:{};for(const k of Object.keys(value))if(k!==H)out[k]=await expand(value[k]);return out;
}
// Stream an ordinary legacy JSON object, which all three versions can read.
async function* json(value) {
 if(value?.[H]){yield '[';let comma=false;for await(const m of messages(value)){if(comma)yield ',';comma=true;yield*json(m);}yield ']';return;}
 if(value?.[A]){yield*json(await get(value[A]));return;}
 if(typeof value==='string'){yield JSON.stringify(await expand(value));return;}
 if(value===null||typeof value!=='object'){yield JSON.stringify(value)??'null';return;}
 if(Array.isArray(value)){yield '[';for(let i=0;i<value.length;i++){if(i)yield ',';yield*json(value[i]);}yield ']';return;}
 yield '{';let comma=false;for(const k of Object.keys(value)){if(value[k]===undefined||k===H)continue;if(comma)yield ',';comma=true;yield JSON.stringify(k)+':';yield*json(value[k]);}yield '}';
}
function publicChat(row) {
 const out={...row};if(row.archives)out.archives=row.archives.map(a=>a.dataStoredOnChat?{...a,data:Object.fromEntries(Object.entries(row).filter(([k])=>!['id','archives','activeArchiveId','isPinned','unreadCount','realName','remarkName','name','avatar','folderId','folderIds'].includes(k)))}:a);return out;
}
async function* exportJSON(data=null) {
 yield '{"_exportVersion":"3.0","_exportTimestamp":'+Date.now();
 const keys=data?Object.keys(data):[...CORE,...globalSettingKeys];const unique=[...new Set(keys)].filter(k=>!(k==='appData'&&!data&&global.KissAppData));
 for(const key of unique){if(key.startsWith('_export'))continue;const value=data?data[key]:db[key];if(value===undefined)continue;
  yield ','+JSON.stringify(key)+':';
  if(key==='characters'||key==='groups'){yield '[';for(let i=0;i<value.length;i++){if(i)yield ',';const row=await diskChat(value[i]);yield*json(publicChat(row));}yield ']';}
  else yield*json(value);
 }
 // KISS-only apps remain opaque when imported into 1900 and re-exported.
 if(!data&&global.KissAppData&&!unique.includes('appData')){
  await global.KissAppData.flush();yield ',"appData":{"version":1,"complete":true,"apps":["mono","hearu","morrow"],"records":[';
  // Visit API is callback-based; bounded producer/consumer bridge with backpressure.
  let slot=null,done=false,failed=null,wake,ack;
  const producer=global.KissAppData.visitRecords(async r=>{slot=r;if(wake){wake();wake=null;}await new Promise(r=>ack=r);},{flush:false}).then(()=>{done=true;wake?.();},e=>{failed=e;done=true;wake?.();});
  let comma=false;while(!done||slot){if(!slot){await new Promise(r=>wake=r);continue;}if(comma)yield ',';comma=true;yield*json(slot);slot=null;ack();}await producer;if(failed)throw failed;yield ']}';
 }
 yield '}';
}
async function materializeBackup() {
 const data={_exportVersion:'3.0',_exportTimestamp:Date.now()};
 for(const key of [...new Set([...CORE,...globalSettingKeys])])if(db[key]!==undefined){
  if(['characters','groups'].includes(key)){data[key]=[];for(const chat of db[key])data[key].push(await expand(publicChat(await diskChat(chat))));}
  else data[key]=await expand(db[key]);
 }
 if(global.KissAppData)data.appData=await global.KissAppData.snapshot();return data;
}
async function exportBlob(data=null) {
 await save();let gen=exportJSON(data),encoder=new TextEncoder(),cancelled=false;
 const stream=new ReadableStream({async pull(c){try{const n=await gen.next();if(n.done)c.close();else c.enqueue(encoder.encode(n.value));}catch(e){c.error(e);}},async cancel(){cancelled=true;await gen.return?.();}});
 return new Response(typeof CompressionStream==='undefined'?stream:stream.pipeThrough(new CompressionStream('gzip'))).blob();
}
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);}
function recovery(error) {
 const panel=document.createElement('div');panel.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#f4f3ef;color:#202020;padding:70px 24px;font:15px system-ui;overflow:auto';
 const title=document.createElement('h2');title.textContent='数据恢复';const p=document.createElement('p');p.textContent=error?'启动未完成：'+error.message:'上次启动未完成。可以重新导入备份；当前数据不会自动清除。';
 const input=document.createElement('input');input.type='file';input.accept='.ee,.json,.bin,application/octet-stream';
 input.onchange=async()=>{if(!input.files[0])return;input.disabled=true;try{p.textContent='正在检查备份…';const result=await importData(await readFile(input.files[0]));if(!result.success)throw Error(result.error);location.href=location.pathname;}catch(e){p.textContent=e.message;input.disabled=false;}};
 const retry=document.createElement('button');retry.textContent='重试打开';retry.onclick=()=>{sessionStorage.removeItem('phone-boot-pending');location.href=location.pathname;};
 panel.append(title,p,input,retry);document.body.append(panel);
}
async function boot(init) {
 try{const journal=await dexieDB.safeMeta.get('app-restore');if(journal&&global.KissAppData){global.kissCleanupLocked=true;await global.KissAppData.restore(await get(journal.id),{skipRollback:true,decode:expand});await dexieDB.safeMeta.delete('app-restore');sessionStorage.removeItem('phone-boot-pending');location.reload();return;}}catch(e){recovery(e);return;}
 if(location.search.includes('recovery=1')||sessionStorage.getItem('phone-boot-pending')){recovery();return;}
 sessionStorage.setItem('phone-boot-pending','1');
 try{await init();sessionStorage.removeItem('phone-boot-pending');}catch(e){recovery(e);}
}
global.PhoneBackup={isImage:s=>typeof s==='string'&&(s.startsWith('phone-asset:')||/^image\//.test(mimeByURL.get(s)||'')),collectUnused,materializeBackup,selectPrepared,readFile,importData,exportBlob,download,loadRows,save,saveChat,stageMessage,saveHomeSettings,hydrateChat,hydrateArchive,evictOthers,boot,recovery,isCold:c=>cold.has(c),pinChat,isPinned:c=>pins.has(c),historyCount,readChatHistory,waitForWrites,inspectChat,exportChatSafety,packHistory,unpackHistory,compact,expand,diskChat,runtimeChat,json,JSONReader,publicChat};
})(window);

