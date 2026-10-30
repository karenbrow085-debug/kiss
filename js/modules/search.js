// --- 搜索聊天记录模块 ---

const SearchSystem = {
    currentScope: 'all', // 'all' or chatId
    currentResults: [],
    searchTimer: null,
    
    // 初始化
    init() {
        // 绑定筛选器点击事件
        const scopeSelect = document.getElementById('search-scope-select');
        if (scopeSelect) {
            scopeSelect.addEventListener('click', () => this.openScopeModal());
        }

        // 绑定忽略状态栏开关事件
        const ignoreStatusSwitch = document.getElementById('search-ignore-status');
        if (ignoreStatusSwitch) {
            ignoreStatusSwitch.addEventListener('change', () => {
                const keyword = document.getElementById('search-history-input').value.trim();
                this.performSearch(keyword);
            });
        }

        // Native-style clear control; keep the search input and filters intact.
        const wrapper=document.querySelector('#search-history-screen .search-input-wrapper');
        if(wrapper&&!document.getElementById('search-clear-btn')){
            const clear=document.createElement('button');clear.type='button';clear.id='search-clear-btn';clear.textContent='×';clear.setAttribute('aria-label','清空搜索');
            clear.onclick=()=>{const input=document.getElementById('search-history-input');input.value='';clearTimeout(this.searchTimer);this.performSearch('');input.focus();};wrapper.append(clear);
        }
        // 绑定搜索输入事件
        const input = document.getElementById('search-history-input');
        if (input) {
            input.addEventListener('input', (e) => {
                // 防抖
                if (this.searchTimer) clearTimeout(this.searchTimer);
                this.searchTimer = setTimeout(() => {
                    this.performSearch(e.target.value.trim());
                }, 300);
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch(e.target.value.trim());
                    input.blur();
                }
            });
        }

        // 绑定取消/返回按钮
        const cancelBtn = document.getElementById('search-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeSearchScreen();
            });
        }
        
        // 模态框关闭事件
        const scopeModal = document.getElementById('search-scope-modal');
        if (scopeModal) {
            scopeModal.addEventListener('click', (e) => {
                if (e.target === scopeModal) {
                    scopeModal.classList.remove('visible');
                }
            });
        }
    },

    // 打开搜索界面
    open() {
        this.requestId=(this.requestId||0)+1; clearTimeout(this.searchTimer); this.currentResults=[];
        // 重置状态
        this.currentScope = 'all';
        this.updateScopeUI();
        document.getElementById('search-history-input').value = '';
        document.getElementById('search-results-container').innerHTML = `
            <div class="search-placeholder">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <p>输入关键词搜索聊天记录</p>

            </div>
        `;
        
        switchScreen('search-history-screen');
        setTimeout(() => {
            document.getElementById('search-history-input').focus();
        }, 100);
    },

    closeSearchScreen() {
        this.requestId=(this.requestId||0)+1;clearTimeout(this.searchTimer);
        switchScreen('more-screen'); // 返回上一个屏幕
    },

    // 执行搜索
    async performSearch(keyword) {
        const requestId=this.requestId=(this.requestId||0)+1;
        const container = document.getElementById('search-results-container');
        this.currentResults = [];
        if (!keyword) {
            container.innerHTML = '<div class="search-placeholder"><p>搜索聊天记录</p></div>';
            return;
        }

        try {
        const ignoreStatus = document.getElementById('search-ignore-status')?.checked;
        const results = [];
        
        // 1. 确定搜索范围
        let targets = [];
        if (this.currentScope === 'all') {
            targets = [
                ...db.characters.map(c => ({...c, type: 'private'})),
                ...db.groups.map(g => ({...g, type: 'group'}))
            ];
        } else {
            const char = db.characters.find(c => c.id === this.currentScope);
            if (char) targets.push({...char, type: 'private'});
            else {
                const group = db.groups.find(g => g.id === this.currentScope);
                if (group) targets.push({...group, type: 'group'});
            }
        }

        // 2. 遍历搜索
        let totalCount = 0;
        
        for (const chat of targets) {
            const source = [...db.characters,...db.groups].find(c => c.id === chat.id);
            const archiveId=source?.activeArchiveId;
            if(!source)continue;
            chat.history = await PhoneBackup.readChatHistory(source);
            if(requestId!==this.requestId)return;
            if(source?.activeArchiveId!==archiveId)continue;
            if (!chat.history || chat.history.length === 0) continue;

            // 获取该聊天的清理正则（如果是私聊）
            let statusRegex = null;
            if (ignoreStatus && chat.type === 'private' && chat.statusPanel && chat.statusPanel.regexPattern) {
                try {
                    statusRegex = new RegExp(chat.statusPanel.regexPattern, 'g');
                } catch (e) {
                    console.error('Invalid status regex:', e);
                }
            }

            const matches = chat.history.filter(msg => {
                // 排除系统消息、撤回消息等（简单处理：只要 content 包含关键词且非空）
                if (!msg.id) return false;
                if (typeof msg.content !== 'string' || msg.isThinking || msg.isWithdrawn || msg.role === 'system' || msg.offlineBoundary || /^<thinking>/i.test(msg.content.trim())) return false;

                // Results must be records that the chat can actually display.
                if(!msg.offlineNarrative && typeof isDebugMode!=='undefined' && !isDebugMode && (
                    msg.isStatusUpdate || /\[(?:system:|系统情景通知：|Private: |Private-End: )/.test(msg.content) ||
                    /\[.*?(?:已接收礼物|同意了.*?的代付请求|拒绝了.*?的代付请求)\]/.test(msg.content) ||
                    (!chat.showStatusUpdateMsg && /\[.*?更新状态为[：:]/.test(msg.content)) ||
                    /\[(?:.*?)\s*(?:发布了一条(?:带图)?动态|评论了.*?|回复.*?|更新了个性签名)[：:][\s\S]+?\]/.test(msg.content)
                )) return false;
                // 过滤特殊消息（互动、表情包、图片等）
                if (this.isSpecialMessage(msg.content, msg)) return false;
                
                // 如果开启忽略状态栏，且消息标记为状态更新，直接排除
                if (ignoreStatus && msg.isStatusUpdate) return false;

                let contentToSearch = msg.content;
                
                // 如果开启忽略状态栏，尝试清理内容
                if (ignoreStatus) {
                    let regexToUse = null;
                    // 优先使用消息快照中的正则
                    if (msg.statusSnapshot && msg.statusSnapshot.regex) {
                        try {
                            regexToUse = new RegExp(msg.statusSnapshot.regex, 'g');
                        } catch (e) {
                            console.error('Invalid snapshot regex:', e);
                        }
                    } else {
                        // 否则使用当前聊天的正则
                        regexToUse = statusRegex;
                    }

                    if (regexToUse) {
                        contentToSearch = contentToSearch.replace(regexToUse, '');
                    }
                }

                // 解析为纯文本进行搜索，避免匹配到发送者名字
                const textToSearch = this.parseMessageContent(contentToSearch, msg);
                return textToSearch.toLowerCase().includes(keyword.toLowerCase());
            }).map(msg => {
                // 在 map 阶段就处理好显示内容，避免重复计算正则
                let displayContent = msg.content;
                
                if (ignoreStatus) {
                    let regexToUse = null;
                    if (msg.statusSnapshot && msg.statusSnapshot.regex) {
                        try {
                            regexToUse = new RegExp(msg.statusSnapshot.regex, 'g');
                        } catch (e) {
                            console.error('Invalid snapshot regex:', e);
                        }
                    } else {
                        regexToUse = statusRegex;
                    }

                    if (regexToUse) {
                        displayContent = displayContent.replace(regexToUse, '');
                    }
                }
                
                // 解析为纯文本
                displayContent = this.parseMessageContent(displayContent, msg);

                return {
                    ...msg,
                    content: displayContent, // 使用处理后的内容用于展示
                    originalContent: msg.content, // 保留原始内容（可选）
                    archiveId,
                    chatId: chat.id,
                    chatType: chat.type,
                    chatName: chat.type === 'private' ? chat.remarkName : chat.name,
                    chatAvatar: chat.avatar
                };
            });

            if (matches.length > 0) {
                // 按时间倒序
                matches.sort((a, b) => b.timestamp - a.timestamp);
                
                results.push({
                    chatId: chat.id,
                    chatType: chat.type,
                    name: chat.type === 'private' ? (chat.remarkName || chat.realName) : chat.name,
                    myAvatar: chat.myAvatar || chat.me?.avatar || db.myPersonaPresets?.find(p=>p.id===db.activePersonaId)?.avatar,
                    members: chat.members || [],
                    avatar: chat.avatar,
                    myName: chat.myName || chat.me?.nickname, // 保存用户在该聊天中的名字
                    count: matches.length,
                    messages: matches
                });
                totalCount += matches.length;
            }
            // Search uses a read-only snapshot; it must never evict a live chat or write its preview.
        }

        if(requestId!==this.requestId)return;
        // 3. 渲染结果
        if (totalCount === 0) {
            container.innerHTML = `
                <div class="search-placeholder">
                    <p>未找到包含“${this.escapeHtml(keyword)}”的记录</p>
                </div>
            `;
            return;
        }

        this.currentResults = results;
        
        // 按匹配数量排序
        results.sort((a, b) => b.count - a.count);

        if (this.currentScope === 'all') {
            this.renderOverview(results, totalCount, keyword);
        } else {
            // 如果是单聊范围，直接展示详情列表
            this.renderDetail(results[0], keyword, true);
        }
        } catch(error){if(requestId===this.requestId){container.innerHTML='<div class="search-placeholder"><p>记录暂未读取成功，请重试</p></div>';showToast(error.message||'搜索失败');}}
    },

    safeAvatar(url) {
        return /^(https?:\/\/|data:image\/|blob:|phone-asset:)/i.test(String(url || '')) ? this.escapeHtml(url) : '';
    },

    snippet(content, keyword) {
        const text = String(content || '').replace(/\s+/g, ' ');
        const at = text.toLowerCase().indexOf(keyword.toLowerCase());
        const start = Math.max(0, at - 18);
        return (start ? '…' : '') + text.slice(start, start + 100) + (text.length > start + 100 ? '…' : '');
    },

    renderOverview(results, totalCount, keyword) {
        const container = document.getElementById('search-results-container');
        container.innerHTML = `<div class="search-stat-header">聊天记录 <span>${totalCount} 条</span></div>`;
        const list = document.createElement('div');
        list.className = 'search-group-list';
        for (const group of results) {
            const item = document.createElement('button');
            item.type = 'button'; item.className = 'search-group-item';
            item.innerHTML = `<img src="${this.safeAvatar(group.avatar)}" class="search-group-avatar" alt=""><div class="search-group-info"><div class="search-group-name"><span>${this.escapeHtml(group.name)}</span><time>${this.dateLabel(group.messages[0].timestamp)}</time></div><div class="search-group-preview">${this.highlightKeyword(this.snippet(group.messages[0].content,keyword),keyword)}</div><div class="search-group-count">共 ${group.count} 条相关的聊天记录</div></div>`;
            item.onclick = () => this.renderDetail(group, keyword);
            list.append(item);
        }
        container.append(list); container.scrollTop = 0;
    },

    dateLabel(timestamp) {
        const date = new Date(timestamp); if (Number.isNaN(date.getTime())) return '';
        return (date.getFullYear() === new Date().getFullYear() ? '' : date.getFullYear()+'年') + (date.getMonth()+1)+'月'+date.getDate()+'日';
    },

    renderDetail(group, keyword, isDirectMode = false) {
        const container = document.getElementById('search-results-container');
        container.innerHTML = '';
        const header = document.createElement('div'); header.className = 'search-detail-header';
        if (!isDirectMode) {
            const back = document.createElement('button'); back.className='search-back-btn';back.textContent='返回';
            back.onclick=()=>this.renderOverview(this.currentResults,this.currentResults.reduce((n,g)=>n+g.count,0),keyword);header.append(back);
        }
        const title=document.createElement('span');title.className='search-detail-title';title.textContent=group.name;header.append(title);container.append(header);
        const count=document.createElement('div');count.className='search-stat-header';count.textContent=group.count+' 条相关的聊天记录';container.append(count);
        const list=document.createElement('div');list.className='search-result-list';
        // Large result sets are appended in batches; the UI stays responsive.
        let offset=0;
        const append=()=>{
            list.querySelector('.search-more')?.remove();
            for(const msg of group.messages.slice(offset,offset+60)){
                const member=group.members.find(m=>String(m.id)===String(msg.senderId));
                const displayName=msg.role==='user'?(group.myName||'我'):(member?.nickname||member?.name||group.name);
                const avatar=msg.role==='user'?group.myAvatar:(member?.avatar||group.avatar);
                const item=document.createElement('button');item.type='button';item.className='search-result-item';
                item.innerHTML=`<img class="search-group-avatar" src="${this.safeAvatar(avatar)}" alt=""><div class="search-group-info"><div class="search-result-header"><span class="search-result-name">${this.escapeHtml(displayName)}</span><time class="search-result-time">${this.dateLabel(msg.timestamp)}</time></div><div class="search-result-content">${this.highlightKeyword(this.snippet(msg.content,keyword),keyword)}</div>${msg.offlineNarrative?'<small class="search-mode-label">线下记录</small>':''}</div>`;
                item.onclick=()=>this.jumpToMessage(msg,item);list.append(item);
            }
            offset+=60;
            if(offset<group.messages.length){const more=document.createElement('button');more.type='button';more.className='search-more';more.textContent='加载更多记录';more.onclick=append;list.append(more);}
        };
        append();container.append(list);container.scrollTop=0;
    },

    async jumpToMessage(msg, button) {
        if(this.jumping)return;
        if(typeof isGenerating!=='undefined'&&isGenerating){showToast('请等当前生成结束后再跳转');return;}
        this.jumping=true;button.disabled=true;const searchSession=this.requestId;
        try {
            const chat=(msg.chatType==='private'?db.characters:db.groups).find(c=>c.id===msg.chatId);
            if(!chat)throw Error('该聊天已不存在');
            if(chat.activeArchiveId!==msg.archiveId)throw Error('聊天存档已切换，请重新搜索');
            await PhoneBackup.hydrateChat(chat);
            if(searchSession!==this.requestId)return;
            if(chat.activeArchiveId!==msg.archiveId)throw Error('聊天存档已切换，请重新搜索');
            const row=chat.history.find(m=>String(m.id)===String(msg.id));
            if(!row)throw Error('这条记录已删除，请重新搜索');
            const opened=await openChatRoom(chat.id,msg.chatType,()=>searchSession===this.requestId&&chat.activeArchiveId===msg.archiveId&&(typeof isGenerating==='undefined'||!isGenerating));
            if(opened===false)return;
            if(row.offlineNarrative||row.offlineSessionId||row.offlineArchiveId){
                if(!window.KissOffline?.jumpToMessage)throw Error('请同时更新线下模块');
                await window.KissOffline.jumpToMessage(chat,row.id);return;
            }
            renderMessages(false,false,row.id);
            // Let the chat's initial bottom-scroll finish before centering the match.
            await new Promise(resolve=>setTimeout(resolve,30));
            if(currentChatId!==chat.id||currentChatType!==msg.chatType)return;
            const node=[...messageArea.querySelectorAll('.message-wrapper[data-id]')].find(el=>String(el.dataset.id)===String(row.id));
            if(!node)throw Error('该记录当前无法显示');
            node.scrollIntoView({block:'center',behavior:'auto'});node.classList.add('search-message-focus');setTimeout(()=>node.classList.remove('search-message-focus'),2200);
        } catch(error){showToast(error.message||'跳转失败');}
        finally{this.jumping=false;button.disabled=false;}
    },

    highlightKeyword(content, keyword) {
        const text=String(content||'');if(!keyword)return this.escapeHtml(text);
        const lower=text.toLowerCase(),needle=keyword.toLowerCase();let from=0,at,html='';
        while((at=lower.indexOf(needle,from))!==-1){html+=this.escapeHtml(text.slice(from,at))+'<mark class="keyword-highlight">'+this.escapeHtml(text.slice(at,at+keyword.length))+'</mark>';from=at+keyword.length;}
        return html+this.escapeHtml(text.slice(from));
    },

    // 打开筛选范围模态框
    openScopeModal() {
        const modal = document.getElementById('search-scope-modal');
        const list = document.getElementById('search-scope-list');
        list.innerHTML = '';

        // 全部选项
        this.createScopeItem(list, 'all', '全部范围', '', this.currentScope === 'all');

        // 角色
        db.characters.forEach(c => {
            this.createScopeItem(list, c.id, c.remarkName, c.avatar, this.currentScope === c.id);
        });

        // 群组
        db.groups.forEach(g => {
            this.createScopeItem(list, g.id, g.name, g.avatar, this.currentScope === g.id);
        });

        modal.classList.add('visible');
    },

    createScopeItem(container, id, name, avatar, isSelected) {
        const item = document.createElement('div');
        item.className = `scope-item ${isSelected ? 'selected' : ''}`;
        
        let iconHtml = '';
        if (id === 'all') {
            iconHtml = `<div class="scope-avatar" style="background:#ddd; display:flex; align-items:center; justify-content:center; color:#fff;">ALL</div>`;
        } else {
            iconHtml = `<img src="${this.safeAvatar(avatar)}" class="scope-avatar" alt="avatar">`;
        }

        item.innerHTML = `
            ${iconHtml}
            <span style="flex:1;">${this.escapeHtml(name)}</span>
            ${isSelected ? '<span style="color:var(--primary-color);">✔</span>' : ''}
        `;

        item.addEventListener('click', () => {
            this.currentScope = id;
            this.updateScopeUI();
            document.getElementById('search-scope-modal').classList.remove('visible');
            
            // 如果已有关键词，立即刷新搜索
            const keyword = document.getElementById('search-history-input').value.trim();
            if (keyword) {
                this.performSearch(keyword);
            }
        });

        container.appendChild(item);
    },

    updateScopeUI() {
        const selectText = document.querySelector('#search-scope-select span');
        if (this.currentScope === 'all') {
            selectText.textContent = '搜索范围：全部';
        } else {
            const target = db.characters.find(c => c.id === this.currentScope) || db.groups.find(g => g.id === this.currentScope);
            if (target) {
                const name = target.remarkName || target.name;
                selectText.textContent = `搜索范围：${name}`;
            }
        }
    },

    isSpecialMessage(content, msg) {
        if (!content) return true;
        
        const urlRegex = /^(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|bmp|svg)|data:image\/[a-z]+;base64,)/i;
        const imageRecogRegex = /\[.*?发来了一张图片：\]/;
        const voiceRegex = /\[.*?的语音：.*?\]/;
        const photoVideoRegex = /\[.*?发来的照片\/视频：.*?\]/;
        const transferRegex = /\[.*?的转账：.*?元.*?\]|\[.*?给你转账：.*?元.*?\]|\[.*?向.*?转账：.*?元.*?\]/;
        const stickerRegex = /\[.*?的表情包：.*?\]|\[.*?发送的表情包：.*?\]/;
        const giftRegex = /\[.*?送来的礼物：.*?\]|\[.*?向.*?送来了礼物：.*?\]/;
        const htmlRegex = /<[a-z][\s\S]*>/i;

        if (giftRegex.test(content)) return true;
        if (stickerRegex.test(content)) return true;
        if (voiceRegex.test(content)) return true;
        if (photoVideoRegex.test(content)) return true;
        if (transferRegex.test(content)) return true;
        if (imageRecogRegex.test(content) || (msg.parts && msg.parts.some(p => p.type === 'image'))) return true;
        if (msg.parts && msg.parts.some(p => p.type === 'html')) return true;
        if (htmlRegex.test(content)) return true;
        if ((urlRegex.test(content) || PhoneBackup.isImage(content))) return true;

        return false;
    },

    parseMessageContent(content, msg) {
        if (!content) return '';
        
        // 虽然 filter 阶段已经过滤了大部分特殊消息，
        // 但保留转换逻辑以防万一，或者处理残留的格式
        
        // 2. 普通文本处理
        let text = content.trim();
        const plainTextMatch = text.match(/^\[.*?：([\s\S]*)\]$/);
        if (plainTextMatch && plainTextMatch[1]) {
            text = plainTextMatch[1].trim();
        }
        text = text.replace(/\[发送时间:.*?\]$/, '').trim(); 
        
        return text;
    },

    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, "&amp;")   // 修复：替换为 &amp;
            .replace(/</g, "&lt;")    // 修复：替换为 &lt;
            .replace(/>/g, "&gt;")    // 修复：替换为 &gt;
            .replace(/"/g, "&quot;")  // 修复：解决了你的红色报错
            .replace(/'/g, "&#039;");
    }
    
};

// 暴露给全局
window.SearchSystem = SearchSystem;
