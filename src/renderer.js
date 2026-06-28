/* ═══════════════════════════════════════════════════════════
   EXPENSE TRACKER — renderer.js
   Talks to Flask at http://127.0.0.1:5000/api
═══════════════════════════════════════════════════════════ */

const API = 'http://127.0.0.1:5000/api';
let API_TOKEN = '';   // filled in at boot

// Escapes user-entered text before inserting into innerHTML
// Prevents HTML/script injection if someone types <script> in a title field
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── App State ───────────────────────────────────────────────
const S = {
  page:      'dashboard',
  month:     new Date().getMonth() + 1,
  year:      new Date().getFullYear(),
  catFilter: '',
  search:    '',        // ← add this
  editId:    null,
  charts:    {},
};

// ── Category meta ───────────────────────────────────────────
const CAT_COLORS = {
  Groceries:     '#22c55e',
  Utilities:     '#38bdf8',
  Transport:     '#f97316',
  Dining:        '#fbbf24',
  Shopping:      '#f472b6',
  Healthcare:    '#ef4444',
  Entertainment: '#c084fc',
  Education:     '#06b6d4',
  Sports:        '#84cc16',
  Other:         '#818cf8',
};
const CAT_ICONS = {
  Groceries: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>`,

  Utilities: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>`,

  Transport: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
   stroke-linejoin="round" class="lucide lucide-car-icon lucide-car">
   <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
   <circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`,

  Dining: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
   stroke-linejoin="round" class="lucide lucide-utensils-icon lucide-utensils"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/>
  <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,

  Shopping: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>`,

  Healthcare: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" 
  class="lucide lucide-heart-plus-icon lucide-heart-plus"><path d="m14.479 19.374-.971.939a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5a5.2 5.2 0 0 1-.219 1.49"/>
  <path d="M15 15h6"/><path d="M18 12v6"/></svg>`,

  Entertainment: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
   stroke-linejoin="round" class="lucide lucide-headset-icon lucide-headset">
   <path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/>
   <path d="M21 16v2a4 4 0 0 1-4 4h-5"/></svg>`,

  Education: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
   stroke-linejoin="round" class="lucide lucide-graduation-cap-icon lucide-graduation-cap">
  <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>`,

  Sports: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" 
  class="lucide lucide-volleyball-icon lucide-volleyball"><path d="M11 7a16 16 20 0 1 10.98 4.362"/><path d="M12 12a13 13 0 0 1-8.66 5"/><path d="M16.83 13.634a16 16 0 0 1-9.267 7.328"/>
  <path d="M20.66 17A13 13 0 0 0 12 12a13 13 0 0 1 0-10"/><path d="M8.17 15.366a16 16 0 0 1-1.713-11.69"/><circle cx="12" cy="12" r="10"/></svg>`,

  Other: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" 
  class="lucide lucide-boxes-icon lucide-boxes"><path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"/><path d="m7 16.5-4.74-2.85"/><path d="m7 16.5 5-3"/>
  <path d="M7 16.5v5.17"/><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"/><path d="m17 16.5-5-3"/><path d="m17 16.5 4.74-2.85"/><path d="M17 16.5v5.17"/>
  <path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"/><path d="M12 8 7.26 5.15"/><path d="m12 8 4.74-2.85"/><path d="M12 13.5V8"/></svg>`,
};
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

// ── Utilities ────────────────────────────────────────────────
const fmtCurrency = n => `LKR ${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const fmtNum      = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const fmtDate     = d => { const dt = new Date(d + 'T00:00:00'); return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()] + ' ' + dt.getDate(); };
const catColor    = c => CAT_COLORS[c] || '#9ca3af';
const catIcon     = c => CAT_ICONS[c]  || '📦';
const catBgClass  = c => 'bg-' + (c || '').toLowerCase().replace(/\s/g, '');

function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 350); }, 5500);
}

// Custom confirm dialog — replaces browser confirm()
// Usage: const yes = await customConfirm('Delete this?', 'This cannot be undone.');
function customConfirm(title, message, okLabel = 'Delete') {
  return new Promise(resolve => {
    document.getElementById('confirm-title').textContent   = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-ok').textContent      = okLabel;
    document.getElementById('confirm-overlay').classList.remove('hidden');

    const ok     = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');
    const overlay = document.getElementById('confirm-overlay');

    function cleanup(result) {
      overlay.classList.add('hidden');
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlay);
      resolve(result);
    }

    const onOk      = () => cleanup(true);
    const onCancel  = () => cleanup(false);
    const onOverlay = e => { if (e.target === overlay) cleanup(false); };

    ok.addEventListener('click',     onOk);
    cancel.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlay);
  });
}

// ── API helpers ──────────────────────────────────────────────
async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Token': API_TOKEN
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + path, opts);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const GET    = p       => api('GET', p);
const POST   = (p, b)  => api('POST', p, b);
const PUT    = (p, b)  => api('PUT', p, b);
const DELETE = p       => api('DELETE', p);

// ── Wait for Flask to start ──────────────────────────────────
async function waitForBackend() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(API + '/health', { signal: AbortSignal.timeout(1200) });
      if (r.ok) return true;
    } catch (_) { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 600));
  }
  return false;
}

// ── Navigation ───────────────────────────────────────────────
function navigate(page) {
  S.page = page;
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page));
  document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));
  document.getElementById('page-' + page).classList.remove('hidden');
  renderPage(page);
}

function renderPage(page) {
  ({ dashboard: renderDashboard, transactions: renderTransactions,
     reports: renderReports, budgets: renderBudgets, settings: renderSettings })[page]?.();
}

// ════════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════════
async function renderDashboard() {
  const el = document.getElementById('page-dashboard');
  el.innerHTML = '<div class="empty" style="padding-top:80px"><div class="spinner" style="margin:0 auto 16px"></div></div>';

  try {
    const d = await GET(`/dashboard?month=${S.month}&year=${S.year}`);
    const budgetPct = d.monthly_budget > 0 ? Math.min((d.total_spent / d.monthly_budget) * 100, 100) : 0;
    const totalCat  = d.spending_by_category.reduce((a, c) => a + c.total, 0);

    el.innerHTML = `
      <div class="page-header">
        <div class="month-nav">
          <button id="d-prev">&#9664;</button>
          <h2>${MONTHS[S.month - 1]} ${S.year}</h2>
          <button id="d-next">&#9654;</button>
        </div>
        <button class="btn-primary" id="d-add">+ Add expense</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total spent</div>
          <div class="stat-value red">${fmtCurrency(d.total_spent)}</div>
          <div class="stat-sub">this month</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Monthly budget</div>
          <div class="stat-value green">${fmtCurrency(d.monthly_budget)}</div>
          <div class="stat-sub">${fmtCurrency(Math.max(0, d.remaining))} remaining</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Transactions</div>
          <div class="stat-value white">${d.transaction_count}</div>
          <div class="stat-sub">this month</div>
        </div>
      </div>

      <div class="dash-grid">
        <div class="card">
          <div class="card-title">Recent Transactions</div>
          ${buildRecentList(d.recent_transactions)}
        </div>
        <div class="card">
          <div class="card-title">Spending by Category</div>
          ${buildCatBars(d.spending_by_category, totalCat, budgetPct)}
        </div>
      </div>`;

    document.getElementById('d-prev').onclick = () => prevMonth(renderDashboard);
    document.getElementById('d-next').onclick = () => nextMonth(renderDashboard);
    document.getElementById('d-add').onclick  = () => openModal();
  } catch (e) {
    el.innerHTML = errState('Could not load dashboard. Make sure the backend started.');
  }
}

function buildRecentList(items) {
  if (!items?.length) return `<div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></div><p>No transactions this month</p></div>`;
  return '<div class="trans-list">' + items.map(t => `
    <div class="trans-item">
      <div class="trans-icon ${catBgClass(t.category)}">${catIcon(t.category)}</div>
      <div class="trans-info">
        <div class="trans-name">${esc(t.title)}</div>
        <div class="trans-meta">${esc(t.category)} · ${fmtDate(t.date)}</div>
      </div>
      <div class="trans-amount">-${fmtNum(t.amount)}</div>
    </div>`).join('') + '</div>';
}

function buildCatBars(cats, total, budgetPct) {
  if (!cats?.length) return `<div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg></div><p>No data yet</p></div>`;
  const bars = cats.map(c => {
    const pct = total > 0 ? (c.total / total) * 100 : 0;
    const col = catColor(c.category);
    return `<div class="cat-item">
      <div class="cat-row">
        <div class="cat-name"><div class="cat-dot" style="background:${col}"></div>${c.category}</div>
        <div class="cat-total">${fmtNum(c.total)}</div>
      </div>
      <div class="bar-bg"><div class="bar-fill" style="width:${pct}%;background:${col}"></div></div>
    </div>`;
  }).join('');
  return `<div class="cat-list">${bars}
    <div class="budget-footer">
      <div class="budget-label-row"><span>Budget used</span><span>${Math.round(budgetPct)}%</span></div>
      <div class="bar-bg"><div class="bar-fill" style="width:${budgetPct}%;background:${budgetPct > 90 ? '#ef4444' : '#34d399'}"></div></div>
    </div>
  </div>`;
}

// ════════════════════════════════════════════════════════════
//  TRANSACTIONS
// ════════════════════════════════════════════════════════════
async function renderTransactions() {
  const el = document.getElementById('page-transactions');
  try {
    const catParam = S.catFilter ? `&category=${encodeURIComponent(S.catFilter)}` : '';
    const rows = await GET(`/transactions?month=${S.month}&year=${S.year}${catParam}`);

    const catOptions = ['Groceries','Utilities','Transport','Dining','Shopping','Healthcare','Entertainment','Education','Sports','Other']
      .map(c => `<option value="${c}" ${S.catFilter===c?'selected':''}>${c}</option>`).join('');
    // Apply search filter client-side
    const displayRows = rows.filter(t => {
      if (!S.search) return true;
      const q = S.search.toLowerCase();
      return t.title.toLowerCase().includes(q) ||
             (t.note  || '').toLowerCase().includes(q);
    });
    el.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Transactions</h1>
        <button class="btn-primary" id="t-add">+ Add expense</button>
      </div>

      <div class="filters">
        <div class="month-nav" style="gap:8px">
          <button class="filter-select" id="t-prev">&#9664;</button>
          <span style="font-weight:600;font-size:15px">${MONTHS[S.month-1]} ${S.year}</span>
          <button class="filter-select" id="t-next">&#9654;</button>
        </div>
        <select class="filter-select" id="t-cat-filter">
          <option value="" ${!S.catFilter?'selected':''}>All Categories</option>
          ${catOptions}
        </select>
        <input
          class="filter-select"
          id="t-search"
          type="text"
          placeholder="Search title or note..."
          value="${esc(S.search)}"
          style="min-width:200px; background:var(--bg-surface);">
        <button class="filter-select" id="t-clear-filters"
          style="color:var(--text-muted);${(!S.catFilter && !S.search) ? 'opacity:0.4;cursor:default' : ''}">
          ✕ Clear
        </button>
      </div>

      <div class="card table-wrap">
        ${displayRows.length === 0
          ? `<div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></div><p>No transactions found</p></div>`
          : `<table class="data-table">
              <thead><tr>
                <th>Title</th><th>Category</th><th>Date</th><th>Amount</th><th>Note</th><th>Actions</th>
              </tr></thead>
              <tbody>
                ${displayRows.map(t => `
                  <tr>
                    <td><div style="display:flex;align-items:center;gap:10px">
                      <div class="icon-sm ${catBgClass(t.category)}">${catIcon(t.category)}</div>
                      ${esc(t.title)}
                    </div></td>
                    <td style="color:${catColor(t.category)}">${esc(t.category)}</td>
                    <td>${fmtDate(t.date)}</td>
                    <td style="color:var(--red);font-weight:600">-${fmtCurrency(t.amount)}</td>
                    <td style="color:var(--text-muted)">${esc(t.note) || '-'}</td>
                    <td>
                      <button class="act-btn edi" data-id="${t.id}" title="Edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button class="act-btn del" data-id="${t.id}" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </button>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>`}
      </div>`;

    document.getElementById('t-add').onclick  = () => openModal();
    document.getElementById('t-prev').onclick = () => { prevMonth(() => { S.catFilter=''; renderTransactions(); }); };
    document.getElementById('t-next').onclick = () => { nextMonth(() => { S.catFilter=''; renderTransactions(); }); };
    document.getElementById('t-cat-filter').onchange = function() { S.catFilter = this.value; renderTransactions(); };

    document.getElementById('t-search').addEventListener('input', async function() {
      S.search = this.value;
      const savedValue = this.value;  // capture before re-render destroys the input
      await renderTransactions();     // wait for full re-render to finish
      const input = document.getElementById('t-search');
      if (input) {
        input.value = savedValue;     // restore the typed value
        input.focus();
        input.setSelectionRange(savedValue.length, savedValue.length);
      }
    });

    document.getElementById('t-clear-filters').onclick = () => {
      S.catFilter = '';
      S.search    = '';
      renderTransactions();
    };

    el.querySelectorAll('.act-btn.edi').forEach(b => b.onclick = async () => {
      const t = displayRows.find(x => x.id == b.dataset.id);
      if (t) openModal(t);
    });
    el.querySelectorAll('.act-btn.del').forEach(b => b.onclick = async () => {
      const t = displayRows.find(x => x.id == b.dataset.id);
      const yes = await customConfirm(
        'Delete transaction?',
        `"${t ? t.title : 'This transaction'}" will be permanently deleted.`
      );
      if (!yes) return;
      await DELETE('/transactions/' + b.dataset.id);
      toast('Transaction deleted');
      renderTransactions();
    });
  } catch (e) {
    el.innerHTML = errState('Failed to load transactions.');
  }
}

// ════════════════════════════════════════════════════════════
//  REPORTS
// ════════════════════════════════════════════════════════════
async function renderReports() {
  // Destroy old charts before replacing canvas elements
  ['monthly','donut'].forEach(k => { if (S.charts[k]) { S.charts[k].destroy(); delete S.charts[k]; } });

  const el = document.getElementById('page-reports');
  const yearOpts = [0,1,2].map(i => { const y = new Date().getFullYear()-i; return `<option value="${y}" ${y===S.year?'selected':''}>${y}</option>`; }).join('');

el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Reports</h1>
      <select class="filter-select" id="r-year">${yearOpts}</select>
    </div>
    <div class="reports-grid">
      <div class="card chart-card" id="monthly-card">
        <div class="card-header-row">
          <div class="card-title">Monthly Spending (${S.year})</div>
          <span class="expand-hint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 3h6v6"/><path d="M9 21H3v-6"/>
              <path d="M21 3l-7 7"/><path d="M3 21l7-7"/>
            </svg>
            expand
          </span>
        </div>
        <div class="chart-box"><canvas id="monthly-chart"></canvas></div>
      </div>
      <div class="card chart-card" id="donut-card">
        <div class="card-header-row">
          <div class="card-title">By Category</div>
          <span class="expand-hint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 3h6v6"/><path d="M9 21H3v-6"/>
              <path d="M21 3l-7 7"/><path d="M3 21l7-7"/>
            </svg>
            expand
          </span>
        </div>
        <div class="chart-box"><canvas id="donut-chart"></canvas></div>
      </div>
    </div>`;

  document.getElementById('r-year').onchange = function() { S.year = +this.value; renderReports(); };

  try {
    const d = await GET('/reports?year=' + S.year);
    const chartDefaults = { color: '#94a3b8', grid: 'rgba(255,255,255,0.05)' };

    // Bar chart — monthly spending
    S.charts.monthly = new Chart(document.getElementById('monthly-chart'), {
      type: 'bar',
      data: {
        labels: d.monthly_spending.map(r => MONTHS[+r.month-1].slice(0,3)),
        datasets: [{ label: 'LKR', data: d.monthly_spending.map(r => r.total),
          backgroundColor: '#6366f1', borderRadius: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: chartDefaults.grid }, ticks: { color: chartDefaults.color } },
          y: { grid: { color: chartDefaults.grid }, ticks: { color: chartDefaults.color, callback: v => 'LKR ' + fmtNum(v) } }
        }
      }
    });

    // Donut chart — by category
    const cats = d.category_breakdown;
    S.charts.donut = new Chart(document.getElementById('donut-chart'), {
      type: 'doughnut',
      data: {
        labels: cats.map(c => c.category),
        datasets: [{ data: cats.map(c => c.total),
          backgroundColor: cats.map(c => catColor(c.category)),
          borderWidth: 2, borderColor: '#1e293b' }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 14, boxWidth: 12 } } }
      }
    });
  // Make cards open expanded modal when clicked
    document.getElementById('monthly-card').onclick = () => openChartModal('monthly', d);
    document.getElementById('donut-card').onclick   = () => openChartModal('donut',   d);

  } catch (e) { /* charts silently fail on no data — canvas stays blank */ }
}

// ════════════════════════════════════════════════════════════
//  CHART EXPAND MODAL
// ════════════════════════════════════════════════════════════
let expandedChart = null;

function openChartModal(type, data) {
  // Clean up any existing expanded modal
  closeChartModal();

  const title = type === 'monthly'
    ? `Monthly Spending (${S.year})`
    : 'Spending by Category';

  // Build modal HTML
  const backdrop = document.createElement('div');
  backdrop.className = 'chart-modal-backdrop';
  backdrop.id        = 'chart-modal-backdrop';

  backdrop.innerHTML = `
    <div class="chart-modal">
      <div class="chart-modal-header">
        <h3>${title}</h3>
        <button class="chart-modal-close" id="chart-modal-close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6"  y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="chart-modal-body">
        <div class="chart-modal-canvas">
          <canvas id="expanded-chart"></canvas>
        </div>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  // Close on clicking blurred backdrop outside the modal box
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closeChartModal();
  });

  // Close on X button
  document.getElementById('chart-modal-close').onclick = closeChartModal;

  // Close on Escape key
  document.addEventListener('keydown', handleChartEscape);

  // Draw the bigger chart
  const canvas = document.getElementById('expanded-chart');

  if (type === 'monthly') {
    expandedChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.monthly_spending.map(r => MONTHS[+r.month - 1]),
        datasets: [{
          label: 'LKR',
          data: data.monthly_spending.map(r => r.total),
          backgroundColor: '#6366f1',
          borderRadius: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid:  { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8', font: { size: 13 } }
          },
          y: {
            grid:  { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#94a3b8',
              font: { size: 13 },
              callback: v => 'LKR ' + fmtNum(v)
            }
          }
        }
      }
    });

  } else {
    const cats = data.category_breakdown;
    expandedChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: cats.map(c => c.category),
        datasets: [{
          data:            cats.map(c => c.total),
          backgroundColor: cats.map(c => catColor(c.category)),
          borderWidth: 3,
          borderColor: '#1e293b',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color:    '#94a3b8',
              padding:  18,
              boxWidth: 14,
              font: { size: 13 }
            }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: LKR ${fmtNum(ctx.parsed)}`
            }
          }
        }
      }
    });
  }
}

function handleChartEscape(e) {
  if (e.key === 'Escape') closeChartModal();
}

function closeChartModal() {
  if (expandedChart) { expandedChart.destroy(); expandedChart = null; }
  const backdrop = document.getElementById('chart-modal-backdrop');
  if (backdrop) backdrop.remove();
  document.removeEventListener('keydown', handleChartEscape);
}

// ════════════════════════════════════════════════════════════
//  BUDGETS
// ════════════════════════════════════════════════════════════
async function renderBudgets() {
  const el = document.getElementById('page-budgets');
  try {
    const budgets = await GET('/budgets');
    const cur = budgets.find(b => +b.month === S.month && +b.year === S.year);
    const monthOpts = MONTHS.map((m,i) => `<option value="${i+1}" ${i+1===S.month?'selected':''}>${m}</option>`).join('');
    const yearOpts  = [1,0,-1].map(i => { const y=new Date().getFullYear()+i; return `<option value="${y}" ${y===S.year?'selected':''}>${y}</option>`; }).join('');

    el.innerHTML = `
      <div class="page-header"><h1 class="page-title">Budgets</h1></div>
      <div class="budgets-layout">
        <div class="card">
          <div class="card-title">Set Monthly Budget</div>
          <div class="budget-form">
            <div class="form-group"><label>Month</label><select id="b-month">${monthOpts}</select></div>
            <div class="form-group"><label>Year</label><select id="b-year">${yearOpts}</select></div>
            <div class="form-group"><label>Budget Amount (LKR)</label><input type="number" id="b-amount" placeholder="e.g. 60000" value="${cur ? cur.amount : ''}"></div>
            <button class="btn-primary" id="b-save">Save Budget</button>
          </div>
        </div>
        <div class="card">
          <div class="card-title">All Saved Budgets</div>
          ${budgets.length === 0
            ? `<div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></div><p>No budgets set yet</p></div>`
            : `<table class="data-table">
                <thead><tr><th>Month</th><th>Year</th><th>Budget</th></tr></thead>
                <tbody>
                  ${budgets.map(b => `<tr>
                    <td>${MONTHS[+b.month-1]}</td>
                    <td>${b.year}</td>
                    <td style="color:var(--green);font-weight:600">${fmtCurrency(b.amount)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>`}
        </div>
      </div>`;

    // When month/year changes, pre-fill existing budget amount
    const refill = async () => {
      const m = +document.getElementById('b-month').value;
      const y = +document.getElementById('b-year').value;
      const buds = await GET('/budgets');
      const found = buds.find(b => +b.month === m && +b.year === y);
      document.getElementById('b-amount').value = found ? found.amount : '';
    };
    document.getElementById('b-month').onchange = refill;
    document.getElementById('b-year').onchange  = refill;

    document.getElementById('b-save').onclick = async () => {
      const month  = String(document.getElementById('b-month').value).padStart(2,'0');
      const year   = +document.getElementById('b-year').value;
      const amount = +document.getElementById('b-amount').value;
      if (!amount || amount <= 0) { toast('Enter a valid amount', 'error'); return; }
      await POST('/budgets', { month, year, amount });
      toast('Budget saved!');
      renderBudgets();
    };
  } catch (e) {
    el.innerHTML = errState('Failed to load budgets.');
  }
}

// ════════════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════════════
function renderSettings() {
  document.getElementById('page-settings').innerHTML = `
    <div class="page-header"><h1 class="page-title">Settings</h1></div>
    <div class="card settings-card">
      <div class="settings-section">
        <h3>General</h3>
        <div class="settings-row"><span class="settings-key">Currency</span><span class="settings-val">Sri Lankan Rupee (LKR)</span></div>
        <div class="settings-row"><span class="settings-key">Version</span><span class="settings-val">1.0.0</span></div>
      </div>
      <div class="settings-section">
        <h3>Data</h3>
        <div class="settings-row">
          <span class="settings-key">Export all transactions to CSV</span>
          <button class="btn-primary" id="s-export">Export CSV</button>
        </div>
        <div class="settings-row">
          <span class="settings-key">Import transactions from CSV</span>
          <button class="btn-primary" id="s-import" style="background:var(--bg-elevated);border:1px solid var(--border)">Import CSV</button>
        </div>
        <input type="file" id="s-import-file" accept=".csv" style="display:none">
        <div class="settings-row">
          <span class="settings-key" style="color:var(--red)">Clear all data</span>
          <button class="btn-danger" id="s-clear">Clear Data</button>
        </div>
      </div>
      <div class="settings-section">
        <h3>About</h3>
        <div class="settings-row"><span class="settings-key">App</span><span class="settings-val">NeoWallet — Desktop Edition</span></div>
        <div class="settings-row"><span class="settings-key">Built with</span><span class="settings-val">Electron · Flask · SQLite</span></div>
      </div>
    </div>`;

  document.getElementById('s-export').onclick = async () => {
    try {
      const rows = await GET('/transactions');

      // Properly escape a CSV field — wraps in quotes and escapes inner quotes
      const csvField = v => {
        // Replace newlines with a space so the import parser never sees multiline fields
        const s = String(v ?? '').replace(/[\r\n]+/g, ' ');
        // If field contains comma or quote — wrap in quotes and escape inner quotes
        if (s.includes(',') || s.includes('"')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };

      const csv = [
        'Date,Title,Category,Amount,Note',
        ...rows.map(t => [
          csvField(t.date),
          csvField(t.title),
          csvField(t.category),
          csvField(t.amount),
          csvField(t.note || '')
        ].join(','))
      ].join('\n');

      const a = document.createElement('a');
      a.href = 'data:text/csv,' + encodeURIComponent(csv);
      a.download = `expenses_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      toast('Exported!');
    } catch { toast('Export failed', 'error'); }
  };
  document.getElementById('s-import').onclick = () => {
    document.getElementById('s-import-file').click();
  };

  document.getElementById('s-import-file').onchange = async function () {
    const file = this.files[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) { toast('CSV file is empty', 'error'); return; }

    // Expected header: Date,Title,Category,Amount,Note
    // Proper CSV parser — handles quoted fields, escaped quotes, commas inside fields
    function parseCSVLine(line) {
      const fields = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') {
            cur += '"'; i++; // escaped quote "" → "
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            cur += ch;
          }
        } else {
          if (ch === '"') {
            inQuotes = true;
          } else if (ch === ',') {
            fields.push(cur.trim()); cur = '';
          } else {
            cur += ch;
          }
        }
      }
      fields.push(cur.trim());
      return fields;
    }

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue; // skip empty lines
      const clean = parseCSVLine(lines[i]);
      if (clean.length < 4) continue;
      rows.push({
        date:     clean[0],
        title:    clean[1],
        category: clean[2],
        amount:   parseFloat(clean[3]),
        note:     clean[4] || ''
      });
    }

    if (rows.length === 0) { toast('No valid rows found in CSV', 'error'); return; }

    try {
      const result = await POST('/transactions/import', rows);
      toast(`Imported ${result.inserted} transactions${result.skipped > 0 ? `, skipped ${result.skipped} invalid rows` : ''}!`);
      this.value = ''; // reset file input
    } catch {
      toast('Import failed', 'error');
    }
  };

document.getElementById('s-clear').onclick = async () => {
    const yes = await customConfirm(
      'Clear all data?',
      'Every transaction and budget will be permanently deleted. Export a CSV backup first if needed.',
      'Clear Everything'
    );
    if (yes) {
        try {
            await DELETE('/clear');
            toast('All data cleared!');
            navigate('dashboard');
        } catch {
            toast('Failed to clear data', 'error');
        }
    }
};
}

// ════════════════════════════════════════════════════════════
//  MODAL (Add / Edit Transaction)
// ════════════════════════════════════════════════════════════
function openModal(t = null) {
  S.editId = t ? t.id : null;
  document.getElementById('modal-title').textContent = t ? 'Edit Transaction' : 'Add Expense';
  document.getElementById('trans-id').value       = t?.id     || '';
  document.getElementById('trans-title').value    = t?.title  || '';
  document.getElementById('trans-amount').value   = t?.amount || '';
  document.getElementById('trans-category').value = t?.category || 'Groceries';
  document.getElementById('trans-date').value     = t?.date   || new Date().toISOString().slice(0,10);
  document.getElementById('trans-note').value     = t?.note   || '';
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('trans-title').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  S.editId = null;
}

async function saveModal() {
  const title    = document.getElementById('trans-title').value.trim();
  const amount   = parseFloat(document.getElementById('trans-amount').value);
  const category = document.getElementById('trans-category').value;
  const date     = document.getElementById('trans-date').value;
  const note     = document.getElementById('trans-note').value.trim();

  if (!title)            { toast('Please enter a title', 'error');  return; }
  if (!amount || amount <= 0) { toast('Enter a valid amount', 'error'); return; }
  if (!date)             { toast('Please pick a date', 'error');    return; }

  try {
    if (S.editId) {
      await PUT('/transactions/' + S.editId, { title, amount, category, date, note });
      toast('Transaction updated!');
    } else {
      await POST('/transactions', { title, amount, category, date, note });
      toast('Transaction added!');
    }
    closeModal();
    renderPage(S.page);
  } catch { toast('Failed to save', 'error'); }
}

// ── Month navigation helpers ─────────────────────────────────
function prevMonth(cb) {
  S.month--; if (S.month < 1)  { S.month = 12; S.year--; }
  cb();
}
function nextMonth(cb) {
  S.month++; if (S.month > 12) { S.month = 1;  S.year++; }
  cb();
}

function errState(msg) {
  return `<div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><p>${msg}</p></div>`;
}

// ════════════════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  // Wire up sidebar navigation
  document.querySelectorAll('.nav-item').forEach(el =>
    el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.page); }));

  // Wire up modal buttons
    // Auto-capitalize first letter of transaction title
  document.getElementById('trans-title').addEventListener('input', function () {
    if (this.value.length > 0) {
      const pos = this.selectionStart;
      this.value = this.value.charAt(0).toUpperCase() + this.value.slice(1);
      this.setSelectionRange(pos, pos);
    }
  });
  document.getElementById('modal-close').onclick = closeModal;
  document.getElementById('btn-cancel').onclick  = closeModal;
  document.getElementById('btn-save').onclick    = saveModal;
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  // Allow Escape key to close modal
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Show loading screen and wait for Flask
  // Get the security token from the main process before any API calls
  API_TOKEN = await window.electronAPI.getApiToken();

  const loader = document.getElementById('loading-screen');
  const ready  = await waitForBackend();
  loader.classList.add('hidden');

  if (ready) {
    navigate('dashboard');
  } else {
    document.getElementById('page-dashboard').innerHTML = `
      <div class="empty" style="padding-top:120px">
        <div class="empty-icon">⚠️</div>
        <h2 style="margin-bottom:8px">Backend didn't start</h2>
        <p>Make sure the <strong>venv</strong> folder exists inside expense-tracker<br>
           and Flask is installed. Then restart the app.</p>
      </div>`;
    document.getElementById('page-dashboard').classList.remove('hidden');
  }
});