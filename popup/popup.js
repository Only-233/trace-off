/**
 * 止痕 Trace Off - Popup 弹窗逻辑
 */

let currentDomain = '';
let currentUrl = '';
let masterEnabled = true;

// DOM
const masterToggle    = document.getElementById('masterToggle');
const domainEditInput = document.getElementById('domainEditInput');
const domainResetBtn  = document.getElementById('domainResetBtn');
const sourceHostEl    = document.getElementById('sourceHost');
const statusDot       = document.getElementById('statusDot');
const statusText      = document.getElementById('statusText');
const addBtn          = document.getElementById('addBtn');
const removeBtn       = document.getElementById('removeBtn');
const openSettings    = document.getElementById('openSettings');

// ============ 工具函数 ============
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
async function getDomainConfig() {
  const result = await chrome.storage.local.get(['domains']);
  return result.domains || [];
}
async function saveDomainConfig(domains) {
  await chrome.storage.local.set({ domains });
}
function isValidDomain(domain) {
  const d = domain.trim();
  // 标准域名: example.com / sub.example.com:8080
  if (/^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(:\d{1,5})?$/.test(d)) return true;
  // localhost: localhost / localhost:3000
  if (/^localhost(:\d{1,5})?$/.test(d)) return true;
  return false;
}
function findDomainIndex(domains, domain) {
  return domains.findIndex(d => d.domain === domain);
}
function getEditingDomain() {
  return domainEditInput.value.trim().toLowerCase();
}

// ============ 状态 UI ============
function updateStatus(domains) {
  const domain = getEditingDomain();

  if (!domain || !isValidDomain(domain)) {
    statusDot.className = 'status-dot';
    statusText.textContent = '输入有效域名后即可添加';
    addBtn.disabled = true;
    removeBtn.disabled = true;
    return;
  }

  const index = findDomainIndex(domains, domain);
  if (index !== -1) {
    const item = domains[index];
    addBtn.disabled = true;
    removeBtn.disabled = false;
    if (item.enabled) {
      statusDot.className = 'status-dot active';
      statusText.textContent = '已在屏蔽列表中';
    } else {
      statusDot.className = 'status-dot in-list';
      statusText.textContent = '在列表中（已暂停屏蔽）';
    }
  } else {
    addBtn.disabled = false;
    removeBtn.disabled = true;
    statusDot.className = 'status-dot';
    statusText.textContent = '可添加至屏蔽列表';
  }
}

function setDisabled(disabled) {
  const opacity = disabled ? '0.35' : '';
  domainEditInput.disabled = disabled;
  domainResetBtn.disabled = disabled;
  addBtn.disabled = disabled;
  removeBtn.disabled = disabled;
  [domainResetBtn, addBtn, removeBtn].forEach(b => {
    if (disabled) { b.style.opacity = opacity; b.style.cursor = 'not-allowed'; }
    else { b.style.opacity = ''; b.style.cursor = ''; }
  });
}

// ============ 操作 ============
async function addDomain() {
  const domain = getEditingDomain();
  if (!domain || !isValidDomain(domain)) {
    domainEditInput.style.borderColor = '#ef4444';
    setTimeout(() => { domainEditInput.style.borderColor = ''; }, 800);
    return;
  }

  const domains = await getDomainConfig();
  const index = findDomainIndex(domains, domain);
  if (index === -1) {
    domains.push({ domain, enabled: true });
  } else {
    domains[index].enabled = true;
  }

  await saveDomainConfig(domains);
  updateStatus(domains);

  addBtn.textContent = '✓';
  addBtn.style.background = '#16a34a';
  setTimeout(() => {
    addBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 2v11M2 7.5h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>添加';
    addBtn.style.background = '';
  }, 1000);
}

async function removeDomain() {
  const domain = getEditingDomain();
  if (!domain) return;

  const domains = await getDomainConfig();
  const index = findDomainIndex(domains, domain);
  if (index !== -1) {
    domains.splice(index, 1);
    await saveDomainConfig(domains);
  }
  updateStatus(domains);
}

async function refreshStatus() {
  const domains = await getDomainConfig();
  updateStatus(domains);
}

// ============ 事件 ============
addBtn.addEventListener('click', addDomain);
removeBtn.addEventListener('click', removeDomain);
domainResetBtn.addEventListener('click', () => {
  domainEditInput.value = currentDomain;
  refreshStatus();
});
domainEditInput.addEventListener('input', refreshStatus);
domainEditInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addDomain();
});
openSettings.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// 总开关
masterToggle.addEventListener('change', async () => {
  masterEnabled = masterToggle.checked;
  await chrome.storage.local.set({ interceptionEnabled: masterEnabled });
  setDisabled(!masterEnabled);
  if (!masterEnabled) {
    statusDot.className = 'status-dot';
    statusText.textContent = '拦截已暂停';
  } else {
    refreshStatus();
  }
});

// 监听 storage 同步总开关
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.interceptionEnabled) {
    masterEnabled = changes.interceptionEnabled.newValue !== false;
    masterToggle.checked = masterEnabled;
    setDisabled(!masterEnabled);
    if (masterEnabled) refreshStatus();
    else {
      statusText.textContent = '拦截已暂停';
      statusDot.className = 'status-dot';
    }
  }
});

// ============ 初始化 ============
(async function init() {
  // 读取总开关状态
  const result = await chrome.storage.local.get(['interceptionEnabled']);
  masterEnabled = result.interceptionEnabled !== false;
  masterToggle.checked = masterEnabled;

  try {
    const tab = await getCurrentTab();
    if (!tab || !tab.url) {
      domainEditInput.placeholder = '无法获取当前页面';
      sourceHostEl.textContent = '—';
      return;
    }

    currentUrl = tab.url;

    const internalSchemes = [
      'chrome://', 'chrome-extension://', 'extension://',
      'moz-extension://', 'edge://', 'brave://', 'opera://',
      'about:', 'chrome-search://', 'devtools://', 'file://'
    ];
    const isInternal = internalSchemes.some(s => currentUrl.startsWith(s));

    if (isInternal) {
      // 内部页面：不自动填域名，但允许手动输入添加
      currentDomain = '';
      domainEditInput.value = '';
      domainEditInput.placeholder = '输入要屏蔽的域名...';
      sourceHostEl.textContent = '浏览器内部页面';
      statusDot.className = 'status-dot';
      statusText.textContent = '手动输入域名即可添加';
    } else {
      const urlObj = new URL(currentUrl);
      const hasPort = urlObj.port && urlObj.port !== '80' && urlObj.port !== '443';
      currentDomain = hasPort ? `${urlObj.hostname}:${urlObj.port}` : urlObj.hostname;
      domainEditInput.value = currentDomain;
      sourceHostEl.textContent = currentDomain;
    }

    if (!masterEnabled) {
      setDisabled(true);
      statusText.textContent = '拦截已暂停';
    } else {
      const domains = await getDomainConfig();
      updateStatus(domains);
    }
  } catch (err) {
    domainEditInput.placeholder = '加载失败';
    console.error('[Trace Off] init error:', err);
  }
})();
