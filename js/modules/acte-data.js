/* Storage, exchange and isolated generation for 剧幕. */
(() => {
    'use strict';
    const prefix = 'acte:';
    const maxFile = 32000000;
    const kinds = {dialogue: '对话', prose: '长文', html: 'HTML'};
    const genres = ['平行世界', '日常番外', '悬疑推理', 'R18 成人向'];
    const uid = () => crypto.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
    const string = (value, limit) => String(value ?? '').slice(0, limit);
    function image(value, raw = false) {
        const src = String(value || '').trim();
        if (/^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=\s]+$/i.test(src)) return src;
        if (raw && /^[a-z0-9+/=]+$/i.test(src) && src.length > 100) return 'data:image/png;base64,' + src;
        try { const url = new URL(src); if (['https:', 'http:'].includes(url.protocol)) return url.href; } catch {}
        return '';
    }
    const characters = () => db.characters || [];
    let npcs = [];
    const setNpcs = value => { npcs = value; };
    const actors = () => [...characters(),...npcs];
    const character = id => actors().find(c => String(c.id) === String(id));
    const name = c => c?.remarkName || c?.realName || '角色';
    const table = () => dexieDB.acte;
    async function list(group) {
        return (await table().where('key').startsWith(prefix + group + ':').toArray()).map(row => row.value);
    }
    const recordKey = (group, id) => prefix + group + ':' + id;
    async function write(group, value) {
        const row = {key:recordKey(group, value.id), value};
        if (group !== 'work') {
            await table().put(row);
            return value;
        }
        await dexieDB.transaction('rw', table(), async () => {
            await table().put(row);
            const key = recordKey('notice', value.id);
            if (value.aware && value.cast.length) {
                const {title, genre, synopsis, updated} = value;
                await table().put({key,value:{title,genre,synopsis:string(synopsis,400),updated,roles:value.cast.map(c => c.id)}});
            } else await table().delete(key);
        });
        return value;
    }
    function remove(group, id) {
        return group === 'work' ? table().bulkDelete([recordKey(group,id),recordKey('notice',id)]) :
            table().delete(recordKey(group,id));
    }
    const one = async (group, id) => (await table().get(prefix + group + ':' + id))?.value;
    async function revise(id, update) {
        return dexieDB.transaction('rw', table(), async () => {
            const work = await one('work', id);
            if (!work) throw Error('这部剧场已不存在');
            update(work);
            work.updated = Date.now();
            return write('work', work);
        });
    }
    function makeWork(data = {}, keepCast = false) {
        const actRows = Array.isArray(data.acts) ? data.acts : [];
        const acts = actRows.map((act, i) => ({
            id: uid(), title: string(act?.title, 80) || '第 ' + (i + 1) + ' 幕',
            rows: (Array.isArray(act?.rows) ? act.rows : []).map(row => ({
                id: uid(), role: row?.role === 'assistant' ? 'assistant' : 'user',
                speaker: string(row?.speaker, 80), text: string(row?.text, 16000),
                at: Number(row?.at) || Date.now(), actorId:string(row?.actorId,100),
                avatar:image(row?.avatar), presetId:string(row?.presetId,120), displayText:typeof row?.displayText === 'string' ? string(row.displayText,16000) : undefined,
                duration:Number.isFinite(row?.duration) ? row.duration : undefined,
                tokens:Number.isFinite(row?.tokens) ? row.tokens : undefined, estimated:row?.estimated === true
            }))
        }));
        if (!acts.length) acts.push({id:uid(), title:'开场', rows:[]});
        const cast = keepCast && Array.isArray(data.cast) ? data.cast : [];
        return {
            id:uid(), title:string(data.title, 80).trim() || '未命名剧场',
            kind:Object.hasOwn(kinds, data.kind) ? data.kind : 'html',
            genre:string(data.genre,40).trim() || genres[0],
            viewpoint:['first','second','third'].includes(data.viewpoint) ? data.viewpoint : 'third',
            viewpointActor:string(data.viewpointActor,100),userProfileId:string(data.userProfileId,100), userOnStage:data.userOnStage !== false,
            synopsis:string(data.synopsis, 6000), html:string(data.html, maxFile), cover:image(data.cover),
            templateHtml:string(data.templateHtml, maxFile), templateId:string(data.templateId,100), stylePrompt:string(data.stylePrompt, 8000),
            started:data.started === true, example:data.example === true,
            generation:data.generation && {prompt:string(data.generation.prompt,8000),mode:string(data.generation.mode,12),preset:string(data.generation.preset,120),apiPreset:string(data.generation.apiPreset,120),model:string(data.generation.model,160),promptVersion:string(data.generation.promptVersion,100),worldBookIds:Array.isArray(data.generation.worldBookIds) ? data.generation.worldBookIds.map(String) : []},
            htmlProgress:validProgress(data.htmlProgress) ? data.htmlProgress : null,
            art:Number.isInteger(data.art) && data.art >= 0 && data.art <= 5 ? data.art : 1,
            cast:cast.filter(c => character(c?.id)).map(c => ({id:String(c.id), memory:c.memory === true, part:string(c.part,30), notes:string(c.notes,1000)})),
            aware:keepCast && data.aware === true, status:data.status === 'done' ? 'done' : 'active',
            current:Math.max(0, Math.min(acts.length - 1, Number.isInteger(data.current) ? data.current : 0)),
            acts, updated:Date.now(), created:Date.now()
        };
    }
    function unwrap(value) {
        return String(value ?? '').trim().replace(/^\s*```(?:html|json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/, '');
    }
    function stripPackage(source) {
        return source.replace(/<script\b[^>]*\bid=["']acte-package["'][^>]*>[\s\S]*?<\/script\s*>/gi, '');
    }
    async function readFile(file) {
        if (file.size > maxFile) throw Error('文件需小于 32 MB');
        const base = file.name.replace(/\.[^.]+$/, '');
        if (/\.html?$/i.test(file.name)) return readHtml(await file.text(),file.name);
        let content;
        if (/\.docx$/i.test(file.name)) {
            if (!window.mammoth) throw Error('Word 读取器未加载');
            const input = {arrayBuffer:await file.arrayBuffer()};
            const raw = (await window.mammoth.extractRawText(input)).value;
            const html = sourceDocument(raw);
            if (html) return readHtml(html,file.name);
            content = window.DOMPurify.sanitize((await window.mammoth.convertToHtml(input)).value,{USE_PROFILES:{html:true}});
        } else if (/\.txt$/i.test(file.name)) {
            const raw = await file.text();
            const html = sourceDocument(raw);
            if (html) return readHtml(html,file.name);
            content = '<div style="white-space:pre-wrap">' + esc(raw) + '</div>';
        } else throw Error('请选择 HTML、DOCX 或 TXT');
        return readHtml('<!doctype html><html><head><title>' + esc(base) + '</title><style>body{font:16px/1.8 system-ui;margin:24px;overflow-wrap:anywhere}img{max-width:100%}</style></head><body>' + content + '</body></html>',file.name);
    }
    function validProgress(value) {
        if (value === null || value === undefined) return true;
        try { return JSON.stringify(value).length <= 4096; } catch { return false; }
    }
    function sourceDocument(value) {
        const raw = unwrap(value).replace(/^\uFEFF/,'').trim();
        const start = raw.search(/<!doctype\s+html\b|<html(?:\s|>)/i);
        const closes = [...raw.matchAll(/<\/html\s*>/gi)];
        if (start < 0 || !closes.length || closes.at(-1).index < start) return '';
        const end = closes.at(-1);
        return raw.slice(start,end.index + end[0].length)
            .replace(/<([a-z][\w:-]*)(\s[^<>]*)?>/gi,(tag,name,attrs) =>
                attrs ? '<' + name + attrs.replace(/=\s*[“”]([^“”]*)[“”]/g,'="$1"').replace(/=\s*[‘’]([^‘’]*)[‘’]/g,"='$1'") + '>' : tag);
    }
    function documentText(body) {
        const blocks = [...body.querySelectorAll('p,pre,li')];
        return blocks.length ? blocks.map(node => node.textContent).join('\n') : body.textContent;
    }
    function recoverSource(source) {
        const direct = sourceDocument(source);
        if (direct) {
            const parsed = new DOMParser().parseFromString(direct,'text/html');
            if (!parsed.body.querySelector('script,style,button,main,section') && /&lt;(?:!DOCTYPE|html)/i.test(parsed.body.innerHTML)) {
                return sourceDocument(documentText(parsed.body)) || direct;
            }
            return direct;
        }
        if (/&lt;(?:!DOCTYPE|html)/i.test(source)) return sourceDocument(documentText(new DOMParser().parseFromString(source,'text/html').body)) || source;
        return unwrap(source);
    }
    function preview(source, progress = null, track = false) {
        const policy = "default-src 'none'; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:; img-src data: blob: https:; font-src data: https:; media-src data: blob: https:; form-action 'none'; base-uri 'none'";
        const doc = new DOMParser().parseFromString(stripPackage(recoverSource(source)), 'text/html');
        for (const node of doc.querySelectorAll('base, iframe, frame, object, embed, meta[http-equiv]')) node.remove();
        for (const node of doc.querySelectorAll('a[href], area[href]')) {
            if (!node.getAttribute('href').startsWith('#')) node.removeAttribute('href');
        }
        doc.querySelector('meta[name="viewport"]')?.remove();
        const attrs = element => [...element.attributes].map(a => ' ' + a.name + '="' + esc(a.value) + '"').join('');
        const initial = JSON.stringify(progress ?? null).replace(/</g, '\\u003c');
        const bridge = track ? '<script>window.ActeProgress={value:' + initial +
            ',save(value){this.value=value;parent.postMessage({type:"acte-progress",value},"*")}};<\/script>' : '';
        return '<!doctype html><html' + attrs(doc.documentElement) + '><head><meta http-equiv="Content-Security-Policy" content="' + policy +
            '"><meta name="viewport" content="width=device-width,initial-scale=1">' + bridge + doc.head.innerHTML +
            '</head><body' + attrs(doc.body) + '>' + doc.body.innerHTML + '</body></html>';
    }
    function portable(work) {
        const {cast, aware, generation, userProfileId, ...copy} = work;
        return copy;
    }
    function readHtml(source, filename) {
        const original = source;
        source = recoverSource(source);
        if (!/<[a-z!][^>]*>/i.test(source) || source.length > maxFile) throw Error('请选择 32 MB 以内的 HTML 文件');
        const doc = new DOMParser().parseFromString(source, 'text/html');
        let pack;
        try {
            const meta = doc.querySelector('script#acte-package[type="application/json"]') ||
                new DOMParser().parseFromString(original,'text/html').querySelector('script#acte-package[type="application/json"]');
            pack = JSON.parse(meta?.textContent);
        } catch {}
        return {
            title:doc.title || filename.replace(/\.html?$/i, ''),
            html:stripPackage(source),
            pack:pack?.version === 1 && ['work','template'].includes(pack.kind) ? pack : null
        };
    }
    function exportHtml(work, template, prompt = '') {
        const shell = template ? work.templateHtml || '' : work.html || '';
        const body = shell || '<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
            esc(template ? '剧幕模板' : work.title) + '</title><style>body{background:#f6f5f2;color:#222;margin:3rem auto;max-width:42rem;padding:0 1rem;font:16px/1.8 serif}section{border-top:1px solid #bbb;margin-top:2rem}p{white-space:pre-wrap}</style><main><h1>' +
            esc(template ? '{{title}}' : work.title) + '</h1><p>' + esc(template ? '{{synopsis}}' : work.synopsis) + '</p>' +
            (template ? '<section>{{content}}</section>' : work.acts.map(a => '<section><h2>' + esc(a.title) + '</h2>' +
                a.rows.map(r => '<p><b>' + esc(r.speaker) + '</b><br>' + esc(r.text) + '</p>').join('') + '</section>').join('')) + '</main></html>';
        const pack = {version:1, kind:template ? 'template' : 'work', ...(template ? {name:work.title,prompt:prompt || work.stylePrompt || ''} : {work:{...portable(work),cast:work.cast,html:''}})};
        const meta = '<script type="application/json" id="acte-package">' + JSON.stringify(pack).replace(/</g, '\\u003c') + '</script>';
        const clean = stripPackage(body);
        return /<\/head\s*>/i.test(clean) ? clean.replace(/<\/head\s*>/i, match => meta + match) : clean + '\n' + meta;
    }
    async function ask(messages, settings = {}, signal, cast = [], trigger = 'normal', withStats = false) {
        const followRole = !settings.apiPreset;
        const draft = {apiPreset:settings.apiPreset === '@desktop' ? '' : settings.apiPreset,model:followRole ? '' : settings.model,generationSource:'tavern',tavernPresetId:settings.preset,inheritWorldbooks:false};
        const actor = character(cast[0]?.id);
        const chat = {id:actor?.id,realName:actor ? name(actor) : '角色',myName:actor?.myName || '我',
            persona:actor?.persona,personality:actor?.personality,myPersona:actor?.myPersona,
            exclusiveApiEnabled:followRole && actor?.exclusiveApiEnabled,exclusiveApiPreset:actor?.exclusiveApiPreset,
            exclusiveApiModel:followRole ? actor?.exclusiveApiModel : undefined,
            worldBookIds:(db.worldBooks || []).filter(b => (settings.worldBookIds || []).includes(String(b.id))).map(b => b.id),
            offline:{draft}};
        const config = {...(window.KissOffline?.resolveOfflineApi(chat,followRole ? undefined : db.apiSettings) || db.apiSettings)};
        if (!config.url || !config.model || !config.key) throw Error('请在生成设置选择有效的 API 和模型');
        if (typeof BLOCKED_API_DOMAINS !== 'undefined' && BLOCKED_API_DOMAINS.some(domain => config.url.includes(domain))) throw Error('该 API 地址不可用');
        if (config.provider !== 'gemini') config.key = getRandomValue(config.key);
        const selected = settings.preset;
        const system = messages.filter(m => m.role === 'system');
        const books = (db.worldBooks || []).filter(b => chat.worldBookIds.includes(b.id));
        if (books.length) system.push({role:'system',content:'【世界书】\n' + books.map(b => (b.name || b.title || '') + '\n' + (b.content || '')).join('\n\n')});
        if (settings.mode !== 'tavern') {
            if (settings.promptVersion && typeof generatePrivateSystemPrompt === 'function') {
                const text = generatePrivateSystemPrompt({...chat,id:undefined,worldBookIds:[],_kissSkipCollectionPrompt:true,exclusivePromptVersion:settings.promptVersion});
                if (text) system.unshift({role:'system',content:text + '\n上面的聊天输出格式与本次冲突时，以后续剧幕输出规则为准。'});
            }
            if (settings.prompt) system.push({role:'system',content:settings.prompt});
        }
        if (settings.mode === 'cot') {
            const cot = (db.cotPresets || []).find(p => String(p.id) === selected);
            if (!cot) throw Error('请选择思维链预设');
            const content = (cot.items || []).filter(row => row.enabled !== false).map(row => row.content).filter(Boolean).join('\n')
                .replace(/\{\{char\}\}/gi,() => chat.realName).replace(/\{\{user\}\}/gi,() => chat.myName);
            if (content) system.push({role:'system',content});
        }
        const history = messages.filter(m => m.role !== 'system');
        const offline = window.KissOfflineGeneration;
        let req;
        if (settings.mode === 'tavern') {
            if (!selected) throw Error('请选择酒馆预设');
            req = offline.build({...chat,worldBookIds:[]},history,config,()=>'',trigger,
                {hostProtocol:system.map(m => m.content).join('\n\n'),skipCollections:true});
            await offline.applyRequestRegex(req,chat);
        } else {
            req = buildChatApiRequest({...config,streamEnabled:false},[...system,...history],
                {temperature:config.temperatureEnabled ? config.temperature : undefined});
        }
        const started = performance.now();
        const response = await fetch(req.endpoint,{method:'POST',headers:req.headers,
            body:JSON.stringify(window.KissBilingual?.prepareBody(req.requestBody) || req.requestBody),signal});
        if (!response.ok) throw Error('API 请求失败（HTTP ' + response.status + '）');
        const output = await offline.readResponse(response,config.provider);
        const text = unwrap(offline.split(output.full).text);
        if (!text?.trim()) throw Error('模型返回了空内容');
        return withStats ? {text,usage:output.usage,duration:(performance.now()-started)/1000,presetId:req.presetId,actor:chat.realName,user:chat.myName} : text;
    }
    function castContext(work) {
        const roles = work.cast.map(row => {
            const c = character(row.id);
            if (!c) return '';
            const profile = {actorId:String(c.id),name:name(c), part:row.part || '配角', notes:row.notes || undefined, persona:c.persona || '', profile:c.profile || undefined};
            if (row.memory) profile.memories = (c.memoryJournals || []).filter(j => j.isFavorited && !j.isContextDisabled && !j.mergedIntoId)
                .slice(-20).map(j => string(j.content, 1600));
            return JSON.stringify(profile);
        }).filter(Boolean);
        return roles.join('\n');
    }
    async function onlineContext(chat) {
        const visible = (await list('notice')).filter(row => row.roles.includes(String(chat.id)))
            .sort((a,b) => b.updated - a.updated).slice(0, 8);
        if (!visible.length) return '';
        return '\n【你知道的剧幕】以下是用户明确告知你的虚构剧场资料。它们与真实聊天记忆分开，只在话题相关时引用。\n' +
            JSON.stringify(visible.map(({title,genre,synopsis}) => ({title,genre,synopsis})));
    }
    const ideas = [
        {title:'末班车以后',kind:'prose',genre:genres[0],art:2,synopsis:'末班车突然驶向一条地图上没有的线路。它可以把乘客带回一次没来得及告别的夜晚。'},
        {title:'雾中剧场',kind:'dialogue',genre:genres[2],art:0,synopsis:'闭馆前十五分钟，空荡的观众席里出现了第二张票。票上印着明天的日期。'},
        {title:'潮汐备忘录',kind:'prose',genre:genres[1],art:3,synopsis:'沿着潮水退去的地方，把没来得及说的话写在纸上。第二天，海边多了一封回信。'},
        {title:'双生台',kind:'dialogue',genre:genres[0],art:5,synopsis:'一份过期的节目单上，写着两个人完全相同的名字。演出即将开始。'}
    ];
    window.ActeData = {maxFile,validProgress,ideas,readFile,kinds,genres,uid,esc,image,characters,actors,setNpcs,character,name,list,one,write,remove,revise,makeWork,preview,portable,readHtml,exportHtml,ask,castContext,onlineContext};
})();
