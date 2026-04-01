const API_URL = "https://script.google.com/macros/s/AKfycbyxM4N--Ee9shmW6VmDtLl46aJGrabSBxPhhZMlV1OXEDTMUeyuSavuBu93VoZNnfHVPQ/exec";

const state = {
session: null,
bootstrap: null
};

document.addEventListener("DOMContentLoaded", () => {
const loginBtn = document.getElementById("loginBtn");
const demoBtn = document.getElementById("demoFillBtn");
const saveBtn = document.getElementById("saveApiUrlBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginMsg = document.getElementById("loginMsg");
const navTabs = document.getElementById("navTabs");

const sectionMap = {
dashboard: "dashboardSection",
pos: "posSection",
orders: "ordersSection",
rewards: "rewardsSection",
raffle: "raffleSection",
payroll: "payrollSection",
settings: "settingsSection"
};

function showMessage(msg, type = "info") {
if (!loginMsg) return;
loginMsg.textContent = msg || "";
loginMsg.className = msg ? `message show ${type}` : "message";
}

function money(v) {
return `$${Number(v || 0).toFixed(2)}`;
}

function showSection(key) {
Object.values(sectionMap).forEach(id => {
const el = document.getElementById(id);
if (el) el.classList.add("hidden");
});

```
const active = document.getElementById(sectionMap[key]);
if (active) active.classList.remove("hidden");

navTabs.querySelectorAll(".nav-btn").forEach(btn => {
  btn.classList.toggle("active", btn.dataset.tab === key);
});
```

}

function renderNav() {
if (!navTabs) return;

```
const isOwner = !!(
  state.session?.permissions?.isOwner ||
  state.session?.permissions?.isAdmin
);

const tabs = [
  { key: "dashboard", label: "Dashboard" },
  { key: "pos", label: "POS" },
  { key: "orders", label: "Orders" },
  { key: "rewards", label: "Rewards" },
  { key: "raffle", label: "Raffle" },
  { key: "payroll", label: "Payroll" }
];

if (isOwner) {
  tabs.push({ key: "settings", label: "Settings" });
}

navTabs.innerHTML = tabs
  .map(
    tab => `<button type="button" class="nav-btn" data-tab="${tab.key}">${tab.label}</button>`
  )
  .join("");

navTabs.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => showSection(btn.dataset.tab));
});
```

}

async function postAction(action, payload = {}) {
const res = await fetch(API_URL, {
method: "POST",
headers: { "Content-Type": "text/plain;charset=utf-8" },
body: JSON.stringify({ action, payload })
});

```
if (!res.ok) {
  throw new Error(`HTTP ${res.status}`);
}

return await res.json();
```

}

function fillDemo() {
document.getElementById("loginValue").value = "owner";
document.getElementById("loginPin").value = "1234";
}

function saveApiUrl() {
const val = document.getElementById("apiUrl").value.trim();
localStorage.setItem("sd_api_url", val);
showMessage("API URL saved.", "success");
}

function applyBootstrap() {
const settings = state.bootstrap?.settings || {};
const stats = state.bootstrap?.stats || {};
const announcements = state.bootstrap?.announcements || [];

```
document.getElementById("portalName").textContent =
  settings.portalName || "Sean's Donuts";
document.getElementById("portalSubtitle").textContent =
  settings.portalSubtitle || "Employee Portal";

document.getElementById("dashboardPortalName").textContent =
  settings.portalName || "Sean's Donuts";
document.getElementById("dashboardPortalSubtitle").textContent =
  settings.portalSubtitle || "Employee Portal";
document.getElementById("dashboardBankId").textContent =
  settings.bankId || "24596194";

document.getElementById("bankIdText").textContent =
  settings.bankId || "24596194";
document.getElementById("announcementBar").textContent =
  settings.dashboardMessage || "Welcome to Sean's Donuts Portal";

document.getElementById("statOrders").textContent =
  Number(stats.totalOrders || 0);
document.getElementById("statSales").textContent =
  money(stats.totalSales || 0);
document.getElementById("statEmployees").textContent =
  Number(stats.activeEmployees || 0);
document.getElementById("statRaffle").textContent =
  Number(stats.raffleEntries || 0);

const announcementsList = document.getElementById("announcementsList");
if (announcements.length) {
  announcementsList.innerHTML = announcements
    .map(
      item => `
        <div class="list-item">
          <h4>${item.title || "Announcement"}</h4>
          <p>${item.message || ""}</p>
        </div>
      `
    )
    .join("");
} else {
  announcementsList.innerHTML =
    '<div class="list-item"><p>No active announcements.</p></div>';
}

const paymentMethod = document.getElementById("paymentMethod");
const methods = Array.isArray(settings.paymentMethods)
  ? settings.paymentMethods
  : ["Cash", "Invoice", "Bank ID"];

paymentMethod.innerHTML = methods
  .map(method => `<option value="${method}">${method}</option>`)
  .join("");
```

}

async function loginNow() {
const email = document.getElementById("loginValue").value.trim();
const pin = document.getElementById("loginPin").value.trim();

```
showMessage("Signing in...", "info");

try {
  const loginData = await postAction("login", { email, pin });

  if (!loginData.ok) {
    showMessage(loginData.message || "Login failed.", "error");
    return;
  }

  state.session = loginData;

  const bootstrapData = await postAction("getPortalBootstrap");

  if (!bootstrapData.ok) {
    showMessage(bootstrapData.message || "Could not load dashboard.", "error");
    return;
  }

  state.bootstrap = bootstrapData;

  document.getElementById("loginView").classList.add("hidden");
  document.getElementById("portalView").classList.remove("hidden");
  document.getElementById("logoutBtn").classList.remove("hidden");

  document.getElementById("sessionStatus").textContent = "Signed in";
  document.getElementById("sessionRole").textContent =
    loginData.employee?.role || "Employee";
  document.getElementById("userBadge").textContent =
    `${loginData.employee?.name || "Portal User"} · ${loginData.employee?.role || "Employee"}`;
  document.getElementById("welcomeTitle").textContent =
    `Welcome, ${loginData.employee?.name || "Employee"}`;

  document.getElementById("settingsAnnouncement").value =
    loginData.portalPrefs?.announcement || "";
  document.getElementById("settingsBankId").value =
    loginData.portalPrefs?.bankId || "24596194";

  applyBootstrap();
  renderNav();
  showSection("dashboard");
  showMessage("");
} catch (err) {
  showMessage("Failed to connect to backend.", "error");
}
```

}

function logoutNow() {
state.session = null;
state.bootstrap = null;

```
document.getElementById("portalView").classList.add("hidden");
document.getElementById("loginView").classList.remove("hidden");
document.getElementById("logoutBtn").classList.add("hidden");

document.getElementById("sessionStatus").textContent = "Signed out";
document.getElementById("sessionRole").textContent = "—";
document.getElementById("userBadge").textContent = "Portal User";

navTabs.innerHTML = "";
showMessage("");
```

}

document.getElementById("apiUrl").value =
localStorage.getItem("sd_api_url") || API_URL;

if (demoBtn) demoBtn.addEventListener("click", fillDemo);
if (saveBtn) saveBtn.addEventListener("click", saveApiUrl);
if (loginBtn) loginBtn.addEventListener("click", loginNow);
if (logoutBtn) logoutBtn.addEventListener("click", logoutNow);
});
