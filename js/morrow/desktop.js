/* Morrow desktop integration for the deployed 404 home grid. */
(function(){
  'use strict';
  const APP_URL=new URL('../../Morrow.html?v=morrow-vector-20261012',document.currentScript.src).href;
  const DEFAULT_ICON='https://i.ibb.co/jPyCtz03/ad80cbd157eccf99590418826976653f.jpg';
  if(typeof defaultIcons!=='undefined')defaultIcons['morrow-app']={name:'Morrow',url:DEFAULT_ICON};
  if(window.MorrowApp)return;
  let screen,frame,loading=false;
  function nativeDb(){return typeof db!=='undefined'?db:window.db||null}
  function apiSettings(){const a=nativeDb()?.apiSettings||{};let key=a.key||'';if(typeof getRandomValue==='function'&&key)key=getRandomValue(key);return {url:String(a.url||''),key:String(key),model:String(a.model||''),provider:String(a.provider||'newapi'),temperatureEnabled:Boolean(a.temperatureEnabled),temperature:a.temperature};}
  function worldbookFor(c){
    const books=nativeDb()?.worldBooks||[],ids=new Set((c.worldBookIds||[]).map(String));
    let changed=true;while(changed){changed=false;for(const b of books){if(b.parentId!=null&&ids.has(String(b.parentId))&&!ids.has(String(b.id))){ids.add(String(b.id));changed=true}}}
    return books.filter(b=>ids.has(String(b.id))&&b.type!=='folder'&&b.enabled!==false&&b.content).map(b=>String(b.name||'世界书')+'\n'+String(b.content)).join('\n\n');
  }
  function characters(){
    const data=nativeDb();return(data?.characters||[]).filter(c=>c&&(c.description||c.persona||c.systemPrompt)).map(c=>({
      sourceId:'404:'+String(c.id),name:String(c.realName||c.name||c.remarkName||c.charName||'角色'),
      description:String(c.description||c.persona||c.systemPrompt||''),scenario:String(c.scenario||''),
      worldbook:worldbookFor(c),creator:String(c.creator||c.author||'')
    }));
  }
  function applyHostVisibility(){
    const visible=screen?.classList.contains('active')&&!document.hidden;
    try{frame?.contentWindow?.Morrow?.setHostVisible(Boolean(visible))}catch{}
  }
  function create(){
    if(screen)return;
    const css=document.createElement('style');css.id='morrow-desktop-css';css.textContent=`
      #morrow-screen.screen{display:none;position:absolute;inset:0;background:#f8f8f9;flex-direction:column;z-index:8;overflow:hidden}
      #morrow-screen.screen.active{display:flex}
      #morrow-screen .morrow-toolbar{position:absolute;left:18px;right:18px;top:calc(12px + env(safe-area-inset-top,0px));z-index:5;display:flex;justify-content:flex-start;gap:10px;align-items:center;pointer-events:none}
      #morrow-screen .morrow-toolbar button{pointer-events:auto;width:50px;height:50px;border:1px solid #ffffffb0;border-radius:50%;background:linear-gradient(135deg,#ffffff40,#ffffff12);color:#304b52;padding:13px;box-shadow:inset 0 1px 1px #fff,inset 0 -1px 1px #ffffff80,0 4px 16px #20484612;-webkit-backdrop-filter:blur(3px) saturate(1.15);backdrop-filter:blur(3px) saturate(1.15)}
      #morrow-screen .morrow-toolbar button,#morrow-screen.host-glass .morrow-toolbar button{height:46px;width:46px;padding:12px;border:0;background:#fafbf5f5;color:#344c4a;box-shadow:0 4px 16px #20443d12;backdrop-filter:none;-webkit-backdrop-filter:none}
      #morrow-screen .morrow-toolbar button:first-child{width:135px;border-radius:30px;display:flex;align-items:center;justify-content:center;gap:11px;font:14px -apple-system,sans-serif}
      #morrow-screen .morrow-toolbar svg{display:block;width:20px;height:20px}
      #morrow-screen iframe{flex:1 1 auto;min-height:0;width:100%;height:100%;border:0;display:block;background:#eaf4f4}
      #morrow-screen.morrow-android .morrow-toolbar{top:calc(12px + max(18px,env(safe-area-inset-top,0px)))}
      #morrow-screen.morrow-ios .morrow-toolbar{top:calc(12px + max(59px,env(safe-area-inset-top,0px)))}
      @media(orientation:landscape){#morrow-screen.morrow-ios .morrow-toolbar{top:calc(12px + max(20px,env(safe-area-inset-top,0px)))}}
      #morrow-screen .morrow-loading{padding:30px;text-align:center;color:#a0a0ad;font-size:13px}
    `;document.head.appendChild(css);
    screen=document.createElement('div');screen.id='morrow-screen';screen.className='screen';if(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1))screen.classList.add('morrow-ios');else if(/Android/i.test(navigator.userAgent))screen.classList.add('morrow-android');
    const bar=document.createElement('div');bar.className='morrow-toolbar';
    const back=document.createElement('button');back.type='button';back.setAttribute('aria-label','返回桌面');back.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/></svg>';back.insertAdjacentHTML('beforeend','<span>桌面</span>');back.onclick=()=>window.MorrowApp.close();
    const refresh=document.createElement('button');refresh.type='button';refresh.setAttribute('aria-label','重新打开');refresh.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/></svg>';refresh.onclick=()=>{if(confirm('已保存的信件不会删除，是否重新打开邮局？'))frame.src=frame.src};
    bar.append(back,refresh);screen.appendChild(bar);
    const indicator=document.createElement('div');indicator.className='morrow-loading';indicator.textContent='正在打开远方邮局…';screen.appendChild(indicator);
    frame=document.createElement('iframe');frame.title='Morrow 匿名送信';frame.loading='eager';
    frame.addEventListener('load',async()=>{indicator.hidden=true;loading=false;try{
      const child=frame.contentWindow;if(!child.Morrow){indicator.hidden=false;indicator.textContent='邮局页面未找到，请把 Morrow.html 上传到 index.html 所在目录后等待部署完成。';return}child.morrow404={getCharacters:async()=>characters(),getApiSettings:apiSettings};await child.Morrow.configureHost({getApiSettings:apiSettings,embedded:true});
      if(child.document.documentElement.classList.contains('glass-refraction')&&!document.getElementById('morrow-host-lens')){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.style.position='absolute';svg.style.pointerEvents='none';svg.innerHTML='<defs><filter id="morrow-host-lens" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage width="100%" height="100%" preserveAspectRatio="none" result="lens"/><feDisplacementMap in="SourceGraphic" in2="lens" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';svg.querySelector('feImage').setAttribute('href',child.document.getElementById('liquidMap').getAttribute('href'));screen.appendChild(svg);screen.classList.add('host-glass')}

      await child.Morrow?.importCharacters(characters());applyHostVisibility();
    }catch(e){indicator.hidden=false;indicator.textContent='邮局读取失败，请确认 仓库根目录的 Morrow.html 已上传。';console.error('Morrow desktop:',e)}});
    screen.appendChild(frame);(document.querySelector('.phone-screen')||document.body).appendChild(screen);
    new MutationObserver(applyHostVisibility).observe(screen,{attributes:true,attributeFilter:['class']});
    document.addEventListener('visibilitychange',applyHostVisibility);
    frame.src=APP_URL;loading=true;
  }
  window.MorrowApp={
    open(){create();if(typeof switchScreen==='function')switchScreen('morrow-screen');else screen.classList.add('active');applyHostVisibility()},
    close(){if(typeof switchScreen==='function')switchScreen('home-screen');else screen.classList.remove('active');applyHostVisibility()},
    getCharacters:characters,
    defaultIcon:DEFAULT_ICON
  };
})();
