(function() {
  try {
    var tabData = JSON.parse(localStorage.getItem('tab') || '{}');
    if (tabData.title) document.title = tabData.title;
    if (tabData.icon) {
      var link = document.querySelector("link[rel='icon']");
      if (link) link.href = tabData.icon;
    }
  } catch(e) {}
})();
