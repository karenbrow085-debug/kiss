const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../js/modules/committee-core.js');
const me=C.actor('user','user','我'),other=C.actor('actor','a','林屿'),npc=C.actor('npc','npc-a','陈姐');
const draft=(over={})=>({type:'purchase',title:'新椅子',body:'坐久了腰酸',amount:699,...over});
test('six post types and purchase category types retain distinct fields',()=>{
 assert.equal(Object.keys(C.types).length,6);assert.equal(C.categories.length,6);
 for(const type of Object.keys(C.types)){const p=C.post(draft({type,choices:['上午','下午']}),me,'a');assert.equal(p.type,type);assert.equal(p.amount,type==='purchase'?699:null);}
 assert.throws(()=>C.post(draft({amount:-1}),me,'a'),/金额/);assert.throws(()=>C.post(draft({body:''}),me,'a'),/经过/);
 assert.throws(()=>C.post(draft({type:'poll',choices:['同一项','同一项']}),me,'a'),/不重复/);
});
test('court requires real consent from both parties before voting; revocation blocks votes',()=>{
 const p=C.post(draft({type:'court'}),me,'a');assert.equal(C.eligible(p),false);assert.throws(()=>C.vote(p,npc,'支持甲方','先说清楚'),/同意/);
 p.consent.actor=true;assert.equal(C.eligible(p),true);C.vote(p,npc,'信息不足','我想听另一方怎么说');p.consent.user=false;assert.throws(()=>C.vote(p,other,'支持乙方','理由'),/同意/);
});
test('votes need a reason, changing one vote keeps one participant and a visible amendment',()=>{
 const p=C.post(draft(),me,'a');assert.throws(()=>C.vote(p,npc,'通过',''),/理由/);C.vote(p,npc,'通过','有需要就买');C.vote(p,npc,'再等等','看到补充后想先试坐');assert.equal(p.votes.length,1);assert.equal(p.comments.length,2);assert.match(p.comments[1].text,/改票/);assert.equal(C.tally(p).find(x=>x.choice==='再等等').count,1);
});
test('quorum and real deadline stop voting but never decide the purchase for the applicant',()=>{
 const p=C.post(draft({quorum:2}),me,'a');C.vote(p,npc,'通过','需要');C.vote(p,other,'再等等','先试坐');assert.equal(p.status,'review');assert.equal(p.decision,'');assert.throws(()=>C.vote(p,me,'通过','买'),/结束/);
 const q=C.post(draft(),me,'a',0);assert.equal(C.eligible(q,q.deadline),false);
});
test('settlement needs two acceptances; only author closes and outcomes preserve disagreement',()=>{
 const p=C.post(draft({type:'mediation'}),me,'a'),proposal=C.proposal(p,other,'周末各说十分钟');assert.equal(proposal.user,false);C.accept(p,me,proposal.id);assert(proposal.user&&proposal.actor);assert.throws(()=>C.close(p,other,'谈妥了'),/发起人/);C.close(p,me,'各自保留意见');assert.equal(p.status,'closed');assert.equal(p.outcome,'各自保留意见');
});
test('generation settings validate per-type counts, totals, and comment bounds',()=>{
 const s=C.settings({counts:{purchase:2,reason:1},comments:5});assert.equal(s.counts.mediation,0);assert.equal(s.counts.purchase,2);assert.throws(()=>C.settings({counts:{}}),/1至18/);assert.throws(()=>C.settings({counts:Object.fromEntries(Object.keys(C.types).map(t=>[t,6]))}),/1至18/);
});
function fixture(){let disk=new Map(),serial=Promise.resolve(),response={},fail=false,pause=null,requests=[];const copy=structuredClone;
 const db={activePersonaId:'me',characters:[{id:'a',remarkName:'林屿',persona:'个人设定仅本人知道',history:[]},{id:'b',realName:'季遥',history:[]}],apiSettings:{url:'https://example.invalid/v1',key:'fake',model:'vision-test'}};
 const table={get:async k=>copy(disk.get(k)),put:async r=>disk.set(r.key,copy(r))};
 const window={crypto:require('node:crypto').webcrypto,KissSocial:{blocked:()=>false},PhoneBackup:{hydrateChat:async()=>{},pinChat:()=>()=>{},isPinned:()=>false,stageMessage:async()=>{},saveChat:async()=>{}}};
 const sandbox={window,db,dexieDB:{globalSettings:table,transaction:(_,__,fn)=>{const result=serial.then(fn);serial=result.catch(()=>{});return result;}},document:{addEventListener(){},dispatchEvent(){}},structuredClone,CustomEvent:class{},AbortController,URL,Date,Intl,console,setTimeout,clearTimeout,saveData:async()=>{},PhoneBackup:window.PhoneBackup,buildChatApiRequest:(_,messages)=>({endpoint:'https://example.invalid/v1/chat/completions',headers:{},requestBody:{messages}}),fetch:async(url,opts)=>{requests.push(JSON.parse(opts.body));if(pause)await pause;if(fail)throw Error('network failed');return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(response)}}]})};}};
 vm.createContext(sandbox);for(const name of ['committee-core','committee-data'])vm.runInContext(fs.readFileSync('js/modules/'+name+'.js','utf8'),sandbox);
 const D=window.CommitteeData;return {D,db,window,scope:D.capture(db.characters[0]),setResponse:v=>response=v,fail:v=>fail=v,pause:v=>pause=v,requests};
}
test('persona and character isolation reject stale writes and preserve both accounts',async()=>{
 const f=fixture(),p=await f.D.create(draft(),f.scope);assert.equal((await f.D.read()).posts.length,1);const b=f.D.capture(f.db.characters[1]);await assert.rejects(()=>f.D.act(p.id,'comment',{text:'越界'},b),/另一位角色/);f.db.activePersonaId='new';await assert.rejects(()=>f.D.act(p.id,'comment',{text:'旧请求'},f.scope),/切换/);assert.equal((await f.D.read()).posts.length,0);f.db.activePersonaId='me';assert.equal((await f.D.read()).posts.length,1);
});
test('same post is deduplicated and a shared live card has exactly one journal entry',async()=>{
 const f=fixture(),p=await f.D.create(draft(),f.scope);await assert.rejects(()=>f.D.create(draft(),f.scope),/已经发布/);await f.D.share(p.id,f.scope);await f.D.share(p.id,f.scope);assert.equal(f.db.characters[0].history.length,1);assert.equal(f.db.characters[0].history[0].type,'committee-share');assert.equal((await f.D.read()).notices.length,1);
});
test('chat evidence exposes only selected ordinary messages, not hidden or system records',async()=>{
 const f=fixture(),p=await f.D.create(draft({type:'reason'}),f.scope);f.db.characters[0].history=[{id:'yes',role:'user',content:'公开这一句'},{id:'hidden',role:'assistant',content:'私密',isContextDisabled:true},{id:'sys',role:'assistant',type:'daybook-notice',content:'系统通知'}];
 await f.D.act(p.id,'evidence',{ids:['yes']},f.scope);assert.equal((await f.D.read()).posts[0].evidence.length,1);await assert.rejects(()=>f.D.act(p.id,'evidence',{ids:['hidden']},f.scope),/变化/);assert.equal((await f.D.read()).posts[0].evidence.length,1);
});
test('model post generation obeys configured type/count, fixed identities, dedup and no user impersonation',async()=>{
 const f=fixture();await f.D.saveSettings({counts:{purchase:1},comments:3,allowActor:true},f.scope);
 f.setResponse({posts:[{...draft(),authorType:'user',authorId:'user'},{...draft(),authorType:'npc',authorId:'npc-b'},{...draft({title:'第二张'}),authorType:'npc',authorId:'npc-c'},{...draft({type:'reason',title:'不该生成'}),authorType:'npc',authorId:'npc-a'}]});
 assert.equal(await f.D.generate(f.scope),1);const s=await f.D.read();assert.equal(s.posts.length,1);assert.equal(s.posts[0].author.id,'npc-b');assert.match(f.requests[0].messages[0].content,/申请审批与纠纷评议/);
});
test('submitting images sends real vision parts, saves observations and never accepts model user replies',async()=>{
 const f=fixture(),p=await f.D.create(draft({images:['data:image/png;base64,aGVsbG8=']}),f.scope);f.setResponse({observations:[{index:1,description:'画面中的椅子'}],responses:[{authorType:'user',authorId:'user',text:'伪造的用户回复'},{authorType:'npc',authorId:'npc-a',text:'靠背先试一下'}]});
 await f.D.enrich(p.id,f.scope);const live=(await f.D.read()).posts[0];assert.equal(live.observations[0].description,'画面中的椅子');assert.equal(live.comments.length,1);assert.equal(f.requests[0].messages[1].content[1].type,'image_url');
});
test('API failure preserves saved post and writes no fabricated image description or vote',async()=>{
 const f=fixture(),p=await f.D.create(draft({images:['data:image/png;base64,aGVsbG8=']}),f.scope);f.fail(true);await assert.rejects(()=>f.D.enrich(p.id,f.scope),/network/);const live=(await f.D.read()).posts[0];assert.equal(live.comments.length,0);assert.equal(live.observations.length,0);assert.match(live.visionError,/network/);
});
test('private discussions reject NPC participation and preserve one current-role response',async()=>{
 const f=fixture(),p=await f.D.create(draft({visibility:'private'}),f.scope);f.setResponse({responses:[{authorType:'npc',authorId:'npc-a',text:'偷看'},{authorType:'actor',authorId:'a',text:'我陪你去试'}]});await f.D.enrich(p.id,f.scope);assert.equal((await f.D.read()).posts[0].comments.length,1,'NPC rows cannot consume the current role response slot');
 f.setResponse({responses:[{authorType:'actor',authorId:'a',text:'我陪你去试'}]});await f.D.enrich(p.id,f.scope);assert.equal((await f.D.read()).posts[0].comments.length,1);
});
test('concurrent requests are blocked and stale generated replies cannot overwrite new user comments',async()=>{
 const f=fixture(),p=await f.D.create(draft(),f.scope);let release;f.pause(new Promise(r=>release=r));f.setResponse({responses:[{authorType:'npc',authorId:'npc-a',text:'旧意见'}]});const job=f.D.enrich(p.id,f.scope);await new Promise(r=>setImmediate(r));await assert.rejects(()=>f.D.enrich(p.id,f.scope),/正在生成/);await f.D.act(p.id,'comment',{text:'新补充'},f.scope);release();await assert.rejects(()=>job,/已更新/);assert.equal((await f.D.read()).posts[0].comments.length,1);
});
test('chat action context honors disabled proactive messages and strips malformed tags',async()=>{
 const f=fixture(),c=f.db.characters[0];await f.D.saveSettings({counts:{purchase:1},allowActor:true,autoPost:true},f.scope);
 const ctx=await f.D.context(c,{background:true});assert.equal(ctx.allow,false);const raw='<committee_action>'+JSON.stringify({type:'post',post:draft()})+'</committee_action>';
 assert.equal(await f.D.consume('你好'+raw,c,ctx),'你好');assert.equal((await f.D.read()).posts.length,0);
 const manual=await f.D.context(c);await f.D.consume(raw,c,manual);await f.D.consume(raw,c,await f.D.context(c));assert.equal((await f.D.read()).posts.length,1);assert.equal(await f.D.consume('你好<committee_action>{broken',c,manual),'你好');
});
test('chat integrations register one menu entry and cards contain no arrow icon',()=>{
 const menu=fs.readFileSync('js/modules/chat_room_html.js','utf8'),index=fs.readFileSync('index.html','utf8');assert.equal((menu.match(/id="committee-chat-menu-btn"/g)||[]).length,1);for(const file of ['committee-core','committee-data','committee'])assert(index.includes('js/modules/'+file+'.js'));
 const ui=fs.readFileSync('js/modules/committee.js','utf8').split('function chatCard(p)')[1].split('function renderCard')[0];assert(!ui.includes("icon('right')"));assert(!ui.includes('↗'));assert(fs.readFileSync('js/db.js','utf8').includes("'committee'"));
});

test('NPC court posts disclose both fixed parties and cannot conscript the user into consenting',async()=>{
 const f=fixture();await f.D.saveSettings({counts:{court:1},comments:3,allowActor:true},f.scope);f.setResponse({posts:[{...draft({type:'court',title:'楼道里放纸箱该怎么商量'}),authorType:'npc',authorId:'npc-b',otherPartyId:'npc-c',claim:'请决定纸箱是否必须当天搬走',otherStatement:'我想先问清楚纸箱什么时候搬走。',bothConsented:true}]});await f.D.generate(f.scope);const p=(await f.D.read()).posts[0];assert(p.npcCase);assert.equal(p.parties[1].id,'npc-c');assert(C.eligible(p));await assert.rejects(()=>f.D.act(p.id,'consent',{accept:false},f.scope),/不能替NPC/);
});
test('turning off proactive permission during a response also blocks that response actions',async()=>{
 const f=fixture(),c=f.db.characters[0];c.autoReply={enabled:true};await f.D.saveSettings({counts:{purchase:1},allowActor:true,autoPost:true},f.scope);const ctx=await f.D.context(c,{background:true});assert(ctx.allow);c.autoReply.enabled=false;await f.D.consume('<committee_action>'+JSON.stringify({type:'post',post:draft()})+'</committee_action>',c,ctx);assert.equal((await f.D.read()).posts.length,0);
});

test('comment ballots retain historical selections across repeated changes and plain comments do not borrow a vote',()=>{
 const p=C.post(draft({type:'poll',choices:['A','B','C'],quorum:9}),me,'a');
 C.vote(p,npc,'A','这个更合适');C.vote(p,npc,'B','改一下');C.vote(p,npc,'C','改一下');C.vote(p,npc,'A','改一下');
 assert.deepEqual(p.comments.map(c=>C.commentChoice(p,c)),['A','B','C','A']);assert.equal(p.votes.length,1);
 const plain=C.comment(p,npc,'还有个问题');assert.equal(C.commentChoice(p,plain),'');
 const legacy={...p.comments[0]};delete legacy.choice;const oldVote={...p,votes:[{choice:'A',commentId:legacy.id}]};assert.equal(C.commentChoice(oldVote,legacy),'A');
});
test('NPC edits affect future prompts while disabled reviewers stay disabled without rewriting saved authors',async()=>{
 const f=fixture();await f.D.mutate(s=>f.D.roster(s),f.scope);const before=(await f.D.read()).npcs[0];
 const p=await f.D.create(draft(),f.scope);f.setResponse({responses:[{authorType:'npc',authorId:before.id,text:'先试坐再决定',choice:'再等等'}]});await f.D.enrich(p.id,f.scope);
 const added=await f.D.saveNpc({name:'梁阿姨',persona:'开过裁缝店，关心耐用程度',avatar:'https://example.invalid/a.png'},f.scope);assert(added.id.startsWith('npc-'));
 await f.D.saveNpc({...before,name:'陈姐新名',persona:'先看事实再表态'},f.scope);
 const state=await f.D.read();assert.equal(state.posts[0].comments[0].author.name,before.name);assert(f.D.prompt(state,f.scope).includes('陈姐新名'));
 await f.D.removeNpc(before.id,f.scope);assert(!f.D.roster(await f.D.read()).some(n=>n.id===before.id));
 f.setResponse({responses:[{authorType:'npc',authorId:before.id,text:'被删除后不应出现'}]});await f.D.enrich(p.id,f.scope);assert.equal((await f.D.read()).posts[0].comments.length,1);
 const names=(await f.D.read()).npcs;for(const n of names)await f.D.removeNpc(n.id,f.scope);assert.equal(f.D.roster(await f.D.read()).length,0);
 await assert.rejects(()=>f.D.saveNpc({name:'',persona:'x'},f.scope),/姓名/);
});
test('reviewer writes reject stale persona scopes and duplicate active names',async()=>{
 const f=fixture();await f.D.saveNpc({name:'陈老师',persona:'退休教师'},f.scope);await assert.rejects(()=>f.D.saveNpc({name:'陈老师',persona:'另一人'},f.scope),/同名/);
 f.db.activePersonaId='other';await assert.rejects(()=>f.D.saveNpc({name:'旧请求',persona:'不应写入'},f.scope),/切换/);
});
test('generated dispute cases require an actionable claim and both accounts rather than forum topics',async()=>{
 const f=fixture();await f.D.saveSettings({counts:{reason:1},comments:3,allowActor:true},f.scope);
 f.setResponse({posts:[{...draft({type:'reason',title:'谁见过楼下的猫'}),authorType:'npc',authorId:'npc-a'}]});await assert.rejects(()=>f.D.generate(f.scope),/缺少待决诉求/);assert.equal((await f.D.read()).posts.length,0);
 f.setResponse({posts:[{...draft({type:'reason',title:'商品尺寸不符是否应退款',claim:'退还购买款',otherStatement:'卖方称详情页已经标注尺寸',caseTheme:'交易纠纷'}),authorType:'npc',authorId:'npc-a'}]});await f.D.generate(f.scope);const p=(await f.D.read()).posts[0];assert.equal(p.claim,'退还购买款');assert.equal(p.otherStatement,'卖方称详情页已经标注尺寸');assert(C.caseReady(p));
 const system=f.requests[0].messages[0].content;assert(system.includes('禁止普通日常动态'));assert(!system.includes('保持原有活人感与角色一致性'));
});
test('review results expose vote counts and ties without asserting purchases or settlements',()=>{
 const p=C.post(draft({quorum:2}),me,'a');C.vote(p,npc,'通过','合理');C.vote(p,other,'再等等','先试坐');const v=C.verdict(p);assert.equal(v.total,2);assert(v.finished);assert.equal(v.leading,'');assert.equal(p.decision,'');assert.equal(p.outcome,'');
});
