/**
 * 止痕 Trace Off v1.0.4 - Service Worker
 */
let blocked = [], enabled = true, masks = {};
const tabOriginals = {}; // { tabId: { title, url } }

async function load() {
  const r = await chrome.storage.local.get(['domains','interceptionEnabled']);
  blocked = (r.domains||[]).filter(d=>d.enabled).map(d=>d.domain);
  enabled = r.interceptionEnabled !== false;
  masks = {};
  (r.domains||[]).forEach(d => { if(d.maskTitle || d.maskDomain) masks[d.domain] = { title: d.maskTitle, domain: d.maskDomain }; });
}

function match(url) {
  try {
    const h = new URL(url).hostname;
    return blocked.some(d => h===d || h.endsWith('.'+d));
  } catch { return false; }
}
function matchMask(url) {
  try {
    const h = new URL(url).hostname;
    for (const [domain, cfg] of Object.entries(masks)) {
      if (h===domain || h.endsWith('.'+domain)) return cfg;
    }
  } catch {}
  return null;
}

// 应用伪装
async function applyMask(tabId, cfg) {
  try {
    const title = resolveTitle(cfg);
    const favicon = await resolveFavicon(cfg);
    if (!title && !favicon) return;
    const [r] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (title, favicon) => {
        const orig = { title: document.title, favicons: [] };
        // 保存并修改已有 favicon 链接（修改 href 比删除重建更可靠触发 Chrome 更新）
        document.querySelectorAll('link[rel*="icon"]').forEach(e => {
          orig.favicons.push({ rel: e.rel, href: e.href, sizes: e.getAttribute('sizes') || '', type: e.type });
          e.href = favicon;
          e.setAttribute('sizes', '64x64');
        });
        // 如果页面本身没有 favicon，注入一个
        if (!orig.favicons.length && favicon) {
          const link = document.createElement('link');
          link.rel = 'icon'; link.href = favicon;
          link.setAttribute('sizes', '64x64');
          link.dataset.traceoffMask = '1';
          document.head.appendChild(link);
        }
        if (title) document.title = title;
        return orig;
      },
      args: [title, favicon],
    });
    if (r?.result) tabOriginals[tabId] = r.result;
  } catch {}
}

// 恢复原始标题/图标
async function restoreMask(tabId) {
  if (!tabOriginals[tabId]) return;
  try {
    const orig = tabOriginals[tabId];
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (title, favicons) => {
        if (title) document.title = title;
        // 移除注入的伪装图标（仅针对新创建的）
        document.querySelectorAll('link[data-traceoff-mask]').forEach(e => e.remove());
        // 恢复原始图标的 href
        if (favicons && favicons.length) {
          const existing = [...document.querySelectorAll('link[rel*="icon"]:not([data-traceoff-mask])')];
          favicons.forEach((fi, i) => {
            if (existing[i]) {
              existing[i].href = fi.href;
              if (fi.sizes) existing[i].setAttribute('sizes', fi.sizes);
              if (fi.type) existing[i].type = fi.type;
            }
          });
        }
      },
      args: [orig.title || '', orig.favicons || []],
    });
  } catch {}
  delete tabOriginals[tabId];
}

// 检查标签页是否需要伪装
async function checkTab(tab) {
  if (!tab.id || !tab.url) return;
  const cfg = matchMask(tab.url);
  if (!cfg) return;

  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isActive = active?.id === tab.id;
  if (isActive) {
    // 活跃标签不伪装，确保恢复
    if (tabOriginals[tab.id]) restoreMask(tab.id);
  } else {
    // 非活跃标签应用伪装
    if (!tabOriginals[tab.id]) applyMask(tab.id, cfg);
  }
}

// 标题自动补全：无标题时用伪装域名
function resolveTitle(cfg) {
  if (cfg.title) return cfg.title;
  if (cfg.domain) return cfg.domain;
  return '';
}

// 图标：根据域名获取 favicon data URL（绕过目标页面 CSP）
async function resolveFavicon(cfg) {
  if (!cfg.domain) return '';
  const urls = [
    `https://${cfg.domain}/favicon.ico`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cfg.domain)}&sz=64`,
    `https://icons.duckduckgo.com/ip3/${cfg.domain}.ico`,
  ];
  for (const url of urls) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      if (blob.size === 0) continue;
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {}
  }
  return '';
}

chrome.history.onVisited.addListener(async item => {
  if (!enabled || !match(item.url)) return;
  try { await chrome.history.deleteUrl({ url: item.url }); } catch {}
});

// tab 更新时检查伪装
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') checkTab(tab);
});

// tab 切换时恢复伪装
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  if (tabOriginals[tabId]) {
    const tab = await chrome.tabs.get(tabId);
    const cfg = matchMask(tab.url);
    if (cfg) restoreMask(tabId);
  }
});

// 其他 tab 可能也需要伪装
chrome.tabs.onActivated.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.active) continue;
    const cfg = matchMask(tab.url);
    if (cfg && !tabOriginals[tab.id]) applyMask(tab.id, cfg);
  }
});

// tab 关闭时清理
chrome.tabs.onRemoved.addListener(tabId => { delete tabOriginals[tabId]; });

chrome.storage.onChanged.addListener((c, a) => {
  if (a!=='local') return;
  if (c.interceptionEnabled) enabled = c.interceptionEnabled.newValue!==false;
  if (c.domains) load();
});

chrome.runtime.onInstalled.addListener(load);
load();
