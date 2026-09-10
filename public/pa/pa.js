(async function () {
  async function loadPages() {
    try {
      const response = await fetch("/pa/pa.yml", {
        cache: "no-cache",
      });

      if (!response.ok) {
        throw new Error(`Failed to load pa.yml: ${response.status}`);
      }

      const text = await response.text();
      const pages = parsePages(text);

      const toolbar = document.getElementById("toolbar");
      const label = document.getElementById("tb-label");

      if (!toolbar || !label) return;

      const currentUrl = new URL(window.location.href);

      function isActive(page) {
        if (!page.link) return false;

        const pageUrl = new URL(page.link, window.location.origin);

        if (pageUrl.origin !== currentUrl.origin) {
          return (
            pageUrl.origin === currentUrl.origin &&
            pageUrl.pathname === currentUrl.pathname
          );
        }

        if (pageUrl.pathname === "/") {
          return currentUrl.pathname === "/";
        }

        const sectionPath = pageUrl.pathname.endsWith("/")
          ? pageUrl.pathname
          : pageUrl.pathname + "/";

        return (
          currentUrl.pathname === pageUrl.pathname ||
          currentUrl.pathname.startsWith(sectionPath)
        );
      }

      function createLink(page) {
        const link = document.createElement("a");

        link.className = `tb-btn${isActive(page) ? " active" : ""}`;
        link.href = page.link;
        link.textContent = page.name;

        return link;
      }

      pages.left.forEach((page) => {
        toolbar.insertBefore(createLink(page), label);
      });

      pages.right.forEach((page) => {
        toolbar.appendChild(createLink(page));
      });
    } catch (error) {
      console.error("Failed to load toolbar pages:", error);
    }
  }

  function parsePages(text) {
    const pages = {
      left: [],
      right: [],
    };

    let section = null;
    let current = null;

    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      if (trimmed === "left:") {
        section = "left";
        current = null;
        continue;
      }

      if (trimmed === "right:") {
        section = "right";
        current = null;
        continue;
      }

      if (!section) {
        continue;
      }

      const item = trimmed.match(/^-\s+name:\s*(.*)$/);

      if (item) {
        current = {
          name: item[1].trim(),
          link: "",
        };

        pages[section].push(current);
        continue;
      }

      if (!current) {
        continue;
      }

      const link = trimmed.match(/^link:\s*(.*)$/);

      if (link) {
        current.link = link[1].trim();
      }
    }

    return pages;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadPages);
  } else {
    loadPages();
  }
})();
