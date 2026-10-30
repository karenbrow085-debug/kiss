/* Model metadata and request-only compatibility; saved settings are never rewritten here. */
(function(root){
'use strict';
const models=[
 ['nai-diffusion-5-full','NovelAI Diffusion V5 Full',4,false],
 ['nai-diffusion-5-curated','NovelAI Diffusion V5 Curated',4,false],
 ['nai-diffusion-4-5-full','NovelAI Diffusion V4.5 Full',3,true,'v4-5full'],
 ['nai-diffusion-4-5-curated','NovelAI Diffusion V4.5 Curated',3,true,'v4-5curated'],
 ['nai-diffusion-4-full','NovelAI Diffusion V4 Full',3,true,'v4full'],
 ['nai-diffusion-4-curated-preview','NovelAI Diffusion V4 Curated',3,true,'v4curated'],
 ['nai-diffusion-3','NovelAI Diffusion V3',0,true,'v3'],
 ['nai-diffusion-furry-3','NovelAI Diffusion Furry V3',0,true,'v3furry'],
 ['nai-diffusion-2','NovelAI Diffusion V2',0,false],
 ['nai-diffusion-furry','NovelAI Diffusion Furry (legacy)',0,false],
 ['safe-diffusion','Safe Diffusion (legacy)',0,false]
].map(([id,name,version,vibe,encodingKey])=>({id,name,version,vibe,encodingKey}));
function model(id){const normalized=id==='nai-diffusion-4-curated'?'nai-diffusion-4-curated-preview':String(id||'');return models.find(m=>m.id===normalized)||{id:normalized,name:normalized,version:0,vibe:null};}
const clamp=(v,fallback)=>Number.isFinite(Number(v))?Math.min(1,Math.max(0,Number(v))):fallback;
function encodingFor(item,selected,info){
 const meta=model(selected),map=item.encodings;
 if(map&&typeof map==='object'){
  const collection=map[meta.encodingKey]||map[meta.id],values=collection?Object.values(collection):[];
  const matching=values.find(v=>typeof v?.encoding==='string'&&Math.abs(Number(v.params?.information_extracted??info)-info)<.00001);
  if(matching)return matching.encoding;
 }
 const encodingModel=item.encodingModel||item.model;
 if(typeof item.encoding==='string'&&encodingModel&&model(encodingModel).id===meta.id&&Math.abs(Number(item.infoExtracted??info)-info)<.00001)return item.encoding;
 return null;
}
function imageInput(value){return String(value||'').replace(/^data:image\/[^;,]+;base64,/i,'').replace(/\s/g,'');}
const encodingRequests=new Map();
async function encodeImage(image,selected,info,settings){
 const presets=settings.apiPresets?.novelai||[],preset=presets.find(p=>p.id===settings.activeApiPresetId?.novelai);
 if(preset?.protocol==='openai')throw Error('当前节点使用 OpenAI 协议，不能传递 NAI Vibe；请使用支持 NAI 原生协议的节点');
 const address=preset?.url||settings.novelaiApiUrl,key=preset?.key||settings.novelaiApiKey;
 if(!address||!key)throw Error('请先配置 NAI 的地址和密钥');
 const url=new URL(address);url.pathname=url.pathname.replace(/\/ai\/generate-image(?:-stream)?\/?$/,'').replace(/\/$/,'')+'/ai/encode-vibe';url.search='';url.hash='';
 // Coalesce concurrent calls only. Cache reuse is stored on the selected library item below.
 const cacheKey=JSON.stringify([url.href,key,selected,info,image]);
 if(encodingRequests.has(cacheKey))return encodingRequests.get(cacheKey);
 const request=(async()=>{const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),60000);try{
  const response=await fetch(url.href,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({image,model:selected,information_extracted:info}),signal:controller.signal});
  if(!response.ok)throw Error('Vibe 编码失败 HTTP '+response.status+'；节点需要支持 /ai/encode-vibe');
  const bytes=new Uint8Array(await response.arrayBuffer());if(!bytes.length)throw Error('Vibe 编码返回为空');
  // The native endpoint returns binary; a few native-protocol relays wrap it as JSON.
  if((response.headers.get('content-type')||'').includes('json')){const data=JSON.parse(new TextDecoder().decode(bytes));const encoded=data.encoding||data.data?.encoding;if(typeof encoded!=='string'||!encoded)throw Error('Vibe 编码响应格式不支持');return encoded;}
  let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(value);
 }finally{clearTimeout(timeout);}})();encodingRequests.set(cacheKey,request);try{return await request;}finally{encodingRequests.delete(cacheKey);}
}
async function references(settings,selected){
 const meta=model(selected);if(!settings.vibe?.enabled||!settings.vibe.activeImageId||meta.vibe===false)return [];
 const active=(settings.vibeLibrary||[]).find(v=>v.id===settings.vibe.activeImageId);if(!active)return [];
 const rows=active.type==='group'?active.images||[]:[active],out=[];let changed=false;
 try{for(const item of rows){
  const info=clamp(active.type==='group'?item.infoExtracted:settings.vibe.infoExtracted,1),strength=clamp(active.type==='group'?item.refStrength:settings.vibe.refStrength,.6);
  // Older imports retained only v4-5full, so their unlabelled group encodings have known provenance.
  const compatible=item.encoding&&!item.encodingModel&&active.type==='group'?{...item,encodingModel:'nai-diffusion-4-5-full'}:item;
  let encoding=encodingFor(compatible,selected,info);
  if(!encoding){const image=imageInput(item.base64||item.image);if(!image)throw Error('所选 Vibe 没有 '+meta.name+' 对应的编码或原图，请重新导入含该模型编码的素材');
   if(meta.version===3){encoding=await encodeImage(image,meta.id,info,settings);item.encodings||={};item.encodings[meta.encodingKey]||={};item.encodings[meta.encodingKey][String(info)]={encoding,params:{information_extracted:info}};changed=true;}
   else encoding=image;
  }
  out.push({encoding,info,strength});
 }}finally{if(changed&&typeof saveData==='function')await saveData();}
 return out;
}
function importVibes(data,name='Vibe'){
 const make=(v,index)=>{
  if(!v||typeof v!=='object')return null;
  const encodings=v.encodings&&typeof v.encodings==='object'?structuredClone(v.encodings):{};
  let first=null,encodingKey;
  for(const [key,variants]of Object.entries(encodings)){const found=Object.values(variants||{}).find(x=>typeof x?.encoding==='string'&&x.encoding);if(found){first=found;encodingKey=key;break;}}
  if(!first&&!v.image&&!v.base64)return null;
  const known=models.find(m=>m.encodingKey===encodingKey||m.id===encodingKey);
  return {id:'vibe_'+(root.crypto?.randomUUID?.()||Date.now()+'_'+index+'_'+Math.random()),type:'single',name:v.name||name,
   encodings,encoding:first?.encoding,encodingModel:known?.id||encodingKey,
   base64:v.image||v.base64||'',thumbnail:v.thumbnail||'',
   infoExtracted:clamp(v.importInfo?.information_extracted??first?.params?.information_extracted,1),
   refStrength:clamp(v.importInfo?.strength??v.strength,.6)};
 };
 if(data?.groups&&data.vibeData){const groups=[];
  for(const [groupName,group]of Object.entries(data.groups)){
   const images=(group?.vibes||[]).map((v,i)=>{const source=data.vibeData[v.vibeDataId];const item=make(source,i);if(item&&v.strength!==undefined)item.refStrength=clamp(v.strength,.6);return item;}).filter(Boolean);
   if(images.length)groups.push({id:'vibe_group_'+(root.crypto?.randomUUID?.()||Date.now()+'_'+groups.length),type:'group',name:groupName,images});
  }if(!groups.length)throw Error('Vibe 组没有可用编码或原图');return groups;
 }
 const items=(Array.isArray(data?.vibes)?data.vibes:[data]).map((v,i)=>make(v,i)).filter(Boolean);
 if(!items.length)throw Error('未识别到可用的 Vibe 编码或原图');return items;
}
root.KissNovelAIModels={list:models,model,references,encodingFor,importVibes};
})(window);
