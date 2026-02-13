import { AbsoluteFill, Sequence, Video, Audio, Img, interpolate, useCurrentFrame, useVideoConfig, random, spring } from 'remotion';
import { VideoPlan, VideoClip, TextClip, AudioClip } from '../types/video';

// --- EFFECTS & TRANSITIONS ---

const GlitchEffect = ({ children, frame }: { children: React.ReactNode, frame: number }) => {
    const distortX = random(frame) * 20 - 10;
    const distortY = random(frame + 1) * 10 - 5;
    const opacity = random(frame + 2) > 0.9 ? 0.5 : 1;

    // Only glitch periodically
    const isGlitching = frame % 10 < 3;

    if (!isGlitching) return <>{children}</>;

    return (
        <div style={{ transform: `translate(${distortX}px, ${distortY}px)`, opacity, filter: 'contrast(1.5) brightness(1.2)' }}>
            <div style={{ position: 'absolute', top: 0, left: -5, width: '100%', height: '100%', opacity: 0.5, mixBlendMode: 'color-dodge', transform: 'translateX(-5px)', filter: 'hue-rotate(90deg)' }}>
                {children}
            </div>
            {children}
            <div style={{ position: 'absolute', top: 0, left: 5, width: '100%', height: '100%', opacity: 0.5, mixBlendMode: 'exclusion', transform: 'translateX(5px)', filter: 'hue-rotate(-90deg)' }}>
                {children}
            </div>
        </div>
    );
};

// --- CINEMATIC EFFECTS ---

const Vignette = () => (
    <AbsoluteFill style={{
        boxShadow: 'inset 0 0 200px rgba(0,0,0,0.8)',
        pointerEvents: 'none'
    }} />
);

const Letterbox = () => (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 0, width: '100%', height: '10%', backgroundColor: 'black' }} />
        <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '10%', backgroundColor: 'black' }} />
    </AbsoluteFill>
);

const FilmGrain = ({ frame }: { frame: number }) => {
    const opacity = random(frame) * 0.05;
    return (
        <AbsoluteFill style={{
            opacity,
            pointerEvents: 'none',
            backgroundColor: 'white',
            mixBlendMode: 'overlay'
        }} />
    );
};

const KenBurns = ({ src, frame, duration, intensity = 1.2 }: { src: string, frame: number, duration: number, intensity?: number }) => {
    const scale = interpolate(frame, [0, duration], [1, intensity]);
    return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})` }} />
        </div>
    );
};

// --- TEXT ANIMATIONS ---

const AnimatedText = ({ content, style, animation, frame }: { content: string, style: any, animation?: string, frame: number }) => {
    const { fps } = useVideoConfig();
    let transform = "";
    let opacity = 1;
    let displayText = content;

    const springConfig = {
        damping: 12,
        stiffness: 100,
        mass: 0.5,
    };

    if (animation === "up" || animation === "spring_up") {
        const s = spring({ frame, fps, config: springConfig });
        const y = interpolate(s, [0, 1], [50, 0]);
        transform = `translateY(${y}px)`;
        opacity = s;
    } else if (animation === "scale" || animation === "spring_scale") {
        const s = spring({ frame, fps, config: springConfig });
        transform = `scale(${s})`;
    } else if (animation === "blur_reveal") {
        const s = spring({ frame, fps, config: springConfig });
        opacity = s;
        const blur = interpolate(s, [0, 1], [20, 0]);
        style = { ...style, filter: `blur(${blur}px)` };
    } else if (animation === "shake") {
        const x = Math.sin(frame / 2) * 10;
        transform = `translateX(${x}px)`;
    } else if (animation === "typewriter") {
        const charsToShow = Math.floor(interpolate(frame, [0, content.length * 2], [0, content.length], { extrapolateRight: "clamp" }));
        displayText = content.substring(0, charsToShow);
    } else if (animation === "color_pulse") {
        // Simple pulse effect
        const s = interpolate(frame % 30, [0, 15, 30], [1, 1.1, 1]);
        transform = `scale(${s})`;
    }

    return (
        <h1 style={{ ...style, transform, opacity }}>
            {displayText}
        </h1>
    );
};

// --- TRANSITIONS ---

const TransitionWrapper = ({ children, type, frame, duration }: { children: React.ReactNode, type?: string, frame: number, duration: number }) => {
    const fadeDuration = 15;

    // Check if we are in the START transition phase
    if (type === "fade") {
        const opacity = interpolate(frame, [0, fadeDuration], [0, 1], { extrapolateRight: "clamp" });
        return <div style={{ opacity, width: '100%', height: '100%' }}>{children}</div>;
    }

    if (type === "slide") {
        const x = interpolate(frame, [0, fadeDuration], [100, 0], { extrapolateRight: "clamp" });
        return <div style={{ transform: `translateX(${x}%)`, width: '100%', height: '100%' }}>{children}</div>;
    }

    if (type === "wipe") {
        const p = interpolate(frame, [0, fadeDuration], [0, 100], { extrapolateRight: "clamp" });
        return <div style={{ clipPath: `inset(0 ${100 - p}% 0 0)`, width: '100%', height: '100%' }}>{children}</div>;
    }

    return <>{children}</>;
};


export const MainVideo: React.FC<{ plan: VideoPlan }> = ({ plan }) => {
    const { fps } = useVideoConfig();

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            {/* 1. Video/Image Track */}
            {plan.tracks.find(t => t.type === 'video')?.clips.map((clip: any, i: number) => {
                const durationFrames = Math.round(clip.duration * fps);
                const startFrame = Math.round(clip.startAt * fps);

                return (
                    <Sequence key={`video-${i}`} from={startFrame} durationInFrames={durationFrames}>
                        <AbsoluteFill>
                            {/* Inner Sequence to capture local frame for effects */}
                            <ClipRenderer clip={clip} durationFrames={durationFrames} />
                        </AbsoluteFill>
                    </Sequence>
                );
            })}

            {/* 2. Audio Track */}
            {plan.tracks.find(t => t.type === 'audio')?.clips.map((clip: AudioClip, i: number) => (
                <Sequence key={`audio-${i}`} from={Math.round(clip.startAt * fps)} durationInFrames={Math.round(clip.duration * fps)}>
                    <Audio src={clip.src} />
                </Sequence>
            ))}

            {/* 3. Text Overlay Track */}
            {plan.tracks.find(t => t.type === 'text')?.clips.map((clip: any, i: number) => {
                const durationFrames = Math.round(clip.duration * fps);
                const startFrame = Math.round(clip.startAt * fps);
                return (
                    <Sequence key={`text-${i}`} from={startFrame} durationInFrames={durationFrames}>
                        <TextRenderer clip={clip} />
                    </Sequence>
                );
            })}
            {/* 4. Global Cinematic Overlays */}
            {(plan as any).vignette && <Vignette />}
            {(plan as any).letterbox && <Letterbox />}
            {(plan as any).grain && <FilmGrain frame={useCurrentFrame()} />}
        </AbsoluteFill>
    );
};

// Sub-components to hook into useCurrentFrame cleanly
const ClipRenderer = ({ clip, durationFrames }: { clip: any, durationFrames: number }) => {
    const frame = useCurrentFrame();

    // Determine content type (naive check)
    const isImage = clip.src.match(/\.(jpg|jpeg|png|webp)$/i) || clip.src.startsWith('GEN_IMG');

    // Base Content
    let content = (
        <div style={{ width: '100%', height: '100%' }}>
            {isImage ? (
                <Img src={clip.src.startsWith('GEN_IMG') ? 'https://via.placeholder.com/1080x1920/1a1a1a/ffffff?text=AI+GENERATION' : clip.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
                <Video
                    src={clip.src}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    startFrom={Math.round((clip.startFrom || 0) * 30)} // Support native startFrom
                    muted={true}
                    delayRenderTimeoutInMilliseconds={60000}
                />
            )}
        </div>
    );

    // Apply Effect Layer
    if (clip.effect === "ken_burns" && isImage) {
        content = <KenBurns src={clip.src.startsWith('GEN_IMG') ? 'https://via.placeholder.com/1080x1920/1a1a1a/ffffff?text=AI+GENERATION' : clip.src} frame={frame} duration={durationFrames} />;
    } else if (clip.effect === "glitch") {
        content = <GlitchEffect frame={frame}>{content}</GlitchEffect>;
    } else if (clip.effect === "bw_filter") {
        content = <div style={{ width: '100%', height: '100%', filter: 'grayscale(100%) contrast(1.2)' }}>{content}</div>;
    } else if (clip.effect === "zoom_in") {
        // Smooth zoom from 1.0 to 1.2
        const scale = interpolate(frame, [0, durationFrames], [1, 1.2], { extrapolateRight: "clamp" });
        content = <div style={{ width: '100%', height: '100%', transform: `scale(${scale})`, overflow: 'hidden' }}>{content}</div>;
    }

    // Apply Transition Layer (Entering)
    if (clip.transition && clip.transition !== "none") {
        content = <TransitionWrapper type={clip.transition} frame={frame} duration={durationFrames}>{content}</TransitionWrapper>;
    }

    return content;
};

const TextRenderer = ({ clip }: { clip: any }) => {
    const frame = useCurrentFrame();
    const { textStyle } = clip;

    return (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
            <AnimatedText
                content={clip.content}
                frame={frame}
                animation={textStyle?.animation || "scale"}
                style={{
                    color: textStyle?.color || 'white',
                    fontSize: textStyle?.fontSize || 80,
                    textAlign: 'center',
                    textShadow: '4px 4px 0px rgba(0,0,0,0.8)',
                    fontFamily: textStyle?.fontFamily || 'Impact, sans-serif',
                    padding: '20px 40px',
                    backgroundColor: textStyle?.bg ? textStyle.bg : 'transparent',
                    borderRadius: 15,
                    border: textStyle?.bg ? '2px solid white' : 'none'
                }}
            />
        </AbsoluteFill>
    );
};
