const DEFAULT_CONF_URL = "/g/g.yml";

function getConfUrl() {
  const params = new URLSearchParams(window.location.search);

  return params.get("url") || DEFAULT_CONF_URL;
}

function isJsonPath(path) {
  return /\.json$/i.test(path);
}

async function fetchYaml(path) {
  const res = await fetch(path);

  if (!res.ok) {
    throw new Error(`Failed to load ${path}`);
  }

  const text = await res.text();

  if (!window.jsyaml) {
    throw new Error("js-yaml missing");
  }

  try {
    return jsyaml.load(text);
  } catch {
    throw new Error(`YAML parse error in ${path}`);
  }
}

async function fetchJson(path) {
  const res = await fetch(path);

  if (!res.ok) {
    throw new Error(`Failed to load ${path}`);
  }

  return res.json();
}

function parseCategoryList(value) {
  if (!value) return [];

  return String(value)
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

// Plugin-driven sources are raw external data, not Novalee's own config
// shape, and different sources wrap their game list differently — gn-math
// returns a bare array, truffled wraps it as `{ games: [...] }`. Try the
// common shapes so plugins don't each need their own unwrapping logic.
function extractRawList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.games)) return data.games;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.items)) return data.items;

  return null;
}

// `filter` is either null (no filtering — loads everything, used for "All")
// or an array of category ids. A game/import matches if ANY of its own
// (comma-separated) categories appears in `filter`.
function matchesFilter(categoryValue, filter) {
  if (!filter) return true;

  const cats = parseCategoryList(categoryValue);

  if (!cats.length) return false;

  return cats.some((c) => filter.includes(c));
}

let rootDataPromise = null;

// The root config is fetched once and reused both for reading the category
// registry and for resolving imports, so switching categories never
// re-fetches g.yml itself.
function getRootData() {
  if (!rootDataPromise) {
    const path = getConfUrl();

    rootDataPromise = isJsonPath(path) ? fetchJson(path) : fetchYaml(path);
  }

  return rootDataPromise;
}

// Reads the top-level `category:` registry from the root config, e.g.:
//   category:
//     - name: normal
//     - name: truffled
// This never resolves any imports, so the category picker can be populated
// immediately, before any actual game data is fetched.
async function loadCategoryRegistry() {
  const data = await getRootData();

  if (!data || Array.isArray(data)) return [];

  return (data.category || [])
    .map((c) => (typeof c === "string" ? c : c && c.name))
    .filter(Boolean);
}

// `meta.env`/`meta.plugin` are threaded through to plugin-backed games as
// before. `meta.category` is the category inherited from the enclosing
// import; an individual game or a nested import can override it with its
// own `category:` field (comma-separated for multiple).
//
// `filter` (see matchesFilter) prunes the whole tree as it's walked: an
// import whose category doesn't match is skipped entirely — nothing under
// it is fetched.
async function resolveConfig(path, visited, meta, filter, preloadedData) {
  if (visited.has(path)) {
    console.warn("Skipped circular import:", path);

    return { providers: [], games: [] };
  }

  visited.add(path);

  const data =
    preloadedData ||
    (isJsonPath(path) ? await fetchJson(path) : await fetchYaml(path));

  // Plugin-driven imports are always raw external data — not Novalee's own
  // config shape — whether the source wraps its games in an object (e.g.
  // truffled's `{ games: [...] }`) or returns a bare array (e.g. gn-math).
  // A plugin-less bare JSON array is also supported for backward
  // compatibility, though it won't have a transform to run against it.
  const rawList = meta.plugin
    ? extractRawList(data)
    : Array.isArray(data)
      ? data
      : null;

  if (rawList) {
    return {
      providers: [],
      games: rawList
        .map((g) => ({
          ...g,
          _format: "json",
          _env: meta.env || {},
          _plugin: meta.plugin || null,
          _category: g.category || meta.category || null,
        }))
        .filter((g) => matchesFilter(g._category, filter)),
    };
  }

  if (meta.plugin) {
    console.warn(
      `Could not find a games array in ${path} for plugin "${meta.plugin}"`,
    );

    return { providers: [], games: [] };
  }

  const merged = {
    providers: [...(data.providers || [])],
    games: (data.games || [])
      .map((g) => ({ ...g, _category: g.category || meta.category || null }))
      .filter((g) => matchesFilter(g._category, filter)),
  };

  const imports = data.import || [];

  for (const imp of imports) {
    try {
      const importCategory = imp.category || meta.category || null;

      if (!matchesFilter(importCategory, filter)) continue;

      const importPath = imp.file || imp.url;
      const childMeta = {
        env: imp.env,
        plugin: imp.plugin,
        category: importCategory,
      };

      if (importPath) {
        const child = await resolveConfig(
          importPath,
          visited,
          childMeta,
          filter,
        );

        merged.providers.push(...child.providers);
        merged.games.push(...child.games);
      } else if (imp.dir) {
        const dir = imp.dir.replace(/\/+$/, "");

        const child = await resolveConfig(
          `${dir}/g.yml`,
          visited,
          childMeta,
          filter,
        );

        merged.providers.push(...child.providers);
        merged.games.push(...child.games);
      } else if (imp.plugin) {
        // No url/file/dir to fetch — this source is entirely plugin-driven
        // (e.g. an SDK-backed source like LuminSDK). Record a stub that
        // g.js will expand by calling that plugin's own list() loader.
        merged.games.push({
          _format: "plugin-source",
          _plugin: imp.plugin,
          _env: imp.env || {},
          _category: importCategory,
        });
      }
    } catch (e) {
      console.warn("Import failed:", imp, e);
    }
  }

  return merged;
}

// `category` is a single category id to load, or null/"all" to load
// everything (no pruning).
async function loadGameData(category) {
  const path = getConfUrl();
  const rootData = await getRootData();
  const filter = category && category !== "all" ? [category] : null;

  return resolveConfig(path, new Set(), {}, filter, rootData);
}
