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

function buildLaunchHref(targetUrl, name, frameType) {
  if (!targetUrl) return null;

  let href = `/i/?u=${encodeURIComponent(targetUrl)}&n=${encodeURIComponent(name || "")}`;

  if (frameType) {
    href += `&t=${encodeURIComponent(frameType)}`;
  }

  return href;
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
    category: game._category || null,
  };
}

// --- Plugin system for non-yaml game sources -------------------------------
//
// A source declared in g.yml (via `import[].plugin`) loads a small script at
// /g/plugins/<name>.js on demand, which registers itself on
// window.NovaleePlugins. A plugin module can be:
//
// 1. A bare transform function — for imports that have a `url` pointing at a
//    raw JSON array (e.g. gn-math, truffled). load.js fetches the array;
//    the plugin just maps one raw entry to normalized fields:
//
//      window.NovaleePlugins["<name>"] = function transform(rawGame, env) {
//        return {
//          id, name, url, cover, credit, creditHref,
//          searchExtra, featured, frameType,
//        };
//      };
//
// 2. An object, for sources with no `url`/`file`/`dir` in g.yml at all,
//    where the plugin owns fetching its own games (e.g. an SDK-backed
//    source like LuminSDK):
//
//      window.NovaleePlugins["<name>"] = {
//        list: async function (env) { return [rawGame, ...]; },
//        transform: function (rawGame, env) { return { id, name, ... }; },
//        // optional — called at click time when a static `url` isn't
//        // known up front (e.g. Lumin only hands out play urls on demand):
//        resolveHref: async function (rawGame, env) { return { url, frameType }; },
//      };
//
// `env` is whatever was set under that import's `env:` in g.yml (e.g.
// COVER_URL/HTML_URL for gn-math, ROOT_URL for truffled).

const PLUGIN_BASE = "/g/plugins/";
const pluginLoadPromises = {};

function pluginScriptUrl(name) {
  return /^https?:\/\//i.test(name) ? name : `${PLUGIN_BASE}${name}.js`;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");

    script.src = src;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error(`Failed to load plugin script: ${src}`));

    document.head.appendChild(script);
  });
}

function getPluginModule(name) {
  return window.NovaleePlugins && window.NovaleePlugins[name];
}

function getTransform(name) {
  const mod = getPluginModule(name);

  if (typeof mod === "function") return mod;
  if (mod && typeof mod.transform === "function") return mod.transform;

  return null;
}

function getLister(name) {
  const mod = getPluginModule(name);

  return mod && typeof mod.list === "function" ? mod.list : null;
}

function getHrefResolver(name) {
  const mod = getPluginModule(name);

  return mod && typeof mod.resolveHref === "function" ? mod.resolveHref : null;
}

async function ensurePlugin(name) {
  if (!name || getPluginModule(name)) return;

  if (!pluginLoadPromises[name]) {
    pluginLoadPromises[name] = loadScript(pluginScriptUrl(name)).catch((e) => {
      console.warn(`Plugin "${name}" failed to load:`, e);
    });
  }

  await pluginLoadPromises[name];
}

async function ensurePlugins(names) {
  await Promise.all([...new Set(names.filter(Boolean))].map(ensurePlugin));
}

function normalizePluginGame(game) {
  const pluginName = game._plugin;
  const transform = getTransform(pluginName);

  if (!transform) {
    console.warn(
      `No transform registered for plugin "${pluginName}", skipping`,
      game,
    );
    return null;
  }

  let result;

  try {
    result = transform(game, game._env || {});
  } catch (e) {
    console.warn(`Plugin "${pluginName}" threw on game`, game, e);
    return null;
  }

  if (!result || !result.name) return null;

  const id = result.id != null ? String(result.id) : slugify(result.name);
  const hasResolver = !!getHrefResolver(pluginName);

  return {
    id,
    name: result.name,
    href: result.url
      ? buildLaunchHref(result.url, result.name, result.frameType)
      : null,
    icon: result.cover,
    credit: result.credit || null,
    creditHref:
      result.creditHref || (result.credit ? `/r/?=${result.credit}` : null),
    searchExtra: result.searchExtra || [],
    featured: !!result.featured,
    category: game._category || null,
    // These games have no static href (the plugin only hands out a real
    // play url on demand). We keep enough info to resolve it at click time.
    needsAsyncLaunch: !result.url && hasResolver,
    _plugin: pluginName,
    _raw: game,
    _env: game._env || {},
  };
}

async function launchAsyncGame(g) {
  const resolver = getHrefResolver(g._plugin);

  if (!resolver) return;

  const resolved = await resolver(g._raw, g._env);
  const url =
    typeof resolved === "string" ? resolved : resolved && resolved.url;
  const frameType = resolved && resolved.frameType;
  const href = buildLaunchHref(url, g.name, frameType);

  if (href) {
    window.location.href = href;
  }
}

function normalizeGame(game, providers) {
  if (game._format === "json") {
    return normalizePluginGame(game);
  }

  return normalizeYamlGame(game, providers);
}

// Expands a "plugin-source" stub (an import in g.yml with a `plugin` but no
// `url`/`file`/`dir`) into raw games by calling that plugin's own list(),
// then tags each one so it flows through normalizePluginGame like any other
// plugin-backed game.
async function expandPluginSource(stub) {
  const lister = getLister(stub._plugin);

  if (!lister) {
    console.warn(`No list() found for plugin "${stub._plugin}"`);
    return [];
  }

  let rawGames;

  try {
    rawGames = await lister(stub._env || {});
  } catch (e) {
    console.warn(`Plugin "${stub._plugin}" list() failed:`, e);
    return [];
  }

  return (rawGames || []).map((g) => ({
    ...g,
    _format: "json",
    _plugin: stub._plugin,
    _env: stub._env || {},
    _category: stub._category,
  }));
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
    } else if (g.needsAsyncLaunch) {
      a.href = "#";
      a.addEventListener("click", (e) => {
        e.preventDefault();
        launchAsyncGame(g).catch((err) =>
          console.error("Failed to launch game:", err),
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

// --- Config / game loading, scoped per category so switching is cheap -----
//
// Only the selected category's imports are ever fetched (see load.js's
// `filter` pruning) — nothing else is downloaded until you pick it. Each
// category's normalized game list is cached after first load so switching
// back to it is instant.

const gamesCache = new Map();

async function loadNormalGames(category) {
  const data = await loadGameData(category);

  const providers = {};

  (data.providers || []).forEach((p) => {
    providers[p.name] = p;
  });

  const allGames = data.games || [];

  const staticGames = allGames.filter((g) => g._format !== "plugin-source");
  const pluginSources = allGames.filter((g) => g._format === "plugin-source");

  const pluginNames = [
    ...staticGames.filter((g) => g._format === "json").map((g) => g._plugin),
    ...pluginSources.map((g) => g._plugin),
  ];

  await ensurePlugins(pluginNames);

  const expandedSourceGroups = await Promise.all(
    pluginSources.map((stub) => expandPluginSource(stub)),
  );

  const allRawGames = [...staticGames, ...expandedSourceGroups.flat()];

  return allRawGames.map((g) => normalizeGame(g, providers)).filter(Boolean);
}

function getGamesForCategory(category) {
  const key = category || "all";

  if (!gamesCache.has(key)) {
    gamesCache.set(key, loadNormalGames(category));
  }

  return gamesCache.get(key);
}

const CATEGORY_LABELS = {
  luminsdk: "LuminSDK",
};

function categoryLabel(id) {
  if (CATEGORY_LABELS[id]) return CATEGORY_LABELS[id];

  return id
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Populated from g.yml's `category:` registry alone — no game data is
// fetched just to build this dropdown.
async function populateSourceSelect() {
  const select = document.getElementById("source-select");

  if (!select) return;

  const categories = await loadCategoryRegistry();

  select.innerHTML = "";

  categories.forEach((id) => {
    const opt = document.createElement("option");

    opt.value = id;
    opt.textContent = categoryLabel(id);
    select.appendChild(opt);
  });

  const allOption = document.createElement("option");

  allOption.value = "all";
  allOption.textContent = "All";
  select.appendChild(allOption);
}

function loadGamesForSource(source) {
  return getGamesForCategory(source);
}

function showLoading() {
  grid.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <span>Loading games…</span>
    </div>
  `;
}

async function switchSource(source) {
  showLoading();

  const searchInput = document.getElementById("search-bar");

  if (searchInput) {
    searchInput.value = "";
  }

  try {
    const games = await loadGamesForSource(source);

    grid.innerHTML = "";
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
    return localStorage.getItem(SOURCE_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function storeSource(source) {
  try {
    localStorage.setItem(SOURCE_STORAGE_KEY, source);
  } catch {}
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

  await populateSourceSelect();

  const select = document.getElementById("source-select");
  const options = select ? [...select.options].map((o) => o.value) : [];
  const stored = getStoredSource();

  // Default to the first category declared in g.yml rather than "All", so
  // the initial load only fetches one source instead of everything.
  let initial = "all";

  if (stored && options.includes(stored)) {
    initial = stored;
  } else if (options.length) {
    initial = options[0];
  }

  if (select) select.value = initial;

  await switchSource(initial);
}

init();
