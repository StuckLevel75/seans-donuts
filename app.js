window.onload = function () {
  const API = "https://script.google.com/macros/s/AKfycbw8QmZ4jl1ym9RwOlqP5_9XVgQNxAZiyMkA9YVYT9ag4dM-BPHaurTIw0aULBJDL5Xvwg/exec";

  let session = null;
  let products = [];
  let cart = {};

  function el(id) { return document.getElementById(id); }
  function money(n) { return "$" + Number(n || 0).toFixed(2); }

  async function api(action, payload) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, payload })
    });
    return await res.json();
  }

  function msg(id, text, type="info") {
    const box = el(id);
    if (!box) return;
    box.textContent = text;
    box.className = text ? "message show " + type : "message";
  }

  // ================= LOGIN =================
  async function login() {
    msg("loginMsg", "Signing in...");
    const email = el("loginValue").value.trim();
    const pin = el("loginPin").value.trim();

    const res = await api("login", { email, pin });

    if (!res.ok) {
      msg("loginMsg", res.message || "Login failed", "error");
      return;
    }

    session = res;
    products = res.products || [];

    el("loginView").classList.add("hidden");
    el("portalView").classList.remove("hidden");

    el("sessionStatus").textContent = "Signed in";
    el("userBadge").textContent = res.employee.name + " · " + res.employee.role;

    loadProducts();
    updateCart();
  }

  el("loginBtn").onclick = login;

  // ================= PRODUCTS =================
  function loadProducts() {
    const grid = el("productGrid");

    if (!products.length) {
      grid.innerHTML = "<p>No products</p>";
      return;
    }

    let html = "";

    products.forEach((p, i) => {
      const qty = cart[p.name] || 0;

      html += `
        <div class="product-card">
          <h4>${p.name}</h4>
          <div>$${p.price}</div>
          <div>
            <button onclick="changeQty(${i}, -1)">-</button>
            ${qty}
            <button onclick="changeQty(${i}, 1)">+</button>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  }

  window.changeQty = function (index, dir) {
    const p = products[index];
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

    let subtotal = 0;
    let html = "";

    for (let name in cart) {
      const qty = cart[name];
      const product = products.find(p => p.name === name);
      const price = product ? product.price : 0;
      const total = price * qty;

      subtotal += total;

      html += `<p>${name} x${qty} = ${money(total)}</p>`;
    }

    if (!html) html = "<p>Empty cart</p>";
    list.innerHTML = html;

    const mileage = Number(el("mileageInput").value || 0);
    const paid = Number(el("amountPaidInput").value || 0);

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

    el("subtotalText").textContent = money(subtotal);
    el("mileageText").textContent = money(mileage);
    el("discountText").textContent = money(discount);
    el("tipText").textContent = money(tip);
    el("amountPaidText").textContent = money(paid);
    el("totalText").textContent = money(base - discount + tip);
  }

  el("mileageInput").oninput = updateCart;
  el("amountPaidInput").oninput = updateCart;

  // ================= ORDER =================
  el("submitOrderBtn").onclick = async function () {
    if (!session) return;

    const items = Object.keys(cart).map(name => ({
      name,
      qty: cart[name]
    }));

    if (!items.length) {
      msg("orderMsg", "Add items first", "error");
      return;
    }

    msg("orderMsg", "Submitting...");

    const res = await api("submitOrder", {
      email: session.employee.email,
      pin: el("loginPin").value,
      customerName: el("customerName").value,
      phoneNumber: el("phoneNumber").value,
      items,
      mileage: Number(el("mileageInput").value || 0),
      amountPaid: Number(el("amountPaidInput").value || 0),
      paymentMethod: el("paymentMethod").value,
      notes: el("notes").value
    });

    if (!res.ok) {
      msg("orderMsg", res.message, "error");
      return;
    }

    cart = {};
    loadProducts();
    updateCart();

    msg("orderMsg", "Order submitted!", "success");
  };
};
