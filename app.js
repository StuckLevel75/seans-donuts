document.addEventListener("DOMContentLoaded", function () {
  const demoBtn = document.getElementById("demoFillBtn");
  const loginValue = document.getElementById("loginValue");
  const loginPin = document.getElementById("loginPin");
  const loginMsg = document.getElementById("loginMsg");

  if (demoBtn) {
    demoBtn.onclick = function () {
      if (loginValue) loginValue.value = "owner";
      if (loginPin) loginPin.value = "1234";
      if (loginMsg) {
        loginMsg.textContent = "Demo login filled.";
        loginMsg.className = "message show success";
      }
    };
  }
});
