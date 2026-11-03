// Journal generation; the memory workbench owns the page controller.
let generatingChatId = null;
let journalGenerationTask=null;
const journalFingerprint=rows=>JSON.stringify(rows.map(m=>[m.id,window.KissWorkFiles?.summaryText?.(m)||m.content,m.isWithdrawn,m.isThinking]));
function setupMemoryJournalScreen() {}
function renderJournalList() {}

async function generateJournal(start, end, includeFavorited = false, options = {}) {
    if(journalGenerationTask){showToast('已有日记正在生成，请稍候');return;}
    const journalTask={};journalGenerationTask=journalTask;
    const journalChatId = currentChatId, journalChatType = currentChatType;
    showToast('正在生成日记，请稍候...');
    
    // 显示列表占位卡片
    const container = document.getElementById('journal-list-container');
    const placeholder = document.getElementById('no-journals-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    const loadingCard = document.createElement('li');
    loadingCard.className = 'journal-card generating';
    loadingCard.id = 'journal-generating-card';
    loadingCard.innerHTML = `
        <div class="spinner"></div>
        <div class="text">正在${journalChatType === 'group' ? '总结群聊' : '编织回忆'}...</div>
    `;
    
    if (container.firstChild) {
        container.insertBefore(loadingCard, container.firstChild);
    } else {
        container.appendChild(loadingCard);
    }
    container.scrollTop = 0;

    window.KissJournalGenerating = true; 
    generatingChatId = journalChatId;

    try {
        const chat = (journalChatType === 'private') ? db.characters.find(c => c.id === journalChatId) : db.groups.find(g => g.id === journalChatId);
        if (!chat) {
            throw new Error("未找到当前聊天。");
        }

        const originHistory = chat.history, originArchive = chat.activeArchiveId, originPersona = chat.activePersonaId, originAccount=db.activePersonaId;
        const startIndex = start - 1;
        const endIndex = end;
        const journalSnapshot=journalFingerprint(chat.history.slice(startIndex,endIndex));
        
        if (startIndex < 0 || endIndex > chat.history.length || startIndex >= endIndex) {
            throw new Error("无效的消息范围。");
        }

        // ...
        let messagesToSummarize = chat.history.slice(startIndex, endIndex).map(m => window.KissWorkFiles?.summaryMessage?.(m)||({...m}));
        if (options.messageIds) {
            const selected = new Set(options.messageIds);
            messagesToSummarize = messagesToSummarize.filter(m => selected.has(m.id));
        }
        if (!messagesToSummarize.length) throw new Error("未选中有效消息");
        
        // 1. 保持原样：第三个参数设为 true，确保你想要的“高权重”隐藏消息能被读进来
        messagesToSummarize = filterHistoryForAI(chat, messagesToSummarize, true);

        // 2. 【新增】精准剔除 thinking 消息
        // 你的 chat_ai.js 中生成的思考消息带有 isThinking: true 属性
        // 即使它们包含在上下文里，我们也在生成日记前把它们扔掉
        messagesToSummarize = messagesToSummarize.filter(m => !m.isThinking);

        // 3. 【可选保险】防止只有标签没有属性的情况（针对旧历史记录）
        // 如果你担心以前的历史记录里有 thinking 标签但没有 isThinking 属性，可以加一步正则清洗
        messagesToSummarize.forEach(m => {
            if (m.content && typeof m.content === 'string') {
               m.content = m.content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
            }
        });

        if(!messagesToSummarize.some(m=>String(m.content||'').trim()))throw new Error('所选范围没有可整理的聊天内容');
        let worldBooksContent = '';
        let summaryPrompt = '';
        let favoritedJournalsPrompt = '';

        // 新增：读取已收藏的日记 (通用逻辑)
        if (includeFavorited) {
            const favoritedJournals = (chat.memoryJournals || [])
                .filter(j => j.isFavorited && !j.mergedIntoId)
                .map(j => `标题：${j.title}\n内容：${j.content}`)
                .join('\n\n---\n\n');
            
            if (favoritedJournals) {
                favoritedJournalsPrompt = `【过往回顾】\n这是你之前已经写下的内容，请参考它们，以确保新内容的连续性，并避免重复记录已经记录过的事件。\n\n${favoritedJournals}\n\n`;
            }
        }

        if (journalChatType === 'group') {
            // 群聊逻辑
            const worldBooksLimitBreak = (chat.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'limit_break')).filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100));
            const worldBooksBefore = (chat.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'before')).filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100));
            const worldBooksAfter = (chat.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id && (wb.position === 'after' || !wb.position))).filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100));
            const worldBooksGuidelines = (chat.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'guidelines')).filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100));
            
            worldBooksContent = [
                ...worldBooksLimitBreak.map(wb => wb.content),
                ...worldBooksBefore.map(wb => wb.content),
                ...worldBooksAfter.map(wb => wb.content),
                ...worldBooksGuidelines.map(wb => wb.content)
            ].join('\n\n');

            summaryPrompt = `你是一个群聊记录总结助手。请以完全客观的第三视角，对以下群聊记录进行精简总结。\n\n`;
            
            if (favoritedJournalsPrompt) {
                summaryPrompt += favoritedJournalsPrompt;
            }

            // 注入群聊基础信息
            summaryPrompt += `群聊名称: ${chat.name}\n`;
            summaryPrompt += `群成员列表: ${chat.members.map(m => `${m.groupNickname}(${m.realName})`).join(', ')}\n\n`;

            // 注入群聊关联的世界书
            if (worldBooksContent) {
                summaryPrompt += `背景设定参考:\n${worldBooksContent}\n\n`;
            }

            summaryPrompt += `总结要求：\n`;
            summaryPrompt += `1. **客观中立**：使用第三人称视角，不带个人情感色彩，不使用强烈的情绪词汇。\n`;
            summaryPrompt += `2. **精简准确**：只陈述事实，概括主要话题和事件，去除无关的闲聊细节。\n`;
            summaryPrompt += `3. **无升华**：不要进行价值升华、感悟或总结性评价，仅记录发生了什么。\n\n`;

            summaryPrompt += `你的输出必须使用XML标签包裹，包含以下两个部分：\n`;
            summaryPrompt += `<title>格式为“日期·核心事件”，例如“1月20日·讨论周末计划”</title>\n`;
            summaryPrompt += `<content>总结正文。分条列出主要讨论点或事件。</content>\n\n`;

            summaryPrompt += `请严格按照上述XML标签格式输出，不要输出任何其他多余的文字。\n\n`;
            summaryPrompt += `聊天记录如下：\n\n---\n${(() => {
                let lastTime = 0;
                return messagesToSummarize.map(m => {
                    let prefix = '';
                    const currentTime = m.timestamp;
                    const timeDiff = currentTime - lastTime;
                    const isSameDay = new Date(currentTime).toDateString() === new Date(lastTime).toDateString();
                    
                    if (lastTime === 0 || timeDiff > 20 * 60 * 1000 || !isSameDay) {
                        const d = new Date(currentTime);
                        const timeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        prefix = `\n[系统时间: ${timeStr}]\n`;
                    }
                    lastTime = currentTime;
                    return `${prefix}${m.content}`;
                }).join('\n');
            })()}\n---`;

        } else {
            // 私聊逻辑
            // 0. 确保迁移
            migrateJournalSettings(chat);

            // 1. 自动获取通用世界书 (Context)
            const worldBooksLimitBreak = (chat.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'limit_break')).filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100));
            const worldBooksBefore = (chat.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'before')).filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100));
            const worldBooksAfter = (chat.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id && (wb.position === 'after' || !wb.position))).filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100));
            const worldBooksGuidelines = (chat.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'guidelines')).filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100));
            
            worldBooksContent = [
                ...worldBooksLimitBreak.map(wb => wb.content),
                ...worldBooksBefore.map(wb => wb.content),
                ...worldBooksAfter.map(wb => wb.content),
                ...worldBooksGuidelines.map(wb => wb.content)
            ].join('\n\n');

            // 2. 获取风格设置
            const styleSettings = options.styleSettings || chat.journalStyleSettings || { mode: 'default', customWorldBookIds: [] };
            
            // 3. 构建 Prompt
            if (styleSettings.mode === 'summary') {
                // 摘要总结风格
                summaryPrompt = `你是一个专业的对话记录总结助手。请根据提供的聊天记录，生成一份精简的摘要总结。\n\n`;
                
                if (favoritedJournalsPrompt) {
                    summaryPrompt += favoritedJournalsPrompt;
                }

                summaryPrompt += `要求：
1. **体现时间进程**：正文内容必须按时间顺序组织，并明确指出时间点。**格式规范：**请严格按照“x年x月x日，发生了[事件]”的格式进行叙述，确保时间线清晰。
2. **客观平实**：使用第三人称视角，客观陈述事实。**绝对禁止使用强烈的情绪词汇**（如“极度愤怒”、“痛彻心扉”、“欣喜若狂”等），保持冷静、克制的叙述风格。
3. **抓取重点**：识别对话中的核心事件、重要话题转折、关键决策或信息。忽略无关的闲聊和琐碎细节。
4. **关键原话摘录（重要）**：
    - 仅当出现具有**极高情感价值**（如表白、郑重承诺、极具感染力的情感宣泄）或**重大剧情价值**（如揭示核心秘密、决定性瞬间）的对话时，请**直接引用角色的原话**。
    - **引用格式**：使用引号包裹原话，例如：${chat.realName}说：“我永远不会离开你。”
    - **严格控制数量**：只摘录最闪光、最不可替代的那几句。如果聊天记录平淡无奇或全是日常琐事，**请不要摘录任何原话**，以免破坏摘要的精简性。
5. **无升华**：不要进行价值升华、感悟或总结性评价，仅记录发生了什么。

你的输出必须使用XML标签包裹，包含以下两个部分：
<title>格式为“日期范围·核心事件”，例如“1月20日-1月22日·关于旅行计划的讨论”</title>
<content>总结正文</content>

请严格按照上述XML标签格式输出，不要输出任何其他多余的文字。

聊天记录如下：\n\n---\n${(() => {
                let lastTime = 0;
                return messagesToSummarize.map(m => {
                    let prefix = '';
                    const currentTime = m.timestamp;
                    const timeDiff = currentTime - lastTime;
                    const isSameDay = new Date(currentTime).toDateString() === new Date(lastTime).toDateString();
                    
                    if (lastTime === 0 || timeDiff > 20 * 60 * 1000 || !isSameDay) {
                        const d = new Date(currentTime);
                        const timeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        prefix = `\n[系统时间: ${timeStr}]\n`;
                    }
                    lastTime = currentTime;
                    return `${prefix}${m.content}`;
                }).join('\n');
            })()}\n---`;

            } else {
                // 默认风格 (流水账) 或 自定义风格
                // 基础 Prompt (第一人称)
                summaryPrompt = `你是一个日记整理助手。请以角色 "${chat.remarkName || chat.name}" 的第一人称视角，总结以下聊天记录。请专注于重要的情绪、事件和细节。\n\n`;
                
                if (favoritedJournalsPrompt) {
                    summaryPrompt += favoritedJournalsPrompt;
                }

                summaryPrompt += "为了更好地理解角色和背景，请参考以下信息：\n";
                summaryPrompt += "=====\n";

                if (worldBooksContent) {
                    summaryPrompt += `世界观设定:\n${worldBooksContent}\n\n`;
                }

                summaryPrompt += `你的角色设定:\n- 角色名: ${chat.realName}\n- 人设: ${chat.persona || "一个友好、乐于助人的伙伴。"}\n\n`;
                summaryPrompt += `我的角色设定:\n- 我的称呼: ${chat.myName}\n- 我的人设: ${chat.myPersona || "无特定人设。"}\n\n`;
                summaryPrompt += "=====\n";

                // 如果是自定义风格，注入额外要求
                if (styleSettings.mode === 'custom') {
                    const customWorldBooks = (styleSettings.customWorldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id)).filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100));
                    const customStyleContent = customWorldBooks.map(wb => wb.content).join('\n\n');
                    
                    if (customStyleContent) {
                        summaryPrompt += `\n**特别日记格式/风格要求**：\n请优先严格遵循以下风格指南或格式要求来撰写日记：\n${customStyleContent}\n\n`;
                    }
                }

                summaryPrompt += `请基于以上所有背景信息，总结以下聊天记录。你的输出必须使用XML标签包裹，包含 <title>年月日·一个简洁的标题</title> 和 <content>完整的日记正文</content> 两个部分，请严格按照XML标签格式输出，不要输出任何其他多余的文字。聊天记录如下：\n\n---\n${(() => {
                let lastTime = 0;
                return messagesToSummarize.map(m => {
                    let prefix = '';
                    const currentTime = m.timestamp;
                    const timeDiff = currentTime - lastTime;
                    const isSameDay = new Date(currentTime).toDateString() === new Date(lastTime).toDateString();
                    
                    if (lastTime === 0 || timeDiff > 20 * 60 * 1000 || !isSameDay) {
                        const d = new Date(currentTime);
                        const timeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        prefix = `\n[系统时间: ${timeStr}]\n`;
                    }
                    lastTime = currentTime;
                    return `${prefix}${m.content}`;
                }).join('\n');
            })()}\n---`;
            }
        }

        if (journalChatType === 'private' && window.KissTogether) summaryPrompt += await KissTogether.journalContext(chat,messagesToSummarize);

        const apiConfig = resolveAuxiliaryApiConfig('journal');
        let { url, key, model } = apiConfig;
        if (!url || !key || !model) {
            throw new Error("API设置不完整。");
        }

        if (url.endsWith('/')) {
            url = url.slice(0, -1);
        }

        const { requestBody, endpoint, headers } = buildChatApiRequest(
            apiConfig,
            [{ role: 'user', content: summaryPrompt }],
            { temperature: 0.7 }
        );

        const rawContent = await fetchAiResponse(apiConfig, requestBody, headers, endpoint);

        const titleMatch = rawContent.match(/<title>([\s\S]*?)<\/title>/i);
        const contentMatch = rawContent.match(/<content>([\s\S]*?)<\/content>/i);

        const parsedTitle = titleMatch ? titleMatch[1].trim() : "无标题日记";
        const parsedContent = contentMatch ? contentMatch[1].trim() : "内容为空。";

        if (!titleMatch || !contentMatch || !parsedContent) throw new Error("日记返回格式不完整，请重试");

        if (journalFingerprint(chat.history.slice(startIndex,endIndex))!==journalSnapshot || chat.history !== originHistory || chat.activeArchiveId !== originArchive || chat.activePersonaId !== originPersona || db.activePersonaId !== originAccount || !(journalChatType === 'private' ? db.characters : db.groups).includes(chat)) throw new Error("聊天存档已变动，本次日记未写入");
        const newJournal = {
            memoryType: 'summary',
            offlineSummary: !!options.messageIds,
            selectedMessageIds: options.messageIds || null,
            id: `journal_${Date.now()}`,
            range: { start, end },
            startMessageId: chat.history[start - 1]?.id || null,
            endMessageId: chat.history[end - 1]?.id || null,
            title: parsedTitle,
            content: parsedContent,
            createdAt: Date.now(),
            chatId: journalChatId,
            chatType: journalChatType,
            isFavorited: false 
        };

        if (!chat.memoryJournals) {
            chat.memoryJournals = [];
        }
        chat.memoryJournals.push(newJournal);
        const releaseJournal=window.PhoneBackup?.pinChat?.(chat)||(()=>{});
        try { if(window.PhoneBackup?.saveChat)await PhoneBackup.saveChat(chat);else await saveData(); } catch (error) {
            chat.memoryJournals = chat.memoryJournals.filter(item => item !== newJournal);
            throw error;
        } finally {releaseJournal();}

        if (journalChatType === 'private' && window.KissTogether) await KissTogether.journalSaved(chat,newJournal).catch(error=>console.warn('日记已保存，HearU同步待重试',error));

        loadingCard.remove();
        if (currentChatId === journalChatId && currentChatType === journalChatType) {
            try { renderJournalList(); } catch (error) { console.error('日记已保存，列表刷新失败', error); }
        }
        if (!options.messageIds) window.KissJournalMemory?.schedule(chat);
        showToast('新日记已生成！');
        return newJournal;

    } catch (error) {
        // 移除生成卡片
        const card = document.getElementById('journal-generating-card');
        if(card) card.remove();
        
        // 如果列表为空，恢复显示 placeholder
        const chat = (journalChatType === 'private') ? db.characters.find(c => c.id === journalChatId) : db.groups.find(g => g.id === journalChatId);
        if (!chat || !chat.memoryJournals || chat.memoryJournals.length === 0) {
             const placeholder = document.getElementById('no-journals-placeholder');
             if (placeholder) placeholder.style.display = 'block';
        }

        showApiError(error);
    } finally {
        if(journalGenerationTask===journalTask){window.KissJournalGenerating=false;journalGenerationTask=null;generatingChatId=null;}
    }
}

function migrateJournalSettings(chat) {
    if (!chat.journalStyleSettings) {
        const oldJournalIds = chat.journalWorldBookIds || [];
        const chatCommonIds = chat.worldBookIds || [];
        
        // 1. 剔除重复项 (在通用里已存在的)
        const uniqueCustomIds = oldJournalIds.filter(id => !chatCommonIds.includes(id));
        
        // 2. 决定模式
        let newMode = 'default';
        let migrationMsg = '';

        if (oldJournalIds.length > 0) {
            if (uniqueCustomIds.length === 0) {
                // 情况 A: 旧关联全是通用背景 -> 迁移到默认模式
                newMode = 'default';
                migrationMsg = '日记功能升级：已自动关联聊天室背景，您的旧设置已合并到“默认风格”。';
            } else {
                // 情况 B: 有额外的世界书 -> 迁移到自定义模式，保留额外项
                newMode = 'custom';
                migrationMsg = `日记功能升级：已自动关联聊天室背景，剩余 ${uniqueCustomIds.length} 个特殊设定已保留在“自定义风格”中。`;
            }
        } else {
            // 情况 C: 无旧关联 -> 默认
            newMode = 'default';
        }

        // 3. 应用设置
        chat.journalStyleSettings = { 
            mode: newMode, 
            customWorldBookIds: uniqueCustomIds 
        };
        
        return migrationMsg;
    }
    return null;
}

