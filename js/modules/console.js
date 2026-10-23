/* KISS console: bounded, redacted diagnostics; no request/response bodies are read. */
(function(g){
'use strict';
if(g.KissDiagnostics)return;
const MAX=500,KEEP=160,STORE='kiss.console.safe.v3',SESSION=Date.now().toString(36);
const child=/\/Morrow\.html$/i.test(location.pathname);
const apps={system:['系统','terminal'],chat:['404','orbit'],hearu:['HearU','headphones'],mono:['MONO','chat'],morrow:['MORROW','mail'],mcp:['MCP','nodes'],worldbook:['世界书','book'],widgets:['桌面与小组件','grid'],voice:['API 与语音','wave'],workshop:['工坊','pen'],data:['数据与备份','database'],personalize:['个性化','palette'],peek:['查手机与动态','phone'],journal:['日记','book'],shop:['商店','grid'],status:['状态面板','phone']};
const labels={log:'日志',warn:'警告',error:'报错'},states={start:'开始',end:'结束',response:'已响应',error:'失败',cancel:'取消',cache:'缓存',trigger:'已触发'};
const native={log:console.log.bind(console),warn:console.warn.bind(console),error:console.error.bind(console)};
let composing=false;
let logs=[],sequence=0,timer=0,saveTimer=0,ui=null,state={view:'home',app:'all',level:'all',feature:'all',query:'',auto:true,limit:60,detail:null},scope=null;
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function secrets(){const out=[];try{const d=g.db||{};for(const a of [d.apiSettings,d.secondaryApiSettings,...Object.values(d.apiPresets||{}),...Object.values(d.voiceSettings?.profiles||{})])if(a?.key)out.push(String(a.key));}catch{}return out.filter(s=>s.length>5).slice(0,80);}
function redact(value,max=1600){
 let s=String(value??'');if(s.length>max*3)s=s.slice(0,max*3);if(/"(?:messages|prompt|system_prompt|history|contents)"\s*:/.test(s))return '[结构化请求或响应内容已隐藏]';
 for(const key of secrets())s=s.split(key).join('[已隐藏]');
 s=s.replace(/data:[^\s"']+/gi,'[数据已隐藏]').replace(/blob:https?:\/\/[^\s"']+/gi,'[本地资源]')
 .replace(/\bBearer\s+[^\s"',}]+/gi,'Bearer [已隐藏]').replace(/\bsk-[\w-]{6,}/g,'[密钥已隐藏]')
 .replace(/((?:api[_-]?key|authorization|access[_-]?token|refresh[_-]?token|password|cookie|secret|token|key)\s*[=:]\s*["']?)[^\s"',;&}\]]+/gi,'$1[已隐藏]')
 .replace(/https?:\/\/[^\s<>"')]+/gi,u=>{try{const a=new URL(u);return a.origin+a.pathname.replace(/\/(?:[^/]{65,})(?=\/|$)/g,'/[已隐藏]')+(a.search?'?[参数已隐藏]':'');}catch{return '[地址]';}});
 return s.slice(0,max);
}
function safeObject(v,depth=0,seen=new WeakSet()){
 if(v instanceof Error)return {name:v.name,message:redact(v.message),stack:redact(v.stack,3000)};
 if(v==null||typeof v==='boolean'||typeof v==='number')return v;
 if(typeof v==='string')return redact(v,800);
 if(typeof v!=='object')return '['+typeof v+']';
 if(seen.has(v))return '[循环引用]';seen.add(v);
 if(depth>2)return '[对象]';
 if(v instanceof Element)return '['+v.tagName.toLowerCase()+']';
 if(v instanceof Blob)return {type:v.type,size:v.size};
 const out=Array.isArray(v)?[]:{};
 for(const key of Object.keys(v).slice(0,12)){
  if(/key|token|authorization|password|cookie|secret|messages|prompt|content|text|history|body|result|arguments|persona|description|lyrics|letter|translation|avatar|image|audio/i.test(key))out[key]='[已隐藏]';
  else try{out[key]=safeObject(v[key],depth+1,seen);}catch{out[key]='[无法读取]';}
 }return out;
}
function format(args){return args.map(v=>{if(v instanceof Error)return v.name+': '+redact(v.message);if(typeof v!=='string')return JSON.stringify(safeObject(v));if(v.length>6000)return '[长文本日志已省略]';if(/(?:messages|system[_ ]?prompt|prompt|contents|api[_-]?key|authorization)\s*[\"':=]/i.test(v))return '[结构化请求或配置内容已隐藏]';try{if(/^[{[]/.test(v.trim()))return JSON.stringify(safeObject(JSON.parse(v)));}catch{}return redact(v,1200);}).join(' ').slice(0,2000);}
function classifySource(s){
 if(/\/hearu\//i.test(s))return 'hearu';if(/Morrow\.html|\/morrow\//i.test(s))return 'morrow';if(/forum_app|MONO|\[论坛\]/i.test(s))return 'mono';if(/\/mcp\/|KissMCP|\[MCP\]/i.test(s))return 'mcp';
 if(/voice-|voiceService|音色|语音API|fetchAndPopulateModels/i.test(s))return 'voice';if(/worldbook|wb[A-Z]|世界书/i.test(s))return 'worldbook';if(/widget|小组件|setupHomeScreen/i.test(s))return 'widgets';if(/backup|app-data|导入备份|备份/i.test(s))return 'data';if(/image-workshop|workshop|drawing|绘图|生图/i.test(s))return 'workshop';if(/peek|Moments|查手机|动态生成/i.test(s))return 'peek';if(/journal|日记/i.test(s))return 'journal';if(/ShopSystem|shop|商店/i.test(s))return 'shop';if(/status_history|statusPanel|状态面板/i.test(s))return 'status';if(/customize|settings_presets|个性化/i.test(s))return 'personalize';if(/chat_ai|\/chat\.|chat_features|chat_ops|chat_archives/i.test(s))return 'chat';return null;
}
// Attribute stacks to their nearest application frame, not a boot caller further down.
function fromSource(s){
 const lines=String(s||'').split('\n'),frames=lines.filter(line=>/\bat\s|@https?:/.test(line));
 for(const line of frames){
  if(/\/modules\/console\.js/.test(line))continue;
  const app=classifySource(line);if(app)return app;
  if(/\/js\/main\.js/.test(line))return 'system';
 }
 return classifySource(frames.length?lines[0]:String(s||''));
}
function activeApp(){
 if(child)return 'morrow';
 if(document.getElementById('hearu-app')?.hidden===false)return 'hearu';
 const forum=document.getElementById('forumPage');if(forum&&!forum.hidden&&forum.style.display!=='none')return 'mono';
 const id=document.querySelector('.screen.active')?.id||'';
 return /morrow/.test(id)?'morrow':/mcp/.test(id)?'mcp':/world-book/.test(id)?'worldbook':/api|voice/.test(id)?'voice':/workshop|drawing/.test(id)?'workshop':/peek|moments/.test(id)?'peek':/customize|wallpaper/.test(id)?'personalize':/widget|home-screen/.test(id)?'widgets':/chat/.test(id)?'chat':'system';
}
function infer(source=''){return child?'morrow':fromSource(source)||scope?.app||activeApp();}
function featureOf(source){return /cloudsearch|searchSongs|搜索/.test(source)?'搜索':/qrCreate|qrCheck|login|登录/.test(source)?'账号':/lyric|歌词/.test(source)?'歌词':/playlist|sources|歌单|retainedSource/.test(source)?'歌单':/thought|describeSong|选曲留言/.test(source)?'AI 留言':/generateReply|后台回信|FreshRoleReply/.test(source)?'后台回信':/priority|mpAccelerate|mpBuy|mpClaim/.test(source)?'加速与游戏':/synthesize|speech|tts|voice|语音/.test(source)?'语音':/model|completion|generateContent|生成|fetchAiResponse/.test(source)?'模型请求':/import|Import|readFile|导入/.test(source)?'文件导入':/export|Export|导出/.test(source)?'导出':/preview|Preview|预览/.test(source)?'预览':/move|Move|移动/.test(source)?'移动':/play|播放/.test(source)?'播放':/connect|连接/.test(source)?'连接':'运行';}
function publicRow(r){return {id:r.id,session:r.session,app:apps[r.app]?r.app:'system',feature:redact(r.feature||'运行',40),level:labels[r.level]?r.level:'log',phase:redact(r.phase||'',24),title:redact(r.title||'运行记录',160),detail:redact(r.detail||'',2200),stack:redact(r.stack||'',3000),at:Number(r.at)||Date.now(),ended:Number(r.ended)||0,duration:Number.isFinite(r.duration)?Math.max(0,r.duration):null,status:Number(r.status)||0,endpoint:redact(r.endpoint||'',200),count:Math.max(1,Number(r.count)||1),trace:Array.isArray(r.trace)?r.trace.slice(0,5).map(t=>redact(t,90)):[]};}
try{const old=JSON.parse(sessionStorage.getItem(STORE)||'[]');if(Array.isArray(old))logs=old.slice(-KEEP).map(publicRow).map(r=>r.phase==='start'?{...r,phase:'cancel',level:'warn',title:r.title+' · 页面已重新载入',detail:'任务结果未确认'}:r);}catch{}
function persist(){saveTimer=0;try{sessionStorage.setItem(STORE,JSON.stringify(logs.slice(-KEEP)));}catch{}}
function changed(){if(!child&&!saveTimer)saveTimer=setTimeout(persist,1800);if(ui&&document.getElementById('console-screen')?.classList.contains('active')&&!timer)timer=setTimeout(()=>{timer=0;paint();},160);}
function record(data){
 try{
  const r=publicRow({...data,id:SESSION+'-'+(++sequence),session:SESSION,at:Number(data.at)||Date.now(),count:1});
  if(child){try{if(g.parent!==g&&g.parent.location.origin===location.origin&&g.parent.KissDiagnostics){return g.parent.KissDiagnostics.record({...r,app:'morrow'});}}catch{}}
  const previous=logs.at(-1);
  if(!data.unique&&previous&&previous.app===r.app&&previous.level===r.level&&previous.feature===r.feature&&previous.title===r.title&&previous.detail===r.detail&&r.at>=previous.at&&r.at-previous.at<1500){previous.count++;previous.at=r.at;changed();return previous.id;}
  logs.push(r);if(logs.length>MAX)logs.splice(0,logs.length-MAX);changed();return r.id;
 }catch{return null;}
}
function update(id,data){
 if(child){try{if(g.parent!==g&&g.parent.location.origin===location.origin&&g.parent.KissDiagnostics)return g.parent.KissDiagnostics.update(id,data);}catch{}}
 const i=logs.findIndex(r=>r.id===id);if(i<0)return;logs[i]=publicRow({...logs[i],...data,id});changed();
}
function wrap(fn,app,feature,title,options={}){
 if(typeof fn!=='function'||fn.__kissDiagnostic)return fn;
 const wrapped=function(...args){
  const actual=app==='auto'?infer(new Error().stack||''):app;
  if(options.throttle&&wrapped.last&&performance.now()-wrapped.last<options.throttle)return Reflect.apply(fn,this,args);
  wrapped.last=performance.now();const started=performance.now();const id=record({app:actual,feature,title:title+' · 开始',phase:'start',unique:true});
  const before=scope;scope={app:actual,feature};let result;
  const done=(v,error)=>{const aborted=error?.name==='AbortError',failed=error||v?.success===false;update(id,{title:title+(aborted?' · 已取消':failed?' · 失败':' · 处理结束'),phase:aborted?'cancel':failed?'error':'end',level:aborted?'warn':failed?'error':'log',detail:error?redact(error.message):v?.success===false?redact(v.error||'操作未完成'):'',stack:error?.stack||'',duration:performance.now()-started,ended:Date.now()});};
  try{result=Reflect.apply(fn,this,args);}catch(error){done(null,error);throw error;}finally{scope=before;}
  if(result&&typeof result.then==='function'){try{result.then(v=>done(v),err=>done(null,err));}catch{}}
  else done(result);return result;
 };Object.defineProperty(wrapped,'__kissDiagnostic',{value:true});return wrapped;
}
const api=g.KissDiagnostics={record,update,wrap,redact,installHooks,snapshot:()=>logs.map(publicRow),clear:()=>{logs=[];persist();changed();}};
for(const level of ['log','warn','error'])console[level]=function(...args){try{const stack=new Error().stack||'',message=format(args),err=args.find(v=>v instanceof Error);record({app:infer((err?.stack||stack)+' '+message),feature:featureOf((err?.stack||stack)+' '+message),level,title:err?err.name+': '+err.message:message.split('\n')[0].slice(0,150),detail:message,stack:err?.stack||''});}catch{}return native[level](...args);};
g.addEventListener('error',ev=>{if(ev.target!==g&&ev.target!==document){const tag=ev.target?.tagName;if(!['SCRIPT','LINK','IMG','AUDIO','VIDEO'].includes(tag))return;const el=ev.target,attr=tag==='LINK'?'href':'src',raw=el.getAttribute(attr),chosen=el.currentSrc||'';
 const hasSource=Boolean(raw?.trim()||chosen||el.getAttribute('srcset')?.trim());
 const src=chosen||(raw?.trim()?el[attr]||raw:'');
 const container=el.closest('.screen[id],#hearu-app,#forumPage'),where=[tag,el.id?'#'+el.id:'',container?'所在页面 #'+container.id:''].filter(Boolean).join(' · ');
 record({app:infer(src||container?.id||''),feature:'资源加载',level:'error',title:hasSource?'资源加载失败 · '+tag:'资源地址为空 · '+tag,endpoint:src,detail:where+'\n'+(hasSource?(src?redact(src,200):'浏览器未提供所选资源地址'):'未设置有效地址；请检查该元素的资源配置')});return;}const err=ev.error;record({app:infer(err?.stack||ev.filename||''),feature:'脚本错误',level:'error',title:err?.name||'Error',detail:err?.message||ev.message,stack:err?.stack||'',endpoint:ev.filename});},true);
g.addEventListener('unhandledrejection',ev=>{record({app:infer(ev.reason?.stack||''),feature:'异步任务',level:'error',title:'未处理的异步错误',detail:ev.reason instanceof Error?ev.reason.message:format([ev.reason]),stack:ev.reason?.stack||''});});
if(g.fetch){const fetch=g.fetch;g.fetch=function(...args){
 const source=new Error().stack||'',input=args[0],method=args[1]?.method||input?.method||'GET';let endpoint='';try{const u=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href);if(!/^https?:$/.test(u.protocol))return Reflect.apply(fetch,this,args);endpoint=u.origin+u.pathname.replace(/\b\d{5,}\b/g,':id');}catch{return Reflect.apply(fetch,this,args);}
 const app=infer(source),feature=scope?.feature||featureOf(source+' '+endpoint),started=performance.now();const id=record({app,feature,phase:'start',title:method+' 请求',endpoint,detail:'等待响应',unique:true});
 let promise;try{promise=Reflect.apply(fetch,this,args);}catch(error){update(id,{level:'error',phase:'error',title:'请求失败',detail:error.message,stack:error.stack,duration:performance.now()-started});throw error;}
 promise.then(res=>{update(id,{level:res.ok?'log':'error',phase:res.ok?'response':'error',title:res.ok?'请求已响应':'请求失败 · HTTP '+res.status,detail:res.ok?'已收到响应头；业务结果由对应功能日志记录':'HTTP '+res.status+' '+res.statusText,status:res.status,duration:performance.now()-started,ended:Date.now(),trace:[apps[app]?.[0]||'系统',feature,'HTTP '+res.status]});},error=>{const abort=error.name==='AbortError';update(id,{level:abort?'warn':'error',phase:abort?'cancel':'error',title:abort?'请求已取消':'请求失败',detail:error.message,stack:error.stack,duration:performance.now()-started,ended:Date.now()});});
 return promise;
};}
// Metadata-only XHR capture, retaining the native instance, events and return values.
if(g.XMLHttpRequest){const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;const meta=new WeakMap();XMLHttpRequest.prototype.open=function(method,url,...rest){const result=Reflect.apply(open,this,[method,url,...rest]);try{const u=new URL(url,location.href);meta.set(this,{method,endpoint:u.origin+u.pathname,app:infer(new Error().stack||'')});}catch{}return result;};XMLHttpRequest.prototype.send=function(...args){const m=meta.get(this);if(m){const started=performance.now(),id=record({...m,feature:'接口',phase:'start',title:m.method+' 请求',unique:true});this.addEventListener('loadend',()=>update(id,{level:this.status>=200&&this.status<400?'log':'error',phase:this.status>=200&&this.status<400?'response':'error',title:'XHR · HTTP '+this.status,status:this.status,ended:Date.now(),duration:performance.now()-started}),{once:true});}return Reflect.apply(send,this,args);};}
function hook(obj,key,app,feature,title,options){try{if(obj&&typeof obj[key]==='function')obj[key]=wrap(obj[key],app,feature,title,options);}catch{}}
function installHooks(){
 const specs=[
 ['getAiReply','chat','聊天','生成回复'],['generateAiReply','chat','聊天','生成回复'],['fetchAiResponse','auto','模型请求','读取模型响应'],['getCallReply','chat','通话','生成通话回复'],['generateCallSummary','chat','通话','生成通话总结'],
 ['fetchAndPopulateModels','voice','模型列表','拉取模型列表'],['generateAndRenderPeekContent','peek','动态生成','生成手机动态'],['generateBatchPeekContent','peek','动态生成','批量生成手机动态'],['generatePeekMoments','peek','动态生成','生成动态'],
 ['setupCleanImageCache','data','初始化','初始化图片缓存清理'],['wbImportFiles','worldbook','文件导入','导入文件'],['wbSaveEditor','worldbook','条目保存','保存条目'],['wbMoveTo','worldbook','移动','移动条目'],['wbNewFolder','worldbook','文件夹','新建文件夹'],
 ['renderWidgetAddModal','widgets','预览','读取组件预览'],['addWidgetToHome','widgets','添加组件','添加小组件'],['deleteWidgets','widgets','组件管理','删除组件'],['exportWidgets','widgets','导出','导出小组件'],
 ['kpImportGlobalCssFile','personalize','CSS 导入','导入 CSS 预设'],['kpApplyWallpaperURL','personalize','壁纸','应用 URL 壁纸'],['kpApplyWallpaperFile','personalize','壁纸','上传壁纸'],['applyGlobalCssPreset','personalize','CSS 预设','应用 CSS 预设'],['saveCurrentFontAsPreset','personalize','字体','保存字体预设'],
 ['executeImageGeneration','workshop','生图','生成图片'],['handleRegenerate','chat','重生成','重新生成回复'],['pauseAiGeneration','chat','生成控制','暂停生成'],['generateSharedReply','morrow','后台回信','共享回信检查'],['generateReply','morrow','后台回信','回信检查'],['mpAccelerate','morrow','加速','加速处理'],['mpBuy','morrow','道具','购买加速道具'],['mpStartGame','morrow','2048','打开游戏'],['mpClaimGame','morrow','2048','领取游戏奖励'],['generateCollectionImage','morrow','收藏生图','生成收藏图片'],['mnMaybeProactive','morrow','主动来信','主动来信检查']];
 for(const [name,app,feature,title]of specs){if(app==='morrow'&&!child)continue;hook(g,name,app,feature,title,/检查/.test(title)?{throttle:60000}:{});}
 for(const [name,feature,title]of [['readFile','导入','读取备份'],['importData','导入','导入备份'],['exportBlob','导出','导出备份'],['hydrateChat','历史记录','读取聊天历史'],['collectUnused','清理','清理闲置资源']])hook(g.PhoneBackup,name,'data',feature,title);
 for(const [name,feature,title]of [['synthesize','语音合成','生成语音'],['list','音色与模型','拉取语音列表'],['clearCache','缓存','清理语音缓存']])hook(g.KissVoiceService,name,name==='synthesize'?'auto':'voice',feature,title);
 for(const [name,feature,title]of [['importData','导入','恢复独立应用'],['snapshot','导出','读取独立应用快照']])hook(g.KissAppData,name,'data',feature,title);
 for(const [name,feature,title]of [['generateForumPosts','帖子生成','生成帖子'],['generateNewDirectMessages','私信','生成私信'],['sendDirectMessage','私信','发送私信'],['submitForumPost','发帖','发布帖子'],['submitForumComment','评论','发布评论'],['monoTranslatePost','翻译','翻译帖子'],['monoRefreshQuotes','转发','刷新引用'],['monoAutoTick','主动动态','检查主动动态']])hook(g.ForumApp,name,'mono',feature,title,name==='monoAutoTick'?{throttle:60000}:{});
 hook(g.KissMCPRuntime,'connect','mcp','连接','连接工具服务');
 hook(g.KissWidgetRuntime,'preview','widgets','预览','创建组件预览');
 hook(g.ForumApp,'open','mono','启动','打开 MONO');hook(g.MorrowApp,'open','morrow','启动','打开 MORROW');
}
const mcpRows=new Map();
function syncMcp(){try{for(const entry of (g.KissMCPRuntime?.logs?.()||[]).slice(0,25)){const data={at:entry.startedAt||Date.now(),app:'mcp',feature:'工具调用',level:entry.status==='failure'?'error':'log',phase:entry.status==='running'?'start':entry.status==='failure'?'error':'end',title:'工具调用 · '+(entry.status==='running'?'开始':entry.status==='failure'?'失败':'完成'),detail:'服务：'+redact(entry.service,80)+' · 工具：'+redact(entry.tool,80),duration:entry.duration||0,ended:entry.finishedAt||0,trace:[entry.source||'工具调用','MCP',entry.service||'工具服务']};const id=mcpRows.get(entry.id);if(id)update(id,data);else{mcpRows.set(entry.id,record({...data,unique:true}));if(mcpRows.size>200)mcpRows.delete(mcpRows.keys().next().value);}}}catch{}}
g.addEventListener('kiss-mcp-activity',syncMcp);

// Explicit UI intent records complement completion/error records, without reading text fields.
const actions={hearu:{'ask-song-thought':['AI 留言','重新生成选曲留言'],'song-thought':['AI 留言','打开保存的选曲留言'],'refresh-sources':['歌单','刷新歌单'],'refresh-source':['歌单','刷新歌曲'],'source-replace':['待播','替换待播列表'],'source-append':['待播','追加待播列表'],'send':['聊天','发送聊天请求'],'stop':['聊天','暂停生成']},worldbook:{'wb-menu-new-entry':['条目','新建条目'],'wb-menu-new-folder':['文件夹','新建文件夹'],'wb-menu-import':['文件导入','选择导入文件'],'wb-editor-import':['文件导入','选择导入正文'],'move-selected-world-books-btn':['移动','选择移动目标']}};
document.addEventListener('click',ev=>{const b=ev.target.closest?.('button,[data-hu],[data-act]');if(!b||b.closest('#console-screen'))return;let data;
 if(b.dataset.hu&&actions.hearu[b.dataset.hu])data={app:'hearu',...Object.fromEntries(['feature','title'].map((k,i)=>[k,actions.hearu[b.dataset.hu][i]]))};
 if(actions.worldbook[b.id])data={app:'worldbook',...Object.fromEntries(['feature','title'].map((k,i)=>[k,actions.worldbook[b.id][i]]))};
 if(data)record({...data,phase:'trigger',detail:'操作已触发；完成状态见后续日志'});
},true);
g.addEventListener('pagehide',()=>{if(!child)persist();});
const glyphs={terminal:'M4 6l5 6-5 6M12 19h8',close:'M6 6l12 12M18 6 6 18',back:'m15 5-7 7 7 7',copy:'M9 9h11v12H9zM5 15H3V3h12v2',export:'M12 16V3m-5 5 5-5 5 5M5 14v7h14v-7',trash:'M4 7h16M9 7V3h6v4M6 7l1 14h10l1-14M10 10v7m4-7v7',headphones:'M4 14v-3a8 8 0 0 1 16 0v3M4 12h3v9H4zm13 0h3v9h-3z',orbit:'M3 12a9 9 0 0 0 18 0 9 9 0 0 0-18 0M3 19 21 5',chat:'M3 5h18v12H9l-6 4z',mail:'M3 5h18v15H3zM3 5l9 8 9-8',nodes:'M12 7V4m-6 13L3 20m15-3 3 3M12 7l-6 10m6-10 6 10M9 4a3 3 0 1 0 6 0 3 3 0 0 0-6 0M3 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0m12 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0',book:'M12 6C8 2 3 3 3 3v17s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 3zm0 0v16',grid:'M3 3h7v7H3zm11 0h7v7h-7zm0 11h7v7h-7zM3 14h7v7H3z',wave:'M3 10v4m4-7v10m5-14v18m5-14v10m4-7v4',pen:'m4 20 2-7L17 2l5 5-11 11-7 2zm2-7 5 5',database:'M3 5c0-5 18-5 18 0s-18 5-18 0zm0 0v14c0 5 18 5 18 0V5M3 12c0 5 18 5 18 0',palette:'M12 3c12 0 12 13 5 13h-4c-3 0-3 5-6 5C-2 21-2 3 12 3z',phone:'M6 2h12v20H6zM10 18h4',search:'M16 16l6 6M3 10a7 7 0 1 0 14 0 7 7 0 0 0-14 0',more:'M4 12h1m6 0h1m6 0h1',warn:'m12 3 10 18H2zm0 5v6m0 3v1',error:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v7m0 3v1'};
function icon(name){return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${glyphs[name]||glyphs.terminal}"/></svg>`;}
function filtered(){return logs.filter(r=>(state.app==='all'||r.app===state.app)&&(state.level==='all'||r.level===state.level)&&(state.feature==='all'||r.feature===state.feature)&&(!state.query||(r.title+' '+r.detail+' '+r.feature+' '+apps[r.app][0]).toLowerCase().includes(state.query.toLowerCase()))).slice().sort((a,b)=>b.at-a.at);}
function time(t){return new Date(t).toLocaleTimeString('zh-CN',{hour12:false})+'.'+String(t%1000).padStart(3,'0');}
function row(r){const app=apps[r.app];return `<article class="kc-log ${e(r.level)}" data-log="${e(r.id)}" tabindex="0" role="button" aria-label="查看${e(app[0])}日志详情"><i class="kc-dot"></i><div class="kc-log-icon">${icon(app[1])}</div><div class="kc-log-copy"><div class="kc-log-meta"><span>${e(state.view==='home'?app[0]:r.feature)}</span><time>${time(r.at).slice(0,8)}</time></div><strong>${e(r.title)}</strong><p>${e(r.detail||states[r.phase]||r.feature)}${r.count>1?' ×'+r.count:''}</p></div><button class="kc-copy" data-copy="${e(r.id)}" aria-label="复制此条日志">${icon('copy')}</button></article>`;}
function appCard(id){const a=apps[id],items=logs.filter(r=>r.app===id),n=items.filter(r=>r.level==='error').length;return `<button class="kc-app-card" data-app="${id}"><span class="kc-app-icon">${icon(a[1])}</span><span><strong>${e(a[0])}</strong><small>${items.length} 条记录${n?` · ${n} 报错`:''}</small></span></button>`;}
function tabs(){return `<nav class="kc-tabs" aria-label="日志级别">${['all','log','warn','error'].map(k=>`<button data-level="${k}" class="${state.level===k?'selected':''}" aria-pressed="${state.level===k}">${k==='all'?'全部':labels[k]}</button>`).join('')}</nav>`;}
function controls(){const fs=[...new Set(logs.filter(r=>state.app==='all'||r.app===state.app).map(r=>r.feature))].sort();return `<div class="kc-filters"><select id="kc-feature" aria-label="筛选功能"><option value="all">全部功能</option>${fs.map(f=>`<option ${state.feature===f?'selected':''}>${e(f)}</option>`).join('')}</select><label class="kc-search">${icon('search')}<input id="kc-query" placeholder="搜索日志" value="${e(state.query)}" aria-label="搜索日志"></label></div>`;}
function stats(){return `<section class="kc-summary"><div class="kc-session"><span>● 正在记录</span><small>最近 ${MAX} 条以内</small></div><div class="kc-metrics">${['log','warn','error'].map(k=>`<button data-stat="${k}"><strong>${logs.filter(r=>r.level===k).length}</strong><small>${labels[k]}</small></button>`).join('')}</div></section>`;}
function detail(r){const a=apps[r.app];return `<section class="kc-detail-top"><div class="kc-identity"><span class="kc-app-icon">${icon(a[1])}</span><div><small>${e(a[0])} / ${e(r.feature)}</small><h2>${e(r.title)}</h2></div></div><div class="kc-message ${r.level==='error'?'error':''}">${icon(r.level==='error'?'error':'terminal')}<div><strong>${e(r.detail||states[r.phase]||'运行记录')}</strong>${r.status?`<small>HTTP ${r.status}</small>`:''}</div></div><dl class="kc-metadata"><div><dt>时间</dt><dd>${time(r.at)}</dd></div><div><dt>阶段</dt><dd>${e(states[r.phase]||r.feature)}</dd></div><div><dt>耗时</dt><dd>${r.duration==null?'未记录':r.duration<1000?Math.round(r.duration)+' ms':(r.duration/1000).toFixed(2)+' s'}</dd></div><div><dt>级别</dt><dd class="${r.level}">${labels[r.level]}${r.count>1?' ×'+r.count:''}</dd></div></dl></section><section class="kc-section"><h3>调用过程</h3><div class="kc-trace">${(r.trace.length?r.trace:[a[0],r.feature,states[r.phase]||labels[r.level]]).map((t,i)=>`<div><i>${i+1}</i><strong>${e(t)}</strong></div>`).join('')}</div></section><section class="kc-section"><h3>技术详情</h3><pre>${e([r.endpoint,r.stack||r.detail||r.title].filter(Boolean).join('\n'))}</pre><small class="kc-privacy">不采集请求正文、响应正文或密钥；仅记录运行元信息</small></section><div class="kc-detail-buttons"><button class="kc-button" data-copy="${r.id}">${icon('copy')}复制详情</button><button class="kc-button primary" data-export="${r.id}">${icon('export')}导出此条</button></div>`;}
function paint(){if(!ui||composing)return;ui.dataset.view=state.view;const scroll=ui.querySelector('.kc-content'),top=scroll?.scrollTop||0;const focus=document.activeElement?.id,selection=focus==='kc-query'?document.activeElement.selectionStart:null;
 const r=logs.find(r=>r.id===state.detail);if(state.view==='detail'&&!r){state.view=state.app==='all'?'home':'app';state.detail=null;}
 const home=state.view==='home',isDetail=state.view==='detail',app=apps[state.app];
 ui.innerHTML=`<header class="kc-header"><button data-back aria-label="${home?'关闭控制台':'返回'}">${icon(home?'terminal':'back')}</button><div><h1>${isDetail?'日志详情':home?'控制台':e(app?.[0]||'全部日志')}</h1>${home?'<small>运行记录</small>':''}</div><button ${home?'data-close':'data-apps'} aria-label="${home?'关闭':'切换应用'}">${icon(home?'close':'more')}</button></header><main class="kc-content">${isDetail?detail(r):home?`${stats()}<section class="kc-section"><h3>按应用查看<button data-apps>全部 ${icon('back')}</button></h3><div class="kc-apps">${['chat','hearu','mono','morrow','mcp'].map(appCard).join('')}<button class="kc-app-card" data-apps><span class="kc-app-icon">${icon('more')}</span><span><strong>更多</strong><small>世界书、桌面、语音等</small></span></button></div></section><section class="kc-section"><h3>最近记录<button data-all>全部日志</button></h3><div class="kc-timeline">${filtered().slice(0,3).map(row).join('')||'<p class="kc-empty">暂无运行记录</p>'}</div></section>`:`<div class="kc-identity"><span class="kc-app-icon">${icon(app?.[1]||'terminal')}</span><div><h2>${e(app?.[0]||'全部应用')}</h2><small>${state.app==='hearu'?'一起听 · 运行日志':'运行日志'}</small></div></div>${tabs()}${controls()}<div class="kc-list-label">${filtered().length} 条记录 · 按时间倒序</div><div class="kc-timeline">${filtered().slice(0,state.limit).map(row).join('')||'<p class="kc-empty">没有符合条件的日志</p>'}</div>${filtered().length>state.limit?'<button class="kc-load" data-load>加载更早记录</button>':''}`}</main>${isDetail?'':`<footer class="kc-footer"><label><input id="kc-auto" type="checkbox" ${state.auto?'checked':''}><span class="kc-switch"></span>自动滚动</label><button data-export="filtered">${icon('export')}导出</button><button data-clear>${icon('trash')}清空</button></footer>`}`;
 const next=ui.querySelector('.kc-content');if(next)next.scrollTop=state.auto&&state.view==='app'?0:top;
 if(focus==='kc-query'){const input=ui.querySelector('#kc-query');input?.focus({preventScroll:true});try{input?.setSelectionRange(selection,selection);}catch{}}
}
function textFor(r){return `[${new Date(r.at).toLocaleString('zh-CN',{hour12:false})}] [${apps[r.app][0]} / ${r.feature}] [${labels[r.level]}]\n${r.title}\n${r.detail}\n${r.endpoint}\n${r.duration==null?'':'耗时 '+Math.round(r.duration)+' ms'}\n${r.stack}`.trim();}
async function copy(r){const text=textFor(r);try{await navigator.clipboard.writeText(text);}catch{const t=document.createElement('textarea');t.value=text;t.style.cssText='position:fixed;left:-9999px';document.body.append(t);t.select();try{if(!document.execCommand('copy'))throw Error('无法复制');}finally{t.remove();}}if(typeof g.showToast==='function')g.showToast('已复制日志');}
function download(rows){const blob=new Blob([JSON.stringify({version:3,exportedAt:new Date().toISOString(),logs:rows.map(publicRow)},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Kiss_logs_'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function dialog(title,content){const el=document.createElement('div');el.className='kc-overlay';el.innerHTML=`<section class="kc-dialog" role="dialog" aria-modal="true" aria-label="${e(title)}"><header><h2>${e(title)}</h2><button data-dismiss aria-label="关闭">${icon('close')}</button></header>${content}</section>`;document.getElementById('console-screen').append(el);const before=document.activeElement,close=()=>{el.remove();document.removeEventListener('keydown',key);before?.focus?.();};const key=ev=>{if(ev.key==='Escape')close();};document.addEventListener('keydown',key);el.addEventListener('click',ev=>{if(ev.target===el||ev.target.closest('[data-dismiss]'))close();});el.querySelector('button')?.focus();return {el,close};}
function chooseApps(){const d=dialog('按应用查看',`<div class="kc-app-dialog">${['all',...Object.keys(apps)].map(id=>`<button data-choose="${id}">${icon(apps[id]?.[1]||'grid')}<span>${e(apps[id]?.[0]||'全部应用')}</span><small>${logs.filter(r=>id==='all'||r.app===id).length}</small></button>`).join('')}</div>`);d.el.addEventListener('click',ev=>{const b=ev.target.closest('[data-choose]');if(!b)return;state.app=b.dataset.choose;state.view='app';state.feature=state.level='all';state.query='';state.limit=60;d.close();paint();});}
function mount(){installHooks();hookToast();syncMcp();if(child)return;const screen=document.getElementById('console-screen');if(!screen)return;ui=document.getElementById('kc-root');if(!ui)return;
 ui.addEventListener('click',ev=>{const b=ev.target.closest('button');
 if(b?.hasAttribute('data-close')||b?.hasAttribute('data-back')&&state.view==='home'){ev.stopPropagation();if(typeof switchScreen==='function')switchScreen('home-screen');return;}
 if(b?.hasAttribute('data-back')){state.view=state.view==='detail'?(state.app==='all'?'home':'app'):'home';if(state.view==='home'){state.app='all';state.query='';state.feature=state.level='all';}paint();return;}
 if(b?.hasAttribute('data-apps'))return chooseApps();
 if(b?.dataset.app||b?.hasAttribute('data-all')){state.app=b.dataset.app||'all';state.view='app';state.feature=state.level='all';state.query='';state.limit=60;paint();return;}
 if(b?.dataset.stat){state.app='all';state.view='app';state.level=b.dataset.stat;paint();return;}
 if(b?.dataset.level){state.level=b.dataset.level;state.limit=60;paint();return;}
 if(b?.dataset.copy){const r=logs.find(r=>r.id===b.dataset.copy);if(r)copy(r).catch(()=>g.showToast?.('复制失败'));return;}
 if(b?.dataset.export){const rs=b.dataset.export==='filtered'?filtered():logs.filter(r=>r.id===b.dataset.export);return download(rs);}
 if(b?.hasAttribute('data-load')){state.limit+=60;paint();return;}
 if(b?.hasAttribute('data-clear')){const ids=new Set((state.view==='home'?logs:filtered()).map(r=>r.id));const d=dialog('清空日志',`<p>清空${state.view==='home'?'全部':'当前筛选的'} ${ids.size} 条日志？不会清理应用数据。</p><button class="kc-button primary" data-confirm-clear>确认清空</button>`);d.el.querySelector('[data-confirm-clear]').onclick=()=>{logs=logs.filter(r=>!ids.has(r.id));persist();d.close();paint();};return;}
 const article=ev.target.closest('[data-log]');if(article){state.detail=article.dataset.log;state.view='detail';paint();}
 });
 ui.addEventListener('keydown',ev=>{if(ev.target.matches('[data-log]')&&['Enter',' '].includes(ev.key)){ev.preventDefault();state.detail=ev.target.dataset.log;state.view='detail';paint();}});
 ui.addEventListener('input',ev=>{if(ev.target.id==='kc-query'){if(ev.isComposing)return;state.query=ev.target.value;state.limit=60;paint();}});
 ui.addEventListener('compositionstart',()=>{composing=true;});ui.addEventListener('compositionend',ev=>{composing=false;if(ev.target.id==='kc-query'){state.query=ev.target.value;state.limit=60;paint();}});
 ui.addEventListener('change',ev=>{if(ev.target.id==='kc-feature'){state.feature=ev.target.value;paint();}if(ev.target.id==='kc-auto')state.auto=ev.target.checked;});
 new MutationObserver(()=>{if(screen.classList.contains('active'))paint();}).observe(screen,{attributes:true,attributeFilter:['class']});paint();
}
g.renderConsoleLogs=()=>paint();g.clearConsoleLogs=()=>api.clear();
function hookToast(){if(typeof g.showToast!=='function'||g.showToast.__kissToast)return;const fn=g.showToast;const next=function(...args){const msg=String(args[0]||'');if(/失败|错误|无法|已保存|已导入|已移动|已删除|已恢复|已更新|已添加|已加入/.test(msg)){const source=new Error().stack||'';record({app:infer(source),feature:featureOf(source),level:/失败|错误|无法/.test(msg)?'error':'log',phase:/失败|错误|无法/.test(msg)?'error':'end',title:'操作提示',detail:redact(msg,300)});}return Reflect.apply(fn,this,args);};next.__kissToast=true;g.showToast=next;}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
