/* Shared bilingual generation and display policy. Does not translate UI labels or call APIs. */
(() => {
'use strict';
const KEY='kissBilingualSettings',MARK='<全局双语输出>';
function register(){if(typeof globalSettingKeys!=='undefined'&&!globalSettingKeys.includes(KEY))globalSettingKeys.push(KEY);}register();
const settings=()=>typeof db!=='undefined'&&db[KEY]||{};
const enabled=c=>!!(settings().global||c?.bilingualModeEnabled);
const auto=()=>!!settings().autoExpand;
const rule=MARK+'\n整个小手机的面向用户的角色内容均遵守：保留角色原本语言；外语或粤语的每段对白、动态、评论、信件、叙事及应用内容，在同一次响应附自然的普通话译文。已有 translation 字段时填入译文；没有译文字段时在同一文本字段用 原文「中文译文」。中文原文不需要重复翻译。保持调用要求的 JSON 结构、字段类型、标签、角色名、代码、ID 和工具参数不变，不翻译推理或系统指令，不额外增加字段。不为了省略翻译而把外语角色改说中文。\n</全局双语输出>';
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
function display(original,translation,selected=false){original=String(original||'');translation=String(translation||'');return auto()&&translation?[original,translation].filter(Boolean).join('\n'):selected&&translation?translation:original;}
function refresh(){register();document.documentElement.classList.toggle('kiss-auto-translation',auto());}
async function set(patch){const previous=db[KEY];db[KEY]={...settings(),...patch};refresh();try{await saveData();}catch(e){db[KEY]=previous;refresh();throw e;}window.dispatchEvent(new CustomEvent('kiss-bilingual-change'));}
window.KissBilingual={settings,enabled,auto,rule,prepareMessages,prepareBody,display,refresh,set};
document.addEventListener('DOMContentLoaded',refresh);window.addEventListener('kiss:startup-complete',refresh);
})();
