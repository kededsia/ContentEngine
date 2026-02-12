#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { generatePlan } = require('./generate_video_plan');
const { videoDAO, init } = require('./database');

// Initialize DB
init();

const COMMANDS = {
    INGEST: 'ingest',
    PLAN: 'plan',
    RENDER: 'render',
    AUTO: 'auto',
    HELP: 'help'
};

const args = process.argv.slice(2);
const command = args[0];
const param = args[1];

if (!command || command === COMMANDS.HELP) {
    console.log(`
    🎬 Kenshi Video System CLI 🎬
    =============================
    
    Usage:
      node video_cli.js ingest <filename>   -> Analyze raw footage
      node video_cli.js plan <script_file>  -> Generate video-plan.json
      node video_cli.js render <plan_file>  -> Render MP4 from plan
      node video_cli.js auto <script_file>  -> Plan + Render
    
    Examples:
      node video_cli.js ingest motor1.mp4
      node video_cli.js auto script.txt
    `);
    process.exit(0);
}

const runCommand = (cmd, args, cwd = __dirname) => {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: 'inherit', cwd, shell: true });
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Command failed with code ${code}`));
        });
    });
};

const ingest = async (filename) => {
    console.log(`\n📥 Starting Ingestion for: ${filename}`);
    try {
        await runCommand('node', ['ingest.js', filename]);
    } catch (e) {
        console.error("❌ Ingestion Failed:", e.message);
    }
};

const plan = async (scriptPath) => {
    console.log(`\n📝 Generating Plan from: ${scriptPath}`);
    try {
        if (!fs.existsSync(scriptPath)) throw new Error(`Script file not found: ${scriptPath}`);
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');

        const composition = generatePlan(scriptContent);

        // Save to src/remotion/public/video-plan.json (or similar accessible path)
        // Remotion needs to read this. For now, let's save to a centralized place.
        // Actually, passing data to Remotion via CLI args is tricky if large.
        // Better to save to a file that Remotion imports or reads.

        const outputPath = path.join(__dirname, '..', 'video-plan.json'); // Root of project
        fs.writeFileSync(outputPath, JSON.stringify(composition, null, 2));

        console.log(`✅ Plan saved to: ${outputPath}`);
        return outputPath;
    } catch (e) {
        console.error("❌ Planning Failed:", e.message);
        process.exit(1);
    }
};

const render = async () => {
    console.log(`\n🎥 Rendering Video...`);
    try {
        // We need to ensure Remotion reads the plan we just saved.
        // We can pass input props via --props
        const planPath = path.join(__dirname, '..', 'video-plan.json');
        if (!fs.existsSync(planPath)) throw new Error("No video-plan.json found. Run 'plan' first.");

        // Read plan to pass as props? Or let Remotion read file?
        // Passing as file path is cleaner if we modify Root.tsx to read it.
        // For CLI "props" flag:
        // remotion render src/remotion/index.ts MainVideo out.mp4 --props=./video-plan.json

        await runCommand('npx', [
            'remotion', 'render',
            'src/remotion/index.ts',
            'MainVideo',
            'out/final_video.mp4',
            '--props=./video-plan.json'
        ], path.join(__dirname, '..')); // Run in Root (c:\KONSEP)

        console.log(`\n✨ Video Rendered: c:\\KONSEP\\out\\final_video.mp4`);
    } catch (e) {
        console.error("❌ Rendering Failed:", e.message);
    }
};

// Main Execution Flow
(async () => {
    switch (command) {
        case COMMANDS.INGEST:
            if (!param) return console.error("Missing filename!");
            await ingest(param);
            break;

        case COMMANDS.PLAN:
            if (!param) return console.error("Missing script file!");
            await plan(param);
            break;

        case COMMANDS.RENDER:
            await render();
            break;

        case COMMANDS.AUTO:
            if (!param) return console.error("Missing script file!");
            await plan(param);
            await render();
            break;

        default:
            console.error(`Unknown command: ${command}`);
    }
})();
