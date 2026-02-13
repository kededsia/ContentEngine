const { videoDAO, init } = require('./database');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

init();

// --- GEMINI INTEGRATION ---
const getDirectorPlanFromAI = (scriptText) => {
    console.log("🎬 Asking AI Director to plan the video...");

    const prompt = `
You are a WORLD-CLASS CREATIVE DIRECTOR. Your goal is to turn a script into a visually stunning, emotionally resonant short video.

SCRIPT:
"${scriptText}"

INSTRUCTIONS:
1. Analyze the script line-by-line.
2. For each distinct segment/sentence, decide on the best visual representation.
3. PREFERENCE: Real footage (keywords: motorcycle, riding, road, exhaust, kenshi, garage, mechanic).
4. FALLBACK: If the scene is abstract or specific (e.g., "a burning passion inside"), describe an IMAGE to be generated.
5. Pacing: Determine the duration (in seconds) for each clip based on natural reading speed (fast-paced, energetic).

OUTPUT FORMAT:
Return ONLY a valid JSON object (no markdown, no extra text) with this structure:
{
    "segments": [
        {
            "id": 1,
            "text": "Script text for this segment",
            "duration": 3.5,
            "visualType": "video" OR "image",
            "keywords": ["motorcycle", "sunset", "fast"],
            "imagePrompt": "Detailed prompt for image generation if visualType is image...",
            "kenBurns": { "fromScale": 1.0, "toScale": 1.2, "panX": "left" } (Only for images)
        }
    ]
}
`;

    try {
        const child = spawnSync('gemini.cmd', ['-p', 'Director Plan:'], {
            input: prompt,
            encoding: 'utf-8',
            shell: true
        });

        if (child.error) throw child.error;

        let output = child.stdout.toString();
        // Clean markdown
        const match = output.match(/```json([\s\S]*?)```/);
        if (match) output = match[1];

        return JSON.parse(output.trim());
    } catch (e) {
        console.error("❌ AI Director failed:", e.message);
        return null;
    }
};

// --- MOCK IMAGE GENERATION ---
const generateImage = (prompt, outputPath) => {
    console.log(`🎨 [Mock] Generating Image: "${prompt}" -> ${outputPath}`);
    // In a real system, calling DALL-E or Midjourney here.
    // For now, we create a placeholder text image or just log it.
    // We'll rely on the frontend to show a placeholder if file missing, 
    // or we can copy a placeholder.jpg

    // Check if we have a test frame to use as placeholder
    const placeholder = path.join(__dirname, 'test_frame.jpg');
    if (fs.existsSync(placeholder)) {
        fs.copyFileSync(placeholder, outputPath);
    }
};

const generatePlan = (scriptText) => {
    // 1. Ask AI for the plan
    const aiPlan = getDirectorPlanFromAI(scriptText);

    // Fallback if AI fails: simple line-split
    const segments = aiPlan ? aiPlan.segments : scriptText.split('\n').filter(l => l.trim().length > 0).map((line, i) => ({
        text: line,
        duration: 3,
        visualType: 'video',
        keywords: line.split(' ')
    }));

    const composition = {
        width: 1080,
        height: 1920,
        fps: 30,
        durationInFrames: 0,
        tracks: [
            { type: 'video', clips: [] }, // Video/Image track
            { type: 'audio', clips: [] }, // Voiceover
            { type: 'text', clips: [] }   // Text Overlay
        ]
    };

    let currentTime = 0;

    // Ensure output directory for generated images
    const genImgDir = path.join(__dirname, 'data', 'generated_images');
    if (!fs.existsSync(genImgDir)) fs.mkdirSync(genImgDir, { recursive: true });

    segments.forEach((seg, index) => {
        let bestClip = null;

        // A. Video Search
        if (seg.visualType === 'video') {
            const query = seg.keywords.join(' ');
            console.log(`🔍 Segment ${index}: "${seg.text}" (Searching: ${query})`);

            const results = videoDAO.searchForensics(query);
            if (results.length > 0) {
                const match = results[0];
                bestClip = {
                    type: 'video',
                    src: match.video_path,
                    startFrom: match.start_time,
                    duration: seg.duration,
                    startAt: currentTime
                };
            } else {
                console.warn(`⚠️ No video found for "${seg.text}". Switching to Image Generation.`);
                seg.visualType = 'image';
                seg.imagePrompt = `Cinematic shot of ${seg.text}, 8k, photorealistic`;
            }
        }

        // B. Image Generation (Fallback or Intentional)
        if (seg.visualType === 'image') {
            const imgFilename = `gen_${Date.now()}_${index}.jpg`;
            const imgPath = path.join(genImgDir, imgFilename);

            generateImage(seg.imagePrompt, imgPath);

            bestClip = {
                type: 'image',
                src: imgPath,
                duration: seg.duration,
                startAt: currentTime,
                // Add Ken Burns data
                kenBurns: seg.kenBurns || { fromScale: 1, toScale: 1.15 }
            };
        }

        if (bestClip) {
            composition.tracks[0].clips.push(bestClip);
        }

        // C. Text Overlay
        composition.tracks[2].clips.push({
            type: 'text',
            content: seg.text,
            startAt: currentTime,
            duration: seg.duration
        });

        currentTime += seg.duration;
    });

    composition.durationInFrames = Math.ceil(currentTime * 30);
    return composition;
};

// CLI Usage
const args = process.argv.slice(2);
if (args.length > 0) {
    const scriptFile = args[0];
    if (fs.existsSync(scriptFile)) {
        const scriptContent = fs.readFileSync(scriptFile, 'utf8');
        const plan = generatePlan(scriptContent);

        const outputPath = 'video-plan.json';
        fs.writeFileSync(outputPath, JSON.stringify(plan, null, 2));
        console.log(`✅ Creative Plan generated: ${outputPath}`);
    } else {
        console.error("File not found:", scriptFile);
    }
}

module.exports = { generatePlan };
