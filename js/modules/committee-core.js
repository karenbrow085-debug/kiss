/* 居委会: deterministic validation and discussion rules. No network or UI state. */
(function(root){
'use strict';
const types={purchase:'买不买',reason:'评评理',mediation:'劝个架',poll:'帮我选',neighbors:'邻里议事',court:'小法庭'};
const categories=['购物','餐饮','出行','娱乐','学习','其他'];
const outcomes=['谈妥了','各自保留意见','暂时休庭','撤回'];
const uid=()=>root.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
const text=(v,n=2000)=>typeof v==='string'?v.trim().slice(0,n):'';
const integer=(v,min,max,fallback)=>Number.isInteger(Number(v))?Math.max(min,Math.min(max,Number(v))):fallback;
const image=v=>typeof v==='string'&&(/^(https?:\/\/|blob:|data:image\/(png|jpeg|webp|gif|avif);base64,)/i.test(v))?v:'';
function empty(){return {version:1,posts:[],npcs:[],notices:[],settings:{types:['purchase','reason','mediation','poll','neighbors','court'],counts:{purchase:1,reason:1,mediation:0,poll:1,neighbors:0,court:0},comments:5,allowActor:true,autoPost:false,worldview:'',npcNotes:''}};}
function state(raw){const s=empty(),r=raw&&typeof raw==='object'?raw:{};return {...s,...r,posts:Array.isArray(r.posts)?r.posts.map(p=>p.status==='open'&&Number.isFinite(p.deadline)&&Date.now()>=p.deadline?{...p,status:'review'}:p):[],npcs:Array.isArray(r.npcs)?r.npcs:[],notices:Array.isArray(r.notices)?r.notices:[],settings:{...s.settings,...r.settings,counts:{...s.settings.counts,...r.settings?.counts}}};}
function actor(type,id,name,avatar=''){if(!['user','actor','npc'].includes(type)||!id||!text(name,60))throw Error('发言身份不完整');return {type,id:String(id),name:text(name,60),avatar:image(avatar)};}
function post(input,owner,roleId,at=Date.now()){
 const type=types[input.type]?input.type:'purchase',title=text(input.title,120),body=text(input.body,5000),amount=Number(input.amount),choices=(Array.isArray(input.choices)?input.choices:[]).map(x=>text(x,100)).filter(Boolean);
 if(!title||!body)throw Error('请填写事项和具体经过 / 理由');
 if(type==='purchase'&&(!Number.isFinite(amount)||amount<0||amount>1e9))throw Error('请填写有效金额');
 if(type==='poll'&&(choices.length<2||choices.length>6||new Set(choices).size!==choices.length))throw Error('帮我选需要2至6个不重复的选项');
 const hours=integer(input.hours,1,168,24),quorum=integer(input.quorum,2,30,5);
 return {id:uid(),roleId:String(roleId),type,title,body,category:categories.includes(input.category)?input.category:'其他',customCategory:text(input.customCategory,30),amount:type==='purchase'?Math.round(amount*100)/100:null,alternative:text(input.alternative,2000),choices,visibility:input.visibility==='private'?'private':'public',author:owner,images:(Array.isArray(input.images)?input.images:[]).map(image).filter(Boolean).slice(0,4),observations:[],visionError:'',evidence:[],comments:[],votes:[],statements:[],proposals:[],consent:{user:owner.type==='user',actor:owner.type==='actor'},status:'open',outcome:'',decision:'',created:at,updated:at,deadline:at+hours*3600000,quorum,revision:1};
}
function fingerprint(p){return [p.type,p.title,p.body].join('|').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');}
function duplicate(p,posts){const a=fingerprint(p);return posts.some(q=>{const b=fingerprint(q);return a===b||(Math.min(a.length,b.length)>30&&(a.includes(b)||b.includes(a)));});}
function eligible(p,at=Date.now()){return p.status==='open'&&at<p.deadline&&!(p.type==='court'&&(!p.consent.user||!p.consent.actor));}
function voteOptions(p){return p.type==='poll'?p.choices:p.type==='mediation'?['支持沟通','建议冷静']:p.type==='court'?['支持甲方','支持乙方','双方都有责任','信息不足']:p.type==='reason'?['支持楼主','另一方有道理','信息不足']:p.type==='neighbors'?['赞成','反对','再商量']:['通过','再等等'];}
function comment(p,who,body,parent='',at=Date.now()){
 const value=text(body);if(!value)throw Error('请填写评论或理由');if(p.status==='closed')throw Error('这条帖子已结案，可在后续中补充');
 if(parent&&!p.comments.some(c=>c.id===parent))throw Error('回复的评论已不存在');
 const old=p.comments.find(c=>c.author.type===who.type&&c.author.id===who.id&&c.text===value&&c.parent===parent);if(old)return old;
 const c={id:uid(),author:who,text:value,parent,at};p.comments.push(c);p.updated=at;p.revision++;return c;
}
function vote(p,who,choice,reason,at=Date.now()){
 if(!eligible(p,at))throw Error(p.type==='court'&&!p.consent.user||p.type==='court'&&!p.consent.actor?'小法庭需双方同意后才能评议':'本轮评议已结束');
 if(!voteOptions(p).includes(choice)||!text(reason))throw Error('请选择立场并填写理由');
 const previous=p.votes.find(v=>v.author.type===who.type&&v.author.id===who.id);
 if(previous?.choice===choice&&previous.reason===text(reason))return previous;
 const c=comment(p,who,(previous?'改票：':'')+text(reason));
 const row={id:previous?.id||uid(),author:who,choice,reason:text(reason),commentId:c.id,at};
 if(previous)p.votes[p.votes.indexOf(previous)]=row;else p.votes.push(row);if(p.votes.length>=p.quorum)p.status='review';return row;
}
function tally(p){return voteOptions(p).map(choice=>({choice,count:p.votes.filter(v=>v.choice===choice).length}));}
function close(p,who,outcome,decision='',at=Date.now()){
 if(p.author.type!==who.type||p.author.id!==who.id)throw Error('只有发起人可以结案');if(!outcomes.includes(outcome))throw Error('请选择结案方式');
 p.status='closed';p.outcome=outcome;p.decision=text(decision,80);p.updated=at;p.revision++;
}
function proposal(p,who,value){if(!['user','actor'].includes(who.type))throw Error('和解约定需由双方提出');if(p.status==='closed'||!text(value))throw Error('请在未结案的帖子填写约定');const row={id:uid(),text:text(value,1000),user:who.type==='user',actor:who.type==='actor',at:Date.now()};p.proposals.push(row);return row;}
function accept(p,who,id){if(!['user','actor'].includes(who.type)||p.status==='closed')throw Error('当前不能接受约定');const row=p.proposals.find(x=>x.id===id);if(!row)throw Error('约定不存在');row[who.type]=true;return row;}
function settings(input){const counts={};for(const key of Object.keys(types))counts[key]=integer(input.counts?.[key],0,6,0);const total=Object.values(counts).reduce((a,b)=>a+b,0);if(total<1||total>18)throw Error('每批请选择1至18条帖子，每类最多6条');return {counts,comments:integer(input.comments,1,12,5),allowActor:!!input.allowActor,autoPost:!!input.autoPost,worldview:text(input.worldview,6000),npcNotes:text(input.npcNotes,4000)};}
const api={types,categories,outcomes,uid,text,image,integer,empty,state,actor,post,duplicate,eligible,voteOptions,comment,vote,tally,close,proposal,accept,settings};root.CommitteeCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
