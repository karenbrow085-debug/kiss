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
 const database=db,owner=String(db.activePersonaId||'');
 const guard=()=>{if(db!==database||String(db.activePersonaId||'')!==owner||root.kissCleanupLocked)throw Error('人设或数据状态已改变，已停止保存');};
 guard();if(scope!==undefined&&scope!==owner)throw Error('人设已切换，请重新预览');
 if(resolve(source).css!==previous)throw Error('原美化已发生变化，请重新选择后再修复');
 const property=source.kind==='offline'?'css':'customBubbleCss',changes=[],committed=[];
 if(source.kind==='chat'||source.kind==='offline')for(const c of allChats()){
  const explicit=!source.store&&String(c.id)===source.chatId,created=source.kind==='offline'&&!c.offline&&explicit;
  const target=source.kind==='offline'?(c.offline||(created?{version:1,active:false,nextFloor:1,sessions:[],css:'',draft:{}}:null)):c;
  if(target&&(explicit||previous&&target[property]===previous))changes.push({type:'chat',chat:c,target,before:target[property],created,createdSnapshot:created?clone(target):null,enable:source.kind==='chat'&&explicit,beforeEnabled:c.useCustomBubbleCss});
 }
 // Run the scope and CSS checks inside the same queue that commits settings.
 const mutate=async(key,derive)=>{guard();if(root.PhoneBackup?.mutateSetting){await root.PhoneBackup.mutateSetting(key,current=>{guard();return {value:derive(current)};});}else{const value=derive(clone(db[key]??(key==='globalCss'?'':[])));if(root.PhoneBackup?.saveSettings)await root.PhoneBackup.saveSettings({[key]:value});else{db[key]=value;await saveData();}}};
 const persistChat=async chat=>{guard();if(!allChats().includes(chat))throw Error('聊天已被删除或切换');if(root.PhoneBackup?.saveChat)await root.PhoneBackup.saveChat(chat);else await saveData();};
 const rowIndex=values=>(values||[]).findIndex(p=>source.id?String(p.id)===String(source.id):p.name===source.name);
 try{
  if(source.store){await mutate(source.store,values=>{const index=rowIndex(values);if(index<0||String(values[index].css||'')!==previous)throw Error('美化预设已变化，请重新选择');const before=clone(values[index]),after={...before,css:next,updatedAt:Date.now()},list=values.slice();list[index]=after;committed.push({type:'preset',key:source.store,before,after});return list;});}
  else if(['global','list'].includes(source.kind)){await mutate('globalCss',current=>{if(String(current||'')!==previous)throw Error('全局美化已变化，请重新选择');committed.push({type:'setting',key:'globalCss',before:current||'',after:next});return next;});}
  if(source.store&&['global','list'].includes(source.kind)&&db.globalCss===previous){await mutate('globalCss',current=>{if(String(current||'')!==previous)return current;committed.push({type:'setting',key:'globalCss',before:current||'',after:next});return next;});}
  for(const change of changes){guard();if(!allChats().includes(change.chat))throw Error('聊天已被删除');if(change.target[property]!==change.before)throw Error('聊天美化已变化，请重新预览');if(change.created){if(change.chat.offline)throw Error('线下设置已变化，请重新预览');change.chat.offline=change.target;}else if(source.kind==='offline'&&change.chat.offline!==change.target)throw Error('线下设置已变化，请重新预览');change.target[property]=next;if(change.enable)change.chat.useCustomBubbleCss=true;committed.push(change);await persistChat(change.chat);guard();if(change.target[property]!==next)throw Error('聊天美化已被其他操作更新，请重新预览');}
  guard();if(resolve(source).css!==next)throw Error('原美化已被其他操作更新，请重新预览');
  return {updatedChats:changes.length};
 }catch(error){
  let rollbackFailed=false;
  for(const change of committed.reverse())try{
   guard();
   if(change.type==='preset'){await mutate(change.key,values=>{const index=rowIndex(values);if(index<0)return values;const current=values[index];if(JSON.stringify(current)!==JSON.stringify(change.after))return values;const list=values.slice(),restored={...current};for(const key of ['css','updatedAt']){if(Object.prototype.hasOwnProperty.call(change.before,key))restored[key]=change.before[key];else delete restored[key];}list[index]=restored;return list;});}
   else if(change.type==='setting'){await mutate(change.key,current=>current===change.after?change.before:current);}
   else if(change.target[property]===next&&allChats().includes(change.chat)){
    if(source.kind==='offline'&&change.chat.offline!==change.target)continue;
    if(change.before===undefined)delete change.target[property];else change.target[property]=change.before;
    // A concurrently created session or draft must survive a CSS rollback.
    if(change.created&&change.chat.offline===change.target&&JSON.stringify(change.target)===JSON.stringify(change.createdSnapshot))delete change.chat.offline;
    if(change.enable&&change.chat.useCustomBubbleCss===true){if(change.beforeEnabled===undefined)delete change.chat.useCustomBubbleCss;else change.chat.useCustomBubbleCss=change.beforeEnabled;}
    await persistChat(change.chat);
   }
  }catch(_){rollbackFailed=true;}
  throw Error(error.message+(rollbackFailed?'；部分回滚未完成，请检查原美化与当前人设':''));
 }
}

root.KissStyleCore={hash,catalog,resolve,choose,saveRepair};
})(window);
