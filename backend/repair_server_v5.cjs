const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const serverPath = path.join(__dirname, 'backend', 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// 1. Setup Gemini SDK (if not already there)
// We need to make sure `genAI` is initialized.
// Existing code uses `runGemini` with `spawn`.
// We will add the SDK initialization at the top if missing, or reuse/add it.

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
const endpointStart = content.indexOf("app.post('/api/generate-script'");
if (endpointStart !== -1) {
    content = content.substring(0, endpointStart) + fileParamsHelper + "\n\n" + content.substring(endpointStart);
}


// 3. Update /api/director-plan to handle Uploads
// We need to modify the route definition to use `upload.single('audioFile')`
// And handle the logic branch.

const oldDirectorRouteStart = content.indexOf("app.post('/api/director-plan', async (req, res) => {");
if (oldDirectorRouteStart !== -1) {
    // We replace the whole handler signature and body start
    // We need to find the specific block for `director-plan`

    // We will Replace the Route Definition line to include middleware
    // "app.post('/api/director-plan', upload.fields([{ name: 'audioFile', maxCount: 1 }]), async (req, res) => {"
    // Actually, `upload` is defined later in the file in the original code? 
    // Let's check where `upload` is defined.
    // It is defined around line 713: `const upload = multer...`
    // Attempting to use `upload` before definition will fail if we just blindly replace.
    // But `upload` const is hoisted? No, const is not hoisted.
    // We need to make sure `upload` is defined BEFORE `app.post('/api/director-plan'`.

    // Wait, in `server.js` view, `app.post('/api/director-plan'` is at line 593.
    // `multer` and `upload` are defined at line 698 and 713.
    // This means we CANNOT use `upload` in `/api/director-plan` unless we move the definition UP.

    // STRATEGY:
    // 1. Move Multer setup to the TOP of the file (after imports).
    // 2. Then update `director-plan`.

    // Let's find Multer block
    const multerStart = content.indexOf("const multer = require('multer');");
    const multerEnd = content.indexOf("const upload = multer({ storage: storage });") + 44;

    if (multerStart !== -1 && multerEnd !== -1) {
        const multerBlock = content.substring(multerStart, multerEnd);
        // Remove from old location
        content = content.substring(0, multerStart) + content.substring(multerEnd);

        // Insert after `const app = express();`
        const appInit = content.indexOf("const app = express();");
        content = content.substring(0, appInit + 22) + "\n\n" + multerBlock + "\n" + content.substring(appInit + 22);
        console.log("✅ Moved Multer configuration to top.");
    }

    // Now we can modify the route
    const routeRegex = /app\.post\('\/api\/director-plan', async \(req, res\) => \{/;
    const newRouteHeader = "app.post('/api/director-plan', upload.single('audioFile'), async (req, res) => {";

    content = content.replace(routeRegex, newRouteHeader);

    // Inside the route, we need logic to handle the file
    // We'll inject code at the start of the handler
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

    // We need to remove the old parameter parsing lines to avoid conflict/duplication
    // Old: 
    // const { script = '', audio = {} } = req.body || {};
    // if (!script || typeof script !== 'string') { ... }

    // We will simply regex replace the start of the function body to include our new logic
    // and let the rest flow.
    // However, if we just prepend, we have `script` declared twice if we aren't careful.

    // Let's replace the first few lines of the handler.
    const oldBodyStart = `    console.log(\`[API] POST / api / director - plan triggered\`);
    const { script = '', audio = {} } = req.body || {};

    if (!script || typeof script !== 'string') {
        return res.status(400).json({ error: 'script is required' });
    }`;

    // We replace it with:
    const newBodyStart = `    ${audioLogic}

    if (!script || typeof script !== 'string') {
        return res.status(400).json({ error: 'script is required (or audio file to transcribe)' });
    }`;

    // We need to attempt to match the old body start loosely mostly because of whitespace
    // We'll search for the first few unique strings
    const uniqueStr = "const { script = '', audio = {} } = req.body || {};";
    const loc = content.indexOf(uniqueStr, handlerStart);

    if (loc !== -1) {
        // We found it. We want to effectively replace from handlerStart to the end of the validation check.
        // But the verification check line might vary.
        // Let's just insert our logic BEFORE `const { script ...` and comment out the const declaration?
        // No, `let` is better.

        // Actually, easiest way: Just Rewrite the whole route handler beginning?
        // Risky if I miss something.

        // Let's try to replace the `const { script... }` line with our `let ...` + logic.
        content = content.replace(uniqueStr, ""); // Remove the old const line

        // Insert new logic right after the console.log which is usually first
        // The console.log key is `console.log(\`[API] POST / api / director - plan triggered\`);`
        // We might want to remove that too since we added a new console.log in audioLogic
        const oldConsole = /console\.log\(`\[API\] POST \/ api \/ director - plan triggered`\);/;
        content = content.replace(oldConsole, "");

        // Now insert audioLogic at handlerStart
        content = content.substring(0, handlerStart) + audioLogic + content.substring(handlerStart);
    }
}

fs.writeFileSync(serverPath, content, 'utf8');
console.log("✅ server.js updated with Multimedia Director Mode.");
