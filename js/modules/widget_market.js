// --- 小组件市场 (js/modules/widget_market.js) ---

// --- 小组件市场 (js/modules/widget_market.js) ---

// 基础模板库数据 (纯净版骨架)
const basicWidgetTemplates = [
    {
        id: "skeleton-1x1",
        name: "纯净骨架 (1x1)",
        size: "1x1",
        html: `<!-- 1x1 小组件基础骨架 -->
<div id="{{id}}" class="widget-skeleton-1x1">
    <!-- 使用 data-widget-var 绑定变量，data-widget-type 指定类型(text/image) -->
    <div class="content" data-widget-var="text" data-widget-type="text">{{text}}</div>
</div>`,
        css: `/* 1x1 小组件样式 */
#{{id}}.widget-skeleton-1x1 {
    width: 100%;
    height: 100%;
    background: #ffffff; /* 背景颜色 */
    border-radius: 16px; /* 圆角 */
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05); /* 阴影 */
    box-sizing: border-box;
    padding: 10px;
}
#{{id}} .content {
    font-size: 14px;
    color: #333333;
    text-align: center;
    word-break: break-all;
}`,
        js: ``,
        defaultVars: {
            "text": "1x1"
        }
    },
    {
        id: "skeleton-2x2",
        name: "纯净骨架 (2x2)",
        size: "2x2",
        html: `<!-- 2x2 小组件基础骨架 -->
<div id="{{id}}" class="widget-skeleton-2x2">
    <!-- 图片变量示例 -->
    <div class="image-box" data-widget-var="image" data-widget-type="image" style="background-image: url('{{image}}');"></div>
    <!-- 文本变量示例 -->
    <div class="text-box" data-widget-var="title" data-widget-type="text">{{title}}</div>
</div>`,
        css: `/* 2x2 小组件样式 */
#{{id}}.widget-skeleton-2x2 {
    width: 100%;
    height: 100%;
    background: #ffffff;
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
#{{id}} .image-box {
    flex: 1;
    background-size: cover;
    background-position: center;
    background-color: #f0f0f0;
}
#{{id}} .text-box {
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: bold;
    color: #333;
    background: #fff;
}`,
        js: ``,
        defaultVars: {
            "image": "https://i.postimg.cc/GtbTnxhP/o-o-1.jpg",
            "title": "2x2 标题"
        }
    },
    {
        id: "skeleton-4x2",
        name: "纯净骨架 (4x2)",
        size: "4x2",
        html: `<!-- 4x2 小组件基础骨架 (宽版) -->
<div id="{{id}}" class="widget-skeleton-4x2">
    <div class="left-part" data-widget-var="cover" data-widget-type="image" style="background-image: url('{{cover}}');"></div>
    <div class="right-part">
        <div class="title" data-widget-var="title" data-widget-type="text">{{title}}</div>
        <div class="desc" data-widget-var="desc" data-widget-type="text">{{desc}}</div>
    </div>
</div>`,
        css: `/* 4x2 小组件样式 */
#{{id}}.widget-skeleton-4x2 {
    width: 100%;
    height: 100%;
    background: #ffffff;
    border-radius: 20px;
    display: flex;
    flex-direction: row;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
#{{id}} .left-part {
    width: 40%;
    height: 100%;
    background-size: cover;
    background-position: center;
    background-color: #f0f0f0;
}
#{{id}} .right-part {
    width: 60%;
    padding: 15px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    box-sizing: border-box;
}
#{{id}} .title {
    font-size: 16px;
    font-weight: bold;
    color: #333;
    margin-bottom: 8px;
}
#{{id}} .desc {
    font-size: 12px;
    color: #666;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}`,
        js: ``,
        defaultVars: {
            "cover": "https://i.postimg.cc/GtbTnxhP/o-o-1.jpg",
            "title": "4x2 宽版组件",
            "desc": "这里是描述文本，可以点击修改。支持多行显示，超出部分会自动隐藏。"
        }
    },
    {
        id: "skeleton-4x4",
        name: "纯净骨架 (4x4)",
        size: "4x4",
        html: `<!-- 4x4 小组件基础骨架 (大版) -->
<div id="{{id}}" class="widget-skeleton-4x4">
    <div class="header">
        <div class="avatar" data-widget-var="avatar" data-widget-type="image" style="background-image: url('{{avatar}}');"></div>
        <div class="name" data-widget-var="name" data-widget-type="text">{{name}}</div>
    </div>
    <div class="main-content" data-widget-var="content" data-widget-type="text">{{content}}</div>
</div>`,
        css: `/* 4x4 小组件样式 */
#{{id}}.widget-skeleton-4x4 {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
    border-radius: 24px;
    padding: 20px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    box-shadow: 0 6px 16px rgba(0,0,0,0.1);
}
#{{id}} .header {
    display: flex;
    align-items: center;
    margin-bottom: 15px;
}
#{{id}} .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-size: cover;
    background-position: center;
    background-color: #ddd;
    margin-right: 12px;
}
#{{id}} .name {
    font-size: 16px;
    font-weight: bold;
    color: #333;
}
#{{id}} .main-content {
    flex: 1;
    background: rgba(255,255,255,0.6);
    border-radius: 12px;
    padding: 15px;
    font-size: 14px;
    color: #555;
    line-height: 1.6;
    overflow-y: auto;
}`,
        js: ``,
        defaultVars: {
            "avatar": "https://i.postimg.cc/GtbTnxhP/o-o-1.jpg",
            "name": "4x4 大组件",
            "content": "这是一个 4x4 的大尺寸组件骨架。您可以在这里放置更多的内容，例如长文本、列表或复杂的图文排版。"
        }
    }
];

let isWidgetMultiSelectMode = false;
let selectedWidgets = new Set();
let currentWidgetSizeFilter = 'all'; // 'all', '1x1', '2x2', '4x2', '4x4'

// 提取的内置组件模板
const extractedBuiltInTemplates = [
    {
        id: "builtin-ins-2x2",
        name: "INS 风格对话 (2x2)",
        size: "2x2",
        html: `<div id="{{id}}" class="app-grid-widget-container">
   <div class="app-grid-widget">
        <div class="ins-widget">
            <div class="ins-widget-row user">
                <img src="{{avatar1}}" alt="Character Avatar" class="ins-widget-avatar" data-widget-var="avatar1" data-widget-type="image">
                <div class="ins-widget-bubble" data-widget-var="bubble1" data-widget-type="text">{{bubble1}}</div>
            </div>
            <div class="ins-widget-divider"><span>୨୧</span></div>
            <div class="ins-widget-row character">
                <div class="ins-widget-bubble" data-widget-var="bubble2" data-widget-type="text">{{bubble2}}</div>
                <img src="{{avatar2}}" alt="User Avatar" class="ins-widget-avatar" data-widget-var="avatar2" data-widget-type="image">
            </div>
        </div>
   </div>
</div>`,
        css: `#{{id}}.app-grid-widget-container { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; }
#{{id}} .app-grid-widget { width: 90%; height: 90%; background-color: transparent; border-radius: 30px; padding: 0; box-sizing: border-box; border: none; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 0; transition: transform 0.2s ease; }
#{{id}} .ins-widget { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-around; align-items: center; padding: 10px; gap: 5px; box-sizing: border-box; }
#{{id}} .ins-widget-row { display: flex; width: 100%; align-items: center; }
#{{id}} .ins-widget-row.user { justify-content: flex-start; }
#{{id}} .ins-widget-row.character { justify-content: flex-end; }
#{{id}} .ins-widget-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid white; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15); }
#{{id}} .ins-widget-bubble { position: relative; background-color: #fff; border-radius: 15px; padding: 6px 10px; font-size: 12px; color: #333; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.07); max-width: 70%; }
#{{id}} .ins-widget-row.user .ins-widget-bubble { margin-left: 12px; }
#{{id}} .ins-widget-row.character .ins-widget-bubble { margin-right: 12px; }
#{{id}} .ins-widget-bubble::after { content: ''; position: absolute; width: 0; height: 0; border-style: solid; }
#{{id}} .ins-widget-row.user .ins-widget-bubble::after { top: 50%; left: -5.5px; margin-top: -4px; border-width: 4px 6px 4px 0; border-color: transparent #fff transparent transparent; }
#{{id}} .ins-widget-row.character .ins-widget-bubble::after { top: 50%; right: -5.5px; margin-top: -6px; border-width: 6px 0 6px 8px; border-color: transparent transparent transparent #fff; }
#{{id}} .ins-widget-divider { width: 90%; text-align: center; border-bottom: 1.5px dashed #d3d3d3; line-height: 0.1em; margin: 12px 0; }
#{{id}} .ins-widget-divider span { background: transparent; padding: 0 10px; color: #b0b0b0; font-size: 14px; font-weight: bold; }`,
        js: ``,
        defaultVars: {
            "avatar1": "https://i.postimg.cc/Y96LPskq/o-o-2.jpg",
            "bubble1": "„- ω -„",
            "avatar2": "https://i.postimg.cc/GtbTnxhP/o-o-1.jpg",
            "bubble2": "ｷ...✩"
        }
    },
    {
        id: "builtin-polaroid-2x2",
        name: "拍立得照片 (2x2)",
        size: "2x2",
        html: `<div id="{{id}}" class="heart-photo-widget" data-widget-var="image" data-widget-type="image">
    <style>
        #{{id}}.heart-photo-widget::after {
            background-image: url('{{image}}');
        }
    </style>
</div>`,
        css: `#{{id}}.heart-photo-widget { width: 80%; height: auto; aspect-ratio: 83 / 95; background-color: #F0F2F0; padding: 12px 12px 35px 12px; box-shadow: 0 5px 12px rgba(0,0,0,0.15); border: 1px solid #DCDCDC; border-bottom-color: #B0B0B0; border-right-color: #B0B0B0; border-radius: 4px; transform: rotate(4deg); position: relative; cursor: pointer; transition: transform 0.2s ease-in-out; margin: 0 auto; }
#{{id}}.heart-photo-widget:hover { transform: rotate(2deg) scale(1.05); }
#{{id}}.heart-photo-widget::after { content: ''; position: absolute; top: 12px; left: 12px; right: 12px; bottom: 35px; background-size: cover; background-position: center; box-shadow: inset 0px 1px 4px rgba(0, 0, 0, 0.25); border-bottom: 1px solid #C5C2BE; }`,
        js: ``,
        defaultVars: {
            "image": "https://i.postimg.cc/XvFDdTKY/Smart-Select-20251013-023208.jpg"
        }
    },
    {
        id: "builtin-top-panel-4x2",
        name: "顶部面板 (4x2)",
        size: "4x2",
        html: `<div id="{{id}}" class="home-widget-container">
    <div class="central-circle" data-widget-var="centralImage" data-widget-type="image" style="background-image: url('{{centralImage}}');"></div>
    <div class="satellite-oval oval-top-left">
        <span class="satellite-emoji" data-widget-var="tlEmoji" data-widget-type="text">{{tlEmoji}}</span>
        <span class="satellite-text" data-widget-var="tlText" data-widget-type="text">{{tlText}}</span>
    </div>
    <div class="satellite-oval oval-top-right">
        <span class="satellite-emoji" data-widget-var="trEmoji" data-widget-type="text">{{trEmoji}}</span>
        <span class="satellite-text" data-widget-var="trText" data-widget-type="text">{{trText}}</span>
    </div>
    <div class="satellite-oval oval-bottom-left">
        <span class="satellite-emoji" data-widget-var="blEmoji" data-widget-type="text">{{blEmoji}}</span>
        <span class="satellite-text" data-widget-var="blText" data-widget-type="text">{{blText}}</span>
    </div>
    <div class="satellite-oval oval-bottom-right">
        <span class="satellite-emoji" data-widget-var="brEmoji" data-widget-type="text">{{brEmoji}}</span>
        <span class="satellite-text" data-widget-var="brText" data-widget-type="text">{{brText}}</span>
    </div>
    <div class="widget-time" id="time-display-{{id}}">12:00</div>
    <div class="widget-signature" data-widget-var="signature" data-widget-type="text">{{signature}}</div>
    <div class="widget-date" id="date-display-{{id}}">1月1日</div>
    <div class="widget-battery">
        <svg width="32" height="23" viewBox="0 0 24 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 2.5C1 1.94772 1.44772 1.5 2 1.5H20C20.5523 1.5 21 1.94772 21 2.5V9.5C21 10.0523 20.5523 10.5 20 10.5H2C1.44772 10.5 1 10.0523 1 9.5V2.5Z" stroke="#666" stroke-opacity="0.8" stroke-width="1"/>
            <path d="M22.5 4V8" stroke="#666" stroke-opacity="0.8" stroke-width="1.5" stroke-linecap="round"/>
            <rect x="2" y="2.5" width="18" height="7" rx="0.5" fill="#666" fill-opacity="0.8"/>
        </svg>
        <span>100%</span>
    </div>
</div>`,
        css: `#{{id}}.home-widget-container { position: relative; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; transform: scale(0.85); }
#{{id}} .central-circle { width: 95px; height: 95px; border-radius: 50%; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); background-size: cover; background-position: center; transition: transform 0.3s ease; z-index: 2; }
#{{id}} .central-circle:hover { transform: scale(1.05); }
#{{id}} .satellite-oval { position: absolute; width: 120px; height: 45px; background-color: rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px); border-radius: 18px; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08); display: flex; flex-direction: row; align-items: center; justify-content: flex-start; padding: 0 8px; gap: 10px; font-size: 11px; color: #333; font-weight: 405; transition: all 0.3s ease; overflow: hidden; z-index: 1; }
#{{id}} .satellite-oval:hover { transform: scale(1.08); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
#{{id}} .satellite-emoji { font-size: 16px; width: 25px; height: 25px; display: grid; place-items: center; flex-shrink: 0; border-radius: 50%; }
#{{id}} .satellite-text { flex-grow: 1; text-align: left; line-height: 1.4; white-space: normal; border-radius: 5px; padding: 2px 4px; margin: -2px -4px; }
#{{id}} .oval-top-left { top: -10px; left: 10%; }
#{{id}} .oval-top-right { top: -10px; right: 10%; }
#{{id}} .oval-bottom-left { bottom: -10px; left: 10%; }
#{{id}} .oval-bottom-right { bottom: -10px; right: 10%; }
#{{id}} .widget-battery { color: #666; font-family: sans-serif; text-shadow: 0 5px 3px rgba(0,0,0,0.1); font-size: 17px; position: absolute; display: flex; align-items: center; bottom: 10px; right: 15%; }
#{{id}} .widget-battery svg { margin-right: 5px; }
#{{id}} .widget-time { color: #333; font-family: sans-serif; text-shadow: 0 1px 2px rgba(0,0,0,0.1); position: absolute; left: 50%; transform: translateX(-50%); bottom: 5px; font-size: 25px; font-weight: 600; }
#{{id}} .widget-date { color: #666; font-family: sans-serif; text-shadow: 0 1px 2px rgba(0,0,0,0.1); position: absolute; width: 130px; text-align: center; bottom: 10px; left: 15%; font-size: 15px; }
#{{id}} .widget-signature { color: #333; font-family: sans-serif; text-shadow: 0 1px 2px rgba(0,0,0,0.1); position: absolute; left: 50%; transform: translateX(-50%); bottom: -25px; font-size: 14px; font-weight: 500; width: 90%; max-width: 300px; text-align: center; padding: 5px; border-radius: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`,
        js: `function updateWidgetClock() {
    const now = new Date();
    const timeEl = document.getElementById('time-display-{{id}}');
    const dateEl = document.getElementById('date-display-{{id}}');
    if(timeEl) timeEl.innerText = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    if(dateEl) {
        dateEl.innerText = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
    }
}
setInterval(updateWidgetClock, 1000);
updateWidgetClock();`,
        defaultVars: {
            "centralImage": "https://i.postimg.cc/GtbTnxhP/o-o-1.jpg",
            "tlEmoji": "❤️", "tlText": "Love",
            "trEmoji": "🧡", "trText": "Peace",
            "blEmoji": "💛", "blText": "Joy",
            "brEmoji": "💙", "brText": "Hope",
            "signature": "编辑个性签名..."
        }
    }
];

// 初始化预置模板
async function initBuiltInWidgets() {
    if (!db.widgetTemplates) {
        db.widgetTemplates = [];
    }
    
    let changed = false;
    // Preserve custom edits; repair only the old invalid clock identifier.
    for (const template of db.widgetTemplates) {
        if (template && typeof template.js === 'string' && template.js.includes('updateClock_{{id}}')) {
            template.js = template.js.split('updateClock_{{id}}').join('updateWidgetClock');
            changed = true;
        }
    }
    
    // 注入提取的内置组件到“我的组件”
    extractedBuiltInTemplates.forEach(tpl => {
        if (!db.widgetTemplates.find(t => t.id === tpl.id)) {
            db.widgetTemplates.push(JSON.parse(JSON.stringify(tpl)));
            changed = true;
        }
    });

    // 迁移旧的硬编码组件到 addedWidgets
    if (!db.addedWidgets) db.addedWidgets = [];
    if (db.homeLayoutOrder) {
        const oldToNewMap = {
            'widget-top': 'builtin-top-panel-4x2',
            'widget-ins': 'builtin-ins-2x2',
            'widget-heart': 'builtin-polaroid-2x2'
        };
        
        let orderChanged = false;
        for (let i = 0; i < db.homeLayoutOrder.length; i++) {
            const oldId = db.homeLayoutOrder[i];
            if (oldToNewMap[oldId]) {
                const templateId = oldToNewMap[oldId];
                const newInstanceId = `custom-widget-${oldId}-${Date.now()}`;
                
                // 尝试从旧设置中恢复变量
                let vars = {};
                if (oldId === 'widget-top' && db.homeWidgetSettings) {
                    vars = {
                        centralImage: db.homeWidgetSettings.centralCircleImage || "https://i.postimg.cc/GtbTnxhP/o-o-1.jpg",
                        tlEmoji: db.homeWidgetSettings.topLeft?.emoji || "❤️", tlText: db.homeWidgetSettings.topLeft?.text || "Love",
                        trEmoji: db.homeWidgetSettings.topRight?.emoji || "🧡", trText: db.homeWidgetSettings.topRight?.text || "Peace",
                        blEmoji: db.homeWidgetSettings.bottomLeft?.emoji || "💛", blText: db.homeWidgetSettings.bottomLeft?.text || "Joy",
                        brEmoji: db.homeWidgetSettings.bottomRight?.emoji || "💙", brText: db.homeWidgetSettings.bottomRight?.text || "Hope",
                        signature: db.homeSignature || "编辑个性签名..."
                    };
                } else if (oldId === 'widget-ins' && db.insWidgetSettings) {
                    vars = {
                        avatar1: db.insWidgetSettings.avatar1 || "https://i.postimg.cc/Y96LPskq/o-o-2.jpg",
                        bubble1: db.insWidgetSettings.bubble1 || "„- ω -„",
                        avatar2: db.insWidgetSettings.avatar2 || "https://i.postimg.cc/GtbTnxhP/o-o-1.jpg",
                        bubble2: db.insWidgetSettings.bubble2 || "ｷ...✩"
                    };
                } else if (oldId === 'widget-heart' && db.homeWidgetSettings?.polaroidImage) {
                    vars = {
                        image: db.homeWidgetSettings.polaroidImage
                    };
                }

                db.addedWidgets.push({
                    id: newInstanceId,
                    templateId: templateId,
                    vars: vars
                });
                
                db.homeLayoutOrder[i] = newInstanceId;
                orderChanged = true;
                changed = true;
            }
        }
    }

    if (changed) {
        await saveData();
    }
}

function renderWidgetMarket() {
    initBuiltInWidgets().then(() => {
        const total=document.getElementById('ws-studio-total');if(total)total.textContent=(db.widgetTemplates||[]).length+' WIDGETS';
        const myContainer = document.getElementById('widget-my-content');
        const templatesContainer = document.getElementById('widget-templates-content');
        
        if (myContainer) {
            renderWidgetGallery(myContainer, db.widgetTemplates || [], false);
        }
        if (templatesContainer) {
            renderWidgetGallery(templatesContainer, basicWidgetTemplates, true);
        }
    });
}

function renderWidgetAddModal() {
    const listContainer = document.getElementById('widget-add-list');
    const searchInput = document.getElementById('widget-add-search-input');
    const categoryTabs = document.getElementById('widget-add-category-tabs');
    
    if (!listContainer) return;

    let currentFilter = 'all';
    let currentSearch = '';
    if(searchInput)searchInput.value='';
    categoryTabs?.querySelectorAll('.category-tab').forEach(t=>t.classList.toggle('active',t.dataset.size==='all'));

    const updateList = () => {
        let filtered = db.widgetTemplates || [];
        
        if (currentFilter !== 'all') {
            filtered = filtered.filter(t => t.size === currentFilter);
        }
        
        if (currentSearch) {
            const searchLower = currentSearch.toLowerCase();
            filtered = filtered.filter(t => 
                String(t.name || '').toLowerCase().includes(searchLower) || 
                String(t.size || '').toLowerCase().includes(searchLower)
            );
        }
        
        renderWidgetList(listContainer, widgetStudioOrder(filtered,true), true);
    };

    // 绑定搜索
    if (searchInput) {
        searchInput.oninput = (e) => {
            currentSearch = e.target.value;
            updateList();
        };
    }

    // 绑定分类切换
    if (categoryTabs) {
        categoryTabs.onclick = (e) => {
            const tab = e.target.closest('.category-tab');
            if (!tab) return;
            
            categoryTabs.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            currentFilter = tab.getAttribute('data-size');
            updateList();
        };
    }

    // 初始渲染
    updateList();
}

/**
 * 渲染画廊式列表
 * @param {HTMLElement} container 容器
 * @param {Array} templates 模板数组
 * @param {Boolean} isTemplateLibrary 是否为基础模板库
 */
const widgetStudioState={my:{query:'',collection:'all',layout:'grid'},basic:{query:'',collection:'all',layout:'grid'}};
const widgetStudioPendingFavorites=new Set();
const wsIcon=(body)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+body+'</svg>';
const wsGlyph={star:'<path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z"/>',grid:'<path d="M3 3h7v7H3zm11 0h7v7h-7zm0 11h7v7h-7zM3 14h7v7H3z"/>',list:'<path d="M7 5h14M7 12h14M7 19h14M3 5h1m-1 7h1m-1 7h1"/>',plus:'<path d="M12 4v16M4 12h16"/>',import:'<path d="M4 3v18h16V3M12 2v12m-5-5 5 5 5-5"/>',search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>'};
function widgetStudioRefreshCollections(){
 for(const id of ['widget-my-content','widget-templates-content'])document.getElementById(id)?.widgetStudioRefresh?.();
}
async function toggleWidgetFavorite(template,button){
 if(widgetStudioPendingFavorites.has(template.id))return;
 const previous=template.kissFavorite===true;widgetStudioPendingFavorites.add(template.id);button.disabled=true;
 template.kissFavorite=!previous;
 try{await saveData();widgetStudioRefreshCollections();window.KissDiagnostics?.record({app:'widgets',feature:'组件收藏',phase:'end',title:template.kissFavorite?'已收藏组件':'已取消收藏',detail:'尺寸：'+template.size});}
 catch(error){template.kissFavorite=previous;showToast('收藏保存失败，请重试');}
 finally{widgetStudioPendingFavorites.delete(template.id);button.disabled=false;}
}
function widgetStudioOrder(templates,modal=false){
 const rank=t=>modal?({'builtin-ins-2x2':0,'builtin-polaroid-2x2':1,'builtin-top-panel-4x2':2}[t.id]??3):t.size==='1x1'?0:({'builtin-ins-2x2':1,'builtin-polaroid-2x2':2,'builtin-top-panel-4x2':3}[t.id]??4);
 return templates.map((t,i)=>({t,i})).sort((a,b)=>rank(a.t)-rank(b.t)||a.i-b.i).map(x=>x.t);
}
function renderWidgetGallery(container, templates, isTemplateLibrary = false) {
 templates=(Array.isArray(templates)?templates:[]).filter(t=>t&&typeof t==='object');
 const state=widgetStudioState[isTemplateLibrary?'basic':'my'];container.replaceChildren();
 const make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n};
 if(!isTemplateLibrary){const tools=make('div','widget-market-actions-section ws-tools');
  for(const [label,glyph,action] of [['新建组件','plus',()=>openWidgetEditor()],['导入组件','import',()=>document.getElementById('widget-import-input').click()]]){const button=make('button','ws-tool');button.type='button';button.innerHTML=wsIcon(wsGlyph[glyph]);button.append(document.createTextNode(label));button.onclick=action;tools.append(button);}container.append(tools);
 }
 const search=make('label','ws-search');search.innerHTML=wsIcon(wsGlyph.search);const input=make('input','','');input.type='search';input.placeholder=isTemplateLibrary?'搜索基础模板':'搜索我的组件';input.setAttribute('aria-label',input.placeholder);input.value=state.query;search.append(input);container.append(search);
 const nav=make('nav','widget-size-nav');nav.setAttribute('aria-label','按组件尺寸筛选');
 for(const size of ['all','1x1','2x2','4x2','4x4']){const button=make('button','size-nav-item'+(currentWidgetSizeFilter===size?' active':''),size==='all'?'全部':size.replace('x','×'));button.type='button';button.dataset.size=size;button.onclick=()=>{currentWidgetSizeFilter=size;nav.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button))});draw()};button.setAttribute('aria-pressed',String(currentWidgetSizeFilter===size));nav.append(button);}container.append(nav);
 const heading=make('div','ws-collection-heading'),tabs=make('div','ws-collections'),counter=make('small','ws-count');
 if(!isTemplateLibrary){for(const [id,title]of [['favorites','我的收藏'],['all','全部组件']]){const button=make('button','ws-collection-tab',title);button.type='button';button.dataset.collection=id;button.onclick=()=>{state.collection=id;draw()};tabs.append(button);}}else tabs.append(make('h3','','基础模板'));
 const view=make('div','ws-view-options');for(const mode of ['grid','list']){const button=make('button','');button.type='button';button.innerHTML=wsIcon(wsGlyph[mode]);button.dataset.layout=mode;button.setAttribute('aria-label',mode==='grid'?'网格视图':'列表视图');button.onclick=()=>{state.layout=mode;draw()};view.append(button);}heading.append(tabs,counter,view);container.append(heading);
 const results=make('div','ws-results');container.append(results);
 function draw(){
  const top=container.scrollTop,query=state.query.trim().toLowerCase();let rows=isTemplateLibrary?templates:(db.widgetTemplates||[]).filter(t=>t&&typeof t==='object');
  if(!isTemplateLibrary&&state.collection==='favorites')rows=rows.filter(t=>t.kissFavorite===true);
  if(currentWidgetSizeFilter!=='all')rows=rows.filter(t=>t.size===currentWidgetSizeFilter);
  if(query)rows=rows.filter(t=>String(t.name||'').toLowerCase().includes(query)||String(t.size||'').includes(query));
  counter.textContent=rows.length+' 个'+(!isTemplateLibrary&&state.collection==='favorites'?'收藏':'组件');
  tabs.querySelectorAll('button').forEach(b=>{b.classList.toggle('selected',b.dataset.collection===state.collection);b.setAttribute('aria-pressed',String(b.dataset.collection===state.collection));});
  view.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layout===state.layout)));
  results.className='ws-results'+(state.layout==='list'?' ws-list-view':'');
  renderWidgetList(results,widgetStudioOrder(rows),false,isTemplateLibrary,false);
  if(!rows.length){const empty=make('div','ws-empty',!isTemplateLibrary&&state.collection==='favorites'?'还没有收藏，轻点组件上的星标即可收藏。':'没有找到对应组件');if(!isTemplateLibrary&&state.collection==='favorites'){const all=make('button','','查看全部组件');all.type='button';all.onclick=()=>{state.collection='all';draw()};empty.append(all);}results.append(empty);}
  container.scrollTop=top;
 }
 container.widgetStudioRefresh=draw;input.oninput=()=>{state.query=input.value;draw()};draw();
}

function renderGallerySection(container, title, templates, isTemplateLibrary, prependSpecialCards = false) {
    const section = document.createElement('div');
    section.className = 'widget-gallery-section';
    
    section.innerHTML = `
        <div class="widget-gallery-header">
            <div class="widget-gallery-title">${title}</div>
            <div style="font-size: 12px; color: #999;">${templates.length} 个</div>
        </div>
    `;
    
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'widget-gallery-scroll';
    
    renderWidgetList(scrollContainer, templates, false, isTemplateLibrary, prependSpecialCards);
    
    section.appendChild(scrollContainer);
    container.appendChild(section);
}

function renderWidgetList(container, templates, isModal = false, isTemplateLibrary = false, prependSpecialCards = false) {
    // 如果不是画廊滚动容器，则清空（网格模式）
    if (!container.classList.contains('widget-gallery-scroll')) {
        container.innerHTML = '';
    }

    const validTemplates = (Array.isArray(templates) ? templates : []).filter(t => t && typeof t === 'object');
    let cursor = 0;
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'widget-load-more';
    more.style.cssText = 'flex:0 0 130px;min-height:44px;padding:12px;border:1px solid #ddd;border-radius:10px;background:#fff;color:#555;font:inherit;cursor:pointer';
    const appendBatch = () => {
    more.remove();
    const batch = validTemplates.slice(cursor, cursor + 12);
    cursor += batch.length;
    batch.forEach(template => {
        const card = document.createElement('div');
        card.className = 'widget-market-card';
        if (isWidgetMultiSelectMode) card.classList.add('multi-select-mode');
        card.dataset.templateId=template.id;
        card.classList.add('ws-card');
        const isCompact=!isModal&&(template.size==='1x1'||(template.size==='4x2'&&template!==validTemplates.find(t=>t.size==='4x2'))||(template.size==='2x2'&&validTemplates.filter(t=>t.size==='2x2').indexOf(template)>1));
        if(isCompact)card.classList.add('ws-compact-card');
        card.setAttribute('data-size', template.size); // 用于网格布局跨度
        
        if (isWidgetMultiSelectMode && selectedWidgets.has(template.id)) {
            card.classList.add('selected');
        }
        
        // 多选框
        const checkbox = document.createElement('div');
        checkbox.className = 'widget-checkbox';
        card.appendChild(checkbox);

        // 预览区域 (使用新的 True Scale 逻辑)
        const previewCanvas = document.createElement('div');
        previewCanvas.className = 'widget-preview-canvas';
        
        // 根据尺寸设置预览框比例
        let aspectRatio = '1';
        let baseWidth = 160; // 2x2 的基准宽度
        let baseHeight = 160;

        if (template.size === '1x1') {
            baseWidth = 80; baseHeight = 80;
        } else if (template.size === '4x2') {
            aspectRatio = '2 / 1';
            baseWidth = 340; baseHeight = 160;
        } else if (template.size === '4x4') {
            baseWidth = 340; baseHeight = 340;
        }
        
        previewCanvas.style.aspectRatio = aspectRatio;

        // 真实比例缩放包装器
        const scaleWrapper = document.createElement('div');
        scaleWrapper.className = 'widget-true-scale-wrapper';
        scaleWrapper.style.width = `${baseWidth}px`;
        scaleWrapper.style.height = `${baseHeight}px`;
        
        // 计算缩放比例以适应预览框
        // 在 Bottom Sheet 网格中，预览框宽度约为容器的一半减去间距
        const isBottomSheet = container.classList.contains('widget-add-grid');
        const padding = 20;
        const availableWidth = isBottomSheet ? (window.innerWidth * 0.45 - padding) : (140 - padding);
        const scale = Math.min(1, availableWidth / baseWidth);
        scaleWrapper.style.transform = `scale(${scale})`;
        
        previewCanvas.appendChild(scaleWrapper);
        KissWidgetRuntime.preview(scaleWrapper, template);

        // 信息区域
        const infoBox = document.createElement('div');
        infoBox.className = 'info-area';
        infoBox.innerHTML = `
            <div class="widget-name"></div>
            <div class="widget-meta">${template.size} 布局</div>
        `;

        infoBox.querySelector('.widget-name').textContent = String(template.name || '未命名组件').replace(/\s*[（(](?:1x1|2x2|4x2|4x4)[）)]$/i,'');
        infoBox.querySelector('.widget-meta').textContent=String(template.size||'2x2').replace('x','×');
        const cardTools=document.createElement('div');cardTools.className='ws-card-tools';
        if(!isModal&&!isTemplateLibrary){const favorite=document.createElement('button');favorite.type='button';favorite.className='ws-favorite';favorite.setAttribute('aria-label',template.kissFavorite===true?'取消收藏':'收藏组件');favorite.setAttribute('aria-pressed',String(template.kissFavorite===true));favorite.innerHTML=wsIcon(wsGlyph.star);favorite.onclick=e=>{e.stopPropagation();if(!isWidgetMultiSelectMode)toggleWidgetFavorite(template,favorite)};previewCanvas.append(favorite);}
        const menu=document.createElement('button');menu.type='button';menu.className=isModal?'ws-add-mark':'ws-more';menu.setAttribute('aria-label',isModal?'添加到桌面':'组件操作');menu.textContent=isModal?'○':'···';if(isModal&&(db.addedWidgets||[]).some(w=>w.templateId===template.id)){menu.textContent='✓';menu.classList.add('is-added');menu.setAttribute('aria-label','已添加过，再添加一个');}cardTools.append(menu);infoBox.append(cardTools);
        if(!isModal){const index=document.createElement('small');index.className='ws-card-index';index.textContent=String(validTemplates.filter(t=>t.size!=='1x1').indexOf(template)+1).padStart(2,'0');previewCanvas.append(index);}
        card.appendChild(previewCanvas);
        card.appendChild(infoBox);
        
        // 操作栏 (悬浮显示)
        const actionsBox = document.createElement('div');
        actionsBox.className = 'widget-card-actions';
        
        if (isModal) {
            const addBtn = document.createElement('button');
            addBtn.className = 'widget-card-btn';
            addBtn.innerText = '添加到主屏幕';
            // 模态框内直接点击即可，不走防误触
            actionsBox.appendChild(addBtn);
        } else if (isTemplateLibrary) {
            const getBtn = document.createElement('button');
            getBtn.className = 'widget-card-btn';
            getBtn.innerText = '下载模板 (.json)';
            getBtn.onclick = (e) => {
                e.stopPropagation();
                // 防误触逻辑
                if (!card.classList.contains('active')) {
                    activateCard(card);
                    return;
                }
                exportWidgets([template]);
                showToast('已开始下载模板');
            };
            actionsBox.appendChild(getBtn);
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'widget-card-btn';
            copyBtn.style.marginTop = '5px';
            copyBtn.innerText = '加入我的组件';
            copyBtn.onclick = async (e) => {
                e.stopPropagation();
                // 防误触逻辑
                if (!card.classList.contains('active')) {
                    activateCard(card);
                    return;
                }
                const newTemplate = JSON.parse(JSON.stringify(template));
                newTemplate.id = `custom-${Date.now()}`;
                newTemplate.name = newTemplate.name + ' (副本)';
                if (!db.widgetTemplates) db.widgetTemplates = [];
                db.widgetTemplates.push(newTemplate);
                await saveData();
                showToast('已添加到我的组件');
                document.getElementById('widget-tab-my').click();
            };
            actionsBox.appendChild(copyBtn);
        } else {
            const editBtn = document.createElement('button');
            editBtn.className = 'widget-card-btn';
            editBtn.innerText = '编辑组件';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                // 防误触逻辑
                if (!card.classList.contains('active')) {
                    activateCard(card);
                    return;
                }
                openWidgetEditor(template);
            };
            
            const exportBtn = document.createElement('button');
            exportBtn.className = 'widget-card-btn';
            exportBtn.innerText = '导出 JSON';
            exportBtn.onclick = (e) => {
                e.stopPropagation();
                // 防误触逻辑
                if (!card.classList.contains('active')) {
                    activateCard(card);
                    return;
                }
                exportWidgets([template]);
            };
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'widget-card-btn danger';
            deleteBtn.innerText = '删除模板';
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                // 防误触逻辑
                if (!card.classList.contains('active')) {
                    activateCard(card);
                    return;
                }
                if (confirm(`要删除模板 "${template.name}" 吗？\n已添加到主屏幕的该组件也会失效。`)) {
                    await deleteWidgets([template.id]);
                }
            };
            
            actionsBox.appendChild(editBtn);
            actionsBox.appendChild(exportBtn);
            actionsBox.appendChild(deleteBtn);
        }
        
        card.appendChild(actionsBox);
        
        // 辅助函数：激活卡片
        const activateCard = (targetCard) => {
            const wasActive = targetCard.classList.contains('active');
            document.querySelectorAll('.widget-market-card.active').forEach(c => c.classList.remove('active'));
            if (!wasActive) {
                targetCard.classList.add('active');
                const deactive = (event) => {
                    if (!targetCard.contains(event.target)) {
                        targetCard.classList.remove('active');
                        document.removeEventListener('click', deactive);
                    }
                };
                setTimeout(() => document.addEventListener('click', deactive), 10);
            }
        };

        menu.onclick=e=>{if(!isModal&&!isWidgetMultiSelectMode){e.stopPropagation();activateCard(card)}};
        // 点击卡片执行操作
        card.onclick = async (e) => {
            // 如果点击的是按钮，由按钮自身的逻辑处理（包含防误触）
            if (e.target.closest('.widget-card-btn,.ws-favorite')) return;

            if (isWidgetMultiSelectMode && !isModal && !isTemplateLibrary) {
                if (selectedWidgets.has(template.id)) {
                    selectedWidgets.delete(template.id);
                    card.classList.remove('selected');
                } else {
                    selectedWidgets.add(template.id);
                    card.classList.add('selected');
                }
                updateWidgetMultiSelectBar();
                return;
            }

            // 激活悬浮层逻辑
            if (!isModal) {
                activateCard(card);
                return;
            }

            if (isModal) {
                const instanceId = `custom-widget-${Date.now()}`;
                const newInstance = {
                    id: instanceId,
                    templateId: template.id,
                    vars: { ...template.defaultVars }
                };
                
                if (!db.addedWidgets) db.addedWidgets = [];
                db.addedWidgets.push(newInstance);
                
                if (!db.homeLayoutPages) db.homeLayoutPages = [[]];
                db.homeLayoutPages[0].push(instanceId);
                
                if (!db.homeLayoutOrder) db.homeLayoutOrder = [];
                db.homeLayoutOrder.push(instanceId);
                
                await saveData();
                showToast('已添加到主屏幕');
                
                document.getElementById('widget-add-modal').classList.remove('visible');
                setupHomeScreen();
                enterHomeEditMode();
            }
        };

        container.appendChild(card);
    });
    if (cursor < validTemplates.length) {
        more.textContent = '加载更多（' + (validTemplates.length - cursor) + '）';
        container.appendChild(more);
    }
    };
    more.onclick = appendBatch;
    appendBatch();
}

// 导出小组件
function exportWidgets(templates) {
    const dataStr = JSON.stringify(templates.length === 1 ? templates[0] : templates, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = templates.length === 1 ? `widget_${templates[0].name}.json` : `widgets_export_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 删除小组件
async function deleteWidgets(ids) {
    db.widgetTemplates = db.widgetTemplates.filter(t => !ids.includes(t.id));
    // 清理已添加的实例
    if (db.addedWidgets) {
        db.addedWidgets = db.addedWidgets.filter(w => !ids.includes(w.templateId));
    }
    // 清理布局顺序
    if (db.homeLayoutOrder) {
        const validInstanceIds = db.addedWidgets ? db.addedWidgets.map(w => w.id) : [];
        db.homeLayoutOrder = db.homeLayoutOrder.filter(id => 
            !id.startsWith('custom-widget-') || validInstanceIds.includes(id)
        );
    }
    await saveData();
    renderWidgetMarket();
    setupHomeScreen();
}

// 更新多选栏状态
function updateWidgetMultiSelectBar() {
    const countSpan = document.getElementById('widget-select-count');
    if (countSpan) {
        countSpan.innerText = `已选 ${selectedWidgets.size} 项`;
    }
}

// 打开编辑器
function openWidgetEditor(template = null) {
    const modal = document.getElementById('widget-editor-modal');
    const idInput = document.getElementById('widget-edit-id');
    const nameInput = document.getElementById('widget-edit-name');
    const sizeSelect = document.getElementById('widget-edit-size');
    const htmlInput = document.getElementById('widget-edit-html');
    const cssInput = document.getElementById('widget-edit-css');
    const jsInput = document.getElementById('widget-edit-js');
    const varsInput = document.getElementById('widget-edit-vars');
    const title = document.getElementById('widget-editor-title');

    if (template) {
        title.innerText = '编辑小组件';
        idInput.value = template.id;
        nameInput.value = template.name;
        sizeSelect.value = template.size;
        htmlInput.value = template.html;
        cssInput.value = template.css;
        jsInput.value = template.js || '';
        varsInput.value = JSON.stringify(template.defaultVars || {}, null, 2);
    } else {
        title.innerText = '新建小组件';
        idInput.value = '';
        nameInput.value = '';
        sizeSelect.value = '2x2';
        htmlInput.value = `<div id="{{id}}" class="my-widget">\n  <div data-widget-var="text" data-widget-type="text">{{text}}</div>\n</div>`;
        cssInput.value = `#{{id}}.my-widget {\n  width: 100%;\n  height: 100%;\n  background: #fff;\n  border-radius: 16px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}`;
        jsInput.value = ``;
        varsInput.value = `{\n  "text": "Hello World"\n}`;
    }

    modal.classList.add('visible');
}

// 绑定事件
document.addEventListener('DOMContentLoaded', () => {
    // Tabs
    const tabMy = document.getElementById('widget-tab-my');
    const tabTemplates = document.getElementById('widget-tab-templates');
    const contentMy = document.getElementById('widget-my-content');
    const contentTemplates = document.getElementById('widget-templates-content');
    const multiSelectBtn = document.getElementById('widget-multi-select-btn');

    if (tabMy && tabTemplates) {
        tabMy.addEventListener('click', () => {
            tabMy.classList.add('active');
            tabMy.style.borderBottomColor = 'var(--primary-color)';
            tabMy.style.color = 'var(--primary-color)';
            tabTemplates.classList.remove('active');
            tabTemplates.style.borderBottomColor = 'transparent';
            tabTemplates.style.color = '#999';
            
            contentMy.style.display = 'block';
            contentTemplates.style.display = 'none';
            multiSelectBtn.style.display = 'block';
            
            currentWidgetSizeFilter = 'all'; // 切换 Tab 时重置过滤器
            renderWidgetMarket();
        });

        tabTemplates.addEventListener('click', () => {
            tabTemplates.classList.add('active');
            tabTemplates.style.borderBottomColor = 'var(--primary-color)';
            tabTemplates.style.color = 'var(--primary-color)';
            tabMy.classList.remove('active');
            tabMy.style.borderBottomColor = 'transparent';
            tabMy.style.color = '#999';
            
            contentTemplates.style.display = 'block';
            contentMy.style.display = 'none';
            
            // 退出多选模式
            if (isWidgetMultiSelectMode) {
                document.getElementById('widget-cancel-multi-select-btn').click();
            }
            multiSelectBtn.style.display = 'none';
            
            currentWidgetSizeFilter = 'all'; // 切换 Tab 时重置过滤器
            renderWidgetMarket();
        });
    }

    // Multi-select
    const cancelMultiSelectBtn = document.getElementById('widget-cancel-multi-select-btn');
    const multiSelectBar = document.getElementById('widget-multi-select-bar');
    const batchExportBtn = document.getElementById('widget-batch-export-btn');
    const batchDeleteBtn = document.getElementById('widget-batch-delete-btn');

    if (multiSelectBtn) {
        multiSelectBtn.addEventListener('click', () => {
            isWidgetMultiSelectMode = true;
            selectedWidgets.clear();
            multiSelectBtn.style.display = 'none';
            cancelMultiSelectBtn.style.display = 'block';
            multiSelectBar.style.display = 'flex';
            
            document.querySelectorAll('#widget-market-screen .widget-market-card').forEach(card => {
                card.classList.add('multi-select-mode');
            });
            updateWidgetMultiSelectBar();
        });
    }

    if (cancelMultiSelectBtn) {
        cancelMultiSelectBtn.addEventListener('click', () => {
            isWidgetMultiSelectMode = false;
            selectedWidgets.clear();
            cancelMultiSelectBtn.style.display = 'none';
            multiSelectBtn.style.display = 'block';
            multiSelectBar.style.display = 'none';
            
            document.querySelectorAll('#widget-market-screen .widget-market-card').forEach(card => {
                card.classList.remove('multi-select-mode', 'selected');
            });
        });
    }

    if (batchExportBtn) {
        batchExportBtn.addEventListener('click', () => {
            if (selectedWidgets.size === 0) return showToast('请先选择小组件');
            const templatesToExport = db.widgetTemplates.filter(t => selectedWidgets.has(t.id));
            exportWidgets(templatesToExport);
            cancelMultiSelectBtn.click();
        });
    }

    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', async () => {
            if (selectedWidgets.size === 0) return showToast('请先选择小组件');
            if (confirm(`确定要删除选中的 ${selectedWidgets.size} 个小组件吗？`)) {
                await deleteWidgets(Array.from(selectedWidgets));
                cancelMultiSelectBtn.click();
            }
        });
    }

    // Editor
    const editorModal = document.getElementById('widget-editor-modal');
    const editorForm = document.getElementById('widget-editor-form');
    const editorCancelBtn = document.getElementById('widget-editor-cancel-btn');

    if (editorCancelBtn) {
        editorCancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            editorModal.classList.remove('visible');
        });
    }

    if (editorForm) {
        editorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const id = document.getElementById('widget-edit-id').value || `custom-${Date.now()}`;
            const name = document.getElementById('widget-edit-name').value;
            const size = document.getElementById('widget-edit-size').value;
            const html = document.getElementById('widget-edit-html').value;
            const css = document.getElementById('widget-edit-css').value;
            const js = document.getElementById('widget-edit-js').value;
            let vars = {};
            
            try {
                const varsStr = document.getElementById('widget-edit-vars').value;
                if (varsStr.trim()) {
                    vars = JSON.parse(varsStr);
                }
            } catch (err) {
                showToast('默认变量 JSON 格式错误');
                return;
            }

            const template = { id, name, size, html, css, js, defaultVars: vars };

            if (!db.widgetTemplates) db.widgetTemplates = [];
            
            const existingIndex = db.widgetTemplates.findIndex(t => t.id === id);
            if (existingIndex >= 0) {
                db.widgetTemplates[existingIndex] = {...db.widgetTemplates[existingIndex],...template};
            } else {
                db.widgetTemplates.push(template);
            }

            await saveData();
            showToast('保存成功');
            editorModal.classList.remove('visible');
            renderWidgetMarket();
            setupHomeScreen(); // 刷新主屏幕上可能存在的实例
        });
    }
});

// 绑定导入按钮
document.addEventListener('DOMContentLoaded', () => {
    const importInput = document.getElementById('widget-import-input');

    if (importInput) {
        importInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const template = JSON.parse(event.target.result);
                    
                    // 简单验证
                    if (!template.id || !template.name || !template.html || !template.css) {
                        throw new Error('无效的小组件格式');
                    }
                    
                    // 兼容旧版本没有 js 字段的情况
                    if (template.js === undefined) {
                        template.js = '';
                    }

                    if (!db.widgetTemplates) db.widgetTemplates = [];
                    
                    // 检查是否已存在
                    const existingIndex = db.widgetTemplates.findIndex(t => t.id === template.id);
                    if (existingIndex >= 0) {
                        if (confirm('已存在同名模板，是否覆盖？')) {
                            db.widgetTemplates[existingIndex] = {...db.widgetTemplates[existingIndex],...template};
                        } else {
                            return;
                        }
                    } else {
                        db.widgetTemplates.push(template);
                    }

                    await saveData();
                    showToast('导入成功');
                    renderWidgetMarket();
                    
                    syncHomeWidgetStyles();

                } catch (error) {
                    console.error(error);
                    showToast('导入失败：' + error.message);
                }
                importInput.value = ''; // 清空 input
            };
            reader.readAsText(file);
        });
    }
});

// 处理主屏幕上自定义小组件的点击事件 (变量修改)
document.addEventListener('DOMContentLoaded', () => {
    const homeScreen = document.getElementById('home-screen');
    const modal = document.getElementById('widget-var-edit-modal');
    const form = document.getElementById('widget-var-edit-form');
    const input = document.getElementById('widget-var-input');
    const fileUploadContainer = document.getElementById('widget-var-file-upload-container');
    const fileUpload = document.getElementById('widget-var-file-upload');
    const preview = document.getElementById('widget-var-image-preview');
    const cancelBtn = document.getElementById('widget-var-cancel-btn');
    
    const instanceIdInput = document.getElementById('widget-var-instance-id');
    const keyInput = document.getElementById('widget-var-key');
    const typeInput = document.getElementById('widget-var-type');

    if (!homeScreen || !modal || !form) return;

    homeScreen.addEventListener('click', (e) => {
        if (isHomeEditMode) return; // 编辑模式下不触发变量修改

        const target = e.target.closest('[data-widget-var]');
        if (!target) return;

        const instanceContainer = target.closest('[data-id^="custom-widget-"]');
        if (!instanceContainer) return;

        const instanceId = instanceContainer.getAttribute('data-id');
        const varKey = target.getAttribute('data-widget-var');
        const varType = target.getAttribute('data-widget-type') || 'text';

        const instance = db.addedWidgets.find(w => w.id === instanceId);
        if (!instance) return;

        const template = db.widgetTemplates?.find(t => t?.id === instance.templateId);
        const currentValue = instance.vars?.[varKey] ?? template?.defaultVars?.[varKey] ?? '';
        fileUpload.dataset.base64 = '';

        // 填充表单
        instanceIdInput.value = instanceId;
        keyInput.value = varKey;
        typeInput.value = varType;
        input.value = currentValue;

        if (varType === 'image') {
            fileUploadContainer.style.display = 'block';
            preview.style.display = 'flex';
            if (currentValue) {
                preview.style.backgroundImage = `url("${currentValue}")`;
                preview.innerHTML = '';
            } else {
                preview.style.backgroundImage = 'none';
                preview.innerHTML = '<span>预览</span>';
            }
        } else {
            fileUploadContainer.style.display = 'none';
            preview.style.display = 'none';
        }

        modal.classList.add('visible');
    });

    // 图片预览逻辑
    input.addEventListener('input', () => {
        if (typeInput.value === 'image') {
            const url = input.value.trim();
            if (url) {
                preview.style.backgroundImage = `url("${url}")`;
                preview.innerHTML = '';
                fileUpload.value = null;
            } else {
                preview.style.backgroundImage = 'none';
                preview.innerHTML = '<span>预览</span>';
            }
        }
    });

    fileUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const compressedUrl = await compressImage(file, { quality: 0.8, maxWidth: 800, maxHeight: 800 });
                preview.style.backgroundImage = `url("${compressedUrl}")`;
                preview.innerHTML = '';
                input.value = ''; // 清空 URL 输入框
                // 临时存储 base64
                fileUpload.dataset.base64 = compressedUrl;
            } catch (error) {
                showToast('图片处理失败');
            }
        }
    });

    cancelBtn.addEventListener('click', () => {
        modal.classList.remove('visible');
        fileUpload.dataset.base64 = '';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const instanceId = instanceIdInput.value;
        const varKey = keyInput.value;
        const varType = typeInput.value;
        
        let newValue = input.value.trim();
        
        if (varType === 'image' && fileUpload.dataset.base64) {
            newValue = fileUpload.dataset.base64;
        }

        const instance = db.addedWidgets.find(w => w.id === instanceId);
        if (instance) {
            if (!instance.vars || typeof instance.vars !== 'object') instance.vars = {};
            instance.vars[varKey] = newValue;
            await saveData();
            showToast('修改已保存');
            setupHomeScreen(); // 重新渲染主屏幕
        }
        
        modal.classList.remove('visible');
        fileUpload.dataset.base64 = '';
    });
});

// Desktop CSS is limited to installed templates. Market previews are isolated.
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(syncHomeWidgetStyles, 500);
});
