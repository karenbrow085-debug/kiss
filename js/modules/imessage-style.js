/* An isolated iMessage view. The existing chat remains the data/action controller. */
(() => {
'use strict';
const asset=new URL('imessage-view.css?v=20261117-imessage-detail-18',document.currentScript.src.replace('/js/modules/','/css/modules/')).href;
const textPhotoCovers=[1,2,3].map(index=>new URL('../../assets/imessage/text-photo-'+index+'.webp',document.currentScript.src).href);
const revealedPhotos=new Set(),revealedWithdrawals=new Set();
let rowCache=new WeakMap(),viewOfSource=new WeakMap(),dirtyRows=new WeakSet(),historyRevision=0;
const textPhotoOrder=new Map();
const textPhotoPattern=/\[(?:.+?)发来的(?:照片\/视频|照片|视频)[：:]/;
function textPhotoCover(id,depth=0){
 return textPhotoCovers[((textPhotoOrder.get(String(id))??0)+depth)%textPhotoCovers.length];
}
function decorateTextPhoto(card,id){
 const images=textPhotoCovers.map((_,depth)=>textPhotoCover(id,depth));
 const content=card.querySelector('.pv-card-content')?.textContent||'';
 buildPhotoAlbum(card,images,[],{index:0,expanded:false},false,true);
 const front=card.querySelector('.im-photo[data-photo-index="0"]');
 const description=document.createElement('span');description.className='text-photo-content';
 description.textContent=content;front.append(description);
 setTextPhotoOpen(card,revealedPhotos.has(String(id)));
}
function setTextPhotoOpen(card,open){
 card.classList.toggle('text-photo-open',open);
 const front=card.querySelector('.im-photo[data-photo-index="0"]');
 front.setAttribute('aria-expanded',String(open));
 front.querySelector('.text-photo-content').hidden=!open;
 card.querySelector('.im-photo-count').setAttribute('aria-expanded',String(open));
}
function setWithdrawalOpen(row,open){
 const content=row.querySelector('.withdrawn-content'),trigger=row.querySelector('.withdrawn-message');
 if(!content||!trigger)return;
 content.hidden=!open;
 trigger.setAttribute('aria-expanded',String(open));
}
function invalidateOptics(row){
 liquid?.invalidate?.(row);
}
function observeMessageChanges(records){
 const inlineClasses=['active','hidden','kv-playing','kv-loading'];
 let needsRender=false;
 for(const record of records){
  const el=record.target.nodeType===1?record.target:record.target.parentElement;
  const row=el?.closest('.message-wrapper');
  const view=viewOfSource.get(el);
  const voicePart=el?.closest('.play-icon,.duration');
  if(voicePart&&row){
   const voiceView=viewOfSource.get(voicePart.closest('.voice-bubble'));
   const target=voiceView?.querySelector(voicePart.matches('.duration')?'.duration':'.play-icon');
   if(target?.isConnected){
    if(voicePart.matches('.duration'))target.textContent=voiceDuration(voicePart.textContent);
    else target.innerHTML=voicePart.innerHTML;
    invalidateOptics(voiceView.closest('.message-wrapper'));continue;
   }
  }
  if(record.type==='attributes'&&view?.isConnected&&el.matches('.voice-transcript,.translation-text,.gift-card-description,.voice-bubble')){
   for(const name of inlineClasses)view.classList.toggle(name,el.classList.contains(name));
   if(el.matches('.voice-bubble')){
    const glyph=view.querySelector('.play-icon');
    if(glyph)glyph.innerHTML=el.querySelector('.play-icon')?.innerHTML||'';
    view.querySelector('.voice-play')?.setAttribute('aria-label',el.classList.contains('kv-playing')?'停止语音':'播放语音');
   }
   invalidateOptics(view.closest('.message-wrapper'));continue;
  }
  if(row)dirtyRows.add(row);
  needsRender=true;
 }
 if(needsRender)schedule();
}
let chat=null,host=null,shadow=null,liquid=null,frame=0,observers=[],disposers=[],sourceMap=new WeakMap(),forceBottom=false,loadEarlier=false,lastChatId=null,hold=0,pressed=null,menuNode=null,menuObserver=null,bodyObserver=null,lastAnchor=null,suppressClick=0,focusedQuote=null,styleReady=false,bubbleResize=null;
const enabled=c=>c?.defaultAppearance==='imessage';
const room=()=>document.getElementById('chat-room-screen');
const $=s=>shadow?.querySelector(s);
const source=id=>document.getElementById(id);
const icons={smile:'<circle cx="12" cy="12" r="10"/><path d="M7 13a5 5 0 0 0 10 0Zm2-4h.01M15 9h.01"/>',copy:'<rect x="8" y="8" width="12" height="14" rx="2"/><path d="M16 8V2H3v15h5"/>',translate:'<path d="M3 5h12M9 2v3m4 0C11 11 8 15 3 17m2-9c2 4 5 7 9 9m0 3 4-11 4 11m-7-3h6"/>',select:'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7 12 3 3 7-7"/>',edit:'<path d="m4 16 12-12 4 4L8 20H4Zm9-9 4 4"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',back:'<path d="m14 4-8 8 8 8"/>',video:'<rect x="1.4" y="5.2" width="15.2" height="13.6" rx="2.8"/><path d="M16.6 9.8 21.2 6.4q1.2-.9 1.2.6v10q0 1.5-1.2.6l-4.6-3.4"/>',plus:'<path d="M12 5v14M5 12h14"/>',wave:'<path d="M4 10v4m4-7v10m4-14v18m4-14v10m4-7v4"/>',up:'<path d="M12 19V5m-6 6 6-6 6 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',down:'<path d="m5 9 7 7 7-7"/>',reply:'<path d="m9 5-7 6 7 6v-4h5c4 0 6 2 8 6-1-8-5-10-13-10Z"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',check:'<path d="m5 12 4 4L19 6"/>'};
icons.sticker='<path d="M5 16a8 8 0 1 1 11 4c-3-1-1-5 2-6M3 17h6m-3-3v6"/>';
icons.undo='<circle cx="12" cy="12" r="9"/><path d="m10 8-3 3 3 3m-3-3h6a3 3 0 0 1 0 6"/>';
const svg=(name)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name]||icons.more)+'</svg>';
function listen(node,type,fn,opts){if(!node)return;node.addEventListener(type,fn,opts);disposers.push(()=>node.removeEventListener(type,fn,opts));}
function observe(node,fn,options){if(!node)return;const o=new MutationObserver(fn);o.observe(node,options);observers.push(o);}
function night(){return !!chat?.chatBg&&!!host?.hasAttribute('dark-backdrop');}
function syncNight(){if(host){host.removeAttribute('night');host.style.setProperty('background-color','#fff','important');liquid?.schedule();}}
function action(id){source(id)?.click();syncControls();}
function closeMenu(){if(typeof removeContextMenu==='function')removeContextMenu();clearOwnMenu();}
function teardown(){rowCache=new WeakMap();viewOfSource=new WeakMap();styleReady=false;bubbleResize?.disconnect();bubbleResize=null;liquid?.dispose();liquid=null;clearTimeout(hold);cancelAnimationFrame(frame);frame=0;observers.forEach(o=>o.disconnect());observers=[];disposers.forEach(f=>f());disposers=[];closeMenu();host?.remove();host=shadow=null;sourceMap=new WeakMap();focusedQuote=null;}
function apply(c){
 chat=c;const root=room();if(!root)return;
 root.classList.toggle('ki-imessage',enabled(c));
 // Remove the first implementation's generated decorations, including legacy sessions.
 root.querySelectorAll('[data-ki-owned],.ki-receipt,.ki-unread-divider').forEach(n=>n.remove());
 const input=source('message-input');if(input?.hasAttribute('data-ki-placeholder')){input.placeholder=input.getAttribute('data-ki-placeholder');input.removeAttribute('data-ki-placeholder');}
 if(!enabled(c)){teardown();lastChatId=null;return;}
 if(!host||!host.isConnected)mount(root);
 if(lastChatId!==c.id){revealedPhotos.clear();revealedWithdrawals.clear();rowCache=new WeakMap();forceBottom=true;lastChatId=c.id;focusedQuote=null;albumState.clear();closeMenu();closeTools();}
 host.style.setProperty('display','block','important');syncNight();syncHeader();syncControls();schedule();
}
function layout(){return `<link rel="stylesheet" href="${asset}"><div class="surface"><div class="wallpaper"></div><svg class="bubble-outline-defs" width="0" height="0" aria-hidden="true"><defs><linearGradient id="ki-incoming-rim" x1="0%" y1="20%" x2="100%" y2="80%"><stop offset="0%" stop-color="#e8e7ff" stop-opacity=".34"/><stop offset="60%" stop-color="#aecbe6" stop-opacity=".20"/><stop offset="100%" stop-color="#60b3d5" stop-opacity=".07"/></linearGradient></defs></svg><main class="history" aria-label="聊天信息" tabindex="-1"></main><div class="edge-haze edge-top"></div><div class="edge-haze edge-bottom"></div><section class="reply-focus" aria-label="回复会话" hidden><div class="reply-feed"></div></section><header class="floating-header"><button class="glass back" aria-label="返回聊天列表">${svg('back')}<span class="unread-count" hidden></span></button><button class="contact" aria-label="打开聊天设置"><img class="avatar" alt=""><span class="glass name"><b></b><span aria-hidden="true">›</span></span></button><button class="glass video" aria-label="通话">${svg('video')}</button><button class="glass reply-close" aria-label="关闭回复会话" hidden>${svg('close')}</button></header><div class="typing" role="status" hidden>•••</div><button class="glass jump" aria-label="跳到最新消息" hidden>${svg('down')}<span></span></button><footer class="composer"><div class="compose-row"><button class="glass add" aria-label="聊天功能" aria-expanded="false">${svg('plus')}</button><div class="glass input-capsule"><textarea rows="1" aria-label="iMessage信息" placeholder="iMessage信息" enterkeyhint="send"></textarea><button class="submit" aria-label="获取回复">${svg('wave')}</button></div></div></footer><button class="tools-dismiss" aria-label="收起功能" hidden></button><section class="tools glass" aria-label="聊天功能" hidden><div class="tools-scroll"></div></section><section class="selection glass" hidden><button data-original="cancel-multi-select-btn">取消</button><b></b><button data-original="delete-selected-btn">删除</button><button data-original="collect-selected-btn">收藏</button></section><div class="menu-layer" hidden></div></div>`;}
function mount(root){
 host=document.createElement('kiss-imessage-view');
 for(const [k,v]of Object.entries({all:'initial',display:'block',position:'absolute',inset:'0',width:'100%',height:'100%',margin:'0',padding:'0',border:'0',zIndex:'12',isolation:'isolate',visibility:'visible',pointerEvents:'auto',transform:'none',filter:'none',opacity:'1'}))host.style.setProperty(k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()),v,'important');
 host.dataset.platform=/Android/i.test(typeof navigator!=='undefined'?navigator.userAgent:'')?'android':'other';
 shadow=host.attachShadow({mode:'open'});
 shadow.innerHTML=layout();
 const currentHost=host,surface=$('.surface'),stylesheet=$('link[rel="stylesheet"]');
 surface.style.visibility='hidden';
 stylesheet.addEventListener('load',()=>{
  if(host!==currentHost)return;
  styleReady=true;
  renderMessages();
  surface.style.removeProperty('visibility');
  liquid=window.KissIMessageLiquid?.create({host,root:shadow})||null;
  liquid?.setBackground(chat?.chatBg||'');
 },{once:true});
 stylesheet.addEventListener('error',()=>{
  if(host!==currentHost)return;
  root.classList.remove('ki-imessage');
  teardown();
 },{once:true});
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
  const original=e.target.closest('.message-wrapper'),id=original?.dataset.id;
  const row=rowCache.get(original)?.clone;
  paintVoice(row?.querySelector('.voice-bubble'),e.detail);
  for(const item of $('.reply-feed').children){
   if(item.dataset.id===id)paintVoice(item.querySelector('.voice-bubble'),e.detail);
  }
 });
 listen($('.jump'),'click',()=>{$('.history').scrollTo({top:$('.history').scrollHeight,behavior:'smooth'});$('.jump').hidden=true;});
 listen($('.selection'),'click',e=>{const b=e.target.closest('[data-original]');if(b)action(b.dataset.original);});
 const history=$('.history');listen(history,'click',clickMessage);listen(history,'contextmenu',e=>{e.preventDefault();const row=e.target.closest('.message-wrapper');if(row)longPress(row,e.clientX,e.clientY);});
 listen(history,'pointerdown',e=>{if(e.button!==0)return;const row=e.target.closest('.message-wrapper[data-id]');if(!row)return;pressed={x:e.clientX,y:e.clientY,row,album:e.target.closest('.im-album[data-photo-count]:not(.im-text-photo)')};clearTimeout(hold);hold=setTimeout(()=>{suppressClick=Date.now()+650;longPress(row,e.clientX,e.clientY);},450);});
 const release=()=>{clearTimeout(hold);pressed=null;};listen(history,'pointerup',e=>{if(pressed?.album&&!room()?.classList.contains('multi-select-active')){const dx=e.clientX-pressed.x,dy=e.clientY-pressed.y,id=pressed.row.dataset.id,count=Number(pressed.album.dataset.photoCount)||0,state=albumState.get(id)||{index:0,expanded:false};if(!state.expanded&&Math.abs(dx)>28&&Math.abs(dx)>Math.abs(dy)){state.index=Math.max(0,Math.min(count-1,state.index+(dx<0?1:-1)));albumState.set(id,state);suppressClick=Date.now()+450;schedule();}}release();});listen(history,'pointercancel',release);listen(history,'pointermove',e=>{if(pressed&&Math.hypot(e.clientX-pressed.x,e.clientY-pressed.y)>8){clearTimeout(hold);if(!pressed.album)pressed=null;}});
 listen(history,'scroll',()=>{clearTimeout(hold);updateJump();},{passive:true});
 observe(source('message-area'),observeMessageChanges,{childList:true,subtree:true,characterData:true,attributes:true});
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
 const count=typeof db!=='undefined'?[...db.characters,...db.groups].reduce((n,c)=>c===chat?n:n+Math.max(0,Number(c.unreadCount)||0),0):0;
 const badge=$('.unread-count');badge.hidden=!count;badge.textContent=count>99?'99+':String(count);
 $('.back').setAttribute('aria-label',count?'返回，其他聊天有 '+count+' 条未读消息':'返回聊天列表');
 const image=chat.chatBg?'url('+JSON.stringify(chat.chatBg)+')':'none';
 $('.wallpaper').style.backgroundImage=image;
 $('.history').style.backgroundImage=image;
 host.toggleAttribute('wallpaper',!!chat.chatBg);liquid?.setBackground(chat.chatBg||'');
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
function submit(){if(!host)return;const sending=!!$('textarea').value.trim();
 if(sending&&focusedQuote&&!source('reply-preview-bar')?.classList.contains('visible')){
  const target=chat.history.find(message=>String(message.id)===focusedQuote.id);
  if(target&&!target.isWithdrawn&&typeof startQuoteReply==='function')startQuoteReply(target.id);
 }
 const run=sending&&typeof window.sendMessage==='function'?window.sendMessage():action(sending?'send-message-btn':'get-reply-btn');Promise.resolve(run).catch(()=>{}).finally(()=>syncControls());}
function syncViewport(){if(!host||!styleReady)return;liquid?.schedule();const vv=window.visualViewport;const inset=vv?Math.max(0,host.getBoundingClientRect().bottom-vv.height-vv.offsetTop):0;
 const surface=$('.surface');surface.style.bottom=inset+'px';
 const composer=$('.composer');
 surface.style.setProperty('--composer-height',composer.getBoundingClientRect().height+'px');
 const add=$('.add').getBoundingClientRect(),bounds=surface.getBoundingClientRect();
 surface.style.setProperty('--tools-bottom',Math.max(0,bounds.bottom-add.bottom+9)+'px');
 surface.style.setProperty('--tools-space',Math.max(0,add.top-bounds.top-60)+'px');}
function mirror(original){
 const clone=original.cloneNode(true);const originals=[original,...original.querySelectorAll('*')],clones=[clone,...clone.querySelectorAll('*')];
 clones.forEach((n,i)=>{sourceMap.set(n,originals[i]);viewOfSource.set(originals[i],n);n.removeAttribute('style');for(const a of [...n.attributes])if(a.name.startsWith('on'))n.removeAttribute(a.name);});
 clone.querySelectorAll('.message-info,.message-time,.ki-receipt,.ki-unread-divider,.kr-dock').forEach(n=>n.remove());
 clone.querySelectorAll('script,style,link').forEach(n=>n.remove());
 for(const brand of clone.querySelectorAll('.receipt-brand'))brand.textContent=clone.querySelector('.pay-status-text')?'付款请求':'订单';
 for(const oldIcon of clone.querySelectorAll('.gift-card-icon')){const icon=document.createElement('span');icon.className='gift-icon';icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 11h16v10H4zM2 7h20v4H2zM12 7v14"/><path d="M12 7H8a3 3 0 1 1 3-3Zm0 0h4a3 3 0 1 0-3-3Z"/></svg>';oldIcon.replaceWith(icon);}
 for(const voice of clone.querySelectorAll('.voice-bubble'))decorateVoice(voice);
 for(const card of clone.querySelectorAll('.pv-card'))decorateTextPhoto(card,clone.dataset.id);
 const withdrawal=clone.querySelector('.withdrawn-message');
 if(withdrawal){
  const trigger=document.createElement('button');trigger.type='button';trigger.className=withdrawal.className;
  trigger.textContent=withdrawal.textContent;withdrawal.replaceWith(trigger);
  setWithdrawalOpen(clone,revealedWithdrawals.has(clone.dataset.id));
 }
 for(const bubble of clone.querySelectorAll('.message-bubble:not(.html-bubble)')){
  if(Array.from(bubble.querySelector('.bubble-content')?.textContent?.trim()||'').length===1)bubble.classList.add('single-glyph');
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
function voiceDuration(value){
 const seconds=Math.max(0,parseInt(value,10)||0);
 return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
}
function decorateVoice(voice){
 const duration=voice.querySelector('.duration');
 if(!duration)return;
 duration.textContent=voiceDuration(duration.textContent);
 const play=document.createElement('button');play.className='voice-play';play.type='button';
 play.setAttribute('aria-label',voice.classList.contains('kv-playing')?'停止语音':'播放语音');
 const icon=voice.querySelector('.play-icon');if(icon){icon.before(play);play.append(icon);}
 const wave=document.createElement('span');wave.className='voice-wave';wave.setAttribute('aria-hidden','true');
 for(let i=0;i<48;i++){
  const bar=document.createElement('i');
  const swell=Math.exp(-Math.pow((i-42)/4.7,2));
  const variation=Math.abs(Math.sin(i*.38))*.12+Math.abs(Math.sin(i*1.2))*.07;
  bar.style.height=(i===47?3:16+8*i/48+7*swell+variation*20)+'px';
  wave.append(bar);
 }
 duration.before(wave);paintVoice(voice,sourceMap.get(voice)?.kissPlaybackProgress);
 if(voice.closest('.received')){
  const listen=document.createElement('button');listen.type='button';listen.className='voice-listen';
  listen.textContent='贴近耳边听取';voice.closest('.message-bubble-row')?.after(listen);
 }
}
function decorateReply(row,quote,originalRows,adjacent,sourceWithdrawn){
 row.querySelectorAll('.quoted-message').forEach(node=>node.remove());
 if(!quote)return;
 const id=String(quote.messageId??quote.id??'');
 const target=originalRows.get(id),sent=target?target.classList.contains('sent'):quote.senderId==='user_me';
 const ref=document.createElement('button');ref.type='button';
 ref.className='reply-reference '+(sent?'from-me':'from-them');
 ref.dataset.replyTarget=id;ref.dataset.preview=sourceWithdrawn?'已撤回的信息':quote.content||'';
 ref.setAttribute('aria-label','查看被引用的信息');
 const excerpt=document.createElement('span');excerpt.className='reply-excerpt';
 const photo=!sourceWithdrawn&&target?.querySelector('.image-bubble img');
 const textPhoto=!sourceWithdrawn&&target?.querySelector('.pv-card-image-overlay');
 if(photo||textPhoto){
  ref.classList.add('reply-with-photo');
  const thumb=document.createElement('img');
  thumb.src=photo?.getAttribute('src')||textPhotoCover(id);
  thumb.alt=photo?.getAttribute('alt')||'照片';
  excerpt.append(thumb);
 }else{
  const text=document.createElement('span');
  text.textContent=sourceWithdrawn?'已撤回的信息':target?.querySelector('.bubble-content')?.textContent?.trim()||quote.content||'';
  const ns='http://www.w3.org/2000/svg';
  const outline=document.createElementNS(ns,'svg');
  outline.setAttribute('class','quote-outline');
  outline.setAttribute('aria-hidden','true');
  outline.append(document.createElementNS(ns,'path'));
  excerpt.append(text,outline);
 }
 const connector=document.createElement('span');
 connector.className='reply-connector';
 connector.setAttribute('aria-hidden','true');
 if(adjacent){
  row.classList.add('reply-adjacent',sent?'source-sent':'source-received');
  row.classList.toggle('reply-same-side',sent===row.classList.contains('sent'));
  row.prepend(connector);
 }else{
  ref.append(excerpt);
  row.prepend(ref,connector);
 }
 row.classList.add('has-reply');
}
function clearReplyFeed(feed){
 for(const rim of feed.querySelectorAll('.incoming-rim'))bubbleResize?.unobserve(rim.parentElement);
 feed.replaceChildren();
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
 if(!quote){if(feed.replyQuote)clearReplyFeed(feed);delete feed.replyQuote;return;}
 const revision=historyRevision;
 if(feed.replyQuote===quote&&feed.historyRevision===revision)return;
 feed.replyQuote=quote;feed.historyRevision=revision;
 clearReplyFeed(feed);
 const id=String(quote.id??quote.messageId??'');
 const originals=[...source('message-area').children];
 const message=chat.history.find(m=>String(m.id)===id);
 const original=originals.find(row=>row.dataset.id===id)||(message&&createMessageBubbleElement(message));
 const anchor=document.createElement('div');anchor.className='message-wrapper reply-origin '+(quote.senderId==='user_me'?'sent':'received');
 const timestamp=Number(message?.timestamp);
 if(Number.isFinite(timestamp)&&timestamp>0){
  const date=document.createElement('time');date.className='reply-date';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(timestamp).map(({type,value})=>[type,value]));
  date.textContent=parts.month+'月'+parts.day+'日 '+parts.weekday+' '+parts.hour+':'+parts.minute;
  feed.append(date);
 }
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
 const visibleById=new Map(originals.map(row=>[row.dataset.id,row]));
 for(const item of chat.history){
  if(item.isWithdrawn||String(item.quote?.messageId??item.quote?.id??'')!==id)continue;
  const originalRow=visibleById.get(String(item.id))||createMessageBubbleElement(item);
  if(!originalRow)continue;
  const copy=mirror(originalRow);copy.querySelectorAll('.quoted-message').forEach(node=>node.remove());
  decoratePhotos(copy,item);
  copy.classList.add('tail');feed.append(copy);
 }
 mountIncomingRims(feed);
 feed.scrollTop=feed.scrollHeight;
}
function schedule(bottom=false,earlier=false){if(!host)return;forceBottom=forceBottom||bottom;loadEarlier=loadEarlier||earlier;if(!styleReady)return;if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=0;renderMessages();});}
function traceIncomingBubble(bubble){
 const outline=bubble.querySelector('.incoming-rim path');
 if(!outline)return;
 const w=bubble.offsetWidth,h=bubble.offsetHeight;
 if(!w||!h)return;
 const tail=bubble.closest('.message-wrapper').classList.contains('tail');
 const bottomLeft=tail
  ? `H20 C17 ${h} 11 ${h+6} 8.4 ${h+6} C7.6 ${h+6} 7.6 ${h+5} 8.3 ${h+4} C10.7 ${h+.5} 10.7 ${h-2} 8 ${h-4.5} C4 ${h-8} .4 ${h-12} .4 ${h-18.5}`
  : `H18.5 C8.5 ${h-.4} .4 ${h-8.5} .4 ${h-18.5}`;
 outline.setAttribute('d',`M18.5 .4 H${w-18.5} C${w-8.5} .4 ${w-.4} 8.5 ${w-.4} 18.5 V${h-18.5} C${w-.4} ${h-8.5} ${w-8.5} ${h-.4} ${w-18.5} ${h-.4} ${bottomLeft} V18.5 C.4 8.5 8.5 .4 18.5 .4Z`);
}
function traceQuote(excerpt){
 const w=excerpt.offsetWidth,h=excerpt.offsetHeight,r=Math.min(13,w/2);
 if(!w||!h)return;
 const outline=excerpt.querySelector('.quote-outline');
 const path=outline.firstElementChild;
 path.setAttribute('d',`M${r} .5 H${w-r} Q${w-.5} .5 ${w-.5} ${r} V${h-r} Q${w-.5} ${h-.5} ${w-r} ${h-.5} H${Math.min(r+2,w-r)} C12 ${h-.5} 9 ${h+3} 6 ${h+4} Q4 ${h+4.8} 5 ${h+3.2} Q7.8 ${h} 5.2 ${h-2.4} Q.5 ${h-6.5} .5 ${h-r} V${r} Q.5 .5 ${r} .5Z`);
}
function mountIncomingRims(list){
 bubbleResize ||= new ResizeObserver(entries=>{
  for(const {target}of entries){
   if(target.matches('.reply-excerpt'))traceQuote(target);else traceIncomingBubble(target);
  }
 });
 for(const outline of list.querySelectorAll('.quote-outline')){
  const excerpt=outline.parentElement;
  if(!outline.firstElementChild.hasAttribute('d')){traceQuote(excerpt);bubbleResize.observe(excerpt);}
 }
 if(!chat?.chatBg)return;
 for(const bubble of list.querySelectorAll('.message-wrapper.received :is(.message-bubble:not(.html-bubble),.voice-bubble)')){
  if(bubble.querySelector('.incoming-rim')){traceIncomingBubble(bubble);continue;}
  const ns='http://www.w3.org/2000/svg';
  const rim=document.createElementNS(ns,'svg'),stroke=document.createElementNS(ns,'path');
  rim.setAttribute('class','incoming-rim');
  rim.setAttribute('aria-hidden','true');
  stroke.setAttribute('stroke','url(#ki-incoming-rim)');
  rim.append(stroke);bubble.prepend(rim);
  traceIncomingBubble(bubble);bubbleResize.observe(bubble);
 }
}
function renderMessages(){
 if(!host||!enabled(chat))return;
 const original=source('message-area'),list=$('.history');if(!original)return;
 const wasBottom=list.scrollHeight-list.scrollTop-list.clientHeight<70,oldHeight=list.scrollHeight,oldTop=list.scrollTop;
 const desired=[];const history=(chat.history||[]).filter(m=>!m.offlineNarrative&&!m.offlineSessionId&&!m.offlineArchiveId&&!m.offlineBoundary&&!m.offlineHidden);
 let lastSent=-1;for(let i=history.length-1;i>=0;i--)if(history[i].role==='user'){lastSent=i;break;}
 const originalRows=new Map([...original.children].filter(row=>row.dataset.id).map(row=>[row.dataset.id,row]));
 const visiblePrevious=new Map();
 let previousVisible='';
 for(const row of original.children){
  if(row.dataset.id)visiblePrevious.set(row.dataset.id,previousVisible);
  previousVisible=row.dataset.id||'';
 }
 const previousMessages=new Map(),replyCounts=new Map(),separatedTargets=new Set();
 let previousId='';
 for(const message of history){
  const id=String(message.id);
  previousMessages.set(id,previousId);previousId=id;
  if(!message.quote||message.isWithdrawn)continue;
  const target=String(message.quote.messageId??message.quote.id??'');
  if(!target)continue;
  replyCounts.set(target,(replyCounts.get(target)||0)+1);
  if((visiblePrevious.has(id)?visiblePrevious.get(id):previousMessages.get(id))!==target)separatedTargets.add(target);
 }
 const historyById=new Map(history.map(message=>[String(message.id),message]));
 textPhotoOrder.clear();
 for(const message of history){
  if(textPhotoPattern.test(message.content))textPhotoOrder.set(String(message.id),textPhotoOrder.size);
 }
 for(const originalRow of original.children){
  const id=originalRow.dataset.id,message=historyById.get(id);
  const target=String(message?.quote?.messageId??message?.quote?.id??'');
  const sourceWithdrawn=!!historyById.get(target)?.isWithdrawn;
  const adjacent=target!==''&&!sourceWithdrawn&&visiblePrevious.get(id)===target;
  const count=separatedTargets.has(id)?replyCounts.get(id):0;
  const delivered=lastSent>=0&&message===history[lastSent]&&!message.deliveryFailed&&!message.isWithdrawn
   ?(history.slice(lastSent+1).some(m=>m.role==='assistant')?'已读':'已送达'):'';
  const album=albumState.get(id);
  const key=JSON.stringify([target,adjacent,sourceWithdrawn,count,delivered,album?.index??0,album?.expanded??false,textPhotoOrder.get(id),message?.bubbleReactions,!!chat.chatBg]);
  let cached=rowCache.get(originalRow);
  if(!cached||cached.key!==key||dirtyRows.has(originalRow)){
   const clone=mirror(originalRow);
   if(message){
    decorateReply(clone,message.isWithdrawn?null:message.quote,originalRows,adjacent,sourceWithdrawn);
    if(count&&!message.isWithdrawn){
     const replies=document.createElement('button');replies.type='button';replies.className='reply-count';
     replies.dataset.replyTarget=id;replies.textContent=count+'个回复';clone.append(replies);
    }
    decoratePhotos(clone,message);decorateReactions(clone,message);
    if(delivered){const label=document.createElement('small');label.className='delivery';label.textContent=delivered;clone.append(label);}
   }
   cached={key,clone};rowCache.set(originalRow,cached);
  }
  desired.push(cached.clone);
 }
 dirtyRows=new WeakSet();
 const keep=new Set(desired);
 for(const row of [...list.children]){
  if(!keep.has(row)){for(const item of row.querySelectorAll('.incoming-rim,.quote-outline'))bubbleResize?.unobserve(item.parentElement);row.remove();historyRevision++;}
 }
 let nextNode=list.firstElementChild;
 for(const row of desired){
  if(row===nextNode){nextNode=nextNode.nextElementSibling;continue;}
  list.insertBefore(row,nextNode);historyRevision++;
 }
 const rows=desired;
 let previousPhoto=null,photoPosition=0;
 for(const [index,row] of rows.entries()){
  const next=rows[index+1];
  const joins=next?.dataset.continuous==='true'&&!next.classList.contains('has-reply')&&
   row.classList.contains('sent')===next.classList.contains('sent')&&
   row.querySelector('.message-bubble:not(.html-bubble)')&&next.querySelector('.message-bubble:not(.html-bubble)');
  row.classList.toggle('tail',!joins);
  if(next)next.classList.toggle('grouped-text',!!joins);
  row.classList.remove('staggered-photo','staggered-inset');
  const photo=row.querySelector('.im-single-photo');
  if(!photo||row.classList.contains('has-reply')){previousPhoto=null;photoPosition=0;continue;}
  const side=row.classList.contains('sent')?'sent':'received';
  if(row.dataset.continuous==='true'&&side===previousPhoto){
   photoPosition++;
   row.classList.add('staggered-photo');
   row.classList.toggle('staggered-inset',photoPosition%2===1);
  }else photoPosition=0;
  previousPhoto=side;
 }
 mountIncomingRims(list);
 if(forceBottom||wasBottom)list.scrollTop=list.scrollHeight;else if(loadEarlier)list.scrollTop=oldTop+list.scrollHeight-oldHeight;else list.scrollTop=oldTop;
 forceBottom=loadEarlier=false;syncHeader();syncControls();updateJump();
}
function updateJump(){const list=$('.history'),jump=$('.jump');if(!list||!jump)return;jump.hidden=list.scrollHeight-list.scrollTop-list.clientHeight<150;}
function clickMessage(e){
 if(Date.now()<suppressClick){e.preventDefault();e.stopPropagation();return;}
 e.stopPropagation();
 const reference=e.target.closest('.reply-reference,.reply-count');
 if(reference&&!room()?.classList.contains('multi-select-active')){
  const id=reference.dataset.replyTarget;
  if(id){
   const target=chat.history.find(m=>String(m.id)===id);
   focusedQuote={id,senderId:target?.role==='user'||reference.classList.contains('from-me')?'user_me':'',content:reference.dataset.preview||target?.content||''};
   syncControls();
  }
  return;
 }
 if(!$('.tools').hidden){closeTools();return;}
 if(!room()?.classList.contains('multi-select-active')){
  const row=e.target.closest('.message-wrapper');
  const textPhoto=e.target.closest('.im-text-photo');
  if(textPhoto){
   const open=!textPhoto.classList.contains('text-photo-open');
   if(open)revealedPhotos.add(row.dataset.id);else revealedPhotos.delete(row.dataset.id);
   setTextPhotoOpen(textPhoto,open);invalidateOptics(row);
   return;
  }
  if(e.target.closest('.withdrawn-message')){
   const open=!revealedWithdrawals.has(row.dataset.id);
   if(open)revealedWithdrawals.add(row.dataset.id);else revealedWithdrawals.delete(row.dataset.id);
   setWithdrawalOpen(row,open);invalidateOptics(row);
   return;
  }
  const voice=e.target.closest('.voice-bubble')||(e.target.closest('.voice-listen')&&row?.querySelector('.voice-bubble'));
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
 const original=sourceMap.get(e.target)||sourceMap.get(e.target.closest('.message-wrapper'));if(original){original.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));}
}
function longPress(row,x,y){const original=sourceMap.get(row);if(!original||!row.dataset.id)return;lastAnchor=row;if(typeof handleMessageLongPress==='function')handleMessageLongPress(original,x,y);}
const albumState=new Map();
function decoratePhotos(row,message){
 const album=row.querySelector('.kia-album');if(!album){const single=row.querySelector('.image-bubble:not(.kia-album,.im-text-photo) img');if(single&&single.alt!=='表情包'){const original=sourceMap.get(single);single.closest('.image-bubble').classList.add('im-single-photo');single.closest('.image-bubble').style.setProperty('--photo-width',(original?.naturalWidth>original?.naturalHeight?164:176)+'px');single.addEventListener('load',()=>{single.closest('.image-bubble')?.style.setProperty('--photo-width',(single.naturalWidth>single.naturalHeight?164:176)+'px');liquid?.schedule();},{once:true});}return;}
 const images=(message.parts||[]).filter(part=>part.type==='image').map(part=>part.data);
 if(images.length<2)return;
 const id=String(message.id),state=albumState.get(id)||{index:0,expanded:false};
 state.index=Math.max(0,Math.min(images.length-1,state.index));albumState.set(id,state);
 const originalImages=[...(sourceMap.get(album)?.querySelectorAll('.kia-card img')||[])];
 buildPhotoAlbum(album,images,originalImages,state,row.classList.contains('sent'),false);
}
function buildPhotoAlbum(album,images,originalImages,state,sent,textPhoto){
 album.className='image-bubble im-album';
 album.dataset.photoCount=images.length;
 album.classList.toggle('im-text-photo',textPhoto);
 album.classList.toggle('im-album-expanded',state.expanded);
 const deck=document.createElement('div');deck.className='im-album-deck';
 const sizeFrom=(image,card,index)=>{
  if(!image?.naturalWidth||!image.naturalHeight)return;
  const ratio=image.naturalWidth/image.naturalHeight;
  if(state.expanded){card.style.aspectRatio=String(ratio);return;}
  if(index!==state.index)return;
  deck.style.setProperty('--photo-aspect',Math.max(.6,Math.min(1.6,ratio)));
  album.style.setProperty('--photo-front-width',ratio>1?'166px':'184px');
 };
 images.forEach((url,index)=>{
  const card=document.createElement('button');card.className='im-photo';card.type='button';card.dataset.photoIndex=index;
  card.setAttribute('aria-label',textPhoto?'查看照片文字':'查看第 '+(index+1)+' 张照片');
  const image=document.createElement('img');image.src=url;image.alt='';image.draggable=false;
  image.addEventListener('load',()=>{sizeFrom(image,card,index);liquid?.schedule();},{once:true});
  sizeFrom(originalImages[index],card,index);
  card.append(image);
  if(state.expanded)card.style.setProperty('--photo-stagger',(index%2===0)===sent?'35px':'0px');
  else{
   const depth=(index-state.index+images.length)%images.length;
   card.style.setProperty('--depth',Math.min(depth,2));
   card.style.zIndex=String(10-depth);card.hidden=depth>2;card.tabIndex=depth===0?0:-1;
  }
  deck.append(card);
 });
 const label=document.createElement('button');label.className='im-photo-count';label.type='button';
 if(!textPhoto)label.setAttribute('aria-expanded',String(state.expanded));
 label.innerHTML='<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect width="6" height="6" rx="1"/><rect x="8" width="6" height="6" rx="1"/><rect y="8" width="6" height="6" rx="1"/><rect x="8" y="8" width="6" height="6" rx="1"/></svg>';
 const text=document.createElement('span');text.textContent=images.length+' 张照片';label.append(text);album.replaceChildren(label,deck);
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
 if(!host||!styleReady||!room()?.classList.contains('active'))return;
 clearOwnMenu();menuNode=node;node.classList.add('ki-source-menu');node.style.setProperty('visibility','hidden','important');node.setAttribute('aria-hidden','true');
 const update=()=>requestAnimationFrame(()=>{if(node.isConnected&&host)renderMenu(node);});
 menuObserver=new MutationObserver(update);menuObserver.observe(node,{subtree:true,childList:true});
 bodyObserver=new MutationObserver(()=>{if(!node.isConnected)clearOwnMenu();});bodyObserver.observe(document.body,{childList:true});update();
}
function renderMenu(node){
 if(menuNode!==node||!host)return;const layer=$('.menu-layer');layer.replaceChildren();layer.hidden=false;
 const scrim=document.createElement('button');scrim.className='scrim';scrim.setAttribute('aria-label','关闭消息菜单');scrim.onclick=e=>{e.stopPropagation();closeMenu();};layer.append(scrim);
 const card=document.createElement('div');card.className='message-actions glass';card.setAttribute('role','menu');
 const actionList=document.createElement('div');actionList.className='message-actions-scroll';card.append(actionList);
 const reactionStrip=document.createElement('div');reactionStrip.className='quick-reactions glass';
 const reactions=document.createElement('div');reactions.className='reaction-items';reactionStrip.append(reactions);
 for(const emoji of ['🩷','👍','👎','💦','‼️','❔','😂','❤️']){
  const b=document.createElement('button');b.textContent=emoji;
  b.setAttribute('aria-label','贴 '+emoji);
  b.onclick=e=>{e.stopPropagation();react(lastAnchor?.dataset.id,emoji);};
  reactions.append(b);
 }
 const reactionMessage=chat.history.find(m=>String(m.id)===lastAnchor?.dataset.id);
 if(reactionMessage&&window.KissReactions?.picker){
  const all=document.createElement('button');all.className='all-reactions glass';all.innerHTML=svg('smile');
  all.setAttribute('aria-label','全部表情');all.onclick=()=>{closeMenu();window.KissReactions.picker(chat,reactionMessage);};
  reactionStrip.append(all);
 }
 layer.append(reactionStrip);
 const originals=[...node.querySelectorAll('.kmsg-action')];
 const make=(label,icon,run)=>{const b=document.createElement('button');b.className='message-action';b.setAttribute('role','menuitem');b.innerHTML=svg(icon);const text=document.createElement('span');text.textContent=label;b.append(text);b.onclick=e=>{e.stopPropagation();run();syncControls();schedule();};actionList.append(b);return b;};
 const reply=originals.find(b=>b.querySelector('span')?.textContent==='引用');if(reply)make('回复','reply',()=>{focusedQuote=null;reply.click();$('textarea')?.focus();});
 const sticker=make('附加贴纸','sticker',()=>{
  closeMenu();action('sticker-toggle-btn');
 });
 sticker.classList.add('menu-group-end');
 const edit=originals.find(b=>b.getAttribute('aria-label')==='编辑');
 const undo=originals.find(b=>b.getAttribute('aria-label')==='撤回');
 const editAction=edit&&make('编辑','edit',()=>edit.click());
 const undoAction=undo&&make('撤回','undo',()=>undo.click());
 (undoAction||editAction)?.classList.add('menu-group-end');
 make('拷贝','copy',()=>{const text=sourceMap.get(lastAnchor)?.querySelector('.pv-card-content')?.textContent||lastAnchor?.querySelector('.bubble-content,.voice-transcript,.receipt-bubble,.forwarded-chat-preview')?.textContent||lastAnchor?.textContent||'';copy(text);closeMenu();});
 const translation=lastAnchor?.querySelector('.translation-text');if(translation)make('翻译','translate',()=>{sourceMap.get(translation)?.classList.toggle('active');closeMenu();});
 const selection=originals.find(b=>b.querySelector('span')?.textContent==='删除');if(selection)make('选择','select',()=>selection.click());
 make('更多…','more',()=>{actionList.replaceChildren();make('返回','back',()=>renderMenu(node));for(const original of originals){const label=original.querySelector('span')?.textContent||original.textContent;const b=make(label,label.includes('编辑')?'edit':label.includes('删除')?'trash':'more',()=>original.click());if(original.classList.contains('danger')||label==='删除')b.classList.add('danger');}});layer.append(card);
 const bounds=$('.surface').getBoundingClientRect();
 const selected=lastAnchor?.querySelector('.message-bubble,.image-bubble,.voice-bubble,.receipt-bubble,.forwarded-chat-card,.pv-card');
 const a=selected?.getBoundingClientRect()||bounds;
 if(selected){
  const preview=document.createElement('div');
  preview.className='message-wrapper menu-preview';
  for(const name of ['sent','received','tail'])preview.classList.toggle(name,lastAnchor.classList.contains(name));
  const picked=selected.cloneNode(true);picked.querySelectorAll('.tapbacks').forEach(item=>item.remove());
  preview.append(picked);
  const count=lastAnchor.querySelector('.reply-count');
  if(count){
   const label=document.createElement('span');label.className='reply-count';
   label.textContent=count.textContent;preview.append(label);
  }
  preview.style.left=(a.left-bounds.left)+'px';preview.style.width=a.width+'px';
  layer.append(preview);
 }
 const clamp=(x,min,max)=>Math.max(min,Math.min(x,max));
 const cardWidth=card.getBoundingClientRect().width,stripBox=reactionStrip.getBoundingClientRect();
 const topInset=14+(parseFloat(getComputedStyle($('.back')).top)||0);
 const bottom=bounds.height-12;
 const preview=layer.querySelector('.menu-preview');
 const fullPreviewHeight=preview?.offsetHeight||0;
 const previewHeight=Math.min(fullPreviewHeight,Math.max(36,(bottom-topInset)*.46));
 if(previewHeight<fullPreviewHeight){
  preview.style.transform='scale('+previewHeight/fullPreviewHeight+')';
  preview.style.transformOrigin=(lastAnchor.classList.contains('sent')?'right':'left')+' top';
 }
 const menuHeight=Math.max(56,bottom-topInset-stripBox.height-previewHeight-16);
 card.style.maxHeight=Math.min(380,menuHeight)+'px';
 const total=stripBox.height+previewHeight+card.getBoundingClientRect().height+16;
 const top=clamp(a.top-bounds.top-stripBox.height-8,topInset,bottom-total);
 if(preview)preview.style.top=(top+stripBox.height+8)+'px';
 reactionStrip.style.top=top+'px';
 card.style.top=(top+stripBox.height+previewHeight+16)+'px';
 const sent=lastAnchor?.classList.contains('sent'),left=a.left-bounds.left,right=a.right-bounds.left;
 card.style.left=clamp(sent?right-cardWidth:left,12,bounds.width-cardWidth-12)+'px';
 const stripLeft=clamp(sent?right-stripBox.width:left,12,bounds.width-stripBox.width-12);
 reactionStrip.style.left=stripLeft+'px';
 const pickerCenter=sent?left-stripLeft-26:right-stripLeft+26;
 reactionStrip.style.setProperty('--picker-left',clamp(pickerCenter-20,18,stripBox.width-58)+'px');
 card.tabIndex=-1;
 card.focus({preventScroll:true});
 liquid?.schedule();
}
function previewDocument(c){
 const doc=document.implementation.createHTMLDocument('iMessage 预览');doc.body.innerHTML=layout();const link=doc.body.querySelector('link');if(link)doc.head.append(link);const meta=doc.createElement('meta');meta.name='viewport';meta.content='width=device-width,initial-scale=1';doc.head.append(meta);doc.body.className='ki-preview-host';doc.body.style.cssText='margin:0;width:100%;height:100vh;overflow:hidden';doc.body.toggleAttribute('dark-backdrop',!!c.chatBg&&night());doc.body.toggleAttribute('wallpaper',!!c.chatBg);doc.body.dataset.wallpaperSource=c.chatBg||'';doc.body.dataset.platform=/Android/i.test(typeof navigator!=='undefined'?navigator.userAgent:'')?'android':'other';
 doc.querySelector('.name b').textContent=c.remarkName||c.realName||'';doc.querySelector('.avatar').src=c.avatar||'';const wallpaper=c.chatBg?'url('+JSON.stringify(c.chatBg)+')':'none';doc.querySelector('.wallpaper').style.backgroundImage=wallpaper;doc.querySelector('.history').style.backgroundImage=wallpaper;
 const list=doc.querySelector('.history');
 const sample=[['sent','你最近在听什么歌',true],['received','今天想换一首来听听',false],['received','最近在听这个',true]];
 for(const [side,text,tail]of sample){const row=doc.createElement('div');row.className='message-wrapper '+side;if(tail)row.classList.add('tail');if(text==='最近在听这个')row.classList.add('grouped-text');const bubble=doc.createElement('div');bubble.className='message-bubble '+side;bubble.textContent=text;row.append(bubble);list.append(row);}doc.querySelectorAll('button,textarea').forEach(n=>n.tabIndex=-1);return '<!doctype html>'+doc.documentElement.outerHTML;
}
window.KissIMessageStyle={enabled,apply,syncNight,schedule,decorate:()=>schedule(),menu,menuContains,previewDocument};
})();
