// --- API 设置与预设管理逻辑 ---

function setupApiSettingsApp() {
    const e = document.getElementById('api-form'), t = document.getElementById('fetch-models-btn'),
        a = document.getElementById('api-model'), n = document.getElementById('api-provider'),
        r = document.getElementById('api-url'), s = document.getElementById('api-key'), c = {
            newapi: '',
            deepseek: 'https://api.deepseek.com',
            claude: 'https://api.anthropic.com',
            gemini: 'https://generativelanguage.googleapis.com'
        };
    db.apiSettings && (n.value = db.apiSettings.provider || 'newapi', r.value = db.apiSettings.url || '', s.value = db.apiSettings.key || '', db.apiSettings.model && (a.innerHTML = `<option value="${db.apiSettings.model}">${db.apiSettings.model}</option>`));
    if (db.apiSettings && typeof db.apiSettings.timePerceptionEnabled !== 'undefined') { document.getElementById('time-perception-switch').checked = db.apiSettings.timePerceptionEnabled; }
    if (db.apiSettings && typeof db.apiSettings.streamEnabled !== 'undefined') { document.getElementById('stream-switch').checked = db.apiSettings.streamEnabled; } else { document.getElementById('stream-switch').checked = true; } 
    
    const keepAliveSwitch = document.getElementById('keep-alive-switch');
    if (keepAliveSwitch) {
        if (db.apiSettings && typeof db.apiSettings.keepAliveEnabled !== 'undefined') {
            keepAliveSwitch.checked = db.apiSettings.keepAliveEnabled;
        } else {
            keepAliveSwitch.checked = false;
        }
        keepAliveSwitch.addEventListener('change', async (e) => {
            const desiredState = e.target.checked;
            if (window.KeepAliveManager) {
                await window.KeepAliveManager.setEnabled(desiredState, { userInitiated: true });
            }
            db.apiSettings = db.apiSettings || {};
            db.apiSettings.keepAliveEnabled = desiredState;
            await saveData();
            showToast(desiredState ? '持续运行增强已开启' : '持续运行增强已关闭');
        });
    }

    const tempEnabledSwitch = document.getElementById('temperature-enabled-switch');
    const tempSlider = document.getElementById('temperature-slider');
    const tempValue = document.getElementById('temperature-value');
    
    if (tempEnabledSwitch) {
        if (db.apiSettings && typeof db.apiSettings.temperatureEnabled !== 'undefined') {
            tempEnabledSwitch.checked = db.apiSettings.temperatureEnabled;
        } else {
            tempEnabledSwitch.checked = true; // 默认开启
        }
        if (tempSlider) tempSlider.disabled = !tempEnabledSwitch.checked;
        
        tempEnabledSwitch.addEventListener('change', (e) => {
            if (tempSlider) tempSlider.disabled = !e.target.checked;
        });
    }

    if (tempSlider && tempValue) {
        const savedTemp = (db.apiSettings && db.apiSettings.temperature !== undefined) ? db.apiSettings.temperature : 1.0;
        tempSlider.value = savedTemp;
        tempValue.textContent = savedTemp;

        tempSlider.addEventListener('input', (e) => {
            tempValue.textContent = e.target.value;
        });
    }

    populateApiSelect();
    setupSecondaryApiSettings();
    setupChatModelSearch('api-model', 'api-model-search');
    setupChatModelSearch('secondary-api-model', 'secondary-api-model-search');
    if (window.KissVoice) window.KissVoice.init();
    n.addEventListener('change', () => {
        r.value = c[n.value] || ''
    });

    // 提取为全局函数以便复用
    window.fetchAndPopulateModels = async (showToastFlag = true) => {
        const provider = n.value;
        let apiUrl = r.value.trim();
        const apiKey = s.value.trim();
        const modelSelect = a;
        const fetchBtn = t;

        if (!apiUrl || !apiKey) {
            if (showToastFlag) showToast('请先填写API地址和密钥！');
            return;
        }

        if (BLOCKED_API_DOMAINS.some(domain => apiUrl.includes(domain))) {
            if (showToastFlag) showToast('该 API 站点已被屏蔽，无法使用！');
            return;
        }

        if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
        
        const endpoint = provider === 'gemini' 
            ? `${apiUrl}/v1beta/models?key=${getRandomValue(apiKey)}` 
            : `${apiUrl}/v1/models`;

        if (fetchBtn) {
            fetchBtn.classList.add('loading');
            fetchBtn.disabled = true;
        }

        try {
            const headers = provider === 'gemini' ? {} : { Authorization: `Bearer ${apiKey}` };
            const response = await fetch(endpoint, { method: 'GET', headers });
            
            if (!response.ok) {
                const error = new Error(`网络响应错误: ${response.status}`);
                error.response = response;
                throw error;
            }

            const data = await response.json();
            let models = [];
            
            if (provider !== 'gemini' && data.data) {
                models = data.data.map(e => e.id);
            } else if (provider === 'gemini' && data.models) {
                models = data.models.map(e => e.name.replace('models/', ''));
            }

            // 保留当前选中的值（如果仍在列表中）
            const currentVal = modelSelect.value;
            
            modelSelect.innerHTML = '';
            if (models.length > 0) {
                models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m;
                    opt.textContent = m;
                    modelSelect.appendChild(opt);
                });
                
                // 尝试恢复之前的选择，或者使用设置中的值
                if (models.includes(currentVal)) {
                    modelSelect.value = currentVal;
                } else if (db.apiSettings && db.apiSettings.model && models.includes(db.apiSettings.model)) {
                    modelSelect.value = db.apiSettings.model;
                }
                
                if (showToastFlag) showToast('模型列表拉取成功！');
            } else {
                modelSelect.innerHTML = '<option value="">未找到任何模型</option>';
                if (showToastFlag) showToast('未找到任何模型');
            }
        } catch (err) {
            console.error(err);
            if (showToastFlag) {
                showApiError(err);
                modelSelect.innerHTML = '<option value="">拉取失败</option>';
            }
        } finally {
            if (fetchBtn) {
                fetchBtn.classList.remove('loading');
                fetchBtn.disabled = false;
            }
        }
    };

    t.addEventListener('click', () => window.fetchAndPopulateModels(true));
    e.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!a.value) return showToast('请选择模型后保存！');
        if (BLOCKED_API_DOMAINS.some(domain => r.value.includes(domain))) {
            return showToast('该 API 站点已被屏蔽，无法保存！');
        }
        const secondary = readSecondaryApiSettings();
        const secondaryError = secondaryApiValidation(secondary);
        if (secondaryError) return showToast(secondaryError);
        db.apiSettings = {
            ...(db.apiSettings || {}),
            provider: n.value,
            url: r.value,
            key: s.value,
            model: a.value,
            timePerceptionEnabled: document.getElementById('time-perception-switch').checked,
            streamEnabled: document.getElementById('stream-switch').checked, 
            keepAliveEnabled: document.getElementById('keep-alive-switch') ? document.getElementById('keep-alive-switch').checked : false,
            temperatureEnabled: document.getElementById('temperature-enabled-switch').checked,
            temperature: parseFloat(document.getElementById('temperature-slider').value),
            secondary
        };
        await saveData();
        window.dispatchEvent(new CustomEvent('api-presets-updated'));
        showToast('API设置已保存！')
    })
}

function getDefaultSecondaryApiRoutes() {
    return {
        callReply: false,
        callSummary: false,
        journal: false,
        peek: false,
        shop: false,
        batteryReminder: false,
        peekMoments: false,
        mono: false,
        hearu: false,
        morrow: false,
        mcp: false,
        workshopText: false
    };
}

let secondaryApiEditor = null;
function normalizeSecondaryApiProfile(value, index = 0) {
    const p = value && typeof value === 'object' ? value : {};
    return {id: String(p.id || ('secondary_' + index)), name: String(p.name || ('副 API ' + (index + 1))),
        enabled: Boolean(p.enabled), provider: String(p.provider || 'newapi'), url: String(p.url || ''),
        key: String(p.key || ''), model: String(p.model || ''), routes: {...getDefaultSecondaryApiRoutes(), ...(p.routes || {})}};
}
function readSecondaryApiSettings() {
    if (secondaryApiEditor) return secondaryApiEditor.read();
    const saved = db.apiSettings?.secondary || {};
    return {...saved};
}
function secondaryApiValidation(secondary) {
    const profiles = Array.isArray(secondary.profiles) ? secondary.profiles : [secondary];
    for (const p of profiles) {
        if (!p.enabled) continue;
        if (!p.url || !p.key || !p.model) return '请完整填写「' + (p.name || '副 API') + '」的地址、密钥和模型';
        if (BLOCKED_API_DOMAINS.some(domain => p.url.includes(domain))) return '「' + (p.name || '副 API') + '」的站点已被屏蔽，无法保存';
    }
    return '';
}
function setupSecondaryApiSettings() {
    if (secondaryApiEditor) return;
    const $ = id => document.getElementById(id);
    const enabledEl = $('secondary-api-enabled'), panel = $('secondary-api-panel'), providerEl = $('secondary-api-provider'),
        urlEl = $('secondary-api-url'), keyEl = $('secondary-api-key'), modelEl = $('secondary-api-model'), fetchBtn = $('secondary-fetch-models-btn');
    if (!enabledEl || !panel || !providerEl || !urlEl || !keyEl || !modelEl || !fetchBtn) return;
    const group = enabledEl.closest('.kkt-group');group.classList.add('sa-manager');
    const saved = db.apiSettings?.secondary || {}, source = Array.isArray(saved.profiles) ? saved.profiles : [saved];
    let profiles = source.map(normalizeSecondaryApiProfile), activeId = String(saved.activeId || profiles[0]?.id || ''), saving = false;
    // Old backups migrate in memory only. Data is written only by an explicit save.
    const seenIds = new Set();profiles.forEach((p,i)=>{if(seenIds.has(p.id))p.id='secondary_migrated_'+i;seenIds.add(p.id)});
    const assigned = new Set();profiles.forEach(p=>Object.keys(p.routes).forEach(k=>{if(p.routes[k]){if(assigned.has(k))p.routes[k]=false;else assigned.add(k)}}));
    if (!profiles.some(p=>p.id===activeId)) activeId=profiles[0]?.id || '';
    const models = new Map(), requests = new Map();
    const make = (tag, cls, text) => {const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
    const head=make('div','sa-manager-heading');head.innerHTML='<span class="sa-stack-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="15" height="7" rx="2"/><path d="M6 13h15v7H6zM6 6h2m1 10h2"/></svg></span><span><strong>副 API 分流</strong><small>MULTI CONNECTION</small></span>';
    const toolbar=make('div','sa-profile-toolbar'), picker=make('select','');picker.id='secondary-api-profile-select';picker.setAttribute('aria-label','选择要编辑的副 API，不影响其他配置启用');
    const add=make('button','sa-add','＋');add.type='button';add.setAttribute('aria-label','新增副 API 配置');
    const del=make('button','sa-delete');del.type='button';del.setAttribute('aria-label','删除当前副 API 配置');del.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></svg>';
    toolbar.append(picker,add,del);const overview=make('div','sa-profiles-overview');overview.setAttribute('aria-label','同时存在的副 API 配置');const editCaption=make('div','sa-edit-caption','编辑配置');
    const naming=make('label','sa-name-row');naming.append(make('span','','配置名称'));const name=make('input','');name.type='text';name.maxLength=40;name.placeholder='给这套配置取个名字';name.setAttribute('aria-label','副 API 配置名称');naming.append(name);
    group.prepend(head,overview,editCaption,toolbar,naming);
    const enableRow=enabledEl.closest('.kkt-item');enableRow.classList.add('sa-enable-row');enableRow.querySelector('.kkt-item-title').textContent='启用此配置';enableRow.querySelector('.kkt-item-subtitle').textContent='只接管这套配置勾选的功能';
    const routeInputs=[...group.querySelectorAll('[data-secondary-route]')];
    const routeItem=routeInputs[0]?.closest('.kkt-item');
    const routeInfo={callReply:['通话回复','404 · 通话对话'],callSummary:['通话总结','404 · 通话结束后的总结'],journal:['回忆日记','日记 · 自动与手动生成'],peek:['偷看手机','查手机 · 内容生成'],shop:['商城生成','商城 · 商品与文字'],batteryReminder:['低电量提醒','桌面 · 角色提醒'],peekMoments:['查手机动态','查手机 · 动态生成'],mono:['MONO','帖子、私信与文字生成'],hearu:['HearU','聊天、选歌与总结'],morrow:['MORROW','AI 回信'],mcp:['MCP','工具判断与试聊'],workshopText:['工坊文字处理','阅读插图提示；生图使用工坊配置']};
    const routeHead=make('div','sa-routes-heading');routeHead.append(make('strong','','调用功能'));const count=make('small','');count.setAttribute('aria-live','polite');routeHead.append(count);
    const list=make('div','sa-route-list');list.tabIndex=0;list.setAttribute('role','group');list.setAttribute('aria-label','为当前副 API 分配功能，可上下滚动');
    const owners=new Map();
    for(const input of routeInputs){const key=input.dataset.secondaryRoute, info=routeInfo[key]||[key,''];const row=make('label','sa-route-option');const text=make('span','sa-route-text');text.append(make('strong','',info[0]),make('small','',info[1]));const owner=make('small','sa-route-owner');owners.set(key,owner);row.append(input,text,owner);list.append(row);}
    if(routeItem){routeItem.className='kkt-item sa-routes-item';routeItem.removeAttribute('style');routeItem.replaceChildren(routeHead,list,make('p','sa-route-note','每项功能分配给一套副 API；未分配时沿用原配置。'));}
    const footer=make('div','sa-footer');const save=make('button','sa-save','保存副 API');save.type='button';footer.append(make('small','','所有已启用配置同时生效'),save);group.append(footer);
    const current=()=>profiles.find(p=>p.id===activeId);
    const capture=()=>{const p=current();if(!p)return;p.name=name.value.trim()||p.name;p.enabled=enabledEl.checked;p.provider=providerEl.value;p.url=urlEl.value.trim().replace(/\/$/,'');p.key=keyEl.value.trim();p.model=modelEl.value;routeInputs.forEach(input=>p.routes[input.dataset.secondaryRoute]=input.checked);};
    function renderLabels(){
        picker.replaceChildren(...profiles.map((p,i)=>new Option(String(i+1).padStart(2,'0')+' · '+p.name,p.id)));if(!profiles.length)picker.append(new Option('暂无配置，点击 ＋ 新增',''));picker.value=activeId;
        const p=current(),n=p?Object.values(p.routes).filter(Boolean).length:0;count.textContent='已选 '+n+' / '+routeInputs.length;const summary=document.querySelector('[data-secondary-summary]');const label=profiles.length+' 套配置 · '+profiles.filter(p=>p.enabled).length+' 套已启用';if(summary&&summary.textContent!==label)summary.textContent=label;
        overview.replaceChildren(...profiles.map(profile=>{const card=make('div','sa-overview-card');card.dataset.profileId=profile.id;card.dataset.editing=String(profile.id===activeId);const text=make('button','sa-profile-edit');text.type='button';text.setAttribute('aria-label','编辑 '+profile.name);const names=Object.keys(profile.routes).filter(k=>profile.routes[k]).map(k=>routeInfo[k]?.[0]||k);text.append(make('strong','',profile.name),make('small','',names.join(' · ')||'尚未分配功能'));text.addEventListener('click',()=>{capture();activeId=profile.id;render()});const power=make('button','sa-profile-power',profile.enabled?'已启用':'未启用');power.type='button';power.setAttribute('aria-pressed',String(profile.enabled));power.setAttribute('aria-label',(profile.enabled?'停用 ':'启用 ')+profile.name);power.addEventListener('click',()=>{capture();profile.enabled=!profile.enabled;if(profile.id===activeId){enabledEl.checked=profile.enabled;panel.style.display=profile.enabled?'block':'none';}renderLabels()});card.append(text,power);return card;}));
        if(!profiles.length)overview.append(make('p','sa-empty','点击 ＋ 添加副 API，可同时启用多套。'));
        routeInputs.forEach(input=>{const owner=profiles.find(p=>p.id!==activeId&&p.routes[input.dataset.secondaryRoute]);const badge=owners.get(input.dataset.secondaryRoute);badge.textContent=owner?owner.name+(owner.enabled?'':' · 停用'):'';badge.hidden=!owner;});
    }
    function render(){
        const p=current();group.dataset.empty=p?'false':'true';del.disabled=!p;naming.hidden=!p;enableRow.hidden=!p;footer.hidden=false;picker.disabled=!p;
        panel.style.display=p?.enabled?'block':'none';name.value=p?.name||'';enabledEl.checked=Boolean(p?.enabled);providerEl.value=p?.provider||'newapi';urlEl.value=p?.url||'';keyEl.value=p?.key||'';keyEl.type='password';
        const search=$('secondary-api-model-search');if(search)search.value='';
        const choices=[...(models.get(activeId)||[])];if(p?.model&&!choices.includes(p.model))choices.unshift(p.model);modelEl.replaceChildren(...choices.map(m=>new Option(m,m)));if(!choices.length)modelEl.append(new Option('请拉取模型',''));modelEl.value=p?.model||modelEl.options[0]?.value||'';
        routeInputs.forEach(input=>input.checked=Boolean(p?.routes[input.dataset.secondaryRoute]));fetchBtn.disabled=requests.has(activeId);fetchBtn.classList.toggle('loading',fetchBtn.disabled);renderLabels();
    }
    picker.addEventListener('change',()=>{capture();activeId=picker.value;render()});
    add.addEventListener('click',()=>{capture();const id=typeof crypto.randomUUID==='function'?'secondary_'+crypto.randomUUID():'secondary_'+Date.now()+'_'+Math.random().toString(36).slice(2);let i=1;while(profiles.some(p=>p.name==='副 API '+i))i++;const p=normalizeSecondaryApiProfile({id,name:'副 API '+i});profiles.push(p);activeId=id;render();name.focus()});
    del.addEventListener('click',async()=>{const p=current();if(!p)return;const id=p.id;const ok=await window.KissArchiveUI.confirm('api','删除「'+p.name+'」？其负责的功能会恢复原配置，保存后生效。');if(!ok)return;profiles=profiles.filter(p=>p.id!==id);models.delete(id);if(activeId===id)activeId=profiles[0]?.id||'';render()});
    name.addEventListener('input',()=>{const p=current();if(p&&name.value.trim()){p.name=name.value.trim();renderLabels()}});
    enabledEl.addEventListener('change',()=>{capture();panel.style.display=enabledEl.checked?'block':'none';renderLabels()});
    const providerUrls={newapi:'',deepseek:'https://api.deepseek.com',claude:'https://api.anthropic.com',gemini:'https://generativelanguage.googleapis.com'};
    providerEl.addEventListener('change',()=>{capture();const p=current();if(!p)return;p.url=providerUrls[p.provider]||'';p.model='';models.delete(p.id);render()});
    for(const field of [urlEl,keyEl,modelEl])field.addEventListener('change',capture);
    routeInputs.forEach(input=>input.addEventListener('change',()=>{capture();if(input.checked){let moved=false;profiles.forEach(p=>{if(p.id!==activeId&&p.routes[input.dataset.secondaryRoute]){p.routes[input.dataset.secondaryRoute]=false;moved=true}});if(moved)showToast('已改由当前配置负责，保存后生效');}renderLabels()}));
    secondaryApiEditor={read(){capture();const list=profiles.map(p=>({...p,routes:{...p.routes}}));const selected=current()||{enabled:false,provider:'newapi',url:'',key:'',model:'',routes:getDefaultSecondaryApiRoutes()};return {...selected,version:2,activeId,profiles:list};}};
    save.addEventListener('click',async()=>{if(saving)return;const secondary=readSecondaryApiSettings(),error=secondaryApiValidation(secondary);if(error)return showToast(error);saving=true;save.disabled=true;const previous=db.apiSettings;const next={...(previous||{}),secondary};db.apiSettings=next;try{await saveData();window.dispatchEvent(new CustomEvent('api-presets-updated'));window.KissDiagnostics?.record({app:'voice',feature:'副 API 分流',phase:'end',title:'副 API 配置已保存',detail:'配置数：'+secondary.profiles.length});showToast('副 API 配置已保存');}catch(error){if(db.apiSettings===next)db.apiSettings=previous;showToast('保存失败，请重试');}finally{saving=false;save.disabled=false}});
    fetchBtn.addEventListener('click',async()=>{
        capture();const p=current();if(!p||requests.has(p.id))return;const {id,provider,url,key}=p;
        if(!url||!key)return showToast('请先填写副 API 地址和密钥！');if(BLOCKED_API_DOMAINS.some(domain=>url.includes(domain)))return showToast('副 API 站点已被屏蔽，无法使用！');
        const request={provider,url,key};requests.set(id,request);renderLabels();fetchBtn.disabled=true;fetchBtn.classList.add('loading');
        try{const endpoint=provider==='gemini'?url+'/v1beta/models?key='+getRandomValue(key):url+'/v1/models';const response=await fetch(endpoint,{method:'GET',headers:provider==='gemini'?{}:{Authorization:'Bearer '+key}});if(!response.ok){const error=new Error('网络响应错误: '+response.status);error.response=response;throw error;}
            const data=await response.json(),values=(provider==='gemini'?(data.models||[]).map(item=>String(item.name||'').replace('models/','')):(data.data||[]).map(item=>item.id)).filter(m=>typeof m==='string'&&m);
            if(activeId===id)capture();const target=profiles.find(p=>p.id===id);if(!target||target.provider!==provider||target.url!==url||target.key!==key)return;
            models.set(id,[...new Set(values)]);if(!values.includes(target.model))target.model=values[0]||'';if(activeId===id)render();showToast(values.length?'副 API 模型列表拉取成功！':'未找到任何模型');
        }catch(error){if(activeId===id)showApiError(error);}finally{if(requests.get(id)===request)requests.delete(id);if(activeId===id){fetchBtn.disabled=false;fetchBtn.classList.remove('loading')}}
    });
    render();
}

// --- 预设管理 ---
function _getApiPresets() {
    return db.apiPresets || [];
}

function _createApiPresetId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return 'api_preset_' + window.crypto.randomUUID();
    }
    return 'api_preset_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

function _normalizeApiPresets(arr) {
    const usedIds = new Set();
    return (Array.isArray(arr) ? arr : []).map(preset => {
        const normalized = preset && typeof preset === 'object' ? preset : {};
        if (!normalized.id || usedIds.has(normalized.id)) {
            normalized.id = _createApiPresetId();
        }
        usedIds.add(normalized.id);
        return normalized;
    });
}

function _saveApiPresets(arr) {
    db.apiPresets = _normalizeApiPresets(arr);
    saveData();
    window.dispatchEvent(new CustomEvent('api-presets-updated'));
}

function populateApiSelect() {
    const sel = document.getElementById('api-preset-select');
    if (!sel) return;
    const needsMigration = _getApiPresets().some(p => !p || !p.id);
    const presets = _normalizeApiPresets(_getApiPresets());
    db.apiPresets = presets;
    if (needsMigration) saveData();
    sel.innerHTML = '<option value="">— 选择 API 预设 —</option>';
    presets.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.name;
    opt.textContent = p.name;
    sel.appendChild(opt);
    });
}

async function saveCurrentApiAsPreset() {
    const apiKeyEl = document.querySelector('#api-key');
    const apiUrlEl = document.querySelector('#api-url');
    const providerEl = document.querySelector('#api-provider');
    const modelEl = document.querySelector('#api-model');
    const tempEnabledSwitch = document.getElementById('temperature-enabled-switch');
    const tempSlider = document.getElementById('temperature-slider');

    const data = {
        apiKey: apiKeyEl ? apiKeyEl.value : '',
        apiUrl: apiUrlEl ? apiUrlEl.value : '',
        provider: providerEl ? providerEl.value : '',
        model: modelEl ? modelEl.value : '',
        temperatureEnabled: tempEnabledSwitch ? tempEnabledSwitch.checked : false,
        temperature: tempSlider ? parseFloat(tempSlider.value) : 1.0
    };
    
    let name = await window.KissArchiveUI.prompt('api', '为该 API 预设填写名称（会覆盖同名预设）：');
    if (!name) return;
    const presets = _getApiPresets();
    const idx = presets.findIndex(p => p.name === name);
    const preset = {id: idx >= 0 ? presets[idx].id : _createApiPresetId(), name: name, data: data};
    if (idx >= 0) presets[idx] = preset; else presets.push(preset);
    _saveApiPresets(presets);
    populateApiSelect();
    showToast('API 预设已保存');
}

async function applyApiPreset(name) {
    const presets = _getApiPresets();
    const p = presets.find(x => x.name === name);
    if (!p) return showToast('未找到该预设');
    try {
        const apiKeyEl = document.querySelector('#api-key');
        const apiUrlEl = document.querySelector('#api-url');
        const providerEl = document.querySelector('#api-provider');
        const modelEl = document.querySelector('#api-model');
        const tempEnabledSwitch = document.getElementById('temperature-enabled-switch');
        const tempSlider = document.getElementById('temperature-slider');
        const tempValue = document.getElementById('temperature-value');

        if (apiKeyEl && p.data && typeof p.data.apiKey !== 'undefined') apiKeyEl.value = p.data.apiKey;
        if (apiUrlEl && p.data && typeof p.data.apiUrl !== 'undefined') apiUrlEl.value = p.data.apiUrl;
        if (providerEl && p.data && typeof p.data.provider !== 'undefined') providerEl.value = p.data.provider;
        if (modelEl && p.data && typeof p.data.model !== 'undefined') {
            modelEl.innerHTML = `<option value="${p.data.model}">${p.data.model}</option>`;
            modelEl.value = p.data.model;
        }
        if (tempEnabledSwitch && p.data && typeof p.data.temperatureEnabled !== 'undefined') {
            tempEnabledSwitch.checked = p.data.temperatureEnabled;
            if (tempSlider) tempSlider.disabled = !tempEnabledSwitch.checked;
        }
        if (tempSlider && p.data && typeof p.data.temperature !== 'undefined') {
            tempSlider.value = p.data.temperature;
            if (tempValue) tempValue.textContent = p.data.temperature;
        }

        showToast('已应用 API 预设');
    } catch(e) {
        console.error('applyApiPreset error', e);
    }
}

function openApiManageModal() {
    const modal = document.getElementById('api-presets-modal');
    const list = document.getElementById('api-presets-list');
    if (!modal || !list) return;
    list.innerHTML = '';
    const presets = _getApiPresets();
    if (!presets.length) {
        list.innerHTML = '<p style="color:#888;margin:6px 0;">暂无预设</p>';
    }
    presets.forEach((p, idx) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '8px 6px';
        row.style.borderBottom = '1px solid #f6f6f6';

        const left = document.createElement('div');
        left.style.flex = '1';
        left.style.minWidth = '0';
        left.innerHTML = '<div style="font-weight:600;">'+p.name+'</div><div style="font-size:12px;color:#666;margin-top:4px;">' + (p.data && p.data.provider ? ('提供者：'+p.data.provider) : '') + '</div>';

        const btns = document.createElement('div');
        btns.style.display = 'flex';
        btns.style.gap = '6px';

        const applyBtn = document.createElement('button');
        applyBtn.className = 'btn';
        applyBtn.textContent = '应用';
        applyBtn.onclick = function(){ applyApiPreset(p.name); modal.style.display='none'; };

        const renameBtn = document.createElement('button');
        renameBtn.className = 'btn';
        renameBtn.textContent = '重命名';
        renameBtn.onclick = async function(){
            const newName = await window.KissArchiveUI.prompt('api', '输入新名称：', p.name);
            if (!newName) return;
            const all = _getApiPresets();
            all[idx].name = newName;
            _saveApiPresets(all);
            openApiManageModal();
            populateApiSelect();
        };

        const delBtn = document.createElement('button');
        delBtn.className = 'btn';
        delBtn.textContent = '删除';
        delBtn.onclick = async function(){ if(!await window.KissArchiveUI.confirm('api', '确定删除 "'+p.name+'" ?')) return; const all=_getApiPresets(); all.splice(idx,1); _saveApiPresets(all); openApiManageModal(); populateApiSelect(); };

        btns.appendChild(applyBtn); btns.appendChild(renameBtn); btns.appendChild(delBtn);

        row.appendChild(left); row.appendChild(btns);
        list.appendChild(row);
    });
    modal.style.display = 'flex';
}

function exportApiPresets() {
    const presets = _getApiPresets();
    const blob = new Blob([JSON.stringify(presets, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'api_presets.json'; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}
function importApiPresets() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json';
    inp.onchange = function(e){
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = function(){ try { const data = JSON.parse(r.result); if (Array.isArray(data)) { _saveApiPresets(data); populateApiSelect(); openApiManageModal(); } else window.KissArchiveUI.alert('api', '文件格式不正确'); } catch(e){ window.KissArchiveUI.alert('api', '导入失败：'+e.message); } };
        r.readAsText(f);
    };
    inp.click();
}


// Model filtering is local and never triggers another API request.
function chatModelMatches(value, query) {
    const normalize = text => String(text).normalize('NFKC').toLowerCase().replace(/[\s._/\-]+/g, '');
    const text = normalize(value);
    const tokens = String(query).trim().split(/\s+/).map(normalize).filter(Boolean);
    return tokens.every(token => {
        if (text.includes(token)) return true;
        let at = 0;
        for (const ch of text) if (ch === token[at]) at++;
        return at === token.length;
    });
}
function setupChatModelSearch(selectId, inputId) {
    const select = document.getElementById(selectId);
    if (!select || document.getElementById(inputId)) return;
    const item = select.closest('.kkt-item');
    if (!item) return;
    const row = document.createElement('div'); row.className = 'kkt-item kv-model-search-row';
    row.innerHTML = `<label class="kv-chat-search"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="10" r="6"></circle><path d="m15 15 5 5"></path></svg><input id="${inputId}" type="search" autocomplete="off" placeholder="搜索模型名称…" aria-label="模糊搜索聊天模型"><span class="kv-chat-model-count" aria-live="polite"></span></label>`;
    item.before(row);
    const input = row.querySelector('input'), count = row.querySelector('.kv-chat-model-count');
    let all = [], selected = select.value, observer;
    const read = () => {
        all = Array.from(select.options).filter(option => option.value).map(option => ({value:option.value, text:option.textContent}));
        selected = select.value;
        filter();
    };
    const filter = () => {
        const matches = all.filter(option => chatModelMatches(option.value + ' ' + option.text, input.value));
        const active = all.find(option => option.value === selected);
        observer?.disconnect();
        select.replaceChildren(...matches.map(option => new Option(option.text, option.value)));
        if (active && !matches.some(option => option.value === selected)) {
            const option = new Option(active.text + '（当前）', active.value); option.hidden = true; select.prepend(option);
        }
        if (active) select.value = selected;
        else if (!matches.length) select.append(new Option('没有匹配的模型', ''));
        count.textContent = all.length ? matches.length + ' / ' + all.length : '—';
        count.setAttribute('aria-label', `匹配 ${matches.length} 个，共 ${all.length} 个模型`);
        observer?.observe(select, {childList:true});
    };
    observer = new MutationObserver(read);
    input.addEventListener('input', filter);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); select.focus(); } });
    select.addEventListener('change', () => { selected = select.value; });
    read();
}
