```javascript
const iframe  = document.getElementById('game-iframe');
const loadBar = document.getElementById('load-bar');
const label   = document.getElementById('tb-label');

const CDN_HTML = 'https://cdn.jsdelivr.net/gh/freebuisness/html@main';

const params = new URLSearchParams(window.location.search);

let currentSrc = null;
let currentKey = null;
let isCdn = false;

// NEW: GH support
const gh   = params.get('gh');
const file = params.get('f');

if (gh && file) {
  isCdn = true;
  currentSrc = `https://cdn.jsdelivr.net/gh/${gh}@main/${file}`;
  currentKey = file.split('/').pop().replace('.html', '');
} else {
  // existing system
  for (const [prefix, key] of params.entries()) {
    isCdn = prefix === 'i';
    currentSrc = isCdn
      ? `${CDN_HTML}/${key}.html`
      : `/${prefix}/${key}`;
    currentKey = key;
    break;
  }
}

// fallback (unchanged)
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

async function loadGame(src, cdn) {
  startLoad();

  if (cdn) {
    try {
      const res  = await fetch(src);
      const html = await res.text();

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
  setTimeout(() => { loadBar.style.transform = 'scaleX(.75)'; }, 300);
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
  if (e.key === 'F11')            { e.preventDefault(); toggleFullscreen(); }
  if (e.ctrlKey && e.key === 'r') { e.preventDefault(); reloadFrame(); }
});
```
