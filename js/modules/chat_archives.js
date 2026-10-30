// --- 聊天存档与分支 ---

const CHAT_ARCHIVE_META_KEYS = new Set([
    'id', 'archives', 'activeArchiveId', 'isPinned', 'unreadCount', '__phoneHistory',
    'realName', 'remarkName', 'name', 'avatar', 'folderId', 'folderIds'
]);

let chatArchiveOperationBusy = false, chatArchiveOperationSaved = false;
async function withChatArchiveOperation(action) {
    if(chatArchiveOperationBusy)return showToast('存档正在处理，请稍候');
    if(typeof isGenerating!=='undefined'&&isGenerating)return showToast('请等待回复生成结束后再操作存档');
    const chat=getCurrentChatEntity();if(!chat)return;
    chatArchiveOperationBusy=true;chatArchiveOperationSaved=false;
    const release=PhoneBackup.pinChat(chat),startArchive=chat.activeArchiveId;
    let before;
    try{
        await PhoneBackup.waitForWrites();
        await PhoneBackup.hydrateChat(chat);
        if(getCurrentChatEntity()!==chat||chat.activeArchiveId!==startArchive)throw Error('聊天或存档已切换，请重新操作');
        before=cloneArchiveValue(chat);
        return await action(chat);
    }catch(error){
        if(before&&!chatArchiveOperationSaved){Object.keys(chat).forEach(key=>delete chat[key]);Object.assign(chat,before);}
        showToast((chatArchiveOperationSaved?'存档已保存，但页面刷新失败：':'存档操作未保存，原记录已保留：')+error.message);
        renderArchiveManager();
    }finally{release();chatArchiveOperationBusy=false;}
}
async function persistChatArchives(chat){await PhoneBackup.saveChat(chat);chatArchiveOperationSaved=true;}
function createBlankArchive(){return withChatArchiveOperation(()=>createBlankArchiveImpl());}
function createBranchArchiveAtMessage(id){return withChatArchiveOperation(()=>createBranchArchiveAtMessageImpl(id));}
function switchChatArchive(id){return withChatArchiveOperation(()=>switchChatArchiveImpl(id));}
function renameChatArchive(id){return withChatArchiveOperation(()=>renameChatArchiveImpl(id));}
function deleteChatArchive(id){return withChatArchiveOperation(()=>deleteChatArchiveImpl(id));}

function cloneArchiveValue(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}

function createArchiveId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `archive_${crypto.randomUUID()}`;
    }
    return `archive_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getCurrentChatEntity() {
    if (!currentChatId || !currentChatType) return null;
    return currentChatType === 'private'
        ? db.characters.find(character => character.id === currentChatId)
        : db.groups.find(group => group.id === currentChatId);
}

function captureArchiveData(chat) {
    const data = {};
    Object.keys(chat).forEach(key => {
        if (!CHAT_ARCHIVE_META_KEYS.has(key)) {
            data[key] = cloneArchiveValue(chat[key]);
        }
    });
    return data;
}

function getArchiveLatestTime(data) {
    const history = Array.isArray(data.history) ? data.history : [];
    const journals = Array.isArray(data.memoryJournals) ? data.memoryJournals : [];
    const lastMessage = history.length ? Number(history[history.length - 1].timestamp) || 0 : 0;
    const lastJournal = journals.reduce((latest, journal) => Math.max(latest, Number(journal.createdAt) || 0), 0);
    return Math.max(lastMessage, lastJournal);
}

function ensureChatArchives(chat) {
    if (!chat) return false;
    let changed = false;

    if (!Array.isArray(chat.archives) || chat.archives.length === 0) {
        const now = Date.now();
        const archive = {
            id: createArchiveId(),
            name: '主存档',
            createdAt: now,
            updatedAt: Math.max(getArchiveLatestTime(chat), now),
            origin: null,
            data: captureArchiveData(chat)
        };
        chat.archives = [archive];
        chat.activeArchiveId = archive.id;
        changed = true;
    }

    if (!chat.archives.some(archive => archive.id === chat.activeArchiveId)) {
        chat.activeArchiveId = chat.archives[0].id;
        changed = true;
    }

    return changed;
}

function ensureAllChatArchives() {
    let changed = false;
    [...(db.characters || []), ...(db.groups || [])].forEach(chat => {
        if (normalizeChatArchiveStorage(chat)) changed = true;
    });
    return changed;
}

// 当前存档使用角色本身的数据；只有非当前存档保存独立快照。
// 不以“打开聊天 / 保存数据”为由创建存档。
function archiveValuesEqual(a, b) {
    if (Object.is(a, b)) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key =>
        Object.prototype.hasOwnProperty.call(b, key) && archiveValuesEqual(a[key], b[key]));
}

function normalizeChatArchiveStorage(chat) {
    if (PhoneBackup.isCold(chat)) return false;
    if (!chat || !Array.isArray(chat.archives) || !chat.archives.length) return false;
    let changed = false;
    let active = chat.archives.find(item => item.id === chat.activeArchiveId);
    if (!active) {
        active = chat.archives[0];
        chat.activeArchiveId = active.id;
        changed = true;
    }
    // 旧版自动生成且与当前聊天相同的单一“主存档”可以安全收回。
    // 改过名、有分支来源或包含不同内容的单一存档保留。
    if(active.data?.__phoneArchive)return changed;
    const data = active.data || {};
    const same = Object.entries(data).every(([key, value]) =>
        !CHAT_ARCHIVE_META_KEYS.has(key) && archiveValuesEqual(value, chat[key]));
    if (chat.archives.length === 1 && active.name === '主存档' && !active.origin && same) {
        delete chat.archives;
        delete chat.activeArchiveId;
        return true;
    }
    // 某些旧备份仅包含存档快照，先还原后再压缩，不能丢失记录。
    if (!Array.isArray(chat.history) && Array.isArray(data.history) && active.dataStoredOnChat !== true) {
        Object.assign(chat, cloneArchiveValue(data));
        changed = true;
    }
    const snapshotMatchesCurrent = Object.entries(data).every(([key, value]) =>
        !CHAT_ARCHIVE_META_KEYS.has(key) && archiveValuesEqual(value, chat[key]));
    if (active.dataStoredOnChat !== true && !snapshotMatchesCurrent) {
        // 无法证实是重复数据时保留原快照，当前记录另作当前存档。
        active = { id: createArchiveId(), name: '当前聊天', createdAt: Date.now(),
            updatedAt: Math.max(Date.now(), getArchiveLatestTime(chat)),
            origin: null, data: {}, dataStoredOnChat: true };
        chat.archives.push(active);
        chat.activeArchiveId = active.id;
        changed = true;
    }
    if(active.data===data&&active.dataStoredOnChat===true&&Object.keys(data).length&&!snapshotMatchesCurrent){
        const kept={...active,id:createArchiveId(),name:active.name+'（保留快照）',data:cloneArchiveValue(data)};delete kept.dataStoredOnChat;chat.archives.push(kept);changed=true;
    }
    if (active.dataStoredOnChat !== true || Object.keys(active.data || {}).length) {
        active.data = {};
        active.dataStoredOnChat = true;
        changed = true;
    }
    return changed;
}

function syncChatActiveArchive(chat, touch = false) {
    if (PhoneBackup.isCold(chat)) return;
    if (!chat) return;
    normalizeChatArchiveStorage(chat);
    const archive = chat.archives?.find(item => item.id === chat.activeArchiveId);
    if (!archive || archive.data?.__phoneArchive || archive.dataStoredOnChat!==true) return;

    const nextLatest = getArchiveLatestTime(chat);
    archive.data = {};
    archive.dataStoredOnChat = true;
    if (touch || nextLatest > (archive.updatedAt || 0)) {
        archive.updatedAt = Math.max(Date.now(), nextLatest);
    }
}

function syncAllActiveArchives() {
    [...(db.characters || []), ...(db.groups || [])].forEach(chat => {
        const touch = chat.id === currentChatId;
        syncChatActiveArchive(chat, touch);
    });
}

async function applyArchiveData(chat, archive) {
    await PhoneBackup.hydrateChat(chat);
    await PhoneBackup.hydrateArchive(archive);
    if (chat.activeArchiveId === archive.id && archive.dataStoredOnChat === true) return;
    const previous = chat.archives?.find(item => item.id === chat.activeArchiveId);
    if (previous && previous.id !== archive.id) {
        previous.data = captureArchiveData(chat);
        delete previous.dataStoredOnChat;
    }
    const data = cloneArchiveValue(archive.data || {});
    if(!Array.isArray(data.history))throw Error('目标存档未能读取完整历史，未切换或清空当前记录');
    Object.keys(chat).forEach(key => {
        if (!CHAT_ARCHIVE_META_KEYS.has(key)) delete chat[key];
    });
    Object.assign(chat, data);
    chat.activeArchiveId = archive.id;
    archive.data = {};
    archive.dataStoredOnChat = true;
}

function getActiveArchive(chat) {
    if (!chat) return null;
    ensureChatArchives(chat);
    return chat.archives.find(archive => archive.id === chat.activeArchiveId) || chat.archives[0];
}

function resetArchiveRuntime(data) {
    data.history = [];
    data.memoryJournals = [];
    data.callHistory = [];
    data.lastUserMessageTimestamp = null;
    data.status = '在线';
    data.peekData = {};
    data.gallery = [];

    if (data.statusPanel) {
        data.statusPanel.currentStatusRaw = '';
        data.statusPanel.currentStatusHtml = '';
        data.statusPanel.history = [];
    }
    if (data.autoReply) data.autoReply.lastTriggerTime = 0;
    if (data.privateSessions) data.privateSessions = {};
    if (data.gossipSessions) data.gossipSessions = {};
    return data;
}

function makeArchiveName(prefix) {
    const now = new Date();
    const date = `${now.getMonth() + 1}月${now.getDate()}日`;
    return `${prefix} · ${date}`;
}

async function createBlankArchiveImpl() {
    const chat = getCurrentChatEntity();
    await PhoneBackup.hydrateChat(chat);
    if (!chat) return;
    syncChatActiveArchive(chat, true);

    const suggestedName = makeArchiveName('新存档');
    const name = prompt('存档名称', suggestedName);
    if (name === null) return;

    getActiveArchive(chat);
    const now = Date.now();
    const archive = {
        id: createArchiveId(),
        name: name.trim() || suggestedName,
        createdAt: now,
        updatedAt: now,
        origin: null,
        data: resetArchiveRuntime(captureArchiveData(chat))
    };
    chat.archives.push(archive);
    await switchChatArchiveImpl(archive.id);
    showToast('新存档已创建');
}

function journalBelongsToBranch(journal, includedMessageIds, cutoff, atLatest=false) {
    if(atLatest)return true;
    if(journal.startMessageId&&journal.endMessageId&&includedMessageIds.has(String(journal.startMessageId))&&includedMessageIds.has(String(journal.endMessageId)))return true;
    const end=Number(journal.range?.end);
    return Number.isFinite(end)&&end>0&&end<=cutoff;
}

async function createBranchArchiveAtMessageImpl(messageId) {
    const chat = getCurrentChatEntity();
    await PhoneBackup.hydrateChat(chat);
    if (!chat || !Array.isArray(chat.history)) return;
    const branchIndex = chat.history.findIndex(message => String(message.id) === String(messageId));
    if (branchIndex < 0) return;

    const suggestedName = makeArchiveName('分支');
    const name = typeof kpPrompt === 'function'
        ? await kpPrompt('分支存档名称', '从这条消息开始建立独立分支，原存档会保留。', suggestedName)
        : prompt('分支存档名称', suggestedName);
    if (name === null) return;
    if (getCurrentChatEntity() !== chat) return showToast('聊天已切换，请在当前聊天重新创建分支');

    syncChatActiveArchive(chat, true);
    const sourceArchive = getActiveArchive(chat);
    const data = captureArchiveData(chat);
    data.history = data.history.slice(0, branchIndex + 1);
    const includedMessageIds = new Set(data.history.map(message => String(message.id)));
    data.memoryJournals = (data.memoryJournals || []).filter(journal =>
        journalBelongsToBranch(journal, includedMessageIds, branchIndex + 1, branchIndex===chat.history.length-1)
    );
    data.callHistory = (data.callHistory || []).filter(call => !call.timestamp || call.timestamp <= (data.history[branchIndex].timestamp || Infinity));
    data.lastUserMessageTimestamp = [...data.history].reverse().find(message => message.role === 'user')?.timestamp || null;

    const now = Date.now();
    const archive = {
        id: createArchiveId(),
        name: name.trim() || suggestedName,
        createdAt: now,
        updatedAt: now,
        origin: {
            archiveId: sourceArchive.id,
            archiveName: sourceArchive.name,
            messageId,
            createdAt: now
        },
        data
    };
    chat.archives.push(archive);
    await switchChatArchiveImpl(archive.id);
    showToast('分支存档已创建');
}

async function switchChatArchiveImpl(archiveId) {
    const chat = getCurrentChatEntity();
    await PhoneBackup.hydrateChat(chat);
    if (!chat || chat.activeArchiveId === archiveId) {
        closeArchiveManager();
        return;
    }

    syncChatActiveArchive(chat, true);
    const archive = chat.archives?.find(item => item.id === archiveId);
    if (!archive) return;
    await applyArchiveData(chat, archive);
    await persistChatArchives(chat);
    closeArchiveManager();
    if(getCurrentChatEntity()===chat)await openChatRoom(chat.id,currentChatType);
}

async function renameChatArchiveImpl(archiveId) {
    const chat = getCurrentChatEntity();
    const archive = chat?.archives.find(item => item.id === archiveId);
    if (!archive) return;
    const name = prompt('修改存档名称', archive.name);
    if (name === null || !name.trim()) return;
    archive.name = name.trim();
    archive.updatedAt = Date.now();
    await persistChatArchives(chat);
    renderArchiveManager();
}

async function deleteChatArchiveImpl(archiveId) {
    const chat = getCurrentChatEntity();
    await PhoneBackup.hydrateChat(chat);
    if (!chat || chat.archives.length <= 1) {
        showToast('至少保留一个存档');
        return;
    }
    const archive = chat.archives.find(item => item.id === archiveId);
    if (!archive || !confirm(`确定删除“${archive.name}”吗？该操作不可恢复。`)) return;

    if (chat.activeArchiveId === archiveId) {
        syncChatActiveArchive(chat, true);
        const others=chat.archives.filter(item=>item.id!==archiveId);
        const fallback=others.find(item=>item.id===archive.origin?.archiveId)||others.slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))[0];
        chat.archives = chat.archives.filter(item => item.id !== archiveId);
        await applyArchiveData(chat, fallback);
        await persistChatArchives(chat);
        closeArchiveManager();
        if(getCurrentChatEntity()===chat)await openChatRoom(chat.id,currentChatType);
        showToast('存档已删除');
        return;
    }

    chat.archives = chat.archives.filter(item => item.id !== archiveId);
    await persistChatArchives(chat);
    renderArchiveManager();
    showToast('存档已删除');
}

function formatArchiveTime(timestamp) {
    const date = new Date(timestamp || Date.now());
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function archiveUiIcon(name) {
    const paths = {
        close: '<path d="m6 6 12 12M18 6 6 18"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        check: '<path d="M13 3H5v18h10M13 3v6h6l-6-6ZM11 16l3 3 6-6"/>',
        export: '<path d="M8 8H5v13h14V8h-3M12 15V3m-4 4 4-4 4 4"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}

function renderArchiveManager() {
    const chat = getCurrentChatEntity();
    const list = document.getElementById('chat-archive-list');
    if (!chat || !list) return;
    // Reading the manager never mutates or saves archive snapshots.
    const archives = chat.archives?.length ? chat.archives : [{
        name: '当前聊天', data: {}, dataStoredOnChat: true,
        updatedAt: getArchiveLatestTime(chat)
    }];
    list.innerHTML = archives
        .slice()
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(archive => {
            const active = archive.id === chat.activeArchiveId || !archive.id;
            const data = active ? chat : archive.data;
            const messageCount = active ? PhoneBackup.historyCount(chat) : data?.messageCount ?? data?.history?.count ?? data?.history?.length ?? 0;
            const journalCount = data?.journalCount ?? data?.memoryJournals?.length ?? 0;
            const origin = archive.origin ? `<div class="archive-origin">来自：${escapeHtml(archive.origin.archiveName || '其他存档')}</div>` : '';
            return `
                <article class="chat-archive-card ${active ? 'active' : ''}" data-archive-id="${archive.id || ''}">
                    <div class="archive-folder-tab">${active ? '<i></i>使用中' : '存档'}</div>
                    <div class="archive-card-main">
                        <div class="archive-name-row">
                            <strong>${escapeHtml(archive.name)}</strong>
                            ${archive.id && archives.length > 1 ? '<details class="archive-more"><summary aria-label="更多存档操作">···</summary><div class="archive-more-menu"><button type="button" data-action="delete" class="danger">删除存档</button></div></details>' : ''}
                        </div>
                        <div class="archive-meta">${messageCount} 条消息 · ${journalCount} 篇日记</div>
                        ${origin}
                    </div>
                    <footer class="archive-card-footer">
                        <time>${archiveUiIcon('clock')}${formatArchiveTime(archive.updatedAt)}</time>
                        <div class="archive-actions">
                            ${active ? '' : '<button type="button" data-action="switch" class="archive-enter">进入</button>'}
                            ${archive.id ? '<button type="button" data-action="rename">改名</button>' : ''}
                        </div>
                    </footer>
                </article>`;
        }).join('');
    const count = document.getElementById('chat-archive-count');
    if (count) count.textContent = archives.length + ' 个存档';
}

function openArchiveManager() {
    const overlay = document.getElementById('chat-archive-overlay');
    if (!overlay) return;
    renderArchiveManager();
    const check=document.getElementById('chat-record-check-result');if(check)check.textContent='';
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
}

function closeArchiveManager() {
    const overlay = document.getElementById('chat-archive-overlay');
    overlay?.classList.remove('visible');
    overlay?.setAttribute('aria-hidden', 'true');
}

function injectArchiveUi() {
    if (!document.getElementById('chat-archive-overlay')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="chat-archive-overlay" class="chat-archive-overlay" aria-hidden="true">
                <section class="chat-archive-panel" role="dialog" aria-modal="true" aria-label="存档管理">
                    <header class="archive-panel-header">
                        <button type="button" id="close-chat-archives" aria-label="关闭存档管理">${archiveUiIcon('close')}</button>
                        <h2>存档管理</h2>
                        <button type="button" id="create-chat-archive" aria-label="新建空白存档">${archiveUiIcon('plus')}</button>
                    </header>
                    <div class="archive-record-tools">
                        <button type="button" id="check-chat-records">${archiveUiIcon('check')}<span>检查完整记录</span></button>
                        <button type="button" id="export-chat-safety">${archiveUiIcon('export')}<span>导出保护副本</span></button>
                    </div>
                    <p id="chat-record-check-result" role="status"></p>
                    <div class="archive-section-heading"><h3>我的存档</h3><span id="chat-archive-count"></span></div>
                    <div id="chat-archive-list" class="chat-archive-list"></div>
                    <p class="archive-help">新存档从空白聊天开始，沿用当前设置。</p>
                </section>
            </div>`);
    }

    const grids = document.querySelectorAll('#chat-expansion-panel .expansion-grid');
    const grid = grids[0];
    if (grid && !document.getElementById('chat-archives-btn')) {
        grid.insertAdjacentHTML('beforeend', `
            <div class="expansion-item" id="chat-archives-btn">
                <div class="expansion-item-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v4H4V4m1 6h14v10H5V10m4 2v2h6v-2H9z"/></svg>
                </div>
                <span class="expansion-item-name">存档</span>
            </div>`);
    }
}

function setupChatArchiveSystem() {
    injectArchiveUi();
    document.getElementById('check-chat-records')?.addEventListener('click',async()=>{
        const chat=getCurrentChatEntity(),out=document.getElementById('chat-record-check-result');if(!chat||!out)return;
        try{const report=await PhoneBackup.inspectChat(chat);out.textContent='当前聊天完整记录：'+report.currentMessageCount+' 条；磁盘当前存档：'+report.persistedMessageCount+' 条。'+(report.cold?'\n内存目前只加载了 '+report.memoryPreviewCount+' 条预览，完整记录仍由数据块读取。':'')+'\n此检查未改动记录；存档条数包含全部类型消息，数据管理按文字、图片等分别统计。';}catch(error){out.textContent='检查未完成：'+error.message+'。未清除任何记录。';}
    });
    document.getElementById('export-chat-safety')?.addEventListener('click',async()=>{
        const chat=getCurrentChatEntity();if(!chat)return;try{await PhoneBackup.exportChatSafety(chat);showToast('已导出磁盘聊天保护副本；请保留原件，不要直接导入覆盖');}catch(error){showToast('保护副本导出失败：'+error.message);}
    });
    document.getElementById('chat-archives-btn')?.addEventListener('click', openArchiveManager);
    document.getElementById('close-chat-archives')?.addEventListener('click', closeArchiveManager);
    document.getElementById('create-chat-archive')?.addEventListener('click', createBlankArchive);
    document.getElementById('chat-archive-overlay')?.addEventListener('click', event => {
        if (event.target.id === 'chat-archive-overlay') closeArchiveManager();
    });
    document.getElementById('chat-archive-list')?.addEventListener('click', event => {
        const button = event.target.closest('button[data-action]');
        const card = event.target.closest('.chat-archive-card');
        if (!button || !card) return;
        const archiveId = card.dataset.archiveId;
        if (button.dataset.action === 'switch') switchChatArchive(archiveId);
        if (button.dataset.action === 'rename') renameChatArchive(archiveId);
        if (button.dataset.action === 'delete') deleteChatArchive(archiveId);
    });
}
