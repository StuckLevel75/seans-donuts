const state = {
  apiUrl: localStorage.getItem('sd_api_url') || '',
  session: null,
  bootstrap: null,
  adminData: null,
  products: [],
  cart: {},
  paymentMethods: ['Cash', 'Invoice', 'Bank ID'],
  activeTab: 'dashboard',
  raffleEntries: [],
  raffleWheelEntries: [],
  raffleWinner: null,
  wheelRotation: 0,
  ads: [],
  payrollRows: [],
  mileageRate: 0
};

const tabs = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'pos', label: 'POS' },
  { key: 'orders', label: 'Orders' },
  { key: 'rewards', label: 'Rewards' },
  { key: 'raffle', label: 'Raffle' },
  { key: 'ads', label: 'Ads' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'settings', label: 'Settings', ownerOnly: true }
];

function $(id) {
  return document.getElementById(id);
}

function money(v) {
  return `$${Number(v || 0).toFixed(2)}`;
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value == null ? '' : String(value);
}

function setValue(id, value) {
  const el = $(id);
  if (el) el.value = value == null ? '' : String(value);
}

function getValue(id, fallback = '') {
  const el = $(id);
  return el ? el.value : fallback;
}

function showEl(id) {
  const el = $(id);
  if (el) el.classList.remove('hidden');
}

function hideEl(id) {
  const el = $(id);
  if (el) el.classList.add('hidden');
}

function showMessage(elId, text, type = 'info') {
  const el = $(elId);
  if (!el) return;
  el.textContent = text || '';
  el.className = text ? `message show ${type}` : 'message';
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

function authPayload(extra = {}) {
  return {
    email: state.session?.employee?.email || state.session?.employee?.username || '',
    pin: getValue('loginPin').trim(),
    ...extra
  };
}

async function api(action, payload = {}) {
  if (!state.apiUrl) {
    throw new Error('Missing API URL.');
  }

  const response = await fetch(state.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.json();
}

function getPerms() {
  return state.session?.permissions || {};
}

function getRole() {
  return String(state.session?.employee?.role || '').trim().toLowerCase();
}

function isStrictOwner() {
  const perms = getPerms();
  return !!(perms.isOwner || getRole() === 'owner');
}

function canManageAds() {
  const perms = getPerms();
  const role = getRole();
  return !!(
    perms.canManageAds ||
    perms.isOwner ||
    perms.isAdmin ||
    perms.isManager ||
    role === 'owner' ||
    role === 'admin' ||
    role === 'manager'
  );
}

function canViewSettings() {
  const perms = getPerms();
  const role = getRole();
  return !!(
    perms.canViewSettings ||
    perms.isOwner ||
    perms.isAdmin ||
    role === 'owner' ||
    role === 'admin'
  );
}

function getVisibleTabs() {
  if (!state.session) return [];
  return tabs.filter(tab => {
    if (tab.key === 'ads') return canManageAds();
    if (tab.ownerOnly) return canViewSettings();
    return true;
  });
}

function renderNav() {
  const nav = $('navTabs');
  if (!nav) return;

  const visibleTabs = getVisibleTabs();

  if (!visibleTabs.some(tab => tab.key === state.activeTab)) {
    state.activeTab = visibleTabs[0]?.key || 'dashboard';
  }

  nav.innerHTML = visibleTabs.map(tab => `
    <button
      type="button"
      class="nav-btn ${state.activeTab === tab.key ? 'active' : ''}"
      data-tab="${escapeHtml(tab.key)}"
    >
      ${escapeHtml(tab.label)}
    </button>
  `).join('');

  nav.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });
}

async function activateTab(tabKey) {
  state.activeTab = tabKey;

  const sectionMap = {
    dashboard: 'dashboardSection',
    pos: 'posSection',
    orders: 'ordersSection',
    rewards: 'rewardsSection',
    raffle: 'raffleSection',
    ads: 'adsSection',
    payroll: 'payrollSection',
    settings: 'settingsSection'
  };

  Object.values(sectionMap).forEach(id => {
    const el = $(id);
    if (el) el.classList.add('hidden');
  });

  const activeSection = $(sectionMap[tabKey]);
  if (activeSection) activeSection.classList.remove('hidden');

  renderNav();

  if (tabKey === 'orders') await loadOrders();
  if (tabKey === 'raffle') await loadRaffle();
  if (tabKey === 'ads') await loadAds();
  if (tabKey === 'payroll') await loadPayroll();
  if (tabKey === 'settings') await loadAdminData();
}

function fillPortalHeader() {
  const settings = state.bootstrap?.settings || {};
  const ui = state.bootstrap?.uiText || settings.uiText || {};
  const theme = state.bootstrap?.theme || settings.theme || {};
  const employee = state.session?.employee || {};
  const prefs = state.session?.portalPrefs || {};

  const portalName = settings.portalName || "Sean's Donuts";
  const portalSubtitle = settings.portalSubtitle || 'Employee Portal';
  const announcement = prefs.announcement || settings.announcement || settings.dashboardMessage || 'Welcome to Sean\'s Donuts Portal';
  const bankId = prefs.bankId || settings.bankId || '24596194';
  const logoEmoji = ui.logoEmoji || settings.logoEmoji || '🍩';
  const employeeName = employee.name || 'User';

  state.mileageRate = Number(settings.mileageRate || 0);

  setText('portalName', portalName);
  setText('portalSubtitle', portalSubtitle);
  setText('announcementBar', announcement);
  setText('bankIdText', bankId);
  setText('dashboardPortalName', portalName);
  setText('dashboardPortalSubtitle', portalSubtitle);
  setText('dashboardBankId', bankId);

  setText('sessionStatus', 'Signed in');
  setText('sessionRole', employee.role || 'Employee');
  setText('userBadge', `👋 Hello, ${employeeName}`);

  setText('welcomeTitle', ui.dashboardTitle || `Welcome, ${employeeName}`);
  setText('dashboardSubtitleText', ui.dashboardSubtitle || 'Portal overview');
  setText('posTitleText', ui.posTitle || 'POS');
  setText('posSubtitleText', ui.posSubtitle || 'Create a new order');
  setText('ordersTitleText', ui.ordersTitle || 'Orders');
  setText('ordersSubtitleText', ui.ordersSubtitle || 'Search recent orders');
  setText('rewardsTitleText', ui.rewardsTitle || 'Rewards');
  setText('rewardsSubtitleText', ui.rewardsSubtitle
