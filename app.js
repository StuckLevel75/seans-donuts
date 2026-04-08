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

function showMessage(elId, text, type) {
  const el = $(elId);
  if (!el) return;
  el.textContent = text || '';
  el.className = text ? `message show ${type || 'info'}` : 'message';
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value == null ? '' : String(value);
}

function setValue(id, value) {
  const el = $(id);
  if (el) el.value = value == null ? '' : String(value);
}

function getValue(id, fallback) {
  const el = $(id);
  return el ? el.value : (fallback || '');
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

async function api(action, payload) {
  if (!state.apiUrl) throw new Error('Missing API URL.');

  const response = await fetch(state.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: action, payload: payload || {} })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.json();
}

function getRole() {
  return String((state.session && state.session.employee && state.session.employee.role) || '').trim().toLowerCase();
}

function getPerms() {
  return (state.session && state.session.permissions) || {};
}

function isOwnerLike() {
  const perms = getPerms();
  const role = getRole();
  return !!(perms.isOwner || perms.isAdmin || role === 'owner' || role === 'admin');
}

function getVisibleTabs() {
  if (!state.session) return tabs.filter(tab => !tab.ownerOnly);
  return tabs.filter(tab => !tab.ownerOnly || isOwnerLike());
}

function renderNav() {
  const nav = $('navTabs');
  if (!nav) return;

  let visibleTabs = getVisibleTabs();
  if (!visibleTabs.length) visibleTabs = tabs.filter(tab => !tab.ownerOnly);

  const hasActive = visibleTabs.some(tab => tab.key === state.activeTab);
  if (!hasActive) state.activeTab = visibleTabs[0] ? visibleTabs[0].key : 'dashboard';

  nav.innerHTML = visibleTabs.map(tab => {
    return `
      <button
        type="button"
        class="nav-btn ${state.activeTab === tab.key ? 'active' : ''}"
        data-tab="${escapeHtml(tab.key)}"
      >
        ${escapeHtml(tab.label)}
      </button>
    `;
  }).join('');

  const buttons = nav.querySelectorAll('[data-tab]');
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', function () {
      activateTab(this.dataset.tab);
    });
  }
}

function activateTab(tabKey) {
  const visibleTabs = getVisibleTabs();
  const allowed = visibleTabs.some(tab => tab.key === tabKey);
  state.activeTab = allowed ? tabKey : ((visibleTabs[0] && visibleTabs[0].key) || 'dashboard');

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

  Object.keys(sectionMap).forEach(function (key) {
    const el = $(sectionMap[key]);
    if (el) el.classList.add('hidden');
  });

  const active = $(sectionMap[state.activeTab]);
  if (active) active.classList.remove('hidden');

  if (state.activeTab === 'raffle') {
    drawRaffleWheel(state.raffleWheelEntries);
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

  grid.innerHTML = state.products.map(function (product, index) {
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

  const buttons = grid.querySelectorAll('[data-qty]');
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', function () {
      const product = state.products[Number(this.dataset.index)];
      if (!product) return;

      const current = Number(state.cart[product.name] || 0);
      const next = this.dataset.qty === 'up' ? current + 1 : Math.max(0, current - 1);

      if (next <= 0) delete state.cart[product.name];
      else state.cart[product.name] = next;

      buildProductGrid();
      renderCart();
    });
  }
}

function renderCart() {
  const list = $('cartList');
  if (!list) return;

  const items = Object.keys(state.cart).filter(function (name) {
    return Number(state.cart[name]) > 0;
  }).map(function (name) {
    const product = state.products.find(function (p) { return p.name === name; }) || {};
    const qty = Number(state.cart[name] || 0);
    const price = Number(product.price || 0);
    return {
      name: name,
      qty: qty,
      price: price,
      total: qty * price
    };
  });

  if (!items.length) {
    list.innerHTML = '<div class="list-item"><p>Empty cart</p></div>';
  } else {
    list.innerHTML = items.map(function (item) {
      return `
        <div class="list-item">
          <h4>${escapeHtml(item.name)}</h4>
          <p>${item.qty} × ${money(item.price)} = <strong>${money(item.total)}</strong></p>
        </div>
      `;
    }).join('');
  }

  const subtotal = items.reduce(function (sum, item) { return sum + item.total; }, 0);
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

function applyTheme(theme) {
  const root = document.documentElement;
  if (!root || !theme) return;

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
  const settings = (state.bootstrap && state.bootstrap.settings) || {};
  const ui = settings.uiText || {};
  const theme = settings.theme || {};
  const prefs = (state.session && state.session.portalPrefs) || {};
  const employee = (state.session && state.session.employee) || {};

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

  applyTheme(theme);
  updateOwnerUI();
}

function expandRaffleWheelEntries(entries) {
  const expanded = [];
  (entries || []).forEach(function (entry) {
    const qty = Math.max(1, Number(entry.ticketsBought || entry['Tickets Bought'] || 0));
    for (let i = 0; i < qty; i++) {
      expanded.push({
        customerName: entry.customerName || entry['Customer Name'] || '',
        customerDiscord: entry.customerDiscord || entry['Customer Discord'] || '',
        phoneNumber: entry.phoneNumber || entry['Phone Number'] || '',
        ticketsBought: entry.ticketsBought || entry['Tickets Bought'] || 0,
        orderNumber: entry.orderNumber || entry['Order Number'] || '',
        _sourceOrderNumber: entry.orderNumber || entry['Order Number'] || '',
        _sourceCustomerName: entry.customerName || entry['Customer Name'] || ''
      });
    }
  });
  return expanded;
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
      <h4>${escapeHtml(winner.customerName || 'Winner')}</h4>
      <p><strong>Discord:</strong> ${escapeHtml(winner.customerDiscord || '—')}</p>
      <p><strong>Phone:</strong> ${escapeHtml(winner.phoneNumber || '—')}</p>
      <p><strong>Tickets:</strong> ${Number(winner.ticketsBought || 0)}</p>
      <p><strong>Order:</strong> ${escapeHtml(winner.orderNumber || '—')}</p>
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

function animateWheelToWinner(entries, winner) {
  if (!entries.length || !winner) return;

  const index = entries.findIndex(function (entry) {
    return String(entry._sourceOrderNumber || entry.orderNumber || '') === String(winner.orderNumber || '') &&
      String(entry._sourceCustomerName || entry.customerName || '') === String(winner.customerName || '');
  });

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

    if (t < 1) requestAnimationFrame(step);
    else {
      state.wheelSpinning = false;
      state.wheelRotation = finalRotation;
      drawRaffleWheel(entries);
    }
  }

  requestAnimationFrame(step);
}

function renderBootstrap() {
  const stats = (state.bootstrap && state.bootstrap.stats) || {};
  const announcements = (state.bootstrap && state.bootstrap.announcements) || [];
  const settings = (state.bootstrap && state.bootstrap.settings) || {};

  setText('statOrders', Number(stats.totalOrders || 0));
  setText('statSales', money(stats.totalSales || 0));
  setText('statEmployees', Number(stats.activeEmployees || 0));
  setText('statRaffle', Number(stats.raffleEntries || 0));

  const announcementsList = $('announcementsList');
  if (announcementsList) {
    announcementsList.innerHTML = announcements.length ? announcements.map(function (item) {
      return `
        <div class="list-item">
          <h4>${escapeHtml(item.title || 'Announcement')}</h4>
          <p>${escapeHtml(item.message || '')}</p>
        </div>
      `;
    }).join('') : '<div class="list-item"><p>No active announcements.</p></div>';
  }

  const methods = Array.isArray(settings.paymentMethods) && settings.paymentMethods.length
    ? settings.paymentMethods
    : state.paymentMethods;

  state.paymentMethods = methods;

  const paymentMethod = $('paymentMethod');
  if (paymentMethod) {
    paymentMethod.innerHTML = methods.map(function (method) {
      const value = method.Name || method.name || method;
      return `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`;
    }).join('');
  }
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
      loginValue: loginValue,
      pin: pin
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
  state.raffleWheelEntries = [];
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

function hasRaffleTicketInCart() {
  return Object.keys(state.cart).some(function (name) {
    return String(name).trim().toLowerCase() === 'raffle ticket' && Number(state.cart[name]) > 0;
  });
}

async function submitOrder() {
  if (!state.session) return;

  const items = Object.keys(state.cart)
    .filter(function (name) { return Number(state.cart[name]) > 0; })
    .map(function (name) {
      return { name: name, qty: Number(state.cart[name]) };
    });

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

  showMessage('orderMsg', 'Submitting order...', 'info');

  try {
    const payload = {
      email: (state.session.employee && (state.session.employee.email || state.session.employee.username)) || '',
      pin: getValue('loginPin').trim(),
      customerName: customerName,
      customerDiscord: customerDiscord,
      phoneNumber: phoneNumber,
      mileage: Number(getValue('mileageInput', 0) || 0),
      amountPaid: Number(getValue('amountPaidInput', 0) || 0),
      discount: Number(getValue('discountInput', 0) || 0),
      tip: Number(getValue('tipInput', 0) || 0),
      paymentMethod: getValue('paymentMethod'),
      notes: getValue('notes').trim(),
      items: items
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

    await Promise.allSettled([loadOrders(), loadBootstrap(), loadRaffle()]);
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
      email: (state.session.employee && (state.session.employee.email || state.session.employee.username)) || '',
      pin: getValue('loginPin').trim(),
      query: getValue('orderSearchInput').trim()
    });

    const rows = result.results || result.orders || [];
    if (!list) return;

    list.innerHTML = rows.length ? rows.map(function (row) {
      return `
        <div class="list-item">
          <h4>${escapeHtml(row.orderNumber || row['Order Number'] || 'Order')}</h4>
          <p>${escapeHtml(row.customerName || row['Customer Name'] || 'No customer')} · ${money(row.total || row.Total || 0)}</p>
        </div>
      `;
    }).join('') : '<div class="list-item"><p>No orders loaded.</p></div>';
  } catch (error) {
    if (list) list.innerHTML = `<div class="list-item"><p>${escapeHtml(error.message || 'Could not load orders.')}</p></div>`;
  }
}

async function loadRewards(silent) {
  if (!state.session) return;

  const customerName = getValue('rewardCustomerName').trim() || getValue('customerName').trim();

  if (!customerName && !silent) {
    showMessage('rewardsMsg', 'Enter a customer name.', 'error');
    return;
  }

  if (!silent) showMessage('rewardsMsg', 'Loading rewards...', 'info');

  try {
    const result = await api('lookupRewards', {
      email: (state.session.employee && (state.session.employee.email || state.session.employee.username)) || '',
      pin: getValue('loginPin').trim(),
      customerName: customerName
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
      email: (state.session.employee && (state.session.employee.email || state.session.employee.username)) || '',
      pin: getValue('loginPin').trim()
    });

    const rows = result.entries || result.results || [];
    state.raffleEntries = rows;
    state.raffleWheelEntries = expandRaffleWheelEntries(rows);
    state.raffleWinner = result.winner || null;

    renderRaffleWinner();
    drawRaffleWheel(state.raffleWheelEntries);

    if (!list) return;

    list.innerHTML = rows.length ? rows.map(function (row) {
      return `
        <div class="list-item">
          <h4>${escapeHtml(row.customerName || 'Entry')}</h4>
          <p><strong>Discord:</strong> ${escapeHtml(row.customerDiscord || '—')}</p>
          <p><strong>Phone:</strong> ${escapeHtml(row.phoneNumber || '—')}</p>
          <p><strong>Tickets:</strong> ${Number(row.ticketsBought || 0)}</p>
          <p><strong>Order:</strong> ${escapeHtml(row.orderNumber || '—')}</p>
        </div>
      `;
    }).join('') : '<div class="list-item"><p>No raffle entries loaded.</p></div>';
  } catch (error) {
    if (list) list.innerHTML = `<div class="list-item"><p>${escapeHtml(error.message || 'Could not load raffle.')}</p></div>`;
  }
}

async function drawRaffleWinnerNow() {
  if (!state.session || state.wheelSpinning) return;

  showMessage('raffleMsg', 'Drawing winner...', 'info');

  try {
    const result = await api('drawRaffleWinner', {
      email: (state.session.employee && (state.session.employee.email || state.session.employee.username)) || '',
      pin: getValue('loginPin').trim()
    });

    if (!result.ok) {
      showMessage('raffleMsg', result.message || 'Could not draw winner.', 'error');
      return;
    }

    state.raffleWinner = result.winner || null;
    renderRaffleWinner();

    if (state.raffleWheelEntries.length && state.raffleWinner) {
      animateWheelToWinner(state.raffleWheelEntries, state.raffleWinner);
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
      email: (state.session.employee && (state.session.employee.email || state.session.employee.username)) || '',
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
      email: (state.session.employee && (state.session.employee.email || state.session.employee.username)) || '',
      pin: getValue('loginPin').trim(),
      startDate: getValue('payrollStartDate'),
      endDate: getValue('payrollEndDate')
    });

    const rows = result.results || result.rows || [];
    if (!list) return;

    list.innerHTML = rows.length ? rows.map(function (row) {
      return `
        <div class="list-item">
          <h4>${escapeHtml(row.employee || row.name || 'Employee')}</h4>
          <p>Total Pay: ${money(row.totalPay || row['Total Pay'] || 0)} · Orders: ${Number(row.orders || row['Orders'] || 0)}</p>
        </div>
      `;
    }).join('') : '<div class="list-item"><p>No payroll rows loaded.</p></div>';
  } catch (error) {
    if (list) list.innerHTML = `<div class="list-item"><p>${escapeHtml(error.message || 'Could not load payroll.')}</p></div>`;
  }
}

function wireEvents() {
  const loginBtn = $('loginBtn');
  const logoutBtn = $('logoutBtn');
  const submitOrderBtn = $('submitOrderBtn');
  const searchOrdersBtn = $('searchOrdersBtn');
  const lookupRewardsBtn = $('lookupRewardsBtn');
  const loadPayrollBtn = $('loadPayrollBtn');
  const drawWinnerBtn = $('drawWinnerBtn');
  const clearWinnerBtn = $('clearWinnerBtn');

  if (loginBtn) loginBtn.addEventListener('click', loginNow);
  if (logoutBtn) logoutBtn.addEventListener('click', logoutNow);
  if (submitOrderBtn) submitOrderBtn.addEventListener('click', submitOrder);
  if (searchOrdersBtn) searchOrdersBtn.addEventListener('click', loadOrders);
  if (lookupRewardsBtn) lookupRewardsBtn.addEventListener('click', function () { loadRewards(false); });
  if (loadPayrollBtn) loadPayrollBtn.addEventListener('click', loadPayroll);
  if (drawWinnerBtn) drawWinnerBtn.addEventListener('click', drawRaffleWinnerNow);
  if (clearWinnerBtn) clearWinnerBtn.addEventListener('click', clearRaffleWinnerNow);

  const loginValue = $('loginValue');
  const loginPin = $('loginPin');
  const discountInput = $('discountInput');
  const tipInput = $('tipInput');
  const mileageInput = $('mileageInput');
  const amountPaidInput = $('amountPaidInput');

  if (loginValue) loginValue.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') loginNow();
  });

  if (loginPin) loginPin.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') loginNow();
  });

  if (discountInput) discountInput.addEventListener('input', renderCart);
  if (tipInput) tipInput.addEventListener('input', renderCart);
  if (mileageInput) mileageInput.addEventListener('input', renderCart);
  if (amountPaidInput) amountPaidInput.addEventListener('input', renderCart);
}

function init() {
  renderNav();
  wireEvents();
  activateTab('dashboard');
  renderCart();
  drawRaffleWheel([]);
}

init();
