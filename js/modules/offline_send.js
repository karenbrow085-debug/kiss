/* Fast offline delivery: paint first, serialize durable saves, never clear a newer draft. */
(() => {
'use strict';
function create({save,changed=()=>{},exists=()=>true,delay=40}){
 const queues=new Map(),states=new WeakMap();
 const get=chat=>{if(!queues.has(chat))queues.set(chat,{pending:[],failed:new Set(),active:null,activeRows:[],timer:null});return queues.get(chat);};
 function cancel(q){clearTimeout(q.timer);q.timer=null;}
 function notify(chat,m,value){if(value)states.set(m,value);else states.delete(m);try{changed(chat,m,value);}catch(error){console.warn('[Offline delivery view]',error);}}
 function schedule(chat,q){if(q.timer!==null||q.active)return;q.timer=setTimeout(()=>{q.timer=null;run(chat,q).catch(()=>{});},delay);}
 function run(chat,q){
  if(q.active)return q.active;
  cancel(q);for(const m of q.failed)if(!exists(chat,m)){q.failed.delete(m);states.delete(m);}const entries=q.pending.splice(0),rows=[...new Set([...q.failed,...entries.map(e=>e.message)])].filter(m=>exists(chat,m));q.activeRows=rows;
  if(!rows.length){for(const e of entries)e.resolve(e.message);return Promise.resolve();}
  rows.forEach(m=>notify(chat,m,'saving'));
  const work=Promise.resolve().then(()=>save(chat)).then(()=>{for(const m of rows){q.failed.delete(m);notify(chat,m,null);}for(const e of entries)e.resolve(e.message);},error=>{for(const m of rows)if(exists(chat,m)){q.failed.add(m);notify(chat,m,'failed');}for(const e of entries)e.reject(error);throw error;});
  q.active=work.then(()=>{q.active=null;q.activeRows=[];if(q.pending.length)schedule(chat,q);},error=>{q.active=null;q.activeRows=[];if(q.pending.length)schedule(chat,q);throw error;});
  return q.active;
 }
 function enqueue(chat,message){const q=get(chat);const promise=new Promise((resolve,reject)=>q.pending.push({message,resolve,reject}));notify(chat,message,'saving');schedule(chat,q);return promise;}
 async function flush(chat){const q=get(chat);cancel(q);if(q.active)await q.active;while(q.pending.length||q.failed.size){for(const m of q.failed)if(!exists(chat,m)){q.failed.delete(m);states.delete(m);}if(!q.pending.length&&!q.failed.size)break;await run(chat,q);}}
 function flushAll(){return Promise.all([...queues.keys()].map(flush));}
 return {enqueue,flush,flushAll,state:m=>states.get(m)||null,pending:chat=>{const q=queues.get(chat);return !!q&&(!!q.active||q.pending.length>0||q.failed.size>0);}};
}
window.KissOfflineSend={create};
})();
