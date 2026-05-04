const iframe = document.getElementById('game-iframe');
const loadBar = document.getElementById('load-bar');
const label = document.getElementById('tb-label');

const PROXY = 'https://novalee.rxk.workers.dev/?url=';

/* =========================
   CLOAK
========================= */
const tab = JSON.parse(localStorage.getItem('tab') || '{}');
const hasCloak = !!(tab.title || tab.icon);

/* =========================
   SLUGIFY (MATCH g.js)
========================= */
function slugify(name) {
  return encodeURIComponent(
    name.trim().toLowerCase().replace(/\s+/g, '-')
  );
}

const gameId = decodeURIComponent(new URLSearchParams(location.search).get('g') || '');

if (!gameId) fail("Missing ?g=");

/* =========================
   FAIL UI
========================= */
function fail(msg) {
  console.error(msg);
  document.body.innerHTML = `<h2>Game Loader Error</h2><p>${msg}</p>`;
}

/* =========================
   LOAD YAML
========================= */
fetch('/g/g.yml')
  .then(r => r.text())
  .then(text => {

    if (!window.jsyaml) return fail("js-yaml missing");

    let data;
    try {
      data = jsyaml.load(text);
    } catch (e) {
      return fail("YAML error");
    }

    const games = data.games || [];

    const game = games.find(g =>
      slugify(g.name) === gameId
    );

    if (!game) return fail("Game not found: " + gameId);

    const providers = {};
    (data.providers || []).forEach(p => {
      providers[p.name] = p;
    });

    const final = { ...providers[game.provider] || {}, ...game };

    const id = slugify(final.name);
    const isLocal = final.prefix === 'l';

    let url;

    if (isLocal) {
      const dir = final.dir || 'g';
      url = `/${dir}/${id}/index.html`;
    } else {
      const repo = final.repo || game.repo;
      const tag = final.tag || 'main';
      const file = final.file || 'index.html';
      const cdn = final.cdn || 'jsdelivr';

      if (cdn === 'githack') {
        url = `https://rawcdn.githack.com/${repo}/${tag}/${file}`;
      } else if (cdn === 'raw') {
        url = `https://raw.githubusercontent.com/${repo}/refs/heads/${tag}/${file}`;
      } else {
        url = `https://cdn.jsdelivr.net/gh/${repo}@${tag}/${file}`;
      }

      url = PROXY + encodeURIComponent(url);
    }

    iframe.src = url;

    if (label) label.textContent = final.name;
  })
  .catch(e => fail(e.message));
