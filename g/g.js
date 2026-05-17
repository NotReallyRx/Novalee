const CDN_COVERS = 'https://cdn.jsdelivr.net/gh/freebuisness/covers@main';
const grid = document.getElementById('grid');
const SEARCH_THRESHOLD = 0.38;
const RENDER_BATCH = 48;

let ALL_GAMES = [];
let FILTERED_GAMES = [];
let PROVIDERS = {};

let renderedCount = 0;
function setupInfiniteScroll() {

  window.addEventListener('scroll', () => {

    const nearBottom =
      window.innerHeight +
      window.scrollY >=
      document.body.offsetHeight - 1200;

    if (
      nearBottom &&
      renderedCount < FILTERED_GAMES.length
    ) {
      renderNextBatch();
    }
  });
}
/* =========================
   NAME → URL ID
========================= */
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

/* =========================
   HELPERS
========================= */
function joinPath(dir, file) {
  if (!dir) return file;

  return (
    dir.replace(/\/+$/, '') +
    '/' +
    file.replace(/^\/+/, '')
  );
}

/* =========================
   YAML HELPERS
========================= */

async function loadYamlFile(path) {

  const res = await fetch(path);

  if (!res.ok) {
    throw new Error(`Failed to load ${path}`);
  }

  const text = await res.text();

  if (!window.jsyaml) {
    throw new Error('js-yaml missing');
  }

  try {

    return jsyaml.load(text);

  } catch {

    throw new Error(
      `YAML parse error in ${path}`
    );
  }
}

async function resolveImports(
  path,
  visited = new Set()
) {

  // prevent circular imports
  if (visited.has(path)) {

    console.warn(
      'Skipped circular import:',
      path
    );

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

      // import file
      if (imp.file) {

        const child =
          await resolveImports(
            imp.file,
            visited
          );

        merged.providers.push(
          ...child.providers
        );

        merged.games.push(
          ...child.games
        );
      }

      // import directory
      else if (imp.dir) {

        const dir =
          imp.dir.replace(/\/+$/, '');

        const child =
          await resolveImports(
            `${dir}/g.yml`,
            visited
          );

        merged.providers.push(
          ...child.providers
        );

        merged.games.push(
          ...child.games
        );
      }

    } catch (e) {

      console.warn(
        'Import failed:',
        imp,
        e
      );
    }
  }

  return merged;
}

/* =========================
   SEARCH
========================= */

function levenshtein(a, b) {

  a = a.toLowerCase();
  b = b.toLowerCase();

  const m = Array.from(
    { length: b.length + 1 },
    () => Array(a.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) {
    m[0][i] = i;
  }

  for (let j = 0; j <= b.length; j++) {
    m[j][0] = j;
  }

  for (let j = 1; j <= b.length; j++) {

    for (let i = 1; i <= a.length; i++) {

      const cost =
        a[i - 1] === b[j - 1]
          ? 0
          : 1;

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

    const dist =
      levenshtein(q, token);

    const max =
      Math.max(
        q.length,
        token.length
      );

    const score =
      1 - dist / max;

    best = Math.max(
      best,
      score,
      token.includes(q)
        ? 0.9
        : 0,
      token === q
        ? 1
        : 0
    );
  }

  return best;
}

/* =========================
   LOAD YAML
========================= */

resolveImports('/g/g.yml')
  .then(data => {

    PROVIDERS = {};

    (data.providers || []).forEach(p => {
      PROVIDERS[p.name] = p;
    });

    ALL_GAMES =
      data.games || [];

    FILTERED_GAMES =
      [...ALL_GAMES];

    renderNextBatch();

    setupSearch();
    setupInfiniteScroll();
  })

/* =========================
   RENDER
========================= */

function renderNextBatch() {

  const slice =
    FILTERED_GAMES.slice(
      renderedCount,
      renderedCount + RENDER_BATCH
    );

  slice.forEach(game => {

    const provider =
      PROVIDERS[game.provider] || {};

    const final = {
      ...provider,
      ...game
    };

    const id =
      final.key ||
      slugify(final.name);

    const urlName =
      slugify(final.name);

    const isLocal =
      final.prefix === 'l';

    /* =========================
       /i/?g=NAME-SLUG
    ========================= */

    const href =
      `/i/?g=${urlName}`;

    /* =========================
       COVER
    ========================= */

    let icon;

    if (final.cover) {

      if (/^https?:\/\//i.test(final.cover)) {

        icon = final.cover;

      } else {

        const path = joinPath(
          final.cover_dir,
          final.cover
        );

        icon = isLocal
          ? `/${path}`
          : `https://cdn.jsdelivr.net/gh/${final.cover_repo}@${final.tag || 'main'}/${path}`;
      }

    } else if (isLocal) {

      const dir =
        final.cover_dir || 'c';

      icon =
        `/${dir}/${id}.png`;

    } else if (final.cover_repo) {

      const path = joinPath(
        final.cover_dir,
        id +
        '.' +
        (final.cover_ext || 'png')
      );

      icon =
        `https://cdn.jsdelivr.net/gh/${final.cover_repo}@${final.tag || 'main'}/${path}`;

    } else {

      icon =
        `${CDN_COVERS}/${id}.png`;
    }

    /* =========================
       CARD
    ========================= */

    const card =
      document.createElement('div');

    card.className =
      'game-card';

    card.dataset.search = [
      final.name,
      ...(final.search || [])
    ]
      .join(' ')
      .toLowerCase();

    const a =
      document.createElement('a');

    a.href = href;

    const cover =
      document.createElement('div');

    cover.className =
      'card-cover';

    const img =
      document.createElement('img');

    img.src = icon;
    img.alt = final.name;

    img.onerror = () => {

      img.remove();

      cover.classList.add(
        'no-image'
      );
    };

    cover.appendChild(img);
    a.appendChild(cover);

    const footer =
      document.createElement('div');

    footer.className =
      'card-footer';

    footer.innerHTML =
      `<span>${final.name}</span>`;

    if (final.credit) {

      const c =
        document.createElement('a');

      c.href =
        `/r/?=${final.credit}`;

      c.textContent =
        final.credit;

      c.onclick = e =>
        e.stopPropagation();

      footer.appendChild(c);
    }

    card.appendChild(a);
    card.appendChild(footer);

    grid.appendChild(card);
     
  });
     renderedCount += slice.length;

}

/* =========================
   SEARCH
========================= */

function setupSearch() {

  const input =
    document.getElementById('search-bar');

  input.addEventListener('input', e => {

    const q =
      e.target.value.trim().toLowerCase();

    // rebuild filtered dataset from full game list
    FILTERED_GAMES = ALL_GAMES.filter(game => {

      const text = [
        game.name,
        ...(game.search || [])
      ].join(' ').toLowerCase();

      return scoreMatch(q, text) >= SEARCH_THRESHOLD;
    });

    // reset batching state
    renderedCount = 0;

    // clear UI
    grid.innerHTML = '';

    // render first batch of filtered results
    renderNextBatch();
  });
}
