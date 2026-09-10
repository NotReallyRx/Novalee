const iframeRules = {
  "https://cdn.jsdelivr.net/gh/NotReallyRx/yesterdays-meat-port@main/index.html":
    "https://yesterdays-meat-port.pages.dev/",

  "https://cdn.jsdelivr.net/gh/NotReallyRx/C09@main/index.html":
    "https://notreallyrx.github.io/C09/",

  "https://cdn.jsdelivr.net/gh/NotReallyRx/C09RU@main/index.html":
    "https://notreallyrx.github.io/C09RU/",

  "https://cdn.jsdelivr.net/gh/NotReallyRx/C09FS@main/index.html":
    "https://notreallyrx.github.io/C09FS/",
};

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);

    // WebSocket proxy
    if (requestUrl.pathname.startsWith("/w/")) {
      requestUrl.hostname = "copium-wisp-9058389.onrender.com";
      requestUrl.protocol = "https:";
      return fetch(new Request(requestUrl, request));
    }

    if (requestUrl.pathname !== "/pr/") {
      return env.ASSETS.fetch(request);
    }

    const target = requestUrl.searchParams.get("url");

    if (!target) {
      return new Response("Missing url", { status: 400 });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response("Invalid url", { status: 400 });
    }

    if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
      return new Response("Only HTTP and HTTPS URLs are supported", {
        status: 400,
      });
    }

    const iframeTarget = iframeRules[targetUrl.href];

    if (iframeTarget) {
      const html = `<!doctype html>
<html>
<head>
	<meta charset="utf-8">
	<title>Edu</title>

	<style>
		html,
		body {
			margin: 0;
			width: 100%;
			height: 100%;
			overflow: hidden;
			background: black;
		}

		iframe {
			border: 0;
			width: 100%;
			height: 100%;
			display: block;
		}
	</style>
</head>

<body>
	<iframe
		src="${iframeTarget}"
		allowfullscreen
		allow="fullscreen; autoplay"
	></iframe>
</body>
</html>`;

      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    let response;
    try {
      response = await fetch(targetUrl.href, { redirect: "follow" });
    } catch (error) {
      return new Response(`Failed to fetch target: ${error.message}`, {
        status: 502,
      });
    }

    const contentType = response.headers.get("content-type") || "";
    const finalUrl = response.url || targetUrl.href;
    const pathname = new URL(finalUrl).pathname.toLowerCase();
    const isHtml =
      contentType.includes("text/html") || /\.html?$/i.test(pathname);

    if (!isHtml) {
      const headers = new Headers(response.headers);
      headers.set("access-control-allow-origin", "*");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    let html = await response.text();
    const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf("/") + 1);

    if (!/<base[\s>]/i.test(html)) {
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(
          /<head([^>]*)>/i,
          `<head$1><base href="${baseUrl}">`,
        );
      } else {
        html = `<!doctype html>
<html>
<head>
	<base href="${baseUrl}">
</head>
<body>
${html}
</body>
</html>`;
      }
    }

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "access-control-allow-origin": "*",
      },
    });
  },
};
