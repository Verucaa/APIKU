import { safeFetch } from "../../core.js";

const scrapeImages = async (query) => {
  const url = `https://www.pinterest.com/resource/BaseSearchResource/get/?data=${encodeURIComponent(
    JSON.stringify({ options: { query } })
  )}`;

  const res = await safeFetch(
    url,
    {
      method: "HEAD",
      headers: {
        "screen-dpr": "4",
        "x-pinterest-pws-handler": "www/search/[scope].js"
      }
    },
    15000
  );

  const linkHeader = res.headers.get("link") || "";
  return [...linkHeader.matchAll(/<(https:\/\/i\.pinimg\.com\/[^>]+)>/g)].map((m) => m[1]);
};

export default {
  name: "Pinterest Search",
  category: "search",
  description: "Cari gambar dari Pinterest (scrape contoh)",
  method: ["GET", "POST"],
  cache: 120,
  params: {
    query: {
      type: "string",
      required: true,
      description: "Kata kunci pencarian"
    },
    limit: {
      type: "number",
      required: false,
      description: "Jumlah gambar (default 5, maks 20)"
    }
  },
  execute: async ({ query, body }) => {
    const q = query.query || body?.query;
    const limit = Math.min(Math.max(parseInt(query.limit || body?.limit || 5, 10) || 5, 1), 20);

    const urls = await scrapeImages(q);
    if (!urls.length) {
      throw new Error("Tidak ada gambar ditemukan");
    }

    const results = urls.slice(0, limit);
    return { query: q, count: results.length, results };
  }
};