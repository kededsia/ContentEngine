export const KENSHI_PRODUCTS = [
  {
    id: "stylo-160",
    name: "KENSHI HANZO — Honda Stylo 160",
    motor: "Honda Stylo 160",
    price: "Rp 1.400.000",
    directPrice: "Rp 1.224.000",
  },
  {
    id: "pcx-vario",
    name: "KENSHI HANZO — PCX 160 / Vario 160",
    motor: "Honda PCX 160, Honda Vario 160",
    price: "Rp 1.400.000",
    directPrice: "Rp 1.245.000",
  },
  {
    id: "yamaha-matic",
    name: "KENSHI HANZO — Filano, Fazzio, Mio Gear & Freego",
    motor: "Yamaha Filano, Yamaha Fazzio, Yamaha Mio Gear, Yamaha Freego",
    price: "Rp 1.400.000",
    directPrice: "Rp 1.227.000",
  },
  {
    id: "nmax-aerox",
    name: "KENSHI HANZO — NMAX, Aerox, Lexi 155",
    motor: "Yamaha NMAX, Yamaha Aerox, Yamaha Lexi 155",
    price: "Rp 1.400.000",
    directPrice: "Rp 1.200.000",
  },
  {
    id: "burgman",
    name: "KENSHI HANZO — Suzuki Burgman 125",
    motor: "Suzuki Burgman 125",
    price: "Rp 1.400.000",
    directPrice: "Rp 1.210.000",
  },
  {
    id: "address",
    name: "KENSHI HANZO — Suzuki Address",
    motor: "Suzuki Address",
    price: "Rp 1.290.000",
    directPrice: null,
  },
  {
    id: "adv-160",
    name: "KENSHI HANZO — Honda ADV 160",
    motor: "Honda ADV 160",
    price: "Rp 1.390.000",
    directPrice: "Rp 1.200.000",
  },
];

export const HIGHLIGHTS = [
  { id: "ngebass", label: "Suara Ngebass" },
  { id: "pnp", label: "PNP (Plug & Play)" },
  { id: "anti-tilang", label: "Anti Tilang (80 dB)" },
  { id: "ss304", label: "Full Stainless Steel 304" },
  { id: "cover-premium", label: "Cover Body Premium" },
  { id: "garansi", label: "Garansi 1 Tahun" },
  { id: "harga", label: "Harga Terjangkau" },
  { id: "laser-cutting", label: "Plat Logo Laser Cutting" },
];

export const PLATFORMS = [
  { id: "tiktok", label: "TikTok / Reels" },
  { id: "facebook", label: "Facebook / Instagram Feed" },
];

export const TEMPLATE_STYLES = [
  { id: "hook-body-cta", label: "🪝 Hook-Body-CTA", desc: "Format klasik: hook kuat → isi → ajakan" },
  { id: "pas", label: "😱 Problem-Agitate-Solution", desc: "Angkat masalah, dramatisir, kasih solusi" },
  { id: "before-after", label: "🔄 Before-After", desc: "Perbandingan sebelum & sesudah pasang" },
  { id: "testimoni", label: "⭐ Testimoni/Review Style", desc: "Gaya review jujur dari pengguna" },
  { id: "unboxing", label: "📦 Unboxing/First Impression", desc: "Kesan pertama buka paket & pasang" },
  { id: "riding-demo", label: "🏍️ Riding Demo / Sound Test", desc: "Demo suara & riding di jalan" },
];

export const TONES = [
  { id: "santai", label: "Santai / Gaul" },
  { id: "hype", label: "Excited / Hype" },
  { id: "informatif", label: "Informatif" },
  { id: "provokatif", label: "Provokatif" },
];

export interface SavedScript {
  id: string;
  productId: string;
  productName: string;
  platform: string;
  style: string;
  tone: string;
  scripts: string[];
  createdAt: string;
}
