(() => {
    if (window.kissTextGesturesBound) return;
    window.kissTextGesturesBound = true;
    const editable = target => {
        const el = target?.nodeType === Node.ELEMENT_NODE ? target : target?.parentElement;
        return !!el && (!!el.closest('input,textarea') || el.isContentEditable);
    };
    // Do not stop propagation: existing message menus still receive their events.
    document.addEventListener('selectstart', event => { if (!editable(event.target)) event.preventDefault(); }, true);
    document.addEventListener('contextmenu', event => { if (!editable(event.target)) event.preventDefault(); }, true);
})();
