const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
require('../js/modules/kiss-memory-summary.js');
const M=global.KissMemorySummary;
test('summary parser accepts plain, fenced JSON and final text after thinking',()=>{
 for(const raw of ['约好明天听歌','```json\n{"summary":"约好明天听歌"}\n```','<think>内部推理</think>{"summary":"约好明天听歌"}'])assert.equal(M.parse(raw),'约好明天听歌');
});
test('empty, thinking-only, chat actions, objects and truncated JSON cannot become memories',()=>{
 for(const raw of ['',null,{},'<think>推理</think>','<analysis>未结束','{"messages":["你好"]}','{"summary":{}}','{"summary":"未完成','{"summary":"事实","actions":[]}'])assert.throws(()=>M.parse(raw),{code:'SUMMARY_FORMAT'});
});
test('all batches are covered and each folds the previous complete summary',async()=>{
 const messages=Array.from({length:165},(_,id)=>({id}));const batches=[];
 const result=await M.generate({messages,source:'HearU',previous:'旧记忆',request:async(system,history)=>{assert.match(system,/不扮演角色/);const data=JSON.parse(history[0].content);batches.push(data);return JSON.stringify({summary:'总结'+batches.length});}});
 assert.deepEqual(batches.map(b=>b.messages.length),[80,80,5]);assert.deepEqual(batches.flatMap(b=>b.messages),messages);assert.deepEqual(batches.map(b=>b.previousSummary),['旧记忆','总结1','总结2']);assert.equal(result,'总结3');
});
test('incremental start summarizes only new records and keeps prior memory',async()=>{
 await M.generate({messages:[1,2,3],start:2,previous:'前两条',request:async(_,m)=>{assert.deepEqual(JSON.parse(m[0].content),{previousSummary:'前两条',messages:[3]});return '完整新总结';}});
});
test('format failures retry once; transport failures do not retry or hide errors',async()=>{
 let calls=0;assert.equal(await M.generate({messages:[1],request:async()=>++calls===1?'{}':'事实'}),'事实');assert.equal(calls,2);
 calls=0;await assert.rejects(M.generate({messages:[1],request:async()=>{calls++;return '{}';}}),{code:'SUMMARY_FORMAT'});assert.equal(calls,2);
 calls=0;await assert.rejects(M.generate({messages:[1],request:async()=>{calls++;throw Error('网络中断');}}),/网络中断/);assert.equal(calls,1);
});
test('cancellation after response prevents parsing or subsequent batches',async()=>{
 let cancelled=false,calls=0;await assert.rejects(M.generate({messages:Array(100).fill(1),check(){if(cancelled)throw new DOMException('停止','AbortError');},request:async()=>{calls++;cancelled=true;return '事实';}}),{name:'AbortError'});assert.equal(calls,1);
});
test('prefix validation permits appended messages and rejects edited/deleted history',()=>{
 const project=m=>({content:m.content}),target={messages:[{content:'一'},{content:'二'}]};const entry={through:2,content:'总结',fingerprint:M.fingerprint(target.messages,project)};target.summaries=[entry];assert.equal(M.current(target,project),entry);target.messages.push({content:'三'});assert.equal(M.current(target,project),entry);target.messages[0].content='改';assert.equal(M.current(target,project),undefined);target.messages=[];assert.equal(M.current(target,project),undefined);
});
test('unverified legacy summaries regenerate, while explicitly detached HearU memory remains usable',()=>{
 const target={messages:[],summaries:[{through:99,content:'旧格式'}]};assert.equal(M.current(target),undefined);target.summaries[0].detached=true;assert.equal(M.current(target).content,'旧格式');
});
test('failed persistence restores old memory; successful save commits once',async()=>{
 const old=[{id:'old'}],target={summaries:old};await assert.rejects(M.append(target,{id:'new'},async()=>{throw Error('空间不足');}),/空间不足/);assert.equal(target.summaries,old);let saved;await M.append(target,{id:'new'},async()=>{saved=structuredClone(target.summaries);});assert.deepEqual(saved,[{id:'old'},{id:'new'}]);assert.deepEqual(target.summaries,saved);
});
test('rollback removes only its own entry if concurrent changes occurred',async()=>{
 const target={summaries:[]};await assert.rejects(M.append(target,{id:'failed'},async()=>{target.summaries=[...target.summaries,{id:'other'}];throw Error('失败');}));assert.deepEqual(target.summaries,[{id:'other'}]);
});
const hearu=fs.readFileSync(require.resolve('../js/hearu/app.js'),'utf8');
const mono=fs.readFileSync(require.resolve('../forum_app.js'),'utf8');
function getFunction(source,name,next,context){return vm.runInNewContext(source.slice(source.indexOf('async function '+name+'('),source.indexOf('\n'+next,source.indexOf('async function '+name+'(')))+'\n'+name,context);}
test('HearU summary uses dedicated transport instead of conflicting chat protocol and persists validated memory',async()=>{
 const target={messages:[{role:'user',content:'明天听歌'}]},character={id:'c'},tasks=new Map(),busy=new Set();let request;
 const context={window:{KissMemorySummary:M},room:target,roleId:'c',character:()=>character,busy,structuredClone,generations:tasks,crypto:{randomUUID:()=> 'sum'},Date,view:'room',root:{querySelector:()=>null},modal(){},memoryHistory(){},notify(){},currentSummary:t=>M.current(t),messageForModel:m=>m,memoryFingerprint:ms=>M.fingerprint(ms),hearuApiConfig:()=>({}),hearuSendModel:async(_,system,messages)=>{request={system,messages};return '{"summary":"约好明天听歌"}';},storeRoom:async()=>{},generationTask(id){const t={controller:new AbortController(),check(){}};tasks.set(id,t);busy.add(id);return t;}};
 await getFunction(hearu,'summarizeMemory','function closeModal',context)();assert.equal(target.summaries[0].content,'约好明天听歌');assert.doesNotMatch(request.system,/messages里text/);assert.equal(JSON.parse(request.messages[0].content).messages[0].content,'明天听歌');assert.equal(tasks.size,0);
});
test('MONO normal replies read valid summary; summary requests bypass persona supplement flag',async()=>{
 const conv={messages:[{content:'明天听歌'}]};conv.summaries=[{content:'已约明天听歌',through:1,fingerprint:M.fingerprint(conv.messages)}];let options;
 const context={window:{KissMemorySummary:M},forumSummaryMessage:m=>m,forumDMConfig:()=>({url:'https://example.invalid',key:'test'}),forumNativeDb:()=>({}),forumApiEndpoint:()=>'',document:{getElementById:()=>null},fetch:async(_,o)=>{options=o;return {ok:true,json:async()=>({choices:[{message:{content:'回复'}}]})};}};
 const model=getFunction(mono,'forumModel','async function forumGenerateFor',context);await model(conv,'角色',[],null);assert.match(JSON.parse(options.body).messages[0].content,/已约明天听歌/);assert.equal(options.monoMemorySummary,false);await model(conv,'总结',[],null,{memorySummary:true});assert.equal(options.monoMemorySummary,true);assert.equal(JSON.parse(options.body).messages[0].content,'总结');
});
test('MONO account switch during summary response cannot save into new account',async()=>{
 const conv={messages:[{sender:'user',content:'约定'}]},tasks=new Map();let key='a',saves=0;
 const context={window:{KissMemorySummary:M},forumGetConv:()=>conv,showToast(){},forumDMTasks:tasks,monoDMKey:()=>key,structuredClone,AbortController,DOMException,setTimeout,clearTimeout,forumSummaryMessage:m=>m,forumModel:async()=>{key='b';return '总结';},forumSaveDMs:async()=>{saves++;},currentDMConversationId:'c'};
 await getFunction(mono,'forumSummarize','function forumExportConversation',context)('c');assert.equal(saves,0);assert.equal(conv.summaries,undefined);assert.equal(tasks.size,0);
});

test('MONO never injects an unverified last summary alongside validated context',()=>{assert.doesNotMatch(mono,/conv\.summaries\?\.at\(-1\)/);});
