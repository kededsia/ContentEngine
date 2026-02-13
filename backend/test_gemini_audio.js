const { spawn } = require('child_process');
const path = require('path');

// MOCK the file path provided by user
const TEST_AUDIO_PATH = String.raw`C:\Users\USER\Downloads\download (1).wav`;

// Minimal runGemini replica
const runGemini = (prompt) => {
    return new Promise((resolve, reject) => {
        console.log(`[Test] Spawning Gemini CLI...`);
        // We use the exact same command as server.js
        const child = spawn('gemini.cmd', ['-p', 'AudioTest:', '-o', 'text', '-e', 'none'], { shell: true });

        let stdout = '';
        let stderr = '';

        child.stdin.write(prompt);
        child.stdin.end();

        child.stdout.on('data', (data) => {
            process.stdout.write(data); // Stream to console to see what happens
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            console.log(`[Test] Finished with code ${code}`);
            if (code !== 0) {
                console.error(`[Test Error] Stderr: ${stderr}`);
            }
            resolve(stdout);
        });
    });
};

async function test() {
    console.log("Testing Gemini CLI with Audio File Path instruction...");

    // The prompt used in server.js
    const prompt = `
    ROLE: Expert Audio Analyst & Director.
    TASK: Analyze the audio file located at: "${TEST_AUDIO_PATH}"
    
    INSTRUCTIONS:
    1. Listen to/Process the audio file.
    2. Transcribe the spoken words verbatim.
    3. Analyze emotions and timing.
    
    OUTPUT FORMAT (JSON ONLY):
    {
        "script_text": "Verbatim transcript...",
        "duration_sec": <number>,
        "emotion_timeline": [ { "atSec": 0.0, "emotion": "..." } ],
        "cue_words": [ { "atSec": 0.5, "word": "..." } ]
    }
    `;

    try {
        const result = await runGemini(prompt);
        console.log("\n------ RESULT ------\n");
        console.log(result);
    } catch (e) {
        console.error("Test Failed:", e);
    }
}

test();
