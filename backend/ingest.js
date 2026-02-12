require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { spawnSync } = require('child_process');
const { videoDAO, init } = require('./database');
const { v4: uuidv4 } = require('uuid');

// Initialize DB
init();

// Configuration
const RAW_FOOTAGE_DIR = path.join(__dirname, 'data', 'raw_footage');
const PROCESSED_DIR = path.join(__dirname, 'data', 'processed_footage');
const TEMP_FRAME_DIR = path.join(__dirname, 'data', 'temp_frames');

// Ensure directories exist
[RAW_FOOTAGE_DIR, PROCESSED_DIR, TEMP_FRAME_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Helper: Get Video Duration
const getVideoDuration = (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata.format.duration);
        });
    });
};

// Helper: Extract Frame
const extractFrame = (videoPath, timestamp, outputPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .screenshots({
                timestamps: [timestamp],
                filename: path.basename(outputPath),
                folder: path.dirname(outputPath),
                size: '640x360' // Lower res for faster AI processing
            })
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(err));
    });
};

// Helper: Analyze Frame with Gemini CLI
const analyzeFrame = (framePath, timestamp) => {
    try {
        console.log(`   > Analyzing frame at ${timestamp}s with Gemini CLI...`);

        // CLI supports reading files if path is in prompt
        const prompt = `Analyze this image file: "${framePath}"
        
        Return a valid JSON object with:
        {
          "description": "Brief visual description",
          "emotions": ["list", "of", "emotions"],
          "objects": ["list", "of", "objects"],
          "audio_tags": ["inferred", "audio"]
        }
        
        IMPORTANT: Return ONLY the JSON object. No conversational text. No markdown formatting if possible.`;

        // Execute gemini CLI
        // FIX: Use simple prompt arg and pipe complex content via stdin to avoid shell escaping issues on Windows
        const child = spawnSync('gemini.cmd', ['-p', 'Analyze:'], {
            input: prompt,
            encoding: 'utf-8',
            shell: true
        });

        if (child.error) {
            console.error(`CLI spawn error: ${child.error.message}`);
            return null;
        }

        if (child.stderr && child.stderr.toString().trim().length > 0) {
            // Log stderr but don't fail immediately, some tools warn on stderr
            console.log(`[CLI Warning/Error]: ${child.stderr.toString()}`);
        }

        const output = child.stdout ? child.stdout.toString() : '';

        if (!output || output.trim().length === 0) {
            console.error(`CLI returned empty output. Status: ${child.status}`);
            return null;
        }

        // Robust JSON extraction
        // matches {...} including newlines
        // If markdown is used, it might be wrapped in ```json ... ```
        let jsonStr = output;

        // 1. Try to find markdown block
        const markdownMatch = output.match(/```json([\s\S]*?)```/);
        if (markdownMatch && markdownMatch[1]) {
            jsonStr = markdownMatch[1];
        } else {
            // 2. Try to find first { and last }
            const firstBrace = output.indexOf('{');
            const lastBrace = output.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonStr = output.substring(firstBrace, lastBrace + 1);
            }
        }

        // Clean up any potential comments or noise
        jsonStr = jsonStr.trim();

        try {
            return JSON.parse(jsonStr);
        } catch (parseErr) {
            console.error(`JSON Parse Error at ${timestamp}s:`, parseErr);
            console.error(`Raw Output:`, output); // Log raw output for debugging
            return null;
        }

    } catch (e) {
        console.error(`Error analyzing frame at ${timestamp}s:`, e.message);
        return null; // Skip if fails
    }
};

// Main Ingestion Function
const ingestVideo = async (filename) => {
    const inputPath = path.join(RAW_FOOTAGE_DIR, filename);
    const videoId = uuidv4();

    console.log(`Processing: ${filename} (ID: ${videoId})`);

    try {
        const duration = await getVideoDuration(inputPath);
        console.log(`Duration: ${duration}s`);

        // Add to DB
        videoDAO.addVideo({
            id: videoId,
            filename: filename,
            path: inputPath,
            duration: duration
        });

        // Analyze every 2 seconds
        const INTERVAL = 2.0;
        for (let t = 0; t < duration; t += INTERVAL) {
            const framePath = path.join(TEMP_FRAME_DIR, `${videoId}_${t}.jpg`);

            await extractFrame(inputPath, t, framePath);
            const forensics = analyzeFrame(framePath, t); // Synchronous CLI call

            if (forensics) {
                videoDAO.addForensicSegment({
                    video_id: videoId,
                    start_time: t,
                    end_time: Math.min(t + INTERVAL, duration),
                    description: forensics.description,
                    emotions: JSON.stringify(forensics.emotions),
                    objects: JSON.stringify(forensics.objects),
                    audio_tags: JSON.stringify(forensics.audio_tags)
                });
                console.log(`Saved segment ${t}s - ${t + INTERVAL}s: ${forensics.description.substring(0, 50)}...`);
            } else {
                console.log(`Skipped segment ${t}s (Analysis failed or no output)`);
            }

            // Clean up frame
            if (fs.existsSync(framePath)) fs.unlinkSync(framePath);
        }

        console.log(`✅ Finished processing ${filename}`);

    } catch (err) {
        console.error(`❌ Failed to process ${filename}:`, err);
    }
};

// CLI usage: node ingest.js <filename>
const args = process.argv.slice(2);
if (args.length > 0) {
    ingestVideo(args[0]);
} else {
    // Scan directory
    console.log("Scanning raw_footage...");
    const files = fs.readdirSync(RAW_FOOTAGE_DIR);
    for (const file of files) {
        if (file.endsWith('.mp4') || file.endsWith('.mov')) {
            const exists = videoDAO.getVideoByPath(path.join(RAW_FOOTAGE_DIR, file));
            if (!exists) {
                ingestVideo(file);
            } else {
                console.log(`Skipping ${file} (Already ingested)`);
            }
        }
    }
}
