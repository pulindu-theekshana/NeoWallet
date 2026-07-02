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

// Debounce — delays calling fn until ms milliseconds after last call
function debounce(fn, ms) {
  let timer;
  const debounced = function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
  debounced.cancel = () => clearTimeout(timer); // allows cancelling a pending call
  return debounced;
}

// ── Custom Dropdown ──────────────────────────────────────
function buildDropdown(id, options, selectedValue) {
  const sel = options.find(o => String(o.value) === String(selectedValue));
  return `
    <div class="cdd" id="${id}" data-value="${esc(String(selectedValue ?? ''))}">
      <div class="cdd-trigger">
        <span class="cdd-label">${esc(sel ? sel.label : (options[0]?.label || ''))}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      <div class="cdd-menu">
        ${options.map(o => `
          <div class="cdd-item ${String(o.value) === String(selectedValue) ? 'sel' : ''}"
               data-value="${esc(String(o.value))}">${esc(o.label)}</div>
        `).join('')}
      </div>
    </div>`;
}

function setupDropdowns() {
  document.querySelectorAll('.cdd:not([data-wired])').forEach(dd => {
    dd.dataset.wired = '1';
    const trigger = dd.querySelector('.cdd-trigger');
    const menu    = dd.querySelector('.cdd-menu');
    const label   = dd.querySelector('.cdd-label');

    trigger.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = menu.classList.contains('open');
      document.querySelectorAll('.cdd-menu.open').forEach(m => m.classList.remove('open'));
      document.querySelectorAll('.cdd-trigger.open').forEach(t => t.classList.remove('open'));
      if (!isOpen) { menu.classList.add('open'); trigger.classList.add('open'); }
    });

    dd.querySelectorAll('.cdd-item').forEach(item => {
      item.addEventListener('click', e => {
        e.stopPropagation();
        const value = item.dataset.value;
        label.textContent = item.textContent.trim();
        dd.dataset.value  = value;
        menu.classList.remove('open');
        trigger.classList.remove('open');
        dd.querySelectorAll('.cdd-item').forEach(i => i.classList.remove('sel'));
        item.classList.add('sel');
        dd.dispatchEvent(new CustomEvent('change', { detail: { value } }));
      });
    });
  });

  if (!document._cddClickWired) {
    document._cddClickWired = true;
    document.addEventListener('click', () => {
      document.querySelectorAll('.cdd-menu.open').forEach(m => m.classList.remove('open'));
      document.querySelectorAll('.cdd-trigger.open').forEach(t => t.classList.remove('open'));
    });
  }
}

function getDropdownValue(id) {
  const el = document.getElementById(id);
  return el ? el.dataset.value : '';
}

function setDropdownValue(id, value) {
  const dd = document.getElementById(id);
  if (!dd) return;
  const items = dd.querySelectorAll('.cdd-item');
  items.forEach(i => i.classList.remove('sel'));
  const item = Array.from(items).find(i => i.dataset.value === String(value));
  if (!item) return;
  dd.querySelector('.cdd-label').textContent = item.textContent.trim();
  dd.dataset.value = String(value);
  item.classList.add('sel');
}

// ── Custom Date Picker ───────────────────────────────────
function dpFormat(val) {
  if (!val) return 'Select date';
  const [y, m, d] = val.split('-');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1]} ${+d}, ${y}`;
}

function setDatePickerValue(id, value) {
  const hidden  = document.getElementById(id);
  const display = document.getElementById(`dp-display-${id}`);
  if (hidden)  hidden.value        = value || '';
  if (display) display.textContent = dpFormat(value);
}

function getDatePickerValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setupDatePickers() {
  document.querySelectorAll('.datepicker:not([data-wired])').forEach(dp => {
    dp.dataset.wired = '1';
    const trigger = dp.querySelector('.dp-trigger');
    const dpId    = dp.id.replace('dp-', '');
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      if (document.getElementById('dp-popup')) { closeDPPopup(); }
      else { openDPPopup(dpId, trigger); }
    });
  });
}

function openDPPopup(inputId, trigger) {
  closeDPPopup();
  const val = document.getElementById(inputId)?.value || '';
  let vy, vm;
  if (val) { const [y,m] = val.split('-'); vy=+y; vm=+m-1; }
  else     { vy = new Date().getFullYear(); vm = new Date().getMonth(); }

  const popup = document.createElement('div');
  popup.className = 'dp-popup';
  popup.id        = 'dp-popup';
  document.body.appendChild(popup);

  const rect     = trigger.getBoundingClientRect();
  const popupW   = 330;
  const popupH   = 340;

  // Try positioning to the right of the trigger first
  let left = rect.right + 10;
  let top  = rect.top;

  // If it would go off the right edge, flip to left side
  if (left + popupW > window.innerWidth - 10) {
    left = rect.left - popupW - 10;
  }

  // Keep within vertical bounds — push up if it clips the bottom
  if (top + popupH > window.innerHeight - 10) {
    top = window.innerHeight - popupH - 10;
  }
  if (top < 10) top = 10;

  popup.style.top  = top  + 'px';
  popup.style.left = Math.max(10, left) + 'px';

  trigger.classList.add('open');
  renderDPCalendar(popup, inputId, vy, vm, val);
  setTimeout(() => document.addEventListener('click', dpOutsideClick), 0);
}

function dpOutsideClick(e) {
  const p = document.getElementById('dp-popup');
  if (p && !p.contains(e.target)) closeDPPopup();
}

function closeDPPopup() {
  const p = document.getElementById('dp-popup');
  if (p) p.remove();
  document.querySelectorAll('.dp-trigger.open').forEach(t => t.classList.remove('open'));
  document.removeEventListener('click', dpOutsideClick);
}

function renderDPCalendar(popup, inputId, year, month, selectedVal) {
  const MN = ['January','February','March','April','May','June',
               'July','August','September','October','November','December'];
  const WD  = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const today   = new Date();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInM  = new Date(year, month+1, 0).getDate();
  const daysInP  = new Date(year, month, 0).getDate();

  let cells = '';
  for (let i = firstDow-1; i >= 0; i--)
    cells += `<div class="dp-cell dp-dim">${daysInP-i}</div>`;

  for (let d = 1; d <= daysInM; d++) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isT = today.getFullYear()===year && today.getMonth()===month && today.getDate()===d;
    const isS = ds === selectedVal;
    cells += `<div class="dp-cell ${isT?'dp-today':''} ${isS?'dp-sel':''}" data-ds="${ds}">${d}</div>`;
  }

  const total = Math.ceil((firstDow + daysInM) / 7) * 7;
  for (let i = 1; i <= total - firstDow - daysInM; i++)
    cells += `<div class="dp-cell dp-dim">${i}</div>`;

  popup.innerHTML = `
    <div class="dp-head">
      <button class="dp-nav-btn" id="dp-pv">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="dp-month-lbl">${MN[month]} ${year}</div>
      <button class="dp-nav-btn" id="dp-nx">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>
    <div class="dp-wdays">${WD.map(d=>`<div class="dp-wd">${d}</div>`).join('')}</div>
    <div class="dp-grid">${cells}</div>`;

  popup.querySelector('#dp-pv').addEventListener('click', e => {
    e.stopPropagation();
    let m=month-1, y=year; if(m<0){m=11;y--;} renderDPCalendar(popup,inputId,y,m,selectedVal);
  });
  popup.querySelector('#dp-nx').addEventListener('click', e => {
    e.stopPropagation();
    let m=month+1, y=year; if(m>11){m=0;y++;} renderDPCalendar(popup,inputId,y,m,selectedVal);
  });
  popup.querySelectorAll('.dp-cell[data-ds]').forEach(cell => {
    cell.addEventListener('click', e => {
      e.stopPropagation();
      setDatePickerValue(inputId, cell.dataset.ds);
      closeDPPopup();
    });
  });
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
        <div class="cat-name"><div class="cat-dot" style="background:${col}"></div>${esc(c.category)}</div>
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
        ${buildDropdown('cdd-t-cat-filter', [
          {value:'', label:'All Categories'},
          ...['Groceries','Utilities','Transport','Dining','Shopping','Healthcare',
              'Entertainment','Education','Sports','Other'].map(c=>({value:c,label:c}))
        ], S.catFilter)}
        <input
          class="filter-select"
          id="t-search"
          type="text"
          placeholder="Search title or note..."
          value="${esc(S.search)}"
          style="min-width:200px; background:var(--bg-surface);">
        <button class="filter-select" id="t-clear-filters"
          style="color:var(--text-muted);${(!S.catFilter && !S.search) ? 'opacity:0.4;cursor:default' : ''}">
          &#x2715; Clear
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

    setupDropdowns();

    document.getElementById('t-add').onclick  = () => openModal();
    document.getElementById('t-prev').onclick = () => { prevMonth(() => { S.catFilter=''; S.search=''; renderTransactions(); }); };
    document.getElementById('t-next').onclick = () => { nextMonth(() => { S.catFilter=''; S.search=''; renderTransactions(); }); };

    document.getElementById('cdd-t-cat-filter').addEventListener('change', e => {
      S.catFilter = e.detail.value;
      renderTransactions();
    });

    const debouncedSearch = debounce(async function(value) {
      S.search = value;
      await renderTransactions();
      const input = document.getElementById('t-search');
      if (input) {
        input.value = value;
        input.focus();
        input.setSelectionRange(value.length, value.length);
      }
    }, 300);

    document.getElementById('t-search').addEventListener('input', function() {
      debouncedSearch(this.value);
    });

    document.getElementById('t-clear-filters').onclick = () => {
      debouncedSearch.cancel(); // cancel any pending search before clearing
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

el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Reports</h1>
      ${buildDropdown('cdd-r-year',
        [0,1,2].map(i=>{ const y=new Date().getFullYear()-i; return {value:String(y),label:String(y)}; }),
        String(S.year))}
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

  setupDropdowns();
  document.getElementById('cdd-r-year').addEventListener('change', e => { S.year = +e.detail.value; renderReports(); });

  try {
    const d = await GET('/reports?year=' + S.year);
    const chartDefaults = { color: '#94a3b8', grid: 'rgba(255,255,255,0.05)' };

    // Bar chart — monthly spending
    S.charts.monthly = new Chart(document.getElementById('monthly-chart'), {
      type: 'bar',
      data: {
        labels: d.monthly_spending.map(r => MONTHS[+r.month-1].slice(0,3)),
        datasets: [{ label: 'LKR', data: d.monthly_spending.map(r => r.total),
          backgroundColor: '#0060e0', borderRadius: 6 }]
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
          backgroundColor: '#0060e0',
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
     
    el.innerHTML = `
      <div class="page-header"><h1 class="page-title">Budgets</h1></div>
      <div class="budgets-layout">
        <div class="card">
          <div class="card-title">Set Monthly Budget</div>
          <div class="budget-form">
            <div class="form-group"><label>Month</label>
              ${buildDropdown('cdd-b-month', MONTHS.map((m,i)=>({value:String(i+1),label:m})), String(S.month))}
            </div>
            <div class="form-group"><label>Year</label>
              ${buildDropdown('cdd-b-year',
                [1,0,-1].map(i=>{const y=new Date().getFullYear()+i;return{value:String(y),label:String(y)};}),
                String(S.year))}
            </div>
            <div class="form-group">
              <label>Budget Amount (LKR)</label>
              <div class="num-wrap">
                <input type="number" id="b-amount" placeholder="e.g. 60000" value="${cur ? cur.amount : ''}">
                <div class="num-btns">
                  <button class="num-btn" onclick="adjNum('b-amount', 5000)" type="button">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                  </button>
                  <button class="num-btn" onclick="adjNum('b-amount', -5000)" type="button">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                </div>
              </div>
            </div>
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


    setupDropdowns();

    const refill = async () => {
      const m = +getDropdownValue('cdd-b-month');
      const y = +getDropdownValue('cdd-b-year');
      const buds = await GET('/budgets');
      const found = buds.find(b => +b.month === m && +b.year === y);
      document.getElementById('b-amount').value = found ? found.amount : '';
    };

    document.getElementById('cdd-b-month').addEventListener('change', refill);
    document.getElementById('cdd-b-year').addEventListener('change',  refill);

    document.getElementById('b-save').onclick = async () => {
      const month  = String(getDropdownValue('cdd-b-month')).padStart(2,'0');
      const year   = +getDropdownValue('cdd-b-year');
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
          <span class="settings-key">Export transactions to CSV</span>
          <button class="btn-primary" id="s-export">Export CSV</button>
        </div>
        <div class="settings-row">
          <span class="settings-key">Import transactions from CSV</span>
          <button class="btn-primary" id="s-import" style="background:var(--bg-elevated);border:1px solid var(--border)">Import CSV</button>
        </div>
        <input type="file" id="s-import-file" accept=".csv" style="display:none">
        <div class="settings-row">
          <span class="settings-key">
            Full backup
            <span style="font-size:11px;color:var(--text-muted);display:block;margin-top:2px">Includes transactions AND budgets</span>
          </span>
          <button class="btn-primary" id="s-backup" style="background:var(--bg-elevated);border:1px solid var(--accent)">Backup All</button>
        </div>
        <div class="settings-row">
          <span class="settings-key">
            Restore full backup
            <span style="font-size:11px;color:var(--text-muted);display:block;margin-top:2px">Replaces ALL current data</span>
          </span>
          <button class="btn-primary" id="s-restore" style="background:var(--bg-elevated);border:1px solid var(--border)">Restore Backup</button>
        </div>
        <input type="file" id="s-restore-file" accept=".json" style="display:none">
        <div class="settings-row">
          <span class="settings-key" style="color:var(--red)">Clear all data</span>
          <button class="btn-danger" id="s-clear">Clear Data</button>
        </div>
      </div>
      <div class="settings-section">
        <h3>About</h3>
        <div class="settings-row"><span class="settings-key">App</span><span class="settings-val">NeoWallet - Desktop Edition</span></div>
        <div class="settings-row"><span class="settings-key">Built with</span><span class="settings-val">Electron / Flask / SQLite</span></div>
      </div>
    </div>`;

  document.getElementById('s-export').onclick = async () => {
    try {
      const rows = await GET('/transactions');

      const csvField = v => {
        const s = String(v ?? '').replace(/[\r\n]+/g, ' ');
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

      const filename = `expenses_${new Date().toISOString().slice(0,10)}.csv`;
      const result   = await window.electronAPI.saveCSV(filename, csv);

      if (result.saved) {
        toast('CSV exported successfully!');
      }
      // If user cancelled the save dialog — show nothing

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
      const amount = Number(clean[3]);
      if (!Number.isFinite(amount) || amount <= 0) continue; // skip rows with invalid amounts
      rows.push({
        date:     clean[0],
        title:    clean[1],
        category: clean[2],
        amount:   amount,
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

// ── Full backup (transactions + budgets) ──
  document.getElementById('s-backup').onclick = async () => {
    try {
      const data     = await GET('/backup');
      const content  = JSON.stringify(data, null, 2);
      const filename = `neowallet_backup_${new Date().toISOString().slice(0,10)}.json`;
      const result   = await window.electronAPI.saveJSON(filename, content);
      if (result.saved) toast('Full backup saved!');
    } catch { toast('Backup failed', 'error'); }
  };

  // ── Restore full backup ──
  document.getElementById('s-restore').onclick = () => {
    document.getElementById('s-restore-file').click();
  };

  document.getElementById('s-restore-file').onchange = async function () {
    const file = this.files[0];
    if (!file) return;

    const yes = await customConfirm(
      'Restore backup?',
      'This will replace ALL current transactions and budgets with the backup data.',
      'Restore'
    );
    if (!yes) { this.value = ''; return; }

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await POST('/restore', data);
      toast(`Restored ${result.transactions_restored} transactions and ${result.budgets_restored} budgets!`);
      this.value = '';
      navigate('dashboard');
    } catch {
      toast('Restore failed — invalid backup file', 'error');
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
  setDropdownValue('cdd-trans-category', t?.category || 'Groceries');
  setDatePickerValue('trans-date', t?.date || new Date().toISOString().slice(0,10));
  document.getElementById('trans-note').value     = t?.note   || '';
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('trans-title').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  closeDPPopup();
  S.editId = null;
}

async function saveModal() {
  const title    = document.getElementById('trans-title').value.trim();
  const amount   = parseFloat(document.getElementById('trans-amount').value);
  const category = getDropdownValue('cdd-trans-category');
  const date     = getDatePickerValue('trans-date');
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

// Adjusts a number input by step — used by custom spinners
function adjNum(id, step) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = parseFloat(el.value) || 0;
  el.value = Math.max(0, current + step);
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
  setupDropdowns();
  setupDatePickers();
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

  // Complete the loading bar before hiding
  const bar = document.getElementById('loading-bar');
  if (bar) { bar.style.animation = 'none'; bar.style.width = '100%'; }
  await new Promise(r => setTimeout(r, 500));
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