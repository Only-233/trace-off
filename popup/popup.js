/**
 * 止痕 Trace Off v1.0.4 - Popup
 */
const $ = id => document.getElementById(id);
const DOM = {
  toggle: $('masterToggle'), input: $('domainEditInput'), reset: $('domainResetBtn'),
  host: $('sourceHost'), dot: $('statusDot'), text: $('statusText'),
  add: $('addBtn'), remove: $('removeBtn'), settings: $('openSettings'),
  domainToggle: $('domainToggle'), domainToggleWrap: $('domainToggleWrap'),
};
let curDomain = '', curUrl = '', masterOn = true, curDomainInList = false;

const getTab = async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
const cfg = async () => (await chrome.storage.local.get('domains')).domains || [];
const saveCfg = async d => { await chrome.storage.local.set({ domains: d }); };
const isValid = d => /^(localhost(:\d{1,5})?|([\w-]+\.)+[a-z]{2,}(:\d{1,5})?)$/i.test(d.trim());
const editVal = () => DOM.input.value.trim().toLowerCase();

function updateUI(domains) {
  const v = editVal();
  if (!v || !isValid(v)) {
    DOM.dot.className='status-dot';
    DOM.text.textContent='输入有效域名后即可添加';
    DOM.add.disabled=DOM.remove.disabled=true;
    DOM.domainToggleWrap.style.display='none';
    return;
  }
  const i = domains.findIndex(d => d.domain === v);
  if (i !== -1) {
    DOM.add.disabled=true; DOM.remove.disabled=false;
    DOM.dot.className='status-dot ' + (domains[i].enabled ? 'active' : 'in-list');
    DOM.text.textContent = domains[i].enabled ? '已在屏蔽列表中' : '在列表中（已暂停屏蔽）';
    // 同步当前域名开关
    curDomainInList = true;
    DOM.domainToggle.checked = domains[i].enabled;
    DOM.domainToggleWrap.style.display = (v === curDomain) ? 'inline-flex' : 'none';
  } else {
    DOM.add.disabled=false; DOM.remove.disabled=true;
    DOM.dot.className='status-dot'; DOM.text.textContent='可添加至屏蔽列表';
    curDomainInList = false;
    DOM.domainToggleWrap.style.display='none';
  }
}

function setAll(v) {
  const op = v ? '0.35' : '';
  [DOM.input, DOM.reset, DOM.add, DOM.remove].forEach(el => {
    el.disabled = v;
    if (el !== DOM.input) { el.style.opacity = op; el.style.cursor = v ? 'not-allowed' : ''; }
  });
}

async function refresh() { updateUI(await cfg()); }

// 事件
DOM.add.onclick = async () => {
  const v = editVal(); if (!v || !isValid(v)) { DOM.input.style.borderColor='#ef4444'; setTimeout(()=>DOM.input.style.borderColor='',800); return; }
  const d = await cfg(); const i = d.findIndex(x => x.domain === v);
  if (i===-1) d.push({ domain: v, enabled: true }); else d[i].enabled = true;
  await saveCfg(d); updateUI(d);
  DOM.add.textContent='✓'; DOM.add.style.background='#16a34a';
  setTimeout(() => { DOM.add.innerHTML='<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 2v11M2 7.5h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>添加'; DOM.add.style.background=''; }, 1000);
};
DOM.remove.onclick = async () => {
  const v = editVal(); if (!v) return;
  const d = await cfg(); const i = d.findIndex(x => x.domain === v);
  if (i!==-1) { d.splice(i,1); await saveCfg(d); } updateUI(d);
};
DOM.reset.onclick = () => { DOM.input.value = curDomain; refresh(); };
DOM.input.oninput = refresh;
DOM.input.onkeydown = e => { if (e.key==='Enter') DOM.add.click(); };
DOM.settings.onclick = e => { e.preventDefault(); chrome.runtime.openOptionsPage(); };

DOM.toggle.onchange = async () => {
  masterOn = DOM.toggle.checked;
  await chrome.storage.local.set({ interceptionEnabled: masterOn });
  setAll(!masterOn);
  DOM.dot.className='status-dot'; DOM.text.textContent = masterOn ? '' : '拦截已暂停';
  if (masterOn) refresh();
};

DOM.domainToggle.onchange = async () => {
  const d = await cfg();
  const i = d.findIndex(x => x.domain === curDomain);
  if (i !== -1) {
    d[i].enabled = DOM.domainToggle.checked;
    await saveCfg(d);
    const dot = DOM.domainToggle.checked ? 'active' : 'in-list';
    const txt = DOM.domainToggle.checked ? '已在屏蔽列表中' : '在列表中（已暂停屏蔽）';
    DOM.dot.className = 'status-dot ' + dot;
    DOM.text.textContent = txt;
  }
};
chrome.storage.onChanged.addListener((c, a) => {
  if (a==='local' && c.interceptionEnabled) {
    masterOn = c.interceptionEnabled.newValue !== false;
    DOM.toggle.checked = masterOn; setAll(!masterOn);
    DOM.dot.className='status-dot'; DOM.text.textContent = masterOn ? '' : '拦截已暂停';
    if (masterOn) refresh();
  }
});

// 初始化
(async () => {
  masterOn = ((await chrome.storage.local.get('interceptionEnabled')).interceptionEnabled) !== false;
  DOM.toggle.checked = masterOn;
  try {
    const tab = await getTab();
    if (!tab?.url) { DOM.input.placeholder='无法获取当前页面'; DOM.host.textContent='—'; return; }
    curUrl = tab.url;
    const internal = ['chrome://','chrome-extension://','extension://','moz-extension://','edge://','brave://','opera://','about:','devtools://','file://'];
    if (internal.some(s => curUrl.startsWith(s))) {
      curDomain=''; DOM.input.value=''; DOM.input.placeholder='输入要屏蔽的域名...'; DOM.host.textContent='浏览器内部页面';
      DOM.dot.className='status-dot'; DOM.text.textContent='手动输入域名即可添加';
    } else {
      const u = new URL(curUrl);
      curDomain = (u.port && u.port!=='80' && u.port!=='443') ? `${u.hostname}:${u.port}` : u.hostname;
      DOM.input.value=curDomain; DOM.host.textContent=curDomain;
    }
    if (!masterOn) { setAll(true); DOM.text.textContent='拦截已暂停'; } else { updateUI(await cfg()); }
  } catch { DOM.input.placeholder='加载失败'; }
})();
