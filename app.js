// ================= STATE =================
const state = {
  apiUrl: localStorage.getItem('sd_api_url') || '',
  session: null,
  bootstrap: null,
  products: [],
  cart: {},
  paymentMethods: [],
  activeTab: 'dashboard',
  raffleEntries: [],
  raffleWheelEntries: [],
  raffleWinner: null,
  ads: []
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

    const res=await api('login',{email:loginValue,username:loginValue,pin});
    if(!res.ok){hideLoading();alert(res.message);return;}

    state.session=res;

    const boot=await api('getPortalBootstrap',{});
    state.bootstrap=boot;

    state.products=res.products||[];

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

function logoutNow(){
  state.session=null;
  showEl('loginView');
  hideEl('portalView');
}

// ================= REFRESH =================
async function portalRefreshNow(){
  showLoading("REFRESHING","Reloading...");
  const boot=await api('getPortalBootstrap',{});
  state.bootstrap=boot;
  fillHeader();
  renderNav();
  hideLoading();
}

// ================= HEADER =================
function fillHeader(){
  const emp=state.session.employee||{};
  const set=state.bootstrap.settings||{};

  setText('portalName',set.portalName||"Sean's Donuts");
  setText('userBadge',`👋 Hello, ${emp.name}`);
  setText('sessionRole',emp.role);
  setText('bankIdText',set.bankId);
}

// ================= NAV =================
const tabs=[
  'dashboard','pos','orders','rewards','raffle','ads','payroll','settings'
];

function renderNav(){
  const nav=$('navTabs');
  nav.innerHTML=tabs.map(t=>`
    <button onclick="openTab('${t}')">${t}</button>
  `).join('');
}

function openTab(tab){
  state.activeTab=tab;

  document.querySelectorAll('.page-panel').forEach(p=>p.classList.add('hidden'));
  $(tab+'Section')?.classList.remove('hidden');
}

// ================= PRODUCTS =================
function buildProducts(){
  const grid=$('productGrid');
  if(!grid)return;

  grid.innerHTML=state.products.map((p,i)=>`
    <div class="product-card">
      <h4>${p.name}</h4>
      <div>${money(p.price)}</div>
      <button onclick="addToCart(${i})">+</button>
    </div>
  `).join('');
}

function addToCart(i){
  const p=state.products[i];
  state.cart[p.name]=(state.cart[p.name]||0)+1;
  renderCart();
}

// ================= CART =================
function renderCart(){
  const list=$('cartList');

  const items=Object.entries(state.cart);

  list.innerHTML=items.map(([n,q])=>{
    const p=state.products.find(x=>x.name===n)||{};
    return `<div>${n} x${q} = ${money(q*p.price)}</div>`;
  }).join('');

  let subtotal=0;
  items.forEach(([n,q])=>{
    const p=state.products.find(x=>x.name===n)||{};
    subtotal+=q*p.price;
  });

  setText('subtotalText',money(subtotal));
}

// ================= ORDER =================
function hasRaffleTicket(){
  return Object.keys(state.cart).includes('Raffle Ticket');
}

async function submitOrder(){
  const items=Object.entries(state.cart).map(([name,qty])=>({name,qty}));

  const name=getValue('customerName');
  const discord=getValue('customerDiscord');
  const phone=getValue('phoneNumber');

  if(hasRaffleTicket() && (!name||!discord||!phone)){
    alert("Need name/discord/phone for raffle");
    return;
  }

  await api('submitOrder',{
    email:state.session.employee.email,
    pin:getValue('loginPin'),
    items,
    customerName:name,
    phoneNumber:phone
  });

  alert("Order submitted");
  state.cart={};
  renderCart();
}

// ================= PAYMENT METHODS (MODAL) =================
function renderPaymentMethodsAdmin(){
  const wrap=$('paymentMethodsAdminList');
  const methods=state.bootstrap.settings.paymentMethods||[];

  wrap.innerHTML=methods.map((m,i)=>`
    <div>
      ${m}
      <button onclick="openPaymentModal(${i})">Update</button>
    </div>
  `).join('');
}

function openPaymentModal(i){
  const methods=state.bootstrap.settings.paymentMethods;
  setValue('paymentModalIndex',i);
  setValue('paymentModalName',methods[i]);

  showEl('paymentModal');
  showEl('paymentModalBackdrop');
}

function closePaymentModal(){
  hideEl('paymentModal');
  hideEl('paymentModalBackdrop');
}

function savePaymentModal(){
  const i=getValue('paymentModalIndex');
  const name=getValue('paymentModalName');

  state.bootstrap.settings.paymentMethods[i]=name;
  renderPaymentMethodsAdmin();
  closePaymentModal();
}

// ================= EVENTS =================
function init(){
  $('loginBtn').onclick=loginNow;
  $('logoutBtn').onclick=logoutNow;
  $('portalRefreshBtn').onclick=portalRefreshNow;
  $('submitOrderBtn').onclick=submitOrder;

  $('paymentModalSave').onclick=savePaymentModal;
  $('paymentModalCancel').onclick=closePaymentModal;
  $('paymentModalBackdrop').onclick=closePaymentModal;
}

init();
