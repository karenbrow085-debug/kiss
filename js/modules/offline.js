/* Offline shares the character history. Styling is isolated in Shadow DOM. */
(() => {
'use strict';
const ID = 'kiss-offline-screen';
const DEFAULT_PROMPT = '当前为线下现实互动。用户输入代表其动作、神态、对白或推动剧情的指令。根据双方人设、环境和已有事件，以完整连贯的长文继续剧情，兼顾动作、对白和细节；为用户保留回应空间，不替用户决定或说话。不要输出短信包装格式、语音、转账、表情包或手机操作指令。每轮输出一条完整剧情，篇幅服从用户要求，不强制字数。对白使用中文引号；明确的心理活动用 *斜体标记*，需要强调时用 **粗体标记**，普通叙述直接书写。不要为了格式额外添加心理描写。';
const ICONS = {
 image:'<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m4 17 5-5 4 4 3-3 5 5"/>',
 back:'<path d="M20 12H4m7-7-7 7 7 7"/>', phone:'<path fill="currentColor" stroke="none" d="M6 3h3l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v3c0 3-2 4-4 3A20 20 0 0 1 3 7c-1-2 0-4 3-4Z"/><path d="M14 3a7 7 0 0 1 7 7m-7-3a3 3 0 0 1 3 3" stroke-width="2"/>' ,
 video:'<rect x="3" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/><path d="m15 10 6-3v10l-6-3Z" fill="currentColor" stroke="none"/>' , search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 plus:'<path d="M12 4v16M4 12h16"/>', smile:'<circle cx="12" cy="12" r="9"/><path d="M8 14c2 3 6 3 8 0M8 9h.01M16 9h.01"/>',send:'<path d="m5 11 7-7 7 7M12 4v16"/>', stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
 gift:'<path fill="currentColor" stroke="none" d="M3 10h8V7H5a3 3 0 1 1 5-3l2 3 2-3a3 3 0 1 1 5 3h-6v3h8v4H3zm1 6h7v6H4zm9 0h7v6h-7zM9 5 8 3c-2-1-3 2-1 2zm6 0h2c2 0 1-3-1-2z"/>',mic:'<rect x="9" y="2" width="6" height="13" rx="3" fill="currentColor" stroke="none"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',chevron:'<path d="m9 6 6 6-6 6"/>',edit:'<path d="m4 15-1 6 6-1L21 8l-5-5Z"/><path d="m13 6 5 5"/>',trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',check:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 rabbit:'<path fill="currentColor" stroke="none" d="M10.5 1A1.5 1.5 0 0 1 12 2.5v4.258A4.5 4.5 0 0 1 9.5 15h-3A4.5 4.5 0 0 1 4 6.758V2.5a1.5 1.5 0 1 1 3 0V6h2V2.5A1.5 1.5 0 0 1 10.5 1m-3 11a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1zm-2-3a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 1 0v-2a.5.5 0 0 0-.5-.5m5 0a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 1 0v-2a.5.5 0 0 0-.5-.5"/>'
};
const icon = name => `<svg viewBox="0 0 ${name==='rabbit'?'16 16':'24 24'}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||ICONS.more}</svg>`;
const escape = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const floorLabel = n => `${n} ${n===1?'floor':'floors'}`;
function badgeMark(user) {
 return user?'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m2 8 16-6-5.3 16-3.8-6.1L2 8Z" fill="#e8b5cd" stroke="#64525f" stroke-width="1.1" stroke-linejoin="round"/><path d="m8.9 11.9 9.1-9.9-6.3 12.1" fill="#d58daf" stroke="#64525f" stroke-width=".8" stroke-linejoin="round"/><path d="m8.9 11.9-.5 4.8 3.3-2.6" fill="#f6d5e5" stroke="#64525f" stroke-width=".8" stroke-linejoin="round"/><path d="m4.6 8 9.2-3.5" stroke="#fae4ef" stroke-width=".8"/></svg>':'<svg viewBox="0 0 20 20" aria-hidden="true"><defs><radialGradient id="of-orbit-shade" cx="32%" cy="28%" r="78%"><stop stop-color="#c8eff6"/><stop offset=".55" stop-color="#77bed6"/><stop offset="1" stop-color="#4290b1"/></radialGradient></defs><ellipse cx="10" cy="10.5" rx="9" ry="3.4" transform="rotate(-30 10 10.5)" fill="#8ac5d9" stroke="#3f5264" stroke-width="1"/><circle cx="10" cy="9" r="6" fill="url(#of-orbit-shade)" stroke="#3b5265" stroke-width="1"/><path d="M2 13c3 1 12-3 15.8-7" fill="none" stroke="#38536a" stroke-width="1.3" stroke-linecap="round"/><path d="M3 13.8c3 .6 12-3.5 14.5-6.5" fill="none" stroke="#8ed3e5" stroke-width=".8" stroke-linecap="round"/><path d="M6.6 6.3c1-1.4 2.5-2 4-1.6" fill="none" stroke="#e2f8fb" stroke-width="1.2" stroke-linecap="round"/></svg>';
}
function displayRows(chat) {return (chat.history||[]).filter(m=>isNarrative(m)&&!m.offlineArchiveId&&!!m.offlineNarrative);}
function promptChoices() {
 const source=document.getElementById('cot-prompt-version-select');
 return source?.options?Array.from(source.options).filter(o=>o.value&&o.value!=='custom').map(o=>({value:o.value,label:o.textContent.trim()})):[{value:'uwu',label:'UwU'},{value:'tt',label:'T.T'},{value:'hh',label:'ㅎ.ㅎ（线上）'},{value:'hh_offline',label:'ㅎ-ㅎ（线下）'}];
}
const imageJobs=new Map();
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
 const cfg=config(chat),migrate=cfg.floorVersion!==2,groups=new Map();
 for(const m of chat.history||[]){if(!m.offlineNarrative||!isNarrative(m)){delete m.offlineFloor;continue;}const key=m.offlineSessionId||m.offlineArchiveId||'legacy';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m);}
 for(const [key,rows] of groups){const session=cfg.sessions.find(s=>s.id===key);let next=migrate?1:rows.reduce((n,m)=>Math.max(n,Number.isInteger(m.offlineFloor)?m.offlineFloor+1:1),Math.max(session?.nextFloor||1,key==='legacy'?cfg.nextFloor||1:1));
 for(const m of rows)if(migrate||!Number.isInteger(m.offlineFloor))m.offlineFloor=next++;
 if(session)session.nextFloor=next;else if(key==='legacy')cfg.nextFloor=next;}
 cfg.floorVersion=2;
}
// Deliberately small, escaped rich-text vocabulary; chat content never executes HTML.
function narrativeHtml(text) {
 const inline=(value,depth=0)=>{
  if(depth>8)return escape(value);let out='',last=0;
  const pattern=/\*\*([\s\S]+?)\*\*|\*([^*\n]+)\*|（(?:心想|心声|心理|内心)[：:][^）]*）|【(?:心想|心声|心理|内心)[：:][^】]*】|“[^”]*”|「[^」]*」|『[^』]*』|"[^"\n]+"/g;
  for(const m of value.matchAll(pattern)){
   out+=escape(value.slice(last,m.index));
   if(m[1]!==undefined)out+='<strong>'+inline(m[1],depth+1)+'</strong>';
   else if(m[2]!==undefined)out+='<em class="of-thought">'+inline(m[2],depth+1)+'</em>';
   else if(/^[（【]/.test(m[0]))out+='<em class="of-thought">'+escape(m[0])+'</em>';
   else out+='<span class="of-dialogue">'+escape(m[0][0])+inline(m[0].slice(1,-1),depth+1)+escape(m[0].at(-1))+'</span>';
   last=m.index+m[0].length;
  }
  return out+escape(value.slice(last));
 };
 return String(text??'').split(/\n{2,}/).map(p=>'<p>'+inline(p)+'</p>').join('');
}
// HTML stays folded in the transcript; its CSS/scripts never enter the chat DOM.
function richNarrativeHTML(text,id){
 if(!window.KissOfflineHTML)return narrativeHtml(text);
 let index=0;return window.KissOfflineHTML.partition(text).map(part=>part.type==='text'?narrativeHtml(part.text.trim()):`<button class="of-html-fold" data-action="html-preview" data-id="${escape(id)}" data-block="${index++}" aria-haspopup="dialog"><span class="of-html-symbol" aria-hidden="true">✧</span><span><strong>HTML preview</strong><small>${window.KissOfflineHTML.title(part.text)==='HTML preview'?'':escape(window.KissOfflineHTML.title(part.text))}</small></span><span class="of-html-open">Open</span></button>`).join('');
}
function openHTML(id,index){
 const chat=character(),m=(chat.history||[]).find(row=>row.id===id);if(!m)throw Error('楼层不存在');
 const part=window.KissOfflineHTML?.partition(displayStatus(m,chat).text).filter(p=>p.type==='html')[index];if(!part)throw Error('HTML 内容不存在，请刷新后重试');
 panel('HTML 预览','<iframe class="of-html-frame" title="HTML preview"></iframe>');$('.of-panel').dataset.kind='html';
 const frame=$('.of-html-frame'),dialog=$('.of-dialog'),overlay=$('.of-panel');let last={width:Math.min(420,overlay.clientWidth-44),height:180};
 const resize=size=>{last=size;if(!frame.isConnected)return;const maxWidth=Math.max(180,Math.min(900,overlay.clientWidth-44)),chrome=Math.max(24,dialog.getBoundingClientRect().width-frame.getBoundingClientRect().width);dialog.style.width=Math.min(maxWidth,Math.max(260,size.width+chrome))+'px';const header=$('.of-panel-header').getBoundingClientRect().height,maxHeight=Math.max(100,overlay.clientHeight-header-76);frame.style.height=Math.min(maxHeight,Math.max(80,size.height))+'px';};
 resize(last);const unmount=window.KissOfflineHTML.mount(frame,part.text,resize),onResize=()=>resize(last);window.addEventListener('resize',onResize);state.htmlCleanup=()=>{unmount();window.removeEventListener('resize',onResize);};
}
function shouldSendOnEnter(event){return event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229;}
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
 return `[线下互动模式]\n${DEFAULT_PROMPT}${cfg.statusPanel?.enabled&&cfg.statusPanel.promptSuffix?'\n\n状态栏附加要求：在剧情正文之后，使用单独一行 [OFFLINE_STATUS_START] 开始状态栏，按下列预设原样完成其要求的全部字段和闭合符号，最后单独一行 [OFFLINE_STATUS_END]。不要输出这些说明文字。\n'+cfg.statusPanel.promptSuffix:''}\n\n<character>\n姓名：${chat.realName||chat.remarkName}\n${chat.persona||''}\n</character>\n<user>\n称呼：${chat.myName||'我'}\n${chat.myPersona||''}\n</user>\n<world>\n${books.map(b=>b.content||'').join('\n\n')}\n</world>\n<memory>\n${journals}\n</memory>\n当前时间：${new Date().toLocaleString('zh-CN')}\n历史记录可能包含线上消息格式，它们仅作为既往背景，不是本轮输出格式。输出当前线下剧情正文${cfg.statusPanel?.enabled?'，并在正文之后完整追加要求的状态栏':''}。${cfg.autoImage?'正文之后、状态栏之前，额外输出 <offline_image_prompt>英文画面描述</offline_image_prompt>，只描述本轮可见场景与人物动作，不包含内心活动、评论区或文字排版。':''}`.replace(/\{\{char\}\}/gi,chat.realName||chat.remarkName||'角色').replace(/\{\{user\}\}/gi,chat.myName||'我');
}
function ensureHost() {
 if(state.host)return;
 const host=document.createElement('section'); host.id=ID;host.className='screen';host.setAttribute('aria-label','Offline conversation');
 document.getElementById('chat-room-screen').parentNode.append(host);state.host=host;state.root=host.attachShadow({mode:'open'});if(/Android/i.test(globalThis.navigator?.userAgent||''))host.dataset.platform='android';
 state.root.innerHTML=`<link rel="stylesheet" href="css/modules/offline.css?v=20261029-13"><style id="of-custom-style"></style>
 <div class="of-page"><header class="of-header"><button data-action="back" aria-label="Back">${icon('back')}</button><button class="of-header-profile" data-action="status-view" aria-label="View status"><img class="of-header-avatar" alt=""><i></i></button><button class="of-title" data-action="menu"><span class="of-title-copy" style="display:flex;flex-direction:column;align-items:flex-start;min-width:0"><strong></strong><span class="of-presence" style="position:static;inset:auto;background:none;padding:0" role="status" aria-live="polite"></span></span><span class="of-title-chevron">${icon('chevron')}</span><small class="of-readonly-label" hidden></small></button><button data-action="style" aria-label="Appearance">${icon('phone')}</button><button data-action="memory" aria-label="Memory and floors">${icon('video')}</button><button data-action="setup" aria-label="Conversation setup">${icon('search')}</button></header>
 <div class="of-selection-bar" hidden><button data-action="cancel-selection">Cancel</button><span id="of-selection-count">0 selected</span><button class="of-danger-text" data-action="delete-selected">Delete</button></div><main class="of-messages" aria-label="Conversation"></main>
 <form class="of-composer"><button type="button" data-action="generation-tools" aria-label="Generation controls">${icon('plus')}</button><textarea rows="1" aria-label="Message" placeholder="Message"></textarea><button type="button" data-action="story-tools" aria-label="Archives">${icon('gift')}</button><button type="button" data-action="emoji" aria-label="Emoji">${icon('smile')}</button><button class="of-send" type="button" data-action="send-or-continue" aria-label="Generate reply">${icon('send')}</button></form></div>
 <section class="of-archive-page" hidden><aside class="of-archive-rail"><button data-action="resume-offline" aria-label="Current conversation">${icon('smile')}</button><button class="selected" data-action="archives" aria-label="Archives">${icon('more')}</button><span></span><button data-action="list-back" aria-label="Back to chat">${icon('back')}</button></aside><div class="of-archive-main"><header class="of-archive-header"><h1>Archives</h1><button data-action="new-offline" aria-label="Start offline">${icon('plus')}</button></header><div class="of-archive-search"><span>${icon('search')}</span><input id="of-archive-search" placeholder="Search archives" aria-label="Search archives"></div><div class="of-archive-people"><div><img class="of-archive-char" alt=""><span class="of-archive-person"></span></div><div><img class="of-archive-self" alt=""><span>echo</span></div></div><div class="of-archive-list"></div><footer>Private moments, kept here.</footer></div></section>
 <section class="of-panel" hidden aria-label="设置"><div class="of-dialog" role="dialog" aria-modal="true"><header class="of-panel-header"><button data-action="close-panel" aria-label="返回">${icon('close')}</button><h2></h2><span></span></header><div class="of-panel-body"></div></div></section>`;
 const settingsHost=document.createElement('div');settingsHost.style.display='contents';state.root.append(settingsHost);
 state.panelRoot=settingsHost.attachShadow({mode:'open'});const settingsLink=document.createElement('link');settingsLink.rel='stylesheet';settingsLink.href='css/modules/offline.css?v=20261029-13';state.panelRoot.append(settingsLink,state.root.querySelector('.of-panel'));
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(entries=>{const size=entries[0].borderBoxSize?.[0]?.blockSize||entries[0].target.getBoundingClientRect().height;if(size)$('.of-page').style.setProperty('--of-composer-height',size+'px');}).observe($('.of-composer'));
 state.root.addEventListener('click',onClick);
 installGestures();
 $('#of-archive-search').addEventListener('input',e=>{state.archiveQuery=e.target.value;renderArchives();});
 $('.of-composer').addEventListener('submit',e=>{e.preventDefault();send().catch(fail);});
 $('.of-composer textarea').addEventListener('input',e=>{updateComposer();e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,124)+'px';const chat=character();if(chat){config(chat).composerDraft=e.target.value;clearTimeout(state.draftTimer);state.draftTimer=setTimeout(()=>saveData().catch(fail),500);}});
 $('.of-composer textarea').addEventListener('keydown',e=>{if(shouldSendOnEnter(e)){e.preventDefault();send().catch(fail);}});
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
 state.chatId=chat.id;state.limit=60;state.editorDraft=null;$('.of-composer textarea').value=config(chat).composerDraft||'';$('.of-composer textarea').style.height='auto';updateComposer();
 $('.of-panel-body').replaceChildren();
 const cfg=config(chat);migrateSessions(chat);ensureFloors(chat);
 state.archiveQuery='';$('#of-archive-search').value='';state.archiveId=null;state.selected.clear();state.selecting=false;
 if(startNew&&!cfg.active){
  const session={id:uid(),startAfterMessageId:chat.history?.at(-1)?.id||null,startedAt:Date.now(),nextFloor:1};
  await persistChange(()=>{cfg.active=true;cfg.activeSessionId=session.id;cfg.sessions.push(session);},()=>{cfg.active=false;cfg.activeSessionId=null;cfg.sessions=cfg.sessions.filter(s=>s!==session);});
 }else await saveData();
 state.view=cfg.active?'chat':'archives';switchScreen(ID);closePanel();updateView();syncEntry();
 requestAnimationFrame(()=>{const el=$('.of-messages');el.scrollTop=el.scrollHeight;});
}
function disposeHTML(){state.htmlCleanup?.();state.htmlCleanup=null;}
function closePanel() {disposeHTML();if(!state.root)return;const editor=$('#of-css');if(editor)state.editorDraft=editor.value;$('.of-panel').hidden=true;$('.of-page').inert=false;$('.of-archive-page').inert=false;}
function panel(title,html) {
 disposeHTML();ensureHost();const editor=$('#of-css');if(editor)state.editorDraft=editor.value;
 $('.of-panel .of-dialog').style.removeProperty('width');$('.of-panel').classList.remove('of-editor-full');$('.of-panel').dataset.kind=/编辑|CSS/.test(title)?'editor':/外观|总结与|线下设置|预设/.test(title)?'settings':'compact';$('.of-panel h2').textContent=title;$('.of-panel-body').innerHTML=html;$('.of-panel').hidden=false;$('.of-panel-body').scrollTop=0;$('.of-page').inert=true;$('.of-archive-page').inert=true;
}
function status(text) {if(state.root)$('.of-presence').textContent=text||'';}
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
 $('.of-title strong').textContent=readOnly?(archive.title||defaultSessionTitle(archive)):(chat.remarkName||chat.realName||'Offline');$('.of-readonly-label').hidden=!readOnly;$('.of-readonly-label').textContent=readOnly?'Read-only':'';$('.of-composer textarea').placeholder='Message @'+(chat.remarkName||chat.realName||'');
 setAvatar($('.of-header-avatar'),chat.avatar);
 const custom=$('#of-custom-style');if(custom.textContent!==(config(chat).css||''))custom.textContent=config(chat).css||'';
 const messages=readOnly?sessionRows(chat,archive):displayRows(chat),shown=messages.slice(-state.limit);
 if(state.selecting){const available=new Set(messages.map(m=>m.id));for(const id of state.selected)if(!available.has(id))state.selected.delete(id);$('#of-selection-count').textContent=state.selected.size+' selected';}
 area.replaceChildren();
 if(messages.length>shown.length){const more=document.createElement('button');more.className='of-load';more.dataset.action='load';more.textContent='Load earlier messages';area.append(more);}
 if(!messages.length){const empty=document.createElement('div');empty.className='of-empty';empty.textContent='A moment, just for you two.';area.append(empty);}
 let day='';let previousMode;
 for(const m of shown){
  const date=new Date(m.timestamp||Date.now()),key=date.toDateString();
  if(day&&key!==day){const divider=document.createElement('div');divider.className='of-date';divider.textContent=date.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});area.append(divider);}day=key;
  if(m.offlineNarrative&&previousMode===false){const divider=document.createElement('div');divider.className='of-mode-divider';divider.textContent='Offline started';area.append(divider);}previousMode=!!m.offlineNarrative;
  if(m.offlineHidden&&!readOnly){const row=document.createElement('div');row.className='of-hidden-wrap';const main=document.createElement('button');main.className='of-hidden';main.dataset.action=state.selecting?'toggle-floor':'floor-menu';main.dataset.id=m.id;main.textContent=`${state.selected.has(m.id)?'✓ ':''}#${m.offlineFloor} · Hidden from context`;row.append(main);if(!state.selecting){const restore=document.createElement('button');restore.dataset.action='restore-one';restore.dataset.id=m.id;restore.className='of-restore-link';restore.textContent='Restore';row.append(restore);}area.append(row);continue;}
  const user=m.role==='user',item=document.createElement('article');item.className=`of-message ${user?'of-self':'of-orbit'}`;item.dataset.messageId=m.id;item.dataset.floor=m.offlineFloor;item.classList.toggle('of-selected',state.selected.has(m.id));if(state.selecting&&!readOnly){item.dataset.action='toggle-floor';item.dataset.id=m.id;}
  item.innerHTML=`<img class="of-avatar" alt=""><div class="of-message-content"><div class="of-byline"><strong class="of-name"></strong><span class="of-badge"><span class="of-badge-mark">${badgeMark(user)}</span>${user?'echo':'orbit'}</span><time></time></div><div class="of-prose"></div><div class="of-meta"></div></div>`;
  if(!readOnly){const more=document.createElement('button');more.className='of-message-more';more.dataset.action=state.selecting?'toggle-floor':'floor-menu';more.dataset.id=m.id;more.setAttribute('aria-label',state.selecting?'Select floor '+m.offlineFloor:'Message actions');more.innerHTML=state.selecting?(state.selected.has(m.id)?'✓':'○'):icon('more');item.querySelector('.of-byline').append(more);}
  setAvatar(item.querySelector('img'),user?chat.myAvatar:chat.avatar);
  item.querySelector('.of-name').textContent=user?(chat.myName||'Mio'):(chat.remarkName||chat.realName||'Shen Yu');
  item.querySelector('time').textContent=date.toLocaleString('en-US',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).replace(',','');
  const shownStatus=displayStatus(m,chat);item.querySelector('.of-prose').innerHTML=richNarrativeHTML(shownStatus.text,m.id);
  if(shownStatus.pending||shownStatus.warning){const note=document.createElement('button');note.className='of-status-warning';note.dataset.action='status-repair';note.dataset.id=m.id;note.textContent=shownStatus.pending?'Status incomplete · Review':'Status not found · Review';item.querySelector('.of-message-content').append(note);}
  const imageMarkup=floorImageHtml(m,readOnly);if(imageMarkup)item.querySelector('.of-message-content').insertAdjacentHTML('beforeend',imageMarkup);
  item.querySelector('.of-meta').textContent=[Number.isFinite(m.offlineDuration)?`${m.offlineDuration.toFixed(1)}s`:null,tokensOf(m),`#${m.offlineFloor}`].filter(Boolean).join(' · ');
  area.append(item);
 }
 if(atBottom)area.scrollTop=area.scrollHeight;
}
// A session references the shared messages; it never creates a second history.
function sessionRows(chat,session) {
 const ids=new Set(session.messageIds||[]);
 return (chat.history||[]).filter(m=>isNarrative(m)&&m.offlineNarrative&&(m.offlineSessionId===session.id||ids.has(m.id)));
}
function activeSession(chat) {
 const cfg=config(chat);if(!cfg.active)return null;
 return cfg.sessions.find(s=>s.id===cfg.activeSessionId&&!s.endedAt&&s.status!=='archived')||(!cfg.active?null:cfg.sessions.slice().reverse().find(s=>!s.endedAt&&s.status!=='archived'))||null;
}
function migrateSessions(chat) {
 const cfg=config(chat),history=chat.history||[];
 // Earlier builds tagged online messages while the mode was active. Restore their online ownership.
 for(const m of history)if(!m.offlineNarrative){delete m.offlineSessionId;delete m.offlineArchiveId;}
 for(const session of cfg.sessions){
  const start=history.findIndex(m=>m.id===session.startAfterMessageId),end=history.findIndex(m=>m.id===session.endMessageId);
  if(!session.messageIds){
   const candidates=history.filter((m,index)=>isNarrative(m)&&(m.offlineNarrative||m.offlineSessionId)&&!m.offlineSessionId&&
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
 if(!config(chat).active||!message.offlineNarrative)return;
 let session=activeSession(chat);
 if(!session){session={id:uid(),startedAt:Date.now(),startAfterMessageId:chat.history?.at(-1)?.id||null};config(chat).sessions.push(session);config(chat).activeSessionId=session.id;}
 message.offlineSessionId=session.id;
}
async function finishSession(chat,mode,{title='',summaryId=null}={}) {
 if(!['keep','summary','summary-delete','summary-archive','archive','delete'].includes(mode))throw Error('无效的结束方式');
 const cfg=config(chat),session=activeSession(chat);if(!session)throw Error('未找到当前线下片段');
 const rows=sessionRows(chat,session),ids=new Set(rows.map(m=>m.id));
 const previousHistory=chat.history,previousOffline=JSON.parse(JSON.stringify(cfg));const journal=summaryId?chat.memoryJournals?.find(j=>j.id===summaryId):null,previousFavorite=journal?.isFavorited;const previousJournals=chat.memoryJournals,previousJournalFavorites=(chat.memoryJournals||[]).map(j=>[j,j.isFavorited]);
 if((mode==='summary-delete'||mode==='summary-archive')&&!journal)throw Error('请先成功保存本段总结，再结束线下');
 const previousFlags=rows.map(m=>({archive:m.offlineArchiveId,hidden:m.offlineHidden}));
 await persistChange(()=>{
  cfg.active=false;cfg.activeSessionId=null;cfg.composerDraft='';if(journal&&(mode==='summary'||mode==='summary-delete'||mode==='summary-archive'))journal.isFavorited=true;
  const belongs=j=>j.id===session.summaryId||(j.selectedMessageIds?.length&&j.selectedMessageIds.every(id=>ids.has(id)));
  if(mode==='delete')chat.memoryJournals=(chat.memoryJournals||[]).filter(j=>!belongs(j));
  if(mode==='archive')for(const j of chat.memoryJournals||[])if(belongs(j))j.isFavorited=false;
  if(mode==='delete'||mode==='summary-delete'){chat.history=chat.history.filter(m=>!ids.has(m.id));cfg.sessions=cfg.sessions.filter(s=>s.id!==session.id);}
  else if(rows.length){
   Object.assign(session,{title:title.trim()||defaultSessionTitle(session),status:'archived',endedAt:Date.now(),endMessageId:rows.at(-1)?.id||null,messageIds:[...ids],summaryId:mode==='archive'?null:summaryId||session.summaryId||null});
   session.endMode=mode;rows.forEach(m=>{m.offlineArchiveId=session.id;if(mode==='archive'||mode==='summary-archive')m.offlineHidden=true;});
  }else cfg.sessions=cfg.sessions.filter(s=>s.id!==session.id);
 },()=>{chat.history=previousHistory;chat.offline=previousOffline;chat.memoryJournals=previousJournals;for(const [item,favorite] of previousJournalFavorites){if(favorite===undefined)delete item.isFavorited;else item.isFavorited=favorite;}if(journal){if(previousFavorite===undefined)delete journal.isFavorited;else journal.isFavorited=previousFavorite;}rows.forEach((m,i)=>{if(previousFlags[i].archive===undefined)delete m.offlineArchiveId;else m.offlineArchiveId=previousFlags[i].archive;if(previousFlags[i].hidden===undefined)delete m.offlineHidden;else m.offlineHidden=previousFlags[i].hidden;});});
 return (mode==='delete'||mode==='summary-delete')?null:config(chat).sessions.find(s=>s.id===session.id)||null;
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
 if(rows.some(m=>!isNarrative(m)||!m.offlineNarrative||m.offlineArchiveId))throw Error('归档楼层只能查看，不能编辑或删除');
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
 const readOnly=state.view==='archive';$('.of-composer').hidden=readOnly||state.selecting;$('.of-presence').hidden=readOnly;
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
 panel(`楼层 #${m.offlineFloor}`,`${toolRow('edit-floor','编辑正文','edit',id)}${m.role==='assistant'?toolRow('floor-image','文生图','image',id)+(config(chat).statusPanel?.enabled||m.offlineStatus||m.offlineStatusPending?toolRow('status-repair','状态栏解析','check',id):''):''}${toolRow('delete-floor','删除此楼层','trash',id)}${toolRow('select-floors','多选管理','check',id)}`);
}
function confirmFloorDelete(ids) {
 const rows=editableRows(character(),ids);state.deleteIds=rows.map(m=>m.id);
 panel('删除楼层',`<p class="of-confirm-text">确定删除 ${rows.length} 层记录？</p><p class="of-note">${escape(rows.map(m=>'#'+m.offlineFloor).join('、'))}<br>会同步删除原聊天记录中的这些消息，其他楼层编号不变。已有日记不受影响。</p><div class="of-row"><button class="of-primary of-danger" data-action="confirm-delete-floors">确认删除</button><button data-action="close-panel">取消</button></div>`);
}
function exitDialog() {
 if(isGenerating||state.busy||state.sending)throw Error('请等生成完成或暂停后再结束线下');
 const chat=character(),session=activeSession(chat);if(!session)throw Error('当前没有进行中的线下片段');
 const rows=sessionRows(chat,session);
 panel('结束本次线下',`<label class="of-label">节点标题<input id="of-exit-title" placeholder="可选，默认以日期命名" value="${escape(state.exitTitle||session.title||'')}"></label><p class="of-note">本次 ${rows.length} 层 · 选择结束方式</p><button class="of-exit-choice" data-action="finish-summary"><strong>删除 · 保留总结记忆</strong><small>先总结存入日记，再删除原文，不留下归档</small></button><button class="of-exit-choice of-danger-text" data-action="finish-delete"><strong>删除 · 不保留记忆</strong><small>删除原文及本段生成的总结，不留下归档</small></button><button class="of-exit-choice" data-action="finish-summary-archive"><strong>归档并总结 · 保留记忆</strong><small>原文只读归档，AI 只读取保留的总结</small></button><button class="of-exit-choice" data-action="finish-archive"><strong>仅归档 · 隐藏这段记忆</strong><small>原文只读保留，原文与本段总结不进入 AI 上下文</small></button>`);
}
async function exitAndArchive(mode) {
 const chat=character();if(isGenerating||state.busy)throw Error('请等当前生成结束');
 const session=activeSession(chat);if(!session)throw Error('当前片段已结束');
 const title=$('#of-exit-title')?$('#of-exit-title').value:state.exitTitle||'';state.exitTitle=title;
 if(mode==='delete'){
  panel('删除本次线下',`<p class="of-confirm-text">确定删除本次线下的 ${sessionRows(chat,session).length} 层原文？</p><p class="of-note">删除本段原文和仅由本段生成的总结，不影响其他聊天与日记。此操作无法撤销。</p><div class="of-row"><button class="of-primary of-danger" data-action="confirm-finish-delete">删除并切回线上</button><button data-action="online">返回</button></div>`);return;
 }
 if(mode==='summary'||mode==='summary-delete'||mode==='summary-archive'){state.exitMode=mode;
  const rows=sessionRows(chat,session);if(!rows.length)throw Error('本段没有可总结的楼层，请选择仅收纳');
  panel(mode==='summary-delete'?'删除并保留总结':'归档并保留总结',`<label class="of-label">总结方式<select id="of-exit-method"><option value="current">沿用当前日记风格</option><option value="summary">客观摘要</option><option value="default">角色日记</option><option value="custom">自定义世界书</option></select></label><div id="of-exit-books" hidden>${worldbookChoices('exit-summary-wb',chat.journalStyleSettings?.customWorldBookIds||[])}</div><label class="of-check"><input id="of-exit-favorites" type="checkbox">参考已收藏日记</label><p class="of-note">${mode==='summary-delete'?'总结保存成功后会删除本段原文，无法撤销；只保留日记总结。':'原文只读归档并移出上下文，只保留日记总结供 AI 读取。'}总结失败时不会结束线下。</p><button class="of-primary" data-action="confirm-finish-summary">${mode==='summary-delete'?'生成总结并删除原文':'生成总结并归档'}</button><button data-action="online">返回</button>`);
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
 await finishSession(chat,state.exitMode||'summary-delete',{title:state.exitTitle,summaryId:journal.id});returnOnline();
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
 input.value='';input.style.height='auto';status('');updateComposer();renderMessages();refresh(true);renderChatList();
 return m;
 } finally { state.sending=false; }
}
async function callReply() {
 const chat=character();if(!chat||isGenerating||state.busy||state.callPending||state.view!=='chat'||!config(chat).active)return;
 state.callPending=true;
 try{if($('.of-composer textarea').value.trim()){const saved=await send();if(!saved)return;}await getAiReply(chat.id,'private');}
 finally{state.callPending=false;}
}
async function request(chat,apiConfig,isBackground=false,replacement=null) {
 apiConfig=resolveOfflineApi(chat,apiConfig);if(!apiConfig.url||!apiConfig.key||!apiConfig.model){showApiError(Error('请配置 API 地址、密钥和模型'));return false;}
 if(state.busy||isGenerating&&!isBackground)return;
 const generation=aiGenerationControl.begin(chat.id,'private',isBackground),start=performance.now();
 state.busy=true;if(!isBackground){isGenerating=true;getReplyBtn.disabled=true;regenerateBtn.disabled=true;status('Typing…');}
 let persisted=false;const imageAtStart=!!config(chat).autoImage,statusAtStart=config(chat).statusPanel?{...config(chat).statusPanel}:null;
 try{
  const limit=Number(chat.maxMemory)>0?Number(chat.maxMemory):30;
  let history=historyForAI(chat).filter(m=>m.id!==replacement?.id).filter(m=>!m.isContextDisabled&&!m.isThinking&&!m.isStatusUpdate&&!['mcp-request','mcp-activity'].includes(m.type)).slice(-limit);
  history=filterHistoryForAI(chat,history);
  const messages=[{role:'system',content:prompt(chat)},...history.filter(m=>['user','assistant'].includes(m.role)).map(m=>({role:m.role,content:m.offlineNarrative&&m.role==='assistant'?displayStatus(m,chat).text:textOf(m)})).filter(m=>m.content.trim())];
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
  const cleaned=full.replace(/<(thinking|think)>[\s\S]*?<\/\1>/gi,'').replace(/<(thinking|think)>[\s\S]*$/gi,'').replace(/\[incipere\]/g,'').trim();
  const picture=extractImagePrompt(cleaned),extracted=extractStatus(picture.text,statusAtStart),clean=extracted.text;
  if(!clean)throw Error('API 未返回可显示的剧情正文，请重试');
  const m={id:`msg_offline_${uid()}`,role:'assistant',content:clean,parts:[{type:'text',text:clean}],timestamp:Date.now(),offlineNarrative:true,offlineDuration:(performance.now()-start)/1000,offlineTokens:Number.isFinite(usage)?usage:estimate(clean),offlineTokensEstimated:!Number.isFinite(usage)};
  if(extracted.pending)m.offlineStatusPending=extracted.pending;if(extracted.warning)m.offlineStatusWarning=extracted.warning;
  if(imageAtStart)m.offlineImage={prompt:picture.prompt||defaultImagePrompt(chat,clean)};
  if(extracted.record)m.offlineStatus=extracted.record;const sp=config(chat).statusPanel,oldStatus=sp?{history:sp.history,raw:sp.currentStatusRaw,html:sp.currentStatusHtml}:null;if(sp&&extracted.record){const record={...extracted.record,messageId:m.id};sp.history=[record,...(sp.history||[])].slice(0,20);sp.currentStatusRaw=record.raw;sp.currentStatusHtml=record.html;}
  tagMessage(chat,m);const replacementIndex=replacement?chat.history.indexOf(replacement):-1;if(replacementIndex>=0){m.offlineFloor=replacement.offlineFloor;chat.history.splice(replacementIndex,1,m);}else chat.history.push(m);ensureFloors(chat);try{await saveData();}catch(error){if(sp&&oldStatus){sp.history=oldStatus.history;sp.currentStatusRaw=oldStatus.raw;sp.currentStatusHtml=oldStatus.html;}if(replacementIndex>=0)chat.history.splice(replacementIndex,1,replacement);else chat.history.splice(chat.history.indexOf(m),1);throw error;}persisted=true;
  addMessageBubble(m,chat.id,'private');renderChatList();refresh(true);status('');
  if(imageAtStart)generateFloorImage(chat,m.id).catch(error=>{console.warn('[Offline image]',error.message);if(state.chatId===chat.id&&typeof showToast==='function')showToast('正文已保存，配图未完成：'+error.message);});
 }catch(error){if(error.name==='AbortError')status('Paused');else{status(persisted?'Saved; display refresh failed':'Reply failed · your message is saved');showApiError(error);}}
 finally{state.busy=false;aiGenerationControl.finish(generation);refresh();}
 return persisted;
}
function resolveOfflineApi(chat,fallback) {
 let value={...(fallback||db.apiSettings||{})};const draft=config(chat).draft;
 const name=draft.apiPreset||(!fallback&&chat.exclusiveApiEnabled?chat.exclusiveApiPreset:'');
 if(name){const preset=(db.apiPresets||[]).find(p=>p.name===name);if(!preset?.data)throw Error('API 预设已删除，请重新选择');const d=preset.data;value={...value,...d,url:d.apiUrl||d.url||value.url,key:d.apiKey||d.key||value.key};}
 if(draft.model)value.model=draft.model;return value;
}
async function fetchOfflineModels(chat,presetName) {
 const preview={...chat,offline:{...config(chat),draft:{...config(chat).draft,apiPreset:presetName,model:''}}},c=resolveOfflineApi(preview);
 if(!c.url||!c.key)throw Error('请先保存包含地址和密钥的 API 预设');
 if(typeof BLOCKED_API_DOMAINS!=='undefined'&&BLOCKED_API_DOMAINS.some(d=>c.url.includes(d)))throw Error('该 API 站点已被屏蔽');
 const key=typeof getRandomValue==='function'?getRandomValue(c.key):c.key;
 let url;if(window.AppApi?.modelEndpoint)url=window.AppApi.modelEndpoint({...c,key});else{url=new URL(c.url);let path=url.pathname.replace(/\/+$/,'').replace(/\/chat\/completions$|\/responses$|\/messages$/,'');url.pathname=c.provider==='gemini'?path.replace(/\/v1(?:beta)?$/,'')+'/v1beta/models':path+(/\/v\d+$/.test(path)?'/models':'/v1/models');url.search='';if(c.provider==='gemini')url.searchParams.set('key',key);}
 const headers=c.provider==='gemini'?{}:['anthropic','claude'].includes(c.provider)?{'x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}:{Authorization:'Bearer '+key};
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000),models=[];
 try{for(let page=0;page<20;page++){const response=await fetch(url.href,{headers,signal:controller.signal});if(!response.ok)throw Error('模型拉取失败（HTTP '+response.status+'）');const data=await response.json(),rows=Array.isArray(data)?data:data.data||data.models||[];models.push(...rows.filter(r=>!r.supportedGenerationMethods||r.supportedGenerationMethods.includes('generateContent')).map(r=>typeof r==='string'?r:r.id||r.name).filter(Boolean).map(n=>n.replace(/^models\//,'')));if(data.nextPageToken){url.searchParams.set('pageToken',data.nextPageToken);continue;}if(data.has_more&&data.last_id){url.searchParams.set('after_id',data.last_id);continue;}break;}if(!models.length)throw Error('未返回模型，可手动填写');return [...new Set(models)];}finally{clearTimeout(timer);}
}
async function regenerate(chat) {
 if(isGenerating||state.busy)throw Error('请先暂停当前生成');const session=activeSession(chat),last=session&&sessionRows(chat,session).at(-1);if(!last||last.role!=='assistant')throw Error('本次线下暂无可重新生成的回复');return request(chat,resolveOfflineApi(chat),false,last);
}
function statusFormat(chat,presetId) {
 const source=presetId==='__online__'?chat.statusPanel:(db.statusBarPresets||[]).find(p=>String(p.id)===String(presetId));if(!source)throw Error('状态栏预设不存在，请重新选择');
 if(!source.regexPattern||!source.promptSuffix)throw Error('状态栏预设缺少格式提示或匹配正则');statusRegex(source.regexPattern);
 return {presetId,promptSuffix:source.promptSuffix,regexPattern:source.regexPattern,replacePattern:source.replacePattern||'',historyLimit:source.historyLimit??20};
}
function statusRegex(pattern){let flags='gs';const parts=String(pattern||'').match(/^\/(.*?)\/([a-z]*)$/);if(parts){pattern=parts[1];flags=parts[2]||'gs';if(!flags.includes('s'))flags+='s';}return new RegExp(pattern,flags);}
// Failed status output is preserved separately, never silently discarded or fabricated.
function extractStatus(text,format){
 if(!format?.enabled||!format.regexPattern)return {text,record:null};
 const original=String(text),boundary=/\[OFFLINE_STATUS_START\]|<状态栏格式>/i.exec(original);
 let raw=original,body=null;
 if(boundary){const start=boundary.index+boundary[0].length,rest=original.slice(start),end=/\[OFFLINE_STATUS_END\]|<\/状态栏格式>/i.exec(rest);raw=(end?rest.slice(0,end.index):rest).trim();body=(original.slice(0,boundary.index)+(end?rest.slice(end.index+end[0].length):'')).trim().replace(/(?:\n|^)\s*(?:\*\*\*|---)\s*$/,'').trim();}
 const match=statusRegex(format.regexPattern).exec(raw);
 if(match?.[0]){const html=String(format.replacePattern||'').replace(/\$(\d+)/g,(all,n)=>match[Number(n)]??all);return {text:body??(raw.slice(0,match.index)+raw.slice(match.index+match[0].length)).trim(),record:{raw:match[0],html,timestamp:Date.now(),regexPattern:format.regexPattern,replacePattern:format.replacePattern}};}
 // Legacy replies without an envelope: recognize only a sufficiently specific literal prefix.
 if(body===null){const source=statusRegex(format.regexPattern).source,cut=source.search(/(?<!\\)\(/);if(cut>0){const prefix=source.slice(0,cut);if((prefix.match(/[a-zA-Z\u3400-\u9fff]/g)||[]).length>=4&&!/[|$]/.test(prefix)){try{const found=new RegExp(prefix,'s').exec(original);if(found){body=original.slice(0,found.index).trim();raw=original.slice(found.index).trim();}}catch{}}}}
 return {text:body??original,record:null,pending:body!==null?raw:undefined,warning:'状态栏未匹配，请检查输出是否完整及预设正则'};
}
function displayStatus(m,chat){if(m.role!=='assistant')return {text:textOf(m)};if(m.offlineStatusPending)return {text:textOf(m),pending:m.offlineStatusPending,warning:m.offlineStatusWarning};if(m.offlineStatus)return {text:textOf(m)};const parsed=extractStatus(textOf(m),config(chat).statusPanel);return parsed.pending||parsed.record||m.offlineStatusWarning?parsed:{text:textOf(m)};}
async function reparseStatus(chat,id,raw){
 const [m]=editableRows(chat,[id]),format=config(chat).statusPanel;if(!format?.enabled)throw Error('请先启用状态栏');
 const parsed=extractStatus('[OFFLINE_STATUS_START]'+raw+'[OFFLINE_STATUS_END]',format);if(!parsed.record)throw Error('仍未匹配：请检查字段、结尾符号或预设正则，原文已保留');
 const body=displayStatus(m,chat).text,record={...parsed.record,messageId:m.id},old={...m},previous={...format};
 await persistChange(()=>{m.content=body;m.parts=[{type:'text',text:body}];m.offlineStatus=record;delete m.offlineStatusPending;delete m.offlineStatusWarning;format.history=[record,...(format.history||[]).filter(r=>r.messageId!==id)].slice(0,20);format.currentStatusRaw=record.raw;format.currentStatusHtml=record.html;},()=>{for(const key of Object.keys(m))delete m[key];Object.assign(m,old);for(const key of Object.keys(format))delete format[key];Object.assign(format,previous);});
}
function statusRepair(id){const chat=character(),m=(chat.history||[]).find(m=>m.id===id);if(!m)throw Error('楼层不存在');const shown=displayStatus(m,chat),readonly=!!m.offlineArchiveId;state.statusRepairId=id;panel('状态栏解析',`<p class="of-note">${readonly?'归档只供查看。':'正文与状态栏分别保留。检查原文后可重新解析，不会调用 API。'}</p><label class="of-label">状态栏原文<textarea id="of-status-raw" rows="9" ${readonly?'readonly':''}></textarea></label>${readonly?'':'<button class="of-primary of-full-button" data-action="reparse-status">重新解析</button>'}`);$('#of-status-raw').value=shown.pending||m.offlineStatus?.raw||shown.record?.raw||textOf(m);}
function extractImagePrompt(text){const m=/<offline_image_prompt>([\s\S]*?)(?:<\/offline_image_prompt>|$)/i.exec(text);return {text:m?(text.slice(0,m.index)+text.slice(m.index+m[0].length)).trim():text,prompt:m?.[1]?.trim()||''};}
function defaultImagePrompt(chat,text){return `Illustrate a single scene from this story, no text or speech bubbles. Character: ${chat.realName||chat.remarkName||''}. Scene: ${text.slice(-2400)}`;}
function workshopConfig(chat){
 if(!db.workshopSettings)throw Error('请先在绘图工坊保存生图配置');
 const settings=JSON.parse(JSON.stringify(db.workshopSettings));
 if((settings.provider||'novelai')==='novelai'&&chat.exclusiveWorkshopPromptPreset){const preset=(db.workshopPromptPresets||[]).find(p=>p.id===chat.exclusiveWorkshopPromptPreset);if(preset){settings.positivePrompt=preset.positive||'';settings.characterPrompt=preset.character||'';settings.negativePrompt=preset.negative||'';}}
 return settings;
}
function safeImage(value){return /^(https?:\/\/|data:image\/(?:png|jpeg|jpg|webp|gif|avif);base64,)/i.test(value||'')?String(value):'';}
function floorImageHtml(m,readOnly=false){
 const image=m.offlineImage,busy=imageJobs.has(m);if(!image&&!busy)return '';const url=safeImage(image?.url);
 if(url)return `<figure class="of-floor-image"><button class="of-image-open" data-action="view-floor-image" data-id="${escape(m.id)}" aria-label="View illustration"><img src="${escape(url)}" alt="Scene illustration" loading="lazy"></button><figcaption><span>${busy?'Generating…':'Scene illustration'}</span>${!readOnly?`<button data-action="floor-image" data-id="${escape(m.id)}">${busy?'View progress':'Edit image'}</button>`:''}</figcaption></figure>`;
 return `<div class="of-image-empty"><span>${busy?'Creating your scene…':image?.error?'Image unavailable':'Scene ready to illustrate'}</span>${!readOnly?`<button data-action="floor-image" data-id="${escape(m.id)}">${busy?'View progress':'Image options'}</button>`:''}</div>`;
}
async function saveImagePrompt(chat,id,prompt){const [m]=editableRows(chat,[id]);if(m.role!=='assistant')throw Error('只有回复楼层支持文生图');if(imageJobs.has(m))throw Error('本层图片正在生成，请稍后编辑');if(!prompt.trim())throw Error('请填写生图提示词');const previous=m.offlineImage;await persistChange(()=>m.offlineImage={...(previous||{}),prompt:prompt.trim()},()=>{if(previous===undefined)delete m.offlineImage;else m.offlineImage=previous;});}
async function generateFloorImage(chat,id){
 const [m]=editableRows(chat,[id]);if(m.role!=='assistant')throw Error('只有回复楼层支持文生图');if(imageJobs.has(m))throw Error('本层图片正在生成');
 if(typeof window.executeImageGeneration!=='function')throw Error('绘图工坊尚未就绪');
 const settings=workshopConfig(chat),prompt=m.offlineImage?.prompt||defaultImagePrompt(chat,displayStatus(m,chat).text),content=m.content,previous=m.offlineImage;
 const token={};imageJobs.set(m,token);refresh();
 const valid=()=>db.characters.includes(chat)&&(chat.history||[]).includes(m)&&!m.offlineArchiveId&&m.content===content;
 try{
  const result=await window.executeImageGeneration(settings,prompt);if(!valid())return false;
  let url=result?.imageData;if(typeof url!=='string'||!url.trim())throw Error('生图接口未返回图片');if(!/^(?:https?:|data:)/i.test(url))url='data:image/png;base64,'+url;if(!safeImage(url))throw Error('生图接口返回的图片格式不支持');
  await persistChange(()=>m.offlineImage={prompt,url,updatedAt:Date.now()},()=>{if(previous===undefined)delete m.offlineImage;else m.offlineImage=previous;});return true;
 }catch(error){if(valid()){const failed={...(m.offlineImage||{}),prompt,error:'生成失败，请重试'};try{await persistChange(()=>m.offlineImage=failed,()=>{if(previous===undefined)delete m.offlineImage;else m.offlineImage=previous;});}catch{}}throw error;
 }finally{if(imageJobs.get(m)===token)imageJobs.delete(m);refresh();if(state.chatId===chat.id&&state.imageEditId===id&&$('#of-image-prompt')&&!$('.of-panel').hidden){try{imageDialog(id);}catch{closePanel();}}}
}
function imageDialog(id){
 const chat=character(),[m]=editableRows(chat,[id]);if(m.role!=='assistant')throw Error('只有回复楼层支持文生图');state.imageEditId=id;
 const picture=m.offlineImage||{},busy=imageJobs.has(m),url=safeImage(picture.url),settings=db.workshopSettings||{},provider=settings.provider||'novelai';
 panel(`文生图 · #${m.offlineFloor}`,`<div class="of-image-editor">${url?`<img class="of-image-thumbnail" src="${escape(url)}" alt="当前配图">`:`<div class="of-image-placeholder">${icon('image')}<span>${busy?'图片生成中':'为这一刻配图'}</span></div>`}<div class="of-image-config"><span>绘图工坊</span><span>${escape(provider.toUpperCase())}${settings[provider+'Model']?' · '+escape(settings[provider+'Model']):''}</span></div><label class="of-label">本层提示词<textarea id="of-image-prompt" rows="5" ${busy?'readonly':''} placeholder="描述人物、动作与场景"></textarea></label>${picture.error?'<p class="of-note">上次生成未完成，已有图片会保留。</p>':''}<div class="of-image-actions"><button data-action="save-image-prompt" ${busy?'disabled':''}>保存提示词</button><button class="of-primary" data-action="generate-floor-image" ${busy?'disabled':''}>${busy?'生成中…':url?'重新生成':'生成图片'}</button></div></div>`);
 $('#of-image-prompt').value=picture.prompt||defaultImagePrompt(chat,displayStatus(m,chat).text);
}
function viewFloorImage(id){const m=(character().history||[]).find(m=>m.id===id),url=safeImage(m?.offlineImage?.url);if(!url)throw Error('图片暂不可用');panel('查看配图',`<img class="of-image-full" src="${escape(url)}" alt="场景配图">`);}

function statusChoices(chat,query=''){const rows=[...(chat.statusPanel?.regexPattern?[{id:'__online__',name:'沿用线上当前格式'}]:[]),...(db.statusBarPresets||[])];return rows.filter(p=>String(p.name||'').toLowerCase().includes(query.toLowerCase()));}
function renderStatusChoices(){const list=$('#of-status-choices');if(!list)return;const rows=statusChoices(character(),$('#of-status-search').value);list.innerHTML=rows.map(p=>`<button data-action="status-preset" data-id="${escape(p.id)}" aria-pressed="${state.statusPresetDraft===p.id}"><span>${escape(p.name)}</span><i>${state.statusPresetDraft===p.id?'✓':''}</i></button>`).join('')||'<p class="of-note">暂无匹配预设，请先在已有状态栏管理中添加。</p>';}
async function saveSetup(){
 const chat=character(),cfg=config(chat),draft={apiPreset:$('#of-api').value,model:$('#of-model').value.trim(),promptPreset:$('#of-prompt-preset').value,cotEnabled:$('#of-cot-enabled').checked,cotPreset:$('#of-cot-preset').value,prompt:$('#of-prompt-preset').value==='custom'?($('#of-prompt')?.value||''):'',customPrompt:$('#of-prompt')?.value??state.customPromptDraft??'',inheritWorldbooks:$('#of-inherit-books').checked,worldBookIds:all('.of-worldbook:checked').map(el=>el.value)};
 const autoImage=$('#of-auto-image').checked,oldImage=cfg.autoImage,enabled=$('#of-status-enabled').checked,oldDraft=cfg.draft,oldPanel=cfg.statusPanel,format=enabled?statusFormat(chat,state.statusPresetDraft):{};
 const nextPanel={...(oldPanel||{}),...format,enabled};await persistChange(()=>{cfg.draft=draft;cfg.statusPanel=nextPanel;cfg.autoImage=autoImage;},()=>{cfg.draft=oldDraft;cfg.autoImage=oldImage;if(oldPanel===undefined)delete cfg.statusPanel;else cfg.statusPanel=oldPanel;});
 closePanel();refresh();showToast('设置已保存');
}
function viewStatus(){const chat=character(),sp=config(chat).statusPanel;if(!sp?.history?.length&&!sp?.currentStatusHtml&&state.view!=='archive'){const pending=displayRows(chat).findLast(m=>m.role==='assistant'&&(displayStatus(m,chat).pending||m.offlineStatusWarning));if(pending){statusRepair(pending.id);return;}}if(!sp?.enabled&&!sp?.history?.length&&!sp?.currentStatusHtml){showToast('请先在线下设置中启用状态栏');return;}if(!window.openCharacterStatusPanel){showToast('状态栏查看器尚未就绪');return;}if(state.view==='archive'){const archive=config(chat).sessions.find(s=>s.id===state.archiveId),records=sessionRows(chat,archive).filter(m=>m.offlineStatus).map(m=>m.offlineStatus).reverse();window.openCharacterStatusPanel(chat,{...sp,history:records,currentStatusHtml:records[0]?.html||''},{readOnly:true});}else window.openCharacterStatusPanel(chat,sp);}
async function sendFromStatus(text){const input=$('.of-composer textarea'),previous=input.value;input.value=text;try{return await send();}finally{input.value=previous;config(character()).composerDraft=previous;updateComposer();await saveData();}}
function presets(){db.offlineStylePresets ||= [];return db.offlineStylePresets;}
function cssEditor() {
 panel('CSS 编辑器',`<div class="of-section-title"><span>页面样式</span><span><button data-action="style-presets">预设库</button><button data-action="expand-css" aria-label="放大编辑">${icon('expand')}</button></span></div><div class="of-find"><input id="of-find" placeholder="搜索代码关键词" aria-label="搜索代码关键词"><button data-action="find-code">下一处</button></div><textarea id="of-css" class="of-code" spellcheck="false" aria-label="页面 CSS"></textarea><div class="of-row"><button data-action="apply-css" class="of-primary">应用</button><button data-action="save-preset">存为预设</button><button data-action="reset-css" class="of-text-button">重置</button></div>`);
 $('#of-css').value=state.editorDraft??config(character()).css??'';
}
function toolRow(action,label,mark,id='') {return `<button class="of-tool-row" data-action="${action}" ${id?'data-id="'+escape(id)+'"':''}><span class="of-tool-icon">${icon(mark)}</span><span>${label}</span></button>`;}
function appearance() {cssEditor();}
function stylePresets() {
 panel('美化预设',`<div class="of-preset-tools"><input id="of-preset-search" class="of-wide" placeholder="搜索预设" aria-label="搜索预设"><button data-action="import-style">导入</button><button data-action="export-all">导出</button></div><div id="of-presets"></div><p class="of-note">支持 CSS / TXT / DOCX / JSON</p><input id="of-style-file" type="file" accept=".css,.txt,.docx,.json" multiple hidden>`);
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
function memoryEditor(tab='summary') {
 const chat=character();ensureFloors(chat);const floors=displayRows(chat),last=floors.at(-1)?.offlineFloor||1;
 panel('总结与楼层',`<div class="of-tabs"><button class="selected" data-action="memory-tab" data-tab="summary">总结</button><button data-action="memory-tab" data-tab="hide">隐藏楼层</button></div><div id="of-memory-summary"><label class="of-label">楼层范围<input id="of-summary-range" placeholder="1–20, 24, 28–30" value="1-${last}"></label><p class="of-note">支持连续范围和独立楼层，例如 1-20, 24, 28-30。隐藏后编号不变。</p><label class="of-label">总结方式<select id="of-summary-method"><option value="current">沿用当前日记风格</option><option value="summary">客观摘要</option><option value="default">角色日记</option><option value="custom">自定义世界书</option></select></label><div id="of-summary-books" hidden>${worldbookChoices('summary-wb',chat.journalStyleSettings?.customWorldBookIds||[])}</div><label class="of-check"><input id="of-summary-favorites" type="checkbox">参考已收藏日记</label><label class="of-check"><input id="of-summary-hide" type="checkbox">日记保存成功后隐藏所选楼层</label><p class="of-note">隐藏只排除原消息，已有日记可能仍保留相关信息。</p><button data-action="summarize" class="of-primary of-full-button">生成并存入日记</button></div><div id="of-memory-hide" hidden><label class="of-label">楼层范围<input id="of-hide-range" placeholder="1–20, 24, 28–30"></label><div class="of-row"><button data-action="hide-floors" class="of-primary">隐藏</button><button data-action="restore-floors">恢复</button></div><p class="of-note">隐藏后原文仍保留，但不进入后续 AI 上下文，可随时恢复。</p><div class="of-hidden-list">${floors.filter(m=>m.offlineHidden).map(m=>`<button data-action="restore-one" data-id="${escape(m.id)}">#${m.offlineFloor} · 恢复</button>`).join('')||'暂无隐藏楼层。'}</div></div>`);
 $('#of-summary-method').addEventListener('change',e=>{$('#of-summary-books').hidden=e.target.value!=='custom';});selectMemoryTab(tab);
}
function memory() {memoryEditor('summary');}
function selectMemoryTab(tab) {
 $('#of-memory-summary').hidden=tab!=='summary';$('#of-memory-hide').hidden=tab!=='hide';all('.of-tabs button').forEach(b=>b.classList.toggle('selected',b.dataset.tab===tab));
}
function parseFloors(value,chat) {
 const selected=new Set(),available=new Map(displayRows(chat).map(m=>[m.offlineFloor,m]));
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
 const choices=promptChoices();
 panel('线下设置',`<div class="of-settings-group"><label class="of-inline-field"><span>专属 API</span><select id="of-api" aria-label="专属 API"><option value="">沿用当前聊天</option>${(db.apiPresets||[]).map(p=>`<option value="${escape(p.name)}">${escape(p.name)}</option>`).join('')}</select></label><div class="of-model-editor"><label class="of-label">当前模型<input id="of-model" aria-label="当前模型" placeholder="选择或手动输入模型"></label><div class="of-find"><input id="of-model-search" placeholder="搜索模型" aria-label="搜索模型"><button data-action="fetch-models">拉取模型</button></div><div id="of-model-results" class="of-model-results"></div><small id="of-model-status" role="status"></small></div><label class="of-inline-field"><span>提示词</span><select id="of-prompt-preset" aria-label="提示词"><option value="">跟随当前提示词</option>${choices.map(p=>`<option value="${escape(p.value)}">${escape(p.label)}</option>`).join('')}<option value="custom">自定义</option></select></label><div id="of-custom-prompt"></div><label class="of-inline-field"><span>思维链</span><input id="of-cot-enabled" type="checkbox" class="of-switch"></label><label class="of-inline-field"><span>思维链预设</span><select id="of-cot-preset" aria-label="思维链预设"><option value="">沿用当前预设</option>${(db.cotPresets||[]).map(p=>`<option value="${escape(p.id)}">${escape(p.name)}</option>`).join('')}</select></label></div><details class="of-worldbook-details"><summary>绑定世界书 <span>选择与解绑</span></summary><label class="of-check"><input id="of-inherit-books" type="checkbox">沿用线上绑定</label>${worldbookChoices('of-worldbook',draft.worldBookIds||character().worldBookIds||[])}<button data-action="unbind-books">全部解绑</button></details><div class="of-settings-group"><label class="of-inline-field"><span>启用状态栏</span><input id="of-status-enabled" aria-label="启用状态栏" type="checkbox" class="of-switch"></label><div id="of-status-picker" hidden><input id="of-status-search" class="of-wide" placeholder="搜索已有状态栏" aria-label="搜索已有状态栏"><div id="of-status-choices"></div></div></div><div class="of-settings-group of-image-settings"><label class="of-inline-field"><span>文生图</span><input id="of-auto-image" aria-label="文生图" type="checkbox" class="of-switch"></label><p class="of-workshop-source">每次回复后自动配图 · 使用绘图工坊当前配置</p></div><p class="of-note">API、模型、文生图与状态栏即时生效；提示词、思维链和世界书选择暂存待接入。</p><button data-action="save-setup" class="of-primary of-full-button">保存设置</button>`);
 $('#of-api').value=draft.apiPreset||'';try{$('#of-model').value=resolveOfflineApi(character()).model||'';}catch(error){$('#of-model').value='';$('#of-model-status').textContent=error.message;}state.modelRows=[];const modelResults=()=>{const query=$('#of-model-search').value.toLowerCase();$('#of-model-results').innerHTML=state.modelRows.filter(n=>n.toLowerCase().includes(query)).map(n=>`<button data-action="choose-model" data-id="${escape(n)}">${escape(n)}</button>`).join('');};$('#of-model-search').addEventListener('input',modelResults);state.drawModels=modelResults;$('#of-api').addEventListener('change',()=>{state.modelRevision=(state.modelRevision||0)+1;state.modelRows=[];modelResults();const name=$('#of-api').value;const c=resolveOfflineApi({...character(),offline:{...cfg,draft:{...draft,apiPreset:name,model:''}}});$('#of-model').value=c.model||'';$('#of-model-status').textContent='';});$('#of-prompt-preset').value=choices.some(p=>p.value===draft.promptPreset)||draft.promptPreset==='custom'?draft.promptPreset:'';$('#of-cot-enabled').checked=!!draft.cotEnabled;$('#of-cot-preset').value=draft.cotPreset||'';$('#of-inherit-books').checked=draft.inheritWorldbooks!==false;
 $('#of-auto-image').checked=!!cfg.autoImage;$('#of-status-enabled').checked=!!cfg.statusPanel?.enabled;state.statusPresetDraft=cfg.statusPanel?.presetId||(character().statusPanel?.regexPattern?'__online__':db.statusBarPresets?.[0]?.id||'');$('#of-status-picker').hidden=!$('#of-status-enabled').checked;$('#of-status-enabled').addEventListener('change',()=>$('#of-status-picker').hidden=!$('#of-status-enabled').checked);$('#of-status-search').addEventListener('input',renderStatusChoices);renderStatusChoices();
 state.customPromptDraft=draft.promptPreset==='custom'?(draft.prompt||''):(draft.customPrompt||'');
 const sync=()=>{const current=$('#of-prompt');if(current)state.customPromptDraft=current.value;$('#of-custom-prompt').replaceChildren();if($('#of-prompt-preset').value==='custom'){$('#of-custom-prompt').innerHTML='<label class="of-label of-custom-prompt-label">自定义提示词<textarea id="of-prompt" rows="5" placeholder="输入当前线下使用的提示词"></textarea></label>';$('#of-prompt').value=state.customPromptDraft;}
 $('#of-cot-preset').disabled=!$('#of-cot-enabled').checked;all('.of-worldbook').forEach(el=>el.disabled=$('#of-inherit-books').checked);};
 $('#of-prompt-preset').addEventListener('change',sync);$('#of-cot-enabled').addEventListener('change',sync);$('#of-inherit-books').addEventListener('change',sync);sync();
}
function updateComposer() {if(!state.root)return;$('.of-send').innerHTML=icon('send');$('.of-send').setAttribute('aria-label','Generate reply');}

function menu(){panel('线下',`<div class="of-menu-group">${toolRow('archives','线下归档','more')}${toolRow('diary','查看日记','edit')}${toolRow('select-floors','多选楼层','check')}</div><div class="of-menu-group">${toolRow('online','结束线下 · 切回线上','back')}</div><p class="of-note">左上角返回会保留当前线下状态。</p>`);}
async function onClick(event) {
 if(event.composedPath()[0]===$('.of-panel')){closePanel();return;}
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
 case 'finish-summary':await exitAndArchive('summary-delete');break;
 case 'finish-summary-archive':await exitAndArchive('summary-archive');break;
 case 'finish-archive':await exitAndArchive('archive');break;
 case 'finish-delete':await exitAndArchive('delete');break;
 case 'confirm-finish-delete':await finishSession(chat,'delete',{title:state.exitTitle});returnOnline();break;
 case 'confirm-finish-summary':await summarizeAndFinish();break;

 case 'menu':menu();break;
 case 'generation-tools':panel('生成',`<div class="of-generation-list"><button data-action="pause" class="of-generation-action"><span><strong>暂停生成</strong><small>停止当前请求</small></span><span class="of-action-key"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 19V5h4v14zm-8 0V5h4v14z"/></svg></span></button><button data-action="regenerate" class="of-generation-action"><span><strong>重新生成</strong><small>替换最近一条回复</small></span><span class="of-action-key"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 20q-3.35 0-5.675-2.325T4 12t2.325-5.675T12 4q1.725 0 3.3.712T18 6.75V4h2v7h-7V9h4.2q-.8-1.4-2.187-2.2T12 6Q9.5 6 7.75 7.75T6 12t1.75 4.25T12 18q1.925 0 3.475-1.1T17.65 14h2.1q-.7 2.65-2.85 4.325T12 20"/></svg></span></button></div>`);break;
 case 'regenerate':closePanel();await regenerate(chat);break;
 case 'fetch-models':{const name=$('#of-api').value,revision=state.modelRevision||0,target=$('#of-model-results');button.disabled=true;$('#of-model-status').textContent='正在拉取…';try{const rows=await fetchOfflineModels(chat,name);if($('#of-model-results')!==target||$('#of-api').value!==name||(state.modelRevision||0)!==revision)break;state.modelRows=rows;state.drawModels();$('#of-model-status').textContent=`${rows.length} 个模型`;}catch(error){if($('#of-model-results')===target)$('#of-model-status').textContent=error.name==='AbortError'?'请求超时，请重试':error.message;}finally{button.disabled=false;}break;}
 case 'choose-model':$('#of-model').value=button.dataset.id;break;
 case 'style':appearance();break;
 case 'css-editor':cssEditor();break;
 case 'style-presets':stylePresets();break;
 case 'memory-summary':memoryEditor('summary');break;
 case 'memory-hidden':memoryEditor('hide');break;
 case 'send-or-continue':await callReply();break;
 case 'story-tools':showArchives();break;
 case 'emoji':panel('表情',`<div class="of-emoji-grid">${['☺️','🥺','🤍','🫶','✨','🌙','☁️','🫧'].map(text=>`<button data-action="insert-emoji" data-id="${text}">${text}</button>`).join('')}</div>`);break;
 case 'insert-emoji':{const input=$('.of-composer textarea');input.value+=button.dataset.id;config(chat).composerDraft=input.value;updateComposer();closePanel();input.focus();break;}
 case 'memory':memory();break;
 case 'setup':setup();break;
 case 'load':{const area=$('.of-messages'),height=area.scrollHeight,top=area.scrollTop;state.limit+=60;render(false);area.scrollTop=top+area.scrollHeight-height;break;}
 case 'online':exitDialog();break;
 case 'continue':closePanel();if(!isGenerating)await getAiReply(chat.id,'private');break;
 case 'pause':pauseAiGeneration();status('Paused');closePanel();break;
 case 'diary':closePanel();renderJournalList();switchScreen('memory-journal-screen');break;
 case 'memory-tab':selectMemoryTab(button.dataset.tab);break;
 case 'summarize':await summarize();break;
 case 'hide-floors':case 'restore-floors':{const ids=parseFloors($('#of-hide-range').value,chat);await setHidden(chat,ids,action==='hide-floors');memoryEditor('hide');refresh();break;}
 case 'restore-one':{const m=chat.history.find(m=>m.id===button.dataset.id);if(m){await setHidden(chat,new Set([m.id]),false);refresh();if(!$('.of-panel').hidden){memoryEditor('hide');}}break;}
 case 'expand-css':$('.of-panel').classList.toggle('of-editor-full');button.setAttribute('aria-pressed',$('.of-panel').classList.contains('of-editor-full'));break;
 case 'find-code':{const editor=$('#of-css'),query=$('#of-find').value;if(!query)break;let pos=editor.value.toLowerCase().indexOf(query.toLowerCase(),editor.selectionEnd);if(pos<0)pos=editor.value.toLowerCase().indexOf(query.toLowerCase());if(pos<0){showToast('未找到关键词');break;}editor.focus();editor.setSelectionRange(pos,pos+query.length);editor.scrollTop=editor.value.slice(0,pos).split('\n').length*18-editor.clientHeight/2;break;}
 case 'apply-css':await setConfig(chat,'css',$('#of-css').value);state.editorDraft=config(chat).css;closePanel();refresh();break;
 case 'reset-css':await setConfig(chat,'css','');state.editorDraft='';appearance();refresh();break;
 case 'save-preset':{state.editorDraft=$('#of-css').value;panel('保存预设',`<label class="of-label">预设名称<input id="of-preset-name" placeholder="输入预设名称" maxlength="100"></label><button data-action="confirm-preset" class="of-primary">保存预设</button>`);$('#of-preset-name').focus();break;}
 case 'confirm-preset':{const name=$('#of-preset-name').value.trim();if(!name)throw Error('请填写预设名称');const p={id:uid(),name,css:state.editorDraft||'',updatedAt:Date.now()};await persistChange(()=>presets().push(p),()=>{db.offlineStylePresets=presets().filter(item=>item!==p);});appearance();break;}
 case 'import-style':$('#of-style-file').click();break;
 case 'export-all':download('offline-styles.json',JSON.stringify({version:1,presets:presets()},null,2));break;
 case 'export-preset':{const p=presets().find(p=>p.id===button.dataset.id);if(p)download('offline-style.json',JSON.stringify({version:1,presets:[p]},null,2));break;}
 case 'load-preset':{const p=presets().find(p=>p.id===button.dataset.id);if(p){state.editorDraft=p.css;cssEditor();$('#of-css').value=p.css;}break;}
 case 'delete-preset':{const p=presets().find(p=>p.id===button.dataset.id);panel('删除预设',`<p>确定删除「${escape(p?.name)}」？</p><div class="of-row"><button data-action="confirm-delete-preset" data-id="${escape(button.dataset.id)}" class="of-primary">删除</button><button data-action="style">取消</button></div>`);break;}
 case 'confirm-delete-preset':{const previous=presets();await persistChange(()=>{db.offlineStylePresets=previous.filter(p=>p.id!==button.dataset.id);},()=>{db.offlineStylePresets=previous;});}appearance();break;
 case 'unbind-books':$('#of-inherit-books').checked=false;all('.of-worldbook').forEach(el=>{el.disabled=false;el.checked=false;});break;
 case 'save-setup':await saveSetup();break;
 case 'status-preset':state.statusPresetDraft=button.dataset.id;renderStatusChoices();break;
 case 'status-view':viewStatus();break;
 case 'html-preview':openHTML(button.dataset.id,Number(button.dataset.block));break;
 case 'status-repair':statusRepair(button.dataset.id);break;
 case 'reparse-status':button.disabled=true;try{await reparseStatus(chat,state.statusRepairId,$('#of-status-raw').value);closePanel();refresh();showToast('状态栏已解析，点击顶部头像查看');}finally{button.disabled=false;}break;
 case 'floor-image':imageDialog(button.dataset.id);break;
 case 'view-floor-image':viewFloorImage(button.dataset.id);break;
 case 'save-image-prompt':await saveImagePrompt(chat,state.imageEditId,$('#of-image-prompt').value);closePanel();refresh();break;
 case 'generate-floor-image':{const id=state.imageEditId;button.disabled=true;try{await saveImagePrompt(chat,id,$('#of-image-prompt').value);closePanel();await generateFloorImage(chat,id);}finally{button.disabled=false;}break;}
 }}catch(error){fail(error);}finally{if(mutation){state.pendingAction=false;button.disabled=false;}}
}
function syncEntry() {
 const entry=document.getElementById('offline-chat-menu-btn');if(entry)entry.style.display=currentChatType==='private'?'':'none';
 const chat=currentChatType==='private'?db.characters?.find(c=>c.id===currentChatId):null;
 if(entry){const label=entry.querySelector('.expansion-item-name');if(label)label.textContent='线下';entry.setAttribute('aria-label','线下');}
 let badge=document.getElementById('offline-active-entry');
 if(!chat?.offline?.active){badge?.remove();return;}
 const header=document.getElementById('chat-room-header-default');if(!header)return;
 if(!badge){badge=document.createElement('div');badge.id='offline-active-entry';badge.style.cssText='flex:0 0 auto;width:100%;position:relative;z-index:1';
 const root=badge.attachShadow({mode:'open'});root.innerHTML=`<style>:host{display:block}button{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;border:0;border-bottom:1px solid #e8e8ec;background:#f4f4f7;color:#666673;padding:8px 16px;font:12px/18px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;text-align:left;cursor:pointer}i{height:6px;width:6px;border-radius:50%;background:#9394ae;box-shadow:0 0 0 3px #e8e8f0}span{flex:1}small{font:inherit;color:#90909c}svg{width:12px;height:12px}</style><button type="button" aria-label="正在线下中，返回线下"><i></i><span>正在线下中</span><small>返回线下</small>${icon('chevron')}</button>`;root.querySelector('button').addEventListener('click',()=>open().catch(fail));header.after(badge);}
}
document.addEventListener('keydown',event=>{if(event.target.id==='offline-chat-menu-btn'&&['Enter',' '].includes(event.key)){event.preventDefault();open().catch(fail);}});
document.addEventListener('click',event=>{if(event.target.closest?.('#offline-chat-menu-btn')){event.preventDefault();open().catch(fail);}});
window.KissOffline={open,refresh,syncEntry,isActive:chat=>!!chat?.offline?.active,historyForAI,prompt,request,ensureFloors,textOf,parseFloors,estimate,setHidden,displayRows,promptChoices,sessionRows,activeSession,migrateSessions,tagMessage,finishSession,deleteArchive,editFloor,deleteFloors,resolveOfflineApi,fetchOfflineModels,regenerate,narrativeHtml,shouldSendOnEnter,statusFormat,extractStatus,statusChoices,sendFromStatus,displayStatus,reparseStatus,extractImagePrompt,workshopConfig,saveImagePrompt,generateFloorImage,floorImageHtml,richNarrativeHTML};
})();
