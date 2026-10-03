/* Pure helpers shared by both chat surfaces and the data inspector. */
(function (root) {
'use strict';
const norm = s => String(s || '').toLowerCase().normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '');
function score(query, name) {
  const q=norm(query), n=norm(name); if(!q || !n)return 0;
  if(q===n)return 1;
  if(q.includes(n)||n.includes(q))return Math.min(.94,.55+Math.min(q.length,n.length)/Math.max(q.length,n.length)*.4);
  if(q.length<3 || n.length<3)return 0;
  const pairs=s=>new Set(Array.from({length:s.length-1},(_,i)=>s.slice(i,i+2)));
  const a=pairs(q),b=pairs(n);return 2*[...a].filter(x=>b.has(x)).length/(a.size+b.size);
}
function matches(query,pool,limit=8){return pool.map((s,i)=>({s,i,score:score(query,s.name)})).filter(x=>x.score>=.58).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,limit).map(x=>x.s);}
function resolve(query,pool,enabled){const exact=pool.find(s=>s.name===query);if(exact || !enabled)return exact;const ranked=pool.map(s=>({s,score:score(query,s.name)})).sort((a,b)=>b.score-a.score);return norm(query).length>=3 && norm(ranked[0]?.s.name).length>=3 && ranked[0]?.score>=.8 && (!ranked[1] || ranked[0].score-ranked[1].score>.12)?ranked[0].s:undefined;}
const catalog = {
 thought:['已生成思维链','仅删除历史思考消息，保留思维链规则',false],
 cot:['思维链规则 / 预设','清除后会影响生成方式',true],
 chat404:['404 文字聊天','删除文字、引用等消息；语音、图片和表情另列',true],
 media404:['404 图片消息','删除整条图片消息',true],
 video404:['404 视频消息','删除整条视频消息',true],
 voice404:['404 语音消息','删除语音消息及附带文本',true],
 cards404:['404 卡片 / 转账 / 礼物','删除对应卡片消息',true],
 sticker404:['404 表情包消息','删除已发送的表情包消息，保留表情包库',true],
 calls:['通话记录','删除通话历史',true],
 memories:['记忆总结 / 回忆日记','清除后会影响角色记忆',true],
 persona:['角色人设','清空角色的 persona，保留联系人身份',true],
 userpersona:['用户人设 / 预设','清除后会影响角色对你的认识',true],
 world:['世界书','清除设定条目，会影响对话',true],
 stickers:['表情包库','删除上传的表情包，已发送消息另列',false],
 status:['状态栏 / 预设 / 历史','清空状态栏内容与配置',true],
 beauty:['CSS / 主题 / 美化预设','清除保存的外观样式',false],
 images:['壁纸 / 头像 / 图标','清除保存的图片与图片地址',false],
 gallery:['角色相册','清除相册图片',false],
 fonts:['字体 / 字体预设','清除字体文件与字体设置',false],
 audio:['提示音 / 音频数据','清除自定义提示音',false],
 widgets:['桌面 / 小组件','清除小组件模板、实例、桌面布局',false],
 workshop:['绘图工坊 / 生图数据','清除生图历史及绘图配置',false],
 books:['阅读器 / 书籍 / 段评','删除书籍、章节、段评与阅读数据',false],
 chatHU:['HearU 文字聊天','删除 HearU 独立聊天消息',true],
 mediaHU:['HearU 表情包消息','删除 HearU 已发送的表情包消息',true],
 cardsHU:['HearU 歌曲分享卡片','删除已发送的分享卡，不删除歌单',true],
 music:['HearU 当前歌曲 / 播放状态','清除本地歌曲与播放状态',false],
 queueHU:['HearU 待播列表','清除本地待播列表',false],
 playlistsHU:['HearU 收藏 / 专属歌单','清除本地音乐收藏，不删除网易云歌单',true],
 lyricsHU:['HearU 歌词 / 翻译','清除已保存的歌词与翻译',false],
 errors:['错误日志 / 调试记录','删除本地错误日志',false],
 account:['API / 登录凭证','清除后需重新设置 API 或重新登录',true],
 preferences:['其他设置 / 数据','按下方明细清除；未知类型单独保留名称',true],
 structure:['结构 / 索引','记录 ID、数组结构等；保留以保障应用正常',false]
};
function fieldCategory(key,scope){
 if(/^(id|key|activeArchiveId|createdAt|updatedAt|origin|listed|realName|remarkName|name|myName|members|me|timestamp)$/.test(key))return 'structure';
 if(/worldBook/i.test(key))return 'world';
 if(/persona/i.test(key))return /my|user|active/i.test(key)?'userpersona':'persona';
 if(/summar|memoryJournal|memories|memorySummary/i.test(key))return 'memories';
 if(/cot/i.test(key))return 'cot';
 if(/status/i.test(key))return 'status';
 if(/css|theme|bubble/i.test(key))return 'beauty';
 if(/avatar|wallpaper|background|cardBg|customIcons|banner/i.test(key))return 'images';
 if(/gallery|photos/i.test(key))return 'gallery';
 if(/font/i.test(key))return 'fonts';
 if(/sound|audio/i.test(key))return 'audio';
 if(/widget|homeLayout|homePreset|insWidget|homeWidget/i.test(key))return 'widgets';
 if(/workshop|vibe/i.test(key))return 'workshop';
 if(/reader|book/i.test(key))return 'books';
 if(/error|log/i.test(key))return 'errors';
 if(/api|credential|cookie|account/i.test(key))return 'account';
 if(scope==='hu'){if(/queue/i.test(key))return 'queueHU';if(/librar|playlist/i.test(key))return 'playlistsHU';if(/lyric|translation/i.test(key))return 'lyricsHU';if(/song|position|repeat|shuffle/i.test(key))return 'music';}
 if(/callHistory/i.test(key))return 'calls';
 return 'preferences';
}
function byteSize(v){if(v instanceof Blob)return v.size;if(v instanceof ArrayBuffer)return v.byteLength;if(ArrayBuffer.isView(v))return v.byteLength;let n=new TextEncoder().encode(JSON.stringify(v)??'').length;function extra(x){if(x instanceof Blob)return x.size;if(x instanceof ArrayBuffer||ArrayBuffer.isView(x))return x.byteLength;if(x && typeof x==='object')return Object.values(x).reduce((a,b)=>a+extra(b),0);return 0;}return n+extra(v);}
function reset(v){return Array.isArray(v)?[]:v instanceof Blob?'':v && typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,reset(x)])):typeof v==='boolean'?false:typeof v==='number'?0:'';}
function recordUnits(record,scope,label){
 const units=[];
 function fields(obj,path,prefix){
  for(const [key,value] of Object.entries(obj)){
   const p=[...path,key];
   if((key==='history'||key==='messages') && Array.isArray(value)){
    value.forEach((m,i)=>{let cat;
     const content=String(m.content||'');
     if(m.isThinking || /^\s*<thinking>/.test(content))cat='thought';
     else if(m.sticker||m.stickerData||/表情包[：:]/.test(content))cat=scope==='hu'?'mediaHU':'sticker404';
     else if(scope==='hu' && m.card)cat='cardsHU';
     else if(scope!=='hu' && (m.type==='voice'||m.isVoice||/的语音[：:]/.test(content)))cat='voice404';
     else if(scope!=='hu' && (m.type==='video'||/data:video/.test(content)))cat='video404';
     else if(scope!=='hu' && (m.type==='image'||m.parts?.some(p=>p.type==='image')||/照片\/视频|发来的照片|data:image/.test(content)))cat='media404';
     else if(scope!=='hu' && /转账|礼物|红包|pvcard|transfer|gift|red-packet/.test(m.type||content.slice(0,80)))cat='cards404';
     else cat=scope==='hu'?'chatHU':'chat404';
     units.push({path:[...p,i],cat,value:m,label:prefix+' / '+key+' #'+(i+1),remove:true});});
    continue;
   }
   if(key==='archives' && Array.isArray(value)) {value.forEach((a,i)=>{
    for(const [ak,av] of Object.entries(a)){if(ak==='data' && av && typeof av==='object')fields(av,[...p,i,ak],prefix+' / 存档 '+(a.name||i));else units.push({path:[...p,i,ak],cat:'structure',value:av,label:prefix+' / 存档结构'});}
   });continue;}
   units.push({path:p,cat:fieldCategory(key,scope),value,label:prefix+' / '+key});
  }
 }
 fields(record,[],label);return units;
}
function cleanRecord(record,units,selected){
 const copy=structuredClone(record),deletions=[];
 for(const u of units){if(!selected.has(u.cat)||u.cat==='structure')continue;if(u.remove){deletions.push(u.path);continue;}let node=copy;for(const k of u.path.slice(0,-1))node=node[k];node[u.path.at(-1)]=reset(u.value);}
 // Reverse indices within each array, so deleting one message cannot shift another target.
 deletions.sort((a,b)=>JSON.stringify(a.slice(0,-1)).localeCompare(JSON.stringify(b.slice(0,-1))) || b.at(-1)-a.at(-1));
 for(const p of deletions){let node=copy;for(const k of p.slice(0,-1))node=node[k];node.splice(p.at(-1),1);}return copy;
}
root.KissToolsCore={score,matches,resolve,catalog,fieldCategory,byteSize,recordUnits,cleanRecord,reset};
})(typeof window==='undefined'?globalThis:window);
