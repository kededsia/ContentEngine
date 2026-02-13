import VideoIngestPanel from "@/components/VideoIngestPanel";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Video, FileVideo } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import DirectorReviewPanel from "@/components/DirectorReviewPanel";

type VideoData = {
    id: string;
    filename: string;
    path: string;
    duration: number;
    created_at: string;
};

export default function VideoLibrary() {
    const { toast } = useToast();
    const [script, setScript] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [plan, setPlan] = useState<any>(null);
    const [videos, setVideos] = useState<VideoData[]>([]);
    const [isLoadingVideos, setIsLoadingVideos] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const sse = new EventSource('http://127.0.0.1:3001/api/logs'); // Listen to Director Service
        sse.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.message) {
                    setLogs(prev => [data.message, ...prev].slice(0, 100)); // Keep last 100 logs
                }
            } catch (e) { console.error("SSE Parse Error", e); }
        };
        return () => sse.close();
    }, []);

    const fetchVideos = async () => {
        setIsLoadingVideos(true);
        try {
            const res = await fetch('http://127.0.0.1:3000/api/videos');
            const data = await res.json();
            if (res.ok) {
                setVideos(data.videos || []);
            }
        } catch (e) {
            console.error("Failed to fetch videos", e);
        } finally {
            setIsLoadingVideos(false);
        }
    };

    useEffect(() => {
        fetchVideos();
    }, []);

    const handleDelete = async (id: string, filename: string) => {
        if (!confirm(`Delete video "${filename}"? This cannot be undone.`)) return;

        try {
            const res = await fetch(`http://127.0.0.1:3000/api/videos/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                toast({ title: "Deleted", description: "Video removed from database and disk." });
                fetchVideos(); // Refresh list
            } else {
                toast({ title: "Error", description: "Failed to delete video", variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Network error", variant: "destructive" });
        }
    };



    const getAudioDuration = (file: File) => {
        return new Promise<number>((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const audio = new Audio(url);
            audio.preload = "metadata";
            audio.onloadedmetadata = () => {
                resolve(audio.duration);
                URL.revokeObjectURL(url);
            };
            audio.onerror = () => {
                reject(new Error("File audio tidak valid"));
                URL.revokeObjectURL(url);
            };
        });
    };

    const buildAudioAnalysis = (script: string, durationSec: number) => {
        const emotionMatches = [...script.matchAll(/\[\s*emosi\s*:\s*([^\]]+)\]/gi)]
            .map((m) => m[1].trim())
            .filter(Boolean);

        const words = script
            .replace(/\[[^\]]+\]/g, "")
            .replace(/[*#]/g, "")
            .split(/\s+/)
            .map((w) => w.trim())
            .filter(Boolean);

        const cueSamples = Math.min(12, words.length);
        const step = cueSamples > 0 ? Math.max(1, Math.floor(words.length / cueSamples)) : 1;

        const cueWords = Array.from({ length: cueSamples }).map((_, idx) => {
            const wordIndex = Math.min(words.length - 1, idx * step);
            const atSec = words.length > 0 ? Number(((wordIndex / words.length) * durationSec).toFixed(2)) : 0;
            return { atSec, word: words[wordIndex] || "" };
        });

        const emotionTimeline = emotionMatches.length > 0
            ? emotionMatches.map((emotion, idx) => {
                const atSec = Number(((idx / Math.max(1, emotionMatches.length)) * durationSec).toFixed(2));
                return { atSec, emotion };
            })
            : [{ atSec: 0, emotion: "neutral" }];

        return {
            durationSec: Number(durationSec.toFixed(2)),
            emotionTimeline,
            cueWords,
        };
    };

    const [scriptData, setScriptData] = useState<string>("");
    const [analysisData, setAnalysisData] = useState<any>(null);
    const [audioFilename, setAudioFilename] = useState<string | null>(null);

    // ... (keep useEffect and other funcs)

    // STEP 1: Transcribe
    const onTranscribe = async () => {
        if (!audioFile) {
            toast({ title: "Error", description: "Please select an audio file first.", variant: "destructive" });
            return;
        }

        setIsProcessing(true);
        try {
            console.log("[Frontend] Uploading audio:", audioFile.name, audioFile.type, audioFile.size);
            const formData = new FormData();
            formData.append('audioFile', audioFile);

            // Director Service now runs on Port 3001
            const res = await fetch('http://127.0.0.1:3001/api/director-transcribe', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                setScriptData(data.script);
                setAnalysisData(data.audioAnalysis);
                if (data.filename) setAudioFilename(data.filename); // Capture filename
                toast({ title: "Transcription Complete", description: "Please review the text below." });
            } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
            }
        } catch (e: any) {
            console.error("[Transcription Error]", e);
            toast({
                title: "Error",
                description: `Transcription failed: ${e.message}`,
                variant: "destructive"
            });
        }
        setIsProcessing(false);
    };

    // STEP 2: Generate Plan
    const onGeneratePlan = async () => {
        setIsProcessing(true);
        try {
            const res = await fetch('http://127.0.0.1:3001/api/director-plan-only', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    script: scriptData,
                    audioAnalysis: analysisData,
                    audioDuration: analysisData?.duration_sec || 0
                })
            });

            const data = await res.json();
            if (res.ok) {
                setPlan(data.plan);
                toast({ title: "Plan Generated", description: "Director plan created successfully." });
            } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
            }
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Plan generation failed", variant: "destructive" });
        }
        setIsProcessing(false);
    };

    return (
        <div className="container mx-auto p-6 space-y-8">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Video className="w-8 h-8 text-primary" />
                AI Video Factory
            </h1>

            <Tabs defaultValue="generate">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="library">Video Library</TabsTrigger>
                    <TabsTrigger value="ingest">Ingestion (Upload)</TabsTrigger>
                    <TabsTrigger value="generate">Director Mode</TabsTrigger>
                    <TabsTrigger value="logs">Logs & Stats</TabsTrigger>
                </TabsList>

                <TabsContent value="library" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Video Footage Bank</CardTitle>
                            <CardDescription>
                                Manage your uploaded footage. Deleted videos are removed from database and disk.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Filename</TableHead>
                                            <TableHead>Duration</TableHead>
                                            <TableHead>Uploaded</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {videos.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                    No videos found. Upload some footage first.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            videos.map((video) => (
                                                <TableRow key={video.id}>
                                                    <TableCell className="font-medium flex items-center gap-2">
                                                        <FileVideo className="w-4 h-4 text-blue-400" />
                                                        {video.filename}
                                                    </TableCell>
                                                    <TableCell>{video.duration?.toFixed(1)}s</TableCell>
                                                    <TableCell>{new Date(video.created_at).toLocaleDateString()}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => handleDelete(video.id, video.filename)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="ingest" className="space-y-4">
                    <VideoIngestPanel />
                </TabsContent>

                <TabsContent value="generate" className="space-y-4">
                    <Card className="h-[600px] flex flex-col">
                        <CardHeader>
                            <CardTitle>Director Mode (Audio-First)</CardTitle>
                            <CardDescription>
                                {isProcessing ? "AI is working..." :
                                    plan ? "Review and edit the plan before rendering." :
                                        scriptData ? "Review transcription before generating plan." :
                                            "Upload voiceover to start."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col min-h-0 space-y-4">

                            {/* STATE 1: IDLE / REVIEW (Upload or Edit Script) */}
                            {!isProcessing && !plan && (
                                <div className="flex flex-col items-center justify-center h-full space-y-6 border-2 border-dashed rounded-lg p-10 bg-slate-950/50">
                                    <div className="text-center space-y-2">
                                        <div className="bg-primary/10 p-4 rounded-full inline-block">
                                            <Video className="w-12 h-12 text-primary" />
                                        </div>
                                        <h3 className="text-lg font-medium">Upload Voiceover / Audio</h3>
                                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                            Upload an MP3/WAV file. The AI will listen, transcribe, and design the video.
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-4 w-full max-w-sm">
                                        <div className="flex items-center gap-2 border p-2 rounded-md bg-background">
                                            <Button
                                                variant="secondary"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="shrink-0"
                                            >
                                                Choose File
                                            </Button>
                                            <span className="text-sm truncate flex-1 opacity-80">
                                                {audioFile ? audioFile.name : "No file selected"}
                                            </span>
                                        </div>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="audio/*"
                                            onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                                        />

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-sm font-medium">
                                                    {scriptData ? "Review Transcription / Script" : "Optional Script Context"}
                                                </label>
                                                {scriptData && (
                                                    <span className="text-xs text-green-400">
                                                        ✅ Transcription Ready
                                                    </span>
                                                )}
                                            </div>
                                            <Textarea
                                                placeholder="Enter a script or context here..."
                                                value={scriptData || script}
                                                onChange={(e) => {
                                                    if (scriptData) setScriptData(e.target.value);
                                                    else setScript(e.target.value);
                                                }}
                                                className="resize-none h-40 font-mono text-sm"
                                            />
                                        </div>

                                        <Button
                                            onClick={scriptData ? onGeneratePlan : onTranscribe}
                                            className="w-full"
                                            size="lg"
                                            disabled={isProcessing || (!audioFile && !script && !scriptData)}
                                        >
                                            {isProcessing ? (
                                                <span className="flex items-center gap-2">
                                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                                    {scriptData ? "Designing Plan..." : "Transcribing..."}
                                                </span>
                                            ) : (
                                                scriptData ? "Generate Video Plan" : "Start Transcription"
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* STATE 2: PROCESSING (Logs) */}
                            {isProcessing && (
                                <div className="flex flex-col h-full bg-black rounded-md border p-4 font-mono text-xs text-green-400 overflow-hidden relative">
                                    <div className="absolute top-2 right-2">
                                        <div className="animate-spin h-4 w-4 border-2 border-green-500 border-t-transparent rounded-full" />
                                    </div>
                                    <div className="flex-1 overflow-y-auto flex flex-col-reverse">
                                        {/* Logs reversed order */}
                                        {logs.map((log, i) => (
                                            <div key={i} className="py-0.5 border-b border-white/5">
                                                <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString()}]</span>
                                                {log}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* STATE 3: FINISHED (Visual Editor) */}
                            {plan && !isProcessing && (
                                <div className="flex flex-col h-full bg-background rounded-lg overflow-hidden border">
                                    {/* @ts-ignore */}
                                    <DirectorReviewPanel
                                        initialPlan={plan}
                                        script={scriptData}
                                        analysis={analysisData}
                                        onCancel={() => setPlan(null)}
                                        onSave={(updatedPlan) => {
                                            setPlan(updatedPlan);
                                            toast({ title: "Plan Saved", description: "Changes kept in memory." });
                                        }}
                                        onRender={async (textPlan) => {
                                            toast({ title: "Building Render Pipeline", description: "Converting Director Plan to Remotion Skill Pack..." });
                                            try {
                                                // 1. Convert Markdown Plan -> Remotion JSON (Skill Pack)
                                                // We must provide the script as well for context
                                                const skillRes = await fetch('http://127.0.0.1:3001/api/remotion-skill', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        script: scriptData,
                                                        directorPlan: textPlan,
                                                        audioFilename: audioFilename, // Pass filename
                                                        audioDuration: analysisData?.duration_sec || 0 // Pass duration
                                                    })
                                                });

                                                const skillData = await skillRes.json();
                                                if (!skillRes.ok) throw new Error(skillData.error || "Failed to parse plan");

                                                const finalVideoPlan = skillData.skillPack; // This is the JSON object

                                                // 2. Send JSON to Auto-Renderer
                                                toast({ title: "Rendering", description: "Sending to render engine..." });
                                                const res = await fetch('http://127.0.0.1:3001/api/auto-render', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        plan: finalVideoPlan
                                                    })
                                                });
                                                const data = await res.json();
                                                if (data.success || data.status === "Rendering started") {
                                                    toast({
                                                        title: "Success",
                                                        description: data.message || `Video saved: ${data.filename}`
                                                    });
                                                } else {
                                                    toast({ title: "Failed", description: "Render failed check logs.", variant: "destructive" });
                                                }
                                            } catch (e: any) {
                                                console.error(e);
                                                toast({ title: "Error", description: e.message || "Network error", variant: "destructive" });
                                            }
                                        }}
                                    />
                                </div>
                            )}

                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="logs" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Server Logs & Stats</CardTitle>
                            <CardDescription>Real-time updates from the backend process.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-black/90 text-green-400 font-mono text-xs p-4 rounded-md h-[400px] overflow-y-auto whitespace-pre-wrap">
                                {logs.length === 0 ? (
                                    <div className="opacity-50 italic">Connecting to log stream...</div>
                                ) : (
                                    logs.join('\n')
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

