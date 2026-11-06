// --- Menu Screen & Status Bar Manager Logic ---

// 初始化 Menu 页面
function initMoreMenu() {
    // 初始化搜索模块
    if (window.SearchSystem) {
        window.SearchSystem.init();
        
        // 绑定搜索入口点击
        const searchEntry = document.querySelector('.search-bar-decoration');
        if (searchEntry) {
            searchEntry.addEventListener('click', () => {
                window.SearchSystem.open();
            });
        }
    }

    const menuGrid = document.querySelector('.menu-grid');
    if (!menuGrid) return;

    menuGrid.addEventListener('click', (e) => {
        const item = e.target.closest('.menu-item');
        if (!item) return;

        const action = item.dataset.action;
        if (action === 'status-bar') {
            openStatusBarManager();
        } else if (action === 'calendar') {
            window.KissCalendar?.open().catch(error => showToast(error.message));
        } else if (action === 'star') {
            showToast('收藏功能开发中...');
        } else if (action === 'drawing-workshop') {
            switchScreen('drawing-workshop-screen');
        } else if (action === 'cot-settings') {
            switchScreen('cot-settings-screen');
        }
    });

    // 绑定状态栏管理界面的按钮事件
    const addStatusPresetBtn = document.getElementById('add-status-preset-btn');
    if (addStatusPresetBtn) {
        addStatusPresetBtn.addEventListener('click', () => {
            openStatusBarEditor();
        });
    }

    const saveStatusPresetBtn = document.getElementById('save-status-preset-btn');
    if (saveStatusPresetBtn) {
        saveStatusPresetBtn.addEventListener('click', saveStatusBarPreset);
    }

    const importStatusPresetBtn = document.getElementById('import-status-preset-btn');
    if (importStatusPresetBtn) importStatusPresetBtn.addEventListener('click', () => document.getElementById('status-preset-import-input').click());

    const statusPresetImportInput = document.getElementById('status-preset-import-input');
    if (statusPresetImportInput) statusPresetImportInput.addEventListener('change', importStatusBarPreset);

// 初始化编辑器预览逻辑
initStatusBarPreview();
}

// 简单的 HTML 转义函数
function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, '"')
        .replace(/'/g, "&#039;");
}

// --- Status Bar Manager ---

// 打开状态栏管理界面
function openStatusBarManager() {
    renderStatusBarManager();
    switchScreen('status-bar-manager-screen');
}

// 渲染状态栏预设列表
function renderStatusBarManager() {
    const listContainer = document.getElementById('status-bar-preset-list');
    listContainer.replaceChildren();
    const presets = db.statusBarPresets || [];
    const count = document.getElementById('sb-preset-count');
    if (count) count.textContent = String(presets.length).padStart(2, '0');
    if (!presets.length) {
        const empty = document.createElement('div');
        empty.className = 'placeholder-text'; empty.textContent = '暂无预设';
        listContainer.append(empty); return;
    }
    presets.forEach(preset => {
        const div = document.createElement('div');
        div.className = 'preset-card' + (window.kissStatusLastEdited === preset.id ? ' sbp-last-edited' : '');
        const info = document.createElement('div'); info.className = 'preset-info-col';
        const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'preset-open';
        const name = document.createElement('div'); name.className = 'preset-name'; name.textContent = preset.name;
        const desc = document.createElement('div'); desc.className = 'preset-desc'; desc.textContent = preset.promptSuffix || '—';
        edit.append(name, desc); info.append(edit);
        div.onclick = event => { if (!event.target.closest('.preset-action-btn')) openStatusBarEditor(preset.id); };
        const actions = document.createElement('div'); actions.className = 'preset-actions-col';
        for (const [label, cls, path, handler] of [
            ['导出', '', 'M12 15V3m-5 7 5 5 5-5M4 15v5h16v-5', () => exportStatusBarPreset(preset.id)],
            ['删除', ' delete', 'M3 6h18M5 6l1 15h12l1-15M9 6V3h6v3M10 10v7m4-7v7', event => deleteStatusBarPreset(preset.id, event)]
        ]) {
            const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'preset-action-btn' + cls;
            btn.title = label; btn.setAttribute('aria-label', label + ' ' + preset.name);
            btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>';
            btn.onclick = handler; actions.append(btn);
        }
        div.append(info, actions); listContainer.append(div);
    });
}

// 打开状态栏编辑器（新增或编辑）
window.openStatusBarEditor = function(presetId = null) {
    const title = document.getElementById('status-bar-editor-title');
    const nameInput = document.getElementById('sb-preset-name');
    const promptInput = document.getElementById('sb-preset-prompt');
    const regexInput = document.getElementById('sb-preset-regex');
    const htmlInput = document.getElementById('sb-preset-html');
    const idInput = document.getElementById('sb-preset-id');
    const testInput = document.getElementById('sb-test-input');
    let editingPreset = null;

    if (presetId) {
        const preset = db.statusBarPresets.find(p => p.id === presetId);
        if (preset) {
            editingPreset = preset;
            window.kissStatusLastEdited = preset.id;
            title.textContent = '编辑预设';
            nameInput.value = preset.name;
            promptInput.value = preset.promptSuffix || '';
            regexInput.value = preset.regexPattern || '';
            htmlInput.value = preset.replacePattern || '';
            idInput.value = preset.id;
        }
    } else {
        title.textContent = '新建预设';
        nameInput.value = '';
        promptInput.value = '';
        regexInput.value = '';
        htmlInput.value = '';
        idInput.value = '';
    }

    // 重置测试输入和预览
    testInput.value = editingPreset?.previewText || '';
    window.KissStatusPresetPreview?.open(editingPreset);

    switchScreen('status-bar-editor-screen');
};

// 初始化状态栏预览逻辑
function initStatusBarPreview() {
    const inputs = ['sb-test-input', 'sb-preset-regex', 'sb-preset-html'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateStatusBarPreview);
        }
    });
}

// 更新预览
function updateStatusBarPreview() {
    window.KissStatusPresetPreview?.update();
}

// 导出单个预设
window.exportStatusBarPreset = function(presetId) {
    const preset = db.statusBarPresets.find(p => p.id === presetId);
    if (!preset) return;

    const data = JSON.stringify(preset, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `status_preset_${preset.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

// 导入预设
function importStatusBarPreset(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const imported = JSON.parse(event.target.result);
            // 简单校验结构
            const items = Array.isArray(imported) ? imported : [imported];
            if (items.length && items.every(p => p && typeof p.name === 'string' && typeof p.regexPattern === 'string' && typeof p.replacePattern === 'string')) {
                // 可能是单个对象，也可能是数组（如果是批量导出的话，虽然目前只做了单个导出，但兼容一下数组更好）
                const presetsToAdd = items;
                
                if (!db.statusBarPresets) db.statusBarPresets = [];

                let addedCount = 0;
                presetsToAdd.forEach(p => {
                    // 生成新ID避免冲突
                    p.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                    db.statusBarPresets.push(p);
                    addedCount++;
                });

                await saveData();
                renderStatusBarManager();
                showToast(`成功导入 ${addedCount} 个预设`);
            } else {
                showToast('无效的预设文件');
            }
        } catch (error) {
            console.error(error);
            showToast('解析失败');
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // 重置 input
}

// 保存预设
async function saveStatusBarPreset() {
    const id = document.getElementById('sb-preset-id').value;
    const name = document.getElementById('sb-preset-name').value.trim();
    const promptSuffix = document.getElementById('sb-preset-prompt').value;
    const regexPattern = document.getElementById('sb-preset-regex').value;
    const replacePattern = document.getElementById('sb-preset-html').value;
    const previewText = document.getElementById('sb-test-input').value;

    if (!name) {
        showToast('请输入预设名称');
        return;
    }

    // 校验正则有效性
    try {
        new RegExp(regexPattern);
    } catch (e) {
        showToast('正则表达式无效，请检查');
        return;
    }

    if (!db.statusBarPresets) db.statusBarPresets = [];

    if (id) {
        // 编辑现有
        const index = db.statusBarPresets.findIndex(p => p.id === id);
        if (index !== -1) {
            db.statusBarPresets[index] = { ...db.statusBarPresets[index], id, name, promptSuffix, regexPattern, replacePattern, previewText };
        }
    } else {
        // 新增
        const newPreset = {
            id: Date.now().toString(),
            name,
            promptSuffix,
            regexPattern,
            replacePattern,
            previewText
        };
        db.statusBarPresets.push(newPreset);
    }

    await saveData();
    showToast('预设已保存');
    openStatusBarManager(); // 返回列表页
}

// 删除预设
window.deleteStatusBarPreset = async function(presetId, event) {
    event?.stopPropagation(); // 阻止冒泡触发编辑
    if (confirm('确定要删除这个预设吗？')) {
        db.statusBarPresets = db.statusBarPresets.filter(p => p.id !== presetId);
        await saveData();
        renderStatusBarManager();
        showToast('预设已删除');
    }
};

// 填充设置页面的下拉框 (供 settings.js 调用)
function populateStatusBarPresetSelect() {
    const select = document.getElementById('setting-status-preset-select');
    if (!select) return;

    select.innerHTML = '<option value="">-- 选择预设自动填充 --</option>';
    const presets = db.statusBarPresets || [];
    
    presets.forEach(preset => {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.name;
        select.appendChild(option);
    });

    // 绑定选择事件
    select.onchange = function() {
        const presetId = this.value;
        if (!presetId) return;

        const preset = db.statusBarPresets.find(p => p.id === presetId);
        if (preset) {
            document.getElementById('setting-status-prompt-suffix').value = preset.promptSuffix;
            document.getElementById('setting-status-regex').value = preset.regexPattern;
            document.getElementById('setting-status-replace').value = preset.replacePattern;
            showToast('已填充预设内容');
        }
    };

    // 绑定快速保存按钮事件
    const quickSaveBtn = document.getElementById('quick-save-status-preset-btn');
    if (quickSaveBtn) {
        quickSaveBtn.onclick = saveStatusBarPresetFromSettings;
    }
}

// 从设置界面快速保存预设
async function saveStatusBarPresetFromSettings() {
    const promptSuffix = document.getElementById('setting-status-prompt-suffix').value;
    const regexPattern = document.getElementById('setting-status-regex').value;
    const replacePattern = document.getElementById('setting-status-replace').value;

    if (!regexPattern && !replacePattern) {
        showToast('请先填写状态栏配置');
        return;
    }

    const name = prompt('请输入预设名称（同名将覆盖）：');
    if (!name) return;

    if (!db.statusBarPresets) db.statusBarPresets = [];

    const existingIndex = db.statusBarPresets.findIndex(p => p.name === name);
    
    const newPreset = {
        id: existingIndex !== -1 ? db.statusBarPresets[existingIndex].id : Date.now().toString(),
        name,
        promptSuffix,
        regexPattern,
        replacePattern
    };

    if (existingIndex !== -1) {
        db.statusBarPresets[existingIndex] = newPreset;
    } else {
        db.statusBarPresets.push(newPreset);
    }

    await saveData();
    showToast('预设已保存');
    populateStatusBarPresetSelect(); // 刷新下拉列表
    
    // 选中刚才保存的预设
    const select = document.getElementById('setting-status-preset-select');
    if (select) select.value = newPreset.id;
}

// 导出全局函数供 HTML 调用
window.openStatusBarEditor = openStatusBarEditor;
window.deleteStatusBarPreset = deleteStatusBarPreset;

