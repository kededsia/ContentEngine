import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Detail produk Kenshi yang WAJIB ada di setiap image
const KENSHI_PRODUCT_DETAILS = `
The Kenshi Hanzo exhaust must be depicted with these EXACT specifications:
- Shape: OVAL/OBLONG tube shape (NOT round, NOT cylindrical)
- Body: Completely wrapped in MATTE BLACK plastic/composite body cover (no visible stainless steel)
- Tip: BLACK tip cover on the exhaust outlet (not chrome, not exposed stainless)
- Logo: A RAISED LASER-CUT SILVER METAL "KENSHI" LOGO PLATE that is WELDED onto the body (not a sticker, not printed, not embossed - it's an actual metal plate)
- Overall look: Sleek, modern, premium, all-black with subtle silver logo accent
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, aspectRatio = "9:16", motorType = "" } = await req.json();

    // Menggunakan API dari apifree.ai
    const APIFREE_API_KEY = Deno.env.get("APIFREE_API_KEY");
    if (!APIFREE_API_KEY) {
      throw new Error("APIFREE_API_KEY is not configured");
    }

    // Check if prompt mentions exhaust/knalpot
    const mentionsExhaust = /exhaust|knalpot|kenshi/i.test(prompt);

    // Enhanced prompt dengan detail produk yang akurat
    const enhancedPrompt = mentionsExhaust 
      ? `${prompt}

CRITICAL PRODUCT ACCURACY REQUIREMENTS:
${KENSHI_PRODUCT_DETAILS}

Additional requirements:
- The exhaust must be clearly visible in the image
- The oval/oblong shape must be distinguishable (not round)
- The matte black finish must be apparent
- The silver laser-cut logo plate should be visible if the angle allows
${motorType ? `- The motorcycle is a ${motorType}` : ""}

Photography style:
- Authentic smartphone UGC photo quality
- Natural lighting with warm tones
- NOT CGI, NOT 3D render, NOT illustration
- Realistic Indonesian setting
- Aspect ratio: ${aspectRatio}
- High resolution but with natural smartphone grain`
      : `${prompt}

Photography style:
- Authentic smartphone UGC photo quality
- Natural lighting with warm tones
- NOT CGI, NOT 3D render, NOT illustration
- Realistic Indonesian setting
- Aspect ratio: ${aspectRatio}
- High resolution but with natural smartphone grain`;

    console.log("Generating image:", {
      hasExhaust: mentionsExhaust,
      aspectRatio,
      promptLength: enhancedPrompt.length,
    });

    // Menggunakan DALL-E 3 via apifree.ai untuk image generation
    const response = await fetch("https://api.apifree.ai/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${APIFREE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size: aspectRatio === "9:16" ? "1024x1792" : aspectRatio === "16:9" ? "1792x1024" : "1024x1024",
        quality: "standard",
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, coba lagi nanti." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401 || response.status === 403) {
        return new Response(JSON.stringify({ error: "API key invalid atau expired." }), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("Image generation error:", response.status, text);
      throw new Error(`Image generation failed: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;

    if (!imageUrl) {
      throw new Error("No image generated");
    }

    return new Response(
      JSON.stringify({ imageUrl }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("Image generation error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
