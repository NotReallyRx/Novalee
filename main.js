document.addEventListener('DOMContentLoaded', function () {
  try {
    var tabData = JSON.parse(localStorage.getItem('tab') || '{}');

    if (tabData.title) {
      document.title = tabData.title;
    }

    if (tabData.icon) {
      var link = document.querySelector("link[rel*='icon']");

      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }

      if (tabData.icon.startsWith('data:')) {
        link.href = tabData.icon;
      } else {
        link.href = tabData.icon + '?v=' + Date.now();
      }
    }
  } catch (e) {}
});
