const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Corrected path: We are running inside 'backend/', so server.js is in current dir
const serverPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// 1. Setup Gemini SDK (if not already there)
if (!content.includes('const genAI = new GoogleGenerativeAI')) {
    const sdkImport = `const { GoogleGenerativeAI } = require("@google/generative-ai");\n`;
    const sdkInit = `
// Gemini SDK Setup for Multimodal
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Use efficient model for audio
`;
    // Insert after require('dotenv').config();
    const splitPoint = content.indexOf("require('dotenv').config();");
    if (splitPoint !== -1) {
        content = content.substring(0, splitPoint + 27) + sdkImport + sdkInit + content.substring(splitPoint + 27);
    } else {
        // Fallback
        content = sdkImport + content;
    }
}

// 2. Helper to Convert Audio File to GenerativePart
const fileParamsHelper = `
function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: fs.readFileSync(path).toString("base64"),
      mimeType
    },
  };
}

async function transcribeAndAnalyzeAudio(filePath, mimeType = "audio/mp3") {
    console.log("[Gemini SDK] Analyzing Audio:", filePath);
    try {
        const audioPart = fileToGenerativePart(filePath, mimeType);

        const prompt = \`
        ROLE: Expert Audio Analyst & Director.
        TASK: Listen to this audio track (Voiceover) and provide a structured analysis for video creation.
        
        OUTPUT FORMAT (JSON ONLY):
        {
            "script_text": "Verbatim transcript of the spoken words.",
            "duration_sec": <number>,
            "emotion_timeline": [
                { "atSec": 0.0, "emotion": "neutral" },
                { "atSec": 2.5, "emotion": "excited" }
            ],
            "cue_words": [
                { "atSec": 0.5, "word": "FirstWord" }
            ]
        }
        \`;

        const result = await model.generateContent([prompt, audioPart]);
        const response = await result.response;
        const text = response.text();
        
        // Clean markdown
        const cleaner = text.replace(/\\\`\\\`\\\`json/g, "").replace(/\\\`\\\`\\\`/g, "").trim();
        return JSON.parse(cleaner);
    } catch (error) {
        console.error("Gemini Audio Analysis Failed:", error);
        return null;
    }
}
`;

// Insert the helper function before the endpoints
// We check if it already exists to avoid duplication
if (!content.includes('async function transcribeAndAnalyzeAudio')) {
    const endpointStart = content.indexOf("app.post('/api/generate-script'");
    if (endpointStart !== -1) {
        content = content.substring(0, endpointStart) + fileParamsHelper + "\n\n" + content.substring(endpointStart);
    }
}


// 3. Update /api/director-plan to handle Uploads
// First, define Multer at the top if not correctly placed
const multerStart = content.indexOf("const multer = require('multer');");
// If Multer is defined LATE (after line 600), we move it up.
// But we might have already moved it in previous failed run? 
// Let's just normalize: ensure multer is near top.
// If we find it later in file, move it.

// Simple check: is multer defined before app.post('/api/director-plan')?
const directorRouteIndex = content.indexOf("app.post('/api/director-plan'");
if (multerStart > directorRouteIndex && directorRouteIndex !== -1) {
    const multerEnd = content.indexOf("const upload = multer({ storage: storage });") + 44;
    if (multerStart !== -1 && multerEnd !== -1) {
        const multerBlock = content.substring(multerStart, multerEnd);
        content = content.substring(0, multerStart) + content.substring(multerEnd);

        const appInit = content.indexOf("const app = express();");
        content = content.substring(0, appInit + 22) + "\n\n" + multerBlock + "\n" + content.substring(appInit + 22);
        console.log("✅ Moved Multer configuration to top.");
    }
}

// Now update the route handler
const routeRegex = /app\.post\('\/api\/director-plan', async \(req, res\) => \{/;
const newRouteHeader = "app.post('/api/director-plan', upload.single('audioFile'), async (req, res) => {";

if (content.match(routeRegex)) {
    content = content.replace(routeRegex, newRouteHeader);

    // Inject logic
    const handlerStart = content.indexOf(newRouteHeader) + newRouteHeader.length;

    const audioLogic = `
    console.log("[API] POST /api/director-plan triggered");
    let { script = '', audio = {} } = req.body || {};
    
    // Parse 'audio' if it came as stringified JSON from FormData
    if (typeof audio === 'string') {
        try { audio = JSON.parse(audio); } catch(e) {}
    }

    // 0. HANDLE AUDIO FILE UPLOAD (AI Transcription)
    if (req.file) {
        console.log("🎤 Audio file detected:", req.file.path);
        broadcastLog("Analyzing audio file with Gemini AI...");
        
        const analysis = await transcribeAndAnalyzeAudio(req.file.path, req.file.mimetype);
        if (analysis) {
            console.log("✅ Audio Analysis Success:", analysis);
            broadcastLog("Transcription complete.");
            
            // Override/Fill data from Audio Analysis
            script = analysis.script_text || script;
            audio = {
                durationSec: analysis.duration_sec || 0,
                emotionTimeline: analysis.emotion_timeline || [],
                cueWords: analysis.cue_words || []
            };
        } else {
            broadcastLog("⚠️ Audio analysis failed. Using fallback.");
        }
    }
    `;

    // Remove old header lines to prevent duplication
    const uniqueStr = "const { script = '', audio = {} } = req.body || {};";
    if (content.indexOf(uniqueStr, handlerStart) !== -1) {
        content = content.replace(uniqueStr, "");
        const oldConsole = /console\.log\(`\[API\] POST \/ api \/ director - plan triggered`\);/;
        content = content.replace(oldConsole, "");
        content = content.substring(0, handlerStart) + audioLogic + content.substring(handlerStart);
    }
}

fs.writeFileSync(serverPath, content, 'utf8');
console.log("✅ server.js updated with Multimedia Director Mode.");
