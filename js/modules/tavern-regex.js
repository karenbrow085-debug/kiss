/* Preset-scoped text transforms. Never execute imported JavaScript. */
(function(root){
'use strict';
function locate(p){const d=p?.data||{};return [['extensions.regex_scripts',d.extensions?.regex_scripts],['regex_scripts',d.regex_scripts],['extensions.regexScripts',d.extensions?.regexScripts]].filter(x=>Array.isArray(x[1]));}
function entries(p){return locate(p).flatMap(([path,list])=>list.flatMap((script,index)=>script&&typeof script==='object'?[{script,path,index,key:path+':'+index}]:[]));}
function run({text,rules,context={}}){
 if(Array.isArray(text)){const items=text.map(row=>run({text:row.text,rules,context:{...context,...row.context}}));return {items:items.map(x=>x.text),warnings:items.flatMap(x=>x.warnings)};}
 let value=String(text??'');const warnings=[];
 const macro=(s,escaped=false)=>String(s).replace(/\{\{(char|user)\}\}/gi,(_,k)=>{const v=String(context[k.toLowerCase()]||'');return escaped?v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'):v;});
 for(const rule of rules){
  if(rule.disabled||!(rule.placement||[2]).map(Number).includes(Number(context.placement||2)))continue;
  if(context.edited&&rule.runOnEdit===false)continue;
  if(context.target==='display'&&rule.promptOnly&&!rule.markdownOnly||context.target==='prompt'&&rule.markdownOnly&&!rule.promptOnly)continue;
  if(rule.minDepth!=null&&Number(rule.minDepth)>=0&&Number(context.depth||0)<Number(rule.minDepth)||rule.maxDepth!=null&&Number(rule.maxDepth)>=0&&Number(context.depth||0)>Number(rule.maxDepth))continue;
  try{
   let source=String(rule.findRegex||'');if(!source)continue;
   if(Number(rule.substituteRegex))source=macro(source,Number(rule.substituteRegex)===2);
   const literal=source.match(/^\/([\s\S]*)\/([dgimsuvy]*)$/);let re=literal?new RegExp(literal[1],literal[2]):new RegExp(source,'g'),replacement=String(rule.replaceString??'');
   if(/\\\\[sSdDwWbBnNrRtT/]/.test(source)&&!re.test(value)){
    const repaired=source.replace(/\\\\/g,'\\'),parts=repaired.match(/^\/([\s\S]*)\/([dgimsuvy]*)$/);
    try{const alternate=parts?new RegExp(parts[1],parts[2]):new RegExp(repaired,'g');if(alternate.test(value)){re=alternate;try{replacement=JSON.parse('"'+replacement.replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/(?<!\\)"/g,'\\"')+'"');}catch{replacement=replacement.replace(/\\"/g,'"');}}}catch{}
   }re.lastIndex=0;
   value=value.replace(re,(...args)=>{const named=typeof args.at(-1)==='object',offset=args[named?args.length-3:args.length-2],input=args[named?args.length-2:args.length-1],groups=named?args.at(-1):{},caps=args.slice(1,named?-3:-2),match=args[0];
    const trim=v=>(rule.trimStrings||[]).reduce((s,t)=>t?s.split(macro(t)).join(''):s,String(v??''));
    return macro(replacement).replace(/\{\{match\}\}/gi,()=>trim(match)).replace(/\$(\$|&|`|'|<[^>]+>|\d{1,2})/g,(all,k)=>{if(k==='$')return '$';if(k==='&')return trim(match);if(k==='`')return input.slice(0,offset);if(k==="'")return input.slice(offset+match.length);if(k[0]==='<')return trim(groups[k.slice(1,-1)]);const n=Number(k);if(n>0&&n<=caps.length)return trim(caps[n-1]);if(k.length===2&&Number(k[0])>0&&Number(k[0])<=caps.length)return trim(caps[Number(k[0])-1])+k[1];return all;});
   });
  }catch(error){warnings.push((rule.scriptName||'未命名正则')+'：'+error.message);}
 }
 return {text:value,warnings};
}
let activeWorkers=0;const waiting=[];function pump(){while(activeWorkers<2&&waiting.length){activeWorkers++;const job=waiting.shift();job().finally(()=>{activeWorkers--;pump();});}}
function apply(text,preset,context){return new Promise(resolve=>{waiting.push(async()=>resolve(await execute(text,preset,context)));pump();});}
function execute(text,preset,context){
 const rules=entries(preset).map(x=>x.script).filter(x=>!x.disabled);if(!rules.length)return Promise.resolve({text,warnings:[]});
 if(!root.Worker||JSON.stringify(text).length>2000000||rules.length>200)return Promise.resolve({text,warnings:['正则未运行：环境不支持或内容超过限制']});
 return new Promise(resolve=>{let worker,url,timer,done=false;const finish=result=>{if(done)return;done=true;clearTimeout(timer);worker?.terminate();if(url)URL.revokeObjectURL(url);resolve(result);};try{url=URL.createObjectURL(new Blob(['const run='+run.toString()+';onmessage=e=>postMessage(run(e.data));'],{type:'text/javascript'}));worker=new Worker(url);worker.onmessage=e=>finish(e.data);worker.onerror=()=>finish({text,warnings:['正则运行失败，保留原文']});timer=setTimeout(()=>finish({text,warnings:['正则运行超时，保留原文']}),500);worker.postMessage({text,rules,context});}catch{finish({text,warnings:['正则运行失败，保留原文']});}});
}
root.KissTavernRegex={locate,entries,run,apply};
})(window);
