/* Independent built-in appearance. Never rewrites saved custom CSS or reaction settings. */
(() => {
'use strict';
let activeChat=null, frame=0;
const entryUnread=new WeakMap();
const enabled=c=>c?.defaultAppearance==='imessage';
function enter(chat){entryUnread.set(chat,Math.max(0,Number(chat.unreadCount)||0));}
function syncNight(){const root=document.getElementById('chat-room-screen');root?.classList.toggle('ki-night',typeof db!=='undefined'&&db.homeScreenMode==='night');}
function apply(chat){
 activeChat=chat;
 const root=document.getElementById('chat-room-screen');if(!root)return;
 root.classList.toggle('ki-imessage',enabled(chat));root.classList.toggle('ki-wallpaper',enabled(chat)&&!!chat.chatBg);syncNight();
 root.querySelectorAll('[data-ki-owned],.ki-receipt,.ki-unread-divider').forEach(n=>n.remove());
 root.querySelector('#chat-room-header-default .back-btn')?.removeAttribute('aria-label');
 const input=root.querySelector('#message-input');
 if(input){if(enabled(chat)){if(!input.hasAttribute('data-ki-placeholder'))input.setAttribute('data-ki-placeholder',input.getAttribute('placeholder')||'');input.placeholder='iMessage信息';}else if(input.hasAttribute('data-ki-placeholder')){input.placeholder=input.getAttribute('data-ki-placeholder');input.removeAttribute('data-ki-placeholder');}}
 if(!enabled(chat))return;
 const title=root.querySelector('.title-container');
 if(title){const avatar=document.createElement('img');avatar.className='ki-contact-avatar';avatar.dataset.kiOwned='';avatar.alt='';avatar.src=chat.avatar||'';const contact=document.createElement('button');contact.type='button';contact.className='ki-contact-button';contact.dataset.kiOwned='';contact.setAttribute('aria-label','联系人与聊天设置');contact.onclick=()=>root.querySelector('#chat-settings-btn')?.click();contact.append(avatar);title.prepend(contact);}
 const camera=document.createElement('button');camera.type='button';camera.className='action-btn ki-video-button';camera.dataset.kiOwned='';camera.setAttribute('aria-label','通话');camera.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="13" height="14" rx="4"/><path d="m15 9 7-4v14l-7-4Z"/></svg>';camera.onclick=()=>root.querySelector('#video-call-btn')?.click();root.querySelector('#chat-room-header-default .action-btn-group')?.append(camera);
 const back=root.querySelector('#chat-room-header-default .back-btn');
 const others=typeof db!=='undefined'?[...db.characters,...db.groups].filter(c=>c!==chat).reduce((n,c)=>n+Math.max(0,Number(c.unreadCount)||0),0):0;
 if(back&&others){const badge=document.createElement('span');badge.className='ki-unread-count';badge.dataset.kiOwned='';badge.textContent=others>99?'99+':String(others);back.append(badge);back.setAttribute('aria-label','返回，其他聊天有 '+others+' 条未读消息');}else back?.removeAttribute('aria-label');
 schedule();
}
function decorate(){
 const root=document.getElementById('chat-room-screen');if(!enabled(activeChat)||!root?.classList.contains('ki-imessage'))return;
 const area=root.querySelector('#message-area');if(!area)return;
 area.querySelectorAll('.ki-receipt,.ki-unread-divider').forEach(n=>n.remove());
 const wrappers=[...area.querySelectorAll('.message-wrapper')];
 wrappers.forEach((row,i)=>{const next=wrappers[i+1];row.classList.toggle('ki-tail',!next||next.dataset.continuous!=='true'||next.classList.contains('sent')!==row.classList.contains('sent'));});
 const history=(activeChat.history||[]).filter(m=>!m.offlineNarrative&&!m.offlineSessionId&&!m.offlineArchiveId&&!m.offlineBoundary&&!m.offlineHidden);
 const unread=entryUnread.get(activeChat)||0;
 const incoming=history.filter(m=>m.role==='assistant');
 if(unread&&incoming.length){const first=incoming[Math.max(0,incoming.length-unread)];const row=wrappers.find(n=>String(n.dataset.id)===String(first.id));if(row){const line=document.createElement('div');line.className='ki-unread-divider';line.textContent='未读信息';row.before(line);}}
 let lastSent=-1;for(let i=history.length-1;i>=0;i--)if(history[i].role==='user'){lastSent=i;break;}
 if(lastSent>=0){const msg=history[lastSent],row=wrappers.find(n=>String(n.dataset.id)===String(msg.id));if(row&&!msg.deliveryFailed&&!msg.isWithdrawn){const status=document.createElement('span');status.className='ki-receipt';status.textContent=history.slice(lastSent+1).some(m=>m.role==='assistant')?'已读':'已送达';row.append(status);}}
}
function schedule(){if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=0;decorate();});}
function menu(node){if(!enabled(activeChat)||!document.getElementById('chat-room-screen')?.classList.contains('active'))return;node.classList.add('ki-message-menu');node.classList.toggle('ki-night',document.getElementById('chat-room-screen').classList.contains('ki-night'));}
window.KissIMessageStyle={enabled,enter,apply,syncNight,schedule,decorate,menu};
})();
