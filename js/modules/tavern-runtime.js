/* Independently implemented adapter between 404 history and SillyTavern preset data. */
(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) module.exports = factory;
    else root.KissTavernRuntime = factory({
        getDb: () => db,
        getEngine: () => root.KissTavernEngine,
        report: message => console.warn('[酒馆预设]', message)
    });
})(typeof window === 'object' ? window : globalThis, function createTavernRuntime(env) {
    'use strict';
    const copy = value => JSON.parse(JSON.stringify(value));
    const warningsShown = new Set();
    const sampleKeys = ['temperature', 'frequency_penalty', 'presence_penalty', 'top_p', 'top_k', 'top_a', 'min_p', 'typical_p', 'repetition_penalty', 'seed', 'n', 'max_tokens', 'max_completion_tokens', 'stop', 'logit_bias', 'reasoning_effort', 'verbosity', 'stream'];
    const api = { isEnabled, prepare, lastReport: null, normalizeHistory };

    function isEnabled(chatType = 'private', offline = false) {
        return offline === true && chatType === 'private' && env.getDb()?.tavernSettings?.enabled === true;
    }

    function normalizeHistory(history) {
        return (history || []).filter(message => message && !message.isContextDisabled && !message.isThinking && !message.offlineHidden && !message.offlineBoundary && !['mcp-activity', 'mcp-request'].includes(message.type))
            .filter(message => ['user', 'assistant', 'system', 'tool'].includes(message.role))
            .map(message => {
                let content = message.content;
                if (Array.isArray(message.parts) && message.parts.length) {
                    content = message.parts.map(part => {
                        if (part.type === 'text' || part.type === 'html') return { type: 'text', text: String(part.text || '') };
                        if (part.type === 'image' && part.data) return { type: 'image_url', image_url: { url: part.data } };
                        if (part.type === 'image_url' && part.image_url) return copy(part);
                        return null;
                    }).filter(Boolean);
                }
                if (message.quote && message.role === 'user') {
                    const quoted = typeof message.quote.content === 'string' ? message.quote.content : '';
                    if (quoted) {
                        const context = '[引用消息：' + quoted + ']\n';
                        if (Array.isArray(content)) content = [{ type: 'text', text: context }, ...content];
                        else content = context + (content || '');
                    }
                }
                const result = { role: message.role, content: typeof content === 'string' || Array.isArray(content) ? copy(content) : String(content || '') };
                for (const key of ['name', 'tool_call_id', 'tool_calls']) if (message[key] !== undefined) result[key] = copy(message[key]);
                return result;
            });
    }

    function selected(chat) {
        const database = env.getDb();
        const setting = database.tavernSettings || {};
        const preset = (database.tavernPresets || []).find(item => item.id === (chat?.offline?.draft?.tavernPresetId || setting.activePresetId));
        if (!preset) throw Error('请在线下设置选择一份预设；当前选择的酒馆预设不存在。');
        if (preset.format !== 'chat-completion') throw Error('这份是文本补全采样器预设，不能直接用于 404 的聊天补全 API；可保留、编辑和导出。');
        return { preset, setting, database };
    }

    function text(message) {
        return typeof message.content === 'string' ? message.content : (message.content || []).map(part => part.text || '').join('\n');
    }

    function contextFor(chat, history, database, offline) {
        const books = (chat.worldBookIds || []).map(id => (database.worldBooks || []).find(book => book.id === id)).filter(Boolean)
            .sort((a, b) => (a.depth ?? 100) - (b.depth ?? 100));
        const world = positions => books.filter(book => positions.includes(book.position || 'before')).map(book => String(book.content || '')).join('\n\n');
        const journals = (chat.memoryJournals || []).filter(journal => journal.isFavorited && !journal.offlineHidden).map(journal => `${journal.title || ''}\n${journal.content || ''}`).join('\n\n');
        const panel = offline ? chat.offline?.statusPanel : chat.statusPanel;
        const status = panel?.enabled ? String(panel.promptSuffix || '') : '';
        return {
            char: chat.realName || chat.remarkName || '角色', user: chat.myName || '我',
            charDescription: chat.persona || '', charPersonality: chat.personality || '',
            scenario: chat.scenario || '', personaDescription: chat.myPersona || '',
            worldInfoBefore: world(['limit_break', 'before']), worldInfoAfter: world(['after', 'guidelines']),
            dialogueExamples: chat.mes_example || chat.dialogueExamples || '', chatHistory: history,
            memory: journals, kissMemory: journals, status, kissStatus: status,
            description: chat.persona || '', personality: chat.personality || '',
            lastMessage: text(history.at(-1) || { content: '' }),
            lastUserMessage: text([...history].reverse().find(message => message.role === 'user') || { content: '' }),
            lastCharMessage: text([...history].reverse().find(message => message.role === 'assistant') || { content: '' })
        };
    }

    function protocol(chat, offline) {
        if (offline) {
            const panel = chat.offline?.statusPanel;
            return '404 线下显示协议：输出本轮剧情正文；不要输出线上聊天消息外壳。'
                + (chat.offline?.autoImage ? '\n正文之后输出 <offline_image_prompt>英文画面描述</offline_image_prompt>，仅描述本轮可见场景。' : '')
                + (panel?.enabled && panel.promptSuffix ? '\n正文之后以单独一行 [OFFLINE_STATUS_START] 开始状态栏，以单独一行 [OFFLINE_STATUS_END] 结束；中间使用本次提供的状态栏格式。' : '');
        }
        return `404 消息显示协议：普通文字回复使用 [${chat.realName || chat.remarkName || '角色'}的消息：正文]；需要多条时每条分别包裹。此要求仅规定消息显示格式。`;
    }

    function toGemini(messages, warnings) {
        const leading = [], contents = [];
        let historyStarted = false, interleaved = false;
        for (const message of messages) {
            if (message.role === 'system' && !historyStarted) { leading.push(text(message)); continue; }
            historyStarted = true;
            const parts = [];
            if (message.role === 'system') {
                interleaved = true;
                parts.push({ text: '[System instruction]\n' + text(message) });
            } else if (typeof message.content === 'string') parts.push({ text: message.content });
            else for (const part of message.content || []) {
                if (part.type === 'text') parts.push({ text: part.text || '' });
                else if (part.type === 'image_url') {
                    const url = typeof part.image_url === 'string' ? part.image_url : part.image_url?.url;
                    const match = /^data:([^;,]+);base64,(.*)$/s.exec(url || '');
                    if (match) parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
                    else if (/^https:\/\//i.test(url || '')) parts.push({ file_data: { mime_type: 'image/jpeg', file_uri: url } });
                    else warnings.push('Gemini 未发送不支持的图片地址；请改用可访问的 HTTPS 图片或 data URL。');
                }
            }
            if (!parts.length) continue;
            const role = message.role === 'assistant' ? 'model' : 'user';
            const last = contents.at(-1);
            if (last?.role === role) last.parts.push(...parts);
            else contents.push({ role, parts });
        }
        if (interleaved) warnings.push('Gemini 原生接口不支持聊天中间的 system 角色，已在原位置转为带 System instruction 标记的 user 内容；如需精确保留角色，请使用 OpenAI 兼容接口。');
        return { contents, system_instruction: leading.length ? { parts: [{ text: leading.join('\n\n') }] } : undefined };
    }

    function applyParameters(body, provider, parameters, warnings) {
        for (const key of sampleKeys) delete body[key];
        const p = copy(parameters || {});
        const stream = typeof p.stream === 'boolean' ? p.stream : false;
        delete p.max_context;
        if (Number(p.seed) === -1) delete p.seed;
        if (p.reasoning_effort === 'auto' || p.reasoning_effort === 'default') delete p.reasoning_effort;
        if (p.verbosity === 'auto' || p.verbosity === 'default') delete p.verbosity;
        // ST serializes disabled samplers too. Sending these unknown no-op keys breaks strict OpenAI endpoints.
        for (const key of ['top_k', 'top_a', 'min_p']) if (Number(p[key]) === 0) delete p[key];
        if (Number(p.repetition_penalty) === 1) delete p.repetition_penalty;
        if (Number(p.typical_p) === 1) delete p.typical_p;
        if (provider === 'gemini') {
            body.generationConfig = {};
            const fields = { temperature: 'temperature', top_p: 'topP', top_k: 'topK', max_tokens: 'maxOutputTokens', max_completion_tokens: 'maxOutputTokens', frequency_penalty: 'frequencyPenalty', presence_penalty: 'presencePenalty', seed: 'seed', stop: 'stopSequences', n: 'candidateCount' };
            for (const [key, value] of Object.entries(p)) {
                if (key === 'stream') continue;
                if (key === 'top_k' && Number(value) === 0) continue;
                if (fields[key]) body.generationConfig[fields[key]] = key === 'stop' && typeof value === 'string' ? [value] : value;
                else warnings.push(`Gemini 原生接口不支持预设参数 ${key}，该字段已保留在预设中但本次不发送。`);
            }
        } else {
            for (const [key, value] of Object.entries(p)) if (sampleKeys.includes(key)) body[key] = value;
            body.stream = stream;
        }
        if (Number(p.n) > 1) warnings.push('预设请求了多个候选回复；404 本轮显示第一个候选，其余不会写入聊天记录。');
        return stream;
    }

    function prepare({ chat, chatType = 'private', body, provider, trigger = 'normal', history, isBackground = false, offline = false }) {
        const source=chat?.offline?.draft?.generationSource;
        if (!(offline === true && chatType === 'private' && (source ? source === 'tavern' : isEnabled(chatType, offline)))) return { active: false };
        if (!chat || !body) throw Error('缺少酒馆预设请求上下文。');
        const engine = env.getEngine();
        if (!engine?.assemble) throw Error('酒馆预设模块未加载，请上传完整更新包后刷新。');
        const { preset, setting, database } = selected(chat);
        let transcript = normalizeHistory(history || body.messages?.filter(message => message.role !== 'system') || []);
        if (isBackground) transcript.push({ role: 'user', content: `现在可以由${chat.realName || chat.remarkName || '角色'}主动延续对话。` });
        const warnings = [];
        const context = contextFor(chat, transcript, database, offline);
        const activeRows = engine.orderedPrompts(preset, preset.groupIndex ?? setting.groupIndex ?? 0)
            .filter(row => row.enabled && !row.unordered && (!Array.isArray(row.prompt.injection_trigger) || !row.prompt.injection_trigger.length || row.prompt.injection_trigger.includes(trigger)));
        const hasMarker = id => activeRows.some(row => row.prompt.identifier === id && (row.prompt.marker === true || !row.prompt.content));
        const hostParts = [protocol(chat, offline)];
        // Standard ST presets have no 404-specific memory/status markers. Preserve host functionality exactly once.
        if (context.memory && !hasMarker('kissMemory')) hostParts.push('404 已收藏的剧情记忆：\n' + context.memory);
        if (context.status && !hasMarker('kissStatus')) hostParts.push('404 状态栏格式：\n' + context.status);
        const hostText = hostParts.join('\n\n').replace(/\{\{char\}\}/gi, () => context.char).replace(/\{\{user\}\}/gi, () => context.user);
        // Reserve output and prompt space. Approximation is deliberately conservative; no tokenizer is installed by the preset importer.
        const presetParameters = engine.parameters(preset);
        const maxContext = Number(presetParameters.max_context);
        const maxOutput = Number(presetParameters.max_tokens || 0);
        if (Number.isFinite(maxContext) && maxContext > 0) {
            const fixedText = activeRows.filter(row => row.prompt.identifier !== 'chatHistory')
                .map(row => row.prompt.marker ? String(context[row.prompt.identifier] || '') : String(row.prompt.content || '')).join('\n');
            const fixedEstimate = Math.ceil((fixedText.length + hostText.length) / 2) + (activeRows.length + 1) * 4;
            const available = maxContext - maxOutput - fixedEstimate;
            if (available <= 0) throw Error('此预设的上下文上限不足以容纳提示词和预留回复，请增加上下文长度或减少提示词/回复上限。');
            let estimated = transcript.reduce((n, message) => n + Math.ceil(text(message).length / 2) + (Array.isArray(message.content) ? message.content.filter(part => part.type === 'image_url').length * 1024 : 0), 0);
            let removed = 0;
            while (transcript.length > 1 && estimated > available) {
                const message = transcript.shift();
                estimated -= Math.ceil(text(message).length / 2) + (Array.isArray(message.content) ? message.content.filter(part => part.type === 'image_url').length * 1024 : 0);
                removed++;
            }
            if (estimated > available) throw Error('最新消息超过此预设的上下文预算，请增加上下文长度或缩短消息。');
            if (removed) warnings.push(`按预设上下文预算，已从本次请求移除最早 ${removed} 条消息，聊天原文保留；token 数为估算值。`);
        }
        context.chatHistory = transcript;
        const assembled = engine.assemble(preset, context, { groupIndex: preset.groupIndex ?? setting.groupIndex ?? 0, trigger });
        warnings.push(...(assembled.warnings || []));
        const messages = copy(assembled.messages || []);
        if (!messages.length) throw Error('此预设没有启用的提示词或聊天记录，请检查条目序列和顺序组。');
        if (Number.isFinite(maxContext) && maxContext > 0) {
            const expandedEstimate = messages.reduce((total, message) => total + Math.ceil(text(message).length / 2) + 4
                + (Array.isArray(message.content) ? message.content.filter(part => part.type === 'image_url').length * 1024 : 0), 0)
                + Math.ceil(hostText.length / 2) + 4 + maxOutput;
            if (expandedEstimate > maxContext) throw Error('宏展开后的提示词超出此预设的上下文预算，请增加上下文长度或减少提示词内容。');
        }
        // Required host display protocol stays separate from the user's ordered preset entries.
        messages.unshift({ role: 'system', content: hostText });
        delete body.messages; delete body.contents; delete body.system_instruction; delete body.systemInstruction;
        if (provider === 'gemini') Object.assign(body, toGemini(messages, warnings));
        else body.messages = messages;
        const stream = applyParameters(body, provider, assembled.parameters, warnings);
        api.lastReport = { presetId: preset.id, warnings: [...new Set(warnings)], trigger, time: Date.now() };
        for (const warning of api.lastReport.warnings) if (!warningsShown.has(warning)) { warningsShown.add(warning); env.report?.(warning); }
        return { active: true, presetId: preset.id, stream, warnings: api.lastReport.warnings, parameters: copy(assembled.parameters || {}) };
    }
    return api;
});
