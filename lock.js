(async function () {

  const HASH = "7d9b0729ffe07d6557c8db04fc6f23dfeb2f2db8bb0564f934e3cb8ed5825dd9";
  const STORAGE_KEY = "pass";
  const LOCK_PAGE = "/lock.html";

  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    window.location.replace(LOCK_PAGE);
    return;
  }

  async function sha256(str) {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(str)
    );
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  const hash = await sha256(saved);

  if (hash !== HASH) {
    localStorage.removeItem(STORAGE_KEY);
    window.location.replace(LOCK_PAGE);
    return;
  }

  // ✅ valid → do nothing

})();
