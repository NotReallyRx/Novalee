// =========================
// CLOAK DETECTION (delegated to main.js)
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
// SOURCE RESOLVE (UNCHANGED)
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

function useProxy(url) {
  return PROXY + encodeURIComponent(url);
}

const params = new URLSearchParams(window.location.search);

let currentSrc = null;
let currentKey = null;

const gh   = params.get('gh');
const file = params.get('f');
const tag  = params.get('tag') || 'main';
const cdn  = params.get('cdn') || 'jsdelivr';

if (gh && file) {
  const raw = resolveCdn(cdn, gh, tag, file);
  currentSrc = useProxy(raw);
  currentKey = file.split('/').pop().replace('.html', '');
} else {
  for (const [prefix, key] of params.entries()) {
    const raw = prefix === 'i'
      ? `${CDN_HTML}/${key}.html`
      : `/${prefix}/${key}`;

    currentSrc = useProxy(raw);
    currentKey = key;
    break;
  }
}


// =========================
// CACHE FALLBACK
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
// LOAD GAME
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

  // =========================================
  // CLOAK RULE:
  // If cloak exists → DO NOT override title/icon from iframe
  // main.js handles everything
  // =========================================
  if (!hasCloak) {
    applyMeta(currentSrc);
  }

  loadGame(currentSrc);
}


// =========================
// IFRAME LOAD
// =========================
function loadGame(src) {
  startLoad();

  iframe.removeAttribute('srcdoc');
  iframe.src = src;

  iframe.addEventListener('load', () => {
    finishLoad();

    // Only apply meta again if NO cloak exists
    if (!hasCloak) {
      applyMeta(src);
    }

  }, { once: true });
}


// =========================
// META EXTRACTION (ONLY WHEN NO CLOAK)
// =========================
async function applyMeta(proxyUrl) {
  try {
    const res = await fetch(proxyUrl);
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
      const base = baseMatch ? baseMatch[1] : proxyUrl;

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
