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

  // fallback: use file name if possible
  if (final.file) {
    return final.file
      .split('/')
      .pop()
      .replace(/\.[^/.]+$/, '')
      .toLowerCase();
  }

  // fallback: use name
  return final.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/* =========================
   LEVENSHTEIN
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

function levenshteinScore(query, text) {
  query = query.toLowerCase().trim();
  text = text.toLowerCase().trim();

  if (!query) return 1;
  if (text === query) return 1;

  const dist = levenshtein(query, text);
  const maxLen = Math.max(query.length, text.length);

  return 1 - dist / maxLen;
}

function scoreMatch(query, text) {
  query = query.toLowerCase().trim();
  text = text.toLowerCase();

  if (!query) return 1;

  const tokens = text.split(/\s+/);
  let bestScore = 0;

  for (const token of tokens) {
    const lev = levenshteinScore(query, token);
    const exact = token === query ? 1 : 0;
    const includes = token.includes(query) ? 0.9 : 0;

    const score = Math.max(lev, exact, includes);
    if (score > bestScore) bestScore = score;
  }

  return bestScore;
}

/* =========================
   LOAD YAML
========================= */
fetch('/g/g.yml')
  .then(res => res.text())
  .then(text => {
    const yamlData = jsyaml.load(text);

    const providers = {};
    (yamlData.providers || []).forEach(p => {
      providers[p.name] = p;
    });

    const games = yamlData.games || [];

    games.forEach(game => {

      /* =========================
         MERGE PROVIDER + GAME
      ========================= */
      const provider = providers[game.provider] || {};
      const final = { ...provider, ...game };

      const key = getKey(final);

      /* =========================
         BUILD HREF
      ========================= */
      const filePath = joinPath(final.dir, final.file);

      const href = final.prefix === 'gh'
        ? `/i/?gh=${final.repo}`
          + `&f=${encodeURIComponent(filePath)}`
          + `&tag=${encodeURIComponent(final.tag || 'main')}`
          + `&cdn=${encodeURIComponent(final.cdn || 'jsdelivr')}`
        : `/i/?${final.prefix}=${final.key}`;

      /* =========================
         COVER RESOLUTION
      ========================= */
      let iconSrc = null;

      if (final.cover) {

        // FULL URL
        if (/^https?:\/\//i.test(final.cover)) {
          iconSrc = final.cover;
        }

        // HAS EXTENSION (273.jpg)
        else if (/\.[a-z0-9]+$/i.test(final.cover)) {
          const coverPath = joinPath(final.cover_dir, final.cover);

          iconSrc = `https://cdn.jsdelivr.net/gh/${final.cover_repo}@${final.tag || 'main'}/${coverPath}`;
        }

        // NO EXTENSION (273)
        else {
          const coverPath = joinPath(
            final.cover_dir,
            final.cover + '.' + (final.cover_ext || 'png')
          );

          iconSrc = `https://cdn.jsdelivr.net/gh/${final.cover_repo}@${final.tag || 'main'}/${coverPath}`;
        }

      } else {

        // AUTO FALLBACK
        if (final.cover_repo) {
          const coverPath = joinPath(
            final.cover_dir,
            key + '.' + (final.cover_ext || 'png')
          );

          iconSrc = `https://cdn.jsdelivr.net/gh/${final.cover_repo}@${final.tag || 'main'}/${coverPath}`;
        }
        else if (final.prefix === 'gh') {
          iconSrc = `${CDN_COVERS}/${key}.png`;
        }
        else {
          iconSrc = `/icons/${key}.png`;
        }
      }

      /* =========================
         CREATE CARD
      ========================= */
      const card = document.createElement('div');
      card.className = 'game-card';

      card.dataset.search = [
        final.name,
        ...(Array.isArray(final.search) ? final.search : [])
      ]
        .join(' ')
        .toLowerCase();

      const coverLink = document.createElement('a');
      coverLink.href = href;

      const coverDiv = document.createElement('div');
      coverDiv.className = 'card-cover';

      const img = document.createElement('img');
      img.src = iconSrc;
      img.alt = final.name || '';

      img.onerror = () => {
        img.remove();
        coverDiv.classList.add('no-image');
      };

      coverDiv.appendChild(img);
      coverLink.appendChild(coverDiv);

      const footer = document.createElement('div');
      footer.className = 'card-footer';
      footer.innerHTML = `<span class="card-name">${final.name}</span>`;

      if (final.credit) {
        const credit = document.createElement('a');
        credit.className = 'card-credit';
        credit.textContent = final.credit;
        credit.href = `/r/?=${final.credit}`;
        credit.addEventListener('click', e => e.stopPropagation());
        footer.appendChild(credit);
      }

      card.appendChild(coverLink);
      card.appendChild(footer);
      grid.appendChild(card);
    });

    /* =========================
       SEARCH
    ========================= */
    const searchBar = document.getElementById('search-bar');

    searchBar.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();

      const cards = Array.from(document.querySelectorAll('.game-card'));

      const ranked = cards.map(card => {
        const data = card.dataset.search || '';
        return {
          card,
          score: scoreMatch(query, data)
        };
      });

      ranked.sort((a, b) => b.score - a.score);

      ranked.forEach(({ card, score }) => {
        const visible = score >= SEARCH_THRESHOLD;

        card.style.display = visible ? '' : 'none';
        card.style.opacity = visible ? '1' : '0.25';

        grid.appendChild(card);
      });
    });

  });
