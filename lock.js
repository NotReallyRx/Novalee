(function () {

  const HASH = "54076e29e0cf42179af31b0e22317f8d";
  const STORAGE_KEY = "gate_pass";

  /* =========================
     MD5 (tiny implementation)
  ========================= */
  function md5(str) {
    return crypto.subtle.digest("MD5", new TextEncoder().encode(str))
      .then(buf => Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, "0"))
        .join(""));
  }

  /* =========================
     CHECK SAVED
  ========================= */
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved === HASH) return; // already unlocked

  /* =========================
     CREATE OVERLAY
  ========================= */
  const overlay = document.createElement("div");
  overlay.id = "gate-overlay";

  overlay.innerHTML = `
    <div id="gate-box">
      <div id="gate-title">ACCESS</div>
      <input id="gate-input" type="password" placeholder="enter password" autofocus />
      <div id="gate-error"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  /* =========================
     STYLES (uses your theme)
  ========================= */
  const style = document.createElement("style");
  style.textContent = `
    #gate-overlay {
      position: fixed;
      inset: 0;
      background: var(--bg);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
    }

    #gate-box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 28px;
      width: 260px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.02);
    }

    #gate-title {
      font-family: 'Syne', sans-serif;
      font-size: .75rem;
      letter-spacing: .2em;
      text-align: center;
      color: var(--muted);
    }

    #gate-input {
      background: var(--raised);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 10px;
      border-radius: 6px;
      outline: none;
      font-family: 'DM Mono', monospace;
      text-align: center;
    }

    #gate-input:focus {
      border-color: var(--border-hi);
      background: var(--dim);
    }

    #gate-error {
      font-size: .6rem;
      text-align: center;
      color: #ff4d4d;
      height: 10px;
      opacity: .7;
    }
  `;
  document.head.appendChild(style);

  const input = document.getElementById("gate-input");
  const error = document.getElementById("gate-error");

  /* =========================
     HANDLE INPUT
  ========================= */
  input.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;

    const value = input.value.trim();
    if (!value) return;

    const hash = await md5(value);

    if (hash === HASH) {
      localStorage.setItem(STORAGE_KEY, HASH);
      overlay.remove();
    } else {
      error.textContent = "invalid";
      input.value = "";
    }
  });

})();
