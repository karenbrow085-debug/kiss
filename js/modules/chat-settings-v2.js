/* Silver ins settings. Existing controls are moved, never cloned or discarded. */
(() => {
'use strict';
const $=id=>document.getElementById(id), el=(tag,cls,html)=>{const n=document.createElement(tag);n.className=cls;if(html)n.innerHTML=html;return n;};
let root,clockTimer,modelRequest=0,modelRows=[];
const scriptLocation=typeof document!=='undefined'?document.currentScript?.src:null;
const titles={basic:'Personal / ふたりの設定',func:'Conversation / 對話設定',style:'Appearance / 視覺外觀',exclusive:'Exclusive / 專屬設定'};
const row=id=>$(id)?.closest('.kkt-item');
const group=(label,cls='')=>el('section','ksv-section '+cls,`<h2>${label}</h2>`);
function moveRows(ids,to){ids.forEach(id=>{const r=row(id);if(r)to.append(r);});}
function button(text,action,cls=''){const b=el('button',cls);b.type='button';b.textContent=text;if(action)b.onclick=action;return b;}
function mount(container){
 if(container.dataset.ksvMounted)return;container.dataset.ksvMounted='1';root=container;container.classList.add('ksv-settings');
 if(!colorThemes.white_silver)colorThemes.white_silver={name:'银白',received:{bg:'rgba(255,255,255,.86)',text:'#353640'},sent:{bg:'rgba(226,227,232,.9)',text:'#353640'}};
 const main=container.querySelector('main'),shell=container.querySelector('.kkt-settings-container'),oldHeader=container.querySelector('.app-header'),profile=container.querySelector('.kkt-profile-section');
 const hero=el('section','ksv-hero',`<div class="ksv-heading"><div class="ksv-heading-copy"><h1>Chat settings</h1><p>404 / ふたりの設定</p></div><span class="ksv-glint">✦<small>·</small></span><div class="ksv-pair"><img id="ksv-header-character" alt="角色头像"><img id="ksv-header-user" alt="我的头像"></div></div><div class="ksv-collage" aria-label="银色心形挂件与黑白人物拼贴"><img alt="" draggable="false" decoding="async"><span class="ksv-banner-sparkle" aria-hidden="true">✦</span><svg class="ksv-paperclip" viewBox="0 0 34 70" fill="none" aria-hidden="true"><path d="M12 49 27 17C33 4 21-1 15 11L3 38c-10 22 8 28 17 9l11-24M10 41 23 13" stroke="#a0a1a6" stroke-width="4" stroke-linecap="round"/><path d="M12 49 27 17C33 4 21-1 15 11L3 38c-10 22 8 28 17 9l11-24M10 41 23 13" stroke="#fafafa" stroke-width="1.5" stroke-linecap="round"/></svg><div class="ksv-nameplate" aria-label="双方昵称"><span id="ksv-plate-name"></span><span class="ksv-pair-times" aria-hidden="true">×</span><span id="ksv-plate-user-name"></span></div></div>`);
 const back=oldHeader.querySelector('.back-btn');hero.querySelector('.ksv-heading').prepend(back);oldHeader.remove();shell.prepend(hero);setupBanner(hero.querySelector('.ksv-collage>img'));
 // Keep original profile image/upload IDs inside the shared identity composition.
 profile.hidden=true;profile.classList.add('ksv-legacy-profile');
 const tabs=container.querySelector('.settings-tabs');tabs.setAttribute('role','tablist');tabs.querySelectorAll('.settings-tab-item').forEach(t=>{t.setAttribute('role','tab');t.tabIndex=0;t.setAttribute('aria-selected',String(t.classList.contains('active')));t.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();t.click();}});t.addEventListener('click',()=>{tabs.querySelectorAll('[role=tab]').forEach(x=>x.setAttribute('aria-selected',String(x===t)));});});
 buildBasic();buildFunctions();buildStyle();buildExclusive();setupCollapses();
 const fixed=el('div','ksv-fixed-top'),scroll=el('div','ksv-settings-scroll');fixed.append(hero,tabs);scroll.append($('chat-settings-form'));shell.append(fixed,scroll);tabs.addEventListener('click',()=>{scroll.scrollTop=0;});
 const save=container.querySelector('#chat-settings-form > button[type=submit]');save.classList.add('ksv-save');save.innerHTML='<span>✓</span> 保存所有更改';save.after(el('div','ksv-credit','by 灿灿'));save.setAttribute('aria-label','保存所有更改');
 container.addEventListener('change',e=>{syncInline();updateClocks();syncPortraits();if(e.target.closest('#setting-tab-style'))refreshPreview();});container.addEventListener('input',e=>{if(e.target.matches('#setting-char-realname,#setting-char-remark,#setting-my-name,#setting-my-remark-name'))syncPortraits();if(e.target.matches('#setting-avatar-radius'))refreshPreview();});
 const avatarObserver=new MutationObserver(syncPortraits);['setting-char-avatar-preview','setting-my-avatar-preview'].forEach(id=>avatarObserver.observe($(id),{attributes:true,attributeFilter:['src']}));
 $('setting-chat-bg-upload').addEventListener('change',()=>setTimeout(syncBackground,250));$('reset-chat-bg-btn').addEventListener('click',()=>setTimeout(syncBackground,0));
 setupCities();syncInline();clearInterval(clockTimer);clockTimer=setInterval(()=>{if(container.classList.contains('active'))updateClocks();},30000);
}
function buildBasic(){const basic=$('setting-tab-basic'),zone=basic.querySelector('.kc-card'),oldGroups=[...basic.querySelectorAll(':scope > .kkt-group')];
 const time=group('ㅇㅅㅇ / personal settings','ksv-clock-section');time.innerHTML=`<h2><span id="ksv-clock-label">ㅇㅅㅇ</span> / personal settings</h2><div class="ksv-clocks"><div class="ksv-clock"><h3>角色時間</h3><div id="ksv-zone-char"></div><strong id="ksv-time-char">--:--</strong><span id="ksv-date-char"></span><small id="ksv-offset-char"></small></div><span class="ksv-hearts" aria-hidden="true"><svg viewBox="0 0 52 42" fill="none"><path d="M22 34 7 20C-3 10 10-1 18 8L22 12 26 8C35-1 47 10 37 20Z"/><path d="m31 33-9-8m9 8 15-14C56 9 43-2 35 7l-4 4-3-3"/></svg></span><div class="ksv-clock"><h3>我的時間</h3><div id="ksv-zone-user"></div><strong id="ksv-time-user">--:--</strong><span id="ksv-date-user"></span><small id="ksv-offset-user"></small></div><div class="ksv-connection"><span id="ksv-time-diff">0h</span></div></div>`;
 basic.prepend(time);
 if(zone){['setting-role-timezone','setting-user-timezone'].forEach((id,i)=>{const input=$(id);if(input){input.setAttribute('aria-label',i?'我的所在地 / 时区':'角色所在地 / 时区');const host=$(i?'ksv-zone-user':'ksv-zone-char');host.classList.add('ksv-zone-picker');host.append(el('span','ksv-zone-visible'),input);input.addEventListener('blur',updateClocks);}});const datalist=zone.querySelector('datalist');if(datalist)time.append(datalist); // preview IDs are used by the existing clock loader.
 ['setting-role-clock-preview','setting-user-clock-preview'].forEach(id=>{const n=$(id);if(n){n.hidden=true;time.append(n);}});zone.remove();}
 basic.prepend(time);
 const shared=group('Profile','ksv-profile');shared.querySelector('h2').innerHTML='<span>ふたり</span>Profile<span aria-hidden="true">✎</span>';
 const identities=el('div','ksv-identities');
 for(const [who,name,handle] of [['char','角色','@character'],['my','自訂','@you']]){
  const entry=el('div','ksv-identity'),img=$(who==='char'?'setting-char-avatar-preview':'setting-my-avatar-preview');img.className='ksv-id-avatar';img.alt=who==='char'?'更换角色头像':'更换我的头像';img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label',img.alt);img.onclick=()=>$(who==='char'?'setting-char-avatar-upload':'setting-my-avatar-upload').click();img.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();img.click();}};
  entry.append(img);const info=el('div','ksv-id-copy',`<b id="ksv-${who}-name">${name}</b><small>${handle}</small>`);entry.append(info,button('Edit',()=>toggleProfile(who),'ksv-edit'));identities.append(entry);
 }
 shared.append(identities);const actions=el('div','ksv-profile-actions');actions.append(button('角色人設　✎',()=>toggleProfile('char')),button('我的設定　✎',()=>toggleProfile('my')));shared.append(actions);
 oldGroups.forEach((g,i)=>{g.classList.add('ksv-profile-fields');g.id='ksv-fields-'+(i===0?'char':i===1?'books':'my');g.hidden=true;shared.append(g);});
 // Moving the avatar must not lose its original hidden file chooser.
 ['setting-char-avatar-upload','setting-my-avatar-upload'].forEach(id=>{const n=$(id);if(n)shared.append(n);});
 const books=button('關聯世界書',()=>{const g=$('ksv-fields-books');if(g)g.hidden=!g.hidden;},'ksv-books-link');shared.append(books);
 const board=el('div','ksv-basic-board');board.append(time,shared);basic.append(board);
}
function toggleProfile(who){const n=$('ksv-fields-'+who);if(n)n.hidden=!n.hidden;}
function buildFunctions(){const pane=$('setting-tab-func'),original=pane.querySelector('.kkt-group');original.classList.add('ksv-section');original.prepend(el('h2','','Conversation / 對話設定'));
 ['setting-bilingual-style-container','setting-reply-count-container'].forEach(id=>$(id)?.classList.add('ksv-inline'));
 const descriptions={'setting-max-memory':'記住最近的對話輪數，超出後將自動遺忘。','setting-bilingual-mode':'同時以兩種語言進行聊天。','setting-reply-count-enabled':'讓角色在單次回復時發送多條消息。'};Object.entries(descriptions).forEach(([id,text])=>{const label=row(id).querySelector('.kkt-item-label');label.append(el('small','',text));});
 const icons={'setting-max-memory':'<path d="M21 11a8 8 0 0 1-8 8H9l-6 3 2-6a8 8 0 1 1 16-5Z"/>','setting-bilingual-mode':'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18ZM5 7h14M5 17h14"/>','setting-reply-count-enabled':'<path d="M5 2h12l3 3v17H5ZM8 7h8M8 11h8M8 15h6"/>'};Object.entries(icons).forEach(([id,paths])=>{const icon=el('span','ksv-conversation-icon',`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`);row(id).prepend(icon);});
 $('quick-save-status-preset-btn').textContent='保存';
 const featureGrid=pane.querySelector('.feature-grid'),center=pane.querySelector('.feature-control-center');center.classList.add('ksv-section','ksv-feature-list');center.prepend(el('h2','','Interaction / 互動功能'));
 const normalizeCards=()=>featureGrid.querySelectorAll('.feature-card:not(.ksv-feature-row)').forEach(card=>{const head=card.querySelector('.feature-card-header'),body=card.querySelector('.feature-card-body');if(!head||!body)return;card.classList.add('ksv-feature-row');const icon=head.querySelector('.feature-card-icon'),toggle=head.querySelector('.kkt-switch');if(icon&&toggle)card.replaceChildren(icon,body,toggle);});normalizeCards();new MutationObserver(normalizeCards).observe(featureGrid,{childList:true});
 // Move the same DOM panels directly after their owning row, preserving every input/listener ID.
 for(const [key,id] of [['status','status-panel-settings-container'],['auto-reply','auto-reply-settings-container']]){const card=featureGrid.querySelector(`[data-feature="${key}"]`),details=$(id);details.classList.add('ksv-inline','ksv-feature-details');card.after(details);}
 const added=group('Memory / 自動總結','ksv-added');added.innerHTML+=`<div class="kkt-item"><div><b>自動總結</b><small>達到設定條數，自動存入回憶日記</small></div>${switchHtml('ksv-auto-journal')}</div><div class="ksv-inline" id="ksv-auto-journal-fields"><label>每累計幾條消息<input type="number" id="ksv-summary-every" min="10" max="2000" value="100"></label><label>總結方式<select id="ksv-summary-mode"><option value="summary">客觀摘要</option><option value="diary">角色日記</option><option value="custom">自訂要求</option></select></label><label id="ksv-summary-custom-label">自訂總結要求<textarea id="ksv-summary-custom" rows="3"></textarea></label><p class="ksv-note">統計啟用後新增的雙方消息；使用日記 API 路由，失敗不推進進度，不刪除原消息。</p><p id="ksv-summary-progress" class="ksv-note" role="status"></p><button type="button" id="ksv-summary-now">立即總結待處理消息</button></div>`;
 const friends=group('Together / 好友互動','ksv-added');friends.innerHTML+=`<div class="kkt-item"><b>拍一拍</b>${switchHtml('ksv-pat-enabled')}</div><div class="ksv-inline" id="ksv-pat-fields"><label>我的拍一拍後綴<input id="ksv-pat-user" maxlength="30" placeholder="肩膀"></label><label>角色拍一拍後綴<span id="ksv-pat-ai"></span></label><button type="button" id="ksv-pat-choose">讓角色自己選擇</button><p class="ksv-note">雙擊聊天頭像拍一拍；角色也可主動拍你。</p></div><input id="ksv-user-blocked" type="checkbox" hidden><div class="ksv-inline"><p id="ksv-friend-status" class="ksv-note"></p><label>允許角色拉黑我<input id="ksv-allow-ai-block" type="checkbox" class="ksv-native-switch"></label><div class="ksv-actions"><button type="button" id="ksv-request-friend">發送朋友驗證</button><button type="button" id="ksv-open-requests">新的朋友</button><button type="button" id="ksv-check-incoming">檢查對方申請</button></div><p class="ksv-note">驗證入口：404 好友頁 → 新的朋友。拉黑不刪除聊天記錄。</p></div>`;
 const danger=$('clear-chat-history-btn');pane.insertBefore(added,danger);pane.insertBefore(friends,danger);const blockAction=button('拉黑角色',null,'kkt-danger-btn');blockAction.id='ksv-block-friend';danger.before(blockAction);
 $('ksv-summary-now').onclick=async function(){const c=getChar();if(!c)return;this.disabled=true;try{if(!validate())return;read(c);await KissSocial.persist(c);await KissSocial.summarize(c,true);}catch(e){showToast(e.message);}finally{this.disabled=false;loadSocial(c,true);}};
 $('ksv-pat-choose').onclick=async function(){const c=getChar();if(!c)return;this.disabled=true;try{await KissSocial.choosePat(c);}catch(e){showToast(e.message);}finally{this.disabled=false;}};
 $('ksv-block-friend').onclick=async function(){const c=getChar();if(!c)return;const value=!KissSocial.state(c).userBlocked;if(value&&!confirm('拉黑后不再接收对方的消息，聊天记录保留。确定拉黑？'))return;this.disabled=true;try{await KissSocial.blockUser(c,value);}catch(e){showToast(e.message);}finally{this.disabled=false;loadSocial(c,true);}};
 $('ksv-check-incoming').onclick=async function(){const c=getChar();if(!c)return;this.disabled=true;try{await KissSocial.considerAiRequest(c,true);KissSocial.openRequests(c.id);}catch(e){showToast(e.message);}finally{this.disabled=false;}};
 $('ksv-request-friend').onclick=()=>KissSocial.requestUser(getChar());$('ksv-open-requests').onclick=()=>KissSocial.openRequests(getChar()?.id);
}
function buildStyle(){const pane=$('setting-tab-style'),groups=[...pane.querySelectorAll(':scope > .kkt-group')],appearance=groups[0],bubble=groups[1];appearance.classList.add('ksv-section');appearance.prepend(el('h2','','Appearance / 視覺外觀'));
 const time=group('Time & status / 時間與狀態');moveRows(['setting-show-timestamp','setting-timestamp-style','setting-show-status','setting-show-status-update-msg','setting-bubble-blur'],time);appearance.after(time);
 const bg=row('reset-chat-bg-btn');if(bg){const thumb=el('span','ksv-bg-thumb');thumb.id='ksv-bg-thumb';thumb.setAttribute('aria-hidden','true');bg.querySelector('.kkt-item-control').prepend(thumb);}
 const radius=row('setting-avatar-radius');radius.classList.add('ksv-radius-row');const range=el('div','ksv-radius-track','<small>0%</small><small>50%</small>');$('setting-avatar-radius').before(range);range.insertBefore($('setting-avatar-radius'),range.lastChild);
 const themeRow=row('setting-theme-color'),swatches=el('div','ksv-swatches');['white_silver','white_pink','white_black','black_white'].forEach((key,i)=>{const b=button(colorThemes[key]?.name||key,()=>{$('setting-theme-color').value=key;$('setting-theme-color').dispatchEvent(new Event('change',{bubbles:true}));},'ksv-swatch');b.style.setProperty('--swatch',['#fff','#dedee1','#696970','#222'][i]);b.title=b.textContent;b.setAttribute('aria-label',b.textContent);b.textContent='';swatches.append(b);});themeRow.querySelector('.kkt-item-control').prepend(swatches);
 bubble.classList.add('ksv-section','ksv-css');const label=bubble.querySelector('.kkt-item-label');label.textContent='Bubble CSS / 自訂氣泡樣式';
 const tools=$('private-css-toolbar'),textarea=$('setting-custom-bubble-css');tools.querySelectorAll('button').forEach(b=>{b.textContent=({'toolbar-toggle-btn':'搜尋與替換','toolbar-prev-btn':'上一個','toolbar-next-btn':'下一個','toolbar-expand-replace-btn':'展開替換','toolbar-replace-btn':'替換當前','toolbar-replace-all-btn':'全部替換'})[b.className]||b.title;});
 const editor=el('div','ksv-code-editor'),top=el('div','ksv-code-top','<span>CSS</span>');
 editor.id='private-css-toolbar';tools.id='';top.append(tools.querySelector('.toolbar-toggle-btn'));
 const searchBox=tools.querySelector('.toolbar-main-box'),replaceRow=tools.querySelector('.toolbar-replace-row'),expand=tools.querySelector('.toolbar-expand-replace-btn');searchBox.style.display='flex';replaceRow.style.display='flex';searchBox.append(expand);expand.textContent='收起替換';expand.addEventListener('click',()=>queueMicrotask(()=>expand.textContent=replaceRow.style.display==='none'?'展開替換':'收起替換'));tools.querySelector('.toolbar-search-input').placeholder='搜尋代碼…';tools.querySelector('.toolbar-search-input').setAttribute('aria-label','搜尋代碼');tools.querySelector('.toolbar-replace-input').placeholder='替換為…';tools.querySelector('.toolbar-replace-input').setAttribute('aria-label','替換為');
 const body=el('div','ksv-code-body'),numbers=el('pre','ksv-line-numbers');numbers.setAttribute('aria-hidden','true');
 textarea.before(editor);body.append(numbers,textarea);editor.append(top,body,tools);
 const numberLines=()=>{numbers.textContent=Array.from({length:Math.max(6,textarea.value.split('\n').length)},(_,i)=>String(i+1).padStart(2,'0')).join('\n');numbers.scrollTop=textarea.scrollTop;};
 textarea.addEventListener('input',numberLines);textarea.addEventListener('scroll',()=>numbers.scrollTop=textarea.scrollTop);numberLines();editor.updateLines=numberLines;

 const presets=group('Presets / 氣泡預設','ksv-presets');const presetTools=$('bubble-preset-select').parentElement;presetTools.classList.add('ksv-preset-tools');presets.append(presetTools);bubble.after(presets);
 const names={'save-preset-btn':'保存預設','manage-presets-btn':'管理預設','reset-custom-bubble-css-btn':'重置代碼'};Object.entries(names).forEach(([id,t])=>$(id).textContent=t);
}
function buildExclusive(){const pane=$('setting-tab-exclusive'),model=pane.querySelector('.kkt-group');model.classList.add('ksv-section','ksv-exclusive');model.prepend(el('div','ksv-eyebrow','MODEL'));
 for(const [id,title] of [['setting-exclusive-prompt-version','PROMPT'],['setting-exclusive-cot-preset','REASONING'],['setting-exclusive-workshop-preset','IMAGE']]){const section=el('section','ksv-section ksv-exclusive',`<div class="ksv-eyebrow">${title}</div>`);section.append(row(id));pane.append(section);}
 const controls=el('div','ksv-model-controls',`<label>指定模型<input id="ksv-exclusive-model" type="text" autocomplete="off" placeholder="跟隨 API 預設，可手動填寫模型 ID"></label><div class="ksv-model-search"><input id="ksv-model-search" type="search" placeholder="搜尋模型名稱…" aria-label="搜尋模型"><button type="button" id="ksv-fetch-models">拉取模型</button></div><p id="ksv-model-count" class="ksv-note" role="status"></p><div id="ksv-model-results" class="ksv-model-results"></div>`);model.append(controls);
 $('ksv-model-search').oninput=renderModels;$('ksv-exclusive-model').oninput=renderModels;$('ksv-fetch-models').onclick=fetchExclusiveModels;$('setting-exclusive-api-preset-select').addEventListener('change',()=>{modelRequest++;modelRows=[];$('ksv-fetch-models').disabled=false;renderModels();});
 [...pane.querySelectorAll(':scope > .kkt-group')].forEach(g=>{if(!g.querySelector('.kkt-item'))g.remove();});
}
function switchHtml(id){return `<label class="kkt-switch"><input id="${id}" type="checkbox"><span class="kkt-slider"></span></label>`;}
const getChar=()=>db.characters.find(c=>c.id===currentChatId);
function syncInline(){if(!root)return;for(const [toggle,panel] of [['setting-bilingual-mode','setting-bilingual-style-container'],['setting-reply-count-enabled','setting-reply-count-container'],['ksv-auto-journal','ksv-auto-journal-fields'],['ksv-pat-enabled','ksv-pat-fields']])if($(panel))$(panel).hidden=!$(toggle).checked;
 if(root.querySelector('.ksv-model-controls'))root.querySelector('.ksv-model-controls').hidden=!$('setting-exclusive-api-enabled').checked;
 if($('ksv-summary-custom-label'))$('ksv-summary-custom-label').hidden=$('ksv-summary-mode').value!=='custom';
}
function headerIdentity(character={},draft={}){
 const first=(...values)=>values.map(x=>String(x??'').trim()).find(Boolean)||'';
 return {character:first(draft.remarkName??character.remarkName,draft.realName??character.realName,'角色'),user:first(draft.myRemarkName??character.myRemarkName,draft.myName??character.myName,'我')};
}
function syncPortraits(){
 if(!root)return;
 const c=getChar()||{},char=$('setting-char-avatar-preview'),my=$('setting-my-avatar-preview'),names=headerIdentity(c,{remarkName:$('setting-char-remark')?.value,realName:$('setting-char-realname')?.value,myRemarkName:$('setting-my-remark-name')?.value,myName:$('setting-my-name')?.value});
 const charImage=$('ksv-header-character'),userImage=$('ksv-header-user');charImage.src=char?.getAttribute('src')||c.avatar||'';userImage.src=my?.getAttribute('src')||c.myAvatar||'';
 charImage.alt='角色头像：'+names.character;userImage.alt='用户头像：'+names.user;
 $('ksv-char-name').textContent=names.character;$('ksv-my-name').textContent=names.user;$('ksv-clock-label').textContent=names.character;
 for(const [id,text] of [['ksv-plate-name',names.character],['ksv-plate-user-name',names.user]]){const node=$(id);node.textContent=text;node.title=text;}
 root.querySelector('.ksv-nameplate').setAttribute('aria-label',names.character+' × '+names.user);
}
function updateClocks(){
 if(!root||!window.KissClock)return;
 const now=new Date(),device=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',userText=$('setting-user-timezone').value.trim(),roleText=$('setting-role-timezone').value.trim(),userValue=resolvedCity($('setting-user-timezone'))?.timeZone??null,roleValue=resolvedCity($('setting-role-timezone'))?.timeZone??null;if(userValue===null||roleValue===null)return;
 const c={timeZone:roleValue||userValue||device},u={timeZone:userValue||device};
 const names={'Asia/Tokyo':'東京','Asia/Shanghai':'上海','Asia/Taipei':'台北','Asia/Hong_Kong':'香港','Europe/London':'倫敦','Europe/Paris':'巴黎','America/New_York':'紐約'};
 for(const [key,obj,value] of [['char',c,roleValue],['user',u,userValue]]){
  const input=$(key==='char'?'setting-role-timezone':'setting-user-timezone');input.setAttribute('aria-invalid','false');
  if(!KissClock.valid(obj.timeZone))continue;
  const z=obj.timeZone,date=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:z,month:'2-digit',day:'2-digit',weekday:'short'}).formatToParts(now).map(p=>[p.type,p.value])),offset=KissClock.offset(obj,now)/60;
  input.parentElement.querySelector('.ksv-zone-visible').textContent='⌖ '+(value?(resolvedCity(input)?.label||names[value]||value.split('/').pop().replaceAll('_',' ')):(key==='char'?'跟隨我的時區':'跟隨設備'));
  $('ksv-time-'+key).textContent=new Intl.DateTimeFormat('en-GB',{timeZone:z,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
  $('ksv-date-'+key).textContent=date.month+'.'+date.day+'  '+date.weekday.toUpperCase();$('ksv-offset-'+key).textContent='UTC'+(offset>=0?'+':'')+offset;
 }
 if(KissClock.valid(c.timeZone)&&KissClock.valid(u.timeZone)){const delta=(KissClock.offset(c,now)-KissClock.offset(u,now))/60;$('ksv-time-diff').textContent=(delta>0?'+':'')+Number(delta.toFixed(2))+'h';}
}
function syncBackground(){const thumb=$('ksv-bg-thumb'),c=getChar();if(thumb){thumb.style.backgroundImage=c?.chatBg?'url('+JSON.stringify(c.chatBg)+')':'';thumb.classList.toggle('has-background',!!c?.chatBg);}}
function load(c){modelRequest++;modelRows=[];$('ksv-fetch-models').disabled=false;$('setting-exclusive-api-preset-select').options[0].textContent='跟隨桌面 API';$('ksv-exclusive-model').value=c.exclusiveApiModel||'';$('ksv-model-search').value='';renderModels();loadCities(c);syncPortraits();syncBackground();updateClocks();loadSocial(c);root.querySelector('.ksv-code-editor')?.updateLines?.();if(c.autoJournal?.enabled)KissSocial.tick(c);}
function loadSocial(c,statusOnly=false){if(!root||c.id!==currentChatId)return;const cfg=c.autoJournal||{},pat=c.patSettings||{},f=KissSocial.state(c);
 if(!statusOnly){$('ksv-auto-journal').checked=!!cfg.enabled;$('ksv-summary-every').value=cfg.every||100;$('ksv-summary-mode').value=cfg.mode||'summary';$('ksv-summary-custom').value=cfg.customPrompt||'';
 }
 $('ksv-summary-progress').textContent=cfg.lastError?'上次未完成：'+cfg.lastError:`待總結 ${KissSocial.pending(c).length} 條 · 已生成 ${(c.memoryJournals||[]).filter(j=>j.autoGenerated).length} 篇`;
 if(!statusOnly){$('ksv-pat-enabled').checked=pat.enabled!==false;$('ksv-pat-user').value=pat.userSuffix||'';}$('ksv-pat-ai').textContent=pat.aiSuffix||'由角色選擇';$('ksv-user-blocked').checked=!!f.userBlocked;$('ksv-block-friend').textContent=f.userBlocked?'解除拉黑':'拉黑角色';if(!statusOnly)$('ksv-allow-ai-block').checked=f.allowAiBlock!==false;$('ksv-friend-status').textContent=f.aiBlocked?'對方已將你加入黑名單':f.userBlocked?'你已將對方加入黑名單':'好友關係正常';$('ksv-request-friend').hidden=!f.aiBlocked;$('ksv-check-incoming').hidden=!f.userBlocked;syncInline();
}
function validate(){const n=Number($('ksv-summary-every')?.value);if($('ksv-auto-journal')?.checked&&(!Number.isInteger(n)||n<10||n>2000)){showToast('自动总结条数须为 10—2000 的整数');return false;}if($('ksv-auto-journal')?.checked&&$('ksv-summary-mode').value==='custom'&&!$('ksv-summary-custom').value.trim()){showToast('请填写自定义总结要求');return false;}return true;}
function read(c){c.exclusiveApiModel=$('ksv-exclusive-model').value.trim();const old=c.autoJournal||{},enabled=$('ksv-auto-journal').checked,rows=KissSocial.online(c);c.autoJournal={...old,enabled,every:Number($('ksv-summary-every').value)||100,mode:$('ksv-summary-mode').value,customPrompt:$('ksv-summary-custom').value.trim()};if(enabled&&!old.enabled){const last=rows.at(-1);c.autoJournal.anchor=last?{id:last.id,timestamp:last.timestamp}:null;}
 c.patSettings={...c.patSettings,enabled:$('ksv-pat-enabled').checked,userSuffix:$('ksv-pat-user').value.trim().slice(0,30)};KissSocial.state(c).allowAiBlock=$('ksv-allow-ai-block').checked;
}
function refreshPreview(){const preview=$('private-bubble-css-preview');if(preview)updateBubbleCssPreview(preview,$('setting-custom-bubble-css').value,!$('setting-use-custom-css').checked,colorThemes[$('setting-theme-color').value]||colorThemes.white_silver);}
function setupBanner(img){
 const base=scriptLocation?new URL('../../',scriptLocation):new URL('./',document.baseURI);
 img.onerror=()=>{if(img.dataset.backupTried)return;img.dataset.backupTried='1';const use=()=>{if(window.KissSettingsBannerHD){img.onerror=null;img.src=window.KissSettingsBannerHD;}};if(window.KissSettingsBannerHD)return use();let loader=document.getElementById('ksv-banner-backup');if(!loader){loader=document.createElement('script');loader.id='ksv-banner-backup';loader.src=new URL('js/modules/chat-settings-banner-fallback.js?v=20261101-v6',base).href;document.head.append(loader);}loader.addEventListener('load',use,{once:true});};
 img.src=new URL('assets/header-banner-hd.png?v=20261101-v6',base).href;
}
function setupCollapses(){
 let saved={};try{saved=JSON.parse(localStorage.getItem('kiss.settings.collapsed.v6')||'{}');}catch{}
 let index=0;for(const section of root.querySelectorAll('.ksv-section')){
  if(section.classList.contains('ksv-profile-fields'))continue;
  let head=section.querySelector(':scope > h2');
  if(!head){head=el('h2','ksv-generated-heading');const eyebrow=section.querySelector(':scope > .ksv-eyebrow');if(eyebrow){head.append(eyebrow);}else if(section.classList.contains('ksv-css')){head.append(section.querySelector(':scope > .kkt-item'));}else continue;section.prepend(head);}
  const body=el('div','ksv-section-body'),id='ksv-section-body-'+(++index),key=(section.closest('.settings-tab-content')?.id||'')+':'+index;body.id=id;
  for(const node of [...section.childNodes])if(node!==head)body.append(node);
  section.append(body);const toggle=button('',null,'ksv-collapse');toggle.setAttribute('aria-controls',id);head.append(toggle);head.classList.add('ksv-section-heading');
  const set=collapsed=>{body.hidden=collapsed;section.classList.toggle('ksv-collapsed',collapsed);toggle.textContent=collapsed?'展開':'收起';toggle.setAttribute('aria-expanded',String(!collapsed));toggle.setAttribute('aria-label',(collapsed?'展开':'收起')+' '+head.textContent.replace(/展開|收起/g,'').trim());};
  set(!!saved[key]);toggle.onclick=()=>{set(!body.hidden);saved[key]=body.hidden;try{localStorage.setItem('kiss.settings.collapsed.v6',JSON.stringify(saved));}catch{}};
 }
 root.addEventListener('invalid',e=>openContainingSection(e.target),true);
}
function openContainingSection(input){for(let body=input.closest('.ksv-section-body');body;body=body.parentElement.closest('.ksv-section-body'))if(body.hidden)body.parentElement.querySelector(':scope > h2 .ksv-collapse')?.click();}
function draftApi(){const c=getChar()||{};return KissExclusiveModels.config({...c,exclusiveApiEnabled:true,exclusiveApiPreset:$('setting-exclusive-api-preset-select').value,exclusiveApiModel:''});}
function renderModels(){
 const list=$('ksv-model-results');if(!list)return;list.replaceChildren();const rows=KissExclusiveModels.search(modelRows,$('ksv-model-search').value),selected=$('ksv-exclusive-model').value.trim();
 $('ksv-model-count').textContent=modelRows.length?`找到 ${rows.length} / ${modelRows.length} 個模型`:'可拉取模型列表，也可直接填寫模型 ID。留空時跟隨 API 預設。';
 rows.slice(0,100).forEach(name=>{const b=button(name,()=>{$('ksv-exclusive-model').value=name;renderModels();},'ksv-model-option');b.setAttribute('aria-pressed',String(name===selected));list.append(b);});if(rows.length>100)list.append(el('p','ksv-note','請輸入更多字縮小搜尋範圍'));
}
async function fetchExclusiveModels(){
 const c=getChar();if(!c)return;const id=c.id,request=++modelRequest,config=draftApi(),b=$('ksv-fetch-models');b.disabled=true;$('ksv-model-count').textContent='正在拉取模型…';
 try{const rows=await KissExclusiveModels.fetchModels(config);if(request!==modelRequest||id!==currentChatId)return;modelRows=rows;renderModels();if(!rows.length)$('ksv-model-count').textContent='未返回模型，可手動填寫';}
 catch(e){if(request===modelRequest)$('ksv-model-count').textContent=e.message;}
 finally{if(request===modelRequest)b.disabled=false;}
}
const cityStates=new WeakMap();
function resolvedCity(input){if(!input)return null;const value=input.value.trim();if(!value)return {timeZone:'',label:''};if(input.dataset.cityQuery===value&&input.dataset.timeZone)return {timeZone:input.dataset.timeZone,label:input.dataset.cityLabel||value};return window.KissCityTimezones?.lookup(value)||null;}
function applyCity(input,city,replace=false){const value=input.value.trim();input.dataset.timeZone=city.timeZone;input.dataset.cityLabel=city.label;input.dataset.cityQuery=value;KissCityTimezones.remember(value,city);input.setAttribute('aria-invalid','false');if(replace){input.value=city.label;input.dataset.cityQuery=input.value;}updateClocks();}
function showCityChoices(input,rows,message=''){
 const list=input.parentElement.querySelector('.ksv-city-results');list.replaceChildren();if(message)list.append(el('p','ksv-note',message));
 rows.forEach(city=>{const b=button(city.label+(city.detail?' · '+city.detail:''),()=>{applyCity(input,city,true);list.hidden=true;input.dispatchEvent(new Event('change',{bubbles:true}));},'ksv-city-option');b.onpointerdown=e=>e.preventDefault();const sub=el('small','');sub.textContent=city.timeZone;b.append(sub);list.append(b);});
 if(rows.length){const credit=el('small','ksv-city-credit');credit.textContent=rows.some(r=>r.detail)?'Open-Meteo · GeoNames':'城市時區';list.append(credit);}list.hidden=!rows.length&&!message;
}
async function findCity(input,commit=false){
 const state=cityStates.get(input),query=input.value.trim();if(!state)return;
 const quick=resolvedCity(input);if(quick){applyCity(input,quick,commit);showCityChoices(input,[]);return quick;}
 const seq=++state.seq;state.controller?.abort();state.controller=new AbortController();
 showCityChoices(input,[],'正在匹配城市…');
 try{const rows=await KissCityTimezones.search(query,{signal:state.controller.signal});if(seq!==state.seq||input.value.trim()!==query)return null;
  if(rows.length===1||rows[0]?.rank===0){applyCity(input,rows[0],commit);showCityChoices(input,[]);return rows[0];}
  showCityChoices(input,rows,rows.length?'同名城市，請選擇所在地':'沒有匹配的城市，請換個名稱');input.setAttribute('aria-invalid','true');return null;
 }catch(e){if(e.name==='AbortError')return null;if(seq===state.seq)showCityChoices(input,[],e.message);return null;}
}
function setupCities(){for(const id of ['setting-role-timezone','setting-user-timezone']){
 const input=$(id),state={seq:0,timer:null,controller:null};cityStates.set(input,state);input.removeAttribute('list');input.placeholder=id.includes('role')?'城市 / 跟隨我的時區':'城市 / 跟隨設備';
 const list=el('div','ksv-city-results');list.hidden=true;list.setAttribute('role','group');list.setAttribute('aria-label','城市匹配結果');input.parentElement.append(list);
 input.addEventListener('input',()=>{clearTimeout(state.timer);state.seq++;state.controller?.abort();delete input.dataset.timeZone;delete input.dataset.cityQuery;const match=resolvedCity(input);if(match){applyCity(input,match);showCityChoices(input,[]);}else state.timer=setTimeout(()=>findCity(input),420);});
 input.addEventListener('change',()=>findCity(input,true));input.addEventListener('keydown',e=>{if(e.key==='Escape')list.hidden=true;});
 input.addEventListener('blur',()=>setTimeout(()=>{list.hidden=true;},180));
 }}
function loadCities(c){const user=KissClock.user();for(const [id,zone,label] of [['setting-role-timezone',c.timeZone||'',c.timeZoneCity||''],['setting-user-timezone',user.timeZone||'',user.city||'']]){const input=$(id),state=cityStates.get(input);if(state){state.seq++;clearTimeout(state.timer);state.controller?.abort();}const city=label?{timeZone:zone,label}:KissCityTimezones.lookup(zone)||{timeZone:zone,label:zone};input.value=city.label;input.dataset.cityQuery=input.value;input.dataset.timeZone=zone;input.dataset.cityLabel=city.label;input.setAttribute('aria-invalid','false');showCityChoices(input,[]);}}
async function resolveZones(){for(const id of ['setting-role-timezone','setting-user-timezone']){const input=$(id);if(!resolvedCity(input)){openContainingSection(input);const match=await findCity(input,true);if(!match){showToast('請選擇匹配的城市後再保存');input.focus();return false;}}}return true;}

const originalPreview=window.updateBubbleCssPreview;
window.updateBubbleCssPreview=function(box,css,useDefault,theme){
 originalPreview(box,css,useDefault,theme);
 if(box.id!=='private-bubble-css-preview'||!root)return;
 const c=getChar(),received=box.querySelector('.received'),sent=box.querySelector('.sent');if(!c||!received||!sent)return;
 for(const [bubble,who] of [[received,'char'],[sent,'my']]){
  const r=el('div','ksv-preview-row '+who),img=document.createElement('img'),text=el('div','ksv-preview-copy');
  img.src=$(who==='char'?'setting-char-avatar-preview':'setting-my-avatar-preview').src;img.alt=who==='char'?'角色':'我';img.style.borderRadius=($('setting-avatar-radius')?.value||0)+'%';
  if($('setting-avatar-mode')?.value==='hidden')img.hidden=true;
  if(who==='char'){const name=el('small','ksv-preview-name');name.textContent=($('setting-char-remark').value||$('setting-char-realname').value||c.realName)+($('setting-show-status')?.checked?' · 在線':'');text.append(name);}
  bubble.textContent=who==='char'?'今天也想和你說說話。':'我在聽。';text.append(bubble);
  if($('setting-show-timestamp')?.checked){const time=el('small','ksv-preview-time');time.textContent='01:05';text.append(time);}
  r.append(img,text);box.append(r);
 }
 root.querySelector('.ksv-code-editor')?.updateLines?.();
};
window.KissSettingsV2={mount,load,loadSocial,read,validate,updateClocks,syncBackground,headerIdentity,resolveZones,resolvedCity};
})();
