import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, RefreshCw, Heart, Mic, Download, Loader2, Sparkles, Clapperboard, Upload, Wand2 } from "lucide-react";
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
  const [creatingDirectorPlan, setCreatingDirectorPlan] = useState<number | null>(null);
  const [directorPlans, setDirectorPlans] = useState<Record<number, string>>({});
  const [creatingRemotionSkill, setCreatingRemotionSkill] = useState<number | null>(null);
  const [remotionSkills, setRemotionSkills] = useState<Record<number, string>>({});
  const [renderingVideo, setRenderingVideo] = useState<number | null>(null);
  const audioInputs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    setGeneratedAudios({});
    setGeneratingTTS(null);
    setCreatingDirectorPlan(null);
    setDirectorPlans({});
    setCreatingRemotionSkill(null);
    setRemotionSkills({});
  }, [scripts]);

  const copyScript = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    toast({ title: `Script ${index + 1} di-copy!` });
  };

  const extractScriptText = (script: string): string => {
    return script.replace(/[*#]/g, "").substring(0, 2500);
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
    } catch (e) {
      const message = e instanceof Error ? e.message : "Terjadi kesalahan";
      toast({ title: "Error", description: message, variant: "destructive" });
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

  const handleAutoRender = async (scriptText: string, index: number) => {
    setRenderingVideo(index);
    try {
      const resp = await fetch('http://localhost:3000/api/auto-render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: scriptText })
      });
      const data = await resp.json();

      if (resp.ok) {
        toast({
          title: "Rendering Dimulai! 🎬",
          description: "Video sedang diproses di background. Cek folder 'out' atau tab Videos nanti.",
        });
      } else {
        throw new Error(data.error || "Gagal memulai render");
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setTimeout(() => setRenderingVideo(null), 2000);
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

  const generateDirectorPlan = async (scriptIndex: number, file: File) => {
    if (!file) return;

    setCreatingDirectorPlan(scriptIndex);
    try {
      const durationSec = await getAudioDuration(file);
      const audio = buildAudioAnalysis(scripts[scriptIndex], durationSec);

      const resp = await fetch("http://localhost:3000/api/director-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: scripts[scriptIndex],
          audio,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Gagal membuat director plan");
      }

      const data = await resp.json();
      const plan = data.plan || "Director plan tidak tersedia";
      setDirectorPlans((prev) => ({ ...prev, [scriptIndex]: plan }));
      toast({ title: "Director plan siap", description: "Timeline & arahan Remotion sudah dibuat." });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Terjadi kesalahan";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setCreatingDirectorPlan(null);
    }
  };

  const generateRemotionSkill = async (scriptIndex: number) => {
    const directorPlan = directorPlans[scriptIndex];
    if (!directorPlan) {
      toast({ title: "Director plan belum ada", description: "Generate director plan dulu sebelum Remotion skill." });
      return;
    }

    setCreatingRemotionSkill(scriptIndex);
    try {
      const resp = await fetch("http://localhost:3000/api/remotion-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: scripts[scriptIndex],
          directorPlan,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Gagal membuat Remotion skill pack");
      }

      const data = await resp.json();
      const skillPack = data.skillPack || "Remotion skill pack tidak tersedia";
      setRemotionSkills((prev) => ({ ...prev, [scriptIndex]: skillPack }));
      toast({ title: "Remotion skill siap", description: "Blueprint MP4 sudah dibuat." });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Terjadi kesalahan";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setCreatingRemotionSkill(null);
    }
  };

  const renderContent = (text: string) => {
    const lines = text.split("\n");
    const content: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.startsWith("### ")) {
        content.push(
          <h3 key={idx} className="text-md font-bold text-foreground/80 uppercase tracking-wide mt-6 mb-3 border-b border-border/50 pb-1">
            {trimmed.replace("### ", "").replace(/📝|🎬|🗣️/g, "").trim()}
          </h3>
        );
        return;
      }

      if (trimmed.startsWith("## ")) {
        content.push(
          <h2 key={idx} className="text-lg font-bold text-primary mb-4">
            {trimmed.replace("## ", "")}
          </h2>
        );
        return;
      }

      if (trimmed.match(/^\*\*(⏱️|🪝|🎭|📖|🎯)/)) {
        content.push(
          <div key={idx} className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-2">
            {trimmed.replace(/\*\*/g, "")}
          </div>
        );
        return;
      }

      if (trimmed.startsWith("**Scene")) {
        content.push(
          <div key={idx} className="mt-3 mb-1 font-semibold text-sm text-foreground/90">
            {trimmed.replace(/\*\*/g, "")}
          </div>
        );
        return;
      }

      const isInstruction = trimmed.toLowerCase().startsWith("baca dengan") ||
        trimmed.toLowerCase().startsWith("di baca dengan") ||
        trimmed.toLowerCase().startsWith("instruction:");

      if (isInstruction) {
        content.push(
          <p key={idx} className="text-sm italic text-muted-foreground mb-4 pl-4 border-l-2 border-border/50">
            {trimmed}
          </p>
        );
        return;
      }

      const processed = line.split(/(\*\*.*?\*\*|\[emosi:.*?\]|\[jeda:.*?\])/).map((part, pIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={pIdx} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("[emosi:") && part.endsWith("]")) {
          return <span key={pIdx} className="text-xs font-mono text-blue-500 bg-blue-500/10 px-1 rounded mx-1">{part}</span>;
        }
        if (part.startsWith("[jeda:") && part.endsWith("]")) {
          return <span key={pIdx} className="text-xs font-mono text-amber-500 bg-amber-500/10 px-1 rounded mx-1">{part}</span>;
        }
        return part;
      });

      content.push(
        <p key={idx} className="mb-3 text-sm leading-relaxed text-foreground/90">
          {processed}
        </p>
      );
    });

    return content;
  };

  if (!isLoading && scripts.length === 0 && !streamingText) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 space-y-4">
      <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center">
        <Sparkles className="h-8 w-8 text-primary/50" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">Siap Kreasikan Konsep?</h3>
        <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">
          Pilih produk dan mode, lalu biarkan AI meracik kata-kata untukmu.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          {isLoading ? "Meracik Konsep..." : "Hasil Script"}
        </h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Regenerate
          </Button>
          <Button variant="ghost" size="sm" onClick={onSave} disabled={isLoading}>
            <Heart className="h-4 w-4 mr-2" /> Simpan
          </Button>
        </div>
      </div>

      {isLoading && streamingText && (
        <div className="p-6 border border-border rounded-lg bg-card/50">
          <div className="flex gap-2 mb-4">
            <div className="h-2 w-24 bg-primary/20 rounded animate-pulse" />
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed font-mono opacity-80">
            {streamingText}<span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
          </div>
        </div>
      )}

      {!isLoading && scripts.length > 0 && (
        <div className="space-y-8">
          {scripts.map((script, i) => (
            <div key={i} className="bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="px-6 py-3 bg-muted/30 border-b border-border flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Opsi {i + 1}</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => copyScript(script, i)}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>

              <div className="p-6">
                {renderContent(script)}
              </div>

              <div className="px-6 py-4 bg-muted/10 border-t border-border flex flex-wrap justify-end gap-3">
                {generatedAudios[i] ? (
                  <div className="flex items-center gap-2 bg-background p-1 rounded border border-border">
                    <audio controls src={generatedAudios[i]} className="h-8" />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadAudio(generatedAudios[i], i)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => generateTTS(i)} disabled={generatingTTS === i}>
                    {generatingTTS === i ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Mic className="h-3 w-3 mr-2" />}
                    Gen Voice (AI)
                  </Button>
                )}

                <Button variant="default" size="sm" onClick={() => handleAutoRender(script, i)} disabled={renderingVideo === i}>
                  {renderingVideo === i ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Clapperboard className="h-3 w-3 mr-2" />}
                  Auto Video
                </Button>

                <input
                  ref={(el) => { audioInputs.current[i] = el; }}
                  type="file"
                  accept="audio/mpeg,audio/wav,.mp3,.wav"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) generateDirectorPlan(i, file);
                    e.currentTarget.value = "";
                  }}
                />

                <Button variant="secondary" size="sm" onClick={() => audioInputs.current[i]?.click()} disabled={creatingDirectorPlan === i}>
                  {creatingDirectorPlan === i ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Wand2 className="h-3 w-3 mr-2" />}
                  Manual Director
                </Button>
              </div>

              {directorPlans[i] && (
                <div className="p-4 border-t border-border bg-background/60 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-bold text-primary">Director Plan</h4>
                    <Button variant="outline" size="sm" onClick={() => generateRemotionSkill(i)} disabled={creatingRemotionSkill === i}>
                      {creatingRemotionSkill === i ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Clapperboard className="h-3 w-3 mr-2" />}
                      Build Skill
                    </Button>
                  </div>
                  <pre className="text-xs whitespace-pre-wrap leading-relaxed font-mono max-h-[200px] overflow-y-auto bg-muted/20 p-2 rounded">{directorPlans[i]}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScriptOutputPanel;
