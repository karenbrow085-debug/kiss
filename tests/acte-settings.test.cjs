const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const {webcrypto} = require('node:crypto');

function fixture(provider = 'openai') {
    const calls = [];
    const db = {characters:[],worldBooks:[],apiSettings:{provider,url:'https://example.invalid',key:'test',model:'test',temperature:0.8}};
    const box = {db,URL,crypto:webcrypto,performance,Response,window:{},getRandomValue:x=>x,
        buildChatApiRequest:(_config,messages)=>({endpoint:'https://example.invalid',headers:{},requestBody:{messages,temperature:0.8,max_completion_tokens:4096}}),
        fetch:async(_url,args)=>{calls.push(JSON.parse(args.body));return new Response('{}');}};
    box.window.KissOffline = {resolveOfflineApi:()=>db.apiSettings};
    box.window.KissOfflineGeneration = {readResponse:async()=>({full:'Scene'}),split:text=>({text})};
    vm.createContext(box);
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/modules/acte-data.js'),'utf8'),box);
    return {api:box.window.ActeData,db,calls};
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
