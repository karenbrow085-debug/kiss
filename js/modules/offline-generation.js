/* Offline-only request composition and returned reasoning. No preset text is bundled here. */
(function(root){
'use strict';
function split(raw){
 let text='',reasoning='',last=0;const value=String(raw||''),pattern=/<(think|thinking)>([\s\S]*?)(?:<\/\1>|$)/gi;
 for(const match of value.matchAll(pattern)){text+=value.slice(last,match.index);reasoning+=(reasoning?'\n\n':'')+match[2];last=match.index+match[0].length;}
 text+=value.slice(last);text=text.replace(/<(?:t(?:h(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?)?)?)?)?)?$/i,'');
 return {text:text.replace(/\[incipere\]/g,'').trim(),reasoning:reasoning.trim()};
}
function consume(data,provider,target){
 if(data.error)throw Error(data.error.message||'API error');
 if(data.usage)target.usage=data.usage.completion_tokens;
 if(data.usageMetadata)target.usage=data.usageMetadata.candidatesTokenCount;
 if(provider==='gemini')for(const part of data.candidates?.[0]?.content?.parts||[]){if(part.thought)target.reasoning+=part.text||'';else target.full+=part.text||'';}
 else {const choice=data.choices?.find(c=>c.index===undefined||c.index===0),row=choice?.delta||choice?.message||{};const reason=row.reasoning_content??row.reasoning;target.reasoning+=typeof reason==='string'?reason:'';
  if(Array.isArray(row.reasoning_details)&&!reason)target.reasoning+=row.reasoning_details.map(p=>p.text||'').join('');
  target.full+=typeof row.content==='string'?row.content:Array.isArray(row.content)?row.content.map(p=>p.text||'').join(''):'';}
 return target;
}
function contextChat(chat){const draft=chat.offline?.draft||{};return {...chat,worldBookIds:draft.inheritWorldbooks===false?(draft.worldBookIds||[]):(chat.worldBookIds||[])};}
function build(chat,history,apiConfig,basePrompt,trigger='normal'){
 const draft=chat.offline?.draft||{},mode=draft.generationSource==='tavern'?'tavern':'cot',effective=contextChat(chat);
 const messages=history.map(m=>({role:m.role,content:m.content}));
 if(!messages.length)messages.push({role:'user',content:'请根据当前场景开始线下剧情，留出我的回应空间。'});
 let preset=null;
 if(mode==='cot'){
  messages.unshift({role:'system',content:basePrompt(effective)});
  if(draft.cotEnabled){const id=draft.cotPreset||chat.exclusiveCotPreset||db.cotSettings?.activePresetId;
   preset=(db.cotPresets||[]).find(p=>p.id===id);if(!preset)throw Error('思维链预设不存在，请在线下设置重新选择');
   const instructions=(preset.items||[]).filter(p=>p.enabled!==false).map(p=>p.content||'').filter(Boolean).join('\n\n').replace(/\{\{char\}\}/gi,()=>chat.realName||chat.remarkName||'角色').replace(/\{\{user\}\}/gi,()=>chat.myName||'我');
   if(instructions){messages.push({role:'system',content:instructions});messages.push({role:'user',content:'[incipere]'});}
  }
 }
 const built=buildChatApiRequest(apiConfig,messages,{temperature:apiConfig.temperatureEnabled?apiConfig.temperature:undefined});
 let stream=!!apiConfig.streamEnabled,report=null;
 if(mode==='tavern'){
  if(!root.KissTavernRuntime?.prepare)throw Error('酒馆预设模块未加载，请刷新完整更新后的页面');
  report=root.KissTavernRuntime.prepare({chat:effective,chatType:'private',body:built.requestBody,provider:apiConfig.provider,history:messages,offline:true,trigger});
  if(!report.active)throw Error('酒馆预设没有生效，已停止请求；请重新选择预设');
  stream=report.stream;
 }
 // Append after Tavern composition so a preset cannot silently drop collection context.
 const collectionContext=root.KissCollections?.prompt(chat);
 if(collectionContext&&!JSON.stringify(built.requestBody).includes('<双方收藏资料>')){
  if(apiConfig.provider==='gemini'){
   // The app and Tavern runtime both emit snake_case. Never send both aliases.
   const instruction=built.requestBody.system_instruction||built.requestBody.systemInstruction||{parts:[]};
   instruction.parts||=[];instruction.parts.push({text:collectionContext});
   built.requestBody.system_instruction=instruction;delete built.requestBody.systemInstruction;
  }
  else {built.requestBody.messages||=[];built.requestBody.messages.push({role:'system',content:collectionContext});}
 }
 if(apiConfig.provider==='gemini'){
  built.endpoint=built.endpoint.replace(':streamGenerateContent',':generateContent').replace(/([?&])alt=sse(&|$)/,'$1').replace(/[?&]$/,'');
  if(stream)built.endpoint=built.endpoint.replace(':generateContent',':streamGenerateContent')+(built.endpoint.includes('?')?'&':'?')+'alt=sse';
 }else built.requestBody.stream=stream;
 return {...built,stream,mode,presetId:mode==='tavern'?report.presetId:preset?.id};
}
async function applyRequestRegex(built,chat){
 if(built.mode!=='tavern'||!root.KissTavernRegex)return;
 const preset=(db.tavernPresets||[]).find(p=>p.id===built.presetId);if(!preset)return;
 const rows=built.requestBody.messages||built.requestBody.contents||[],fields=[];
 rows.forEach((row,index)=>{const placement=row.role==='user'?1:['assistant','model'].includes(row.role)?2:0;if(!placement)return;const context={placement,depth:rows.length-index-1};if(typeof row.content==='string')fields.push({owner:row,key:'content',context});for(const part of row.parts||Array.isArray(row.content)&&row.content||[])if(typeof part.text==='string')fields.push({owner:part,key:'text',context});});
 const result=await root.KissTavernRegex.apply(fields.map(f=>({text:f.owner[f.key],context:f.context})),preset,{target:'prompt',char:chat.realName||chat.remarkName||'角色',user:chat.myName||'我'});
 if(result.items)fields.forEach((f,index)=>f.owner[f.key]=result.items[index]);if(result.warnings.length)console.warn('[Preset regex]',...result.warnings);
}
root.KissOfflineGeneration={split,consume,build,contextChat,applyRequestRegex};
})(window);
