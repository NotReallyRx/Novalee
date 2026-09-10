const grid = document.getElementById("grid");
const SEARCH_THRESHOLD = 0.38;



function slugify(name) {
  return encodeURIComponent(
    name
      .toLowerCase()
      .trim()
      .replace(/['":]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-"),
  );
}

function joinPath(dir, file) {
  if (!dir) return file;

  return dir.replace(/\/+$/, "") + "/" + file.replace(/^\/+/, "");
}

function buildLaunchHref(targetUrl, name) {
  if (!targetUrl) return null;

  return `/i/?u=${encodeURIComponent(targetUrl)}&n=${encodeURIComponent(name || "")}`;
}

function resolveYamlTarget(provider, final) {
  const isLocal = final.prefix === "l";
  const dir = final.dir || "";
  const key = final.key;

  const providerKeyMode = provider.key || null;
  const keyType = final.key_type || providerKeyMode;

  let file;

  if (key && keyType) {
    if (keyType === "folder") {
      file = `${key}/index.html`;
    } else if (keyType === "file") {
      file = `${key}.html`;
    } else {
      console.warn("Invalid key type:", keyType, "for", final.name);
      return null;
    }
  } else {
    file = final.file || "index.html";
  }

  const fullPath = dir ? `${dir}/${file}` : file;

  if (isLocal) {
    return `/${fullPath}`;
  }

  const repo = final.repo;
  const tag = final.tag || "main";
  const cdn = final.cdn || "jsdelivr";

  if (!repo) {
    console.warn("Missing repo for", final.name);
    return null;
  }

  if (cdn === "githack") {
    return `https://rawcdn.githack.com/${repo}/${tag}/${fullPath}`;
  }

  if (cdn === "raw") {
    return `https://raw.githubusercontent.com/${repo}/refs/heads/${tag}/${fullPath}`;
  }

  return `https://cdn.jsdelivr.net/gh/${repo}@${tag}/${fullPath}`;
}

function normalizeYamlGame(game, providers) {
  const provider = providers[game.provider] || {};

  const final = {
    ...provider,
    ...game,
  };

  const id = final.key || slugify(final.name);
  const isLocal = final.prefix === "l";

  let icon;

  if (final.cover) {
    if (/^https?:\/\//i.test(final.cover)) {
      icon = final.cover;
    } else {
      const path = joinPath(final.cover_dir, final.cover);

      icon = isLocal
        ? `/${path}`
        : `https://cdn.jsdelivr.net/gh/${final.cover_repo}@${final.tag || "main"}/${path}`;
    }
  } else if (isLocal) {
    const dir = final.cover_dir || "c";

    icon = `/${dir}/${id}.png`;
  } else if (final.cover_repo) {
    const path = joinPath(
      final.cover_dir,
      id + "." + (final.cover_ext || "png"),
    );

    icon = `https://cdn.jsdelivr.net/gh/${final.cover_repo}@${final.tag || "main"}/${path}`;
  }

  const targetUrl = resolveYamlTarget(provider, final);

  return {
    id,
    name: final.name,
    href: buildLaunchHref(targetUrl, final.name),
    icon,
    credit: final.credit || null,
    creditHref: final.credit ? `/r/?=${final.credit}` : null,
    searchExtra: final.search || [],
    featured: !!final.featured,
  };
}

function expandPlaceholders(str, env) {
  if (typeof str !== "string" || !env) return str;

  let result = str;

  for (const [key, value] of Object.entries(env)) {
    result = result.replaceAll(`{${key}}`, value);
  }

  return result;
}

function normalizeJsonGame(game) {
  const id = game.id != null ? String(game.id) : slugify(game.name);
  const env = game._env || {};

  const targetUrl = expandPlaceholders(game.url, env);

  return {
    id,
    name: game.name,
    href: buildLaunchHref(targetUrl, game.name),
    icon: expandPlaceholders(game.cover, env),
    credit: game.author || null,
    creditHref: game.authorLink || null,
    searchExtra: game.special || [],
    featured: !!game.featured,
  };
}

function normalizeGame(game, providers) {
  if (game._format === "json") {
    return normalizeJsonGame(game);
  }

  return normalizeYamlGame(game, providers);
}




let luminInitPromise = null;

function ensureLuminInit() {
  if (!window.Lumin) {
    return Promise.reject(new Error("LuminSDK script failed to load"));
  }

  if (!luminInitPromise) {
    luminInitPromise = Lumin.init({ headless: true });
  }

  return luminInitPromise;
}

function normalizeLuminGame(game, imgUrl) {
  return {
    id: `lumin-${game.id}`,
    name: game.name,
    href: null,
    icon: imgUrl,
    credit: null,
    creditHref: null,
    searchExtra: game.category ? [game.category] : [],
    featured: false,
    isLumin: true,
    luminId: game.id,
  };
}

async function loadLuminGames() {
  await ensureLuminInit();

  const limit = 50;
  let page = 1;
  let pages = 1;
  const rawGames = [];

  do {
    const res = await Lumin.getGames({ page, limit });

    rawGames.push(...(res.games || []));
    pages = res.pages || 1;
    page++;
  } while (page <= pages);

  const images = await Promise.all(
    rawGames.map((g) => Lumin.getImageUrl(g.image_token).catch(() => null)),
  );

  return rawGames.map((g, i) => normalizeLuminGame(g, images[i]));
}

async function launchLuminGame(g) {
  const { url } = await Lumin.getGameUrl(g.luminId);
  const href = buildLaunchHref(url, g.name);

  if (href) {
    window.location.href = href;
  }
}

function render(games) {
  games.forEach((g) => {
    const card = document.createElement("div");

    card.className = "game-card" + (g.featured ? " featured" : "");
    card.dataset.search = [g.name, ...(g.searchExtra || [])]
      .join(" ")
      .toLowerCase();

    const a = document.createElement("a");

    if (g.href) {
      a.href = g.href;
    } else if (g.isLumin) {
      
      
      a.href = "#";
      a.addEventListener("click", (e) => {
        e.preventDefault();
        launchLuminGame(g).catch((err) =>
          console.error("Failed to launch Lumin game:", err),
        );
      });
    }

    const cover = document.createElement("div");

    cover.className = "card-cover";

    const img = document.createElement("img");

    img.src = g.icon;
    img.alt = g.name;

    img.onerror = () => {
      img.remove();
      cover.classList.add("no-image");
    };

    cover.appendChild(img);
    a.appendChild(cover);

    const footer = document.createElement("div");

    footer.className = "card-footer";
    footer.innerHTML = `<span>${g.name}</span>`;

    if (g.credit) {
      const c = document.createElement("a");

      c.href = g.creditHref || `/r/?=${g.credit}`;
      c.textContent = g.credit;
      c.onclick = (e) => e.stopPropagation();

      footer.appendChild(c);
    }

    card.appendChild(a);
    card.appendChild(footer);

    grid.appendChild(card);
  });
}

function showError() {
  grid.innerHTML = `
    <div class="error">
      Failed to load games
    </div>
  `;
}

function levenshtein(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();

  const m = Array.from({ length: b.length + 1 }, () =>
    Array(a.length + 1).fill(0),
  );

  for (let i = 0; i <= a.length; i++) {
    m[0][i] = i;
  }

  for (let j = 0; j <= b.length; j++) {
    m[j][0] = j;
  }

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      m[j][i] = Math.min(
        m[j][i - 1] + 1,
        m[j - 1][i] + 1,
        m[j - 1][i - 1] + cost,
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
      token === q ? 1 : 0,
    );
  }

  return best;
}

function setupSearch() {
  const input = document.getElementById("search-bar");

  input.addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();

    const cards = [...document.querySelectorAll(".game-card")];

    const ranked = cards.map((card) => ({
      card,
      score: scoreMatch(q, card.dataset.search || ""),
    }));

    ranked.sort((a, b) => b.score - a.score);

    ranked.forEach(({ card, score }) => {
      const show = score >= SEARCH_THRESHOLD;

      card.style.display = show ? "" : "none";
      card.style.opacity = show ? "1" : "0.25";

      grid.appendChild(card);
    });
  });
}

async function loadNormalGames() {
  const data = await loadGameData();

  const providers = {};

  (data.providers || []).forEach((p) => {
    providers[p.name] = p;
  });

  return (data.games || []).map((g) => normalizeGame(g, providers));
}

async function loadGamesForSource(source) {
  if (source === "lumin") {
    return loadLuminGames();
  }

  return loadNormalGames();
}

async function switchSource(source) {
  grid.innerHTML = "";

  const searchInput = document.getElementById("search-bar");

  if (searchInput) {
    searchInput.value = "";
  }

  try {
    const games = await loadGamesForSource(source);

    render(games);

    if (searchInput) {
      searchInput.placeholder = `Search ${games.length} games...`;
    }
  } catch (err) {
    console.error(err);
    showError();
  }
}

const SOURCE_STORAGE_KEY = "game-source";

function getStoredSource() {
  try {
    const stored = localStorage.getItem(SOURCE_STORAGE_KEY);

    return stored === "lumin" || stored === "normal" ? stored : null;
  } catch {
    return null;
  }
}

function storeSource(source) {
  try {
    localStorage.setItem(SOURCE_STORAGE_KEY, source);
  } catch {
    
  }
}

function setupSourceSelect() {
  const select = document.getElementById("source-select");

  if (!select) return;

  select.addEventListener("change", (e) => {
    storeSource(e.target.value);
    switchSource(e.target.value);
  });
}

async function init() {
  setupSearch();
  setupSourceSelect();

  const select = document.getElementById("source-select");
  const stored = getStoredSource();

  if (select && stored) {
    select.value = stored;
  }

  await switchSource(select ? select.value : "normal");
}

init();
