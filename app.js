// ================= STATE =================
const state = {
  apiUrl: localStorage.getItem('sd_api_url') || '',
  session: null,
  bootstrap: null,
  products: [],
  cart: {},
  activeTab: 'dashboard'
};

// ================= HELPERS =================
function $(id){return document.getElementById(id);}
function money(v){return `$${Number(v||0).toFixed(2)}`;}

function showEl(id){$(id)?.classList.remove('hidden');}
function hideEl(id){$(id)?.classList.add('hidden');}

function getValue(id){return $(id)?.value || '';}
function setText(id,val){if($(id)) $(id).textContent=val||'';}

function showLoading(t="LOADING",m="Please wait..."){
  setText('loadingTitle',t);
  setText('loadingText',m);
  showEl('loadingOverlay');
}
function hideLoading(){hideEl('loadingOverlay');}

// ================= API =================
async function api(action,payload={}){
  const res = await fetch(state.apiUrl,{
    method:'POST',
    headers:{'Content-Type':'text/plain'},
    body:JSON.stringify({action,payload})
  });
  return await res.json();
}

// ================= LOGIN =================
async function loginNow(){
  showLoading("LOGGING IN","Checking access...");
  try{
    const loginValue=getValue('loginValue').trim();
    const pin=getValue('loginPin').trim();

    const res=await api('login',{
      email:loginValue,
      username:loginValue,
      pin
    });

    if(!res.ok){
      hideLoading();
      alert(res.message || "Login failed");
      return;
    }

    state.session=res;

    const boot=await api('getPortalBootstrap',{});
    if(!boot.ok){
      hideLoading();
      alert("Failed to load portal");
      return;
    }

    state.bootstrap=boot;
    state.products=boot.products || [];

    fillHeader();
    renderNav();
    buildProducts();
    renderCart();

    hideEl('loginView');
    showEl('portalView');
    showEl('logoutBtn');
    showEl('portalRefreshBtn');

    hideLoading();
  }catch(e){
    hideLoading();
    alert(e.message);
  }
}

// ================= LOGOUT =================
function logoutNow(){
  state.session=null;
  showEl('loginView');
  hideEl('portalView');
}

// ================= REFRESH =================
async function portalRefreshNow(){
  showLoading("REFRESHING","Reloading...");
  try{
    const boot=await api('getPortalBootstrap',{});
    if(boot.ok){
      state.bootstrap=boot;
      state.products=boot.products || [];
      fillHeader();
      renderNav();
      buildProducts();
      renderCart();
    }
    hideLoading();
  }catch(e){
    hideLoading();
    alert("Refresh failed");
  }
}

// ================= HEADER =================
function fillHeader(){
  const emp=state.session?.employee||{};
  const set=state.bootstrap?.settings||{};

  setText('portalName',set.portalName||"Sean's Donuts");
  setText('userBadge',`👋 Hello, ${emp.name || 'User'}`);
  setText('sessionRole',emp.role||'');
  setText('bankIdText',set.bankId||'24596194');
}

// ================= NAV =================
const tabs=['dashboard','pos','orders','rewards','raffle','ads','payroll','settings'];

function renderNav(){
  const nav=$('navTabs');
  if(!nav) return;

  nav.innerHTML=tabs.map(t=>`
    <button class="nav-btn ${state.activeTab===t?'active':''}" onclick="openTab('${t}')">
      ${t.toUpperCase()}
    </button>
  `).join('');
}

function openTab(tab){
  state.activeTab=tab;

  document.querySelectorAll('.page-panel').forEach(p=>p.classList.add('hidden'));
  $(tab+'Section')?.classList.remove('hidden');

  renderNav();
}

// ================= PRODUCTS =================
function buildProducts(){
  const grid=$('productGrid');
  if(!grid)return;

  grid.innerHTML=state.products.map((p,i)=>`
    <div class="product-card">
      <h4>${p.Name || p.name}</h4>
      <div class="product-price">${money(p.Price || p.price)}</div>

      <div class="qty-row">
        <button onclick="removeFromCart(${i})">-</button>
        <span class="qty-pill">${state.cart[p.Name||p.name]||0}</span>
        <button onclick="addToCart(${i})">+</button>
      </div>
    </div>
  `).join('');
}

function addToCart(i){
  const p=state.products[i];
  const name=p.Name||p.name;
  state.cart[name]=(state.cart[name]||0)+1;
  buildProducts();
  renderCart();
}

function removeFromCart(i){
  const p=state.products[i];
  const name=p.Name||p.name;

  if(state.cart[name]){
    state.cart[name]--;
    if(state.cart[name]<=0) delete state.cart[name];
  }

  buildProducts();
  renderCart();
}

// ================= CART =================
function renderCart(){
  const list=$('cartList');
  if(!list)return;

  const items=Object.entries(state.cart);

  if(!items.length){
    list.innerHTML='<div class="list-item"><p>Empty cart</p></div>';
    setText('subtotalText','$0.00');
    return;
  }

  list.innerHTML=items.map(([n,q])=>{
    const p=state.products.find(x=>(x.Name||x.name)===n)||{};
    return `<div class="list-item">${n} x${q} = ${money(q*(p.Price||p.price))}</div>`;
  }).join('');

  let subtotal=0;
  items.forEach(([n,q])=>{
    const p=state.products.find(x=>(x.Name||x.name)===n)||{};
    subtotal+=q*(p.Price||p.price||0);
  });

  setText('subtotalText',money(subtotal));
}

// ================= ORDER =================
function hasRaffleTicket(){
  return Object.keys(state.cart).some(n=>n.toLowerCase().includes('raffle'));
}

async function submitOrder(){
  const items=Object.entries(state.cart).map(([name,qty])=>({name,qty}));

  const name=getValue('customerName');
  const discord=getValue('customerDiscord');
  const phone=getValue('phoneNumber');

  if(hasRaffleTicket() && (!name||!discord||!phone)){
    alert("Customer Name, Discord, and Phone REQUIRED for raffle tickets");
    return;
  }

  await api('submitOrder',{
    email:state.session.employee.email,
    pin:getValue('loginPin'),
    items,
    customerName:name,
    customerDiscord:discord,
    phoneNumber:phone
  });

  alert("Order submitted");
  state.cart={};
  buildProducts();
  renderCart();
}

// ================= INIT =================
function init(){
  $('loginBtn')?.addEventListener('click',loginNow);
  $('logoutBtn')?.addEventListener('click',logoutNow);
  $('portalRefreshBtn')?.addEventListener('click',portalRefreshNow);
  $('submitOrderBtn')?.addEventListener('click',submitOrder);

  $('loginValue')?.addEventListener('keydown',e=>{
    if(e.key==="Enter") loginNow();
  });

  $('loginPin')?.addEventListener('keydown',e=>{
    if(e.key==="Enter") loginNow();
  });
}

init();
