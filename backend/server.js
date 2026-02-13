const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); const { GoogleGenerativeAI } = require("@google/generative-ai");

// Gemini SDK Setup for Multimodal
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Use efficient model for audio

const { videoDAO } = require('./database');

const app = express();

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

const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// SSE Clients (Removed duplicate)

// Load Dictionary
const dictionaryPath = path.join(__dirname, 'data', 'dictionary.json');
let dictionary = {};

try {
    const data = fs.readFileSync(dictionaryPath, 'utf8');
    dictionary = JSON.parse(data);
    console.log("âœ… Dictionary loaded successfully.");
} catch (err) {
    console.error("âŒ Error loading dictionary:", err);
}

const pickTerms = (items = [], count = 6) => {
    return (items || [])
        .slice(0, count)
        .map((item) => item.term)
        .filter(Boolean);
};

const buildMotorSlangReference = (dict = {}) => {
    const slang = dict.slang || {};
    const communityTerms = pickTerms(slang.community, 8);
    const technicalTerms = pickTerms(slang.technical, 8);
    const exhaustTerms = pickTerms(slang.exhaust, 8);
    const soundTerms = pickTerms(slang.sound_character, 6);
    const positiveExpr = (slang.expressions?.positive || []).slice(0, 8);

    const lines = [];

    if (communityTerms.length) lines.push(`- Komunitas: ${communityTerms.join(', ')}`);
    if (technicalTerms.length) lines.push(`- Teknis performa: ${technicalTerms.join(', ')}`);
    if (exhaustTerms.length) lines.push(`- Komponen knalpot: ${exhaustTerms.join(', ')}`);
    if (soundTerms.length) lines.push(`- Karakter suara: ${soundTerms.join(', ')}`);
    if (positiveExpr.length) lines.push(`- Ekspresi rider: ${positiveExpr.join(', ')}`);

    if (!lines.length) {
        return "- Data kamus tidak tersedia. Tetap gunakan bahasa biker Indonesia yang natural.";
    }

    return lines.join('\n');
};

const SUPABASE_URL =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "";
const SUPABASE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "";

const SUPABASE_SLANG_CACHE_TTL_MS = 10 * 60 * 1000;
const supabaseSlangCache = {
    expiresAt: 0,
    text: "",
};

const buildSupabaseSlangReference = (rows = []) => {
    const grouped = {};
    for (const row of rows) {
        const category = row?.category || 'umum';
        const term = row?.term;
        if (!term) continue;
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(term);
    }

    const orderedCategories = Object.keys(grouped).sort();
    const lines = orderedCategories
        .slice(0, 6)
        .map((category) => {
            const terms = grouped[category].slice(0, 8);
            return `- Supabase ${category}: ${terms.join(', ')}`;
        });

    return lines.join('\n');
};

const fetchSupabaseSlangReference = async () => {
    const now = Date.now();
    if (supabaseSlangCache.text && now < supabaseSlangCache.expiresAt) {
        return supabaseSlangCache.text;
    }

    if (!SUPABASE_URL || !SUPABASE_KEY || typeof fetch !== 'function') {
        return "";
    }

    try {
        const endpoint = `${SUPABASE_URL}/rest/v1/motor_slang?select=term,category&limit=120`;
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
            },
        });

        if (!response.ok) {
            console.error(`[Supabase] Failed to load motor_slang: ${response.status}`);
            return "";
        }

        const rows = await response.json();
        const text = buildSupabaseSlangReference(Array.isArray(rows) ? rows : []);
        if (!text) return "";

        supabaseSlangCache.text = text;
        supabaseSlangCache.expiresAt = now + SUPABASE_SLANG_CACHE_TTL_MS;
        return text;
    } catch (error) {
        console.error("[Supabase] Error loading motor_slang:", error?.message || error);
        return "";
    }
};

const buildCombinedSlangReference = async (dict = {}) => {
    const jsonReference = buildMotorSlangReference(dict);
    const supabaseReference = await fetchSupabaseSlangReference();

    if (!supabaseReference) {
        return `SOURCE JSON:\n${jsonReference}`;
    }

    return `SOURCE JSON:\n${jsonReference}\n\nSOURCE SUPABASE motor_slang:\n${supabaseReference}`;
};

// Banned phrases that indicate "Chat Mode"
const BANNED_PHRASES = [
    "Understood", "I understand", "Here is the", "Sure,", "Okay,", "I am ready",
    "I'll start", "Siap,", "Tentu,", "Baik,", "Mengerti", "Here's a", "Generating",
    "Acknowledged", "remain concise", "focus strictly", "What's the mission",
    "I will begin", "I have analyzed", "I will now", "explore the project", "examine the", "project files",
    "preferred persona", "project structure", "first command", "I'm ready", "I am ready", "Let's hit the road",
    "What's our first move?", "I am a non-interactive CLI agent", "I will search", "I will read", "I will examine"
];

const WOW_HOOK_PATTERN = /(wow|wah+|wha+t+|hah+|anjir|anjay|kok bisa|masa sih|serius|gila|bisu|yakin|kuning|karat|malu|ilfeel|jebol|rugi|awas|stop|cewek|beneran|nanya|beda|tilang)/i;
const hooksHaveWow = (text = '') => {
    // Capture any line containing "hook:" and inspect the hook copy after the colon
    const hookLines = (text.match(/hook[^:]*:\s*[^\n]+/gi) || [])
        .map(line => line.replace(/^[^\:]*:\s*/i, '').trim())
        .filter(Boolean);

    if (!hookLines.length) return false;
    return hookLines.every((hook) => WOW_HOOK_PATTERN.test(hook));
};

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

const GTTS_TAG_PATTERN = /\[(?:emosi|tekanan)\s*:[^\]]+\]/gi;

const moveTrailingGttsTagsToFront = (line = '') => {
    let updated = line;
    let prev = '';
    const gttsTag = '(\\[(?:emosi|tekanan)\\s*:[^\\]]+\\])';

    while (updated !== prev) {
        prev = updated;
        // Move "... kalimat. [emosi: x]" -> "[emosi: x] ... kalimat."
        updated = updated.replace(
            new RegExp(`([^\\n]*?[.!?])\\s*${gttsTag}`, 'gi'),
            '$2 $1'
        );
        // Move "... potongan, [emosi: x]" -> "[emosi: x] ... potongan,"
        updated = updated.replace(
            new RegExp(`([^\\n]*?,)\\s*${gttsTag}`, 'gi'),
            '$2 $1'
        );
        // Fallback: tag at end of line without punctuation
        updated = updated.replace(
            new RegExp(`(.+?)\\s+${gttsTag}\\s*$`, 'gi'),
            '$2 $1'
        );
    }

    return updated.replace(/\s{2,}/g, ' ').trimEnd();
};

const redistributeLeadingGttsTagsIntoBody = (line = '') => {
    const match = line.match(/^\s*((?:\[(?:emosi|tekanan)\s*:[^\]]+\]\s*){2,})(.+)$/i);
    if (!match) return line;

    const tagBlock = match[1];
    const body = (match[2] || '').trim();
    const tags = tagBlock.match(GTTS_TAG_PATTERN) || [];
    if (!tags.length || !body) return line;

    // If body already has tags, keep only one leading tag to avoid stacking.
    if (/\[(?:emosi|tekanan)\s*:[^\]]+\]/i.test(body)) {
        return `${tags[0]} ${body}`.replace(/\s{2,}/g, ' ').trim();
    }

    const chunks = body
        .split(/(?<=[.!?,;:])\s+|\s+(?=(?:dan|tapi|terus|pas|waktu|harusnya|sejak|biar|supaya)\b)/i)
        .map((chunk) => chunk.trim())
        .filter(Boolean);

    if (chunks.length <= 1) {
        return `${tags[0]} ${body}`.replace(/\s{2,}/g, ' ').trim();
    }

    const rebuilt = chunks
        .map((chunk, index) => `${tags[Math.min(index, tags.length - 1)]} ${chunk}`)
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return rebuilt;
};

const normalizeNarrativeGttsTagPlacement = (text = '') => {
    // START_REPAIR_V4: Simplified to trust AI placement and user instruction
    return text.split('\n').map(line => {
        let clean = line.trim();
        // Specific fix: if line ends with a tag, move it to front? 
        // No, user said "tags harusnya di awal". AI might still mess up.
        // Let's rely on the prompt to fix AI behavior first. 
        // This function will just ensure we don't double-space.
        return clean.replace(/\s{2,}/g, ' ');
    }).join('\n');
};

const TASK_VALIDATORS = {
    Script: (cleaned) => cleaned.includes('## Script 1') && cleaned.length >= 80,
    Story: (cleaned) => cleaned.includes('## Story 1') && cleaned.length >= 80,
    Research: (cleaned) => /(^|\n)\s*\d+\./.test(cleaned) && cleaned.length >= 40,
    DirectorPlan: (cleaned) => (cleaned.startsWith('{') || cleaned.includes('```json')) && cleaned.includes('"tracks"'),
    RemotionSkill: (cleaned) => cleaned.includes('## Remotion Skill Pack') && cleaned.includes('```json') && cleaned.length >= 400,
    Content: (cleaned) => cleaned.length >= 80,
    AudioAnalysis: (cleaned) => (cleaned.startsWith('{') || cleaned.includes('```json')) && cleaned.length >= 20
};

// Helper to run Gemini with retries using spawn for safer arg handling
const runGemini = (prompt, taskType = 'Content', retries = 1) => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        console.log(`[Gemini] Spawning process for ${taskType}... (Retries left: ${retries})`);

        // Avoid shell wrapping overhead on Unix for lower latency.
        // Keep shell only on Windows for command resolution compatibility.
        // Use the -p flag and stdin pattern for direct, non-agentic output.
        // This bypasses the conversational "agent" loops.
        const child = spawn('gemini.cmd', ['-p', `${taskType}:`, '-o', 'text', '-e', 'none'], { shell: true });

        let stdout = '';
        let stderr = '';

        // Write the full prompt to stdin
        child.stdin.write(prompt);
        child.stdin.end();

        child.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdout += chunk;
            process.stdout.write(chunk); // Stream to console
        });

        child.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
        });

        child.on('error', (err) => {
            console.error(`[Gemini Spawn Error]`, err);
            reject(err);
        });

        child.on('close', (code) => {
            const durationMs = Date.now() - startTime;
            console.log(`[Gemini] ${taskType} finished in ${durationMs}ms (exit: ${code})`);

            // Allow code 0 or generic success
            if (code !== 0) {
                // Warn but try to parse stdout if available, sometimes CLI exits non-zero on minor warnings
                console.warn(`[Gemini Warning] Exit Code: ${code}, Stderr: ${stderr}`);
                if (!stdout.trim()) {
                    return reject(new Error(stderr || `Gemini exited with code ${code}`));
                }
            }

            let output = stdout.trim();

            // Strip Gemini CLI system logs that might still appear
            output = output.replace(/^Loaded cached credentials\.\n/m, '');
            output = output.replace(/^Hook registry initialized with \d+ hook entries\n/m, '');
            output = output.trim();

            // Helper to clean JSON output
            const cleanJSON = (text) => {
                let clean = text.trim();
                // Find first '{'
                const firstBrace = clean.indexOf('{');
                // Find last '}'
                const lastBrace = clean.lastIndexOf('}');

                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    return clean.substring(firstBrace, lastBrace + 1);
                }
                return clean;
            };

            // ... inside runGemini callback ...

            // ... inside runGemini callback ...

            let cleaned;

            if (taskType === 'Script' || taskType === 'Story' || taskType === 'Research' || taskType === 'Content') {
                cleaned = cleanOutput(output);
                if (taskType === 'Script' || taskType === 'Story') {
                    cleaned = normalizeNarrativeGttsTagPlacement(cleaned);
                }
            } else if (taskType === 'AudioAnalysis' || taskType === 'DirectorPlan' || taskType === 'RemotionSkill') {
                // Specialized JSON cleaning
                cleaned = cleanJSON(output);
            } else {
                cleaned = cleanOutput(output);
            }

            // Re-check banned phrases only on CLEANED text to see if any slipped through
            const hasBanned = BANNED_PHRASES.some(phrase => {
                return cleaned.toLowerCase().includes(phrase.toLowerCase());
            });

            // AudioAnalysis might trigger "I have analyzed" banned phrase, so we might skip banned check strictly?
            // "I have analyzed" is in BANNED_PHRASES.
            // Let's exempt AudioAnalysis from Banned Phrases if strict JSON
            const isBanned = (taskType !== 'AudioAnalysis') && hasBanned;

            const isValid = (TASK_VALIDATORS[taskType] || TASK_VALIDATORS.Content)(cleaned);

            if ((!isValid || isBanned) && retries > 0) {
                const startMarker = taskType === 'Research' ? '1.' : (taskType === 'AudioAnalysis' ? '{' : `## ${taskType} 1`);
                const retryPrompt = `PREVIOUS OUTPUT WAS INVALID. STOP CHATTING. CONTINUE GENERATING THE ${taskType.toUpperCase()} FROM "${startMarker}". JUST THE CONTENT. \n\n${prompt}`;
                return runGemini(retryPrompt, taskType, retries - 1).then(resolve).catch(reject);
            }

            if (!isValid || isBanned) {
                return reject(new Error(`Validation failed for ${taskType}. Output must meet format rules.`));
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
            let cleaned = cleanOutput(output);
            if (taskType === 'Script' || taskType === 'Story') {
                cleaned = normalizeNarrativeGttsTagPlacement(cleaned);
            }

            const isValid = (TASK_VALIDATORS[taskType] || TASK_VALIDATORS.Content)(cleaned);

            if (!isValid && retries > 0) {
                return runCodex(prompt, taskType, retries - 1).then(resolve).catch(reject);
            }

            if (!isValid) {
                return reject(new Error(`Validation failed for ${taskType}. Hooks must contain WOW/WHAATT elements and output must meet format rules.`));
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

// Google GenAI SDK (Initialized at top) - OPTIONAL for other tasks, but disabled for Audio
// const { GoogleGenerativeAI } = require("@google/generative-ai");
// require('dotenv').config();
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// ... (keep existing code)

function fileToGenerativePart(path, mimeType) {
    return {
        inlineData: {
            data: fs.readFileSync(path).toString("base64"),
            mimeType
        },
    };
}

// WRAPPER for Local Whisper Python Script
async function transcribeAndAnalyzeAudio(filePath, mimeType = "audio/mp3") {
    console.log("[Whisper Local] Analyzing Audio:", filePath);
    broadcastLog(`[Audio] Starting Whisper Analysis for ${path.basename(filePath)}...`);

    return new Promise((resolve, reject) => {
        // Spawn Python script
        const pythonProcess = spawn('python', ['transcribe_whisper.py', filePath], {
            cwd: __dirname
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            stderr += msg;
            // Whisper prints progress to stderr usually (e.g. 10%...)
            // We can optional filter and broadcast specific progress lines if needed
            if (msg.includes('%') || msg.includes('Transcribing')) {
                broadcastLog(`[Whisper] ${msg.trim()}`);
            }
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`[Whisper Error] Exit Code: ${code}, Stderr: ${stderr}`);
                broadcastLog(`[Audio] Transcription Failed: ${stderr.substring(0, 100)}...`);
                // Fallback: return simple error but don't crash
                return resolve({
                    error: "Whisper Transcription Failed",
                    details: stderr
                });
            }

            try {
                // Whisper script prints JSON to stdout
                // Note: It might print other warnings (like FP16) to stderr, which is fine.
                const jsonOutput = JSON.parse(stdout.trim());
                console.log("[Whisper Local] Success:", jsonOutput.script_text.substring(0, 50) + "...");
                broadcastLog(`[Audio] Transcription Complete. Text length: ${jsonOutput.script_text.length}`);
                resolve(jsonOutput);
            } catch (e) {
                console.error("[Whisper Local] JSON Parse Error:", e, stdout);
                broadcastLog(`[Audio] JSON Parse Error from Whisper output.`);
                resolve({ error: "Invalid JSON from Whisper" });
            }
        });
    });
}


app.post('/api/generate-script', async (req, res) => {
    console.log('[API] POST /api/generate-script triggered');
    const { product, highlights, platform, additionalInfo = '' } = req.body;

    const specs = dictionary.kenshi_specs || {};
    const styles = dictionary.gtts_styles || {};

    let autoTrends = "";
    try {
        const trendData = await getOrRefreshTrends("Automotive/Motorcycle");
        autoTrends = typeof trendData === 'object' ? JSON.stringify(trendData) : trendData;
    } catch (e) {
        console.error("Trend fetch failed:", e);
    }

    const fullTrendContext = `
    USER HIGHLIGHTS: ${highlights}
    ----------------
    AUTOMATED MARKET TRENDS (Last 24h):
    ${autoTrends}
    `;

    const specsText = `
    - Material: ${specs.material}
    - Thickness: ${specs.thickness}
    - Sound: ${specs.sound_character}
    - Features: ${specs.features?.join(", ")}
    `;

    let prompt = `SYSTEM: YOU ARE 'ANAK MOTOR' (INDONESIAN BIKER).
GOAL: Write 3 TikTok scripts (25-35s) that sound like a REAL BIKER talking to friends.
PRODUCT: ${product}
SPECS: ${specsText}
CONTEXT: ${fullTrendContext}

CRITICAL INSTRUCTION:
1. **ATTITUDE**: Non-formal, street-smart, brotherhood vibe.
2. **HOOK**: Relatable start. "Sumpah, gue kira..." 
3. **FLOW (40-20-40)**:
   - **40% CURHAT**: The struggle.
   - **20% BRIDGE**: The realization.
   - **40% RACUN**: Kenshi solution + **STRONG CTA**.
4. **TAG PLACEMENT (CRITICAL)**:
   - **RULE**: Tags (e.g., [emosi: marah]) MUST be at the **BEGINNING** of the phrase/sentence they modify.
   - **WRONG**: "Motor gue pelan [emosi: sedih]" ❌
   - **RIGHT**: "[emosi: sedih] Motor gue pelan banget bro." ✅
   - **CONTEXT**: Use tags ONLY when the emotion changes. Don't spam them.
   - **WORD COUNT**: Strictly under 90 words.
   - **TEMPO**: 1.50.

OUTPUT FORMAT:
## Script 1: [Judul]
### 🎙️ Style & Voice
${styles.instructions_template} [SARKAS/TEGAS] dialek [DIALECT].
### 📝 NARRATIVE (GTTS)
[emosi: ...] [Start text...]`;

    try {
        const result = await runGemini(prompt, 'Script');
        res.json({ result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// [NEW] Auto-Render Endpoint
app.post('/api/auto-render', async (req, res) => {
    console.log('[API] POST /api/auto-render triggered');
    const { plan } = req.body;

    if (!plan) {
        return res.status(400).json({ error: "Missing 'plan' data" });
    }

    const renderId = Date.now();
    const propsFile = path.join(__dirname, `../src/remotion/render-props-${renderId}.json`);
    const outputFile = path.join(__dirname, `../out/video-${renderId}.mp4`);

    // Ensure output directory exists
    const outDir = path.dirname(outputFile);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    try {
        // 1. Save props to a temporary file
        fs.writeFileSync(propsFile, JSON.stringify({ plan }, null, 2));
        broadcastLog(`[Render] Props saved to ${path.basename(propsFile)}`);

        // 2. Spawn Remotion Render Process
        // Windows compatibility: use npx.cmd
        const isWin = process.platform === "win32";
        const cmd = isWin ? 'npx.cmd' : 'npx';

        const args = [
            'remotion', 'render',
            'src/remotion/index.ts',
            'MainVideo',
            outputFile,
            `--props=${propsFile}`,
            '--gl=angle', // Better compatibility on Windows
            '--concurrency=1',
            '--log=verbose' // Debugging
        ];

        broadcastLog(`[Render] Starting rendering process...`);
        // On Windows, npx.cmd handles the shell environment, so shell: false is safer/cleaner, 
        // but shell: true is often needed for path resolution. 
        // Let's try shell: true with the full command.
        const child = spawn(cmd, args, { shell: true });

        child.stdout.on('data', (data) => {
            const msg = data.toString();
            // Broadcast progress
            if (msg.includes('%') || msg.includes('Rendering')) {
                broadcastLog(`[Remotion] ${msg.trim()}`);
            }
            console.log(`[Remotion Stdout]: ${msg}`);
        });

        child.stderr.on('data', (data) => {
            const msg = data.toString();
            console.error(`[Remotion Stderr]: ${msg}`);
            // Remotion often prints info to stderr too
            if (msg.toLowerCase().includes('error')) {
                broadcastLog(`[Result] ${msg.substring(0, 100)}...`);
            }
        });


        child.on('close', (code) => {
            // Cleanup props file
            if (fs.existsSync(propsFile)) fs.unlinkSync(propsFile);

            if (code === 0) {
                broadcastLog(`[Render] Success! Video saved to ${path.basename(outputFile)}`);
                res.json({ success: true, videoPath: outputFile, filename: path.basename(outputFile) });
            } else {
                broadcastLog(`[Render] Failed with exit code ${code}`);
                res.status(500).json({ error: "Rendering failed", code });
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/generate-story', async (req, res) => {
    console.log('[API] POST /api/generate-story triggered');
    const { product, highlights, platform, additionalInfo = '' } = req.body;

    const specs = dictionary.kenshi_specs || {};
    const styles = dictionary.gtts_styles || {};

    let autoTrends = "";
    try {
        const trendData = await getOrRefreshTrends("Automotive/Motorcycle");
        autoTrends = typeof trendData === 'object' ? JSON.stringify(trendData) : trendData;
    } catch (e) {
        console.error("Trend fetch failed:", e);
    }

    const fullTrendContext = `
    USER HIGHLIGHTS: ${highlights}
    ----------------
    AUTOMATED MARKET TRENDS (Last 24h):
    ${autoTrends}
    `;

    const specsText = `
    - Material: ${specs.material}
    - Thickness: ${specs.thickness}
    - Sound: ${specs.sound_character}
    - Features: ${specs.features?.join(", ")}
    `;

    let prompt = `SYSTEM: YOU ARE 'ANAK MOTOR' (BIKER BROTHERHOOD).
GOAL: Write 3 Storytelling Scripts (25-35s) that feel cinematic.
PRODUCT: ${product}
SPECS: ${specsText}
CONTEXT: ${fullTrendContext}

CRITICAL INSTRUCTION:
1. **VIBE**: Emotional, Deep.
2. **HOOK**: "Pernah gak sih..."
3. **FLOW**: Drama -> Bridge -> Hero (Kenshi) -> CTA.
4. **TAG PLACEMENT (CRITICAL)**:
   - **RULE**: Tags MUST be at the **START** of the sentence/phrase.
   - **WRONG**: "Aku nyesel beli itu [emosi: kecewa]" ❌
   - **RIGHT**: "[emosi: kecewa] Sumpah, aku nyesel banget." ✅
   - **CONTEXT**: Ensure the tag matches the sentiment of the text following it.
   - **WORD COUNT**: Strictly under 90 words.

OUTPUT FORMAT:
## Story 1: [Judul]
### 🎙️ Style & Voice
${styles.instructions_template} [DEEP/EMOTIONAL] dialek [DIALECT].
### 📝 NARRATIVE
[emosi: ...] [Start text...]`;

    try {
        const result = await runGemini(prompt, 'Story');
        res.json({ result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/director-plan', upload.single('audioFile'), async (req, res) => {
    console.log("[API] POST /api/director-plan triggered");
    let { script = '', audio = {} } = req.body || {};

    // Parse 'audio' if it came as stringified JSON from FormData
    if (typeof audio === 'string') {
        try { audio = JSON.parse(audio); } catch (e) { }
    }

    // 0. HANDLE AUDIO FILE UPLOAD (AI Transcription)
    if (req.file) {
        console.log("🎤 Audio file detected:", req.file.path);
        broadcastLog("Analyzing audio file with Gemini AI...");

        const analysis = await transcribeAndAnalyzeAudio(req.file.path, req.file.mimetype);
        if (analysis) {
            console.log("✅ Audio Analysis Success:", JSON.stringify(analysis, null, 2));
            broadcastLog("Transcription complete.");

            // Override/Fill data from Audio Analysis
            // Handle massive potential key variations from LLM
            const detectedScript = analysis.script_text || analysis.scriptText || analysis.script || analysis.text || "";

            if (detectedScript && detectedScript.length > 5) {
                script = detectedScript;
            } else {
                console.warn("⚠️ Analysis returned empty script.");
                broadcastLog("⚠️ Audio transcribed but text was empty.");
            }

            audio = {
                durationSec: analysis.duration_sec || analysis.duration || 0,
                emotionTimeline: analysis.emotion_timeline || analysis.emotions || [],
                cueWords: analysis.cue_words || analysis.cues || []
            };
        } else {
            console.error("❌ Audio analysis returned null.");
            broadcastLog("⚠️ Audio analysis failed. Using specific fallback.");
        }
    }

    if ((!script || typeof script !== 'string' || script.length < 5) && req.file) {
        // If we have an audio file but no script yet (transcription failed), 
        // we should try to fail gracefully or use a placeholder to let the Director AI try to guess from context?
        // No, Director AI needs a script.
        return res.status(400).json({
            error: 'Audio Transcription Failed. Please ensure the audio is clear or try uploading again.'
        });
    }




    if (!script || typeof script !== 'string') {
        return res.status(400).json({ error: 'script is required' });
    }


    // 1. Contextualize with Video Database
    const keywords = (script || "").toLowerCase().split(/\W+/).filter(w => w.length > 3).slice(0, 10);
    const dbResults = videoDAO.searchForensics(keywords.join(' '));

    let footageInsights = "No specific footage found in database for these keywords.";
    if (dbResults && dbResults.length > 0) {
        footageInsights = "AVAILABLE FOOTAGE IN DATABASE (Prioritize these):\n" +
            dbResults.map(r => `- [${r.video_id}] ${r.description} (Emotions: ${r.emotions})`).join('\n');
    }

    const DirectorAgent = require('./agents/DirectorAgent');

    try {
        const plan = await DirectorAgent.generatePlan(script, audio, footageInsights, runGemini);

        // Return Plan AND the source data (script, audioAnalysis) for frontend visualization
        res.json({
            plan,
            script,
            audioAnalysis: audio
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



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


// [REMOVED] Duplicate Auto Render Endpoint (Plan + Render) - Logic merged into first endpoint
// app.post('/api/auto-render', async (req, res) => { ... });

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});


