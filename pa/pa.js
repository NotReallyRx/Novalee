(async function () {
    async function loadPages() {
        const response = await fetch('/pages.yml', {
            cache: 'no-cache'
        });

        if (!response.ok) {
            throw new Error(`Failed to load pages.yml: ${response.status}`);
        }

        const text = await response.text();
        const pages = parsePages(text);

        const toolbar = document.getElementById('toolbar');
        const label = document.getElementById('tb-label');

        if (!toolbar || !label) return;

        pages.left.forEach((page, index) => {
            const link = document.createElement('a');
            link.className = `tb-btn${index === 0 ? ' active' : ''}`;
            link.href = page.link;
            link.textContent = page.name;
            toolbar.insertBefore(link, label);
        });

        pages.right.forEach(page => {
            const link = document.createElement('a');
            link.className = 'tb-btn';
            link.href = page.link;
            link.textContent = page.name;
            toolbar.appendChild(link);
        });
    }

    function parsePages(text) {
        const pages = {
            left: [],
            right: []
        };

        let section = null;
        let current = null;

        for (const line of text.split(/\r?\n/)) {
            const trimmed = line.trim();

            if (!trimmed || trimmed.startsWith('#')) continue;

            if (trimmed === 'left:') {
                section = 'left';
                continue;
            }

            if (trimmed === 'right:') {
                section = 'right';
                continue;
            }

            if (!section) continue;

            const item = trimmed.match(/^-\s+name:\s*(.*)$/);

            if (item) {
                current = {
                    name: item[1].trim(),
                    link: ''
                };

                pages[section].push(current);
                continue;
            }

            if (!current) continue;

            const link = trimmed.match(/^link:\s*(.*)$/);

            if (link) {
                current.link = link[1].trim();
            }
        }

        return pages;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadPages);
    } else {
        loadPages();
    }
})();
