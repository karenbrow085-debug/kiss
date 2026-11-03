const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(type='private'){
 const chat={id:'a',myName:'我',me:{nickname:'我'},history:[],activeArchiveId:'main'},target={chat,id:'a',type};
 let saved=0,rendered=0;
 const ctx={window:null,console,Date,Math,db:{characters:[chat],groups:[chat]},currentChatId:'a',currentChatType:type,isGenerating:false,saveData:async()=>{saved++},addMessageBubble:()=>rendered++,renderChatList(){},KissImageAlbum:{capture:()=>target,valid:t=>t===target&&ctx.currentChatId==='a'}};ctx.window=ctx;
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/modules/chat_features.js','utf8'),ctx);
 return {ctx,chat,target,saved:()=>saved,rendered:()=>rendered};
}
const photos=()=>Array.from({length:10},(_,i)=>'data:image/jpeg;base64,'+Buffer.from('image '+i).toString('base64'));
test('ten ordered images persist as one message with all image parts',async()=>{const s=setup(),images=photos();const m=await s.ctx.sendImageForRecognition(images);assert.equal(s.chat.history.length,1);assert.equal(m.parts.filter(p=>p.type==='image').length,10);assert.deepEqual(Array.from(m.parts.slice(1),p=>p.data),images);assert(!m.content.includes('base64'));assert.equal(s.saved(),1);assert.equal(s.rendered(),1);});
test('one image keeps the legacy content and parts shape',async()=>{const s=setup(),data=photos()[0];const m=await s.ctx.sendImageForRecognition(data);assert.equal(m.content,data);assert.equal(m.parts.length,2);});
test('group album keeps sender attribution',async()=>{const s=setup('group');const m=await s.ctx.sendImageForRecognition(photos());assert.equal(m.senderId,'user_me');});
test('empty, oversize, invalid and in-flight generation cannot create a message',async()=>{const s=setup();for(const data of [[],[...photos(),photos()[0]],['javascript:alert(1)']])await assert.rejects(s.ctx.sendImageForRecognition(data));s.ctx.isGenerating=true;await assert.rejects(s.ctx.sendImageForRecognition(photos()));assert.equal(s.chat.history.length,0);assert.equal(s.saved(),0);});
test('switching chat cannot send pending selection into another chat',async()=>{const s=setup();s.ctx.currentChatId='b';await assert.rejects(s.ctx.sendImageForRecognition(photos(),s.target),/切换/);assert.equal(s.chat.history.length,0);});
test('failed persistence rolls back and does not render',async()=>{const s=setup();s.ctx.saveData=async()=>{throw Error('disk full')};await assert.rejects(s.ctx.sendImageForRecognition(photos()),/保存失败/);assert.equal(s.chat.history.length,0);assert.equal(s.rendered(),0);});
