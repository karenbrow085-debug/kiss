/* Forum UI edition: original forum prompts retained; DM additions isolated. */
(function () {
'use strict';
if(window.ForumApp?.edition==='ins-monochrome-v1')return;
const ForumApp = window.ForumApp = {edition:'ins-monochrome-v1', name:'MONO'};
const hostClosePage=window.closePage;
function closePage(id) {
  if(id!=='forumPage' && typeof hostClosePage==='function')return hostClosePage(id);
  const page=document.getElementById(id);if(page){page.hidden=true;page.style.display='none';}
}
// Read-only compatibility views. Returned character objects are copies.
function forumReadView(c={}) {
  // Only fields used by MONO's forum UI/persona reader; never clone host chat history here.
  const keys=['id','name','remarkName','realName','description','persona','systemPrompt','avatar','charName','worldBookIds','status','myName','myPersona'];
  const view={};for(const k of keys)if(c[k]!==undefined)view[k]=structuredClone(c[k]);
  view.name=c.name||c.remarkName||c.realName||'角色';view.description=c.description||c.persona||'';return Object.freeze(view);
}
const characters=new Proxy([], {get(target,key){const list=forumNativeCharacters().map(forumReadView);const value=list[key];return typeof value==='function'?value.bind(list):value;}});
const chatSettings=new Proxy({}, {get(target,key){return forumReadView(forumCharacter(key)||window.chatSettings?.[key]||{});}});
function forumApiEndpoint(config) {
  const base=String(config?.url||'').trim().replace(/\/+$/,'');
  let parsed;try{parsed=new URL(base);}catch{throw Error('API地址无效，请填写完整的 https:// 地址');}
  if(!['https:','http:'].includes(parsed.protocol))throw Error('API地址必须使用 http 或 https');
  if(config.provider==='gemini') {
    if(/:generateContent$/.test(parsed.pathname))return base;
    parsed.pathname=parsed.pathname.replace(/\/v1(?:beta)?\/?$/,'').replace(/\/$/,'')+'/v1beta/models/'+encodeURIComponent(config.model)+':generateContent';
    parsed.searchParams.set('key',config.key);return parsed.href;
  }
  if(/\/chat\/completions\/?$/.test(parsed.pathname))return base;
  parsed.pathname=parsed.pathname.replace(/\/$/,'')+(/\/v\d+(?:beta)?$/.test(parsed.pathname)?'/chat/completions':'/v1/chat/completions');
  return parsed.href;
}
function forumCleanStructured(raw) {
  const text=String(raw||'');if(text.length>250000)throw Error('生成结果过长，无法安全解析');
  if(/<(thinking|think|analysis|reasoning)\b[^>]*>(?![\s\S]*?<\/\1\s*>)/i.test(text))throw Error('模型思考内容尚未结束，未收到完整正文，请重试');
  return text.replace(/<(thinking|think|analysis|reasoning)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/```(?:json)?/gi,'').replace(/^\uFEFF/,'').trim();
}
function forumRepairJson(text) {
  let out='',quoted=false,escaped=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(escaped){out+=c;escaped=false;}else if(c==='\\'){out+=c;escaped=true;}else if(c==='"'){out+=c;quoted=false;}else if(c==='\n')out+='\\n';else if(c==='\r')out+='\\r';else if(c==='\t')out+='\\t';else out+=c;}
    else {if(c==='"'){quoted=true;out+=c;}else if(c===','){let j=i+1;while(/\s/.test(text[j]||'')&&j<text.length)j++;if(text[j]!==']'&&text[j]!=='}')out+=c;}else out+=c;}
  }return out;
}
function forumStructuredValue(raw) {
  const text=forumCleanStructured(raw),parse=t=>JSON.parse(forumRepairJson(t));
  try{return parse(text);}catch{}
  const stack=[],complete=[];let quote=false,escape=false,start=-1;
  for(let i=0;i<text.length;i++){
    const c=text[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quote=false;continue;}
    if(c==='"'&&stack.length){quote=true;continue;}
    if(c==='{'||c==='['){if(!stack.length)start=i;stack.push({c,start:i});}
    else if((c==='}'||c===']')&&stack.length){const top=stack.at(-1);if((c==='}'&&top.c!=='{')||(c===']'&&top.c!=='[')){stack.length=0;start=-1;continue;}stack.pop();const fragment=text.slice(top.start,i+1);if(!stack.length){try{return parse(fragment);}catch{}}if(top.c==='{'&&stack.length===1&&stack[0].c==='['){try{complete.push(parse(fragment));}catch{}}}
  }
  // A truncated final item is discarded; completed top-level array objects are preserved.
  if(complete.length)return complete;
  throw Error('未能读取完整的生成数据；模型可能返回了说明文字或截断结果，请重试');
}
function forumParseArray(raw,keys=['posts','comments','messages','data','results']) {
  const value=forumStructuredValue(raw);if(Array.isArray(value))return value.filter(v=>v&&typeof v==='object'&&!Array.isArray(v));
  for(const k of keys)if(Array.isArray(value?.[k]))return value[k].filter(v=>v&&typeof v==='object'&&!Array.isArray(v));
  if(value&&typeof value==='object'&&('authorName'in value||'senderName'in value||'content'in value))return [value];
  throw Error('模型返回的数据缺少帖子或评论列表，请重试');
}
async function fetch(url,options={}) {
  const endBusy=monoGenerationStart('正在生成');
  const controller=options.signal?null:new AbortController(),signal=options.signal||controller.signal;
  const timer=controller?setTimeout(()=>controller.abort(),90000):null;
  let geminiAdapter=false;
  try {
    let body;try{body=typeof options.body==='string'?JSON.parse(options.body):null;}catch{}
    if(body?.messages&&String(url).includes(':generateContent')) {
      geminiAdapter=true;const system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
      const adapted={contents:body.messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:String(m.content||'')}]})),generationConfig:{temperature:body.temperature??0.9}};
      if(system)adapted.systemInstruction={parts:[{text:system}]};if(body.max_tokens)adapted.generationConfig.maxOutputTokens=body.max_tokens;
      options={...options,headers:{'Content-Type':'application/json'},body:JSON.stringify(adapted)};
    }
    const response=await window.fetch(url,{...options,signal});
    const read=typeof response.text==='function'?()=>response.text():()=>response.json();
    let cached;
    const json=()=>cached ||= (async()=>{
      let readTimer;let raw;
      try{raw=await Promise.race([read(),new Promise((_,reject)=>{readTimer=setTimeout(()=>{controller?.abort();reject(Error('读取生成结果超时，请重试'));},90000);})]);}finally{clearTimeout(readTimer);}
      let data=raw;
      if(typeof raw==='string'){
        if(/^\s*(?:<!doctype\s+html|<html\b|<head\b|<body\b)/i.test(raw))throw Error('接口返回了网页而非生成数据，请检查API地址或服务状态'+(response.status?'（HTTP '+response.status+'）':''));
        try{data=JSON.parse(raw);}catch{
          if(/^\s*data:/m.test(raw)){
            let content='',finish=null;for(const line of raw.split(/\r?\n/)){if(!line.startsWith('data:'))continue;const chunk=line.slice(5).trim();if(!chunk||chunk==='[DONE]')continue;try{const d=JSON.parse(chunk);content+=d.choices?.[0]?.delta?.content||'';finish=d.choices?.[0]?.finish_reason||finish;}catch{}}
            if(content)data={choices:[{message:{content},finish_reason:finish}]};else throw Error('接口返回了空的流式结果，请重试');
          }else throw Error('API返回的内容不是有效数据，请检查接口服务');
        }
      }
      if(data?.error){const reason=String(data.error.message||data.error);if(/PROHIBITED_CONTENT|SAFETY|blocked by Gemini/i.test(reason))throw Error('Gemini 拦截了本次生成，原有内容已保留。请检查输入内容或更换已配置的模型后重试。');throw Error('API请求失败：'+reason.slice(0,180));}
      if(geminiAdapter){const candidate=data.candidates?.[0];const content=candidate?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('');if(!content){const reason=data.promptFeedback?.blockReason||candidate?.finishReason;if(/SAFETY|PROHIBITED|BLOCK/i.test(reason||''))throw Error('Gemini 拦截了本次生成，原有内容已保留。请检查输入内容或更换已配置的模型后重试。');throw Error('接口未返回正文'+(reason?'：'+reason:''));}return {choices:[{message:{content},finish_reason:candidate.finishReason==='MAX_TOKENS'?'length':'stop'}]};}
      return data;
    })().finally(endBusy);
    if(!response.ok){await json();throw Error('API请求失败（HTTP '+response.status+'）');}
    return {ok:response.ok,status:response.status,headers:response.headers,json};
  } catch(e){endBusy();if(e.name==='AbortError'&&!options.signal)throw Error('生成请求超时，请稍后重试');throw e;}finally{clearTimeout(timer);}
}
const localforage=window.localforage || forumOwnStorage();
function forumOwnStorage() {
  let database;const ready=new Promise((resolve,reject)=>{const req=indexedDB.open('ForumApp-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('kv');req.onsuccess=()=>{database=req.result;resolve();};req.onerror=()=>reject(req.error);});
  function op(key,value,write){return ready.then(()=>new Promise((resolve,reject)=>{const tx=database.transaction('kv',write?'readwrite':'readonly'),store=tx.objectStore('kv'),req=write?store.put(value,key):store.get(key);tx.oncomplete=()=>resolve(write?value:req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error || Error('论坛存储失败'));}));}
  return {getItem:key=>op(key,null,false),setItem:(key,value)=>op(key,structuredClone(value),true)};
}
// ==================== 论坛App ====================

// 论坛数据
let forumSettings = {
  worldview: "", // 世界观设定
  forumName: "", // 论坛名称
  followedUsers: [], 
  userAvatar: "",
  userIdentity: "", // 用户在论坛的身份
  userNickname: "", // 用户在论坛的昵称
  userHandle: "", // 用户的@ID
  userBio: "", // 个人介绍
  userBanner: "", // 背景图
  userFollowing: 0, // 关注数
  userFollowers: 0, // 粉丝数
  userJoinDate: "", // 加入时间
  aiParticipants: [], // AI参与者列表 [{ charId, identity, nickname, avatar, handle }]
  npcs: [], // NPC列表 [{ id, name, handle, avatar, identity, persona }]
  relationships: [], // 关系列表 [{ id, person1Type, person1Id, person2Type, person2Id, relationship, description }]
  worldbookIds: [], // 绑定的世界书ID列表
};

// 默认头像SVG（灰色背景+白色人形）
const DEFAULT_AVATAR_SVG = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" fill="#CFD9DE"/>
  <circle cx="24" cy="18" r="8" fill="white"/>
  <ellipse cx="24" cy="42" rx="14" ry="12" fill="white"/>
</svg>`;

// 获取默认头像的Data URL
function getDefaultAvatarDataUrl() {
  return 'data:image/svg+xml,' + encodeURIComponent(DEFAULT_AVATAR_SVG);
}

let forumPosts = []; // 帖子列表
let currentForumPostId = null; // 当前查看的帖子ID
let forumComposeAuthor = null; // 发帖时选择的作者
let forumReplyTarget = null; // 回复目标 { commentId, authorName }
let currentForumTab = 'recommend'; // 当前tab: 'recommend' 或 'following'
let forumPresets = [];

// ==================== 初始化 ====================

async function initForumApp() {
  // 强制移除forumPage的padding（覆盖style.css的.page样式）
  const forumPage = document.getElementById('forumPage');
  if (forumPage) {
    forumPage.style.padding = '0';
    forumPage.style.margin = '0';
  }
  
  const savedPresets = await localforage.getItem("forumPresets");
  if (savedPresets) {
    forumPresets = savedPresets;
  }

  // 加载保存的数据
  const savedSettings = await localforage.getItem("forumSettings");
  if (savedSettings) {
    forumSettings = { ...forumSettings, ...savedSettings };
  }

  const savedPosts = await localforage.getItem("forumPosts");
  if (savedPosts) {
    forumPosts = savedPosts;
  }

  await monoLoadAccounts();
  // 渲染论坛主页
  renderForumPage();

  console.log("[论坛] 初始化完成");
}

// ==================== [核心重构] 身份与评论关系严格解析器 ====================

// 1. 严格身份解析器：杜绝模糊包含，仅限完全等值匹配
function resolveAuthorIdentity(rawName) {
  const name = (rawName || "").trim();
  const cleanName = name.toLowerCase();
  const globalChars = typeof characters !== 'undefined' ? characters : (window.characters || []);
  const aiParticipants = forumSettings.aiParticipants || [];
  const npcs = forumSettings.npcs || [];

  // 先匹配 AI 角色
  const matchedAI = aiParticipants.find(p => {
    const char = globalChars.find(ch => String(ch.id) === String(p.charId));
    const pName = (p.nickname || char?.name || '').trim().toLowerCase();
    return pName && cleanName === pName;
  });

  if (matchedAI) {
    const char = globalChars.find(c => String(c.id) === String(matchedAI.charId));
    return {
      type: "ai",
      id: matchedAI.charId,
      name: matchedAI.nickname || char?.name || name,
      avatar: matchedAI.avatar || char?.avatar || ''
    };
  }

  // 再匹配 NPC
  const matchedNPC = npcs.find(n => n.name && cleanName === n.name.trim().toLowerCase());
  if (matchedNPC) {
    return {
      type: "npc",
      id: matchedNPC.id,
      name: matchedNPC.name,
      avatar: matchedNPC.avatar || ''
    };
  }

  // 兜底为普通路人
  return {
    type: "npc",
    id: null,
    name: name,
    avatar: ""
  };
}

// 2. 闭环关系连线器：两阶段无冲突 ID 分配与引用查找 (带 AI 评论硬限防护)
function mapAndResolveComments(newComments, post) {
  if (!Array.isArray(newComments)) return [];
  
  const postComments = post.comments || [];
  const baseId = postComments.reduce((max, com) => Math.max(max, Number(com.id) || 0), 0);
  const myName = (forumSettings.userNickname || "用户").trim().toLowerCase();

  // 记录当前批次中每个 AI 角色的评论计数
  const aiCommentCounts = {};

  // Phase 1: 安全生成独立物理 ID 并精准匹配发布人
  const mapped = newComments
    .filter(c => {
      // 严格过滤掉代指用户的生成
      const cName = (c.authorName || "").trim().toLowerCase();
      return c.authorType !== 'user' && cName !== 'user' && !(cName === myName && !['ai','npc'].includes(c.authorType));
    })
    .map((c, idx) => {
      const auth = resolveAuthorIdentity(c.authorName,c);
      return {
        auth: auth,
        originalComment: c,
        idx: idx // 记录在 AI 原始数组中的索引，确保过滤后 tempIdx 对应关系不断联
      };
    })
    .filter(item => {
      // ★★★ 核心修复：防刷屏过滤器。单次生成中，每个 AI 角色最多只允许保留 2 条评论 ★★★
      if (item.auth.type === 'ai') {
        const aiName = item.auth.name;
        aiCommentCounts[aiName] = (aiCommentCounts[aiName] || 0) + 1;
        
        if (aiCommentCounts[aiName] > 2) {
          console.log(`[论坛安全防护] 过滤掉 AI 角色 [${aiName}] 的第 ${aiCommentCounts[aiName]} 条多余评论，避免评论区刷屏。`);
          return false; // 抛弃该条多余评论
        }
      }
      return true;
    })
    .map((item, idx) => {
      const c = item.originalComment;
      const auth = item.auth;
      return {
        id: baseId + idx + 1,
        tempIdx: item.idx + 1, // 映射到原始数组序号，供 Phase 2 引用关系查找
        authorType: auth.type,
        authorId: auth.id,
        authorName: auth.name,
        authorAvatar: auth.avatar,
        handle: c.handle || generateEnglishHandle(auth.name),
        content: c.content || "",
        likes: c.likes || 0,
        views: c.views == null ? undefined : Number(c.views),
        monoViewsProvided: c.views != null,
        monoChineseTranslation: c.translation || c.chineseTranslation || "",
        liked: false,
        timestamp: Date.now() + idx * 1000,
        _aiReplyTo: c.replyTo || null,
        _aiReplyToName: (c.replyToName || "").trim()
      };
    });

  // Phase 2: 安全闭环关系链连接
  mapped.forEach(c => {
    let resolvedId = null;
    let resolvedName = null;

    if (c._aiReplyTo || c._aiReplyToName) {
      let parent = null;
      
      // A. 优先检索“当前批次”中生成的相邻评论（防断联）
      if (c._aiReplyToName) {
        parent = mapped.find(other => 
          other.authorName.toLowerCase() === c._aiReplyToName.toLowerCase() && 
          other.id !== c.id
        );
      }
      if (!parent && c._aiReplyTo) {
        const idxVal = Number(c._aiReplyTo);
        parent = mapped.find(other => 
          other.tempIdx === idxVal && 
          other.id !== c.id
        );
      }

      if (parent) {
        resolvedId = parent.id;
        resolvedName = parent.authorName;
      } else {
        // B. 次优先检索数据库中“历史已有”的评论
        let oldParent = null;
        if (c._aiReplyToName) {
          oldParent = postComments.find(old => 
            old.authorName.toLowerCase() === c._aiReplyToName.toLowerCase()
          );
        }
        if (oldParent) {
          resolvedId = oldParent.id;
          resolvedName = oldParent.authorName;
        }
      }
    }

    c.replyTo = resolvedId;
    c.replyToName = resolvedName;

    // 清洗掉过程临时属性，绝不污染最终存储的数据
    delete c.tempIdx;
    delete c._aiReplyTo;
    delete c._aiReplyToName;
  });

  return mapped;
}

// ★★★ 新增：超级头像查找函数 (修复头像不显示 & 修复 characters 报错) ★★★
function findBestAvatar(name, fallbackAvatar, record) {
  if(record){
    if(record.authorType==='user')return forumSafeImage((monoOwnPost(record)?forumSettings.userAvatar:record.authorAvatar)||fallbackAvatar||getDefaultAvatarDataUrl());
    const resolved=resolveAuthorIdentity(name,record);return forumSafeImage(resolved.avatar||((record.authorType==='npc'||record.authorType==='random')?'':fallbackAvatar)||getDefaultAvatarDataUrl());
  }
  if (!name) return getDefaultAvatarDataUrl();
  const cleanName = name.trim().toLowerCase();
  const globalChars = typeof characters !== 'undefined' ? characters : (window.characters || []); 

  // 1. 精确匹配 AI 参与者
  const aiParticipants = forumSettings.aiParticipants || [];
  for (const p of aiParticipants) {
    if (p.nickname && p.nickname.trim().toLowerCase() === cleanName) {
      if (p.avatar) return p.avatar;
    }
    const char = globalChars.find(c => String(c.id) === String(p.charId));
    if (char && char.name && char.name.trim().toLowerCase() === cleanName) {
       return p.avatar || char.avatar || getDefaultAvatarDataUrl();
    }
  }

  // 2. 精确匹配 NPC 列表
  const npcs = forumSettings.npcs || [];
  for (const npc of npcs) {
    if (npc.name && npc.name.trim().toLowerCase() === cleanName) {
      if (npc.avatar) return npc.avatar;
    }
  }

  // 3. 匹配“我”
  const myName = (forumSettings.userNickname || '').trim().toLowerCase();
  if (cleanName === myName || cleanName === '我' || cleanName === '用户') {
      return monoAvatarFallback() || getDefaultAvatarDataUrl();
  }

  // 4. 自带 Base64 回退
  if (fallbackAvatar && fallbackAvatar.length > 50) {
    return fallbackAvatar;
  }

  // 5. 全局角色池兜底捞
  const fallbackChar = globalChars.find(c => c.name && c.name.trim().toLowerCase() === cleanName);
  if (fallbackChar && fallbackChar.avatar) {
      return fallbackChar.avatar;
  }

  return getDefaultAvatarDataUrl();
}

// ==================== 渲染主页 (全屏沉浸版 - 修复版) ====================

function renderForumPage() {
  const container = document.getElementById("forumPageContent");
  if (!container) return;

  // 渲染页面结构：包含主容器、顶栏、底栏，以及【修复关键】：缺失的弹窗层
  container.innerHTML = `
    <div class="forum-container">
      <div class="forum-tabs">
        <button class="forum-nav-back forum-back-btn" onclick="ForumApp.closePage('forumPage')">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </button>
        
        <div class="forum-tab forum-home-tab active" onclick="ForumApp.switchForumTab('recommend')">推荐</div>
        <div class="forum-tab forum-home-tab" onclick="ForumApp.switchForumTab('following')">关注</div>
        
        <div class="forum-hot-title" style="display:none;">热点</div>
        
        <button class="forum-nav-back forum-settings-btn" onclick="ForumApp.openForumSettings()" style="margin-right:0;" title="设置">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>
        </button>
      </div>
      
      <div class="forum-feed" id="forumFeed"></div>
      
      <nav class="forum-bottom-nav" aria-label="论坛导航">
        <button class="forum-nav-item active" data-section="home" aria-label="首页" onclick="ForumApp.switchForumSection('home')">${forumIcon('home')}</button>
        <button class="forum-nav-item" data-section="hot" aria-label="搜索与热点" onclick="ForumApp.switchForumSection('hot')">${forumIcon('search')}</button>
        <button class="forum-nav-item" data-section="compose" aria-label="发帖" onclick="ForumApp.openForumCompose()">${forumIcon('plusSquare')}</button>
        <button class="forum-nav-item" data-section="dm" aria-label="私信" onclick="ForumApp.switchForumSection('dm')">${forumIcon('mail')}</button>
        <button class="forum-nav-item" data-section="profile" aria-label="我的主页" onclick="ForumApp.switchForumSection('profile')"><img class="forum-nav-avatar" src="${forumSafeImage(forumSettings.userAvatar || monoAvatarFallback()) || getDefaultAvatarDataUrl()}" alt="我的主页"></button>
      </nav>

      <!-- ============================================== -->
      <!-- ★★★ 修复开始：补全缺失的弹窗层 HTML ★★★ -->
      <!-- ============================================== -->

      <!-- 1. 设置弹窗 (之前就是缺了这个导致没反应) -->
      <div id="forumSettingsOverlay" class="forum-settings-overlay">
         <div class="forum-settings-header">
            <button class="forum-settings-back" onclick="ForumApp.closeForumSettings()">
               <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            </button>
            <div class="forum-settings-title">论坛设置</div>
            <div style="width:36px"></div>
         </div>
         <div class="forum-settings-content" id="forumSettingsContent"></div>
      </div>

      <!-- 2. 发帖弹窗 -->
      <div id="forumComposeOverlay" class="forum-compose-overlay">
         <div class="forum-compose-header">
            <button class="forum-compose-cancel" onclick="ForumApp.closeForumCompose()">取消</button>
            <div class="forum-compose-title">发帖</div>
            <button class="forum-compose-submit" onclick="ForumApp.submitForumPost()">发布</button>
         </div>
         <div class="forum-compose-body">
            <div id="forumComposeUserInfo"></div>
            <textarea class="forum-compose-textarea" id="forumComposeTextarea" placeholder="有什么新鲜事？"></textarea>
            <div class="forum-compose-images" id="forumComposeImages"></div>
            <div class="forum-compose-toolbar">
               <button class="forum-compose-tool-btn" onclick="document.getElementById('forumComposeImageInput').click()">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
               </button>
               <input type="file" id="forumComposeImageInput" accept="image/*" multiple style="display:none" onchange="ForumApp.handleComposeImageUpload(this)">
            </div>
         </div>
      </div>

      <!-- 3. 帖子详情弹窗 -->
      <div id="forumDetailOverlay" class="forum-detail-overlay">
         <div class="forum-detail-header">
            <button class="forum-detail-back" onclick="ForumApp.closeForumPostDetail()">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            </button>
            <div class="forum-detail-title">帖子</div>
            <div style="width:36px"></div>
         </div>
         <div id="forumDetailContent" style="flex:1; overflow-y:auto;"></div>
         <div id="forumReplyIndicator" style="display:none; padding:8px 16px; background:#f7f9f9; font-size:12px; color:#536471; align-items:center; border-top:1px solid #eff3f4;"></div>
         <div class="forum-comment-bar">
            <input type="text" class="forum-comment-input" id="forumCommentInput" placeholder="写评论...">
            <button class="forum-comment-send" onclick="ForumApp.submitForumComment()">发送</button>
         </div>
      </div>

    </div>
  `;

  renderForumFeed();
}

// 渲染信息流 (完整版：保留所有UI逻辑 + 关注列表过滤)
function renderForumFeed() {
  const container = document.getElementById("forumFeed");
  if (!container) return;

  // 1. 确保顶栏和FAB显示（从个人主页返回时可能被隐藏）
  const tabs = document.querySelector('.forum-tabs');
  const fab = document.querySelector('.forum-fab');
  if (tabs) tabs.style.display = 'flex';
  if (fab) fab.style.display = 'flex';
  
  // 2. 恢复safe area padding（从个人主页返回时）
  const forumContainer = document.querySelector('.forum-container');
  if (forumContainer) forumContainer.style.paddingTop = '';
  
  // 3. 显示主页的返回按钮、tab和设置按钮，隐藏热点标题
  const backBtn = document.querySelector('.forum-back-btn');
  const homeTabs = document.querySelectorAll('.forum-home-tab');
  const hotTitle = document.querySelector('.forum-hot-title');
  const settingsBtn = document.querySelector('.forum-settings-btn');
  if (backBtn) backBtn.style.display = 'flex';
  homeTabs.forEach(tab => tab.style.display = 'flex');
  if (hotTitle) hotTitle.style.display = 'none';
  if (settingsBtn) settingsBtn.style.display = 'flex';
  
  // 更新当前section状态
  window.currentForumSection = 'home';

  // 4. 检查是否已设置世界观
  if (!forumSettings.worldview) {
    container.innerHTML = `
      <div class="forum-empty">
        <div class="forum-empty-text">还没有设置世界观<br>先设置论坛的世界观和你的身份吧</div>
        <button class="forum-empty-btn" onclick="ForumApp.openForumSettings()">去设置</button>
      </div>
    `;
    return;
  }

  // 5. 过滤掉搜索结果帖子和他人主页生成的帖子，只显示主页帖子
  let filteredPosts = forumPosts.filter(p => !p.isSearchResult && !p.isProfileGenerated);
  
  // 6. 根据当前tab进一步过滤
  if (currentForumTab === 'following') {
    // ============================================================
    // ★★★ 核心修改：关注页过滤逻辑 (基于 followedUsers) ★★★
    // ============================================================
    const followed = forumSettings.followedUsers || [];

    if (followed.length === 0) {
        // 如果没关注任何人，直接清空列表
        filteredPosts = [];
    } else {
        filteredPosts = filteredPosts.filter(p => {
            // 1. 匹配 ID (如果帖子数据里有 authorId)
            if (p.authorId && followed.includes(String(p.authorId))) return true;
            
            // 2. 匹配 名字 (兼容旧数据或路人)
            if (followed.includes(p.authorName)) return true;
            
            // 3. 匹配 AI角色 (防止帖子只有名字没有ID)
            const aiChar = forumSettings.aiParticipants.find(ai => ai.nickname === p.authorName);
            if (aiChar && followed.includes(String(aiChar.charId))) return true;

            // 4. 匹配 NPC
            const npc = (forumSettings.npcs || []).find(n => n.name === p.authorName);
            if (npc && followed.includes(String(npc.id))) return true;

            return false;
        });
    }
    // ============================================================
  }

  // 7. 没有帖子时显示生成按钮
  if (filteredPosts.length === 0) {
    // 修改文案
    const emptyText = currentForumTab === 'following' 
      ? '关注列表暂无动态<br>点击角色头像进入主页即可自动关注'
      : '论坛里还没有帖子<br>点击下方按钮生成一些内容吧';
    
    // 逻辑优化：如果是关注页但没关注任何人，就不显示生成按钮（因为生成了也看不见）
    // 如果是关注页且有关注的人，显示生成按钮
    const hasFollows = (forumSettings.followedUsers && forumSettings.followedUsers.length > 0);
    const showGenBtn = currentForumTab !== 'following' || hasFollows;

    container.innerHTML = `
      <div class="forum-empty">
        <div class="forum-empty-icon"></div>
        <div class="forum-empty-text">${emptyText}</div>
        ${showGenBtn ? `<button class="forum-empty-btn" onclick="ForumApp.generateForumPosts()">生成帖子</button>` : ''}
      </div>
    `;
    return;
  }

  // 8. 渲染帖子列表
  const visible=filteredPosts.slice(0,monoFeedLimit);
  let html = visible.map((post) => renderForumPostItem(post)).join("");
  if(filteredPosts.length>visible.length)html+='<button class="mono-load-more" onclick="ForumApp.monoLoadMore()">加载更多</button>';
  container.innerHTML = html;
}

// 渲染单个帖子 (修复头像版)
function renderForumPostItem(post) {
  const tagHtml = "";
  
  // 强制使用最新昵称
  const displayAuthorName = post.authorType === 'user' && monoOwnPost(post) ? (forumSettings.userNickname || '我') : post.authorName;

  // ★★★ 修复：使用超级查找器获取头像 ★★★
  const realAvatarUrl = findBestAvatar(displayAuthorName, post.authorAvatar, post);
  const avatarContent = `<img src="${realAvatarUrl}" alt="${displayAuthorName}">`;

  // 格式化时间
  const timeStr = formatForumTime(post.timestamp);
  const commentCount = post.comments?.length || 0;
  const handle = post.handle || generateEnglishHandle(post.authorName);
  const views = post.views || Math.floor(Math.random() * 1000) + 50;
  const retweets = post.retweets || 0;
  const contentHtml = formatForumContent(post.content);
  
  let imagesHtml = '';
  if (post.images && post.images.length > 0) {
    const imageCount = post.images.length;
    const gridClass = imageCount === 1 ? 'single' : imageCount === 2 ? 'double' : imageCount === 3 ? 'triple' : 'quad';
    imagesHtml = `
      <div class="forum-post-images ${gridClass}" onclick="event.stopPropagation();">
        ${post.images.map((img, idx) => `
          <div class="forum-post-image-item" onclick="ForumApp.showForumFullImage('${img.replace(/'/g, "\\'")}')">
            <img src="${img}" alt="">
          </div>
        `).join('')}
      </div>
    `;
  }
  
  // 原帖渲染逻辑...
  let originalPostHtml = '';
  if (post.isRetweet && post.originalPost) {
    const orig = post.originalPost;
    // 原帖头像也修复一下
    const origRealAvatar = findBestAvatar(orig.authorName, orig.authorAvatar, orig);
    const origAvatarContent = `<img src="${origRealAvatar}" alt="">`;
    const origHandle = orig.handle || generateEnglishHandle(orig.authorName);
    const origContentHtml = formatForumContent(orig.content);
    
    let origImagesHtml = '';
    if (orig.images && orig.images.length > 0) {
        // ... (原帖图片代码保持不变) ...
        // 为了缩短篇幅，这里保留你原本的图片生成逻辑，略写
        const origImageCount = orig.images.length;
        const origGridClass = origImageCount === 1 ? 'single' : origImageCount === 2 ? 'double' : 'quad';
        origImagesHtml = `<div class="forum-post-images ${origGridClass}" onclick="event.stopPropagation();">${orig.images.slice(0, 4).map(img => `<div class="forum-post-image-item"><img src="${img}"></div>`).join('')}</div>`;
    }
    
    originalPostHtml = `
      <div class="forum-quote-card" onclick="event.stopPropagation(); ForumApp.openForumPostDetail(${orig.id})">
        <div class="forum-quote-header">
          <div class="forum-quote-avatar">${origAvatarContent}</div>
          <span class="forum-quote-name">${escapeForumHtml(orig.authorName)}</span>
          <span class="forum-quote-handle">${origHandle.startsWith('@') ? origHandle : '@' + origHandle}</span>
        </div>
        <div class="forum-quote-content">${origContentHtml}</div>
        ${origImagesHtml}
      </div>
    `;
  }

  return `
    <div class="forum-post" onclick="ForumApp.openForumPostDetail(${post.id})">
      <div class="forum-post-left">
        <div class="forum-post-avatar" onclick="event.stopPropagation(); ForumApp.openOtherUserProfile('${post.authorType}', '${ForumApp.escapeForumHtml(post.authorName)}', '${post.authorId || ''}')">${avatarContent}</div>
      </div>
      
      <div class="forum-post-right">
        <div class="forum-post-header">
          <span class="forum-post-name" onclick="event.stopPropagation(); ForumApp.openOtherUserProfile('${post.authorType}', '${ForumApp.escapeForumHtml(displayAuthorName)}', '${post.authorId || ''}')">${escapeForumHtml(
            displayAuthorName
          )}</span>
          ${tagHtml}
          <div class="forum-post-meta">
            <span>${handle.startsWith('@') ? handle : '@' + handle}</span>
            <span>·</span>
            <span>${timeStr}</span>
          </div>
          ${post.authorType === 'user' ? `
          <button class="forum-post-more-btn" onclick="event.stopPropagation(); ForumApp.showPostMoreMenu(${post.id}, this)" title="更多">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
          </button>
          ` : ''}
        </div>
        
        ${post.content ? `<div class="forum-post-content">${contentHtml}</div>` : ''}
        ${imagesHtml}
        ${originalPostHtml}

        <div class="forum-post-actions">
          <div class="forum-action" onclick="event.stopPropagation(); ForumApp.refreshPostComments(${post.id}, this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            <span>${commentCount || ""}</span>
          </div>
          <div class="forum-action" onclick="event.stopPropagation(); ForumApp.openQuoteRetweet(${post.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"></path><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><path d="M7 23l-4-4 4-4"></path><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
            <span>${retweets || ""}</span>
          </div>
          <div class="forum-action ${post.liked ? "liked" : ""}" onclick="event.stopPropagation(); ForumApp.toggleForumPostLike(${post.id})">
            <svg viewBox="0 0 24 24" fill="${post.liked ? "currentColor" : "none"}" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            <span>${post.likes || ""}</span>
          </div>
          <div class="forum-action" onclick="event.stopPropagation();">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            <span>${views}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==================== 修复：图片查看器挂载到论坛App内部 ====================
function showForumFullImage(imgSrc) {
  const modal = document.createElement('div');
  modal.className = 'forum-fullimage-modal';
  
  // ★★★ 核心修复1：强制提升层级 ★★★
  modal.style.zIndex = "10005";
  modal.style.position = "fixed"; // 确保它是固定的
  
  // 修复关键：阻止事件冒泡
  modal.onclick = (e) => {
    if (e.target === modal || e.target.classList.contains('forum-fullimage-close')) {
      modal.remove();
    }
  };

  modal.innerHTML = `
    <div class="forum-fullimage-content">
      <img src="${imgSrc}" alt="" onclick="event.stopPropagation()">
    </div>
    <button class="forum-fullimage-close">×</button>
  `;

  // ★★★ 核心修复2：挂载到 forumPage ★★★
  const forumPage = document.getElementById('forumPage');
  if (forumPage) {
    forumPage.appendChild(modal);
  } else {
    forumMount(modal); 
  }
}
// ==================== 帖子详情 ====================

function openForumPostDetail(postId) {
  // 确保ID是数字类型进行比较
  currentForumPostId = Number(postId);
  const overlay = document.getElementById("forumDetailOverlay");
  if (overlay) {
    overlay.classList.add("active");
    renderForumPostDetail();
  }
}

function closeForumPostDetail() {
  currentForumPostId = null;
  forumReplyTarget = null; // 重置回复状态
  const overlay = document.getElementById("forumDetailOverlay");
  if (overlay) {
    overlay.classList.remove("active");
  }
}

// 渲染帖子详情 (修复回复格式版)
function renderForumPostDetail() {
  const post = forumPosts.find((p) => Number(p.id) === Number(currentForumPostId));
  if (!post) return;

  const container = document.getElementById("forumDetailContent");
  if (!container) return;

  const displayAuthorName = post.authorType === 'user' && monoOwnPost(post) ? (forumSettings.userNickname || '我') : post.authorName;
  const realAvatarUrl = findBestAvatar(displayAuthorName, post.authorAvatar, post);
  const avatarContent = `<img src="${realAvatarUrl}" alt="">`;
  const handle = post.handle || generateEnglishHandle(post.authorName);
  const retweets = post.retweets || 0;
  const views = post.views || 0;

  const commentsHtml = (post.comments || [])
    .map((comment) => {
      const commentDisplayName = comment.authorType === 'user' && monoOwnPost(comment) ? (forumSettings.userNickname || '我') : comment.authorName;
      const commentAvatarUrl = findBestAvatar(commentDisplayName, comment.authorAvatar, comment);
      const commentAvatar = `<img src="${commentAvatarUrl}" alt="">`;

      // ★★★ 最终修正：回复是细灰，名字是粗蓝，冒号是细灰 ★★★
      let replyPrefix = "";
      if (comment.replyToName) {
         replyPrefix = `<span style="color:#536471;">回复 </span><span style="color:#1d9bf0; font-weight:bold;">@${escapeForumHtml(comment.replyToName)}</span><span style="color:#536471;">：</span>`;
      }

      // 【强化清洗】如果内容开头有“回复@某某：”或“回复某某：”，无论中英文，一律强行清洗，避免与系统前缀重复
      let cleanContent = formatForumContent(comment.content);
      const manualReplyPattern = /^回复\s*@?[a-zA-Z0-9_\u4e00-\u9fa5]+[:：\s]*/i;
      cleanContent = cleanContent.replace(manualReplyPattern, '');

      return `
      <div class="forum-comment" data-comment-id="${comment.id}">
        <div class="forum-comment-avatar" onclick="ForumApp.openOtherUserProfile('${comment.authorType}', '${ForumApp.escapeForumHtml(commentDisplayName)}', '')" style="cursor:pointer;">
            ${commentAvatar}
        </div>
        <div class="forum-comment-body">
          <div class="forum-comment-header">
            <span class="forum-comment-name" onclick="ForumApp.openOtherUserProfile('${comment.authorType}', '${ForumApp.escapeForumHtml(commentDisplayName)}', '')" style="cursor:pointer;">
                ${escapeForumHtml(commentDisplayName)}
            </span>
            <span class="forum-comment-time">· ${formatForumTime(comment.timestamp)}</span>
          </div>
          <!-- 这里应用新的回复格式 -->
          <div class="forum-comment-text">${replyPrefix}${cleanContent}</div>
          
          <div class="forum-comment-actions">
            <div class="forum-comment-action" onclick="ForumApp.replyToForumComment(${post.id}, ${comment.id}, '${ForumApp.escapeForumHtml(comment.authorName)}')">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            </div>
            <div class="forum-comment-action ${comment.liked ? 'liked' : ''}" onclick="ForumApp.toggleForumCommentLike(${post.id}, ${comment.id})">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="${comment.liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
              <span>${comment.likes || ''}</span>
            </div>
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  const fullTime = new Date(post.timestamp).toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  container.innerHTML = `
    <div class="forum-detail-post">
      <div class="forum-detail-author">
        <div class="forum-detail-avatar" onclick="ForumApp.openOtherUserProfile('${post.authorType}', '${ForumApp.escapeForumHtml(post.authorName)}', '${post.authorId || ''}')" style="cursor:pointer;">${avatarContent}</div>
        <div class="forum-detail-author-info">
          <div class="forum-detail-name" onclick="ForumApp.openOtherUserProfile('${post.authorType}', '${ForumApp.escapeForumHtml(displayAuthorName)}', '${post.authorId || ''}')" style="cursor:pointer;">${escapeForumHtml(displayAuthorName)}</div>
          <div class="forum-detail-handle">${handle.startsWith('@') ? handle : '@' + handle}</div>
        </div>
      </div>
      
      <div class="forum-detail-text">${formatForumContent(post.content)}</div>
      ${renderDetailImages(post)}
      
      <div class="forum-detail-time">${fullTime}</div>
      <div class="forum-detail-stats">
        <div class="forum-detail-stat"><strong>${retweets}</strong> 转发</div>
        <div class="forum-detail-stat"><strong>${post.likes || 0}</strong> 喜欢</div>
        <div class="forum-detail-stat"><strong>${views}</strong> 浏览</div>
      </div>
      
      <div class="forum-detail-actions">
        <div class="forum-detail-action" onclick="ForumApp.refreshPostComments(${post.id}, this)" title="点击生成新评论"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg></div>
        <div class="forum-detail-action" onclick="ForumApp.openQuoteRetweet(${post.id})"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 1l4 4-4 4"></path><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><path d="M7 23l-4-4 4-4"></path><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg></div>
        <div class="forum-detail-action ${post.liked ? 'liked' : ''}" onclick="ForumApp.toggleForumPostLike(${post.id}); ForumApp.renderForumPostDetail();"><svg viewBox="0 0 24 24" width="20" height="20" fill="${post.liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></div>
        <div class="forum-detail-action" onclick="ForumApp.retweetToChat(${post.id})"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg></div>
      </div>
    </div>
    
    <div class="forum-comments-section">
      ${commentsHtml || '<div class="forum-no-comments">暂无评论，来说点什么吧</div>'}
    </div>
  `;

  updateForumCommentInput();
}

// 更新评论输入框状态
function updateForumCommentInput() {
  const input = document.getElementById("forumCommentInput");
  const replyIndicator = document.getElementById("forumReplyIndicator");

  if (forumReplyTarget) {
    if (input) input.placeholder = `回复 @${forumReplyTarget.authorName}...`;
    if (replyIndicator) {
      replyIndicator.style.display = "flex";
      replyIndicator.innerHTML = `
        <span>回复 @${escapeForumHtml(forumReplyTarget.authorName)}</span>
        <span style="cursor:pointer;margin-left:8px;" onclick="ForumApp.cancelForumReply();ForumApp.updateForumCommentInput();">✕</span>
      `;
    }
  } else {
    if (input) input.placeholder = "写评论...";
    if (replyIndicator) replyIndicator.style.display = "none";
  }
}

// ==================== 设置页面 ====================

function openForumSettings() {
  const overlay = document.getElementById("forumSettingsOverlay");
  if (overlay) {
    overlay.classList.add("active");
    renderForumSettings();
  }
}

async function closeForumSettings() {
  // 1. 强制获取当前输入框的值进行保存 (防止用户输完直接点关闭，没触发onchange)
  const nameInput = document.getElementById('forumNameInput');
  const worldviewInput = document.getElementById('forumWorldviewInput');
  
  // 如果输入框存在，就强制更新到内存变量中
  if (nameInput) forumSettings.forumName = nameInput.value;
  if (worldviewInput) forumSettings.worldview = worldviewInput.value;
  
  // 2. 存入数据库
  await localforage.setItem("forumSettings", forumSettings);
  console.log("[论坛] 设置页关闭，数据已强制保存");

  // 3. 关闭界面
  const overlay = document.getElementById("forumSettingsOverlay");
  if (overlay) {
    overlay.classList.remove("active");
  }
  
  // 4. 刷新主页，让新设置生效（比如世界观变化后，空状态提示会消失）
  renderForumFeed();
}

// ==================== 渲染设置页面 (UI升级版) ====================

function renderForumSettings() {
  const container = document.getElementById("forumSettingsContent");
  if (!container) return;

  // 1. 准备 AI角色、NPC、关系 的列表 HTML (保持原有逻辑不变)
  // ---------------------------------------------------------
  const participantsHtml = forumSettings.aiParticipants
    .map((p, index) => {
      const char = characters.find((c) => String(c.id) === String(p.charId));
      const avatarContent = p.avatar 
        ? `<img src="${p.avatar}" alt="">`
        : (char?.avatar ? `<img src="${char.avatar}" alt="">` : "🤖");
      const displayName = p.nickname || char?.name || "未知角色";
      const handleText = p.handle || generateEnglishHandle(displayName);

      return `
      <div class="forum-participant" onclick="ForumApp.editForumParticipant(${index})">
        <div class="forum-participant-avatar">${avatarContent}</div>
        <div class="forum-participant-info">
          <div class="forum-participant-name">${escapeForumHtml(displayName)}</div>
          <div class="forum-participant-handle">@${escapeForumHtml(handleText)}</div>
          <div class="forum-participant-identity">${escapeForumHtml(p.identity || "未设置身份")}</div>
        </div>
        <button class="forum-participant-remove" onclick="event.stopPropagation();ForumApp.removeForumParticipant(${index})">×</button>
      </div>
    `;
    }).join("");

  const npcsHtml = (forumSettings.npcs || [])
    .map((npc, index) => {
      const avatarContent = npc.avatar 
        ? `<img src="${npc.avatar}" alt="">`
        : (npc.name ? npc.name.charAt(0) : "👤");
      return `
      <div class="forum-participant" onclick="ForumApp.editForumNpc(${index})">
        <div class="forum-participant-avatar forum-npc-avatar">${avatarContent}</div>
        <div class="forum-participant-info">
          <div class="forum-participant-name">${escapeForumHtml(npc.name)}</div>
          <div class="forum-participant-handle">@${escapeForumHtml(npc.handle || '')}</div>
          <div class="forum-participant-identity">${escapeForumHtml(npc.identity || "未设置身份")}</div>
        </div>
        <button class="forum-participant-remove" onclick="event.stopPropagation();ForumApp.removeForumNpc(${index})">×</button>
      </div>
    `;
    }).join("");

  const relationshipsHtml = (forumSettings.relationships || [])
    .map((rel, index) => {
      const person1Name = getForumPersonName(rel.person1Type, rel.person1Id);
      const person2Name = getForumPersonName(rel.person2Type, rel.person2Id);
      return `
      <div class="forum-relationship-item" onclick="ForumApp.editForumRelationship(${index})">
        <div class="forum-relationship-people">
          <span class="forum-relationship-person">${escapeForumHtml(person1Name)}</span>
          <span class="forum-relationship-arrow">↔</span>
          <span class="forum-relationship-person">${escapeForumHtml(person2Name)}</span>
        </div>
        <div class="forum-relationship-type">${escapeForumHtml(rel.relationship || '未设置')}</div>
        <button class="forum-participant-remove" onclick="event.stopPropagation();ForumApp.removeForumRelationship(${index})">×</button>
      </div>
    `;
    }).join("");

  // 2. 生成预设下拉框的选项 HTML
  // ---------------------------------------------------------
  const presetsOptions = forumPresets.map((p, idx) => 
    `<option value="${idx}">${escapeForumHtml(p.name)}</option>`
  ).join("");


  // 3. 构建完整的页面 HTML (新 UI 结构)
  // ---------------------------------------------------------
  container.innerHTML = `
    <!-- ★★★ 纯净版：无图标、文字精简 ★★★ -->
    <div class="forum-section">
      <div class="forum-accordion" id="forumPresetAccordion">
        <!-- 标题栏：去掉文件夹图标，纯文字 -->
        <div class="forum-accordion-header" onclick="ForumApp.toggleForumPresetPanel()">
          <div class="forum-accordion-title">
            方案预设管理
          </div>
          <div class="forum-accordion-arrow">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#536471" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
        </div>
        
        <div class="forum-accordion-content">
          <select id="forumPresetSelect" class="forum-input forum-select" style="width:100%; background:#fff; margin-bottom:12px;" onchange="ForumApp.loadSelectedForumPreset()">
            <option value="">选择方案...</option>
            ${presetsOptions}
          </select>
          
          <div class="forum-btn-group">
            <!-- 删掉了 emoji 图标 -->
            <button class="forum-preset-btn save" onclick="ForumApp.saveNewForumPreset()">新建</button>
            <button class="forum-preset-btn update" onclick="ForumApp.updateCurrentForumPreset()">覆盖</button>
            <button class="forum-preset-btn delete" onclick="ForumApp.deleteSelectedForumPreset()">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 下面是原有的设置项，保持原样即可 -->
    <div class="forum-section">
      <div class="forum-section-title">世界观设定</div>
      <div class="forum-card">
        <div class="forum-item">
          <div class="forum-label">论坛名称</div>
          <input type="text" class="forum-input" id="forumNameInput" 
            value="${escapeForumHtml(forumSettings.forumName)}" 
            placeholder="如：豆瓣小组、微博超话..."
            oninput="ForumApp.settings.forumName = this.value"
            onchange="ForumApp.saveForumSetting('forumName', this.value)">
        </div>
        <div class="forum-item">
          <div class="forum-label">世界观</div>
          <textarea class="forum-input" id="forumWorldviewInput" rows="4" 
            placeholder="描述这个论坛的世界观背景..."
            oninput="ForumApp.settings.worldview = this.value"
            onchange="ForumApp.saveForumSetting('worldview', this.value)">${escapeForumHtml(forumSettings.worldview)}</textarea>
        </div>
        <div class="forum-item">
          <div class="forum-label">绑定世界书 <span class="forum-section-hint">可选</span></div>
          <div class="forum-worldbook-list" id="forumWorldbookList">
            ${renderForumWorldbookBindings()}
          </div>
          <button class="forum-add-btn forum-add-worldbook-btn" onclick="ForumApp.openForumWorldbookSelector()">+ 绑定世界书</button>
        </div>
      </div>
    </div>
    
    <div class="forum-section">
      <div class="forum-section-title">我的身份</div>
      <div class="forum-card">
        <div class="forum-item">
          <div class="forum-label">我的昵称</div>
          <input type="text" class="forum-input" 
            value="${escapeForumHtml(forumSettings.userNickname)}" 
            placeholder="你在论坛的昵称"
            oninput="ForumApp.settings.userNickname = this.value"
            onchange="ForumApp.saveForumSetting('userNickname', this.value)">
        </div>
        <div class="forum-item">
          <div class="forum-label">我的身份</div>
          <textarea class="forum-input" rows="2" 
            placeholder="你在这个世界观里的身份..."
            oninput="ForumApp.settings.userIdentity = this.value"
            onchange="ForumApp.saveForumSetting('userIdentity', this.value)">${escapeForumHtml(forumSettings.userIdentity)}</textarea>
        </div>
      </div>
    </div>
    
    <div class="forum-section">
      <div class="forum-section-title">AI角色 <span class="forum-section-hint">点击可编辑</span></div>
      ${participantsHtml || '<div class="forum-empty-hint">还没有添加AI角色</div>'}
      <button class="forum-add-btn" onclick="ForumApp.openAddForumParticipant()">+ 添加AI角色</button>
    </div>
    
    <div class="forum-section">
      <div class="forum-section-title">NPC角色 <span class="forum-section-hint">路人网友</span></div>
      ${npcsHtml || '<div class="forum-empty-hint">还没有添加NPC</div>'}
      <button class="forum-add-btn" onclick="ForumApp.openAddForumNpc()">+ 添加NPC</button>
    </div>
    
    <div class="forum-section">
      <div class="forum-section-title">人物关系 <span class="forum-section-hint">互动依据</span></div>
      ${relationshipsHtml || '<div class="forum-empty-hint">还没有设置关系</div>'}
      <button class="forum-add-btn" onclick="ForumApp.openAddForumRelationship()">+ 添加关系</button>
    </div>
    <div style="padding: 30px 10px 50px 10px;">
        <button class="forum-clear-generated" onclick="ForumApp.clearGeneratedPosts()">
            一键清除生成的帖子
        </button>
    </div>
  `;
}

// ★★★ 修改：一键清除生成的帖子 + 私信 ★★★
async function clearGeneratedPosts() {
  // 1. 修改确认弹窗的文案
  if (!confirm("确定要清空所有 AI/NPC 生成的帖子以及所有私信记录吗？\n你的帖子和置顶帖会被保留。")) return;

  // 2. 清理帖子（原有逻辑：保留用户的和置顶的）
  forumPosts = forumPosts.filter(p => p.authorType === 'user' || p.isPinned);
  await localforage.setItem("forumPosts", forumPosts);

  // 3. 【新增】清理私信（全部清空）
  for(const id of forumDMTasks.keys()) forumStopGeneration(id);
  forumDirectMessages = []; // 清空内存中的私信列表
  await forumSaveDMs(); // 清空数据库中的私信

  // 4. 提示并刷新
  showToast("帖子和私信已清理");
  
  // 刷新设置页
  renderForumSettings(); 
}

// 获取人物名称
function getForumPersonName(type, id) {
  if (type === 'ai') {
    const participant = forumSettings.aiParticipants.find(p => String(p.charId) === String(id));
    if (participant) {
      const char = characters.find(c => String(c.id) === String(id));
      return participant.nickname || char?.name || '未知AI';
    }
  } else if (type === 'npc') {
    const npc = (forumSettings.npcs || []).find(n => String(n.id) === String(id));
    return npc?.name || '未知NPC';
  } else if (type === 'user') {
    return forumSettings.userNickname || '用户';
  }
  return '未知';
}

async function saveForumSetting(key, value) {
  // 更新内存变量
  forumSettings[key] = value;
  
  // 存入数据库
  await localforage.setItem("forumSettings", forumSettings);
  
  console.log("[论坛] 设置已保存:", key);
  
  // ★★★ 新增：给出提示，让用户安心 ★★★
  // 如果你有 showToast 函数（上一步修复时加的），就调用它
  if (typeof showToast === 'function') {
      // 只有当 value 不为空时才提示，避免清空时也提示怪怪的，或者你可以一直提示
      if (value) showToast("设置已自动保存");
  }
}
// ==================== 世界书绑定管理 ====================

// 渲染已绑定的世界书列表 (修复版：纯文字 + 强力玻璃质感 UI)
function renderForumWorldbookBindings() {
  let forumBoundIds = forumSettings.worldbookIds || [];
  const allWorldbooks = getGlobalWorldbooks(); 
  
  // 自动清理逻辑：剔除已变成“角色专用”的书
  const cleanForumIds = forumBoundIds.filter(wbId => {
    const wb = allWorldbooks.find(w => w.id === Number(wbId));
    if (!wb) return false;
    if (wb.isCharBook === true) return false; // 踢出列表
    return true; 
  });
  
  // 同步清理后的数据
  if (cleanForumIds.length !== forumBoundIds.length) {
      forumSettings.worldbookIds = cleanForumIds;
      localforage.setItem("forumSettings", forumSettings);
      forumBoundIds = cleanForumIds; 
  }

  // --- 渲染 UI ---
  if (forumBoundIds.length === 0) {
    return `
      <div class="forum-empty-hint" style="text-align:center; padding:15px; background:rgba(255,255,255,0.5); border-radius:12px; color:#888; border:1px dashed rgba(0,0,0,0.1);">
        暂无额外绑定<br>
        <span style="font-size:12px; opacity:0.7">(角色绑定的世界书会自动生效)</span>
      </div>
    `;
  }
  
  return `
    <div class="forum-wb-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px;">
      ${forumBoundIds.map(wbId => {
        const wb = allWorldbooks.find(w => w.id === Number(wbId));
        if (!wb) return ''; 
        
        const entryCount = wb.entries?.length || 0;
        
        // ★★★ 强力玻璃质感样式 (无图标版) ★★★
        return `
          <div class="forum-wb-card" style="
              position: relative; 
              background: rgba(255, 255, 255, 0.65); /* 半透明白底 */
              backdrop-filter: blur(16px);           /* 强模糊 */
              -webkit-backdrop-filter: blur(16px);
              border: 1px solid rgba(255, 255, 255, 0.9); /* 亮边框 */
              box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05); /* 柔和阴影 */
              border-radius: 12px; 
              padding: 12px 14px; 
              display: flex; 
              flex-direction: column; 
              justify-content: center;
              transition: all 0.2s;
              min-height: 50px;
          ">
            <!-- 标题 (加粗深色) -->
            <div style="font-weight: 600; font-size: 15px; color: #333; margin-bottom: 4px; padding-right: 20px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${escapeForumHtml(wb.name)}
            </div>
            
            <!-- 条目数 (浅色小字) -->
            <div style="font-size: 12px; color: #888; display: flex; align-items: center;">
               <span style="display:inline-block; width:6px; height:6px; background:#4cd964; border-radius:50%; margin-right:6px;"></span>
               ${entryCount} 条目
            </div>

            <!-- 删除按钮 (右上角悬浮) -->
            <button onclick="ForumApp.removeForumWorldbook('${wbId}')" style="
                position: absolute; 
                top: 8px; 
                right: 8px; 
                width: 22px; height: 22px; 
                border: none; 
                background: rgba(0,0,0,0.05); 
                border-radius: 50%;
                color: #999; 
                cursor: pointer; 
                display: flex; align-items: center; justify-content: center; 
                font-size: 14px;
                transition: all 0.2s;
            " 
            onmouseover="this.style.background='#ff4d4f'; this.style.color='white';" 
            onmouseout="this.style.background='rgba(0,0,0,0.05)'; this.style.color='#999';">×</button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// 打开世界书选择器 (修复版：解除角色绑定过滤限制)
function openForumWorldbookSelector() {
  const worldbooks = getGlobalWorldbooks(); 
  const forumBoundIds = forumSettings.worldbookIds || []; 
  // const charBoundIds = getCharacterBoundWorldbooks(); // 不再需要获取角色绑定的列表来做过滤
  
  // 过滤逻辑
  const availableWorldbooks = worldbooks.filter(wb => {
    const wbId = Number(wb.id);
    
    // 1. 已经添加到论坛列表的，过滤掉 (防止重复添加)
    const isBoundToForum = forumBoundIds.some(id => Number(id) === wbId);
    
    // 2. 被禁用的，过滤掉
    const isEnabled = wb.enabled !== false; 
    
    // 3. 标记为“角色专属”且未绑定给当前论坛用户的，过滤掉
    // (普通的通用世界书即使被某个角色用了，也应该允许在论坛全局再次添加)
    const isCharExclusive = wb.isCharBook === true; 
    
    // ★★★ 核心修复：移除了 !isBoundToChar 的判断 ★★★
    // 这样即使某个 AI 角色私下带了这个书，你依然可以把它设为论坛的全局设定
    return !isBoundToForum && isEnabled && !isCharExclusive;
  });
  
  if (availableWorldbooks.length === 0) {
    showToast('没有可添加的通用世界书');
    return;
  }
  
  // --- 列表渲染 (保持原样) ---
  const html = availableWorldbooks.map(wb => {
    const entryCount = wb.entries?.length || 0;
    return `
      <div class="forum-char-select-item" onclick="ForumApp.addForumWorldbook('${wb.id}')" style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
        <!-- 左侧文字区 -->
        <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
            <div style="font-size:15px; font-weight:600; color:#333; margin-bottom:2px;">
                ${escapeForumHtml(wb.name)}
            </div>
            <div style="font-size:12px; color:#999;">
                共 ${entryCount} 条目
            </div>
        </div>
        
        <!-- 右侧加号 -->
        <div style="
            width: 32px; height: 32px; 
            border-radius: 50%; 
            background: #f5f7f9; 
            color: #007aff; 
            display: flex; align-items: center; justify-content: center; 
            font-size: 20px; 
            font-weight: 300;
        ">+</div>
      </div>
    `;
  }).join('');
  
  // 创建弹窗
  const modal = document.createElement('div');
  modal.id = 'forumWorldbookSelectorModal';
  modal.className = 'forum-modal-overlay';
  modal.innerHTML = `
    <div class="forum-modal-content" style="background: rgba(255,255,255,0.95); backdrop-filter: blur(20px);">
      <div class="forum-modal-header" style="border-bottom:none; padding-bottom:0;">
        <span class="forum-modal-title">添加设定</span>
        <button class="forum-modal-close" onclick="ForumApp.closeForumWorldbookSelector()">×</button>
      </div>
      <div class="forum-modal-body" style="padding: 0 16px 16px 16px;">
        <div style="padding:10px; font-size:12px; color:#888; background:rgba(0,0,0,0.03); border-radius:8px; margin: 10px 0;">
          角色专属设定集已自动隐藏，通用设定集均可在此添加。
        </div>
        ${html}
      </div>
    </div>
  `;
  modal.onclick = (e) => { if (e.target === modal) closeForumWorldbookSelector(); };
  forumMount(modal);
  setTimeout(() => modal.classList.add('active'), 10);
}

// 关闭世界书选择器
function closeForumWorldbookSelector() {
  const modal = document.getElementById('forumWorldbookSelectorModal');
  if (modal) modal.remove();
}

// 添加世界书绑定 (修复版：确保ID类型一致)
async function addForumWorldbook(worldbookId) {
  closeForumWorldbookSelector();
  
  // 确保 ID 是数字类型 (如果你的系统里 ID 是数字)
  const idToSave = Number(worldbookId);
  
  if (!forumSettings.worldbookIds) {
    forumSettings.worldbookIds = [];
  }
  
  if (!forumSettings.worldbookIds.includes(idToSave)) {
    forumSettings.worldbookIds.push(idToSave);
    
    // 立即保存到数据库
    await localforage.setItem('forumSettings', forumSettings);
    
    // 刷新显示
    const listEl = document.getElementById('forumWorldbookList');
    if (listEl) {
      listEl.innerHTML = renderForumWorldbookBindings();
    }
    
    showToast('世界书已绑定');
  }
}

// 移除世界书绑定 (修复版：强制类型转换)
async function removeForumWorldbook(worldbookId) {
  if (!forumSettings.worldbookIds) return;
  
  // ★★★ 核心修复：将传入的 ID (可能是字符串) 强制转为数字进行比对 ★★★
  const idToRemove = Number(worldbookId);
  
  forumSettings.worldbookIds = forumSettings.worldbookIds.filter(id => Number(id) !== idToRemove);
  
  await localforage.setItem('forumSettings', forumSettings);
  
  // 刷新显示
  const listEl = document.getElementById('forumWorldbookList');
  if (listEl) {
    listEl.innerHTML = renderForumWorldbookBindings();
  }
  
  // 使用新的 toast 提示
  if(typeof showToast === 'function') showToast('已移除该世界书');
}
// 获取论坛需要发送给AI的世界书内容
function getForumWorldbookContent(contextText = '') {
  // 1. 获取两部分 ID (论坛勾选的 + 角色自带的)
  const forumIds = forumSettings.worldbookIds || [];
  const charIds = getCharacterBoundWorldbooks(); 
  
  // 2. 合并并去重
  const allTargetIds = new Set([...forumIds, ...charIds]);
  
  if (allTargetIds.size === 0) return '';
  
  const contentParts = [];
  // ★★★ 修复点：使用新函数获取真实数据 ★★★
  const globalWorldbooks = getGlobalWorldbooks();

  // 3. 遍历去重后的 ID 列表
  allTargetIds.forEach(wbId => {
    const wb = globalWorldbooks.find(w => w.id === Number(wbId) && w.enabled !== false);
    if (!wb || !wb.entries) return;
    
    // 4. 遍历条目
    wb.entries.forEach(entry => {
      if (entry.enabled === false) return;
      
      let shouldInclude = false;
      
      if (wb.triggerType === 'always') {
        shouldInclude = true;
      } 
      else if (wb.triggerType === 'keyword' && entry.keywords && contextText) {
        const keywords = entry.keywords.split(/[,，]/).map(k => k.trim().toLowerCase()).filter(k => k);
        const contextLower = contextText.toLowerCase();
        if (keywords.some(kw => contextLower.includes(kw))) {
          shouldInclude = true;
        }
      }
      
      if (shouldInclude && entry.content) {
        const titlePart = entry.title ? `【设定：${entry.title}】` : '【相关设定】';
        contentParts.push(`${titlePart}\n${entry.content}`);
      }
    });
  });
  
  if (contentParts.length === 0) return '';
  return `\n[世界书/背景设定参考]:\n${contentParts.join('\n\n')}\n`;
}

// 获取角色的完整人设（聊天人设 + 论坛自定义设定）
function getCharacterFullPersona(participant) {
  const charId = participant.charId;
  const char = characters.find(c => String(c.id) === String(charId));
  if (!char) return participant.identity || '';
  
  // 获取聊天设置中的人设
  const settings = chatSettings[charId] || {};
  
  // 合并人设：聊天人设 + 角色描述 + 论坛自定义身份
  const parts = [];
  
  // 1. 角色原始描述/人设
  const originalPersona = settings.persona || char.description || char.persona || '';
  if (originalPersona) {
    parts.push(`【角色基础人设】${originalPersona}`);
  }
  
  // 2. 角色的系统提示词（如果有）
  const systemPrompt = settings.systemPrompt || char.systemPrompt || '';
  if (systemPrompt && systemPrompt !== originalPersona) {
    parts.push(`【角色性格特点】${systemPrompt.substring(0, 200)}`);
  }
  
  // 3. 论坛自定义身份设定
  if (participant.identity) {
    parts.push(`【在论坛中的身份】${participant.identity}`);
  }
  
  // 4. 论坛自定义简介
  if (participant.bio) {
    parts.push(`【个人简介】${participant.bio}`);
  }
  
  return parts.join('\n');
}

// ==================== AI参与者管理 ====================

function openAddForumParticipant() {
  const availableChars = characters.filter(
    (c) => !forumSettings.aiParticipants.find((p) => p.charId === c.id)
  );

  if (availableChars.length === 0) {
    showToast("没有可添加的角色");
    return;
  }

  const html = availableChars
    .map(
      (c) => `
    <div class="forum-char-select-item" onclick="ForumApp.selectForumParticipant('${c.id}')">
      <div class="forum-char-select-avatar">
        ${
          c.avatar
            ? `<img src="${c.avatar}" alt="">`
            : (c.name ? c.name.charAt(0) : "🤖")
        }
      </div>
      <div class="forum-char-select-name">${escapeForumHtml(c.name)}</div>
      <svg class="forum-char-select-arrow" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>
  `
    )
    .join("");

  const modal = document.createElement("div");
  modal.id = "forumAddParticipantModal";
  modal.className = "forum-modal-overlay";
  modal.innerHTML = `
    <div class="forum-modal-content">
      <div class="forum-modal-header">
        <span class="forum-modal-title">选择角色</span>
        <button class="forum-modal-close" onclick="ForumApp.closeForumParticipantModal()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="forum-modal-body">
        ${html}
      </div>
    </div>
  `;
  modal.onclick = (e) => {
    if (e.target === modal) closeForumParticipantModal();
  };
  forumMount(modal);
}

function closeForumParticipantModal() {
  const modal = document.getElementById("forumAddParticipantModal");
  if (modal) modal.remove();
}

async function selectForumParticipant(charId) {
  closeForumParticipantModal();

  const char = characters.find((c) => String(c.id) === String(charId));
  if (!char) return;
  
  showParticipantEditModal(charId, char, null); // null表示新增
}

// 编辑已有的AI参与者
function editForumParticipant(index) {
  const participant = forumSettings.aiParticipants[index];
  if (!participant) return;
  
  const char = characters.find((c) => String(c.id) === String(participant.charId));
  showParticipantEditModal(participant.charId, char, index);
}

// 显示AI参与者编辑弹窗
function showParticipantEditModal(charId, char, editIndex) {
  const isEdit = editIndex !== null;
  const participant = isEdit ? forumSettings.aiParticipants[editIndex] : {};
  const defaultHandle = generateEnglishHandle(participant.nickname || char?.name || '');
  
  // 当前头像：优先自定义头像，否则角色头像
  const currentAvatar = participant.avatar || char?.avatar || '';
  const avatarPreview = currentAvatar 
    ? `<img src="${currentAvatar}" alt="">` 
    : (char?.name ? char.name.charAt(0) : '🤖');
  
  // 背景图
  const currentBanner = participant.banner || '';
  const bannerPreview = currentBanner
    ? `<img src="${currentBanner}" alt="">`
    : '<div class="forum-profile-banner-placeholder"></div>';
  
  const modal = document.createElement("div");
  modal.id = "forumSetIdentityModal";
  modal.className = "forum-modal-overlay";
  modal.innerHTML = `
    <div class="forum-modal-content forum-modal-large">
      <div class="forum-modal-header">
        <span class="forum-modal-title">${isEdit ? '编辑' : '设置'}角色信息</span>
        <button class="forum-modal-close" onclick="document.getElementById('forumSetIdentityModal').remove()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="forum-modal-body" style="padding:16px;max-height:70vh;overflow-y:auto;">
        <!-- 背景图 -->
        <div class="forum-participant-banner-edit" onclick="ForumApp.forumChooseEditorImage('forumParticipantBannerInput')">
          ${bannerPreview}
          
        </div>
        <input type="file" id="forumParticipantBannerInput" accept="image/*" style="display:none" onchange="ForumApp.previewForumParticipantBanner(this)">
        <input type="hidden" id="forumParticipantBannerData" value="${currentBanner}">
        
        <div class="forum-identity-char">
          <div class="forum-identity-avatar" id="forumParticipantAvatarPreview" onclick="ForumApp.forumChooseEditorImage('forumParticipantAvatarInput')">
            ${avatarPreview}
            
          </div>
          <input type="file" id="forumParticipantAvatarInput" accept="image/*" style="display:none" onchange="ForumApp.previewForumParticipantAvatar(this)">
          <input type="hidden" id="forumParticipantAvatarData" value="${currentAvatar}">
          <div class="forum-identity-name">${escapeForumHtml(char?.name || '角色')}</div>
          <div class="forum-identity-hint">原角色名（论坛中可使用不同昵称）</div>
        </div>
        
        <div class="forum-item" style="padding:0;border:none;margin-bottom:16px;">
          <div class="forum-label">论坛昵称</div>
          <input type="text" class="forum-input" id="forumParticipantNickname" 
            value="${escapeForumHtml(participant.nickname || '')}"
            placeholder="留空则使用角色原名：${char?.name || ''}">
        </div>
        
        <div class="forum-item" style="padding:0;border:none;margin-bottom:16px;">
          <div class="forum-label">用户名 (Handle)</div>
          <div class="forum-input-with-prefix">
            <span class="forum-input-prefix">@</span>
            <input type="text" class="forum-input forum-input-handle" id="forumParticipantHandle" 
              value="${escapeForumHtml(participant.handle || '')}"
              placeholder="${defaultHandle}">
          </div>
        </div>
        
        <div class="forum-item" style="padding:0;border:none;margin-bottom:16px;">
          <div class="forum-label">个人简介</div>
          <textarea class="forum-input" id="forumParticipantBio" rows="2"
            placeholder="个性签名或简介">${escapeForumHtml(participant.bio || '')}</textarea>
        </div>
        
        <div class="forum-item" style="padding:0;border:none;margin-bottom:16px;">
          <div class="forum-label">身份设定</div>
          <textarea class="forum-input" id="forumParticipantIdentity" rows="3"
            placeholder="该角色在论坛的身份，如：资深摸鱼达人、某领域专家...">${escapeForumHtml(participant.identity || '')}</textarea>
        </div>
        
        <div class="forum-profile-editor-field-row">
          <div class="forum-profile-editor-field forum-profile-editor-field-half">
            <label>正在关注</label>
            <input type="text" class="forum-input" id="forumParticipantFollowing" 
              value="${participant.following || ''}" placeholder="如: 32, 1.2K">
          </div>
          <div class="forum-profile-editor-field forum-profile-editor-field-half">
            <label>关注者</label>
            <input type="text" class="forum-input" id="forumParticipantFollowers" 
              value="${participant.followers || ''}" placeholder="如: 96, 10K">
          </div>
        </div>
        
        <div class="forum-item" style="padding:0;border:none;margin-bottom:16px;">
          <div class="forum-label">加入时间</div>
          <input type="text" class="forum-input" id="forumParticipantJoinDate" 
            value="${escapeForumHtml(participant.joinDate || '')}"
            placeholder="如: 2024年1月">
        </div>
        
        <button class="forum-identity-submit" onclick="ForumApp.confirmAddParticipant('${charId}', ${editIndex})">
          ${isEdit ? '保存修改' : '添加角色'}
        </button>
      </div>
    </div>
  `;
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  forumMount(modal);
}

// 预览背景图
function previewForumParticipantBanner(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const container = document.querySelector('.forum-participant-banner-edit');
      if (container) {
        const img = container.querySelector('img') || document.createElement('img');
        img.src = e.target.result;
        if (!container.querySelector('img')) {
          container.insertBefore(img, container.firstChild);
          const placeholder = container.querySelector('.forum-profile-banner-placeholder');
          if (placeholder) placeholder.remove();
        }
      }
      const dataInput = document.getElementById('forumParticipantBannerData');
      if (dataInput) {
        dataInput.value = e.target.result;
      }
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// 预览头像
function previewForumParticipantAvatar(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('forumParticipantAvatarPreview');
      if (preview) {
        preview.innerHTML = `<img src="${e.target.result}" alt="">`;
      }
      const dataInput = document.getElementById('forumParticipantAvatarData');
      if (dataInput) {
        dataInput.value = e.target.result;
      }
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function confirmAddParticipant(charId, editIndex) {
  const nickname = document.getElementById('forumParticipantNickname')?.value || '';
  const handle = document.getElementById('forumParticipantHandle')?.value || '';
  const identity = document.getElementById('forumParticipantIdentity')?.value || '';
  const avatar = document.getElementById('forumParticipantAvatarData')?.value || '';
  const banner = document.getElementById('forumParticipantBannerData')?.value || '';
  const bio = document.getElementById('forumParticipantBio')?.value || '';
  const following = document.getElementById('forumParticipantFollowing')?.value || '';
  const followers = document.getElementById('forumParticipantFollowers')?.value || '';
  const joinDate = document.getElementById('forumParticipantJoinDate')?.value || '';
  
  document.getElementById('forumSetIdentityModal')?.remove();
  
  const participantData = {
    charId,
    nickname: nickname,
    handle: handle,
    identity: identity,
    avatar: avatar,
    banner: banner,
    bio: bio,
    following: following,
    followers: followers,
    joinDate: joinDate,
  };
  
  if (editIndex !== null && editIndex >= 0) {
    // 编辑模式
    forumSettings.aiParticipants[editIndex] = participantData;
    showToast('已保存修改');
  } else {
    // 新增模式
    forumSettings.aiParticipants.push(participantData);
    showToast('角色已添加');
  }

  await localforage.setItem("forumSettings", forumSettings);
  renderForumSettings();
}

async function removeForumParticipant(index) {
  forumSettings.aiParticipants.splice(index, 1);
  await localforage.setItem("forumSettings", forumSettings);
  renderForumSettings();
}

// ==================== NPC管理 ====================

function openAddForumNpc() {
  showNpcEditModal(null);
}

function editForumNpc(index) {
  showNpcEditModal(index);
}

function showNpcEditModal(editIndex) {
  const isEdit = editIndex !== null;
  const npc = isEdit ? (forumSettings.npcs || [])[editIndex] : {};
  
  const avatarPreview = npc.avatar 
    ? `<img src="${npc.avatar}" alt="">` 
    : (npc.name ? npc.name.charAt(0) : '👤');
  
  const modal = document.createElement("div");
  modal.id = "forumNpcModal";
  modal.className = "forum-modal-overlay";
  modal.innerHTML = `
    <div class="forum-modal-content forum-modal-large">
      <div class="forum-modal-header">
        <span class="forum-modal-title">${isEdit ? '编辑' : '添加'}NPC</span>
        <button class="forum-modal-close" onclick="document.getElementById('forumNpcModal').remove()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="forum-modal-body" style="padding:16px;max-height:70vh;overflow-y:auto;">
        <!-- 背景图 -->
        <div class="forum-participant-banner-edit" onclick="ForumApp.forumChooseEditorImage('forumNpcBannerInput')">
          ${npc.banner ? `<img src="${npc.banner}" alt="">` : '<div class="forum-profile-banner-placeholder"></div>'}
          
        </div>
        <input type="file" id="forumNpcBannerInput" accept="image/*" style="display:none" onchange="ForumApp.previewForumNpcBanner(this)">
        <input type="hidden" id="forumNpcBannerData" value="${npc.banner || ''}">
        
        <div class="forum-identity-char">
          <div class="forum-identity-avatar forum-npc-avatar" id="forumNpcAvatarPreview" onclick="ForumApp.forumChooseEditorImage('forumNpcAvatarInput')">
            ${avatarPreview}
            
          </div>
          <input type="file" id="forumNpcAvatarInput" accept="image/*" style="display:none" onchange="ForumApp.previewForumNpcAvatar(this)">
          <input type="hidden" id="forumNpcAvatarData" value="${npc.avatar || ''}">
        </div>
        
        <div class="forum-item" style="padding:0;border:none;margin-bottom:16px;">
          <div class="forum-label">NPC昵称 <span class="forum-required">*</span></div>
          <input type="text" class="forum-input" id="forumNpcName" 
            value="${escapeForumHtml(npc.name || '')}"
            placeholder="如：路人甲、热心市民、吃瓜群众...">
        </div>
        
        <div class="forum-item" style="padding:0;border:none;margin-bottom:16px;">
          <div class="forum-label">用户名 (Handle)</div>
          <div class="forum-input-with-prefix">
            <span class="forum-input-prefix">@</span>
            <input type="text" class="forum-input forum-input-handle" id="forumNpcHandle" 
              value="${escapeForumHtml(npc.handle || '')}"
              placeholder="英文用户名，如 CuriousCat_99">
          </div>
        </div>
        
        <div class="forum-item" style="padding:0;border:none;margin-bottom:16px;">
          <div class="forum-label">个人简介</div>
          <textarea class="forum-input" id="forumNpcBio" rows="2"
            placeholder="个性签名或简介">${escapeForumHtml(npc.bio || '')}</textarea>
        </div>
        
        <div class="forum-item" style="padding:0;border:none;margin-bottom:16px;">
          <div class="forum-label">身份设定</div>
          <textarea class="forum-input" id="forumNpcIdentity" rows="2"
            placeholder="这个NPC的背景身份">${escapeForumHtml(npc.identity || '')}</textarea>
        </div>
        
        <div class="forum-item" style="padding:0;border:none;margin-bottom:16px;">
          <div class="forum-label">性格特点</div>
          <textarea class="forum-input" id="forumNpcPersona" rows="2"
            placeholder="这个NPC的性格和说话风格">${escapeForumHtml(npc.persona || '')}</textarea>
        </div>
        
        <div class="forum-profile-editor-field-row">
          <div class="forum-profile-editor-field forum-profile-editor-field-half">
            <label>正在关注</label>
            <input type="text" class="forum-input" id="forumNpcFollowing" 
              value="${npc.following || ''}" placeholder="如: 32, 1.2K">
          </div>
          <div class="forum-profile-editor-field forum-profile-editor-field-half">
            <label>关注者</label>
            <input type="text" class="forum-input" id="forumNpcFollowers" 
              value="${npc.followers || ''}" placeholder="如: 96, 10K">
          </div>
        </div>
        
        <div class="forum-item" style="padding:0;border:none;margin-bottom:16px;">
          <div class="forum-label">加入时间</div>
          <input type="text" class="forum-input" id="forumNpcJoinDate" 
            value="${escapeForumHtml(npc.joinDate || '')}"
            placeholder="如: 2024年1月">
        </div>
        
        <button class="forum-identity-submit" onclick="ForumApp.confirmSaveNpc(${editIndex})">
          ${isEdit ? '保存修改' : '添加NPC'}
        </button>
      </div>
    </div>
  `;
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  forumMount(modal);
}

function previewForumNpcAvatar(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('forumNpcAvatarPreview');
      if (preview) {
        preview.innerHTML = `<img src="${e.target.result}" alt="">`;
      }
      const dataInput = document.getElementById('forumNpcAvatarData');
      if (dataInput) {
        dataInput.value = e.target.result;
      }
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function previewForumNpcBanner(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const container = document.querySelector('#forumNpcModal .forum-participant-banner-edit');
      if (container) {
        const img = container.querySelector('img') || document.createElement('img');
        img.src = e.target.result;
        if (!container.querySelector('img')) {
          container.insertBefore(img, container.firstChild);
          const placeholder = container.querySelector('.forum-profile-banner-placeholder');
          if (placeholder) placeholder.remove();
        }
      }
      const dataInput = document.getElementById('forumNpcBannerData');
      if (dataInput) {
        dataInput.value = e.target.result;
      }
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function confirmSaveNpc(editIndex) {
  const name = document.getElementById('forumNpcName')?.value?.trim() || '';
  const handle = document.getElementById('forumNpcHandle')?.value?.trim() || '';
  const identity = document.getElementById('forumNpcIdentity')?.value || '';
  const persona = document.getElementById('forumNpcPersona')?.value || '';
  const avatar = document.getElementById('forumNpcAvatarData')?.value || '';
  const banner = document.getElementById('forumNpcBannerData')?.value || '';
  const bio = document.getElementById('forumNpcBio')?.value || '';
  const following = document.getElementById('forumNpcFollowing')?.value || '';
  const followers = document.getElementById('forumNpcFollowers')?.value || '';
  const joinDate = document.getElementById('forumNpcJoinDate')?.value || '';
  
  if (!name) {
    showToast('请输入NPC昵称');
    return;
  }
  
  document.getElementById('forumNpcModal')?.remove();
  
  if (!forumSettings.npcs) forumSettings.npcs = [];
  
  const npcData = {
    id: editIndex !== null ? forumSettings.npcs[editIndex].id : Date.now(),
    name,
    handle: handle || generateEnglishHandle(name),
    identity,
    persona,
    avatar,
    banner,
    bio,
    following,
    followers,
    joinDate,
  };
  
  if (editIndex !== null && editIndex >= 0) {
    forumSettings.npcs[editIndex] = npcData;
    showToast('已保存修改');
  } else {
    forumSettings.npcs.push(npcData);
    showToast('NPC已添加');
  }

  await localforage.setItem("forumSettings", forumSettings);
  renderForumSettings();
}

async function removeForumNpc(index) {
  if (!forumSettings.npcs) return;
  forumSettings.npcs.splice(index, 1);
  await localforage.setItem("forumSettings", forumSettings);
  renderForumSettings();
}

// ==================== 关系管理 ====================

function openAddForumRelationship() {
  showRelationshipEditModal(null);
}

function editForumRelationship(index) {
  showRelationshipEditModal(index);
}

function showRelationshipEditModal(editIndex) {
  const isEdit = editIndex !== null;
  const rel = isEdit ? (forumSettings.relationships || [])[editIndex] : {};
  
  // 构建人物选项
  const personOptions = getForumPersonOptions();
  
  const person1Value = isEdit ? `${rel.person1Type}:${rel.person1Id}` : '';
  const person2Value = isEdit ? `${rel.person2Type}:${rel.person2Id}` : '';
  
  const modal = document.createElement("div");
  modal.id = "forumRelationshipModal";
  modal.className = "forum-modal-overlay";
  modal.innerHTML = `
    <div class="forum-modal-content">
      <div class="forum-modal-header">
        <span class="forum-modal-title">${isEdit ? '编辑' : '添加'}关系</span>
        <button class="forum-modal-close" onclick="document.getElementById('forumRelationshipModal').remove()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="forum-modal-body" style="padding:16px;">
        <div class="forum-relationship-form">
          <div class="forum-item" style="padding:0;border:none;margin-bottom:16px;">
            <div class="forum-label">人物1</div>
            <select class="forum-input forum-select" id="forumRelPerson1">
              <option value="">请选择...</option>
              ${personOptions}
            </select>
          </div>
          
          <div class="forum-relationship-connector">
            <div class="forum-relationship-line"></div>
            <div class="forum-relationship-icon">↔</div>
            <div class="forum-relationship-line"></div>
          </div>
          
          <div class="forum-item" style="padding:0;border:none;margin-bottom:16px;">
            <div class="forum-label">人物2</div>
            <select class="forum-input forum-select" id="forumRelPerson2">
              <option value="">请选择...</option>
              ${personOptions}
            </select>
          </div>
        </div>
        
        <div class="forum-item" style="padding:0;border:none;margin-bottom:16px;">
          <div class="forum-label">关系类型</div>
          <input type="text" class="forum-input" id="forumRelType" 
            value="${escapeForumHtml(rel.relationship || '')}"
            placeholder="如：好友、情侣、死对头、师徒、暗恋...">
        </div>
        
        <div class="forum-item" style="padding:0;border:none;margin-bottom:16px;">
          <div class="forum-label">关系描述</div>
          <textarea class="forum-input" id="forumRelDesc" rows="3"
            placeholder="详细描述这段关系，会影响他们在论坛中的互动方式...">${escapeForumHtml(rel.description || '')}</textarea>
        </div>
        
        <button class="forum-identity-submit" onclick="ForumApp.confirmSaveRelationship(${editIndex})">
          ${isEdit ? '保存修改' : '添加关系'}
        </button>
      </div>
    </div>
  `;
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  forumMount(modal);
  
  // 设置默认值
  if (isEdit) {
    setTimeout(() => {
      const select1 = document.getElementById('forumRelPerson1');
      const select2 = document.getElementById('forumRelPerson2');
      if (select1) select1.value = person1Value;
      if (select2) select2.value = person2Value;
    }, 0);
  }
}

function getForumPersonOptions() {
  let options = '';
  
  // 用户
  const userName = forumSettings.userNickname || '用户(我)';
  options += `<option value="user:user">👤 ${escapeForumHtml(userName)}</option>`;
  
  // AI角色
  if (forumSettings.aiParticipants.length > 0) {
    options += '<optgroup label="AI角色">';
    forumSettings.aiParticipants.forEach(p => {
      const char = characters.find(c => String(c.id) === String(p.charId));
      const name = p.nickname || char?.name || '未知';
      options += `<option value="ai:${p.charId}">🤖 ${escapeForumHtml(name)}</option>`;
    });
    options += '</optgroup>';
  }
  
  // NPC
  if (forumSettings.npcs && forumSettings.npcs.length > 0) {
    options += '<optgroup label="NPC">';
    forumSettings.npcs.forEach(npc => {
      options += `<option value="npc:${npc.id}">👥 ${escapeForumHtml(npc.name)}</option>`;
    });
    options += '</optgroup>';
  }
  
  return options;
}

async function confirmSaveRelationship(editIndex) {
  const person1 = document.getElementById('forumRelPerson1')?.value || '';
  const person2 = document.getElementById('forumRelPerson2')?.value || '';
  const relType = document.getElementById('forumRelType')?.value?.trim() || '';
  const relDesc = document.getElementById('forumRelDesc')?.value || '';
  
  if (!person1 || !person2) {
    showToast('请选择两个人物');
    return;
  }
  
  if (person1 === person2) {
    showToast('不能选择同一个人物');
    return;
  }
  
  if (!relType) {
    showToast('请输入关系类型');
    return;
  }
  
  document.getElementById('forumRelationshipModal')?.remove();
  
  const [type1, id1] = person1.split(':');
  const [type2, id2] = person2.split(':');
  
  if (!forumSettings.relationships) forumSettings.relationships = [];
  
  const relData = {
    id: editIndex !== null ? forumSettings.relationships[editIndex].id : Date.now(),
    person1Type: type1,
    person1Id: id1,
    person2Type: type2,
    person2Id: id2,
    relationship: relType,
    description: relDesc,
  };
  
  if (editIndex !== null && editIndex >= 0) {
    forumSettings.relationships[editIndex] = relData;
    showToast('已保存修改');
  } else {
    forumSettings.relationships.push(relData);
    showToast('关系已添加');
  }

  await localforage.setItem("forumSettings", forumSettings);
  renderForumSettings();
}

async function removeForumRelationship(index) {
  if (!forumSettings.relationships) return;
  forumSettings.relationships.splice(index, 1);
  await localforage.setItem("forumSettings", forumSettings);
  renderForumSettings();
}

// ==================== 发帖 ====================

// 发帖时的图片数据
let forumComposeImages = [];

function openForumCompose() {
  forumComposeImages = []; // 重置图片
  const overlay = document.getElementById("forumComposeOverlay");
  if (overlay) {
    overlay.classList.add("active");
    // 兼容旧版HTML（有forumComposeAuthor元素）和新版HTML（有forumComposeUserInfo元素）
    if (document.getElementById("forumComposeAuthor")) {
      renderForumComposeAuthor();
    } else if (document.getElementById("forumComposeUserInfo")) {
      renderForumComposeUserInfo();
    }
    renderComposeImages();
    const textarea = document.getElementById("forumComposeTextarea");
    if (textarea) {
      textarea.value = "";
      textarea.focus();
    }
  }
}

function closeForumCompose() {
  const overlay = document.getElementById("forumComposeOverlay");
  if (overlay) {
    overlay.classList.remove("active");
  }
  forumComposeImages = [];
}

// 旧版：渲染发帖作者选择器（兼容旧HTML）
function renderForumComposeAuthor() {
  const container = document.getElementById("forumComposeAuthor");
  if (!container) return;

  const globalAvatar = monoAvatarFallback();
  const avatarHtml = (forumSettings.userAvatar || globalAvatar) ? `<img src="${forumSafeImage(forumSettings.userAvatar || globalAvatar)}" alt="">` : getDefaultAvatar();
  const userName = forumSettings.userNickname || "我";

  container.innerHTML = `
    <div class="forum-compose-avatar">${avatarHtml}</div>
    <div class="forum-compose-name">${escapeForumHtml(userName)}</div>
  `;
  // 移除点击事件（不再支持选择发帖人）
  container.onclick = null;
  container.style.cursor = 'default';
}

// 新版：渲染用户信息（不可点击）
function renderForumComposeUserInfo() {
  const container = document.getElementById("forumComposeUserInfo");
  if (!container) return;

  const globalAvatar = monoAvatarFallback();
  const avatarHtml = (forumSettings.userAvatar || globalAvatar) ? `<img src="${forumSafeImage(forumSettings.userAvatar || globalAvatar)}" alt="">` : getDefaultAvatar();
  const userName = forumSettings.userNickname || "我";
  const userHandle = forumSettings.userHandle || generateEnglishHandle(userName);

  container.innerHTML = `
    <div class="forum-compose-avatar">${avatarHtml}</div>
    <div class="forum-compose-user-text">
      <div class="forum-compose-name">${escapeForumHtml(userName)}</div>
      <div class="forum-compose-handle">@${escapeForumHtml(userHandle)}</div>
    </div>
  `;
}
// --- forum_app.js ---

// 处理图片上传 (修改版：集成图片压缩)
function handleComposeImageUpload(input) {
  if (!input || !input.files || input.files.length === 0) return;
  
  Array.from(input.files).forEach(file => {
    if (forumComposeImages.length >= 4) {
      showToast('最多只能添加4张图片');
      return;
    }
    
    // 简单的文件类型检查
    if (!file.type.startsWith('image/')) {
        showToast('请选择图片文件');
        return;
    }

    const reader = new FileReader();
    
    // ★ 注意这里加了 async
    reader.onload = async (e) => {
      let finalData = e.target.result;

      // ★★★ 核心逻辑：尝试调用主程序的压缩函数 ★★★
      if (typeof window.compressImageProcess === 'function') {
          // 只有大于 500KB 的图片才压缩，太小的没必要（可选策略）
          if (finalData.length > 500 * 1024) {
              try {
                  // 显示个提示，因为压缩需要几百毫秒
                  if (typeof showToast === 'function') showToast('正在压缩图片...');
                  
                  // 等待压缩完成
                  const compressedData = await window.compressImageProcess(finalData);
                  
                  // 如果压缩后确实变小了，就用压缩后的；否则用原图
                  if (compressedData.length < finalData.length) {
                      finalData = compressedData;
                      console.log(`[论坛] 图片已压缩: ${(compressedData.length/1024).toFixed(0)}KB`);
                  }
              } catch (err) {
                  console.warn("[论坛] 压缩失败，将使用原图:", err);
              }
          }
      }

      forumComposeImages.push({
        type: 'real',
        data: finalData
      });
      renderComposeImages();
    };
    reader.readAsDataURL(file);
  });
  
  input.value = ''; // 重置input
}

// 插入图片描述占位符
function insertImagePlaceholder() {
  const textarea = document.getElementById("forumComposeTextarea");
  if (!textarea) return;
  
  const placeholder = "[图片:在这里描述图片内容]";
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  
  textarea.value = text.substring(0, start) + placeholder + text.substring(end);
  textarea.focus();
  // 选中描述部分方便用户修改
  textarea.setSelectionRange(start + 4, start + placeholder.length - 1);
}

// 渲染已添加的图片
function renderComposeImages() {
  const container = document.getElementById("forumComposeImages");
  if (!container) return;
  
  if (forumComposeImages.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = forumComposeImages.map((img, idx) => `
    <div class="forum-compose-image-item">
      <img src="${img.data}" alt="">
      <button class="forum-compose-image-remove" onclick="ForumApp.removeComposeImage(${idx})">×</button>
    </div>
  `).join('');
}

// 移除图片
function removeComposeImage(index) {
  forumComposeImages.splice(index, 1);
  renderComposeImages();
}

function showForumAuthorPicker() {
  const globalAvatar = monoAvatarFallback();
  const options = [{ 
    type: "user", 
    name: forumSettings.userNickname || "我",
    avatar: globalAvatar || null
  }];

  forumSettings.aiParticipants.forEach((p) => {
    const char = characters.find((c) => String(c.id) === String(p.charId));
    options.push({
      type: "ai",
      charId: p.charId,
      name: p.nickname || char?.name || "角色",
      avatar: p.avatar || char?.avatar || null
    });
  });

  const html = options
    .map(
      (opt, i) => {
        const avatarHtml = opt.avatar 
          ? `<img src="${opt.avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">` 
          : (opt.type === 'user' ? '👤' : '🤖');
        const isSelected = forumComposeAuthor.type === opt.type && 
          (opt.type === 'user' || String(forumComposeAuthor.charId) === String(opt.charId));
        return `
    <div class="forum-author-option" onclick="ForumApp.selectForumComposeAuthor(${i})">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:32px;height:32px;border-radius:50%;background:#f0f0f0;display:flex;align-items:center;justify-content:center;overflow:hidden;">${avatarHtml}</div>
        <span>${escapeForumHtml(opt.name)}</span>
      </div>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#f48fb1" stroke-width="2" style="opacity:${isSelected ? '1' : '0'}">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
  `;
      }
    )
    .join("");

  const modal = document.createElement("div");
  modal.id = "forumAuthorPickerModal";
  modal.className = "forum-author-picker-modal";
  modal.innerHTML = `
    <div class="forum-author-picker">
      <div class="forum-author-picker-header">
        <span>选择发帖身份</span>
        <button onclick="ForumApp.closeForumAuthorPicker()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="forum-author-picker-list">
        ${html}
      </div>
    </div>
  `;
  modal.onclick = (e) => {
    if (e.target === modal) closeForumAuthorPicker();
  };
  forumMount(modal);

  window.forumAuthorOptions = options;
}

function closeForumAuthorPicker() {
  const modal = document.getElementById("forumAuthorPickerModal");
  if (modal) modal.remove();
}

function selectForumComposeAuthor(index) {
  const opt = window.forumAuthorOptions[index];
  forumComposeAuthor = opt;
  closeForumAuthorPicker();
  // 旧函数已移除，这里不再需要调用
}

async function submitForumPost() {
  const textarea = document.getElementById("forumComposeTextarea");
  const content = textarea?.value?.trim();

  if (!content && forumComposeImages.length === 0) {
    showToast("请输入内容或添加图片");
    return;
  }

  // 用户发帖
  const authorType = "user";
  const authorName = forumSettings.userNickname || "我";
  const authorAvatar = forumSettings.userAvatar || monoAvatarFallback() || "";
  const authorIdentity = forumSettings.userIdentity || "";
  const userHandle = forumSettings.userHandle || generateEnglishHandle(authorName);

  // 构建帖子内容（包含图片）
  let fullContent = content || "";
  
  // 添加真实图片数据
  const images = forumComposeImages.map(img => img.data);

  const newPost = {
    id: Date.now(),
    authorType,
    accountId: monoActiveAccount,
    authorId: null,
    authorName,
    authorAvatar,
    authorIdentity,
    handle: userHandle,
    content: fullContent,
    images: images, // 真实图片数组
    imageCards: forumComposeImages.map(img => img.card ? {cover: img.data, content: img.card.content} : null),
    timestamp: Date.now(),
    likes: 0,
    liked: false,
    retweets: 0,
    views: 0,
    comments: [],
  };

  forumPosts.unshift(newPost);
  await localforage.setItem("forumPosts", forumPosts);

  closeForumCompose();
  renderForumFeed();
  showToast("发布成功");
  
  // 更新粉丝数量
  await updateUserFollowers('post');
  
  // 自动生成评论和互动数据
  generateInteractionsForNewPost(newPost.id);
}

// 生成新帖子的互动数据 (防单一 AI 角色刷屏 + 强制丰富随机 NPC 比例版)
async function generateInteractionsForNewPost(postId) {
  const post = forumPosts.find((p) => p.id === postId);
  if (!post) return;

  const apiConfig = getActiveApiConfig();
  if (!apiConfig || !apiConfig.url || !apiConfig.key) {
    post.views = Math.floor(Math.random() * 500) + 50;
    post.likes = Math.floor(Math.random() * 30) + 5;
    post.retweets = Math.floor(Math.random() * 10);
    await localforage.setItem("forumPosts", forumPosts);
    renderForumFeed();
    return;
  }

  try {
    // 1. 收集 AI 参与者信息 (包含完整人设)
    const participants = forumSettings.aiParticipants.map((p) => {
      const char = characters.find((c) => String(c.id) === String(p.charId));
      const settings = chatSettings[p.charId] || {};
      return {
        name: p.nickname || settings.charName || char?.name || "角色",
        handle: p.handle || generateEnglishHandle(p.nickname || char?.name || ''),
        identity: p.identity || "",
        persona: settings.persona || char?.persona || getCharacterFullPersona(p),
      };
    });

    // 2. 收集 NPC 信息
    const npcs = (forumSettings.npcs || []).map(npc => ({
      name: npc.name,
      handle: npc.handle || generateEnglishHandle(npc.name),
      identity: npc.identity || "",
      persona: npc.persona || "",
    }));

    // 3. 收集人物关系
    const relationships = (forumSettings.relationships || []).map(rel => {
      const person1 = getForumPersonName(rel.person1Type, rel.person1Id);
      const person2 = getForumPersonName(rel.person2Type, rel.person2Id);
      return `${person1} 和 ${person2} 的关系：${rel.relationship}${rel.description ? '（' + rel.description + '）' : ''}`;
    });

    // 4. 构建图片描述
    let imageDesc = "";
    if (post.images && post.images.length > 0) {
      imageDesc = `\n【帖子包含${post.images.length}张图片】`;
    }
    
    if (post.imageCards?.some(Boolean)) imageDesc += "\n" + post.imageCards.map((card, i) => card ? "图片 " + (i + 1) + " 的文字内容：" + card.content : "").filter(Boolean).join("\n");

    // 5. 构建转发信息
    let retweetInfo = "";
    if (post.isRetweet && post.originalPost) {
      const orig = post.originalPost;
      retweetInfo = `\n【这是一条转发帖】\n原帖作者：${orig.authorName}\n原帖内容：${orig.content || '无文字内容'}\n${orig.images && orig.images.length > 0 ? `原帖包含${orig.images.length}张图片` : ''}\n用户转发时说：${post.content || '（未添加评论）'}`;
    }

    // ============================================================
    // ★★★ 核心重构：Prompt 重组，永久注入“随机路人”机制 ★★★
    // ============================================================
    let systemPrompt = `你是一个论坛互动生成器。请根据以下设定为帖子生成评论和互动数据。

【世界观】
${forumSettings.worldview}

【用户信息】
- 昵称：${post.authorName}
- 身份：${forumSettings.userIdentity || "普通用户"}

【帖子内容】${post.content}${imageDesc}${retweetInfo}

【AI角色】（在评论区中属于少数，仅发表 1~2 条高含金量回复，必须严格符合人设）
${participants.length > 0 
  ? participants.map((p, i) => 
      `${i + 1}. ${p.name}（@${p.handle}）：${p.identity || '未设置身份'}${p.persona ? '，性格/人设：' + p.persona.substring(0, 100) : ''}`
    ).join("\n")
  : "无"}`;

    // 无论后台有没有添加固定 NPC，都融合“随机匿名网友”，保证路人数量充沛
    systemPrompt += `\n\n【论坛网民群体（必需，用于活跃气氛）】`;
    if (npcs.length > 0) {
      systemPrompt += `\n1. 【已注册的固定NPC（优先使用）】:\n${npcs.map((n, i) => `  - ${n.name}（@${n.handle}）：${n.identity || '普通网友'}`).join("\n")}`;
    }
    systemPrompt += `\n2. 【随机匿名路人网友（必需，大量生成）】:\n请你自由发挥，扮演 8-15 个各种不同网名、不同背景和说话风格的普通路人网友（例如：“酸汤肥牛”、“夜航船”、“别整天做梦了”、“椰椰椰椰子”、“咸鱼突刺”等逼真且生活化的网名，禁止直接提取示例），参与回帖讨论。`;

    if (relationships.length > 0) {
      systemPrompt += `\n\n【人物关系】评论时体现这些关系\n${relationships.join("\n")}`;
    }

    const messages = [{ role: "system", content: systemPrompt }];
    let userContent = [];
    
    if (post.images && post.images.length > 0) {
      post.images.forEach(imgData => {
        userContent.push({
          type: "image_url",
          image_url: { url: imgData }
        });
      });
    }
    
    userContent.push({
      type: "text",
      text: `请为这条帖子生成互动数据，返回纯JSON对象：
{
  "views": 浏览量(根据用户身份和帖子内容，范围100-5000),
  "likes": 点赞数(范围10-200),
  "retweets": 转发数(范围0-50),
  "comments": [
    {
      "authorType": "ai或npc",
      "authorName": "昵称",
      "handle": "英文用户名",
      "content": "评论内容",
      "likes": 点赞数0-20,
      "replyTo": null或被回复评论在当前数组中的tempIdx(从1开始的序号),
      "replyToName": null或被回复者的【中文昵称】
    }
  ]
}
要求：
1. 根据用户的身份地位合理生成互动数据（身份越高，互动越多）
2. 如果帖子有图片，评论者应该能看到并评论图片内容
3. 请生成 10-20 条评论，让互动看起来热闹一些
4. **评论区人员结构（极其重要）：**
   - **必须有 70% 以上的评论来自“固定NPC”或“随机匿名网友”**，展现出公共论坛该有的热闹围观、闲聊、吃瓜等百家争鸣生态。
   - AI 角色（如“时屿”）在整篇评论区中是“稀缺嘉宾”，他们最多只能发表 1~2 条独立评论。绝对不许出现满篇都是 AI 角色在单机自言自语刷屏的情况。
5. authorType只能是"ai"或"npc"。如果是 "npc"，优先使用已注册的固定NPC，不足的配额必须全部用自由创造的随机匿名网友填满。
6. 评论要自然、符合世界观和角色性格
7. 禁止使用[爱心][笑哭][开心]等方括号表情格式，必须直接使用emoji如❤️😂😊等
8. 如果是转发帖，评论应该针对原帖内容或用户的转发评论
9. 【回复格式与规范】：
   - 评论内容（content字段）必须纯净！**绝对不要**在 content 中包含“回复@xxx：”或“回复 xxx”等前缀。
   - 如果有回复关系，请使用 \`replyTo\` 设为对方在数组中的序号（从1开始），并将 \`replyToName\` 设为对方的**【中文昵称】**（绝对不要写英文handle）。
   - **绝对不要**让任何评论回复用户（楼主/我），因为用户在此贴下还没有发表过评论。`
    });

    messages.push({ role: "user", content: userContent });

    const response = await fetch(forumApiEndpoint(apiConfig), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiConfig.key}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || "gpt-3.5-turbo",
        messages: messages,
        temperature: 0.9,
        max_tokens: parseInt(document.getElementById('apiMaxTokens')?.value) || 4096, 
      }),
    });

    if (!response.ok) throw new Error("API请求失败");

    const data = await response.json();
    let content = data.choices[0]?.message?.content || "";
    if(content.length>250000)throw new Error("返回内容过长，请减少生成数量后重试");

    content = forumCleanStructured(content);
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = forumStructuredValue(content);
      
      post.views = result.views || Math.floor(Math.random() * 500) + 50;
      post.likes = result.likes || Math.floor(Math.random() * 30) + 5;
      post.retweets = result.retweets || Math.floor(Math.random() * 10);

      if (result.comments && Array.isArray(result.comments)) {
        const resolved = mapAndResolveComments(result.comments, post);
        post.comments = [...(post.comments || []), ...resolved];
      }

      await localforage.setItem("forumPosts", forumPosts);
      renderForumFeed();
    }
  } catch (e) {
    console.error("[论坛] 生成互动失败:", e);
    post.views = Math.floor(Math.random() * 500) + 50;
    post.likes = Math.floor(Math.random() * 30) + 5;
    post.retweets = Math.floor(Math.random() * 10);
    await localforage.setItem("forumPosts", forumPosts);
    renderForumFeed();
  }
}

// 保留旧函数名兼容
async function generateCommentsForNewPost(postId) {
  return generateInteractionsForNewPost(postId);
}

// ==================== 评论 ====================

// 设置回复目标
function replyToForumComment(postId, commentId, authorName) {
  forumReplyTarget = { commentId, authorName };
  const input = document.getElementById("forumCommentInput");
  if (input) {
    input.placeholder = `回复 @${authorName}...`;
    input.focus();
  }
}

// 取消回复
function cancelForumReply() {
  forumReplyTarget = null;
  const input = document.getElementById("forumCommentInput");
  if (input) {
    input.placeholder = "写评论...";
  }
}

async function submitForumComment() {
  if (!currentForumPostId) return;

  const input = document.getElementById("forumCommentInput");
  const content = input?.value?.trim();

  if (!content) return;

  const post = forumPosts.find((p) => p.id === currentForumPostId);
  if (!post) return;

  if (!post.comments) post.comments = [];

  // 生成新的评论ID
  const maxId = post.comments.reduce((max, c) => Math.max(max, c.id || 0), 0);

  const newComment = {
    id: maxId + 1,
    authorType: "user",
    accountId: monoActiveAccount,
    authorName: forumSettings.userNickname || "我",
    authorAvatar: monoAvatarFallback() || "",
    content,
    replyTo: forumReplyTarget?.commentId || null,
    replyToName: forumReplyTarget?.authorName || null,
    timestamp: Date.now(),
    likes: 0,
    liked: false,
  };

  post.comments.push(newComment);
  await localforage.setItem("forumPosts", forumPosts);

  input.value = "";
  cancelForumReply(); // 重置回复状态
  renderForumPostDetail();
  
  // 更新粉丝数量
  await updateUserFollowers('comment');

  // 触发AI回复
  generateForumCommentReply(currentForumPostId, newComment);
}


// ==================== 修复：点赞无刷新更新 ====================
async function toggleForumPostLike(postId) {
  // 1. 更新内存数据
  const post = forumPosts.find((p) => Number(p.id) === Number(postId));
  if (!post) return;

  post.liked = !post.liked;
  post.monoLikedBy ||= [];
  post.monoLikedBy=post.monoLikedBy.filter(id=>id!==monoActiveAccount);if(post.liked)post.monoLikedBy.push(monoActiveAccount);
  post.likes = (post.likes || 0) + (post.liked ? 1 : -1);

  // 2. 异步保存到数据库（不阻塞UI）
  localforage.setItem("forumPosts", forumPosts);

  // 3. ★★★ 核心修复：直接操作DOM，而不是重新渲染整个页面 ★★★
  
  // 查找所有关联这个帖子ID的点赞按钮（可能在列表中，也可能在详情页中）
  // 这里的选择器逻辑是查找所有 onclick 包含该 ID 的 .forum-action 元素
  const likeBtns = document.querySelectorAll(`.forum-action[onclick*="toggleForumPostLike(${postId})"], .forum-detail-action[onclick*="toggleForumPostLike(${postId})"]`);

  likeBtns.forEach(btn => {
    const svg = btn.querySelector('svg');
    const span = btn.querySelector('span'); // 列表页有数字，详情页没数字span(在外面)

    // 切换 liked 类（处理颜色）
    if (post.liked) {
      btn.classList.add('liked');
      if (svg) svg.setAttribute('fill', 'currentColor');
    } else {
      btn.classList.remove('liked');
      if (svg) svg.setAttribute('fill', 'none');
    }

    // 更新数字 (仅针对列表页结构)
    if (span) {
      span.innerText = post.likes;
    } else {
      // 详情页结构不一样，数字是分开的，或者是详情页底部的统计
      // 如果是在详情页，我们刷新一下详情区域的数据即可，不用刷新整个APP
      const detailStats = document.querySelector('.forum-detail-stats');
      if (detailStats && currentForumPostId === Number(postId)) {
         // 简单粗暴：如果正在看这个帖子的详情，重新渲染详情部分
         renderForumPostDetail(); 
      }
    }
  });

  // 注意：删除了原来的 smartRenderCurrentPage() 调用
  // 这样就不会导致热点/搜索页面被强制刷新重置了
}

async function toggleForumCommentLike(postId, commentId) {
  const post = forumPosts.find((p) => Number(p.id) === Number(postId));
  if (!post) return;

  const comment = post.comments?.find((c) => Number(c.id) === Number(commentId));
  if (!comment) return;

  comment.liked = !comment.liked;
  comment.monoLikedBy ||= [];comment.monoLikedBy=comment.monoLikedBy.filter(id=>id!==monoActiveAccount);if(comment.liked)comment.monoLikedBy.push(monoActiveAccount);
  comment.likes = (comment.likes || 0) + (comment.liked ? 1 : -1);

  await localforage.setItem("forumPosts", forumPosts);

  // ★★★ DOM 操作替换重绘 ★★★
  // 找到对应的评论DOM
  const commentDiv = document.querySelector(`.forum-comment[data-comment-id="${commentId}"]`);
  if (commentDiv) {
      const likeAction = commentDiv.querySelector(`.forum-comment-action[onclick*="toggleForumCommentLike"]`);
      if (likeAction) {
          const svg = likeAction.querySelector('svg');
          const span = likeAction.querySelector('span');
          
          if (comment.liked) {
              likeAction.classList.add('liked');
              if(svg) svg.setAttribute('fill', 'currentColor');
          } else {
              likeAction.classList.remove('liked');
              if(svg) svg.setAttribute('fill', 'none');
          }
          if(span) span.innerText = comment.likes;
      }
  } else {
      // 如果找不到DOM（极少情况），才回退到重绘
      renderForumPostDetail();
  }
}

// 生成论坛帖子 (完整版：包含关注页过滤 + 原版强力解析逻辑)
async function generateForumPosts() {
  if (!forumSettings.worldview) {
    showToast("请先设置世界观");
    openForumSettings();
    return;
  }

  const apiConfig = getActiveApiConfig();
  if (!apiConfig || !apiConfig.url || !apiConfig.key) {
    showToast("请先配置API");
    return;
  }

  // 刷新按钮开始旋转
  const refreshBtn = document.querySelector(".forum-refresh-btn");
  if (refreshBtn) refreshBtn.classList.add("spinning");

  try {
    const worldbookContent = getForumWorldbookContent(forumSettings.worldview);

    // ============================================================
    // ★★★ 新增：判断是否在关注页刷新 ★★★
    // ============================================================
    const isFollowingTab = (currentForumTab === 'following');
    const followed = forumSettings.followedUsers || [];
    
    // 1. 准备 AI 角色列表 (带ID以便过滤)
    let participants = forumSettings.aiParticipants.map((p) => {
      const char = characters.find((c) => String(c.id) === String(p.charId));
      const settings = chatSettings[p.charId] || {};
      return {
        id: String(p.charId), // ★ 记下ID用于比对
        name: p.nickname || settings.charName || char?.name || "角色",
        handle: p.handle || generateEnglishHandle(p.nickname || char?.name || ''),
        identity: p.identity || "",
        fullPersona: getCharacterFullPersona(p),
      };
    });

    // 2. 准备 NPC 列表 (带ID以便过滤)
    let npcs = (forumSettings.npcs || []).map(npc => ({
      id: String(npc.id), // ★ 记下ID用于比对
      name: npc.name,
      handle: npc.handle || generateEnglishHandle(npc.name),
      identity: npc.identity || "",
      persona: npc.persona || "",
    }));

    // 3. ★★★ 如果在关注页，执行过滤逻辑 ★★★
    if (isFollowingTab) {
        if (followed.length === 0) {
            showToast("你还没有关注任何人，无法刷新");
            if (refreshBtn) refreshBtn.classList.remove("spinning");
            return;
        }

        // 只保留已关注的 ID 或 名字
        participants = participants.filter(p => followed.includes(p.id));
        npcs = npcs.filter(n => followed.includes(n.id) || followed.includes(n.name));
        
        // 如果过滤后没人了
        if (participants.length === 0 && npcs.length === 0) {
             showToast("关注的角色列表为空或未找到");
             if (refreshBtn) refreshBtn.classList.remove("spinning");
             return;
        }
        
        showToast(`正在获取 ${participants.length + npcs.length} 位关注者的动态...`);
    }

    // 4. 准备人物关系
    const relationships = (forumSettings.relationships || []).map(rel => {
      const person1 = getForumPersonName(rel.person1Type, rel.person1Id);
      const person2 = getForumPersonName(rel.person2Type, rel.person2Id);
      return `${person1} 和 ${person2} 的关系：${rel.relationship}${rel.description ? '（' + rel.description + '）' : ''}`;
    });

    // 5. 构建 System Prompt
    let systemPrompt = `你是一个论坛内容生成器。请根据以下设定生成论坛帖子。

【世界观】
${forumSettings.worldview}
${worldbookContent ? '\n【世界书/详细设定】\n' + worldbookContent : ''}

【论坛名称】
${forumSettings.forumName}

【用户信息（参考）】
- 昵称：${forumSettings.userNickname || "用户"}
- 身份：${forumSettings.userIdentity || "普通成员"}
`;

    // ★★★ 动态注入指令：区分 关注页 和 推荐页(广场) 的发帖人比例 ★★★
    if (isFollowingTab) {
        systemPrompt += `\n【重要指令】当前用户正在查看“关注列表”。
请**仅生成**以下列出的【AI角色】或【固定NPC】发布的帖子。
**绝对不要**生成任何陌生路人或未列出角色的帖子。
`;
    } else {
        systemPrompt += `\n【重要指令】当前用户正在查看“广场推荐页”。
为了模拟一个真实、热闹的公共社区：
1. **发帖比例约束**：本次生成的 8-10 条帖子中，**必须有 70% 以上的帖子来自【随机路人网友】或【固定NPC】**（即模拟生动、逼真的论坛生态，不要让同一个角色霸屏）。
2. **AI角色发帖限额**：在单次生成的帖子中，**每个特定的 AI 角色（如“时屿”）最多只能发布 1 条独立帖子**。绝对禁止同一个 AI 角色发布多条帖子，他们属于论坛中的“稀缺嘉宾”。
`;
    }

    systemPrompt += `
【AI角色】
${participants.length > 0 
    ? participants.map((p, i) => `${i + 1}. ${p.name}（@${p.handle}）\n${p.fullPersona || p.identity || '未设置人设'}`).join("\n\n")
    : "无"
}`;

    if (npcs.length > 0) {
      systemPrompt += `\n\n【固定NPC】\n${npcs.map((n, i) => `${i + 1}. ${n.name}（@${n.handle}）`).join("\n")}`;
    }

    // ★★★ 推荐页注入随机发帖网民描述，大模型可由此作为素材发帖 ★★★
    if (!isFollowingTab) {
      systemPrompt += `\n\n【随机路人网友（无需固定，供发帖自由发挥）】
请扮演 10 个以上不同的、具有各种网络生活气息昵称的普通网友（例如：“酸汤肥牛”、“夜航船”、“别整天做梦了”、“椰椰椰椰子”、“咸鱼突刺”等，禁止直接提取昵称），让他们用不同的口吻发布吐槽、分享、求助等日常帖子。`;
    }

    if (relationships.length > 0) {
      systemPrompt += `\n\n【人物关系】\n${relationships.join("\n")}`;
    }

    const userPrompt = `请生成8-10条论坛帖子数据，直接返回JSON数组。
    
【重要格式要求】：
1. 必须是标准的JSON格式，不要有Markdown标记。
2. 帖子内容(content)中如果包含双引号 "，必须转义为 \\" 。建议在内容中尽量使用单引号 ' 代替双引号。
3. 确保JSON结构完整，不要被截断。
4. **关键要求：每条帖子必须包含 4 到 8 条精彩评论！让评论区看起来热闹一点！**
5. **回复格式规范（极其重要）：**
   - 评论内容（content字段）必须纯净！**绝对不要**在 content 中包含“回复@xxx：”或“回复 xxx”等前缀。
   - 如果有回复关系，请使用 \`replyToName\` 字段记录被回复者的**【中文昵称】**（绝对不要写英文handle，例如写“小明”而不是“tiny_time381”）。
   - 绝对不要生成任何回复用户（楼主/我）的评论，因为用户还没有在该贴发表过任何评论。
6. **发帖作者分配（推荐页核心）：**
   - 如果是在推荐页（广场），生成的帖子中，AI角色发帖的数量**不得超过2个**（且不能是同一个AI角色）。
   - 剩下的 6-8 个帖子必须全部分配给【固定NPC】或【随机路人网友】（分配给随机路人时，"authorType" 设为 "npc"，"authorName" 设为随机路人昵称，"handle" 设为英文用户名）。

格式模板：
[
  {
    "authorType": "ai", // 或 "npc"（固定NPC或随机路人均使用 "npc"），绝对不要生成 "user"
    "authorName": "角色名或路人昵称",
    "handle": "Handle名",
    "content": "内容中尽量用单引号。",
    "likes": 12,
    "retweets": 5,
    "views": 1024,
    "comments": [
      {
        "authorType": "npc",
        "authorName": "路人A",
        "content": "评论内容",
        "likes": 2,
        "replyTo": null,
        "replyToName": null
      },
      {
        "authorType": "ai",
        "authorName": "角色名",
        "content": "回复另一条评论的内容（不含任何回复前缀）",
        "likes": 1,
        "replyTo": 1, // 指向被回复的评论在当前comments数组中的序号(从1开始)
        "replyToName": "路人A" // 被回复者的【中文昵称】
      }
    ]
  }
]`;
    
    // 发送请求
    const response = await fetch(forumApiEndpoint(apiConfig), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiConfig.key}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.9,
      }),
    });

    // 1. 基础 HTTP 状态检查
    if (!response.ok) {
       throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    if (
        (data.usage && data.usage.completion_tokens === 0) || 
        (data.choices && data.choices.length > 0 && data.choices[0].finish_reason === "content_filter")
    ) {
        throw new Error("生成失败：内容被AI模型拦截或为空，请修改提示词后重试。");
    }

    // 3. 拦截 API 结构性错误 (如欠费导致没有 choices)
    if (!data.choices || data.choices.length === 0) {
        if (data.error && data.error.message) {
            // 截取过长的错误信息
            const cleanError = data.error.message.length > 50 ? data.error.message.slice(0, 50) + "..." : data.error.message;
            throw new Error(`API报错: ${cleanError}`);
        }
        throw new Error("生成失败：API返回数据异常，请检查Key或模型设置。");
    }

    let content = data.choices[0]?.message?.content || "";
    if(content.length>250000)throw new Error("返回内容过长，请减少生成数量后重试");

    // 1. 基础清洗
    content = forumCleanStructured(content);

    // 2. 尝试标准解析 (保留了你原版的强力容错逻辑)
    let posts = [];
    try {
      let cleanContent = content;
      if (cleanContent.endsWith(',]')) cleanContent = cleanContent.replace(',]', ']');
      if (cleanContent.endsWith(',\n]')) cleanContent = cleanContent.replace(',\n]', '\n]');
      posts = forumParseArray(cleanContent,['posts','data','results']);
    } catch (parseError) { throw parseError; }

    // 获取当前用户昵称用于过滤
    const myName = forumSettings.userNickname || "用户";

    // 3. 数据处理与合并 (保留用户帖子逻辑)
    const newPosts = posts
            .filter(p => {
                if (p.authorType === 'user') return false;
                if (p.authorName === myName && !['ai','npc'].includes(p.authorType)) return false;
                return true;
            })
            .map((p, idx) => {
                const auth = resolveAuthorIdentity(p.authorName,p);
                
                const tempPost = {
                  id: Math.floor(Date.now() + idx * 1000 + Math.random() * 100),
                  authorType: auth.type,
                  authorId: auth.id,
                  authorName: auth.name,
                  authorAvatar: auth.avatar,
                  handle: p.handle || generateEnglishHandle(auth.name),
                  content: p.content || "",
                  timestamp: Date.now() - Math.random() * 7200000,
                  likes: p.likes || Math.floor(Math.random() * 50),
                  liked: false,
                  retweets: p.retweets || Math.floor(Math.random() * 30),
                  views: p.views || Math.floor(Math.random() * 4900) + 100,
                  isRetweet: p.isRetweet || false,
                  originalPost: p.originalPost || null,
                  comments: []
                };

                // 通过清洗器建立严格的物理关联，不发生自生自复
                tempPost.comments = mapAndResolveComments(p.comments, tempPost);
                return tempPost;
            });

    // 保留用户自己的帖子
    const keepPosts = forumPosts.filter(p => p.authorType === 'user' || p.isPinned);
    
    // 合并逻辑 (使用 Map 去重)
    const postMap = new Map();
    // 新帖子优先
    newPosts.forEach(p => postMap.set(p.id, p));
    // 旧帖子追加 (如果ID不冲突)
    forumPosts.forEach(p => {
        if (!postMap.has(p.id)) postMap.set(p.id, p);
    });
    
    forumPosts = Array.from(postMap.values());
    forumPosts.sort((a, b) => b.timestamp - a.timestamp);

    await localforage.setItem("forumPosts", forumPosts);
    showToast(`刷新成功`);
    if (!monoAutoUpdating) renderForumFeed();

  } catch (e) {
    console.error("[论坛] 生成失败:", e);
    if (e.message.includes("JSON")) {
       showToast("生成数据不完整，请重试；如反复出现，请检查模型的输出长度限制");
    } else {
       showToast("生成失败: " + e.message);
    }
  } finally {
    if (refreshBtn) refreshBtn.classList.remove("spinning");
  }
}
// 生成评论回复
async function generateForumCommentReply(postId, userComment) {
  if (Math.random() > 0.6) return; // 40%概率有人回复

  const post = forumPosts.find((p) => p.id === postId);
  if (!post) return;

  const apiConfig = getActiveApiConfig();
  if (!apiConfig) return;

  // 收集已有评论作为上下文
  const commentsContext = (post.comments || [])
    .slice(-5)
    .map(
      (c) =>
        `${c.authorName}${c.replyToName ? " 回复 @" + c.replyToName : ""}：${
          c.content
        }`
    )
    .join("\n");

  // 获取世界书内容
  const contextText = `${forumSettings.worldview}\n${post.content}\n${commentsContext}\n${userComment.content}`;
  const worldbookContent = getForumWorldbookContent(contextText);
  
  // 决定由谁来回复（AI角色或路人）
  let replier = null;
  let replierPersona = '';
  
  // 40%概率由AI角色回复
  if (forumSettings.aiParticipants.length > 0 && Math.random() < 0.4) {
    const randomParticipant = forumSettings.aiParticipants[Math.floor(Math.random() * forumSettings.aiParticipants.length)];
    const char = characters.find(c => String(c.id) === String(randomParticipant.charId));
    replier = {
      name: randomParticipant.nickname || char?.name || '角色',
      avatar: randomParticipant.avatar || char?.avatar || '',
      type: 'ai'
    };
    replierPersona = getCharacterFullPersona(randomParticipant);
  }

  try {
    const prompt = `世界观：${forumSettings.worldview}
${worldbookContent ? '\n世界书设定：\n' + worldbookContent : ''}
帖子：${post.content}
已有评论：
${commentsContext}

用户 "${userComment.authorName}" 刚发了评论：${userComment.content}

${replier ? `请你扮演「${replier.name}」回复这条评论。\n角色人设：${replierPersona}\n要求：符合角色人设和性格特点` : '请你扮演一个网友回复这条评论'}
要求：
1. 符合世界观设定
2. 一句简短的话
3. 只输出回复内容，不要其他
4. 禁止使用[表情]格式，用emoji代替`;

    const response = await fetch(forumApiEndpoint(apiConfig), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiConfig.key}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
        max_tokens: parseInt(document.getElementById('apiMaxTokens')?.value) || 2048,
      }),
    });

    if (!response.ok) return;

    const data = await response.json();
    const reply = data.choices[0]?.message?.content?.trim();

    if (reply) {
      const npcNames = [
        "路人甲",
        "吃瓜群众",
        "热心网友",
        "神秘人",
        "潜水党",
        "围观群众",
      ];
      const maxId = post.comments.reduce(
        (max, c) => Math.max(max, c.id || 0),
        0
      );

      post.comments.push({
        id: maxId + 1,
        authorType: replier ? replier.type : "npc",
        authorName: replier ? replier.name : npcNames[Math.floor(Math.random() * npcNames.length)],
        authorAvatar: replier ? replier.avatar : "",
        content: reply,
        replyTo: userComment.id, // 回复用户的评论
        replyToName: userComment.authorName,
        timestamp: Date.now(),
        likes: 0,
        liked: false,
      });

      await localforage.setItem("forumPosts", forumPosts);

      if (currentForumPostId === postId) {
        renderForumPostDetail();
      }
    }
  } catch (e) {
    console.error("[论坛] 生成回复失败:", e);
  }
}

// 生成更多评论 (同样加入强制路人 NPC 比例约束)
async function generateMoreComments(targetPostId = null) {
  const pid = targetPostId || currentForumPostId;
  if (!pid) return;

  const post = forumPosts.find((p) => p.id === pid);
  if (!post) return;

  const apiConfig = getActiveApiConfig();
  if (!apiConfig || !apiConfig.url || !apiConfig.key) {
    showToast("请先配置API");
    return;
  }

  const btn = document.querySelector(".forum-comment-refresh");
  if (btn) btn.classList.add("loading");
  showToast("网友正在赶来...");

  // 1. 收集已有评论作为上下文
  const existingComments = (post.comments || []).map((c) => ({
    id: c.id,
    author: c.authorName,
    content: c.content,
  }));
  
  // 2. 准备用户信息
  const myName = forumSettings.userNickname || "用户";

  // 3. 准备 AI 角色列表 (包含完整人设)
  const participantsInfo = forumSettings.aiParticipants.map((p) => {
    const char = characters.find((c) => String(c.id) === String(p.charId));
    const charName = p.nickname || char?.name || "角色";
    let rawPersona = getCharacterFullPersona(p);
    if (rawPersona) {
      const myNameForReplace = forumSettings.userNickname || "用户";
      rawPersona = rawPersona.replace(/\{\{user\}\}/gi, myNameForReplace).replace(/<user>/gi, myNameForReplace);
    }
    return { name: charName, fullPersona: rawPersona };
  });
  
  // 4. 准备 NPC 列表
  const npcsInfo = (forumSettings.npcs || []).map(n => 
    `${n.name}（${n.identity || '路人'}）`
  ).join('、');

  // 5. 准备世界书内容
  const contextText = `${forumSettings.worldview}\n${post.content}\n${existingComments.map(c => c.content).join('\n')}`;
  const worldbookContent = getForumWorldbookContent(contextText);

  try {
    let retweetInfo = "";
    if (post.isRetweet && post.originalPost) {
      const orig = post.originalPost;
      retweetInfo = `\n【这是一条转发帖】原帖作者：${orig.authorName}，原帖内容：${orig.content || '无'}`;
    }
    const prompt = `你是一个论坛评论生成器。

【世界观】${forumSettings.worldview}
${worldbookContent ? '\n【世界书/详细设定】\n' + worldbookContent : ''}

【帖子内容】${post.content}${retweetInfo}

【已有评论】
${existingComments.map(c => `[ID:${c.id}] ${c.author}：${c.content}`).join("\n") || "暂无评论"}

【用户信息】昵称：${forumSettings.userNickname || "用户"}

【AI角色】（在评论区中属于少数，必须符合人设）
${participantsInfo.length > 0 ? participantsInfo.map((p, i) => `${i + 1}. ${p.name}\n人设：${p.fullPersona}`).join('\n\n') : "无"}

【固定NPC可用】
${npcsInfo || "无"}

【随机匿名网民（必需，用于活跃气氛）】
请自由发挥，扮演各种不同网名、不同背景和说话风格的普通网友（如：“酸汤肥牛”、“椰椰椰椰子”、“別整天做梦了”、“落叶知秋”等有趣逼真的昵称，禁止直接提取示例）。

请生成5-10条新评论，严格遵守以下要求：
1. **评论区人员比例（极其重要）**：**必须有 70% 以上的新评论来自随机匿名网民或固定 NPC**，以模拟真实公共社区。AI 角色在整篇评论区中属于少数派，他们最多只能发表 1 条独立评论，绝不能连续刷屏。
2. **角色扮演**：AI角色的评论必须符合其人设、语气 and 性格特点！
3. **禁止扮演用户**：绝对不要生成用户的评论。
4. **回复格式**：如果要回复某人，请把被回复者的【中文昵称】写在 \`replyToName\` 字段里，而**不要**写在 content 内容里（千万不要写英文handle，如：写“小明”而不是“tiny_time381”，不要写“回复xx：”）。绝对不要回复用户（楼主），因为用户没有在当前的“已有评论”中发表过评论。
5. **内容纯净**：\`content\` 字段里只写他说的话。
6. **格式要求**：返回纯JSON数组格式。
7. **表情**：禁止使用 [表情] 格式，必须用 emoji。
8. **标点**：如果内容包含引号，请使用单引号。

JSON格式模板：
[
  {"authorType":"npc","authorName":"昵称","content":"单纯的评论内容","replyToName":null},
  {"authorType":"ai","authorName":"角色名","content":"这里的content不要包含'回复xx'","replyToName":"被回复者昵称"}
]`;

    const response = await fetch(forumApiEndpoint(apiConfig), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiConfig.key}` },
      body: JSON.stringify({
        model: apiConfig.model || "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
        max_tokens: parseInt(document.getElementById('apiMaxTokens')?.value) || 2048,
      }),
    });

    if (!response.ok) throw new Error(`API请求失败: ${response.status}`);

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
        throw new Error("生成失败：API返回无效数据。");
    }

    let content = data.choices[0]?.message?.content || "";
    if(content.length>250000)throw new Error("返回内容过长，请减少生成数量后重试");
    content = content.replace(/```json|```/g, "").trim();

    let newComments = [];
    try {
        newComments = forumParseArray(content,['comments','data','results']);
    } catch(e) {
        const match = content.match(/\[[\s\S]*\]/);
        if (match) {
            try { newComments = JSON.parse(match[0]); } catch(e2) {}
        }
    }

    if (newComments.length > 0) {
      const resolved = mapAndResolveComments(newComments, post);
      post.comments = [...(post.comments || []), ...resolved];

      await localforage.setItem("forumPosts", forumPosts);

      if (currentForumPostId === pid) {
        renderForumPostDetail();
      } else {
        renderForumFeed();
      }
      if (resolved.length > 0) showToast(`新增 ${resolved.length} 条评论`);
    }
  } catch (e) {
    console.error("[论坛] 生成评论失败:", e);
    showToast("生成失败: " + e.message);
  } finally {
    if (btn) btn.classList.remove("loading");
  }
}

// 显示帖子更多菜单 (修复版)
function showPostMoreMenu(postId, btnEl) {
  console.log("[论坛] 尝试打开菜单, PostID:", postId); // 添加日志方便调试

  // 1. 移除已存在的菜单（防止重复打开）
  const existingMenu = document.querySelector('.forum-post-more-menu');
  if (existingMenu) existingMenu.remove();
  
  // 2. 创建菜单元素
  const menu = document.createElement('div');
  menu.className = 'forum-post-more-menu';
  
  // ★★★ 核心修复：添加内联样式确保菜单一定可见且层级最高 ★★★
  menu.style.cssText = `
    position: fixed;
    z-index: 10000; /* 调高层级，防止被背景图遮挡 */
    background-color: #ffffff;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 8px 0;
    min-width: 140px;
    display: flex;
    flex-direction: column;
    border: 1px solid #eff3f4;
  `;

  // 3. 设置菜单内容
  menu.innerHTML = `
    <div class="forum-post-more-menu-item delete" onclick="ForumApp.confirmDeletePost(${postId})" 
         style="padding: 12px 16px; display: flex; align-items: center; gap: 10px; color: #ef5350; cursor: pointer; transition: background 0.2s;">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
      <span style="font-size: 14px; font-weight: 500;">删除帖子</span>
    </div>
  `;
  
  // 4. 定位菜单（基于按钮位置）
  const rect = btnEl.getBoundingClientRect();
  menu.style.top = (rect.bottom + 5) + 'px';
  // 确保菜单靠右对齐，防止超出屏幕
  menu.style.right = (window.innerWidth - rect.right) + 'px';
  
  document.body.appendChild(menu);
  
  // 5. 点击其他地方关闭菜单 (使用 setTimeout 防止点击按钮本身时立即触发关闭)
  setTimeout(() => {
    const closeMenu = (e) => {
      // 如果点击的不是菜单内部，也不是刚才那个按钮，就关闭
      if (!menu.contains(e.target) && !btnEl.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    document.addEventListener('click', closeMenu);
  }, 10);
}
// 1. 确认删除弹窗
function confirmDeletePost(postId) {
  // 使用浏览器自带的确认框，简单直接
  if (confirm("确定要删除这条帖子吗？删除后无法恢复。")) {
    deleteForumPost(postId);
  }
  
  // 删除后关闭菜单
  const menu = document.querySelector('.forum-post-more-menu');
  if (menu) menu.remove();
}

// 2. 执行删除逻辑
async function deleteForumPost(postId) {
  // 确保 ID 类型一致
  const idToDelete = Number(postId);
  
  // 在数组中过滤掉这条帖子
  forumPosts = forumPosts.filter(p => Number(p.id) !== idToDelete);
  
  // 保存更新后的列表到数据库
  await localforage.setItem("forumPosts", forumPosts);
  
  showToast("帖子已删除");
  
  // 如果当前正在看这条帖子的详情页，则关闭详情页
  if (currentForumPostId === idToDelete) {
    closeForumPostDetail();
  }
  
  // 刷新当前页面显示
  smartRenderCurrentPage();
}

// 智能渲染当前页面（根据用户所在位置）
function smartRenderCurrentPage() {
  const currentSection = window.currentForumSection || 'home';
  
  // 如果正在查看其他用户主页
  if (currentViewingUser) {
    const userPosts = forumPosts.filter(p => 
      p.authorName === currentViewingUser.name && p.authorType !== 'user'
    );
    renderOtherUserProfile(currentViewingUser, userPosts, false);
    return;
  }
  
  // 根据当前section渲染
  switch (currentSection) {
    case 'profile':
      renderForumProfile();
      break;
    case 'hot':
      renderForumHot();
      break;
    case 'home':
    default:
      renderForumFeed();
      break;
  }
}

// 生成英文handle
function generateEnglishHandle(name) {
  const prefixes = ['cool', 'happy', 'cute', 'super', 'tiny', 'big', 'sweet', 'star', 'moon', 'sun', 'sky', 'lucky', 'nice'];
  const suffixes = ['cat', 'dog', 'bird', 'fan', 'lover', 'star', 'dream', 'day', 'night', 'life', 'world', 'time'];
  const hash = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const prefix = prefixes[hash % prefixes.length];
  const suffix = suffixes[(hash * 7) % suffixes.length];
  const num = (hash % 900) + 100;
  return `${prefix}_${suffix}${num}`;
}

// 处理内容中的图片占位符
// 渲染帖子详情页的图片
function renderDetailImages(post) {
  if (!post.images || post.images.length === 0) return '';
  
  const imageCount = post.images.length;
  const gridClass = imageCount === 1 ? 'single' : imageCount === 2 ? 'double' : imageCount === 3 ? 'triple' : 'quad';
  
  return `
    <div class="forum-post-images ${gridClass}" style="margin: 12px 0;">
      ${post.images.map((img, idx) => `
        <div class="forum-post-image-item" onclick="ForumApp.showForumFullImage('${img.replace(/'/g, "\\'")}')">
          <img src="${img}" alt="">
        </div>
      `).join('')}
    </div>
  `;
}

function formatForumContent(content) {
  if (!content) return "";
  
  // 先转义HTML
  let html = escapeForumHtml(content);
  
  // 处理@提及 - 支持 @用户名 或 @handle 格式
  // 匹配 @后面跟着的中文、英文、数字、下划线，直到遇到空格或标点
  html = html.replace(/@([a-zA-Z0-9_\u4e00-\u9fa5]+)/g, (match, name) => {
    const escapedName = name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    return `<span class="forum-mention" onclick="event.stopPropagation(); ForumApp.handleMentionClick('${escapedName}')">@${name}</span>`;
  });
  
  // 替换 [图片] 或 [图片:描述] 为图片占位符
  // 匹配 [图片] 或 [图片:xxx]
  html = html.replace(/\[图片(?::([^\]]*))?\]/g, (match, desc) => {
    const description = desc || '点击查看图片';
    const escapedDesc = description.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    return `
      <div class="forum-image-placeholder" onclick="ForumApp.showForumImageDesc('${escapedDesc}')">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
      </div>
    `;
  });
  
  // 也处理 [图] 格式
  html = html.replace(/\[图(?::([^\]]*))?\]/g, (match, desc) => {
    const description = desc || '点击查看图片';
    const escapedDesc = description.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    return `
      <div class="forum-image-placeholder" onclick="ForumApp.showForumImageDesc('${escapedDesc}')">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
      </div>
    `;
  });
  
  return html;
}

// 处理@提及点击
function handleMentionClick(name) {
  // 先检查是否是用户自己
  if (name === forumSettings.userNickname || name === forumSettings.userHandle) {
    switchForumSection('profile');
    return;
  }
  
  // 查找AI角色 - 通过昵称或handle匹配
  for (const p of forumSettings.aiParticipants) {
    const char = characters.find(c => String(c.id) === String(p.charId));
    const charName = p.nickname || char?.name || '';
    const charHandle = p.handle || generateEnglishHandle(charName);
    
    if (charName === name || charHandle === name) {
      openOtherUserProfile('ai', charName, p.charId);
      return;
    }
  }
  
  // 查找NPC - 通过名字或handle匹配
  for (const npc of (forumSettings.npcs || [])) {
    const npcHandle = npc.handle || generateEnglishHandle(npc.name);
    
    if (npc.name === name || npcHandle === name) {
      openOtherUserProfile('npc', npc.name, npc.id);
      return;
    }
  }
  
  // 查找帖子中出现过的作者
  const matchedPost = forumPosts.find(p => {
    const postHandle = p.handle || generateEnglishHandle(p.authorName);
    return p.authorName === name || postHandle === name;
  });
  
  if (matchedPost) {
    openOtherUserProfile(matchedPost.authorType, matchedPost.authorName, matchedPost.authorId || '');
    return;
  }
  
  // 查找评论中出现过的作者
  for (const post of forumPosts) {
    const matchedComment = (post.comments || []).find(c => c.authorName === name);
    if (matchedComment) {
      openOtherUserProfile(matchedComment.authorType || 'npc', matchedComment.authorName, '');
      return;
    }
  }
  
  // 如果找不到，创建一个随机用户主页
  openOtherUserProfile('random', name, '');
}

// 显示图片描述弹窗 (修复版：挂载到论坛内部 + 强制高层级)
function showForumImageDesc(desc) {
  // 阻止事件冒泡，防止触发底下的元素
  if (window.event) window.event.stopPropagation();
  
  // 创建弹窗
  const modal = document.createElement('div');
  modal.className = 'forum-image-modal';
  
  // ★★★ 核心修复1：强制提升层级，确保在最上层 ★★★
  modal.style.zIndex = "10005"; 
  
  modal.innerHTML = `
    <div class="forum-image-modal-content">
      <div class="forum-image-modal-header">
        <span>图片描述</span>
        <button class="forum-image-modal-close">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="forum-image-modal-body">
        <div class="forum-image-preview">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </div>
        <p class="forum-image-desc-text">${escapeForumHtml(desc)}</p>
      </div>
    </div>
  `;

  // 关闭逻辑
  const closeFunc = () => modal.remove();
  
  // 绑定点击关闭（点击背景或关闭按钮）
  modal.onclick = (e) => {
    if (e.target === modal) closeFunc();
  };
  // 绑定按钮关闭
  setTimeout(() => {
    const closeBtn = modal.querySelector('.forum-image-modal-close');
    if(closeBtn) closeBtn.onclick = closeFunc;
  }, 0);

  // ★★★ 核心修复2：优先挂载到 forumPage，保证不被遮挡 ★★★
  const forumPage = document.getElementById('forumPage');
  if (forumPage) {
    forumPage.appendChild(modal);
  } else {
    forumMount(modal);
  }
}

function formatForumTime(timestamp) {
  if (!timestamp) return "";
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return Math.floor(diff / 60000) + "分钟前";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "小时前";
  if (diff < 604800000) return Math.floor(diff / 86400000) + "天前";

  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function escapeForumHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// 获取默认头像（灰色背景+白色人形轮廓的SVG）
function getDefaultAvatar() {
  return `<img src="${getDefaultAvatarDataUrl()}" alt="" class="default-avatar">`;
}

// 保留旧函数名兼容，但改为返回默认头像
function getAvatarEmoji(name) {
  return getDefaultAvatar();
}

function switchForumTab(tab) {
  currentForumTab = tab;
  document
    .querySelectorAll(".forum-tab")
    .forEach((t) => t.classList.remove("active"));
  event.target.classList.add("active");
  renderForumFeed();
}

// 打开引用转发界面（推特风格）
function openQuoteRetweet(postId) {
  const post = forumPosts.find(p => Number(p.id) === Number(postId));
  if (!post) return;
  
  // 获取用户信息
  const globalAvatar = monoAvatarFallback();
  const userAvatar = forumSettings.userAvatar || globalAvatar || getDefaultAvatarDataUrl();
  const userName = forumSettings.userNickname || "我";
  const userHandle = forumSettings.userHandle || generateEnglishHandle(userName);
  
  // 获取原帖信息
  const origAvatar = post.authorAvatar || getDefaultAvatarDataUrl();
  const origName = post.authorName || "用户";
  const origHandle = post.handle || generateEnglishHandle(origName);
  const origContent = post.content || "";
  
  // 原帖图片预览
  let origImagesHtml = '';
  if (post.images && post.images.length > 0) {
    origImagesHtml = `
      <div class="forum-quote-preview-images">
        ${post.images.slice(0, 2).map(img => `<img src="${img}" alt="">`).join('')}
        ${post.images.length > 2 ? `<span class="forum-quote-more-images">+${post.images.length - 2}</span>` : ''}
      </div>
    `;
  }
  
  const modal = document.createElement('div');
  modal.id = 'forumQuoteRetweetModal';
  modal.className = 'forum-compose-overlay active';
  modal.innerHTML = `
    <div class="forum-compose-header">
      <button class="forum-compose-cancel" onclick="ForumApp.closeQuoteRetweet()">取消</button>
      <div class="forum-compose-title">引用</div>
      <button class="forum-compose-submit" onclick="ForumApp.submitQuoteRetweet(${postId})">发布</button>
    </div>
    <div class="forum-compose-body forum-quote-body">
      <div class="forum-compose-user-info">
        <div class="forum-compose-avatar"><img src="${userAvatar}" alt=""></div>
        <div class="forum-compose-user-text">
          <div class="forum-compose-name">${escapeForumHtml(userName)}</div>
          <div class="forum-compose-handle">@${escapeForumHtml(userHandle)}</div>
        </div>
      </div>
      <textarea 
        class="forum-compose-textarea forum-quote-textarea" 
        id="forumQuoteTextarea" 
        placeholder="添加评论..."
      ></textarea>
      
      <!-- 引用的原帖卡片 -->
      <div class="forum-quote-preview">
        <div class="forum-quote-preview-header">
          <img class="forum-quote-preview-avatar" src="${origAvatar}" alt="">
          <span class="forum-quote-preview-name">${escapeForumHtml(origName)}</span>
          <span class="forum-quote-preview-handle">@${origHandle}</span>
        </div>
        <div class="forum-quote-preview-content">${escapeForumHtml(origContent)}</div>
        ${origImagesHtml}
      </div>
    </div>
  `;
  
  forumMount(modal);
  
  // 自动聚焦输入框
  setTimeout(() => {
    document.getElementById('forumQuoteTextarea')?.focus();
  }, 100);
}

// 关闭引用转发界面
function closeQuoteRetweet() {
  document.getElementById('forumQuoteRetweetModal')?.remove();
}

// 提交引用转发
async function submitQuoteRetweet(postId) {
  const originalPost = forumPosts.find(p => Number(p.id) === Number(postId));
  if (!originalPost) {
    showToast('帖子不存在');
    return;
  }
  
  const content = document.getElementById('forumQuoteTextarea')?.value?.trim() || '';
  
  // 获取用户信息
  const userName = forumSettings.userNickname || "我";
  const userAvatar = monoAvatarFallback() || "";
  const userHandle = forumSettings.userHandle || generateEnglishHandle(userName);
  
  // 创建引用转发帖子
  const retweetPost = {
    id: Date.now(),
    authorType: "user",
    accountId: monoActiveAccount,
    authorId: null,
    authorName: userName,
    authorAvatar: userAvatar,
    handle: userHandle,
    content: content, // 用户的评论
    timestamp: Date.now(),
    likes: 0,
    liked: false,
    retweets: 0,
    views: 0,
    comments: [],
    isRetweet: true,
    originalPostId: originalPost.id,
    originalPost: {
      id: originalPost.id,
      authorType: originalPost.authorType,
      authorId: originalPost.authorId,
      authorName: originalPost.authorName,
      authorAvatar: originalPost.authorAvatar,
      handle: originalPost.handle || generateEnglishHandle(originalPost.authorName),
      content: originalPost.content,
      images: originalPost.images,
      timestamp: originalPost.timestamp,
    }
  };
  
  // 增加原帖的转发数
  originalPost.retweets = (originalPost.retweets || 0) + 1;
  
  // 添加到帖子列表
  forumPosts.unshift(retweetPost);
  await localforage.setItem("forumPosts", forumPosts);
  
  closeQuoteRetweet();
  closeForumPostDetail();
  showToast('转发成功');
  renderForumFeed();
  
  // 自动生成互动数据
  generateInteractionsForNewPost(retweetPost.id);
}

// 保留旧函数名兼容（不再使用选择菜单）
function showRetweetMenu(postId) {
  openQuoteRetweet(postId);
}

// ==================== 1. 弹出选择器 (纯单聊版) ====================
// 移除了群聊列表的生成逻辑，只显示角色列表

function retweetToChat(postId) {
  const post = forumPosts.find(p => Number(p.id) === Number(postId));
  if (!post) return;
  
  // 获取角色列表
  const charList = window.characters || [];
  
  if (charList.length === 0) {
    showToast('未找到任何角色');
    return;
  }
  
  // 生成选项HTML
  const optionsHtml = charList.map(char => `
    <div class="forum-char-option" onclick="ForumApp.sendRetweetToChar('${char.id}', ${postId})">
      <div class="forum-char-avatar">
        ${char.avatar ? `<img src="${char.avatar}" alt="">` : '🤖'}
      </div>
      <div class="forum-char-name">${char.name || '角色'}</div>
    </div>
  `).join('');
  
  // 创建选择器弹窗
  const modal = document.createElement('div');
  modal.className = 'forum-char-picker-modal';
  modal.innerHTML = `
    <div class="forum-char-picker">
      <div class="forum-char-picker-header">
        <span>转发给...</span>
        <button onclick="this.closest('.forum-char-picker-modal').remove()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="forum-char-picker-list">
        ${optionsHtml}
      </div>
    </div>
  `;
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  forumMount(modal);
}

// ==================== 2. 执行转发 (AI认知增强版) ====================
async function sendRetweetToChar(targetId, postId) {
  // 1. 获取帖子数据
  // 必须转化为数字比较，防止类型不一致导致找不到
  const post = forumPosts.find(p => Number(p.id) === Number(postId));
  
  if (!post) {
    showToast('帖子数据异常');
    return;
  }
  
  // 2. 关闭选择器弹窗 (如果存在)
  const modal = document.querySelector('.forum-char-picker-modal');
  if (modal) modal.remove();
  
  // 3. 从主程序全局列表获取目标角色 (确保能同步到聊天界面)
  const globalChatList = window.chatList || [];
  // ID 转字符串比较，兼容性更好
  const chat = globalChatList.find(c => String(c.id) === String(targetId));
  
  if (!chat) {
    showToast('目标角色不存在，请检查聊天列表');
    return;
  }
  
  // 4. 构建转发卡片数据 (用于显示)
  // 如果 handle 为空，临时生成一个看起来像样的
  const safeHandle = post.handle || generateEnglishHandle(post.authorName);
  
  const retweetCard = {
    type: 'retweet_card', 
    postId: post.id,
    authorName: post.authorName,
    authorAvatar: post.authorAvatar || '', // 允许为空，render函数会处理默认图
    handle: safeHandle,
    content: post.content || '分享图片', // 防止内容为空
    likes: post.likes || 0,
    retweets: post.retweets || 0,
    comments: post.comments?.length || 0,
    views: post.views || 0  // 传入浏览量
  };
  
  // 5. 生成卡片 HTML (这是给用户看的 UI)
  const cardHtml = renderRetweetCard(retweetCard);

  // 6. 生成时间戳
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  // ============================================================
  // ★★★ 核心逻辑：给 AI 注入认知 (Prompt Engineering) ★★★
  // ============================================================
  
  // A. 判断帖子归属 (是谁的帖子？)
  const myName = forumSettings.userNickname || "我";
  let ownershipText = "";
  
  // 这里的判断逻辑是：如果是 user 类型，或者作者名和我的昵称一样，就是“我”的帖子
  if (post.authorType === 'user' || post.authorName === myName) {
      ownershipText = "用户转发了【自己 (User)】发布的帖子";
  } else if (post.authorName === chat.name) {
      ownershipText = `用户转发了【你自己 (${chat.name})】发布的帖子`; // 转发了AI自己的帖子
  } else {
      ownershipText = `用户转发了【${post.authorName}】发布的帖子`; // 转发了路人/第三方的帖子
  }
  
  // B. 提取内容摘要 (防止内容过长，截取前100字)
  let cleanContent = post.content.replace(/<[^>]+>/g, '').trim(); // 去掉HTML标签
  if (cleanContent.length > 100) cleanContent = cleanContent.substring(0, 100) + "...";
  if (!cleanContent) cleanContent = "[分享图片/视频]";
  
  // C. 组合最终的 System Note 给 AI
  const aiInstruction = `[系统通知：${ownershipText}]\n原帖内容：“${cleanContent}”\n(请根据帖子归属和内容进行回应)`;

  // ============================================================

  // 7. 构造消息对象
  const msgObj = {
      id: Date.now(),
      isSelf: true,        // 标记为我发的
      text: cardHtml,      // 界面显示：漂亮的卡片
      time: timeStr,
      timestamp: Date.now(),
      type: 'retweet',     // 类型标记
      
      // ★ 最重要的一行：AI 实际上读到的是这段话 ★
      contentDescription: aiInstruction 
  };
  
  // 8. 存入聊天记录
  if (!chat.messages) chat.messages = [];
  chat.messages.push(msgObj);
  
  // 更新列表预览文字
  chat.msg = '[转发帖子]';
  chat.time = timeStr;
  
  // 9. 保存数据到 IndexedDB (调用主程序函数)
  if (typeof window.saveData === 'function') {
      window.saveData(); 
  }
  
  // 10. 页面跳转逻辑
  // a. 关闭可能的帖子详情弹窗
  closeForumPostDetail(); 
  
  // b. 隐藏论坛全屏页
  const forumPage = document.getElementById('forumPage');
  if (forumPage) forumPage.style.display = 'none';
  
  // c. 确保聊天主页面显示
  const chatApp = document.getElementById('chatAppPage');
  if (chatApp) chatApp.style.display = 'flex';
  
  // d. 打开目标聊天室并滚动到底部
  if (typeof window.openChatRoom === 'function') {
    // 加一点点延时让 DOM 渲染完成
    setTimeout(() => {
        window.openChatRoom(chat.id);
        
        // 强制滚动到底部
        const msgContainer = document.getElementById('roomMessages');
        if (msgContainer) {
            msgContainer.scrollTop = msgContainer.scrollHeight;
        }
    }, 100);
  } else {
    // 兜底提示
    showToast(`已发送给 ${chat.name}`);
  }
}


// 转发到个人主页（旧函数名兼容，重定向到引用转发）
function retweetToProfile(postId) {
  openQuoteRetweet(postId);
}

// 渲染转发卡片 (完美复刻推特底部栏)
function renderRetweetCard(cardData) {
  if (!cardData) return '';
  
  // 头像处理
  let avatarHtml = '';
  if (cardData.authorAvatar && cardData.authorAvatar !== '') {
      avatarHtml = `<img src="${cardData.authorAvatar}" alt="">`;
  } else {
      avatarHtml = `<svg viewBox="0 0 24 24" fill="#ccc"><circle cx="12" cy="8" r="4"/><path d="M12 14c-5 0-9 4-9 9h18c0-5-4-9-9-9z"/></svg>`;
  }
  
  // 数据格式化 (把数字显示得更好看一点)
  const formatNum = (n) => n > 999 ? (n/1000).toFixed(1)+'k' : n;
  
  const comments = formatNum(cardData.comments || 0);
  const retweets = formatNum(cardData.retweets || 0);
  const likes = formatNum(cardData.likes || 0);
  // 浏览量模拟一个比点赞大的数
  const views = formatNum(cardData.views || (cardData.likes * 20 + 50)); 

  return `
    <div class="retweet-card" onclick="event.stopPropagation(); window.ForumApp.openForumPostFromCard(${cardData.postId})">
      <!-- 顶部灰色条 -->
      <div class="retweet-card-label">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 1l4 4-4 4"></path>
          <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
          <path d="M7 23l-4-4 4-4"></path>
          <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
        </svg>
        <span>转发的帖子</span>
      </div>
      
      <div class="retweet-card-body">
        <!-- 作者栏 -->
        <div class="retweet-card-header">
          <div class="retweet-card-avatar">${avatarHtml}</div>
          <div class="retweet-card-author-info">
            <span class="retweet-card-author">${escapeForumHtml(cardData.authorName)}</span>
            <span class="retweet-card-handle">@${cardData.handle}</span>
          </div>
        </div>
        
        <!-- 内容 -->
        <div class="retweet-card-content">${escapeForumHtml(cardData.content)}</div>
        
        <!-- 底部推特风格栏 (Comment, Retweet, Like, View) -->
        <div class="retweet-card-footer">
            
            <!-- 1. 评论 -->
            <div class="retweet-stat-item">
                <svg viewBox="0 0 24 24"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.295c-4.42 0-8.005-3.58-8.005-8.01z"></path></svg>
                <span>${comments}</span>
            </div>

            <!-- 2. 转发 -->
            <div class="retweet-stat-item">
                <svg viewBox="0 0 24 24"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"></path></svg>
                <span>${retweets}</span>
            </div>

            <!-- 3. 喜欢 (空心) -->
            <div class="retweet-stat-item">
                <svg viewBox="0 0 24 24"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path></svg>
                <span>${likes}</span>
            </div>

            <!-- 4. 浏览 (柱状图图标) -->
            <div class="retweet-stat-item">
                <svg viewBox="0 0 24 24"><path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.25 0V0h2v21h-2z"></path></svg>
                <span>${views}</span>
            </div>

        </div>
      </div>
    </div>
  `;
}


// ★★★ 必须搭配这个全局跳转函数一起使用 (适配 script.js 版) ★★★
window.openForumPostFromCard = async function(postId) {
  console.log("[论坛] 尝试从卡片跳转帖子:", postId);
  
  // 1. 调用 script.js 里的打开应用函数，切换到论坛 App
  if (typeof window.openApp === 'function') {
      window.openApp('Page 4'); // 对应 Dock 栏第4个图标（论坛）
  } else {
      // 备用方案：直接操作 DOM
      const overlay = document.getElementById('appOverlay');
      const forumPage = document.getElementById('forumPage');
      if (overlay) overlay.classList.add('active');
      if (forumPage) {
          document.querySelectorAll('.app-page').forEach(p => p.style.display = 'none');
          forumPage.style.display = 'block';
      }
  }
  
  // 2. 确保论坛数据已加载 (防止页面是被强杀后重新打开的)
  if (typeof window.initForumApp === 'function') {
      window.initForumApp();
  }

  // 3. 延时打开详情 (给页面切换一点动画时间)
  setTimeout(() => {
    // 确保把ID转为数字
    if (typeof window.openForumPostDetail === 'function') {
        window.openForumPostDetail(Number(postId));
    }
  }, 200);
};


// [修改] 底部导航切换
function switchForumSection(section) {
  // ★ 如果是私信，直接打开全屏页，不改变底部 Tab 状态
  if (section === 'dm') {
    openDirectMessages();
    return; 
  }

  // 其他 Tab 正常切换高亮和内容
  const items = document.querySelectorAll(".forum-nav-item");
  items.forEach((item) => item.classList.remove("active"));
  
  let activeIndex = 0;
  if (section === 'home') activeIndex = 0;
  else if (section === 'hot') activeIndex = 1;
  // dm 是 2，但在上面已经 return 了，所以不会执行到这里
  else if (section === 'profile') activeIndex = 4;
  
  if (items[activeIndex]) {
    items[activeIndex].classList.add("active");
  }
  
  window.currentForumSection = section;
  
  if (section === 'home') renderForumFeed();
  else if (section === 'hot') renderForumHot();
  else if (section === 'profile') renderForumProfile();
}

// 统一的刷新处理函数
function handleForumRefresh() {
  const currentSection = window.currentForumSection || 'home';
  
  if (currentSection === 'hot') {
    // 如果在搜索结果页面，刷新搜索结果
    if (currentHotView === 'search_results' && currentSearchQuery) {
      refreshSearchResults(currentSearchQuery);
    } else {
      // 刷新热点主页（重新渲染即可，因为热门帖子会根据主页数据更新）
      const refreshBtn = document.querySelector(".forum-refresh-btn");
      if (refreshBtn) refreshBtn.classList.add("spinning");
      
      // 先生成新的主页帖子
      generateForumPosts().then(() => {
        // 完成后重新渲染热点页面
        renderForumHot();
      });
    }
  } else {
    // 主页或其他页面，正常生成帖子
    generateForumPosts();
  }
}

// ==================== 热点页面 ====================

// 当前热点页面状态
let currentHotView = 'main'; // 'main' 或 'search_results'
let currentSearchQuery = ''; // 当前搜索词

function renderForumHot() {
  const feed = document.getElementById("forumFeed");
  if (!feed) return;
  
  currentHotView = 'main';
  
  // 显示顶栏和FAB
  const tabs = document.querySelector('.forum-tabs');
  const fab = document.querySelector('.forum-fab');
  if (tabs) tabs.style.display = 'flex';
  if (fab) fab.style.display = 'flex';
  
  // 恢复safe area padding（从个人主页返回时）
  const forumContainer = document.querySelector('.forum-container');
  if (forumContainer) forumContainer.style.paddingTop = '';
  
  // 隐藏主页的返回按钮、tab和设置按钮，显示热点标题
  const backBtn = document.querySelector('.forum-back-btn');
  const homeTabs = document.querySelectorAll('.forum-home-tab');
  const hotTitle = document.querySelector('.forum-hot-title');
  const settingsBtn = document.querySelector('.forum-settings-btn');
  if (backBtn) backBtn.style.display = 'none';
  homeTabs.forEach(tab => tab.style.display = 'none');
  if (hotTitle) hotTitle.style.display = 'block';
  if (settingsBtn) settingsBtn.style.display = 'none';
  
  // 生成热点话题数据
  const hotTopics = generateHotTopics();
  const trendingPosts = getTrendingPosts();
  
  // 获取世界观相关的热搜关键词
  const worldviewKeywords = extractWorldviewKeywords();
  
  feed.innerHTML = `
    <div class="forum-hot-container">
      <!-- 搜索栏 -->
      <div class="forum-hot-search">
        <div class="forum-hot-search-box" onclick="ForumApp.focusHotSearch()">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#536471" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" id="forumHotSearchInput" placeholder="搜索" 
            onkeydown="ForumApp.handleHotSearchKeydown(event)"
            oninput="ForumApp.handleHotSearchInput(event)">
          <button class="forum-hot-search-btn" onclick="ForumApp.executeHotSearch()" style="display:none;">
            搜索
          </button>
        </div>
      </div>
      
      <!-- 热门话题区域 -->
      <div class="forum-hot-section">
        <div class="forum-hot-section-header">
          <span class="forum-hot-section-title">热门话题</span>
        </div>
        <div class="forum-hot-topics">
          ${hotTopics.map((topic, idx) => `
            <div class="forum-hot-topic-item" onclick="ForumApp.searchForumTopic('${ForumApp.escapeForumHtml(topic.tag)}')">
              <div class="forum-hot-topic-rank">${idx + 1}</div>
              <div class="forum-hot-topic-content">
                <div class="forum-hot-topic-category">${escapeForumHtml(topic.category)}</div>
                <div class="forum-hot-topic-tag">#${escapeForumHtml(topic.tag)}</div>
                <div class="forum-hot-topic-count">${topic.count} 条帖子</div>
              </div>
              <div class="forum-hot-topic-trend ${topic.trend}">
                ${topic.trend === 'up' ? '↑' : topic.trend === 'down' ? '↓' : '—'}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- 热门帖子区域 -->
      <div class="forum-hot-section">
        <div class="forum-hot-section-header">
          <span class="forum-hot-section-title">热门帖子</span>
        </div>
        <div class="forum-hot-posts">
          ${trendingPosts.length > 0 
            ? trendingPosts.map(post => renderForumPostItem(post)).join('')
            : '<div class="forum-hot-empty">暂无热门帖子<br><span style="font-size:13px;color:#9ca3af;">点击上方刷新按钮生成内容</span></div>'
          }
        </div>
      </div>
      
      <!-- 猜你想搜 -->
      <div class="forum-hot-section">
        <div class="forum-hot-section-header">
          <span class="forum-hot-section-title">猜你想搜</span>
        </div>
        <div class="forum-hot-keywords">
          ${worldviewKeywords.map(kw => `
            <span class="forum-hot-keyword" onclick="ForumApp.searchForumTopic('${ForumApp.escapeForumHtml(kw)}')">${escapeForumHtml(kw)}</span>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// 聚焦搜索框
function focusHotSearch() {
  const input = document.getElementById('forumHotSearchInput');
  if (input) input.focus();
}

// 处理搜索输入
function handleHotSearchInput(event) {
  const btn = document.querySelector('.forum-hot-search-btn');
  if (btn) {
    btn.style.display = event.target.value.trim() ? 'block' : 'none';
  }
}

// 处理搜索键盘事件
function handleHotSearchKeydown(event) {
  if (event.key === 'Enter') {
    executeHotSearch();
  }
}

// 执行搜索
function executeHotSearch() {
  const input = document.getElementById('forumHotSearchInput');
  const query = input?.value?.trim();
  if (query) {
    searchForumTopic(query);
  }
}

// 搜索/点击话题 - 生成相关帖子
async function searchForumTopic(topic) {
  if (!topic) return;
  
  currentSearchQuery = topic;
  currentHotView = 'search_results';
  
  const feed = document.getElementById("forumFeed");
  if (!feed) return;
  
  // 隐藏顶栏（搜索结果页有自己的header）
  const tabs = document.querySelector('.forum-tabs');
  if (tabs) tabs.style.display = 'none';
  
  // 移除safe area padding（搜索结果header有自己的safe area处理）
  const forumContainer = document.querySelector('.forum-container');
  if (forumContainer) forumContainer.style.paddingTop = '0';
  
  // 显示搜索结果页面（带loading）
  feed.innerHTML = `
    <div class="forum-hot-container">
      <!-- 搜索结果头部 -->
      <div class="forum-search-header">
        <button class="forum-search-back" onclick="ForumApp.renderForumHot()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <div class="forum-search-title">#${escapeForumHtml(topic)}</div>
        <button class="forum-search-refresh" onclick="ForumApp.refreshSearchResults('${ForumApp.escapeForumHtml(topic)}')" title="刷新">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>
      </div>
      
      <!-- Loading状态 -->
      <div class="forum-search-loading" id="forumSearchLoading">
        <div class="forum-search-spinner"></div>
        <div class="forum-search-loading-text">正在搜索「${escapeForumHtml(topic)}」相关内容...</div>
      </div>
      
      <!-- 搜索结果 -->
      <div class="forum-search-results" id="forumSearchResults"></div>
    </div>
  `;
  
  // 调用API生成相关帖子
  await generateTopicPosts(topic);
}

// 刷新搜索结果
async function refreshSearchResults(topic) {
  const refreshBtn = document.querySelector('.forum-search-refresh');
  if (refreshBtn) refreshBtn.classList.add('spinning');
  
  // 显示loading
  const loading = document.getElementById('forumSearchLoading');
  const results = document.getElementById('forumSearchResults');
  if (loading) loading.style.display = 'flex';
  if (results) results.innerHTML = '';
  
  await generateTopicPosts(topic);
  
  if (refreshBtn) refreshBtn.classList.remove('spinning');
}

// ==================== 修复：热点生成 (原版提示词 + 智能解析) ====================
async function generateTopicPosts(topic) {
  const apiConfig = getActiveApiConfig();
  if (!apiConfig || !apiConfig.url || !apiConfig.key) {
    showSearchError("请先配置API");
    return;
  }
  
  try {
    // 1. 数据准备 (保持原逻辑)
    const worldbookContent = getForumWorldbookContent(`${forumSettings.worldview}\n${topic}`);
    
    const participants = forumSettings.aiParticipants.map((p) => {
      const char = characters.find((c) => String(c.id) === String(p.charId));
      const settings = chatSettings[p.charId] || {};
      return {
        name: p.nickname || settings.charName || char?.name || "角色",
        handle: p.handle || generateEnglishHandle(p.nickname || char?.name || ''),
        identity: p.identity || "",
        fullPersona: getCharacterFullPersona(p),
      };
    });

    const npcs = (forumSettings.npcs || []).map(npc => ({
      name: npc.name,
      handle: npc.handle || generateEnglishHandle(npc.name),
      identity: npc.identity || "",
      persona: npc.persona || "",
    }));

    const relationships = (forumSettings.relationships || []).map(rel => {
      const person1 = getForumPersonName(rel.person1Type, rel.person1Id);
      const person2 = getForumPersonName(rel.person2Type, rel.person2Id);
      return `${person1} 和 ${person2} 的关系：${rel.relationship}${rel.description ? '（' + rel.description + '）' : ''}`;
    });

    // 2. ★★★ System Prompt (完全保持你的原版逻辑) ★★★
    let systemPrompt = `你是一个论坛内容生成器。请根据以下设定生成与「${topic}」相关的论坛帖子。

【世界观】
${forumSettings.worldview || '现代都市'}
${worldbookContent ? '\n【世界书/详细设定】\n' + worldbookContent : ''}

【论坛名称】
${forumSettings.forumName || '广场'}

【搜索话题】
${topic}

【用户信息（仅供参考，不要生成用户的帖子或评论）】
- 昵称：${forumSettings.userNickname || "用户"}
- 身份：${forumSettings.userIdentity || "普通成员"}

【AI角色】可以使用这些角色发帖和评论，必须符合人设！
${participants.length > 0 
  ? participants.map((p, i) => 
      `${i + 1}. ${p.name}（@${p.handle}）\n${p.fullPersona || p.identity || '未设置人设'}`
    ).join("\n\n")
  : "无"}`;

    if (npcs.length > 0) {
      systemPrompt += `

【固定NPC】可以使用这些NPC发帖和评论
${npcs.map((n, i) => 
  `${i + 1}. ${n.name}（@${n.handle}）：${n.identity || '普通网友'}${n.persona ? '，性格：' + n.persona : ''}`
).join("\n")}`;
    }

    if (relationships.length > 0) {
      systemPrompt += `

【人物关系】在帖子互动中体现这些关系
${relationships.join("\n")}`;
    }

    systemPrompt += `

【要求】
1. 生成10-15条与「${topic}」话题相关的论坛帖子
2. 帖子内容必须围绕「${topic}」展开，可以是讨论、分享、吐槽、求助等
3. 帖子作者只能是AI角色、固定NPC或随机路人，绝对不要生成用户的帖子
4. 内容要符合世界观设定，有趣且有互动感
5. 每条帖子必须有5-10条评论
6. 部分帖子可以包含图片，用[图片:图片描述]格式
7. 返回JSON数组格式
8. 禁止使用[爱心][笑哭]等方括号表情格式，必须直接使用emoji如❤️😂😊等`;

    // 3. ★★★ User Prompt (完全保持你的原版逻辑) ★★★
    const userPrompt = `请生成与「${topic}」相关的论坛帖子，返回纯JSON数组（不要markdown代码块）：
[
  {
    "authorType": "ai或npc",
    "authorName": "中文昵称",
    "handle": "英文用户名(不含@符号)",
    "content": "与${topic}相关的帖子内容",
    "likes": 点赞数,
    "retweets": 转发数(0-50),
    "views": 浏览量(100-5000),
    "comments": [
      {
        "tempIdx": 1,
        "authorType": "npc",
        "authorName": "昵称",
        "handle": "英文用户名",
        "content": "纯净评论内容（不要写回复@xxx前缀）",
        "likes": 0,
        "replyTo": null,
        "replyToName": null
      },
      {
        "tempIdx": 2,
        "authorType": "ai",
        "authorName": "昵称",
        "handle": "英文用户名",
        "content": "纯净回复内容（绝对不要在content中写回复@xxx前缀）",
        "likes": 0,
        "replyTo": 1, // 指向被回复的评论的tempIdx
        "replyToName": "被回复者的【中文昵称】" // 必须是中文昵称，绝不能写英文handle
      }
    ]
  }
]
注意：
1. 所有帖子都必须与「${topic}」话题相关！
2. authorType只能是"ai"或"npc"，不要生成"user"
3. 每个帖子必须有10-15条评论！
4. 禁止使用[表情]格式，用emoji❤️😂代替
5. **回复格式规范（极其重要）：** 评论的 \`content\` 中**绝对不能**包含“回复@xxx”或“回复 xxx”等前缀。被回复者的【中文昵称】必须写在 \`replyToName\` 字段里（千万不要写英文handle）。绝对不要生成任何回复用户（楼主）的评论。`;

    // 4. 调用 API
    const response = await fetch(forumApiEndpoint(apiConfig), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiConfig.key}` },
      body: JSON.stringify({
        model: apiConfig.model || "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.9,
      }),
    });

    if (!response.ok) throw new Error(`API请求失败: ${response.status}`);

    const data = await response.json();

    // 拦截空内容/风控
    if (
        (data.usage && data.usage.completion_tokens === 0) || 
        (data.choices && data.choices.length > 0 && data.choices[0].finish_reason === "content_filter")
    ) {
        throw new Error("生成失败：内容被AI模型拦截或为空，请修改提示词后重试。");
    }

    // 拦截无结果
    if (!data.choices || data.choices.length === 0) {
        if (data.error && data.error.message) throw new Error(`API报错: ${data.error.message}`);
        throw new Error("生成失败：API返回无效数据。");
    }

    let content = data.choices[0]?.message?.content || "";
    if(content.length>250000)throw new Error("返回内容过长，请减少生成数量后重试");

    // 5. ★★★ 核心修复：解析逻辑换成智能提取 ★★★
    // 即使 AI 输出格式乱了，只要包含 {...} 结构，就能抠出来
    
    // 清洗 Markdown
    content = forumCleanStructured(content);

    let posts = [];
    try {
      // 方案A: 标准解析
      const jsonMatch = /[\[{]/.test(forumCleanStructured(content));
      if (jsonMatch) {
        posts = forumParseArray(content,['posts','data','results']);
      } else {
        throw new Error("无标准数组");
      }
    } catch (parseError) { throw parseError; }

    if (posts.length === 0) {
        throw new Error("无法解析生成内容，请重试");
    }

    // 6. 后续逻辑保持不变...
    const searchPosts = posts.map((p, idx) => {
        const auth = resolveAuthorIdentity(p.authorName,p);
        
        const tempPost = {
          id: Math.floor(Date.now() + idx * 1000 + Math.random() * 100),
          authorType: auth.type,
          authorId: auth.id,
          authorName: auth.name,
          authorAvatar: auth.avatar,
          handle: p.handle || generateEnglishHandle(auth.name),
          content: p.content || "",
          timestamp: Date.now() - Math.random() * 7200000,
          likes: p.likes || Math.floor(Math.random() * 50),
          liked: false,
          retweets: p.retweets || Math.floor(Math.random() * 30),
          views: p.views || Math.floor(Math.random() * 4900) + 100,
          isSearchResult: true,
          searchTopic: topic,
          comments: []
        };

        tempPost.comments = mapAndResolveComments(p.comments, tempPost);
        return tempPost;
    });

    forumPosts = forumPosts.filter(p => !(p.isSearchResult && p.searchTopic === topic));
    forumPosts = [...searchPosts, ...forumPosts];
    await localforage.setItem("forumPosts", forumPosts);
    
    showSearchResults(searchPosts, topic);

  } catch (e) {
    console.error("[论坛] 搜索生成失败:", e);
    showSearchError("生成失败: " + e.message);
  }
}

// 显示搜索结果
function showSearchResults(posts, topic) {
  const loading = document.getElementById('forumSearchLoading');
  const results = document.getElementById('forumSearchResults');
  
  if (loading) loading.style.display = 'none';
  
  if (results) {
    if (posts.length > 0) {
      results.innerHTML = `
        <div class="forum-search-stats">
          找到 ${posts.length} 条与「${escapeForumHtml(topic)}」相关的帖子
        </div>
        ${posts.map(post => renderForumPostItem(post)).join('')}
      `;
    } else {
      results.innerHTML = `
        <div class="forum-search-empty">
          <div class="forum-search-empty-icon">🔍</div>
          <div class="forum-search-empty-text">没有找到与「${escapeForumHtml(topic)}」相关的内容</div>
          <button class="forum-empty-btn" onclick="ForumApp.refreshSearchResults('${ForumApp.escapeForumHtml(topic)}')">重新搜索</button>
        </div>
      `;
    }
  }
}

// 显示搜索错误
function showSearchError(message) {
  const loading = document.getElementById('forumSearchLoading');
  const results = document.getElementById('forumSearchResults');
  
  if (loading) loading.style.display = 'none';
  
  if (results) {
    results.innerHTML = `
      <div class="forum-search-empty">
        <div class="forum-search-empty-icon"></div>
        <div class="forum-search-empty-text">${escapeForumHtml(message)}</div>
        <button class="forum-empty-btn" onclick="ForumApp.renderForumHot()">返回热点</button>
      </div>
    `;
  }
}

// 生成热门话题
function generateHotTopics() {
  const worldview = forumSettings.worldview || '';
  const forumName = forumSettings.forumName || '广场';
  
  // 基础话题模板
  const baseTopics = [
    { category: '热搜', tag: '今日讨论', count: Math.floor(Math.random() * 500) + 100, trend: 'up' },
    { category: '热搜', tag: '新鲜事', count: Math.floor(Math.random() * 300) + 80, trend: 'up' },
    { category: '娱乐', tag: '日常分享', count: Math.floor(Math.random() * 200) + 50, trend: 'stable' },
  ];
  
  // 根据世界观生成相关话题
  if (worldview) {
    // 提取世界观中的关键词
    const keywords = worldview.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    const uniqueKeywords = [...new Set(keywords)].slice(0, 5);
    
    uniqueKeywords.forEach((kw, idx) => {
      baseTopics.push({
        category: forumName,
        tag: kw,
        count: Math.floor(Math.random() * 400) + 50,
        trend: ['up', 'stable', 'down'][Math.floor(Math.random() * 3)]
      });
    });
  }
  
  // 根据AI角色生成话题
  forumSettings.aiParticipants.forEach(p => {
    const char = characters?.find(c => String(c.id) === String(p.charId));
    const name = p.nickname || char?.name;
    if (name) {
      baseTopics.push({
        category: '角色',
        tag: name + '相关',
        count: Math.floor(Math.random() * 150) + 30,
        trend: 'up'
      });
    }
  });
  
  // 排序并返回前10个
  return baseTopics
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// 获取热门帖子（按互动量排序）
function getTrendingPosts() {
  if (forumPosts.length === 0) return [];
  
  // 过滤掉搜索结果帖子，只显示主页帖子
  const mainPosts = forumPosts.filter(p => !p.isSearchResult);
  
  // 计算每个帖子的热度分数
  const postsWithScore = mainPosts.map(post => {
    const commentCount = post.comments?.length || 0;
    const likes = post.likes || 0;
    const retweets = post.retweets || 0;
    const views = post.views || 0;
    
    // 热度公式：评论*10 + 点赞*5 + 转发*8 + 浏览*0.1
    const score = commentCount * 10 + likes * 5 + retweets * 8 + views * 0.1;
    
    return { ...post, hotScore: score };
  });
  
  // 按热度排序，取前5条
  return postsWithScore
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, 5);
}

// 提取世界观关键词
function extractWorldviewKeywords() {
  const worldview = forumSettings.worldview || '';
  const userIdentity = forumSettings.userIdentity || '';
  const combined = worldview + ' ' + userIdentity;
  
  // 提取2-4字的中文词汇
  const keywords = combined.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
  const uniqueKeywords = [...new Set(keywords)];
  
  // 添加一些通用关键词
  const defaultKeywords = ['日常', '分享', '讨论', '求助', '推荐'];
  
  return [...uniqueKeywords.slice(0, 6), ...defaultKeywords].slice(0, 8);
}

// ==================== 个人主页 ====================

// 当前个人主页选中的tab
let currentProfileTab = 'posts';

function renderForumProfile(tab = 'posts') {
  currentProfileTab = tab;
  const feed = document.getElementById("forumFeed");
  if (!feed) return;
  
  // 【修复点1】优先读取 forumSettings 里的头像，如果没有，再读全局 localStorage，最后用默认
  // 这样即使主程序切换了角色，论坛里的“我”头像也不会变
  const userAvatar = forumSettings.userAvatar || monoAvatarFallback() || getDefaultAvatarDataUrl();
  
  const userName = forumSettings.userNickname || "用户";
  const userHandle = forumSettings.userHandle || generateEnglishHandle(userName);
  const userBio = forumSettings.userBio || "";
  const userBanner = forumSettings.userBanner || "";
  const followingStr = forumSettings.userFollowingStr || formatFollowCount(forumSettings.userFollowing || 0);
  const followersStr = forumSettings.userFollowersStr || formatFollowCount(forumSettings.userFollowers || 0);
  const joinDate = forumSettings.userJoinDate || formatJoinDate(Date.now());
  
  // ... (中间获取帖子的逻辑保持不变，省略以节省空间) ...
  // 获取用户发布的帖子
  const userPosts = forumPosts.filter(p => p.authorType === 'user' && monoOwnPost(p));
  const likedPosts = forumPosts.filter(p => p.liked);
  const repliedPosts = forumPosts.filter(p => p.comments && p.comments.some(c => c.authorType === 'user' && monoOwnPost(c)));

  let contentHtml = '';
  // ... (Tab切换逻辑保持不变) ...
  if (tab === 'posts') {
      if (userPosts.length > 0) {
        const pinnedPosts = userPosts.filter(p => p.isPinned);
        const regularPosts = userPosts.filter(p => !p.isPinned);
        let postsHtml = '';
        pinnedPosts.forEach(post => {
          postsHtml += `<div class="forum-pinned-indicator"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M7 4.5C7 3.12 8.12 2 9.5 2h5C15.88 2 17 3.12 17 4.5v5.26L20.12 16H13v5l-1 2-1-2v-5H3.88L7 9.76V4.5z"/></svg><span>置顶</span></div>${renderForumPostItem(post)}`;
        });
        postsHtml += regularPosts.map(post => renderForumPostItem(post)).join("");
        contentHtml = postsHtml;
      } else {
        contentHtml = '<div class="forum-profile-no-posts">还没有发布任何帖子</div>';
      }
  } else if (tab === 'replies') {
    contentHtml = repliedPosts.length > 0 ? repliedPosts.map(post => renderProfileReplyItem(post)).join("") : '<div class="forum-profile-no-posts">还没有回复任何帖子</div>';
  } else if (tab === 'likes') {
    contentHtml = likedPosts.length > 0 ? likedPosts.map(post => renderForumPostItem(post)).join("") : '<div class="forum-profile-no-posts">还没有喜欢任何帖子</div>';
  }
  
  feed.innerHTML = `
    <div class="forum-profile forum-profile-immersive">
      <header class="forum-ins-profile-title"><button onclick="ForumApp.switchForumSection('home')" aria-label="返回">${forumIcon('back')}</button><strong>${escapeForumHtml(userHandle.replace(/^@/, ''))}</strong><button onclick="ForumApp.monoProfileMenu()" aria-label="主页设置">${forumIcon('more')}</button></header>
      <div class="forum-ins-identity own">
        <button class="forum-profile-avatar" onclick="ForumApp.changeProfileAvatar()" aria-label="更换头像"><img src="${forumSafeImage(userAvatar) || getDefaultAvatarDataUrl()}" alt=""></button>
        <div class="forum-ins-counts"><strong class="forum-ins-name">${escapeForumHtml(userName)}</strong><div class="forum-ins-stats"><span><b>${userPosts.length}</b>帖子</span><span><b>${escapeForumHtml(followersStr)}</b>粉丝</span><span><b>${escapeForumHtml(followingStr)}</b>关注</span></div></div>
      </div>
      <div class="forum-ins-bio">${userBio ? `<p>${escapeForumHtml(userBio)}</p>` : ''}<small>@${escapeForumHtml(userHandle.replace(/^@/, ''))} · ${escapeForumHtml(joinDate)} 加入</small></div>
      <div class="forum-ins-actions"><button onclick="ForumApp.openProfileEditor()">编辑主页</button><button onclick="ForumApp.forumShareProfile()">分享主页</button><button class="forum-ins-add" onclick="ForumApp.forumOpenPeople()" aria-label="发现联系人">${forumIcon('personPlus')}</button></div>
      <div class="forum-profile-tabs">
        <div class="forum-profile-tab ${tab === 'posts' ? 'active' : ''}" onclick="ForumApp.renderForumProfile('posts')">帖子</div>
        <div class="forum-profile-tab ${tab === 'replies' ? 'active' : ''}" onclick="ForumApp.renderForumProfile('replies')">回复</div>
        <div class="forum-profile-tab ${tab === 'likes' ? 'active' : ''}" onclick="ForumApp.renderForumProfile('likes')">喜欢</div>
      </div>
      
      <div class="forum-profile-posts">${contentHtml}</div>
    </div>
  `;
  
  // 隐藏无关元素
  const tabs = document.querySelector('.forum-tabs'); if (tabs) tabs.style.display = 'none';
  const fab = document.querySelector('.forum-fab'); if (fab) fab.style.display = 'none';
  const forumContainer = document.querySelector('.forum-container'); if (forumContainer) forumContainer.style.paddingTop = '0';
}

// 渲染回复过的帖子（显示用户的回复）
function renderProfileReplyItem(post) {
  // 找到用户的评论
  const userComments = post.comments.filter(c => c.authorType === 'user' && monoOwnPost(c));
  if (userComments.length === 0) return '';
  
  const lastComment = userComments[userComments.length - 1];
  
  // 获取用户头像
  const globalAvatar = monoAvatarFallback();
  const userAvatar = forumSettings.userAvatar || globalAvatar || getDefaultAvatarDataUrl();
  const userName = forumSettings.userNickname || "我";
  const userHandle = forumSettings.userHandle || generateEnglishHandle(userName);
  
  // 确定回复的对象
  let replyTargetName = '';
  let replyTargetContent = '';
  let replyTargetAvatar = '';
  
  if (lastComment.replyToName) {
    // 用户回复的是某条评论
    replyTargetName = lastComment.replyToName;
    // 找到被回复的评论
    const targetComment = post.comments.find(c => c.id === lastComment.replyTo);
    if (targetComment) {
      replyTargetContent = targetComment.content?.substring(0, 50) + (targetComment.content?.length > 50 ? '...' : '');
      replyTargetAvatar = targetComment.authorAvatar
        ? `<img src="${targetComment.authorAvatar}" alt="">`
        : getAvatarEmoji(targetComment.authorName);
    }
  } else {
    // 用户回复的是帖子本身
    replyTargetName = post.authorName;
    replyTargetContent = post.content?.substring(0, 50) + (post.content?.length > 50 ? '...' : '');
    replyTargetAvatar = post.authorAvatar
      ? `<img src="${post.authorAvatar}" alt="">`
      : getAvatarEmoji(post.authorName);
  }
  
  const contextText = lastComment.replyToName 
    ? `回复 @${escapeForumHtml(lastComment.replyToName)} 的评论`
    : `回复 @${escapeForumHtml(post.authorName)} 的帖子`;
  
  return `
    <div class="forum-reply-item" onclick="ForumApp.openForumPostDetail(${post.id})">
      <div class="forum-reply-context">
        <span class="forum-reply-context-icon">↩</span>
        ${contextText}
      </div>
      <div class="forum-post">
        <div class="forum-post-left">
          <div class="forum-post-avatar">
            <img src="${userAvatar}" alt="">
          </div>
        </div>
        <div class="forum-post-right">
          <div class="forum-post-header">
            <span class="forum-post-name">${escapeForumHtml(userName)}</span>
            <span class="forum-author-tag user">我</span>
            <div class="forum-post-meta">
              <span>@${userHandle}</span>
              <span>·</span>
              <span>${formatForumTime(lastComment.timestamp)}</span>
            </div>
          </div>
          <div class="forum-post-content">${escapeForumHtml(lastComment.content)}</div>
        </div>
      </div>
      <div class="forum-reply-original">
        <div class="forum-reply-original-avatar">${replyTargetAvatar}</div>
        <div class="forum-reply-original-content">
          <span class="forum-reply-original-name">${escapeForumHtml(replyTargetName)}</span>
          <span class="forum-reply-original-text">${escapeForumHtml(replyTargetContent)}</span>
        </div>
      </div>
    </div>
  `;
}

// ==================== 查看他人主页 ====================

// 当前查看的其他用户信息
let currentViewingUser = null;

// 打开他人主页 (完整版：包含自动关注逻辑)
async function openOtherUserProfile(authorType, authorName, authorId) {
  // 1. 如果是点击了用户自己，跳转到个人资料页
  if (authorType === 'user') {
    switchForumSection('profile');
    return;
  }
  
  const feed = document.getElementById("forumFeed");
  if (!feed) return;
  
  let userInfo = null;
  const targetName = (authorName || '').trim();
  
  // --- 1. 尝试从 AI 参与者中查找 ---
  let participant = null;
  let char = null;
  
  // 1a. 先用 ID 精确查找
  if (authorId) {
    participant = forumSettings.aiParticipants.find(p => String(p.charId) === String(authorId));
    char = characters.find(c => String(c.id) === String(authorId));
  }
  
  // 1b. 如果找不到，用名字精确查找
  if (!participant && !char) {
     participant = forumSettings.aiParticipants.find(p => {
         const nick = (p.nickname || '').trim().toLowerCase();
         const c = characters.find(ch => String(ch.id) === String(p.charId));
         const cName = (c?.name || '').trim().toLowerCase();
         const searchName = targetName.toLowerCase();
         return (nick && searchName === nick) || (cName && searchName === cName);
     });
     
     if (participant) {
         char = characters.find(c => String(c.id) === String(participant.charId));
     }
  }

  // 1c. 甚至如果 participant 没找到，但在 characters 里有这个名字
  if (!participant && !char) {
      char = characters.find(c => c.name === targetName || targetName.includes(c.name));
      // 如果在全局角色里找到了，但在论坛参与者里没找到，我们临时构建一个
      if (char) {
          participant = { 
              charId: char.id, 
              nickname: char.name, 
              avatar: char.avatar 
          };
      }
  }

  if (participant || char) {
    // 确保头像存在
    const finalAvatar = participant?.avatar || char?.avatar || getDefaultAvatarDataUrl();
    
    userInfo = {
      type: 'ai',
      id: participant?.charId || char?.id, // 记录ID
      name: participant?.nickname || char?.name || authorName,
      handle: participant?.handle || generateEnglishHandle(authorName),
      avatar: finalAvatar, 
      banner: participant?.banner || '',
      bio: participant?.bio || (char?.description ? char.description.substring(0, 50) : ''),
      identity: participant?.identity || '',
      fullPersona: getCharacterFullPersona(participant || {charId: char.id}), 
      following: participant?.following || Math.floor(Math.random() * 200),
      followers: participant?.followers || Math.floor(Math.random() * 5000),
      joinDate: participant?.joinDate || '2024年1月',
    };
  } 
  
  // --- 2. 尝试从 NPC 中查找 ---
  if (!userInfo) {
     const npc = (forumSettings.npcs || []).find(n => 
        String(n.id) === String(authorId) || n.name === targetName || targetName.includes(n.name)
     );
     
     if (npc) {
        userInfo = {
            type: 'npc',
            id: npc.id, // 记录ID
            name: npc.name,
            handle: npc.handle || generateEnglishHandle(npc.name),
            avatar: npc.avatar || getDefaultAvatarDataUrl(),
            banner: npc.banner || '',
            bio: npc.bio || '',
            identity: npc.identity || '',
            fullPersona: npc.persona || '', 
            following: npc.following || 0,
            followers: npc.followers || 0,
            joinDate: npc.joinDate || '2025年1月',
        };
     }
  }
  
  // --- 3. 实在找不到，才是路人 ---
  if (!userInfo) {
    userInfo = {
      type: 'random',
      id: authorName, // 路人使用名字作为ID
      name: authorName,
      handle: generateEnglishHandle(authorName),
      avatar: getDefaultAvatarDataUrl(), 
      banner: '',
      bio: '这个用户很神秘，什么都没写。',
      identity: '',
      fullPersona: '普通网友',
      following: Math.floor(Math.random() * 100),
      followers: Math.floor(Math.random() * 20),
      joinDate: formatJoinDate(Date.now()),
    };
  }
  
  // 保存当前正在查看的用户信息
  currentViewingUser = userInfo;
  
  // 隐藏无关元素
  const tabs = document.querySelector('.forum-tabs'); if (tabs) tabs.style.display = 'none';
  const fab = document.querySelector('.forum-fab'); if (fab) fab.style.display = 'none';
  const forumContainer = document.querySelector('.forum-container'); if (forumContainer) forumContainer.style.paddingTop = '0';
  
  const existingPosts = forumPosts.filter(p => 
    p.authorName === userInfo.name && p.authorType !== 'user'
  );
  
  renderOtherUserProfile(userInfo, existingPosts, true);
  
  renderOtherUserProfile(userInfo,existingPosts,false);
}
// 渲染其他用户主页
function renderOtherUserProfile(userInfo, posts, isLoading = false) {
  const feed = document.getElementById("forumFeed");
  if (!feed) return;
  
  const avatarContent = userInfo.avatar 
    ? `<img src="${userInfo.avatar}" alt="">` 
    : getAvatarEmoji(userInfo.name);
  
  const bannerHtml = userInfo.banner
    ? `<img src="${userInfo.banner}" alt="">`
    : '<div class="forum-profile-banner-placeholder"></div>';
  
  // 默认值
  const following = userInfo.following || Math.floor(Math.random() * 500 + 50);
  const followers = userInfo.followers || Math.floor(Math.random() * 2000 + 100);
  const joinDate = userInfo.joinDate || formatJoinDate(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000 * 2);
  
  // 找出置顶帖子
  const pinnedPost = posts.find(p => p.isPinned);
  const regularPosts = posts.filter(p => !p.isPinned);
  
  // 帖子HTML
  let postsHtml = '';
  if (pinnedPost) {
    postsHtml += `
      <div class="forum-pinned-indicator">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M7 4.5C7 3.12 8.12 2 9.5 2h5C15.88 2 17 3.12 17 4.5v5.26L20.12 16H13v5l-1 2-1-2v-5H3.88L7 9.76V4.5z"/>
        </svg>
        <span>置顶</span>
      </div>
      ${renderForumPostItem(pinnedPost)}
    `;
  }
  postsHtml += regularPosts.map(p => renderForumPostItem(p)).join('');
  
  if (isLoading && posts.length === 0) {
    postsHtml = `
      <div class="forum-search-loading">
        <div class="forum-search-spinner"></div>
        <div class="forum-search-loading-text">正在加载主页内容...</div>
      </div>
    `;
  } else if (posts.length === 0) {
    postsHtml = '<div class="forum-profile-no-posts">还没有发布任何帖子</div>';
  }
  
  feed.innerHTML = `
    <div class="forum-profile forum-profile-immersive forum-other-profile">
      <header class="forum-ins-profile-title"><button onclick="ForumApp.closeOtherUserProfile()" aria-label="返回">${forumIcon('back')}</button><strong>${escapeForumHtml(String(userInfo.handle || generateEnglishHandle(userInfo.name)).replace(/^@/, ''))}</strong><button onclick="ForumApp.forumOpenPeople()" aria-label="发现联系人">${forumIcon('more')}</button></header>
      <div class="forum-ins-identity"><div class="forum-profile-avatar">${avatarContent}</div><div class="forum-ins-stats"><span><b>${posts.length}</b>帖子</span><span><b>${escapeForumHtml(String(followers))}</b>粉丝</span><span><b>${escapeForumHtml(String(following))}</b>关注</span></div></div>
      <div class="forum-ins-bio"><strong>${escapeForumHtml(userInfo.name)}</strong><small>@${escapeForumHtml(String(userInfo.handle || generateEnglishHandle(userInfo.name)).replace(/^@/, ''))}</small>${userInfo.bio ? `<p>${escapeForumHtml(userInfo.bio)}</p>` : ''}<small>${escapeForumHtml(joinDate)} 加入</small></div>
      <div class="forum-ins-actions"><button class="primary" onclick="ForumApp.showToast('已关注 ${ForumApp.escapeForumHtml(userInfo.name)}')">关注</button><button onclick="ForumApp.forumMessageProfile()">发消息</button><button class="forum-ins-add" onclick="ForumApp.forumOpenPeople()" aria-label="发现联系人">${forumIcon('personPlus')}</button></div>
      <!-- 标签页 -->
      <div class="forum-profile-tabs">
        <div class="forum-profile-tab active">帖子</div>
      </div>
      
      <!-- 内容列表 -->
      <div class="forum-profile-posts">
        ${postsHtml}
      </div>
      
      <!-- 生成更多帖子按钮 -->
      <div class="forum-generate-more-posts">
        <button onclick="ForumApp.generateUserProfilePosts(ForumApp.viewingUser)" class="forum-generate-btn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          生成更多帖子
        </button>
      </div>
    </div>
  `;
}

// 关闭其他用户主页
function closeOtherUserProfile() {
  currentViewingUser = null;
  
  // 恢复顶栏
  const tabs = document.querySelector('.forum-tabs');
  const fab = document.querySelector('.forum-fab');
  if (tabs) tabs.style.display = 'flex';
  if (fab) fab.style.display = 'flex';
  
  // 恢复safe area
  const forumContainer = document.querySelector('.forum-container');
  if (forumContainer) forumContainer.style.paddingTop = '';
  
  renderForumFeed();
}

// 生成用户主页帖子 (修复版：强化人设一致性)
async function generateUserProfilePosts(userInfo) {
  if (!userInfo) return;
  
  const apiConfig = getActiveApiConfig();
  if (!apiConfig || !apiConfig.url || !apiConfig.key) {
    showToast("请先配置API");
    return;
  }
  
  showToast(`正在生成 ${userInfo.name} 的论坛...`);
  
  // 1. 获取完整人设（这是之前缺失的关键）
  const persona = userInfo.fullPersona || userInfo.identity || '普通用户';
  const bioInfo = userInfo.bio || '';
  
  // 2. 获取世界书内容，增加上下文
  const contextText = `${forumSettings.worldview}\n${userInfo.name}\n${persona}`;
  const worldbookContent = getForumWorldbookContent(contextText);
  
  try {
    // ★★★ 核心修复：完全重写提示词，强调角色扮演 ★★★
    const prompt = `你现在正在进行角色扮演（Roleplay）。
请你扮演以下角色，在论坛的个人主页发布 5-8 条新的历史帖子。

【角色信息】
- 名字：${userInfo.name}
- 个人简介：${bioInfo || '无'}
- **核心人设与性格（重要）：**
${persona}

【世界观背景】
${forumSettings.worldview || '现代都市'}
${worldbookContent ? '\n【相关设定/世界书】\n' + worldbookContent : ''}

【发帖要求】
1. **必须严格符合角色的性格、语气和口癖！** 
   - 如果角色是高冷的，不要发“求资源”或“互评身材”这种帖子。
   - 如果角色是羞涩的，不要发过于奔放的内容。
   - 如果角色是反派，内容应该体现其野心或阴暗面。
2. 内容要围绕角色的生活、兴趣、烦恼或对世界观中事件的看法。
3. 也就是“这个角色在这个世界里会发什么朋友圈/推特”。
4. 第一条帖子建议是置顶帖（如自我介绍、重要声明或置顶的日常）。
5. 禁止使用 [表情] 这种格式，请直接使用 emoji (如 😊, 💢, ❤️)。
6. 返回纯 JSON 数组格式。

JSON 格式模板：
[
  {
    "content": "帖子具体内容...",
    "isPinned": true/false (第一条设为true，其他false),
    "likes": 随机整数(根据角色人气),
    "retweets": 随机整数,
    "views": 随机整数
  }
]

请只返回 JSON，不要包含 Markdown 代码块标记或其他文字。`;

    const response = await fetch(forumApiEndpoint(apiConfig), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiConfig.key}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9, // 稍微降低温度，防止太发散
        max_tokens: parseInt(document.getElementById('apiMaxTokens')?.value) || 2048,
      }),
    });

    if (!response.ok) throw new Error("API请求失败");

    const data = await response.json();
    let content = data.choices[0]?.message?.content || "";
    if(content.length>250000)throw new Error("返回内容过长，请减少生成数量后重试");

    // 清洗 JSON
    content = forumCleanStructured(content);
    const jsonMatch = /[\[{]/.test(forumCleanStructured(content));

    if (jsonMatch) {
      const newPosts = forumParseArray(content,['posts','data','results']);
      
      newPosts.forEach((postData, idx) => {
        const newPost = {
          id: Date.now() + idx,
          authorType: userInfo.type === 'ai' ? 'ai' : 'npc',
          authorId: userInfo.id || null,
          authorName: userInfo.name,
          authorAvatar: userInfo.avatar || '',
          handle: userInfo.handle,
          content: postData.content,
          // 生成最近7天内的时间，稍微错开
          timestamp: Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000) - (idx * 3600000), 
          likes: postData.likes || Math.floor(Math.random() * 50),
          liked: false,
          retweets: postData.retweets || Math.floor(Math.random() * 10),
          views: postData.views || Math.floor(Math.random() * 500),
          comments: [],
          isPinned: postData.isPinned || false,
          isProfileGenerated: true, // 标记为主页生成的帖子
        };
        
        forumPosts.unshift(newPost);
      });

      await localforage.setItem("forumPosts", forumPosts);
      
      // 重新渲染主页
      const userPosts = forumPosts.filter(p => 
        p.authorName === userInfo.name && p.authorType !== 'user'
      );
      if (!userInfo.monoBackground) renderOtherUserProfile(userInfo, userPosts, false);
      
      showToast(`已生成 ${newPosts.length} 条动态`);
    }
  } catch (e) {
    console.error("[论坛] 生成用户帖子失败:", e);
    showToast("生成失败: " + e.message);
  }
}
// ==================== 置顶帖子功能 ====================

// 切换帖子置顶状态
async function togglePinPost(postId) {
  const post = forumPosts.find(p => p.id === postId);
  if (!post) return;
  
  // 只能置顶自己的帖子
  if (post.authorType !== 'user') {
    showToast('只能置顶自己的帖子');
    return;
  }
  
  // 如果要置顶，先取消其他置顶
  if (!post.isPinned) {
    forumPosts.forEach(p => {
      if (p.authorType === 'user' && monoOwnPost(p) && p.isPinned) {
        p.isPinned = false;
      }
    });
  }
  
  post.isPinned = !post.isPinned;
  await localforage.setItem("forumPosts", forumPosts);
  
  showToast(post.isPinned ? '已置顶' : '已取消置顶');
  
  // 如果在个人主页，刷新显示
  if (window.currentForumSection === 'profile') {
    renderForumProfile();
  }
}

// ==================== 粉丝数量动态变化 ====================

// 更新用户粉丝数量
async function updateUserFollowers(action) {
  // 获取当前粉丝数
  let currentFollowers = forumSettings.userFollowers || 0;
  
  // 根据行为计算变化
  let change = 0;
  if (action === 'post') {
    // 发帖：+1到+10，偶尔-1到-3
    change = Math.random() > 0.15 
      ? Math.floor(Math.random() * 10) + 1  // 85%概率涨粉
      : -Math.floor(Math.random() * 3) - 1; // 15%概率掉粉
  } else if (action === 'comment') {
    // 评论：+0到+5，偶尔-1
    change = Math.random() > 0.2
      ? Math.floor(Math.random() * 6)       // 80%概率涨粉
      : -1;                                  // 20%概率掉1个粉
  }
  
  // 确保粉丝数不会变成负数
  currentFollowers = Math.max(0, currentFollowers + change);
  
  // 保存更新
  forumSettings.userFollowers = currentFollowers;
  forumSettings.userFollowersStr = formatFollowCount(currentFollowers);
  await localforage.setItem("forumSettings", forumSettings);
  
  // 如果粉丝变化明显，显示提示
  if (change > 3) {
    showToast(`粉丝 +${change} 🎉`);
  } else if (change < -1) {
    showToast(`粉丝 ${change} 😢`);
  }
}

// ==================== 私信功能 ====================

// 私信数据
let forumDirectMessages = [];

// 初始化私信数据
async function initDirectMessages() {
  if(forumDMLoaded)return;
  forumDirectMessages = await localforage.getItem(monoDMKey()) || [];
  forumDMLoaded=true;
}

// [修改] 打开私信
async function openDirectMessages() {
  await initDirectMessages();
  renderDirectMessagesList();
}

// [重写] 渲染私信列表 (全屏 Overlay 模式)
function renderDirectMessagesList() {
  // 1. 如果已经存在，先移除（防止重复）
  const existing = document.querySelector('.forum-dm-page');
  if (existing) existing.remove();

  // 2. 准备数据 HTML (保持原有逻辑)
  const sortedConversations = [...forumDirectMessages].sort((a, b) => 
    (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
  );

  const conversationsHtml = sortedConversations.length > 0 
    ? sortedConversations.map(conv => {
        const avatarContent = conv.avatar 
          ? `<img src="${conv.avatar}" alt="">` 
          : getAvatarEmoji(conv.name);
        const unreadBadge = conv.unread > 0 
          ? `<span class="forum-dm-unread">${conv.unread}</span>` 
          : '';
        const timeStr = conv.lastMessageTime ? formatForumTime(conv.lastMessageTime) : '';
        
        return `
          <div class="forum-dm-item" onclick="ForumApp.openDirectMessageChat('${conv.id}')">
            <div class="forum-dm-avatar">${avatarContent}</div>
            <div class="forum-dm-content">
              <div class="forum-dm-header">
                <span class="forum-dm-name">${escapeForumHtml(conv.name)}</span>
                <span class="forum-dm-time">${timeStr}</span>
              </div>
              <div class="forum-dm-preview">${escapeForumHtml(conv.lastMessage || '暂无消息')}</div>
            </div>
            ${unreadBadge}
          </div>
        `;
      }).join('')
    : '<div class="forum-dm-empty">暂无私信</div>';

  // 3. 创建全屏容器
  const dmPage = document.createElement('div');
  dmPage.className = 'forum-dm-page';
  dmPage.innerHTML = `
      <div class="forum-dm-header-bar">
        <!-- ★★★ 返回按钮在此 ★★★ -->
        <button class="forum-dm-back" onclick="ForumApp.closeDirectMessages()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        
        <span class="forum-dm-title">${escapeForumHtml(forumSettings.userHandle || forumSettings.userNickname || "私信")}</span>
        
        <button class="forum-dm-generate" onclick="ForumApp.generateNewDirectMessages()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </button>
      </div>
      <div class="forum-dm-search"><span>${forumIcon("search")}</span><input placeholder="搜索联系人" aria-label="搜索联系人" oninput="ForumApp.forumFilterContacts(this.value)"></div><div class="forum-dm-section-label">消息</div>
      <div class="forum-dm-list">
        ${conversationsHtml}
      </div>
  `;

  // 4. 添加到 body，实现全屏覆盖
  forumMount(dmPage);
}

// [重写] 关闭私信页面
function closeDirectMessages() {
  const page = document.querySelector('.forum-dm-page');
  if (page) page.remove();
  
  // 同时也要移除可能存在的聊天详情页
  const chatPage = document.querySelector('.forum-dm-chat');
  if (chatPage) chatPage.remove();
}

// ==================== [核心修改] 1. 总控函数：替换掉原来的 generateNewDirectMessages ====================

// [修改] 总控函数：带调试反馈的刷新
async function generateNewDirectMessages() {
  const btn = document.querySelector('.forum-dm-generate');
  
  // 视觉反馈：开始旋转
  if (btn) btn.classList.add('spinning'); 
  showToast("正在接收私信..."); // ★ 新增：提示正在运行

  try {
    const apiConfig = getActiveApiConfig();
    if (!apiConfig || !apiConfig.url || !apiConfig.key) {
      showToast("错误：请先配置API");
      return;
    }

    console.log("[私信] 开始请求 API...");

    // 并行执行：回复旧消息 和 获取新消息 分开处理，互不干扰
    const [repliedCount, newMsgCount] = await Promise.all([
      processPendingRepliesInternal(apiConfig), 
      fetchNewRandomDMsInternal(apiConfig)      
    ]);

    console.log(`[私信] 请求结束。回复: ${repliedCount}, 新增: ${newMsgCount}`);

    // 只要有任何变化，就刷新界面
    if (repliedCount > 0 || newMsgCount > 0) {
      // 按时间倒序排序
      forumDirectMessages.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
      await forumSaveDMs();
      renderDirectMessagesList();
      showToast(`刷新成功：${newMsgCount}条新私信`);
    } else {
      // ★ 关键：如果是0条，告诉用户为什么
      showToast("📭 暂无新消息 (AI认为现在很安静)");
    }

  } catch (e) {
    console.error("[私信] 刷新严重错误:", e);
    showToast(`❌ 刷新出错: ${e.message}`);
  } finally {
    // 停止旋转
    if (btn) btn.classList.remove('spinning'); 
  }
}

// [三级防抖 + 上下文感知版] 内部生成函数
async function fetchNewRandomDMsInternal(apiConfig) {
  try {
    // ================= 1. 数据收集与上下文构建 =================

    // 1.1 基础信息
    const worldview = forumSettings.worldview || "现代都市";
    const myName = forumSettings.userNickname || "我";
    const myIdentity = forumSettings.userIdentity || "普通用户";
    
    // 1.2 获取用户最近发布的帖子 (最多3条，作为私信的话题来源)
    const myRecentPosts = forumPosts
      .filter(p => p.authorType === 'user' && monoOwnPost(p))
      .slice(0, 3)
      .map((p, index) => {
          const timeStr = formatForumTime(p.timestamp);
          // 如果帖子有图，标记一下
          const hasImg = (p.images && p.images.length > 0) ? "[包含图片]" : "";
          return `${index + 1}. [${timeStr}发布] ${p.content} ${hasImg}`;
      })
      .join("\n");

    // 1.3 获取已知关系网 (AI角色 + NPC + 定义的关系)
    // 目的：让 AI 优先扮演这些人给你发消息，而不是总是生成陌生人
    let relationshipsContext = "";
    
    // 处理 AI 角色
    const aiChars = forumSettings.aiParticipants.map(p => {
        const char = characters.find(c => String(c.id) === String(p.charId));
        const name = p.nickname || char?.name || "未知角色";
        // 查找有没有特殊关系定义
        const rel = forumSettings.relationships?.find(r => 
            (r.person1Type === 'user' && String(r.person2Id) === String(p.charId)) ||
            (r.person2Type === 'user' && String(r.person1Id) === String(p.charId))
        );
        const relDesc = rel ? `与用户的关系：${rel.relationship} (${rel.description})` : "关系：相识";
        const persona = p.identity || char?.persona || "";
        return `- ${name} (AI角色): ${relDesc}。性格/身份：${persona.substring(0, 50)}...`;
    });

    // 处理 NPC
    const npcChars = (forumSettings.npcs || []).map(n => {
        const rel = forumSettings.relationships?.find(r => 
            (r.person1Type === 'user' && String(r.person2Id) === String(n.id)) ||
            (r.person2Type === 'user' && String(r.person1Id) === String(n.id))
        );
        const relDesc = rel ? `与用户的关系：${rel.relationship}` : "关系：熟人/网友";
        return `- ${n.name} (NPC): ${relDesc}。身份：${n.identity || "普通NPC"}`;
    });

    const knownContacts = [...aiChars, ...npcChars].join("\n");

    // 1.4 准备黑名单 (防止自己给自己发)
    const blacklist = [myName, "User", "user", "用户", "楼主", "系统"];


    // ================= 2. 构造 Prompt =================

    const prompt = `你是一个基于上下文的角色扮演私信生成器。
当前世界观：${worldview}
接收者（用户）：${myName}
接收者身份：${myIdentity}

【用户的最近动态（重要参考）】
${myRecentPosts || "（用户暂时没有发布帖子）"}

【用户的已知关系网】
${knownContacts || "（暂无特定关系人，请生成陌生的粉丝或路人）"}

【任务目标】
生成 2 到 4 条发给 "${myName}" 的私信。
私信来源可以是【已知关系网】中的人，也可以是完全陌生的【路人/粉丝】。

【生成逻辑要求】
1. **基于帖子**：如果用户最近发了帖子，请安排 1-2 个路人或熟人针对帖子内容发表评论（如夸赞图片、反驳观点、单纯吃瓜）。
2. **基于关系**：如果【已知关系网】有人，请安排 1-2 个熟人根据他们与用户的关系发消息（如情侣的问候、死对头的嘲讽、朋友的闲聊）。
3. **基于人设**：不要胡编乱造用户没做过的事。聊天内容必须符合发送者的性格和与用户的关系。
4. **格式**：返回标准 JSON 数组。内容中如果包含引号，**必须使用单引号 ' **。

JSON 模板：
[
  {"senderName": "熟人名字", "content": "嘿，刚看到你发的照片，那个地方是哪里呀？", "type": "known"},
  {"senderName": "路人ID", "content": "楼主好，非常认同你的观点！", "type": "stranger"}
]

【黑名单】: ${JSON.stringify(blacklist)}
禁止扮演用户本人。`;

    console.log("[私信] 正在请求 API (上下文感知版)...");

    const response = await fetch(forumApiEndpoint(apiConfig), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiConfig.key}` },
        body: JSON.stringify({ 
          model: apiConfig.model || "gpt-3.5-turbo", 
          messages: [{ role: "user", content: prompt + monoPrivateChatStyle(true) }], 
          temperature: 0.9, // 保持高创造性
          max_tokens: parseInt(document.getElementById('apiMaxTokens')?.value) || 2048
        })
    });

    if (!response.ok) throw new Error("API请求失败 " + response.status);
    const data = await response.json();
    let content = data.choices[0]?.message?.content || "";
    if(content.length>250000)throw new Error("返回内容过长，请减少生成数量后重试");
    
    // 预处理
    content = content.replace(/```json/gi, "").replace(/```/g, "").trim();

    let msgs = [];
    
    // ================= 3. 解析策略 (三级防抖) =================

    // 级别1: 标准解析
    try {
        msgs = forumParseArray(content,['messages','data','results']);
    } catch (e1) {
        // 级别2: 对象提取
        const objectMatches = content.match(/\{[\s\S]*?\}/g);
        if (objectMatches) {
            objectMatches.forEach(str => { try { msgs.push(JSON.parse(str)); } catch(e){} });
        }
        
        // 级别3: 暴力扫描 (保底)
        if (msgs.length === 0) {
            const nameReg = /"senderName"\s*:\s*(["'])([\s\S]*?)\1/g;
            const contentReg = /"content"\s*:\s*(["'])([\s\S]*?)\1/g;
            let nameMatch, contentMatch;
            const names = []; const contents = [];
            while ((nameMatch = nameReg.exec(content)) !== null) names.push(nameMatch[2]);
            while ((contentMatch = contentReg.exec(content)) !== null) contents.push(contentMatch[2]);
            const count = Math.min(names.length, contents.length);
            for (let i=0; i<count; i++) msgs.push({senderName: names[i], content: contents[i]});
        }
    }

    // ================= 4. 智能匹配头像与入库 =================
    if (!Array.isArray(msgs)) msgs = [];
    // New short-message protocol, retaining legacy content and per-message translations.
    msgs = msgs.flatMap(m => !m || !Array.isArray(m.messages) ? [m] : m.messages.map(r => ({...m, messages: undefined, content: typeof r === 'string' ? r : r?.text || r?.content || '', translation: typeof r === 'object' ? r?.translation || '' : ''})));
    let count = 0;
    
    msgs.forEach(msg => {
        if (!msg || !msg.senderName || !msg.content) return;
        let sName = String(msg.senderName).trim();
        let sContent = String(msg.content).trim();
        
        // 黑名单过滤
        if (sName.includes(myName)) return;
        
        // === 智能匹配头像和ID ===
        // 尝试判断这个人是不是 AI角色 或 NPC，以便关联头像和ID
        let finalAvatar = "";
        let finalId = `npc_dm_${Date.now()}_${Math.random().toString(36).substr(2,5)}`; // 默认ID
        
        // 1. 尝试匹配 AI 角色
        const aiParticipant = forumSettings.aiParticipants.find(p => {
             const c = characters.find(ch => String(ch.id) === String(p.charId));
             const pName = p.nickname || c?.name || "";
             return pName && (sName === pName || sName.includes(pName));
        });

        if (aiParticipant) {
             const c = characters.find(ch => String(ch.id) === String(aiParticipant.charId));
             finalAvatar = aiParticipant.avatar || c?.avatar || "";
             sName = aiParticipant.nickname || c?.name || sName; // 修正名字为标准名
             finalId = `ai_${aiParticipant.charId}`; // 使用特殊前缀ID，方便后续识别
        } 
        // 2. 尝试匹配 NPC
        else {
             const npc = (forumSettings.npcs || []).find(n => n.name && (sName === n.name || sName.includes(n.name)));
             if (npc) {
                 finalAvatar = npc.avatar || "";
                 sName = npc.name;
                 finalId = `npc_${npc.id}`;
             }
        }

        // 检查是否已存在该会话，如果存在则追加，不存在则新建
        let existingConv = forumDirectMessages.find(c => c.name === sName || c.id === finalId);
        
        if (existingConv) {
            // 已存在会话，追加消息
            existingConv.messages.push({
                id: Date.now(),
                sender: 'other',
                content: sContent,
                ...(typeof msg.translation === 'string' && msg.translation.trim() ? {translation: msg.translation.trim()} : {}),
                timestamp: Date.now()
            });
            existingConv.unread = (existingConv.unread || 0) + 1;
            existingConv.lastMessage = sContent;
            existingConv.lastMessageTime = Date.now();
            // 更新头像（如果之前没有）
            if (!existingConv.avatar && finalAvatar) existingConv.avatar = finalAvatar;
        } else {
            // 新会话
            forumDirectMessages.push({
                id: finalId,
                name: sName,
                avatar: finalAvatar, 
                type: finalId.startsWith('ai_') ? 'ai' : 'npc', 
                messages: [{ id: Date.now(), sender: 'other', content: sContent,
                ...(typeof msg.translation === 'string' && msg.translation.trim() ? {translation: msg.translation.trim()} : {}), timestamp: Date.now() }],
                unread: 1,
                lastMessage: sContent,
                lastMessageTime: Date.now(),
            });
        }
        count++;
    });

    return count;

  } catch (e) {
    console.error("[私信] 严重错误:", e);
    return 0;
  }
}
// ==================== [核心修改] 2. 辅助函数：请粘贴到 generateNewDirectMessages 后面 ====================

// [修改] 内部任务A：处理待回复消息 (融入世界观)
async function processPendingRepliesInternal(apiConfig) {
  const pending=forumDirectMessages.filter(c=>c.messages?.at(-1)?.sender==='user');
  for (const conversation of pending) await forumGenerateFor(conversation.id,false,true);
}

function openDirectMessageChat(conversationId) {
  const conversation = forumDirectMessages.find(c => c.id === conversationId);
  if (!conversation) return;
  
  currentDMConversationId = conversationId;
  
  // 1. 数据层：标记为已读
  if (conversation.unread > 0) {
    conversation.unread = 0;
    forumSaveDMs(); // 异步保存
    
    const listItems = document.querySelectorAll('.forum-dm-item');
    listItems.forEach(item => {
      if (item.getAttribute('onclick')?.includes(`'${conversationId}'`)) {
        const badge = item.querySelector('.forum-dm-unread');
        if (badge) {
          badge.style.display = 'none'; // 立即隐藏
          badge.remove(); // 或者直接移除
        }
      }
    });
  }
  
  renderDirectMessageChat(conversation);
}

// [重写] 渲染聊天详情页
function renderDirectMessageChat(conversation) { forumRenderChat(conversation); }

// 发送私信
async function sendDirectMessage() {
  const input = document.getElementById('dmInput');
  const content = input?.value?.trim();
  if (!content || !currentDMConversationId) return;
  
  const conversation = forumDirectMessages.find(c => c.id === currentDMConversationId);
  if (!conversation) return;
  
  // 添加用户消息
  conversation.messages.push({
    id: Date.now(),
    sender: 'user',
    content: content,
    timestamp: Date.now(),
  });
  
  conversation.lastMessage = content;
  conversation.lastMessageTime = Date.now();
  
  await forumSaveDMs();
  
  input.value = '';
  renderDirectMessageChat(conversation);
}

// 生成对方回复
async function generateDMReply() { return forumGenerateFor(currentDMConversationId); }
function forumOriginalDMPrompt(conversation) {
  let senderInfo = {name:conversation.name, identity:'', fullPersona:conversation.forumPersona || ''};
  if (conversation.id.startsWith('ai_')) {
    const participant=forumSettings.aiParticipants.find(p=>String(p.charId)===conversation.id.slice(3));
    if(participant){senderInfo.identity=participant.identity || '';senderInfo.fullPersona=getCharacterFullPersona(participant);}
  } else if(conversation.id.startsWith('npc_')) {
    const npc=(forumSettings.npcs || []).find(p=>String(p.id)===conversation.id.slice(4));
    if(npc){senderInfo.identity=npc.identity || '';senderInfo.fullPersona=npc.persona || '';}
  }
  const recentMessages=conversation.messages.slice(-6).map(m=>`${m.sender==='user'?forumSettings.userNickname || '用户':conversation.name}：${m.content}`).join('\n');
  const worldbookContent=getForumWorldbookContent(`${forumSettings.worldview}\n${recentMessages}`);
  const prompt = `你正在扮演 ${conversation.name} 与用户私信聊天。

【世界观】${forumSettings.worldview}
${worldbookContent ? '\n【世界书/详细设定】\n' + worldbookContent : ''}

【${conversation.name}的完整人设】
${senderInfo.fullPersona || senderInfo.identity || '普通用户'}

【用户信息】
- 昵称：${forumSettings.userNickname || '用户'}
- 身份：${forumSettings.userIdentity || '普通用户'}

【最近对话】
${recentMessages}

请以${conversation.name}的身份回复最后一条消息。要求：
1. 必须符合角色的人设和性格特点！
2. 自然、简短
3. 禁止使用[表情]格式，用emoji代替
4. 只输出回复内容`;;
  return prompt;
}

// [修改] switchToHome
function switchToHome() {
  // 显示顶栏和FAB
  const tabs = document.querySelector('.forum-tabs');
  const fab = document.querySelector('.forum-fab');
  if (tabs) tabs.style.display = 'flex';
  if (fab) fab.style.display = 'flex';
  
  // [修改点] 更新底部导航 (index 0 是 home)
  document.querySelectorAll(".forum-nav-item").forEach((item, index) => {
    item.classList.toggle("active", index === 0);
  });
  
  window.currentForumSection = 'home'; // 确保状态同步
  renderForumFeed();
}

function formatJoinDate(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}年${month}月`;
}

// 更换头像 (已修复 QuotaExceededError 限制)
function changeProfileAvatar() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        // 核心修复：引入安全压缩和写入机制
        const savedAvatar = await saveGlobalAvatar(ev.target.result);
        
        // 同步到论坛设置并保存
        forumSettings.userAvatar = savedAvatar;
        await localforage.setItem("forumSettings", forumSettings);
        
        renderForumProfile();
        showToast('头像已更新');
      };
      reader.readAsDataURL(file);
    }
  };
  input.click();
}

// 更换背景图
function changeProfileBanner() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        forumSettings.userBanner = ev.target.result;
        await localforage.setItem("forumSettings", forumSettings);
        renderForumProfile();
        showToast('背景已更新');
      };
      reader.readAsDataURL(file);
    }
  };
  input.click();
}

// 打开编辑个人资料弹窗
function openProfileEditor() {
  const globalAvatar = monoAvatarFallback();
  const userAvatar = forumSettings.userAvatar || globalAvatar || getDefaultAvatarDataUrl();
  const userName = forumSettings.userNickname || "";
  const userHandle = forumSettings.userHandle || "";
  const userBio = forumSettings.userBio || "";
  const userBanner = forumSettings.userBanner || "";
  const userFollowing = forumSettings.userFollowing || 0;
  const userFollowers = forumSettings.userFollowers || 0;
  const userJoinDate = forumSettings.userJoinDate || formatJoinDate(Date.now());
  
  const modal = document.createElement('div');
  modal.id = 'forumProfileEditorModal';
  modal.className = 'forum-modal-overlay';
  modal.innerHTML = `
    <div class="forum-profile-editor">
      <div class="forum-profile-editor-header">
        <button class="forum-profile-editor-close" onclick="ForumApp.closeProfileEditor()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z"/>
          </svg>
        </button>
        <span class="forum-profile-editor-title">编辑个人信息</span>
        <button class="forum-profile-editor-save" onclick="ForumApp.saveProfileChanges()">保存</button>
      </div>
      
      <div class="forum-profile-editor-content">
        <!-- 头像 -->
        <div class="forum-profile-editor-avatar" onclick="ForumApp.forumChooseEditorImage('profileAvatarInput')">
          <img src="${userAvatar}" alt="" id="profileAvatarPreview">
          
          <input type="file" id="profileAvatarInput" accept="image/*" style="display:none" onchange="ForumApp.previewProfileAvatar(this)">
        </div>
        
        <!-- 表单 -->
        <div class="forum-profile-editor-form">
          <div class="forum-profile-editor-field">
            <label>昵称</label>
            <input type="text" id="profileNameInput" value="${escapeForumHtml(userName)}" placeholder="你的昵称" maxlength="30">
          </div>
          
          <div class="forum-profile-editor-field">
            <label>用户名</label>
            <div class="forum-input-with-prefix" style="background:#fff;border:1px solid #cfd9de;">
              <span class="forum-input-prefix">@</span>
              <input type="text" id="profileHandleInput" value="${escapeForumHtml(userHandle)}" placeholder="your_handle" class="forum-input-handle" style="background:transparent;">
            </div>
          </div>
          
          <div class="forum-profile-editor-field">
            <label>个人简介</label>
            <textarea id="profileBioInput" placeholder="介绍一下你自己" maxlength="160" rows="3">${escapeForumHtml(userBio)}</textarea>
          </div>
          
          <div class="forum-profile-editor-field">
            <label>加入时间</label>
            <input type="text" id="profileJoinDateInput" value="${escapeForumHtml(userJoinDate)}" placeholder="如: 2024年1月">
          </div>
          
          <div class="forum-profile-editor-field-row">
            <div class="forum-profile-editor-field forum-profile-editor-field-half">
              <label>正在关注</label>
              <input type="text" id="profileFollowingInput" value="${formatFollowCount(userFollowing)}" placeholder="如: 32, 1.2K, 5M">
            </div>
            <div class="forum-profile-editor-field forum-profile-editor-field-half">
              <label>关注者</label>
              <input type="text" id="profileFollowersInput" value="${formatFollowCount(userFollowers)}" placeholder="如: 96, 10K, 1M">
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  modal.onclick = (e) => {
    if (e.target === modal) closeProfileEditor();
  };
  forumMount(modal);
}

function closeProfileEditor() {
  const modal = document.getElementById('forumProfileEditorModal');
  if (modal) modal.remove();
}

function previewProfileAvatar(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('profileAvatarPreview');
      if (preview) preview.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function previewProfileBanner(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const container = input.closest('.forum-profile-editor-banner');
      if (container) {
        const img = container.querySelector('img') || document.createElement('img');
        img.src = e.target.result;
        if (!container.querySelector('img')) {
          container.insertBefore(img, container.firstChild);
          const placeholder = container.querySelector('.forum-profile-banner-placeholder');
          if (placeholder) placeholder.remove();
        }
      }
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// ==================== 修复后的 saveProfileChanges 函数 ====================

async function saveProfileChanges() {
  const name = document.getElementById('profileNameInput')?.value?.trim() || '';
  const handle = document.getElementById('profileHandleInput')?.value?.trim() || '';
  const bio = document.getElementById('profileBioInput')?.value || '';
  const joinDate = document.getElementById('profileJoinDateInput')?.value?.trim() || '';
  
  // 获取图片预览里的数据
  const avatarPreview = document.getElementById('profileAvatarPreview')?.src || '';
  
  // 背景图处理
  const bannerContainer = document.querySelector('.forum-profile-editor-banner img');
  const banner = bannerContainer?.src || '';
  
  const followingStr = document.getElementById('profileFollowingInput')?.value?.trim() || '0';
  const followersStr = document.getElementById('profileFollowersInput')?.value?.trim() || '0';
  
  const following = parseFollowCount(followingStr);
  const followers = parseFollowCount(followersStr);
  
 if (avatarPreview) {
        // 核心修复：压缩并安全写入全局头像 (防 QuotaExceededError)
        const savedAvatar = await compressAvatar(avatarPreview,150,150);
        
        // 1. 保存到论坛专用设置
        forumSettings.userAvatar = savedAvatar; 
        
        console.log("[论坛] 全局头像已安全保存并完成轻量化压缩");
      }
  
  forumSettings.userNickname = name;
  forumSettings.userHandle = handle;
  forumSettings.userBio = bio;
  forumSettings.userJoinDate = joinDate || formatJoinDate(Date.now());
  forumSettings.userFollowing = following;
  forumSettings.userFollowers = followers;
  forumSettings.userFollowingStr = followingStr;
  forumSettings.userFollowersStr = followersStr;
  
  // 背景图保存逻辑优化
  if (banner && !banner.includes('forum-profile-banner-placeholder')) {
    forumSettings.userBanner = banner;
  }
  
  // 存入数据库
  await localforage.setItem("forumSettings", forumSettings);
  
  closeProfileEditor();
  renderForumProfile();
  showToast('个人资料已更新');
}

// 解析关注数（支持K、M、B单位）
function parseFollowCount(str) {
  if (!str) return 0;
  str = str.toString().trim().toUpperCase();
  
  // 如果是纯数字
  if (/^\d+$/.test(str)) {
    return parseInt(str);
  }
  
  // 匹配带单位的数字，如 1.2K, 5M, 1B
  const match = str.match(/^([\d.]+)\s*([KMB])?$/i);
  if (match) {
    let num = parseFloat(match[1]);
    const unit = match[2]?.toUpperCase();
    
    if (unit === 'K') num *= 1000;
    else if (unit === 'M') num *= 1000000;
    else if (unit === 'B') num *= 1000000000;
    
    return Math.round(num);
  }
  
  return 0;
}

// 格式化关注数为带单位的字符串
function formatFollowCount(num) {
  if (!num || num === 0) return '0';
  num = parseInt(num);
  
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  } else if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  } else if (num >= 10000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  } else {
    return num.toString();
  }
}

// ==================== 导出 ====================

// 新增安全头像函数导出
ForumApp.compressAvatar = compressAvatar;
ForumApp.saveGlobalAvatar = saveGlobalAvatar;

ForumApp.initForumApp = initForumApp;
ForumApp.renderForumPage = renderForumPage;
ForumApp.renderForumFeed = renderForumFeed;
ForumApp.openForumPostDetail = openForumPostDetail;
ForumApp.closeForumPostDetail = closeForumPostDetail;
ForumApp.openForumSettings = openForumSettings;
ForumApp.closeForumSettings = closeForumSettings;
ForumApp.saveForumSetting = saveForumSetting;
ForumApp.openAddForumParticipant = openAddForumParticipant;
ForumApp.closeForumParticipantModal = closeForumParticipantModal;
ForumApp.selectForumParticipant = selectForumParticipant;
ForumApp.confirmAddParticipant = confirmAddParticipant;
ForumApp.editForumParticipant = editForumParticipant;
ForumApp.previewForumParticipantAvatar = previewForumParticipantAvatar;
ForumApp.removeForumParticipant = removeForumParticipant;
ForumApp.openAddForumNpc = openAddForumNpc;
ForumApp.editForumNpc = editForumNpc;
ForumApp.previewForumNpcAvatar = previewForumNpcAvatar;
ForumApp.confirmSaveNpc = confirmSaveNpc;
ForumApp.removeForumNpc = removeForumNpc;
ForumApp.openAddForumRelationship = openAddForumRelationship;
ForumApp.editForumRelationship = editForumRelationship;
ForumApp.confirmSaveRelationship = confirmSaveRelationship;
ForumApp.removeForumRelationship = removeForumRelationship;
ForumApp.openForumCompose = openForumCompose;
ForumApp.closeForumCompose = closeForumCompose;
ForumApp.submitForumPost = submitForumPost;
ForumApp.submitForumComment = submitForumComment;
ForumApp.replyToForumComment = replyToForumComment;
ForumApp.cancelForumReply = cancelForumReply;
ForumApp.updateForumCommentInput = updateForumCommentInput;
ForumApp.toggleForumPostLike = toggleForumPostLike;
ForumApp.toggleForumCommentLike = toggleForumCommentLike;
ForumApp.generateForumPosts = generateForumPosts;
ForumApp.generateMoreComments = generateMoreComments;
ForumApp.generateCommentsForNewPost = generateCommentsForNewPost;
ForumApp.generateInteractionsForNewPost = generateInteractionsForNewPost;
ForumApp.switchForumTab = switchForumTab;
ForumApp.switchForumSection = switchForumSection;
ForumApp.switchToHome = switchToHome;
ForumApp.renderForumProfile = renderForumProfile;
ForumApp.renderProfileReplyItem = renderProfileReplyItem;
ForumApp.changeProfileAvatar = changeProfileAvatar;
ForumApp.changeProfileBanner = changeProfileBanner;
ForumApp.openProfileEditor = openProfileEditor;
ForumApp.closeProfileEditor = closeProfileEditor;
ForumApp.previewProfileAvatar = previewProfileAvatar;
ForumApp.previewProfileBanner = previewProfileBanner;
ForumApp.saveProfileChanges = saveProfileChanges;
ForumApp.showRetweetMenu = showRetweetMenu;
ForumApp.openQuoteRetweet = openQuoteRetweet;
ForumApp.closeQuoteRetweet = closeQuoteRetweet;
ForumApp.submitQuoteRetweet = submitQuoteRetweet;
ForumApp.retweetToChat = retweetToChat;
ForumApp.retweetToProfile = retweetToProfile;
ForumApp.showForumImageDesc = showForumImageDesc;
ForumApp.showForumFullImage = showForumFullImage;
ForumApp.sendRetweetToChar = sendRetweetToChar;
ForumApp.renderRetweetCard = renderRetweetCard;

ForumApp.handleComposeImageUpload = handleComposeImageUpload;
ForumApp.insertImagePlaceholder = insertImagePlaceholder;
ForumApp.renderComposeImages = renderComposeImages;
ForumApp.removeComposeImage = removeComposeImage;
ForumApp.renderForumComposeUserInfo = renderForumComposeUserInfo;
ForumApp.parseFollowCount = parseFollowCount;
ForumApp.formatFollowCount = formatFollowCount;
ForumApp.renderForumHot = renderForumHot;
ForumApp.searchForumTopic = searchForumTopic;
ForumApp.focusHotSearch = focusHotSearch;
ForumApp.handleHotSearchInput = handleHotSearchInput;
ForumApp.handleHotSearchKeydown = handleHotSearchKeydown;
ForumApp.executeHotSearch = executeHotSearch;
ForumApp.refreshSearchResults = refreshSearchResults;
ForumApp.generateTopicPosts = generateTopicPosts;
ForumApp.showSearchResults = showSearchResults;
ForumApp.showSearchError = showSearchError;
ForumApp.handleForumRefresh = handleForumRefresh;
ForumApp.renderDetailImages = renderDetailImages;
ForumApp.openOtherUserProfile = openOtherUserProfile;
ForumApp.renderOtherUserProfile = renderOtherUserProfile;
ForumApp.closeOtherUserProfile = closeOtherUserProfile;
ForumApp.generateUserProfilePosts = generateUserProfilePosts;
ForumApp.togglePinPost = togglePinPost;
ForumApp.currentViewingUser = currentViewingUser;
ForumApp.previewForumParticipantBanner = previewForumParticipantBanner;
ForumApp.previewForumNpcBanner = previewForumNpcBanner;
ForumApp.updateUserFollowers = updateUserFollowers;
ForumApp.openDirectMessages = openDirectMessages;
ForumApp.closeDirectMessages = closeDirectMessages;
ForumApp.renderDirectMessagesList = renderDirectMessagesList;
ForumApp.generateNewDirectMessages = generateNewDirectMessages;
ForumApp.openDirectMessageChat = openDirectMessageChat;
ForumApp.renderDirectMessageChat = renderDirectMessageChat;
ForumApp.sendDirectMessage = sendDirectMessage;
ForumApp.generateDMReply = generateDMReply;
ForumApp.getActiveApiConfig = getActiveApiConfig; 
ForumApp.showToast = showToast; 
// 世界书绑定相关
ForumApp.renderForumWorldbookBindings = renderForumWorldbookBindings;
ForumApp.openForumWorldbookSelector = openForumWorldbookSelector;
ForumApp.closeForumWorldbookSelector = closeForumWorldbookSelector;
ForumApp.addForumWorldbook = addForumWorldbook;
ForumApp.removeForumWorldbook = removeForumWorldbook;
ForumApp.getForumWorldbookContent = getForumWorldbookContent;
ForumApp.getCharacterFullPersona = getCharacterFullPersona;
// 帖子删除相关
ForumApp.showPostMoreMenu = showPostMoreMenu;
ForumApp.confirmDeletePost = confirmDeletePost;
ForumApp.deleteForumPost = deleteForumPost;
ForumApp.smartRenderCurrentPage = smartRenderCurrentPage;
// @提及相关
ForumApp.handleMentionClick = handleMentionClick;
ForumApp.loadSelectedForumPreset = loadSelectedForumPreset;
ForumApp.deleteSelectedForumPreset = deleteSelectedForumPreset;
ForumApp.toggleForumPresetPanel = toggleForumPresetPanel; // 新增：折叠控制
ForumApp.saveNewForumPreset = saveNewForumPreset;         // 新增：新建保存
ForumApp.updateCurrentForumPreset = updateCurrentForumPreset;
ForumApp.refreshPostComments = refreshPostComments;

// 获取当前激活的 API 配置（已集成中央调度分流）
function getActiveApiConfig() {
  const nativeConfig = forumNativeDb()?.apiSettings;
  if (nativeConfig?.url && nativeConfig?.key) return {url:nativeConfig.url.replace(/\/$/, ''), key:nativeConfig.key, model:nativeConfig.model, provider:nativeConfig.provider};
  // 1. 优先直接调用主程序的中央分流路由器，传入 'forum' 标识
  if (typeof window.getApiCredentials === 'function') {
    const apiConfig = window.getApiCredentials('forum');
    return {
      url: apiConfig.endpoint,
      key: apiConfig.key,
      model: apiConfig.model || 'gpt-3.5-turbo'
    };
  }

  // 2. 备用兜底（防止主程序 getApiCredentials 未加载时的异常）
  const urlEl = document.getElementById('apiEndpoint');
  const keyEl = document.getElementById('apiKey');
  const modelEl = document.getElementById('apiModel');

  if (urlEl && keyEl) {
    let url = urlEl.value.trim();
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    return {
      url: url,
      key: keyEl.value.trim(),
      model: modelEl ? modelEl.value.trim() : 'gpt-3.5-turbo'
    };
  }

  return null;
}

// 通用提示框 (防止 showToast 未定义导致的报错)
function showToast(message) {
  message=String(message).replace(/論壇|论坛/g,'MONO');
  // 如果主程序 script.js 已经定义了 alert 或其他提示，这里做一个轻量级替代
  // 检查页面上是否已有 toast 容器
  let toast = document.getElementById('forum-toast-container');
  
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'forum-toast-container';
    toast.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    `;
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.opacity = '1';

  // 2秒后消失
  setTimeout(() => {
    toast.style.opacity = '0';
  }, 2000);
}

// ==================== 新增辅助函数 ====================

// 获取所有“AI参与者”自带的世界书ID列表
// 获取所有“AI参与者”应生效的世界书ID列表（增强版）
function getCharacterBoundWorldbooks() {
  const charBoundIds = new Set();
  const allChats = window.chatList || [];
  const globalWorldbooks = getGlobalWorldbooks();

  // 遍历论坛里的 AI 参与者
  if (forumSettings.aiParticipants && forumSettings.aiParticipants.length > 0) {
    forumSettings.aiParticipants.forEach(participant => {
      const charId = String(participant.charId);
      
      // 1. 检查聊天对象里的 worldBooks 数组 (旧逻辑)
      const chat = allChats.find(c => String(c.id) === charId);
      if (chat && chat.worldBooks && Array.isArray(chat.worldBooks)) {
        chat.worldBooks.forEach(wbRef => {
          let wbId = wbRef;
          // 兼容旧数据(存名字)
          if (typeof wbRef === 'string' && isNaN(wbRef)) {
             const found = globalWorldbooks.find(w => w.name === wbRef);
             if (found) wbId = found.id;
          }
          if (wbId) charBoundIds.add(Number(wbId));
        });
      }

      // 2. ★★★ 新增：检查世界书本身的 boundCharId 属性 ★★★
      // 这就是你要求的“开启角色世界书并绑定给谁”的逻辑
      globalWorldbooks.forEach(wb => {
          if (wb.isCharBook === true && String(wb.boundCharId) === charId) {
              charBoundIds.add(Number(wb.id));
          }
      });
    });
  }
  return Array.from(charBoundIds);
}
// ==================== 核心修复：数据获取工具 ====================

// 安全获取全局世界书列表（解决变量名大小写不一致问题）
function getGlobalWorldbooks() {
  const nativeBooks = forumNativeDb()?.worldBooks;
  if (Array.isArray(nativeBooks)) return structuredClone(nativeBooks);
  // 1. 尝试直接获取主程序定义的变量 (注意大小写 worldBooks)
  if (typeof window.worldBooks !== 'undefined' && Array.isArray(window.worldBooks)) {
    return window.worldBooks;
  }
  
  // 2. 尝试从全局数据对象 globalData 中获取 (这是最稳的来源)
  if (window.globalData && Array.isArray(window.globalData.worldBooksObj)) {
    return window.globalData.worldBooksObj;
  }
  
  // 3. 尝试全小写 (兼容旧代码)
  if (typeof window.worldbooks !== 'undefined' && Array.isArray(window.worldbooks)) {
    return window.worldbooks;
  }
  
  // 4. 如果都找不到，返回空数组
  return [];
}

// ==================== 论坛预设管理逻辑 (UI升级版) ====================

// 1. 控制折叠面板的展开/收起
function toggleForumPresetPanel() {
  const accordion = document.getElementById('forumPresetAccordion');
  if (accordion) {
    accordion.classList.toggle('active');
  }
}

// 2. 新建保存 (对应红色"新建保存"按钮)
async function saveNewForumPreset() {
  const name = prompt("请输入预设名称（例如：赛博朋克、修仙世界）：");
  if (!name || !name.trim()) return;
  const presetName = name.trim();

  // ★★★ 核心修复：深拷贝当前设置 ★★★
  // 原理：把对象转成字符串再转回来，彻底切断与当前设置的联系
  const settingsSnapshot = JSON.parse(JSON.stringify(forumSettings));

  const newPreset = {
    name: presetName,
    settings: settingsSnapshot
  };

  // 检查是否重名
  const existingIndex = forumPresets.findIndex(p => p.name === presetName);
  
  if (existingIndex >= 0) {
    if (!confirm(`预设 "${presetName}" 已存在，要覆盖它吗？`)) return;
    forumPresets[existingIndex] = newPreset;
  } else {
    forumPresets.push(newPreset);
  }

  // 存入数据库
  await localforage.setItem("forumPresets", forumPresets);
  showToast(`已保存：${presetName}`);

  // 刷新界面
  renderForumSettings();
  
  // 保持面板展开，自动选中刚才保存的项
  setTimeout(() => {
    const accordion = document.getElementById('forumPresetAccordion');
    if(accordion) accordion.classList.add('active'); 
    
    const select = document.getElementById('forumPresetSelect');
    // 如果是覆盖更新，existingIndex有效；如果是新增，选中最后一个
    if(select) select.value = existingIndex >= 0 ? existingIndex : forumPresets.length - 1;
  }, 50);
}

// 3. 覆盖更新 (对应灰色"覆盖更新"按钮)
async function updateCurrentForumPreset() {
  const select = document.getElementById("forumPresetSelect");
  const index = select.value;

  if (index === "" || !forumPresets[index]) {
    showToast("⚠️ 请先在下拉框中选择一个要更新的预设");
    return;
  }

  const targetPreset = forumPresets[index];

  if (!confirm(`确定要用当前的设置覆盖预设 "${targetPreset.name}" 吗？\n注意：预设里的旧数据将无法恢复。`)) return;

  // ★★★ 核心修复：同样使用深拷贝 ★★★
  const settingsSnapshot = JSON.parse(JSON.stringify(forumSettings));
  
  // 更新数组里的数据
  forumPresets[index].settings = settingsSnapshot;

  await localforage.setItem("forumPresets", forumPresets);
  showToast(`预设 "${targetPreset.name}" 已更新`);
}

// 4. 加载预设 (对应下拉框 onchange 事件)
async function loadSelectedForumPreset() {
  const select = document.getElementById("forumPresetSelect");
  const index = select.value;

  // 如果选的是默认提示项"-- 选择已保存的预设 --"，什么都不做
  if (index === "") return;

  const preset = forumPresets[index];
  if (!preset) return;

  if (!confirm(`确定加载预设 "${preset.name}" 吗？\n当前未保存的修改将会丢失！`)) {
    select.value = ""; // 如果取消，重置下拉框
    return;
  }

  // ★★★ 核心修复：加载时也要深拷贝 ★★★
  // 防止加载后，你修改了界面，结果把预设源文件给改了
  forumSettings = JSON.parse(JSON.stringify(preset.settings));

  // 保存为当前正在使用的设置
  await localforage.setItem("forumSettings", forumSettings);
  showToast(`已加载方案：${preset.name}`);

  // 刷新界面显示新数据
  renderForumSettings();

  // 保持面板展开，并保持选中状态
  setTimeout(() => {
    const accordion = document.getElementById('forumPresetAccordion');
    if(accordion) accordion.classList.add('active');
    
    const newSelect = document.getElementById('forumPresetSelect');
    if(newSelect) newSelect.value = index;
  }, 50);
}

// 5. 删除预设 (对应红色"删除"按钮)
async function deleteSelectedForumPreset() {
  const select = document.getElementById("forumPresetSelect");
  const index = select.value;

  if (index === "" || !forumPresets[index]) {
    showToast("⚠️ 请先选择要删除的预设");
    return;
  }

  if (!confirm(`确定要删除预设 "${forumPresets[index].name}" 吗？`)) return;

  // 从数组移除
  forumPresets.splice(index, 1);
  await localforage.setItem("forumPresets", forumPresets);
  showToast("方案已删除");

  // 刷新界面
  renderForumSettings();
  
  // 保持展开
  setTimeout(() => {
    const accordion = document.getElementById('forumPresetAccordion');
    if(accordion) accordion.classList.add('active');
  }, 50);
}

// ========== 点击图标刷新评论 (无旋转动画版) ==========
async function refreshPostComments(postId, btnElement) {
  // 简单的防抖，防止狂点
  if (btnElement?.dataset.loading === "true") return;
  if(btnElement) btnElement.dataset.loading = "true";

  // 1. 不旋转，只显示提示
  showToast("正在召唤网友评论...");

  try {
    // 2. 调用生成接口
    await generateMoreComments(postId);
  } catch (e) {
    console.error(e);
    showToast("生成评论失败");
  } finally {
    // 3. 解除点击锁定
    if(btnElement) btnElement.dataset.loading = "false";
  }
}

// 当点击卡片时触发
ForumApp.openForumPostFromCard = function(postId) {
    console.log("跳转帖子ID:", postId);
    
    // 1. 打开论坛APP页面 (对应 script.js 里的 openApp 逻辑)
    // 如果你的 script.js 里定义了 openApp 函数
    if (typeof openApp === 'function') {
        openApp('Page 4'); // Page 4 是论坛
    } else {
        // 强制显示
        document.getElementById('appOverlay')?.classList.add('active');
        if(document.getElementById('chatAppPage')) document.getElementById('chatAppPage').style.display = 'none';
        document.getElementById('forumPage').style.display = 'block';
    }

    // 2. 延时进入详情页
    setTimeout(() => {
        if (typeof openForumPostDetail === 'function') {
            openForumPostDetail(Number(postId));
        }
    }, 300);
};

// ==================== [新增] 安全头像压缩与写入机制 (防 QuotaExceededError) ====================

/**
 * 智能头像压缩器（限制最大 150x150，PNG 格式保留透明度，防黑底）
 */
function compressAvatar(base64Str, maxWidth = 150, maxHeight = 150) {
  return new Promise((resolve) => {
    // 安全守卫 1: 如果是网络路径、非 base64、或者是 SVG，直接返回不压缩，防止 CORS 跨域或 SVG 渲染报错
    if (!base64Str || !base64Str.startsWith('data:') || base64Str.includes('image/svg+xml')) {
      resolve(base64Str);
      return;
    }
    
    // 安全守卫 2: 如果图片本来就很小（小于 30KB），没必要压缩，避免不必要的性能损耗
    if (base64Str.length < 30 * 1024) {
      resolve(base64Str);
      return;
    }

    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      
      // 等比例缩放计算
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.clearRect(0, 0, width, height); // 保持透明通道，防止 PNG 变黑底
        ctx.drawImage(img, 0, 0, width, height);
        // 使用 image/png 格式，在 150x150 的尺寸下通常只需 10~25KB 左右，且无损透明度
        const compressedData = canvas.toDataURL('image/png');
        resolve(compressedData);
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str); // 加载失败时保底返回原图，不影响流程
    };
    img.src = base64Str;
  });
}

/**
 * 安全保存全局头像至 localStorage
 */
async function saveGlobalAvatar(avatarData) {
  try {
    // 压缩成超小体积
    const compressed = await compressAvatar(avatarData, 150, 150);
    localStorage.setItem("avatarImg", compressed);
    return compressed;
  } catch (e) {
    console.error("[论坛] 保存全局头像失败:", e);
    // 存储空间彻底全满的优雅降级处理
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      showToast("浏览器本地存储空间已满，头像未成功同步，请清理浏览器缓存");
    }
    return avatarData;
  }
}


let forumDMLoaded=false;
let currentDMConversationId=null;
// Requested additions: read-only 404 bridge, independent forum DM state and settings.
const forumDMTasks = new Map();
const forumDrafts = new Map();
let forumSaveQueue = Promise.resolve();
function forumNativeDb() { return typeof db !== 'undefined' ? db : window.db || null; }
function forumNativeCharacters() {
  const list=forumNativeDb()?.characters || window.characters || window.chatList || [];
  return Array.isArray(list) ? list : [];
}
function forumCharacter(id) { return forumNativeCharacters().find(c=>String(c.id)===String(id)); }
function forumSafeImage(value) {
  const s=String(value || '').trim();
  if (/^(?:https?:\/\/|data:image\/(?:png|jpeg|jpg|gif|webp|avif|svg\+xml);|blob:)/i.test(s)) return escapeForumHtml(s);
  return '';
}
function forumImageValue(value) {
  const s=String(value || '').trim();
  return /^(?:https?:\/\/|data:image\/(?:png|jpeg|jpg|gif|webp|avif|svg\+xml);|blob:)/i.test(s) ? s : '';
}
function forumIcon(name) {
  const paths={
    home:'<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z"/>',
    search:'<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
    plusSquare:'<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 7v10M7 12h10"/>',
    plus:'<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/>',
    mail:'<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m3 6 9 7 9-7"/>',
    back:'<path d="m15 4-8 8 8 8"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    personPlus:'<circle cx="10" cy="7" r="3.5"/><path d="M3 21v-2a7 7 0 0 1 14 0v2M19 7v6M16 10h6"/>',
    send:'<path d="m22 2-8 20-4-8-8-4Z"/><path d="m22 2-12 12"/>',
    mic:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M9 22h6"/>',
    image:'<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 5-7 4 5"/>',
    sticker:'<path d="M21 14V7a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h7Z"/><path d="M14 21v-3a4 4 0 0 1 4-4h3M8 8v1M16 8v1M8 13a5 5 0 0 0 8 0"/>',
    refresh:'<path d="M21 4v6h-6M20 10a8 8 0 1 0-2 9"/>',
    phone:'<path d="m6 3 4 4-2 3a16 16 0 0 0 6 6l3-2 4 4c-3 6-9 3-14-2S1 6 6 3Z"/>',
    video:'<rect x="2" y="5" width="14" height="14" rx="3"/><path d="m16 10 6-4v12l-6-4"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.more}</svg>`;
}
function forumMount(el) { (document.querySelector('.phone-screen') || document.body).appendChild(el); }
function forumSheet(title,content) {
  document.getElementById('forumAuxSheet')?.remove();
  const el=document.createElement('div');el.id='forumAuxSheet';el.className='forum-aux-overlay';
  el.innerHTML=`<section class="forum-aux-sheet"><header><strong>${escapeForumHtml(title)}</strong><button aria-label="关闭">${forumIcon('close')}</button></header><main>${content}</main></section>`;
  el.querySelector('header button').onclick=()=>el.remove();el.onclick=e=>{if(e.target===el)el.remove();};forumMount(el);return el;
}
function forumBindSheet(el, action) {
  el.querySelectorAll('[data-action]').forEach(button=>{button.onclick=()=>Promise.resolve(action(button.dataset.action,button)).catch(e=>showToast(e.message));});
}
function forumReadFile(file) { return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(Error('图片读取失败'));r.readAsDataURL(file);}); }
function forumChoosePicture(onSelect) {
  const sheet=forumSheet('更换图片',`<button class="forum-sheet-row" data-action="local">从本地选择</button><button class="forum-sheet-row" data-action="url">使用图片链接</button>`);
  forumBindSheet(sheet,async action=>{
    if(action==='local') {
      const input=document.createElement('input');input.type='file';input.accept='image/*';
      input.onchange=async()=>{try{if(!input.files[0])return;const value=await forumReadFile(input.files[0]);await onSelect(value);sheet.remove();}catch(e){showToast(e.message);}};input.click();
    } else {
      sheet.querySelector('main').innerHTML='<label class="forum-label">图片链接</label><input class="forum-input" id="forumPictureUrl" type="url" placeholder="https://…"><button class="forum-sheet-primary" id="forumApplyPicture">使用此图片</button>';
      sheet.querySelector('#forumApplyPicture').onclick=async()=>{const url=sheet.querySelector('input').value.trim();if(!/^https?:\/\//i.test(url))return showToast('请输入 http 或 https 图片链接');try{await onSelect(url);sheet.remove();}catch(e){showToast(e.message);}};
    }
  });
}
function forumChooseEditorImage(inputId) {
  const input=document.getElementById(inputId);if(!input)return;
  forumChoosePicture(async value=>{
    const targets={profileAvatarInput:['profileAvatarPreview',null],profileBannerInput:[null,null],forumParticipantAvatarInput:['forumParticipantAvatarPreview','forumParticipantAvatarData'],forumParticipantBannerInput:[null,'forumParticipantBannerData'],forumNpcAvatarInput:['forumNpcAvatarPreview','forumNpcAvatarData'],forumNpcBannerInput:[null,'forumNpcBannerData']};
    const [previewId,dataId]=targets[inputId] || [];
    if(dataId)document.getElementById(dataId).value=value;
    const preview=previewId?document.getElementById(previewId):inputId==='profileBannerInput'?input.closest('.forum-profile-editor-banner'):input.previousElementSibling;
    if(preview?.tagName==='IMG')preview.src=value;
    else if(preview){const image=document.createElement('img');image.src=value;image.alt='';const old=preview.querySelector('img');if(old)old.replaceWith(image);else preview.prepend(image);}
  });
}
function changeProfileAvatar() {
  forumChoosePicture(async value=>{const saved=await compressAvatar(value,150,150);forumSettings.userAvatar=saved;await localforage.setItem('forumSettings',forumSettings);renderForumProfile(currentProfileTab);});
}
function changeProfileBanner() {
  forumChoosePicture(async value=>{forumSettings.userBanner=value;await localforage.setItem('forumSettings',forumSettings);renderForumProfile(currentProfileTab);});
}
async function forumShareProfile() {
  const handle=String(forumSettings.userHandle || generateEnglishHandle(forumSettings.userNickname)).replace(/^@/,'');
  const text=`${forumSettings.userNickname || '用户'} @${handle}\n${forumSettings.userBio || ''}`;
  const sheet=forumSheet('分享主页',`<p class="forum-sheet-copy">${escapeForumHtml(text)}</p><button class="forum-sheet-primary" data-action="copy">复制主页信息</button>`);
  forumBindSheet(sheet,async()=>{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);showToast('已复制');}else {const field=document.createElement('textarea');field.value=text;sheet.querySelector('main').append(field);field.select();if(!document.execCommand('copy'))throw Error('请选择并复制上方信息');showToast('已复制');}});
}
function forumOpenPeople() {
  const sheet=forumSheet('联系人',`<div class="forum-people-list">${forumSettings.aiParticipants.map(p=>{const c=characters.find(c=>String(c.id)===String(p.charId));return `<button class="forum-sheet-row" data-char="${escapeForumHtml(String(p.charId))}"><img src="${forumSafeImage(p.avatar || c?.avatar) || getDefaultAvatarDataUrl()}" alt=""><span>${escapeForumHtml(p.nickname || c?.name || '角色')}</span></button>`;}).join('') || '<p>先在论坛设置中添加 AI 角色。</p>'}</div>`);
  sheet.querySelectorAll('[data-char]').forEach(b=>b.onclick=async()=>{sheet.remove();await openOtherUserProfile('ai',characters.find(c=>String(c.id)===b.dataset.char)?.name || '',b.dataset.char);});
}
async function forumMessageProfile() {
  const info=currentViewingUser;if(!info)return;
  const id=info.type==='npc'?`npc_${info.id}`:info.type==='ai'?`ai_${info.id}`:`random_${info.id || info.name}`;
  await initDirectMessages();let conv=forumDirectMessages.find(c=>c.id===id);
  if(!conv){conv={id,name:info.name,avatar:info.avatar || '',forumPersona:info.fullPersona || info.identity || '',messages:[],unread:0,lastMessage:'',lastMessageTime:0};forumDirectMessages.push(conv);await forumSaveDMs();}
  currentDMConversationId=id;forumRenderChat(conv);
}
function forumFilterContacts(value) {
  const text=String(value).trim().toLowerCase();document.querySelectorAll('.forum-dm-page .forum-dm-item').forEach(row=>{row.hidden=!row.textContent.toLowerCase().includes(text);});
}
function forumSaveDMs() {
  const snapshot=structuredClone(forumDirectMessages),key=monoDMKey();
  forumSaveQueue=forumSaveQueue.catch(()=>{}).then(()=>localforage.setItem(key,snapshot));return forumSaveQueue;
}
function forumGetConv(id=currentDMConversationId) { return forumDirectMessages.find(c=>c.id===id); }
function forumDMOptions(conv) { conv.chatOptions ||= {stickerMatch:true,contextLimit:40}; return conv.chatOptions; }
function forumDraftSave(value){if(currentDMConversationId)forumDrafts.set(currentDMConversationId,value);}
function forumRenderChat(conversation) {
  const existing=document.querySelector('.forum-dm-chat');
  if(existing){const field=existing.querySelector('#dmInput');if(field)forumDrafts.set(existing.dataset.conversation,field.value);existing.remove();}
  const avatar=forumSafeImage(conversation.avatar) || getDefaultAvatarDataUrl();
  let previousTime=0;
  const messages=(conversation.messages || []).map(msg=>{
    const stamp=Number(msg.timestamp)||0;const time=stamp && stamp-previousTime>5*60000?`<time class="forum-dm-timestamp">${escapeForumHtml(forumChatTime(stamp))}</time>`:'';previousTime=stamp;
    const mine=msg.sender==='user';let content=msg.sticker?`<img class="forum-dm-sticker" src="${forumSafeImage(msg.sticker.data)}" alt="${escapeForumHtml(msg.sticker.name || '表情包')}">`:msg.image?`<img class="forum-dm-photo" src="${forumSafeImage(msg.image)}" alt="图片">`:`<div class="forum-dm-msg-bubble">${escapeForumHtml(msg.content)}</div>`;
    return `${time}<div class="forum-dm-message ${mine?'mine':'other'} ${msg.sticker?'has-sticker':''}">${mine?'':`<div class="forum-dm-msg-avatar"><img src="${avatar}" alt=""></div>`}${content}</div>`;
  }).join('');
  const c=forumCharacter(conversation.id.startsWith('ai_')?conversation.id.slice(3):'');
  const handle=forumSettings.aiParticipants.find(p=>String(p.charId)===String(c?.id))?.handle || generateEnglishHandle(conversation.name);
  const page=document.createElement('div');page.className='forum-dm-chat';page.dataset.conversation=conversation.id;
  page.innerHTML=`<header class="forum-dm-chat-header"><button data-dm="back" aria-label="返回">${forumIcon('back')}</button><div class="forum-dm-chat-user"><img class="forum-dm-chat-avatar" src="${avatar}" alt=""><div><strong class="forum-dm-chat-name">${escapeForumHtml(conversation.name)}</strong><small>${escapeForumHtml(handle.replace(/^@/,''))}</small></div></div><button data-dm="settings" aria-label="聊天设置">${forumIcon('more')}</button></header><div class="forum-dm-messages" id="dmMessagesContainer">${messages || '<div class="forum-dm-empty">开始聊天吧</div>'}</div><div class="forum-dm-status" aria-live="polite">${forumDMTasks.has(conversation.id)?'正在输入…':''}</div><footer class="forum-dm-composer"><div class="forum-dm-input-area"><button class="forum-dm-send" data-dm="send" aria-label="发送消息">${forumIcon('send')}</button><input class="forum-dm-input" id="dmInput" placeholder="发消息…" autocomplete="off"><button data-dm="generate" aria-label="生成回复" title="生成回复">${forumIcon('mic')}</button><button data-dm="image" aria-label="发送图片">${forumIcon('image')}</button><button data-dm="stickers" aria-label="表情包">${forumIcon('sticker')}</button><button data-dm="more" aria-label="更多">${forumIcon('plus')}</button></div></footer>`;
  forumMount(page);const input=page.querySelector('#dmInput');input.value=forumDrafts.get(conversation.id) || '';input.oninput=()=>forumDraftSave(input.value);input.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();sendDirectMessage();}};
  page.querySelectorAll('[data-dm]').forEach(b=>b.onclick=()=>{const action=b.dataset.dm;if(action==='back'){forumDraftSave(input.value);page.remove();return;}if(action==='send')sendDirectMessage();if(action==='generate')generateDMReply();if(action==='settings')forumOpenChatSettings();if(action==='stickers')forumStickerPicker();if(action==='image')forumChoosePicture(value=>forumSendAttachment({image:value,content:'[图片]'}));if(action==='more'){const sheet=forumSheet('更多',`<button class="forum-sheet-row" data-action="reply">生成回复</button><button class="forum-sheet-row" data-action="stickers">表情包</button><button class="forum-sheet-row" data-action="background">更换聊天背景</button><button class="forum-sheet-row" data-action="settings">聊天设置</button>`);forumBindSheet(sheet,async a=>{sheet.remove();if(a==='reply')await generateDMReply();if(a==='stickers')forumStickerPicker();if(a==='background')forumChangeChatBackground();if(a==='settings')forumOpenChatSettings();});}});
  if(forumDMOptions(conversation).background){page.querySelector('.forum-dm-messages').style.backgroundImage=`url("${forumImageValue(conversation.chatOptions.background).replace(/["\\\n\r]/g,'')}")`;}
  const body=page.querySelector('.forum-dm-messages');body.scrollTop=body.scrollHeight;
}
function forumChatTime(stamp) {
  const d=new Date(stamp),today=new Date();return (d.toDateString()===today.toDateString()?'':`${d.getMonth()+1}/${d.getDate()} `)+d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
}
async function sendDirectMessage() {
  const conv=forumGetConv();const field=document.getElementById('dmInput');const text=field?.value.trim();if(!conv || !text)return;
  conv.messages ||= [];conv.messages.push({id:Date.now(),sender:'user',content:text,timestamp:Date.now()});conv.lastMessage=text;conv.lastMessageTime=Date.now();field.value='';forumDrafts.set(conv.id,'');await forumSaveDMs();if(currentDMConversationId===conv.id)forumRenderChat(conv);
}
async function forumSendAttachment(attachment) {
  const conv=forumGetConv();if(!conv)return;conv.messages ||= [];conv.messages.push({id:Date.now(),sender:'user',timestamp:Date.now(),...attachment});conv.lastMessage=attachment.content;conv.lastMessageTime=Date.now();await forumSaveDMs();if(currentDMConversationId===conv.id)forumRenderChat(conv);document.getElementById('forumAuxSheet')?.remove();
}
function forumStickers(roleId=null) {
  const groups=roleId?String(forumCharacter(roleId)?.stickerGroups || '').split(/[,，]/).map(x=>x.trim()).filter(Boolean):null;
  return structuredClone((forumNativeDb()?.myStickers || []).filter(s=>s.name && forumImageValue(s.data) && (!groups || groups.includes(s.group || '未分类'))));
}
function forumStickerPicker(group=null) {
  const pool=forumStickers(),groups=[...new Set(pool.map(s=>s.group).filter(Boolean))];
  const sheet=forumSheet('表情包',`<div class="forum-sticker-categories"><button data-category="all" class="${group===null?'active':''}">全部</button>${groups.map(g=>`<button data-category="${escapeForumHtml(g)}" class="${group===g?'active':''}">${escapeForumHtml(g)}</button>`).join('')}<button data-category="" class="${group===''?'active':''}">未分类</button></div><div class="forum-sticker-grid">${pool.map((s,i)=>({s,i})).filter(({s})=>group===null || (s.group || '')===group).map(({s,i})=>`<button data-sticker="${i}"><img src="${forumSafeImage(s.data)}" alt="${escapeForumHtml(s.name)}" loading="lazy"><small>${escapeForumHtml(s.name)}</small></button>`).join('') || '<p>这个分类没有表情包。请先在 404 上传。</p>'}</div>`);
  sheet.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>forumStickerPicker(b.dataset.category==='all'?null:b.dataset.category));sheet.querySelectorAll('[data-sticker]').forEach(b=>b.onclick=()=>{const s=pool[Number(b.dataset.sticker)];forumSendAttachment({sticker:{name:s.name,data:s.data},content:`[表情包：${s.name}]`}).catch(e=>showToast(e.message));});
}
function forumResolveSticker(name,pool,match) {
  let found=pool.find(s=>s.name===name);if(found || !match)return found;
  const normalize=x=>String(x).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
  const key=normalize(name);found=pool.find(s=>normalize(s.name)===key);if(found)return found;
  if(key.length>=2){const candidates=pool.filter(s=>normalize(s.name).includes(key) || key.includes(normalize(s.name)) && normalize(s.name).length>=2);if(candidates.length===1)return candidates[0];}
  return null;
}
function forumParseReply(raw,conv) {
  const clean=String(raw || '').replace(/<(thinking|think|analysis)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<(thinking|think|analysis)\b[^>]*>[\s\S]*$/gi,'').replace(/^```(?:json)?\s*|\s*```$/g,'').trim();if(!clean)throw Error('模型没有返回可见回复');
  let messages;try{const obj=JSON.parse(clean);messages=Array.isArray(obj.messages)?obj.messages:Array.isArray(obj)?obj:null;}catch{}
  if(!messages){if(/^[{[]/.test(clean))throw Error('回复格式不完整，请重新生成');messages=[clean];}
  const cId=conv.id.startsWith('ai_')?conv.id.slice(3):null,pool=forumStickers(cId),out=[];
  const add=text=>{text=String(text || '').trim();if(!text)return;if(/<\/?(?:html|script|div|span|style)\b/i.test(text))throw Error('回复混入了页面格式');out.push({content:text});};
  for(const m of messages){if(typeof m!=='string' && (!m || typeof m!=='object'))throw Error('回复内容格式异常');
    if(m?.sticker){const sticker=forumResolveSticker(String(m.sticker),pool,forumDMOptions(conv).stickerMatch);if(sticker)out.push({content:`[表情包：${sticker.name}]`,sticker:{name:sticker.name,data:sticker.data}});else add(`[表情包：${m.sticker}]`);}
    let text=typeof m==='string'?m:m.text || m.content || '';
    // Compatibility for native plain-message wrappers; no native action executor is called.
    text=text.replace(/\[[^\]\n]*?的消息[：:]([^\]]*)\]/g,'$1');
    const pattern=/\[(?:[^\]\n]*?的|[^\]\n]*?发送的)?表情包[：:]([^\]\n]+)\]/g;let cursor=0,hit;
    while((hit=pattern.exec(text))){add(text.slice(cursor,hit.index));const s=forumResolveSticker(hit[1].trim(),pool,forumDMOptions(conv).stickerMatch);if(s)out.push({content:`[表情包：${s.name}]`,sticker:{name:s.name,data:s.data}});else add(hit[0]);cursor=pattern.lastIndex;}add(text.slice(cursor));
  }
  if(!out.length)throw Error('没有可显示的回复');return out;
}
function forumHostContext(conv) {
  const char=conv.id.startsWith('ai_')?forumCharacter(conv.id.slice(3)):null;if(!char)return '';
  const copy=structuredClone(char),native=forumNativeDb();let prompt='';
  copy.myName=forumSettings.userNickname || forumSettings.userHandle || '用户';copy.myPersona=forumSettings.userIdentity || '';
  if(!forumDMOptions(conv).read404Context){copy.memoryJournals=[];copy.history=[];}
  // Account records and switching metadata are never included in model requests.
  if(typeof generatePrivateSystemPrompt==='function')prompt=generatePrivateSystemPrompt(copy);
  else {prompt=[copy.persona,copy.systemPrompt,...(native?.worldBooks || []).filter(w=>(copy.worldBookIds || []).some(id=>String(id)===String(w.id))).map(w=>w.content)].filter(Boolean).join('\n');}
  if(forumDMOptions(conv).read404Context){const limit=forumDMOptions(conv).contextLimit||40;const history=(copy.history||[]).filter(m=>!m.isContextDisabled).slice(-limit).map(m=>{const text=typeof m.content==='string'?m.content:Array.isArray(m.content)?m.content.filter(p=>p.type==='text').map(p=>p.text).join(''):'';return (m.role||m.sender||'消息')+'：'+text;}).join('\n');if(history)prompt+='\n[404聊天记录·只读背景]\n'+history;}
  const cot=native?.cotSettings || {};let chain='';
  if(cot.enabled){const preset=(native.cotPresets || []).find(p=>p.id===(copy.exclusiveCotPreset || cot.activePresetId));chain=(preset?.items || []).filter(i=>i.enabled!==false).map(i=>i.content).join('\n\n');}
  return `${prompt}\n${chain?'[当前启用思维链·只读]\n'+chain:''}\n[MONO独立会话]\n404资料仅供只读参考。当前输入在MONO独立对话中发生，MONO事件不写回404聊天或记忆，不触发404操作。`;
}
function forumDMConfig(conv) {
  const base={...(forumNativeDb()?.apiSettings || {})};const c=conv.id.startsWith('ai_')?forumCharacter(conv.id.slice(3)):null;
  if(c?.exclusiveApiEnabled){const p=(forumNativeDb()?.apiPresets || []).find(p=>p.name===c.exclusiveApiPreset)?.data;if(p)Object.assign(base,{url:p.apiUrl || base.url,key:p.apiKey || base.key,model:p.model || base.model,provider:p.provider || base.provider});}
  const fallback=getActiveApiConfig();const config={...fallback,...Object.fromEntries(Object.entries(base).filter(([,v])=>v!==undefined && v!==''))};
  if(!config.url || !config.key)throw Error('请先配置API');if(typeof getRandomValue==='function')config.key=getRandomValue(config.key);return config;
}
async function forumModel(conv,system,messages,signal) {
  const config=forumDMConfig(conv);const base=String(config.url).replace(/\/$/,'');
  const native=!!forumNativeDb()?.apiSettings;
  const url=forumApiEndpoint(config);
  if(config.provider==='gemini') {
    const endpoint=forumApiEndpoint(config);
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}))}),signal});
    if(!response.ok)throw Error(`API请求失败（${response.status}）`);const data=await response.json();const result=data.candidates?.[0]?.content?.parts?.filter(p=>!p.thought).map(p=>p.text || '').join('');if(!result)throw Error('API未返回消息内容');return result;
  }
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.key}`},body:JSON.stringify({model:config.model || 'gpt-3.5-turbo',messages:[{role:'system',content:system},...messages],temperature:0.9,max_tokens:parseInt(document.getElementById('apiMaxTokens')?.value)||2048}),signal});
  if(!response.ok)throw Error(`API请求失败（${response.status}）`);const data=await response.json();const content=data.choices?.[0]?.message?.content;if(!content)throw Error('API未返回消息内容');return content;
}
async function forumGenerateFor(id,reroll=false,legacyPending=false) {
  const conv=forumGetConv(id);if(!conv)return;if(forumDMTasks.has(id))return showToast('此对话正在生成');
  const controller=new AbortController(),task={controller};forumDMTasks.set(id,task);const timer=setTimeout(()=>controller.abort(),90000);
  const snapshot=structuredClone(conv.messages || []);let kept=snapshot;
  if(reroll){let index=kept.length;while(index>0 && kept[index-1].sender==='other')index--;kept=kept.slice(0,index);}
  const fingerprint=JSON.stringify(conv.messages || []);const limit=Math.max(6,Math.min(200,Number(forumDMOptions(conv).contextLimit)||40));
  try{
    if(currentDMConversationId===id)forumRenderChat(conv);
    const pool=forumStickers(id.startsWith('ai_')?id.slice(3):null);
    const system=forumHostContext(conv)+'\n'+(legacyPending?forumLegacyPendingPrompt({...conv,messages:kept}):forumOriginalDMPrompt({...conv,messages:kept}))+'\n[论坛私信输出协议]\n保留上文角色设定与思维链，不执行404消息动作。可以从此列表选择表情包：'+pool.map(s=>s.name).join('、')+'。最终回复用JSON：{"messages":[{"text":"消息"},{"sticker":"表情包名称"}]}。只使用普通文本和已有表情包，不输出HTML、界面包装、转账或404动作。内部思考不显示在气泡里。\n[论坛独立记忆总结]\n'+(conv.summaries?.at(-1)?.content || '尚无总结')+monoDMFeatureProtocol();
    const history=kept.slice(-limit).map(m=>({role:m.sender==='user'?'user':'assistant',content:m.content || '[图片]'}));
    const raw=await forumModel(conv,system,history,controller.signal);if(controller.signal.aborted || forumDMTasks.get(id)!==task)return;
    if(JSON.stringify(conv.messages || [])!==fingerprint)throw Error('对话已变化，本次回复未写入，请重新生成');
    const replies=forumParseReply(raw,conv);await monoDeliverReplies(conv,replies,kept,task);
  }catch(e){if(e.name!=='AbortError'){conv.replyErrors=(conv.replyErrors || []).concat({at:Date.now(),reason:String(e.message).replace(/https?:\/\/\S+/g,'[API地址]')}).slice(-8);await forumSaveDMs();showToast('生成失败：'+e.message);}}
  finally{clearTimeout(timer);if(forumDMTasks.get(id)===task)forumDMTasks.delete(id);if(currentDMConversationId===id && document.querySelector('.forum-dm-chat'))forumRenderChat(conv);}
}
function forumStopGeneration(id=currentDMConversationId) { const task=forumDMTasks.get(id);task?.controller.abort();forumDMTasks.delete(id); }
async function forumChangeChatBackground(){const conv=forumGetConv();if(!conv)return;forumChoosePicture(async value=>{forumDMOptions(conv).background=value;await forumSaveDMs();if(currentDMConversationId===conv.id)forumRenderChat(conv);});}
function forumOpenChatSettings() {
  const conv=forumGetConv();if(!conv)return;const opts=forumDMOptions(conv);
  const sheet=forumSheet('聊天设置',`<p class="forum-settings-person">${escapeForumHtml(conv.name)}</p><h3>对话</h3><button class="forum-sheet-row" data-action="errors"><span>最近回复错误</span><small>${conv.replyErrors?.length || 0} 条</small></button><div class="forum-sheet-pair"><button data-action="reroll">重新生成</button><button data-action="stop">暂停生成</button></div><label class="forum-setting-row"><span>表情包匹配</span><input id="forumStickerMatch" type="checkbox" ${opts.stickerMatch?'checked':''}></label><label class="forum-setting-row"><span>上下文条数</span><input id="forumContextLimit" type="number" min="6" max="200" value="${opts.contextLimit || 40}"></label><button class="forum-sheet-row" data-action="background">更换聊天背景</button><h3>记忆</h3><button class="forum-sheet-row" data-action="summary">生成记忆总结</button><button class="forum-sheet-row" data-action="summaries"><span>总结记录</span><small>${conv.summaries?.length || 0} 份</small></button><h3>此对话备份</h3><div class="forum-sheet-pair"><button data-action="export">导出记录</button><button data-action="import">导入记录</button></div><button class="forum-sheet-row forum-clear" data-action="clear">清除当前聊天记录</button>`);
  sheet.querySelector('#forumStickerMatch').onchange=async e=>{opts.stickerMatch=e.target.checked;await forumSaveDMs();};sheet.querySelector('#forumContextLimit').onchange=async e=>{opts.contextLimit=Math.max(6,Math.min(200,Number(e.target.value)||40));e.target.value=opts.contextLimit;await forumSaveDMs();};
  forumBindSheet(sheet,async action=>{
    if(action==='stop'){forumStopGeneration(conv.id);sheet.remove();forumRenderChat(conv);}
    if(action==='reroll'){sheet.remove();await forumGenerateFor(conv.id,true);}
    if(action==='background'){sheet.remove();forumChangeChatBackground();}
    if(action==='errors')forumSheet('最近回复错误',conv.replyErrors?.length?conv.replyErrors.slice().reverse().map(e=>`<article class="forum-summary"><small>${escapeForumHtml(new Date(e.at).toLocaleString())}</small><p>${escapeForumHtml(e.reason)}</p></article>`).join(''):'<p>暂无记录</p>');
    if(action==='summary'){sheet.remove();await forumSummarize(conv.id);}
    if(action==='summaries')forumShowSummaries(conv);
    if(action==='export')forumExportConversation(conv);
    if(action==='import')forumImportConversation(conv);
    if(action==='clear'){if(!confirm('清除当前论坛聊天及其总结？不会清除404聊天或其他论坛对话。'))return;forumStopGeneration(conv.id);conv.messages=[];conv.summaries=[];conv.lastMessage='';conv.lastMessageTime=0;conv.unread=0;forumDrafts.delete(conv.id);await forumSaveDMs();sheet.remove();forumRenderChat(conv);}
  });
}
function forumShowSummaries(conv) {forumSheet('总结记录',(conv.summaries || []).slice().reverse().map(s=>`<article class="forum-summary"><small>${escapeForumHtml(new Date(s.at).toLocaleString())}</small><p>${escapeForumHtml(s.content)}</p></article>`).join('') || '<p>暂无总结</p>');}
async function forumSummarize(id) {
  const conv=forumGetConv(id);if(!conv?.messages?.length)return showToast('还没有聊天记录');if(forumDMTasks.has(id))return showToast('请先等待或暂停当前生成');
  const task={controller:new AbortController()};forumDMTasks.set(id,task);const timer=setTimeout(()=>task.controller.abort(),90000);const snapshot=structuredClone(conv.messages),fingerprint=JSON.stringify(snapshot);
  try{showToast('正在整理记忆…');const prior=conv.summaries?.at(-1);const start=prior?.through || 0;if(start>=snapshot.length)return showToast('没有新增对话');
    const content=await forumModel(conv,'请简洁总结以下论坛独立对话中明确发生的事实、关系变化和未完成事项。不推测，不续写。只返回总结正文。\n已有总结：'+(prior?.content || ''),snapshot.slice(start).map(m=>({role:m.sender==='user'?'user':'assistant',content:m.content})),task.controller.signal);
    if(task.controller.signal.aborted || forumDMTasks.get(id)!==task)return;if(JSON.stringify(conv.messages)!==fingerprint)throw Error('聊天记录已变化，请重新总结');
    conv.summaries ||= [];conv.summaries.push({id:crypto.randomUUID(),at:Date.now(),through:snapshot.length,content:content.replace(/<(thinking|think|analysis)\b[^>]*>[\s\S]*?<\/\1>/gi,'').trim()});await forumSaveDMs();forumShowSummaries(conv);
  }catch(e){if(e.name!=='AbortError')showToast(e.message);}finally{clearTimeout(timer);if(forumDMTasks.get(id)===task)forumDMTasks.delete(id);}
}
function forumExportConversation(conv) {const blob=new Blob([JSON.stringify({format:'forum-dm-v1',conversation:conv},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='forum-chat-'+conv.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function forumImportConversation(conv) {
  const input=document.createElement('input');input.type='file';input.accept='application/json';input.onchange=async()=>{try{if(!input.files[0])return;const data=JSON.parse(await input.files[0].text());const incoming=data.conversation;
    if(data.format!=='forum-dm-v1' || incoming?.id!==conv.id || !Array.isArray(incoming.messages))throw Error('请选择当前角色的论坛聊天备份');
    if(!incoming.messages.every(m=>['user','other'].includes(m.sender) && typeof m.content==='string'))throw Error('备份消息格式不正确');
    if(!confirm('用此备份替换当前论坛对话？404聊天不受影响。'))return;forumStopGeneration(conv.id);conv.messages=structuredClone(incoming.messages);conv.summaries=Array.isArray(incoming.summaries)?incoming.summaries.filter(s=>typeof s.content==='string' && Number.isFinite(s.at)):[];conv.lastMessage=conv.messages.at(-1)?.content || '';conv.lastMessageTime=conv.messages.at(-1)?.timestamp || 0;conv.unread=0;forumDrafts.delete(conv.id);await forumSaveDMs();document.getElementById('forumAuxSheet')?.remove();forumRenderChat(conv);
  }catch(e){showToast('导入失败：'+e.message);}};input.click();
}

Object.defineProperty(ForumApp, 'settings', {get:()=>forumSettings});
Object.defineProperty(ForumApp, 'viewingUser', {get:()=>currentViewingUser});
// Public callbacks live in one namespace, never replace existing 404 helpers.
ForumApp.addForumWorldbook=addForumWorldbook;
ForumApp.cancelForumReply=cancelForumReply;
ForumApp.changeProfileAvatar=changeProfileAvatar;
ForumApp.changeProfileBanner=changeProfileBanner;
ForumApp.clearGeneratedPosts=clearGeneratedPosts;
ForumApp.closeDirectMessages=closeDirectMessages;
ForumApp.closeForumAuthorPicker=closeForumAuthorPicker;
ForumApp.closeForumCompose=closeForumCompose;
ForumApp.closeForumParticipantModal=closeForumParticipantModal;
ForumApp.closeForumPostDetail=closeForumPostDetail;
ForumApp.closeForumSettings=closeForumSettings;
ForumApp.closeForumWorldbookSelector=closeForumWorldbookSelector;
ForumApp.closeOtherUserProfile=closeOtherUserProfile;
ForumApp.closePage=closePage;
ForumApp.closeProfileEditor=closeProfileEditor;
ForumApp.closeQuoteRetweet=closeQuoteRetweet;
ForumApp.compressAvatar=compressAvatar;
ForumApp.confirmAddParticipant=confirmAddParticipant;
ForumApp.confirmDeletePost=confirmDeletePost;
ForumApp.confirmSaveNpc=confirmSaveNpc;
ForumApp.confirmSaveRelationship=confirmSaveRelationship;
ForumApp.deleteForumPost=deleteForumPost;
ForumApp.deleteSelectedForumPreset=deleteSelectedForumPreset;
ForumApp.editForumNpc=editForumNpc;
ForumApp.editForumParticipant=editForumParticipant;
ForumApp.editForumRelationship=editForumRelationship;
ForumApp.escapeForumHtml=escapeForumHtml;
ForumApp.executeHotSearch=executeHotSearch;
ForumApp.extractWorldviewKeywords=extractWorldviewKeywords;
ForumApp.fetchNewRandomDMsInternal=fetchNewRandomDMsInternal;
ForumApp.findBestAvatar=findBestAvatar;
ForumApp.focusHotSearch=focusHotSearch;
ForumApp.formatFollowCount=formatFollowCount;
ForumApp.formatForumContent=formatForumContent;
ForumApp.formatForumTime=formatForumTime;
ForumApp.formatJoinDate=formatJoinDate;
ForumApp.forumBindSheet=forumBindSheet;
ForumApp.forumChangeChatBackground=forumChangeChatBackground;
ForumApp.forumCharacter=forumCharacter;
ForumApp.forumChatTime=forumChatTime;
ForumApp.forumChooseEditorImage=forumChooseEditorImage;
ForumApp.forumChoosePicture=forumChoosePicture;
ForumApp.forumDMConfig=forumDMConfig;
ForumApp.forumDMOptions=forumDMOptions;
ForumApp.forumDraftSave=forumDraftSave;
ForumApp.forumExportConversation=forumExportConversation;
ForumApp.forumFilterContacts=forumFilterContacts;
ForumApp.forumGenerateFor=forumGenerateFor;
ForumApp.forumGetConv=forumGetConv;
ForumApp.forumHostContext=forumHostContext;
ForumApp.forumIcon=forumIcon;
ForumApp.forumImageValue=forumImageValue;
ForumApp.forumImportConversation=forumImportConversation;
ForumApp.forumMessageProfile=forumMessageProfile;
ForumApp.forumModel=forumModel;
ForumApp.forumMount=forumMount;
ForumApp.forumNativeCharacters=forumNativeCharacters;
ForumApp.forumNativeDb=forumNativeDb;
ForumApp.forumOpenChatSettings=forumOpenChatSettings;
ForumApp.forumOpenPeople=forumOpenPeople;
ForumApp.forumOriginalDMPrompt=forumOriginalDMPrompt;
ForumApp.forumParseReply=forumParseReply;
ForumApp.forumReadFile=forumReadFile;
ForumApp.forumRenderChat=forumRenderChat;
ForumApp.forumResolveSticker=forumResolveSticker;
ForumApp.forumSafeImage=forumSafeImage;
ForumApp.forumSaveDMs=forumSaveDMs;
ForumApp.forumSendAttachment=forumSendAttachment;
ForumApp.forumShareProfile=forumShareProfile;
ForumApp.forumSheet=forumSheet;
ForumApp.forumShowSummaries=forumShowSummaries;
ForumApp.forumStickerPicker=forumStickerPicker;
ForumApp.forumStickers=forumStickers;
ForumApp.forumStopGeneration=forumStopGeneration;
ForumApp.forumSummarize=forumSummarize;
ForumApp.generateCommentsForNewPost=generateCommentsForNewPost;
ForumApp.generateDMReply=generateDMReply;
ForumApp.generateEnglishHandle=generateEnglishHandle;
ForumApp.generateForumCommentReply=generateForumCommentReply;
ForumApp.generateForumPosts=generateForumPosts;
ForumApp.generateHotTopics=generateHotTopics;
ForumApp.generateInteractionsForNewPost=generateInteractionsForNewPost;
ForumApp.generateMoreComments=generateMoreComments;
ForumApp.generateNewDirectMessages=generateNewDirectMessages;
ForumApp.generateTopicPosts=generateTopicPosts;
ForumApp.generateUserProfilePosts=generateUserProfilePosts;
ForumApp.getActiveApiConfig=getActiveApiConfig;
ForumApp.getAvatarEmoji=getAvatarEmoji;
ForumApp.getCharacterBoundWorldbooks=getCharacterBoundWorldbooks;
ForumApp.getCharacterFullPersona=getCharacterFullPersona;
ForumApp.getDefaultAvatar=getDefaultAvatar;
ForumApp.getDefaultAvatarDataUrl=getDefaultAvatarDataUrl;
ForumApp.getForumPersonName=getForumPersonName;
ForumApp.getForumPersonOptions=getForumPersonOptions;
ForumApp.getForumWorldbookContent=getForumWorldbookContent;
ForumApp.getGlobalWorldbooks=getGlobalWorldbooks;
ForumApp.getTrendingPosts=getTrendingPosts;
ForumApp.handleComposeImageUpload=handleComposeImageUpload;
ForumApp.handleForumRefresh=handleForumRefresh;
ForumApp.handleHotSearchInput=handleHotSearchInput;
ForumApp.handleHotSearchKeydown=handleHotSearchKeydown;
ForumApp.handleMentionClick=handleMentionClick;
ForumApp.initDirectMessages=initDirectMessages;
ForumApp.initForumApp=initForumApp;
ForumApp.insertImagePlaceholder=insertImagePlaceholder;
ForumApp.loadSelectedForumPreset=loadSelectedForumPreset;
ForumApp.mapAndResolveComments=mapAndResolveComments;
ForumApp.openAddForumNpc=openAddForumNpc;
ForumApp.openAddForumParticipant=openAddForumParticipant;
ForumApp.openAddForumRelationship=openAddForumRelationship;
ForumApp.openDirectMessageChat=openDirectMessageChat;
ForumApp.openDirectMessages=openDirectMessages;
ForumApp.openForumCompose=openForumCompose;
ForumApp.openForumPostDetail=openForumPostDetail;
ForumApp.openForumSettings=openForumSettings;
ForumApp.openForumWorldbookSelector=openForumWorldbookSelector;
ForumApp.openOtherUserProfile=openOtherUserProfile;
ForumApp.openProfileEditor=openProfileEditor;
ForumApp.openQuoteRetweet=openQuoteRetweet;
ForumApp.parseFollowCount=parseFollowCount;
ForumApp.previewForumNpcAvatar=previewForumNpcAvatar;
ForumApp.previewForumNpcBanner=previewForumNpcBanner;
ForumApp.previewForumParticipantAvatar=previewForumParticipantAvatar;
ForumApp.previewForumParticipantBanner=previewForumParticipantBanner;
ForumApp.previewProfileAvatar=previewProfileAvatar;
ForumApp.previewProfileBanner=previewProfileBanner;
ForumApp.processPendingRepliesInternal=processPendingRepliesInternal;
ForumApp.refreshPostComments=refreshPostComments;
ForumApp.refreshSearchResults=refreshSearchResults;
ForumApp.removeComposeImage=removeComposeImage;
ForumApp.removeForumNpc=removeForumNpc;
ForumApp.removeForumParticipant=removeForumParticipant;
ForumApp.removeForumRelationship=removeForumRelationship;
ForumApp.removeForumWorldbook=removeForumWorldbook;
ForumApp.renderComposeImages=renderComposeImages;
ForumApp.renderDetailImages=renderDetailImages;
ForumApp.renderDirectMessageChat=renderDirectMessageChat;
ForumApp.renderDirectMessagesList=renderDirectMessagesList;
ForumApp.renderForumComposeAuthor=renderForumComposeAuthor;
ForumApp.renderForumComposeUserInfo=renderForumComposeUserInfo;
ForumApp.renderForumFeed=renderForumFeed;
ForumApp.renderForumHot=renderForumHot;
ForumApp.renderForumPage=renderForumPage;
ForumApp.renderForumPostDetail=renderForumPostDetail;
ForumApp.renderForumPostItem=renderForumPostItem;
ForumApp.renderForumProfile=renderForumProfile;
ForumApp.renderForumSettings=renderForumSettings;
ForumApp.renderForumWorldbookBindings=renderForumWorldbookBindings;
ForumApp.renderOtherUserProfile=renderOtherUserProfile;
ForumApp.renderProfileReplyItem=renderProfileReplyItem;
ForumApp.renderRetweetCard=renderRetweetCard;
ForumApp.replyToForumComment=replyToForumComment;
ForumApp.resolveAuthorIdentity=resolveAuthorIdentity;
ForumApp.retweetToChat=retweetToChat;
ForumApp.retweetToProfile=retweetToProfile;
ForumApp.saveForumSetting=saveForumSetting;
ForumApp.saveGlobalAvatar=saveGlobalAvatar;
ForumApp.saveNewForumPreset=saveNewForumPreset;
ForumApp.saveProfileChanges=saveProfileChanges;
ForumApp.searchForumTopic=searchForumTopic;
ForumApp.selectForumComposeAuthor=selectForumComposeAuthor;
ForumApp.selectForumParticipant=selectForumParticipant;
ForumApp.sendDirectMessage=sendDirectMessage;
ForumApp.sendRetweetToChar=sendRetweetToChar;
ForumApp.showForumAuthorPicker=showForumAuthorPicker;
ForumApp.showForumFullImage=showForumFullImage;
ForumApp.showForumImageDesc=showForumImageDesc;
ForumApp.showNpcEditModal=showNpcEditModal;
ForumApp.showParticipantEditModal=showParticipantEditModal;
ForumApp.showPostMoreMenu=showPostMoreMenu;
ForumApp.showRelationshipEditModal=showRelationshipEditModal;
ForumApp.showRetweetMenu=showRetweetMenu;
ForumApp.showSearchError=showSearchError;
ForumApp.showSearchResults=showSearchResults;
ForumApp.showToast=showToast;
ForumApp.smartRenderCurrentPage=smartRenderCurrentPage;
ForumApp.submitForumComment=submitForumComment;
ForumApp.submitForumPost=submitForumPost;
ForumApp.submitQuoteRetweet=submitQuoteRetweet;
ForumApp.switchForumSection=switchForumSection;
ForumApp.switchForumTab=switchForumTab;
ForumApp.switchToHome=switchToHome;
ForumApp.toggleForumCommentLike=toggleForumCommentLike;
ForumApp.toggleForumPostLike=toggleForumPostLike;
ForumApp.toggleForumPresetPanel=toggleForumPresetPanel;
ForumApp.togglePinPost=togglePinPost;
ForumApp.updateCurrentForumPreset=updateCurrentForumPreset;
ForumApp.updateForumCommentInput=updateForumCommentInput;
ForumApp.updateUserFollowers=updateUserFollowers;

// MONO v2: requested page corrections and local account isolation.
let monoAccounts=[],monoActiveAccount='main',monoIdentityPresets=[],monoContactOpen=false,monoBusy=0;
const monoIdentityKeys=['userAvatar','userIdentity','userNickname','userHandle','userBio','userBanner','userFollowing','userFollowers','userFollowingStr','userFollowersStr','userJoinDate','followedUsers','relationships'];
function monoAvatarFallback(){return monoActiveAccount==='main'?localStorage.getItem('avatarImg'):'';}
function monoOwnPost(p){return (p.accountId || 'main')===monoActiveAccount;}
function monoApplyLikes(){for(const p of forumPosts){for(const item of [p,...(p.comments||[])]){item.monoLikedBy ||= item.liked?['main']:[];item.liked=item.monoLikedBy.includes(monoActiveAccount);}}}
function monoDMKey(){return monoActiveAccount==='main'?'forumDirectMessages':'monoDirectMessages:'+monoActiveAccount;}
function monoSnapshot(){return Object.fromEntries(monoIdentityKeys.map(k=>[k,structuredClone(forumSettings[k] ?? (['followedUsers','relationships'].includes(k)?[]:''))]));}
async function monoLoadAccounts(){
 const state=await localforage.getItem('monoAccounts');monoAccounts=state?.accounts || [{id:'main',identity:monoSnapshot()}];monoActiveAccount=state?.activeId || 'main';
 if(!monoAccounts.some(a=>a.id===monoActiveAccount))monoActiveAccount='main';
 if(forumSettings.monoAccountId && forumSettings.monoAccountId!==monoActiveAccount)Object.assign(forumSettings,monoAccounts.find(a=>a.id===monoActiveAccount)?.identity || {});
 forumSettings.monoAccountId=monoActiveAccount;if(!forumSettings.monoNameInitialized){if(forumSettings.forumName==='广场')forumSettings.forumName='';forumSettings.monoNameInitialized=true;await localforage.setItem('forumSettings',forumSettings);}
 monoApplyLikes();monoIdentityPresets=await localforage.getItem('monoIdentityPresets:'+monoActiveAccount) || [];
}
async function monoStoreAccount(){const a=monoAccounts.find(a=>a.id===monoActiveAccount);if(a)a.identity=monoSnapshot();await localforage.setItem('monoAccounts',{activeId:monoActiveAccount,accounts:monoAccounts});await localforage.setItem('forumSettings',forumSettings);}
async function monoSwitchAccount(id){
 if(id===monoActiveAccount){document.getElementById('forumAuxSheet')?.remove();return;}if(monoBusy || forumDMTasks.size)return showToast('请先完成或暂停当前生成，再切换账号');
 const a=monoAccounts.find(a=>a.id===id);if(!a)return;await monoStoreAccount();await forumSaveQueue;monoActiveAccount=id;Object.assign(forumSettings,a.identity);forumSettings.monoAccountId=id;monoApplyLikes();
 await monoStoreAccount();forumDMLoaded=false;currentDMConversationId=null;forumDrafts.clear();await initDirectMessages();monoIdentityPresets=await localforage.getItem('monoIdentityPresets:'+id)||[];
 document.getElementById('forumAuxSheet')?.remove();closeDirectMessages();renderForumPage();await openDirectMessages();showToast('已切换账号');
}
function monoAccountsMenu(){
 const sheet=forumSheet('切换账号',`<p class="mono-note">账号独立保存身份和私信，仅你可见。</p><div class="mono-account-list">${monoAccounts.map(a=>`<button class="forum-sheet-row" data-account="${escapeForumHtml(a.id)}"><img src="${forumSafeImage(a.id===monoActiveAccount?forumSettings.userAvatar:a.identity.userAvatar)||getDefaultAvatarDataUrl()}" alt=""><span>${escapeForumHtml(a.id===monoActiveAccount?forumSettings.userNickname:a.identity.userNickname || '未命名账号')}<small>@${escapeForumHtml(a.id===monoActiveAccount?forumSettings.userHandle:a.identity.userHandle || '未设置用户名')}</small></span><small>${a.id===monoActiveAccount?'当前账号':''}</small></button>`).join('')}</div><button class="forum-sheet-primary" data-new-account>添加账号</button>`);
 sheet.querySelectorAll('[data-account]').forEach(b=>b.onclick=()=>monoSwitchAccount(b.dataset.account));sheet.querySelector('[data-new-account]').onclick=monoNewAccount;
}
function monoNewAccount(){const sheet=forumSheet('添加账号',`<label class="mono-field">昵称<input id="monoNewName" maxlength="30" placeholder="你的新昵称"></label><label class="mono-field">用户名<input id="monoNewHandle" maxlength="40" placeholder="不带 @"></label><label class="mono-field">身份<textarea id="monoNewIdentity" placeholder="这个账号的身份"></textarea></label><button class="forum-sheet-primary" data-create>创建并切换</button>`);sheet.querySelector('[data-create]').onclick=async()=>{
 if(monoBusy || forumDMTasks.size)return showToast('请先完成或暂停当前生成');const name=sheet.querySelector('#monoNewName').value.trim(),handle=sheet.querySelector('#monoNewHandle').value.trim().replace(/^@/,'');if(!name || !handle)return showToast('请填写昵称和用户名');if(monoAccounts.some(a=>(a.id===monoActiveAccount?forumSettings.userHandle:a.identity.userHandle)===handle))return showToast('用户名已存在');
 const id=crypto.randomUUID(),identity=Object.fromEntries(monoIdentityKeys.map(k=>[k,['followedUsers','relationships'].includes(k)?[]:'']));Object.assign(identity,{userNickname:name,userHandle:handle,userIdentity:sheet.querySelector('#monoNewIdentity').value,userFollowing:0,userFollowers:0,userJoinDate:formatJoinDate(Date.now()),relationships:structuredClone((forumSettings.relationships||[]).filter(r=>r.person1Type!=='user'&&r.person2Type!=='user'))});monoAccounts.push({id,identity});await monoSwitchAccount(id);
 };}
function monoSyncSafeArea(){
 const phone=document.querySelector('.phone-screen'),bar=document.querySelector('.status-bar');let top=24;
 if(phone && bar){const pr=phone.getBoundingClientRect(),r=bar.getBoundingClientRect();if(r.height && r.bottom>pr.top && r.top<pr.top+120)top=Math.max(24,Math.min(90,r.bottom-pr.top+8));}
 document.documentElement.style.setProperty('--mono-safe-top',top+'px');
}
window.addEventListener('resize',monoSyncSafeArea);
const monoOldSettings=renderForumSettings;
renderForumSettings=function(){
 monoOldSettings();const content=document.getElementById('forumSettingsContent');if(!content)return;
 const roleSections=[...content.querySelectorAll('.forum-section')].filter(n=>/^(AI角色|NPC角色|人物关系)/.test(n.querySelector('.forum-section-title')?.textContent.trim() || ''));
 if(monoContactOpen){const dst=document.getElementById('monoContactBody');if(dst){dst.innerHTML='<p class="mono-note">管理 MONO 联系人和论坛关系，404 原角色不受影响。</p>';roleSections.forEach(n=>dst.append(n));dst.insertAdjacentHTML('beforeend','<button class="forum-sheet-row" data-refresh-npc>发现新的 NPC 私信 <span>刷新</span></button>');dst.querySelector('[data-refresh-npc]').onclick=async()=>{if(monoBusy)return;try{await monoRun(async()=>{const config=getActiveApiConfig();if(!config?.url||!config?.key)return showToast('请先配置API');const count=await fetchNewRandomDMsInternal(config);await forumSaveDMs();showToast(count?'收到新的私信':'暂时没有新的私信');});}finally{monoContactSettings();}};}}
 roleSections.forEach(n=>{if(!n.closest('#monoContactBody'))n.remove();});
 const accordion=content.querySelector('#forumPresetAccordion');if(accordion){accordion.className='mono-preset-panel';accordion.innerHTML=`<div class="mono-section-heading"><span>论坛方案</span><button onclick="ForumApp.monoPresetManager()">管理</button></div><select id="forumPresetSelect" class="forum-input forum-select" onchange="ForumApp.loadSelectedForumPreset()"><option value="">选择已保存方案</option>${forumPresets.map((p,i)=>`<option value="${i}">${escapeForumHtml(p.name)}</option>`).join('')}</select><button class="mono-text-button" onclick="ForumApp.monoSaveForumPreset()">保存当前为新方案</button>`;}
 const identitySection=[...content.querySelectorAll('.forum-section')].find(n=>n.querySelector('.forum-section-title')?.textContent.trim()==='我的身份');if(identitySection){identitySection.classList.add('mono-identity-section');identitySection.querySelector('.forum-section-title').insertAdjacentHTML('beforeend','<button class="mono-text-button" onclick="ForumApp.monoIdentityManager()">身份方案</button>');identitySection.insertAdjacentHTML('beforeend','<button class="mono-save-identity" onclick="ForumApp.monoSaveIdentity()">保存身份</button>');}
 const name=content.querySelector('#forumNameInput');if(name)name.placeholder='论坛名称（可留空）';
 content.insertAdjacentHTML('afterbegin','<div class="mono-settings-intro"><small>MONO / SETTINGS</small><p>论坛与身份</p></div><button class="forum-sheet-row mono-refresh-choice" onclick="ForumApp.monoRefreshMenu()"><span>刷新内容</span><span>选择</span></button>');
};
function monoContactSettings(){monoContactOpen=true;document.getElementById('monoContactSettings')?.remove();const page=document.createElement('section');page.id='monoContactSettings';page.className='mono-full-page';page.innerHTML=`<header class="mono-page-header"><button data-back>${forumIcon('back')}</button><strong>联系人设置</strong><span></span></header><main id="monoContactBody"></main>`;page.querySelector('[data-back]').onclick=()=>{page.remove();monoContactOpen=false;renderDirectMessagesList();};forumMount(page);renderForumSettings();}
async function monoSaveIdentity(){await monoStoreAccount();showToast('当前身份已保存');}
function monoForm(title,value,onSave){const sheet=forumSheet(title,`<label class="mono-field">方案名称<input id="monoPresetName" value="${escapeForumHtml(value||'')}" maxlength="50" placeholder="为这个方案命名"></label><button class="forum-sheet-primary" data-save>保存</button>`);sheet.querySelector('[data-save]').onclick=async()=>{const name=sheet.querySelector('input').value.trim();if(!name)return showToast('请填写名称');await onSave(name);sheet.remove();};}
function monoSaveForumPreset(){monoForm('保存论坛方案','',async name=>{const existing=forumPresets.find(p=>p.name===name);if(existing&&!confirm('同名方案已存在，是否覆盖？'))return;const data={name,settings:structuredClone(forumSettings)};if(existing)Object.assign(existing,data);else forumPresets.push(data);await localforage.setItem('forumPresets',forumPresets);renderForumSettings();showToast('论坛方案已保存');});}
function monoPresetManager(){const sheet=forumSheet('论坛方案',`<div class="mono-presets">${forumPresets.map((p,i)=>`<article class="mono-preset-row"><strong>${escapeForumHtml(p.name)}</strong><small>${escapeForumHtml(p.settings.forumName || '未命名论坛')}</small><div><button data-load="${i}">使用</button><button data-update="${i}">覆盖</button><button data-delete="${i}">删除</button></div></article>`).join('')||'<p class="mono-note">还没有保存的方案。</p>'}</div><button class="forum-sheet-primary" data-new>保存当前方案</button>`);
 sheet.querySelector('[data-new]').onclick=monoSaveForumPreset;for(const action of ['load','update','delete'])sheet.querySelectorAll('[data-'+action+']').forEach(b=>b.onclick=async()=>{const i=Number(b.dataset[action]),p=forumPresets[i];if(!p)return;if(action==='load'){if(!confirm('使用这个论坛方案？当前身份与私信保持独立。'))return;const identity=monoSnapshot();forumSettings={...forumSettings,...structuredClone(p.settings),...identity,monoAccountId:monoActiveAccount};await localforage.setItem('forumSettings',forumSettings);sheet.remove();renderForumSettings();renderForumFeed();}else {if(!confirm(action==='delete'?'删除这个方案？':'用当前设置覆盖这个方案？'))return;if(action==='delete')forumPresets.splice(i,1);else p.settings=structuredClone(forumSettings);await localforage.setItem('forumPresets',forumPresets);renderForumSettings();monoPresetManager();}});
}
function monoIdentityManager(){const sheet=forumSheet('我的身份方案',`<p class="mono-note">仅保存当前账号的昵称、身份和个人资料。</p>${monoIdentityPresets.map((p,i)=>`<article class="mono-preset-row"><strong>${escapeForumHtml(p.name)}</strong><small>${escapeForumHtml(p.identity.userNickname || '')}</small><div><button data-use="${i}">使用</button><button data-overwrite="${i}">覆盖</button><button data-remove="${i}">删除</button></div></article>`).join('')}<button class="forum-sheet-primary" data-new>保存当前身份</button>`);const store=()=>localforage.setItem('monoIdentityPresets:'+monoActiveAccount,monoIdentityPresets);
 sheet.querySelector('[data-new]').onclick=()=>monoForm('保存身份方案','',async name=>{const p=monoIdentityPresets.find(p=>p.name===name);if(p&&!confirm('同名方案已存在，是否覆盖？'))return;if(p)p.identity=monoSnapshot();else monoIdentityPresets.push({name,identity:monoSnapshot()});await store();showToast('身份方案已保存');});
 for(const action of ['use','overwrite','remove'])sheet.querySelectorAll('[data-'+action+']').forEach(b=>b.onclick=async()=>{const i=Number(b.dataset[action]),p=monoIdentityPresets[i];if(action==='use'){Object.assign(forumSettings,structuredClone(p.identity));await monoStoreAccount();sheet.remove();renderForumSettings();renderForumProfile();}else{if(!confirm(action==='remove'?'删除这个身份方案？':'覆盖这个身份方案？'))return;if(action==='remove')monoIdentityPresets.splice(i,1);else p.identity=monoSnapshot();await store();monoIdentityManager();}});
}
function monoRefreshMenu(){const sheet=forumSheet('刷新内容','<button class="forum-sheet-row" data-refresh="home">刷新首页推荐与关注</button><button class="forum-sheet-row" data-refresh="hot">刷新趋势内容</button>');sheet.querySelectorAll('[data-refresh]').forEach(b=>b.onclick=async()=>{if(monoBusy)return;sheet.remove();await monoRun(async()=>{await generateForumPosts();if(b.dataset.refresh==='hot')switchForumSection('hot');else renderForumFeed();});});}
async function monoRun(fn){monoBusy++;try{return await fn();}finally{monoBusy--;}}
function monoProfileMenu(){const sheet=forumSheet('主页设置','<button class="forum-sheet-row" data-action="edit">编辑个人资料</button><button class="forum-sheet-row" data-action="identity">我的身份方案</button><button class="forum-sheet-row" data-action="accounts">切换账号</button><button class="forum-sheet-row" data-action="share">分享主页给联系人</button>');forumBindSheet(sheet,async a=>{sheet.remove();if(a==='edit')openProfileEditor();if(a==='identity')monoIdentityManager();if(a==='accounts')monoAccountsMenu();if(a==='share')forumShareProfile();});}
renderForumWorldbookBindings=function(){const books=getGlobalWorldbooks(),ids=forumSettings.worldbookIds || [];return ids.map(id=>{const wb=books.find(w=>String(w.id)===String(id));return `<div class="mono-bound-book"><span>${escapeForumHtml(wb?.name || '未找到的世界书')}</span><button data-wb="${escapeForumHtml(String(id))}" onclick="ForumApp.removeForumWorldbook(this.dataset.wb)">移除</button></div>`;}).join('')||'<p class="mono-note">尚未绑定。角色自己的世界书会自动读取。</p>';};
openForumWorldbookSelector=function(){const available=getGlobalWorldbooks().filter(w=>w.isCharBook!==true && !(forumSettings.worldbookIds||[]).some(id=>String(id)===String(w.id)));const sheet=forumSheet('绑定世界书',`<div class="mono-wb-list">${available.map(w=>`<button class="forum-sheet-row" data-wb="${escapeForumHtml(String(w.id))}"><span>${escapeForumHtml(w.name)}</span><span>＋</span></button>`).join('')||'<p class="mono-note">没有可添加的世界书。</p>'}</div>`);sheet.querySelectorAll('[data-wb]').forEach(b=>b.onclick=async()=>{await addForumWorldbook(b.dataset.wb);sheet.remove();});};
addForumWorldbook=async function(id){const wb=getGlobalWorldbooks().find(w=>String(w.id)===String(id));if(!wb)return showToast('未找到世界书');forumSettings.worldbookIds ||= [];if(!forumSettings.worldbookIds.some(x=>String(x)===String(id)))forumSettings.worldbookIds.push(wb.id);await localforage.setItem('forumSettings',forumSettings);const list=document.getElementById('forumWorldbookList');if(list)list.innerHTML=renderForumWorldbookBindings();showToast('已绑定 '+wb.name);};
removeForumWorldbook=async function(id){forumSettings.worldbookIds=(forumSettings.worldbookIds||[]).filter(x=>String(x)!==String(id));await localforage.setItem('forumSettings',forumSettings);const list=document.getElementById('forumWorldbookList');if(list)list.innerHTML=renderForumWorldbookBindings();};
getCharacterBoundWorldbooks=function(){return [...new Set(forumSettings.aiParticipants.flatMap(p=>forumCharacter(p.charId)?.worldBookIds || []))];};
getForumWorldbookContent=function(contextText=''){const ids=[...(forumSettings.worldbookIds||[]),...getCharacterBoundWorldbooks()],books=getGlobalWorldbooks(),parts=[];for(const id of new Set(ids.map(String))){const wb=books.find(w=>String(w.id)===id);if(!wb||wb.enabled===false)continue;if(typeof wb.content==='string'&&wb.content)parts.push('【'+wb.name+'】\n'+wb.content);else for(const e of wb.entries||[]){if(e.enabled===false)continue;if(wb.triggerType==='keyword'&&!String(e.keywords||'').split(/[,，]/).some(k=>k.trim()&&contextText.toLowerCase().includes(k.trim().toLowerCase())))continue;if(e.content)parts.push('【'+(e.title||wb.name)+'】\n'+e.content);}}return parts.length?'\n[世界书/背景设定参考]:\n'+parts.join('\n\n')+'\n':'';};
const monoOldContacts=renderDirectMessagesList;
renderDirectMessagesList=function(){const all=forumDirectMessages;forumDirectMessages=all.filter(c=>!(forumSettings.monoHiddenContacts||[]).includes(c.id));monoOldContacts();forumDirectMessages=all;const page=document.querySelector('.forum-dm-page');if(!page)return;const title=page.querySelector('.forum-dm-title');title.outerHTML=`<button class="forum-dm-title mono-account-switch" onclick="ForumApp.monoAccountsMenu()">${escapeForumHtml(forumSettings.userHandle || forumSettings.userNickname || '我的账号')}<span>⌄</span></button>`;const button=page.querySelector('.forum-dm-generate');button.innerHTML=forumIcon('more');button.setAttribute('aria-label','联系人设置');button.setAttribute('onclick','ForumApp.monoContactSettings()');
 const list=page.querySelector('.forum-dm-list');const descriptors=[...forumSettings.aiParticipants.map(p=>{const c=forumCharacter(p.charId);return {id:'ai_'+p.charId,name:p.nickname || c?.name || c?.realName || '角色',avatar:p.avatar || c?.avatar || '',forumPersona:getCharacterFullPersona(p)};}),...forumSettings.npcs.map(p=>({id:'npc_'+p.id,name:p.name,avatar:p.avatar||'',forumPersona:p.persona || p.identity||''}))];for(const person of descriptors)if(!forumDirectMessages.some(c=>c.id===person.id)|| (forumSettings.monoHiddenContacts||[]).includes(person.id)){const row=document.createElement('button');row.className='forum-dm-item mono-new-contact';row.innerHTML=`<div class="forum-dm-avatar"><img src="${forumSafeImage(person.avatar)||getDefaultAvatarDataUrl()}" alt=""></div><div class="forum-dm-content"><strong class="forum-dm-name">${escapeForumHtml(person.name)}</strong><small class="forum-dm-preview">开始聊天</small></div>`;row.onclick=async()=>{const c=forumDirectMessages.find(c=>c.id===person.id) || {...person,messages:[],unread:0,lastMessage:'',lastMessageTime:0};if(!forumDirectMessages.includes(c))forumDirectMessages.push(c);forumSettings.monoHiddenContacts=(forumSettings.monoHiddenContacts||[]).filter(id=>id!==person.id);await localforage.setItem('forumSettings',forumSettings);await forumSaveDMs();currentDMConversationId=c.id;forumRenderChat(c);};list.append(row);}if(descriptors.length)list.querySelector('.forum-dm-empty')?.remove();};
forumShareProfile=async function(){await initDirectMessages();const recipients=[...forumDirectMessages];for(const p of forumSettings.aiParticipants){if(!recipients.some(c=>c.id==='ai_'+p.charId)){const c=forumCharacter(p.charId);recipients.push({id:'ai_'+p.charId,name:p.nickname||c?.name||c?.realName||'角色',avatar:p.avatar||c?.avatar||'',messages:[]});}}for(const n of forumSettings.npcs)if(!recipients.some(c=>c.id==='npc_'+n.id))recipients.push({id:'npc_'+n.id,name:n.name,avatar:n.avatar||'',messages:[],forumPersona:n.persona||n.identity||''});const sheet=forumSheet('分享主页',`<p class="mono-note">选择联系人，发送当前账号的主页。</p>${recipients.map((c,i)=>`<button class="forum-sheet-row mono-share-recipient" data-recipient="${i}"><img src="${forumSafeImage(c.avatar)||getDefaultAvatarDataUrl()}" alt=""><span>${escapeForumHtml(c.name)}</span><span>发送</span></button>`).join('')||'<p class="mono-note">先在联系人设置中添加角色。</p>'}`);
 sheet.querySelectorAll('[data-recipient]').forEach(b=>b.onclick=async()=>{b.disabled=true;let c=forumGetConv(recipients[Number(b.dataset.recipient)].id);if(!c){c=structuredClone(recipients[Number(b.dataset.recipient)]);forumDirectMessages.push(c);}const profile={type:'user',id:monoActiveAccount,name:forumSettings.userNickname||'用户',handle:forumSettings.userHandle||'',bio:forumSettings.userBio||'',avatar:forumSettings.userAvatar||monoAvatarFallback()||''};c.messages ||= [];c.messages.push({id:Date.now(),sender:'user',timestamp:Date.now(),profile,content:`[分享主页] ${profile.name} @${profile.handle}\n${profile.bio}`});c.lastMessage='[分享主页] '+profile.name;c.lastMessageTime=Date.now();await forumSaveDMs();sheet.remove();currentDMConversationId=c.id;forumRenderChat(c);showToast('主页已发送');});};
const monoOldChat=forumRenderChat;
forumRenderChat=function(c){monoOldChat(c);const bubbles=[...document.querySelectorAll('.forum-dm-chat .forum-dm-msg-bubble')];let idx=0;for(const m of c.messages||[]){if(m.sticker||m.image)continue;const b=bubbles[idx++];if(m.profile&&b){b.classList.add('mono-profile-card');b.innerHTML=`<img src="${forumSafeImage(m.profile.avatar)||getDefaultAvatarDataUrl()}" alt=""><strong>${escapeForumHtml(m.profile.name)}</strong><small>@${escapeForumHtml(m.profile.handle)}</small><p>${escapeForumHtml(m.profile.bio)}</p><span>分享的主页</span>`;}}};
const monoOldCompose=openForumCompose;
openForumCompose=function(){monoOldCompose();const overlay=document.getElementById('forumComposeOverlay');if(!overlay)return;const toolbar=overlay.querySelector('.forum-compose-toolbar');if(toolbar&&!toolbar.querySelector('[data-link]'))toolbar.insertAdjacentHTML('beforeend','<button class="mono-compose-link" data-link onclick="ForumApp.monoComposeLink()">图片链接</button>');};
function monoComposeLink(){if(forumComposeImages.length>=4)return showToast('最多添加4张图片');const sheet=forumSheet('添加图片链接','<label class="mono-field">图片地址<input type="url" id="monoPostImageUrl" placeholder="https://…"></label><button class="forum-sheet-primary" data-add>添加图片</button>');sheet.querySelector('[data-add]').onclick=()=>{try{const data=forumImageValue(sheet.querySelector('input').value);forumComposeImages.push({data});renderComposeImages();sheet.remove();}catch(e){showToast(e.message);}};}
let monoTrendTab='trending';
renderForumHot=function(){currentHotView='main';const feed=document.getElementById('forumFeed'),tabs=document.querySelector('.forum-tabs');if(!feed)return;if(tabs){tabs.style.display='flex';tabs.dataset.view='hot';tabs.querySelectorAll('.forum-home-tab,.forum-back-btn').forEach(e=>e.style.display='none');tabs.querySelector('.forum-hot-title').style.display='block';const more=tabs.querySelector('.forum-settings-btn');more.style.display='flex';more.setAttribute('onclick','ForumApp.monoHotMenu()');}
 const partitions=monoTrendPartition(),posts=getTrendingPosts();const list=monoTrendTab==='for-you'?partitions.recommended:partitions.trending;
 feed.innerHTML=`<div class="mono-trends"><div class="forum-hot-search"><div class="forum-hot-search-box">${forumIcon('search')}<input id="forumHotSearchInput" placeholder="搜索 MONO" onkeydown="ForumApp.handleHotSearchKeydown(event)"></div></div><nav class="mono-trend-tabs">${[['for-you','为你推荐'],['trending','当前趋势'],['posts','热门帖子']].map(([id,label])=>`<button class="${monoTrendTab===id?'active':''}" data-trend="${id}">${label}</button>`).join('')}</nav>${monoTrendTab==='posts'?posts.map(renderForumPostItem).join('')||'<p class="mono-note">暂无热门帖子</p>':list.map((t,i)=>`<button class="mono-trend-item" data-topic="${escapeForumHtml(t.tag)}"><small>${i+1} · ${escapeForumHtml(t.category || '当前趋势')}</small><strong>${escapeForumHtml(t.tag.startsWith('#')?t.tag:'#'+t.tag)}</strong>${t.count?`<span>${escapeForumHtml(String(t.count))} 条帖子</span>`:''}</button>`).join('')||'<p class="mono-note">设置世界观后，在右上角刷新趋势。</p>'}</div>`;
 feed.querySelectorAll('[data-trend]').forEach(b=>b.onclick=()=>{monoTrendTab=b.dataset.trend;renderForumHot();});feed.querySelectorAll('[data-topic]').forEach(b=>b.onclick=()=>monoRun(()=>searchForumTopic(b.dataset.topic)));
};
function monoHotMenu(){const sheet=forumSheet('趋势设置','<button class="forum-sheet-row" data-refresh>刷新趋势</button><button class="forum-sheet-row" data-world>世界观与论坛设置</button>');sheet.querySelector('[data-refresh]').onclick=async()=>{sheet.remove();await monoRun(async()=>{await generateForumPosts();renderForumHot();});};sheet.querySelector('[data-world]').onclick=()=>{sheet.remove();openForumSettings();};}
const monoOldFeed=renderForumFeed;renderForumFeed=function(){monoOldFeed();const tabs=document.querySelector('.forum-tabs');if(tabs){tabs.dataset.view='home';const settings=tabs.querySelector('.forum-settings-btn');settings?.setAttribute('onclick','ForumApp.openForumSettings()');}};
const monoOldProfile=renderForumProfile;renderForumProfile=function(tab){monoOldProfile(tab);};
for(const name of ['generateNewDirectMessages','submitForumPost','submitForumComment','generateForumPosts']){const fn={generateNewDirectMessages,submitForumPost,submitForumComment,generateForumPosts}[name];const wrapped=async(...args)=>monoRun(()=>fn(...args));if(name==='generateNewDirectMessages')generateNewDirectMessages=wrapped;if(name==='submitForumPost')submitForumPost=wrapped;if(name==='submitForumComment')submitForumComment=wrapped;if(name==='generateForumPosts')generateForumPosts=wrapped;}
loadSelectedForumPreset=async function(){const select=document.getElementById('forumPresetSelect'),i=select?.value;if(i===''||i==null||!forumPresets[i])return;if(!confirm('使用这个论坛方案？当前身份保持独立。'))return;const identity=monoSnapshot();forumSettings={...forumSettings,...structuredClone(forumPresets[i].settings),...identity,monoAccountId:monoActiveAccount};await localforage.setItem('forumSettings',forumSettings);renderForumSettings();};
for(const kind of ['ai','npc']){const fn=kind==='ai'?removeForumParticipant:removeForumNpc;const wrapped=async i=>{const p=kind==='ai'?forumSettings.aiParticipants[i]:forumSettings.npcs[i];if(!p)return;const id=(kind==='ai'?'ai_':'npc_')+(kind==='ai'?p.charId:p.id);await fn(i);if(!(kind==='ai'?forumSettings.aiParticipants:forumSettings.npcs).includes(p)){forumSettings.monoHiddenContacts ||= [];if(!forumSettings.monoHiddenContacts.includes(id))forumSettings.monoHiddenContacts.push(id);await localforage.setItem('forumSettings',forumSettings);renderForumSettings();}};if(kind==='ai')removeForumParticipant=wrapped;else removeForumNpc=wrapped;}
Object.assign(ForumApp,{monoAccountsMenu,monoSwitchAccount,monoNewAccount,monoContactSettings,monoIdentityManager,monoSaveIdentity,monoSaveForumPreset,monoPresetManager,monoRefreshMenu,monoProfileMenu,monoHotMenu,monoComposeLink,loadSelectedForumPreset,removeForumParticipant,removeForumNpc,renderForumSettings,renderForumWorldbookBindings,openForumWorldbookSelector,addForumWorldbook,removeForumWorldbook,getForumWorldbookContent,getCharacterBoundWorldbooks,renderDirectMessagesList,forumShareProfile,forumRenderChat,openForumCompose,renderForumHot,renderForumFeed,renderForumProfile,generateNewDirectMessages,submitForumPost,submitForumComment,generateForumPosts});

// Preserve original entry names for existing forum installations when unoccupied.
for(const name of Object.keys(ForumApp)) {
 if(typeof ForumApp[name]==='function' && !(name in window) && !['showToast','getActiveApiConfig','compressAvatar','saveGlobalAvatar','closePage','sendDirectMessage','openProfileEditor','saveProfileChanges','getDefaultAvatar'].includes(name))window[name]=ForumApp[name];
}
ForumApp.ready=null;

// MONO v3: scoped presentation, identity protocol and responsive rendering.
let monoFeedLimit=30,monoPostsFlight=null;
function monoLoadMore(){monoFeedLimit+=30;renderForumFeed();}
const monoV3Books=getGlobalWorldbooks;
getGlobalWorldbooks=function(){return monoV3Books().filter(w=>w.type!=='folder'&&w.isCategory!==true&&w.isFolder!==true);};
resolveAuthorIdentity=function(rawName,record={}){
 const normalize=v=>String(v||'').trim().replace(/^@/,'').toLowerCase(),name=normalize(rawName),handle=normalize(record.handle||record.authorHandle),type=record.authorType;
 const rows=[...(forumSettings.aiParticipants||[]).map(p=>{const c=characters.find(c=>String(c.id)===String(p.charId));return {type:'ai',id:p.charId,name:p.nickname||c?.name||'',handle:p.handle,avatar:p.avatar||c?.avatar||''};}),...(forumSettings.npcs||[]).map(n=>({type:'npc',id:n.id,name:n.name,handle:n.handle,avatar:n.avatar||''}))];
 const eligible=type==='ai'||type==='npc'?rows.filter(r=>r.type===type):rows;
 const exact=record.authorId!=null?eligible.find(r=>String(r.id)===String(record.authorId)):null;
 const byHandle=handle?eligible.filter(r=>normalize(r.handle)===handle):[];
 const byName=eligible.filter(r=>normalize(r.name)===name);
 const match=exact||(byHandle.length===1?byHandle[0]:null)||(byName.length===1?byName[0]:null);
 if(match)return match;
 return {type:'npc',id:null,name:String(rawName||'路人'),avatar:''};
};
const monoV3Generate=generateForumPosts;
generateForumPosts=function(...args){if(monoPostsFlight){showToast('正在生成，请稍候');return monoPostsFlight;}monoPostsFlight=(async()=>{try{return await monoV3Generate(...args);}finally{monoPostsFlight=null;}})();return monoPostsFlight;};
const monoV3Contacts=renderDirectMessagesList;
renderDirectMessagesList=function(){monoV3Contacts();const b=document.querySelector('.mono-account-switch');if(b){b.setAttribute('aria-label','切换我的账号');const span=b.querySelector('span');if(span)span.innerHTML='<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m4 6 4 4 4-4"/></svg>';}};
const monoV3Compose=openForumCompose;
openForumCompose=function(){monoV3Compose();const o=document.getElementById('forumComposeOverlay');o.classList.add('mono-ins-compose');const h=o.querySelector('.forum-compose-header'),body=o.querySelector('.forum-compose-body'),images=document.getElementById('forumComposeImages');h.querySelector('.forum-compose-title').textContent='新帖子';h.querySelector('.forum-compose-cancel').innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m15 4-8 8 8 8"/></svg>';const submit=h.querySelector('.forum-compose-submit')||o.querySelector('.mono-share-footer .forum-compose-submit');let footer=o.querySelector('.mono-share-footer');if(!footer){footer=document.createElement('div');footer.className='mono-share-footer';o.append(footer);}submit.textContent='分享';footer.append(submit);body.prepend(images);const textarea=document.getElementById('forumComposeTextarea');textarea.placeholder='添加配文…';textarea.blur();const tools=body.querySelector('.forum-compose-toolbar');tools.querySelector('.forum-compose-tool-btn').innerHTML=forumIcon('image')+'<span>本地图片</span>';let empty=body.querySelector('.mono-compose-empty');if(!empty){empty=document.createElement('button');empty.className='mono-compose-empty';empty.setAttribute('onclick',"document.getElementById('forumComposeImageInput').click()");empty.innerHTML='<span>＋</span><small>添加图片</small>';images.after(empty);}renderComposeImages();};
const monoV3RenderImages=renderComposeImages;
renderComposeImages=function(){monoV3RenderImages();const empty=document.querySelector('.mono-compose-empty');if(empty)empty.hidden=forumComposeImages.length>0;};
function monoCompactPersonEditor(id){const m=document.getElementById(id);if(!m)return;m.classList.add('mono-person-editor');m.querySelector('.forum-participant-banner-edit')?.remove();const head=m.querySelector('.forum-modal-header'),save=m.querySelector('.forum-identity-submit');if(save){save.textContent='保存';head.append(save);}const identity=m.querySelector('.forum-identity-char');if(identity)identity.insertAdjacentHTML('beforeend','<small class="mono-avatar-tip">点击头像更换</small>');}
const monoV3Person=showParticipantEditModal;showParticipantEditModal=function(...args){monoV3Person(...args);monoCompactPersonEditor('forumSetIdentityModal');};
const monoV3Npc=showNpcEditModal;showNpcEditModal=function(...args){monoV3Npc(...args);monoCompactPersonEditor('forumNpcModal');};
Object.assign(ForumApp,{forumApiEndpoint,forumStructuredValue,forumParseArray,monoLoadMore,getGlobalWorldbooks,resolveAuthorIdentity,generateForumPosts,renderDirectMessagesList,openForumCompose,renderComposeImages,showParticipantEditModal,showNpcEditModal});

function forumLegacyPendingPrompt(conversation){const worldview=forumSettings.worldview||'现代都市',userIdentity=forumSettings.userIdentity||'普通用户',worldbookContent=getForumWorldbookContent(worldview+'\n'+userIdentity),recentMessages=conversation.messages.slice(-6).map(m=>`${m.sender==='user'?'用户':conversation.name}：${m.content}`).join('\n');const prompt = `你正在进行角色扮演。请扮演 "${conversation.name}" 回复用户的私信。

【世界观】
${worldview}
${worldbookContent ? '\n【设定参考】\n' + worldbookContent : ''}

【用户身份】${userIdentity}

【对话历史】
${recentMessages}

要求：
1. 坚守 "${conversation.name}" 的人设（虽然是路人/NPC，也要符合名字暗示的身份）。
2. 回复自然、简短、符合世界观逻辑。
3. 只输出回复内容。`;return prompt;}
// MONO v4: presentation/navigation additions; original forum prompt strings preserved.
const monoThreadExpanded=new Set();let monoOtherTab='posts',monoOtherInfo=null,monoOtherSeed=[];
function monoCount(n){n=Number(n)||0;return n>=1000000?(n/1000000).toFixed(n%1000000?1:0)+'M':n>=10000?(n/1000).toFixed(n%1000?1:0)+'K':String(n||'');}
function monoPostName(p){return p.authorType==='user'&&monoOwnPost(p)?forumSettings.userNickname||p.authorName:p.authorName||'访客';}
function monoRecordAvatar(p){const identity=resolveAuthorIdentity(p.authorName,p);if(p.authorType==='npc'||p.authorType==='random'||(!p.authorType&&identity.type!=='ai')){const n=(forumSettings.npcs||[]).find(n=>p.authorId!=null?String(n.id)===String(p.authorId):n.name===p.authorName);return forumSafeImage(n?.avatar)||getDefaultAvatarDataUrl();}return findBestAvatar(monoPostName(p),p.authorAvatar,p)||getDefaultAvatarDataUrl();}
function monoAvatarError(img){img.onerror=null;img.src=getDefaultAvatarDataUrl();}
function monoAvatar(p,cls='mono-x-avatar'){return `<img class="${cls}" src="${escapeForumHtml(monoRecordAvatar(p))}" alt="" onerror="ForumApp.monoAvatarError(this)">`;}
function monoXIcon(name){const paths={comment:'<path d="M21 11a8.5 8.5 0 0 1-8.5 8.5H8L3 22l1.5-5A8.5 8.5 0 1 1 21 11Z"/>',retweet:'<path d="m4 4 3 3-3 3M7 7v10a2 2 0 0 0 2 2h5M20 20l-3-3 3-3M17 17V7a2 2 0 0 0-2-2h-5"/>',heart:'<path d="M20 5a5 5 0 0 0-7 0l-1 1-1-1a5 5 0 0 0-7 7l8 9 8-9a5 5 0 0 0 0-7Z"/>',views:'<path d="M4 20v-6M9 20V4M14 20v-9M19 20V7"/>',bookmark:'<path d="M6 3h12v18l-6-4-6 4Z"/>',share:'<circle cx="18" cy="4" r="3"/><circle cx="5" cy="12" r="3"/><circle cx="18" cy="20" r="3"/><path d="m8 10 7-4M8 14l7 4"/>'};return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name]||''}</svg>`;}
function monoXImages(p){return (p.images||[]).length?`<div class="mono-x-images ${p.images.length>1?'multi':''}">${p.images.slice(0,4).map(src=>`<button data-image="${escapeForumHtml(forumSafeImage(src))}" onclick="event.stopPropagation();ForumApp.showForumFullImage(this.dataset.image)"><img loading="lazy" src="${escapeForumHtml(forumSafeImage(src))}" alt=""></button>`).join('')}</div>`:'';}
function monoXQuote(p){if(!p)return '';return `<div class="mono-x-quote" ${p.id!=null?`onclick="event.stopPropagation();ForumApp.openForumPostDetail(${Number(p.id)})"`:''}><div class="mono-x-quote-head">${monoAvatar(p)}<b>${escapeForumHtml(p.authorName||'访客')}</b><small>@${escapeForumHtml(String(p.handle||generateEnglishHandle(p.authorName)).replace(/^@/,''))} · ${escapeForumHtml(formatForumTime(p.timestamp))}</small></div><div>${formatForumContent(p.content||'')}</div>${monoXImages(p)}</div>`;}
function monoXActions(p,commentId=null){const id=Number(p.id),c=commentId!=null?p.comments?.find(c=>Number(c.id)===Number(commentId)):null,r=c||p;const reply=c?`ForumApp.monoReplyComment(${id},${Number(c.id)})`:`ForumApp.openForumPostDetail(${id})`;const quote=c?`ForumApp.monoQuoteComment(${id},${Number(c.id)})`:`ForumApp.openQuoteRetweet(${id})`;const like=c?`ForumApp.toggleForumCommentLike(${id},${Number(c.id)});ForumApp.renderForumPostDetail()`:`ForumApp.toggleForumPostLike(${id});ForumApp.monoRefreshPostViews()`;return `<div class="mono-x-actions"><button aria-label="评论" onclick="event.stopPropagation();${reply}">${monoXIcon('comment')}<span>${monoCount(c?(p.comments||[]).filter(x=>Number(x.replyTo)===Number(c.id)).length:(p.comments||[]).length)}</span></button><button aria-label="转发" onclick="event.stopPropagation();${quote}">${monoXIcon('retweet')}<span>${monoCount(r.retweets)}</span></button><button aria-label="喜欢" class="${r.liked?'liked':''}" onclick="event.stopPropagation();${like}">${monoXIcon('heart')}<span>${monoCount(r.likes)}</span></button><span aria-label="浏览">${monoXIcon('views')}<span>${monoCount(r.views)}</span></span><button aria-label="收藏" class="${(p.monoBookmarkedBy||[]).includes(monoActiveAccount)?'saved':''}" onclick="event.stopPropagation();ForumApp.monoBookmark(${id})">${monoXIcon('bookmark')}</button><button aria-label="分享" onclick="event.stopPropagation();ForumApp.monoSharePost(${id})">${monoXIcon('share')}</button></div>`;}
renderForumPostItem=function(p){return `<article class="forum-post mono-x-post" data-post-id="${Number(p.id)}" onclick="ForumApp.openForumPostDetail(${Number(p.id)})"><button class="mono-x-avatar-button" onclick="event.stopPropagation();ForumApp.monoOpenAuthor(${Number(p.id)})">${monoAvatar(p)}</button><div class="mono-x-post-body"><div class="mono-x-header"><b onclick="event.stopPropagation();ForumApp.monoOpenAuthor(${Number(p.id)})">${escapeForumHtml(monoPostName(p))}</b><small>@${escapeForumHtml(String(p.handle||generateEnglishHandle(p.authorName)).replace(/^@/,''))} · ${escapeForumHtml(formatForumTime(p.timestamp))}</small><button aria-label="更多" onclick="event.stopPropagation();ForumApp.monoPostMenu(${Number(p.id)},this)">${forumIcon('more')}</button></div>${p.content?`<div class="mono-x-text">${formatForumContent(p.content)}</div>`:''}${monoXImages(p)}${p.isRetweet?monoXQuote(p.originalPost):''}${monoXActions(p)}</div></article>`;};
function monoRefreshPostViews(){if(document.getElementById('forumDetailOverlay')?.classList.contains('active'))renderForumPostDetail();else if(monoOtherInfo&&document.querySelector('#forumFeed .forum-other-profile'))renderOtherUserProfile(monoOtherInfo,monoOtherSeed);else if(window.currentForumSection==='profile')renderForumProfile(currentProfileTab);else if(window.currentForumSection==='hot')renderForumHot();else renderForumFeed();}
async function monoBookmark(id){const p=forumPosts.find(p=>Number(p.id)===id);if(!p)return;p.monoBookmarkedBy ||= [];p.monoBookmarkedBy=p.monoBookmarkedBy.includes(monoActiveAccount)?p.monoBookmarkedBy.filter(x=>x!==monoActiveAccount):[...p.monoBookmarkedBy,monoActiveAccount];await localforage.setItem('forumPosts',forumPosts);monoRefreshPostViews();}
function monoOpenAuthor(id,commentId){const p=forumPosts.find(p=>Number(p.id)===Number(id)),r=commentId!=null?p?.comments?.find(c=>Number(c.id)===Number(commentId)):p;if(!r)return;document.getElementById('forumDetailOverlay')?.classList.remove('active');monoOtherTab='posts';return openOtherUserProfile(r.authorType,r.authorName,r.authorId||'');}
function monoReplyComment(id,cid){const p=forumPosts.find(p=>Number(p.id)===id),c=p?.comments?.find(c=>Number(c.id)===cid);if(c){replyToForumComment(id,cid,c.authorName);updateForumCommentInput();monoExpandReply(true);document.getElementById('forumCommentInput')?.focus();}}
function monoPostMenu(id,button){const p=forumPosts.find(p=>Number(p.id)===id);if(!p)return;if(p.authorType==='user'&&monoOwnPost(p))return showPostMoreMenu(id,button||document.querySelector(`[data-post-id="${id}"] .mono-x-header button`));const sh=forumSheet('帖子选项','<button class="forum-sheet-row" data-quote>引用转发</button><button class="forum-sheet-row" data-share>分享给联系人</button><button class="forum-sheet-row" data-comments>生成新评论</button>');sh.querySelector('[data-quote]').onclick=()=>{sh.remove();openQuoteRetweet(id);};sh.querySelector('[data-share]').onclick=()=>{sh.remove();monoSharePost(id);};sh.querySelector('[data-comments]').onclick=()=>{sh.remove();refreshPostComments(id);};}
function monoCommentRow(p,c,connected=false){return `<div class="forum-comment mono-x-comment ${connected?'connected':''}" data-comment-id="${Number(c.id)}"><button class="mono-x-avatar-button" onclick="ForumApp.monoOpenAuthor(${Number(p.id)},${Number(c.id)})">${monoAvatar(c)}</button><div class="mono-x-post-body"><div class="mono-x-header"><b onclick="ForumApp.monoOpenAuthor(${Number(p.id)},${Number(c.id)})">${escapeForumHtml(monoPostName(c))}</b><small>@${escapeForumHtml(String(c.handle||generateEnglishHandle(c.authorName)).replace(/^@/,''))} · ${escapeForumHtml(formatForumTime(c.timestamp))}</small></div><div class="mono-x-text">${formatForumContent(c.content||'')}</div>${monoXImages(c)}${monoXActions(p,c.id)}</div></div>`;}
function monoCommentThreads(p){const all=p.comments||[],byId=new Map(all.map(c=>[String(c.id),c])),children=new Map(),roots=[];for(const c of all){const parent=c.replyTo!=null?byId.get(String(c.replyTo)):null;if(parent&&parent!==c){if(!children.has(String(parent.id)))children.set(String(parent.id),[]);children.get(String(parent.id)).push(c);}else roots.push(c);}const visited=new Set();function row(c){if(visited.has(String(c.id)))return '';visited.add(String(c.id));const replies=children.get(String(c.id))||[],key=p.id+':'+c.id,expanded=monoThreadExpanded.has(key);let html=monoCommentRow(p,c,replies.length>0);if(replies.length){const shown=expanded?replies:replies.slice(0,1);html+=shown.map(row).join('');if(replies.length>1)html+=`<button class="mono-show-replies" onclick="ForumApp.monoToggleReplies(${Number(p.id)},${Number(c.id)})">${expanded?'收起回复':'显示 '+(replies.length-1)+' 条回复'}</button>`;}return html;}let html=roots.map(c=>`<section class="mono-x-thread">${row(c)}</section>`).join('');for(const c of all)if(!visited.has(String(c.id))&&!byId.has(String(c.replyTo)))html+=monoCommentRow(p,c);return html||'<p class="mono-x-empty">还没有回复</p>';}
function monoToggleReplies(id,cid){const key=id+':'+cid;if(monoThreadExpanded.has(key))monoThreadExpanded.delete(key);else monoThreadExpanded.add(key);renderForumPostDetail();}
renderForumPostDetail=function(){const p=forumPosts.find(p=>Number(p.id)===Number(currentForumPostId)),el=document.getElementById('forumDetailContent');if(!p||!el)return;document.getElementById('forumDetailOverlay').classList.add('mono-x-detail');el.innerHTML=`<div class="mono-x-detail-post"><div class="mono-x-detail-author"><button class="mono-x-avatar-button" onclick="ForumApp.monoOpenAuthor(${Number(p.id)})">${monoAvatar(p)}</button><div><b>${escapeForumHtml(monoPostName(p))}</b><small>@${escapeForumHtml(String(p.handle||generateEnglishHandle(p.authorName)).replace(/^@/,''))}</small></div><button class="mono-x-follow" onclick="ForumApp.monoFollowPostAuthor(${Number(p.id)})">${(forumSettings.followedUsers||[]).includes(String(p.authorId||p.authorName))?'已关注':'关注'}</button><button class="mono-x-more" onclick="ForumApp.monoPostMenu(${Number(p.id)},this)">${forumIcon('more')}</button></div><div class="mono-x-detail-text">${formatForumContent(p.content||'')}</div>${monoXImages(p)}${p.isRetweet?monoXQuote(p.originalPost):''}<div class="mono-x-time">${escapeForumHtml(new Date(p.timestamp||Date.now()).toLocaleString('zh-CN',{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}))} · <b>${monoCount(p.views)||'0'}</b> 查看次数</div>${monoXActions(p)}</div><nav class="mono-x-reply-nav"><button onclick="ForumApp.monoCommentMenu(${Number(p.id)})">回复 ${forumIcon('more')}</button><button onclick="ForumApp.monoViewQuotes(${Number(p.id)})">查看引用 <span>›</span></button></nav><div class="forum-comments-section">${monoCommentThreads(p)}</div>`;const bar=document.querySelector('.forum-comment-bar');bar?.classList.add('mono-x-comment-bar');if(bar&&!bar.querySelector('.mono-reply-avatar'))bar.insertAdjacentHTML('afterbegin',`<img class="mono-reply-avatar" src="${escapeForumHtml(forumSafeImage(forumSettings.userAvatar)||getDefaultAvatarDataUrl())}" alt="">`);updateForumCommentInput();const input=document.getElementById('forumCommentInput');if(input&&!forumReplyTarget)input.placeholder='发布你的回复';};
function monoCommentMenu(id){const sh=forumSheet('回复选项','<button class="forum-sheet-row" data-refresh>生成新评论</button>');sh.querySelector('button[data-refresh]').onclick=()=>{sh.remove();refreshPostComments(id);};}
async function monoFollowPostAuthor(id){const p=forumPosts.find(p=>Number(p.id)===id);if(!p)return;const key=String(p.authorId||p.authorName);forumSettings.followedUsers ||= [];forumSettings.followedUsers=forumSettings.followedUsers.includes(key)?forumSettings.followedUsers.filter(x=>x!==key):[...forumSettings.followedUsers,key];forumSettings.userFollowing=forumSettings.followedUsers.length;await localforage.setItem('forumSettings',forumSettings);renderForumPostDetail();}
function monoViewQuotes(id,tab='quotes'){const p=forumPosts.find(p=>Number(p.id)===Number(id));if(!p)return;document.getElementById('monoQuoteList')?.remove();const list=forumPosts.filter(q=>q.isRetweet&&Number(q.originalPostId??q.originalPost?.id)===Number(id)&&!q.originalCommentId);const quoted=list.filter(q=>String(q.content||'').trim()),plain=list.filter(q=>!String(q.content||'').trim()),shown=tab==='quotes'?quoted:plain;const el=document.createElement('section');el.id='monoQuoteList';el.className='mono-x-quote-list';el.innerHTML=`<header><button aria-label="返回" onclick="document.getElementById('monoQuoteList').remove()">${forumIcon('back')}</button><b>帖子互动量</b><span></span></header><nav><button class="${tab==='quotes'?'active':''}" onclick="ForumApp.monoViewQuotes(${Number(id)},'quotes')">引用 ${quoted.length}</button><button class="${tab==='retweets'?'active':''}" onclick="ForumApp.monoViewQuotes(${Number(id)},'retweets')">转帖 ${plain.length}</button></nav><main>${shown.map(renderForumPostItem).join('')||'<p class="mono-x-empty">暂无'+(tab==='quotes'?'引用':'转帖')+'</p>'}</main>`;document.getElementById('forumPage').append(el);}
const monoV4OpenDetail=openForumPostDetail;openForumPostDetail=function(id){document.getElementById('monoQuoteList')?.remove();monoV4OpenDetail(id);};
const monoV4Quote=openQuoteRetweet;
openQuoteRetweet=function(id){document.getElementById('forumQuoteRetweetModal')?.remove();monoV4Quote(id);const m=document.getElementById('forumQuoteRetweetModal');if(!m)return;m.classList.add('mono-x-quote-editor');m.style.cssText='position:absolute;inset:0;z-index:10035;display:flex;background:#fff;';m.querySelector('.forum-compose-title').textContent='引用转发';m.querySelector('.forum-compose-body').classList.add('mono-x-quote-compose-body');const p=forumPosts.find(p=>Number(p.id)===Number(id));m.querySelector('.forum-quote-preview').outerHTML=monoXQuote(p);m.querySelector('.mono-x-quote').removeAttribute('onclick');};
function monoQuoteComment(id,cid){openQuoteRetweet(id);const p=forumPosts.find(p=>Number(p.id)===id),c=p?.comments?.find(c=>Number(c.id)===cid),m=document.getElementById('forumQuoteRetweetModal');if(!m||!c)return;m.dataset.commentId=cid;m.querySelector('.mono-x-quote').outerHTML=monoXQuote(c);m.querySelector('.mono-x-quote').removeAttribute('onclick');m.querySelector('.forum-compose-submit').setAttribute('onclick',`ForumApp.monoSubmitCommentQuote(${id},${cid})`);}
async function monoSubmitCommentQuote(id,cid){const p=forumPosts.find(p=>Number(p.id)===id),c=p?.comments?.find(c=>Number(c.id)===cid);if(!c)return;const q={id:Date.now(),authorType:'user',accountId:monoActiveAccount,authorName:forumSettings.userNickname||'我',handle:forumSettings.userHandle,authorAvatar:forumSettings.userAvatar,content:document.getElementById('forumQuoteTextarea')?.value.trim()||'',timestamp:Date.now(),likes:0,views:0,retweets:0,comments:[],isRetweet:true,originalPostId:id,originalCommentId:cid,originalPost:{...structuredClone(c),id:p.id,commentId:cid}};forumPosts.unshift(q);c.retweets=(c.retweets||0)+1;await localforage.setItem('forumPosts',forumPosts);closeQuoteRetweet();closeForumPostDetail();renderForumFeed();}
async function monoSharePost(id){const p=forumPosts.find(p=>Number(p.id)===id);if(!p)return;await initDirectMessages();const targets=[...forumDirectMessages];for(const a of forumSettings.aiParticipants||[]){if(targets.some(c=>c.id==='ai_'+a.charId))continue;const c=forumCharacter(a.charId);targets.push({id:'ai_'+a.charId,name:a.nickname||c?.remarkName||c?.realName||'角色',messages:[]});}for(const n of forumSettings.npcs||[])if(!targets.some(c=>c.id==='npc_'+n.id))targets.push({id:'npc_'+n.id,name:n.name,messages:[],forumPersona:n.persona||n.identity||''});const sh=forumSheet('分享给联系人',targets.map((c,i)=>`<button class="forum-sheet-row" data-target="${i}">${escapeForumHtml(c.name)}<span>发送</span></button>`).join('')||'<p class="mono-note">暂无联系人</p>');sh.querySelectorAll('[data-target]').forEach(b=>b.onclick=async()=>{b.disabled=true;let c=forumGetConv(targets[b.dataset.target].id);if(!c){c=structuredClone(targets[b.dataset.target]);forumDirectMessages.push(c);}c.messages ||= [];c.messages.push({id:Date.now(),sender:'user',timestamp:Date.now(),content:'[分享帖子] '+p.authorName+'\n'+p.content,forumPost:structuredClone(p)});c.lastMessage='[分享帖子] '+p.authorName;c.lastMessageTime=Date.now();await forumSaveDMs();sh.remove();showToast('已分享');});}
const monoV4Other=renderOtherUserProfile;
function monoMatchesAuthor(p,u){if(p.authorType==='user')return false;if(p.authorId!=null&&u.id!=null)return String(p.authorId)===String(u.id)&&(u.type==='random'||p.authorType===u.type);return p.authorName===u.name;}
renderOtherUserProfile=function(u,seed=[],loading=false){if(!monoOtherInfo||String(monoOtherInfo.id||monoOtherInfo.name)!==String(u.id||u.name))monoOtherTab='posts';monoOtherInfo=u;monoOtherSeed=seed;const view={...u};if(u.type!=='ai'){const n=(forumSettings.npcs||[]).find(n=>u.id!=null?String(n.id)===String(u.id):n.name===u.name);view.avatar=forumSafeImage(n?.avatar)||getDefaultAvatarDataUrl();}monoV4Other(view,seed,loading);const feed=document.getElementById('forumFeed'),tabs=feed.querySelector('.forum-profile-tabs'),content=feed.querySelector('.forum-profile-posts');if(!tabs||!content)return;tabs.innerHTML=[['posts','帖子'],['likes','喜欢'],['retweets','转发']].map(([key,label])=>`<button class="forum-profile-tab ${monoOtherTab===key?'active':''}" data-other-tab="${key}">${label}</button>`).join('');tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>{monoOtherTab=b.dataset.otherTab;renderOtherUserProfile(monoOtherInfo,monoOtherSeed);});const own=[...new Map([...seed,...forumPosts.filter(p=>monoMatchesAuthor(p,u))].map(p=>[String(p.id),p])).values()],likes=forumPosts.filter(p=>(u.likedPostIds||[]).map(String).includes(String(p.id))||(u.likedPosts||[]).some(x=>String(typeof x==='object'?x.id:x)===String(p.id))||[...(p.likedBy||[]),...(p.likedByAuthors||[])].some(x=>typeof x==='object'?String(x.id||x.authorId)===String(u.id)||x.name===u.name:String(x)===String(u.id)||x===u.name)),retweets=own.filter(p=>p.isRetweet);const items=monoOtherTab==='likes'?likes:monoOtherTab==='retweets'?retweets:own.filter(p=>!p.isRetweet);content.innerHTML=items.map(renderForumPostItem).join('')||`<p class="mono-x-empty">${loading&&monoOtherTab==='posts'?'正在加载帖子…':'暂无'+({posts:'帖子',likes:'喜欢记录',retweets:'转发'}[monoOtherTab])}</p>`;feed.querySelector('.forum-profile-avatar img')?.setAttribute('onerror','ForumApp.monoAvatarError(this)');const generate=feed.querySelector('.forum-generate-more-posts');if(generate)generate.hidden=monoOtherTab!=='posts';};
let monoTrendCache=null,monoTrendCacheKey='';
function monoTrendPartition(){const cacheKey=JSON.stringify([forumSettings.worldview,forumSettings.forumName,forumSettings.userIdentity,(forumSettings.aiParticipants||[]).map(p=>[p.charId,p.nickname]),forumPosts.length,forumPosts[0]?.id]);if(monoTrendCache&&monoTrendCacheKey===cacheKey)return monoTrendCache;const topics=generateHotTopics(),keywords=extractWorldviewKeywords(),seen=new Set(),pool=[];for(const t of [...topics,...keywords.map(tag=>({tag,category:'为你推荐',count:''}))]){const key=String(t.tag).replace(/^#/,'').trim().toLowerCase();if(!key||seen.has(key))continue;seen.add(key);pool.push(t);}const split=Math.ceil(pool.length/2);monoTrendCacheKey=cacheKey;return monoTrendCache={trending:pool.slice(0,split),recommended:pool.slice(split).map(t=>({...t,category:'为你推荐'}))};}
function monoNormalizeNpcAvatars(){for(const c of forumDirectMessages){if(c.id.startsWith('ai_'))continue;const n=(forumSettings.npcs||[]).find(n=>c.id==='npc_'+n.id);c.avatar=forumSafeImage(n?.avatar)||getDefaultAvatarDataUrl();}}
const monoV4Contacts=renderDirectMessagesList;renderDirectMessagesList=function(){monoNormalizeNpcAvatars();monoV4Contacts();document.querySelectorAll('.forum-dm-page [class*="avatar"] img').forEach(img=>img.setAttribute('onerror','ForumApp.monoAvatarError(this)'));};
const monoV4Chat=forumRenderChat;forumRenderChat=function(c){monoNormalizeNpcAvatars();monoV4Chat(c);document.querySelectorAll('.forum-dm-chat [class*="avatar"] img').forEach(img=>img.setAttribute('onerror','ForumApp.monoAvatarError(this)'));};
Object.assign(ForumApp,{monoAvatarError,monoOpenAuthor,monoRefreshPostViews,monoBookmark,monoPostMenu,monoReplyComment,monoToggleReplies,monoCommentMenu,monoFollowPostAuthor,monoViewQuotes,monoQuoteComment,monoSubmitCommentQuote,monoSharePost,openForumPostDetail,renderForumPostItem,renderForumPostDetail,openQuoteRetweet,renderOtherUserProfile,renderForumHot,renderDirectMessagesList,forumRenderChat});

// MONO v5: UI and separately requested feature controllers. Legacy prompt expressions unchanged.
let monoGenerationCount=0;
function monoGenerationStart(label='正在生成'){monoGenerationCount++;let badge=document.getElementById('monoGenerationBadge');if(!badge){badge=document.createElement('div');badge.id='monoGenerationBadge';badge.setAttribute('role','status');badge.setAttribute('aria-live','polite');forumMount(badge);}badge.innerHTML='<i></i><span>'+escapeForumHtml(label)+'…</span>';badge.hidden=false;let ended=false;return ()=>{if(ended)return;ended=true;monoGenerationCount=Math.max(0,monoGenerationCount-1);if(!monoGenerationCount)badge.hidden=true;};}
const monoV5ChatSettings=forumOpenChatSettings;
forumOpenChatSettings=function(){monoV5ChatSettings();const conv=forumGetConv(),sheet=document.getElementById('forumAuxSheet');if(!conv||!sheet)return;const row=document.createElement('label');row.className='forum-setting-row';row.innerHTML='<span>读取 404 聊天记录和记忆<small class="mono-context-note">只读背景，MONO 对话不会写回 404</small></span><input type="checkbox" id="monoRead404" '+(forumDMOptions(conv).read404Context?'checked':'')+'>';sheet.querySelector('#forumStickerMatch')?.closest('label')?.before(row);row.querySelector('input').onchange=async e=>{forumDMOptions(conv).read404Context=e.target.checked;await forumSaveDMs();};};
const monoV5Chat=forumRenderChat;
forumRenderChat=function(c){monoV5Chat(c);const page=document.querySelector('.forum-dm-chat'),user=page?.querySelector('.forum-dm-chat-user');if(user){user.setAttribute('role','button');user.tabIndex=0;const open=()=>{forumDraftSave(page.querySelector('#dmInput')?.value||'');closeDirectMessages();const ai=c.id.startsWith('ai_'),id=c.id.replace(/^(ai_|npc_)/,'');openOtherUserProfile(ai?'ai':'npc',c.name,id);};user.onclick=open;user.onkeydown=e=>{if(e.key==='Enter')open();};}const status=page?.querySelector('.forum-dm-status');if(status&&forumDMTasks.has(c.id))status.innerHTML='<span class="mono-typing"><i></i><i></i><i></i></span><span>正在输入</span>';};
let monoReplyExpanded=false,monoReplyAttachments=[];
function monoPositionReplyTarget(){const bar=document.querySelector('.mono-v5-reply'),target=document.getElementById('forumReplyIndicator');if(bar&&target)target.style.bottom=(bar.offsetHeight+(parseFloat(getComputedStyle(bar).bottom)||12)+8)+'px';}
window.addEventListener('resize',monoPositionReplyTarget);
function monoExpandReply(expanded=true){monoReplyExpanded=expanded;const bar=document.querySelector('.mono-v5-reply');bar?.classList.toggle('expanded',expanded);if(expanded)document.getElementById('forumCommentInput')?.focus();monoPositionReplyTarget();}
function monoReplyImage(){forumChoosePicture(src=>{monoReplyAttachments.push({image:src});monoRenderReplyMedia();monoExpandReply(true);monoPositionReplyTarget();});}
function monoRenderReplyMedia(){const send=document.querySelector('.mono-v5-reply .forum-comment-send');if(send)send.disabled=!document.getElementById('forumCommentInput')?.value.trim()&&!monoReplyAttachments.length;const el=document.querySelector('.mono-reply-media');if(el)el.innerHTML=monoReplyAttachments.map((a,i)=>`<button onclick="ForumApp.monoRemoveReplyMedia(${i})"><img src="${escapeForumHtml(forumSafeImage(a.image||a.sticker?.data))}" alt="附件"><span>×</span></button>`).join('');}
function monoRemoveReplyMedia(i){monoReplyAttachments.splice(i,1);monoRenderReplyMedia();}
function monoReplySticker(group=null){const pool=forumStickers(),groups=[...new Set(pool.map(s=>s.group||'未分类'))];const sh=forumSheet('回复表情包',`<div class="forum-sticker-categories">${groups.map((g,i)=>`<button data-group="${i}">${escapeForumHtml(g)}</button>`).join('')}</div><div class="forum-sticker-grid">${pool.map((s,i)=>({s,i})).filter(({s})=>!group||(s.group||'未分类')===group).map(({s,i})=>`<button data-pick="${i}"><img src="${escapeForumHtml(forumSafeImage(s.data))}" alt="${escapeForumHtml(s.name)}"><small>${escapeForumHtml(s.name)}</small></button>`).join('')||'<p>暂无表情包，请先在404添加</p>'}</div>`);sh.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>monoReplySticker(groups[Number(b.dataset.group)]));sh.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{monoReplyAttachments.push({sticker:pool[Number(b.dataset.pick)]});sh.remove();monoRenderReplyMedia();monoExpandReply(true);monoPositionReplyTarget();});}
const monoV5UpdateReply=updateForumCommentInput;
updateForumCommentInput=function(){monoV5UpdateReply();const indicator=document.getElementById('forumReplyIndicator'),bar=document.querySelector('.mono-v5-reply'),input=document.getElementById('forumCommentInput');if(input)input.placeholder='发布你的回复';if(indicator&&bar){bar.before(indicator);indicator.classList.add('mono-v5-reply-target');indicator.style.display=forumReplyTarget?'flex':'none';monoPositionReplyTarget();}};
const monoV5SubmitComment=submitForumComment;
submitForumComment=async function(){const p=forumPosts.find(p=>Number(p.id)===Number(currentForumPostId)),input=document.getElementById('forumCommentInput');if(!p||!input)return;const attachments=monoReplyAttachments.splice(0);if(!input.value.trim()&&!attachments.length)return;if(!input.value.trim())input.value=attachments.some(a=>a.sticker)?'[表情包]':'[图片]';const before=new Set((p.comments||[]).map(c=>c.id));await monoV5SubmitComment();const added=p.comments?.find(c=>!before.has(c.id)&&c.authorType==='user');if(added&&attachments.length){added.images=attachments.map(a=>a.image||a.sticker?.data).filter(Boolean);if(attachments.some(a=>a.sticker))added.content=added.content.replace(/^\[表情包\]$/,attachments.filter(a=>a.sticker).map(a=>'[表情包：'+a.sticker.name+']').join(' '));await localforage.setItem('forumPosts',forumPosts);}monoReplyExpanded=false;renderForumPostDetail();};
const monoV5Detail=renderForumPostDetail;
function monoIsFollowed(p){const list=forumSettings.followedUsers||[];return [p.authorId,p.authorName,p.handle].filter(Boolean).some(k=>list.map(String).includes(String(k)));}
renderForumPostDetail=function(){const old=document.getElementById('forumCommentInput')?.value||'';monoV5Detail();const p=forumPosts.find(p=>Number(p.id)===Number(currentForumPostId));if(!p)return;document.querySelector('.mono-x-detail-post [aria-label="浏览"]')?.remove();const bookmark=document.querySelector('.mono-x-detail-post [aria-label="收藏"]');if(bookmark&&p.bookmarks)bookmark.insertAdjacentHTML('beforeend','<span>'+monoCount(p.bookmarks)+'</span>');const follow=document.querySelector('#forumDetailContent .mono-x-follow');if(p.authorType==='user')follow?.remove();else if(follow)follow.textContent=monoIsFollowed(p)?'已关注':'关注';const nav=document.querySelector('.mono-x-reply-nav');if(nav){nav.firstElementChild.innerHTML='相关 <span>⌄</span>';nav.firstElementChild.onclick=()=>monoCommentMenu(Number(p.id));}const bar=document.querySelector('.forum-comment-bar');if(!bar)return;bar.className='forum-comment-bar mono-v5-reply'+(monoReplyExpanded?' expanded':'');bar.innerHTML=`<div class="mono-reply-main"><img class="mono-reply-avatar" src="${escapeForumHtml(forumSafeImage(forumSettings.userAvatar)||getDefaultAvatarDataUrl())}" alt=""><textarea class="forum-comment-input" id="forumCommentInput" rows="1" placeholder="发布你的回复"></textarea><button class="mono-reply-expand" aria-label="展开或收起输入框" onclick="ForumApp.monoExpandReply(!this.closest('.mono-v5-reply').classList.contains('expanded'))"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3h7v7M21 3l-8 8M10 21H3v-7M3 21l8-8"/></svg></button></div><div class="mono-reply-media"></div><div class="mono-reply-tools"><button aria-label="添加图片" onclick="ForumApp.monoReplyImage()">${forumIcon('image')}</button><button aria-label="表情包" onclick="ForumApp.monoReplySticker()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="4"/><text x="5" y="15" font-size="7" stroke="none" fill="currentColor">GIF</text></svg></button><button class="forum-comment-send" onclick="ForumApp.submitForumComment()">回复</button></div>`;const input=bar.querySelector('textarea');input.value=old;input.onfocus=()=>monoExpandReply(true);input.oninput=()=>{bar.querySelector('.forum-comment-send').disabled=!input.value.trim()&&!monoReplyAttachments.length;};input.oninput();monoRenderReplyMedia();updateForumCommentInput();};
const monoV5CloseDetail=closeForumPostDetail;closeForumPostDetail=function(){monoReplyExpanded=false;monoReplyAttachments=[];monoV5CloseDetail();const input=document.getElementById('forumCommentInput');if(input)input.value='';};
// Clicking generate without a button was throwing before the request. Single-flight per post.
const monoCommentFlights=new Map();refreshPostComments=function(id,button){id=Number(id||currentForumPostId);if(!id)return Promise.resolve();if(monoCommentFlights.has(id))return monoCommentFlights.get(id);const finish=monoGenerationStart('正在生成回复');button?.classList.add('loading');const job=(async()=>{try{await generateMoreComments(id);if(Number(currentForumPostId)===id)renderForumPostDetail();else monoRefreshPostViews();}finally{finish();button?.classList.remove('loading');monoCommentFlights.delete(id);}})();monoCommentFlights.set(id,job);return job;};
monoPostMenu=function(id,button){const p=forumPosts.find(p=>Number(p.id)===Number(id));if(!p)return;const sh=forumSheet('帖子选项',`<button class="forum-sheet-row" data-comments>生成回复</button><button class="forum-sheet-row" data-quote>引用转发</button><button class="forum-sheet-row" data-share>分享给联系人</button>${p.authorType==='user'&&monoOwnPost(p)?'<button class="forum-sheet-row" data-delete>删除帖子</button>':''}`);sh.querySelector('[data-comments]').onclick=()=>{sh.remove();refreshPostComments(id,button);};sh.querySelector('[data-quote]').onclick=()=>{sh.remove();openQuoteRetweet(id);};sh.querySelector('[data-share]').onclick=()=>{sh.remove();monoSharePost(id);};const del=sh.querySelector('[data-delete]');if(del)del.onclick=async()=>{if(!confirm('删除这条帖子？'))return;forumPosts=forumPosts.filter(p=>Number(p.id)!==Number(id));await localforage.setItem('forumPosts',forumPosts);sh.remove();closeForumPostDetail();monoRefreshPostViews();};};
const monoV5Quotes=monoViewQuotes;
monoViewQuotes=function(id,tab='quotes'){monoV5Quotes(id,tab);const el=document.getElementById('monoQuoteList');if(!el)return;const refresh=document.createElement('button');refresh.setAttribute('aria-label','刷新互动');refresh.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 7v5h-5M4 17v-5h5M19 12a7 7 0 0 0-12-5M5 12a7 7 0 0 0 12 5"/></svg>';el.querySelector('header span').replaceWith(refresh);refresh.onclick=()=>monoRefreshQuotes(id,tab);};
async function monoFeatureRequest(prompt){const config=getActiveApiConfig();if(!config?.url||!config?.key)throw Error('请先配置API');const res=await fetch(forumApiEndpoint(config),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.key},body:JSON.stringify({model:config.model,messages:[{role:'user',content:prompt}],temperature:0.8,max_tokens:2048})});const data=await res.json();return forumParseArray(data.choices?.[0]?.message?.content||'',['posts','data','results']);}
const monoFeatureFlights=new Set();
async function monoRefreshQuotes(id,tab='quotes'){const key='quotes:'+id;if(monoFeatureFlights.has(key))return;const p=forumPosts.find(p=>Number(p.id)===Number(id));if(!p)return;monoFeatureFlights.add(key);const done=monoGenerationStart('正在刷新互动');try{const rows=await monoFeatureRequest('新增功能：生成此 MONO 帖子的引用或转帖互动。世界观：'+(forumSettings.worldview||'')+'\n原帖作者：'+p.authorName+'\n原帖：'+p.content+'\n返回3至5条JSON数组，每项包含authorName（普通NPC名字）、content（引用评语，纯转帖留空）、likes、views。不要冒充原帖作者或当前用户：'+forumSettings.userNickname);for(const [i,r] of rows.entries()){if(!r.authorName||r.authorName===forumSettings.userNickname)continue;forumPosts.unshift({id:Date.now()+i,authorType:'npc',authorName:r.authorName,content:String(r.content||''),timestamp:Date.now(),isRetweet:true,originalPostId:p.id,originalPost:structuredClone(p),comments:[],likes:Number(r.likes)||0,views:Number(r.views)||0,retweets:0});}await localforage.setItem('forumPosts',forumPosts);if(document.getElementById('monoQuoteList'))monoViewQuotes(id,tab);}catch(e){showToast(e.message);}finally{done();monoFeatureFlights.delete(key);}}
const monoV5Other=renderOtherUserProfile;
renderOtherUserProfile=function(u,seed=[],loading=false){u={...u,handle:u.handle||generateEnglishHandle(u.name)};monoV5Other(u,seed,loading);const feed=document.getElementById('forumFeed'),menu=feed?.querySelector('.forum-ins-profile-title button:last-child');if(menu){menu.setAttribute('aria-label','主页设置');menu.onclick=monoOtherMenu;}const follow=feed?.querySelector('.forum-ins-actions .primary');if(follow){follow.textContent=monoIsFollowed({authorId:u.id,authorName:u.name,handle:u.handle})?'已关注':'关注';follow.onclick=async()=>{const k=String(u.id||u.name),list=forumSettings.followedUsers||[];const isFollowed=monoIsFollowed({authorId:u.id,authorName:u.name,handle:u.handle});forumSettings.followedUsers=isFollowed?list.filter(v=>![u.id,u.name,u.handle].map(String).includes(String(v))):[...list,k];forumSettings.userFollowing=forumSettings.followedUsers.length;await localforage.setItem('forumSettings',forumSettings);renderOtherUserProfile(u,seed);};}const gen=feed?.querySelector('.forum-generate-more-posts');if(gen){gen.hidden=false;gen.innerHTML=`<button class="forum-generate-btn" data-generate-profile>生成${{posts:'帖子',likes:'喜欢',retweets:'转发'}[monoOtherTab]}</button>`;gen.querySelector('button').onclick=()=>monoGenerateProfileSection(monoOtherTab);} };
function monoOtherMenu(){if(!monoOtherInfo)return;const sh=forumSheet('主页设置','<button class="forum-sheet-row" data-action="edit">更改当前人的主页</button><button class="forum-sheet-row" data-action="posts">刷新帖子</button><button class="forum-sheet-row" data-action="likes">刷新喜欢</button><button class="forum-sheet-row" data-action="retweets">刷新转发</button><button class="forum-sheet-row" data-action="all">刷新全部三部分</button>');forumBindSheet(sh,async a=>{sh.remove();if(a==='edit')return monoEditOther();if(a==='all'){for(const t of ['posts','likes','retweets'])await monoGenerateProfileSection(t);return;}await monoGenerateProfileSection(a);});}
function monoEditOther(){const u=monoOtherInfo;if(!u)return;const sh=forumSheet('编辑主页',`<label class="mono-field">头像<button data-avatar>${monoAvatar({authorType:u.type,authorName:u.name,authorId:u.id,authorAvatar:u.avatar})}<span>点击更换</span></button></label><label class="mono-field">昵称<input data-name value="${escapeForumHtml(u.name)}"></label><label class="mono-field">用户名<input data-handle value="${escapeForumHtml(u.handle||'')}"></label><label class="mono-field">个人简介<textarea data-bio>${escapeForumHtml(u.bio||'')}</textarea></label><button class="forum-sheet-primary" data-save>保存</button>`);let avatar=u.avatar;sh.querySelector('[data-avatar]').onclick=()=>forumChoosePicture(v=>{avatar=v;sh.querySelector('[data-avatar] img').src=v;});sh.querySelector('[data-save]').onclick=async()=>{const old=u.name,values={name:sh.querySelector('[data-name]').value.trim()||u.name,handle:sh.querySelector('[data-handle]').value.trim().replace(/^@/,''),bio:sh.querySelector('[data-bio]').value,avatar};if(u.type==='ai'){const a=forumSettings.aiParticipants.find(a=>String(a.charId)===String(u.id));if(a)Object.assign(a,{nickname:values.name,handle:values.handle,bio:values.bio,avatar});}else{let n=forumSettings.npcs.find(n=>String(n.id)===String(u.id)||n.name===old);if(!n){n={id:u.id||crypto.randomUUID(),name:old};forumSettings.npcs.push(n);}Object.assign(n,values);u.id=n.id;}for(const p of forumPosts){if(monoMatchesAuthor(p,u)){p.authorName=values.name;p.handle=values.handle;p.authorAvatar=avatar;}}Object.assign(u,values);await localforage.setItem('forumSettings',forumSettings);await localforage.setItem('forumPosts',forumPosts);sh.remove();renderOtherUserProfile(u,[]);};}
async function monoGenerateProfileSection(tab='posts'){const u=monoOtherInfo;if(!u)return;const key='profile:'+String(u.id||u.name);if(monoFeatureFlights.has(key))return;monoFeatureFlights.add(key);const end=monoGenerationStart('正在生成'+({posts:'帖子',likes:'喜欢',retweets:'转发'}[tab]||'主页'));try{if(tab==='posts'){monoOtherTab='posts';await generateUserProfilePosts(u);return;}const candidates=forumPosts.filter(p=>!monoMatchesAuthor(p,u)&&!p.isRetweet).slice(0,50);if(!candidates.length){showToast('首页还没有可互动的帖子，请先生成首页帖子');return;}const rows=await monoFeatureRequest('新增功能：为 MONO 用户选择符合其人设的'+(tab==='likes'?'喜欢':'转发')+'帖子。角色：'+u.name+'\n人设：'+(u.fullPersona||u.identity||u.bio||'普通用户')+'\n世界观：'+(forumSettings.worldview||'')+'\n可选帖子：'+JSON.stringify(candidates.map(p=>({id:p.id,author:p.authorName,content:p.content})))+'\n返回JSON数组，每项postId必须来自列表，转发可含content评语，喜欢只需postId。选择0至6条，勿编造不存在的帖子。');for(const [i,r] of rows.entries()){const source=candidates.find(p=>String(p.id)===String(r.postId));if(!source)continue;if(tab==='likes'){source.likedByAuthors ||= [];if(!source.likedByAuthors.some(a=>String(a.id)===String(u.id)))source.likedByAuthors.push({id:u.id,name:u.name});u.likedPostIds ||= [];if(!u.likedPostIds.includes(source.id))u.likedPostIds.push(source.id);}else{forumPosts.unshift({id:Date.now()+i,authorType:u.type==='ai'?'ai':'npc',authorId:u.id,authorName:u.name,authorAvatar:u.avatar,handle:u.handle,content:String(r.content||''),timestamp:Date.now(),isRetweet:true,originalPostId:source.id,originalPost:structuredClone(source),comments:[],likes:0,views:0,retweets:0});}}await localforage.setItem('forumPosts',forumPosts);monoOtherTab=tab;renderOtherUserProfile(u,[]);}catch(e){showToast(e.message);}finally{end();monoFeatureFlights.delete(key);}}
// Change presentation labels only; never rewrite settings, posts, or prompt source.
function monoBrandLabels(root){const selectors='header,header *,button,button *,label,label *,.forum-label,.mono-field,.forum-empty-title,.forum-empty-text,h1,h2,h3,.forum-detail-title,.forum-settings-title,.mono-note,.forum-setting-row,.forum-settings-person';root.querySelectorAll(selectors).forEach(el=>{if(el.closest('.mono-x-post-body,.mono-x-detail-text,.forum-dm-messages'))return;for(const n of el.childNodes)if(n.nodeType===Node.TEXT_NODE&&/論壇|论坛/.test(n.textContent))n.textContent=n.textContent.replace(/論壇|论坛/g,'MONO');});root.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(el=>el.placeholder=el.placeholder.replace(/論壇|论坛/g,'MONO'));}
const monoV5Boot=forumBoot;
// Applied at mount/DOM changes; child text-only changes settle after one mutation batch.
let monoBrandObserver;
function monoInstallBranding(){const root=document.getElementById('forumPage');if(!root||monoBrandObserver)return;monoBrandLabels(root);const host=root.parentElement;monoBrandObserver=new MutationObserver(()=>{monoBrandLabels(root);host.querySelectorAll('.forum-aux-overlay,.forum-dm-chat,.forum-dm-page,.forum-modal-overlay').forEach(monoBrandLabels);});monoBrandObserver.observe(host,{childList:true,subtree:true});}
Object.assign(ForumApp,{forumOpenChatSettings,forumRenderChat,monoExpandReply,monoReplyImage,monoReplySticker,monoRemoveReplyMedia,updateForumCommentInput,submitForumComment,renderForumPostDetail,closeForumPostDetail,refreshPostComments,monoPostMenu,monoViewQuotes,monoRefreshQuotes,renderOtherUserProfile,monoOtherMenu,monoEditOther,monoGenerateProfileSection});

// MONO v6 requested additions; legacy forum prompt templates remain byte-identical.
function monoProfileCatalog(){const out=[{key:'user:'+monoActiveAccount,type:'user',id:monoActiveAccount,name:forumSettings.userNickname||'我',handle:forumSettings.userHandle||'',avatar:forumSettings.userAvatar||'',bio:forumSettings.userBio||''}];for(const p of forumSettings.aiParticipants||[]){const c=forumCharacter(p.charId);out.push({key:'ai:'+p.charId,type:'ai',id:p.charId,name:p.nickname||c?.remarkName||c?.realName||'角色',handle:p.handle||generateEnglishHandle(p.nickname||c?.realName),avatar:p.avatar||c?.avatar||'',bio:p.bio||''});}for(const p of forumSettings.npcs||[])out.push({key:'npc:'+p.id,type:'npc',id:p.id,name:p.name,handle:p.handle||generateEnglishHandle(p.name),avatar:p.avatar||'',bio:p.bio||''});for(const p of forumPosts){if(p.authorType==='user'||out.some(q=>q.type===p.authorType&&String(q.id)===String(p.authorId)||q.name===p.authorName))continue;out.push({key:'post:'+p.id,type:p.authorType||'npc',id:p.authorId||'',name:p.authorName,handle:p.handle||generateEnglishHandle(p.authorName),avatar:monoRecordAvatar(p),bio:''});if(out.length>=60)break;}return out;}
function monoDMFeatureProtocol(){return '\n[MONO新增消息功能·独立协议]\n外语角色沿用其原本语言，messages 中每条可含 translation 字段作为自然简体中文译文，中文原话留空。译文不写入原话括号。可偶尔分享真实已存在的他人主页，messages 内使用 {"profile":"下方key"}，只能从公开主页列表选择，不生成头像URL、不执行404动作。列表：'+JSON.stringify(monoProfileCatalog().map(p=>({key:p.key,name:p.name,handle:p.handle,bio:p.bio})));}
const monoV6Parse=forumParseReply;
forumParseReply=function(raw,conv){let value;try{value=forumStructuredValue(raw);}catch{return monoV6Parse(raw,conv);}const rows=Array.isArray(value)?value:Array.isArray(value?.messages)?value.messages:null;if(!rows)return monoV6Parse(raw,conv);const out=[];for(const r of rows){if(r&&typeof r==='object'&&r.profile){const key=typeof r.profile==='string'?r.profile:r.profile.key||r.profile.id;const p=monoProfileCatalog().find(p=>p.key===String(key));if(p)out.push({content:'[分享主页] '+p.name+' @'+p.handle,profile:structuredClone(p)});if(!r.text&&!r.content&&!r.sticker)continue;}const parsed=monoV6Parse(JSON.stringify({messages:[r]}),conv);for(const m of parsed){if(!m.sticker&&typeof r?.translation==='string')m.translation=r.translation.trim();out.push(m);}}if(!out.length)throw Error('没有可显示的回复');return out;};
function monoAbortDelay(ms,signal){return new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('已暂停','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});});}
async function monoDeliverReplies(conv,replies,kept,task){const turnId=crypto.randomUUID();let first=true;for(const [i,m] of replies.entries()){if(i)await monoAbortDelay(Math.min(1400,500+(m.content?.length||0)*13),task.controller.signal);if(task.controller.signal.aborted||forumDMTasks.get(conv.id)!==task)return;if(first){conv.messages=kept.slice();first=false;}conv.messages.push({id:crypto.randomUUID(),sender:'other',timestamp:Date.now(),turnId,...m});conv.lastMessage=m.content;conv.lastMessageTime=Date.now();if(currentDMConversationId!==conv.id)conv.unread=(conv.unread||0)+1;await forumSaveDMs();if(currentDMConversationId===conv.id&&document.querySelector('.forum-dm-chat'))forumRenderChat(conv);}}
function monoSharedProfileOpen(index){const conv=forumGetConv(),m=conv?.messages?.[index],p=m?.profile;if(!p)return;forumDraftSave(document.getElementById('dmInput')?.value||'');closeDirectMessages();if(p.handle===forumSettings.userHandle&&p.name===forumSettings.userNickname)return switchForumSection('profile');if(p.type==='ai'||p.type==='npc')return openOtherUserProfile(p.type,p.name,p.id||'');const u={...p,type:'random',following:0,followers:0};currentViewingUser=u;monoOtherTab='posts';renderOtherUserProfile(u,[]);}
function monoProfileCard(p,index){return `<button class="mono-shared-profile" onclick="ForumApp.monoSharedProfileOpen(${index})"><div class="mono-shared-profile-person"><img src="${escapeForumHtml(forumImageValue(p.avatar)||getDefaultAvatarDataUrl())}" onerror="ForumApp.monoAvatarError(this)" alt=""><div><strong>${escapeForumHtml(p.name||'用户')}</strong><small>@${escapeForumHtml(String(p.handle||'').replace(/^@/,''))}</small></div></div>${p.bio?`<p>${escapeForumHtml(p.bio)}</p>`:''}<div class="mono-shared-profile-footer"><span>查看主页</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m9 5 7 7-7 7"/></svg></div></button>`;}
const monoV6Chat=forumRenderChat;
forumRenderChat=function(c){monoV6Chat(c);const rows=[...document.querySelectorAll('.forum-dm-chat .forum-dm-message')];(c.messages||[]).forEach((m,i)=>{const row=rows[i];if(!row)return;const bubble=row.querySelector('.forum-dm-msg-bubble');if(m.profile&&bubble){bubble.className='mono-profile-shell';bubble.innerHTML=monoProfileCard(m.profile,i);row.classList.add('has-profile');return;}if(m.translation&&bubble){const wrap=document.createElement('div');wrap.className='mono-translated-message';bubble.before(wrap);wrap.append(bubble);const translation=document.createElement('div');translation.className='mono-message-translation';translation.lang='zh-CN';const span=document.createElement('span');span.textContent=m.translation;translation.append(span);wrap.append(translation);}});};
const monoV6Icon=monoXIcon;
monoXIcon=function(name){const paths={comment:'<path d="M21 11.5c0 4.2-3.6 7.5-8.6 7.5H10l-4 3v-4.1C3.5 16.5 2 14.3 2 11.5 2 7.2 6.1 4 11.5 4S21 7.2 21 11.5Z"/>',retweet:'<path d="M5 3v13a3 3 0 0 0 3 3h6M1 7l4-4 4 4M19 21V8a3 3 0 0 0-3-3h-6M15 17l4 4 4-4"/>',heart:'<path d="M12 21 3.4 12.6C.6 9.8 1.9 4 6.5 4c2.5 0 4.3 1.5 5.5 3 1.2-1.5 3-3 5.5-3 4.6 0 5.9 5.8 3.1 8.6Z"/>',bookmark:'<path d="M7 2.5h10a1 1 0 0 1 1 1V22l-6-4-6 4V3.5a1 1 0 0 1 1-1Z"/>'};return paths[name]?`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`:monoV6Icon(name);};
const monoV6Detail=renderForumPostDetail;
renderForumPostDetail=function(){monoV6Detail();const nav=document.querySelector('.mono-x-reply-nav'),p=forumPosts.find(p=>Number(p.id)===Number(currentForumPostId));if(nav){nav.firstElementChild.innerHTML='相关 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>';nav.lastElementChild.innerHTML='查看引用 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 5 7 7-7 7"/></svg>';}const bookmark=document.querySelector('.mono-x-detail-post [aria-label="收藏"]');if(bookmark&&!bookmark.querySelector('span'))bookmark.insertAdjacentHTML('beforeend','<span>'+(monoCount(p?.bookmarks||0)||'0')+'</span>');monoPositionReplyTarget();};
function monoFeatureRows(raw){const v=forumStructuredValue(raw);if(Array.isArray(v))return v.filter(r=>r&&typeof r==='object');for(const key of ['posts','quotes','retweets','interactions','data','results','items']){if(Array.isArray(v?.[key]))return v[key];if(v?.[key]&&typeof v[key]==='object'){for(const inner of ['posts','quotes','items'])if(Array.isArray(v[key][inner]))return v[key][inner];}}if(v&&typeof v==='object'&&(v.authorName||v.postId))return [v];throw Error('返回结果缺少互动列表');}
monoFeatureRequest=async function(prompt){const config=getActiveApiConfig();if(!config?.url||!config?.key)throw Error('请先配置API');const messages=[{role:'user',content:prompt+'\n这是新增功能的机器读取输出。只返回合法JSON数组，不写解释、思考、注释；字符串必须用双引号。'}];for(let attempt=0;attempt<2;attempt++){const res=await fetch(forumApiEndpoint(config),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.key},body:JSON.stringify({model:config.model,messages,temperature:attempt?0:0.8,max_tokens:4096})});const data=await res.json(),raw=data.choices?.[0]?.message?.content||'';try{return monoFeatureRows(raw);}catch(e){if(attempt)throw Error('模型仍未返回可读取的互动列表，已有内容未改动。请重试或检查模型配置。');messages.push({role:'assistant',content:String(raw).slice(0,16000)},{role:'user',content:'仅把上一条中已生成的互动整理为合法JSON数组，保留作者、内容和数字，不新增事实。若没有任何互动可提取，返回[]。不要返回说明文字或Markdown。'});}}};
const monoV6RefreshQuotes=monoRefreshQuotes;
monoRefreshQuotes=async function(id,tab='quotes'){await monoV6RefreshQuotes(id,tab);const list=document.getElementById('monoQuoteList');if(list&&!list.querySelector('.mono-x-post')&&!monoFeatureFlights.has('quotes:'+id)){const main=list.querySelector('main');if(main&&!main.querySelector('.mono-interaction-retry'))main.insertAdjacentHTML('beforeend',`<button class="mono-interaction-retry" onclick="ForumApp.monoRefreshQuotes(${Number(id)},'${tab==='retweets'?'retweets':'quotes'}')">重新生成互动</button>`);}};
Object.assign(ForumApp,{forumParseReply,forumRenderChat,monoSharedProfileOpen,renderForumPostDetail,monoRefreshQuotes,monoFeatureRequest});

// MONO v7: separately requested translation and reply-frequency features.
const monoV7Icon=monoXIcon;
monoXIcon=function(name){if(name!=='retweet')return monoV7Icon(name);return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 7 4-4 4 4M7 3v13a3 3 0 0 0 3 3h4M21 17l-4 4-4-4M17 21V8a3 3 0 0 0-3-3h-4"/></svg>';};
const monoV7Actions=monoXActions;
monoXActions=function(p,cid=null){const r=cid==null?p:p.comments?.find(c=>Number(c.id)===Number(cid));return monoV7Actions(p,cid).replace(/(aria-label="浏览">[\s\S]*?<span>)(<\/span>)/,'$1'+(monoCount(r?.views)||'0')+'$2');};
function monoForeignText(text){return /[ぁ-ヿ가-힣А-Яа-я]/.test(text)||(/[A-Za-z]{3}/.test(text)&&(String(text).match(/[A-Za-z]/g)||[]).length>(String(text).match(/[\u3400-\u9fff]/g)||[]).length*2);}
function monoTranslationControl(p,cid=null){const r=cid==null?p:p.comments?.find(c=>Number(c.id)===Number(cid));if(!r||!monoForeignText(r.content))return '';const key=p.id+':'+(cid??'post');return `<button class="mono-post-translate" data-translation-key="${key}" onclick="event.stopPropagation();ForumApp.monoTranslatePost(${Number(p.id)},${cid==null?'null':Number(cid)},this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8"/><path d="m3 21 18-18M8 6l8 12"/></svg><span>显示翻译</span></button>`;}
const monoV7Post=renderForumPostItem;
renderForumPostItem=function(p){let html=monoV7Post(p);const control=monoTranslationControl(p);if(control)html=html.replace('<div class="mono-x-text">',control+'<div class="mono-x-text">');if(p.isRetweet)html=html.replace('<button class="mono-x-avatar-button"',`<div class="mono-reposted-label">${monoXIcon('retweet')}<span>${escapeForumHtml(monoPostName(p))} 已转帖</span></div><button class="mono-x-avatar-button"`);return html;};
const monoV7Comment=monoCommentRow;
monoCommentRow=function(p,c,connected){let html=monoV7Comment(p,c,connected);html=html.replace('</small></div>','</small><button aria-label="评论选项" onclick="ForumApp.monoCommentOptions('+Number(p.id)+','+Number(c.id)+')">'+forumIcon('more')+'</button></div>');return html.replace('<div class="mono-x-text">',monoTranslationControl(p,c.id)+'<div class="mono-x-text">');};
function monoCommentOptions(id,cid){const sh=forumSheet('评论选项','<button class="forum-sheet-row" data-reply>回复</button><button class="forum-sheet-row" data-quote>引用转发</button>');sh.querySelector('[data-reply]').onclick=()=>{sh.remove();monoReplyComment(id,cid);};sh.querySelector('[data-quote]').onclick=()=>{sh.remove();monoQuoteComment(id,cid);};}
const monoV7Detail=renderForumPostDetail;
renderForumPostDetail=function(){monoV7Detail();const p=forumPosts.find(p=>Number(p.id)===Number(currentForumPostId)),text=document.querySelector('.mono-x-detail-text');if(p&&text)text.insertAdjacentHTML('beforebegin',monoTranslationControl(p));};
const monoTranslationFlights=new Map();
async function monoTranslatePost(id,cid,button){const p=forumPosts.find(p=>Number(p.id)===id),r=cid==null?p:p?.comments?.find(c=>Number(c.id)===cid);if(!r)return;const key=id+':'+(cid??'post'),scope=button.closest('.mono-x-comment,.mono-x-post,.mono-x-detail-post'),text=scope?.querySelector('.mono-x-text,.mono-x-detail-text');if(!text)return;if(button.dataset.translated==='true'){text.innerHTML=formatForumContent(r.content);button.dataset.translated='false';button.querySelector('span').textContent='显示翻译';return;}button.disabled=true;const finish=monoGenerationStart('正在翻译');try{if(!r.monoChineseTranslation){let job=monoTranslationFlights.get(key);if(!job){job=monoFeatureRequest('新增翻译功能：将以下正文忠实翻译为简体中文，保留段落、语气和原有emoji。仅返回JSON数组 [{"translation":"中文译文"}]。不要增加内容。正文：\n'+r.content);monoTranslationFlights.set(key,job);}const rows=await job;const translated=rows[0]?.translation;if(typeof translated!=='string'||!translated.trim())throw Error('未收到译文，原文已保留');r.monoChineseTranslation=translated.trim();await localforage.setItem('forumPosts',forumPosts);}if(!button.isConnected)return;text.innerHTML=formatForumContent(r.monoChineseTranslation);button.dataset.translated='true';button.querySelector('span').textContent='显示原文';}catch(e){showToast(e.message);}finally{button.disabled=false;finish();monoTranslationFlights.delete(key);}}
function monoReplySetting(conv){const value=conv?.chatOptions?.postReplyPercent;return typeof value==='number'?Math.max(0,Math.min(100,value)):null;}
function monoReplyAuthorConv(r){return forumDirectMessages.find(c=>c.id===(r.authorType==='ai'?'ai_':'npc_')+r.authorId||c.name===r.authorName);}
const monoV7Map=mapAndResolveComments;
mapAndResolveComments=function(rows,p){const all=monoV7Map(rows,p),removed=new Set(all.filter(r=>monoReplySetting(monoReplyAuthorConv(r))!==null).map(r=>r.id));return all.filter(r=>!removed.has(r.id)).map(r=>removed.has(r.replyTo)?{...r,replyTo:null,replyToName:null}:r);};
const monoRolePostFlights=new Set();
async function monoRoleReply(convId,postId){const conv=forumGetConv(convId),p=forumPosts.find(p=>Number(p.id)===Number(postId));if(!conv||!p||p.authorType!=='user'||!monoOwnPost(p))return;const key=convId+':'+postId;if(monoRolePostFlights.has(key))return;monoRolePostFlights.add(key);const end=monoGenerationStart(conv.name+' 正在回帖');try{const ai=convId.startsWith('ai_'),id=convId.replace(/^(ai_|npc_|random_)/,''),a=ai?forumSettings.aiParticipants.find(a=>String(a.charId)===id):forumSettings.npcs.find(a=>String(a.id)===id),persona=ai?getCharacterFullPersona(a||{charId:id}):a?.persona||a?.identity||conv.forumPersona||'';const rows=await monoFeatureRequest('新增指定角色回帖功能：只扮演以下角色回复用户发布的帖子。角色：'+conv.name+'\n人设：'+persona+'\n世界观：'+(forumSettings.worldview||'')+'\n用户昵称：'+forumSettings.userNickname+'\n用户帖子：'+p.content+'\n最近评论：'+JSON.stringify((p.comments||[]).slice(-12).map(c=>({author:c.authorName,content:c.content})))+'\n返回JSON数组 [{"content":"一条自然的回帖","translation":"若原文为外语，在同一次生成中附中文译文；中文则留空"}]。只生成此角色的一条独立回复，使用人设的原语言，不替用户发言，不编造他人回复。');const content=rows[0]?.content;if(typeof content!=='string'||!content.trim())throw Error('角色未返回回帖内容，已有评论已保留');p.comments ||= [];const max=p.comments.reduce((n,c)=>Math.max(n,Number(c.id)||0),Date.now());p.comments.push({id:max+1,authorType:ai?'ai':'npc',authorId:id,authorName:conv.name,handle:a?.handle||generateEnglishHandle(conv.name),content:content.trim(),monoChineseTranslation:typeof rows[0]?.translation==='string'?rows[0].translation.trim():'',timestamp:Date.now(),likes:0,views:0,retweets:0});await localforage.setItem('forumPosts',forumPosts);monoRefreshPostViews();}catch(e){showToast(e.message);}finally{end();monoRolePostFlights.delete(key);}}
async function monoAutoRoleReplies(postId){const p=forumPosts.find(p=>Number(p.id)===Number(postId));if(!p||p.authorType!=='user'||!monoOwnPost(p))return;await initDirectMessages();for(const conv of forumDirectMessages){const chance=monoReplySetting(conv);if(chance!==null&&chance>0&&Math.random()*100<chance)await monoRoleReply(conv.id,p.id);}}
const monoV7MoreComments=generateMoreComments;
generateMoreComments=async function(id){const postId=id||currentForumPostId;await monoV7MoreComments(postId);await monoAutoRoleReplies(postId);};
const monoV7Interactions=generateInteractionsForNewPost;
generateInteractionsForNewPost=async function(id){await monoV7Interactions(id);await monoAutoRoleReplies(id);};
const monoV7GeneratePosts=generateForumPosts;
generateForumPosts=async function(){await monoV7GeneratePosts();const p=forumPosts.find(p=>p.authorType==='user'&&monoOwnPost(p));if(p)await monoAutoRoleReplies(p.id);};
function monoPickImmediateReply(convId){const posts=forumPosts.filter(p=>p.authorType==='user'&&monoOwnPost(p)).slice(0,30);const sh=forumSheet('选择要回复的帖子',posts.map(p=>`<button class="forum-sheet-row" data-reply-post="${Number(p.id)}">${escapeForumHtml(p.content?.slice(0,100)||'[图片帖子]')}</button>`).join('')||'<p>你还没有发布帖子</p>');sh.querySelectorAll('[data-reply-post]').forEach(b=>b.onclick=()=>{sh.remove();monoRoleReply(convId,Number(b.dataset.replyPost));});}
const monoV7Chat=forumRenderChat;
forumRenderChat=function(c){monoV7Chat(c);const page=document.querySelector('.forum-dm-chat');page?.querySelectorAll('.forum-dm-message:has(.mono-translated-message)').forEach(row=>{const bubble=row.querySelector('.forum-dm-msg-bubble'),avatar=row.querySelector('.forum-dm-msg-avatar');if(bubble&&avatar)row.style.setProperty('--mono-avatar-top',Math.max(0,bubble.getBoundingClientRect().height-avatar.getBoundingClientRect().height)+'px');});};
const monoV7ChatSettings=forumOpenChatSettings;
forumOpenChatSettings=function(){monoV7ChatSettings();const conv=forumGetConv(),sh=document.getElementById('forumAuxSheet');if(!conv||!sh)return;const opts=forumDMOptions(conv),box=document.createElement('section');box.className='mono-reply-frequency';box.innerHTML='<h3>回帖</h3><label class="forum-setting-row"><span>每次刷新回帖概率<small>仅控制当前角色参与你的帖子，不影响私信</small></span><span><input type="number" min="0" max="100" step="1" aria-label="回帖概率" placeholder="默认" value="'+(monoReplySetting(conv)??'')+'"> %</span></label><p class="mono-note">0% 不自动回帖，100% 每次刷新都请求回帖；留空恢复原有规则。</p><button class="forum-sheet-row" data-immediate>要求立即回帖</button>';sh.querySelector('main').append(box);box.querySelector('input').onchange=async e=>{if(!e.target.value.trim())delete opts.postReplyPercent;else opts.postReplyPercent=Math.max(0,Math.min(100,Math.round(Number(e.target.value)||0)));e.target.value=monoReplySetting(conv)??'';await forumSaveDMs();};box.querySelector('[data-immediate]').onclick=()=>monoPickImmediateReply(conv.id);};
Object.assign(ForumApp,{forumRenderChat,monoCommentOptions,monoTranslatePost,monoRoleReply,monoAutoRoleReplies,monoPickImmediateReply,forumOpenChatSettings,renderForumPostItem,renderForumPostDetail,generateMoreComments,generateInteractionsForNewPost,generateForumPosts,mapAndResolveComments});

// MONO v8: cached translation, text-image cards and robust avatar resolution.
const monoV8Icon=monoXIcon;
monoXIcon=function(name){if(name!=='retweet')return monoV8Icon(name);return '<svg viewBox="0 0 24 24" fill="none" stroke="none"><path fill="currentColor" d="M5 3 9 7H5.8v8.4a2.8 2.8 0 0 0 2.8 2.8H12v1.6H8.6a4.4 4.4 0 0 1-4.4-4.4V7H1l4-4Zm14 18-4-4h3.2V8.6a2.8 2.8 0 0 0-2.8-2.8H12V4.2h3.4a4.4 4.4 0 0 1 4.4 4.4V17H23l-4 4Z"/></svg>';};
const monoV8Resolve=resolveAuthorIdentity;
resolveAuthorIdentity=function(name,record={}){const norm=v=>String(v||'').trim().replace(/^@/,'').toLowerCase();const candidates=(forumSettings.aiParticipants||[]).map(p=>{const c=forumCharacter(p.charId);return {p,c};});const exact=record.authorId!=null?candidates.find(({p})=>String(p.charId)===String(record.authorId)):null;const npc=(forumSettings.npcs||[]).find(n=>record.authorId!=null?String(n.id)===String(record.authorId):norm(n.name)===norm(name));const matches=candidates.filter(({p,c})=>[p.nickname,c?.name,c?.realName,c?.remarkName].filter(Boolean).some(n=>norm(n)===norm(name))||(record.handle&&p.handle&&norm(record.handle)===norm(p.handle)));const match=!npc?(exact||(matches.length===1?matches[0]:null)):null;if(match)return {type:'ai',id:match.p.charId,name:match.p.nickname||match.c?.remarkName||match.c?.realName||match.c?.name||name,avatar:match.p.avatar||match.c?.avatar||''};return monoV8Resolve(name,record);};
monoRecordAvatar=function(p){if(p.authorType==='user')return forumImageValue((monoOwnPost(p)?forumSettings.userAvatar:p.authorAvatar)||monoAvatarFallback())||getDefaultAvatarDataUrl();const a=resolveAuthorIdentity(p.authorName,p);if(a.type==='ai')return forumImageValue(a.avatar)||getDefaultAvatarDataUrl();const n=(forumSettings.npcs||[]).find(n=>p.authorId!=null?String(n.id)===String(p.authorId):n.name===p.authorName);return forumImageValue(n?.avatar)||getDefaultAvatarDataUrl();};
function monoCachedTranslation(r){if(!r)return;const text=String(r.content||'');if(r.monoChineseTranslation&&r.monoOriginalContent)return;const found=[];const original=text.replace(/[（(]([^（）()]*[\u3400-\u9fff][^（）()]*)[）)]/g,(whole,inside)=>{found.push(inside.trim());return '';}).trim();if(found.length&&monoForeignText(original)){r.monoOriginalContent=original;r.monoChineseTranslation ||= found.join('\n');}}
function monoShownContent(r){monoCachedTranslation(r);return r?.monoOriginalContent||r?.content||'';}
monoTranslationControl=function(p,cid=null){const r=cid==null?p:p.comments?.find(c=>Number(c.id)===Number(cid));monoCachedTranslation(r);if(!r||!monoForeignText(monoShownContent(r))||!r.monoChineseTranslation)return '';return `<button class="mono-post-translate" data-translation-key="${p.id}:${cid??'post'}" onclick="event.stopPropagation();ForumApp.monoTranslatePost(${Number(p.id)},${cid==null?'null':Number(cid)},this)"><span>显示翻译</span></button>`;};
monoTranslatePost=function(id,cid,button){const p=forumPosts.find(p=>Number(p.id)===Number(id)),r=cid==null?p:p?.comments?.find(c=>Number(c.id)===Number(cid));if(!r)return;monoCachedTranslation(r);const scope=button.closest('.mono-x-comment,.mono-x-post,.mono-x-detail-post'),text=scope?.querySelector('.mono-x-text,.mono-x-detail-text');if(!text||!r.monoChineseTranslation)return;const translated=button.dataset.translated!=='true';text.innerHTML=formatForumContent(translated?r.monoChineseTranslation:monoShownContent(r));button.dataset.translated=String(translated);button.querySelector('span').textContent=translated?'显示原文':'显示翻译';};
function monoCommentHeat(p,c){if(c.views!=null&&Number.isFinite(Number(c.views))&&Number(c.views)>=0&&!c.monoViewsPlaceholder&&(Number(c.views)>0||c.monoViewsProvided))return;const seed=[p.id,c.id,c.authorName].join(':').split('').reduce((n,ch)=>(n*31+ch.charCodeAt(0))>>>0,0);const base=Math.max(Number(p.views)||0,(Number(c.likes)||0)*8,100);c.views=Math.max(Number(c.likes)||0,Math.round(base*(.18+(seed%48)/100)));c.monoSimulatedViews=true;}
const monoV8Map=mapAndResolveComments;
mapAndResolveComments=function(rows,p){const out=monoV8Map(rows,p);out.forEach(c=>{monoCachedTranslation(c);monoCommentHeat(p,c);});return out;};
const monoV8Post=renderForumPostItem;
renderForumPostItem=function(p){monoCachedTranslation(p);return monoV8Post({...p,content:monoShownContent(p)});};
const monoV8Comment=monoCommentRow;
monoCommentRow=function(p,c,connected){monoCommentHeat(p,c);monoCachedTranslation(c);const copy={...c,content:monoShownContent(c)};return monoV8Comment(p,copy,connected);};
const monoV8Detail=renderForumPostDetail;
renderForumPostDetail=function(){monoV8Detail();const p=forumPosts.find(p=>Number(p.id)===Number(currentForumPostId)),text=document.querySelector('.mono-x-detail-text');if(p&&text)text.innerHTML=formatForumContent(monoShownContent(p));};
async function monoPreparePostTranslations(records){let changed=false;for(const p of records||[]){for(const r of [p,...p.comments||[]]){const old=r.monoChineseTranslation;monoCachedTranslation(r);if(old!==r.monoChineseTranslation)changed=true;}}if(changed)await localforage.setItem('forumPosts',forumPosts);}
function monoTranslationTargets(){return forumPosts.slice(0,30);}
const monoV8Posts=generateForumPosts;generateForumPosts=async function(...args){await monoV8Posts(...args);await monoPreparePostTranslations(monoTranslationTargets());};
const monoV8More=generateMoreComments;generateMoreComments=async function(id){await monoV8More(id);const p=forumPosts.find(p=>Number(p.id)===Number(id||currentForumPostId));if(p)await monoPreparePostTranslations([p]);};
const monoV8Interactions=generateInteractionsForNewPost;generateInteractionsForNewPost=async function(id){await monoV8Interactions(id);const p=forumPosts.find(p=>Number(p.id)===Number(id));if(p)await monoPreparePostTranslations([p]);};
const monoV8Topic=generateTopicPosts;generateTopicPosts=async function(...args){await monoV8Topic(...args);await monoPreparePostTranslations(monoTranslationTargets());};
const monoV8Profile=generateUserProfilePosts;generateUserProfilePosts=async function(...args){await monoV8Profile(...args);await monoPreparePostTranslations(monoTranslationTargets());};
const monoV8Role=monoRoleReply;monoRoleReply=async function(cid,id){await monoV8Role(cid,id);const p=forumPosts.find(p=>Number(p.id)===Number(id));if(p){p.comments?.forEach(c=>{if(c.views===0&&c.authorId===cid.replace(/^(ai_|npc_|random_)/,'')){c.monoViewsPlaceholder=true;monoCommentHeat(p,c);delete c.monoViewsPlaceholder;}});await monoPreparePostTranslations([p]);await localforage.setItem('forumPosts',forumPosts);monoRefreshPostViews();}};
const monoV8ChatSettings=forumOpenChatSettings;
forumOpenChatSettings=function(){monoV8ChatSettings();const conv=forumGetConv(),sh=document.getElementById('forumAuxSheet');if(!conv||!sh)return;const remove=document.createElement('button');remove.className='forum-sheet-row';remove.dataset.removeBackground='';remove.textContent='去除聊天背景';remove.disabled=!forumDMOptions(conv).background;sh.querySelector('[data-action="background"]')?.after(remove);remove.onclick=async()=>{delete forumDMOptions(conv).background;await forumSaveDMs();sh.remove();forumRenderChat(conv);};};
const monoTextCover='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#eeeeec"/><path d="M300 410h200M300 450h200M300 490h140" stroke="#777" stroke-width="8" stroke-linecap="round"/></svg>');
function monoTextImageEditor(index=null){if(index==null&&forumComposeImages.length>=4)return showToast('最多添加4张图片');const item=index==null?null:forumComposeImages[index];let cover=item?.data||monoTextCover;const sh=forumSheet(index==null?'添加文字图':'编辑文字图',`<button class="mono-text-cover" data-cover><img src="${escapeForumHtml(cover)}" alt="封面"><span>更换图片封面</span></button><label class="mono-field">图片里的内容<textarea data-image-content rows="5" placeholder="写下这张图的文字或描述…">${escapeForumHtml(item?.card?.content||'')}</textarea></label><button class="forum-sheet-primary" data-save-card>保存文字图</button>`);sh.querySelector('[data-cover]').onclick=()=>forumChoosePicture(src=>{cover=src;sh.querySelector('[data-cover] img').src=src;});sh.querySelector('[data-save-card]').onclick=()=>{const content=sh.querySelector('textarea').value.trim();if(!content)return showToast('请填写图片内容');const card={data:cover,card:{content}};if(index==null)forumComposeImages.push(card);else forumComposeImages[index]=card;renderComposeImages();sh.remove();};}
const monoV8Compose=openForumCompose;
openForumCompose=function(){monoV8Compose();const toolbar=document.querySelector('#forumComposeOverlay .forum-compose-toolbar');if(toolbar&&!toolbar.querySelector('[data-text-image]'))toolbar.insertAdjacentHTML('beforeend','<button class="mono-compose-link" data-text-image onclick="ForumApp.monoTextImageEditor()">文字图</button>');};
const monoV8Images=renderComposeImages;
renderComposeImages=function(){monoV8Images();document.querySelectorAll('#forumComposeImages .forum-compose-image-item').forEach((el,i)=>{if(!forumComposeImages[i]?.card)return;const b=document.createElement('button');b.className='mono-edit-image-card';b.textContent='编辑内容';b.onclick=()=>monoTextImageEditor(i);el.append(b);});};
const monoV8XImages=monoXImages;
monoXImages=function(p){if(!p.imageCards?.some(Boolean))return monoV8XImages(p);return `<div class="mono-x-images ${p.images.length>1?'multi':''}">${p.images.slice(0,4).map((src,i)=>`<button onclick="event.stopPropagation();ForumApp.monoOpenTextImage(${Number(p.id)},${i})"><img loading="lazy" src="${escapeForumHtml(forumImageValue(src))}" alt="${p.imageCards[i]?'文字图':''}">${p.imageCards[i]?'<span class="mono-image-card-hint">查看内容</span>':''}</button>`).join('')}</div>`;};
function monoOpenTextImage(id,index){const p=forumPosts.find(p=>Number(p.id)===Number(id)),card=p?.imageCards?.[index];if(!p)return;if(!card)return showForumFullImage(p.images[index]);const own=p.authorType==='user'&&monoOwnPost(p);const sh=forumSheet('图片内容',`<img class="mono-text-image-full" src="${escapeForumHtml(forumImageValue(p.images[index]))}" alt="封面">${own?`<label class="mono-field">文字内容<textarea data-card-content rows="5">${escapeForumHtml(card.content)}</textarea></label><button class="forum-sheet-primary" data-card-update>保存修改</button>`:`<p class="mono-text-image-content">${escapeForumHtml(card.content)}</p>`}`);if(own)sh.querySelector('[data-card-update]').onclick=async()=>{const content=sh.querySelector('textarea').value.trim();if(!content)return showToast('请填写图片内容');card.content=content;await localforage.setItem('forumPosts',forumPosts);sh.remove();monoRefreshPostViews();};}
Object.assign(ForumApp,{resolveAuthorIdentity,monoTranslatePost,monoPreparePostTranslations,monoTextImageEditor,monoOpenTextImage,openForumCompose,renderComposeImages,renderForumPostItem,renderForumPostDetail,mapAndResolveComments,forumOpenChatSettings,generateForumPosts,generateMoreComments,generateInteractionsForNewPost,generateTopicPosts,generateUserProfilePosts,monoRoleReply});

function forumBoot() {
  if(ForumApp.ready)return ForumApp.ready;
  let page=document.getElementById('forumPage');
  monoSyncSafeArea();
  if(!page){page=document.createElement('section');page.id='forumPage';page.className='page';page.hidden=true;page.style.cssText='position:absolute;inset:0;z-index:1000;display:none;height:100%;';page.innerHTML='<div id="forumPageContent" class="page-content"></div>';forumMount(page);}
  else if(!document.getElementById('forumPageContent'))page.innerHTML='<div id="forumPageContent" class="page-content"></div>';
  ForumApp.ready=initForumApp().catch(e=>{ForumApp.ready=null;showToast('论坛加载失败：'+e.message);throw e;});return ForumApp.ready;
}
ForumApp.open=async()=>{await forumBoot();const page=document.getElementById('forumPage');page.hidden=false;page.style.display='flex';page.style.height='100%';monoInstallBranding();};
if(!window.openForumApp)window.openForumApp=ForumApp.open;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>forumBoot().catch(()=>{}),{once:true});else forumBoot().catch(()=>{});
// MONO v8.1: recover legacy role associations and native avatar fallbacks.
function monoAvatarIdentityKey(value){return String(value??'').normalize('NFKC').trim().replace(/^@/,'').replace(/\s+/g,'').toLowerCase();}
function monoIsPlaceholderAvatar(value){return !value||String(value)===getDefaultAvatarDataUrl();}
function monoRoleAvatar(participant,character,conversation){const custom=forumImageValue(participant?.avatar);if(custom&&!monoIsPlaceholderAvatar(custom))return custom;return forumImageValue(character?.avatar)||forumImageValue(conversation?.avatar)||custom||'';}
function monoAvatarRoleCandidates(){const rows=new Map();for(const c of forumNativeCharacters()){rows.set(String(c.id),{id:c.id,c,p:null,conv:null,names:new Set([c.name,c.realName,c.remarkName,c.charName].filter(Boolean).map(monoAvatarIdentityKey)),handles:new Set()});}for(const p of forumSettings.aiParticipants||[]){const id=String(p.charId);let r=rows.get(id);if(!r){r={id:p.charId,c:null,p:null,conv:null,names:new Set(),handles:new Set()};rows.set(id,r);}r.p=p;if(p.nickname)r.names.add(monoAvatarIdentityKey(p.nickname));if(p.handle)r.handles.add(monoAvatarIdentityKey(p.handle));}for(const conv of forumDirectMessages||[]){if(!conv.id?.startsWith('ai_'))continue;const r=rows.get(conv.id.slice(3));if(!r)continue;r.conv=conv;if(conv.name)r.names.add(monoAvatarIdentityKey(conv.name));if(conv.handle)r.handles.add(monoAvatarIdentityKey(conv.handle));}return [...rows.values()];}
const monoV81Resolve=resolveAuthorIdentity;
resolveAuthorIdentity=function(name,record={}){if(record.authorType==='user')return monoV81Resolve(name,record);const key=monoAvatarIdentityKey(name),handle=monoAvatarIdentityKey(record.handle||record.authorHandle),rows=monoAvatarRoleCandidates(),rawId=record.charId??record.characterId??record.authorId,id=String(rawId??'').replace(/^ai_/,'');const exact=id?rows.find(r=>String(r.id)===id):null;const npcId=id?(forumSettings.npcs||[]).find(n=>String(n.id)===id):null;const handles=handle?rows.filter(r=>r.handles.has(handle)):[],names=key?rows.filter(r=>r.names.has(key)):[];const explicitNpc=record.authorType==='npc'&&npcId&&!exact;let found=explicitNpc?null:exact||(handles.length===1?handles[0]:null)||(names.length===1?names[0]:null);if(found){return {type:'ai',id:found.id,name:found.p?.nickname||found.c?.remarkName||found.c?.realName||found.c?.name||found.conv?.name||name,avatar:monoRoleAvatar(found.p,found.c,found.conv)};}return monoV81Resolve(name,record);};
const monoV81Avatar=monoRecordAvatar;
monoRecordAvatar=function(record){if(record.authorType==='user')return monoV81Avatar(record);const a=resolveAuthorIdentity(record.authorName,record);if(a.type==='ai')return forumImageValue(a.avatar)||getDefaultAvatarDataUrl();return monoV81Avatar(record);};
let monoRoleRecoveryDirty=false;
function monoRecoverRoleRecords(){let changed=false;function fix(r){if(!r||r.authorType==='user')return;const a=resolveAuthorIdentity(r.authorName,r);if(a.type!=='ai')return;if(r.authorType!=='ai'||String(r.authorId)!==String(a.id)){r.authorType='ai';r.authorId=a.id;changed=true;}const avatar=forumImageValue(a.avatar);if(avatar&&r.authorAvatar!==avatar){r.authorAvatar=avatar;changed=true;}}for(const p of forumPosts){fix(p);for(const c of p.comments||[])fix(c);if(p.originalPost)fix(p.originalPost);}if(changed)monoRoleRecoveryDirty=true;return changed;}
const monoV81RenderFeed=renderForumFeed;
renderForumFeed=function(...args){monoRecoverRoleRecords();return monoV81RenderFeed(...args);};
const monoV81Open=ForumApp.open;
ForumApp.open=async function(){await monoV81Open();await initDirectMessages();monoRecoverRoleRecords();if(monoRoleRecoveryDirty){await localforage.setItem('forumPosts',forumPosts);monoRoleRecoveryDirty=false;monoRefreshPostViews();}};
Object.assign(ForumApp,{resolveAuthorIdentity,monoRecordAvatar,monoRecoverRoleRecords,renderForumFeed});

// MONO v8.2: shared posts retain their destination in chat.
function monoSharedPostRecord(message){
 if(message?.forumPost&&typeof message.forumPost==='object')return message.forumPost;
 const text=String(message?.content||'');if(!text.startsWith('[分享帖子] '))return null;
 const newline=text.indexOf('\n');if(newline<0)return null;
 const name=text.slice(7,newline).trim(),content=text.slice(newline+1);
 const matches=forumPosts.filter(p=>p.authorName===name&&p.content===content);
 return matches.length===1?matches[0]:null;
}
function monoSharedPostMarkup(p,index){
 const src=forumSafeImage(p.images?.[0]);
 return `<button class="mono-shared-post" onclick="ForumApp.monoSharedPostOpen(${index})" aria-label="查看分享的帖子"><div class="mono-shared-profile-person"><img src="${escapeForumHtml(monoRecordAvatar(p))}" onerror="ForumApp.monoAvatarError(this)" alt=""><div><strong>${escapeForumHtml(monoPostName(p)||'用户')}</strong><small>@${escapeForumHtml(String(p.handle||generateEnglishHandle(p.authorName)).replace(/^@/,''))}</small></div></div><p class="mono-shared-post-excerpt">${escapeForumHtml(p.monoOriginalContent||p.content||'图片帖子')}</p>${src?`<img class="mono-shared-post-cover" src="${escapeForumHtml(src)}" alt="帖子图片" onerror="this.hidden=true">`:''}<div class="mono-shared-profile-footer"><span>查看帖子</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m9 5 7 7-7 7"/></svg></div></button>`;
}
function monoSharedPostOpen(index){
 const conv=forumGetConv(),snapshot=monoSharedPostRecord(conv?.messages?.[index]);if(!snapshot)return;
 const post=forumPosts.find(p=>String(p.id)===String(snapshot.id));
 if(!post){forumSheet('分享的帖子',`<p class="mono-note">原帖已不在当前列表，以下是分享时的内容。</p><div class="mono-shared-post-archive"><strong>${escapeForumHtml(snapshot.authorName||'用户')}</strong><p>${escapeForumHtml(snapshot.content||'图片帖子')}</p></div>`);return;}
 forumDraftSave(document.getElementById('dmInput')?.value||'');
 monoSharedPostReturnChat=conv.id;closeDirectMessages();switchForumSection('home');openForumPostDetail(post.id);
}
let monoSharedPostReturnChat=null;
const monoV82ClosePost=closeForumPostDetail;
closeForumPostDetail=function(...args){const chat=monoSharedPostReturnChat;monoSharedPostReturnChat=null;monoV82ClosePost(...args);if(chat&&forumGetConv(chat))openDirectMessageChat(chat);};
const monoV82Chat=forumRenderChat;
forumRenderChat=function(c){monoV82Chat(c);const rows=[...document.querySelectorAll('.forum-dm-chat .forum-dm-message')];(c.messages||[]).forEach((m,i)=>{const p=monoSharedPostRecord(m),row=rows[i];if(!p||!row)return;const bubble=row.querySelector('.forum-dm-msg-bubble');if(!bubble)return;bubble.className='mono-post-shell';bubble.innerHTML=monoSharedPostMarkup(p,i);row.classList.add('has-shared-post');});};
Object.assign(ForumApp,{forumRenderChat,monoSharedPostOpen,closeForumPostDetail});

// MONO v8.3: requested private-message style only; original forum templates retained.
function monoPrivateChatStyle(discovery=false){return '\n[MONO私信聊天方式·仅用于私信]\n按发送者既有人设、关系和语言说话，不把不同角色写成同一种温柔客服。'+(discovery?'这是主动开场，每个人通常发一句短话，围绕一个具体细节开口；也可以继续已有话题。':'先接住对话中用户最新一句的具体意思，再决定说什么；用户分享帖子是分享他人的内容，不代表帖中文字是用户自己的经历。最近动态只作背景，不要跳过最新消息去统一点评旧帖。')+'\n默认一轮1至3条短消息，一句能讲清就只发一句。中文每条通常5至30字、外语一句短话；这是日常节奏，详细提问或必要解释可以更长。不要为了凑条数拆成单字，不要把长篇安慰换行伪装成短聊。每条放进messages数组，按原有协议依次发送。\n用户没有求建议时，不要自动安排休息、洗澡、饮食、直播或明天的日程；避免“辛苦了、身体第一、别勉强自己、好好休息”的固定结尾。人设确实会关心时，以他的语气问具体的事或简短回应，不连续叠加关心。不要总总结、升华、讲道理或连问几个问题，不编造用户的活动，不套万能亲昵称呼；语气、熟悉程度和表达习惯来自人设，不强行加网络梗。\n外语角色的text/content保持其原语言，不混入中文解释。中文译文仅放translation字段；中文角色无需翻译。保持已有表情包和主页分享协议。'+(discovery?'\n主动私信仍返回原JSON数组，每个元素保留senderName/type，可用content和translation表示一句；也可用messages:[{"text":"原话","translation":"中文译文"}]表示同一人连续的短消息，不要额外生成新的联系人。':'');}
const monoV83DMProtocol=monoDMFeatureProtocol;
monoDMFeatureProtocol=function(){return monoV83DMProtocol()+monoPrivateChatStyle();};
Object.assign(ForumApp,{monoDMFeatureProtocol});

// MONO v8.4: select conversations/messages and delete any locally stored post.
const monoV84Discover=fetchNewRandomDMsInternal;
fetchNewRandomDMsInternal=async function(...args){const key=monoDMKey(),before=new Set(forumDirectMessages.map(c=>c.id));const result=await monoV84Discover(...args);const batch=crypto.randomUUID(),ids=forumDirectMessages.filter(c=>!before.has(c.id)).map(c=>{c.monoDiscoveryBatch=batch;return c.id;});await forumSaveDMs();await localforage.setItem(key+':latestDiscovery',{batch,ids});return result;};
async function monoDeleteConversations(ids){const selected=new Set(ids);for(const id of selected){forumStopGeneration(id);forumDrafts.delete(id);}forumDirectMessages=forumDirectMessages.filter(c=>!selected.has(c.id));if(selected.has(currentDMConversationId)){closeDirectMessages();currentDMConversationId=null;}await forumSaveDMs();document.getElementById('forumAuxSheet')?.remove();renderDirectMessagesList();showToast('已删除 '+selected.size+' 个对话');}
async function monoClearNewConversations(){const round=await localforage.getItem(monoDMKey()+':latestDiscovery');const ids=(round?.ids||[]).filter(id=>forumGetConv(id)?.monoDiscoveryBatch===round.batch);if(!ids.length)return showToast('本轮没有新生成的对话');await monoDeleteConversations(ids);await localforage.setItem(monoDMKey()+':latestDiscovery',null);}
function monoConversationDeletion(){const items=[...forumDirectMessages].sort((a,b)=>(b.lastMessageTime||0)-(a.lastMessageTime||0));const sh=forumSheet('删除对话',`<p class="mono-note">删除所选 MONO 对话及其记录，角色和联系人设定保留。</p><div class="mono-delete-list">${items.map((c,i)=>`<label class="mono-delete-choice"><input type="checkbox" data-conv-index="${i}"><span><strong>${escapeForumHtml(c.name)}</strong><small>${escapeForumHtml(c.lastMessage||'暂无消息')}</small></span></label>`).join('')||'<p class="mono-note">暂无对话</p>'}</div><button class="forum-sheet-primary" data-delete-conversations disabled>删除所选</button>`);const submit=sh.querySelector('[data-delete-conversations]');sh.querySelectorAll('input').forEach(el=>el.onchange=()=>{const n=sh.querySelectorAll('input:checked').length;submit.disabled=!n;submit.textContent=n?'删除所选（'+n+'）':'删除所选';});submit.onclick=async()=>{submit.disabled=true;await monoDeleteConversations([...sh.querySelectorAll('input:checked')].map(el=>items[Number(el.dataset.convIndex)].id));};}
const monoV84Contacts=renderDirectMessagesList;
renderDirectMessagesList=function(...args){monoV84Contacts(...args);const label=document.querySelector('.forum-dm-page .forum-dm-section-label');if(label){label.innerHTML='<span>消息</span><div class="mono-delete-tools"><button data-delete-dialogs>选择删除</button><button data-clear-new-dialogs>清除本轮新对话</button></div>';label.querySelector('[data-delete-dialogs]').onclick=monoConversationDeletion;label.querySelector('[data-clear-new-dialogs]').onclick=monoClearNewConversations;}};
const monoV84ContactSettings=monoContactSettings;
monoContactSettings=function(...args){monoV84ContactSettings(...args);const body=document.getElementById('monoContactBody');if(!body)return;body.insertAdjacentHTML('afterbegin','<div class="forum-sheet-pair"><button data-delete-dialogs>选择删除对话</button><button data-clear-new-dialogs>清除本轮新对话</button></div>');body.querySelector('[data-delete-dialogs]').onclick=monoConversationDeletion;body.querySelector('[data-clear-new-dialogs]').onclick=async()=>{await monoClearNewConversations();monoContactSettings();};};
function monoMessageDeletion(){const conv=forumGetConv();if(!conv)return;const items=[...(conv.messages||[])];const sh=forumSheet('选择聊天记录',`<p class="mono-note">可单选或多选；图片、表情包和分享卡片也可以删除。</p><label class="mono-delete-all"><input type="checkbox" data-select-all> 全选</label><div class="mono-delete-list">${items.map((m,i)=>`<label class="mono-delete-choice"><input type="checkbox" data-message-index="${i}"><span><strong>${escapeForumHtml(m.sender==='user'?(forumSettings.userNickname||'我'):conv.name)}</strong><small>${escapeForumHtml(m.profile?'[分享主页] '+m.profile.name:m.forumPost?'[分享帖子] '+m.forumPost.authorName:m.sticker?'[表情包] '+m.sticker.name:m.image?'[图片]':m.content||'[消息]')}</small></span></label>`).join('')||'<p class="mono-note">暂无聊天记录</p>'}</div><button class="forum-sheet-primary" data-delete-messages disabled>删除所选</button>`);const checks=[...sh.querySelectorAll('[data-message-index]')],all=sh.querySelector('[data-select-all]'),submit=sh.querySelector('[data-delete-messages]');const update=()=>{const n=checks.filter(el=>el.checked).length;submit.disabled=!n;submit.textContent=n?'删除所选（'+n+'）':'删除所选';all.checked=n>0&&n===checks.length;all.indeterminate=n>0&&n<checks.length;};checks.forEach(el=>el.onchange=update);all.onchange=()=>{checks.forEach(el=>el.checked=all.checked);update();};submit.onclick=async()=>{submit.disabled=true;const selected=new Set(checks.filter(el=>el.checked).map(el=>items[Number(el.dataset.messageIndex)]));forumStopGeneration(conv.id);const first=(conv.messages||[]).findIndex(m=>selected.has(m));conv.messages=(conv.messages||[]).filter(m=>!selected.has(m));if(first>=0)conv.summaries=(conv.summaries||[]).filter(s=>Number.isFinite(s.through)&&s.through<=first);const last=conv.messages.at(-1);conv.lastMessage=last?.content||'';conv.lastMessageTime=last?.timestamp||0;conv.unread=Math.min(conv.unread||0,conv.messages.filter(m=>m.sender==='other').length);await forumSaveDMs();sh.remove();if(currentDMConversationId===conv.id)forumRenderChat(conv);showToast('已删除所选聊天记录');};}
const monoV84ChatSettings=forumOpenChatSettings;
forumOpenChatSettings=function(...args){monoV84ChatSettings(...args);const sh=document.getElementById('forumAuxSheet');if(!sh)return;sh.querySelector('[data-action="clear"]')?.insertAdjacentHTML('beforebegin','<button class="forum-sheet-row" data-select-messages>单选／多选删除聊天记录</button>');const button=sh.querySelector('[data-select-messages]');if(button)button.onclick=monoMessageDeletion;};
const monoV84PostMenu=monoPostMenu;
monoPostMenu=function(id,button){monoV84PostMenu(id,button);const sh=document.getElementById('forumAuxSheet');if(!sh||sh.querySelector('[data-delete-post]')||!forumPosts.some(p=>Number(p.id)===Number(id)))return;sh.querySelector('main').insertAdjacentHTML('beforeend','<button class="forum-sheet-row forum-clear" data-delete-post>删除帖子</button>');sh.querySelector('[data-delete-post]').onclick=async()=>{sh.remove();await deleteForumPost(id);};};
const monoV84DeletePost=deleteForumPost;
deleteForumPost=async function(id){monoOtherSeed=(monoOtherSeed||[]).filter(p=>Number(p.id)!==Number(id));await monoV84DeletePost(id);const quotes=document.getElementById('monoQuoteList');if(quotes){quotes.remove();}monoRefreshPostViews();};
Object.assign(ForumApp,{fetchNewRandomDMsInternal,renderDirectMessagesList,monoContactSettings,forumOpenChatSettings,monoPostMenu,deleteForumPost,monoConversationDeletion,monoClearNewConversations,monoMessageDeletion});

// MONO v8.5: search suggestions from actual generated posts, no new model prompt/call.
const monoGuessStop=new Set('今天 昨天 明天 刚刚 最近 现在 这个 那个 这些 那些 一个 一些 一点 一下 一直 真的 觉得 感觉 大家 自己 我们 你们 他们 她们 什么 怎么 为什么 还是 但是 而且 因为 所以 然后 如果 已经 没有 可以 可能 应该 就是 不是 不要 不能 知道 看到 看看 时候 事情 东西 这样 那样 这种 那种 这里 那里 有点 太多 好像 好的 谢谢 哈哈 哈哈哈 嗯嗯 其实 终于 确实 还有 只要 都是 不过 也是 只是 比较 继续 到底 起来 之前 之后 一起 一般 这么 那么 很多 多少 每次 不会 不用 需要 一定 直接 完全 所有 出来 回来 过去 用户 帖子 评论 回复 分享 图片 视频 内容 配图 原文 翻译 附图 附件 with this that have from they your about just really'.split(' '));
function monoGuessKey(s){return String(s||'').normalize('NFKC').replace(/^#/,'').trim().toLowerCase();}
function monoGuessSource(){const all=forumPosts.filter(p=>p.authorType!=='user'&&!p.isSearchResult&&!p.isRetweet);const marked=all.filter(p=>p.monoSearchBatch);if(marked.length){const batch=marked.reduce((a,p)=>Number(p.monoSearchBatchAt)>Number(a.monoSearchBatchAt)?p:a).monoSearchBatch;return marked.filter(p=>p.monoSearchBatch===batch);}return all.slice().sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,12);}
function monoGuessSuggestions(excluded=[]){const blocked=new Set(excluded.map(t=>monoGuessKey(t.tag))),terms=new Map(),source=monoGuessSource();const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('zh',{granularity:'word'}):null;
 for(const p of source){const text=String(p.monoOriginalContent||p.content||'').replace(/https?:\/\/\S+/g,'');const add=(tag,weight)=>{tag=tag.trim().replace(/^#/,'');const key=monoGuessKey(tag);if(key.length<2||key.length>24||blocked.has(key)||monoGuessStop.has(key)||/^\d+$/.test(key)||/^附[图录视照]/.test(tag))return;let t=terms.get(key);if(!t){t={tag,category:'猜你想搜',ids:new Set(),score:0};terms.set(key,t);}if(!t.ids.has(String(p.id))){t.ids.add(String(p.id));t.score+=weight;}};
 for(const m of text.matchAll(/#([\p{L}\p{N}_]{2,24})/gu))add(m[1],8);
 for(const m of text.matchAll(/[【「]([^】」\n]{2,18})[】」]/g))add(m[1],5);
 if(segmenter){for(const word of segmenter.segment(text))if(word.isWordLike)add(word.segment,1);}else{for(const m of text.matchAll(/[A-Za-z][A-Za-z0-9_-]{2,23}/g))add(m[0],1);}
 }
 return [...terms.values()].sort((a,b)=>b.score-a.score||b.ids.size-a.ids.size).slice(0,10).map(t=>({tag:t.tag,category:t.category,count:t.ids.size,postIds:[...t.ids]}));}
const monoV85Partition=monoTrendPartition;
monoTrendPartition=function(){const old=monoV85Partition();return {trending:old.trending,recommended:monoGuessSuggestions(old.trending)};};
function monoGuessSearch(topic){const key=monoGuessKey(topic),items=forumPosts.filter(p=>monoGuessKey(p.monoOriginalContent||p.content).includes(key));const feed=document.getElementById('forumFeed');if(!feed)return;currentHotView='search';document.querySelector('.forum-tabs').style.display='none';feed.innerHTML=`<div class="mono-guess-results"><header class="mono-page-header"><button data-guess-back aria-label="返回热点">${forumIcon('back')}</button><strong>${escapeForumHtml(topic)}</strong><span></span></header><p class="mono-note">${items.length} 条相关帖子</p>${items.map(renderForumPostItem).join('')||'<p class="mono-note">相关帖子已删除，请刷新首页后再试。</p>'}</div>`;feed.querySelector('[data-guess-back]').onclick=renderForumHot;}
const monoV85Hot=renderForumHot;
renderForumHot=function(...args){monoV85Hot(...args);const feed=document.getElementById('forumFeed');const tab=feed?.querySelector('[data-trend="for-you"]');if(tab)tab.textContent='猜你想搜';if(monoTrendTab!=='for-you')return;feed.querySelectorAll('[data-topic]').forEach(b=>b.onclick=()=>monoGuessSearch(b.dataset.topic));if(!feed.querySelector('[data-topic]')){const note=feed.querySelector('.mono-trends>.mono-note');if(note)note.textContent='生成首页帖子后，这里会出现相关搜索词。';}};
const monoV85Posts=generateForumPosts;
generateForumPosts=async function(...args){const before=new Map(forumPosts.map(p=>[String(p.id),p.content]));await monoV85Posts(...args);const fresh=forumPosts.filter(p=>p.authorType!=='user'&&!p.isSearchResult&&!p.isRetweet&&(!before.has(String(p.id))||before.get(String(p.id))!==p.content));if(fresh.length){const batch=crypto.randomUUID(),at=Date.now();fresh.forEach(p=>{p.monoSearchBatch=batch;p.monoSearchBatchAt=at;});await localforage.setItem('forumPosts',forumPosts);if(window.currentForumSection==='hot')renderForumHot();}};
Object.assign(ForumApp,{renderForumHot,generateForumPosts,monoTrendPartition,monoGuessSuggestions,monoGuessSearch});

// MONO v8.6: related topic discovery and opt-in in-page posting schedules.
let monoAutoUpdating=false,monoAutoFlight=false;
function monoInterval(value){return Math.max(1,Math.min(10080,Math.round(Number(value)||30)));}
function monoScheduleRow(prefix,label,opts){return `<label class="forum-setting-row"><span>${label}</span><input type="checkbox" data-${prefix}-enabled ${opts.enabled?'checked':''}></label><label class="forum-setting-row"><span>间隔时间</span><span class="mono-setting-value"><input type="number" min="1" max="10080" data-${prefix}-minutes value="${monoInterval(opts.minutes)}"> 分钟</span></label>`;}
function monoBindSchedule(root,prefix,opts,save){const enabled=root.querySelector('[data-'+prefix+'-enabled]'),minutes=root.querySelector('[data-'+prefix+'-minutes]');const change=async()=>{opts.enabled=enabled.checked;opts.minutes=monoInterval(minutes.value);minutes.value=opts.minutes;minutes.disabled=!opts.enabled;opts.nextAt=Date.now()+opts.minutes*60000;await save();};enabled.onchange=change;minutes.onchange=change;minutes.disabled=!opts.enabled;}
function monoAutoFeedOptions(){return forumSettings.monoAutoFeed ||= {enabled:false,minutes:30,nextAt:0};}
function monoAutoFeedSettings(){const opts=monoAutoFeedOptions(),sh=forumSheet('首页自动更新',monoScheduleRow('auto-feed','自动更新首页帖子',opts)+'<p class="mono-note">网页保持运行时按间隔更新。锁屏或系统暂停后，恢复时最多补一次。</p>');monoBindSchedule(sh,'auto-feed',opts,()=>localforage.setItem('forumSettings',forumSettings));}
const monoV86Settings=renderForumSettings;
renderForumSettings=function(...args){monoV86Settings(...args);if(monoContactOpen)return;const root=document.getElementById('forumSettingsContent');if(!root)return;root.insertAdjacentHTML('beforeend','<section class="forum-section mono-auto-feed-section"><div class="forum-section-title">首页自动更新</div>'+monoScheduleRow('auto-feed','自动更新帖子',monoAutoFeedOptions())+'<p class="mono-note">网页保持运行时执行；恢复后最多补一次更新。</p></section>');monoBindSchedule(root.querySelector('.mono-auto-feed-section'),'auto-feed',monoAutoFeedOptions(),()=>localforage.setItem('forumSettings',forumSettings));};
const monoV86RefreshMenu=monoRefreshMenu;
monoRefreshMenu=function(...args){monoV86RefreshMenu(...args);const sh=document.getElementById('forumAuxSheet');sh?.querySelector('main').insertAdjacentHTML('beforeend','<button class="forum-sheet-row" data-auto-settings>首页自动更新设置</button>');if(sh)sh.querySelector('[data-auto-settings]').onclick=monoAutoFeedSettings;};
const monoV86Contacts=renderDirectMessagesList;
renderDirectMessagesList=function(...args){monoV86Contacts(...args);const label=document.querySelector('.forum-dm-page .forum-dm-section-label');if(label)label.textContent='消息';};
const monoV86ContactSettings=monoContactSettings;
monoContactSettings=function(...args){monoV86ContactSettings(...args);const body=document.getElementById('monoContactBody'),pair=body?.querySelector('.forum-sheet-pair');if(pair){pair.className='mono-contact-actions';pair.querySelectorAll('button').forEach(b=>{b.className='forum-sheet-row';b.insertAdjacentHTML('beforeend','<span aria-hidden="true">›</span>');});}};
const monoV86ChatSettings=forumOpenChatSettings;
forumOpenChatSettings=function(...args){monoV86ChatSettings(...args);const conv=forumGetConv(),sh=document.getElementById('forumAuxSheet');if(!conv||!sh||!conv.id.startsWith('ai_'))return;const opts=forumDMOptions(conv).monoAutoPost ||= {enabled:false,minutes:60,nextAt:0};sh.querySelector('main').insertAdjacentHTML('beforeend','<section class="mono-auto-role-section"><h3>主动发帖</h3>'+monoScheduleRow('auto-post','主动发布帖子',opts)+'<p class="mono-note">按当前角色人设发布新帖子到首页，不自动发送私信。</p></section>');monoBindSchedule(sh.querySelector('.mono-auto-role-section'),'auto-post',opts,forumSaveDMs);};
const monoV86Partition=monoTrendPartition;
monoTrendPartition=function(){const old=monoV86Partition(),source=monoGuessSource(),topics=source.find(p=>Array.isArray(p.monoRelatedTopics))?.monoRelatedTopics;const blocked=new Set(old.trending.map(t=>monoGuessKey(t.tag)));return {trending:old.trending,recommended:(topics||old.recommended.map(t=>t.tag)).filter((s,i,a)=>!blocked.has(monoGuessKey(s))&&a.findIndex(x=>monoGuessKey(x)===monoGuessKey(s))===i).map(tag=>({tag,category:'本轮相关话题',count:''}))};};
monoGuessSearch=function(topic){return monoRun(()=>searchForumTopic(topic));};
const monoV86Hot=renderForumHot;
renderForumHot=function(...args){monoV86Hot(...args);const tab=document.querySelector('[data-trend="for-you"]');if(tab)tab.textContent='为你推荐';};
const monoV86Posts=generateForumPosts;
generateForumPosts=async function(...args){const before=new Set(forumPosts.map(p=>String(p.id)));await monoV86Posts(...args);const fresh=forumPosts.filter(p=>!before.has(String(p.id))&&p.authorType!=='user'&&!p.isSearchResult&&!p.isRetweet);if(!fresh.length)return;const done=monoGenerationStart('正在整理相关话题');try{const rows=await monoFeatureRequest('新增相关话题功能：根据下面这一轮已生成的帖子，延伸4至6个值得点进去继续讨论的话题。应是具体人物、事件、争议或生活问题的自然话题名，不是分类标签、零碎分词，不复制每篇帖子的标题。话题必须与提供的帖子有关，不凭空加入新的事实。返回JSON数组 [{"topic":"话题名"}]，每个名称2至24字。帖子：\n'+JSON.stringify(fresh.map(p=>({author:p.authorName,content:p.monoOriginalContent||p.content}))));const topics=rows.map(r=>String(r.topic||'').trim().replace(/^#/,'' )).filter(t=>t.length>=2&&t.length<=24);if(topics.length){for(const p of fresh)if(forumPosts.includes(p))p.monoRelatedTopics=topics.slice(0,6);await localforage.setItem('forumPosts',forumPosts);}}catch(e){console.warn('[MONO] 相关话题暂未更新');}finally{done();if(window.currentForumSection==='hot'&&!monoAutoUpdating)renderForumHot();}};
async function monoAutoTick(now=Date.now()){if(monoAutoFlight||monoBusy||forumDMTasks.size||monoFeatureFlights.size||monoGenerationCount)return;const config=getActiveApiConfig();if(!config?.url||!config?.key||!forumSettings.worldview)return;const feed=monoAutoFeedOptions(),dueFeed=feed.enabled&&Number(feed.nextAt)<=now;const conv=forumDirectMessages.find(c=>c.id.startsWith('ai_')&&c.chatOptions?.monoAutoPost?.enabled&&Number(c.chatOptions.monoAutoPost.nextAt)<=now);if(!dueFeed&&!conv)return;monoAutoFlight=true;monoAutoUpdating=true;try{await monoRun(async()=>{if(dueFeed){feed.nextAt=now+monoInterval(feed.minutes)*60000;await localforage.setItem('forumSettings',forumSettings);await generateForumPosts();}else{const opts=conv.chatOptions.monoAutoPost;opts.nextAt=now+monoInterval(opts.minutes)*60000;await forumSaveDMs();const id=conv.id.slice(3),p=forumSettings.aiParticipants.find(p=>String(p.charId)===id),c=forumCharacter(id);if(!c&&!p)return;const before=new Set(forumPosts.map(p=>p.id));await generateUserProfilePosts({type:'ai',id,name:p?.nickname||c?.remarkName||c?.realName||conv.name,handle:p?.handle||conv.handle,avatar:monoRoleAvatar(p,c,conv),fullPersona:getCharacterFullPersona(p||{charId:id}),monoBackground:true});for(const post of forumPosts)if(!before.has(post.id)){post.timestamp=Date.now();post.monoProactivePost=true;}await localforage.setItem('forumPosts',forumPosts);}});}catch(e){showToast('自动更新失败：'+e.message);}finally{monoAutoUpdating=false;monoAutoFlight=false;if(window.currentForumSection==='home'&&!document.querySelector('.forum-dm-chat')&&!document.getElementById('forumDetailOverlay')?.classList.contains('active'))renderForumFeed();}}
setInterval(()=>{monoAutoTick().catch(()=>{});},15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)monoAutoTick().catch(()=>{});});
Object.assign(ForumApp,{renderForumSettings,monoRefreshMenu,renderDirectMessagesList,monoContactSettings,forumOpenChatSettings,monoTrendPartition,monoGuessSearch,renderForumHot,generateForumPosts,monoAutoFeedSettings,monoAutoTick});

// MONO v8.7: sticker input, scoped media gestures and persistent text-image drafts.
forumStickers=function(roleId=null){const raw=roleId?forumCharacter(roleId)?.stickerGroups:null;const groups=(Array.isArray(raw)?raw:String(raw||'').split(/[,，;；\n]/)).map(x=>String(x).trim()).filter(Boolean);return structuredClone((forumNativeDb()?.myStickers||[]).filter(s=>s.name&&forumImageValue(s.data)&&(!groups.length||groups.includes(s.group||'未分类'))));};
const monoV87Send=sendDirectMessage;
sendDirectMessage=async function(){const conv=forumGetConv(),field=document.getElementById('dmInput'),text=field?.value.trim();if(!conv||!text)return;const explicit=text.match(/^\[表情包[:：]\s*(.*?)\]$/);const query=explicit?explicit[1]:text;const norm=s=>String(s).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');const pool=forumStickers();const candidate=forumDMOptions(conv).stickerMatch?forumResolveSticker(query,pool,true):null;const key=norm(query),name=candidate&&norm(candidate.name);if(candidate&&(explicit||key===name||Math.min(key.length,name.length)/Math.max(key.length,name.length)>=.65)){field.value='';forumDrafts.set(conv.id,'');return forumSendAttachment({sticker:{name:candidate.name,data:candidate.data},content:`[表情包：${candidate.name}]`});}return monoV87Send();};
const monoV87Chat=forumRenderChat;
forumRenderChat=function(conv){monoV87Chat(conv);const page=document.querySelector('.forum-dm-chat');if(!page)return;page.querySelectorAll('.forum-dm-sticker,.forum-dm-photo').forEach(img=>{img.draggable=false;let timer=null,start=null,shown=false;const cancel=()=>{clearTimeout(timer);timer=null;};const open=()=>{cancel();if(!img.isConnected||(shown&&document.querySelector('[data-media-view]')))return;shown=true;const sh=forumSheet('图片与表情包','<button class="forum-sheet-row" data-media-view>查看原图</button><button class="forum-sheet-row" data-media-delete>选择删除聊天记录</button>');sh.querySelector('[data-media-view]').onclick=()=>{sh.remove();showForumFullImage(img.src);};sh.querySelector('[data-media-delete]').onclick=()=>{sh.remove();monoMessageDeletion();};};img.addEventListener('pointerdown',e=>{if(e.button!==0)return;shown=false;start={x:e.clientX,y:e.clientY};cancel();timer=setTimeout(open,450);});img.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>10)cancel();});['pointerup','pointercancel','lostpointercapture'].forEach(type=>img.addEventListener(type,cancel));page.querySelector('.forum-dm-messages')?.addEventListener('scroll',cancel,{passive:true});img.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();open();});img.addEventListener('dragstart',e=>e.preventDefault());img.addEventListener('click',e=>{if(shown){e.preventDefault();e.stopPropagation();}});});};
monoTextImageEditor=function(index=null){if(index==null&&forumComposeImages.length>=4)return showToast('最多添加4张图片');const item=index==null?null:forumComposeImages[index];let cover=item?.data||monoTextCover;const sh=forumSheet(index==null?'添加文字图':'编辑文字图',`<button class="mono-text-cover" data-cover><img src="${escapeForumHtml(cover)}" alt="封面"><span>更换图片封面</span></button><div class="mono-cover-options" data-cover-options hidden><button class="forum-sheet-row" data-local-cover>从相册选择</button><input type="file" accept="image/*" data-cover-file hidden><label class="mono-field">图片链接<input data-cover-url type="url" placeholder="https://…"></label><button class="forum-sheet-row" data-apply-cover>使用图片链接</button></div><label class="mono-field">图片里的内容<textarea data-image-content rows="5" placeholder="写下这张图的文字或描述…">${escapeForumHtml(item?.card?.content||'')}</textarea></label><button class="forum-sheet-primary" data-save-card>保存文字图</button>`);const options=sh.querySelector('[data-cover-options]'),file=sh.querySelector('[data-cover-file]');const update=src=>{const value=forumImageValue(src);if(!value)return showToast('请选择图片或填写有效图片链接');cover=value;sh.querySelector('[data-cover] img').src=value;options.hidden=true;};sh.querySelector('[data-cover]').onclick=()=>{options.hidden=!options.hidden;};sh.querySelector('[data-local-cover]').onclick=()=>file.click();file.onchange=async()=>{try{if(file.files[0])update(await forumReadFile(file.files[0]));}catch(e){showToast(e.message);}finally{file.value='';}};sh.querySelector('[data-apply-cover]').onclick=()=>update(sh.querySelector('[data-cover-url]').value.trim());sh.querySelector('[data-save-card]').onclick=()=>{const content=sh.querySelector('[data-image-content]').value.trim();if(!content)return showToast('请填写图片内容');const card={data:cover,card:{content}};if(index==null)forumComposeImages.push(card);else forumComposeImages[index]=card;renderComposeImages();sh.remove();};};
Object.assign(ForumApp,{forumStickers,sendDirectMessage,forumRenderChat,monoTextImageEditor});

})();
