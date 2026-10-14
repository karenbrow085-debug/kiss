/* Independent app API profiles. Presets remain owned by the desktop API settings. */
(function(global){
  'use strict';
  if(global.AppApi)return;
  const KEY='kiss.app-api.v1',apps=new Set(['mono','morrow','hearu','mcp']),cache=new Map();
  const mounts=new Map();let profiles={};
  try{profiles=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{}
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function host(){return typeof db!=='undefined'?db:global.db||{};}
  function presets(){return (host().apiPresets||[]).filter(p=>p&&p.data&&p.name).map(p=>({id:String(p.id||'name:'+p.name),name:String(p.name),data:p.data}));}
  function profile(app){if(!apps.has(app))throw Error('未知应用');const p=profiles[app]||{};return {presetId:String(p.presetId||''),model:String(p.model||'')};}
  function set(app,value){profile(app);const next={...profiles,[app]:{presetId:String(value.presetId||''),model:String(value.model||'').trim()}};localStorage.setItem(KEY,JSON.stringify(next));profiles=next;cache.delete(app);global.dispatchEvent(new CustomEvent('app-api-updated',{detail:{app}}));return profile(app);}
  function active(app){const p=profile(app);return !!(p.presetId||p.model);}
  function resolve(app,fallback){
    const p=profile(app);let config={...(fallback||host().apiSettings||{})};
    if(p.presetId){const preset=presets().find(x=>x.id===p.presetId||p.presetId==='name:'+x.name);if(!preset)throw Error('已选 API 预设已被删除，请在本软件设置里重新选择');const d=preset.data;config={url:d.apiUrl??d.url??'',key:d.apiKey??d.key??'',model:d.model||'',provider:d.provider||'newapi',temperatureEnabled:!!d.temperatureEnabled,temperature:d.temperature};}
    if(p.model)config.model=p.model;
    return config;
  }
  function requestConfig(app,fallback){const c=resolve(app,fallback);if(typeof getRandomValue==='function'&&c.key)c.key=getRandomValue(c.key);return c;}
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  function distance(a,b){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next[j+1]=Math.min(next[j]+1,row[j+1]+1,row[j]+(a[i]===b[j]?0:1));row=next;}return row[b.length];}
  function rank(model,query){
    const target=norm(model),q=norm(query);if(!q)return 0;if(target===q)return 0;if(target.startsWith(q))return 1;if(target.includes(q))return 2;
    const terms=String(query).toLowerCase().trim().split(/[\s/_.-]+/).map(norm).filter(Boolean);if(terms.length>1&&terms.every(t=>target.includes(t)))return 3;
    let cursor=0;for(const ch of target)if(ch===q[cursor])cursor++;if(cursor===q.length)return 10+target.length-q.length;
    if(q.length>=4){const words=String(model).toLowerCase().split(/[\s/_.-]+/).filter(Boolean);for(const word of words)if(Math.abs(word.length-q.length)<=1&&distance(word,q)<=1)return 30;}
    return Infinity;
  }
  function search(models,query){return models.map((name,index)=>({name,index,score:rank(name,query)})).filter(x=>Number.isFinite(x.score)).sort((a,b)=>a.score-b.score||a.index-b.index).map(x=>x.name);}
  function modelEndpoint(config){
    const u=new URL(String(config.url||'').trim());if(!['http:','https:'].includes(u.protocol))throw Error('API 地址需要 http 或 https');
    let path=u.pathname.replace(/\/+$/,'').replace(/\/chat\/completions$|\/responses$|\/messages$/,'');
    const gemini=config.provider==='gemini';
    if(gemini){path=path.replace(/\/v1beta\/models\/[^/]+:\w+$/,'').replace(/\/v1(?:beta)?$/,'');path=path.replace(/\/models$/,'');u.pathname=path+'/v1beta/models';u.search='';if(config.key)u.searchParams.set('key',config.key);u.searchParams.set('pageSize','1000');}
    else{u.pathname=/\/models$/.test(path)?path:path+(/\/v\d+(?:beta)?$/.test(path)?'/models':'/v1/models');u.search='';}
    return u;
  }
  function signature(config){return JSON.stringify([config.url,config.key,config.provider,config.model]);}
  async function fetchModels(app){
    const config=requestConfig(app);if(!config.url||!config.key)throw Error('请先在桌面保存完整的 API 预设');
    if(typeof BLOCKED_API_DOMAINS!=='undefined'&&BLOCKED_API_DOMAINS.some(x=>config.url.includes(x)))throw Error('该 API 站点已被屏蔽');
    const stamp=signature(resolve(app)),u=modelEndpoint(config),headers={};
    if(config.provider==='anthropic'||config.provider==='claude')Object.assign(headers,{'x-api-key':config.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'});
    else if(config.provider!=='gemini')headers.Authorization='Bearer '+config.key;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);let models=[];
    try{
      for(let page=0;page<20;page++){
        const response=await fetch(u.href,{headers,signal:controller.signal});if(!response.ok)throw Error('模型拉取失败（HTTP '+response.status+'）');const data=await response.json();
        const rows=Array.isArray(data)?data:Array.isArray(data.data)?data.data:Array.isArray(data.models)?data.models:[];
        models.push(...rows.filter(r=>config.provider!=='gemini'||typeof r==='string'||!r.supportedGenerationMethods||r.supportedGenerationMethods.includes('generateContent')).map(r=>typeof r==='string'?r:r.id||r.name).filter(x=>typeof x==='string').map(x=>config.provider==='gemini'?x.replace(/^models\//,''):x));
        if(config.provider==='gemini'&&data.nextPageToken){u.searchParams.set('pageToken',data.nextPageToken);continue;}
        if((config.provider==='anthropic'||config.provider==='claude')&&data.has_more&&data.last_id){u.searchParams.set('after_id',data.last_id);continue;}break;
      }
      models=[...new Set(models)];if(!models.length)throw Error('接口没有返回可用模型，可在当前模型栏手动填写');
      if(signature(resolve(app))!==stamp)throw Error('API 选择已改变，请重新拉取模型');cache.set(app,{stamp,models});return models;
    }catch(e){if(e.name==='AbortError')throw Error('拉取模型超时，请重试');if(e instanceof TypeError)throw Error('无法连接模型列表，请检查接口是否允许网页访问');throw e;}finally{clearTimeout(timer);}
  }
  const style=`
  .app-api-panel{--aa-fg:#252525;--aa-muted:#929296;--aa-line:#eaeaec;--aa-bg:#f5f5f6;color:var(--aa-fg);font:inherit;padding:18px 0;margin:0;min-width:0;text-align:left}
  .app-api-panel *{box-sizing:border-box}.app-api-panel .aa-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 0 17px}.app-api-panel .aa-heading h3{font:inherit;font-size:14px;font-weight:600;margin:0;color:var(--aa-fg)}.app-api-panel .aa-heading small{font-size:9px;color:var(--aa-muted);letter-spacing:.12em}
  .app-api-panel .aa-label{display:block!important;font:inherit!important;font-size:11px!important;color:var(--aa-muted)!important;margin:13px 0 7px!important}
  .app-api-panel select,.app-api-panel input{display:block!important;width:100%!important;min-width:0!important;height:40px!important;min-height:40px!important;padding:9px 12px!important;margin:0!important;border:1px solid var(--aa-line)!important;border-radius:11px!important;background:var(--aa-bg)!important;color:var(--aa-fg)!important;font:inherit!important;font-size:12px!important;box-shadow:none!important}
  .app-api-panel input:focus,.app-api-panel select:focus{outline:1px solid var(--aa-muted);outline-offset:1px}.app-api-panel .aa-model-tools{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-top:14px;align-items:center}
  .app-api-panel button{font:inherit!important;color:var(--aa-fg)!important;border:1px solid var(--aa-line)!important;background:transparent!important;box-shadow:none!important}
  .app-api-panel .aa-fetch{width:auto!important;height:40px!important;padding:0 12px!important;border-radius:11px!important;white-space:nowrap;font-size:11px!important}.app-api-panel button:disabled{opacity:.45}.app-api-panel .aa-status{margin:9px 0 0!important;font-size:10px!important;line-height:1.6!important;color:var(--aa-muted)!important;overflow-wrap:anywhere}.app-api-panel .aa-status[data-error="true"]{color:#9a4d43!important}
  .app-api-panel .aa-results{max-height:220px;overflow:auto;overscroll-behavior:contain;margin-top:10px;border-top:1px solid var(--aa-line)}.app-api-panel .aa-model{display:flex!important;width:100%!important;justify-content:space-between;text-align:left!important;gap:12px;padding:11px 3px!important;border:0!important;border-bottom:1px solid var(--aa-line)!important;border-radius:0!important;font-size:12px!important;line-height:1.5!important;overflow-wrap:anywhere}.app-api-panel .aa-model[aria-pressed="true"]{font-weight:600!important}.app-api-panel .aa-model small{font-size:10px;color:var(--aa-muted);white-space:nowrap}
  .app-api-panel .aa-empty{font-size:11px;color:var(--aa-muted);line-height:1.6;padding:12px 0}.app-api-panel.aa-mono{padding:20px 4px;border-top:1px solid var(--aa-line)}
  .app-api-panel.aa-hearu{margin:16px 0;padding:18px 0;border-top:1px solid var(--aa-line);border-bottom:1px solid var(--aa-line)}.aa-hearu .aa-heading small{letter-spacing:.2em}
  .app-api-panel.aa-morrow{--aa-fg:#464b43;--aa-muted:#999b8e;--aa-line:#e6e7dc;--aa-bg:#f8f9f3;padding:0 0 18px;margin:20px 0 0}.aa-morrow .aa-heading h3{font-weight:500}.aa-morrow select,.aa-morrow input,.aa-morrow .aa-fetch{border-radius:8px!important}
  .app-api-panel.aa-mcp{padding:18px 0 22px;margin-bottom:16px;border-bottom:1px solid var(--aa-line)}.aa-mcp .aa-heading h3{font-size:16px}.aa-mcp select,.aa-mcp input,.aa-mcp .aa-fetch{border-radius:6px!important}
  #hearu-app[data-theme="night"] .app-api-panel,#mcp-screen[data-theme="night"] .app-api-panel{--aa-fg:#e8e8e8;--aa-muted:#9c9ca2;--aa-line:#3a3a3c;--aa-bg:#262628}
  `;
  function mount(container,app,options={}){
    if(!container)return;const doc=container.ownerDocument;if(!doc.getElementById('app-api-style')){const el=doc.createElement('style');el.id='app-api-style';el.textContent=style;doc.head.append(el);}
    const state=profile(app),list=presets();let config,error='';try{config=resolve(app);}catch(e){config={};error=e.message;}
    container.classList.add('app-api-panel','aa-'+app);container.dataset.appApi=app;
    container.innerHTML=`<div class="aa-heading"><h3>${esc(options.title||'API 设置')}</h3><small>${esc(options.kicker||'MODEL / API')}</small></div>${options.description?`<p class="aa-status">${esc(options.description)}</p>`:''}<label class="aa-label">API 预设<select data-aa="preset" aria-label="API 预设"><option value="">跟随桌面 API</option>${list.map(p=>`<option value="${esc(p.id)}" ${p.id===state.presetId?'selected':''}>${esc(p.name)}</option>`).join('')}${state.presetId&&!list.some(p=>p.id===state.presetId)?`<option value="${esc(state.presetId)}" selected>已删除的预设 · 请重新选择</option>`:''}</select></label><label class="aa-label">当前模型 · 可手动修改<input data-aa="model" value="${esc(config.model||'')}" aria-label="当前模型" autocomplete="off" placeholder="输入模型名称"></label><div class="aa-model-tools"><input data-aa="search" type="search" placeholder="搜模型 · 支持片段和模糊匹配" aria-label="模糊搜索模型" autocomplete="off"><button type="button" class="aa-fetch" data-aa="fetch">拉取模型</button></div><p class="aa-status" role="status" aria-live="polite"></p><div class="aa-results" data-aa="results" hidden></div>`;
    const select=container.querySelector('[data-aa="preset"]'),model=container.querySelector('[data-aa="model"]'),query=container.querySelector('[data-aa="search"]'),button=container.querySelector('[data-aa="fetch"]'),results=container.querySelector('[data-aa="results"]'),status=container.querySelector('.aa-status');
    let models=[],revision=0;
    const say=(text,bad=false)=>{status.textContent=text;status.dataset.error=String(bad);};
    const cached=cache.get(app);if(cached&&config&&cached.stamp===signature(config))models=cached.models;
    const draw=()=>{results.replaceChildren();if(!models.length){results.hidden=true;return;}const found=search(models,query.value);results.hidden=false;for(const name of found.slice(0,100)){const row=doc.createElement('button');row.type='button';row.className='aa-model';row.setAttribute('aria-pressed',String(name===model.value));const text=doc.createElement('span');text.textContent=name;row.append(text);if(name===model.value){const check=doc.createElement('small');check.textContent='使用中';row.append(check);}row.onclick=()=>{model.value=name;saveModel(name);draw();};results.append(row);}if(!found.length){const empty=doc.createElement('p');empty.className='aa-empty';empty.textContent='没有匹配模型，试试更短的关键词。';results.append(empty);}say(found.length>100?'匹配 '+found.length+' 个模型，先显示 100 个；输入关键词缩小范围。':'匹配 '+found.length+' / '+models.length+' 个模型');};
    const commit=value=>{try{set(app,value);options.onChange?.(resolve(app));return true;}catch(e){say(e.message,true);return false;}};
    const saveModel=name=>{const p=profile(app);if(commit({...p,model:name}))say(name?'已保存 · '+name:'已恢复预设默认模型');};
    select.onchange=()=>{revision++;const p=profile(app);if(!commit({presetId:select.value,model:''})){select.value=p.presetId;return;}models=[];query.value='';model.value=resolve(app).model||'';results.hidden=true;say('已保存，点击拉取模型选择其他模型。');};
    model.onchange=()=>{revision++;saveModel(model.value.trim());model.value=resolve(app).model||'';draw();};
    model.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();model.onchange();}};
    query.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();if(models.length)draw();else button.click();}};
    query.oninput=()=>{if(models.length)draw();else say('先点击拉取模型，再搜索名称。');};
    button.onclick=async()=>{const serial=revision;button.disabled=true;say('正在拉取模型…');try{const rows=await fetchModels(app);if(serial!==revision||!container.isConnected)return;models=rows;draw();}catch(e){if(serial===revision&&container.isConnected)say(e.message,true);}finally{button.disabled=false;}};
    mounts.set(container,{app,options});for(const [element] of mounts)if(!element.isConnected)mounts.delete(element);
    if(error)say(error,true);else if(models.length)draw();else say(list.length?'地址与密钥沿用桌面预设，选择后自动保存。':'桌面尚无 API 预设；可跟随当前桌面配置，或先到桌面保存预设。');
  }
  global.addEventListener('api-presets-updated',()=>{cache.clear();for(const [element,item] of [...mounts])if(element.isConnected)mount(element,item.app,item.options);});
  global.addEventListener('storage',e=>{if(e.key===KEY){try{profiles=JSON.parse(e.newValue||'{}')||{};}catch{}cache.clear();}});
  global.AppApi={profile,set,active,resolve,requestConfig,presets,mount,fetchModels,search,modelEndpoint};
})(window);
