import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function VideoIngestPanel() {
    const { toast } = useToast();
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isIngesting, setIsIngesting] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const logContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    // SSE Connection for Live Logs
    useEffect(() => {
        const eventSource = new EventSource('http://127.0.0.1:3000/api/logs');

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setLogs(prev => [...prev, data.message]);
        };

        eventSource.onerror = (err) => {
            console.error("SSE Error:", err);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFiles(Array.from(e.target.files));
        }
    };

    const handleIngest = async () => {
        if (selectedFiles.length === 0) {
            toast({ title: "Error", description: "Pilih file video dulu!", variant: "destructive" });
            return;
        }

        setIsIngesting(true);
        setLogs([]); // Clear previous logs on new ingest
        const formData = new FormData();

        selectedFiles.forEach(file => {
            formData.append('videos', file);
        });

        try {
            const res = await fetch('http://127.0.0.1:3000/api/ingest-upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                toast({ title: "Upload Berhasil! 📥", description: `Uploaded ${selectedFiles.length} files. Analysis started.` });
                setSelectedFiles([]);
            } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
                setIsIngesting(false); // Stop loading if error immediately
            }
        } catch (e) {
            toast({ title: "Error", description: "Gagal koneksi ke backend", variant: "destructive" });
            setIsIngesting(false);
        }
        // Keep loading state until logs show finish? Or just reset.
        setIsIngesting(false);
    };

    return (
        <Card className="border-border bg-card/50">
            <CardHeader className="pb-3">
                <CardTitle className="text-md font-bold flex items-center gap-2">
                    <Upload className="w-4 h-4 text-primary" />
                    Input Video Footage
                </CardTitle>
                <CardDescription className="text-xs">
                    Upload multiple videos untuk dianalisa AI (Gemini CLI) & masuk ke bank footage.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex gap-2 items-center">
                    <Input
                        type="file"
                        multiple
                        accept="video/*"
                        onChange={handleFileChange}
                        className="h-9 text-sm file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    />
                    <Button onClick={handleIngest} disabled={isIngesting || selectedFiles.length === 0} size="sm">
                        {isIngesting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}
                    </Button>
                </div>

                {/* Log Console Area */}
                <div className="mt-4 bg-black/80 rounded-md p-3 font-mono text-xs text-green-400 h-48 overflow-y-auto border border-green-900/50" ref={logContainerRef}>
                    {logs.length === 0 ? (
                        <span className="text-muted-foreground opacity-50">Waiting for logs...</span>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} className="whitespace-pre-wrap mb-1">{log}</div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
