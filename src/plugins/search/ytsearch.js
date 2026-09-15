import { safeFetch } from "../../core.js";

const parseDurationToSeconds = (d) => {
  if (!d) return 0;
  return d.split(":").map(Number).reduce((a, b) => a * 60 + b, 0);
};

const scanBalanced = (html, start) => {
  let depth = 0, inStr = false, esc = false;
  for (let j = start; j < html.length; j++) {
    const c = html[j];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === "\"") inStr = !inStr;
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return html.slice(start, j + 1); }
  }
  return null;
};

const unescapeJsString = (s) => {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length) {
      const n = s[i + 1];
      if (n === "x" && i + 3 < s.length && /^[0-9a-fA-F]{2}$/.test(s.slice(i + 2, i + 4))) {
        out.push(String.fromCharCode(parseInt(s.slice(i + 2, i + 4), 16)));
        i += 4;
        continue;
      }
      if (n === "n") { out.push("\n"); i += 2; continue; }
      if (n === "t") { out.push("\t"); i += 2; continue; }
      if (n === "r") { out.push("\r"); i += 2; continue; }
      if (n === "\"" || n === "'" || n === "\\") { out.push(n); i += 2; continue; }
      out.push(c);
      i += 1;
      continue;
    }
    out.push(c);
    i += 1;
  }
  return out.join("");
};

const scrapeYtInitialData = (html) => {
  const regex = /var\s+ytInitialData\s*=\s*/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const start = m.index + m[0].length;
    const ch = html[start];
    if (ch === "{") {
      const slice = scanBalanced(html, start);
      if (slice) {
        try { return JSON.parse(slice); } catch {}
      }
    } else if (ch === "'") {
      let end = -1, esc = false;
      for (let j = start + 1; j < html.length; j++) {
        if (esc) { esc = false; continue; }
        if (html[j] === "\\") { esc = true; continue; }
        if (html[j] === "'") { end = j; break; }
      }
      if (end !== -1) {
        try { return JSON.parse(unescapeJsString(html.slice(start + 1, end))); } catch {}
      }
    }
  }
  return null;
};

const grabText = (runs) => (Array.isArray(runs) ? runs.map((r) => r.text || "").join("") : runs || "");

const extractItems = (contents) => {
  const items = [];
  const sections = contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
  for (const section of sections || []) {
    for (const item of section?.itemSectionRenderer?.contents || []) {
      const v = item?.videoRenderer;
      if (!v) continue;
      if (v.lengthText?.simpleText === "PREMIERE") continue;

      const thumb = v.thumbnail?.thumbnails?.[v.thumbnail.thumbnails.length - 1]?.url || "";
      items.push({
        title: grabText(v.title?.runs),
        video_id: v.videoId,
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        duration: v.lengthText?.simpleText || "",
        seconds: parseDurationToSeconds(v.lengthText?.simpleText || ""),
        views: v.viewCountText?.simpleText || "",
        uploaded: v.publishedTimeText?.simpleText || "",
        author: {
          name: grabText(v.ownerText?.runs),
          url: "https://www.youtube.com" + (v.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || "")
        },
        thumbnail: thumb ? (thumb.startsWith("http") ? thumb : `https:${thumb}`) : ""
      });
    }
  }
  return items;
};

export default {
  name: "YouTube Search",
  category: "search",
  description: "Search and retrieve video metadata from YouTube",
  method: ["GET", "POST"],
  params: {
    query: {
      type: "string",
      required: true,
      description: "Search keyword"
    },
    limit: {
      type: "number",
      required: false,
      description: "Maximum results to return (default 10, max 20)"
    }
  },
  execute: async (req) => {
    const query = req.query.query || req.body?.query;
    const rawLimit = req.query.limit || req.body?.limit || 10;

    if (!query) {
      throw new Error("Parameter 'query' wajib disertakan");
    }

    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 10, 1), 20);

    const res = await safeFetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&gl=US&hl=en`,
      { headers: { "Accept-Language": "en-US,en;q=0.9" } },
      20000
    );
    const html = await res.text();
    const data = scrapeYtInitialData(html);

    if (!data) {
      throw new Error("Gagal memuat hasil pencarian dari YouTube");
    }

    const results = extractItems(data.contents).slice(0, limit);

    if (!results.length) {
      throw new Error("Tidak ada video ditemukan untuk query tersebut");
    }

    return {
      query,
      count: results.length,
      results
    };
  }
};