const CDN_COVERS = 'https://cdn.jsdelivr.net/gh/freebuisness/covers@main';
const grid = document.getElementById('grid');

/* =========================
   LEVENSHTEIN DISTANCE
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

/* =========================
   LEVENSHTEIN SCORE (0–1)
========================= */
function levenshteinScore(query, text) {
  query = query.toLowerCase().trim();
  text = text.toLowerCase().trim();

  if (!query) return 1;
  if (text === query) return 1;

  const dist = levenshtein(query, text);
  const maxLen = Math.max(query.length, text.length);

  return 1 - dist / maxLen;
}

/* =========================
   HYBRID SCORE ENGINE
========================= */
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
   LOAD GAME GRID
========================= */
fetch('/g/g.yml')
  .then(res => res.text())
  .then(text => {
    const yamlData = jsyaml.load(text);
    const games = yamlData.games;

    games.forEach(game => {

      const href = game.prefix === 'gh'
        ? `/i/?gh=${game.repo}`
          + `&f=${encodeURIComponent(game.file)}`
          + `&tag=${encodeURIComponent(game.tag || 'main')}`
          + `&cdn=${encodeURIComponent(game.cdn || 'jsdelivr')}`
        : `/i/?${game.prefix}=${game.key}`;

      const iconSrc = game.cover
        ? game.cover
        : (game.prefix === 'i' || game.prefix === 'gh')
          ? `${CDN_COVERS}/${game.key}.png`
          : `/icons/${game.key}.png`;

      const card = document.createElement('div');
      card.className = 'game-card';

      /* =========================
         SEARCH INDEX
      ========================= */
      card.dataset.search = [
        game.name,
        ...(Array.isArray(game.search) ? game.search : [])
      ]
        .join(' ')
        .toLowerCase();

      const coverLink = document.createElement('a');
      coverLink.href = href;

      const coverDiv = document.createElement('div');
      coverDiv.className = 'card-cover';

      const img = document.createElement('img');
      img.src = iconSrc;
      img.alt = game.name || '';

      img.onerror = () => {
        img.remove();
        coverDiv.classList.add('no-image');
      };

      coverDiv.appendChild(img);
      coverLink.appendChild(coverDiv);

      const footer = document.createElement('div');
      footer.className = 'card-footer';
      footer.innerHTML = `<span class="card-name">${game.name}</span>`;

      if (game.credit) {
        const credit = document.createElement('a');
        credit.className = 'card-credit';
        credit.textContent = game.credit;
        credit.href = `/r/?=${game.credit}`;
        credit.addEventListener('click', e => e.stopPropagation());
        footer.appendChild(credit);
      }

      card.appendChild(coverLink);
      card.appendChild(footer);
      grid.appendChild(card);
    });

    /* =========================
       FUZZY SEARCH ENGINE
    ========================= */
    const searchBar = document.getElementById('search-bar');

    searchBar.addEventListener('input', (e) => {
      const query = e.target.value;

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
        const visible = score > 0.3;

        card.style.display = visible ? '' : 'none';
        card.style.opacity = visible ? '1' : '0.25';

        grid.appendChild(card);
      });
    });

  });
