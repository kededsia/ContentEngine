const { videoDAO, init } = require('./database');

console.log("Initializing DB...");
init();

console.log("\n--- Checking Videos Table ---");
try {
    const videos = videoDAO.getAllVideos();
    console.log(`Found ${videos.length} videos:`);
    console.log(JSON.stringify(videos, null, 2));
} catch (e) {
    console.error("Error fetching videos:", e);
}

console.log("\n--- Checking Forensics Table ---");
try {
    const db = require('better-sqlite3')('data/videos.db');
    const forensics = db.prepare('SELECT COUNT(*) as count FROM forensics').get();
    console.log(`Found ${forensics.count} forensic segments.`);
} catch (e) {
    console.error("Error fetching forensics:", e);
}
