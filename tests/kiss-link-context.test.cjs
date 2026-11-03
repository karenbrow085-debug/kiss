const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(){
 const card={url:'https://xhslink.cn/o/test',title:'标题',description:'正文'.repeat(30000)+'全文尾部',textKind:'post_caption',previewState:'loaded',images:['https://img.test/1','https://img.test/2'],comments:[]};
 let calls=0;
 const s={window:{KissLinkCards:{get:m=>!m.isContextDisabled&&!m.withdrawn&&m.content?.includes('xhslink')?[card]:[],prefetch:async()=>{},imageProxy:url=>'https://proxy.test/?url='+url}},AbortController,DOMException,setTimeout,clearTimeout,fetch:async url=>{calls++;return {ok:true,blob:async()=>new Blob([url],{type:'image/png'})};},FileReader:class{readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result='data:image/png;base64,'+Buffer.from(b).toString('base64');this.onload();});}}};
 vm.createContext(s);vm.runInContext(fs.readFileSync('js/modules/link-context.js','utf8'),s);
 const generation={check(){},waitFor:p=>p,signal:new AbortController().signal};
 return {s,api:s.window.KissLinkContext,card,generation,calls:()=>calls};
}
test('all returned caption text and image bytes reach a copied user message in order',async()=>{
 const {api,generation}=setup();const history=[{role:'assistant',content:'你好'},{role:'user',content:'https://xhslink.cn/o/test',quote:{content:'引用文字'}}];const before=JSON.stringify(history);const result=await api.prepare(history,generation);const m=result.history[1];assert.equal(result.provided,true);assert.match(m.content,/全文尾部/);assert.match(m.content,/未获取评论区/);assert.match(m.content,/未另行核验完整性/);assert.ok(m.parts.some(p=>p.text?.includes('引用文字')));const images=m.parts.filter(p=>p.type==='image');assert.equal(images.length,2);assert.equal(Buffer.from(images[0].data.split(',')[1],'base64').toString(),'https://img.test/1');assert.equal(Buffer.from(images[1].data.split(',')[1],'base64').toString(),'https://img.test/2');assert.equal(JSON.stringify(history),before);
});
test('image CORS failure retries through image proxy; permanent failure is explicit',async()=>{
 const {api,s,generation,card}=setup();s.fetch=async url=>{if(!url.startsWith('https://proxy.test'))throw Error('CORS');return {ok:true,blob:async()=>new Blob(['picture'],{type:'image/webp'})};};const h=[{role:'user',content:'https://xhslink.cn/o/test'}];let r=await api.prepare(h,generation);assert.equal(r.history[0].parts.filter(p=>p.type==='image').length,2);s.fetch=async()=>{throw Error('offline');};r=await api.prepare(h,generation);assert.equal(r.history[0].parts.filter(p=>p.type==='image').length,2);card.images=['https://img.test/not-read-1','https://img.test/not-read-2'];r=await api.prepare(h,generation);assert.equal(r.history[0].parts.filter(p=>p.type==='image').length,0);assert.match(r.history[0].content,/未读取成功/);
});
test('unrelated messages do not reload old link images; explicit follow-up can read them',async()=>{
 const {api,generation,calls}=setup();const h=[{role:'user',content:'https://xhslink.cn/o/test'},{role:'assistant',content:'看到了'},{role:'user',content:'晚安'}];assert.equal((await api.prepare(h,generation)).provided,false);assert.equal(calls(),0);h[2].content='这篇内容是什么';assert.equal((await api.prepare(h,generation)).provided,true);
});
test('failed previews and video descriptions never claim verified full-page or video access',async()=>{
 const {api,card,generation}=setup();card.previewState='error';card.previewError='限流';card.images=[];card.textKind='summary';let r=await api.prepare([{role:'user',content:card.url}],generation);assert.equal(r.provided,false);assert.match(r.history[0].content,/不是已核验的全文/);assert.match(r.history[0].content,/限流/);card.textKind='video_description';assert.match(api.record(card).textScope,/没有读取视频画面或音轨/);
});
test('cancelled generation stops before any image download',async()=>{
 const {api,generation,calls}=setup();generation.check=()=>{throw new DOMException('stop','AbortError');};await assert.rejects(api.prepare([{role:'user',content:'https://xhslink.cn/o/test'}],generation),{name:'AbortError'});assert.equal(calls(),0);
});
test('ready link attachments skip duplicate search unless the user requests online tools',()=>{
 const {api}=setup();const g={linkContext:{provided:true}};assert.equal(api.skipTools(g,'读一下这篇'),true);for(const text of ['搜索其他信息','联网核实','调用 MCP'])assert.equal(api.skipTools(g,text),false);assert.equal(api.skipTools({linkContext:{provided:false}},'读一下'),false);
});

test('extracted page text and images are transmitted with their actual source scope',async()=>{const {api,card,generation}=setup();card.body='完整网页正文'.repeat(12000)+'正文最后一句';card.textKind='page_extract';card.sourceProvider='Jina Reader';const r=await api.prepare([{role:'user',content:card.url}],generation);const m=r.history[0];assert.match(m.content,/正文最后一句/);assert.match(m.content,/网页实际提取的正文/);assert.match(m.content,/未核验原站完整性/);assert.equal(m.parts.filter(p=>p.type==='image').length,2);});

test('the reported quoted-card question reattaches that exact card after an assistant reply',async()=>{const {api,generation}=setup();const h=[{id:'old-link',role:'user',content:'https://xhslink.cn/o/test'},{role:'assistant',content:'看到了'},{id:'other-link',role:'user',content:'https://xhslink.cn/o/other'},{role:'assistant',content:'另一篇'},{role:'user',content:'你看到了几张图',quote:{messageId:'old-link',content:'老啥子双人头像。'}}];const selected=api.relevant(h).selected;assert.equal(selected.length,1);assert.equal(selected[0].m.id,'old-link');const r=await api.prepare(h,generation);assert.equal(r.history.at(-1).parts.filter(p=>p.type==='image').length,2);assert.equal(r.receipt.imageCandidates,2);});
test('an unquoted image-count follow-up also reloads the most recent link images',async()=>{const {api,generation}=setup();const h=[{role:'user',content:'https://xhslink.cn/o/test'},{role:'assistant',content:'看到了'},{role:'user',content:'你看到了几张图'}];const r=await api.prepare(h,generation);assert.equal(r.history.at(-1).parts.filter(p=>p.type==='image').length,2);});

test('link image reference numbering stays aligned with the actual successful pixels',async()=>{const {api,generation}=setup();const result=await api.prepare([{role:'user',content:'https://xhslink.cn/o/test'}],generation);assert.equal(result.media.length,2);assert.equal(result.media[1].ref,'link-1-2');assert.equal(result.media[1].index,2);assert.equal(result.media[1].url,'https://xhslink.cn/o/test');assert.equal(result.media[1].data,result.history[0].parts.filter(p=>p.type==='image')[1].data);});

test('local saved-image actions do not invoke MCP unless the user separately asks to search',()=>{const {api}=setup();assert.equal(api.skipTools({linkImages:{images:new Map()}},'把第二张保存进相册换头像'),true);assert.equal(api.skipTools({linkImages:{images:new Map()}},'搜索这张图的作者'),false);});
test('successfully read image bytes are reused for later turns without another network read',async()=>{const {api,generation,calls}=setup();const first=await api.loadImage('https://img.test/persistent',generation);assert.equal(await api.loadImage('https://img.test/persistent',generation),first);assert.equal(calls(),1);});

test('image data survives a new page instance and can be read again while offline',async()=>{const stored=new Map(),indexedDB={open(){const r={};setImmediate(()=>{r.result={transaction(){return {objectStore(){return {get(key){const q={};setImmediate(()=>{q.result=stored.get(key);q.onsuccess?.();});return q;},put(value,key){stored.set(key,value);}};}};}};r.onsuccess?.();});return r;}};const first=setup();first.s.indexedDB=indexedDB;vm.runInContext(fs.readFileSync('js/modules/link-context.js','utf8'),first.s);const data=await first.s.window.KissLinkContext.loadImage('https://img.test/again',first.generation);assert.equal(stored.size,1);const next=setup();next.s.indexedDB=indexedDB;next.s.fetch=()=>assert.fail('cached image must not be fetched again');vm.runInContext(fs.readFileSync('js/modules/link-context.js','utf8'),next.s);assert.equal(await next.s.window.KissLinkContext.loadImage('https://img.test/again',next.generation),data);});
