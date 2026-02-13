require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    console.log("Listing available models...");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    try {
        // There isn't a direct "listModels" on the top level genAI object in some versions,
        // but let's try to access it via the API if possible or just infer from error.
        // Actually, the SDK doesn't expose listModels in the main helper, we might need to use the model manager if exposed,
        // or just use a raw fetch to the API endpoint to see what's up.

        // Let's use raw fetch to be sure
        const key = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            console.log("✅ Available Models:");
            data.models.forEach(m => {
                if (m.name.includes('gemini')) {
                    console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`);
                }
            });
        } else {
            console.error("❌ No models found or error:", JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error("❌ Failed to list models:", error);
    }
}

listModels();
