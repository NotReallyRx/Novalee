const iframe = document.getElementById('game-iframe');
const loadBar = document.getElementById('load-bar');
const label = document.getElementById('tb-label');

const PROXY = `${window.location.origin}/proxy/?url=`;

const tab = JSON.parse(localStorage.getItem('tab') || '{}');
const hasCloak = !!(tab.title || tab.icon);


function slugify(name) {
  return encodeURIComponent(
    name
      .toLowerCase()
      .trim()
      .replace(/['":]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
  );
}


const params = new URLSearchParams(location.search);
let gameId = params.get('g');

if (gameId) {
  gameId = decodeURIComponent(gameId);

  localStorage.setItem('lastGame', gameId);

} else {
  gameId = localStorage.getItem('lastGame') || '';
}

if (!gameId) fail("Missing ?g= and no saved game");


function fail(msg) {
  console.error(msg);
  document.body.innerHTML = `<h2>Game Loader Error</h2><p>${msg}</p>`;
}


async function loadYamlFile(path) {
  const res = await fetch(path);

  if (!res.ok) {
    throw new Error(`Failed to load ${path}`);
  }

  const text = await res.text();

  if (!window.jsyaml) {
    throw new Error("js-yaml missing");
  }

  try {
    return jsyaml.load(text);
  } catch {
    throw new Error(`YAML parse error in ${path}`);
  }
}

async function resolveImports(path, visited = new Set()) {

  if (visited.has(path)) {
    console.warn('Skipped circular import:', path);
    return {
      providers: [],
      games: []
    };
  }

  visited.add(path);

  const data = await loadYamlFile(path);

  const merged = {
    providers: [...(data.providers || [])],
    games: [...(data.games || [])]
  };

  const imports = data.import || [];

  for (const imp of imports) {

    try {

      if (imp.file) {

        const child = await resolveImports(
          imp.file,
          visited
        );

        merged.providers.push(...child.providers);
        merged.games.push(...child.games);
      }

      else if (imp.dir) {

        let dir = imp.dir.replace(/\/+$/, '');

        const child = await resolveImports(
          `${dir}/g.yml`,
          visited
        );

        merged.providers.push(...child.providers);
        merged.games.push(...child.games);
      }

    } catch (e) {
      console.warn('Import failed:', imp, e);
    }
  }

  return merged;
}



resolveImports('/g/g.yml')
  .then(data => {

    const providers = {};

    (data.providers || []).forEach(p => {
      providers[p.name] = p;
    });

    const games = data.games || [];

    const game = games.find(g =>
      slugify(g.name) === gameId
    );

    if (!game) {
      return fail("Game not found: " + gameId);
    }

    const provider = providers[game.provider] || {};
    const final = { ...provider, ...game };

    const isLocal = final.prefix === 'l';

   

    const dir = final.dir || '';
    const key = final.key;

    const providerKeyMode = provider.key || null;
    const keyType = final.key_type || providerKeyMode;

    let file;

    if (key && keyType) {

      if (keyType === 'folder') {

        file = `${key}/index.html`;

      } else if (keyType === 'file') {

        file = `${key}.html`;

      } else {

        return fail("Invalid key type: " + keyType);
      }

    } else {

      file = final.file || 'index.html';
    }

    const fullPath = dir
      ? `${dir}/${file}`
      : file;



    let url;

    if (isLocal) {

      url = `/${fullPath}`;

    } else {

      const repo = final.repo;
      const tag  = final.tag || 'main';
      const cdn  = final.cdn || 'jsdelivr';

      if (!repo) {
        return fail("Missing repo");
      }

      if (cdn === 'githack') {

        url =
          `https://rawcdn.githack.com/${repo}/${tag}/${fullPath}`;

      } else if (cdn === 'raw') {

        url =
          `https://raw.githubusercontent.com/${repo}/refs/heads/${tag}/${fullPath}`;

      } else {

        url =
          `https://cdn.jsdelivr.net/gh/${repo}@${tag}/${fullPath}`;
      }

      url = PROXY + encodeURIComponent(url);
    }


    sessionStorage.setItem('last', JSON.stringify({
      src: url,
      name: final.name
    }));

    history.replaceState(
      null,
      '',
      location.pathname
    );

    if (label) {
      label.textContent = final.name;
    }

    loadGame(url);
  })
  .catch(e => fail(e.message));


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



async function applyMeta(url) {

  try {

    const res = await fetch(url);
    const html = await res.text();


    const titleMatch =
      html.match(/<title>(.*?)<\/title>/i);

    if (titleMatch && !hasCloak) {
      document.title = titleMatch[1];
    }


    const iconMatch =
      html.match(
        /<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["']/i
      ) ||
      html.match(
        /<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i
      );

    if (iconMatch && !hasCloak) {

      const baseMatch =
        html.match(
          /<base[^>]*href=["']([^"']+)["']/i
        );

      const base =
        baseMatch
          ? baseMatch[1]
          : url;

      const iconUrl =
        new URL(iconMatch[1], base).href;

      let link =
        document.querySelector(
          "link[rel='icon']"
        );

      if (!link) {

        link = document.createElement("link");
        link.rel = "icon";

        document.head.appendChild(link);
      }

      link.href = iconUrl;
    }

  } catch (e) {

    console.warn(
      'Meta extraction failed:',
      e
    );
  }
}



function startLoad() {

  if (!loadBar) return;

  loadBar.style.transform = 'scaleX(.5)';
}

function finishLoad() {

  if (!loadBar) return;

  loadBar.style.transform = 'scaleX(1)';
}


function getFrame() {
  return document.getElementById('game-iframe');
}


function reloadFrame() {

  const iframe = getFrame();

  if (!iframe) return;

  iframe.src = iframe.src;
}


function toggleFullscreen() {

  const iframe = getFrame();

  if (!iframe) return;

  if (!document.fullscreenElement) {

    iframe.requestFullscreen()
      .catch(err => {
        console.warn(
          'Fullscreen failed:',
          err
        );
      });

  } else {

    document.exitFullscreen();
  }
}


function popOut() {

  const iframe = getFrame();

  if (!iframe || !iframe.src) return;

  window.open(
    iframe.src,
    '_blank'
  );
}
