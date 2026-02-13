# Director Service Extraction

- [x] Create `backend/director_service.js` with extracted logic
- [x] Clean up `backend/server.js`
- [x] Update `start_app.bat` to launch both servers
- [x] Update `src/pages/VideoLibrary.tsx` to use port 3001
- [x] Verify with reproduction scripts
- [x] Fix Render Crash & Add Audio
- [x] Fix Remotion Skill "Prompt Not Defined"
- [x] Smart Asset Selection & Crash Fix
- [x] Fix Render Output Missing
- [x] Save Restore Point

# Advanced Director Features (Trimming, Muting, Effects)
- [x] Backend Implementation (`director_service.js`)
    - [x] Import/Setup Database connection (Forensics table)
    - [x] Update Director Plan Prompt to include Forensic metadata
    - [x] Implement FFmpeg trimming logic in `remotion-skill`
    - [x] Cleanup temp files after render
- [x] Frontend Implementation (`MainVideo.tsx`)
    - [x] Add `muted={true}` to Video component
    - [x] Verify Effect props handling
- [x] Verification
    - [x] Create mock forensic data
    - [x] Run full flow: Plan -> Trim -> Render -> Verify Output

# Render Transparency & Auto-Ingest (Project 2.1)
- [x] Auto-Ingest Logic
    - [x] Move rendered video to `data/raw_footage`
    - [x] Register rendered video in `videos.db`
- [x] UI Transparency (Real-time Logs)
    - [x] Pipe Remotion stdout/stderr to SSE broadcast
    - [x] Add explicit lifecycle logs (Gathering, Trimming, Rendering)
- [x] Verification
    - [x] Verify rendered video appears in Video Library automatically
    - [x] Verify log streaming in Director Stage

# Bug Fixes (Trimming & Timeout Issues)
- [x] Fix Remotion Asset Timeout
    - [x] Switch `localhost` to `127.0.0.1` for faster/reliable resolution
    - [x] Increase `delayRenderTimeoutInMilliseconds` in `Video` component
- [x] Fix Truncated Path Query
    - [x] Investigate why DB logs show truncated `raw_foota` paths (Confirmed as better-sqlite10 logging artifact, harmless)
- [x] Optimize FFmpeg Trimming
    - [x] Implemented physical trim with FFmpeg and automated cleanup
- [x] Verification
    - [x] Verified with targeted audio `download.wav` - Success!

# Version Control
- [x] Push Changes to GitHub
    - [x] Initial Push (Advanced Director Features)
    - [x] Final Push (UI Stability & Connection Fixes)
    - [x] Push (Render Transparency & Auto-Ingest)

# Artistic & Cinematic Intelligence (Remotion 2.0)
- [x] Higher Artistic Director Intelligence
    - [x] Implement `spring` animations for Text
    - [x] Add Cinematic Overlays (Vignette, Letterbox, Grain)
    - [x] Expand Text Styles (Color, Position, Shadow, Font)
    - [x] Implement CSS Color Grading (Saturation, Contrast)
- [x] Native Remotion Trimming (No FFmpeg fallback)
    - [x] Update schema to support `startFrom` property
    - [x] Update `ClipRenderer` to utilize `startFrom`
    - [x] Add logic to skip FFmpeg if native trimming is preferred
# Project Orchestration & Adaptive Selection (Project 2.0)
- [x] Project-Based Folder Life-Cycle
    - [x] Implement `projects/[uuid]/assets` structure
    - [x] Update render pathing to use project folders
    - [x] Add auto-cleanup for project directories
- [x] Creative Adaptation Logic
    - [x] Enrich AI prompt with full DB metadata (tags, forensics)
    - [x] Implement "Contextual Fallback" guidelines in prompt
    - [x] Test "Redesign" pattern (AI pivots if clip is missing)
