/* Widget resources belong to one desktop render; previews never run scripts. */
window.KissWidgetRuntime = (() => {
    const scopes = new Map(), previews = new Map(), frames = new Map();
    const native = {
        setInterval: window.setInterval.bind(window), clearInterval: window.clearInterval.bind(window),
        setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window),
        requestAnimationFrame: window.requestAnimationFrame.bind(window), cancelAnimationFrame: window.cancelAnimationFrame.bind(window)
    };
    function reset() {
        for (const scope of scopes.values()) scope.dispose();
        scopes.clear();
    }
    function release(id) { scopes.get(id)?.dispose(); scopes.delete(id); }
    function scope(id) {
        scopes.get(id)?.dispose();
        const intervals = new Set(), timeouts = new Set(), rafs = new Set();
        let disposed = false;
        const api = {
            setInterval(fn, delay, ...args) { if (disposed) return 0; const key = native.setInterval(fn, Math.max(16, Number(delay) || 0), ...args); intervals.add(key); return key; },
            clearInterval(key) { intervals.delete(key); native.clearInterval(key); },
            setTimeout(fn, delay, ...args) {
                if (disposed) return 0;
                const key = native.setTimeout(() => { timeouts.delete(key); if (typeof fn === 'function') fn(...args); }, delay);
                timeouts.add(key); return key;
            },
            clearTimeout(key) { timeouts.delete(key); native.clearTimeout(key); },
            requestAnimationFrame(fn) { if (disposed) return 0; const key = native.requestAnimationFrame(time => { rafs.delete(key); fn(time); }); rafs.add(key); return key; },
            cancelAnimationFrame(key) { rafs.delete(key); native.cancelAnimationFrame(key); },
            dispose() {
                disposed = true;
                intervals.forEach(native.clearInterval); timeouts.forEach(native.clearTimeout); rafs.forEach(native.cancelAnimationFrame);
                intervals.clear(); timeouts.clear(); rafs.clear();
            }
        };
        scopes.set(id, api); return api;
    }
    const fill = (text, vars) => String(text || '').replace(/\{\{([^{}]+)\}\}/g, (token, key) =>
        Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? '') : token);
    function unload(node) { frames.get(node)?.remove(); frames.delete(node); }
    function prune() {
        for (const node of previews.keys()) if (!node.isConnected) { observer?.unobserve(node); node.__widgetResizeObserver?.disconnect(); unload(node); previews.delete(node); }
    }
    function load(node) {
        const item = previews.get(node);
        if (!item || frames.has(node) || !node.isConnected || !node.getClientRects().length) return;
        // Bound decoded pictures and browsing contexts on low-memory phones.
        while (frames.size >= 5) unload(frames.keys().next().value);
        const frame = document.createElement('iframe');
        frame.title = '小组件预览'; frame.setAttribute('sandbox', ''); frame.tabIndex = -1;
        frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none;background:transparent';
        const vars = { ...(item.template.defaultVars || {}), id: item.template.id };
        let html = fill(item.template.html, vars);
        // CSP blocks script/event handlers, nested pages, media and fonts in previews.
        const policy = "default-src 'none'; img-src https: http: data: blob:; style-src 'unsafe-inline'; font-src 'none'; script-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
        const css = fill(item.template.css, { id: item.template.id }).replace(/<\/style/gi, '<\\/style');
        html = html.replace(/<\/?(?:html|head|body)\b[^>]*>/gi, '');
        frame.srcdoc = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + policy + '"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}body{font-family:Arial,sans-serif}*{box-sizing:border-box}'+css+'\n*,*::before,*::after{animation:none!important;transition:none!important}</style>'+html;
        node.appendChild(frame); frames.set(node, frame);
    }
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
        prune();
        for (const entry of entries) if (entry.isIntersecting) load(entry.target); else unload(entry.target);
    }, { threshold: .05 }) : null;
    new MutationObserver(prune).observe(document.documentElement, { childList: true, subtree: true });
    function preview(node, template) {
        prune();
        const canvas = node.parentElement;
        const width = parseFloat(node.style.width) || 160;
        const height = parseFloat(node.style.height) || 160;
        const resize = () => {
            if (!canvas?.isConnected || !canvas.clientWidth) return;
            const shownHeight = canvas.clientWidth * height / width;
            canvas.style.setProperty('height', shownHeight + 'px', 'important');
            canvas.style.setProperty('min-height', shownHeight + 'px', 'important');
            node.style.cssText += ';position:absolute;left:50%;top:50%;transform-origin:center;transform:translate(-50%,-50%) scale(' + (canvas.clientWidth / width) + ')';
        };
        node.style.position = 'relative';
        const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
        if (canvas) resizeObserver?.observe(canvas);
        node.__widgetResizeObserver = resizeObserver;
        native.setTimeout(resize, 0);
        previews.set(node, { template });
        node.dataset.widgetPreview = 'true';
        observer?.observe(node);
        node.parentElement?.addEventListener('pointerdown', () => load(node), { passive: true });
        if (!observer) native.setTimeout(() => load(node), 0);
    }
    window.addEventListener('pagehide', reset);
    return { reset, release, scope, preview, fill, prune };
})();

function syncHomeWidgetStyles() {
    const used = new Set((db.addedWidgets || []).map(item => item?.templateId));
    const templates = new Map((db.widgetTemplates || []).filter(Boolean).map(item => [item.id, item]));
    document.querySelectorAll('style[id^="preview-style-"]').forEach(style => style.remove());
    document.querySelectorAll('style[id^="custom-widget-style-"]').forEach(style => {
        if (!used.has(style.id.slice('custom-widget-style-'.length))) style.remove();
    });
    for (const id of used) {
        const template = templates.get(id); if (!template || typeof template.css !== 'string') continue;
        const styleId = 'custom-widget-style-' + id;
        let style = document.getElementById(styleId);
        if (!style) { style = document.createElement('style'); style.id = styleId; document.head.appendChild(style); }
        const css = KissWidgetRuntime.fill(template.css, { id });
        if (style.textContent !== css) style.textContent = css;
    }
}
