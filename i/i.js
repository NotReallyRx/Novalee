const iframe  = document.getElementById('game-iframe');
const loadBar = document.getElementById('load-bar');
const label   = document.getElementById('tb-label');

const CDN_HTML = 'https://cdn.jsdelivr.net/gh/freebuisness/html@main';

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

/* =========================
   PROXY (OPTIONAL BUT RECOMMENDED)
========================= */
// Replace this with your worker if you want full fix
const PROXY = 'https://novalee.rxk.workers.dev/?url=';

function useProxy(url) {
  return PROXY + encodeURIComponent(url);
}

const params = new URLSearchParams(window.location.search);

let currentSrc = null;
let currentKey = null;
let isCdn = false;

const gh   = params.get('gh');
const file = params.get('f');
const tag  = params.get('tag') || 'main';
const cdn  = params.get('cdn') || 'jsdelivr';
const sw   = params.get('sw') === '1';

/* =========================
   SOURCE RESOLVE
========================= */
if (gh && file) {
  isCdn = true;

  const raw = resolveCdn(cdn, gh, tag, file);

  // 🔥 IMPORTANT: ALWAYS proxy CDN content
  currentSrc = useProxy(raw);

  currentKey = file.split('/').pop().replace('.html', '');

} else {
  for (const [prefix, key] of params.entries()) {
    isCdn = prefix === 'i';

    const raw = isCdn
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
      isCdn = saved.isCdn;
    }
  } catch {}
}

/* =========================
   LOAD GAME
========================= */
if (currentSrc) {
  sessionStorage.setItem('last', JSON.stringify({
    src: currentSrc,
    key: currentKey,
    isCdn
  }));

  history.replaceState(null, '', window.location.pathname);

  label.textContent = currentKey.replace(/-/g, ' ');
  loadGame(currentSrc);
}

async function loadGame(src) {
  startLoad();

  try {
    const res = await fetch(src);
    let html = await res.text();

    const baseUrl = src.substring(0, src.lastIndexOf('/') + 1);

    /* =========================
       🔥 HARD BLOCK SERVICE WORKERS
       (must run BEFORE page executes)
    ========================= */
    const swBlock = `
<script>
(() => {
  try {
    navigator.serviceWorker = undefined;
  } catch(e) {}

  Object.defineProperty(navigator, 'serviceWorker', {
    value: undefined,
    configurable: false
  });
})();
</script>`;

    /* =========================
       BASE TAG FIX
    ========================= */
    if (!/<base\s/i.test(html)) {
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(
          /<head([^>]*)>/i,
          `<head$1><base href="${baseUrl}">`
        );
      } else {
        html = `<base href="${baseUrl}">` + html;
      }
    }

    /* =========================
       INJECT SW BLOCK SAFELY
    ========================= */
    if (!sw) {
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head([^>]*)>/i, `<head$1>${swBlock}`);
      } else {
        html = swBlock + html;
      }
    }

    iframe.removeAttribute('src');
    iframe.srcdoc = html;

    iframe.addEventListener('load', finishLoad, { once: true });

  } catch (e) {
    console.error('Load failed:', e);
    finishLoad();
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
