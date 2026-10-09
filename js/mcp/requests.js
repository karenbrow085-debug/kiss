(function(root){
  'use strict';
  const runtime=root.KissMCPRuntime;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const inFlight=new Map();
  let closeModal;
  const toast=text=>{if(typeof showToast==='function')showToast(text);};
  function currentChat(){return typeof currentChatType!=='undefined'&&currentChatType==='private'&&typeof db!=='undefined'?db.characters.find(c=>c.id===currentChatId):null;}
  function currentRequests(chat){
    const found=[];
    for(let i=(chat.history?.length||0)-1;i>=0;i--){
      const m=chat.history[i];
      if(m.type==='mcp-activity'||m.isThinking||m.isStatusUpdate)continue;
      if(m.type==='mcp-request'&&m.role==='user'){if(!m.mcpRequest?.supersededBy)found.unshift(m);continue;}
      if(m.isContextDisabled)continue;
      if(m.role==='assistant')break;
    }
    return found;
  }
  function refresh(chat){if(typeof currentChatId!=='undefined'&&currentChatId===chat.id&&typeof renderMessages==='function')renderMessages(false,true);}
  async function persist(chat){refresh(chat);if(typeof saveData==='function')await saveData();}
  function modal(title){
    closeModal?.();
    const previous=document.activeElement,overlay=document.createElement('div');
    overlay.id='mcp-request-dialog';overlay.className='mc-modal';
    overlay.innerHTML=`<section class="mc-modal-sheet mc-picker-sheet" role="dialog" aria-modal="true" aria-label="${h(title)}"><header><span>${h(title)}</span><button type="button" aria-label="关闭">×</button></header><div class="mc-picker-body"></div></section>`;
    document.body.append(overlay);
    const onKey=event=>{if(event.key==='Escape')close();if(event.key==='Tab'){const focusable=[...overlay.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]')];const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
    const close=()=>{document.removeEventListener('keydown',onKey);overlay.remove();if(closeModal===close)closeModal=null;previous?.focus?.();};
    closeModal=close;document.addEventListener('keydown',onKey);
    overlay.querySelector('header button').onclick=close;overlay.onclick=event=>{if(event.target===overlay)close();};
    overlay.querySelector('header button').focus();
    return {overlay,body:overlay.querySelector('.mc-picker-body'),close,alive:()=>overlay.isConnected};
  }
  function errorIn(view,error){if(!view.alive())return;const old=view.body.querySelector('.mc-picker-error');old?.remove();const p=document.createElement('p');p.className='mc-picker-error';p.setAttribute('role','alert');p.textContent=error.message||String(error);view.body.prepend(p);}
  function authorize(chat,service){
    const settings=runtime.policy(chat);
    if(!settings.enabled)throw Error('该角色的 MCP 已关闭，请在桌面 MCP 的角色设置中启用');
    if(settings.serviceIds!==null&&!settings.serviceIds.includes(service.id))throw Error('该角色没有获得这个项目的使用权限');
    if(service.autoConnect===false)throw Error('这个项目已手动断开，请先在桌面 MCP 中连接');
  }
  async function openPicker(){
    const chat=currentChat();if(!chat){toast('MCP 卡片目前用于 404 单人聊天');return;}
    if(typeof isGenerating!=='undefined'&&isGenerating){toast('请等本轮回复完成，或先暂停生成');return;}
    if(typeof aiGenerationControl!=='undefined'&&aiGenerationControl.isChatActive?.(chat.id,'private')){toast('这个角色正在回复，请先暂停生成');return;}
    const view=modal('发送 MCP 卡片');
    const services=runtime.configuredServices();
    if(!services.length){view.body.innerHTML='<div class="mc-picker-empty">还没有配置 MCP 项目<p>先到桌面 MCP 添加连接，再回来选择。</p></div>';return;}
    view.body.innerHTML=`<p>选择整个项目，让 AI 从中选工具；也可以指定一个工具直接执行。</p><input class="mc-picker-search" type="search" placeholder="搜索已配置项目" aria-label="搜索项目"><div class="mc-picker-list"></div>`;
    const list=view.body.querySelector('.mc-picker-list');
    services.forEach(service=>{
      let denied='';try{authorize(chat,service);}catch(error){denied=error.message;}
      const row=document.createElement('article');row.className='mc-picker-service';row.dataset.search=service.name.toLowerCase();
      row.innerHTML=`<b>${h(service.name)}</b><small>${h(denied||'已在桌面配置')}</small><div class="mc-picker-actions"><button type="button" ${denied?'disabled':''}>发送项目</button><button type="button" ${denied?'disabled':''}>选择工具</button></div>`;
      const buttons=row.querySelectorAll('button');
      buttons[0].onclick=()=>compose(chat,service,null,view);
      buttons[1].onclick=async()=>{
        buttons[1].disabled=true;buttons[1].textContent='读取工具…';
        try{const state=await runtime.connect(service);if(view.alive())toolPicker(chat,service,state.tools,view);}
        catch(error){errorIn(view,error);}
        finally{buttons[1].disabled=false;buttons[1].textContent='选择工具';}
      };
      list.append(row);
    });
    view.body.querySelector('input').oninput=event=>list.querySelectorAll('article').forEach(row=>row.hidden=!row.dataset.search.includes(event.target.value.trim().toLowerCase()));
  }
  function toolPicker(chat,service,tools,view){
    view.body.innerHTML=`<button type="button" class="mc-picker-back">‹ 项目列表</button><h3>${h(service.name)}</h3><input class="mc-picker-search" type="search" placeholder="搜索工具" aria-label="搜索工具"><div class="mc-picker-list"></div>`;
    view.body.querySelector('.mc-picker-back').onclick=()=>{view.close();openPicker();};
    const list=view.body.querySelector('.mc-picker-list');
    if(!tools.length)list.innerHTML='<p>这个项目没有提供工具，暂时不能发送调用卡片。</p>';
    tools.forEach(tool=>{
      const button=document.createElement('button');button.type='button';button.className='mc-picker-tool';button.dataset.search=(tool.title+' '+tool.name+' '+(tool.description||'')).toLowerCase();
      button.innerHTML=`<b>${h(tool.title||tool.name)}</b><small>${h(tool.description||tool.name)}</small>`;
      button.onclick=()=>compose(chat,service,tool,view);list.append(button);
    });
    view.body.querySelector('input').oninput=event=>list.querySelectorAll('.mc-picker-tool').forEach(row=>row.hidden=!row.dataset.search.includes(event.target.value.trim().toLowerCase()));
  }
  function fieldHTML(key,schema,index,required){
    const label=schema.title||key,description=schema.description||'',type=schema.type;
    const common=`data-arg-index="${index}" ${required?'required':''}`;
    let control;
    if(schema.enum)control=`<select ${common}>${!required?'<option value="">不填写</option>':''}${schema.enum.map((value,i)=>`<option value="${i}" ${schema.default!==undefined&&schema.default===value?'selected':''}>${h(value)}</option>`).join('')}</select>`;
    else if(type==='boolean')control=`<select ${common}><option value="">${required?'请选择':'不填写'}</option><option value="true" ${schema.default===true?'selected':''}>是</option><option value="false" ${schema.default===false?'selected':''}>否</option></select>`;
    else if(type==='number'||type==='integer')control=`<input ${common} type="number" step="${type==='integer'?'1':'any'}" ${schema.minimum!==undefined?'min="'+h(schema.minimum)+'"':''} ${schema.maximum!==undefined?'max="'+h(schema.maximum)+'"':''} value="${h(schema.default??'')}">`;
    else if(type==='string'||(!type&&!schema.anyOf&&!schema.oneOf))control=`<textarea ${common} rows="2" placeholder="${h(description||'填写 '+label)}">${h(schema.default??'')}</textarea>`;
    else control=`<textarea ${common} rows="3" placeholder="${h(type==='array'?'填写 JSON 数组，如 ["选项"]':'填写 JSON 值')}" data-json="true">${schema.default!==undefined?h(JSON.stringify(schema.default)):''}</textarea>`;
    return `<label class="mc-picker-field"><span>${h(label)}${required?' *':''}</span>${control}${description?`<small>${h(description)}</small>`:''}</label>`;
  }
  function readArgs(form,tool){
    const args=Object.create(null),properties=Object.entries(tool.inputSchema?.properties||{});
    properties.forEach(([key,schema],i)=>{
      const field=form.querySelector(`[data-arg-index="${i}"]`);const value=field.value;
      if(value===''){if((tool.inputSchema?.required||[]).includes(key))throw Error('请填写 '+(schema.title||key));return;}
      if(schema.enum)args[key]=schema.enum[Number(value)];
      else if(field.dataset.json)args[key]=JSON.parse(value);
      else if(schema.type==='boolean')args[key]=value==='true';
      else if(schema.type==='number'||schema.type==='integer'){args[key]=Number(value);if(!Number.isFinite(args[key])||(schema.type==='integer'&&!Number.isInteger(args[key])))throw Error((schema.title||key)+' 必须为'+(schema.type==='integer'?'整数':'数字'));}
      else args[key]=value;
    });
    const advanced=form.querySelector('[data-all-args]');if(advanced)return parseObject(advanced.value);
    return args;
  }
  function parseObject(value){const args=JSON.parse(value);if(!args||typeof args!=='object'||Array.isArray(args))throw Error('工具参数必须是 JSON 对象');return args;}
  function compose(chat,service,tool,view){
    const properties=Object.entries(tool?.inputSchema?.properties||{}),required=tool?.inputSchema?.required||[];
    const advanced=tool&&(tool.inputSchema?.oneOf||tool.inputSchema?.anyOf||required.some(key=>!properties.some(([name])=>name===key))||(!properties.length&&tool.inputSchema?.additionalProperties));
    const typed=typeof messageInput!=='undefined'?messageInput?.value?.trim()||'':'';
    view.body.innerHTML=`<button type="button" class="mc-picker-back">‹ 返回</button><h3>${h(tool?.title||tool?.name||service.name)}</h3><p>${h(tool?.description||'AI 只会从这个项目提供的工具中选择并执行。')}</p><form>${tool?(advanced?'<label class="mc-picker-field"><span>工具参数（JSON）</span><textarea data-all-args rows="5" required>{}</textarea></label>':properties.map(([key,schema],i)=>fieldHTML(key,schema,i,required.includes(key))).join('')):`<label class="mc-picker-field"><span>让这个项目做什么 *</span><textarea name="instruction" rows="3" required placeholder="例如：查询明天的天气，地点是上海">${h(typed)}</textarea></label>`}<p>发送后立即调用。${tool?'会直接执行这个工具，无需模型选择。':'需要聊天模型支持工具调用。'}成功后才生成回复；失败会留在卡片中。</p>${tool?.annotations?.readOnlyHint===false?'<p class="mc-picker-write">这个工具可能修改数据，请确认参数后发送。</p>':''}<button class="mc-picker-send" type="submit">发送并调用</button></form>`;
    view.body.querySelector('.mc-picker-back').onclick=()=>{view.close();openPicker();};
    const form=view.body.querySelector('form');
    form.onsubmit=async event=>{
      event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
      try{
        authorize(chat,service);
        const instruction=tool?'':form.elements.instruction.value.trim();if(!tool&&!instruction)throw Error('请填写要执行的任务');
        const args=tool?readArgs(form,tool):null;
        await sendCard(chat,service,tool,args,instruction);view.close();
        if(typeof showPanel==='function')showPanel('none');
        await startReply(chat);
      }catch(error){errorIn(view,error);}
      finally{button.disabled=false;}
    };
  }
  async function sendCard(chat,service,tool,args,instruction){
    authorize(chat,service);
    if(typeof isGenerating!=='undefined'&&isGenerating)throw Error('请先暂停当前回复，再发送卡片');
    if(typeof aiGenerationControl!=='undefined'&&aiGenerationControl.isChatActive?.(chat.id,'private'))throw Error('这个角色正在生成，请先暂停');
    if(currentRequests(chat).some(m=>['queued','running'].includes(m.mcpRequest?.status)))throw Error('当前已有一张卡片等待执行，请先处理它');
    const message={id:crypto.randomUUID(),role:'user',type:'mcp-request',content:'[MCP 调用请求：'+(tool?.title||tool?.name||service.name)+']',timestamp:Date.now(),isContextDisabled:true,mcpRequest:{id:crypto.randomUUID(),serviceId:service.id,serviceName:service.name,serviceUrl:service.url,toolName:tool?.name||null,title:tool?.title||tool?.name||service.name,arguments:args,instruction:instruction||'',status:'queued',logIds:[],resultText:'',error:''}};
    chat.history=chat.history||[];chat.history.push(message);
    if(typeof currentPage!=='undefined')currentPage=1;
    const superseded=currentRequests(chat).filter(m=>m!==message&&m.mcpRequest?.status==='failure');
    superseded.forEach(m=>m.mcpRequest.supersededBy=message.id);
    try{await persist(chat);}catch(error){superseded.forEach(m=>delete m.mcpRequest.supersededBy);chat.history=chat.history.filter(m=>m!==message);refresh(chat);throw Error('卡片未保存，工具尚未执行：'+error.message);}
    return message;
  }
  async function startReply(chat){
    if(typeof getAiReply!=='function')throw Error('聊天模块还没加载，请稍后点击 GET');
    await getAiReply(chat.id,'private',currentChat()?.id!==chat.id);
  }
  function renderCard(message){
    const request=message.mcpRequest||{};
    if(request.status==='running'&&!inFlight.has(message.id)){request.status='failure';request.error='调用已中断，远端执行结果未确认；不会自动重试';}
    const status={queued:'等待调用',running:'正在调用',success:'成功',failure:'失败'}[request.status]||'未完成';
    const wrapper=document.createElement('div');wrapper.className='message-wrapper sent mcp-message-wrapper mcp-request-wrapper';wrapper.dataset.id=message.id;
    // 与原来的调用卡片使用同一封面、同一结构和同一 CSS；只有 wrapper 的对齐方向不同。
    wrapper.innerHTML=`<button class="mcp-music-card" type="button" aria-label="查看 ${h(request.title)} 调用详情"><img src="${runtime.cover}" alt=""><span><strong>${h(request.title)}</strong><small>${status}</small></span></button>`;
    wrapper.querySelector('button').onclick=()=>detail(message);return wrapper;
  }
  function detail(message){
    const request=message.mcpRequest||{},view=modal('调用卡片');
    const chat=typeof db!=='undefined'?db.characters.find(c=>c.history?.includes(message)):null;
    const statuses={queued:'等待调用',running:'正在调用',success:'成功',failure:'失败'};
    view.body.innerHTML=`<h3>${h(request.title)}</h3><p>${h(request.serviceName)} · ${statuses[request.status]||'未完成'}</p>${request.instruction?`<h4>你的任务</h4><p>${h(request.instruction)}</p>`:''}${request.toolName?`<h4>调用参数</h4><pre>${h(runtime.redact(request.arguments))}</pre>`:''}${request.error?`<p class="mc-picker-error">${h(request.error)}</p>`:''}${request.resultText?`<h4>真实返回记录</h4><pre>${h(request.resultText)}</pre>`:''}<div class="mc-picker-list"></div>${chat&&request.status==='queued'?'<button type="button" class="mc-picker-send" data-execute>立即调用</button>':''}${chat&&request.status==='failure'?'<button type="button" class="mc-picker-send" data-retry>重新调用</button><p>重新调用会再次执行工具。上次失败或中断时，远端是否完成修改可能无法确认。</p>':''}`;
    const list=view.body.querySelector('.mc-picker-list');
    for(const id of request.logIds||[]){const entry=runtime.logs().find(log=>log.id===id);if(!entry)continue;const button=document.createElement('button');button.type='button';button.className='mc-picker-tool';button.textContent=(entry.title||entry.tool)+' · '+(entry.status==='success'?'成功':entry.status==='running'?'正在调用':'失败');button.onclick=()=>{view.close();runtime.detail(id);};list.append(button);}
    const execute=view.body.querySelector('[data-execute]');if(execute)execute.onclick=async()=>{execute.disabled=true;try{view.close();await startReply(chat);}catch(error){toast(error.message);}finally{execute.disabled=false;}};
    const retry=view.body.querySelector('[data-retry]');if(retry)retry.onclick=async()=>{
      retry.disabled=true;
      try{
        if(!root.confirm('重新调用会再次执行工具。若上次远端已经完成修改，可能重复操作。确认重新调用？'))return;
        const service=runtime.configuredServices().find(s=>s.id===request.serviceId);if(!service||service.url!==request.serviceUrl)throw Error('项目配置已改变，请重新选择');
        await sendCard(chat,service,request.toolName?{name:request.toolName,title:request.title}:null,request.arguments,request.instruction);view.close();await startReply(chat);
      }catch(error){errorIn(view,error);}finally{retry.disabled=false;}
    };
  }
  async function run(message,options){
    const request=message.mcpRequest,results=[];
    if(request.status==='success')return;
    if(request.status==='failure')throw Error(request.error||'卡片调用失败，请点卡片查看或主动重新调用');
    if(request.status==='running'){request.status='failure';request.error='调用已中断，远端执行结果未确认；不会自动重试';await persist(options.chat);throw Error(request.error);}
    request.status='running';request.error='';
    try{
      await persist(options.chat);
      options.generation.check();
      const service=runtime.configuredServices().find(s=>s.id===request.serviceId);
      if(!service)throw Error('卡片对应的项目已被删除，请重新选择');
      if(service.url!==request.serviceUrl)throw Error('项目地址已更改，请重新发送卡片');
      authorize(options.chat,service);
      const state=await runtime.connect(service,options.generation.signal);options.generation.check();
      if(request.toolName){
        const tool=state.tools.find(t=>t.name===request.toolName);if(!tool)throw Error('项目不再提供卡片选定的工具');
        const args=request.arguments;if(!args||typeof args!=='object'||Array.isArray(args))throw Error('卡片的工具参数格式不正确');
        const result=await runtime.invoke({s:service,t:tool},args,{chat:options.chat,request,source:'404 用户卡片',signal:options.generation.signal});
        results.push({tool:tool.name,...result,executed:true});
        if(result.isError)throw Error(result.content?.find(c=>c.type==='text')?.text||'工具服务返回失败');
      }else{
        if(!state.tools?.length)throw Error('这个项目没有提供可调用的工具');
        await runtime.plan({...options,tools:state.tools.map(t=>({s:service,t})),results,explicit:true,request});
      }
      options.generation.check();
      if(!results.some(result=>result.executed&&!result.isError))throw Error('没有成功执行工具，已停止回复');
      request.status='success';request.finishedAt=Date.now();
    }catch(error){
      request.status='failure';request.finishedAt=Date.now();request.error=error.name==='AbortError'?'调用已中断，远端执行结果未确认；不会自动重试':error.message;
      throw error;
    }finally{
      request.resultText=results.length?runtime.redact(results):'';
      // redacted JSON may be truncated; it is used only as plain evidence text, never parsed as commands.
      await persist(options.chat);
    }
  }
  async function prepare(options){
    const messages=currentRequests(options.chat);
    for(const message of messages){
      const request=message.mcpRequest;if(!request)throw Error('MCP 卡片缺少配置，请重新发送');
      let pending=inFlight.get(message.id);
      if(!pending){pending=Promise.resolve().then(()=>run(message,options));inFlight.set(message.id,pending);}
      try{await options.generation.waitFor(pending);}finally{if(inFlight.get(message.id)===pending)inFlight.delete(message.id);}
      options.generation.check();
      if(request.status!=='success')throw Error(request.error||'MCP 尚未执行成功，已停止角色回复');
      runtime.appendContext(options.body,options.provider,runtime.guard('用户发送了一张必须执行的 MCP 卡片。该卡片已经真实执行成功，本轮直接使用下列返回结果，不再重复执行。\n项目：'+request.serviceName+'\n用户任务：'+(request.instruction||request.toolName)+'\n真实记录：\n'+request.resultText));
    }
  }
  // A reload never silently repeats side effects. The user can explicitly retry an interrupted card.
  if(typeof db!=='undefined')for(const chat of db.characters||[])for(const message of chat.history||[])if(message.type==='mcp-request'&&message.mcpRequest?.status==='running'){message.mcpRequest.status='failure';message.mcpRequest.error='页面重新载入，调用已中断，远端执行结果未确认；不会自动重试';}
  document.addEventListener('click',event=>{if(event.target.closest?.('#mcp-chat-menu-btn'))openPicker().catch(error=>toast(error.message));});
  document.addEventListener('keydown',event=>{if(event.target.id==='mcp-chat-menu-btn'&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openPicker().catch(error=>toast(error.message));}});
  root.KissMCPRequests={openPicker,renderCard,prepare,hasCurrent:chat=>currentRequests(chat).length>0,currentRequests,sendCard,readArgs};
})(globalThis);
