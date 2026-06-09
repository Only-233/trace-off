/**
 * 止痕 Trace Off - Service Worker
 * 监听浏览器历史记录，按域名规则拦截并删除
 */

let blockedDomains = [];
let interceptionEnabled = true;

async function loadConfig() {
  const result = await chrome.storage.local.get(['domains', 'interceptionEnabled']);
  const domains = result.domains || [];
  blockedDomains = domains.filter(d => d.enabled).map(d => d.domain);
  interceptionEnabled = result.interceptionEnabled !== false;
}

/**
 * 从 URL 提取完整域名，含非标准端口
 */
function getFullDomain(url) {
  const u = new URL(url);
  const isDefaultPort = (u.protocol === 'https:' && u.port === '443') ||
                        (u.protocol === 'http:'  && u.port === '80')  ||
                        u.port === '';
  return isDefaultPort ? u.hostname : `${u.hostname}:${u.port}`;
}

function isUrlBlocked(url) {
  try {
    const fullDomain = getFullDomain(url);
    const hostname   = new URL(url).hostname;

    for (const d of blockedDomains) {
      const hasPort = d.includes(':');
      if (hasPort) {
        // 带端口：精确匹配完整域名
        if (fullDomain === d) return true;
      } else {
        // 不带端口：匹配 hostname
        if (hostname === d || hostname.endsWith('.' + d)) return true;
      }
    }
    return false;
  } catch { return false; }
}

chrome.history.onVisited.addListener(async (historyItem) => {
  if (!interceptionEnabled) return;
  if (!isUrlBlocked(historyItem.url)) return;

  try {
    await chrome.history.deleteUrl({ url: historyItem.url });
  } catch (err) {
    console.error('[Trace Off] 删除失败:', err);
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes.interceptionEnabled) {
    interceptionEnabled = changes.interceptionEnabled.newValue !== false;
  }
  if (changes.domains) loadConfig();
});

chrome.runtime.onInstalled.addListener(loadConfig);
loadConfig();
