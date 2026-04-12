const state = {
  apiUrl: localStorage.getItem('sd_api_url') || '',
  session: null,
  bootstrap: null,
  adminData: null,
  products: [],
  cart: {},
  activeTab: 'dashboard'
};

function $(id) {
  return document.getElementById(id);
}

function setText(id, v) {
  if ($(id)) $(id).textContent = v || '';
}

function setValue(id, v) {
  if ($(id)) $(id).value = v || '';
}

function getValue(id) {
  return $(id)?.value || '';
}

function money(v) {
  return `$${Number(v || 0).toFixed(2)}`;
}

function showEl(id) {
  const el = $(id);
  if (el) el.classList.remove('hidden');
}

function hideEl(id) {
  const el = $(id);
  if (el) el.classList.add('hidden');
}

function showLoading(title = 'LOADING', text = 'Please wait...') {
  const overlay = $('loadingOverlay');
  if (!overlay) return;
  setText('loadingTitle', title);
  setText('loadingText', text);
  overlay.classList.remove('hidden');
}

function hideLoading() {
  const overlay = $('loadingOverlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
}

async function api(action, payload = {}) {
  const res = await fetch(state.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, payload })
  });
  return res.json();
}

const tabs = [
  'dashboard',
  'pos',
  'orders',
  'rewards',
  'raffle',
  'ads',
  'payroll',
  'settings'
];

function renderNav() {
  const nav = $('navTabs');
  if (!nav) return;

  nav.innerHTML = tabs.map(t => `
    <button class="nav-btn ${state.activeTab === t ? 'active' : ''}" data-tab="${t}">
      ${t.toUpperCase()}
    </button>
  `).join('');

  nav.querySelectorAll('[data-tab]').forEach(btn => {
    btn.onclick = () => activateTab(btn.dataset.tab);
  });
}

async function activateTab(tab) {
  state.activeTab = tab;

  document.querySelectorAll('.page-panel').forEach(p => p.classList.add('hidden'));
  $(`${tab}Section`)?.classList.remove('hidden');

  renderNav();

  if (tab === 'orders') await loadOrders();
  if (tab === 'rewards') renderRewardsBlank();
  if (tab === 'settings') await loadAdminData();
}

function fillHeader() {
  const employee = state.session?.employee || {};
  const settings = state.bootstrap?.settings || {};

  setText('userBadge', `👋 Hello, ${employee.name || 'User'}`);
  setText('sessionRole', employee.role || 'Employee');
  setText('sessionStatus', 'Signed in');
  setText('bankIdText', settings.bankId || '24596194');
  setText('portalName', settings.portalName || "Sean's Donuts");
  setText('portalSubtitle', settings.portalSubtitle || 'Employee Portal');
  setText('announcementBar', settings.announcement || "Welcome to Sean's Donuts Portal");
}

async function loginNow() {
  try {
    showLoading('LOGGING IN', 'Checking your portal access...');

    const loginValue = getValue('loginValue');
    const pin = getValue('loginPin');

    const res = await api('login', { loginValue, pin });
    if (!res.ok) {
      hideLoading();
      alert(res.message);
      return;
    }

    state.session = res;

    const boot = await api('getPortalBootstrap', {});
    state.bootstrap = boot;
    state.products = boot.products || [];

    fillHeader();
    renderNav();
    await activateTab('dashboard');

    hideEl('loginView');
    showEl('portalView');
    showEl('logoutBtn');

    hideLoading();
  } catch (err) {
    hideLoading();
    alert(err.message || 'Login failed.');
  }
}

function logoutNow() {
  state.session = null;
  state.bootstrap = null;
  state.adminData = null;
  state.products = [];
  state.cart = {};
  state.activeTab = 'dashboard';

  showEl('loginView');
  hideEl('portalView');
  hideEl('logoutBtn');

  setText('sessionStatus', 'Signed out');
  setText('sessionRole', '—');
  setText('userBadge', '👋 Hello, User');
}

async function loadOrders() {
  const res = await api('searchOrders', { query: getValue('orderSearchInput') });
  const rows = res.results || [];

  $('ordersList').innerHTML = rows.map(r => `
    <details class="settings-popout">
      <summary>${r['Order Number']} — ${r['Customer Name'] || 'No Name'}</summary>
      <div class="settings-popout-body">
        <p><b>Employee:</b> ${r['Employee Name'] || ''}</p>
        <p><b>Discord:</b> ${r['Customer Discord'] || ''}</p>
        <p><b>Phone:</b> ${r['Phone Number'] || ''}</p>
        <p><b>Payment:</b> ${r['Payment Method'] || ''}</p>
        <p><b>Subtotal:</b> ${money(r['Subtotal'])}</p>
        <p><b>Discount:</b> ${money(r['Discount'])}</p>
        <p><b>Tip:</b> ${money(r['Tip'])}</p>
        <p><b>Mileage:</b> ${money(r['Mileage'])}</p>
        <p><b>Total:</b> ${money(r['Total'])}</p>
        <p><b>Notes:</b> ${r['Notes'] || ''}</p>
      </div>
    </details>
  `).join('') || '<div class="list-item"><p>No orders loaded.</p></div>';
}

function renderRewardsBlank() {
  $('rewardsResultCard').innerHTML = `
    <div class="list-item"><p>Search a customer to view rewards.</p></div>
  `;
}

async function loadRewards() {
  const customerName = getValue('rewardCustomerName');
  const res = await api('lookupRewards', { customerName });
  const r = res.reward || {};

  $('rewardsResultCard').innerHTML = `
    <details class="settings-popout" open>
      <summary>${customerName || 'Customer Rewards'}</summary>
      <div class="settings-popout-body">
        <p><b>Visits:</b> ${r.visits || 0}</p>
        <p><b>Progress:</b> ${r.visitProgress || 0}/10</p>
        <p><b>Available:</b> ${r.rewardsAvailable || 0}</p>
        <p><b>Redeemed:</b> ${r.totalRewardsRedeemed || 0}</p>
        <p><b>Last Visit:</b> ${r.lastVisit || '—'}</p>
        <p><b>Last Order:</b> ${r.lastOrderNumber || '—'}</p>
      </div>
    </details>
  `;
}

async function loadAdminData() {
  const res = await api('getAdminData', {});
  state.adminData = res;

  const s = res.settings || {};

  setValue('settingsPortalName', s.portalName || '');
  setValue('settingsPortalSubtitle', s.portalSubtitle || '');
  setValue('settingsAnnouncement', s.announcement || '');
  setValue('settingsBankId', s.bankId || '');

  setValue('raffleEnabledSetting', s.raffleEnabled || 'Yes');
  setValue('raffleMaxOverallSetting', s.raffleMaxOverall || 0);
  setValue('raffleMaxPerPersonSetting', s.raffleMaxPerPerson || 0);
  setValue('raffleStartDateSetting', s.raffleStart || '');
  setValue('raffleEndDateSetting', s.raffleEnd || '');
}

async function saveRaffleSettings() {
  showLoading('SAVING', 'Saving raffle controls...');

  const res = await api('saveRaffleSettings', {
    enabled: getValue('raffleEnabledSetting'),
    maxOverall: getValue('raffleMaxOverallSetting'),
    maxPer: getValue('raffleMaxPerPersonSetting'),
    start: getValue('raffleStartDateSetting'),
    end: getValue('raffleEndDateSetting')
  });

  hideLoading();
  alert(res.message);
}

function init() {
  $('loginBtn')?.addEventListener('click', loginNow);
  $('logoutBtn')?.addEventListener('click', logoutNow);
  $('searchOrdersBtn')?.addEventListener('click', loadOrders);
  $('lookupRewardsBtn')?.addEventListener('click', loadRewards);
  $('saveRaffleSettingsBtn')?.addEventListener('click', saveRaffleSettings);
}

init();
