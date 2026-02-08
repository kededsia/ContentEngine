import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw, Heart } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ScriptOutputPanelProps {
  scripts: string[];
  isLoading: boolean;
  streamingText: string;
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
  const copyScript = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    toast({ title: `Script ${index + 1} di-copy!` });
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

  // While streaming, show raw text
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

      {scripts.map((script, i) => (
        <Card key={i} className="bg-card border-border group">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                Script {i + 1}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyScript(script, i)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Copy className="h-3 w-3" /> Copy
              </Button>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {script}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ScriptOutputPanel;
