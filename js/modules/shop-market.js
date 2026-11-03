/* A retail storefront over the existing shop, cart, delivery and generation system. */
(()=>{'use strict';
const $=id=>document.getElementById(id), owner=()=>db.characters.find(c=>c.id===currentChatId);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const price=item=>{const n=Number.parseFloat(item.price);return Number.isFinite(n)?n:0;};
const key=item=>JSON.stringify([String(item.name||''),String(item.price??'0')]);
let state={query:'',sort:'default',budget:'',view:'home'},lastOwner=null,lastArchive=null,dialogPrevious=null;
const favorites=c=>Array.isArray(c?.shopFavorites)?c.shopFavorites:[];
function allItems(){const seen=new Set();return Object.values(shopState.items||{}).filter(Array.isArray).flat().filter(item=>{if(!item||!item.name)return false;const id=key(item);if(seen.has(id))return false;seen.add(id);return true;});}
function rows(){let items=state.view==='favorites'?favorites(owner()).slice():state.query?allItems():(shopState.items[shopState.currentTab]||[]).slice();if(state.query){const q=state.query.toLocaleLowerCase();items=items.filter(i=>[i.name,i.desc].join(' ').toLocaleLowerCase().includes(q));}if(state.budget!=='')items=items.filter(i=>price(i)<=Number(state.budget));if(state.sort==='low')items.sort((a,b)=>price(a)-price(b));if(state.sort==='high')items.sort((a,b)=>price(b)-price(a));return items;}
function categories(){return [{id:'recommend',name:'推荐'},{id:'food',name:'食堂'},{id:'general',name:'百货'},{id:'guess',name:'猜你喜欢'},{id:'character_choice',name:'TA想买'}].concat(getCustomCategories());}
function safe(){const c=owner();if(lastOwner!==c||lastArchive!==c?.activeArchiveId){lastOwner=c;lastArchive=c?.activeArchiveId;state={query:'',sort:'default',budget:'',view:'home'};if($('shop-search-input'))$('shop-search-input').value='';closeFeature();}}

const photoTypes=['gift','clothes','food','gadget','flower','pill','mystery'];
const photoFor=item=>'assets/shop-editorial-v1/'+(photoTypes.includes(item.type)?item.type:'mystery')+'.webp';
function artwork(item){const cover=owner()?.shopProductCovers?.[key(item)],src=typeof cover==='string'&&/^https?:\/\//i.test(cover)?cover:photoFor(item);return `<div class="market-art market-art-${esc(item.type||'mystery')}"><img class="market-product-photo" src="${esc(src)}" alt="${cover?esc(item.name):'分类灵感封面'}" loading="lazy" decoding="async" data-market-fallback="${photoFor(item)}"></div>`;}
const symbols={spark:'<path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6Z"/><path d="m20 2 .7 1.3L22 4l-1.3.7L20 6l-.7-1.3L18 4l1.3-.7Z"/>',note:'<rect x="5" y="3" width="15" height="18" rx="3"/><path d="M9 8h7M9 12h7M9 16h4M3 7h4M3 12h4M3 17h4"/>',compare:'<rect x="2" y="5" width="8" height="14" rx="2"/><rect x="14" y="5" width="8" height="14" rx="2"/><path d="M5 9h2m10 0h2M5 15h2m10 0h2"/>',parcel:'<path d="m3 7 9-4 9 4v11l-9 4-9-4Z"/><path d="m3 7 9 4 9-4M12 11v11M7 5l10 4"/>',heart:'<path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1s-1 7 8 14c9-7 11-11 8-14Z"/>'};
const symbol=name=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${symbols[name]||symbols.spark}</svg>`;
const wishes=c=>Array.isArray(c?.shopWishNotes)?c.shopWishNotes:[];
const comparisons=c=>Array.isArray(c?.shopComparison)?c.shopComparison:[];
const snapshot=item=>({name:String(item.name||''),price:String(item.price??0),desc:String(item.desc||''),type:photoTypes.includes(item.type)?item.type:'mystery',isAd:!!item.isAd});
const transactions=new WeakMap();
async function changeField(c,field,change,archive=c?.activeArchiveId){
 if(!c)throw Error('请先选择角色');
 const prior=transactions.get(c)||Promise.resolve();
 const task=prior.catch(()=>{}).then(async()=>{
  if(owner()!==c||!db.characters.includes(c)||c.activeArchiveId!==archive)throw Error('角色或存档已切换，请重新打开');
  const before=c[field],next=change(before),release=window.PhoneBackup?.pinChat?.(c)||(()=>{});c[field]=next;
  try{if(window.PhoneBackup?.saveChat)await PhoneBackup.saveChat(c);else await saveData();if(lastOwner===c&&lastArchive===archive)lastArchive=c.activeArchiveId;return next;}
  catch(error){if(c[field]===next)c[field]=before;throw error;}finally{release();}
 });transactions.set(c,task);return task;
}
function action(button,fn){button.onclick=async()=>{button.disabled=true;try{await fn();}catch(error){showToast(error.message||'保存失败，请重试');}finally{button.disabled=false;}};}
function showWishes(){const c=owner(),archive=c?.activeArchiveId,body=openFeature('购物愿望便签');body.innerHTML=`<div class="market-sheet-intro"><small>WISHES, LITTLE BY LITTLE</small><h3>先把喜欢，记下来。</h3><p>送礼灵感、想买的小物，留在这里慢慢实现。</p></div><form id="market-wish-form"><label for="market-wish-text">新的购物愿望</label><div><input id="market-wish-text" maxlength="500" required placeholder="例如：下次见面，带一束花"><button type="submit">记下来</button></div></form><div class="market-wish-list"></div>`;
 const list=body.querySelector('.market-wish-list'),notes=wishes(c).slice().sort((a,b)=>Number(a.done)-Number(b.done)||(b.createdAt||0)-(a.createdAt||0));
 if(!notes.length)list.innerHTML='<div class="market-feature-empty">还没有便签，记下第一件心动小事吧。</div>';
 notes.forEach(note=>{const row=document.createElement('article');row.className='market-wish-row'+(note.done?' completed':'');row.innerHTML=`<label class="market-wish-check"><input type="checkbox" ${note.done?'checked':''} aria-label="${note.done?'恢复未完成':'标记已完成'} ${esc(note.text)}"><span>${esc(note.text)}</span></label><div><button type="button" class="wish-edit">编辑</button><button type="button" class="wish-delete">删除</button></div>`;row.querySelector('input').onchange=async e=>{const checked=e.target.checked;e.target.disabled=true;try{await changeField(c,'shopWishNotes',old=>(old||[]).map(n=>n.id===note.id?{...n,done:checked}:n),archive);showWishes();renderShopContent();}catch(error){showToast(error.message);e.target.checked=!checked;e.target.disabled=false;}};row.querySelector('.wish-edit').onclick=()=>editWish(note,c,archive);action(row.querySelector('.wish-delete'),async()=>{await changeField(c,'shopWishNotes',old=>(old||[]).filter(n=>n.id!==note.id),archive);showWishes();renderShopContent();});list.append(row);});
 body.querySelector('form').onsubmit=async e=>{e.preventDefault();const field=body.querySelector('input'),text=field.value.trim(),button=body.querySelector('button[type=submit]');if(!text)return;button.disabled=true;try{await changeField(c,'shopWishNotes',old=>(old||[]).concat([{id:'wish_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),text,done:false,createdAt:Date.now()}]),archive);showWishes();renderShopContent();showToast('愿望已记下');}catch(error){showToast(error.message);}finally{button.disabled=false;}};
}
function editWish(note,c,archive){const body=openFeature('编辑愿望');body.innerHTML=`<form class="market-edit-form"><label for="market-edit-wish">这件想做的小事</label><textarea id="market-edit-wish" maxlength="500" rows="5" required>${esc(note.text)}</textarea><button type="submit" class="market-primary">保存便签</button><button type="button" class="market-text-button">返回愿望便签</button></form>`;body.querySelector('.market-text-button').onclick=showWishes;body.querySelector('form').onsubmit=async e=>{e.preventDefault();const text=body.querySelector('textarea').value.trim(),b=body.querySelector('button[type=submit]');if(!text)return;b.disabled=true;try{await changeField(c,'shopWishNotes',old=>{if(!(old||[]).some(n=>n.id===note.id))throw Error('这条便签已被删除');return old.map(n=>n.id===note.id?{...n,text}:n);},archive);showWishes();renderShopContent();}catch(error){showToast(error.message);}finally{b.disabled=false;}};}
async function toggleCompare(item){const c=owner(),id=key(item);let added=false;await changeField(c,'shopComparison',old=>{const list=Array.isArray(old)?old:[];if(list.some(i=>key(i)===id))return list.filter(i=>key(i)!==id);if(list.length>=2)throw Error('对比架最多放两件，先移除一件再添加');added=true;return list.concat([snapshot(item)]);});renderShopContent();showToast(added?'已加入好物对比':'已移出对比架');return added;}
function showComparison(){const c=owner(),archive=c?.activeArchiveId,items=comparisons(c),body=openFeature('两件好物对比');body.innerHTML='<div class="market-sheet-intro"><small>THIS OR THAT</small><h3>纠结的时候，放一起看看。</h3><p>从商品详情加入两件，对照价格和描述再决定。</p></div><div class="market-compare-grid"></div>';const grid=body.querySelector('.market-compare-grid');
 for(let i=0;i<2;i++){const item=items[i],col=document.createElement('section');col.className='market-compare-column';if(!item){col.innerHTML='<div class="market-compare-slot">＋<span>还差一件心动好物</span></div><button type="button" class="market-text-button">去挑选</button>';col.querySelector('button').onclick=closeFeature;}else{col.innerHTML=`${artwork(item)}<h3>${esc(item.name)}</h3><strong>¥${esc(item.price)}</strong><p>${esc(item.desc||'暂无商品描述')}</p><button type="button" class="market-compare-add">加入购物车</button><button type="button" class="market-text-button">移出对比</button>`;col.querySelector('.market-compare-add').onclick=()=>{if(owner()!==c||c.activeArchiveId!==archive)return showToast('角色或存档已切换');addToCart(item);showToast('已加入购物车');};action(col.querySelector('.market-text-button'),async()=>{await changeField(c,'shopComparison',old=>(old||[]).filter(n=>key(n)!==key(item)),archive);showComparison();renderShopContent();});}grid.append(col);}
 if(items.length===2){const diff=document.createElement('div');diff.className='market-compare-difference';const delta=Math.abs(price(items[0])-price(items[1]));diff.innerHTML=`<span>${delta===0?'两件同价，选更喜欢的':'两件相差'}</span>${delta===0?'':`<strong>¥${delta.toFixed(2)}</strong>`}`;body.append(diff);}
}
function showCover(item,back){const c=owner(),archive=c?.activeArchiveId,body=openFeature('自定义商品封面');body.innerHTML=`<div class="market-sheet-intro"><small>YOUR OWN FINDS</small><h3>换成你喜欢的那张图。</h3><p>默认展示分类灵感封面，也可以填入自己的图片链接。</p></div><form class="market-edit-form"><label for="market-cover-url">图片链接</label><input id="market-cover-url" type="url" placeholder="https://…" value="${esc(c?.shopProductCovers?.[key(item)]||'')}"><button type="submit" class="market-primary">保存封面</button><button type="button" class="market-text-button">恢复分类封面</button></form>`;const save=async url=>{await changeField(c,'shopProductCovers',old=>{const next={...(old||{})};if(url)next[key(item)]=url;else delete next[key(item)];return next;},archive);renderShopContent();showItem(item,back,false);};body.querySelector('form').onsubmit=async e=>{e.preventDefault();const url=body.querySelector('input').value.trim();if(url&&!/^https?:\/\//i.test(url))return showToast('请使用 http 或 https 图片链接');const b=body.querySelector('button[type=submit]');b.disabled=true;try{await save(url);}catch(error){showToast(error.message);}finally{b.disabled=false;}};action(body.querySelector('.market-text-button'),()=>save(''));}
function wishPreview(container){const c=owner(),count=wishes(c).filter(n=>!n.done).length,section=document.createElement('section');section.className='market-wish-preview';section.innerHTML=`<button type="button" class="market-open-wishes"><span>${symbol('note')}</span><div><small>MY LITTLE WISHLIST</small><h3>愿望先记下，心意慢慢实现。</h3><p>${count?count+' 件心动小事，等着被实现':wishes(c).length?'已实现 '+wishes(c).length+' 件小愿望，继续收藏期待':'从一条便签，开始收藏生活的期待'}</p></div><b>＋</b></button>`;section.querySelector('button').onclick=showWishes;container.append(section);}
function navigation(){document.querySelectorAll('[data-market-nav]').forEach(b=>b.setAttribute('aria-current',(b.dataset.marketNav==='favorites'?state.view==='favorites':b.dataset.marketNav==='home'&&state.view==='home')?'page':'false'));const fab=document.querySelector('#shop-screen .shop-cart-fab');if(fab)fab.setAttribute('aria-label',`购物车，${shopState.cart.reduce((n,e)=>n+e.quantity,0)}件商品`);}
function closeFeature(){const overlay=$('shop-feature-overlay');if(overlay){overlay.hidden=true;dialogPrevious?.isConnected&&dialogPrevious.focus({preventScroll:true});}}
function openFeature(title){const overlay=$('shop-feature-overlay');if(overlay.hidden)dialogPrevious=document.activeElement;overlay.classList.remove('market-collection-overlay');$('shop-feature-title').textContent=title;$('shop-feature-body').replaceChildren();$('shop-feature-overlay').hidden=false;$('shop-feature-close').focus({preventScroll:true});return $('shop-feature-body');}
const saving=new WeakSet();
async function toggleFavorite(item){const c=owner();if(!c||saving.has(c))return;saving.add(c);const before=c.shopFavorites,old=favorites(c),id=key(item),exists=old.some(i=>key(i)===id),next=exists?old.filter(i=>key(i)!==id):old.concat([{name:String(item.name),price:String(item.price??0),desc:String(item.desc||''),type:item.type||'mystery',isAd:!!item.isAd}]);const release=window.PhoneBackup?.pinChat?.(c)||(()=>{});c.shopFavorites=next;try{if(window.PhoneBackup?.saveChat)await PhoneBackup.saveChat(c);else await saveData();renderShopContent();showToast(exists?'已移出心动清单':'已放进心动清单');return !exists;}catch(e){c.shopFavorites=before;showToast('收藏保存失败，请重试');throw e;}finally{release();saving.delete(c);}}
function showItem(item,back,track=true){if(track)recordBrowse(item);const c=owner(),archive=c?.activeArchiveId,body=openFeature('好物详情');body.innerHTML=artwork(item)+`<div class="market-detail-copy"><div class="market-detail-price">¥<strong>${esc(item.price)}</strong></div><h3>${esc(item.name)}</h3><p>${esc(item.desc||'一件值得慢慢挑选的小心意。')}</p><div class="market-detail-tools"><button type="button" class="market-detail-compare">${comparisons(c).some(i=>key(i)===key(item))?'已加入对比':'加入好物对比'}</button><button type="button" class="market-cover-edit">更换封面</button></div><div class="market-detail-actions"><button type="button" class="market-detail-heart">${favorites(c).some(i=>key(i)===key(item))?'♥ 已心动':'♡ 收藏'}</button><button type="button" class="market-detail-add">加入购物车</button></div></div>`;
 action(body.querySelector('.market-detail-compare'),async()=>{if(owner()!==c||c.activeArchiveId!==archive)throw Error('角色或存档已切换');await toggleCompare(item);showItem(item,back,false);});body.querySelector('.market-cover-edit').onclick=()=>showCover(item,back);
 body.querySelector('.market-detail-heart').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{if(owner()!==c||c.activeArchiveId!==archive)throw Error('角色或存档已切换');const active=await toggleFavorite(item);b.textContent=active?'♥ 已心动':'♡ 收藏';}catch(error){showToast(error.message);}finally{b.disabled=false;}};
 body.querySelector('.market-detail-add').onclick=()=>{if(owner()!==c||c.activeArchiveId!==archive){closeFeature();return showToast('角色或存档已切换，请重新选择商品');}addToCart(item);showToast('已加入购物车');if(back)back();else closeFeature();};
 if(back){const button=document.createElement('button');button.type='button';button.className='market-text-button market-detail-back';button.textContent='返回清单';button.onclick=back;body.prepend(button);}
}
function surprise(){const pool=rows();if(!pool.length)return showToast('当前条件下还没有商品，换个条件或先去进货吧');showItem(pool[Math.floor(Math.random()*pool.length)]);}
function showCategories(){const body=openFeature('逛逛分类');const list=document.createElement('div');list.className='market-category-picker';categories().forEach(cat=>{const b=document.createElement('button');b.type='button';b.textContent=cat.name.replace(/^[^\p{L}\p{N}]+/u,'');b.onclick=()=>{closeFeature();state.view='home';state.query='';$('shop-search-input').value='';switchShopTab(cat.id);};list.append(b);});body.append(list);const manage=document.createElement('button');manage.type='button';manage.className='market-primary';manage.textContent='管理自定义分类';manage.onclick=()=>{closeFeature();openCategoryManager();};body.append(manage);}
renderShopTabs=function(){const list=document.querySelector('#shop-screen .shop-tabs');if(!list)return;list.replaceChildren();categories().forEach(cat=>{const b=document.createElement('button');b.type='button';b.className='shop-tab-item'+(shopState.currentTab===cat.id?' active':'');b.dataset.id=cat.id;b.textContent=cat.name.replace(/^[^\p{L}\p{N}]+/u,'');b.onclick=()=>{state.view='home';state.query='';$('shop-search-input').value='';switchShopTab(cat.id);};list.append(b);});};
function card(item){const el=document.createElement('article');el.className='shop-item-card';el.innerHTML=`<button type="button" class="market-item-open">${artwork(item)}<div class="shop-item-info"><div class="shop-item-name">${item.isAd?'<span class="market-ad">广告</span>':''}${esc(item.name)}</div><p class="shop-item-desc">${esc(item.desc||'把喜欢，带回日常')}</p></div></button><button type="button" class="market-heart" aria-label="${favorites(owner()).some(i=>key(i)===key(item))?'取消收藏':'收藏'} ${esc(item.name)}" aria-pressed="${favorites(owner()).some(i=>key(i)===key(item))}">${favorites(owner()).some(i=>key(i)===key(item))?'♥':'♡'}</button><div class="shop-item-footer"><div class="shop-item-price">${esc(item.price)}</div><button type="button" class="shop-item-buy-btn" aria-label="加入购物车 ${esc(item.name)}">＋</button></div>`;
 el.querySelector('.market-item-open').onclick=()=>showItem(item);el.querySelector('.shop-item-buy-btn').onclick=()=>{addToCart(item);showToast('已加入购物车');};el.querySelector('.market-heart').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{await toggleFavorite(item);}catch(_){}finally{b.disabled=false;}};return el;}
function collectionItems(kind) {
 const all=allItems().filter(item=>!item.isAd);
 const preferred=kind==='wanted'?shopState.items.character_choice:kind==='festival'?shopState.items.recommend:[];
 const featured=(preferred||[]).filter(item=>item?.name&&!item.isAd);
 if(kind==='low')return all.filter(item=>price(item)>0).sort((a,b)=>price(a)-price(b));
 if(kind==='wanted')return [...new Map(featured.map(item=>[key(item),item])).values()];
 const gifts=all.filter(item=>['gift','flower'].includes(item.type));
 return [...new Map([...featured,...gifts,...all].map(item=>[key(item),item])).values()];
}
const history=c=>Array.isArray(c?.shopBrowseHistory)?c.shopBrowseHistory:[];
function recordBrowse(item) {
 const c=owner();
 if(!c||item.isAd)return;
 changeField(c,'shopBrowseHistory',old=>[snapshot(item),...(Array.isArray(old)?old:[]).filter(entry=>key(entry)!==key(item))].slice(0,24)).catch(console.warn);
}
function collectionRows(list,items,back) {
 items.forEach(item=>{
  const row=document.createElement('article');
  row.className='market-collection-row';
  row.innerHTML=`<button type="button" class="market-row-open">${artwork(item)}<div><h3>${esc(item.name)}</h3><p>${esc(item.desc||'打开看看这件好物')}</p><strong>¥${esc(item.price)}</strong></div></button><button type="button" class="market-row-add" aria-label="加购 ${esc(item.name)}">加购</button>`;
  row.querySelector('.market-row-open').onclick=()=>showItem(item,back);
  row.querySelector('.market-row-add').onclick=()=>{addToCart(item);showToast('已加入购物车');};
  list.append(row);
 });
}
const collections={
 low:['低价好物','按价格从低到高，慢慢挑一份小心意'],
 wanted:['TA想买','把 TA 喜欢的好物收在一起'],
 discover:['发现心意','从鲜花、礼物到日常小惊喜'],
 festival:['双十一心意节','本期推荐 · 从店内现有好物中挑选'],
 history:['逛店足迹','最近打开过的 24 件好物']
};
function showCollection(kind,scroll=0) {
 const [title,subtitle]=collections[kind];
 const items=kind==='history'?history(owner()):collectionItems(kind);
 const body=openFeature(title);
 $('shop-feature-overlay').classList.add('market-collection-overlay');
 body.innerHTML=`<div class="market-collection-intro ${kind==='festival'?'market-festival-intro':''}"><small>${kind==='festival'?'THE 11.11 EDIT':'KISS MARKET / COLLECTION'}</small><h3>${title}</h3><p>${subtitle}</p></div><div class="market-collection-meta"><span>${items.length} 件好物</span><button type="button">查看购物车</button></div><div class="market-collection-list"></div>`;
 body.querySelector('.market-collection-meta button').onclick=()=>{closeFeature();toggleCartPanel();};
 const list=body.querySelector('.market-collection-list');
 let savedScroll=scroll;
 collectionRows(list,items,()=>showCollection(kind,savedScroll));
 list.addEventListener('click',()=>{savedScroll=body.scrollTop;},true);
 if(!items.length)list.textContent=kind==='history'?'逛过的商品会出现在这里。':'这期还没有好物，可以进货后再来看看。';
 body.scrollTop=Number(scroll)||0;
}
function showLottery(previous) {
 const all=allItems().filter(item=>!item.isAd);
 const fresh=all.filter(item=>key(item)!==previous);
 const pool=fresh.length?fresh:all;
 const item=pool[Math.floor(Math.random()*pool.length)];
 const body=openFeature('好物抽签');
 body.innerHTML='<div class="market-sheet-intro"><small>LUCKY DRAW</small><h3>今天会抽中什么？</h3><p>从店内好物里随机挑一件。</p></div><div class="market-collection-list"></div>';
 if(!item){body.querySelector('.market-collection-list').textContent='进货后就可以抽签啦。';return;}
 collectionRows(body.querySelector('.market-collection-list'),[item],()=>showLottery());
 const again=document.createElement('button');
 again.type='button';again.className='market-primary';again.textContent='再抽一签';
 again.onclick=()=>showLottery(key(item));
 body.append(again);
}
function showGiftBudget(budget='') {
 const body=openFeature('送礼预算');
 body.innerHTML=`<div class="market-sheet-intro"><small>GIFT PAIRING</small><h3>给心意配个伴。</h3><p>填一个总预算，试着搭配两件礼物。</p></div><form class="market-edit-form"><label for="market-gift-budget">总预算（¥）</label><input id="market-gift-budget" type="number" min="0.01" step="0.01" required value="${esc(budget)}" placeholder="例如 100"><button class="market-primary">搭配两件</button></form><div class="market-collection-list"></div>`;
 const list=body.querySelector('.market-collection-list');
 const form=body.querySelector('form');
 form.onsubmit=event=>{event.preventDefault();showGiftBudget(form.querySelector('input').value);};
 if(budget==='')return;
 const cents=item=>Math.round(price(item)*100);
 const max=Math.round(Number(budget)*100);
 const affordable=collectionItems('low').filter(item=>cents(item)>0&&cents(item)<=max);
 let pair=[],total=0;
 for(let low=0,high=affordable.length-1;low<high;){
  const sum=cents(affordable[low])+cents(affordable[high]);
  if(sum>max){high--;continue;}
  if(sum>total){pair=[affordable[low],affordable[high]];total=sum;}
  low++;
 }
 if(!pair.length){list.textContent='预算内暂时凑不到两件，可以调整金额试试。';return;}
 const summary=document.createElement('div');
 summary.className='market-collection-meta';summary.textContent='搭配合计 ¥'+(total/100).toFixed(2);
 list.append(summary);
 collectionRows(list,pair,()=>showGiftBudget(budget));
}
function marketPlay(container) {
 const bar=document.createElement('section');
 bar.className='market-play';
 bar.innerHTML='<small>逛店小玩法</small>';
 for(const [title,run] of [['逛店足迹',()=>showCollection('history')],['送礼预算',()=>showGiftBudget()],['好物抽签',()=>showLottery()]]){
  const button=document.createElement('button');
  button.type='button';button.textContent=title;button.onclick=run;bar.append(button);
 }
 container.append(bar);
}
function festivalCard(container) {
 const button=document.createElement('button');
 button.type='button';
 button.className='market-festival';
 button.innerHTML='<span class="market-festival-copy"><small>KISS MARKET · 限定选集</small><b>11.11</b><strong>双十一心意节</strong><span>逛逛推荐好物 →</span></span>';
 button.onclick=()=>showCollection('festival');
 container.append(button);
}
function homeSections(container){const c=owner(),quick=document.createElement('section');quick.className='market-quick-tools';const tools=[['spark','灵感盲选',surprise],['note','愿望便签',showWishes],['compare','好物对比',showComparison],['parcel','自提口令',()=>$('shop-pickup-modal').classList.add('visible')]];tools.forEach(([iconName,title,action],i)=>{const b=document.createElement('button');b.type='button';b.innerHTML=`<span class="market-quick-icon market-quick-${i}">${symbol(iconName)}</span><span>${title}</span>`;b.onclick=action;quick.append(b);});container.append(quick);marketPlay(container);
 const all=allItems();if(!all.length){const welcome=document.createElement('section');welcome.className='market-welcome';welcome.innerHTML=`<div><small>HELLO, LITTLE JOYS</small><h2>把喜欢，<br>带回日常。</h2><p>为${esc(c?.remarkName||c?.realName||'TA')}挑一份专属好物</p><button type="button" class="market-primary">开始进货</button></div>${artwork({type:'gift'})}`;welcome.querySelector('button').onclick=forceRefreshShop;container.append(welcome);festivalCard(container);wishPreview(container);const inspiration=document.createElement('section');inspiration.className='market-inspiration';inspiration.innerHTML='<h3>把日常，逛成灵感</h3><div></div>';[['food','今日食堂','food'],['clothes','衣橱小事','general'],['flower','送你心意','general']].forEach(([type,title,category])=>{const b=document.createElement('button');b.type='button';b.innerHTML=artwork({type})+'<span>'+title+'</span>';b.onclick=()=>switchShopTab(category);inspiration.querySelector('div').append(b);});container.append(inspiration);return;}
 const specials=document.createElement('section');
 specials.className='market-specials';
 for(const kind of ['low','wanted','discover']){
  const [title,subtitle]=collections[kind];
  const items=collectionItems(kind);
  const item=items[0];
  const button=document.createElement('button');
  button.type='button';
  button.innerHTML=`<h3>${title}</h3><p>${subtitle}</p>${artwork(item||{type:'gift'})}<strong>${item?'¥'+esc(item.price):'待上新'}</strong>`;
  button.onclick=()=>showCollection(kind);
  specials.append(button);
 }
 container.append(specials);
 festivalCard(container);
}
renderShopContent=function(){safe();const container=$('shop-content-container');if(!container)return;$('shop-screen').scrollTop=0;container.replaceChildren();navigation();
 const onHome=state.view==='home'&&!state.query&&shopState.currentTab==='recommend'&&state.budget===''&&state.sort==='default';if(onHome)homeSections(container);if(onHome&&!allItems().length)return;
 const top=document.createElement('div');top.className='market-results-heading';const count=rows().length,heading=state.view==='favorites'?'心动清单':state.query?'搜索结果':categories().find(c=>c.id===shopState.currentTab)?.name?.replace(/^[^\p{L}\p{N}]+/u,'')||'为你推荐';top.innerHTML=`<div><h2>${esc(heading==='推荐'?'为你推荐':heading)}</h2><span>${state.query?'“'+esc(state.query)+'” · ':''}${count} 件好物</span></div><button type="button" class="market-random">帮我挑一件</button>`;top.querySelector('button').onclick=surprise;container.append(top);
 const filters=document.createElement('div');filters.className='market-filters';filters.innerHTML=`<label class="market-sort-label"><select id="market-sort" aria-label="商品排序"><option value="default">综合推荐</option><option value="low">价格低到高</option><option value="high">价格高到低</option></select></label><div class="market-budget-label"><span>预算 ¥</span><input id="market-budget" type="number" min="0" step="0.01" inputmode="decimal" aria-label="最高预算" placeholder="不限" value="${esc(state.budget)}"><button type="button" class="market-apply-budget">筛选</button></div>${state.query||state.budget!==''||state.sort!=='default'?'<button type="button" class="market-reset">重置</button>':''}`;filters.querySelector('select').value=state.sort;filters.querySelector('select').onchange=e=>{state.sort=e.target.value;renderShopContent();};const applyBudget=()=>{const field=filters.querySelector('input'),n=Number(field.value);if(field.value!==''&&(!Number.isFinite(n)||n<0)){field.value=state.budget;return showToast('预算请输入不小于0的金额');}state.budget=field.value;renderShopContent();};filters.querySelector('.market-apply-budget').onclick=applyBudget;filters.querySelector('input').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();applyBudget();}};filters.querySelector('.market-reset')?.addEventListener('click',()=>{state.query='';state.budget='';state.sort='default';$('shop-search-input').value='';renderShopContent();});container.append(filters);
 if(state.view==='favorites'){const tools=document.createElement('div');tools.className='market-saved-tools';tools.innerHTML='<button type="button">愿望便签</button><button type="button">好物对比</button>';tools.children[0].onclick=showWishes;tools.children[1].onclick=showComparison;container.append(tools);}const items=rows();if(!items.length){const empty=document.createElement('div');empty.className='shop-empty-state market-empty';empty.innerHTML=`<span aria-hidden="true">${state.view==='favorites'?'♡':'⌕'}</span><h3>${state.view==='favorites'?'把喜欢，先收藏起来':state.query||state.budget!==''?'换个条件，再逛逛':'好物正在等你发现'}</h3><p>${state.view==='favorites'?'点一下商品上的爱心，下次想买时就能找到。':state.query||state.budget!==''?'试试更短的关键词，或调整预算。':allItems().length?'这个分类暂时还没有商品，可通过进货补充。':'点击「开始进货」，生成属于你们的商品。'}</p>`;if(!onHome&&state.view!=='favorites'&&!state.query&&state.budget===''){const b=document.createElement('button');b.type='button';b.className='market-primary';b.textContent='开始进货';b.onclick=forceRefreshShop;empty.append(b);}container.append(empty);return;}
 const grid=document.createElement('div');grid.className='shop-grid';items.forEach(item=>grid.append(card(item)));container.append(grid);const end=document.createElement('p');end.className='market-end';end.textContent='喜欢的，都是生活的小确幸';container.append(end);
};
renderShopInitialState=function(){shopState.items={recommend:[],food:[],general:[],guess:[],character_choice:[]};shopState.banner=null;renderShopContent();};
const oldLoading=renderShopLoading;renderShopLoading=function(){safe();oldLoading();navigation();const h=document.createElement('p');h.className='market-loading-label';h.setAttribute('role','status');h.textContent='正在为你们挑选好物…';$('shop-content-container').prepend(h);};
const oldOpen=openShopScreen;openShopScreen=async function(){state={query:'',sort:'default',budget:'',view:'home'};if($('shop-search-input'))$('shop-search-input').value='';await oldOpen();closeCartPanel();$('shop-screen').scrollTop=0;navigation();};
const oldCartInit=initCartUI;initCartUI=function(){oldCartInit();const panel=document.querySelector('#shop-screen .shop-cart-panel');if(panel){panel.inert=true;panel.setAttribute('aria-hidden','true');panel.tabIndex=-1;panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeCartPanel();}});}const fab=document.querySelector('#shop-screen .shop-cart-fab');if(fab&&$('shop-market-cart-slot')){const label=document.createElement('span');label.className='market-cart-label';label.textContent='购物车';fab.querySelector('.shop-cart-content').append(label);fab.setAttribute('role','button');fab.tabIndex=0;fab.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleCartPanel();}};$('shop-market-cart-slot').append(fab);navigation();}};
const oldCloseCart=closeCartPanel;closeCartPanel=function(){const panel=document.querySelector('#shop-screen .shop-cart-panel');if(panel?.contains(document.activeElement))document.activeElement.blur();oldCloseCart();if(panel){panel.inert=true;panel.setAttribute('aria-hidden','true');}if($('shop-screen'))$('shop-screen').scrollTop=0;};
const oldToggleCart=toggleCartPanel;toggleCartPanel=function(){oldToggleCart();const panel=document.querySelector('#shop-screen .shop-cart-panel');if(panel){const active=panel.classList.contains('active');panel.inert=!active;panel.setAttribute('aria-hidden',String(!active));if(active)panel.focus({preventScroll:true});}};
const oldUpdate=updateCartUI;updateCartUI=function(){oldUpdate();navigation();};
const oldSetup=setupShopSystem;setupShopSystem=function(){oldSetup();$('shop-screen').addEventListener('error',e=>{const img=e.target;if(img.matches?.('img[data-market-fallback]')&&!img.dataset.marketFailed){img.dataset.marketFailed='1';img.src=img.dataset.marketFallback;}},true);const search=$('shop-search-form');search.onsubmit=e=>{e.preventDefault();state.query=$('shop-search-input').value.trim();renderShopContent();$('shop-content-container').scrollTop=0;};$('shop-search-input').addEventListener('input',e=>{if(!e.target.value&&state.query){state.query='';renderShopContent();}});document.querySelectorAll('[data-market-nav]').forEach(b=>b.onclick=()=>{const target=b.dataset.marketNav;if(target==='categories')return showCategories();closeFeature();state.query='';$('shop-search-input').value='';state.view=target==='favorites'?'favorites':'home';state.budget='';state.sort='default';if(target==='home')switchShopTab('recommend');else renderShopContent();$('shop-content-container').scrollTop=0;});$('shop-feature-close').onclick=closeFeature;$('shop-feature-overlay').onclick=e=>{if(e.target===$('shop-feature-overlay'))closeFeature();};$('shop-feature-overlay').onkeydown=e=>{if(e.key==='Escape')closeFeature();if(e.key==='Tab'){const nodes=[...$('shop-feature-overlay').querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled&&el.getClientRects().length),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};navigation();};
window.KissShopMarket={allItems,rows,key,showItem,surprise,closeFeature,showWishes,showComparison,changeField};
})();
