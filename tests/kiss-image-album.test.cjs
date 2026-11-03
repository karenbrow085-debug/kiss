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

function albumSetup(){
 class Element {
  constructor(){this.children=[];this.dataset={};this.events={};this.attrs={};this.isConnected=false;this.style={setProperty:(k,v)=>{this.style[k]=v},removeProperty:k=>{delete this.style[k]}};this.classList={add(){},remove(){},toggle(){}};}
  append(...els){this.children.push(...els)}
  setAttribute(k,v){this.attrs[k]=v}
  addEventListener(k,f){this.events[k]=f}
  querySelector(){return null}
  closest(){return null}
  focus(){}
  setPointerCapture(){}
  hasPointerCapture(){return false}
 }
 const ctx={window:null,document:{createElement:()=>new Element()},getComputedStyle:()=>({getPropertyValue:()=> '146px'}),requestAnimationFrame(){},Date,Math,isInMultiSelectMode:false,isDebugMode:false};ctx.window=ctx;
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/modules/image-album.js','utf8'),ctx);
 return ctx.KissImageAlbum;
}
test('first card exposes only its next two images, middle exposes one on each side, last exposes previous two',()=>{
 const api=albumSetup(),visible=layout=>Array.from(layout.cards,(c,i)=>c.opacity?i:null).filter(i=>i!==null);
 const first=api.stackLayout(10,0),middle=api.stackLayout(10,5),last=api.stackLayout(10,9);
 assert.equal(first.position,'first');assert.equal(middle.position,'middle');assert.equal(last.position,'last');
 assert.deepEqual(visible(first),[0,1,2]);assert.deepEqual(visible(middle),[4,5,6]);assert.deepEqual(visible(last),[7,8,9]);
 assert.equal(first.cards[0].x,0);assert.equal(middle.cards[5].x,12);assert.equal(last.cards[9].x,24);
 assert(first.cards[1].x>first.cards[0].x);assert(middle.cards[4].x<middle.cards[5].x);assert(middle.cards[6].x>middle.cards[5].x);assert(last.cards[8].x<last.cards[9].x);
});
test('keyboard and swipe stop at the first/last images instead of wrapping',()=>{
 const api=albumSetup(),root=api.create({parts:photos().map(data=>({type:'image',data}))}),deck=root.children[1];
 const key=key=>deck.events.keydown({key,preventDefault(){}});
 key('ArrowLeft');assert.equal(root.dataset.index,'0');assert.equal(root.dataset.position,'first');
 for(let i=0;i<12;i++)key('ArrowRight');assert.equal(root.dataset.index,'9');assert.equal(root.dataset.position,'last');
 const swipe=(from,to)=>{deck.events.pointerdown({button:0,pointerId:1,clientX:from,clientY:0});deck.events.pointermove({pointerId:1,clientX:to,clientY:0,preventDefault(){}});deck.events.pointerup({pointerId:1,clientX:to,clientY:0,preventDefault(){}});};
 swipe(150,50);assert.equal(root.dataset.index,'9');swipe(50,150);assert.equal(root.dataset.index,'8');assert.equal(root.dataset.position,'middle');
 for(let i=0;i<12;i++)key('ArrowLeft');swipe(50,150);assert.equal(root.dataset.index,'0');
});
test('two-image albums never create a phantom back card and keep image order when expanded',()=>{
 const api=albumSetup();for(const index of [0,1])assert.equal(api.stackLayout(2,index).cards.filter(c=>c.opacity).length,2);
 const root=api.create({parts:photos().slice(0,2).map(data=>({type:'image',data}))});root.children[0].onclick();
 assert.equal(root.children[0].textContent,'收起 2');assert(root.children[1].children.every(card=>card.attrs['aria-hidden']==='false'));
});
