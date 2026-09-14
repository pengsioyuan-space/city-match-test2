const API_ORIGIN = 'https://city-match-test2-313541-9-1324587362.sh.run.tcloudbase.com';
const ADMIN_KEY = 'city-match-test2-admin-key';

const login = document.querySelector('[data-login]');
const panel = document.querySelector('[data-panel]');
const loginForm = document.querySelector('[data-login-form]');
const createForm = document.querySelector('[data-create-form]');
const codeList = document.querySelector('[data-code-list]');
const generated = document.querySelector('[data-generated]');
const generatedList = document.querySelector('[data-generated-list]');
const loginMessage = document.querySelector('[data-login-message]');
const createMessage = document.querySelector('[data-create-message]');

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function adminKey() { return localStorage.getItem(ADMIN_KEY) || ''; }
function setMessage(node, text, type = '') { node.textContent = text; node.className = `message ${type}`.trim(); }
function dateText(value) { return value ? new Date(value).toLocaleString('zh-CN') : '永久'; }
function codeStatus(code) {
  if (code.disabled) return ['已停用', 'bad'];
  if (code.expiresAt && Date.parse(code.expiresAt) < Date.now()) return ['已过期', 'bad'];
  if (Number(code.uses || 0) >= Number(code.maxUses || 1)) return ['已用完', 'bad'];
  return ['可使用', ''];
}
async function request(path, options = {}) {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey(), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '请求失败');
  return data;
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}
function showPanel() {
  login.hidden = true;
  panel.hidden = false;
  loadCodes();
}
function showLogin() {
  login.hidden = false;
  panel.hidden = true;
}
async function loadCodes() {
  codeList.innerHTML = '<tr><td class="empty" colspan="7">正在加载...</td></tr>';
  try {
    const rows = await request('/api/access-codes');
    if (!rows.length) {
      codeList.innerHTML = '<tr><td class="empty" colspan="7">暂无卡密</td></tr>';
      return;
    }
    codeList.innerHTML = rows.map(row => {
      const [label, tone] = codeStatus(row);
      return `<tr>
        <td><code>${esc(row.code)}</code></td>
        <td>${esc(row.note || '-')}</td>
        <td><span class="status ${tone}">${label}</span></td>
        <td>${Number(row.uses || 0)} / ${Number(row.maxUses || 1)}</td>
        <td>${esc(dateText(row.expiresAt))}</td>
        <td>${esc(dateText(row.createdAt))}</td>
        <td><div class="row-actions">
          <button type="button" data-copy="${esc(row.code)}">复制</button>
          ${row.disabled ? '' : `<button class="danger" type="button" data-disable="${esc(row.id)}">停用</button>`}
        </div></td>
      </tr>`;
    }).join('');
  } catch (error) {
    codeList.innerHTML = `<tr><td class="empty" colspan="7">${esc(error.message)}</td></tr>`;
  }
}
loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const key = new FormData(loginForm).get('adminKey').trim();
  localStorage.setItem(ADMIN_KEY, key);
  setMessage(loginMessage, '正在验证...');
  try {
    await request('/api/access-codes');
    setMessage(loginMessage, '');
    showPanel();
  } catch (error) {
    localStorage.removeItem(ADMIN_KEY);
    setMessage(loginMessage, error.message, 'error');
  }
});
createForm.addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(createForm);
  const count = Math.max(1, Math.min(50, Number(form.get('count') || 1)));
  const maxUses = Math.max(1, Math.min(500, Number(form.get('maxUses') || 1)));
  const days = form.get('days');
  const note = String(form.get('note') || '').trim();
  const expiresAt = days ? new Date(Date.now() + Number(days) * 864e5).toISOString() : null;
  const created = [];
  setMessage(createMessage, '正在生成...');
  try {
    for (let i = 0; i < count; i++) {
      const row = await request('/api/access-codes', { method: 'POST', body: JSON.stringify({ note, maxUses, expiresAt }) });
      created.push(row.code);
    }
    generated.hidden = false;
    generatedList.textContent = created.join('\n');
    setMessage(createMessage, `已生成 ${created.length} 张卡密`, 'ok');
    createForm.reset();
    await loadCodes();
  } catch (error) {
    setMessage(createMessage, error.message, 'error');
  }
});
codeList.addEventListener('click', async event => {
  const copy = event.target.closest('[data-copy]');
  const disable = event.target.closest('[data-disable]');
  if (copy) {
    await copyText(copy.dataset.copy);
    copy.textContent = '已复制';
    return;
  }
  if (disable) {
    await request(`/api/access-codes/${disable.dataset.disable}`, { method: 'PATCH', body: JSON.stringify({ disabled: true }) });
    await loadCodes();
  }
});
document.querySelector('[data-refresh]').addEventListener('click', loadCodes);
document.querySelector('[data-copy-all]').addEventListener('click', () => copyText(generatedList.textContent));
document.querySelector('[data-logout]').addEventListener('click', () => { localStorage.removeItem(ADMIN_KEY); showLogin(); });

adminKey() ? showPanel() : showLogin();
