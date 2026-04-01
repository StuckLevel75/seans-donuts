alert("app.js is loading");

document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("loginBtn");
  const demoFillBtn = document.getElementById("demoFillBtn");
  const saveApiUrlBtn = document.getElementById("saveApiUrlBtn");

  if (demoFillBtn) {
    demoFillBtn.addEventListener("click", () => {
      alert("Demo button works");
      const loginValue = document.getElementById("loginValue");
      const loginPin = document.getElementById("loginPin");
      if (loginValue) loginValue.value = "owner";
      if (loginPin) loginPin.value = "1234";
    });
  }

  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      alert("Login button works");
    });
  }

  if (saveApiUrlBtn) {
    saveApiUrlBtn.addEventListener("click", () => {
      alert("Save URL button works");
    });
  }
});
