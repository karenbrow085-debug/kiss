/* Message-only menu: keep chat-list menus and existing message actions independent. */
(() => {
'use strict';
const icons = {
 '编辑':'<path d="m4 16 12-12 4 4L8 20H4Z M13 7l4 4"/>',
 '引用':'<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M10 7H7v6h3v4M17 7h-3v6h3v4" stroke="#4c4c4c" stroke-width="2"/>',
 '撤回':'<path d="m8 4-5 5 5 5M3 9h11a7 7 0 0 1 0 14"/>',
 '接收照片':'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="9" r="1"/><path d="m3 17 6-5 4 3 4-5 4 5"/>',
 '新增':'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 7v10M7 12h10"/>',
 '调试':'<path d="m8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18"/>',
 '收藏':'<path d="m12 2 9 5v10l-9 5-9-5V7Z" fill="currentColor" stroke="none"/><path d="m3 7 9 5 9-5M12 12v10" stroke="#4c4c4c" stroke-width="1.5"/>',
 '删除':'<path d="M5 7h14l-1 14H6Z" fill="currentColor" stroke="none"/><path d="M3 5h18M9 5V3h6v2"/><path d="M10 10v8m4-8v8" stroke="#4c4c4c" stroke-width="1.4"/>',
 '分支':'<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 7v10M18 7v2a5 5 0 0 1-5 5H6"/>'
};
function icon(label) {
 const key=Object.keys(icons).find(k=>label.includes(k));
 return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[key]||'<circle cx="12" cy="12" r="8"/><path d="M8 12h8"/>')+'</svg>';
}
function position(menu) {
 if(!menu?.isConnected)return;
 const {anchor,x,y}=menu._kissAnchor;
 const bubble=anchor?.querySelector('.message-bubble,.voice-bubble,.image-bubble,.kt-invite-card')||anchor;
 const a=bubble?.getBoundingClientRect()||{left:x,right:x,top:y,bottom:y};
 const phone=anchor?.closest('.phone-screen')?.getBoundingClientRect();
 const room=anchor?.closest('#chat-room-screen');
 const header=room?.querySelector('#chat-room-header-default,.app-header');
 const composer=room?.querySelector('.chat-input-wrapper');
 const area=room?.querySelector('#message-area');
 const visibleRect=node=>{const r=node?.getBoundingClientRect();return r&&r.width>0&&r.height>0?r:null;};
 const headerRect=visibleRect(header),composerRect=visibleRect(composer),roomRect=visibleRect(room),areaRect=visibleRect(area);
 const v=window.visualViewport;
 const safe=typeof getComputedStyle==='function'?getComputedStyle(menu):null;
 const safeTop=parseFloat(safe?.getPropertyValue('--kmsg-safe-top'))||0,safeBottom=parseFloat(safe?.getPropertyValue('--kmsg-safe-bottom'))||0;
 const bounds={left:Math.max(v?.offsetLeft||0,phone?.left||0)+10,right:Math.min((v?.offsetLeft||0)+(v?.width||innerWidth),phone?.right||innerWidth)-10,top:Math.max((v?.offsetTop||0)+safeTop,roomRect?.top||0,headerRect?.bottom||0,areaRect?.top||0)+10,bottom:Math.min((v?.offsetTop||0)+(v?.height||innerHeight)-safeBottom,roomRect?.bottom||Infinity,composerRect?.top||Infinity,areaRect?.bottom||Infinity)-10};
 if(bounds.bottom-bounds.top<120){bounds.top=(v?.offsetTop||0)+safeTop+10;bounds.bottom=(v?.offsetTop||0)+(v?.height||innerHeight)-safeBottom-10;}
 const height=Math.max(44,bounds.bottom-bounds.top);
 menu.style.width=Math.max(120,Math.min(360,bounds.right-bounds.left))+'px';
 menu.style.maxHeight=height+'px';
 const actions=menu.querySelector?.('.kmsg-actions'),quick=menu.querySelector?.('.kr-quick');
 if(actions)actions.style.maxHeight=Math.max(44,height-(quick?.getBoundingClientRect().height||0)-6)+'px';
 const r=menu.getBoundingClientRect();
 const center=(a.left+a.right)/2;
 const left=Math.max(bounds.left,Math.min(center-r.width/2,bounds.right-r.width));
 const above=a.top-r.height-9>=bounds.top || (a.bottom+r.height+9>bounds.bottom && a.top-bounds.top>bounds.bottom-a.bottom);
 const top=Math.max(bounds.top,Math.min(above?a.top-r.height-9:a.bottom+9,bounds.bottom-r.height));
 menu.style.left=left+'px';menu.style.top=top+'px';
 menu.dataset.side=above?'above':'below';
 menu.style.setProperty('--km-tip',Math.max(20,Math.min(center-left,r.width-20))+'px');
 menu.style.visibility='visible';
}
function open(items,options) {
 const previous=document.activeElement;
 const menu=document.createElement('div');menu.className='context-menu km-message-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','消息操作');menu.style.visibility='hidden';menu._kissAnchor=options;
 const actions=document.createElement('div');actions.className='kmsg-actions';
 for(let i=0;i<items.length;i+=5){
  const row=document.createElement('div');row.className='kmsg-row';
  for(const item of items.slice(i,i+5)){
   const button=document.createElement('button');button.type='button';button.className='kmsg-action';button.setAttribute('role','menuitem');button.setAttribute('aria-label',item.label);
   if(item.danger)button.classList.add('danger');
   button.innerHTML=icon(item.label);const label=document.createElement('span');label.textContent=item.label==='从这里创建分支'?'创建分支':item.label;button.append(label);
   button.onclick=()=>{removeContextMenu();try{Promise.resolve(item.action()).catch(e=>showToast(e.message||'操作失败，请重试'));}catch(e){showToast(e.message||'操作失败，请重试');}};
   row.append(button);
  }
  actions.append(row);
 }
 menu.append(actions);document.body.append(menu);position(menu);
 let frame=0;
 const resize=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>position(menu));};
 const dismiss=e=>{if(!menu.contains(e.target))removeContextMenu();};
 const scroll=e=>{if(!menu.contains(e.target))removeContextMenu();};
 const key=e=>{
  if(e.key==='Escape'){e.preventDefault();removeContextMenu();previous?.focus?.({preventScroll:true});return;}
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
  e.preventDefault();const buttons=[...menu.querySelectorAll('button')];let i=buttons.indexOf(document.activeElement);const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-5,ArrowDown:5}[e.key];i=e.key==='Home'?0:e.key==='End'?buttons.length-1:(Math.max(0,i)+(step||0)+buttons.length)%buttons.length;buttons[i]?.focus();
 };
 document.addEventListener('pointerdown',dismiss,true);document.addEventListener('keydown',key);document.addEventListener('scroll',scroll,true);window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);
 menu._kissMenuCleanup=()=>{cancelAnimationFrame(frame);document.removeEventListener('pointerdown',dismiss,true);document.removeEventListener('keydown',key);document.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('scroll',resize);};
 return menu;
}
window.KissMessageMenu={open,position};
})();
