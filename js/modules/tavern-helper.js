/* Original adapter for documented Tavern Helper interfaces. No third-party preset or script is bundled. */
(function(root){
'use strict';
const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
function rows(chat){return (chat.history||[]).filter(m=>m.offlineNarrative&&!m.offlineArchiveId&&(!m.offlineSessionId||m.offlineSessionId===chat.offline?.activeSessionId));}
function preset(chat){return (db.tavernPresets||[]).find(p=>p.id===chat.offline?.draft?.tavernPresetId)||null;}
function snapshot(chat,messageId){
 const list=rows(chat),p=preset(chat),scope=chat.offline?.tavernHelper||{},allBooks=db.worldBooks||[],bound=chat.offline?.draft?.inheritWorldbooks===false?chat.offline.draft.worldBookIds||[]:chat.worldBookIds||[];
 return copy({messageId:list.findIndex(m=>m.id===messageId),chatId:chat.id,sessionId:chat.offline?.activeSessionId,name:chat.realName||chat.remarkName||'',user:chat.myName||'我',avatar:chat.avatar||'',userAvatar:chat.myAvatar||'',presetId:p?.id,presetName:p?.name,chat:list.map((m,i)=>({_kissId:m.id,message_id:i,name:m.role==='user'?chat.myName:chat.realName,role:m.role,message:m.content||'',is_hidden:!!m.offlineHidden,data:m.tavernHelperVariables||{},extra:m.tavernHelperExtra||{}})),variables:{chat:scope.sessions?.[chat.offline?.activeSessionId]||{},character:scope.character||{},global:db.tavernSettings?.helperVariables||{},preset:p?.helperVariables||{},script:scope.scripts||{}},worldbooks:allBooks.map(b=>({name:b.name||b.id,entries:copy(b.tavernHelperEntries)||[{uid:0,name:b.name||b.id,enabled:b.enabled!==false,content:b.content||'',strategy:{type:'constant',keys:[],keys_secondary:{logic:'and_any',keys:[]},scan_depth:'same_as_global'},position:{type:'before_character_definition',order:b.depth??100}}]})),boundBooks:allBooks.filter(b=>bound.includes(b.id)).map(b=>b.name||b.id),regexes:p?.data?.extensions?.regex_scripts||p?.data?.regex_scripts||[]});
}
function variableTarget(chat,option={type:'chat'}){
 const cfg=chat.offline,store=cfg.tavernHelper||(cfg.tavernHelper={});
 switch(option.type||'chat'){
 case 'chat':store.sessions||={};return [store.sessions,cfg.activeSessionId||'default'];
 case 'character':return [store,'character'];
 case 'global':db.tavernSettings||={};return [db.tavernSettings,'helperVariables'];
 case 'preset':{const p=preset(chat);if(!p)throw Error('未选择预设');return[p,'helperVariables'];}
 case 'script':{const id=String(option.script_id||'default');if(['__proto__','constructor','prototype'].includes(id))throw Error('脚本变量标识无效');store.scripts||={};return[store.scripts,id];}
 case 'message':{const list=rows(chat);let i=option.message_id==='latest'||option.message_id==null?list.length-1:Number(option.message_id);if(i<0)i+=list.length;if(!list[i])throw Error('消息楼层不存在');return[list[i],'tavernHelperVariables'];}
 default:throw Error('尚不支持此变量范围：'+option.type);
 }
}
async function transaction(owner,key,value,save){const before=owner[key];owner[key]=copy(value);try{await save();}catch(error){if(before===undefined)delete owner[key];else owner[key]=before;throw error;}}
async function handle(method,args,hooks){
 const {chat,save}=hooks;if(!chat.offline?.active)throw Error('当前线下片段已结束');
 if(method==='variables'){const value=args[0],option=args[1]||{type:'chat'};if(!value||typeof value!=='object'||Array.isArray(value)||JSON.stringify(value).length>500000)throw Error('变量表无效或过大');const [owner,key]=variableTarget(chat,option);await transaction(owner,key,value,save);return copy(owner[key]);}
 if(method==='setChatMessages'){
 const list=rows(chat),updates=args[0]||[];if(!Array.isArray(updates))throw Error('消息更新无效');const targets=updates.map(update=>{const m=list[update.message_id];if(!m)throw Error('消息楼层不存在');if(update.message!==undefined&&(typeof update.message!=='string'||!update.message.trim()))throw Error('正文不能为空');return{m,update,before:copy(m)};});
 for(const {m,update} of targets){if(update.message!==undefined){m.content=update.message;m.parts=[{type:'text',text:update.message}];m.offlineEditedAt=Date.now();delete m.offlineTokens;}if(update.is_hidden!==undefined)m.offlineHidden=!!update.is_hidden;if(update.data!==undefined)m.tavernHelperVariables=copy(update.data);if(update.extra!==undefined)m.tavernHelperExtra=copy(update.extra);}
 try{await save();}catch(error){for(const {m,before} of targets){for(const key of Object.keys(m))delete m[key];Object.assign(m,before);}throw error;}hooks.refresh?.();return true;
 }
 if(method==='createChatMessages'){for(const m of args[0]||[])await hooks.create(m);return true;}
 if(method==='deleteChatMessages'){const list=rows(chat),ids=(args[0]||[]).map(i=>list[i]?.id);if(ids.some(id=>!id))throw Error('消息楼层不存在');await hooks.remove(ids);return true;}
 if(method==='getWorldbook'){const b=(db.worldBooks||[]).find(b=>(b.name||b.id)===args[0]);if(!b)throw Error('世界书不存在');return snapshot(chat).worldbooks.find(w=>w.name===args[0]).entries;}
 if(method==='replaceWorldbook'){const b=(db.worldBooks||[]).find(b=>(b.name||b.id)===args[0]);if(!b)throw Error('世界书不存在');if(!Array.isArray(args[1]))throw Error('世界书条目无效');const old={content:b.content,entries:b.tavernHelperEntries};b.tavernHelperEntries=copy(args[1]);b.content=args[1].filter(e=>e.enabled!==false).map(e=>e.content||'').join('\n\n');try{await save();}catch(e){b.content=old.content;b.tavernHelperEntries=old.entries;throw e;}return copy(args[1]);}
 if(method==='generate'||method==='generateRaw')return hooks.generate(args[0]||{},method==='generateRaw');
 if(method==='regexes')return copy(snapshot(chat).regexes);
 if(method==='replaceRegexes'){const p=preset(chat);if(!p)throw Error('未选择预设');if(!Array.isArray(args[0])||args[0].some(r=>!r||typeof r.findRegex!=='string'))throw Error('正则列表无效');const old=snapshot(chat).regexes;const next=args[0].map(r=>({...old.find(x=>x.id===r.id),...r}));p.data.extensions||={};if(Array.isArray(p.data.regex_scripts)&&!Array.isArray(p.data.extensions.regex_scripts))await transaction(p.data,'regex_scripts',next,save);else await transaction(p.data.extensions,'regex_scripts',next,save);root.dispatchEvent(new CustomEvent('kiss-tavern-presets-changed'));return true;}
 throw Error('当前尚未实现酒馆助手接口：'+method);
}
function install(context,rpc,notify){
 context={chat:[],variables:{chat:{},character:{},global:{},preset:{},script:{}},worldbooks:[],boundBooks:[],regexes:[],...context};window.__kissHelperSnapshot=value=>Object.assign(context,value);
 const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
 const reject=name=>{throw Error('当前尚未实现酒馆助手接口：'+name);};
 const eventMap=new Map();
 const on=(name,fn,once=false,first=false)=>{const list=eventMap.get(name)||[];const found=list.find(x=>x.fn===fn);if(!found){const row={fn,once};first?list.unshift(row):list.push(row);eventMap.set(name,list);}return{stop:()=>off(name,fn)};};
 const off=(name,fn)=>{eventMap.set(name,(eventMap.get(name)||[]).filter(x=>x.fn!==fn));};
 const localEmit=async(name,...args)=>{for(const row of [...(eventMap.get(name)||[])]){if(row.once)off(name,row.fn);await row.fn(...args);}};
 window.__kissHelperEvent=localEmit;
 const eventNames={MESSAGE_RECEIVED:'message_received',MESSAGE_SENT:'message_sent',MESSAGE_UPDATED:'message_updated',MESSAGE_EDITED:'message_edited',MESSAGE_DELETED:'message_deleted',MESSAGE_SWIPED:'message_swiped',CHAT_CHANGED:'chat_id_changed',APP_READY:'app_ready',GENERATION_STARTED:'generation_started',GENERATION_ENDED:'generation_ended',GENERATION_STOPPED:'generation_stopped'};
 const iframeNames={MESSAGE_IFRAME_RENDER_STARTED:'message_iframe_render_started',MESSAGE_IFRAME_RENDER_ENDED:'message_iframe_render_ended',GENERATION_REQUESTED:'js_generation_requested',GENERATION_STARTED:'js_generation_started',GENERATION_ENDED:'js_generation_ended',STREAM_TOKEN_RECEIVED_FULLY:'js_stream_token_received_fully',STREAM_TOKEN_RECEIVED_INCREMENTALLY:'js_stream_token_received_incrementally'};
 const opt=o=>o||{type:'chat'},index=i=>i==='latest'||i==null?context.chat.length-1:Number(i)<0?context.chat.length+Number(i):Number(i);
 const getScope=o=>{o=opt(o);if(o.type==='message')return context.chat[index(o.message_id)]?.data||{};if(o.type==='script')return context.variables.script?.[o.script_id||'default']||{};if(!(o.type in context.variables))return reject('变量范围 '+o.type);return context.variables[o.type]||{};};
 const replace=(value,o)=>{o=opt(o);const before=clone(getScope(o));const set=v=>{if(o.type==='message'){const row=context.chat[index(o.message_id)];if(!row)throw Error('消息楼层不存在');row.data=clone(v);}else if(o.type==='script'){context.variables.script||={};context.variables.script[o.script_id||'default']=clone(v);}else context.variables[o.type]=clone(v);};set(value);rpc('variables',[value,o]).catch(error=>{set(before);console.error(error);notify('error',error.message);});return clone(value);};
 const selectRange=range=>{if(range===undefined)return context.chat;const raw=String(range).replace(/\{\{lastMessageId\}\}/g,String(context.chat.length-1));if(/^-?\d+$/.test(raw)){const row=context.chat[index(Number(raw))];return row?[row]:[];}const match=/^(-?\d+)-(-?\d+)$/.exec(raw);if(!match)throw Error('消息范围无效');const start=index(Number(match[1])),end=index(Number(match[2]));return context.chat.filter(m=>m.message_id>=start&&m.message_id<=end);};
 const macros=text=>String(text??'').replace(/\{\{(char|user|lastMessageId|currentMessageId)\}\}/gi,(_,key)=>({char:context.name,user:context.user,lastmessageid:context.chat.length-1,currentmessageid:context.messageId}[key.toLowerCase()]));
 const api={
 getVariables:o=>clone(getScope(o)),replaceVariables:replace,
 updateVariablesWith:(fn,o)=>{const result=fn(clone(getScope(o)));return result?.then?result.then(v=>replace(v,o)):replace(result,o);},
 insertOrAssignVariables:(v,o)=>replace(window._.merge({},getScope(o),v),o),insertVariables:(v,o)=>replace(window._.defaultsDeep({},getScope(o),v),o),
 deleteVariable:(path,o)=>{const v=clone(getScope(o)),removed=window._.unset(v,path);return{variables:replace(v,o),delete_occurred:removed};},
 getChatMessages:(range,options={})=>clone(selectRange(range).filter(m=>(!options.role||options.role==='all'||m.role===options.role)&&(!options.hide_state||options.hide_state==='all'||(options.hide_state==='hidden')===m.is_hidden))),
 setChatMessages:(updates,options)=>rpc('setChatMessages',[updates,options]),createChatMessages:(messages,options)=>rpc('createChatMessages',[messages,options]),deleteChatMessages:(ids,options)=>rpc('deleteChatMessages',[ids,options]),
 getLastMessageId:()=>context.chat.length-1,getCurrentMessageId:()=>context.messageId,getIframeName:()=>`TH-message--${context.messageId}--${context.blockIndex||0}`,
 getTavernRegexes:options=>{if(options?.type&&options.type!=='preset')return reject('非预设正则范围');return clone(context.regexes.map(r=>({id:r.id,script_name:r.scriptName,enabled:!r.disabled,find_regex:r.findRegex,replace_string:r.replaceString,trim_strings:r.trimStrings||[],source:{user_input:(r.placement||[]).includes(1),ai_output:(r.placement||[]).includes(2),slash_command:(r.placement||[]).includes(3),world_info:(r.placement||[]).includes(5),reasoning:(r.placement||[]).includes(6)},destination:{display:!r.promptOnly||!!r.markdownOnly,prompt:!r.markdownOnly||!!r.promptOnly},run_on_edit:r.runOnEdit,min_depth:r.minDepth,max_depth:r.maxDepth})));},
 replaceTavernRegexes:(regexes,options)=>{if(options?.type&&options.type!=='preset')return reject('非预设正则范围');return rpc('replaceRegexes',[regexes.map(r=>({id:r.id,scriptName:r.script_name,disabled:!r.enabled,findRegex:r.find_regex,replaceString:r.replace_string,trimStrings:r.trim_strings||[],placement:Object.entries({user_input:1,ai_output:2,slash_command:3,world_info:5,reasoning:6}).filter(([key])=>r.source?.[key]).map(([,v])=>v),markdownOnly:!!r.destination?.display&&!r.destination?.prompt,promptOnly:!!r.destination?.prompt&&!r.destination?.display,runOnEdit:r.run_on_edit,minDepth:r.min_depth,maxDepth:r.max_depth}))]);},
 getCurrentChatId:()=>context.chatId,getCharAvatarPath:()=>context.avatar,getUserAvatarPath:()=>context.userAvatar,
 getWorldbookNames:()=>context.worldbooks.map(b=>b.name),getGlobalWorldbookNames:()=>reject('全局世界书绑定'),getCharWorldbookNames:()=>({primary:context.boundBooks[0]||null,additional:context.boundBooks.slice(1)}),getChatWorldbookName:()=>context.boundBooks[0]||null,
 getWorldbook:name=>rpc('getWorldbook',[name]),replaceWorldbook:(name,entries,options)=>rpc('replaceWorldbook',[name,entries,options]),updateWorldbookWith:async(name,fn,options)=>{const value=await fn(await rpc('getWorldbook',[name]));return rpc('replaceWorldbook',[name,value,options]);},
 generate:config=>rpc('generate',[config]),generateRaw:config=>rpc('generateRaw',[config]),
 substituteMacros:macros,substitudeMacros:macros,formatAsTavernRegexedString:(text,source,destination,options={})=>window.__kissRegexRun?window.__kissRegexRun({text,rules:context.regexes,context:{placement:{user_input:1,ai_output:2,slash_command:3,world_info:5,reasoning:6}[source],target:destination,depth:options.depth??0,char:options.character_name||context.name,user:context.user}}).text:reject('formatAsTavernRegexedString'),
 eventOn:(name,fn)=>on(name,fn),eventOnce:(name,fn)=>on(name,fn,true),eventMakeFirst:(name,fn)=>on(name,fn,false,true),eventMakeLast:(name,fn)=>{off(name,fn);return on(name,fn);},eventRemoveListener:off,eventClearEvent:name=>eventMap.delete(name),eventClearAll:()=>eventMap.clear(),eventClearListener:fn=>{for(const key of eventMap.keys())off(key,fn);},eventEmit:async(name,...args)=>{await localEmit(name,...args);notify('event',{name,args});},eventEmitAndWait:localEmit,
 tavern_events:eventNames,iframe_events:iframeNames,reloadIframe:()=>notify('reload',{}),getTavernHelperVersion:()=>Promise.resolve('kiss-adapter-1'),
 };
 api.updateTavernRegexesWith=async(fn,options)=>{const rows=await fn(api.getTavernRegexes(options));await api.replaceTavernRegexes(rows,options);return rows;};
 Object.assign(window,api);window.TavernHelper=new Proxy({...api},{get:(obj,key)=>key in obj?obj[key]:(...args)=>reject(String(key))});
 const st=window.SillyTavern.getContext;window.SillyTavern.getContext=()=>({...st(),chat:context.chat.map(m=>({mes:m.message,name:m.name,is_user:m.role==='user',extra:m.extra})),getCurrentChatId:()=>context.chatId,eventSource:{on:api.eventOn,once:api.eventOnce,off,removeListener:off,emit:localEmit},event_types:eventNames});window.SillyTavern.getCurrentChatId=()=>context.chatId;
 window.executeSlashCommandsWithOptions=async text=>({pipe:await window.triggerSlash(text)});
 const oldSlash=window.triggerSlash;window.triggerSlash=async command=>{let result='';for(const chunk of String(command).split(/\s+\|\s+/)){const m=/^\/(\S+)\s*([\s\S]*)$/.exec(chunk.trim());if(!m)throw Error('斜杠命令无效');const name=m[1].toLowerCase(),arg=macros(m[2]);if(name==='setinput')await oldSlash('/setinput '+arg);else if(name==='pass')result=arg;else if(name==='echo'){notify('toast',arg);result=arg;}else if(name==='getvar')result=String(window._.get(getScope(),arg,''));else if(name==='getglobalvar')result=String(window._.get(getScope({type:'global'}),arg,''));else if(name==='setvar'||name==='setglobalvar'){const pair=/^(?:key=)?["']?([^\s"']+)["']?\s+([\s\S]*)$/.exec(arg);if(!pair)throw Error('变量命令格式无效');const o={type:name==='setvar'?'chat':'global'},v=clone(getScope(o));window._.set(v,pair[1],pair[2]);replace(v,o);result=pair[2];}else if(name==='send'){await api.createChatMessages([{role:'user',message:arg}]);result=arg;}else if(name==='trigger'){result=await rpc('generate',[{append:true}]);}else reject('/'+name);}return result;};
 api.triggerSlash=window.triggerSlash;window.TavernHelper.triggerSlash=window.triggerSlash;
window.toastr={info:text=>notify('toast',text),success:text=>notify('toast',text),warning:text=>notify('toast',text),error:text=>notify('error',text)};
 window.__kissHelperReady=()=>{localEmit('app_ready');localEmit('message_iframe_render_ended',api.getIframeName());};
}
root.KissTavernHelper={snapshot,handle,install,rows};
})(window);
