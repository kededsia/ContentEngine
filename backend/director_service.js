const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
require('dotenv').config();
const { videoDAO, db } = require('./database'); // Import Database Access

const app = express();
const PORT = 3001; // Dedicated Port

app.use(cors());
app.use(bodyParser.json());

// --- LOGGING SYSTEM ---
let logClients = [];
const broadcastLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    const logData = `[${timestamp}] ${message}`;
    logClients.forEach(client => {
        client.res.write(`data: ${JSON.stringify({ message: logData })}\n\n`);
    });
};

app.get('/api/logs', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
    });
    const clientId = Date.now();
    logClients.push({ id: clientId, res });
    res.write(`data: ${JSON.stringify({ message: "Connected to Director Log Stream..." })}\n\n`);
    req.on('close', () => { logClients = logClients.filter(c => c.id !== clientId); });
});

// Serve static files from data/raw_footage
app.use('/footage', express.static(path.join(__dirname, 'data', 'raw_footage')));
app.use('/temp_footage', express.static(path.join(__dirname, 'data', 'temp_footage'))); // Serving trims
app.use('/projects', express.static(path.join(__dirname, 'data', 'projects'))); // Per-project assets

// --- CONFIGURATION ---

// Artistic Handbook & Dictionary
const capabilitiesPath = path.join(__dirname, 'data', 'remotion_capabilities.json');
const dictionaryPath = path.join(__dirname, 'data', 'dictionary.json');

let remotionCapabilities = {};
let slangDictionary = {};

try {
    if (fs.existsSync(capabilitiesPath)) remotionCapabilities = JSON.parse(fs.readFileSync(capabilitiesPath, 'utf8'));
    if (fs.existsSync(dictionaryPath)) slangDictionary = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));
    console.log('✅ [Director Service] Handbook and Dictionary loaded.');
} catch (e) {
    console.warn('⚠️ [Director Service] Failed to load handbook/dictionary:', e.message);
}

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

const getEnrichedFootageDetails = () => {
    try {
        const footageDir = path.join(__dirname, 'data', 'raw_footage');
        if (!fs.existsSync(footageDir)) return "No footage available.";

        const files = fs.readdirSync(footageDir).filter(f => f.endsWith('.mp4') || f.endsWith('.mov'));
        if (files.length === 0) return "No footage files found.";

        const enriched = files.map(filename => {
            const video = videoDAO.getVideoByPath(path.join(footageDir, filename));
            let detail = `FILE: "${filename}"`;
            if (video) {
                // Get all forensics for this video id
                const segments = db.prepare('SELECT * FROM forensics WHERE video_id = ?').all(video.id);
                if (segments.length > 0) {
                    const descriptions = segments.map(s => `- [${s.start_time}s-${s.end_time}s]: ${s.description} (Tags: ${s.objects || 'none'})`).join('\n');
                    detail += `\n  CONTENTS:\n${descriptions}`;
                } else {
                    detail += " (No forensics available)";
                }
            }
            return detail;
        });

        return enriched.join('\n\n');
    } catch (e) {
        console.error("[Enrichment] Failed:", e);
        return "Failed to read database metadata.";
    }
};

const createProjectFolder = (projectId) => {
    const projectDir = path.join(__dirname, 'data', 'projects', projectId);
    const assetsDir = path.join(projectDir, 'assets');
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
    return assetsDir;
};

const autoCleanupProjects = () => {
    const projectsDir = path.join(__dirname, 'data', 'projects');
    if (!fs.existsSync(projectsDir)) return;

    const now = Date.now();
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

    fs.readdir(projectsDir, (err, folders) => {
        if (err) return;
        folders.forEach(folder => {
            const folderPath = path.join(projectsDir, folder);
            fs.stat(folderPath, (err, stats) => {
                if (err) return;
                if (now - stats.mtimeMs > MAX_AGE) {
                    console.log(`[Cleanup] Removing old project folder: ${folder}`);
                    fs.rm(folderPath, { recursive: true, force: true }, () => { });
                }
            });
        });
    });
};

// Start cleanup cycle (every 6 hours)
setInterval(autoCleanupProjects, 6 * 60 * 60 * 1000);
autoCleanupProjects(); // Run once at startup

const runGemini = (prompt, taskType = 'Content', retries = 1) => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        console.log(`[Gemini] Spawning process for ${taskType}...`);
        broadcastLog(`[AI] Starting ${taskType} phase...`);

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
            broadcastLog(`[AI] ${taskType} completed (${(durationMs / 1000).toFixed(1)}s).`);

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
    broadcastLog(`[Whisper] Analyzing Audio: ${path.basename(filePath)}`);
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

        // Get available footage with ENRICHED forensics (This replaces the old simple list)
        const footageDetails = getEnrichedFootageDetails();

        // Build Prompt
        const prompt = `ROLE: You are a WORLD-CLASS Film Director.
GOAL: Build a highly engaging, converting video plan using specific visual effects.
Be CREATIVE. Use cinematic terminology.

AVAILABLE FOOTAGE (With Forensic Data):
${footageDetails}

INPUT SCRIPT:
"${script}"

AUDIO CONTEXT:
Duration: ${audioDuration || "Unknown"}s
Emotion Profile: ${JSON.stringify(audioAnalysis?.emotion_timeline || [])}

CREATIVE CAPABILITIES (STRICTLY USE THESE):
${JSON.stringify(remotionCapabilities, null, 2)}

SLANG & TONE DICTIONARY (Use these to match the "slang" style if the script is in Indonesian/Informal):
${JSON.stringify(slangDictionary?.slang || {}, null, 2)}

**CREATIVE ADAPTATION PROTOCOL**:
1. If specific footage is not an exact match for the script, find the **closest contextual match** (e.g., if you need a "Racing" shot but only have "Detail of Wheel", use "Detail of Wheel" and add a 'glitch' effect to imply intensity).
2. If NO related footage exists, **REDESIGN** the scene using "placeholder.svg" but add a strong "text_overlay" and "text_animation" to carry the message.
3. Match the "Artistic Impact" from the handbook with the "Audio Emotion" profile.

MANDATORY OUTPUT FORMAT (JSON ONLY):
{
  "script_analysis": { "estimated_duration": number, "tone": string },
  "global_style": { "vignette": boolean, "letterbox": boolean, "grain": boolean },
  "segments": [
      {
          "time_range": "0-3s",
          "script_text": "...",
          "visual_intent": "Show...",
          "suggested_footage": "filename.mp4 OR null", 
          "effect": "ken_burns",
          "transition": "fade",
          "text_overlay": "...",
          "text_animation": "spring_scale"
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
Handbook Reference: ${JSON.stringify(remotionCapabilities, null, 2)}

TARGET SCHEMA (Use this EXACTLY):
{
  "width": 1080, "height": 1920, "fps": 30, "durationInFrames": number,
  "vignette": boolean, "letterbox": boolean, "grain": boolean,
  "tracks": [
    {
      "type": "video",
      "clips": [
        { 
          "src": "http://127.0.0.1:3001/footage/[filename].mp4", 
          "startAt": number, 
          "duration": number, 
          "startFrom": number, // Seconds to offset in source (NATIVE TRIMMING)
          "effect": "ken_burns", 
          "transition": "fade", 
          "source_range": [number, number], // Optional for FFmpeg physical trim
          "useFfmpeg": boolean // True if segment is long and needs physical trim, false if native is enough
        }
      ]
    },
    { "type": "audio", "clips": [...] },
    { 
      "type": "text", 
      "clips": [{ 
        "content": string, 
        "startAt": number, 
        "duration": number, 
        "textStyle": { 
          "animation": "spring_scale", 
          "fontSize": number, 
          "color": "string (hex or vibrant colors)", 
          "fontFamily": "Impact, Montserrat, 'Bebas Neue', 'Segoe UI', serif",
          "bg": "rgba(0,0,0,0.5) OR null"
        } 
      }] 
    }
  ]
}
CRITICAL: 
1. OUTPUT PURE JSON.
2. NATIVE TRIMMING: Use "startFrom" to skip parts of the source video without physical trimming.
3. PHYSICAL TRIMMING: Only use "useFfmpeg: true" and "source_range" if the clip is very specific or from a huge source file (>60s). Prefer native trimming (useFfmpeg: false) for speed.
4. If no footage is suggested, use "public/placeholder.svg".
5. All video sources from the library MUST start with http://127.0.0.1:3001/footage/[filename].mp4
`;

    // FFmpeg Trimming Helper
    const trimVideo = async (sourceFile, start, end, targetFile) => {
        return new Promise((resolve, reject) => {
            const cmd = 'ffmpeg';
            // -ss before -i for fast seek, -to for duration/end
            // sourceFile must be absolute path
            const args = ['-y', '-ss', start.toString(), '-to', end.toString(), '-i', sourceFile, '-c', 'copy', targetFile];
            console.log(`[FFmpeg] Trimming: ${cmd} ${args.join(' ')}`);
            broadcastLog(`[Video] Trimming segment: ${path.basename(sourceFile)} (${start}s to ${end}s)`);

            const child = spawn(cmd, args, { shell: true });

            child.on('close', (code) => {
                if (code === 0) resolve(targetFile);
                else reject(new Error(`FFmpeg exited with code ${code}`));
            });
            child.on('error', (err) => reject(err));
        });
    };

    try {
        const projectId = `project_${Date.now()}`;
        const assetsDir = createProjectFolder(projectId);
        console.log(`[Project] Isolated environment created: ${projectId}`);
        broadcastLog(`[System] Initializing isolated project: ${projectId}`);

        const result = await runGemini(prompt, 'RemotionSkill');
        const skillPack = JSON.parse(result);

        // Map global styles from Director Plan if present
        if (directorPlan && directorPlan.global_style) {
            skillPack.vignette = !!directorPlan.global_style.vignette;
            skillPack.letterbox = !!directorPlan.global_style.letterbox;
            skillPack.grain = !!directorPlan.global_style.grain;
        }

        // POST-PROCESSING: TRIM VIDEOS & GATHER ASSETS
        const videoTrack = skillPack.tracks.find(t => t.type === 'video');
        if (videoTrack && videoTrack.clips) {
            for (let i = 0; i < videoTrack.clips.length; i++) {
                const clip = videoTrack.clips[i];
                const filename = clip.src.split('/').pop();
                const sourcePath = path.join(__dirname, 'data', 'raw_footage', filename);

                // Scenario A: Physical Trim (FFmpeg)
                if (clip.useFfmpeg && fs.existsSync(sourcePath) && clip.source_range && Array.isArray(clip.source_range)) {
                    try {
                        const trimName = `trim_${i}_${filename}`;
                        const trimPath = path.join(assetsDir, trimName);

                        await trimVideo(sourcePath, clip.source_range[0], clip.source_range[1], trimPath);
                        clip.src = `http://127.0.0.1:3001/projects/${projectId}/assets/${trimName}`;
                        clip.startFrom = 0;
                    } catch (trimErr) {
                        console.error("[Director] Trimming failed:", trimErr);
                    }
                }
                // Scenario B: Native Trim (startFrom) - Still map to project folder if we want total isolation (opt-in)
                // For now, let's just keep the original source URL to avoid redundant copies, 
                // BUT if it's missing from raw_footage, fallback to placeholder.
                else if (!fs.existsSync(sourcePath) && !clip.src.includes('placeholder')) {
                    console.warn(`[Director] Footage missing: ${filename}. Using placeholder.`);
                    clip.src = "public/placeholder.svg";
                }
            }
        }

        // FORCE INJECT AUDIO TRACK (Override AI)
        if (audioFilename) {
            // Copy audio to project assets if possible, or just use direct URL
            const audioUrl = `http://127.0.0.1:3001/footage/${audioFilename}`;

            let audioTrack = skillPack.tracks.find(t => t.type === 'audio');
            if (!audioTrack) {
                audioTrack = { type: 'audio', clips: [] };
                skillPack.tracks.push(audioTrack);
            }

            audioTrack.clips = [{
                src: audioUrl,
                startAt: 0,
                duration: audioDuration || skillPack.durationInFrames / 30,
                volume: 1.0
            }];

            const audioFrames = Math.ceil((audioDuration || 0) * 30);
            if (audioFrames > skillPack.durationInFrames) {
                skillPack.durationInFrames = audioFrames;
            }
        }

        // Return skillPack with projectId context
        res.json({ skillPack, projectId });
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
        broadcastLog(`[Render] Starting Remotion render engine...`);

        const child = spawn(cmd, args, { cwd: path.join(__dirname, '..'), shell: true });

        child.stdout.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) {
                // Look for Remotion progress (%) or specific key states
                if (msg.includes('%') || msg.includes('Rendering') || msg.includes('Success')) {
                    broadcastLog(`[Remotion] ${msg}`);
                }
                console.log(`[Remotion] ${msg}`);
            }
        });

        child.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) {
                console.error(`[Remotion Error] ${msg}`);
                broadcastLog(`[Error] ${msg}`);
            }
        });

        child.on('close', async (code) => {
            if (code === 0) {
                console.log(`[Render] Finished successfully: ${outputFile}`);
                broadcastLog(`[System] Render finished! Starting auto-ingest...`);

                try {
                    const finalFilename = `kenshi_video_${Date.now()}.mp4`;
                    const libraryPath = path.join(__dirname, 'data', 'raw_footage', finalFilename);

                    // Windows fix: Small delay to let Remotion release the handle, then copy + unlink
                    await new Promise(r => setTimeout(r, 1000));

                    fs.copyFileSync(outputFile, libraryPath);
                    fs.unlinkSync(outputFile);

                    console.log(`[Ingest] Moved to library: ${libraryPath}`);
                    broadcastLog(`[System] Video moved to library: ${finalFilename}`);

                    // Register in DB
                    const videoId = Date.now().toString();
                    videoDAO.addVideo({
                        id: videoId,
                        filename: finalFilename,
                        path: libraryPath,
                        duration: 0 // Will be updated by scanner if needed, or we could pass it here
                    });
                    console.log(`[Ingest] Registered in database: ${videoId}`);
                    broadcastLog(`[System] Success! Video ready in Library.`);
                } catch (ingestErr) {
                    console.error("[Ingest Error]", ingestErr);
                    broadcastLog(`[Error] Auto-ingest failed: ${ingestErr.message}`);
                }

                // CLEANUP TEMP FILES
                const tempDir = path.join(__dirname, 'data', 'temp_footage');
                if (fs.existsSync(tempDir)) {
                    fs.readdir(tempDir, (err, files) => {
                        if (err) return;
                        files.forEach(file => {
                            if (file.startsWith('trim_')) {
                                const filePath = path.join(tempDir, file);
                                fs.unlink(filePath, () => { });
                            }
                        });
                    });
                }
            } else {
                broadcastLog(`[Error] Render failed with code ${code}. Check logs.`);
            }
        });

        // Respond immediately that render started
        res.json({
            success: true,
            message: "Rendering started in background",
            renderId: renderId
        });

    } catch (e) {
        console.error("Render Launch Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎬 Director Service running on http://0.0.0.0:${PORT}`);
});
