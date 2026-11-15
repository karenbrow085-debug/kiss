/* Refraction uses ordinary SVG filters on an isolated copy of the visible scene.
   This also works on WebKit, without relying on SVG backdrop-filter support. */
(() => {
'use strict';
let instanceId=0;
function lensVector(x,y,w,h,r){
 const px=x-w/2,py=y-h/2,qx=Math.abs(px)-(w/2-r),qy=Math.abs(py)-(h/2-r),ox=Math.max(qx,0),oy=Math.max(qy,0),length=Math.hypot(ox,oy);
 const distance=length+Math.min(Math.max(qx,qy),0)-r;
 let nx=0,ny=0;if(length>0){nx=ox/length*Math.sign(px);ny=oy/length*Math.sign(py);}else if(qx>qy)nx=Math.sign(px);else ny=Math.sign(py);
 const edge=Math.min(11,r*.8),bend=Math.pow(Math.max(0,Math.min(1,1+distance/edge)),1.7);
 return [-nx*bend,-ny*bend];
}
function luminance(data){let sum=0,weight=0;for(let i=0;i<data.length;i+=4){if(data[i+3]<128)continue;sum+=(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2])/255;weight++;}return weight?sum/weight:1;}
function create({host,root}){
 const doc=host.ownerDocument,ns='http://www.w3.org/2000/svg',uid='ki-lens-'+(++instanceId)+'-',maps=new Map(),records=new Map();let frame=0,disposed=false,background='',image=null;
 const svg=doc.createElementNS(ns,'svg');svg.setAttribute('aria-hidden','true');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.classList.add('liquid-definitions');const defs=doc.createElementNS(ns,'defs');svg.append(defs);root.append(svg);
 const element=(tag,attrs)=>{const n=doc.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
 function shader(w,h,r){
  const key=[w,h,Math.round(r)].join('-');if(maps.has(key))return maps.get(key);
  const canvas=doc.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(!ctx)return null;const pixels=ctx.createImageData(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const [dx,dy]=lensVector(x+.5,y+.5,w,h,r),i=(y*w+x)*4;pixels.data[i]=128+dx*118;pixels.data[i+1]=128+dy*118;pixels.data[i+2]=128;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);
  const id=uid+maps.size,f=element('filter',{id,filterUnits:'userSpaceOnUse',primitiveUnits:'userSpaceOnUse',x:-20,y:-20,width:w+40,height:h+40,'color-interpolation-filters':'sRGB'});
  f.append(element('feImage',{href:canvas.toDataURL(),x:0,y:0,width:w,height:h,preserveAspectRatio:'none',result:'lensMap'}),element('feGaussianBlur',{in:'SourceGraphic',stdDeviation:1.6,result:'softScene'}),element('feDisplacementMap',{in:'softScene',in2:'lensMap',scale:17,xChannelSelector:'R',yChannelSelector:'G'}));defs.append(f);maps.set(key,id);return id;
 }
 function capture(record,rect,surfaceRect,rows){
  const sx=rect.left-surfaceRect.left,sy=rect.top-surfaceRect.top;
  const wall=record.wall;wall.style.width=surfaceRect.width+'px';wall.style.height=surfaceRect.height+'px';wall.style.left=-sx+'px';wall.style.top=-sy+'px';wall.style.backgroundImage=background?'url('+JSON.stringify(background)+')':'none';
  const visible=rows.filter(({r})=>r.bottom>rect.top-18&&r.top<rect.bottom+18&&r.right>rect.left-18&&r.left<rect.right+18).slice(0,12),keep=new Set(visible.map(o=>o.node));
  for(const [node,copy]of record.rows)if(!keep.has(node)){copy.remove();record.rows.delete(node);}
  for(const {node,r}of visible){let copy=record.rows.get(node);if(!copy){copy=node.cloneNode(true);copy.querySelectorAll('.liquid-optics,script,style,iframe,video').forEach(n=>n.remove());copy.classList.add('liquid-row-copy');copy.setAttribute('aria-hidden','true');copy.querySelectorAll('button,input,textarea,a').forEach(n=>n.tabIndex=-1);record.rows.set(node,copy);record.lens.append(copy);}copy.style.setProperty('position','absolute');copy.style.setProperty('left',(r.left-rect.left)+'px');copy.style.setProperty('top',(r.top-rect.top)+'px');copy.style.setProperty('width',r.width+'px');copy.style.setProperty('margin','0','important');}
 }
 function update(){
  frame=0;if(disposed||!host.isConnected)return;const surface=root.querySelector('.surface'),history=root.querySelector('.history');if(!surface||!history)return;const sr=surface.getBoundingClientRect();if(!sr.width||!sr.height)return;
  const rows=[...history.children].map(node=>({node,r:node.getBoundingClientRect()})).filter(({r})=>r.bottom>sr.top&&r.top<sr.bottom);
  const glass=[...root.querySelectorAll('.glass')].filter(n=>!n.closest('.liquid-optics,.tools,.menu-layer,.reply-focus'));
  for(const target of glass){const r=target.getBoundingClientRect();if(r.width<8||r.height<8||r.bottom<sr.top||r.top>sr.bottom)continue;let record=records.get(target);
   if(!record){const optics=doc.createElement('span');optics.className='liquid-optics';optics.setAttribute('aria-hidden','true');const lens=doc.createElement('span');lens.className='liquid-lens';const wall=doc.createElement('span');wall.className='liquid-wallpaper';lens.append(wall);optics.append(lens);target.prepend(optics);record={optics,lens,wall,rows:new Map(),size:''};records.set(target,record);}
   const w=Math.round(r.width),h=Math.round(r.height),style=getComputedStyle(target),radius=style.borderTopLeftRadius.includes('%')?Math.min(w,h)/2:Math.min(parseFloat(style.borderTopLeftRadius)||20,w/2,h/2),key=[w,h,radius].join('-');
   if(key!==record.size){const id=shader(w,h,radius);if(!id)continue;record.lens.style.filter='url("#'+id+'")';record.lens.style.width=w+'px';record.lens.style.height=h+'px';record.size=key;target.setAttribute('data-liquid-ready','');}
   capture(record,r,sr,rows);
  }
  for(const [target,record]of records)if(!target.isConnected){record.optics.remove();records.delete(target);}
 }
 function schedule(){if(!disposed&&!frame)frame=requestAnimationFrame(update);}
 function setBackground(src){
  src=src||'';if(background===src)return;background=src;host.removeAttribute('dark-backdrop');if(image){image.onload=image.onerror=null;image=null;}schedule();if(!src)return;
  const probe=new Image();image=probe;if(/^https?:/i.test(src))probe.crossOrigin='anonymous';probe.onload=()=>{if(disposed||background!==src)return;try{const canvas=doc.createElement('canvas');canvas.width=24;canvas.height=40;const ctx=canvas.getContext('2d');ctx.drawImage(probe,0,0,24,40);host.toggleAttribute('dark-backdrop',luminance(ctx.getImageData(0,0,24,40).data)<.48);}catch{}schedule();};probe.onerror=()=>schedule();probe.src=src;
 }
 const history=root.querySelector('.history');history?.addEventListener('scroll',schedule,{passive:true});root.addEventListener('load',schedule,true);window.addEventListener('resize',schedule);
 const resize=typeof ResizeObserver!=='undefined'?new ResizeObserver(schedule):null;resize?.observe(root.querySelector('.surface'));schedule();
 return {schedule,setBackground,dispose(){disposed=true;cancelAnimationFrame(frame);resize?.disconnect();history?.removeEventListener('scroll',schedule);root.removeEventListener('load',schedule,true);window.removeEventListener('resize',schedule);if(image)image.onload=image.onerror=null;for(const [target,r]of records){target.removeAttribute('data-liquid-ready');r.optics.remove();}records.clear();svg.remove();}};
}
window.KissIMessageLiquid={create,lensVector,luminance};
})();
