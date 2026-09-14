import { safeFetch } from "../../core.js";

export default {
  name: "Gempa Terkini",
  category: "info",
  description: "Gempa bumi terbaru real-time dari BMKG",
  method: ["GET"],
  cache: 60,
  params: {},
  execute: async () => {
    const res = await safeFetch("https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json");

    if (!res.ok) {
      throw new Error("Gagal mengambil data dari BMKG");
    }

    const json = await res.json();
    const g = json.Infogempa?.gempa;

    if (!g) {
      throw new Error("Data gempa tidak ditemukan");
    }

    return {
      tanggal: g.Tanggal,
      jam: g.Jam,
      magnitude: g.Magnitude,
      kedalaman: g.Kedalaman,
      wilayah: g.Wilayah,
      potensi: g.Potensi,
      dirasakan: g.Dirasakan,
      lintang: g.Lintang,
      bujur: g.Bujur,
      shakemap: `https://data.bmkg.go.id/DataMKG/TEWS/${g.Shakemap}`
    };
  }
};