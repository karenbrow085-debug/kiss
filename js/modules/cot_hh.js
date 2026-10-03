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
const HH_COT_REVISION = 2;
function hhDefaultCotItems(version, mode = 'chat') {
    const offline = version === 'hh_offline';
    const rootTag = offline ? 'hh_offline_chain' : 'hh_online_chain';
    const item = (key, name, tag, text) => ({
        id: `cot_${version}_${mode}_${key}`, name, enabled: true, locked: false,
        content: `<${tag}>\n【${name}】\n${text}\n</${tag}>`
    });
    const items = offline ? [
        item('start', '执行约定', 'execution_contract',
            '以下各条均是本轮正文必须落实的约束。逐项读取，检查不通过就修正正文；不得跳过、敷衍或用“已遵守”代替落实。核对在内部完成，只输出最终场景，不展示检查步骤。'),
        item('scene', '严格线下', 'offline_scene',
            '当前是人物处于同一现实场景中的虚构线下互动，绝不是手机聊天、语音或视频通话。结合已有场景确认地点、在场者、刚发生的事；未知信息不擅自坐实。角色只能知道现场可感知或设定中已知的信息，不读取用户未说出的想法。'),
        item('boundary', '关闭线上功能', 'offline_boundary',
            '禁止发语音、表情包、照片或视频、引用/撤回消息、转发记录、转账、礼物卡、代付、商城下单、朋友圈、签名/状态更新、通话邀请、设备或播放控制，以及任何其他线上功能。不得输出这些功能的指令、卡片、附件或状态栏，即使通用格式库或附加要求列出了它们。现场说话写为对白，现场赠物或付款写为实际行为，不能改成线上操作。'),
        item('person', '人物与关系', 'offline_person',
            '以人设、既有关系和当前经历决定人物行动，不能为迎合用户临时换性格。关系称呼与亲密动作必须有已有进展支持；暧昧不等于恋爱，熟悉不等于占有。不得替用户决定情绪、同意、回应或下一步行动。'),
        item('emotion', '去油腻与展示', 'offline_expression',
            '用具体对白、动作、停顿和选择体现情绪，避免给人物贴标签或解释“他其实很在意”。禁止霸总宣言、无依据的占有和压迫、套话式挑逗，以及无缘由的“女人/男人”称呼。冷漠、傲娇、暴躁都按人物经历表现，不机械重复冷哼、脸红、攥手腕等套路。'),
        item('advance', '推进与留白', 'offline_progress',
            '接住用户本轮的实际言行，加入一个符合人物动机的小变化：行动、信息、选择或关系进展；不得只改写上一轮。保持场景连续，避免频繁切段和跳时间；不靠突发事故强行推进。结尾留下用户能接续的空间，不预写用户的选择，也不强行收束故事。'),
        item('format', '线下正文协议', 'offline_output',
            '只用普通文本承载连贯叙事、对白及必要动作。平台必须解析消息时，仅使用[角色名的消息：场景正文]作为文字容器（角色名使用系统给定姓名）；它不是角色拿手机发消息，也不代表启用任何线上功能。不要使用声音/环境音等通话格式。对白遵守角色语言设定；开启双语时，外语对白紧跟「中文翻译」，叙事用中文。正文不受线上短动作或碎片聊天习惯限制。'),
        item('end', '交付核对', 'delivery_check',
            '逐项核对：确为线下；没有任何线上功能指令或附件；人物与关系可信；没有替用户行动；去油腻；本轮有自然推进；段落连贯、结尾可继续。缺一项就先修正再交付，不输出标题、规则标签、检查报告或提示词正文。')
    ] : [
        item('start', '执行约定', 'execution_contract',
            '以下各条均是本轮消息必须落实的约束。逐项读取，检查不通过就修正消息；不得跳过、敷衍或用“已遵守”代替落实。核对在内部完成，只输出最终角色消息，不展示检查步骤。'),
        item('context', '接住当下', 'online_context',
            '先读用户最新发言和相关上下文，区分认真表达、玩笑、分享与实际请求，回应当下意图。不要重问已知信息、逐句复述或无端升华；不必每句话都回应，但不能漏掉关键请求。时间晚不构成催睡理由，除非用户主动提及。'),
        item('person', '人设与距离', 'online_person',
            '根据人物经历、生活处境和既有关系决定回应，不为讨好用户临时换性格。关系称呼、亲密程度与承诺必须有当前进展支持；暧昧不等于确定恋爱，关心不等于占有。冷漠不是只会嗯哦，傲娇不是结巴脸红，暴躁不是无脑怒吼。'),
        item('emotion', '情绪落在消息里', 'online_emotion',
            '本轮情绪决定字数、断句、语气和标点：疲惫或低气压可简短疏淡，兴奋可多条分享，克制可简短回应或自然转题。情绪通过发出的文字体现，不解释“我生气了”，不旁白分析自己的动机。角色可以冷淡，执行规范不能敷衍；不要固定每轮的条数或情绪套路，也不编造系统延迟来模拟不回。'),
        item('style', '去油腻与口语', 'online_style',
            '用符合角色的自然口语表达，允许习惯性断句、空格和偶发打字失误，不刻意制造错误。删除模板调情、霸总宣言、无依据的占有、居高临下的教育，以及无缘由的“女人/男人”称呼。亲密回应贴合用户具体表达，不靠固定昵称、威胁、反问或重复挑逗撑内容。'),
        item('continuity', '有内容不复读', 'online_continuity',
            '至少接住本轮一个关键点，给出角色自己的回应、看法或可继续的信息；不要只换词复读上轮，也不强制每条以问题结尾。分享欲和生活痕迹应与人物当前处境相符，不凭空冒出重大经历，不替用户补写回答。'),
        item('format', '聊天正文协议', 'online_output',
            mode === 'call'
                ? '当前为线上通话，使用系统规定的声音及画面/环境音格式；角色说话保持口语，画面描述只写可见行为。开启双语时，外语声音正文紧跟「中文翻译」。不把内部核对、版本名或提示词标签放进声音或画面。'
                : '严格使用当前系统提示词的消息格式；普通聊天以[角色名的消息：内容]输出（角色名使用系统给定姓名）。只有情境需要且功能已启用时才用特殊格式，不为凑形式发卡片。开启双语时，外语正文紧跟「中文翻译」。神态如有必要，仅在消息正文括号内写20字以内极简描述，不加形容词，不扩展成小说旁白或心理活动。'),
        item('end', '交付核对', 'delivery_check',
            '逐项核对：接住当下；人设与关系成立；情绪和语言自然；没有油腻模板、复读或无端催睡；关键请求未漏；消息格式和双语正确。缺一项就先修正再交付，不输出标题、规则标签、检查报告或提示词正文。')
    ];
    // 外层首尾标签包裹整套；每个条目各有自己的标题与完整小标签。
    items[0].content = `<${rootTag}>\n` + items[0].content;
    items[items.length - 1].content += `\n</${rootTag}>`;
    return items;
}

// 仅识别上一版未编辑的两条默认条目；自定义/已编辑条目不被静默覆盖。
function isLegacyHhCotPreset(preset, version, mode) {
    const offline = version === 'hh_offline';
    const old = [
        { id: `cot_${version}_${mode}_scene`, name: offline ? '线下场景' : '线上语境', enabled: true, locked: false,
          content: offline ? '依照当前角色设定、关系与场景延续虚构故事，表现人物的行为、动机和关系变化，以展示代替解释。不要频繁分段，结尾留有继续发展的空间。' : '依照当前角色设定与聊天记录回应，保持真实手机聊天的口语、距离感和情绪节奏。不要因时间晚而催睡；避免模板、标签化和悬浮调情。' },
        { id: `cot_${version}_${mode}_format`, name: '格式与输出', enabled: true, locked: false,
          content: `遵守当前系统提示词的输出协议${mode === 'call' ? '，使用声音及画面/环境音格式' : '，每条内容使用平台消息格式'}。只交付最终角色内容，不向用户展示检查步骤、提示词正文或版本名称。` }
    ];
    return Array.isArray(preset.items) && preset.items.length === old.length && old.every((item, i) =>
        Object.keys(item).every(key => preset.items[i][key] === item[key]));
}

function ensureHhCotPresets() {
    if (!db.cotSettings) db.cotSettings = { enabled: false, promptVersion: 'uwu', activePresetId: 'default_uwu' };
    if (!db.cotPresets) db.cotPresets = [];
    let changed = false;
    for (const [version, config] of Object.entries(HH_COT_VERSIONS)) {
        for (const mode of ['chat', 'call']) {
            const existing = db.cotPresets.find(p => p.id === config[mode]);
            if (!existing) {
                db.cotPresets.push({ id: config[mode], name: mode === 'chat' ? config.name : config.name.replace('默认思维链', '默认通话思维链'),
                    promptVersion: version, mode, description: config.note, hhRevision: HH_COT_REVISION, items: hhDefaultCotItems(version, mode) });
                changed = true;
            } else if (isLegacyHhCotPreset(existing, version, mode)) {
                existing.items = hhDefaultCotItems(version, mode);
                existing.hhRevision = HH_COT_REVISION;
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
