const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Create dummy video files
fs.writeFileSync('test_v1.mp4', 'dummy content');
fs.writeFileSync('test_v2.mp4', 'dummy content');

console.log("Testing Multi-Upload Endpoint...");

const curlCmd = `curl -v -F "videos=@test_v1.mp4" -F "videos=@test_v2.mp4" http://localhost:3000/api/ingest-upload`;

const child = spawn('powershell', ['-Command', curlCmd], { stdio: 'inherit' });

child.on('close', (code) => {
    console.log(`Curl finished with code ${code}`);
    // cleanup
    fs.unlinkSync('test_v1.mp4');
    fs.unlinkSync('test_v2.mp4');
});
