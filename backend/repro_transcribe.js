const fs = require('fs');
const path = require('path');
// Node 22 native fetch/FormData

// Configuration
const AUDIO_FILE = String.raw`C:\Users\USER\Downloads\download (1).wav`;
const API_URL = 'http://localhost:3000/api/director-transcribe';

async function runTest() {
    console.log("🚀 Testing /api/director-transcribe with:", AUDIO_FILE);

    if (!fs.existsSync(AUDIO_FILE)) {
        console.error("❌ Audio file not found:", AUDIO_FILE);
        // Create dummy if needed for testing flow, but real audio is better
        fs.writeFileSync(AUDIO_FILE, "RIFF....WAVEfmt ....data....");
    }

    const formData = new FormData();
    const fileBlob = new Blob([fs.readFileSync(AUDIO_FILE)], { type: 'audio/wav' });
    formData.append('audioFile', fileBlob, path.basename(AUDIO_FILE));

    try {
        console.log("Sending request...");
        const res = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });

        console.log("Response Status:", res.status);
        const text = await res.text();
        console.log("Raw Response:", text.substring(0, 500));

        if (!res.ok) {
            console.error("❌ Request failed");
        } else {
            const json = JSON.parse(text);
            console.log("✅ Success!");
            console.log("Script:", json.script);
            console.log("Analysis Keys:", Object.keys(json.audioAnalysis));
        }

    } catch (e) {
        console.error("❌ Network/Fetch Error:", e);
    }
}

runTest();
