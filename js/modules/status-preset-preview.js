/* Isolated, automatic status-template preview. No AI request or chat mutation. */
(function () {
'use strict';
const byId = id => document.getElementById(id);
let serial = 0, timer, worker, workerURL, frame, frameToken;
const fallback = ['记得好好吃饭', '今天也有在想你。', '09:41'];
const escapeValue = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function normalizeRegex(input) {
 const literal = String(input).match(/^\/([\s\S]*)\/([dgimsuvy]*)$/);
 return {source:literal ? literal[1] : String(input), flags:literal ? literal[2] || 'gs' : 'gs'};
}
// Capture hints are used only for illustration, never to claim a regex matched.
function captureHints(source) {
 const hints = []; let inClass = false;
 for (let i=0;i<source.length;i++) {
  if(source[i]==='\\'){i++;continue;}
  if(source[i]==='['){inClass=true;continue;}if(source[i]===']'){inClass=false;continue;}
  if(inClass || source[i]!=='(')continue;
  const tail=source.slice(i+1);if(tail.startsWith('?')&&!/^\?<[^=!][^>]*>/.test(tail))continue;
  let offset=i+1,name='';const named=tail.match(/^\?<([^>]+)>/);if(named){name=named[1];offset+=named[0].length;}
  hints.push({name,body:source.slice(offset,source.indexOf(')',offset)<0?source.length:source.indexOf(')',offset))});
 }
 return hints;
}
function makeSample(template, pattern, text) {
 const hints=captureHints(normalizeRegex(pattern).source), values={}, named={};let textUsed=false;
 const slots=[...String(template).matchAll(/\$(\d{1,2})|\$<([^>]+)>/g)];
 for(const slot of slots){const key=slot[1]||slot[2];if(Object.hasOwn(values,key))continue;
  const n=slot[1]?Number(slot[1]):Math.max(1,hints.findIndex(h=>h.name===slot[2])+1),hint=hints[n-1]?.body||'';
  const at=slot.index, before=template.slice(Math.max(0,at-90),at),after=template.slice(at+slot[0].length,at+slot[0].length+35);
  let value;
  if(/(?:src|poster)\s*=\s*["']?$/i.test(before)) value='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#e7ebf2"/><path d="M0 120L70 60l65 58 50-35 55 77H0" fill="#bdc8d8"/></svg>');
  else if(/href\s*=\s*["']?$/i.test(before))value='#';
  else if(/(?:color|background(?:-color)?)\s*:\s*$/i.test(before))value='#a7b4ca';
  else if(/^\s*(?:%|px|rem|em|deg)(?=[\s;"'<>)]|$)/.test(after)||/\\d|\[0-9|\[\\d/.test(hint)||/(?:opacity|width|height|value)\s*[:=]\s*["']?$/i.test(before))value=/opacity\s*:\s*$/.test(before)?'0.8':'80';
  else if(/\\d.*?:.*?\\d/.test(hint)||/time|时间|日期/.test(hints[n-1]?.name||''))value='09:41';
  else if(text&&!textUsed){value=text;textUsed=true;}
  else value=fallback[(n-1)%fallback.length];
  values[key]=value;if(hints[n-1]?.name)named[hints[n-1].name]=value;
 }
 return template.replace(/\$(\d{1,2})|\$<([^>]+)>/g,(_all,n,name)=>escapeValue(values[n||name]??named[name]??fallback[0]));
}
function substitute(template, match, groups) {
 return template.replace(/\$(\d{1,2})|\$<([^>]+)>/g,(all,n,name)=>{
  if(name)return groups&&Object.hasOwn(groups,name)?escapeValue(groups[name]):all;
  return Number(n)<match.length?escapeValue(match[Number(n)]):all;
 });
}
function tag(label,error=false){const node=byId('sb-match-status');if(!node)return;node.textContent=label;node.className='status-tag'+(error?' error':label==='匹配成功'?' success':'');}
function empty(text){const box=byId('sb-preview-container');if(!box)return;box.replaceChildren();frame=null;const p=document.createElement('div');p.className='sbp-empty';p.textContent=text;box.append(p);}
function render(html) {
 const box=byId('sb-preview-container');if(!box)return;
 const char=typeof db!=='undefined'?db.characters?.find(c=>c.id===(typeof currentChatId!=='undefined'?currentChatId:null))||db.characters?.[0]:null;
 if(char&&typeof processTemplate==='function'){try{html=processTemplate(html,char);}catch{/* Keep a usable template preview. */}}
 frameToken='sbp-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 // Use an opaque-origin iframe so template CSS/JS cannot affect the editor.
 const doc=new DOMParser().parseFromString(html,'text/html');
 doc.querySelectorAll('base,meta[http-equiv],iframe,object,embed').forEach(node=>node.remove());
 const csp=doc.createElement('meta');csp.httpEquiv='Content-Security-Policy';csp.content="default-src 'none'; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:; img-src data: blob: https:; font-src data: https:; media-src data: https:; connect-src 'none'; form-action 'none'; base-uri 'none'";doc.head.prepend(csp);
 const viewport=doc.createElement('meta');viewport.name='viewport';viewport.content='width=device-width,initial-scale=1';doc.head.append(viewport);
 const base=doc.createElement('style');base.textContent='html{scrollbar-width:thin}body{margin:0;padding:16px;box-sizing:border-box;overflow-wrap:anywhere;font:13px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;color:#414754}img,video{max-width:100%}';doc.head.insertBefore(base,doc.head.firstChild);
 const viewportLayout=/(?:\bheight\s*:\s*[^;}]*\d+(?:d|s|l)?vh\b|\bposition\s*:\s*fixed\b)/i.test(html);
 const sizing=doc.createElement('script');sizing.textContent=`(()=>{let pending;function measure(){cancelAnimationFrame(pending);pending=requestAnimationFrame(()=>{let bottom=150;const b=document.body;const r=document.createRange();r.selectNodeContents(b);bottom=Math.max(bottom,r.getBoundingClientRect().bottom+scrollY);let count=0;for(const e of b.querySelectorAll('*')){if(++count>3000)break;if(/^(SCRIPT|STYLE|LINK)$/.test(e.tagName))continue;const s=getComputedStyle(e);if(s.position==='fixed'||s.display==='none')continue;bottom=Math.max(bottom,e.getBoundingClientRect().bottom+scrollY+(parseFloat(s.marginBottom)||0));}bottom+=parseFloat(getComputedStyle(b).paddingBottom)||0;parent.postMessage({type:'kiss-status-preview-size',token:${JSON.stringify(frameToken)},height:${viewportLayout?'360':'Math.ceil(bottom)'}},'*');});}addEventListener('load',measure);document.addEventListener('load',measure,true);new ResizeObserver(measure).observe(document.body);document.fonts?.ready.then(measure);measure();})()`;doc.body.append(sizing);
 const next=document.createElement('iframe');next.title='状态栏效果预览';next.setAttribute('sandbox','allow-scripts');next.referrerPolicy='no-referrer';next.style.height=viewportLayout?'360px':'240px';next.srcdoc='<!doctype html>'+doc.documentElement.outerHTML;frame=next;box.replaceChildren(next);
}
window.addEventListener('message',event=>{if(!frame||event.source!==frame.contentWindow||event.data?.type!=='kiss-status-preview-size'||event.data.token!==frameToken)return;const height=Number(event.data.height);if(Number.isFinite(height))frame.style.height=Math.max(150,Math.min(900,height))+'px';});
function cancel(){serial++;clearTimeout(timer);worker?.terminate();worker=null;}
const workerSource=`onmessage=e=>{try{const {source,flags,text}=e.data;const re=new RegExp(source,flags);const match=re.exec(text);postMessage({match:match?Array.from(match):null,groups:match?.groups||null});}catch(error){postMessage({error:error.message});}}`;
function perform() {
 cancel();const request=serial;
 const template=byId('sb-preset-html')?.value||'',pattern=byId('sb-preset-regex')?.value||'',text=byId('sb-test-input')?.value||'';
 if(!template.trim()){tag('暂无模板');empty('粘贴模板后即可预览');return;}
 // Immediately show the template even before an optional regex match completes.
 render(makeSample(template,pattern,text));tag(text?'自由测试':'示例预览');
 if(!pattern.trim())return;
 try{
  workerURL||=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));worker=new Worker(workerURL);
 }catch{tag('示例预览');return;}
 const active=worker;
 const timeout=setTimeout(()=>{active.terminate();if(request===serial)tag('匹配超时 · 示例',true);},600);
 active.onmessage=event=>{clearTimeout(timeout);active.terminate();if(worker===active)worker=null;if(request!==serial)return;const {match,groups,error}=event.data;
  if(error){tag('正则有误 · 示例',true);return;}
  if(text.trim() && match){render(substitute(template,match,groups));tag('匹配成功');}
 };
 active.onerror=()=>{clearTimeout(timeout);active.terminate();if(request===serial)tag('示例预览');};
 active.postMessage({...normalizeRegex(pattern),text});
}
function update(){cancel();timer=setTimeout(perform,130);}
function reset(){cancel();frame=null;frameToken='';}
function open(preset){reset();const text=byId('sb-test-input');if(text)text.value=preset?.previewText||'';perform();}
window.KissStatusPresetPreview={update,open,reset,makeSample,substitute,normalizeRegex};
byId('sb-preview-test-btn')?.addEventListener('click',perform);
byId('sb-test-input')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();perform();}});
const screen=byId('status-bar-editor-screen');if(screen)new MutationObserver(()=>{if(!screen.classList.contains('active'))reset();else if(!frame)perform();}).observe(screen,{attributes:true,attributeFilter:['class']});
})();
