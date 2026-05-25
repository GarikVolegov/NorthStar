import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getJson } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Clock, ExternalLink, Filter, MapPin, Sparkles, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

interface Job {
  id: number; title: string; company: string; location: string;
  type: string; sector: string; tags: string[]; url: string;
  salary: string; matchScore: number;
}

interface JobsResponse {
  jobs: Job[]; basedOnSector: string | null; totalCount: number;
}

function MatchBar({ score }: { score: number }) {
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

function JobCard({ job }: { job: Job }) {
  const typeLabel: Record<string, string> = { "full-time": "Tempo pieno", "part-time": "Part-time", freelance: "Freelance" };

  return (
    <div className="group bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground group-hover:text-primary transition-colors leading-tight">
            {job.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">{job.company}</p>
        </div>
        <div className="shrink-0">
          <a href={job.url} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-full border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-all block">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{typeLabel[job.type] ?? job.type}</span>
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
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Match con il tuo profilo</span>
        </div>
        <MatchBar score={job.matchScore} />
      </div>
    </div>
  );
}

export default function Lavori() {
  const { isLoggedIn, user } = useAuth();
  const [filterType, setFilterType] = useState<string>("all");

  const { data, isLoading } = useQuery<JobsResponse>({
    queryKey: ["jobs", user?.id],
    queryFn: () => getJson<JobsResponse>(`${BASE}api/jobs`),
    enabled: isLoggedIn,
    staleTime: 60_000 * 10,
  });

  const jobs = (data?.jobs ?? []).filter((j) => filterType === "all" || j.type === filterType);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <Briefcase className="h-12 w-12 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Job Board NorthStar</h1>
        <p className="text-muted-foreground max-w-md">
          Accedi per vedere le offerte di lavoro ordinate per compatibilità con il tuo profilo.
        </p>
        <Link href="/">
          <Button className="rounded-full px-8">Accedi</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Hero */}
      <div className="bg-card border-b border-border">
        <div className="container mx-auto px-4 max-w-5xl py-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-5 w-5 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Job Board</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-2">Opportunità per te</h1>
              <p className="text-muted-foreground text-sm">
                {data?.basedOnSector
                  ? <>Ordinate per match con il tuo settore: <span className="text-foreground font-medium">{data.basedOnSector}</span></>
                  : "Completa il test per vedere offerte personalizzate"
                }
              </p>
            </div>
            {data?.basedOnSector && (
              <div className="shrink-0 flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">Compatibilità AI</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-5xl py-8">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            {[
              { key: "all", label: "Tutti" },
              { key: "full-time", label: "Tempo pieno" },
              { key: "freelance", label: "Freelance" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterType(key)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border font-medium transition-all whitespace-nowrap",
                  filterType === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{jobs.length} offerte</span>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 bg-card border border-border rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {jobs.map((job) => <JobCard key={job.id} job={job} />)}
          </div>
        )}

        {!data?.basedOnSector && !isLoading && (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm mb-4">
              Completa il test di orientamento per ricevere proposte personalizzate
            </p>
            <Link href="/test">
              <Button variant="outline" className="rounded-full">Fai il test RIASEC →</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
