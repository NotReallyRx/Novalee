const CDN_COVERS = 'https://cdn.jsdelivr.net/gh/freebuisness/covers@main';
const grid = document.getElementById('grid');
const SEARCH_THRESHOLD = 0.38;

/* =========================
   NAME → URL ID
========================= */
function slugify(name) {
  return encodeURIComponent(
    name
      .toLowerCase()
      .trim()
      .replace(/['":]/g, '')        // remove quotes/colons/apostrophes
      .replace(/[^a-z0-9\s-]/g, '') // remove other punctuation
      .replace(/\s+/g, '-')         // spaces → dash
      .replace(/-+/g, '-')          // collapse dashes
  );
}

/* =========================
   HELPERS
========================= */
function joinPath(dir, file) {
  if (!dir) return file;
  return dir.replace(/\/+$/, '') + '/' + file.replace(/^\/+/, '');
}

/* =========================
   SEARCH (unchanged)
========================= */
function levenshtein(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();

  const m = Array.from({ length: b.length + 1 }, () =>
    Array(a.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) m[0][i] = i;
  for (let j = 0; j <= b.length; j++) m[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      m[j][i] = Math.min(
        m[j][i - 1] + 1,
        m[j - 1][i] + 1,
        m[j - 1][i - 1] + cost
      );
    }
  }

  return m[b.length][a.length];
}

function scoreMatch(q, t) {
  q = q.toLowerCase().trim();
  t = t.toLowerCase();

  if (!q) return 1;

  const tokens = t.split(/\s+/);
  let best = 0;

  for (const token of tokens) {
    const dist = levenshtein(q, token);
    const max = Math.max(q.length, token.length);
    const score = 1 - dist / max;

    best = Math.max(
      best,
      score,
      token.includes(q) ? 0.9 : 0,
      token === q ? 1 : 0
    );
  }

  return best;
}

/* =========================
   LOAD YAML
========================= */
fetch('/g/g.yml')
  .then(r => r.text())
  .then(text => {
    const data = jsyaml.load(text);

    const providers = {};
    (data.providers || []).forEach(p => {
      providers[p.name] = p;
    });

    render(data.games || [], providers);
    setupSearch();
  });

/* =========================
   RENDER
========================= */
function render(games, providers) {

  games.forEach(game => {

    const provider = providers[game.provider] || {};
    const final = { ...provider, ...game };

    const id = final.key || slugify(final.name);
    const urlName = slugify(final.name);
    const isLocal = final.prefix === 'l';

    /* =========================
       /i/?g=NAME-SLUG
    ========================= */
    const href = `/i/?g=${urlName}`;

    /* =========================
       COVER
    ========================= */
    let icon;

    if (final.cover) {
      if (/^https?:\/\//i.test(final.cover)) {
        icon = final.cover;
      } else {
        const path = joinPath(final.cover_dir, final.cover);

        icon = isLocal
          ? `/${path}`
          : `https://cdn.jsdelivr.net/gh/${final.cover_repo}@${final.tag || 'main'}/${path}`;
      }

    } else if (isLocal) {
      const dir = final.cover_dir || 'c';
      icon = `/${dir}/${id}.png`;

    } else if (final.cover_repo) {
      const path = joinPath(
        final.cover_dir,
        id + '.' + (final.cover_ext || 'png')
      );

      icon =
        `https://cdn.jsdelivr.net/gh/${final.cover_repo}@${final.tag || 'main'}/${path}`;

    } else {
      icon = `${CDN_COVERS}/${id}.png`;
    }

    /* =========================
       CARD
    ========================= */
    const card = document.createElement('div');
    card.className = 'game-card';

    card.dataset.search = [
      final.name,
      ...(final.search || [])
    ].join(' ').toLowerCase();

    const a = document.createElement('a');
    a.href = href;

    const cover = document.createElement('div');
    cover.className = 'card-cover';

    const img = document.createElement('img');
    img.src = icon;
    img.alt = final.name;

    img.onerror = () => {
      img.remove();
      cover.classList.add('no-image');
    };

    cover.appendChild(img);
    a.appendChild(cover);

    const footer = document.createElement('div');
    footer.className = 'card-footer';
    footer.innerHTML = `<span>${final.name}</span>`;

    if (final.credit) {
      const c = document.createElement('a');
      c.href = `/r/?=${final.credit}`;
      c.textContent = final.credit;
      c.onclick = e => e.stopPropagation();
      footer.appendChild(c);
    }

    card.appendChild(a);
    card.appendChild(footer);
    grid.appendChild(card);
  });
}

/* =========================
   SEARCH
========================= */
function setupSearch() {
  const input = document.getElementById('search-bar');

  input.addEventListener('input', e => {
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
