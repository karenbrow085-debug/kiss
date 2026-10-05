/* uwu-1900 主页预设：在 main.js 前加载，不修改聊天数据。 */
(() => {
    'use strict';
    const FORMAT = 'uwu-1900-home-presets';
    const KEYS = ['homePresets', 'activeHomePresetId', 'homePresetUndo'];
    const HOME_KEYS = ['homeLayoutPages', 'homeLayoutOrder', 'addedWidgets',
        'wallpaper', 'homeScreenMode', 'customIcons', 'homeSignature',
        'insWidgetSettings', 'homeWidgetSettings'];
    KEYS.forEach(key => { if (!globalSettingKeys.includes(key)) globalSettingKeys.push(key); });
    const clone = value => JSON.parse(JSON.stringify(value));
    const uid = () => 'hp-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    const toast = message => typeof showToast === 'function' ? showToast(message) : alert(message);
    let busy = false;
    function ensure() {
        if (!Array.isArray(db.homePresets)) db.homePresets = [];
        if (db.activeHomePresetId === undefined) db.activeHomePresetId = null;
        if (db.homePresetUndo === undefined) db.homePresetUndo = null;
    }
    function assert(ok, message) { if (!ok) throw new Error(message); }
    function checkTree(value, depth = 0) {
        assert(depth < 50, '文件嵌套过深');
        if (value && typeof value === 'object') {
            Object.entries(value).forEach(([key, child]) => {
                assert(!['__proto__', 'prototype', 'constructor'].includes(key), '文件包含不支持的字段');
                checkTree(child, depth + 1);
            });
        }
    }
    function validateSnapshot(source) {
        assert(object(source), '主页数据格式不正确');
        checkTree(source);
        assert(Array.isArray(source.homeLayoutPages) && source.homeLayoutPages.length > 0 && source.homeLayoutPages.length <= 100, '主页分页数据不正确');
        const pages = source.homeLayoutPages;
        assert(pages.every(page => Array.isArray(page) && page.length <= 1000 && page.every(id => typeof id === 'string' && /^[\w-]+$/.test(id))), '图标位置数据不正确');
        const ids = pages.flat();
        assert(new Set(ids).size === ids.length, '同一图标或小组件不能重复出现');
        assert(Array.isArray(source.addedWidgets) && Array.isArray(source.widgetTemplates), '小组件内容缺失');
        assert(source.addedWidgets.length <= 1000 && source.widgetTemplates.length <= 1000, '小组件数量过多');
        const templateIds = new Set();
        source.widgetTemplates.forEach(template => {
            assert(object(template) && typeof template.id === 'string' && /^[\w-]+$/.test(template.id), '小组件模板标识不正确');
            assert(!templateIds.has(template.id), '小组件模板标识重复');
            templateIds.add(template.id);
            assert(['1x1', '2x2', '4x2', '4x4', '2x4'].includes(template.size), '小组件尺寸不支持');
            assert(typeof template.html === 'string' && typeof template.css === 'string', '小组件 HTML 或 CSS 缺失');
            assert(template.js === undefined || typeof template.js === 'string', '小组件 JS 格式不正确');
            assert(object(template.defaultVars), '小组件默认内容不正确');
        });
        const widgetIds = new Set();
        source.addedWidgets.forEach(widget => {
            assert(object(widget) && typeof widget.id === 'string' && /^[\w-]+$/.test(widget.id), '小组件实例标识不正确');
            assert(!widgetIds.has(widget.id), '小组件实例重复');
            widgetIds.add(widget.id);
            assert(templateIds.has(widget.templateId) && object(widget.vars), '小组件模板或内容缺失');
            assert(ids.includes(widget.id), '小组件没有对应的主页位置');
        });
        const apps = new Set(['app-chat', 'app-api', 'app-wallpaper', 'app-worldbook', 'app-customize', 'app-tutorial', 'app-console', 'app-widget-market', 'app-reader', 'app-placeholder', 'app-mono']);
        assert(ids.every(id => apps.has(id) || widgetIds.has(id)), '文件包含当前版本不支持的主页项目');
        assert(typeof source.wallpaper === 'string' && ['day', 'night'].includes(source.homeScreenMode), '壁纸或日夜模式不正确');
        assert(object(source.customIcons) && Object.values(source.customIcons).every(value => typeof value === 'string'), '图标图片数据不正确');
        assert(typeof source.homeSignature === 'string' && object(source.insWidgetSettings) && object(source.homeWidgetSettings), '主页文字或内置组件数据不正确');
        const result = {};
        HOME_KEYS.forEach(key => { if (source[key] !== undefined) result[key] = clone(source[key]); });
        result.homeLayoutOrder = ids.slice();
        result.widgetTemplates = clone(source.widgetTemplates);
        return result;
    }
    function capture() {
        assert(document.getElementById('home-screen-swiper'), '主页还在加载，请稍后再试');
        const pages = clone(db.homeLayoutPages || [db.homeLayoutOrder || []]);
        const visible = new Set(pages.flat());
        const widgets = clone((db.addedWidgets || []).filter(widget => visible.has(widget.id)));
        const used = new Set(widgets.map(widget => widget.templateId));
        const snapshot = {};
        HOME_KEYS.forEach(key => { if (db[key] !== undefined) snapshot[key] = clone(db[key]); });
        snapshot.homeLayoutPages = pages;
        snapshot.homeLayoutOrder = pages.flat();
        snapshot.addedWidgets = widgets;
        snapshot.widgetTemplates = clone((db.widgetTemplates || []).filter(template => used.has(template.id)));
        snapshot.customIcons = snapshot.customIcons || {};
        snapshot.insWidgetSettings = snapshot.insWidgetSettings || {};
        snapshot.homeWidgetSettings = snapshot.homeWidgetSettings || {};
        snapshot.homeSignature = snapshot.homeSignature || '';
        return validateSnapshot(snapshot);
    }
    // 只写相关设置；保存失败时不改内存中的数据，也不写聊天表。
    async function commit(patch) {
        assert(typeof dexieDB !== 'undefined' && dexieDB, '数据库尚未加载');
        await dexieDB.transaction('rw', dexieDB.globalSettings, async () => {
            for (const [key, value] of Object.entries(patch)) {
                await dexieDB.globalSettings.put({ key, value: clone(value) });
            }
        });
        Object.assign(db, patch);
    }
    function mergeTemplates(snapshot) {
        const result = clone(db.widgetTemplates || []);
        const remap = new Map();
        for (const saved of snapshot.widgetTemplates) {
            const existing = result.find(template => template.id === saved.id);
            if (!existing) { result.push(clone(saved)); continue; }
            if (JSON.stringify(existing) === JSON.stringify(saved)) continue;
            const restored = result.find(candidate => {
                const normalized = clone(candidate);
                ['html', 'css', 'js'].forEach(key => {
                    if (typeof normalized[key] === 'string') normalized[key] = normalized[key].split(candidate.id).join(saved.id);
                });
                normalized.id = saved.id;
                return JSON.stringify(normalized) === JSON.stringify(saved);
            });
            if (restored) { remap.set(saved.id, restored.id); continue; }
            // 同名但不同内容：保留组件库原模板，并给预设中的版本分配新 ID。
            const copy = clone(saved);
            const newId = uid();
            remap.set(saved.id, newId);
            ['html', 'css', 'js'].forEach(key => {
                if (typeof copy[key] === 'string') copy[key] = copy[key].split(saved.id).join(newId);
            });
            copy.id = newId;
            result.push(copy);
        }
        snapshot.addedWidgets.forEach(widget => {
            if (remap.has(widget.templateId)) widget.templateId = remap.get(widget.templateId);
        });
        return result;
    }
    function refreshHome() {
        document.querySelectorAll('style[id^="custom-widget-style-"]').forEach(style => style.remove());
        const used = new Set((db.addedWidgets || []).map(widget => widget.templateId));
        (db.widgetTemplates || []).filter(template => used.has(template.id)).forEach(template => {
            const style = document.createElement('style');
            style.id = 'custom-widget-style-' + template.id;
            style.textContent = template.css.replace(/{{id}}/g, template.id);
            document.head.appendChild(style);
        });
        if (typeof exitHomeEditMode === 'function') exitHomeEditMode();
        setupHomeScreen();
        if (typeof renderCustomizeForm === 'function') renderCustomizeForm();
        const preview = document.getElementById('wallpaper-preview');
        if (preview) preview.style.backgroundImage = 'url(' + JSON.stringify(db.wallpaper) + ')';
    }
    async function apply(preset, edit = false) {
        const previous = { data: capture(), activeId: db.activeHomePresetId || null };
        const next = validateSnapshot(preset.data);
        const templates = mergeTemplates(next);
        delete next.widgetTemplates;
        await commit({ ...next, widgetTemplates: templates, activeHomePresetId: preset.id, homePresetUndo: previous });
        refreshHome();
        close();
        switchScreen('home-screen');
        if (edit && typeof enterHomeEditMode === 'function') enterHomeEditMode();
        toast(edit ? '调整主页后回到预设管理，点「覆盖保存」' : '主页预设已应用');
    }
    function download(presets, name) {
        const payload = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(),
            presets: presets.map(preset => ({ name: preset.name, data: validateSnapshot(preset.data) })) };
        const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = name.replace(/[\\/:*?"<>|]/g, '-') + '.json';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    function parseImport(text) {
        const payload = JSON.parse(text);
        checkTree(payload);
        assert(object(payload) && payload.format === FORMAT && payload.version === 1, '请选择本功能导出的主页预设 JSON，不能导入整机备份或单个组件文件');
        assert(Array.isArray(payload.presets) && payload.presets.length > 0 && payload.presets.length <= 200, '预设数量不正确');
        return payload.presets.map(preset => {
            assert(object(preset) && typeof preset.name === 'string' && preset.name.trim() && preset.name.length <= 100, '预设名称不正确');
            return { id: uid(), name: preset.name.trim(), updatedAt: Date.now(), data: validateSnapshot(preset.data) };
        });
    }
    const iconPaths = {
        save: '<path d="M12 5v14M5 12h14"/>',
        import: '<path d="M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4"/>',
        'export-all': '<path d="M12 16V3m-4 4 4-4 4 4M5 15v6h14v-6"/>',
        undo: '<path d="m8 3-5 5 5 5M3 8h10a7 7 0 0 1 0 14"/>',
        close: '<path d="m6 6 12 12M18 6 6 18"/>',
        apply: '<path d="m8 5 10 7-10 7z"/>',
        edit: '<path d="m16 3 5 5-12 12-6 1 1-6zM13 6l5 5"/>',
        overwrite: '<path d="M20 8V4h-4M4 16v4h4M20 4l-4 4a7 7 0 0 0-11 3M4 20l4-4a7 7 0 0 0 11-3"/>',
        rename: '<path d="M4 7V4h16v3M12 4v16M8 20h8"/>',
        copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
        export: '<path d="M12 16V3m-4 4 4-4 4 4M5 15v6h14v-6"/>',
        delete: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
        more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
        home: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h7v7h-7z"/>'
    };
    const icon = action => '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (iconPaths[action] || iconPaths.home) + '</svg>';
    function ask({ title, description = '', value, confirmText = '确认' }) {
        return new Promise(resolve => {
            const sheet = document.getElementById('hp-sheet');
            const titleEl = document.getElementById('hp-sheet-title');
            const descriptionEl = document.getElementById('hp-sheet-description');
            const input = document.getElementById('hp-name');
            const accept = document.getElementById('hp-accept');
            const cancel = document.getElementById('hp-cancel');
            const form = document.getElementById('hp-sheet-form');
            titleEl.textContent = title;
            descriptionEl.textContent = description;
            input.hidden = value === undefined;
            input.value = value === undefined ? '' : value;
            input.required = value !== undefined;
            accept.textContent = confirmText;
            sheet.hidden = false;
            function finish(result) {
                sheet.hidden = true;
                form.removeEventListener('submit', submit);
                cancel.removeEventListener('click', cancelClick);
                document.removeEventListener('keydown', escape);
                resolve(result);
            }
            function submit(event) {
                event.preventDefault();
                if (value !== undefined && !input.value.trim()) { input.focus(); return; }
                finish(value === undefined ? true : input.value.trim());
            }
            function cancelClick() { finish(null); }
            function escape(event) { if (event.key === 'Escape') { event.stopPropagation(); finish(null); } }
            form.addEventListener('submit', submit);
            cancel.addEventListener('click', cancelClick);
            document.addEventListener('keydown', escape);
            (value === undefined ? cancel : input).focus();
            if (value !== undefined) input.select();
        });
    }
    const button = (label, action, id) => {
        const el = document.createElement('button');
        el.type = 'button'; el.dataset.hpAction = action;
        el.innerHTML = icon(action);
        const text = document.createElement('span'); text.textContent = label; el.appendChild(text);
        if (id) el.dataset.hpId = id;
        return el;
    };
    function render() {
        ensure();
        const list = document.getElementById('hp-list');
        list.replaceChildren();
        document.getElementById('hp-count').textContent = String(db.homePresets.length).padStart(2, '0');
        if (!db.homePresets.length) {
            const empty = document.createElement('div'); empty.className = 'hp-empty';
            empty.innerHTML = '<div class="hp-empty-icon">' + icon('home') + '</div><strong>收藏你的第一套主页</strong><p>把喜欢的布局保存下来，随时换回。</p>';
            list.appendChild(empty);
        }
        db.homePresets.forEach((preset, index) => {
            const active = db.activeHomePresetId === preset.id;
            const row = document.createElement('article'); row.className = 'hp-row' + (active ? ' hp-active' : '');
            const meta = document.createElement('div'); meta.className = 'hp-card-meta';
            const number = document.createElement('span'); number.className = 'hp-number';
            number.textContent = 'NO. ' + String(index + 1).padStart(2, '0'); meta.appendChild(number);
            if (active) {
                const badge = document.createElement('span'); badge.className = 'hp-badge'; badge.textContent = '当前方案'; meta.appendChild(badge);
            }
            row.appendChild(meta);
            const title = document.createElement('h4'); title.textContent = preset.name; title.title = preset.name; row.appendChild(title);
            const note = document.createElement('p'); note.className = 'hp-card-note';
            const pages = preset.data.homeLayoutPages.length;
            const widgets = preset.data.addedWidgets.length;
            note.textContent = pages + ' 个页面  /  ' + widgets + ' 个小组件'; row.appendChild(note);
            const controls = document.createElement('div'); controls.className = 'hp-card-actions';
            controls.appendChild(button('应用', 'apply', preset.id));
            controls.appendChild(button('修改布局', 'edit', preset.id));
            row.appendChild(controls);
            const details = document.createElement('details'); details.className = 'hp-more';
            const summary = document.createElement('summary'); summary.innerHTML = icon('more') + '<span>管理这套预设</span>';
            details.appendChild(summary);
            const extras = document.createElement('div'); extras.className = 'hp-extra-actions';
            [['覆盖保存', 'overwrite'], ['重命名', 'rename'], ['复制', 'copy'], ['导出', 'export'], ['删除预设', 'delete']].forEach(([label, action]) => extras.appendChild(button(label, action, preset.id)));
            details.appendChild(extras); row.appendChild(details); list.appendChild(row);
        });
        document.querySelector('#hp-dialog [data-hp-action="undo"]').disabled = !db.homePresetUndo;
        document.querySelector('#hp-dialog [data-hp-action="export-all"]').disabled = !db.homePresets.length;
    }
    let previousFocus;
    function close() {
        document.getElementById('hp-dialog').hidden = true;
        if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
    }
    async function handle(action, id) {
        ensure();
        const preset = db.homePresets.find(item => item.id === id);
        if (action === 'close') return close();
        if (action === 'import') return document.getElementById('hp-import').click();
        if (action === 'save') {
            assert(db.homePresets.length < 200, '最多保存 200 套预设，请先导出并删除不需要的预设');
            const name = await ask({ title: '保存当前主页', description: '为这套布局取个喜欢的名字。', value: '我的主页', confirmText: '保存预设' });
            if (!name || !name.trim()) return;
            assert(name.trim().length <= 100, '名称最多 100 个字');
            const record = { id: uid(), name: name.trim(), updatedAt: Date.now(), data: capture() };
            await commit({ homePresets: [...db.homePresets, record], activeHomePresetId: record.id });
            toast('当前主页已保存');
        } else if (action === 'export-all') {
            assert(db.homePresets.length, '还没有可导出的预设');
            download(db.homePresets, '全部主页预设');
        } else if (action === 'undo') {
            assert(db.homePresetUndo, '没有可恢复的主页');
            const before = clone(db.homePresetUndo);
            await apply({ id: before.activeId, data: before.data });
            toast('已恢复上一次切换前的主页');
        } else {
            assert(preset, '预设不存在，请重新打开管理');
            if (action === 'apply' || action === 'edit') return apply(preset, action === 'edit');
            if (action === 'export') return download([preset], preset.name);
            if (action === 'overwrite') {
                if (!await ask({ title: '覆盖保存', description: '用当前主页更新「' + preset.name + '」，原来的布局和内容将被替换。', confirmText: '确认更新' })) return;
                const updated = { ...preset, data: capture(), updatedAt: Date.now() };
                await commit({ homePresets: db.homePresets.map(item => item.id === id ? updated : item), activeHomePresetId: id });
                toast('预设已更新');
            } else if (action === 'rename') {
                const name = await ask({ title: '重命名', description: '换一个名字，布局保持原样。', value: preset.name, confirmText: '保存名称' });
                if (!name || !name.trim()) return;
                assert(name.trim().length <= 100, '名称最多 100 个字');
                await commit({ homePresets: db.homePresets.map(item => item.id === id ? { ...item, name: name.trim() } : item) });
            } else if (action === 'copy') {
                assert(db.homePresets.length < 200, '最多保存 200 套预设');
                await commit({ homePresets: [...db.homePresets, { ...clone(preset), id: uid(), name: preset.name + ' 副本', updatedAt: Date.now() }] });
            } else if (action === 'delete') {
                if (!await ask({ title: '删除预设', description: '删除「' + preset.name + '」这套预设？当前主页和组件库会保留。', confirmText: '删除预设' })) return;
                await commit({ homePresets: db.homePresets.filter(item => item.id !== id), activeHomePresetId: db.activeHomePresetId === id ? null : db.activeHomePresetId });
                toast('预设已删除');
            }
        }
        render();
    }
    async function run(task) {
        if (busy) return;
        busy = true;
        const dialog = document.getElementById('hp-dialog');
        dialog.setAttribute('aria-busy', 'true');
        try { await task(); } catch (error) { console.error('主页预设：', error); toast(error.message || '操作失败，请重试'); }
        finally { busy = false; dialog.removeAttribute('aria-busy'); }
    }
    function placeEntry() {
        const form = document.getElementById('customize-form');
        const iconsRow = form && form.querySelector('[onclick*="icon-settings-modal"]');
        if (!iconsRow) return; // 等待原设置表单渲染，不在顶部插入独立按钮。
        let entry = document.getElementById('hp-entry');
        if (!entry) {
            entry = document.createElement('div');
            entry.id = 'hp-entry'; entry.className = 'kkt-item';
            entry.setAttribute('role', 'button'); entry.tabIndex = 0;
            entry.innerHTML = '<div class="kkt-item-icon">' + icon('home') + '</div><div class="kkt-item-content"><div class="kkt-item-title">主页预设</div><div class="kkt-item-subtitle">保存布局，切换你的主页</div></div><span class="kkt-arrow">›</span>';
        }
        if (iconsRow.nextElementSibling !== entry) iconsRow.after(entry);
    }
    function open() {
        render();
        previousFocus = document.activeElement;
        document.getElementById('hp-dialog').hidden = false;
        document.querySelector('#hp-dialog [data-hp-action="close"]').focus();
    }
    function mount() {
        if (document.getElementById('hp-dialog')) return;
        const form = document.getElementById('customize-form');
        if (!form) return;
        const style = document.createElement('style'); style.id = 'hp-ins-style';
        style.textContent = `
        #hp-entry {cursor:pointer;outline-offset:-4px}
        #hp-entry .kkt-item-icon {background:transparent;color:#171717}
        #hp-entry .kkt-item-icon svg {width:24px;height:24px;display:block}
        #hp-entry:focus-visible {outline:2px solid #171717}
        #hp-dialog,#hp-dialog * {box-sizing:border-box}
        #hp-dialog [hidden],#hp-dialog[hidden] {display:none!important}
        #hp-dialog {position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:16px;color:#161616;font:inherit}
        #hp-dialog svg {width:18px;height:18px;flex-shrink:0}
        #hp-dialog .hp-panel {width:100%;max-width:460px;max-height:88vh;max-height:88dvh;overflow:auto;overscroll-behavior:contain;background:#f7f7f7;border:1px solid #fff;border-radius:24px;scrollbar-width:thin}
        #hp-dialog .hp-header {padding:24px 22px 20px;background:#fff;border-bottom:1px solid #eaeaea;border-radius:24px 24px 0 0}
        #hp-dialog .hp-heading-top {display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
        #hp-dialog .hp-eyebrow {font-size:10px;letter-spacing:2.2px;font-weight:600;color:#777}
        #hp-dialog h3 {margin:0;font-size:25px;line-height:1.3;font-weight:700;letter-spacing:-.6px}
        #hp-dialog .hp-subtitle {font-size:12px;color:#888;line-height:1.7;margin:8px 0 0}
        #hp-dialog button,#hp-dialog summary {font:inherit;font-size:12px;appearance:none;-webkit-appearance:none;border:1px solid #dedede;border-radius:12px;padding:11px 13px;background:#fff;color:#242424;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px;line-height:1.35;box-shadow:none;min-height:42px}
        #hp-dialog button:hover {background:#f0f0f0}
        #hp-dialog button:focus-visible,#hp-dialog summary:focus-visible {outline:2px solid #555;outline-offset:2px}
        #hp-dialog button:disabled {opacity:.35;cursor:default}
        #hp-dialog button[data-hp-action="close"] {border:0;border-radius:50%;background:#f3f3f3;width:34px;height:34px;min-height:34px;padding:8px}
        #hp-dialog button[data-hp-action="close"] span {display:none}
        #hp-dialog .hp-toolbar {padding:18px 22px 0;display:grid;grid-template-columns:1fr 1fr;gap:10px}
        #hp-dialog [data-hp-action="save"],#hp-dialog [data-hp-action="apply"],#hp-dialog #hp-accept {background:#161616;color:#fff;border-color:#161616}
        #hp-dialog [data-hp-action="save"]:hover,#hp-dialog [data-hp-action="apply"]:hover,#hp-dialog #hp-accept:hover {background:#333}
        #hp-dialog .hp-utilities {display:flex;justify-content:space-between;gap:8px;padding:11px 22px 16px}
        #hp-dialog .hp-utilities button {border:0;background:transparent;color:#777;min-height:32px;font-size:11px;padding:5px 0;gap:5px}
        #hp-dialog .hp-utilities svg {width:14px;height:14px}
        #hp-dialog .hp-list-label {padding:0 22px;display:flex;justify-content:space-between;font-size:10px;letter-spacing:1.3px;color:#999;align-items:center}
        #hp-dialog #hp-count {letter-spacing:0;font-variant-numeric:tabular-nums;color:#555}
        #hp-dialog #hp-list {padding:12px 22px 6px;display:grid;gap:12px}
        #hp-dialog .hp-row {padding:18px;border:1px solid #e6e6e6;border-radius:17px;background:#fff;min-width:0}
        #hp-dialog .hp-active {border-color:#484848}
        #hp-dialog .hp-card-meta {display:flex;justify-content:space-between;align-items:center;min-height:20px;margin-bottom:11px}
        #hp-dialog .hp-number {font-size:10px;letter-spacing:1.3px;color:#aaa;font-variant-numeric:tabular-nums}
        #hp-dialog .hp-badge {font-size:9px;border-radius:20px;border:1px solid #d7d7d7;color:#333;padding:3px 8px;line-height:1.2}
        #hp-dialog h4 {margin:0;font-size:17px;font-weight:600;line-height:1.45;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:-.2px}
        #hp-dialog .hp-card-note {font-size:11px;color:#999;line-height:1.5;margin:6px 0 16px}
        #hp-dialog .hp-card-actions {display:grid;grid-template-columns:1fr 1fr;gap:8px}
        #hp-dialog .hp-card-actions button {border-radius:10px;min-height:38px;padding:9px 8px;font-size:11px}
        #hp-dialog .hp-card-actions svg {width:14px;height:14px}
        #hp-dialog .hp-more {margin-top:12px;padding-top:10px;border-top:1px solid #f1f1f1}
        #hp-dialog summary {list-style:none;padding:0;min-height:22px;border:0;color:#888;font-size:10px;border-radius:0;justify-content:flex-start;background:transparent}
        #hp-dialog summary::-webkit-details-marker {display:none}
        #hp-dialog summary svg {width:15px;height:15px}
        #hp-dialog .hp-extra-actions {display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:12px}
        #hp-dialog .hp-extra-actions button {font-size:11px;min-height:36px;padding:8px;background:#fafafa;border-color:#eee;border-radius:8px;justify-content:flex-start}
        #hp-dialog .hp-extra-actions svg {width:14px;height:14px}
        #hp-dialog .hp-empty {padding:28px 12px 30px;text-align:center;border:1px dashed #ddd;border-radius:17px;background:#fff}
        #hp-dialog .hp-empty-icon {display:flex;align-items:center;justify-content:center;width:46px;height:46px;background:#f4f4f4;border-radius:14px;margin:0 auto 16px;color:#555}
        #hp-dialog .hp-empty-icon svg {width:22px;height:22px}
        #hp-dialog .hp-empty strong {font-size:14px;font-weight:600}
        #hp-dialog .hp-empty p {font-size:11px;color:#999;line-height:1.7;margin:7px 0 0}
        #hp-dialog .hp-footer {padding:14px 22px 20px;font-size:10px;line-height:1.8;color:#999;margin:0}
        #hp-dialog[aria-busy="true"] .hp-panel button,#hp-dialog[aria-busy="true"] .hp-panel summary {pointer-events:none;opacity:.5}
        #hp-dialog .hp-sheet {position:absolute;inset:0;background:rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;padding:24px;border-radius:0}
        #hp-dialog .hp-sheet-box {background:#fff;border:1px solid #eee;border-radius:20px;padding:24px;width:100%;max-width:340px}
        #hp-dialog .hp-sheet-box h4 {font-size:19px;white-space:normal;margin-bottom:8px}
        #hp-dialog .hp-sheet-box p {font-size:12px;line-height:1.8;color:#888;margin:0 0 18px;overflow-wrap:anywhere}
        #hp-dialog #hp-name {width:100%;font:inherit;font-size:16px;border:1px solid #ddd;border-radius:10px;padding:12px;background:#fafafa;color:#161616;outline-offset:2px;margin-bottom:18px;min-width:0}
        #hp-dialog .hp-sheet-actions {display:grid;grid-template-columns:1fr 1fr;gap:10px}
        @media(max-width:360px) {#hp-dialog {padding:10px} #hp-dialog .hp-header {padding:20px 17px} #hp-dialog .hp-toolbar,#hp-dialog #hp-list {padding-left:17px;padding-right:17px} #hp-dialog .hp-list-label,#hp-dialog .hp-utilities {padding-left:17px;padding-right:17px} #hp-dialog .hp-row {padding:14px} #hp-dialog .hp-sheet {padding:18px}}
        @media(prefers-reduced-motion:no-preference) {#hp-dialog button {transition:background .15s ease}}
        `;
        document.head.appendChild(style);
        const dialog = document.createElement('div'); dialog.id = 'hp-dialog'; dialog.hidden = true;
        dialog.innerHTML = '<section class="hp-panel" role="dialog" aria-modal="true" aria-labelledby="hp-title"><header class="hp-header"><div class="hp-heading-top"><span class="hp-eyebrow">HOME / COLLECTION</span><div class="hp-close-slot"></div></div><h3 id="hp-title">主页预设</h3><p class="hp-subtitle">留住喜欢的布局，随心切换。</p></header><div class="hp-toolbar"></div><div class="hp-utilities"></div><div class="hp-list-label"><span>MY PRESETS</span><span id="hp-count">00</span></div><div id="hp-list"></div><p class="hp-footer">修改主页后，在原预设中选择「覆盖保存」。</p><input id="hp-import" type="file" accept=".json,application/json" hidden></section><div id="hp-sheet" class="hp-sheet" hidden><form id="hp-sheet-form" class="hp-sheet-box" role="dialog" aria-modal="true" aria-labelledby="hp-sheet-title"><h4 id="hp-sheet-title"></h4><p id="hp-sheet-description"></p><input id="hp-name" aria-label="预设名称" maxlength="100" autocomplete="off"><div class="hp-sheet-actions"><button id="hp-cancel" type="button">取消</button><button id="hp-accept" type="submit">确认</button></div></form></div>';
        [['保存当前主页', 'save'], ['导入预设', 'import']].forEach(([label, action]) => dialog.querySelector('.hp-toolbar').appendChild(button(label, action)));
        [['导出全部', 'export-all'], ['恢复上次主页', 'undo']].forEach(([label, action]) => dialog.querySelector('.hp-utilities').appendChild(button(label, action)));
        const closeButton = button('关闭', 'close'); closeButton.setAttribute('aria-label', '关闭主页预设');
        dialog.querySelector('.hp-close-slot').appendChild(closeButton);
        document.body.appendChild(dialog);
        placeEntry();
        new MutationObserver(placeEntry).observe(form, { childList: true, subtree: true });
        document.addEventListener('click', event => {
            if (event.target.closest('#hp-entry')) open();
        });
        dialog.addEventListener('click', event => {
            if (event.target === dialog && !busy) return close();
            const control = event.target.closest('button[data-hp-action]');
            if (control) run(() => handle(control.dataset.hpAction, control.dataset.hpId));
        });
        document.addEventListener('keydown', event => {
            if (event.target.closest && event.target.closest('#hp-entry') && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); open(); }
            if (dialog.hidden) return;
            if (event.key === 'Escape' && !busy) close();
            if (event.key === 'Tab') {
                const scope = document.getElementById('hp-sheet').hidden ? dialog.querySelector('.hp-panel') : document.getElementById('hp-sheet');
                const focusable = [...scope.querySelectorAll('button:not(:disabled),summary,input:not([hidden])')].filter(el => el.getClientRects().length);
                const first = focusable[0], last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        });
        document.getElementById('hp-import').addEventListener('change', event => run(async () => {
            const file = event.target.files[0];
            event.target.value = '';
            if (!file) return;
            assert(file.size <= 100 * 1024 * 1024, '文件超过 100MB，请分别导入');
            const imported = parseImport(await file.text());
            ensure();
            assert(db.homePresets.length + imported.length <= 200, '导入后超过 200 套预设，请先整理现有预设');
            await commit({ homePresets: [...db.homePresets, ...imported] });
            render(); toast(`已导入 ${imported.length} 套预设，点击「应用」切换`);
        }));
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
})();
