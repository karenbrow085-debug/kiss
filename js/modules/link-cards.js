/* Share cards: local parsing is instant; public metadata is fetched on send. */
(()=>{'use strict';
const platforms=[
 {id:'xiaohongshu',name:'小红书',mark:'红',color:'#ed3854',hosts:['xiaohongshu.com','xhslink.com','xhslink.cn','rednote.com']},
 {id:'weibo',name:'微博',mark:'微',color:'#edaa30',hosts:['weibo.com','weibo.cn','t.cn']},
 {id:'douyin',name:'抖音',mark:'♪',color:'#252730',hosts:['douyin.com','iesdouyin.com']},
 {id:'taobao',name:'淘宝',mark:'淘',color:'#fa783c',hosts:['taobao.com','tmall.com','tb.cn','tb.ele.me']},
 {id:'pinduoduo',name:'拼多多',mark:'拼',color:'#e24d4c',hosts:['pinduoduo.com','yangkeduo.com','pdd.cn']},
 {id:'meituan',name:'美团',mark:'美',color:'#e8b93d',hosts:['meituan.com','meituan.net','dianping.com','dpurl.cn']},
 {id:'xianyu',name:'闲鱼',mark:'鱼',color:'#dfb52b',hosts:['goofish.com','2.taobao.com']},
 {id:'bilibili',name:'哔哩哔哩',mark:'哔',color:'#ed81a7',hosts:['bilibili.com','b23.tv']}
];
const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text!==undefined)node.textContent=text;return node;};
const button=(text,fn,cls)=>{const node=el('button',cls,text);node.type='button';node.addEventListener('click',fn);return node;};
function safeURL(value){try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function platform(value){const url=safeURL(value);if(!url)return null;const host=new URL(url).hostname.toLowerCase();if(host==='2.taobao.com')return platforms.find(p=>p.id==='xianyu');return platforms.find(p=>p.hosts.some(h=>host===h||host.endsWith('.'+h)))||null;}
function samePlatform(a,b){return a===b||['taobao','xianyu'].includes(a)&&['taobao','xianyu'].includes(b);}
const siteSuffix=/\s*[-_|｜]\s*(?:rednote|小红书|微博|抖音|淘宝|拼多多|美团|闲鱼|閒魚|哔哩哔哩(?:_bilibili)?|bilibili)\s*$/i;
const urlPattern=/https?:\/\/[^\s<>"'「」『』【】\[\]，。！？；、]+/gi;
const cache=new Map(),inflight=new Map(),cacheKey='kiss-link-previews-v2',TTL=86400000;
try{for(const [url,entry] of JSON.parse(localStorage.getItem(cacheKey)||'[]'))if(platform(url)&&entry?.value&&Date.now()-entry.time<TTL)cache.set(url,entry);}catch{}
function cached(url){const entry=cache.get(url);if(entry&&Date.now()-entry.time<TTL)return entry;cache.delete(url);return null;}
function remember(){try{localStorage.setItem(cacheKey,JSON.stringify([...cache].filter(([,e])=>e.state==='loaded').slice(-100)));}catch{}}
function shareCopy(source,p){
 let text=source.replace(urlPattern,'').replace(/(?:拷走|拷贝|复制|複製|长按复制|存下)\s*(?:这条|此|本条)?(?:链接|連結|口令)[\s\S]*$/,'').replace(/[，,]?\s*来[【\[]小红书[】\]][\s\S]*$/,'').replace(/(?:打开|打開)(?:抖音|小红书|微博|淘宝|拼多多|美团|闲鱼|閒魚|哔哩哔哩|bilibili)[^\n]*/gi,'');
 let author='';
 if(p.id==='douyin'){const m=source.match(/看看[【「]([^】」]+?)(?:的作品)?[】」]/);if(m){author=m[1];text=source.slice(m.index+m[0].length).replace(urlPattern,'');}text=text.replace(/^\s*\d{1,2}\.\d{1,2}\s*(?:复制|複製)?[，,]?\s*/,'').replace(/\s+\d{1,2}\/\d{1,2}[\s\S]*$/,'').replace(/\s+[A-Za-z0-9@.]+[:：/]\s*.*$/,'');}
 text=text.replace(/【(?:淘宝|淘寶|拼多多|美团|美團|闲鱼|閒魚)】/g,'').replace(/^[\s，。；、|｜:：-]+|[\s，。；、|｜:：-]+$/g,'').trim();
 if(p.id==='bilibili')text=text.replace(/^【([\s\S]*)】$/,'$1').replace(siteSuffix,'').trim();
 const authorMatch=text.match(/(?:^|\s)(@[^\n]*?的(?:笔记|微博)|来自[^\n]*?的微博)(?:\n|$)/);if(authorMatch)author=authorMatch[1].trim();
 const lines=text.replace(author,'').trim().split(/\n+/);let title=(lines.shift()||'').trim(),excerpt=lines.join('\n').trim();
 if(p.id==='xiaohongshu'&&!excerpt){const parts=title.match(/^(\S+)\s+([\s\S]+)$/);if(parts){title=parts[1];excerpt=parts[2];}}
 const product=p.id==='taobao'&&text.match(/[「『]([^」』]+)[」』]/);if(product)title=product[1];
 if(/^(?:复制|複製|打开|打開|分享|分享链接|分享連結)$/.test(title))title='';
 return {title:title||p.name+'分享',excerpt,author};
}
function parse(input){
 const source=String(input||'');const urls=[...source.matchAll(urlPattern)].map(m=>m[0].replace(/[)）}〉》,;.!?]+$/g,''));
 const seen=new Set();return urls.flatMap(value=>{const url=safeURL(value);let p=platform(url);if(p?.id==='taobao'&&/(?:^|\.)tb\.cn$/.test(new URL(url).hostname)&&/闲鱼|閒魚/.test(source))p=platforms.find(x=>x.id==='xianyu');if(!p||seen.has(url)||/\.(?:png|jpe?g|gif|webp|svg|mp4|mp3)(?:[?#]|$)/i.test(new URL(url).pathname))return [];seen.add(url);return [{url,platform:p.id,...shareCopy(source,p),shareText:source,body:'',images:[],comments:[],resolved:false}];});
}
function get(message){
 if(!message||message.isWithdrawn||message.workFile||!['user','assistant'].includes(message.role)||message.parts?.some(p=>p.type!=='text')||message.type&& !['text','link-share'].includes(message.type))return [];
 const raw=String(message.content||'');const wrapped=raw.match(/^\[.+?的消息[：:]([\s\S]*)\]$/);if(!wrapped&&/^\[/.test(raw))return [];
 const cards=parse(wrapped?wrapped[1]:raw);
 return cards.map(c=>{
  const entry=cached(c.url),saved=message.linkPreviews?.find?.(p=>p.url===c.url)||entry?.value;if(!saved)return {...c,previewState:entry?.state||'idle',previewError:entry?.error||''};
  const images=Array.isArray(saved.images)?saved.images.map(safeURL).filter(Boolean):[];
  return {...c,platform:platforms.some(p=>p.id===saved.platform)&&samePlatform(c.platform,saved.platform)?saved.platform:c.platform,title:typeof saved.title==='string'&&saved.title.trim()?saved.title:c.title,author:typeof saved.author==='string'?saved.author:c.author,body:typeof saved.body==='string'?saved.body:'',description:typeof saved.description==='string'?saved.description:'',images,comments:Array.isArray(saved.comments)?saved.comments.filter(x=>typeof x?.content==='string'):[],resolved:saved.resolved===true,previewState:entry?.state||'loaded',previewError:entry?.error||''};
 });
}
function normalize(data,url){
 const expected=platform(url),actual=platform(data?.url||url);if(!expected||!actual||!samePlatform(actual.id,expected.id))throw Error('链接跳转到了其他网站，未采用预览');
 const title=String(data.title||'').replace(siteSuffix,'').trim();
 if(/^(?:登录|登入|安全验证|访问受限|页面不存在|小红书|rednote|微博|抖音|淘宝|拼多多|美团|闲鱼|閒魚|哔哩哔哩|bilibili|login|access denied)(?:\s*[-_|｜].*)?$/i.test(title)||/website-login|\/login(?:[/?]|$)/i.test(data.url||''))throw Error('平台需要登录或验证，暂时无法获取预览');
 const cover=safeURL(data.cover?.url||data.image?.url),logo=safeURL(data.logo?.url);const images=cover&&cover!==logo&&!/favicon|\.ico(?:[?#]|$)/i.test(cover)?[cover]:[];
 if(!title&&!images.length)throw Error('页面没有提供标题或封面');
 return {platform:actual.id,title,description:String(data.description||''),author:String(data.author||'').replace(/Follow$/,'').trim(),images,previewFetched:true,provider:'Microlink',resolved:false};
}
function notify(url){for(const node of document.querySelectorAll?.('.kl-card')||[]){const item=get(node._kissLinkMessage).find(c=>c.url===url);if(item)paint(node,item);}if(active?.message&&active.url===url){const item=get(active.message).find(c=>c.url===url);if(item)details(item,active.message);}}
async function request(url,retry=false){
 if(!platform(url))throw Error('不支持的分享链接');if(inflight.has(url))return inflight.get(url);const existing=cached(url);if(existing?.state==='loaded')return existing.value;if(existing?.state==='error'&&!retry)throw Error(existing.error);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);cache.set(url,{state:'loading',time:Date.now()});notify(url);
 const task=(async()=>{try{const endpoint=new URL('https://api.microlink.io/');endpoint.searchParams.set('url',url);endpoint.searchParams.set('data.cover.selector','meta[property="og:image"]');endpoint.searchParams.set('data.cover.attr','content');endpoint.searchParams.set('data.cover.type','image');
 const response=await fetch(endpoint.href,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(response.status===429)throw Error('预览服务今日额度已用完，请稍后重试');if(!response.ok)throw Error('预览服务暂不可用（'+response.status+'）');const result=await response.json();if(result.status!=='success')throw Error(result.code==='ERATE'?'预览服务今日额度已用完，请稍后重试':'平台暂未返回可用预览');const value=normalize(result.data,url);cache.set(url,{state:'loaded',time:Date.now(),value});while(cache.size>100)cache.delete(cache.keys().next().value);remember();return value;
 }catch(e){const message=e.name==='AbortError'?'获取预览超时，可点击重试':e.message||'获取预览失败';cache.set(url,{state:'error',time:Date.now(),error:message});throw Error(message);}finally{clearTimeout(timer);inflight.delete(url);notify(url);}})();inflight.set(url,task);return task;
}
function prefetch(message,retry=false){return Promise.allSettled(get(message).map(c=>request(c.url,retry)));}
function badge(p){const node=el('span','kl-badge',p.mark);node.style.background=p.color;return node;}
function photo(url,cls){const img=el('img',cls);img.src=url;img.alt='分享图片';img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>{img.hidden=true;img.parentNode?.classList.add('kl-image-failed');});return img;}
let active=null;
function details(card,message){
 active?.close();const p=platforms.find(x=>x.id===card.platform);if(!p)return;
 const previous=document.activeElement,overlay=el('div','kl-overlay'),panel=el('section','kl-panel'),header=el('header','kl-header'),label=el('span','kl-source'),scroll=el('div','kl-scroll');let imageView=null;
 panel.role='dialog';panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',p.name+'分享详情');scroll.tabIndex=0;
 function close(){overlay.remove();document.removeEventListener('keydown',keys,true);if(active?.overlay===overlay)active=null;if(previous?.isConnected)previous.focus();}
 function closeImage(){imageView?.remove();imageView=null;}
 function keys(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(imageView)closeImage();else close();}if(e.key==='Tab'){const scope=imageView||panel;const list=[...scope.querySelectorAll('button,[tabindex="0"]')];const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}
 const closeButton=button('×',close,'kl-close');closeButton.setAttribute('aria-label','关闭分享详情');label.append(badge(p),el('span','',p.name));header.append(label,closeButton);
 scroll.append(el('div','kl-kicker','SHARED WITH YOU'),el('h2','kl-heading',card.title));
 if(card.author)scroll.append(el('p','kl-author',card.author));
 if(card.images.length){const gallery=el('div','kl-gallery');for(const [i,url] of card.images.entries()){const item=button('',()=>{closeImage();imageView=el('div','kl-image-view');const back=button('返回详情',()=>{closeImage();item.focus();},'kl-image-back');imageView.append(back,photo(url,'kl-full-image'));panel.append(imageView);back.focus();},'kl-gallery-item');item.setAttribute('aria-label','查看第 '+(i+1)+' 张图片');item.append(photo(url,''));gallery.append(item);}scroll.append(gallery);}
 const body=card.body||card.description||card.excerpt;if(body)scroll.append(el('div','kl-body',body));
 if(!card.resolved)scroll.append(el('p','kl-read-state',card.previewState==='loading'?'正在获取标题和封面…':card.previewError||(card.previewState==='loaded'?'已获取链接预览；摘要不代表全文，图片不代表全部配图。':'当前显示分享文案，正在尝试获取链接预览。')));
 if(message&&card.previewState!=='loading')scroll.append(button(card.previewState==='loaded'?'刷新预览':'重新获取标题和封面',()=>{cache.delete(card.url);prefetch(message,true);},'kl-refresh'));
 if(card.comments.length){const comments=el('section','kl-comments');comments.append(el('h3','','评论 · '+card.comments.length));for(const c of card.comments){const row=el('div','kl-comment');row.append(el('strong','',String(c.author||'评论')),el('p','',c.content));comments.append(row);}scroll.append(comments);}
 const source=el('section','kl-original');source.append(el('span','','分享链接'),el('p','',card.url));
 source.append(button('复制链接',async()=>{try{await navigator.clipboard.writeText(card.url);if(typeof showToast==='function')showToast('链接已复制');}catch{if(typeof showToast==='function')showToast('复制失败，可长按下方链接复制');}},'kl-copy'));
 scroll.append(source);panel.append(header,scroll);overlay.append(panel);overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
 (document.querySelector('.phone-screen')||document.body).append(overlay);document.addEventListener('keydown',keys,true);active={overlay,close,message,url:card.url};closeButton.focus();
 if(message&&card.previewState==='idle')prefetch(message);
}
function paint(b,item){const p=platforms.find(x=>x.id===item.platform);b.setAttribute('aria-label','查看'+p.name+'分享：'+item.title);b.setAttribute('aria-busy',String(item.previewState==='loading'));const main=el('span','kl-main'),text=el('span','kl-copy-block');text.append(el('strong','kl-title',item.title),el('span','kl-subtitle',item.description||item.excerpt||item.author||(item.previewState==='loading'?'正在获取标题和封面…':item.previewState==='error'?'预览暂不可用 · 点击重试':'来自'+p.name+'的分享')));main.append(text);const thumb=el('span','kl-thumb');if(item.images.length)thumb.append(photo(item.images[0],''));else{thumb.classList.add('kl-thumb-empty');thumb.append(el('span','kl-no-cover',item.previewState==='loading'?'获取中':'暂无封面'));}main.append(thumb);const footer=el('span','kl-footer');footer.append(badge(p),el('span','',p.name));b.replaceChildren(main,footer);}
function card(message,items=get(message)){
 const stack=el('div','kl-stack');for(const item of items){const b=button('',()=>{if(typeof isInMultiSelectMode!=='undefined'&&isInMultiSelectMode)return;details(get(message).find(c=>c.url===item.url)||item,message);},'kl-card');b._kissLinkMessage=message;paint(b,item);stack.append(b);}return stack;
}
window.KissLinkCards={parse,get,platform,safeURL,card,details,normalize,request,prefetch,close:()=>active?.close()};
})();
