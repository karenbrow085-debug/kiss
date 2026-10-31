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
 trash:'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v7M14 10v7',lock:'M6 11h12v10H6ZM8 11V7a4 4 0 0 1 8 0v4M12 15v2',
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
const REPOST_PATH='m2.784 2.089l.07.057l2 2a.5.5 0 0 1-.638.765l-.07-.057l-1.145-1.145L3 11.5a1.5 1.5 0 0 0 1.356 1.493L4.5 13h3a.5.5 0 0 1 .09.992L7.5 14h-3a2.5 2.5 0 0 1-2.495-2.336L2 11.5l.001-7.793L.854 4.854a.5.5 0 0 1-.638.057l-.07-.057a.5.5 0 0 1-.057-.638l.057-.07l2-2a.5.5 0 0 1 .638-.057M11.5 2a2.5 2.5 0 0 1 2.495 2.336L14 4.5l-.001 7.793l1.147-1.147a.5.5 0 0 1 .638-.057l.07.057a.5.5 0 0 1 .057.638l-.057.07l-2 2a.5.5 0 0 1-.638.057l-.07-.057l-2-2a.5.5 0 0 1 .638-.765l.07.057l1.145 1.145L13 4.5a1.5 1.5 0 0 0-1.356-1.493L11.5 3h-3a.5.5 0 0 1-.09-.992L8.5 2z';
function icon(name, cls='') {if(name==='repeat')return `<svg class="ku-icon ku-repeat ${cls}" viewBox="0 0 16 16" fill="currentColor" stroke="none" aria-hidden="true"><path fill="currentColor" stroke="none" d="${REPOST_PATH}"/></svg>`;return `<svg class="ku-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PATHS[name]||PATHS.panel}"/></svg>`; }

const check = '<svg class="ku-check" viewBox="0 0 24 24" role="img" aria-label="认证"><path fill="#078bfa" d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.76 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.76 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.77 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m7.4 12.1 3 3 6.2-6.5" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const button=(label,action,cls='')=>{const key=action.split(':')[0];const actions=['home','profile','details','like','translation','chat','customize','self','postmenu','bookmark','share','comment','audio','musicedit','menuedit'];const names=Object.fromEntries(actions.map((key,i)=>[key,UI_COPY[uiLanguage].a11y[i]]));return `<button type="button" class="${cls}" data-ku="${E(action)}"${names[key]?` aria-label="${E(names[key])}"`:''}>${label}</button>`;};
const people = () => typeof db !== 'undefined' ? db.characters||[] : [];
const groups = () => typeof db !== 'undefined' ? db.groups||[] : [];
const nameOf = c => c?.remarkName || c?.realName || c?.name || '…';
const avatar=(src, cls='')=>`<img class="ku-avatar ${cls}" src="${safeURL(src)}" alt="" loading="lazy" decoding="async">`;
const nowJP=()=>new Intl.DateTimeFormat({ja:'ja-JP',en:'en-US',zh:'zh-CN',ko:'ko-KR'}[uiLanguage],{month:uiLanguage==='ja'?'long':'short',day:'numeric',weekday:uiLanguage==='ja'?'long':'short'}).format(new Date());
const when=t=>{const d=new Date(t);if(Number.isNaN(+d))return '';const pad=n=>String(n).padStart(2,'0');return `${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;};
let frame=0, currentTab='all', feedLimit=40, folderPage=0, folderSignature='', folderBusyUntil=0;
const postData=new Map();
let playingAudio=null;
const translatedPosts=new Set();
const commentRefs=new Map();let commentSeq=0;
const selfViewedAt=Date.now();
const DEFAULT_SELF_TEXT='今日は少し遠回りをして、家に帰った。\n\n街の灯りがひとつずつ、夕暮れに滲んでいく。言えなかった言葉だけが、まだ胸の奥で揺れている。\n\n何でもない今日を、忘れないように。';
const DEFAULT_SELF_TRANSLATION='今天绕了一点远路，回到家。\n\n街灯一盏盏亮起，在暮色里晕开。那些没能说出口的话，还在心底轻轻摇晃。\n\n把平凡的今天留下，好让自己记得。';

const UI_COPY={"ja":{"chatsTitle":"トーク","friendsTitle":"ともだち","menuTitle":"メニュー","subtitle":"言えなかった言葉が、まだ胸に降っている。","group":"グループ","settings":"設定","all":"すべて","folderFill":["日々","グループ","ノート"],"newFolder":"＋ 新規","add":"追加","pinned":"ピン留め","allChats":"すべてのトーク","emptyChats":"まだトークがありません。","menuSubtitle":"わたしの記録","menuDescription":"日々を、少しずつ。","menuText":"好きなものを集めて、\n何でもない日を、特別に。","scenes":"日々の風景","menuCaption":"何気ない日を、残しておく。","search":"トーク履歴を検索","menuFooter":"何気ない日々を、大切に。","tools":["状态栏","思维链","日历","收藏","绘图工坊"],"friendsTab":"友だち","favoritesTab":"お気に入り","sort":"並び替え","emptyFriends":"友だちがいません。","more":"もっと見る","song":"今日の一曲","pickSong":"音楽を選ぶ","pause":"一時停止","play":"再生","replyTo":"{name}への返信 · ","status":"ステータス","note":"ひとこと","statusSource":"いまのひとこと","fromDevice":"{device}から","private":"自分のみ","public":"友だちに公開","emptyPost":"まだ投稿がありません。","photo":"投稿の写真","reply":"言葉を残す…","original":"原文を表示","translation":"翻訳を表示","views":"閲覧数","switchLabel":"表示言語を切り替える","storageFail":"言語の選択を保存できませんでした。","a11y":["ホームに戻る","プロフィールを見る","投稿を開く","いいね","翻訳","トークを開く","表示設定","自分のプロフィール","投稿のメニュー","保存","共有","コメント","再生","设置音乐","编辑菜单页文案和图片"]},"en":{"chatsTitle":"Inbox.","friendsTitle":"My circle.","menuTitle":"Little things.","subtitle":"Small stories, familiar faces.","group":"New group","settings":"Options","all":"All","folderFill":["Everyday","Together","Notes"],"newFolder":"＋ New","add":"Add","pinned":"Close at hand","allChats":"Conversations","emptyChats":"A hello could start here.","menuSubtitle":"A pocket of my own","menuDescription":"Collected along the way.","menuText":"Good songs. Quiet afternoons.\nA few things worth keeping.","scenes":"Scenes from an ordinary day","menuCaption":"Some days deserve a second look.","search":"Find a conversation","menuFooter":"Keep a little room for wonder.","tools":["Status","Reply style","Calendar","Saved","Image studio"],"friendsTab":"People","favoritesTab":"Kept close","sort":"Sort","emptyFriends":"Leave room for someone new.","more":"A little more","song":"On repeat","pickSong":"Pick a song","pause":"Pause","play":"Play","replyTo":"To {name} · ","status":"Status","note":"A small note","statusSource":"A thought for today","fromDevice":"via {device}","private":"Only me","public":"Shared with friends","emptyPost":"A page waiting for its first line.","photo":"Photo","reply":"Leave a little note…","original":"Read original","translation":"Read translation","views":"Views","switchLabel":"Change display language","storageFail":"Your language choice could not be saved.","a11y":["Back home","View profile","Open post","Like","Translate","Open chat","Display settings","My profile","Post options","Save","Share","Comment","Play","Choose music","Edit this page"],"selfText":"The café was closing when a song I loved came on.\n\nI stayed for one last sip. Outside, the windows had turned into little squares of light, and I caught myself wishing you were there.\n\nSome evenings stay with you for no particular reason.","selfTranslation":"咖啡店快打烊时，响起了一首我很喜欢的歌。\n\n我留下来喝完最后一口。窗外一扇扇窗亮成小小的光块，我忽然希望你也在这里。\n\n有些夜晚，没什么特别的理由，却一直记得。"},"zh":{"chatsTitle":"来信之间","friendsTitle":"身边的人","menuTitle":"日常拾光","subtitle":"有人分享琐碎，就有了值得记住的今天。","group":"发起群聊","settings":"设置","all":"全部","folderFill":["日常","同伴","便笺"],"newFolder":"＋ 新建","add":"添加","pinned":"放在心上","allChats":"正在发生的对话","emptyChats":"第一句问候，还留在这里。","menuSubtitle":"给生活留个位置","menuDescription":"收好沿途的小小心动。","menuText":"把喜欢的歌、没说完的话，\n和普通日子里的小事，放在这里。","scenes":"日子里的几帧画面","menuCaption":"平常的一天，也有想留下的瞬间。","search":"翻找聊天记录","menuFooter":"慢慢来，喜欢的都会留下。","tools":["当前状态","回复风格","日历","收藏","绘图工坊"],"friendsTab":"好友","favoritesTab":"特别关心","sort":"排序","emptyFriends":"下一次相遇，或许就在路上。","more":"再往下看看","song":"今天听这一首","pickSong":"选一首歌","pause":"暂停","play":"播放","replyTo":"回复 {name} · ","status":"状态","note":"随手记","statusSource":"此刻想说","fromDevice":"来自 {device}","private":"仅自己可见","public":"分享给好友","emptyPost":"这一页，等一个想说的瞬间。","photo":"照片","reply":"留一句想说的话…","original":"查看原文","translation":"查看译文","views":"浏览次数","switchLabel":"切换界面语言","storageFail":"这次语言选择未能保存。","a11y":["返回桌面","查看资料","打开动态","点赞","翻译","打开聊天","显示设置","我的资料","动态菜单","收藏","分享","评论","播放","设置音乐","编辑本页文案和图片"],"selfText":"路过便利店的时候，买了一瓶没喝过的汽水。\n\n天还没全黑，耳机里的歌也正好。我没有急着回家，沿着熟悉的街道又走了一会儿。\n\n今天没有大事发生，小事倒是刚刚好。","selfTranslation":""},"ko":{"chatsTitle":"이어지는 말","friendsTitle":"우리 사이","menuTitle":"나의 조각","subtitle":"별일 없는 하루도, 너와 나누면 이야기가 돼.","group":"새 그룹","settings":"설정","all":"전체","folderFill":["오늘","함께","메모"],"newFolder":"＋ 새 폴더","add":"추가","pinned":"가까이 둔 대화","allChats":"오가는 이야기","emptyChats":"첫인사를 기다리는 자리.","menuSubtitle":"조용히 모아 둔 취향","menuDescription":"마음이 머문 순간들.","menuText":"좋아하는 노래 한 곡,\n아무도 모르는 오늘의 장면.","scenes":"하루의 작은 장면들","menuCaption":"지나치기 아쉬운 순간을 담아.","search":"지난 대화 찾아보기","menuFooter":"오래 보고 싶은 것들을 곁에.","tools":["지금 상태","답변 스타일","달력","보관함","이미지 공방"],"friendsTab":"친구","favoritesTab":"마음에 담은","sort":"정렬","emptyFriends":"우리의 다음 인연을 기다리며.","more":"조금 더 보기","song":"오늘 곁에 둘 노래","pickSong":"노래 고르기","pause":"일시 정지","play":"재생","replyTo":"{name}에게 · ","status":"상태","note":"짧은 기록","statusSource":"지금의 한마디","fromDevice":"{device}에서","private":"나만 보기","public":"친구와 나눔","emptyPost":"아직 쓰지 않은 오늘의 한 줄.","photo":"사진","reply":"짧은 안부를 남겨요…","original":"원문 보기","translation":"번역 보기","views":"조회 수","switchLabel":"화면 언어 바꾸기","storageFail":"언어 선택을 저장하지 못했어요.","a11y":["홈으로","프로필 보기","게시물 열기","좋아요","번역","대화 열기","화면 설정","내 프로필","게시물 메뉴","보관","공유","댓글","재생","음악 설정","이 페이지 꾸미기"],"selfText":"오늘은 집에 오는 길에 한 정거장 먼저 내렸다.\n\n이어폰을 빼니 저녁 바람 소리가 들렸다. 누군가에게 꼭 말하고 싶은 일은 없었는데, 문득 네 안부가 궁금해졌다.\n\n이런 평범한 날에도 우리 이야기는 조금씩 쌓인다.","selfTranslation":"今天回家时，提前一站下了车。\n\n摘下耳机，听见晚风的声音。并没有什么非说不可的事，却忽然想问问你过得怎么样。\n\n即使是这样平凡的日子，我们的故事也在慢慢积攒。"}};

const UI_LANGUAGES=['ja','en','zh','ko'];
const UI_LANGUAGE_NAMES={ja:'日本語',en:'English',zh:'中文',ko:'한국어'};
const UI_LOCALE_KEY='kiss.404.language';
let uiLanguage='ja';
try{const saved=localStorage.getItem(UI_LOCALE_KEY);if(UI_LANGUAGES.includes(saved))uiLanguage=saved;}catch{}
const t=(key,values={})=>String(UI_COPY[uiLanguage][key]??UI_COPY.ja[key]??key).replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));
const defaultSelfText=()=>uiLanguage==='ja'?DEFAULT_SELF_TEXT:t('selfText');
const defaultSelfTranslation=()=>uiLanguage==='ja'?DEFAULT_SELF_TRANSLATION:t('selfTranslation');
function cycleUiLanguage(){
 const next=UI_LANGUAGES[(UI_LANGUAGES.indexOf(uiLanguage)+1)%UI_LANGUAGES.length];
 uiLanguage=next;
 try{localStorage.setItem(UI_LOCALE_KEY,next);}catch{if(typeof showToast==='function')showToast(t('storageFail'));}
 schedule();
 requestAnimationFrame(()=>document.querySelector('.ku-head-friends [data-ku="language"]')?.focus({preventScroll:true}));
}

const collapsed = new Set();
function externalCss(){const style=$('#global-css-style');return (style?style.textContent:(typeof db!=='undefined'?db.globalCss:'' )||'').replace(/\/\*[\s\S]*?\*\//g,'').trim().length>0;}
function header(title, kind='') {
 return `<header class="ku-head ku-head-${kind}">${button(icon('back'),'home','ku-back')}<div class="ku-head-copy">${kind==='menu'?'':'<span class="ku-wordmark">K I S S</span>'}<h1>${title}</h1>${kind==='friends'?`<p>${E(t('subtitle'))}</p>`:''}</div>${kind==='friends'?`<button type="button" class="ku-date" data-ku="language" aria-label="${E(t('switchLabel'))} · ${UI_LANGUAGE_NAMES[uiLanguage]}" title="${UI_LANGUAGE_NAMES[uiLanguage]} → ${UI_LANGUAGE_NAMES[UI_LANGUAGES[(UI_LANGUAGES.indexOf(uiLanguage)+1)%4]]}"><time>${E(nowJP())}</time></button>`:kind==='menu'?'<span class="ku-wordmark">K I S S</span>':`<div class="ku-head-actions">${button(E(t('group')),'group')}${button(E(t('settings')),'settings')}</div>`}</header>`;
}
function folderMarkup(tabs) {
 const items=tabs.filter(x=>!x.classList.contains('tab-manage')).map((x,i)=>({label:i===0?t('all'):x.textContent,index:i,active:x.classList.contains('active')}));
 const signature=JSON.stringify(items.map(x=>x.label));
 if(signature!==folderSignature){folderPage=Math.floor(Math.max(0,items.findIndex(x=>x.active))/3);folderSignature=signature;}
 const count=Math.max(1,Math.ceil(items.length/3));folderPage=Math.min(folderPage,count-1);
 const defaults=UI_COPY[uiLanguage].folderFill;
 let pages='';
 for(let page=0;page<count;page++){
  const group=items.slice(page*3,page*3+3), selected=group.findIndex(x=>x.active);
  const content=group.map(x=>button(E(x.label),'folder:'+x.index,'ku-folder'+(x.active?' active':''))).join('');
  const fillers=Array.from({length:3-group.length},(_,i)=>`<span class="ku-folder-placeholder" aria-hidden="true">${defaults.filter(l=>!group.some(x=>x.label===l))[i]||defaults[0]}</span>`).join('');
  pages+=`<div class="ku-folder-page" aria-hidden="${page!==folderPage}" ${page!==folderPage?'inert':''}><span class="ku-folder-selection" style="transform:translateX(${Math.max(0,selected)*100}%);opacity:${selected<0?0:1}"></span>${content}${fillers}</div>`;
 }
 return `<div class="ku-folders"><div class="ku-folder-items" tabindex="0" role="group" aria-label="${E(t('allChats'))}" data-pages="${count}"><div class="ku-folder-track" style="transform:translateX(-${folderPage*100}%)">${pages}</div></div>${button(E(t('newFolder')),'new-folder','ku-new-folder')}</div>`;
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
function rootFor(id){const screen=document.getElementById(id);if(!screen)return;let view=$('.ku-view',screen);if(!view){view=document.createElement('section');view.className='ku-view';view.dataset.page=id;view.addEventListener('click',onClick);view.addEventListener('contextmenu',onContext);screen.appendChild(view);}view.lang=uiLanguage;if(!screen.classList.contains('ku-mounted'))screen.classList.add('ku-mounted');return view;}
function openChat(id,type){const c=(type==='group'?groups():people()).find(c=>c.id===id);if(!c)return;currentChatId=id;currentChatType=type||'private';if(typeof updateCustomBubbleStyle==='function')updateCustomBubbleStyle(id,c.customBubbleCss,c.useCustomBubbleCss);openChatRoom(id,currentChatType);}
function renderChats(){const root=rootFor(IDS[0]);if(!root)return;const oldFolders=$('.ku-folders',root),chatScroll=$('.ku-chat-scroll',root)?.scrollTop||0;const tabs=[...document.querySelectorAll('#chat-category-tabs > .tab-item')];const rows=[...document.querySelectorAll('#chat-list-container > .chat-item')];let html=header(E(t('chatsTitle')),'chats');
html+=folderMarkup(tabs);
html+=`<div class="ku-recent">${people().slice(0,4).map(c=>button(avatar(c.avatar)+`<span>${E(nameOf(c))}</span>`,'chat:'+c.id,'ku-person')).join('')}${button(`<span class="ku-add-avatar">${icon('add')}</span><span>${E(t('add'))}</span>`,'add','ku-person')}</div><div class="ku-chat-scroll">`;
const sections=[['pin',E(t('pinned')),rows.filter(x=>x.classList.contains('pinned'))],['all',E(t('allChats')),rows.filter(x=>!x.classList.contains('pinned'))]];
for(const [key,title,list] of sections){if(!list.length)continue;html+=`<section class="ku-chat-section">${button(`<span>${title} <small>${list.length}</small></span>${icon('down')}`,'collapse:'+key,'ku-section-label'+(collapsed.has(key)?' collapsed':''))}<div class="ku-chat-card" ${collapsed.has(key)?'hidden':''}>${list.map(x=>{const id=x.dataset.id,type=x.dataset.type;return button(avatar($('.chat-avatar',x)?.getAttribute('src'))+`<div class="ku-chat-text"><strong>${E($('.item-name',x)?.textContent)}</strong><p>${E($('.item-preview',x)?.textContent)}</p></div><div class="ku-chat-meta"><time>${E($('.item-time',x)?.textContent)}</time>${$('.unread-badge.visible',x)?`<b>${E($('.unread-badge',x).textContent)}</b>`:''}</div>`,`chat:${id}:${type}`,'ku-chat-row');}).join('')}</div></section>`;}
if(!rows.length)html+=`<div class="ku-empty">${E(t('emptyChats'))}</div>`;
root.innerHTML=html+'</div>';retainFolders(root,oldFolders);$('.ku-chat-scroll',root).scrollTop=chatScroll;}
function menuPersona(){const d=typeof db!=='undefined'?db:{};let p=(d.myPersonaPresets||[]).find(p=>p.id===d.activePersonaId)||(d.myPersonaPresets||[])[0];return {name:p?.name||people()[0]?.myName||'User',avatar:p?.avatar||people()[0]?.myAvatar||$('#more-my-avatar')?.getAttribute('src')};}
function menuSettings(){return activeSelfPersona()?.kissMenuCard||db.kissMenuCard||{};}
function renderMenu(){const root=rootFor(IDS[2]);if(!root)return;const p=menuPersona(),d=menuSettings();const tools=[['panel',0,'status-bar'],['loops',1,'cot-settings'],['calendar',2,'calendar'],['star',3,'star'],['palette',4,'drawing-workshop']];root.innerHTML=header(E(t('menuTitle')),'menu')+`<div class="ku-menu-scroll"><div class="ku-menu-profile">${button(avatar(d.avatar||p.avatar),'menuedit','ku-profile-link')}<div><strong>${E(p.name)} ${check}</strong><p>${E(d.subtitle??t('menuSubtitle'))}</p><p>${E(d.description??t('menuDescription'))}</p></div></div><p class="ku-menu-copy">${E(d.text??t('menuText'))}</p><div class="ku-photos" aria-label="${E(t('scenes'))}">${[0,1,2].map(i=>d.images?.[i]?`<img src="${safeURL(d.images[i])}" alt="${E(t('scenes'))} ${i+1}" loading="lazy">`:`<span class="ku-scene-${i}" role="img" aria-label="${E(t('scenes'))} ${i+1}"></span>`).join('')}</div><p class="ku-photo-caption">${icon('heart')}${E(d.caption??t('menuCaption'))}</p>${button(`${icon('search')}<span>${E(t('search'))}</span>`,'search','ku-search')}<div class="ku-tools">${tools.map(([i,l,a])=>button(`${icon(i)}<span>${E(UI_COPY[uiLanguage].tools[l])}</span>${icon('arrow','ku-chevron')}`,'tool:'+a,'ku-tool')).join('')}</div><p class="ku-menu-foot">${E(d.footer??t('menuFooter'))}</p></div>`;}
function editMenu(){
 const owner=activeSelfPersona()||db,d=menuSettings();
 const fields=[['avatar','本页头像链接（留空使用资料头像）'],['subtitle','名字下第一行'],['description','名字下第二行'],['caption','图片下方文案'],['footer','底部文案']];
 const overlay=openSheet('菜单页展示设置',`<form class="ku-display-form">${fields.map(([key,label])=>`<label>${label}<input name="${key}" value="${E(d[key]??({subtitle:t('menuSubtitle'),description:t('menuDescription'),caption:t('menuCaption'),footer:t('menuFooter')}[key]||''))}" maxlength="${key==='avatar'?2000:300}"></label>`).join('')}<label>图片上方正文<textarea name="text" rows="3" maxlength="2000">${E(d.text??t('menuText'))}</textarea></label><fieldset class="ku-field-group"><legend>三张图片（留空使用原风景图）</legend>${[0,1,2].map(i=>`<label>图片 ${i+1} 链接<input name="menu_image_${i}" value="${E(d.images?.[i]||'')}" maxlength="2000" inputmode="url"></label>`).join('')}</fieldset><button type="submit">保存</button></form>`);
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
 return people().map((c,index)=>({c,index,status:true,latestChat:latestChatTime(c),m:{id:'status',content:String(c.status||'').trim()||({ja:'ステータス未設定',en:'A quiet moment.',zh:'今天的心情，留待慢慢说。',ko:'아직 꺼내지 않은 오늘의 마음.'}[uiLanguage]),timestamp:statusTime(c),likes:c.kissStatusLikes||[],comments:c.kissStatusComments||[]}})).sort((a,b)=>{
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
 return `<div class="ku-music${playing?' is-playing':''}">${cover?`<img src="${safeURL(cover)}" alt="" loading="lazy">`:`<span class="ku-music-disc">♪</span>`}<div><strong>${E(song.title||song.name||t('song'))}</strong><small>${E(song.artist||song.singer||(song.empty?t('pickSong'):''))}</small></div><svg class="ku-wave" viewBox="0 0 65 30" aria-hidden="true"><path d="M3 12v6m5-12v18m5-21v24m5-18v12m5-15v18m5-24v30m5-25v20m5-17v14m5-20v26m5-20v14m5-11v8m5-7v6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>${button(playing?'<span class="ku-pause">Ⅱ</span>':icon('play'),(playable?'audio:':'musicedit:')+key,'ku-play')}</div>`;
}
function extraDisplayFields(d,own=false){
 const attr=(key)=>own?`data-own-field="${key}"`:`name="${key}"`;
 return `<label>可见性标签（仅样式）<select ${attr('visibility')}><option value="public" ${d.visibility!=='private'?'selected':''}>公开</option><option value="private" ${d.visibility==='private'?'selected':''}>个人可见</option></select></label><fieldset class="ku-field-group"><legend>音乐设置</legend><label class="ku-checkbox-row"><input type="checkbox" ${attr('music_enabled')} ${d.music?.enabled!==false?'checked':''}>显示音乐栏</label>${[['title','歌名'],['artist','歌手'],['cover','封面图片链接'],['url','可播放的音频直链']].map(([key,label])=>`<label>${label}<input ${attr('music_'+key)} value="${E(d.music?.[key]||'')}" maxlength="${['url','cover'].includes(key)?2000:150}" ${['url','cover'].includes(key)?'inputmode="url"':''}></label>`).join('')}</fieldset><fieldset class="ku-field-group"><legend>自定义显示数字</legend>${COUNT_FIELDS.map(([key,label])=>`<label>${label}<input ${attr('count_'+key)} value="${E(d.counts?.[key]??'')}" maxlength="16" placeholder="留空显示实际数量 / 128 / 2.1k"></label>`).join('')}</fieldset>${own?'':`<label>卡片样式<select name="layout">${CARD_LAYOUTS.map(([id,label])=>`<option value="${id}" ${(d.layout||'auto')===id?'selected':''}>${label}</option>`).join('')}</select></label>${photoFields(d)}<label>卡片补充文字<input name="caption" value="${E(d.caption||'')}" maxlength="300"></label>`}`;
}
function photoFields(d){const n=Math.max(1,Math.min(4,Number(d.imageCount)||(d.images?.length)||3));return `<fieldset class="ku-field-group"><legend>图文配图</legend><label>图片数量<select name="imageCount">${[1,2,3,4].map(i=>`<option value="${i}" ${i===n?'selected':''}>${i} 张</option>`).join('')}</select></label><div data-image-fields>${Array.from({length:n},(_,i)=>`<label>图片 ${i+1} 链接<input name="image_${i}" value="${E(d.images?.[i]||(i===0?d.image:'')||'')}" maxlength="2000" inputmode="url"></label>`).join('')}</div></fieldset>`;}
function updateDisplayValue(d,key,value){
 if(key.startsWith('image_')){d.images=[...(d.images||[])];d.images[Number(key.slice(6))]=String(value).trim();}
 else if(key==='imageCount')d.imageCount=Number(value);
 else if(key.startsWith('music_')){d.music={...(d.music||{}),[key.slice(6)]:value};}
 else if(key.startsWith('count_')){d.counts={...(d.counts||{}),[key.slice(6)]:String(value).trim()};}
 else d[key]=value;
}
function stopMusic(){if(playingAudio){playingAudio.pause();playingAudio=null;}for(const row of document.querySelectorAll('.ku-music.is-playing')){row.classList.remove('is-playing');const b=row.querySelector('.ku-play');if(b){b.innerHTML=icon('play');b.setAttribute('aria-label',t('play'));}}}
function swipeComment(content,action,cls=''){return `<div class="ku-comment-swipe ${cls}" tabindex="0" role="group" aria-label="评论操作，左滑或按左方向键显示删除">${button(icon('trash')+'<span>删除</span>',action,'ku-comment-delete')}<div class="ku-comment-track">${content}</div></div>`;}
function commentMarkup(c,x,thread=false,key=''){const a=people().find(p=>[p.realName,p.remarkName].includes(x.author));const content=`<div class="ku-comment">${avatar(a?.avatar||c.myAvatar)}<div><strong>${E(x.author)} ${check}</strong><span>${x.replyTo?E(t('replyTo',{name:x.replyTo})):''}${E(x.content)}</span>${thread?`<time>${E(when(x.timestamp))}</time>`:''}</div>${!thread&&x.timestamp?`<time>${E(when(x.timestamp))}</time>`:''}${typeof x.likes==='number'?`<span class="ku-reply-likes">${icon('heart')}${x.likes}</span>`:''}</div>`;if(!key)return content;const token='c'+(++commentSeq);commentRefs.set(token,{key,comment:x});return swipeComment(content,'delete-comment:'+token);}
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
 const stamp=m.timestamp?when(m.timestamp):(status&&!self?t('status'):when(selfViewedAt).slice(0,5)+' · '+t('note'));
 const ownNote=self?(d.note??t('menuFooter')):'';
 const text=String(m.content||''),title=String(m.author||nameOf(c));
 const handle=meta.handle||nameOf(c).replace(/\s+/g,'');
 const source=status&&!self?`<span> · </span><span class="ku-blue">${E(t('statusSource'))}</span>`:`<span> · </span><span class="ku-blue">${E(t('fromDevice',{device:meta.device||'Kiss'}))}</span>`;
 const isPrivate=d.visibility==='private';
 const place=icon(isPrivate?'lock':'pin')+`<span>${meta.location?E(meta.location)+' · ':''}${isPrivate?t('private'):t('public')}</span>`;
 const displayTranslation=translatedPosts.has(key);
 const translationValue=status&&!self?(d.statusTranslation||c.statusTranslation||''):(d.translation||m.translation||m.translatedContent||'');
 const textHTML=(displayTranslation?String(translationValue||text):text)?E(displayTranslation?String(translationValue||text):text).split(/\n{2,}/).map(p=>`<span class="ku-paragraph">${p}</span>`).join(''):`<span class="ku-unwritten">${E(t('emptyPost'))}</span>`;
 const views=Number(m.views||m.viewCount)||0,reposts=Array.isArray(m.reposts)?m.reposts.length:Number(m.repostCount)||0;
 const actualPictures=Array.isArray(m.images)?m.images.map(x=>typeof x==='string'?x:x.url):[];
 const configuredPictures=d.images?.some(Boolean)?d.images:d.image?[d.image]:null;
 const pictures=layout==='photo'?(configuredPictures||actualPictures.length&&actualPictures||[]):actualPictures;
 const imageCount=layout==='photo'?Math.max(1,Math.min(4,Number(d.imageCount)||pictures.length||3)):Math.min(4,pictures.length);
 const imageHTML=imageCount?`<div class="ku-post-images" data-image-count="${imageCount}">${Array.from({length:imageCount},(_,i)=>{const src=pictures[i];return src?`<img src="${safeURL(src)}" alt="${E(t('photo'))} ${i+1}" loading="lazy">`:`<span class="ku-image-placeholder" aria-label="未设置图片">${icon('panel')}</span>`;}).join('')}</div>`:'';
 const replyPrompt=thread&&!comments.length?`<div class="ku-thread-comments ku-reply-prompt">${avatar(c.myAvatar)}${button(E(t('reply')),'comment:'+key)}</div>`:'';
 return `<article class="ku-post ku-layout-${layout}${self?' ku-own-post':''}${thread?' ku-thread-post':''}${quote?' ku-quote-post':''}" data-post="${E(key)}"><div class="ku-post-top">${button(avatar(c.avatar),self?'self':'profile:'+c.id,'ku-post-avatar')}<div class="ku-byline"><div class="ku-name-line"><strong>${E(title)} ${check}</strong><span class="ku-handle">@${E(String(handle).replace(/^@/,''))}</span></div><div class="ku-post-meta"><time>${E(stamp)}</time>${source}</div><div class="ku-post-place">${place}</div></div>${button('···',self?'self':'postmenu:'+key,'ku-dots')}</div><div class="ku-post-body"><div class="ku-content-layout">${imageHTML}<div class="ku-content-copy"><p class="ku-post-text">${textHTML}</p>${d.caption?`<p class="ku-card-caption">${E(d.caption)}</p>`:''}</div></div>${m.imageDescription?`<p class="ku-image-description">${E(m.imageDescription)}</p>`:''}${text?button(displayTranslation?E(t('original')):E(t('translation')),'translation:'+key,'ku-text-link'):''}${renderMusic(m,key)}<div class="ku-post-actions">${button(icon('comment')+`<span>${countLabel(d,'comments',comments.length)}</span>`,'comment:'+key)}${button(icon('repeat')+`<span>${countLabel(d,'reposts',reposts)}</span>`,'share:'+key)}${button(icon('heart')+`<span>${countLabel(d,'likes',likes.length)}</span>`,'like:'+key,likes.includes(c.myName||'我')?'is-liked':'')}<span class="ku-views" aria-label="${E(t('views'))}">${icon('views')}<span>${countLabel(d,'views',views)}</span></span>${button(icon('book'),'bookmark:'+key,saved?'is-saved':'')}</div></div>${self&&ownNote?swipeComment(`<div class="ku-own-note ku-comments">${avatar(c.avatar)}<strong>${E(c.realName)} ${check}</strong><span>${E(ownNote)}</span><time>${E(when(m.timestamp))}</time></div>`,'delete-note:'+key,'ku-own-note-swipe'):''}${comments.length?`<div class="${thread?'ku-thread-comments':'ku-comments'}">${comments.slice(0,thread?3:1).map(x=>commentMarkup(c,x,thread,key)).join('')}</div>`:replyPrompt}</article>`;
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
 const m={id:'profile',author:p.name,content:typeof stored.text==='string'?stored.text:defaultSelfText(),timestamp:stored.updatedAt||selfViewedAt,device:stored.device||ownCardDevice(),location:stored.location||'',translation:stored.translation||(typeof stored.text==='string'?'':defaultSelfTranslation()),likes:c.kissStatusLikes,comments:c.kissStatusComments};
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
 editor.innerHTML=`<summary>好友页展示卡片</summary><div class="ku-profile-card-fields"><label>显示账号<input data-own-field="handle" value="${E(d.handle||p.handle||'my.days')}" maxlength="80"></label><label>设备型号<input data-own-field="device" value="${E(d.device||ownCardDevice())}" maxlength="80"></label><label>发布地点<input data-own-field="location" value="${E(d.location||'')}" maxlength="80"></label><label>卡片正文<textarea data-own-field="text" rows="5" maxlength="5000">${E(typeof d.text==='string'?d.text:defaultSelfText())}</textarea></label><label>翻译内容<textarea data-own-field="translation" rows="3" maxlength="5000">${E(d.translation||(typeof d.text==='string'?'':defaultSelfTranslation()))}</textarea></label><label>底部留言<input data-own-field="note" value="${E(d.note??t('menuFooter'))}" maxlength="200"></label>${extraDisplayFields(d,true)}</div>`;
 editor.oninput=e=>{const key=e.target.dataset.ownField;if(!key)return;if(!p.kissFriendsCard)p.kissFriendsCard={};updateDisplayValue(p.kissFriendsCard,key,e.target.type==='checkbox'?e.target.checked:e.target.value);p.kissFriendsCard.updatedAt=Date.now();};
}
function renderFriends(){
 const root=rootFor(IDS[1]);if(!root)return;
 const scroll=$('.ku-friend-scroll',root)?.scrollTop||0;
 let feed=friendEntries();if(currentTab==='favorites')feed=feed.filter(({c})=>(c.kissFriendsSaved||[]).includes('status')||c.isPinned);
 postData.clear();commentRefs.clear();
 root.innerHTML=header(E(t('friendsTitle')),'friends')+`<div class="ku-friend-tabs">${[['all',t('all')],['friends',t('friendsTab')],['favorites',t('favoritesTab')]].map(([id,t])=>button(t,'tab:'+id,currentTab===id?'active':'')).join('')}${button(E(t('sort'))+icon('down'),'friend-sort','ku-friend-sort')}</div><div class="ku-friend-scroll">${selfProfileCard()}${feed.slice(0,feedLimit).map((entry,index)=>postMarkup(entry,index+1)).join('')||`<p class="ku-empty">${E(t('emptyFriends'))}</p>`}${feed.length>feedLimit?button(E(t('more')),'more-feed','ku-load-more'):''}</div>`;
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
  try{await audio.play();if(playingAudio!==audio){audio.pause();return;}b.innerHTML='<span class="ku-pause">Ⅱ</span>';b.setAttribute('aria-label',t('pause'));b.closest('.ku-music')?.classList.add('is-playing');}catch{if(playingAudio===audio){stopMusic();showToast('播放失败，请检查音频链接是否可以直接播放。');}}return;
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
if(action==='language'){cycleUiLanguage();return;}
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
function sync(){frame=0;if(externalCss()){restore();return;}document.documentElement.classList.add('ku-mode');const momentsActive=!!document.querySelector('#kiss-moments-feed.active');const active=IDS.find(id=>document.getElementById(id)?.classList.contains('active'));document.documentElement.classList.toggle('ku-nav-active',!!active||momentsActive);if(active!==IDS[1]&&playingAudio)stopMusic();if(!active)return;try{if(active===IDS[0])renderChats();else if(active===IDS[1])renderFriends();else renderMenu();}catch(error){console.error('[KISS pages]',error);restore();}}
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
function closeCommentSwipes(except){for(const el of document.querySelectorAll('.ku-comment-swipe.is-open'))if(el!==except){el.classList.remove('is-open');const focused=document.activeElement;if(focused?.classList.contains('ku-comment-delete')&&el.contains(focused))focused.blur();}}
document.addEventListener('pointerdown',e=>{const el=e.target.closest('.ku-comment-swipe');if(!el){closeCommentSwipes();return;}if(e.target.closest('.ku-comment-delete')||e.button!==0)return;commentDrag={el,id:e.pointerId,x:e.clientX,y:e.clientY,base:el.classList.contains('is-open')?-68:0,dx:0,locked:false};},{passive:true});
document.addEventListener('pointermove',e=>{const d=commentDrag;if(!d||e.pointerId!==d.id)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(!d.locked){if(Math.abs(dy)>8&&Math.abs(dy)>Math.abs(dx)){closeCommentSwipes();commentDrag=null;return;}if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.2)return;d.locked=true;closeCommentSwipes(d.el);d.el.classList.add('is-dragging');try{d.el.setPointerCapture?.(e.pointerId);}catch{}}if(e.cancelable)e.preventDefault();d.dx=dx;d.el.querySelector('.ku-comment-track').style.transform=`translateX(${Math.max(-68,Math.min(0,d.base+dx))}px)`;},{passive:false});
function finishCommentSwipe(e){const d=commentDrag;if(!d||e.pointerId!==d.id)return;commentDrag=null;d.el.classList.remove('is-dragging');d.el.querySelector('.ku-comment-track').style.transform='';if(d.locked){d.el.classList.toggle('is-open',e.type!=='pointercancel'&&d.base+d.dx < -24);d.el.dataset.swipedUntil=String(Date.now()+500);}}
for(const name of ['pointerup','pointercancel'])document.addEventListener(name,finishCommentSwipe,{passive:true});
document.addEventListener('click',e=>{const el=e.target.closest('.ku-comment-swipe');if(el&&Number(el.dataset.swipedUntil)>Date.now()&&!e.target.closest('.ku-comment-delete')){e.preventDefault();e.stopPropagation();return;}if(!el)closeCommentSwipes();},true);
document.addEventListener('wheel',()=>closeCommentSwipes(),{passive:true});
document.addEventListener('keydown',e=>{const el=e.target.closest('.ku-comment-swipe');if(el&&e.key==='ArrowLeft'){e.preventDefault();closeCommentSwipes(el);el.classList.add('is-open');el.querySelector('.ku-comment-delete')?.focus();}else if(el&&e.key==='ArrowRight'){e.preventDefault();closeCommentSwipes();el.focus();}else if(e.key==='Escape')closeCommentSwipes();});
window.KissPagesUI={refresh:schedule,hasCustomCss:externalCss,clearLegacyDynamics};schedule();
})();
