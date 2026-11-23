// ========== 状态管理 ==========
const state = {
  sites: [],
  tabs: [],
  activeTabId: null,
  isBossMode: true,
  peeking: false,
  hoverEnabled: true,
};

let tabIdCounter = 0;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const siteList = $('#site-list');
const tabBar = $('#tab-bar');
const webviewContainer = $('#webview-container');
const welcomePage = $('#welcome-page');
const bossScreen = $('#boss-screen');
const bossCode = $('.boss-code');
const peekHotspot = $('#peek-hotspot');
const HOTSPOT_PAD = 14;
const statusMode = $('#status-mode');
const statusSite = $('#status-site');
const statusTime = $('#status-time');

// ========== 初始化 ==========
async function init() {
  const defaultSites = await window.moyuAPI.getDefaultSites();
  const customSites = JSON.parse(localStorage.getItem('customSites') || '[]');
  state.sites = [...defaultSites, ...customSites];
  state.hoverEnabled = localStorage.getItem('hoverPeek') !== '0';
  renderSiteList();
  setupEventListeners();
  startClock();
  if (state.sites.length) openSite(state.sites[0]);
  applyBossMode(true);
}

// ========== 老板模式 ==========
function applyBossMode(isBoss) {
  state.isBossMode = isBoss;
  if (isBoss) {
    bossScreen.classList.add('active');
    statusMode.textContent = '💻 工作中';
    statusSite.textContent = 'DataProcessor.py';
  } else {
    setPeek(false);
    bossScreen.classList.remove('active');
    statusMode.textContent = '🐟 摸鱼中';
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    statusSite.textContent = tab ? tab.name : '未选择站点';
  }
  updateAudio();
}

// ========== 悬停预览 ==========
function setPeek(on) {
  if (on === state.peeking) return;
  state.peeking = on;
  bossScreen.classList.toggle('peeking', on);
  updateAudio();
}

function handleCursor({ x, y }) {
  if (!state.isBossMode || !state.hoverEnabled) {
    if (state.peeking) setPeek(false);
    return;
  }
  if (state.peeking) {
    // 已触发：只要光标还在代码区内就保持预览，移出整片代码区才隐藏
    const r = bossCode.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) setPeek(false);
  } else {
    // 未触发：仅当光标落在标记热点行（含容差）时才开启预览
    const h = peekHotspot.getBoundingClientRect();
    const inside =
      x >= h.left - HOTSPOT_PAD && x <= h.right + HOTSPOT_PAD &&
      y >= h.top - HOTSPOT_PAD && y <= h.bottom + HOTSPOT_PAD;
    if (inside) setPeek(true);
  }
}

// 只有当前标签且处于可见状态时才出声，避免老板模式漏音
function updateAudio() {
  const audible = !state.isBossMode || state.peeking;
  webviewContainer.querySelectorAll('webview').forEach((wv) => {
    const isActive = wv.id === `webview-${state.activeTabId}`;
    try { wv.setAudioMuted(!(audible && isActive)); } catch (e) { /* webview 尚未就绪 */ }
  });
}

// ========== 渲染站点列表 ==========
function renderSiteList() {
  siteList.innerHTML = '';
  state.sites.forEach((site, index) => {
    const item = document.createElement('div');
    item.className = 'site-item';
    item.dataset.index = index;
    item.innerHTML = `
      <span class="site-icon">${site.icon}</span>
      <span class="site-name">${site.name}</span>
      <span class="site-remove" title="移除">✕</span>
    `;
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('site-remove')) {
        removeSite(index);
        return;
      }
      openSite(site);
    });
    siteList.appendChild(item);
  });
}

// ========== 打开站点 ==========
function openSite(site) {
  const existing = state.tabs.find((t) => t.url === site.url);
  if (existing) {
    switchTab(existing.id);
    return;
  }

  const tab = {
    id: `tab-${tabIdCounter++}`,
    name: site.name,
    icon: site.icon,
    url: site.url,
  };
  state.tabs.push(tab);

  const webview = document.createElement('webview');
  webview.id = `webview-${tab.id}`;
  webview.src = tab.url;
  webview.setAttribute('allowpopups', '');
  webview.style.width = '100%';
  webview.style.height = '100%';
  webview.addEventListener('dom-ready', updateAudio);
  webviewContainer.appendChild(webview);

  renderTabs();
  switchTab(tab.id);
}

// ========== 渲染标签栏 ==========
function renderTabs() {
  tabBar.innerHTML = '';
  state.tabs.forEach((tab) => {
    const tabEl = document.createElement('div');
    tabEl.className = `tab-item ${tab.id === state.activeTabId ? 'active' : ''}`;
    tabEl.dataset.id = tab.id;
    tabEl.innerHTML = `
      <span class="tab-icon">${tab.icon}</span>
      <span class="tab-name">${tab.name}</span>
      <span class="tab-close" title="关闭">✕</span>
    `;
    tabEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-close')) {
        closeTab(tab.id);
        return;
      }
      switchTab(tab.id);
    });
    tabBar.appendChild(tabEl);
  });
}

// ========== 切换标签 ==========
function switchTab(tabId) {
  state.activeTabId = tabId;
  webviewContainer.querySelectorAll('webview').forEach((wv) => wv.classList.remove('active'));
  const webview = $(`#webview-${tabId}`);
  if (webview) webview.classList.add('active');
  welcomePage.classList.add('hidden');
  renderTabs();

  const tab = state.tabs.find((t) => t.id === tabId);
  $$('.site-item').forEach((item) => {
    item.classList.toggle('active', state.sites[item.dataset.index]?.url === tab?.url);
  });
  if (tab && !state.isBossMode) statusSite.textContent = tab.name;
  updateAudio();
}

// ========== 关闭标签 ==========
function closeTab(tabId) {
  const index = state.tabs.findIndex((t) => t.id === tabId);
  if (index === -1) return;

  const webview = $(`#webview-${tabId}`);
  if (webview) webview.remove();
  state.tabs.splice(index, 1);

  if (state.activeTabId === tabId) {
    if (state.tabs.length > 0) {
      switchTab(state.tabs[Math.min(index, state.tabs.length - 1)].id);
    } else {
      state.activeTabId = null;
      welcomePage.classList.remove('hidden');
      if (!state.isBossMode) statusSite.textContent = '未选择站点';
    }
  }
  renderTabs();
  updateAudio();
}

// ========== 添加自定义站点 ==========
function addCustomSite() {
  const name = $('#input-site-name').value.trim();
  let url = $('#input-site-url').value.trim();
  const icon = $('#input-site-icon').value.trim() || '🌐';
  if (!name || !url) return;
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

  const site = { name, url, icon };
  state.sites.push(site);

  const customSites = JSON.parse(localStorage.getItem('customSites') || '[]');
  customSites.push(site);
  localStorage.setItem('customSites', JSON.stringify(customSites));

  renderSiteList();
  $('#input-site-name').value = '';
  $('#input-site-url').value = '';
  $('#input-site-icon').value = '';
}

// ========== 移除站点 ==========
function removeSite(index) {
  const site = state.sites[index];
  state.sites.splice(index, 1);
  const customSites = JSON.parse(localStorage.getItem('customSites') || '[]');
  const ci = customSites.findIndex((s) => s.url === site.url);
  if (ci !== -1) {
    customSites.splice(ci, 1);
    localStorage.setItem('customSites', JSON.stringify(customSites));
  }
  renderSiteList();
}

// ========== 事件监听 ==========
function setupEventListeners() {
  $('#btn-minimize').addEventListener('click', () => window.moyuAPI.minimize());
  $('#btn-maximize').addEventListener('click', () => window.moyuAPI.maximize());
  $('#btn-close').addEventListener('click', () => window.moyuAPI.close());

  $$('.activity-icon').forEach((icon) => {
    icon.addEventListener('click', () => {
      const panel = icon.dataset.panel;
      if (!panel) return;
      $$('.activity-icon').forEach((i) => i.classList.remove('active'));
      icon.classList.add('active');
      $$('.sidebar-panel').forEach((p) => p.classList.remove('active'));
      $(`#panel-${panel}`)?.classList.add('active');
    });
  });

  $('#btn-add-site').addEventListener('click', addCustomSite);
  $('#input-site-url').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addCustomSite();
  });

  window.moyuAPI.onBossMode((isBoss) => applyBossMode(isBoss));
  window.moyuAPI.onCursorPos(handleCursor);
  window.addEventListener('blur', () => setPeek(false));

  const hoverToggle = $('#toggle-hover');
  const peekHint = $('#peek-hint');
  hoverToggle.checked = state.hoverEnabled;
  peekHint.classList.toggle('off', !state.hoverEnabled);
  hoverToggle.addEventListener('change', () => {
    state.hoverEnabled = hoverToggle.checked;
    localStorage.setItem('hoverPeek', state.hoverEnabled ? '1' : '0');
    peekHint.classList.toggle('off', !state.hoverEnabled);
    if (!state.hoverEnabled) setPeek(false);
  });
}

// ========== 时钟 ==========
function startClock() {
  function update() {
    statusTime.textContent = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  update();
  setInterval(update, 30000);
}

// ========== 启动 ==========
document.addEventListener('DOMContentLoaded', init);
