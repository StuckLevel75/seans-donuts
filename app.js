const state = {
  apiUrl: localStorage.getItem('sd_api_url') || '',
  session: null
};

function $(id){ return document.getElementById(id); }

async function api(action, payload) {
  const res = await fetch(state.apiUrl,{
    method:'POST',
    headers:{'Content-Type':'text/plain'},
    body: JSON.stringify({action, payload})
  });
  return res.json();
}

/* LOGIN */

async function loginNow() {
  const res = await api('login',{
    loginValue: $('loginValue').value,
    pin: $('loginPin').value
  });

  if (!res.ok) {
    alert('Login failed');
    return;
  }

  state.session = res;

  $('loginView').classList.add('hidden');
  $('portalView').classList.remove('hidden');

  loadAds();
}

/* ADS */

async function loadAds() {
  const res = await api('loadAds',{
    loginValue: $('loginValue').value,
    pin: $('loginPin').value
  });

  const wrap = $('adsList');

  if (!res.ads.length) {
    wrap.innerHTML = '<p>No ads yet</p>';
    return;
  }

  wrap.innerHTML = res.ads.map(ad => `
    <div class="list-item">
      <h4>${ad.Title}</h4>
      <p>${ad['Ad Text']}</p>
      <p>${ad.Platform}</p>
      <button onclick="deleteAd('${ad.ID}')">Delete</button>
    </div>
  `).join('');
}

async function saveAd() {
  await api('saveAd',{
    loginValue: $('loginValue').value,
    pin: $('loginPin').value,
    title: $('adTitle').value,
    text: $('adText').value,
    platform: $('adPlatform').value,
    image: $('adImage').value,
    link: $('adLink').value,
    status: $('adStatus').value
  });

  loadAds();
}

async function deleteAd(id) {
  await api('deleteAd',{
    loginValue: $('loginValue').value,
    pin: $('loginPin').value,
    id
  });

  loadAds();
}

document.getElementById('loginBtn').onclick = loginNow;
