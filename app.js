window.onload = function () {
  var DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbw8QmZ4jl1ym9RwOlqP5_9XVgQNxAZiyMkA9YVYT9ag4dM-BPHaurTIw0aULBJDL5Xvwg/exec";

  var state = {
    apiUrl: DEFAULT_API_URL,
    session: null,
    bootstrap: null,
    products: [],
    cart: {},
    activeTab: "dashboard",
    lastManualEdit: null,
    adminData: null
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
    if (node) node.textContent = text;
  }

  function safeValue(id, value) {
    var node = el(id);
    if (node) node.value = value;
  }

  function getNumericValue(id) {
    return Number((el(id) && el(id).value) || 0);
  }

  function can(permissionKey) {
    return !!(state.session && state.session.permissions && state.session.permissions[permissionKey]);
  }

  async function api(action, payload) {
    var res = await fetch(state.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: action, payload: payload || {} })
    });

    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  }

  function applyTheme(theme) {
    if (!theme) return;
    var root = document.documentElement;
    root.style.setProperty('--primary', theme.primary || '#f28c18');
    root.style.setProperty('--primary-dark', theme.primaryDark || '#de7c0c');
    root.style.setProperty('--secondary', theme.secondary || '#6c4330');
    root.style
