/**
 * 止痕 Trace Off v1.0.1 - 设置页面
 */
const $ = id => document.getElementById(id);
const S = {
  domainList: $('domainList'), emptyState: $('emptyState'), input: $('domainInput'),
  count: $('domainCount'), selectAll: $('selectAllCheckbox'),
  bInfo: $('batchInfo'), bEnable: $('batchEnableBtn'), bDisable: $('batchDisableBtn'),
  bDelete: $('batchDeleteBtn'), bClear: $('batchClearBtn'),
};

let domains = [], selected = new Set(), editing = null;

// ========== 存储 ==========
async function load() { domains = (await chrome.storage.local.get('domains')).domains || []; }
async function save() { await chrome.storage.local.set({ domains }); }
chrome.storage.onChanged.addListener((c, a) => { if (a === 'local' && c.domains) updateSelectAll(); });

// ========== 辅助 ==========
const esc = s => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
const isValid = d => /^(localhost(:\d{1,5})?|([\w-]+\.)+[a-z]{2,}(:\d{1,5})?)$/i.test(d.trim());
function typeTag(d) {
  const [h, p] = d.split(':');
  if (h === 'localhost') return p ? `本地主机 · 端口 ${p}` : '本地主机';
  const n = h.split('.').length - 2;
  return p ? `${n ? n + ' 级子域名' : '顶级域名'} · 端口 ${p}` : n ? `${n} 级子域名` : '顶级域名';
}

// SVG 图标集
const I = {
  dot: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex-shrink:0;opacity:.5"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/></svg>',
  edit: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M10 3l3 3" stroke="currentColor" stroke-width="1.5"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 4 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5.33 4V2.67a1.33 1.33 0 011.34-1.34h2.66a1.33 1.33 0 011.34 1.34V4M6.67 7.33v4M9.33 7.33v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.33 4l1.14 9.1a1.33 1.33 0 001.32 1.23h4.42a1.33 1.33 0 001.32-1.23L12.67 4" stroke="currentColor" stroke-width="1.4"/></svg>',
  history: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2h12M5 2V1h6v1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><rect x="3" y="5" width="10" height="9" rx="1" stroke="currentColor" stroke-width="1.4"/><line x1="6" y1="8" x2="10" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="6" y1="11" x2="9" y2="11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  favicon: u => `chrome://favicon/size/16@2x/${u}`,
  time: ts => { const d = new Date(ts), pad = n => String(n).padStart(2,'0'); const t = new Date(); t.setHours(0,0,0,0); const y = new Date(t); y.setDate(y.getDate()-1); const dp = d<y?`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`:d<t?'昨天':'今天'; return `${dp} ${pad(d.getHours())}:${pad(d.getMinutes())}`; },
  group: ts => { const d = new Date(ts); const t = new Date(); t.setHours(0,0,0,0); const y = new Date(t); y.setDate(y.getDate()-1); if(d>=t) return '今天'; if(d>=y) return '昨天'; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; },
};

// ========== 渲染 ==========
function render() {
  [...S.domainList.querySelectorAll('.domain-item')].forEach(r => r.remove());
  S.emptyState.style.display = domains.length ? 'none' : 'block';
  domains.forEach((d, i) => {
    const sel = selected.has(d.domain);
    const row = document.createElement('div');
    row.className = 'domain-item' + (sel ? ' selected' : '');
    row.dataset.domain = d.domain; row.dataset.index = i;
    row.innerHTML = `
      <div class="checkbox-cell"><input type="checkbox" class="domain-checkbox" ${sel?'checked':''}></div>
      <div class="domain-cell">
        <div class="domain-name-row"><span class="domain-name">${esc(d.domain)}</span><input type="text" class="domain-edit-input" style="display:none" value="${esc(d.domain)}" spellcheck="false" autocomplete="off"></div>
        <div class="domain-meta">${typeTag(d.domain)}</div>
      </div>
      <div class="action-btns-cell">
        <button class="btn-icon-only edit-btn" title="编辑">${I.edit}</button>
        <button class="btn-icon-only history-btn" title="清空历史">${I.history}</button>
        <button class="btn-icon-only delete-btn" title="删除">${I.trash}</button>
      </div>
      <div class="toggle-cell"><label class="toggle-switch"><input type="checkbox" class="domain-toggle" data-index="${i}" ${d.enabled?'checked':''}><span class="toggle-slider"></span></label></div>`;
    row.querySelector('.domain-checkbox').onchange = e => toggle(d.domain, e.target.checked);
    row.querySelector('.domain-toggle').onchange = async e => { domains[i].enabled = e.target.checked; await save(); };
    row.querySelector('.domain-cell').onclick = () => openHistory(d.domain);
    row.querySelector('.edit-btn').onclick = e => { e.stopPropagation(); startEdit(d.domain, row); };
    row.querySelector('.history-btn').onclick = e => { e.stopPropagation(); openHistory(d.domain); };
    row.querySelector('.delete-btn').onclick = async e => { e.stopPropagation(); await del([d.domain]); };
    S.domainList.appendChild(row);
  });
  S.count.innerHTML = `${I.dot} 共 ${domains.length} 个域名`;
  updateBatchBar();
}

function startEdit(domain, row) {
  if (editing) cancelEdit();
  editing = domain;
  const ns = row.querySelector('.domain-name'), ei = row.querySelector('.domain-edit-input'), eb = row.querySelector('.edit-btn');
  row.querySelector('.domain-checkbox').disabled = row.querySelector('.domain-toggle').disabled = true;
  ns.style.display = 'none'; ei.style.display = 'block'; ei.focus(); ei.select();
  eb.innerHTML = I.check; eb.classList.add('confirm');
  async function commit() {
    const v = ei.value.trim().toLowerCase();
    if (!v || v === domain) { cancel(); return; }
    if (!isValid(v)) { ei.style.borderColor = '#ef4444'; setTimeout(() => ei.style.borderColor = '', 600); return; }
    const oi = domains.findIndex(d => d.domain === domain);
    if (oi===-1) return;
    if (domains.findIndex(d => d.domain === v) !== oi && domains.some(d => d.domain === v)) { ei.style.borderColor = '#ef4444'; setTimeout(() => ei.style.borderColor = '', 600); return; }
    domains[oi].domain = v;
    if (selected.has(domain)) { selected.delete(domain); selected.add(v); }
    await save(); editing = null; render();
  }
  function cancel() { editing = null; eb.innerHTML = I.edit; eb.classList.remove('confirm'); ns.style.display = ''; ei.style.display = 'none'; row.querySelector('.domain-checkbox').disabled = row.querySelector('.domain-toggle').disabled = false; }
  eb.onclick = commit; ei.onkeydown = e => { if(e.key==='Enter') commit(); if(e.key==='Escape') cancel(); };
  ei.onblur = () => setTimeout(() => { if(editing===domain) cancel(); }, 150);
}
function cancelEdit() { editing = null; render(); }

function updateSelectAll() {
  const all = new Set(domains.map(d => d.domain));
  if (all.size===0) { S.selectAll.checked=S.selectAll.indeterminate=false; S.selectAll.disabled=true; return; }
  S.selectAll.disabled = false;
  S.selectAll.checked = selected.size===all.size;
  S.selectAll.indeterminate = selected.size>0 && selected.size<all.size;
}
function updateBatchBar() {
  const h = selected.size > 0;
  S.bInfo.textContent = h ? `已选择 ${selected.size} 项` : '未选择任何项';
  S.bEnable.disabled = S.bDisable.disabled = S.bDelete.disabled = S.bClear.disabled = !h;
  updateSelectAll();
}

// ========== 域名操作 ==========
function toggle(domain, on) { on ? selected.add(domain) : selected.delete(domain); render(); }
async function add() {
  const v = S.input.value.trim().toLowerCase();
  if (!v) return; if (!isValid(v)) { shake(); return; }
  if (domains.find(d => d.domain === v)) { S.input.value=''; S.input.placeholder='该域名已存在'; setTimeout(() => S.input.placeholder='输入域名，如 example.com', 1500); return; }
  domains.push({ domain: v, enabled: true }); await save(); S.input.value=''; S.input.focus(); render();
}
async function del(arr) { domains = domains.filter(d => !arr.includes(d.domain)); arr.forEach(d => selected.delete(d)); await save(); render(); }
function clearSel() { selected.clear(); render(); }
async function batchSet(v) { for (const d of selected) { const it = domains.find(x => x.domain === d); if (it) it.enabled = v; } await save(); render(); }
function shake() { S.input.style.borderColor='#ef4444'; S.input.offsetHeight; S.input.style.animation='shake .35s ease'; setTimeout(()=>{S.input.style.borderColor='';S.input.style.animation=''},800); }

// ========== 清空历史弹窗 ==========
let hDomain = '', hResults = [], hSelected = new Set();

async function openHistory(domain) {
  hDomain = domain; hSelected = new Set();
  const raw = await chrome.history.search({ text: domain, maxResults: 500, startTime: 0 });
  hResults = raw.filter(r => { try{ const h = new URL(r.url).hostname; return h===domain || h.endsWith('.'+domain); } catch{return false;} });
  hResults.sort((a,b) => (b.lastVisitTime||0)-(a.lastVisitTime||0));
  renderHistory();
}

function renderHistory() {
  const old = $('historyModal'); if (old) old.remove();

  const tpl = $('tplHistoryModal').content.cloneNode(true);
  const el = document.createElement('div'); el.id = 'historyModal'; el.className = 'modal-overlay';
  el.appendChild(tpl);

  // header
  el.querySelector('.modal-domain').textContent = `${esc(hDomain)} · 共 ${hResults.length} 条`;
  // toolbar
  const tb = el.querySelector('.modal-toolbar');
  if (hResults.length === 0) tb.classList.add('hidden');
  el.querySelector('#historySelectAll').checked = hResults.length > 0 && hSelected.size === hResults.length;
  el.querySelector('#historySelectAll').indeterminate = hSelected.size > 0 && hSelected.size < hResults.length;
  el.querySelector('.history-select-all-label span').textContent = hSelected.size > 0 ? `已选 ${hSelected.size} 条` : '全选';
  const ds = el.querySelector('#modalDeleteSelected');
  ds.disabled = hSelected.size === 0; ds.textContent = `删除选中 (${hSelected.size})`;
  // footer
  const da = el.querySelector('#modalDeleteAll');
  da.textContent = `清空全部 ${hResults.length} 条`; da.disabled = hResults.length === 0;

  // body
  const body = el.querySelector('.modal-body');
  const grps = {}; hResults.forEach(r => { const k = I.group(r.lastVisitTime||0); (grps[k] ||= []).push(r); });
  const gks = Object.keys(grps);

  body.innerHTML = gks.length === 0
    ? '<div class="modal-empty"><svg width="36" height="36" viewBox="0 0 36 36" fill="none" style="margin-bottom:8px;opacity:.3"><rect x="6" y="8" width="24" height="22" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M6 14h24" stroke="currentColor" stroke-width="1.8"/><line x1="12" y1="20" x2="24" y2="20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>未找到该域名的历史记录</div>'
    : gks.map(k => {
        const urls = grps[k].map(r => r.url), all = urls.every(u => hSelected.has(u)), some = urls.some(u => hSelected.has(u));
        return `<div class="history-group" data-group="${k}">
          <div class="history-group-title"><label class="history-group-check-label"><input type="checkbox" class="history-group-check" data-group="${k}" ${all?'checked':''} ${some&&!all?'indeterminate':''}></label><span>${k}</span></div>
          ${grps[k].map(r => `<div class="history-item${hSelected.has(r.url)?' selected':''}" data-url="${esc(r.url)}">
            <label class="history-check-label"><input type="checkbox" class="history-checkbox" ${hSelected.has(r.url)?'checked':''}></label>
            <img class="history-favicon" src="${I.favicon(r.url)}" onerror="this.style.display='none'" width="16" height="16">
            <div class="history-item-info"><div class="history-item-title">${esc(r.title||'(无标题)')}</div><div class="history-item-url">${esc(r.url)}</div><div class="history-item-time">${I.time(r.lastVisitTime||0)}</div></div>
            <button class="history-item-goto" title="打开"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11 11H3V3h4M7 7l4-4M11 1h2v2M11 1v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <button class="history-item-del" title="删除">×</button>
          </div>`).join('')}
        </div>`;
      }).join('');

  document.body.appendChild(el);
  el.onclick = e => { if(e.target===el) closeHistory(); };
  el.querySelector('.modal-close').onclick = closeHistory;
  el.querySelector('#modalCancel').onclick = closeHistory;

  function refresh() {
    const m = $('historyModal'); if(!m) return;
    m.querySelectorAll('.history-item').forEach(row => { const u=row.dataset.url; const cb=row.querySelector('.history-checkbox'); if(cb)cb.checked=hSelected.has(u); row.classList.toggle('selected',hSelected.has(u)); });
    m.querySelectorAll('.history-group').forEach(g => { const gc=g.querySelector('.history-group-check'); if(!gc)return; const urls=[...g.querySelectorAll('.history-item')].map(r=>r.dataset.url); gc.checked=urls.length>0&&urls.every(u=>hSelected.has(u)); gc.indeterminate=urls.some(u=>hSelected.has(u))&&!gc.checked; });
    const sa=m.querySelector('#historySelectAll'); if(sa){sa.checked=hResults.length>0&&hSelected.size===hResults.length;sa.indeterminate=hSelected.size>0&&hSelected.size<hResults.length;sa.closest('.history-select-all-label').querySelector('span').textContent=hSelected.size>0?`已选 ${hSelected.size} 条`:'全选';}
    const ds=m.querySelector('#modalDeleteSelected'); if(ds){ds.disabled=hSelected.size===0;ds.textContent=`删除选中 (${hSelected.size})`;}
    const da=m.querySelector('#modalDeleteAll'); if(da){da.textContent=`清空全部 ${hResults.length} 条`;da.disabled=hResults.length===0;}
    const de=m.querySelector('.modal-domain'); if(de)de.textContent=`${esc(hDomain)} · 共 ${hResults.length} 条`;
    if(hResults.length===0){const b=m.querySelector('.modal-body');if(!b.querySelector('.modal-empty')){b.innerHTML='<div class="modal-empty"><svg width="36" height="36" viewBox="0 0 36 36" fill="none" style="margin-bottom:8px;opacity:.3"><path d="M27 9L9 27M9 9l18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>已清空</div>';m.querySelector('.modal-toolbar').classList.add('hidden');}}
  }

  function remove(urls) {
    const m = $('historyModal'); if(!m) return;
    const s = new Set(urls);
    m.querySelectorAll('.history-item').forEach(row => { if(s.has(row.dataset.url)) row.remove(); });
    m.querySelectorAll('.history-group').forEach(g => { if(!g.querySelector('.history-item')) g.remove(); });
    hResults = hResults.filter(r => !s.has(r.url)); s.forEach(u => hSelected.delete(u));
    refresh();
  }
  function showCm(msg) { el.querySelector('#confirmWarn').textContent=msg; el.querySelector('#modalFooter').style.display='none'; el.querySelector('#modalConfirmFooter').style.display=''; }
  function hideCm() { el.querySelector('#modalFooter').style.display=''; el.querySelector('#modalConfirmFooter').style.display='none'; }

  // 刷新：原地更新数据+重渲染内容
  el.querySelector('#modalRefresh').onclick = async () => {
    const raw = await chrome.history.search({ text: hDomain, maxResults: 500, startTime: 0 });
    hResults = raw.filter(r => { try{ const h=new URL(r.url).hostname; return h===hDomain||h.endsWith('.'+hDomain); }catch{return false;} });
    hResults.sort((a,b)=>(b.lastVisitTime||0)-(a.lastVisitTime||0));
    hSelected = new Set([...hSelected].filter(u => hResults.some(r=>r.url===u)));
    renderHistory();
  };
  el.querySelector('#historySelectAll').onchange = function() { if(this.checked)hResults.forEach(r=>hSelected.add(r.url));else hSelected.clear();refresh(); };
  el.querySelectorAll('.history-group-check').forEach(gc => gc.onchange = function() { const g=this.closest('.history-group'); const urls=[...g.querySelectorAll('.history-item')].map(r=>r.dataset.url); if(this.checked)urls.forEach(u=>hSelected.add(u));else urls.forEach(u=>hSelected.delete(u));refresh(); });
  el.querySelectorAll('.history-checkbox').forEach(cb => cb.onchange = function(e){e.stopPropagation();const u=this.closest('.history-item').dataset.url;this.checked?hSelected.add(u):hSelected.delete(u);refresh();});
  el.querySelectorAll('.history-item').forEach(row => row.onclick = function(e){if(e.target.closest('.history-item-del,.history-item-goto,.history-checkbox'))return;const u=row.dataset.url;hSelected.has(u)?hSelected.delete(u):hSelected.add(u);refresh();});
  el.querySelectorAll('.history-item-goto').forEach(b => b.onclick = e => { e.stopPropagation(); chrome.tabs.create({ url: e.target.closest('.history-item').dataset.url }); });
  el.querySelectorAll('.history-item-del').forEach(b => b.onclick = async e => { e.stopPropagation(); const u=e.target.closest('.history-item').dataset.url; await chrome.history.deleteUrl({url:u}); remove([u]); });
  el.querySelector('#modalDeleteSelected').onclick = () => { if(!hSelected.size)return; showCm(`⚠ 确定要删除选中的 ${hSelected.size} 条记录吗？此操作不可撤销。`); el.querySelector('#modalConfirmYes').onclick = async ()=>{const urls=[...hSelected];for(const u of urls)await chrome.history.deleteUrl({url:u});remove(urls);hideCm();}; };
  el.querySelector('#modalDeleteAll').onclick = () => { if(!hResults.length)return; showCm(`⚠ 确定要删除全部 ${hResults.length} 条记录吗？此操作不可撤销。`); el.querySelector('#modalConfirmYes').onclick = async ()=>{const urls=hResults.map(r=>r.url);for(const u of urls)await chrome.history.deleteUrl({url:u});remove(urls);hideCm();}; };
  el.querySelector('#modalConfirmNo').onclick = hideCm;
}
function closeHistory() { const m = $('historyModal'); if(m) m.remove(); hDomain=''; hResults=[]; hSelected=new Set(); }

// ========== 更新日志弹窗 ==========
function openChangelog() {
  const old = $('changelogModal'); if(old) old.remove();
  const el = document.createElement('div'); el.id='changelogModal'; el.className='modal-overlay';
  el.appendChild($('tplChangelogModal').content.cloneNode(true));
  document.body.appendChild(el);
  el.onclick = e => { if(e.target===el) el.remove(); };
  el.querySelector('.modal-close').onclick = () => el.remove();
}

// ========== 事件 ==========
S.selectAll.onchange = () => { if(S.selectAll.checked)domains.forEach(d=>selected.add(d.domain));else selected.clear();render(); };
$('addDomainBtn').onclick = add;
S.input.onkeydown = e => { if(e.key==='Enter') add(); };
S.bEnable.onclick = () => batchSet(true);
S.bDisable.onclick = () => batchSet(false);
S.bDelete.onclick = () => del([...selected]);
S.bClear.onclick = clearSel;
$('changelogBtn').onclick = openChangelog;

// ========== 初始化 ==========
(async () => { await load(); render(); })();
document.head.appendChild(Object.assign(document.createElement('style'),{textContent:'@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}'}));
