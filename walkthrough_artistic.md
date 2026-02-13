# Walkthrough: Director Artistry & Native Trimming (v2)

This update transforms the Director Mode into a high-artistic, cinema-grade video production pipeline.

## New Features

### 1. Artistic Visual Language
The AI Director now understands and uses:
- **Spring Animations**: Smooth, physics-based text reveals (Bounce effect).
- **Cinematic Overlays**: Automatic Vignette, Letterboxing (21:9 feel), and Film Grain.
- **Blur Reveals**: Text that emerges smoothly from a blur state.
- **Diverse Typography**: Intelligent selection of fonts (Bebas Neue, Impact, Serif) based on tone.

### 2. Native Remotion Trimming
- **Speed Optimization**: The system now favors "Native Trimming" (offsetting start points in Remotion) instead of physical FFmpeg trimming when possible.
- **Fallback Logic**: Physical trimming is still used for huge files to ensure performance during render.

### 3. Director Studio (Editable Plan)
- You can now **edit the Creative Plan** directly in the UI before rendering.
- Modify JSON parameters like `useFfmpeg`, change the text overlay, or swap visual effects on the fly.

## Video Demonstration
*(Once you render a new video, the results will show the cinematic bars and springy text animations!)*

## Technical Details
- **Frontend**: `MainVideo.tsx` updated with SVG/CSS based overlays and Remotion `spring`.
- **Backend**: `director_service.js` updated with more descriptive AI prompts.

## 📂 Project Orchestration 2.0 (New!)
- **Isolated Workspace:** Assets for each render are now gathered and trimmed into `data/projects/[project_id]/assets`.
- **Dynamic Asset Gathering:** All trimmed clips are isolated so Remotion has zero conflicts between parallel render jobs.
- **Auto-Cleanup:** Old project folders are automatically purged after 24 hours to save disk space.

## 🧠 Creative Adaptation & Intelligence
- **Forensic Context:** The Director Agent now reads descriptions and tags from `videos.db`.
- **Contextual Fallback:** If you ask for a "Race" but only have "Close up of tire," the AI will pivot the scene to be a "Tension-filled close-up" instead of failing.
- **Redesign Protocol:** AI is instructed to redesign scenes around available assets to ensure the video stays cohesive.

## 📡 Live Render Logs
- **Visual Feedback:** Saat menekan "Render Video", Anda akan langsung dialihkan ke tampilan log terminal.
- **Real-time Progress:** Lihat progress frame per frame (misal: `Rendering Frame 100/300`) langsung di browser.
- **Auto-Dismiss:** Setelah render selesai, tampilan log akan otomatis tertutup dan Anda akan dialihkan kembali ke library.

## 🚚 Auto-Library Ingest
- **Instant Availability:** Video hasil render tidak lagi "menghilang". Sistem secara otomatis memindahkannya ke koleksi footage dan mendaftarkannya di database.
- **Auto-Refresh:** Daftar video di "Video Library" akan terupdate otomatis begitu render berhasil.
