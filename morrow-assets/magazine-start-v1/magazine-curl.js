/* Cached page artwork with a continuous GPU surface and a seam-free 2D fallback. */
(() => {
'use strict';
const clamp=n=>Math.max(0,Math.min(1,n));
const ease=n=>{const t=clamp(n);return t*t*(3-2*t);};

function point(u,v,progress){const p=clamp(progress+.035*Math.sin(Math.PI*progress)*(v-.5)),bend=1.12*Math.sin(Math.PI*p),angle=Math.PI*p-bend*.5;return Math.abs(bend)<1e-5?{x:u*Math.cos(angle),z:u*Math.sin(angle),angle}:{x:(Math.sin(angle+bend*u)-Math.sin(angle))/bend,z:(Math.cos(angle)-Math.cos(angle+bend*u))/bend,angle:angle+bend*u};}
function spread(t){const s=t<.28?1-.5*ease((t-.06)/.22):t<=.72?.5:.5+.5*ease((t-.72)/.28);return {scale:s,x:1-s,y:(1-s)/2};}
function load(name,base){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Magazine image unavailable: '+name));image.src=new URL(name,base).href;});}
function paintPage(kind,w,h,ratio,images){
 const canvas=document.createElement('canvas');canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);const c=canvas.getContext('2d');if(!c)throw Error('Canvas unavailable');c.scale(canvas.width/w,canvas.height/h);c.fillStyle='#fafaf7';c.fillRect(0,0,w,h);
 function image(name,x,y,bw,bh,mode='cover',fy=.5){const im=images[name],s=mode==='contain'?Math.min(bw/im.width,bh/im.height):Math.max(bw/im.width,bh/im.height),dw=im.width*s,dh=im.height*s;c.save();c.beginPath();c.rect(x,y,bw,bh);c.clip();c.drawImage(im,x+(bw-dw)/2,y+(bh-dh)*fy,dw,dh);c.restore();}
 function text(value,x,y,size=9,{serif=false,italic=false,color='#30302d',align='left',line=1.3}={}){c.fillStyle=color;c.textBaseline='top';c.textAlign=align;c.font=`${italic?'italic ':''}400 ${size}px ${serif?'KissStartSerif':'KissStartSans'},${serif?'serif':'sans-serif'}`;String(value).split('\n').forEach((v,i)=>c.fillText(v,x,y+i*size*line));}
 const small=Math.max(8,Math.min(9,w*.022));
 const top=Math.max(h*.04,16),bottom=h-Math.max(h*.035,16);
 if(kind==='cover'){
  image('waves.jpg',0,0,w,h);image('masthead.png',w*.05,h*.05,w*.9,h*.24,'contain');
  text('THE EVERYDAY JOURNAL',w*.07,Math.max(h*.032,12),small);text('VOL. 01',w*.93,Math.max(h*.032,12),small,{align:'right'});
  text('THE PRIVATE ISSUE',w*.07,h*.30,small);text('NO. 01\nOCTOBER 2026',w*.93,h*.30,small,{align:'right',line:1.4});
  const title=w*.087,em=w*.08,y=h*.86-(title*2+em)*.95;
  text('LIFE',w*.07,y,title,{serif:true,color:'#fafaf7',line:.95});text('in the',w*.07,y+title*.95,em,{serif:true,italic:true,color:'#fafaf7'});text('QUIET',w*.07,y+(title+em)*.95,title,{serif:true,color:'#fafaf7'});
  text('THE ART OF EVERYDAY.',w*.07,h-Math.max(h*.048,20),small,{color:'#fafaf7'});text('01 / PERSONAL EDITION',w*.93,h-Math.max(h*.048,20),small,{color:'#fafaf7',align:'right'});
 }else if(kind==='back'){
  text('KISS / FIELD NOTES',w*.07,top,small);text('02',w*.93,top,small,{align:'right'});
  text('FIELD\nNOTES',w*.07,h*.115,w*.12,{line:.92});text('THE PLACES BETWEEN.',w*.07,h*.115+w*.24*.92+12,small);
  image('forest.jpg',w*.07,h*.33,w*.48,h*.35);image('waves.jpg',w*.61,h*.41,w*.32,h*.23,'cover',.8);image('mountains.jpg',w*.5,h*.73,w*.43,h*.16,'cover',.65);
  text('OFF THE MAP.',w*.07,h*.75,small);text('A quiet morning.\nAn unfamiliar road.\nNowhere else to be.',w*.07,h*.75+22,Math.max(10,Math.min(11,w*.029)),{color:'#55554f',line:1.5});
  text('COLLECTED MOMENTS',w*.07,bottom,small);text('02',w*.93,bottom,small,{align:'right'});
 }else{
  text('KISS',w*.07,top,small);text('THE PRIVATE ISSUE / 03',w*.93,top,small,{align:'right'});
  image('mountains.jpg',w*.17,h*.20,w*.66,h*.38,'cover',.58);
  text('PLATE III',w*.17,h*.60,small,{color:'#5e5e57'});text('THE LONG WAY HOME',w*.83,h*.60,small,{color:'#5e5e57',align:'right'});
  text('Elsewhere.',w*.5,h*.72,w*.13,{serif:true,align:'center'});text('There is no hurry.\nLet this moment be enough.',w*.5,h*.84,Math.max(11,Math.min(12,w*.03)),{align:'center',line:1.55,color:'#55554f'});
  text('PERSONAL EDITION',w*.07,bottom,small);text('03',w*.93,bottom,small,{align:'right'});
 }
 return canvas;
}
async function create(root){
 const screen=root.querySelector('.qm-screen');if(!screen)return null;
 let canvas=document.createElement('canvas');
 const gpu=window.KissPaperSurface?.create(canvas)||null;
 if(!gpu)canvas=document.createElement('canvas');
 canvas.className='qm-unified-canvas';canvas.setAttribute('aria-hidden','true');
 const ctx=gpu?null:canvas.getContext('2d',{alpha:false});if(!gpu&&!ctx)return null;
 const names=['waves.jpg','forest.jpg','mountains.jpg','masthead.png'];
 const base=new URL('morrow-assets/magazine-start-v1/',document.baseURI);
 const loaded=await Promise.all([Promise.all(names.map(name=>load(name,base))),document.fonts?Promise.all([document.fonts.load('400 32px KissStartSerif'),document.fonts.load('italic 400 32px KissStartSerif'),document.fonts.load('400 16px KissStartSans')]):Promise.resolve()]);
 if(!root.isConnected||root.dataset.paperDisabled==='true'){gpu?.dispose();return null;}
 const images=Object.fromEntries(names.map((name,i)=>[name,loaded[0][i]]));
 let faces,w,h,ratio,frame=0,disposed=false,started=0,duration=3200,active=false,resolveAnimation,timeline=0;
 function resize(){const rect=screen.getBoundingClientRect();w=Math.max(1,rect.width);h=Math.max(1,rect.height);ratio=Math.min(window.devicePixelRatio||1,1.5,1400/h);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);faces=['cover','back','gallery'].map(kind=>paintPage(kind,w,h,ratio,images));gpu?.upload(faces);draw(timeline);}
 function draw(t){
  if(disposed)return;timeline=t;
  const z=spread(t),p=ease((t*3200-160)/1750),shadow=t>.25&&t<.8?Math.sin(Math.PI*clamp((t-.25)/.55))*.18:0;
  if(gpu){gpu.draw({p,z,shadow});return;}
  // Older devices still draw one complete image per page, never separate strips.
  ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);ctx.fillStyle='#eeede8';ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(z.x*w,z.y*h);ctx.scale(z.scale,z.scale);ctx.drawImage(faces[2],0,0,w,h);
  if(p<=0)ctx.drawImage(faces[0],0,0,w,h);
  else if(p>=1)ctx.drawImage(faces[1],-w,0,w,h);
  else{
   const edge=point(1,.5,p),factor=4.6/(4.6-edge.z),extent=edge.x*factor*w,bw=Math.abs(extent);
   if(bw>.01){const x=Math.min(0,extent),y=(1-factor)*h/2,bh=h*factor;ctx.drawImage(faces[p<.5?0:1],x,y,bw,bh);ctx.fillStyle=`rgba(32,29,23,${.15*(1-Math.abs(Math.cos(Math.PI*p)))})`;ctx.fillRect(x,y,bw,bh);}
  }
  if(shadow){const light=ctx.createLinearGradient(-w*.04,0,w*.08,0);light.addColorStop(0,'rgba(40,38,30,0)');light.addColorStop(.35,`rgba(40,38,30,${shadow})`);light.addColorStop(1,'rgba(40,38,30,0)');ctx.fillStyle=light;ctx.fillRect(-w*.04,0,w*.12,h);}
  ctx.restore();
 }
 function finish(){active=false;cancelAnimationFrame(frame);draw(1);resolveAnimation?.();resolveAnimation=null;}
 function start(ms=3200){if(disposed)return Promise.resolve();duration=ms;started=performance.now();active=true;return new Promise(resolve=>{resolveAnimation=resolve;if(!ms){finish();return;}function tick(now){if(disposed||!active)return;const t=clamp((now-started)/duration);draw(t);if(t<1)frame=requestAnimationFrame(tick);else{active=false;resolveAnimation?.();resolveAnimation=null;}}frame=requestAnimationFrame(tick);});}
 function dispose(){if(disposed)return;disposed=true;active=false;cancelAnimationFrame(frame);window.removeEventListener('resize',resize);gpu?.dispose();canvas.remove();root.classList.remove('is-paper-ready');faces?.forEach(face=>{face.width=face.height=1;});faces=null;canvas.width=canvas.height=1;resolveAnimation?.();resolveAnimation=null;}
 resize();screen.append(canvas);const button=root.querySelector('.qm-open');if(button)screen.append(button);root.dataset.paperRenderer=gpu?.kind||'canvas2d-unified';root.classList.add('is-paper-ready');window.addEventListener('resize',resize);
 return {start,finish,dispose,canvas,seek(value){active=false;cancelAnimationFrame(frame);draw(clamp(value));}};
}
window.KissPaperCurl={point,spread,create};
})();
