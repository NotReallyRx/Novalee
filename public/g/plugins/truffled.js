// Plugin for the truffled.lol JSON source (https://truffled.lol/js/json/g.json).
//
// Shape:
// {
//   "name": "1 on 1 Soccer",
//   "url": "/games/1on1soccer/index.html",
//   "thumbnail": "/png/games/12.webp",
//   "frameType": "iframe" | "unity"
// }
//
// url/thumbnail are root-relative (sometimes with a leading slash, sometimes
// without), so they're first resolved against ROOT_URL, then every file
// actually loaded from truffled.lol (the game itself and its thumbnail) is
// routed through the site's existing `/pr/?url=` proxy — the same one used
// for gn-math's manifest fetch in g.yml.
//
// env (from g.yml): { ROOT_URL }

(function () {
  function resolveUrl(root, path) {
    if (!path) return null;

    if (/^https?:\/\//i.test(path)) return path;

    const cleanRoot = (root || "").replace(/\/+$/, "");
    const cleanPath = String(path).replace(/^\/+/, "");

    return `${cleanRoot}/${cleanPath}`;
  }

  function proxyWrap(url) {
    if (!url) return null;

    return `/pr/?url=${encodeURIComponent(url)}`;
  }

  function transform(game, env) {
    const root = (env && env.ROOT_URL) || "";

    const absoluteUrl = resolveUrl(root, game.url);
    const absoluteCover = resolveUrl(root, game.thumbnail);

    return {
      name: game.name,
      url: proxyWrap(absoluteUrl),
      cover: proxyWrap(absoluteCover),
      frameType: game.frameType || null,
      searchExtra: [],
      featured: false,
    };
  }

  window.NovaleePlugins = window.NovaleePlugins || {};
  window.NovaleePlugins["truffled"] = transform;
})();
