const state = {
  apiUrl: localStorage.getItem('sd_api_url') || '',
  session: null,
  bootstrap: null,
  adminData: null,
  products: [],
  employees: [],
  paymentMethods: [],
  activeTab: 'settings'
};

function $(id) {
  return document.getElementById(id);
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
  setText('loadingTitle', title);
  setText('loadingText', text);
  showEl('loadingOverlay');
}

function hideLoading() {
  hideEl('loadingOverlay');
}

function getLoginPin() {
  return getValue('loginPin').trim();
}

function authPayload(extra = {}) {
  const employee = state.session?.employee || {};
  return {
    email: employee.email || employee.username || '',
    pin: getLoginPin(),
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

/* ---------------- LOGIN / PORTAL ---------------- */

async function loginNow() {
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

    const bootstrap = await api('getPortalBootstrap', {});
    if (!bootstrap.ok) {
      hideLoading();
      alert(bootstrap.message || 'Could not load portal.');
      return;
    }

    state.bootstrap = bootstrap;
    fillPortalHeader();

    hideEl('loginView');
    showEl('portalView');
    showEl('logoutBtn');
    showEl('portalRefreshBtn');

    await loadAdminData();
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
  state.employees = [];
  state.paymentMethods = [];

  showEl('loginView');
  hideEl('portalView');
  hideEl('logoutBtn');
  hideEl('portalRefreshBtn');
}

async function portalRefreshNow() {
  if (!state.session) return;

  showLoading('REFRESHING', 'Reloading portal data...');

  try {
    const bootstrap = await api('getPortalBootstrap', {});
    if (bootstrap.ok) {
      state.bootstrap = bootstrap;
      fillPortalHeader();
    }

    await loadAdminData();
    hideLoading();
  } catch (error) {
    hideLoading();
    alert(error.message || 'Could not refresh portal.');
  }
}

function fillPortalHeader() {
  const settings = state.bootstrap?.settings || {};
  const employee = state.session?.employee || {};

  setText('portalName', settings.portalName || "Sean's Donuts");
  setText('userBadge', `👋 Hello, ${employee.name || 'User'}`);
  setText('sessionRole', employee.role || '');
  setText('bankIdText', settings.bankId || '24596194');
}

/* ---------------- SETTINGS DATA ---------------- */

async function loadAdminData() {
  if (!state.session) return;

  const result = await api('getAdminData', authPayload({}));
  if (!result.ok) {
    alert(result.message || 'Could not load settings.');
    return;
  }

  state.adminData = result;
  state.products = Array.isArray(result.products) ? result.products.map(item => ({ ...item })) : [];
  state.employees = Array.isArray(result.employees) ? result.employees.map(item => ({ ...item })) : [];
  state.paymentMethods = Array.isArray(result.paymentMethods) ? result.paymentMethods.map(item => ({ ...item })) : [];

  renderProductsAdminList();
  renderEmployeesAdminList();
  renderPaymentMethodsAdminList();
}

/* ---------------- PRODUCTS ---------------- */

function renderProductsAdminList() {
  const wrap = $('productsAdminList');
  if (!wrap) return;

  if (!state.products.length) {
    wrap.innerHTML = '<div class="list-item"><p>No products yet.</p></div>';
    return;
  }

  wrap.innerHTML = state.products.map((item, index) => `
    <div class="settings-entry-card">
      <div class="settings-entry-main">
        <div class="settings-entry-title">${escapeHtml(item.Name || item.name || 'Unnamed Product')}</div>
        <div class="settings-entry-sub">
          $${Number(item.Price || item.price || 0).toFixed(2)} · ${escapeHtml(item.Active || item.active || 'Yes')}
        </div>
      </div>
      <button type="button" class="btn btn-secondary" data-open-product="${index}">Update</button>
    </div>
  `).join('');

  wrap.querySelectorAll('[data-open-product]').forEach(btn => {
    btn.addEventListener('click', () => openProductModal(Number(btn.dataset.openProduct)));
  });
}

function openProductModal(index) {
  const item = index >= 0 ? (state.products[index] || {}) : {};

  setText('productModalTitle', index >= 0
    ? `UPDATE ${String(item.Name || item.name || 'PRODUCT').toUpperCase()}`
    : 'ADD PRODUCT'
  );

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

  if (index >= 0) state.products[index] = item;
  else state.products.push(item);

  renderProductsAdminList();
  closeProductModal();
}

function deleteProductModal() {
  const rawIndex = getValue('productModalIndex');
  const index = rawIndex === '' ? -1 : Number(rawIndex);

  if (index < 0) {
    closeProductModal();
    return;
  }

  const ok = window.confirm('Delete this product?');
  if (!ok) return;

  state.products.splice(index, 1);
  renderProductsAdminList();
  closeProductModal();
}

async function saveProductsNow() {
  showLoading('SAVING', 'Saving products...');

  try {
    const result = await api('saveProducts', authPayload({
      products: state.products.map(item => ({
        Name: item.Name || '',
        Price: Number(item.Price || 0),
        Active: item.Active || 'Yes'
      }))
    }));

    hideLoading();
    alert(result.message || 'Products saved.');

    if (result.ok) {
      await loadAdminData();
    }
  } catch (error) {
    hideLoading();
    alert(error.message || 'Could not save products.');
  }
}

/* ---------------- EMPLOYEES ---------------- */

function renderEmployeesAdminList() {
  const wrap = $('employeesAdminList');
  if (!wrap) return;

  if (!state.employees.length) {
    wrap.innerHTML = '<div class="list-item"><p>No employees yet.</p></div>';
    return;
  }

  wrap.innerHTML = state.employees.map((item, index) => `
    <div class="settings-entry-card">
      <div class="settings-entry-main">
        <div class="settings-entry-title">${escapeHtml(item.Name || 'Unnamed Employee')}</div>
        <div class="settings-entry-sub">
          ${escapeHtml(item.Role || 'Employee')} · ${escapeHtml(item.Active || 'Yes')}
        </div>
      </div>
      <button type="button" class="btn btn-secondary" data-open-employee="${index}">Update</button>
    </div>
  `).join('');

  wrap.querySelectorAll('[data-open-employee]').forEach(btn => {
    btn.addEventListener('click', () => openEmployeeModal(Number(btn.dataset.openEmployee)));
  });
}

function openEmployeeModal(index) {
  const item = index >= 0 ? (state.employees[index] || {}) : {};

  setText('employeeModalTitle', index >= 0
    ? `UPDATE ${String(item.Name || 'EMPLOYEE').toUpperCase()}`
    : 'ADD EMPLOYEE'
  );

  setValue('employeeModalIndex', index >= 0 ? index : '');
  setValue('employeeModalName', item.Name || '');
  setValue('employeeModalEmail', item.Email || '');
  setValue('employeeModalUsername', item.Username || '');
  setValue('employeeModalPin', item.PIN || '');
  setValue('employeeModalRole', item.Role || '');
  setValue('employeeModalActive', item.Active || 'Yes');

  showEl('employeeModalBackdrop');
  showEl('employeeModal');
}

function closeEmployeeModal() {
  hideEl('employeeModalBackdrop');
  hideEl('employeeModal');
}

function saveEmployeeModal() {
  const rawIndex = getValue('employeeModalIndex');
  const index = rawIndex === '' ? -1 : Number(rawIndex);

  const item = {
    Name: getValue('employeeModalName').trim(),
    Email: getValue('employeeModalEmail').trim(),
    Username: getValue('employeeModalUsername').trim(),
    PIN: getValue('employeeModalPin').trim(),
    Role: getValue('employeeModalRole').trim(),
    Active: getValue('employeeModalActive') || 'Yes'
  };

  if (!item.Name && !item.Email) {
    alert('Employee name or email is required.');
    return;
  }

  if (index >= 0) state.employees[index] = item;
  else state.employees.push(item);

  renderEmployeesAdminList();
  closeEmployeeModal();
}

function deleteEmployeeModal() {
  const rawIndex = getValue('employeeModalIndex');
  const index = rawIndex === '' ? -1 : Number(rawIndex);

  if (index < 0) {
    closeEmployeeModal();
    return;
  }

  const ok = window.confirm('Delete this employee?');
  if (!ok) return;

  state.employees.splice(index, 1);
  renderEmployeesAdminList();
  closeEmployeeModal();
}

async function saveEmployeesNow() {
  showLoading('SAVING', 'Saving employees...');

  try {
    const result = await api('saveEmployees', authPayload({
      employees: state.employees.map(item => ({
        Name: item.Name || '',
        Email: item.Email || '',
        Username: item.Username || '',
        PIN: item.PIN || '',
        Role: item.Role || '',
        Active: item.Active || 'Yes'
      }))
    }));

    hideLoading();
    alert(result.message || 'Employees saved.');

    if (result.ok) {
      await loadAdminData();
    }
  } catch (error) {
    hideLoading();
    alert(error.message || 'Could not save employees.');
  }
}

/* ---------------- PAYMENT METHODS ---------------- */

function renderPaymentMethodsAdminList() {
  const wrap = $('paymentMethodsAdminList');
  if (!wrap) return;

  if (!state.paymentMethods.length) {
    wrap.innerHTML = '<div class="list-item"><p>No payment methods yet.</p></div>';
    return;
  }

  wrap.innerHTML = state.paymentMethods.map((item, index) => `
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
  const item = index >= 0 ? (state.paymentMethods[index] || {}) : {};

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

  if (index >= 0) state.paymentMethods[index] = item;
  else state.paymentMethods.push(item);

  renderPaymentMethodsAdminList();
  closePaymentModal();
}

function deletePaymentModal() {
  const rawIndex = getValue('paymentModalIndex');
  const index = rawIndex === '' ? -1 : Number(rawIndex);

  if (index < 0) {
    closePaymentModal();
    return;
  }

  const ok = window.confirm('Delete this payment method?');
  if (!ok) return;

  state.paymentMethods.splice(index, 1);
  renderPaymentMethodsAdminList();
  closePaymentModal();
}

async function savePaymentMethodsNow() {
  showLoading('SAVING', 'Saving payment methods...');

  try {
    const result = await api('savePaymentMethods', authPayload({
      paymentMethods: state.paymentMethods.map(item => ({
        Name: item.Name || '',
        Active: item.Active || 'Yes'
      }))
    }));

    hideLoading();
    alert(result.message || 'Payment methods saved.');

    if (result.ok) {
      await loadAdminData();
    }
  } catch (error) {
    hideLoading();
    alert(error.message || 'Could not save payment methods.');
  }
}

/* ---------------- BUTTON HELPERS ---------------- */

function addProductRow() {
  openProductModal(-1);
}

function addEmployeeRow() {
  openEmployeeModal(-1);
}

function addPaymentMethodRow() {
  openPaymentModal(-1);
}

/* ---------------- EVENTS ---------------- */

function wireEvents() {
  $('loginBtn')?.addEventListener('click', loginNow);
  $('logoutBtn')?.addEventListener('click', logoutNow);
  $('portalRefreshBtn')?.addEventListener('click', portalRefreshNow);

  $('addProductRowBtn')?.addEventListener('click', addProductRow);
  $('saveProductsBtn')?.addEventListener('click', saveProductsNow);

  $('addEmployeeRowBtn')?.addEventListener('click', addEmployeeRow);
  $('saveEmployeesBtn')?.addEventListener('click', saveEmployeesNow);

  $('addPaymentMethodRowBtn')?.addEventListener('click', addPaymentMethodRow);
  $('savePaymentMethodsBtn')?.addEventListener('click', savePaymentMethodsNow);

  $('productModalClose')?.addEventListener('click', closeProductModal);
  $('productModalCancel')?.addEventListener('click', closeProductModal);
  $('productModalSave')?.addEventListener('click', saveProductModal);
  $('productModalDelete')?.addEventListener('click', deleteProductModal);
  $('productModalBackdrop')?.addEventListener('click', closeProductModal);

  $('employeeModalClose')?.addEventListener('click', closeEmployeeModal);
  $('employeeModalCancel')?.addEventListener('click', closeEmployeeModal);
  $('employeeModalSave')?.addEventListener('click', saveEmployeeModal);
  $('employeeModalDelete')?.addEventListener('click', deleteEmployeeModal);
  $('employeeModalBackdrop')?.addEventListener('click', closeEmployeeModal);

  $('paymentModalCancel')?.addEventListener('click', closePaymentModal);
  $('paymentModalSave')?.addEventListener('click', savePaymentModal);
  $('paymentModalDelete')?.addEventListener('click', deletePaymentModal);
  $('paymentModalBackdrop')?.addEventListener('click', closePaymentModal);

  $('loginValue')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') loginNow();
  });

  $('loginPin')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') loginNow();
  });
}

function init() {
  wireEvents();
}

init();
