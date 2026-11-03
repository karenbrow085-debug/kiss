document.addEventListener('DOMContentLoaded', () => {
    const shopHtml = `
    <header class="app-header shop-market-header">
        <button class="back-btn" data-target="chat-room-screen" aria-label="返回聊天">‹</button>
        <div class="shop-market-brand"><h1 class="title">心意商城</h1><span>好好逛 · 慢慢挑</span></div>
        <div class="shop-market-actions"><button type="button" id="shop-refresh-btn" title="重新进货">进货</button><button type="button" id="shop-more-btn" title="商城管理">管理</button></div>
    </header>
    <div class="shop-search-wrap"><form id="shop-search-form" role="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m16 16 5 5"></path></svg><input id="shop-search-input" type="search" aria-label="搜索商城商品" placeholder="搜点喜欢的，送给特别的TA" autocomplete="off"><button type="submit">搜索</button></form></div>
    <nav class="shop-tabs" aria-label="商城分类"></nav>
    <main class="content shop-market-content" id="shop-content-container"></main>
    <nav class="shop-market-nav" aria-label="商城导航"><button type="button" data-market-nav="home"><svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10H3Z"></path><path d="M9 20v-7h6v7"></path></svg><span>首页</span></button><button type="button" data-market-nav="categories"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"></rect><rect x="14" y="3" width="7" height="7" rx="2"></rect><rect x="3" y="14" width="7" height="7" rx="2"></rect><rect x="14" y="14" width="7" height="7" rx="2"></rect></svg><span>分类</span></button><div id="shop-market-cart-slot"></div><button type="button" data-market-nav="favorites"><svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"></path></svg><span>心动清单</span></button></nav>
    <div id="shop-feature-overlay" class="shop-feature-overlay" hidden><section class="shop-feature-sheet" role="dialog" aria-modal="true" aria-labelledby="shop-feature-title"><header><h2 id="shop-feature-title">商品详情</h2><button type="button" id="shop-feature-close" aria-label="关闭商城弹窗">×</button></header><div id="shop-feature-body"></div></section></div>
    <div id="shop-delivery-modal" class="modal-overlay">
        <div class="modal-window">
            <h3 id="shop-delivery-item-name">确认订单</h3>
            <p style="color: #666; font-size: 14px; margin-bottom: 15px;">请选择配送方式：</p>
            <div class="delivery-options">
                <div class="delivery-option-card active" data-type="timed" onclick="selectDeliveryOption('timed')">
                    <div class="delivery-icon">🛵</div>
                    <div class="delivery-info">
                        <div class="delivery-title">定时送达</div>
                        <div class="delivery-desc">预计 30 分钟内送达</div>
                    </div>
                    <div class="delivery-check"></div>
                </div>
                <div class="delivery-option-card" data-type="instant" onclick="selectDeliveryOption('instant')">
                    <div class="delivery-icon">⚡</div>
                    <div class="delivery-info">
                        <div class="delivery-title">即时送达</div>
                        <div class="delivery-desc">加急配送，立即送出</div>
                    </div>
                    <div class="delivery-check"></div>
                </div>
                <div class="delivery-option-card" data-type="pickup" onclick="selectDeliveryOption('pickup')">
                    <div class="delivery-icon">🏪</div>
                    <div class="delivery-info">
                        <div class="delivery-title">门店自提</div>
                        <div class="delivery-desc">凭口令到店领取</div>
                    </div>
                    <div class="delivery-check"></div>
                </div>
                <div class="delivery-option-card" data-type="pay-for-me" onclick="selectDeliveryOption('pay-for-me')">
                    <div class="delivery-icon">🥺</div>
                    <div class="delivery-info">
                        <div class="delivery-title">让Ta买单</div>
                        <div class="delivery-desc">发送代付请求</div>
                    </div>
                    <div class="delivery-check"></div>
                </div>
            </div>
            
            <div id="pickup-code-input-container" style="display: none; margin-top: 15px;">
                <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;">自提口令</label>
                <input type="text" id="shop-pickup-code" placeholder="输入取货码/口令" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; outline: none;">
            </div>

            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button id="shop-delivery-confirm" class="btn btn-primary" style="flex: 1;">确认下单</button>
                <button id="shop-delivery-cancel" class="btn btn-neutral" style="flex: 1;">取消</button>
            </div>
        </div>
    </div>

    <!-- Shop More ActionSheet -->
    <div id="shop-more-actionsheet" class="action-sheet-overlay">
        <div class="action-sheet">
            <button class="action-sheet-button" id="shop-pickup-btn">🎁 提取商品 (输入口令)</button>
            <button class="action-sheet-button" id="shop-category-manage-btn">🏷️ 自定义分类</button>
            <button class="action-sheet-button danger" id="shop-more-cancel-btn">取消</button>
        </div>
    </div>

    <!-- Shop Category Manage Modal -->
    <div id="shop-category-manage-modal" class="modal-overlay">
        <div class="modal-window" style="max-height: 85vh; overflow-y: auto;">
            <h3>商城分类管理</h3>
            <div style="font-size: 12px; color: #666; margin-bottom: 10px; background: #f9f9f9; padding: 8px; border-radius: 6px;">
                添加自定义分类后，下次进货时 AI 将会根据你的提示词生成对应商品。
            </div>

            <div class="form-group" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                <label for="shop-item-count" style="margin: 0;">每个分类生成数量</label>
                <input type="number" id="shop-item-count" value="8" min="1" max="20" style="width: 60px; text-align: center;">
            </div>
            
            <div id="shop-category-list" style="margin-bottom: 15px; border: 1px solid #eee; border-radius: 8px; padding: 10px; min-height: 100px;">
                <!-- JS populated list -->
            </div>

            <div class="form-group" style="border-top: 1px solid #eee; padding-top: 15px;">
                <label style="font-weight: bold; margin-bottom: 10px; display: block;">添加新分类</label>
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <input type="text" id="shop-cat-id" placeholder="英文id (如: flower)" style="flex: 1; min-width: 0;" required>
                    <input type="text" id="shop-cat-name" placeholder="显示名称 (如: 🌸 花)" style="flex: 1; min-width: 0;" required>
                </div>
                <textarea id="shop-cat-prompt" rows="2" placeholder="简短的提示词：描述这个分类下应该卖什么商品..." style="width: 100%; margin-bottom: 10px;" required></textarea>
                <button id="shop-add-category-btn" class="btn btn-secondary" style="width: 100%;">+ 添加分类</button>
            </div>
            
            <div style="margin-top: 10px; text-align: right;">
                <button id="shop-category-close-btn" class="btn btn-primary" style="width: 100%;">完成</button>
            </div>
        </div>
    </div>

    <!-- Shop Pickup Modal -->
    <div id="shop-pickup-modal" class="modal-overlay">
        <div class="modal-window">
            <h3>提取商品</h3>
            <p style="color: #666; font-size: 14px; margin-bottom: 15px;">请输入订单中的自提口令或暗号：</p>
            <div class="form-group">
                <input type="text" id="shop-pickup-input" placeholder="例如：888888 或 汪汪汪" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; outline: none; font-size: 16px; text-align: center;">
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button id="shop-pickup-confirm" class="btn btn-primary" style="flex: 1;">确认提取</button>
                <button id="shop-pickup-cancel" class="btn btn-neutral" style="flex: 1;">取消</button>
            </div>
        </div>
    </div>
    `;
    const container = document.getElementById('shop-screen');
    if (container) {
        container.innerHTML = shopHtml;
    }
});
