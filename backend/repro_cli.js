const { spawn } = require('child_process');
const path = require('path');

const framePath = path.join(__dirname, 'test_frame.jpg');

// Complex multiline prompt
const prompt = `Analyze this image file: "${framePath}"
        
        Return a valid JSON object with:
        {
          "description": "Brief visual description",
          "emotions": ["list", "of", "emotions"],
          "objects": ["list", "of", "objects"],
          "audio_tags": ["inferred", "audio"]
        }
        
        IMPORTANT: Return ONLY the JSON object. No conversational text. No markdown formatting if possible.`;

console.log("Testing with stdin piping...");

const child = spawn('gemini.cmd', ['-p', 'Analyze:'], {
    encoding: 'utf-8',
    shell: true
});

child.stdin.write(prompt);
child.stdin.end();

child.stdout.on('data', (data) => console.log(`Stdout: ${data}`));
child.stderr.on('data', (data) => console.log(`Stderr: ${data}`));
child.on('close', (code) => console.log(`Status: ${code}`));
child.on('error', (err) => console.error(`Error: ${err.message}`));
