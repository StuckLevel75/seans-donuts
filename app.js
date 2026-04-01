window.onload = function () {
  var API_URL = "https://script.google.com/macros/s/AKfycbyxM4N--Ee9shmW6VmDtLl46aJGrabSBxPhhZMlV1OXEDTMUeyuSavuBu93VoZNnfHVPQ/exec";

  var demoBtn = document.getElementById("demoFillBtn");
  var loginBtn = document.getElementById("loginBtn");
  var saveBtn = document.getElementById("saveApiUrlBtn");
  var logoutBtn = document.getElementById("logoutBtn");

  var loginValue = document.getElementById("loginValue");
  var loginPin = document.getElementById("loginPin");
  var apiUrlInput = document.getElementById("apiUrl");
  var loginMsg = document.getElementById("loginMsg");

  function showMessage(text, type) {
    if (!loginMsg) return;
    loginMsg.textContent = text || "";
    loginMsg.className = text ? "message show " + (type || "info") : "message";
  }

  function hideAllSections() {
    var ids = [
      "dashboardSection",
      "posSection",
      "ordersSection",
      "rewardsSection",
      "raffleSection",
      "payrollSection",
      "settingsSection"
    ];

    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) el.classList.add("hidden");
    }
  }

  function showSection(sectionId) {
    hideAllSections();
    var el = document.getElementById(sectionId);
    if (el) el.classList.remove("hidden");
  }

  function renderNav(data) {
    var navTabs = document.getElementById("navTabs");
    if (!navTabs) return;

    var tabs = [
      { label: "Dashboard", section: "dashboardSection" },
      { label: "POS", section: "posSection" },
      { label: "Orders", section: "ordersSection" },
      { label: "Rewards", section: "rewardsSection" },
      { label: "Raffle", section: "raffleSection" },
      { label: "Payroll", section: "payrollSection" }
    ];

    var isOwner = data && data.permissions && (data.permissions.isOwner || data.permissions.isAdmin);
    if (isOwner) {
      tabs.push({ label: "Settings", section: "settingsSection" });
    }

    navTabs.innerHTML = "";

    for (var i = 0; i < tabs.length; i++) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nav-btn" + (i === 0 ? " active" : "");
      btn.textContent = tabs[i].label;
      btn.setAttribute("data-section", tabs[i].section);

      btn.onclick = function () {
        var allBtns = navTabs.querySelectorAll(".nav-btn");
        for (var j = 0; j < allBtns.length; j++) {
          allBtns[j].classList.remove("active");
        }
        this.classList.add("active");
        showSection(this.getAttribute("data-section"));
      };

      navTabs.appendChild(btn);
    }
  }

  function showPortal(data) {
    var loginView = document.getElementById("loginView");
    var portalView = document.getElementById("portalView");
    var sessionStatus = document.getElementById("sessionStatus");
    var sessionRole = document.getElementById("sessionRole");
    var userBadge = document.getElementById("userBadge");
    var welcomeTitle = document.getElementById("welcomeTitle");
    var announcementBar = document.getElementById("announcementBar");
    var bankIdText = document.getElementById("bankIdText");
    var settingsAnnouncement = document.getElementById("settingsAnnouncement");
    var settingsBankId = document.getElementById("settingsBankId");

    if (loginView) loginView.classList.add("hidden");
    if (portalView) portalView.classList.remove("hidden");
    if (logoutBtn) logoutBtn.classList.remove("hidden");

    if (sessionStatus) sessionStatus.textContent = "Signed in";
    if (sessionRole) sessionRole.textContent = data.employee && data.employee.role ? data.employee.role : "Employee";
    if (userBadge) userBadge.textContent = (data.employee && data.employee.name ? data.employee.name : "Portal User") + " · " + (data.employee && data.employee.role ? data.employee.role : "Employee");
    if (welcomeTitle) welcomeTitle.textContent = "Welcome, " + (data.employee && data.employee.name ? data.employee.name : "Employee");
    if (announcementBar) announcementBar.textContent = data.portalPrefs && data.portalPrefs.announcement ? data.portalPrefs.announcement : "Welcome to Sean's Donuts Portal";
    if (bankIdText) bankIdText.textContent = data.portalPrefs && data.portalPrefs.bankId ? data.portalPrefs.bankId : "24596194";
    if (settingsAnnouncement) settingsAnnouncement.value = data.portalPrefs && data.portalPrefs.announcement ? data.portalPrefs.announcement : "";
    if (settingsBankId) settingsBankId.value = data.portalPrefs && data.portalPrefs.bankId ? data.portalPrefs.bankId : "24596194";

    renderNav(data);
    showSection("dashboardSection");
  }

  if (apiUrlInput) {
    apiUrlInput.value = localStorage.getItem("sd_api_url") || API_URL;
  }

  if (demoBtn) {
    demoBtn.onclick = function () {
      if (loginValue) loginValue.value = "owner";
      if (loginPin) loginPin.value = "1234";
      showMessage("Demo login filled.", "success");
    };
  }

  if (saveBtn) {
    saveBtn.onclick = function () {
      var val = apiUrlInput ? apiUrlInput.value.trim() : "";
      localStorage.setItem("sd_api_url", val);
      showMessage("API URL saved.", "success");
    };
  }

  if (loginBtn) {
    loginBtn.onclick = async function () {
      var email = loginValue ? loginValue.value.trim() : "";
      var pin = loginPin ? loginPin.value.trim() : "";
      var url = apiUrlInput && apiUrlInput.value.trim() ? apiUrlInput.value.trim() : API_URL;

      showMessage("Signing in...", "info");

      try {
        var res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "login",
            payload: { email: email, pin: pin }
          })
        });

        var data = await res.json();

        if (!data.ok) {
          showMessage(data.message || "Login failed.", "error");
          return;
        }

        showMessage("Login success!", "success");
        showPortal(data);
      } catch (err) {
        showMessage("Failed to connect to backend.", "error");
      }
    };
  }

  if (logoutBtn) {
    logoutBtn.onclick = function () {
      var loginView = document.getElementById("loginView");
      var portalView = document.getElementById("portalView");
      var navTabs = document.getElementById("navTabs");
      var sessionStatus = document.getElementById("sessionStatus");
      var sessionRole = document.getElementById("sessionRole");
      var userBadge = document.getElementById("userBadge");

      if (loginView) loginView.classList.remove("hidden");
      if (portalView) portalView.classList.add("hidden");
      if (logoutBtn) logoutBtn.classList.add("hidden");
      if (navTabs) navTabs.innerHTML = "";
      if (sessionStatus) sessionStatus.textContent = "Signed out";
      if (sessionRole) sessionRole.textContent = "—";
      if (userBadge) userBadge.textContent = "Portal User";

      hideAllSections();
      showMessage("");
    };
  }
};
