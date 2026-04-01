const state = {
apiUrl: localStorage.getItem('sd_api_url') || 'https://script.google.com/macros/s/AKfycbyxM4N--Ee9shmW6VmDtLl46aJGrabSBxPhhZMlV1OXEDTMUeyuSavuBu93VoZNnfHVPQ/exec',
session: null,
bootstrap: null,
products: [],
cart: {},
paymentMethods: ['Cash', 'Invoice', 'Bank ID'],
activeTab: 'dashboard'
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

function $(id) { return document.getElementById(id); }
function money(v) { return `$${Number(v || 0).toFixed(2)}`; }

function escapeHtml(str) {
return String(str || '')
.replace(/&/g, '&')
.replace(/</g, '<')
.replace(/>/g, '>')
.replace(/"/g, '"')
.replace(/'/g, ''');
}

function showMessage(elId, text, type = 'info') {
const el = $(elId);
if (!el) return;
el.textContent = text || '';
el.className = `message ${text ? `show ${type}` : ''}`.trim();
}

function requireApiUrl() {
if (!state.apiUrl) {
showMessage('loginMsg', 'Missing API URL.', 'error');
return false;
}
return true;
}

async function api(action, payload = {}) {
const response = await fetch(state.apiUrl, {
method: 'POST',
headers: { 'Content-Type': 'text/plain;charset=utf-8' },
body: JSON.stringify({ action, payload })
});

if (!response.ok) throw new Error(`HTTP ${response.status}`);
return await response.json();
}

function saveApiUrl() {
const value = $('apiUrl').value.trim();
state.apiUrl = value;
localStorage.setItem('sd_api_url', value);
showMessage('loginMsg', 'API URL saved.', 'success');
}

function renderNav() {
const nav = $('navTabs');
const isOwner = !!(state.session?.permissions?.isOwner || state.session?.permissions?.isAdmin);

nav.innerHTML = tabs
.filter(tab => !tab.ownerOnly || isOwner)
.map(tab => `       <button class="nav-btn ${state.activeTab === tab.key ? 'active' : ''}" data-tab="${tab.key}">
        ${tab.label}       </button>
    `).join('');

nav.querySelectorAll('[data-tab]').forEach(btn => {
btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});
}

function activateTab(tab) {
state.activeTab = tab;
renderNav();

const map = {
dashboard: 'dashboardSection',
pos: 'posSection',
orders: 'ordersSection',
rewards: 'rewardsSection',
raffle: 'raffleSection',
payroll: 'payrollSection',
settings: 'settingsSection'
};

Object.values(map).forEach(id => $(id)?.classList.add('hidden'));
$(map[tab])?.classList.remove('hidden');
}

function buildProductGrid() {
const grid = $('productGrid');
if (!grid) return;

if (!state.products.length) {
grid.innerHTML = '<div class="list-item">No products</div>';
return;
}

grid.innerHTML = state.products.map((p, i) => {
const qty = state.cart[p.name] || 0;
return `       <div class="product-card">         <h4>${escapeHtml(p.name)}</h4>         <p>${money(p.price)}</p>         <button onclick="changeQty(${i},1)">+</button>         <span>${qty}</span>         <button onclick="changeQty(${i},-1)">-</button>       </div>
    `;
}).join('');
}

function changeQty(i, delta) {
const p = state.products[i];
const cur = state.cart[p.name] || 0;
const next = Math.max(0, cur + delta);
if (next === 0) delete state.cart[p.name];
else state.cart[p.name] = next;
buildProductGrid();
renderCart();
}

function renderCart() {
const list = $('cartList');
const items = Object.entries(state.cart);

if (!items.length) {
list.innerHTML = '<div class="list-item">Empty cart</div>';
return;
}

let total = 0;

list.innerHTML = items.map(([name, qty]) => {
const p = state.products.find(x => x.name === name);
const t = p.price * qty;
total += t;
return `<div>${name} x${qty} = ${money(t)}</div>`;
}).join('');

$('totalText').textContent = money(total);
}

async function loginNow() {
if (!requireApiUrl()) return;

try {
const email = $('loginValue').value.trim();
const pin = $('loginPin').value.trim();

```
const res = await api('login', { email, pin });

if (!res.ok) throw new Error(res.message);

state.session = res;
state.products = res.products || [];

$('loginView').classList.add('hidden');
$('portalView').classList.remove('hidden');

buildProductGrid();
renderCart();
renderNav();
activateTab('dashboard');
```

} catch (e) {
showMessage('loginMsg', e.message, 'error');
}
}

function logoutNow() {
state.session = null;
state.cart = {};
$('portalView').classList.add('hidden');
$('loginView').classList.remove('hidden');
}

function init() {
$('apiUrl').value = state.apiUrl;
$('saveApiUrlBtn').onclick = saveApiUrl;
$('loginBtn').onclick = loginNow;
$('logoutBtn').onclick = logoutNow;
}

init();
