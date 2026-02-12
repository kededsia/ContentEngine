import VideoIngestPanel from "@/components/VideoIngestPanel";
import { useState, useEffect } from "react";
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
    const [isGenerating, setIsGenerating] = useState(false);
    const [plan, setPlan] = useState<any>(null);
    const [videos, setVideos] = useState<VideoData[]>([]);
    const [isLoadingVideos, setIsLoadingVideos] = useState(false);

    const fetchVideos = async () => {
        setIsLoadingVideos(true);
        try {
            const res = await fetch('http://localhost:3000/api/videos');
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
            const res = await fetch(`http://localhost:3000/api/videos/${id}`, {
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

    const handleGeneratePlan = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('http://localhost:3000/api/generate-video-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script })
            });
            const data = await res.json();
            if (res.ok) {
                setPlan(data.plan);
                toast({ title: "Plan Generated", description: "Video composition plan ready." });
            } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to generate plan", variant: "destructive" });
        }
        setIsGenerating(false);
    };

    return (
        <div className="container mx-auto p-6 space-y-8">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Video className="w-8 h-8 text-primary" />
                AI Video Factory
            </h1>

            <Tabs defaultValue="library">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="library">Video Library</TabsTrigger>
                    <TabsTrigger value="ingest">Ingestion (Upload)</TabsTrigger>
                    <TabsTrigger value="generate">Generation (Director)</TabsTrigger>
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
                    {/* Keep existing generation UI */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Generate Video from Script</CardTitle>
                            <CardDescription>AI will pick footage based on your script context.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                value={script}
                                onChange={(e) => setScript(e.target.value)}
                                placeholder="Enter your script here... (One scene per line)"
                                className="h-40"
                            />
                            <Button onClick={handleGeneratePlan} disabled={isGenerating}>
                                {isGenerating ? "Planning..." : "Generate Video Plan"}
                            </Button>

                            {plan && (
                                <div className="mt-4 p-4 bg-slate-950 rounded-lg border">
                                    <h3 className="font-semibold mb-2">Generated Plan Preview:</h3>
                                    <pre className="text-xs overflow-auto max-h-60 text-green-400">
                                        {JSON.stringify(plan, null, 2)}
                                    </pre>
                                    <div className="mt-4">
                                        <p className="text-sm text-muted-foreground mb-2">
                                            To render this video, run <code>npm run video:render</code> or open <code>npm run video:studio</code>.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs >
        </div >
    );
}
