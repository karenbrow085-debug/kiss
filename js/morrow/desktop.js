/* Morrow desktop integration for the deployed 404 home grid. */
(function(){
  'use strict';
  const DEFAULT_ICON='https://i.ibb.co/jPyCtz03/ad80cbd157eccf99590418826976653f.jpg';
  if(typeof defaultIcons!=='undefined')defaultIcons['morrow-app']={name:'Morrow',url:DEFAULT_ICON};
  if(window.MorrowApp)return;
  let screen,frame,loading=false;
  function nativeDb(){return typeof db!=='undefined'?db:window.db||null}
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
      #morrow-screen.screen{display:none;position:absolute;inset:0;background:#e9dfcb;flex-direction:column;z-index:8;overflow:hidden}
      #morrow-screen.screen.active{display:flex}
      #morrow-screen .morrow-toolbar{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;padding:8px 13px;background:#efe2c7;border-bottom:1px solid #d6c6a4;min-height:46px}
      #morrow-screen .morrow-toolbar button{border:0;background:none;color:#6b5c44;font:13px inherit;min-width:60px;min-height:38px;padding:6px}
      #morrow-screen .morrow-title{font:20px Georgia,serif;color:#4a3f30}
      #morrow-screen iframe{flex:1 1 auto;min-height:0;width:100%;border:0;display:block;background:#e9dfcb}
      #morrow-screen .morrow-loading{padding:30px;text-align:center;color:#7b6b50;font-size:13px}
    `;document.head.appendChild(css);
    screen=document.createElement('div');screen.id='morrow-screen';screen.className='screen';
    const bar=document.createElement('div');bar.className='morrow-toolbar';
    const back=document.createElement('button');back.type='button';back.textContent='桌面';back.onclick=()=>window.MorrowApp.close();
    const title=document.createElement('span');title.className='morrow-title';title.textContent='morrow.';
    const refresh=document.createElement('button');refresh.type='button';refresh.textContent='重开';refresh.onclick=()=>{if(confirm('已保存的信件不会删除，是否重新打开邮局？'))frame.src=frame.src};
    bar.append(back,title,refresh);screen.appendChild(bar);
    const indicator=document.createElement('div');indicator.className='morrow-loading';indicator.textContent='正在打开远方邮局…';screen.appendChild(indicator);
    frame=document.createElement('iframe');frame.title='Morrow 匿名送信';frame.loading='eager';
    frame.addEventListener('load',async()=>{indicator.hidden=true;loading=false;try{
      const child=frame.contentWindow;child.morrow404={getCharacters:async()=>characters()};
      await child.Morrow?.importCharacters(characters());applyHostVisibility();
    }catch(e){indicator.hidden=false;indicator.textContent='邮局读取失败，请确认 apps/morrow/Morrow.html 已上传。';console.error('Morrow desktop:',e)}});
    screen.appendChild(frame);(document.querySelector('.phone-screen')||document.body).appendChild(screen);
    new MutationObserver(applyHostVisibility).observe(screen,{attributes:true,attributeFilter:['class']});
    document.addEventListener('visibilitychange',applyHostVisibility);
    frame.src='apps/morrow/Morrow.html?v=desktop-1';loading=true;
  }
  window.MorrowApp={
    open(){create();if(typeof switchScreen==='function')switchScreen('morrow-screen');else screen.classList.add('active');applyHostVisibility()},
    close(){if(typeof switchScreen==='function')switchScreen('home-screen');else screen.classList.remove('active');applyHostVisibility()},
    getCharacters:characters,
    defaultIcon:DEFAULT_ICON
  };
})();
