/* Manage only the status-panel records currently displayed in the 404 viewer. */
(function(){
'use strict';
function preview(html){const template=document.createElement('template');template.innerHTML=String(html||'');template.content.querySelectorAll('style,script,head').forEach(n=>n.remove());return (template.content.textContent||'').replace(/\s+/g,' ').trim().slice(0,110)||'状态内容';}
function time(value){if(!value)return '时间未记录';const d=new Date(value);return Number.isNaN(d.getTime())?'时间未记录':d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});}
window.attachStatusHistoryControls=function(char,content,slides,swiper,indicator,options={}){
 const panel=options.panel||char.statusPanel,archiveId=char.activeArchiveId;
 const historyAtOpen=Array.isArray(panel.history)?panel.history:[];
 const fallback=historyAtOpen.length===0 && slides.length>0;
 const currentHtml=panel.currentStatusHtml,currentRaw=panel.currentStatusRaw;if(fallback&&slides[0]){slides[0].timestamp=0;slides[0].raw=currentRaw;}
 let selected=new Set(),selecting=false,pending=false,list=null,confirmation=null;
 const toolbar=document.createElement('div');toolbar.className='sh-toolbar sh-toolbar-compact';
 const tools=document.createElement('div');tools.className='sh-history-tools';
 const actions=document.createElement('div');actions.className='sh-actions';toolbar.append(actions);
 function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;actions.append(b);return b;}
 const glyphs={delete:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5m4-5v5',favorite:'M6 3h12v18l-6-4-6 4Z',regenerate:'M12.05 20q-3.35 0-5.7-2.325T4 12v-.175l-.9.9Q2.825 13 2.4 13t-.7-.275t-.275-.7t.275-.7l2.6-2.6q.3-.3.7-.3t.7.3l2.6 2.6q.275.275.275.7t-.275.7t-.7.275t-.7-.275l-.9-.9V12q0 2.5 1.763 4.25T12.05 18q.4 0 .788-.05t.762-.175q.425-.125.8.025t.575.525q.2.4.038.787t-.588.513q-.575.2-1.175.288t-1.2.087m-.1-14q-.4 0-.787.05t-.763.175q-.425.125-.812-.025T9 5.675t-.038-.762t.563-.513q.6-.2 1.2-.3T11.95 4q3.35 0 5.7 2.325T20 12v.175l.9-.9q.275-.275.7-.275t.7.275t.275.7t-.275.7l-2.6 2.6q-.3.3-.7.3t-.7-.3l-2.6-2.6q-.275-.275-.275-.7t.275-.7t.7-.275t.7.275l.9.9V12q0-2.5-1.763-4.25T11.95 6',close:'M6 6l12 12M18 6 6 18'};
 function label(b,key,text){const style=key==='regenerate'?'fill="currentColor" stroke="none"':'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';b.innerHTML=`<span class="sh-control-icon"><svg viewBox="0 0 24 24" ${style} aria-hidden="true"><path d="${glyphs[key]}"/></svg></span><span class="sh-control-text">${text}</span>`;b.setAttribute('aria-label',text);}

 const one=button('删除',()=>ask([slides[currentIndex()]]));one.dataset.shDeleteCurrent='';label(one,'delete','删除');
 const star=button('收藏',()=>favorite());star.dataset.shFavorite='';label(star,'favorite','收藏');
 const regen=button('重生成',()=>regenerate());regen.dataset.shRegenerate='';label(regen,'regenerate','重生成');
 const closeButton=button('关闭',()=>document.getElementById('char-status-overlay')?.classList.remove('visible'));closeButton.dataset.shClose='';label(closeButton,'close','关闭');
 const multi=document.createElement('button');multi.type='button';multi.textContent='管理记录';multi.onclick=()=>toggleSelection();multi.dataset.shMulti='';tools.append(multi);
 content.prepend(tools);
 function signature(item){return String(item.raw||item.html||'')+'@'+String(item.timestamp||'');}
 function favorites(){return panel.favorites||[];}
 function current(){return slides[currentIndex()];}
 function syncStar(){const active=current()&&(window.KissCollections?window.KissCollections.has(char,'status',current()):favorites().some(x=>signature(x)===signature(current())));star.classList.toggle('is-saved',!!active);star.setAttribute('aria-pressed',String(!!active));label(star,'favorite',active?'已收藏':'收藏');star.disabled=!slides.length||pending;regen.disabled=!slides.length||pending||!panel.regexPattern;}
 swiper?.addEventListener('scroll',syncStar,{passive:true});syncStar();
 async function favorite(){if(pending||!valid()||!current())return;const target={...current()};pending=true;toolbar.querySelectorAll('button').forEach(b=>b.disabled=b!==closeButton);try{if(!window.KissCollections)throw Error('收藏模块尚未就绪');await window.KissCollections.migrate();if(!valid())throw Error('聊天或存档已切换，请重新收藏');const active=await window.KissCollections.toggleStatus(char,target);showToast(active?'已收藏状态':'已取消收藏');}catch(error){showToast(error.message||'收藏保存失败');}finally{pending=false;toolbar.querySelectorAll('button').forEach(b=>b.disabled=!slides.length&&b!==closeButton);syncStar();}}

 async function regenerate(){
  if(pending||!valid()||!current())return;const item=current(),raw=item.raw,html=item.html,previousRegeneratedAt=item.regeneratedAt,regexAtStart=panel.regexPattern,templateAtStart=panel.replacePattern;
  let config={...db.apiSettings};if(char.exclusiveApiEnabled&&char.exclusiveApiPreset){const preset=(db.apiPresets||[]).find(p=>p.name===char.exclusiveApiPreset)?.data;if(preset)config={...config,url:preset.apiUrl||config.url,key:preset.apiKey||config.key,model:preset.model||config.model,provider:preset.provider||config.provider,temperature:preset.temperature??config.temperature,temperatureEnabled:preset.temperatureEnabled??config.temperatureEnabled};}
  if(options.offline)try{config=window.KissOffline.resolveOfflineApi(char,config);}catch(error){return showToast(error.message);}
  if(!config.url||!config.key||!config.model)return showToast('请先配置聊天 API');
  const feedback=window.KissReroll;if(!feedback)return showToast('重生成模块未加载，请刷新页面');const token=feedback.capture(char);
  const guard=()=>!pending&&valid()&&content.isConnected&&feedback.valid(char,token)&&current()===item&&item.raw===raw&&item.html===html&&panel.regexPattern===regexAtStart&&panel.replacePattern===templateAtStart;
  const rerollNote=await feedback.ask({subtitle:options.offline?'线下状态栏 · 只重生成当前选中的状态':'状态栏 · 只重生成当前选中的状态',guard});if(rerollNote===null||!guard())return;
  pending=true;toolbar.querySelectorAll('button').forEach(b=>b.disabled=b!==closeButton);multi.disabled=true;label(regen,'regenerate','生成中');
  try{if(window.PhoneBackup?.hydrateChat)await window.PhoneBackup.hydrateChat(char);const recent=typeof filterHistoryForAI==='function'?filterHistoryForAI(char,(char.history||[]).slice(-30)):(char.history||[]).slice(-30);const messages=[{role:'system',content:options.offline?window.KissOffline.prompt(char):generatePrivateSystemPrompt(char)},{role:'user',content:'仅重新生成当前状态栏，不续写聊天、不发送聊天消息或其他操作。严格沿用已配置的状态栏格式要求，只输出能被状态栏正则匹配的原始状态。当前内容是参考数据：'+JSON.stringify({current:raw||preview(html),format:panel.promptSuffix||'',recent:recent.map(m=>({role:m.role,content:typeof m.content==='string'?m.content.slice(0,1600):''}))})}];const {requestBody,headers,endpoint}=buildChatApiRequest(config,messages,{temperature:config.temperatureEnabled===false?undefined:config.temperature??.85});feedback.inject(requestBody,config.provider,rerollNote);const result=await fetchAiResponse(config,requestBody,headers,endpoint);let pattern=regexAtStart,flags='gs';const parts=pattern.match(/^\/(.*?)\/([a-z]*)$/);if(parts){pattern=parts[1];flags=parts[2]||'gs';if(!flags.includes('s'))flags+='s';}const match=new RegExp(pattern,flags).exec(String(result));if(!match)throw Error('返回内容不符合状态栏格式，原记录已保留');if(!valid()||!feedback.valid(char,token)||!content.isConnected||panel.regexPattern!==regexAtStart||panel.replacePattern!==templateAtStart||item.raw!==raw||item.html!==html||(!fallback&&!(panel.history||[]).includes(item))||fallback&&(panel.history||[]).length)throw Error('状态记录已变化，本次结果未写入');const nextHtml=String(templateAtStart||'').replace(/\$(\d+)/g,(whole,i)=>match[Number(i)]??whole);const newest=fallback||(panel.history||[])[0]===item;const oldCurrent=[panel.currentStatusHtml,panel.currentStatusRaw],oldHistory=panel.history;item.raw=match[0];item.html=nextHtml;item.regeneratedAt=Date.now();if(fallback)panel.history=[item];if(newest){panel.currentStatusHtml=nextHtml;panel.currentStatusRaw=match[0];}try{await saveData();}catch(error){item.raw=raw;item.html=html;if(previousRegeneratedAt===undefined)delete item.regeneratedAt;else item.regeneratedAt=previousRegeneratedAt;if(fallback&&panel.history?.[0]===item)panel.history=oldHistory;if(newest&&panel.currentStatusHtml===nextHtml){panel.currentStatusHtml=oldCurrent[0];panel.currentStatusRaw=oldCurrent[1];}throw error;}window.KissDiagnostics?.record({app:'status',feature:'重生成',title:'状态栏重新生成完成',detail:'仅替换所选状态，没有追加聊天消息',phase:'end'});if(valid()&&content.isConnected&&document.getElementById('char-status-overlay')?.classList.contains('visible'))window.openCharacterStatusPanel?.(char,options.offline?panel:undefined);showToast('状态已重新生成');
  }catch(error){window.KissDiagnostics?.record({app:'status',feature:'重生成',title:'状态重生成失败',detail:error.message,level:'error'});showToast(error.message||'生成失败，原记录已保留');}finally{pending=false;if(toolbar.isConnected){toolbar.querySelectorAll('button').forEach(b=>b.disabled=!slides.length&&b!==closeButton);multi.disabled=!slides.length;label(regen,'regenerate','重生成');syncStar();}}
 }

 content.prepend(toolbar);
 const footer=document.createElement('div');footer.className='sh-selection-footer';footer.hidden=true;
 const count=document.createElement('span');const all=document.createElement('button');all.type='button';all.textContent='全选';all.dataset.shAll='';
 const remove=document.createElement('button');remove.type='button';remove.textContent='删除所选';remove.className='sh-primary';remove.dataset.shDeleteSelected='';footer.append(count,all,remove);content.append(footer);
 function currentIndex(){if(!swiper||!swiper.offsetWidth)return Math.max(0,slides.length-1);return Math.max(0,Math.min(slides.length-1,Math.round(swiper.scrollLeft/swiper.offsetWidth)));}
 function update(){count.textContent='已选 '+selected.size+' / '+slides.length;remove.disabled=!selected.size||pending;all.textContent=selected.size===slides.length?'全不选':'全选';list?.querySelectorAll('input').forEach((input,i)=>{input.checked=selected.has(slides[i]);});}
 function dismiss(){confirmation?.remove();confirmation=null;}
 function toggleSelection(){if(pending)return;dismiss();selecting=!selecting;multi.textContent=selecting?'完成管理':'管理记录';one.hidden=selecting;star.hidden=selecting;regen.hidden=selecting;footer.hidden=!selecting;swiper && (swiper.hidden=selecting);if(indicator)indicator.hidden=selecting;
  if(selecting){list=document.createElement('div');list.className='sh-list';slides.forEach((item,i)=>{const label=document.createElement('label');label.className='sh-row';const input=document.createElement('input');input.type='checkbox';input.dataset.shIndex=String(i);input.setAttribute('aria-label','选择状态 '+(i+1));const copy=document.createElement('span');const top=document.createElement('span');top.className='sh-row-top';const title=document.createElement('strong');title.textContent='状态 '+String(i+1).padStart(2,'0');const date=document.createElement('time');date.textContent=time(item.timestamp);top.append(title,date);const p=document.createElement('span');p.className='sh-preview';p.textContent=preview(item.html);copy.append(top,p);label.append(input,copy);input.onchange=()=>{dismiss();input.checked?selected.add(item):selected.delete(item);update();};list.append(label);});content.insertBefore(list,footer);update();}
  else{list?.remove();list=null;}
 }
 all.onclick=()=>{dismiss();selected=selected.size===slides.length?new Set():new Set(slides);update();};remove.onclick=()=>ask([...selected]);
 if(!slides.length){one.disabled=true;multi.disabled=true;star.disabled=true;regen.disabled=true;const empty=content.querySelector('p');if(empty){empty.className='sh-empty';empty.textContent='还没有状态记录。';}}
 function valid(){return char.id===currentChatId && db.characters.includes(char) && (options.offline?char.offline?.statusPanel===panel:char.statusPanel===panel) && char.activeArchiveId===archiveId;}
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
  toolbar.querySelectorAll('button').forEach(b=>b.disabled=b!==closeButton);footer.querySelectorAll('button').forEach(b=>b.disabled=true);confirmation?.querySelectorAll('button').forEach(b=>b.disabled=true);list?.querySelectorAll('input').forEach(i=>i.disabled=true);
  try{await saveData();dismiss();if(valid()&&document.getElementById('char-status-overlay')?.classList.contains('visible'))window.openCharacterStatusPanel?.(char,options.offline?panel:undefined);showToast('已删除 '+(removed.length||1)+' 条状态');}
  catch(error){if(panel.history===next)panel.history=live;else panel.history=[...panel.history,...removed.filter(x=>!panel.history.includes(x))].sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));if(panel.currentStatusHtml===writtenHtml && panel.currentStatusRaw===writtenRaw){panel.currentStatusHtml=oldHtml;panel.currentStatusRaw=oldRaw;}if(typeof syncChatActiveArchive==='function')syncChatActiveArchive(char);showToast('删除保存失败，状态记录已恢复');dismiss();}
  finally{pending=false;if(toolbar.isConnected){toolbar.querySelectorAll('button').forEach(b=>b.disabled=!slides.length&&b!==closeButton);list?.querySelectorAll('input').forEach(i=>i.disabled=false);all.disabled=false;update();}}
 }
};
})();
