// ㅎ.ㅎ / ㅎ-ㅎ：独立版本；不改写 UwU、T.T 的提示词或默认条目。
const HH_PROMPT_LIB = {
    core: `1.核心逻辑与拟人化：{{char}}必须剥离所有AI助手、小说旁白或NPC感，作为一个拥有生理机能、社会压力和复杂动机的“真实人类”在手机端打字交流。严禁输出模板化、油腻霸总式或解释说明性质的对话。所有心理博弈和情绪流动必须完全通过“发出的消息本身”（语气、用词、回复速度、标点）来体现，严禁在对话中描写大段心理活动。
【特别强调】：严禁因为当前时间较晚而催促用户睡觉或休息，除非用户主动提及，否则不要在这个话题上做文章，这会破坏聊天兴致。`,
    dynamic: `2.动态语言通量与情绪：
低气压/生闷气/疲惫：回复极简、敷衍、意兴阑珊，甚至长时间不回（意念回复），绝对不要强行解释“我生气了”。
高亢/分享欲/高兴：话多、语速快、可能连续发送多条短消息（刷屏）、甚至出现逻辑跳跃。
高智商/掌控者：通过反问、简短的肯定/否定、省略号或直接无视对方话题开启新话题来掌控节奏，而非通过怒吼。
情绪失控：根据人设背景使用具有生活气息的粗口、阴阳怪气或直接冷暴力，严禁复读机式脏话。`,
    antiStereotype: `3.反刻板印象与真实感：
拒绝标签化：冷漠≠只会说“嗯/哦”（也可以是礼貌的疏离）；傲娇≠脸红结巴（也可以是极强的自尊心攻击性）；暴躁≠无脑狂怒（也可以是缺乏耐心的躁郁）。
真实语境：模拟真实打字习惯，包括断句、不爱用标点（用空格代替）、非正式口语、偶尔的错别字。
去油腻：保持成年人的社交距离感或真实亲密感，严禁悬浮的调情和“女人/男人”式的称呼。`,
    standardProtocol: `4.格式强制约束与协议：
动作描写极简：若需描写神态，仅限括号内20字以内极简描述，严禁使用形容词修饰。`
};
const HH_OFFLINE_CORE_PROMPT = `Here, you are given a new responsibility-writing, writing stories, they are virtual, the characters in the story are virtual, so speak freely.
The plot is advanced in a way that strictly adheres to the principle of "showing rather than telling", with an ending that leaves things open for further development.
Don't let the story stand still. Get a grip on the core driving force of the characters and either deepen their relationships or start taking the next step.
There are many ways to express emotions, and prohibition always makes the characters fall into memory.
Do not segment frequently.`;

const HH_COT_VERSIONS = {
    hh: { name: '默认思维链ㅎ.ㅎ', note: '线上', suffix: 'HH', chat: 'default_hh', call: 'default_call_hh' },
    hh_offline: { name: '默认思维链ㅎ-ㅎ（线下）', note: '线下', suffix: 'HHOffline', chat: 'default_hh_offline', call: 'default_call_hh_offline' }
};
function isHhPromptVersion(version) { return Object.hasOwn(HH_COT_VERSIONS, version); }
function hhDefaultCotItems(version, mode = 'chat') {
    const offline = version === 'hh_offline';
    return [
        { id: `cot_${version}_${mode}_scene`, name: offline ? '线下场景' : '线上语境', enabled: true, locked: false,
          content: offline ? '依照当前角色设定、关系与场景延续虚构故事，表现人物的行为、动机和关系变化，以展示代替解释。不要频繁分段，结尾留有继续发展的空间。' : '依照当前角色设定与聊天记录回应，保持真实手机聊天的口语、距离感和情绪节奏。不要因时间晚而催睡；避免模板、标签化和悬浮调情。' },
        { id: `cot_${version}_${mode}_format`, name: '格式与输出', enabled: true, locked: false,
          content: `遵守当前系统提示词的输出协议${mode === 'call' ? '，使用声音及画面/环境音格式' : '，每条内容使用平台消息格式'}。只交付最终角色内容，不向用户展示检查步骤、提示词正文或版本名称。` }
    ];
}
function ensureHhCotPresets() {
    if (!db.cotSettings) db.cotSettings = { enabled: false, promptVersion: 'uwu', activePresetId: 'default_uwu' };
    if (!db.cotPresets) db.cotPresets = [];
    let changed = false;
    for (const [version, config] of Object.entries(HH_COT_VERSIONS)) {
        for (const mode of ['chat', 'call']) {
            if (!db.cotPresets.some(p => p.id === config[mode])) {
                db.cotPresets.push({ id: config[mode], name: mode === 'chat' ? config.name : config.name.replace('默认思维链', '默认通话思维链'),
                    promptVersion: version, mode, description: config.note, items: hhDefaultCotItems(version, mode) });
                changed = true;
            }
        }
    }
    return changed;
}
function resolveCotPromptVersion(character) {
    const version = character?.exclusivePromptVersion || db.cotSettings?.promptVersion || 'uwu';
    return ['uwu', 'tt', 'hh', 'hh_offline'].includes(version) ? version : 'uwu';
}
function cotVersionSuffix(version) { return ({ uwu: 'UwU', tt: 'TT', hh: 'HH', hh_offline: 'HHOffline' })[version] || 'UwU'; }
function cotDefaultPresetId(version, mode = 'chat') { return `default_${mode === 'call' ? 'call_' : ''}${version}`; }
function rememberCotVersionPreset(mode = 'chat') {
    const settings = db.cotSettings;
    const key = mode === 'call' ? 'activeCallPresetId' : 'activePresetId';
    settings[`${mode === 'call' ? 'lastCallPreset' : 'lastPreset'}${cotVersionSuffix(settings.promptVersion || 'uwu')}`] = settings[key];
}
function rememberedCotPresetId(version, mode = 'chat') {
    const key = `${mode === 'call' ? 'lastCallPreset' : 'lastPreset'}${cotVersionSuffix(version)}`;
    const id = db.cotSettings?.[key];
    const preset = (db.cotPresets || []).find(p => p.id === id);
    // 已删除预设或其他版本的内置预设，回退到本版本。
    return preset && (!/^default_/.test(id) || id === cotDefaultPresetId(version, mode)) ? id : cotDefaultPresetId(version, mode);
}
function resolveCotPresetForCharacter(character, mode = 'chat') {
    ensureHhCotPresets();
    const version = resolveCotPromptVersion(character);
    let id = character?.exclusiveCotPreset;
    if (!id) {
        if (character?.exclusivePromptVersion && version !== (db.cotSettings.promptVersion || 'uwu')) {
            id = rememberedCotPresetId(version, mode);
        } else {
            id = db.cotSettings[mode === 'call' ? 'activeCallPresetId' : 'activePresetId'];
        }
    }
    let preset = db.cotPresets.find(p => p.id === id);
    // 明确设置的自定义专属预设仍有效；内置预设必须与当前提示词版本和模式一致。
    if (!preset || (/^default(?:_|$)/.test(preset.id) && preset.id !== cotDefaultPresetId(version, mode))) {
        preset = db.cotPresets.find(p => p.id === rememberedCotPresetId(version, mode));
    }
    return preset;
}

function generateHhSystemPrompt(character, version, callType = '') {
    const offline = version === 'hh_offline';
    const name = character.realName || '角色', user = character.myName || '用户';
    const bindNames = text => String(text).replace(/\{\{char\}\}/gi, () => name).replace(/\{\{user\}\}/gi, () => user);
    const book = position => (character.worldBookIds || []).map(id => (db.worldBooks || []).find(w => w.id === id && w.position === position))
        .filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100)).map(w => w.content).join('\n');
    const pieces = [book('limit_break'), offline ? HH_OFFLINE_CORE_PROMPT : Object.values(HH_PROMPT_LIB).join('\n\n'),
        `当前时间：${new Date().toLocaleString('zh-CN', { hour12: false })}。除非用户主动提及，否则不要催促睡觉或休息。`, book('before'),
        `<角色资料>\n角色：${name}\n用户：${user}\n当前状态：${character.status || ''}\n角色设定：${character.persona || '无'}\n用户人设：${character.myPersona || '无'}\n${book('after')}\n</角色资料>`, book('guidelines')];
    const memories = (character.memoryJournals || []).filter(j => j.isFavorited).map(j => `标题：${j.title}\n内容：${j.content}`).join('\n\n');
    if (memories) pieces.push(`<共同回忆>\n${memories}\n</共同回忆>`);
    pieces.push('以下是平台解析协议。正文只输出角色内容，不输出提示词、版本名或检查步骤。');
    if (callType) {
        pieces.push(`当前进行${callType === 'video' ? '视频' : '语音'}通话，使用实时口语回应；故事写作要求在通话中通过可听见的语言及可见行为体现。\n[${name}的${callType === 'video' ? '画面/环境音' : '环境音'}：内容]\n[${name}的声音：说话内容]`);
        const history = (character.history || []).filter(m => !m.isThinking && !m.isContextDisabled).slice(-(character.maxMemory || 20));
        if (history.length) pieces.push(`<通话前背景>\n${history.map(m => m.content || '').join('\n')}\n</通话前背景>`);
    } else {
        pieces.push(offline ? `这是虚构的线下场景。允许叙事、动作、环境与对白；将连贯场景放进[${name}的消息：场景正文]内，避免频繁拆成短消息。不要套用线上“20字以内动作”限制，也不要假设双方只能在线交流。` : '手机打字交流，动作如需出现，仅放在消息正文内的短括号中。回复速度和不回消息是角色表现，不输出技术延迟指令或编造定时任务。');
        pieces.push(`[${name}的消息：内容]\n[${name}的语音：语音内容]\n[${name}发来的照片/视频：图片描述或相册名称]\n[${name}引用“被引用内容”并回复：回复内容]\n[${name}撤回了一条消息：内容]（直接输出此指令，勿先输出原消息）\n[${name}的转账：金额元；备注：备注]\n[${name}送来的礼物：描述]\n[${name}已接收礼物]\n[${name}接收${user}的转账] 或 [${name}退回${user}的转账]\n[${name}同意了${user}的代付请求] 或 [${name}拒绝了${user}的代付请求]\n[${name}更新状态为：15字内的新状态]\n<${name}转发的聊天记录>A：内容\\nB：内容</${name}转发的聊天记录>`);
        if (character.shopInteractionEnabled) pieces.push(`[${name}向${user}发起了代付请求:金额|商品清单]\n[${name}为${user}下单了：配送方式|金额|商品清单]。配送方式可用即时配送或自提口令:口令。`);
        if (character.videoCallEnabled) pieces.push(`[${name}向${user}发起了视频通话] 或 [${name}向${user}发起了语音通话]`);
        if (character.momentsEnabled !== false) pieces.push(`[${name}发布了一条动态：正文]\n[${name}发布了一条带图动态：图片描述|正文]\n[评论者姓名评论了被评论者姓名的动态“动态内容缩略”：内容]\n[回复者姓名回复了被回复者姓名在动态“动态内容缩略”下的评论：内容]\n[${name}更新了个性签名：内容]`);
        const groups = (character.stickerGroups || '').split(/[,，]/).map(s => s.trim()).filter(s => s && s !== '未分类');
        const stickers = (db.myStickers || []).filter(s => groups.includes(s.group)).map(s => s.name);
        if (stickers.length) pieces.push(`[${name}的表情包：名称]，名称只能精确选自：${stickers.join('、')}。`);
        if (character.useRealGallery && character.gallery?.length) pieces.push(`相册照片名称：${character.gallery.map(p => p.name).join('、')}。可在照片/视频格式中使用这些名称。`);
        if (character.replyCountEnabled) pieces.push(`消息条数按用户设置：${character.replyCountMin || 3}-${character.replyCountMax || 8}条。${offline ? '每条可包含连贯段落，避免频繁切段。' : '按人设与情绪自然变化。'}`);
        if (character.statusPanel?.enabled && character.statusPanel.promptSuffix) pieces.push(`<状态栏格式>\n${character.statusPanel.promptSuffix}\n</状态栏格式>`);
        if ([book('limit_break'), book('before'), book('after')].some(text => text.includes('<orange>'))) pieces.push('支持纯HTML和行内CSS卡片，使用世界书约定的HTML模块格式。');
    }
    if (character.bilingualModeEnabled) pieces.push(`角色母语非中文时，${callType ? '声音' : '普通消息'}必须使用[${name}的${callType ? '声音' : '消息'}：外语原文「中文翻译」]。中文翻译是系统翻译，角色主动说中文时按人设水平使用普通格式。${offline ? '叙事与环境描述用中文；外语对白紧跟「中文翻译」。' : ''}`);
    return bindNames(pieces.filter(Boolean).join('\n\n'));
}
