(async () => {
  const container = document.getElementById("content");

  try {
    const res = await fetch("/r/r.yml");
    const text = await res.text();
    const data = jsyaml.load(text);

    const CREDITS = data.credits || [];

    const params = new URLSearchParams(window.location.search);
    const who = params.get("") || [...params.values()][0] || null;

    if (who) {
      const match = CREDITS.find(
        (c) => c.name.toLowerCase() === who.toLowerCase(),
      );

      if (match) {
        container.innerHTML = `
          <div id="credit-name">${match.name}</div>
          <a id="credit-link" href="${match.link}" target="_blank" rel="noopener">
            ${match.link.replace("https://", "")}
          </a>
          <a class="tb-btn active" id="visit-btn" href="${match.link}" target="_blank" rel="noopener">
            Visit
          </a>
        `;
      } else {
        container.innerHTML = `<div id="not-found">${who} not found</div>`;
      }
    } else {
      container.innerHTML = `<div id="not-found">No credit specified</div>`;
    }
  } catch (err) {
    console.error("Failed to load credits:", err);
    container.innerHTML = `<div id="not-found">Error loading credits</div>`;
  }
})();
