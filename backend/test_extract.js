const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const videoPath = path.join(__dirname, 'data', 'raw_footage', 'VID_20260128_135955.mp4');
const outputPath = path.join(__dirname, 'test_frame.jpg');

console.log(`Extracting frame from: ${videoPath}`);

if (!fs.existsSync(videoPath)) {
    console.error("Video file not found!");
    process.exit(1);
}

ffmpeg(videoPath)
    .screenshots({
        timestamps: [1],
        filename: 'test_frame.jpg',
        folder: __dirname,
        size: '320x180'
    })
    .on('end', () => {
        console.log('Frame extracted successfully to test_frame.jpg');
    })
    .on('error', (err) => {
        console.error('Error extracting frame:', err);
    });
