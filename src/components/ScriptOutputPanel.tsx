import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw, Heart, Mic, Download, Loader2 } from "lucide-react";
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

  // Reset generated audios when scripts change (new generation or regeneration)
  useEffect(() => {
    setGeneratedAudios({});
    setGeneratingTTS(null);
  }, [scripts]);

  const copyScript = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    toast({ title: `Script ${index + 1} di-copy!` });
  };

  const extractScriptText = (script: string): string => {
    // Extract only the dialog/narration parts (remove visual prompts and headers)
    const lines = script.split("\n");
    const textParts: string[] = [];
    let inScript = false;

    for (const line of lines) {
      if (line.includes("### 📝 SCRIPT") || line.includes("**[HOOK")) {
        inScript = true;
      }
      if (line.includes("### 🎬 SCENE BREAKDOWN") || line.includes("🎬 SCENE BREAKDOWN")) {
        inScript = false;
      }
      if (inScript && !line.startsWith("**[") && !line.startsWith("###") && line.trim()) {
        textParts.push(line.replace(/\*\*/g, "").trim());
      }
    }
    return textParts.join(" ").substring(0, 2500); // Limit for TTS
  };

  const generateTTS = async (scriptIndex: number) => {
    const text = extractScriptText(scripts[scriptIndex]);
    if (!text) {
      toast({ title: "Tidak ada teks untuk di-generate", variant: "destructive" });
      return;
    }

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

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Gagal generate voiceover");
      }

      const data = await response.json();
      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      setGeneratedAudios((prev) => ({ ...prev, [scriptIndex]: audioUrl }));
      toast({ title: "Voiceover berhasil di-generate! 🎙️" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingTTS(null);
    }
  };

  const downloadAudio = (audioUrl: string, index: number) => {
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `kenshi-vo-script-${index + 1}.mp3`;
    link.click();
  };

  if (!isLoading && scripts.length === 0 && !streamingText) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
        <div className="text-6xl mb-4">🎬</div>
        <h3 className="text-xl font-bold mb-2 font-heading">Siap Generate Script?</h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          Pilih produk, atur preferensi di panel input, lalu klik Generate untuk
          menghasilkan 3 variasi script UGC yang akurat.
        </p>
      </div>
    );
  }

  if (isLoading && !streamingText) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
        <div className="animate-pulse text-6xl mb-4">⚡</div>
        <h3 className="text-xl font-bold mb-2">Generating scripts...</h3>
        <p className="text-muted-foreground text-sm">AI sedang menulis 3 variasi script UGC untuk kamu</p>
      </div>
    );
  }

  if (isLoading && streamingText) {
    return (
      <div className="space-y-4">
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {streamingText}
              <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Hasil Script</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRegenerate}>
            <RefreshCw className="h-3 w-3" /> Regenerate
          </Button>
          <Button variant="outline" size="sm" onClick={onSave}>
            <Heart className="h-3 w-3" /> Simpan
          </Button>
        </div>
      </div>

      {scripts.map((script, i) => {
        // Split script into main content and scene breakdown - more flexible regex
        const sceneBreakdownMatch = script.match(/(### 🎬 SCENE BREAKDOWN|🎬 SCENE BREAKDOWN|## SCENE BREAKDOWN|\*\*Scene 1:)/i);
        let mainScript = script;
        let sceneBreakdown = "";
        
        if (sceneBreakdownMatch && sceneBreakdownMatch.index !== undefined) {
          mainScript = script.slice(0, sceneBreakdownMatch.index).trim();
          sceneBreakdown = script.slice(sceneBreakdownMatch.index).trim();
        }
        
        return (
          <Card key={i} className="bg-card border-border overflow-hidden">
            <CardContent className="p-0">
              {/* Script Header */}
              <div className="flex items-center justify-between p-4 bg-primary/5 border-b border-border">
                <span className="text-sm font-bold text-primary uppercase tracking-wider">
                  📝 Script {i + 1}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyScript(script, i)}
                >
                  <Copy className="h-3 w-3" /> Copy
                </Button>
              </div>

              {/* Main Script Content */}
              <div className="p-5">
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {mainScript.trim()}
                </div>
              </div>
              
              {/* Scene Breakdown - Visually Separated */}
              {sceneBreakdown && (
                <div className="border-t-2 border-dashed border-primary/20 bg-secondary/20">
                  <div className="p-4 border-b border-border bg-secondary/30">
                    <span className="text-sm font-bold text-primary/80">🎬 Scene Breakdown</span>
                  </div>
                  <div className="p-5">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                      {sceneBreakdown.replace(/^###?\s*🎬?\s*SCENE BREAKDOWN\s*/i, "").trim()}
                    </div>
                  </div>
                </div>
              )}

              {/* TTS Section */}
              <div className="border-t border-border p-5 bg-card">
                <div className="flex items-center gap-2 mb-3">
                  <Mic className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Voiceover</span>
                </div>
                {generatedAudios[i] ? (
                  <div className="flex items-center gap-2">
                    <audio controls src={generatedAudios[i]} className="flex-1 h-10" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadAudio(generatedAudios[i], i)}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => generateTTS(i)}
                    disabled={generatingTTS === i}
                  >
                    {generatingTTS === i ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Generating VO...
                      </>
                    ) : (
                      <>
                        <Mic className="h-3 w-3" />
                        Generate Voiceover
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default ScriptOutputPanel;
