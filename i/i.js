const iframe  = document.getElementById('game-iframe');
const loadBar = document.getElementById('load-bar');
const label   = document.getElementById('tb-label');

const PROXY = 'https://novalee.rxk.workers.dev/?url=';

/* =========================
   CLOAK DETECTION
========================= */
const tabData = JSON.parse(localStorage.getItem('tab') || '{}');
const hasCloak = !!(tabData.title || tabData.icon);

/* =========================
   PROXY WRAPPER
========================= */
function useProxy(url) {
  return PROXY + encodeURIComponent(url);
}

/* =========================
   LOAD PARAM
========================= */
const params = new URLSearchParams(window.location.search);
const gameId = params.get('g');

let currentSrc = null;
let currentKey = null;

/* =========================
   FALLBACK SESSION
========================= */
function loadFallback() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('last'));
    if (saved) {
      currentSrc = saved.src;
      currentKey = saved.key;
    }
  } catch {}
}

/* =========================
   BOOT
========================= */
if (!gameId) {
  loadFallback();
} else {

  fetch('/g/g.yml')
    .then(res => res.text())
    .then(text => {
      const data = jsyaml.load(text);

      const providers = {};
      (data.providers || []).forEach(p => {
        providers[p.name] = p;
      });

      const games = data.games || [];

      /* =========================
         FIND GAME
      ========================= */
      const game = games.find(g =>
        g.key === gameId ||
        g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === gameId
      );

      if (!game) {
        document.body.innerHTML = "Game not found: " + gameId;
        return;
      }

      const provider = providers[game.provider] || {};
      const final = { ...provider, ...game };

      const key = final.key ||
        game.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      currentKey = key;

      const isLocal = final.prefix === 'l';

      /* =========================
         RESOLVE FILE
      ========================= */
      let filePath;

      if (isLocal) {
        const dir = final.dir || 'games';
        filePath = `${dir}/${key}/index.html`;
      } else {
        filePath = (final.dir ? final.dir + '/' : '') + final.file;
      }

      /* =========================
         RESOLVE FINAL URL
      ========================= */
      let rawUrl;

      if (isLocal) {
        rawUrl = `/${filePath}`;
      } else if (final.prefix === 'r') {
        rawUrl =
          `https://cdn.jsdelivr.net/gh/${final.repo}@${final.tag || 'main'}/${filePath}`;
      } else {
        rawUrl = filePath;
      }

      currentSrc = isLocal ? rawUrl : useProxy(rawUrl);

      /* =========================
         SAVE SESSION
      ========================= */
      sessionStorage.setItem('last', JSON.stringify({
        src: currentSrc,
        key: currentKey
      }));

      history.replaceState(null, '', window.location.pathname);

      /* =========================
         LABEL
      ========================= */
      if (label && currentKey) {
        label.textContent = currentKey.replace(/-/g, ' ');
      }

      /* =========================
         META
      ========================= */
      if (!hasCloak) {
        applyMeta(rawUrl);
      }

      loadGame(currentSrc);
    });
}

/* =========================
   LOAD GAME
========================= */
function loadGame(src) {
  startLoad();

  iframe.removeAttribute('srcdoc');
  iframe.src = src;

  iframe.addEventListener('load', () => {
    finishLoad();

    if (!hasCloak) {
      applyMeta(src);
    }

  }, { once: true });
}

/* =========================
   META EXTRACTION
========================= */
async function applyMeta(url) {
  try {
    const res = await fetch(url);
    const html = await res.text();

    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (titleMatch && !hasCloak) {
      document.title = titleMatch[1];
    }

    const iconMatch =
      html.match(/<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["']/i) ||
      html.match(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i);

    if (iconMatch && !hasCloak) {
      const baseMatch = html.match(/<base[^>]*href=["']([^"']+)["']/i);
      const base = baseMatch ? baseMatch[1] : url;

      const iconUrl = new URL(iconMatch[1], base).href;

      let link = document.querySelector("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }

      link.href = iconUrl;
    }

  } catch (e) {
    console.warn('Meta extraction failed:', e);
  }
}

/* =========================
   LOADING UI
========================= */
function startLoad() {
  if (!loadBar) return;
  loadBar.style.transform = 'scaleX(.5)';
}

function finishLoad() {
  if (!loadBar) return;
  loadBar.style.transform = 'scaleX(1)';
}
