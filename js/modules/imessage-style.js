/* An isolated iMessage view. The existing chat remains the data/action controller. */
(() => {
'use strict';
const asset=new URL('imessage-view.css?v=20261115-isolated-3',document.currentScript.src.replace('/js/modules/','/css/modules/')).href;
const entryUnread=new WeakMap();
let chat=null,host=null,shadow=null,frame=0,observers=[],disposers=[],sourceMap=new WeakMap(),forceBottom=false,loadEarlier=false,lastChatId=null,hold=0,pressed=null,menuNode=null,menuObserver=null,bodyObserver=null,lastAnchor=null,suppressClick=0;
const enabled=c=>c?.defaultAppearance==='imessage';
const room=()=>document.getElementById('chat-room-screen');
const $=s=>shadow?.querySelector(s);
const source=id=>document.getElementById(id);
const icons={copy:'<rect x="8" y="8" width="12" height="14" rx="2"/><path d="M16 8V2H3v15h5"/>',translate:'<path d="M3 5h12M9 2v3m4 0C11 11 8 15 3 17m2-9c2 4 5 7 9 9m0 3 4-11 4 11m-7-3h6"/>',select:'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7 12 3 3 7-7"/>',edit:'<path d="m4 16 12-12 4 4L8 20H4Zm9-9 4 4"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',back:'<path d="m14 4-8 8 8 8"/>',video:'<rect x="2" y="5" width="13" height="14" rx="4"/><path d="m15 9 7-4v14l-7-4Z"/>',plus:'<path d="M12 5v14M5 12h14"/>',wave:'<path d="M4 10v4m4-7v10m4-14v18m4-14v10m4-7v4"/>',up:'<path d="M12 19V5m-6 6 6-6 6 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',down:'<path d="m5 9 7 7 7-7"/>',reply:'<path d="m9 5-7 6 7 6v-4h5c4 0 6 2 8 6-1-8-5-10-13-10Z"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',check:'<path d="m5 12 4 4L19 6"/>'};
const svg=(name)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name]||icons.more)+'</svg>';
function listen(node,type,fn,opts){if(!node)return;node.addEventListener(type,fn,opts);disposers.push(()=>node.removeEventListener(type,fn,opts));}
function observe(node,fn,options){if(!node)return;const o=new MutationObserver(fn);o.observe(node,options);observers.push(o);}
function enter(c){entryUnread.set(c,Math.max(0,Number(c.unreadCount)||0));}
function night(){return typeof db!=='undefined'&&db.homeScreenMode==='night';}
function syncNight(){if(host)host.toggleAttribute('night',night());}
function action(id){source(id)?.click();syncControls();}
function closeMenu(){if(typeof removeContextMenu==='function')removeContextMenu();clearOwnMenu();}
function teardown(){clearTimeout(hold);cancelAnimationFrame(frame);frame=0;observers.forEach(o=>o.disconnect());observers=[];disposers.forEach(f=>f());disposers=[];closeMenu();host?.remove();host=shadow=null;sourceMap=new WeakMap();}
function apply(c){
 chat=c;const root=room();if(!root)return;
 root.classList.toggle('ki-imessage',enabled(c));
 // Remove the first implementation's generated decorations, including legacy sessions.
 root.querySelectorAll('[data-ki-owned],.ki-receipt,.ki-unread-divider').forEach(n=>n.remove());
 const input=source('message-input');if(input?.hasAttribute('data-ki-placeholder')){input.placeholder=input.getAttribute('data-ki-placeholder');input.removeAttribute('data-ki-placeholder');}
 if(!enabled(c)){teardown();lastChatId=null;return;}
 if(!host||!host.isConnected)mount(root);
 if(lastChatId!==c.id){forceBottom=true;lastChatId=c.id;closeMenu();}
 host.style.setProperty('display','block','important');syncNight();syncHeader();syncControls();schedule();
}
function mount(root){
 host=document.createElement('kiss-imessage-view');
 for(const [k,v]of Object.entries({all:'initial',display:'block',position:'absolute',inset:'0',width:'100%',height:'100%',margin:'0',padding:'0',border:'0',zIndex:'12',isolation:'isolate',visibility:'visible',pointerEvents:'auto',transform:'none',filter:'none',opacity:'1'}))host.style.setProperty(k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()),v,'important');
 host.dataset.platform=/Android/i.test(typeof navigator!=='undefined'?navigator.userAgent:'')?'android':'other';
 shadow=host.attachShadow({mode:'open'});
 shadow.innerHTML=`<link rel="stylesheet" href="${asset}"><div class="surface"><div class="wallpaper"></div><main class="history" aria-label="聊天信息" tabindex="-1"></main><header class="floating-header"><button class="glass back" aria-label="返回聊天列表">${svg('back')}<span class="unread-count" hidden></span></button><button class="contact" aria-label="打开聊天设置"><img class="avatar" alt=""><span class="glass name"><b></b><span aria-hidden="true">›</span></span></button><button class="glass video" aria-label="通话">${svg('video')}</button></header><div class="typing" role="status" hidden>•••</div><button class="glass jump" aria-label="跳到最新消息" hidden>${svg('down')}<span></span></button><footer class="composer"><div class="quote glass" hidden><span></span><button aria-label="取消引用">${svg('close')}</button></div><div class="compose-row"><button class="glass add" aria-label="展开功能">${svg('plus')}</button><div class="glass input-capsule"><textarea rows="1" aria-label="iMessage信息" placeholder="iMessage信息" enterkeyhint="send"></textarea><button class="submit" aria-label="获取回复">${svg('wave')}</button></div></div></footer><section class="tools glass" aria-label="聊天功能" hidden></section><section class="selection glass" hidden><button data-original="cancel-multi-select-btn">取消</button><b></b><button data-original="delete-selected-btn">删除</button><button data-original="collect-selected-btn">收藏</button></section><div class="menu-layer" hidden></div></div>`;
 root.append(host);
 listen($('.back'),'click',e=>{e.stopPropagation();root.querySelector('#chat-room-header-default .back-btn')?.click();});
 listen($('.contact'),'click',e=>{e.stopPropagation();closeMenu();action('chat-settings-btn');});
 listen($('.video'),'click',e=>{e.stopPropagation();action('video-call-btn');});
 listen($('.add'),'click',e=>{e.stopPropagation();$('.tools').hidden=!$('.tools').hidden;if(!$('.tools').hidden){$('.composer textarea').blur();renderTools();}else if(typeof showPanel==='function')showPanel('none');});
 const input=$('textarea');
 listen(input,'input',()=>{const original=source('message-input');if(original){original.value=input.value;original.dispatchEvent(new Event('input',{bubbles:true}));}syncSubmit();resizeInput();});
 listen(input,'keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();submit();}});
 listen(input,'focus',()=>{$('.tools').hidden=true;if(typeof showPanel==='function')showPanel('none');syncViewport();});
 listen($('.submit'),'click',e=>{e.stopPropagation();submit();});
 listen($('.quote button'),'click',()=>action('cancel-reply-btn'));
 listen($('.jump'),'click',()=>{$('.history').scrollTo({top:$('.history').scrollHeight,behavior:'smooth'});$('.jump').hidden=true;});
 listen($('.selection'),'click',e=>{const b=e.target.closest('[data-original]');if(b)action(b.dataset.original);});
 const history=$('.history');listen(history,'click',clickMessage);listen(history,'contextmenu',e=>{e.preventDefault();const row=e.target.closest('.message-wrapper');if(row)longPress(row,e.clientX,e.clientY);});
 listen(history,'pointerdown',e=>{if(e.button!==0)return;const row=e.target.closest('.message-wrapper[data-id]');if(!row)return;pressed={x:e.clientX,y:e.clientY,row};clearTimeout(hold);hold=setTimeout(()=>{suppressClick=Date.now()+650;longPress(row,e.clientX,e.clientY);},450);});
 const release=()=>{clearTimeout(hold);pressed=null;};listen(history,'pointerup',release);listen(history,'pointercancel',release);listen(history,'pointermove',e=>{if(pressed&&Math.hypot(e.clientX-pressed.x,e.clientY-pressed.y)>8)release();});
 listen(history,'scroll',()=>{clearTimeout(hold);updateJump();},{passive:true});
 observe(source('message-area'),()=>schedule(),{childList:true,subtree:true,characterData:true,attributes:true});
 observe(source('chat-input-default'),()=>syncControls(),{attributes:true,subtree:true,childList:true});
 observe(source('message-input-default'),()=>syncControls(),{attributes:true,subtree:true,childList:true});
 observe(source('reply-preview-bar'),()=>syncControls(),{attributes:true,subtree:true,childList:true,characterData:true});
 observe(source('typing-indicator'),()=>syncControls(),{attributes:true,subtree:true,childList:true,characterData:true});
 observe(source('multi-select-bar'),()=>{syncControls();schedule();},{attributes:true,subtree:true,characterData:true,childList:true});
 observe(source('chat-expansion-panel'),()=>syncPanel(),{attributes:true,subtree:true,childList:true});
 listen(source('message-input'),'input',()=>syncControls());
 if(window.visualViewport)listen(window.visualViewport,'resize',syncViewport);
 listen(window,'resize',syncViewport);
}
function syncHeader(){
 if(!host||!chat)return;
 $('.name b').textContent=chat.remarkName||chat.name||chat.realName||'';
 const avatar=$('.avatar');avatar.src=chat.avatar||'';avatar.hidden=!chat.avatar;
 const count=typeof db!=='undefined'?[...db.characters,...db.groups].filter(c=>c!==chat).reduce((n,c)=>n+Math.max(0,Number(c.unreadCount)||0),0):0;
 const badge=$('.unread-count');badge.hidden=!count;badge.textContent=count>99?'99+':String(count);
 $('.back').setAttribute('aria-label',count?'返回，其他聊天有 '+count+' 条未读消息':'返回聊天列表');
 const wallpaper=$('.wallpaper');wallpaper.style.backgroundImage=chat.chatBg?'url('+JSON.stringify(chat.chatBg)+')':'none';host.toggleAttribute('wallpaper',!!chat.chatBg);
}
function syncControls(){
 if(!host)return;
 const input=$('textarea'),original=source('message-input');if(original&&input.value!==original.value){input.value=original.value;resizeInput();}syncSubmit();
 const reply=source('reply-preview-bar'),quote=$('.quote');quote.hidden=!reply?.classList.contains('visible');
 quote.querySelector('span').textContent=reply?.querySelector('.reply-preview-text')?.textContent||'';
 const typing=source('typing-indicator');$('.typing').hidden=!typing||typing.style.display==='none'||!typing.textContent.trim();
 const selecting=room()?.classList.contains('multi-select-active');$('.selection').hidden=!selecting;$('.composer').hidden=!!selecting;
 $('.selection b').textContent=source('select-count')?.textContent||'选择消息';
 const favorite=$('.selection [data-original="collect-selected-btn"]');if(favorite)favorite.hidden=!source('collect-selected-btn');
 syncNight();syncViewport();
}
function syncSubmit(){const b=$('.submit');if(!b)return;const text=$('textarea').value.trim();const generating=!!source('get-reply-btn')?.disabled;b.classList.toggle('send',!!text);b.innerHTML=svg(text?'up':'wave');b.setAttribute('aria-label',text?'发送信息':'获取回复');b.disabled=generating;}
function resizeInput(){const input=$('textarea');if(!input)return;input.style.height='22px';input.style.height=Math.min(104,Math.max(22,input.scrollHeight))+'px';}
function submit(){if(!host)return;const sending=!!$('textarea').value.trim();const run=sending&&typeof window.sendMessage==='function'?window.sendMessage():action(sending?'send-message-btn':'get-reply-btn');Promise.resolve(run).catch(()=>{}).finally(()=>syncControls());}
function syncViewport(){if(!host)return;const vv=window.visualViewport;const inset=vv?Math.max(0,host.getBoundingClientRect().bottom-vv.height-vv.offsetTop):0;$('.surface').style.bottom=inset+'px';}
function mirror(original){
 const clone=original.cloneNode(true);const originals=[original,...original.querySelectorAll('*')],clones=[clone,...clone.querySelectorAll('*')];
 clones.forEach((n,i)=>{sourceMap.set(n,originals[i]);n.removeAttribute('style');for(const a of [...n.attributes])if(a.name.startsWith('on'))n.removeAttribute(a.name);});
 clone.querySelectorAll('.message-info,.message-time,.ki-receipt,.ki-unread-divider,.kr-dock').forEach(n=>n.remove());
 clone.querySelectorAll('script,style,link').forEach(n=>n.remove());
 for(const brand of clone.querySelectorAll('.receipt-brand'))brand.textContent=clone.querySelector('.pay-status-text')?'付款请求':'订单';
 for(const oldIcon of clone.querySelectorAll('.gift-card-icon')){const icon=document.createElement('span');icon.className='gift-icon';icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 11h16v10H4zM2 7h20v4H2zM12 7v14"/><path d="M12 7H8a3 3 0 1 1 3-3Zm0 0h4a3 3 0 1 0-3-3Z"/></svg>';oldIcon.replaceWith(icon);}
 for(const voice of clone.querySelectorAll('.voice-bubble')){const wave=document.createElement('span');wave.className='voice-wave';wave.setAttribute('aria-hidden','true');for(let i=0;i<44;i++){const bar=document.createElement('i');bar.style.height=(3+Math.abs(Math.sin(i*1.9))*10)+'px';wave.append(bar);}voice.querySelector('.duration')?.before(wave);}
 return clone;
}
function schedule(bottom=false,earlier=false){if(!host)return;forceBottom=forceBottom||bottom;loadEarlier=loadEarlier||earlier;if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=0;renderMessages();});}
function renderMessages(){
 if(!host||!enabled(chat))return;
 const original=source('message-area'),list=$('.history');if(!original)return;
 const wasBottom=list.scrollHeight-list.scrollTop-list.clientHeight<70,oldHeight=list.scrollHeight,oldTop=list.scrollTop;
 const fragment=document.createDocumentFragment();const history=(chat.history||[]).filter(m=>!m.offlineNarrative&&!m.offlineSessionId&&!m.offlineArchiveId&&!m.offlineBoundary&&!m.offlineHidden);
 const incoming=history.filter(m=>m.role==='assistant'),count=entryUnread.get(chat)||0,firstUnread=count?incoming[Math.max(0,incoming.length-count)]?.id:null;
 let lastSent=-1;for(let i=history.length-1;i>=0;i--)if(history[i].role==='user'){lastSent=i;break;}
 for(const originalRow of original.children){
  const clone=mirror(originalRow);if(String(originalRow.dataset.id)===String(firstUnread)&&firstUnread!=null){const divider=document.createElement('div');divider.className='unread-divider';divider.textContent='未读信息';fragment.append(divider);}
  const message=history.find(m=>String(m.id)===String(originalRow.dataset.id));
  if(message){decorateReactions(clone,message);if(lastSent>=0&&message===history[lastSent]&&!message.deliveryFailed&&!message.isWithdrawn){const label=document.createElement('small');label.className='delivery';label.textContent=history.slice(lastSent+1).some(m=>m.role==='assistant')?'已读':'已送达';clone.append(label);}}
  fragment.append(clone);
 }
 list.replaceChildren(fragment);
 const rows=[...list.querySelectorAll('.message-wrapper')];rows.forEach((row,i)=>{const next=rows[i+1];row.classList.toggle('tail',!next||next.dataset.continuous!=='true'||row.classList.contains('sent')!==next.classList.contains('sent'));});
 if(forceBottom||wasBottom)list.scrollTop=list.scrollHeight;else if(loadEarlier)list.scrollTop=oldTop+list.scrollHeight-oldHeight;else list.scrollTop=oldTop;
 forceBottom=loadEarlier=false;syncHeader();syncControls();updateJump();
}
function updateJump(){const list=$('.history'),jump=$('.jump');if(!list||!jump)return;jump.hidden=list.scrollHeight-list.scrollTop-list.clientHeight<150;}
function clickMessage(e){
 if(Date.now()<suppressClick){e.preventDefault();e.stopPropagation();return;}
 e.stopPropagation();if(!$('.tools').hidden){$('.tools').hidden=true;return;}
 const badge=e.target.closest('[data-reaction]');if(badge){react(badge.closest('[data-id]')?.dataset.id,badge.dataset.reaction);return;}
 const original=sourceMap.get(e.target);if(original){original.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));schedule();}
}
function longPress(row,x,y){const original=sourceMap.get(row);if(!original||!row.dataset.id)return;lastAnchor=row;if(typeof handleMessageLongPress==='function')handleMessageLongPress(original,x,y);}
function decorateReactions(row,message){const reactions=Object.entries(message.bubbleReactions||{}).filter(([,r])=>r?.emoji);if(!reactions.length)return;const anchor=row.querySelector('.message-bubble,.voice-bubble,.image-bubble')||row;const dock=document.createElement('div');dock.className='tapbacks';for(const [author,reaction]of reactions){const b=document.createElement('button');b.className='tapback';b.textContent=reaction.emoji;b.setAttribute('aria-label',(author==='user'?'我':'角色')+'贴的表情 '+reaction.emoji);if(author==='user')b.dataset.reaction=reaction.emoji;dock.append(b);}anchor.append(dock);row.classList.add('reacted');}
const pendingReactions=new WeakSet();
async function react(id,emoji){
 const message=chat?.history?.find(m=>String(m.id)===String(id));if(!message||message.isWithdrawn||!['user','assistant'].includes(message.role)||pendingReactions.has(message))return;
 if(window.PhoneBackup?.isPinned(chat)){window.showToast?.('存档正在处理，请稍后再试');return;}
 const before=message.bubbleReactions;message.bubbleReactions={...before};if(before?.user?.emoji===emoji)delete message.bubbleReactions.user;else message.bubbleReactions.user={emoji,at:Date.now()};pendingReactions.add(message);
 try{if(window.PhoneBackup?.saveChat)await window.PhoneBackup.saveChat(chat);else if(typeof saveData==='function')await saveData();closeMenu();if(typeof window.renderMessages==='function')window.renderMessages(false,false);else schedule();}catch(e){message.bubbleReactions=before;window.showToast?.(e.message||'表情保存失败');}finally{pendingReactions.delete(message);}
}
function renderTools(){
 const tools=$('.tools');tools.replaceChildren();const close=document.createElement('button');close.className='tool-close';close.setAttribute('aria-label','收起功能');close.innerHTML=svg('close');close.onclick=()=>{tools.hidden=true;if(typeof showPanel==='function')showPanel('none');};tools.append(close);
 const order=['photo-video-btn','sticker-toggle-btn','voice-message-btn'];const nodes=[...document.querySelectorAll('#chat-expansion-panel .expansion-item')];
 const items=order.map(id=>source(id)).filter(Boolean).concat(nodes.filter(n=>!order.includes(n.id)));
 const colors=['#32c966','#a875f5','#ff594f','#ffad0a','#00b9e9','#6c91f1'];
 items.forEach((n,i)=>{if(n.style.display==='none'||n.hidden)return;const b=document.createElement('button');b.className='tool';const icon=document.createElement('span');icon.className='tool-icon';icon.style.background=colors[i%colors.length];const image=n.querySelector('svg,img');if(image)icon.append(image.cloneNode(true));else icon.innerHTML=svg('more');const name=document.createElement('span');name.textContent=n.id==='sticker-toggle-btn'?'贴纸':n.querySelector('.expansion-item-name')?.textContent||n.getAttribute('title')||'更多';b.append(icon,name);b.onclick=e=>{e.stopPropagation();tools.hidden=true;action(n.id);};tools.append(b);});
}
function syncPanel(){
 if(!host)return;const panel=source('chat-expansion-panel'),sticker=source('panel-sticker-area');if(panel?.classList.contains('visible')&&sticker?.style.display!=='none'&&sticker){const tools=$('.tools');tools.hidden=false;const clone=mirror(sticker);clone.classList.add('sticker-panel');tools.replaceChildren(clone);clone.addEventListener('click',e=>{e.stopPropagation();sourceMap.get(e.target)?.click();});}
}
async function copy(text){try{await navigator.clipboard.writeText(text);}catch{const field=document.createElement('textarea');field.value=text;field.style.cssText='position:fixed;left:-9999px';document.body.append(field);field.select();try{document.execCommand('copy');}finally{field.remove();}}}
function clearOwnMenu(){menuObserver?.disconnect();bodyObserver?.disconnect();menuObserver=bodyObserver=null;menuNode=null;const layer=$('.menu-layer');if(layer){layer.hidden=true;layer.replaceChildren();}}
function menuContains(event){const layer=$('.menu-layer');return !!layer&&!layer.hidden&&(event.composedPath?.().includes(layer));}
function menu(node){
 if(!host||!room()?.classList.contains('active'))return;
 clearOwnMenu();menuNode=node;node.classList.add('ki-source-menu');node.style.setProperty('visibility','hidden','important');node.setAttribute('aria-hidden','true');
 const update=()=>requestAnimationFrame(()=>{if(node.isConnected&&host)renderMenu(node);});
 menuObserver=new MutationObserver(update);menuObserver.observe(node,{subtree:true,childList:true});
 bodyObserver=new MutationObserver(()=>{if(!node.isConnected)clearOwnMenu();});bodyObserver.observe(document.body,{childList:true});update();
}
function renderMenu(node){
 if(menuNode!==node||!host)return;const layer=$('.menu-layer');layer.replaceChildren();layer.hidden=false;
 const scrim=document.createElement('button');scrim.className='scrim';scrim.setAttribute('aria-label','关闭消息菜单');scrim.onclick=e=>{e.stopPropagation();closeMenu();};layer.append(scrim);
 const card=document.createElement('div');card.className='message-actions glass';card.setAttribute('role','menu');
 const reactionStrip=document.createElement('div');reactionStrip.className='quick-reactions glass';for(const emoji of ['❤️','👍','👎','😂','‼️','❓']){const b=document.createElement('button');b.textContent=emoji;b.setAttribute('aria-label','贴 '+emoji);b.onclick=e=>{e.stopPropagation();react(lastAnchor?.dataset.id,emoji);};reactionStrip.append(b);}layer.append(reactionStrip);
 const originals=[...node.querySelectorAll('.kmsg-action')];
 const make=(label,icon,run)=>{const b=document.createElement('button');b.className='message-action';b.setAttribute('role','menuitem');b.innerHTML=svg(icon);const text=document.createElement('span');text.textContent=label;b.append(text);b.onclick=e=>{e.stopPropagation();run();syncControls();schedule();};card.append(b);return b;};
 const reply=originals.find(b=>b.querySelector('span')?.textContent==='引用');if(reply)make('回复','reply',()=>{reply.click();$('textarea')?.focus();});
 make('拷贝','copy',()=>{const text=lastAnchor?.querySelector('.bubble-content,.voice-transcript,.receipt-bubble,.forwarded-chat-preview')?.textContent||lastAnchor?.textContent||'';copy(text);closeMenu();});
 const translation=lastAnchor?.querySelector('.translation-text');if(translation)make('显示译文','translate',()=>{translation.classList.add('active');closeMenu();});
 const selection=originals.find(b=>b.querySelector('span')?.textContent==='删除');if(selection)make('选择','select',()=>selection.click());
 make('更多…','more',()=>{card.replaceChildren();make('返回','back',()=>renderMenu(node));for(const original of originals){const label=original.querySelector('span')?.textContent||original.textContent;const b=make(label,label.includes('编辑')?'edit':label.includes('删除')?'trash':'more',()=>original.click());if(original.classList.contains('danger')||label==='删除')b.classList.add('danger');}});layer.append(card);
 const bounds=host.getBoundingClientRect(),a=lastAnchor?.querySelector('.message-bubble,.image-bubble,.voice-bubble')?.getBoundingClientRect()||lastAnchor?.getBoundingClientRect()||bounds;
 if(lastAnchor&&a.top>=bounds.top&&a.bottom<=bounds.bottom){const preview=lastAnchor.cloneNode(true);preview.classList.add('menu-preview');preview.style.left=(a.left-bounds.left)+'px';preview.style.top=(a.top-bounds.top)+'px';preview.style.width=a.width+'px';layer.append(preview);}
 const left=Math.max(12,Math.min(a.left-bounds.left,bounds.width-252));const available=Math.max(110,bounds.height-160);card.style.maxHeight=Math.min(400,available)+'px';const h=card.getBoundingClientRect().height;
 let top=a.bottom-bounds.top+12;if(top+h>bounds.height-72)top=Math.max(112,a.top-bounds.top-h-12);top=Math.max(112,Math.min(top,bounds.height-h-72));card.style.left=left+'px';card.style.top=top+'px';card.style.maxHeight=Math.max(100,bounds.height-top-72)+'px';reactionStrip.style.left=Math.max(10,Math.min(a.left-bounds.left,bounds.width-294))+'px';reactionStrip.style.top=Math.max(60,Math.min(a.top-bounds.top-55,top-56))+'px';
 layer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMenu();}});}
window.KissIMessageStyle={enabled,enter,apply,syncNight,schedule,decorate:()=>schedule(),menu,menuContains};
})();
