const testStoryGeneration = async () => {
    console.log("🚀 Testing /api/generate-story...");

    try {
        const response = await fetch('http://localhost:3000/api/generate-story', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                product: "Kenshi Hanzo Exhaust",
                highlights: "Stainless steel, bass sound, 1.2mm thickness",
                platform: "TikTok"
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const result = data.result;

        console.log("\n📄 RAW OUTPUT START\n");
        console.log(result);
        console.log("\n📄 RAW OUTPUT END\n");

        // Basic Validation
        const variations = (result.match(/## Story \d/g) || []).length;
        console.log(`✅ Variations Detected: ${variations}`);

        if (variations < 3) {
            console.error("❌ FAILED: Expected 3 variations, got " + variations);
            process.exit(1);
        }

        if (!result.includes("[emosi:") && !result.includes("[tekanan:") && !result.includes("[speed:")) {
            console.error("❌ FAILED: No GTTS tags detected (expected [emosi:], [tekanan:], or [speed:]).");
            process.exit(1);
        }

        const hooks = ["WHAAAT", "STOP", "ZONK", "SUMPAH", "WOW", "GILA"];
        const hasHook = hooks.some(hook => result.toUpperCase().includes(hook));

        if (!hasHook) {
            console.warn("⚠️ WARNING: Shock hook keywords might be missing. Check output manually.");
        } else {
            console.log("✅ Shock Hook Detected.");
        }

        // Check for POV ("Gue"/"Aku")
        const hasPOV = result.toLowerCase().includes("gue") || result.toLowerCase().includes("aku");
        if (!hasPOV) {
            console.warn("⚠️ WARNING: First-person POV ('Gue'/'Aku') NOT detected. Check if 'Anda/Kamu' is used.");
        } else {
            console.log("✅ First-Person POV Detected.");
        }

        // Check for Technical Logic
        const techTerms = ["glasswool", "frekuensi", "stainless", "ss304", "argon", "flow"];
        const hasTech = techTerms.some(term => result.toLowerCase().includes(term));
        if (!hasTech) {
            console.warn("⚠️ WARNING: Technical logic terms might be missing.");
        } else {
            console.log("✅ Technical Logic Detected.");
        }

        console.log("✅ Story Generation Verified Successfully!");

    } catch (error) {
        console.error("❌ Request Failed:", error.message);
    }
};

testStoryGeneration();
