/* KISS default three-page appearance. Legacy markup and data remain authoritative.
   Any active global CSS returns the original DOM and stylesheet cascade in full. */
(() => {
'use strict';
const IDS = ['chat-list-screen','contacts-screen','more-screen'];
const $ = (s, root=document) => root.querySelector(s);
const E = (s='') => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL = s => /^(https?:|data:image\/|blob:|assets\/)/i.test(String(s||'')) ? E(s) : '';
const PATHS = {
 back:'M15 4 7 12l8 8', add:'M12 5v14M5 12h14', search:'M21 21l-5-5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0',
 down:'m6 9 6 6 6-6', arrow:'m9 5 7 7-7 7', star:'m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4L12 17.5l-5.7 3.1 1.1-6.4-4.6-4.5 6.4-.9Z',
 heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
 comment:'M21 11.5a8.5 8.5 0 0 1-9 8.5 10 10 0 0 1-4-.8L3 22l1.5-5A8.5 8.5 0 1 1 21 11.5Z',
 panel:'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM7 8h10M7 12h7',
 loops:'M14 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0ZM22 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0',
 calendar:'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2ZM7 2v5M17 2v5M3 9h18M7 13h1M12 13h1M17 13h1M7 17h1M12 17h1',
 palette:'M12 2a10 10 0 1 0 0 20h1a2 2 0 0 0 1.5-3.4 1.7 1.7 0 0 1 1.2-2.9H18a4 4 0 0 0 4-4A10 10 0 0 0 12 2ZM7 8h.01M12 6h.01M17 8h.01M6 13h.01',
 pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 book:'M6 3h12v19l-6-4-6 4Z', reply:'m8 4-5 5 5 5M3 9h11a7 7 0 0 1 7 7v4', edit:'m16 3 5 5-12 12-6 1 1-6ZM14 5l5 5'
};
function icon(name, cls='') { return `<svg class="ku-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PATHS[name]||PATHS.panel}"/></svg>`; }
const check = '<span class="ku-check" aria-label="プロフィール">✓</span>';
const button=(label,action,cls='')=>{const key=action.split(':')[0];const names={home:'ホームに戻る',profile:'プロフィールを見る',details:'投稿を開く',like:'いいね',translation:'翻訳',chat:'トークを開く'};return `<button type="button" class="${cls}" data-ku="${E(action)}"${names[key]?` aria-label="${names[key]}"`:''}>${label}</button>`;};
const people = () => typeof db !== 'undefined' ? db.characters||[] : [];
const groups = () => typeof db !== 'undefined' ? db.groups||[] : [];
const nameOf = c => c?.remarkName || c?.realName || c?.name || '…';
const avatar=(src, cls='')=>`<img class="ku-avatar ${cls}" src="${safeURL(src)}" alt="" loading="lazy" decoding="async">`;
const nowJP=()=>new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
const when=t=>{const d=new Date(t);return Number.isNaN(+d)?'':new Intl.DateTimeFormat('ja-JP',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);};
let frame=0, currentTab='all', feedLimit=40;
const collapsed = new Set();
function externalCss(){const style=$('#global-css-style');return (style?style.textContent:(typeof db!=='undefined'?db.globalCss:'' )||'').replace(/\/\*[\s\S]*?\*\//g,'').trim().length>0;}
function header(title, kind=''){return `<header class="ku-head ku-head-${kind}">${button(icon('back'),'home','ku-back')}<div class="ku-head-copy">${kind==='menu'?'':'<span class="ku-wordmark">K I S S</span>'}<h1>${title}</h1>${kind==='friends'?'<p>言えなかった言葉が、まだ胸に降っている。</p>':''}</div>${kind==='friends'?`<time class="ku-date">${E(nowJP())}</time>`:kind==='menu'?'<span class="ku-wordmark">K I S S</span>':`<div class="ku-head-actions">${button('追加','add')}${button('グループ','group')}${button('設定','settings')}</div>`}</header>`;}
function rootFor(id){const screen=document.getElementById(id);if(!screen)return;let view=$('.ku-view',screen);if(!view){view=document.createElement('section');view.className='ku-view';view.dataset.page=id;view.addEventListener('click',onClick);view.addEventListener('contextmenu',onContext);screen.appendChild(view);}if(!screen.classList.contains('ku-mounted'))screen.classList.add('ku-mounted');return view;}
function openChat(id,type){const c=(type==='group'?groups():people()).find(c=>c.id===id);if(!c)return;currentChatId=id;currentChatType=type||'private';if(typeof updateCustomBubbleStyle==='function')updateCustomBubbleStyle(id,c.customBubbleCss,c.useCustomBubbleCss);openChatRoom(id,currentChatType);}
function renderChats(){const root=rootFor(IDS[0]);if(!root)return;const tabs=[...document.querySelectorAll('#chat-category-tabs > .tab-item')];const rows=[...document.querySelectorAll('#chat-list-container > .chat-item')];let html=header('トーク','chats');
html+=`<div class="ku-folders"><div class="ku-folder-items">${tabs.filter(x=>!x.classList.contains('tab-manage')).map((x,i)=>button(E(i===0?'すべて':x.textContent),'folder:'+i,x.classList.contains('active')?'active':'')).join('')}</div>${button('＋ 新規','new-folder','ku-new-folder')}</div>`;
html+=`<div class="ku-recent">${people().slice(0,4).map(c=>button(avatar(c.avatar)+`<span>${E(nameOf(c))}</span>`,'chat:'+c.id,'ku-person')).join('')}${button(`<span class="ku-add-avatar">${icon('add')}</span><span>追加</span>`,'add','ku-person')}</div><div class="ku-chat-scroll">`;
const sections=[['pin','ピン留め',rows.filter(x=>x.classList.contains('pinned'))],['all','すべてのトーク',rows.filter(x=>!x.classList.contains('pinned'))]];
for(const [key,title,list] of sections){if(!list.length)continue;html+=`<section class="ku-chat-section">${button(`<span>${title} <small>${list.length}</small></span>${icon('down')}`,'collapse:'+key,'ku-section-label'+(collapsed.has(key)?' collapsed':''))}<div class="ku-chat-card" ${collapsed.has(key)?'hidden':''}>${list.map(x=>{const id=x.dataset.id,type=x.dataset.type;return button(avatar($('.chat-avatar',x)?.getAttribute('src'))+`<div class="ku-chat-text"><strong>${E($('.item-name',x)?.textContent)}</strong><p>${E($('.item-preview',x)?.textContent)}</p></div><div class="ku-chat-meta"><time>${E($('.item-time',x)?.textContent)}</time>${$('.unread-badge.visible',x)?`<b>${E($('.unread-badge',x).textContent)}</b>`:''}</div>`,`chat:${id}:${type}`,'ku-chat-row');}).join('')}</div></section>`;}
if(!rows.length)html+='<div class="ku-empty">まだトークがありません。</div>';
root.innerHTML=html+'</div>';}
function menuPersona(){const d=typeof db!=='undefined'?db:{};let p=(d.myPersonaPresets||[]).find(p=>p.id===d.activePersonaId)||(d.myPersonaPresets||[])[0];return {name:p?.name||people()[0]?.myName||'User',avatar:p?.avatar||people()[0]?.myAvatar||$('#more-my-avatar')?.getAttribute('src')};}
function renderMenu(){const root=rootFor(IDS[2]);if(!root)return;const p=menuPersona();const tools=[['panel','状态栏','status-bar'],['loops','思维链','cot-settings'],['calendar','日历','calendar'],['star','收藏','star'],['palette','绘图工坊','drawing-workshop']];root.innerHTML=header('メニュー','menu')+`<div class="ku-menu-scroll"><div class="ku-menu-profile">${button(avatar(p.avatar),'profile','ku-profile-link')}<div><strong>${E(p.name)} ${check}</strong><p>わたしの記録</p><p>日々を、少しずつ。</p></div></div><p class="ku-menu-copy">好きなものを集めて、<br>何でもない日を、特別に。</p><div class="ku-photos" aria-label="日々の風景"><span role="img" aria-label="グラスとイヤホン"></span><span role="img" aria-label="静かな海"></span><span role="img" aria-label="雨と白い花"></span></div><p class="ku-photo-caption">${icon('heart')}何気ない日を、残しておく。</p>${button(`${icon('search')}<span>トーク履歴を検索</span>`,'search','ku-search')}<div class="ku-tools">${tools.map(([i,l,a])=>button(`${icon(i)}<span>${l}</span>${icon('arrow','ku-chevron')}`,'tool:'+a,'ku-tool')).join('')}</div><p class="ku-menu-foot">何気ない日々を、大切に。</p></div>`;}
function moments(){return people().flatMap(c=>(c.moments||[]).map(m=>({c,m}))).sort((a,b)=>(b.m.timestamp||0)-(a.m.timestamp||0));}
function details(id,mid){currentChatId=id;currentChatType='private';renderMomentsScreen();switchScreen('moments-screen');if(mid)requestAnimationFrame(()=>[...document.querySelectorAll('#moments-feed-container .moment-item')].find(x=>x.dataset.id===mid)?.scrollIntoView({block:'start'}));}
function renderFriends(){const root=rootFor(IDS[1]);if(!root)return;const scroll=$('.ku-friend-scroll',root)?.scrollTop||0;let html=header('ともだち','friends')+`<div class="ku-friend-tabs">${[['all','すべて'],['friends','友だち'],['favorites','お気に入り']].map(([id,t])=>button(t,'tab:'+id,currentTab===id?'active':'')).join('')}</div><div class="ku-friend-scroll">`;
let feed=moments();if(currentTab==='favorites')feed=feed.filter(x=>x.c.isPinned);
if(currentTab==='friends'||!feed.length){const contacts=people().filter(c=>currentTab!=='favorites'||c.isPinned);html+=contacts.map(c=>`<article class="ku-post ku-contact">${button(avatar(c.avatar)+`<strong>${E(nameOf(c))} ${check}</strong>`,'profile:'+c.id,'ku-post-person')}<p class="ku-post-text">${E(c.status||c.momentsSignature||'まだ言葉はありません。')}</p>${button('プロフィールを見る','profile:'+c.id,'ku-text-link')}</article>`).join('')||'<p class="ku-empty">まだ投稿がありません。</p>';}
else for(const {c,m} of feed.slice(0,feedLimit)){const comments=m.comments||[];const handle=c.handle||c.username||'';const device=m.device||m.sourceDevice||'';const place=m.location||'';const likes=Array.isArray(m.likes)?m.likes:[];const mine=c.myName||'我';html+=`<article class="ku-post"><div class="ku-post-top">${button(avatar(c.avatar),'profile:'+c.id,'ku-post-avatar')}<div class="ku-byline"><strong>${E(m.author||nameOf(c))} ${check}</strong>${handle?` <span class="ku-handle">@${E(handle.replace(/^@/,''))}</span>`:''}<div class="ku-post-meta">${E(when(m.timestamp))}${device?` · <span class="ku-blue">${E(device)}</span>`:''}</div>${place?`<div class="ku-post-meta">${icon('pin')}${E(place)} · 友だちに公開</div>`:''}</div>${button('···',`details:${c.id}:${m.id}`,'ku-dots')}</div><p class="ku-post-text">${E(m.content)}</p>${Array.isArray(m.images)&&m.images.length?`<div class="ku-post-images">${m.images.map(src=>`<img src="${safeURL(src)}" alt="投稿の写真" loading="lazy">`).join('')}</div>`:''}${m.imageDescription?`<p class="ku-image-description">${E(m.imageDescription)}</p>`:''}${button('翻訳を表示',`translation:${c.id}:${m.id}`,'ku-text-link')}<div class="ku-translation" hidden>${E(m.translation||m.translatedContent||'保存された翻訳はありません。')}</div><div class="ku-post-actions">${button(icon('comment')+`<span>${comments.length||''}</span>`,`details:${c.id}:${m.id}`)}${button(icon('reply'),`details:${c.id}:${m.id}`)}${button(icon('heart')+`<span>${likes.length||''}</span>`,`like:${c.id}:${m.id}`,likes.includes(mine)?'is-liked':'')}${button(icon('book'),`details:${c.id}:${m.id}`)}</div>${comments.length?`<div class="ku-comments">${comments.slice(0,3).map(x=>{const a=people().find(p=>[p.realName,p.remarkName].includes(x.author));return `<div class="ku-comment">${avatar(a?.avatar||c.myAvatar)}<div><strong>${E(x.author)} ${check}</strong> ${x.replyTo?`<span class="ku-muted">${E(x.replyTo)}への返信 · </span>`:''}${E(x.content)}<time>${E(when(x.timestamp))}</time></div></div>`;}).join('')}</div>`:''}</article>`;}
if(feed.length>feedLimit&&currentTab!=='friends')html+=button('もっと見る','more-feed','ku-load-more');root.innerHTML=html+'</div>';$('.ku-friend-scroll',root).scrollTop=scroll;}
function onContext(e){const row=e.target.closest('[data-ku^="chat:"]');if(!row)return;e.preventDefault();const [,id,type='private']=row.dataset.ku.split(':');handleChatListLongPress(id,type,e.clientX,e.clientY);}
function onClick(e){const b=e.target.closest('[data-ku]');if(!b)return;const [action,id,extra]=b.dataset.ku.split(':');
if(action==='home')switchScreen('home-screen');
else if(action==='add')$('#add-chat-btn-kkt')?.click();
else if(action==='group')$('#create-group-btn-kkt')?.click();
else if(action==='settings')$('#import-btn-kkt')?.click();
else if(action==='new-folder')window.openCreateFolderModal?.();
else if(action==='folder'){const tabs=[...document.querySelectorAll('#chat-category-tabs>.tab-item:not(.tab-manage)')];tabs[Number(id)]?.click();}
else if(action==='collapse'){collapsed.has(id)?collapsed.delete(id):collapsed.add(id);renderChats();}
else if(action==='chat')openChat(id,extra||'private');
else if(action==='profile'){if(id)openProfileCard(id);else{setupMyProfileScreen();switchScreen('my-profile-screen');}}
else if(action==='search')window.SearchSystem?.open();
else if(action==='tool')document.querySelector(`.menu-grid .menu-item[data-action="${id}"]`)?.click();
else if(action==='tab'){currentTab=id;feedLimit=40;renderFriends();}
else if(action==='more-feed'){feedLimit+=40;renderFriends();}
else if(action==='details')details(id,extra);
else if(action==='translation'){const text=$('.ku-translation',b.parentElement);text.hidden=!text.hidden;b.textContent=text.hidden?'翻訳を表示':'翻訳を隠す';}
else if(action==='like'){currentChatId=id;currentChatType='private';Promise.resolve(toggleMomentLike(extra)).then(renderFriends).catch(()=>showToast('保存できませんでした。'));}}
function restore(){document.documentElement.classList.remove('ku-mode','ku-nav-active');for(const id of IDS){const screen=document.getElementById(id);if(screen?.classList.contains('ku-mounted'))screen.classList.remove('ku-mounted');$('.ku-view',screen||document)?.remove();}}
function sync(){frame=0;if(externalCss()){restore();return;}document.documentElement.classList.add('ku-mode');const active=IDS.find(id=>document.getElementById(id)?.classList.contains('active'));document.documentElement.classList.toggle('ku-nav-active',!!active);if(!active)return;try{if(active===IDS[0])renderChats();else if(active===IDS[1])renderFriends();else renderMenu();}catch(error){console.error('[KISS pages]',error);restore();}}
function schedule(){if(!frame)frame=requestAnimationFrame(sync);}
// Wrap renderers only; never reparent, replace or rename legacy elements.
for(const key of ['renderChatList','renderChatFolders','renderContactList','renderMyProfile','renderMoreScreen','applyGlobalCss']){const old=window[key];if(typeof old!=='function')continue;window[key]=function(...args){const r=old.apply(this,args);if(key==='applyGlobalCss'&&externalCss())restore();schedule();return r;};}
const screenObserver=new MutationObserver(schedule);for(const id of [...IDS,'phone-screen','chat-room-screen']){const el=document.getElementById(id);if(el)screenObserver.observe(el,{attributes:true,attributeFilter:['class']});}
const styleObserver=new MutationObserver(mutations=>{if(mutations.some(m=>m.target.id==='global-css-style'||m.target.parentElement?.id==='global-css-style'||[...m.addedNodes].some(n=>n.id==='global-css-style'))){if(externalCss())restore();schedule();}});styleObserver.observe(document.head,{subtree:true,childList:true,characterData:true});
// Touch long press mirrors legacy list, without interfering with scrolling or taps.
let pressTimer,pressOrigin;
document.addEventListener('pointerdown',e=>{const row=e.target.closest('.ku-view [data-ku^="chat:"]');if(!row||e.pointerType==='mouse')return;pressOrigin={x:e.clientX,y:e.clientY};pressTimer=setTimeout(()=>{const [,id,type='private']=row.dataset.ku.split(':');handleChatListLongPress(id,type,e.clientX,e.clientY);row.dataset.held='1';},450);},{passive:true});
for(const event of ['pointerup','pointercancel'])document.addEventListener(event,()=>clearTimeout(pressTimer),{passive:true});
document.addEventListener('pointermove',e=>{if(pressOrigin&&Math.hypot(e.clientX-pressOrigin.x,e.clientY-pressOrigin.y)>8)clearTimeout(pressTimer);},{passive:true});
document.addEventListener('click',e=>{const row=e.target.closest('.ku-view [data-held]');if(row){delete row.dataset.held;e.preventDefault();e.stopPropagation();}},true);
window.KissPagesUI={refresh:schedule,hasCustomCss:externalCss};schedule();
})();
