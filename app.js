const API_URL = "https://script.google.com/macros/s/AKfycbyxM4N--Ee9shmW6VmDtLl46aJGrabSBxPhhZMlV1OXEDTMUeyuSavuBu93VoZNnfHVPQ/exec";

document.addEventListener("DOMContentLoaded", () => {
const loginBtn = document.getElementById("loginBtn");
const demoBtn = document.getElementById("demoFillBtn");
const saveBtn = document.getElementById("saveApiUrlBtn");

const loginMsg = document.getElementById("loginMsg");

function showMessage(msg, type = "info") {
if (!loginMsg) return;
loginMsg.textContent = msg;
loginMsg.className = `message show ${type}`;
}

if (demoBtn) {
demoBtn.addEventListener("click", () => {
document.getElementById("loginValue").value = "owner";
document.getElementById("loginPin").value = "1234";
});
}

if (saveBtn) {
saveBtn.addEventListener("click", () => {
const val = document.getElementById("apiUrl").value.trim();
localStorage.setItem("sd_api_url", val);
showMessage("API URL saved", "success");
});
}

if (loginBtn) {
loginBtn.addEventListener("click", async () => {
const email = document.getElementById("loginValue").value.trim();
const pin = document.getElementById("loginPin").value.trim();

```
  showMessage("Signing in...", "info");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "login",
        payload: { email, pin }
      })
    });

    const data = await res.json();

    if (!data.ok) {
      showMessage(data.message || "Login failed", "error");
      return;
    }

    showMessage("Login success!", "success");

    document.getElementById("loginView").classList.add("hidden");
    document.getElementById("portalView").classList.remove("hidden");

    document.getElementById("sessionStatus").textContent = "Signed in";
    document.getElementById("userBadge").textContent =
      data.employee.name + " · " + data.employee.role;

  } catch (err) {
    showMessage("Failed to connect to backend", "error");
  }
});
```

}
});
