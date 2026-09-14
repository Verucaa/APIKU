# API Hub — Rest API Engine (Simpel & Modular)

<p align="center">
  <strong>Engine REST API paling simpel: tambah endpoint = tambah satu file, tanpa konfigurasi.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v18%2B-0e1015?style=flat-square&logo=node.js" alt="Node" />
  <img src="https://img.shields.io/badge/Module-ESM-0e1015?style=flat-square" alt="ESM" />
  <img src="https://img.shields.io/badge/Vercel%20Ready-black?style=flat-square&logo=vercel" alt="Vercel" />
  <img src="https://img.shields.io/badge/Author-sbyuxD-ea580c?style=flat-square" alt="Author" />
</p>

---

## 🚀 Bisa Apa Saja Ini?

- Setiap **endpoint = 1 file** di dalam folder `src/plugins/<kategori>/`. Tinggal taruh file, langsung hidup.
- **Router otomatis**: `src/plugins/info/gempa.js` otomatis jadi `GET /info/gempa`.
- **Form input otomatis** di UI: kolom input dibuat otomatis dari schema `params`, tidak perlu sentuh HTML.
- **Tampilan web** (playground) modern: animasi smooth, filter kategori, pencarian, tes endpoint langsung dari browser.
- Validasi parameter otomatis, cache TTL, timeout anti-hang, `safeFetch` anti-banned.
- **Vercel Ready** — bisa deploy sekali push, tanpa server sendiri.

---

## 📁 Struktur Proyek

```text
api-simple/
├── api/
│   └── index.js          # Entry point Vercel Serverless
├── public/
│   ├── index.html        # UI Playground (single file)
│   └── config.json       # ⭐ Konfigurasi tampilan: judul, warna, font, konten
├── src/
│   ├── plugins/          # ⭐ SEMUA ENDPOINT ADA DI SINI
│   │   ├── info/
│   │   │   ├── ping.js
│   │   │   └── gempa.js
│   │   ├── search/
│   │   │   └── pinterest.js
│   │   └── tools/
│   │       └── uuid.js
│   ├── app.js            # Express app + route dispatcher
│   └── core.js           # Engine: loader, helper, cache, validator
├── index.js              # Runner lokal
├── package.json
├── vercel.json
└── README.md
```

Konsep intinya: **jangan pernah menyentuh `app.js` untuk tambah fitur**. Cukup buat file baru di `src/plugins/`.

---

## 🛠️ Cara Menjalankan

### 1. Prasyarat
- Node.js **18+**
- npm / pnpm / yarn

### 2. Instalasi & Jalankan Lokal

```bash
npm install
npm start
```

atau mode development (sama saja, tanpa hot-reload otomatis karena request berikutnya akan memuat plugin baru secara *on-demand*):

```bash
npm run dev
```

Server jalan di:

- UI Playground → **http://localhost:3000**
- Daftar endpoint (JSON) → http://localhost:3000/api/endpoints

> 💡 **Tidak perlu restart** saat menambah file plugin baru. Dispatcher otomatis mencari file yang belum terdaftar saat request masuk (`resolveSingleRouteOnDemand`).

### 3. Deploy ke Vercel

**Cara CLI:**

```bash
npm i -g vercel
vercel
```

**Cara Dashboard:**

1. Push repo ke GitHub.
2. Vercel → **Add New Project** → import repo → **Deploy**.
3. Selesai. `vercel.json` sudah mengatur routing & bundling.

---

## ➕ Cara Menambah Endpoint (Cara Cepat)

Buat file `.js` di dalam folder kategori. Contoh: `src/plugins/info/now.js`

```js
export default {
  name: "Waktu Sekarang",          // Nama di UI
  category: "info",                // Folder / grup
  description: "Menampilkan waktu server saat ini",
  method: ["GET", "POST"],         // Boleh GET, POST, atau dua-duanya
  params: {},                      // Kolom input otomatis (lihat di bawah)
  execute: async ({ query, body }) => {
    return {
      date: new Date().toLocaleString(),
      input: query.q || body?.q || ""
    };
  }
};
```

File tersebut langsung menjadi:

| File                         | Method     | URL Path          |
| :--------------------------- | :--------- | :---------------- |
| `src/plugins/info/now.js`    | GET / POST | `/info/now`       |
| `src/plugins/search/image.js`| GET / POST | `/search/image`   |

`execute` menerima **satu objek argumen**: `{ input, query, body }`.
- `input` → gabungan query + body (sudah tervalidasi & dikonversi tipenya).
- `query` → parameter URL mentah.
- `body` → request body JSON.

Mau respons file dokumen biasa tanpa `status/creator`? Kirim langsung pakai `res`:

```js
execute: async (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.send("hello");
}
```

---

## 🧾 Cara Menambah Kolom Input (Schema `params`)

Input di UI, validasi di server, dan dokumentasi — semuanya mengikuti object `params`. Tiga tipe didukung:

### Tipe `string` → kolom teks
```js
params: {
  query: {
    type: "string",
    required: true,
    description: "Kata kunci pencarian"   // tampil sebagai petunjuk di UI
  }
}
```

### Tipe `number` → kolom angka
```js
params: {
  limit: {
    type: "number",
    required: false,
    description: "Jumlah data (default 5)"
  }
}
```
Server otomatis menolak (`400`) jika diisi bukan angka.

### Tipe `boolean` → checkbox
```js
params: {
  compact: {
    type: "boolean",
    required: false,
    description: "Hasil ringkas"
  }
}
```

**Aturan:**
- `required: true` → kolom wajib, ditandai `*` di UI, dan request akan ditolak `400` jika kosong.
- Tanpa `type` → dianggap `string`.
- `params: {}` atau dihapus → UI tidak menampilkan form (endpoint tanpa parameter).

Contoh lengkap kombinasi:

```js
export default {
  name: "Contoh Lengkap",
  category: "tools",
  description: "Menunjukkan semua tipe input",
  method: ["GET", "POST"],
  params: {
    text:   { type: "string",  required: true,  description: "Teks wajib" },
    limit:  { type: "number",  required: false, description: "Batasan jumlah" },
    mode:   { type: "string",  required: false, description: "Mode output" },
    senior: { type: "boolean", required: false, description: "Mode cerdas" }
  },
  execute: async ({ input }) => {
    return {
      echo: input.text,
      count: input.limit,
      flags: { mode: input.mode, senior: !!input.senior }
    };
  }
};
```

---

## 📦 Format Respons

Semua endpoint otomatis dibungkus dengan format standar:

**Sukses (200):**
```json
{
  "status": true,
  "creator": "sbyuxD",
  "result": { "date": "14/09/2026, 10.00.00" }
}
```

**Error (400/404/405/500):**
```json
{
  "status": false,
  "creator": "sbyuxD",
  "message": "Parameter 'query' wajib diisi (Kata kunci pencarian)"
}
```

---

## 📡 Fitur Plugin Tambahan

| Kunci | Fungsi | Contoh |
| :---- | :----- | :----- |
| `cache` | Cache hasil GET selama N detik | `cache: 60` |
| `timeout` | Batas waktu proses (ms), default 60000 | `timeout: 15000` |
| `params` | Schema kolom input + validasi | lihat di atas |

---

## 🎨 Konfigurasi Tampilan (`public/config.json`)

Semua teks, warna, font, dan konten landing page diambil dari **satu file konfigurasi** — `public/config.json`. Ubah tanpa menyentuh HTML.

**Bagian penting:**

| Kunci | Fungsi |
| :---- | :----- |
| `site.title` / `site.subtitle` | Nama website (judul tab, top bar) |
| `site.favText` | Emoji logo |
| `hero.*` | Kicker, judul besar, deskripsi, tombol hero |
| `stats[]` | Kartu statistik. `dynamic: "endpoints"` / `"categories"` terisi otomatis dari API; `value` untuk angka tetap |
| `features[]`, `steps[]` | Grid fitur & langkah |
| `cta.*` | Blok ajakan di akhir landing |
| `endpointPage.*` | Judul, subjudul, placeholder pencarian di halaman endpoint |
| `footerNote`, `creator` | Teks footer & kredit |
| `colors.*` | Palet warna (CSS variables): `bg`, `panel`, `ink`, `blue`, `blue-deep`, `line`, `shadow`, dll. |
| `fonts.*` | Font: `head`, `body`, `mono` |

Contoh ganti warna dominan:

```json
{
  "colors": { "bg": "#0b0b0e", "blue": "#66e0a0", "blue-deep": "#123824" }
}
```

Ganti font (stack CSS biasa):

```json
{
  "fonts": { "head": "\"Poppins\", system-ui, sans-serif" }
}
```

Jika `config.json` tidak ditemukan, halaman tetap jalan dengan default bawaan di dalam `index.html`.

---

## 🛠️ Helper Bawaan (`src/core.js`)

```js
import { safeFetch, getCache, setCache } from "../core.js";  // sesuaikan kedalaman folder
```

- `safeFetch(url, { headers }, timeoutMs)` — fetch dengan user-agent random + timeout anti-hang. Dipakai untuk scraping.
- `safeFetch`/`getCache`/`setCache` — cache manual per plugin.
- `CREATOR` — nama yang tampil di respons.

Contoh scraping sederhana:

```js
import { safeFetch } from "../core.js";

export default {
  name: "Cuaca",
  category: "info",
  description: "Cuaca kota (contoh scraping)",
  method: ["GET"],
  params: {
    city: { type: "string", required: true, description: "Nama kota" }
  },
  execute: async ({ query }) => {
    const res = await safeFetch(`https://wttr.in/${encodeURIComponent(query.city)}?format=j1`, {}, 15000);
    if (!res.ok) throw new Error("Gagal ambil data cuaca");
    const json = await res.json();
    return json.current_condition?.[0] || null;
  }
};
```

---

## 🔧 API Endpoint Penting

| Path | Fungsi |
| :--- | :----- |
| `GET /api/endpoints` | Daftar semua endpoint + schema untuk UI |
| `GET /:category/:plugin` | Jalankan endpoint (query parameter) |
| `POST /:category/:plugin` | Jalankan endpoint (JSON body) |
| *lainnya* | 404 |

---

## 📝 Catatan

- Hanya ketergantungan minimal: `express` dan `cors`. Scraping pakai `fetch` bawaan Node 18+.
- Nama plugin otomatis di-*lowercase* (spasi berubah jadi keluar route tidak aman — gunakan huruf kecil & tanda hubung).
- UI membaca `/api/endpoints`, jadi **form input & kartu mengikuti schema secara otomatis** — tidak ada file HTML yang perlu diubah saat menambah fitur.

---

<p align="center">Dibuat dengan ❤️ oleh <b>sbyuxD</b></p>