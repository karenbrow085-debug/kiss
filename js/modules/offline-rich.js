/* Structured narrative layout; imported HTML is rendered only in isolated frames. */
(function(root){
'use strict';
const labels={title:'标题',heading:'标题',header:'标题',ending:'结尾',epilogue:'尾声',afterword:'后记',theater:'小剧场',small_theater:'小剧场',smalltheater:'小剧场',omake:'小剧场',branches:'小剧场',branch:'分支',meow_fm:'小剧场',summary:'本轮摘要',options:'剧情选项',choices:'剧情选项',choice:'剧情选项',suggested_responses:'剧情选项',suggested_actions:'剧情选项',choice_list:'剧情选项',option_list:'剧情选项',plot_options:'剧情选项',plot_choices:'剧情选项',suggestions:'剧情选项',routes:'剧情选项',content:'正文',story:'正文',scene:'场景',选项:'剧情选项',剧情选项:'剧情选项',剧情走向:'剧情选项'};
const optionTag=n=>/^(options?|choices?|plot_options|plot_choices|suggested_responses|suggested_actions|choice_list|option_list|suggestions|routes|选项|剧情选项|剧情走向)$/i.test(n);
function parse(value,partition){
 const parts=partition(String(value??'')),html=[],tree={type:'root',children:[]},stack=[tree];let serial=0;
 for(const part of parts){if(part.type==='html'){const node={type:'html',text:part.text,index:html.length};html.push(node);stack.at(-1).children.push(node);continue;}
  const re=/<(\/?)([a-zA-Z_\u3400-\u9fff][\w\u3400-\u9fff-]*)(?:\s[^<>]*)?>/g;let at=0,m;const push=t=>{if(t)stack.at(-1).children.push({type:'text',text:t});};
  while((m=re.exec(part.text))){push(part.text.slice(at,m.index));at=re.lastIndex;const name=m[2].toLowerCase();if(m[1]){const pos=stack.findLastIndex(n=>n.name===name);if(pos>0)stack.length=pos;continue;}
   if(stack.length>=17){push(m[0]);continue;}const node={type:'section',name,key:serial++,children:[]};stack.at(-1).children.push(node);if(!m[0].endsWith('/>'))stack.push(node);
  }push(part.text.slice(at));
 }
 return {tree,html};
}
function choicesFromText(raw){
 const plain=String(raw??'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:li|p|div|button|summary|h[1-6])>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').trim();
 const lines=plain.split(/\n+/).map(s=>s.trim().replace(/^\*\*(.*)\*\*$/,'$1')).filter(Boolean),out=[];let current=null;
 const mark=/^(?:[-*•]\s+|(?:\[?(?:选项\s*)?[A-Ha-hＡ-Ｈ1-9一二三四五六七八九十][\]）).、:：]|[①②③④⑤⑥⑦⑧⑨⑩])\s*|选项\s*[A-Ha-h1-9一二三四五六七八九十]\s*[：:.、]\s*)/;
 for(const line of lines){if(/^(?:剧情(?:走向|选项)|可选(?:走向|选项)|下一步|选项|choices|options)\s*[:：]?$/i.test(line))continue;const match=mark.exec(line);if(match){current={label:line.slice(match[0].length).trim(),text:line.slice(match[0].length).trim()};if(current.text)out.push(current);}else if(current){current.text+='\n'+line;current.label+=' '+line;}else if(lines.length>1)out.push({label:line,text:line});}
 return out.length?out:(plain?[{label:plain,text:plain}]:[]);
}
function layout(value,{escape,paragraph,partition,html:htmlView,id=''}){
 const {tree,html}=parse(value,partition),groups=[],frames=[];let sectionNumber=0;
 const markdown=text=>String(text).split(/\n{2,}/).filter(x=>x.trim()).map(block=>{const h=/^\s*#{1,6}\s+([^\n]+)\s*$/.exec(block);if(h)return '<h3 class="of-narrative-heading">'+escape(h[1])+'</h3>';if(/^>\s/m.test(block))return '<blockquote>'+paragraph(block.replace(/^>\s?/gm,''))+'</blockquote>';return paragraph(block);}).join('');
 const flatten=node=>node.type==='text'||node.type==='html'?node.text:(node.children||[]).map(flatten).join('\n');
 const choiceView=(raw,key)=>{const choices=choicesFromText(raw);if(!choices.length)return '';const index=groups.length;groups.push({key,choices});return `<button class="of-options-entry" data-action="plot-options" data-id="${escape(id)}" data-group="${index}"><span><small>NEXT SCENE</small><strong>剧情选项</strong></span><span class="of-options-count">${choices.length} 个走向</span></button>`;};
 const textView=text=>{const at=/(?:^|\n)\s*(?:#{1,6}\s*)?(?:剧情走向|剧情选项|可选走向|下一步选项|可选行动|下一步行动|可选剧情|剧情分支|选项|Choices|Options)\s*[:：]?\s*\n/i.exec(text);if(at){const tail=text.slice(at.index+at[0].length),choices=choicesFromText(tail);if(choices.length>=2)return markdown(text.slice(0,at.index))+choiceView(tail,'auto-'+groups.length);}return markdown(text);};
 const frame=(node,kind)=>{const index=frames.length;frames.push({index:node.index,text:node.text,kind});return `<div class="of-inline-html" data-inline-html="${index}"><iframe title="${escape(kind==='title'?'标题卡片':kind==='ending'?'结尾卡片':'小剧场内容')}" loading="lazy"></iframe></div>`;};
 const visit=(nodes,context='')=>nodes.map((node,index)=>{
  if(node.type==='text')return textView(node.text);
  if(node.type==='html'){
   const choiceHeading=/<(?:details[^>]*>\s*<summary|h[1-6])[^>]*>\s*(?:剧情走向|剧情选项|行动选项|可选行动|选项|choices|options)\s*(?:<|[:：])/i.exec(node.text);if(choiceHeading&&!node.text.slice(0,choiceHeading.index).replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]*>/g,'').trim())return choiceView(node.text,'html-'+node.index);
   const titleLike=/<h[1-3]\b|class\s*=\s*["'][^"']*(?:title|header|notes)/i.test(node.text),before=nodes.slice(0,index).map(flatten).join('').replace(/<[^>]*>/g,'').trim();
   if(['title','heading','header','标题'].includes(context)||!context&&!before&&titleLike)return frame(node,'title');
   if(['ending','epilogue','afterword','结尾','尾声'].includes(context))return frame(node,'ending');
   if(context)return frame(node,'theater');
   if(htmlView&&!id)return htmlView(node.text,node.index);
   const key=escape(id+':html:'+node.index);return `<details class="of-extra-section" data-section-key="${key}"><summary>小剧场</summary>${frame(node,'theater')}</details>`;
  }
  if(optionTag(node.name))return choiceView(flatten(node),node.name+node.key);
  const label=labels[node.name]||node.name.replace(/[_-]/g,' '),body=visit(node.children,node.name);
  if(['title','heading','header','标题'].includes(node.name))return `<section class="of-title-section">${body}</section>`;
  if(['ending','epilogue','afterword','结尾','尾声'].includes(node.name))return `<section class="of-ending-section">${body}</section>`;
  if(['content','story','scene','正文'].includes(node.name))return `<section class="of-story-section">${body}</section>`;
  return `<details class="of-extra-section" data-section-key="${escape(id+':'+sectionNumber++)}"><summary>${escape(label)}</summary>${body}</details>`;
 }).join('');
 return {html:visit(tree.children),frames,groups};
}
root.KissOfflineRich={parse,choicesFromText,layout,render:(value,options)=>layout(value,options).html};
})(window);
