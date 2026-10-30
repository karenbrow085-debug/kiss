/* Narrative labels are text, while HTML continues through the sandbox viewer. */
(function(root){
const labels={title:'标题',heading:'标题',ending:'结尾',epilogue:'尾声',afterword:'后记',theater:'小剧场',small_theater:'小剧场',smalltheater:'小剧场',omake:'小剧场',branches:'小剧场',branch:'分支',meow_fm:'小剧场',summary:'本轮摘要',options:'后续选项',content:'正文',story:'正文',scene:'场景'};
function render(value,{escape,paragraph,partition,html}){
 const markdown=text=>String(text).split(/\n{2,}/).map(block=>{const heading=/^\s*(#{1,6})\s+([^\n]+)\s*$/.exec(block);if(heading)return '<h3 class="of-narrative-heading">'+escape(heading[2])+'</h3>';if(/^>\s/m.test(block))return '<blockquote>'+paragraph(block.replace(/^>\s?/gm,''))+'</blockquote>';if(/^\s*[-*]\s/m.test(block))return '<ul>'+block.split('\n').map(line=>'<li>'+paragraph(line.replace(/^\s*[-*]\s/,''))+'</li>').join('')+'</ul>';return paragraph(block);}).join('');
 const section=(text,depth=0)=>{if(depth>16)return markdown(text);const re=/<(\/?)([a-zA-Z_\u3400-\u9fff][\w\u3400-\u9fff-]*)(?:\s[^<>]*)?>/g;let at=0,out='',match;while((match=re.exec(text))){out+=markdown(text.slice(at,match.index));if(match[1]){at=re.lastIndex;continue;}const name=match[2],close=new RegExp('</'+name+'\\s*>','ig');close.lastIndex=re.lastIndex;const end=close.exec(text),stop=end?end.index:text.length,body=text.slice(re.lastIndex,stop);out+='<section class="of-narrative-section"><div class="of-section-label">'+escape(labels[name.toLowerCase()]||name.replace(/[_-]/g,' '))+'</div>'+section(body,depth+1)+'</section>';at=end?close.lastIndex:text.length;re.lastIndex=at;}return out+markdown(text.slice(at));};
 let index=0;return partition(String(value??'')).map(p=>p.type==='html'?html(p.text,index++):section(p.text)).join('');
}
root.KissOfflineRich={render};
})(window);
