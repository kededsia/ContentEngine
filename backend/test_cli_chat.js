const { spawn } = require('child_process');

console.log("Testing Gemini CLI with CHAT command...");

// Try 'chat' instead of 'prompt'
const child = spawn('gemini', ['chat', 'Hello'], { shell: true });

child.stdout.on('data', (data) => {
    console.log(`STDOUT: ${data}`);
});

child.stderr.on('data', (data) => {
    console.error(`STDERR: ${data}`);
});

child.on('close', (code) => {
    console.log(`Exited with code ${code}`);
});

child.on('error', (err) => {
    console.error('Failed to spawn:', err);
});
