const iframe = document.getElementById('game-iframe');
const loadBar = document.getElementById('load-bar');
const label = document.getElementById('tb-label');

const PROXY = 'https://novalee.rxk.workers.dev/?url=';

/* =========================
   SAFETY LOGGING
========================= */
console.log("[i.js] booted:", location.href);

/* =========================
   CLOAK
========================= */
const tabData = JSON.parse(localStorage.getItem('tab') || '{}');
const hasCloak = !!(tabData.title || tabData.icon);

/* =========================
   HELPERS
========================= */
function useProxy(url) {
  return PROXY + encodeURIComponent(url);
}

function startLoad() {
  if (loadBar) loadBar.style.transform = 'scaleX(.4)';
}

function finishLoad() {
  if (loadBar) loadBar.style.transform = 'scaleX(1)';
}

/* =========================
   PARAMS
========================= */
const params = new URLSearchParams(location.search);
const gameId = params.get('g');

console.log("[i.js] gameId:", gameId);

if (!gameId) {
  fail("Missing ?g= parameter");
}

/* =========================
   FAIL STATE (VISIBLE)
========================= */
function fail(msg) {
  console.error("[i.js] FAIL:", msg);
  document.body.innerHTML = `
    <div style="color:white;font-family:sans-serif;padding:20px">
      <h2>Game Loader Error</h2>
      <p>${msg}</p>
    </div>
  `;
}

/* =========================
   LOAD YAML
========================= */
fetch('/g/g.yml')
  .then(res => {
    console.log("[i.js] YAML fetch status:", res.status);
    return res.text();
  })
  .then(text => {

    if (!window.jsyaml) {
      fail("jsyaml is not loaded");
      return;
    }

    let data;

    try {
      data = jsyaml.load(text);
    } catch (e) {
      fail("YAML parse error: " + e.message);
      return;
    }

    console.log("[i.js] YAML loaded OK");

    const providers = {};
    (data.providers || []).forEach(p => {
      providers[p.name] = p;
    });

    const games = data.games || [];

    console.log("[i.js] games:", games.length);

    const game =
      games.find(g =>
        g.key === gameId ||
        g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === gameId
      );

    if (!game) {
      fail("Game not found: " + gameId);
      return;
    }

    const provider = providers[game.provider] || {};
    const final = { ...provider, ...game };

    const key =
      final.key ||
      game.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const isLocal = final.prefix === 'l';

    console.log("[i.js] resolved game:", {
      name: game.name,
      key,
      isLocal,
      provider: game.provider
    });

    /* =========================
       BUILD URL
    ========================= */
    let rawUrl;

    if (isLocal) {
      const dir = final.dir || 'g';
      rawUrl = `/${dir}/${key}/index.html`;
    } else {
      const repo = final.repo || game.repo;
      const tag = final.tag || 'main';
      const file = final.file || 'index.html';
      const cdn = final.cdn || 'jsdelivr';

      if (!repo) {
        fail("Missing repo for remote game: " + key);
        return;
      }

      if (cdn === 'githack') {
        rawUrl = `https://rawcdn.githack.com/${repo}/${tag}/${file}`;
      } else if (cdn === 'raw') {
        rawUrl = `https://raw.githubusercontent.com/${repo}/refs/heads/${tag}/${file}`;
      } else {
        rawUrl = `https://cdn.jsdelivr.net/gh/${repo}@${tag}/${file}`;
      }
    }

    console.log("[i.js] rawUrl:", rawUrl);

    const finalUrl = isLocal ? rawUrl : useProxy(rawUrl);

    console.log("[i.js] finalUrl:", finalUrl);

    /* =========================
       LABEL
    ========================= */
    if (label) {
      label.textContent = key.replace(/-/g, ' ');
    }

    /* =========================
       LOAD GAME
    ========================= */
    loadGame(finalUrl);

  })
  .catch(err => {
    fail("Fetch failed: " + err.message);
  });

/* =========================
   LOAD GAME
========================= */
function loadGame(src) {
  if (!iframe) {
    fail("Missing iframe element");
    return;
  }

  console.log("[i.js] loading iframe:", src);

  startLoad();

  iframe.src = src;

  iframe.onload = () => {
    console.log("[i.js] iframe loaded");
    finishLoad();

    if (!hasCloak) {
      applyMeta(src);
    }
  };
}

/* =========================
   META
========================= */
async function applyMeta(url) {
  try {
    const res = await fetch(url);
    const html = await res.text();

    const title = html.match(/<title>(.*?)<\/title>/i);
    if (title && !hasCloak) {
      document.title = title[1];
    }

    const icon =
      html.match(/<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["']/i) ||
      html.match(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i);

    if (icon && !hasCloak) {
      const baseMatch = html.match(/<base[^>]*href=["']([^"']+)["']/i);
      const base = baseMatch ? baseMatch[1] : url;

      const iconUrl = new URL(icon[1], base).href;

      let link = document.querySelector("link[rel='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }

      link.href = iconUrl;
    }

  } catch (e) {
    console.warn("[i.js] meta failed:", e);
  }
}
