import React, { useState } from "react";
import AppHeader from "@/components/AppHeader";
import ScriptInputPanel from "@/components/ScriptInputPanel";
import ScriptOutputPanel from "@/components/ScriptOutputPanel";
import { saveScript, getSavedScripts } from "@/lib/favorites";
import { KENSHI_PRODUCTS, TEMPLATE_STYLES, TONES } from "@/lib/kenshi-data";
import { toast } from "@/hooks/use-toast";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-script`;

function parseScripts(text: string): string[] {
  // Split by "---" or "Script 1/2/3" patterns
  const parts = text.split(/(?:^|\n)---\s*\n|(?:^|\n)(?:Script|SCRIPT)\s*\d\s*[:\n]/i).filter((s) => s.trim());
  if (parts.length >= 3) return parts.slice(0, 3).map((s) => s.trim());
  if (parts.length === 1) return [parts[0].trim()];
  return parts.map((s) => s.trim());
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
  }) => {
    setIsLoading(true);
    setScripts([]);
    setStreamingText("");
    setLastParams(params);

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
      setScripts(parsed);
      setStreamingText("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = () => {
    if (lastParams) generate(lastParams);
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
