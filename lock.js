(function () {

  const HASH = "54076e29e0cf42179af31b0e22317f8d";
  const STORAGE_KEY = "gate_pass";
  const LOCK_PAGE = "/lock.html";

  const saved = localStorage.getItem(STORAGE_KEY);

  // no password stored → go to lock
  if (!saved) {
    window.location.replace(LOCK_PAGE);
    return;
  }

  // wrong password stored → reset + redirect
  if (saved !== HASH) {
    localStorage.removeItem(STORAGE_KEY);
    window.location.replace(LOCK_PAGE);
    return;
  }

  // ✅ valid → do nothing, page loads normally

})();
