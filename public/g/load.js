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

async function resolveConfig(path, visited = new Set(), env = null) {
  if (visited.has(path)) {
    console.warn("Skipped circular import:", path);

    return { providers: [], games: [] };
  }

  visited.add(path);

  const data = isJsonPath(path) ? await fetchJson(path) : await fetchYaml(path);

  if (Array.isArray(data)) {
    return {
      providers: [],
      games: data.map((g) => ({ ...g, _format: "json", _env: env || {} })),
    };
  }

  const merged = {
    providers: [...(data.providers || [])],
    games: [...(data.games || [])],
  };

  const imports = data.import || [];

  for (const imp of imports) {
    try {
      const importPath = imp.file || imp.url;

      if (importPath) {
        const child = await resolveConfig(importPath, visited, imp.env);

        merged.providers.push(...child.providers);
        merged.games.push(...child.games);
      } else if (imp.dir) {
        const dir = imp.dir.replace(/\/+$/, "");

        const child = await resolveConfig(`${dir}/g.yml`, visited);

        merged.providers.push(...child.providers);
        merged.games.push(...child.games);
      }
    } catch (e) {
      console.warn("Import failed:", imp, e);
    }
  }

  return merged;
}

async function loadGameData() {
  return resolveConfig(getConfUrl());
}
