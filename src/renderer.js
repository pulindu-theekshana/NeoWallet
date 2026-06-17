/* ═══════════════════════════════════════════════════════════
   EXPENSE TRACKER — renderer.js
   Talks to Flask at http://127.0.0.1:5000/api
═══════════════════════════════════════════════════════════ */

const API = 'http://127.0.0.1:5000/api';

// ── App State ───────────────────────────────────────────────
const S = {
  page:    'dashboard',
  month:   new Date().getMonth() + 1,
  year:    new Date().getFullYear(),
  catFilter: '',
  editId:  null,
  charts:  {},
};

// ── Category meta ───────────────────────────────────────────
const CAT_COLORS = {
  Groceries:     '#10b981', Utilities:  '#3b82f6', Transport:     '#f59e0b',
  Dining:        '#ec4899', Shopping:   '#06b6d4', Healthcare:    '#ef4444',
  Entertainment: '#f97316', Other:      '#8b5cf6',
};
const CAT_ICONS = {
  Groceries: '🛒', Utilities: '⚡', Transport: '🚌', Dining: '☕',
  Shopping:  '🛍️', Healthcare: '🏥', Entertainment: '🎮', Other: '📦',
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
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 350); }, 2400);
}

// ── API helpers ──────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
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
          <button id="d-prev">◀</button>
          <h2>${MONTHS[S.month - 1]} ${S.year}</h2>
          <button id="d-next">▶</button>
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
  if (!items?.length) return '<div class="empty"><div class="empty-icon">📭</div><p>No transactions this month</p></div>';
  return '<div class="trans-list">' + items.map(t => `
    <div class="trans-item">
      <div class="trans-icon ${catBgClass(t.category)}">${catIcon(t.category)}</div>
      <div class="trans-info">
        <div class="trans-name">${t.title}</div>
        <div class="trans-meta">${t.category} · ${fmtDate(t.date)}</div>
      </div>
      <div class="trans-amount">-${fmtNum(t.amount)}</div>
    </div>`).join('') + '</div>';
}

function buildCatBars(cats, total, budgetPct) {
  if (!cats?.length) return '<div class="empty"><div class="empty-icon">📊</div><p>No data yet</p></div>';
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

    const catOptions = ['Groceries','Utilities','Transport','Dining','Shopping','Healthcare','Entertainment','Other']
      .map(c => `<option value="${c}" ${S.catFilter===c?'selected':''}>${c}</option>`).join('');

    el.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Transactions</h1>
        <button class="btn-primary" id="t-add">+ Add expense</button>
      </div>

      <div class="filters">
        <div class="month-nav" style="gap:8px">
          <button class="filter-select" id="t-prev">◀</button>
          <span style="font-weight:600;font-size:15px">${MONTHS[S.month-1]} ${S.year}</span>
          <button class="filter-select" id="t-next">▶</button>
        </div>
        <select class="filter-select" id="t-cat-filter">
          <option value="" ${!S.catFilter?'selected':''}>All Categories</option>
          ${catOptions}
        </select>
      </div>

      <div class="card table-wrap">
        ${rows.length === 0
          ? '<div class="empty"><div class="empty-icon">📭</div><p>No transactions found</p></div>'
          : `<table class="data-table">
              <thead><tr>
                <th>Title</th><th>Category</th><th>Date</th><th>Amount</th><th>Note</th><th>Actions</th>
              </tr></thead>
              <tbody>
                ${rows.map(t => `
                  <tr>
                    <td><div style="display:flex;align-items:center;gap:10px">
                      <div class="icon-sm ${catBgClass(t.category)}">${catIcon(t.category)}</div>
                      ${t.title}
                    </div></td>
                    <td style="color:${catColor(t.category)}">${t.category}</td>
                    <td>${fmtDate(t.date)}</td>
                    <td style="color:var(--red);font-weight:600">-${fmtCurrency(t.amount)}</td>
                    <td style="color:var(--text-muted)">${t.note || '—'}</td>
                    <td>
                      <button class="act-btn edi" data-id="${t.id}">✏️</button>
                      <button class="act-btn del" data-id="${t.id}">🗑️</button>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>`}
      </div>`;

    document.getElementById('t-add').onclick  = () => openModal();
    document.getElementById('t-prev').onclick = () => { prevMonth(() => { S.catFilter=''; renderTransactions(); }); };
    document.getElementById('t-next').onclick = () => { nextMonth(() => { S.catFilter=''; renderTransactions(); }); };
    document.getElementById('t-cat-filter').onchange = function() { S.catFilter = this.value; renderTransactions(); };

    el.querySelectorAll('.act-btn.edi').forEach(b => b.onclick = async () => {
      const t = rows.find(x => x.id == b.dataset.id);
      if (t) openModal(t);
    });
    el.querySelectorAll('.act-btn.del').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this transaction?')) return;
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
      <div class="card"><div class="card-title">Monthly Spending (${S.year})</div><div class="chart-box"><canvas id="monthly-chart"></canvas></div></div>
      <div class="card"><div class="card-title">By Category</div><div class="chart-box"><canvas id="donut-chart"></canvas></div></div>
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
  } catch (e) { /* charts silently fail on no data — canvas stays blank */ }
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
            ? '<div class="empty"><div class="empty-icon">🎯</div><p>No budgets set yet</p></div>'
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
          <span class="settings-key" style="color:var(--red)">Clear all data</span>
          <button class="btn-danger" id="s-clear">Clear Data</button>
        </div>
      </div>
      <div class="settings-section">
        <h3>About</h3>
        <div class="settings-row"><span class="settings-key">App</span><span class="settings-val">ExpenseTrack — Desktop Edition</span></div>
        <div class="settings-row"><span class="settings-key">Built with</span><span class="settings-val">Electron · Flask · SQLite</span></div>
      </div>
    </div>`;

  document.getElementById('s-export').onclick = async () => {
    try {
      const rows = await GET('/transactions');
      const csv = ['Date,Title,Category,Amount,Note',
        ...rows.map(t => `${t.date},"${t.title}",${t.category},${t.amount},"${t.note||''}"`)].join('\n');
      const a = document.createElement('a');
      a.href = 'data:text/csv,' + encodeURIComponent(csv);
      a.download = `expenses_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      toast('Exported!');
    } catch { toast('Export failed', 'error'); }
  };

  document.getElementById('s-clear').onclick = () => {
    if (confirm('Delete ALL transactions and budgets? This cannot be undone.')) {
      toast('(Clear function — wire to a DELETE /api/all endpoint if needed)', 'error');
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
  return `<div class="empty"><div class="empty-icon">❌</div><p>${msg}</p></div>`;
}

// ════════════════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  // Wire up sidebar navigation
  document.querySelectorAll('.nav-item').forEach(el =>
    el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.page); }));

  // Wire up modal buttons
  document.getElementById('modal-close').onclick = closeModal;
  document.getElementById('btn-cancel').onclick  = closeModal;
  document.getElementById('btn-save').onclick    = saveModal;
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  // Allow Escape key to close modal
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Show loading screen and wait for Flask
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