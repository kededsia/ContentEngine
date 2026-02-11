const http = require('http');
const { exec } = require('child_process');

// Configuration
const API_URL = 'http://localhost:3000';
let serverProcess = null;

// Helper: Make HTTP Request
function makeRequest(path, method, body) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// Test: Generate Story ONLY
async function testGenerateStory() {
    console.log('\n[TEST] Testing Generate Story...');
    try {
        const payload = {
            product: "Kenshi Hanzo Test",
            highlights: "Suara Ngebass",
            platform: "Instagram",
            style: "Storytelling",
            tone: "Emotional",
            additionalInfo: "Test automation story",
            mode: "story"
        };

        const response = await makeRequest('/api/generate-story', 'POST', payload);

        if (response.status === 200 && response.body.result) {
            console.log('✅ Generate Story Passed');
            const hasStory2 = response.body.result.includes('## Story 2') || response.body.result.includes('## Story #2');
            console.log(`Variations Detected: ${hasStory2 ? '✅ Yes (3 Variations)' : '❌ No (Single Draft Only)'}`);
            console.log('Sample Story:', response.body.result.substring(0, 500));
            return true;
        } else {
            console.error('❌ Generate Story Failed', response);
            return false;
        }
    } catch (e) {
        console.error('❌ Generate Story Error:', e);
        return false;
    }
}

// Main Runner
async function runTests() {
    console.log('=== Starting Debug Test ===');

    // 1. Start Server
    console.log('Starting Backend Server...');
    serverProcess = exec('node server.js', { cwd: __dirname });

    serverProcess.stdout.on('data', (data) => {
        console.log(`[Server]: ${data}`); // ENABLE SERVER LOGGING
    });
    serverProcess.stderr.on('data', (data) => {
        console.error(`[Server Error]: ${data}`);
    });

    // Wait for server to boot
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 2. Run Test
    const storySuccess = await testGenerateStory();

    // 3. Cleanup
    console.log('\n=== Verification Summary ===');
    if (storySuccess) {
        console.log('✅ STORY TEST PASSED');
    } else {
        console.log('❌ STORY TEST FAILED');
    }

    // Kill Server
    if (serverProcess) {
        try {
            process.kill(serverProcess.pid); // Attempt graceful kill
            exec('taskkill /F /IM node.exe'); // Force kill
        } catch (e) { /* ignore */ }
    }
    process.exit(storySuccess ? 0 : 1);
}

runTests();
