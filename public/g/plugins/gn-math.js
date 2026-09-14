// Plugin for the gn-math JSON source (freebuisness/assets zones.json).
//
// Shape:
// {
//   "id": 0,
//   "name": "Bowmasters",
//   "cover": "{COVER_URL}/0.png",
//   "url": "{HTML_URL}/0.html",
//   "author": "Azur Games, Playgendary",
//   "authorLink": "https://azurgames.com"
// }
//
// env (from g.yml): { COVER_URL, HTML_URL }

(function () {
  function expandPlaceholders(str, env) {
    if (typeof str !== "string" || !env) return str;

    let result = str;

    for (const [key, value] of Object.entries(env)) {
      result = result.replaceAll(`{${key}}`, value);
    }

    return result;
  }

  function transform(game, env) {
    return {
      id: game.id != null ? String(game.id) : undefined,
      name: game.name,
      url: expandPlaceholders(game.url, env),
      cover: expandPlaceholders(game.cover, env),
      credit: game.author || null,
      creditHref: game.authorLink || null,
      searchExtra: game.special || [],
      featured: !!game.featured,
    };
  }

  window.NovaleePlugins = window.NovaleePlugins || {};
  window.NovaleePlugins["gn-math"] = transform;
})();
