/* Offline shares the character history. Styling is isolated in Shadow DOM. */
(() => {
'use strict';
const ID = 'kiss-offline-screen';
const DEFAULT_PROMPT = '当前为线下现实互动。用户输入代表其动作、神态、对白或推动剧情的指令。根据双方人设、环境和已有事件，以完整连贯的长文继续剧情，兼顾动作、对白和细节；为用户保留回应空间，不替用户决定或说话。不要输出短信包装格式、语音、转账、表情包或手机操作指令。每轮输出一条完整剧情，篇幅服从用户要求，不强制字数。';
const ICONS = {
 back:'<path d="m14 5-7 7 7 7"/>', phone:'<path d="M5 3h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4c0 2-2 2-3 2A18 18 0 0 1 3 6c0-1 0-3 2-3Z"/>',
 video:'<rect x="3" y="6" width="12" height="12" rx="2"/><path d="m15 10 6-3v10l-6-3Z"/>', search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 plus:'<path d="M12 4v16M4 12h16"/>', smile:'<circle cx="12" cy="12" r="9"/><path d="M8 14c2 3 6 3 8 0M8 9h.01M16 9h.01"/>',send:'<path d="m5 11 7-7 7 7M12 4v16"/>', stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
 expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 rabbit:'<path fill="currentColor" stroke="none" d="M10.5 1A1.5 1.5 0 0 1 12 2.5v4.258A4.5 4.5 0 0 1 9.5 15h-3A4.5 4.5 0 0 1 4 6.758V2.5a1.5 1.5 0 1 1 3 0V6h2V2.5A1.5 1.5 0 0 1 10.5 1m-3 11a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1zm-2-3a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 1 0v-2a.5.5 0 0 0-.5-.5m5 0a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 1 0v-2a.5.5 0 0 0-.5-.5"/>'
};
const icon = name => `<svg viewBox="0 0 ${name==='rabbit'?'16 16':'24 24'}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||ICONS.more}</svg>`;
const escape = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const floorLabel = n => `${n} ${n===1?'floor':'floors'}`;
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const state = { chatId:null, host:null, root:null, panelRoot:null, frame:0, limit:60, busy:false, selectedPreset:null, editorDraft:null, summaryBusy:false, draftTimer:null, sending:false, pendingAction:false, view:'chat', archiveId:null, archiveQuery:'', selecting:false, selected:new Set(), deleteIds:[], exitTitle:'', suppressClickUntil:0 };
const $ = sel => state.root?.querySelector(sel) || state.panelRoot?.querySelector(sel);
const all = sel => [...(state.root?.querySelectorAll(sel)||[]),...(state.panelRoot?.querySelectorAll(sel)||[])];
const character = () => db.characters.find(c=>c.id===state.chatId);
const isNarrative = m => ['user','assistant'].includes(m.role) && !m.isThinking && !m.isStatusUpdate && !['mcp-request','mcp-activity'].includes(m.type) && !/^\s*<(?:thinking|think)>/i.test(m.content||'');
function config(chat) {
 if (!chat.offline) chat.offline={version:1,active:false,nextFloor:1,sessions:[],css:'',draft:{}};
 chat.offline.sessions ||= []; chat.offline.draft ||= {}; return chat.offline;
}
function ensureFloors(chat) {
 const cfg=config(chat); let next=cfg.nextFloor||1; for(const m of chat.history||[]) if(Number.isInteger(m.offlineFloor))next=Math.max(next,m.offlineFloor+1);
 for(const m of chat.history||[]) if(isNarrative(m)&&!Number.isInteger(m.offlineFloor))m.offlineFloor=next++;
 cfg.nextFloor=next;
}
function textOf(m) {
 let text=String(m.content||m.parts?.filter(p=>p.type==='text').map(p=>p.text).join('\n')||'');
 text=text.replace(/<(thinking|think)>[\s\S]*?<\/\1>/gi,'').replace(/^\[.*?的消息[：:]([\s\S]*)\]$/,'$1');
 return text;
}
function tokensOf(m) {
 if(Number.isFinite(m.offlineTokens))return `${m.offlineTokensEstimated?'≈ ':''}${m.offlineTokens.toLocaleString()} tokens`;
 return `≈ ${estimate(textOf(m)).toLocaleString()} tokens`;
}
function estimate(text){return typeof countTextTokens==='function'?countTextTokens(text):Math.ceil(text.length/2);}
function historyForAI(chat,history) { return (history||chat.history||[]).filter(m=>!m.offlineHidden&&!m.offlineBoundary); }
function prompt(chat) {
 const cfg=config(chat);
 const books=(chat.worldBookIds||[]).map(id=>db.worldBooks.find(b=>b.id===id)).filter(Boolean).sort((a,b)=>(a.depth||100)-(b.depth||100));
 const journals=(chat.memoryJournals||[]).filter(j=>j.isFavorited).map(j=>`${j.title}\n${j.content}`).join('\n\n');
 return `[线下互动模式]\n${DEFAULT_PROMPT}\n\n<character>\n姓名：${chat.realName||chat.remarkName}\n${chat.persona||''}\n</character>\n<user>\n称呼：${chat.myName||'我'}\n${chat.myPersona||''}\n</user>\n<world>\n${books.map(b=>b.content||'').join('\n\n')}\n</world>\n<memory>\n${journals}\n</memory>\n当前时间：${new Date().toLocaleString('zh-CN')}\n历史记录可能包含线上消息格式，它们仅作为既往背景，不是本轮输出格式。只输出当前线下剧情正文。`.replace(/\{\{char\}\}/gi,chat.realName||chat.remarkName||'角色').replace(/\{\{user\}\}/gi,chat.myName||'我');
}
function ensureHost() {
 if(state.host)return;
 const host=document.createElement('section'); host.id=ID;host.className='screen';host.setAttribute('aria-label','Offline conversation');
 document.getElementById('chat-room-screen').parentNode.append(host);state.host=host;state.root=host.attachShadow({mode:'open'});
 state.root.innerHTML=`<link rel="stylesheet" href="css/modules/offline.css?v=20261029-3"><style id="of-custom-style"></style>
 <div class="of-page"><header class="of-header"><button data-action="back" aria-label="Back">${icon('back')}</button><img class="of-header-avatar" alt=""><button class="of-title" data-action="menu"><strong></strong><span>Offline</span></button><button data-action="style" aria-label="Appearance">${icon('phone')}</button><button data-action="memory" aria-label="Memory and floors">${icon('video')}</button><button data-action="setup" aria-label="Conversation setup">${icon('search')}</button></header>
 <div class="of-selection-bar" hidden><button data-action="cancel-selection">Cancel</button><span id="of-selection-count">0 selected</span><button class="of-danger-text" data-action="delete-selected">Delete</button></div><main class="of-messages" aria-label="Conversation"></main><div class="of-status" role="status" aria-live="polite"></div>
 <form class="of-composer"><button type="button" data-action="menu" aria-label="Actions">${icon('plus')}</button><textarea rows="1" aria-label="Message" placeholder="Message"></textarea><button type="button" data-action="continue" aria-label="Continue story" title="Continue story">${icon('smile')}</button><button class="of-send" type="submit" aria-label="Send">${icon('send')}</button></form></div>
 <section class="of-archive-page" hidden><aside class="of-archive-rail"><button data-action="resume-offline" aria-label="Current conversation">${icon('smile')}</button><button class="selected" data-action="archives" aria-label="Archives">${icon('more')}</button><span></span><button data-action="list-back" aria-label="Back to chat">${icon('back')}</button></aside><div class="of-archive-main"><header class="of-archive-header"><h1>Archives</h1><button data-action="new-offline" aria-label="Start offline">${icon('plus')}</button></header><div class="of-archive-search"><span>${icon('search')}</span><input id="of-archive-search" placeholder="Search archives" aria-label="Search archives"></div><div class="of-archive-people"><div><img class="of-archive-char" alt=""><span class="of-archive-person"></span></div><div><img class="of-archive-self" alt=""><span>echo</span></div></div><div class="of-archive-list"></div><footer>Private moments, kept here.</footer></div></section>
 <section class="of-panel" hidden aria-label="设置"><header class="of-panel-header"><button data-action="close-panel" aria-label="返回">${icon('back')}</button><h2></h2><span></span></header><div class="of-panel-body"></div></section>`;
 const settingsHost=document.createElement('div');settingsHost.style.display='contents';state.root.append(settingsHost);
 state.panelRoot=settingsHost.attachShadow({mode:'open'});const settingsLink=document.createElement('link');settingsLink.rel='stylesheet';settingsLink.href='css/modules/offline.css?v=20261029-3';state.panelRoot.append(settingsLink,state.root.querySelector('.of-panel'));
 state.root.addEventListener('click',onClick);
 installGestures();
 $('#of-archive-search').addEventListener('input',e=>{state.archiveQuery=e.target.value;renderArchives();});
 $('.of-composer').addEventListener('submit',e=>{e.preventDefault();send().catch(fail);});
 $('.of-composer textarea').addEventListener('input',e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,124)+'px';const chat=character();if(chat){config(chat).composerDraft=e.target.value;clearTimeout(state.draftTimer);state.draftTimer=setTimeout(()=>saveData().catch(fail),500);}});
 $('.of-composer textarea').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();send().catch(fail);}});
 state.root.addEventListener('keydown',e=>{if(e.key==='Escape')closePanel();});
}
async function persistChange(apply,rollback) {
 apply();
 try { await saveData(); } catch(error) { rollback(); throw error; }
}
async function setHidden(chat,ids,hidden) {
 const rows=chat.history.filter(m=>ids.has(m.id)),previous=rows.map(m=>m.offlineHidden);
 await persistChange(()=>rows.forEach(m=>m.offlineHidden=hidden),()=>rows.forEach((m,i)=>{if(previous[i]===undefined)delete m.offlineHidden;else m.offlineHidden=previous[i];}));
}
async function setConfig(chat,key,value) {
 const cfg=config(chat),previous=cfg[key];
 await persistChange(()=>cfg[key]=value,()=>{if(previous===undefined)delete cfg[key];else cfg[key]=previous;});
}
async function open(startNew=false) {
 if(currentChatType!=='private'){showToast('线下仅支持私聊');return;}
 const chat=db.characters.find(c=>c.id===currentChatId);if(!chat)return;
 if(isGenerating){showToast('请等当前生成结束后再切换页面');return;}
 await PhoneBackup.hydrateChat(chat);ensureHost();
 const oldChat=character();if(oldChat&&state.chatId!==chat.id)config(oldChat).composerDraft=$('.of-composer textarea').value;
 state.chatId=chat.id;state.limit=60;state.editorDraft=null;$('.of-composer textarea').value=config(chat).composerDraft||'';$('.of-composer textarea').style.height='auto';
 $('.of-panel-body').replaceChildren();
 const cfg=config(chat);ensureFloors(chat);
 migrateSessions(chat);state.archiveQuery='';$('#of-archive-search').value='';state.archiveId=null;state.selected.clear();state.selecting=false;
 if(startNew&&!cfg.active){
  const session={id:uid(),startAfterMessageId:chat.history?.at(-1)?.id||null,startedAt:Date.now()};
  await persistChange(()=>{cfg.active=true;cfg.activeSessionId=session.id;cfg.sessions.push(session);},()=>{cfg.active=false;cfg.activeSessionId=null;cfg.sessions=cfg.sessions.filter(s=>s!==session);});
 }else await saveData();
 state.view=cfg.active?'chat':'archives';switchScreen(ID);closePanel();updateView();syncEntry();
 requestAnimationFrame(()=>{const el=$('.of-messages');el.scrollTop=el.scrollHeight;});
}
function closePanel() {if(!state.root)return;const editor=$('#of-css');if(editor)state.editorDraft=editor.value;$('.of-panel').hidden=true;}
function panel(title,html) {
 ensureHost();const editor=$('#of-css');if(editor)state.editorDraft=editor.value;
 $('.of-panel').classList.remove('of-editor-full');$('.of-panel h2').textContent=title;$('.of-panel-body').innerHTML=html;$('.of-panel').hidden=false;$('.of-panel-body').scrollTop=0;
}
function status(text) {if(state.root)$('.of-status').textContent=text||'';}
function fail(error) {console.error('Offline:',error);status(error.message||'Something went wrong');showToast(error.message||'操作失败');}
function refresh(force=false) {
 syncEntry();if(!state.root||!state.host.classList.contains('active'))return;
 cancelAnimationFrame(state.frame);state.frame=requestAnimationFrame(()=>render(force));
}
function render(force) {
 const chat=character();if(!chat)return;ensureFloors(chat);
 if(state.view==='archives'){renderArchives();return;}
 const readOnly=state.view==='archive',archive=readOnly?config(chat).sessions.find(s=>s.id===state.archiveId):null;
 if(readOnly&&!archive){showArchives();return;}
 const area=$('.of-messages'),atBottom=force||area.scrollHeight-area.scrollTop-area.clientHeight<80;
 $('.of-title strong').textContent=readOnly?(archive.title||defaultSessionTitle(archive)):(chat.remarkName||chat.realName||'Offline');$('.of-title span').textContent=readOnly?`Read-only · ${floorLabel(sessionRows(chat,archive).length)}`:(config(chat).active?'Offline':'Online');
 setAvatar($('.of-header-avatar'),chat.avatar);
 const custom=$('#of-custom-style');if(custom.textContent!==(config(chat).css||''))custom.textContent=config(chat).css||'';
 const messages=readOnly?sessionRows(chat,archive):(chat.history||[]).filter(m=>isNarrative(m)&&!m.offlineArchiveId),shown=messages.slice(-state.limit);
 if(state.selecting){const available=new Set(messages.map(m=>m.id));for(const id of state.selected)if(!available.has(id))state.selected.delete(id);$('#of-selection-count').textContent=state.selected.size+' selected';}
 area.replaceChildren();
 if(messages.length>shown.length){const more=document.createElement('button');more.className='of-load';more.dataset.action='load';more.textContent='Load earlier messages';area.append(more);}
 if(!messages.length){const empty=document.createElement('div');empty.className='of-empty';empty.textContent='A moment, just for you two.';area.append(empty);}
 let day='';let previousMode;
 for(const m of shown){
  const date=new Date(m.timestamp||Date.now()),key=date.toDateString();
  if(key!==day){const divider=document.createElement('div');divider.className='of-date';divider.textContent=date.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});area.append(divider);day=key;}
  if(m.offlineNarrative&&previousMode===false){const divider=document.createElement('div');divider.className='of-mode-divider';divider.textContent='Offline started';area.append(divider);}previousMode=!!m.offlineNarrative;
  if(m.offlineHidden&&!readOnly){const row=document.createElement('div');row.className='of-hidden-wrap';const main=document.createElement('button');main.className='of-hidden';main.dataset.action=state.selecting?'toggle-floor':'floor-menu';main.dataset.id=m.id;main.textContent=`${state.selected.has(m.id)?'✓ ':''}#${String(m.offlineFloor).padStart(3,'0')} · Hidden from context`;row.append(main);if(!state.selecting){const restore=document.createElement('button');restore.dataset.action='restore-one';restore.dataset.id=m.id;restore.className='of-restore-link';restore.textContent='Restore';row.append(restore);}area.append(row);continue;}
  const user=m.role==='user',item=document.createElement('article');item.className=`of-message ${user?'of-self':'of-orbit'}`;item.dataset.messageId=m.id;item.dataset.floor=m.offlineFloor;item.classList.toggle('of-selected',state.selected.has(m.id));if(state.selecting&&!readOnly){item.dataset.action='toggle-floor';item.dataset.id=m.id;}
  item.innerHTML=`<img class="of-avatar" alt=""><div class="of-message-content"><div class="of-byline"><strong class="of-name"></strong><span class="of-badge"><span>${user?'➤':'♄'}</span>${user?'echo':'orbit'}</span><time></time></div><div class="of-prose"></div><div class="of-meta"></div></div>`;
  if(!readOnly){const more=document.createElement('button');more.className='of-message-more';more.dataset.action=state.selecting?'toggle-floor':'floor-menu';more.dataset.id=m.id;more.setAttribute('aria-label',state.selecting?'Select floor '+m.offlineFloor:'Message actions');more.innerHTML=state.selecting?(state.selected.has(m.id)?'✓':'○'):icon('more');item.querySelector('.of-byline').append(more);}
  setAvatar(item.querySelector('img'),user?chat.myAvatar:chat.avatar);
  item.querySelector('.of-name').textContent=user?(chat.myName||'Mio'):(chat.remarkName||chat.realName||'Shen Yu');
  item.querySelector('time').textContent=date.toLocaleString('en-GB',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(',','');
  const prose=item.querySelector('.of-prose'); for(const paragraph of textOf(m).split(/\n{2,}/)){const p=document.createElement('p');p.textContent=paragraph;prose.append(p);}
  item.querySelector('.of-meta').textContent=[Number.isFinite(m.offlineDuration)?`${m.offlineDuration.toFixed(1)}s`:null,tokensOf(m),`#${String(m.offlineFloor).padStart(3,'0')}`].filter(Boolean).join(' · ');
  area.append(item);
 }
 if(atBottom)area.scrollTop=area.scrollHeight;
}
// A session references the shared messages; it never creates a second history.
function sessionRows(chat,session) {
 const ids=new Set(session.messageIds||[]);
 return (chat.history||[]).filter(m=>isNarrative(m)&&(m.offlineSessionId===session.id||ids.has(m.id)));
}
function activeSession(chat) {
 const cfg=config(chat);if(!cfg.active)return null;
 return cfg.sessions.find(s=>s.id===cfg.activeSessionId&&!s.endedAt&&s.status!=='archived')||(!cfg.active?null:cfg.sessions.slice().reverse().find(s=>!s.endedAt&&s.status!=='archived'))||null;
}
function migrateSessions(chat) {
 const cfg=config(chat),history=chat.history||[];
 for(const session of cfg.sessions){
  const start=history.findIndex(m=>m.id===session.startAfterMessageId),end=history.findIndex(m=>m.id===session.endMessageId);
  if(!session.messageIds){
   const candidates=history.filter((m,index)=>isNarrative(m)&&!m.offlineSessionId&&
    (session.startAfterMessageId&&start>=0?index>start:Number(m.timestamp)>=session.startedAt)&&
    (end>=0?index<=end:!session.endedAt||Number(m.timestamp)<=session.endedAt));
   candidates.forEach(m=>{m.offlineSessionId=session.id;});
   if(session.endedAt){session.messageIds=candidates.map(m=>m.id);session.status='archived';session.title ||= defaultSessionTitle(session);candidates.forEach(m=>m.offlineArchiveId=session.id);}
  }
 }
 if(cfg.active){const session=activeSession(chat);if(session)cfg.activeSessionId=session.id;}
}
function defaultSessionTitle(session) {return new Date(session.startedAt||Date.now()).toLocaleString('en-GB',{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
function tagMessage(chat,message) {
 if(!config(chat).active)return;
 let session=activeSession(chat);
 if(!session){session={id:uid(),startedAt:Date.now(),startAfterMessageId:chat.history?.at(-1)?.id||null};config(chat).sessions.push(session);config(chat).activeSessionId=session.id;}
 message.offlineSessionId=session.id;
}
async function finishSession(chat,mode,{title='',summaryId=null}={}) {
 if(!['keep','summary','delete'].includes(mode))throw Error('无效的结束方式');
 const cfg=config(chat),session=activeSession(chat);if(!session)throw Error('未找到当前线下片段');
 const rows=sessionRows(chat,session),ids=new Set(rows.map(m=>m.id));
 const previousHistory=chat.history,previousOffline=JSON.parse(JSON.stringify(cfg));
 const previousFlags=rows.map(m=>m.offlineArchiveId);
 await persistChange(()=>{
  cfg.active=false;cfg.activeSessionId=null;cfg.composerDraft='';
  if(mode==='delete'){chat.history=chat.history.filter(m=>!ids.has(m.id));cfg.sessions=cfg.sessions.filter(s=>s.id!==session.id);}
  else if(rows.length){
   Object.assign(session,{title:title.trim()||defaultSessionTitle(session),status:'archived',endedAt:Date.now(),endMessageId:rows.at(-1)?.id||null,messageIds:[...ids],summaryId:summaryId||session.summaryId||null});
   rows.forEach(m=>m.offlineArchiveId=session.id);
  }else cfg.sessions=cfg.sessions.filter(s=>s.id!==session.id);
 },()=>{chat.history=previousHistory;chat.offline=previousOffline;rows.forEach((m,i)=>{if(previousFlags[i]===undefined)delete m.offlineArchiveId;else m.offlineArchiveId=previousFlags[i];});});
 return mode==='delete'?null:config(chat).sessions.find(s=>s.id===session.id)||null;
}
async function deleteArchive(chat,sessionId) {
 const cfg=config(chat),session=cfg.sessions.find(s=>s.id===sessionId&&s.status==='archived');
 if(!session)throw Error('归档已不存在');
 const ids=new Set(sessionRows(chat,session).map(m=>m.id)),history=chat.history,sessions=cfg.sessions;
 await persistChange(()=>{chat.history=history.filter(m=>!ids.has(m.id));cfg.sessions=sessions.filter(s=>s.id!==sessionId);},()=>{chat.history=history;cfg.sessions=sessions;});
}
function editableRows(chat,ids) {
 const requested=new Set(ids),rows=(chat.history||[]).filter(m=>requested.has(m.id));
 if(!rows.length||rows.length!==requested.size)throw Error('选中的楼层已不存在');
 if(rows.some(m=>!isNarrative(m)||m.offlineArchiveId))throw Error('归档楼层只能查看，不能编辑或删除');
 return rows;
}
async function editFloor(chat,id,text) {
 if(!text.trim())throw Error('正文不能为空');
 const [message]=editableRows(chat,[id]),previous={...message};
 await persistChange(()=>{message.content=text.trim();message.parts=[{type:'text',text:text.trim()}];message.offlineNarrative=true;message.offlineEditedAt=Date.now();message.offlineTokens=estimate(text.trim());message.offlineTokensEstimated=true;},()=>{for(const key of Object.keys(message))delete message[key];Object.assign(message,previous);});
}
async function deleteFloors(chat,ids) {
 const rows=editableRows(chat,ids),selected=new Set(rows.map(m=>m.id)),history=chat.history;
 await persistChange(()=>{chat.history=history.filter(m=>!selected.has(m.id));},()=>{chat.history=history;});
}

function updateView() {
 const archives=state.view==='archives';$('.of-page').hidden=archives;$('.of-archive-page').hidden=!archives;
 if(archives){$('#of-custom-style').textContent='';renderArchives();return;}
 const readOnly=state.view==='archive';$('.of-composer').hidden=readOnly||state.selecting;$('.of-status').hidden=readOnly;
 for(const action of ['style','memory','setup'])$(`.of-header [data-action="${action}"]`).hidden=readOnly;
 $('.of-selection-bar').hidden=!state.selecting||readOnly;
 $('.of-title').dataset.action=readOnly?'archive-info':'menu';
 refresh(true);
}
function renderArchives() {
 const chat=character(),cfg=config(chat),query=state.archiveQuery.toLowerCase();
 $('.of-archive-person').textContent=chat.remarkName||chat.realName||'Offline';
 setAvatar($('.of-archive-self'),chat.myAvatar);setAvatar($('.of-archive-char'),chat.avatar);
 const container=$('.of-archive-list');container.replaceChildren();
 const current=activeSession(chat);
 if(current){const resume=document.createElement('button');resume.className='of-current-row';resume.dataset.action='resume-offline';resume.innerHTML=`<span class="of-live-dot"></span><span>Current session<small>${floorLabel(sessionRows(chat,current).length)} · Resume</small></span>${icon('send')}`;container.append(resume);}
 const archives=cfg.sessions.filter(s=>s.status==='archived').sort((a,b)=>(b.endedAt||b.startedAt)-(a.endedAt||a.startedAt)).filter(s=>`${s.title} ${defaultSessionTitle(s)}`.toLowerCase().includes(query));
 for(const archive of archives){
  const rows=sessionRows(chat,archive),floors=rows.map(m=>m.offlineFloor).filter(Number.isInteger),row=document.createElement('div');row.className='of-archive-swipe';
  row.innerHTML=`<button class="of-archive-delete" data-action="delete-archive" data-id="${escape(archive.id)}" aria-label="Delete archive">Delete</button><button class="of-archive-front" data-action="open-archive" data-id="${escape(archive.id)}"><img alt=""><span class="of-archive-copy"><span class="of-archive-name"></span><span class="of-archive-date"></span><span class="of-archive-preview"></span></span><span class="of-archive-count"></span></button>`;
  setAvatar(row.querySelector('img'),chat.avatar);row.querySelector('.of-archive-name').textContent=archive.title||defaultSessionTitle(archive);
  row.querySelector('.of-archive-date').textContent=new Date(archive.startedAt||archive.endedAt||Date.now()).toLocaleString('en-GB',{year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  row.querySelector('.of-archive-preview').textContent=(rows.at(-1)?textOf(rows.at(-1)):'Empty archive').replace(/\s+/g,' ');
  row.querySelector('.of-archive-count').textContent=`${floorLabel(rows.length)}${floors.length?'\n#'+Math.min(...floors)+(Math.min(...floors)!==Math.max(...floors)?'–'+Math.max(...floors):''):''}`;
  container.append(row);
 }
 if(!archives.length){const empty=document.createElement('div');empty.className='of-archive-empty';empty.textContent=query?'No matching archives.':'No archives yet.\nStart a new offline session.';container.append(empty);}
}
function showArchives() {closePanel();state.view='archives';state.archiveId=null;state.selecting=false;state.selected.clear();updateView();}
function showCurrent() {closePanel();state.view='chat';state.archiveId=null;state.selecting=false;state.selected.clear();updateView();}
function openArchive(id) {if(!config(character()).sessions.some(s=>s.id===id&&s.status==='archived'))throw Error('归档已不存在');closePanel();state.view='archive';state.archiveId=id;state.limit=60;state.selecting=false;state.selected.clear();updateView();}
function setSelection(active) {state.selecting=active;$('.of-composer').hidden=active;state.selected.clear();render(false);$('.of-selection-bar').hidden=!active;}
function floorMenu(id) {
 const chat=character(),m=editableRows(chat,[id])[0];
 panel(`楼层 #${m.offlineFloor}`,`<button class="of-menu-row" data-action="edit-floor" data-id="${escape(id)}">编辑正文</button><button class="of-menu-row" data-action="delete-floor" data-id="${escape(id)}">删除此楼层</button><button class="of-menu-row" data-action="select-floors" data-id="${escape(id)}">多选删除</button>`);
}
function confirmFloorDelete(ids) {
 const rows=editableRows(character(),ids);state.deleteIds=rows.map(m=>m.id);
 panel('删除楼层',`<p class="of-confirm-text">确定删除 ${rows.length} 层记录？</p><p class="of-note">${escape(rows.map(m=>'#'+m.offlineFloor).join('、'))}<br>会同步删除原聊天记录中的这些消息，其他楼层编号不变。已有日记不受影响。</p><div class="of-row"><button class="of-primary of-danger" data-action="confirm-delete-floors">确认删除</button><button data-action="close-panel">取消</button></div>`);
}
function exitDialog() {
 if(isGenerating||state.busy||state.sending)throw Error('请等生成完成或暂停后再结束线下');
 const chat=character(),session=activeSession(chat);if(!session)throw Error('当前没有进行中的线下片段');
 const rows=sessionRows(chat,session);
 panel('结束本次线下',`<label class="of-label">归档标题<input id="of-exit-title" placeholder="可选，默认以日期命名" value="${escape(state.exitTitle||session.title||'')}"></label><p class="of-note">本段共 ${rows.length} 层。归档后从聊天页面收起，原文只读保留；AI 读取仍沿用各楼层的隐藏设置。</p><button class="of-exit-choice" data-action="finish-summary"><strong>总结并归档</strong><small>总结存入现有日记，原文保留为只读归档</small></button><button class="of-exit-choice" data-action="finish-keep"><strong>保留归档</strong><small>不生成总结，直接归档本段</small></button><button class="of-exit-choice of-danger-text" data-action="finish-delete"><strong>删除本段</strong><small>确认后删除本次线下原文，不影响之前的记录和日记</small></button><button data-action="close-panel">继续线下</button>`);
}
async function exitAndArchive(mode) {
 const chat=character();if(isGenerating||state.busy)throw Error('请等当前生成结束');
 const session=activeSession(chat);if(!session)throw Error('当前片段已结束');
 const title=$('#of-exit-title')?$('#of-exit-title').value:state.exitTitle||'';state.exitTitle=title;
 if(mode==='delete'){
  panel('删除本次线下',`<p class="of-confirm-text">确定删除本次线下的 ${sessionRows(chat,session).length} 层原文？</p><p class="of-note">仅删除这一段，不影响其他聊天和已存日记。此操作无法撤销。</p><div class="of-row"><button class="of-primary of-danger" data-action="confirm-finish-delete">删除并切回线上</button><button data-action="online">返回</button></div>`);return;
 }
 if(mode==='summary'){
  const rows=sessionRows(chat,session);if(!rows.length)throw Error('本段没有可总结的楼层，请选择保留归档');
  panel('总结并归档',`<label class="of-label">总结方式<select id="of-exit-method"><option value="current">沿用当前日记风格</option><option value="summary">客观摘要</option><option value="default">角色日记</option><option value="custom">自定义世界书</option></select></label><div id="of-exit-books" hidden>${worldbookChoices('exit-summary-wb',chat.journalStyleSettings?.customWorldBookIds||[])}</div><label class="of-check"><input id="of-exit-favorites" type="checkbox">参考已收藏日记</label><p class="of-note">总结保存成功后才会归档并切回线上；失败时保留当前片段，可重试。</p><button class="of-primary" data-action="confirm-finish-summary">生成日记并归档</button><button data-action="online">返回</button>`);
  $('#of-exit-method').addEventListener('change',e=>$('#of-exit-books').hidden=e.target.value!=='custom');return;
 }
 await finishSession(chat,mode,{title});returnOnline();
}
function summarySignature(rows,options,includeFavorites) {
 const text=JSON.stringify([rows.map(m=>[m.id,m.content]),options.styleSettings||null,includeFavorites]);let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return text.length+':'+(hash>>>0).toString(16);
}
async function summarizeAndFinish() {
 const chat=character(),session=activeSession(chat);if(!session||isGenerating)throw Error('当前无法总结');
 const rows=sessionRows(chat,session),ids=rows.map(m=>m.id),indexes=rows.map(m=>chat.history.indexOf(m)),method=$('#of-exit-method').value;
 const options={messageIds:ids,styleSettings:method==='current'?undefined:{mode:method,customWorldBookIds:all('.exit-summary-wb:checked').map(el=>el.value)}};
 const includeFavorites=$('#of-exit-favorites').checked,signature=summarySignature(rows,options,includeFavorites);
 let journal=chat.memoryJournals?.find(j=>j.id===session.summaryId&&session.summarySignature===signature);
 if(!journal)journal=await generateJournal(Math.min(...indexes)+1,Math.max(...indexes)+1,includeFavorites,options);
 if(!journal)return;
 if(summarySignature(sessionRows(chat,session),options,includeFavorites)!==signature){showToast('日记已保存，但记录在生成期间有变化，请重新确认结束');return;}
 // If final archive persistence fails, keep the saved diary ID for a retry without duplication.
 session.summaryId=journal.id;session.summarySignature=signature;
 await finishSession(chat,'summary',{title:state.exitTitle,summaryId:journal.id});returnOnline();
}
function returnOnline() {state.view='chat';state.archiveId=null;state.exitTitle='';state.selecting=false;state.selected.clear();closePanel();switchScreen('chat-room-screen');renderMessages();syncEntry();}
function installGestures() {
 let swipe=null,press=null,timer=null;
 const cancelPress=()=>{clearTimeout(timer);timer=null;press=null;};
 state.root.addEventListener('contextmenu',e=>{const item=e.composedPath().find(n=>n instanceof Element&&n.classList.contains('of-message'));if(item&&state.view==='chat'){e.preventDefault();floorMenu(item.dataset.messageId);}});
 state.root.addEventListener('pointerdown',e=>{
  const front=e.composedPath().find(n=>n instanceof Element&&n.classList.contains('of-archive-front'));
  if(front){swipe={front,x:e.clientX,y:e.clientY,dx:0,startedOpen:front.parentNode.classList.contains('revealed')};return;}
  const item=e.composedPath().find(n=>n instanceof Element&&n.classList.contains('of-message'));
  if(item&&state.view==='chat'&&!state.selecting){press={x:e.clientX,y:e.clientY};timer=setTimeout(()=>{if(press){floorMenu(item.dataset.messageId);state.suppressClickUntil=Date.now()+400;}cancelPress();},500);}
 });
 state.root.addEventListener('pointermove',e=>{
  if(press&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>9)cancelPress();
  if(!swipe)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;
  if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>10){swipe=null;return;}
  if(Math.abs(dx)>8){swipe.dx=dx;if(!swipe.front.hasPointerCapture(e.pointerId))swipe.front.setPointerCapture(e.pointerId);swipe.front.style.transition='none';swipe.front.style.transform=`translateX(${Math.max(-78,Math.min(0,(swipe.startedOpen?-78:0)+dx))}px)`;}
 });
 const end=()=>{cancelPress();if(swipe){if(Math.abs(swipe.dx)>8){swipe.front.parentNode.classList.toggle('revealed',swipe.startedOpen?swipe.dx<32:swipe.dx<-32);state.suppressClickUntil=Date.now()+400;}swipe.front.style.transition='';swipe.front.style.transform='';swipe=null;}};
 state.root.addEventListener('pointerup',end);state.root.addEventListener('pointercancel',end);state.root.addEventListener('scroll',cancelPress,true);
}

function setAvatar(img,url){img.src=url||'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" rx="32" fill="%23e6e6e9"/%3E%3Ccircle cx="32" cy="24" r="10" fill="%23999"/%3E%3Cpath d="M12 60a20 20 0 0 1 40 0" fill="%23999"/%3E%3C/svg%3E';img.onerror=()=>{img.onerror=null;img.removeAttribute('src');};}
async function send() {
 const chat=character(),input=$('.of-composer textarea'),text=input.value.trim();
 if(!chat||isGenerating||state.busy||state.sending||state.view!=='chat')return;
 if(!config(chat).active){showToast('当前已切回线上，请重新进入线下');return;}
 if(!text)return;
 state.sending=true;
 try {
 const m={id:`msg_offline_${uid()}`,role:'user',content:text,parts:[{type:'text',text}],timestamp:Date.now(),offlineNarrative:true};
 chat.history ||= [];tagMessage(chat,m);chat.history.push(m);ensureFloors(chat);
 const previousDraft=config(chat).composerDraft;config(chat).composerDraft='';
 try{await saveData();}catch(error){chat.history.splice(chat.history.indexOf(m),1);config(chat).composerDraft=previousDraft;throw error;}
 input.value='';input.style.height='auto';renderMessages();refresh(true);renderChatList();
 await getAiReply(chat.id,'private');
 } finally { state.sending=false; }
}
async function request(chat,apiConfig,isBackground=false) {
 if(state.busy||isGenerating&&!isBackground)return;
 const generation=aiGenerationControl.begin(chat.id,'private',isBackground),start=performance.now();
 state.busy=true;if(!isBackground){isGenerating=true;getReplyBtn.disabled=true;regenerateBtn.disabled=true;status('Writing…');}
 let persisted=false;
 try{
  const limit=Number(chat.maxMemory)>0?Number(chat.maxMemory):30;
  let history=historyForAI(chat).filter(m=>!m.isContextDisabled&&!m.isThinking&&!m.isStatusUpdate&&!['mcp-request','mcp-activity'].includes(m.type)).slice(-limit);
  history=filterHistoryForAI(chat,history);
  const messages=[{role:'system',content:prompt(chat)},...history.filter(m=>['user','assistant'].includes(m.role)).map(m=>({role:m.role,content:textOf(m)})).filter(m=>m.content.trim())];
  if(messages.length===1)messages.push({role:'user',content:'请根据当前场景开始线下剧情，留出我的回应空间。'});
  const built=buildChatApiRequest(apiConfig,messages,{temperature:apiConfig.temperatureEnabled?apiConfig.temperature:undefined});
  let endpoint=built.endpoint;
  if(apiConfig.streamEnabled){if(apiConfig.provider==='gemini')endpoint=endpoint.replace(':generateContent',':streamGenerateContent')+'&alt=sse';else built.requestBody.stream=true;}
  const blocked=typeof BLOCKED_API_DOMAINS!=='undefined'?BLOCKED_API_DOMAINS:[];
  if(blocked.some(domain=>endpoint.includes(domain)))throw Error('当前 API 站点已被屏蔽');
  const response=await fetch(endpoint,{method:'POST',headers:built.headers,body:JSON.stringify(built.requestBody),signal:generation.signal});
  if(!response.ok)throw Error(`API ${response.status}: ${(await response.text()).slice(0,180)}`);
  let full='',usage=null;
  const consume=data=>{
   if(data.error)throw Error(data.error.message||'API error');
   if(data.usage)usage=data.usage.completion_tokens;
   if(data.usageMetadata)usage=data.usageMetadata.candidatesTokenCount;
   if(apiConfig.provider==='gemini')full+=(data.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('');
   else full+=data.choices?.[0]?.delta?.content??data.choices?.[0]?.message?.content??'';
  };
  if((response.headers.get('content-type')||'').includes('text/event-stream')){
   const reader=response.body.getReader(),decoder=new TextDecoder();generation.reader=reader;let buffer='';
   try{while(true){const result=await generation.waitFor(reader.read());generation.check();buffer+=decoder.decode(result.value||new Uint8Array(),{stream:!result.done});const lines=buffer.split(/\r?\n/);buffer=lines.pop();for(const line of lines)if(line.startsWith('data:')){const data=line.slice(5).trim();if(data&&data!=='[DONE]')consume(JSON.parse(data));}if(result.done){if(buffer.startsWith('data:')){const data=buffer.slice(5).trim();if(data&&data!=='[DONE]')consume(JSON.parse(data));}break;}}}finally{generation.reader=null;reader.releaseLock();}
  }else{const data=await response.json();if(Array.isArray(data))data.forEach(consume);else consume(data);}
  generation.check();
  const clean=full.replace(/<(thinking|think)>[\s\S]*?<\/\1>/gi,'').replace(/<(thinking|think)>[\s\S]*$/gi,'').replace(/\[incipere\]/g,'').trim();
  if(!clean)throw Error('API 未返回可显示的剧情正文，请重试');
  const m={id:`msg_offline_${uid()}`,role:'assistant',content:clean,parts:[{type:'text',text:clean}],timestamp:Date.now(),offlineNarrative:true,offlineDuration:(performance.now()-start)/1000,offlineTokens:Number.isFinite(usage)?usage:estimate(clean),offlineTokensEstimated:!Number.isFinite(usage)};
  tagMessage(chat,m);chat.history.push(m);ensureFloors(chat);try{await saveData();}catch(error){chat.history.splice(chat.history.indexOf(m),1);throw error;}persisted=true;
  addMessageBubble(m,chat.id,'private');renderChatList();refresh(true);status('');
 }catch(error){if(error.name==='AbortError')status('Paused');else{status(persisted?'Saved; display refresh failed':'Reply failed · your message is saved');showApiError(error);}}
 finally{state.busy=false;aiGenerationControl.finish(generation);refresh();}
}
function presets(){db.offlineStylePresets ||= [];return db.offlineStylePresets;}
function appearance() {
 const cfg=config(character());panel('外观美化',`<div class="of-section-title">页面 CSS <button data-action="expand-css" aria-label="放大编辑">${icon('expand')}</button></div><div class="of-find"><input id="of-find" placeholder="搜索代码关键词" aria-label="搜索代码关键词"><button data-action="find-code">下一处</button></div><textarea id="of-css" class="of-code" spellcheck="false" aria-label="页面 CSS"></textarea><div class="of-row"><button data-action="apply-css" class="of-primary">应用</button><button data-action="reset-css">重置</button><button data-action="save-preset">保存预设</button></div><div class="of-section-title">美化预设 <span><button data-action="import-style">导入</button><button data-action="export-all">全部导出</button></span></div><input id="of-preset-search" class="of-wide" placeholder="搜索预设" aria-label="搜索预设"><div id="of-presets"></div><p class="of-note">支持 CSS / TXT / DOCX / JSON，导入后自动保存为预设。美化仅作用于线下页面。</p><input id="of-style-file" type="file" accept=".css,.txt,.docx,.json" multiple hidden>`);
 $('#of-css').value=state.editorDraft??cfg.css??'';
 $('#of-preset-search').addEventListener('input',renderPresets);$('#of-style-file').addEventListener('change',event=>importStyles(event).catch(fail));renderPresets();
}
function renderPresets(){const query=($('#of-preset-search')?.value||'').toLowerCase();$('#of-presets').innerHTML=presets().filter(p=>p.name.toLowerCase().includes(query)).map(p=>`<div class="of-preset"><button class="of-preset-name" data-action="load-preset" data-id="${escape(p.id)}">${escape(p.name)}</button><button data-action="export-preset" data-id="${escape(p.id)}">导出</button><button data-action="delete-preset" data-id="${escape(p.id)}" aria-label="删除 ${escape(p.name)}">×</button></div>`).join('')||'<p class="of-note">暂无匹配预设。</p>';}
function download(name,data,type='application/json'){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([data],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function importStyles(event) {
 const files=Array.from(event.target.files||[]),added=[];
 for(const file of files){try{
  if(file.size>5*1024*1024)throw Error('文件请控制在 5MB 内');
  const ext=file.name.split('.').pop().toLowerCase();let text='';
  if(ext==='docx'){if(!window.mammoth)throw Error('DOCX 解析器尚未加载');text=(await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value;}else text=await file.text();
  if(ext==='json'){
   const parsed=JSON.parse(text),list=Array.isArray(parsed)?parsed:parsed.presets||[parsed];
   if(!list.length||list.some(p=>typeof p.name!=='string'||!p.name.trim()||typeof p.css!=='string'))throw Error('预设格式无效，需要 name 和 css');
   for(const p of list)added.push({id:uid(),name:p.name.trim(),css:p.css,updatedAt:Date.now()});
  }else{
   const fences=[...text.matchAll(/```(?:css)?\s*\n([\s\S]*?)```/gi)],styles=[...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
   const css=(fences.length?fences.map(m=>m[1]).join('\n'):styles.length?styles.map(m=>m[1]).join('\n'):text).trim();
   if(!css||!css.includes('{')||!css.includes('}'))throw Error('未找到 CSS 代码');
   added.push({id:uid(),name:file.name.replace(/\.[^.]+$/,''),css,updatedAt:Date.now()});
  }
 }catch(error){showToast(`${file.name}：${error.message}`);}}
 if(added.length){presets().push(...added);try{await saveData();}catch(error){const ids=new Set(added.map(p=>p.id));db.offlineStylePresets=presets().filter(p=>!ids.has(p.id));throw error;}if($('#of-presets'))renderPresets();showToast(`已保存 ${added.length} 个预设`);}event.target.value='';
}
function memory() {
 const chat=character();ensureFloors(chat);const floors=chat.history.filter(m=>isNarrative(m)&&!m.offlineArchiveId),last=floors.at(-1)?.offlineFloor||1;
 panel('总结与楼层',`<div class="of-tabs"><button class="selected" data-action="memory-tab" data-tab="summary">总结</button><button data-action="memory-tab" data-tab="hide">隐藏楼层</button></div><div id="of-memory-summary"><label class="of-label">楼层范围<input id="of-summary-range" placeholder="1–20, 24, 28–30" value="1-${last}"></label><p class="of-note">支持连续范围和独立楼层，例如 1-20, 24, 28-30。隐藏后编号不变。</p><label class="of-label">总结方式<select id="of-summary-method"><option value="current">沿用当前日记风格</option><option value="summary">客观摘要</option><option value="default">角色日记</option><option value="custom">自定义世界书</option></select></label><div id="of-summary-books" hidden>${worldbookChoices('summary-wb',chat.journalStyleSettings?.customWorldBookIds||[])}</div><label class="of-check"><input id="of-summary-favorites" type="checkbox">参考已收藏日记</label><label class="of-check"><input id="of-summary-hide" type="checkbox">日记保存成功后隐藏所选楼层</label><p class="of-note">隐藏只排除原消息，已有日记可能仍保留相关信息。</p><button data-action="summarize" class="of-primary">生成并存入日记</button><button data-action="diary">查看日记</button></div><div id="of-memory-hide" hidden><label class="of-label">楼层范围<input id="of-hide-range" placeholder="1–20, 24, 28–30"></label><div class="of-row"><button data-action="hide-floors" class="of-primary">隐藏</button><button data-action="restore-floors">恢复</button></div><p class="of-note">隐藏后原文仍保留，但不进入后续 AI 上下文，可随时恢复。</p><div class="of-hidden-list">${floors.filter(m=>m.offlineHidden).map(m=>`<button data-action="restore-one" data-id="${escape(m.id)}">#${m.offlineFloor} · 恢复</button>`).join('')||'暂无隐藏楼层。'}</div></div>`);
 $('#of-summary-method').addEventListener('change',e=>{$('#of-summary-books').hidden=e.target.value!=='custom';});
}
function selectMemoryTab(tab) {
 $('#of-memory-summary').hidden=tab!=='summary';$('#of-memory-hide').hidden=tab!=='hide';all('.of-tabs button').forEach(b=>b.classList.toggle('selected',b.dataset.tab===tab));
}
function parseFloors(value,chat) {
 const selected=new Set(),available=new Map(chat.history.filter(m=>isNarrative(m)&&!m.offlineArchiveId).map(m=>[m.offlineFloor,m]));
 for(const part of value.replace(/[，、]/g,',').split(',').map(s=>s.trim()).filter(Boolean)){
  const match=part.match(/^(\d+)\s*(?:[-–—~]\s*(\d+))?$/);if(!match)throw Error('楼层格式例如 1-20, 24, 28-30');
  const first=Number(match[1]),last=Number(match[2]||match[1]);if(first<1||last<first||last-first>100000)throw Error('楼层范围无效');
  for(const [floor,m] of available)if(floor>=first&&floor<=last)selected.add(m.id);
 }
 if(!selected.size)throw Error('未选中有效楼层');return selected;
}
function worldbookChoices(className,selected=[]) {return `<div class="of-book-list">${(db.worldBooks||[]).map(b=>`<label class="of-check"><input type="checkbox" class="${className}" value="${escape(b.id)}" ${selected.includes(b.id)?'checked':''}>${escape(b.name||b.title||'未命名')}</label>`).join('')||'<p class="of-note">暂无世界书。</p>'}</div>`;}
async function summarize() {
 if(isGenerating||state.summaryBusy){showToast('请等当前生成完成');return;}
 const chat=character(),ids=parseFloors($('#of-summary-range').value,chat),method=$('#of-summary-method').value;
 const indexes=chat.history.map((m,i)=>ids.has(m.id)?i:-1).filter(i=>i>=0),hide=$('#of-summary-hide').checked;
 const options={messageIds:[...ids],styleSettings:method==='current'?undefined:{mode:method,customWorldBookIds:Array.from(all('.summary-wb:checked')).map(i=>i.value)}};
 state.summaryBusy=true;const button=$('[data-action="summarize"]');button.disabled=true;button.textContent='正在生成…';
 try{const result=await generateJournal(Math.min(...indexes)+1,Math.max(...indexes)+1,$('#of-summary-favorites').checked,options);
  if(result){if(hide)await setHidden(chat,ids,true);status('Saved to diary');refresh();closePanel();}
 }finally{state.summaryBusy=false;button.disabled=false;button.textContent='生成并存入日记';}
}
function setup() {
 const cfg=config(character()),draft=cfg.draft;
 panel('线下设置',`<p class="of-preview-note">此处先保存设置选择，专属配置将在后续版本接入。</p><label class="of-label">专属 API<select id="of-api"><option value="">沿用当前聊天 API</option>${(db.apiPresets||[]).map(p=>`<option value="${escape(p.name)}">${escape(p.name)}</option>`).join('')}</select></label><label class="of-label">提示词预设<select id="of-prompt-preset"><option value="">默认线下提示词</option><option value="custom">自定义线下提示词</option>${(db.offlinePromptPresets||[]).map(p=>`<option value="${escape(p.id)}">${escape(p.name)}</option>`).join('')}</select></label><label class="of-check"><input id="of-cot-enabled" type="checkbox">启用思维链</label><label class="of-label">思维链预设<select id="of-cot-preset"><option value="">沿用当前预设</option>${(db.cotPresets||[]).map(p=>`<option value="${escape(p.id)}">${escape(p.name)}</option>`).join('')}</select></label><label class="of-label">线下提示词<textarea id="of-prompt" rows="5"></textarea></label><div class="of-section-title">绑定世界书 <button data-action="unbind-books">全部解绑</button></div><label class="of-check"><input id="of-inherit-books" type="checkbox">沿用线上绑定</label>${worldbookChoices('of-worldbook',draft.worldBookIds||character().worldBookIds||[])}<button data-action="save-setup" class="of-primary">保存设置</button>`);
 $('#of-api').value=draft.apiPreset||'';$('#of-prompt-preset').value=draft.promptPreset||'';$('#of-cot-enabled').checked=!!draft.cotEnabled;$('#of-cot-preset').value=draft.cotPreset||'';$('#of-prompt').value=draft.prompt??DEFAULT_PROMPT;$('#of-inherit-books').checked=draft.inheritWorldbooks!==false;
 const sync=()=>{$('#of-cot-preset').disabled=!$('#of-cot-enabled').checked;all('.of-worldbook').forEach(el=>el.disabled=$('#of-inherit-books').checked);};
 $('#of-cot-enabled').addEventListener('change',sync);$('#of-inherit-books').addEventListener('change',sync);sync();
}
function menu(){panel('线下菜单',`<button class="of-menu-row" data-action="archives">线下归档</button><button class="of-menu-row" data-action="select-floors">多选删除楼层</button><button class="of-menu-row" data-action="continue">继续剧情 ${icon('send')}</button><button class="of-menu-row" data-action="pause">暂停生成 ${icon('stop')}</button><button class="of-menu-row" data-action="online">切回线上 ${icon('back')}</button><p class="of-note">返回仅退出页面；选择「切回线上」才会结束线下模式。</p>`);}
async function onClick(event) {
 const button=event.composedPath().find(node=>node instanceof Element&&node.matches('[data-action]'));if(!button)return;event.preventDefault();const action=button.dataset.action,chat=character();
 const mutation=['new-offline','finish-keep','confirm-finish-delete','confirm-finish-summary','confirm-delete-archive','confirm-delete-floors','save-floor-edit','summarize','hide-floors','restore-floors','restore-one','apply-css','reset-css','confirm-preset','confirm-delete-preset','save-setup'].includes(action);
 if(action==='open-archive'&&Date.now()<state.suppressClickUntil)return;
 if(mutation&&state.pendingAction)return;
 if(mutation){state.pendingAction=true;button.disabled=true;}
 try{switch(action){
 case 'back':if(state.selecting){setSelection(false);break;}if(state.view==='archive'){showArchives();break;}closePanel();switchScreen('chat-room-screen');renderMessages();syncEntry();break;
 case 'close-panel':closePanel();break;
 case 'archives':showArchives();break;
 case 'resume-offline':if(config(chat).active)showCurrent();else await open(true);break;
 case 'new-offline':if(config(chat).active)showCurrent();else await open(true);break;
 case 'list-back':if(config(chat).active)showCurrent();else{switchScreen('chat-room-screen');renderMessages();}break;
 case 'open-archive':openArchive(button.dataset.id);break;
 case 'archive-info':{const archive=config(chat).sessions.find(s=>s.id===state.archiveId);panel('只读归档',`<p>${escape(archive?.title||'线下记录')}</p><p class="of-note">归档中的楼层只供查看，不能编辑。返回列表可删除整段归档。</p><button data-action="close-panel">返回查看</button>`);break;}
 case 'delete-archive':{state.deleteArchiveId=button.dataset.id;const archive=config(chat).sessions.find(s=>s.id===button.dataset.id);if(!archive)break;panel('删除归档',`<p class="of-confirm-text">删除「${escape(archive.title)}」？</p><p class="of-note">将删除这段归档及其中 ${sessionRows(chat,archive).length} 层原文，无法撤销。已存日记不受影响。</p><button class="of-primary of-danger" data-action="confirm-delete-archive">确认删除</button><button data-action="close-panel">取消</button>`);break;}
 case 'confirm-delete-archive':await deleteArchive(chat,state.deleteArchiveId);closePanel();showArchives();renderMessages();break;
 case 'floor-menu':if(state.view==='chat')floorMenu(button.dataset.id);break;
 case 'edit-floor':{const m=editableRows(chat,[button.dataset.id])[0];state.editId=m.id;panel(`编辑楼层 #${m.offlineFloor}`,`<textarea id="of-floor-edit" class="of-floor-editor" rows="12" aria-label="正文"></textarea><div class="of-row"><button class="of-primary" data-action="save-floor-edit">保存修改</button><button data-action="close-panel">取消</button></div>`);$('#of-floor-edit').value=textOf(m);break;}
 case 'save-floor-edit':if(isGenerating||state.busy)throw Error('请等当前生成结束再编辑');await editFloor(chat,state.editId,$('#of-floor-edit').value);closePanel();renderMessages();refresh();break;
 case 'delete-floor':confirmFloorDelete([button.dataset.id]);break;
 case 'select-floors':closePanel();setSelection(true);if(button.dataset.id){state.selected.add(button.dataset.id);render(false);}break;
 case 'cancel-selection':setSelection(false);break;
 case 'toggle-floor':if(state.selected.has(button.dataset.id))state.selected.delete(button.dataset.id);else state.selected.add(button.dataset.id);render(false);break;
 case 'delete-selected':if(!state.selected.size)throw Error('请先选择楼层');confirmFloorDelete([...state.selected]);break;
 case 'confirm-delete-floors':if(isGenerating||state.busy)throw Error('请等当前生成结束再删除');await deleteFloors(chat,state.deleteIds);closePanel();setSelection(false);renderMessages();refresh();break;
 case 'finish-keep':await exitAndArchive('keep');break;
 case 'finish-summary':await exitAndArchive('summary');break;
 case 'finish-delete':await exitAndArchive('delete');break;
 case 'confirm-finish-delete':await finishSession(chat,'delete',{title:state.exitTitle});returnOnline();break;
 case 'confirm-finish-summary':await summarizeAndFinish();break;

 case 'menu':menu();break;
 case 'style':appearance();break;
 case 'memory':memory();break;
 case 'setup':setup();break;
 case 'load':{const area=$('.of-messages'),height=area.scrollHeight,top=area.scrollTop;state.limit+=60;render(false);area.scrollTop=top+area.scrollHeight-height;break;}
 case 'online':exitDialog();break;
 case 'continue':closePanel();if(!isGenerating)await getAiReply(chat.id,'private');break;
 case 'pause':pauseAiGeneration();status('Paused');break;
 case 'diary':closePanel();renderJournalList();switchScreen('memory-journal-screen');break;
 case 'memory-tab':selectMemoryTab(button.dataset.tab);break;
 case 'summarize':await summarize();break;
 case 'hide-floors':case 'restore-floors':{const ids=parseFloors($('#of-hide-range').value,chat);await setHidden(chat,ids,action==='hide-floors');memory();selectMemoryTab('hide');refresh();break;}
 case 'restore-one':{const m=chat.history.find(m=>m.id===button.dataset.id);if(m){await setHidden(chat,new Set([m.id]),false);refresh();if(!$('.of-panel').hidden){memory();selectMemoryTab('hide');}}break;}
 case 'expand-css':$('.of-panel').classList.toggle('of-editor-full');button.setAttribute('aria-pressed',$('.of-panel').classList.contains('of-editor-full'));break;
 case 'find-code':{const editor=$('#of-css'),query=$('#of-find').value;if(!query)break;let pos=editor.value.toLowerCase().indexOf(query.toLowerCase(),editor.selectionEnd);if(pos<0)pos=editor.value.toLowerCase().indexOf(query.toLowerCase());if(pos<0){showToast('未找到关键词');break;}editor.focus();editor.setSelectionRange(pos,pos+query.length);editor.scrollTop=editor.value.slice(0,pos).split('\n').length*18-editor.clientHeight/2;break;}
 case 'apply-css':await setConfig(chat,'css',$('#of-css').value);state.editorDraft=config(chat).css;closePanel();refresh();break;
 case 'reset-css':await setConfig(chat,'css','');state.editorDraft='';appearance();refresh();break;
 case 'save-preset':{state.editorDraft=$('#of-css').value;panel('保存预设',`<label class="of-label">预设名称<input id="of-preset-name" placeholder="输入预设名称" maxlength="100"></label><button data-action="confirm-preset" class="of-primary">保存预设</button>`);$('#of-preset-name').focus();break;}
 case 'confirm-preset':{const name=$('#of-preset-name').value.trim();if(!name)throw Error('请填写预设名称');const p={id:uid(),name,css:state.editorDraft||'',updatedAt:Date.now()};await persistChange(()=>presets().push(p),()=>{db.offlineStylePresets=presets().filter(item=>item!==p);});appearance();break;}
 case 'import-style':$('#of-style-file').click();break;
 case 'export-all':download('offline-styles.json',JSON.stringify({version:1,presets:presets()},null,2));break;
 case 'export-preset':{const p=presets().find(p=>p.id===button.dataset.id);if(p)download('offline-style.json',JSON.stringify({version:1,presets:[p]},null,2));break;}
 case 'load-preset':{const p=presets().find(p=>p.id===button.dataset.id);if(p){state.editorDraft=p.css;$('#of-css').value=p.css;}break;}
 case 'delete-preset':{const p=presets().find(p=>p.id===button.dataset.id);panel('删除预设',`<p>确定删除「${escape(p?.name)}」？</p><div class="of-row"><button data-action="confirm-delete-preset" data-id="${escape(button.dataset.id)}" class="of-primary">删除</button><button data-action="style">取消</button></div>`);break;}
 case 'confirm-delete-preset':{const previous=presets();await persistChange(()=>{db.offlineStylePresets=previous.filter(p=>p.id!==button.dataset.id);},()=>{db.offlineStylePresets=previous;});}appearance();break;
 case 'unbind-books':$('#of-inherit-books').checked=false;all('.of-worldbook').forEach(el=>{el.disabled=false;el.checked=false;});break;
 case 'save-setup':await setConfig(chat,'draft',{apiPreset:$('#of-api').value,promptPreset:$('#of-prompt-preset').value,cotEnabled:$('#of-cot-enabled').checked,cotPreset:$('#of-cot-preset').value,prompt:$('#of-prompt').value,inheritWorldbooks:$('#of-inherit-books').checked,worldBookIds:Array.from(all('.of-worldbook:checked')).map(el=>el.value)});closePanel();showToast('设置选择已保存，后续版本接入生效');break;
 }}catch(error){fail(error);}finally{if(mutation){state.pendingAction=false;button.disabled=false;}}
}
function syncEntry() {
 const entry=document.getElementById('offline-chat-menu-btn');if(entry)entry.style.display=currentChatType==='private'?'':'none';
 const room=document.getElementById('chat-room-header-default');if(!room)return;
 let chip=document.getElementById('offline-active-entry');
 const chat=currentChatType==='private'?db.characters?.find(c=>c.id===currentChatId):null;
 if(chat?.offline?.active){if(!chip){chip=document.createElement('button');chip.id='offline-active-entry';chip.type='button';chip.textContent='线下中';chip.style.cssText='font:inherit;font-size:10px;background:#eeeef1;border:0;border-radius:5px;padding:3px 6px;color:#555;white-space:nowrap';chip.addEventListener('click',()=>open().catch(fail));room.querySelector('.title-container')?.append(chip);}chip.hidden=false;}else if(chip)chip.hidden=true;
}
document.addEventListener('keydown',event=>{if(event.target.id==='offline-chat-menu-btn'&&['Enter',' '].includes(event.key)){event.preventDefault();open().catch(fail);}});
document.addEventListener('click',event=>{if(event.target.closest?.('#offline-chat-menu-btn')){event.preventDefault();open().catch(fail);}});
window.KissOffline={open,refresh,syncEntry,isActive:chat=>!!chat?.offline?.active,historyForAI,prompt,request,ensureFloors,textOf,parseFloors,estimate,setHidden,sessionRows,activeSession,migrateSessions,tagMessage,finishSession,deleteArchive,editFloor,deleteFloors};
})();
