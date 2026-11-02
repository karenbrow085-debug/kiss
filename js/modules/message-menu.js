/* Message-only menu: keep chat-list menus and existing message actions independent. */
(() => {
'use strict';
const icons = {
 '编辑':'<path d="m4 16 12-12 4 4L8 20H4Z M13 7l4 4"/>',
 '引用':'<path d="M10 5H4v8h5v6M20 5h-6v8h5v6"/>',
 '撤回':'<path d="m8 4-5 5 5 5M3 9h11a7 7 0 0 1 0 14"/>',
 '接收照片':'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="9" r="1"/><path d="m3 17 6-5 4 3 4-5 4 5"/>',
 '新增':'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 7v10M7 12h10"/>',
 '调试':'<path d="m8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18"/>',
 '收藏':'<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
 '删除':'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
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
 const v=window.visualViewport;
 const bounds={left:Math.max(v?.offsetLeft||0,phone?.left||0)+10,right:Math.min((v?.offsetLeft||0)+(v?.width||innerWidth),phone?.right||innerWidth)-10,top:(v?.offsetTop||0)+10,bottom:(v?.offsetTop||0)+(v?.height||innerHeight)-10};
 menu.style.width=Math.min(360,bounds.right-bounds.left)+'px';
 menu.style.maxHeight=Math.max(80,bounds.bottom-bounds.top-16)+'px';
 const r=menu.getBoundingClientRect();
 const center=(a.left+a.right)/2;
 const left=Math.max(bounds.left,Math.min(center-r.width/2,bounds.right-r.width));
 const above=a.top-r.height-13>=bounds.top || a.top-bounds.top>bounds.bottom-a.bottom;
 const top=Math.max(bounds.top,Math.min(above?a.top-r.height-13:a.bottom+13,bounds.bottom-r.height));
 menu.style.left=left+'px';menu.style.top=top+'px';
 menu.dataset.side=above?'above':'below';
 menu.style.setProperty('--km-tip',Math.max(20,Math.min(center-left,r.width-20))+'px');
 menu.style.visibility='visible';
}
function open(items,options) {
 const previous=document.activeElement;
 const menu=document.createElement('div');menu.className='context-menu km-message-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','消息操作');menu.style.visibility='hidden';menu._kissAnchor=options;
 const actions=document.createElement('div');actions.className='km-actions';
 for(let i=0;i<items.length;i+=5){
  const row=document.createElement('div');row.className='km-row';
  for(const item of items.slice(i,i+5)){
   const button=document.createElement('button');button.type='button';button.className='km-action';button.setAttribute('role','menuitem');button.setAttribute('aria-label',item.label);
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
 document.addEventListener('pointerdown',dismiss,true);document.addEventListener('keydown',key);document.addEventListener('scroll',scroll,true);window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);
 menu._kissMenuCleanup=()=>{cancelAnimationFrame(frame);document.removeEventListener('pointerdown',dismiss,true);document.removeEventListener('keydown',key);document.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);};
 return menu;
}
window.KissMessageMenu={open,position};
})();
