/* Desktop placement: coordinates are separate from the existing ordered ID lists. */
(() => {
 'use strict';
 const COLS=4,ROWS=6;
 for(const key of ['homeLayoutMode','homeFreePositions'])if(!globalSettingKeys.includes(key))globalSettingKeys.push(key);
 const enabled=()=>db.homeLayoutMode==='free';
 let drag=null,cleanup=null,busy=false,suppressClickUntil=0;
 const persist=(keys=['homeLayoutMode','homeFreePositions','homeLayoutPages','homeLayoutOrder'])=>window.PhoneBackup?.saveHomeSettings?window.PhoneBackup.saveHomeSettings(keys):saveData();
 const copy=value=>JSON.parse(JSON.stringify(value));
 const size=el=>{const m=(typeof el==='string'?el:el.className).match(/grid-item-(\d+)x(\d+)/);return {rows:Math.min(ROWS,Math.max(1,Number(m?.[1])||1)),cols:Math.min(COLS,Math.max(1,Number(m?.[2])||1))};};
 const valid=(p,s)=>p&&Number.isInteger(p.row)&&Number.isInteger(p.col)&&p.row>=1&&p.col>=1&&p.row+s.rows<=ROWS+1&&p.col+s.cols<=COLS+1;
 const fits=(grid,p,s)=>valid(p,s)&&Array.from({length:s.rows},(_,i)=>Array.from({length:s.cols},(_,j)=>!grid[p.row-1+i][p.col-1+j]).every(Boolean)).every(Boolean);
 const occupy=(grid,p,s)=>{for(let r=0;r<s.rows;r++)for(let c=0;c<s.cols;c++)grid[p.row-1+r][p.col-1+c]=true;};
 const empty=()=>Array.from({length:ROWS},()=>Array(COLS).fill(false));
 function firstFit(grid,s){for(let row=1;row<=ROWS;row++)for(let col=1;col<=COLS;col++){const p={row,col};if(fits(grid,p,s))return p;}return null;}
 function normalize(items,ids){
  const before=JSON.stringify([db.homeLayoutPages,db.homeFreePositions]);
  const pages=Array.isArray(db.homeLayoutPages)&&db.homeLayoutPages.length?db.homeLayoutPages.map(p=>Array.isArray(p)?p:[]):[db.homeLayoutOrder||[]];
  const saved=db.homeFreePositions&&typeof db.homeFreePositions==='object'?db.homeFreePositions:{};
  const seen=new Set(),next=pages.map(()=>[]),positions={},grids=pages.map(empty),pending=[];
  pages.forEach((page,pi)=>page.forEach(id=>{if(typeof id!=='string'||!Object.hasOwn(items,id)||seen.has(id))return;seen.add(id);const s=size(items[id]),p=saved[id];
   if(fits(grids[pi],p,s)){next[pi].push(id);positions[id]={row:p.row,col:p.col};occupy(grids[pi],p,s);}else pending.push({id,pi,s});
  }));
  ids.forEach(id=>{if(!seen.has(id)){seen.add(id);pending.push({id,pi:pages.length-1,s:size(items[id])});}});
  // Reserve all saved cells first. Only new/missing/invalid entries seek a vacant cell.
  for(const entry of pending){let pi=entry.pi,p=null;for(;pi<next.length;pi++)if((p=firstFit(grids[pi],entry.s)))break;
   if(!p){pi=next.length;next.push([]);grids.push(empty());p=firstFit(grids[pi],entry.s);}
   next[pi].push(entry.id);positions[entry.id]=p;occupy(grids[pi],p,entry.s);
  }
  db.homeLayoutPages=next;db.homeLayoutOrder=next.flat();db.homeFreePositions=positions;
  if(before!==JSON.stringify([next,positions]))Promise.resolve(persist()).catch(()=>showToast('桌面位置保存失败，请重试'));
 }
 function geometry(grid){
  const rect=grid.getBoundingClientRect(),css=getComputedStyle(grid),left=parseFloat(css.paddingLeft)||0,top=parseFloat(css.paddingTop)||0;
  const cg=parseFloat(css.columnGap)||0,rg=parseFloat(css.rowGap)||0;
  const widths=css.gridTemplateColumns.split(' ').map(Number.parseFloat),heights=css.gridTemplateRows.split(' ').map(Number.parseFloat);
  const scaleX=rect.width/grid.offsetWidth||1,scaleY=rect.height/grid.offsetHeight||1;
  const cw=widths[0]||((grid.clientWidth-left-(parseFloat(css.paddingRight)||0)-cg*3)/4),rh=heights[0]||70;
  return {left:rect.left+(left-grid.scrollLeft)*scaleX,top:rect.top+(top-grid.scrollTop)*scaleY,cw:cw*scaleX,rh:rh*scaleY,cg:cg*scaleX,rg:rg*scaleY,heights:heights.map(h=>h*scaleY),widths:widths.map(w=>w*scaleX)};
 }
 function capture(){
  const positions={};
  document.querySelectorAll('#home-screen .home-grid-layout').forEach(grid=>{const g=geometry(grid);for(const el of grid.querySelectorAll(':scope > [data-id]')){const r=el.getBoundingClientRect();let row=1,y=g.top;
   for(let i=0;i<5;i++){const h=g.heights[i]||g.rh;if(r.top<y+h/2)break;y+=h+g.rg;row++;}
   let col=1,x=g.left;for(let i=0;i<3;i++){const w=g.widths[i]||g.cw;if(r.left<x+w/2)break;x+=w+g.cg;col++;}
   positions[el.dataset.id]={row,col};
  }});return positions;
 }
 async function toggle(){
  if(busy)return;busy=true;
  const previous={mode:db.homeLayoutMode,positions:copy(db.homeFreePositions||{}),pages:copy(db.homeLayoutPages),order:copy(db.homeLayoutOrder)};
  const next=!enabled();
  try{
   if(next)db.homeFreePositions=capture();
   db.homeLayoutMode=next?'free':'auto';await persist();
   const oldSwiper=document.getElementById('home-screen-swiper'),page=oldSwiper?Math.round(oldSwiper.scrollLeft/oldSwiper.clientWidth):0;setupHomeScreen();enterHomeEditMode();restorePage(page);
   showToast(next?'自由排版已开启，空位会保留':'已切回自动排列');
  }catch(error){db.homeLayoutMode=previous.mode;db.homeFreePositions=previous.positions;db.homeLayoutPages=previous.pages;db.homeLayoutOrder=previous.order;showToast('排版设置保存失败，请重试');}
  finally{busy=false;}
 }
 function restorePage(page){const swiper=document.getElementById('home-screen-swiper');if(swiper){const index=Math.max(0,Math.min(page,swiper.children.length-1));swiper.scrollTo({left:swiper.clientWidth*index,behavior:'instant'});updatePageIndicator(index);}}
 function decorate(signal){
  if(cleanup){cleanup();cleanup=null;}
  const dock=document.querySelector('#home-screen .dock-edit');
  if(dock){
   const glyph=body=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+body+'</svg>';
   for(const [id,label,body] of [['add-widget-btn','添加组件','<path d="M12 4v16M4 12h16"/>'],['finish-edit-btn','完成','<path d="m5 12 4 4L19 6"/>']]){const el=document.getElementById(id);if(el){el.innerHTML=glyph(body)+'<span>'+label+'</span>';el.setAttribute('aria-label',label);}}
   const button=document.createElement('button');button.id='home-layout-mode-btn';button.type='button';button.innerHTML=glyph('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M15 18h6m-3-3v6"/>')+'<span>自由排版</span><i aria-hidden="true"></i>';button.setAttribute('aria-pressed',String(enabled()));button.setAttribute('aria-label','自由排版：'+(enabled()?'已开启':'已关闭'));button.title='开启后保留空位；关闭后自动排列';button.onclick=toggle;dock.insertBefore(button,document.getElementById('finish-edit-btn'));
  }
  if(!enabled())return;
  document.querySelectorAll('#home-screen .home-grid-layout').forEach(grid=>{grid.classList.add('home-free-grid');for(const el of grid.querySelectorAll(':scope > [data-id]')){const p=db.homeFreePositions?.[el.dataset.id],s=size(el);if(valid(p,s)){el.style.gridColumn=p.col+' / span '+s.cols;el.style.gridRow=p.row+' / span '+s.rows;}}});
 }
 function refresh(pageIndex){
  const swiper=document.getElementById('home-screen-swiper');if(!swiper)return;
  const nodes=new Map([...swiper.querySelectorAll('.home-grid-layout > [data-id]')].map(el=>[el.dataset.id,el]));
  while(swiper.children.length<db.homeLayoutPages.length){const p=document.createElement('div');p.className='home-screen-page';const g=document.createElement('div');g.className='home-grid-layout'+(enabled()?' home-free-grid':'')+(isHomeEditMode?' edit-mode':'');g.style.minHeight='500px';p.append(g);swiper.append(p);}
  db.homeLayoutPages.forEach((ids,pi)=>{const grid=swiper.children[pi].querySelector('.home-grid-layout');grid.id='home-grid-layout-'+(pi+1);for(const [index,id] of ids.entries()){const el=nodes.get(id);if(el&&grid.children[index]!==el)grid.insertBefore(el,grid.children[index]||null);if(el&&enabled()){const p=db.homeFreePositions[id],s=size(el);if(valid(p,s)){el.style.gridColumn=p.col+' / span '+s.cols;el.style.gridRow=p.row+' / span '+s.rows;}}}});
  while(swiper.children.length>db.homeLayoutPages.length)swiper.lastElementChild.remove();
  const indicator=document.querySelector('#home-screen .page-indicator');if(indicator){while(indicator.children.length<db.homeLayoutPages.length){const d=document.createElement('span');d.className='dot';indicator.append(d);}while(indicator.children.length>db.homeLayoutPages.length)indicator.lastElementChild.remove();}
  restorePage(pageIndex);
 }
 async function commitAutoOrder(pages,page){
  if(busy)return;busy=true;suppressClickUntil=performance.now()+300;
  const before={pages:db.homeLayoutPages,order:db.homeLayoutOrder},items={};
  document.querySelectorAll('#home-screen .home-grid-layout > [data-id]').forEach(el=>{const s=size(el);items[el.dataset.id]='grid-item-'+s.rows+'x'+s.cols;});
  const work=pages.map(p=>p.slice()),packed=[];
  for(let i=0;i<work.length;i++){const pieces=calculatePagesFromIds(work[i],items).filter(p=>p.length);packed.push(pieces[0]||[]);if(pieces.length>1)work[i+1]=pieces.slice(1).flat().concat(work[i+1]||[]);}
  db.homeLayoutPages=packed.filter(p=>p.length);if(!db.homeLayoutPages.length)db.homeLayoutPages=[[]];db.homeLayoutOrder=db.homeLayoutPages.flat();refresh(page);
  try{await persist(['homeLayoutPages','homeLayoutOrder']);}catch(error){db.homeLayoutPages=before.pages;db.homeLayoutOrder=before.order;refresh(page);showToast('位置保存失败，已恢复原位置');}finally{busy=false;initHomeSortables();}
 }
 async function removeWidget(id){
  if(busy||!confirm('确定要删除这个小组件吗？'))return;
  const instance=(db.addedWidgets||[]).find(w=>w.id===id);if(!instance)return;
  busy=true;cancelDrag();
  const before={widgets:db.addedWidgets,pages:db.homeLayoutPages,order:db.homeLayoutOrder,positions:db.homeFreePositions};
  const swiper=document.getElementById('home-screen-swiper'),page=swiper?Math.round(swiper.scrollLeft/swiper.clientWidth):0;
  const node=[...document.querySelectorAll('#home-screen .home-grid-layout > [data-id]')].find(el=>el.dataset.id===id),parent=node?.parentElement,next=node?.nextSibling;
  db.addedWidgets=db.addedWidgets.filter(w=>w.id!==id);db.homeLayoutPages=db.homeLayoutPages.map(p=>p.filter(x=>x!==id));db.homeLayoutOrder=db.homeLayoutPages.flat();db.homeFreePositions={...(db.homeFreePositions||{})};delete db.homeFreePositions[id];
  const emptyPages=!enabled()?db.homeLayoutPages.map((p,i)=>p.length?-1:i).filter(i=>i>=0):[];
  if(!enabled()){db.homeLayoutPages=db.homeLayoutPages.filter(p=>p.length);if(!db.homeLayoutPages.length)db.homeLayoutPages=[[]];}
  node?.remove();
  try{
   await persist(['addedWidgets','homeLayoutPages','homeLayoutOrder','homeFreePositions']);
   window.KissWidgetRuntime?.release(id);
   document.querySelectorAll('.widget-dynamic-script').forEach(el=>{if(el.dataset.widgetId===id)el.remove();});
   if(!db.addedWidgets.some(w=>w.templateId===instance.templateId))document.getElementById('custom-widget-style-'+instance.templateId)?.remove();
   const oldPages=[...swiper.children];for(const i of emptyPages)oldPages[i]?.remove();
   refresh(page);if(!enabled())initHomeSortables();
  }catch(error){db.addedWidgets=before.widgets;db.homeLayoutPages=before.pages;db.homeLayoutOrder=before.order;db.homeFreePositions=before.positions;if(node&&parent)parent.insertBefore(node,next?.parentNode===parent?next:null);refresh(page);showToast('删除保存失败，已恢复组件，请重试');}
  finally{busy=false;}
 }
 function cancelDrag(){if(cleanup)cleanup();}
 function bind(signal){
  const screen=document.getElementById('home-screen'),swiper=document.getElementById('home-screen-swiper');
  let timer=0,press=null,edgeTimer=0,lastFlip=0,paintFrame=0;
  const clearPress=()=>{clearTimeout(timer);timer=0;press=null;};
  const clear=()=>{clearPress();cancelAnimationFrame(paintFrame);paintFrame=0;clearInterval(edgeTimer);edgeTimer=0;if(drag){drag.item.classList.remove('home-free-source');drag.ghost.remove();drag.marker.remove();drag=null;}swiper.style.scrollSnapType='x mandatory';swiper.style.scrollBehavior='';};
  cleanup=clear;signal.addEventListener('abort',clear,{once:true});
  function addPage(){const pi=swiper.children.length,page=document.createElement('div');page.className='home-screen-page';page.innerHTML='<div class="home-grid-layout home-free-grid edit-mode" id="home-grid-layout-'+(pi+1)+'" style="min-height:500px"></div>';swiper.append(page);const dot=document.createElement('span');dot.className='dot';screen.querySelector('.page-indicator')?.append(dot);}
  function begin(e){
   const item=e.target.closest('.home-grid-layout > [data-id]');if(!item)return;
   const rect=item.getBoundingClientRect(),ghost=item.cloneNode(true),marker=document.createElement('div'),g=geometry(item.parentElement);
   ghost.removeAttribute('id');ghost.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));ghost.classList.add('home-free-ghost');Object.assign(ghost.style,{width:rect.width+'px',height:rect.height+'px',left:rect.left+'px',top:rect.top+'px'});marker.className='home-free-target';document.body.append(marker,ghost);item.classList.add('home-free-source');
   drag={item,ghost,marker,id:item.dataset.id,pointer:e.pointerId,s:size(item),x:e.clientX,y:e.clientY,dx:e.clientX-rect.left,dy:e.clientY-rect.top,grabCol:Math.floor((e.clientX-rect.left)/(g.cw+g.cg)),grabRow:Math.floor((e.clientY-rect.top)/(g.rh+g.rg)),target:null,valid:false,moved:false,cache:new Map(),lastMarker:""};
   swiper.style.scrollSnapType='none';swiper.style.scrollBehavior='auto';if(swiper.children.length<100)addPage();
   edgeTimer=setInterval(()=>{if(!drag?.moved)return;const now=Date.now(),r=swiper.getBoundingClientRect(),activePage=swiper.children[Math.round(swiper.scrollLeft/swiper.clientWidth)];if(activePage&&drag.y>=r.top&&drag.y<=r.bottom){const step=drag.y<r.top+24?-12:drag.y>r.bottom-24?12:0;if(step){activePage.scrollTop+=step;locate();}}if(now-lastFlip<650)return;const current=Math.round(swiper.scrollLeft/swiper.clientWidth),delta=drag.x<r.left+28?-1:drag.x>r.right-28?1:0,next=current+delta;if(delta&&next>=0&&next<swiper.children.length){swiper.scrollLeft=next*swiper.clientWidth;lastFlip=now;locate();}},80);
   locate();
  }
  function locate(){
   if(!drag)return;const pi=Math.round(swiper.scrollLeft/swiper.clientWidth),grid=swiper.children[pi]?.querySelector('.home-grid-layout');if(!grid)return;
   const page=swiper.children[pi],cacheKey=[swiper.scrollLeft,page.scrollTop,grid.clientWidth,innerHeight].join(':');
   let cached=drag.cache.get(pi);
   if(!cached||cached.key!==cacheKey){const occupied=empty();for(const el of grid.querySelectorAll(':scope > [data-id]'))if(el!==drag.item){const q=db.homeFreePositions[el.dataset.id],s=size(el);if(valid(q,s))occupy(occupied,q,s);}cached={key:cacheKey,g:geometry(grid),occupied,r:grid.getBoundingClientRect(),viewport:swiper.getBoundingClientRect()};drag.cache.set(pi,cached);}
   const {g,occupied,r,viewport}=cached,p={row:Math.floor((drag.y-g.top+g.rg/2)/(g.rh+g.rg))+1-drag.grabRow,col:Math.floor((drag.x-g.left+g.cg/2)/(g.cw+g.cg))+1-drag.grabCol};
   drag.valid=drag.y>=viewport.top&&drag.y<=viewport.bottom&&drag.x>=r.left&&drag.x<=r.right&&drag.y>=r.top&&drag.y<=r.bottom&&fits(occupied,p,drag.s);drag.target={pi,...p};
   const markerKey=[pi,p.row,p.col,drag.valid,cacheKey].join(':');if(drag.lastMarker===markerKey)return;drag.lastMarker=markerKey;
   drag.marker.classList.toggle('invalid',!drag.valid);Object.assign(drag.marker.style,{left:(g.left+(p.col-1)*(g.cw+g.cg))+'px',top:(g.top+(p.row-1)*(g.rh+g.rg))+'px',width:(drag.s.cols*g.cw+(drag.s.cols-1)*g.cg)+'px',height:(drag.s.rows*g.rh+(drag.s.rows-1)*g.rg)+'px'});
  }
  screen.addEventListener('pointerdown',e=>{
   if(busy||e.isPrimary===false||e.button>0||!e.target.closest('.home-grid-layout > [data-id]')||e.target.closest('.delete-widget-btn,input,textarea,select,[contenteditable=true]'))return;
   press={target:e.target,pointerId:e.pointerId,clientX:e.clientX,clientY:e.clientY};
   if(isHomeEditMode){e.preventDefault();begin(e);}else timer=setTimeout(()=>{if(!press)return;enterHomeEditMode();begin(press);},700);
  },{signal});
  window.addEventListener('pointermove',e=>{if(press&&Math.hypot(e.clientX-press.clientX,e.clientY-press.clientY)>8&&!drag)clearPress();if(!drag||e.pointerId!==drag.pointer)return;e.preventDefault();drag.moved=drag.moved||Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>2;drag.x=e.clientX;drag.y=e.clientY;if(!paintFrame)paintFrame=requestAnimationFrame(()=>{paintFrame=0;if(!drag)return;drag.ghost.style.setProperty('transform','translate3d('+(drag.x-drag.dx-parseFloat(drag.ghost.style.left))+'px,'+(drag.y-drag.dy-parseFloat(drag.ghost.style.top))+'px,0)','important');locate();});},{passive:false,signal});
  async function end(e,cancelled=false){
   clearPress();if(!drag||e.pointerId!==drag.pointer)return;
   cancelAnimationFrame(paintFrame);paintFrame=0;locate();
   const accepted=!cancelled&&drag.moved&&drag.valid,target=drag.target,id=drag.id,page=Math.round(swiper.scrollLeft/swiper.clientWidth),moved=drag.moved;
   if(moved)suppressClickUntil=performance.now()+300;
   clear();
   if(accepted){const previous={pages:copy(db.homeLayoutPages),positions:copy(db.homeFreePositions),order:copy(db.homeLayoutOrder)};
    while(db.homeLayoutPages.length<=target.pi)db.homeLayoutPages.push([]);
    db.homeLayoutPages=db.homeLayoutPages.map(p=>p.filter(x=>x!==id));db.homeLayoutPages[target.pi].push(id);db.homeFreePositions[id]={row:target.row,col:target.col};db.homeLayoutOrder=db.homeLayoutPages.flat();busy=true;
    refresh(page);
    try{await persist();}catch(error){db.homeLayoutPages=previous.pages;db.homeFreePositions=previous.positions;db.homeLayoutOrder=previous.order;showToast('位置保存失败，已恢复原位置');}finally{busy=false;}
   }else if(moved&&!cancelled)showToast('这里空间不足或已被占用，已回到原位');
   refresh(page);
  }
  window.addEventListener('pointerup',e=>end(e),{signal});window.addEventListener('pointercancel',e=>end(e,true),{signal});
  window.addEventListener('blur',()=>{if(drag){const page=Math.round(swiper.scrollLeft/swiper.clientWidth);clear();refresh(page);}else clearPress();},{signal});
 }
 function consumeClick(e){if(performance.now()<suppressClickUntil&&e.target.closest('.home-screen-swiper')&&!e.target.closest('.home-grid-layout > [data-id]')){suppressClickUntil=0;e.preventDefault();e.stopImmediatePropagation();return true;}return false;}
 window.KissHomeFree={enabled,normalize,decorate,bind,cancelDrag,removeWidget,consumeClick,commitAutoOrder};
})();
