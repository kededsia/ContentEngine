const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Load Dictionary
const dictionaryPath = path.join(__dirname, 'data', 'dictionary.json');
let dictionary = {};

try {
    const data = fs.readFileSync(dictionaryPath, 'utf8');
    dictionary = JSON.parse(data);
    console.log("✅ Dictionary loaded successfully.");
} catch (err) {
    console.error("❌ Error loading dictionary:", err);
}

// Banned phrases that indicate "Chat Mode"
const BANNED_PHRASES = [
    "Understood", "I understand", "Here is the", "Sure,", "Okay,", "I am ready",
    "I'll start", "Siap,", "Tentu,", "Baik,", "Mengerti", "Here's a", "Generating",
    "Acknowledged", "remain concise", "focus strictly", "What's the mission",
    "I will begin", "I have analyzed", "I will now", "explore the project", "examine the", "project files",
    "preferred persona", "project structure", "first command"
];

// Helper to clean output
const cleanOutput = (text) => {
    let clean = text.trim();

    // Remove "Thinking" blocks if any
    clean = clean.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

    // Aggressive cleaning of "I'll..." "I will..." lines
    const lines = clean.split('\n');
    const filteredLines = lines.filter(line => {
        const lower = line.toLowerCase().trim();
        // Remove lines starting with banned phrases
        if (BANNED_PHRASES.some(phrase => lower.startsWith(phrase.toLowerCase()))) return false;
        // Remove lines that look like agent planning
        if (lower.startsWith("i'll ") || lower.startsWith("i will ") || lower.startsWith("i am ") || lower.startsWith("i have ")) return false;
        return true;
    });

    clean = filteredLines.join('\n').trim();

    // If it doesn't start with a header, find the first header
    const firstHeader = clean.indexOf('## ');
    if (firstHeader > 0) {
        clean = clean.substring(firstHeader);
    }

    return clean;
};

const TASK_VALIDATORS = {
    Script: (cleaned) => cleaned.includes('## Script 1') && cleaned.length >= 100,
    Story: (cleaned) => cleaned.includes('## Story 1') && cleaned.length >= 100,
    Research: (cleaned) => /(^|\n)\s*\d+\./.test(cleaned) && cleaned.length >= 40,
    DirectorPlan: (cleaned) => cleaned.includes('## Director Plan') && cleaned.includes('### Timeline') && cleaned.length >= 300,
    RemotionSkill: (cleaned) => cleaned.includes('## Remotion Skill Pack') && cleaned.includes('```json') && cleaned.length >= 400,
    Content: (cleaned) => cleaned.length >= 80
};

// Helper to run Gemini with retries using spawn for safer arg handling
const runGemini = (prompt, taskType = 'Content', retries = 1) => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        console.log(`[Gemini] Spawning process for ${taskType}... (Retries left: ${retries})`);

        // Avoid shell wrapping overhead on Unix for lower latency.
        // Keep shell only on Windows for command resolution compatibility.
        const child = spawn('gemini', ['prompt', prompt], { shell: process.platform === 'win32' });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdout += chunk;
            process.stdout.write(chunk); // Stream to console
        });

        child.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            // process.stderr.write(chunk); // Optional: stream stderr too
        });

        child.on('error', (err) => {
            console.error(`[Gemini Spawn Error]`, err);
            reject(err);
        });

        child.on('close', (code) => {
            const durationMs = Date.now() - startTime;
            console.log(`[Gemini] ${taskType} finished in ${durationMs}ms (exit: ${code})`);
            if (code !== 0) {
                console.error(`[Gemini Error] Exit Code: ${code}, Stderr: ${stderr}`);
                // If it failed with code 1, it might be the CLI failing.
                // We reject, which sends 500 error to client.
                return reject(new Error(stderr || `Gemini exited with code ${code}`));
            }

            let output = stdout.trim();


            const cleaned = cleanOutput(output);

            // Re-check banned phrases only on CLEANED text to see if any slipped through
            const hasBanned = BANNED_PHRASES.some(phrase => {
                return cleaned.toLowerCase().includes(phrase.toLowerCase());
            });

            const isValid = (TASK_VALIDATORS[taskType] || TASK_VALIDATORS.Content)(cleaned);

            if ((!isValid || hasBanned) && retries > 0) {
                const startMarker = taskType === 'Research' ? '1.' : `## ${taskType} 1`;
                const retryPrompt = `PREVIOUS OUTPUT WAS CHATTY OR INVALID. STOP CHATTING. CONTINUE GENERATING THE ${taskType.toUpperCase()} FROM "${startMarker}". JUST THE CONTENT. \n\n${prompt}`;
                return runGemini(retryPrompt, taskType, retries - 1).then(resolve).catch(reject);
            }

            resolve(cleaned || output);
        });
    });
};

app.post('/api/generate-script', async (req, res) => {
    console.log(`[API] POST /api/generate-script triggered`);
    const { product, highlights, platform, additionalInfo = '' } = req.body;

    // Construct dynamic specs string
    const specs = dictionary.kenshi_specs || {};
    const styles = dictionary.gtts_styles || {};

    // Construct dynamic specs string
    const specsText = `
    - Material: ${specs.material}
    - Thickness: ${specs.thickness}
    - Sound: ${specs.sound_character}
    - Features: ${specs.features?.join(", ")}
    `;

    let prompt = `ROLE: You are an elite direct-response copywriter for motorcycles (Anak Motor).
CONTEXT: You have ALREADY analyzed the product. You do NOT need to read files. You do NOT need to plan.
GOAL: Output the final video script text immediately.
TASK: Write 3 VARIATIONS of a 60-second video script for TikTok/Reels.
PRODUCT: ${product}
TECHNICAL SPECS (MUST USE): ${specsText}
HIGHLIGHTS: ${highlights}
PLATFORM: ${platform}
TARGET AUDIENCE: Indonesian bikers (slang, casual, brotherhood vibes).
REFERENCE VIDEO NOTES (OPTIONAL, from uploaded-video analysis): ${additionalInfo || 'N/A'}

MANDATORY RULES for EACH VARIATION:
1. QUANTITY: Generate 3 DIFFERENT VARIATIONS.
2. HOOK: "SHOCK HOOK" (Max 5-6 words). High impact. EXPLOSIVE.
3. WORD COUNT: MAX 80 WORDS per variation (Strict for 30-35s duration).
4. CONTENT: 
   - Compare ${product} vs Competitors.
   - USE THE SPECS: Mention "${specs.material}" or "${specs.sound_character}".
5. FORMAT:
   - START with "## Script [Number]"
   - KOMPOSISI KONTEN WAJIB (per script):
     * 40% DRAMA/EMOSI (pain, konflik, tension yang relatable)
     * 20% PROSES MASUK / TRANSISI SOLUSI (alur dari problem ke solusi produk)
     * 40% PENERANGAN PRODUK (fitur, benefit, bukti, value)
   - THEN "### 📝 NARRATIVE (GTTS)" (Just the spoken text, minimal punctuation for natural flow).
   - **IMPORTANT**: The Narrative MUST START with the Hook phrase.
   - **STRICT DURATION**: Total text must NOT exceed 80 words.
   - INSIDE NARRATIVE: Use [tag expresi: mood] tags FREQUENTLY (e.g. at the start of every sentence/phrase).
   - START NARRATIVE with Style Instruction: "di baca dengan nada [STYLE] ala video short dengan dialek [DIALECT] yang medok." (Adapt STYLE and DIALECT to the requested ones).
   - THEN "### 🎬 SCENE BREAKDOWN" (Visuals + Audio).
   - SCENE BREAKDOWN MUST be director/remotion-ready with precise timeline:
     * Use 0.5-second granularity (example: 00:00.0-00:00.5, 00:00.5-00:01.0).
     * Include every important micro-moment even if only 0.5 second.
     * For EACH scene/micro-scene include: time_range, shot_type, camera_movement, main_subject, all_visible_objects, setting/atmosphere, action_detail, on-screen_text, sfx/music cue, transition.
     * Mention ambience details explicitly (lighting, weather, crowd/noise, mood).
     * Mention objects meticulously (helmet, road marking, motor parts, jacket, signage, background vehicles, etc).
     * Ensure temporal continuity from first frame to last frame (no timeline gaps).
6. DO NOT ASK QUESTIONS. DO NOT SAY "I'm ready" or "I've noted". START DIRECTLY WITH "## Script 1".
7. NO CONVERSATIONAL FILLER. JUST THE CONTENT.

OUTPUT TEMPLATE (You MUST produce 3 of these):

## Script 1: [Title] (🔥 [Theme])
**⏱️ Durasi:** 30-35 detik
**🪝 Hook:** [Shock Hook]
### 📝 NARRATIVE (GTTS)
di baca dengan nada Cepat & Semangat ala video short dengan dialek [DIALECT] yang medok.
...
### 🎬 SCENE BREAKDOWN
...

## Script 2: [Title] (🔥 [Theme])
...

## Script 3: [Title] (🔥 [Theme])
...
`;

    try {
        const result = await runGemini(prompt, 'Script');
        res.json({ result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-story', async (req, res) => {
    console.log(`[API] POST /api/generate-story triggered`);
    const { product, highlights, platform, additionalInfo = '' } = req.body;

    // Select Viral Structure
    const structures = dictionary.story_structures || [];
    const specs = dictionary.kenshi_specs || {};
    const styles = dictionary.gtts_styles || {};

    // Construct dynamic specs string
    const specsText = `
    - Material: ${specs.material}
    - Thickness: ${specs.thickness}
    - Sound: ${specs.sound_character}
    - Features: ${specs.features?.join(", ")}
    `;

    let prompt = `ROLE: You are a deeply emotional storyteller and biker (Anak Motor).
CONTEXT: You have ALREADY analyzed the product, dictionary, and trends. You do NOT need to read files. You do NOT need to plan.
GOAL: Output the final video script text immediately.
TASK: Write 3 VARIATIONS of a brand story/script for Instagram Reels/TikTok.
PRODUCT: ${product}
TECHNICAL SPECS (MUST USE): ${specsText}
HIGHLIGHTS: ${highlights}
PLATFORM: ${platform}
TARGET AUDIENCE: Indonesian bikers (slang, casual, brotherhood vibes).
REFERENCE VIDEO NOTES (OPTIONAL, from uploaded-video analysis): ${additionalInfo || 'N/A'}

MANDATORY RULES for EACH VARIATION:
1. QUANTITY: Generate 3 DIFFERENT VARIATIONS.
2. DURATION: STRICT 30-35 Seconds.
3. WORD COUNT: MAX 80 WORDS per variation (CRITICAL for retention).
4. HOOK: Must use a "SHOCK HOOK" (Max 6 words). EXPLOSIVE & CLICKBAIT.
   - Example: "WHAAAT?! 3 JUTA ZONK?!" or "SUMPAH NYESEL BARU TAU!!"
5. CONTENT: 
   - Compare ${product} vs Competitors.
   - ${product} = Focus on 2-3 KEY SPECS ONLY.
   - DIALECT ADAPTATION: Use pronouns ("Gue/Lo", "Aku/Kamu", "Kulo/Panjenengan") MATCHING the requested dialect.
   - **HUMAN TOUCH**: Don't be robotic. Use pauses, rhetorical questions, and "slang" naturally.
   - DON'T BE GENERIC. Use "Ngab", "Bor", "Brother". No "Akan tetapi" or "Namun".
6. FORMAT (Strict for GTTS): 
   - START with "## Story [Number]"
   - KOMPOSISI KONTEN WAJIB (per story):
     * 40% DRAMA/EMOSI (pain, konflik, tension yang relatable)
     * 20% PROSES MASUK / TRANSISI SOLUSI (alur dari problem ke solusi produk)
     * 40% PENERANGAN PRODUK (fitur, benefit, bukti, value)
   - THEN "### 📝 NARRATIVE" (The spoken text ONLY).
   - **IMPORTANT**: The Narrative MUST START with the Hook phrase.
   - **LENGTH**: Total narrative text MUST be under 80 words.
   - INSIDE NARRATIVE: Use [tag expresi: mood] tags FREQUENTLY (e.g. at the start of every sentence/phrase).
   - START NARRATIVE with Style Instruction: "di baca dengan nada [STYLE] ala video short dengan dialek [DIALECT] yang medok." (Adapt STYLE and DIALECT to the requested ones).
   - THEN "### 🎬 VISUAL BREAKDOWN" (The scenes/visuals).
   - VISUAL BREAKDOWN MUST be director/remotion-ready with precise timeline:
     * Use 0.5-second granularity (example: 00:00.0-00:00.5, 00:00.5-00:01.0).
     * Include every important micro-moment even if only 0.5 second.
     * For EACH scene/micro-scene include: time_range, shot_type, camera_movement, main_subject, all_visible_objects, setting/atmosphere, action_detail, on-screen_text, sfx/music cue, transition.
     * Mention ambience details explicitly (lighting, weather, crowd/noise, mood).
     * Mention objects meticulously (helmet, road marking, motor parts, jacket, signage, background vehicles, etc).
     * Ensure temporal continuity from first frame to last frame (no timeline gaps).
7. DO NOT ASK QUESTIONS. DO NOT SAY "I'm ready", "I've noted". START DIRECTLY WITH "## Story 1".
   - IF YOU CANNOT WRITE A STORY, WRITE "ERROR: CANNOT WRITE STORY". DO NOT TRY TO READ FILES.

OUTPUT FORMAT TEMPLATE (You MUST produce 3 of these):

## Story 1: [Title]
**⏱️ Durasi:** 30-35 det
**🪝 Hook:** [Shock Hook Text]
### 📝 NARRATIVE
di baca dengan nada Cepat & Semangat ala video short dengan dialek [DIALECT] yang medok.
...
### 🎬 VISUAL BREAKDOWN
...

## Story 2: [Title]
...

## Story 3: [Title]
...

## Story 3: [Title]
...`;

    try {
        const result = await runGemini(prompt, 'Story');
        res.json({ result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.post('/api/director-plan', async (req, res) => {
    console.log(`[API] POST /api/director-plan triggered`);
    const { script = '', audio = {}, footageInsights = '' } = req.body || {};

    if (!script || typeof script !== 'string') {
        return res.status(400).json({ error: 'script is required' });
    }

    const safeDuration = Number(audio.durationSec || 0);
    const estimatedDuration = Number.isFinite(safeDuration) && safeDuration > 0 ? safeDuration.toFixed(2) : 'unknown';
    const emotionTimeline = Array.isArray(audio.emotionTimeline) ? audio.emotionTimeline : [];
    const cueWords = Array.isArray(audio.cueWords) ? audio.cueWords : [];

    const prompt = `ROLE: You are a meticulous Film Director + Remotion Planner.
GOAL: Build an executable directing plan from script + audio cues.

INPUT SCRIPT:
${script}

AUDIO ANALYSIS:
- duration_sec: ${estimatedDuration}
- emotion_timeline: ${JSON.stringify(emotionTimeline)}
- cue_words: ${JSON.stringify(cueWords)}

FOOTAGE DATABASE INSIGHTS (optional):
${footageInsights || 'N/A'}

MANDATORY OUTPUT FORMAT:
## Director Plan
### Audio Summary
- estimated_duration
- dominant_emotions
- narrative_arc
- hook_moments (seconds + words)

### Scroll-Stop Strategy (0-3s)
- pattern_interrupt_idea
- first_text_overlay (max 5 words, high contrast)
- first_transition
- first_sfx_hit
- reason_why_viewer_stays

### Visual & Typography Style Bible
- color_palette (background, primary text, accent, warning)
- text_hierarchy (headline/subheadline/caption)
- font_style_direction (bold/condensed/clean)
- caption_style (position, safe margin, highlight keywords)
- animation_language (pop, shake, kinetic, typewriter, zoom)
- readability_rules (max chars per line, duration per caption)

### Timeline
Provide sequential rows with NO GAP from 00:00.0 until end duration.
Each row MUST contain:
- time_range (0.5s precision whenever important phrase changes)
- narration_fragment
- emotion
- engagement_objective (hook/retain/reward/convert)
- visual_intent
- recommended_shot (close-up/medium/wide/drone/pov/etc)
- camera_motion
- broll_or_footage_query (query keywords to search footage DB)
- on_screen_text
- text_animation
- caption_treatment (color/highlight/emoji emphasis)
- transition
- remotion_effects
- audio_sync_note (beat hit / whoosh / pause timing)

### Footage Search Queries
List prioritized search queries that director should use in footage database.
Include alternatives if exact shot is unavailable.

### Conversion Layer
- CTA wording options (3)
- product proof moments
- objection handling moments
- final frame design (logo/text/button cue)

### Remotion Execution Notes
Give implementable notes for sequencing, pacing, layering, text animation, SFX sync,
and anti-scroll rhythm (new visual stimulus every 0.8-2.0s).

RULES:
1. If phrase indicates regret (e.g. "nyesel aku"), choose fitting visual metaphor and specify query terms.
2. Prioritize mobile-first readability and high-retention short-video grammar.
3. Keep plan practical, cinematic, and directly usable by editor.
4. Do not ask questions. Output final plan only.`;

    try {
        const result = await runGemini(prompt, 'DirectorPlan');
        res.json({ plan: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.post('/api/remotion-skill', async (req, res) => {
    console.log(`[API] POST /api/remotion-skill triggered`);
    const { directorPlan = '', script = '', footageCatalog = '' } = req.body || {};

    if (!directorPlan || typeof directorPlan !== 'string') {
        return res.status(400).json({ error: 'directorPlan is required' });
    }

    const prompt = `ROLE: You are a Senior Remotion Execution Engineer.
GOAL: Convert a director plan into a strict Remotion skill pack that can be executed to produce MP4 short ads.

INPUT SCRIPT:
${script || 'N/A'}

DIRECTOR PLAN:
${directorPlan}

FOOTAGE CATALOG / DB HINTS (optional):
${footageCatalog || 'N/A'}

MANDATORY OUTPUT FORMAT:
## Remotion Skill Pack
### Execution Principles
- how to follow director intent with zero drift
- visual consistency rules
- retention pacing rules

### Asset Mapping Strategy
- how to map footage queries to actual clips
- fallback order when exact clip is unavailable
- rule for clip trim (keep, cut, extend, speed ramp)

### Render Settings
- fps (30)
- resolution (1080x1920)
- codec/container (h264 + mp4)
- audio loudness target and peak guard

### Remotion Build JSON
Return a SINGLE json block in \`\`\`json containing:
{
  "meta": {"title": "...", "durationSec": number, "fps": 30, "size": "1080x1920"},
  "globalStyle": {
    "palette": {"bg":"#...","primary":"#...","accent":"#...","caption":"#..."},
    "typography": {"headline":"...","caption":"...","weight":"..."},
    "captionRules": {"maxCharsPerLine": number, "safeMarginPx": number, "highlightMode": "keyword"}
  },
  "timeline": [
    {
      "id": "scene-01",
      "startSec": number,
      "endSec": number,
      "voiceText": "...",
      "emotion": "...",
      "objective": "hook|retain|reward|convert",
      "footageSearch": ["..."],
      "footageFallback": ["..."],
      "shotType": "...",
      "cameraMotion": "...",
      "textOverlay": "...",
      "textAnimation": "...",
      "captionStyle": "...",
      "transitionIn": "...",
      "transitionOut": "...",
      "effects": ["..."],
      "sfx": ["..."],
      "editOps": ["trim:start-end","speed:1.1x","freeze:0.2s"]
    }
  ],
  "cta": {"variants": ["...","...","..."], "finalFrame": "..."},
  "renderChecklist": ["..."],
  "ffmpegFallback": "single command to export mp4 from rendered sequence"
}
\`\`\`

RULES:
1. Keep timeline contiguous without gaps.
2. Follow director emotions and hooks tightly.
3. Ensure every scene has footage fallback.
4. Output must be production-ready for Remotion and final MP4 publishing.
5. Do not ask questions. Output final result only.`;

    try {
        const result = await runGemini(prompt, 'RemotionSkill');
        res.json({ skillPack: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/research-trend', async (req, res) => {
    console.log(`[API] POST /api/research-trend triggered`);
    const { keyword, category } = req.body;

    let prompt = `ROLE: You are a trend researcher for Indonesian motorcycle content.
    TASK: Analyze viral trends for keyword: "${keyword}" in category: "${category}".
        OUTPUT: Provide a bulleted list of 5 trending topics / slang / hooks currently popular among "Ngabers"(Indonesian bikers).
            FORMAT: Strict Markdown.No conversational filler.

1.[Trend Name]-[Why it's viral]
2.[Slang Word] - [Meaning]
...
`;

    try {
        // Reuse runGemini but maybe with less strict structure checks since it's just research
        // However, runGemini enforces no-chat, which is good.
        const result = await runGemini(prompt, 'Research');
        res.json({ insight: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
