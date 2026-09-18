(async function () {
  const LOCK_ENABLED = true;

  const HASH =
    "242ab4ac31522e28fb16163c45c0c19e4402c4a32bcb3b144e7c2edce675b150";
  const STORAGE_KEY = "pass";
  const LOCK_PAGE = "/lock.html";

  if (!LOCK_ENABLED) return;

  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    window.location.replace(LOCK_PAGE);
    return;
  }

  async function sha256(str) {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(str),
    );

    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  const hash = await sha256(saved);

  if (hash !== HASH) {
    localStorage.removeItem(STORAGE_KEY);
    window.location.replace(LOCK_PAGE);
  }
})();
