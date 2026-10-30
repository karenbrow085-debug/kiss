/* Independent preset editor for 404. No imported preset text is bundled here. */
(function (global) {
'use strict';
const E = global.KissTavernEngine;
const $ = id => document.getElementById(id);
const clone = value => JSON.parse(JSON.stringify(value));
const uid = () => 'kiss_' + (global.crypto?.randomUUID?.() || Date.now() + '_' + Math.random().toString(36).slice(2));
const text = (tag, content, className) => { const el = document.createElement(tag); el.textContent = content; if (className) el.className = className; return el; };
const toast = message => typeof showToast === 'function' ? showToast(message) : console.info(message);
let presetPane='items';
let view = 'chat', busy = false, cotSort = null, tavernSort = null, search = '', itemSearch = '', openDialog = null;
function state() {
    if (!Array.isArray(db.tavernPresets)) db.tavernPresets = [];
    if (!db.tavernSettings || typeof db.tavernSettings !== 'object') db.tavernSettings = { enabled: false, activePresetId: null, groupIndex: 0 };
    return { presets: db.tavernPresets, settings: db.tavernSettings };
}
function needsMainOrder(p) {
    const groups=E.groupList(p);
    return groups.length>0&&(groups.length!==1||String(groups[0].character_id)!=='100001'||p.groupIndex!==0);
}
function keepMainOrder(p) {
    const groups=E.groupList(p);if(!groups.length)return;
    const selected=groups.find(g=>String(g.character_id)==='100001')||groups[p.groupIndex||0]||groups[0];
    p.data.prompt_order=[{...selected,character_id:100001}];p.groupIndex=0;
}
function active() { const s=state(); return s.presets.find(p=>p.id===s.settings.activePresetId) || null; }
function group(p) { return Number.isInteger(p?.groupIndex) ? p.groupIndex : 0; }
async function commit(change) {
    if (busy) throw Error('正在保存，请稍候');
    if (global.kissCleanupLocked) throw Error('数据正在整理，请稍后保存');
    const s=state(), before={presets:s.presets,settings:s.settings}, next=clone(s);
    change(next); busy=true;
    db.tavernPresets=next.presets; db.tavernSettings=next.settings;
    try { await saveData(); }
    catch (error) { db.tavernPresets=before.presets; db.tavernSettings=before.settings; throw error; }
    finally { busy=false; }
    global.dispatchEvent?.(new CustomEvent('kiss-tavern-presets-changed'));render();
}
function editRecord(id, change) { return commit(s=>{ const p=s.presets.find(x=>x.id===id); if(!p) throw Error('该预设已被删除'); change(p,s); }); }
function action(parent, label, fn, className='pt-link') {
    const b=text('button',label,className);b.type='button';b.addEventListener('click',async()=>{ if(b.disabled)return; b.disabled=true; try{await fn();}catch(e){toast(e.message||'操作失败');}finally{b.disabled=false;} });parent.appendChild(b);return b;
}
function dialog(title, setup, save, saveLabel='保存', nested=false) {
    const parent = nested ? openDialog : null;
    if(openDialog && !nested) { if(openDialog.isSaving()) return null; openDialog.close(); }
    let saving=false, closed=false;
    if(parent) parent.el.hidden=true;
    const overlay=text('div','','pt-dialog'), box=text('form','','pt-dialog-box');
    overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true');
    const titleId=uid();overlay.setAttribute('aria-labelledby',titleId);
    const head=text('div','','pt-dialog-head'), heading=text('h2',title);heading.id=titleId;head.appendChild(heading);
    const body=text('div','','pt-dialog-body'), error=text('div','','pt-error'), foot=text('div','','pt-dialog-foot'); error.setAttribute('role','alert');body.appendChild(error);
    const previous=document.activeElement;
    const close=()=>{if(saving||closed)return;closed=true;overlay.remove();document.removeEventListener('keydown',keys);if(openDialog?.el===overlay)openDialog=parent?.el.isConnected?parent:null;if(parent?.el.isConnected)parent.el.hidden=false;if(previous?.isConnected)previous.focus();};
    const x=action(head,'×',close,'');x.setAttribute('aria-label','关闭弹窗');
    const api={el:overlay,form:box,body,error,close,isSaving:()=>saving,field:(...args)=>field(body,...args)};
    const cancel=action(foot,save?'取消':'关闭',close,'');
    if(save){const submit=text('button',saveLabel);submit.type='submit';foot.appendChild(submit);box.addEventListener('submit',async e=>{e.preventDefault();if(saving||submit.disabled)return;error.textContent='';saving=true;submit.disabled=true;x.disabled=true;cancel.disabled=true;try{await save(api);saving=false;close();}catch(e){error.textContent=e.message||'保存失败，请重试';}finally{saving=false;submit.disabled=false;x.disabled=false;cancel.disabled=false;}});}
    else box.addEventListener('submit',e=>e.preventDefault());
    box.append(head,body,foot);overlay.appendChild(box);document.body.appendChild(overlay);openDialog=api;
    const keys=e=>{if(openDialog?.el!==overlay)return;if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const nodes=[...box.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(n=>n.offsetParent!==null);if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener('keydown',keys);
    setup(api); const first=body.querySelector('input,select,textarea,button');(first||x).focus();return api;
}
function field(parent,label,value='',type='text',options) {
    const l=text('label',label,'pt-field');let input;
    if(options){input=document.createElement('select');options.forEach(o=>{const opt=text('option',Array.isArray(o)?o[1]:o);opt.value=Array.isArray(o)?o[0]:o;input.appendChild(opt);});}
    else input=document.createElement(type==='textarea'?'textarea':'input');
    if(!options&&type!=='textarea') input.type=type;
    if(type==='checkbox')input.checked=!!value;else input.value=value??'';
    l.appendChild(input);parent.appendChild(l);return input;
}
function notice(parent,message) {parent.appendChild(text('p',message,'pt-notice'));}
function askName(title,value='') {return new Promise(resolve=>{let answered=false;const d=dialog(title,a=>{a.name=a.field('名称',value);a.name.required=true;a.name.maxLength=150;},a=>{const name=a.name.value.trim();if(!name)throw Error('请输入名称');answered=true;resolve(name);},'确定',true);if(!d){resolve(null);return;}const close=d.close;d.close=()=>{if(!answered){answered=true;resolve(null);}close();}; // cancellation handlers use DOM removal observer below
 const observer=new MutationObserver(()=>{if(!d.el.isConnected){observer.disconnect();if(!answered){answered=true;resolve(null);}}});observer.observe(document.body,{childList:true});});}
function confirmDialog(title,message) {return new Promise(resolve=>{let answered=false;const destructive=/删除|移除/.test(title);const d=dialog(title,a=>{if(destructive){a.el.classList.add('pt-confirm-delete');a.body.appendChild(text('div','−','pt-delete-mark'));}notice(a.body,message);},()=>{answered=true;resolve(true);},destructive?'确认删除':'确认',true);if(!d){resolve(false);return;}const observer=new MutationObserver(()=>{if(!d.el.isConnected){observer.disconnect();if(!answered)resolve(false);}});observer.observe(document.body,{childList:true});});}
function refreshMode(mode) {
    if(mode!=='chat'&&mode!=='call')return;
    view=mode;
    $('pt-cot-page').hidden=false;$('pt-tavern-page').hidden=true;
    $('pt-page-name').textContent=mode==='call'?'Voice.':'Dialogue.';
    $('pt-page-index').textContent=mode==='call'?'02':'01';$('pt-page-caption').textContent=mode==='call'?'通话提示词':'聊天提示词';
    document.querySelectorAll('#cot-settings-tabs>button').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-current',b.dataset.mode===mode?'page':'false');});
}
function showTavern() {
    view='tavern';$('pt-cot-page').hidden=true;$('pt-tavern-page').hidden=false;
    $('pt-page-name').textContent='Presets.';$('pt-page-index').textContent='03';$('pt-page-caption').textContent='酒馆预设库';
    document.querySelectorAll('#cot-settings-tabs>button').forEach(b=>{b.classList.toggle('active',b.dataset.mode==='tavern');b.setAttribute('aria-current',b.dataset.mode==='tavern'?'page':'false');});render();
}
function download(p) {
    const data=E.exportPreset(p),blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(p.name||'preset').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_')+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function updateOrders(record, transform) {
    const refs=record.data.prompt_order;
    if(!Array.isArray(refs)||!refs.length)return;
    if(Object.hasOwn(refs[0],'identifier'))record.data.prompt_order=transform(refs);
    else refs.forEach(g=>{g.order=transform(g.order||[]);});
}
function currentRecordName() {return active()?.name||'未选择预设';}
async function importFiles(files) {
    if(db.stPresetUnlocked!==true)throw Error('请先完成 SillyTavern 玩家认证，再导入酒馆预设');
    const imported=[];
    for(const f of files){if(f.size>12*1024*1024)throw Error('单个预设不能超过 12 MB');const p=E.importPreset(await f.text(),f.name.replace(/\.json$/i,''));p.id=uid();keepMainOrder(p);imported.push(p);}
    if(!imported.length)return;
    await commit(s=>{s.presets.push(...imported);s.settings.activePresetId=imported[0].id;s.settings.enabled=false;});
    toast('已导入 '+imported.length+' 份预设');
    showReport(imported[0].id);
}
function report(p) {
    const issues=(p.warnings||[]).filter(message=>!message.startsWith('排序引用缺少条目：')&&!message.startsWith('扩展数据将原样保留')&&!message.startsWith('扩展字段完整保留'));
    if(p.format==='chat-completion'){
        const missing=E.orderedPrompts(p,group(p)).filter(row=>row.prompt.missing&&row.enabled).map(row=>row.prompt.identifier);
        if(missing.length)issues.push('缺少已启用条目：'+missing.join('、')+'。使用前需补全、停用或移除引用。');
    }
    if(p.data.extensions&&Object.keys(p.data.extensions).length) issues.push('扩展字段完整保留供导出；消息文本正则可在本预设中单独开关；第三方脚本和酒馆助手不在这里执行。');
    if(p.format!=='chat-completion') issues.push('此文件为文本补全采样器预设：可管理参数和导出，当前 404 对话接口不能按该模板生成。');
    return [...new Set(issues)];
}
function showReport(id) {
    const p=state().presets.find(x=>x.id===id);if(!p)return;
    const d=dialog('预设信息',a=>{
        a.body.appendChild(text('div','PRESET / NOTES','pt-info-eyebrow'));
        a.body.appendChild(text('h3',p.name,'pt-info-title'));
        a.body.appendChild(text('p',p.format==='chat-completion'?'聊天补全预设':'采样参数预设','pt-info-kind'));
        const section=text('section','','pt-info-section');section.appendChild(text('h4','保存与导出'));
        notice(section,'保留条目内容、开关、角色、深度和独立参数。未知字段随文件导出。');a.body.appendChild(section);
        const issues=report(p);if(issues.length){const section=text('section','','pt-info-section');section.appendChild(text('h4','兼容提示'));issues.forEach(message=>notice(section,message));a.body.appendChild(section);}
        const last=global.KissTavernRuntime?.lastReport;
        if(last?.presetId===p.id&&last.warnings?.length){const section=text('section','','pt-info-section');section.appendChild(text('h4','最近一次生成'));last.warnings.forEach(message=>notice(section,message));a.body.appendChild(section);}
    });
    d?.el.classList.add('pt-info-dialog');
}
function showXmlHelp() {
    const d=dialog('标签说明',a=>{
        a.body.appendChild(text('div','XML / REFERENCE','pt-info-eyebrow'));
        a.body.appendChild(text('h3','提示词标签','pt-info-title'));
        notice(a.body,'默认思维链通过以下标签组织提示词，可在编辑条目时引用。');
        const tags=[['<char_settings>','角色设定','角色人设及世界书·后；不包含世界书·破限和世界书·前。'],['<user_settings>','用户设定','你的名字及用户人设。'],['<logic_rules>','逻辑规则','表情包、相册及转账、礼物、撤回等交互规则。'],['<output_formats>','输出格式','回复消息的格式规范。'],['<Chatting Guidelines>','对话指南','对话节奏、消息条数及风格建议。'],['<thinking>','思维链','提示词约定的思维链区域，聊天界面会按现有规则处理。']];
        tags.forEach(([tag,name,description])=>{const section=text('section','','pt-info-section');section.append(text('code',tag),text('h4',name));notice(section,description);a.body.appendChild(section);});
    });
    d?.el.classList.add('pt-info-dialog');
}
function refreshImportLock() {
    const button=$('pt-import');if(!button)return;
    const unlocked=db.stPresetUnlocked===true;
    button.replaceChildren();
    if(!unlocked){const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 16 16');icon.setAttribute('aria-hidden','true');icon.classList.add('pt-import-lock');icon.innerHTML='<rect x="3.5" y="7" width="9" height="6.5" rx="1.4"/><path d="M5.5 7V4.5a2.5 2.5 0 0 1 5 0V7"/>';button.appendChild(icon);}
    button.appendChild(document.createTextNode('导入'));
    button.setAttribute('aria-label',unlocked?'导入酒馆预设':'导入酒馆预设（需玩家认证）');
}
function render() {
    refreshImportLock();
    const body=$('pt-tavern-body');if(!body)return;
    tavernSort?.destroy();tavernSort=null;body.replaceChildren();
    const s=state();if(s.presets.some(needsMainOrder)){if(!busy)commit(next=>next.presets.forEach(keepMainOrder)).catch(error=>{body.replaceChildren(text('div','预设整理未保存：'+error.message,'pt-warning'));action(body,'重试',render);});return;}const filtered=s.presets.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()));
    $('pt-export').disabled=!active();$('pt-manage').disabled=!s.presets.length;
    if(!s.presets.length){body.appendChild(text('div','尚未导入预设\n导入酒馆 JSON，或新建空白预设。','pt-empty'));return;}
    const wrap=text('div','','pt-preset-select');wrap.appendChild(text('small','JSON / PRESET'));
    const select=document.createElement('select');select.setAttribute('aria-label','当前酒馆预设');
    const ph=text('option',filtered.length?'选择预设':'没有匹配的预设');ph.value='';select.appendChild(ph);
    filtered.forEach(p=>{const opt=text('option',p.name);opt.value=p.id;select.appendChild(opt);});select.value=filtered.some(p=>p.id===s.settings.activePresetId)?s.settings.activePresetId:'';
    select.addEventListener('change',()=>run(()=>commit(n=>{n.settings.activePresetId=select.value||null;n.settings.enabled=false;})));
    wrap.appendChild(select);body.appendChild(wrap);
    const p=active();if(!p)return;
    if(search&&!filtered.some(item=>item.id===p.id)){body.appendChild(text('div','请选择匹配的预设；当前预设未切换。','pt-empty'));return;}
    const tools=text('div','','pt-preset-tools');action(tools,'参数设置',()=>parameters(p.id));action(tools,'预设信息',()=>showReport(p.id));body.appendChild(tools);
    const tabs=text('div','','pt-library-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','预设内容');
    for(const [key,label] of [['items','预设条目'],['regex','正则']]){const b=action(tabs,label,()=>{presetPane=key;render();},presetPane===key?'selected':'');b.setAttribute('role','tab');b.setAttribute('aria-selected',String(presetPane===key));}body.appendChild(tabs);
    if(presetPane==='regex'){renderRegex(p,body);return;}
    if(p.format!=='chat-completion'){body.appendChild(text('div','此格式仅管理、保存和导出参数；不作为聊天补全模板执行。','pt-warning'));return;}
    const head=text('div','','pt-section-head');const entries=E.orderedPrompts(p,group(p));head.appendChild(text('h2','条目序列'));action(head,'＋ 添加',()=>editItem(p.id));body.appendChild(head);
    const searchRow=text('div','','pt-search');const input=document.createElement('input');input.type='search';input.placeholder='搜索条目';input.setAttribute('aria-label','搜索条目');input.value=itemSearch;input.addEventListener('input',()=>{itemSearch=input.value;renderItems(p,list);});searchRow.appendChild(input);body.appendChild(searchRow);
    const list=text('div');list.id='pt-st-items';body.appendChild(list);renderItems(p,list);
}

function regexArray(record,path){const keys=path.split('.');let obj=record.data;for(const key of keys.slice(0,-1))obj=obj[key]||(obj[key]={});return obj[keys.at(-1)]||(obj[keys.at(-1)]=[]);}
function renderRegex(p,parent){
    const section=text('section','','pt-regex-section');
    const head=text('div','','pt-section-head');head.appendChild(text('h2','预设正则'));action(head,'导入正则',()=>pickRegex(p.id));section.appendChild(head);
    notice(section,'仅应用于当前预设，切换预设不会共用。');
    const rows=global.KissTavernRegex?.entries(p)||[];
    if(!rows.length)notice(section,'暂无附带正则，可单独导入 JSON。');
    for(const row of rows){const line=text('div','','pt-regex-row');const open=action(line,row.script.scriptName||'未命名正则',()=>editRegex(p.id,row.key),'pt-regex-name');open.title='编辑正则';line.appendChild(toggle(!row.script.disabled,'启用正则：'+(row.script.scriptName||'未命名正则'),checked=>editRecord(p.id,r=>{regexArray(r,row.path)[row.index].disabled=!checked;})));section.appendChild(line);}
    action(section,'＋ 新建正则',()=>editRegex(p.id),'pt-link');parent.appendChild(section);
}
function pickRegex(id){
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.multiple=true;
    input.onchange=()=>run(async()=>{const scripts=[];for(const file of input.files){if(file.size>1024*1024)throw Error('单个正则文件不能超过 1 MB');const value=JSON.parse(await file.text());const rows=Array.isArray(value)?value:Array.isArray(value.regex_scripts)?value.regex_scripts:[value];for(const row of rows){if(!row||typeof row.findRegex!=='string')throw Error('不是有效的酒馆正则文件');scripts.push(clone(row));}}if(!scripts.length)return;await editRecord(id,p=>regexArray(p,'extensions.regex_scripts').push(...scripts));toast('正则已导入当前预设');});input.click();
}
function editRegex(id,key){
 const p=state().presets.find(x=>x.id===id);if(!p)return;const entry=global.KissTavernRegex.entries(p).find(x=>x.key===key),original=entry?.script;
 dialog(original?'编辑正则':'新建正则',a=>{
    a.name=a.field('正则名称',original?.scriptName||'');a.find=a.field('查找表达式',original?.findRegex||'','textarea');a.find.required=true;a.replace=a.field('替换内容',original?.replaceString||'','textarea');
    a.scope=a.field('应用范围',original?.markdownOnly&&original?.promptOnly?'both':original?.markdownOnly?'display':original?.promptOnly?'prompt':'both','text',[['display','仅消息显示'],['prompt','仅发送给 AI'],['both','显示与发送']]);
    a.placement=a.field('消息位置',(original?.placement||[2]).join(','));notice(a.body,'1 为用户消息，2 为 AI 回复；其他位置保留设置，暂不执行。');
    a.enabled=a.field('启用',!original?.disabled,'checkbox');a.edited=a.field('编辑消息时运行',original?.runOnEdit!==false,'checkbox');
    a.min=a.field('最小深度',original?.minDepth??-1,'number');a.max=a.field('最大深度',original?.maxDepth??-1,'number');
    a.trim=a.field('移除匹配中的文本（每行一项）',(original?.trimStrings||[]).join('\n'),'textarea');
    a.macros=a.field('查找中的角色变量',original?.substituteRegex||0,'text',[[0,'不替换'],[1,'直接替换'],[2,'转义后替换']]);
    if(original)action(a.body,'删除此正则',async()=>{if(!await confirmDialog('删除正则','仅从当前预设删除此正则，其他预设不受影响。'))return;await editRecord(id,r=>regexArray(r,entry.path).splice(entry.index,1));a.close();},'pt-delete-entry');
 },a=>editRecord(id,r=>{
    const raw=a.find.value,lit=raw.match(/^\/([\s\S]*)\/([dgimsuvy]*)$/);try{new RegExp(lit?lit[1]:raw,lit?lit[2]:'g');}catch{throw Error('查找表达式无效');}
    const placement=a.placement.value.split(',').map(v=>Number(v.trim()));if(!placement.length||placement.some(v=>!Number.isInteger(v)||v<1||v>6))throw Error('消息位置请填写 1 至 6，用逗号分隔');
    const min=Number(a.min.value),max=Number(a.max.value);if(!Number.isInteger(min)||!Number.isInteger(max)||min< -1||max< -1||max>=0&&min>max)throw Error('深度范围无效，-1 表示不限');
    const script={...(original||{}),id:original?.id||uid(),scriptName:a.name.value.trim()||'未命名正则',findRegex:raw,replaceString:a.replace.value,placement,disabled:!a.enabled.checked,runOnEdit:a.edited.checked,minDepth:min,maxDepth:max,trimStrings:a.trim.value.split('\n').filter(Boolean),substituteRegex:Number(a.macros.value),markdownOnly:a.scope.value==='display',promptOnly:a.scope.value==='prompt'};
    const rows=regexArray(r,entry?.path||'extensions.regex_scripts');if(entry)rows[entry.index]=script;else rows.push(script);
 }));
}

function toggle(checked,label,change,id) {
    const wrap=text('label','','kkt-switch');const input=document.createElement('input');input.type='checkbox';input.checked=!!checked;input.setAttribute('aria-label',label);if(id)input.id=id;
    input.addEventListener('change',async()=>{const next=input.checked;input.disabled=true;try{await change(next);}catch(e){input.checked=!next;toast(e.message||'保存失败');}finally{input.disabled=false;}});wrap.append(input,text('span','','kkt-slider'));return wrap;
}
function renderItems(p,list) {
    tavernSort?.destroy();tavernSort=null;list.replaceChildren();
    const all=E.orderedPrompts(p,group(p)),visible=all.filter(x=>(x.prompt.name+' '+(x.prompt.content||'')).toLowerCase().includes(itemSearch.toLowerCase()));
    visible.forEach(({prompt:item,enabled},index)=>{
        const row=text('div','','pt-st-row');row.dataset.identifier=item.identifier;
        const grip=action(row,'⠿',()=>moveItem(p.id,item.identifier),'pt-grip');grip.setAttribute('aria-label','移动条目：'+(item.name||item.identifier));
        const button=text('button','','pt-item-open');button.type='button';button.appendChild(text('strong',item.name||item.identifier));button.setAttribute('aria-label','编辑条目：'+(item.name||item.identifier));button.onclick=()=>editItem(p.id,item.identifier);row.appendChild(button);
        row.appendChild(toggle(enabled,'启用：'+(item.name||item.identifier),checked=>editRecord(p.id,r=>{const order=E.getOrder(r,group(r));const ref=order.find(x=>x.identifier===item.identifier);if(ref)ref.enabled=checked;else order.push({identifier:item.identifier,enabled:checked});E.setOrder(r,order,group(r));})));list.appendChild(row);
    });
    if(!visible.length)list.appendChild(text('div','没有匹配的条目','pt-empty'));
    if(!itemSearch&&typeof Sortable==='function')tavernSort=new Sortable(list,{handle:'.pt-grip',animation:140,delay:130,delayOnTouchOnly:true,ghostClass:'pt-sort-ghost',onEnd:()=>run(()=>editRecord(p.id,r=>{const old=E.getOrder(r,group(r));const refs=new Map(old.map(x=>[x.identifier,x]));const order=[...list.children].map(n=>refs.get(n.dataset.identifier)||{identifier:n.dataset.identifier,enabled:false});E.setOrder(r,order,group(r));}))});
}
function moveItem(id,identifier) {
    const p=state().presets.find(x=>x.id===id);if(!p)return;const entries=E.orderedPrompts(p,group(p)),index=entries.findIndex(x=>x.prompt.identifier===identifier);
    dialog('移动条目',a=>{a.position=a.field('移至第几项',index+1,'number');a.position.min=1;a.position.max=entries.length;notice(a.body,'也可以按住列表左侧的点阵拖动。');},a=>editRecord(id,r=>{
        const to=Number(a.position.value);if(!Number.isInteger(to)||to<1||to>entries.length)throw Error('请输入有效位置');
        const old=E.getOrder(r,group(r)),map=new Map(old.map(x=>[x.identifier,x]));const refs=entries.map(x=>map.get(x.prompt.identifier)||{identifier:x.prompt.identifier,enabled:false});const from=refs.findIndex(x=>x.identifier===identifier);refs.splice(to-1,0,refs.splice(from,1)[0]);E.setOrder(r,refs,group(r));
    }));
}
const markers=['worldInfoBefore','charDescription','charPersonality','scenario','personaDescription','worldInfoAfter','dialogueExamples','chatHistory','kissMemory','kissStatus'];
function editItem(id,identifier) {
    const p=state().presets.find(x=>x.id===id);if(!p)return;const original=p.data.prompts?.find(x=>x.identifier===identifier);
    const missing=identifier&&!original;
    dialog(original?'编辑条目':'添加条目',a=>{
        if(missing){notice(a.body,'此排序引用缺少定义。可以补全条目，或只移除缺失引用。');action(a.body,'移除缺失引用',async()=>{await editRecord(id,r=>updateOrders(r,refs=>refs.filter(x=>x.identifier!==identifier)));a.close();});}
        a.name=a.field('条目名称',original?.name||'');a.name.required=true;
        a.role=a.field('消息角色',original?.role||'system','text',['system','user','assistant']);
        a.marker=a.field('内容类型',original?.marker?'marker':'text','text',[['text','文本'],['marker','动态插入点']]);
        a.identifier=a.field('动态插入位置',original?.marker?original.identifier:'chatHistory','text',markers);
        a.content=a.field('Prompt 内容',original?.content||'','textarea');
        const sync=()=>{a.identifier.closest('label').hidden=a.marker.value!=='marker';a.content.closest('label').hidden=a.marker.value==='marker';};a.marker.onchange=sync;sync();
        a.position=a.field('插入方式',original?.injection_position??0,'text',[[0,'按条目顺序'],[1,'聊天内深度插入']]);
        a.depth=a.field('距聊天末尾深度',original?.injection_depth??4,'number');a.depth.min=0;a.depth.max=10000;
        a.order=a.field('同深度插入顺序',original?.injection_order??100,'number');
        a.triggers=a.field('生成时机',original?.injection_trigger?.join(',')||'');notice(a.body,'留空为全部；可填写 normal,continue,regenerate,swipe,impersonate,quiet。动态插入点由当前角色、世界书和记录填入。');
        if(original)action(a.body,'删除此条目',async()=>{if(!await confirmDialog('删除条目','从此预设中删除该条目？'))return;await editRecord(id,r=>{r.data.prompts=r.data.prompts.filter(x=>x.identifier!==identifier);updateOrders(r,refs=>refs.filter(x=>x.identifier!==identifier));});a.close();},'pt-delete-entry');
    },a=>editRecord(id,r=>{
        const name=a.name.value.trim();if(!name)throw Error('请输入条目名称');
        const marker=a.marker.value==='marker',key=marker?a.identifier.value:(original?.marker?uid():identifier||uid());
        if(r.data.prompts.some(x=>x.identifier===key&&x.identifier!==identifier))throw Error('该动态插入点已存在，请编辑原条目');
        const depth=Number(a.depth.value),order=Number(a.order.value);if(!Number.isInteger(depth)||depth<0||depth>10000||!Number.isFinite(order))throw Error('深度或顺序无效');
        const item={...(original||{}),identifier:key,name,role:a.role.value,marker,content:marker?'':a.content.value,injection_position:Number(a.position.value),injection_depth:depth,injection_order:order,injection_trigger:a.triggers.value.split(',').map(s=>s.trim()).filter(Boolean)};
        if(item.injection_trigger.some(x=>!['normal','continue','regenerate','swipe','impersonate','quiet'].includes(x)))throw Error('生成时机填写有误');
        r.data.prompts=r.data.prompts||[];const i=r.data.prompts.findIndex(x=>x.identifier===identifier);if(i<0){r.data.prompts.push(item);if(missing&&key!==identifier)updateOrders(r,refs=>refs.map(ref=>ref.identifier===identifier?{...ref,identifier:key}:ref));const refs=E.getOrder(r,group(r));if(!refs.some(x=>x.identifier===key))refs.push({identifier:key,enabled:true});E.setOrder(r,refs,group(r));}else{r.data.prompts[i]=item;if(key!==identifier)updateOrders(r,refs=>refs.map(ref=>ref.identifier===identifier?{...ref,identifier:key}:ref));}
    }));
}
const PARAMS=[['temperature','温度',0,2,.01],['frequency_penalty','频率惩罚',-2,2,.01],['presence_penalty','存在惩罚',-2,2,.01],['top_p','Top P',0,1,.01],['top_k','Top K',0,null,1],['min_p','Min P',0,1,.01],['top_a','Top A',0,1,.01],['repetition_penalty','重复惩罚',0,null,.01],['openai_max_context','上下文长度',1,null,1],['openai_max_tokens','最大回复长度',1,null,1],['n','候选回复数',1,null,1],['seed','随机种子',-1,null,1]];
function parameters(id) {
    const p=state().presets.find(x=>x.id===id);if(!p)return;
    dialog('预设独立参数',a=>{
        notice(a.body,p.name+'\n修改只保存到这一份预设。留空表示该参数未指定；API 是否接受参数取决于提供方。');
        const grid=text('div','','pt-param-grid');a.body.appendChild(grid);a.params={};
        const aliases={temperature:'temp_openai',frequency_penalty:'freq_pen_openai',presence_penalty:'pres_pen_openai',top_p:'top_p_openai',top_k:'top_k_openai'};
        const normalized=E.parameters(p), requestKeys={openai_max_context:'max_context',openai_max_tokens:'max_tokens'};
        for(const [key,label,min,max,step]of PARAMS){const input=field(grid,label,p.data[key]??normalized[requestKeys[key]||key]??'','number');const value=Number(input.value);if(input.value===''||(Number.isFinite(value)&&value>=min&&(max===null||value<=max))){input.min=min;if(max!==null)input.max=max;}input.step=step===1?'1':'any';a.params[key]=input;}
        a.stream=a.field('流式传输',typeof normalized.stream==='boolean'?String(normalized.stream):'','text',[['','不指定'],['true','开启'],['false','关闭']]);
        a.context=a.field('解锁上下文长度',Object.hasOwn(p.data,'max_context_unlocked')?String(p.data.max_context_unlocked):'','text',[['','不指定'],['true','开启'],['false','关闭']]);
        a.effort=a.field('推理强度（留空不指定）',p.data.reasoning_effort||'');a.verbosity=a.field('详细程度（留空不指定）',p.data.verbosity||'');
        const details=document.createElement('details'),summary=text('summary','高级字段');details.appendChild(summary);a.body.appendChild(details);
        const remaining=clone(p.data);for(const key of Object.values(aliases))delete remaining[key];for(const key of ['temp','rep_pen','max_tokens','max_length','max_context','max_context_length','stream'])delete remaining[key];delete remaining.prompts;delete remaining.prompt_order;PARAMS.forEach(([key])=>delete remaining[key]);['stream_openai','max_context_unlocked','reasoning_effort','verbosity'].forEach(key=>delete remaining[key]);
        a.advanced=field(details,'其他原始字段（JSON）',JSON.stringify(remaining,null,2),'textarea');a.advanced.classList.add('pt-json');notice(details,'完整保留未识别字段与扩展。此编辑器不执行脚本。');
        a.initial={params:Object.fromEntries(Object.entries(a.params).map(([key,input])=>[key,input.value])),stream:a.stream.value,context:a.context.value,effort:a.effort.value,verbosity:a.verbosity.value,advanced:a.advanced.value};
    },a=>editRecord(id,r=>{
        let extra;try{extra=JSON.parse(a.advanced.value);}catch(e){throw Error('高级字段不是有效 JSON');}
        if(!extra||typeof extra!=='object'||Array.isArray(extra)||Object.hasOwn(extra,'prompts')||Object.hasOwn(extra,'prompt_order'))throw Error('高级字段应为对象，且不能覆盖条目和排序');
        const aliases={temperature:['temperature','temp_openai','temp'],frequency_penalty:['frequency_penalty','freq_pen_openai'],presence_penalty:['presence_penalty','pres_pen_openai'],top_p:['top_p','top_p_openai'],top_k:['top_k','top_k_openai'],repetition_penalty:['repetition_penalty','rep_pen'],openai_max_tokens:['openai_max_tokens','max_tokens','max_length'],openai_max_context:['openai_max_context','max_context','max_context_length']};
        const managed=[...PARAMS.flatMap(([key])=>aliases[key]||[key]),'stream_openai','stream','max_context_unlocked','reasoning_effort','verbosity'];
        let data=clone(r.data);
        if(a.advanced.value!==a.initial.advanced){data={...extra};for(const key of managed)if(Object.hasOwn(r.data,key))data[key]=clone(r.data[key]);if(r.data.prompts)data.prompts=r.data.prompts;if(r.data.prompt_order)data.prompt_order=r.data.prompt_order;}
        for(const [key,label,min,max,step]of PARAMS){const str=a.params[key].value;if(str===a.initial.params[key])continue;for(const alias of aliases[key]||[key])delete data[alias];if(str==='')continue;const value=Number(str);if(!Number.isFinite(value)||value<min||(max!==null&&value>max)||(step===1&&!Number.isInteger(value)))throw Error(label+'超出有效范围');data[key]=value;}
        if(a.stream.value!==a.initial.stream){delete data.stream;delete data.stream_openai;if(a.stream.value!=='')data.stream_openai=a.stream.value==='true';}
        if(a.context.value!==a.initial.context){delete data.max_context_unlocked;if(a.context.value!=='')data.max_context_unlocked=a.context.value==='true';}
        if(a.effort.value!==a.initial.effort){delete data.reasoning_effort;if(a.effort.value.trim())data.reasoning_effort=a.effort.value.trim();}
        if(a.verbosity.value!==a.initial.verbosity){delete data.verbosity;if(a.verbosity.value.trim())data.verbosity=a.verbosity.value.trim();}
        r.data=data;
    }));
}
function manage() {
    dialog('酒馆预设管理',a=>{
        state().presets.forEach(p=>{const row=text('div','','pt-library-row');row.appendChild(text('span',p.name));action(row,'重命名',async()=>{const name=await askName('重命名预设',p.name);if(name)await editRecord(p.id,r=>{r.name=name;});manage();},'');action(row,'复制',async()=>{await commit(s=>{const copy=clone(s.presets.find(r=>r.id===p.id));copy.id=uid();copy.name+=' 副本';s.presets.push(copy);});manage();},'');action(row,'删除',async()=>{if(!await confirmDialog('删除预设','删除「'+p.name+'」及其独立参数？'))return;await commit(s=>{s.presets=s.presets.filter(r=>r.id!==p.id);if(s.settings.activePresetId===p.id){s.settings.activePresetId=null;s.settings.enabled=false;}});manage();},'');a.body.appendChild(row);});
    });
}
async function createPreset() {
    const name=await askName('新建酒馆预设');if(!name)return;
    const p=E.importPreset({prompts:[],prompt_order:[{character_id:100001,order:[]}]},name);p.id=uid();p.groupIndex=0;
    await commit(s=>{s.presets.push(p);s.settings.activePresetId=p.id;s.settings.enabled=false;});
}
function destroyCotSort(){cotSort?.destroy();cotSort=null;}
function attachCotSort(list,preset) {
    destroyCotSort();if(typeof Sortable!=='function')return;
    cotSort=new Sortable(list,{handle:'.pt-grip',filter:'.locked',animation:140,delay:130,delayOnTouchOnly:true,ghostClass:'pt-sort-ghost',onMove:event=>!event.related.classList.contains('locked'),onEnd:async event=>{
        if(event.oldIndex===event.newIndex)return;const old=preset.items.slice();
        // A locked row cannot be crossed by an unlocked row.
        const lo=Math.min(event.oldIndex,event.newIndex),hi=Math.max(event.oldIndex,event.newIndex);
        if(old.slice(lo,hi+1).some(x=>x.locked)){renderCotItems();return;}
        preset.items.splice(event.newIndex,0,preset.items.splice(event.oldIndex,1)[0]);
        try{await saveData();}catch(e){preset.items=old;toast('排序保存失败');}renderCotItems();
    }});
}
function moveCot(index,preset) {
    if(preset.items[index]?.locked)return;
    dialog('移动思维链条目',a=>{a.pos=a.field('移至第几项',index+1,'number');a.pos.min=1;a.pos.max=preset.items.length;},async a=>{
        const to=Number(a.pos.value)-1;if(!Number.isInteger(to)||to<0||to>=preset.items.length)throw Error('请输入有效位置');
        if(preset.items.slice(Math.min(index,to),Math.max(index,to)+1).some(x=>x.locked))throw Error('不能越过锁定条目');
        const old=preset.items.slice();preset.items.splice(to,0,preset.items.splice(index,1)[0]);try{await saveData();}catch(e){preset.items=old;throw e;}renderCotItems();
    });
}
async function run(fn){try{await fn();}catch(e){toast(e.message||'操作失败');render();}}
function init() {
    if(!$('pt-tavern-page')||!E)return;
    document.querySelector('#cot-settings-tabs [data-mode=tavern]').onclick=showTavern;
    document.querySelector('#cot-settings-screen .pt-close').onclick=e=>{e.preventDefault();e.stopPropagation();switchScreen('more-screen');};
    $('pt-help').onclick=()=>{if(view==='tavern'){const p=active();if(p)showReport(p.id);else dialog('酒馆预设',a=>notice(a.body,'导入 SillyTavern JSON 后，可编辑条目、调整顺序并设置独立参数。不会内置任何第三方预设。'));}else showXmlHelp();};
    $('pt-preset-search').oninput=e=>{search=e.target.value;render();};
    $('pt-import').onclick=()=>{if(typeof global.requestStImportUnlock==='function')global.requestStImportUnlock('pt-import-file');else toast('认证模块未加载，请刷新后重试');};
    document.addEventListener('st-import-unlocked',refreshImportLock);
    refreshImportLock();
    $('pt-import-file').onchange=async e=>{try{await importFiles([...e.target.files]);}catch(error){toast('导入失败：'+error.message);}finally{e.target.value='';}};
    $('pt-export').onclick=()=>{const p=active();if(p)download(p);};$('pt-new').onclick=()=>run(createPreset);$('pt-manage').onclick=manage;
}
global.KissPromptUI={refreshMode,attachCotSort,destroyCotSort,moveCot,askName,confirmDialog,showTavern,render,parameters,importFiles,commit,showXmlHelp,editRegex,pickRegex};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
