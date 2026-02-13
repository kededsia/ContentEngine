const fs = require('fs');
const path = require('path');
// Node 22+ globals: fetch, FormData, Blob

const AUDIO_FILE = String.raw`C:\Users\USER\Downloads\download (1).wav`;
const API_BASE = 'http://localhost:3001/api';

async function runTest() {
    console.log("🚀 Starting Full Flow Test with:", AUDIO_FILE);

    if (!fs.existsSync(AUDIO_FILE)) {
        console.error("❌ Audio file not found:", AUDIO_FILE);
        // Create dummy if needed
        fs.writeFileSync(AUDIO_FILE, "RIFF....WAVEfmt ....data....");
    }

    // 1. Test /api/director-transcribe
    console.log("\n[1/3] Testing POST /api/director-transcribe...");

    const fileBuffer = fs.readFileSync(AUDIO_FILE);
    const fileBlob = new Blob([fileBuffer], { type: 'audio/wav' });

    const formData = new FormData();
    formData.append('audioFile', fileBlob, path.basename(AUDIO_FILE));

    let script = "";
    let analysis = {};
    let filename = "";

    try {
        const res = await fetch(`${API_BASE}/director-transcribe`, {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        console.log("✅ Transcription Success!");
        console.log("   Script Preview:", data.script.substring(0, 50) + "...");
        console.log("   Filename:", data.filename);

        script = data.script;
        analysis = data.audioAnalysis;
        filename = data.filename;

    } catch (e) {
        console.error("❌ Transcription Failed:", e);
        return;
    }

    // 2. Test /api/director-plan-only
    console.log("\n[2/3] Testing POST /api/director-plan-only...");
    let plan = {};

    try {
        const res = await fetch(`${API_BASE}/director-plan-only`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                script: script,
                audioAnalysis: analysis,
                audioDuration: analysis.duration_sec
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        console.log("✅ Plan Generation Success!");
        plan = data.plan;
        console.log("   Segments:", plan.segments.length);
        console.log("   First Segment Footage:", plan.segments[0].suggested_footage || "None");

    } catch (e) {
        console.error("❌ Plan Generation Failed:", e);
        return;
    }

    // 3. Test /api/remotion-skill
    console.log("\n[3/4] Testing POST /api/remotion-skill...");
    let skillPack = {};

    try {
        const res = await fetch(`${API_BASE}/remotion-skill`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                script: script,
                directorPlan: plan, // pass the whole plan object or stringified? backend handles either.
                audioFilename: filename,
                audioDuration: analysis.duration_sec
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        console.log("✅ Remotion Skill Success!");
        skillPack = data.skillPack;
        console.log("   Duration Frames:", skillPack.durationInFrames);

    } catch (e) {
        console.error("❌ Remotion Skill Failed:", e);
        return;
    }

    // 4. Test /api/auto-render
    console.log("\n[4/4] Testing POST /api/auto-render...");
    try {
        const res = await fetch(`${API_BASE}/auto-render`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                plan: skillPack // Send the Remotion Skill Pack as 'plan'
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        console.log("✅ Render Started!");
        console.log("   Output Filename:", data.filename);
        console.log("   Now we wait for file...");

    } catch (e) {
        console.error("❌ Render Start Failed:", e);
    }
}

runTest();
