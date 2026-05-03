const CDN_COVERS = 'https://cdn.jsdelivr.net/gh/freebuisness/covers@main';
const grid = document.getElementById('grid');

function scoreMatch(query, text) {
  query = query.toLowerCase().trim();
  text = text.toLowerCase();

  if (!query) return 1;

  // exact match
  if (text === query) return 1;

  // substring match (strong)
  if (text.includes(query)) return 0.8;

  // space-insensitive match (DDLC / d d l c)
  const A = text.replace(/\s+/g, '');
  const B = query.replace(/\s+/g, '');
  if (A === B) return 0.95;

  // fuzzy word match
  const qWords = query.split(/\s+/);
  const tWords = text.split(/\s+/);

  let matches = 0;
  for (const q of qWords) {
    if (tWords.some(t => t.includes(q))) {
      matches++;
    }
  }

  return matches / qWords.length * 0.7;
}

// LOAD YAML + BUILD GRID
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

      // ========================
      // SEARCH INDEX (IMPORTANT)
      // ========================
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

    // ========================
    // FUZZY SEARCH ENGINE
    // ========================
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
        const visible = score > 0.15;

        card.style.display = visible ? '' : 'none';
        card.style.opacity = visible ? '1' : '0.25';

        // Steam-like reorder
        grid.appendChild(card);
      });
    });

  });
