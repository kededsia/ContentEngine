import { AbsoluteFill, Sequence, Video, Audio } from 'remotion';
import { VideoPlan, VideoClip, TextClip, AudioClip } from '../types/video';

export const MainVideo: React.FC<{ plan: VideoPlan }> = ({ plan }) => {
    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            {/* 1. Video Track */}
            {plan.tracks.find(t => t.type === 'video')?.clips.map((clip: VideoClip, i: number) => (
                <Sequence key={`video-${i}`} from={Math.round(clip.startAt * 30)} durationInFrames={Math.round(clip.duration * 30)}>
                    <Video src={clip.src} startFrom={Math.round(clip.startFrom * 30)} />
                </Sequence>
            ))}

            {/* 2. Audio Track */}
            {plan.tracks.find(t => t.type === 'audio')?.clips.map((clip: AudioClip, i: number) => (
                <Sequence key={`audio-${i}`} from={Math.round(clip.startAt * 30)} durationInFrames={Math.round(clip.duration * 30)}>
                    <Audio src={clip.src} />
                </Sequence>
            ))}

            {/* 3. Text Overlay Track */}
            {plan.tracks.find(t => t.type === 'text')?.clips.map((clip: TextClip, i: number) => (
                <Sequence key={`text-${i}`} from={Math.round(clip.startAt * 30)} durationInFrames={Math.round(clip.duration * 30)}>
                    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
                        <h1 style={{
                            color: 'white',
                            fontSize: 80,
                            textAlign: 'center',
                            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                            fontFamily: 'Arial, sans-serif',
                            padding: 40
                        }}>
                            {clip.content}
                        </h1>
                    </AbsoluteFill>
                </Sequence>
            ))}
        </AbsoluteFill>
    );
};
