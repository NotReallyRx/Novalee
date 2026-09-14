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
// url/thumbnail are root-relative to truffled.lol itself (sometimes with a
// leading slash, sometimes without) and always start with either "games/"
// or "png/". Rather than going through the generic `/pr/?url=` passthrough
// proxy, these are routed through the worker's dedicated truffled mounts:
//
//   worker mount "/tr"      -> https://truffled.lol/games/
//   worker mount "/tr/png"  -> https://truffled.lol/png/
//
// Since those mounts already imply the "games/" or "png/" prefix, that
// exact prefix is stripped from the JSON's path before prepending the
// matching mount — otherwise you'd end up with a doubled path like
// "/tr/games/1on1soccer/index.html" (which the worker would resolve to
// truffled.lol/games/games/1on1soccer/index.html).
//
// env (from g.yml): { ROOT_URL } — the games mount, e.g. "/tr/". The png
// mount is derived from it (ROOT_URL + "png/").

(function () {
  const GAMES_PREFIX = "games/";
  const PNG_PREFIX = "png/";

  function toWorkerPath(root, path) {
    if (!path) return null;

    // Already absolute (e.g. points somewhere other than truffled.lol) —
    // leave it alone rather than trying to route it through a mount.
    if (/^https?:\/\//i.test(path)) return path;

    const gamesMount = (root || "/tr/").replace(/\/+$/, "") + "/";
    const pngMount = gamesMount + "png/";

    const clean = String(path).replace(/^\/+/, "");

    if (clean.startsWith(GAMES_PREFIX)) {
      return gamesMount + clean.slice(GAMES_PREFIX.length);
    }

    if (clean.startsWith(PNG_PREFIX)) {
      return pngMount + clean.slice(PNG_PREFIX.length);
    }

    // Unknown prefix — best effort, mount it under the games root.
    return gamesMount + clean;
  }

  function transform(game, env) {
    const root = (env && env.ROOT_URL) || "/tr/";

    return {
      name: game.name,
      url: toWorkerPath(root, game.url),
      cover: toWorkerPath(root, game.thumbnail),
      frameType: game.frameType || null,
      searchExtra: [],
      featured: false,
    };
  }

  window.NovaleePlugins = window.NovaleePlugins || {};
  window.NovaleePlugins["truffled"] = transform;
})();
