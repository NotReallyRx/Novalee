(async () => {
  try {
    const res = await fetch('/r/r.yml');
    const text = await res.text();

    // parse YAML (requires js-yaml)
    const data = jsyaml.load(text);

    // expose globally for your page
    window.CREDITS = data.credits || [];
  } catch (err) {
    console.error('Failed to load credits:', err);
    window.CREDITS = [];
  }
})();
