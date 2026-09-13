const iframe = document.getElementById("game-iframe");
const loadBar = document.getElementById("load-bar");
const label = document.getElementById("tb-label");

const PROXY = `${window.location.origin}/pr/?url=`;
const LATEST_GAMES_KEY = "latestGames";
const MAX_LATEST_GAMES = 1;

const tab = JSON.parse(localStorage.getItem("tab") || "{}");
const hasCloak = !!(tab.title || tab.icon);

function fail(msg) {
  console.error(msg);
  document.body.innerHTML = `<h2>Game Loader Error</h2><p>${msg}</p>`;
}

function getLatestGames() {
  try {
    return JSON.parse(localStorage.getItem(LATEST_GAMES_KEY) || "[]");
  } catch {
    return [];
  }
}

function addLatestGame(entry) {
  const list = getLatestGames();

  list.push(entry);

  while (list.length > MAX_LATEST_GAMES) {
    list.shift();
  }

  localStorage.setItem(LATEST_GAMES_KEY, JSON.stringify(list));
}

const params = new URLSearchParams(location.search);

const rawUrl = params.get("u");

let targetUrl = "";
let targetName = "";

if (rawUrl) {
  targetUrl = rawUrl;
  targetName = params.get("n") || "";

  addLatestGame({ url: targetUrl, name: targetName, ts: Date.now() });

  history.replaceState(null, "", location.pathname);
} else {
  const list = getLatestGames();
  const last = list[list.length - 1];

  if (last) {
    targetUrl = last.url;
    targetName = last.name;
  }
}

if (!targetUrl) {
  fail("No game loaded");
} else {
  if (label) {
    label.textContent = targetName;
  }

  loadGame(resolveSrc(targetUrl));
}

function resolveSrc(url) {
  return /^https?:\/\//i.test(url) ? PROXY + encodeURIComponent(url) : url;
}

function loadGame(src) {
  sessionStorage.setItem("last", JSON.stringify({ src, name: targetName }));

  startLoad();

  iframe.removeAttribute("srcdoc");
  iframe.src = src;

  iframe.addEventListener(
    "load",
    () => {
      finishLoad();

      if (!hasCloak) {
        applyMeta(src);
      }
    },
    { once: true },
  );
}

async function applyMeta(url) {
  try {
    const res = await fetch(url);
    const html = await res.text();

    const titleMatch = html.match(/<title>(.*?)<\/title>/i);

    if (titleMatch && !hasCloak) {
      document.title = titleMatch[1];
    }

    const iconMatch =
      html.match(/<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["']/i) ||
      html.match(
        /<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i,
      );

    if (iconMatch && !hasCloak) {
      const baseMatch = html.match(/<base[^>]*href=["']([^"']+)["']/i);

      const base = baseMatch ? baseMatch[1] : url;

      const iconUrl = new URL(iconMatch[1], base).href;

      let link = document.querySelector("link[rel='icon']");

      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";

        document.head.appendChild(link);
      }

      link.href = iconUrl;
    }
  } catch (e) {
    console.warn("Meta extraction failed:", e);
  }
}

function startLoad() {
  if (!loadBar) return;

  loadBar.style.transform = "scaleX(.5)";
}

function finishLoad() {
  if (!loadBar) return;

  loadBar.style.transform = "scaleX(1)";
}

function getFrame() {
  return document.getElementById("game-iframe");
}

function reloadFrame() {
  const iframe = getFrame();

  if (!iframe) return;

  iframe.src = iframe.src;
}

function toggleFullscreen() {
  const iframe = getFrame();

  if (!iframe) return;

  if (!document.fullscreenElement) {
    iframe.requestFullscreen().catch((err) => {
      console.warn("Fullscreen failed:", err);
    });
  } else {
    document.exitFullscreen();
  }
}

function popOut() {
  const iframe = getFrame();

  if (!iframe || !iframe.src) return;

  window.open(iframe.src, "_blank");
}
