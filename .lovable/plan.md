

# 🎬 Kenshi Exhaust UGC Script Generator

Tool personal berbasis AI untuk menghasilkan script UGC ads knalpot Kenshi yang akurat — dengan detail produk yang benar.

## Fondasi: Product Knowledge Base (Akurat)

AI akan memiliki pengetahuan lengkap tentang produk Kenshi yang ditanam di system prompt edge function:

**Konstruksi Fisik Kenshi Hanzo (WAJIB BENAR):**
- Bentuk tabung **lonjong/oval** (BUKAN bulat)
- Body: Tabung stainless steel 304 (tebal 1.2mm) **dibungkus cover body hitam** (material plastik/komposit) — bukan powder coat, bukan cat
- Moncong/tip: Stainless steel **tertutup cover moncong hitam** — jadi dari luar terlihat hitam, bukan stainless terbuka
- Logo "KENSHI" berupa **plat laser cutting yang di-las langsung** ke body knalpot — bukan sticker, bukan emboss
- Material inti full Stainless Steel 304 High Grade
- Leher 26-28mm SS304, inlet 32mm, outlet 38mm (ngebass) / 26mm (silent)
- Saringan 38mm + sekat, bracket besi laser cutting

**7 Varian Produk:**
- KENSHI HANZO — Honda Stylo 160 (Rp 1.400.000 / Rp 1.224.000 direct)
- KENSHI HANZO — PCX 160 / Vario 160 (Rp 1.400.000 / Rp 1.245.000 direct)
- KENSHI HANZO — Filano, Fazzio, Mio Gear & Freego (Rp 1.400.000 / Rp 1.227.000 direct)
- KENSHI HANZO — NMAX, Aerox, Lexi 155 (Rp 1.400.000 / Rp 1.200.000 direct)
- KENSHI HANZO — Suzuki Burgman 125 (Rp 1.400.000 / Rp 1.210.000 direct)
- KENSHI HANZO — Suzuki Address (Rp 1.290.000)
- KENSHI HANZO — Honda ADV 160 (Rp 1.390.000 / Rp 1.200.000 direct)

**Fitur & Selling Points:**
- PNP Plug & Play (langsung pasang tanpa modifikasi)
- 2 Mode suara: Daily (adem, 80 dB, anti tilang) & Racing (ngebass)
- Garansi 1 tahun, 12rb+ unit terjual, rating 4.9/5 (6.347 ulasan)
- Dikembangkan oleh Faizz Prolevoo (YouTuber otomotif)
- Harga lebih murah di website langsung vs marketplace

## Halaman Utama — Script Generator

### Panel Input
- **Pilih Produk** — Dropdown 7 varian Kenshi Hanzo (termasuk info motor yang kompatibel)
- **Highlight Keunggulan** — Checklist fitur yang mau ditonjolkan: suara ngebass, PNP, anti tilang, full SS304, cover premium, garansi 1 tahun, harga terjangkau, plat logo laser cutting
- **Target Platform** — TikTok/Reels atau Facebook/Instagram Feed
- **Template Style** — 6 framework UGC:
  - 🪝 Hook-Body-CTA
  - 😱 Problem-Agitate-Solution
  - 🔄 Before-After
  - ⭐ Testimoni/Review Style
  - 📦 Unboxing/First Impression
  - 🏍️ Riding Demo / Sound Test
- **Tone** — Santai/Gaul, Excited/Hype, Informatif, Provokatif
- **Info Tambahan** — Text area opsional (promo, konteks khusus)

### Panel Output
- **3 variasi script** dihasilkan AI sekaligus
- Setiap script terstruktur: **HOOK** (3-5 detik) → **BODY** → **CTA**
- Termasuk **petunjuk visual/kamera** yang akurat (misal: "close-up plat laser cutting KENSHI di body", "tunjukin cover hitam yang sleek", dll.)
- AI akan mendeskripsikan knalpot dengan benar: cover hitam, bentuk lonjong, logo plat las
- Tombol **Copy**, **Generate Ulang**, dan **Simpan ke Favorit**

## Halaman Koleksi Script

- Semua script favorit tersimpan di local storage (personal use)
- Filter berdasarkan produk, style, dan platform
- Bisa hapus atau edit script

## Desain & Tampilan

- Tema gelap dengan aksen merah (racing vibes, sesuai branding Kenshi)
- Mobile-friendly untuk dipakai saat mau syuting konten
- Card-based layout untuk setiap script

## Backend

- Lovable AI (via Supabase Edge Function) dengan system prompt berisi seluruh knowledge base produk Kenshi yang sudah dikoreksi
- Local storage untuk simpan script favorit

