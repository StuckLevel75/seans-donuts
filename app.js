const state = {
  apiUrl: localStorage.getItem('sd_api_url') || '',
  session: null,
  bootstrap: null,
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
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showMessage(elId, text, type = 'info') {
  const el = $(elId);
  if (!el) return;
  el.textContent = text || '';
  el.className = `message ${text ? `show ${type}` : ''}`.trim();
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function setValue(id, value) {
  const el = $(id);
  if (el) el.value = value;
}

function getValue(id, fallback = '') {
  const el = $(id);
  return el ? el.value : fallback;
}

function requireApiUrl() {
  if (!state.apiUrl) {
    showMessage('loginMsg', 'Paste your Apps Script Web App URL first.', 'error');
    return false;
  }
  return true;
}

async function api(action, payload = {}) {
  if (!state.apiUrl) throw new Error('Missing Apps Script Web App URL.');

  const response = await fetch(state.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  return data;
}

function saveApiUrl() {
  const input = $('apiUrl');
  const value = input ? input.value.trim() : '';
  state.apiUrl = value;
  localStorage.setItem('sd_api_url', value);
  showMessage('loginMsg', value ? 'Apps Script URL saved.' : '', 'success');
}

function getSessionRole() {
  return String(state.session?.employee?.role || '').trim().toLowerCase();
}

function getPermissions() {
  return state.session?.permissions || {};
}

function isOwnerLike() {
  const perms = getPermissions();
  const role = getSessionRole();

  return !!(
    perms.isOwner ||
    perms.isAdmin ||
    role === 'owner' ||
    role === 'admin'
  );
}

function canSeeTab(tabKey) {
  if (tabKey === 'settings') return isOwnerLike();
  return true;
}

function getVisibleTabs() {
  return tabs.filter(tab => !tab.ownerOnly || canSeeTab(tab.key));
}

function renderNav() {
  const nav = $('navTabs');
  if (!nav) {
    console.error('navTabs element not found');
    return;
  }

  const visibleTabs = getVisibleTabs();

  if (!visibleTabs.some(tab => tab.key === state.activeTab)) {
    state.activeTab = visibleTabs.length ? visibleTabs[0].key : 'dashboard';
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
    btn.addEventListener('click', () => {
      activateTab(btn.dataset.tab);
    });
  });

  document.querySelectorAll('[data-tab-target]').forEach(btn => {
    btn.onclick = () => activateTab(btn.dataset.tabTarget);
  });
}

function activateTab(tab) {
  const visibleTabs = getVisibleTabs();
  const allowed = visibleTabs.some(t => t.key === tab);

  state.activeTab = allowed ? tab : (visibleTabs[0]?.key || 'dashboard');
  renderNav();

  const sectionMap = {
    dashboard: 'dashboardSection',
    pos: 'posSection',
    orders: 'ordersSection',
    rewards: 'rewardsSection',
    raffle: 'raffleSection',
    payroll: 'payrollSection',
    settings: 'settingsSection'
  };

  Object.values(sectionMap).forEach(id => {
    const el = $(id);
    if (el) el.classList.add('hidden');
  });

  const activeSectionId = sectionMap[state.activeTab];
  const activeSection = $(activeSectionId);
  if (activeSection) activeSection.classList.remove('hidden');
}

function buildProductGrid() {
  const grid = $('productGrid');
  if (!grid) return;

  if (!state.products.length) {
    grid.innerHTML = '<div class="list-item"><p>No products returned yet.</p></div>';
    return;
  }

  grid.innerHTML = state.products.map((product, index) => {
    const qty = Number(state.cart[product.name] || 0);

    return `
      <div class="product-card">
        <h4>${escapeHtml(product.name)}</h4>
        <div class="product-price">${money(product.price)}</div>
        <div class="qty-row">
          <button type="button" data-qty="down" data-index="${index}">−</button>
          <div class="qty-pill">${qty}</div>
          <button type="button" data-qty="up" data-index="${index}">+</button>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('[data-qty]').forEach(btn => {
    btn.addEventListener('click', () => {
      const product = state.products[Number(btn.dataset.index)];
      if (!product) return;

      const current = Number(state.cart[product.name] || 0);
      const nextQty = btn.dataset.qty === 'up'
        ? current + 1
        : Math.max(0, current - 1);

      if (nextQty <= 0) delete state.cart[product.name];
      else state.cart[product.name] = nextQty;

      buildProductGrid();
      renderCart();
    });
  });
}

function renderCart() {
  const list = $('cartList');
  if (!list) return;

  const items = Object.entries(state.cart).map(([name, qty]) => {
    const product = state.products.find(p => p.name === name);
    const price = Number(product?.price || 0);
    const quantity = Number(qty || 0);

    return {
      name,
      qty: quantity,
      price,
      total: price * quantity
    };
  });

  if (!items.length) {
    list.innerHTML = '<div class="list-item"><p>No items yet.</p></div>';
  } else {
    list.innerHTML = items.map(item => `
      <div class="list-item">
        <h4>${escapeHtml(item.name)}</h4>
        <p>${item.qty} × ${money(item.price)} = <strong>${money(item.total)}</strong></p>
      </div>
    `).join('');
  }

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const discount = Number(getValue('discountInput', 0) || 0);
  const tip = Number(getValue('tipInput', 0) || 0);
  const total = Math.max(0, subtotal - discount + tip);

  setText('subtotalText', money(subtotal));
  setText('discountText', money(discount));
  setText('tipText', money(tip));
  setText('totalText', money(total));
}

function fillPortalHeader() {
  const settings = state.bootstrap?.settings || {};
  const session = state.session || {};
  const prefs = session.portalPrefs || {};

  setText('portalName', settings.portalName || "Sean's Donuts");
  setText('portalSubtitle', settings.portalSubtitle || 'GitHub Portal');
  setText('welcomeTitle', `Welcome, ${session.employee?.name || 'Employee'}`);
  setText(
    'announcementBar',
    prefs.announcement || settings.dashboardMessage || "Welcome to Sean's Donuts Portal"
  );
  setText('bankIdText', prefs.bankId || settings.bankId || '24596194');
  setText(
    'userBadge',
    `${session.employee?.name || 'Portal User'} · ${session.employee?.role || 'Employee'}`
  );
  setText('sessionStatus', 'Signed in');
  setText('sessionRole', session.employee?.role || 'Employee');

  const logoutBtn = $('logoutBtn');
  if (logoutBtn) logoutBtn.classList.remove('hidden');

  setValue('settingsAnnouncement', prefs.announcement || '');
  setValue('settingsBankId', prefs.bankId || settings.bankId || '24596194');

  const settingsTheme = $('settingsTheme');
  if (settingsTheme) {
    settingsTheme.value = prefs.portalTheme || settings.portalTheme || settings.theme || '';
  }
}

function renderBootstrap() {
  const stats = state.bootstrap?.stats || {};
  const announcements = state.bootstrap?.announcements || [];
  const settings = state.bootstrap?.settings || {};

  setText('statOrders', Number(stats.totalOrders || 0));
  setText('statSales', money(stats.totalSales || 0));
  setText('statEmployees', Number(stats.activeEmployees || 0));
  setText('statRaffle', Number(stats.raffleEntries || 0));

  const announcementsList = $('announcementsList');
  if (announcementsList) {
    announcementsList.innerHTML = announcements.length
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
    : state.paymentMethods;

  const paymentMethod = $('paymentMethod');
  if (paymentMethod) {
    paymentMethod.innerHTML = methods.map(method => `
      <option value="${escapeHtml(method)}">${escapeHtml(method)}</option>
    `).join('');
  }
}

async function loadBootstrap() {
  const result = await api('getPortalBootstrap');
  if (result.ok === false) {
    throw new Error(result.message || 'Could not load portal bootstrap.');
  }

  state.bootstrap = result;
  renderBootstrap();
}

async function loginNow() {
  if (!requireApiUrl()) return;
  showMessage('loginMsg', 'Signing in...', 'info');

  try {
    const email = getValue('loginValue').trim() || getValue('email').trim();
    const pin = getValue('loginPin').trim() || getValue('pin').trim();

    const result = await api('login', { email, pin });

    if (!result.ok) {
      showMessage('loginMsg', result.message || 'Login failed.', 'error');
      return;
    }

    state.session = result;
    state.products = result.products || [];

    await loadBootstrap();
    fillPortalHeader();
    buildProductGrid();
    renderCart();
    renderNav();

    const loginView = $('loginView');
    const portalView = $('portalView') || $('portal');

    if (loginView) loginView.classList.add('hidden');
    if (portalView) portalView.classList.remove('hidden');

    activateTab('dashboard');

    await Promise.allSettled([
      loadOrders(),
      loadRaffle(),
      loadPayroll(),
      loadRewards(true)
    ]);

    showMessage('loginMsg', '', 'success');
  } catch (error) {
    showMessage('loginMsg', error.message || 'Could not sign in.', 'error');
  }
}

function logoutNow() {
  state.session = null;
  state.bootstrap = null;
  state.products = [];
  state.cart = {};
  state.activeTab = 'dashboard';

  const portalView = $('portalView') || $('portal');
  const loginView = $('loginView');

  if (portalView) portalView.classList.add('hidden');
  if (loginView) loginView.classList.remove('hidden');

  setText('sessionStatus', 'Signed out');
  setText('sessionRole', '—');

  const logoutBtn = $('logoutBtn');
  if (logoutBtn) logoutBtn.classList.add('hidden');

  renderNav();
  activateTab('dashboard');
}

async function submitOrder() {
  if (!state.session) return;

  const items = Object.entries(state.cart)
    .filter(([, qty]) => Number(qty) > 0)
    .map(([name, qty]) => ({
      name,
      qty: Number(qty)
    }));

  if (!items.length) {
    showMessage('orderMsg', 'Add at least one product.', 'error');
    return;
  }

  showMessage('orderMsg', 'Submitting order...', 'info');

  try {
    const payload = {
      email: state.session.employee?.email || state.session.employee?.username || '',
      pin: getValue('loginPin').trim() || getValue('pin').trim(),
      customerName: getValue('customerName').trim(),
      phoneNumber: getValue('phoneNumber').trim(),
      items,
      discount: Number(getValue('discountInput', 0) || 0),
      tip: Number(getValue('tipInput', 0) || 0),
      paymentMethod: getValue('paymentMethod'),
      notes: getValue('notes').trim()
    };

    const result = await api('submitOrder', payload);

    if (!result.ok) {
      showMessage('orderMsg', result.message || 'Order failed.', 'error');
      return;
    }

    state.cart = {};
    buildProductGrid();
    renderCart();

    setValue('customerName', '');
    setValue('phoneNumber', '');
    setValue('discountInput', '0');
    setValue('tipInput', '0');
    setValue('notes', '');

    showMessage('orderMsg', result.message || 'Order submitted.', 'success');

    await Promise.allSettled([loadOrders(), loadBootstrap()]);
    fillPortalHeader();
  } catch (error) {
    showMessage('orderMsg', error.message || 'Order failed.', 'error');
  }
}

async function loadOrders() {
  if (!state.session) return;

  const list = $('ordersList');
  if (list) {
    list.innerHTML = '<div class="list-item"><p>Loading orders...</p></div>';
  }

  try {
    const query = getValue('orderSearchInput').trim();

    const result = await api('searchOrders', {
      email: state.session.employee?.email || state.session.employee?.username || '',
      pin: getValue('loginPin').trim() || getValue('pin').trim(),
      query
    });

    const rows = result.results || result.orders || [];

    if (!list) return;

    list.innerHTML = rows.length
      ? rows.map(row => `
          <div class="list-item">
            <h4>${escapeHtml(row.orderNumber || row['Order Number'] || 'Order')}</h4>
            <p>${escapeHtml(row.customerName || row.CustomerName || row['Customer Name'] || 'No customer')} · ${money(row.total || row.Total || 0)}</p>
          </div>
        `).join('')
      : '<div class="list-item"><p>No orders found.</p></div>';
  } catch (error) {
    if (list) {
      list.innerHTML = `<div class="list-item"><p>${escapeHtml(error.message || 'Could not load orders.')}</p></div>`;
    }
  }
}

async function loadRewards(silent = false) {
  if (!state.session) return;

  const customerName = getValue('rewardCustomerName').trim() || getValue('customerName').trim();

  if (!customerName && !silent) {
    showMessage('rewardsMsg', 'Enter a customer name first.', 'error');
    return;
  }

  if (!silent) showMessage('rewardsMsg', 'Loading rewards...', 'info');

  try {
    const result = await api('lookupRewards', {
      email: state.session.employee?.email || state.session.employee?.username || '',
      pin: getValue('loginPin').trim() || getValue('pin').trim(),
      customerName
    });

    const data = result.reward || result.rewards || result || {};

    setText('rewardVisits', Number(data.visits || 0));
    setText('rewardProgress', `${Number(data.visitProgress || 0)} / 10`);
    setText('rewardAvailable', Number(data.rewardsAvailable || 0));
    setText('rewardRedeemed', Number(data.totalRewardsRedeemed || 0));
    setText('rewardLastVisit', data.lastVisit || '—');
    setText('rewardLastOrder', data.lastOrderNumber || '—');

    if (!silent) showMessage('rewardsMsg', 'Rewards loaded.', 'success');
  } catch (error) {
    if (!silent) {
      showMessage('rewardsMsg', error.message || 'Could not load rewards.', 'error');
    }
  }
}

async function loadRaffle() {
  if (!state.session) return;

  const list = $('raffleList');
  if (list) {
    list.innerHTML = '<div class="list-item"><p>Loading raffle...</p></div>';
  }

  try {
    const result = await api('loadRaffleOverview', {
      email: state.session.employee?.email || state.session.employee?.username || '',
      pin: getValue('loginPin').trim() || getValue('pin').trim()
    });

    const rows = result.results || result.entries || [];

    if (!list) return;

    list.innerHTML = rows.length
      ? rows.map(row => `
          <div class="list-item">
            <h4>${escapeHtml(row.customerName || row['Customer Name'] || 'Entry')}</h4>
            <p>Tickets: ${Number(row.ticketsBought || row['Tickets Bought'] || 0)}</p>
          </div>
        `).join('')
      : '<div class="list-item"><p>No raffle entries found.</p></div>';
  } catch (error) {
    if (list) {
      list.innerHTML = `<div class="list-item"><p>${escapeHtml(error.message || 'Could not load raffle.')}</p></div>`;
    }
  }
}

async function loadPayroll() {
  if (!state.session) return;

  const list = $('payrollList');
  if (list) {
    list.innerHTML = '<div class="list-item"><p>Loading payroll...</p></div>';
  }

  try {
    const result = await api('loadPayroll', {
      email: state.session.employee?.email || state.session.employee?.username || '',
      pin: getValue('loginPin').trim() || getValue('pin').trim(),
      startDate: getValue('payrollStartDate'),
      endDate: getValue('payrollEndDate')
    });

    const rows = result.results || result.rows || [];

    if (!list) return;

    list.innerHTML = rows.length
      ? rows.map(row => `
          <div class="list-item">
            <h4>${escapeHtml(row.employee || row.name || 'Employee')}</h4>
            <p>Total Pay: ${money(row.totalPay || 0)} · Orders: ${Number(row.orders || 0)}</p>
          </div>
        `).join('')
      : '<div class="list-item"><p>No payroll rows found.</p></div>';
  } catch (error) {
    if (list) {
      list.innerHTML = `<div class="list-item"><p>${escapeHtml(error.message || 'Could not load payroll.')}</p></div>`;
    }
  }
}

async function saveSettings() {
  if (!state.session) return;

  showMessage('settingsMsg', 'Saving settings...', 'info');

  try {
    const payload = {
      email: state.session.employee?.email || state.session.employee?.username || '',
      pin: getValue('loginPin').trim() || getValue('pin').trim(),
      announcement: getValue('settingsAnnouncement').trim(),
      bankId: getValue('settingsBankId').trim(),
      portalTheme: getValue('settingsTheme')
    };

    const result = await api('saveSettings', payload);

    if (!result.ok) {
      throw new Error(result.message || 'Could not save settings.');
    }

    state.session.portalPrefs = {
      ...(state.session.portalPrefs || {}),
      announcement: payload.announcement,
      bankId: payload.bankId,
      portalTheme: payload.portalTheme
    };

    fillPortalHeader();
    showMessage('settingsMsg', result.message || 'Settings saved.', 'success');
  } catch (error) {
    showMessage('settingsMsg', error.message || 'Could not save settings.', 'error');
  }
}

function setDefaultDates() {
  const startEl = $('payrollStartDate');
  const endEl = $('payrollEndDate');
  if (!startEl || !endEl) return;

  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);

  startEl.value = first.toISOString().slice(0, 10);
  endEl.value = today.toISOString().slice(0, 10);
}

function wireEvents() {
  const apiUrl = $('apiUrl');
  if (apiUrl) apiUrl.value = state.apiUrl;

  $('saveApiUrlBtn')?.addEventListener('click', saveApiUrl);
  $('loginBtn')?.addEventListener('click', loginNow);
  $('logoutBtn')?.addEventListener('click', logoutNow);
  $('submitOrderBtn')?.addEventListener('click', submitOrder);
  $('searchOrdersBtn')?.addEventListener('click', loadOrders);
  $('lookupRewardsBtn')?.addEventListener('click', () => loadRewards(false));
  $('loadPayrollBtn')?.addEventListener('click', loadPayroll);
  $('saveSettingsBtn')?.addEventListener('click', saveSettings);

  $('discountInput')?.addEventListener('input', renderCart);
  $('tipInput')?.addEventListener('input', renderCart);

  $('demoFillBtn')?.addEventListener('click', () => {
    if ($('loginValue')) $('loginValue').value = 'owner';
    if ($('loginPin')) $('loginPin').value = '1234';
    if ($('email')) $('email').value = 'owner';
    if ($('pin')) $('pin').value = '1234';
  });

  $('loginValue')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') loginNow();
  });

  $('loginPin')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') loginNow();
  });

  $('email')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') loginNow();
  });

  $('pin')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') loginNow();
  });
}

function init() {
  renderNav();
  wireEvents();
  setDefaultDates();
  activateTab(state.activeTab);
}

init();
