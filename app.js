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
    if (sessionRole) sessionRole.textContent = data.employee.role || "Employee";
    if (userBadge) userBadge.textContent = (data.employee.name || "Portal User") + " · " + (data.employee.role || "Employee");
    if (welcomeTitle) welcomeTitle.textContent = "Welcome, " + (data.employee.name || "Employee");
    if (announcementBar) announcementBar.textContent = (data.portalPrefs && data.portalPrefs.announcement) || "Welcome to Sean's Donuts Portal";
    if (bankIdText) bankIdText.textContent = (data.portalPrefs && data.portalPrefs.bankId) || "24596194";
    if (settingsAnnouncement) settingsAnnouncement.value = (data.portalPrefs && data.portalPrefs.announcement) || "";
    if (settingsBankId) settingsBankId.value = (data.portalPrefs && data.portalPrefs.bankId) || "24596194";

    showDashboardOnly();
    renderNav(data);
  }

  function showDashboardOnly() {
    var sections = [
      "dashboardSection",
      "posSection",
      "ordersSection",
      "rewardsSection",
      "raffleSection",
      "payrollSection",
      "settingsSection"
    ];

    for (var i = 0; i < sections.length; i++) {
      var el = document.getElementById(sections[i]);
      if (!el) continue;
      if (sections[i] === "dashboardSection") el.classList.remove("hidden");
      else el.classList.add("hidden");
    }
  }

  function renderNav(data) {
    var navTabs = document.getElementById("navTabs");
    if (!navTabs) return;

    var tabs = [
      { key: "dashboard", label: "Dashboard", section: "dashboardSection" },
      { key: "pos", label: "POS", section: "posSection" },
      { key: "orders", label: "Orders", section: "ordersSection" },
      { key: "rewards", label: "Rewards", section: "rewardsSection" },
      { key: "raffle", label: "Raffle", section: "raffleSection" },
      { key: "payroll", label: "Payroll", section: "payrollSection" }
    ];

    var isOwner = data && data.permissions && (data.permissions.isOwner || data.permissions.isAdmin);
    if (isOwner) {
      tabs.push({ key: "settings", label: "Settings", section: "settingsSection" });
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
        for (var j = 0; j < allBtns.length; j++) allBtns[j].classList.remove("active");
        this.classList.add("active");

        var sections = [
          "dashboardSection",
          "posSection",
          "ordersSection",
          "rewardsSection",
          "raffleSection",
          "payrollSection",
          "settingsSection"
        ];

        for (var k = 0; k < sections.length; k++) {
          var el = document.getElementById(sections[k]);
          if (!el) continue;
          if (sections[k] === this.getAttribute("data-section")) el.classList.remove("hidden");
          else el.classList.add("hidden");
        }
      };
      navTabs.appendChild(btn);
    }
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
      var url = (apiUrlInput ? apiUrlInput.value.trim() : "") || API_URL;

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

      showMessage("");
    };
  }
};
