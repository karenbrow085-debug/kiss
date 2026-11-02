const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup({failSave=false}={}){
 let finishModel,requested=false;const response=new Promise(r=>finishModel=r);
 const thread={innerHTML:''},reply={},section={append(el){page.status=el}},page={dataset:{requestId:'request'},setAttribute(){},querySelector(selector){return selector==='.ksf-thread'?thread:selector==='[data-reply]'?reply:selector==='.ksf-verification'?section:selector==='[data-request-pending]'?this.status:null}};
 const c={id:'c',realName:'角色',history:[],friendship:{userBlocked:true,requests:[]}},r={id:'request',from:'ai',status:'pending',text:'想再聊聊'};c.friendship.requests.push(r);
 const ctx={window:null,db:{characters:[c],apiSettings:{url:'https://example.test',key:'fixture',model:'fixture'}},document:{addEventListener(){},getElementById:id=>id==='kiss-friend-page'?page:null,createElement:()=>({dataset:{},setAttribute(){}})},PhoneBackup:{hydrateChat:async()=>{},saveChat:async()=>{if(failSave)throw Error('quota')}},resolveAuxiliaryApiConfig:(_,c)=>c,buildChatApiRequest:()=>({}),fetchAiResponse:()=>{requested=true;return response},Date,console};ctx.window=ctx;
 vm.runInNewContext(fs.readFileSync('js/modules/chat-social.js','utf8'),ctx);
 return {api:ctx.KissSocial,c,r,page,thread,requested:()=>requested,finishModel};
}
test('friend request immediately renders the sent text while the role reply is still pending',async()=>{
 const t=setup();let done=false;const work=t.api.replyRequest(t.c,t.r,'我刚发的留言').then(()=>done=true);
 assert.match(t.thread.innerHTML,/我刚发的留言/);assert.equal(done,false);
 for(let i=0;i<12;i++)await Promise.resolve();assert.equal(t.requested(),true);assert.equal(done,false);
 t.finishModel('{"text":"我看到了"}');await work;
 assert.match(t.thread.innerHTML,/我刚发的留言/);assert.match(t.thread.innerHTML,/我看到了/);assert.equal(t.page.status.hidden,true);
});
test('failed friend reply persistence restores the thread and does not call the role model',async()=>{
 const t=setup({failSave:true});await assert.rejects(t.api.replyRequest(t.c,t.r,'不能丢的草稿'),/quota/);
 assert.doesNotMatch(t.thread.innerHTML,/不能丢的草稿/);assert.equal(t.requested(),false);assert.equal(t.r.messages,undefined);
});
