(async () => {

  // register SW (safe even if already registered)
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } catch {}
  }

  await navigator.serviceWorker.ready;

  // load scramjet
  const { ScramjetController } = $scramjetLoadController();

  const scramjet = new ScramjetController({
    prefix: '/scramjet/',
    files: {
      wasm: '/p/scramjet.wasm.wasm',
      sync: '/p/scramjet.sync.js',
    },
    flags: {
      strictRewrites: true,
      captureErrors: true,
    }
  });

  await scramjet.init();

  // create hidden frame page redirect (uses your existing /i/ system if needed)
  const frame = scramjet.createFrame();

  // create container dynamically so we don't touch your layout
  let container = document.createElement('div');
  container.id = 'frame-outer';
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.zIndex = '5';
  container.style.display = 'none';

  container.appendChild(frame.frame);
  document.body.appendChild(container);

  const input = document.getElementById('searchInput');
  const btn = document.getElementById('searchBtn');
  const label = document.getElementById('tb-label');

  function format(val) {
    if (!val.startsWith('http://') && !val.startsWith('https://')) {
      return 'https://www.google.com/search?q=' + encodeURIComponent(val);
    }
    return val;
  }

  function go() {
    const val = input.value.trim();
    if (!val) return;

    container.style.display = 'block';
    frame.go(format(val));
  }

  btn.onclick = go;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') go();
  });

  // update toolbar label
  frame.addEventListener('urlchange', (e) => {
    label.textContent = e.url;
  });

})();
