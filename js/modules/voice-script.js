/* Speech directions belong in the chat prompt; only speech reaches TTS. */
(() => {
'use strict';
const S=window.KissVoiceService;
const example='保持角色原本性格，用日常口语、自然停顿与简短语气词回应。情绪随对话变化，平静时不要硬加笑声。亲密互动可轻声说话，偶尔轻笑；只有双方正在亲吻的情境才加入简短的“啵”或“Mwah”，不要每句都亲亲。外语台词保持角色母语，中文翻译仅供阅读。';
const emotions={开心:['happy','happy'],难过:['sad','sad'],生气:['angry','angry'],惊讶:['surprised','surprised'],平静:['calm','calm'],害怕:['scared','fearful'],厌恶:['disgusted','disgusted'],兴奋:['excited','happy'],温柔:['soft tone','calm'],害羞:['embarrassed','calm'],低语:['whispering','calm']};
const sounds={轻笑:['chuckling','chuckle'],笑:['laughing','laughs'],叹气:['sighing','sighs'],吸气:['inhale','inhale'],呼气:['exhale','exhale'],呼吸:['breath','breath'],喘气:['panting','pant'],清嗓:['clear throat','clear-throat']};
function books(ids){return (ids||[]).map(id=>(typeof db!=='undefined'?db.worldBooks:[])?.find(b=>String(b.id)===String(id))).filter(Boolean).map(b=>b.content||'').join('\n');}
function rules(charId,settings=S.settings()){const b=settings.bindings[charId]||{};return [settings.speechRules,books(settings.speechBookIds),b.speechRules,books(b.speechBookIds)].filter(Boolean).join('\n');}
function directionPrompt(chat,type='private'){
 const settings=S.settings();if(!settings.enabled)return '';
 const chars=type==='group'?(chat.members||[]).map(m=>({...m,id:m.originalCharId||m.id})): [chat];
 const blocks=chars.map(c=>{const b=settings.bindings[c.id]||{};if(b.disabled)return '';const r=rules(c.id,settings);return r.trim()?`【${c.realName||c.name||'角色'}的语音世界书】\n${r}`:'';}).filter(Boolean);
 if(!blocks.length)return '';
 return '\n\n【语音表演规范，只作用于语音/通话声音】\n'+blocks.join('\n')+'\n遵守既有角色人格及消息外框；不要把世界书本身、舞台动作或情绪名称作为台词朗读。不要求每次回复都发语音。需要语音时，在语音内容中使用以下控制格式：句首可写（语气：开心/难过/生气/惊讶/平静/害怕/厌恶/兴奋/温柔/害羞/低语），全句仅选一种；按需在台词中加入（轻笑）、（笑）、（叹气）、（吸气）、（呼气）、（呼吸）、（喘气）、（清嗓），停顿用（停顿：0.3）。不要写方括号控制标签，以免与消息外框冲突。亲吻不使用不存在的音效标签，按角色母语与剧情写简短拟声词，如啵/Mwah，不要把“亲吻”动作描述放进台词。双语语音/声音统一写：外语原文「中文翻译」；中文翻译仅供显示，不属于台词；角色主动说中文时仍保留中文台词。不得把规则或控制标记放入译文。';
}
function extractMessage(content){const t=String(content||''),m=t.match(/\[[^\[\]\n]*?的(?:语音|声音)[：:]/);if(!m)return t;const start=m.index+m[0].length;let depth=1;for(let i=start;i<t.length;i++){if(t[i]==='[')depth++;if(t[i]===']'&&!--depth)return t.slice(start,i);}return t.slice(start);}
function stripTranslation(value,bilingual=false){let text=String(value||'').trim();
 // Explicit labels are safe even without a bilingual setting.
 text=text.replace(/(?:\n|\|\|)\s*(?:中文翻译|翻译|译文|translation)\s*[：:][\s\S]*$/i,'');
 const foreign=t=>/[A-Za-z\u3040-\u30ff\uac00-\ud7af\u0400-\u052f\u0600-\u06ff]/u.test(t.replace(/[（(][^）)]*[）)]/g,''));
 text=text.replace(/([^「」\n]*)「([^「」]+)」/g,(whole,original,translated)=>original.trim()&&(bilingual||foreign(original))&&/[\u3400-\u9fff]/u.test(translated)?original:whole);
 let changed=true;while(changed){changed=false;const match=text.match(/^(.*?)「([^「」]+)」\s*$/s);if(match&&match[1].trim()&&(bilingual||foreign(match[1]))&&/[\u3400-\u9fff]/u.test(match[2])){text=match[1].trim();changed=true;}}
 // Legacy parenthetical translations only when foreign original + Chinese translation.
 const old=text.match(/^(.*?)[（(]([^（）()]+)[）)]\s*$/s);if(old&&foreign(old[1])&&/[\u3400-\u9fff]/u.test(old[2])&&!/^(?:语气|停顿)[：:]/.test(old[2])&&!sounds[old[2]])text=old[1].trim();
 return text;
}
function prepare(profile,value,{bilingual=profile.bilingualModeEnabled||false}={}){
 const p={...profile};let text=stripTranslation(extractMessage(value),bilingual),emotion='';
 const fish=p.family==='fish',s1=String(p.model)==='s1',mini28=/^speech-2\.8-/.test(p.model);
 const tag=x=>s1?`(${x})`:`[${x}]`;
 text=text.replace(/[（(]语气[：:]([^）)]+)[）)]/g,(_,name)=>{const e=emotions[name.trim()];if(!e)return '';if(fish)return tag(e[0]);if(!emotion)emotion=name.trim()==='低语'&&/^speech-2\.6-/.test(p.model)?'whisper':e[1];return '';});
 text=text.replace(/[（(]停顿[：:]([\d.]+)[）)]/g,(_,n)=>{const seconds=Number(n);if(!Number.isFinite(seconds)||seconds<0.01||seconds>5)return '';return fish?tag(seconds>=1?'long-break':'break'): `<#${seconds}#>`;});
 text=text.replace(/[（(]([^（）()]+)[）)]/g,(whole,name)=>{const sound=sounds[name.trim()];if(!sound)return whole;if(fish&&s1&&['吸气','呼气','呼吸'].includes(name.trim()))return '';return fish?tag(sound[0]):mini28?`(${sound[1]})`:'';});
 // Prevent common unsupported stage directions becoming spoken words.
 text=text.replace(/[（(](?:动作|表情|旁白)[：:][^）)]*[）)]/g,'');
 if(emotion)p.emotion=emotion;
 text=text.replace(/^[“"]|[”"]$/g,'').trim();
 if(!text.replace(/\[[^\]]*\]|\([^)]*\)|<#.*?#>/g,'').trim())throw new Error('没有可朗读的台词；请保留原文。');
 return {profile:p,text};
}
window.KissVoiceScript={example,rules,directionPrompt,extractMessage,stripTranslation,prepare};
})();
