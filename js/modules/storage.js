// --- 存储分析与数据管理 (js/modules/storage.js) ---

const STORAGE_CATEGORIES = [
    { key: 'chats', name: '聊天记录', desc: '所有对话历史' },
    { key: 'contacts', name: '角色设定', desc: '联系人及角色卡片' },
    { key: 'worldbooks', name: '世界书', desc: '世界书条目数据' },
    { key: 'personas', name: '用户设定', desc: '用户人设数据' },
    { key: 'wallpapers', name: '壁纸与外观', desc: '自定义壁纸、主题、表情包' },
    { key: 'fonts', name: '字体', desc: '自定义字体文件' },
    { key: 'settings', name: '基础设置', desc: 'API配置、UI偏好等' },
    { key: 'other', name: '生图缓存', desc: '相册、工坊生图、阅读插图等' }
];

let currentStorageSizes = {};

// Browser image caches are disposable; persisted image messages are user data.
function setupCleanImageCache() {
    const button = document.getElementById('open-clean-cache-btn');
    if (!button || button.dataset.cacheBound) return;
    button.dataset.cacheBound = 'true';
    button.addEventListener('click', () => {
        const modal = document.getElementById('clean-image-cache-modal');
        if (!modal || modal.dataset.cleaning === 'true') return;
        modal.querySelector('.modal-window').innerHTML = `<h3>清理图片缓存</h3>
            <p style="font-size:14px;line-height:1.6">仅清理浏览器中可重新下载的图片缓存，聊天图片、相册、表情包和备份会保留。之后查看图片可能需要重新联网。</p>
            <p data-cache-status role="status"></p>
            <div style="display:flex;gap:10px;margin-top:20px">
              <button type="button" class="btn btn-danger" data-cache-confirm style="flex:1">确认清理</button>
              <button type="button" class="btn btn-neutral" data-cache-cancel style="flex:1">取消</button>
            </div>`;
        modal.classList.add('visible');
        const confirmButton = modal.querySelector('[data-cache-confirm]');
        const cancelButton = modal.querySelector('[data-cache-cancel]');
        const status = modal.querySelector('[data-cache-status]');
        cancelButton.onclick = () => modal.classList.remove('visible');
        if (!('caches' in window)) {
            status.textContent = '当前浏览器不支持读取图片缓存。';
            confirmButton.disabled = true;
        }
        confirmButton.onclick = async () => {
            if (modal.dataset.cleaning === 'true') return;
            modal.dataset.cleaning = 'true';
            confirmButton.disabled = cancelButton.disabled = true;
            status.textContent = '正在清理图片缓存…';
            let removed = 0, scanned = 0;
            try {
                for (const name of await caches.keys()) {
                    const cache = await caches.open(name);
                    for (const request of await cache.keys()) {
                        const response = await cache.match(request);
                        if (response && /^image\//i.test(response.headers.get('content-type') || '')) {
                            if (await cache.delete(request)) removed++;
                        }
                        if (++scanned % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0));
                    }
                }
                status.textContent = removed ? `已清理 ${removed} 项图片缓存。` : '没有可清理的图片缓存。';
                window.KissDiagnostics?.record({app:'data',feature:'图片缓存',title:'图片缓存清理完成',detail:`已清理 ${removed} 项；保留持久化图片数据。`});
                cancelButton.textContent = '完成';
            } catch (error) {
                status.textContent = `清理未完成，已清理 ${removed} 项。${error.message}`;
                console.error('图片缓存清理失败', error);
                confirmButton.disabled = false;
            } finally {
                modal.dataset.cleaning = 'false';
                cancelButton.disabled = false;
            }
        };
    });
}
let selectedModules = {
    chats: true,
    contacts: true,
    worldbooks: true,
    personas: true,
    wallpapers: true,
    fonts: true,
    settings: true
};

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function stringifySize(obj) {
    try {
        return obj ? JSON.stringify(obj).length : 0;
    } catch (e) {
        return 0;
    }
}

async function calculateStorageSize() {
    // Hero, category chart and cleanup dialog share the same bounded-memory scan.
    const data = await window.KissDataManager.scan();
    return {...data.overview};
}

function renderStorageUI() {
    const totalEl = document.getElementById('storage-total-size');
    const barChart = document.getElementById('storage-bar-chart');
    const legendContainer = document.getElementById('storage-legend-container');
    const backupOptions = document.getElementById('storage-backup-options');

    if (!totalEl || !barChart || !legendContainer || !backupOptions) return;

    totalEl.textContent = formatBytes(currentStorageSizes.total);

    // Render Bar Chart
    barChart.innerHTML = '';
    STORAGE_CATEGORIES.forEach(cat => {
        const size = currentStorageSizes[cat.key] || 0;
        if (size > 0 && currentStorageSizes.total > 0) {
            const percentage = (size / currentStorageSizes.total) * 100;
            const segment = document.createElement('div');
            segment.className = `storage-segment ${cat.key}`;
            segment.style.width = `${percentage}%`;
            barChart.appendChild(segment);
        }
    });

    // Render Legend
    legendContainer.innerHTML = '';
    STORAGE_CATEGORIES.forEach(cat => {
        const size = currentStorageSizes[cat.key] || 0;
        legendContainer.innerHTML += `
            <div class="storage-legend-item">
                <div class="storage-legend-color ${cat.key}"></div>
                <div class="storage-legend-info">
                    <span class="storage-legend-name">${cat.name}</span>
                    <span class="storage-legend-size">${formatBytes(size)}</span>
                </div>
            </div>
        `;
    });

    // Render Backup Options
    backupOptions.innerHTML = '';
    STORAGE_CATEGORIES.forEach(cat => {
        if (cat.key === 'other') return; // 不在备份选项中显示其他缓存
        const size = currentStorageSizes[cat.key] || 0;
        const isChecked = selectedModules[cat.key] ? 'checked' : '';
        backupOptions.innerHTML += `
            <div class="storage-setting-item">
                <div class="storage-setting-info">
                    <span class="storage-setting-name">${cat.name}</span>
                    <span class="storage-setting-desc">${cat.desc} (${formatBytes(size)})</span>
                </div>
                <label class="kkt-switch">
                    <input type="checkbox" class="backup-module-checkbox" data-key="${cat.key}" ${isChecked}>
                    <span class="kkt-slider"></span>
                </label>
            </div>
        `;
    });
    
    backupOptions.innerHTML += `
        <div style="font-size: 12px; color: #888; margin-top: 15px; text-align: center;">
            * 注：为避免备份文件过大导致崩溃，404相册、工坊历史等缓存不参与分类导出；独立应用所选图片、消息和档案会随对应分类导出。
        </div>
    `;

    // Bind Checkbox Events
    document.querySelectorAll('.backup-module-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            selectedModules[e.target.dataset.key] = e.target.checked;
            updateSelectAllBtn();
        });
    });
    updateSelectAllBtn();
}

function updateSelectAllBtn() {
    const btn = document.getElementById('storage-select-all-btn');
    if (!btn) return;
    const allSelected = Object.values(selectedModules).every(v => v);
    btn.textContent = allSelected ? '全不选' : '全选';
}

function setupStorageAnalysisScreen() {
    const screen = document.getElementById('storage-analysis-screen');
    if (!screen) return;

    const observer = new MutationObserver(async (mutations) => {
        if (screen.classList.contains('active')) {
            showToast('正在分析存储空间...');
            currentStorageSizes = await calculateStorageSize();
            renderStorageUI();
            updatePersistenceStatus();
        }
    });

    observer.observe(screen, { attributes: true, attributeFilter: ['class'] });

    // Select All Button
    const selectAllBtn = document.getElementById('storage-select-all-btn');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            const allSelected = Object.values(selectedModules).every(v => v);
            const newValue = !allSelected;
            Object.keys(selectedModules).forEach(k => selectedModules[k] = newValue);
            renderStorageUI();
        });
    }

    // Export Button
    const exportBtn = document.getElementById('storage-export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExport);
    }

    // Import Input
    const importInput = document.getElementById('storage-import-file');
    if (importInput) {
        importInput.addEventListener('change', handleImport);
    }

    async function updatePersistenceStatus() {
        if (navigator.storage && navigator.storage.persisted) {
            const isPersisted = await navigator.storage.persisted();
            let statusContainer = document.getElementById('storage-persistence-container');
            if (!statusContainer) return;
            
            statusContainer.innerHTML = `
                <div style="padding: 12px; background: #ffffff; border-radius: 10px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #abafb5; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div style="font-weight: bold; font-size: 0.9rem; color: #495057;">持久化存储保护</div>
                        <div style="font-size: 0.8rem; color: ${isPersisted ? '#51cf66' : '#ff922b'}; display: flex; align-items: center; gap: 4px;">
                            ${isPersisted ? '已开启 (数据受保护)' : '未开启 (容易被清理)'}
                        </div>
                    </div>
                    ${!isPersisted ? '<button id="manual-persist-btn" class="storage-action-btn" style="width: auto; padding: 6px 12px; font-size: 0.85rem; background: #f8f9fa; border: 1px solid #ced4da; color: #495057;">立即开启</button>' : ''}
                </div>
            `;

            const btn = document.getElementById('manual-persist-btn');
            if (btn) {
                btn.onclick = async () => {
                    const persisted = await navigator.storage.persist();
                    if (persisted) {
                        showToast("已成功开启持久化存储！");
                        updatePersistenceStatus();
                    } else {
                        showToast("开启失败，可能是浏览器策略限制。");
                    }
                };
            }
        }
    }
}

// --- 导出逻辑 ---
async function handleExport() {
    if (!Object.values(selectedModules).some(v => v)) {
        showToast('请至少选择一项要导出的数据');
        return;
    }

    const exportBtn = document.getElementById('storage-export-btn');
    const exportText = document.getElementById('storage-export-text');
    exportBtn.disabled = true;
    exportText.textContent = '处理中...';

    try {
        let exportData = {
            version: appVersion,
            timestamp: new Date().toISOString(),
            modules: {}
        };

        // 1. Chats & Contacts
        if (selectedModules.chats || selectedModules.contacts) {
            exportData.modules.characters = [];
            exportData.modules.groups = [];

            for (const char of db.characters) {
                let exportChar = await PhoneBackup.diskChat(char);
                if (!selectedModules.chats) {
                    exportChar.history = [];
                    exportChar.callHistory = [];
                    delete exportChar.archives;
                    delete exportChar.activeArchiveId;
                }
                if (!selectedModules.contacts) {
                    // If only exporting chats, we still need basic info to identify the char
                    exportChar = { id: char.id, name: char.name, history: exportChar.history, callHistory: char.callHistory, archives: exportChar.archives, activeArchiveId: char.activeArchiveId };
                }
                // 始终不导出 gallery
                exportChar.gallery = [];
                exportData.modules.characters.push(exportChar);
            }

            for (const group of db.groups) {
                let exportGroup = await PhoneBackup.diskChat(group);
                if (!selectedModules.chats) {
                    exportGroup.history = [];
                    exportGroup.callHistory = [];
                    delete exportGroup.archives;
                    delete exportGroup.activeArchiveId;
                }
                if (!selectedModules.contacts) {
                    exportGroup = { id: group.id, name: group.name, history: exportGroup.history, callHistory: group.callHistory, archives: exportGroup.archives, activeArchiveId: group.activeArchiveId };
                }
                exportData.modules.groups.push(exportGroup);
            }
        }

        // 2. Worldbooks
        if (selectedModules.worldbooks) {
            exportData.modules.worldBooks = db.worldBooks;
        }

        // 3. Personas
        if (selectedModules.personas) {
            exportData.modules.myPersonaPresets = db.myPersonaPresets;
            exportData.modules.homeSignature = db.homeSignature;
            exportData.modules.activePersonaId = db.activePersonaId;
        }

        // 4. Wallpapers
        if (selectedModules.wallpapers) {
            exportData.modules.wallpaper = db.wallpaper;
            exportData.modules.bubbleCssPresets = db.bubbleCssPresets;
            exportData.modules.globalCss = db.globalCss;
            exportData.modules.globalCssPresets = db.globalCssPresets;
            exportData.modules.myStickers = db.myStickers;
            exportData.modules.moreProfileCardBg = db.moreProfileCardBg;
            exportData.modules.themeSettings = db.themeSettings;
            exportData.modules.themePresets = db.themePresets;
        }

        // 5. Fonts
        if (selectedModules.fonts) {
            exportData.modules.fontUrl = db.fontUrl;
            exportData.modules.fontPresets = db.fontPresets;
        }

        // 6. Settings
        if (selectedModules.settings) {
            const settingsKeys = [
                'apiSettings', 'apiPresets', 'cotSettings', 'cotPresets', 'homeScreenMode', 
                'customIcons', 'insWidgetSettings', 'homeWidgetSettings', 'chatFolders', 
                'fontSizeScale', 'savedKeyboardHeight', 'statusBarPresets', 'globalSendSound', 
                'globalReceiveSound', 'multiMsgSoundEnabled', 'soundPresets', 'galleryPresets', 
                'hasSeenVideoCallDisclaimer', 'hasSeenVideoCallAvatarHint', 'workshopSettings', 
                'workshopLlmPresets', 'workshopPromptPresets', 'homeLayoutOrder', 'homeLayoutPages', 
                'widgetTemplates', 'addedWidgets', 'backupReminderSettings', 'stUnlocked', 'stickerMatchSettings',
                    'homePresets', 'activeHomePresetId', 'homePresetUndo'
            ];
            settingsKeys.forEach(key => {
                exportData.modules[key] = db[key];
            });
        }

        const chosen=new Set(Object.entries(selectedModules).filter(([,v])=>v).map(([k])=>k));
        if(Object.keys(window.KissAppData.groups).some(k=>chosen.has(k)))exportData.modules.appData=window.KissAppData.select(await window.KissAppData.snapshot(),chosen);
        const compressedBlob = await PhoneBackup.exportBlob(exportData.modules);
        const dataBlob = compressedBlob;
        try {
            const url = URL.createObjectURL(compressedBlob);
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", url);
            downloadAnchorNode.setAttribute("download", `UwU_Backup_${new Date().toISOString().slice(0,10)}.ee`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            URL.revokeObjectURL(url);
            
            showToast('导出成功');
        } catch (compressError) {
            console.warn('压缩导出失败，尝试降级为未压缩导出:', compressError);
            // 降级为未压缩的 JSON 导出
            const url = URL.createObjectURL(dataBlob);
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", url);
            downloadAnchorNode.setAttribute("download", `UwU_Backup_${new Date().toISOString().slice(0,10)}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            URL.revokeObjectURL(url);
            
            showToast('导出成功 (未压缩)');
        }
    } catch (error) {
        console.error('导出失败:', error);
        showToast('导出失败，请重试');
    } finally {
        exportBtn.disabled = false;
        exportText.textContent = '导出备份';
    }
}

// --- 导入逻辑 ---
async function handleImport(event) {
    const input=event.target, file=input.files?.[0]; if(!file)return;
    if(!Object.values(selectedModules).some(Boolean)){showToast('请至少选择一项要导入的数据类型');input.value='';return;}
    const label=document.getElementById('storage-import-label'),text=document.getElementById('storage-import-text');
    label?.classList.add('disabled');if(text)text.textContent='处理中…';
    try {
        const data=await PhoneBackup.readFile(file);
        const selected=await PhoneBackup.selectPrepared(data,selectedModules);
        const result=await PhoneBackup.importData(selected);
        if(!result.success)throw Error(result.error);
        showToast('导入成功，即将刷新');setTimeout(()=>location.reload(),1000);
    }catch(e){showToast('导入失败：'+e.message);}
    finally{input.value='';label?.classList.remove('disabled');if(text)text.textContent='导入选中数据';}
}
