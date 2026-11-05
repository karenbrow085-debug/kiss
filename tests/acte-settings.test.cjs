const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const {webcrypto} = require('node:crypto');

function fixture(provider = 'openai') {
    const calls = [];
    const db = {characters:[],worldBooks:[],apiSettings:{provider,url:'https://example.invalid',key:'test',model:'test',temperature:0.8}};
    const box = {db,URL,crypto:webcrypto,performance,Response,TextDecoder,window:{},getRandomValue:x=>x,
        buildChatApiRequest:(_config,messages)=>({endpoint:'https://example.invalid',headers:{},requestBody:{messages,temperature:0.8,max_completion_tokens:4096}}),
        fetch:async(_url,args)=>{calls.push(JSON.parse(args.body));return new Response('{}');}};
    box.window.KissOffline = {resolveOfflineApi:()=>db.apiSettings};
    box.window.KissOfflineGeneration = {readResponse:async()=>({full:'Scene'}),split:text=>({text})};
    vm.createContext(box);
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/modules/acte-data.js'),'utf8'),box);
    return {api:box.window.ActeData,db,calls,box};
}

test('theatre settings preserve zero temperature and reject malformed imported numeric overrides',()=>{
    const {api}=fixture();
    const w=api.makeWork({protagonistName:'我',roleTags:'学生',generation:{temperature:0,maxOutput:2048,responseStyle:'适度描写'}});
    assert.equal(w.generation.temperature,0);
    assert.equal(w.generation.maxOutput,2048);
    assert.equal(w.generation.responseStyle,'适度描写');
    assert.equal(w.protagonistName,'我');
    assert.equal(w.roleTags,'学生');
    const bad=api.makeWork({generation:{temperature:99,maxOutput:-1}});
    assert.equal(bad.generation.temperature,null);
    assert.equal(bad.generation.maxOutput,null);
    const inherit=api.makeWork({generation:{}});
    assert.equal(inherit.generation.temperature,null);
    assert.equal(inherit.generation.maxOutput,null);
});

for (const provider of ['openai','gemini']) test(provider+' theatre overrides affect only this request',async()=>{
    const {api,db,calls}=fixture(provider);
    const original=JSON.stringify(db.apiSettings);
    await api.ask([{role:'user',content:'继续'}],{mode:'plain',temperature:0,maxOutput:2048,responseStyle:'贴近角色'});
    const sent=calls[0];
    if(provider==='gemini') {
        assert.equal(sent.generationConfig.temperature,0);
        assert.equal(sent.generationConfig.maxOutputTokens,2048);
    } else {
        assert.equal(sent.temperature,0);
        assert.equal(sent.max_tokens,2048);
        assert.equal(sent.max_completion_tokens,undefined);
    }
    assert(sent.messages.some(m=>m.content.includes('贴近角色')));
    assert.equal(JSON.stringify(db.apiSettings),original);
    await api.ask([{role:'user',content:'继续'}],{mode:'plain'});
    assert.equal(calls[1].max_tokens,undefined);
    assert.equal(calls[1].max_completion_tokens,4096);
    assert.equal(calls[1].temperature,0.8);
});


test('annotations preserve author identity and nested replies when a work is normalised',()=>{
    const {api}=fixture();
    const work=api.makeWork({kind:'prose',acts:[{rows:[{role:'assistant',text:'剧情',comments:[
        {text:'旧批注',at:1},
        {id:'root',authorType:'actor',actorId:'a',name:'林钧',text:'演员点评',at:2},
        {id:'reply',authorType:'user',parentId:'root',replyTo:'root',text:'用户回复',at:3},
        {id:'reply2',authorType:'actor',actorId:'a',parentId:'reply',replyTo:'reply',text:'演员再回复',at:4}
    ]}]}]});
    const notes=work.acts[0].rows[0].comments;
    assert.equal(notes[0].id,'legacy-0');
    assert.equal(notes[1].authorType,'actor');
    assert.equal(notes[2].parentId,'root');
    assert.equal(notes[3].parentId,'root');
    assert.equal(notes[3].replyTo,'reply');
    assert.equal(work.acts[0].rows.length,1);
    const restored=api.makeWork(JSON.parse(JSON.stringify(work)));
    assert.equal(restored.acts[0].rows[0].comments.length,4);
    assert.equal(restored.acts[0].rows[0].comments[2].id,'reply');
});

test('dialogue speech and narration remain separate and NPCs use both sides',()=>{
    const {api}=fixture();
    const parts=api.dialogueSegments({role:'assistant',text:'他笑了笑。“你好。”随后低下头。'});
    assert.equal(parts.length,3);
    assert.equal(parts[0].type,'narration');
    assert.equal(parts[1].type,'speech');
    assert.equal(parts[1].text,'你好。');
    assert.equal(parts[2].type,'narration');
    const rich=api.dialogueSegments({role:'assistant',text:'<content>他问：“走吗？”</content><branches>等一等</branches>'});
    assert.equal(rich.length,1);
    assert.equal(rich[0].type,'narration');
    assert.equal(api.dialogueSegments({messageType:'narration',text:'他低下头。'})[0].type,'narration');
    const work={cast:[{id:'a',part:'主角'},{id:'b'},{id:'c'}]};
    assert.equal(api.dialogueSide(work,{role:'user'}),'right');
    assert.equal(api.dialogueSide(work,{role:'assistant',actorId:'a'}),'left');
    assert.equal(api.dialogueSide(work,{role:'assistant',actorId:'b'}),'right');
    assert.equal(api.dialogueSide(work,{role:'assistant',actorId:'c'}),'left');
    work.dialogueSides={b:'left',c:'right'};
    assert.equal(api.dialogueSide(work,{role:'assistant',actorId:'c'}),'right');
});


test('HTML fragments keep their inline handlers and existing full documents keep escaped examples',()=>{
    const {api}=fixture();
    const fragment='<div id="s-win" style="width:310px"><button onclick="document.getElementById(\'page\').hidden=false">商店</button><div id="page" hidden>页面</div></div>';
    const result=api.sourceDocument(fragment);
    assert(result.startsWith('<!doctype html>'));
    assert(result.includes(fragment));
    assert(api.sourceDocument('<body><div>片段</div></body>').includes('<body><div>片段</div></body>'));
    assert(api.sourceDocument('<!doctype html><html><body><div>未闭合文档</div>').includes('未闭合文档'));
    const complete='<!doctype html><html><head><title>原网页</title></head><body><pre>&lt;div&gt;示例&lt;/div&gt;</pre><main id="live">实际界面</main></body></html>';
    assert.equal(api.sourceDocument(complete),complete);
    assert.equal(api.sourceDocument('普通文档说明，没有网页代码。'),'');
});


test('floor numbers survive deletion and comments never consume a floor',()=>{
    const {api}=fixture();const w=api.makeWork({acts:[{rows:[{role:'user',text:'开场'},{role:'assistant',text:'正文',comments:[{text:'戏外评论'}]}]}]});
    assert.equal(w.acts[0].rows[1].floor,2);assert.equal(w.nextFloor,3);
    w.acts[0].rows.shift();w.acts[0].rows.push({role:'assistant',text:'下一楼'});api.ensureFloors(w);
    assert.equal(w.acts[0].rows[0].floor,2);assert.equal(w.acts[0].rows[1].floor,3);assert.equal(w.nextFloor,4);
    api.ensureFloors(w);assert.equal(w.acts[0].rows[1].floor,3);
});

test('partial structured streaming reveals text without displaying JSON syntax',()=>{
    const {api}=fixture();const rows=api.streamRows('[{"actorId":"a","speaker":"林钧","type":"speech","text":"你好');
    assert.equal(rows[0].text,'你好');assert.equal(rows[0].actorId,'a');assert.equal(rows[0].type,'speech');
    assert.equal(api.streamRows('[{"actorId":"a"').length,0);
    assert.equal(api.streamRows('普通剧情')[0].text,'普通剧情');
});

test('ACTE observes streamed reasoning and usage through the shared offline decoder',async()=>{
    const {api,db,calls,box}=fixture();
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/modules/offline-generation.js'),'utf8'),box);
    db.cotPresets=[{id:'cot-a',items:[]}];
    box.fetch=async(_url,args)=>{calls.push(JSON.parse(args.body));const events=[{choices:[{delta:{reasoning_content:'接口推理'}}]},{choices:[{delta:{content:'<thinking>标签推理</thinking>正文'}}]},{choices:[],usage:{completion_tokens:7}}];const bytes=new TextEncoder().encode(events.map(x=>'data: '+JSON.stringify(x)+'\r\n\r\n').join('')+'data: [DONE]\n\n');return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=9)c.enqueue(bytes.slice(i,i+9));c.close();}}),{headers:{'content-type':'text/event-stream'}});};
    const frames=[];
    const result=await api.ask([{role:'user',content:'演出'}],{mode:'cot',preset:'cot-a',debugMode:true},undefined,[],'normal',true,frame=>frames.push(frame));
    assert.equal(calls[0].stream,true);assert.equal(result.text,'正文');assert.equal(result.usage,7);assert(result.reasoning.includes('接口推理'));assert(result.reasoning.includes('标签推理'));assert(frames.length>=3);assert.equal(frames.at(-1).text,'正文');
    const hidden=await api.ask([{role:'user',content:'演出'}],{mode:'cot',preset:'cot-a',debugMode:false},undefined,[],'normal',true);
    assert.equal(hidden.reasoning,'');
});

test('Tavern keeps its own stream and sampling parameters and returned thought display',async()=>{
    const {api,db,calls,box}=fixture();
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/modules/offline-generation.js'),'utf8'),box);
    box.window.KissTavernRuntime={prepare({body}){body.stream=false;body.temperature=.25;return {active:true,presetId:'tav-a',stream:false};}};
    box.fetch=async(_url,args)=>{calls.push(JSON.parse(args.body));return new Response(JSON.stringify({choices:[{message:{content:'剧情',reasoning_content:'酒馆思考'}}]}),{headers:{'content-type':'application/json'}});};
    const result=await api.ask([{role:'system',content:'剧场规则'},{role:'user',content:'演出'}],{mode:'tavern',preset:'tav-a',temperature:1.5,maxOutput:99},undefined,[],'normal',true);
    assert.equal(calls[0].stream,false);assert.equal(calls[0].temperature,.25);assert.equal(calls[0].max_tokens,undefined);assert.equal(result.reasoning,'酒馆思考');
});

test('aborting the shared stream reader cancels the body and rejects the unfinished output',async()=>{
    const {box}=fixture();vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/modules/offline-generation.js'),'utf8'),box);
    let cancelled=false;const response=new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'text/event-stream'}});const controller=new AbortController();
    const reading=box.window.KissOfflineGeneration.readResponse(response,'openai',null,controller.signal);controller.abort();
    await assert.rejects(reading,{name:'AbortError'});assert.equal(cancelled,true);
});
