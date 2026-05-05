import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useGetSector } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Sparkles, Loader2, Zap, BookOpen, Award, Target,
  TrendingUp, Lightbulb, CheckCircle2, ChevronDown, ChevronUp,
  MapPin, Euro, Users, GraduationCap, Rocket, Briefcase, Wrench,
  School, BookMarked, Star, Info, ThumbsUp, ThumbsDown, Plus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";

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

interface PathOption {
  id: string;
  type: string;
  title: string;
  shortDescription: string;
  duration: string;
  estimatedCost: string;
  fitScore: number;
  fitReason: string;
  bestFor: string;
  pros: string[];
  cons: string[];
  phases: RoadmapPhase[];
}

interface AlternativeFormativePath {
  title: string;
  type: string;
  duration: string;
  benefit: string;
}

interface SalaryPhase {
  phase: string;
  range: string;
}

interface RoadmapData {
  userProfileSummary: string;
  recommendedPathId: string;
  recommendationReason: string;
  totalDurationBest: string;
  paths: PathOption[];
  alternativeFormativePaths: AlternativeFormativePath[];
  comparison: string;
  salaryProgression: SalaryPhase[];
  topRoles: string[];
  keyTip: string;
}

const resourceIcons: Record<string, React.ReactNode> = {
  corso: <BookOpen className="w-3 h-3" />,
  certificazione: <Award className="w-3 h-3" />,
  libro: <BookMarked className="w-3 h-3" />,
  community: <Users className="w-3 h-3" />,
};
const resourceColors: Record<string, string> = {
  corso: "bg-blue-50 text-blue-700 border-blue-100",
  certificazione: "bg-violet-50 text-violet-700 border-violet-100",
  libro: "bg-amber-50 text-amber-700 border-amber-100",
  community: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

function pathTypeIcon(type: string): React.ReactNode {
  const t = type.toLowerCase();
  if (t.includes("università") || t.includes("laurea") || t.includes("master")) return <GraduationCap className="w-4 h-4" />;
  if (t.includes("its")) return <School className="w-4 h-4" />;
  if (t.includes("bootcamp")) return <Rocket className="w-4 h-4" />;
  if (t.includes("apprendistato")) return <Briefcase className="w-4 h-4" />;
  if (t.includes("autodidatta") || t.includes("certificazion")) return <Wrench className="w-4 h-4" />;
  return <BookOpen className="w-4 h-4" />;
}

function fitScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 60) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
}

// ─── Phase card ─────────────────────────────────────────────────────────────
function PhaseCard({ phase, index }: { phase: RoadmapPhase; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div className="relative">
      <div className="absolute left-[22px] top-[52px] bottom-0 w-px bg-border" />
      <div className="flex gap-4">
        <div className="shrink-0 w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl z-10 relative">
          {phase.emoji}
        </div>
        <div className="flex-1 pb-8 min-w-0">
          <button onClick={() => setExpanded((v) => !v)} className="w-full text-left">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-muted-foreground">Fase {phase.id}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{phase.duration}</Badge>
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
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Azioni concrete</h4>
                <ul className="space-y-2">
                  {phase.actions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {phase.resources && phase.resources.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Risorse consigliate</h4>
                  <div className="flex flex-wrap gap-2">
                    {phase.resources.map((res, i) => (
                      <div
                        key={i}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium",
                          resourceColors[res.type] ?? "bg-secondary text-secondary-foreground border-border",
                        )}
                      >
                        {resourceIcons[res.type] ?? <Zap className="w-3 h-3" />}
                        <span>{res.name}</span>
                        {(res.platform || res.issuer || res.author) && (
                          <span className="opacity-60">· {res.platform ?? res.issuer ?? res.author}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">Traguardo</span>
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

// ─── Path option card (selector) ────────────────────────────────────────────
function PathCard({
  path,
  isSelected,
  isRecommended,
  onClick,
}: {
  path: PathOption;
  isSelected: boolean;
  isRecommended: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left rounded-2xl border bg-card p-4 transition-all hover:shadow-md hover:-translate-y-0.5",
        isSelected ? "border-primary ring-2 ring-primary/20 shadow-sm" : "border-border",
      )}
    >
      <div className="flex items-start gap-3 mb-2">
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
            isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {pathTypeIcon(path.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{path.type}</Badge>
            {isRecommended && (
              <Badge className="text-[10px] px-1.5 py-0 bg-primary text-primary-foreground border-primary">
                <Star className="w-2.5 h-2.5 mr-0.5" /> Consigliato per te
              </Badge>
            )}
          </div>
          <h3 className="font-semibold text-sm leading-tight">{path.title}</h3>
        </div>
        <div
          className={cn(
            "shrink-0 px-2 py-1 rounded-lg border text-xs font-bold",
            fitScoreColor(path.fitScore),
          )}
          title={`Affinità con il tuo profilo: ${path.fitScore}/100`}
        >
          {path.fitScore}%
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{path.shortDescription}</p>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{path.duration}</span>
        <span className="flex items-center gap-1"><Euro className="w-3 h-3" />{path.estimatedCost}</span>
      </div>
    </button>
  );
}

// ─── Pros / cons ────────────────────────────────────────────────────────────
function ProsConsBlock({ pros, cons }: { pros: string[]; cons: string[] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <ThumbsUp className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Vantaggi</span>
        </div>
        <ul className="space-y-1.5">
          {pros.map((p, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <Plus className="w-3 h-3 text-emerald-600 shrink-0 mt-1" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-rose-50/40 border border-rose-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <ThumbsDown className="w-4 h-4 text-rose-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">Svantaggi</span>
        </div>
        <ul className="space-y-1.5">
          {cons.map((c, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <span className="text-rose-600 shrink-0 mt-0.5 font-bold leading-none">−</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function Roadmap() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { user } = useAuth();

  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);

  const { data: sector, isLoading } = useGetSector(id, {
    query: { enabled: !!id, queryKey: ["sector", id] },
  });

  const sortedPaths = useMemo(
    () => (roadmap ? [...roadmap.paths].sort((a, b) => b.fitScore - a.fitScore) : []),
    [roadmap],
  );
  const selected = useMemo(
    () => roadmap?.paths.find((p) => p.id === selectedPathId) ?? sortedPaths[0] ?? null,
    [roadmap, selectedPathId, sortedPaths],
  );

  async function generateRoadmap() {
    setIsGenerating(true);
    setRoadmap(null);
    setErrorMsg(null);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 5, 90));
    }, 400);

    try {
      const res = await apiFetch(`${BASE}api/roadmap/${id}/generate`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.error ?? "Servizio AI non disponibile. Riprova più tardi.");
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("Nessun reader");
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let parseErr = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(part.slice(6));
            if (data.content) fullText += data.content;
            if (data.error) {
              parseErr = true;
              setErrorMsg(data.error);
            }
            if (data.done) {
              const jsonMatch = fullText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                try {
                  const parsed: RoadmapData = JSON.parse(jsonMatch[0]);
                  setRoadmap(parsed);
                  setSelectedPathId(parsed.recommendedPathId ?? parsed.paths[0]?.id ?? null);
                } catch {
                  parseErr = true;
                  setErrorMsg("Risposta dell'AI non valida. Riprova.");
                }
              } else if (!parseErr) {
                parseErr = true;
                setErrorMsg("Risposta dell'AI vuota. Riprova.");
              }
            }
          } catch {
            /* ignore malformed sse chunk */
          }
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Errore di rete");
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
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 shrink-0" asChild>
          <Link href={`/settore/${id}`}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-serif font-bold text-2xl truncate">Roadmap personalizzata</h1>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/20 text-primary bg-primary/5 shrink-0">
              <Sparkles className="w-2 h-2 mr-1" />Premium
            </Badge>
          </div>
          {sector && <p className="text-sm text-muted-foreground">{sector.name}</p>}
        </div>
      </div>

      {/* Generate state */}
      {!roadmap && !isGenerating && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-serif font-bold mb-3">Tutti i percorsi verso {sector?.name}</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-2">
            L'AI analizza il tuo profilo (test, preferenze, formazione) ed esplora i percorsi possibili
            — laurea, ITS, bootcamp, apprendistato, autodidatta — confrontando vantaggi, svantaggi e costi.
          </p>
          <p className="text-muted-foreground text-xs max-w-md mx-auto mb-8">
            Riceverai una raccomandazione personalizzata e percorsi formativi alternativi.
          </p>
          <Button size="lg" onClick={generateRoadmap} className="rounded-xl px-8">
            <Sparkles className="w-4 h-4 mr-2" />
            Esplora i percorsi
          </Button>
          {errorMsg && (
            <p className="text-xs text-destructive mt-4">{errorMsg}</p>
          )}
        </div>
      )}

      {/* Loading state */}
      {isGenerating && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Esplorando i percorsi possibili…</h2>
          <p className="text-muted-foreground text-sm mb-8">
            L'AI sta confrontando laurea, ITS, bootcamp, apprendistato e autodidatta — su misura per te
          </p>
          <div className="max-w-xs mx-auto">
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{Math.round(progress)}%</p>
          </div>
        </div>
      )}

      {/* Roadmap content */}
      {roadmap && (
        <div className="animate-in fade-in duration-500 space-y-10">
          {/* User profile recap */}
          {roadmap.userProfileSummary && (
            <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Info className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Il tuo profilo</h3>
                  <p className="text-sm leading-relaxed">{roadmap.userProfileSummary}</p>
                </div>
              </div>
            </div>
          )}

          {/* Path selector */}
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-serif font-bold">Confronta i percorsi possibili</h2>
              <span className="text-xs text-muted-foreground">{sortedPaths.length} alternative analizzate</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedPaths.map((p) => (
                <PathCard
                  key={p.id}
                  path={p}
                  isSelected={selected?.id === p.id}
                  isRecommended={p.id === roadmap.recommendedPathId}
                  onClick={() => setSelectedPathId(p.id)}
                />
              ))}
            </div>
          </div>

          {/* Recommendation reason */}
          {roadmap.recommendationReason && (
            <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4 text-emerald-700" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">
                    Perché ti consigliamo questo percorso
                  </h3>
                  <p className="text-sm leading-relaxed text-emerald-950">{roadmap.recommendationReason}</p>
                </div>
              </div>
            </div>
          )}

          {/* Selected path details */}
          {selected && (
            <div className="space-y-6">
              <div className="border-t pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Percorso selezionato</span>
                  {selected.id === roadmap.recommendedPathId && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-primary text-primary-foreground">
                      <Star className="w-2.5 h-2.5 mr-0.5" /> Consigliato
                    </Badge>
                  )}
                </div>
                <h2 className="text-2xl font-serif font-bold mb-1.5">{selected.title}</h2>
                <p className="text-sm text-muted-foreground mb-4">{selected.shortDescription}</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="bg-muted rounded-lg px-2.5 py-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {selected.duration}
                  </span>
                  <span className="bg-muted rounded-lg px-2.5 py-1 flex items-center gap-1">
                    <Euro className="w-3 h-3" /> {selected.estimatedCost}
                  </span>
                  <span className={cn("rounded-lg px-2.5 py-1 flex items-center gap-1 border", fitScoreColor(selected.fitScore))}>
                    <Sparkles className="w-3 h-3" /> Affinità {selected.fitScore}/100
                  </span>
                </div>
              </div>

              {/* Fit reason */}
              <div className="bg-card border rounded-2xl p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Adatto a te perché</h4>
                <p className="text-sm">{selected.fitReason}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  <span className="font-medium">Profilo ideale:</span> {selected.bestFor}
                </p>
              </div>

              {/* Pros / Cons */}
              <ProsConsBlock pros={selected.pros} cons={selected.cons} />

              {/* Phases */}
              {selected.phases && selected.phases.length > 0 && (
                <div>
                  <h3 className="text-base font-serif font-bold mb-5">Le fasi di questo percorso</h3>
                  <div>
                    {selected.phases.map((phase, i) => (
                      <PhaseCard key={`${selected.id}-${phase.id}`} phase={phase} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comparison */}
          {roadmap.comparison && (
            <div className="bg-card border rounded-2xl p-5">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Confronto onesto
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{roadmap.comparison}</p>
            </div>
          )}

          {/* Alternative formative paths */}
          {roadmap.alternativeFormativePaths && roadmap.alternativeFormativePaths.length > 0 && (
            <div>
              <h2 className="text-lg font-serif font-bold mb-2">Percorsi formativi laterali</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Esperienze formative che rafforzano il tuo profilo, indipendentemente dal percorso principale che scegli.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {roadmap.alternativeFormativePaths.map((alt, i) => (
                  <div key={i} className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{alt.type}</Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{alt.duration}</Badge>
                    </div>
                    <h4 className="font-semibold text-sm mb-1">{alt.title}</h4>
                    <p className="text-xs text-muted-foreground">{alt.benefit}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Salary progression */}
          {roadmap.salaryProgression && roadmap.salaryProgression.length > 0 && (
            <div className="bg-card border rounded-2xl p-6">
              <h2 className="text-lg font-serif font-bold mb-5 flex items-center gap-2">
                <Euro className="w-5 h-5 text-emerald-500" /> Evoluzione salariale
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
                <Users className="w-5 h-5 text-primary" /> Ruoli a cui puoi aspirare
              </h2>
              <div className="flex flex-wrap gap-2">
                {roadmap.topRoles.map((role, i) => (
                  <Badge key={i} variant="secondary" className="px-3 py-1.5 text-sm">{role}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Key tip */}
          {roadmap.keyTip && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-amber-800">Consiglio chiave per te</h3>
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
