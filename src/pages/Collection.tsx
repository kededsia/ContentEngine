import React, { useState, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Trash2 } from "lucide-react";
import { getSavedScripts, deleteScript } from "@/lib/favorites";
import { KENSHI_PRODUCTS } from "@/lib/kenshi-data";
import { SavedScript } from "@/lib/kenshi-data";
import { toast } from "@/hooks/use-toast";

const Collection: React.FC = () => {
  const [scripts, setScripts] = useState<SavedScript[]>([]);
  const [filterProduct, setFilterProduct] = useState("all");

  useEffect(() => {
    setScripts(getSavedScripts());
  }, []);

  const filtered = filterProduct === "all"
    ? scripts
    : scripts.filter((s) => s.productId === filterProduct);

  const handleDelete = (id: string) => {
    deleteScript(id);
    setScripts(getSavedScripts());
    toast({ title: "Script dihapus" });
  };

  const copyAll = (s: SavedScript) => {
    navigator.clipboard.writeText(s.scripts.join("\n\n---\n\n"));
    toast({ title: "Semua script di-copy!" });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
              Koleksi <span className="text-primary">Script</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {scripts.length} script tersimpan
            </p>
          </div>
          <Select value={filterProduct} onValueChange={setFilterProduct}>
            <SelectTrigger className="w-[220px] bg-secondary border-border">
              <SelectValue placeholder="Filter produk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Produk</SelectItem>
              {KENSHI_PRODUCTS.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name.replace("KENSHI HANZO — ", "")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📁</div>
            <p className="text-muted-foreground">Belum ada script tersimpan.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((saved) => (
              <Card key={saved.id} className="bg-card border-border">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-bold text-sm">{saved.productName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {saved.platform} · {saved.style} · {saved.tone} · {new Date(saved.createdAt).toLocaleDateString("id-ID")}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => copyAll(saved)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(saved.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {saved.scripts.map((script, i) => (
                      <div key={i} className="bg-secondary/50 rounded-lg p-3">
                        <div className="text-xs font-bold text-primary mb-1">Script {i + 1}</div>
                        <div className="text-sm whitespace-pre-wrap text-foreground/80 line-clamp-4">
                          {script}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Collection;
