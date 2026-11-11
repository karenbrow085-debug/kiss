/* Daybook's deterministic dates, time-zone conversion and once-per-24-hour gate. */
(function(root){
'use strict';
const DAY=86400000, pad=n=>String(n).padStart(2,'0');
const uid=()=>root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const text=(v,n=500)=>String(v??'').trim().slice(0,n);
const clocks=new Map(),instants=new Map();
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const [y,m,d]=s.split('-').map(Number),a=new Date(Date.UTC(y,m-1,d));return y>=1900&&y<=2100&&a.getUTCFullYear()===y&&a.getUTCMonth()===m-1&&a.getUTCDate()===d;}
const validTime=s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s||'');
function validZone(z){try{new Intl.DateTimeFormat('en',{timeZone:z}).format();return !!z;}catch{return false;}}
function parts(at=Date.now(),zone='UTC'){if(!clocks.has(zone))clocks.set(zone,new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));const p=Object.fromEntries(clocks.get(zone).formatToParts(new Date(at)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};}
function shift(date,n){if(!validDate(date))throw Error('日期无效');const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
const distance=(a,b)=>Math.round((Date.parse(b+'T12:00Z')-Date.parse(a+'T12:00Z'))/DAY);
/* Resolve a wall time by validating the resulting local parts. Gaps are rejected;
   an overlapping fall-back wall time consistently uses its earliest instant. */
function instant(date,time,zone){
 const key=date+'T'+time+'@'+zone;if(instants.has(key))return instants.get(key);
 if(!validDate(date)||!validTime(time)||!validZone(zone))throw Error('请填写有效的日期、时间与时区');
 const wall=Date.parse(date+'T'+time+':00Z');let t=wall;
 for(let i=0;i<4;i++){const p=parts(t,zone),local=Date.parse(p.date+'T'+p.time+':00Z');t+=wall-local;}
 const candidates=[t-7200000,t-3600000,t-1800000,t,t+1800000,t+3600000,t+7200000].filter(x=>{const p=parts(x,zone);return p.date===date&&p.time===time;});
 if(!candidates.length)throw Error('这一天因夏令时跳时，没有这个当地时间，请换一个时间');
 const value=Math.min(...candidates);if(instants.size>3000)instants.delete(instants.keys().next().value);instants.set(key,value);return value;
}
function empty(){return {entries:[],comments:[],days:[],gates:{},requests:{},cycle:{records:[],enabled:false,shareWith:[],cycleDays:28,periodDays:5,remindDays:2},settings:{reminders:true,allowActor:true,allowDaily:true,allowComments:true,privateDaily:false,showFestivals:true,unreadBadge:true,festivalReminders:[],generationMode:'auto',theme:'day'},notices:[],receipts:[]};}
function state(value){const s=value&&typeof value==='object'&&!Array.isArray(value)?value:{};const d=empty();for(const k of ['entries','comments','days','notices','receipts'])if(!Array.isArray(s[k]))s[k]=[];s.gates=s.gates&&typeof s.gates==='object'?s.gates:{};s.settings={...d.settings,...s.settings};s.settings.generationMode=s.settings.generationMode==='request'?'request':'auto';s.requests=s.requests&&typeof s.requests==='object'&&!Array.isArray(s.requests)?s.requests:{};s.cycle={...d.cycle,...s.cycle};if(!Array.isArray(s.cycle.records))s.cycle.records=[];if(!Array.isArray(s.cycle.shareWith))s.cycle.shareWith=[];return s;}
function entry(input,old={},now=Date.now()){
 const v={id:old.id||uid(),kind:input.kind==='todo'?'todo':input.kind==='anniversary'?'anniversary':'event',title:text(input.title,120),date:text(input.date,10),time:text(input.time,5),end:text(input.end,5),place:text(input.place,200),note:text(input.note,2000),owner:['user','actor','shared'].includes(input.owner)?input.owner:'shared',roleId:text(input.roleId,120),zone:text(input.zone,100),repeat:['daily','weekly','monthly','yearly'].includes(input.repeat)?input.repeat:'none',until:text(input.until,10),remind:input.remind===null||input.remind==='none'?null:Number(input.remind??15),done:!!old.done,doneDates:old.doneDates||[],comments:input.comments!==false,createdAt:old.createdAt||now,updatedAt:now,author:old.author||'user',revision:(old.revision||0)+1};
 if(!v.title)throw Error('请填写名称');if(!validDate(v.date))throw Error('请填写有效日期');if(v.time&&!validTime(v.time))throw Error('时间无效');if(v.end&&(!validTime(v.end)||!v.time||v.end<=v.time))throw Error('结束时间应晚于开始时间；跨天安排请分开记录');if(!validZone(v.zone))throw Error('时区无效');if(v.until&&(!validDate(v.until)||v.until<v.date))throw Error('重复截止日期无效');if(v.remind!==null&&(!Number.isFinite(v.remind)||v.remind<0||v.remind>10080))throw Error('提醒时间无效');if(v.time)instant(v.date,v.time,v.zone);return v;
}
function occurs(e,date){if(!validDate(date)||date<e.date||e.until&&date>e.until)return false;if(date===e.date)return true;const r=e.repeat;if(r==='daily')return true;if(r==='weekly')return distance(e.date,date)%7===0;if(r==='monthly')return e.date.slice(8)===date.slice(8);if(r==='yearly')return e.date.slice(5)===date.slice(5);return false;}
const done=(e,date)=>e.repeat!=='none'?(e.doneDates||[]).includes(date):!!e.done;
function occurrence(e,date){if(!occurs(e,date))return null;try{return {entry:e,date,at:instant(date,e.time||'09:00',e.zone),key:e.id+':'+e.revision+':'+date,done:done(e,date)};}catch{return null;}}
function dailyAllowed(s,roleId,zone,at=Date.now()){
 const date=parts(at,zone).date,g=s.gates[roleId];
 if(s.days.some(x=>x.roleId===roleId&&x.date===date))return {ok:false,date,reason:'这一天已经记录过了'};
 if(g&&at-Number(g.at)<DAY)return {ok:false,date,reason:'距离上次记录还未满24小时',nextAt:Number(g.at)+DAY};
 if(g&&date<=g.date)return {ok:false,date,reason:'角色当地日期还未进入新的一天'};
 return {ok:true,date};
}
function daily(s,roleId,zone,rows,at=Date.now(),privateEnabled=false){
 const gate=dailyAllowed(s,roleId,zone,at);if(!gate.ok)throw Error(gate.reason);
 if(!Array.isArray(rows)||!rows.length||rows.length>48)throw Error('当天记录须有1到48条完整行程');
 const normalized=rows.map(r=>{const x={id:uid(),time:text(r.time,5),place:text(r.place,200),clothes:text(r.clothes,200),action:text(r.action,1000),title:text(r.title,40),end:text(r.end,5)};if(x.end&&(!validTime(x.end)||x.end<=x.time))throw Error('行程结束时间应晚于开始时间');if(!validTime(x.time)||!x.place||!x.clothes||!x.action)throw Error('每条行程都须填写时间、地点、穿着和做了什么');if(!privateEnabled&&r.private)throw Error('尚未启用私密生活记录');return {...x,private:!!r.private};}).sort((a,b)=>a.time.localeCompare(b.time));
 const value={id:uid(),roleId,date:gate.date,zone,at,rows:normalized};s.days.push(value);s.gates[roleId]={at,date:gate.date,zone};return value;
}
function prediction(cycle){const records=(cycle.records||[]).filter(x=>validDate(x.start)).sort((a,b)=>a.start.localeCompare(b.start));const gaps=records.slice(1).map((r,i)=>distance(records[i].start,r.start)).filter(x=>x>=15&&x<=90);const length=gaps.length?Math.round(gaps.slice(-6).reduce((a,b)=>a+b,0)/gaps.slice(-6).length):Number(cycle.cycleDays)||28;const last=records.at(-1);return last?{date:shift(last.start,length),days:length,estimated:true}:null;}
function festivals(date){if(!validDate(date))return {names:[],lunar:'',term:''};const [y,m,d]=date.split('-').map(Number);if(!root.Solar)return {names:[],lunar:'',term:'',unavailable:true};const solar=root.Solar.fromYmd(y,m,d),lunar=solar.getLunar();return {names:[...new Set([...solar.getFestivals(),...lunar.getFestivals()])],lunar:lunar.getMonthInChinese()+'月'+lunar.getDayInChinese(),term:lunar.getJieQi()||''};}
function nextTerm(date){if(!validDate(date)||!root.Solar)return null;const [y,m,d]=date.split('-').map(Number),next=root.Solar.fromYmd(y,m,d).getLunar().getNextJieQi(true);return next?{name:next.getName(),date:next.getSolar().toYmd()}:null;}
const api={DAY,pad,uid,text,validDate,validTime,validZone,parts,shift,distance,instant,empty,state,entry,occurs,done,occurrence,dailyAllowed,daily,prediction,festivals,nextTerm};
root.KissCalendarCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

