const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { videoDAO } = require('./database');

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

// Helper to run Codex with the specified path
const runCodex = (prompt, taskType = 'Content', retries = 1) => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        console.log(`[Codex] Spawning process for ${taskType}... (Retries left: ${retries})`);

        const codexPath = 'C:\\Users\\USER\\AppData\\Roaming\\npm\\codex.cmd';
        // Using cmd /c and shell: true for reliable execution on Windows
        const child = spawn('cmd', ['/c', codexPath, 'exec'], { shell: true });

        let stdout = '';
        let stderr = '';

        if (prompt) {
            child.stdin.write(prompt);
            child.stdin.end();
        }

        child.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdout += chunk;
            process.stdout.write(chunk);
        });

        child.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
        });

        child.on('error', (err) => {
            console.error(`[Codex Spawn Error]`, err);
            reject(err);
        });

        child.on('close', (code) => {
            const durationMs = Date.now() - startTime;
            console.log(`[Codex] ${taskType} finished in ${durationMs}ms (exit: ${code})`);

            if (code !== 0) {
                console.error(`[Codex Error] Exit Code: ${code}, Stderr: ${stderr}`);
                return reject(new Error(stderr || `Codex exited with code ${code}`));
            }

            let output = stdout.trim();
            const cleaned = cleanOutput(output);

            const isValid = (TASK_VALIDATORS[taskType] || TASK_VALIDATORS.Content)(cleaned);

            if (!isValid && retries > 0) {
                return runCodex(prompt, taskType, retries - 1).then(resolve).catch(reject);
            }

            resolve(cleaned || output);
        });
    });
};

const getOrRefreshTrends = async (category) => {
    const existing = videoDAO.getTrend(category);
    const now = new Date();

    // Check if exists and is fresh (< 24 hours)
    if (existing) {
        const lastUpdate = new Date(existing.last_updated);
        const hoursDiff = (now - lastUpdate) / (1000 * 60 * 60); // Convert ms to hours
        console.log(`[Trends] Found existing data for '${category}'. Age: ${hoursDiff.toFixed(2)} hours.`);

        if (hoursDiff < 24) {
            return existing.data;
        }
        console.log(`[Trends] Data is stale (> 24h). Refreshing...`);
    } else {
        console.log(`[Trends] No data found for '${category}'. Fetching new...`);
    }

    // Refresh Logic
    try {
        console.log(`[Trends] Triggering AI Research for '${category}'...`);
        // We use a simplified prompt for the "Researcher" persona
        const researchPrompt = `
        ROLE: Market Researcher.
        TASK: Research the LATEST viral trends (last 24h) for '${category}' in Indonesia.
        FOCUS:
        1. Trending Topics / Hashtags
        2. Viral Audio / Music
        3. Consumer Sentiment (What are people complaining/happy about?)
        OUTPUT: JSON format only. { "topics": [], "audio": [], "sentiment": "" }
        `;

        const result = await runGemini(researchPrompt, 'Research');

        // Save to DB
        videoDAO.saveTrend(category, result);
        console.log(`[Trends] Saved fresh data for '${category}'.`);

        // Trigger SSE update to frontend to notify user
        broadcastLog(`[System] Trend Database Updated for ${category}`);

        return result; // result might be a string, we might need to parse it if runGemini returns string
    } catch (e) {
        console.error(`[Trends] Failed to refresh: ${e.message}`);
        return existing ? existing.data : "No Trend Data Available";
    }
};

app.post('/api/generate-script', async (req, res) => {
    console.log(`[API] POST /api/generate-script triggered`);
    const { product, highlights, platform, additionalInfo = '' } = req.body;

    // Construct dynamic specs string
    const specs = dictionary.kenshi_specs || {};
    const styles = dictionary.gtts_styles || {};

    // Auto-fetch automotive trends
    let autoTrends = "";
    try {
        const trendData = await getOrRefreshTrends("Automotive/Motorcycle");
        // If trendData is object, stringify it
        autoTrends = typeof trendData === 'object' ? JSON.stringify(trendData) : trendData;
    } catch (e) {
        console.error("Trend fetch failed:", e);
    }

    // Context for AI = User Highlights + Auto Trends
    const fullTrendContext = `
    USER HIGHLIGHTS: ${highlights}
    ----------------
    AUTOMATED MARKET TRENDS (Last 24h):
    ${autoTrends}
    `;

    // Construct dynamic specs string
    const specsText = `
    - Material: ${specs.material}
    - Thickness: ${specs.thickness}
    - Sound: ${specs.sound_character}
    - Features: ${specs.features?.join(", ")}
    `;

    let prompt = `ROLE: You are an elite direct-response storyteller for motorcycles (Anak Motor).
CONTEXT: You have ALREADY analyzed the product. You do NOT need to read files.
GOAL: Output a final video script that is PUNCHY and FAST (25-35 seconds).
TASK: Write 3 VARIATIONS of a short-form video script.
PRODUCT: ${product}
TECHNICAL SPECS (MUST USE): ${specsText}
TRENDS & INSIGHTS (Use for Hook/Angle): ${fullTrendContext}
PLATFORM: ${platform}
TARGET AUDIENCE: Indonesian bikers (slang, casual, brotherhood vibes).

MANDATORY RULES:
1. DURATION: STRICT 25-35 SECONDS.
2. **WORD COUNT (CRITICAL)**:
   - **TOTAL**: 80-90 WORDS MAX (To hit 30s at 1.5x tempo + tags).
   - **DO NOT** exceed 90 words or it will be too long.
3. **STRUCTURE (THE 40:20:40 FLOW)**:
   - **PHASE 1 (40%): THE DRAMA**: ~35 words. Pure internal monologue/pain. No product mention.
   - **PHASE 2 (20%): THE BRIDGE**: ~15 words. Smooth transition to "Need".
   - **PHASE 3 (40%): THE SOLUTION**: ~35 words. Kenshi reveal + selected Highlights.
4. **GTTS FORMATTING**:
   - **TAGS**: Insert [tag expresi: ...] or [jeda: pendek] EVERY 5-7 WORDS.
   - **TEMPO**: Use 'tempo 1.50' in style instructions.
   - **NO SCENE BREAKDOWN**: Spoken text only.
5. FORMAT:
   - ## Script [Number]: [Title]
   - ### 🎙️ Style & Voice
   - ${styles.instructions_template} [STYLE] dengan dialek [DIALECT].
   - ### 📝 NARRATIVE (GTTS)
   - [Spoken Text starting with Hook]

## Script 1: ...
## Script 2: ...
## Script 3: ...`;

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

    let prompt = `ROLE: You are an emotional storyteller and fellow biker (Anak Motor).
CONTEXT: You have ALREADY analyzed the product, dictionary, and trends.
GOAL: Output a brand story that is FAST and ENGAGING (25-35 seconds).
TASK: Write 3 VARIATIONS of a story-based script.
PRODUCT: ${product}
TECHNICAL SPECS (MUST USE): ${specsText}
TRENDS & INSIGHTS: ${fullTrendContext}
PLATFORM: ${platform}
TARGET AUDIENCE: Indonesian bikers.

MANDATORY RULES:
1. DURATION: STRICT 25-35 SECONDS.
2. **WORD COUNT (CRITICAL)**:
   - **TOTAL**: 80-90 WORDS MAX (To hit 30s at 1.5x tempo + tags).
   - **DO NOT** exceed 90 words.
3. **STRUCTURE (THE 40:20:40 FLOW)**:
   - **PHASE 1 (40%): THE DRAMA**: ~35 words. Deep emotional relatability. No brand name.
   - **PHASE 2 (20%): THE BRIDGE**: ~15 words. Connecting struggle to collective wisdom.
   - **PHASE 3 (40%): THE SOLUTION**: ~35 words. Kenshi as the hero.
4. **GTTS FORMATTING**:
   - **TAGS**: Insert [tag expresi: ...] or [jeda: pendek] EVERY 5-7 WORDS.
   - **TEMPO**: Use 'tempo 1.50' in style instructions.
   - **NO SCENE BREAKDOWN**: Spoken text only.
5. FORMAT:
   - ## Story [Number]: [Title]
   - ### 🎙️ Style & Voice
   - ${styles.instructions_template} [STYLE] dengan dialek [DIALECT].
   - ### 📝 NARRATIVE
   - [Spoken Text starting with Hook]

## Story 1: ...
## Story 2: ...
## Story 3: ...`;

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
        const result = await runCodex(prompt, 'DirectorPlan');
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
        const result = await runCodex(prompt, 'RemotionSkill');
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

const multer = require('multer');

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'data', 'raw_footage');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Sanitize filename
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        cb(null, safeName);
    }
});
const upload = multer({ storage: storage });

// [NEW] SSE Logging Setup
let logClients = [];

const broadcastLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    const logData = `[${timestamp}] ${message}`;
    // console.log(logData); // Also log to server console

    logClients.forEach(client => {
        client.res.write(`data: ${JSON.stringify({ message: logData })}\n\n`);
    });
};

app.get('/api/logs', (req, res) => {
    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
    };
    res.writeHead(200, headers);

    const clientId = Date.now();
    const newClient = {
        id: clientId,
        res
    };
    logClients.push(newClient);

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ message: "Connected to Log Stream..." })}\n\n`);

    req.on('close', () => {
        logClients = logClients.filter(c => c.id !== clientId);
    });
});

// [NEW] Upload & Ingest Endpoint with Logging (Multi-file)
app.post('/api/ingest-upload', upload.array('videos'), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No video files uploaded" });
    }

    const processedFiles = [];

    req.files.forEach(file => {
        const filename = file.filename;
        processedFiles.push(filename);
        broadcastLog(`[Upload] File saved: ${filename}`);

        // Trigger Ingestion (Async) for each file
        const child = spawn('node', ['ingest.js', filename], {
            cwd: __dirname,
            // stdio: 'inherit' // Changed to pipe to capture logs
        });

        child.stdout.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) broadcastLog(`[${filename}] ${msg}`);
        });

        child.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) broadcastLog(`[${filename}] ERROR: ${msg}`);
        });

        child.on('error', (err) => {
            console.error(`[Ingest Spawn Error] ${filename}:`, err);
            broadcastLog(`[${filename}] FAILED to start ingest: ${err.message}`);
        });

        child.on('close', (code) => {
            broadcastLog(`[${filename}] Ingest finished (Code ${code})`);
        });
    });

    res.json({
        status: "success",
        message: `Uploaded ${processedFiles.length} files. Analysis queued.`,
        filenames: processedFiles
    });
});

// [NEW] Get All Videos
app.get('/api/videos', (req, res) => {
    try {
        const videos = videoDAO.getAllVideos();
        res.json({ videos });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [NEW] Delete Video
app.delete('/api/videos/:id', (req, res) => {
    const { id } = req.params;
    try {
        const video = videoDAO.getVideoById(id);
        if (!video) {
            return res.status(404).json({ error: "Video not found" });
        }

        // Delete from DB (Cascade deletes forensics)
        videoDAO.deleteVideo(id);

        // Delete File
        if (fs.existsSync(video.path)) {
            try {
                fs.unlinkSync(video.path);
                console.log(`[Delete] Deleted file: ${video.path}`);
            } catch (e) {
                console.error(`[Delete Error] Failed to delete file: ${e.message}`);
                // Don't fail request, DB is already cleaned.
            }
        } else {
            console.warn(`[Delete] File not found: ${video.path}`);
        }

        res.json({ message: "Video deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [EXISTING] Ingest via Filename (Keep for CLI/Manual)
app.post('/api/ingest', (req, res) => {
    // This runs async in background usually, but here we spawn a process or just call function?
    // Using spawn to avoid blocking event loop if it's heavy, provided ingest.js is CLI ready.
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: "Filename required" });

    console.log(`[API] Triggering ingestion for: ${filename}`);

    const child = spawn('node', ['ingest.js', filename], { cwd: __dirname });

    child.stdout.on('data', (data) => console.log(`[Ingest]: ${data}`));
    child.stderr.on('data', (data) => console.error(`[Ingest Error]: ${data}`));

    res.json({ status: "Ingestion started", filename });
});

// [NEW] Plan Generation Endpoint
app.post('/api/generate-video-plan', (req, res) => {
    const { script } = req.body;
    if (!script) return res.status(400).json({ error: "Script required" });

    try {
        const { generatePlan } = require('./generate_video_plan');
        const plan = generatePlan(script);
        res.json({ plan });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


// [NEW] Auto Render Endpoint (Plan + Render)
app.post('/api/auto-render', async (req, res) => {
    const { script } = req.body;
    if (!script) return res.status(400).json({ error: "Script required" });

    // Generate unique ID for this run
    const runId = Date.now();
    const planPath = path.join(__dirname, '..', `video-plan-${runId}.json`);
    const outputPath = path.join(__dirname, '..', 'out', `video-${runId}.mp4`);

    console.log(`[AutoRender] Starting for Run ID: ${runId}`);

    try {
        const { generatePlan } = require('./generate_video_plan');
        const composition = generatePlan(script);

        // Save unique plan file
        fs.writeFileSync(planPath, JSON.stringify(composition, null, 2));

        // Spawn Render Process (Async)
        // We pass the plan file as a prop to the Remotion command? 
        // Or we update the "default" plan? 
        // "video-plan.json" is what the CLI uses. Let's strictly overwrite "video-plan.json" for now to keep it simple with existing CLI.
        // OR better: use the unique file and tell CLI to use it. 
        // But video_cli.js writes to 'video-plan.json'. 
        // Let's just overwrite 'video-plan.json' in root to be safe and simple.

        const mainPlanPath = path.join(__dirname, '..', 'video-plan.json');
        fs.writeFileSync(mainPlanPath, JSON.stringify(composition, null, 2));

        // Spawn Render
        const child = spawn('npm', ['run', 'video:render'], {
            cwd: path.join(__dirname, '..'),
            shell: true
        });

        child.stdout.on('data', (data) => console.log(`[Render ${runId}]: ${data}`));
        child.stderr.on('data', (data) => console.error(`[Render ${runId} Err]: ${data}`));

        child.on('close', (code) => {
            console.log(`[Render ${runId}] Finished with code ${code}`);
        });

        res.json({
            status: "Rendering started",
            message: "Video is being rendered in background.",
            output: `out/video.mp4`
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
