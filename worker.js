import {
  plugins,
  registerPlugin,
  sendSuccess,
  sendError,
  extractAndValidateInput,
  getCache,
  setCache,
  createRateLimiter
} from "./src/core.js";

import gempa from "./src/plugins/info/gempa.js";
import ping from "./src/plugins/info/ping.js";
import pinterest from "./src/plugins/search/pinterest.js";
import soundcloud from "./src/plugins/search/soundcloud.js";
import ytsearch from "./src/plugins/search/ytsearch.js";
import tempmail from "./src/plugins/tools/tempmail.js";
import uuid from "./src/plugins/tools/uuid.js";
import web2apk from "./src/plugins/tools/web2apk.js";
import youtube from "./src/plugins/downloader/youtube.js";
import instagram from "./src/plugins/downloader/instagram.js";
import capcut from "./src/plugins/downloader/capcut.js";
import skiplink from "./src/plugins/bypass/skiplink.js";

for (const [handler, routePath] of [
  [gempa, "/info/gempa"],
  [ping, "/info/ping"],
  [pinterest, "/search/pinterest"],
  [soundcloud, "/search/soundcloud"],
  [ytsearch, "/search/ytsearch"],
  [tempmail, "/tools/tempmail"],
  [uuid, "/tools/uuid"],
  [web2apk, "/tools/web2apk"],
  [youtube, "/downloader/youtube"],
  [instagram, "/downloader/instagram"],
  [capcut, "/downloader/capcut"],
  [skiplink, "/bypass/skiplink"]
]) {
  registerPlugin(handler, routePath);
}

const createRes = () => {
  const res = {
    headers: {},
    statusCode: 200,
    body: "",
    headersSent: false,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    send(b) { this.body = b; this.headersSent = true; return this; }
  };
  return res;
};

const toResponse = (res) => new Response(res.body, { status: res.statusCode, headers: res.headers });

const getQuery = (url) => Object.fromEntries(url.searchParams.entries());

const readBody = async (request) => {
  if (request.method === "GET" || request.method === "HEAD") return {};
  const ct = request.headers.get("content-type") || "";
  const text = await request.text();
  if (ct.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  try { return JSON.parse(text); } catch { return {}; }
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "X-XSS-Protection": "1; mode=block",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type"
};

const rateLimiter = createRateLimiter(30, 60000);
const clientKey = (request) =>
  request.headers.get("cf-connecting-ip") ||
  (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
  "unknown";

const applySecurity = (resp) => {
  const headers = new Headers(resp.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
};

const rateLimited = (request) => {
  const res = createRes();
  const { remaining, resetMs } = rateLimiter.allow(clientKey(request));
  res.setHeader("X-RateLimit-Limit", 30);
  res.setHeader("X-RateLimit-Remaining", remaining);
  res.setHeader("Retry-After", Math.ceil(resetMs / 1000));
  sendError(res, "Terlalu banyak permintaan. Coba lagi sebentar lagi.", 429);
  return toResponse(res);
};

const finish = (res, remaining) => {
  res.setHeader("X-RateLimit-Limit", 30);
  res.setHeader("X-RateLimit-Remaining", remaining);
  return applySecurity(toResponse(res));
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean).map((p) => decodeURIComponent(p));
    const routePath = "/" + parts.join("/");

    if (routePath === "/api/endpoints") {
      const { ok, remaining, resetMs } = rateLimiter.allow(clientKey(request));
      if (!ok) return rateLimited(request);
      const groups = {};
      for (const [path, data] of plugins.entries()) {
        const category = data.category || "general";
        (groups[category] ||= []).push({
          name: data.name,
          category,
          endpoint: path,
          method: data.method,
          description: data.description,
          params: data.params,
          cache: data.cache
        });
      }
      const res = createRes();
      res.setHeader("X-RateLimit-Limit", 30);
      res.setHeader("X-RateLimit-Remaining", remaining);
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: SECURITY_HEADERS });
      sendSuccess(res, { total: plugins.size, categories: Object.keys(groups), endpoints: groups });
      return applySecurity(toResponse(res));
    }

    if (parts.length >= 2) {
      const { ok, remaining } = rateLimiter.allow(clientKey(request));
      if (!ok) return rateLimited(request);
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: SECURITY_HEADERS });
      const target = plugins.get(routePath);
      if (target) {
        const req = { method: request.method, url: request.url, query: getQuery(url), body: await readBody(request) };
        const res = createRes();

        if (!target.method.includes(request.method)) {
          sendError(res, `Method ${request.method} tidak diizinkan`, 405);
          return finish(res, remaining);
        }

        const { input, error } = extractAndValidateInput(target.params, req);
        if (error) {
          sendError(res, error, 400);
          return finish(res, remaining);
        }

        const cacheKey = `${request.method}:${url.pathname}`;
        if (target.cache && request.method === "GET") {
          const cached = getCache(cacheKey);
          if (cached !== null) {
            sendSuccess(res, cached);
            return finish(res, remaining);
          }
        }

        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Waktu proses melebihi batas (timeout)")), target.timeout || 60000)
        );

        try {
          const result = await Promise.race([
            target.execute(req, res, { input, query: req.query, body: req.body }),
            timeout
          ]);
          if (!res.headersSent && result !== undefined) {
            if (target.cache && request.method === "GET") setCache(cacheKey, result, target.cache);
            sendSuccess(res, result);
          }
        } catch (err) {
          if (!res.headersSent) sendError(res, err.message || "Internal Server Error", 500);
        }
        return finish(res, remaining);
      }
      const notFound = createRes();
      sendError(notFound, `Endpoint '${routePath}' tidak ditemukan`, 404);
      return finish(notFound, remaining);
    }

    return applySecurity(await env.ASSETS.fetch(request));
  }
};