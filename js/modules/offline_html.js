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
function documentHTML(html,token){
 const policy=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https:; img-src data: blob: https: http:; font-src data: https:; media-src data: blob: https:; connect-src 'none'; form-action 'none'; base-uri 'none'">`;
 const style='<meta name="viewport" content="width=device-width,initial-scale=1"><style>html{overflow:auto;overscroll-behavior:contain}body{overflow-wrap:anywhere}img,video,canvas,svg{max-width:100%}*{box-sizing:border-box}</style>';
 const bootstrap=`<script>(()=>{const token=${JSON.stringify(token)};let scheduled=false;function report(){scheduled=false;if(!document.body)return;const body=document.body,items=[...body.children].filter(e=>!['SCRIPT','STYLE','LINK','META'].includes(e.tagName));let bottom=0,width=0;for(const e of items){const r=e.getBoundingClientRect();bottom=Math.max(bottom,r.bottom+scrollY);width=Math.max(width,r.right+scrollX);}const h=Math.max(80,bottom+parseFloat(getComputedStyle(body).paddingBottom||0)+8);parent.postMessage({type:'kiss-offline-html-size',token,height:h,width:Math.max(240,width+8)},'*');}function queue(){if(!scheduled){scheduled=true;requestAnimationFrame(report);}}addEventListener('DOMContentLoaded',()=>{queue();new ResizeObserver(queue).observe(document.body);new MutationObserver(queue).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});document.addEventListener('click',e=>{const a=e.target.closest?.('a');if(a){const href=a.getAttribute('href')||'';if(href.startsWith('#')){e.preventDefault();try{location.hash=href;document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({block:'start'});}catch{}}else if(href)e.preventDefault();}queue();});document.addEventListener('load',queue,true);});addEventListener('resize',queue);addEventListener('hashchange',queue);addEventListener('load',queue);})();<\/script>`;
 const inject=policy+style+bootstrap;
 if(/<head\b[^>]*>/i.test(html))return html.replace(/<head\b[^>]*>/i,m=>m+inject);
 if(/<html\b[^>]*>/i.test(html))return html.replace(/<html\b[^>]*>/i,m=>m+'<head>'+inject+'</head>');
 return '<!doctype html><html><head>'+inject+'</head><body>'+html+'</body></html>';
}
function mount(frame,html,onSize){
 const token=globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2);let last='';
 const receive=event=>{const d=event.data;if(event.source!==frame.contentWindow||d?.type!=='kiss-offline-html-size'||d.token!==token||!Number.isFinite(d.height)||!Number.isFinite(d.width))return;const size={height:Math.max(80,Math.min(100000,d.height)),width:Math.max(240,Math.min(100000,d.width))},key=Math.round(size.height)+':'+Math.round(size.width);if(key!==last){last=key;onSize(size);}};
 frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('referrerpolicy','no-referrer');frame.title=frame.title||'HTML preview';window.addEventListener('message',receive);frame.srcdoc=documentHTML(html,token);
 return ()=>{window.removeEventListener('message',receive);frame.srcdoc='';};
}
window.KissOfflineHTML={partition,title,documentHTML,mount};
})();
