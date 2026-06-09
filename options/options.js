/**
 * 止痕 Trace Off - 设置页面逻辑
 */

// ============ DOM 元素 ============
const domainListEl    = document.getElementById('domainList');
const emptyStateEl    = document.getElementById('emptyState');
const domainInput     = document.getElementById('domainInput');
const addDomainBtn    = document.getElementById('addDomainBtn');
const domainCountEl   = document.getElementById('domainCount');
const selectAllCb     = document.getElementById('selectAllCheckbox');
const batchInfo       = document.getElementById('batchInfo');
const batchEnableBtn  = document.getElementById('batchEnableBtn');
const batchDisableBtn = document.getElementById('batchDisableBtn');
const batchDeleteBtn  = document.getElementById('batchDeleteBtn');
const batchClearBtn   = document.getElementById('batchClearBtn');

// ============ 状态 ============
let domains = [];
let selectedDomains = new Set();
let editingDomain = null;

// ============ 存储操作 ============
async function loadData() {
  const result = await chrome.storage.local.get(['domains']);
  domains = result.domains || [];
}

async function saveDomains() {
  await chrome.storage.local.set({ domains });
}

// 监听域名变化刷新全选状态
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.domains) {
    updateSelectAllState();
  }
});

// ============ 域名验证 ============
function isValidDomain(domain) {
  const d = domain.trim();
  if (/^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(:\d{1,5})?$/.test(d)) return true;
  if (/^localhost(:\d{1,5})?$/.test(d)) return true;
  return false;
}

// ============ 渲染 ============
function getDomainType(domain) {
  const host = domain.includes(':') ? domain.split(':')[0] : domain;
  if (host === 'localhost') {
    return domain.includes(':') ? `本地主机 · 端口 ${domain.split(':')[1]}` : '本地主机';
  }
  const parts = host.split('.');
  const label = parts.length <= 2 ? '顶级域名' : `${parts.length - 2} 级子域名`;
  return domain.includes(':') ? `${label} · 端口 ${domain.split(':')[1]}` : label;
}

function renderDomainList() {
  const items = domainListEl.querySelectorAll('.domain-item');
  items.forEach(item => item.remove());

  if (domains.length === 0) {
    emptyStateEl.style.display = 'block';
  } else {
    emptyStateEl.style.display = 'none';

    domains.forEach((item, index) => {
      const isSelected = selectedDomains.has(item.domain);
      const row = document.createElement('div');
      row.className = 'domain-item' + (isSelected ? ' selected' : '');
      row.dataset.domain = item.domain;
      row.dataset.index  = index;

      row.innerHTML = `
        <div class="checkbox-cell">
          <input type="checkbox" class="domain-checkbox" ${isSelected ? 'checked' : ''}>
        </div>
        <div class="domain-cell">
          <div class="domain-name-row">
            <span class="domain-name">${escapeHtml(item.domain)}</span>
            <input type="text" class="domain-edit-input" style="display:none;" value="${escapeHtml(item.domain)}" spellcheck="false" autocomplete="off">
          </div>
          <div class="domain-meta">${getDomainType(item.domain)}</div>
        </div>
        <div class="action-btns-cell">
          <button class="btn-icon-only edit-btn" title="编辑域名">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              <path d="M10 3l3 3" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </button>
          <button class="btn-icon-only delete-btn" title="删除域名">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M5.33 4V2.67a1.33 1.33 0 011.34-1.34h2.66a1.33 1.33 0 011.34 1.34V4M6.67 7.33v4M9.33 7.33v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3.33 4l1.14 9.1a1.33 1.33 0 001.32 1.23h4.42a1.33 1.33 0 001.32-1.23L12.67 4" stroke="currentColor" stroke-width="1.4"/>
            </svg>
          </button>
        </div>
        <div class="toggle-cell">
          <label class="toggle-switch">
            <input type="checkbox" class="domain-toggle" data-index="${index}" ${item.enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      `;

      row.querySelector('.domain-checkbox').addEventListener('change', (e) => {
        toggleSelect(item.domain, e.target.checked);
      });
      row.querySelector('.domain-toggle').addEventListener('change', async (e) => {
        domains[index].enabled = e.target.checked;
        await saveDomains();
      });
      row.querySelector('.edit-btn').addEventListener('click', () => {
        startEdit(item.domain, row);
      });
      row.querySelector('.delete-btn').addEventListener('click', async () => {
        await deleteDomains([item.domain]);
      });

      domainListEl.appendChild(row);
    });
  }

  domainCountEl.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex-shrink:0;opacity:0.5">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/>
    </svg>
    共 ${domains.length} 个域名`;
  updateBatchBar();
}

// ============ 内联编辑 ============
function startEdit(domain, row) {
  if (editingDomain) cancelEdit();
  editingDomain = domain;

  const nameSpan  = row.querySelector('.domain-name');
  const editInput = row.querySelector('.domain-edit-input');
  const editBtn   = row.querySelector('.edit-btn');
  const checkbox  = row.querySelector('.domain-checkbox');
  const toggle    = row.querySelector('.domain-toggle');

  checkbox.disabled = true;
  toggle.disabled   = true;
  nameSpan.style.display = 'none';
  editInput.style.display = 'block';
  editInput.focus();
  editInput.select();

  editBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8l3 4 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  editBtn.classList.add('confirm');

  async function commitEdit() {
    const newDomain = editInput.value.trim().toLowerCase();
    if (!newDomain || newDomain === domain) { cancelEdit(); return; }
    if (!isValidDomain(newDomain)) {
      editInput.style.borderColor = '#ef4444';
      setTimeout(() => { editInput.style.borderColor = ''; }, 600);
      return;
    }
    const oldIndex = domains.findIndex(d => d.domain === domain);
    if (oldIndex === -1) return;
    const conflict = domains.findIndex(d => d.domain === newDomain);
    if (conflict !== -1 && conflict !== oldIndex) {
      editInput.style.borderColor = '#ef4444';
      setTimeout(() => { editInput.style.borderColor = ''; }, 600);
      return;
    }
    domains[oldIndex].domain = newDomain;
    if (selectedDomains.has(domain)) {
      selectedDomains.delete(domain);
      selectedDomains.add(newDomain);
    }
    await saveDomains();
    editingDomain = null;
    renderDomainList();
  }

  function cancelEdit() {
    editingDomain = null;
    editBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M10 3l3 3" stroke="currentColor" stroke-width="1.5"/>
      </svg>`;
    editBtn.classList.remove('confirm');
    nameSpan.style.display = '';
    editInput.style.display = 'none';
    checkbox.disabled = false;
    toggle.disabled   = false;
  }

  editBtn.addEventListener('click', commitEdit, { once: true });
  editInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') cancelEdit();
  });
  editInput.addEventListener('blur', () => {
    setTimeout(() => { if (editingDomain === domain) cancelEdit(); }, 150);
  });
}

function cancelEdit() {
  editingDomain = null;
  renderDomainList();
}

function updateSelectAllState() {
  const allDomains = new Set(domains.map(d => d.domain));
  if (allDomains.size === 0) {
    selectAllCb.checked = false;
    selectAllCb.indeterminate = false;
    selectAllCb.disabled = true;
    return;
  }
  selectAllCb.disabled = false;
  if (selectedDomains.size === 0) {
    selectAllCb.checked = false;
    selectAllCb.indeterminate = false;
  } else if (selectedDomains.size === allDomains.size) {
    selectAllCb.checked = true;
    selectAllCb.indeterminate = false;
  } else {
    selectAllCb.checked = false;
    selectAllCb.indeterminate = true;
  }
}

function updateBatchBar() {
  const hasSelection = selectedDomains.size > 0;
  batchInfo.textContent = hasSelection
    ? `已选择 ${selectedDomains.size} 项`
    : '未选择任何项';
  batchEnableBtn.disabled = !hasSelection;
  batchDisableBtn.disabled = !hasSelection;
  batchDeleteBtn.disabled = !hasSelection;
  batchClearBtn.disabled = !hasSelection;
  updateSelectAllState();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============ 操作 ============
function toggleSelect(domain, isSelected) {
  if (isSelected) selectedDomains.add(domain);
  else selectedDomains.delete(domain);
  renderDomainList();
}

async function addDomain() {
  const input = domainInput.value.trim().toLowerCase();
  if (!input) return;
  if (!isValidDomain(input)) { shakeInput(); return; }
  if (domains.find(d => d.domain === input)) {
    domainInput.value = '';
    domainInput.placeholder = '该域名已存在';
    setTimeout(() => { domainInput.placeholder = '输入域名，如 example.com'; }, 1500);
    return;
  }
  domains.push({ domain: input, enabled: true });
  await saveDomains();
  domainInput.value = '';
  domainInput.focus();
  renderDomainList();
}

async function deleteDomains(targetDomains) {
  domains = domains.filter(d => !targetDomains.includes(d.domain));
  targetDomains.forEach(d => selectedDomains.delete(d));
  await saveDomains();
  renderDomainList();
}

function clearSelection() {
  selectedDomains.clear();
  renderDomainList();
}

async function batchEnable() {
  for (const domain of selectedDomains) {
    const item = domains.find(d => d.domain === domain);
    if (item) item.enabled = true;
  }
  await saveDomains();
  renderDomainList();
}

async function batchDisable() {
  for (const domain of selectedDomains) {
    const item = domains.find(d => d.domain === domain);
    if (item) item.enabled = false;
  }
  await saveDomains();
  renderDomainList();
}

async function batchDelete() {
  await deleteDomains([...selectedDomains]);
}

function shakeInput() {
  domainInput.style.borderColor = '#ef4444';
  domainInput.style.animation = 'none';
  domainInput.offsetHeight;
  domainInput.style.animation = 'shake 0.35s ease';
  setTimeout(() => {
    domainInput.style.borderColor = '';
    domainInput.style.animation = '';
  }, 800);
}

// ============ 全选 ============
selectAllCb.addEventListener('change', () => {
  if (selectAllCb.checked) {
    domains.forEach(d => selectedDomains.add(d.domain));
  } else {
    selectedDomains.clear();
  }
  renderDomainList();
});

// ============ 事件绑定 ============
addDomainBtn.addEventListener('click', addDomain);
domainInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addDomain();
});
batchEnableBtn.addEventListener('click', batchEnable);
batchDisableBtn.addEventListener('click', batchDisable);
batchDeleteBtn.addEventListener('click', batchDelete);
batchClearBtn.addEventListener('click', clearSelection);

// ============ 初始化 ============
(async function init() {
  await loadData();
  renderDomainList();
})();

// 抖动动画
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
  }
`;
document.head.appendChild(shakeStyle);
