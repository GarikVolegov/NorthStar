import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bookmark, X } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";

export function SavedItems() {
  const { favorites, removeFavorite } = useFavorites();
  const savedSectors = favorites.filter((f) => f.type === "sector");

  if (favorites.length === 0) return null;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-primary" /> Salvati
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {savedSectors.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Aree</p>
            <div className="space-y-2">
              {savedSectors.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{f.label}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeFavorite(f.id)} className="shrink-0">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
