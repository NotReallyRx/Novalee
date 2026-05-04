const iframe = document.getElementById('game-iframe');
const loadBar = document.getElementById('load-bar');
const label = document.getElementById('tb-label');

const PROXY = 'https://novalee.rxk.workers.dev/?url=';

/* =========================
   CLOAK DETECTION
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
  if (loadBar) loadBar.style.transform = 'scaleX(.5)';
}

function finishLoad() {
  if (loadBar) loadBar.style.transform = 'scaleX(1)';
}

/* =========================
   PARAMS
========================= */
const params = new URLSearchParams(location.search);
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
  if (currentSrc) loadGame(currentSrc);
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
      const game =
        games.find(g =>
          g.key === gameId ||
          g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === gameId
        );

      if (!game) {
        document.body.innerHTML = "Game not found: " + gameId;
        return;
      }

      const provider = providers[game.provider] || {};
      const final = { ...provider, ...game };

      const key =
        final.key ||
        game.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      currentKey = key;

      const isLocal = final.prefix === 'l';

      /* =========================
         RESOLVE URL
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
          document.body.innerHTML = "Missing repo for remote game: " + key;
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

      /* =========================
         APPLY PROXY ONLY FOR REMOTE
      ========================= */
      currentSrc = isLocal ? rawUrl : useProxy(rawUrl);

      /* =========================
         SAVE SESSION
      ========================= */
      sessionStorage.setItem('last', JSON.stringify({
        src: currentSrc,
        key: currentKey
      }));

      history.replaceState(null, '', location.pathname);

      /* =========================
         LABEL
      ========================= */
      if (label) {
        label.textContent = currentKey.replace(/-/g, ' ');
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
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }

      link.href = iconUrl;
    }

  } catch (e) {
    console.warn('Meta extraction failed:', e);
  }
}
