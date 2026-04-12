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
  const ui = settings.uiText || {};
  const employee = state.session?.employee || {};
  const prefs = state.session?.portalPrefs || {};

  const portalName = settings.portalName || "Sean's Donuts";
  const portalSubtitle = settings.portalSubtitle || 'Employee Portal';
  const announcement = prefs.announcement || settings.announcement || 'Welcome to Sean\'s Donuts Portal';
  const bankId = prefs.bankId || settings.bankId || '24596194';
  const logoEmoji = ui.logoEmoji || '🍩';
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
  setText('rewardsSubtitleText', ui.rewardsSubtitle || 'Lookup customer rewards');
  setText('raffleTitleText', ui.raffleTitle || 'Raffle');
  setText('raffleSubtitleText', ui.raffleSubtitle || 'Recent raffle entries');
  setText('payrollTitleText', ui.payrollTitle || 'Payroll');
  setText('payrollSubtitleText', ui.payrollSubtitle || 'Weekly payroll summary');
  setText('settingsTitleText', ui.settingsTitle || 'Settings');
  setText('settingsSubtitleText', ui.settingsSubtitle || 'Owner/Admin controls');

  setText('loginTitle', ui.loginTitle || portalName);
  setText('loginSubtitle', ui.loginSubtitle || 'Sign in with your username or email and PIN.');

  setText('loginLogo', logoEmoji);
  setText('brandLogo', logoEmoji);

  setValue('settingsPortalName', portalName);
  setValue('settingsPortalSubtitle', portalSubtitle);
  setValue('settingsAnnouncement', announcement);
  setValue('settingsBankId', bankId);
  setValue('settingsMileageRate', state.mileageRate);

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
  const methods = state.bootstrap?.settings?.paymentMethods || [];
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

function getMilesInput() {
  return Number(getValue('mileageInput', 0) || 0);
}

function getMileageCharge() {
  return getMilesInput() * Number(state.mileageRate || 0);
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
  const mileage = getMileageCharge();
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
  return Object.keys(state.cart).some(name =>
    String(name).trim().toLowerCase() === 'raffle ticket' && Number(state.cart[name]) > 0
  );
}

async function refreshPortalData(options = {}) {
  if (!state.session) return;

  const keepTab = options.keepTab !== false;
  const currentTab = state.activeTab || 'dashboard';

  showLoading('REFRESHING', 'Reloading portal data...');

  try {
    const bootstrap = await api('getPortalBootstrap', {});
    if (!bootstrap.ok) {
      hideLoading();
      alert(bootstrap.message || 'Could not refresh portal.');
      return;
    }

    state.bootstrap = bootstrap;
    state.products = bootstrap.products || [];
    state.paymentMethods = bootstrap.settings?.paymentMethods || state.paymentMethods;
    state.mileageRate = Number(bootstrap.settings?.mileageRate || 0);

    fillPortalHeader();
    renderDashboard();
    renderPaymentMethods();
    buildProductGrid();
    renderCart();
    renderNav();

    if (keepTab) {
      await activateTab(currentTab);
    } else {
      await activateTab('dashboard');
    }

    hideLoading();
  } catch (error) {
    hideLoading();
    alert(error.message || 'Could not refresh portal.');
  }
}

async function portalRefreshNow() {
  await refreshPortalData({ keepTab: true });
}

async function loginNow() {
  if (!state.apiUrl) {
    alert('Missing API URL.');
    return;
  }

  showLoading('LOGGING IN', 'Checking your portal access...');

  try {
    const loginValue = getValue('loginValue').trim();
    const pin = getValue('loginPin').trim();

    const result = await api('login', {
      loginValue,
      email: loginValue,
      username: loginValue,
      pin
    });

    if (!result.ok) {
      hideLoading();
      alert(result.message || 'Login failed.');
      return;
    }

    state.session = result;
    state.products = Array.isArray(result.products) ? result.products : [];

    const bootstrap = await api('getPortalBootstrap', {});
    if (!bootstrap.ok) {
      hideLoading();
      alert(bootstrap.message || 'Could not load portal.');
      return;
    }

    state.bootstrap = bootstrap;
    state.products = bootstrap.products || state.products;

    fillPortalHeader();
    renderDashboard();
    renderPaymentMethods();
    buildProductGrid();
    renderCart();

    hideEl('loginView');
    showEl('portalView');
    showEl('logoutBtn');
    showEl('portalRefreshBtn');

    renderNav();
    await activateTab('dashboard');

    hideLoading();
  } catch (error) {
    hideLoading();
    alert(error.message || 'Login failed.');
  }
}

function logoutNow() {
  state.session = null;
  state.bootstrap = null;
  state.adminData = null;
  state.products = [];
  state.cart = {};
  state.raffleEntries = [];
  state.raffleWheelEntries = [];
  state.raffleWinner = null;
  state.ads = [];
  state.payrollRows = [];
  state.activeTab = 'dashboard';
  state.mileageRate = 0;

  showEl('loginView');
  hideEl('portalView');
  hideEl('logoutBtn');
  hideEl('portalRefreshBtn');

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
    alert('Add at least one product.');
    return;
  }

  const customerName = getValue('customerName').trim();
  const customerDiscord = getValue('customerDiscord').trim();
  const phoneNumber = getValue('phoneNumber').trim();

  if (hasRaffleTicketInCart() && (!customerName || !customerDiscord || !phoneNumber)) {
    alert('Raffle ticket orders require customer name, Discord, and phone number.');
    return;
  }

  showLoading('SAVING', 'Saving the order...');

  try {
    const result = await api('submitOrder', authPayload({
      customerName,
      customerDiscord,
      phoneNumber,
      mileage: getMileageCharge(),
      amountPaid: Number(getValue('amountPaidInput', 0) || 0),
      discount: Number(getValue('discountInput', 0) || 0),
      tip: Number(getValue('tipInput', 0) || 0),
      paymentMethod: getValue('paymentMethod'),
      notes: getValue('notes').trim(),
      items
    }));

    hideLoading();

    if (!result.ok) {
      alert(result.message || 'Order failed.');
      return;
    }

    state.cart = {};
    setValue('customerName', '');
    setValue('customerDiscord', '');
    setValue('phoneNumber', '');
    setValue('mileageInput', '0');
    setValue('amountPaidInput', '0');
    setValue('discountInput', '0');
    setValue('tipInput', '0');
    setValue('notes', '');

    buildProductGrid();
    renderCart();
    await loadOrders();
    await loadRaffle();

    alert(result.message || 'Order submitted.');
  } catch (error) {
    hideLoading();
    alert(error.message || 'Order failed.');
  }
}

async function loadOrders() {
  if (!state.session) return;

  const res = await api('searchOrders', authPayload({
    query: getValue('orderSearchInput').trim()
  }));

  const rows = res.results || [];
  const wrap = $('ordersList');
  if (!wrap) return;

  wrap.innerHTML = rows.length ? rows.map(r => `
    <details class="settings-popout">
      <summary>
        <span class="settings-summary-left">
          <span class="settings-icon">🧾</span>
          <span>${escapeHtml(r['Order Number'] || 'Order')} — ${escapeHtml(r['Customer Name'] || 'No Name')}</span>
        </span>
      </summary>
      <div class="settings-popout-body">
        <p><b>Date:</b> ${escapeHtml(r['Timestamp'] || '')}</p>
        <p><b>Employee:</b> ${escapeHtml(r['Employee Name'] || '')}</p>
        <p><b>Discord:</b> ${escapeHtml(r['Customer Discord'] || '')}</p>
        <p><b>Phone:</b> ${escapeHtml(r['Phone Number'] || '')}</p>
        <p><b>Payment:</b> ${escapeHtml(r['Payment Method'] || '')}</p>
        <p><b>Subtotal:</b> ${money(r['Subtotal'])}</p>
        <p><b>Discount:</b> ${money(r['Discount'])}</p>
        <p><b>Tip:</b> ${money(r['Tip'])}</p>
        <p><b>Mileage:</b> ${money(r['Mileage'])}</p>
        <p><b>Total:</b> ${money(r['Total'])}</p>
        <p><b>Notes:</b> ${escapeHtml(r['Notes'] || '')}</p>
      </div>
    </details>
  `).join('') : '<div class="list-item"><p>No orders loaded.</p></div>';
}

function renderRewardsBlank() {
  const wrap = $('rewardsResultCard');
  if (!wrap) return;
  wrap.innerHTML = '<div class="list-item"><p>Search a customer to view rewards.</p></div>';
}

async function loadRewards() {
  if (!state.session) return;

  const customerName = getValue('rewardCustomerName').trim();
  if (!customerName) {
    renderRewardsBlank();
    return;
  }

  const res = await api('lookupRewards', authPayload({ customerName }));
  const r = res.reward || {};
  const wrap = $('rewardsResultCard');
  if (!wrap) return;

  wrap.innerHTML = `
    <details class="settings-popout" open>
      <summary>
        <span class="settings-summary-left">
          <span class="settings-icon">🎁</span>
          <span>${escapeHtml(customerName)}</span>
        </span>
      </summary>
      <div class="settings-popout-body">
        <p><b>Visits:</b> ${r.visits || 0}</p>
        <p><b>Progress:</b> ${r.visitProgress || 0}/10</p>
        <p><b>Available:</b> ${r.rewardsAvailable || 0}</p>
        <p><b>Redeemed:</b> ${r.totalRewardsRedeemed || 0}</p>
        <p><b>Last Visit:</b> ${escapeHtml(r.lastVisit || '—')}</p>
        <p><b>Last Order:</b> ${escapeHtml(r.lastOrderNumber || '—')}</p>
      </div>
    </details>
  `;
}

function expandRaffleWheelEntries(entries) {
  const expanded = [];
  (entries || []).forEach(entry => {
    const qty = Math.max(1, Number(entry.ticketsBought || 0));
    for (let i = 0; i < qty; i++) expanded.push(entry);
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

  const res = await api('loadRaffleOverview', authPayload({}));
  const rows = res.entries || [];

  state.raffleEntries = rows;
  state.raffleWheelEntries = expandRaffleWheelEntries(rows);
  state.raffleWinner = res.winner || null;

  renderRaffleWinner();
  drawRaffleWheel(state.raffleWheelEntries);

  const list = $('raffleList');
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
}

async function drawRaffleWinnerNow() {
  const res = await api('drawRaffleWinner', authPayload({}));
  if (!res.ok) return alert(res.message || 'Could not draw winner.');
  state.raffleWinner = res.winner || null;
  renderRaffleWinner();
}

async function clearRaffleWinnerNow() {
  const res = await api('clearRaffleWinner', authPayload({}));
  if (!res.ok) return alert(res.message || 'Could not clear winner.');
  state.raffleWinner = null;
  renderRaffleWinner();
}

async function resetRaffleNow() {
  const ok = window.confirm('Reset the entire raffle?');
  if (!ok) return;

  const res = await api('resetRaffle', authPayload({}));
  if (!res.ok) return alert(res.message || 'Could not reset raffle.');
  await loadRaffle();
}

async function loadAds() {
  if (!state.session) return;

  const res = await api('loadAds', authPayload({}));
  const list = $('adsList');
  if (!list) return;

  if (!res.ok) {
    list.innerHTML = `<div class="list-item"><p>${escapeHtml(res.message || 'Could not load ads.')}</p></div>`;
    return;
  }

  state.ads = res.ads || [];
  list.innerHTML = state.ads.length
    ? state.ads.map(ad => `
        <div class="list-item">
          <h4>${escapeHtml(ad.Title || '')}</h4>
          <p>${escapeHtml(ad['Ad Text'] || '')}</p>
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
}

async function saveAd() {
  const res = await api('saveAd', authPayload({
    title: getValue('adTitle').trim(),
    text: getValue('adText').trim(),
    status: getValue('adStatus')
  }));

  if (!res.ok) return alert(res.message || 'Could not save ad.');

  setValue('adTitle', '');
  setValue('adText', '');
  setValue('adStatus', 'Active');
  await loadAds();
}

async function deleteAd(id) {
  const ok = window.confirm('Delete this ad?');
  if (!ok) return;

  const res = await api('deleteAd', authPayload({ id }));
  if (!res.ok) return alert(res.message || 'Could not delete ad.');
  await loadAds();
}

function renderPayroll(rows) {
  const list = $('payrollList');
  if (!list) return;

  const employeeCount = rows.length;
  const totalOrders = rows.reduce((sum, row) => sum + Number(row.Orders || 0), 0);
  const totalTips = rows.reduce((sum, row) => sum + Number(row.Tips || 0), 0);
  const totalPay = rows.reduce((sum, row) => sum + Number(row['Total Pay'] || 0), 0);

  setText('payrollEmployees', employeeCount);
  setText('payrollOrders', totalOrders);
  setText('payrollTips', money(totalTips));
  setText('payrollTotalPay', money(totalPay));

  list.innerHTML = rows.length
    ? rows.map(row => `
      <div class="list-item">
        <h4>${escapeHtml(row.Employee || 'Employee')}</h4>
        <div class="order-detail-grid">
          <div><strong>Start:</strong> ${escapeHtml(row['Start Date'] || '—')}</div>
          <div><strong>End:</strong> ${escapeHtml(row['End Date'] || '—')}</div>
          <div><strong>Orders:</strong> ${Number(row.Orders || 0)}</div>
          <div><strong>Tips:</strong> ${money(row.Tips || 0)}</div>
          <div><strong>Commission:</strong> ${money(row.Commission || 0)}</div>
          <div><strong>Total Pay:</strong> ${money(row['Total Pay'] || 0)}</div>
        </div>
      </div>
    `).join('')
    : '<div class="list-item"><p>No payroll rows loaded.</p></div>';
}

async function loadPayroll() {
  if (!state.session) return;

  const result = await api('loadPayroll', authPayload({
    startDate: getValue('payrollStartDate'),
    endDate: getValue('payrollEndDate')
  }));

  const rows = result.rows || [];
  state.payrollRows = rows;
  renderPayroll(rows);
}

function productRowHtml(item = {}) {
  return `
    <div class="list-item admin-product-row">
      <div class="form-grid">
        <div class="field">
          <label>Name</label>
          <input class="admin-product-name" type="text" value="${escapeHtml(item.Name || item.name || '')}">
        </div>
        <div class="field">
          <label>Price</label>
          <input class="admin-product-price" type="number" step="0.01" value="${Number(item.Price || item.price || 0)}">
        </div>
        <div class="field">
          <label>Active</label>
          <select class="admin-product-active">
            <option value="Yes" ${(String(item.Active || item.active || 'Yes') === 'Yes') ? 'selected' : ''}>Yes</option>
            <option value="No" ${(String(item.Active || item.active || 'Yes') === 'No') ? 'selected' : ''}>No</option>
          </select>
        </div>
      </div>
    </div>
  `;
}

function employeeRowHtml(item = {}) {
  return `
    <div class="list-item admin-employee-row">
      <div class="form-grid">
        <div class="field">
          <label>Name</label>
          <input class="admin-employee-name" type="text" value="${escapeHtml(item.Name || '')}">
        </div>
        <div class="field">
          <label>Email</label>
          <input class="admin-employee-email" type="text" value="${escapeHtml(item.Email || '')}">
        </div>
        <div class="field">
          <label>Username</label>
          <input class="admin-employee-username" type="text" value="${escapeHtml(item.Username || '')}">
        </div>
        <div class="field">
          <label>PIN</label>
          <input class="admin-employee-pin" type="text" value="${escapeHtml(item.PIN || '')}">
        </div>
        <div class="field">
          <label>Role</label>
          <input class="admin-employee-role" type="text" value="${escapeHtml(item.Role || '')}">
        </div>
        <div class="field">
          <label>Active</label>
          <select class="admin-employee-active">
            <option value="Yes" ${(String(item.Active || 'Yes') === 'Yes') ? 'selected' : ''}>Yes</option>
            <option value="No" ${(String(item.Active || 'Yes') === 'No') ? 'selected' : ''}>No</option>
          </select>
        </div>
      </div>
    </div>
  `;
}

function paymentMethodRowHtml(item = {}) {
  return `
    <div class="list-item admin-payment-row">
      <div class="form-grid">
        <div class="field">
          <label>Name</label>
          <input class="admin-payment-name" type="text" value="${escapeHtml(item.Name || item.name || item || '')}">
        </div>
        <div class="field">
          <label>Active</label>
          <select class="admin-payment-active">
            <option value="Yes" ${(String(item.Active || item.active || 'Yes') === 'Yes') ? 'selected' : ''}>Yes</option>
            <option value="No" ${(String(item.Active || item.active || 'Yes') === 'No') ? 'selected' : ''}>No</option>
          </select>
        </div>
      </div>
    </div>
  `;
}

function renderAdminLists() {
  const productsWrap = $('productsAdminList');
  const employeesWrap = $('employeesAdminList');
  const paymentWrap = $('paymentMethodsAdminList');

  const products = state.adminData?.products || [];
  const employees = state.adminData?.employees || [];
  const paymentMethods = state.adminData?.paymentMethods || [];

  if (productsWrap) {
    productsWrap.innerHTML = products.length ? products.map(productRowHtml).join('') : productRowHtml();
  }

  if (employeesWrap) {
    employeesWrap.innerHTML = employees.length ? employees.map(employeeRowHtml).join('') : employeeRowHtml();
  }

  if (paymentWrap) {
    paymentWrap.innerHTML = paymentMethods.length ? paymentMethods.map(paymentMethodRowHtml).join('') : paymentMethodRowHtml();
  }
}

function fillAdminFields() {
  const settings = state.adminData?.settings || {};
  const theme = state.adminData?.theme || {};
  const uiText = state.adminData?.uiText || {};

  setValue('settingsPortalName', settings.portalName || '');
  setValue('settingsPortalSubtitle', settings.portalSubtitle || '');
  setValue('settingsAnnouncement', settings.announcement || '');
  setValue('settingsBankId', settings.bankId || '');
  setValue('settingsMileageRate', settings.mileageRate || 0);

  setValue('raffleEnabledSetting', settings.raffleEnabled || 'Yes');
  setValue('raffleMaxOverallSetting', settings.raffleMaxOverall || 0);
  setValue('raffleMaxPerPersonSetting', settings.raffleMaxPerPerson || 0);
  setValue('raffleStartDateSetting', settings.raffleStart || '');
  setValue('raffleEndDateSetting', settings.raffleEnd || '');

  setValue('themePrimary', theme.primary || '#f28c18');
  setValue('themePrimaryDark', theme.primaryDark || '#de7c0c');
  setValue('themeSecondary', theme.secondary || '#6c4330');
  setValue('themeBg', theme.bg || '#fdf4ea');
  setValue('themeCard', theme.card || '#ffffff');
  setValue('themeText', theme.text || '#4a2e22');
  setValue('themeMuted', theme.muted || '#8a6a5a');
  setValue('themeBorder', theme.border || '#edc9a5');

  setValue('uiLogoEmoji', uiText.logoEmoji || '🍩');
  setValue('uiLoginTitle', uiText.loginTitle || '');
  setValue('uiLoginSubtitle', uiText.loginSubtitle || '');
  setValue('uiDashboardTitle', uiText.dashboardTitle || '');
  setValue('uiDashboardSubtitle', uiText.dashboardSubtitle || '');
  setValue('uiPOSTitle', uiText.posTitle || '');
  setValue('uiPOSSubtitle', uiText.posSubtitle || '');
  setValue('uiOrdersTitle', uiText.ordersTitle || '');
  setValue('uiOrdersSubtitle', uiText.ordersSubtitle || '');
  setValue('uiRewardsTitle', uiText.rewardsTitle || '');
  setValue('uiRewardsSubtitle', uiText.rewardsSubtitle || '');
  setValue('uiRaffleTitle', uiText.raffleTitle || '');
  setValue('uiRaffleSubtitle', uiText.raffleSubtitle || '');
  setValue('uiPayrollTitle', uiText.payrollTitle || '');
  setValue('uiPayrollSubtitle', uiText.payrollSubtitle || '');
  setValue('uiSettingsTitle', uiText.settingsTitle || '');
  setValue('uiSettingsSubtitle', uiText.settingsSubtitle || '');
}

async function loadAdminData() {
  if (!state.session || !canViewSettings()) return;

  const result = await api('getAdminData', authPayload({}));
  if (!result.ok) {
    alert(result.message || 'Could not load admin data.');
    return;
  }

  state.adminData = result;
  fillAdminFields();
  renderAdminLists();
}

function collectProductsFromUI() {
  return Array.from(document.querySelectorAll('.admin-product-row')).map(row => ({
    Name: row.querySelector('.admin-product-name')?.value || '',
    Price: Number(row.querySelector('.admin-product-price')?.value || 0),
    Active: row.querySelector('.admin-product-active')?.value || 'Yes'
  })).filter(item => String(item.Name).trim());
}

function collectEmployeesFromUI() {
  return Array.from(document.querySelectorAll('.admin-employee-row')).map(row => ({
    Name: row.querySelector('.admin-employee-name')?.value || '',
    Email: row.querySelector('.admin-employee-email')?.value || '',
    Username: row.querySelector('.admin-employee-username')?.value || '',
    PIN: row.querySelector('.admin-employee-pin')?.value || '',
    Role: row.querySelector('.admin-employee-role')?.value || '',
    Active: row.querySelector('.admin-employee-active')?.value || 'Yes'
  })).filter(item => String(item.Name).trim() || String(item.Email).trim());
}

function collectPaymentMethodsFromUI() {
  return Array.from(document.querySelectorAll('.admin-payment-row')).map(row => ({
    Name: row.querySelector('.admin-payment-name')?.value || '',
    Active: row.querySelector('.admin-payment-active')?.value || 'Yes'
  })).filter(item => String(item.Name).trim());
}

async function saveSettingsNow() {
  const result = await api('saveSettings', authPayload({
    portalName: getValue('settingsPortalName').trim(),
    portalSubtitle: getValue('settingsPortalSubtitle').trim(),
    announcement: getValue('settingsAnnouncement').trim(),
    bankId: getValue('settingsBankId').trim(),
    mileageRate: Number(getValue('settingsMileageRate') || 0)
  }));

  if (result.ok) {
    state.mileageRate = Number(getValue('settingsMileageRate') || 0);
    renderCart();
  }

  alert(result.message || 'Settings saved.');
}

async function saveRaffleSettings() {
  const result = await api('saveRaffleSettings', authPayload({
    enabled: getValue('raffleEnabledSetting'),
    maxOverall: getValue('raffleMaxOverallSetting'),
    maxPer: getValue('raffleMaxPerPersonSetting'),
    start: getValue('raffleStartDateSetting'),
    end: getValue('raffleEndDateSetting')
  }));
  alert(result.message || 'Raffle controls saved.');
}

async function saveThemeNow() {
  const result = await api('saveTheme', authPayload({
    theme: {
      primary: getValue('themePrimary'),
      primaryDark: getValue('themePrimaryDark'),
      secondary: getValue('themeSecondary'),
      bg: getValue('themeBg'),
      card: getValue('themeCard'),
      text: getValue('themeText'),
      muted: getValue('themeMuted'),
      border: getValue('themeBorder')
    }
  }));
  alert(result.message || 'Theme saved.');
}

async function saveUITextNow() {
  const result = await api('saveUIText', authPayload({
    uiText: {
      logoEmoji: getValue('uiLogoEmoji'),
      loginTitle: getValue('uiLoginTitle'),
      loginSubtitle: getValue('uiLoginSubtitle'),
      dashboardTitle: getValue('uiDashboardTitle'),
      dashboardSubtitle: getValue('uiDashboardSubtitle'),
      posTitle: getValue('uiPOSTitle'),
      posSubtitle: getValue('uiPOSSubtitle'),
      ordersTitle: getValue('uiOrdersTitle'),
      ordersSubtitle: getValue('uiOrdersSubtitle'),
      rewardsTitle: getValue('uiRewardsTitle'),
      rewardsSubtitle: getValue('uiRewardsSubtitle'),
      raffleTitle: getValue('uiRaffleTitle'),
      raffleSubtitle: getValue('uiRaffleSubtitle'),
      payrollTitle: getValue('uiPayrollTitle'),
      payrollSubtitle: getValue('uiPayrollSubtitle'),
      settingsTitle: getValue('uiSettingsTitle'),
      settingsSubtitle: getValue('uiSettingsSubtitle')
    }
  }));
  alert(result.message || 'UI text saved.');
}

async function saveProductsNow() {
  const result = await api('saveProducts', authPayload({
    products: collectProductsFromUI()
  }));
  alert(result.message || 'Products saved.');
  if (result.ok) await loadAdminData();
}

async function saveEmployeesNow() {
  const result = await api('saveEmployees', authPayload({
    employees: collectEmployeesFromUI()
  }));
  alert(result.message || 'Employees saved.');
  if (result.ok) await loadAdminData();
}

async function savePaymentMethodsNow() {
  const result = await api('savePaymentMethods', authPayload({
    paymentMethods: collectPaymentMethodsFromUI()
  }));
  alert(result.message || 'Payment methods saved.');
  if (result.ok) await loadAdminData();
}

function addProductRow() {
  const wrap = $('productsAdminList');
  if (wrap) wrap.insertAdjacentHTML('beforeend', productRowHtml());
}

function addEmployeeRow() {
  const wrap = $('employeesAdminList');
  if (wrap) wrap.insertAdjacentHTML('beforeend', employeeRowHtml());
}

function addPaymentMethodRow() {
  const wrap = $('paymentMethodsAdminList');
  if (wrap) wrap.insertAdjacentHTML('beforeend', paymentMethodRowHtml());
}

function wireEvents() {
  $('loginBtn')?.addEventListener('click', loginNow);
  $('logoutBtn')?.addEventListener('click', logoutNow);
  $('portalRefreshBtn')?.addEventListener('click', portalRefreshNow);

  $('submitOrderBtn')?.addEventListener('click', submitOrder);
  $('searchOrdersBtn')?.addEventListener('click', loadOrders);
  $('lookupRewardsBtn')?.addEventListener('click', loadRewards);
  $('drawWinnerBtn')?.addEventListener('click', drawRaffleWinnerNow);
  $('clearWinnerBtn')?.addEventListener('click', clearRaffleWinnerNow);
  $('resetRaffleBtn')?.addEventListener('click', resetRaffleNow);
  $('loadPayrollBtn')?.addEventListener('click', loadPayroll);
  $('saveAdBtn')?.addEventListener('click', saveAd);

  $('saveSettingsBtn')?.addEventListener('click', saveSettingsNow);
  $('saveRaffleSettingsBtn')?.addEventListener('click', saveRaffleSettings);
  $('saveThemeBtn')?.addEventListener('click', saveThemeNow);
  $('saveUITextBtn')?.addEventListener('click', saveUITextNow);
  $('saveProductsBtn')?.addEventListener('click', saveProductsNow);
  $('saveEmployeesBtn')?.addEventListener('click', saveEmployeesNow);
  $('savePaymentMethodsBtn')?.addEventListener('click', savePaymentMethodsNow);

  $('addProductRowBtn')?.addEventListener('click', addProductRow);
  $('addEmployeeRowBtn')?.addEventListener('click', addEmployeeRow);
  $('addPaymentMethodRowBtn')?.addEventListener('click', addPaymentMethodRow);

  $('discountInput')?.addEventListener('input', renderCart);
  $('tipInput')?.addEventListener('input', renderCart);
  $('mileageInput')?.addEventListener('input', renderCart);
  $('amountPaidInput')?.addEventListener('input', renderCart);

  $('loginValue')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') loginNow();
  });

  $('loginPin')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') loginNow();
  });
}

function init() {
  wireEvents();
  renderRewardsBlank();
  renderCart();
  drawRaffleWheel([]);
}

init();
