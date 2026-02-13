const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'videos.db');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath, { verbose: null }); // Disable verbose logging
db.pragma('journal_mode = WAL');
const mode = db.pragma('journal_mode', { simple: true });
console.log(`[Database] Journal Mode: ${mode}`);

// Initialize Schema
const init = () => {
    // Videos Table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS videos (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            path TEXT NOT NULL,
            duration REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // Forensics Table (Segments)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS forensics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id TEXT NOT NULL,
            start_time REAL NOT NULL,
            end_time REAL NOT NULL,
            description TEXT,
            emotions TEXT, -- JSON array
            objects TEXT,  -- JSON array
            audio_tags TEXT, -- JSON array
            FOREIGN KEY(video_id) REFERENCES videos(id) ON DELETE CASCADE
        )
    `).run();

    // Trends Table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS trends (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT UNIQUE NOT NULL,
            data JSON NOT NULL,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    console.log("✅ Database initialized.");
};

// Data Access Object
const videoDAO = {
    addVideo: (video) => {
        const stmt = db.prepare('INSERT INTO videos (id, filename, path, duration) VALUES (@id, @filename, @path, @duration)');
        return stmt.run(video);
    },

    getVideoByPath: (path) => {
        return db.prepare('SELECT * FROM videos WHERE path = ?').get(path);
    },

    getAllVideos: () => {
        return db.prepare('SELECT * FROM videos ORDER BY created_at DESC').all();
    },

    getVideoById: (id) => {
        return db.prepare('SELECT * FROM videos WHERE id = ?').get(id);
    },

    deleteVideo: (id) => {
        return db.prepare('DELETE FROM videos WHERE id = ?').run(id);
    },

    addForensicSegment: (segment) => {
        const stmt = db.prepare(`
            INSERT INTO forensics (video_id, start_time, end_time, description, emotions, objects, audio_tags)
            VALUES (@video_id, @start_time, @end_time, @description, @emotions, @objects, @audio_tags)
        `);
        return stmt.run(segment);
    },

    searchForensics: (query) => {
        // Simple text search for now. 
        // In future: Vector search or more complex filtering.
        const q = `%${query}%`;
        return db.prepare(`
            SELECT f.*, v.path as video_path 
            FROM forensics f
            JOIN videos v ON f.video_id = v.id
            WHERE description LIKE ? OR emotions LIKE ? OR objects LIKE ?
            LIMIT 20
        `).all(q, q, q);
    },

    // Trends DAO
    saveTrend: (category, data) => {
        const stmt = db.prepare(`
            INSERT INTO trends (category, data, last_updated)
            VALUES (@category, @data, CURRENT_TIMESTAMP)
            ON CONFLICT(category) DO UPDATE SET
            data = excluded.data,
            last_updated = CURRENT_TIMESTAMP
        `);
        return stmt.run({ category, data: JSON.stringify(data) });
    },

    getTrend: (category) => {
        const row = db.prepare('SELECT * FROM trends WHERE category = ?').get(category);
        if (row) {
            return {
                ...row,
                data: JSON.parse(row.data)
            };
        }
        return null;
    }
};

module.exports = { init, videoDAO, db };
