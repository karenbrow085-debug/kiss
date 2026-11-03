/* Public-page reader. Each browser supplies its own optional Jina key. */
(()=>{'use strict';
const DB='kiss-link-reader-private-v1',STORE='settings',cache=new Map(),pending=new Map(),controllers=new Set();
let config={enabled:true,token:''},revision=0,cooldownUntil=0,db=null,active=null;
const ready=new Promise(resolve=>{try{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE);req.onerror=()=>resolve();req.onblocked=()=>resolve();req.onsuccess=()=>{db=req.result;const read=db.transaction(STORE).objectStore(STORE).get('reader');read.onsuccess=()=>{if(read.result)config={enabled:read.result.enabled!==false,token:String(read.result.token||'')};resolve();};read.onerror=()=>resolve();};}catch{resolve();}});
async function configure(value){await ready;config={enabled:value.enabled!==false,token:String(value.token||'').trim().replace(/^Bearer\s+/i,'')};revision++;cooldownUntil=0;cache.clear();for(const c of controllers)c.abort();let persistent=false;if(db)try{await new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(config,'reader');t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});persistent=true;}catch{}window.KissLinkCards?.resetReaderCache?.();return {persistent};}
function safeURL(value,base){if(typeof value!=='string'||!value.trim())return '';try{const u=new URL(value,base);if(!/^https?:$/.test(u.protocol)||u.username||u.password||/^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[|.*\.local$)/i.test(u.hostname)||/^172\.(?:1[6-9]|2\d|3[01])\./.test(u.hostname))return '';u.hash='';return u.href;}catch{return '';}}
function displayText(text){return String(text||'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/^#{1,6}\s+/gm,'').replace(/\n{3,}/g,'\n\n').trim();}
function normalize(result,url){
 const d=result?.data;if(Number(result?.code)!==200||!d||typeof d!=='object'||Array.isArray(d))throw Error('网页读取服务没有返回正文');
 const final=safeURL(d.finalUrl||d.url||url,url),pageTitle=String(d.title||'').trim(),body=String(d.content||'').trim();
 if(!final||/\/(?:login|signin|passport|captcha|challenge)(?:[/?._-]|$)/i.test(new URL(final).pathname)||/^(?:登录|登入|登錄|安全验证|安全驗證|访问受限|訪問受限|验证码|驗證碼|sina visitor system|log\s?in|sign\s?in|access denied|just a moment|forbidden|not found|出错啦)/i.test(pageTitle)||/^Warning:\s*(?:Target URL returned error|This page requires|.*(?:403|404|412|429))/im.test(body))throw Error('网页需要登录或验证，未取得正文');
 if(!body||body==='-'||body.length<12)throw Error('网页没有返回可读取正文');
 const prose=body.split(/\n/).map(x=>x.trim()).filter(x=>x&&!/^#{1,6}\s|^\[.*\]\(.*\)$|^!\[|^https?:|^(?:关注|关注作者|打开APP|打开App|赞|转发|评论|收藏|分享|登录|下载APP)$/.test(x));
 if(!prose.length)throw Error('平台只返回首页或导航，没有取得这条链接的正文');
 let title=pageTitle,author='',description=String(d.description||'');if(/^(?:微博|weibo)$/i.test(title)){title=prose[0].replace(/!?\[([^\]]*)\]\([^)]*\)/g,'$1').slice(0,100);author=body.match(/^###\s+\[([^\]]+)\]/m)?.[1]||'';description=displayText(prose.slice(1).join(' ')).slice(0,300);}
 const images=[];const add=v=>{if(v&&typeof v==='object')v=v.url||v.src;const u=safeURL(v,final);if(u&&!/favicon|timeline_card_small|^https?:\/\/tva[xr]\d*\.sinaimg\.cn\/|\.(?:svg|ico)(?:[?#]|$)/i.test(u)&&!images.includes(u))images.push(u);};
 if(Array.isArray(d.images))d.images.forEach(add);else if(d.images&&typeof d.images==='object')for(const [alt,v]of Object.entries(d.images)){if(/站点Logo|站点图标|头像|\b(?:logo|avatar|icon)\b/i.test(alt))continue;if(/^https?:/.test(alt))add(alt);if(Array.isArray(v))v.forEach(add);else add(v);}
 for(const m of body.matchAll(/!\[[^\]]*\]\(\s*(https?:\/\/[^\s)]+)(?:\s+['"][^'"]*['"])?\s*\)/g))add(m[1]);
 return {title,body,description,author,images,provider:'Jina Reader',textKind:'page_extract',sourceURL:final,resolved:false,previewFetched:true,readerError:''};
}
async function read(url,{signal,retry=false}={}){
 await ready;const target=safeURL(url);if(!target)throw Error('网页地址不支持读取');if(!config.enabled)throw Error('自动网页读取已关闭');if(signal?.aborted)throw new DOMException('读取已取消','AbortError');
 const key=revision+':'+target,old=cache.get(key);if(old&&Date.now()-old.time<1800000&&!retry)return old.value;if(pending.has(key))return pending.get(key);if(cooldownUntil>Date.now())throw Error('网页读取服务暂时限流，请稍后再试，或在网页读取设置填写自己的 Jina Key');
 const controller=new AbortController(),cancel=()=>controller.abort(),startedRevision=revision;controllers.add(controller);signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,35000);
 const headers={Accept:'application/json','X-With-Images-Summary':'true'};if(config.token)headers.Authorization='Bearer '+config.token;
 const task=(async()=>{try{const r=await fetch('https://r.jina.ai/'+target,{headers,signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(r.status===429){const raw=r.headers?.get?.('retry-after'),seconds=Number(raw);cooldownUntil=Number.isFinite(seconds)&&seconds>0?Date.now()+seconds*1000:Math.max(Date.now()+60000,Date.parse(raw||'')||0);throw Error('网页读取服务暂时限流，请稍后再试，或填写自己的 Jina Key');}if(r.status===401||r.status===402)throw Error('Jina Key 无效或额度不足，请检查个人网页读取设置');if(!r.ok)throw Error('网页读取服务暂不可用（'+r.status+'）');const raw=await r.json();let value;try{value=normalize(raw,target);}catch(e){e.sourceURL=safeURL(raw?.data?.finalUrl||raw?.data?.url||'',target);throw e;}if(controller.signal.aborted||revision!==startedRevision)throw new DOMException('读取已取消','AbortError');cache.set(key,{time:Date.now(),value});while(cache.size>40)cache.delete(cache.keys().next().value);return value;}catch(e){if(e.name==='AbortError'){if(signal?.aborted)throw e;throw Error('网页读取超时或已取消，请稍后再试');}const error=Error(e.message||'网页读取失败');if(e.sourceURL)error.sourceURL=e.sourceURL;throw error;}finally{clearTimeout(timer);controllers.delete(controller);signal?.removeEventListener('abort',cancel);pending.delete(key);}})();pending.set(key,task);return task;
}
function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function settings(){window.KissApiExtensions?.open?.();}

window.KissLinkReader={resolveURL:async(url,options)=>{try{return (await read(url,options)).sourceURL;}catch(e){return e.sourceURL||'';}},read,normalize,displayText,configure,settings,ready,values:async()=>{await ready;return {...config};},status:()=>({enabled:config.enabled,hasKey:!!config.token})};
})();
