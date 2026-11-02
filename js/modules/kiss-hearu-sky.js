/* Approved HearU previews, transferred without changing the drawing functions. */
(function(root){'use strict';
const bridge=()=>root.KissTogether;
const host=()=>document.querySelector('.phone-screen') || document.body;
const base=new URL('../../',document.currentScript.src);
const moonURL=new URL('assets/hearu/moon-soft.webp',base).href;
let sequence=0,currentCancel=null,floating=null,floatCleanup=null,lastSession=null,latest=null,animationBusy=false;
const imageCache=new Map();
function loadImage(src){if(imageCache.has(src))return imageCache.get(src);const promise=new Promise(resolve=>{const image=new Image();let settled=false;const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};const fallback=()=>{if(src.endsWith('assets/hearu.svg'))finish(image);else loadImage(new URL('assets/hearu.svg',base).href).then(finish);};const timer=setTimeout(fallback,5000);image.onload=()=>finish(image);image.onerror=fallback;image.src=src;});if(imageCache.size>40)imageCache.clear();imageCache.set(src,promise);return promise;}
const FLOAT_MARKUP="  <aside class=\"mm-player\" id=\"kt-current-track\" aria-label=\"当前播放\" hidden>\n   <canvas class=\"mm-system-canvas\" aria-label=\"双人头像在银色星系中环绕\" role=\"img\"></canvas>\n   <div class=\"mm-track-name\">My star me n u&lt;3m</div>\n   <div class=\"mm-track-artist\">ra2it</div>\n   <div class=\"mm-playback\"><button class=\"mm-previous\" aria-label=\"上一首\"><span data-kt-icon=\"skip-back\"></span></button><button class=\"mm-pause\" aria-label=\"暂停\"><span data-kt-icon=\"pause\"></span></button><button class=\"mm-next\" aria-label=\"下一首\"><span data-kt-icon=\"skip-forward\"></span></button><button class=\"mm-collapse\" aria-label=\"收起当前播放\"><span data-kt-icon=\"x\"></span></button></div>\n  <button class=\"kt-role-hit\" aria-label=\"点击角色头像结束一起听\"></button><button class=\"kt-user-hit\" aria-label=\"点击用户头像打开HearU播放页\"></button></aside>\n  <button class=\"mm-ball\" aria-label=\"展开星系播放器\" aria-expanded=\"false\" aria-controls=\"kt-current-track\"><canvas class=\"mm-mini-galaxy\" aria-hidden=\"true\"></canvas><span class=\"mm-float-pair\" hidden><img data-image=\"a\" alt=\"对方头像\"><img data-image=\"b\" alt=\"我的头像\"></span><span class=\"mm-wave\" hidden></span></button>\n";
const paths={play:'<path d="m9 5 11 7-11 7Z"/>',pause:'<path d="M9 5v14M15 5v14"/>','skip-back':'<path d="M19 20 9 12l10-8v16ZM5 19V5"/>','skip-forward':'<path d="m5 4 10 8-10 8V4ZM19 5v14"/>',x:'<path d="m6 6 12 12M18 6 6 18"/>'};
function icons(el){for(const n of el.querySelectorAll('[data-kt-icon]')){const name=n.dataset.ktIcon;n.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||'')+'</svg>';}}
function acceptAnimation(stage,images,done){const root=stage,phone=stage,canvas=stage.querySelector('canvas'),ctx=canvas.getContext('2d');
const clamp=v=>Math.max(0,Math.min(1,v)),smoother=v=>{v=clamp(v);return v*v*v*(v*(v*6-15)+10)},mix=(a,b,t)=>a+(b-a)*t,tau=Math.PI*2;
 let width=374,last=5.8,frame=0,start=0,playing=false,tipTimer;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function dot(x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,tau);ctx.fillStyle=color;ctx.fill()}
 function bloom(x,y,r,color,alpha=1){ctx.save();ctx.globalAlpha*=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(.28,color);g.addColorStop(1,'rgba(230,207,198,0)');dot(x,y,r,g);ctx.restore()}
 function point(cx,cy,rx,ry,a,tilt,t){const x=Math.cos(a)*rx,y=Math.sin(a)*ry+Math.sin(a*2+t*.2)*2;return{x:cx+x*Math.cos(tilt)-y*Math.sin(tilt),y:cy+x*Math.sin(tilt)+y*Math.cos(tilt)}}
 function ribbon(cx,cy,rx,ry,tilt,t,front){
   const begin=front?0:Math.PI,end=front?Math.PI:tau;
   for(let layer=0;layer<3;layer++){
     const top=[],bottom=[];const wide=[12,6,2.5][layer];
     for(let i=0;i<=100;i++){const a=mix(begin,end,i/100);const p=point(cx,cy,rx,ry,a,tilt,t);const q=point(cx,cy,rx,ry,a+.003,tilt,t);const dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1;const taper=Math.pow(Math.sin(i/100*Math.PI),.7);const w=wide*taper*(.65+.35*Math.sin(a*1.7-t*.35)**2);top.push({x:p.x-dy/len*w,y:p.y+dx/len*w});bottom.push({x:p.x+dy/len*w,y:p.y-dx/len*w})}
     const gradient=ctx.createLinearGradient(cx-rx,cy+20,cx+rx,cy-20);
     gradient.addColorStop(0,'rgba(204,171,167,0)');gradient.addColorStop(.23,'rgba(202,176,192,'+[.14,.23,.36][layer]+')');gradient.addColorStop(.52,'rgba(236,213,195,'+[.18,.35,.57][layer]+')');gradient.addColorStop(.72,'rgba(205,190,215,'+[.12,.24,.35][layer]+')');gradient.addColorStop(1,'rgba(230,211,197,0)');
     ctx.save();ctx.filter='blur('+[5,2,1][layer]+'px)';ctx.fillStyle=gradient;ctx.beginPath();top.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));bottom.reverse().forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.restore();
   }
   for(let i=0;i<38;i++){const a=begin+((i*.6180339+t*.024)%1)*Math.PI;const p=point(cx,cy,rx+(i%5-2)*2,ry+(i%3-1)*2,a,tilt,t);const alpha=(.12+.3*Math.sin(i+t*.6)**2)*Math.sin((a-begin)*1);bloom(p.x,p.y,2+(i%4),'rgba(209,183,201,.28)',alpha);if(i%5===0)dot(p.x,p.y,.7,'rgba(222,198,178,'+alpha+')')}
 }
 function avatar(x,y,r,img,alpha,t,phase){ctx.save();ctx.globalAlpha*=alpha;bloom(x,y,r*1.9,'rgba(218,198,208,.11)');
   // Short diffused moving wisps, with no permanent avatar outline.
   for(let trail=0;trail<2;trail++){const head=t*.85+phase+trail*Math.PI;for(let j=0;j<18;j++){const tail=1-j/18,a=head-j*.026;const rad=r+6+Math.sin(a*2+t*.45)*1.6;const px=x+Math.cos(a)*rad,py=y+Math.sin(a)*rad;ctx.save();ctx.globalAlpha*=tail*.55;ctx.filter='blur(1.1px)';dot(px,py,.65+tail*.85,trail?'rgba(203,180,204,.38)':'rgba(232,205,178,.6)');ctx.restore()}const hx=x+Math.cos(head)*(r+6),hy=y+Math.sin(head)*(r+6);bloom(hx,hy,4,'rgba(235,213,194,.24)')}
   ctx.beginPath();ctx.arc(x,y,r,0,tau);ctx.clip();if(img.complete&&img.naturalWidth)ctx.drawImage(img,x-r,y-r,r*2,r*2);const g=ctx.createLinearGradient(x,y-r,x,y+r);g.addColorStop(0,'rgba(250,232,220,.1)');g.addColorStop(1,'rgba(207,190,213,.07)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore()}
 function render(t){last=t;ctx.clearRect(0,0,width,340);const opacity=smoother(t/1.8),travel=smoother((t-9)/1.5),handoff=smoother((t-10.35)/.25),sceneFade=1-smoother((t-8.9)/1.45);const floating=root.querySelector('.mm-ball');floating.style.opacity=String(smoother((t-9.9)/.6));floating.style.pointerEvents=t>=10.5?'auto':'none';root.querySelector('.mm-float-pair').style.opacity=String(handoff);root.querySelector('.mm-wave').style.opacity=String(handoff);if(opacity<.001||t>=10.65)return;ctx.save();ctx.globalAlpha=opacity;
 const cx=width/2,cy=145;const enter=smoother(t/3.2),settle=smoother((t-.5)/6.3);const breathe=Math.sin((t-2)*tau/4.5);const pulse=Math.exp(-Math.pow(((t-3.3)%2.2)/.18,2))+.4*Math.exp(-Math.pow((((t-3.3)%2.2)-.29)/.23,2));
 ctx.translate(cx,cy+mix(12,0,enter));ctx.scale(mix(.91,1,enter),mix(.91,1,enter));ctx.translate(-cx,-cy);
 ctx.save();ctx.globalAlpha*=sceneFade;
 bloom(cx,cy,137,'rgba(239,222,212,.14)');bloom(cx-35,cy-26,95,'rgba(248,228,212,.12)');
 for(let i=0;i<25;i++){const a=i*2.39996+t*.012;const r=89+i*13%65;const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*.65;bloom(x,y,2+(i%3),'rgba(204,177,197,.17)',(.3+.4*Math.sin(i+t*.4)**2)*smoother((t-.5)/2))}
 const rx=Math.min(width*.36,134),ry=46+Math.sin(t*.3)*2,tilt=-.28+Math.sin(t*.2)*.025;
 const revolution=smoother((t-.8)/5.9),embrace=smoother((t-6.7)/1.6);
 const a1=3.65+tau*revolution,a2=3.65-Math.PI+tau*revolution;
 const orbit1=point(cx,cy+17,rx,ry,a1,tilt,t),orbit2=point(cx,cy+17,rx,ry,a2,tilt,t);
 const contact=smoother((t-6.7)/1.2),nest=smoother((t-7.9)/.65);
 const separation=22-7*nest+Math.sin(clamp((t-7.9)/.65)*Math.PI)*1.3;
 const base1={x:mix(orbit1.x,cx-separation,contact),y:mix(orbit1.y,cy+77,contact)};
 const base2={x:mix(orbit2.x,cx+separation,contact),y:mix(orbit2.y,cy+77,contact)};
 const p1={x:mix(base1.x,width-65,travel),y:mix(base1.y,209,travel)};
 const p2={x:mix(base2.x,width-45,travel),y:mix(base2.y,209,travel)};
 const av=smoother((t-.8)/1.8);
 const portraits=[{p:p1,img:images.a,phase:0,front:t>=6.7||Math.sin(a1)>=0},{p:p2,img:images.b,phase:1.8,front:t>=6.7||Math.sin(a2)>=0}];
 ribbon(cx,cy+17,rx,ry,tilt,t,false);
 portraits.filter(person=>!person.front).forEach(person=>avatar(person.p.x,person.p.y,22,person.img,av,t,person.phase));
 const moon=images.moon;ctx.save();ctx.translate(cx,cy-7+breathe*1.1);ctx.rotate(-.1+Math.sin(t*.15)*.024);const moonSize=176*(1+Math.sin(t*.8)*.005);ctx.shadowColor='rgba(190,164,151,.08)';ctx.shadowBlur=20;if(moon.complete&&moon.naturalWidth)ctx.drawImage(moon,-moonSize/2,-moonSize/2,moonSize,moonSize);ctx.restore();
 // The heartbeat lives in softly expanding light rather than a geometric outline.
 if(t>3.3){for(let i=0;i<2;i++){const age=((t-3.3+i*1.1)%2.2)/2.2;const radius=80+age*50;ctx.save();ctx.globalAlpha*=Math.pow(1-age,2)*.6;const g=ctx.createRadialGradient(cx,cy,radius*.67,cx,cy,radius);g.addColorStop(0,'rgba(227,197,205,0)');g.addColorStop(.58,'rgba(230,204,201,.1)');g.addColorStop(.77,'rgba(225,201,213,.14)');g.addColorStop(1,'rgba(230,211,204,0)');dot(cx,cy,radius,g);ctx.restore()}}
 ribbon(cx,cy+17,rx,ry,tilt,t,true);
 ctx.restore();
 portraits.filter(person=>person.front).forEach(person=>avatar(person.p.x,person.p.y,mix(22,15,travel),person.img,av*(1-handoff),t,person.phase));
 ctx.save();ctx.globalAlpha*=sceneFade;
 bloom(cx-38,cy-62,11,'rgba(255,243,224,.22)',.6+.2*breathe);bloom(cx+26,cy+67,18,'rgba(225,199,217,.12)',pulse);
 ctx.globalAlpha*=smoother((t-2.7)/2.1);ctx.textAlign='center';ctx.fillStyle='#a08b91';ctx.font='14px -apple-system,BlinkMacSystemFont,"Hiragino Mincho ProN","Noto Serif JP",serif';ctx.fillText('同じ月、同じメロディー。',cx,274);ctx.font='italic 11px Georgia,serif';ctx.fillStyle='#b19ba3';ctx.fillText('きみと、ここで。',cx,295);ctx.restore();ctx.restore();
 }
 function resize(){width=phone.clientWidth;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=340*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);render(last)}
 function loop(now){if(!playing)return;const t=(now-start)/1000;render(t);if(t<11.4)frame=requestAnimationFrame(loop);else{playing=false;render(12);root.querySelector('.mm-replay span').textContent='重播接受动画';done()}}
 function play(){cancelAnimationFrame(frame);if(reduced){render(5.8);return}start=performance.now();playing=true;frame=requestAnimationFrame(loop);root.querySelector('.mm-replay span').textContent='重新播放'}

const observer=new ResizeObserver(resize);observer.observe(phone);resize();play();return()=>{cancelAnimationFrame(frame);playing=false;observer.disconnect();};
}
function endAnimation(stage,images,done){const root=stage,phone=stage,canvas=stage.querySelector('canvas'),ctx=canvas.getContext('2d'),button=stage.querySelector('.mm-end-listening'),pics=images;const layer=document.createElement('canvas');layer.width=240;layer.height=240;const lx=layer.getContext('2d');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,TAU=Math.PI*2;
const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{v=clamp(v);return v*v*v*(v*(v*6-15)+10)},mix=(a,b,v)=>a+(b-a)*v;
let width=374,raf=0,start=0,active=false,last=0;
function rand(n){const k=Math.sin(n*127.1+311.7)*43758.5453;return k-Math.floor(k)}
function dot(x,y,r,color){ctx.beginPath();ctx.arc(x,y,Math.max(.05,r),0,TAU);ctx.fillStyle=color;ctx.fill()}
function glow(x,y,r,alpha,warm=false){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,warm?'rgba(236,213,183,'+alpha+')':'rgba(209,187,217,'+alpha+')');g.addColorStop(1,'rgba(240,221,230,0)');dot(x,y,r,g)}
let moonPixels=null,moonRanks=null;
function moon(progress,t){
 if(!moonPixels){lx.clearRect(0,0,240,240);lx.save();lx.translate(120,120);lx.rotate(-.09);lx.drawImage(pics.moon,-88,-88,176,176);lx.restore();moonPixels=lx.getImageData(0,0,240,240);moonRanks=new Float32Array(240*240);for(let y=0;y<240;y++){for(let x=0;x<240;x++){const u=(x-120)/88,v=(y-120)/88;moonRanks[y*240+x]=.5-u*.34+v*.24+Math.sin(x*.035+y*.049)*.045}}}
 if(progress<=0){lx.putImageData(moonPixels,0,0);return}
 const image=lx.createImageData(240,240);image.data.set(moonPixels.data);for(let i=0;i<moonRanks.length;i++){const index=i*4+3;if(!image.data[index])continue;image.data[index]*=1-smooth((progress*1.28-moonRanks[i])/.34)}lx.putImageData(image,0,0);
}
function portrait(img,x,y,opacity){if(opacity<.002)return;ctx.save();ctx.globalAlpha=opacity;glow(x,y,29,.08);ctx.beginPath();ctx.arc(x,y,21,0,TAU);ctx.clip();ctx.drawImage(img,x-21,y-21,42,42);ctx.restore()}
const tau=TAU;
function bloom(x,y,r,color,alpha=1){ctx.save();ctx.globalAlpha*=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(.28,color);g.addColorStop(1,'rgba(230,207,198,0)');dot(x,y,r,g);ctx.restore()}
 function point(cx,cy,rx,ry,a,tilt,t){const x=Math.cos(a)*rx,y=Math.sin(a)*ry+Math.sin(a*2+t*.2)*2;return{x:cx+x*Math.cos(tilt)-y*Math.sin(tilt),y:cy+x*Math.sin(tilt)+y*Math.cos(tilt)}}
 function ribbon(cx,cy,rx,ry,tilt,t,front){
   const begin=front?0:Math.PI,end=front?Math.PI:tau;
   for(let layer=0;layer<3;layer++){
     const top=[],bottom=[];const wide=[12,6,2.5][layer];
     for(let i=0;i<=100;i++){const a=mix(begin,end,i/100);const p=point(cx,cy,rx,ry,a,tilt,t);const q=point(cx,cy,rx,ry,a+.003,tilt,t);const dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1;const taper=Math.pow(Math.sin(i/100*Math.PI),.7);const w=wide*taper*(.65+.35*Math.sin(a*1.7-t*.35)**2);top.push({x:p.x-dy/len*w,y:p.y+dx/len*w});bottom.push({x:p.x+dy/len*w,y:p.y-dx/len*w})}
     const gradient=ctx.createLinearGradient(cx-rx,cy+20,cx+rx,cy-20);
     gradient.addColorStop(0,'rgba(204,171,167,0)');gradient.addColorStop(.23,'rgba(202,176,192,'+[.14,.23,.36][layer]+')');gradient.addColorStop(.52,'rgba(236,213,195,'+[.18,.35,.57][layer]+')');gradient.addColorStop(.72,'rgba(205,190,215,'+[.12,.24,.35][layer]+')');gradient.addColorStop(1,'rgba(230,211,197,0)');
     ctx.save();ctx.filter='blur('+[5,2,1][layer]+'px)';ctx.fillStyle=gradient;ctx.beginPath();top.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));bottom.reverse().forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.restore();
   }
   for(let i=0;i<38;i++){const a=begin+((i*.6180339+t*.024)%1)*Math.PI;const p=point(cx,cy,rx+(i%5-2)*2,ry+(i%3-1)*2,a,tilt,t);const alpha=(.12+.3*Math.sin(i+t*.6)**2)*Math.sin((a-begin)*1);bloom(p.x,p.y,2+(i%4),'rgba(209,183,201,.28)',alpha);if(i%5===0)dot(p.x,p.y,.7,'rgba(222,198,178,'+alpha+')')}
 }
 
function draw(t){last=t;ctx.clearRect(0,0,width,340);const enter=smooth(t/1.1),dissolve=smooth((t-2.15)/2.9),breathe=Math.sin(t*1.3),fade=1-smooth((t-5.2)/1.35);
 const cx=mix(width-49,width/2,enter),cy=mix(209,151,enter);const scale=mix(.54,1,enter);ctx.save();ctx.translate(cx,cy);ctx.scale(scale,scale);ctx.translate(-cx,-cy);
 const orbitFade=enter*(1-smooth((t-4.35)/1.7));
 const rx=Math.min(width*.36,134),ry=46+Math.sin(t*.3)*2,tilt=-.28+Math.sin(t*.2)*.025;
 glow(cx-13,cy-14,110,.055*enter*fade,true);
 ctx.save();ctx.globalAlpha*=orbitFade;ribbon(cx,cy+17,rx,ry,tilt,t,false);ctx.restore();
 moon(dissolve,t);ctx.save();ctx.globalAlpha=enter*(1-smooth((t-4.7)/.65));ctx.drawImage(layer,cx-120,cy-127+breathe*.4);ctx.restore();
 ctx.save();ctx.globalAlpha*=orbitFade;ribbon(cx,cy+17,rx,ry,tilt,t,true);ctx.restore();
 // A small amount of luminous dust leaves only the dissolving edge, never the intact body.
 for(let i=0;i<140;i++){
  const born=2.2+rand(i+41)*2.7,age=t-born;if(age<=0||age>=2.1)continue;const q=smooth((born-2.15)/2.9),edge=mix(160,-160,q),across=(rand(i+82)-.5)*132;const localX=edge,localY=across;if(Math.hypot(localX,localY)>79)continue;
  const tilt=-.64,px=cx+localX*Math.cos(tilt)-localY*Math.sin(tilt),py=cy-7+localX*Math.sin(tilt)+localY*Math.cos(tilt);
  const drift=age*(9+rand(i+124)*12),x=px+drift,y=py-age*(12+rand(i+166)*13)-age*age*2;const opacity=Math.sin(Math.min(1,age/2.1)*Math.PI)*.24;
  ctx.save();ctx.globalAlpha=opacity;glow(x,y,2.5+rand(i+208)*2,.18,i%2===0);if(i%4===0)dot(x,y,.25+rand(i+250)*.35,'#d0b7cc');ctx.restore();
 }
 // Thin translucent wisps follow the released moonlight, with no granular surface breakup.
 for(let j=0;j<3;j++){const life=clamp((t-2.65-j*.28)/2.5);if(life<=0||life>=1)continue;ctx.save();ctx.globalAlpha=Math.sin(life*Math.PI)*.075;ctx.filter='blur(6px)';ctx.strokeStyle=j%2?'#dcc7e0':'#e6cfb4';ctx.lineWidth=3-j*.4;ctx.beginPath();ctx.moveTo(cx-22+j*17+life*27,cy-19-j*12-life*39);ctx.bezierCurveTo(cx+2+j*15+life*21,cy-34-life*49,cx+33+j*7+life*25,cy-43-life*53,cx+47+j*10+life*29,cy-65-life*50);ctx.stroke();ctx.restore()}
 const final=smooth((t-4.1)/1)*(1-smooth((t-5.2)/1.0));glow(cx+18,cy-35,8,.08*final,true);ctx.restore();
 const words=smooth((t-1.2)/1)*(1-smooth((t-4.1)/1.2));ctx.save();ctx.globalAlpha=words;ctx.textAlign='center';ctx.fillStyle='#b09aa8';ctx.font='12px -apple-system,BlinkMacSystemFont,"Hiragino Mincho ProN",serif';ctx.fillText('また、同じ月の下で。',width/2,274);ctx.restore();
}
function size(){width=phone.clientWidth;const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*d);canvas.height=340*d;ctx.setTransform(d,0,0,d,0,0);if(active)draw(last)}
function finish(){active=false;phone.classList.remove('ending');phone.classList.add('ended');ctx.clearRect(0,0,width,340);button.disabled=false;button.textContent='重播结束动画';done()}
function loop(now){if(!active)return;const t=(now-start)/1000;draw(t);if(t<6.7)raf=requestAnimationFrame(loop);else finish()}

const observer=new ResizeObserver(size);observer.observe(phone);size();active=true;start=performance.now();raf=requestAnimationFrame(loop);return()=>{cancelAnimationFrame(raf);active=false;observer.disconnect();};
}
function galaxyDrawing(root,phone,portraits){const panel=root.querySelector('.mm-player'),mini=root.querySelector('.mm-mini-galaxy'),system=root.querySelector('.mm-system-canvas'),mx=mini.getContext('2d'),sx=system.getContext('2d');
const TAU=Math.PI*2,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let sw=312,epoch=performance.now(),previous=0,loopFrame=0,alive=true;
function size(){const d=Math.min(devicePixelRatio||1,2);mini.width=78*d;mini.height=54*d;mx.setTransform(d,0,0,d,0,0);sw=panel.clientWidth||Math.min(312,phone.clientWidth-20);system.width=Math.round(sw*d);system.height=312*d;sx.setTransform(d,0,0,d,0,0);placeElements()}
function dot(c,x,y,r,fill){c.fillStyle=fill;c.beginPath();c.arc(x,y,r,0,TAU);c.fill()}
function glow(c,x,y,r,alpha){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(196,181,218,'+alpha+')');g.addColorStop(1,'rgba(219,208,233,0)');dot(c,x,y,r,g)}
function sparkle(c,x,y,r,alpha){c.save();c.globalAlpha*=alpha;c.translate(x,y);c.fillStyle='#b7a8c6';c.beginPath();c.moveTo(0,-r);c.quadraticCurveTo(r*.15,-r*.15,r*.6,0);c.quadraticCurveTo(r*.15,r*.15,0,r);c.quadraticCurveTo(-r*.15,r*.15,-r*.6,0);c.quadraticCurveTo(-r*.15,-r*.15,0,-r);c.fill();c.restore()}
function spiral(c,cx,cy,scale,t,alpha){
 c.save();c.translate(cx,cy);c.rotate(-.25);c.scale(scale,scale*.4);
 for(let i=0;i<1250;i++){const f=(i*.61803398875)%1;const r=1.5+Math.sqrt(f)*27;const arm=i%3;const a=arm*TAU/3+r*.21+t*.13+(Math.sin(i*12.9898)*.13);const jitter=Math.sin(i*7.17)*(.5+r*.025);const x=Math.cos(a)*(r+jitter),y=Math.sin(a)*(r+jitter);const strength=alpha*(.17+.66*(1-f));dot(c,x,y,.2+(i%5)*.065,'rgba(145,119,178,'+strength+')')}
 c.restore();glow(c,cx,cy,8*scale,.22*alpha);dot(c,cx,cy,1.4*scale,'rgba(176,147,205,'+alpha*.7+')');sparkle(c,cx,cy,3.3*scale,.48)
}
function portrait(c,x,y,r,img){c.save();glow(c,x,y,r*1.6,.12);c.shadowColor='#aea0c72a';c.shadowBlur=7;c.beginPath();c.arc(x,y,r,0,TAU);c.clip();if(img&&img.complete&&img.naturalWidth)c.drawImage(img,x-r,y-r,r*2,r*2);c.restore()}
const systemGeometry={cx:150,cy:150,rx:135,ry:105,tilt:-.31};
function pathPoint(orbit,angle){const x=Math.cos(angle)*orbit.rx,y=Math.sin(angle)*orbit.ry;return{x:orbit.cx+x*Math.cos(orbit.tilt)-y*Math.sin(orbit.tilt),y:orbit.cy+x*Math.sin(orbit.tilt)+y*Math.cos(orbit.tilt)}}
const controlNodes=[{selector:'.mm-previous',angle:2.58,r:12},{selector:'.mm-pause',angle:1.62,r:18},{selector:'.mm-next',angle:-.05,r:11}];
function placeElements(){const scale=sw/312;controlNodes.forEach(node=>{const p=pathPoint(systemGeometry,node.angle),button=root.querySelector(node.selector);button.style.left=(p.x*scale-22)+'px';button.style.top=(p.y-22)+'px';button.style.right='auto';button.style.width='44px';button.style.height='44px'});const close=root.querySelector('.mm-collapse');close.style.left=(285*scale-18)+'px';close.style.top='10px';close.style.right='auto';close.style.width='36px';close.style.height='36px';const title=root.querySelector('.mm-track-name');title.style.left=(103*scale)+'px';title.style.top='97px';title.style.width=(146*scale)+'px';title.style.right='auto';const artist=root.querySelector('.mm-track-artist');artist.style.left=(134*scale)+'px';artist.style.top='129px';artist.style.width=(105*scale)+'px';artist.style.right='auto'}
function drawMini(t){mx.clearRect(0,0,78,54);spiral(mx,37,26,1.12,t,.93);for(let i=0;i<24;i++){let a=i*2.399+t*.035;dot(mx,37+Math.cos(a)*(19+i%5*3),26+Math.sin(a)*(9+i%3*4),.25+i%3*.13,'rgba(165,144,190,.42)')}sparkle(mx,61,12,4.5,.7);sparkle(mx,13,37,2.7,.48);const g=mx.createLinearGradient(60,32,67,40);g.addColorStop(0,'#ede3f2');g.addColorStop(1,'#b6a1c799');dot(mx,64,36,3.5,g);mx.save();mx.strokeStyle='#b8a2cd88';mx.lineWidth=.5;mx.translate(64,36);mx.rotate(-.4);mx.beginPath();mx.ellipse(0,0,6,1.8,0,0,TAU);mx.stroke();mx.restore()}
function orbitArc(orbit,start,end,opacity,dotted=false){sx.save();sx.translate(orbit.cx,orbit.cy);sx.rotate(orbit.tilt);sx.strokeStyle='rgba(167,146,188,'+opacity+')';sx.lineWidth=dotted?.55:.65;sx.setLineDash(dotted?[.6,3.4]:[]);sx.beginPath();sx.ellipse(0,0,orbit.rx,orbit.ry,0,start,end);sx.stroke();sx.restore()}
function drawSystem(t){
 sx.clearRect(0,0,sw,312);const scale=sw/312;sx.save();sx.scale(scale,1);
 const primary=systemGeometry;
 const inner={cx:149,cy:151,rx:111,ry:83,tilt:.12};
 const outer={cx:152,cy:148,rx:145,ry:130,tilt:-.16};
 glow(sx,145,157,112,.045);
 orbitArc(primary,-.53,5.77,.41);
 orbitArc(inner,.5,TAU+.08,.25);
 orbitArc(outer,2.25,5.78,.26,true);
 // The miniature and the open form share the same two-arm silver spiral.
 sx.save();sx.globalAlpha=.46;spiral(sx,136,169,2.15,t,.42);sx.restore();
 for(let i=0;i<145;i++){const a=i*2.39996,r=73+i*17%77,x=150+Math.cos(a)*r,y=150+Math.sin(a)*r*.86;if(x<7||x>306||y<8||y>303||(x>97&&x<253&&y>87&&y<145))continue;dot(sx,x,y,.2+i%3*.14,'rgba(172,149,191,'+(.12+.16*Math.sin(t*.4+i)**2)+')')}
 for(let i=0;i<34;i++){const a=3.65+i*.025,p=pathPoint(outer,a),q=pathPoint({...outer,rx:outer.rx-(i%5?1.6:4),ry:outer.ry-(i%5?1.6:4)},a);sx.strokeStyle=i%5?'#c6b2d244':'#b29ac283';sx.lineWidth=.55;sx.beginPath();sx.moveTo(p.x,p.y);sx.lineTo(q.x,q.y);sx.stroke()}
 const photoAngle1=3.87+Math.sin(t*.15)*.18;
 const photoAngle2=.75+Math.sin(t*.13+1.3)*.19;
 const p1=pathPoint(primary,photoAngle1),p2=pathPoint(inner,photoAngle2);
 portrait(sx,p1.x,p1.y,20,portraits[0]);portrait(sx,p2.x,p2.y,16,portraits[1]);
 for(const [key,p] of [['.kt-role-hit',p1],['.kt-user-hit',p2]]){const hit=root.querySelector(key);hit.style.left=(p.x*scale-20)+'px';hit.style.top=(p.y-20)+'px';}
 sparkle(sx,p1.x+24,p1.y-14,3,.45);sparkle(sx,p2.x+21,p2.y-14,2.6,.45);
 [[183,21,7],[30,152,4],[277,218,5],[114,286,4],[246,48,3]].forEach(([x,y,r],i)=>sparkle(sx,x,y,r,.35+.15*Math.sin(t*.4+i)**2));
 // Small satellites also sit precisely on a drawn trajectory.
 [4.89,2.04].forEach((a,i)=>{const p=pathPoint(outer,a),r=i?3:5;const g=sx.createLinearGradient(p.x-r,p.y-r,p.x+r,p.y+r);g.addColorStop(0,'#eee3f5');g.addColorStop(1,'#b7a0c9b3');dot(sx,p.x,p.y,r,g)});
 sx.restore();
}

function tick(now){if(!alive || root.isConnected===false)return;const t=reduced?0:(now-epoch)/1000;if(now-previous>45){previous=now;drawMini(t);if(!panel.hidden)drawSystem(t)}if(!reduced)loopFrame=requestAnimationFrame(tick)}
const resizeObserver=new ResizeObserver(size);resizeObserver.observe(phone);const panelObserver=new ResizeObserver(()=>{if(!panel.hidden){size();drawSystem(reduced?0:(performance.now()-epoch)/1000)}});panelObserver.observe(panel);size();drawMini(0);if(reduced)drawSystem(0);else loopFrame=requestAnimationFrame(tick);

return ()=>{alive=false;cancelAnimationFrame(loopFrame);resizeObserver.disconnect();panelObserver.disconnect();};

}
function setExpanded(value){if(!floating)return;const panel=floating.querySelector('.mm-player');panel.hidden=!value;floating.querySelector('.mm-phone').classList.toggle('player-open',value);const handle=floating.querySelector('.mm-ball');handle.setAttribute('aria-expanded',String(value));handle.setAttribute('aria-label',value?'收起星系播放器':'展开星系播放器');}
function update(snapshot){latest=snapshot;if(!floating)return;const song=snapshot?.song || lastSession?.song;const key=JSON.stringify([song?.title,song?.artist,!!snapshot?.playing]);if(floating.dataset.playback===key)return;floating.dataset.playback=key;floating.querySelector('.mm-track-name').textContent=song?.title || '';floating.querySelector('.mm-track-artist').textContent=song?.artist || '';const play=floating.querySelector('.mm-pause');play.setAttribute('aria-label',snapshot?.playing?'暂停':'播放');play.innerHTML='<span data-kt-icon="'+(snapshot?.playing?'pause':'play')+'"></span>';icons(play);}
async function sync(session){lastSession=session;if(!session){floating?.remove();floating=null;floatCleanup?.();floatCleanup=null;return;}if(animationBusy || bridge()?.ending()) {if(floating)floating.hidden=true;return;}if(floating?.dataset.session===session.id){floating.hidden=false;update(bridge().playback);return;}
 const id=session.id,c=bridge().character(session.roleId);if(!c)return;const portraits=await Promise.all([loadImage(bridge().image(c.avatar)),loadImage(bridge().image(c.myAvatar))]);if(lastSession?.id!==id || animationBusy || bridge()?.ending())return;if(floating?.dataset.session===id){floating.hidden=false;update(bridge().playback);return;}
 floating?.remove();floatCleanup?.();floating=document.createElement('div');floating.id='kt-galaxy';floating.dataset.session=id;floating.innerHTML='<div class="mm-phone">'+FLOAT_MARKUP+'</div>';host().append(floating);
 const phone=floating.querySelector('.mm-phone');icons(floating);floating.querySelector('.mm-ball').style.opacity='1';
 for(const img of floating.querySelectorAll('[data-image]'))img.src=portraits[img.dataset.image==='a'?0:1].src;
 floating.querySelector('.mm-ball').onclick=()=>setExpanded(floating.querySelector('.mm-player').hidden);
 floating.querySelector('.mm-collapse').onclick=()=>setExpanded(false);
 floating.querySelector('.mm-pause').onclick=()=>Promise.resolve(bridge().controls.toggle()).catch(e=>bridge().notify(e.message));
 floating.querySelector('.mm-next').onclick=()=>Promise.resolve(bridge().controls.next()).catch(e=>bridge().notify(e.message));
 floating.querySelector('.mm-previous').onclick=()=>Promise.resolve(bridge().controls.previous()).catch(e=>bridge().notify(e.message));
 floating.querySelector('.kt-role-hit').onclick=()=>{const s=bridge().active();if(s)bridge().end(s.id).catch(e=>bridge().notify(e.message));};
 floating.querySelector('.kt-user-hit').onclick=()=>Promise.resolve(bridge().controls.openPlayer()).catch(e=>bridge().notify(e.message));
 floatCleanup=galaxyDrawing(floating,phone,portraits);update(bridge().playback);
}
function run(kind,c,session){const token=++sequence;currentCancel?.();animationBusy=true;if(floating)floating.hidden=true;return new Promise(resolve=>{
 let stage=null,dispose=null,finished=false;
 const done=()=>{if(finished)return;finished=true;dispose?.();stage?.remove();if(sequence===token){animationBusy=false;currentCancel=null;sync(bridge()?.active());}resolve();};currentCancel=done;
 Promise.all([loadImage(moonURL),loadImage(bridge().image(c.avatar)),loadImage(bridge().image(c.myAvatar))]).then(([moon,a,b])=>{
 if(token!==sequence||finished)return;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){done();return;}
 stage=document.createElement('div');stage.className='kt-sky-stage';stage.innerHTML='<canvas class="mm-farewell mm-canvas" aria-hidden="true"></canvas><button class="mm-replay" hidden><span></span></button><button class="mm-end-listening" hidden></button><div class="mm-ball" hidden><span class="mm-float-pair"></span><span class="mm-wave"></span></div>';host().append(stage);
 dispose=(kind==='accept'?acceptAnimation:endAnimation)(stage,{moon,a,b},done);
 }).catch(e=>{console.error('一起听动画',e);done();});
 });}
root.KissTogetherSky={run,sync,update};
document.addEventListener('visibilitychange',()=>{if(document.hidden){floatCleanup?.();floatCleanup=null;}else if(floating){const c=bridge()?.character(lastSession?.roleId);if(c)Promise.all([loadImage(bridge().image(c.avatar)),loadImage(bridge().image(c.myAvatar))]).then(p=>{if(floating&&!floatCleanup)floatCleanup=galaxyDrawing(floating,floating.querySelector('.mm-phone'),p);});}});
})(window);
