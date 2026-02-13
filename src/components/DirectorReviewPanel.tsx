import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Save, MonitorPlay } from "lucide-react";

interface DirectorReviewPanelProps {
    initialPlan: string; // Now expects Markdown string
    script?: string;
    analysis?: any;
    onSave: (plan: string) => void;
    onCancel: () => void;
    onRender: (plan: string) => void;
}

const DirectorReviewPanel: React.FC<DirectorReviewPanelProps> = ({
    initialPlan,
    script,
    analysis,
    onSave,
    onCancel,
    onRender
}) => {
    // Determine if plan is string or object (legacy support)
    const planText = typeof initialPlan === 'string'
        ? initialPlan
        : JSON.stringify(initialPlan, null, 2);

    return (
        <Card className="h-full flex flex-col border-none shadow-none bg-background/50">
            <CardHeader className="px-4 py-3 border-b bg-card/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-500/10 p-2 rounded-full">
                            <MonitorPlay className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                            <CardTitle className="text-base text-foreground">Director's Plan (Text Mode)</CardTitle>
                            <CardDescription className="text-xs">Review the raw creative direction before rendering.</CardDescription>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={onCancel}>Back to Upload</Button>
                        <Button variant="outline" size="sm" onClick={() => onSave(planText)}>
                            <Save className="w-4 h-4 mr-2" /> Save Draft
                        </Button>
                        <Button variant="default" size="sm" onClick={() => onRender(planText)} className="bg-green-600 hover:bg-green-700 text-white">
                            <Play className="w-4 h-4 mr-2" /> Render Video
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 overflow-hidden relative">
                <ScrollArea className="h-full">
                    <div className="p-6 max-w-4xl mx-auto space-y-6">

                        {/* Script Section */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Input Script</h3>
                            <div className="p-4 bg-muted/30 rounded-md border border-border/50 font-serif italic text-foreground/80">
                                "{script || "No script provided"}"
                            </div>
                        </div>

                        {/* Plan Text Section */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-2">Director's Creative Plan</h3>
                            <div className="p-6 bg-slate-950 rounded-lg border border-slate-800 font-mono text-sm leading-relaxed whitespace-pre-wrap text-green-400/90 shadow-inner">
                                {planText}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};

export default DirectorReviewPanel;
