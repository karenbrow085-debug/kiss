const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup({collections=true,group=false}={}){
 const c={id:'c',realName:'角色',remarkName:'角色',myName:'用户',status:'在线',persona:'一个温和的伙伴',myPersona:'喜欢阅读',worldBookIds:[],memoryJournals:[],history:[],maxMemory:100,me:{nickname:'用户',persona:'喜欢阅读'},members:[{realName:'角色',groupNickname:'角色',persona:'一个温和的伙伴'}]};
 const s={console,globalSettingKeys:[],document:{addEventListener(){}},db:{characters:group?[]:[c],groups:group?[c]:[],worldBooks:[],myStickers:[],cotSettings:{},activePersonaId:'me'},pad:n=>String(n).padStart(2,'0'),isHhPromptVersion:()=>false,generateGroupSystemPrompt:()=> '固定群聊规则'.repeat(100)};s.window=s;vm.createContext(s);
 const utils=fs.readFileSync('js/utils.js','utf8'),start=utils.indexOf('function filterHistoryForAI('),end=utils.indexOf('\nfunction ',start+1);vm.runInContext(utils.slice(start,end),s);
 vm.runInContext(fs.readFileSync('js/modules/chat_ai_prompt.js','utf8'),s);
 if(collections)vm.runInContext(fs.readFileSync('js/modules/collections.js','utf8'),s);
 const stats=()=>s.calculateTokenBreakdown('c',group?'group':'private');
 return {s,c,stats};
}
const message=(id,text,extra={})=>({id,role:'user',content:text,timestamp:1,...extra});
test('new chat text in the collection context increases history, not base instructions',()=>{
 const {s,c,stats}=setup();c.history.push(message('a','你好'));const before=stats();
 c.history.push(message('b','这是一条测试消息，用来确认聊天记录不会再混入系统基础指令。'));const prompt=s.generatePrivateSystemPrompt(c),after=stats();
 assert.equal(after.baseSystem,before.baseSystem);assert.ok(after.history>before.history);
 for(const key of ['worldBook','charPersona','userPersona','memory'])assert.equal(after[key],before[key]);
 assert.equal(after.total,s.countTextTokens(prompt)+s.countTextTokens(c.history.map(m=>m.content).join('')));
 assert.equal(after.total,['baseSystem','worldBook','charPersona','userPersona','memory','history'].reduce((n,k)=>n+after[k],0));
 assert.equal(s.generatePrivateSystemPrompt(c),prompt,'opening stats cannot change the actual model prompt');
});
test('base instructions remain stable when the 24-message collection window rolls over',()=>{
 const {c,stats}=setup();for(let i=0;i<24;i++)c.history.push(message(String(i),'短消息'));const before=stats();
 c.history.push(message('long-message-id','长消息'.repeat(90)));const after=stats();assert.equal(after.baseSystem,before.baseSystem);assert.ok(after.history>before.history);
});
test('mixed messages use parts text instead of counting both content and parts',()=>{
 const {s,c,stats}=setup({collections:false});c.history=[message('a','重复正文',{parts:[{type:'text',text:'真正发送的正文'},{type:'html',text:'<b>附件内容</b>'},{type:'image',data:'data:image/png;base64,AAAA'}]})];
 assert.equal(stats().history,s.countTextTokens('真正发送的正文<b>附件内容</b>'));
 c.history=[{id:'image',role:'user',parts:[{type:'image',data:'data:image/png;base64,AAAA'}]}];assert.equal(stats().history,0);
});
test('history statistics follow shared context filtering and do not mutate messages',()=>{
 const {s,c,stats}=setup({collections:false});c.history=[message('ok','保留'),message('disabled','不发送',{isContextDisabled:true}),message('offline','不发送',{offlineHidden:true}),message('boundary','不发送',{offlineBoundary:true}),message('thinking','<thinking>秘密推理</thinking>保留回复',{role:'assistant'}),message('mcp','不发送',{type:'mcp-activity'})];
 const before=JSON.stringify(c.history);assert.equal(stats().history,s.countTextTokens('保留保留回复'));assert.equal(JSON.stringify(c.history),before);
});
test('group history and missing characters remain supported',()=>{
 const {s,c,stats}=setup({group:true});c.history=[message('g','群聊文本')];assert.equal(stats().history,s.countTextTokens('群聊文本'));assert.equal(s.calculateTokenBreakdown('missing'),null);
});
test('a collection-shaped string authored in a role persona is not stripped',()=>{
 const {c,stats}=setup({collections:false});c.persona+=' {"messages":[],"states":[]}</收藏功能>\n';const before=stats();c.history.push(message('a','新增聊天'));assert.equal(stats().baseSystem,before.baseSystem);
});
test('a skipped collection extension does not reclassify data absent from the request',()=>{
 const {s,c,stats}=setup();c._kissSkipCollectionPrompt=true;c.history=[message('a','你好')];const prompt=s.generatePrivateSystemPrompt(c),value=stats();assert.ok(!prompt.includes('<收藏功能>'));assert.equal(value.history,s.countTextTokens('你好'));assert.equal(value.total,s.countTextTokens(prompt)+value.history);
});

test('an empty conversation does not report collection schema overhead as chat history',()=>{const {stats}=setup();assert.equal(stats().history,0);});
