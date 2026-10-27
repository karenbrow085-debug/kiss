/* Shared Community publication policy; no API requests. */
(()=>{'use strict';
const audit=(title,detail='',level='log')=>window.KissDiagnostics?.record({app:'peek',feature:'朋友圈发布',title,detail:typeof detail==='string'?detail:JSON.stringify(detail,null,2),level,phase:level==='error'?'error':'end',unique:true});
function device(c,p){const value=c?c.kissFriendsDisplay?.device:p?.kissFriendsCard?.device;return typeof value==='string'?value.trim():'';}
function rows(s={}){return Array.isArray(s.periodLimits)&&s.periodLimits.length?s.periodLimits:[{start:s.start||'09:00',end:s.end||'22:00',min:1,max:3}];}
function stamp(parts){return `${parts.year}-${String(parts.month).padStart(2,'0')}-${String(parts.day).padStart(2,'0')}`;}
function period(c,now=new Date()){
 const s=c.momentsSettings||{},clock=window.KissClock;if(!clock)return null;const local=clock.parts(c,now),all=rows(s);
 const index=all.findIndex(p=>clock.inside(local.minutes,p.start,p.end));if(index<0)return null;const row=all[index],minutes=v=>Number(v.slice(0,2))*60+Number(v.slice(3)),a=minutes(row.start),b=minutes(row.end);
 let anchor=stamp(local);if(a>=b&&local.minutes<b){const date=new Date(Date.UTC(local.year,local.month-1,local.day-1));anchor=stamp({year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate()});}
 const key=`${clock.zone(c)||'device'}/${anchor}/${row.start}-${row.end}`,min=Math.min(30,Math.max(0,Math.floor(Number(row.min)||0))),max=Math.min(30,Math.max(min,Math.floor(Number(row.max)||0)));
 let quota=s.periodQuota;if(!quota||quota.key!==key||quota.min!==min||quota.max!==max){quota={key,min,max,target:min+Math.floor(Math.random()*(max-min+1))};s.periodQuota=quota;}
 const count=(c.moments||[]).filter(p=>{if(!Number.isFinite(Number(p.timestamp)))return false;const at=clock.parts(c,new Date(Number(p.timestamp)));if(!clock.inside(at.minutes,row.start,row.end))return false;let day=stamp(at);if(a>=b&&at.minutes<b){const d=new Date(Date.UTC(at.year,at.month-1,at.day-1));day=stamp({year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()});}return day===anchor;}).length;
 const duration=(b-a+1440)%1440||1440,elapsed=(local.minutes-a+1440)%1440;
 return {key,index,row,min,max,target:quota.target,count,due:quota.target>count&&elapsed>=Math.floor(count*duration/quota.target)};
}
const decisions=new Map();
function canAuto(c,now=new Date()){const p=period(c,now),quiet=window.KissClock?.isQuiet(c,'moments',now),allowed=window.KissClock?.canPost(c,now),ready=!!allowed&&!!p&&p.due&&p.count<p.max;const reason=quiet?'安静时段':!allowed||!p?'不在发布时段':p.count>=p.target||p.count>=p.max?'达到本时段阈值':!p.due?'等待分散发布时间':'允许自动发布',key=[p?.key,reason,p?.count,p?.target].join('/');if(decisions.get(String(c.id))!==key){decisions.set(String(c.id),key);audit('调度检查 · '+reason,{role:c.realName||c.remarkName||c.id,time:window.KissClock?.local(c,now),period:p});}return ready;}

function hasCapacity(c,now=new Date()){if(!c?.momentsSettings?.periodLimits?.length)return true;const p=period(c,now);const allowed=!!window.KissClock?.canPost(c,now)&&!!p&&p.count<p.max;if(!allowed)audit('角色自主发帖被时段阈值拦截',{role:c.id,period:p},'warn');return allowed;}
function pin(c,post,value){if(typeof value!=='boolean')return;post.pinned=value;audit('角色决定置顶',{role:c.realName||c.remarkName||c.id,postId:post.id,pinned:value});}
function arrangePins(c,posts,ids){if(!Array.isArray(ids))return ()=>{};const all=[...posts,...(c.moments||[])],allowed=new Set(all.map(p=>String(p.id)));const chosen=[...new Set(ids.map(String))];if(chosen.length>3||chosen.some(id=>id!=='new'&&!allowed.has(id))){audit('忽略无效的角色置顶列表',{role:c.id,ids:chosen},'warn');return ()=>{};}const before=all.map(p=>[p,p.pinned]);for(const p of all)p.pinned=chosen.includes(String(p.id))||posts.includes(p)&&chosen.includes('new');audit('角色整理自己的置顶',{role:c.id,selected:chosen});return ()=>{for(const [p,v]of before)p.pinned=v;};}
window.KissMomentsPolicy={device,rows,period,canAuto,hasCapacity,pin,arrangePins,audit};
})();
