import { Composition } from 'remotion';
import { MainVideo } from './MainVideo';
import { VideoPlan } from '../types/video';

// Default props for preview
const defaultProps: { plan: VideoPlan } = {
    plan: {
        width: 1080,
        height: 1920,
        fps: 30,
        durationInFrames: 30 * 10,
        tracks: [
            { type: 'video', clips: [] },
            { type: 'audio', clips: [] },
            {
                type: 'text', clips: [
                    { type: 'text', content: "Preview Text Overlay", startAt: 0, duration: 5 }
                ]
            }
        ]
    },
};

export const RemotionRoot: React.FC = () => {
    return (
        <>
            <Composition
                id="MainVideo"
                component={MainVideo}
                durationInFrames={300}
                fps={30}
                width={1080}
                height={1920}
                defaultProps={defaultProps}
                calculateMetadata={async ({ props }) => {
                    return {
                        durationInFrames: props.plan?.durationInFrames || 300,
                        props
                    };
                }}
            />
        </>
    );
};
