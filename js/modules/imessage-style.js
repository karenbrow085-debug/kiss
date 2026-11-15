/* An isolated iMessage view. The existing chat remains the data/action controller. */
(() => {
'use strict';
const asset=new URL('imessage-view.css?v=20261116-imessage-shape-9',document.currentScript.src.replace('/js/modules/','/css/modules/')).href;
const entryUnread=new WeakMap();
let chat=null,host=null,shadow=null,liquid=null,frame=0,observers=[],disposers=[],sourceMap=new WeakMap(),forceBottom=false,loadEarlier=false,lastChatId=null,hold=0,pressed=null,menuNode=null,menuObserver=null,bodyObserver=null,lastAnchor=null,suppressClick=0,focusedQuote=null;
const enabled=c=>c?.defaultAppearance==='imessage';
const room=()=>document.getElementById('chat-room-screen');
const $=s=>shadow?.querySelector(s);
const source=id=>document.getElementById(id);
const icons={copy:'<rect x="8" y="8" width="12" height="14" rx="2"/><path d="M16 8V2H3v15h5"/>',translate:'<path d="M3 5h12M9 2v3m4 0C11 11 8 15 3 17m2-9c2 4 5 7 9 9m0 3 4-11 4 11m-7-3h6"/>',select:'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7 12 3 3 7-7"/>',edit:'<path d="m4 16 12-12 4 4L8 20H4Zm9-9 4 4"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',back:'<path d="m14 4-8 8 8 8"/>',video:'<rect x="2" y="5" width="13" height="14" rx="4"/><path d="m15 9 7-4v14l-7-4Z"/>',plus:'<path d="M12 5v14M5 12h14"/>',wave:'<path d="M4 10v4m4-7v10m4-14v18m4-14v10m4-7v4"/>',up:'<path d="M12 19V5m-6 6 6-6 6 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',down:'<path d="m5 9 7 7 7-7"/>',reply:'<path d="m9 5-7 6 7 6v-4h5c4 0 6 2 8 6-1-8-5-10-13-10Z"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',check:'<path d="m5 12 4 4L19 6"/>'};
const svg=(name)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name]||icons.more)+'</svg>';
function listen(node,type,fn,opts){if(!node)return;node.addEventListener(type,fn,opts);disposers.push(()=>node.removeEventListener(type,fn,opts));}
function observe(node,fn,options){if(!node)return;const o=new MutationObserver(fn);o.observe(node,options);observers.push(o);}
function enter(c){entryUnread.set(c,Math.max(0,Number(c.unreadCount)||0));}
function night(){return !!chat?.chatBg&&!!host?.hasAttribute('dark-backdrop');}
function syncNight(){if(host){host.removeAttribute('night');host.style.setProperty('background-color','#fff','important');liquid?.schedule();}}
function action(id){source(id)?.click();syncControls();}
function closeMenu(){if(typeof removeContextMenu==='function')removeContextMenu();clearOwnMenu();}
function teardown(){liquid?.dispose();liquid=null;clearTimeout(hold);cancelAnimationFrame(frame);frame=0;observers.forEach(o=>o.disconnect());observers=[];disposers.forEach(f=>f());disposers=[];closeMenu();host?.remove();host=shadow=null;sourceMap=new WeakMap();focusedQuote=null;}
function apply(c){
 chat=c;const root=room();if(!root)return;
 root.classList.toggle('ki-imessage',enabled(c));
 // Remove the first implementation's generated decorations, including legacy sessions.
 root.querySelectorAll('[data-ki-owned],.ki-receipt,.ki-unread-divider').forEach(n=>n.remove());
 const input=source('message-input');if(input?.hasAttribute('data-ki-placeholder')){input.placeholder=input.getAttribute('data-ki-placeholder');input.removeAttribute('data-ki-placeholder');}
 if(!enabled(c)){teardown();lastChatId=null;return;}
 if(!host||!host.isConnected)mount(root);
 if(lastChatId!==c.id){forceBottom=true;lastChatId=c.id;focusedQuote=null;albumState.clear();closeMenu();closeTools();}
 host.style.setProperty('display','block','important');syncNight();syncHeader();syncControls();schedule();
}
function layout(){return `<link rel="stylesheet" href="${asset}"><div class="surface"><div class="wallpaper"></div><main class="history" aria-label="聊天信息" tabindex="-1"></main><section class="reply-focus" aria-label="回复会话" hidden><div class="reply-feed"></div></section><header class="floating-header"><button class="glass back" aria-label="返回聊天列表">${svg('back')}<span class="unread-count" hidden></span></button><button class="contact" aria-label="打开聊天设置"><img class="avatar" alt=""><span class="glass name"><b></b><span aria-hidden="true">›</span></span></button><button class="glass video" aria-label="通话">${svg('video')}</button><button class="glass reply-close" aria-label="关闭回复会话" hidden>${svg('close')}</button></header><div class="typing" role="status" hidden>•••</div><button class="glass jump" aria-label="跳到最新消息" hidden>${svg('down')}<span></span></button><footer class="composer"><div class="compose-row"><button class="glass add" aria-label="聊天功能" aria-expanded="false">${svg('plus')}</button><div class="glass input-capsule"><textarea rows="1" aria-label="iMessage信息" placeholder="iMessage信息" enterkeyhint="send"></textarea><button class="submit" aria-label="获取回复">${svg('wave')}</button></div></div></footer><button class="tools-dismiss" aria-label="收起功能" hidden></button><section class="tools glass" aria-label="聊天功能" hidden><div class="tools-scroll"></div></section><section class="selection glass" hidden><button data-original="cancel-multi-select-btn">取消</button><b></b><button data-original="delete-selected-btn">删除</button><button data-original="collect-selected-btn">收藏</button></section><div class="menu-layer" hidden></div></div>`;}
function mount(root){
 host=document.createElement('kiss-imessage-view');
 for(const [k,v]of Object.entries({all:'initial',display:'block',position:'absolute',inset:'0',width:'100%',height:'100%',margin:'0',padding:'0',border:'0',zIndex:'12',isolation:'isolate',visibility:'visible',pointerEvents:'auto',transform:'none',filter:'none',opacity:'1'}))host.style.setProperty(k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()),v,'important');
 host.dataset.platform=/Android/i.test(typeof navigator!=='undefined'?navigator.userAgent:'')?'android':'other';
 shadow=host.attachShadow({mode:'open'});
 shadow.innerHTML=layout();
 root.append(host);
 listen($('.back'),'click',e=>{e.stopPropagation();root.querySelector('#chat-room-header-default .back-btn')?.click();});
 listen($('.contact'),'click',e=>{e.stopPropagation();closeMenu();action('chat-settings-btn');});
 listen($('.video'),'click',e=>{e.stopPropagation();action('video-call-btn');});
 listen($('.add'),'click',e=>{
  e.stopPropagation();
  if(!$('.tools').hidden){closeTools();return;}
  $('textarea').blur();renderTools();setToolsOpen(true);
 });
 listen($('.tools-dismiss'),'click',closeTools);
 listen($('.tools'),'keydown',e=>{if(e.key==='Escape'){closeTools();$('.add').focus();}});
 const input=$('textarea');
 listen(input,'input',()=>{const original=source('message-input');if(original){original.value=input.value;original.dispatchEvent(new Event('input',{bubbles:true}));}syncSubmit();resizeInput();});
 listen(input,'keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();submit();}});
 listen(input,'focus',()=>{closeTools();syncViewport();});
 listen($('.submit'),'click',e=>{e.stopPropagation();submit();});
 listen($('.reply-close'),'click',()=>{
  focusedQuote=null;
  action('cancel-reply-btn');
  $('textarea').blur();
 });
 listen($('.reply-feed'),'click',clickMessage);
 listen($('.menu-layer'),'keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMenu();}});
 listen(source('message-area'),'kiss-voice-progress',e=>{
  const id=e.target.closest('.message-wrapper')?.dataset.id;
  for(const row of shadow.querySelectorAll('.history .message-wrapper,.reply-feed .message-wrapper')){
   if(row.dataset.id===id)paintVoice(row.querySelector('.voice-bubble'),e.detail);
  }
 });
 listen($('.jump'),'click',()=>{$('.history').scrollTo({top:$('.history').scrollHeight,behavior:'smooth'});$('.jump').hidden=true;});
 listen($('.selection'),'click',e=>{const b=e.target.closest('[data-original]');if(b)action(b.dataset.original);});
 const history=$('.history');listen(history,'click',clickMessage);listen(history,'contextmenu',e=>{e.preventDefault();const row=e.target.closest('.message-wrapper');if(row)longPress(row,e.clientX,e.clientY);});
 listen(history,'pointerdown',e=>{if(e.button!==0)return;const row=e.target.closest('.message-wrapper[data-id]');if(!row)return;pressed={x:e.clientX,y:e.clientY,row,album:e.target.closest('.im-album')};clearTimeout(hold);hold=setTimeout(()=>{suppressClick=Date.now()+650;longPress(row,e.clientX,e.clientY);},450);});
 const release=()=>{clearTimeout(hold);pressed=null;};listen(history,'pointerup',e=>{if(pressed?.album&&!room()?.classList.contains('multi-select-active')){const dx=e.clientX-pressed.x,dy=e.clientY-pressed.y,id=pressed.row.dataset.id,count=Number(pressed.album.dataset.photoCount)||0,state=albumState.get(id)||{index:0,expanded:false};if(!state.expanded&&Math.abs(dx)>28&&Math.abs(dx)>Math.abs(dy)){state.index=Math.max(0,Math.min(count-1,state.index+(dx<0?1:-1)));albumState.set(id,state);suppressClick=Date.now()+450;schedule();}}release();});listen(history,'pointercancel',release);listen(history,'pointermove',e=>{if(pressed&&Math.hypot(e.clientX-pressed.x,e.clientY-pressed.y)>8){clearTimeout(hold);if(!pressed.album)pressed=null;}});
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
 liquid=window.KissIMessageLiquid?.create({host,root:shadow})||null;
}
function syncHeader(){
 if(!host||!chat)return;
 $('.name b').textContent=chat.remarkName||chat.name||chat.realName||'';
 const avatar=$('.avatar');avatar.src=chat.avatar||'';avatar.hidden=!chat.avatar;
 const count=typeof db!=='undefined'?[...db.characters,...db.groups].filter(c=>c!==chat).reduce((n,c)=>n+Math.max(0,Number(c.unreadCount)||0),0):0;
 const badge=$('.unread-count');badge.hidden=!count;badge.textContent=count>99?'99+':String(count);
 $('.back').setAttribute('aria-label',count?'返回，其他聊天有 '+count+' 条未读消息':'返回聊天列表');
 const wallpaper=$('.wallpaper');wallpaper.style.backgroundImage=chat.chatBg?'url('+JSON.stringify(chat.chatBg)+')':'none';host.toggleAttribute('wallpaper',!!chat.chatBg);liquid?.setBackground(chat.chatBg||'');
}
function syncControls(){
 if(!host)return;
 const input=$('textarea'),original=source('message-input');if(original&&input.value!==original.value){input.value=original.value;resizeInput();}syncSubmit();
 syncReplyFocus();
 const typing=source('typing-indicator');$('.typing').hidden=!typing||typing.style.display==='none'||!typing.textContent.trim();
 const selecting=room()?.classList.contains('multi-select-active');$('.selection').hidden=!selecting;$('.composer').hidden=!!selecting;
 $('.selection b').textContent=source('select-count')?.textContent||'选择消息';
 const favorite=$('.selection [data-original="collect-selected-btn"]');if(favorite)favorite.hidden=!source('collect-selected-btn');
 syncNight();syncViewport();
}
function syncSubmit(){const b=$('.submit');if(!b)return;const text=$('textarea').value.trim();const generating=!!source('get-reply-btn')?.disabled;b.classList.toggle('send',!!text);b.innerHTML=svg(text?'up':'wave');b.setAttribute('aria-label',text?'发送信息':'获取回复');b.disabled=generating;}
function resizeInput(){const input=$('textarea');if(!input)return;input.style.height='22px';input.style.height=Math.min(104,Math.max(22,input.scrollHeight))+'px';}
function submit(){if(!host)return;const sending=!!$('textarea').value.trim();const run=sending&&typeof window.sendMessage==='function'?window.sendMessage():action(sending?'send-message-btn':'get-reply-btn');Promise.resolve(run).catch(()=>{}).finally(()=>syncControls());}
function syncViewport(){if(!host)return;liquid?.schedule();const vv=window.visualViewport;const inset=vv?Math.max(0,host.getBoundingClientRect().bottom-vv.height-vv.offsetTop):0;
 const surface=$('.surface');surface.style.bottom=inset+'px';
 const composer=$('.composer');
 surface.style.setProperty('--composer-height',composer.getBoundingClientRect().height+'px');
 const add=$('.add').getBoundingClientRect(),bounds=surface.getBoundingClientRect();
 surface.style.setProperty('--tools-bottom',Math.max(0,bounds.bottom-add.bottom+9)+'px');
 surface.style.setProperty('--tools-space',Math.max(0,add.top-bounds.top-60)+'px');}
function mirror(original){
 const clone=original.cloneNode(true);const originals=[original,...original.querySelectorAll('*')],clones=[clone,...clone.querySelectorAll('*')];
 clones.forEach((n,i)=>{sourceMap.set(n,originals[i]);n.removeAttribute('style');for(const a of [...n.attributes])if(a.name.startsWith('on'))n.removeAttribute(a.name);});
 clone.querySelectorAll('.message-info,.message-time,.ki-receipt,.ki-unread-divider,.kr-dock').forEach(n=>n.remove());
 clone.querySelectorAll('script,style,link').forEach(n=>n.remove());
 for(const brand of clone.querySelectorAll('.receipt-brand'))brand.textContent=clone.querySelector('.pay-status-text')?'付款请求':'订单';
 for(const oldIcon of clone.querySelectorAll('.gift-card-icon')){const icon=document.createElement('span');icon.className='gift-icon';icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 11h16v10H4zM2 7h20v4H2zM12 7v14"/><path d="M12 7H8a3 3 0 1 1 3-3Zm0 0h4a3 3 0 1 0-3-3Z"/></svg>';oldIcon.replaceWith(icon);}
 for(const voice of clone.querySelectorAll('.voice-bubble'))decorateVoice(voice);
 for(const card of clone.querySelectorAll('.pv-card')){
  card.classList.add('im-text-photo');
  const overlay=card.querySelector('.pv-card-image-overlay');
  const cover=sourceMap.get(overlay)?.style.backgroundImage;
  if(cover)overlay.style.backgroundImage=cover;
 }
 return clone;
}
function paintVoice(voice,progress){
 if(!voice)return;
 const played=Math.round(48*Math.max(0,Math.min(1,Number(progress)||0)));
 if(voice.kissPlayedBars===played)return;
 voice.kissPlayedBars=played;
 voice.querySelectorAll('.voice-wave i').forEach((bar,i)=>bar.classList.toggle('played',i<played));
}
function decorateVoice(voice){
 const duration=voice.querySelector('.duration');
 if(!duration)return;
 const seconds=Math.max(0,parseInt(duration.textContent,10)||0);
 duration.textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
 const play=document.createElement('button');play.className='voice-play';play.type='button';
 play.setAttribute('aria-label',voice.classList.contains('kv-playing')?'停止语音':'播放语音');
 const icon=voice.querySelector('.play-icon');if(icon){icon.before(play);play.append(icon);}
 const wave=document.createElement('span');wave.className='voice-wave';wave.setAttribute('aria-hidden','true');
 for(let i=0;i<48;i++){
  const bar=document.createElement('i');
  const accent=Math.exp(-Math.pow((i-42)/4.5,2));
  bar.style.height=(2.5+accent*(1.5+4*Math.abs(Math.sin(i*1.72))))+'px';
  wave.append(bar);
 }
 duration.before(wave);paintVoice(voice,sourceMap.get(voice)?.kissPlaybackProgress);
}
function replyExcerpt(quote,original){
 const excerpt=document.createElement('span');excerpt.className='reply-excerpt';
 const image=original?.querySelector('.image-bubble img');
 if(image){const thumb=image.cloneNode(false);thumb.removeAttribute('style');thumb.removeAttribute('onclick');excerpt.append(thumb);return excerpt;}
 const text=document.createElement('span');
 text.textContent=quote.content||original?.querySelector('.bubble-content')?.textContent||'';
 excerpt.append(text);return excerpt;
}
function decorateReply(row,quote,originalRows){
 row.querySelectorAll('.quoted-message').forEach(node=>node.remove());
 if(!quote)return;
 const id=String(quote.messageId??quote.id??'');
 const target=originalRows.get(id),sent=target?target.classList.contains('sent'):quote.senderId==='user_me';
 const ref=document.createElement('button');ref.type='button';ref.className='reply-reference '+(sent?'from-me':'from-them');
 ref.dataset.replyTarget=id;ref.dataset.preview=quote.content||'';ref.setAttribute('aria-label','查看被引用的信息');
 ref.append(replyExcerpt(quote,target));row.prepend(ref);row.classList.add('has-reply');
}
function syncReplyFocus(){
 const focus=$('.reply-focus'),feed=$('.reply-feed'),close=$('.reply-close');
 const pending=source('reply-preview-bar')?.classList.contains('visible')&&typeof currentQuoteInfo!=='undefined'?currentQuoteInfo:null;
 const quote=pending||focusedQuote;
 focus.hidden=close.hidden=!quote;
 $('.video').hidden=$('.back').hidden=!!quote;
 const input=$('textarea');input.placeholder=quote?'回复':'iMessage信息';input.setAttribute('aria-label',input.placeholder);
 $('.history').inert=!!quote;
 $('.surface').classList.toggle('replying',!!quote);
 if(!quote){feed.replaceChildren();delete feed.replyQuote;return;}
 const revision=$('.history').firstElementChild;
 if(feed.replyQuote===quote&&feed.historyRevision===revision)return;
 feed.replyQuote=quote;feed.historyRevision=revision;
 const id=String(quote.id??quote.messageId??'');
 const originals=[...source('message-area').children];
 const original=originals.find(row=>row.dataset.id===id);
 const anchor=document.createElement('div');anchor.className='message-wrapper reply-origin '+(quote.senderId==='user_me'?'sent':'received');
 const message=chat.history.find(m=>String(m.id)===id);
 const timestamp=Number(message?.timestamp);
 if(Number.isFinite(timestamp)&&timestamp>0){
  const date=document.createElement('time');date.className='reply-date';
  date.textContent=new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(timestamp);
  feed.replaceChildren(date);
 }else feed.replaceChildren();
 if(original){
  const quoted=mirror(original);
  quoted.classList.add('reply-origin','tail');
  quoted.querySelectorAll('.quoted-message').forEach(node=>node.remove());
  if(message)decoratePhotos(quoted,message);
  feed.append(quoted);
 }else{
  anchor.classList.add('tail');
  const bubble=document.createElement('div');bubble.className='message-bubble';
  bubble.textContent=quote.content||'';anchor.append(bubble);feed.append(anchor);
 }
 const thread=new Set(chat.history.filter(m=>String(m.quote?.messageId??m.quote?.id??'')===id&&m.quote).map(m=>String(m.id)));
 for(const row of $('.history').children){
  if(!thread.has(row.dataset.id))continue;
  const copy=mirror(sourceMap.get(row));copy.querySelectorAll('.quoted-message').forEach(node=>node.remove());
  const message=chat.history.find(m=>String(m.id)===row.dataset.id);
  if(message)decoratePhotos(copy,message);
  copy.classList.add('tail');feed.append(copy);
 }
 feed.scrollTop=feed.scrollHeight;
}
function schedule(bottom=false,earlier=false){if(!host)return;forceBottom=forceBottom||bottom;loadEarlier=loadEarlier||earlier;if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=0;renderMessages();});}
function renderMessages(){
 if(!host||!enabled(chat))return;
 const original=source('message-area'),list=$('.history');if(!original)return;
 const wasBottom=list.scrollHeight-list.scrollTop-list.clientHeight<70,oldHeight=list.scrollHeight,oldTop=list.scrollTop;
 const fragment=document.createDocumentFragment();const history=(chat.history||[]).filter(m=>!m.offlineNarrative&&!m.offlineSessionId&&!m.offlineArchiveId&&!m.offlineBoundary&&!m.offlineHidden);
 const incoming=history.filter(m=>m.role==='assistant'),count=entryUnread.get(chat)||0,firstUnread=count?incoming[Math.max(0,incoming.length-count)]?.id:null;
 let lastSent=-1;for(let i=history.length-1;i>=0;i--)if(history[i].role==='user'){lastSent=i;break;}
 const originalRows=new Map([...original.children].map(row=>[row.dataset.id,row]));
 for(const originalRow of original.children){
  const clone=mirror(originalRow);if(String(originalRow.dataset.id)===String(firstUnread)&&firstUnread!=null){const divider=document.createElement('div');divider.className='unread-divider';divider.textContent='未读信息';fragment.append(divider);}
  const message=history.find(m=>String(m.id)===String(originalRow.dataset.id));
  if(message){decorateReply(clone,message.quote,originalRows);decoratePhotos(clone,message);decorateReactions(clone,message);if(lastSent>=0&&message===history[lastSent]&&!message.deliveryFailed&&!message.isWithdrawn){const label=document.createElement('small');label.className='delivery';label.textContent=history.slice(lastSent+1).some(m=>m.role==='assistant')?'已读':'已送达';clone.append(label);}}
  fragment.append(clone);
 }
 list.replaceChildren(fragment);
 const rows=[...list.children];
 for(const [index,row] of rows.entries()){
  const next=rows[index+1];
  const joins=next?.dataset.continuous==='true'&&!next.classList.contains('has-reply')&&
   row.classList.contains('sent')===next.classList.contains('sent')&&
   row.querySelector('.message-bubble:not(.html-bubble)')&&next.querySelector('.message-bubble:not(.html-bubble)');
  row.classList.toggle('tail',!joins);
  if(joins)next.classList.add('grouped-text');
 }
 if(forceBottom||wasBottom)list.scrollTop=list.scrollHeight;else if(loadEarlier)list.scrollTop=oldTop+list.scrollHeight-oldHeight;else list.scrollTop=oldTop;
 forceBottom=loadEarlier=false;syncHeader();syncControls();updateJump();
}
function updateJump(){const list=$('.history'),jump=$('.jump');if(!list||!jump)return;jump.hidden=list.scrollHeight-list.scrollTop-list.clientHeight<150;}
function clickMessage(e){
 if(Date.now()<suppressClick){e.preventDefault();e.stopPropagation();return;}
 e.stopPropagation();
 const reference=e.target.closest('.reply-reference');
 if(reference&&!room()?.classList.contains('multi-select-active')){
  if(reference.dataset.replyTarget){
   const target=chat.history.find(m=>String(m.id)===reference.dataset.replyTarget);
   if(target&&typeof startQuoteReply==='function'){
    startQuoteReply(target.id);$('textarea').focus();
   }else focusedQuote={id:reference.dataset.replyTarget,senderId:reference.classList.contains('from-me')?'user_me':'',content:reference.dataset.preview};
   syncControls();
  }
  return;
 }
 if(!$('.tools').hidden){closeTools();return;}
 if(!room()?.classList.contains('multi-select-active')){
  const voice=e.target.closest('.voice-bubble');
  if(voice){sourceMap.get(voice)?.click();return;}
  const count=e.target.closest('.im-photo-count');
  if(count){
   const id=count.closest('[data-id]').dataset.id;
   const state=albumState.get(id);
   if(state){state.expanded=!state.expanded;schedule();}
   return;
  }
  const photo=e.target.closest('.im-photo');
  if(photo){
   const id=photo.closest('[data-id]').dataset.id;
   const images=chat.history.find(m=>String(m.id)===id)?.parts?.filter(p=>p.type==='image').map(p=>p.data)||[];
   if(images.length)window.KissImageAlbum?.viewer(images,Number(photo.dataset.photoIndex)||0);
   return;
  }
 }
 const badge=e.target.closest('[data-reaction]');if(badge){react(badge.closest('[data-id]')?.dataset.id,badge.dataset.reaction);return;}
 const original=sourceMap.get(e.target)||sourceMap.get(e.target.closest('.message-wrapper'));if(original){original.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));schedule();}
}
function longPress(row,x,y){const original=sourceMap.get(row);if(!original||!row.dataset.id)return;lastAnchor=row;if(typeof handleMessageLongPress==='function')handleMessageLongPress(original,x,y);}
const albumState=new Map();
function decoratePhotos(row,message){
 const album=row.querySelector('.kia-album');if(!album){const single=row.querySelector('.image-bubble:not(.kia-album) img');if(single&&single.alt!=='表情包'){const original=sourceMap.get(single);single.closest('.image-bubble').classList.add('im-single-photo');single.closest('.image-bubble').style.setProperty('--photo-width',(original?.naturalWidth>original?.naturalHeight?190:214)+'px');single.addEventListener('load',()=>{single.closest('.image-bubble')?.style.setProperty('--photo-width',(single.naturalWidth>single.naturalHeight?190:214)+'px');liquid?.schedule();},{once:true});}return;}
 const parts=message.parts?.filter(p=>p.type==='image')||[];if(parts.length<2)return;const id=String(message.id),state=albumState.get(id)||{index:0,expanded:false};state.index=Math.max(0,Math.min(parts.length-1,state.index));albumState.set(id,state);const original=sourceMap.get(album),originalImages=original?[...original.querySelectorAll('.kia-card img')]:[];
 album.className='image-bubble im-album';album.dataset.photoCount=parts.length;album.classList.toggle('im-album-expanded',state.expanded);album.replaceChildren();const deck=document.createElement('div');deck.className='im-album-deck';
 const front=originalImages[state.index],aspect=front?.naturalWidth&&front?.naturalHeight?Math.max(.6,Math.min(1.6,front.naturalWidth/front.naturalHeight)):.75;deck.style.setProperty('--photo-aspect',aspect);deck.style.setProperty('--photo-front-width',(aspect>1?190:214)+'px');album.style.setProperty('--photo-front-width',(aspect>1?190:214)+'px');
 for(let i=0;i<parts.length;i++){const card=document.createElement('button');card.className='im-photo';card.dataset.photoIndex=i;card.setAttribute('aria-label','查看第 '+(i+1)+' 张照片');const img=document.createElement('img');img.src=parts[i].data;img.alt='第 '+(i+1)+' 张，共 '+parts.length+' 张照片';img.draggable=false;img.addEventListener('load',()=>{if(state.expanded)card.style.aspectRatio=String(img.naturalWidth/img.naturalHeight);else if(i===state.index){const ratio=Math.max(.6,Math.min(1.6,img.naturalWidth/img.naturalHeight));deck.style.setProperty('--photo-aspect',ratio);deck.style.setProperty('--photo-front-width',(ratio>1?190:214)+'px');album.style.setProperty('--photo-front-width',(ratio>1?190:214)+'px');}liquid?.schedule();},{once:true});card.append(img);
 if(state.expanded){card.style.setProperty('--photo-stagger',i%2===0?'46px':'0px');const own=originalImages[i];if(own?.naturalWidth&&own?.naturalHeight)card.style.aspectRatio=String(own.naturalWidth/own.naturalHeight);}else{const depth=(i-state.index+parts.length)%parts.length;card.style.setProperty('--depth',Math.min(depth,2));card.style.zIndex=String(10-depth);card.hidden=depth>2;card.tabIndex=depth===0?0:-1;}
 deck.append(card);}
 const label=document.createElement('button');label.className='im-photo-count';label.setAttribute('aria-expanded',String(state.expanded));label.innerHTML='<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect width="6" height="6" rx="1"/><rect x="8" width="6" height="6" rx="1"/><rect y="8" width="6" height="6" rx="1"/><rect x="8" y="8" width="6" height="6" rx="1"/></svg>';const text=document.createElement('span');text.textContent=parts.length+' 张照片';label.append(text);album.append(deck,label);
}
function decorateReactions(row,message){const reactions=Object.entries(message.bubbleReactions||{}).filter(([,r])=>r?.emoji);if(!reactions.length)return;const anchor=row.querySelector('.message-bubble,.voice-bubble,.image-bubble')||row;const dock=document.createElement('div');dock.className='tapbacks';for(const [author,reaction]of reactions){const b=document.createElement('button');b.className='tapback';b.textContent=reaction.emoji;b.setAttribute('aria-label',(author==='user'?'我':'角色')+'贴的表情 '+reaction.emoji);if(author==='user')b.dataset.reaction=reaction.emoji;dock.append(b);}anchor.append(dock);row.classList.add('reacted');}
const pendingReactions=new WeakSet();
async function react(id,emoji){
 const message=chat?.history?.find(m=>String(m.id)===String(id));if(!message||message.isWithdrawn||!['user','assistant'].includes(message.role)||pendingReactions.has(message))return;
 if(window.PhoneBackup?.isPinned(chat)){window.showToast?.('存档正在处理，请稍后再试');return;}
 const before=message.bubbleReactions;message.bubbleReactions={...before};if(before?.user?.emoji===emoji)delete message.bubbleReactions.user;else message.bubbleReactions.user={emoji,at:Date.now()};pendingReactions.add(message);
 try{if(window.PhoneBackup?.saveChat)await window.PhoneBackup.saveChat(chat);else if(typeof saveData==='function')await saveData();closeMenu();if(typeof window.renderMessages==='function')window.renderMessages(false,false);else schedule();}catch(e){message.bubbleReactions=before;window.showToast?.(e.message||'表情保存失败');}finally{pendingReactions.delete(message);}
}
function setToolsOpen(open){
 $('.tools').hidden=$('.tools-dismiss').hidden=!open;
 $('.add').setAttribute('aria-expanded',String(open));
 if(open)syncViewport();
}
function closeTools(){
 setToolsOpen(false);
 if(source('chat-expansion-panel')?.classList.contains('visible')&&typeof showPanel==='function')showPanel('none');
}
function renderTools(){
 const tools=$('.tools-scroll');tools.replaceChildren();tools.scrollTop=0;
 const order=['photo-video-btn','image-recognition-btn','sticker-toggle-btn','voice-message-btn'];const nodes=[...document.querySelectorAll('#chat-expansion-panel .expansion-item')];
 const items=order.map(id=>source(id)).filter(Boolean).concat(nodes.filter(n=>!order.includes(n.id)));
 const colors=['#2acb65','#2396ee','#a578f6','#ff563f','#ffad14','#00bce7','#6388ef'];
 items.forEach((n,i)=>{if(n.style.display==='none'||n.hidden)return;const b=document.createElement('button');b.className='tool';const icon=document.createElement('span');icon.className='tool-icon';icon.style.background=colors[i%colors.length];
 const image=n.querySelector('svg,img');
 if(n.id==='voice-message-btn')icon.innerHTML=svg('wave');
 else if(n.id==='sticker-toggle-btn')icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#f4f1ff" d="M20 13A9 9 0 1 1 9 3c1.4 5.1 5.9 9.6 11 10Z"/><path fill="#ccb8f7" d="M9 3c.7 4.9 5.7 9.9 11 10-4.3.2-7.7-.9-9.4-2.7C8.8 8.4 8.6 5.6 9 3Z"/></svg>';
 else if(image)icon.append(image.cloneNode(true));
 else icon.innerHTML=svg('more');const name=document.createElement('span');name.textContent=n.id==='sticker-toggle-btn'?'贴纸':n.querySelector('.expansion-item-name')?.textContent||n.getAttribute('title')||'更多';b.append(icon,name);b.onclick=e=>{e.stopPropagation();setToolsOpen(false);action(n.id);};tools.append(b);});
}
function syncPanel(){
 if(!host)return;const panel=source('chat-expansion-panel'),sticker=source('panel-sticker-area');if(panel?.classList.contains('visible')&&sticker?.style.display!=='none'&&sticker){const tools=$('.tools-scroll');setToolsOpen(true);const clone=mirror(sticker);clone.classList.add('sticker-panel');tools.replaceChildren(clone);clone.addEventListener('click',e=>{e.stopPropagation();sourceMap.get(e.target)?.click();});}
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
 const reactionStrip=document.createElement('div');reactionStrip.className='quick-reactions glass';for(const emoji of ['🩷','👍','👎','💦','‼️','❓','👀']){const b=document.createElement('button');b.textContent=emoji;b.setAttribute('aria-label','贴 '+emoji);b.onclick=e=>{e.stopPropagation();react(lastAnchor?.dataset.id,emoji);};reactionStrip.append(b);}
 const reactionMessage=chat.history.find(m=>String(m.id)===lastAnchor?.dataset.id);
 if(reactionMessage&&window.KissReactions?.picker){
  const all=document.createElement('button');all.className='all-reactions';all.textContent='☺';
  all.setAttribute('aria-label','全部表情');all.onclick=()=>{closeMenu();window.KissReactions.picker(chat,reactionMessage);};
  reactionStrip.append(all);
 }
 layer.append(reactionStrip);
 const originals=[...node.querySelectorAll('.kmsg-action')];
 const make=(label,icon,run)=>{const b=document.createElement('button');b.className='message-action';b.setAttribute('role','menuitem');b.innerHTML=svg(icon);const text=document.createElement('span');text.textContent=label;b.append(text);b.onclick=e=>{e.stopPropagation();run();syncControls();schedule();};card.append(b);return b;};
 const reply=originals.find(b=>b.querySelector('span')?.textContent==='引用');if(reply)make('回复','reply',()=>{reply.click();$('textarea')?.focus();});
 make('拷贝','copy',()=>{const text=lastAnchor?.querySelector('.bubble-content,.voice-transcript,.receipt-bubble,.forwarded-chat-preview')?.textContent||lastAnchor?.textContent||'';copy(text);closeMenu();});
 const translation=lastAnchor?.querySelector('.translation-text');if(translation)make('显示译文','translate',()=>{sourceMap.get(translation)?.classList.toggle('active');closeMenu();});
 const selection=originals.find(b=>b.querySelector('span')?.textContent==='删除');if(selection)make('选择','select',()=>selection.click());
 make('更多…','more',()=>{card.replaceChildren();make('返回','back',()=>renderMenu(node));for(const original of originals){const label=original.querySelector('span')?.textContent||original.textContent;const b=make(label,label.includes('编辑')?'edit':label.includes('删除')?'trash':'more',()=>original.click());if(original.classList.contains('danger')||label==='删除')b.classList.add('danger');}});layer.append(card);
 const bounds=$('.surface').getBoundingClientRect(),a=lastAnchor?.querySelector('.message-bubble,.image-bubble,.voice-bubble')?.getBoundingClientRect()||lastAnchor?.getBoundingClientRect()||bounds;
 if(lastAnchor&&a.top>=bounds.top&&a.bottom<=bounds.bottom){const preview=lastAnchor.cloneNode(true);preview.classList.add('menu-preview');preview.querySelector('.reply-reference')?.remove();preview.style.left=(a.left-bounds.left)+'px';preview.style.top=(a.top-bounds.top)+'px';preview.style.width=a.width+'px';layer.append(preview);}
 const clamp=(x,min,max)=>Math.max(min,Math.min(x,max));
 const cardWidth=card.getBoundingClientRect().width,stripBox=reactionStrip.getBoundingClientRect();
 const topInset=14+(parseFloat(getComputedStyle($('.back')).top)||0);
 const bottom=bounds.height-12;
 const preview=layer.querySelector('.menu-preview');
 const previewHeight=preview?Math.min(a.height,Math.max(36,(bottom-topInset)*.45)):0;
 if(preview)preview.style.maxHeight=previewHeight+'px';
 const menuHeight=Math.max(56,bottom-topInset-stripBox.height-previewHeight-16);
 card.style.maxHeight=Math.min(380,menuHeight)+'px';
 const total=stripBox.height+previewHeight+card.getBoundingClientRect().height+16;
 const top=clamp(a.top-bounds.top-stripBox.height-8,topInset,bottom-total);
 if(preview)preview.style.top=(top+stripBox.height+8)+'px';
 reactionStrip.style.top=top+'px';
 card.style.top=(top+stripBox.height+previewHeight+16)+'px';
 const sent=lastAnchor?.classList.contains('sent'),left=a.left-bounds.left,right=a.right-bounds.left;
 card.style.left=clamp(sent?right-cardWidth:left,12,bounds.width-cardWidth-12)+'px';
 reactionStrip.style.left=clamp(sent?right-stripBox.width:left,8,bounds.width-stripBox.width-8)+'px';
 reactionStrip.querySelector('button')?.focus({preventScroll:true});
 liquid?.schedule();
}
function previewDocument(c){
 const doc=document.implementation.createHTMLDocument('iMessage 预览');doc.body.innerHTML=layout();const link=doc.body.querySelector('link');if(link)doc.head.append(link);const meta=doc.createElement('meta');meta.name='viewport';meta.content='width=device-width,initial-scale=1';doc.head.append(meta);doc.body.className='ki-preview-host';doc.body.style.cssText='margin:0;width:100%;height:100vh;overflow:hidden';doc.body.toggleAttribute('dark-backdrop',!!c.chatBg&&night());doc.body.toggleAttribute('wallpaper',!!c.chatBg);doc.body.dataset.platform=/Android/i.test(typeof navigator!=='undefined'?navigator.userAgent:'')?'android':'other';
 doc.querySelector('.name b').textContent=c.remarkName||c.realName||'';doc.querySelector('.avatar').src=c.avatar||'';doc.querySelector('.wallpaper').style.backgroundImage=c.chatBg?'url('+JSON.stringify(c.chatBg)+')':'none';
 const list=doc.querySelector('.history');
 const sample=[['sent','你最近在听什么歌',true],['received','今天想换一首来听听',false],['received','最近在听这个',true]];
 for(const [side,text,tail]of sample){const row=doc.createElement('div');row.className='message-wrapper '+side;if(tail)row.classList.add('tail');if(text==='最近在听这个')row.classList.add('grouped-text');const bubble=doc.createElement('div');bubble.className='message-bubble '+side;bubble.textContent=text;row.append(bubble);list.append(row);}doc.querySelectorAll('button,textarea').forEach(n=>n.tabIndex=-1);return '<!doctype html>'+doc.documentElement.outerHTML;
}
window.KissIMessageStyle={enabled,enter,apply,syncNight,schedule,decorate:()=>schedule(),menu,menuContains,previewDocument};
})();
