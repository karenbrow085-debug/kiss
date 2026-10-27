/* Stored translations only. Rendering and toggling never make model requests. */
(() => {
'use strict';
function needs(text){const s=String(text||'');return /[\u3040-\u30ff\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff]/u.test(s)||/[嘅咗佢哋唔喺冇啱咩嚟嗰乜咁嘢畀睇攰瞓餸嘥]/u.test(s)||/鍾意|钟意|多謝|唔該|早唞/.test(s)||((s.match(/\b[A-Za-zÀ-ž]{2,}\b/gu)||[]).length>=3||/[A-Za-zÀ-ž]/u.test(s)&&!/[\u3400-\u9fff]/u.test(s));}
function extract(content,translation=''){let text=typeof content==='string'?content.trim():'',trans=typeof translation==='string'?translation.trim():'';const m=text.match(/^([\s\S]+?)\s*「([^「」]+)」\s*$/);if(m&&needs(m[1])&&/[\u3400-\u9fff]/u.test(m[2])){text=m[1].trim();if(!trans)trans=m[2].trim();}return {content:text,translation:trans};}
function complete(content,translation,required=false){if(content!=null&&typeof content!=='string')throw Error('动态或评论正文格式不正确');const out=extract(content,translation);if(out.content&&(required||needs(out.content))&&!out.translation)throw Error('模型未同时返回外语/粤语的中文译文，本条未发布；不会额外调用翻译');return out;}
function promptFor(c){if(c?.momentsEnabled===false)return '';return '\n<朋友圈语言>朋友圈正文和评论必须使用角色原本语言；开启双语模式时也必须同时附中文译文；若使用外语或粤语，同一次输出必须附自然的普通话中文译文，不得为了省略译文而改用普通话。普通404动态/评论指令的正文内用 原文「中文译文」 一起输出。译文仅作界面切换，不是角色另发的一条消息。</朋友圈语言>\n';}
window.KissMomentsLanguage={needs,extract,complete,promptFor};
})();
