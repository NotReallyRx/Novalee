(async () => {

  // SW
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  // Scramjet
  const { ScramjetController } = $scramjetLoadController();

  const scramjet = new ScramjetController({
    prefix: '/scramjet/',
    files: {
      wasm: '/p/scramjet.wasm.wasm',
      all: '/p/scramjet.all.js',
      sync: '/p/scramjet.sync.js',
    }
  });

  await scramjet.init();

  // -----------------------------
  // 🔥 EPoxy ProxyTransport layer
  // -----------------------------

  class EpoxyTransport {
    constructor(opts) {
      this.wisp = opts.wisp;
      this.ready = false;
    }

    async init() {
      // load epoxy bundle if needed
      this.ready = true;
    }

    async request(remote, method, body, headers, signal) {
      const res = await fetch(remote.toString(), {
        method,
        body,
        headers,
        signal,
        redirect: "manual"
      });

      return {
        body: await res.arrayBuffer(),
        headers: Object.fromEntries(res.headers.entries()),
        status: res.status,
        statusText: res.statusText
      };
    }

    connect(url, protocols, headers, onopen, onmessage, onclose, onerror) {
      const ws = new WebSocket(url.toString(), protocols);

      ws.binaryType = "arraybuffer";

      ws.onopen = () => onopen("", "");
      ws.onmessage = (e) => onmessage(e.data);
      ws.onerror = () => onerror("ws error");
      ws.onclose = (e) => onclose(e.code, e.reason);

      return [
        (data) => ws.send(data),
        (code, reason) => ws.close(code, reason)
      ];
    }
  }

  const transport = new EpoxyTransport({
    wisp: "wss://YOUR-WISP-SERVER/"
  });

  await transport.init();

  // -----------------------------
  // Scramjet frame
  // -----------------------------

  const frame = scramjet.createFrame();

  const container = document.createElement('div');
  container.style.cssText = `
    position:fixed;inset:0;z-index:999;display:none;
  `;

  container.appendChild(frame.frame);
  document.body.appendChild(container);

  const input = document.getElementById('searchInput');
  const btn = document.getElementById('searchBtn');

  function go() {
    const v = input.value.trim();
    if (!v) return;

    container.style.display = 'block';

    frame.go(
      v.startsWith('http')
        ? v
        : 'https://www.google.com/search?q=' + encodeURIComponent(v)
    );
  }

  btn.onclick = go;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') go();
  });

})();
