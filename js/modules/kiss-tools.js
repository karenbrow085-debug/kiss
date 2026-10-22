(function(){
'use strict';
const C=window.KissToolsCore;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n<1024?n+' B':(n/1024**Math.floor(Math.log(n)/Math.log(1024))).toFixed(2)+' '+['B','KB','MB','GB'][Math.floor(Math.log(n)/Math.log(1024))];
C.catalog.cacheImages=['浏览器图片缓存','可重新加载的图片缓存；不会删除图片消息',false];
C.catalog.cacheOther=['浏览器其他缓存','离线资源、请求缓存；清除后需要网络重新加载',false];
C.catalog.unknownDB=['其他数据库','显示可检测到的其他数据库；为避免破坏结构，仅统计、不清除',false];
let overlay=null;
function panel(title,kicker,body,footer='',kind=''){
 overlay?.remove();overlay=document.createElement('div');overlay.className='kt-overlay '+kind;overlay.innerHTML=`<section class="kt-panel" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><div><small>${kicker}</small><h2>${title}</h2></div><button type="button" data-kt-close aria-label="关闭">×</button></header>${body}<footer>${footer}</footer></section>`;document.body.append(overlay);
 overlay.querySelector('[data-kt-close]').onclick=()=>overlay.remove();
 overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();overlay.querySelector('[data-kt-close]').click();}if(e.key==='Tab'){const nodes=[...overlay.querySelectorAll('button,input,textarea,summary')].filter(x=>!x.disabled && x.getClientRects().length);if(e.shiftKey && document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1).focus();}else if(!e.shiftKey && document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus();}}});return overlay;
}
function editor(source){
 const initial=source.value,disabled=source.disabled;
 const el=panel(source.id==='global-beautification-css'?'全局 CSS':'气泡 CSS','CODE / YOUR OWN STYLE',`<div class="kt-editor-tools"><input type="search" placeholder="搜索关键词…" aria-label="搜索代码"><output>0 / 0</output><button data-prev aria-label="上一个匹配">上一处</button><button data-next aria-label="下一个匹配">下一处</button><button data-wrap>自动换行</button></div><textarea class="kt-code" aria-label="CSS代码编辑器" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>`,`<span>${disabled?'当前样式未启用，可查看和搜索':'完成后写回原输入框，再按原页面的应用 / 保存按钮生效'}</span><button data-cancel>取消</button><button class="kt-primary" data-done>完成编辑</button>`,'kt-editor');
 const code=el.querySelector('textarea'),query=el.querySelector('input'),out=el.querySelector('output');code.value=initial;code.readOnly=disabled;let hits=[],index=-1;
 function count(){hits=[];index=-1;const q=query.value.toLowerCase(),v=code.value.toLowerCase();if(q){let i=0;while((i=v.indexOf(q,i))>=0){hits.push(i);i+=q.length;}}out.textContent='0 / '+hits.length;}
 function move(delta){if(!hits.length)return;index=(index+delta+hits.length)%hits.length;const pos=hits[index];code.focus();code.setSelectionRange(pos,pos+query.value.length);const line=code.value.slice(0,pos).split('\n').length-1;code.scrollTop=Math.max(0,(line-3)*parseFloat(getComputedStyle(code).lineHeight));out.textContent=(index+1)+' / '+hits.length;}
 query.oninput=()=>{count();move(1);query.focus();};query.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();move(e.shiftKey?-1:1);}};code.oninput=count;el.querySelector('[data-prev]').onclick=()=>move(-1);el.querySelector('[data-next]').onclick=()=>move(1);
 el.querySelector('[data-wrap]').onclick=e=>{code.style.whiteSpace=code.style.whiteSpace==='pre-wrap'?'pre':'pre-wrap';e.target.textContent=code.style.whiteSpace==='pre-wrap'?'横向滚动':'自动换行';};
 const close=()=>{if(code.value!==initial && !disabled && !confirm('放弃这次代码修改？'))return;el.remove();source.focus();};el.querySelector('[data-cancel]').onclick=close;el.querySelector('[data-kt-close]').onclick=close;
 el.querySelector('[data-done]').onclick=()=>{if(!disabled){source.value=code.value;source.dispatchEvent(new Event('input',{bubbles:true}));source.dispatchEvent(new Event('change',{bubbles:true}));}el.remove();source.focus();};code.focus();
}
function enabled(surface){return db.stickerMatchSettings?.[surface]===true;}
window.KissStickerMatch={enabled,resolve:(q,p,s)=>C.resolve(q,p,enabled(s))};
function addSetting(parent,surface){
 if(!parent || parent.querySelector('[data-kt-sticker="'+surface+'"]'))return;
 const box=document.createElement(surface==='hu'?'button':'div');box.dataset.ktSticker=surface;
 if(surface==='hu'){
  box.type='button';box.className='hu-setting-row';box.setAttribute('role','switch');box.setAttribute('aria-label','表情包匹配');
  box.innerHTML='<span>表情包匹配</span><i class="hu-switch" aria-hidden="true"></i>';
  const group=parent.querySelector('.hu-settings-group');if(!group)return;group.append(box);
 }else{
  box.className='feature-card';box.dataset.feature='sticker-match';
  box.innerHTML='<div class="feature-card-header"><div class="feature-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 14c1 3 7 3 8 0"/><path d="M8 9h.01M16 9h.01"/></svg></div><label class="kkt-switch"><input type="checkbox" id="setting-sticker-match" aria-label="表情包匹配"><span class="kkt-slider"></span></label></div><div class="feature-card-body"><div class="feature-card-title">表情包匹配</div><div class="feature-card-desc">输入文字匹配表情包</div></div>';
  const gallery=parent.querySelector('[data-feature="gallery"]');if(gallery)gallery.after(box);else parent.append(box);
 }
 const input=box.querySelector('input');
 function sync(){const on=enabled(surface);if(input)input.checked=on;box.classList.toggle('is-on',on);if(surface==='hu'){box.setAttribute('aria-checked',String(on));box.querySelector('.hu-switch').classList.toggle('on',on);}}
 let saving=false;
 async function save(on){if(saving){sync();return;}saving=true;const before=db.stickerMatchSettings;db.stickerMatchSettings={...before,[surface]:on};sync();try{await saveData();}catch(e){db.stickerMatchSettings=before;sync();showToast('开关保存失败');}finally{saving=false;}hideSuggestions();}
 if(input)input.onchange=()=>save(input.checked);
 box.addEventListener('click',e=>{e.stopImmediatePropagation();if(surface==='hu'){e.preventDefault();save(!enabled(surface));}else if(!e.target.closest('.kkt-switch')){input.checked=!input.checked;input.dispatchEvent(new Event('change'));}});
 sync();
}
let suggestions=null,draftInput=null,timer=null;
function hideSuggestions(){suggestions?.remove();suggestions=null;draftInput=null;}
function positionSuggestions(){if(!suggestions||!draftInput?.isConnected){hideSuggestions();return;}const r=draftInput.getBoundingClientRect();suggestions.style.left=Math.max(10,Math.min(r.left,innerWidth-suggestions.offsetWidth-10))+'px';suggestions.style.top=Math.max(10,r.top-suggestions.offsetHeight-10)+'px';}
function suggest(input){
 hideSuggestions();const hu=input.id==='hu-message',s=hu?'hu':'404';if(!enabled(s)||!input.value.trim())return;
 const pool=hu?window.KissHearUData?.stickers()||[]:db.myStickers||[];const found=C.matches(input.value.trim(),pool);if(!found.length)return;
 draftInput=input;suggestions=document.createElement('div');suggestions.className='kt-suggestions';suggestions.setAttribute('aria-label','匹配的表情包');
 found.forEach(sticker=>{if(!/^(https?:|data:image\/|blob:)/i.test(sticker.data||''))return;const b=document.createElement('button');b.type='button';const img=document.createElement('img');img.src=sticker.data;img.alt=sticker.name;img.loading='lazy';const span=document.createElement('span');span.textContent=sticker.name;b.append(img,span);b.onpointerdown=e=>e.preventDefault();b.onclick=async()=>{hideSuggestions();try{if(hu)await window.KissHearUData.sendSticker(sticker);else await sendSticker(sticker);}catch(e){showToast('表情包发送失败：'+e.message);}};suggestions.append(b);});if(suggestions.children.length){document.body.append(suggestions);positionSuggestions();}
}
document.addEventListener('input',e=>{if(e.target.matches('#message-input,#hu-message')){clearTimeout(timer);timer=setTimeout(()=>suggest(e.target),160);}});
document.addEventListener('pointerdown',e=>{if(suggestions&&!e.target.closest('.kt-suggestions') && e.target!==draftInput)hideSuggestions();});
window.addEventListener('resize',positionSuggestions);document.addEventListener('scroll',hideSuggestions,true);
function rowUnits(name,record){
 const tableCats={worldBooks:'world',myStickers:'stickers',workshopHistory:'workshop',workshopVibeGroups:'workshop',characterPhotos:'gallery',customFonts:'fonts',reader_books:'books',reader_chapters:'books',reader_comments:'books',storage:'preferences'};
 if(name==='characters'||name==='groups')return C.recordUnits(record,'404',(name==='groups'?'群聊':'角色')+' '+(record.remarkName||record.realName||record.name||record.id));
 if(name==='globalSettings')return [{path:['value'],cat:C.fieldCategory(record.key,'global'),value:record.value,label:'全局 / '+record.key}];
 return [{path:[],cat:tableCats[name]||'preferences',value:record,label:name,removeRecord:true}];
}
let scanYieldAt=Date.now();
async function scanPause(){if(Date.now()-scanYieldAt<12)return;await new Promise(resolve=>setTimeout(resolve,0));scanYieldAt=Date.now();}
let scanFlight=null,scanTail=Promise.resolve(),scanCached=null,scanCachedAt=0;
async function visitTable(table,visitor){
 if(!table)return;let last,started=false;
 for(;;){const query=started?table.where(':id').above(last).limit(1):table.limit(1),rows=await query.toArray();if(!rows.length)break;const row=rows[0],key=row[table.schema.primKey.keyPath];await visitor(row,key);last=key;started=true;await scanPause();}
}
async function visitDexie(visitor){
 for(const table of dexieDB.tables){
  if(['safeParts','safeMeta'].includes(table.name))continue;
  await visitTable(table,async(row,key)=>{
   // Classify logical records, never disk-only references or binary backing blocks.
   row=await PhoneBackup.expand(row);
   await visitor({store:'dexie',table:table.name,key,row,units:rowUnits(table.name,row)});
  });
 }
}

async function visitStorageRecords(visitor,{flush=false}={}){
 if(!dexieDB)throw Error('数据库尚未加载');
 if(flush){await saveData();await window.KissAppData.flush();}
 await visitDexie(visitor);
 await window.KissAppData.visitRecords(async row=>{await visitor({store:'app',key:row.app+':'+row.key,row,units:window.KissAppData.units(row)})},{flush:false});
 for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(window.KissAppData.localApp(key))continue;const value=localStorage.getItem(key),cat=C.fieldCategory(key,'global');await visitor({store:'local',key,row:value,units:[{path:[],cat,value,label:'本地 / '+key,removeRecord:true}]});await scanPause();}
}
async function cacheSize(response){
 if(response.type==='opaque'||response.type==='opaqueredirect')return null;
 if(!response.body)return 0;
 // Never clone the response or collect a full Blob just to count its bytes.
 const reader=response.body.getReader();let bytes=0,steps=0;
 try{for(;;){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(++steps%16===0)await scanPause();}return bytes;}
 finally{reader.releaseLock();}
}
let cacheFlight=null,cacheCached=null,cacheCachedAt=0;
const cacheListeners=new Set();let cacheProgressAt=0;
function scanBrowserCaches(onProgress){
 if(onProgress)cacheListeners.add(onProgress);
 const publish=p=>{const now=Date.now();if(p.done!==p.total&&now-cacheProgressAt<80)return;cacheProgressAt=now;for(const listener of cacheListeners)try{listener(p)}catch{}};
 if(!cacheFlight&&cacheCached&&Date.now()-cacheCachedAt<5000){if(onProgress)cacheListeners.delete(onProgress);return Promise.resolve(cacheCached);}
 if(!cacheFlight)cacheFlight=(async()=>{
  const result={cacheRows:[],cacheUnknown:0,sizes:{cacheImages:0,cacheOther:0},details:{cacheImages:[],cacheOther:[]}};let done=0,total=0;
  if('caches' in window)for(const name of await caches.keys()){
   const cache=await caches.open(name),requests=await cache.keys();total+=requests.length;publish({done,total});let next=0;
   const worker=async()=>{for(;;){const index=next++;if(index>=requests.length)return;const req=requests[index],response=await cache.match(req);if(response){const bytes=await cacheSize(response),cat=/^image\//.test(response.headers.get('content-type')||'')?'cacheImages':'cacheOther';result.cacheRows.push({name,request:req.url,cat,bytes,unknown:bytes===null});if(bytes===null)result.cacheUnknown++;else result.sizes[cat]+=bytes;let item=result.details[cat].find(x=>x.label===name);if(!item){item={label:name,bytes:0,count:0};result.details[cat].push(item)}item.bytes+=bytes||0;item.count++;}done++;publish({done,total});await scanPause();}};
   const finished=await Promise.allSettled([worker(),worker()]);const failed=finished.find(x=>x.status==='rejected');if(failed)throw failed.reason;
  }
  cacheCached=result;cacheCachedAt=Date.now();return result;
 })().finally(()=>{cacheFlight=null;cacheListeners.clear()});
 const task=cacheFlight;return onProgress?task.finally(()=>cacheListeners.delete(onProgress)):task;
}
async function runScan(options={}){
 Object.assign(C.catalog,Object.fromEntries(Object.entries(window.KissAppData.catalog).map(([k,[name,desc]])=>[k,[name,desc,true]])));
 const records=[],cacheRows=[],sizes={},details={},groups={},overview={chats:0,contacts:0,worldbooks:0,personas:0,wallpapers:0,fonts:0,settings:0,other:0,monoApp:0,morrowApp:0,hearuApp:0,total:0};
 let cacheUnknown=0;const retained=options.retainSelected;
 const mainCategory=cat=>/^(thought|chat404|media404|video404|voice404|cards404|sticker404|calls|memories)$/.test(cat)?'chats':cat==='persona'?'contacts':cat==='world'?'worldbooks':cat==='userpersona'?'personas':/^(beauty|images|stickers|widgets)$/.test(cat)?'wallpapers':cat==='fonts'?'fonts':/^(gallery|workshop|books)$/.test(cat)?'other':'settings';
 const add=(cat,n,label)=>{sizes[cat]=(sizes[cat]||0)+n;const name=label.replace(/ #\d+$/, '').replace(/\.\d+(?=\.|$)/g,'.*');const map=groups[cat]||=(new Map());const group=map.has(name)||map.size<160?name:'其他明细';const entry=map.get(group)||{label:group,bytes:0,count:0};entry.bytes+=n;entry.count++;map.set(group,entry);};
 if(!retained||[...retained].some(cat=>cat!=='cacheImages'&&cat!=='cacheOther'))await visitStorageRecords(async r=>{
  const measure=C.createSizeCounter(),raw= r.store==='app'?r.row.row:r.row;let sum=0;
  for(let i=0;i<r.units.length;i++){const u=r.units[i],bytes=measure(u.value);sum+=bytes;add(u.cat,bytes,u.label);if(r.store!=='app')overview[mainCategory(u.cat)]+=bytes;if(i%128===127)await scanPause();}
  const overhead=Math.max(0,measure(raw)-sum);add('structure',overhead,'结构开销');
  if(r.store==='app'){const app=r.row.app;overview[app==='mono'?'monoApp':app==='morrow'?'morrowApp':'hearuApp']+=measure(raw);}else overview.settings+=overhead;
  if(retained&&r.units.some(u=>u.cat!=='structure'&&retained.has(u.cat)))records.push(r);
 },{flush:!!retained});
 if(retained&&['cacheImages','cacheOther'].some(cat=>retained.has(cat))){const cache=await scanBrowserCaches();cacheRows.push(...cache.cacheRows);cacheUnknown=cache.cacheUnknown;for(const cat of ['cacheImages','cacheOther'])for(const item of cache.details[cat]||[])add(cat,item.bytes,item.label);}

 for(const [cat,map]of Object.entries(groups))details[cat]=[...map.values()].map(x=>({...x,label:x.label+(x.count>1?' · '+x.count+' 项':'')}));
 overview.total=Object.entries(overview).reduce((n,[k,v])=>k==='total'?n:n+v,0);
 let estimate=null;try{estimate=await navigator.storage?.estimate()}catch{}
 let unknown=[];if(indexedDB.databases)unknown=(await indexedDB.databases()).filter(x=>!['章鱼喷墨机DB_ee','HearU-v1','ForumApp-v1','morrow-post-office'].includes(x.name)).map(x=>x.name);
 return {records,cacheRows,sizes,details,overview,cacheUnknown,estimate,unknown};
}
function scan(options={}){
 if(options.retainSelected){const task=scanTail.catch(()=>{}).then(()=>runScan(options));scanTail=task.then(()=>{},()=>{});scanCached=null;return task;}
 if(scanFlight)return scanFlight;
 if(!options.fresh&&scanCached&&Date.now()-scanCachedAt<5000)return Promise.resolve(scanCached);
 const task=scanTail.catch(()=>{}).then(()=>runScan());scanTail=task.then(()=>{},()=>{});
 scanFlight=task.then(data=>{scanCached=data;scanCachedAt=Date.now();return data}).finally(()=>{scanFlight=null});return scanFlight;
}

function busy(){return window.KissAppData.busy() || (typeof isGenerating!=='undefined' && isGenerating) || window.KissHearUData?.busy() || (typeof aiGenerationControl!=='undefined' && aiGenerationControl.isActive());}
async function encodeBackup(value){
 if(value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)){const blob=value instanceof Blob?value:new Blob([value]);const bytes=new Uint8Array(await blob.arrayBuffer());let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));return {__kissBinary:true,kind:value instanceof Blob?'blob':value instanceof ArrayBuffer?'buffer':value.constructor.name,type:blob.type,data:btoa(raw)};}
 if(Array.isArray(value)){const out=[];for(let i=0;i<value.length;i++){out.push(await encodeBackup(value[i]));if(i%128===127)await scanPause()}return out;}
 if(value && typeof value==='object'){const result={};for(const [k,v] of Object.entries(value))result[k]=await encodeBackup(v);return result;}return value;
}
async function decodeBackup(value){
 if(value?.__kissBinary===true){const bytes=Uint8Array.from(atob(value.data),c=>c.charCodeAt(0));if(value.kind==='blob')return new Blob([bytes],{type:value.type});if(value.kind==='buffer')return bytes.buffer;const constructors={Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,Float32Array,Float64Array};const T=constructors[value.kind];if(!T)throw Error('备份二进制类型不支持');return new T(bytes.buffer);}
 if(Array.isArray(value))return Promise.all(value.map(decodeBackup));if(value && typeof value==='object'){const out={};for(const [k,v] of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(k))throw Error('非法备份字段');out[k]=await decodeBackup(v);}return out;}return value;
}
async function downloadBackup({flush=true}={}){
 const parts=[new Blob(['{"format":"kiss-cleanup-safety-v1","createdAt":'+JSON.stringify(new Date().toISOString())+',"records":['])];let first=true;
 await visitStorageRecords(async({store,table,key,row})=>{const encoded=await encodeBackup({store,table,key,row});parts.push(new Blob([(first?'':',')+JSON.stringify(encoded)]));first=false;await scanPause();},{flush});
 parts.push(new Blob([']}']));const blob=new Blob(parts,{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='kiss-清理前备份-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function apply(data,selected){
 if(busy())throw Error('请等待两边生成结束，再清理数据');
 window.kissCleanupLocked=true;
 const changes=data.records.filter(r=>r.units.some(u=>selected.has(u.cat)&&u.cat!=='structure'));
 try {
 await dexieDB.transaction('rw',dexieDB.tables,async()=>{for(const r of changes.filter(r=>r.store==='dexie')){const table=dexieDB.table(r.table);if(r.table==='globalSettings' || r.units.some(u=>u.removeRecord && selected.has(u.cat)))await table.delete(r.key);else await table.put(C.cleanRecord(r.row,r.units,selected));}});
 const apps=changes.filter(r=>r.store==='app').map(r=>window.KissAppData.clean(r.row,selected));if(apps.length)await window.KissAppData.restore({version:1,complete:false,exact:true,apps:[...new Set(apps.map(r=>r.app))],records:apps});
 const hu=changes.filter(r=>r.store==='hu').map(r=>C.cleanRecord(r.row,r.units,selected));if(hu.length)await window.KissHearUData.replace(hu);
 for(const r of changes.filter(r=>r.store==='local'))localStorage.removeItem(r.key);
 for(const r of data.cacheRows.filter(r=>selected.has(r.cat)))await (await caches.open(r.name)).delete(r.request);
 await loadData();
 await PhoneBackup.collectUnused();
 // Reload prevents old view state or archive snapshots from resurrecting removed data.
 location.reload();
 } catch(error) {
  try {await dexieDB.transaction('rw',dexieDB.tables,async()=>{for(const r of changes.filter(r=>r.store==='dexie'))await dexieDB.table(r.table).put(r.row);});const apps=changes.filter(r=>r.store==='app').map(r=>r.row);if(apps.length)await window.KissAppData.restore({version:1,complete:false,exact:true,apps:[...new Set(apps.map(r=>r.app))],records:apps});const oldHu=changes.filter(r=>r.store==='hu').map(r=>r.row);if(oldHu.length)await window.KissHearUData.replace(oldHu);for(const r of changes.filter(r=>r.store==='local'))localStorage.setItem(r.key,r.row);await loadData();} catch(rollbackError){throw Error(error.message+'；恢复未完成：'+rollbackError.message);}
  throw error;
 }
}
async function manager(){
 hideSuggestions();const el=panel('给数据留一点空间。','STORAGE / A LITTLE LIGHTER','<div class="kt-body"><p>正在读取 404、MONO、Morrow、HearU …</p></div>');let data;
 try{const summary=await scan();data={...summary,sizes:{...summary.sizes},details:{...summary.details}};if(!el.isConnected)return;}catch(e){el.querySelector('.kt-body').textContent='读取失败：'+e.message;return;}
 const total=Object.values(data.sizes).reduce((a,b)=>a+b,0), selected=new Set();
 const renderRow=([cat,[name,desc,risk]])=>`<div class="kt-row"><label><input type="checkbox" data-cat="${cat}" ${cat==='structure'?'disabled':''}><span>${esc(name)}${risk?'<small class="kt-risk">影响对话</small>':''}</span><b>${fmt(data.sizes[cat]||0)}</b></label><p>${esc(desc)}</p><details><summary>查看明细 · ${(data.details[cat]||[]).length} 项</summary><ul>${(data.details[cat]||[]).map(x=>`<li><span>${esc(x.label)}</span><b>${fmt(x.bytes)}</b></li>`).join('')}</ul></details></div>`;
 const appKeys=new Set(Object.keys(window.KissAppData.catalog)),rows=Object.entries(C.catalog),groups=Object.entries(window.KissAppData.groups).map(([key,g])=>{const cats=rows.filter(([cat])=>appKeys.has(cat)&&cat.startsWith(g.app==='hearu'?'hu':g.app)),bytes=cats.reduce((n,[cat])=>n+(data.sizes[cat]||0),0);return `<details class="kt-app-group" data-app-group="${key}"><summary><span>${g.name}<small>查看详情</small></span><b>${fmt(bytes)}</b></summary><div class="kt-app-details">${cats.map(renderRow).join('')}</div></details>`}).join('');
 el.querySelector('.kt-body').innerHTML=`<small>可分类数据 · 估算</small><div class="kt-stat" data-total>${fmt(total)}</div><small data-total-status>应用数据已计入 · 浏览器缓存统计中</small>${data.cacheUnknown?`<p>另有 ${data.cacheUnknown} 个缓存受浏览器保护，大小未知，未计入总量；仍可按分类清理。</p>`:''}<p>选择软件，点开详情后勾选需要清理的数据。未勾选的内容会保留。</p><div class="kt-app-groups">${groups}</div><details class="kt-app-group"><summary><span>404 与浏览器<small>查看详情</small></span></summary><div class="kt-app-details">${rows.filter(([cat])=>!appKeys.has(cat)&&((data.sizes[cat]||0)>0||data.cacheRows.some(r=>r.cat===cat))).map(renderRow).join('')}</div></details><details class="kt-app-group"><summary><span>浏览器缓存<small data-cache-progress>统计中</small></span><b data-cache-bytes></b></summary><div class="kt-app-details" data-browser-caches>正在分批统计，应用数据已可查看。</div></details>${data.unknown.length?'<p>独立数据库（保留）：'+data.unknown.map(name=>esc(name==='kiss-voice-audio-v1'?'语音生成缓存（kiss-voice-audio-v1）':name)).join('、')+'</p>':''}<label class="kt-option"><input type="checkbox" data-backup checked>清除前下载备份</label><button data-backup-now>单独下载清理备份</button><button data-restore>恢复清理备份</button><input type="file" data-restore-file accept="application/json" hidden>`;
 el.querySelector('footer').innerHTML='<span data-selected>已选 0 项 · 0 B</span><button data-none>取消选择</button><button class="kt-primary" data-clean disabled>清除所选</button>';
 let cleaning=false;const clean=el.querySelector('[data-clean]');function update(){const bytes=[...selected].reduce((n,k)=>n+data.sizes[k],0);el.querySelector('[data-selected]').textContent='已选 '+selected.size+' 项 · '+fmt(bytes);clean.disabled=cleaning||!selected.size;}
 el.querySelectorAll('[data-cat]').forEach(i=>i.onchange=()=>{i.checked?selected.add(i.dataset.cat):selected.delete(i.dataset.cat);update();});el.querySelector('[data-none]').onclick=()=>{selected.clear();el.querySelectorAll('[data-cat]').forEach(i=>i.checked=false);update();};el.querySelector('[data-backup-now]').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{if(busy())throw Error('请等待生成结束');await downloadBackup();}catch(err){alert('备份未完成：'+err.message)}finally{b.disabled=false;}};
 clean.onclick=async()=>{const names=[...selected].map(k=>C.catalog[k][0]).join('、');if(!confirm('确定清除：'+names+'？\n未选的数据保留。清理后将刷新页面；选中人设、记忆、聊天或规则会影响后续对话。'))return;cleaning=true;clean.disabled=true;el.querySelector('[data-kt-close]').disabled=true;try{if(busy())throw Error('请等待生成结束');data=await scan({retainSelected:selected});if(el.querySelector('[data-backup]').checked)await downloadBackup({flush:false});await apply(data,selected);}catch(e){cleaning=false;window.kissCleanupLocked=false;alert('清理未完成：'+e.message+'。已下载的备份可用于恢复；请刷新后检查。');clean.disabled=false;el.querySelector('[data-kt-close]').disabled=false;}};
 el.querySelector('[data-restore]').onclick=()=>el.querySelector('[data-restore-file]').click();el.querySelector('[data-restore-file]').onchange=async e=>{try{const value=await decodeBackup(JSON.parse(await e.target.files[0].text()));if(value.format!=='kiss-cleanup-safety-v1'||!Array.isArray(value.records))throw Error('不是本功能导出的清理备份');if(busy())throw Error('请等待生成结束');if(!confirm('恢复备份会覆盖备份中的同名记录，确定恢复？'))return;const allowed=new Set(dexieDB.tables.map(t=>t.name));for(const r of value.records)if(!['dexie','hu','local','app'].includes(r.store)||r.store==='dexie'&&!allowed.has(r.table))throw Error('备份含不支持的类型');const applicationRecords=value.records.filter(r=>r.store==='app').map(r=>r.row);if(applicationRecords.length)window.KissAppData.validate({version:1,records:applicationRecords});await dexieDB.transaction('rw',dexieDB.tables,async()=>{for(const r of value.records.filter(r=>r.store==='dexie'))await dexieDB.table(r.table).put(r.row);});const apps=value.records.filter(r=>r.store==='app').map(r=>r.row);if(apps.length){const payload={version:1,complete:false,exact:true,apps:[...new Set(apps.map(r=>r.app))],records:apps};window.KissAppData.validate(payload);await window.KissAppData.restore(payload);}const hu=value.records.filter(r=>r.store==='hu').map(r=>r.row);if(hu.length)await window.KissHearUData.replace(hu);await loadData();for(const r of value.records.filter(r=>r.store==='local'))localStorage.setItem(r.key,r.row);location.reload();}catch(e){alert('恢复失败：'+e.message);}};
 scanBrowserCaches(({done,total})=>{if(el.isConnected)el.querySelector('[data-cache-progress]').textContent='已统计 '+done+' / '+total+' 项';}).then(result=>{
  if(!el.isConnected||cleaning)return;data.cacheRows=result.cacheRows;data.cacheUnknown=result.cacheUnknown;Object.assign(data.sizes,result.sizes);Object.assign(data.details,result.details);
  el.querySelector('[data-total]').textContent=fmt(Object.values(data.sizes).reduce((a,b)=>a+b,0));
  el.querySelector('[data-total-status]').textContent=result.cacheUnknown?'应用数据与可读取缓存 · 另有大小未知的缓存':'应用数据与浏览器缓存 · 估算';
  el.querySelector('[data-cache-progress]').textContent=result.cacheUnknown?'部分大小未知':'统计完成';el.querySelector('[data-cache-bytes]').textContent=fmt(result.sizes.cacheImages+result.sizes.cacheOther);
  const target=el.querySelector('[data-browser-caches]');target.innerHTML=['cacheImages','cacheOther'].filter(cat=>result.cacheRows.some(row=>row.cat===cat)).map(cat=>renderRow([cat,C.catalog[cat]])).join('')||'<p>没有浏览器缓存。</p>';
  if(result.cacheUnknown)target.insertAdjacentHTML('beforeend','<p>有 '+result.cacheUnknown+' 个缓存大小未知，未计入总量。</p>');
  target.querySelectorAll('[data-cat]').forEach(i=>i.onchange=()=>{i.checked?selected.add(i.dataset.cat):selected.delete(i.dataset.cat);update();});update();
 }).catch(error=>{if(el.isConnected){el.querySelector('[data-total-status]').textContent='应用数据已计入 · 缓存统计未完成';el.querySelector('[data-cache-progress]').textContent='统计未完成';el.querySelector('[data-browser-caches]').textContent='缓存统计失败：'+error.message+'。应用数据仍可正常查看。';}});

}
let heroReading=false;
async function refreshStorageHero(){
 const value=document.querySelector('[data-kt-total-size]');if(!value || heroReading)return;heroReading=true;
 try{const data=await scan();if(value.isConnected)value.textContent=fmt(data.overview.total);}catch(e){value.textContent='暂不可用';}finally{heroReading=false;}
}
function enhance(){
 for(const id of ['global-beautification-css','setting-custom-bubble-css']){const source=document.getElementById(id);if(!source||source.parentNode.querySelector('[data-kt-editor="'+id+'"]'))continue;const b=document.createElement('button');b.type='button';b.className='kt-launch';b.dataset.ktEditor=id;b.textContent='放大编辑 · 搜索代码';b.onclick=()=>editor(source);source.before(b);}
 document.querySelector('#setting-tab-basic [data-kt-sticker="404"]')?.remove();
 addSetting(document.querySelector('#chat-settings-screen #setting-tab-func .feature-grid'),'404');
 addSetting(document.querySelector('#hearu-app .hu-chat-settings'),'hu');
 const screen=document.querySelector('#storage-analysis-screen');
 const open=screen?.querySelector('[data-kt-manager]');if(open && !open.dataset.ktBound){open.dataset.ktBound='true';open.onclick=manager;}
 if(screen && !screen.dataset.ktObserved){screen.dataset.ktObserved='true';new MutationObserver(()=>{if(screen.classList.contains('active'))refreshStorageHero();}).observe(screen,{attributes:true,attributeFilter:['class']});if(screen.classList.contains('active'))refreshStorageHero();}

}
const appGroupStyle=document.createElement('style');appGroupStyle.textContent='.kt-app-group{border:1px solid #e5e5e5;border-radius:16px;margin:12px 0;background:#fff;overflow:hidden}.kt-app-group>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px;font-size:14px;color:#333}.kt-app-group>summary::-webkit-details-marker{display:none}.kt-app-group>summary span{display:flex;align-items:center;gap:12px}.kt-app-group>summary small{font-size:10px;color:#a0a0a0;font-weight:400}.kt-app-group>summary>b{font-size:11px;color:#999;font-weight:400}.kt-app-details{padding:0 16px 12px;border-top:1px solid #eee}.kt-app-details .kt-row{border-radius:0;box-shadow:none;margin:0}.storage-segment.monoApp,.storage-legend-color.monoApp{background:#70777b}.storage-segment.morrowApp,.storage-legend-color.morrowApp{background:#9ca4a7}.storage-segment.hearuApp,.storage-legend-color.hearuApp{background:#c2c8ca}';document.head.append(appGroupStyle);
window.KissDataManager={scan,open:manager,visitTable};let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhance();});}).observe(document.body,{childList:true,subtree:true});enhance();
})();
