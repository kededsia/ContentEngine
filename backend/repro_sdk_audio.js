require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

async function testSDK() {
    console.log("Testing Gemini SDK with API Key...");

    if (!process.env.GEMINI_API_KEY) {
        console.error("❌ GEMINI_API_KEY is missing from process.env");
        return;
    }
    console.log("✅ API Key found:", process.env.GEMINI_API_KEY.substring(0, 10) + "...");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Use a hardcoded path or a dummy file for test
    // attempting to use the user's file if accessible, or create a dummy one
    const testFilePath = "C:\\Users\\USER\\Downloads\\download (1).wav";

    if (!fs.existsSync(testFilePath)) {
        console.error(`❌ Test file not found at ${testFilePath}`);
        return;
    }
    console.log(`✅ Found test file: ${testFilePath}`);

    try {
        const fileData = fs.readFileSync(testFilePath);
        const audioPart = {
            inlineData: {
                data: fileData.toString("base64"),
                mimeType: "audio/wav"
            }
        };

        const prompt = "Transcribe this audio.";
        console.log("🚀 Sending request to Gemini...");

        const result = await model.generateContent([prompt, audioPart]);
        const response = await result.response;
        console.log("✅ SDK Success! Response text:");
        console.log(response.text());

    } catch (error) {
        console.error("❌ SDK Failed:", error);
    }
}

testSDK();
