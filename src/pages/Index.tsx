import React, { useState } from "react";
import AppHeader from "@/components/AppHeader";
import ScriptInputPanel from "@/components/ScriptInputPanel";
import ScriptOutputPanel from "@/components/ScriptOutputPanel";
import { saveScript, getSavedScripts } from "@/lib/favorites";
import { KENSHI_PRODUCTS, TEMPLATE_STYLES, TONES } from "@/lib/kenshi-data";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, TrendingUp, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const CHAT_URL = "http://localhost:3000/api/generate-script";
const STORY_URL = "http://localhost:3000/api/generate-story";
const TREND_URL = "http://localhost:3000/api/research-trend";

function parseScripts(text: string): string[] {
  // Better parsing: Look for actual script content starting with "## SCRIPT" or "## STORY" headers
  // First, try to find scripts marked with ## SCRIPT 1, ## SCRIPT 2, etc.
  const scriptHeaderPattern = /(?:^|\n)##\s*(?:SCRIPT|Script|STORY|Story|Cerita)\s*(?:\d+|#\d+)/gi;
  const matches = [...text.matchAll(scriptHeaderPattern)];

  if (matches.length >= 2) {
    // Split by script headers and extract content
    const scripts: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index!;
      const end = i < matches.length - 1 ? matches[i + 1].index! : text.length;
      const scriptContent = text.slice(start, end).trim();
      if (scriptContent) scripts.push(scriptContent);
    }
    return scripts.slice(0, 3);
  }

  // Fallback: Split by "---" separator
  const parts = text.split(/\n---+\s*\n/).filter((s) => s.trim());

  // Filter out intro/preamble text (usually before actual scripts)
  const validScripts = parts.filter(part => {
    // A valid script should have scene/hook content, not just intro text
    return part.includes("HOOK") || part.includes("Scene") || part.includes("CTA") || part.length > 500;
  });

  if (validScripts.length >= 1) return validScripts.slice(0, 3).map((s) => s.trim());
  if (parts.length >= 1) return parts.slice(0, 3).map((s) => s.trim());

  return [text.trim()];
}

const Index: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [scripts, setScripts] = useState<string[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [lastParams, setLastParams] = useState<any>(null);

  // Trend Research State
  const [isTrendLoading, setIsTrendLoading] = useState(false);
  const [trendKeyword, setTrendKeyword] = useState("");
  const [trendResult, setTrendResult] = useState("");

  const generate = async (params: {
    product: string;
    highlights: string;
    platform: string;
    style: string;
    tone: string;
    additionalInfo: string;
    mode: "script" | "story";
  }, isRegenerate = false) => {
    setIsLoading(true);
    setLastParams(params);

    // Only clear scripts on NEW generation, keep old scripts visible during regenerate
    if (!isRegenerate) {
      setScripts([]);
    }
    setStreamingText("");

    const targetUrl = params.mode === 'story' ? STORY_URL : CHAT_URL;

    try {
      const resp = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Gagal generate script");
      }

      const data = await resp.json();
      const fullText = data.result || "";

      // Simulate streaming effect for UI feel
      setStreamingText(fullText);

      const parsed = parseScripts(fullText);
      setScripts(parsed);
      setStreamingText(""); // Clear streaming text once parsed

    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = () => {
    if (lastParams) generate(lastParams, true);
  };

  const handleSave = () => {
    if (scripts.length === 0) return;
    const product = KENSHI_PRODUCTS.find((p) => p.name === lastParams?.product);
    saveScript({
      id: crypto.randomUUID(),
      productId: product?.id || "",
      productName: lastParams?.product || "",
      platform: lastParams?.platform || "",
      style: lastParams?.style || "",
      tone: lastParams?.tone || "",
      scripts,
      createdAt: new Date().toISOString(),
    });
    toast({ title: "Script disimpan ke Koleksi! ❤️" });
  };

  const handleTrendResearch = async () => {
    if (!trendKeyword) return;
    setIsTrendLoading(true);
    setTrendResult("");

    try {
      const resp = await fetch(TREND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: trendKeyword, category: "motorcycle_community" }),
      });

      if (!resp.ok) throw new Error("Trend research failed");

      const data = await resp.json();
      setTrendResult(data.insight);
      toast({ title: "Riset Trend Berhasil!", description: "Database slang telah diperbarui." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsTrendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
              UGC Script <span className="text-primary">Generator</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Generate script UGC ads knalpot Kenshi yang akurat & siap syuting
            </p>
          </div>

          {/* Trend Research Feature */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Riset Trend
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Riset Trend Otomatis</DialogTitle>
                <DialogDescription>
                  Cari tau apa yang lagi viral di komunitas motor. Hasil riset akan otomatis masuk ke database slang.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Contoh: Honda Vario, Sunmori..."
                    value={trendKeyword}
                    onChange={(e) => setTrendKeyword(e.target.value)}
                  />
                  <Button onClick={handleTrendResearch} disabled={isTrendLoading}>
                    {isTrendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
                {trendResult && (
                  <div className="bg-muted p-4 rounded-md text-sm max-h-[300px] overflow-y-auto whitespace-pre-wrap">
                    {trendResult}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid lg:grid-cols-[380px_1fr] gap-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <ScriptInputPanel onGenerate={generate} isLoading={isLoading} />
          </div>
          <div className="bg-card/50 border border-border rounded-xl p-5 min-h-[500px]">
            <ScriptOutputPanel
              scripts={scripts}
              isLoading={isLoading}
              streamingText={streamingText}
              platform={lastParams?.platform || ""}
              onRegenerate={handleRegenerate}
              onSave={handleSave}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
