const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function harness(){
 const c={id:'a',customBubbleCss:'.old{}',useCustomBubbleCss:true,myName:'Me',realName:'A',history:[]},db={activePersonaId:'owner',characters:[c],groups:[],globalCss:'.global{}',apiSettings:{provider:'gemini',url:'https://example.test',key:'test',model:'gemini-test'}};
 const source={kind:'chat',chatId:'a',name:'A',css:'.old{}'},images=[],revoked=[],refreshes=[],writes=[],controls=[];
 const status={textContent:'',classList:{toggle(){}}},repairButton={dataset:{wb:'repair'},disabled:false,textContent:''};controls.push(repairButton);
 const selectors=new Map([['.wb-status',status],['[data-wb=repair]',repairButton]]),ids=new Map(),host={classList:{contains:()=>true}},ui={querySelector:s=>selectors.get(s)||null,querySelectorAll:()=>controls};
 let draw='';const canvas={width:0,height:0,getContext:()=>({fillRect(){},drawImage:image=>{draw=image.src;}}),toDataURL:()=>draw};
 const Core={hash:s=>s,resolve:s=>({css:s.css}),saveRepair:async(s,old,next,owner)=>{writes.push({source:s,old,next,owner});s.css=next;c.customBubbleCss=next;return {updatedChats:1};}};
 const box={window:{KissStyleCore:Core},db,console,AbortController,DOMException,setTimeout,clearTimeout,currentChatId:'a',currentChatType:'private',confirm:()=>true,URL:{createObjectURL:file=>'blob:'+file.name,revokeObjectURL:url=>revoked.push(url)},Image:class{constructor(){this.naturalWidth=600;this.naturalHeight=900;this.ready=deferred();images.push(this);}decode(){return this.ready.promise;}},innerWidth:390,innerHeight:800,document:{querySelector:()=>null,getElementById:id=>ids.get(id)||null,createElement:tag=>{assert.equal(tag,'canvas');return canvas;}},updateCustomBubbleStyle:(...args)=>refreshes.push(args)};
 vm.createContext(box);
 const hook=`root.__test={setup(p){if('view'in p)view=p.view;if('selected'in p)selected=p.selected;if('kind'in p)kind=p.kind;if('draft'in p)draft=p.draft;if('frame'in p)frame=p.frame;if('reference'in p)reference=p.reference;if('baseline'in p)baseline=p.baseline;if('ui'in p)ui=p.ui;if('host'in p)host=p.host;if('owner'in p)accountAtOpen=p.owner;if('chatId'in p)chatId=p.chatId;},state(){return {selected,draft,reference,referenceLoading,busy,saving,baseline};},readReference,setSource,stop,save,repair,refreshSavedStyle,prepareCaptureClone,previewMarkup,queueThumb,pumpThumbs,releaseThumb,galleryCount(){return galleryFrames.size;},replaceGalleryFactories(html,frame){docHTML=html;makeFrame=frame;},replaceCapture(fn){capture=fn;}};`;
 const code=fs.readFileSync('js/modules/style-workbench.js','utf8').replace('root.KissStyleWorkbench={',hook+'\nroot.KissStyleWorkbench={');vm.runInContext(code,box);
 const api=box.window.__test;api.setup({selected:source,kind:'chat',baseline:source.css,reference:'old-reference',owner:'owner',chatId:'a',ui,host});
 return {api,box,db,c,source,Core,images,revoked,refreshes,writes,selectors,ids,status,repairButton,controls};
}
const file=name=>({name,size:20,type:'image/png'});
test('an image finishing after a different theme is selected cannot attach to that theme',async()=>{const h=harness(),pending=h.api.readReference(file('old'));h.api.setSource({kind:'chat',store:'bubbleCssPresets',id:'b',name:'B',css:'.b{}'});h.images[0].ready.resolve();await pending;assert.equal(h.api.state().reference,'');assert.equal(h.api.state().selected.name,'B');assert.deepEqual(h.revoked,['blob:old']);});
test('the last selected reference image wins even when decoding completes out of order',async()=>{const h=harness(),first=h.api.readReference(file('first')),second=h.api.readReference(file('second'));h.images[1].ready.resolve();await second;h.images[0].ready.resolve();await first;assert.equal(h.api.state().reference,'blob:second');assert.equal(h.api.state().referenceLoading,false);assert.equal(h.revoked.length,2);});
test('closing during image decode discards the unfinished upload',async()=>{const h=harness(),pending=h.api.readReference(file('pending'));h.api.stop();h.images[0].ready.resolve();await pending;assert.equal(h.api.state().reference,'old-reference');assert.equal(h.api.state().referenceLoading,false);});
test('reference image errors from a previous persona do not alter the current page',async()=>{const h=harness(),pending=h.api.readReference(file('old'));h.db.activePersonaId='new';h.images[0].ready.reject(Error('bad image'));await pending;assert.equal(h.api.state().reference,'old-reference');});
test('generation cannot start while a newly selected reference is still decoding',async()=>{const h=harness(),pending=h.api.readReference(file('new'));await assert.rejects(h.api.repair(),/正在读取/);assert.equal(h.api.state().busy,false);h.images[0].ready.resolve();await pending;});
test('saving refreshes the active chat CSS and enabled switch without overwriting other editors',async()=>{const h=harness();for(const id of ['setting-custom-bubble-css','setting-group-custom-bubble-css','global-beautification-css'])h.ids.set(id,{value:'unsaved '+id,disabled:true});h.ids.set('setting-use-custom-css',{checked:false});h.api.setup({draft:{css:'.new{}',changes:[]}});await h.api.save();assert.equal(h.writes.length,1);assert.equal(h.ids.get('setting-custom-bubble-css').value,'.new{}');assert.equal(h.ids.get('setting-use-custom-css').checked,true);assert.equal(h.ids.get('setting-custom-bubble-css').disabled,false);assert.equal(h.ids.get('setting-group-custom-bubble-css').value,'unsaved setting-group-custom-bubble-css');assert.equal(h.ids.get('global-beautification-css').value,'unsaved global-beautification-css');assert.deepEqual(h.refreshes,[['a','.new{}',true]]);assert.equal(h.api.state().draft,null);});
test('a display refresh failure still reports that the CSS was already saved',async()=>{const h=harness();h.box.updateCustomBubbleStyle=()=>{throw Error('render failed');};h.api.setup({draft:{css:'.new{}',changes:[]}});await h.api.save();assert.equal(h.writes.length,1);assert.equal(h.api.state().draft,null);assert.equal(h.api.state().busy,false);assert.match(h.status.textContent,/已覆盖保存/);assert.match(h.status.textContent,/界面刷新未完成/);});
test('a failed save retains the repair draft for retry',async()=>{const h=harness();h.Core.saveRepair=async()=>{throw Error('disk failed');};h.api.setup({draft:{css:'.new{}',changes:[]}});await h.api.save();assert.equal(h.api.state().draft.css,'.new{}');assert.equal(h.api.state().busy,false);assert.match(h.status.textContent,/disk failed/);assert.equal(h.refreshes.length,0);});
async function startRepair(h){const response=deferred(),requested=deferred();h.api.setup({frame:{remove(){},_wbReady:Promise.resolve(),contentDocument:{querySelectorAll:()=>[]}}});h.api.replaceCapture(async()=> 'data:image/jpeg;base64,YQ==');h.api.setup({reference:'data:image/jpeg;base64,Yg=='});h.box.fetch=async(url,options)=>{requested.resolve(JSON.parse(options.body));return response.promise;};const pending=h.api.repair(),body=await requested.promise;return {pending,body,response};}
test('repair sends the two images but does not persist a result before confirmation',async()=>{const h=harness(),r=await startRepair(h);assert.equal(r.body.contents[0].parts[1].inline_data.data,'YQ==');assert.equal(r.body.contents[0].parts[2].inline_data.data,'Yg==');r.response.resolve({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"css":".new{}","changes":["color"]}'}]},finishReason:'STOP'}]})});await r.pending;assert.equal(h.api.state().draft.css,'.new{}');assert.equal(h.writes.length,0);assert.equal(h.c.customBubbleCss,'.old{}');});
test('cancelled repair results arriving late cannot create a draft or write CSS',async()=>{const h=harness(),r=await startRepair(h);h.api.stop();r.response.resolve({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"css":".new{}","changes":[]}'}]}}]})});await r.pending;assert.equal(h.api.state().draft,null);assert.equal(h.writes.length,0);assert.equal(h.c.customBubbleCss,'.old{}');});
test('a repair becomes stale if the original CSS changes while the model is replying',async()=>{const h=harness(),r=await startRepair(h);h.source.css='.external{}';r.response.resolve({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"css":".new{}","changes":[]}'}]}}]})});await r.pending;assert.equal(h.api.state().draft,null);assert.equal(h.writes.length,0);assert.match(h.status.textContent,/已变化/);});
test('offline repair instructions preserve actual Shadow DOM host selectors',async()=>{const h=harness();h.api.setup({kind:'offline'});const r=await startRepair(h);assert.match(r.body.contents[0].parts[0].text,/宿主规则须保留 :host/);r.response.resolve({ok:false,status:500});await r.pending;assert.equal(h.writes.length,0);});

test('capture suppresses only pseudo elements already materialized by html2canvas',()=>{
 const h=harness(),appended=[],doc={createElement:tag=>{assert.equal(tag,'style');return {textContent:''};},head:{append:node=>appended.push(node)}};
 h.api.prepareCaptureClone(doc);
 assert.equal(appended.length,1);
 const css=appended[0].textContent,rules=css.split('\n');
 assert.equal(rules.length,2);
 for(const side of ['before','after']){
  const rule=rules.find(row=>row.startsWith('.___html2canvas___pseudoelement_'+side));
  assert.ok(rule);
  assert.equal((rule.match(/:not\(#wb-capture-unused-/g)||[]).length,32);
  assert.ok(rule.endsWith('::'+side+'{content:none!important;display:none!important;}'));
 }
 // Neither author styles nor the live iframe DOM are an input to this hook.
 assert.equal(h.c.customBubbleCss,'.old{}');
});
test('chat preview uses the canonical room instead of live theme decorations',()=>{
 const h=harness(),depths=[],area={innerHTML:''},label={textContent:''};
 const node={attributes:[],tagName:'SECTION',className:'screen chat-active-old',style:{setProperty(){}},classList:{add(){},toggle(){},remove(){}},innerHTML:'',cloneNode:()=>node,querySelectorAll:()=>[],querySelector:s=>s==='#message-area'?area:s==='#chat-room-title'?label:null,get outerHTML(){return this.innerHTML;}};
 const original={cloneNode:deep=>{depths.push(deep);return node;}};
 h.box.chatRoomHtml='<header>canonical-room</header><main id="message-area"></main>';
 h.ids.set('chat-room-screen',original);
 h.box.document.createTextNode=text=>({textContent:text});
 const html=h.api.previewMarkup('chat',null,{},false,false);
 assert.deepEqual(depths,[false]);
 assert.ok(html.includes('canonical-room'));
 assert.match(area.innerHTML,/先添加角色/);
 assert.equal(h.box.chatRoomHtml,'<header>canonical-room</header><main id="message-area"></main>');
});

function galleryHarness(){
 const h=harness(),frames=[],cards=[],resizes=[];h.api.setup({view:'gallery'});
 h.box.ResizeObserver=class{constructor(fn){this.fn=fn;resizes.push(this);}observe(){this.fn();}disconnect(){this.disconnected=true;}};
 h.api.replaceGalleryFactories((p,css)=>css,html=>{const f={html,width:390,height:844,isConnected:false,style:{},remove(){this.isConnected=false;}};frames.push(f);return f;});
 function card(index){const label={textContent:''},box={clientWidth:160,clientHeight:346,innerHTML:'',replaceChildren(f){this.frame=f;f.isConnected=true;},querySelector:()=>label};const c={isConnected:true,_visible:true,_preset:{kind:'chat',name:'Theme '+index,css:'#header::before{content:"'+index+'"}'},querySelector:()=>box};cards.push(c);return c;}
 return {...h,frames,cards,resizes,card};
}
test('a 482-theme gallery creates at most six native previews and never calls the screenshot renderer',async()=>{
 const h=galleryHarness();h.api.replaceCapture(()=>{throw Error('gallery must not rasterize CSS');});
 for(let i=0;i<482;i++){const c=h.card(i);h.api.queueThumb(c,c._preset);}
 assert.equal(h.api.galleryCount(),6);assert.equal(h.frames.length,6);
 assert.ok(h.frames.every(f=>f.isConnected&&f.title.endsWith('效果预览')));
 // A pending load in the first frame cannot block the other visible cards.
 assert.equal(h.frames[0].contentDocument,undefined);
 h.api.stop();await Promise.resolve();await Promise.resolve();
 assert.equal(h.api.galleryCount(),0);assert.ok(h.frames.every(f=>!f.isConnected));assert.ok(h.resizes.every(r=>r.disconnected));
});
test('scrolling out releases a native frame and gives the next visible card a slot',async()=>{
 const h=galleryHarness();for(let i=0;i<7;i++){const c=h.card(i);h.api.queueThumb(c,c._preset);}
 h.cards[0]._visible=false;h.api.releaseThumb(h.cards[0]);await h.api.pumpThumbs();
 assert.equal(h.api.galleryCount(),6);assert.equal(h.frames.length,7);assert.equal(h.frames[0].isConnected,false);assert.equal(h.frames[6].isConnected,true);
 h.api.stop();await Promise.resolve();await Promise.resolve();
 assert.equal(h.api.galleryCount(),0);
});
