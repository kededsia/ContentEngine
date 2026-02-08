import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// DEFAULT VOICES that work on FREE tier with Indonesian via multilingual model
// These voices are expressive and work well with Indonesian text
const DEFAULT_VOICES = {
  // Male voices - expressive, works great with Indonesian
  male: {
    // Daniel - warm, authoritative, great for narration
    daniel: "onwK4e9ZLuTAKqWW03F9",
    // Brian - deep, professional
    brian: "nPczCjzI2devNBz1zQrb", 
    // George - warm, friendly
    george: "JBFqnCBsd6RMkjVDRZzb",
  },
  // Female voices
  female: {
    // Sarah - warm, expressive
    sarah: "EXAVITQu4vr4xnSDxMaL",
    // Jessica - clear, professional
    jessica: "cgSgspJ2msm6clMCkdW9",
    // Lily - warm, friendly
    lily: "pFZP5JQG7iQjIQuC4Bku",
  },
};

// EXPRESSIVE Voice settings per scene type untuk intonasi HIDUP & NATURAL
// Lower stability = MORE expressive & dynamic, NOT robotic
const VOICE_SETTINGS = {
  hook: {
    // HOOK: ENERGIK & MENARIK PERHATIAN - paling ekspresif
    stability: 0.15,        // Very low = sangat ekspresif, variasi tinggi
    similarity_boost: 0.6,  // Medium-low = lebih bebas berekspresi
    style: 0.85,            // Very high = maksimal style/emotion
    use_speaker_boost: true,
    speed: 1.08,            // Sedikit cepat untuk energi
  },
  body: {
    // BODY: INFORMATIF tapi tetap HIDUP - conversational Indonesia
    stability: 0.25,        // Low = ekspresif, seperti ngobrol
    similarity_boost: 0.65,
    style: 0.6,             // Medium-high expressiveness
    use_speaker_boost: true,
    speed: 0.95,            // Normal-slow untuk kejelasan
  },
  cta: {
    // CTA: PERSUASIF & HANGAT - ajakan yang tulus
    stability: 0.2,         // Low = warm, persuasive
    similarity_boost: 0.7,
    style: 0.75,            // High = emotional appeal
    use_speaker_boost: true,
    speed: 0.88,            // Lebih lambat untuk emphasis & urgency
  },
  default: {
    stability: 0.25,
    similarity_boost: 0.65,
    style: 0.6,
    use_speaker_boost: true,
    speed: 0.95,
  },
};

function preprocessIndonesianText(text: string): string {
  let processed = text;

  // Hapus markdown dan formatting
  processed = processed.replace(/\*\*/g, "");
  processed = processed.replace(/\*/g, "");
  processed = processed.replace(/#{1,6}\s/g, "");
  processed = processed.replace(/\[.*?\]/g, "");
  processed = processed.replace(/📸|🎥|📝|🎬|⏱️|🔊|💡|🏍️|✨|🔥|👇|⬇️|💰|🛒/g, "");

  // Konversi harga ke format ucapan Indonesia yang natural
  // Format: Rp X.XXX.XXX
  processed = processed.replace(/Rp\.?\s?(\d{1,3})\.(\d{3})\.(\d{3})/g, (_, m, t, r) => {
    const millions = parseInt(m);
    const thousands = parseInt(t);
    const remainder = parseInt(r);
    
    let result = "";
    if (millions === 1) result = "satu juta";
    else if (millions === 2) result = "dua juta";
    else result = `${millions} juta`;
    
    if (thousands > 0) {
      const thousandWords: Record<number, string> = {
        100: "seratus", 200: "dua ratus", 300: "tiga ratus", 400: "empat ratus",
        500: "lima ratus", 600: "enam ratus", 700: "tujuh ratus", 800: "delapan ratus", 900: "sembilan ratus"
      };
      const hundreds = Math.floor(thousands / 100) * 100;
      const tens = thousands % 100;
      
      if (hundreds > 0) result += ` ${thousandWords[hundreds] || hundreds}`;
      if (tens > 0) {
        if (tens < 10) result += ` ${["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"][tens]}`;
        else if (tens < 20) result += ` ${["sepuluh", "sebelas", "dua belas", "tiga belas", "empat belas", "lima belas", "enam belas", "tujuh belas", "delapan belas", "sembilan belas"][tens - 10]}`;
        else result += ` ${["", "", "dua puluh", "tiga puluh", "empat puluh", "lima puluh", "enam puluh", "tujuh puluh", "delapan puluh", "sembilan puluh"][Math.floor(tens / 10)]} ${tens % 10 > 0 ? ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"][tens % 10] : ""}`;
      }
      result += " ribu";
    }
    
    return result + " rupiah";
  });

  // Format sederhana: Rp X.XXX.XXX tanpa titik
  processed = processed.replace(/Rp\.?\s?1\.400\.000/g, "satu juta empat ratus ribu rupiah");
  processed = processed.replace(/Rp\.?\s?1\.390\.000/g, "satu juta tiga ratus sembilan puluh ribu rupiah");
  processed = processed.replace(/Rp\.?\s?1\.290\.000/g, "satu juta dua ratus sembilan puluh ribu rupiah");
  processed = processed.replace(/Rp\.?\s?1\.245\.000/g, "satu juta dua ratus empat puluh lima ribu rupiah");
  processed = processed.replace(/Rp\.?\s?1\.227\.000/g, "satu juta dua ratus dua puluh tujuh ribu rupiah");
  processed = processed.replace(/Rp\.?\s?1\.224\.000/g, "satu juta dua ratus dua puluh empat ribu rupiah");
  processed = processed.replace(/Rp\.?\s?1\.210\.000/g, "satu juta dua ratus sepuluh ribu rupiah");
  processed = processed.replace(/Rp\.?\s?1\.200\.000/g, "satu juta dua ratus ribu rupiah");

  // Konversi angka umum
  processed = processed.replace(/12\.000\+/g, "dua belas ribu lebih");
  processed = processed.replace(/6\.347/g, "enam ribu tiga ratus empat puluh tujuh");
  processed = processed.replace(/4\.9\/5/g, "empat koma sembilan dari lima");
  processed = processed.replace(/80\s?dB/g, "delapan puluh desibel");
  processed = processed.replace(/304/g, "tiga nol empat");

  // Natural pauses - LEBIH EKSPRESIF untuk Indonesia
  // Titik = pause panjang dengan intonasi turun
  processed = processed.replace(/\.\s+/g, "... ");
  // Koma = pause pendek natural
  processed = processed.replace(/,\s+/g, ", ");
  // Tanda seru = emphasis dengan pause
  processed = processed.replace(/!\s+/g, "!... ");
  // Tanda tanya = intonasi naik
  processed = processed.replace(/\?\s+/g, "?... ");
  
  // Tambah emphasis untuk kata-kata penting (UGC style)
  processed = processed.replace(/\b(KENSHI|Kenshi)\b/g, "Kenshiii");
  processed = processed.replace(/\b(mantap|Mantap|MANTAP)\b/gi, "mantaaap");
  processed = processed.replace(/\b(banget|Banget|BANGET)\b/gi, "bangeet");
  processed = processed.replace(/\b(gila|Gila|GILA)\b/gi, "gilaaa");
  processed = processed.replace(/\b(keren|Keren|KEREN)\b/gi, "kereen");
  processed = processed.replace(/\b(wow|Wow|WOW)\b/gi, "wooow");

  // Singkatan yang harus dieja
  processed = processed.replace(/\bPNP\b/g, "P N P");
  processed = processed.replace(/\bSS\b/g, "S S");
  processed = processed.replace(/\bPCX\b/g, "P C X");
  processed = processed.replace(/\bNMAX\b/g, "N MAX");
  processed = processed.replace(/\bADV\b/g, "A D V");
  processed = processed.replace(/\bUGC\b/g, "U G C");

  return processed.trim();
}

function detectSceneType(text: string): keyof typeof VOICE_SETTINGS {
  const lowerText = text.toLowerCase();
  
  // Detect HOOK - pembuka, attention grabber
  if (lowerText.includes("hook") || lowerText.includes("pembuka") ||
      lowerText.includes("scene 1") || lowerText.includes("opening")) {
    return "hook";
  }
  
  // Detect CTA - call to action, closing
  if (lowerText.includes("cta") || lowerText.includes("klik") || 
      lowerText.includes("order") || lowerText.includes("beli") || 
      lowerText.includes("cek link") || lowerText.includes("langsung") ||
      lowerText.includes("penutup") || lowerText.includes("closing") ||
      lowerText.includes("checkout") || lowerText.includes("grab")) {
    return "cta";
  }
  
  // Detect BODY - isi, penjelasan
  if (lowerText.includes("body") || lowerText.includes("isi") ||
      lowerText.includes("scene 2") || lowerText.includes("scene 3")) {
    return "body";
  }
  
  return "default";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceGender = "male", sceneType } = await req.json();

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    // Detect scene type for appropriate intonation
    const detectedSceneType = sceneType || detectSceneType(text);
    const voiceSettings = VOICE_SETTINGS[detectedSceneType] || VOICE_SETTINGS.default;
    
    // Select voice based on gender - using DEFAULT voices (free tier compatible)
    let voiceId: string;
    if (voiceGender === "female") {
      // Sarah - warm, expressive, works great with Indonesian
      voiceId = DEFAULT_VOICES.female.sarah;
    } else {
      // Daniel - warm, authoritative, excellent for Indonesian narration
      voiceId = DEFAULT_VOICES.male.daniel;
    }

    // Preprocess untuk Indonesian natural & expressive
    const processedText = preprocessIndonesianText(text);

    console.log("Generating Indonesian TTS with DEFAULT voice:", {
      originalLength: text.length,
      processedLength: processedText.length,
      sceneType: detectedSceneType,
      voiceId,
      voiceGender,
      settings: voiceSettings,
    });

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: processedText,
          model_id: "eleven_multilingual_v2", // Best for Indonesian native
          voice_settings: {
            stability: voiceSettings.stability,
            similarity_boost: voiceSettings.similarity_boost,
            style: voiceSettings.style,
            use_speaker_boost: voiceSettings.use_speaker_boost,
          },
          // Apply speed via generation config
          generation_config: {
            chunk_length_schedule: [120, 160, 250, 290],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs error:", response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = base64Encode(audioBuffer);

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        sceneType: detectedSceneType,
        voiceId,
        duration: Math.round(audioBuffer.byteLength / 16000), // Rough estimate
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("TTS error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
