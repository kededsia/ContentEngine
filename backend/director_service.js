const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = 3001; // Dedicated Port

app.use(cors());
app.use(bodyParser.json());

// Serve static files from data/raw_footage
app.use('/footage', express.static(path.join(__dirname, 'data', 'raw_footage')));

// --- CONFIGURATION ---

// Multer for Audio Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'data', 'raw_footage');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        cb(null, safeName);
    }
});
const upload = multer({ storage: storage });

// Load Dictionary (Optional, but good for context if needed later)
const dictionaryPath = path.join(__dirname, 'data', 'dictionary.json');
let dictionary = {};
try {
    if (fs.existsSync(dictionaryPath)) {
        dictionary = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));
        console.log("✅ [Director Service] Dictionary loaded.");
    }
} catch (err) {
    console.error("⚠️ [Director Service] Dictionary load failed:", err);
}

// Banned phrases for validation
const BANNED_PHRASES = [
    "Understood", "I understand", "Here is the", "Sure,", "Okay,", "I am ready",
    "I'll start", "Siap,", "Tentu,", "Baik,", "Mengerti", "Here's a", "Generating",
    "Acknowledged", "remain concise", "focus strictly", "What's the mission",
    "I will begin", "I have analyzed", "I will now", "explore the project", "examine the", "project files",
    "preferred persona", "project structure", "first command", "I'm ready", "I am ready", "Let's hit the road",
    "What's our first move?", "I am a non-interactive CLI agent", "I will search", "I will read", "I will examine"
];

// Task Validators
const TASK_VALIDATORS = {
    DirectorPlan: (cleaned) => (cleaned.startsWith('{') || cleaned.includes('```json')) && (cleaned.includes('segments') || cleaned.includes('script_analysis')),
    RemotionSkill: (cleaned) => cleaned.startsWith('{') && cleaned.includes('"tracks"') && cleaned.length >= 100,
    AudioAnalysis: (cleaned) => (cleaned.startsWith('{') || cleaned.includes('```json')) && cleaned.length >= 20
};

// --- HELPER FUNCTIONS ---

const cleanOutput = (text) => {
    let clean = text.trim();
    clean = clean.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    const lines = clean.split('\n');
    const filteredLines = lines.filter(line => {
        const lower = line.toLowerCase().trim();
        if (BANNED_PHRASES.some(phrase => lower.startsWith(phrase.toLowerCase()))) return false;
        if (lower.startsWith("i'll ") || lower.startsWith("i will ") || lower.startsWith("i am ") || lower.startsWith("i have ")) return false;
        return true;
    });
    return filteredLines.join('\n').trim();
};

const runGemini = (prompt, taskType = 'Content', retries = 1) => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        console.log(`[Gemini] Spawning process for ${taskType}...`);

        // Using gemini.cmd -p for direct prompting
        const child = spawn('gemini.cmd', ['-p', `${taskType}:`, '-o', 'text', '-e', 'none'], { shell: true });

        let stdout = '';
        let stderr = '';

        child.stdin.write(prompt);
        child.stdin.end();

        child.stdout.on('data', (data) => stdout += data.toString());
        child.stderr.on('data', (data) => stderr += data.toString());

        child.on('close', (code) => {
            const durationMs = Date.now() - startTime;
            console.log(`[Gemini] ${taskType} finished in ${durationMs}ms (exit: ${code})`);

            if (code !== 0 && !stdout.trim()) {
                console.warn(`[Gemini Warning] Exit Code: ${code}, Stderr: ${stderr}`);
                return reject(new Error(stderr || `Gemini exited with code ${code}`));
            }

            let output = stdout.trim();
            // Cleanup CLI logs
            output = output.replace(/^Loaded cached credentials\.\n/m, '');
            output = output.replace(/^Hook registry initialized with \d+ hook entries\n/m, '');
            output = output.trim();

            const cleanJSON = (text) => {
                const firstBrace = text.indexOf('{');
                const lastBrace = text.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    return text.substring(firstBrace, lastBrace + 1);
                }
                return text;
            };

            let cleaned = cleanJSON(output);

            // Basic validation check
            const validator = TASK_VALIDATORS[taskType];
            if (validator && !validator(cleaned)) {
                console.warn(`[Gemini Validation Failed] Type: ${taskType}`);
                if (retries > 0) {
                    // Retry logic
                    console.log(`[Gemini] Retrying ${taskType}...`);
                    return runGemini(prompt, taskType, retries - 1).then(resolve).catch(reject);
                }
            }

            resolve(cleaned);
        });

        child.on('error', (err) => reject(err));
    });
};

async function transcribeAndAnalyzeAudio(filePath) {
    console.log("[Whisper Local] Analyzing Audio:", filePath);
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', ['transcribe_whisper.py', filePath], { cwd: __dirname });
        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => stdout += data.toString());
        pythonProcess.stderr.on('data', (data) => stderr += data.toString());

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`[Whisper Error] Exit Code: ${code}, Stderr: ${stderr}`);
                return resolve({ error: "Whisper Transcription Failed", details: stderr });
            }
            try {
                // Whisper might print warnings/logs to stdout on some systems.
                // We need to extract the JSON part.
                let raw = stdout.trim();
                const firstBrace = raw.indexOf('{');
                const lastBrace = raw.lastIndexOf('}');

                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    raw = raw.substring(firstBrace, lastBrace + 1);
                }

                const jsonOutput = JSON.parse(raw);
                console.log("[Whisper Local] Success, text length:", jsonOutput.script_text.length);
                resolve(jsonOutput);
            } catch (e) {
                console.error("[Whisper Local] JSON Parse Error:", e);
                console.error("[Whisper Raw Output]:", stdout); // Log raw for debugging
                resolve({ error: "Invalid JSON from Whisper", details: stdout });
            }
        });
    });
}

// --- ENDPOINTS ---

// 1. Transcription Endpoint
app.post('/api/director-transcribe', upload.single('audioFile'), async (req, res) => {
    console.log('[API] POST /api/director-transcribe triggered');
    try {
        if (!req.file) return res.status(400).json({ error: "No audio file provided" });

        console.log(`[Director] analyzing audio: ${req.file.path}`);
        const analysis = await transcribeAndAnalyzeAudio(req.file.path);

        if (analysis.error) return res.status(500).json({ error: "Audio analysis failed: " + analysis.details });

        res.json({
            success: true,
            script: analysis.script_text,
            audioAnalysis: analysis,
            filename: req.file.filename // Return the cleaned filename
        });
    } catch (err) {
        console.error("[Transcription API Error]", err);
        res.status(500).json({ error: "Failed to transcribe: " + err.message });
    }
});

// 2. Plan Generation Endpoint
app.post('/api/director-plan-only', async (req, res) => {
    console.log('[API] POST /api/director-plan-only triggered');
    try {
        let { script, audioAnalysis, audioDuration } = req.body;

        if (!script) return res.status(400).json({ error: "No script provided" });

        // Get available footage
        const footageDir = path.join(__dirname, 'data', 'raw_footage');
        let availableFootage = [];
        try {
            if (fs.existsSync(footageDir)) {
                availableFootage = fs.readdirSync(footageDir).filter(f => f.endsWith('.mp4') || f.endsWith('.mov'));
            }
        } catch (e) {
            console.error("Failed to read footage dir:", e);
        }
        const footageList = availableFootage.length > 0 ? availableFootage.join(', ') : "No footage available.";

        // Build Prompt
        const prompt = `ROLE: You are a WORLD-CLASS Film Director.
GOAL: Build a highly engaging, converting video plan using specific visual effects.

AVAILABLE FOOTAGE (You MUST use these filenames if relevant):
[${footageList}]

INPUT SCRIPT:
"${script}"

AUDIO CONTEXT:
Duration: ${audioDuration || "Unknown"}s
Emotion Profile: ${JSON.stringify(audioAnalysis?.emotion_timeline || [])}

CREATIVE CAPABILITIES (STRICTLY USE THESE):
1. **VISUAL EFFECTS** (Apply to "visual_intent" or "rendering_effect"):
   - "ken_burns", "glitch", "bw_filter", "zoom_in", "none"
2. **TRANSITIONS**:
   - "fade", "slide", "wipe", "none"
3. **TEXT ANIMATIONS**:
   - "scale", "typewriter", "shake", "color_pulse"

CRITICAL: DO NOT OUTPUT REMOTION CODE, JSX, OR WIDTH/HEIGHT.
ONLY OUTPUT THE CREATIVE PLAN JSON BELOW.

MANDATORY OUTPUT FORMAT (JSON ONLY):
{
  "script_analysis": { "estimated_duration": number, "tone": string },
  "segments": [
      {
          "time_range": "0-3s",
          "script_text": "...",
          "visual_intent": "Show...",
          "suggested_footage": "filename.mp4 OR null", 
          "effect": "ken_burns",
          "transition": "fade",
          "text_overlay": "...",
          "text_animation": "scale"
      }
  ]
}
`;
        const planJsonStr = await runGemini(prompt, 'DirectorPlan');
        const plan = JSON.parse(planJsonStr);

        res.json({ success: true, plan: plan });

    } catch (err) {
        console.error("[Director Plan Error]", err);
        res.status(500).json({ error: "Failed to generate plan: " + err.message });
    }
});

// 3. Remotion Skill Endpoint
app.post('/api/remotion-skill', async (req, res) => {
    console.log('[API] POST /api/remotion-skill triggered');
    const { script, directorPlan, audioFilename, audioDuration } = req.body;

    const prompt = `SYSTEM: You are a Senior Remotion Developer.
GOAL: Convert a Director's Text Plan into a structured JSON "Skill Pack" for Remotion.

INPUT CONTEXT:
Script: "${script.substring(0, 200)}..."
Director Plan: ${typeof directorPlan === 'string' ? directorPlan : JSON.stringify(directorPlan, null, 2)}

TARGET SCHEMA (Use this EXACTLY):
{
  "width": 1080, "height": 1920, "fps": 30, "durationInFrames": number,
  "tracks": [
    {
      "type": "video",
      "clips": [
        { "src": "http://localhost:3001/footage/[filename].mp4", "startAt": number, "duration": number, "effect": "ken_burns", "transition": "fade" }
      ]
    },
    { "type": "audio", "clips": [...] },
    { "type": "text", "clips": [{ "content": string, "startAt": number, "duration": number, "textStyle": { "animation": "scale" } }] }
  ]
}
CRITICAL: 
1. OUTPUT PURE JSON.
2. If the director plan suggests a footage filename, USE IT in the "src" field as "http://localhost:3001/footage/FILENAME".
3. If no footage is suggested, use "public/placeholder.svg".
`;

    try {
        const result = await runGemini(prompt, 'RemotionSkill');
        const skillPack = JSON.parse(result);

        // FORCE INJECT AUDIO TRACK (Override AI)
        if (audioFilename) {
            const audioUrl = `http://localhost:3001/footage/${audioFilename}`;

            // Find audio track or create one
            let audioTrack = skillPack.tracks.find(t => t.type === 'audio');
            if (!audioTrack) {
                audioTrack = { type: 'audio', clips: [] };
                skillPack.tracks.push(audioTrack);
            }

            // Reset clips to just the main audio
            audioTrack.clips = [{
                src: audioUrl, // Use localhost URL for Remotion
                startAt: 0,
                duration: audioDuration || skillPack.durationInFrames / 30, // Fallback to video duration from AI
                volume: 1.0
            }];

            // Ensure total duration matches audio if audio is longer
            const audioFrames = Math.ceil((audioDuration || 0) * 30);
            if (audioFrames > skillPack.durationInFrames) {
                skillPack.durationInFrames = audioFrames;
            }
        }

        res.json({ skillPack });
    } catch (error) {
        console.error("Remotion Skill Error:", error);
        res.status(500).json({ error: "Failed to compile skill pack: " + error.message });
    }
});

// 4. Auto-Render Endpoint
app.post('/api/auto-render', async (req, res) => {
    console.log('[API] POST /api/auto-render triggered');
    const { plan } = req.body;
    if (!plan) return res.status(400).json({ error: "Missing 'plan' data" });

    const renderId = Date.now();
    const propsFile = path.join(__dirname, `../src/remotion/render-props-${renderId}.json`);
    const outputFile = path.join(__dirname, `../out/video-${renderId}.mp4`);
    const outDir = path.dirname(outputFile);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    try {
        fs.writeFileSync(propsFile, JSON.stringify({ plan }, null, 2));

        const cmd = process.platform === "win32" ? 'npx.cmd' : 'npx';
        const args = [
            'remotion', 'render', 'src/remotion/index.ts', 'MainVideo', outputFile,
            `--props=${propsFile}`, '--gl=angle', '--concurrency=1'
        ];

        console.log(`[Render] Starting: ${cmd} ${args.join(' ')}`);

        // Use shell: true for Windows npx.cmd to work correctly and avoid EINVAL
        const child = spawn(cmd, args, { cwd: path.join(__dirname, '..'), shell: true, stdio: 'inherit' }); // stdio inherit for better logs 

        // child.stdout.on('data'...) // With stdio: inherit, logs go to main console directly, which is safer for debugging now.

        // REMOVED to prevent crash. stdio: 'inherit' handles logging.
        // child.stdout.on('data', (d) => console.log(`[Remotion] ${d}`));
        // child.stderr.on('data', (d) => console.error(`[Remotion Err] ${d}`));

        // Respond immediately that render started
        res.json({
            success: true,
            message: "Rendering started in background",
            filename: `video-${renderId}.mp4`
        });

    } catch (e) {
        console.error("Render Launch Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎬 Director Service running on http://0.0.0.0:${PORT}`);
});
