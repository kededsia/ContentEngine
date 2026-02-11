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

// Helper to run Gemini with retries using spawn for safer arg handling
// Helper to run Gemini with retries using spawn for safer arg handling
const runGemini = (prompt, taskType = 'Content', retries = 2) => {
    return new Promise((resolve, reject) => {
        console.log(`[Gemini] Spawning process for ${taskType}... (Retries left: ${retries})`);

        // Use shell: true to support command resolution on Windows
        // This avoids issues with newlines in arguments that break exec
        const child = spawn('gemini', ['prompt', prompt], { shell: true });

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
            if (code !== 0) {
                console.error(`[Gemini Error] Exit Code: ${code}, Stderr: ${stderr}`);
                // If it failed with code 1, it might be the CLI failing.
                // We reject, which sends 500 error to client.
                return reject(new Error(stderr || `Gemini exited with code ${code}`));
            }

            let output = stdout.trim();


            const cleaned = cleanOutput(output);

            // Validation Logic: Check for banned phrases in the CLEANED output
            // If we successfully removed the chatter, we should accept the result.
            // But we still want to block if the *entire* output was chatter (which would result in empty or short cleaned text).

            const isTooShort = cleaned.length < 100;

            // Re-check banned phrases only on CLEANED text to see if any slipped through
            const hasBanned = BANNED_PHRASES.some(phrase => {
                return cleaned.toLowerCase().includes(phrase.toLowerCase());
            });

            const hasHeader = cleaned.includes('## Script') || cleaned.includes('## Story'); // Generic header check

            if ((isTooShort || hasBanned || !hasHeader) && retries > 0) {
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
    const { product, highlights, platform } = req.body;

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

MANDATORY RULES for EACH VARIATION:
1. QUANTITY: Generate 3 DIFFERENT VARIATIONS.
2. HOOK: "SHOCK HOOK" (Max 5-6 words). High impact. EXPLOSIVE.
3. WORD COUNT: MAX 80 WORDS per variation (Strict for 30-35s duration).
4. CONTENT: 
   - Compare ${product} vs Competitors.
   - USE THE SPECS: Mention "${specs.material}" or "${specs.sound_character}".
5. FORMAT:
   - START with "## Script [Number]"
   - THEN "### 📝 NARRATIVE (GTTS)" (Just the spoken text, minimal punctuation for natural flow).
   - **IMPORTANT**: The Narrative MUST START with the Hook phrase.
   - **STRICT DURATION**: Total text must NOT exceed 80 words.
   - INSIDE NARRATIVE: Use [tag expresi: mood] tags FREQUENTLY (e.g. at the start of every sentence/phrase).
   - START NARRATIVE with Style Instruction: "di baca dengan nada [STYLE] ala video short dengan dialek [DIALECT] yang medok." (Adapt STYLE and DIALECT to the requested ones).
   - THEN "### 🎬 SCENE BREAKDOWN" (Visuals + Audio).
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
    const { product, highlights, platform } = req.body;

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
   - THEN "### 📝 NARRATIVE" (The spoken text ONLY).
   - **IMPORTANT**: The Narrative MUST START with the Hook phrase.
   - **LENGTH**: Total narrative text MUST be under 80 words.
   - INSIDE NARRATIVE: Use [tag expresi: mood] tags FREQUENTLY (e.g. at the start of every sentence/phrase).
   - START NARRATIVE with Style Instruction: "di baca dengan nada [STYLE] ala video short dengan dialek [DIALECT] yang medok." (Adapt STYLE and DIALECT to the requested ones).
   - THEN "### 🎬 VISUAL BREAKDOWN" (The scenes/visuals).
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
