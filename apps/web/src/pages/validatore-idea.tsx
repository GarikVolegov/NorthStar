import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import { useLocation } from "wouter";
import {
  Lightbulb, Sparkles, Target, TrendingUp, AlertTriangle,
  Zap, Building2, ArrowRight, Loader2, CheckCircle2,
  ChevronDown, ChevronUp, Trash2, Plus, Star,
  DollarSign, Users, Shield, FlaskConical, ExternalLink,
  Compass, Clock,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

const SECTORS = [
  "Tecnologia & Software", "Fintech & Finanza", "Salute & Biotech",
  "Educazione & Formazione", "E-commerce & Retail", "Food & Agritech",
  "Sostenibilità & Cleantech", "Media & Creatività", "Turismo & Hospitality",
  "Manifattura & Industria", "Real Estate & Proptech", "Altro",
];

interface ValidationData {
  title: string;
  problem: string;
  target: string;
  value_proposition: string;
  differentiation: string;
  revenue_model: string;
  technical_complexity: string;
  main_risks: string[];
  first_experiments: string[];
  market_size: string;
  investor_pitch: string;
  validation_score: number;
  confidence_level: string;
  improvement_tips: string[];
}

interface FundingOpportunity {
  name: string;
  type: string;
  description: string;
  fit_reason: string;
  application_url: string;
  deadline_note: string;
}

interface IncubatorData {
  opportunities: FundingOpportunity[];
  pitch_summary: string;
  business_canvas_summary: string;
  use_of_funds: string;
  next_steps: string[];
  italian_ecosystem_note: string;
}

interface BusinessIdea {
  id: number;
  title: string;
  ideaText: string;
  sector: string | null;
  workType: string;
  status: string;
  validationScore: number | null;
  confidenceLevel: string | null;
  validationData: ValidationData | null;
  incubatorData: IncubatorData | null;
  createdAt: string;
}

function ScoreRing({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? "text-emerald-400" : score >= 5 ? "text-amber-400" : "text-rose-400";
  const strokeColor = score >= 7 ? "hsl(var(--chart-2))" : score >= 5 ? "hsl(var(--chart-1))" : "hsl(var(--chart-5))";
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="80" height="80">
        <circle cx="40" cy="40" r={r} stroke="hsl(var(--foreground) / 0.05)" strokeWidth="5" fill="none" />
        <circle
          cx="40" cy="40" r={r}
          stroke={strokeColor} strokeWidth="5" fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className={cn("text-center", color)}>
        <div className="text-xl font-bold leading-none">{score.toFixed(1)}</div>
        <div className="text-[10px] opacity-70">/ 10</div>
      </div>
    </div>
  );
}

function ConfidenceBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    "Basso": "bg-rose-500/15 text-rose-400 border-rose-500/30",
    "Medio": "bg-amber-500/15 text-amber-400 border-amber-500/30",
    "Alto": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  };
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", map[level] || "bg-muted text-muted-foreground border-border")}>
      Confidenza: {level}
    </span>
  );
}

function ValidationCard({ data }: { data: ValidationData }) {
  const [showFull, setShowFull] = useState(false);
  return (
    <div className="space-y-5">
      {/* Score header */}
      <div className="flex items-center gap-5 p-5 bg-card border border-border rounded-2xl">
        <ScoreRing score={data.validation_score} />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-lg leading-tight mb-1">{data.title}</h3>
          <p className="text-sm text-muted-foreground italic mb-2">"{data.investor_pitch}"</p>
          <ConfidenceBadge level={data.confidence_level} />
        </div>
      </div>

      {/* Core fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoBlock icon={<Target className="h-4 w-4" />} label="Problema risolto" value={data.problem} />
        <InfoBlock icon={<Users className="h-4 w-4" />} label="Target" value={data.target} />
        <InfoBlock icon={<Star className="h-4 w-4" />} label="Proposta di valore" value={data.value_proposition} />
        <InfoBlock icon={<Zap className="h-4 w-4" />} label="Differenziazione" value={data.differentiation} />
        <InfoBlock icon={<DollarSign className="h-4 w-4" />} label="Modello di ricavo" value={data.revenue_model} />
        <InfoBlock icon={<TrendingUp className="h-4 w-4" />} label="Dimensione mercato" value={data.market_size} />
      </div>

      <button
        onClick={() => setShowFull(!showFull)}
        className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
      >
        {showFull ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {showFull ? "Mostra meno" : "Mostra analisi completa"}
      </button>

      {showFull && (
        <div className="space-y-4">
          <InfoBlock icon={<Shield className="h-4 w-4" />} label="Complessità tecnica" value={data.technical_complexity} />

          <div className="bg-card border border-rose-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <span className="text-sm font-semibold text-foreground">Rischi principali</span>
            </div>
            <ul className="space-y-1.5">
              {data.main_risks.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-rose-400 shrink-0">•</span>{r}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-card border border-primary/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <FlaskConical className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Primi esperimenti (30 giorni)</span>
            </div>
            <ol className="space-y-1.5">
              {data.first_experiments.map((e, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-primary shrink-0 font-bold">{i + 1}.</span>{e}
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-card border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold text-foreground">Come migliorare l'idea</span>
            </div>
            <ul className="space-y-1.5">
              {data.improvement_tips.map((t, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-amber-400 shrink-0">→</span>{t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-primary">{icon}</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm text-foreground leading-relaxed">{value}</p>
    </div>
  );
}

function IncubatorCard({ data }: { data: IncubatorData }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <div className="space-y-5">
      <div className="bg-card border border-primary/20 rounded-xl p-4">
        <p className="text-sm font-semibold text-primary mb-1">Pitch investor-ready</p>
        <p className="text-sm text-foreground leading-relaxed italic">"{data.pitch_summary}"</p>
      </div>

      <div>
        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Opportunità di funding ({data.opportunities.length})
        </h4>
        <div className="space-y-2">
          {data.opportunities.map((opp, i) => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/3 transition-colors"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                    {opp.type}
                  </span>
                  <span className="font-medium text-foreground text-sm">{opp.name}</span>
                </div>
                {openIdx === i ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {openIdx === i && (
                <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                  <p className="text-sm text-muted-foreground">{opp.description}</p>
                  <p className="text-sm text-foreground"><span className="text-primary font-medium">Perché è adatto: </span>{opp.fit_reason}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{opp.deadline_note}</p>
                  {opp.application_url && (
                    <a
                      href={opp.application_url.startsWith("http") ? opp.application_url : `https://${opp.application_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Scopri di più <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-primary" />
          Prossimi passi
        </h4>
        <ol className="space-y-2">
          {data.next_steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm text-muted-foreground">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ecosistema italiano</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{data.italian_ecosystem_note}</p>
      </div>
    </div>
  );
}

function IdeaDetail({ idea, onDelete }: { idea: BusinessIdea; onDelete: () => void }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"validation" | "incubators">("validation");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: fresh, refetch } = useQuery<BusinessIdea>({
    queryKey: ["business-idea", idea.id],
    queryFn: async () => {
      const r = await apiFetch(`${BASE}api/business-ideas/${idea.id}`);
      return r.json();
    },
    initialData: idea,
    staleTime: 3000,
  });

  useEffect(() => {
    if (fresh?.status === "validating") {
      pollRef.current = setInterval(() => refetch(), 3000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fresh?.status, refetch]);

  const findIncubatorsMut = useMutation({
    mutationFn: async () => {
      const r = await apiFetch(`${BASE}api/business-ideas/${idea.id}/find-incubators`, { method: "POST" });
      if (!r.ok) throw new Error("Errore");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-idea", idea.id] });
      queryClient.invalidateQueries({ queryKey: ["business-ideas"] });
      setActiveTab("incubators");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      await apiFetch(`${BASE}api/business-ideas/${idea.id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-ideas"] });
      onDelete();
    },
  });

  const current = fresh ?? idea;
  const vd = current.validationData;
  const id_ = current.incubatorData;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="font-bold text-xl text-foreground mb-1">{current.title}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {current.sector && <Badge variant="secondary" className="text-xs">{current.sector}</Badge>}
            <Badge className={cn("text-xs border-0",
              current.workType === "autonomous"
                ? "bg-primary/10 text-primary"
                : "bg-blue-500/10 text-blue-400"
            )}>
              {current.workType === "autonomous" ? "Autonomo" : "Dipendente"}
            </Badge>
            <StatusBadge status={current.status} />
          </div>
        </div>
        <button
          onClick={() => deleteMut.mutate()}
          disabled={deleteMut.isPending}
          className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {current.status === "validating" && (
        <div className="flex items-center gap-3 py-10 justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">L'intelligenza artificiale sta analizzando la tua idea…</span>
        </div>
      )}

      {current.status === "draft" && !vd && (
        <div className="text-center py-10 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-amber-400" />
          <p>Validazione non riuscita. Prova a modificare l'idea e risubmittarla.</p>
        </div>
      )}

      {(current.status === "validated" || current.status === "incubating") && vd && (
        <>
          <div className="flex gap-1 mb-5 bg-card rounded-xl p-1 border border-border w-fit">
            <button
              onClick={() => setActiveTab("validation")}
              className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                activeTab === "validation" ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Validazione
            </button>
            <button
              onClick={() => setActiveTab("incubators")}
              className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                activeTab === "incubators" ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Incubatori & Funding
            </button>
          </div>

          {activeTab === "validation" && (
            <div>
              <ValidationCard data={vd} />
              {!id_ && (
                <div className="mt-6 p-5 bg-card border border-primary/20 rounded-2xl">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Trova incubatori e funding</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Cerca incubatori, acceleratori, grant e fondi italiani ed europei adatti alla tua idea.
                        Ricevi anche un application pack con pitch e business canvas.
                      </p>
                      <Button
                        onClick={() => findIncubatorsMut.mutate()}
                        disabled={findIncubatorsMut.isPending}
                        className="rounded-full gap-2"
                      >
                        {findIncubatorsMut.isPending
                          ? <><Loader2 className="h-4 w-4 animate-spin" />Ricerca in corso…</>
                          : <><Sparkles className="h-4 w-4" />Cerca opportunità</>
                        }
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "incubators" && id_ && <IncubatorCard data={id_} />}
          {activeTab === "incubators" && !id_ && (
            <div className="text-center py-10 text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="mb-4">Nessuna ricerca ancora effettuata.</p>
              <Button onClick={() => { setActiveTab("validation"); }} variant="outline" className="rounded-full">
                Vai alla validazione
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:      { label: "Bozza",      cls: "bg-muted text-muted-foreground border-border" },
    validating: { label: "Analisi…",  cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    validated:  { label: "Validata",   cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    incubating: { label: "Con funding", cls: "bg-primary/10 text-primary border-primary/20" },
  };
  const m = map[status] || map.draft;
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", m.cls)}>
      {m.label}
    </span>
  );
}

export default function ValidatoreIdea() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [ideaText, setIdeaText] = useState("");
  const [sector, setSector] = useState("");
  const [workType, setWorkType] = useState<"autonomous" | "employed">("autonomous");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: ideas = [], isLoading } = useQuery<BusinessIdea[]>({
    queryKey: ["business-ideas"],
    queryFn: async () => {
      const r = await apiFetch(`${BASE}api/business-ideas`);
      return r.json();
    },
    enabled: !!user,
    refetchInterval: (query) => {
      const data = query.state.data as BusinessIdea[] | undefined;
      const hasValidating = data?.some((i) => i.status === "validating");
      return hasValidating ? 3000 : false;
    },
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      const r = await apiFetch(`${BASE}api/business-ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaText, sector: sector || undefined, workType }),
      });
      if (!r.ok) throw new Error("Errore");
      return r.json() as Promise<BusinessIdea>;
    },
    onSuccess: (newIdea) => {
      queryClient.invalidateQueries({ queryKey: ["business-ideas"] });
      setSelectedId(newIdea.id);
      setIdeaText("");
      setSector("");
      setShowForm(false);
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <Compass className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="font-bold text-xl text-foreground mb-2">Accesso richiesto</h2>
          <p className="text-muted-foreground mb-6">Accedi per usare il Validatore di Idee Business.</p>
          <Button onClick={() => setLocation("/")} className="rounded-full">Vai alla home</Button>
        </div>
      </div>
    );
  }

  const selected = ideas.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="container mx-auto px-4 md:px-6 py-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide mb-4">
              <Compass className="h-4 w-4" />
              Business Idea Validator
            </div>
            <h1 className="font-bold text-4xl text-foreground mb-3">Valida la tua idea</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              L'intelligenza artificiale analizza la tua idea, la struttura, la critica e la migliora — poi cerca incubatori e finanziamenti reali in Italia e in Europa.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar: lista idee */}
          <div className="lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">Le tue idee</h3>
              <button
                onClick={() => { setShowForm(true); setSelectedId(null); }}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-semibold transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Nuova idea
              </button>
            </div>

            {isLoading && (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 bg-card rounded-xl border border-border animate-pulse" />
                ))}
              </div>
            )}

            {!isLoading && ideas.length === 0 && !showForm && (
              <div className="text-center py-8 bg-card rounded-xl border border-border">
                <Lightbulb className="h-8 w-8 text-primary/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">Nessuna idea ancora.</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="text-xs text-primary hover:underline font-semibold"
                >
                  Crea la prima
                </button>
              </div>
            )}

            <div className="space-y-2">
              {ideas.map((idea) => (
                <button
                  key={idea.id}
                  onClick={() => { setSelectedId(idea.id); setShowForm(false); }}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border transition-all",
                    selectedId === idea.id
                      ? "bg-primary/10 border-primary/40"
                      : "bg-card border-border hover:border-primary/30"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-sm text-foreground line-clamp-1">{idea.title}</span>
                    <StatusBadge status={idea.status} />
                  </div>
                  {idea.validationScore != null && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 text-primary" />
                      {idea.validationScore.toFixed(1)}/10
                    </div>
                  )}
                  {idea.status === "validating" && (
                    <div className="flex items-center gap-1 text-xs text-amber-400 mt-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Analisi in corso…
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-2">
            {/* New idea form */}
            {(showForm || (ideas.length === 0 && !selectedId)) && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="font-bold text-foreground mb-1">Descrivi la tua idea</h3>
                <p className="text-sm text-muted-foreground mb-5">
                  Scrivi liberamente — l'intelligenza artificiale la struttura, valida e migliora. Più dettagli dai, migliore sarà l'analisi.
                </p>

                <div className="space-y-4">
                  <Textarea
                    placeholder="Es: Un'app che collega artigiani locali con persone che cercano riparazioni domestiche in tempi brevi, con pagamento integrato e recensioni verificate…"
                    value={ideaText}
                    onChange={(e) => setIdeaText(e.target.value)}
                    className="min-h-[140px] bg-background resize-none"
                    maxLength={2000}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                        Settore (opzionale)
                      </label>
                      <select
                        value={sector}
                        onChange={(e) => setSector(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                      >
                        <option value="">Seleziona settore…</option>
                        {SECTORS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                        Tipo di progetto
                      </label>
                      <div className="flex gap-2">
                        {[
                          { v: "autonomous" as const, label: "Autonomo / Startup" },
                          { v: "employed" as const, label: "Dipendente / Corporate" },
                        ].map((opt) => (
                          <button
                            key={opt.v}
                            onClick={() => setWorkType(opt.v)}
                            className={cn(
                              "flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-all",
                              workType === opt.v
                                ? "bg-primary/10 border-primary/40 text-primary"
                                : "bg-background border-border text-muted-foreground hover:border-primary/30"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => submitMut.mutate()}
                      disabled={!ideaText.trim() || submitMut.isPending}
                      className="rounded-full gap-2"
                    >
                      {submitMut.isPending
                        ? <><Loader2 className="h-4 w-4 animate-spin" />Invio…</>
                        : <><Sparkles className="h-4 w-4" />Analizza</>
                      }
                    </Button>
                    {ideas.length > 0 && (
                      <Button
                        variant="ghost"
                        onClick={() => { setShowForm(false); setSelectedId(ideas[0].id); }}
                        className="rounded-full text-muted-foreground"
                      >
                        Annulla
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Selected idea detail */}
            {!showForm && selected && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <IdeaDetail
                  idea={selected}
                  onDelete={() => {
                    setSelectedId(null);
                    setShowForm(ideas.length <= 1);
                  }}
                />
              </div>
            )}

            {/* Empty state when no form and no selection */}
            {!showForm && !selected && ideas.length > 0 && (
              <div className="flex items-center justify-center h-64 bg-card border border-border rounded-2xl">
                <div className="text-center">
                  <CheckCircle2 className="h-10 w-10 text-primary/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">Seleziona un'idea dalla lista</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
