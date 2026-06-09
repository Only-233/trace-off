/**
 * 止痕 Trace Off v1.0.1 - Service Worker
 */
let blocked = [], enabled = true;

async function load() {
  const r = await chrome.storage.local.get(['domains','interceptionEnabled']);
  blocked = (r.domains||[]).filter(d=>d.enabled).map(d=>d.domain);
  enabled = r.interceptionEnabled !== false;
}

function match(url) {
  try {
    const h = new URL(url).hostname;
    return blocked.some(d => h===d || h.endsWith('.'+d));
  } catch { return false; }
}

chrome.history.onVisited.addListener(async item => {
  if (!enabled || !match(item.url)) return;
  try { await chrome.history.deleteUrl({ url: item.url }); } catch {}
});

chrome.storage.onChanged.addListener((c, a) => {
  if (a!=='local') return;
  if (c.interceptionEnabled) enabled = c.interceptionEnabled.newValue!==false;
  if (c.domains) load();
});

chrome.runtime.onInstalled.addListener(load);
load();
