/* Local share cards. Rendering never opens another app or fetches a shared page. */
(()=>{'use strict';
const platforms=[
 {id:'xiaohongshu',name:'小红书',mark:'红',color:'#ed3854',hosts:['xiaohongshu.com','xhslink.com']},
 {id:'weibo',name:'微博',mark:'微',color:'#edaa30',hosts:['weibo.com','weibo.cn','t.cn']},
 {id:'douyin',name:'抖音',mark:'♪',color:'#252730',hosts:['douyin.com','iesdouyin.com']},
 {id:'taobao',name:'淘宝',mark:'淘',color:'#fa783c',hosts:['taobao.com','tmall.com','tb.cn','tb.ele.me']},
 {id:'pinduoduo',name:'拼多多',mark:'拼',color:'#e24d4c',hosts:['pinduoduo.com','yangkeduo.com','pdd.cn']},
 {id:'meituan',name:'美团',mark:'美',color:'#e8b93d',hosts:['meituan.com','meituan.net','dianping.com','dpurl.cn']}
];
const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text!==undefined)node.textContent=text;return node;};
const button=(text,fn,cls)=>{const node=el('button',cls,text);node.type='button';node.addEventListener('click',fn);return node;};
function safeURL(value){try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function platform(value){const url=safeURL(value);if(!url)return null;const host=new URL(url).hostname.toLowerCase();return platforms.find(p=>p.hosts.some(h=>host===h||host.endsWith('.'+h)))||null;}
const urlPattern=/https?:\/\/[^\s<>"'「」『』【】\[\]，。！？；、]+/gi;
function parse(input){
 const source=String(input||'');const urls=[...source.matchAll(urlPattern)].map(m=>m[0].replace(/[)）}〉》,;.!?]+$/g,''));
 const text=source.replace(urlPattern,'').replace(/(?:复制(?:此|这条)?链接|长按复制|打开(?:抖音|小红书|微博|淘宝|拼多多|美团))[^\n]*/g,'').replace(/^[\s，。；、|｜:：-]+|[\s，。；、|｜:：-]+$/g,'').trim();
 const authorMatch=text.match(/(?:^|\s)(@[^\n]*?的(?:笔记|微博)|来自[^\n]*?的微博)(?:\n|$)/),author=authorMatch?authorMatch[1].trim():'';
 const title=((text.replace(author,'').split('\n').find(line=>line.trim()))||'').trim();const seen=new Set();
 return urls.flatMap(value=>{const url=safeURL(value),p=platform(url);if(!p||seen.has(url)||/\.(?:png|jpe?g|gif|webp|svg|mp4|mp3)(?:[?#]|$)/i.test(new URL(url).pathname))return [];seen.add(url);return [{url,platform:p.id,title:title||p.name+'分享',shareText:source,excerpt:text,author,body:'',images:[],comments:[],resolved:false}];});
}
function get(message){
 if(!message||message.isWithdrawn||message.workFile||!['user','assistant'].includes(message.role)||message.parts?.some(p=>p.type!=='text')||message.type&& !['text','link-share'].includes(message.type))return [];
 const raw=String(message.content||'');const wrapped=raw.match(/^\[.+?的消息[：:]([\s\S]*)\]$/);if(!wrapped&&/^\[/.test(raw))return [];
 const cards=parse(wrapped?wrapped[1]:raw);
 return cards.map(c=>{
  const saved=message.linkPreviews?.find?.(p=>p.url===c.url);if(!saved)return c;
  const images=Array.isArray(saved.images)?saved.images.map(safeURL).filter(Boolean):[];
  return {...c,title:typeof saved.title==='string'&&saved.title.trim()?saved.title:c.title,author:typeof saved.author==='string'?saved.author:'',body:typeof saved.body==='string'?saved.body:'',images,comments:Array.isArray(saved.comments)?saved.comments.filter(x=>typeof x?.content==='string'):[],resolved:saved.resolved===true};
 });
}
function badge(p){const node=el('span','kl-badge',p.mark);node.style.background=p.color;return node;}
function photo(url,cls){const img=el('img',cls);img.src=url;img.alt='分享图片';img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>{img.hidden=true;img.parentNode?.classList.add('kl-image-failed');});return img;}
let active=null;
function details(card){
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
 const body=card.body||card.excerpt;if(body)scroll.append(el('div','kl-body',body));
 if(!card.resolved)scroll.append(el('p','kl-read-state','当前显示分享文案，链接正文和图片尚未读取。'));
 if(card.comments.length){const comments=el('section','kl-comments');comments.append(el('h3','','评论 · '+card.comments.length));for(const c of card.comments){const row=el('div','kl-comment');row.append(el('strong','',String(c.author||'评论')),el('p','',c.content));comments.append(row);}scroll.append(comments);}
 const source=el('section','kl-original');source.append(el('span','','分享链接'),el('p','',card.url));
 source.append(button('复制链接',async()=>{try{await navigator.clipboard.writeText(card.url);if(typeof showToast==='function')showToast('链接已复制');}catch{if(typeof showToast==='function')showToast('复制失败，可长按下方链接复制');}},'kl-copy'));
 scroll.append(source);panel.append(header,scroll);overlay.append(panel);overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
 (document.querySelector('.phone-screen')||document.body).append(overlay);document.addEventListener('keydown',keys,true);active={overlay,close};closeButton.focus();
}
function card(message,items=get(message)){
 const stack=el('div','kl-stack');for(const item of items){const p=platforms.find(x=>x.id===item.platform);const b=button('',()=>{if(typeof isInMultiSelectMode!=='undefined'&&isInMultiSelectMode)return;details(item);},'kl-card');b.setAttribute('aria-label','查看'+p.name+'分享：'+item.title);const main=el('span','kl-main'),text=el('span','kl-copy-block');text.append(el('strong','kl-title',item.title),el('span','kl-subtitle',item.author||'来自'+p.name+'的分享'));main.append(text);const thumb=el('span','kl-thumb');if(item.images.length)thumb.append(photo(item.images[0],''));else{thumb.classList.add('kl-thumb-empty');thumb.append(badge(p));}main.append(thumb);const footer=el('span','kl-footer');footer.append(badge(p),el('span','',p.name));b.append(main,footer);stack.append(b);}return stack;
}
window.KissLinkCards={parse,get,platform,safeURL,card,details,close:()=>active?.close()};
})();
