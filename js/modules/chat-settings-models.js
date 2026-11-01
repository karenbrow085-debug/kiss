/* Per-character model selection. Auxiliary app routes keep their existing priority. */
(() => {
'use strict';
function config(chat={},fallback){
 let out={...(fallback||(typeof db!=='undefined'?db.apiSettings:{}))};
 if(!chat.exclusiveApiEnabled)return out;
 const data=(db.apiPresets||[]).find(p=>p.name===chat.exclusiveApiPreset)?.data;
 if(data)out={...out,url:data.apiUrl||out.url,key:data.apiKey||out.key,provider:data.provider||out.provider,model:data.model||out.model,temperature:data.temperature??out.temperature,temperatureEnabled:data.temperatureEnabled??out.temperatureEnabled};
 if(String(chat.exclusiveApiModel||'').trim())out.model=chat.exclusiveApiModel.trim();
 return out;
}
function endpoint(c){
 if(window.AppApi?.modelEndpoint)return window.AppApi.modelEndpoint(c);
 const u=new URL(c.url);if(!['https:','http:'].includes(u.protocol))throw Error('请填写有效 API 地址');
 let path=u.pathname.replace(/\/+$/,'').replace(/\/(chat\/completions|responses|messages)$/,'');
 u.search='';if(c.provider==='gemini'){u.pathname=path.replace(/\/v1(?:beta)?$/,'').replace(/\/models$/,'')+'/v1beta/models';u.searchParams.set('key',c.key);u.searchParams.set('pageSize','1000');}
 else u.pathname=/\/models$/.test(path)?path:path+(/\/v\d+(?:beta)?$/.test(path)?'/models':'/v1/models');
 return u;
}
async function fetchModels(c){
 if(!c.url||!c.key)throw Error('请先选择已保存地址和密钥的 API 预设，或配置桌面 API');
 if(typeof BLOCKED_API_DOMAINS!=='undefined'&&BLOCKED_API_DOMAINS.some(d=>c.url.includes(d)))throw Error('该 API 站点已被屏蔽');
 const key=typeof getRandomValue==='function'?getRandomValue(c.key):c.key,u=endpoint({...c,key}),headers=c.provider==='gemini'?{}:['anthropic','claude'].includes(c.provider)?{'x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}:{Authorization:'Bearer '+key};
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000),all=[];
 try{for(let page=0;page<20;page++){
  const response=await fetch(u.href,{headers,signal:controller.signal});if(!response.ok)throw Error('模型拉取失败（HTTP '+response.status+'）');
  const data=await response.json(),rows=Array.isArray(data)?data:data.data||data.models||[];
  if(!Array.isArray(rows))throw Error('接口返回的模型列表格式无效');
  all.push(...rows.filter(r=>r&&(!r.supportedGenerationMethods||r.supportedGenerationMethods.includes('generateContent'))).map(r=>typeof r==='string'?r:r.id||r.name).filter(n=>typeof n==='string').map(n=>n.replace(/^models\//,'')));
  if(data.nextPageToken)u.searchParams.set('pageToken',data.nextPageToken);else if(data.has_more&&data.last_id)u.searchParams.set('after_id',data.last_id);else break;
 }return [...new Set(all)];}catch(e){if(e.name==='AbortError')throw Error('拉取超时，可以重试或手动填写模型');throw e;}finally{clearTimeout(timer);}
}
function search(models,query){if(window.AppApi?.search)return window.AppApi.search(models,query);const q=String(query||'').toLowerCase().replace(/[\s_-]/g,'');return models.filter(m=>m.toLowerCase().replace(/[\s_-]/g,'').includes(q));}
window.KissExclusiveModels={config,endpoint,fetchModels,search};
})();
