import { s as questions, d as dimensions, c as calculateCityScore } from './assets/calculateCityScore-LwzFX5Cg.js';
import { a as cityMap } from './assets/cities-B4qaspau.js';

const app = document.querySelector('#app');
const STORAGE_KEY = 'city-match-test2-state-v1';
const HISTORY_KEY = 'city-match-test2-history-v1';
const AUTH_KEY = 'city-match-test2-auth-token';
const USER_KEY = 'city-match-test2-user';
const ACCESS_KEY = 'city-match-test2-access-token';
const state = loadState();

function loadState() {
  try {
    return { page: 'home', index: 0, answers: {}, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch { return { page: 'home', index: 0, answers: {} }; }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function esc(value = '') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function setPage(page) { state.page = page; saveState(); window.scrollTo({ top: 0, behavior: 'smooth' }); render(); }
function iconFor(code) { return dimensions[code]?.icon || '✦'; }
function currentUser() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } }

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem(AUTH_KEY);
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new Error('后端服务尚未部署，当前只能查看界面');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '请求失败');
  return data;
}

function openModal(content) {
  document.querySelector('.modal-layer')?.remove();
  const layer = document.createElement('div'); layer.className = 'modal-layer';
  layer.innerHTML = `<div class="modal-card">${content}</div>`; document.body.appendChild(layer);
  layer.querySelectorAll('[data-close]').forEach(x => x.onclick = () => layer.remove());
  layer.onclick = e => { if (e.target === layer) layer.remove(); };
  return layer;
}

function startQuiz() { state.page='quiz'; state.index=firstUnanswered(); saveState(); render(); }
function beginProtectedQuiz() { sessionStorage.getItem(ACCESS_KEY) ? startQuiz() : showAccessModal(); }

function showAccessModal() {
  const layer = openModal(`<div class="modal-head"><div><h2>卡密验证</h2><p>请输入卡密或购买新的测试资格</p></div><button data-close>×</button></div><div class="modal-body"><label>卡密或手机号</label><input data-code maxlength="40" autocomplete="one-time-code" placeholder="请输入卡密"><p class="form-error" data-error></p><div class="modal-actions"><button class="secondary" data-buy>购买卡密</button><button class="verify-btn" data-verify>验证卡密上传</button></div></div>`);
  const input=layer.querySelector('[data-code]'),error=layer.querySelector('[data-error]');
  layer.querySelector('[data-buy]').onclick=()=>showPurchaseFlow();
  layer.querySelector('[data-verify]').onclick=async()=>{error.textContent='';if(!input.value.trim()){error.textContent='请输入卡密';return;}try{const r=await apiRequest('/api/access-codes/redeem',{method:'POST',body:JSON.stringify({code:input.value.trim()})});sessionStorage.setItem(ACCESS_KEY,r.accessToken);layer.remove();startQuiz();}catch(e){error.textContent=e.message;}};
}

function showAuthModal(afterLogin) {
  let mode='login';
  const draw=()=>{const layer=openModal(`<div class="modal-head"><div><h2>${mode==='login'?'登录账号':'创建账号'}</h2><p>账号用于保存订单与测试报告</p></div><button data-close>×</button></div><form class="modal-body" data-auth><div class="auth-tabs"><button type="button" class="${mode==='login'?'active':''}" data-mode="login">登录</button><button type="button" class="${mode==='register'?'active':''}" data-mode="register">注册</button></div>${mode==='register'?'<label>昵称</label><input name="nickname" maxlength="30" placeholder="城市探索者">':''}<label>邮箱</label><input name="email" type="email" required placeholder="name@example.com"><label>密码</label><input name="password" type="password" minlength="8" required placeholder="至少 8 位"><p class="form-error" data-error></p><button class="verify-btn wide" type="submit">${mode==='login'?'登录':'注册并登录'}</button></form>`);layer.querySelectorAll('[data-mode]').forEach(x=>x.onclick=()=>{mode=x.dataset.mode;draw();});layer.querySelector('[data-auth]').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),error=layer.querySelector('[data-error]');try{const r=await apiRequest(`/api/auth/${mode}`,{method:'POST',body:JSON.stringify(Object.fromEntries(f))});localStorage.setItem(AUTH_KEY,r.token);localStorage.setItem(USER_KEY,JSON.stringify(r.user));layer.remove();render();afterLogin?.();}catch(err){error.textContent=err.message;}};};draw();
}

async function showPurchaseFlow() {
  if (!currentUser()) return showAuthModal(showPurchaseFlow);
  try { const order=await apiRequest('/api/orders',{method:'POST',body:JSON.stringify({amount:9.9})});openModal(`<div class="modal-head"><div><h2>订单已创建</h2><p>请在管理端确认后发放卡密</p></div><button data-close>×</button></div><div class="modal-body order-result"><span>订单号</span><strong>${esc(order.id)}</strong><span>金额</span><strong>¥ ${Number(order.amount).toFixed(2)}</strong><span>状态</span><strong>待支付</strong><button class="verify-btn wide" data-close>完成</button></div>`); } catch(e) { openModal(`<div class="modal-head"><div><h2>暂时无法购买</h2><p>${esc(e.message)}</p></div><button data-close>×</button></div><div class="modal-body"><button class="verify-btn wide" data-close>我知道了</button></div>`); }
}

async function showAccount() {
  const user=currentUser(); if(!user) return showAuthModal();
  let orders=[];try{orders=await apiRequest('/api/orders');}catch{}
  const layer=openModal(`<div class="modal-head"><div><h2>我的账号</h2><p>${esc(user.email)}</p></div><button data-close>×</button></div><div class="modal-body"><div class="profile-line"><span>昵称</span><strong>${esc(user.nickname)}</strong></div><h3 class="modal-subtitle">订单记录</h3><div class="order-list">${orders.length?orders.map(o=>`<article><div><b>${esc(o.product)}</b><small>${new Date(o.createdAt).toLocaleString('zh-CN')}</small></div><span class="status ${o.status}">${o.status==='paid'?'已支付':'待支付'}</span></article>`).join(''):'<p class="empty-small">暂无云端订单记录</p>'}</div><button class="secondary wide" data-logout>退出登录</button></div>`);layer.querySelector('[data-logout]').onclick=()=>{localStorage.removeItem(AUTH_KEY);localStorage.removeItem(USER_KEY);sessionStorage.removeItem(ACCESS_KEY);layer.remove();render();};
}

function header(back = false) {
  const user=currentUser();
  return `<header class="topbar"><button class="brand" data-home aria-label="返回首页"><span class="brand-mark">⌖</span><span>城市匹配测试</span></button><div class="nav-actions">${back?'<button class="report-btn" data-back>← 返回</button>':'<button class="report-btn" data-history>▱ 我的报告</button>'}<button class="account-btn" data-account>${user?'● '+esc(user.nickname):'♙ 登录'}</button></div></header>`;
}

function home() {
  const hasProgress = Object.keys(state.answers).length > 0 && Object.keys(state.answers).length < questions.length;
  const cityGroups=[['🏙️','一线城市',['北京','上海','广州','深圳'],'国际视野 · 无限机遇 · 追梦之地'],['◫','新一线城市',['成都','杭州','武汉','南京','+4'],'品质生活 · 发展潜力 · 宜居宜业'],['⌂','宜居二线',['苏州','厦门','青岛','珠海','+4'],'舒适节奏 · 幸福指数 · 安居乐业'],['〰','特色风情',['大理','三亚','拉萨','丽江','+4'],'诗和远方 · 心灵净土 · 自在生活']];
  const dimCopy={A:'快节奏拼搏 vs 慢生活惬意',B:'四季分明 vs 四季如春',C:'历史文化 vs 现代时尚',D:'麻辣重口 vs 清淡养生',E:'热情外向 vs 独立自我',F:'稳定体制 vs 创业挑战',G:'山景高原 vs 海滨风光',H:'品质消费 vs 性价比优先',I:'方言氛围 vs 普通话为主',J:'超大城市 vs 小城安逸',K:'潮流娱乐 vs 传统文化'};
  app.innerHTML = `${header()}<section class="home-hero"><div class="hero shell">
    <div class="hero-copy"><p class="mini-pill">✦ 45道测评 · 11大维度 · 24座城市</p><h1>发现你的<br><em>命定城市</em></h1><p class="lead">每个人心中都有一座城，等待被发现<br>测一测，哪座城市最能成为你的灵魂栖息地</p><button class="primary hero-start" data-start>${hasProgress ? `继续探索（${Object.keys(state.answers).length}/45）` : '◉　开始探索'} </button><div class="facts"><span><b>6–10</b>分钟</span><span><b>45</b>题目</span><span><b>24</b>城市</span><span><b>100%</b>隐私</span></div></div>
    <div class="hero-art" aria-hidden="true"><div class="sun"></div><div class="pin">⌖</div><div class="skyline"></div></div>
  </div><div class="city-marquee"><div>${['北京','上海','广州','深圳','成都','杭州','武汉','南京','苏州','厦门','青岛','珠海','大理','三亚','拉萨','丽江','北京','上海','广州','深圳'].map(x=>`<span>●　${x}</span>`).join('')}</div></div></section>
  <section class="catalog shell"><p class="section-kicker">🏙️ 城市图谱</p><h2>四大类型 <em>各有精彩</em></h2><p class="section-sub">从繁华都市到诗意远方，总有一座与你心灵共振</p><div class="city-groups">${cityGroups.map((g,i)=>`<article><span class="group-icon g${i}">${g[0]}</span><h3><i></i>${g[1]}</h3><div class="city-names">${g[2].map(x=>`<b>${x}</b>`).join('')}</div><p>${g[3]}</p></article>`).join('')}</div></section>
  <section class="dimension-section"><div class="shell"><p class="section-kicker">✧ 科学测评</p><h2>11项维度 <em>精准匹配</em></h2><p class="section-sub">从生活方式到价值追求，全方位解读你的城市偏好</p><div class="dimension-grid">${Object.entries(dimensions).map(([k,v],i) => `<article><small>${String(i+1).padStart(2,'0')}</small><span>${v.icon}</span><div><h3>${esc(v.name)}</h3><p>${dimCopy[k]}</p></div></article>`).join('')}</div></div></section>
  <section class="final-cta shell"><div class="cta-pin">⌖</div><h2>准备好发现你的<em>理想城市</em>了吗？</h2><p>只需几分钟，跟随直觉作答，开启你的城市探索之旅</p><button class="primary" data-start>立即开始　→</button><ul><li>科学算法</li><li>隐私保护</li><li>详细报告</li></ul></section>
  <footer>© 2026 性格城市匹配测试 · City Match Test</footer>`;
  app.querySelector('[data-history]').onclick = showHistory;
  app.querySelectorAll('[data-start]').forEach(x=>x.onclick = beginProtectedQuiz);
  bindHome();
}

function firstUnanswered() { const idx = questions.findIndex(q => !state.answers[q.id]); return idx < 0 ? 0 : idx; }
function quiz() {
  const q = questions[state.index];
  const selected = state.answers[q.id];
  const pct = Math.round(((state.index + (selected ? 1 : 0)) / questions.length) * 100);
  app.innerHTML = `${header(true)}<section class="quiz-wrap shell">
    <div class="quiz-meta"><div><span class="dim-badge">${iconFor(q.dimension)} ${esc(q.dimensionName)}</span><strong>第 ${state.index + 1} / ${questions.length} 题</strong></div><div class="progress"><i style="width:${pct}%"></i></div></div>
    <article class="question-card"><div class="question-no">${String(state.index + 1).padStart(2,'0')}</div><p class="question-hint">请选择最接近你真实想法的一项</p><h1>${esc(q.text)}</h1><div class="options">${q.options.map((o,i) => `<button class="option ${selected===o.value?'selected':''}" data-value="${o.value}"><span>${String.fromCharCode(65+i)}</span><b>${esc(o.label)}</b><i>✓</i></button>`).join('')}</div></article>
    <nav class="quiz-nav"><button class="secondary" data-prev ${state.index===0?'disabled':''}>← 上一题</button><button class="primary" data-next ${selected?'':'disabled'}>${state.index===questions.length-1?'查看结果':'下一题 →'}</button></nav>
  </section>`;
  app.querySelectorAll('.option').forEach(btn => btn.onclick = () => { state.answers[q.id]=btn.dataset.value; saveState(); render(); });
  app.querySelector('[data-prev]').onclick = () => { if(state.index>0){state.index--;saveState();render();} };
  app.querySelector('[data-next]').onclick = () => { if(!state.answers[q.id]) return; if(state.index < questions.length-1){state.index++;saveState();render();} else finish(); };
  app.querySelector('[data-back]').onclick = () => setPage('home'); bindHome();
}

function finish() {
  if (Object.keys(state.answers).length !== questions.length) { state.index=firstUnanswered(); saveState(); render(); return; }
  state.result = calculateCityScore(state.answers);
  state.page = 'result';
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  history.unshift({ date: new Date().toISOString(), topCities: state.result.topCities });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0,10)));
  syncReport(state.result);
  saveState(); render();
}

async function syncReport(result) {
  if (location.hostname.endsWith('github.io') || location.protocol === 'file:') return;
  try {
    const token = localStorage.getItem(AUTH_KEY);
    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(result)
    });
  } catch { /* 静态预览时继续保留本地结果 */ }
}

function result() {
  const r = state.result || calculateCityScore(state.answers);
  const top = r.topCities[0]; const city = cityMap[top.code];
  app.innerHTML = `${header(true)}<section class="result-wrap shell">
    <div class="result-hero"><p class="eyebrow"><span></span> YOUR CITY MATCH</p><p>最适合你的城市是</p><h1>${esc(top.name)}</h1><div class="match-ring" style="--score:${top.percentage}"><b>${top.percentage}<small>%</small></b><span>综合契合度</span></div><div class="tags">${(city.tags||[]).slice(0,5).map(t=>`<span>${esc(t)}</span>`).join('')}</div><p class="city-desc">${esc(city.description)}</p></div>
    <section class="top-three"><p class="section-label">TOP MATCHES</p><h2>你的城市契合榜</h2><div class="rank-grid">${r.topCities.map((x,i)=>{const c=cityMap[x.code];return `<article><span class="rank">0${i+1}</span><h3>${esc(x.name)}</h3><strong>${x.percentage}%</strong><p>${esc(c.lifestyle)}</p></article>`}).join('')}</div></section>
    <section class="analysis"><p class="section-label">LIFE PROFILE</p><h2>你的生活偏好图谱</h2><div>${r.dimensionAnalysis.map(x=>`<article><span>${iconFor(x.dimension)}</span><p>${esc(x.name)}</p><b>${esc(x.preference)}</b></article>`).join('')}</div></section>
    <section class="details"><div><p class="section-label">WHY THIS CITY</p><h2>为什么是${esc(top.name)}？</h2><p>${esc(city.recommendation?.whyThisCity || city.description)}</p></div><div><h3>适合你的理由</h3><ul>${(city.recommendation?.idealFor||city.suitableFor||[]).slice(0,4).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></section>
    <div class="result-actions"><button class="primary" data-restart>重新测试</button><button class="secondary" data-home>返回首页</button></div>
  </section><footer>结果仅供娱乐与自我探索参考</footer>`;
  app.querySelector('[data-restart]').onclick = () => { state.answers={};state.index=0;state.result=null;state.page='quiz';saveState();render(); };
  app.querySelector('[data-back]').onclick = () => setPage('home'); bindHome();
}

function showHistory() {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  app.innerHTML = `${header(true)}<section class="history shell"><p class="section-label">LOCAL HISTORY</p><h1>我的测试记录</h1><p>这些记录只保存在当前浏览器中。</p><div class="history-list">${history.length ? history.map((h,i)=>`<article><span>#${String(i+1).padStart(2,'0')}</span><div><h2>${esc(h.topCities[0].name)}</h2><p>${new Date(h.date).toLocaleString('zh-CN')}</p></div><strong>${h.topCities[0].percentage}%</strong></article>`).join('') : '<div class="empty">还没有历史结果，完成一次测试后会显示在这里。</div>'}</div><button class="primary" data-start>开始测试</button></section>`;
  app.querySelector('[data-start]').onclick = beginProtectedQuiz;
  app.querySelector('[data-back]').onclick = () => setPage('home'); bindHome();
}
function bindHome(){ app.querySelectorAll('[data-home]').forEach(x=>x.onclick=()=>setPage('home'));app.querySelectorAll('[data-account]').forEach(x=>x.onclick=showAccount); }
function render(){ if(state.page==='quiz') quiz(); else if(state.page==='result' && state.result) result(); else home(); }
render();
