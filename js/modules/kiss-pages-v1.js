/* KISS default three-page appearance. Legacy markup and data remain authoritative.
   Any active global CSS returns the original DOM and stylesheet cascade in full. */
(() => {
'use strict';
const IDS = ['chat-list-screen','contacts-screen','more-screen'];
for(const key of ['kissFriendsSort','kissFriendsLegacyMomentsClearedV1'])if(typeof globalSettingKeys!=='undefined'&&!globalSettingKeys.includes(key))globalSettingKeys.push(key);
const $ = (s, root=document) => root.querySelector(s);
const E = (s='') => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL = s => /^(https?:|data:image\/|blob:|assets\/)/i.test(String(s||'')) ? E(s) : '';
const PATHS = {
 back:'M15 4 7 12l8 8', add:'M12 5v14M5 12h14', search:'M21 21l-5-5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0',
 down:'m6 9 6 6 6-6', arrow:'m9 5 7 7-7 7', star:'m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4L12 17.5l-5.7 3.1 1.1-6.4-4.6-4.5 6.4-.9Z',
 heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
 comment:'M21.2 10.7c0 4.5-3.7 7.6-8.8 7.6h-1.8l-4.9 3.3.9-4.6C3.9 15.7 2.4 13.5 2.4 10.7 2.4 6 6.1 2.6 11.8 2.6s9.4 3.4 9.4 8.1Z',
 panel:'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM7 8h10M7 12h7',
 loops:'M14 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0ZM22 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0',
 calendar:'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2ZM7 2v5M17 2v5M3 9h18M7 13h1M12 13h1M17 13h1M7 17h1M12 17h1',
 palette:'M12 2a10 10 0 1 0 0 20h1a2 2 0 0 0 1.5-3.4 1.7 1.7 0 0 1 1.2-2.9H18a4 4 0 0 0 4-4A10 10 0 0 0 12 2ZM7 8h.01M12 6h.01M17 8h.01M6 13h.01',
 pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 cog:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0', views:'M3.5 20v-6M9 20V3M14.5 20v-10M20 20V7', repeat:'m3 7 4-4 4 4M7 3v13a3 3 0 0 0 3 3h4m7-2-4 4-4-4m4 4V8a3 3 0 0 0-3-3h-4', play:'m9 5 11 7-11 7Z', book:'M6.5 2.5h11a1.5 1.5 0 0 1 1.5 1.5v18l-7-4.7L5 22V4a1.5 1.5 0 0 1 1.5-1.5Z', reply:'m8 4-5 5 5 5M3 9h11a7 7 0 0 1 7 7v4', edit:'m16 3 5 5-12 12-6 1 1-6ZM14 5l5 5'
};
function icon(name, cls='') { return `<svg class="ku-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PATHS[name]||PATHS.panel}"/></svg>`; }
const check = '<svg class="ku-check" viewBox="0 0 24 24" role="img" aria-label="认证"><path fill="#078bfa" d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.76 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.76 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.77 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m7.4 12.1 3 3 6.2-6.5" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const button=(label,action,cls='')=>{const key=action.split(':')[0];const names={home:'ホームに戻る',profile:'プロフィールを見る',details:'投稿を開く',like:'いいね',translation:'翻訳',chat:'トークを開く',customize:'表示設定',self:'自分のプロフィール',postmenu:'投稿のメニュー',bookmark:'保存',share:'共有',comment:'コメント',audio:'再生',musicedit:'设置音乐',menuedit:'编辑菜单页文案和图片'};return `<button type="button" class="${cls}" data-ku="${E(action)}"${names[key]?` aria-label="${names[key]}"`:''}>${label}</button>`;};
const people = () => typeof db !== 'undefined' ? db.characters||[] : [];
const groups = () => typeof db !== 'undefined' ? db.groups||[] : [];
const nameOf = c => c?.remarkName || c?.realName || c?.name || '…';
const avatar=(src, cls='')=>`<img class="ku-avatar ${cls}" src="${safeURL(src)}" alt="" loading="lazy" decoding="async">`;
const nowJP=()=>new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
const when=t=>{const d=new Date(t);if(Number.isNaN(+d))return '';const pad=n=>String(n).padStart(2,'0');return `${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;};
let frame=0, currentTab='all', feedLimit=40, folderPage=0, folderSignature='', folderBusyUntil=0;
const postData=new Map();
let playingAudio=null;
const translatedPosts=new Set();
const commentRefs=new Map();let commentSeq=0;
const selfViewedAt=Date.now();
const DEFAULT_SELF_TEXT='今日は少し遠回りをして、家に帰った。\n\n街の灯りがひとつずつ、夕暮れに滲んでいく。言えなかった言葉だけが、まだ胸の奥で揺れている。\n\n何でもない今日を、忘れないように。';
const DEFAULT_SELF_TRANSLATION='今天绕了一点远路，回到家。\n\n街灯一盏盏亮起，在暮色里晕开。那些没能说出口的话，还在心底轻轻摇晃。\n\n把平凡的今天留下，好让自己记得。';
const collapsed = new Set();
function externalCss(){const style=$('#global-css-style');return (style?style.textContent:(typeof db!=='undefined'?db.globalCss:'' )||'').replace(/\/\*[\s\S]*?\*\//g,'').trim().length>0;}
function header(title, kind='') {
 return `<header class="ku-head ku-head-${kind}">${button(icon('back'),'home','ku-back')}<div class="ku-head-copy">${kind==='menu'?'':'<span class="ku-wordmark">K I S S</span>'}<h1>${title}</h1>${kind==='friends'?'<p>言えなかった言葉が、まだ胸に降っている。</p>':''}</div>${kind==='friends'?`<time class="ku-date">${E(nowJP())}</time>`:kind==='menu'?'<span class="ku-wordmark">K I S S</span>':`<div class="ku-head-actions">${button('グループ','group')}${button('設定','settings')}</div>`}</header>`;
}
function folderMarkup(tabs) {
 const items=tabs.filter(x=>!x.classList.contains('tab-manage')).map((x,i)=>({label:i===0?'すべて':x.textContent,index:i,active:x.classList.contains('active')}));
 const signature=JSON.stringify(items.map(x=>x.label));
 if(signature!==folderSignature){folderPage=Math.floor(Math.max(0,items.findIndex(x=>x.active))/3);folderSignature=signature;}
 const count=Math.max(1,Math.ceil(items.length/3));folderPage=Math.min(folderPage,count-1);
 const defaults=['日々','グループ','ノート'];
 let pages='';
 for(let page=0;page<count;page++){
  const group=items.slice(page*3,page*3+3), selected=group.findIndex(x=>x.active);
  const content=group.map(x=>button(E(x.label),'folder:'+x.index,'ku-folder'+(x.active?' active':''))).join('');
  const fillers=Array.from({length:3-group.length},(_,i)=>`<span class="ku-folder-placeholder" aria-hidden="true">${defaults.filter(l=>!group.some(x=>x.label===l))[i]||'日々'}</span>`).join('');
  pages+=`<div class="ku-folder-page" aria-hidden="${page!==folderPage}" ${page!==folderPage?'inert':''}><span class="ku-folder-selection" style="transform:translateX(${Math.max(0,selected)*100}%);opacity:${selected<0?0:1}"></span>${content}${fillers}</div>`;
 }
 return `<div class="ku-folders"><div class="ku-folder-items" tabindex="0" role="group" aria-label="フォルダー。左右にスワイプして切り替え" data-pages="${count}"><div class="ku-folder-track" style="transform:translateX(-${folderPage*100}%)">${pages}</div></div>${button('＋ 新規','new-folder','ku-new-folder')}</div>`;
}
function moveFolderPage(delta,root=document) {
 const viewport=$('.ku-folder-items',root);if(!viewport)return;
 const count=Number(viewport.dataset.pages)||1;
 const next=Math.max(0,Math.min(count-1,folderPage+delta));if(next===folderPage)return;
 folderPage=next;$('.ku-folder-track',viewport).style.transform=`translateX(-${folderPage*100}%)`;
 [...viewport.querySelectorAll('.ku-folder-page')].forEach((p,i)=>{p.setAttribute('aria-hidden',String(i!==folderPage));p.inert=i!==folderPage;p.querySelectorAll('button').forEach(b=>b.tabIndex=i===folderPage?0:-1);});
}
function retainFolders(root,old) {
 const fresh=$('.ku-folders',root);if(!old||!fresh||old.dataset.signature!==folderSignature){if(fresh)fresh.dataset.signature=folderSignature;return;}
 fresh.replaceWith(old);
 const active=[...document.querySelectorAll('#chat-category-tabs>.tab-item:not(.tab-manage)')].findIndex(x=>x.classList.contains('active'));
 for(const page of old.querySelectorAll('.ku-folder-page')){
  const cells=[...page.querySelectorAll('.ku-folder')];let slot=-1;
  cells.forEach((b,i)=>{const selected=Number(b.dataset.ku.split(':')[1])===active;b.classList.toggle('active',selected);if(selected)slot=i;});
  const pill=$('.ku-folder-selection',page);pill.style.opacity=slot<0?'0':'1';if(slot>=0)pill.style.transform=`translateX(${slot*100}%)`;
 }
}
function rootFor(id){const screen=document.getElementById(id);if(!screen)return;let view=$('.ku-view',screen);if(!view){view=document.createElement('section');view.className='ku-view';view.dataset.page=id;view.addEventListener('click',onClick);view.addEventListener('contextmenu',onContext);screen.appendChild(view);}if(!screen.classList.contains('ku-mounted'))screen.classList.add('ku-mounted');return view;}
function openChat(id,type){const c=(type==='group'?groups():people()).find(c=>c.id===id);if(!c)return;currentChatId=id;currentChatType=type||'private';if(typeof updateCustomBubbleStyle==='function')updateCustomBubbleStyle(id,c.customBubbleCss,c.useCustomBubbleCss);openChatRoom(id,currentChatType);}
function renderChats(){const root=rootFor(IDS[0]);if(!root)return;const oldFolders=$('.ku-folders',root),chatScroll=$('.ku-chat-scroll',root)?.scrollTop||0;const tabs=[...document.querySelectorAll('#chat-category-tabs > .tab-item')];const rows=[...document.querySelectorAll('#chat-list-container > .chat-item')];let html=header('トーク','chats');
html+=folderMarkup(tabs);
html+=`<div class="ku-recent">${people().slice(0,4).map(c=>button(avatar(c.avatar)+`<span>${E(nameOf(c))}</span>`,'chat:'+c.id,'ku-person')).join('')}${button(`<span class="ku-add-avatar">${icon('add')}</span><span>追加</span>`,'add','ku-person')}</div><div class="ku-chat-scroll">`;
const sections=[['pin','ピン留め',rows.filter(x=>x.classList.contains('pinned'))],['all','すべてのトーク',rows.filter(x=>!x.classList.contains('pinned'))]];
for(const [key,title,list] of sections){if(!list.length)continue;html+=`<section class="ku-chat-section">${button(`<span>${title} <small>${list.length}</small></span>${icon('down')}`,'collapse:'+key,'ku-section-label'+(collapsed.has(key)?' collapsed':''))}<div class="ku-chat-card" ${collapsed.has(key)?'hidden':''}>${list.map(x=>{const id=x.dataset.id,type=x.dataset.type;return button(avatar($('.chat-avatar',x)?.getAttribute('src'))+`<div class="ku-chat-text"><strong>${E($('.item-name',x)?.textContent)}</strong><p>${E($('.item-preview',x)?.textContent)}</p></div><div class="ku-chat-meta"><time>${E($('.item-time',x)?.textContent)}</time>${$('.unread-badge.visible',x)?`<b>${E($('.unread-badge',x).textContent)}</b>`:''}</div>`,`chat:${id}:${type}`,'ku-chat-row');}).join('')}</div></section>`;}
if(!rows.length)html+='<div class="ku-empty">まだトークがありません。</div>';
root.innerHTML=html+'</div>';retainFolders(root,oldFolders);$('.ku-chat-scroll',root).scrollTop=chatScroll;}
function menuPersona(){const d=typeof db!=='undefined'?db:{};let p=(d.myPersonaPresets||[]).find(p=>p.id===d.activePersonaId)||(d.myPersonaPresets||[])[0];return {name:p?.name||people()[0]?.myName||'User',avatar:p?.avatar||people()[0]?.myAvatar||$('#more-my-avatar')?.getAttribute('src')};}
function menuSettings(){return activeSelfPersona()?.kissMenuCard||db.kissMenuCard||{};}
function renderMenu(){const root=rootFor(IDS[2]);if(!root)return;const p=menuPersona(),d=menuSettings();const tools=[['panel','状态栏','status-bar'],['loops','思维链','cot-settings'],['calendar','日历','calendar'],['star','收藏','star'],['palette','绘图工坊','drawing-workshop']];root.innerHTML=header('メニュー','menu')+`<div class="ku-menu-scroll"><div class="ku-menu-profile">${button(avatar(d.avatar||p.avatar),'menuedit','ku-profile-link')}<div><strong>${E(p.name)} ${check}</strong><p>${E(d.subtitle??'わたしの記録')}</p><p>${E(d.description??'日々を、少しずつ。')}</p></div></div><p class="ku-menu-copy">${E(d.text??'好きなものを集めて、\n何でもない日を、特別に。')}</p><div class="ku-photos" aria-label="日々の風景">${[0,1,2].map(i=>d.images?.[i]?`<img src="${safeURL(d.images[i])}" alt="日々の風景 ${i+1}" loading="lazy">`:`<span class="ku-scene-${i}" role="img" aria-label="日々の風景 ${i+1}"></span>`).join('')}</div><p class="ku-photo-caption">${icon('heart')}${E(d.caption??'何気ない日を、残しておく。')}</p>${button(`${icon('search')}<span>トーク履歴を検索</span>`,'search','ku-search')}<div class="ku-tools">${tools.map(([i,l,a])=>button(`${icon(i)}<span>${l}</span>${icon('arrow','ku-chevron')}`,'tool:'+a,'ku-tool')).join('')}</div><p class="ku-menu-foot">${E(d.footer??'何気ない日々を、大切に。')}</p></div>`;}
function editMenu(){
 const owner=activeSelfPersona()||db,d=menuSettings();
 const fields=[['avatar','本页头像链接（留空使用资料头像）'],['subtitle','名字下第一行'],['description','名字下第二行'],['caption','图片下方文案'],['footer','底部文案']];
 const overlay=openSheet('菜单页展示设置',`<form class="ku-display-form">${fields.map(([key,label])=>`<label>${label}<input name="${key}" value="${E(d[key]??({subtitle:'わたしの記録',description:'日々を、少しずつ。',caption:'何気ない日を、残しておく。',footer:'何気ない日々を、大切に。'}[key]||''))}" maxlength="${key==='avatar'?2000:300}"></label>`).join('')}<label>图片上方正文<textarea name="text" rows="3" maxlength="2000">${E(d.text??'好きなものを集めて、\n何でもない日を、特別に。')}</textarea></label><fieldset class="ku-field-group"><legend>三张图片（留空使用原风景图）</legend>${[0,1,2].map(i=>`<label>图片 ${i+1} 链接<input name="menu_image_${i}" value="${E(d.images?.[i]||'')}" maxlength="2000" inputmode="url"></label>`).join('')}</fieldset><button type="submit">保存</button></form>`);
 $('form',overlay).onsubmit=async e=>{e.preventDefault();const b=$('button[type=submit]',overlay);b.disabled=true;const f=new FormData(e.currentTarget),previous=owner.kissMenuCard,next={...d,images:[0,1,2].map(i=>String(f.get('menu_image_'+i)||'').trim())};for(const key of [...fields.map(x=>x[0]),'text'])next[key]=String(f.get(key)||'').trim();owner.kissMenuCard=next;try{await saveData();closeSheet();renderMenu();}catch{owner.kissMenuCard=previous;b.disabled=false;showToast('保存失败，请重试。');}};
}

// One explicit, transactional cleanup of the old role dynamics; histories stay referenced.
async function clearLegacyDynamics(database=dexieDB,model=db){
 const key='kissFriendsLegacyMomentsClearedV1';if(model[key]?.done)return false;
 const strip=data=>{if(!data||typeof data!=='object')return;if(Object.prototype.hasOwnProperty.call(data,'moments'))data.moments=[];if(Array.isArray(data.kissFriendsSaved))data.kissFriendsSaved=data.kissFriendsSaved.filter(id=>String(id)==='status');};
 const stamp={done:true,version:1,at:Date.now()};let already=false;
 await database.transaction('rw',database.characters,database.globalSettings,database.safeParts,async()=>{
  if((await database.globalSettings.get(key))?.value?.done){already=true;return;}
  const visited=new Set();
  for(const c of model.characters||[]){const row=await database.characters.get(c.id);if(!row)continue;strip(row);
   for(const a of row.archives||[]){const ref=a.data?.__phoneArchive;if(ref){if(visited.has(ref))continue;visited.add(ref);const block=await database.safeParts.get(ref);if(!block)throw Error('角色存档数据缺失，旧动态清理未执行。');strip(block.value);await database.safeParts.put(block);}else strip(a.data);}
   await database.characters.put(row);
  }
  await database.globalSettings.put({key,value:stamp});
 });
 if(!already){for(const c of model.characters||[]){strip(c);for(const a of c.archives||[])if(!a.data?.__phoneArchive)strip(a.data);}}model[key]=already?{done:true,version:1}:stamp;return !already;
}
function timestamp(value){if(value===undefined||value===null||value==='')return 0;const n=Number(value);if(Number.isFinite(n))return n>0?n:0;const d=Date.parse(value);return Number.isFinite(d)?d:0;}
function statusHistoryTime(c){
 const status=String(c.status||'').trim(),name=String(c.realName||'');
 if(!name||!status)return 0;
 const history=Array.isArray(c.history)?c.history:[];
 for(let i=history.length-1;i>=0;i--){const m=history[i];if(m.isWithdrawn||typeof m.content!=='string')continue;for(const match of m.content.matchAll(/\[([^\]]*?)更新状态为[：:]([\s\S]*?)\]/g)){if(match[1]===name&&match[2].trim()===status)return timestamp(m.timestamp);}}
 return 0;
}
function statusTime(c){const stored=!c.kissStatusStampedValue||c.kissStatusStampedValue===String(c.status||'')?timestamp(c.statusUpdatedAt||c.statusTimestamp):0;return Math.max(stored,statusHistoryTime(c));}
function latestChatTime(c){const history=Array.isArray(c.history)?c.history:[];let latest=0;for(let i=history.length-1;i>=0;i--){const m=history[i];if(m.isWithdrawn||!['assistant','user'].includes(m.role))continue;const text=typeof m.content==='string'?m.content:'';if(/^\[(?:system|system-display):/.test(text))continue;latest=timestamp(m.timestamp);if(latest)break;}return Math.max(latest,timestamp(c.lastMessageTimestamp||c.lastChatTime||c.lastMessageAt));}
function friendEntries(){
 const settings=db.kissFriendsSort||{},order=new Map((Array.isArray(settings.order)?settings.order:[]).map((id,i)=>[String(id),i]));
 return people().map((c,index)=>({c,index,status:true,latestChat:latestChatTime(c),m:{id:'status',content:String(c.status||'').trim()||'ステータス未設定',timestamp:statusTime(c),likes:c.kissStatusLikes||[],comments:c.kissStatusComments||[]}})).sort((a,b)=>{
  if(settings.mode==='custom')return (order.get(String(a.c.id))??(order.size+a.index))-(order.get(String(b.c.id))??(order.size+b.index));
  if(settings.mode==='status')return timestamp(b.m.timestamp)-timestamp(a.m.timestamp)||b.latestChat-a.latestChat||a.index-b.index;
  return b.latestChat-a.latestChat||a.index-b.index;
 });
}
function editFriendSort(){
 const settings=db.kissFriendsSort||{},byId=new Map(people().map(c=>[String(c.id),c]));
 const order=[...(Array.isArray(settings.order)?settings.order:[]).map(String).filter(id=>byId.has(id))];for(const c of people())if(!order.includes(String(c.id)))order.push(String(c.id));
 const overlay=openSheet('好友页排序',`<form class="ku-display-form"><label>排列方式<select name="sort"><option value="chat">最近聊天优先</option><option value="status">最近更新状态优先</option><option value="custom">自定义顺序</option></select></label><div data-custom-order><p class="ku-sort-help">点击上移、下移调整顺序；新角色默认补在末尾。</p><div class="ku-sort-list"></div></div><button type="submit">保存</button></form>`);
 const select=$('[name=sort]',overlay);select.value=['chat','status','custom'].includes(settings.mode)?settings.mode:'chat';
 const draw=()=>{$('[data-custom-order]',overlay).hidden=select.value!=='custom';$('.ku-sort-list',overlay).innerHTML=order.map((id,i)=>`<div class="ku-sort-row">${avatar(byId.get(id).avatar)}<span>${E(nameOf(byId.get(id)))}</span><button type="button" data-move="${i}" data-step="-1" ${i===0?'disabled':''} aria-label="上移${E(nameOf(byId.get(id)))}">上移</button><button type="button" data-move="${i}" data-step="1" ${i===order.length-1?'disabled':''} aria-label="下移${E(nameOf(byId.get(id)))}">下移</button></div>`).join('');};draw();select.onchange=draw;
 $('.ku-sort-list',overlay).onclick=e=>{const b=e.target.closest('[data-move]');if(!b)return;const i=Number(b.dataset.move),j=i+Number(b.dataset.step);if(j<0||j>=order.length)return;[order[i],order[j]]=[order[j],order[i]];draw();};
 $('form',overlay).onsubmit=async e=>{e.preventDefault();const b=$('button[type=submit]',overlay);b.disabled=true;const previous=db.kissFriendsSort;db.kissFriendsSort={mode:select.value,order:[...order]};try{await saveData();closeSheet();renderFriends();}catch{db.kissFriendsSort=previous;b.disabled=false;showToast('保存失败，请重试。');}};
}
function editFriendStatus(c){
 const overlay=openSheet('修改当前状态',`<form class="ku-display-form"><label>当前聊天状态<textarea name="status" rows="3" maxlength="2000">${E(c.status||'')}</textarea></label><button type="submit">保存</button></form>`);
 $('form',overlay).onsubmit=async e=>{e.preventDefault();const text=String(new FormData(e.currentTarget).get('status')||'').trim();if(!text){showToast('请输入状态内容。');return;}const b=$('button[type=submit]',overlay);b.disabled=true;const before={status:c.status,statusUpdatedAt:c.statusUpdatedAt,kissStatusStampedValue:c.kissStatusStampedValue};c.status=text;c.statusUpdatedAt=Date.now();c.kissStatusStampedValue=text;try{await saveData();closeSheet();renderContactList();renderFriends();if(typeof currentChatId!=='undefined'&&currentChatId===c.id){const el=document.getElementById('chat-room-status-text');if(el)el.textContent=text;}}catch{Object.assign(c,before);b.disabled=false;showToast('保存失败，请重试。');}};
}

function details(id,mid) {currentChatId=id;currentChatType='private';renderMomentsScreen();switchScreen('moments-screen');if(mid)requestAnimationFrame(()=>[...document.querySelectorAll('#moments-feed-container .moment-item')].find(x=>x.dataset.id===mid)?.scrollIntoView({block:'start'}));}
function postKey(c,m){return c.id+':'+m.id;}
function metaFor(c,m) {
 const display=c.kissFriendsDisplay||{};
 return {handle:m.handle||c.handle||c.username||display.handle||'',device:m.device||m.sourceDevice||display.device||'',location:m.location||display.location||''};
}
const CARD_LAYOUTS=[['auto','自动'],['text','标准正文'],['music','音乐'],['quote','引用'],['thread','回复串'],['photo','图文'],['note','便笺']];
const COUNT_FIELDS=[['comments','评论数'],['reposts','转发数'],['likes','点赞数'],['views','浏览数']];
function musicFor(m){const v=m.music||m.song||m.sharedMusic;return v&&typeof v==='object'?v:null;}
function musicFromConfig(d,cover){return d?.music?.enabled===false?null:{...(d?.music||{}),title:d?.music?.title||'',artist:d?.music?.artist||'',cover:d?.music?.cover||cover||'',url:d?.music?.url||'',empty:!d?.music?.title};}
function countLabel(d,key,actual){const value=String(d?.counts?.[key]??'').trim();if(/^\d+(?:\.\d+)?(?:[kKmMwW]|万)?$/.test(value))return E(value);const n=Number(actual)||0;return n>=1000?(n/1000).toFixed(1).replace(/\.0$/,'')+'k':String(n);}
function cardLayout(entry,index){
 if(entry.self)return 'text';const {c,m}=entry,d=c.kissFriendsDisplay||{};
 if(CARD_LAYOUTS.some(([id])=>id===d.layout)&&d.layout!=='auto')return d.layout==='music'&&d.music?.enabled===false?'text':d.layout;
 if(d.music?.enabled!==false&&(musicFor(m)||d.music?.title))return 'music';
 if(m.images?.length||d.images?.some(Boolean)||d.image)return 'photo';if(m.comments?.length>1)return 'thread';if(m.quote||m.quotedContent)return 'quote';
 // An ordered rhythm, unchanged by repeated renders; every style shares one type and color system.
 const auto=['music','quote','thread','photo','note','text'][(Math.max(1,index)-1)%6];
 return auto==='music'&&d.music?.enabled===false?'text':auto;
}
function renderMusic(m,key){const song=musicFor(m);if(!song)return '';
 const cover=song.cover||song.picUrl||song.albumCover;
 const playable=/^https?:|^blob:/i.test(song.url||song.audioUrl||song.src||'');
 const playing=playingAudio?.dataset.key===key&&!playingAudio.paused;
 return `<div class="ku-music${playing?' is-playing':''}">${cover?`<img src="${safeURL(cover)}" alt="" loading="lazy">`:`<span class="ku-music-disc">♪</span>`}<div><strong>${E(song.title||song.name||'今日の一曲')}</strong><small>${E(song.artist||song.singer||(song.empty?'音楽を選ぶ':''))}</small></div><svg class="ku-wave" viewBox="0 0 65 30" aria-hidden="true"><path d="M3 12v6m5-12v18m5-21v24m5-18v12m5-15v18m5-24v30m5-25v20m5-17v14m5-20v26m5-20v14m5-11v8m5-7v6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>${button(playing?'<span class="ku-pause">Ⅱ</span>':icon('play'),(playable?'audio:':'musicedit:')+key,'ku-play')}</div>`;
}
function extraDisplayFields(d,own=false){
 const attr=(key)=>own?`data-own-field="${key}"`:`name="${key}"`;
 return `<fieldset class="ku-field-group"><legend>音乐设置</legend><label class="ku-checkbox-row"><input type="checkbox" ${attr('music_enabled')} ${d.music?.enabled!==false?'checked':''}>显示音乐栏</label>${[['title','歌名'],['artist','歌手'],['cover','封面图片链接'],['url','可播放的音频直链']].map(([key,label])=>`<label>${label}<input ${attr('music_'+key)} value="${E(d.music?.[key]||'')}" maxlength="${['url','cover'].includes(key)?2000:150}" ${['url','cover'].includes(key)?'inputmode="url"':''}></label>`).join('')}</fieldset><fieldset class="ku-field-group"><legend>自定义显示数字</legend>${COUNT_FIELDS.map(([key,label])=>`<label>${label}<input ${attr('count_'+key)} value="${E(d.counts?.[key]??'')}" maxlength="16" placeholder="留空显示实际数量 / 128 / 2.1k"></label>`).join('')}</fieldset>${own?'':`<label>卡片样式<select name="layout">${CARD_LAYOUTS.map(([id,label])=>`<option value="${id}" ${(d.layout||'auto')===id?'selected':''}>${label}</option>`).join('')}</select></label>${photoFields(d)}<label>卡片补充文字<input name="caption" value="${E(d.caption||'')}" maxlength="300"></label>`}`;
}
function photoFields(d){const n=Math.max(1,Math.min(4,Number(d.imageCount)||(d.images?.length)||3));return `<fieldset class="ku-field-group"><legend>图文配图</legend><label>图片数量<select name="imageCount">${[1,2,3,4].map(i=>`<option value="${i}" ${i===n?'selected':''}>${i} 张</option>`).join('')}</select></label><div data-image-fields>${Array.from({length:n},(_,i)=>`<label>图片 ${i+1} 链接<input name="image_${i}" value="${E(d.images?.[i]||(i===0?d.image:'')||'')}" maxlength="2000" inputmode="url"></label>`).join('')}</div></fieldset>`;}
function updateDisplayValue(d,key,value){
 if(key.startsWith('image_')){d.images=[...(d.images||[])];d.images[Number(key.slice(6))]=String(value).trim();}
 else if(key==='imageCount')d.imageCount=Number(value);
 else if(key.startsWith('music_')){d.music={...(d.music||{}),[key.slice(6)]:value};}
 else if(key.startsWith('count_')){d.counts={...(d.counts||{}),[key.slice(6)]:String(value).trim()};}
 else d[key]=value;
}
function stopMusic(){if(playingAudio){playingAudio.pause();playingAudio=null;}for(const row of document.querySelectorAll('.ku-music.is-playing')){row.classList.remove('is-playing');const b=row.querySelector('.ku-play');if(b){b.innerHTML=icon('play');b.setAttribute('aria-label','再生');}}}
function swipeComment(content,action,cls=''){return `<div class="ku-comment-swipe ${cls}">${button('删除',action,'ku-comment-delete')}<div class="ku-comment-track">${content}</div></div>`;}
function commentMarkup(c,x,thread=false,key=''){const a=people().find(p=>[p.realName,p.remarkName].includes(x.author));const content=`<div class="ku-comment">${avatar(a?.avatar||c.myAvatar)}<div><strong>${E(x.author)} ${check}</strong><span>${x.replyTo?E(x.replyTo)+'への返信 · ':''}${E(x.content)}</span>${thread?`<time>${E(when(x.timestamp))}</time>`:''}</div>${!thread&&x.timestamp?`<time>${E(when(x.timestamp))}</time>`:''}${typeof x.likes==='number'?`<span class="ku-reply-likes">${icon('heart')}${x.likes}</span>`:''}</div>`;if(!key)return content;const token='c'+(++commentSeq);commentRefs.set(token,{key,comment:x});return swipeComment(content,'delete-comment:'+token);}
async function deleteComment(token,b){const ref=commentRefs.get(token),entry=ref&&postData.get(ref.key);if(!entry)return;const c=entry.c,prior=c.kissStatusComments||[];let index=prior.indexOf(ref.comment);if(index<0&&ref.comment.id)index=prior.findIndex(x=>x.id===ref.comment.id);if(index<0)return;const next=[...prior];next.splice(index,1);b.disabled=true;c.kissStatusComments=next;try{await saveData();closeSheet();renderFriends();}catch{c.kissStatusComments=prior;b.disabled=false;renderFriends();const list=$('.ku-sheet-comments');if(list)list.innerHTML=prior.map(x=>commentMarkup(c,x,true,ref.key)).join('');showToast('删除失败，评论已恢复，请重试。');}}
async function deleteOwnNote(key,b){const entry=postData.get(key),owner=entry?.owner;if(!owner)return;const prior=owner.kissFriendsCard;owner.kissFriendsCard={...(prior||{}),note:''};b.disabled=true;try{await saveData();renderFriends();}catch{owner.kissFriendsCard=prior;b.disabled=false;showToast('删除失败，留言已恢复，请重试。');}}

function postMarkup(entry,index) {
 const {c,status,self=false}=entry,key=postKey(c,entry.m),d=self?(entry.owner?.kissFriendsCard||{}):(c.kissFriendsDisplay||{});
 const layout=cardLayout(entry,index),configured=musicFromConfig(d,c.avatar);
 const m={...entry.m};
 if(d.music?.enabled===false){delete m.music;delete m.song;delete m.sharedMusic;}
 else if((d.music?.title||d.music?.url)&&configured)m.music=configured;
 if(!musicFor(m)&&(layout==='music'||self)&&configured)m.music=configured;
 entry.renderedMusic=musicFor(m);postData.set(key,entry);
 const meta=metaFor(c,m),comments=Array.isArray(m.comments)?m.comments:[],likes=Array.isArray(m.likes)?m.likes:[];
 const thread=!self&&(layout==='music'||layout==='thread'),quote=!self&&layout==='quote';
 const saved=(c.kissFriendsSaved||[]).includes(String(m.id));
 const stamp=m.timestamp?when(m.timestamp):(status&&!self?'ステータス':when(selfViewedAt).slice(0,5)+' · ひとこと');
 const ownNote=self?(d.note??'何気ない日々を、大切に。'):'';
 const text=String(m.content||''),title=String(m.author||nameOf(c));
 const handle=meta.handle||nameOf(c).replace(/\s+/g,'');
 const source=status&&!self?'<span> · </span><span class="ku-blue">いまのひとこと</span>':`<span> · </span><span class="ku-blue">${E(meta.device||'Kiss')}</span><span>から</span>`;
 const place=status&&!self?(meta.location?icon('pin')+`<span>${E(meta.location)}</span>`:''):icon('pin')+`<span>${meta.location?E(meta.location)+' · ':''}友だちに公開</span>`;
 const displayTranslation=translatedPosts.has(key);
 const translationValue=status&&!self?(d.statusTranslation||c.statusTranslation||''):(d.translation||m.translation||m.translatedContent||'');
 const textHTML=(displayTranslation?String(translationValue||text):text)?E(displayTranslation?String(translationValue||text):text).split(/\n{2,}/).map(p=>`<span class="ku-paragraph">${p}</span>`).join(''):'<span class="ku-unwritten">まだ投稿がありません。</span>';
 const views=Number(m.views||m.viewCount)||0,reposts=Array.isArray(m.reposts)?m.reposts.length:Number(m.repostCount)||0;
 const actualPictures=Array.isArray(m.images)?m.images.map(x=>typeof x==='string'?x:x.url):[];
 const configuredPictures=d.images?.some(Boolean)?d.images:d.image?[d.image]:null;
 const pictures=layout==='photo'?(configuredPictures||actualPictures.length&&actualPictures||[]):actualPictures;
 const imageCount=layout==='photo'?Math.max(1,Math.min(4,Number(d.imageCount)||pictures.length||3)):Math.min(4,pictures.length);
 const imageHTML=imageCount?`<div class="ku-post-images" data-image-count="${imageCount}">${Array.from({length:imageCount},(_,i)=>{const src=pictures[i];return src?`<img src="${safeURL(src)}" alt="投稿の写真 ${i+1}" loading="lazy">`:`<span class="ku-image-placeholder" aria-label="未设置图片">${icon('panel')}</span>`;}).join('')}</div>`:'';
 const replyPrompt=thread&&!comments.length?`<div class="ku-thread-comments ku-reply-prompt">${avatar(c.myAvatar)}${button('言葉を残す…','comment:'+key)}</div>`:'';
 return `<article class="ku-post ku-layout-${layout}${self?' ku-own-post':''}${thread?' ku-thread-post':''}${quote?' ku-quote-post':''}" data-post="${E(key)}"><div class="ku-post-top">${button(avatar(c.avatar),self?'self':'profile:'+c.id,'ku-post-avatar')}<div class="ku-byline"><div class="ku-name-line"><strong>${E(title)} ${check}</strong><span class="ku-handle">@${E(String(handle).replace(/^@/,''))}</span></div><div class="ku-post-meta"><time>${E(stamp)}</time>${source}</div><div class="ku-post-place">${place}</div></div>${button('···',self?'self':'postmenu:'+key,'ku-dots')}</div><div class="ku-post-body"><div class="ku-content-layout">${imageHTML}<div class="ku-content-copy"><p class="ku-post-text">${textHTML}</p>${d.caption?`<p class="ku-card-caption">${E(d.caption)}</p>`:''}</div></div>${m.imageDescription?`<p class="ku-image-description">${E(m.imageDescription)}</p>`:''}${text?button(displayTranslation?'原文を表示':'翻訳を表示','translation:'+key,'ku-text-link'):''}${renderMusic(m,key)}<div class="ku-post-actions">${button(icon('comment')+`<span>${countLabel(d,'comments',comments.length)}</span>`,'comment:'+key)}${button(icon('repeat')+`<span>${countLabel(d,'reposts',reposts)}</span>`,'share:'+key)}${button(icon('heart')+`<span>${countLabel(d,'likes',likes.length)}</span>`,'like:'+key,likes.includes(c.myName||'我')?'is-liked':'')}<span class="ku-views" aria-label="閲覧数">${icon('views')}<span>${countLabel(d,'views',views)}</span></span>${button(icon('book'),'bookmark:'+key,saved?'is-saved':'')}</div></div>${self&&ownNote?swipeComment(`<div class="ku-own-note ku-comments">${avatar(c.avatar)}<strong>${E(c.realName)} ${check}</strong><span>${E(ownNote)}</span><time>${E(when(m.timestamp))}</time></div>`,'delete-note:'+key,'ku-own-note-swipe'):''}${comments.length?`<div class="${thread?'ku-thread-comments':'ku-comments'}">${comments.slice(0,thread?3:1).map(x=>commentMarkup(c,x,thread,key)).join('')}</div>`:replyPrompt}</article>`;
}
function activeSelfPersona(){
 const d=typeof db==='undefined'?{}:db;
 return (d.myPersonaPresets||[]).find(p=>p.id===d.activePersonaId)||(d.myPersonaPresets||[])[0]||null;
}
function ownCardDevice(){const ua=navigator.userAgent||'';return /iPhone|iPad/i.test(ua)?(/iPad/i.test(ua)?'iPad':'iPhone'):/Android/i.test(ua)?'Android':/Macintosh/i.test(ua)?'Mac':'Web';}
function selfProfileCard(){
 const profile=activeSelfPersona(),p=menuPersona(),stored=profile?.kissFriendsCard||{};
 const card=()=>profile?.kissFriendsCard||stored;
 const c={id:'self_'+(profile?.id||'default'),avatar:p.avatar,realName:p.name,remarkName:p.name,myName:p.name,myAvatar:p.avatar,handle:stored.handle||profile?.handle||'my.days',kissFriendsDisplay:{device:stored.device||ownCardDevice(),location:stored.location||''}};
 for(const [key,property] of [['kissStatusLikes','likes'],['kissStatusComments','comments'],['kissFriendsSaved','saved']])Object.defineProperty(c,key,{get:()=>card()[property]||[],set:v=>{if(profile){if(!profile.kissFriendsCard)profile.kissFriendsCard={};profile.kissFriendsCard[property]=v;}else stored[property]=v;}});
 const m={id:'profile',author:p.name,content:typeof stored.text==='string'?stored.text:DEFAULT_SELF_TEXT,timestamp:stored.updatedAt||selfViewedAt,device:stored.device||ownCardDevice(),location:stored.location||'',translation:stored.translation||(typeof stored.text==='string'?'':DEFAULT_SELF_TRANSLATION),likes:c.kissStatusLikes,comments:c.kissStatusComments};
 const entry={c,m,status:true,self:true,owner:profile};
 return postMarkup(entry,0);
}
function openSelfProfile(){
 const target=activeSelfPersona()?.id;
 setupMyProfileScreen();switchScreen('my-profile-screen');
 setTimeout(()=>{
  if(!document.getElementById('my-profile-screen')?.classList.contains('active'))return;
  const index=(db.myPersonaPresets||[]).findIndex(p=>p.id===target);
  if(index<0)return;currentPersonaIndex=index;
  document.querySelectorAll('#mp-carousel .mp-carousel-item')[index]?.scrollIntoView({inline:'center',block:'nearest',behavior:'auto'});
  updatePersonaInfoArea(index);
 },70);
}
function renderSelfCardEditor(index){
 if(externalCss())return;
 const p=db.myPersonaPresets?.[index];if(!p)return;
 let editor=document.getElementById('ku-profile-card-editor');
 if(!editor){
  const input=document.getElementById('mp-persona-input');if(!input)return;
  editor=document.createElement('details');editor.id='ku-profile-card-editor';editor.className='ku-profile-card-editor';
  input.closest('.mp-input-group').insertAdjacentElement('afterend',editor);
 }
 const d=p.kissFriendsCard||{};
 editor.innerHTML=`<summary>好友页展示卡片</summary><div class="ku-profile-card-fields"><label>显示账号<input data-own-field="handle" value="${E(d.handle||p.handle||'my.days')}" maxlength="80"></label><label>设备型号<input data-own-field="device" value="${E(d.device||ownCardDevice())}" maxlength="80"></label><label>发布地点<input data-own-field="location" value="${E(d.location||'')}" maxlength="80"></label><label>卡片正文<textarea data-own-field="text" rows="5" maxlength="5000">${E(typeof d.text==='string'?d.text:DEFAULT_SELF_TEXT)}</textarea></label><label>翻译内容<textarea data-own-field="translation" rows="3" maxlength="5000">${E(d.translation||(typeof d.text==='string'?'':DEFAULT_SELF_TRANSLATION))}</textarea></label><label>底部留言<input data-own-field="note" value="${E(d.note??'何気ない日々を、大切に。')}" maxlength="200"></label>${extraDisplayFields(d,true)}</div>`;
 editor.oninput=e=>{const key=e.target.dataset.ownField;if(!key)return;if(!p.kissFriendsCard)p.kissFriendsCard={};updateDisplayValue(p.kissFriendsCard,key,e.target.type==='checkbox'?e.target.checked:e.target.value);p.kissFriendsCard.updatedAt=Date.now();};
}
function renderFriends(){
 const root=rootFor(IDS[1]);if(!root)return;
 const scroll=$('.ku-friend-scroll',root)?.scrollTop||0;
 let feed=friendEntries();if(currentTab==='favorites')feed=feed.filter(({c})=>(c.kissFriendsSaved||[]).includes('status')||c.isPinned);
 postData.clear();commentRefs.clear();
 root.innerHTML=header('ともだち','friends')+`<div class="ku-friend-tabs">${[['all','すべて'],['friends','友だち'],['favorites','お気に入り']].map(([id,t])=>button(t,'tab:'+id,currentTab===id?'active':'')).join('')}${button('並び替え'+icon('down'),'friend-sort','ku-friend-sort')}</div><div class="ku-friend-scroll">${selfProfileCard()}${feed.slice(0,feedLimit).map((entry,index)=>postMarkup(entry,index+1)).join('')||'<p class="ku-empty">友だちがいません。</p>'}${feed.length>feedLimit?button('もっと見る','more-feed','ku-load-more'):''}</div>`;
 $('.ku-friend-scroll',root).scrollTop=scroll;
}
function openSheet(title,html){
 closeSheet();const overlay=document.createElement('div');overlay.className='ku-sheet-overlay';
 overlay.innerHTML=`<section class="ku-sheet" role="dialog" aria-modal="true" aria-label="${E(title)}"><header><strong>${E(title)}</strong><button type="button" data-close aria-label="关闭">×</button></header>${html}</section>`;
 const focus=document.activeElement;overlay._previousFocus=focus;document.body.appendChild(overlay);
 overlay.addEventListener('click',e=>{if(e.target.closest('[data-ku]'))onClick(e);if(e.target===overlay||e.target.closest('[data-close]'))closeSheet();});
 overlay.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet();if(e.key==='Tab'){const nodes=[...overlay.querySelectorAll('button,input,textarea,select')].filter(x=>!x.disabled);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 overlay.querySelector('button')?.focus();return overlay;
}
function closeSheet(){const el=$('.ku-sheet-overlay');if(el){el._previousFocus?.focus();el.remove();}}
function editDisplay(c){
 const d=c.kissFriendsDisplay||{};
 const existingImages=[];const imageDraft={...d,images:[...(d.images||existingImages.map(x=>typeof x==='string'?x:x.url))],imageCount:d.imageCount||d.images?.length||existingImages.length||3};
 const overlay=openSheet('卡片显示设置',`<form class="ku-display-form"><label>显示账号<input name="handle" maxlength="80" value="${E(d.handle||c.handle||c.username||'')}" placeholder="@name"></label><label>设备型号<input name="device" maxlength="80" value="${E(d.device||'')}" placeholder="iPhone 17 Pro"></label><label>发布地点<input name="location" maxlength="80" value="${E(d.location||'')}" placeholder="Tokyo"></label>${extraDisplayFields(imageDraft)}<label>当前状态译文<textarea name="statusTranslation" rows="3" maxlength="5000">${E(d.statusTranslation||'')}</textarea></label><button type="submit">保存</button></form>`);
 const photoSelect=$('[name=imageCount]',overlay);photoSelect.onchange=()=>{for(const input of overlay.querySelectorAll('[name^=image_]'))updateDisplayValue(imageDraft,input.name,input.value);imageDraft.imageCount=Number(photoSelect.value);$('[data-image-fields]',overlay).innerHTML=new DOMParser().parseFromString(photoFields(imageDraft),'text/html').querySelector('[data-image-fields]').innerHTML;};
 $('form',overlay).addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,b=$('button[type=submit]',f);b.disabled=true;const previous=c.kissFriendsDisplay;const values=new FormData(f);const next={...d,images:[...imageDraft.images],music:{...(d.music||{})},counts:{...(d.counts||{})}};
 for(const [key,value] of values)updateDisplayValue(next,key,String(value).trim());next.music.enabled=f.elements.music_enabled.checked;next.images=next.images.slice(0,next.imageCount);delete next.image;
 next.updatedAt=Date.now();c.kissFriendsDisplay=next;
 try{await saveData();closeSheet();renderFriends();}catch{c.kissFriendsDisplay=previous;b.disabled=false;showToast('保存失败，请重试。');}});
}
function postMenu(entry){const {c,m,status}=entry;const sheet=openSheet(nameOf(c),`<div class="ku-sheet-menu"><button type="button" data-profile>查看资料</button><button type="button" data-chat>打开聊天</button><button type="button" data-display>编辑卡片显示</button>${status?'<button type="button" data-edit-status>修改当前状态</button>':''}${status?'':'<button type="button" data-post>查看动态</button>'}</div>`);
 $('[data-profile]',sheet).onclick=()=>{closeSheet();openProfileCard(c.id);};$('[data-chat]',sheet).onclick=()=>{closeSheet();openChat(c.id,'private');};$('[data-display]',sheet).onclick=()=>editDisplay(c);if(status)$('[data-edit-status]',sheet).onclick=()=>editFriendStatus(c);if(!status)$('[data-post]',sheet).onclick=()=>{closeSheet();details(c.id,m.id);};
}
function statusComments(entry){const {c,m}=entry;const overlay=openSheet('评论',`<div class="ku-sheet-comments">${(c.kissStatusComments||[]).map(x=>commentMarkup(c,x,true,postKey(c,m))).join('')||'<p class="ku-muted">还没有评论。</p>'}</div><form class="ku-comment-form"><textarea name="text" rows="2" maxlength="2000" aria-label="评论内容" placeholder="写下评论…" required></textarea><button type="submit">发送</button></form>`);
 $('form',overlay).addEventListener('submit',async e=>{e.preventDefault();const text=String(new FormData(e.currentTarget).get('text')).trim();if(!text)return;const old=c.kissStatusComments||[];c.kissStatusComments=[...old,{id:'reply_'+Date.now(),author:c.myName||menuPersona().name,content:text,timestamp:Date.now()}];const btn=$('button[type=submit]',overlay);btn.disabled=true;try{await saveData();closeSheet();renderFriends();}catch{c.kissStatusComments=old;btn.disabled=false;showToast('保存失败，请重试。');}});
}
async function postAction(action,entry,b){
 if(!entry)return;const {c,m,status}=entry;
 if(action==='musicedit'){if(entry.self){openSelfProfile();setTimeout(()=>{if(!document.getElementById('my-profile-screen')?.classList.contains('active'))return;const editor=document.getElementById('ku-profile-card-editor');if(editor){editor.open=true;editor.querySelector('[data-own-field=music_title]')?.focus();}},100);}else editDisplay(c);return;}
 if(action==='postmenu')return postMenu(entry);
 if(action==='comment')return status?statusComments(entry):details(c.id,m.id);
 if(action==='bookmark'){const old=c.kissFriendsSaved||[],id=String(m.id);c.kissFriendsSaved=old.includes(id)?old.filter(x=>x!==id):[...old,id];try{await saveData();renderFriends();}catch{c.kissFriendsSaved=old;showToast('保存失败，请重试。');}return;}
 if(action==='like'){
  if(!status){currentChatId=c.id;currentChatType='private';try{await toggleMomentLike(m.id);renderFriends();}catch{showToast('保存失败，请重试。');}return;}
  const name=c.myName||'我',old=c.kissStatusLikes||[];c.kissStatusLikes=old.includes(name)?old.filter(x=>x!==name):[...old,name];try{await saveData();renderFriends();}catch{c.kissStatusLikes=old;showToast('保存失败，请重试。');}return;
 }
 if(action==='share'){try{await navigator.clipboard.writeText(String(m.content||''));showToast('已复制动态内容。');}catch{showToast('复制失败，请重试。');}return;}
 if(action==='audio'){
  const song=entry.renderedMusic||musicFor(m),url=song?.url||song?.audioUrl||song?.src;
  if(!/^https?:|^blob:/i.test(url||'')){showToast('请先设置可播放的音频直链。');return;}
  const same=playingAudio?.dataset.key===postKey(c,m)&&!playingAudio.paused;stopMusic();if(same)return;
  const audio=new Audio(url);playingAudio=audio;audio.dataset.key=postKey(c,m);audio.onended=()=>{if(playingAudio===audio)stopMusic();};
  try{await audio.play();if(playingAudio!==audio){audio.pause();return;}b.innerHTML='<span class="ku-pause">Ⅱ</span>';b.setAttribute('aria-label','一時停止');b.closest('.ku-music')?.classList.add('is-playing');}catch{if(playingAudio===audio){stopMusic();showToast('播放失败，请检查音频链接是否可以直接播放。');}}return;
 }
}
function editFolderButton(b){
 const index=Number(b?.dataset.ku?.split(':')[1]);
 if(!Number.isInteger(index)||index<1)return false;
 const folder=db.chatFolders?.[index-1];if(!folder||typeof window.openEditFolderModal!=='function')return false;
 window.openEditFolderModal(folder.id);return true;
}
function onContext(e){const folder=e.target.closest('.ku-folder');if(folder){e.preventDefault();editFolderButton(folder);return;}const row=e.target.closest('[data-ku^="chat:"]');if(!row)return;e.preventDefault();const [,id,type='private']=row.dataset.ku.split(':');handleChatListLongPress(id,type,e.clientX,e.clientY);}

function onClick(e){const b=e.target.closest('[data-ku]');if(!b)return;const [action,id,extra]=b.dataset.ku.split(':');
if(['postmenu','comment','bookmark','share','like','audio','musicedit'].includes(action)){postAction(action,postData.get(id+':'+extra),b);return;}
if(action==='delete-comment'){deleteComment(id,b);return;}
if(action==='delete-note'){deleteOwnNote(id+':'+extra,b);return;}
if(action==='friend-sort'){editFriendSort();return;}
if(action==='menuedit'){editMenu();return;}
if(action==='self'){openSelfProfile();return;}
if(action==='customize'){renderCustomizeForm();switchScreen('customize-screen');return;}
if(action==='home')switchScreen('home-screen');
else if(action==='add')$('#add-chat-btn-kkt')?.click();
else if(action==='group')$('#create-group-btn-kkt')?.click();
else if(action==='settings')$('#import-btn-kkt')?.click();
else if(action==='new-folder')window.openCreateFolderModal?.();
else if(action==='folder'){if(Date.now()<folderBusyUntil)return;const tabs=[...document.querySelectorAll('#chat-category-tabs>.tab-item:not(.tab-manage)')];tabs[Number(id)]?.click();}
else if(action==='collapse'){collapsed.has(id)?collapsed.delete(id):collapsed.add(id);renderChats();}
else if(action==='chat')openChat(id,extra||'private');
else if(action==='profile'){if(id)openProfileCard(id);else{setupMyProfileScreen();switchScreen('my-profile-screen');}}
else if(action==='search')window.SearchSystem?.open();
else if(action==='tool')document.querySelector(`.menu-grid .menu-item[data-action="${id}"]`)?.click();
else if(action==='tab'){currentTab=id;feedLimit=40;renderFriends();}
else if(action==='more-feed'){feedLimit+=40;renderFriends();}
else if(action==='details')details(id,extra);
else if(action==='translation'){const key=id+':'+extra,entry=postData.get(key);if(!entry)return;const d=entry.self?entry.owner?.kissFriendsCard:entry.c.kissFriendsDisplay;const translation=entry.status&&!entry.self?(d?.statusTranslation||entry.c.statusTranslation):(d?.translation||entry.m.translation||entry.m.translatedContent);if(!translation){showToast('尚未设置翻译内容，可在卡片显示设置中填写。');return;}translatedPosts.has(key)?translatedPosts.delete(key):translatedPosts.add(key);renderFriends();}
}
function restore(){stopMusic();document.querySelectorAll('.ku-nav-icon').forEach(x=>x.remove());document.querySelectorAll('.ku-custom-nav').forEach(x=>x.classList.remove('ku-custom-nav'));document.getElementById('ku-profile-card-editor')?.remove();document.documentElement.classList.remove('ku-mode','ku-nav-active');for(const id of IDS){const screen=document.getElementById(id);if(screen?.classList.contains('ku-mounted'))screen.classList.remove('ku-mounted');$('.ku-view',screen||document)?.remove();}closeSheet();}
function sync(){frame=0;if(externalCss()){restore();return;}document.documentElement.classList.add('ku-mode');const active=IDS.find(id=>document.getElementById(id)?.classList.contains('active'));document.documentElement.classList.toggle('ku-nav-active',!!active);if(active!==IDS[1]&&playingAudio)stopMusic();if(!active)return;try{if(active===IDS[0])renderChats();else if(active===IDS[1])renderFriends();else renderMenu();}catch(error){console.error('[KISS pages]',error);restore();}}
function schedule(){if(!frame)frame=requestAnimationFrame(sync);}
// Wrap renderers only; never reparent, replace or rename legacy elements.
for(const key of ['renderChatList','renderChatFolders','renderContactList','renderMyProfile','renderMoreScreen','applyGlobalCss']){const old=window[key];if(typeof old!=='function')continue;window[key]=function(...args){const r=old.apply(this,args);if(key==='applyGlobalCss'&&externalCss())restore();schedule();return r;};}
const screenObserver=new MutationObserver(schedule);for(const id of [...IDS,'phone-screen','chat-room-screen']){const el=document.getElementById(id);if(el)screenObserver.observe(el,{attributes:true,attributeFilter:['class']});}
const styleObserver=new MutationObserver(mutations=>{if(mutations.some(m=>m.target.id==='global-css-style'||m.target.parentElement?.id==='global-css-style'||[...m.addedNodes].some(n=>n.id==='global-css-style'))){if(externalCss())restore();schedule();}});styleObserver.observe(document.head,{subtree:true,childList:true,characterData:true});
const oldPersonaInfo=window.updatePersonaInfoArea;
if(typeof oldPersonaInfo==='function')window.updatePersonaInfoArea=function(index){const result=oldPersonaInfo.apply(this,arguments);renderSelfCardEditor(index);return result;};
const oldStatusBubble=window.addMessageBubble;
if(typeof oldStatusBubble==='function')window.addMessageBubble=function(message,targetChatId,targetChatType){
 const result=oldStatusBubble.apply(this,arguments);const id=targetChatId||(typeof currentChatId!=='undefined'?currentChatId:null),type=targetChatType||(typeof currentChatType!=='undefined'?currentChatType:null);const c=type==='private'?people().find(x=>x.id===id):null;
 if(c&&!message?.isWithdrawn&&typeof message?.content==='string'){for(const match of message.content.matchAll(/\[([^\]]*?)更新状态为[：:]([\s\S]*?)\]/g)){if(match[1]===c.realName&&match[2].trim()===String(c.status||'').trim()){const t=timestamp(message.timestamp);if(t){c.statusUpdatedAt=t;c.kissStatusStampedValue=String(c.status||'');}schedule();}}}return result;
};
const oldStatusRecalculate=window.recalculateChatStatus;
if(typeof oldStatusRecalculate==='function')window.recalculateChatStatus=function(c){const before=c?.status,result=oldStatusRecalculate.apply(this,arguments);if(c&&before!==c.status){c.statusUpdatedAt=statusHistoryTime(c);c.kissStatusStampedValue=String(c.status||'');schedule();}return result;};
// A clipped, three-slot pager; decorative fillers never call folder actions.
let folderDrag=null;
document.addEventListener('pointerdown',e=>{const v=e.target.closest('.ku-folder-items');if(!v)return;folderDrag={x:e.clientX,y:e.clientY,viewport:v,id:e.pointerId};});
document.addEventListener('pointerup',e=>{if(!folderDrag)return;const d=folderDrag;folderDrag=null;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)>30&&Math.abs(dx)>Math.abs(dy)*1.3){moveFolderPage(dx<0?1:-1);folderBusyUntil=Date.now()+320;}});
document.addEventListener('pointercancel',()=>{folderDrag=null;});
document.addEventListener('keydown',e=>{if(!e.target.closest('.ku-folder-items'))return;if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();moveFolderPage(e.key==='ArrowRight'?1:-1);}});
document.addEventListener('wheel',e=>{if(!e.target.closest('.ku-folder-items')||Math.abs(e.deltaX)<15||Date.now()<folderBusyUntil)return;moveFolderPage(e.deltaX>0?1:-1);folderBusyUntil=Date.now()+320;},{passive:true});
let folderHold=null;
function cancelFolderHold(){if(folderHold)clearTimeout(folderHold.timer);folderHold=null;}
document.addEventListener('pointerdown',e=>{cancelFolderHold();const b=e.target.closest('.ku-view .ku-folder');if(!b||e.button!==0||Number(b.dataset.ku.split(':')[1])<1)return;const h={id:e.pointerId,x:e.clientX,y:e.clientY,timer:null};h.timer=setTimeout(()=>{if(folderHold!==h||!b.isConnected)return;if(editFolderButton(b)){b.dataset.held='1';setTimeout(()=>{delete b.dataset.held;},900);folderBusyUntil=Date.now()+450;}},500);folderHold=h;},{passive:true});
document.addEventListener('pointermove',e=>{if(folderHold&&e.pointerId===folderHold.id&&Math.hypot(e.clientX-folderHold.x,e.clientY-folderHold.y)>8)cancelFolderHold();},{passive:true});
for(const name of ['pointerup','pointercancel'])document.addEventListener(name,cancelFolderHold,{passive:true});
document.addEventListener('keydown',e=>{const b=e.target.closest('.ku-view .ku-folder');if(b&&(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')){e.preventDefault();editFolderButton(b);}});
// Touch long press mirrors legacy list, without interfering with scrolling or taps.
let pressTimer,pressOrigin;
document.addEventListener('pointerdown',e=>{const row=e.target.closest('.ku-view [data-ku^="chat:"]');if(!row||e.pointerType==='mouse')return;pressOrigin={x:e.clientX,y:e.clientY};pressTimer=setTimeout(()=>{const [,id,type='private']=row.dataset.ku.split(':');handleChatListLongPress(id,type,e.clientX,e.clientY);row.dataset.held='1';},450);},{passive:true});
for(const event of ['pointerup','pointercancel'])document.addEventListener(event,()=>clearTimeout(pressTimer),{passive:true});
document.addEventListener('pointermove',e=>{if(pressOrigin&&Math.hypot(e.clientX-pressOrigin.x,e.clientY-pressOrigin.y)>8)clearTimeout(pressTimer);},{passive:true});
document.addEventListener('click',e=>{const row=e.target.closest('.ku-view [data-held]');if(row){delete row.dataset.held;e.preventDefault();e.stopPropagation();}},true);
// Swipe reveals an explicit delete button; vertical movement stays native scrolling.
let commentDrag=null;
function closeCommentSwipes(except){for(const el of document.querySelectorAll('.ku-comment-swipe.is-open'))if(el!==except)el.classList.remove('is-open');}
document.addEventListener('pointerdown',e=>{const el=e.target.closest('.ku-comment-swipe');if(!el||e.target.closest('.ku-comment-delete')||e.button!==0)return;commentDrag={el,id:e.pointerId,x:e.clientX,y:e.clientY,base:el.classList.contains('is-open')?-58:0,dx:0,locked:false};},{passive:true});
document.addEventListener('pointermove',e=>{const d=commentDrag;if(!d||e.pointerId!==d.id)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(!d.locked){if(Math.abs(dy)>8&&Math.abs(dy)>Math.abs(dx)){commentDrag=null;return;}if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.2)return;d.locked=true;closeCommentSwipes(d.el);d.el.classList.add('is-dragging');try{d.el.setPointerCapture?.(e.pointerId);}catch{}}if(e.cancelable)e.preventDefault();d.dx=dx;d.el.querySelector('.ku-comment-track').style.transform=`translateX(${Math.max(-58,Math.min(0,d.base+dx))}px)`;},{passive:false});
function finishCommentSwipe(e){const d=commentDrag;if(!d||e.pointerId!==d.id)return;commentDrag=null;d.el.classList.remove('is-dragging');d.el.querySelector('.ku-comment-track').style.transform='';if(d.locked){d.el.classList.toggle('is-open',e.type!=='pointercancel'&&d.base+d.dx < -24);d.el.dataset.swipedUntil=String(Date.now()+500);}}
for(const name of ['pointerup','pointercancel'])document.addEventListener(name,finishCommentSwipe,{passive:true});
document.addEventListener('click',e=>{const el=e.target.closest('.ku-comment-swipe');if(el&&Number(el.dataset.swipedUntil)>Date.now()&&!e.target.closest('.ku-comment-delete')){e.preventDefault();e.stopPropagation();return;}if(!el)closeCommentSwipes();},true);
document.addEventListener('scroll',()=>{if(!commentDrag)closeCommentSwipes();},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCommentSwipes();});
window.KissPagesUI={refresh:schedule,hasCustomCss:externalCss,clearLegacyDynamics};schedule();
})();
