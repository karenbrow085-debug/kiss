/* Optional character references. No Vibe settings are rewritten here. */
window.KissWorkshopFaceLock = (() => {
    // Official docs checked 2026-10-31: Precise Reference is V4.5-only.
    // https://docs.novelai.net/en/image/precisereference/
    // Multiple character references blend; they are not per-character slots.
    const imageModels = new Set(['nai-diffusion-4-5-full','nai-diffusion-4-5-curated']);
    const noImageModels = new Set(['nai-diffusion-5-full','nai-diffusion-5-curated','nai-diffusion-4-full','nai-diffusion-4-curated-preview','nai-diffusion-4-curated','nai-diffusion-3','nai-diffusion-furry-3','nai-diffusion-3-furry','nai-diffusion-2','nai-diffusion-furry','safe-diffusion']);
    const supported = model => imageModels.has(model);
    const gptSupported = model => /^gpt-image-\d+(?:[.-]|$)/i.test(model || '') || model === 'chatgpt-image-latest';
    const clamp = (value, fallback) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : fallback;
    function imageEndpoint(apiUrl,operation) {
        const url=new URL(apiUrl),path=url.pathname.replace(/\/+$/,'');
        url.pathname=/\/images\/(generations|edits)$/.test(path)
            ? path.replace(/(generations|edits)$/,operation)
            : path+(path.endsWith('/v1')?'':'/v1')+'/images/'+operation;
        url.hash='';return url.href;
    }
    function capability(settings) {
        if (settings.provider === 'gpt') return gptSupported(settings.gptModel)
            ? {kind:'image',label:'脸部图片参考',note:'GPT Image 使用图片编辑接口，仅发送已确认的脸部裁剪。'}
            : {kind:'unavailable',label:'尚未接通图片参考',note:'此 GPT 型号未接通身份参考；请选用支持图片编辑的 GPT Image 模型。'};
        const preset = settings.apiPresets?.novelai?.find(p => p.id === settings.activeApiPresetId?.novelai);
        if (supported(settings.novelaiModel) && preset?.protocol !== 'openai') {
            return {kind:'image',label:'脸部图片参考',note:'官方人物参考仅支持 V4.5 Full / Curated，与 Vibe 互斥。参考全局生效，请用于单角色画面，不能给多人分别锁脸。'};
        }
        return {kind:'text',label:'五官词绑定（不是图片锁脸）',note:preset?.protocol === 'openai'
            ? '当前使用 OpenAI 兼容协议：仅绑定五官描述，不发送参考图。'
            : noImageModels.has(settings.novelaiModel)
                ? '官方人物图片参考仅支持 V4.5 系列；此型号只使用五官词，不发送图片，也不是图片锁脸。'
                : '手填型号的图片参考能力未核实；仅使用五官词，不发送图片。'};
    }
    function matching(settings, prompt) {
        const source = String(prompt);
        return (settings.boundCharacters || []).map(bound => {
            const char = db.characters.find(c => c.id === bound.charId);
            return {bound,index:char?.realName ? source.indexOf('{{' + char.realName + '}}') : -1};
        }).filter(row => row.index >= 0 && row.bound.faceLock?.enabled).sort((a,b) => a.index-b.index).map(row => row.bound);
    }
    function validate(settings, prompt) {
        const refs = matching(settings, prompt);
        if (!refs.length) return refs;
        const names=refs.map(bound => db.characters.find(c=>c.id===bound.charId)?.realName);
        if (new Set(names).size !== names.length) throw new Error('多个已绑定角色使用了相同的真名变量，请先设置不同的角色真名，避免参考图或五官词串用。');
        const mode = capability(settings);
        if (mode.kind === 'text') {
            if (refs.some(bound => !String(bound.faceLock.faceDescription || '').trim())) throw new Error('当前型号使用五官词绑定，不发送参考图。请在角色的脸部绑定设置填写五官描述（不是穿搭或发型）。');
            return refs;
        }
        const provider = settings.provider || 'novelai';
        if (provider === 'gpt') {
            if (!gptSupported(settings.gptModel)) throw new Error('GPT 锁脸需要支持图片编辑的 GPT Image 模型；DALL·E 不支持此锁脸方式。');
            if (refs.length > 16) throw new Error('GPT 一次最多使用 16 张脸部参考图。');
        } else {
            const represented=new Set((settings.boundCharacters || []).filter(bound=>{
                const name=db.characters.find(c=>c.id===bound.charId)?.realName;
                return name && String(prompt).includes('{{'+name+'}}');
            }).map(bound=>bound.charId));
            if (refs.length>1 || represented.size>1) throw new Error('NAI 人物参考是全图引导，多角色参考会混脸，不能分别锁脸。请改成单角色画面，或关闭图片锁脸后使用角色提示词。');
            if (settings.vibe?.enabled && settings.vibe.activeImageId) {
                throw new Error('NAI 锁脸参考与 Vibe 不能同时发送。请自行选择关闭其中一个；当前素材与设置会保留。');
            }
        }
        if (refs.some(bound => !bound.faceLock.image)) throw new Error('锁脸已开启，请先为该角色添加参考图。');
        if (refs.some(bound => !bound.faceLock.faceOnly)) throw new Error('请先在角色锁脸设置裁剪并确认脸部，只发送五官参考，不发送整套造型。');
        if (refs.some(bound => !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(bound.faceLock.image))) throw new Error('脸部参考图数据损坏，请重新上传并裁剪');
        return refs;
    }
    function textBindings(settings, prompt) {
        if (capability(settings).kind !== 'text') return [];
        return validate(settings,prompt).map(bound => ({
            charId:bound.charId,
            name:db.characters.find(c => c.id === bound.charId)?.realName || '',
            description:String(bound.faceLock.faceDescription).trim()
        }));
    }
    async function gptRequest(settings, originalPrompt, payload, apiUrl) {
        const refs = validate(settings, originalPrompt);
        if (!refs.length) return null;
        const mapping = refs.map((bound,index) => {
            const char = db.characters.find(c => c.id === bound.charId);
            return `Image ${index+1} is the facial identity reference for ${char.realName}.`;
        }).join('\n');
        const prompt = `${payload.prompt}\n\n[Face reference instructions]\n${mapping}\nUse the reference images ONLY for facial identity: facial proportions, eyes, nose, mouth and facial marks. Generate a NEW complete scene as described above. Do not copy the reference hairstyle, hair color, clothing, accessories, body, pose, expression, background, lighting, composition or art style. All of those must follow the current scene prompt; change them freely when it asks. Do not turn the scene into a reference portrait. Keep each person's identity separate.`;
        const size = /^gpt-image-1(?:[.-]|$)/i.test(payload.model)
            ? ({'1024x1792':'1024x1536','1792x1024':'1536x1024'}[payload.size] || payload.size) : payload.size;
        const fields = {model:payload.model,prompt,n:1,size};
        if (/^gpt-image-1-mini(?:-|$)/i.test(payload.model)) fields.input_fidelity = 'low';
        else if (/^gpt-image-1(?:\.5)?(?:-|$)/i.test(payload.model)) fields.input_fidelity = 'high';
        // Newer GPT Image models do not accept input_fidelity. Do not fake a slider.
        if (settings.gptQuality) fields.quality = ({hd:'high',standard:'medium'}[settings.gptQuality] || settings.gptQuality);
        const body = new FormData();
        Object.entries(fields).forEach(([key,value]) => { if (value != null) body.append(key,String(value)); });
        refs.forEach((bound,index) => {
            const data = bound.faceLock.image;
            const raw = atob(data.slice(data.indexOf(',')+1));
            const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
            body.append('image[]',new Blob([bytes],{type:'image/png'}),`face-${index+1}.png`);
        });
        return {url:imageEndpoint(apiUrl,'edits'),body,fields};
    }
    async function normaliseImage(source) {
        const img = new Image();
        await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('参考图无法读取，请重新上传 JPG 或 PNG 图片')); img.src = source; });
        const ratio = img.naturalWidth / img.naturalHeight;
        const sizes = [[1024,1536],[1536,1024],[1472,1472]];
        const [width,height] = sizes.reduce((best,size) => Math.abs(Math.log(ratio/(size[0]/size[1]))) < Math.abs(Math.log(ratio/(best[0]/best[1]))) ? size : best);
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000'; ctx.fillRect(0,0,width,height);
        const scale = Math.min(width/img.naturalWidth,height/img.naturalHeight);
        const w = img.naturalWidth*scale, h = img.naturalHeight*scale;
        ctx.drawImage(img,(width-w)/2,(height-h)/2,w,h);
        return canvas.toDataURL('image/png');
    }
    async function apply(settings, originalPrompt, parameters) {
        const refs = validate(settings, originalPrompt);
        if (!refs.length || capability(settings).kind !== 'image') return;
        // Only confirmed face crops reach either backend; outfits are not stored.
        parameters.director_reference_images = refs.map(b => b.faceLock.image.split(',')[1]);
        parameters.director_reference_descriptions = refs.map(() => ({caption:{base_caption:'character',char_captions:[]},legacy_uc:false}));
        parameters.director_reference_information_extracted = refs.map(() => 1);
        parameters.director_reference_strength_values = refs.map(b => clamp(b.faceLock.strength, .65));
        parameters.director_reference_secondary_strength_values = refs.map(b => 1-clamp(b.faceLock.fidelity,.8));
    }
    function init() {
        const list = document.getElementById('workshop-char-list');
        if (!list || list.dataset.faceLock) return;
        list.dataset.faceLock = 'true';
        function decorate() {
            const visible = (db.workshopSettings.boundCharacters || []).filter(b => db.characters.some(c => c.id === b.charId));
            [...list.children].forEach((item,index) => {
                if (!item.querySelector('.char-prompt-input')) return;
                const bound = visible[index];
                if (!bound) return;
                let button = item.querySelector('.atelier-lock-open');
                if (!button) {
                    button = document.createElement('button');
                    button.type = 'button'; button.className = 'atelier-lock-open';
                    button.addEventListener('click', () => open(bound, button));
                    item.append(button);
                }
                const label = capability(db.workshopSettings).kind === 'text' ? '五官绑定' : '锁脸';
                button.textContent = bound.faceLock?.enabled ? label + ' · 已开启' : label;
            });
        }
        const status = document.createElement('p');
        status.className = 'atelier-lock-note atelier-face-mode';status.hidden=true;
        document.getElementById('workshop-model-select-row')?.after(status);
        const refresh = () => {
            const settings = db.workshopSettings, mode = capability(settings);
            status.hidden = !(settings.boundCharacters || []).some(b => b.faceLock?.enabled);
            status.textContent = '当前脸部绑定：' + mode.label;
            decorate();
        };
        decorate();
        new MutationObserver(decorate).observe(list,{childList:true});
        window.addEventListener('kiss-nai-model-changed',refresh);
        document.addEventListener('workshop-api-protocol-change',refresh);
        document.getElementById('drawing-workshop-screen')?.addEventListener('change',refresh);
        window.addEventListener('kiss-face-binding-changed',refresh);
        refresh();
    }
    function open(bound, opener) {
        const root = document.getElementById('drawing-workshop-screen');
        const char = db.characters.find(c => c.id === bound.charId);
        const draft = {...(bound.faceLock || {enabled:false,strength:.65,fidelity:.8})};
        const mode = capability(db.workshopSettings);
        const panel = document.createElement('section');
        panel.className = 'atelier-lock-panel';
        panel.setAttribute('aria-label', '角色脸部绑定设置');
        panel.innerHTML = `<div class="atelier-lock-header"><button type="button" data-close>取消</button><strong>脸部绑定</strong><button type="button" data-save>保存</button></div>
            <div class="atelier-banner"><div class="atelier-wordmark">Character link.</div><div class="atelier-kicker">IDENTITY REFERENCE</div></div>
            <div class="atelier-lock-content"><div class="atelier-lock-row"><strong data-name></strong><label class="kkt-switch"><input type="checkbox" data-enabled><span class="kkt-slider"></span></label></div>
            <p class="atelier-lock-note" data-variable></p><p class="atelier-lock-note" data-mode-label></p>
            <label class="atelier-face-description">五官描述<textarea rows="3" data-face-description placeholder="只写脸型、眼型/瞳色、鼻子、嘴唇、面部痣等，不填穿搭或发型"></textarea></label>
            <p class="atelier-lock-note" data-description-note></p>
            <details data-photo-area><summary>脸部参考图</summary><img class="atelier-lock-portrait" alt="角色参考图" hidden>
            <div class="atelier-lock-actions"><label class="btn" tabindex="0" data-upload-label>添加参考图<input type="file" accept="image/png,image/jpeg,image/webp" hidden data-file></label><button type="button" class="btn" data-crop>裁剪脸部</button><button type="button" class="btn" data-remove>删除</button></div>
            <p class="atelier-lock-note" data-crop-status></p></details>
            <label class="atelier-lock-row" data-nai-option>参考强度<input type="range" min="0" max="1" step=".01" data-strength><output data-strength-value></output></label>
            <label class="atelier-lock-row" data-nai-option>五官保留<input type="range" min="0" max="1" step=".01" data-fidelity><output data-fidelity-value></output></label>
            <p class="atelier-lock-note">只绑定面部特征；穿搭、发型、姿势和场景继续跟随当次提示词。效果仍由模型决定。</p>
            <p class="atelier-lock-note" data-model-note></p></div>`;
        const $ = selector => panel.querySelector(selector);
        $('[data-name]').textContent = char.remarkName || char.name || char.realName;
        $('[data-variable]').textContent = '提示词包含 {{' + char.realName + '}} 时触发此角色的脸部绑定。';
        const gpt = db.workshopSettings.provider === 'gpt';
        panel.querySelectorAll('[data-nai-option]').forEach(row => { row.hidden = gpt || mode.kind !== 'image'; });
        $('[data-mode-label]').textContent = '当前方式：' + mode.label;
        $('[data-model-note]').textContent = mode.note;
        $('[data-photo-area]').open = mode.kind === 'image';
        $('[data-face-description]').value = draft.faceDescription || '';
        $('[data-face-description]').oninput = e => { draft.faceDescription=e.target.value; };
        $('[data-description-note]').textContent = mode.kind === 'text' ? '此型号必填，仅写五官；不发送参考图。' : '供五官词绑定的型号使用；图片参考模式不注入此段文字。';
        $('[data-enabled]').checked = !!draft.enabled;
        $('[data-enabled]').onchange = e => { draft.enabled = e.target.checked; };
        for (const field of ['strength','fidelity']) {
            const input = $('[data-'+field+']');
            input.value = clamp(draft[field],field === 'strength' ? .65 : .8);
            const update = () => { draft[field] = Number(input.value); $('[data-'+field+'-value]').textContent = Number(input.value).toFixed(2); };
            input.oninput = update; update();
        }
        function showImage() {
            const image = $('.atelier-lock-portrait');
            image.hidden = !draft.image;
            if (draft.image) image.src = draft.image; else image.removeAttribute('src');
            $('[data-upload-label]').firstChild.textContent = draft.image ? '替换参考图' : '添加参考图';
            $('[data-remove]').hidden = !draft.image;
            $('[data-crop]').hidden = !draft.image;
            $('[data-crop-status]').textContent = !draft.image ? '' : draft.faceOnly ? '已确认脸部裁剪；仅发送这里显示的脸部区域。' : '旧参考图尚未裁剪，请先框选脸部，避免锁住穿搭。';
        }
        let importing = false, saving = false;
        function setBusy(busy) {
            panel.querySelectorAll('button,input,textarea').forEach(control => { control.disabled=busy; });
        }
        $('[data-file]').onchange = async e => {
            const file = e.target.files[0]; if (!file) return;
            if (importing || saving) return;
            importing = true; setBusy(true);
            try {
                if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 20*1024*1024) throw new Error('请选择 20MB 以内的 JPG、PNG 或 WebP 图片');
                const data = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(file); });
                const cropped = await cropFace(panel,data);
                if (cropped) { draft.image = await normaliseImage(cropped); draft.faceOnly = true; showImage(); }
            } catch(error) { showToast(error.message || '参考图读取失败'); }
            finally { importing=false; setBusy(false); e.target.value=''; $('[data-save]').focus(); }
        };
        $('[data-upload-label]').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('[data-file]').click(); } };
        $('[data-crop]').onclick = async () => {
            if (importing || saving) return;
            importing=true; setBusy(true);
            try { const cropped = await cropFace(panel,draft.image); if (cropped) { draft.image=await normaliseImage(cropped); draft.faceOnly=true; showImage(); } }
            catch(error) { showToast(error.message || '裁剪失败'); }
            finally { importing=false; setBusy(false); $('[data-save]').focus(); }
        };
        $('[data-remove]').onclick = () => { if(importing || saving)return;delete draft.image; delete draft.faceOnly; showImage(); };
        $('[data-close]').onclick = () => { if(importing || saving)return;panel.remove(); opener.focus(); };
        panel.addEventListener('keydown',event=>{
            const crop=panel.querySelector('.atelier-face-crop');
            if(event.key==='Escape') {event.preventDefault();if(crop)crop.querySelector('[data-crop-cancel]').click();else $('[data-close]').click();}
            if(event.key==='Tab') {
                const scope=crop || panel;
                const fields=[...scope.querySelectorAll('button,input,textarea,summary,[tabindex="0"]')].filter(el=>!el.disabled && el.getClientRects().length);
                const first=fields[0],last=fields.at(-1);
                if(event.shiftKey && document.activeElement===first) {event.preventDefault();last?.focus();}
                else if(!event.shiftKey && document.activeElement===last) {event.preventDefault();first?.focus();}
            }
        });
        $('[data-save]').onclick = async () => {
            if (importing || saving) return;
            const currentMode=capability(db.workshopSettings);
            if (draft.enabled && currentMode.kind === 'text' && !String(draft.faceDescription || '').trim()) { showToast('请先填写五官描述；此型号不发送参考图'); return; }
            if (draft.enabled && currentMode.kind === 'image' && !draft.image) { showToast('请先添加参考图'); return; }
            if (draft.enabled && currentMode.kind === 'image' && !draft.faceOnly) { showToast('请先裁剪并确认脸部区域'); return; }
            if (draft.enabled && currentMode.kind === 'unavailable') { showToast(currentMode.note); return; }
            const previous = bound.faceLock;
            const submitted={...draft};bound.faceLock = submitted;
            saving=true;setBusy(true);
            try { if(await saveData()===false)throw new Error('未保存');window.dispatchEvent(new Event('kiss-face-binding-changed')); panel.remove(); opener.focus(); }
            catch(error) { if(bound.faceLock===submitted){if(previous===undefined)delete bound.faceLock;else bound.faceLock=previous;}saving=false;setBusy(false);showToast('保存失败，请重试'); }
        };
        showImage(); root.append(panel); $('[data-close]').focus();
    }
    async function cropFace(parent, source) {
        const image = new Image();
        await new Promise((resolve,reject) => { image.onload=resolve; image.onerror=()=>reject(new Error('参考图无法读取')); image.src=source; });
        return new Promise((resolve,reject) => {
            const editor = document.createElement('section');
            editor.className = 'atelier-face-crop';
            editor.setAttribute('aria-label','裁剪脸部参考');
            editor.innerHTML = '<div class="atelier-lock-header"><button type="button" data-crop-cancel>取消</button><strong>只框选五官</strong><button type="button" data-crop-confirm>使用此区域</button></div><p class="atelier-lock-note">拖动方框选中脸型与五官，拖右下角调整大小。避开头发、衣领和配饰。</p><div class="atelier-crop-stage"><img alt="待裁剪参考图"><div class="atelier-crop-box"><button type="button" class="atelier-crop-handle" aria-label="调整裁剪大小"></button></div></div><label class="atelier-lock-row">区域大小<input type="range" min=".08" max="1" step=".01" data-crop-size></label><div class="atelier-crop-nudge"><button type="button" data-move="0,-1" aria-label="向上移动">上移</button><button type="button" data-move="-1,0" aria-label="向左移动">左移</button><button type="button" data-move="1,0" aria-label="向右移动">右移</button><button type="button" data-move="0,1" aria-label="向下移动">下移</button></div>';
            const img = editor.querySelector('img'); img.src=source;
            const stage=editor.querySelector('.atelier-crop-stage'), box=editor.querySelector('.atelier-crop-box');
            const maxSide=Math.min(image.naturalWidth,image.naturalHeight);
            let side=maxSide*.45, left=(image.naturalWidth-side)/2, top=Math.min(image.naturalHeight-side,image.naturalHeight*.12);
            const slider=editor.querySelector('[data-crop-size]');
            function paint() {
                side=Math.max(maxSide*.08,Math.min(maxSide,side));
                left=Math.max(0,Math.min(image.naturalWidth-side,left)); top=Math.max(0,Math.min(image.naturalHeight-side,top));
                box.style.left=100*left/image.naturalWidth+'%'; box.style.top=100*top/image.naturalHeight+'%';
                box.style.width=100*side/image.naturalWidth+'%'; box.style.height=100*side/image.naturalHeight+'%';
                slider.value=String(side/maxSide);
            }
            let drag;
            box.onpointerdown = event => {
                event.preventDefault(); box.setPointerCapture(event.pointerId);
                drag={x:event.clientX,y:event.clientY,left,top,side,resize:event.target.closest('.atelier-crop-handle')!=null};
            };
            box.onpointermove = event => {
                if (!drag) return;
                const scale=image.naturalWidth/stage.getBoundingClientRect().width;
                const dx=(event.clientX-drag.x)*scale,dy=(event.clientY-drag.y)*scale;
                if (drag.resize) side=Math.min(image.naturalWidth-drag.left,image.naturalHeight-drag.top,drag.side+(Math.abs(dx)>Math.abs(dy)?dx:dy)); else { left=drag.left+dx; top=drag.top+dy; }
                paint();
            };
            box.onpointerup=box.onpointercancel=()=>{drag=null;};
            slider.oninput=()=>{side=Number(slider.value)*maxSide;paint();};
            editor.querySelectorAll('[data-move]').forEach(button=>{button.onclick=()=>{const [x,y]=button.dataset.move.split(',').map(Number);left+=x*maxSide*.03;top+=y*maxSide*.03;paint();};});
            editor.querySelector('[data-crop-cancel]').onclick=()=>{editor.remove();resolve(null);};
            editor.querySelector('[data-crop-confirm]').onclick=()=>{
                try {
                const canvas=document.createElement('canvas'); canvas.width=canvas.height=768;
                const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,768,768);
                ctx.drawImage(image,left,top,side,side,0,0,768,768);
                const result=canvas.toDataURL('image/png');editor.remove();resolve(result);
                } catch(error) {editor.remove();reject(error);}
            };
            parent.append(editor);paint();editor.querySelector('[data-crop-confirm]').focus();
        });
    }
    return {init,matching,validate,apply,supported,gptSupported,gptRequest,normaliseImage,capability,textBindings,imageEndpoint};
})();
