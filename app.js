const state = {
  apiUrl: localStorage.getItem('sd_api_url') || '',
  session: null,
  bootstrap: null,
  products: [],
  cart: {},
  paymentMethods: ['Cash', 'Invoice', 'Bank ID'],
  activeTab: 'dashboard',
  raffleEntries: [],
  raffleWinner: null,
  wheelRotation: 0,
  wheelSpinning: false
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
  return String(str == null ? '' : str)
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

function requireApiUrl() {
  if (!state.apiUrl) {
    showMessage('loginMsg', 'Paste your Apps Script Web App URL first.', 'error');
    return false;
  }
  return true;
}

async function api(action, payload = {}) {
  if (!state.apiUrl) throw new Error('Missing API URL.');

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

function getRole() {
  return String(state.session?.employee?.role || '').trim().toLowerCase();
}

function getPerms() {
  return state.session?.permissions || {};
}

function isOwnerLike() {
  const perms = getPerms();
  const role = getRole();
  return !!(
    perms.isOwner ||
    perms.isAdmin ||
    role === 'owner' ||
    role === 'admin'
  );
}

function getVisibleTabs() {
  const baseTabs = tabs.filter(tab => !tab.ownerOnly);

  if (!state.session) return baseTabs;

  return tabs.filter(tab => {
    if (!tab.ownerOnly) return true;
    return isOwnerLike();
  });
}

function renderNav() {
  const nav = $('navTabs');
  if (!nav) return;

  let visibleTabs = getVisibleTabs();
  if (!visibleTabs.length) visibleTabs = tabs.filter(tab => !tab.ownerOnly);

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

function activateTab(tabKey) {
  const visibleTabs = getVisibleTabs();
  const allowed = visibleTabs.some(tab => tab.key === tabKey);

  state.activeTab = allowed ? tabKey : (visibleTabs[0]?.key || 'dashboard');
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

  const activeSection = $(sectionMap[state.activeTab]);
  if (activeSection) activeSection.classList.remove('hidden');

  if (state.activeTab === 'raffle') {
    drawRaffleWheel(state.raffleEntries);
  }
}

function updateOwnerUI() {
  if (isOwnerLike()) showEl('ownerOverrideBox');
  else hideEl('ownerOverrideBox');
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

  const items = Object.entries(state.cart)
    .filter(([, qty]) => Number(qty) > 0)
    .map(([name, qty]) => {
      const product = state.products.find(p => p.name === name) || {};
      const price = Number(product.price || 0);
      const quantity = Number(qty || 0);

      return {
        name,
        qty: quantity,
        price,
        total: price * quantity
      };
    });

  if (!items.length) {
    list.innerHTML = '<div class="list-item"><p>Empty cart</p></div>';
  } else {
    list.innerHTML = items.map(item => `
      <div class="list-item">
        <h4>${escapeHtml(item.name)}</h4>
        <p>${item.qty} × ${money(item.price)} = <strong>${money(item.total)}</strong></p>
      </div>
    `).join('');
  }

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

function fillPortalHeader() {
  const settings = state.bootstrap?.settings || {};
  const ui = settings.uiText || {};
  const theme = settings.theme || {};
  const prefs = state.session?.portalPrefs || {};
  const employee = state.session?.employee || {};

  const portalName = settings.portalName || "Sean's Donuts";
  const portalSubtitle = settings.portalSubtitle || 'Employee Portal';
  const announcement = prefs.announcement || settings.announcement || settings.dashboardMessage || "Welcome to Sean's Donuts Portal";
  const bankId = prefs.bankId || settings.bankId || '24596194';
  const logoEmoji = ui.logoEmoji || settings.logoEmoji || '🍩';

  setText('portalName', portalName);
  setText('portalSubtitle', portalSubtitle);
  setText('announcementBar', announcement);
  setText('bankIdText', bankId);
  setText('sessionStatus', state.session ? 'Signed in' : 'Signed out');
  setText('sessionRole', employee.role || 'Employee');
  setText('userBadge', `${employee.name || 'Portal User'}${employee.role ? ` · ${employee.role}` : ''}`);
  setText('welcomeTitle', `Welcome, ${employee.name || 'Employee'}`);

  setText('dashboardPortalName', portalName);
  setText('dashboardPortalSubtitle', portalSubtitle);
  setText('dashboardBankId', bankId);

  setText('loginTitle', ui.loginTitle || portalName);
  setText('loginSubtitle', ui.loginSubtitle || 'Sign in with your username or email and PIN.');

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

  setText('loginLogo', logoEmoji);
  setText('brandLogo', logoEmoji);

  setValue('settingsPortalName', portalName);
  setValue('settingsPortalSubtitle', portalSubtitle);
  setValue('settingsAnnouncement', announcement);
  setValue('settingsBankId', bankId);

  setValue('themePrimary', theme.primary || '#f28c18');
  setValue('themePrimaryDark', theme.primaryDark || '#de7c0c');
  setValue('themeSecondary', theme.secondary || '#6c4330');
  setValue('themeBg', theme.bg || '#fdf4ea');
  setValue('themeCard', theme.card || '#ffffff');
  setValue('themeText', theme.text || '#4a2e22');
  setValue('themeMuted', theme.muted || '#8a6a5a');
  setValue('themeBorder', theme.border || '#edc9a5');

  setValue('uiLogoEmoji', ui.logoEmoji || logoEmoji);
  setValue('uiLoginTitle', ui.loginTitle || portalName);
  setValue('uiLoginSubtitle', ui.loginSubtitle || 'Sign in with your username or email and PIN.');
  setValue('uiDashboardTitle', ui.dashboardTitle || 'Welcome');
  setValue('uiDashboardSubtitle', ui.dashboardSubtitle || 'Portal overview');
  setValue('uiPOSTitle', ui.posTitle || 'POS');
  setValue('uiPOSSubtitle', ui.posSubtitle || 'Create a new order');
  setValue('uiOrdersTitle', ui.ordersTitle || 'Orders');
  setValue('uiOrdersSubtitle', ui.ordersSubtitle || 'Search recent orders');
  setValue('uiRewardsTitle', ui.rewardsTitle || 'Rewards');
  setValue('uiRewardsSubtitle', ui.rewardsSubtitle || 'Lookup customer rewards');
  setValue('uiRaffleTitle', ui.raffleTitle || 'Raffle');
  setValue('uiRaffleSubtitle', ui.raffleSubtitle || 'Recent raffle entries');
  setValue('uiPayrollTitle', ui.payrollTitle || 'Payroll');
  setValue('uiPayrollSubtitle', ui.payrollSubtitle || 'View payroll rows');
  setValue('uiSettingsTitle', ui.settingsTitle || 'Settings');
  setValue('uiSettingsSubtitle', ui.settingsSubtitle || 'Owner/Admin controls');

  applyTheme(theme);
  updateOwnerUI();
}

function renderProductsAdmin() {
  const wrap = $('productsAdminList');
  if (!wrap) return;

  const products = Array.isArray(state.bootstrap?.settings?.products)
    ? state.bootstrap.settings.products
    : Array.isArray(state.products)
      ? state.products
      : [];

  if (!products.length) {
    wrap.innerHTML = '<div class="list-item"><p>No products loaded.</p></div>';
    return;
  }

  wrap.innerHTML = products.map((item, index) => `
    <div class="admin-row" data-product-row="${index}">
      <input type="text" data-product-name value="${escapeHtml(item.name || item.Name || '')}" placeholder="Product Name" />
      <input type="number" min="0" step="0.01" data-product-price value="${escapeHtml(item.price || item.Price || 0)}" placeholder="Price" />
      <button type="button" class="btn btn-danger" data-remove-product="${index}">Remove</button>
    </div>
  `).join('');

  wrap.querySelectorAll('[data-remove-product]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.removeProduct);
      const list = Array.isArray(state.bootstrap?.settings?.products) ? state.bootstrap.settings.products : [];
      list.splice(i, 1);
      renderProductsAdmin();
    });
  });
}

function renderEmployeesAdmin() {
  const wrap = $('employeesAdminList');
  if (!wrap) return;

  const employees = Array.isArray(state.bootstrap?.settings?.employees) ? state.bootstrap.settings.employees : [];

  if (!employees.length) {
    wrap.innerHTML = '<div class="list-item"><p>No employees loaded.</p></div>';
    return;
  }

  wrap.innerHTML = employees.map((item, index) => `
    <div class="admin-row" data-employee-row="${index}">
      <input type="text" data-employee-name value="${escapeHtml(item.name || item.Name || '')}" placeholder="Name" />
      <input type="text" data-employee-email value="${escapeHtml(item.email || item.Email || '')}" placeholder="Email" />
      <input type="text" data-employee-role value="${escapeHtml(item.role || item.Role || '')}" placeholder="Role" />
      <button type="button" class="btn btn-danger" data-remove-employee="${index}">Remove</button>
    </div>
  `).join('');

  wrap.querySelectorAll('[data-remove-employee]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.removeEmployee);
      const list = Array.isArray(state.bootstrap?.settings?.employees) ? state.bootstrap.settings.employees : [];
      list.splice(i, 1);
      renderEmployeesAdmin();
    });
  });
}

function renderPaymentMethodsAdmin() {
  const wrap = $('paymentMethodsAdminList');
  if (!wrap) return;

  const methods = Array.isArray(state.bootstrap?.settings?.paymentMethods)
    ? state.bootstrap.settings.paymentMethods
    : state.paymentMethods;

  if (!methods.length) {
    wrap.innerHTML = '<div class="list-item"><p>No payment methods loaded.</p></div>';
    return;
  }

  wrap.innerHTML = methods.map((item, index) => `
    <div class="admin-row" data-payment-row="${index}">
      <input type="text" data-payment-method value="${escapeHtml(item.Name || item.name || item || '')}" placeholder="Method" />
      <button type="button" class="btn btn-danger" data-remove-payment-method="${index}">Remove</button>
    </div>
  `).join('');

  wrap.querySelectorAll('[data-remove-payment-method]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.removePaymentMethod);
      const list = Array.isArray(state.bootstrap?.settings?.paymentMethods)
        ? state.bootstrap.settings.paymentMethods
        : state.paymentMethods;
      list.splice(i, 1);
      renderPaymentMethodsAdmin();
    });
  });
}

function renderAdminCollections() {
  renderProductsAdmin();
  renderEmployeesAdmin();
  renderPaymentMethodsAdmin();
}

function renderRaffleWinner() {
  const box = $('raffleWinnerBox');
  if (!box) return;

  const winner = state.raffleWinner;

  if (!winner) {
    box.innerHTML = '<div class="list-item"><p>No winner drawn yet.</p></div>';
    return;
  }

  box.innerHTML = `
    <div class="list-item">
      <h4>${escapeHtml(winner.customerName || winner['Customer Name'] || 'Winner')}</h4>
      <p><strong>Discord:</strong> ${escapeHtml(winner.customerDiscord || winner['Customer Discord'] || '—')}</p>
      <p><strong>Phone:</strong> ${escapeHtml(winner.phoneNumber || winner['Phone Number'] || '—')}</p>
      <p><strong>Tickets:</strong> ${Number(winner.ticketsBought || winner['Tickets Bought'] || 0)}</p>
      <p><strong>Order:</strong> ${escapeHtml(winner.orderNumber || winner['Order Number'] || '—')}</p>
    </div>
  `;
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
    ctx.fillStyle = '#f5e5d5';
    ctx.fill();
    ctx.strokeStyle = '#6c4330';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#6c4330';
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
    const label = String(entries[i].customerName || entries[i]['Customer Name'] || `Entry ${i + 1}`);

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
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(label.slice(0, 16), radius - 12, 4);
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

function animateWheelToWinner(entries, winner) {
  if (!entries.length || !winner) return;

  const index = entries.findIndex(entry =>
    String(entry.orderNumber || entry['Order Number'] || '') === String(winner.orderNumber || winner['Order Number'] || '') &&
    String(entry.customerName || entry['Customer Name'] || '') === String(winner.customerName || winner['Customer Name'] || '')
  );

  if (index < 0) {
    drawRaffleWheel(entries);
    return;
  }

  const anglePer = (Math.PI * 2) / entries.length;
  const targetAngle = -(index * anglePer) - (anglePer / 2) - (Math.PI / 2);
  const startRotation = state.wheelRotation || 0;
  const finalRotation = targetAngle - (Math.PI * 8);
  const duration = 3500;
  const startTime = performance.now();

  state.wheelSpinning = true;

  function step(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    state.wheelRotation = startRotation + ((finalRotation - startRotation) * eased);
    drawRaffleWheel(entries);

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      state.wheelSpinning = false;
      state.wheelRotation = finalRotation;
      drawRaffleWheel(entries);
    }
  }

  requestAnimationFrame(step);
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

  state.paymentMethods = methods;

  const paymentMethod = $('paymentMethod');
  if (paymentMethod) {
    paymentMethod.innerHTML = methods.map(method => `
      <option value="${escapeHtml(method.Name || method.name || method)}">${escapeHtml(method.Name || method.name || method)}</option>
    `).join('');
  }

  renderAdminCollections();
}

async function loadBootstrap() {
  const result = await api('getPortalBootstrap');

  if (result.ok === false) {
    throw new Error(result.message || 'Could not load portal data.');
  }

  state.bootstrap = result || {};
  renderBootstrap();
  fillPortalHeader();
}

async function loginNow() {
  if (!requireApiUrl()) return;

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
      showMessage('loginMsg', result.message || 'Login failed.', 'error');
      return;
    }

    state.session = result;
    state.products = Array.isArray(result.products) ? result.products : [];

    await loadBootstrap();

    hideEl('loginView');
    showEl('portalView');

    renderNav();
    activateTab('dashboard');
    buildProductGrid();
    renderCart();

    await Promise.allSettled([
      loadOrders(),
      loadRaffle(),
      loadPayroll()
    ]);

    showMessage('loginMsg', '', 'success');
  } catch (error) {
    showMessage('loginMsg', error.message || 'Login failed.', 'error');
  }
}

function logoutNow() {
  state.session = null;
  state.bootstrap = null;
  state.products = [];
  state.cart = {};
  state.activeTab = 'dashboard';
  state.raffleEntries = [];
  state.raffleWinner = null;
  state.wheelRotation = 0;

  showEl('loginView');
  hideEl('portalView');

  setText('sessionStatus', 'Signed out');
  setText('sessionRole', '—');
  setText('userBadge', 'Portal User');

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
      pin: getValue('loginPin').trim(),
      customerName: getValue('customerName').trim(),
      customerDiscord: getValue('customerDiscord').trim(),
      phoneNumber: getValue('phoneNumber').trim(),
      mileage: Number(getValue('mileageInput', 0) || 0),
      amountPaid: Number(getValue('amountPaidInput', 0) || 0),
      discount: Number(getValue('discountInput', 0) || 0),
      tip: Number(getValue('tipInput', 0) || 0),
      paymentMethod: getValue('paymentMethod'),
      notes: getValue('notes').trim(),
      items
    };

    const result = await api('submitOrder', payload);

    if (!result.ok) {
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
    showMessage('orderMsg', result.message || 'Order submitted.', 'success');

    await Promise.allSettled([
      loadOrders(),
      loadBootstrap(),
      loadRaffle()
    ]);
  } catch (error) {
    showMessage('orderMsg', error.message || 'Order failed.', 'error');
  }
}

async function loadOrders() {
  if (!state.session) return;

  const list = $('ordersList');
  if (list) list.innerHTML = '<div class="list-item"><p>Loading orders...</p></div>';

  try {
    const result = await api('searchOrders', {
      email: state.session.employee?.email || state.session.employee?.username || '',
      pin: getValue('loginPin').trim(),
      query: getValue('orderSearchInput').trim()
    });

    const rows = result.results || result.orders || [];

    if (!list) return;

    list.innerHTML = rows.length
      ? rows.map(row => `
          <div class="list-item">
            <h4>${escapeHtml(row.orderNumber || row['Order Number'] || 'Order')}</h4>
            <p>${escapeHtml(row.customerName || row['Customer Name'] || 'No customer')} · ${money(row.total || row.Total || 0)}</p>
          </div>
        `).join('')
      : '<div class="list-item"><p>No orders loaded.</p></div>';
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
    showMessage('rewardsMsg', 'Enter a customer name.', 'error');
    return;
  }

  if (!silent) showMessage('rewardsMsg', 'Loading rewards...', 'info');

  try {
    const result = await api('lookupRewards', {
      email: state.session.employee?.email || state.session.employee?.username || '',
      pin: getValue('loginPin').trim(),
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
    if (!silent) showMessage('rewardsMsg', error.message || 'Could not load rewards.', 'error');
  }
}

async function loadRaffle() {
  if (!state.session) return;

  const list = $('raffleList');
  if (list) list.innerHTML = '<div class="list-item"><p>Loading raffle...</p></div>';

  try {
    const result = await api('loadRaffleOverview', {
      email: state.session.employee?.email || state.session.employee?.username || '',
      pin: getValue('loginPin').trim()
    });

    const rows = result.entries || result.results || [];
    state.raffleEntries = rows;
    state.raffleWinner = result.winner || null;

    renderRaffleWinner();
    drawRaffleWheel(rows);

    if (!list) return;

    list.innerHTML = rows.length
      ? rows.map(row => `
          <div class="list-item">
            <h4>${escapeHtml(row.customerName || row['Customer Name'] || 'Entry')}</h4>
            <p><strong>Discord:</strong> ${escapeHtml(row.customerDiscord || row['Customer Discord'] || '—')}</p>
            <p><strong>Phone:</strong> ${escapeHtml(row.phoneNumber || row['Phone Number'] || '—')}</p>
            <p><strong>Tickets:</strong> ${Number(row.ticketsBought || row['Tickets Bought'] || 0)}</p>
            <p><strong>Order:</strong> ${escapeHtml(row.orderNumber || row['Order Number'] || '—')}</p>
          </div>
        `).join('')
      : '<div class="list-item"><p>No raffle entries loaded.</p></div>';
  } catch (error) {
    if (list) {
      list.innerHTML = `<div class="list-item"><p>${escapeHtml(error.message || 'Could not load raffle.')}</p></div>`;
    }
  }
}

async function drawRaffleWinnerNow() {
  if (!state.session || state.wheelSpinning) return;

  showMessage('raffleMsg', 'Drawing winner...', 'info');

  try {
    const result = await api('drawRaffleWinner', {
      email: state.session.employee?.email || state.session.employee?.username || '',
      pin: getValue('loginPin').trim()
    });

    if (!result.ok) {
      showMessage('raffleMsg', result.message || 'Could not draw winner.', 'error');
      return;
    }

    state.raffleWinner = result.winner || null;
    renderRaffleWinner();

    if (state.raffleEntries.length && state.raffleWinner) {
      animateWheelToWinner(state.raffleEntries, state.raffleWinner);
    }

    showMessage('raffleMsg', result.message || 'Winner drawn.', 'success');
  } catch (error) {
    showMessage('raffleMsg', error.message || 'Could not draw winner.', 'error');
  }
}

async function clearRaffleWinnerNow() {
  if (!state.session) return;

  showMessage('raffleMsg', 'Clearing winner...', 'info');

  try {
    const result = await api('clearRaffleWinner', {
      email: state.session.employee?.email || state.session.employee?.username || '',
      pin: getValue('loginPin').trim()
    });

    if (!result.ok) {
      showMessage('raffleMsg', result.message || 'Could not clear winner.', 'error');
      return;
    }

    state.raffleWinner = null;
    renderRaffleWinner();
    showMessage('raffleMsg', result.message || 'Winner cleared.', 'success');
  } catch (error) {
    showMessage('raffleMsg', error.message || 'Could not clear winner.', 'error');
  }
}

async function loadPayroll() {
  if (!state.session) return;

  const list = $('payrollList');
  if (list) list.innerHTML = '<div class="list-item"><p>Loading payroll...</p></div>';

  try {
    const result = await api('loadPayroll', {
      email: state.session.employee?.email || state.session.employee?.username || '',
      pin: getValue('loginPin').trim(),
      startDate: getValue('payrollStartDate'),
      endDate: getValue('payrollEndDate')
    });

    const rows = result.results || result.rows || [];

    if (!list) return;

    list.innerHTML = rows.length
      ? rows.map(row => `
          <div class="list-item">
            <h4>${escapeHtml(row.employee || row.name || 'Employee')}</h4>
            <p>Total Pay: ${money(row.totalPay || row['Total Pay'] || 0)} · Orders: ${Number(row.orders || row['Orders'] || 0)}</p>
          </div>
        `).join('')
      : '<div class="list-item"><p>No payroll rows loaded.</p></div>';
  } catch (error) {
    if (list) {
      list.innerHTML = `<div class="list-item"><p>${escapeHtml(error.message || 'Could not load payroll.')}</p></div>`;
    }
  }
}

function collectProductsAdmin() {
  return Array.from(document.querySelectorAll('#productsAdminList [data-product-row]'))
    .map(row => ({
      name: row.querySelector('[data-product-name]')?.value?.trim() || '',
      price: Number(row.querySelector('[data-product-price]')?.value || 0)
    }))
    .filter(item => item.name);
}

function collectEmployeesAdmin() {
  return Array.from(document.querySelectorAll('#employeesAdminList [data-employee-row]'))
    .map(row => ({
      name: row.querySelector('[data-employee-name]')?.value?.trim() || '',
      email: row.querySelector('[data-employee-email]')?.value?.trim() || '',
      role: row.querySelector('[data-employee-role]')?.value?.trim() || ''
    }))
    .filter(item => item.name || item.email);
}

function collectPaymentMethodsAdmin() {
  return Array.from(document.querySelectorAll('#paymentMethodsAdminList [data-payment-row]'))
    .map(row => row.querySelector('[data-payment-method]')?.value?.trim() || '')
    .filter(Boolean);
}

async function saveSettings() {
  if (!state.session) return;

  showMessage('settingsMsg', 'Saving...', 'info');

  try {
    const payload = {
      email: state.session.employee?.email || state.session.employee?.username || '',
      pin: getValue('loginPin').trim(),
      portalName: getValue('settingsPortalName').trim(),
      portalSubtitle: getValue('settingsPortalSubtitle').trim(),
      announcement: getValue('settingsAnnouncement').trim(),
      bankId: getValue('settingsBankId').trim()
    };

    const result = await api('saveSettings', payload);

    if (!result.ok) throw new Error(result.message || 'Could not save settings.');

    showMessage('settingsMsg', result.message || 'Saved.', 'success');
    await loadBootstrap();
  } catch (error) {
    showMessage('settingsMsg', error.message || 'Could not save settings.', 'error');
  }
}

async function saveTheme() {
  if (!state.session) return;

  showMessage('themeMsg', 'Saving...', 'info');

  try {
    const payload = {
      email: state.session.employee?.email || state.session.employee?.username || '',
      pin: getValue('loginPin').trim(),
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
    };

    const result = await api('saveTheme', payload);

    if (!result.ok) throw new Error(result.message || 'Could not save theme.');

    applyTheme(payload.theme);
    showMessage('themeMsg', result.message || 'Saved.', 'success');
    await loadBootstrap();
  } catch (error) {
    showMessage('themeMsg', error.message || 'Could not save theme.', 'error');
  }
}

async function saveUIText() {
  if (!state.session) return;

  showMessage('uiTextMsg', 'Saving...', 'info');

  try {
    const payload = {
      email: state.session.employee?.email || state.session.employee?.username || '',
      pin: getValue('loginPin').trim(),
      uiText: {
        logoEmoji: getValue('uiLogoEmoji').trim(),
        loginTitle: getValue('uiLoginTitle').trim(),
        loginSubtitle: getValue('uiLoginSubtitle').trim(),
        dashboardTitle: getValue('uiDashboardTitle').trim(),
        dashboardSubtitle: getValue('uiDashboardSubtitle').trim(),
        posTitle: getValue('uiPOSTitle').trim(),
        posSubtitle: getValue('uiPOSSubtitle').trim(),
        ordersTitle: getValue('uiOrdersTitle').trim(),
        ordersSubtitle: getValue('uiOrdersSubtitle').trim(),
        rewardsTitle: getValue('uiRewardsTitle').trim(),
        rewardsSubtitle: getValue('uiRewardsSubtitle').trim(),
        raffleTitle: getValue('uiRaffleTitle').trim(),
        raffleSubtitle: getValue('uiRaffleSubtitle').trim(),
        payrollTitle: getValue('uiPayrollTitle').trim(),
        payrollSubtitle: getValue('uiPayrollSubtitle').trim(),
        settingsTitle: getValue('uiSettingsTitle').trim(),
        settingsSubtitle: getValue('uiSettingsSubtitle').trim()
      }
    };

    const result = await api('saveUIText', payload);

    if (!result.ok) throw new Error(result.message || 'Could not save UI text.');

    showMessage('uiTextMsg', result.message || 'Saved.', 'success');
    await loadBootstrap();
  } catch (error) {
    showMessage('uiTextMsg', error.message || 'Could not save UI text.', 'error');
  }
}

async function saveProducts() {
  if (!state.session) return;

  showMessage('productsMsg', 'Saving...', 'info');

  try {
    const payload = {
      email: state.session.employee?.email || state.session.employee?.username || '',
      pin: getValue('loginPin').trim(),
      products: collectProductsAdmin()
    };

    const result = await api('saveProducts', payload);

    if (!result.ok) throw new Error(result.message || 'Could not save products.');

    showMessage('productsMsg', result.message || 'Saved.', 'success');
    state.products = payload.products;
    buildProductGrid();
    renderCart();
    await loadBootstrap();
  } catch (error) {
    showMessage('productsMsg', error.message || 'Could not save products.', 'error');
  }
}

async function saveEmployees() {
  if (!state.session) return;

  showMessage('employeesMsg', 'Saving...', 'info');

  try {
    const payload = {
      email: state.session.employee?.email || state.session.employee?.username || '',
      pin: getValue('loginPin').trim(),
      employees: collectEmployeesAdmin()
    };

    const result = await api('saveEmployees', payload);

    if (!result.ok) throw new Error(result.message || 'Could not save employees.');

    showMessage('employeesMsg', result.message || 'Saved.', 'success');
    await loadBootstrap();
  } catch (error) {
    showMessage('employeesMsg', error.message || 'Could not save employees.', 'error');
  }
}

async function savePaymentMethods() {
  if (!state.session) return;

  showMessage('paymentMethodsMsg', 'Saving...', 'info');

  try {
    const payload = {
      email: state.session.employee?.email || state.session.employee?.username || '',
      pin: getValue('loginPin').trim(),
      paymentMethods: collectPaymentMethodsAdmin()
    };

    const result = await api('savePaymentMethods', payload);

    if (!result.ok) throw new Error(result.message || 'Could not save payment methods.');

    showMessage('paymentMethodsMsg', result.message || 'Saved.', 'success');
    await loadBootstrap();
  } catch (error) {
    showMessage('paymentMethodsMsg', error.message || 'Could not save payment methods.', 'error');
  }
}

function addProductRow() {
  if (!state.bootstrap) state.bootstrap = {};
  if (!state.bootstrap.settings) state.bootstrap.settings = {};
  if (!Array.isArray(state.bootstrap.settings.products)) state.bootstrap.settings.products = [];
  state.bootstrap.settings.products.push({ name: '', price: 0 });
  renderProductsAdmin();
}

function addEmployeeRow() {
  if (!state.bootstrap) state.bootstrap = {};
  if (!state.bootstrap.settings) state.bootstrap.settings = {};
  if (!Array.isArray(state.bootstrap.settings.employees)) state.bootstrap.settings.employees = [];
  state.bootstrap.settings.employees.push({ name: '', email: '', role: '' });
  renderEmployeesAdmin();
}

function addPaymentMethodRow() {
  if (!state.bootstrap) state.bootstrap = {};
  if (!state.bootstrap.settings) state.bootstrap.settings = {};
  if (!Array.isArray(state.bootstrap.settings.paymentMethods)) state.bootstrap.settings.paymentMethods = [];
  state.bootstrap.settings.paymentMethods.push('');
  renderPaymentMethodsAdmin();
}

function setDefaultDates() {
  const start = $('payrollStartDate');
  const end = $('payrollEndDate');
  if (!start || !end) return;

  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);

  start.value = first.toISOString().slice(0, 10);
  end.value = today.toISOString().slice(0, 10);
}

function wireEvents() {
  $('loginBtn')?.addEventListener('click', loginNow);
  $('logoutBtn')?.addEventListener('click', logoutNow);

  $('submitOrderBtn')?.addEventListener('click', submitOrder);
  $('searchOrdersBtn')?.addEventListener('click', loadOrders);
  $('lookupRewardsBtn')?.addEventListener('click', () => loadRewards(false));
  $('loadPayrollBtn')?.addEventListener('click', loadPayroll);
  $('drawWinnerBtn')?.addEventListener('click', drawRaffleWinnerNow);
  $('clearWinnerBtn')?.addEventListener('click', clearRaffleWinnerNow);

  $('saveSettingsBtn')?.addEventListener('click', saveSettings);
  $('saveThemeBtn')?.addEventListener('click', saveTheme);
  $('saveUITextBtn')?.addEventListener('click', saveUIText);
  $('saveProductsBtn')?.addEventListener('click', saveProducts);
  $('saveEmployeesBtn')?.addEventListener('click', saveEmployees);
  $('savePaymentMethodsBtn')?.addEventListener('click', savePaymentMethods);

  $('addProductRowBtn')?.addEventListener('click', addProductRow);
  $('addEmployeeRowBtn')?.addEventListener('click', addEmployeeRow);
  $('addPaymentMethodRowBtn')?.addEventListener('click', addPaymentMethodRow);

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
  renderNav();
  wireEvents();
  setDefaultDates();
  activateTab('dashboard');
  renderCart();
  drawRaffleWheel([]);
}

init();
