window.onload = function () {
  var API_URL = "https://script.google.com/macros/s/AKfycbyxM4N--Ee9shmW6VmDtLl46aJGrabSBxPhhZMlV1OXEDTMUeyuSavuBu93VoZNnfHVPQ/exec";

  var demoBtn = document.getElementById("demoFillBtn");
  var loginBtn = document.getElementById("loginBtn");
  var saveBtn = document.getElementById("saveApiUrlBtn");

  var loginValue = document.getElementById("loginValue");
  var loginPin = document.getElementById("loginPin");
  var apiUrlInput = document.getElementById("apiUrl");
  var loginMsg = document.getElementById("loginMsg");

  function showMessage(text, type) {
    if (!loginMsg) return;
    loginMsg.textContent = text || "";
    loginMsg.className = text ? "message show " + (type || "info") : "message";
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

        var loginView = document.getElementById("loginView");
        var portalView = document.getElementById("portalView");
        var logoutBtn = document.getElementById("logoutBtn");
        var sessionStatus = document.getElementById("sessionStatus");
        var userBadge = document.getElementById("userBadge");
        var sessionRole = document.getElementById("sessionRole");

        if (loginView) loginView.classList.add("hidden");
        if (portalView) portalView.classList.remove("hidden");
        if (logoutBtn) logoutBtn.classList.remove("hidden");
        if (sessionStatus) sessionStatus.textContent = "Signed in";
        if (sessionRole) sessionRole.textContent = data.employee.role || "Employee";
        if (userBadge) userBadge.textContent = data.employee.name + " · " + data.employee.role;
      } catch (err) {
        showMessage("Failed to connect to backend.", "error");
      }
    };
  }
};
