const { spawn } = require('child_process');

/**
 * DirectorAgent
 * Encapsulates the creative logic for determining how a video should look based on script and audio.
 */
class DirectorAgent {
    constructor() {
        // Can inject dependencies here if needed (e.g., Gemini wrapper function)
    }

    /**
     * Generates a Video Plan (JSON) based on inputs.
     * @param {string} script - The transcribed text or script.
     * @param {object} audioAnalysis - Analysis data (emotions, cues, duration).
     * @param {string} footageInsights - Database search results for context.
     * @param {function} runGemini - Helper function to execute the prompt.
     * @returns {Promise<object>} - The VideoPlan JSON.
     */
    async generatePlan(script, audioAnalysis, footageInsights, runGemini) {
        // Estimate duration if missing
        const words = (script || "").trim().split(/\s+/).length;
        const estimatedDuration = audioAnalysis.durationSec || (words / 2.5); // Approx 2.5 words/sec

        const prompt = `ROLE: You are a meticulous Film Director + Remotion Planner.
GOAL: Build an executable directing plan (JSON) from script + audio cues.

INPUT SCRIPT:
${script}

AUDIO ANALYSIS:
DURATION: ${estimatedDuration}s
EMOTIONS: ${JSON.stringify(audioAnalysis.emotionTimeline || [])}
CUES: ${JSON.stringify(audioAnalysis.cueWords || [])}

FOOTAGE INSIGHTS:
${footageInsights}

TASK:
Generate a MINIFIED JSON object strictly following the 'VideoPlan' interface for Remotion.

INTERFACE STRUCTURE:
{
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "durationInFrames": <duration * 30>,
  "tracks": [
    {
      "type": "video",
      "clips": [
        {
           "src": "VISUAL_DESCRIPTION", 
           "startFrom": 0,
           "duration": <seconds>,
           "startAt": <seconds (cumulative)>,
           "transition": "fade" // Optional: "fade" or "none"
        }
      ]
    },
    {
      "type": "audio",
      "clips": [
        {
           "src": "Background music path or Voiceover",
           "startAt": 0,
           "duration": <total_duration>
        }
      ]
    },
    {
      "type": "text",
      "clips": [
        {
           "content": "KEYWORD ONLY",
           "startAt": <seconds>,
           "duration": <seconds>,
           "effect": "zoom" // Optional
        }
      ]
    }
  ]
}

CRITICAL RULES:
1. **VIDEO TRACK**: Fill ENTIRE duration. No gaps.
2. **Short Clips**: Max 2-3s per clip for dynamic pacing.
3. **Visualize**: Use "Cinematic", "Close-up", "Drone Shot" in description.
4. **Text**: Only 1-3 words per overlay. BIG IMPACT.
5. **JSON ONLY**: No markdown, no comments, no whitespace.

OUTPUT JSON:`;

        try {
            const result = await runGemini(prompt, 'DirectorPlan');
            // Ensure result is parsed JSON if runGemini returns string
            return typeof result === 'string' ? JSON.parse(result) : result;
        } catch (error) {
            console.error("[DirectorAgent] Generation failed:", error);
            throw error;
        }
    }
}

module.exports = new DirectorAgent();
