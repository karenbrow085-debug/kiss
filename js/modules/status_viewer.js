/* Shared status presentation. Each template keeps its own styles and interactions. */
window.openCharacterStatusPanel = function(char, overridePanel, viewerOptions={}) {
 const panelData=overridePanel||char?.statusPanel;if(!char||!panelData)return;
 const content=document.getElementById('char-status-content'),overlay=document.getElementById('char-status-overlay');if(!content||!overlay)return;
 overlay._statusDispose?.();
 const options={panel:panelData,offline:!!overridePanel,...viewerOptions},disposals=[],frames=new Map();let disposed=false,currentIndex=0,resizeTimer,observerTimer;
 overlay.dataset.offline=String(options.offline);overlay.dataset.readonly=String(!!options.readOnly);overlay.classList.remove('status-expanded');overlay.classList.toggle('status-tools-collapsed',overlay.dataset.toolsCollapsed==='true');
 const parent=document.querySelector('.phone-screen')||document.getElementById('chat-room-screen')?.parentNode||document.body;if(overlay.parentNode!==parent)parent.append(overlay);
 content.replaceChildren();
 const slides=panelData.history?.length?[...panelData.history].reverse():panelData.currentStatusHtml?[{html:panelData.currentStatusHtml,timestamp:Date.now()}]:[];
 const swiper=document.createElement('div');swiper.className='status-swiper';swiper.setAttribute('aria-label','状态记录');
 const indicator=document.createElement('div');indicator.className='status-indicator';
 const viewportHeight=()=>Math.max(160,swiper.clientHeight-parseFloat(getComputedStyle(swiper).getPropertyValue('--status-space-bottom')||'0')-24);
 function mountFrame(frame,html){
  // Viewport-driven templates keep one stable viewport, avoiding a vh/auto-height feedback loop.
  const viewportLayout=/(?:\b(?:min-|max-)?height\s*:\s*[^;}]*\b\d+(?:d|s|l)?vh\b|\bposition\s*:\s*fixed\b)/i.test(html);
  let stop=()=>{},timer;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(measure,60);};
  function measure(){if(disposed||!frame.isConnected)return;
   if(viewportLayout){frame.style.height=viewportHeight()+'px';return;}
   // Always measure against the same viewport, never against our previous output.
   // Percentage heights plus padding/margins otherwise add another gap on each pass.
   const slide=frame.closest('.status-slide'),scrollTop=slide?.scrollTop||0;
   frame.style.height=viewportHeight()+'px';
   try{const doc=frame.contentDocument,body=doc?.body;if(!body)return;
    let bottom=0;const win=frame.contentWindow,bodyStyle=win.getComputedStyle(body);
    // Range captures text and inline content without treating the iframe viewport as content.
    const range=doc.createRange();range.selectNodeContents(body);bottom=Math.max(0,range.getBoundingClientRect().bottom+win.scrollY);
    let inspected=0;for(const el of body.querySelectorAll('*')){if(++inspected>5000)break;if(['SCRIPT','STYLE','LINK','META'].includes(el.tagName))continue;const style=win.getComputedStyle(el);if(style.display==='none'||style.position==='fixed')continue;const r=el.getBoundingClientRect();bottom=Math.max(bottom,r.bottom+win.scrollY+(parseFloat(style.marginBottom)||0));}
    bottom+=parseFloat(bodyStyle.paddingBottom)||0;
    const height=Math.max(1,Math.min(60000,Math.ceil(bottom)));if(Math.abs(frame.getBoundingClientRect().height-height)>1)frame.style.height=height+'px';
   }catch{frame.style.height=viewportHeight()+'px';}finally{if(slide)slide.scrollTop=scrollTop;}
  }
  frame.className='status-template-frame';frame.title='状态内容';frame.style.height=viewportLayout?viewportHeight()+'px':'1px';
  frame.addEventListener('load',()=>{stop();if(disposed)return;try{const doc=frame.contentDocument;if(!doc?.body)return;
    const style=doc.createElement('style');style.textContent='html{scrollbar-width:none}body{overflow-wrap:anywhere}img,video{max-width:100%}';doc.head.append(style);
    const observer=new frame.contentWindow.ResizeObserver(schedule);observer.observe(doc.body);const mutations=new frame.contentWindow.MutationObserver(schedule);mutations.observe(doc.body,{subtree:true,childList:true,attributes:true,characterData:true});doc.addEventListener('load',schedule,true);doc.fonts?.ready.then(schedule);
    stop=()=>{observer.disconnect();mutations.disconnect();doc.removeEventListener('load',schedule,true);};measure();
   }catch{measure();}});
  frames.set(frame,{measure,schedule});disposals.push(()=>{clearTimeout(timer);stop();frame.srcdoc='';});frame.srcdoc=html;
 }
 function load(index){if(index<0||index>=slides.length)return;const inner=swiper.children[index]?.firstElementChild;if(!inner||inner.childNodes.length)return;
  const html=processTemplate(String(slides[index].html||''),char);
  if(/<(?:!doctype|html|style|script|head|body)\b/i.test(html)){const frame=document.createElement('iframe');inner.append(frame);mountFrame(frame,html);}
  else{inner.innerHTML=html;}
 }
 for(const row of slides){const slide=document.createElement('div');slide.className='status-slide';const inner=document.createElement('div');inner.className='status-slide-inner';slide.append(inner);swiper.append(slide);}
 if(slides.length){content.append(swiper,indicator);currentIndex=slides.length-1;load(currentIndex);load(currentIndex-1);}
 else{const empty=document.createElement('p');empty.className='sh-empty';empty.textContent='还没有状态记录。';content.append(empty);}
 function update(){if(disposed||!swiper.offsetWidth)return;currentIndex=Math.max(0,Math.min(slides.length-1,Math.round(swiper.scrollLeft/swiper.offsetWidth)));indicator.textContent=`${currentIndex+1} / ${slides.length}`;for(let i=currentIndex-1;i<=currentIndex+1;i++)load(i);}
 swiper.addEventListener('scroll',update,{passive:true});indicator.textContent=`${slides.length} / ${slides.length}`;
 if(!options.readOnly)window.attachStatusHistoryControls?.(char,content,slides,slides.length?swiper:null,slides.length?indicator:null,options);
 let tools=content.querySelector('.sh-history-tools');if(!tools){tools=document.createElement('div');tools.className='sh-history-tools';content.append(tools);}
 const expand=document.createElement('button');expand.type='button';expand.className='sh-expand';expand.setAttribute('aria-pressed','false');
 function label(){const active=overlay.classList.contains('status-expanded');expand.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${active?'M8 3v5H3m18 0h-5V3M3 16h5v5m8 0v-5h5':'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5'}"/></svg><span>${active?'还原':'全屏'}</span>`;expand.setAttribute('aria-label',active?'退出全屏':'全屏查看');expand.setAttribute('aria-pressed',String(active));}
 const positions=new Map();function toggle(force){const on=typeof force==='boolean'?force:!overlay.classList.contains('status-expanded');if(on===overlay.classList.contains('status-expanded'))return;
  const index=currentIndex;for(const el of swiper.querySelectorAll('.status-slide'))positions.set(el,el.scrollTop);
  overlay.classList.toggle('status-expanded',on);label();resize(index);requestAnimationFrame(()=>{if(!disposed)for(const [el,top]of positions)el.scrollTop=top;});
 }
 expand.onclick=()=>toggle();expand.disabled=!slides.length;tools.prepend(expand);label();
 tools.addEventListener('click',()=>{expand.disabled=!slides.length||swiper.hidden;});
 if(options.readOnly){const close=document.createElement('button');close.type='button';close.textContent='关闭';close.onclick=()=>overlay.classList.remove('visible');tools.append(close);}
 const toolbar=content.querySelector('.sh-toolbar');if(toolbar)toolbar.id='status-action-toolbar';
 const fold=document.createElement('button');fold.type='button';fold.className='sh-tools-toggle';fold.setAttribute('aria-controls','status-action-toolbar');
 function labelTools(){const collapsed=overlay.classList.contains('status-tools-collapsed');fold.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${collapsed?'m6 15 6-6 6 6':'m6 9 6 6 6-6'}"/></svg>`;fold.setAttribute('aria-label',collapsed?'展开工具栏':'收起工具栏');fold.setAttribute('title',collapsed?'展开工具栏':'收起工具栏');fold.setAttribute('aria-expanded',String(!collapsed));}
 fold.onclick=()=>{const index=currentIndex,saved=[...swiper.children].map(el=>[el,el.scrollTop]);const collapsed=!overlay.classList.contains('status-tools-collapsed');overlay.dataset.toolsCollapsed=String(collapsed);overlay.classList.toggle('status-tools-collapsed',collapsed);labelTools();resize(index);requestAnimationFrame(()=>{if(!disposed)for(const [el,top]of saved)el.scrollTop=top;});};
 tools.append(fold);labelTools();
 function resize(index=currentIndex){if(disposed)return;swiper.style.scrollBehavior='auto';swiper.scrollLeft=index*swiper.clientWidth;for(const {measure}of frames.values())measure();clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!disposed)swiper.style.scrollBehavior='smooth';},100);}
 const onResize=()=>resize();window.addEventListener('resize',onResize);const observer=new ResizeObserver(()=>{clearTimeout(observerTimer);observerTimer=setTimeout(onResize,60);});observer.observe(content);
 const keydown=e=>{if(e.key==='Escape'&&overlay.classList.contains('visible')){e.preventDefault();if(overlay.classList.contains('status-expanded'))toggle(false);else overlay.classList.remove('visible');}};document.addEventListener('keydown',keydown);
 const closeObserver=new MutationObserver(()=>{if(!overlay.classList.contains('visible'))dispose();});
 function dispose(){if(disposed)return;disposed=true;clearTimeout(resizeTimer);clearTimeout(observerTimer);observer.disconnect();closeObserver.disconnect();window.removeEventListener('resize',onResize);document.removeEventListener('keydown',keydown);disposals.forEach(fn=>fn());overlay.classList.remove('status-expanded');if(overlay._statusDispose===dispose)delete overlay._statusDispose;}
 overlay._statusDispose=dispose;overlay.classList.add('visible');closeObserver.observe(overlay,{attributes:true,attributeFilter:['class']});resize();
};
