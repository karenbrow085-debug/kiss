/* Shared bilingual generation and display policy. Does not translate UI labels or call APIs. */
(() => {
'use strict';
const KEY='kissBilingualSettings',MARK='<全局双语输出>';
function register(){if(typeof globalSettingKeys!=='undefined'&&!globalSettingKeys.includes(KEY))globalSettingKeys.push(KEY);}register();
const settings=()=>typeof db!=='undefined'&&db[KEY]||{};
const enabled=c=>!!(settings().global||c?.bilingualModeEnabled);
const auto=()=>!!settings().autoExpand;
const rule=MARK+'\n整个小手机的面向用户的角色内容均遵守：保留角色原本语言；外语或粤语的每段对白、动态、评论、信件、叙事及应用内容，在同一次响应附自然的普通话译文。优先遵守当前功能已有的翻译协议：HearU 的 translation、MONO 帖子/评论的 translation、MORROW 的 translation.paragraphs 均独立填写，不将译文混入原文字段。无翻译字段的404消息、语音、线下及卡片说明逐段使用 原文「中文译文」，该标记只用于储存，界面另行展示。绝不使用原文(翻译)或原文（翻译）。代码块、HTML代码、工具参数内不插入译文。中文原文不需要重复翻译。保持调用要求的 JSON 结构、字段类型、标签、角色名、代码、ID 和工具参数不变，不翻译推理或系统指令，不额外增加字段。不为了省略翻译而把外语角色改说中文。\n</全局双语输出>';
function prepareMessages(messages){if(!settings().global||!Array.isArray(messages))return messages;if(messages.some(m=>m.role==='system'&&typeof m.content==='string'&&m.content.includes(MARK)))return messages;return [{role:'system',content:rule},...messages];}
function prepareBody(body){
 if(!settings().global||!body||typeof body!=='object')return body;
 if(Array.isArray(body.contents)){
  const key=body.systemInstruction?'systemInstruction':'system_instruction',instruction=body[key]||{parts:[]};
  if((instruction.parts||[]).some(p=>String(p.text||'').includes(MARK)))return body;
  return {...body,[key]:{...instruction,parts:[...(instruction.parts||[]),{text:rule}]}};
 }
 if(body.system!==undefined&&Array.isArray(body.messages)){
  if(typeof body.system==='string')return body.system.includes(MARK)?body:{...body,system:body.system+'\n'+rule};
  if(Array.isArray(body.system))return body.system.some(p=>String(p.text||'').includes(MARK))?body:{...body,system:[...body.system,{type:'text',text:rule}]};
 }
 if(Array.isArray(body.messages))return {...body,messages:prepareMessages(body.messages)};
 if(Array.isArray(body.input))return {...body,input:prepareMessages(body.input)};
 return body;
}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function foreign(text){return /[A-Za-z\u3040-\u30ff\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff\u0e00-\u0e7f]/.test(text)||/[唔佢哋喺冇嘅咗啲咩畀嚟嗰乜嘢]/.test(text);}
function split(text,translation){text=String(text??'');if(typeof translation==='string'&&translation.trim())return {original:text,translation:translation.trim()};const m=text.match(/^([\s\S]+?)「([^「」]+)」\s*$/);if(m&&foreign(m[1])&&/[\u3400-\u9fff]/.test(m[2])&&!/[\u3040-\u30ff\uac00-\ud7af]/.test(m[2]))return {original:m[1].trimEnd(),translation:m[2].trim()};return {original:text,translation:''};}
function markup(text,translation,selected=false,mode='under'){const p=split(text,translation);if(!p.translation)return escape(p.original);if(mode==='overlay')return `<span class="kb-original">${escape(selected?p.translation:p.original)}</span>`;return `<span class="kb-original">${escape(p.original)}</span><span class="kb-translation" lang="zh-Hans"${auto()||selected?'':' hidden'}>${escape(p.translation)}</span>`;}
// Convert only visible prose slots; never touch editors, code, imported HTML or reasoning.
function enhance(root){if(!root?.querySelectorAll)return;const slots=root.matches?.('.voice-transcript,.pv-card-content,.gift-card-description,.of-prose,.peek-content,.peek-message-text,.status-content,#peek-message-area .message-bubble,#peek-memo-detail-screen main,#peek-browser-screen main,#peek-drafts-screen main,#peek-cart-screen main,#peek-bag-screen main,#journal-detail-content,#char-status-content')?[root]:[];slots.push(...root.querySelectorAll('.voice-transcript,.pv-card-content,.gift-card-description,.of-prose,.peek-content,.peek-message-text,.status-content,#peek-message-area .message-bubble,#peek-memo-detail-screen main,#peek-browser-screen main,#peek-drafts-screen main,#peek-cart-screen main,#peek-bag-screen main,#journal-detail-content,#char-status-content'));
 for(const slot of slots){if(slot.querySelector('.kb-toggle')||slot.closest('pre,code,textarea,[contenteditable=true],.of-reasoning,.thinking-content'))continue;const walk=document.createTreeWalker(slot,NodeFilter.SHOW_TEXT),nodes=[];while(walk.nextNode())if(!walk.currentNode.parentElement.closest('pre,code,script,style,.kb-original,.kb-translation'))nodes.push(walk.currentNode);let changed=false;for(const node of nodes){if(!node.textContent.includes('「'))continue;const lines=node.textContent.split('\n');if(!lines.some(t=>split(t).translation))continue;const fragment=document.createDocumentFragment();lines.forEach((line,i)=>{if(i)fragment.append(document.createTextNode('\n'));const p=split(line);if(!p.translation){fragment.append(document.createTextNode(line));return;}changed=true;const box=document.createElement('span');box.className='kb-pair';box.innerHTML=markup(p.original,p.translation);fragment.append(box);});node.replaceWith(fragment);}if(changed){const button=document.createElement('button');button.type='button';button.className='kb-toggle';button.textContent=auto()?'收起译文':'显示译文';button.setAttribute('aria-expanded',String(auto()));button.onclick=e=>{e.stopPropagation();const open=button.getAttribute('aria-expanded')!=='true';slot.querySelectorAll('.kb-translation').forEach(n=>n.hidden=!open);button.setAttribute('aria-expanded',String(open));button.textContent=open?'收起译文':'显示译文';};slot.append(button);}}
}
function display(original,translation,selected=false){original=String(original||'');translation=String(translation||'');return auto()&&translation?[original,translation].filter(Boolean).join('\n'):selected&&translation?translation:original;}
function refresh(){register();if(typeof document.querySelectorAll==='function')document.querySelectorAll('.kb-toggle').forEach(b=>{const open=auto();b.setAttribute('aria-expanded',String(open));b.textContent=open?'收起译文':'显示译文';b.parentElement.querySelectorAll('.kb-translation').forEach(n=>n.hidden=!open);});document.documentElement.classList.toggle('kiss-auto-translation',auto());}
async function set(patch){const previous=db[KEY];db[KEY]={...settings(),...patch};refresh();try{await saveData();}catch(e){db[KEY]=previous;refresh();throw e;}window.dispatchEvent(new CustomEvent('kiss-bilingual-change'));}
window.KissBilingual={settings,enabled,auto,rule,prepareMessages,prepareBody,display,split,markup,enhance,foreign,refresh,set};
document.addEventListener('DOMContentLoaded',()=>{refresh();const roots=['peek-screen','peek-conversation-screen','peek-browser-screen','peek-drafts-screen','peek-cart-screen','peek-bag-screen','peek-memo-detail-screen','memory-journal-detail-screen','char-status-overlay'];for(const id of roots){const root=document.getElementById(id);if(!root)continue;let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance(root);});}).observe(root,{childList:true,subtree:true});}});window.addEventListener('kiss:startup-complete',refresh);
})();
