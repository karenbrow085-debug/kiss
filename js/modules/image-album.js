/* One persisted multi-image message; display state stays local to each rendered album. */
(()=>{'use strict';
const capture=()=>{const type=currentChatType,id=currentChatId,chat=(type==='private'?db.characters:db.groups).find(c=>c.id===id);return {type,id,chat,account:db.activePersonaId,archive:chat?.activeArchiveId};};
const valid=t=>{if(!t?.chat)return false;const now=capture();return now.chat===t.chat&&now.id===t.id&&now.type===t.type&&now.account===t.account&&now.archive===t.archive;};
function image(src,alt){const el=document.createElement('img');el.src=src;el.alt=alt;el.draggable=false;el.decoding='async';return el;}
function button(text,cls,fn){const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;b.onclick=fn;return b;}
let active=null;
function dialog(title,cls){active?.close();const previous=document.activeElement,overlay=document.createElement('div');overlay.className='kia-overlay '+cls;const panel=document.createElement('section');panel.className='kia-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',title);const head=document.createElement('header'),h=document.createElement('h2');h.textContent=title;const close=()=>{overlay.remove();document.removeEventListener('keydown',keys,true);if(active?.overlay===overlay)active=null;previous?.isConnected&&previous.focus({preventScroll:true});};head.append(h,button('×','kia-close',close));panel.append(head);overlay.append(panel);overlay.onclick=e=>{if(e.target===overlay)close();};const keys=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'){const nodes=[...panel.querySelectorAll('button,input,textarea')].filter(n=>!n.disabled&&!n.hidden);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',keys,true);document.body.append(overlay);active={overlay,close};head.querySelector('button').focus({preventScroll:true});return {overlay,panel,close};}
function preview(sources,origin){let images=[...sources],sending=false;const d=dialog('发送图片','kia-preview kmd-overlay');d.panel.classList.add('kmd-panel');const note=document.createElement('p');note.className='kia-note';note.textContent='最多 10 张 · 按所选顺序一起发送';const grid=document.createElement('div');grid.className='kia-preview-grid';const footer=document.createElement('footer');const send=button('','kia-send',async()=>{if(sending||!images.length)return;if(!valid(origin))return showToast('聊天或身份已切换，请重新选择图片');sending=true;send.disabled=true;grid.inert=true;send.textContent='发送中…';try{await sendImageForRecognition(images,origin);d.close();}catch(e){showToast(e.message||'图片发送失败，请重试');sending=false;send.disabled=false;grid.inert=false;update();}});footer.append(send);d.panel.append(note,grid,footer);function update(){send.textContent=`发送（${images.length}）`;send.disabled=!images.length;grid.replaceChildren();images.forEach((src,i)=>{const cell=document.createElement('div');cell.className='kia-preview-cell';const index=document.createElement('span');index.textContent=i+1;const remove=button('×','kia-remove',()=>{images.splice(i,1);update();});remove.setAttribute('aria-label',`移除第 ${i+1} 张图片`);cell.append(image(src,`第 ${i+1} 张图片`),index,remove);grid.append(cell);});}update();}
function viewer(sources,start=0){const d=dialog('图片','kia-viewer');const strip=document.createElement('div');strip.className='kia-view-strip';const count=document.createElement('output');const prev=button('‹','kia-prev',()=>move(-1)),next=button('›','kia-next',()=>move(1));let index=start;const slides=sources.map((src,i)=>{const slide=document.createElement('div');slide.className='kia-view-slide';slide.append(image(src,`第 ${i+1} 张，共 ${sources.length} 张`));strip.append(slide);return slide;});function update(){count.textContent=`${index+1} / ${sources.length}`;prev.disabled=index===0;next.disabled=index===sources.length-1;}function move(delta){index=Math.max(0,Math.min(sources.length-1,index+delta));strip.scrollTo({left:index*strip.clientWidth,behavior:'auto'});update();}strip.onscroll=()=>{index=Math.round(strip.scrollLeft/(strip.clientWidth||1));update();};d.panel.append(strip,prev,count,next);requestAnimationFrame(()=>{strip.scrollLeft=index*strip.clientWidth;update();});d.overlay.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')move(-1);if(e.key==='ArrowRight')move(1);});}
// Only real neighbours are visible. End cards have two backs on one side;
// interior cards have one back on either side, matching the reference album.
function stackLayout(count, selected, width = 146) {
    const index = Math.max(0, Math.min(count - 1, selected));
    const position = index === 0 ? 'first' : index === count - 1 ? 'last' : 'middle';
    const anchor = Math.min(index, position === 'last' ? 2 : 1) * 12;
    const cards = Array.from({length: count}, (_, i) => {
        const distance = i - index, depth = Math.abs(distance), side = Math.sign(distance);
        const visible = depth === 0 || depth === 1 || (depth === 2 && position !== 'middle');
        const scale = depth === 0 ? 1 : depth === 1 ? .9 : .8;
        return {
            x: anchor + side * (width * (1 - scale) / 2 + depth * 9),
            y: 0,
            scale, rotation: depth === 0 ? 0 : side * (depth === 1 ? 2 : 4),
            opacity: visible ? 1 : 0, z: depth === 0 ? 10 : depth === 1 ? 8 : 6
        };
    });
    return {index, position, cards};
}
function create(message) {
    const sources = message.parts.filter(p => p.type === 'image').map(p => p.data);
    const root = document.createElement('div');
    root.className = 'image-bubble kia-album';
    root.dataset.count = sources.length;
    root.style.setProperty('--kia-sides', Math.min(2, sources.length - 1) * 12 + 'px');
    let current = 0, expanded = false, down = null, swipedUntil = 0;
    const specialMode = () => (typeof isInMultiSelectMode !== 'undefined' && isInMultiSelectMode) || (typeof isDebugMode !== 'undefined' && isDebugMode);
    const toggle = button('展开 ' + sources.length, 'kia-toggle', () => {
        expanded = !expanded;
        root.classList.toggle('kia-expanded', expanded);
        toggle.textContent = expanded ? '收起' : '展开 ' + sources.length;
        toggle.setAttribute('aria-expanded', String(expanded));
        resetDrag();
        paint();
        const avatar = root.closest('.message-wrapper')?.querySelector('.message-avatar');
        for (const card of cards) card.querySelector('.kia-repeat-avatar')?.remove();
        if (expanded && avatar && getComputedStyle(avatar).display !== 'none' && getComputedStyle(avatar).visibility !== 'hidden') {
            const ar = avatar.getBoundingClientRect(), cr = cards[0].getBoundingClientRect();
            cards.slice(1).forEach(card => {
                const copy = document.createElement('span');
                copy.className = 'kia-repeat-avatar';copy.setAttribute('aria-hidden', 'true');
                copy.style.backgroundImage = 'url(' + JSON.stringify(avatar.src) + ')';
                copy.style.left = (ar.left - cr.left - (parseFloat(getComputedStyle(cards[0]).borderLeftWidth) || 0)) + 'px';copy.style.width = ar.width + 'px';copy.style.height = ar.height + 'px';
                copy.style.borderRadius = getComputedStyle(avatar).borderRadius;card.append(copy);
            });
        }
    });
    toggle.setAttribute('aria-expanded', 'false');
    const deck = document.createElement('div');deck.className = 'kia-deck';deck.setAttribute('role', 'group');
    const cards = sources.map((src, i) => {
        const card = button('', 'kia-card', () => { if (Date.now() >= swipedUntil) viewer(sources, i); });
        card.setAttribute('aria-label', `查看第 ${i + 1} 张图片`);
        card.append(image(src, `图片 ${i + 1}`));deck.append(card);return card;
    });
    root.append(toggle, deck);
    function paint(target = current, progress = 0) {
        const width = parseFloat(getComputedStyle(root).getPropertyValue('--kia-card-width')) || 146;
        const from = stackLayout(sources.length, current, width), to = stackLayout(sources.length, target, width);
        root.dataset.position = from.position;root.dataset.index = String(current);
        deck.setAttribute('aria-label', `${sources.length} 张图片，当前第 ${current + 1} 张，可左右滑动`);
        cards.forEach((card, i) => {
            const a = from.cards[i], b = to.cards[i], mix = key => a[key] + (b[key] - a[key]) * progress;
            card.style.setProperty('--kia-x', mix('x') + 'px');card.style.setProperty('--kia-y', mix('y') + 'px');
            card.style.setProperty('--kia-scale', mix('scale'));card.style.setProperty('--kia-rotate', mix('rotation') + 'deg');
            card.style.setProperty('--kia-opacity', mix('opacity'));
            card.hidden = !expanded && a.opacity === 0 && b.opacity === 0;
            card.style.zIndex = String((progress < .5 ? a : b).z);
            card.dataset.front = String(i === current);card.tabIndex = expanded || i === current ? 0 : -1;
            card.setAttribute('aria-hidden', String(!expanded && i !== current));
        });
    }
    function resetDrag() {
        if (down && deck.hasPointerCapture?.(down.id)) deck.releasePointerCapture(down.id);
        down = null;root.classList.remove('kia-dragging');deck.style.removeProperty('--kia-edge');
    }
    function move(delta) {
        current = Math.max(0, Math.min(sources.length - 1, current + delta));paint();
    }
    deck.addEventListener('pointerdown', e => {
        if (expanded || specialMode() || e.button !== 0) return;
        down = {x: e.clientX, y: e.clientY, id: e.pointerId, dragging: false};
    });
    deck.addEventListener('pointermove', e => {
        if (!down || e.pointerId !== down.id || expanded) return;
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!down.dragging) {
            if (Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx)) { resetDrag();return; }
            if (Math.abs(dx) < 9 || Math.abs(dx) <= Math.abs(dy)) return;
            down.dragging = true;root.classList.add('kia-dragging');deck.setPointerCapture?.(e.pointerId);
        }
        e.preventDefault();swipedUntil = Date.now() + 450;
        const target = Math.max(0, Math.min(sources.length - 1, current + (dx < 0 ? 1 : -1)));
        if (target === current) deck.style.setProperty('--kia-edge', Math.max(-6, Math.min(6, dx * .12)) + 'px');
        else { deck.style.removeProperty('--kia-edge');paint(target, Math.min(1, Math.abs(dx) / 104)); }
    });
    deck.addEventListener('pointerup', e => {
        if (!down || e.pointerId !== down.id || expanded) return;
        const dx = e.clientX - down.x, dragged = down.dragging;
        resetDrag();
        if (dragged) { e.preventDefault();swipedUntil = Date.now() + 450;move(Math.abs(dx) > 28 ? (dx < 0 ? 1 : -1) : 0); }
    }, true);
    deck.addEventListener('pointercancel', () => { resetDrag();paint(); });
    deck.addEventListener('keydown', e => {
        if (expanded || specialMode() || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault();move(e.key === 'ArrowRight' ? 1 : -1);cards[current].focus();
    });
    root.addEventListener('click', e => { if (!specialMode()) e.stopPropagation(); });
    root.addEventListener('click', e => {
        if (specialMode()) { e.stopImmediatePropagation();root.closest('.message-wrapper')?.click(); }
    }, true);
    paint();requestAnimationFrame(() => { if (root.isConnected) paint(); });return root;
}
window.KissImageAlbum={capture,valid,preview,create,viewer,stackLayout};
})();
