require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

async function testSDK() {
    console.log("Testing Gemini SDK with API Key...");

    if (!process.env.GEMINI_API_KEY) {
        console.error("❌ GEMINI_API_KEY is missing from process.env");
        return;
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Test with gemini-2.0-flash-exp first (often available) or fallbacks
    // The previous error said "gemini-1.5-flash" not found.
    const modelsToTry = ["gemini-1.5-flash", "gemini-2.0-flash-exp", "gemini-1.5-pro"];

    const testFilePath = "C:\\Users\\USER\\Downloads\\download (1).wav";
    if (!fs.existsSync(testFilePath)) {
        console.error(`❌ Test file not found at ${testFilePath}`);
        return;
    }

    const fileData = fs.readFileSync(testFilePath);
    const audioPart = {
        inlineData: {
            data: fileData.toString("base64"),
            mimeType: "audio/wav"
        }
    };
    const prompt = "Transcribe this audio.";

    for (const modelName of modelsToTry) {
        console.log(`\n🔄 Trying model: ${modelName}...`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent([prompt, audioPart]);
            const response = await result.response;
            console.log(`✅ SUCCESS with ${modelName}! Response:`);
            console.log(response.text().substring(0, 100) + "...");
            return; // Exit on first success
        } catch (error) {
            console.error(`❌ Failed with ${modelName}: ${error.message}`);
        }
    }
    console.error("\n❌ All models failed.");
}

testSDK();
