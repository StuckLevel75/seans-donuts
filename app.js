const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbyxM4N--Ee9shmW6VmDtLl46aJGrabSBxPhhZMlV1OXEDTMUeyuSavuBu93VoZNnfHVPQ/exec";

const state = {
  apiUrl: localStorage.getItem("sd_api_url") || DEFAULT_API_URL,
  session: null,
  bootstrap: null,
  products: [],
  cart: {},
  activeTab: "dashboard"
};

const tabs = [
  { key: "dashboard", label: "Dashboard" },
  { key: "pos", label: "POS" },
  { key: "orders", label: "Orders" },
  { key: "rewards", label: "Rewards" },
  { key: "raffle", label: "Raffle" },
  { key: "payroll", label: "Payroll" },
  { key: "settings", label: "Settings", ownerOnly: true }
];

function $(id) {
  return document.getElementById(id);
}

function safeSetText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function safeSetValue(id, value) {
  const el = $(id);
  if (el) el.value = value;
}

function money(v) {
  return `$${Number(v || 0).toFixed(2)}`;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showMessage(elId, text, type = "info") {
  const el = $(elId);
  if (!el) return;
  el.textContent = text || "";
  el.className = `message ${text ? `show ${type}` : ""}`.trim();
}

function requireApiUrl() {
  if (!state.apiUrl) {
    showMessage("loginMsg", "Paste your Apps Script Web App URL first.", "error");
    return false;
  }
  return true;
}

async function api(action, payload = {}) {
  if (!state.apiUrl) {
    throw new Error("Missing Apps Script URL.");
  }

  const response = await fetch(state.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, payload })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.json();
}

function saveApiUrl() {
  const input = $("apiUrl");
  if (!input) return;
  const value = input.value.trim();
  state.apiUrl = value;
  localStorage.setItem("sd_api_url", value);
  showMessage("loginMsg", value ? "Apps Script URL saved." : "Apps Script URL cleared.", "success");
}

function renderNav() {
  const nav = $("navTabs");
  if (!nav) return;

  const isOwner = !!(state.session?.permissions?.isOwner || state.session?.permissions?.isAdmin);

  nav.innerHTML = tabs
    .filter(tab => !tab.ownerOnly || isOwner)
    .map(tab => `
      <button class="nav-btn ${state.activeTab === tab.key ? "active" : ""}" type="button" data-tab="${tab.key}">
        ${tab.label}
      </button>
    `)
    .join("");

  nav.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });
}

function activateTab(tab) {
  state.activeTab = tab;
  renderNav();

  const map = {
    dashboard: "dashboardSection",
    pos: "posSection",
    orders: "ordersSection",
    rewards: "rewardsSection",
    raffle: "raffleSection",
    payroll: "payrollSection",
    settings: "settingsSection"
  };

  Object.values(map).forEach(id => {
    const el = $(id);
    if (el) el.classList.add("hidden");
  });

  const active = $(map[tab]);
  if (active) active.classList.remove("hidden");
}

function buildProductGrid() {
  const grid = $("productGrid");
  if (!grid) return;

  if (!state.products.length) {
    grid.innerHTML = `<div class="list-item"><p>No products returned yet.</p></div>`;
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
  }).join("");

  grid.querySelectorAll("[data-qty]").forEach(btn => {
    btn.addEventListener("click", () => {
      const product = state.products[Number(btn.dataset.index)];
      if (!product) return;

      const current = Number(state.cart[product.name] || 0);
      const next = btn.dataset.qty === "up" ? current + 1 : Math.max(0, current - 1);

      if (next <= 0) {
        delete state.cart[product.name];
      } else {
        state.cart[product.name] = next;
      }

      buildProductGrid();
      renderCart();
    });
  });
}

function renderCart() {
  const list = $("cartList");
  if (!list) return;

  const items = Object.entries(state.cart).map(([name, qty]) => {
    const product = state.products.find(p => p.name === name);
    const price = Number(product?.price || 0);
    return {
      name,
      qty: Number(qty || 0),
      price,
      total: price * Number(qty || 0)
    };
  });

  if (!items.length) {
    list.innerHTML = `<div class="list-item"><p>Empty cart</p></div>`;
  } else {
    list.innerHTML = items.map(item => `
      <div class="list-item">
        <h4>${escapeHtml(item.name)}</h4>
        <p>${item.qty} × ${money(item.price)} = <strong>${money(item.total)}</strong></p>
      </div>
    `).join("");
  }

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const discount = Number($("discountInput")?.value || 0);
  const tip = Number($("tipInput")?.value || 0);
  const total = Math.max(0, subtotal - discount + tip);

  safeSetText("subtotalText", money(subtotal));
  safeSetText("discountText", money(discount));
  safeSetText("tipText", money(tip));
  safeSetText("totalText", money(total));
}

function fillPortalHeader() {
  const settings = state.bootstrap?.settings || {};
  const session = state.session || {};

  safeSetText("portalName", settings.portalName || "Sean's Donuts");
  safeSetText("portalSubtitle", settings.portalSubtitle || "Employee Portal");
  safeSetText("dashboardPortalName", settings.portalName || "Sean's Donuts");
  safeSetText("dashboardPortalSubtitle", settings.portalSubtitle || "Employee Portal");
  safeSetText("dashboardBankId", session.portalPrefs?.bankId || settings.bankId || "24596194");
  safeSetText("welcomeTitle", `Welcome, ${session.employee?.name || "Employee"}`);
  safeSetText("announcementBar", session.portalPrefs?.announcement || settings.dashboardMessage || "Welcome to Sean's Donuts Portal");
  safeSetText("bankIdText", session.portalPrefs?.bankId || settings.bankId || "24596194");
  safeSetText("userBadge", `${session.employee?.name || "Portal User"} · ${session.employee?.role || "Employee"}`);
  safeSetText("sessionStatus", "Signed in");
  safeSetText("sessionRole", session.employee?.role || "Employee");

  const logoutBtn = $("logoutBtn");
  if (logoutBtn) logoutBtn.classList.remove("hidden");

  safeSetValue("settingsAnnouncement", session.portalPrefs?.announcement || "");
  safeSetValue("settingsBankId", session.portalPrefs?.bankId || settings.bankId || "24596194");
}

function renderBootstrap() {
  const stats = state.bootstrap?.stats || {};
  const announcements = state.bootstrap?.announcements || [];
  const settings = state.bootstrap?.settings || {};

  safeSetText("statOrders", Number(stats.totalOrders || 0));
  safeSetText("statSales", money(stats.totalSales || 0));
  safeSetText("statEmployees", Number(stats.activeEmployees || 0));
  safeSetText("statRaffle", Number(stats.raffleEntries || 0));

  const announcementsList = $("announcementsList");
  if (announcementsList) {
    announcementsList.innerHTML = announcements.length
      ? announcements.map(item => `
          <div class="list-item">
            <h4>${escapeHtml(item.title || "Announcement")}</h4>
            <p>${escapeHtml(item.message || "")}</p>
          </div>
        `).join("")
      : `<div class="list-item"><p>No active announcements.</p></div>`;
  }

  const methods = Array.isArray(settings.paymentMethods) && settings.paymentMethods.length
    ? settings.paymentMethods
    : ["Cash", "Invoice", "Bank ID"];

  const paymentMethod = $("paymentMethod");
  if (paymentMethod) {
    paymentMethod.innerHTML = methods
      .map(method => `<option value="${escapeHtml(method)}">${escapeHtml(method)}</option>`)
      .join("");
  }
}

async function loadBootstrap() {
  const result = await api("getPortalBootstrap");
  if (!result.ok) throw new Error(result.message || "Could not load portal bootstrap.");
  state.bootstrap = result;
  renderBootstrap();
}

async function loginNow() {
  if (!requireApiUrl()) return;

  showMessage("loginMsg", "Signing in...", "info");

  try {
    const email = $("loginValue")?.value.trim() || "";
    const pin = $("loginPin")?.value.trim() || "";

    const result = await api("login", { email, pin });

    if (!result.ok) {
      showMessage("loginMsg", result.message || "Login failed.", "error");
      return;
    }

    state.session = result;
    state.products = result.products || [];

    await loadBootstrap();
    fillPortalHeader();
    buildProductGrid();
    renderCart();
    renderNav();

    const loginView = $("loginView");
    const portalView = $("portalView");
    if (loginView) loginView.classList.add("hidden");
    if (portalView) portalView.classList.remove("hidden");

    activateTab("dashboard");

    await Promise.allSettled([
      loadOrders(),
      loadRaffle(),
      loadPayroll(),
      loadRewards(true)
    ]);

    showMessage("loginMsg", "", "success");
  } catch (error) {
    showMessage("loginMsg", error.message || "Could not sign in.", "error");
  }
}

function logoutNow() {
  state.session = null;
  state.bootstrap = null;
  state.products = [];
  state.cart = {};

  const portalView = $("portalView");
  const loginView = $("loginView");
  const logoutBtn = $("logoutBtn");

  if (portalView) portalView.classList.add("hidden");
  if (loginView) loginView.classList.remove("hidden");
  if (logoutBtn) logoutBtn.classList.add("hidden");

  safeSetText("sessionStatus", "Signed out");
  safeSetText("sessionRole", "—");
  safeSetText("userBadge", "Portal User");

  renderNav();
}

async function submitOrder() {
  if (!state.session) return;

  const items = Object.entries(state.cart)
    .filter(([, qty]) => Number(qty) > 0)
    .map(([name, qty]) => ({ name, qty: Number(qty) }));

  if (!items.length) {
    showMessage("orderMsg", "Add at least one product.", "error");
    return;
  }

  showMessage("orderMsg", "Submitting order...", "info");

  try {
    const payload = {
      email: state.session.employee?.email || state.session.employee?.username || "",
      pin: $("loginPin")?.value.trim() || "",
      customerName: $("customerName")?.value.trim() || "",
      phoneNumber: $("phoneNumber")?.value.trim() || "",
      items,
      discount: Number($("discountInput")?.value || 0),
      tip: Number($("tipInput")?.value || 0),
      paymentMethod: $("paymentMethod")?.value || "",
      notes: $("notes")?.value.trim() || ""
    };

    const result = await api("submitOrder", payload);

    if (!result.ok) {
      showMessage("orderMsg", result.message || "Order failed.", "error");
      return;
    }

    state.cart = {};
    buildProductGrid();
    renderCart();

    safeSetValue("customerName", "");
    safeSetValue("phoneNumber", "");
    safeSetValue("discountInput", "0");
    safeSetValue("tipInput", "0");
    safeSetValue("notes", "");

    showMessage("orderMsg", result.message || "Order submitted.", "success");

    await Promise.allSettled([loadOrders(), loadBootstrap()]);
    fillPortalHeader();
  } catch (error) {
    showMessage("orderMsg", error.message || "Order failed.", "error");
  }
}

async function loadOrders() {
  if (!state.session) return;

  const query = $("orderSearchInput")?.value.trim() || "";
  const list = $("ordersList");
  if (!list) return;

  list.innerHTML = `<div class="list-item"><p>Loading orders...</p></div>`;

  try {
    const result = await api("searchOrders", {
      email: state.session.employee?.email || state.session.employee?.username || "",
      pin: $("loginPin")?.value.trim() || "",
      query
    });

    const rows = result.results || [];
    list.innerHTML = rows.length
      ? rows.map(row => `
          <div class="list-item">
            <h4>${escapeHtml(row["Order Number"] || "Order")}</h4>
            <p>${escapeHtml(row["Customer Name"] || "No customer")} · ${money(row["Total"] || 0)}</p>
          </div>
        `).join("")
      : `<div class="list-item"><p>No orders found.</p></div>`;
  } catch (error) {
    list.innerHTML = `<div class="list-item"><p>${escapeHtml(error.message || "Could not load orders.")}</p></div>`;
  }
}

async function loadRewards(silent = false) {
  if (!state.session) return;

  const customerName = $("rewardCustomerName")?.value.trim() || $("customerName")?.value.trim() || "";

  if (!customerName && !silent) {
    showMessage("rewardsMsg", "Enter a customer name first.", "error");
    return;
  }

  if (!silent) showMessage("rewardsMsg", "Loading rewards...", "info");

  try {
    const result = await api("lookupRewards", {
      email: state.session.employee?.email || state.session.employee?.username || "",
      pin: $("loginPin")?.value.trim() || "",
      customerName
    });

    const data = result.reward || {};

    safeSetText("rewardVisits", Number(data.visits || 0));
    safeSetText("rewardProgress", `${Number(data.visitProgress || 0)} / 10`);
    safeSetText("rewardAvailable", Number(data.rewardsAvailable || 0));
    safeSetText("rewardRedeemed", Number(data.totalRewardsRedeemed || 0));
    safeSetText("rewardLastVisit", data.lastVisit || "—");
    safeSetText("rewardLastOrder", data.lastOrderNumber || "—");

    if (!silent) showMessage("rewardsMsg", "Rewards loaded.", "success");
  } catch (error) {
    if (!silent) showMessage("rewardsMsg", error.message || "Could not load rewards.", "error");
  }
}

async function loadRaffle() {
  if (!state.session) return;

  const list = $("raffleList");
  if (!list) return;

  list.innerHTML = `<div class="list-item"><p>Loading raffle...</p></div>`;

  try {
    const result = await api("loadRaffleOverview", {
      email: state.session.employee?.email || state.session.employee?.username || "",
      pin: $("loginPin")?.value.trim() || ""
    });

    const rows = result.entries || [];
    list.innerHTML = rows.length
      ? rows.map(row => `
          <div class="list-item">
            <h4>${escapeHtml(row["Customer Name"] || "Entry")}</h4>
            <p>Tickets: ${Number(row["Tickets Bought"] || 0)}</p>
          </div>
        `).join("")
      : `<div class="list-item"><p>No raffle entries found.</p></div>`;
  } catch (error) {
    list.innerHTML = `<div class="list-item"><p>${escapeHtml(error.message || "Could not load raffle.")}</p></div>`;
  }
}

async function loadPayroll() {
  if (!state.session) return;

  const list = $("payrollList");
  if (!list) return;

  list.innerHTML = `<div class="list-item"><p>Loading payroll...</p></div>`;

  try {
    const result = await api("loadPayroll", {
      email: state.session.employee?.email || state.session.employee?.username || "",
      pin: $("loginPin")?.value.trim() || "",
      startDate: $("payrollStartDate")?.value || "",
      endDate: $("payrollEndDate")?.value || ""
    });

    const rows = result.rows || [];
    list.innerHTML = rows.length
      ? rows.map(row => `
          <div class="list-item">
            <h4>${escapeHtml(row["Employee"] || "Employee")}</h4>
            <p>Total Pay: ${money(row["Total Pay"] || 0)} · Orders: ${Number(row["Orders"] || 0)}</p>
          </div>
        `).join("")
      : `<div class="list-item"><p>No payroll rows found.</p></div>`;
  } catch (error) {
    list.innerHTML = `<div class="list-item"><p>${escapeHtml(error.message || "Could not load payroll.")}</p></div>`;
  }
}

async function saveSettings() {
  if (!state.session) return;

  showMessage("settingsMsg", "Saving settings...", "info");

  try {
    const result = await api("saveSettings", {
      email: state.session.employee?.email || state.session.employee?.username || "",
      pin: $("loginPin")?.value.trim() || "",
      announcement: $("settingsAnnouncement")?.value.trim() || "",
      bankId: $("settingsBankId")?.value.trim() || "",
      portalTheme: $("settingsTheme")?.value || "classic"
    });

    if (!result.ok) {
      throw new Error(result.message || "Could not save settings.");
    }

    state.session.portalPrefs = {
      ...(state.session.portalPrefs || {}),
      announcement: $("settingsAnnouncement")?.value.trim() || "",
      bankId: $("settingsBankId")?.value.trim() || "",
      portalTheme: $("settingsTheme")?.value || "classic"
    };

    fillPortalHeader();
    showMessage("settingsMsg", result.message || "Settings saved.", "success");
  } catch (error) {
    showMessage("settingsMsg", error.message || "Could not save settings.", "error");
  }
}

function setDefaultDates() {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);

  safeSetValue("payrollStartDate", first.toISOString().slice(0, 10));
  safeSetValue("payrollEndDate", today.toISOString().slice(0, 10));
}

function wireEvents() {
  safeSetValue("apiUrl", state.apiUrl);

  $("saveApiUrlBtn")?.addEventListener("click", saveApiUrl);
  $("loginBtn")?.addEventListener("click", loginNow);
  $("logoutBtn")?.addEventListener("click", logoutNow);
  $("demoFillBtn")?.addEventListener("click", () => {
    safeSetValue("loginValue", "owner");
    safeSetValue("loginPin", "1234");
  });
  $("submitOrderBtn")?.addEventListener("click", submitOrder);
  $("searchOrdersBtn")?.addEventListener("click", loadOrders);
  $("lookupRewardsBtn")?.addEventListener("click", () => loadRewards(false));
  $("loadPayrollBtn")?.addEventListener("click", loadPayroll);
  $("saveSettingsBtn")?.addEventListener("click", saveSettings);
  $("discountInput")?.addEventListener("input", renderCart);
  $("tipInput")?.addEventListener("input", renderCart);
}

function init() {
  renderNav();
  wireEvents();
  setDefaultDates();
}

document.addEventListener("DOMContentLoaded", init);
