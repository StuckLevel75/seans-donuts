window.onload = function () {
  var DEFAULT_API_URL = "";

  var state = {
    apiUrl: "",
    session: null,
    bootstrap: null,
    products: [],
    cart: {},
    activeTab: "dashboard"
  };

  var sectionMap = {
    dashboard: "dashboardSection",
    pos: "posSection",
    orders: "ordersSection",
    rewards: "rewardsSection",
    raffle: "raffleSection",
    payroll: "payrollSection",
    settings: "settingsSection"
  };

  function el(id) {
    return document.getElementById(id);
  }

  function money(value) {
    return "$" + Number(value || 0).toFixed(2);
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
    if (node) node.textContent = text;
  }

  function safeValue(id, value) {
    var node = el(id);
    if (node) node.value = value;
  }

  function getSavedApiUrl() {
    return localStorage.getItem("sd_api_url") || DEFAULT_API_URL || "";
  }

  function saveApiUrl() {
    var value = (el("apiUrl").value || "").trim();
    state.apiUrl = value;
    localStorage.setItem("sd_api_url", value);
    showMessage("loginMsg", value ? "API URL saved." : "API URL cleared.", "success");
  }

  async function api(action, payload) {
    var url = state.apiUrl || getSavedApiUrl();
    if (!url) throw new Error("Missing Apps Script URL.");

    var res = await fetch(url, {
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

    var items = [
      { key: "dashboard", label: "Dashboard" },
      { key: "pos", label: "POS" },
      { key: "orders", label: "Orders" },
      { key: "rewards", label: "Rewards" },
      { key: "raffle", label: "Raffle" },
      { key: "payroll", label: "Payroll" }
    ];

    var canSeeSettings = false;
    if (state.session && state.session.permissions) {
      canSeeSettings = !!(state.session.permissions.isOwner || state.session.permissions.isAdmin);
    }

    if (canSeeSettings) {
      items.push({ key: "settings", label: "Settings" });
    }

    var html = "";
    for (var i = 0; i < items.length; i++) {
      html += '<button type="button" class="nav-btn' +
        (state.activeTab === items[i].key ? ' active' : '') +
        '" data-tab="' + items[i].key + '">' + items[i].label + '</button>';
    }

    nav.innerHTML = html;

    var buttons = nav.querySelectorAll(".nav-btn");
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].onclick = function () {
        activateTab(this.getAttribute("data-tab"));
      };
    }
  }

  function renderBootstrap() {
    var settings = state.bootstrap && state.bootstrap.settings ? state.bootstrap.settings : {};
    var stats = state.bootstrap && state.bootstrap.stats ? state.bootstrap.stats : {};
    var announcements = state.bootstrap && state.bootstrap.announcements ? state.bootstrap.announcements : [];

    safeText("portalName", settings.portalName || "Sean's Donuts");
    safeText("portalSubtitle", settings.portalSubtitle || "Employee Portal");
    safeText("dashboardPortalName", settings.portalName || "Sean's Donuts");
    safeText("dashboardPortalSubtitle", settings.portalSubtitle || "Employee Portal");
    safeText("dashboardBankId", settings.bankId || "24596194");
    safeText("bankIdText", settings.bankId || "24596194");
    safeText("announcementBar", settings.dashboardMessage || "Welcome to Sean's Donuts Portal");

    safeText("statOrders", String(Number(stats.totalOrders || 0)));
    safeText("statSales", money(stats.totalSales || 0));
    safeText("statEmployees", String(Number(stats.activeEmployees || 0)));
    safeText("statRaffle", String(Number(stats.raffleEntries || 0)));

    var announcementsList = el("announcementsList");
    if (announcementsList) {
      if (announcements.length) {
        var html = "";
        for (var i = 0; i < announcements.length; i++) {
          html += '<div class="list-item">' +
            '<h4>' + escapeHtml(announcements[i].title || "Announcement") + '</h4>' +
            '<p>' + escapeHtml(announcements[i].message || "") + '</p>' +
            '</div>';
        }
        announcementsList.innerHTML = html;
      } else {
        announcementsList.innerHTML = '<div class="list-item"><p>No active announcements.</p></div>';
      }
    }

    var methods = settings.paymentMethods || ["Cash", "Invoice", "Bank ID"];
    var paymentMethod = el("paymentMethod");
    if (paymentMethod) {
      var options = "";
      for (var j = 0; j < methods.length; j++) {
        options += '<option value="' + escapeHtml(methods[j]) + '">' + escapeHtml(methods[j]) + '</option>';
      }
      paymentMethod.innerHTML = options;
    }
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

      html += '<div class="product-card">' +
        '<h4>' + escapeHtml(product.name) + '</h4>' +
        '<div class="product-price">' + money(product.price) + '</div>' +
        '<div class="qty-row">' +
          '<button type="button" data-dir="down" data-index="' + i + '">−</button>' +
          '<div class="qty-pill">' + qty + '</div>' +
          '<button type="button" data-dir="up" data-index="' + i + '">+</button>' +
        '</div>' +
      '</div>';
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

        items.push({
          name: name,
          qty: qty,
          price: price,
          total: price * qty
        });
      }
    }

    if (!items.length) {
      list.innerHTML = '<div class="list-item"><p>Empty cart</p></div>';
    } else {
      var html = "";
      for (var j = 0; j < items.length; j++) {
        html += '<div class="list-item">' +
          '<h4>' + escapeHtml(items[j].name) + '</h4>' +
          '<p>' + items[j].qty + ' × ' + money(items[j].price) + ' = <strong>' + money(items[j].total) + '</strong></p>' +
        '</div>';
      }
      list.innerHTML = html;
    }

    var subtotal = 0;
    for (var k = 0; k < items.length; k++) subtotal += items[k].total;

    var discount = Number((el("discountInput") && el("discountInput").value) || 0);
    var tip = Number((el("tipInput") && el("tipInput").value) || 0);
    var total = Math.max(0, subtotal - discount + tip);

    safeText("subtotalText", money(subtotal));
    safeText("discountText", money(discount));
    safeText("tipText", money(tip));
    safeText("totalText", money(total));
  }

  function applySessionToHeader() {
    if (!state.session) return;

    var employee = state.session.employee || {};
    var prefs = state.session.portalPrefs || {};

    safeText("sessionStatus", "Signed in");
    safeText("sessionRole", employee.role || "Employee");
    safeText("userBadge", (employee.name || "Portal User") + " · " + (employee.role || "Employee"));
    safeText("welcomeTitle", "Welcome, " + (employee.name || "Employee"));
    safeText("announcementBar", prefs.announcement || "Welcome to Sean's Donuts Portal");
    safeText("bankIdText", prefs.bankId || "24596194");

    safeValue("settingsAnnouncement", prefs.announcement || "");
    safeValue("settingsBankId", prefs.bankId || "24596194");

    if (el("logoutBtn")) el("logoutBtn").classList.remove("hidden");
  }

  async function loadBootstrap() {
    var result = await api("getPortalBootstrap", {});
    if (!result.ok) throw new Error(result.message || "Could not load dashboard.");
    state.bootstrap = result;
    renderBootstrap();
  }

  async function loginNow() {
    showMessage("loginMsg", "Signing in...", "info");

    try {
      state.apiUrl = (el("apiUrl").value || "").trim();

      var loginValue = (el("loginValue").value || "").trim();
      var loginPin = (el("loginPin").value || "").trim();

      var result = await api("login", {
        email: loginValue,
        pin: loginPin
      });

      if (!result.ok) {
        showMessage("loginMsg", result.message || "Login failed.", "error");
        return;
      }

      state.session = result;
      state.products = result.products || [];
      await loadBootstrap();

      applySessionToHeader();
      buildProductGrid();
      renderCart();
      renderNav();

      if (el("loginView")) el("loginView").classList.add("hidden");
      if (el("portalView")) el("portalView").classList.remove("hidden");

      activateTab("dashboard");

      await Promise.allSettled([
        loadOrders(),
        loadRaffle(),
        loadPayroll()
      ]);

      showMessage("loginMsg", "", "success");
    } catch (err) {
      showMessage("loginMsg", err.message || "Failed to connect to backend.", "error");
    }
  }

  function logoutNow() {
    state.session = null;
    state.bootstrap = null;
    state.products = [];
    state.cart = {};
    state.activeTab = "dashboard";

    if (el("loginView")) el("loginView").classList.remove("hidden");
    if (el("portalView")) el("portalView").classList.add("hidden");
    if (el("logoutBtn")) el("logoutBtn").classList.add("hidden");

    safeText("sessionStatus", "Signed out");
    safeText("sessionRole", "—");
    safeText("userBadge", "Portal User");

    if (el("navTabs")) el("navTabs").innerHTML = "";
    showMessage("loginMsg", "", "success");
  }

  async function submitOrder() {
    if (!state.session) return;

    var items = [];
    for (var name in state.cart) {
      if (state.cart.hasOwnProperty(name)) {
        var qty = Number(state.cart[name] || 0);
        if (qty > 0) {
          items.push({ name: name, qty: qty });
        }
      }
    }

    if (!items.length) {
      showMessage("orderMsg", "Add at least one product.", "error");
      return;
    }

    showMessage("orderMsg", "Submitting order...", "info");

    try {
      var result = await api("submitOrder", {
        email: state.session.employee.email || state.session.employee.username || "",
        pin: (el("loginPin").value || "").trim(),
        customerName: (el("customerName").value || "").trim(),
        phoneNumber: (el("phoneNumber").value || "").trim(),
        items: items,
        discount: Number((el("discountInput").value || 0)),
        tip: Number((el("tipInput").value || 0)),
        paymentMethod: (el("paymentMethod").value || "").trim(),
        notes: (el("notes").value || "").trim()
      });

      if (!result.ok) {
        showMessage("orderMsg", result.message || "Order failed.", "error");
        return;
      }

      state.cart = {};
      buildProductGrid();
      renderCart();

      safeValue("customerName", "");
      safeValue("phoneNumber", "");
      safeValue("discountInput", "0");
      safeValue("tipInput", "0");
      safeValue("notes", "");

      showMessage("orderMsg", result.message || "Order submitted.", "success");

      await Promise.allSettled([
        loadOrders(),
        loadBootstrap()
      ]);

      renderBootstrap();
    } catch (err) {
      showMessage("orderMsg", err.message || "Order failed.", "error");
    }
  }

  async function loadOrders() {
    if (!state.session) return;

    var list = el("ordersList");
    if (!list) return;
    list.innerHTML = '<div class="list-item"><p>Loading orders...</p></div>';

    try {
      var result = await api("searchOrders", {
        email: state.session.employee.email || state.session.employee.username || "",
        pin: (el("loginPin").value || "").trim(),
        query: (el("orderSearchInput").value || "").trim()
      });

      var rows = result.results || [];
      if (!rows.length) {
        list.innerHTML = '<div class="list-item"><p>No orders found.</p></div>';
        return;
      }

      var html = "";
      for (var i = 0; i < rows.length; i++) {
        html += '<div class="list-item">' +
          '<h4>' + escapeHtml(rows[i]["Order Number"] || "Order") + '</h4>' +
          '<p>' + escapeHtml(rows[i]["Customer Name"] || "No customer") + ' · ' + money(rows[i]["Total"] || 0) + '</p>' +
        '</div>';
      }
      list.innerHTML = html;
    } catch (err) {
      list.innerHTML = '<div class="list-item"><p>' + escapeHtml(err.message || "Could not load orders.") + '</p></div>';
    }
  }

  async function loadRewards() {
    if (!state.session) return;

    var customerName = (el("rewardCustomerName").value || el("customerName").value || "").trim();
    if (!customerName) {
      showMessage("rewardsMsg", "Enter customer name first.", "error");
      return;
    }

    showMessage("rewardsMsg", "Loading rewards...", "info");

    try {
      var result = await api("lookupRewards", {
        email: state.session.employee.email || state.session.employee.username || "",
        pin: (el("loginPin").value || "").trim(),
        customerName: customerName
      });

      var data = result.reward || {};
      safeText("rewardVisits", String(Number(data.visits || 0)));
      safeText("rewardProgress", String(Number(data.visitProgress || 0)) + " / 10");
      safeText("rewardAvailable", String(Number(data.rewardsAvailable || 0)));
      safeText("rewardRedeemed", String(Number(data.totalRewardsRedeemed || 0)));
      safeText("rewardLastVisit", data.lastVisit || "—");
      safeText("rewardLastOrder", data.lastOrderNumber || "—");

      showMessage("rewardsMsg", "Rewards loaded.", "success");
    } catch (err) {
      showMessage("rewardsMsg", err.message || "Could not load rewards.", "error");
    }
  }

  async function loadRaffle() {
    if (!state.session) return;

    var list = el("raffleList");
    if (!list) return;
    list.innerHTML = '<div class="list-item"><p>Loading raffle...</p></div>';

    try {
      var result = await api("loadRaffleOverview", {
        email: state.session.employee.email || state.session.employee.username || "",
        pin: (el("loginPin").value || "").trim()
      });

      var rows = result.entries || [];
      if (!rows.length) {
        list.innerHTML = '<div class="list-item"><p>No raffle entries found.</p></div>';
        return;
      }

      var html = "";
      for (var i = 0; i < rows.length; i++) {
        html += '<div class="list-item">' +
          '<h4>' + escapeHtml(rows[i]["Customer Name"] || "Entry") + '</h4>' +
          '<p>Tickets: ' + Number(rows[i]["Tickets Bought"] || 0) + '</p>' +
        '</div>';
      }
      list.innerHTML = html;
    } catch (err) {
      list.innerHTML = '<div class="list-item"><p>' + escapeHtml(err.message || "Could not load raffle.") + '</p></div>';
    }
  }

  async function loadPayroll() {
    if (!state.session) return;

    var list = el("payrollList");
    if (!list) return;
    list.innerHTML = '<div class="list-item"><p>Loading payroll...</p></div>';

    try {
      var result = await api("loadPayroll", {
        email: state.session.employee.email || state.session.employee.username || "",
        pin: (el("loginPin").value || "").trim(),
        startDate: el("payrollStartDate").value || "",
        endDate: el("payrollEndDate").value || ""
      });

      var rows = result.rows || [];
      if (!rows.length) {
        list.innerHTML = '<div class="list-item"><p>No payroll rows found.</p></div>';
        return;
      }

      var html = "";
      for (var i = 0; i < rows.length; i++) {
        html += '<div class="list-item">' +
          '<h4>' + escapeHtml(rows[i]["Employee"] || "Employee") + '</h4>' +
          '<p>Total Pay: ' + money(rows[i]["Total Pay"] || 0) + ' · Orders: ' + Number(rows[i]["Orders"] || 0) + '</p>' +
        '</div>';
      }
      list.innerHTML = html;
    } catch (err) {
      list.innerHTML = '<div class="list-item"><p>' + escapeHtml(err.message || "Could not load payroll.") + '</p></div>';
    }
  }

  async function saveSettingsAction() {
    if (!state.session) return;

    showMessage("settingsMsg", "Saving settings...", "info");

    try {
      var result = await api("saveSettings", {
        email: state.session.employee.email || state.session.employee.username || "",
        pin: (el("loginPin").value || "").trim(),
        announcement: (el("settingsAnnouncement").value || "").trim(),
        bankId: (el("settingsBankId").value || "").trim(),
        portalTheme: (el("settingsTheme").value || "classic").trim()
      });

      if (!result.ok) {
        showMessage("settingsMsg", result.message || "Could not save settings.", "error");
        return;
      }

      showMessage("settingsMsg", result.message || "Settings saved.", "success");
      await loadBootstrap();
      renderBootstrap();
    } catch (err) {
      showMessage("settingsMsg", err.message || "Could not save settings.", "error");
    }
  }

  function setDefaultDates() {
    var today = new Date();
    var first = new Date(today.getFullYear(), today.getMonth(), 1);

    safeValue("payrollStartDate", first.toISOString().slice(0, 10));
    safeValue("payrollEndDate", today.toISOString().slice(0, 10));
  }

  function wireEvents() {
    safeValue("apiUrl", getSavedApiUrl());

    if (el("saveApiUrlBtn")) el("saveApiUrlBtn").onclick = saveApiUrl;
    if (el("loginBtn")) el("loginBtn").onclick = loginNow;
    if (el("logoutBtn")) el("logoutBtn").onclick = logoutNow;

    if (el("demoFillBtn")) {
      el("demoFillBtn").onclick = function () {
        safeValue("loginValue", "owner");
        safeValue("loginPin", "1234");
        showMessage("loginMsg", "Demo login filled.", "success");
      };
    }

    if (el("submitOrderBtn")) el("submitOrderBtn").onclick = submitOrder;
    if (el("searchOrdersBtn")) el("searchOrdersBtn").onclick = loadOrders;
    if (el("lookupRewardsBtn")) el("lookupRewardsBtn").onclick = loadRewards;
    if (el("loadPayrollBtn")) el("loadPayrollBtn").onclick = loadPayroll;
    if (el("saveSettingsBtn")) el("saveSettingsBtn").onclick = saveSettingsAction;

    if (el("discountInput")) el("discountInput").oninput = renderCart;
    if (el("tipInput")) el("tipInput").oninput = renderCart;
  }

  function init() {
    wireEvents();
    setDefaultDates();
    hideAllSections();
  }

  init();
};
