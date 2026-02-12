const { init, videoDAO } = require('./database');
const { v4: uuidv4 } = require('uuid');

console.log("Testing Database...");

try {
    // 1. Initialize
    init();

    // 2. Add Dummy Video
    const videoId = uuidv4();
    const videoData = {
        id: videoId,
        filename: 'test_video.mp4',
        path: '/abs/path/to/test_video.mp4',
        duration: 60.5
    };

    console.log("Adding video...", videoData);
    videoDAO.addVideo(videoData);

    // 3. Add Dummy Forensic Data
    const forensicData = {
        video_id: videoId,
        start_time: 0,
        end_time: 5,
        description: "A motorcycle speeding down a highway at sunset.",
        emotions: JSON.stringify(["excitement", "freedom"]),
        objects: JSON.stringify(["motorcycle", "road", "sun"]),
        audio_tags: JSON.stringify(["engine_brap", "wind"])
    };

    console.log("Adding forensic segment...", forensicData);
    videoDAO.addForensicSegment(forensicData);

    // 4. Query
    console.log("Searching for 'motorcycle'...");
    const results = videoDAO.searchForensics('motorcycle');
    console.log("Search Results:", results);

    if (results.length > 0 && results[0].video_id === videoId) {
        console.log("✅ Database Test Passed!");
    } else {
        console.error("❌ Database Test Failed: No results found or mismatch.");
    }

} catch (err) {
    console.error("❌ Database Test Error:", err);
}
