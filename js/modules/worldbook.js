// Worldbook: compact monochrome library, file imports and explicit destination picker.
let wbViewMode = 'grid';
let wbPathStack = [{id:null,name:'世界书'}];
let selectorPathStack = [{id:null,name:'世界书'}];
let tempSelectedWbIds = new Set();
let wbFilter = 'all', wbReady = false, wbBusy = false, wbEditToken = 0, wbImportTarget = null;
const wbEl = id => document.getElementById(id);
const wbKey = id => id == null ? '' : String(id);
const wbSame = (a,b) => wbKey(a) === wbKey(b);
const wbFind = id => db.worldBooks.find(b => wbSame(b.id,id));
const wbEscape = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wbPosition = p => ({before:'前',after:'后',guidelines:'聊天规范',limit_break:'破限'}[p] || '前');
const wbFolder = () => wbPathStack[wbPathStack.length-1];
const wbPageIcon = '<svg viewBox="0 0 24 24"><path d="M14 3H5v18h14V8zM14 3v6h5M8 13h8M8 17h6"/></svg>';
function wbId(){return 'wb_'+(globalThis.crypto?.randomUUID?.() || Date.now()+'_'+Math.random().toString(36).slice(2));}
function wbChildEntries(id){
    const seen=new Set(), entries=[];
    function walk(parent){if(seen.has(wbKey(parent)))return;seen.add(wbKey(parent));for(const b of db.worldBooks){if(wbSame(b.parentId,parent)){if(b.type==='folder')walk(b.id);else entries.push(b.id);}}}
    walk(id);return entries;
}
function wbNormalizeSelection(){selectedWorldBookIds=new Set([...selectedWorldBookIds].map(id=>wbFind(id)?.id).filter(id=>id!=null));}
function enterWorldBookMultiSelectMode(id){
    if(!isWorldBookMultiSelectMode){isWorldBookMultiSelectMode=true;selectedWorldBookIds.clear();}
    if(id!=null&&wbFind(id))selectedWorldBookIds.add(wbFind(id).id);
    renderWorldBookList();
}
function exitWorldBookMultiSelectMode(){isWorldBookMultiSelectMode=false;selectedWorldBookIds.clear();renderWorldBookList();}
function toggleWorldBookSelection(id){const actual=wbFind(id)?.id;if(actual==null)return;selectedWorldBookIds.has(actual)?selectedWorldBookIds.delete(actual):selectedWorldBookIds.add(actual);renderWorldBookList();}
function updateWorldBookSelectCount(){
    wbNormalizeSelection();const n=selectedWorldBookIds.size;
    wbEl('world-book-select-count').textContent=`已选 ${n} 项`;
    for(const id of ['move-selected-world-books-btn','delete-selected-world-books-btn'])wbEl(id).disabled=!n||wbBusy;
}
// Legacy categories are labels, not instructions to reparent entries on every startup.
// Preserving parentId is necessary for moves back to the library root to survive reopening.
async function migrateWorldBookCategories(){}
async function migrateWorldBookPositions(){
    let changed=false;
    for(const b of db.worldBooks){if(b.type!=='folder'&&['middle','center'].includes(b.position)){b.position='before';b.depth=300;changed=true;}}
    if(changed)await saveData();
}
function wbDialog(title,body,actions){
    const overlay=document.createElement('div');overlay.className='wb-dialog-overlay wb-app';
    overlay.innerHTML=`<section class="wb-dialog" role="dialog" aria-modal="true" aria-label="${wbEscape(title)}"><header><h2>${wbEscape(title)}</h2><button type="button" class="wb-dialog-close" aria-label="关闭">×</button></header><div class="wb-dialog-body">${body}</div><footer></footer></section>`;
    (document.querySelector('.phone-screen')||document.body).append(overlay);
    const previous=document.activeElement;let closed=false;
    const close=()=>{if(closed)return;closed=true;document.removeEventListener('keydown',keys);overlay.remove();previous?.focus?.();};
    const cancel=()=>{close();actions.find(a=>a.cancel)?.run?.();};
    const keys=e=>{if(e.key==='Escape'){e.preventDefault();cancel();}if(e.key==='Tab'){const els=[...overlay.querySelectorAll('button,input,textarea')].filter(x=>!x.disabled);const first=els[0],last=els[els.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
    document.addEventListener('keydown',keys);
    overlay.querySelector('.wb-dialog-close').onclick=cancel;
    overlay.addEventListener('click',e=>{if(e.target===overlay)cancel();});
    for(const a of actions){const b=document.createElement('button');b.type='button';b.className='wb-button'+(a.primary?' wb-primary':'');b.textContent=a.text;b.onclick=()=>a.run?.(close,overlay,b);overlay.querySelector('footer').append(b);}
    queueMicrotask(()=>overlay.querySelector('input,button')?.focus());
    return {overlay,close};
}
function wbConfirm(title,message,ok='确认'){return new Promise(resolve=>wbDialog(title,`<p>${wbEscape(message)}</p>`,[{text:'取消',cancel:true,run:close=>{close?.();resolve(false);}},{text:ok,primary:true,run:close=>{close();resolve(true);}}]));}
async function wbAskName(title,value=''){return new Promise(resolve=>{const d=wbDialog(title,`<label class="wb-dialog-label">名称<input class="wb-dialog-input" maxlength="200" value="${wbEscape(value)}" placeholder="输入名称"></label>`,[{text:'取消',cancel:true,run:close=>{close?.();resolve(null);}},{text:'保存',primary:true,run:(close,o)=>{const name=o.querySelector('input').value.trim();if(!name)return o.querySelector('input').focus();close();resolve(name);}}]);d.overlay.querySelector('input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();d.overlay.querySelector('footer button:last-child').click();}});});}
async function wbMoveTo(ids,targetId){
    if(wbBusy)throw Error('请等待当前保存完成');
    const target=targetId==null?null:wbFind(targetId);if(targetId!=null&&target?.type!=='folder')throw Error('目标文件夹不存在');
    let items=[...new Set(ids.map(wbKey))].map(wbFind);if(!items.length||items.some(b=>!b))throw Error('部分条目已不存在，请重新选择');
    for(const b of items){if(b.type!=='folder')continue;let cursor=target,seen=new Set();while(cursor){if(wbSame(cursor.id,b.id))throw Error('不能移动到自身或子文件夹');if(seen.has(wbKey(cursor.id)))throw Error('目标文件夹层级异常');seen.add(wbKey(cursor.id));cursor=cursor.parentId==null?null:wbFind(cursor.parentId);}}
    const selectedKeys=new Set(items.map(b=>wbKey(b.id)));items=items.filter(b=>{let p=b.parentId,seen=new Set();while(p!=null&&!seen.has(wbKey(p))){if(selectedKeys.has(wbKey(p)))return false;seen.add(wbKey(p));p=wbFind(p)?.parentId;}return true;});
    const snapshots=items.map(b=>[b,b.parentId]);wbBusy=true;
    try{for(const b of items)b.parentId=target?.id??null;await saveData();}catch(e){for(const [b,p]of snapshots)b.parentId=p;throw e;}finally{wbBusy=false;}
    return items.length;
}
async function moveSelectedWorldBooksToCurrent(){
    wbNormalizeSelection();if(!selectedWorldBookIds.size||wbBusy)return;
    const ids=[...selectedWorldBookIds];let target=wbFolder().id;
    const d=wbDialog('移动到文件夹','<div class="wb-move-path"></div><div class="wb-move-list"></div>',[{text:'取消',cancel:true,run:close=>close?.()},{text:'移动到这里',primary:true,run:async(close,o,b)=>{b.disabled=true;try{const n=await wbMoveTo(ids,target);close();exitWorldBookMultiSelectMode();showToast(`已移动 ${n} 项`);}catch(e){showToast(e.message);b.disabled=false;}}}]);
    function draw(){
        const folder=target==null?null:wbFind(target);const parent=folder?.parentId??null;
        d.overlay.querySelector('.wb-move-path').textContent=folder?.name||'世界书';
        const list=d.overlay.querySelector('.wb-move-list');list.replaceChildren();
        if(target!=null){const up=document.createElement('button');up.className='wb-move-row';up.textContent='上一级';up.onclick=()=>{target=parent;draw();};list.append(up);}
        const folders=db.worldBooks.filter(b=>b.type==='folder'&&wbSame(b.parentId,target));
        for(const b of folders){let cursor=b,blocked=false,seen=new Set();while(cursor){if(ids.some(id=>wbSame(id,cursor.id))){blocked=true;break;}if(seen.has(wbKey(cursor.id))){blocked=true;break;}seen.add(wbKey(cursor.id));cursor=cursor.parentId==null?null:wbFind(cursor.parentId);}const row=document.createElement('button');row.className='wb-move-row';row.textContent=b.name;row.disabled=blocked;row.onclick=()=>{target=b.id;draw();};list.append(row);}
        if(!folders.length){const p=document.createElement('p');p.className='wb-empty';p.textContent='没有子文件夹，可直接移动到这里';list.append(p);}
    }draw();
}
async function deleteSelectedWorldBooks(){
    if(wbBusy||!selectedWorldBookIds.size)return;
    // The main app also registers this handler: reserve it before awaiting confirmation.
    wbBusy=true;
    try{
        const selected=[...selectedWorldBookIds];
        if(!await wbConfirm('删除项目',`确定删除 ${selected.length} 个项目及文件夹内的内容？此操作无法撤销。`,'删除'))return;
        const gone=new Set(selected.map(wbKey));let changed=true;
        while(changed){changed=false;for(const b of db.worldBooks)if(gone.has(wbKey(b.parentId))&&!gone.has(wbKey(b.id))){gone.add(wbKey(b.id));changed=true;}}
        const original=db.worldBooks,bindings=[...(db.characters||[]),...(db.groups||[])].map(c=>[c,c.worldBookIds]);
        try{db.worldBooks=original.filter(b=>!gone.has(wbKey(b.id)));for(const [c,ids] of bindings)if(ids)c.worldBookIds=ids.filter(id=>!gone.has(wbKey(id)));await saveData();await dexieDB.worldBooks.bulkDelete(original.filter(b=>gone.has(wbKey(b.id))).map(b=>b.id));}catch(e){db.worldBooks=original;for(const[c,ids]of bindings)c.worldBookIds=ids;try{await saveData();}catch{}throw e;}
        exitWorldBookMultiSelectMode();showToast('已删除');
    }catch(e){showToast('删除失败：'+e.message);}finally{wbBusy=false;updateWorldBookSelectCount();}
}
function wbEditorFolderOptions(parentId){
    const select=wbEl('world-book-category');select.replaceChildren();
    const add=(id,label)=>{const o=document.createElement('option');o.value=wbKey(id);o.textContent=label;select.append(o);};
    add(null,'世界书（根目录）');
    const folders=db.worldBooks.filter(b=>b.type==='folder');
    for(const f of folders){
        const path=[f.name],seen=new Set([wbKey(f.id)]);let p=f.parentId;
        while(p!=null){if(seen.has(wbKey(p)))break;seen.add(wbKey(p));const ancestor=wbFind(p);if(!ancestor||ancestor.type!=='folder')break;path.unshift(ancestor.name);p=ancestor.parentId;}
        add(f.id,path.join(' / '));
    }
    select.value=parentId==null?'':wbKey(parentId);
    if(select.selectedIndex<0){add(parentId,'原文件夹已不存在（请选择）');select.value=wbKey(parentId);}
    wbUpdateEditorFolderLabel();
}
function wbUpdateEditorFolderLabel(){
    const select=wbEl('world-book-category');
    wbEl('wb-editor-folder').textContent=select.value===''?'世界书':wbFind(select.value)?.name||'请选择文件夹';
}
function wbOpenEditor(item=null){
    if(wbBusy)return;wbEditToken++;currentEditingWorldBookId=item?.id??null;
    wbEl('edit-world-book-form').reset();wbEl('world-book-id').value=item?.id??'';
    wbEl('world-book-name').value=item?.name||'';wbEl('world-book-content').value=item?.content||'';
    wbEl('world-book-depth').value=item?.depth??100;
    const p=['before','after','guidelines','limit_break'].includes(item?.position)?item.position:'before';
    document.querySelector(`input[name="world-book-position"][value="${p}"]`).checked=true;
    wbEl('edit-world-book-title').textContent=item?'编辑条目':'新建条目';
    wbEditorFolderOptions(item?item.parentId:wbFolder().id);
    wbUpdateCount();switchScreen('edit-world-book-screen');
}
function wbUpdateCount(){wbEl('wb-character-count').textContent=wbEl('world-book-content').value.length+' 字';}
async function wbSaveEditor(e){
    e.preventDefault();if(wbBusy)return;
    const name=wbEl('world-book-name').value.trim(),content=wbEl('world-book-content').value.trim(),depth=Number(wbEl('world-book-depth').value);
    if(!name||!content)return showToast('名称和内容不能为空');if(!Number.isInteger(depth)||depth<1||depth>999)return showToast('注入深度须为 1–999');
    const item=currentEditingWorldBookId==null?null:wbFind(currentEditingWorldBookId);
    if(currentEditingWorldBookId!=null&&!item)return showToast('条目已不存在');
    const selectedFolder=wbEl('world-book-category').value;
    const destination=selectedFolder===''?null:wbFind(selectedFolder);
    if(selectedFolder!==''&&destination?.type!=='folder')return showToast('文件夹已不存在，请重新选择');
    const changes={name,content,parentId:destination?.id??null,category:destination?.name||'',position:document.querySelector('input[name="world-book-position"]:checked').value,depth,updatedAt:Date.now()};
    const before=item?{...item}:null,created=item||{id:wbId(),type:'entry',parentId:wbFolder().id};
    wbBusy=true;document.querySelectorAll('#edit-world-book-form button[type="submit"],.wb-save-top').forEach(b=>b.disabled=true);
    try{Object.assign(created,changes);if(!item)db.worldBooks.push(created);await saveData();wbEditToken++;renderWorldBookList();switchScreen('world-book-screen');showToast('条目已保存');}
    catch(err){if(item){for(const k of Object.keys(item))delete item[k];Object.assign(item,before);}else db.worldBooks=db.worldBooks.filter(b=>b!==created);showToast('保存失败：'+err.message);}
    finally{wbBusy=false;document.querySelectorAll('#edit-world-book-form button[type="submit"],.wb-save-top').forEach(b=>b.disabled=false);}
}
async function wbReadFile(file){
    if(!/\.(txt|docx)$/i.test(file.name))throw Error('仅支持 TXT 或 DOCX 文件');
    if(file.size>10*1024*1024)throw Error('文件不能超过 10MB');
    const buffer=await file.arrayBuffer();let text;
    if(/\.docx$/i.test(file.name)){
        if(!window.mammoth?.extractRawText)throw Error('DOCX 解析器尚未加载，请刷新后重试');
        try{text=(await window.mammoth.extractRawText({arrayBuffer:buffer})).value;}catch{throw Error('DOCX 文件损坏或格式不正确');}
    }else{
        const bytes=new Uint8Array(buffer);let encoding='utf-8';
        if(bytes[0]===255&&bytes[1]===254)encoding='utf-16le';else if(bytes[0]===254&&bytes[1]===255)encoding='utf-16be';
        try{text=new TextDecoder(encoding,{fatal:true}).decode(buffer);}catch{text=new TextDecoder('gb18030').decode(buffer);}
    }
    text=String(text||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
    if(!text)throw Error('文件没有可导入的文字');if(text.includes('\0'))throw Error('文件不是有效的文本文件');
    return {name:file.name.replace(/\.(txt|docx)$/i,'').trim()||'未命名条目',content:text};
}
function wbChooseFiles(editor){
    if(wbBusy)return;
    wbImportTarget={editor,token:wbEditToken,id:currentEditingWorldBookId,folder:wbFolder().id,content:wbEl('world-book-content').value};
    const input=wbEl('wb-file-import');input.multiple=!editor;input.value='';input.click();
}
async function wbImportFiles(files,target){
    if(!files.length||wbBusy||!target)return;if(files.length>20)return showToast('一次最多导入 20 个文件');
    wbBusy=true;wbEl('wb-editor-import').disabled=true;
    try{
        showToast('正在读取文件…');const parsed=[];
        for(const f of files){parsed.push(await wbReadFile(f));await new Promise(r=>setTimeout(r,0));}
        if(target.editor){
            const valid=()=>target.token===wbEditToken&&wbSame(target.id,currentEditingWorldBookId)&&wbEl('edit-world-book-screen').classList.contains('active')&&wbEl('world-book-content').value===target.content;
            if(!valid())throw Error('页面或正文已变更，请在当前条目重新导入');
            let mode='replace';
            if(target.content.trim())mode=await new Promise(resolve=>wbDialog('导入正文','<p>选择如何导入文件。名称、分类和注入设置会保留，保存条目后生效。</p>',[{text:'取消',cancel:true,run:close=>{close?.();resolve(null);}},{text:'追加',run:close=>{close();resolve('append');}},{text:'替换正文',primary:true,run:close=>{close();resolve('replace');}}]));
            if(!mode)return;if(!valid())throw Error('页面或正文已变更，请重新导入');
            wbEl('world-book-content').value=(mode==='append'?target.content.trimEnd()+'\n\n':'')+parsed[0].content;
            if(!wbEl('world-book-name').value.trim())wbEl('world-book-name').value=parsed[0].name;
            wbUpdateCount();showToast('已导入正文，保存条目后生效');
        }else{
            if(target.folder!=null&&wbFind(target.folder)?.type!=='folder')throw Error('目标文件夹已不存在');
            const created=parsed.map(p=>({id:wbId(),type:'entry',parentId:target.folder,...p,category:'',position:'before',depth:100,updatedAt:Date.now()}));
            db.worldBooks.push(...created);try{await saveData();}catch(e){const ids=new Set(created.map(b=>b.id));db.worldBooks=db.worldBooks.filter(b=>!ids.has(b.id));throw e;}
            renderWorldBookList();showToast(`已导入 ${created.length} 个条目`);
        }
    }catch(e){showToast('导入失败：'+e.message);}finally{wbBusy=false;wbEl('wb-editor-import').disabled=false;wbEl('wb-file-import').value='';updateWorldBookSelectCount();}
}
async function wbNewFolder(){
    if(wbBusy)return;const parent=wbFolder().id;const name=await wbAskName('新建文件夹');if(!name||wbBusy)return;
    const b={id:wbId(),type:'folder',parentId:parent,name};wbBusy=true;
    try{db.worldBooks.push(b);await saveData();renderWorldBookList();}catch(e){db.worldBooks=db.worldBooks.filter(x=>x!==b);showToast('保存失败：'+e.message);}finally{wbBusy=false;}
}
function wbItemMenu(id){
    const item=wbFind(id);if(!item||wbBusy)return;
    const menu=wbDialog(item.name,'',[]);
    const actions=item.type==='folder'?[['重命名',async()=>{const name=await wbAskName('重命名文件夹',item.name);if(!name||wbBusy)return;const before=item.name;wbBusy=true;try{item.name=name;await saveData();for(const p of wbPathStack)if(wbSame(p.id,item.id))p.name=name;renderWorldBookList();}catch(e){item.name=before;showToast('保存失败：'+e.message);}finally{wbBusy=false;}}]]:[['编辑条目',()=>wbOpenEditor(item)],['导入 TXT / DOCX',()=>{wbOpenEditor(item);wbChooseFiles(true);}]];
    actions.push(['移动到文件夹',()=>{enterWorldBookMultiSelectMode(item.id);moveSelectedWorldBooksToCurrent();}],['删除',()=>{enterWorldBookMultiSelectMode(item.id);deleteSelectedWorldBooks();}]);
    const body=menu.overlay.querySelector('.wb-dialog-body');for(const [label,fn] of actions){const b=document.createElement('button');b.className='wb-menu-row';b.textContent=label;b.onclick=()=>{menu.close();fn();};body.append(b);}
}
function wbRow(item,index,compact=false){
    const row=document.createElement('div');row.className='wb-item-card '+(item.type==='folder'?'wb-folder-card':'wb-entry-card');row.dataset.id=item.id;row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-label',item.name);
    const selected=selectedWorldBookIds.has(item.id);if(isWorldBookMultiSelectMode){row.classList.add('is-selecting');row.classList.toggle('selected',selected);}
    const isFolder=item.type==='folder',snippet=isFolder?`${wbChildEntries(item.id).length} 项`:String(item.content||'').replace(/\s+/g,' ');
    row.innerHTML=`${isFolder?'<svg class="wb-folder-shape" viewBox="0 0 180 120" preserveAspectRatio="none"><path d="M12 119Q1 119 1 108V12Q1 1 12 1H54Q60 1 64 7L70 15H168Q179 15 179 26V108Q179 119 168 119Z"/></svg>':''}<span class="wb-item-index">${String(index+1).padStart(2,'0')}</span><button type="button" class="wb-item-check" aria-label="选择 ${wbEscape(item.name)}" aria-pressed="${selected}">${selected?'✓':''}</button><div class="wb-item-copy"><div class="wb-item-name">${wbEscape(item.name)}</div><div class="wb-item-detail">${wbEscape(snippet)}</div></div>${!isFolder?`<span class="wb-item-position">${wbPosition(item.position)}</span>`:''}<button class="wb-item-more" aria-label="管理 ${wbEscape(item.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg></button>`;
    return row;
}
function wbRenderTabs(home){
    const nav=wbEl('wb-filter-tabs'),tabs=home?[['all','全部'],['folder','文件夹'],['entry','条目']]:[['all','全部'],['before','前'],['after','后'],['guidelines','聊天规范'],['limit_break','破限']];
    nav.classList.toggle('wb-chips',!home);nav.replaceChildren();for(const [value,label]of tabs){const b=document.createElement('button');b.type='button';b.textContent=label;b.classList.toggle('active',wbFilter===value);b.setAttribute('aria-pressed',String(wbFilter===value));b.onclick=()=>{wbFilter=value;renderWorldBookList();};nav.append(b);}
}
function renderWorldBookList(){
    if(!wbEl('world-book-list-container'))return;
    while(wbPathStack.length>1&&!wbFind(wbFolder().id))wbPathStack.pop();
    wbNormalizeSelection();const current=wbFolder(),home=current.id==null,query=(wbEl('wb-search')?.value||'').trim().toLowerCase();
    wbEl('world-book-title').textContent=current.name;
    wbEl('world-book-screen').dataset.wbHome=home;
    wbEl('world-book-screen').classList.toggle('wb-selecting',isWorldBookMultiSelectMode);
    wbEl('wb-home-heading').hidden=!home;wbEl('wb-path').hidden=home;
    wbEl('wb-path').textContent=wbPathStack.map(p=>p.name).join(' / ');
    wbEl('wb-search').placeholder=home?'搜索文件夹或条目':'搜索条目';wbRenderTabs(home);
    let items=db.worldBooks.filter(b=>(query?true:wbSame(b.parentId,current.id))&&(!query||(b.name+' '+(b.content||'')).toLowerCase().includes(query)));
    if(wbFilter==='folder'||wbFilter==='entry')items=items.filter(b=>wbFilter==='folder'?b.type==='folder':b.type!=='folder');else if(wbFilter!=='all')items=items.filter(b=>b.type!=='folder'&&(b.position||'before')===wbFilter);
    items=items.slice().sort((a,b)=>Number(b.type==='folder')-Number(a.type==='folder'));
    const container=wbEl('world-book-list-container');container.className=(wbViewMode==='grid'?'grid-view':'list-view');container.replaceChildren();
    items.forEach((b,i)=>container.append(wbRow(b,i)));
    wbEl('no-world-books-placeholder').style.display=items.length?'none':'block';wbEl('no-world-books-placeholder').textContent=query?'没有匹配的条目':'暂无条目';
    const recent=wbEl('wb-recent');recent.hidden=!home||!!query||isWorldBookMultiSelectMode||wbFilter!=='all';
    const list=wbEl('wb-recent-list');list.replaceChildren();
    if(!recent.hidden){const entries=db.worldBooks.filter(b=>b.type!=='folder').slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,3);recent.hidden=!entries.length;entries.forEach((b,i)=>{const row=wbRow(b,i,true);row.classList.add('wb-recent-row');row.querySelector('.wb-item-index').innerHTML=wbPageIcon;row.querySelector('.wb-item-detail').textContent=[wbFind(b.parentId)?.name||'世界书',b.category||wbPosition(b.position)].join(' · ');list.append(row);});}
    wbEl('wb-brand').hidden=!home||isWorldBookMultiSelectMode;
    wbEl('wb-normal-bar').style.display=home||isWorldBookMultiSelectMode?'none':'flex';
    wbEl('world-book-multi-select-bar').style.display=isWorldBookMultiSelectMode?'flex':'none';
    wbEl('cancel-wb-multi-select-btn').style.display=isWorldBookMultiSelectMode?'flex':'none';
    for(const id of ['add-world-book-btn','world-book-view-toggle-btn'])wbEl(id).style.display=isWorldBookMultiSelectMode?'none':'flex';
    wbEl('wb-grid-icon').style.display=wbViewMode==='grid'?'block':'none';wbEl('wb-list-icon').style.display=wbViewMode==='list'?'block':'none';
    updateWorldBookSelectCount();
}
async function setupWorldBookApp(){
    if(wbReady)return;wbReady=true;
    const screen=wbEl('world-book-screen');
    // Register synchronously before migrations; repeat calls never duplicate handlers.
    wbEl('world-book-view-toggle-btn').onclick=()=>{wbViewMode=wbViewMode==='grid'?'list':'grid';renderWorldBookList();};
    wbEl('world-book-back-btn').onclick=e=>{e.stopPropagation();if(wbPathStack.length>1){wbPathStack.pop();wbViewMode=wbFolder().id==null?'grid':'list';wbFilter='all';wbEl('wb-search').value='';renderWorldBookList();}else if(isWorldBookMultiSelectMode)exitWorldBookMultiSelectMode();else switchScreen('home-screen');};
    document.querySelector('#edit-world-book-screen .back-btn').onclick=e=>{e.stopPropagation();wbEditToken++;switchScreen('world-book-screen');};
    wbEl('add-world-book-btn').onclick=e=>{e.stopPropagation();const m=wbEl('world-book-new-menu');m.style.display=m.style.display==='none'?'block':'none';};
    document.addEventListener('click',e=>{if(!e.target.closest('#world-book-new-menu'))wbEl('world-book-new-menu').style.display='none';});
    for(const id of ['wb-menu-new-entry','wb-new-entry-bottom'])wbEl(id).onclick=()=>{wbEl('world-book-new-menu').style.display='none';wbOpenEditor();};
    wbEl('wb-menu-new-folder').onclick=()=>{wbEl('world-book-new-menu').style.display='none';wbNewFolder();};
    wbEl('wb-menu-import').onclick=()=>{wbEl('world-book-new-menu').style.display='none';wbChooseFiles(false);};
    wbEl('wb-editor-import').onclick=()=>wbChooseFiles(true);
    const file=document.createElement('input');file.type='file';file.id='wb-file-import';file.accept='.txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document';file.hidden=true;screen.append(file);file.addEventListener('change',()=>{const target=wbImportTarget;wbImportTarget=null;wbImportFiles([...file.files],target);});
    wbEl('wb-search').addEventListener('input',renderWorldBookList);
    wbEl('world-book-content').addEventListener('input',wbUpdateCount);
    wbEl('world-book-category').addEventListener('change',wbUpdateEditorFolderLabel);
    wbEl('edit-world-book-form').addEventListener('submit',wbSaveEditor);
    wbEl('wb-select-start').onclick=()=>enterWorldBookMultiSelectMode();
    wbEl('delete-selected-world-books-btn').addEventListener('click',deleteSelectedWorldBooks);
    wbEl('move-selected-world-books-btn').onclick=moveSelectedWorldBooksToCurrent;
    wbEl('cancel-wb-multi-select-btn').addEventListener('click',exitWorldBookMultiSelectMode);
    let longTimer,suppressClick=false;
    const lists=[wbEl('world-book-list-container'),wbEl('wb-recent-list')];
    function openRow(e){const card=e.target.closest('.wb-item-card');if(!card)return;if(suppressClick){suppressClick=false;return;}const item=wbFind(card.dataset.id);if(!item)return;
        if(e.target.closest('.wb-item-more'))return wbItemMenu(item.id);
        if(isWorldBookMultiSelectMode){if(e.target.closest('.wb-item-check')||item.type!=='folder')return toggleWorldBookSelection(item.id);}
        if(item.type==='folder'){wbPathStack.push({id:item.id,name:item.name});wbViewMode='list';wbFilter='all';wbEl('wb-search').value='';renderWorldBookList();}else wbOpenEditor(item);
    }
    for(const list of lists){list.addEventListener('click',openRow);list.addEventListener('keydown',e=>{if(e.target.classList.contains('wb-item-card')&&['Enter',' '].includes(e.key)){e.preventDefault();openRow(e);}});list.addEventListener('touchstart',e=>{suppressClick=false;if(e.target.closest('button'))return;const card=e.target.closest('.wb-item-card');if(card)longTimer=setTimeout(()=>{suppressClick=true;enterWorldBookMultiSelectMode(card.dataset.id);},550);},{passive:true});for(const name of ['touchend','touchcancel','touchmove'])list.addEventListener(name,()=>clearTimeout(longTimer),{passive:true});list.addEventListener('contextmenu',e=>{const card=e.target.closest('.wb-item-card');if(card){e.preventDefault();enterWorldBookMultiSelectMode(card.dataset.id);}});}
    wbEl('wb-selector-back-folder-btn').onclick=()=>{if(selectorPathStack.length>1){selectorPathStack.pop();wbEl('wb-selector-search').value='';renderWorldBookSelectorList();}};
    wbEl('cancel-world-book-selection-btn').onclick=closeWorldBookSelector;
    wbEl('wb-selector-search').addEventListener('input',renderWorldBookSelectorList);
    wbEl('wb-selector-confirm').onclick=()=>wbEl('save-world-book-selection-btn').click();
    try{await migrateWorldBookPositions();}catch(e){console.warn('Worldbook migration failed',e);}
    renderWorldBookList();
}
function openWorldBookSelector(initialSelectedIds){
    selectorPathStack=[{id:null,name:'世界书'}];
    tempSelectedWbIds=new Set((initialSelectedIds||[]).map(id=>wbFind(id)?.id).filter(id=>id!=null));
    wbEl('wb-selector-search').value='';wbEl('world-book-selection-modal').classList.add('visible');renderWorldBookSelectorList();
}
function closeWorldBookSelector(){wbEl('world-book-selection-modal').classList.remove('visible');}
function wbSelectorCount(){const text=`已选 ${tempSelectedWbIds.size} 项`;wbEl('wb-selector-count').textContent=text;wbEl('wb-selector-bottom-count').textContent=text;}
function renderWorldBookSelectorList(){
    const current=selectorPathStack[selectorPathStack.length-1],container=wbEl('world-book-selection-list'),query=wbEl('wb-selector-search').value.trim().toLowerCase();
    wbEl('wb-selector-back-folder-btn').style.display=selectorPathStack.length>1?'inline-flex':'none';wbEl('wb-selector-current-folder-name').textContent=selectorPathStack.map(p=>p.name).join(' / ');
    const items=db.worldBooks.filter(b=>(query?true:wbSame(b.parentId,current.id))&&(!query||(b.name+' '+(b.content||'')).toLowerCase().includes(query)));
    container.replaceChildren();
    items.forEach((item,i)=>{const folder=item.type==='folder',ids=folder?wbChildEntries(item.id):[item.id],checked=ids.length>0&&ids.every(id=>tempSelectedWbIds.has(id));const row=document.createElement('div');row.className='wb-selector-row';row.classList.toggle('selected',checked);
        row.innerHTML=`<input type="checkbox" class="wb-selector-checkbox" aria-label="${folder?'全选文件夹：':''}${wbEscape(item.name)}" ${checked?'checked':''}><span class="wb-selector-index">${String(i+1).padStart(2,'0')}</span><button class="wb-selector-copy"><strong>${wbEscape(item.name)}</strong><small>${wbEscape(folder?`${ids.length} 个条目`:String(item.content||'').replace(/\s+/g,' '))}</small></button>${!folder?`<span class="wb-item-position">${wbPosition(item.position)}</span>`:''}`;
        const cb=row.querySelector('input');cb.indeterminate=!checked&&ids.some(id=>tempSelectedWbIds.has(id));
        cb.addEventListener('change',()=>{for(const id of ids)cb.checked?tempSelectedWbIds.add(id):tempSelectedWbIds.delete(id);renderWorldBookSelectorList();});
        row.querySelector('button').onclick=()=>{if(folder){selectorPathStack.push({id:item.id,name:item.name});wbEl('wb-selector-search').value='';renderWorldBookSelectorList();}else{cb.checked=!cb.checked;cb.dispatchEvent(new Event('change'));}};
        container.append(row);
    });
    if(!items.length){const p=document.createElement('p');p.className='wb-empty';p.textContent=query?'没有匹配的条目':'文件夹为空';container.append(p);}wbSelectorCount();
}

function renderCategorizedWorldBookList(container, books, selectedIds, idPrefix) {
    container.innerHTML = '';
    // 仅显示条目，不显示文件夹
    const entries = books.filter(b => b.type === 'entry');
    
    if (!entries || entries.length === 0) {
        container.innerHTML = '<li style="color: #888; text-align: center; padding: 15px;">暂无世界书条目</li>';
        return;
    }

    const groupedBooks = entries.reduce((acc, book) => {
        const category = book.category || '未分类';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(book);
        return acc;
    }, Object.create(null));

    const sortedCategories = Object.keys(groupedBooks).sort((a, b) => {
        if (a === '未分类') return 1;
        if (b === '未分类') return -1;
        return a.localeCompare(b);
    });

    sortedCategories.forEach(category => {
        const categoryBooks = groupedBooks[category];
        const allInCategorySelected = categoryBooks.every(book => selectedIds.includes(book.id));

        const groupEl = document.createElement('div');
        groupEl.className = 'world-book-category-group';

        groupEl.innerHTML = `
            <div class="world-book-category-header">
                <input type="checkbox" class="category-checkbox" ${allInCategorySelected ? 'checked' : ''}>
                <span class="category-name">${wbEscape(category)}</span>
                
            </div>
            <ul class="world-book-items-list">
                ${categoryBooks.map(book => {
                    const isChecked = selectedIds.includes(book.id);
                    return `
                        <li class="world-book-select-item">
                            <input type="checkbox" class="item-checkbox" id="${idPrefix}-${wbEscape(book.id)}" value="${wbEscape(book.id)}" ${isChecked ? 'checked' : ''}>
                            <label for="${idPrefix}-${wbEscape(book.id)}">${wbEscape(book.name)}</label>
                        </li>
                    `;
                }).join('')}
            </ul>
        `;
        container.appendChild(groupEl);
    });

    container.querySelectorAll('.world-book-category-header').forEach(header => {
        header.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox') return; 
            const group = header.closest('.world-book-category-group');
            group.classList.toggle('open');
        });
    });

    container.querySelectorAll('.category-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const group = e.target.closest('.world-book-category-group');
            const itemCheckboxes = group.querySelectorAll('.item-checkbox');
            itemCheckboxes.forEach(itemCb => {
                itemCb.checked = e.target.checked;
            });
        });
    });

    container.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const group = e.target.closest('.world-book-category-group');
            const categoryCheckbox = group.querySelector('.category-checkbox');
            const allItems = group.querySelectorAll('.item-checkbox');
            const allChecked = Array.from(allItems).every(item => item.checked);
            categoryCheckbox.checked = allChecked;
        });
    });
}

