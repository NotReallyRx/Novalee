(async function () {
    const PAGES_URL = '/pa/pages.yml';

    async function loadPages() {
        try {
            const response = await fetch(PAGES_URL, {
                cache: 'no-cache'
            });

            if (!response.ok) {
                throw new Error(`Failed to load ${PAGES_URL}: ${response.status}`);
            }

            const text = await response.text();
            const pages = parseYAML(text);

            renderActions(pages);
            renderToolbar(pages);
        } catch (error) {
            console.error('Failed to load pages:', error);
        }
    }

    function parseYAML(text) {
        const pages = {
            left: [],
            right: []
        };

        let section = null;
        let current = null;

        for (const rawLine of text.split(/\r?\n/)) {
            const line = rawLine.trim();

            if (!line || line.startsWith('#')) continue;

            if (line === 'left:') {
                section = 'left';
                current = null;
                continue;
            }

            if (line === 'right:') {
                section = 'right';
                current = null;
                continue;
            }

            if (!section) continue;

            const itemMatch = line.match(/^-\s+name:\s*(.*)$/);

            if (itemMatch) {
                current = {
                    name: itemMatch[1].trim(),
                    link: '',
                    type: 'action'
                };

                pages[section].push(current);
                continue;
            }

            if (!current) continue;

            const nameMatch = line.match(/^name:\s*(.*)$/);
            const linkMatch = line.match(/^link:\s*(.*)$/);
            const typeMatch = line.match(/^type:\s*(.*)$/);

            if (nameMatch) {
                current.name = nameMatch[1].trim();
            }

            if (linkMatch) {
                current.link = linkMatch[1].trim();
            }

            if (typeMatch) {
                current.type = typeMatch[1].trim();
            }
        }

        return pages;
    }

    function createLink(page, className) {
        const link = document.createElement('a');

        link.className = className;
        link.href = page.link;
        link.textContent = page.name;

        return link;
    }

    function renderActions(pages) {
        const container = document.getElementById('actions');

        if (!container) return;

        container.innerHTML = '';

        [...pages.left, ...pages.right].forEach(page => {
            const className = page.type === 'ghost'
                ? 'action-btn ghost'
                : 'action-btn';

            container.appendChild(createLink(page, className));
        });
    }

    function renderToolbar(pages) {
        const toolbar = document.getElementById('toolbar');

        if (!toolbar) return;

        const label = document.getElementById('tb-label');

        toolbar.querySelectorAll('.tb-btn').forEach(el => el.remove());

        const leftPages = pages.left;
        const rightPages = pages.right;

        leftPages.forEach(page => {
            const link = createLink(page, 'tb-btn');

            if (label) {
                toolbar.insertBefore(link, label);
            } else {
                toolbar.appendChild(link);
            }
        });

        rightPages.forEach(page => {
            const link = createLink(page, 'tb-btn');
            toolbar.appendChild(link);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadPages);
    } else {
        loadPages();
    }
})();
