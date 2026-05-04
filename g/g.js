const CDN_COVERS = 'https://cdn.jsdelivr.net/gh/freebuisness/covers@main';
const grid = document.getElementById('grid');
const SEARCH_THRESHOLD = 0.38;

/* =========================
   HELPERS
========================= */
function joinPath(dir, file) {
  if (!dir) return file;
  return dir.replace(/\/+$/, '') + '/' + file.replace(/^\/+/, '');
}

function getKey(final) {
  if (final.key) return final.key;

  if (final.file) {
    return final.file
      .split('/')
      .pop()
      .replace(/\.[^/.]+$/, '')
      .toLowerCase();
  }

  return final.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/* =========================
   SEARCH
========================= */
function levenshtein(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();

  const matrix = Array.from({ length: b.length + 1 }, () =>
    Array(a.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }

  return matrix[b.length][a.length];
}

function scoreMatch(query, text) {
  query = query.toLowerCase().trim();
  text = text.toLowerCase();

  if (!query) return 1;

  const tokens = text.split(/\s+/);
  let best = 0;

  for (const t of tokens) {
    const dist = levenshtein(query, t);
    const max = Math.max(query.length, t.length);
    const score = 1 - dist / max;

    const finalScore = Math.max(
      score,
      t.includes(query) ? 0.9 : 0,
      t === query ? 1 : 0
    );

    best = Math.max(best, finalScore);
  }

  return best;
}

/* =========================
   LOAD YAML
========================= */
fetch('/g/g.yml')
  .then(res => res.text())
  .then(text => {
    const data = jsyaml.load(text);

    const providers = {};
    (data.providers || []).forEach(p => {
      providers[p.name] = p;
    });

    const games = data.games || [];

    renderGames(games, providers);
    setupSearch();
  });

/* =========================
   RENDER GAMES
========================= */
function renderGames(games, providers) {

  games.forEach(game => {

    const provider = providers[game.provider] || {};
    const final = { ...provider, ...game };

    const key = getKey(final);
    const isLocal = final.prefix === 'l';

    /* =========================
       IMPORTANT:
       ALL GAMES USE /i/?g=
    ========================= */
    const href = `/i/?g=${key}`;

    /* =========================
       RESOLVE COVER
    ========================= */
    let iconSrc;

    if (final.cover) {

      if (/^https?:\/\//i.test(final.cover)) {
        iconSrc = final.cover;
      } else {
        const coverPath = joinPath(final.cover_dir, final.cover);

        iconSrc = isLocal
          ? `/${coverPath}`
          : `https://cdn.jsdelivr.net/gh/${final.cover_repo}@${final.tag || 'main'}/${coverPath}`;
      }

    } else if (isLocal) {
      const dir = final.cover_dir || 'c';
      const ext = final.cover_ext || 'png';
      iconSrc = `/${dir}/${key}.${ext}`;

    } else if (final.cover_repo) {
      const coverPath = joinPath(
        final.cover_dir,
        key + '.' + (final.cover_ext || 'png')
      );

      iconSrc =
        `https://cdn.jsdelivr.net/gh/${final.cover_repo}@${final.tag || 'main'}/${coverPath}`;

    } else {
      iconSrc = `${CDN_COVERS}/${key}.png`;
    }

    /* =========================
       CARD
    ========================= */
    const card = document.createElement('div');
    card.className = 'game-card';

    card.dataset.search = [
      final.name,
      ...(Array.isArray(final.search) ? final.search : [])
    ].join(' ').toLowerCase();

    const link = document.createElement('a');
    link.href = href;

    const cover = document.createElement('div');
    cover.className = 'card-cover';

    const img = document.createElement('img');
    img.src = iconSrc;
    img.alt = final.name;

    img.onerror = () => {
      img.remove();
      cover.classList.add('no-image');
    };

    cover.appendChild(img);
    link.appendChild(cover);

    const footer = document.createElement('div');
    footer.className = 'card-footer';
    footer.innerHTML = `<span class="card-name">${final.name}</span>`;

    if (final.credit) {
      const credit = document.createElement('a');
      credit.className = 'card-credit';
      credit.textContent = final.credit;
      credit.href = `/r/?=${final.credit}`;
      credit.onclick = e => e.stopPropagation();
      footer.appendChild(credit);
    }

    card.appendChild(link);
    card.appendChild(footer);

    grid.appendChild(card);
  });
}

/* =========================
   SEARCH
========================= */
function setupSearch() {
  const searchBar = document.getElementById('search-bar');

  searchBar.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();

    const cards = [...document.querySelectorAll('.game-card')];

    const ranked = cards.map(card => ({
      card,
      score: scoreMatch(q, card.dataset.search || '')
    }));

    ranked.sort((a, b) => b.score - a.score);

    ranked.forEach(({ card, score }) => {
      const show = score >= SEARCH_THRESHOLD;

      card.style.display = show ? '' : 'none';
      card.style.opacity = show ? '1' : '0.25';

      grid.appendChild(card);
    });
  });
}
