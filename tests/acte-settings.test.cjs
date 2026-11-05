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
