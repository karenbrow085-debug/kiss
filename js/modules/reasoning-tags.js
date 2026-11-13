/* User-configured returned text blocks. This does not change prompts or API thinking. */
(function(root){
'use strict';
const BUILTIN=['think','thinking'], DEFAULTS=['preplan'];
function normalize(value){
 const name=String(value??'').trim().replace(/^<\/?\s*([\w:-]+)\s*>$/,'$1').toLowerCase();
 if(!/^[a-z][a-z0-9_:-]{0,47}$/.test(name))throw Error('标签以英文字母开头，可用数字、下划线、短横线或冒号，最多 48 个字符。');
 return name;
}
function customTags(){
 const saved=typeof db!=='undefined'?db.cotSettings?.recognitionTags:undefined;
 return Array.isArray(saved)?[...new Set(saved.flatMap(value=>{try{return [normalize(value)];}catch(_){return [];}}))].filter(t=>!BUILTIN.includes(t)).slice(0,16):DEFAULTS.slice();
}
function tags(){return [...BUILTIN,...customTags()];}
function split(raw,options={}){
 const value=String(raw??''),names=tags(),known=new Set(names),pattern=/<(\/?)([a-z][a-z0-9_:-]{0,47})\s*>/gi;
 const blocks=[],reasons=[],body=[];let stack=[],last=0,start=0,inner=0;
 for(const match of value.matchAll(pattern)){
  const name=match[2].toLowerCase();if(!known.has(name))continue;
  if(!match[1]){
   if(!stack.length){body.push(value.slice(last,match.index));start=match.index;inner=match.index+match[0].length;}
   stack.push(name);
  }else if(stack.length&&stack.at(-1)===name){
   stack.pop();if(!stack.length){reasons.push(value.slice(inner,match.index));last=match.index+match[0].length;blocks.push(value.slice(start,last));}
  }
 }
 if(stack.length){reasons.push(value.slice(inner));blocks.push(value.slice(start));}
 else body.push(value.slice(last));
 let text=body.join('');
 // The caller reparses the full accumulated stream; hold back a possible partial tag.
 if(options.streaming&&!stack.length){const partial=/<\/?[a-z0-9_:-]*$/i.exec(text);if(partial){const prefix=partial[0].replace(/^<\/?/,'').toLowerCase();if(names.some(n=>n.startsWith(prefix)))text=text.slice(0,partial.index);}}
 return {text,reasoning:reasons.join('\n\n').trim(),blocks};
}
async function save(values){
 const next=[...new Set(values.map(normalize))].filter(t=>!BUILTIN.includes(t));
 if(next.length>16)throw Error('最多添加 16 个自定义标签。');
 if(typeof db==='undefined'||typeof saveData!=='function')throw Error('设置尚未加载，请稍后再试。');
 if(root.kissCleanupLocked)throw Error('数据正在整理，请稍后保存。');
 const before=db.cotSettings;db.cotSettings={...(before||{}),recognitionTags:next};
 try{await saveData();}catch(error){db.cotSettings=before;throw error;}
 refresh();return next;
}
function el(tag,cls,content){const node=document.createElement(tag);if(cls)node.className=cls;if(content!==undefined)node.textContent=content;return node;}
function refresh(){const count=document.getElementById('kiss-reasoning-tag-count');if(count)count.textContent=tags().length+' 个标签';}
function openEditor(){
 const ui=root.KissPromptUI;if(!ui?.dialog)return;
 let draft=customTags();
 ui.dialog('思维链识别标签',a=>{
  a.el.classList.add('kt-dialog');
  const intro=el('p','kt-intro','把预设使用的标签添加到这里，标签内的内容会与聊天正文分开。');a.body.append(intro);
  const scope=el('div','kt-scope','共用设置 · 聊天 / 通话 / 线下');a.body.append(scope);
  a.body.append(el('h3','kt-label','默认兼容'));
  const built=el('div','kt-chips');BUILTIN.forEach(t=>built.append(el('span','kt-chip kt-builtin','<'+t+'>')));a.body.append(built);
  a.body.append(el('h3','kt-label','自定义标签'));
  const list=el('div','kt-chips');a.body.append(list);
  const row=el('div','kt-add-row'),input=el('input','kt-input');input.placeholder='例如 preplan 或 plan';input.setAttribute('aria-label','新的识别标签');input.autocomplete='off';input.autocapitalize='none';input.spellcheck=false;input.maxLength=54;
  const add=el('button','kt-add','添加');add.type='button';row.append(input,add);a.body.append(row);
  a.body.append(el('p','kt-hint','只填标签名即可。可添加多个，保存后共同生效。'));
  const preview=el('div','kt-preview'),label=el('span','kt-preview-label','识别示例'),code=el('code','kt-example');preview.append(label,code);a.body.append(preview);
  a.body.append(el('p','kt-note','这里仅设置识别方式，不会改写预设。请确认预设中的开始、结束标签与这里一致。'));
  const reset=el('button','kt-reset','恢复默认标签');reset.type='button';a.body.append(reset);
  function render(){list.replaceChildren();if(!draft.length)list.append(el('span','kt-empty','尚未添加自定义标签'));
   draft.forEach(name=>{const chip=el('span','kt-chip');chip.append(el('code','','<'+name+'>'));const remove=el('button','kt-remove','×');remove.type='button';remove.setAttribute('aria-label','移除标签 '+name);remove.onclick=()=>{draft=draft.filter(t=>t!==name);render();};chip.append(remove);list.append(chip);});
   const name=draft[0]||'thinking';code.textContent='<'+name+'>\n  这部分单独收起\n</'+name+'>\n这里是聊天正文';
  }
  function append(){a.error.textContent='';try{const name=normalize(input.value);if([...BUILTIN,...draft].includes(name))throw Error('这个标签已经在识别列表里。');if(draft.length>=16)throw Error('最多添加 16 个自定义标签。');draft.push(name);input.value='';render();input.focus();}catch(error){a.error.textContent=error.message;input.focus();}}
  add.onclick=append;input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();append();}});
  reset.onclick=()=>{draft=DEFAULTS.slice();input.value='';a.error.textContent='';render();};render();
  a.tagInput=input;
 },async a=>{
  // Saving a typed final name must not silently discard it.
  if(a.tagInput.value.trim()){const name=normalize(a.tagInput.value);if(!BUILTIN.includes(name)&&!draft.includes(name))draft.push(name);}
  await save(draft);if(typeof showToast==='function')showToast('识别标签已保存');
 },'保存设置');
}
function init(){const entry=document.getElementById('kiss-reasoning-tags');if(!entry)return;entry.addEventListener('click',openEditor);refresh();const screen=document.getElementById('cot-settings-screen');new MutationObserver(refresh).observe(screen,{attributes:true,attributeFilter:['class']});}
root.KissReasoningTags={tags,customTags,normalize,split,save,openEditor};
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();}
})(window);
