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
 cog:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0', views:'M4 15v6M9 9v12M14 3v18M19 12v9', repeat:'m4 8 4-4 4 4M8 4v13a3 3 0 0 0 3 3h2M20 16l-4 4-4-4M16 20V7a3 3 0 0 0-3-3h-2', play:'m9 5 11 7-11 7Z', book:'M6 3h12v19l-6-4-6 4Z', reply:'m8 4-5 5 5 5M3 9h11a7 7 0 0 1 7 7v4', edit:'m16 3 5 5-12 12-6 1 1-6ZM14 5l5 5'
};
function icon(name, cls='') { return `<svg class="ku-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PATHS[name]||PATHS.panel}"/></svg>`; }
const check = '<span class="ku-check" aria-label="プロフィール">✓</span>';
const button=(label,action,cls='')=>{const key=action.split(':')[0];const names={home:'ホームに戻る',profile:'プロフィールを見る',details:'投稿を開く',like:'いいね',translation:'翻訳',chat:'トークを開く',customize:'表示設定',self:'自分のプロフィール',selfsettings:'プロフィール設定',postmenu:'投稿のメニュー',bookmark:'保存',share:'共有',comment:'コメント',audio:'再生'};return `<button type="button" class="${cls}" data-ku="${E(action)}"${names[key]?` aria-label="${names[key]}"`:''}>${label}</button>`;};
const people = () => typeof db !== 'undefined' ? db.characters||[] : [];
const groups = () => typeof db !== 'undefined' ? db.groups||[] : [];
const nameOf = c => c?.remarkName || c?.realName || c?.name || '…';
const avatar=(src, cls='')=>`<img class="ku-avatar ${cls}" src="${safeURL(src)}" alt="" loading="lazy" decoding="async">`;
const nowJP=()=>new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
const when=t=>{const d=new Date(t);return Number.isNaN(+d)?'':new Intl.DateTimeFormat('ja-JP',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);};
let frame=0, currentTab='all', feedLimit=40, folderPage=0, folderSignature='', folderBusyUntil=0;
const postData=new Map();
let playingAudio=null;
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
 const defaults=['日常','グループ','ノート'];
 let pages='';
 for(let page=0;page<count;page++){
  const group=items.slice(page*3,page*3+3), selected=group.findIndex(x=>x.active);
  const content=group.map(x=>button(E(x.label),'folder:'+x.index,'ku-folder'+(x.active?' active':''))).join('');
  const fillers=Array.from({length:3-group.length},(_,i)=>`<span class="ku-folder-placeholder" aria-hidden="true">${defaults.filter(l=>!group.some(x=>x.label===l))[i]||'日常'}</span>`).join('');
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
function renderMenu(){const root=rootFor(IDS[2]);if(!root)return;const p=menuPersona();const tools=[['panel','状态栏','status-bar'],['loops','思维链','cot-settings'],['calendar','日历','calendar'],['star','收藏','star'],['palette','绘图工坊','drawing-workshop']];root.innerHTML=header('メニュー','menu')+`<div class="ku-menu-scroll"><div class="ku-menu-profile">${button(avatar(p.avatar),'profile','ku-profile-link')}<div><strong>${E(p.name)} ${check}</strong><p>わたしの記録</p><p>日々を、少しずつ。</p></div></div><p class="ku-menu-copy">好きなものを集めて、<br>何でもない日を、特別に。</p><div class="ku-photos" aria-label="日々の風景"><span role="img" aria-label="グラスとイヤホン"></span><span role="img" aria-label="静かな海"></span><span role="img" aria-label="雨と白い花"></span></div><p class="ku-photo-caption">${icon('heart')}何気ない日を、残しておく。</p>${button(`${icon('search')}<span>トーク履歴を検索</span>`,'search','ku-search')}<div class="ku-tools">${tools.map(([i,l,a])=>button(`${icon(i)}<span>${l}</span>${icon('arrow','ku-chevron')}`,'tool:'+a,'ku-tool')).join('')}</div><p class="ku-menu-foot">何気ない日々を、大切に。</p></div>`;}
function moments() {
 return people().flatMap(c=>{
  const posts=Array.isArray(c.moments)?c.moments:[];
  if(posts.length)return posts.map(m=>({c,m,status:false}));
  const text=String(c.status||c.momentsSignature||'').trim();
  return [{c,status:true,m:{id:'status',content:/^(在线|online|オンライン)$/i.test(text)?'':text,timestamp:c.statusUpdatedAt||c.statusTimestamp,likes:c.kissStatusLikes||[],comments:c.kissStatusComments||[]}}];
 }).sort((a,b)=>(Number(b.m.timestamp)||0)-(Number(a.m.timestamp)||0));
}
function details(id,mid) {currentChatId=id;currentChatType='private';renderMomentsScreen();switchScreen('moments-screen');if(mid)requestAnimationFrame(()=>[...document.querySelectorAll('#moments-feed-container .moment-item')].find(x=>x.dataset.id===mid)?.scrollIntoView({block:'start'}));}
function postKey(c,m){return c.id+':'+m.id;}
function metaFor(c,m) {
 const display=c.kissFriendsDisplay||{};
 return {handle:m.handle||c.handle||c.username||display.handle||'',device:m.device||m.sourceDevice||display.device||'',location:m.location||display.location||''};
}
function musicFor(m){const v=m.music||m.song||m.sharedMusic;return v&&typeof v==='object'?v:null;}
function renderMusic(m,key){const song=musicFor(m);if(!song)return '';
 const cover=song.cover||song.picUrl||song.albumCover;
 return `<div class="ku-music">${cover?`<img src="${safeURL(cover)}" alt="" loading="lazy">`:`<span class="ku-music-disc">♪</span>`}<div><strong>${E(song.title||song.name||'音楽')}</strong><small>${E(song.artist||song.singer||'')}</small></div><svg class="ku-wave" viewBox="0 0 65 30" aria-hidden="true"><path d="M3 12v6m5-12v18m5-21v24m5-18v12m5-15v18m5-24v30m5-25v20m5-17v14m5-20v26m5-20v14m5-11v8m5-7v6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>${button(icon('play'),'audio:'+key,'ku-play')}</div>`;
}
function commentMarkup(c,x,thread=false){const a=people().find(p=>[p.realName,p.remarkName].includes(x.author));return `<div class="ku-comment">${avatar(a?.avatar||c.myAvatar)}<div><strong>${E(x.author)} ${check}</strong><span>${x.replyTo?E(x.replyTo)+'への返信 · ':''}${E(x.content)}</span>${thread?`<time>${E(when(x.timestamp))}</time>`:''}</div>${!thread&&x.timestamp?`<time>${E(when(x.timestamp))}</time>`:''}${typeof x.likes==='number'?`<span class="ku-reply-likes">${icon('heart')}${x.likes}</span>`:''}</div>`;}
function postMarkup(entry,index) {
 const {c,m,status}=entry,key=postKey(c,m);postData.set(key,entry);
 const meta=metaFor(c,m),comments=Array.isArray(m.comments)?m.comments:[],likes=Array.isArray(m.likes)?m.likes:[];
 const song=musicFor(m),thread=!!song,quote=!!(m.quote||m.quotedContent)||index%3===2;
 const saved=(c.kissFriendsSaved||[]).includes(String(m.id));
 const stamp=m.timestamp?when(m.timestamp):'ひとこと';
 const text=String(m.content||'');
 const title=String(m.author||nameOf(c));
 const source=meta.device?`<span> · </span><span class="ku-blue">${E(meta.device)}</span><span>から</span>`:'';
 const place=meta.location?`${icon('pin')}<span>${E(meta.location)} · 友だちに公開</span>`:'';
 const textHTML=text?E(text).split(/\n{2,}/).map(p=>`<span class="ku-paragraph">${p}</span>`).join(''):'<span class="ku-unwritten">まだ投稿がありません。</span>';
 const translation=m.translation||m.translatedContent;
 const views=Number(m.views||m.viewCount)||0;
 const reposts=Array.isArray(m.reposts)?m.reposts.length:Number(m.repostCount)||0;
 return `<article class="ku-post${thread?' ku-thread-post':''}${quote?' ku-quote-post':''}" data-post="${E(key)}"><div class="ku-post-top">${button(avatar(c.avatar),'profile:'+c.id,'ku-post-avatar')}<div class="ku-byline"><div class="ku-name-line"><strong>${E(title)} ${check}</strong>${meta.handle?`<span class="ku-handle">@${E(String(meta.handle).replace(/^@/,''))}</span>`:''}</div><div class="ku-post-meta"><time>${E(stamp)}</time>${source}</div><div class="ku-post-place">${place||'<span>友だちに公開</span>'}</div></div>${button('···','postmenu:'+key,'ku-dots')}</div><div class="ku-post-body"><p class="ku-post-text">${textHTML}</p>${Array.isArray(m.images)&&m.images.length?`<div class="ku-post-images">${m.images.map(src=>`<img src="${safeURL(typeof src==='string'?src:src.url)}" alt="投稿の写真" loading="lazy">`).join('')}</div>`:''}${m.imageDescription?`<p class="ku-image-description">${E(m.imageDescription)}</p>`:''}${text?button('翻訳を表示','translation:'+key,'ku-text-link'):''}<div class="ku-translation" hidden>${E(translation||'保存された翻訳はありません。')}</div>${renderMusic(m,key)}<div class="ku-post-actions">${button(icon('comment')+`<span>${comments.length}</span>`,'comment:'+key)}${button(icon('repeat')+`<span>${reposts}</span>`,'share:'+key)}${button(icon('heart')+`<span>${likes.length}</span>`,'like:'+key,likes.includes(c.myName||'我')?'is-liked':'')}<span class="ku-views" aria-label="閲覧数">${icon('views')}<span>${views>=1000?(views/1000).toFixed(1)+'k':views}</span></span>${button(icon('book'),'bookmark:'+key,saved?'is-saved':'')}</div></div>${comments.length?`<div class="${thread?'ku-thread-comments':'ku-comments'}">${comments.slice(0,thread?3:1).map(x=>commentMarkup(c,x,thread)).join('')}</div>`:''}</article>`;
}
function selfProfileCard(){
 const p=menuPersona();
 return `<section class="ku-self-card" aria-label="わたしのプロフィールと設定">${button(avatar(p.avatar)+`<span><strong>${E(p.name)}</strong><small>わたしのプロフィール</small></span>`,'self','ku-self-card-main')}${button(icon('cog'),'selfsettings','ku-self-card-settings')}</section>`;
}
function renderFriends(){
 const root=rootFor(IDS[1]);if(!root)return;
 const scroll=$('.ku-friend-scroll',root)?.scrollTop||0;
 let feed=moments();if(currentTab==='favorites')feed=feed.filter(({c,m})=>(c.kissFriendsSaved||[]).includes(String(m.id))||c.isPinned);
 if(currentTab==='friends')feed=feed.filter((x,i,a)=>a.findIndex(y=>y.c.id===x.c.id)===i);
 postData.clear();
 root.innerHTML=header('ともだち','friends')+`<div class="ku-friend-tabs">${[['all','すべて'],['friends','友だち'],['favorites','お気に入り']].map(([id,t])=>button(t,'tab:'+id,currentTab===id?'active':'')).join('')}</div><div class="ku-friend-scroll">${selfProfileCard()}${feed.slice(0,feedLimit).map(postMarkup).join('')||'<p class="ku-empty">まだ投稿がありません。</p>'}${feed.length>feedLimit?button('もっと見る','more-feed','ku-load-more'):''}</div>`;
 $('.ku-friend-scroll',root).scrollTop=scroll;
}
function openSheet(title,html){
 closeSheet();const overlay=document.createElement('div');overlay.className='ku-sheet-overlay';
 overlay.innerHTML=`<section class="ku-sheet" role="dialog" aria-modal="true" aria-label="${E(title)}"><header><strong>${E(title)}</strong><button type="button" data-close aria-label="閉じる">×</button></header>${html}</section>`;
 const focus=document.activeElement;overlay._previousFocus=focus;document.body.appendChild(overlay);
 overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('[data-close]'))closeSheet();});
 overlay.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet();if(e.key==='Tab'){const nodes=[...overlay.querySelectorAll('button,input,textarea')].filter(x=>!x.disabled);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 overlay.querySelector('button')?.focus();return overlay;
}
function closeSheet(){const el=$('.ku-sheet-overlay');if(el){el._previousFocus?.focus();el.remove();}}
function editDisplay(c){
 const d=c.kissFriendsDisplay||{};
 const overlay=openSheet('表示情報',`<form class="ku-display-form"><label>ユーザー名<input name="handle" maxlength="80" value="${E(d.handle||c.handle||c.username||'')}" placeholder="@name"></label><label>端末<input name="device" maxlength="80" value="${E(d.device||'')}" placeholder="iPhone 17 Pro"></label><label>場所<input name="location" maxlength="80" value="${E(d.location||'')}" placeholder="Tokyo"></label><button type="submit">保存</button></form>`);
 $('form',overlay).addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,b=$('button[type=submit]',f);b.disabled=true;const previous=c.kissFriendsDisplay;const values=new FormData(f);c.kissFriendsDisplay={handle:String(values.get('handle')).trim(),device:String(values.get('device')).trim(),location:String(values.get('location')).trim()};try{await saveData();closeSheet();renderFriends();}catch{c.kissFriendsDisplay=previous;b.disabled=false;showToast('保存できませんでした。');}});
}
function postMenu(entry){const {c,m,status}=entry;const sheet=openSheet(nameOf(c),`<div class="ku-sheet-menu"><button type="button" data-profile>プロフィール</button><button type="button" data-chat>トークを開く</button><button type="button" data-display>表示情報を編集</button>${status?'':'<button type="button" data-post>投稿を開く</button>'}</div>`);
 $('[data-profile]',sheet).onclick=()=>{closeSheet();openProfileCard(c.id);};$('[data-chat]',sheet).onclick=()=>{closeSheet();openChat(c.id,'private');};$('[data-display]',sheet).onclick=()=>editDisplay(c);if(!status)$('[data-post]',sheet).onclick=()=>{closeSheet();details(c.id,m.id);};
}
function statusComments(entry){const {c,m}=entry;const overlay=openSheet('コメント',`<div class="ku-sheet-comments">${(c.kissStatusComments||[]).map(x=>commentMarkup(c,x,true)).join('')||'<p class="ku-muted">まだコメントはありません。</p>'}</div><form class="ku-comment-form"><textarea name="text" rows="2" maxlength="2000" aria-label="コメント" placeholder="言葉を残す…" required></textarea><button type="submit">送信</button></form>`);
 $('form',overlay).addEventListener('submit',async e=>{e.preventDefault();const text=String(new FormData(e.currentTarget).get('text')).trim();if(!text)return;const old=c.kissStatusComments||[];c.kissStatusComments=[...old,{id:'reply_'+Date.now(),author:c.myName||menuPersona().name,content:text,timestamp:Date.now()}];const btn=$('button[type=submit]',overlay);btn.disabled=true;try{await saveData();closeSheet();renderFriends();}catch{c.kissStatusComments=old;btn.disabled=false;showToast('保存できませんでした。');}});
}
async function postAction(action,entry,b){
 if(!entry)return;const {c,m,status}=entry;
 if(action==='postmenu')return postMenu(entry);
 if(action==='comment')return status?statusComments(entry):details(c.id,m.id);
 if(action==='bookmark'){const old=c.kissFriendsSaved||[],id=String(m.id);c.kissFriendsSaved=old.includes(id)?old.filter(x=>x!==id):[...old,id];try{await saveData();renderFriends();}catch{c.kissFriendsSaved=old;showToast('保存できませんでした。');}return;}
 if(action==='like'){
  if(!status){currentChatId=c.id;currentChatType='private';try{await toggleMomentLike(m.id);renderFriends();}catch{showToast('保存できませんでした。');}return;}
  const name=c.myName||'我',old=c.kissStatusLikes||[];c.kissStatusLikes=old.includes(name)?old.filter(x=>x!==name):[...old,name];try{await saveData();renderFriends();}catch{c.kissStatusLikes=old;showToast('保存できませんでした。');}return;
 }
 if(action==='share'){try{await navigator.clipboard.writeText(String(m.content||''));showToast('投稿をコピーしました。');}catch{showToast('コピーできませんでした。');}return;}
 if(action==='audio'){
  const song=musicFor(m),url=song?.url||song?.audioUrl||song?.src;
  if(!/^https?:|^blob:/i.test(url||'')){showToast('再生できる音源がありません。');return;}
  if(playingAudio){const same=playingAudio.dataset.key===postKey(c,m);playingAudio.pause();playingAudio=null;if(same){b.setAttribute('aria-label','再生');return;}}
  playingAudio=new Audio(url);playingAudio.dataset.key=postKey(c,m);try{await playingAudio.play();b.setAttribute('aria-label','一時停止');}catch{showToast('再生できませんでした。');}return;
 }
}
function onContext(e){const row=e.target.closest('[data-ku^="chat:"]');if(!row)return;e.preventDefault();const [,id,type='private']=row.dataset.ku.split(':');handleChatListLongPress(id,type,e.clientX,e.clientY);}
function onClick(e){const b=e.target.closest('[data-ku]');if(!b)return;const [action,id,extra]=b.dataset.ku.split(':');
if(['postmenu','comment','bookmark','share','like','audio'].includes(action)){postAction(action,postData.get(id+':'+extra),b);return;}
if(action==='self'||action==='selfsettings'){setupMyProfileScreen();switchScreen('my-profile-screen');return;}
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
else if(action==='translation'){const text=$('.ku-translation',b.parentElement);text.hidden=!text.hidden;b.textContent=text.hidden?'翻訳を表示':'翻訳を隠す';}
}
function restore(){document.documentElement.classList.remove('ku-mode','ku-nav-active');for(const id of IDS){const screen=document.getElementById(id);if(screen?.classList.contains('ku-mounted'))screen.classList.remove('ku-mounted');$('.ku-view',screen||document)?.remove();}closeSheet();}
function sync(){frame=0;if(externalCss()){restore();return;}document.documentElement.classList.add('ku-mode');const active=IDS.find(id=>document.getElementById(id)?.classList.contains('active'));document.documentElement.classList.toggle('ku-nav-active',!!active);if(!active)return;try{if(active===IDS[0])renderChats();else if(active===IDS[1])renderFriends();else renderMenu();}catch(error){console.error('[KISS pages]',error);restore();}}
function schedule(){if(!frame)frame=requestAnimationFrame(sync);}
// Wrap renderers only; never reparent, replace or rename legacy elements.
for(const key of ['renderChatList','renderChatFolders','renderContactList','renderMyProfile','renderMoreScreen','applyGlobalCss']){const old=window[key];if(typeof old!=='function')continue;window[key]=function(...args){const r=old.apply(this,args);if(key==='applyGlobalCss'&&externalCss())restore();schedule();return r;};}
const screenObserver=new MutationObserver(schedule);for(const id of [...IDS,'phone-screen','chat-room-screen']){const el=document.getElementById(id);if(el)screenObserver.observe(el,{attributes:true,attributeFilter:['class']});}
const styleObserver=new MutationObserver(mutations=>{if(mutations.some(m=>m.target.id==='global-css-style'||m.target.parentElement?.id==='global-css-style'||[...m.addedNodes].some(n=>n.id==='global-css-style'))){if(externalCss())restore();schedule();}});styleObserver.observe(document.head,{subtree:true,childList:true,characterData:true});
// A clipped, three-slot pager; decorative fillers never call folder actions.
let folderDrag=null;
document.addEventListener('pointerdown',e=>{const v=e.target.closest('.ku-folder-items');if(!v)return;folderDrag={x:e.clientX,y:e.clientY,viewport:v,id:e.pointerId};});
document.addEventListener('pointerup',e=>{if(!folderDrag)return;const d=folderDrag;folderDrag=null;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)>30&&Math.abs(dx)>Math.abs(dy)*1.3){moveFolderPage(dx<0?1:-1);folderBusyUntil=Date.now()+320;}});
document.addEventListener('pointercancel',()=>{folderDrag=null;});
document.addEventListener('keydown',e=>{if(!e.target.closest('.ku-folder-items'))return;if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();moveFolderPage(e.key==='ArrowRight'?1:-1);}});
document.addEventListener('wheel',e=>{if(!e.target.closest('.ku-folder-items')||Math.abs(e.deltaX)<15||Date.now()<folderBusyUntil)return;moveFolderPage(e.deltaX>0?1:-1);folderBusyUntil=Date.now()+320;},{passive:true});
// Touch long press mirrors legacy list, without interfering with scrolling or taps.
let pressTimer,pressOrigin;
document.addEventListener('pointerdown',e=>{const row=e.target.closest('.ku-view [data-ku^="chat:"]');if(!row||e.pointerType==='mouse')return;pressOrigin={x:e.clientX,y:e.clientY};pressTimer=setTimeout(()=>{const [,id,type='private']=row.dataset.ku.split(':');handleChatListLongPress(id,type,e.clientX,e.clientY);row.dataset.held='1';},450);},{passive:true});
for(const event of ['pointerup','pointercancel'])document.addEventListener(event,()=>clearTimeout(pressTimer),{passive:true});
document.addEventListener('pointermove',e=>{if(pressOrigin&&Math.hypot(e.clientX-pressOrigin.x,e.clientY-pressOrigin.y)>8)clearTimeout(pressTimer);},{passive:true});
document.addEventListener('click',e=>{const row=e.target.closest('.ku-view [data-held]');if(row){delete row.dataset.held;e.preventDefault();e.stopPropagation();}},true);
window.KissPagesUI={refresh:schedule,hasCustomCss:externalCss};schedule();
})();
