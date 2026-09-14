(async function () {
  /**
   * Wait for the toolbar to be created by the main application.
   */
  async function waitForToolbar() {
    return new Promise((resolve) => {
      const existingToolbar = document.getElementById("toolbar");
      const existingLabel = document.getElementById("tb-label");

      if (existingToolbar && existingLabel) {
        resolve({
          toolbar: existingToolbar,
          label: existingLabel,
        });

        return;
      }

      const observer = new MutationObserver(() => {
        const toolbar = document.getElementById("toolbar");
        const label = document.getElementById("tb-label");

        if (toolbar && label) {
          observer.disconnect();

          resolve({
            toolbar,
            label,
          });
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    });
  }

  /**
   * Load and render toolbar pages.
   */
  async function loadPages() {
    try {
      // Wait until script.js has created the toolbar.
      const { toolbar, label } = await waitForToolbar();

      // Load the page configuration.
      const response = await fetch("/pa/pa.yml", {
        cache: "no-cache",
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load pa.yml: ${response.status}`
        );
      }

      const text = await response.text();
      const pages = parsePages(text);

      const currentUrl = new URL(window.location.href);

      /**
       * Determine whether a page is currently active.
       */
      function isActive(page) {
        if (!page.link) return false;

        try {
          const pageUrl = new URL(
            page.link,
            window.location.origin
          );

          // External links should never be marked active.
          if (pageUrl.origin !== currentUrl.origin) {
            return false;
          }

          // Homepage.
          if (pageUrl.pathname === "/") {
            return currentUrl.pathname === "/";
          }

          // Normalize section paths.
          const sectionPath =
            pageUrl.pathname.endsWith("/")
              ? pageUrl.pathname
              : pageUrl.pathname + "/";

          return (
            currentUrl.pathname === pageUrl.pathname ||
            currentUrl.pathname.startsWith(sectionPath)
          );
        } catch (error) {
          console.warn(
            "Invalid toolbar link:",
            page.link,
            error
          );

          return false;
        }
      }

      /**
       * Create a toolbar link.
       */
      function createLink(page) {
        const link = document.createElement("a");

        link.className =
          `tb-btn${isActive(page) ? " active" : ""}`;

        link.href = page.link || "#";
        link.textContent = page.name || "";

        return link;
      }

      // Remove previously inserted toolbar buttons.
      toolbar
        .querySelectorAll(".tb-btn")
        .forEach((button) => button.remove());

      // Add left-side links before the label.
      pages.left.forEach((page) => {
        toolbar.insertBefore(
          createLink(page),
          label
        );
      });

      // Add right-side links after the label.
      pages.right.forEach((page) => {
        toolbar.appendChild(
          createLink(page)
        );
      });

    } catch (error) {
      console.error(
        "Failed to load toolbar pages:",
        error
      );
    }
  }

  /**
   * Parse the simple YAML structure used by pa.yml.
   *
   * Expected format:
   *
   * left:
   *   - name: Home
   *     link: /
   *
   * right:
   *   - name: Settings
   *     link: /s/
   */
  function parsePages(text) {
    const pages = {
      left: [],
      right: [],
    };

    let section = null;
    let current = null;

    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();

      // Ignore empty lines and comments.
      if (
        !trimmed ||
        trimmed.startsWith("#")
      ) {
        continue;
      }

      // Detect sections.
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

      // Ignore anything outside a section.
      if (!section) {
        continue;
      }

      // Parse a new item.
      const item =
        trimmed.match(
          /^-\s+name:\s*(.*)$/
        );

      if (item) {
        current = {
          name: item[1].trim(),
          link: "",
        };

        pages[section].push(current);

        continue;
      }

      // Ignore properties without an item.
      if (!current) {
        continue;
      }

      // Parse the link.
      const link =
        trimmed.match(
          /^link:\s*(.*)$/
        );

      if (link) {
        current.link =
          link[1].trim();
      }
    }

    return pages;
  }

  /**
   * Start loading.
   *
   * loadPages() handles waiting for the toolbar,
   * so it is safe even if the toolbar is created
   * after DOMContentLoaded.
   */
  loadPages();

})();
