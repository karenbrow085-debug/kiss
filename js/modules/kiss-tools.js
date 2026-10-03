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
 const el=panel(source.id==='global-beautification-css'?'全局 CSS':'气泡 CSS','CODE / YOUR OWN STYLE',`<div class="kt-editor-tools"><input type="search" placeholder="搜索关键词…" aria-label="搜索代码"><output>0 / 0</output><button data-prev aria-label="上一个匹配">↑</button><button data-next aria-label="下一个匹配">↓</button><button data-wrap>自动换行</button></div><textarea class="kt-code" aria-label="CSS代码编辑器" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>`,`<span>${disabled?'当前样式未启用，可查看和搜索':'完成后写回原输入框，再按原页面的应用 / 保存按钮生效'}</span><button data-cancel>取消</button><button class="kt-primary" data-done>完成编辑</button>`,'kt-editor');
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
 const box=document.createElement('div');box.className='kt-setting';box.dataset.ktSticker=surface;box.innerHTML=`<label><span>表情包匹配 <small>${surface==='hu'?'HearU':'404'}</small></span><input type="checkbox" aria-label="开启表情包匹配"></label><p>输入文字时匹配已有表情包，点击后发送。名称相近且唯一时兼容角色表情输出；不额外调用 AI。</p>`;
 const input=box.querySelector('input');input.checked=enabled(surface);input.onchange=async()=>{const before=db.stickerMatchSettings;db.stickerMatchSettings={...before,[surface]:input.checked};try{await saveData();}catch(e){db.stickerMatchSettings=before;input.checked=enabled(surface);showToast('开关保存失败');}hideSuggestions();};parent.prepend(box);
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
async function scan(){
 if(!dexieDB)throw Error('数据库尚未加载');
 // Synchronize active archives once before reading; do not add the in-memory db again.
 await saveData();await window.KissHearUData?.flush();
 const records=[];const tables=await Promise.all(dexieDB.tables.map(async t=>({table:t,rows:await t.toArray()})));
 for(const {table,rows} of tables)for(const row of rows)records.push({store:'dexie',table:table.name,key:row[table.schema.primKey.keyPath],row,units:rowUnits(table.name,row)});
 const hu=await window.KissHearUData?.snapshot()||[];hu.forEach(row=>records.push({store:'hu',key:row.id,row,units:C.recordUnits(row,'hu','HearU '+row.id)}));
 for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i),value=localStorage.getItem(key);let cat=C.fieldCategory(key,'hu');if(/profile/i.test(key))cat='images';if(/hearu\.player/i.test(key))cat='music';records.push({store:'local',key,row:value,units:[{path:[],cat,value,label:'本地 / '+key,removeRecord:true}]});}
 const cacheRows=[];if('caches' in window)for(const name of await caches.keys()){const cache=await caches.open(name);for(const req of await cache.keys()){const response=await cache.match(req);if(!response)continue;const bytes=(await response.clone().blob()).size;cacheRows.push({name,request:req.url,cat:/^image\//.test(response.headers.get('content-type')||'')?'cacheImages':'cacheOther',bytes});}}
 const sizes={},details={},groups={};const add=(cat,n,label)=>{sizes[cat]=(sizes[cat]||0)+n;const name=label.replace(/ #\d+$/, '');const map=groups[cat] ||= new Map();const entry=map.get(name)||{label:name,bytes:0,count:0};entry.bytes+=n;entry.count++;map.set(name,entry);};
 for(const r of records){let sum=0;for(const u of r.units){const bytes=C.byteSize(u.value);sum+=bytes;add(u.cat,bytes,u.label);}add('structure',Math.max(0,C.byteSize(r.row)-sum),'结构开销');}
 cacheRows.forEach(r=>add(r.cat,r.bytes,r.name+' / '+r.request));
 for(const [cat,map] of Object.entries(groups))details[cat]=[...map.values()].map(x=>({...x,label:x.label+(x.count>1?' · '+x.count+' 项':'')}));
 let estimate=null;try{estimate=await navigator.storage?.estimate();}catch{}
 let unknown=[];if(indexedDB.databases)unknown=(await indexedDB.databases()).filter(x=>!['章鱼喷墨机DB_ee','HearU-v1'].includes(x.name)).map(x=>x.name);
 return {records,cacheRows,sizes,details,estimate,unknown};
}
function busy(){return (typeof isGenerating!=='undefined' && isGenerating) || window.KissHearUData?.busy() || (typeof aiGenerationControl!=='undefined' && aiGenerationControl.isActive());}
async function encodeBackup(value){
 if(value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)){const blob=value instanceof Blob?value:new Blob([value]);const bytes=new Uint8Array(await blob.arrayBuffer());let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));return {__kissBinary:true,kind:value instanceof Blob?'blob':value instanceof ArrayBuffer?'buffer':value.constructor.name,type:blob.type,data:btoa(raw)};}
 if(Array.isArray(value))return Promise.all(value.map(encodeBackup));
 if(value && typeof value==='object'){const result={};for(const [k,v] of Object.entries(value))result[k]=await encodeBackup(v);return result;}return value;
}
async function decodeBackup(value){
 if(value?.__kissBinary===true){const bytes=Uint8Array.from(atob(value.data),c=>c.charCodeAt(0));if(value.kind==='blob')return new Blob([bytes],{type:value.type});if(value.kind==='buffer')return bytes.buffer;const constructors={Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,Float32Array,Float64Array};const T=constructors[value.kind];if(!T)throw Error('备份二进制类型不支持');return new T(bytes.buffer);}
 if(Array.isArray(value))return Promise.all(value.map(decodeBackup));if(value && typeof value==='object'){const out={};for(const [k,v] of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(k))throw Error('非法备份字段');out[k]=await decodeBackup(v);}return out;}return value;
}
async function downloadBackup(data){const blob=new Blob([JSON.stringify(await encodeBackup({format:'kiss-cleanup-safety-v1',createdAt:new Date().toISOString(),records:data.records.map(({store,table,key,row})=>({store,table,key,row}))}))],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='kiss-清理前备份-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function apply(data,selected){
 if(busy())throw Error('请等待两边生成结束，再清理数据');
 window.kissCleanupLocked=true;
 const changes=data.records.filter(r=>r.units.some(u=>selected.has(u.cat)&&u.cat!=='structure'));
 try {
 await dexieDB.transaction('rw',dexieDB.tables,async()=>{for(const r of changes.filter(r=>r.store==='dexie')){const table=dexieDB.table(r.table);if(r.table==='globalSettings' || r.units.some(u=>u.removeRecord && selected.has(u.cat)))await table.delete(r.key);else await table.put(C.cleanRecord(r.row,r.units,selected));}});
 const hu=changes.filter(r=>r.store==='hu').map(r=>C.cleanRecord(r.row,r.units,selected));if(hu.length)await window.KissHearUData.replace(hu);
 for(const r of changes.filter(r=>r.store==='local'))localStorage.removeItem(r.key);
 for(const r of data.cacheRows.filter(r=>selected.has(r.cat)))await (await caches.open(r.name)).delete(r.request);
 await loadData();
 // Reload prevents old view state or archive snapshots from resurrecting removed data.
 location.reload();
 } catch(error) {
  try {await dexieDB.transaction('rw',dexieDB.tables,async()=>{for(const r of changes.filter(r=>r.store==='dexie'))await dexieDB.table(r.table).put(r.row);});const oldHu=changes.filter(r=>r.store==='hu').map(r=>r.row);if(oldHu.length)await window.KissHearUData.replace(oldHu);for(const r of changes.filter(r=>r.store==='local'))localStorage.setItem(r.key,r.row);await loadData();} catch(rollbackError){throw Error(error.message+'；恢复未完成：'+rollbackError.message);}
  throw error;
 }
}
async function manager(){
 hideSuggestions();const el=panel('给数据留一点空间。','STORAGE / A LITTLE LIGHTER','<div class="kt-body"><p>正在读取 404、HearU 与浏览器缓存…</p></div>');let data;
 try{data=await scan();}catch(e){el.querySelector('.kt-body').textContent='读取失败：'+e.message;return;}
 const total=Object.values(data.sizes).reduce((a,b)=>a+b,0), selected=new Set();
 el.querySelector('.kt-body').innerHTML=`<small>可分类数据 · 估算</small><div class="kt-stat">${fmt(total)}</div><p>数字按已保存数据的 UTF-8 / 文件大小计算，同一记录只计一次。不是运行内存，实际磁盘占用和释放量可能不同。${data.estimate?'浏览器报告此站点总占用约 '+fmt(data.estimate.usage||0)+'。':''}</p><p>不勾选的类别不会被清除。标有“影响对话”的数据删除后会改变人设、记忆或生成配置。</p><div class="kt-categories">${Object.entries(C.catalog).filter(([cat])=>(data.sizes[cat]||0)>0).map(([cat,[name,desc,risk]])=>`<div class="kt-row"><label><input type="checkbox" data-cat="${cat}" ${cat==='structure'?'disabled':''}><span>${name}${risk?'<small class="kt-risk">影响对话</small>':''}</span><b>${fmt(data.sizes[cat])}</b></label><p>${desc}</p><details><summary>查看明细 · ${data.details[cat].length} 项</summary><ul>${data.details[cat].map(x=>`<li><span>${esc(x.label)}</span><b>${fmt(x.bytes)}</b></li>`).join('')}</ul></details></div>`).join('')}</div>${data.unknown.length?'<p>其他数据库（保留，未计入分类合计）：'+data.unknown.map(esc).join('、')+'</p>':''}<label class="kt-option"><input type="checkbox" data-backup checked>清除前下载数据备份（不包含浏览器缓存）</label><button data-backup-now>单独下载清理备份</button><button data-restore>恢复清理备份</button><input type="file" data-restore-file accept="application/json" hidden>`;
 el.querySelector('footer').innerHTML='<span data-selected>已选 0 项 · 0 B</span><button data-none>取消选择</button><button class="kt-primary" data-clean disabled>清除所选</button>';
 const clean=el.querySelector('[data-clean]');function update(){const bytes=[...selected].reduce((n,k)=>n+data.sizes[k],0);el.querySelector('[data-selected]').textContent='已选 '+selected.size+' 项 · '+fmt(bytes);clean.disabled=!selected.size;}
 el.querySelectorAll('[data-cat]').forEach(i=>i.onchange=()=>{i.checked?selected.add(i.dataset.cat):selected.delete(i.dataset.cat);update();});el.querySelector('[data-none]').onclick=()=>{selected.clear();el.querySelectorAll('[data-cat]').forEach(i=>i.checked=false);update();};el.querySelector('[data-backup-now]').onclick=()=>downloadBackup(data);
 clean.onclick=async()=>{const names=[...selected].map(k=>C.catalog[k][0]).join('、');if(!confirm('确定清除：'+names+'？\n未选的数据保留。清理后将刷新页面；选中人设、记忆、聊天或规则会影响后续对话。'))return;clean.disabled=true;el.querySelector('[data-kt-close]').disabled=true;try{if(busy())throw Error('请等待生成结束');data=await scan();if(el.querySelector('[data-backup]').checked)await downloadBackup(data);await apply(data,selected);}catch(e){window.kissCleanupLocked=false;alert('清理未完成：'+e.message+'。已下载的备份可用于恢复；请刷新后检查。');clean.disabled=false;el.querySelector('[data-kt-close]').disabled=false;}};
 el.querySelector('[data-restore]').onclick=()=>el.querySelector('[data-restore-file]').click();el.querySelector('[data-restore-file]').onchange=async e=>{try{const value=await decodeBackup(JSON.parse(await e.target.files[0].text()));if(value.format!=='kiss-cleanup-safety-v1'||!Array.isArray(value.records))throw Error('不是本功能导出的清理备份');if(busy())throw Error('请等待生成结束');if(!confirm('恢复备份会覆盖备份中的同名记录，确定恢复？'))return;const allowed=new Set(dexieDB.tables.map(t=>t.name));for(const r of value.records)if(!['dexie','hu','local'].includes(r.store)||r.store==='dexie'&&!allowed.has(r.table))throw Error('备份含不支持的类型');await dexieDB.transaction('rw',dexieDB.tables,async()=>{for(const r of value.records.filter(r=>r.store==='dexie'))await dexieDB.table(r.table).put(r.row);});const hu=value.records.filter(r=>r.store==='hu').map(r=>r.row);if(hu.length)await window.KissHearUData.replace(hu);await loadData();for(const r of value.records.filter(r=>r.store==='local'))localStorage.setItem(r.key,r.row);location.reload();}catch(e){alert('恢复失败：'+e.message);}};
}
function enhance(){
 for(const id of ['global-beautification-css','setting-custom-bubble-css']){const source=document.getElementById(id);if(!source||source.parentNode.querySelector('[data-kt-editor="'+id+'"]'))continue;const b=document.createElement('button');b.type='button';b.className='kt-launch';b.dataset.ktEditor=id;b.textContent='↗ 放大编辑 / 关键词搜索';b.onclick=()=>editor(source);source.before(b);}
 addSetting(document.querySelector('#chat-settings-screen #setting-tab-basic'),'404');
 addSetting(document.querySelector('#hearu-app .hu-chat-settings'),'hu');
 const screen=document.querySelector('#storage-analysis-screen .storage-content-scroll');if(screen&&!screen.querySelector('[data-kt-manager]')){const b=document.createElement('button');b.type='button';b.className='kt-launch';b.dataset.ktManager='';b.style.cssText='width:100%;padding:18px;margin:4px 0 18px;text-align:left;border-radius:15px;background:#111;color:white';b.innerHTML='<span style="font-size:9px;letter-spacing:.12em;opacity:.6">DATA / EDIT YOUR SPACE</span><br><span style="display:block;margin-top:7px;font-size:15px">分类占用与全方位清理 ↗</span>';b.onclick=manager;screen.prepend(b);}
}
window.KissDataManager={scan,open:manager};let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhance();});}).observe(document.body,{childList:true,subtree:true});enhance();
})();
