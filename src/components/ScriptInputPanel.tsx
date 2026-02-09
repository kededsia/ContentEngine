import React, { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import {
  KENSHI_PRODUCTS,
  HIGHLIGHTS,
  PLATFORMS,
  TEMPLATE_STYLES,
  TONES,
} from "@/lib/kenshi-data";

interface ScriptInputPanelProps {
  onGenerate: (params: {
    product: string;
    highlights: string;
    platform: string;
    style: string;
    tone: string;
    additionalInfo: string;
  }) => void;
  isLoading: boolean;
}

// Timer component untuk menampilkan durasi loading
const LoadingTimer: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  const getStatusMessage = () => {
    if (seconds < 5) return "Menyiapkan data...";
    if (seconds < 15) return "Menganalisis trend...";
    if (seconds < 30) return "Generating scripts...";
    if (seconds < 45) return "Hampir selesai...";
    return "Menunggu response AI...";
  };

  return (
    <div className="flex flex-col items-center gap-1 w-full">
      <span className="text-xs text-muted-foreground">{getStatusMessage()}</span>
      <span className="text-xs font-mono text-primary">{seconds}s</span>
    </div>
  );
};

const ScriptInputPanel: React.FC<ScriptInputPanelProps> = ({ onGenerate, isLoading }) => {
  const [product, setProduct] = useState("");
  const [selectedHighlights, setSelectedHighlights] = useState<string[]>([]);
  const [platform, setPlatform] = useState("");
  const [style, setStyle] = useState("");
  const [tone, setTone] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  const toggleHighlight = (id: string) => {
    setSelectedHighlights((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    const productData = KENSHI_PRODUCTS.find((p) => p.id === product);
    const highlightLabels = selectedHighlights
      .map((id) => HIGHLIGHTS.find((h) => h.id === id)?.label)
      .filter(Boolean)
      .join(", ");
    const platformLabel = PLATFORMS.find((p) => p.id === platform)?.label || "";
    const styleLabel = TEMPLATE_STYLES.find((s) => s.id === style)?.label || "";
    const toneLabel = TONES.find((t) => t.id === tone)?.label || "";

    onGenerate({
      product: productData?.name || "",
      highlights: highlightLabels,
      platform: platformLabel,
      style: styleLabel,
      tone: toneLabel,
      additionalInfo,
    });
  };

  const isValid = product && platform && style && tone;

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">Pilih Produk</label>
        <Select value={product} onValueChange={setProduct}>
          <SelectTrigger className="bg-secondary border-border">
            <SelectValue placeholder="Pilih varian Kenshi Hanzo..." />
          </SelectTrigger>
          <SelectContent>
            {KENSHI_PRODUCTS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {product && (
          <p className="text-xs text-muted-foreground mt-1">
            Motor: {KENSHI_PRODUCTS.find((p) => p.id === product)?.motor}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">Highlight Keunggulan</label>
        <div className="grid grid-cols-2 gap-2">
          {HIGHLIGHTS.map((h) => (
            <label
              key={h.id}
              className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-md hover:bg-secondary/50 transition-colors"
            >
              <Checkbox
                checked={selectedHighlights.includes(h.id)}
                onCheckedChange={() => toggleHighlight(h.id)}
              />
              <span className="text-muted-foreground">{h.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">Target Platform</label>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                platform === p.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary text-muted-foreground hover:border-primary/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">Template Style</label>
        <div className="space-y-2">
          {TEMPLATE_STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                style === s.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-secondary hover:border-primary/50"
              }`}
            >
              <div className="font-medium text-sm">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">Tone</label>
        <div className="grid grid-cols-2 gap-2">
          {TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTone(t.id)}
              className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                tone === t.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary text-muted-foreground hover:border-primary/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">
          Info Tambahan <span className="text-muted-foreground font-normal">(opsional)</span>
        </label>
        <Textarea
          placeholder="Misal: lagi promo 12.12, collab dengan kreator X, dll..."
          value={additionalInfo}
          onChange={(e) => setAdditionalInfo(e.target.value)}
          className="bg-secondary border-border resize-none"
          rows={3}
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!isValid || isLoading}
        className="w-full h-auto min-h-12 text-base font-semibold flex-col py-3"
        size="lg"
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-2 w-full">
            <div className="flex items-center gap-2">
              <Loader2 className="animate-spin h-5 w-5" />
              <span>Generating...</span>
            </div>
            <LoadingTimer isActive={isLoading} />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <span>Generate Script</span>
          </div>
        )}
      </Button>
    </div>
  );
};

export default ScriptInputPanel;
