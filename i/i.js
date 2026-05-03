const iframe  = document.getElementById('game-iframe');
const loadBar = document.getElementById('load-bar');
const label   = document.getElementById('tb-label');

const CDN_HTML = 'https://cdn.jsdelivr.net/gh/freebuisness/html@main';

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

const params = new URLSearchParams(window.location.search);

let currentSrc = null;
let currentKey = null;
let isCdn = false;

const gh   = params.get('gh');
const file = params.get('f');
const tag  = params.get('tag') || 'main';
const cdn  = params.get('cdn') || 'jsdelivr';
const sw   = params.get('sw') === '1';

if (gh && file) {
  isCdn = true;
  currentSrc = resolveCdn(cdn, gh, tag, file);
  currentKey = file.split('/').pop().replace('.html', '');
} else {
  for (const [prefix, key] of params.entries()) {
    isCdn = prefix === 'i';
    currentSrc = isCdn
      ? `${CDN_HTML}/${key}.html`
      : `/${prefix}/${key}`;
    currentKey = key;
    break;
  }
}

// fallback
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

if (currentSrc) {
  sessionStorage.setItem('last', JSON.stringify({
    src: currentSrc,
    key: currentKey,
    isCdn
  }));

  history.replaceState(null, '', window.location.pathname);

  label.textContent = currentKey.replace(/-/g, ' ');
  loadGame(currentSrc, isCdn);
}

async function loadGame(src, cdnMode) {
  startLoad();

  if (cdnMode) {
    try {
      const res  = await fetch(src);
      let html = await res.text();

      const baseUrl = src.substring(0, src.lastIndexOf('/') + 1);

      /* =========================
         🔥 DISABLE SERVICE WORKER
      ========================= */
      if (!sw) {
        const swPatch = `
<script>
Object.defineProperty(navigator, 'serviceWorker', {
  get() { return undefined; }
});
</script>`;

        if (/<head[^>]*>/i.test(html)) {
          html = html.replace(/<head([^>]*)>/i, `<head$1>${swPatch}`);
        } else {
          html = swPatch + html;
        }
      }

      /* =========================
         📦 BASE TAG (ONLY IF MISSING)
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

      iframe.removeAttribute('src');
      iframe.srcdoc = html;
      iframe.addEventListener('load', finishLoad, { once: true });

    } catch (e) {
      console.error('Fetch failed:', e);
      finishLoad();
    }

  } else {
    iframe.removeAttribute('srcdoc');
    iframe.src = src;
    iframe.addEventListener('load', finishLoad, { once: true });
  }
}

function startLoad() {
  loadBar.style.transition = 'transform .35s ease';
  loadBar.style.transform  = 'scaleX(.45)';
  setTimeout(() => {
    loadBar.style.transform = 'scaleX(.75)';
  }, 300);
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
  loadGame(currentSrc, isCdn);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.getElementById('frame-outer')
      .requestFullscreen()
      .catch(() => document.documentElement.requestFullscreen());
  } else {
    document.exitFullscreen();
  }
}

function popOut() {
  if (currentSrc) window.open(currentSrc, '_blank');
}

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
