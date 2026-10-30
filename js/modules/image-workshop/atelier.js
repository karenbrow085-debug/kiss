/* Atelier presentation layer. Existing controls and their handlers are moved,
 * never cloned; settings, prompt presets and Vibe remain owned by their modules. */
function initWorkshopAtelier() {
    const root = document.getElementById('drawing-workshop-screen');
    if (!root || root.dataset.atelier) return;
    root.dataset.atelier = 'true';
    const $ = id => document.getElementById(id);
    const main = $('drawing-workshop-content');
    const api = $('workshop-api-tab');
    const chars = $('workshop-char-tab');
    const apiButton = $('workshop-api-tab-btn');
    const charButton = $('workshop-char-tab-btn');
    const nav = document.createElement('nav');
    nav.className = 'atelier-nav';
    nav.setAttribute('aria-label', '工坊页面');
    const worksButton = document.createElement('button');
    worksButton.type = 'button';
    worksButton.textContent = '作品';
    worksButton.id = 'workshop-works-tab-btn';
    nav.append(apiButton, worksButton, charButton);
    root.querySelector('.workshop-tabs').remove();
    const title = document.createElement('span');
    title.className = 'atelier-app-title';
    title.textContent = 'アトリエ';
    root.querySelector('.app-header').insertBefore(title, root.querySelector('.placeholder'));
    const banner = document.createElement('div');
    banner.className = 'atelier-banner';
    banner.innerHTML = '<div class="atelier-wordmark">Atelier.</div><div class="atelier-kicker">IMAGE STUDIO</div><div class="atelier-caption">好きな世界を、<br>ここで描く。</div>';
    main.prepend(banner);
    const works = document.createElement('div');
    works.id = 'workshop-works-tab';
    works.className = 'atelier-works';
    works.hidden = true;
    main.append(works);
    root.append(nav);
    const apiSection = api.querySelector('.workshop-section');
    apiSection.classList.add('atelier-api-section');
    apiSection.querySelector('.workshop-section-title').textContent = 'API 设置';
    const presetRow = $('workshop-api-preset-select').closest('.kkt-item');
    const presetBar = presetRow.firstElementChild;
    apiSection.querySelector('.workshop-section-header').append(presetBar.lastElementChild);
    presetBar.remove();
    for (const [id,label] of [['workshop-api-url','URL'],['workshop-api-key','Key']]) {
        const input = $(id);
        const row = document.createElement('label'); row.className = 'atelier-api-input';
        const name = document.createElement('span'); name.textContent = label;
        input.before(row); row.append(name,input);
    }
    const modelRow = $('workshop-api-model').closest('.kkt-item');
    const fetchButton = $('workshop-fetch-models-btn');
    fetchButton.textContent = '拉取';
    fetchButton.title = '拉取模型列表';
    modelRow.querySelector('.kkt-item-control').append(fetchButton);
    $('workshop-model-list-row').remove();
    const advanced = document.createElement('details');
    advanced.className = 'atelier-api-advanced';
    const summary = document.createElement('summary'); summary.textContent = '接口选项';
    advanced.append(summary);
    ['workshop-api-protocol-row','workshop-api-protocol-hint','workshop-response-format-row'].forEach(id => advanced.append($(id)));
    apiSection.querySelector('.workshop-section-body').append(advanced);
    const providerRow = apiSection.querySelector('input[name="workshop-provider"]').closest('.kkt-item');
    providerRow.classList.add('atelier-provider');
    api.prepend(providerRow);
    const generate = $('workshop-generate-btn');
    const outputSection = generate.closest('.workshop-section');
    const cacheSection = $('workshop-history-gallery').closest('.workshop-section');
    outputSection.classList.add('atelier-output');
    generate.textContent = '生成图像';
    const generateDock = document.createElement('div');
    generateDock.className = 'atelier-generate-dock';
    generateDock.append(generate);
    api.append(generateDock);
    works.append(outputSection, cacheSection);
    $('workshop-save-cache-btn').textContent = '保存到缓存';
    $('workshop-download-btn').textContent = '下载图片';
    // The old "view all" button had no handler. Do not ship another empty entry.
    $('workshop-history-btn').remove();
    cacheSection.querySelector('.workshop-section-title').textContent = '最近作品';
    $('workshop-preview-area').firstElementChild.textContent = '生成的图像会显示在这里';
    const labels = {api:'工坊',works:'作品',chars:'角色'};
    const icons = {
        api:'M3 10 12 3l9 7v10H3z M9 20v-7h6v7',
        works:'M3 4h18v16H3z M3 15l5-5 5 5 3-3 5 5 M16 8h.01',
        chars:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-3a8 6 0 0 1 16 0v3'
    };
    const buttons = {api:apiButton,works:worksButton,chars:charButton};
    let pane = 'api';
    function decorateNav() {
        Object.entries(buttons).forEach(([key, button]) => {
            const desired = labels[key];
            if (button.dataset.label !== desired || !button.querySelector('svg')) {
                button.dataset.label = desired;
                button.innerHTML = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"><path d="${icons[key]}"/></svg><span>${desired}</span>`;
            }
            button.classList.toggle('active', pane === key);
            button.setAttribute('aria-current', pane === key ? 'page' : 'false');
        });
    }
    function showPane(next) {
        pane = next;
        api.style.display = next === 'api' ? 'block' : 'none';
        chars.style.display = next === 'chars' ? 'block' : 'none';
        works.hidden = next !== 'works';
        banner.querySelector('.atelier-wordmark').textContent = next === 'chars' ? 'Characters.' : 'Atelier.';
        banner.querySelector('.atelier-kicker').textContent = next === 'chars' ? 'CHARACTER LIBRARY' : next === 'works' ? 'RECENT WORK' : 'IMAGE STUDIO';
        decorateNav();
    }
    apiButton.addEventListener('click', () => showPane('api'));
    charButton.addEventListener('click', () => showPane('chars'));
    worksButton.addEventListener('click', () => showPane('works'));
    root.addEventListener('workshop-preview-ready', () => showPane('works'));
    function placeApiSettings() {
        const provider = root.querySelector('[name="workshop-provider"]:checked')?.value || 'novelai';
        const base = $(provider === 'gpt' ? 'workshop-gpt-sub-base' : 'workshop-sub-base');
        base.prepend(apiSection);
        decorateNav();
    }
    root.querySelectorAll('[name="workshop-provider"]').forEach(input => input.addEventListener('change', placeApiSettings));
    // Original provider code updates the old tab label after initialisation.
    new MutationObserver(decorateNav).observe(apiButton, {childList:true});
    root.querySelectorAll('.workshop-sub-tab').forEach(tab => {
        tab.setAttribute('role', 'button');
        tab.tabIndex = 0;
        tab.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); tab.click(); }
        });
        if (tab.dataset.target === 'workshop-sub-vibe') tab.querySelector('span').textContent = 'Vibe';
    });
    // Icon-only preset actions need labels on touch devices and screen readers.
    root.querySelectorAll('button[title]').forEach(button => button.setAttribute('aria-label', button.title));
    // Help copy stays accessible without the old oversized coloured cards.
    root.querySelectorAll('.workshop-section-body > div').forEach(node => {
        if (!node.id && !node.className && node.textContent.includes('提示：')) node.classList.add('atelier-help');
    });
    const charList = $('workshop-char-list');
    function compactCharacters() {
        charList.querySelectorAll('.char-prompt-input').forEach(input => {
            const card = input.parentElement;
            if (card.querySelector('.atelier-char-edit')) return;
            const preview = document.createElement('p');
            preview.className = 'atelier-char-preview';
            preview.textContent = input.value || '尚未设置角色外观词';
            input.before(preview);
            const edit = document.createElement('button');
            edit.type = 'button'; edit.className = 'atelier-char-edit';
            edit.setAttribute('aria-label','编辑角色外观词');
            const icon = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="m15 4 5 5-10 10-6 1 1-6z M13 6l5 5"/></svg>';
            edit.innerHTML = icon;
            edit.onclick = () => {
                const editing = card.classList.toggle('atelier-char-editing');
                edit.innerHTML = editing ? '完成' : icon;
                edit.setAttribute('aria-expanded',String(editing));
                if (editing) input.focus(); else { input.blur(); preview.textContent = input.value || '尚未设置角色外观词'; }
            };
            card.firstElementChild.append(edit);
        });
    }
    compactCharacters();
    new MutationObserver(compactCharacters).observe(charList,{childList:true});
    placeApiSettings();
    showPane('api');
}
