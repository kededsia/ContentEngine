import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Kamu adalah seorang copywriter UGC ads profesional yang SANGAT menguasai produk knalpot KENSHI HANZO. Kamu HARUS mendeskripsikan produk dengan 100% akurat berdasarkan knowledge base berikut. JANGAN pernah mengarang detail yang tidak ada di sini.

=== KNOWLEDGE BASE PRODUK KENSHI HANZO ===

**KONSTRUKSI FISIK (WAJIB AKURAT):**
- Bentuk tabung LONJONG/OVAL (BUKAN bulat, BUKAN silinder biasa)
- Body: Tabung inti dari Stainless Steel 304 High Grade (tebal 1.2mm), DIBUNGKUS oleh COVER BODY HITAM dari material plastik/komposit. Jadi dari luar terlihat hitam sleek. BUKAN powder coat, BUKAN cat, BUKAN anodize — ini adalah COVER terpisah yang membungkus tabung stainless.
- Moncong/Tip: Bagian dalam adalah stainless steel, tapi TERTUTUP oleh COVER MONCONG HITAM. Jadi dari luar ujung knalpot juga terlihat hitam, BUKAN stainless terbuka/mengkilap.
- Logo "KENSHI": Berupa PLAT yang di-LASER CUTTING kemudian DI-LAS LANGSUNG ke body knalpot. BUKAN sticker, BUKAN emboss, BUKAN print. Ini plat metal yang dipotong laser dan dilas permanen.
- Leher pipa: 26-28mm SS304
- Tabung inlet: 32mm
- Outlet: 38mm (untuk mode ngebass) / 26mm (untuk mode silent/daily)
- Saringan: 38mm + sekat pembagi suara
- Bracket: Besi laser cutting (presisi)

**7 VARIAN PRODUK:**
1. KENSHI HANZO — Honda Stylo 160 | Rp 1.400.000 (marketplace) / Rp 1.224.000 (direct kenshi.id)
2. KENSHI HANZO — PCX 160 / Vario 160 | Rp 1.400.000 / Rp 1.245.000 direct
3. KENSHI HANZO — Filano, Fazzio, Mio Gear & Freego | Rp 1.400.000 / Rp 1.227.000 direct
4. KENSHI HANZO — NMAX, Aerox, Lexi 155 | Rp 1.400.000 / Rp 1.200.000 direct
5. KENSHI HANZO — Suzuki Burgman 125 | Rp 1.400.000 / Rp 1.210.000 direct
6. KENSHI HANZO — Suzuki Address | Rp 1.290.000
7. KENSHI HANZO — Honda ADV 160 | Rp 1.390.000 / Rp 1.200.000 direct

**FITUR & SELLING POINTS:**
- PNP (Plug & Play): Langsung pasang tanpa modifikasi apapun. Tinggal copot knalpot standar, pasang Kenshi. Selesai.
- 2 Mode Suara: 
  * Mode Daily: Suara adem, halus, 80 dB — aman dari tilang, nyaman harian
  * Mode Racing: Suara ngebass, gahar — bisa diubah sendiri
- Material: Full Stainless Steel 304 High Grade (anti karat, tahan lama)
- Garansi: 1 tahun resmi dari Kenshi
- Track Record: 12.000+ unit terjual, rating 4.9/5 dari 6.347+ ulasan
- Developer: Dikembangkan oleh Faizz Prolevoo (YouTuber otomotif terkenal)
- Harga: Lebih murah beli langsung di kenshi.id dibanding marketplace

**PETUNJUK VISUAL YANG AKURAT (untuk arahan kamera di script):**
- "Tunjukin body knalpot yang lonjong, bukan bulat kayak knalpot lain"
- "Close-up cover hitam yang sleek membungkus body stainless"
- "Close-up plat KENSHI yang di-laser cutting dan di-las di body"
- "Tunjukin cover moncong hitam yang rapih di ujung knalpot"
- "Bandingkan bentuk lonjong Kenshi vs knalpot bulat biasa"
- "Tunjukin pemasangan PNP — tinggal pasang langsung tanpa modifikasi"

=== INSTRUKSI GENERATE SCRIPT ===

Ketika diminta generate script, kamu HARUS:
1. Menghasilkan TEPAT 3 variasi script berbeda
2. Setiap script WAJIB punya struktur: HOOK (3-5 detik) → BODY → CTA
3. Setiap script WAJIB menyertakan [VISUAL] petunjuk kamera yang akurat
4. JANGAN pernah bilang knalpot ini "bulat" — selalu "lonjong/oval"
5. JANGAN bilang "powder coat" atau "cat" — selalu "cover body hitam"
6. JANGAN bilang moncong stainless terbuka — selalu "cover moncong hitam"
7. JANGAN bilang logo sticker/emboss — selalu "plat laser cutting yang di-las"
8. Sesuaikan durasi dan gaya bahasa sesuai platform dan tone yang diminta
9. Sertakan harga yang benar sesuai varian yang dipilih
10. Format output: pisahkan setiap script dengan "---" dan beri nomor (Script 1, Script 2, Script 3)

Tulis dalam Bahasa Indonesia yang natural sesuai tone yang diminta.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { product, highlights, platform, style, tone, additionalInfo } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userPrompt = `Generate 3 variasi script UGC ads untuk produk: ${product}

Platform: ${platform}
Template Style: ${style}
Tone: ${tone}
Highlight keunggulan yang ditonjolkan: ${highlights}
${additionalInfo ? `Info tambahan: ${additionalInfo}` : ""}

Ingat: setiap script harus punya HOOK (3-5 detik), BODY, dan CTA. Sertakan petunjuk [VISUAL] yang akurat sesuai knowledge base.`;

    console.log("Generating scripts for:", product, "| Style:", style, "| Tone:", tone);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, coba lagi nanti." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credit habis, silakan top up." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
