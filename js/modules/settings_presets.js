// --- 预设管理逻辑 (气泡、人设、字体、提示音、全局CSS) ---

function _getBubblePresets() {
    return db.bubbleCssPresets || [];
}
function _saveBubblePresets(arr) {
    db.bubbleCssPresets = arr || [];
    saveData();
}

// 黑白预设搜索：保留原 select，继续使用原来的应用和导入导出入口。
const bubblePresetSearchUI = (() => {
    let modal, input, list, count, clear, source, returnFocus;
    const buttons = new Map();
    const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
    function score(name, query) {
        const text = normalize(name), q = normalize(query);
        if (!q) return 1;
        if (text === q) return 4;
        if (text.includes(q)) return 3;
        let i = 0;
        for (const char of text) if (char === q[i]) i++;
        return i === q.length ? 2 : 0;
    }
    function ensureModal() {
        if (modal) return;
        const style = document.createElement('style');
        style.textContent = `
        .bps-trigger{appearance:none!important;display:flex!important;align-items:center;gap:8px;min-width:108px;max-width:180px;padding:6px 10px!important;border:1px solid #ddd!important;border-radius:9px!important;background:#fff!important;color:#111!important;font:inherit;font-size:12px;cursor:pointer}
        .bps-trigger span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}.bps-trigger svg{flex:none}
        .bps-overlay{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.32);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;font-family:inherit;color:#111;color-scheme:light}
        .bps-overlay[hidden]{display:none!important}
        .bps-dialog{width:100%;max-width:380px;max-height:calc(100dvh - 32px);display:flex;flex-direction:column;box-sizing:border-box;background:#fff;border:1px solid #e6e6e6;border-radius:20px;box-shadow:0 16px 60px #0002;overflow:hidden}
        .bps-dialog *{box-sizing:border-box}.bps-header{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 14px}.bps-kicker{font-size:10px;letter-spacing:2px;color:#888;margin-bottom:5px}.bps-title{font-size:19px;font-weight:650;margin:0;color:#111}
        .bps-icon{border:0!important;background:transparent!important;color:#111!important;width:32px;height:32px;border-radius:50%;padding:7px!important;cursor:pointer;display:grid;place-items:center}.bps-icon:hover{background:#eee!important}
        .bps-search{display:flex;align-items:center;gap:8px;margin:0 20px;border:1px solid #e1e1e1;border-radius:999px;background:#f5f5f5;padding:4px 8px 4px 13px;flex:none}.bps-search:focus-within{border-color:#111;background:#fff}.bps-search svg{flex:none;color:#777}
        .bps-input{width:100%;min-width:0;appearance:none!important;background:transparent!important;border:0!important;box-shadow:none!important;outline:none!important;padding:7px 0!important;color:#111!important;font:inherit;font-size:16px!important;border-radius:0!important}.bps-input::placeholder{color:#999}
        .bps-count{padding:14px 22px 8px;font-size:10px;color:#888;letter-spacing:1px;flex:none}.bps-list{overflow-y:auto;overscroll-behavior:contain;min-height:0;max-height:46dvh;padding:0 10px 10px;-webkit-overflow-scrolling:touch}
        .bps-row{display:flex;align-items:center;gap:10px;border-bottom:1px solid #f0f0f0;padding:5px 0}.bps-name{flex:1;min-width:0;border:0!important;background:transparent!important;color:#111!important;text-align:left!important;padding:10px!important;font:inherit;font-size:13px;line-height:1.5;overflow-wrap:anywhere;cursor:pointer;border-radius:8px!important}.bps-name small{display:block;font-size:10px;color:#888;margin-top:2px}.bps-name:hover{background:#f5f5f5!important}.bps-row.is-selected .bps-name{font-weight:650}
        .bps-apply{flex:none;background:#111!important;color:#fff!important;border:0!important;border-radius:999px!important;padding:7px 12px!important;font:inherit;font-size:11px;cursor:pointer;margin-right:8px}.bps-apply:hover{background:#333!important}.bps-empty{padding:35px 10px;text-align:center;font-size:13px;color:#888}.bps-footer{padding:12px 20px 16px;border-top:1px solid #eee;color:#999;font-size:10px;letter-spacing:.4px}.bps-dialog button:focus-visible{outline:2px solid #111;outline-offset:2px}
        @media(max-width:480px){.bps-overlay{align-items:flex-end;padding:12px;padding-bottom:max(12px,env(safe-area-inset-bottom))}.bps-dialog{max-width:100%;border-radius:22px}.bps-list{max-height:42dvh}}
        `;
        document.head.appendChild(style);
        modal = document.createElement('div');
        modal.className = 'bps-overlay'; modal.hidden = true;
        modal.innerHTML = `<section class="bps-dialog" role="dialog" aria-modal="true" aria-labelledby="bps-title"><header class="bps-header"><div><div class="bps-kicker">YOUR COLLECTION</div><h2 class="bps-title" id="bps-title">选择美化预设</h2></div><button class="bps-icon bps-close" type="button" aria-label="关闭"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="bps-search"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input class="bps-input" type="text" inputmode="search" placeholder="输入名称的部分字样…" aria-label="搜索美化预设" autocomplete="off"><button class="bps-icon bps-clear" type="button" aria-label="清空搜索">×</button></div><div class="bps-count" aria-live="polite"></div><div class="bps-list"></div><footer class="bps-footer">点击名称选择 · 点击应用直接使用</footer></section>`;
        document.body.appendChild(modal);
        input = modal.querySelector('input'); list = modal.querySelector('.bps-list'); count = modal.querySelector('.bps-count'); clear = modal.querySelector('.bps-clear');
        input.addEventListener('input', render);
        clear.onclick = () => { input.value = ''; render(); input.focus(); };
        modal.querySelector('.bps-close').onclick = close;
        modal.addEventListener('click', event => { if (event.target === modal) close(); });
        modal.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); close(); }
            if (event.key === 'Enter' && event.target === input) { event.preventDefault(); list.querySelector('.bps-name')?.click(); }
            if (event.key === 'Tab') {
                const focusable = [...modal.querySelectorAll('button,input')].filter(el => !el.disabled && el.getClientRects().length);
                const first = focusable[0], last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        });
    }
    function close() {
        if (!modal) return;
        modal.hidden = true;
        returnFocus?.setAttribute('aria-expanded', 'false');
        if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
        source = null;
    }
    function choose(name, apply) {
        if (!source) return;
        const select = source;
        select.value = name;
        select.dispatchEvent(new Event('change', {bubbles:true}));
        sync(select);
        close();
        if (apply) applyPresetToCurrentChat(name);
    }
    function render() {
        if (!source) return;
        const query = input.value;
        const presets = _getBubblePresets();
        const results = presets.map((preset, index) => ({preset,index,rank:score(preset.name,query)})).filter(item => item.rank).sort((a,b) => b.rank-a.rank || a.index-b.index);
        count.textContent = `${results.length} / ${presets.length} PRESETS`;
        clear.style.visibility = query ? 'visible' : 'hidden';
        list.replaceChildren(); list.scrollTop = 0;
        if (!results.length) {
            const empty = document.createElement('div'); empty.className = 'bps-empty';
            empty.textContent = presets.length ? '没有匹配的预设，换个字试试' : '还没有预设，可以先导入或保存';
            list.appendChild(empty); return;
        }
        results.forEach(({preset}) => {
            const row = document.createElement('div'); row.className = 'bps-row' + (source.value === preset.name ? ' is-selected' : '');
            const name = document.createElement('button'); name.type = 'button'; name.className = 'bps-name'; name.textContent = preset.name;
            if (source.value === preset.name) { const note = document.createElement('small'); note.textContent = '已选择'; name.appendChild(note); }
            name.onclick = () => choose(preset.name,false);
            const apply = document.createElement('button'); apply.type = 'button'; apply.className = 'bps-apply'; apply.textContent = '应用'; apply.setAttribute('aria-label',`应用 ${preset.name}`); apply.onclick = () => choose(preset.name,true);
            row.append(name,apply); list.appendChild(row);
        });
    }
    function sync(select) {
        const button = buttons.get(select);
        if (button) button.querySelector('span').textContent = select.value || '选择预设';
        if (source === select && !modal.hidden) render();
    }
    function attach(select) {
        if (buttons.has(select)) { sync(select); return; }
        ensureModal();
        const button = document.createElement('button'); button.type = 'button'; button.className = 'bps-trigger'; button.setAttribute('aria-haspopup','dialog'); button.setAttribute('aria-expanded','false');
        button.innerHTML = '<span>选择预设</span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg>';
        select.hidden = true; select.style.setProperty('display','none','important'); select.after(button); buttons.set(select,button);
        select.addEventListener('change',() => sync(select));
        button.onclick = () => { source = select; returnFocus = button; input.value = ''; modal.hidden = false; button.setAttribute('aria-expanded','true'); render(); input.focus({preventScroll:true}); };
        sync(select);
    }
    return {attach};
})();

function populateBubblePresetSelect(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const previous = sel.value;
    const presets = _getBubblePresets();
    sel.innerHTML = '<option value="">— 选择预设 —</option>';
    presets.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name; opt.textContent = p.name; sel.appendChild(opt);
    });
    if (presets.some(p => p.name === previous)) sel.value = previous;
    bubblePresetSearchUI.attach(sel);
}

async function applyPresetToCurrentChat(presetName) {
    const presets = _getBubblePresets();
    const preset = presets.find(p => p.name === presetName);
    if (!preset) { showToast('未找到该预设'); return; }
    
    let textarea;
    let authorNoteDiv;
    if (currentChatType === 'private') {
        textarea = document.getElementById('setting-custom-bubble-css');
        authorNoteDiv = document.getElementById('private-bubble-author-note');
    } else {
        textarea = document.getElementById('setting-group-custom-bubble-css');
        authorNoteDiv = document.getElementById('group-bubble-author-note');
    }
    if (textarea) textarea.value = preset.css;
    
    if (authorNoteDiv) {
        if (preset.authorNote && preset.authorNote.trim() !== '') {
            authorNoteDiv.textContent = `作者注释：${preset.authorNote}`;
            authorNoteDiv.style.display = 'block';
        } else {
            authorNoteDiv.style.display = 'none';
            authorNoteDiv.textContent = '';
        }
    }

    try {
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
        if (chat) {
            chat.customBubbleCss = preset.css;
            chat.useCustomBubbleCss = true;
            if (currentChatType === 'private') {
                document.getElementById('setting-use-custom-css').checked = true;
                document.getElementById('setting-custom-bubble-css').disabled = false;
            } else {
                document.getElementById('setting-group-use-custom-css').checked = true;
                document.getElementById('setting-group-custom-bubble-css').disabled = false;
            }
            
            if (preset.settings) {
                if (preset.settings.theme !== undefined) chat.theme = preset.settings.theme;
                if (preset.settings.chatBg !== undefined) {
                    chat.chatBg = preset.settings.chatBg;
                    const chatRoomScreen = document.getElementById('chat-room-screen');
                    if (chatRoomScreen) {
                        if (chat.chatBg) {
                            chatRoomScreen.style.backgroundImage = `url(${chat.chatBg})`;
                        } else {
                            chatRoomScreen.style.backgroundImage = '';
                        }
                    }
                }
                if (preset.settings.bilingualModeEnabled !== undefined) chat.bilingualModeEnabled = preset.settings.bilingualModeEnabled;
                if (preset.settings.bilingualBubbleStyle !== undefined) chat.bilingualBubbleStyle = preset.settings.bilingualBubbleStyle;
                if (preset.settings.avatarMode !== undefined) chat.avatarMode = preset.settings.avatarMode;
                if (preset.settings.avatarRadius !== undefined) chat.avatarRadius = preset.settings.avatarRadius;
                if (preset.settings.bubbleBlurEnabled !== undefined) chat.bubbleBlurEnabled = preset.settings.bubbleBlurEnabled;
                if (preset.settings.titleLayout !== undefined) chat.titleLayout = preset.settings.titleLayout;
                if (preset.settings.showTimestamp !== undefined) chat.showTimestamp = preset.settings.showTimestamp;
                if (preset.settings.timestampStyle !== undefined) chat.timestampStyle = preset.settings.timestampStyle;
                
                if (currentChatType === 'private' && typeof loadSettingsToSidebar === 'function') {
                    loadSettingsToSidebar();
                } else if (currentChatType === 'group' && typeof loadGroupSettingsToSidebar === 'function') {
                    loadGroupSettingsToSidebar();
                }
                
                if (typeof renderMessages === 'function') {
                    renderMessages(false, true);
                }
            }
        }
    } catch(e){
        console.warn('applyPresetToCurrentChat: cannot write to db object', e);
    }

    try {
        // updateCustomBubbleStyle(window.currentChatId || null, preset.css, true);
        
        let previewBox;
        if (currentChatType === 'private') {
            previewBox = document.getElementById('private-bubble-css-preview');
        } else {
            previewBox = document.getElementById('group-bubble-css-preview');
        }

        if (previewBox) {
            const themeKey = (currentChatType === 'private' ? db.characters.find(c => c.id === currentChatId).theme : db.groups.find(g => g.id === currentChatId).theme) || 'white_pink';
            updateBubbleCssPreview(previewBox, preset.css, false, colorThemes[themeKey]);
        }
        showToast('预设已应用到当前聊天并保存');
        await saveData();
    } catch(e){
        console.error('applyPresetToCurrentChat error', e);
    }
}

function saveCurrentTextareaAsPreset() {
    const textarea = document.getElementById('setting-custom-bubble-css') || document.getElementById('setting-group-custom-bubble-css');
    if (!textarea) return showToast('找不到自定义 CSS 文本框');
    const css = textarea.value.trim();
    
    let name = prompt('请输入预设名称（将覆盖同名预设）:');
    if (!name) return;
    
    const includeSettings = confirm('是否连带当前的各项美化设置（主题、聊天背景、头像圆角、气泡模糊等）一起保存进预设？');
    
    let settings = null;
    if (includeSettings) {
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
        if (chat) {
            settings = {
                theme: document.getElementById('setting-theme-color') ? document.getElementById('setting-theme-color').value : chat.theme,
                chatBg: chat.chatBg,
                bilingualModeEnabled: document.getElementById('setting-bilingual-mode') ? document.getElementById('setting-bilingual-mode').checked : chat.bilingualModeEnabled,
                bilingualBubbleStyle: document.getElementById('setting-bilingual-style') ? document.getElementById('setting-bilingual-style').value : chat.bilingualBubbleStyle,
                avatarMode: document.getElementById('setting-avatar-mode') ? document.getElementById('setting-avatar-mode').value : chat.avatarMode,
                avatarRadius: document.getElementById('setting-avatar-radius') ? parseInt(document.getElementById('setting-avatar-radius').value, 10) : chat.avatarRadius,
                bubbleBlurEnabled: document.getElementById('setting-bubble-blur') ? document.getElementById('setting-bubble-blur').checked : chat.bubbleBlurEnabled,
                titleLayout: document.getElementById('setting-title-layout') ? document.getElementById('setting-title-layout').value : chat.titleLayout,
                showTimestamp: document.getElementById('setting-show-timestamp') ? document.getElementById('setting-show-timestamp').checked : chat.showTimestamp,
                timestampStyle: document.getElementById('setting-timestamp-style') ? document.getElementById('setting-timestamp-style').value : chat.timestampStyle
            };
        }
    }

    const presets = _getBubblePresets();
    const idx = presets.findIndex(p => p.name === name);
    
    const presetData = { name, css };
    if (settings) {
        presetData.settings = settings;
    }
    
    if (idx >= 0) {
        presets[idx].css = css;
        if (settings) presets[idx].settings = settings;
        else delete presets[idx].settings;
    } else {
        presets.push(presetData);
    }
    
    _saveBubblePresets(presets);
    populateBubblePresetSelect('bubble-preset-select'); 
    populateBubblePresetSelect('group-bubble-preset-select');
    showToast('预设已保存');
}

function openManagePresetsModal() {
    const modal = document.getElementById('bubble-presets-modal');
    const list = document.getElementById('bubble-presets-list');
    if (!modal || !list) return;
    list.innerHTML = '';
    const presets = _getBubblePresets();
    if (!presets.length) list.innerHTML = '<p style="color:#888;margin:6px 0;">暂无预设</p>';
    presets.forEach((p, idx) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '8px 0';
        row.style.borderBottom = '1px solid #f0f0f0';
        const nameDiv = document.createElement('div');
        nameDiv.style.flex = '1';
        nameDiv.style.whiteSpace = 'nowrap';
        nameDiv.style.overflow = 'hidden';
        nameDiv.style.textOverflow = 'ellipsis';
        nameDiv.textContent = p.name;
        row.appendChild(nameDiv);

        const btnWrap = document.createElement('div');
        btnWrap.style.display = 'flex';
        btnWrap.style.gap = '6px';

        const applyBtn = document.createElement('button');
        applyBtn.className = 'btn btn-primary';
        applyBtn.style.padding = '6px 8px;border-radius:8px';
        applyBtn.textContent = '应用';
        applyBtn.onclick = function(){ applyPresetToCurrentChat(p.name); modal.style.display = 'none'; };

        const renameBtn = document.createElement('button');
        renameBtn.className = 'btn';
        renameBtn.style.padding = '6px 8px;border-radius:8px';
        renameBtn.textContent = '重命名';
        renameBtn.onclick = function(){
            const newName = prompt('输入新名称：', p.name);
            if (!newName) return;
            const presetsAll = _getBubblePresets();
            presetsAll[idx].name = newName;
            _saveBubblePresets(presetsAll);
            openManagePresetsModal(); 
            populateBubblePresetSelect('bubble-preset-select'); populateBubblePresetSelect('group-bubble-preset-select');
        };

        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger';
        delBtn.style.padding = '6px 8px;border-radius:8px';
        delBtn.textContent = '删除';
        delBtn.onclick = function(){
            if (!confirm('确定删除预设 \"' + p.name + '\" ?')) return;
            const presetsAll = _getBubblePresets();
            presetsAll.splice(idx, 1);
            _saveBubblePresets(presetsAll);
            openManagePresetsModal();
            populateBubblePresetSelect('bubble-preset-select'); populateBubblePresetSelect('group-bubble-preset-select');
        };

        btnWrap.appendChild(applyBtn);
        btnWrap.appendChild(renameBtn);
        btnWrap.appendChild(delBtn);
        row.appendChild(btnWrap);
        list.appendChild(row);
    });
    modal.style.display = 'flex';
}

function _getMyPersonaPresets() {
    return db.myPersonaPresets || [];
}
function _saveMyPersonaPresets(arr) {
    db.myPersonaPresets = arr || [];
    saveData();
}

function populateMyPersonaSelect() {
    const sel = document.getElementById('mypersona-preset-select');
    if (!sel) return;
    const presets = _getMyPersonaPresets();
    sel.innerHTML = '<option value="">— 选择预设 —</option>';
    presets.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        sel.appendChild(opt);
    });
}

function saveCurrentMyPersonaAsPreset() {
    const personaEl = document.getElementById('setting-my-persona');
    const avatarEl = document.getElementById('setting-my-avatar-preview');
    if (!personaEl || !avatarEl) return showToast('找不到我的人设或头像控件');
    const persona = personaEl.value.trim();
    const avatar = avatarEl.src || '';
    if (!persona && !avatar) return showToast('人设和头像都为空，无法保存');
    const name = prompt('请输入预设名称（将覆盖同名预设）：');
    if (!name) return;
    const presets = _getMyPersonaPresets();
    const idx = presets.findIndex(p => p.name === name);
    const preset = { name, persona, avatar };
    if (idx >= 0) presets[idx] = preset; else presets.push(preset);
    _saveMyPersonaPresets(presets);
    populateMyPersonaSelect();
    showToast('我的人设预设已保存');
}

async function applyMyPersonaPresetToCurrentChat(presetName) {
    const presets = _getMyPersonaPresets();
    const p = presets.find(x => x.name === presetName);
    if (!p) { showToast('未找到该预设'); return; }

    const personaEl = document.getElementById('setting-my-persona');
    const avatarEl = document.getElementById('setting-my-avatar-preview');
    if (personaEl) personaEl.value = p.persona || '';
    if (avatarEl) avatarEl.src = p.avatar || '';

    try {
        if (currentChatType === 'private') {
            const e = db.characters.find(c => c.id === currentChatId);
            if (e) {
                e.myPersona = p.persona || '';
                e.myAvatar = p.avatar || '';
                await saveData();
                showToast('预设已应用并保存到当前聊天');
                if (typeof loadSettingsToSidebar === 'function') try{ loadSettingsToSidebar(); }catch(e){}
                if (typeof renderChatList === 'function') try{ renderChatList(); }catch(e){}
            }
        } else {
            showToast('预设已应用到界面（未检测到当前聊天保存入口）');
        }
    } catch(err) {
        console.error('applyMyPersonaPresetToCurrentChat error', err);
    }
}

function openManageMyPersonaModal() {
    const modal = document.getElementById('mypersona-presets-modal');
    const list = document.getElementById('mypersona-presets-list');
    if (!modal || !list) return;
    list.innerHTML = '';
    const presets = _getMyPersonaPresets();
    if (!presets.length) list.innerHTML = '<p style="color:#888;margin:6px 0;">暂无预设</p>';
    presets.forEach((p, idx) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '8px 0';
        row.style.borderBottom = '1px solid #f0f0f0';

        const nameDiv = document.createElement('div');
        nameDiv.style.flex = '1';
        nameDiv.style.whiteSpace = 'nowrap';
        nameDiv.style.overflow = 'hidden';
        nameDiv.style.textOverflow = 'ellipsis';
        nameDiv.textContent = p.name;
        row.appendChild(nameDiv);

        const btnWrap = document.createElement('div');
        btnWrap.style.display = 'flex';
        btnWrap.style.gap = '6px';

        const applyBtn = document.createElement('button');
        applyBtn.className = 'btn btn-primary';
        applyBtn.style.padding = '6px 8px;border-radius:8px';
        applyBtn.textContent = '应用';
        applyBtn.onclick = function(){ applyMyPersonaPresetToCurrentChat(p.name); modal.style.display = 'none'; };

        const renameBtn = document.createElement('button');
        renameBtn.className = 'btn';
        renameBtn.style.padding = '6px 8px;border-radius:8px';
        renameBtn.textContent = '重命名';
        renameBtn.onclick = function(){
            const newName = prompt('输入新名称：', p.name);
            if (!newName) return;
            const all = _getMyPersonaPresets();
            all[idx].name = newName;
            _saveMyPersonaPresets(all);
            openManageMyPersonaModal();
            populateMyPersonaSelect();
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn';
        deleteBtn.style.padding = '6px 8px;border-radius:8px;color:#e53935';
        deleteBtn.textContent = '删除';
        deleteBtn.onclick = function(){
            if (!confirm('确认删除该预设？')) return;
            const all = _getMyPersonaPresets();
            all.splice(idx,1);
            _saveMyPersonaPresets(all);
            openManageMyPersonaModal();
            populateMyPersonaSelect();
        };

        btnWrap.appendChild(applyBtn);
        btnWrap.appendChild(renameBtn);
        btnWrap.appendChild(deleteBtn);
        row.appendChild(btnWrap);

        list.appendChild(row);
    });

    modal.style.display = 'flex';
}

function _getFontPresets() {
    return db.fontPresets || [];
}
function _saveFontPresets(arr) {
    db.fontPresets = arr || [];
    saveData();
}

function populateFontPresetSelect() {
    const sel = document.getElementById('font-preset-select');
    if (!sel) return;
    const presets = _getFontPresets();
    sel.innerHTML = '<option value="">— 选择预设 —</option>';
    presets.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        if (p.isCustom && p.fontFamily) {
            opt.style.fontFamily = p.fontFamily;
        }
        sel.appendChild(opt);
    });
}

async function saveCurrentFontAsPreset() {
    const fontUrlInput = document.getElementById('customize-font-url');
    if (!fontUrlInput) return showToast('找不到字体 URL 输入框');
    const url = fontUrlInput.value.trim();
    if (!url) return showToast('字体 URL 为空，无法保存');
    
    let name = await kpPrompt('保存预设', '请输入预设名称，同名将覆盖。');
    if (!name) return;
    
    const presets = _getFontPresets();
    const idx = presets.findIndex(p => p.name === name);
    const preset = { name, url, isCustom: false };
    
    if (idx >= 0) presets[idx] = preset; 
    else presets.push(preset);
    
    _saveFontPresets(presets);
    populateFontPresetSelect();
    showToast('字体预设已保存');
}

async function applyFontPreset(name) {
    const presets = _getFontPresets();
    const p = presets.find(x => x.name === name);
    if (!p) return showToast('未找到该预设');
    
    const fontUrlInput = document.getElementById('customize-font-url');
    if (fontUrlInput) {
        fontUrlInput.value = p.isCustom ? '[本地字体] ' + p.name : (p.url || '');
    }
    
    if (p.isCustom) {
        db.fontUrl = p.fontFamily;
        await saveData();
        applyGlobalFont(p.fontFamily, true);
    } else {
        db.fontUrl = p.url;
        await saveData();
        applyGlobalFont(p.url, false);
    }
    showToast('已应用字体预设');
}

function openFontManageModal() {
    const modal = document.getElementById('font-presets-modal');
    const list = document.getElementById('font-presets-list');
    if (!modal || !list) return;
    
    list.innerHTML = '';
    const presets = _getFontPresets();
    if (!presets.length) list.innerHTML = '<p style="color:#888;margin:6px 0;">暂无预设</p>';
    
    presets.forEach((p, idx) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '8px 0';
        row.style.borderBottom = '1px solid #f0f0f0';

        const nameDiv = document.createElement('div');
        nameDiv.style.flex = '1';
        nameDiv.style.whiteSpace = 'nowrap';
        nameDiv.style.overflow = 'hidden';
        nameDiv.style.textOverflow = 'ellipsis';
        nameDiv.textContent = p.name;
        if (p.isCustom && p.fontFamily) {
            nameDiv.style.fontFamily = p.fontFamily;
        }
        row.appendChild(nameDiv);

        const btnWrap = document.createElement('div');
        btnWrap.style.display = 'flex';
        btnWrap.style.gap = '6px';

        const applyBtn = document.createElement('button');
        applyBtn.className = 'btn btn-primary';
        applyBtn.style.padding = '6px 8px;border-radius:8px';
        applyBtn.textContent = '应用';
        applyBtn.onclick = function(){ applyFontPreset(p.name); modal.style.display = 'none'; };

        const renameBtn = document.createElement('button');
        renameBtn.className = 'btn';
        renameBtn.style.padding = '6px 8px;border-radius:8px';
        renameBtn.textContent = '重命名';
        renameBtn.onclick = async function(){
            const newName = await kpPrompt('重命名预设', '输入新的预设名称。', p.name);
            if (!newName) return;
            const all = _getFontPresets();
            all[idx].name = newName;
            _saveFontPresets(all);
            openFontManageModal();
            populateFontPresetSelect();
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn';
        deleteBtn.style.padding = '6px 8px;border-radius:8px;color:#e53935';
        deleteBtn.textContent = '删除';
        deleteBtn.onclick = async function(){
            if (!await kpConfirm('删除后无法恢复，请确认是否删除该预设。','删除预设')) return;
            const all = _getFontPresets();
            const deletedPreset = all.splice(idx,1)[0];
            _saveFontPresets(all);
            
            if (deletedPreset.isCustom && deletedPreset.id) {
                try {
                    await dexieDB.customFonts.delete(deletedPreset.id);
                    document.fonts.forEach(font => {
                        if (font.family === deletedPreset.fontFamily) {
                            document.fonts.delete(font);
                        }
                    });
                } catch (e) {
                    console.error('Failed to delete custom font from DB:', e);
                }
            }
            
            openFontManageModal();
            populateFontPresetSelect();
        };

        btnWrap.appendChild(applyBtn);
        btnWrap.appendChild(renameBtn);
        btnWrap.appendChild(deleteBtn);
        row.appendChild(btnWrap);

        list.appendChild(row);
    });

    modal.style.display = 'flex';
}

function setupPresetFeatures() {
    const saveBtn = document.getElementById('api-save-preset');
    const manageBtn = document.getElementById('api-manage-presets');
    const applyBtn = document.getElementById('api-apply-preset');
    const select = document.getElementById('api-preset-select');
    const modalClose = document.getElementById('api-close-modal');
    const importBtn = document.getElementById('api-import-presets');
    const exportBtn = document.getElementById('api-export-presets');

    if (saveBtn) saveBtn.addEventListener('click', saveCurrentApiAsPreset);
    if (manageBtn) manageBtn.addEventListener('click', openApiManageModal);
    if (applyBtn) applyBtn.addEventListener('click', function(){ const v=select.value; if(!v) return showToast('请选择预设'); applyApiPreset(v); });
    if (modalClose) modalClose.addEventListener('click', function(){ document.getElementById('api-presets-modal').style.display='none'; });
    if (importBtn) importBtn.addEventListener('click', importApiPresets);
    if (exportBtn) exportBtn.addEventListener('click', exportApiPresets);
    
    const bubbleApplyBtn = document.getElementById('apply-preset-btn');
    const bubbleSaveBtn = document.getElementById('save-preset-btn');
    const bubbleManageBtn = document.getElementById('manage-presets-btn');
    const bubbleModalClose = document.getElementById('close-presets-modal');

    const groupBubbleApplyBtn = document.getElementById('group-apply-preset-btn');
    const groupBubbleSaveBtn = document.getElementById('group-save-preset-btn');
    const groupBubbleManageBtn = document.getElementById('group-manage-presets-btn');

    // 导出/导入相关元素
    const exportBubbleBtn = document.getElementById('export-preset-btn');
    const groupExportBubbleBtn = document.getElementById('group-export-preset-btn');
    const importBubbleBtn = document.getElementById('import-preset-btn');
    const groupImportBubbleBtn = document.getElementById('group-import-preset-btn');
    const bubbleImportInput = document.getElementById('bubble-preset-import-input');
    
    const exportModal = document.getElementById('export-bubble-preset-modal');
    const exportNameInput = document.getElementById('export-bubble-preset-name');
    const exportIncludeYes = document.getElementById('export-bubble-include-yes');
    const exportIncludeNo = document.getElementById('export-bubble-include-no');
    const exportAuthorNote = document.getElementById('export-bubble-author-note');
    const confirmExportBtn = document.getElementById('confirm-export-bubble-btn');
    const cancelExportBtn = document.getElementById('cancel-export-bubble-btn');
    
    let exportIncludeSettings = null; // null: 未选择, true: 是, false: 否

    function openExportModal() {
        exportNameInput.value = '';
        exportAuthorNote.value = '';
        exportIncludeSettings = null;
        exportIncludeYes.classList.remove('btn-primary');
        exportIncludeYes.classList.add('btn-neutral');
        exportIncludeNo.classList.remove('btn-primary');
        exportIncludeNo.classList.add('btn-neutral');
        confirmExportBtn.disabled = true;
        exportModal.style.display = 'flex';
    }

    if (exportIncludeYes) {
        exportIncludeYes.addEventListener('click', () => {
            exportIncludeSettings = true;
            exportIncludeYes.classList.remove('btn-neutral');
            exportIncludeYes.classList.add('btn-primary');
            exportIncludeNo.classList.remove('btn-primary');
            exportIncludeNo.classList.add('btn-neutral');
            confirmExportBtn.disabled = false;
        });
    }

    if (exportIncludeNo) {
        exportIncludeNo.addEventListener('click', () => {
            exportIncludeSettings = false;
            exportIncludeNo.classList.remove('btn-neutral');
            exportIncludeNo.classList.add('btn-primary');
            exportIncludeYes.classList.remove('btn-primary');
            exportIncludeYes.classList.add('btn-neutral');
            confirmExportBtn.disabled = false;
        });
    }

    if (cancelExportBtn) {
        cancelExportBtn.addEventListener('click', () => {
            exportModal.style.display = 'none';
        });
    }

    if (confirmExportBtn) {
        confirmExportBtn.addEventListener('click', () => {
            const name = exportNameInput.value.trim();
            if (!name) return showToast('请输入预设名称');
            
            const textarea = currentChatType === 'private' ? document.getElementById('setting-custom-bubble-css') : document.getElementById('setting-group-custom-bubble-css');
            const css = textarea ? textarea.value.trim() : '';
            
            const presetData = {
                name: name,
                css: css,
                authorNote: exportAuthorNote.value.trim()
            };

            if (exportIncludeSettings) {
                const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
                if (chat) {
                    presetData.settings = {
                        theme: document.getElementById('setting-theme-color') ? document.getElementById('setting-theme-color').value : chat.theme,
                        chatBg: chat.chatBg,
                        bilingualModeEnabled: document.getElementById('setting-bilingual-mode') ? document.getElementById('setting-bilingual-mode').checked : chat.bilingualModeEnabled,
                        bilingualBubbleStyle: document.getElementById('setting-bilingual-style') ? document.getElementById('setting-bilingual-style').value : chat.bilingualBubbleStyle,
                        avatarMode: document.getElementById('setting-avatar-mode') ? document.getElementById('setting-avatar-mode').value : chat.avatarMode,
                        avatarRadius: document.getElementById('setting-avatar-radius') ? parseInt(document.getElementById('setting-avatar-radius').value, 10) : chat.avatarRadius,
                        bubbleBlurEnabled: document.getElementById('setting-bubble-blur') ? document.getElementById('setting-bubble-blur').checked : chat.bubbleBlurEnabled,
                        titleLayout: document.getElementById('setting-title-layout') ? document.getElementById('setting-title-layout').value : chat.titleLayout,
                        showTimestamp: document.getElementById('setting-show-timestamp') ? document.getElementById('setting-show-timestamp').checked : chat.showTimestamp,
                        timestampStyle: document.getElementById('setting-timestamp-style') ? document.getElementById('setting-timestamp-style').value : chat.timestampStyle
                    };
                }
            }

            const blob = new Blob([JSON.stringify(presetData, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; 
            a.download = `bubble_preset_${name}.json`; 
            document.body.appendChild(a); 
            a.click(); 
            a.remove();
            URL.revokeObjectURL(url);
            
            exportModal.style.display = 'none';
            showToast('预设已导出');
        });
    }

    if (exportBubbleBtn) exportBubbleBtn.addEventListener('click', openExportModal);
    if (groupExportBubbleBtn) groupExportBubbleBtn.addEventListener('click', openExportModal);

    if (importBubbleBtn) importBubbleBtn.addEventListener('click', () => bubbleImportInput.click());
    if (groupImportBubbleBtn) groupImportBubbleBtn.addEventListener('click', () => bubbleImportInput.click());

    if (bubbleImportInput) {
        bubbleImportInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const fileName = file.name;
            const fileExt = fileName.split('.').pop().toLowerCase();
            const presetName = fileName.substring(0, fileName.lastIndexOf('.'));

            const processImportData = (data) => {
                try {
                    const presets = _getBubblePresets();
                    const idx = presets.findIndex(p => p.name === data.name);
                    if (idx >= 0) {
                        if (confirm(`已存在名为 "${data.name}" 的预设，是否覆盖？`)) {
                            presets[idx] = data;
                        } else {
                            return;
                        }
                    } else {
                        presets.push(data);
                    }
                    
                    _saveBubblePresets(presets);
                    populateBubblePresetSelect('bubble-preset-select'); 
                    populateBubblePresetSelect('group-bubble-preset-select');
                    showToast('预设导入成功');
                } catch(err) {
                    showToast('导入失败：' + err.message);
                } finally {
                    bubbleImportInput.value = '';
                }
            };

            if (fileExt === 'json') {
                const reader = new FileReader();
                reader.onload = function() {
                    try {
                        const data = JSON.parse(reader.result);
                        if (!data.name || typeof data.css === 'undefined') {
                            throw new Error('无效的预设文件格式');
                        }
                        processImportData(data);
                    } catch(err) {
                        showToast('导入失败：' + err.message);
                        bubbleImportInput.value = '';
                    }
                };
                reader.readAsText(file);
            } else if (fileExt === 'txt') {
                const reader = new FileReader();
                reader.onload = function() {
                    const text = reader.result;
                    // 简单检测是否乱码 (包含大量不可见字符或替换字符)
                    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFD]/.test(text) && text.length > 10) {
                        showToast('检测到乱码，请确保文件编码为 UTF-8');
                        bubbleImportInput.value = '';
                        return;
                    }
                    processImportData({ name: presetName, css: text });
                };
                reader.readAsText(file);
            } else if (fileExt === 'docx') {
                if (typeof mammoth === 'undefined') {
                    showToast('缺少文档解析库，无法读取 docx');
                    bubbleImportInput.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = function(event) {
                    const arrayBuffer = event.target.result;
                    mammoth.extractRawText({arrayBuffer: arrayBuffer})
                        .then(function(result) {
                            const text = result.value;
                            processImportData({ name: presetName, css: text });
                        })
                        .catch(function(err) {
                            showToast('docx 解析失败：' + err.message);
                            bubbleImportInput.value = '';
                        });
                };
                reader.readAsArrayBuffer(file);
            } else if (fileExt === 'doc') {
                // 尝试强行读取旧版 doc
                const reader = new FileReader();
                reader.onload = function() {
                    const text = reader.result;
                    // 强行读取二进制文件通常会产生大量乱码
                    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFD]/.test(text)) {
                        alert('检测到 .doc 文件包含乱码。旧版 .doc 为二进制格式，无法直接提取文本。请将其另存为 .docx 或 .txt 后再导入。');
                        bubbleImportInput.value = '';
                        return;
                    }
                    processImportData({ name: presetName, css: text });
                };
                reader.readAsText(file);
            } else {
                showToast('不支持的文件格式');
                bubbleImportInput.value = '';
            }
        });
    }

    if (bubbleApplyBtn) bubbleApplyBtn.addEventListener('click', () => {
        const selVal = document.getElementById('bubble-preset-select').value;
        if (!selVal) return showToast('请选择要应用的预设');
        applyPresetToCurrentChat(selVal);
    });
    if (bubbleSaveBtn) bubbleSaveBtn.addEventListener('click', saveCurrentTextareaAsPreset);
    if (bubbleManageBtn) bubbleManageBtn.addEventListener('click', openManagePresetsModal);
    if (bubbleModalClose) bubbleModalClose.addEventListener('click', () => {
        document.getElementById('bubble-presets-modal').style.display = 'none';
    });

    if (groupBubbleApplyBtn) groupBubbleApplyBtn.addEventListener('click', () => {
        const selVal = document.getElementById('group-bubble-preset-select').value;
        if (!selVal) return showToast('请选择要应用的预设');
        applyPresetToCurrentChat(selVal);
    });
    if (groupBubbleSaveBtn) groupBubbleSaveBtn.addEventListener('click', saveCurrentTextareaAsPreset);
    if (groupBubbleManageBtn) groupBubbleManageBtn.addEventListener('click', openManagePresetsModal);

    const personaSaveBtn = document.getElementById('mypersona-save-btn');
    const personaManageBtn = document.getElementById('mypersona-manage-btn');
    const personaApplyBtn = document.getElementById('mypersona-apply-btn');
    const personaSelect = document.getElementById('mypersona-preset-select');
    const personaModalClose = document.getElementById('mypersona-close-modal');

    if (personaSaveBtn) personaSaveBtn.addEventListener('click', saveCurrentMyPersonaAsPreset);
    if (personaManageBtn) personaManageBtn.addEventListener('click', openManageMyPersonaModal);
    if (personaApplyBtn) personaApplyBtn.addEventListener('click', function(){ const v = personaSelect.value; if(!v) return showToast('请选择要应用的预设'); applyMyPersonaPresetToCurrentChat(v); });
    if (personaModalClose) personaModalClose.addEventListener('click', function(){ document.getElementById('mypersona-presets-modal').style.display='none'; });

    const globalCssModalClose = document.getElementById('global-css-close-modal');
    if (globalCssModalClose) globalCssModalClose.addEventListener('click', () => {
        document.getElementById('global-css-presets-modal').style.display = 'none';
    });

    const fontModalClose = document.getElementById('font-close-modal');
    if (fontModalClose) fontModalClose.addEventListener('click', () => {
        document.getElementById('font-presets-modal').style.display = 'none';
    });

    const soundModalClose = document.getElementById('sound-close-modal');
    if (soundModalClose) soundModalClose.addEventListener('click', () => {
        document.getElementById('sound-presets-modal').style.display = 'none';
    });
}

function populateGlobalCssPresetSelect() {
    const select = document.getElementById('global-css-preset-select');
    if (!select) return;
    select.innerHTML = '<option value="">— 选择预设 —</option>';
    (db.globalCssPresets || []).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        select.appendChild(opt);
    });
}

function openGlobalCssManageModal() {
    const modal = document.getElementById('global-css-presets-modal');
    const list = document.getElementById('global-css-presets-list');
    if (!modal || !list) return;
    list.innerHTML = '';
    const presets = db.globalCssPresets || [];
    if (!presets.length) list.innerHTML = '<p style="color:#888;margin:6px 0;">暂无预设</p>';
    
    presets.forEach((p, idx) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '8px 0';
        row.style.borderBottom = '1px solid #f0f0f0';
        
        const nameDiv = document.createElement('div');
        nameDiv.style.flex = '1';
        nameDiv.style.whiteSpace = 'nowrap';
        nameDiv.style.overflow = 'hidden';
        nameDiv.style.textOverflow = 'ellipsis';
        nameDiv.textContent = p.name;
        row.appendChild(nameDiv);

        const btnWrap = document.createElement('div');
        btnWrap.style.display = 'flex';
        btnWrap.style.gap = '6px';

        const renameBtn = document.createElement('button');
        renameBtn.className = 'btn';
        renameBtn.style.padding = '6px 8px';
        renameBtn.textContent = '重命名';
        renameBtn.onclick = async function() {
            const newName = await kpPrompt('重命名预设', '输入新的预设名称。', p.name);
            if (!newName || newName === p.name) return;
            db.globalCssPresets[idx].name = newName;
            saveData();
            openGlobalCssManageModal();
            populateGlobalCssPresetSelect();
        };

        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger';
        delBtn.style.padding = '6px 8px';
        delBtn.textContent = '删除';
        delBtn.onclick = async function() {
            if (!await kpConfirm('确定删除预设“' + p.name + '”？','删除预设')) return;
            db.globalCssPresets.splice(idx, 1);
            saveData();
            openGlobalCssManageModal();
            populateGlobalCssPresetSelect();
        };

        btnWrap.appendChild(renameBtn);
        btnWrap.appendChild(delBtn);
        row.appendChild(btnWrap);
        list.appendChild(row);
    });
    modal.style.display = 'flex';
}

function _getSoundPresets() {
    return db.soundPresets || [];
}
function _saveSoundPresets(arr) {
    db.soundPresets = arr || [];
    saveData();
}

function populateSoundPresetSelect() {
    const sel = document.getElementById('sound-preset-select');
    if (!sel) return;
    const presets = _getSoundPresets();
    sel.innerHTML = '<option value="">— 选择预设 —</option>';
    presets.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        sel.appendChild(opt);
    });
}

async function saveCurrentSoundAsPreset() {
    const sendUrl = document.getElementById('global-send-sound-url').value.trim();
    const receiveUrl = document.getElementById('global-receive-sound-url').value.trim();
    
    if (!sendUrl && !receiveUrl) return showToast('提示音配置为空，无法保存');
    
    let name = await kpPrompt('保存预设', '请输入预设名称，同名将覆盖。');
    if (!name) return;
    
    const presets = _getSoundPresets();
    const idx = presets.findIndex(p => p.name === name);
    const preset = { name, sendSound: sendUrl, receiveSound: receiveUrl };
    
    if (idx >= 0) presets[idx] = preset; 
    else presets.push(preset);
    
    _saveSoundPresets(presets);
    populateSoundPresetSelect();
    showToast('提示音预设已保存');
}

function applySoundPreset(name) {
    const presets = _getSoundPresets();
    const p = presets.find(x => x.name === name);
    if (!p) return showToast('未找到该预设');
    
    const sendInput = document.getElementById('global-send-sound-url');
    const receiveInput = document.getElementById('global-receive-sound-url');
    
    if (sendInput) sendInput.value = p.sendSound || '';
    if (receiveInput) receiveInput.value = p.receiveSound || '';
    
    db.globalSendSound = p.sendSound || '';
    db.globalReceiveSound = p.receiveSound || '';
    saveData();
    
    showToast('已应用提示音预设');
}

function openSoundManageModal() {
    const modal = document.getElementById('sound-presets-modal');
    const list = document.getElementById('sound-presets-list');
    if (!modal || !list) return;
    
    list.innerHTML = '';
    const presets = _getSoundPresets();
    if (!presets.length) list.innerHTML = '<p style="color:#888;margin:6px 0;">暂无预设</p>';
    
    presets.forEach((p, idx) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '8px 0';
        row.style.borderBottom = '1px solid #f0f0f0';

        const nameDiv = document.createElement('div');
        nameDiv.style.flex = '1';
        nameDiv.style.whiteSpace = 'nowrap';
        nameDiv.style.overflow = 'hidden';
        nameDiv.style.textOverflow = 'ellipsis';
        nameDiv.textContent = p.name;
        row.appendChild(nameDiv);

        const btnWrap = document.createElement('div');
        btnWrap.style.display = 'flex';
        btnWrap.style.gap = '6px';

        const applyBtn = document.createElement('button');
        applyBtn.className = 'btn btn-primary';
        applyBtn.style.padding = '6px 8px;border-radius:8px';
        applyBtn.textContent = '应用';
        applyBtn.onclick = function(){ applySoundPreset(p.name); modal.style.display = 'none'; };

        const renameBtn = document.createElement('button');
        renameBtn.className = 'btn';
        renameBtn.style.padding = '6px 8px;border-radius:8px';
        renameBtn.textContent = '重命名';
        renameBtn.onclick = async function(){
            const newName = await kpPrompt('重命名预设', '输入新的预设名称。', p.name);
            if (!newName) return;
            const all = _getSoundPresets();
            all[idx].name = newName;
            _saveSoundPresets(all);
            openSoundManageModal();
            populateSoundPresetSelect();
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn';
        deleteBtn.style.padding = '6px 8px;border-radius:8px;color:#e53935';
        deleteBtn.textContent = '删除';
        deleteBtn.onclick = async function(){
            if (!await kpConfirm('删除后无法恢复，请确认是否删除该预设。','删除预设')) return;
            const all = _getSoundPresets();
            all.splice(idx,1);
            _saveSoundPresets(all);
            openSoundManageModal();
            populateSoundPresetSelect();
        };

        btnWrap.appendChild(applyBtn);
        btnWrap.appendChild(renameBtn);
        btnWrap.appendChild(deleteBtn);
        row.appendChild(btnWrap);

        list.appendChild(row);
    });

    modal.style.display = 'flex';
}


// 三个指定入口：黑白预设搜索（2026-10-02）
(() => {
    const configurations = {
        "setting-status-preset-select": {title:"快速填充预设", hint:"点击预设自动填充 · 保存聊天设置后生效", wide:true},
        "cot-preset-select": {title:"选择思维链预设", hint:"点击预设即可切换当前思维链", wide:true},
        "setting-exclusive-cot-preset": {title:"专属思维链预设", hint:"点击选择 · 保存聊天设置后生效", wide:false}
    };
    const selector = Object.keys(configurations).map(id => "#" + id).join(",");
    let modal, input, list, count, clear, source, returnFocus;
    const buttons = new Map();
    let previousOverflow = '';
    let composing = false;
    const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
    function score(name, query) {
        const text = normalize(name), q = normalize(query);
        if (!q) return 1;
        if (text === q) return 4;
        if (text.includes(q)) return 3;
        let i = 0;
        for (const char of text) if (char === q[i]) i++;
        return i === q.length ? 2 : 0;
    }
    function ensureModal() {
        if (modal) return;
        const style = document.createElement('style');
        style.textContent = `
        .tps-trigger{appearance:none!important;display:flex!important;align-items:center;gap:8px;min-width:0;max-width:180px;padding:8px 12px!important;border:1px solid #ddd!important;border-radius:9px!important;background:#fff!important;color:#111!important;font:inherit;font-size:12px;cursor:pointer}
        .tps-trigger.tps-wide{width:100%;max-width:none;flex:1}.tps-trigger:not(.tps-wide){min-width:90px;max-width:150px}.tps-trigger span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}.tps-trigger svg{flex:none}
        .tps-overlay{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.32);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;font-family:inherit;color:#111;color-scheme:light}
        .tps-overlay[hidden]{display:none!important}
        .tps-dialog{width:100%;max-width:380px;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);display:flex;flex-direction:column;box-sizing:border-box;background:#fff;border:1px solid #e6e6e6;border-radius:20px;box-shadow:0 16px 60px #0002;overflow:hidden}
        .tps-dialog *{box-sizing:border-box}.tps-header{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 14px}.tps-kicker{font-size:10px;letter-spacing:2px;color:#888;margin-bottom:5px}.tps-title{font-size:20px;font-weight:700;margin:0;color:#111}
        .tps-icon{border:0!important;background:transparent!important;color:#111!important;width:32px;height:32px;border-radius:50%;padding:7px!important;cursor:pointer;display:grid;place-items:center}.tps-icon:hover{background:#eee!important}
        .tps-search{display:flex;align-items:center;gap:8px;margin:0 20px;border:1px solid #e1e1e1;border-radius:999px;background:#f5f5f5;padding:4px 8px 4px 13px;flex:none}.tps-search:focus-within{border-color:#111;background:#fff}.tps-search svg{flex:none;color:#777}
        .tps-input{width:100%;min-width:0;appearance:none!important;background:transparent!important;border:0!important;box-shadow:none!important;outline:none!important;padding:7px 0!important;color:#111!important;font:inherit;font-size:16px!important;border-radius:0!important}.tps-input::placeholder{color:#999}
        .tps-count{padding:14px 22px 8px;font-size:10px;color:#888;letter-spacing:1px;flex:none}.tps-list{overflow-y:auto;overscroll-behavior:contain;min-height:0;max-height:46vh;max-height:46dvh;padding:0 10px 10px;-webkit-overflow-scrolling:touch}
        .tps-row{display:flex;align-items:center;gap:10px;border-bottom:1px solid #f0f0f0;padding:5px 0}.tps-name{flex:1;min-width:0;border:0!important;background:transparent!important;color:#111!important;text-align:left!important;padding:10px!important;font:inherit;font-size:13px;line-height:1.5;overflow-wrap:anywhere;cursor:pointer;border-radius:8px!important}.tps-name small{display:block;font-size:10px;color:#888;margin-top:2px}.tps-name:hover{background:#f5f5f5!important}.tps-row.is-selected .tps-name{font-weight:650}
        .tps-apply{flex:none;background:#111!important;color:#fff!important;border:0!important;border-radius:999px!important;padding:7px 12px!important;font:inherit;font-size:11px;cursor:pointer;margin-right:8px}.tps-apply:hover{background:#333!important}.tps-empty{padding:35px 10px;text-align:center;font-size:13px;color:#888}.tps-footer{padding:12px 20px 16px;border-top:1px solid #eee;color:#999;font-size:10px;letter-spacing:.4px}.tps-dialog button:focus-visible{outline:2px solid #111;outline-offset:2px}
        @media(max-width:480px){.tps-overlay{align-items:flex-end;padding:12px;padding-bottom:max(12px,env(safe-area-inset-bottom))}.tps-dialog{max-width:100%;border-radius:22px}.tps-list{max-height:42dvh}}
        `;
        document.head.appendChild(style);
        modal = document.createElement('div');
        modal.className = 'tps-overlay'; modal.hidden = true;
        modal.innerHTML = `<section class="tps-dialog" role="dialog" aria-modal="true" aria-labelledby="tps-title"><header class="tps-header"><div><div class="tps-kicker">YOUR COLLECTION</div><h2 class="tps-title" id="tps-title">选择预设</h2></div><button class="tps-icon tps-close" type="button" aria-label="关闭"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="tps-search"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input class="tps-input" type="text" inputmode="search" placeholder="输入名称的部分字样…" aria-label="搜索预设" autocomplete="off"><button class="tps-icon tps-clear" type="button" aria-label="清空搜索">×</button></div><div class="tps-count" aria-live="polite"></div><div class="tps-list"></div><footer class="tps-footer">点击选择预设</footer></section>`;
        document.body.appendChild(modal);
        input = modal.querySelector('input'); list = modal.querySelector('.tps-list'); count = modal.querySelector('.tps-count'); clear = modal.querySelector('.tps-clear');
        input.addEventListener('input', render);
        input.addEventListener('compositionstart', () => composing = true);
        input.addEventListener('compositionend', () => { composing = false; render(); });
        clear.onclick = () => { input.value = ''; render(); input.focus(); };
        modal.querySelector('.tps-close').onclick = close;
        modal.addEventListener('click', event => { if (event.target === modal) close(); });
        modal.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); close(); }
            if (event.key === 'Enter' && event.target === input && !event.isComposing && !composing) { event.preventDefault(); list.querySelector('.tps-name')?.click(); }
            if (event.key === 'Tab') {
                const focusable = [...modal.querySelectorAll('button,input')].filter(el => !el.disabled && el.getClientRects().length);
                const first = focusable[0], last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        });
    }
    function close() {
        if (!modal) return;
        modal.hidden = true;
        document.body.style.overflow = previousOverflow;
        returnFocus?.setAttribute('aria-expanded', 'false');
        if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
        source = null;
    }
    function choose(option) {
        if (!source || option.disabled || !source.contains(option)) return;
        const select = source;
        select.value = option.value;
        // 原有 onchange 负责填充/切换；专属预设仍由聊天设置的保存按钮保存。
        select.dispatchEvent(new Event('change', {bubbles:true}));
        sync(select);
        close();
    }
    function render() {
        if (!source || modal.hidden) return;
        const query = input.value;
        const options = [...source.options].filter(option => !option.disabled && !option.hidden);
        const results = options.map((option, index) => ({option,index,rank:score(option.textContent,query)}))
            .filter(item => item.rank).sort((a,b) => b.rank-a.rank || a.index-b.index);
        count.textContent = `${results.length} / ${options.length} PRESETS`;
        clear.style.visibility = query ? 'visible' : 'hidden';
        list.replaceChildren(); list.scrollTop = 0;
        if (!results.length) {
            const empty = document.createElement('div'); empty.className = 'tps-empty';
            empty.textContent = options.length ? '没有匹配的预设，换个字试试' : '还没有预设，可以先导入或保存';
            list.appendChild(empty); return;
        }
        results.forEach(({option}) => {
            const selected = source.value === option.value;
            const row = document.createElement('div'); row.className = 'tps-row' + (selected ? ' is-selected' : '');
            const name = document.createElement('button'); name.type = 'button'; name.className = 'tps-name';
            name.textContent = option.textContent;
            if (selected) { const note = document.createElement('small'); note.textContent = '当前选择'; name.appendChild(note); }
            name.onclick = () => choose(option);
            const apply = document.createElement('button'); apply.type = 'button'; apply.className = 'tps-apply';
            apply.textContent = selected ? '已选' : '选择'; apply.setAttribute('aria-label',`选择 ${option.textContent}`);
            apply.onclick = () => choose(option);
            row.append(name,apply); list.appendChild(row);
        });
    }
    function sync(select) {
        const button = buttons.get(select);
        const label = select.selectedOptions[0]?.textContent || '选择预设';
        if (button) {
            const span = button.querySelector('span');
            if (span.textContent !== label) span.textContent = label;
            button.title = label;
            button.disabled = select.disabled;
        }
        if (source === select && !modal.hidden) render();
    }
    function attach(select) {
        if (buttons.has(select)) return;
        ensureModal();
        const config = configurations[select.id];
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'tps-trigger' + (config.wide ? ' tps-wide' : '');
        button.setAttribute('aria-haspopup','dialog'); button.setAttribute('aria-expanded','false');
        button.setAttribute('aria-label',config.title + '，打开搜索');
        button.innerHTML = '<span>选择预设</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg>';
        select.hidden = true; select.style.setProperty('display','none','important');
        select.after(button); buttons.set(select,button);
        select.addEventListener('change',() => sync(select));
        new MutationObserver(() => sync(select)).observe(select, {childList:true, subtree:true, characterData:true, attributes:true});
        button.onclick = () => {
            source = select; returnFocus = button; input.value = '';
            modal.querySelector('.tps-title').textContent = config.title;
            modal.querySelector('.tps-footer').textContent = config.hint;
            input.setAttribute('aria-label','搜索' + config.title);
            previousOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden'; modal.hidden = false;
            button.setAttribute('aria-expanded','true'); render(); input.focus({preventScroll:true});
        };
        sync(select);
    }
    function start() {
        document.querySelectorAll(selector).forEach(attach);
        // 仅检查新增节点，兼容聊天设置 HTML 动态注入，不扫描聊天记录。
        new MutationObserver(records => {
            for (const record of records) for (const node of record.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.matches(selector)) attach(node);
                node.querySelectorAll(selector).forEach(attach);
            }
            for (const [select, button] of buttons) if (!select.isConnected) {
                if (source === select) close();
                button.remove(); buttons.delete(select);
            }
        }).observe(document.body, {childList:true, subtree:true});
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
    else start();
})();
