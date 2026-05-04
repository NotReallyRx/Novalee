function forceCloak() {
  try {
    const tabData = JSON.parse(localStorage.getItem('tab') || '{}');

    if (!tabData.title && !tabData.icon) return;

    // TITLE
    if (tabData.title && document.title !== tabData.title) {
      document.title = tabData.title;
    }

    // ICON
    if (tabData.icon) {
      let link = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }

      const current = link.href.split('?')[0];
      if (current !== tabData.icon) {
        link.href = tabData.icon + '?v=' + Date.now();
      }
    }

  } catch {}
}


const iframe  = document.getElementById('game-iframe');
const loadBar = document.getElementById('load-bar');
const label   = document.getElementById('tb-label');

const CDN_HTML = 'https://cdn.jsdelivr.net/gh/freebuisness/html@main';
const PROXY = 'https://novalee.rxk.workers.dev/?url=';

/* =========================
   CDN RESOLVER
========================= */
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

/* =========================
   SOURCE RESOLVE
========================= */
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

/* =========================
   FALLBACK CACHE
========================= */
if (!currentSrc) {
  try {
    const saved = JSON.parse(sessionStorage.getItem('last'));
    if (saved) {
      currentSrc = saved.src;
      currentKey = saved.key;
    }
  } catch {}
}

/* =========================
   LOAD GAME
========================= */
if (currentSrc) {
  sessionStorage.setItem('last', JSON.stringify({
    src: currentSrc,
    key: currentKey
  }));

  history.replaceState(null, '', window.location.pathname);

  label.textContent = currentKey.replace(/-/g, ' ');

  applyMeta(currentSrc);
  loadGame(currentSrc);
}

/* =========================
   LOAD INTO IFRAME (REAL URL)
========================= */
function loadGame(src) {
  startLoad();

  iframe.removeAttribute('srcdoc');
  iframe.src = src;

  iframe.addEventListener('load', finishLoad, { once: true });
}

/* =========================
   TITLE + ICON EXTRACTION
========================= */
async function applyMeta(proxyUrl) {
  try {
    const res = await fetch(proxyUrl);
    const html = await res.text();

    // --- TITLE ---
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (titleMatch) {
      document.title = titleMatch[1];
    }

    // --- ICON ---
    const iconMatch =
      html.match(/<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["']/i) ||
      html.match(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i);

    if (iconMatch) {
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

/* =========================
   UI HELPERS
========================= */
function startLoad() {
  loadBar.style.transition = 'transform .35s ease';
  loadBar.style.transform  = 'scaleX(.45)';
  setTimeout(() => loadBar.style.transform = 'scaleX(.75)', 300);
}

function finishLoad() {
  loadBar.style.transform = 'scaleX(1)';
  setTimeout(() => {
    loadBar.style.transition = 'none';
    loadBar.style.transform  = 'scaleX(0)';
  }, 380);
}

function reloadFrame() {
  if (!currentSrc) return;
  loadGame(currentSrc);
}
forceCloak();
function toggleFullscreen() {
  const el = document.getElementById('frame-outer');

  if (!document.fullscreenElement) {
    el.requestFullscreen().catch(() =>
      document.documentElement.requestFullscreen()
    );
  } else {
    document.exitFullscreen();
  }
}

function popOut() {
  if (currentSrc) window.open(currentSrc, '_blank');
}

/* =========================
   HOTKEYS
========================= */
document.addEventListener('keydown', e => {
  if (e.key === 'F11') {
    e.preventDefault();
    toggleFullscreen();
  }

  if (e.ctrlKey && e.key === 'r') {
    e.preventDefault();
    reloadFrame();
  }
});
