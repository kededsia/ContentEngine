const { videoDAO, init } = require('./database');
const fs = require('fs');
const path = require('path');

init();

// Simple mock for semantic understanding. 
// In a real system, we might use Gemini to extract keywords from the script first.
const extractKeywords = (text) => {
    // Remove common words and return meaningful ones
    const stopWords = ['the', 'is', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'];
    return text.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopWords.includes(w));
};

const generatePlan = (scriptText) => {
    // 1. Parse Script (Assuming it's markdown or plain text)
    // For now, let's treat every new line as a scene/segment
    const lines = scriptText.split('\n').filter(line => line.trim().length > 0 && !line.startsWith('##'));

    const composition = {
        width: 1080,
        height: 1920, // Vertical video
        fps: 30,
        durationInFrames: 0,
        tracks: [
            { type: 'video', clips: [] },
            { type: 'audio', clips: [] }, // Voiceover placeholder
            { type: 'text', clips: [] }
        ]
    };

    let currentTime = 0; // in seconds

    lines.forEach((line, index) => {
        // Estimate duration based on word count (approx 2.5 words per second)
        const wordCount = line.split(' ').length;
        const duration = Math.max(2, wordCount / 2.5); // Min 2 seconds

        // Find matching footage
        const keywords = extractKeywords(line);
        // Add "motorcycle" context if missing to ensure we get relevant clips
        if (!keywords.includes('motorcycle') && !keywords.includes('bike')) keywords.push('motorcycle');

        const query = keywords.join(' ');
        console.log(`Segment ${index}: "${line}" (Keywords: ${query})`);

        const results = videoDAO.searchForensics(query);
        let bestClip = null;

        if (results.length > 0) {
            // Pick random or best match
            const match = results[0]; // Naive: matches[0]
            bestClip = {
                type: 'video',
                src: match.video_path,
                startFrom: match.start_time,
                duration: duration,
                startAt: currentTime
            };
        } else {
            console.warn(`No footage found for: "${line}". Using placeholder/black.`);
            // TODO: Fallback logic
        }

        if (bestClip) {
            composition.tracks[0].clips.push(bestClip);
        }

        // Add Text Overlay
        composition.tracks[2].clips.push({
            type: 'text',
            content: line,
            startAt: currentTime,
            duration: duration
        });

        currentTime += duration;
    });

    composition.durationInFrames = Math.ceil(currentTime * 30);
    return composition;
};

// CLI Usage
const args = process.argv.slice(2);
if (args.length > 0) {
    const scriptFile = args[0];
    const scriptContent = fs.readFileSync(scriptFile, 'utf8');
    const plan = generatePlan(scriptContent);

    const outputPath = 'video-plan.json';
    fs.writeFileSync(outputPath, JSON.stringify(plan, null, 2));
    console.log(`Plan generated: ${outputPath}`);
}

module.exports = { generatePlan };
