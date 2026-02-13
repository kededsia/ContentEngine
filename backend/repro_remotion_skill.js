// Node 18+ has global fetch by default

async function test() {
    console.log("Testing /api/remotion-skill...");
    try {
        const response = await fetch('http://localhost:3001/api/remotion-skill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                script: "Test script for remotion skill generation.",
                directorPlan: {
                    script_analysis: { estimated_duration: 10, tone: "Neutral" },
                    segments: []
                },
                audioDuration: 10
            })
        });

        const data = await response.json();
        if (response.ok) {
            console.log("✅ Success! Got skillPack:", data.skillPack ? "Yes" : "No");
            if (data.skillPack) console.log(JSON.stringify(data.skillPack, null, 2).substring(0, 200) + "...");
        } else {
            console.error("❌ Failed:", data);
        }
    } catch (e) {
        console.error("❌ Error:", e);
    }
}

test();
