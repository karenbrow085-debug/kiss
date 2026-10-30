/* Offline HTML artifacts: collapsed by default; rendered only inside an opaque sandbox. */
(() => {
'use strict';
const VOID=new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const TAG=/<\/?[a-z][\w:-]*\b(?:"[^"]*"|'[^']*'|[^'">])*>|<!--[\s\S]*?(?:-->|$)|<!doctype[^>]*>/ig;
const START=/<(?:!doctype\b|!--|\/?(?:html|head|body|style|script|div|p|section|article|main|header|footer|aside|nav|table|thead|tbody|tfoot|tr|td|th|ul|ol|li|dl|dt|dd|h[1-6]|details|summary|figure|figcaption|form|button|label|input|textarea|select|option|a|span|strong|em|b|i|u|s|blockquote|pre|code|svg|canvas|img|video|audio|iframe|link|meta|br|hr)\b)/ig;
function htmlEnd(source,start){
 const scanner=new RegExp(TAG.source,'ig');scanner.lastIndex=start;let depth=0,seen=false,documentMode=false;
 for(let token; (token=scanner.exec(source));){
  const value=token[0];if(value.startsWith('<!--')){if(!seen)return scanner.lastIndex;continue;}
  if(/^<!doctype/i.test(value)){documentMode=true;seen=true;continue;}
  const match=/^<(\/?)([\w:-]+)/.exec(value);if(!match)continue;const closing=!!match[1],name=match[2].toLowerCase();
  if(name==='html')documentMode=true;
  if(closing){depth--;if((documentMode&&name==='html')||(!documentMode&&depth<=0))return scanner.lastIndex;continue;}
  seen=true;if(!VOID.has(name)&&!value.endsWith('/>'))depth++;
  if(['script','style','textarea','title'].includes(name)){const end=new RegExp('</'+name+'\\s*>','ig');end.lastIndex=scanner.lastIndex;const close=end.exec(source);if(!close)return source.length;scanner.lastIndex=end.lastIndex;depth--;}
  if(!documentMode&&depth<=0)return scanner.lastIndex;
 }
 return source.length; // Truncated markup stays contained in the preview too.
}
function partition(text){
 const source=String(text??''),parts=[];let at=0;
 const push=(type,value)=>{if(!value)return;parts.push({type,text:value});};
 while(at<source.length){
  const fence=/```([^\r\n`]*)\r?\n/g;fence.lastIndex=at;const fenced=fence.exec(source);
  const start=new RegExp(START.source,'ig');start.lastIndex=at;const raw=start.exec(source);
  if(!raw&&!fenced){push('text',source.slice(at));break;}
  let begin,end,value;
  if(fenced&&(!raw||fenced.index<=raw.index)){begin=fenced.index;const contentStart=fenced.index+fenced[0].length;const close=source.indexOf('```',contentStart);end=close<0?source.length:close+3;value=source.slice(contentStart,close<0?source.length:close).trim();const language=fenced[1].trim().toLowerCase();if(['xml','html','htm'].includes(language)&&!new RegExp(START.source,'i').test(value)){push('text',source.slice(at,begin));push('text',value);at=end;continue;}if(!['html','htm','xml','svg'].includes(language)&&(language||!value.startsWith('<'))){push('text',source.slice(at,end));at=end;continue;}}
  else{begin=raw.index;end=htmlEnd(source,begin);value=source.slice(begin,end);}
  const between=source.slice(at,begin);if(between.trim())push('text',between);else if(parts.at(-1)?.type==='text')parts.at(-1).text+=between;
  push('html',value);at=Math.max(end,begin+1);
 }
 const result=[];let pending='';
 for(const part of parts){if(part.type==='html'&&/^(?:\s*(?:<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->))*\s*$/i.test(part.text)){pending+=part.text;continue;}if(part.type==='html'){result.push({...part,text:pending+part.text});pending='';}else result.push(part);}
 if(pending)result.push({type:'html',text:pending});return result;
}
function title(html){const m=/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)||/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(html);return m?m[1].replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,44)||'HTML preview':'HTML preview';}
function compatibilityBridge(token,context){
 const host=window.parent,emit=(type,data={})=>host.postMessage({type,token,...data},'*');
 // Imported widgets see a private Tavern-shaped document, never the app document.
 for(const name of ['parent','top'])try{Object.defineProperty(window,name,{value:window,configurable:true});}catch{}
 const storage=new Map(),memory={getItem:k=>storage.get(String(k))??null,setItem:(k,v)=>storage.set(String(k),String(v)),removeItem:k=>storage.delete(String(k)),clear:()=>storage.clear(),key:i=>[...storage.keys()][i]??null};
 try{Object.defineProperty(window,'localStorage',{value:memory,configurable:true});}catch{}
 const events={on(){},off(){},removeListener(){},emit(){}};
 const chat=[{mes:context.text||'',is_user:false,name:context.name||'Character'}];
 window.SillyTavern={getContext:()=>({chat,chatId:context.messageId,eventSource:events,event_types:{CHAT_CHANGED:'chat-changed',MESSAGE_SWIPED:'message-swiped',MESSAGE_DELETED:'message-deleted'},saveChat:async()=>{}})};
 window.getLastMessageId=()=>0;window.getCurrentMessageId=()=>0;
 let rpcId=0;const pending=new Map();
 const rpc=(method,args=[])=>new Promise((resolve,reject)=>{if(pending.size>=32){reject(Error('前端请求过多，请稍后重试'));return;}const id=++rpcId,timer=setTimeout(()=>{pending.delete(id);reject(Error('酒馆助手接口超时：'+method));},method==='generate'?120000:30000);pending.set(id,{resolve,reject,timer});emit('kiss-offline-helper-call',{id,method,args,messageIds:(context.chat||[]).map(m=>m._kissId)});});
 addEventListener('message',event=>{const d=event.data;if(event.source!==host||d?.token!==token)return;if(d.type==='kiss-offline-helper-result'){const p=pending.get(d.id);if(!p)return;pending.delete(d.id);clearTimeout(p.timer);d.error?p.reject(Error(d.error)):p.resolve(d.result);if(d.snapshot)window.__kissHelperSnapshot?.(d.snapshot);}else if(d.type==='kiss-offline-helper-state')window.__kissHelperSnapshot?.(d.snapshot);else if(d.type==='kiss-offline-helper-event')window.__kissHelperEvent?.(d.name,...(d.args||[]));});
 let input;const choose=text=>{text=String(text??'').trim();if(text&&text.length<=20000)emit('kiss-offline-html-choice',{text});if(input)input.value='';};
 window.triggerSlash=command=>{const match=/^\/setinput(?:\s+|$)([\s\S]*)/.exec(String(command));if(match)choose(match[1]);return Promise.resolve();};
 window.setInput=choose;window.setChatInput=choose;
 if(window.__kissHelperInstall)window.__kissHelperInstall(context,rpc,(kind,value)=>emit('kiss-offline-helper-notify',{kind,value}));
 const setUp=()=>{input=document.createElement('textarea');input.id='send_textarea';input.hidden=true;input.setAttribute('data-kiss-bridge','');let inputValue='';Object.defineProperty(input,'value',{get:()=>inputValue,set:value=>{inputValue=String(value??'');Promise.resolve().then(()=>{if(inputValue)choose(inputValue);});}});input.addEventListener('input',()=>choose(input.value));input.addEventListener('change',()=>choose(input.value));document.body.append(input);
  // Handle common native choice markup when it has no own click handler.
  document.addEventListener('click',event=>{const option=event.target.closest?.('[data-choice],[data-option],[data-action],.st-choice,.plot-option');if(!option||typeof option.onclick==='function')return;const declared=option.getAttribute('data-choice')||option.getAttribute('data-option');if(declared)choose(declared);});
 };
 document.addEventListener('DOMContentLoaded',()=>{setUp();window.__kissHelperReady?.();},{once:true});
 let scheduled=false,floating=false,lastReport=0;const queue=()=>{if(!scheduled){scheduled=true;setTimeout(()=>requestAnimationFrame(report),Math.max(0,100-(performance.now()-lastReport)));}};
 function report(){scheduled=false;lastReport=performance.now();if(!document.body)return;const all=document.body.querySelectorAll('*'),rects=[];
  let inspected=0;for(const el of all){if(++inspected>3000)break;if(el.hasAttribute('data-kiss-bridge'))continue;const style=getComputedStyle(el);if(style.position!=='fixed'||style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)continue;const r=el.getBoundingClientRect();if(r.width>0&&r.height>0&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight)rects.push({x:Math.max(0,r.left-3),y:Math.max(0,r.top-3),right:Math.min(innerWidth,r.right+3),bottom:Math.min(innerHeight,r.bottom+3)});}
  if(rects.length)floating=true;
  let bottom=0,width=0;for(const el of document.body.children){if(['SCRIPT','STYLE','LINK','META'].includes(el.tagName)||el.hasAttribute('data-kiss-bridge')||getComputedStyle(el).position==='fixed')continue;const r=el.getBoundingClientRect();bottom=Math.max(bottom,r.bottom+scrollY+(parseFloat(getComputedStyle(el).marginBottom)||0));width=Math.max(width,r.right+scrollX);}
  emit('kiss-offline-html-size',{height:Math.max(80,bottom+8),width:Math.max(240,width+8),floating,rects:rects.slice(0,20)});
 }
 document.addEventListener('DOMContentLoaded',()=>{queue();new ResizeObserver(queue).observe(document.body);new MutationObserver(queue).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});document.addEventListener('click',event=>{const a=event.target.closest?.('a');if(a&&(a.getAttribute('href')||'').startsWith('#')){event.preventDefault();document.getElementById(a.getAttribute('href').slice(1))?.scrollIntoView();}else if(a)event.preventDefault();queue();});document.addEventListener('load',queue,true);document.fonts?.ready.then(queue);});
 addEventListener('resize',queue);addEventListener('load',queue);addEventListener('transitionend',queue);addEventListener('animationend',queue);
}

function documentHTML(html,token,context={},libraries=''){
 const policy=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' ${location.origin}; style-src 'unsafe-inline' https:; img-src data: blob: https: http:; font-src data: https:; media-src data: blob: https:; connect-src 'none'; form-action 'none'; base-uri 'none'">`;
 const style='<meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--SmartThemeBodyColor:#303136;--SmartThemeQuoteColor:#8a8a94;--SmartThemeBorderColor:#e0e0e6;--mainFontFamily:Arial,sans-serif}html{overscroll-behavior:contain}body{margin:0;overflow-wrap:anywhere;background:transparent}img,video,canvas,svg{max-width:100%}*{box-sizing:border-box}</style>';
 const boot='('+compatibilityBridge.toString()+')('+JSON.stringify(token)+','+JSON.stringify(context).replace(/</g,'\\u003c')+');';

 const apiCode=window.KissTavernHelper?'window.__kissHelperInstall='+window.KissTavernHelper.install.toString()+';':'';const regexCode=window.KissTavernRegex?'window.__kissRegexRun='+window.KissTavernRegex.run.toString()+';':'';
 const inject=policy+style+'<script>'+(libraries+';'+apiCode+regexCode+boot).replace(/<\/script/gi,'<\\/script')+'<\/script>';
 if(/<head\b[^>]*>/i.test(html))return html.replace(/<head\b[^>]*>/i,m=>m+inject);
 if(/<html\b[^>]*>/i.test(html))return html.replace(/<html\b[^>]*>/i,m=>m+'<head>'+inject+'</head>');
 return '<!doctype html><html><head>'+inject+'</head><body>'+html+'</body></html>';
}
let libraryPromise;
function loadLibraries(){if(!libraryPromise)libraryPromise=Promise.all(['jquery.min.js','lodash.min.js'].map(async name=>{const response=await fetch(new URL('js/vendor/'+name,document.baseURI));if(!response.ok)throw Error('前端依赖加载失败：'+name);return response.text();})).then(parts=>parts.join('\n;\n')).catch(error=>{libraryPromise=null;throw error;});return libraryPromise;}
function mount(frame,html,onSize,options={}){
 const token=globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2);let last='';
 const receive=event=>{const d=event.data;if(event.source!==frame.contentWindow||d?.token!==token)return;if(d.type==='kiss-offline-helper-call'){if(!Array.isArray(d.args)||typeof d.method!=='string'||JSON.stringify(d.args).length>1000000)return;Promise.resolve().then(()=>options.onCall?options.onCall(d.method,d.args,d.messageIds):Promise.reject(Error('接口不可用'))).then(result=>frame.contentWindow?.postMessage({type:'kiss-offline-helper-result',token,id:d.id,result,snapshot:options.getSnapshot?.()},'*'),error=>frame.contentWindow?.postMessage({type:'kiss-offline-helper-result',token,id:d.id,error:error.message||String(error)},'*'));return;}if(d.type==='kiss-offline-helper-notify'){options.onNotify?.(d.kind,d.value,frame);return;}if(d.type==='kiss-offline-html-choice'){if(typeof d.text==='string'&&d.text.length<=20000)options.onChoice?.(d.text);return;}if(d.type!=='kiss-offline-html-size'||!Number.isFinite(d.height)||!Number.isFinite(d.width))return;const size={height:Math.max(80,Math.min(100000,d.height)),width:Math.max(240,Math.min(100000,d.width)),floating:!!d.floating,rects:Array.isArray(d.rects)?d.rects.filter(r=>[r.x,r.y,r.right,r.bottom].every(Number.isFinite)).slice(0,20):[]},key=Math.round(size.height)+':'+Math.round(size.width)+':'+JSON.stringify(size.rects);if(key!==last){last=key;onSize(size);}};
 frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('referrerpolicy','no-referrer');frame.title=frame.title||'HTML preview';window.addEventListener('message',receive);let disposed=false;loadLibraries().then(libraries=>{if(!disposed)frame.srcdoc=documentHTML(html,token,options.context||{},libraries);}).catch(error=>{if(!disposed){console.error(error);frame.srcdoc='<p>前端依赖未加载，请确认更新包文件已全部上传。</p>';}});
 const update=()=>{if(frame.isConnected)frame.contentWindow?.postMessage({type:'kiss-offline-helper-state',token,snapshot:options.getSnapshot?.()},'*');};const helperEvent=event=>{const d=event.detail;if(d.source!==frame)frame.contentWindow?.postMessage({type:'kiss-offline-helper-event',token,name:d.name,args:d.args},'*');};window.addEventListener('kiss-helper-state-changed',update);window.addEventListener('kiss-helper-event',helperEvent);
 return ()=>{disposed=true;window.removeEventListener('kiss-helper-state-changed',update);window.removeEventListener('kiss-helper-event',helperEvent);window.removeEventListener('message',receive);frame.srcdoc='';};
}
window.KissOfflineHTML={partition,title,documentHTML,mount};
})();
