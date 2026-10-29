/* Independently implemented SillyTavern JSON compatibility. No bundled prompt prose. */
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.KissTavernEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const clone = value => JSON.parse(JSON.stringify(value));
    const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    const safeName = value => !['__proto__', 'prototype', 'constructor'].includes(String(value));
    const unique = list => [...new Set(list)];
    const MAX_BYTES = 12 * 1024 * 1024;
    const LIMIT = 10000;
    const PARAMS = {
        temperature: ['temperature', 'temp_openai', 'temp'],
        frequency_penalty: ['frequency_penalty', 'freq_pen_openai'],
        presence_penalty: ['presence_penalty', 'pres_pen_openai'],
        top_p: ['top_p', 'top_p_openai'], top_k: ['top_k', 'top_k_openai'],
        min_p: ['min_p'], top_a: ['top_a'], typical_p: ['typical_p', 'typical'],
        repetition_penalty: ['repetition_penalty', 'rep_pen'],
        max_tokens: ['openai_max_tokens', 'max_tokens', 'max_length'],
        max_context: ['openai_max_context', 'max_context', 'max_context_length'],
        seed: ['seed'], n: ['n'], stream: ['stream_openai', 'stream'],
        reasoning_effort: ['reasoning_effort'], stop: ['stop', 'stop_sequences'],
        logit_bias: ['logit_bias'], verbosity: ['verbosity'],
    };
    const MARKERS = new Set(['charDescription', 'charPersonality', 'scenario', 'personaDescription', 'worldInfoBefore', 'worldInfoAfter', 'dialogueExamples', 'chatHistory', 'kissMemory', 'kissStatus']);
    const TRIGGERS = new Set(['normal', 'continue', 'impersonate', 'swipe', 'regenerate', 'quiet']);
    function groups(data) {
        if (!Array.isArray(data.prompt_order) || !data.prompt_order.length) return [];
        return own(data.prompt_order[0], 'identifier')
            ? [{ character_id: 'flat', order: data.prompt_order }]
            : data.prompt_order;
    }
    function getGroup(record, groupIndex) {
        const all = groups(record.data);
        if (!all.length) return null;
        const index = groupIndex == null ? (record.groupIndex || 0) : Number(groupIndex);
        if (!Number.isInteger(index) || index < 0 || index >= all.length) throw new Error('排序组不存在，请重新选择');
        return all[index];
    }
    function promptMap(record) {
        return new Map((record.data.prompts || []).map(prompt => [prompt.identifier, prompt]));
    }
    function validatePrompts(data) {
        if (!Array.isArray(data.prompts)) return;
        if (data.prompts.length > LIMIT) throw new Error('条目数量超过 10000');
        const seen = new Set();
        data.prompts.forEach((prompt, i) => {
            if (!object(prompt) || typeof prompt.identifier !== 'string' || !prompt.identifier.trim()) throw new Error('第 ' + (i + 1) + ' 个条目缺少 identifier');
            if (seen.has(prompt.identifier)) throw new Error('重复的条目标识：' + prompt.identifier);
            seen.add(prompt.identifier);
            if (prompt.content != null && typeof prompt.content !== 'string') throw new Error('条目内容必须为文本：' + prompt.identifier);
        });
        groups(data).forEach((group, index) => {
            if (!object(group) || !Array.isArray(group.order)) throw new Error('第 ' + (index + 1) + ' 组排序格式无效');
            const ids = new Set();
            group.order.forEach(entry => {
                if (!object(entry) || typeof entry.identifier !== 'string') throw new Error('排序条目缺少 identifier');
                if (ids.has(entry.identifier)) throw new Error('排序组中重复引用：' + entry.identifier);
                ids.add(entry.identifier);
            });
        });
    }
    function importPreset(input, name) {
        const text = typeof input === 'string' ? input.replace(/^\uFEFF/, '') : JSON.stringify(input);
        if (text.length > MAX_BYTES) throw new Error('预设文件超过 12 MB');
        let source;
        try { source = JSON.parse(text); } catch (_) { throw new Error('无法读取 JSON 预设文件'); }
        if (!object(source)) throw new Error('预设根节点必须是 JSON 对象');
        let path = [];
        let data = source;
        if (object(source.oai_settings)) { path = ['oai_settings']; data = source.oai_settings; }
        else if (object(source.data) && Array.isArray(source.data.prompts)) { path = ['data']; data = source.data; }
        validatePrompts(data);
        const chat = Array.isArray(data.prompts);
        if (!chat && !Object.values(PARAMS).some(keys => keys.some(key => own(data, key)))) throw new Error('未识别到酒馆提示词条目或生成参数');
        const warnings = [];
        if (!chat) warnings.push('这是参数/文本补全预设：可保存、编辑参数和原样导出，不能使用聊天补全条目组装。');
        const all = groups(data);
        const recommended = all.findIndex(group => String(group.character_id) === '100001');
        const record = {
            id: 'st_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)),
            name: String(name || source.name || source.preset_name || data.name || '未命名预设').replace(/\.json$/i, '').slice(0, 200),
            format: chat ? 'chat-completion' : 'sampler',
            data: clone(data), source: clone(source), sourcePath: path,
            groupIndex: recommended >= 0 ? recommended : 0, warnings,
        };
        if (chat) {
            const refs = new Set();
            all.forEach(group => group.order.forEach(entry => refs.add(entry.identifier)));
            const map = promptMap(record);
            for (const id of refs) if (!map.has(id)) warnings.push('排序引用缺少条目：' + id + '；生成前需补齐或移除该引用。');
            if (!all.length) warnings.push('文件没有 prompt_order，按 prompts 数组顺序与条目 enabled 状态排列。');
            if (object(data.extensions) && Object.keys(data.extensions).length) warnings.push('扩展数据将原样保留；第三方脚本、正则扩展和插件不自动执行。');
        }
        return record;
    }
    function exportPreset(record) {
        const data = clone(record.data);
        validatePrompts(data);
        if (!record.sourcePath || !record.sourcePath.length) return data;
        const result = clone(record.source || {});
        result[record.sourcePath[0]] = data;
        return result;
    }
    function getOrder(record, groupIndex) {
        const group = getGroup(record, groupIndex);
        return group ? clone(group.order) : (record.data.prompts || []).map(prompt => ({ identifier: prompt.identifier, enabled: prompt.enabled !== false }));
    }
    function orderedPrompts(record, groupIndex) {
        const map = promptMap(record);
        const order = getOrder(record, groupIndex);
        const seen = new Set(order.map(entry => entry.identifier));
        const rows = order.map(entry => ({ prompt: map.get(entry.identifier) || { identifier: entry.identifier, name: '[缺失条目] ' + entry.identifier, missing: true }, enabled: entry.enabled !== false, orderEntry: clone(entry) }));
        for (const prompt of record.data.prompts || []) if (!seen.has(prompt.identifier)) rows.push({ prompt, enabled: false, unordered: true });
        return rows;
    }
    function setOrder(record, entries, groupIndex) {
        if (!Array.isArray(entries)) throw new Error('排序必须为数组');
        const seen = new Set();
        const map = promptMap(record);
        const existing = new Set(getOrder(record, groupIndex).map(entry => entry.identifier));
        entries.forEach(entry => {
            if (!object(entry) || typeof entry.identifier !== 'string' || (!map.has(entry.identifier) && !existing.has(entry.identifier))) throw new Error('排序中引用了不存在的条目');
            if (seen.has(entry.identifier)) throw new Error('排序中重复引用同一条目');
            seen.add(entry.identifier);
        });
        const group = getGroup(record, groupIndex);
        if (group) {
            if (groups(record.data)[0].character_id === 'flat') record.data.prompt_order = clone(entries);
            else group.order = clone(entries);
        } else record.data.prompt_order = [{ character_id: 100001, order: clone(entries) }];
        return record;
    }
    function parameters(record) {
        const result = {};
        for (const [out, keys] of Object.entries(PARAMS)) {
            const key = keys.find(key => own(record.data, key));
            if (key == null) continue;
            const value = record.data[key];
            if (value == null) continue;
            if (out === 'stream') result[out] = Boolean(value);
            else if (out === 'reasoning_effort' || out === 'verbosity') result[out] = String(value);
            else if (out === 'stop' || out === 'logit_bias') result[out] = clone(value);
            else if (value !== '' && Number.isFinite(Number(value))) result[out] = Number(value);
        }
        return result;
    }
    function macroState(context, options, warnings) {
        const variables = Object.assign(Object.create(null), options.variables || context.variables || {});
        const globalVariables = Object.assign(Object.create(null), options.globalVariables || context.globalVariables || {});
        const values = Object.create(null);
        Object.entries(context).forEach(([key, value]) => { if (safeName(key) && (typeof value === 'string' || typeof value === 'number')) values[key.toLowerCase()] = String(value); });
        const aliases = { description: 'charDescription', personality: 'charPersonality', persona: 'personaDescription', mesexamples: 'dialogueExamples', chardescription: 'charDescription', charpersonality: 'charPersonality', personadescription: 'personaDescription', lastusermessage: 'lastUserMessage', lastcharmessage: 'lastCharMessage' };
        for (const [key, source] of Object.entries(aliases)) if (typeof context[source] === 'string') values[key] = context[source];
        const history = context.chatHistory || [];
        for (const [macro, role] of [['lastusermessage', 'user'], ['lastcharmessage', 'assistant']]) {
            const item = [...history].reverse().find(item => item.role === role && typeof item.content === 'string');
            if (!(macro in values)) values[macro] = item ? item.content : '';
        }
        const now = options.now instanceof Date ? options.now : new Date();
        Object.assign(values, { newline: '\n', trim: '', noop: '', original: '', char: String(context.char || ''), user: String(context.user || ''), time: now.toLocaleTimeString(), date: now.toLocaleDateString(), weekday: now.toLocaleDateString(undefined, { weekday: 'long' }), isotime: now.toISOString(), isodate: now.toISOString().slice(0, 10) });
        const warn = message => warnings.push(message);
        const truthy = value => !['', 'false', '0', 'off', 'no', 'null', 'undefined'].includes(String(value).trim().toLowerCase());
        let operations = 0;
        function readToken(text, start) {
            let depth = 1;
            for (let i = start + 2; i < text.length - 1; i++) {
                if (text.slice(i, i + 2) === '{{') { depth++; i++; }
                else if (text.slice(i, i + 2) === '}}') { if (--depth === 0) return { body: text.slice(start + 2, i), end: i + 2 }; i++; }
            }
            return null;
        }
        function nameOf(body) { return body.trim().replace(/^#\s*/, '').split(/::|\s|:/)[0].toLowerCase(); }
        function scopeCandidate(body) {
            const parts = parse(body), name = parts[0], count = parts[1].length;
            return (name === 'if' && count < 2) || (['setvar', 'setglobalvar'].includes(name) && count < 2) || (['trim', 'reverse'].includes(name) && count === 0);
        }
        function findScope(text, start, name) {
            let depth = 1, alternate = null, i = start;
            while ((i = text.indexOf('{{', i)) >= 0) {
                const token = readToken(text, i);
                if (!token) break;
                const body = token.body.trim();
                const tag = nameOf(body);
                if (tag === name && scopeCandidate(body)) depth++;
                else if (tag === '/' + name) {
                    if (--depth === 0) return { content: text.slice(start, alternate ? alternate.start : i), other: alternate ? text.slice(alternate.end, i) : '', end: token.end };
                } else if (name === 'if' && tag === 'else' && depth === 1) alternate = { start: i, end: token.end };
                i = token.end;
            }
            return null;
        }
        function parse(body) {
            const trimmed = body.trim().replace(/^#\s*/, '');
            const match = trimmed.match(/^([^\s:]+)(?:(::|:|\s+)([\s\S]*))?$/);
            if (!match) return [trimmed.toLowerCase(), []];
            if (!match[2]) return [match[1].toLowerCase(), []];
            if (match[2] !== '::') return [match[1].toLowerCase(), [(match[3] || '').trim()]];
            const args = [], rest = match[3] || '';
            let depth = 0, start = 0;
            for (let i = 0; i < rest.length - 1; i++) {
                if (rest.slice(i, i + 2) === '{{') { depth++; i++; }
                else if (rest.slice(i, i + 2) === '}}') { depth--; i++; }
                else if (!depth && rest.slice(i, i + 2) === '::') { args.push(rest.slice(start, i).trim()); i++; start = i + 1; }
            }
            args.push(rest.slice(start).trim());
            return [match[1].toLowerCase(), args];
        }
        function variableGet(table, key) { return safeName(key) && own(table, key) ? table[key] : ''; }
        function variableSet(table, key, value) { if (!safeName(key)) { warn('禁止的变量名：' + key); return ''; } table[key] = value; return ''; }
        function shorthand(body, depth) {
            const match = body.trim().match(/^([.$])([^\s=+!<>?|]+)\s*(\?\?=|\|\|=|\+\+|--|\+=|-=|==|!=|>=|<=|\?\?|\|\||=|>|<)?\s*([\s\S]*)$/);
            if (!match) return null;
            const table = match[1] === '.' ? variables : globalVariables;
            const key = match[2], op = match[3];
            const old = variableGet(table, key);
            if (!op) return String(old);
            if (op === '??' && own(table, key)) return String(old);
            if (op === '||' && truthy(old)) return String(old);
            if (op === '??=' && own(table, key)) return String(old);
            if (op === '||=' && truthy(old)) return String(old);
            const next = render(match[4], depth + 1);
            if (op === '=') return variableSet(table, key, next);
            if (['??=', '||='].includes(op)) { variableSet(table, key, next); return next; }
            if (['??', '||'].includes(op)) return next;
            if (op === '++' || op === '--') { const n = Number(old || 0) + (op === '++' ? 1 : -1); variableSet(table, key, n); return String(n); }
            if (op === '+=' || op === '-=') {
                const numeric = Number.isFinite(Number(old || 0)) && Number.isFinite(Number(next));
                const value = numeric ? Number(old || 0) + (op === '-=' ? -1 : 1) * Number(next) : (op === '+=' ? String(old) + next : old);
                return variableSet(table, key, value);
            }
            const num = Number.isFinite(Number(old)) && Number.isFinite(Number(next));
            const a = num ? Number(old) : String(old), b = num ? Number(next) : next;
            return String(op === '==' ? a === b : op === '!=' ? a !== b : op === '>' ? a > b : op === '<' ? a < b : op === '>=' ? a >= b : a <= b);
        }
        function conditionTruth(condition, depth) {
            let resolved = render(condition, depth + 1).trim();
            const invert = resolved.startsWith('!');
            if (invert) resolved = resolved.slice(1);
            if (own(values, resolved.toLowerCase())) resolved = values[resolved.toLowerCase()];
            if (/^[.$]/.test(resolved)) resolved = shorthand(resolved, depth) || '';
            return invert ? !truthy(resolved) : truthy(resolved);
        }
        function execute(body, scoped, depth) {
            const raw = body.trim();
            if (raw.startsWith('//')) return '';
            const short = /^[.$]/.test(raw) ? shorthand(raw, depth) : null;
            if (short !== null) return short;
            const [name, rawArgs] = parse(body);
            if (name === 'if') {
                const yes = conditionTruth(rawArgs[0] || '', depth);
                return render(yes ? rawArgs[1] || '' : rawArgs[2] || '', depth + 1);
            }
            const args = rawArgs.map(value => render(value, depth + 1));
            if (scoped !== null) args.push(render(raw.startsWith('#') ? scoped : scoped.trim(), depth + 1));
            if (own(values, name) && !args.length) return values[name];
            if (name === 'trim') return args.length ? render(args[0], depth + 1).trim() : '';
            if (['setvar', 'setglobalvar', 'getvar', 'getglobalvar', 'addvar', 'addglobalvar', 'incvar', 'incglobalvar', 'decvar', 'decglobalvar', 'hasvar', 'hasglobalvar'].includes(name)) {
                const table = name.includes('global') ? globalVariables : variables, key = args[0] || '';
                if (name.startsWith('get')) return String(variableGet(table, key));
                if (name.startsWith('has')) return String(own(table, key));
                if (name.startsWith('set')) return variableSet(table, key, args[1] || '');
                const old = variableGet(table, key);
                if (name.startsWith('add')) {
                    const next = args[1] || '';
                    const numeric = Number.isFinite(Number(old || 0)) && Number.isFinite(Number(next));
                    return variableSet(table, key, numeric ? Number(old || 0) + Number(next) : String(old) + next);
                }
                const value = Number(old || 0) + (name.startsWith('inc') ? 1 : -1);
                variableSet(table, key, value); return String(value);
            }
            if (name === 'random' || name === 'pick') {
                const choices = args.length === 1 ? args[0].split(',').map(s => s.trim()) : args;
                if (!choices.length) return '';
                if (name === 'pick') {
                    let hash = 2166136261; const seed = String(options.pickSeed || context.char || '') + body;
                    for (const c of seed) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
                    return choices[(hash >>> 0) % choices.length];
                }
                const random = typeof options.random === 'function' ? options.random() : Math.random();
                return choices[Math.max(0, Math.min(choices.length - 1, Math.floor(random * choices.length)))];
            }
            if (name === 'reverse') return Array.from(args[0] || '').reverse().join('');
            if (name === 'upper') return (args[0] || '').toUpperCase();
            if (name === 'lower') return (args[0] || '').toLowerCase();
            if (name === 'space') return ' '.repeat(Math.min(100, Math.max(0, Number(args[0] || 1))));
            if (name === 'input') return String(context.input || values.lastusermessage || '');
            if (name === 'lastmessage') { const item = history[history.length - 1]; return item && typeof item.content === 'string' ? item.content : ''; }
            warn('未执行的宏：' + name);
            return '{{' + body + '}}';
        }
        function render(text, depth) {
            text = String(text == null ? '' : text);
            if ((depth || 0) > 24) { warn('宏嵌套超过 24 层，保留原文'); return text; }
            let out = '', cursor = 0;
            while (cursor < text.length) {
                if (++operations > 100000) throw new Error('宏展开超过安全操作上限');
                const start = text.indexOf('{{', cursor);
                if (start < 0) { out += text.slice(cursor); break; }
                out += text.slice(cursor, start);
                if (start > 0 && text[start - 1] === '\\') { out += '{{'; cursor = start + 2; continue; }
                const token = readToken(text, start);
                if (!token) { out += text.slice(start); break; }
                const name = nameOf(token.body);
                const scope = scopeCandidate(token.body) ? findScope(text, token.end, name) : null;
                if (scope && name === 'if') {
                    const conditions = parse(token.body)[1];
                    out += render(conditionTruth(conditions[0] || '', depth || 0) ? scope.content : scope.other, (depth || 0) + 1);
                } else out += execute(token.body, scope ? scope.content : null, depth || 0);
                cursor = scope ? scope.end : token.end;
                if (name === 'trim' && !scope && parse(token.body)[1].length === 0) {
                    out = out.trimEnd();
                    while (cursor < text.length && /\s/.test(text[cursor])) cursor++;
                }
                if (out.length > MAX_BYTES) throw new Error('宏展开结果超过 12 MB');
            }
            return out;
        }
        return { render: text => render(text, 0), variables, globalVariables };
    }
    function assemble(record, context, options) {
        context = context || {}; options = options || {};
        if (record.format !== 'chat-completion' || !Array.isArray(record.data.prompts)) throw new Error('当前文件仅支持参数管理，不能作为聊天补全提示词组装');
        validatePrompts(record.data);
        const warnings = [], state = macroState(context, options, warnings);
        const rows = orderedPrompts(record, options.groupIndex);
        const missing = rows.filter(row => row.prompt.missing && row.enabled);
        if (missing.length) throw new Error('排序引用缺少条目：' + missing.map(row => row.prompt.identifier).join('、'));
        const data = record.data;
        const normalizeMessage = (item, role) => {
            if (typeof item === 'string') return { role: role || 'system', content: state.render(item) };
            if (!object(item)) return null;
            const result = clone(item);
            if (!['system', 'user', 'assistant', 'tool'].includes(result.role)) { warnings.push('不支持的消息角色：' + result.role); return null; }
            if (typeof result.content === 'string') result.content = state.render(result.content);
            else if (Array.isArray(result.content)) result.content = result.content.map(part => part && part.type === 'text' ? Object.assign({}, part, { text: state.render(part.text || '') }) : part);
            return result;
        };
        function markerMessages(prompt) {
            const id = prompt.identifier;
            if (!MARKERS.has(id)) { warnings.push('未识别的动态插入点：' + id); return []; }
            let value = context[id];
            if (id === 'kissMemory') value = context.kissMemory == null ? context.memory : context.kissMemory;
            if (id === 'kissStatus') value = context.kissStatus == null ? context.status : context.kissStatus;
            if (value == null) { warnings.push('动态插入点没有可用内容：' + id); return []; }
            if (typeof value === 'string') {
                if ((id === 'worldInfoBefore' || id === 'worldInfoAfter') && data.wi_format) value = data.wi_format.replace(/\{0\}/g, () => value);
                if (id === 'charPersonality' && data.personality_format) value = data.personality_format.replace(/\{\{personality\}\}/gi, () => value);
                if (id === 'scenario' && data.scenario_format) value = data.scenario_format.replace(/\{\{scenario\}\}/gi, () => value);
            }
            return (Array.isArray(value) ? value : [value]).map(item => normalizeMessage(item, prompt.role || 'system')).filter(item => item && (typeof item.content !== 'string' || item.content.trim()));
        }
        const relative = [], injections = [];
        const trigger = options.trigger || 'normal';
        if (!TRIGGERS.has(trigger)) throw new Error('未知生成类型：' + trigger);
        rows.forEach((row, index) => {
            const prompt = row.prompt;
            if (!row.enabled || row.unordered || prompt.missing) return;
            if (Array.isArray(prompt.injection_trigger) && prompt.injection_trigger.length && !prompt.injection_trigger.includes(trigger)) return;
            const isMarker = prompt.marker === true || (MARKERS.has(prompt.identifier) && !prompt.content);
            let items;
            if (isMarker) items = markerMessages(prompt);
            else {
                const role = prompt.role || 'system';
                if (!['system', 'user', 'assistant'].includes(role)) { warnings.push('条目角色未支持：' + prompt.identifier + ' / ' + role); return; }
                const content = state.render(prompt.content || '');
                items = content.trim() ? [{ role, content }] : [];
            }
            if (Number(prompt.injection_position || 0) === 1) {
                const depth = Number(prompt.injection_depth == null ? 4 : prompt.injection_depth);
                if (!Number.isFinite(depth) || depth < 0) throw new Error('聊天插入深度无效：' + prompt.identifier);
                const order = Number(prompt.injection_order == null ? 100 : prompt.injection_order);
                if (!Number.isFinite(order)) throw new Error('聊天插入顺序无效：' + prompt.identifier);
                injections.push({ depth: Math.floor(depth), order, index, items });
            } else {
                if (prompt.injection_position != null && Number(prompt.injection_position) !== 0) throw new Error('不支持的条目插入位置：' + prompt.identifier);
                relative.push({ id: prompt.identifier, items });
            }
        });
        const historyBlock = relative.find(block => block.id === 'chatHistory');
        if (injections.length && !historyBlock) throw new Error('存在聊天内深度插入条目，但启用的排序中没有聊天记录插入点');
        if (historyBlock) {
            const history = historyBlock.items, length = history.length;
            const buckets = new Map();
            injections.forEach(injection => {
                const at = Math.max(0, length - injection.depth);
                if (!buckets.has(at)) buckets.set(at, []);
                injection.items.forEach((item, itemIndex) => buckets.get(at).push({ item, order: injection.order, index: injection.index, itemIndex }));
            });
            const rank = { user: 0, assistant: 1, system: 2, tool: 3 };
            const output = [];
            for (let i = 0; i <= length; i++) {
                const added = (buckets.get(i) || []).sort((a, b) => rank[a.item.role] - rank[b.item.role] || a.order - b.order || a.index - b.index || a.itemIndex - b.itemIndex);
                output.push(...added.map(entry => entry.item));
                if (i < length) output.push(history[i]);
            }
            historyBlock.items = output;
        }
        const messages = relative.flatMap(block => block.items);
        if (trigger === 'continue' && data.continue_nudge_prompt && !data.continue_prefill) messages.push({ role: 'system', content: state.render(data.continue_nudge_prompt) });
        if (trigger === 'impersonate' && data.impersonation_prompt) messages.push({ role: 'system', content: state.render(data.impersonation_prompt) });
        if (data.assistant_prefill && trigger !== 'impersonate') messages.push({ role: 'assistant', content: state.render(data.assistant_prefill) });
        if (trigger === 'impersonate' && data.assistant_impersonation) messages.push({ role: 'assistant', content: state.render(data.assistant_impersonation) });
        if (!messages.length) throw new Error('当前排序没有可发送的提示词或聊天记录');
        return { messages, warnings: unique(warnings), parameters: parameters(record), variables: state.variables, globalVariables: state.globalVariables };
    }
    return Object.freeze({ importPreset, exportPreset, getOrder, setOrder, orderedPrompts, parameters, assemble, groupList: record => clone(groups(record.data)) });
});
