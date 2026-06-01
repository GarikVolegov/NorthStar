import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getJson } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Briefcase,
  Clock,
  ExternalLink,
  Filter,
  MapPin,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  type: string;
  sector: string;
  tags: string[];
  url: string;
  salary: string;
  matchScore: number;
  sourceLabel?: string;
  count?: number;
  period?: string;
  growthRate?: number | null;
  isAggregate?: boolean;
}

interface JobsResponse {
  jobs: Job[];
  basedOnSector: string | null;
  totalCount: number;
  status?: "ok" | "empty" | "not_configured";
  reason?: "jobs_provider_not_connected" | string;
  action?: "connect_jobs_provider" | string;
  personalized?: boolean;
  source?: "job_posting_snapshots" | string;
  period?: string | null;
}

function SignalBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-primary" : score >= 60 ? "bg-amber-400" : "bg-orange-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn("text-xs font-bold tabular-nums", score >= 80 ? "text-primary" : score >= 60 ? "text-amber-400" : "text-orange-400")}>
        {score}%
      </span>
    </div>
  );
}

function growthLabel(growthRate: number | null | undefined) {
  if (growthRate == null) return "Trend stabile";
  const percent = Math.round(growthRate * 100);
  if (percent > 0) return `+${percent}% vs periodo precedente`;
  if (percent < 0) return `${percent}% vs periodo precedente`;
  return "Trend stabile";
}

function JobCard({ job }: { job: Job }) {
  const signalCount = job.count ?? 0;

  return (
    <div className="group bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground group-hover:text-primary transition-colors leading-tight">
            {job.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {job.sector} - {job.sourceLabel ?? job.company}
          </p>
        </div>
        <div className="shrink-0">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-full border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-all block"
            title="Apri ricerca esterna"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{job.period ?? "Periodo recente"}</span>
        {signalCount > 0 && <span>{signalCount.toLocaleString("it-IT")} segnali aggregati</span>}
        {job.salary && <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{job.salary}</span>}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {job.tags.map((tag) => (
          <span key={tag} className="text-[11px] px-2 py-0.5 bg-white/5 border border-border rounded-full text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
            {job.isAggregate ? "Priorita mercato/profilo" : "Match con il tuo profilo"}
          </span>
          <span className="text-[11px] text-muted-foreground text-right">{growthLabel(job.growthRate)}</span>
        </div>
        <SignalBar score={job.matchScore} />
      </div>
    </div>
  );
}

export default function Lavori() {
  const { isLoggedIn, user } = useAuth();
  const [filterType, setFilterType] = useState<string>("all");

  const { data, isError, isLoading, refetch } = useQuery<JobsResponse>({
    queryKey: ["jobs", user?.id],
    queryFn: () => getJson<JobsResponse>(`${BASE}api/jobs`),
    enabled: isLoggedIn,
    staleTime: 60_000 * 10,
  });

  const jobsNotConfigured = data?.status === "not_configured";
  const rawJobs = data?.jobs ?? [];
  const jobs = rawJobs.filter((job) => {
    if (filterType === "growing") return (job.growthRate ?? 0) > 0;
    if (filterType === "high-volume") return (job.count ?? 0) >= 100;
    return true;
  });
  const canShowFilters = !!data && !jobsNotConfigured && rawJobs.length > 0;

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <Briefcase className="h-12 w-12 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Segnali mercato NorthStar</h1>
        <p className="text-muted-foreground max-w-md">
          Accedi per vedere i ruoli piu richiesti dal mercato, ordinati per compatibilita con il tuo profilo.
        </p>
        <Link href="/sign-in?redirect_url=/lavori">
          <Button className="rounded-full px-8">Accedi</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="bg-card border-b border-border">
        <div className="container mx-auto px-4 max-w-5xl py-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-5 w-5 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Segnali mercato</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-2">Domanda per ruolo</h1>
              <p className="text-muted-foreground text-sm">
                {data?.basedOnSector
                  ? <>Snapshot aggregati ordinati per il tuo settore: <span className="text-foreground font-medium">{data.basedOnSector}</span></>
                  : jobsNotConfigured
                    ? "Pipeline dati mercato non collegata"
                    : data?.period
                      ? `Snapshot job posting aggiornati al periodo ${data.period}`
                      : "Completa il test per vedere segnali personalizzati"
                }
              </p>
            </div>
            {data?.basedOnSector && (
              <div className="shrink-0 flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">Profilo applicato</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-5xl py-8">
        {canShowFilters && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              {[
                { key: "all", label: "Tutti" },
                { key: "growing", label: "In crescita" },
                { key: "high-volume", label: "Alta domanda" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilterType(key)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full border font-medium transition-all whitespace-nowrap",
                    filterType === key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{jobs.length} segnali</span>
          </div>
        )}

        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 bg-card border border-border rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-8 text-center" role="alert">
            <AlertCircle className="h-8 w-8 mx-auto mb-3 text-destructive" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Snapshot mercato non disponibili</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
              Non siamo riusciti a caricare i dati aggregati del mercato lavoro. Riprova tra poco.
            </p>
            <Button variant="outline" className="rounded-full" onClick={() => void refetch()}>
              Riprova
            </Button>
          </div>
        ) : jobsNotConfigured ? (
          <div className="rounded-2xl border border-warning-muted bg-warning-surface p-8 text-center text-warning">
            <AlertCircle className="h-8 w-8 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Snapshot mercato non ancora collegati</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              La pagina e pronta, ma la pipeline di job posting aggregati non e ancora collegata. Non mostriamo annunci fittizi finche il backend non avra dati reali.
            </p>
          </div>
        ) : rawJobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Briefcase className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Nessuno snapshot disponibile</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              La pipeline e collegata, ma non ci sono ancora dati aggregati per il periodo corrente.
            </p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Filter className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Nessun segnale con questi filtri</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Prova a tornare su "Tutti" per vedere gli snapshot disponibili.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {jobs.map((job) => <JobCard key={job.id} job={job} />)}
          </div>
        )}

        {!data?.basedOnSector && !isLoading && !jobsNotConfigured && (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm mb-4">
              Completa il test di orientamento per ordinare i segnali mercato sul tuo profilo
            </p>
            <Link href="/test">
              <Button variant="outline" className="rounded-full">Fai il test RIASEC</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
