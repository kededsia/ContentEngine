import React, { useState } from "react";
import AppHeader from "@/components/AppHeader";
import ScriptInputPanel from "@/components/ScriptInputPanel";
import ScriptOutputPanel from "@/components/ScriptOutputPanel";
import { saveScript, getSavedScripts } from "@/lib/favorites";
import { KENSHI_PRODUCTS, TEMPLATE_STYLES, TONES } from "@/lib/kenshi-data";
import { toast } from "@/hooks/use-toast";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-script`;

function parseScripts(text: string): string[] {
  // Better parsing: Look for actual script content starting with "## SCRIPT" or similar headers
  // First, try to find scripts marked with ## SCRIPT 1, ## SCRIPT 2, etc.
  const scriptHeaderPattern = /(?:^|\n)##\s*(?:SCRIPT|Script)\s*(\d+)/gi;
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

  const generate = async (params: {
    product: string;
    highlights: string;
    platform: string;
    style: string;
    tone: string;
    additionalInfo: string;
  }, isRegenerate = false) => {
    setIsLoading(true);
    setLastParams(params);
    
    // Only clear scripts on NEW generation, keep old scripts visible during regenerate
    if (!isRegenerate) {
      setScripts([]);
    }
    setStreamingText("");

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(params),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Gagal generate script");
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      // Clear old scripts once streaming starts (for regenerate)
      let hasStartedStreaming = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              // Clear old scripts once we start receiving new content
              if (!hasStartedStreaming && isRegenerate) {
                hasStartedStreaming = true;
                setScripts([]);
              }
              fullText += content;
              setStreamingText(fullText);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      const parsed = parseScripts(fullText);
      // Use functional update to ensure latest state
      setScripts(parsed);
      setStreamingText("");
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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
            UGC Script <span className="text-primary">Generator</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generate script UGC ads knalpot Kenshi yang akurat & siap syuting
          </p>
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
