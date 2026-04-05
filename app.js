window.onload = function () {
  const API = "https://script.google.com/macros/s/AKfycbw8QmZ4jl1ym9RwOlqP5_9XVgQNxAZiyMkA9YVYT9ag4dM-BPHaurTIw0aULBJDL5Xvwg/exec";

  let session = null;
  let products = [];
  let cart = {};

  function el(id) {
    return document.getElementById(id);
  }

  function money(n) {
    return "$" + Number(n || 0).toFixed(2);
  }

  async function api(action, payload) {
    const res = await fetch(API, {
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

  function msg(id, text, type = "info") {
    const box = el(id);
    if (!box) return;
    box.textContent = text || "";
    box.className = text ? "message show " + type : "message";
  }

  function setText(id, value) {
    const node = el(id);
    if (node) node.textContent = value == null ? "" : value;
  }

  function loadPaymentMethods(methods) {
    const select = el("paymentMethod");
    if (!select) return;

    const list = Array.isArray(methods) && methods.length
      ? methods
      : ["Cash", "Invoice", "Bank ID"];

    let html = "";
    for (let i = 0; i < list.length; i++) {
      html += `<option value="${String(list[i]).replace(/"/g, "&quot;")}">${list[i]}</option>`;
    }

    select.innerHTML = html;
  }

  // ================= LOGIN =================
  async function login() {
    msg("loginMsg", "Signing in...", "info");

    try {
      const email = (el("loginValue").value || "").trim();
      const pin = (el("loginPin").value || "").trim();

      const res = await api("login", { email, pin });

      if (!res.ok) {
        msg("loginMsg", res.message || "Login failed", "error");
        return;
      }

      session = res;
      products = Array.isArray(res.products) ? res.products : [];

      // branding / header
      if (res.branding && res.branding.settings) {
        const settings = res.branding.settings;
        setText("portalName", settings.portalName || "Sean's Donuts");
        setText("portalSubtitle", settings.portalSubtitle || "Employee Portal");
        setText("dashboardPortalName", settings.portalName || "Sean's Donuts");
        setText("dashboardPortalSubtitle", settings.portalSubtitle || "Employee Portal");
        setText("dashboardBankId", settings.bankId || "24596194");
        setText("bankIdText", settings.bankId || "24596194");
        setText("announcementBar", settings.announcement || "Welcome to Sean's Donuts Portal");
        setText("loginTitle", (res.branding.uiText && res.branding.uiText.loginTitle) || "Sean's Donuts Portal");
        setText("loginSubtitle", (res.branding.uiText && res.branding.uiText.loginSubtitle) || "Sign in with your username or email and PIN.");
        setText("loginLogo", settings.logoEmoji || "🍩");
        setText("brandLogo", settings.logoEmoji || "🍩");
      }

      loadPaymentMethods(res.branding && res.branding.paymentMethods);

      if (el("loginView")) el("loginView").classList.add("hidden");
      if (el("portalView")) el("portalView").classList.remove("hidden");

      setText("sessionStatus", "Signed in");
      setText("sessionRole", res.employee.role || "Employee");
      setText("userBadge", (res.employee.name || "Portal User") + " · " + (res.employee.role || "Employee"));
      setText("welcomeTitle", "Welcome, " + (res.employee.name || "Employee"));

      if (el("logoutBtn")) el("logoutBtn").classList.remove("hidden");

      loadProducts();
      updateCart();

      msg("loginMsg", "", "success");
    } catch (err) {
      msg("loginMsg", err.message || "Login failed", "error");
    }
  }

  // ================= PRODUCTS =================
  function loadProducts() {
    const grid = el("productGrid");
    if (!grid) return;

    if (!products.length) {
      grid.innerHTML = `<div class="list-item"><p>No products</p></div>`;
      return;
    }

    let html = "";

    products.forEach((p, i) => {
      const qty = cart[p.name] || 0;

      html += `
        <div class="product-card">
          <h4>${p.name}</h4>
          <div class="product-price">${money(p.price)}</div>
          <div class="qty-row">
            <button type="button" onclick="changeQty(${i}, -1)">−</button>
            <div class="qty-pill">${qty}</div>
            <button type="button" onclick="changeQty(${i}, 1)">+</button>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  }

  window.changeQty = function (index, dir) {
    const p = products[index];
    if (!p) return;

    let q = cart[p.name] || 0;
    q += dir;

    if (q <= 0) delete cart[p.name];
    else cart[p.name] = q;

    loadProducts();
    updateCart();
  };

  // ================= CART =================
  function updateCart() {
    const list = el("cartList");
    if (!list) return;

    let subtotal = 0;
    let html = "";

    for (let name in cart) {
      const qty = cart[name];
      const product = products.find(p => p.name === name);
      const price = product ? Number(product.price || 0) : 0;
      const total = price * qty;

      subtotal += total;

      html += `
        <div class="list-item">
          <h4>${name}</h4>
          <p>${qty} × ${money(price)} = <strong>${money(total)}</strong></p>
        </div>
      `;
    }

    if (!html) {
      html = `<div class="list-item"><p>Empty cart</p></div>`;
    }

    list.innerHTML = html;

    const mileage = Number((el("mileageInput") && el("mileageInput").value) || 0);
    const paid = Number((el("amountPaidInput") && el("amountPaidInput").value) || 0);

    const base = subtotal + mileage;

    let discount = 0;
    let tip = 0;

    if (paid > 0) {
      if (paid >= base) {
        tip = paid - base;
      } else {
        discount = base - paid;
      }
    }

    setText("subtotalText", money(subtotal));
    setText("mileageText", money(mileage));
    setText("discountText", money(discount));
    setText("tipText", money(tip));
    setText("amountPaidText", money(paid));
    setText("totalText", money(base - discount + tip));
  }

  // ================= ORDER =================
  async function submitOrder() {
    if (!session) {
      msg("orderMsg", "You are not logged in.", "error");
      return;
    }

    const items = Object.keys(cart).map(name => ({
      name,
      qty: cart[name]
    }));

    if (!items.length) {
      msg("orderMsg", "Add items first.", "error");
      return;
    }

    msg("orderMsg", "Submitting...", "info");

    try {
      const paymentMethod = (el("paymentMethod") && el("paymentMethod").value) || "";

      const res = await api("submitOrder", {
        email: session.employee.email || session.employee.username || "",
        pin: (el("loginPin").value || "").trim(),
        customerName: (el("customerName").value || "").trim(),
        phoneNumber: (el("phoneNumber").value || "").trim(),
        items: items,
        mileage: Number((el("mileageInput").value || 0)),
        amountPaid: Number((el("amountPaidInput").value || 0)),
        paymentMethod: paymentMethod,
        notes: (el("notes").value || "").trim()
      });

      if (!res.ok) {
        msg("orderMsg", res.message || "Order failed.", "error");
        return;
      }

      cart = {};
      loadProducts();

      if (el("customerName")) el("customerName").value = "";
      if (el("phoneNumber")) el("phoneNumber").value = "";
      if (el("mileageInput")) el("mileageInput").value = "0";
      if (el("amountPaidInput")) el("amountPaidInput").value = "0";
      if (el("notes")) el("notes").value = "";

      updateCart();
      msg("orderMsg", res.message || "Order submitted!", "success");
    } catch (err) {
      msg("orderMsg", err.message || "Order failed.", "error");
    }
  }

  // ================= EVENTS =================
  if (el("loginBtn")) el("loginBtn").onclick = login;
  if (el("submitOrderBtn")) el("submitOrderBtn").onclick = submitOrder;
  if (el("mileageInput")) el("mileageInput").oninput = updateCart;
  if (el("amountPaidInput")) el("amountPaidInput").oninput = updateCart;

  if (el("logoutBtn")) {
    el("logoutBtn").onclick = function () {
      session = null;
      products = [];
      cart = {};

      if (el("loginView")) el("loginView").classList.remove("hidden");
      if (el("portalView")) el("portalView").classList.add("hidden");

      setText("sessionStatus", "Signed out");
      setText("sessionRole", "—");
      setText("userBadge", "Portal User");
    };
  }

  updateCart();
};
