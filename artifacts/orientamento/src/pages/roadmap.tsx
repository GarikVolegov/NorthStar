import React, { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetSector } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Sparkles, Loader2, Zap, BookOpen, Award, Target,
  TrendingUp, Lightbulb, CheckCircle2, ChevronDown, ChevronUp,
  MapPin, Euro, Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const BASE = import.meta.env.BASE_URL || "/";

interface RoadmapResource {
  type: string;
  name: string;
  platform?: string;
  issuer?: string;
  author?: string;
}

interface RoadmapPhase {
  id: number;
  title: string;
  duration: string;
  emoji: string;
  description: string;
  actions: string[];
  resources: RoadmapResource[];
  milestone: string;
}

interface SalaryPhase {
  phase: string;
  range: string;
}

interface RoadmapData {
  totalDuration: string;
  phases: RoadmapPhase[];
  salaryProgression: SalaryPhase[];
  topRoles: string[];
  keyTip: string;
}

const resourceIcons: Record<string, React.ReactNode> = {
  corso: <BookOpen className="w-3 h-3" />,
  certificazione: <Award className="w-3 h-3" />,
  libro: <BookOpen className="w-3 h-3" />,
  community: <Users className="w-3 h-3" />,
};

const resourceColors: Record<string, string> = {
  corso: "bg-blue-50 text-blue-700 border-blue-100",
  certificazione: "bg-violet-50 text-violet-700 border-violet-100",
  libro: "bg-amber-50 text-amber-700 border-amber-100",
  community: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

function PhaseCard({ phase, index }: { phase: RoadmapPhase; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div className="relative">
      {/* Timeline connector */}
      <div className="absolute left-[22px] top-[52px] bottom-0 w-px bg-border" />

      <div className="flex gap-4">
        {/* Step indicator */}
        <div className="shrink-0 w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl z-10 relative">
          {phase.emoji}
        </div>

        <div className="flex-1 pb-8 min-w-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full text-left"
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-muted-foreground">
                    Fase {phase.id}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {phase.duration}
                  </Badge>
                </div>
                <h3 className="font-semibold text-base mt-0.5">{phase.title}</h3>
              </div>
              <div className="shrink-0 mt-1 text-muted-foreground">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{phase.description}</p>
          </button>

          {expanded && (
            <div className="mt-4 space-y-5 animate-in fade-in duration-200">
              {/* Actions */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Azioni concrete
                </h4>
                <ul className="space-y-2">
                  {phase.actions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Resources */}
              {phase.resources && phase.resources.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Risorse consigliate
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {phase.resources.map((res, i) => (
                      <div
                        key={i}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                          resourceColors[res.type] ?? "bg-secondary text-secondary-foreground border-border"
                        }`}
                      >
                        {resourceIcons[res.type] ?? <Zap className="w-3 h-3" />}
                        <span>{res.name}</span>
                        {(res.platform || res.issuer) && (
                          <span className="opacity-60">· {res.platform ?? res.issuer}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Milestone */}
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Traguardo
                  </span>
                </div>
                <p className="text-sm">{phase.milestone}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Roadmap() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { user } = useAuth();
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data: sector, isLoading } = useGetSector(id, {
    query: { enabled: !!id, queryKey: ["sector", id] },
  });

  async function generateRoadmap() {
    setIsGenerating(true);
    setRoadmap(null);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 8, 85));
    }, 300);

    try {
      const res = await fetch(`${BASE}api/roadmap/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (part.startsWith("data: ")) {
            try {
              const data = JSON.parse(part.slice(6));
              if (data.content) {
                fullText += data.content;
              }
              if (data.done) {
                const jsonMatch = fullText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  try {
                    setRoadmap(JSON.parse(jsonMatch[0]));
                  } catch {}
                }
              }
            } catch {}
          }
        }
      }
    } catch {
      // silent fail — user can retry
    }

    clearInterval(progressInterval);
    setProgress(100);
    setIsGenerating(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary/30" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-lg text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <MapPin className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-serif font-bold mb-3">Accesso richiesto</h2>
        <p className="text-muted-foreground mb-8">
          Registrati gratuitamente per generare la tua roadmap personalizzata.
        </p>
        <Button asChild>
          <Link href="/registra">Registrati gratis</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 shrink-0" asChild>
          <Link href={`/settore/${id}`}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-serif font-bold text-2xl truncate">Roadmap Dettagliata</h1>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/20 text-primary bg-primary/5 shrink-0">
              <Sparkles className="w-2 h-2 mr-1" />Premium
            </Badge>
          </div>
          {sector && (
            <p className="text-sm text-muted-foreground">{sector.name}</p>
          )}
        </div>
      </div>

      {/* Generate state */}
      {!roadmap && !isGenerating && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-serif font-bold mb-3">
            Il tuo percorso verso {sector?.name}
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-8">
            Genera un piano step-by-step personalizzato con fasi, azioni concrete,
            risorse consigliate e traguardi misurabili per entrare nel settore.
          </p>
          <Button size="lg" onClick={generateRoadmap} className="rounded-xl px-8">
            <Sparkles className="w-4 h-4 mr-2" />
            Genera la mia Roadmap
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isGenerating && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Costruendo la tua roadmap…</h2>
          <p className="text-muted-foreground text-sm mb-8">
            L'AI sta analizzando il settore e costruendo un piano su misura per te
          </p>
          <div className="max-w-xs mx-auto">
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{Math.round(progress)}%</p>
          </div>
        </div>
      )}

      {/* Roadmap content */}
      {roadmap && (
        <div className="animate-in fade-in duration-500 space-y-10">
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border rounded-2xl p-4 text-center">
              <div className="text-2xl font-serif font-bold text-primary">{roadmap.totalDuration}</div>
              <div className="text-xs text-muted-foreground mt-1">Durata totale</div>
            </div>
            <div className="bg-card border rounded-2xl p-4 text-center">
              <div className="text-2xl font-serif font-bold">{roadmap.phases.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Fasi del percorso</div>
            </div>
            <div className="bg-card border rounded-2xl p-4 text-center">
              <div className="text-2xl font-serif font-bold text-emerald-600">
                {roadmap.phases.reduce((s, p) => s + p.actions.length, 0)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Azioni concrete</div>
            </div>
          </div>

          {/* Phases timeline */}
          <div>
            <h2 className="text-lg font-serif font-bold mb-6">Le Fasi del Percorso</h2>
            <div>
              {roadmap.phases.map((phase, i) => (
                <PhaseCard key={phase.id} phase={phase} index={i} />
              ))}
            </div>
          </div>

          {/* Salary progression */}
          {roadmap.salaryProgression && roadmap.salaryProgression.length > 0 && (
            <div className="bg-card border rounded-2xl p-6">
              <h2 className="text-lg font-serif font-bold mb-5 flex items-center gap-2">
                <Euro className="w-5 h-5 text-emerald-500" />
                Evoluzione Salariale
              </h2>
              <div className="space-y-4">
                {roadmap.salaryProgression.map((sp, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <div className="flex-1 flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{sp.phase}</span>
                      <span className="font-semibold text-sm">{sp.range}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top roles */}
          {roadmap.topRoles && roadmap.topRoles.length > 0 && (
            <div>
              <h2 className="text-lg font-serif font-bold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Ruoli a cui puoi aspirare
              </h2>
              <div className="flex flex-wrap gap-2">
                {roadmap.topRoles.map((role, i) => (
                  <Badge key={i} variant="secondary" className="px-3 py-1.5 text-sm">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Key tip */}
          {roadmap.keyTip && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-amber-800">Consiglio chiave</h3>
              </div>
              <p className="text-sm text-amber-900 leading-relaxed">{roadmap.keyTip}</p>
            </div>
          )}

          {/* Regenerate */}
          <div className="text-center pt-4 pb-8">
            <Button variant="outline" onClick={generateRoadmap} className="rounded-xl">
              <TrendingUp className="w-4 h-4 mr-2" />
              Rigenera la roadmap
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
