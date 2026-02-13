import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Save, MonitorPlay, Type, Music, Video, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VideoClip {
    src: string;
    startFrom: number;
    duration: number;
    startAt: number;
    transition?: string;
}

interface AudioClip {
    src: string;
    startAt: number;
    duration: number;
}

interface TextClip {
    content: string;
    startAt: number;
    duration: number;
}

interface VideoPlan {
    width: number;
    height: number;
    fps: number;
    durationInFrames: number;
    tracks: {
        type: "video" | "audio" | "text";
        clips: any[];
    }[];
}

interface DirectorReviewPanelProps {
    initialPlan: VideoPlan | string;
    script?: string;
    analysis?: any;
    onSave: (plan: VideoPlan) => void;
    onCancel: () => void;
    onRender: (plan: VideoPlan) => void;
}

const DirectorReviewPanel: React.FC<DirectorReviewPanelProps> = ({
    initialPlan,
    script,
    analysis,
    onSave,
    onCancel,
    onRender
}) => {
    const [plan, setPlan] = useState<VideoPlan>(() => {
        try {
            return typeof initialPlan === "string" ? JSON.parse(initialPlan) : initialPlan;
        } catch (e) {
            console.error("Invalid initial plan", e);
            return { width: 1080, height: 1920, fps: 30, durationInFrames: 300, tracks: [] };
        }
    });

    const [activeTab, setActiveTab] = useState("script");

    const updateClip = (trackType: string, index: number, field: string, value: any) => {
        setPlan(prev => {
            const newPlan = { ...prev };
            const track = newPlan.tracks.find(t => t.type === trackType);
            if (track && track.clips[index]) {
                track.clips[index] = { ...track.clips[index], [field]: value };
            }
            return newPlan;
        });
    };

    const deleteClip = (trackType: string, index: number) => {
        setPlan(prev => {
            const newPlan = { ...prev };
            const track = newPlan.tracks.find(t => t.type === trackType);
            if (track) {
                track.clips.splice(index, 1);
            }
            return newPlan;
        });
    };

    const addClip = (trackType: string) => {
        setPlan(prev => {
            const newPlan = { ...prev };
            let track = newPlan.tracks.find(t => t.type === trackType);
            if (!track) {
                track = { type: trackType as any, clips: [] };
                newPlan.tracks.push(track);
            }

            const lastClip = track.clips[track.clips.length - 1];
            const startAt = lastClip ? (lastClip.startAt + lastClip.duration) : 0;

            const newClip: any = { duration: 3, startAt };
            if (trackType === 'video') {
                newClip.src = "New Scene Description";
                newClip.startFrom = 0;
            } else if (trackType === 'text') {
                newClip.content = "New Text Overlay";
            } else {
                newClip.src = "Audio Path/URL";
            }

            track.clips.push(newClip);
            return newPlan;
        });
    };

    const getVideoTracks = () => plan.tracks.find(t => t.type === 'video')?.clips || [];
    const getTextTracks = () => plan.tracks.find(t => t.type === 'text')?.clips || [];
    const getAudioTracks = () => plan.tracks.find(t => t.type === 'audio')?.clips || [];

    return (
        <Card className="h-full flex flex-col border-none shadow-none bg-background/50">
            <CardHeader className="px-4 py-2 border-b">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary/10 p-2 rounded-full">
                            <MonitorPlay className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-base">Director's Plan</CardTitle>
                            <CardDescription className="text-xs">Review the script and visual direction.</CardDescription>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={onCancel}>Back to Upload</Button>
                        <Button variant="outline" size="sm" onClick={() => onSave(plan)}>
                            <Save className="w-4 h-4 mr-2" /> Save Draft
                        </Button>
                        <Button variant="default" size="sm" onClick={() => onRender(plan)} className="bg-green-600 hover:bg-green-700">
                            <Play className="w-4 h-4 mr-2" /> Render Video
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                    <div className="border-b px-4 bg-muted/20">
                        <TabsList className="bg-transparent h-12 w-full justify-start">
                            <TabsTrigger value="script" className="data-[state=active]:bg-background border-b-2 border-transparent data-[state=active]:border-orange-500 rounded-none h-full px-6 flex-1 max-w-[200px]">
                                <span className="text-orange-500 mr-2">📜</span> Script & Analysis
                            </TabsTrigger>
                            <TabsTrigger value="video" className="data-[state=active]:bg-background border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-full px-6 flex-1 max-w-[200px]">
                                <Video className="w-4 h-4 mr-2" /> Visual Plan
                            </TabsTrigger>
                            <TabsTrigger value="text" className="data-[state=active]:bg-background border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-full px-6 flex-1 max-w-[200px]">
                                <Type className="w-4 h-4 mr-2" /> Overlays
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="flex-1 p-6">
                        <TabsContent value="script" className="mt-0 space-y-6">
                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Voiceover / Script</h4>
                                        <span className="text-xs text-muted-foreground">Edit to correct transcription</span>
                                    </div>
                                    <Textarea
                                        className="min-h-[200px] font-mono text-sm leading-relaxed p-4 bg-muted/30 border-muted-foreground/20 focus:border-primary"
                                        defaultValue={script}
                                        placeholder="Waiting for script..."
                                    />
                                </div>

                                {analysis && (
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">AI Director Notes</h4>
                                        <div className="p-4 bg-slate-950 border rounded-lg space-y-4">
                                            <div>
                                                <div className="text-xs font-semibold text-muted-foreground mb-2">Detected Moods</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {analysis.emotionTimeline?.map((e: any, i: number) => (
                                                        <Badge key={i} variant="secondary" className="bg-blue-900/30 text-blue-300 border-blue-800">
                                                            {e.emotion} <span className="opacity-50 ml-1">({e.atSec}s)</span>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <div className="text-xs font-semibold text-muted-foreground mb-2">Key Visual Cues</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {analysis.cueWords?.slice(0, 10).map((c: any, i: number) => (
                                                        <Badge key={i} variant="outline" className="border-white/10 text-slate-300">
                                                            "{c.word}"
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="video" className="mt-0 space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-medium text-muted-foreground">Visual Shots ({getVideoTracks().length})</h4>
                                <Button size="sm" variant="outline" onClick={() => addClip('video')}>
                                    <Plus className="w-4 h-4 mr-2" /> Add Shot
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {getVideoTracks().map((clip: any, i: number) => (
                                    <div key={i} className="flex gap-4 p-4 border rounded-lg bg-card/50 hover:bg-card transition-colors items-start">
                                        <div className="flex flex-col items-center justify-center w-8 pt-2">
                                            <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                                        </div>

                                        <div className="flex-1 space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground">Visual Prompt / Description</label>
                                            <Input
                                                value={clip.src}
                                                onChange={(e) => updateClip('video', i, 'src', e.target.value)}
                                                className="font-medium bg-transparent border-muted-foreground/20 focus:border-primary"
                                                placeholder="Describe the scene..."
                                            />
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-muted-foreground">Transition:</span>
                                                <select
                                                    className="bg-transparent text-[10px] border rounded px-1 text-muted-foreground"
                                                    value={clip.transition || "none"}
                                                    onChange={(e) => updateClip('video', i, 'transition', e.target.value)}
                                                >
                                                    <option value="none">None</option>
                                                    <option value="fade">Fade</option>
                                                    <option value="wipe">Wipe</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="w-20 space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground">Secs</label>
                                            <Input
                                                type="number"
                                                value={clip.duration}
                                                onChange={(e) => updateClip('video', i, 'duration', parseFloat(e.target.value))}
                                                className="text-center h-9 bg-transparent border-muted-foreground/20"
                                            />
                                        </div>

                                        <div className="pt-7">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteClip('video', i)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>

                        <TabsContent value="text" className="mt-0">
                            <div className="space-y-3">
                                {getTextTracks().map((clip: any, i: number) => (
                                    <div key={i} className="flex gap-4 p-4 border rounded-lg bg-card/50 items-start">
                                        <div className="flex-1 space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground">Overlay Text</label>
                                            <Input
                                                value={clip.content}
                                                onChange={(e) => updateClip('text', i, 'content', e.target.value)}
                                                className="font-bold text-lg bg-transparent border-muted-foreground/20"
                                            />
                                        </div>
                                        <div className="w-20 space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground">Start</label>
                                            <Input
                                                type="number"
                                                value={clip.startAt}
                                                onChange={(e) => updateClip('text', i, 'startAt', parseFloat(e.target.value))}
                                                className="text-center h-9 bg-transparent"
                                            />
                                        </div>
                                        <div className="pt-7">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteClip('text', i)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                <Button variant="outline" className="w-full border-dashed" onClick={() => addClip('text')}>
                                    <Plus className="w-4 h-4 mr-2" /> Add Overlay
                                </Button>
                            </div>
                        </TabsContent>
                    </ScrollArea>
                </Tabs>
            </CardContent>
        </Card>
    );
};

export default DirectorReviewPanel;
