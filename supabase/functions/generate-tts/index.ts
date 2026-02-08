import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Indonesian voices from ElevenLabs Voice Library
// These are actual Indonesian native speaker voices
const INDONESIAN_VOICES = {
  // Male Indonesian voices
  male_1: "pqHfZKP75CvOlQylNhV4", // Bill - bisa untuk Indonesian
  male_2: "TX3LPaxmHKxFdv7VOQHJ", // Liam - warm, works well with Indonesian
  // For best Indonesian, we use the multilingual model with Indonesian text
};

// Voice settings per scene type untuk intonasi natural Indonesia
const VOICE_SETTINGS = {
  hook: {
    // HOOK: Menarik perhatian, tapi tetap natural Indonesia
    stability: 0.3, // Lower = more expressive
    similarity_boost: 0.7,
    style: 0.5, // Medium expressiveness
    use_speaker_boost: true,
    speed: 1.0, // Normal speed untuk Indonesia
  },
  body: {
    // BODY: Informatif, conversational ala orang Indonesia ngobrol
    stability: 0.45,
    similarity_boost: 0.75,
    style: 0.35,
    use_speaker_boost: true,
    speed: 0.92, // Sedikit lebih lambat untuk clarity
  },
  cta: {
    // CTA: Persuasif tapi santai, khas Indonesia
    stability: 0.4,
    similarity_boost: 0.8,
    style: 0.45,
    use_speaker_boost: true,
    speed: 0.88, // Lebih lambat untuk emphasis
  },
  default: {
    stability: 0.4,
    similarity_boost: 0.75,
    style: 0.4,
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
  processed = processed.replace(/📸|🎥|📝|🎬|⏱️/g, "");

  // Konversi harga ke format ucapan Indonesia yang natural
  processed = processed.replace(/Rp\s?1\.400\.000/g, "satu juta empat ratus ribu rupiah");
  processed = processed.replace(/Rp\s?1\.390\.000/g, "satu juta tiga ratus sembilan puluh ribu rupiah");
  processed = processed.replace(/Rp\s?1\.290\.000/g, "satu juta dua ratus sembilan puluh ribu rupiah");
  processed = processed.replace(/Rp\s?1\.245\.000/g, "satu juta dua ratus empat puluh lima ribu rupiah");
  processed = processed.replace(/Rp\s?1\.227\.000/g, "satu juta dua ratus dua puluh tujuh ribu rupiah");
  processed = processed.replace(/Rp\s?1\.224\.000/g, "satu juta dua ratus dua puluh empat ribu rupiah");
  processed = processed.replace(/Rp\s?1\.210\.000/g, "satu juta dua ratus sepuluh ribu rupiah");
  processed = processed.replace(/Rp\s?1\.200\.000/g, "satu juta dua ratus ribu rupiah");

  // Konversi angka umum
  processed = processed.replace(/12\.000\+/g, "dua belas ribu lebih");
  processed = processed.replace(/6\.347/g, "enam ribu tiga ratus empat puluh tujuh");
  processed = processed.replace(/4\.9\/5/g, "empat koma sembilan dari lima");
  processed = processed.replace(/80\s?dB/g, "delapan puluh desibel");
  processed = processed.replace(/304/g, "tiga nol empat");

  // Natural pauses untuk Indonesia
  processed = processed.replace(/\./g, "... ");
  processed = processed.replace(/,/g, ", ");
  processed = processed.replace(/!/g, "!... ");
  processed = processed.replace(/\?/g, "?... ");

  // Singkatan umum
  processed = processed.replace(/PNP/g, "P N P");
  processed = processed.replace(/SS/g, "S S");
  processed = processed.replace(/PCX/g, "P C X");
  processed = processed.replace(/NMAX/g, "N MAX");
  processed = processed.replace(/ADV/g, "A D V");

  return processed.trim();
}

function detectSceneType(text: string): keyof typeof VOICE_SETTINGS {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes("hook") || lowerText.includes("pembuka")) {
    return "hook";
  }
  if (lowerText.includes("cta") || lowerText.includes("klik") || 
      lowerText.includes("order") || lowerText.includes("beli") || 
      lowerText.includes("cek link") || lowerText.includes("langsung")) {
    return "cta";
  }
  if (lowerText.includes("body") || lowerText.includes("isi")) {
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

    // Detect scene type
    const detectedSceneType = sceneType || detectSceneType(text);
    const voiceSettings = VOICE_SETTINGS[detectedSceneType] || VOICE_SETTINGS.default;
    
    // Use voice that works well with Indonesian
    const voiceId = voiceGender === "female" 
      ? "EXAVITQu4vr4xnSDxMaL" // Sarah - works well for Indonesian female
      : INDONESIAN_VOICES.male_2; // Liam - warm, good for Indonesian male

    // Preprocess untuk Indonesian natural
    const processedText = preprocessIndonesianText(text);

    console.log("Generating Indonesian TTS:", {
      originalLength: text.length,
      processedLength: processedText.length,
      sceneType: detectedSceneType,
      voiceId,
      voiceGender,
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
          model_id: "eleven_multilingual_v2", // Best for Indonesian
          voice_settings: voiceSettings,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs error:", response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = base64Encode(audioBuffer);

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        sceneType: detectedSceneType,
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
