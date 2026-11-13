/* Source identities and conservative replacement; no preset copies or chat-history writes. */
(function(root){
'use strict';
const clone=v=>JSON.parse(JSON.stringify(v));
const hash=value=>{let n=2166136261;for(let i=0;i<value.length;i++)n=Math.imul(n^value.charCodeAt(i),16777619);return (n>>>0).toString(36)+':'+value.length;};
function allChats(){return [...(db.characters||[]),...(db.groups||[])];}
function resolve(source){
 if(source.store){const row=(db[source.store]||[]).find(p=>source.id?String(p.id)===source.id:p.name===source.name);if(!row)throw Error('原美化已被删除或重命名，请重新选择');return {row,css:String(row.css||'')};}
 if(source.kind==='global'||source.kind==='list')return {row:db,css:String(db.globalCss||'')};
 const row=allChats().find(c=>String(c.id)===source.chatId);if(!row)throw Error('关联聊天已不存在');return {row,css:String(source.kind==='offline'?row.offline?.css||'':row.customBubbleCss||'')};
}
function catalog(){
 const list=[];const add=(source,name,settings)=>{const value=resolve(source);list.push({...source,name,css:value.css,settings:settings||value.row.settings||null,key:[source.kind,source.store||'current',source.id||source.name||source.chatId||'global'].join(':'),signature:hash(value.css)});};
 add({kind:'global'},'当前全局美化');
 for(const p of db.globalCssPresets||[])add({kind:/#chat-list-screen|\.chat-list|\.ku-chat/.test(p.css||'')?'list':'global',store:'globalCssPresets',id:p.id?String(p.id):'',name:p.name},p.name,p.settings);
 for(const p of db.bubbleCssPresets||[])add({kind:'chat',store:'bubbleCssPresets',id:p.id?String(p.id):'',name:p.name},p.name,p.settings);
 for(const p of db.offlineStylePresets||[])add({kind:'offline',store:'offlineStylePresets',id:p.id?String(p.id):'',name:p.name},p.name,p.settings);
 for(const c of allChats())for(const kind of ['chat','offline']){const css=kind==='chat'?c.customBubbleCss:c.offline?.css;if(!css||list.some(p=>p.kind===kind&&p.css===css))continue;add({kind,chatId:String(c.id)},'当前 · '+(c.remarkName||c.realName||c.name||'聊天'));}
 return list;
}
function choose(kind,chat){
 const current=kind==='global'||kind==='list'?{kind}:{kind,chatId:String(chat?.id||'')};
 if((kind==='chat'||kind==='offline')&&!chat)return null;
 const value=resolve(current),match=catalog().find(p=>p.store&&(p.kind===kind||(kind==='global'&&p.kind==='list')||(kind==='list'&&p.kind==='global'))&&p.css===value.css);
 return {...(match||current),kind,name:match?.name||('当前'+({global:'全局',list:'列表',chat:'聊天',offline:'线下'})[kind]+'美化'),css:value.css,settings:match?.settings||null};
}
async function saveRepair(source,previous,next,scope){
 if(typeof next!=='string'||!next.trim())throw Error('修复代码为空，未覆盖原美化');
 if(root.kissCleanupLocked)throw Error('数据正在整理，请稍后保存');
 const owner=String(db.activePersonaId||'');if(scope!==undefined&&scope!==owner)throw Error('人设已切换，请重新预览');
 if(resolve(source).css!==previous)throw Error('原美化已发生变化，请重新选择后再修复');
 const changes=[],settingKey=source.store||(['global','list'].includes(source.kind)?'globalCss':null);
 const settingBefore=settingKey?clone(db[settingKey]??(source.store?[]:'')):null;
 const property=source.kind==='offline'?'css':'customBubbleCss';
 if(source.kind==='chat'||source.kind==='offline')for(const c of allChats()){
  const explicit=!source.store&&String(c.id)===source.chatId;
  const created=source.kind==='offline'&&!c.offline&&explicit;
  const target=source.kind==='offline'?(c.offline||(created?{version:1,active:false,nextFloor:1,sessions:[],css:'',draft:{}}:null)):c;
  if(target&&(explicit||previous&&target[property]===previous))changes.push({chat:c,target,before:target[property],next,created,enable:source.kind==='chat'&&explicit,beforeEnabled:c.useCustomBubbleCss});
 }
 const guard=()=>{if(String(db.activePersonaId||'')!==owner||root.kissCleanupLocked)throw Error('人设或数据状态已改变，已停止保存');};
 const persistSettings=async value=>{if(root.PhoneBackup?.saveSettings)await root.PhoneBackup.saveSettings({[settingKey]:value});else{db[settingKey]=value;await saveData();}};
 const persistChat=async chat=>{if(root.PhoneBackup?.saveChat)await root.PhoneBackup.saveChat(chat);else await saveData();};
 const committed=[];let settingWritten=false;
 try{
  guard();
  // Persist the library replacement first; chat consumers update only after it succeeds.
  if(settingKey){
   if(source.store&&root.PhoneBackup?.mutateSetting){await root.PhoneBackup.mutateSetting(settingKey,values=>{const index=(values||[]).findIndex(p=>source.id?String(p.id)===source.id:p.name===source.name);if(index<0||String(values[index].css||'')!==previous)throw Error('美化预设已变化，请重新选择');const list=values.slice();list[index]={...values[index],css:next,updatedAt:Date.now()};return {value:list};});}
   else{let value=next;if(source.store){value=clone(db[settingKey]||[]);const index=value.findIndex(p=>source.id?String(p.id)===source.id:p.name===source.name);value[index]={...value[index],css:next,updatedAt:Date.now()};}await persistSettings(value);}settingWritten=true;
  }
  if(source.store&&['global','list'].includes(source.kind)&&db.globalCss===previous){const before=db.globalCss;await (root.PhoneBackup?.saveSettings?root.PhoneBackup.saveSettings({globalCss:next}):(db.globalCss=next,saveData()));committed.push({global:true,before});}
  for(const change of changes){guard();if(!allChats().includes(change.chat))throw Error('聊天已被删除');if(change.target[property]!==change.before)throw Error('聊天美化已变化，请重新预览');if(change.created){if(change.chat.offline)throw Error('线下设置已变化，请重新预览');change.chat.offline=change.target;}else if(source.kind==='offline'&&change.chat.offline!==change.target)throw Error('线下设置已变化，请重新预览');change.target[property]=next;if(change.enable)change.chat.useCustomBubbleCss=true;committed.push(change);await persistChat(change.chat);}
  return {updatedChats:changes.length};
 }catch(error){
  let rollbackFailed=false;
  for(const change of committed.reverse()){try{if(change.global){db.globalCss=change.before;await (root.PhoneBackup?.saveSettings?root.PhoneBackup.saveSettings({globalCss:change.before}):saveData());}else if(change.target[property]===next){change.target[property]=change.before;if(change.created&&change.chat.offline===change.target)delete change.chat.offline;if(change.enable){if(change.beforeEnabled===undefined)delete change.chat.useCustomBubbleCss;else change.chat.useCustomBubbleCss=change.beforeEnabled;}await persistChat(change.chat);}}catch(_){rollbackFailed=true;}}
  if(settingKey&&(settingWritten||!root.PhoneBackup)){try{await persistSettings(settingBefore);}catch(_){rollbackFailed=true;}}
  throw Error(error.message+(rollbackFailed?'；部分回滚失败，请保留页面并检查当前美化':''));
 }
}
root.KissStyleCore={hash,catalog,resolve,choose,saveRepair};
})(window);
