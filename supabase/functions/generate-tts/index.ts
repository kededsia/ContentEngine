import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Voice settings per scene type untuk intonasi yang tepat
const VOICE_SETTINGS = {
  hook: {
    // HOOK: Energik, attention-grabbing, sedikit dramatis
    stability: 0.35,
    similarity_boost: 0.75,
    style: 0.6,
    use_speaker_boost: true,
    speed: 1.05,
  },
  body: {
    // BODY: Informatif, conversational, percaya diri tapi santai
    stability: 0.5,
    similarity_boost: 0.8,
    style: 0.4,
    use_speaker_boost: true,
    speed: 0.95,
  },
  cta: {
    // CTA: Persuasif, warm, encouraging
    stability: 0.45,
    similarity_boost: 0.85,
    style: 0.5,
    use_speaker_boost: true,
    speed: 0.9,
  },
  default: {
    stability: 0.4,
    similarity_boost: 0.8,
    style: 0.45,
    use_speaker_boost: true,
    speed: 0.95,
  },
};

// Voices yang bagus untuk Indonesian natural speech
const VOICES = {
  male_mature: "TX3LPaxmHKxFdv7VOQHJ", // Liam - warm, mature, natural
  male_friendly: "pNInz6obpgDQGcFmaJgB", // Adam - friendly, conversational
  female_warm: "EXAVITQu4vr4xnSDxMaL", // Sarah - warm, natural
};

function preprocessTextForNaturalIndonesian(text: string): string {
  let processed = text;

  // Tambah jeda natural untuk koma dan titik
  processed = processed.replace(/\./g, "...");
  processed = processed.replace(/,/g, ", ");
  
  // Tambah emphasis untuk kata-kata penting (ALL CAPS di script)
  processed = processed.replace(/\b([A-Z]{2,})\b/g, (match) => {
    return match.toLowerCase(); // Normalize caps tapi tetap preserve meaning
  });

  // Hapus markdown formatting
  processed = processed.replace(/\*\*/g, "");
  processed = processed.replace(/\*/g, "");
  processed = processed.replace(/#{1,6}\s/g, "");
  processed = processed.replace(/\[.*?\]/g, "");
  
  // Tambah jeda untuk angka harga (biar dibaca natural)
  processed = processed.replace(/Rp\s?(\d+)\.(\d+)\.(\d+)/g, "Rp $1 juta $2 ratus $3 ribu");
  processed = processed.replace(/Rp\s?(\d+)\.(\d+)/g, (_, millions, thousands) => {
    if (millions === "1" && thousands.startsWith("2") || thousands.startsWith("3") || thousands.startsWith("4")) {
      return `Rp satu juta ${thousands} ribu`;
    }
    return `Rp ${millions} juta ${thousands} ribu`;
  });

  // Natural pause untuk tanda seru dan tanya
  processed = processed.replace(/!/g, "!...");
  processed = processed.replace(/\?/g, "?...");

  return processed.trim();
}

function detectSceneType(text: string): keyof typeof VOICE_SETTINGS {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes("[hook") || lowerText.includes("hook:")) {
    return "hook";
  }
  if (lowerText.includes("[cta") || lowerText.includes("cta:") || 
      lowerText.includes("klik") || lowerText.includes("order") || 
      lowerText.includes("beli sekarang") || lowerText.includes("link")) {
    return "cta";
  }
  if (lowerText.includes("[body") || lowerText.includes("body:")) {
    return "body";
  }
  
  return "default";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceType = "male_mature", sceneType } = await req.json();

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    // Detect scene type if not provided
    const detectedSceneType = sceneType || detectSceneType(text);
    const voiceSettings = VOICE_SETTINGS[detectedSceneType] || VOICE_SETTINGS.default;
    const voiceId = VOICES[voiceType as keyof typeof VOICES] || VOICES.male_mature;

    // Preprocess text untuk Indonesian yang natural
    const processedText = preprocessTextForNaturalIndonesian(text);

    console.log("Generating TTS:", {
      originalLength: text.length,
      processedLength: processedText.length,
      sceneType: detectedSceneType,
      voiceId,
      voiceSettings,
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
          model_id: "eleven_multilingual_v2", // Terbaik untuk Indonesian
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
