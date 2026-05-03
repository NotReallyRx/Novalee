const CDN_COVERS = 'https://cdn.jsdelivr.net/gh/freebuisness/covers@main';
const grid = document.getElementById('grid');

fetch('/g/g.yml')
  .then(res => res.text())
  .then(text => {
    const yamlData = jsyaml.load(text);

    const games = yamlData.games;

   
    games.forEach(game => {
      const href = game.prefix === 'gh'
        ? `/i/?gh=${game.repo}&f=${encodeURIComponent(game.file)}&tag=${encodeURIComponent(game.tag || 'main')}`
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
      coverLink.innerHTML = `
        <div class="card-cover">
          <img src="${iconSrc}" alt="" onerror="this.parentElement.style.background='var(--dim)';this.remove();" />
        </div>
      `;

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
