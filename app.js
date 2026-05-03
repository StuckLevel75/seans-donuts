const SD_API_URL = 'https://script.google.com/macros/s/AKfycbw8QmZ4jl1ym9RwOlqP5_9XVgQNxAZiyMkA9YVYT9ag4dM-BPHaurTIw0aULBJDL5Xvwg/exec';

const state = {
  apiUrl: SD_API_URL || localStorage.getItem('sd_api_url') || '',
  session: null,
  sessionPin: '',
  bootstrap: null,
  adminData: null,
  products: [],
  cart: {},
  paymentMethods: ['Cash', 'Invoice', 'Bank ID'],
  activeTab: 'dashboard',
  loaded: {}
};

const tabs = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'pos', label: 'POS', permission: 'canUsePOS' },
  { key: 'orders', label: 'Orders', permission: 'canViewOrders' },
  { key: 'rewards', label: 'Rewards', permission: 'canViewRewards' },
  { key: 'raffle', label: 'Raffle', permission: 'canViewRaffle' },
  { key: 'ads', label: 'Ads', anyPermission: ['canManageAds', 'isOwner'] },
  { key: 'payroll', label: 'Payroll', permission: 'canViewPayroll' },
  { key: 'employees', label: 'Employees', anyPermission: ['canManageEmployees', 'isOwner'] },
  { key: 'permissions', label: 'Permissions', anyPermission: ['canManagePermissions', 'isOwner'] },
  { key: 'settings', label: 'Settings', anyPermission: ['canViewSettings', 'isOwner'] }
];

function $(id) {
  return document.getElementById(id);
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
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

function showLoading(title = 'Loading', text = 'Please wait') {
  setText('loadingTitle', title);
  setText('loadingText', text);
  showEl('loadingOverlay');
}

function hideLoading() {
  hideEl('loadingOverlay');
}

function showToast(message, type = 'info') {
  const text = String(message || '').trim();
  if (!text) return;

  let wrap = $('toastContainer');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toastContainer';
    wrap.className = 'toast-container';
    document.body.appendChild(wrap);
  }

  const toast = document.createElement('div');
  toast.className = `toast-message toast-${type}`;
  toast.textContent = text;
  wrap.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add('toast-hide');
    window.setTimeout(() => toast.remove(), 250);
  }, 2600);
}

window.alert = message => showToast(message);

function getPerms() {
  return state.session?.permissions || {};
}

function getEmployee() {
  return state.session?.employee || {};
}

function getRole() {
  return String(getEmployee().role || '').trim().toLowerCase();
}

function hasAnyPermission(keys) {
  const perms = getPerms();
  return keys.some(key => perms[key]);
}

function canAccessTab(tab) {
  if (!tab.permission && !tab.anyPermission) return true;
  const perms = getPerms();
  if (tab.permission && perms[tab.permission]) return true;
  if (tab.anyPermission && hasAnyPermission(tab.anyPermission)) return true;
  return getRole() === 'owner';
}

function getVisibleTabs() {
  return tabs.filter(canAccessTab);
}

function authPayload(extra = {}) {
  const employee = getEmployee();
  return {
    email: employee.email || '',
    username: employee.username || '',
    pin: state.sessionPin,
    ...extra
  };
}

async function api(action, payload = {}) {
  const apiUrl = String(state.apiUrl || '').trim();
  if (!apiUrl) throw new Error('The portal API URL has not been set yet.');

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload })
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('The API did not return JSON. Check your Apps Script deployment URL.');
  }
}

function renderNav() {
  const nav = $('navTabs');
  if (!nav) return;

  const visibleTabs = getVisibleTabs();
  if (!visibleTabs.some(tab => tab.key === state.activeTab)) {
    state.activeTab = visibleTabs[0]?.key || 'dashboard';
  }

  nav.innerHTML = visibleTabs.map(tab => `
    <button type="button" class="nav-btn ${state.activeTab === tab.key ? 'active' : ''}" data-tab="${escapeHtml(tab.key)}">
      ${escapeHtml(tab.label)}
    </button>
  `).join('');

  nav.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => openTab(btn.dataset.tab));
  });
}

function openTab(tabKey) {
  const tab = tabs.find(item => item.key === tabKey);
  if (!tab || !canAccessTab(tab)) tabKey = 'dashboard';

  state.activeTab = tabKey;
  document.querySelectorAll('.page-panel').forEach(panel => panel.classList.add('hidden'));
  $(`${tabKey}Section`)?.classList.remove('hidden');
  renderNav();

  if (tabKey === 'orders') loadOrders();
  if (tabKey === 'raffle') loadRaffleOverview();
  if (tabKey === 'ads') loadAds();
  if (tabKey === 'payroll') loadPayroll();
  if (tabKey === 'employees') loadAdminData();
  if (tabKey === 'permissions') loadRolePermissions();
  if (tabKey === 'settings') loadAdminData();
}

function fillHeader() {
  const employee = getEmployee();
  const settings = state.bootstrap?.settings || {};
  const ui = settings.uiText || {};
  const theme = settings.theme || {};
  const prefs = state.session?.portalPrefs || {};

  const portalName = settings.portalName || "Sean's Donuts";
  const portalSubtitle = settings.portalSubtitle || 'Employee Portal';
  const bankId = prefs.bankId || settings.bankId || '24596194';
  const announcement = prefs.announcement || settings.announcement || "Welcome to Sean's Donuts Portal";
  const logoEmoji = ui.logoEmoji || '🍩';

  setText('portalName', portalName);
  setText('portalSubtitle', portalSubtitle);
  setText('announcementBar', announcement);
  setText('bankIdText', bankId);
  setText('sessionRole', employee.role || '');
  setText('userBadge', `Hello, ${employee.name || 'User'}`);

  setText('loginLogo', logoEmoji);
  setText('brandLogo', logoEmoji);
  setText('loginTitle', ui.loginTitle || portalName);
  setText('loginSubtitle', ui.loginSubtitle || 'Sign in with your username or email and PIN.');

  setText('welcomeTitle', ui.dashboardTitle || `Welcome, ${employee.name || 'Employee'}`);
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

  applyTheme(theme);
}

function applyTheme(theme = {}) {
  const root = document.documentElement;
  const keys = {
    primary: '--primary',
    primaryDark: '--primary-dark',
    secondary: '--secondary',
    bg: '--bg',
    card: '--card',
    text: '--text',
    muted: '--muted',
    border: '--border'
  };

  Object.keys(keys).forEach(key => {
    if (theme[key]) root.style.setProperty(keys[key], theme[key]);
  });
}

function renderBootstrap() {
  const stats = state.bootstrap?.stats || {};
  const settings = state.bootstrap?.settings || {};
  const announcements = state.bootstrap?.announcements || [];

  state.products = Array.isArray(state.bootstrap?.products)
    ? state.bootstrap.products
    : Array.isArray(settings.products)
      ? settings.products
      : [];

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
    paymentMethod.innerHTML = `
      <option value="">Choose payment method</option>
      ${methods.map(method => `
        <option value="${escapeHtml(method)}">${escapeHtml(method)}</option>
      `).join('')}
    `;
  }
}

function productName(product) {
  return product?.Name || product?.name || 'Product';
}

function productPrice(product) {
  return Number(product?.Price || product?.price || 0);
}

function buildProducts() {
  const grid = $('productGrid');
  if (!grid) return;

  if (!Array.isArray(state.products) || !state.products.length) {
    grid.innerHTML = '<div class="list-item"><p>No products yet.</p></div>';
    return;
  }

  grid.innerHTML = state.products.map((product, index) => {
    const name = productName(product);
    const qty = state.cart[name] || 0;

    return `
      <div class="product-card">
        <h4>${escapeHtml(name)}</h4>
        <div class="product-price">${money(productPrice(product))}</div>
        <div class="qty-row">
          <button type="button" data-action="remove" data-index="${index}">-</button>
          <span class="qty-pill">${qty}</span>
          <button type="button" data-action="add" data-index="${index}">+</button>
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

function addToCart(index) {
  const product = state.products[index];
  if (!product) return;

  const name = productName(product);
  state.cart[name] = (state.cart[name] || 0) + 1;
  buildProducts();
  renderCart();
}

function removeFromCart(index) {
  const product = state.products[index];
  if (!product) return;

  const name = productName(product);
  if (!state.cart[name]) return;

  state.cart[name] -= 1;
  if (state.cart[name] <= 0) delete state.cart[name];
  buildProducts();
  renderCart();
}

function getCartLines() {
  return Object.entries(state.cart).map(([name, qty]) => {
    const product = state.products.find(item => productName(item) === name) || {};
    const price = productPrice(product);
    return { name, qty, price, lineTotal: qty * price };
  });
}

function getActiveSale() {
  const settings = state.bootstrap?.settings || {};
  const enabled = String(settings.saleEnabled || 'No').trim().toLowerCase() === 'yes';
  const percent = Math.max(0, Math.min(100, Number(settings.salePercent || 0)));

  if (!enabled || percent <= 0) {
    return { active: false, percent: 0 };
  }

  const now = Date.now();
  const startText = String(settings.saleStart || '').trim();
  const endText = String(settings.saleEnd || '').trim();
  const start = startText ? new Date(startText).getTime() : NaN;
  const end = endText ? new Date(endText).getTime() : NaN;

  if (!Number.isNaN(start) && now < start) return { active: false, percent };
  if (!Number.isNaN(end) && now > end) return { active: false, percent };

  return { active: true, percent };
}

function calculateCheckoutTotals() {
  const lines = getCartLines();
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const mileage = Number(getValue('mileageInput') || 0);
  const amountPaid = Number(getValue('amountPaidInput') || 0);
  const sale = getActiveSale();
  const saleDiscount = sale.active ? Math.min(subtotal, subtotal * (sale.percent / 100)) : 0;
  const dueBeforeTip = Math.max(0, subtotal - saleDiscount + mileage);
  const tip = Math.max(0, amountPaid - dueBeforeTip);
  const total = dueBeforeTip + tip;

  return {
    lines,
    subtotal,
    mileage,
    amountPaid,
    sale,
    saleDiscount,
    dueBeforeTip,
    tip,
    total
  };
}

function renderCart() {
  const list = $('cartList');
  if (!list) return;

  const totals = calculateCheckoutTotals();
  const lines = totals.lines;
  if (!lines.length) {
    list.innerHTML = '<div class="list-item"><p>Empty cart</p></div>';
  } else {
    list.innerHTML = lines.map(line => `
      <div class="list-item">
        <h4>${escapeHtml(line.name)}</h4>
        <p>${line.qty} x ${money(line.price)} = ${money(line.lineTotal)}</p>
      </div>
    `).join('');
  }

  setText('subtotalText', money(totals.subtotal));
  setText('mileageText', money(totals.mileage));
  setText('saleLabelText', totals.sale.active ? `Sale (${totals.sale.percent}% off)` : 'Sale');
  setText('saleText', money(totals.saleDiscount));
  setText('tipText', money(totals.tip));
  setText('amountPaidText', money(totals.amountPaid));
  setText('totalText', money(totals.total));
  updateRaffleContactFields();
}

function clearCart() {
  state.cart = {};
  buildProducts();
  renderCart();
}

function hasRaffleTicket() {
  return Object.keys(state.cart).some(name => name.toLowerCase().includes('raffle'));
}

function updateRaffleContactFields() {
  const requiresContact = hasRaffleTicket();

  document.querySelectorAll('.raffle-contact-field').forEach(el => {
    el.classList.toggle('hidden', !requiresContact);
  });

  ['customerDiscord', 'phoneNumber'].forEach(id => {
    const el = $(id);
    if (!el) return;

    el.required = requiresContact;
    if (!requiresContact) el.value = '';
  });
}

async function submitOrder() {
  const items = getCartLines().map(line => ({ name: line.name, qty: line.qty }));
  if (!items.length) {
    alert('Add at least one item.');
    return;
  }

  const customerName = getValue('customerName').trim();
  const customerDiscord = getValue('customerDiscord').trim();
  const phoneNumber = getValue('phoneNumber').trim();

  if (hasRaffleTicket() && (!customerDiscord || !phoneNumber)) {
    alert('Discord and Phone are required for raffle tickets.');
    return;
  }

  const paymentMethod = getValue('paymentMethod').trim();
  if (!paymentMethod) {
    alert('Choose a payment method.');
    return;
  }

  showLoading('Submitting', 'Saving order...');
  try {
    const res = await api('submitOrder', authPayload({
      items,
      customerName,
      customerDiscord,
      phoneNumber,
      mileage: Number(getValue('mileageInput') || 0),
      amountPaid: Number(getValue('amountPaidInput') || 0),
      paymentMethod,
      notes: getValue('notes')
    }));

    if (!res.ok) {
      alert(res.message || 'Order failed.');
      return;
    }

    alert(res.message || 'Order submitted.');
    clearCart();
    ['customerName', 'customerDiscord', 'phoneNumber', 'mileageInput', 'amountPaidInput', 'notes'].forEach(id => setValue(id, ''));
    setValue('paymentMethod', '');
    await refreshBootstrap(false);
  } catch (err) {
    alert(err.message || 'Order failed.');
  } finally {
    hideLoading();
  }
}

async function refreshBootstrap(showOverlay = true) {
  if (showOverlay) showLoading('Refreshing', 'Reloading portal...');

  try {
    const boot = await api('getPortalBootstrap', state.session ? authPayload() : {});
    if (!boot.ok) {
      alert(boot.message || 'Refresh failed.');
      return false;
    }

    state.bootstrap = boot;
    fillHeader();
    renderBootstrap();
    renderNav();
    buildProducts();
    renderCart();
    return true;
  } catch (err) {
    alert(err.message || 'Refresh failed.');
    return false;
  } finally {
    if (showOverlay) hideLoading();
  }
}

async function portalRefreshNow() {
  const ok = await refreshBootstrap(true);
  if (ok && (state.activeTab === 'settings' || state.activeTab === 'employees')) await loadAdminData();
}

async function loginNow() {
  const loginValue = getValue('loginValue').trim();
  const pin = getValue('loginPin').trim();

  if (!state.apiUrl) {
    alert('The portal API URL has not been set yet.');
    return;
  }

  if (!loginValue || !pin) {
    alert('Enter your username/email and PIN.');
    return;
  }

  showLoading('Logging In', 'Checking access...');
  try {
    const res = await api('login', { loginValue, email: loginValue, username: loginValue, pin });
    if (!res.ok) {
      alert(res.message || 'Login failed.');
      return;
    }

    state.session = res;
    state.sessionPin = pin;
    state.products = Array.isArray(res.products) ? res.products : [];

    if (res.bootstrap && res.bootstrap.ok) {
      state.bootstrap = res.bootstrap;
      fillHeader();
      renderBootstrap();
      renderNav();
      buildProducts();
      renderCart();
    } else {
      const ok = await refreshBootstrap(false);
      if (!ok) return;
    }

    hideEl('loginView');
    showEl('portalView');
    state.activeTab = 'dashboard';
    openTab('dashboard');
  } catch (err) {
    alert(err.message || 'Login failed.');
  } finally {
    hideLoading();
  }
}

function logoutNow() {
  state.session = null;
  state.sessionPin = '';
  state.bootstrap = null;
  state.adminData = null;
  state.products = [];
  state.cart = {};
  state.loaded = {};
  state.activeTab = 'dashboard';

  setValue('loginPin', '');
  showEl('loginView');
  hideEl('portalView');
}

async function loadOrders(query = getValue('orderSearchInput')) {
  const list = $('ordersList');
  if (list) list.innerHTML = '<div class="list-item"><p>Loading orders...</p></div>';

  try {
    const res = await api('searchOrders', authPayload({ query }));
    if (!res.ok) {
      if (list) list.innerHTML = `<div class="list-item"><p>${escapeHtml(res.message || 'Could not load orders.')}</p></div>`;
      return;
    }

    renderOrders(res.results || []);
  } catch (err) {
    if (list) list.innerHTML = `<div class="list-item"><p>${escapeHtml(err.message || 'Could not load orders.')}</p></div>`;
  }
}

function renderOrders(rows) {
  const list = $('ordersList');
  if (!list) return;

  if (!rows.length) {
    list.innerHTML = '<div class="list-item"><p>No orders found.</p></div>';
    return;
  }

  list.innerHTML = rows.map(row => `
    <div class="list-item">
      <h4>${escapeHtml(row['Order Number'] || 'Order')}</h4>
      <p>${escapeHtml(row['Customer Name'] || 'No customer')} · ${money(row.Total)}</p>
      <div class="item-meta">
        <span>${escapeHtml(formatDate(row.Timestamp))}</span>
        <span>${escapeHtml(row['Payment Method'] || '')}</span>
        <span>${escapeHtml(row['Employee Name'] || '')}</span>
        <span>${escapeHtml(row['Phone Number'] || '')}</span>
      </div>
    </div>
  `).join('');
}

async function lookupRewards() {
  const customerName = getValue('rewardCustomerName').trim();
  if (!customerName) {
    alert('Enter a customer name.');
    return;
  }

  const wrap = $('rewardsResult');
  if (wrap) wrap.innerHTML = '<div class="list-item"><p>Looking up rewards...</p></div>';

  try {
    const res = await api('lookupRewards', authPayload({ customerName }));
    if (!res.ok) {
      if (wrap) wrap.innerHTML = `<div class="list-item"><p>${escapeHtml(res.message || 'Lookup failed.')}</p></div>`;
      return;
    }

    const reward = res.reward || {};
    if (wrap) {
      wrap.innerHTML = `
        <div class="list-item">
          <h4>${escapeHtml(customerName)}</h4>
          <p>Visits: ${Number(reward.visits || 0)} · Progress: ${Number(reward.visitProgress || 0)}/10 · Available: ${Number(reward.rewardsAvailable || 0)}</p>
          <div class="item-meta">
            <span>Redeemed: ${Number(reward.totalRewardsRedeemed || 0)}</span>
            <span>Last visit: ${escapeHtml(formatDate(reward.lastVisit))}</span>
            <span>Last order: ${escapeHtml(reward.lastOrderNumber || '-')}</span>
          </div>
        </div>
      `;
    }
  } catch (err) {
    if (wrap) wrap.innerHTML = `<div class="list-item"><p>${escapeHtml(err.message || 'Lookup failed.')}</p></div>`;
  }
}

async function loadRaffleOverview() {
  const list = $('raffleEntriesList');
  if (list) list.innerHTML = '<div class="list-item"><p>Loading raffle...</p></div>';

  if (getPerms().isOwner || getRole() === 'owner') showEl('resetRaffleBtn');
  else hideEl('resetRaffleBtn');

  try {
    const res = await api('loadRaffleOverview', authPayload());
    if (!res.ok) {
      if (list) list.innerHTML = `<div class="list-item"><p>${escapeHtml(res.message || 'Could not load raffle.')}</p></div>`;
      return;
    }

    renderRaffle(res.entries || [], res.winner || null);
  } catch (err) {
    if (list) list.innerHTML = `<div class="list-item"><p>${escapeHtml(err.message || 'Could not load raffle.')}</p></div>`;
  }
}

function renderRaffle(entries, winner) {
  const winnerBox = $('raffleWinner');
  const list = $('raffleEntriesList');

  if (winnerBox) {
    winnerBox.innerHTML = winner
      ? `<h4>Current Winner</h4><p>${escapeHtml(winner.customerName)} · ${escapeHtml(winner.customerDiscord)} · ${escapeHtml(winner.phoneNumber)} · ${Number(winner.ticketsBought || 0)} tickets</p>`
      : '<h4>Current Winner</h4><p>No winner drawn yet.</p>';
  }

  if (!list) return;
  if (!entries.length) {
    list.innerHTML = '<div class="list-item"><p>No raffle entries yet.</p></div>';
    return;
  }

  list.innerHTML = entries.map(entry => `
    <div class="list-item">
      <h4>${escapeHtml(entry.customerName || 'Customer')}</h4>
      <p>${Number(entry.ticketsBought || 0)} tickets · ${escapeHtml(entry.orderNumber || '')}</p>
      <div class="item-meta">
        <span>${escapeHtml(entry.customerDiscord || '')}</span>
        <span>${escapeHtml(entry.phoneNumber || '')}</span>
      </div>
    </div>
  `).join('');
}

async function drawRaffleWinner() {
  showLoading('Drawing', 'Choosing winner...');
  try {
    const res = await api('drawRaffleWinner', authPayload());
    if (!res.ok) {
      alert(res.message || 'Could not draw winner.');
      return;
    }

    alert(res.message || 'Winner drawn.');
    await loadRaffleOverview();
  } catch (err) {
    alert(err.message || 'Could not draw winner.');
  } finally {
    hideLoading();
  }
}

async function clearRaffleWinner() {
  showLoading('Clearing', 'Removing winner...');
  try {
    const res = await api('clearRaffleWinner', authPayload());
    if (!res.ok) {
      alert(res.message || 'Could not clear winner.');
      return;
    }

    await loadRaffleOverview();
  } catch (err) {
    alert(err.message || 'Could not clear winner.');
  } finally {
    hideLoading();
  }
}

async function resetRaffle() {
  if (!window.confirm('Reset all raffle entries and the saved winner?')) return;

  showLoading('Resetting', 'Clearing raffle...');
  try {
    const res = await api('resetRaffle', authPayload());
    if (!res.ok) {
      alert(res.message || 'Could not reset raffle.');
      return;
    }

    await loadRaffleOverview();
    await refreshBootstrap(false);
  } catch (err) {
    alert(err.message || 'Could not reset raffle.');
  } finally {
    hideLoading();
  }
}

async function loadPayroll() {
  const list = $('payrollList');
  if (list) list.innerHTML = '<div class="list-item"><p>Loading payroll...</p></div>';

  try {
    const res = await api('loadPayroll', authPayload({
      startDate: getValue('payrollStartDate'),
      endDate: getValue('payrollEndDate')
    }));

    if (!res.ok) {
      if (list) list.innerHTML = `<div class="list-item"><p>${escapeHtml(res.message || 'Could not load payroll.')}</p></div>`;
      return;
    }

    renderPayroll(res.rows || []);
  } catch (err) {
    if (list) list.innerHTML = `<div class="list-item"><p>${escapeHtml(err.message || 'Could not load payroll.')}</p></div>`;
  }
}

function renderPayroll(rows) {
  const list = $('payrollList');
  if (!list) return;

  if (!rows.length) {
    list.innerHTML = '<div class="list-item"><p>No payroll rows found.</p></div>';
    return;
  }

  list.innerHTML = rows.map(row => `
    <div class="list-item">
      <h4>${escapeHtml(row.Employee || 'Employee')}</h4>
      <p>${money(row['Total Pay'])} · ${Number(row.Orders || 0)} orders</p>
      <div class="item-meta">
        <span>${escapeHtml(formatDate(row['Start Date']))} to ${escapeHtml(formatDate(row['End Date']))}</span>
        <span>Tips: ${money(row.Tips)}</span>
        <span>Commission: ${money(row.Commission)}</span>
      </div>
    </div>
  `).join('');
}

async function loadAds() {
  const list = $('adsList');
  if (list) list.innerHTML = '<div class="list-item"><p>Loading ads...</p></div>';

  try {
    const res = await api('loadAds', authPayload());
    if (!res.ok) {
      if (list) list.innerHTML = `<div class="list-item"><p>${escapeHtml(res.message || 'Could not load ads.')}</p></div>`;
      return;
    }

    renderAds(res.ads || []);
  } catch (err) {
    if (list) list.innerHTML = `<div class="list-item"><p>${escapeHtml(err.message || 'Could not load ads.')}</p></div>`;
  }
}

function renderAds(ads) {
  const list = $('adsList');
  if (!list) return;

  if (!ads.length) {
    list.innerHTML = '<div class="list-item"><p>No ads yet.</p></div>';
    return;
  }

  list.innerHTML = ads.map(ad => {
    const id = ad.ID || ad.id || '';
    return `
      <div class="list-item">
        <h4>${escapeHtml(ad.Title || 'Ad')}</h4>
        <p>${escapeHtml(ad['Ad Text'] || '')}</p>
        <div class="item-meta">
          <span>${escapeHtml(ad.Status || '')}</span>
          <span>${escapeHtml(ad['Posted By'] || '')}</span>
          <span>${escapeHtml(formatDate(ad['Created At']))}</span>
        </div>
        <div class="button-row" style="margin-top:10px">
          <button class="btn btn-danger" type="button" data-delete-ad="${escapeHtml(id)}">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-delete-ad]').forEach(btn => {
    btn.addEventListener('click', () => deleteAd(btn.dataset.deleteAd));
  });
}

async function saveAdNow() {
  const title = getValue('adTitle').trim();
  const text = getValue('adText').trim();
  const status = getValue('adStatus') || 'Active';

  if (!title || !text) {
    alert('Ad title and text are required.');
    return;
  }

  showLoading('Saving', 'Saving ad...');
  try {
    const res = await api('saveAd', authPayload({ title, text, status }));
    if (!res.ok) {
      alert(res.message || 'Could not save ad.');
      return;
    }

    setValue('adTitle', '');
    setValue('adText', '');
    setValue('adStatus', 'Active');
    await loadAds();
  } catch (err) {
    alert(err.message || 'Could not save ad.');
  } finally {
    hideLoading();
  }
}

async function deleteAd(id) {
  if (!id || !window.confirm('Delete this ad?')) return;

  showLoading('Deleting', 'Deleting ad...');
  try {
    const res = await api('deleteAd', authPayload({ id }));
    if (!res.ok) {
      alert(res.message || 'Could not delete ad.');
      return;
    }

    await loadAds();
  } catch (err) {
    alert(err.message || 'Could not delete ad.');
  } finally {
    hideLoading();
  }
}

async function loadAdminData() {
  if (!state.session || !hasAnyPermission([
    'canViewSettings',
    'canManageProducts',
    'canManageEmployees',
    'canManageTheme',
    'canManageUIText',
    'canManagePaymentMethods',
    'isOwner'
  ])) return;

  try {
    const res = await api('getAdminData', authPayload());
    if (!res.ok) return;

    state.adminData = res;
    renderSettingsForms();
    renderEmployeesAdmin();
    renderProductsAdmin();
    renderPaymentMethodsAdmin();
  } catch (err) {
    console.error(err);
  }
}

async function loadRolePermissions() {
  const wrap = $('rolePermissionsTable');
  if (!wrap) return;

  wrap.innerHTML = '<div class="list-item"><p>Loading permissions...</p></div>';

  try {
    const res = await api('getRolePermissions', authPayload());
    if (!res.ok) {
      wrap.innerHTML = `<div class="list-item"><p>${escapeHtml(res.message || 'Could not load permissions.')}</p></div>`;
      return;
    }

    state.rolePermissions = res;
    renderRolePermissions();
  } catch (err) {
    wrap.innerHTML = `<div class="list-item"><p>${escapeHtml(err.message || 'Could not load permissions.')}</p></div>`;
  }
}

function renderRolePermissions() {
  const wrap = $('rolePermissionsTable');
  const data = state.rolePermissions || {};
  const roles = data.roles || [];
  const permissions = data.permissions || [];
  const matrix = data.matrix || {};

  if (!wrap) return;

  if (!roles.length || !permissions.length) {
    wrap.innerHTML = '<div class="list-item"><p>No permissions found.</p></div>';
    return;
  }

  const header = `
    <div class="permissions-row permissions-header">
      <div class="permissions-cell permission-name">Permission</div>
      ${roles.map(role => `<div class="permissions-cell">${escapeHtml(role)}</div>`).join('')}
    </div>
  `;

  const rows = permissions.map(permission => `
    <div class="permissions-row">
      <div class="permissions-cell permission-name">${escapeHtml(permission.label || permission.key)}</div>
      ${roles.map(role => {
        const isOwner = role.toLowerCase() === 'owner';
        const isManagePermissions = permission.key === 'canManagePermissions';
        const checked = !!(matrix[role] && matrix[role][permission.key]);
        const disabled = isOwner || isManagePermissions;
        return `
          <label class="permission-toggle">
            <input
              type="checkbox"
              data-role="${escapeHtml(role)}"
              data-permission="${escapeHtml(permission.key)}"
              ${checked ? 'checked' : ''}
              ${disabled ? 'disabled' : ''}
            >
            <span></span>
          </label>
        `;
      }).join('')}
    </div>
  `).join('');

  wrap.innerHTML = header + rows;
}

async function saveRolePermissionsNow() {
  const data = state.rolePermissions || {};
  const roles = data.roles || [];
  const permissions = data.permissions || [];

  if (!roles.length || !permissions.length) {
    alert('Load permissions first.');
    return;
  }

  const matrix = {};
  roles.forEach(role => {
    matrix[role] = {};
    permissions.forEach(permission => {
      const input = document.querySelector(`[data-role="${cssEscape(role)}"][data-permission="${cssEscape(permission.key)}"]`);
      matrix[role][permission.key] = input ? input.checked : !!(data.matrix?.[role]?.[permission.key]);
    });
  });

  showLoading('Saving', 'Saving role permissions...');
  try {
    const res = await api('saveRolePermissions', authPayload({ matrix }));
    if (!res.ok) {
      alert(res.message || 'Could not save permissions.');
      return;
    }

    alert(res.message || 'Role permissions saved.');
    state.rolePermissions.matrix = res.matrix || matrix;
    renderRolePermissions();
  } catch (err) {
    alert(err.message || 'Could not save permissions.');
  } finally {
    hideLoading();
  }
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
  return String(value).replace(/"/g, '\\"');
}

function renderSettingsForms() {
  const settings = state.adminData?.settings || {};
  const theme = state.adminData?.theme || state.bootstrap?.settings?.theme || {};

  setValue('settingsPortalName', settings.portalName || '');
  setValue('settingsPortalSubtitle', settings.portalSubtitle || '');
  setValue('settingsAnnouncement', settings.announcement || '');
  setValue('settingsBankId', settings.bankId || '');
  setValue('settingsMileageRate', settings.mileageRate || 0);

  setValue('saleEnabled', settings.saleEnabled || 'No');
  setValue('salePercent', settings.salePercent || '0');
  setValue('saleStart', toDateTimeLocal(settings.saleStart || ''));
  setValue('saleEnd', toDateTimeLocal(settings.saleEnd || ''));

  setValue('raffleEnabled', settings.raffleEnabled || 'Yes');
  setValue('raffleMaxOverall', settings.raffleMaxOverall || '0');
  setValue('raffleMaxPerPerson', settings.raffleMaxPerPerson || '0');
  setValue('raffleStart', toDateTimeLocal(settings.raffleStart || ''));
  setValue('raffleEnd', toDateTimeLocal(settings.raffleEnd || ''));

  setValue('themePrimary', theme.primary || '#f28c18');
  setValue('themePrimaryDark', theme.primaryDark || '#de7c0c');
  setValue('themeSecondary', theme.secondary || '#6c4330');
  setValue('themeBg', theme.bg || '#fdf4ea');
  setValue('themeCard', theme.card || '#ffffff');
  setValue('themeText', theme.text || '#4a2e22');
  setValue('themeMuted', theme.muted || '#8a6a5a');
  setValue('themeBorder', theme.border || '#edc9a5');
}

async function saveSettingsNow() {
  showLoading('Saving', 'Saving settings...');
  try {
    const res = await api('saveSettings', authPayload({
      portalName: getValue('settingsPortalName'),
      portalSubtitle: getValue('settingsPortalSubtitle'),
      announcement: getValue('settingsAnnouncement'),
      bankId: getValue('settingsBankId'),
      mileageRate: Number(getValue('settingsMileageRate') || 0)
    }));

    if (!res.ok) {
      alert(res.message || 'Could not save settings.');
      return;
    }

    alert(res.message || 'Settings saved.');
    await portalRefreshNow();
  } catch (err) {
    alert(err.message || 'Could not save settings.');
  } finally {
    hideLoading();
  }
}

async function saveSaleSettingsNow() {
  showLoading('Saving', 'Saving sale timer...');
  try {
    const res = await api('saveSaleSettings', authPayload({
      enabled: getValue('saleEnabled'),
      percent: Number(getValue('salePercent') || 0),
      start: fromDateTimeLocal(getValue('saleStart')),
      end: fromDateTimeLocal(getValue('saleEnd'))
    }));

    if (!res.ok) {
      alert(res.message || 'Could not save sale timer.');
      return;
    }

    alert(res.message || 'Sale timer saved.');
    await portalRefreshNow();
  } catch (err) {
    alert(err.message || 'Could not save sale timer.');
  } finally {
    hideLoading();
  }
}

async function saveRaffleSettingsNow() {
  showLoading('Saving', 'Saving raffle controls...');
  try {
    const res = await api('saveRaffleSettings', authPayload({
      enabled: getValue('raffleEnabled'),
      maxOverall: getValue('raffleMaxOverall'),
      maxPer: getValue('raffleMaxPerPerson'),
      start: fromDateTimeLocal(getValue('raffleStart')),
      end: fromDateTimeLocal(getValue('raffleEnd'))
    }));

    if (!res.ok) {
      alert(res.message || 'Could not save raffle controls.');
      return;
    }

    alert(res.message || 'Raffle controls saved.');
    await portalRefreshNow();
  } catch (err) {
    alert(err.message || 'Could not save raffle controls.');
  } finally {
    hideLoading();
  }
}

async function saveThemeNow() {
  const theme = {
    primary: getValue('themePrimary'),
    primaryDark: getValue('themePrimaryDark'),
    secondary: getValue('themeSecondary'),
    bg: getValue('themeBg'),
    card: getValue('themeCard'),
    text: getValue('themeText'),
    muted: getValue('themeMuted'),
    border: getValue('themeBorder')
  };

  showLoading('Saving', 'Saving theme...');
  try {
    const res = await api('saveTheme', authPayload({ theme }));
    if (!res.ok) {
      alert(res.message || 'Could not save theme.');
      return;
    }

    applyTheme(theme);
    alert(res.message || 'Theme saved.');
    await portalRefreshNow();
  } catch (err) {
    alert(err.message || 'Could not save theme.');
  } finally {
    hideLoading();
  }
}

function getAdminEmployees() {
  if (!state.adminData) state.adminData = {};
  if (!Array.isArray(state.adminData.employees)) state.adminData.employees = [];
  return state.adminData.employees;
}

function renderEmployeesAdmin() {
  const wrap = $('employeesAdminList');
  if (!wrap) return;

  const query = getValue('employeeSearchInput').trim().toLowerCase();
  const employees = getAdminEmployees()
    .map((item, index) => ({ item, index }))
    .filter(entry => {
      if (!query) return true;

      const item = entry.item;
      const hay = [
        item.Name || item.name,
        item.Email || item.email,
        item.Username || item.username,
        item.Role || item.role,
        item.Active || item.active
      ].join(' ').toLowerCase();

      return hay.includes(query);
    })
    .sort((a, b) => {
      const aActive = String(a.item.Active || a.item.active || 'Yes').toLowerCase() !== 'no';
      const bActive = String(b.item.Active || b.item.active || 'Yes').toLowerCase() !== 'no';
      if (aActive !== bActive) return aActive ? -1 : 1;

      const aName = String(a.item.Name || a.item.name || '').toLowerCase();
      const bName = String(b.item.Name || b.item.name || '').toLowerCase();
      return aName.localeCompare(bName);
    });

  if (!employees.length) {
    wrap.innerHTML = '<div class="list-item"><p>No employees found.</p></div>';
    return;
  }

  wrap.innerHTML = employees.map(({ item, index }) => {
    const active = String(item.Active || item.active || 'Yes');
    const isActive = active.toLowerCase() !== 'no';
    const role = item.Role || item.role || 'Employee';
    const name = item.Name || item.name || 'Unnamed Employee';
    const email = item.Email || item.email || '';
    const username = item.Username || item.username || '';

    return `
      <div class="settings-entry-card employee-card ${isActive ? 'employee-active' : 'employee-inactive'}">
        <div class="settings-entry-main">
          <div class="settings-entry-title">
            ${escapeHtml(name)}
            <span class="employee-status-pill">${isActive ? 'Active' : 'Inactive'}</span>
          </div>
          <div class="settings-entry-sub">
            ${escapeHtml(role)} · ${escapeHtml(active)} · ${escapeHtml(username || email || 'No login set')}
          </div>
        </div>
        <button type="button" class="btn btn-secondary" data-open-employee="${index}">Update</button>
      </div>
    `;
  }).join('');

  wrap.querySelectorAll('[data-open-employee]').forEach(btn => {
    btn.addEventListener('click', () => openEmployeeModal(Number(btn.dataset.openEmployee)));
  });
}

function openEmployeeModal(index) {
  const employees = getAdminEmployees();
  const item = index >= 0 ? (employees[index] || {}) : {};

  setText('employeeModalTitle', index >= 0 ? 'Update Employee' : 'Add Employee');
  setValue('employeeModalIndex', index >= 0 ? index : '');
  setValue('employeeModalName', item.Name || item.name || '');
  setValue('employeeModalEmail', item.Email || item.email || '');
  setValue('employeeModalUsername', item.Username || item.username || '');
  setValue('employeeModalPin', item.PIN || item.pin || '');
  setValue('employeeModalRole', item.Role || item.role || 'Employee');
  setValue('employeeModalActive', item.Active || item.active || 'Yes');

  showEl('employeeModalBackdrop');
  showEl('employeeModal');
}

function closeEmployeeModal() {
  hideEl('employeeModalBackdrop');
  hideEl('employeeModal');
}

function readEmployeeModal() {
  return {
    Name: getValue('employeeModalName').trim(),
    Email: getValue('employeeModalEmail').trim(),
    Username: getValue('employeeModalUsername').trim(),
    PIN: getValue('employeeModalPin').trim(),
    Role: getValue('employeeModalRole') || 'Employee',
    Active: getValue('employeeModalActive') || 'Yes'
  };
}

function saveEmployeeModal() {
  const employees = getAdminEmployees();
  const rawIndex = getValue('employeeModalIndex');
  const index = rawIndex === '' ? -1 : Number(rawIndex);
  const item = readEmployeeModal();

  if (!item.Name) {
    alert('Employee name is required.');
    return;
  }

  if (!item.Email && !item.Username) {
    alert('Add an email or username for login.');
    return;
  }

  if (!item.PIN) {
    alert('PIN is required.');
    return;
  }

  if (index >= 0) employees[index] = item;
  else employees.push(item);

  renderEmployeesAdmin();
  closeEmployeeModal();
}

function deactivateEmployeeModal() {
  const employees = getAdminEmployees();
  const rawIndex = getValue('employeeModalIndex');
  const index = rawIndex === '' ? -1 : Number(rawIndex);

  if (index < 0) {
    closeEmployeeModal();
    return;
  }

  if (!window.confirm('Deactivate this employee login?')) return;

  const item = readEmployeeModal();
  item.Active = 'No';
  employees[index] = item;

  renderEmployeesAdmin();
  closeEmployeeModal();
}

async function saveEmployeesNow() {
  showLoading('Saving', 'Saving employees...');
  try {
    const employees = getAdminEmployees()
      .map(item => ({
        Name: item.Name || item.name || '',
        Email: item.Email || item.email || '',
        Username: item.Username || item.username || '',
        PIN: item.PIN || item.pin || '',
        Role: item.Role || item.role || 'Employee',
        Active: item.Active || item.active || 'Yes'
      }))
      .filter(item => item.Name.trim() || item.Email.trim() || item.Username.trim());

    const res = await api('saveEmployees', authPayload({ employees }));
    if (!res.ok) {
      alert(res.message || 'Could not save employees.');
      return;
    }

    alert(res.message || 'Employees saved.');
    await loadAdminData();
  } catch (err) {
    alert(err.message || 'Could not save employees.');
  } finally {
    hideLoading();
  }
}

function getAdminProducts() {
  if (!state.adminData) state.adminData = {};
  if (!Array.isArray(state.adminData.products)) state.adminData.products = [];
  return state.adminData.products;
}

function renderProductsAdmin() {
  const wrap = $('productsAdminList');
  if (!wrap) return;

  const products = getAdminProducts();
  if (!products.length) {
    wrap.innerHTML = '<div class="list-item"><p>No products yet.</p></div>';
    return;
  }

  wrap.innerHTML = products.map((item, index) => `
    <div class="settings-entry-card">
      <div class="settings-entry-main">
        <div class="settings-entry-title">${escapeHtml(item.Name || item.name || 'Unnamed Product')}</div>
        <div class="settings-entry-sub">${money(item.Price || item.price || 0)} · ${escapeHtml(item.Active || item.active || 'Yes')}</div>
      </div>
      <button type="button" class="btn btn-secondary" data-open-product="${index}">Update</button>
    </div>
  `).join('');

  wrap.querySelectorAll('[data-open-product]').forEach(btn => {
    btn.addEventListener('click', () => openProductModal(Number(btn.dataset.openProduct)));
  });
}

function openProductModal(index) {
  const products = getAdminProducts();
  const item = index >= 0 ? (products[index] || {}) : {};

  setText('productModalTitle', index >= 0 ? 'Update Product' : 'Add Product');
  setValue('productModalIndex', index >= 0 ? index : '');
  setValue('productModalName', item.Name || item.name || '');
  setValue('productModalPrice', Number(item.Price || item.price || 0));
  setValue('productModalActive', item.Active || item.active || 'Yes');

  showEl('productModalBackdrop');
  showEl('productModal');
}

function closeProductModal() {
  hideEl('productModalBackdrop');
  hideEl('productModal');
}

function saveProductModal() {
  const products = getAdminProducts();
  const rawIndex = getValue('productModalIndex');
  const index = rawIndex === '' ? -1 : Number(rawIndex);
  const item = {
    Name: getValue('productModalName').trim(),
    Price: Number(getValue('productModalPrice') || 0),
    Active: getValue('productModalActive') || 'Yes'
  };

  if (!item.Name) {
    alert('Product name is required.');
    return;
  }

  if (index >= 0) products[index] = item;
  else products.push(item);

  renderProductsAdmin();
  closeProductModal();
}

function deleteProductModal() {
  const products = getAdminProducts();
  const rawIndex = getValue('productModalIndex');
  const index = rawIndex === '' ? -1 : Number(rawIndex);

  if (index < 0) {
    closeProductModal();
    return;
  }

  if (!window.confirm('Delete this product?')) return;
  products.splice(index, 1);
  renderProductsAdmin();
  closeProductModal();
}

async function saveProductsNow() {
  showLoading('Saving', 'Saving products...');
  try {
    const products = getAdminProducts()
      .map(item => ({
        Name: item.Name || item.name || '',
        Price: Number(item.Price || item.price || 0),
        Active: item.Active || item.active || 'Yes'
      }))
      .filter(item => item.Name.trim());

    const res = await api('saveProducts', authPayload({ products }));
    if (!res.ok) {
      alert(res.message || 'Could not save products.');
      return;
    }

    alert(res.message || 'Products saved.');
    await loadAdminData();
    await refreshBootstrap(false);
  } catch (err) {
    alert(err.message || 'Could not save products.');
  } finally {
    hideLoading();
  }
}

function getAdminPaymentMethods() {
  if (!state.adminData) state.adminData = {};
  if (!Array.isArray(state.adminData.paymentMethods)) state.adminData.paymentMethods = [];
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

  setText('paymentModalTitle', index >= 0 ? 'Update Payment Method' : 'Add Payment Method');
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

  if (!window.confirm('Delete this payment method?')) return;
  methods.splice(index, 1);
  renderPaymentMethodsAdmin();
  closePaymentModal();
}

async function savePaymentMethodsNow() {
  showLoading('Saving', 'Saving payment methods...');
  try {
    const paymentMethods = getAdminPaymentMethods()
      .map(item => ({
        Name: item.Name || item.name || '',
        Active: item.Active || item.active || 'Yes'
      }))
      .filter(item => item.Name.trim());

    const res = await api('savePaymentMethods', authPayload({ paymentMethods }));
    if (!res.ok) {
      alert(res.message || 'Could not save payment methods.');
      return;
    }

    alert(res.message || 'Payment methods saved.');
    await loadAdminData();
    await refreshBootstrap(false);
  } catch (err) {
    alert(err.message || 'Could not save payment methods.');
  } finally {
    hideLoading();
  }
}

function formatDate(value) {
  if (!value || value === '-') return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value) {
  if (!value) return '';
  return new Date(value).toISOString();
}

function init() {
  $('loginBtn')?.addEventListener('click', loginNow);
  $('logoutBtn')?.addEventListener('click', logoutNow);
  $('portalRefreshBtn')?.addEventListener('click', portalRefreshNow);
  $('submitOrderBtn')?.addEventListener('click', submitOrder);
  $('clearCartBtn')?.addEventListener('click', clearCart);

  $('orderSearchBtn')?.addEventListener('click', () => loadOrders());
  $('orderSearchInput')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') loadOrders();
  });

  $('rewardsLookupBtn')?.addEventListener('click', lookupRewards);
  $('rewardCustomerName')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') lookupRewards();
  });

  $('drawRaffleBtn')?.addEventListener('click', drawRaffleWinner);
  $('clearRaffleWinnerBtn')?.addEventListener('click', clearRaffleWinner);
  $('resetRaffleBtn')?.addEventListener('click', resetRaffle);

  $('loadPayrollBtn')?.addEventListener('click', loadPayroll);
  $('saveAdBtn')?.addEventListener('click', saveAdNow);
  $('saveRolePermissionsBtn')?.addEventListener('click', saveRolePermissionsNow);
  $('saveEmployeesBtn')?.addEventListener('click', saveEmployeesNow);
  $('addEmployeeRowBtn')?.addEventListener('click', () => openEmployeeModal(-1));
  $('employeeSearchInput')?.addEventListener('input', renderEmployeesAdmin);
  $('employeeSearchClearBtn')?.addEventListener('click', () => {
    setValue('employeeSearchInput', '');
    renderEmployeesAdmin();
  });

  $('saveSettingsBtn')?.addEventListener('click', saveSettingsNow);
  $('saveSaleSettingsBtn')?.addEventListener('click', saveSaleSettingsNow);
  $('saveRaffleSettingsBtn')?.addEventListener('click', saveRaffleSettingsNow);
  $('saveThemeBtn')?.addEventListener('click', saveThemeNow);

  $('saveProductsBtn')?.addEventListener('click', saveProductsNow);
  $('addProductRowBtn')?.addEventListener('click', () => openProductModal(-1));
  $('productModalClose')?.addEventListener('click', closeProductModal);
  $('productModalCancel')?.addEventListener('click', closeProductModal);
  $('productModalSave')?.addEventListener('click', saveProductModal);
  $('productModalDelete')?.addEventListener('click', deleteProductModal);
  $('productModalBackdrop')?.addEventListener('click', closeProductModal);

  $('savePaymentMethodsBtn')?.addEventListener('click', savePaymentMethodsNow);
  $('addPaymentMethodRowBtn')?.addEventListener('click', () => openPaymentModal(-1));
  $('paymentModalClose')?.addEventListener('click', closePaymentModal);
  $('paymentModalCancel')?.addEventListener('click', closePaymentModal);
  $('paymentModalSave')?.addEventListener('click', savePaymentModal);
  $('paymentModalDelete')?.addEventListener('click', deletePaymentModal);
  $('paymentModalBackdrop')?.addEventListener('click', closePaymentModal);

  $('employeeModalClose')?.addEventListener('click', closeEmployeeModal);
  $('employeeModalCancel')?.addEventListener('click', closeEmployeeModal);
  $('employeeModalSave')?.addEventListener('click', saveEmployeeModal);
  $('employeeModalDeactivate')?.addEventListener('click', deactivateEmployeeModal);
  $('employeeModalBackdrop')?.addEventListener('click', closeEmployeeModal);

  ['mileageInput', 'amountPaidInput'].forEach(id => {
    $(id)?.addEventListener('input', renderCart);
  });

  ['loginValue', 'loginPin'].forEach(id => {
    $(id)?.addEventListener('keydown', event => {
      if (event.key === 'Enter') loginNow();
    });
  });

  renderNav();
}

init();
