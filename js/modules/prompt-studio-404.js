/* Prompt-local choice sheets. Keep the existing select values and change events. */
(function(){
'use strict';
function init(){
 const root=document.getElementById('cot-settings-screen');if(!root)return;
 const hooked=new Map();let pending=false;
 function choice(select){
  const ui=window.KissPromptUI;if(!ui?.dialog)return;
  const label=select.getAttribute('aria-label')||root.querySelector('label[for="'+select.id+'"]')?.textContent||[...(select.closest('label')?.childNodes||[])].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()||'选择预设';
  const modal=ui.dialog(label,a=>{
   a.el.classList.add('pt-choice-dialog');
   for(const option of select.options){const button=document.createElement('button');button.type='button';button.className='pt-choice-option';button.textContent=option.textContent;button.disabled=option.disabled;button.setAttribute('aria-pressed',String(option.selected));button.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));a.close();schedule();};a.body.append(button);}
  },null,'保存',true);
  return modal;
 }
 function sync(){pending=false;
  for(const [select,button] of hooked){if(!select.isConnected){button.remove();hooked.delete(select);}}
  for(const select of [...root.querySelectorAll('select'),...document.querySelectorAll('.pt-dialog select')]){
   let button=hooked.get(select);if(!button){button=document.createElement('button');button.type='button';button.className='pt-choice-button';button.setAttribute('aria-haspopup','dialog');const span=document.createElement('span');const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','m6 9 6 6 6-6');svg.append(path);button.append(span,svg);button.onclick=()=>choice(select);select.after(button);select.classList.add('pt-native-select');select.tabIndex=-1;hooked.set(select,button);}
   const caption=select.selectedOptions[0]?.textContent||'选择预设';if(button.firstChild.textContent!==caption)button.firstChild.textContent=caption;
   button.disabled=select.disabled;button.setAttribute('aria-label',(select.getAttribute('aria-label')||'选择')+'：'+caption);
  }
 }
 function schedule(){if(!pending){pending=true;requestAnimationFrame(sync);}}
 const observer=new MutationObserver(records=>{if(records.some(r=>r.type==='childList'&&r.target.closest?.('select')||[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.matches?.('select')||n.querySelector?.('select')))))schedule();});
 observer.observe(root,{subtree:true,childList:true});
 const dialogs=new MutationObserver(records=>{if(records.some(r=>(r.target.matches?.('select')&&r.target.closest('.pt-dialog'))||[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.matches?.('.pt-dialog')||n.querySelector?.('.pt-dialog')||n.matches?.('select')&&n.closest('.pt-dialog')))))schedule();});dialogs.observe(document.body,{subtree:true,childList:true});
 root.addEventListener('change',schedule);new MutationObserver(schedule).observe(root,{attributes:true,attributeFilter:['class']});
 document.getElementById('cot-item-top-close')?.addEventListener('click',()=>document.getElementById('cot-item-cancel-btn')?.click());
 sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
