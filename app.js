// ================= STATE =================
const state = {
  apiUrl: localStorage.getItem('sd_api_url') || '',
  session: null,
  bootstrap: null,
  adminData: null,
  products: [],
  cart: {},
  activeTab: 'dashboard'
};

// ================= HELPERS =================
function $(id){ return document.getElementById(id); }
function setText(id,v){ if($(id)) $(id).textContent=v||''; }
function setValue(id,v){ if($(id)) $(id).value=v||''; }
function getValue(id){ return $(id)?.value || ''; }
function money(v){ return `$${Number(v||0).toFixed(2)}`; }

// ================= API =================
async function api(action,payload={}){
  const res = await fetch(state.apiUrl,{
    method:'POST',
    headers:{'Content-Type':'text/plain'},
    body:JSON.stringify({action,payload})
  });
  return res.json();
}

// ================= NAV =================
const tabs=[
  'dashboard','pos','orders','rewards','raffle','ads','payroll','settings'
];

function renderNav(){
  $('navTabs').innerHTML = tabs.map(t=>`
    <button class="nav-btn ${state.activeTab===t?'active':''}" data-tab="${t}">
      ${t.toUpperCase()}
    </button>
  `).join('');

  document.querySelectorAll('[data-tab]').forEach(btn=>{
    btn.onclick=()=>activateTab(btn.dataset.tab);
  });
}

function activateTab(tab){
  state.activeTab=tab;

  document.querySelectorAll('.page-panel').forEach(p=>p.classList.add('hidden'));
  $(`${tab}Section`)?.classList.remove('hidden');

  renderNav();

  if(tab==='orders') loadOrders();
  if(tab==='rewards') renderRewardsBlank();
  if(tab==='settings') loadAdminData();
}

// ================= LOGIN =================
async function loginNow(){
  const loginValue=getValue('loginValue');
  const pin=getValue('loginPin');

  const res=await api('login',{loginValue,pin});
  if(!res.ok) return alert(res.message);

  state.session=res;

  const boot=await api('getPortalBootstrap');
  state.bootstrap=boot;

  state.products=boot.products||[];

  fillHeader();
  renderNav();
  activateTab('dashboard');

  $('loginView').classList.add('hidden');
  $('portalView').classList.remove('hidden');
}

function fillHeader(){
  setText('userBadge',`👋 Hello, ${state.session.employee.name}`);
  setText('sessionRole',state.session.employee.role);
}

// ================= ORDERS =================
async function loadOrders(){
  const res=await api('searchOrders',{query:getValue('orderSearchInput')});
  const rows=res.results||[];

  $('ordersList').innerHTML = rows.map(r=>`
    <details class="settings-popout">
      <summary>
        ${r['Order Number']} — ${r['Customer Name']}
      </summary>
      <div class="settings-popout-body">
        <p><b>Employee:</b> ${r['Employee Name']}</p>
        <p><b>Discord:</b> ${r['Customer Discord']}</p>
        <p><b>Phone:</b> ${r['Phone Number']}</p>
        <p><b>Total:</b> ${money(r['Total'])}</p>
        <p><b>Notes:</b> ${r['Notes']||''}</p>
      </div>
    </details>
  `).join('');
}

// ================= REWARDS =================
function renderRewardsBlank(){
  $('rewardsResultCard').innerHTML = `
    <div class="list-item">Search a customer</div>
  `;
}

async function loadRewards(){
  const res=await api('lookupRewards',{customerName:getValue('rewardCustomerName')});
  const r=res.reward||{};

  $('rewardsResultCard').innerHTML = `
    <details class="settings-popout" open>
      <summary>${getValue('rewardCustomerName')}</summary>
      <div class="settings-popout-body">
        <p>Visits: ${r.visits||0}</p>
        <p>Progress: ${r.visitProgress||0}/10</p>
        <p>Available: ${r.rewardsAvailable||0}</p>
        <p>Redeemed: ${r.totalRewardsRedeemed||0}</p>
      </div>
    </details>
  `;
}

// ================= ADMIN =================
async function loadAdminData(){
  const res=await api('getAdminData');
  state.adminData=res;

  // Raffle settings
  setValue('raffleEnabledSetting',res.settings.raffleEnabled||'Yes');
  setValue('raffleMaxOverallSetting',res.settings.raffleMaxOverall||0);
  setValue('raffleMaxPerPersonSetting',res.settings.raffleMaxPerPerson||0);
  setValue('raffleStartDateSetting',res.settings.raffleStart||'');
  setValue('raffleEndDateSetting',res.settings.raffleEnd||'');
}

// ================= SAVE RAFFLE =================
async function saveRaffleSettings(){
  const res=await api('saveRaffleSettings',{
    enabled:getValue('raffleEnabledSetting'),
    maxOverall:getValue('raffleMaxOverallSetting'),
    maxPer:getValue('raffleMaxPerPersonSetting'),
    start:getValue('raffleStartDateSetting'),
    end:getValue('raffleEndDateSetting')
  });

  alert(res.message);
}

// ================= EVENTS =================
function init(){
  $('loginBtn').onclick=loginNow;
  $('searchOrdersBtn').onclick=loadOrders;
  $('lookupRewardsBtn').onclick=loadRewards;
  $('saveRaffleSettingsBtn').onclick=saveRaffleSettings;
}

init();
