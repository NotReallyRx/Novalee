// =========================
// CLOAK DETECTION
// =========================
const tabData = JSON.parse(localStorage.getItem('tab') || '{}');
const hasCloak = !!(tabData.title || tabData.icon);

// =========================
// ELEMENTS
// =========================
const iframe  = document.getElementById('game-iframe');
const loadBar = document.getElementById('load-bar');
const label   = document.getElementById('tb-label');

const CDN_HTML = 'https://cdn.jsdelivr.net/gh/freebuisness/html@main';
const PROXY = 'https://novalee.rxk.workers.dev/?url=';

// =========================
// CDN RESOLVER
// =========================
function resolveCdn(cdn, repo, tag, file) {
  switch (cdn) {
    case 'githack':
      return `https://rawcdn.githack.com/${repo}/${tag}/${file}`;
    case 'raw':
      return `https://raw.githubusercontent.com/${repo}/refs/heads/${tag}/${file}`;
    case 'jsdelivr':
    default:
      return `https://cdn.jsdelivr.net/gh/${repo}@${tag}/${file}`;
  }
}

// =========================
// PROXY WRAPPER (REMOTE ONLY)
// =========================
function useProxy(url) {
  return PROXY + encodeURIComponent(url);
}

// =========================
// PARAMS
// =========================
const params = new URLSearchParams(window.location.search);

let currentSrc = null;
let currentKey = null;

// NEW SYSTEM:
// r = remote (proxy)
// l = local (no proxy)

const remoteRepo = params.get('r');
const file = params.get('f');
const tag  = params.get('tag') || 'main';
const cdn  = params.get('cdn') || 'jsdelivr';

const localFile = params.get('l');

// =========================
// ROUTING
// =========================

// -------------------------
// REMOTE (PROXY ENABLED)
// -------------------------
if (remoteRepo && file) {
  const raw = resolveCdn(cdn, remoteRepo, tag, file);
  currentSrc = useProxy(raw);

  currentKey = file.split('/').pop().replace(/\.[^/.]+$/, '');
}

// -------------------------
// LOCAL (NO PROXY)
// -------------------------
else if (localFile) {
  currentSrc = `/${localFile}`;
  currentKey = localFile.split('/').pop().replace(/\.[^/.]+$/, '');
}

// =========================
// FALLBACK CACHE
// =========================
if (!currentSrc) {
  try {
    const saved = JSON.parse(sessionStorage.getItem('last'));
    if (saved) {
      currentSrc = saved.src;
      currentKey = saved.key;
    }
  } catch {}
}

// =========================
// INIT
// =========================
if (currentSrc) {
  sessionStorage.setItem('last', JSON.stringify({
    src: currentSrc,
    key: currentKey
  }));

  history.replaceState(null, '', window.location.pathname);

  if (label && currentKey) {
    label.textContent = currentKey.replace(/-/g, ' ');
  }

  if (!hasCloak) {
    applyMeta(currentSrc);
  }

  loadGame(currentSrc);
}

// =========================
// LOAD GAME
// =========================
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

// =========================
// META EXTRACTION
// =========================
async function applyMeta(url) {
  try {
    const res = await fetch(url);
    const html = await res.text();

    // TITLE
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (titleMatch && !hasCloak) {
      document.title = titleMatch[1];
    }

    // ICON
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

// =========================
// LOADING UI
// =========================
function startLoad() {
  if (!loadBar) return;
  loadBar.style.transform = 'scaleX(.5)';
}

function finishLoad() {
  if (!loadBar) return;
  loadBar.style.transform = 'scaleX(1)';
}
