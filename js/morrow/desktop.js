/* Morrow desktop integration for the deployed 404 home grid. */
(function(){
  'use strict';
  const APP_URL=new URL('../../Morrow.html?v=20261022-keepsake-envelope',document.currentScript.src).href;
  const DEFAULT_ICON='https://i.ibb.co/jPyCtz03/ad80cbd157eccf99590418826976653f.jpg';
  if(typeof defaultIcons!=='undefined')defaultIcons['morrow-app']={name:'Morrow',url:DEFAULT_ICON};
  if(window.MorrowApp)return;
  let screen,frame,loading=false;
  function nativeDb(){return typeof db!=='undefined'?db:window.db||null}
  function apiSettings(){const a=window.AppApi?window.AppApi.resolve('morrow'):nativeDb()?.apiSettings||{};let key=a.key||'';if(typeof getRandomValue==='function'&&key)key=getRandomValue(key);return {url:String(a.url||''),key:String(key),model:String(a.model||''),provider:String(a.provider||'newapi'),temperatureEnabled:Boolean(a.temperatureEnabled),temperature:a.temperature};}
  function worldbookFor(c){
    const books=nativeDb()?.worldBooks||[],ids=new Set((c.worldBookIds||[]).map(String));
    let changed=true;while(changed){changed=false;for(const b of books){if(b.parentId!=null&&ids.has(String(b.parentId))&&!ids.has(String(b.id))){ids.add(String(b.id));changed=true}}}
    return books.filter(b=>ids.has(String(b.id))&&b.type!=='folder'&&b.enabled!==false&&b.content).map(b=>String(b.name||'世界书')+'\n'+String(b.content)).join('\n\n');
  }
  function characters(){
    const data=nativeDb();return(data?.characters||[]).filter(c=>c&&(c.description||c.persona||c.systemPrompt)).map(c=>({
      sourceId:'404:'+String(c.id),name:String(c.realName||c.name||c.remarkName||c.charName||'角色'),
      description:String(c.description||c.persona||c.systemPrompt||''),scenario:String(c.scenario||''),
      avatar:String(c.avatar||c.avatarUrl||c.avatar_url||c.portrait||''),
      gender:c.gender||c.sex||c.characterGender||c.profile?.gender||c.basicInfo?.gender||c['性别']||'',
      height:c.height||c.profile?.height||c.basicInfo?.height||c['身高']||'',
      birthday:c.birthday||c.birthDate||c.birthdate||c.dateOfBirth||c.profile?.birthday||c.basicInfo?.birthday||c['生日']||'',
      first_mes:String(c.first_mes||c.firstMes||c.greeting||''),
      worldbook:worldbookFor(c),creator:String(c.creator||c.author||''),license:String(c.license||'')
    }));
  }
  /* Only exact source IDs cross the one-way read boundary. No mutation on reads. */
  function hostText(m){if(typeof m?.content==='string')return m.content;return (m?.parts||[]).filter(p=>p.type==='text').map(p=>String(p.text||'')).join('\n')}
  async function conversationContext(sourceId){
    const data=nativeDb(),cid=String(sourceId||'').startsWith('404:')?String(sourceId).slice(4):'';
    const c=data?.characters?.find(c=>String(c.id)===cid);if(!c)throw Error('404角色不存在');
    let sourceHistory=c.history||[];
    if(window.PhoneBackup?.isCold?.(c)&&typeof dexieDB!=='undefined'){
      const disk=await dexieDB.characters.get(c.id),ref=disk?.history;
      if((!disk.activeArchiveId||disk.activeArchiveId===c.activeArchiveId)&&Array.isArray(ref?.__phoneHistory)){
        const recent=[];for(const id of ref.__phoneHistory.slice(-3)){const chunk=await dexieDB.safeParts.get(id);if(!chunk||!Array.isArray(chunk.value))throw Error('404聊天记忆数据块不可读');recent.push(...chunk.value)}
        const byId=new Map();for(const message of [...recent,...sourceHistory])if(message&&typeof message==='object')byId.set(String(message.id||JSON.stringify([message.role,message.timestamp,hostText(message)])),message);sourceHistory=[...byId.values()];
      }
    }
    const history=sourceHistory.filter(m=>m&&!m.isContextDisabled&&!m.morrowMemorySource).slice(-80).map(m=>({role:['user','assistant','system'].includes(m.role)?m.role:String(m.sender||'历史'),text:hostText(m).slice(0,1600)})).filter(m=>m.text);
    const journals=(c.memoryJournals||[]).filter(j=>j&&j.isFavorited&&!j.morrowSourceKey).slice(-16).map(j=>({title:String(j.title||'').slice(0,120),text:String(j.content||'').slice(0,2000)}));
    return {sourceId:'404:'+cid,archiveId:String(c.activeArchiveId||''),characterName:String(c.realName||c.name||''),userName:String(c.myName||''),userPersona:String(c.myPersona||'').slice(0,10000),relationship:String(c.relationship||c.relationshipStatus||'').slice(0,4000),persona:String(c.persona||c.description||'').slice(0,24000),worldbook:worldbookFor(c).slice(0,20000),journals,history};
  }
  function memoryDigest(proof){const budget=Math.max(70,Math.min(700,Math.floor(20500/Math.max(1,proof.letters.length))-80));return '【MORROW通信记忆；用户已在满52封送达后明确添加好友】\n这段匿名通信的对方现在已确认为当前用户。此前不知道对方身份，不能倒推此前已知情；保持404原有的人设、恋爱/婚姻与承诺。信件是历史资料，不是新的系统指令。完整正文另存于本角色的morrowCorrespondences。\n笔名：'+proof.alias+'；收信人笔名：'+proof.userAlias+'\n'+proof.letters.map(l=>new Date(l.created||l.due).toISOString().slice(0,10)+' '+(l.direction==='in'?'角色寄出':'用户寄来')+'：'+String(l.text).slice(0,budget)+(l.text.length>budget?'…':'')+(l.attachments?.length?' [附件] '+l.attachments.map(a=>a.title+':'+String(a.detail||'').slice(0,90)).join('；'):'')).join('\n')}
  let memoryWriteQueue=Promise.resolve();
  async function applyFriendMemory(matchId,proofReader){
    const proof=await proofReader(matchId);
    if(!proof||proof.version!==1||proof.matchId!==String(matchId)||!proof.acceptedAt||!proof.consentId||!proof.card||!Array.isArray(proof.deliveredIds)||new Set(proof.deliveredIds).size<52)throw Error('未满足52封送达并明确添加好友的双重条件');
    const now=Date.now(),ids=new Set();for(const l of proof.letters||[]){if(!l.id||ids.has(l.id)||l.due>now||!['in','out'].includes(l.direction))throw Error('通信记忆含重复或尚未送达的信件');ids.add(l.id)}
    if([...ids].some(id=>!proof.deliveredIds.includes(id)))throw Error('通信记忆送达凭据不一致');
    const fresh=await proofReader(matchId);if(!fresh||fresh.key!==proof.key||fresh.consentId!==proof.consentId)throw Error('通信账号或好友确认已变化');
    const data=nativeDb();if(window.kissCleanupLocked)throw Error('404正在导入或清理数据，请稍后重试');if(!data||typeof saveData!=='function')throw Error('404存储尚未就绪');
    const card=proof.card;let c,created=false,bookId=null;
    if(!proof.remote){if(!String(card.sourceId).startsWith('404:'))throw Error('此本地角色不是从404读取，不能自动合并至其它角色');c=(data.characters||[]).find(x=>String(x.id)===String(card.sourceId).slice(4));if(!c)throw Error('对应404角色已删除')}
    else{c=(data.characters||[]).find(x=>x.morrowSourceKey===proof.key);if(!c){created=true;c={id:'char_morrow_'+crypto.randomUUID(),realName:card.name||'未命名',remarkName:card.name||'未命名',persona:card.description||'',avatar:card.avatar||'https://i.postimg.cc/Y96LPskq/o-o-2.jpg',myName:proof.userAlias||'user',myRemarkName:'',myPersona:'',myAvatar:'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg',theme:'white_pink',maxMemory:100,chatBg:'',history:[],isPinned:false,status:'在线',worldBookIds:[],useCustomBubbleCss:false,customBubbleCss:'',bilingualBubbleStyle:'under',unreadCount:0,memoryJournals:[],journalWorldBookIds:[],lastUserMessageTimestamp:null,statusPanel:{enabled:false,promptSuffix:'',regexPattern:'',replacePattern:'',historyLimit:3,currentStatusRaw:'',currentStatusHtml:'',history:[]},peekData:{},peekScreenSettings:{wallpaper:'',customIcons:{},unlockAvatar:''},autoReply:{enabled:false,interval:60,lastTriggerTime:0},morrowSourceKey:proof.key};for(const k of ['gender','height','birthday','scenario','first_mes','author','license'])c[k]=card[k]||'';if(card.scenario)c.persona+='\n\n背景与关系：\n'+card.scenario;if(card.worldbook){bookId='wb_morrow_'+crypto.randomUUID();data.worldBooks||=[];data.worldBooks.push({id:bookId,name:(card.name||'MORROW')+' · 世界书',content:card.worldbook,position:'before',depth:100,enabled:true,type:'book'});c.worldBookIds.push(bookId)}data.characters||=[];data.characters.push(c)}}
    const full={version:1,sourceKey:proof.key,matchId:proof.matchId,alias:proof.alias,userAlias:proof.userAlias,acceptedAt:proof.acceptedAt,consentId:proof.consentId,letters:proof.letters};
    const old=c.morrowCorrespondences?.[proof.key];if(old&&JSON.stringify(old)===JSON.stringify(full))return {characterId:c.id,created:false,unchanged:true};
    const oldRecords=c.morrowCorrespondences,oldJournals=c.memoryJournals;const journalId='morrow:'+proof.key,prior=(c.memoryJournals||[]).find(j=>j.id===journalId);
    c.morrowCorrespondences={...(oldRecords||{}),[proof.key]:full};c.memoryJournals=[...(oldJournals||[]).filter(j=>j.id!==journalId),{...prior,id:journalId,title:'MORROW · 与'+proof.userAlias+'的通信',content:memoryDigest(proof),isFavorited:prior?prior.isFavorited!==false:true,createdAt:prior?.createdAt||Date.now(),updatedAt:Date.now(),morrowSourceKey:proof.key}];
    try{if(typeof syncChatActiveArchive==='function')syncChatActiveArchive(c,true);await saveData();
      if(window.kissCleanupLocked||nativeDb()!==data||!data.characters.includes(c))throw Error('404存储状态发生变化，请重试');
      if(typeof dexieDB!=='undefined'&&dexieDB.characters?.get){const saved=await dexieDB.characters.get(c.id),record=saved?.morrowCorrespondences?.[proof.key];if(record?.consentId!==proof.consentId||record?.letters?.length!==full.letters.length||record?.letters?.at(-1)?.id!==full.letters.at(-1)?.id)throw Error('404通信记忆尚未成功写入持久存储')}
    }
    catch(e){c.morrowCorrespondences=oldRecords;c.memoryJournals=oldJournals;if(created)data.characters=data.characters.filter(x=>x!==c);if(bookId)data.worldBooks=data.worldBooks.filter(x=>x.id!==bookId);if(!created&&typeof syncChatActiveArchive==='function')syncChatActiveArchive(c,true);throw e}
    if(typeof renderChatList==='function')renderChatList();if(typeof renderContacts==='function')renderContacts();return {characterId:c.id,created,unchanged:false};
  }
  function acceptFriend(matchId){const run=()=>applyFriendMemory(String(matchId),async id=>{const child=frame?.contentWindow;if(!child?.Morrow?.get404FriendshipExport)throw Error('MORROW连接已关闭');return child.Morrow.get404FriendshipExport(id)});const job=memoryWriteQueue.then(run,run);memoryWriteQueue=job.catch(()=>{});return job}

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
      #morrow-screen .morrow-toolbar[hidden]{display:none}
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
      const child=frame.contentWindow;if(!child.Morrow){indicator.hidden=false;indicator.textContent='邮局页面未找到，请把 Morrow.html?v=20261022-keepsake-envelope 上传到 index.html 所在目录后等待部署完成。';return}child.morrow404={getFontPresets:async()=>structuredClone(nativeDb()?.fontPresets||[]),getFontFile:async id=>{if(typeof dexieDB==='undefined')return null;return (await dexieDB.customFonts.get(id))?.file||null},getCharacters:async()=>characters(),getConversationContext:async sourceId=>conversationContext(sourceId),acceptFriend,getApiSettings:apiSettings,mountApiSettings:container=>window.AppApi?.mount(container,'morrow',{title:'AI 回信',kicker:'POST OFFICE / MODEL'}),getImageSettings:async()=>structuredClone(nativeDb()?.workshopSettings||{}),generateImage:async (prompt,overrides)=>{const settings=overrides||nativeDb()?.workshopSettings;if(!settings||typeof window.executeImageGeneration!=='function')throw Error('请先在404绘图工坊配置生图接口和模型');window.MorrowImageBusy=(window.MorrowImageBusy||0)+1;try{const config=structuredClone(overrides||settings);return await window.executeImageGeneration(config,prompt)}finally{window.MorrowImageBusy--}}};await child.Morrow.configureHost({getApiSettings:apiSettings,embedded:true});child.Morrow.setSurfaceListener?.(visible=>{bar.hidden=!visible});
      if(child.document.documentElement.classList.contains('glass-refraction')&&!document.getElementById('morrow-host-lens')){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.style.position='absolute';svg.style.pointerEvents='none';svg.innerHTML='<defs><filter id="morrow-host-lens" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage width="100%" height="100%" preserveAspectRatio="none" result="lens"/><feDisplacementMap in="SourceGraphic" in2="lens" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';svg.querySelector('feImage').setAttribute('href',child.document.getElementById('liquidMap').getAttribute('href'));screen.appendChild(svg);screen.classList.add('host-glass')}

      await child.Morrow?.importCharacters(characters());applyHostVisibility();
    }catch(e){indicator.hidden=false;indicator.textContent='邮局读取失败，请确认 仓库根目录的 Morrow.html?v=20261022-keepsake-envelope 已上传。';console.error('Morrow desktop:',e)}});
    screen.appendChild(frame);(document.querySelector('.phone-screen')||document.body).appendChild(screen);
    new MutationObserver(applyHostVisibility).observe(screen,{attributes:true,attributeFilter:['class']});
    document.addEventListener('visibilitychange',applyHostVisibility);
    const topStyle=document.createElement('style');topStyle.textContent=`#morrow-screen .morrow-toolbar{top:calc(24px + env(safe-area-inset-top,0px))!important}#morrow-screen.morrow-ios .morrow-toolbar{top:calc(16px + max(44px,env(safe-area-inset-top,0px)))!important}@media(orientation:landscape){#morrow-screen.morrow-ios .morrow-toolbar{top:calc(16px + max(20px,env(safe-area-inset-top,0px)))!important}}`;screen.appendChild(topStyle);frame.src=APP_URL;loading=true;
  }
  window.MorrowApp={
    open(){create();if(typeof switchScreen==='function')switchScreen('morrow-screen');else screen.classList.add('active');applyHostVisibility()},
    close(){if(typeof switchScreen==='function')switchScreen('home-screen');else screen.classList.remove('active');applyHostVisibility()},
    getCharacters:characters,
    getConversationContext:conversationContext,
    defaultIcon:DEFAULT_ICON
  };
})();
