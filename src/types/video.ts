export interface VideoClip {
    type: 'video';
    src: string; // URL or local path served via API
    startFrom: number; // Start time in source video
    duration: number;
    startAt: number; // Start time in composition
}

export interface AudioClip {
    type: 'audio';
    src: string;
    startAt: number;
    duration: number;
}

export interface TextClip {
    type: 'text';
    content: string;
    startAt: number;
    duration: number;
}

export type TrackType = 'video' | 'audio' | 'text';

export interface Track {
    type: TrackType;
    clips: (VideoClip | AudioClip | TextClip)[];
}

export interface VideoPlan {
    width: number;
    height: number;
    fps: number;
    durationInFrames: number;
    tracks: Track[];
}
