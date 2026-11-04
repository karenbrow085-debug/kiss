// --- 表情包管理 (js/modules/sticker.js) ---

function stickerImageSource(value) {
    const src = String(value || '').trim();
    if (/^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,[a-z0-9+/=\s]+$/i.test(src)) return src;
    try { const url = new URL(src); return ['https:','http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}

function parseStickerRows(text) {
    const cleaned = text.replace(/^\uFEFF/, '').trim();
    if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
        let data;
        try { data = JSON.parse(cleaned); } catch { throw Error('JSON 格式错误'); }
        const rows = Array.isArray(data) ? data : data?.stickers || data?.myStickers || data?.modules?.myStickers;
        if (!Array.isArray(rows)) throw Error('文件里没有表情包列表');
        return rows;
    }
    return cleaned.split(/\r?\n/).flatMap(line => {
        const match = line.match(/^\s*(.+?)\s*[:：]\s*((?:https?:\/\/|data:image\/).+)$/i);
        return match ? [{name:match[1],data:match[2]}] : [];
    });
}

async function readStickerFile(file) {
    if (file.size > 32 * 1024 * 1024) throw Error('表情包文件需小于 32 MB');
    if (!/\.docx$/i.test(file.name)) return parseStickerRows(await file.text());
    if (!window.mammoth) throw Error('Word 读取器未加载');
    const output = await window.mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()});
    const doc = new DOMParser().parseFromString(output.value,'text/html');
    const rows = [];
    for (const block of doc.querySelectorAll('p,li,h1,h2,h3')) {
        const name = block.textContent.trim().replace(/[:：]$/, '');
        const images = [...block.querySelectorAll('img')];
        const links = [...block.querySelectorAll('a[href]')];
        const parsed = parseStickerRows(block.textContent);
        if (parsed.length) rows.push(...parsed);
        else if (links.length) for (const link of links) rows.push({name:link.textContent.trim() || name,data:link.getAttribute('href')});
        for (const img of images) rows.push({name:name || img.alt || '表情 ' + (rows.length + 1),data:img.getAttribute('src')});
    }
    return rows;
}

async function setupStickerSystem() {
    const stickerMenuBtn = document.getElementById('sticker-menu-btn');
    const stickerMenuActionSheet = document.getElementById('sticker-menu-actionsheet');
    const stickerCategoryBar = document.getElementById('sticker-category-bar');
    
    const menuMultiSelectBtn = document.getElementById('menu-multi-select-btn');
    const menuBatchImportBtn = document.getElementById('menu-batch-import-btn');
    const menuAddNewBtn = document.getElementById('menu-add-new-btn');
    const menuCancelBtn = document.getElementById('menu-cancel-btn');

    const deleteSelectedStickersBtn = document.getElementById('delete-selected-stickers-btn');
    const moveStickerGroupBtn = document.getElementById('move-sticker-group-btn');
    const stickerManageBar = document.getElementById('sticker-manage-bar');
    const selectAllStickersBtn = document.getElementById('select-all-stickers-btn');

    const moveStickerModal = document.getElementById('move-sticker-modal');
    const moveTargetGroupInput = document.getElementById('move-target-group-input');
    const confirmMoveStickerBtn = document.getElementById('confirm-move-sticker-btn');
    const cancelMoveStickerBtn = document.getElementById('cancel-move-sticker-btn');
    const existingGroupsList = document.getElementById('existing-groups-list');

    const batchAddStickerModal = document.getElementById('batch-add-sticker-modal');
    const batchAddStickerForm = document.getElementById('batch-add-sticker-form');
    const stickerUrlsTextarea = document.getElementById('sticker-urls-textarea');
    const batchStickerGroupInput = document.getElementById('batch-sticker-group');
    const addStickerModal = document.getElementById('add-sticker-modal');
    const addStickerForm = document.getElementById('add-sticker-form');
    const stickerNameInput = document.getElementById('sticker-name');
    const stickerGroupInput = document.getElementById('sticker-group');
    const stickerEditIdInput = document.getElementById('sticker-edit-id');
    const stickerPreview = document.getElementById('sticker-preview');
    const stickerUrlInput = document.getElementById('sticker-url-input');
    const stickerFileUpload = document.getElementById('sticker-file-upload');
    const addStickerModalTitle = document.getElementById('add-sticker-modal-title');

    const batchFile = document.getElementById('batch-sticker-file');
    const batchStatus = document.getElementById('batch-sticker-status');
    let fileRows = [], reading = false, importing = false;
    function syncGroups() {
        const groups = [...new Set(db.myStickers.map(s => s.group).filter(Boolean))];
        existingGroupsList.replaceChildren(...groups.map(g => new Option(g,g)));
        for (const picker of document.querySelectorAll('[data-sticker-group-picker]')) {
            picker.replaceChildren(new Option('选择已有分组',''),...groups.map(g => new Option(g,g)));
            picker.hidden = !groups.length;
        }
    }
    for (const picker of document.querySelectorAll('[data-sticker-group-picker]')) {
        picker.addEventListener('change',() => {
            if (picker.value) document.getElementById(picker.dataset.stickerGroupPicker).value = picker.value;
            picker.value = '';
        });
    }
    for (const modal of [addStickerModal,batchAddStickerModal]) {
        modal.querySelector('[data-sticker-dismiss]')?.addEventListener('click',() => modal.classList.remove('visible'));
    }
    batchFile.addEventListener('change',async () => {
        fileRows = [];
        const file = batchFile.files[0];
        if (!file) { reading = false; batchStatus.textContent = ''; return; }
        reading = true;
        batchStatus.textContent = '正在读取…';
        try {
            const rows = await readStickerFile(file);
            if (batchFile.files[0] !== file) return;
            fileRows = rows;
            batchStatus.textContent = file.name + ' · ' + rows.length + ' 项';
        } catch (error) { if (batchFile.files[0] === file) batchStatus.textContent = error.message; }
        finally { if (batchFile.files[0] === file) reading = false; }
    });
    document.getElementById('sticker-export-btn').addEventListener('click',async event => {
        const button = event.currentTarget;
        if (button.disabled) return;
        button.disabled = true;
        try {
            const stickers = await PhoneBackup.expand(db.myStickers);
            const file = new Blob([JSON.stringify({format:'kiss-stickers',version:1,stickers})],{type:'application/json'});
            PhoneBackup.download(file,'KISS-stickers.json');
            stickerMenuActionSheet.classList.remove('visible');
        } catch (error) { showToast(error.message); }
        finally { button.disabled = false; }
    });

    stickerMenuBtn.addEventListener('click', () => {
        if (isStickerManageMode) {
            exitStickerManageMode();
        } else {
            syncGroups();
            stickerMenuActionSheet.classList.add('visible');
        }
    });

    menuCancelBtn.addEventListener('click', () => stickerMenuActionSheet.classList.remove('visible'));

    menuMultiSelectBtn.addEventListener('click', () => {
        stickerMenuActionSheet.classList.remove('visible');
        enterStickerManageMode();
    });

    function enterStickerManageMode() {
        isStickerManageMode = true;
        stickerManageBar.style.display = 'block';
        
        stickerMenuBtn.innerHTML = '<span style="font-size:14px; font-weight:bold; color:var(--primary-color);">完成</span>';
        selectedStickerIds.clear();
        updateStickerSelectCount();
        renderStickerGrid(); 
    }

    function exitStickerManageMode() {
        isStickerManageMode = false;
        stickerManageBar.style.display = 'none';
        
        stickerMenuBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z" /></svg>';
        selectedStickerIds.clear();
        renderStickerGrid();
    }

    function updateStickerSelectCount() {
        const count = selectedStickerIds.size;
        document.getElementById('sticker-select-count').textContent = `已选 ${count} 项`;
        deleteSelectedStickersBtn.disabled = count === 0;
        moveStickerGroupBtn.disabled = count === 0;
    }

    menuBatchImportBtn.addEventListener('click', () => {
        stickerMenuActionSheet.classList.remove('visible');
        batchAddStickerModal.classList.add('visible');
        batchFile.value = ''; fileRows = []; reading = false; batchStatus.textContent = '';
        stickerUrlsTextarea.value = '';
        batchStickerGroupInput.value = '';
    });

    menuAddNewBtn.addEventListener('click', () => {
        stickerMenuActionSheet.classList.remove('visible');
        addStickerModalTitle.textContent = '添加新表情';
        addStickerForm.reset();
        stickerEditIdInput.value = '';
        stickerPreview.innerHTML = '<span>预览</span>';
        stickerUrlInput.disabled = false;
        addStickerModal.classList.add('visible');
    });

    const itemMenu = document.getElementById('sticker-actionsheet');
    document.getElementById('edit-sticker-btn').addEventListener('click',() => {
        const sticker = db.myStickers.find(s => s.id === currentStickerActionTarget);
        itemMenu.classList.remove('visible');
        if (!sticker) return;
        syncGroups();
        addStickerForm.reset();
        stickerEditIdInput.value = sticker.id;
        stickerNameInput.value = sticker.name;
        stickerGroupInput.value = sticker.group || '';
        stickerUrlInput.value = /^https?:/i.test(sticker.data) ? sticker.data : '';
        const image = new Image();
        image.src = sticker.data;
        image.alt = '预览';
        stickerPreview.replaceChildren(image);
        addStickerModalTitle.textContent = '编辑表情';
        addStickerModal.classList.add('visible');
    });
    document.getElementById('delete-sticker-btn').addEventListener('click',async () => {
        const id = currentStickerActionTarget;
        if (!db.myStickers.some(s => s.id === id) || !confirm('删除这张表情？')) return;
        try {
            await dexieDB.myStickers.delete(id);
            db.myStickers = db.myStickers.filter(s => s.id !== id);
            itemMenu.classList.remove('visible');
            renderStickerCategories();
            renderStickerGrid();
        } catch (error) { showToast(error.message); }
    });

    selectAllStickersBtn.addEventListener('click', () => {
        let stickersToSelect = [];
        
        if (currentStickerCategory === 'recent') {
            stickersToSelect = [...db.myStickers]
                .sort((a, b) => (b.lastUsedTime || 0) - (a.lastUsedTime || 0))
                .slice(0, 20);
        } else if (currentStickerCategory === 'all') {
            stickersToSelect = [...db.myStickers];
        } else if (currentStickerCategory === 'ungrouped') {
            stickersToSelect = db.myStickers.filter(s => !s.group);
        } else {
            stickersToSelect = db.myStickers.filter(s => s.group === currentStickerCategory);
        }

        stickersToSelect.forEach(s => selectedStickerIds.add(s.id));
        
        updateStickerSelectCount();
        renderStickerGrid();
        showToast(`已全选当前分组 ${stickersToSelect.length} 个表情`);
    });

    deleteSelectedStickersBtn.addEventListener('click', async () => {
        if (selectedStickerIds.size === 0) return;
        if (confirm(`确定要删除这 ${selectedStickerIds.size} 个表情吗？`)) {
            const idsToDelete = Array.from(selectedStickerIds);

            await dexieDB.myStickers.bulkDelete(idsToDelete);

            db.myStickers = db.myStickers.filter(s => !selectedStickerIds.has(s.id));
            
            await saveData();
            
            showToast('表情已彻底删除');
            exitStickerManageMode();
        }
    });

    moveStickerGroupBtn.addEventListener('click', () => {
        existingGroupsList.innerHTML = '';
        const groups = [...new Set(db.myStickers.map(s => s.group).filter(g => g))];
        groups.forEach(g => {
            const option = document.createElement('option');
            option.value = g;
            existingGroupsList.appendChild(option);
        });
        
        moveTargetGroupInput.value = '';
        moveStickerModal.classList.add('visible');
    });

    cancelMoveStickerBtn.addEventListener('click', () => moveStickerModal.classList.remove('visible'));

    confirmMoveStickerBtn.addEventListener('click', async () => {
        const newGroup = moveTargetGroupInput.value.trim();
        
        db.myStickers.forEach(s => {
            if (selectedStickerIds.has(s.id)) {
                s.group = newGroup;
            }
        });
        
        await saveData();
        showToast('分组已更新');
        moveStickerModal.classList.remove('visible');
        exitStickerManageMode();
        renderStickerCategories(); 
        renderStickerGrid();
    });

    stickerCategoryBar.addEventListener('click', (e) => {
        const item = e.target.closest('.sticker-category-item');
        if (item) {
            currentStickerCategory = item.dataset.category;
            renderStickerCategories(); 
            renderStickerGrid(); 
        }
    });

    batchAddStickerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (reading || importing) return;
        importing = true;
        const submit = batchAddStickerForm.querySelector('[type=submit]');
        submit.disabled = true;
        try {
            const group = batchStickerGroupInput.value.trim();
            const known = new Set();
            for (const sticker of db.myStickers) {
                const data = PhoneBackup.isImage(sticker.data) ? await PhoneBackup.expand(sticker.data) : sticker.data;
                known.add(JSON.stringify([sticker.name,stickerImageSource(data),sticker.group || '']));
            }
            const newStickers = [];
            for (const row of [...fileRows,...parseStickerRows(stickerUrlsTextarea.value)]) {
                const name = String(row?.name || '').trim().slice(0,120);
                const data = stickerImageSource(row?.data || row?.url);
                const target = group || String(row?.group || '').trim().slice(0,120);
                const key = JSON.stringify([name,data,target]);
                if (!name || !data || known.has(key)) continue;
                known.add(key);
                newStickers.push({id:'sticker_' + (crypto.randomUUID?.() || Date.now() + '_' + Math.random()),name,data,group:target,lastUsedTime:Date.now()});
            }
            if (!newStickers.length) throw Error('没有可新增的表情，请检查格式或重复项');
            const records = [];
            for (const sticker of newStickers) records.push(await PhoneBackup.compact(sticker));
            await dexieDB.transaction('rw',dexieDB.myStickers,() => dexieDB.myStickers.bulkAdd(records));
            db.myStickers.push(...newStickers);
            batchAddStickerModal.classList.remove('visible');
            showToast('已导入 ' + newStickers.length + ' 个表情');
            renderStickerCategories();
            renderStickerGrid();
        } catch (error) { batchStatus.textContent = error.message; }
        finally { importing = false; submit.disabled = false; }
    });

    addStickerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = stickerNameInput.value.trim();
        const group = stickerGroupInput.value.trim();
        const id = stickerEditIdInput.value;
        const previewImg = stickerPreview.querySelector('img');
        const data = previewImg && (stickerImageSource(previewImg.src) || (PhoneBackup.isImage(previewImg.src) ? previewImg.src : ''));
        if (!name || !data) return showToast('请填写完整');
        
        const stickerData = { name, data, group, lastUsedTime: Date.now() };
        
        if (id) {
            const index = db.myStickers.findIndex(s => s.id === id);
            if (index > -1) db.myStickers[index] = { ...db.myStickers[index], ...stickerData };
        } else {
            stickerData.id = `sticker_${Date.now()}`;
            db.myStickers.push(stickerData);
        }
        await saveData();
        addStickerModal.classList.remove('visible');
        showToast('保存成功');
        renderStickerCategories();
        renderStickerGrid();
    });
    
    stickerUrlInput.addEventListener('input', (e) => {
        const src = stickerImageSource(e.target.value);
        const image = new Image(); image.alt = '预览';
        if (src) { image.src = src; stickerPreview.replaceChildren(image); }
        else stickerPreview.textContent = '预览';
        stickerFileUpload.value = '';
    });
    stickerFileUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const compressedUrl = await compressImage(file, {quality: 0.8, maxWidth: 200, maxHeight: 200});
                stickerPreview.innerHTML = `<img src="${compressedUrl}" alt="预览">`;
                stickerUrlInput.value = '';
                stickerUrlInput.disabled = false;
            } catch (error) {
                showToast('压缩失败');
            }
        }
    });

    const stickerToggleBtn = document.getElementById('sticker-toggle-btn');
    stickerToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const msgInput = document.getElementById('message-input');
        const isKeyboardOpen = (document.activeElement === msgInput);
        
        if (msgInput) msgInput.blur(); // 强制收起键盘

        if (isKeyboardOpen) {
             // 键盘 -> 面板：无动画
             showPanel('sticker', true);
        } else {
            if (chatExpansionPanel.classList.contains('visible') && panelStickerArea.style.display !== 'none') {
                showPanel('none'); // 面板 -> 关闭：默认有动画
            } else {
                // 关闭 -> 面板 或 面板(功能) -> 面板(表情)：默认有动画
                showPanel('sticker');
            }
        }
    });
}

function renderStickerCategories() {
    const bar = document.getElementById('sticker-category-bar');
    bar.innerHTML = '';

    const groups = [...new Set(db.myStickers.map(s => s.group).filter(g => g))];
    
    const categories = [
        { id: 'recent', name: '最近使用' },
        { id: 'all', name: '全部' },
        ...groups.map(g => ({ id: g, name: g })),
        { id: 'ungrouped', name: '未分类' }
    ];

    categories.forEach(cat => {
        const item = document.createElement('div');
        item.className = `sticker-category-item ${currentStickerCategory === cat.id ? 'active' : ''}`;
        item.textContent = cat.name;
        item.dataset.category = cat.id;
        bar.appendChild(item);
    });
}

function renderStickerGrid() {
    const container = document.getElementById('sticker-grid-container');
    container.innerHTML = '';

    let stickersToShow = [];

    if (currentStickerCategory === 'recent') {
        stickersToShow = [...db.myStickers]
            .sort((a, b) => (b.lastUsedTime || 0) - (a.lastUsedTime || 0))
            .slice(0, 20);
        if (stickersToShow.length === 0) {
            container.innerHTML = '<p style="color:#aaa; text-align:center; grid-column:1/-1; padding:20px;">还没有使用过表情包哦</p>';
            return;
        }
    } else if (currentStickerCategory === 'all') {
        stickersToShow = [...db.myStickers];
    } else if (currentStickerCategory === 'ungrouped') {
        stickersToShow = db.myStickers.filter(s => !s.group);
    } else {
        stickersToShow = db.myStickers.filter(s => s.group === currentStickerCategory);
    }

    if (stickersToShow.length === 0) {
        container.innerHTML = '<p style="color:#aaa; text-align:center; grid-column:1/-1; padding:20px;">该分组下没有表情</p>';
        return;
    }

    stickersToShow.forEach(sticker => {
        const item = document.createElement('div');
        item.className = 'sticker-item';
        
        if (isStickerManageMode) {
            item.classList.add('is-managing');
            if (selectedStickerIds.has(sticker.id)) {
                item.classList.add('is-selected');
            }
        }
        
        const image = new Image();
        image.src = sticker.data;
        image.alt = '';
        image.loading = 'lazy';
        const caption = document.createElement('span');
        caption.textContent = sticker.name;
        item.append(image,caption);
        item.addEventListener('contextmenu',event => {
            if (isStickerManageMode) return;
            event.preventDefault();
            handleStickerLongPress(sticker.id);
        });

        item.addEventListener('click', () => {
            if (isStickerManageMode) {
                if (selectedStickerIds.has(sticker.id)) {
                    selectedStickerIds.delete(sticker.id);
                    item.classList.remove('is-selected');
                } else {
                    selectedStickerIds.add(sticker.id);
                    item.classList.add('is-selected');
                }
                const count = selectedStickerIds.size;
                document.getElementById('sticker-select-count').textContent = `已选 ${count} 项`;
                document.getElementById('delete-selected-stickers-btn').disabled = count === 0;
                document.getElementById('move-sticker-group-btn').disabled = count === 0;
            } else {
                sendSticker(sticker);
            }
        });

        container.appendChild(item);
    });
}

function handleStickerLongPress(stickerId) {
    if (isStickerManageMode) return;
    clearTimeout(longPressTimer);
    currentStickerActionTarget = stickerId;
    document.getElementById('sticker-actionsheet').classList.add('visible');
}

async function sendSticker(sticker) {
    const dbSticker = db.myStickers.find(s => s.id === sticker.id);
    if (dbSticker) {
        dbSticker.lastUsedTime = Date.now();
    }

    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    if (!chat) return;
    const rawName = currentChatType === 'private' ? chat.myName : chat.me?.nickname;
    const myName = String(rawName || '').trim() || 'User';
    
    const messageContentForAI = `[${myName}发送的表情包：${sticker.name}]`;
    const message = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: messageContentForAI,
        parts: [{type: 'text', text: messageContentForAI}],
        timestamp: Date.now(),
        stickerData: sticker.data 
    };
    if (currentChatType === 'group') {
        message.senderId = 'user_me';
    }
    chat.history.push(message);
    addMessageBubble(message, currentChatId, currentChatType);
    
    await saveData(); 
    renderChatList();
    
    showPanel('none');
}
