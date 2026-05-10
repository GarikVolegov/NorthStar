import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, GitCompare, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL || "/";

interface TestSession {
  id: number;
  primaryTypes: string[];
  riasecScores: Record<string, number>;
  recommendations: Array<{ sectorId: number; sectorName: string; matchScore: number }>;
  createdAt: string;
  confirmedSectorId: number | null;
}

const RIASEC_META: Record<string, { label: string; color: string }> = {
  R: { label: "Realista",        color: "bg-amber-50  text-amber-700  border-amber-200" },
  I: { label: "Investigativo",   color: "bg-blue-50   text-blue-700   border-blue-200" },
  A: { label: "Artistico",       color: "bg-violet-50 text-violet-700 border-violet-200" },
  S: { label: "Sociale",         color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  E: { label: "Intraprendente",  color: "bg-orange-50 text-orange-700 border-orange-200" },
  C: { label: "Convenzionale",   color: "bg-slate-50  text-slate-700  border-slate-200" },
};

export function TestHistoryCard() {
  const { data: sessions = [], isLoading } = useQuery<TestSession[]>({
    queryKey: ["test-history"],
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/test-sessions/history`);
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" /> Cronologia test
          {sessions.length > 0 && (
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {sessions.length} {sessions.length === 1 ? "sessione" : "sessioni"}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-[72px] bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">
              Nessun test completato ancora.
            </p>
            <Link href="/test">
              <Button variant="outline" size="sm" className="rounded-xl">
                Fai il test ora
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s, idx) => {
              const topType = s.primaryTypes?.[0];
              const topSector = s.recommendations?.[0];
              const meta = topType ? RIASEC_META[topType] : null;
              const isLatest = idx === 0;

              return (
                <Link key={s.id} href={`/risultati/${s.id}`}>
                  <div className="group flex items-center gap-3 p-3 rounded-xl border hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold",
                        isLatest
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      {topType ?? "?"}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        {isLatest && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-2 py-0.5">
                            Recente
                          </span>
                        )}
                        {s.confirmedSectorId && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                            ✓ Confermato
                          </span>
                        )}
                        {meta && (
                          <span className={cn("text-xs border rounded-full px-2 py-0.5", meta.color)}>
                            {meta.label}
                          </span>
                        )}
                      </div>
                      {topSector && (
                        <p className="text-xs text-muted-foreground truncate">
                          {topSector.sectorName} · {topSector.matchScore}% match
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2 text-right">
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(s.createdAt).toLocaleDateString("it-IT", {
                          day: "numeric",
                          month: "short",
                          year: "2-digit",
                        })}
                      </p>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </Link>
              );
            })}

            {sessions.length >= 2 && (
              <Link
                href={`/confronta-sessioni?a=${sessions[0]?.id}&b=${sessions[1]?.id}`}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl gap-2 mt-1"
                >
                  <GitCompare className="w-3.5 h-3.5" /> Confronta ultime due sessioni
                </Button>
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
