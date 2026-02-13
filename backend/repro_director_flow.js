const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const AUDIO_FILE = String.raw`C:\Users\USER\Downloads\download (1).wav`;
const API_BASE = 'http://localhost:3000/api';

async function runTest() {
    console.log("🚀 Starting Full Flow Test with:", AUDIO_FILE);

    if (!fs.existsSync(AUDIO_FILE)) {
        console.error("❌ Audio file not found:", AUDIO_FILE);
        return;
    }

    // 1. Test /api/director-plan (Upload Audio)
    console.log("\n[1/2] Testing POST /api/director-plan...");

    // Construct FormData manually since we are in Node
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const fileContent = fs.readFileSync(AUDIO_FILE);
    const filename = path.basename(AUDIO_FILE);

    let body = `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="audioFile"; filename="${filename}"\r\n`;
    body += `Content-Type: audio/wav\r\n\r\n`;

    // We send only the header + file + footer. 
    // Node clean concat is tricky with strings + buffers. 
    // Let's use a simpler approach: write a temporary client script or use standard libraries if possible.
    // Actually, let's just use the existing server functions if we can, OR simply use `fetch` with `formData` if we have `undici` or Node 18+.
    // Node 24 has native fetch and FormData.

    const formData = new FormData();
    // Native FormData in Node requires a Blob/File.
    // fs.openAsBlob is available in Node 18+
    const fileBlob = await fs.openAsBlob(AUDIO_FILE);
    formData.append('audioFile', fileBlob, filename);
    formData.append('script', ''); // Optional, but let's emulate UI sending blank script

    try {
        const res = await fetch(`${API_BASE}/director-plan`, {
            method: 'POST',
            body: formData
        });

        const text = await res.text();
        console.log("Status:", res.status);

        let json;
        try {
            json = JSON.parse(text);
        } catch (e) {
            console.error("❌ Failed to parse JSON response from /director-plan");
            console.error("RAW RESPONSE PREVIEW:", text.substring(0, 500) + "...");
            return;
        }

        if (!res.ok || json.error) {
            console.error("❌ API Error:", json);
            return;
        }

        console.log("✅ Plan Generated!");
        console.log("Plan Keys:", Object.keys(json.plan || {}));

        // Check if plan is string or object
        let plan = json.plan;
        if (typeof plan === 'string') {
            console.log("⚠️ Plan is a String. Attempting to parse...");
            try {
                plan = JSON.parse(plan);
                console.log("✅ Parsed Plan String successfully.");
            } catch (e) {
                console.error("❌ Plan string matches NO JSON format.");
                console.error("Raw Plan:", json.plan);
                return;
            }
        }

        // 2. Test /api/auto-render
        console.log("\n[2/2] Testing POST /api/auto-render...");
        console.log("Sending Plan with tracks:", plan.tracks?.length);

        const renderRes = await fetch(`${API_BASE}/auto-render`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan })
        });

        const renderJson = await renderRes.json();
        if (!renderRes.ok) {
            console.error("❌ Render API Error:", renderJson);
            return;
        }

        console.log("✅ Render Success!");
        console.log("Video Path:", renderJson.videoPath);

    } catch (e) {
        console.error("❌ Request Failed:", e);
    }
}

runTest();
