const CDN_COVERS = 'https://cdn.jsdelivr.net/gh/freebuisness/covers@main';
const grid = document.getElementById('grid');

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
  });
const searchBar = document.getElementById('search-bar');

searchBar.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();

  document.querySelectorAll('.game-card').forEach(card => {
    const data = card.dataset.search || '';

    const matches = data.includes(query);

    card.style.display = matches ? '' : 'none';
  });
});
