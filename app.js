const state = {
  apiUrl: localStorage.getItem('sd_api_url') || '',
  session: null,
  bootstrap: null,
  adminData: null,
  products: [],
  cart: {},
  paymentMethods: ['Cash', 'Invoice', 'Bank ID'],
  activeTab: 'dashboard'
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

function canViewSettings() {
  const perms = getPerms();
  return !!(
    perms.canViewSettings ||
    perms.isOwner ||
    perms.isAdmin ||
    getRole() === 'owner' ||
    getRole() === 'admin'
  );
}

function getVisibleTabs() {
  return tabs.filter(tab => {
    if (!tab.ownerOnly) return true;
    return canViewSettings();
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
    btn.addEventListener('click', () => openTab(btn.dataset.tab));
  });
}

function openTab(tab) {
  state.activeTab = tab;

  document.querySelectorAll('.page-panel').forEach(p => p.classList.add('hidden'));
  $(`${tab}Section`)?.classList.remove('hidden');

  renderNav();

  if (tab === 'settings') {
    loadAdminData();
  }
}

function fillHeader() {
  const emp = state.session?.employee || {};
  const settings = state.bootstrap?.settings || {};
  const ui = state.bootstrap?.uiText || {};
  const theme = state.bootstrap?.theme || {};
  const prefs = state.session?.portalPrefs || {};

  const portalName = settings.portalName || "Sean's Donuts";
  const portalSubtitle = settings.portalSubtitle || 'Employee Portal';
  const bankId = prefs.bankId || settings.bankId || '24596194';
  const announcement = prefs.announcement || settings.announcement || settings.dashboardMessage || "Welcome to Sean's Donuts Portal";
  const logoEmoji = ui.logoEmoji || '🍩';

  setText('portalName', portalName);
  setText('portalSubtitle', portalSubtitle);
  setText('announcementBar', announcement);
  setText('bankIdText', bankId);
  setText('sessionRole', emp.role || '');
  setText('sessionStatus', state.session ? 'Signed in' : 'Signed out');
  setText('userBadge', `👋 Hello, ${emp.name || 'User'}`);

  setText('dashboardPortalName', portalName);
  setText('dashboardPortalSubtitle', portalSubtitle);
  setText('dashboardBankId', bankId);

  setText('loginLogo', logoEmoji);
  setText('brandLogo', logoEmoji);

  setText('loginTitle', ui.loginTitle || portalName);
  setText('loginSubtitle', ui.loginSubtitle || 'Sign in with your username or email and PIN.');

  setText('welcomeTitle', ui.dashboardTitle || `Welcome, ${emp.name || 'Employee'}`);
  setText('dashboardSubtitleText', ui.dashboardSubtitle || 'Portal overview');
  setText('posTitleText', ui.posTitle || 'POS');
  setText('posSubtitleText', ui.posSubtitle || 'Create a new order');
  setText('ordersTitleText', ui.ordersTitle || 'Orders');
  setText('ordersSubtitleText', ui.ordersSubtitle || 'Search recent orders');
  setText('rewardsTitleText', ui.rewardsTitle || 'Rewards');
  setText('rewardsSubtitleText', ui.rewardsSubtitle || 'Lookup customer rewards');
  setText('raffleTitleText', ui.raffleTitle || 'Raffle');
  setText('raffleSubtitleText', ui.raffleSubtitle || 'Recent raffle entries');
  setText('payrollTitleText', ui.payrollTitle || 'Payroll');
  setText('payrollSubtitleText', ui.payrollSubtitle || 'View payroll rows');
  setText('settingsTitleText', ui.settingsTitle || 'Settings');
  setText('settingsSubtitleText', ui.settingsSubtitle || 'Owner/Admin controls');

  setValue('settingsPortalName', portalName);
  setValue('settingsPortalSubtitle', portalSubtitle);
  setValue('settingsAnnouncement', announcement);
  setValue('settingsBankId', bankId);

  applyTheme(theme);
}

function applyTheme(theme = {}) {
  const root = document.documentElement;
  if (!root) return;

  if (theme.primary) root.style.setProperty('--primary', theme.primary);
  if (theme.primaryDark) root.style.setProperty('--primary-dark', theme.primaryDark);
  if (theme.secondary) root.style.setProperty('--secondary', theme.secondary);
  if (theme.bg) root.style.setProperty('--bg', theme.bg);
  if (theme.card) root.style.setProperty('--card', theme.card);
  if (theme.text) root.style.setProperty('--text', theme.text);
  if (theme.muted) root.style.setProperty('--muted', theme.muted);
  if (theme.border) root.style.setProperty('--border', theme.border);
}

function renderBootstrap() {
  const stats = state.bootstrap?.stats || {};
  const announcements = state.bootstrap?.announcements || [];
  const settings = state.bootstrap?.settings || {};

  setText('statOrders', Number(stats.totalOrders || 0));
  setText('statSales', money(stats.totalSales || 0));
  setText('statEmployees', Number(stats.activeEmployees || 0));
  setText('statRaffle', Number(stats.raffleEntries || 0));

  const list = $('announcementsList');
  if (list) {
    list.innerHTML = announcements.length
      ? announcements.map(item => `
          <div class="list-item">
            <h4>${escapeHtml(item.title || 'Announcement')}</h4>
            <p>${escapeHtml(item.message || '')}</p>
          </div>
        `).join('')
      : '<div class="list-item"><p>No active announcements.</p></div>';
  }

  const methods = Array.isArray(settings.paymentMethods) && settings.paymentMethods.length
    ? settings.paymentMethods
    : ['Cash', 'Invoice', 'Bank ID'];

  state.paymentMethods = methods;

  const paymentMethod = $('paymentMethod');
  if (paymentMethod) {
    paymentMethod.innerHTML = methods.map(method => `
      <option value="${escapeHtml(method)}">${escapeHtml(method)}</option>
    `).join('');
  }
}

function buildProducts() {
  const grid = $('productGrid');
  if (!grid) return;

  if (!Array.isArray(state.products) || !state.products.length) {
    grid.innerHTML = '<div class="list-item"><p>No products yet.</p></div>';
    return;
  }

  grid.innerHTML = state.products.map((p, i) => {
    const name = p.Name || p.name || 'Product';
    const price = Number(p.Price || p.price || 0);
    const qty = state.cart[name] || 0;

    return `
      <div class="product-card">
        <h4>${escapeHtml(name)}</h4>
        <div class="product-price">${money(price)}</div>
        <div class="qty-row">
          <button type="button" data-action="remove" data-index="${i}">-</button>
          <span class="qty-pill">${qty}</span>
          <button type="button" data-action="add" data-index="${i}">+</button>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('[data-action="add"]').forEach(btn => {
    btn.addEventListener('click', () => addToCart(Number(btn.dataset.index)));
  });

  grid.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(Number(btn.dataset.index)));
  });
}

function addToCart(i) {
  const p = state.products[i];
  if (!p) return;
  const name = p.Name || p.name;
  state.cart[name] = (state.cart[name] || 0) + 1;
  buildProducts();
  renderCart();
}

function removeFromCart(i) {
  const p = state.products[i];
  if (!p) return;
  const name = p.Name || p.name;

  if (state.cart[name]) {
    state.cart[name]--;
    if (state.cart[name] <= 0) delete state.cart[name];
  }

  buildProducts();
  renderCart();
}

function renderCart() {
  const list = $('cartList');
  if (!list) return;

  const items = Object.entries(state.cart);

  if (!items.length) {
    list.innerHTML = '<div class="list-item"><p>Empty cart</p></div>';
    setText('subtotalText', '$0.00');
    return;
  }

  list.innerHTML = items.map(([n, q]) => {
    const p = state.products.find(x => (x.Name || x.name) === n) || {};
    const price = Number(p.Price || p.price || 0);
    return `<div class="list-item"><p>${escapeHtml(n)} x${q} = ${money(q * price)}</p></div>`;
  }).join('');

  let subtotal = 0;
  items.forEach(([n, q]) => {
    const p = state.products.find(x => (x.Name || x.name) === n) || {};
    subtotal += q * Number(p.Price || p.price || 0);
  });

  const mileage = Number(getValue('mileageInput') || 0);
  const amountPaid = Number(getValue('amountPaidInput') || 0);
  const discount = Number(getValue('discountInput') || 0);
  const tip = Number(getValue('tipInput') || 0);
  const total = Math.max(0, subtotal + mileage - discount + tip);

  setText('subtotalText', money(subtotal));
  setText('mileageText', money(mileage));
  setText('discountText', money(discount));
  setText('tipText', money(tip));
  setText('amountPaidText', money(amountPaid));
  setText('totalText', money(total));
}

function hasRaffleTicket() {
  return Object.keys(state.cart).some(n => n.toLowerCase().includes('raffle'));
}

async function submitOrder() {
  try {
    const items = Object.entries(state.cart).map(([name, qty]) => ({ name, qty }));
    if (!items.length) {
      alert('Add at least one item.');
      return;
    }

    const customerName = getValue('customerName').trim();
    const customerDiscord = getValue('customerDiscord').trim();
    const phoneNumber = getValue('phoneNumber').trim();

    if (hasRaffleTicket() && (!customerName || !customerDiscord || !phoneNumber)) {
      alert('Customer Name, Discord, and Phone are required for raffle tickets.');
      return;
    }

    const res = await api('submitOrder', {
      email: state.session?.employee?.email || '',
      pin: getValue('loginPin'),
      items,
      customerName,
      customerDiscord,
      phoneNumber,
      mileage: Number(getValue('mileageInput') || 0),
      amountPaid: Number(getValue('amountPaidInput') || 0),
      discount: Number(getValue('discountInput') || 0),
      tip: Number(getValue('tipInput') || 0),
      paymentMethod: getValue('paymentMethod'),
      notes: getValue('notes')
    });

    if (!res.ok) {
      alert(res.message || 'Order failed.');
      return;
    }

    alert(res.message || 'Order submitted.');
    state.cart = {};
    buildProducts();
    renderCart();
  } catch (e) {
    alert(e.message || 'Order failed.');
  }
}

// ================= PAYMENT METHODS SETTINGS =================

function getAdminPaymentMethods() {
  if (!state.adminData) state.adminData = {};
  if (!Array.isArray(state.adminData.paymentMethods)) {
    state.adminData.paymentMethods = [];
  }
  return state.adminData.paymentMethods;
}

function renderPaymentMethodsAdmin() {
  const wrap = $('paymentMethodsAdminList');
  if (!wrap) return;

  const methods = getAdminPaymentMethods();

  if (!methods.length) {
    wrap.innerHTML = '<div class="list-item"><p>No payment methods yet.</p></div>';
    return;
  }

  wrap.innerHTML = methods.map((item, index) => `
    <div class="settings-entry-card">
      <div class="settings-entry-main">
        <div class="settings-entry-title">${escapeHtml(item.Name || item.name || 'Unnamed Method')}</div>
        <div class="settings-entry-sub">${escapeHtml(item.Active || item.active || 'Yes')}</div>
      </div>
      <button type="button" class="btn btn-secondary" data-open-payment="${index}">Update</button>
    </div>
  `).join('');

  wrap.querySelectorAll('[data-open-payment]').forEach(btn => {
    btn.addEventListener('click', () => openPaymentModal(Number(btn.dataset.openPayment)));
  });
}

function openPaymentModal(index) {
  const methods = getAdminPaymentMethods();
  const item = index >= 0 ? (methods[index] || {}) : {};

  setText('paymentModalTitle', index >= 0
    ? `UPDATE ${String(item.Name || item.name || 'METHOD').toUpperCase()}`
    : 'ADD PAYMENT METHOD'
  );

  setValue('paymentModalIndex', index >= 0 ? index : '');
  setValue('paymentModalName', item.Name || item.name || '');
  setValue('paymentModalActive', item.Active || item.active || 'Yes');

  showEl('paymentModalBackdrop');
  showEl('paymentModal');
}

function closePaymentModal() {
  hideEl('paymentModalBackdrop');
  hideEl('paymentModal');
}

function savePaymentModal() {
  const methods = getAdminPaymentMethods();
  const rawIndex = getValue('paymentModalIndex');
  const index = rawIndex === '' ? -1 : Number(rawIndex);

  const item = {
    Name: getValue('paymentModalName').trim(),
    Active: getValue('paymentModalActive') || 'Yes'
  };

  if (!item.Name) {
    alert('Method name is required.');
    return;
  }

  if (index >= 0) methods[index] = item;
  else methods.push(item);

  renderPaymentMethodsAdmin();
  closePaymentModal();
}

function deletePaymentModal() {
  const methods = getAdminPaymentMethods();
  const rawIndex = getValue('paymentModalIndex');
  const index = rawIndex === '' ? -1 : Number(rawIndex);

  if (index < 0) {
    closePaymentModal();
    return;
  }

  const ok = window.confirm('Delete this payment method?');
  if (!ok) return;

  methods.splice(index, 1);
  renderPaymentMethodsAdmin();
  closePaymentModal();
}

async function savePaymentMethodsNow() {
  try {
    showLoading('SAVING', 'Saving payment methods...');

    const methods = getAdminPaymentMethods().map(item => ({
      Name: item.Name || '',
      Active: item.Active || 'Yes'
    })).filter(item => item.Name.trim());

    const res = await api('savePaymentMethods', {
      email: state.session?.employee?.email || '',
      pin: getValue('loginPin'),
      paymentMethods: methods
    });

    hideLoading();

    if (!res.ok) {
      alert(res.message || 'Could not save payment methods.');
      return;
    }

    alert(res.message || 'Payment methods saved.');
    await loadAdminData();
    await portalRefreshNow();
  } catch (e) {
    hideLoading();
    alert(e.message || 'Could not save payment methods.');
  }
}

async function loadAdminData() {
  if (!state.session || !canViewSettings()) return;

  try {
    const res = await api('getAdminData', {
      email: state.session?.employee?.email || '',
      pin: getValue('loginPin')
    });

    if (!res.ok) return;

    state.adminData = res;
    renderPaymentMethodsAdmin();
  } catch (e) {
    console.error(e);
  }
}

async function portalRefreshNow() {
  showLoading('REFRESHING', 'Reloading...');
  try {
    const boot = await api('getPortalBootstrap', {});
    if (!boot.ok) {
      hideLoading();
      alert(boot.message || 'Refresh failed.');
      return;
    }

    state.bootstrap = boot;
    fillHeader();
    renderNav();
    renderBootstrap();
    buildProducts();
    renderCart();

    if (state.activeTab === 'settings') {
      await loadAdminData();
    }

    hideLoading();
  } catch (e) {
    hideLoading();
    alert(e.message || 'Refresh failed.');
  }
}

async function loginNow() {
  showLoading('LOGGING IN', 'Checking access...');
  try {
    const loginValue = getValue('loginValue').trim();
    const pin = getValue('loginPin').trim();

    const res = await api('login', {
      email: loginValue,
      username: loginValue,
      pin
    });

    if (!res.ok) {
      hideLoading();
      alert(res.message || 'Login failed');
      return;
    }

    state.session = res;
    state.products = Array.isArray(res.products) ? res.products : [];

    const boot = await api('getPortalBootstrap', {});
    if (!boot.ok) {
      hideLoading();
      alert(boot.message || 'Failed to load portal');
      return;
    }

    state.bootstrap = boot;

    fillHeader();
    renderNav();
    renderBootstrap();
    buildProducts();
    renderCart();

    hideEl('loginView');
    showEl('portalView');
    showEl('logoutBtn');
    showEl('portalRefreshBtn');

    openTab('dashboard');
    await loadAdminData();

    hideLoading();
  } catch (e) {
    hideLoading();
    alert(e.message || 'Login failed');
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
  hideEl('portalRefreshBtn');
}

function init() {
  $('loginBtn')?.addEventListener('click', loginNow);
  $('logoutBtn')?.addEventListener('click', logoutNow);
  $('portalRefreshBtn')?.addEventListener('click', portalRefreshNow);
  $('submitOrderBtn')?.addEventListener('click', submitOrder);
  $('savePaymentMethodsBtn')?.addEventListener('click', savePaymentMethodsNow);
  $('addPaymentMethodRowBtn')?.addEventListener('click', () => openPaymentModal(-1));

  $('paymentModalClose')?.addEventListener('click', closePaymentModal);
  $('paymentModalCancel')?.addEventListener('click', closePaymentModal);
  $('paymentModalSave')?.addEventListener('click', savePaymentModal);
  $('paymentModalDelete')?.addEventListener('click', deletePaymentModal);
  $('paymentModalBackdrop')?.addEventListener('click', closePaymentModal);

  $('mileageInput')?.addEventListener('input', renderCart);
  $('amountPaidInput')?.addEventListener('input', renderCart);
  $('discountInput')?.addEventListener('input', renderCart);
  $('tipInput')?.addEventListener('input', renderCart);

  $('loginValue')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') loginNow();
  });

  $('loginPin')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') loginNow();
  });
}

init();
