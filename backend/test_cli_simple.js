const { spawn } = require('child_process');

console.log("Testing Gemini CLI with simple prompt...");

const child = spawn('gemini', ['prompt', 'Hello'], { shell: process.platform === 'win32' });

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
