// Node 20+ has global fetch
// Node 18+ has global fetch

const API_BASE = 'http://localhost:3001/api';

async function runTest() {
    console.log("🚀 Testing Director Trimming Logic...");

    // Mock Payload simulating a Director Plan that requests a specific clip range
    const mockDirectorPlan = {
        script_analysis: { tone: "Test", estimated_duration: 15 },
        segments: [
            {
                script_text: "Opening scene",
                visual_intent: "Use raw footage 00:00-00:05",
                suggested_footage: "download.wav", // Filename present in raw_footage? Need to check what files exist
                time_range: "0-5s"
            }
        ]
    };

    // We need a real file in raw_footage to trim.
    // Let's assume '20260202_181933.mp4' exists from previous logs, or 'download.wav' (renamed to mp4?)
    // Wait, the previous logs showed '20260202_181933.mp4'. Let's use that.
    const TEST_FILENAME = "20260202_181933.mp4";

    // Mock Script for RemotionSkill prompt context
    const script = "Test scene with trimming.";

    try {
        console.log("sending request to /api/remotion-skill...");
        // PROBLEM: The /api/remotion-skill endpoint uses AI to generate the skill pack.
        // We can't easily force the AI to output 'source_range' unless the prompt is very strong or we mock the AI response.
        // BUT, we updated the prompt to support it.
        // Let's try to "trick" the AI by being very explicit in the 'directorPlan' text we send.

        // We'll inject a "force" instruction in the directorPlan string
        const forcedPlan = `
        {
            "segments": [
                {
                    "visual_intent": "Show specific part of video",
                    "suggested_footage": "${TEST_FILENAME}",
                    "source_range_instruction": "USE EXACTLY 00:00 to 00:05. source_range MUST BE [0, 5]."
                }
            ]
        }`;

        const res = await fetch(`${API_BASE}/remotion-skill`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                script: script,
                directorPlan: forcedPlan,
                audioFilename: null, // No audio override for this test
                audioDuration: 10
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        console.log("✅ Remotion Skill Response Received!");
        const tracks = data.skillPack.tracks;
        const videoTrack = tracks.find(t => t.type === 'video');

        if (videoTrack && videoTrack.clips.length > 0) {
            const clip = videoTrack.clips[0];
            console.log("   Clip Source:", clip.src);
            console.log("   Source Range:", clip.source_range);

            if (clip.src.includes('temp_footage/trim_')) {
                console.log("   🎉 SUCCESS: Clip was trimmed and points to temp file!");
            } else {
                console.log("   ⚠️ WARNING: Clip points to original file. Trimming might have failed or AI didn't output source_range.");
            }
        } else {
            console.error("   ❌ No video clips found.");
        }

    } catch (e) {
        console.error("❌ Test Failed:", e);
    }
}

runTest();
