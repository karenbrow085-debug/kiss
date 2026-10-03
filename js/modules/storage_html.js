// Data management layout; behavior stays in storage.js and kiss-tools.js.
function injectStorageHTML() {
 const screen=document.getElementById('storage-analysis-screen');if(!screen)return;
 screen.innerHTML=`
 <header class="app-header"><button class="back-btn" data-target="home-screen" aria-label="返回">‹</button><div class="title-container"><h1 class="title">数据管理</h1></div><div class="placeholder"></div></header>
 <div class="storage-content-scroll">
  <section class="storage-hero"><span class="storage-eyebrow">LOCAL / YOUR SPACE</span><h2>留一点空间。</h2><div class="storage-overall"><strong data-kt-total-size>—</strong><span>本地数据 · 估算</span></div><p>404、HearU 与浏览器缓存，在这里整理。</p><button type="button" data-kt-manager class="storage-manage-btn">分类查看与清理</button></section>
  <section class="storage-card ios6-grouped-card"><div class="storage-group-title"><span>404 分类概览</span><span class="storage-section-note">BACKUP DATA</span></div><div class="storage-content"><div class="storage-total"><span class="storage-total-label">备份分类估算</span><span class="storage-total-value" id="storage-total-size">0 B</span></div><div class="storage-bar-container"><div class="storage-bar" id="storage-bar-chart"></div></div><div class="storage-legend" id="storage-legend-container"></div><button id="open-clean-cache-btn" class="storage-clean-cache-btn storage-action-btn" type="button">仅清理图片缓存</button></div></section>
  <section class="ios6-grouped-card"><div class="storage-group-title"><span>备份内容</span><button class="storage-select-all-btn" id="storage-select-all-btn" type="button">全不选</button></div><div id="storage-backup-options"></div></section>
  <section class="storage-backup-actions"><div class="storage-group-title"><span>导入与导出</span><span class="storage-section-note">KEEP A COPY</span></div><div class="storage-action-group"><button class="storage-action-btn storage-export-btn" id="storage-export-btn"><span id="storage-export-text">导出备份</span></button><div><input type="file" id="storage-import-file" accept=".json,.ee" class="storage-hidden-input"><label for="storage-import-file" class="storage-action-btn storage-import-btn" id="storage-import-label"><span id="storage-import-text">导入备份</span></label></div></div></section>
  <div id="storage-persistence-container"></div>
  <p class="storage-page-foot">A LITTLE SPACE, FOR WHAT MATTERS.</p>
 </div>`;
}
document.addEventListener('DOMContentLoaded',injectStorageHTML);
