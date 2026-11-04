/* Storage, exchange and isolated generation for 剧幕. */
(() => {
    'use strict';
    const prefix = 'acte:';
    const maxFile = 32000000;
    const kinds = {dialogue: '对话', prose: '长文', html: 'HTML'};
    const genres = ['平行世界', '日常番外', '悬疑推理', 'R18 成人向'];
    const presets = [
        {id:'curtain', name:'舞台 · 帷幕', art:0, prompt:'黑银剧场。炭黑背景，珍珠白衬线剧名，侧光落在银灰帷幕上。首屏仅一个主要开演按钮。场次列表用细线和编号，切幕柔和，正文对比度清晰。'},
        {id:'radio', name:'深夜电台', art:4, prompt:'深夜电台节目单。墨灰底、冷白字、微量银蓝，场次用播出时间轴和编号。提供节目切换和逐段展开，避免装饰性波形挤占正文。'},
        {id:'archive', name:'失物档案', art:5, prompt:'黑白失物档案。浅纸灰阅读区，窄列档案编号，克制的印刷边线。线索用可展开的编号卡片，附注和正文有明确字号层级。'},
        {id:'letters', name:'双人书信', art:3, prompt:'双人往返信笺。冷白纸面、墨灰字，靠日期和署名区分双方。使用适合窄屏的单栏排版和轻量翻页，段落有充足行距。'}
    ];
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
    const character = id => characters().find(c => String(c.id) === String(id));
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
                at: Number(row?.at) || Date.now()
            }))
        }));
        if (!acts.length) acts.push({id:uid(), title:'开场', rows:[]});
        const cast = keepCast && Array.isArray(data.cast) ? data.cast : [];
        return {
            id:uid(), title:string(data.title, 80).trim() || '未命名剧场',
            kind:Object.hasOwn(kinds, data.kind) ? data.kind : 'html',
            genre:genres.includes(data.genre) ? data.genre : genres[0],
            synopsis:string(data.synopsis, 6000), html:string(data.html, maxFile), cover:image(data.cover),
            templateHtml:string(data.templateHtml, maxFile), stylePrompt:string(data.stylePrompt, 8000),
            started:data.started === true, example:data.example === true,
            htmlProgress:validProgress(data.htmlProgress) ? data.htmlProgress : null,
            art:Number.isInteger(data.art) && data.art >= 0 && data.art <= 5 ? data.art : 1,
            cast:cast.filter(c => character(c?.id)).map(c => ({id:String(c.id), memory:c.memory === true})),
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
    function validProgress(value) {
        if (value === null || value === undefined) return true;
        try { return JSON.stringify(value).length <= 4096; } catch { return false; }
    }
    function preview(source, progress = null, track = false) {
        const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; form-action 'none'; base-uri 'none'";
        const doc = new DOMParser().parseFromString(stripPackage(source), 'text/html');
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
        const {cast, aware, ...copy} = work;
        return copy;
    }
    function readHtml(source, filename) {
        if (!/<[a-z!][^>]*>/i.test(source) || source.length > maxFile) throw Error('请选择 32 MB 以内的 HTML 文件');
        const doc = new DOMParser().parseFromString(source, 'text/html');
        let pack;
        try { pack = JSON.parse(doc.querySelector('script#acte-package[type="application/json"]')?.textContent); } catch {}
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
    async function ask(messages) {
        const config = {...db.apiSettings, streamEnabled:false};
        if (!config.url || !config.model || !config.key) throw Error('请先配置桌面 API');
        if (typeof BLOCKED_API_DOMAINS !== 'undefined' && BLOCKED_API_DOMAINS.some(domain => config.url.includes(domain))) throw Error('该 API 地址不可用');
        if (config.provider !== 'gemini') config.key = getRandomValue(config.key);
        const req = buildChatApiRequest(config, messages, {temperature:config.temperatureEnabled ? config.temperature : undefined});
        const response = await fetchAiResponse(config, req.requestBody, req.headers, req.endpoint);
        const text = window.KissOfflineGeneration?.split(response).text ?? response;
        if (!text?.trim()) throw Error('模型返回了空内容');
        return unwrap(text);
    }
    function castContext(work) {
        const roles = work.cast.map(row => {
            const c = character(row.id);
            if (!c) return '';
            const profile = {name:name(c), persona:c.persona || ''};
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
    async function installExamples() {
        if (await one('config','examples-v1')) return;
        await dexieDB.transaction('rw',table(),async () => {
            if (await one('config','examples-v1')) return;
            const examples = [
                {title:'末班车以后',kind:'prose',genre:genres[0],art:1,started:true,current:1,
                    synopsis:'如果还有一班车，你会停在现在，还是去另一个世界？',
                    acts:[{title:'误上末班车',rows:[{speaker:'林钧',role:'assistant',text:'站台的灯已经很暗。雨水顺着顶棚落下来，风吹动了他手里那张过期的车票。\n\n*也许她会像上次一样，忽然就不见了。*\n\n**“你还没走？”**'}]},{title:'雨还没停'},{title:'另一条线路'}]},
                {title:'雾中剧场',kind:'dialogue',genre:genres[2],art:2,started:true,
                    synopsis:'闭馆前十五分钟，空荡的观众席里出现了第二张票。',
                    acts:[{title:'闭馆前',rows:[{speaker:'值夜人',role:'assistant',text:'刚才那位观众，和你一起来的吗？'}]},{title:'第二张票'}]},
                {title:'潮汐备忘录',kind:'prose',genre:genres[1],art:3,
                    synopsis:'沿着潮水退去的地方，把没来得及说的话写在纸上。',acts:[{title:'海边的信'}]},
                {title:'双生台',kind:'dialogue',genre:genres[0],art:5,
                    synopsis:'一份过期的节目单上，写着两个人完全相同的名字。',acts:[{title:'镜中人'}]}
            ];
            for (const [i,data] of examples.entries()) {
                const w = makeWork({...data,example:true});
                w.created -= i * 1000;
                await write('work',w);
            }
            await write('config',{id:'examples-v1'});
        });
    }
    window.ActeData = {maxFile,validProgress,installExamples,kinds,genres,presets,uid,esc,image,characters,character,name,list,one,write,remove,revise,makeWork,preview,portable,readHtml,exportHtml,ask,castContext,onlineContext};
})();
