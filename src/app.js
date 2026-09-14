import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import {
  plugins,
  loadAllPlugins,
  resolveSingleRouteOnDemand,
  sendSuccess,
  sendError,
  extractAndValidateInput,
  getCache,
  setCache,
  createRateLimiter
} from "./core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set("json spaces", 2);
app.disable("x-powered-by");

const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;
const apiLimiter = createRateLimiter(RATE_MAX, RATE_WINDOW_MS);

const clientKey = (req) =>
  req.headers["cf-connecting-ip"] ||
  (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
  req.ip ||
  "unknown";

const rateLimit = (req, res, next) => {
  const { ok, remaining, resetMs } = apiLimiter.allow(clientKey(req));
  res.setHeader("X-RateLimit-Limit", RATE_MAX);
  res.setHeader("X-RateLimit-Remaining", remaining);
  if (!ok) {
    res.setHeader("Retry-After", Math.ceil(resetMs / 1000));
    return sendError(res, "Terlalu banyak permintaan. Coba lagi sebentar lagi.", 429);
  }
  next();
};

const securityHeaders = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
};

app.use(cors());
app.use(securityHeaders);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(express.static(path.resolve(__dirname, "../public")));
app.use("/media", express.static(path.resolve(__dirname, "media")));
app.use("/api", rateLimit);
app.use(`/:category/:plugin(*)`, (req, res, next) => {
  if (req.params?.category === "api") return next();
  rateLimit(req, res, next);
});

app.get("/api/endpoints", async (req, res) => {
  try {
    await loadAllPlugins();
  } catch {}

  const groups = {};
  for (const [routePath, data] of plugins.entries()) {
    const category = data.category || "general";
    (groups[category] ||= []).push({
      name: data.name,
      category,
      endpoint: routePath,
      method: data.method,
      description: data.description,
      params: data.params,
      cache: data.cache
    });
  }

  return sendSuccess(res, {
    total: plugins.size,
    categories: Object.keys(groups),
    endpoints: groups
  });
});

app.all("/:category/:plugin(*)", async (req, res) => {
  const routePath = `/${req.params.category}/${req.params.plugin}`.toLowerCase();
  let target = plugins.get(routePath);

  if (!target) {
    try {
      target = await resolveSingleRouteOnDemand(req.params.category, req.params.plugin);
    } catch {}
  }

  if (!target) {
    return sendError(res, `Endpoint '${routePath}' tidak ditemukan`, 404);
  }

  if (!target.method.includes(req.method)) {
    return sendError(res, `Method ${req.method} tidak diizinkan`, 405);
  }

  const { input, error } = extractAndValidateInput(target.params, req);
  if (error) {
    return sendError(res, error, 400);
  }

  const cacheKey = `${req.method}:${req.originalUrl}`;
  if (target.cache && req.method === "GET") {
    const cached = getCache(cacheKey);
    if (cached !== null) {
      return sendSuccess(res, cached);
    }
  }

  try {
    const controller = new AbortController();
    req.on("close", () => controller.abort());

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Waktu proses melebihi batas (timeout)")), target.timeout || 60000)
    );

    const result = await Promise.race([
      target.execute(req, res, {
        input,
        query: req.query || {},
        body: req.body || {}
      }),
      timeout
    ]);

    if (!res.headersSent && result !== undefined) {
      if (target.cache && req.method === "GET") {
        setCache(cacheKey, result, target.cache);
      }
      return sendSuccess(res, result);
    }
  } catch (err) {
    if (!res.headersSent) {
      return sendError(res, err.message || "Internal Server Error", 500);
    }
  }
});

app.use((req, res) => sendError(res, "Endpoint tidak ditemukan", 404));

export default app;