/* Desktop placement: coordinates are separate from the existing ordered ID lists. */
(() => {
 'use strict';
 const COLS=4,ROWS=6;
 for(const key of ['homeLayoutMode','homeFreePositions'])if(!globalSettingKeys.includes(key))globalSettingKeys.push(key);
 const enabled=()=>db.homeLayoutMode==='free';
 let drag=null,cleanup=null,busy=false;
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
  if(before!==JSON.stringify([next,positions]))Promise.resolve(saveData()).catch(()=>showToast('桌面位置保存失败，请重试'));
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
   db.homeLayoutMode=next?'free':'auto';await saveData();
   const oldSwiper=document.getElementById('home-screen-swiper'),page=oldSwiper?Math.round(oldSwiper.scrollLeft/oldSwiper.clientWidth):0;setupHomeScreen();enterHomeEditMode();restorePage(page);
   showToast(next?'自由排版已开启，空位会保留':'已切回自动排列');
  }catch(error){db.homeLayoutMode=previous.mode;db.homeFreePositions=previous.positions;db.homeLayoutPages=previous.pages;db.homeLayoutOrder=previous.order;showToast('排版设置保存失败，请重试');}
  finally{busy=false;}
 }
 function restorePage(page){const swiper=document.getElementById('home-screen-swiper');if(swiper){const index=Math.max(0,Math.min(page,swiper.children.length-1));swiper.scrollTo({left:swiper.clientWidth*index,behavior:'instant'});updatePageIndicator(index);}}
 function decorate(signal){
  if(cleanup){cleanup();cleanup=null;}
  const dock=document.querySelector('#home-screen .dock-edit');
  if(dock){const button=document.createElement('button');button.id='home-layout-mode-btn';button.type='button';button.textContent=enabled()?'自由排版 · 开':'自由排版 · 关';button.setAttribute('aria-pressed',String(enabled()));button.title='开启后保留空位；关闭后自动排列';button.onclick=toggle;dock.insertBefore(button,document.getElementById('finish-edit-btn'));}
  if(!enabled())return;
  document.querySelectorAll('#home-screen .home-grid-layout').forEach(grid=>{grid.classList.add('home-free-grid');for(const el of grid.querySelectorAll(':scope > [data-id]')){const p=db.homeFreePositions?.[el.dataset.id],s=size(el);if(valid(p,s)){el.style.gridColumn=p.col+' / span '+s.cols;el.style.gridRow=p.row+' / span '+s.rows;}}});
 }
 function cancelDrag(){if(cleanup)cleanup();}
 function bind(signal){
  const screen=document.getElementById('home-screen'),swiper=document.getElementById('home-screen-swiper');
  let timer=0,press=null,edgeTimer=0,lastFlip=0;
  const clearPress=()=>{clearTimeout(timer);timer=0;press=null;};
  const clear=()=>{clearPress();clearInterval(edgeTimer);edgeTimer=0;if(drag){drag.item.classList.remove('home-free-source');drag.ghost.remove();drag.marker.remove();drag=null;}swiper.style.scrollSnapType='x mandatory';swiper.style.scrollBehavior='';};
  cleanup=clear;signal.addEventListener('abort',clear,{once:true});
  function addPage(){const pi=swiper.children.length,page=document.createElement('div');page.className='home-screen-page';page.innerHTML='<div class="home-grid-layout home-free-grid edit-mode" id="home-grid-layout-'+(pi+1)+'" style="min-height:500px"></div>';swiper.append(page);const dot=document.createElement('span');dot.className='dot';screen.querySelector('.page-indicator')?.append(dot);}
  function begin(e){
   const item=e.target.closest('.home-grid-layout > [data-id]');if(!item)return;
   const rect=item.getBoundingClientRect(),ghost=item.cloneNode(true),marker=document.createElement('div'),g=geometry(item.parentElement);
   ghost.removeAttribute('id');ghost.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));ghost.classList.add('home-free-ghost');Object.assign(ghost.style,{width:rect.width+'px',height:rect.height+'px',left:rect.left+'px',top:rect.top+'px'});marker.className='home-free-target';document.body.append(marker,ghost);item.classList.add('home-free-source');
   drag={item,ghost,marker,id:item.dataset.id,pointer:e.pointerId,s:size(item),x:e.clientX,y:e.clientY,dx:e.clientX-rect.left,dy:e.clientY-rect.top,grabCol:Math.floor((e.clientX-rect.left)/(g.cw+g.cg)),grabRow:Math.floor((e.clientY-rect.top)/(g.rh+g.rg)),target:null,valid:false,moved:false};
   swiper.style.scrollSnapType='none';swiper.style.scrollBehavior='auto';if(swiper.children.length<100)addPage();
   edgeTimer=setInterval(()=>{if(!drag?.moved)return;const now=Date.now(),r=swiper.getBoundingClientRect(),activePage=swiper.children[Math.round(swiper.scrollLeft/swiper.clientWidth)];if(activePage&&drag.y>=r.top&&drag.y<=r.bottom){const step=drag.y<r.top+24?-12:drag.y>r.bottom-24?12:0;if(step){activePage.scrollTop+=step;locate();}}if(now-lastFlip<650)return;const current=Math.round(swiper.scrollLeft/swiper.clientWidth),delta=drag.x<r.left+28?-1:drag.x>r.right-28?1:0,next=current+delta;if(delta&&next>=0&&next<swiper.children.length){swiper.scrollLeft=next*swiper.clientWidth;lastFlip=now;locate();}},80);
   locate();
  }
  function locate(){
   if(!drag)return;const pi=Math.round(swiper.scrollLeft/swiper.clientWidth),grid=swiper.children[pi]?.querySelector('.home-grid-layout');if(!grid)return;
   const g=geometry(grid),p={row:Math.floor((drag.y-g.top+g.rg/2)/(g.rh+g.rg))+1-drag.grabRow,col:Math.floor((drag.x-g.left+g.cg/2)/(g.cw+g.cg))+1-drag.grabCol};
   const occupied=empty();for(const el of grid.querySelectorAll(':scope > [data-id]'))if(el!==drag.item){const q=db.homeFreePositions[el.dataset.id],s=size(el);if(valid(q,s))occupy(occupied,q,s);}
   const r=grid.getBoundingClientRect(),viewport=swiper.getBoundingClientRect();drag.valid=drag.y>=viewport.top&&drag.y<=viewport.bottom&&drag.x>=r.left&&drag.x<=r.right&&drag.y>=r.top&&drag.y<=r.bottom&&fits(occupied,p,drag.s);drag.target={pi,...p};
   drag.marker.classList.toggle('invalid',!drag.valid);Object.assign(drag.marker.style,{left:(g.left+(p.col-1)*(g.cw+g.cg))+'px',top:(g.top+(p.row-1)*(g.rh+g.rg))+'px',width:(drag.s.cols*g.cw+(drag.s.cols-1)*g.cg)+'px',height:(drag.s.rows*g.rh+(drag.s.rows-1)*g.rg)+'px'});
  }
  screen.addEventListener('pointerdown',e=>{
   if(busy||e.isPrimary===false||e.button>0||!e.target.closest('.home-grid-layout > [data-id]')||e.target.closest('.delete-widget-btn,input,textarea,select,[contenteditable=true]'))return;
   press={target:e.target,pointerId:e.pointerId,clientX:e.clientX,clientY:e.clientY};
   if(isHomeEditMode){e.preventDefault();begin(e);}else timer=setTimeout(()=>{if(!press)return;enterHomeEditMode();begin(press);},700);
  },{signal});
  window.addEventListener('pointermove',e=>{if(press&&Math.hypot(e.clientX-press.clientX,e.clientY-press.clientY)>8&&!drag)clearPress();if(!drag||e.pointerId!==drag.pointer)return;e.preventDefault();drag.moved=drag.moved||Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>2;drag.x=e.clientX;drag.y=e.clientY;Object.assign(drag.ghost.style,{left:(e.clientX-drag.dx)+'px',top:(e.clientY-drag.dy)+'px'});locate();},{passive:false,signal});
  async function end(e,cancelled=false){
   clearPress();if(!drag||e.pointerId!==drag.pointer)return;
   const accepted=!cancelled&&drag.moved&&drag.valid,target=drag.target,id=drag.id,page=Math.round(swiper.scrollLeft/swiper.clientWidth),moved=drag.moved;
   clear();
   if(accepted){const previous={pages:copy(db.homeLayoutPages),positions:copy(db.homeFreePositions),order:copy(db.homeLayoutOrder)};
    while(db.homeLayoutPages.length<=target.pi)db.homeLayoutPages.push([]);
    db.homeLayoutPages=db.homeLayoutPages.map(p=>p.filter(x=>x!==id));db.homeLayoutPages[target.pi].push(id);db.homeFreePositions[id]={row:target.row,col:target.col};db.homeLayoutOrder=db.homeLayoutPages.flat();busy=true;
    try{await saveData();}catch(error){db.homeLayoutPages=previous.pages;db.homeFreePositions=previous.positions;db.homeLayoutOrder=previous.order;showToast('位置保存失败，已恢复原位置');}finally{busy=false;}
   }else if(moved&&!cancelled)showToast('这里空间不足或已被占用，已回到原位');
   setupHomeScreen();enterHomeEditMode();restorePage(page);
  }
  window.addEventListener('pointerup',e=>end(e),{signal});window.addEventListener('pointercancel',e=>end(e,true),{signal});
  window.addEventListener('blur',()=>{if(drag){clear();setupHomeScreen();enterHomeEditMode();}else clearPress();},{signal});
 }
 window.KissHomeFree={enabled,normalize,decorate,bind,cancelDrag};
})();
