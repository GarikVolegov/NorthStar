import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Compass, TrendingUp } from "lucide-react";
import { useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";

export function UserModeCard({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery<{ userMode?: string }>({
    queryKey: ["user-mode", userId],
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/profile/${userId}`);
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const currentMode = (data?.userMode ?? "explorer") as "explorer" | "climber";

  const switchMode = async (mode: "explorer" | "climber") => {
    if (mode === currentMode || saving) return;
    setSaving(true);
    try {
      const res = await apiFetch(`${BASE}api/profile/${userId}/mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMode: mode }),
      });
      if (!res.ok) throw new Error("Errore");
      queryClient.invalidateQueries({ queryKey: ["user-mode", userId] });
      queryClient.invalidateQueries({ queryKey: ["user-mode-dashboard"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Compass className="w-4 h-4 text-primary" /> Modalità percorso
          {saved && <span className="ml-auto text-xs text-emerald-600 font-medium">Salvato!</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="h-16 bg-muted animate-pulse rounded-xl" />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "explorer" as const, label: "Explorer", icon: "🧭", desc: "Esplora settori e opportunità" },
              { id: "climber" as const, label: "Climber", icon: "📈", desc: "Focus su crescita e carriera" },
            ].map((opt) => {
              const active = currentMode === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => switchMode(opt.id)}
                  disabled={saving}
                  className={cn(
                    "flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary/40 bg-primary/5 text-foreground shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-primary/20 hover:bg-primary/5",
                    saving && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                  <span className="text-[11px] leading-snug">{opt.desc}</span>
                  {active && <TrendingUp className="w-3 h-3 text-primary mt-auto self-end" />}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {currentMode === "climber"
            ? "Modalità Climber attiva: il tuo dashboard mostra strumenti avanzati per la crescita professionale."
            : "Modalità Explorer attiva: esplora settori, professioni e percorsi di studio."}
        </p>
      </CardContent>
    </Card>
  );
}
