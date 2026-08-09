function status(msg, type) {
  var s = document.getElementById('status');
  if (!s) return;

  s.textContent = msg;
  s.className = type || 'ok';

  clearTimeout(s._t);
  s._t = setTimeout(function () {
    s.textContent = '';
    s.className = '';
  }, 2400);
}

function getTabData() {
  try {
    return JSON.parse(localStorage.getItem('tab') || '{}');
  } catch (e) {
    return {};
  }
}

function saveTabData(d) {
  localStorage.setItem('tab', JSON.stringify(d));
}



function setFavicon(url) {
  var link = document.querySelector("link[rel*='icon']");

  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }

  if (url.startsWith('data:')) {

    if (url.startsWith('data:image/png')) link.type = 'image/png';
    else if (url.startsWith('data:image/svg')) link.type = 'image/svg+xml';
    else if (url.startsWith('data:image/x-icon')) link.type = 'image/x-icon';

    link.href = url; 
  } else {
    link.href = url + '?v=' + Date.now(); 
  }
}



function applyTitle() {
  var input = document.getElementById('title-input');
  if (!input) return;

  var v = input.value.trim();
  if (!v) {
    status('enter a title first', 'err');
    return;
  }

  document.title = v;

  var d = getTabData();
  d.title = v;
  saveTabData(d);

  status('tab title saved');
}

function applyIcon() {
  var input = document.getElementById('icon-input');
  if (!input) return;

  var v = input.value.trim();
  if (!v) {
    status('enter a favicon URL first', 'err');
    return;
  }

  setFavicon(v);

  var d = getTabData();
  d.icon = v;
  saveTabData(d);

  status('favicon saved');
}


var CLOAKS = {};

function applyCloak() {
  var select = document.getElementById('premadecloaks');
  if (!select) return;

  var c = select.value;
  if (!c) {
    status('choose a cloak first', 'err');
    return;
  }

  var preset = CLOAKS[c];
  if (!preset) return;

  document.title = preset.title;
  setFavicon(preset.icon);

  saveTabData({
    title: preset.title,
    icon: preset.icon
  });

  document.getElementById('title-input').value = preset.title;
  document.getElementById('icon-input').value = preset.icon;

  status('cloak applied — ' + preset.title);
}



function resetTab() {
  localStorage.removeItem('tab');

  document.title = 'Settings';
  setFavicon('./images/logo.png');

  document.getElementById('title-input').value = '';
  document.getElementById('icon-input').value = '';
  document.getElementById('premadecloaks').value = '';

  status('tab data removed');
}



document.addEventListener('DOMContentLoaded', function () {
  var d = getTabData();

  if (d.title) {
    var t = document.getElementById('title-input');
    if (t) t.value = d.title;
  }

  if (d.icon) {
    var i = document.getElementById('icon-input');
    if (i) i.value = d.icon;
  }

  if (d.icon) {
    setFavicon(d.icon);
  }

  var btn = document.getElementById('cloaker-button');
  if (!btn) return;

  var win;

  btn.addEventListener('click', function () {
    if (win && !win.closed) {
      win.focus();
      return;
    }

    var url = window.location.href;
    var originalTitle = document.title;
    var favicon = document.querySelector("link[rel*='icon']");
    var faviconURL = favicon ? favicon.href : '';

    win = window.open('about:blank', '_blank');

    if (!win) {
      alert('Popup blocked. Allow popups for this site.');
      return;
    }

    win.document.title = originalTitle;

    if (faviconURL) {
      var link = win.document.createElement('link');
      link.rel = 'icon';
      link.href = faviconURL;
      win.document.head.appendChild(link);
    }

    var iframe = win.document.createElement('iframe');
    iframe.style.border = 'none';
    iframe.style.width = '100%';
    iframe.style.height = '100vh';

    iframe.srcdoc = `
      <!DOCTYPE html>
      <html>
        <head><base href="${url}"></head>
        <body style="margin:0">
          <script>location.replace("${url}")<\/script>
        </body>
      </html>
    `;

    win.document.body.style.margin = '0';
    win.document.body.appendChild(iframe);

    window.location.replace("https://classroom.google.com");

    btn.textContent = "Opened";

    var interval = setInterval(function () {
      if (win.closed) {
        clearInterval(interval);
        win = undefined;
        btn.textContent = "open";
      }
    }, 500);
  });
});

async function loadCloaks() {
  try {
    const res = await fetch('/s/s.yml');
    const text = await res.text();

    CLOAKS = jsyaml.load(text) || {};

    populateDropdown();
  } catch (e) {
    console.error('Failed to load s.yml', e);
  }
}

function populateDropdown() {
  var select = document.getElementById('premadecloaks');
  if (!select) return;

  select.innerHTML = '<option value="">— choose —</option>';

  for (var key in CLOAKS) {
    var opt = document.createElement('option');
    opt.value = key;
    opt.textContent = CLOAKS[key].title;
    select.appendChild(opt);
  }
}

document.addEventListener('DOMContentLoaded', loadCloaks);
