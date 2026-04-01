window.onload = function () {
  alert("JS is alive");

  var demoBtn = document.getElementById("demoFillBtn");
  var loginValue = document.getElementById("loginValue");
  var loginPin = document.getElementById("loginPin");

  if (demoBtn) {
    demoBtn.onclick = function () {
      alert("Demo clicked");
      loginValue.value = "owner";
      loginPin.value = "1234";
    };
  }
};
