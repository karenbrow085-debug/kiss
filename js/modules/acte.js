(() => {
    'use strict';
    const D = window.ActeData;
    const atlas = 'assets/acte-stage.jpg';
    const tabs = {discover:'发现', library:'剧库', quotes:'剧摘', studio:'工坊'};
    const icons = {
        discover:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/>',
        library:'<path d="M4 5h4v14H4zm6 0h4v14h-4zm6 0 3-1 4 14-3 1z"/>',
        quotes:'<path d="M6 4h12v16l-6-4-6 4z"/>',
        studio:'<path d="M3 6h18M3 12h18M3 18h18M8 3v6m8 0v6m-5 0v6"/>',
        sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
        moon:'<path d="M20 15A8 8 0 0 1 9 4a8.5 8.5 0 1 0 11 11Z"/>',
        close:'<path d="m6 6 12 12M18 6 6 18"/>',
        search:'<circle cx="10" cy="10" r="5.5"/><path d="m14 14 5 5"/>'
    };
    const icon = (type) => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[type] + '</svg>';
    const E = D.esc;
    const btn = (action, label, css = '', value = '', aria = '') => '<button type="button" class="' + css + '" data-acte="' + action + '" data-value="' + E(value) + '"' + (aria ? ' aria-label="' + E(aria) + '"' : '') + '>' + label + '</button>';
    const field = (label, body) => '<label class="ac-field"><span>' + label + '</span>' + body + '</label>';
    const empty = text => '<p class="ac-empty">' + E(text) + '</p>';
    const heading = (label, action = '') => '<div class="ac-section-title"><h2>' + label + '</h2>' + action + '</div>';
    const state = {
        page:'discover', studio:'generate', kind:'dialogue', genre:'', status:'', query:'', sort:'latest',
        quoteTab:'saved', quoteSource:'', featured:0, work:null, sheet:'', theme:'day',
        draft:new Map(), size:16, castFromChat:'', works:[], quotes:[], recent:[], templates:[],
        promptId:'curtain', promptDraft:null, importFile:null, generated:null, shared:null
    };
    let app, busy = false, returnPage = 'discover', opening = false;
    const pendingCards = new Map();
    const currentChat = () => typeof currentChatType !== 'undefined' && currentChatType === 'private' ? D.character(currentChatId) : null;
    const num = n => String(n).padStart(2, '0');
    const date = at => new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit'}).format(at);
    const time = at => new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}).format(at);
    const status = w => w.status === 'done' ? '已落幕' : '进行中';
    const getAct = w => w.acts[w.current];
    const progress = w => w.status === 'done' ? 100 : Math.min(99, Math.round((w.current + (getAct(w).rows.length ? .55 : 0)) / w.acts.length * 100));
    const summary = w => D.kinds[w.kind] + ' · ' + w.genre;
    const art = (w, css = '') => '<span class="ac-art ' + css + '">' +
        (D.image(w.cover) ? '<img src="' + E(D.image(w.cover)) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' :
            '<img class="ac-sprite ac-tile-' + (w.art ?? 0) + '" src="' + atlas + '" alt="" draggable="false">') + '</span>';
    function avatar(id, label) {
        const c = D.character(id), src = D.image(c?.avatar);
        return src ? '<img class="ac-avatar" src="' + E(src) + '" alt="" referrerpolicy="no-referrer">' :
            '<span class="ac-avatar ac-avatar-letter" aria-hidden="true">' + E((label || D.name(c))[0]) + '</span>';
    }
    const progressBar = w => '<div class="ac-progress"><i><b style="width:' + progress(w) + '%"></b></i><small>' + progress(w) + '%</small></div>';
    function controls(values, current, action, css = 'ac-segment') {
        return '<div class="' + css + '">' + Object.entries(values).map(([key,label]) =>
            btn(action,E(label),key === current ? 'ac-selected' : '',key)).join('') + '</div>';
    }
    function top(title, extra = '', back = '') {
        return '<header class="ac-top">' + (back ? btn(back,icon('close'),'ac-icon','','返回') : '') +
            '<h1>' + E(title) + '</h1>' + extra + '</header>';
    }
    function nav() {
        return '<nav class="ac-nav" aria-label="剧幕">' + Object.entries(tabs).map(([key,label]) =>
            btn('tab',icon(key) + '<span>' + label + '</span>',state.page === key ? 'ac-selected' : '',key)).join('') + '</nav>';
    }
    function workRow(w, compact = false) {
        return btn(compact ? 'resume' : 'detail',art(w) + '<span class="ac-work-copy"><strong>' + E(w.title) + '</strong>' +
            (!compact ? '<small>' + E(summary(w)) + (w.example ? ' · 示例' : '') + '</small>' : '') + '<small>第 ' + (w.current + 1) + ' 幕　' +
            E(getAct(w).title) + '</small>' + progressBar(w) + '</span>' + (!compact ? '<em>' + status(w) + '</em>' : ''),
            'ac-work-row',w.id);
    }
    function discover() {
        const featured = [...state.works].sort((a,b) => b.created - a.created).slice(0,4);
        const w = featured[state.featured % Math.max(1, featured.length)];
        const current = state.works.filter(w => w.status === 'active' && w.started).sort((a,b) => b.updated - a.updated).slice(0,2);
        return '<div class="ac-discover-hero">' + art(w?.cover ? w : {art:0},'ac-hero-art') +
            top('剧幕',btn('search',icon('search'),'ac-icon','','搜索') + btn('theme',icon(state.theme === 'day' ? 'moon' : 'sun'),'ac-icon','','切换日夜间') +
                btn('close',icon('close'),'ac-icon','','返回 404')) +
            '<div class="ac-hero-copy"><small>ACTE / SCENE INDEX</small><h2>' + E(w?.title || '今晚开场') + '</h2><p>' +
            E((w?.synopsis || '给平行世界留一盏灯。').slice(0,95)) + '</p>' +
            (w ? btn('detail','查看剧场','ac-hero-button',w.id) : btn('tab','打开剧库','ac-hero-button','library')) +
            '</div>' + (featured.length > 1 ? '<div class="ac-dots">' + featured.map((row,i) => btn('feature','',row === w ? 'ac-selected' : '',i,row.title)).join('') + '</div>' : '') + '</div>' +
            '<section class="ac-pad">' + heading('继续演出') + (current.length ? current.map(w => workRow(w,true)).join('') : empty('开演后，进度会留在这里。')) +
            (featured.length ? heading('本周新幕') + '<div class="ac-poster-grid">' + featured.filter(row => row.id !== w.id).map(row =>
                btn('detail',art(row) + '<strong>' + E(row.title) + '</strong><small>' + E(summary(row)) + '</small>','ac-poster',row.id)).join('') + '</div>' : '') + '</section>';
    }
    function library() {
        const query = state.query.toLowerCase().trim();
        const found = state.works.filter(w => w.kind === state.kind &&
            (!state.genre || state.genre === w.genre) && (!state.status || state.status === w.status) &&
            (!query || [w.title,w.synopsis,...w.cast.map(c => D.name(D.character(c.id))),...w.acts.flatMap(a => a.rows.map(r => r.text))]
                .some(v => String(v).toLowerCase().includes(query))))
            .sort((a,b) => state.sort === 'title' ? a.title.localeCompare(b.title,'zh-CN') : b.updated - a.updated);
        return top('剧库',btn('new','新建','ac-text-button')) + '<div class="ac-pad ac-library">' +
            '<label class="ac-search">' + icon('search') + '<input type="search" data-field="query" placeholder="搜索剧目、角色、台词" value="' + E(state.query) + '"></label>' +
            controls(D.kinds,state.kind,'kind','ac-tabs') +
            controls({'':'全部题材',...Object.fromEntries(D.genres.map(x => [x,x]))},state.genre,'genre','ac-chips') +
            '<div class="ac-library-tools">' + controls({'':'全部',active:'进行中',done:'已落幕'},state.status,'status','ac-inline') +
            btn('sort',state.sort === 'latest' ? '最新' : '按剧名','ac-text-button') + '</div>' +
            '<div class="ac-library-results">' + (found.map(w => workRow(w)).join('') || empty('这个分类还没有剧目。')) + '</div></div>';
    }
    function quotePage() {
        const list = state.quoteTab === 'saved' ? state.quotes : state.recent;
        const sources = {'':'全部来源',...Object.fromEntries(list.map(q => [q.workId,q.title]))};
        return top('剧摘') + '<div class="ac-pad">' +
            controls({saved:'收藏',recent:'最近'},state.quoteTab,'quote-tab') +
            (list.length ? controls(sources,state.quoteSource,'quote-source','ac-chips') : '') +
            (list.filter(q => !state.quoteSource || q.workId === state.quoteSource).sort((a,b) => b.at-a.at).map(q => {
                const w = state.works.find(w => w.id === q.workId);
                return '<article class="ac-quote"><blockquote>' + inline(q.text) + '</blockquote>' + (w ? art(w) : '') +
                    '<div>' + btn('quote-open',E(q.title) + ' · 第 ' + (q.act + 1) + ' 幕','ac-source',q.id) +
                    '<time>' + date(q.at) + '</time>' + btn('quote-toggle',icon('quotes'),'ac-icon ' +
                    (state.quotes.some(x => x.id === q.id) ? 'ac-marked' : ''),q.id,'切换收藏') + '</div></article>';
            }).join('') || empty('在演出页收藏一句台词或一段长文。')) + '</div>';
    }
    function detail(w) {
        const cast = w.cast.map(r => {
            const c = D.character(r.id);
            return '<div class="ac-cast-card">' + avatar(r.id) + '<strong>' + E(D.name(c)) + '</strong><small>' +
                (r.memory ? '携带记忆' : '剧场设定') + '</small></div>';
        }).join('');
        return '<div class="ac-detail-hero">' + art(w) + '<header class="ac-top">' +
            btn('back',icon('close'),'ac-icon','','返回') +
            (!state.shared ? btn('settings',icon('studio'),'ac-icon','','剧场设置') : '') + '</header></div>' +
            '<div class="ac-pad ac-detail-body"><h1>' + E(w.title) + '</h1><small>' + E(summary(w)) +
            ' · ' + (state.shared?.scope === 'teaser' ? '预告' : status(w)) + ' · 共 ' + w.acts.length + ' 幕</small>' +
            (w.synopsis ? '<p>' + E(w.synopsis) + '</p>' : '') +
            (cast ? heading('主演') + '<div class="ac-cast">' + cast + '</div>' : '') +
            (state.shared?.scope === 'teaser' ? '' :
                '<div class="ac-detail-actions">' + btn('play',w.started || w.current ? '继续第 ' + (w.current + 1) + ' 幕' : '开始演出','ac-primary') +
                (!state.shared ? btn('share','发送给角色','ac-outline') : '') + '</div>' +
                (w.kind === 'html' ? '' : heading('场次') + sceneRows(w,false))) + '</div>';
    }
    function sceneRows(w, thumbs) {
        return '<div class="ac-scenes">' + w.acts.map((a,i) => btn('scene',
            (thumbs ? art({art:i ? (i + w.art) % 6 : w.art}) : '') +
            '<span class="ac-number">' + num(i+1) + '</span><span class="ac-scene-title">' + E(a.title) + '</span><small>' +
            (i === w.current ? '当前' : a.rows.length ? '已演出' : '未开始') + '</small>',
            'ac-scene ' + (i === w.current ? 'ac-selected' : ''),i)).join('') + '</div>';
    }
    function inline(text) {
        return E(text).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>')
            .replace(/\*([^*\n]+)\*/g,'<em>$1</em>');
    }
    function reader(w) {
        const a = getAct(w);
        const prose = w.kind === 'prose';
        const tools = !state.shared ? btn('scenes','场次','ac-text-button') + (prose ? btn('size','字号','ac-text-button') : '') : btn('scenes','场次','ac-text-button');
        const controlsHtml = !state.shared ? '<form data-form="turn" class="ac-composer"><textarea name="turn" rows="1" maxlength="16000" placeholder="' +
            (prose ? '续写这一幕…' : '说一句…') + '">' + E(state.draft.get(a.id) || '') + '</textarea>' +
            '<button type="submit" class="ac-primary">' + (prose ? '续写' : '发送') + '</button></form>' : '';
        return top(w.title,'', 'detail-back') + '<div class="ac-reader-kicker"><span>第 ' + num(w.current+1) + ' 幕　' + E(a.title) +
            '</span>' + (prose ? progressBar(w) : '') + '</div>' +
            (prose ? '' : art(w,'ac-reader-art')) + '<div class="ac-reading" style="--ac-reading-size:' + state.size + 'px">' +
            (a.rows.map((r,i) => {
                const c = w.cast.find(row => D.name(D.character(row.id)) === r.speaker);
                const label = r.speaker || (r.role === 'user' ? '我' : '角色');
                const bookmark = !state.shared ? btn('save-row',icon('quotes'),'ac-icon ' +
                    (state.quotes.some(q => q.id === r.id) ? 'ac-marked' : ''),r.id,'收藏剧摘') : '';
                return '<article id="ac-row-' + E(r.id) + '" class="' + (prose ? 'ac-floor' : 'ac-turn ' + (r.role === 'user' ? 'ac-mine' : '')) +
                    '"><header>' + (prose ? '<b>#' + num(i+1) + '</b>' : '') + avatar(c?.id,label) + '<strong>' + E(label) +
                    '</strong><time>' + time(r.at) + '</time>' + bookmark + '</header><div class="ac-turn-text">' + inline(r.text) + '</div></article>';
            }).join('') || empty(w.synopsis || '这一幕等你开场。')) + '</div><footer class="ac-reader-tools">' +
            '<div>' + tools + '</div>' + controlsHtml + '</footer>';
    }
    function htmlFrame(source, progress, track = false) {
        return '<iframe class="ac-frame" title="HTML 剧场" sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="' + E(D.preview(source,progress,track)) + '"></iframe>';
    }
    function studio() {
        const presets = [...D.presets,...state.templates];
        const chosen = presets.find(p => p.id === state.promptId) || presets[0];
        const templateCards = '<div class="ac-template-grid">' + presets.map(p => btn('preset',
            art(p) + '<span><strong>' + E(p.name) + '</strong></span>','ac-template ' +
            (p.id === chosen.id ? 'ac-selected' : ''),p.id)).join('') + '</div>';
        let content;
        if (state.studio === 'files') {
            content = btn('import','导入 HTML','ac-outline ac-wide') + heading('剧场文件') +
                (state.works.filter(w => w.kind === 'html').map(w => workRow(w)).join('') || empty('导入或生成的 HTML 会出现在这里。'));
        } else if (state.studio === 'templates') {
            content = templateCards + '<div class="ac-form-actions">' + btn('use-template','使用模板','ac-primary',chosen.id) + '</div>' + (!D.presets.some(p => p.id === chosen.id) ?
                '<div class="ac-form-actions">' + btn('export-template','导出模板','ac-outline',chosen.id) +
                btn('delete-template','删除模板','ac-outline',chosen.id) + '</div>' : '');
        } else {
            content = templateCards + '<form data-form="generate" class="ac-form">' +
                field('剧场名称','<input name="title" maxlength="80" required placeholder="给这一幕起个名字">') +
                field('剧情设定','<textarea name="synopsis" rows="3" maxlength="6000" required placeholder="角色、背景与这一幕发生的事"></textarea>') +
                field('生成词','<textarea name="prompt" rows="4" maxlength="8000">' + E(state.promptDraft ?? chosen.prompt) + '</textarea>') +
                '<div class="ac-form-actions">' + btn('save-prompt','存为模板','ac-outline') +
                '<button class="ac-primary" type="submit">生成预览</button></div></form>';
        }
        return top('工坊') + '<div class="ac-pad">' + controls({generate:'生成',templates:'模板',files:'文件'},state.studio,'studio-tab') + content + '</div>';
    }
    function sheet(title, body) {
        return '<div class="ac-scrim"><section class="ac-sheet" role="dialog" aria-modal="true" aria-label="' + E(title) +
            '"><div class="ac-handle"></div><header><h2>' + E(title) + '</h2>' +
            btn('sheet-close',icon('close'),'ac-icon','','关闭') + '</header><div class="ac-sheet-body">' + body + '</div></section></div>';
    }
    function formSetup(w) {
        const selected = w?.cast || (state.castFromChat ? [{id:state.castFromChat,memory:false}] : []);
        const options = (values, current) => Object.entries(values).map(([value,label]) =>
            '<option value="' + E(value) + '"' + (value === current ? ' selected' : '') + '>' + E(label) + '</option>').join('');
        return '<form class="ac-form" data-form="setup">' +
            field('剧名','<input name="title" maxlength="80" required value="' + E(w?.title) + '">') +
            '<div class="ac-form-pair">' + (!w ? field('写法','<select name="kind">' + options({dialogue:'对话',prose:'长文'},state.kind === 'html' ? 'dialogue' : state.kind) + '</select>') : '') +
            field('题材','<select name="genre">' + options(Object.fromEntries(D.genres.map(x => [x,x])),w?.genre || state.genre) + '</select>') + '</div>' +
            field('剧情设定','<textarea name="synopsis" maxlength="6000" rows="3">' + E(w?.synopsis) + '</textarea>') +
            '<fieldset><legend>出场角色</legend>' + (D.characters().map(c => {
                const row = selected.find(r => r.id === String(c.id));
                return '<div class="ac-cast-option">' + avatar(c.id) + '<label><input type="checkbox" name="cast" value="' +
                    E(c.id) + '"' + (row ? ' checked' : '') + '>' + E(D.name(c)) + '</label><label class="ac-memory">携带记忆 <input type="checkbox" name="memory" value="' +
                    E(c.id) + '"' + (row?.memory ? ' checked' : '') + '></label></div>';
            }).join('') || empty('先在 404 添加角色。')) + '</fieldset>' +
            '<fieldset><legend>角色知晓</legend><div class="ac-radio-pair"><label><input type="radio" name="aware" value="no"' +
            (!w?.aware ? ' checked' : '') + '>私密试演</label><label><input type="radio" name="aware" value="yes"' +
            (w?.aware ? ' checked' : '') + '>告知角色</label></div><small>告知后，出场角色在 404 可以读到剧名与简介。</small></fieldset>' +
            (w ? '<div class="ac-cover-preview">' + art(w) + btn('cover','更换封面','ac-outline') + '</div>' : '') +
            '<button type="submit" class="ac-primary ac-wide">' + (w ? '保存设置' : '创建剧场') + '</button></form>' +
            (w ? '<div class="ac-form-actions">' + btn('finish',w.status === 'done' ? '恢复演出' : '标记落幕','ac-outline') +
                btn('export','导出 HTML','ac-outline') + btn('delete','删除剧场','ac-outline') + '</div>' : '');
    }
    function coverSheet(w) {
        return '<div class="ac-cover-preview">' + art(w) + '</div><div class="ac-cover-sources">' +
            btn('gallery','绘图工坊','ac-outline') + '<label class="ac-outline">本地图片<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" data-file="cover"></label></div>' +
            '<form class="ac-form" data-form="cover-url">' + field('图片 URL','<input name="url" type="url" required placeholder="https://…">') +
            '<button type="submit" class="ac-primary">使用链接</button></form>' + (w.cover ? btn('cover-reset','恢复默认封面','ac-text-button') : '');
    }
    function sheetContent(w) {
        switch (state.sheet) {
        case 'new': return sheet('新建文字剧场',formSetup(null));
        case 'settings': return sheet('剧场设置',formSetup(w));
        case 'cover': return sheet('更换封面',coverSheet(w));
        case 'gallery': return sheet('绘图工坊图库', '<div class="ac-gallery">' + (state.gallery || []).map(row =>
            btn('gallery-cover',art({cover:D.image(row.image,true)}),'',row.id,row.prompt || '选择图片')).join('') + '</div>' +
            ((state.gallery || []).length ? (state.galleryMore ? btn('gallery-more','加载更多','ac-outline ac-wide') : '') : empty('绘图工坊还没有已保存的图片。')));
        case 'scenes': return sheet('场次',sceneRows(w,true) + (!state.shared ? '<form data-form="act" class="ac-form ac-form-pair">' +
            '<input name="title" maxlength="80" placeholder="下一幕的名字" required><button class="ac-outline" type="submit">新增一幕</button></form>' : ''));
        case 'share': return sheet('发送给角色','<div class="ac-share-preview">' + art(w) + '<div><strong>' + E(w.title) + '</strong><small>' + E(summary(w)) +
            '</small></div></div><form data-form="share" class="ac-form">' + field('接收角色','<select name="recipient" required><option value="">选择角色</option>' +
            D.characters().map(c => '<option value="' + E(c.id) + '"' + (String(c.id) === state.castFromChat ? ' selected' : '') + '>' + E(D.name(c)) + '</option>').join('') +
            '</select>') + '<fieldset><legend>发送内容</legend><label><input type="radio" name="scope" value="teaser" checked>发送预告</label>' +
            '<label><input type="radio" name="scope" value="script">发送剧本</label></fieldset><button type="submit" class="ac-primary ac-wide">发送到 404</button></form>');
        case 'export': return sheet('导出 HTML','<form data-form="export" class="ac-form"><fieldset><label><input type="radio" name="scope" value="work" checked>完整剧场</label>' +
            '<label><input type="radio" name="scope" value="template">仅导出模板</label></fieldset><button type="submit" class="ac-primary">导出文件</button></form>');
        case 'import': return sheet('导入 HTML','<form data-form="import" class="ac-form">' +
            '<label class="ac-file"><input type="file" accept=".html,.htm,text/html" data-file="html">' + E(state.importFile?.filename || '选择 HTML 文件') + '</label>' +
            (state.importFile ? '<strong>' + E(state.importFile.title) + '</strong>' : '') +
            '<fieldset><label><input type="radio" name="scope" value="work" checked>完整剧场</label><label><input type="radio" name="scope" value="template">仅作模板</label></fieldset>' +
            '<button type="submit" class="ac-primary">预览导入</button></form>');
        case 'confirm-import': return sheet('导入预览',htmlFrame(state.importFile.html) + btn('commit-import','确认导入','ac-primary ac-wide'));
        case 'generated': return sheet('生成预览',htmlFrame(state.generated.html) + btn('save-generated','保存剧场','ac-primary ac-wide'));
        case 'delete': return sheet('删除剧场','<p>删除「' + E(w.title) + '」及其演出进度和剧摘？</p>' +
            btn('confirm-delete','确认删除','ac-primary ac-wide'));
        default: return '';
        }
    }
    function render(scroll = null) {
        if (!app) return;
        const w = state.shared?.work || state.work;
        const pages = {discover,library,quotes:quotePage,studio,detail:() => detail(w),
            reader:() => w.kind === 'html' ? top(w.title,'','detail-back') + htmlFrame(w.html,w.htmlProgress,!state.shared) : reader(w)};
        app.dataset.theme = state.theme;
        app.innerHTML = '<main class="ac-main ac-page-' + state.page + '">' + pages[state.page]() + '</main>' +
            (state.page in tabs ? nav() : '') + sheetContent(w);
        if (scroll !== null) app.querySelector('.ac-main').scrollTop = scroll;
    }
    async function refresh() {
        [state.works,state.quotes,state.recent,state.templates] = await Promise.all(['work','quote','recent','template'].map(D.list));
    }
    async function open(shared = null) {
        if (opening || app) return;
        opening = true;
        try {
            await D.installExamples();
            await refresh();
            state.theme = localStorage.getItem('kiss.acte.theme') === 'night' ? 'night' : 'day';
            state.castFromChat = String(currentChat()?.id || '');
            state.page = shared ? 'detail' : 'discover';
            state.shared = shared;
            state.work = null;
            state.sheet = '';
            returnPage = 'discover';
            app = document.createElement('div');
            app.id = 'kiss-acte';
            app.setAttribute('aria-label','剧幕');
            app.addEventListener('click',click);
            app.addEventListener('submit',submit);
            app.addEventListener('change',change);
            app.addEventListener('input',input);
            app.addEventListener('keydown',key);
            if (document.getElementById('chat-expansion-panel')?.classList.contains('visible')) showPanel('none');
            document.body.append(app);
            render();
        } finally { opening = false; }
    }
    function close() {
        app?.remove();
        app = null;
        clearTimeout(noticeTimer);
        state.sheet = '';
        state.shared = null;
    }
    let noticeTimer;
    function note(text) {
        if (!app) { showToast(text); return; }
        app.querySelector('.ac-notice')?.remove();
        const notice = document.createElement('div');
        notice.className = 'ac-notice';
        notice.setAttribute('role','status');
        notice.textContent = text;
        app.append(notice);
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => notice.remove(),3800);
    }
    const error = e => note(e.message || '剧幕操作失败');
    const position = () => app?.querySelector('.ac-main')?.scrollTop || 0;
    async function update(fn) {
        state.work = await D.revise(state.work.id,fn);
        await refresh();
    }
    function goDetail(id) {
        const work = state.works.find(row => row.id === id);
        if (!work) throw Error('这部剧场已不存在');
        returnPage = state.page in tabs ? state.page : returnPage;
        state.work = work;
        state.page = 'detail';
        state.sheet = '';
    }
    async function play(index) {
        const w = state.shared?.work || state.work;
        if (state.shared) w.current = index;
        else await update(row => { row.current = index; row.started = true; });
        state.page = 'reader';
        state.sheet = '';
    }
    async function loadGallery(append = false) {
        const rows = await dexieDB.workshopHistory.orderBy('timestamp').reverse().offset(append ? state.gallery.length : 0).limit(25).toArray();
        state.gallery = [...(append ? state.gallery : []),...rows.slice(0,24)];
        state.galleryMore = rows.length > 24;
        state.sheet = 'gallery';
    }
    async function setCover(cover) {
        await update(w => { w.cover = cover; });
        state.sheet = 'settings';
    }
    function download(title, html) {
        const file = new Blob([html],{type:'text/html;charset=utf-8'});
        if (file.size > D.maxFile) throw Error('剧场超过 32 MB，请先缩小文件再导出');
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = title.replace(/[\\/:*?"<>|]/g,'_') + '.html';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url),1000);
    }
    async function toggleQuote(q) {
        if (!q) return;
        if (state.quotes.some(x => x.id === q.id)) await D.remove('quote',q.id);
        else await D.write('quote',{...q,at:Date.now()});
        await refresh();
    }
    async function click(event) {
        const b = event.target.closest('[data-acte]');
        if (!b || busy) return;
        const v = b.dataset.value;
        const scroll = position();
        let keep = false, targetRow = '', notice = '';
        busy = true;
        try {
            switch (b.dataset.acte) {
            case 'close': close(); return;
            case 'tab': state.page = v; state.sheet = ''; break;
            case 'theme': state.theme = state.theme === 'day' ? 'night' : 'day'; localStorage.setItem('kiss.acte.theme',state.theme); keep = true; break;
            case 'feature': state.featured = Number(v); keep = true; break;
            case 'search': state.page = 'library'; break;
            case 'kind': state.kind = v; state.query = ''; state.genre = ''; break;
            case 'genre': state.genre = v; break;
            case 'status': state.status = v; break;
            case 'sort': state.sort = state.sort === 'latest' ? 'title' : 'latest'; break;
            case 'detail': goDetail(v); break;
            case 'resume': goDetail(v); await play(state.work.current); break;
            case 'back': if (state.shared) { close(); return; } state.page = returnPage; break;
            case 'detail-back': state.page = 'detail'; break;
            case 'play': await play((state.shared?.work || state.work).current); break;
            case 'scene': await play(Number(v)); break;
            case 'size': state.size = state.size >= 20 ? 14 : state.size+2; keep = true; break;
            case 'scenes': case 'settings': case 'new': case 'share': case 'export': case 'delete':
                state.sheet = b.dataset.acte; keep = true; break;
            case 'sheet-close': state.sheet = ''; keep = true; break;
            case 'finish':
                await update(w => { w.status = w.status === 'done' ? 'active' : 'done'; });
                state.sheet = ''; break;
            case 'cover': state.sheet = 'cover'; break;
            case 'cover-reset': await setCover(''); break;
            case 'gallery': await loadGallery(); break;
            case 'gallery-more': await loadGallery(true); break;
            case 'gallery-cover': {
                const cover = D.image(state.gallery.find(row => String(row.id) === v)?.image,true);
                if (!cover) throw Error('这张图片无法读取');
                await setCover(cover); break;
            }
            case 'studio-tab': state.studio = v; break;
            case 'preset':
                state.promptId = v; state.promptDraft = null;
                    break;
            case 'use-template': state.promptId = v; state.promptDraft = null; state.studio = 'generate'; break;
            case 'save-prompt': {
                const prompt = app.querySelector('[name=prompt]').value.trim();
                if (!prompt) throw Error('请先填写生成词');
                const name = app.querySelector('[name=title]').value.trim() || '自定义生成词';
                const saved = await D.write('template',{id:D.uid(),name,prompt,art:0,html:''});
                await refresh(); state.promptId = saved.id; state.promptDraft = null; notice = '已保存模板'; break;
            }
            case 'import': state.importFile = null; state.sheet = 'import'; break;
            case 'commit-import': await commitImport(); break;
            case 'export-template': {
                const t = state.templates.find(row => row.id === v);
                if (t) download(t.name,D.exportHtml({title:t.name,templateHtml:t.html},true,t.prompt));
                break;
            }
            case 'delete-template':
                await D.remove('template',v); await refresh(); state.promptId = 'curtain'; break;
            case 'save-generated': {
                const created = await D.write('work',D.makeWork(state.generated));
                await refresh(); goDetail(created.id); state.generated = null; break;
            }
            case 'quote-tab': state.quoteTab = v; state.quoteSource = ''; break;
            case 'quote-source': state.quoteSource = v; break;
            case 'save-row': {
                const w = state.work, r = getAct(w).rows.find(r => r.id === v);
                if (r) await toggleQuote({id:r.id,workId:w.id,act:w.current,title:w.title,text:r.text});
                keep = true; break;
            }
            case 'quote-toggle': await toggleQuote([...state.quotes,...state.recent].find(q => q.id === v)); keep = true; break;
            case 'quote-open': {
                const q = [...state.quotes,...state.recent].find(q => q.id === v);
                if (q) { goDetail(q.workId); await play(q.act); targetRow = q.id; }
                break;
            }
            case 'confirm-delete': {
                const id = state.work.id;
                await dexieDB.transaction('rw',dexieDB.acte,async () => {
                    await D.remove('work',id);
                    for (const [group,rows] of [['quote',state.quotes],['recent',state.recent]]) {
                        await Promise.all(rows.filter(q => q.workId === id).map(q => D.remove(group,q.id)));
                    }
                });
                await refresh(); state.sheet = ''; state.page = returnPage; state.work = null; break;
            }
            default: return;
            }
            render(keep ? scroll : null);
            if (notice) note(notice);
            if (b.dataset.acte === 'search') app.querySelector('[data-field=query]')?.focus();
            if (targetRow) document.getElementById('ac-row-' + targetRow)?.scrollIntoView({block:'center'});
        } catch (e) { error(e); } finally { busy = false; }
    }
    async function commitImport() {
        const entry = state.importFile;
        if (entry.scope === 'template') {
            const t = await D.write('template',{id:D.uid(),name:entry.pack?.name || entry.title,
                prompt:entry.pack?.prompt || entry.pack?.work?.stylePrompt || '',
                html:entry.pack?.kind === 'work' ? entry.pack.work.templateHtml || '' : entry.html,art:0});
            await refresh(); state.promptId = t.id; state.studio = 'templates'; state.sheet = '';
        } else {
            const data = entry.pack?.kind === 'work' ? entry.pack.work : {};
            const w = await D.write('work',D.makeWork({title:entry.title,...data,aware:false,example:false,html:entry.html},true));
            await refresh(); goDetail(w.id);
        }
        state.importFile = null;
    }
    async function submit(event) {
        const form = event.target;
        if (!form.dataset.form) return;
        event.preventDefault();
        if (busy) return;
        busy = true;
        const button = form.querySelector('[type=submit]');
        const scroll = position();
        if (button) { button.disabled = true; button.setAttribute('aria-busy','true'); }
        const data = new FormData(form);
        const value = key => String(data.get(key) || '').trim();
        try {
            switch (form.dataset.form) {
            case 'setup': {
                const memory = data.getAll('memory');
                const cast = data.getAll('cast').map(id => ({id,memory:memory.includes(id)}));
                const attrs = {title:value('title'),genre:value('genre'),synopsis:value('synopsis'),cast,aware:value('aware') === 'yes'};
                if (!attrs.title) throw Error('请填写剧名');
                if (state.sheet === 'new') {
                    const work = await D.write('work',D.makeWork({...attrs,kind:value('kind'),art:1},true));
                    await refresh(); goDetail(work.id);
                } else { await update(w => Object.assign(w,attrs)); state.sheet = ''; }
                break;
            }
            case 'cover-url': {
                const cover = D.image(value('url'));
                if (!cover || !/^https?:/.test(cover)) throw Error('请输入有效的图片 URL');
                const img = new Image();
                img.referrerPolicy = 'no-referrer';
                img.src = cover;
                await img.decode().catch(() => { throw Error('无法读取这张图片，请检查链接'); });
                await setCover(cover); break;
            }
            case 'act':
                if (!value('title')) throw Error('请填写场次名称');
                await update(w => { w.acts.push({id:D.uid(),title:value('title'),rows:[]}); });
                break;
            case 'turn': await turn(value('turn')); break;
            case 'share': await sendCard(value('recipient'),value('scope')); state.sheet = ''; break;
            case 'export': download(state.work.title,D.exportHtml(state.work,value('scope') === 'template')); state.sheet = ''; break;
            case 'import':
                if (!state.importFile) throw Error('请先选择 HTML 文件');
                state.importFile.scope = value('scope'); state.sheet = 'confirm-import'; break;
            case 'generate': {
                const selected = [...D.presets,...state.templates].find(p => p.id === state.promptId);
                const constraints = '生成一个独立、移动优先的完整 HTML 文档。内联 CSS 和 JS，不用外部依赖、网络、表单、iframe、跳转。以结构化排版表达视觉设计，兼顾可读性和轻量交互。使用 window.ActeProgress?.value 读取上次场次，并在场次切换时调用 window.ActeProgress?.save({scene:当前序号})。页面还需能独立运行。只返回 HTML。';
                const request = {title:value('title'),synopsis:value('synopsis'),style:value('prompt'),template:selected?.html?.slice(0,28000)};
                note('正在生成 HTML…');
                const html = await D.ask([{role:'system',content:constraints},{role:'user',content:JSON.stringify(request)}]);
                D.readHtml(html,'scene.html');
                state.generated = {title:request.title,synopsis:request.synopsis,stylePrompt:request.style,templateHtml:selected?.html,html,kind:'html',art:selected?.art || 0}; state.sheet = 'generated'; break;
            }
            }
            render(scroll);
            if (form.dataset.form === 'share') note('已发送到 404');
            if (form.dataset.form === 'turn') {
                const main = app.querySelector('.ac-main');
                main.scrollTop = main.scrollHeight;
            }
        } catch (e) { error(e); } finally {
            busy = false;
            if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
        }
    }
    async function turn(text) {
        if (!text) throw Error('先写下这一幕的内容');
        const w = state.work, a = getAct(w);
        if (!w.cast.some(r => D.character(r.id))) throw Error('请先在剧场设置里选择出场角色');
        const prompt = '你负责演绎一个独立虚构剧场。只使用提供的剧场设定和演员信息，不代替用户发言，不输出思考过程。' +
            (w.aware ? '你知道这是用户安排的剧场。' : '以剧内视角演出，避免提到在进行试演。') +
            (w.kind === 'prose' ? '返回一段连贯长文。叙述用普通文本，心理用单星号，台词用双星号。' : '用短台词推进情节。') +
            '只返回 JSON 数组，每项含 speaker 和 text，speaker 必须使用提供的角色名。长文只返回一项。' +
            '\n演员资料：\n' + D.castContext(w);
        const context = {title:w.title,genre:w.genre,synopsis:w.synopsis,act:a.title,previous:w.acts.slice(0,w.current)
            .flatMap(p => p.rows).slice(-8).map(r => ({speaker:r.speaker,text:r.text.slice(0,1200)})),
            recent:a.rows.slice(-24).map(r => ({speaker:r.speaker,text:r.text.slice(0,4000)})),input:text};
        note('正在演出…');
        const raw = await D.ask([{role:'system',content:prompt},{role:'user',content:JSON.stringify(context)}]);
        const actors = w.cast.map(r => D.character(r.id)).filter(Boolean);
        const allowed = new Set(actors.map(D.name));
        let rows;
        try { rows = JSON.parse(raw); } catch { rows = null; }
        if (!Array.isArray(rows)) rows = [{speaker:D.name(actors[0]),text:raw}];
        const replies = rows.slice(0,w.kind === 'prose' ? 1 : 10).filter(r => typeof r?.text === 'string' && r.text.trim()).map(r => ({
            id:D.uid(),role:'assistant',speaker:allowed.has(r.speaker) ? r.speaker : D.name(actors[0]),text:r.text.trim().slice(0,16000),at:Date.now()
        }));
        if (!replies.length) throw Error('模型未返回可用台词，输入已保留');
        const user = {id:D.uid(),role:'user',speaker:actors[0].myName || '我',text,at:Date.now()};
        await update(work => {
            const act = work.acts.find(act => act.id === a.id);
            if (!act) throw Error('场次已不存在');
            act.rows.push(user,...replies);
        });
        state.draft.delete(a.id);
        try {
            await D.write('recent',{id:replies[0].id,workId:w.id,act:w.current,title:w.title,text:replies[0].text,at:Date.now()});
            state.recent = await D.list('recent');
        } catch { note('演出已保存，最近剧摘暂未更新'); }
    }
    function sharedScript(w) {
        if (w.kind === 'html') {
            const doc = new DOMParser().parseFromString(w.html,'text/html');
            doc.querySelectorAll('script,style,template,noscript').forEach(node => node.remove());
            return doc.body.textContent.trim();
        }
        return w.acts.map(a => a.title + '\n' + a.rows.map(r => r.speaker + '：' + r.text).join('\n')).join('\n\n');
    }
    async function sendCard(id,scope) {
        const c = D.character(id), w = state.work;
        if (!c) throw Error('请选择接收角色');
        if (window.KissSocial?.blocked(c) || window.KissOffline?.isActive(c)) throw Error('该角色当前无法接收 404 卡片');
        if (PhoneBackup.isPinned?.(c)) throw Error('聊天存档正在处理，请稍后重试');
        const release = PhoneBackup.pinChat?.(c) || (() => {});
        try {
            await PhoneBackup.hydrateChat(c);
            const work = D.portable(w), teaser = scope !== 'script';
            delete work.templateHtml;
            delete work.stylePrompt;
            delete work.htmlProgress;
            if (teaser) { work.html = ''; work.acts = work.acts.map(a => ({...a,rows:[]})); }
            const body = '[用户发送了剧幕' + (teaser ? '预告' : '剧本') + '《' + w.title + '》]\n' + w.synopsis +
                (teaser ? '' : '\n' + sharedScript(w).slice(0,12000));
            const signature = [w.id,w.updated,id,scope].join('/');
            const message = pendingCards.get(signature) || {
                id:'msg_acte_' + D.uid(),role:'user',type:'acte-share',content:body,parts:[{type:'text',text:body}],
                timestamp:Date.now(),acte:{scope:teaser ? 'teaser' : 'script',work}
            };
            pendingCards.set(signature,message);
            c.history ||= [];
            if (!c.history.some(m => m.id === message.id)) c.history.push(message);
            try { await PhoneBackup.stageMessage(c,message); } catch (e) {
                c.history = c.history.filter(m => m.id !== message.id);
                pendingCards.delete(signature);
                throw e;
            }
            await PhoneBackup.saveChat(c);
            pendingCards.delete(signature);
            if (currentChat()?.id === c.id) renderMessages(false,true);
            renderChatList();
        } finally { release(); }
    }
    function renderCard(message) {
        const w = message.acte?.work;
        if (!w) return null;
        const row = document.createElement('div');
        row.className = 'message-wrapper sent acte-chat-wrapper';
        row.dataset.id = message.id;
        row.innerHTML = btn('chat-card',art(w) + '<span><small>剧幕 · ' + (message.acte.scope === 'teaser' ? '预告' : '剧本') +
            '</small><strong>' + E(w.title) + '</strong><small>' + E(summary(w)) + '</small><b>查看剧场</b></span>','acte-chat-card');
        row.querySelector('button').onclick = e => {
            if ((typeof isInMultiSelectMode !== 'undefined' && isInMultiSelectMode) ||
                (typeof isDebugMode !== 'undefined' && isDebugMode) ||
                document.getElementById('chat-expansion-panel')?.classList.contains('visible')) return;
            e.stopPropagation();
            open({scope:message.acte.scope,work:{...w,cast:[]}}).catch(error);
        };
        return row;
    }
    async function change(event) {
        const kind = event.target.dataset.file;
        const file = event.target.files?.[0];
        if (!kind || !file || busy) return;
        busy = true;
        try {
            if (kind === 'cover') {
                if (!/^image\/(png|jpe?g|webp|gif|avif)$/i.test(file.type) || file.size > 8000000) throw Error('请选择 8 MB 以内的图片');
                const data = await new Promise((resolve,reject) => {
                    const reader = new FileReader(); reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(Error('图片读取失败')); reader.readAsDataURL(file);
                });
                await setCover(data);
            } else {
                if (file.size > D.maxFile) throw Error('请选择 32 MB 以内的 HTML 文件');
                state.importFile = {...D.readHtml(await file.text(),file.name),filename:file.name};
            }
            render(position());
        } catch (e) { error(e); } finally { busy = false; }
    }
    function input(event) {
        if (event.target.name === 'turn') state.draft.set(getAct(state.work).id,event.target.value);
        if (event.target.name === 'prompt') state.promptDraft = event.target.value;
        if (event.target.dataset.field === 'query') {
            state.query = event.target.value;
            const parsed = document.createElement('div');
            parsed.innerHTML = library();
            app.querySelector('.ac-library-results').replaceWith(parsed.querySelector('.ac-library-results'));
        }
    }
    function key(event) {
        if (event.key !== 'Escape' || busy) return;
        if (state.sheet) { state.sheet = ''; render(position()); } else close();
    }
    window.addEventListener('message',event => {
        if (!app || state.page !== 'reader' || state.shared || state.work?.kind !== 'html' ||
            event.origin !== 'null' || event.source !== app.querySelector('.ac-frame')?.contentWindow ||
            event.data?.type !== 'acte-progress' || !D.validProgress(event.data.value)) return;
        const id = state.work.id, value = event.data.value ?? null;
        D.revise(id,w => { w.htmlProgress = value; }).then(w => {
            if (state.work?.id === id) state.work.htmlProgress = w.htmlProgress;
        }).catch(error);
    });
    document.addEventListener('click',event => {
        if (event.target.closest?.('#acte-chat-menu-btn')) open().catch(error);
    });
    document.addEventListener('keydown',event => {
        if (event.target.id === 'acte-chat-menu-btn' && ['Enter',' '].includes(event.key)) {
            event.preventDefault(); open().catch(error);
        }
    });
    window.KissActe = {renderCard,onlineContext:D.onlineContext};
})();
