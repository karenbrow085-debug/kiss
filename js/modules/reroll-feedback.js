/* Per-request reroll feedback. Never writes drafts, chat messages, or preset text. */
(()=>{'use strict';
let active=null;
const clean=value=>String(value??'').trim().slice(0,3000);
function instruction(note){
 const reason=clean(note?.reason),wish=clean(note?.wish);if(!reason&&!wish)return '';
 return '\n<本次重生成反馈>\n这是用户针对本次重生成的编辑意见，供你在理解现有角色设定、思维链或预设、组织这次回复时一并参考。结合用户不满意的地方调整本次输出，并按希望的方向重新回应；继续遵守当前人设、上下文与原有输出格式。不要把这段意见当成角色收到的新聊天消息，不要复述意见、解释重生成过程或输出分析。它只用于本次请求，不代表永久修改设定。\n'+JSON.stringify({不满意的地方:reason,希望如何回应:wish})+'\n</本次重生成反馈>\n';
}
function inject(body,provider,note){
 const text=instruction(note);if(!text)return body;
 if(provider==='gemini'){
  const old=body.system_instruction||body.systemInstruction||{parts:[]};
  const instruction={...old,parts:[{text},...(old.parts||[])]};
  body.system_instruction=instruction;delete body.systemInstruction;
 }else{
  body.messages||=[];const first=body.messages.find(m=>m.role==='system');
  if(first){if(typeof first.content==='string')first.content=text+first.content;else if(Array.isArray(first.content))first.content=[{type:'text',text},...first.content];else first.content=text;}
  else body.messages.unshift({role:'system',content:text});
 }
 return body;
}
const account=()=>String(globalThis.db?.activePersonaId??(typeof db!=='undefined'?db.activePersonaId:'')??'default');
function capture(chat){return {account:account(),chat,archive:chat?.activeArchiveId,session:chat?.offline?.activeSessionId,offline:!!chat?.offline?.active};}
function valid(chat,token){return !!token&&chat===token.chat&&account()===token.account&&chat?.activeArchiveId===token.archive&&chat?.offline?.activeSessionId===token.session&&!!chat?.offline?.active===token.offline;}
function fingerprint(rows){return JSON.stringify([(rows||[]).length,...(rows||[]).slice(-3).map(m=>[m.id,m.role||m.sender,m.content??m.text,m.timestamp,m.turnId])]);}
function ask({title='重生成要求',guard=()=>true}={}){
 if(active)return Promise.resolve(null);
 return new Promise(resolve=>{
  const prior=document.activeElement,overlay=document.createElement('div');overlay.className='kr-feedback-overlay';
  overlay.innerHTML='<form class="kr-feedback-sheet" role="dialog" aria-modal="true" aria-labelledby="kr-feedback-title"><header><div><span class="kr-feedback-kicker">REGENERATE</span><h2 id="kr-feedback-title"></h2></div><button class="kr-feedback-x" type="button" aria-label="取消重生成">×</button></header><div class="kr-feedback-fields"><label>哪里不满意<span>选填</span><textarea name="reason" maxlength="3000" rows="2" placeholder="例如：语气太生硬，没接住我上一句话"></textarea></label><label>希望怎么回<span>选填</span><textarea name="wish" maxlength="3000" rows="3" placeholder="例如：自然一点，直接回应我的情绪，少一些解释"></textarea></label></div><p class="kr-feedback-error" role="alert" hidden></p><footer><button type="button" class="kr-feedback-cancel">取消</button><button type="submit" class="kr-feedback-submit">重新生成</button></footer></form>';
  overlay.querySelector('h2').textContent=title;
  let settled=false;const close=value=>{if(settled)return;settled=true;overlay.remove();document.removeEventListener('keydown',keys,true);active=null;if(prior?.isConnected)prior.focus({preventScroll:true});resolve(value);};
  const keys=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(null);}if(e.key==='Tab'){const inputs=[...overlay.querySelectorAll('button,textarea')].filter(n=>!n.disabled),first=inputs[0],last=inputs.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
  overlay.querySelector('.kr-feedback-x').onclick=()=>close(null);overlay.querySelector('.kr-feedback-cancel').onclick=()=>close(null);overlay.addEventListener('click',e=>{if(e.target===overlay)close(null);});
  overlay.querySelector('form').onsubmit=e=>{e.preventDefault();if(!guard()){const error=overlay.querySelector('.kr-feedback-error');error.textContent='内容或当前身份已变化，请取消后重新操作。';error.hidden=false;return;}close({reason:clean(overlay.querySelector('[name=reason]').value),wish:clean(overlay.querySelector('[name=wish]').value)});};
  active=overlay;document.body.append(overlay);document.addEventListener('keydown',keys,true);overlay.querySelector('[name=reason]').focus({preventScroll:true});
 });
}
window.KissReroll={ask,inject,instruction,account,capture,valid,fingerprint};
})();
