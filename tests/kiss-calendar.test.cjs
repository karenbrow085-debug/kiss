const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../js/modules/calendar-core.js');
const rows=[{time:'07:20',place:'家中卧室',clothes:'白色睡衣',action:'起床洗漱'}];
test('daily update requires both 24 elapsed real hours and a new role-local date',()=>{
 const s=C.empty(),at=Date.parse('2026-11-06T23:55:00+09:00');C.daily(s,'a','Asia/Tokyo',rows,at);
 assert.equal(C.dailyAllowed(s,'a','Asia/Tokyo',at+10*60000).ok,false);
 assert.equal(C.dailyAllowed(s,'a','Asia/Tokyo',at+C.DAY-1).ok,false);
 assert.equal(C.dailyAllowed(s,'a','Asia/Tokyo',at+C.DAY).ok,true);
 assert.throws(()=>C.daily(s,'a','Asia/Tokyo',rows,at+600000),/24小时/);
 assert.equal(s.days.length,1);
});
test('25-hour fall-back day cannot receive two updates after 24 hours',()=>{
 const s=C.empty(),at=Date.parse('2026-11-01T00:15:00-04:00');C.daily(s,'a','America/New_York',rows,at);
 assert.equal(C.parts(at+C.DAY,'America/New_York').date,'2026-11-01');
 assert.equal(C.dailyAllowed(s,'a','America/New_York',at+C.DAY).ok,false);
 assert.equal(C.dailyAllowed(s,'a','America/New_York',at+C.DAY+3600000).ok,true);
});
test('23-hour spring-forward day still waits a full real 24 hours',()=>{
 const s=C.empty(),at=Date.parse('2026-03-08T00:30:00-05:00');C.daily(s,'a','America/New_York',rows,at);
 assert.equal(C.parts(at+23*3600000,'America/New_York').date,'2026-03-09');
 assert.equal(C.dailyAllowed(s,'a','America/New_York',at+23*3600000).ok,false);
});
test('changing time zone never resets the daily elapsed-time gate',()=>{
 const s=C.empty(),at=Date.parse('2026-11-06T15:30Z');C.daily(s,'a','Asia/Shanghai',rows,at);
 for(const z of ['Pacific/Auckland','America/Los_Angeles','UTC'])assert.equal(C.dailyAllowed(s,'a',z,at+3600000).ok,false);
 assert.equal(C.dailyAllowed(s,'b','Asia/Shanghai',at).ok,true);
});
test('malformed or partial daily records consume no daily allowance',()=>{
 const s=C.empty();assert.throws(()=>C.daily(s,'a','UTC',[{time:'09:00',action:'醒来'}]),/每条行程/);assert.equal(s.days.length,0);assert.equal(Object.keys(s.gates).length,0);
});
test('wall-time conversion handles offsets, DST gaps, and overlapping hours',()=>{
 assert.equal(new Date(C.instant('2026-11-24','08:00','America/New_York')).toISOString(),'2026-11-24T13:00:00.000Z');
 assert.equal(new Date(C.instant('2026-11-24','08:00','Asia/Shanghai')).toISOString(),'2026-11-24T00:00:00.000Z');
 assert.throws(()=>C.instant('2026-03-08','02:30','America/New_York'),/夏令时/);
 assert.equal(new Date(C.instant('2026-11-01','01:30','America/New_York')).toISOString(),'2026-11-01T05:30:00.000Z');
});
test('recurrence respects month-end, leap days, limits and occurrence-specific completion',()=>{
 const e=C.entry({title:'安排',date:'2026-01-31',zone:'UTC',repeat:'monthly',until:'2026-06-30'});
 assert.equal(C.occurs(e,'2026-02-28'),false);assert.equal(C.occurs(e,'2026-03-31'),true);assert.equal(C.occurs(e,'2026-07-31'),false);
 e.repeat='weekly';e.doneDates=['2026-02-07'];assert.equal(C.done(e,'2026-02-07'),true);assert.equal(C.done(e,'2026-02-14'),false);
 e.repeat='yearly';e.date='2024-02-29';delete e.until;assert.equal(C.occurs(e,'2025-03-01'),false);assert.equal(C.occurs(e,'2028-02-29'),true);
});
test('cycle estimate uses start-to-start intervals and never silently slides a late period forward',()=>{
 const c={records:[{start:'2026-08-01',end:'2026-08-05'},{start:'2026-08-30',end:'2026-09-04'},{start:'2026-09-27'}],cycleDays:28};
 assert.equal(C.prediction(c).days,29);assert.equal(C.prediction(c).date,'2026-10-26');assert.equal(C.prediction({records:[]}),null);
});
test('bundled lunar calendar identifies variable lunar festivals and actual solar terms',()=>{
 const lunar=require('../js/vendor/lunar.js');global.Solar=lunar.Solar;
 assert(C.festivals('2026-02-17').names.includes('春节'));assert.equal(C.festivals('2026-11-07').term,'立冬');assert.equal(C.festivals('2026-11-22').term,'小雪');delete global.Solar;
});
test('next solar term never skips a term falling on tomorrow',()=>{
 global.Solar=require('../js/vendor/lunar.js').Solar;
 assert.equal(C.nextTerm('2026-11-06').date,'2026-11-07');
 assert.equal(C.nextTerm('2026-11-07').date,'2026-11-22');
 delete global.Solar;
});
function fixture(){
 let now=Date.parse('2026-11-06T07:00Z'),disk=new Map(),serial=Promise.resolve(),fail=false;
 const copy=x=>x===undefined?undefined:structuredClone(x),table={get:async k=>copy(disk.get(k)),put:async row=>{if(fail)throw Error('disk full');disk.set(row.key,copy(row));}},db={activePersonaId:'me',characters:[{id:'a',realName:'林屿',timeZone:'Asia/Tokyo',history:[]},{id:'b',realName:'另一个角色',timeZone:'UTC',history:[]}],apiSettings:{}};
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const document={addEventListener(){},dispatchEvent(){},hidden:false},window={crypto:require('node:crypto').webcrypto,KissClock:{zone:c=>c?.timeZone,user:()=>({timeZone:'Asia/Shanghai'})},PhoneBackup:{hydrateChat:async()=>{},stageMessage:async()=>{},saveChat:async()=>{}},KissSocial:{blocked:()=>false}};
 const sandbox={window,document,db,dexieDB:{globalSettings:table,transaction:(_,__,fn)=>{const p=serial.then(async()=>{const old=copy([...disk]);try{return await fn()}catch(e){disk=new Map(old);throw e;}});serial=p.catch(()=>{});return p;}},Date:Clock,Intl,CustomEvent:class{},console:{warn(){},error(){}},setTimeout(){},setInterval(){},saveData:async()=>{},PhoneBackup:window.PhoneBackup};
 vm.createContext(sandbox);for(const f of ['calendar-core','calendar-data'])vm.runInContext(fs.readFileSync('js/modules/'+f+'.js','utf8'),sandbox);
 return {api:window.KissCalendarData,db,setNow:t=>now=t,fail:v=>fail=v,window,sandbox};
}
test('simultaneous model replies generate a daily record and 404 notice once',async()=>{
 const f=fixture(),c=f.db.characters[0],ctx=await f.api.context(c),reply='你好<daybook_action>'+JSON.stringify({type:'daily',rows})+'</daybook_action>';
 await Promise.all([f.api.consume(reply,c,ctx),f.api.consume(reply,c,ctx)]);
 const s=await f.api.read();assert.equal(s.days.length,1);assert.equal(s.notices.length,1);assert.equal(c.history.length,1);assert.equal(c.history[0].type,'daybook-notice');
});
test('reroll never appends another daily record or resets the 24-hour limit',async()=>{
 const f=fixture(),c=f.db.characters[0],ctx=await f.api.context(c);await f.api.consume('<daybook_action>'+JSON.stringify({type:'daily',rows})+'</daybook_action>',c,ctx);
 f.setNow(Date.parse('2026-11-07T06:59Z'));await f.api.consume('<daybook_action>'+JSON.stringify({type:'daily',rows})+'</daybook_action>',c,await f.api.context(c));assert.equal((await f.api.read()).days.length,1);
 f.setNow(Date.parse('2026-11-07T07:00Z'));await f.api.consume('<daybook_action>'+JSON.stringify({type:'daily',rows})+'</daybook_action>',c,await f.api.context(c));assert.equal((await f.api.read()).days.length,2);
});
test('user changes reach the correct role while unrelated roles and private cycles are excluded',async()=>{
 const f=fixture(),scope={account:'me'};await f.api.saveEntry({title:'24号八点出门',date:'2026-11-24',time:'08:00',zone:'Asia/Shanghai',roleId:'a',owner:'user'},null,scope);
 await f.api.saveCycle({enabled:true,start:'2026-11-01',cycleDays:28,periodDays:5,shareWith:['a'],symptoms:'测试经期记录'},scope);
 assert.match((await f.api.context(f.db.characters[0])).prompt,/24号八点出门/);assert.match((await f.api.context(f.db.characters[0])).prompt,/测试经期记录/);
 const other=(await f.api.context(f.db.characters[1])).prompt;assert(!other.includes('24号八点出门'));assert(!other.includes('测试经期记录'));
});
test('late replies cannot write after persona or archive changes',async()=>{
 for(const kind of ['persona','archive']){const f=fixture(),c=f.db.characters[0],ctx=await f.api.context(c);if(kind==='persona')f.db.activePersonaId='other';else c.activeArchiveId='new';await assert.rejects(f.api.consume('<daybook_action>'+JSON.stringify({type:'daily',rows})+'</daybook_action>',c,ctx),/切换/);assert.equal((await f.api.read({account:'me'})).days.length,0);}
});
test('failed disk write leaves the daily allowance unconsumed and can be retried',async()=>{
 const f=fixture(),c=f.db.characters[0],ctx=await f.api.context(c),raw='<daybook_action>'+JSON.stringify({type:'daily',rows})+'</daybook_action>';f.fail(true);await assert.rejects(f.api.consume(raw,c,ctx),/disk full/);f.fail(false);assert.equal((await f.api.read()).days.length,0);await f.api.consume(raw,c,ctx);assert.equal((await f.api.read()).days.length,1);
});
test('role annotations are deduplicated and cannot access a different role or disabled item',async()=>{
 const f=fixture(),a=f.db.characters[0],b=f.db.characters[1],e=await f.api.saveEntry({title:'书店',date:'2026-11-06',time:'18:00',roleId:'a',zone:'Asia/Tokyo'},null,{account:'me'}),raw='<daybook_action>'+JSON.stringify({type:'comment',entryId:e.id,text:'早点到。'})+'</daybook_action>';
 await f.api.consume(raw,b,await f.api.context(b));assert.equal((await f.api.read()).comments.length,0);
 await f.api.consume(raw,a,await f.api.context(a));await f.api.consume(raw,a,await f.api.context(a));assert.equal((await f.api.read()).comments.length,1);assert.equal(a.history.length,1);
});
test('due-time reminder converts the event zone, survives reopening and never duplicates',async()=>{
 const f=fixture();await f.api.saveEntry({title:'八点去学校',date:'2026-11-24',time:'08:00',zone:'America/New_York',roleId:'a',remind:15},null,{account:'me'});
 await f.api.collectReminders(Date.parse('2026-11-24T12:44Z'));assert.equal((await f.api.read()).notices.length,0);
 await f.api.collectReminders(Date.parse('2026-11-24T12:45Z'));await f.api.collectReminders(Date.parse('2026-11-24T13:00Z'));await f.api.flush();await f.api.flush();const s=await f.api.read();assert.equal(s.notices.length,1);assert.match(s.notices[0].text,/08:00.*八点去学校/);assert.equal(f.db.characters[0].history.length,1);
});
test('recurring completed occurrence is not reminded but next occurrence still is',async()=>{
 const f=fixture(),e=await f.api.saveEntry({title:'每日待办',date:'2026-11-06',time:'09:00',zone:'UTC',roleId:'a',repeat:'daily',kind:'todo',remind:0},null,{account:'me'});await f.api.complete(e.id,'2026-11-06',{account:'me'});
 await f.api.collectReminders(Date.parse('2026-11-06T09:01Z'));assert.equal((await f.api.read()).notices.length,0);await f.api.collectReminders(Date.parse('2026-11-07T09:01Z'));assert.equal((await f.api.read()).notices.length,1);
});
test('annual festival reminder uses the actual term date, correct role zone and one notice',async()=>{
 const f=fixture();f.window.Solar=require('../js/vendor/lunar.js').Solar;
 await f.api.mutate(s=>{s.settings.festivalReminders=[{roleId:'a',name:'立冬'}];},{account:'me'});
 await f.api.collectReminders(Date.parse('2026-11-06T23:59Z'));assert.equal((await f.api.read()).notices.length,0);
 await f.api.collectReminders(Date.parse('2026-11-07T00:00Z'));await f.api.collectReminders(Date.parse('2026-11-07T00:30Z'));
 const s=await f.api.read();assert.equal(s.notices.length,1);assert.equal(s.notices[0].roleId,'a');assert.equal(s.notices[0].targetId,'holiday:2026-11-07');
});
test('malformed action tags never leak into visible chat and private records obey switch',async()=>{
 const f=fixture(),c=f.db.characters[0];assert.equal(await f.api.consume('你好<daybook_action>{broken}</daybook_action>',c,await f.api.context(c)),'你好');
 await f.api.consume('<daybook_action>'+JSON.stringify({type:'daily',rows:[{...rows[0],private:true}]})+'</daybook_action>',c,await f.api.context(c));assert.equal((await f.api.read()).days.length,0);
});

function backupFixture(){const copy=x=>x===undefined?undefined:structuredClone(x),maps={globalSettings:new Map(),safeMeta:new Map(),safeParts:new Map()},db={characters:[],groups:[],worldBooks:[],myStickers:[]};const dexieDB={};for(const [name,map]of Object.entries(maps))dexieDB[name]={get:async k=>copy(map.get(k)),put:async v=>map.set(v.key||v.id,copy(v))};dexieDB.transaction=async(...args)=>args.at(-1)();const window={};const s={window,db,dexieDB,globalSettingKeys:['daybook'],structuredClone,Blob,ArrayBuffer,Uint8Array,TextEncoder,TextDecoder,crypto:require('node:crypto').webcrypto,performance,setTimeout,clearTimeout,console};vm.createContext(s);vm.runInContext(fs.readFileSync('js/modules/backup-safe.js','utf8'),s);return {api:window.PhoneBackup,maps,db};}
test('calendar mutations share the backup write queue and survive an interleaved full save',async()=>{
 const f=backupFixture(),token=await f.api.beginDataLoad();await f.api.completeDataLoad(token);
 const first=f.api.mutateSetting('daybook',v=>({value:{count:(v?.count||0)+1},result:'first'}));
 const full=f.api.save();const second=f.api.mutateSetting('daybook',v=>({value:{count:(v?.count||0)+1},result:'second'}));
 const [a,,b]=await Promise.all([first,full,second]);assert.equal(a.result,'first');assert.equal(b.result,'second');assert.equal(f.maps.globalSettings.get('daybook').value.count,2);assert.equal(f.db.daybook.count,2);
});
test('an old browser tab cannot overwrite a daily gate written by another page',async()=>{
 const f=backupFixture(),token=await f.api.beginDataLoad();await f.api.completeDataLoad(token);
 f.maps.safeMeta.set('settings-write-generation',{key:'settings-write-generation',generation:1});f.maps.globalSettings.set('daybook',{key:'daybook',value:{count:1}});
 await assert.rejects(f.api.mutateSetting('daybook',()=>({value:{count:0}})),/其他页面更新/);assert.equal(f.maps.globalSettings.get('daybook').value.count,1);
});
test('cached local avatar can decode synchronously without losing its load event',async()=>{
 const src=fs.readFileSync('js/utils.js','utf8'),part=src.slice(src.indexOf('async function compressImage('),src.indexOf('// 数字补零'));
 const s={FileReader:class{readAsDataURL(){this.onload({target:{result:'data:image/png;base64,AAAA'}})}},Image:class{constructor(){this.width=100;this.height=100;}set src(v){if(this.onload)this.onload();}},document:{createElement:()=>({getContext:()=>({fillRect(){},drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,BBBB'})}};
 // FileReader itself fires asynchronously; image decode may already be cached.
 s.FileReader=class{readAsDataURL(){queueMicrotask(()=>this.onload({target:{result:'data:image/png;base64,AAAA'}}));}};
 vm.createContext(s);vm.runInContext(part,s);assert.equal(await s.compressImage({type:'image/png'}),'data:image/jpeg;base64,BBBB');
});

test('request-only mode rejects unsolicited daily actions and stale requests', async () => {
 const f = fixture();
 const character = f.db.characters[0];
 await f.api.mutate(state => { state.settings.generationMode = 'request'; }, {account:'me'});
 const reply = '<daybook_action>' + JSON.stringify({type:'daily',rows}) + '</daybook_action>';
 const unsolicitedContext = await f.api.context(character);
 assert.match(unsolicitedContext.prompt, /用户尚未点击生成按钮/);
 await f.api.consume(reply, character, unsolicitedContext);
 assert.equal((await f.api.read()).days.length, 0);
 await f.api.mutate(state => { state.requests.a = {id:'expired',at:Date.parse('2026-11-06T06:40Z'),date:'2026-11-06',zone:'Asia/Tokyo'}; }, {account:'me'});
 await f.api.consume(reply, character, {...await f.api.context(character),dailyRequestId:'expired'});
 assert.equal((await f.api.read()).days.length, 0);
});

test('button generation consumes one request, blocks concurrent clicks and keeps the real-time gate', async () => {
 const f = fixture();
 const character = f.db.characters[0];
 await f.api.mutate(state => { state.settings.generationMode = 'request'; }, {account:'me'});
 let release;
 const waiting = new Promise(resolve => { release = resolve; });
 let started;
 const entered = new Promise(resolve => { started = resolve; });
 f.sandbox.getAiReply = async () => {
  started();
  await waiting;
  const context = await f.api.context(character);
  assert.match(context.prompt, /用户已点击/);
  const reply = '<daybook_action>' + JSON.stringify({type:'daily',rows}) + '</daybook_action>';
  await Promise.all([f.api.consume(reply,character,context),f.api.consume(reply,character,context)]);
 };
 const first = f.api.requestDaily(character);
 await entered;
 await assert.rejects(f.api.requestDaily(character), /已经在生成/);
 release();
 await first;
 const state = await f.api.read();
 assert.equal(state.days.length, 1);
 assert.equal(state.requests.a, undefined);
 await assert.rejects(f.api.requestDaily(character), /已经记录过/);
 f.setNow(Date.parse('2026-11-07T06:59Z'));
 await assert.rejects(f.api.requestDaily(character), /24小时/);
});

test('failed requested generation clears the request without consuming the daily gate', async () => {
 const f = fixture();
 const character = f.db.characters[0];
 await f.api.mutate(state => { state.settings.generationMode = 'request'; }, {account:'me'});
 f.sandbox.getAiReply = async () => { throw Error('network failure'); };
 await assert.rejects(f.api.requestDaily(character), /network failure/);
 const state = await f.api.read();
 assert.equal(state.requests.a, undefined);
 assert.equal(state.days.length, 0);
 assert.equal(state.gates.a, undefined);
});

test('legacy calendar settings default to automatic generation and optional daily titles preserve actions', () => {
 const state = C.state({settings:{theme:'night'}});
 assert.equal(state.settings.generationMode,'auto');
 assert.deepEqual(state.requests,{});
 const record = C.daily(state,'a','Asia/Tokyo',[{...rows[0],title:'起床',end:'07:40'}],Date.parse('2026-11-06T07:00Z'));
 assert.equal(record.rows[0].title,'起床');
 assert.equal(record.rows[0].action,'起床洗漱');
 assert.equal(record.rows[0].end,'07:40');
});

test('calendar due reminders never call AI unless the role enabled automatic messages',async()=>{
 const f=fixture(),character=f.db.characters[0],calls=[];
 f.db.apiSettings={url:'https://test.invalid/v1',key:'test-key',model:'test-model'};
 f.window.KissClock.isQuiet=()=>false;
 f.window.PhoneBackup.isPinned=()=>false;
 f.sandbox.getAiReply=async(...args)=>calls.push(args);
 await f.api.saveEntry({title:'出门',date:'2026-11-06',time:'16:00',zone:'Asia/Tokyo',roleId:'a',remind:0},null,{account:'me'});
 await f.api.tick();
 assert.equal(calls.length,0,'unset automatic messages must stay off');
 assert.equal((await f.api.read()).notices.filter(n=>n.kind==='reminder').length,1,'local reminder remains available');
 character.autoReply={enabled:false};await f.api.tick();assert.equal(calls.length,0);
 character.autoReply.enabled=true;await f.api.tick();assert.deepEqual(calls,[['a','private',true,'daybook-reminder']]);
 character.autoReply.enabled=false;f.setNow(Date.parse('2026-11-06T07:16Z'));await f.api.tick();assert.equal(calls.length,1,'turning off again blocks later timer passes');
});
