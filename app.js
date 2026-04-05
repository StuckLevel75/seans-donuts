window.onload = function () {
  var DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbw8QmZ4jl1ym9RwOlqP5_9XVgQNxAZiyMkA9YVYT9ag4dM-BPHaurTIw0aULBJDL5Xvwg/exec";

  var state = {
    apiUrl: DEFAULT_API_URL,
    session: null,
    bootstrap: null,
    products: [],
    cart: {},
    activeTab: "dashboard",
    lastManualEdit: null
  };

  var sectionMap = {
    dashboard: "dashboardSection",
    pos: "posSection",
    orders: "ordersSection",
    rewards: "rewardsSection",
    raffle: "raffleSection",
    payroll: "payrollSection",
    portal: "portalSettingsSection",
    products: "productsSection",
    employees: "employeesSection"
  };

  function el(id) {
    return document.getElementById(id);
  }

  function money(value) {
    return "$" + Number(value || 0).toFixed(2);
  }

  function round2(value) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  function escapeHtml(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showMessage(id, text, type) {
    var node = el(id);
    if (!node) return;
    node.textContent = text || "";
    node.className = text ? "message show " + (type || "info") : "message";
  }

  function safeText(id, text) {
    var node = el(id);
    if (node) node.textContent = text == null ? "" : text;
  }

  function safeValue(id, value) {
    var node = el(id);
    if (node) node.value = value == null ? "" : value;
  }

  function getNumericValue(id) {
    var node = el(id);
    return Number((node && node.value) || 0);
  }

  function can(permissionKey) {
    return !!(state.session && state.session.permissions && state.session.permissions[permissionKey]);
  }

  async function api(action, payload) {
    var res = await fetch(state.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: action,
        payload: payload || {}
      })
    });

    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }

    return await res.json();
  }

  function applyTheme(theme) {
    if (!theme) return;
    var root = document.documentElement;
    if (theme.primary) root.style.setProperty("--primary", theme.primary);
    if (theme.primaryDark) root.style.setProperty("--primary-dark", theme.primaryDark);
    if (theme.secondary) root.style.setProperty("--secondary", theme.secondary);
    if (theme.bg) root.style.setProperty("--bg", theme.bg);
    if (theme.card) root.style.setProperty("--card", theme.card);
    if (theme.text) root.style.setProperty("--text", theme.text);
    if (theme.muted) root.style.setProperty("--muted", theme.muted);
    if (theme.border) root.style.setProperty("--border", theme.border);
  }

  function applyBranding(branding) {
    if (!branding) return;

    var settings = branding.settings || {};
    var uiText = branding.uiText || {};
    var theme = branding.theme || {};
    var paymentMethods = branding.paymentMethods || ["Cash", "Invoice", "Bank ID"];

    applyTheme(theme);

    safeText("portalName", settings.portalName || "Sean's Donuts");
    safeText("portalSubtitle", settings.portalSubtitle || "Employee Portal");
    safeText("dashboardPortalName", settings.portalName || "Sean's Donuts");
    safeText("dashboardPortalSubtitle", settings.portalSubtitle || "Employee Portal");
    safeText("dashboardBankId", settings.bankId || "24596194");
    safeText("bankIdText", settings.bankId || "24596194");
    safeText("announcementBar", settings.announcement || "Welcome to Sean's Donuts Portal");
    safeText("loginTitle", uiText.loginTitle || "Sean's Donuts Portal");
    safeText("loginSubtitle", uiText.loginSubtitle || "Sign in with your username or email and PIN.");
    safeText("dashboardTitle", uiText.dashboardTitle || "Portal overview");
    safeText("posTitle", uiText.posTitle || "Create a new order");
    safeText("ordersTitle", uiText.ordersTitle || "Search recent orders");
    safeText("rewardsTitle", uiText.rewardsTitle || "Lookup customer rewards");
    safeText("raffleTitle", uiText.raffleTitle || "Recent raffle entries");
    safeText("payrollTitle", uiText.payrollTitle || "View payroll rows");
    safeText("portalSettingsTitle", uiText.portalSettingsTitle || "Portal settings");
    safeText("loginLogo", settings.logoEmoji || "🍩");
    safeText("brandLogo", settings.logoEmoji || "🍩");

    safeValue("cfgPortalName", settings.portalName || "");
    safeValue("cfgPortalSubtitle", settings.portalSubtitle || "");
    safeValue("cfgBankId", settings.bankId || "");
    safeValue("cfgAnnouncement", settings.announcement || "");
    safeValue("cfgLogoEmoji", settings.logoEmoji || "");
    safeValue("cfgLoginTitle", uiText.loginTitle || "");
    safeValue("cfgLoginSubtitle", uiText.loginSubtitle || "");
    safeValue("themePrimary", theme.primary || "#f28c18");
    safeValue("themePrimaryDark", theme.primaryDark || "#de7c0c");
    safeValue("themeSecondary", theme.secondary || "#6c4330");
    safeValue("themeBg", theme.bg || "#fdf4ea");
    safeValue("themeCard", theme.card || "#ffffff");
    safeValue("themeText", theme.text || "#4a2e22");
    safeValue("themeMuted", theme.muted || "#8a6a5a");
    safeValue("themeBorder", theme.border || "#edc9a5");
    safeValue("cfgPaymentMethods", paymentMethods.join("\n"));

    var paymentMethod = el("paymentMethod");
    if (paymentMethod) {
      var html = "";
      for (var i = 0; i < paymentMethods.length; i++) {
        html += '<option value="' + escapeHtml(paymentMethods[i]) + '">' + escapeHtml(paymentMethods[i]) + "</option>";
      }
      paymentMethod.innerHTML = html;
    }
  }

  function hideAllSections() {
    for (var key in sectionMap) {
      if (sectionMap.hasOwnProperty(key)) {
        var node = el(sectionMap[key]);
        if (node) node.classList.add("hidden");
      }
    }
  }

  function activateTab(tabKey) {
    state.activeTab = tabKey;
    hideAllSections();

    var sectionId = sectionMap[tabKey];
    if (sectionId && el(sectionId)) {
      el(sectionId).classList.remove("hidden");
    }

    var buttons = document.querySelectorAll(".nav-btn");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.remove("active");
      if (buttons[i].getAttribute("data-tab") === tabKey) {
        buttons[i].classList.add("active");
      }
    }
  }

  function renderNav() {
    var nav = el("navTabs");
    if (!nav) return;

    var items = [];
    if (can("canViewDashboard")) items.push({ key: "dashboard", label: "Dashboard" });
    if (can("canUsePOS")) items.push({ key: "pos", label: "POS" });
    if (can("canViewOrders")) items.push({ key: "orders", label: "Orders" });
    if (can("canViewRewards")) items.push({ key: "rewards", label: "Rewards" });
    if (can("canViewRaffle")) items.push({ key: "raffle", label: "Raffle" });
    if (can("canViewPayroll")) items.push({ key: "payroll", label: "Payroll" });
    if (can("canViewPortalSettings")) items.push({ key: "portal", label: "Portal" });
    if (can("canManageProducts")) items.push({ key: "products", label: "Products" });
    if (can("canManageEmployees")) items.push({ key: "employees", label: "Employees" });

    if (!items.length) return;

    if (!items.some(function (item) { return item.key === state.activeTab; })) {
      state.activeTab = items[0].key;
    }

    var html = "";
    for (var i = 0; i < items.length; i++) {
      html += '<button type="button" class="nav-btn' +
        (state.activeTab === items[i].key ? " active" : "") +
        '" data-tab="' + items[i].key + '">' + items[i].label + "</button>";
    }
    nav.innerHTML = html;

    var buttons = nav.querySelectorAll(".nav-btn");
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].onclick = function () {
        activateTab(this.getAttribute("data-tab"));
      };
    }
  }

  function applySectionVisibility() {
    if (el("ordersSection")) el("ordersSection").classList.toggle("hidden", !can("canViewOrders"));
    if (el("rewardsSection")) el("rewardsSection").classList.toggle("hidden", !can("canViewRewards"));
    if (el("raffleSection")) el("raffleSection").classList.toggle("hidden", !can("canViewRaffle"));
    if (el("payrollSection")) el("payrollSection").classList.toggle("hidden", !can("canViewPayroll"));
    if (el("portalSettingsSection")) el("portalSettingsSection").classList.toggle("hidden", !can("canViewPortalSettings"));
    if (el("productsSection")) el("productsSection").classList.toggle("hidden", !can("canManageProducts"));
    if (el("employeesSection")) el("employeesSection").classList.toggle("hidden", !can("canManageEmployees"));
    if (el("posSection")) el("posSection").classList.toggle("hidden", !can("canUsePOS"));
    if (el("dashboardSection")) el("dashboardSection").classList.toggle("hidden", !can("canViewDashboard"));
    if (el("ownerOverrideBox")) el("ownerOverrideBox").classList.toggle("hidden", !can("canOverrideCheckout"));
  }

  function renderStats(stats) {
    safeText("statOrders", String(Number(stats.totalOrders || 0)));
    safeText("statSales", money(stats.totalSales || 0));
    safeText("statEmployees", String(Number(stats.activeEmployees || 0)));
    safeText("statRaffle", String(Number(stats.raffleEntries || 0)));
  }

  function renderAnnouncements(announcements) {
    var list = el("announcementsList");
    if (!list) return;

    if (!announcements || !announcements.length) {
      list.innerHTML = '<div class="list-item"><p>No active announcements.</p></div>';
      return;
    }

    var html = "";
    for (var i = 0; i < announcements.length; i++) {
      html += '<div class="list-item"><h4>' + escapeHtml(announcements[i].title || "Announcement") +
        '</h4><p>' + escapeHtml(announcements[i].message || "") + "</p></div>";
    }
    list.innerHTML = html;
  }

  function getBaseTotal() {
    var subtotal = 0;
    for (var name in state.cart) {
      if (state.cart.hasOwnProperty(name)) {
        var qty = Number(state.cart[name] || 0);
        if (qty <= 0) continue;
        for (var i = 0; i < state.products.length; i++) {
          if (state.products[i].name === name) {
            subtotal += Number(state.products[i].price || 0) * qty;
            break;
          }
        }
      }
    }
    return round2(subtotal + getNumericValue("mileageInput"));
  }

  function syncPaidDerivedFields() {
    if (can("canOverrideCheckout") && (state.lastManualEdit === "discount" || state.lastManualEdit === "tip")) return;

    var amountPaidEl = el("amountPaidInput");
    var discountEl = el("discountInput");
    var tipEl = el("tipInput");
    if (!amountPaidEl || !discountEl || !tipEl) return;

    var baseTotal = getBaseTotal();
    var amountPaid = round2(Number(amountPaidEl.value || 0));

    if (amountPaid <= 0) {
      discountEl.value = "0";
      tipEl.value = "0";
      return;
    }

    if (amountPaid >= baseTotal) {
      discountEl.value = "0";
      tipEl.value = String(round2(amountPaid - baseTotal));
    } else {
      discountEl.value = String(round2(baseTotal - amountPaid));
      tipEl.value = "0";
    }
  }

  function syncAmountPaidFromManualFields() {
    var amountPaidEl = el("amountPaidInput");
    if (!amountPaidEl) return;
    var amountPaid = round2(getBaseTotal() - getNumericValue("discountInput") + getNumericValue("tipInput"));
    amountPaidEl.value = String(Math.max(0, amountPaid));
  }

  function buildProductGrid() {
    var grid = el("productGrid");
    if (!grid) return;

    if (!state.products.length) {
      grid.innerHTML = '<div class="list-item"><p>No products returned yet.</p></div>';
      return;
    }

    var html = "";
    for (var i = 0; i < state.products.length; i++) {
      var product = state.products[i];
      var qty = Number(state.cart[product.name] || 0);

      html += '<div class="product-card"><h4>' + escapeHtml(product.name) + '</h4>' +
        '<div class="product-price">' + money(product.price) + '</div>' +
        '<div class="qty-row">' +
        '<button type="button" data-dir="down" data-index="' + i + '">−</button>' +
        '<div class="qty-pill">' + qty + '</div>' +
        '<button type="button" data-dir="up" data-index="' + i + '">+</button>' +
        '</div></div>';
    }
    grid.innerHTML = html;

    var buttons = grid.querySelectorAll("[data-dir]");
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].onclick = function () {
        var index = Number(this.getAttribute("data-index"));
        var dir = this.getAttribute("data-dir");
        var product = state.products[index];
        if (!product) return;

        var current = Number(state.cart[product.name] || 0);
        var next = dir === "up" ? current + 1 : Math.max(0, current - 1);

        if (next <= 0) delete state.cart[product.name];
        else state.cart[product.name] = next;

        if (can("canOverrideCheckout") && (state.lastManualEdit === "discount" || state.lastManualEdit === "tip")) {
          syncAmountPaidFromManualFields();
        } else {
          syncPaidDerivedFields();
        }

        buildProductGrid();
        renderCart();
      };
    }
  }

  function renderCart() {
    var list = el("cartList");
    if (!list) return;

    var items = [];
    for (var name in state.cart) {
      if (state.cart.hasOwnProperty(name)) {
        var qty = Number(state.cart[name] || 0);
        if (qty <= 0) continue;

        var price = 0;
        for (var i = 0; i < state.products.length; i++) {
          if (state.products[i].name === name) {
            price = Number(state.products[i].price || 0);
            break;
          }
        }

        items.push({ name: name, qty: qty, price: price, total: price * qty });
      }
    }

    if (!items.length) {
      list.innerHTML = '<div class="list-item"><p>Empty cart</p></div>';
    } else {
      var html = "";
      for (var j = 0; j < items.length; j++) {
        html += '<div class="list-item"><h4>' + escapeHtml(items[j].name) + '</h4><p>' +
          items[j].qty + ' × ' + money(items[j].price) + ' = <strong>' + money(items[j].total) + "</strong></p></div>";
      }
      list.innerHTML = html;
    }

    var subtotal = 0;
    for (var k = 0; k < items.length; k++) subtotal += items[k].total;

    safeText("subtotalText", money(subtotal));
    safeText("discountText", money(getNumericValue("discountInput")));
    safeText("tipText", money(getNumericValue("tipInput")));
    safeText("mileageText", money(getNumericValue("mileageInput")));
    safeText("amountPaidText", money(getNumericValue("amountPaidInput")));
    safeText("totalText", money(Math.max(0, round2(
      subtotal - getNumericValue("discountInput") + getNumericValue("tipInput") + getNumericValue("mileageInput")
    ))));
  }

  async function loadBootstrap() {
    var result = await api("getPortalBootstrap", {});
    if (!result.ok) throw new Error(result.message || "Could not load dashboard.");
    state.bootstrap = result;
    applyBranding(result.branding);
    renderStats(result.stats || {});
    renderAnnouncements(result.announcements || []);
  }

  async function loginNow() {
    showMessage("loginMsg", "Signing in...", "info");

    try {
      var loginValue = (el("loginValue").value || "").trim();
      var loginPin = (el("loginPin").value || "").trim();

      var result = await api("login", { email: loginValue, pin: loginPin });

      if (!result.ok) {
        showMessage("loginMsg", result.message || "Login failed.", "error");
        return;
      }

      state.session = result;
      state.products = result.products || [];

      applyBranding(result.branding);
      applySectionVisibility();
      buildProductGrid();
      renderCart();
      renderNav();

      if (el("loginView")) el("loginView").classList.add("hidden");
      if (el("portalView")) el("portalView").classList.remove("hidden");

      safeText("sessionStatus", "Signed in");
      safeText("sessionRole", result.employee.role || "Employee");
      safeText("userBadge", (result.employee.name || "Portal User") + " · " + (result.employee.role || "Employee"));
      safeText("welcomeTitle", "Welcome, " + (result.employee.name || "Employee"));

      await loadBootstrap();
      activateTab(state.activeTab);
      showMessage("loginMsg", "", "success");
    } catch (err) {
      showMessage("loginMsg", err.message || "Failed to connect to backend.", "error");
    }
  }

  function wireEvents() {
    if (el("loginBtn")) el("loginBtn").onclick = loginNow;
    if (el("logoutBtn")) el("logoutBtn").onclick = logoutNow;

    if (el("mileageInput")) {
      el("mileageInput").oninput = function () {
        syncPaidDerivedFields();
        renderCart();
      };
    }

    if (el("amountPaidInput")) {
      el("amountPaidInput").oninput = function () {
        state.lastManualEdit = "amountPaid";
        syncPaidDerivedFields();
        renderCart();
      };
    }

    if (el("discountInput")) {
      el("discountInput").oninput = function () {
        if (!can("canOverrideCheckout")) return;
        state.lastManualEdit = "discount";
        if (el("tipInput")) el("tipInput").value = "0";
        syncAmountPaidFromManualFields();
        renderCart();
      };
    }

    if (el("tipInput")) {
      el("tipInput").oninput = function () {
        if (!can("canOverrideCheckout")) return;
        state.lastManualEdit = "tip";
        if (el("discountInput")) el("discountInput").value = "0";
        syncAmountPaidFromManualFields();
        renderCart();
      };
    }
  }

  function logoutNow() {
    state.session = null;
    state.bootstrap = null;
    state.products = [];
    state.cart = {};
    state.activeTab = "dashboard";
    state.lastManualEdit = null;

    if (el("loginView")) el("loginView").classList.remove("hidden");
    if (el("portalView")) el("portalView").classList.add("hidden");
    if (el("navTabs")) el("navTabs").innerHTML = "";
  }

  function init() {
    wireEvents();
    hideAllSections();
    renderCart();
  }

  init();
};
