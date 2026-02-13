require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

async function testSDK() {
    console.log("Testing Gemini SDK with gemini-2.0-flash...");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Explicitly using a model found in the list
    const modelName = "gemini-2.0-flash";

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
    const prompt = "Transcribe this audio and describe the emotions.";

    try {
        console.log(`\n🔄 Requesting ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([prompt, audioPart]);
        const response = await result.response;
        console.log(`✅ SUCCESS with ${modelName}!`);
        console.log("Response text:", response.text().substring(0, 200));
    } catch (error) {
        console.error(`❌ Failed with ${modelName}:`, error);
    }
}

testSDK();
