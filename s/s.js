   function status(msg, type) {
      var s = document.getElementById('status');
      s.textContent = msg;
      s.className = type || 'ok';
      clearTimeout(s._t);
      s._t = setTimeout(function() { s.textContent = ''; s.className = ''; }, 2400);
    }

    function getTabData() {
      try { return JSON.parse(localStorage.getItem('tab') || '{}'); } catch(e) { return {}; }
    }
    function saveTabData(d) {
      localStorage.setItem('tab', JSON.stringify(d));
    }

    function applyTitle() {
      var v = document.getElementById('title-input').value.trim();
      if (!v) { status('enter a title first', 'err'); return; }
      document.title = v;
      var d = getTabData(); d.title = v; saveTabData(d);
      status('tab title saved');
    }

    function applyIcon() {
      var v = document.getElementById('icon-input').value.trim();
      if (!v) { status('enter a favicon URL first', 'err'); return; }
      var link = document.querySelector("link[rel='icon']");
      if (link) link.href = v;
      var d = getTabData(); d.icon = v; saveTabData(d);
      status('favicon saved');
    }

    var CLOAKS = {
      search:    { title: 'Google',                     icon: './images/cloaks/Google Search.ico' },
      drive:     { title: 'My Drive - Google Drive',    icon: './images/cloaks/Google Drive.ico' },
      youtube:   { title: 'YouTube',                    icon: './images/cloaks/YouTube.ico' },
      gmail:     { title: 'Gmail',                      icon: './images/cloaks/Gmail.ico' },
      calendar:  { title: 'Google Calendar',            icon: './images/cloaks/Calendar.ico' },
      meets:     { title: 'Google Meet',                icon: './images/cloaks/Meet.ico' },
      classroom: { title: 'Classes',                    icon: './images/cloaks/Classroom.png' },
      canvas:    { title: 'Canvas',                     icon: './images/cloaks/Canvas.ico' },
      zoom:      { title: 'Zoom',                       icon: './images/cloaks/Zoom.ico' },
      khan:      { title: 'Dashboard | Khan Academy',   icon: './images/cloaks/Khan Academy.ico' },
      wikipedia: { title: 'ويكيبيديا - جهاد',           icon: 'https://ar.wikipedia.org/favicon.ico' },
      nitter:    { title: 'nitter',                     icon: './images/cloaks/63DFB320-0EEC-4F06-AF02-C50DFD2B49AB.ico' },
      teddit:    { title: 'teddit',                     icon: './images/cloaks/EB4D8FE9-10E9-44B8-A6CE-3F9A0040F94A.ico' },
      indivious: { title: 'Invidious',                  icon: './images/cloaks/2255E848-AB69-43C1-B470-DBFDA40FAD10.ico' },
      bsite:     { title: 'Billibilli',                 icon: 'https://www.bilibili.com/favicon.ico' },
      librex:    { title: 'LibreX',                     icon: './images/cloaks/9A58D8BC-6595-476A-AD95-B6D8880683C8.ico' },
      cornhub:   { title: 'Cornhub',                    icon: './images/cloaks/8FE4C273-914D-431D-907E-3FCF5BB0399F.ico' },
      itchio:    { title: 'Top free NSFW games for web',icon: './images/cloaks/D23D344B-4CB0-4799-B525-F4E4F3A36728.ico' },
    };

    function applyCloak() {
      var c = document.getElementById('premadecloaks').value;
      if (!c) { status('choose a cloak first', 'err'); return; }
      var preset = CLOAKS[c]; if (!preset) return;
      document.title = preset.title;
      var link = document.querySelector("link[rel='icon']");
      if (link) link.href = preset.icon;
      saveTabData({ title: preset.title, icon: preset.icon });
      document.getElementById('title-input').value = preset.title;
      document.getElementById('icon-input').value = preset.icon;
      status('cloak applied — ' + preset.title);
    }

    function resetTab() {
      localStorage.removeItem('tab');
      document.title = 'Settings';
      var link = document.querySelector("link[rel='icon']");
      if (link) link.href = './images/logo.png';
      document.getElementById('title-input').value = '';
      document.getElementById('icon-input').value = '';
      document.getElementById('premadecloaks').value = '';
      status('tab data removed');
    }

    // Pre-fill inputs from saved data
    (function() {
      var d = getTabData();
      if (d.title) document.getElementById('title-input').value = d.title;
      if (d.icon)  document.getElementById('icon-input').value  = d.icon;
    })();


(function initCloaker() {
  var btn = document.getElementById('cloaker-button');
  if (!btn) return;

  var win;
  btn.addEventListener('click', function() {
    if (win && !win.closed) {
      win.focus();
      return;
    }

    var url = window.location.href;
    var originalTitle = document.title;
    var faviconElement = document.querySelector('link[rel="icon"]');
    var faviconURL = faviconElement ? faviconElement.href : '';

    win = window.open();
    win.document.body.style.margin = '0';
    win.document.title = originalTitle;

    if (faviconURL) {
      var favicon = win.document.createElement('link');
      favicon.rel = 'icon';
      favicon.href = faviconURL;
      win.document.head.appendChild(favicon);
    }

    var iframe = win.document.createElement('iframe');
    iframe.style.border = 'none';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.margin = '0';
    iframe.style.overflow = 'hidden';
    iframe.src = url;
    win.document.body.appendChild(iframe);

    window.location.replace("https://classroom.google.com");

    var interval = setInterval(function() {
      if (win.closed) {
        clearInterval(interval);
        win = undefined;
        btn.textContent = "Open in about:blank";
      }
    }, 500);

    btn.textContent = "About:blank";
  });
})();
