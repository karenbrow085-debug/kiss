/* KISS archive family: presentation only. Existing controls and handlers stay in place. */
(() => {
'use strict';
if (window.KissArchiveUI) return;
const $ = id => document.getElementById(id);
const svg = (body, cls = '', fill = 'none') => `<svg class="${cls}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const glyph = {
 book: '<path d="M12 5C8 2 3 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-3-2-7-2-10 1Zm0 0v15"/>',
 disk: '<path d="M4 2h13l5 5v15H2V2Zm2 0v7h11V2M6 22V13h12v9M14 3v4"/>',
 down: '<path d="M12 2v13m-5-5 5 5 5-5M3 14v7h18v-7"/>',
 file: '<path d="M5 2h10l5 5v15H5Zm10 0v6h5M8 12h9M8 16h7"/>',
 group: '<circle cx="9" cy="7" r="4"/><path d="M2 22v-3a7 7 0 0 1 14 0v3M17 3a4 4 0 0 1 0 8M19 14a6 6 0 0 1 3 5v3"/>',
 intro: '<rect x="2" y="3" width="20" height="18" rx="2"/><path d="M2 8h20M5 5h1m2 0h1m2 0h1"/>',
 chat: '<path d="M21 15a3 3 0 0 1-3 3H9l-6 4V5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z"/>',
 plug: '<path d="M7 3v5m10-5v5M5 8h14v3a7 7 0 0 1-14 0Zm7 10v4"/>',
 clip: '<path d="m9 15 7-9a3 3 0 0 1 5 4L11 22a5 5 0 0 1-8-6L13 3a2 2 0 0 1 4 3L7 19"/>',
 person: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3M2 7V2h5m10 0h5v5M2 17v5h5m10 0h5v-5"/>',
 star: '<path d="M12 1C10 8 8 10 1 12c7 2 9 4 11 11 2-7 4-9 11-11-7-2-9-4-11-11Z" fill="currentColor" stroke="none"/>',
 github: '<path stroke="none" fill="currentColor" d="M12 .297C5.37.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577v-2.234c-3.338.726-4.043-1.416-4.043-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.084 1.838 1.237 1.838 1.237 1.07 1.835 2.807 1.305 3.492.998.108-.776.418-1.305.762-1.605-2.665-.303-5.467-1.334-5.467-5.931 0-1.31.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23a11.51 11.51 0 0 1 6.006 0c2.291-1.552 3.297-1.23 3.297-1.23.653 1.652.242 2.873.119 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.625-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>'
};
const icon = (name, cls = '') => svg(glyph[name] || glyph.file, cls);
const floppy = `<svg class="au-floppy" viewBox="0 0 90 108" aria-hidden="true"><path d="M6 2h70l12 12v91H2V6Z" fill="#aaa" stroke="#181818" stroke-width="1.3"/><path d="M12 2h58v30H12Z" fill="#eee" stroke="#181818"/><rect x="48" y="6" width="15" height="21" rx="1" fill="#181818"/><path d="M10 40h68v55H10Z" fill="white" stroke="#181818"/><text x="15" y="53" font-size="9" font-weight="bold" fill="#181818" stroke="none">TUTORIAL</text><path d="M15 59h56M15 69h35M15 75h43M15 87h2m2 0h1m2 0h3m2 0h1m2 0h2m2 0h1m2 0h3m2 0h1m2 0h2m2 0h1m2 0h3m2 0h1" fill="none" stroke="#555" stroke-width="1"/><rect x="5" y="97" width="5" height="5" fill="#181818"/><rect x="78" y="97" width="5" height="5" fill="#181818"/></svg>`;
function node(tag, cls, html) { const el=document.createElement(tag);el.className=cls; if(html)el.innerHTML=html;return el; }
function mark(el, cls) { if(el&&!el.classList.contains(cls))el.classList.add(cls);return el; }
function windowTitle(el, title, small='') {
 if(!el || el.querySelector(':scope > .au-window-title'))return;
 const head=node('div','au-window-title',`<span></span><small></small>`);head.firstElementChild.textContent=title;head.lastElementChild.textContent=small;el.prepend(head);
}
function api() {
 const screen=$('api-settings-screen');if(!screen)return;
 mark(screen,'au-api');
 const title=screen.querySelector('.app-header .title');if(title&&title.textContent!=='API 设置')title.textContent='API 设置';
 const hero=screen.querySelector('.kv-hero');if(hero&&!hero.querySelector('.au-connection-mark'))hero.prepend(node('div','au-connection-mark',`<span>CONNECTION / 01</span><i></i>${icon('plug')}<b>ⅠⅠⅠ</b>`));
 const form=$('api-form');if(form){
  const connection=$('api-provider')?.closest('.kkt-group');mark(connection,'au-api-connection');windowTitle(connection,'连接配置','CONNECTION');
  const model=$('api-model')?.closest('.kkt-group');mark(model,'au-api-model');
  const modelRow=$('fetch-models-btn')?.closest('.kkt-item');mark(modelRow,'au-model-header');
  mark($('secondary-api-provider')?.closest('.kkt-group'),'au-secondary-connection');
  const presets=$('api-preset-select')?.closest('.kkt-group')||form.querySelector('.kkt-group:has(#api-manage-btn)');if(presets){mark(presets,'au-api-presets');windowTitle(presets,'API 预设','PRESETS');}
  for(const group of form.querySelectorAll(':scope > .kkt-group'))group.classList.add('au-api-group');
 }
 for(const card of screen.querySelectorAll('.kv-card:not(.kv-connection)')){
  const h=card.querySelector('h3');if(h){mark(h,'au-voice-heading');}
 }
}
function tutorial(){
 const area=$('tutorial-content-area');if(!area||!area.querySelector('.tutorial-item'))return;
 if(!area.querySelector('.au-manual-hero')){
  area.prepend(node('div','au-manual-hero',`<div><h2>使用手册</h2><small>USER MANUAL</small><p>软件使用说明与数据备份</p></div><div class="au-manual-art" aria-hidden="true">${icon('book')}<small>READ ME</small>${floppy}</div>`));
 }
 const images=['file','book','intro','chat','group'];area.querySelectorAll('.tutorial-item').forEach((item,i)=>{
  const h=item.querySelector('.tutorial-header');if(h&&!h.querySelector('.au-chapter-icon'))h.prepend(node('span','au-chapter-icon',icon(images[i]||'file')));
 });
 let backup=area.querySelector('.au-backup-actions');
 if(!backup){
  const button=area.querySelector(':scope > button.btn-primary'),label=area.querySelector(':scope > label[for="import-data-input"]');
  if(button&&label){const section=node('section','au-backup-section','<h3>数据与备份<small>DATA &amp; BACKUP</small></h3>');backup=node('div','au-backup-actions');button.before(section);section.append(backup);backup.append(button,label);button.prepend(node('span','au-action-icon',icon('disk')));label.prepend(node('span','au-action-icon',icon('down')));}
 }
 const reminder=$('backup-reminder-switch')?.closest('.btn-white')?.parentElement;
 if(reminder){mark(reminder,'au-reminder');const head=reminder.firstElementChild;mark(head,'au-section-label');}
 const cloud=$('gh-collapse-header')?.closest('.btn-white')?.parentElement;
 if(cloud&&!cloud.classList.contains('au-cloud')){
  mark(cloud,'au-cloud');const heading=cloud.firstElementChild;
  heading.className='au-cloud-heading';heading.replaceChildren(node('strong','', '云端备份'),node('span','au-github-brand',icon('github')+'<b>GitHub</b>'),node('small','','CLOUD BACKUP'));
  const footer=node('div','au-disk-stamp','<span class="au-barcode" aria-hidden="true"></span><small>GITHUB<br>BACKUP</small>');cloud.append(footer);
  const caption=$('gh-collapse-header').querySelector('span');if(caption)caption.textContent='配置参数';
  mark($('gh-backup-btn')?.parentElement,'au-cloud-actions');
 }
 const overlay=$('gh-help-overlay');if(overlay)overlay.classList.add('au-tutorial-help');
}
function consoleView(){
 const screen=$('console-screen'),root=$('kc-root');if(!screen||!root)return;mark(screen,'au-console');
 const content=root.querySelector('.kc-content');if(!content)return;
 if(root.dataset.view==='home'&&!content.querySelector('.au-live-label'))content.prepend(node('div','au-live-label','<span>● &nbsp; LIVE LOG / 运行记录</span><small>SYSTEM LOG</small>'));
 for(const list of content.querySelectorAll('.kc-timeline')){
  if(!list.querySelector(':scope > .au-log-title'))list.prepend(node('div','au-log-title',`${icon('file')}<span>SYSTEM LOG VIEWER</span>`));
 }
}
function worldbook(){
 const screen=$('world-book-screen');if(!screen)return;mark(screen,'au-worldbook');
 const intro=$('wb-home-heading');if(intro&&!intro.dataset.auMarked){intro.dataset.auMarked='true';const h=intro.querySelector('h2');if(h)h.innerHTML='设定档案 <span aria-hidden="true">'+svg('<path d="M12 11C3 11 1 8 3 4c3-5 9-3 9 7Z"/><path d="M12 11C3 11 1 8 3 4c3-5 9-3 9 7Z" transform="rotate(90 12 12)"/><path d="M12 11C3 11 1 8 3 4c3-5 9-3 9 7Z" transform="rotate(180 12 12)"/><path d="M12 11C3 11 1 8 3 4c3-5 9-3 9 7Z" transform="rotate(270 12 12)"/>','au-clover','currentColor')+'</span>';const tag=intro.querySelector(':scope > span');if(tag)tag.innerHTML='WORLD BOOK<br>/ LIBRARY';}
 for(const card of screen.querySelectorAll('.wb-folder-card')){
  if(card.querySelector('.au-folder-art'))continue;
  const name=card.querySelector('.wb-item-name')?.textContent||'',id=card.dataset.id||name;
  const kind=/规则|規則/.test(name)?1:/角色/.test(name)?2:/文风|文風/.test(name)?3:/总结|總結/.test(name)?0:[...id].reduce((v,c)=>v+c.charCodeAt(0),0)%4;
  card.dataset.auArt=kind;
  const art=node('span','au-folder-art',kind===3?'<i>Aa</i>':icon(['star','clip','person'][kind]));art.setAttribute('aria-hidden','true');card.append(art);
  const label=node('span','au-folder-label',`<small>${['PROJECT','ARCHIVE / RULES','CHARACTER','WRITING'][kind]}</small><i></i><b></b>`);label.setAttribute('aria-hidden','true');card.append(label);
 }
 const recent=$('wb-recent'),heading=recent?.querySelector('h3');if(heading&&!heading.querySelector('.au-recent-tag'))heading.append(node('small','au-recent-tag','RECENT FILES ////'));
 for(const row of screen.querySelectorAll('.wb-recent-row')){const detail=row.querySelector('.wb-item-detail');if(detail){const parts=detail.textContent.split(' · ');if(parts.length===2&&parts[0]===parts[1])detail.textContent=parts[0];}}
 const brand=$('wb-brand');if(brand&&!brand.dataset.auMarked){brand.dataset.auMarked='true';brand.innerHTML='<i></i><b>✦</b><strong>kiss <small>/ WORLD BOOK</small></strong><i></i><span class="au-barcode" aria-hidden="true"></span>';}
}
// Scoped asynchronous dialogs replace only these apps' existing native dialogs.
// No global alert/confirm/prompt interception, and no persistence or network access.
function ask(app,kind,message,value=''){
 return new Promise(resolve=>{
  const before=document.activeElement,overlay=node('div',`au-dialog-overlay au-dialog-${app}`);
  const box=node('section','au-dialog');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
  const title=kind==='prompt'?'输入名称':kind==='confirm'?'操作确认':'提示';
  const header=node('header','au-dialog-header',`${icon(app==='api'?'plug':'disk')}<strong></strong><button type="button" aria-label="关闭">×</button>`);header.querySelector('strong').textContent=title;
  const text=node('p','au-dialog-message');text.textContent=String(message);
  box.append(header,text);let input;
  if(kind==='prompt'){input=document.createElement('input');input.type='text';input.value=value;input.maxLength=200;input.setAttribute('aria-label','名称');box.append(input);}
  const footer=node('footer','au-dialog-actions');const cancel=node('button','',kind==='alert'?'关闭':'取消');cancel.type='button';const ok=node('button','au-primary','确认');ok.type='button';footer.append(cancel);if(kind!=='alert')footer.append(ok);box.append(footer);overlay.append(box);document.body.append(overlay);
  const oldScroll=document.body.style.overflow;document.body.style.overflow='hidden';let settled=false;
  const close=result=>{if(settled)return;settled=true;document.removeEventListener('keydown',key,true);overlay.remove();document.body.style.overflow=oldScroll;before?.focus?.({preventScroll:true});resolve(result);};
  const dismiss=()=>close(kind==='prompt'?null:false);
  header.querySelector('button').onclick=dismiss;cancel.onclick=dismiss;ok.onclick=()=>close(input?input.value:true);
  overlay.onclick=e=>{if(e.target===overlay)dismiss();};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismiss();}else if(e.key==='Enter'&&kind==='prompt'&&!e.isComposing){e.preventDefault();ok.click();}else if(e.key==='Tab'){const items=[...box.querySelectorAll('button,input')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener('keydown',key,true);(input||cancel).focus({preventScroll:true});
 });
}
window.KissArchiveUI={confirm:(app,msg)=>ask(app,'confirm',msg),prompt:(app,msg,value)=>ask(app,'prompt',msg,value),alert:(app,msg)=>ask(app,'alert',msg)};
function mount(){
 const tasks=new Map([['api-settings-screen',api],['tutorial-screen',tutorial],['console-screen',consoleView],['world-book-screen',worldbook]]),pending=new Set();let scheduled=0;
 const schedule=fn=>{pending.add(fn);if(!scheduled)scheduled=requestAnimationFrame(()=>{scheduled=0;const jobs=[...pending];pending.clear();jobs.forEach(run=>run());});};
 const active=()=>{const current=[...tasks.keys()].find(id=>$(id)?.classList.contains('active'));const value=current==='api-settings-screen'?'api':current==='tutorial-screen'?'tutorial':'';if(document.body.dataset.archiveApp!==value)document.body.dataset.archiveApp=value;};
 for(const [id,fn]of tasks){const root=$(id);if(!root)continue;fn();new MutationObserver(()=>schedule(fn)).observe(root,{childList:true,subtree:true});new MutationObserver(active).observe(root,{attributes:true,attributeFilter:['class']});}
 active();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
