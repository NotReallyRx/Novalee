/*
 * Reusable truffled.lol proxy module.
 *
 * Usage from another worker's index.js:
 *
 *   import { truffledFetch } from "./p/truffled.js";
 *
 *   if (requestUrl.pathname.startsWith("/tr")) {
 *     return truffledFetch(request, { mountPath: "/tr" });
 *   }
 *
 * With mountPath: "/tr", requests map like:
 *   /tr        -> https://truffled.lol/games/
 *   /tr/       -> https://truffled.lol/games/
 *   /tr/game1  -> https://truffled.lol/games/game1
 *   /tr/game1/ -> https://truffled.lol/games/game1/
 */

const DEFAULT_UPSTREAM = "https://truffled.lol/games/";
const DEFAULT_MOUNT_PATH = "/tr";

/*
 * Normalize a mount path to always start with "/" and
 * never end with a trailing "/" (e.g. "tr/" -> "/tr").
 * An empty/falsy mountPath means "mounted at root".
 */
function normalizeMountPath(mountPath) {
  if (!mountPath) return "";
  let p = mountPath.startsWith("/") ? mountPath : `/${mountPath}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

/*
 * Escape a string for safe use inside a RegExp.
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/*
 * Main entry point. Config:
 *   - upstream: the upstream base URL to proxy (must end in "/")
 *   - mountPath: the path prefix this proxy is mounted under
 *                on the calling worker (e.g. "/tr")
 */
export async function truffledFetch(request, config = {}) {
  const UPSTREAM = new URL(config.upstream || DEFAULT_UPSTREAM);
  const MOUNT = normalizeMountPath(
    config.mountPath !== undefined ? config.mountPath : DEFAULT_MOUNT_PATH
  );

  /*
   * The upstream's own path prefix, without a trailing slash,
   * e.g. "https://truffled.lol/games/" -> "/games"
   */
  const upstreamPrefix = UPSTREAM.pathname.replace(/\/$/, "");

  const incomingUrl = new URL(request.url);

  /*
   * Handle CORS preflight.
   */
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  /*
   * Strip the mount prefix so the rest of the path can be
   * joined onto UPSTREAM. e.g. mountPath "/tr":
   *   "/tr"        -> ""
   *   "/tr/"       -> "/"
   *   "/tr/game1/" -> "/game1/"
   */
  let pathname = incomingUrl.pathname;
  if (MOUNT && pathname.startsWith(MOUNT)) {
    pathname = pathname.slice(MOUNT.length);
  }
  if (pathname === "") pathname = "/";

  /*
   * UPSTREAM's pathname ends in "/" (e.g. "/games/"), and
   * new URL(path, base) treats a leading "/" as ABSOLUTE,
   * which would wipe out "/games/" entirely. Stripping the
   * leading slash makes it resolve relative to UPSTREAM's
   * path instead, so it lands underneath "/games/".
   */
  const relativePath = pathname.replace(/^\//, "");

  const upstreamUrl = new URL(
    relativePath + incomingUrl.search,
    UPSTREAM
  );

  const headers = new Headers(request.headers);

  headers.delete("host");

  const fetchOptions = {
    method: request.method,
    headers: headers,
    redirect: "manual",
  };

  /*
   * Only attach a body to methods that can have one.
   */
  if (request.method !== "GET" && request.method !== "HEAD") {
    fetchOptions.body = request.body;
  }

  let upstreamResponse;

  try {
    upstreamResponse = await fetch(upstreamUrl, fetchOptions);
  } catch (error) {
    return new Response("Failed to fetch upstream resource.", {
      status: 502,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        ...corsHeaders(),
      },
    });
  }

  const responseHeaders = new Headers(upstreamResponse.headers);

  /*
   * Add CORS headers.
   */
  for (const [key, value] of Object.entries(corsHeaders())) {
    responseHeaders.set(key, value);
  }

  /*
   * Rewrite redirects pointing back to the upstream.
   */
  if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
    const location = responseHeaders.get("location");

    if (location) {
      responseHeaders.set(
        "location",
        rewriteRedirect(location, incomingUrl.origin, UPSTREAM, MOUNT)
      );
    }
  }

  const contentType = responseHeaders.get("content-type") || "";

  /*
   * Rewrite HTML only.
   */
  if (contentType.toLowerCase().includes("text/html")) {
    let html = await upstreamResponse.text();

    /*
     * We modified the response body,
     * so remove headers that may now be incorrect.
     */
    responseHeaders.delete("content-length");
    responseHeaders.delete("content-encoding");

    html = rewriteHtml(
      html,
      incomingUrl.origin,
      UPSTREAM,
      MOUNT,
      upstreamPrefix
    );

    return new Response(html, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  }

  /*
   * Everything else passes through unchanged.
   *
   * This is important for:
   *
   * .js
   * .css
   * .swf
   * .wasm
   * .data
   * images
   * audio
   * fonts
   */
  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

/*
 * HTML rewriting.
 *
 * We replace explicit references to the upstream domain
 * (derived from UPSTREAM), AND we swap the upstream's path
 * prefix (e.g. "/games") for our MOUNT path (e.g. "/tr") so
 * in-page root-relative links like href="/games/game2/"
 * correctly become href="/tr/game2/" on the calling worker.
 *
 * We deliberately DO NOT add a <base> tag.
 */
function rewriteHtml(html, workerOrigin, UPSTREAM, MOUNT, upstreamPrefix) {
  const escapedHost = escapeRegExp(UPSTREAM.hostname);
  const escapedPrefix = escapeRegExp(upstreamPrefix);
  const destinationOrigin = workerOrigin + MOUNT;

  /*
   * Absolute HTTPS URLs, e.g.
   * https://truffled.lol/games/foo -> workerOrigin + MOUNT + /foo
   */
  html = html.replace(
    new RegExp(`https:\\/\\/${escapedHost}${escapedPrefix}`, "gi"),
    destinationOrigin
  );

  /*
   * Absolute HTTP URLs.
   */
  html = html.replace(
    new RegExp(`http:\\/\\/${escapedHost}${escapedPrefix}`, "gi"),
    destinationOrigin
  );

  /*
   * Protocol-relative URLs.
   */
  html = html.replace(
    new RegExp(`\\/\\/${escapedHost}${escapedPrefix}`, "gi"),
    destinationOrigin
  );

  /*
   * Root-relative links using just the upstream's path prefix,
   * e.g. href="/games/game2/" -> href="/tr/game2/". Matches the
   * prefix only when immediately followed by "/", a quote, or a
   * closing paren, so "/gamesomething" is left untouched.
   */
  if (upstreamPrefix) {
    html = html.replace(
      new RegExp(`${escapedPrefix}(?=\\/|["')])`, "g"),
      MOUNT
    );
  }

  return html;
}

/*
 * Rewrite upstream redirects so they stay on the calling
 * worker, swapping the upstream's path prefix for MOUNT.
 */
function rewriteRedirect(location, workerOrigin, UPSTREAM, MOUNT) {
  try {
    /*
     * Resolve relative redirects against the upstream.
     */
    const url = new URL(location, UPSTREAM);

    /*
     * Only rewrite the configured upstream.
     */
    if (url.hostname === UPSTREAM.hostname) {
      let pathname = url.pathname;

      if (pathname.startsWith(UPSTREAM.pathname)) {
        pathname = "/" + pathname.slice(UPSTREAM.pathname.length);
      }

      return workerOrigin + MOUNT + pathname + url.search + url.hash;
    }

    return location;
  } catch (error) {
    return location;
  }
}

/*
 * CORS headers.
 */
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range",
    "Access-Control-Expose-Headers":
      "Content-Length, Content-Range, Accept-Ranges",
    "Access-Control-Max-Age": "86400",
  };
}
