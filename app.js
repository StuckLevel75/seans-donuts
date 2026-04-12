const state = {
  apiUrl: localStorage.getItem('sd_api_url') || '',
  session: null,
  bootstrap: null,
  products: [],
  cart: {},
  paymentMethods: ['Cash', 'Invoice', 'Bank ID'],
  activeTab: 'dashboard',
  raffleEntries: [],
  raffleWheelEntries: [],
  raffleWinner: null,
  wheelRotation: 0,
  wheelSpinning: false,
  ads: []
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

function isOwnerLike() {
  const perms = getPerms();
  const role = getRole();
  return !!(perms.isOwner || perms.isAdmin || role === 'owner' || role === 'admin');
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

  const perms = getPerms();
  const hasAnyPermKeys = Object.keys(perms).length > 0;
  const role = getRole();

  if (!hasAnyPermKeys) {
    const baseTabs = [
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'pos', label: 'POS' },
      { key: 'orders', label: 'Orders' },
      { key: 'rewards', label: 'Rewards' },
      { key: 'raffle', label: 'Raffle' },
      { key: 'payroll', label: 'Payroll' }
    ];

    if (role === 'owner' || role === 'admin' || role === 'manager') {
      baseTabs.splice(5, 0, { key: 'ads', label: 'Ads' });
    }

    if (role === 'owner' || role === 'admin') {
      baseTabs.push({ key: 'settings', label: 'Settings', ownerOnly: true });
    }

    return baseTabs;
  }

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

  if (!visibleTabs.length) {
    nav.innerHTML = `
      <button type="button" class="nav-btn active" data-tab="dashboard">Dashboard</button>
      <button type="button" class="nav-btn" data-tab="pos">POS</button>
      <button type="button" class="nav-btn" data-tab="orders">Orders</button>
      <button type="button" class="nav-btn" data-tab="rewards">Rewards</button>
      <button type="button" class="nav-btn" data-tab="raffle">Raffle</button>
    `;
  } else {
    if (!visibleTabs.some(tab => tab.key === state.activeTab)) {
      state.activeTab = visibleTabs[0].key;
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
  }

  nav.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });
}

function activateTab(tabKey) {
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

  if (tabKey === 'raffle') {
    drawRaffleWheel(state.raffleWheelEntries);
  }

  if (tabKey === 'ads') {
    loadAds();
  }
}

function fillPortalHeader() {
  const settings = state.bootstrap?.settings || {};
  const ui = settings.uiText || {};
  const employee = state.session?.employee || {};
  const prefs = state.session?.portalPrefs || {};

  const portalName = settings.portalName || "Sean's Donuts";
  const portalSubtitle = settings.portalSubtitle || 'Employee Portal';
  const announcement = prefs.announcement || settings.announcement || 'Welcome to Sean\'s Donuts Portal';
  const bankId = prefs.bankId || settings.bankId || '24596194';
  const logoEmoji = ui.logoEmoji || '🍩';
  const employeeName = employee.name || 'User';

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
  setText('welcomeTitle', `Welcome, ${employeeName}`);

  setText('loginTitle', ui.loginTitle || portalName);
  setText('loginSubtitle', ui.loginSubtitle || 'Sign in with your username or email and PIN.');

  setText('loginLogo', logoEmoji);
  setText('brandLogo', logoEmoji);

  setValue('settingsPortalName', portalName);
  setValue('settingsPortalSubtitle', portalSubtitle);
  setValue('settingsAnnouncement', announcement);
  setValue('settingsBankId', bankId);

  if (isOwnerLike()) showEl('ownerOverrideBox');
  else hideEl('ownerOverrideBox');

  if (isStrictOwner()) showEl('resetRaffleBtn');
  else hideEl('resetRaffleBtn');
}

function renderDashboard() {
  const stats = state.bootstrap?.stats || {};
  const announcements = state.bootstrap?.announcements || [];

  setText('statOrders', Number(stats.totalOrders || 0));
  setText('statSales', money(stats.totalSales || 0));
  setText('statEmployees', Number(stats.activeEmployees || 0));
  setText('statRaffle', Number(stats.raffleEntries || 0));

  const list = $('announcementsList');
  if (!list) return;

  list.innerHTML = announcements.length
    ? announcements.map(item => `
        <div class="list-item">
          <h4>${escapeHtml(item.title || 'Announcement')}</h4>
          <p>${escapeHtml(item.message || '')}</p>
        </div>
      `).join('')
    : '<div class="list-item"><p>No active announcements.</p></div>';
}

function renderPaymentMethods() {
  const methods = state.bootstrap?.settings?.paymentMethods || state.paymentMethods;
  state.paymentMethods = methods;

  const select = $('paymentMethod');
  if (!select) return;

  select.innerHTML = methods.map(method => {
    const value = method.Name || method.name || method;
    return `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`;
  }).join('');
}

function buildProductGrid() {
  const grid = $('productGrid');
  if (!grid) return;

  if (!Array.isArray(state.products) || !state.products.length) {
    grid.innerHTML = '<div class="list-item"><p>No products yet.</p></div>';
    return;
  }

  grid.innerHTML = state.products.map((product, index) => {
    const qty = Number(state.cart[product.name] || 0);

    return `
      <div class="product-card">
        <h4>${escapeHtml(product.name || 'Product')}</h4>
        <div class="product-price">${money(product.price || 0)}</div>
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
      const next = btn.dataset.qty === 'up' ? current + 1 : Math.max(0, current - 1);

      if (next <= 0) delete state.cart[product.name];
      else state.cart[product.name] = next;

      buildProductGrid();
      renderCart();
    });
  });
}

function renderCart() {
  const list = $('cartList');
  if (!list) return;

  const items = Object.keys(state.cart)
    .filter(name => Number(state.cart[name]) > 0)
    .map(name => {
      const product = state.products.find(p => p.name === name) || {};
      const qty = Number(state.cart[name] || 0);
      const price = Number(product.price || 0);

      return {
        name,
        qty,
        price,
        total: qty * price
      };
    });

  list.innerHTML = items.length
    ? items.map(item => `
        <div class="list-item">
          <h4>${escapeHtml(item.name)}</h4>
          <p>${item.qty} × ${money(item.price)} = <strong>${money(item.total)}</strong></p>
        </div>
      `).join('')
    : '<div class="list-item"><p>Empty cart</p></div>';

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const mileage = Number(getValue('mileageInput', 0) || 0);
  const amountPaid = Number(getValue('amountPaidInput', 0) || 0);
  const discount = Number(getValue('discountInput', 0) || 0);
  const tip = Number(getValue('tipInput', 0) || 0);
  const total = Math.max(0, subtotal + mileage - discount + tip);

  setText('subtotalText', money(subtotal));
  setText('mileageText', money(mileage));
  setText('discountText', money(discount));
  setText('tipText', money(tip));
  setText('amountPaidText', money(amountPaid));
  setText('totalText', money(total));
}

function hasRaffleTicketInCart() {
  return Object.keys(state.cart).some(name => {
    return String(name).trim().toLowerCase() === 'raffle ticket' && Number(state.cart[name]) > 0;
  });
}

async function loginNow() {
  if (!state.apiUrl) {
    showMessage('loginMsg', 'Missing API URL.', 'error');
    return;
  }

  showLoading('LOGGING IN', 'Checking your portal access...');
  showMessage('loginMsg', 'Signing in...', 'info');

  try {
    const loginValue = getValue('loginValue').trim();
    const pin = getValue('loginPin').trim();

    const result = await api('login', {
      email: loginValue,
      username: loginValue,
      loginValue,
      pin
    });

    if (!result.ok) {
      hideLoading();
      showMessage('loginMsg', result.message || 'Login failed.', 'error');
      return;
    }

    state.session = result;
    state.products = Array.isArray(result.products) ? result.products : [];

    const bootstrap = await api('getPortalBootstrap', {});
    if (!bootstrap.ok) {
      hideLoading();
      showMessage('loginMsg', bootstrap.message || 'Could not load portal.', 'error');
      return;
    }

    state.bootstrap = bootstrap;

    fillPortalHeader();
    renderDashboard();
    renderPaymentMethods();
    buildProductGrid();
    renderCart();

    hideEl('loginView');
    showEl('portalView');
    showEl('logoutBtn');

    renderNav();
    activateTab('dashboard');

    await Promise.allSettled([
      loadOrders(),
      loadRaffle(),
      loadPayroll()
    ]);

    hideLoading();
    showMessage('loginMsg', '', 'success');
  } catch (error) {
    hideLoading();
    showMessage('loginMsg', error.message || 'Login failed.', 'error');
  }
}

function logoutNow() {
  state.session = null;
  state.bootstrap = null;
  state.products = [];
  state.cart = {};
  state.raffleEntries = [];
  state.raffleWheelEntries = [];
  state.raffleWinner = null;

  hideEl('portalView');
  showEl('loginView');
  hideEl('logoutBtn');

  setText('sessionStatus', 'Signed out');
  setText('sessionRole', '—');
  setText('userBadge', '👋 Hello, User');
}

async function submitOrder() {
  if (!state.session) return;

  const items = Object.keys(state.cart)
    .filter(name => Number(state.cart[name]) > 0)
    .map(name => ({
      name,
      qty: Number(state.cart[name])
    }));

  if (!items.length) {
    showMessage('orderMsg', 'Add at least one product.', 'error');
    return;
  }

  const customerName = getValue('customerName').trim();
  const customerDiscord = getValue('customerDiscord').trim();
  const phoneNumber = getValue('phoneNumber').trim();

  if (hasRaffleTicketInCart() && (!customerName || !customerDiscord || !phoneNumber)) {
    showMessage('orderMsg', 'Raffle ticket orders require customer name, Discord, and phone number.', 'error');
    return;
  }

  showLoading('SAVING', 'Saving the order...');
  showMessage('orderMsg', 'Submitting order...', 'info');

  try {
    const result = await api('submitOrder', {
      email: state.session.employee.email || state.session.employee.username || '',
      pin: getValue('loginPin').trim(),
      customerName,
      customerDiscord,
      phoneNumber,
      mileage: Number(getValue('mileageInput', 0) || 0),
      amountPaid: Number(getValue('amountPaidInput', 0) || 0),
      discount: Number(getValue('discountInput', 0) || 0),
      tip: Number(getValue('tipInput', 0) || 0),
      paymentMethod: getValue('paymentMethod'),
      notes: getValue('notes').trim(),
      items
    });

    if (!result.ok) {
      hideLoading();
      showMessage('orderMsg', result.message || 'Order failed.', 'error');
      return;
    }

    state.cart = {};
    buildProductGrid();

    setValue('customerName', '');
    setValue('customerDiscord', '');
    setValue('phoneNumber', '');
    setValue('mileageInput', '0');
    setValue('amountPaidInput', '0');
    setValue('discountInput', '0');
    setValue('tipInput', '0');
    setValue('notes', '');

    renderCart();

    await Promise.allSettled([
      loadOrders(),
      loadRaffle()
    ]);

    hideLoading();
    showMessage('orderMsg', result.message || 'Order submitted.', 'success');
  } catch (error) {
    hideLoading();
    showMessage('orderMsg', error.message || 'Order failed.', 'error');
  }
}

async function loadOrders() {
  if (!state.session) return;

  const list = $('ordersList');
  if (list) list.innerHTML = '<div class="list-item"><p>Loading orders...</p></div>';

  try {
    const result = await api('searchOrders', {
      email: state.session.employee.email || state.session.employee.username || '',
      pin: getValue('loginPin').trim(),
      query: getValue('orderSearchInput').trim()
    });

    const rows = result.results || [];

    if (!list) return;

    list.innerHTML = rows.length
      ? rows.map(row => `
          <div class="list-item">
            <h4>${escapeHtml(row['Order Number'] || 'Order')}</h4>
            <p>${escapeHtml(row['Customer Name'] || 'No customer')} · ${money(row['Total'] || 0)}</p>
          </div>
        `).join('')
      : '<div class="list-item"><p>No orders loaded.</p></div>';
  } catch (error) {
    if (list) list.innerHTML = `<div class="list-item"><p>${escapeHtml(error.message || 'Could not load orders.')}</p></div>`;
  }
}

async function loadRewards() {
  if (!state.session) return;

  const customerName = getValue('rewardCustomerName').trim();
  if (!customerName) {
    showMessage('rewardsMsg', 'Enter a customer name.', 'error');
    return;
  }

  showLoading('LOADING', 'Loading rewards...');
  showMessage('rewardsMsg', 'Loading rewards...', 'info');

  try {
    const result = await api('lookupRewards', {
      email: state.session.employee.email || state.session.employee.username || '',
      pin: getValue('loginPin').trim(),
      customerName
    });

    const data = result.reward || {};

    setText('rewardVisits', Number(data.visits || 0));
    setText('rewardProgress', `${Number(data.visitProgress || 0)} / 10`);
    setText('rewardAvailable', Number(data.rewardsAvailable || 0));
    setText('rewardRedeemed', Number(data.totalRewardsRedeemed || 0));
    setText('rewardLastVisit', data.lastVisit || '—');
    setText('rewardLastOrder', data.lastOrderNumber || '—');

    hideLoading();
    showMessage('rewardsMsg', 'Rewards loaded.', 'success');
  } catch (error) {
    hideLoading();
    showMessage('rewardsMsg', error.message || 'Could not load rewards.', 'error');
  }
}

function expandRaffleWheelEntries(entries) {
  const expanded = [];

  (entries || []).forEach(entry => {
    const qty = Math.max(1, Number(entry.ticketsBought || 0));
    for (let i = 0; i < qty; i++) {
      expanded.push({
        customerName: entry.customerName || '',
        customerDiscord: entry.customerDiscord || '',
        phoneNumber: entry.phoneNumber || '',
        ticketsBought: entry.ticketsBought || 0,
        orderNumber: entry.orderNumber || '',
        _sourceOrderNumber: entry.orderNumber || '',
        _sourceCustomerName: entry.customerName || ''
      });
    }
  });

  return expanded;
}

function drawRaffleWheel(entries) {
  const canvas = $('raffleWheel');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 130;

  ctx.clearRect(0, 0, width, height);

  if (!entries || !entries.length) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#2a1c12';
    ctx.fill();
    ctx.strokeStyle = '#d8ab62';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#f3c87c';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No Entries', cx, cy + 6);
    return;
  }

  const anglePer = (Math.PI * 2) / entries.length;
  const rotation = state.wheelRotation || 0;

  for (let i = 0; i < entries.length; i++) {
    const start = rotation + (i * anglePer);
    const end = start + anglePer;
    const label = String(entries[i].customerName || `Entry ${i + 1}`);

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? '#f28c18' : '#6c4330';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + anglePer / 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(label.slice(0, 14), radius - 10, 4);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#6c4330';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy - radius - 14);
  ctx.lineTo(cx - 12, cy - radius + 10);
  ctx.lineTo(cx + 12, cy - radius + 10);
  ctx.closePath();
  ctx.fillStyle = '#c7372f';
  ctx.fill();
}

function renderRaffleWinner() {
  const box = $('raffleWinnerBox');
  if (!box) return;

  const winner = state.raffleWinner;

  box.innerHTML = winner
    ? `
      <div class="list-item">
        <h4>${escapeHtml(winner.customerName || 'Winner')}</h4>
        <p><strong>Discord:</strong> ${escapeHtml(winner.customerDiscord || '—')}</p>
        <p><strong>Phone:</strong> ${escapeHtml(winner.phoneNumber || '—')}</p>
        <p><strong>Tickets:</strong> ${Number(winner.ticketsBought || 0)}</p>
        <p><strong>Order:</strong> ${escapeHtml(winner.orderNumber || '—')}</p>
      </div>
    `
    : '<div class="list-item"><p>No winner drawn yet.</p></div>';
}

async function loadRaffle() {
  if (!state.session) return;

  const list = $('raffleList');
  if (list) list.innerHTML = '<div class="list-item"><p>Loading raffle...</p></div>';

  try {
    const result = await api('loadRaffleOverview', {
      email: state.session.employee.email || state.session.employee.username || '',
      pin: getValue('loginPin').trim()
    });

    const rows = result.entries || [];
    state.raffleEntries = rows;
    state.raffleWheelEntries = expandRaffleWheelEntries(rows);
    state.raffleWinner = result.winner || null;

    renderRaffleWinner();
    drawRaffleWheel(state.raffleWheelEntries);

    if (!list) return;

    list.innerHTML = rows.length
      ? rows.map(row => `
          <div class="list-item">
            <h4>${escapeHtml(row.customerName || 'Entry')}</h4>
            <p><strong>Discord:</strong> ${escapeHtml(row.customerDiscord || '—')}</p>
            <p><strong>Phone:</strong> ${escapeHtml(row.phoneNumber || '—')}</p>
            <p><strong>Tickets:</strong> ${Number(row.ticketsBought || 0)}</p>
            <p><strong>Order:</strong> ${escapeHtml(row.orderNumber || '—')}</p>
          </div>
        `).join('')
      : '<div class="list-item"><p>No raffle entries loaded.</p></div>';
  } catch (error) {
    if (list) list.innerHTML = `<div class="list-item"><p>${escapeHtml(error.message || 'Could not load raffle.')}</p></div>`;
  }
}

async function drawRaffleWinnerNow() {
  if (!state.session) return;

  showLoading('DRAWING', 'Spinning the raffle wheel...');

  try {
    const result = await api('drawRaffleWinner', {
      email: state.session.employee.email || state.session.employee.username || '',
      pin: getValue('loginPin').trim()
    });

    if (!result.ok) {
      hideLoading();
      showMessage('raffleMsg', result.message || 'Could not draw winner.', 'error');
      return;
    }

    state.raffleWinner = result.winner || null;
    renderRaffleWinner();
    drawRaffleWheel(state.raffleWheelEntries);

    hideLoading();
    showMessage('raffleMsg', result.message || 'Winner drawn.', 'success');
  } catch (error) {
    hideLoading();
    showMessage('raffleMsg', error.message || 'Could not draw winner.', 'error');
  }
}

async function clearRaffleWinnerNow() {
  if (!state.session) return;

  showLoading('CLEARING', 'Clearing saved winner...');

  try {
    const result = await api('clearRaffleWinner', {
      email: state.session.employee.email || state.session.employee.username || '',
      pin: getValue('loginPin').trim()
    });

    if (!result.ok) {
      hideLoading();
      showMessage('raffleMsg', result.message || 'Could not clear winner.', 'error');
      return;
    }

    state.raffleWinner = null;
    renderRaffleWinner();

    hideLoading();
    showMessage('raffleMsg', result.message || 'Winner cleared.', 'success');
  } catch (error) {
    hideLoading();
    showMessage('raffleMsg', error.message || 'Could not clear winner.', 'error');
  }
}

async function resetRaffleNow() {
  if (!state.session || !isStrictOwner()) return;

  const ok = window.confirm('Reset the entire raffle? This clears all raffle entries and the winner.');
  if (!ok) return;

  showLoading('RESETTING', 'Clearing raffle entries and winner...');

  try {
    const result = await api('resetRaffle', {
      email: state.session.employee.email || state.session.employee.username || '',
      pin: getValue('loginPin').trim()
    });

    if (!result.ok) {
      hideLoading();
      showMessage('raffleMsg', result.message || 'Could not reset raffle.', 'error');
      return;
    }

    state.raffleEntries = [];
    state.raffleWheelEntries = [];
    state.raffleWinner = null;
    state.wheelRotation = 0;

    renderRaffleWinner();
    drawRaffleWheel([]);

    const list = $('raffleList');
    if (list) list.innerHTML = '<div class="list-item"><p>No raffle entries loaded.</p></div>';

    hideLoading();
    showMessage('raffleMsg', result.message || 'Raffle reset.', 'success');
  } catch (error) {
    hideLoading();
    showMessage('raffleMsg', error.message || 'Could not reset raffle.', 'error');
  }
}

async function loadAds() {
  if (!state.session) return;

  const list = $('adsList');
  if (list) list.innerHTML = '<div class="list-item"><p>Loading ads...</p></div>';

  try {
    const result = await api('loadAds', {
      email: state.session.employee.email || state.session.employee.username || '',
      pin: getValue('loginPin').trim()
    });

    if (!result.ok) {
      if (list) list.innerHTML = `<div class="list-item"><p>${escapeHtml(result.message || 'Could not load ads.')}</p></div>`;
      return;
    }

    state.ads = result.ads || [];

    if (!list) return;

    list.innerHTML = state.ads.length
      ? state.ads.map(ad => `
          <div class="list-item">
            <h4>${escapeHtml(ad.Title || '')}</h4>
            <p>${escapeHtml(ad['Ad Text'] || '')}</p>
            <p><strong>Platform:</strong> ${escapeHtml(ad.Platform || '—')}</p>
            <p><strong>Status:</strong> ${escapeHtml(ad.Status || '—')}</p>
            <div class="button-row">
              <button type="button" class="btn btn-danger" data-delete-ad="${escapeHtml(ad.ID || '')}">Delete</button>
            </div>
          </div>
        `).join('')
      : '<div class="list-item"><p>No ads yet.</p></div>';

    list.querySelectorAll('[data-delete-ad]').forEach(btn => {
      btn.addEventListener('click', () => deleteAd(btn.dataset.deleteAd));
    });
  } catch (error) {
    if (list) list.innerHTML = `<div class="list-item"><p>${escapeHtml(error.message || 'Could not load ads.')}</p></div>`;
  }
}

async function saveAd() {
  if (!state.session) return;

  showLoading('SAVING', 'Saving the ad...');

  try {
    const result = await api('saveAd', {
      email: state.session.employee.email || state.session.employee.username || '',
      pin: getValue('loginPin').trim(),
      title: getValue('adTitle').trim(),
      text: getValue('adText').trim(),
      platform: getValue('adPlatform').trim(),
      image: getValue('adImage').trim(),
      link: getValue('adLink').trim(),
      status: getValue('adStatus')
    });

    if (!result.ok) {
      hideLoading();
      showMessage('adsMsg', result.message || 'Could not save ad.', 'error');
      return;
    }

    setValue('adTitle', '');
    setValue('adText', '');
    setValue('adPlatform', '');
    setValue('adImage', '');
    setValue('adLink', '');
    setValue('adStatus', 'Active');

    await loadAds();

    hideLoading();
    showMessage('adsMsg', result.message || 'Ad saved.', 'success');
  } catch (error) {
    hideLoading();
    showMessage('adsMsg', error.message || 'Could not save ad.', 'error');
  }
}

async function deleteAd(id) {
  if (!state.session || !id) return;

  const ok = window.confirm('Delete this ad?');
  if (!ok) return;

  showLoading('DELETING', 'Removing the ad...');

  try {
    const result = await api('deleteAd', {
      email: state.session.employee.email || state.session.employee.username || '',
      pin: getValue('loginPin').trim(),
      id
    });

    if (!result.ok) {
      hideLoading();
      showMessage('adsMsg', result.message || 'Could not delete ad.', 'error');
      return;
    }

    await loadAds();

    hideLoading();
    showMessage('adsMsg', result.message || 'Ad deleted.', 'success');
  } catch (error) {
    hideLoading();
    showMessage('adsMsg', error.message || 'Could not delete ad.', 'error');
  }
}

async function loadPayroll() {
  if (!state.session) return;

  const list = $('payrollList');
  if (list) list.innerHTML = '<div class="list-item"><p>Loading payroll...</p></div>';

  try {
    const result = await api('loadPayroll', {
      email: state.session.employee.email || state.session.employee.username || '',
      pin: getValue('loginPin').trim(),
      startDate: getValue('payrollStartDate'),
      endDate: getValue('payrollEndDate')
    });

    const rows = result.rows || [];

    if (!list) return;

    list.innerHTML = rows.length
      ? rows.map(row => `
          <div class="list-item">
            <h4>${escapeHtml(row.Employee || 'Employee')}</h4>
            <p>Total Pay: ${money(row['Total Pay'] || 0)} · Orders: ${Number(row.Orders || 0)}</p>
          </div>
        `).join('')
      : '<div class="list-item"><p>No payroll rows loaded.</p></div>';
  } catch (error) {
    if (list) list.innerHTML = `<div class="list-item"><p>${escapeHtml(error.message || 'Could not load payroll.')}</p></div>`;
  }
}

function wireEvents() {
  $('loginBtn')?.addEventListener('click', loginNow);
  $('logoutBtn')?.addEventListener('click', logoutNow);
  $('submitOrderBtn')?.addEventListener('click', submitOrder);
  $('searchOrdersBtn')?.addEventListener('click', loadOrders);
  $('lookupRewardsBtn')?.addEventListener('click', loadRewards);
  $('drawWinnerBtn')?.addEventListener('click', drawRaffleWinnerNow);
  $('clearWinnerBtn')?.addEventListener('click', clearRaffleWinnerNow);
  $('resetRaffleBtn')?.addEventListener('click', resetRaffleNow);
  $('loadPayrollBtn')?.addEventListener('click', loadPayroll);
  $('saveAdBtn')?.addEventListener('click', saveAd);

  $('loginValue')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') loginNow();
  });

  $('loginPin')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') loginNow();
  });

  $('discountInput')?.addEventListener('input', renderCart);
  $('tipInput')?.addEventListener('input', renderCart);
  $('mileageInput')?.addEventListener('input', renderCart);
  $('amountPaidInput')?.addEventListener('input', renderCart);
}

function init() {
  wireEvents();
  renderCart();
  drawRaffleWheel([]);
}

init();
