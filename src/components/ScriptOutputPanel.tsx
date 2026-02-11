import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, RefreshCw, Heart, Mic, Download, Loader2, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ScriptOutputPanelProps {
  scripts: string[];
  isLoading: boolean;
  streamingText: string;
  platform: string;
  onRegenerate: () => void;
  onSave: () => void;
}

const ScriptOutputPanel: React.FC<ScriptOutputPanelProps> = ({
  scripts,
  isLoading,
  streamingText,
  onRegenerate,
  onSave,
}) => {
  const [generatingTTS, setGeneratingTTS] = useState<number | null>(null);
  const [generatedAudios, setGeneratedAudios] = useState<Record<number, string>>({});

  useEffect(() => {
    setGeneratedAudios({});
    setGeneratingTTS(null);
  }, [scripts]);

  const copyScript = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    toast({ title: `Script ${index + 1} di-copy!` });
  };

  const extractScriptText = (script: string): string => {
    return script.replace(/[\*\#]/g, "").substring(0, 2500);
  };

  const generateTTS = async (scriptIndex: number) => {
    const text = extractScriptText(scripts[scriptIndex]);
    setGeneratingTTS(scriptIndex);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text }),
        }
      );
      if (!response.ok) throw new Error("Gagal generate voiceover");
      const data = await response.json();
      setGeneratedAudios((prev) => ({ ...prev, [scriptIndex]: `data:audio/mpeg;base64,${data.audioContent}` }));
      toast({ title: "Voiceover berhasil! 🎙️" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingTTS(null);
    }
  };

  const downloadAudio = (audioUrl: string, index: number) => {
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `kenshi-vo-${index + 1}.mp3`;
    link.click();
  };

  // Custom Markdown Parser for "Lovable" Look
  const renderContent = (text: string) => {
    const lines = text.split("\n");
    const metadata: React.ReactNode[] = [];
    const content: React.ReactNode[] = [];
    let isSceneBreakdown = false;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Parse Metadata (Lines starting with **icon)
      if (trimmed.match(/^\*\*(⏱️|🪝|🎭|📖|🎯)/)) {
        const parts = trimmed.replace(/^\*\*/, "").replace(/\*\*$/, "").split(":");
        if (parts.length >= 2) {
          const label = parts[0].trim();
          const value = parts.slice(1).join(":").trim();
          metadata.push(
            <Badge key={idx} variant="secondary" className="mr-2 mb-2 text-xs font-normal">
              <span className="opacity-70 mr-1">{label}</span>
              <span className="font-semibold">{value}</span>
            </Badge>
          );
        }
        return;
      }

      // Headers
      if (trimmed.startsWith("### ")) {
        const isBreakdown = trimmed.includes("SCENE BREAKDOWN") || trimmed.includes("VISUAL CUES");
        if (isBreakdown) isSceneBreakdown = true;

        content.push(
          <div key={idx} className={`mt-6 mb-3 flex items-center gap-2 ${isBreakdown ? "text-primary border-t border-dashed border-primary/20 pt-4" : "text-foreground"}`}>
            {isBreakdown && <div className="h-px flex-1 bg-border" />}
            <h3 className="text-sm font-bold uppercase tracking-wider">{trimmed.replace("### ", "")}</h3>
            {isBreakdown && <div className="h-px flex-1 bg-border" />}
          </div>
        );
        return;
      }

      if (trimmed.startsWith("## ")) {
        content.push(<h2 key={idx} className="text-lg font-bold text-primary mb-4">{trimmed.replace("## ", "")}</h2>);
        return;
      }

      // Scene Headers (Scene 1: ...)
      if (trimmed.startsWith("**Scene")) {
        content.push(
          <div key={idx} className="mt-4 mb-2 p-2 bg-secondary/30 rounded-md border-l-4 border-primary">
            <span className="font-bold text-sm text-primary">{trimmed.replace(/\*\*/g, "")}</span>
          </div>
        );
        return;
      }

      // Standard Text with Bold formatting
      if (trimmed) {
        const processed = line.split(/(\*\*.*?\*\*)/).map((part, pIdx) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={pIdx} className="text-primary/90">{part.slice(2, -2)}</strong>;
          }
          return part;
        });

        content.push(
          <p key={idx} className={`text-sm leading-relaxed mb-2 ${isSceneBreakdown ? "text-muted-foreground pl-4" : "text-foreground/90"}`}>
            {trimmed.startsWith("🎥") || trimmed.startsWith("🗣️") || trimmed.startsWith("📸") ? (
              <span className="block mb-1 font-medium">{processed}</span>
            ) : (
              processed
            )}
          </p>
        );
      }
    });

    return { metadata, content };
  };

  // Loading States
  if (!isLoading && scripts.length === 0 && !streamingText) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 space-y-4">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Sparkles className="h-8 w-8 text-primary animate-pulse" />
      </div>
      <div>
        <h3 className="text-xl font-bold font-heading">Siap Kreasikan Konsep?</h3>
        <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">
          Pilih produk dan mode (Script/Story) di panel kiri, lalu biarkan AI kami meracik kata-kata ajaib untukmu.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
          {isLoading ? "Meracik Konsep..." : "Hasil Konsep"}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRegenerate} disabled={isLoading}>
            <RefreshCw className={`h-3 w-3 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Regenerate
          </Button>
          <Button variant="outline" size="sm" onClick={onSave} disabled={isLoading}>
            <Heart className="h-3 w-3 mr-2" /> Simpan
          </Button>
        </div>
      </div>

      {isLoading && streamingText ? (
        <Card className="bg-card border-primary/20 shadow-lg">
          <CardContent className="p-6 space-y-2">
            <div className="flex gap-2 mb-4">
              {[1, 2, 3].map(i => <div key={i} className="h-2 w-16 bg-primary/20 rounded animate-pulse" />)}
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed font-mono opacity-80">
              {streamingText}<span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
            </div>
          </CardContent>
        </Card>
      ) : (
        scripts.map((script, i) => {
          const { metadata, content } = renderContent(script);
          return (
            <Card key={i} className="bg-card border-border shadow-md hover:shadow-lg transition-all duration-300 group">
              <CardContent className="p-0">
                {/* Header Bar */}
                <div className="flex items-center justify-between p-4 bg-secondary/30 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Variation</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => copyScript(script, i)}>
                    <Copy className="h-3 w-3 mr-2" /> Copy
                  </Button>
                </div>

                {/* Metadata Badges */}
                {metadata.length > 0 && (
                  <div className="px-6 pt-6 flex flex-wrap">
                    {metadata}
                  </div>
                )}

                {/* Main Content */}
                <div className="p-6 pt-4">
                  {content}
                </div>

                {/* Footer (Actions) */}
                <div className="p-4 bg-secondary/10 border-t border-border flex justify-end">
                  {generatedAudios[i] ? (
                    <div className="flex items-center gap-2 w-full bg-background p-2 rounded-md border border-border">
                      <audio controls src={generatedAudios[i]} className="flex-1 h-8" />
                      <Button variant="ghost" size="icon" onClick={() => downloadAudio(generatedAudios[i], i)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={() => generateTTS(i)} disabled={generatingTTS === i}>
                      {generatingTTS === i ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Mic className="h-3 w-3 mr-2" />}
                      {generatingTTS === i ? "Generating Audio..." : "Generate Voiceover (AI)"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
};

export default ScriptOutputPanel;
