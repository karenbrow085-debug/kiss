/* Manage only the status-panel records currently displayed in the 404 viewer. */
(function(){
'use strict';
function preview(html){const template=document.createElement('template');template.innerHTML=String(html||'');template.content.querySelectorAll('style,script,head').forEach(n=>n.remove());return (template.content.textContent||'').replace(/\s+/g,' ').trim().slice(0,110)||'状态内容';}
function time(value){if(!value)return '时间未记录';const d=new Date(value);return Number.isNaN(d.getTime())?'时间未记录':d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});}
window.attachStatusHistoryControls=function(char,content,slides,swiper,indicator){
 const panel=char.statusPanel,archiveId=char.activeArchiveId;
 const historyAtOpen=Array.isArray(panel.history)?panel.history:[];
 const fallback=historyAtOpen.length===0 && slides.length>0;
 const currentHtml=panel.currentStatusHtml,currentRaw=panel.currentStatusRaw;
 let selected=new Set(),selecting=false,pending=false,list=null,confirmation=null;
 const toolbar=document.createElement('div');toolbar.className='sh-toolbar';
 const heading=document.createElement('div');heading.className='sh-heading';heading.innerHTML='<small>STATES / HISTORY</small><strong>状态记录</strong>';toolbar.append(heading);
 const actions=document.createElement('div');actions.className='sh-actions';toolbar.append(actions);
 function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;actions.append(b);return b;}
 const one=button('删除当前',()=>ask([slides[currentIndex()]]));one.dataset.shDeleteCurrent='';
 const multi=button('多选',()=>toggleSelection());multi.dataset.shMulti='';
 content.prepend(toolbar);
 const footer=document.createElement('div');footer.className='sh-selection-footer';footer.hidden=true;
 const count=document.createElement('span');const all=document.createElement('button');all.type='button';all.textContent='全选';all.dataset.shAll='';
 const remove=document.createElement('button');remove.type='button';remove.textContent='删除所选';remove.className='sh-primary';remove.dataset.shDeleteSelected='';footer.append(count,all,remove);content.append(footer);
 function currentIndex(){if(!swiper||!swiper.offsetWidth)return Math.max(0,slides.length-1);return Math.max(0,Math.min(slides.length-1,Math.round(swiper.scrollLeft/swiper.offsetWidth)));}
 function update(){count.textContent='已选 '+selected.size+' / '+slides.length;remove.disabled=!selected.size||pending;all.textContent=selected.size===slides.length?'全不选':'全选';list?.querySelectorAll('input').forEach((input,i)=>{input.checked=selected.has(slides[i]);});}
 function dismiss(){confirmation?.remove();confirmation=null;}
 function toggleSelection(){dismiss();selecting=!selecting;multi.textContent=selecting?'完成':'多选';one.hidden=selecting;footer.hidden=!selecting;swiper && (swiper.hidden=selecting);if(indicator)indicator.hidden=selecting;
  if(selecting){list=document.createElement('div');list.className='sh-list';slides.forEach((item,i)=>{const label=document.createElement('label');label.className='sh-row';const input=document.createElement('input');input.type='checkbox';input.dataset.shIndex=String(i);input.setAttribute('aria-label','选择状态 '+(i+1));const copy=document.createElement('span');const top=document.createElement('span');top.className='sh-row-top';const title=document.createElement('strong');title.textContent='状态 '+String(i+1).padStart(2,'0');const date=document.createElement('time');date.textContent=time(item.timestamp);top.append(title,date);const p=document.createElement('span');p.className='sh-preview';p.textContent=preview(item.html);copy.append(top,p);label.append(input,copy);input.onchange=()=>{dismiss();input.checked?selected.add(item):selected.delete(item);update();};list.append(label);});content.insertBefore(list,footer);update();}
  else{list?.remove();list=null;}
 }
 all.onclick=()=>{dismiss();selected=selected.size===slides.length?new Set():new Set(slides);update();};remove.onclick=()=>ask([...selected]);
 if(!slides.length){one.disabled=true;multi.disabled=true;const empty=content.querySelector('p');if(empty){empty.className='sh-empty';empty.textContent='还没有状态记录。';}}
 function valid(){return char.id===currentChatId && db.characters.includes(char) && char.statusPanel===panel && char.activeArchiveId===archiveId;}
 function ask(items){if(pending)return;const targets=items.filter(Boolean);if(!targets.length)return;dismiss();confirmation=document.createElement('div');confirmation.className='sh-confirm';confirmation.setAttribute('role','alertdialog');confirmation.setAttribute('aria-label','确认删除状态记录');const title=document.createElement('strong');title.textContent=targets.length===1?'删除这条状态？':'删除所选 '+targets.length+' 条状态？';const p=document.createElement('p');p.textContent='只删除状态记录，聊天消息保留。';const buttons=document.createElement('div');const cancel=document.createElement('button');cancel.type='button';cancel.textContent='取消';cancel.onclick=dismiss;const confirm=document.createElement('button');confirm.type='button';confirm.className='sh-primary';confirm.textContent='确认删除';confirm.dataset.shConfirm='';confirm.onclick=()=>commit(targets);buttons.append(cancel,confirm);confirmation.append(title,p,buttons);content.append(confirmation);cancel.focus();}
 async function commit(items){
  if(pending)return;if(!valid()){dismiss();showToast('聊天或存档已切换，请重新打开状态栏');return;}
  const live=Array.isArray(panel.history)?panel.history:[];const targets=new Set(items);const removed=live.filter(item=>targets.has(item));
  const clearFallback=fallback && targets.has(slides[0]) && live.length===0 && panel.currentStatusHtml===currentHtml && panel.currentStatusRaw===currentRaw;
  if(!removed.length && !clearFallback){dismiss();showToast('这些状态已更新，请重新打开状态栏');return;}
  const oldHtml=panel.currentStatusHtml,oldRaw=panel.currentStatusRaw;
  const next=live.filter(item=>!targets.has(item));
  const removedCurrent=live.length>0 && targets.has(live[0]) && panel.currentStatusHtml===live[0].html && (!live[0].raw || panel.currentStatusRaw===live[0].raw);
  panel.history=next;
  if(removedCurrent||clearFallback){panel.currentStatusHtml=next[0]?.html||'';panel.currentStatusRaw=next[0]?.raw||'';}
  const writtenHtml=panel.currentStatusHtml,writtenRaw=panel.currentStatusRaw;pending=true;
  toolbar.querySelectorAll('button').forEach(b=>b.disabled=true);footer.querySelectorAll('button').forEach(b=>b.disabled=true);confirmation?.querySelectorAll('button').forEach(b=>b.disabled=true);list?.querySelectorAll('input').forEach(i=>i.disabled=true);
  try{await saveData();dismiss();if(valid()&&document.getElementById('char-status-overlay')?.classList.contains('visible'))document.getElementById('char-status-btn').click();showToast('已删除 '+(removed.length||1)+' 条状态');}
  catch(error){if(panel.history===next)panel.history=live;else panel.history=[...panel.history,...removed.filter(x=>!panel.history.includes(x))].sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));if(panel.currentStatusHtml===writtenHtml && panel.currentStatusRaw===writtenRaw){panel.currentStatusHtml=oldHtml;panel.currentStatusRaw=oldRaw;}if(typeof syncChatActiveArchive==='function')syncChatActiveArchive(char);showToast('删除保存失败，状态记录已恢复');dismiss();}
  finally{pending=false;if(toolbar.isConnected){toolbar.querySelectorAll('button').forEach(b=>b.disabled=!slides.length);list?.querySelectorAll('input').forEach(i=>i.disabled=false);all.disabled=false;update();}}
 }
};
})();
