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
 const {api,s,generation}=setup();s.fetch=async url=>{if(!url.startsWith('https://proxy.test'))throw Error('CORS');return {ok:true,blob:async()=>new Blob(['picture'],{type:'image/webp'})};};const h=[{role:'user',content:'https://xhslink.cn/o/test'}];let r=await api.prepare(h,generation);assert.equal(r.history[0].parts.filter(p=>p.type==='image').length,2);s.fetch=async()=>{throw Error('offline');};r=await api.prepare(h,generation);assert.equal(r.history[0].parts.filter(p=>p.type==='image').length,0);assert.match(r.history[0].content,/未读取成功/);
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
