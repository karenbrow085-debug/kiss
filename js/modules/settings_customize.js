// --- 个性化与外观设置逻辑 ---

function setupWallpaperApp() {
    kpSyncWallpaperPreview();
    if(document.body.dataset.kpWallpaperBound)return;
    document.body.dataset.kpWallpaperBound='true';
    document.body.addEventListener('change',event=>{
        if(['wallpaper-upload','kp-wallpaper-upload'].includes(event.target.id))kpApplyWallpaperFile(event.target);
    });
    document.body.addEventListener('click',async event=>{
        const control=event.target.closest('button');if(!control)return;
        if(control.id==='kp-wallpaper-link')document.getElementById('kp-wallpaper-url')?.focus();
        if(control.id==='kp-wallpaper-apply')kpApplyWallpaperURL();
        if(control.id==='kp-wallpaper-reset' && await kpConfirm('将桌面壁纸恢复为默认图片。','恢复默认壁纸')){
            const revision=++kpWallpaperRevision;
            try{await kpCommitWallpaper(KP_DEFAULT_WALLPAPER,revision);const field=document.getElementById('kp-wallpaper-url');if(field)field.value='';}
            catch{kpWallpaperStatus('壁纸保存失败，请重试',true);}
        }
    });
    document.body.addEventListener('submit',event=>{
        if(event.target.id!=='customize-form')return;
        event.preventDefault();
        if(document.activeElement?.id==='kp-wallpaper-url')kpApplyWallpaperURL();
    });
}

function setupCustomizeApp() {
    const customizeForm = document.getElementById('customize-form');
    
    document.body.addEventListener('click', async (e) => {
        const target = e.target;

        const header = target.closest('.collapsible-header');
        if (header) {
            const section = header.closest('.collapsible-section');
            if (section) {
                section.classList.toggle('open');
                return; 
            }
        }

        if (target.matches('.reset-icon-btn')) {
            const iconId = target.dataset.id;
            if (db.customIcons) {
                delete db.customIcons[iconId];
            }
            await saveData();
            renderCustomizeForm();
            setupHomeScreen();
            showToast('图标已重置');
        }

        if (target.matches('#apply-global-css-now-btn')) {
            const textarea = document.getElementById('global-beautification-css');
            const newCss = textarea.value;
            db.globalCss = newCss;
            applyGlobalCss(newCss);
            await saveData();
            showToast('全局样式已应用');
        }
        
        if (target.matches('#global-css-apply-btn')) {
            const select = document.getElementById('global-css-preset-select');
            const presetName = select.value;
            if (!presetName) return showToast('请选择一个预设');
            const preset = db.globalCssPresets.find(p => p.name === presetName);
            if (preset) {
                const textarea = document.getElementById('global-beautification-css');
                textarea.value = preset.css;
                db.globalCss = preset.css;
                applyGlobalCss(preset.css);
                saveData();
                showToast('全局CSS预设已应用');
            }
        }
        
        if (target.matches('#global-css-save-btn')) {
            const textarea = document.getElementById('global-beautification-css');
            const css = textarea.value.trim();
            if (!css) return showToast('CSS内容为空，无法保存');
            const name = await kpPrompt('保存 CSS 预设', '请输入预设名称，同名将覆盖。');
            if (!name) return;
            if (!db.globalCssPresets) db.globalCssPresets = [];
            const existingIndex = db.globalCssPresets.findIndex(p => p.name === name);
            if (existingIndex > -1) {
                db.globalCssPresets[existingIndex].css = css;
            } else {
                db.globalCssPresets.push({ name, css });
            }
            saveData();
            populateGlobalCssPresetSelect();
            showToast('全局CSS预设已保存');
        }
        
        if (target.matches('#global-css-manage-btn')) {
            openGlobalCssManageModal();
        }
        
        if (target.matches('#apply-font-btn')) {
            const fontUrl = document.getElementById('customize-font-url').value.trim();
            if (fontUrl.startsWith('[本地字体] ')) {
                const presetName = fontUrl.replace('[本地字体] ', '');
                applyFontPreset(presetName);
            } else {
                db.fontUrl = fontUrl;
                await saveData();
                applyGlobalFont(fontUrl, false);
                showToast('新字体已应用！');
            }
        }
        
        if (target.matches('#restore-font-btn')) {
            document.getElementById('customize-font-url').value = '';
            db.fontUrl = '';
            await saveData();
            applyGlobalFont('', false);
            showToast('已恢复默认字体！');
        }

        if (target.matches('#font-apply-preset-btn')) {
            const select = document.getElementById('font-preset-select');
            const presetName = select.value;
            if (!presetName) return showToast('请选择一个预设');
            applyFontPreset(presetName);
        }
        
        if (target.matches('#font-save-preset-btn')) {
            saveCurrentFontAsPreset();
        }
        
        if (target.matches('#font-manage-presets-btn')) {
            openFontManageModal();
        }

        if (target.matches('#sound-apply-preset-btn')) {
            const select = document.getElementById('sound-preset-select');
            const presetName = select.value;
            if (!presetName) return showToast('请选择一个预设');
            applySoundPreset(presetName);
        }
        
        if (target.matches('#sound-save-preset-btn')) {
            saveCurrentSoundAsPreset();
        }
        
        if (target.matches('#sound-manage-presets-btn')) {
            openSoundManageModal();
        }

        if (target.matches('#test-send-sound-btn')) {
            const url = document.getElementById('global-send-sound-url').value;
            if (url) {
                try {
                    const audio = new Audio(url);
                    audio.play().catch(e => showToast('播放失败: ' + e.message));
                } catch (e) {
                    showToast('无效的音频地址');
                }
            } else {
                showToast('未设置提示音');
            }
        }
        if (target.matches('#reset-send-sound-btn')) {
            document.getElementById('global-send-sound-url').value = '';
            db.globalSendSound = '';
            saveData();
            showToast('已重置');
        }
        if (target.matches('#test-receive-sound-btn')) {
            const url = document.getElementById('global-receive-sound-url').value;
            if (url) {
                try {
                    const audio = new Audio(url);
                    audio.play().catch(e => showToast('播放失败: ' + e.message));
                } catch (e) {
                    showToast('无效的音频地址');
                }
            } else {
                showToast('未设置提示音');
            }
        }
        if (target.matches('#reset-receive-sound-btn')) {
            document.getElementById('global-receive-sound-url').value = '';
            db.globalReceiveSound = '';
            saveData();
            showToast('已重置');
        }
    });

    document.body.addEventListener('input', async (e) => {
        const target = e.target;

        if (target.dataset.iconId) { 
            const iconId = target.dataset.iconId;
            const newUrl = target.value.trim();
            const previewImg = document.getElementById(`icon-preview-${iconId}`);
            if (newUrl) {
                if (!db.customIcons) db.customIcons = {};
                db.customIcons[iconId] = newUrl;
                if(previewImg) previewImg.src = newUrl;
            }
            await saveData();
            setupHomeScreen();
        } 
        else if (target.dataset.widgetPart) {
            const part = target.dataset.widgetPart;
            const prop = target.dataset.widgetProp;
            const newValue = target.value.trim();

            if (prop) { 
                db.homeWidgetSettings[part][prop] = newValue;
            } else { 
                db.homeWidgetSettings[part] = newValue;
            }
            await saveData();
            setupHomeScreen();
        }
    });

    document.body.addEventListener('change', async (e) => {
        if (e.target.id === 'local-font-upload') {
            const file = e.target.files[0];
            if (!file) return;
            
            const validTypes = ['font/ttf', 'font/woff', 'font/woff2', 'font/otf'];
            const validExtensions = ['.ttf', '.woff', '.woff2', '.otf'];
            const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            
            if (!validTypes.includes(file.type) && !validExtensions.includes(fileExt)) {
                showToast('不支持的字体格式，请上传 ttf, woff, woff2 或 otf 文件');
                e.target.value = '';
                return;
            }

            try {
                showToast('正在处理字体文件...');
                const presetId = 'font_' + Date.now();
                const fontFamily = 'CustomFont_' + Date.now();
                
                await dexieDB.customFonts.put({
                    id: presetId,
                    file: file,
                    timestamp: Date.now()
                });

                const presetName = file.name.substring(0, file.name.lastIndexOf('.'));
                const newPreset = {
                    id: presetId,
                    name: presetName,
                    isCustom: true,
                    fontFamily: fontFamily
                };

                const presets = _getFontPresets();
                presets.push(newPreset);
                _saveFontPresets(presets);
                
                await injectCustomFont(newPreset);
                populateFontPresetSelect();
                
                const select = document.getElementById('font-preset-select');
                if (select) {
                    select.value = presetName;
                    await applyFontPreset(presetName);
                }
                
                showToast('本地字体已上传并应用');
            } catch (error) {
                console.error('字体上传失败:', error);
                showToast('字体上传失败，请重试');
            } finally {
                e.target.value = '';
            }
        }

        if (e.target.matches('.icon-upload-input')) {
            const file = e.target.files[0];
            if (!file) return;
            const iconId = e.target.dataset.iconId;
            
            try {
                showToast('正在处理图片...');
                const compressedUrl = await compressImage(file, { quality: 0.8, maxWidth: 200, maxHeight: 200 });
                
                if (!db.customIcons) db.customIcons = {};
                db.customIcons[iconId] = compressedUrl;
                
                const previewImg = document.getElementById(`icon-preview-${iconId}`);
                const urlInput = document.querySelector(`input[data-icon-id="${iconId}"][type="url"]`);
                
                if (previewImg) previewImg.src = compressedUrl;
                if (urlInput) urlInput.value = compressedUrl;
                
                await saveData();
                setupHomeScreen();
                showToast('图标已更新');
            } catch (error) {
                console.error('图标上传失败', error);
                showToast('图片处理失败，请重试');
            } finally {
                e.target.value = null;
            }
        }

        if (e.target.id === 'global-send-sound-url') {
            db.globalSendSound = e.target.value.trim();
            saveData();
        }
        if (e.target.id === 'global-receive-sound-url') {
            db.globalReceiveSound = e.target.value.trim();
            saveData();
        }
        if (e.target.id === 'multi-msg-sound-switch') {
            db.multiMsgSoundEnabled = e.target.checked;
            saveData();
        }
        if (e.target.id === 'global-send-sound-upload' || e.target.id === 'global-receive-sound-upload') {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                showToast('文件过大，请限制在 2MB 以内');
                e.target.value = null;
                return;
            }
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const base64 = evt.target.result;
                if (e.target.id === 'global-send-sound-upload') {
                    db.globalSendSound = base64;
                    document.getElementById('global-send-sound-url').value = base64;
                } else {
                    db.globalReceiveSound = base64;
                    document.getElementById('global-receive-sound-url').value = base64;
                }
                await saveData();
                showToast('提示音已上传');
            };
            reader.readAsDataURL(file);
            e.target.value = null;
        }
    });
}

function renderCustomizeForm() {
    const customizeForm = document.getElementById('customize-form');
    customizeForm.innerHTML = ''; 
    
    const container = document.createElement('div');
    container.className = 'kkt-settings-container';
    
    const iconOrder = [
        'chat-list-screen', 'api-settings-screen', 'wallpaper-screen',
        'world-book-screen', 'customize-screen', 'tutorial-screen',
        'day-mode-btn', 'night-mode-btn', 'forum-screen', 'music-screen', 'console-screen', 'pomodoro-screen', 'storage-analysis-screen', 'widget-market-screen', 'reader-bookshelf-screen', 'placeholder-app', 'mono-app', 'mcp-screen', 'morrow-app'
    ];

    let iconsContentHTML = '';
    iconOrder.forEach(id => {
        if (!defaultIcons[id]) return;
        const { name, url } = defaultIcons[id];
        const currentIcon = (db.customIcons && db.customIcons[id]) || url;
        iconsContentHTML += `
        <div class="kkt-item">
            <div class="kkt-item-label">
                <img src="${currentIcon}" alt="${name}" class="kkt-small-avatar" id="icon-preview-${id}" style="width: 40px; height: 40px; border-radius: 10px; margin-right: 10px; object-fit: cover;">
                <span>${name || '模式切换'}</span>
            </div>
            <div class="kkt-item-control" style="gap: 8px;">
                <input type="url" placeholder="URL" value="${(db.customIcons && db.customIcons[id]) || ''}" data-icon-id="${id}" style="text-align:right; border:none; background:transparent; width: 100px; font-size: 13px; color: #888;">
                <input type="file" id="upload-icon-${id}" data-icon-id="${id}" accept="image/*" style="display:none;" class="icon-upload-input">
                <label for="upload-icon-${id}" class="btn btn-small btn-neutral" style="padding: 4px 8px; font-size: 12px; margin: 0; cursor: pointer;">上传</label>
                <button type="button" class="reset-icon-btn btn btn-small" data-id="${id}" style="padding: 4px 8px; font-size: 12px; margin: 0; background-color: #f0f0f0; color: #666; border:none;">↺</button>
            </div>
        </div>`;
    });

    container.className = 'kp-settings';
    const kpIcon = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
    const kpRow = (label, modal, paths, detail = '') => `<button type="button" class="kp-row" onclick="document.getElementById('${modal}').classList.add('visible')"><span class="kp-row-icon">${kpIcon(paths)}</span><span class="kp-row-label">${label}</span>${detail ? `<small>${detail}</small>` : '<span class="kp-chevron">›</span>'}</button>`;
    const wallpaperSection = `
      <section id="kp-wallpaper" class="kp-wallpaper">
        <div id="kp-wallpaper-preview" class="kp-wallpaper-preview" role="img" aria-label="当前壁纸"><span>壁纸</span></div>
        <div class="kp-wallpaper-tools">
          <label for="kp-wallpaper-upload" class="kp-upload">${kpIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>')}<span>相册上传</span></label>
          <button type="button" id="kp-wallpaper-link">${kpIcon('<path d="m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m4 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 -1)"/>')}<span>图片 URL</span></button>
          <button type="button" id="kp-wallpaper-reset">恢复默认</button>
          <input type="file" id="kp-wallpaper-upload" accept="image/*" hidden>
        </div>
        <div class="kp-url-row"><input type="url" id="kp-wallpaper-url" placeholder="粘贴图片链接" aria-label="壁纸图片链接" autocomplete="off" spellcheck="false"><button type="button" id="kp-wallpaper-apply">应用</button></div>
        <p id="kp-wallpaper-status" class="kp-inline-status" role="status" aria-live="polite"></p>
      </section>`;
    const appearanceSection = `<section class="kp-section"><h2>字体与外观</h2><div class="kp-size-setting"><div><span class="kp-size-mark">aA</span><span>全局字体大小</span><output id="font-size-value">${(db.fontSizeScale || 1).toFixed(1)}×</output></div><input type="range" id="font-size-slider" min="0.8" max="1.5" step="0.1" value="${db.fontSizeScale || 1}" aria-label="全局字体大小"></div>${kpRow('自定义字体','font-settings-modal','<path d="M4 5h16M12 5v15M8 20h8M4 5v3m16-3v3"/>','上传 / 链接')}${kpRow('全局 CSS 美化','global-css-modal','<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>','编辑样式')}</section>`;
    const iconsSectionHTML = `<section class="kp-section kp-desktop-section"><h2>桌面</h2>${kpRow('自定义图标','icon-settings-modal','<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>')}</section>`;
    const soundSectionHTML = `<section class="kp-section"><h2>声音</h2>${kpRow('消息提示音','sound-settings-modal','<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>')}</section>`;
    container.innerHTML = wallpaperSection + appearanceSection + iconsSectionHTML + soundSectionHTML;
    customizeForm.appendChild(container);

    // 注入模态框 HTML 到 body (如果不存在)
    if (!document.getElementById('font-settings-modal')) {
        const modalsHTML = `
        <!-- 字体设置模态框 -->
        <div id="font-settings-modal" class="modal-overlay">
            <div class="modal-window" style="max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0;">自定义字体</h3>
                    <button class="icon-btn-simple" onclick="document.getElementById('font-settings-modal').classList.remove('visible')">✕</button>
                </div>
                <div class="form-group" style="margin-top: 15px;">
                    <input type="text" id="customize-font-url" placeholder="例如：https://example.com/font.woff2" value="${db.fontUrl && db.fontUrl.startsWith('CustomFont_') ? '[本地字体] 已应用' : (db.fontUrl || '')}" style="width:100%; border:1px solid #eee; border-radius:8px; padding:10px; font-size: 14px;">
                </div>
                <div class="form-group" style="margin-top: 10px;">
                    <input type="file" id="local-font-upload" accept=".ttf,.woff,.woff2,.otf" style="display: none;">
                    <label for="local-font-upload" class="btn btn-secondary" style="display: block; text-align: center; cursor: pointer; padding: 10px; border-radius: 8px; border: 1px dashed #ccc; background: #fafafa; color: #666;">
                        从本地上传字体文件
                    </label>
                </div>
                <div style="background:#f9f9f9; padding:10px; border-radius:8px; margin-top:15px; border: 1px solid #f0f0f0;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                        <label for="font-preset-select" style="width:auto;color:#666;font-size:13px;">预设库</label>
                        <select id="font-preset-select" style="flex:1;padding:6px;border-radius:6px;border:1px solid #ddd;font-size:13px; background: transparent;"><option value="">— 选择 —</option></select>
                    </div>
                    <div style="display:flex;gap:8px;justify-content: flex-end;">
                        <button type="button" id="font-apply-preset-btn" class="btn btn-small btn-primary" style="padding:4px 8px;">应用</button>
                        <button type="button" id="font-save-preset-btn" class="btn btn-small" style="padding:4px 8px;">保存</button>
                        <button type="button" id="font-manage-presets-btn" class="btn btn-small" style="padding:4px 8px;">管理</button>
                    </div>
                </div>
                <div style="display:flex; gap:10px; justify-content: flex-end; margin-top: 15px;">
                    <button type="button" id="restore-font-btn" class="btn btn-neutral btn-small">恢复默认</button>
                    <button type="button" id="apply-font-btn" class="btn btn-primary btn-small">直接应用</button>
                </div>
            </div>
        </div>

        <!-- 全局CSS模态框 -->
        <div id="global-css-modal" class="modal-overlay">
            <div class="modal-window" style="max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0;">全局CSS美化</h3>
                    <button class="icon-btn-simple" onclick="document.getElementById('global-css-modal').classList.remove('visible')">✕</button>
                </div>
                <div class="form-group" style="margin-top: 15px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <label for="global-beautification-css" style="font-weight: bold; font-size: 14px; color: var(--primary-color); margin-bottom: 0;">CSS代码</label>
                        <button type="button" id="apply-global-css-now-btn" class="btn btn-primary btn-small" style="width:auto;">立即应用</button>
                    </div>
                    <textarea id="global-beautification-css" class="form-group" rows="8" placeholder="在此输入CSS代码..." style="width:100%; border:1px solid #eee; border-radius:8px; padding:10px; font-family: monospace; font-size: 12px;"></textarea>
                </div>
                <div style="background:#f9f9f9; padding:10px; border-radius:8px; border: 1px solid #f0f0f0;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                        <label for="global-css-preset-select" style="width:auto;color:#666;font-size:13px;">预设库</label>
                        <select id="global-css-preset-select" style="flex:1;padding:6px;border-radius:6px;border:1px solid #ddd;font-size:13px; background: transparent;"><option value="">-- 选择 --</option></select>
                    </div>
                    <div style="display:flex;gap:8px;justify-content: flex-end;">
                        <button type="button" id="global-css-apply-btn" class="btn btn-small btn-primary" style="padding:4px 8px;">应用</button>
                        <button type="button" id="global-css-save-btn" class="btn btn-small" style="padding:4px 8px;">保存</button>
                        <button type="button" id="global-css-manage-btn" class="btn btn-small" style="padding:4px 8px;">管理</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 提示音设置模态框 -->
        <div id="sound-settings-modal" class="modal-overlay">
            <div class="modal-window" style="max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0;">消息提示音</h3>
                    <button class="icon-btn-simple" onclick="document.getElementById('sound-settings-modal').classList.remove('visible')">✕</button>
                </div>
                <div class="form-group" style="margin-top: 15px; margin-bottom: 15px;">
                    <label style="font-weight: bold; font-size: 13px; color: #333;">开始生成提示音</label>
                    <div style="display: flex; gap: 8px; margin-top: 5px;">
                        <input type="url" id="global-send-sound-url" placeholder="音频URL" value="${db.globalSendSound || ''}" style="flex: 1; border: 1px solid #eee; border-radius: 8px; padding: 8px; font-size: 13px;">
                        <input type="file" id="global-send-sound-upload" accept="audio/*" style="display: none;">
                        <label for="global-send-sound-upload" class="btn btn-secondary btn-small" style="margin: 0; display: flex; align-items: center; cursor: pointer;">上传</label>
                        <button type="button" id="test-send-sound-btn" class="btn btn-primary btn-small" style="margin: 0;">▶</button>
                        <button type="button" id="reset-send-sound-btn" class="btn btn-danger btn-small" style="margin: 0;">×</button>
                    </div>
                </div>
                <div class="form-group">
                    <label style="font-weight: bold; font-size: 13px; color: #333;">收到回复提示音</label>
                    <div style="display: flex; gap: 8px; margin-top: 5px;">
                        <input type="url" id="global-receive-sound-url" placeholder="音频URL" value="${db.globalReceiveSound || ''}" style="flex: 1; border: 1px solid #eee; border-radius: 8px; padding: 8px; font-size: 13px;">
                        <input type="file" id="global-receive-sound-upload" accept="audio/*" style="display: none;">
                        <label for="global-receive-sound-upload" class="btn btn-secondary btn-small" style="margin: 0; display: flex; align-items: center; cursor: pointer;">上传</label>
                        <button type="button" id="test-receive-sound-btn" class="btn btn-primary btn-small" style="margin: 0;">▶</button>
                        <button type="button" id="reset-receive-sound-btn" class="btn btn-danger btn-small" style="margin: 0;">×</button>
                    </div>
                </div>
                
                <div class="form-group" style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <label for="multi-msg-sound-switch" style="font-weight: bold; font-size: 13px; color: #333; margin-bottom: 0;">多条消息连续提示音</label>
                    <label class="kkt-switch">
                        <input type="checkbox" id="multi-msg-sound-switch" ${db.multiMsgSoundEnabled ? 'checked' : ''}>
                        <span class="kkt-slider"></span>
                    </label>
                </div>
                <p style="font-size: 12px; color: #999; margin-top: 5px;">开启后，AI 连续回复的多条消息都会触发提示音。</p>

                <div style="background:#f9f9f9; padding:10px; border-radius:8px; margin-top:15px; border: 1px solid #f0f0f0;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                        <label for="sound-preset-select" style="width:auto;color:#666;font-size:13px;">预设库</label>
                        <select id="sound-preset-select" style="flex:1;padding:6px;border-radius:6px;border:1px solid #ddd;font-size:13px; background: transparent;"><option value="">— 选择 —</option></select>
                    </div>
                    <div style="display:flex;gap:8px;justify-content: flex-end;">
                        <button type="button" id="sound-apply-preset-btn" class="btn btn-small btn-primary" style="padding:4px 8px;">应用</button>
                        <button type="button" id="sound-save-preset-btn" class="btn btn-small" style="padding:4px 8px;">保存</button>
                        <button type="button" id="sound-manage-presets-btn" class="btn btn-small" style="padding:4px 8px;">管理</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 自定义图标模态框 -->
        <div id="icon-settings-modal" class="modal-overlay">
            <div class="modal-window" style="max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0;">自定义图标</h3>
                    <button class="icon-btn-simple" onclick="document.getElementById('icon-settings-modal').classList.remove('visible')">✕</button>
                </div>
                <div style="border-top: 1px solid #f5f5f5; padding-top: 15px;">
                    ${iconsContentHTML}
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalsHTML);
    } else {
        // 更新模态框内容
        document.getElementById('icon-settings-modal').querySelector('.modal-window > div:last-child').innerHTML = iconsContentHTML;
        const globalCssTextarea = document.getElementById('global-beautification-css');
        if (globalCssTextarea) {
            globalCssTextarea.value = db.globalCss || '';
        }
    }

    populateGlobalCssPresetSelect();
    populateFontPresetSelect();
    populateSoundPresetSelect();

    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeValue = document.getElementById('font-size-value');
    if (fontSizeSlider) {
        fontSizeSlider.addEventListener('input', (e) => {
            const scale = parseFloat(e.target.value);
            fontSizeValue.textContent = `${scale.toFixed(1)}×`;
            e.target.style.setProperty('--kp-font-progress',((scale-.8)/.7*100)+'%');
            applyFontSize(scale);
        });
        fontSizeSlider.addEventListener('change', async (e) => {
            const scale = parseFloat(e.target.value);
            db.fontSizeScale = scale;
            await saveData();
            showToast('字体大小已保存');
        });
    }

    const globalCssTextarea = document.getElementById('global-beautification-css');
    if (globalCssTextarea) {
        globalCssTextarea.value = db.globalCss || '';
    }
    kpPreparePersonalization();
}

// Personalization dialogs and wallpaper controls share the same saved settings.
const KP_DEFAULT_WALLPAPER = 'https://i.postimg.cc/W4Z9R9x4/ins-1.jpg';
let kpWallpaperRevision = 0, kpWallpaperQueue = Promise.resolve(), kpQuestionQueue = Promise.resolve();
function kpSyncWallpaperPreview(){
    for(const id of ['kp-wallpaper-preview','wallpaper-preview']){
        const el=document.getElementById(id);if(el)el.style.backgroundImage='url('+JSON.stringify(db.wallpaper || KP_DEFAULT_WALLPAPER)+')';
    }
}
function kpPreparePersonalization(){
    const screen=document.getElementById('customize-screen');
    screen?.classList.add('kp-screen');
    const header=screen?.querySelector('.app-header');
    const slot=header?.querySelector('.placeholder');
    if(slot){slot.classList.add('kp-brand');slot.textContent='kiss';}
    kpSyncWallpaperPreview();
    document.getElementById('font-size-slider')?.style.setProperty('--kp-font-progress',(((db.fontSizeScale || 1)-.8)/.7*100)+'%');
    for(const id of ['font-settings-modal','global-css-modal','sound-settings-modal','icon-settings-modal','font-presets-modal','global-css-presets-modal','sound-presets-modal']){
        const modal=document.getElementById(id);if(!modal)continue;
        modal.classList.add('kp-modal');
        const panel=modal.querySelector('.modal-window');
        if(panel){panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');const heading=panel.querySelector('h3');if(heading){heading.id ||= id+'-title';panel.setAttribute('aria-labelledby',heading.id);}}
    }
}
function kpQuestion(options){
    const run=()=>new Promise(resolve=>{
        const previous=document.activeElement,overlay=document.createElement('div');
        overlay.className='modal-overlay kp-modal kp-question visible';
        overlay.innerHTML='<form class="modal-window kp-question-panel" role="dialog" aria-modal="true"><header><h3></h3><button type="button" class="kp-question-close" aria-label="关闭">×</button></header><p class="kp-question-description"></p><input class="kp-question-input" autocomplete="off" maxlength="100"><footer><button type="button" class="kp-question-cancel">取消</button><button type="submit" class="btn-primary kp-question-accept">确认</button></footer></form>';
        const form=overlay.querySelector('form'),input=overlay.querySelector('input'),heading=overlay.querySelector('h3');
        const titleId='kp-question-'+Math.random().toString(36).slice(2);heading.id=titleId;heading.textContent=options.title;form.setAttribute('aria-labelledby',titleId);
        overlay.querySelector('p').textContent=options.description || '';
        input.hidden=!!options.confirm;input.value=options.value || '';input.setAttribute('aria-label',options.title);
        let closed=false;
        const close=value=>{if(closed)return;closed=true;overlay.remove();if(previous?.isConnected)previous.focus({preventScroll:true});resolve(value);};
        form.onsubmit=e=>{e.preventDefault();if(options.confirm)return close(true);const value=input.value.trim();if(!value){input.focus();return;}close(value);};
        overlay.querySelector('.kp-question-close').onclick=()=>close(null);
        overlay.querySelector('.kp-question-cancel').onclick=()=>close(null);
        overlay.onclick=e=>{if(e.target===overlay)close(null);};
        overlay.onkeydown=e=>{
            if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(null);}
            if(e.key==='Tab'){
                const controls=[...form.querySelectorAll('input,button')].filter(el=>!el.hidden&&!el.disabled),first=controls[0],last=controls.at(-1);
                if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
                else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
            }
        };
        document.body.appendChild(overlay);
        requestAnimationFrame(()=>{if(closed)return;const target=options.confirm?overlay.querySelector('.kp-question-cancel'):input;target.focus();if(!options.confirm)input.select();});
    });
    const answer=kpQuestionQueue.then(run,run);kpQuestionQueue=answer.then(()=>undefined,()=>undefined);return answer;
}
function kpPrompt(title,description='',value=''){return kpQuestion({title,description,value});}
function kpConfirm(description,title='确认操作'){return kpQuestion({title,description,confirm:true});}
function kpWallpaperStatus(message,error=false){
    const el=document.getElementById('kp-wallpaper-status');if(el){el.textContent=message;el.classList.toggle('is-error',error);}
}
function kpCheckWallpaperImage(url){
    return new Promise((resolve,reject)=>{
        const image=new Image();
        const timer=setTimeout(()=>finish(Error('图片加载超时，请检查链接')),15000);
        const finish=error=>{clearTimeout(timer);image.onload=image.onerror=null;error?reject(error):resolve();};
        image.onload=()=>image.naturalWidth&&image.naturalHeight?finish():finish(Error('链接没有返回有效图片'));
        image.onerror=()=>finish(Error('图片无法加载，请使用可直接打开的图片链接'));
        // No canvas or credential request: cross-origin image hosts can be used directly.
        image.src=url;
    });
}
function kpCommitWallpaper(value,revision){
    const commit=async()=>{
        if(revision!==kpWallpaperRevision)return false;
        const previous=db.wallpaper;db.wallpaper=value;applyWallpaper(value);kpSyncWallpaperPreview();
        try{await saveData();}
        catch(error){if(db.wallpaper===value){db.wallpaper=previous;applyWallpaper(previous);kpSyncWallpaperPreview();}throw error;}
        if(revision===kpWallpaperRevision){kpWallpaperStatus('壁纸已更新');showToast('壁纸已更新');}
        return true;
    };
    const task=kpWallpaperQueue.then(commit,commit);kpWallpaperQueue=task.catch(()=>{});return task;
}
async function kpApplyWallpaperURL(){
    const input=document.getElementById('kp-wallpaper-url');if(!input)return;
    let url;try{url=new URL(input.value.trim());if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error();}
    catch{kpWallpaperStatus('请填写有效的 http 或 https 图片链接',true);input.focus();return;}
    const revision=++kpWallpaperRevision;kpWallpaperStatus('正在检查图片…');
    try{await kpCheckWallpaperImage(url.href);await kpCommitWallpaper(url.href,revision);}
    catch(error){if(revision===kpWallpaperRevision)kpWallpaperStatus(error.message || '壁纸保存失败，请重试',true);}
}
async function kpApplyWallpaperFile(input){
    const file=input.files?.[0];if(!file)return;
    const revision=++kpWallpaperRevision;kpWallpaperStatus('正在处理图片…');
    try{
        const value=await compressImage(file,{quality:.85,maxWidth:1080,maxHeight:1920});
        const saved=await kpCommitWallpaper(value,revision);
        if(saved){const field=document.getElementById('kp-wallpaper-url');if(field)field.value='';}
    }catch(error){if(revision===kpWallpaperRevision){kpWallpaperStatus('图片处理或保存失败，请重试',true);showToast('壁纸未保存，请重试');}}
    finally{input.value='';}
}
