/**
 * DashboardCareerComparison
 *
 * Side-by-side comparison of two top-recommended sectors.
 * Uses data already available from recommendations — no extra fetch required.
 */
import { cn } from "@/lib/utils";
import { ArrowRight, Scale, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { Link } from "wouter";
import type { AdaptiveSectionPresentation } from "./dashboard-adaptive-flow";

export interface ComparisonSector {
  sectorId: number;
  sectorName: string;
  matchScore: number;
  // Optional enriched fields from sector detail (if available)
  avgSalaryMin?: number;
  avgSalaryMax?: number;
  growthRate?: number;
  automationRisk?: "low" | "medium" | "high";
  trend?: "declining" | "stable" | "growing" | "booming";
  autonomyScore?: number;
  stabilityScore?: number;
}

function formatSalary(min?: number, max?: number): string {
  if (!min && !max) return "N/D";
  if (min && max) return `€${(min / 1000).toFixed(0)}k – €${(max / 1000).toFixed(0)}k`;
  if (max) return `fino a €${(max / 1000).toFixed(0)}k`;
  return `da €${(min! / 1000).toFixed(0)}k`;
}

function RiskChip({ risk }: { risk: "low" | "medium" | "high" | undefined }) {
  if (!risk) return <span className="text-xs text-muted-foreground">N/D</span>;
  const config = {
    low:    { label: "Basso",  cls: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    medium: { label: "Medio",  cls: "text-amber-600 bg-amber-50 border-amber-200" },
    high:   { label: "Alto",   cls: "text-red-600 bg-red-50 border-red-200" },
  };
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", config[risk].cls)}>
      {config[risk].label}
    </span>
  );
}

function TrendIcon({ trend }: { trend: string | undefined }) {
  if (trend === "booming" || trend === "growing") return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === "declining") return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Zap className="h-3.5 w-3.5 text-amber-400" />;
}

function ScoreBar({ value, max = 10 }: { value: number | undefined; max?: number }) {
  if (!value) return <span className="text-xs text-muted-foreground">N/D</span>;
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums text-foreground">{value}/10</span>
    </div>
  );
}

interface MetricRowProps {
  label: string;
  left: React.ReactNode;
  right: React.ReactNode;
}

function MetricRow({ label, left, right }: MetricRowProps) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2 border-b border-border/50 last:border-0">
      <div className="flex justify-end">{left}</div>
      <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 w-20 shrink-0">
        {label}
      </span>
      <div>{right}</div>
    </div>
  );
}

export function DashboardCareerComparison({
  sectorA,
  sectorB,
  presentation,
}: {
  sectorA: ComparisonSector | null;
  sectorB: ComparisonSector | null;
  presentation?: AdaptiveSectionPresentation | undefined;
}) {
  if (presentation?.gated) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-center">
        <Scale className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
        <p className="text-sm font-semibold text-foreground">Confronto carriere bloccato</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          Salva almeno 3 aree dalla discovery per confrontare opzioni con abbastanza segnali.
        </p>
        <Link href="/settori" className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">
          Esplora aree e ruoli -&gt;
        </Link>
      </div>
    );
  }

  // No data state
  if (!sectorA && !sectorB) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center">
        <Scale className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">
          Completa il test per confrontare i settori più adatti a te
        </p>
        <Link
          href="/test"
          className="mt-3 inline-block rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Inizia il test →
        </Link>
      </div>
    );
  }

  // Only one sector
  if (!sectorB) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-center">
        <Scale className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">
          Hai una sola area consigliata. Esplora altre aree e ruoli per confrontare.
        </p>
        <Link href="/settori" className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">
          Esplora aree e ruoli →
        </Link>
      </div>
    );
  }

  if (presentation?.priority === "compact") {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Scale className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Confronto rapido
            </p>
            <p className="text-xs text-muted-foreground/70">Riepilogo delle due opzioni principali</p>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-center">
            <p className="text-xs font-bold text-primary leading-tight line-clamp-2">{sectorA!.sectorName}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-primary/70">
              {Math.round(sectorA!.matchScore)}% affinita
            </p>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted/30">
            <span className="text-[10px] font-black text-muted-foreground">VS</span>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-center">
            <p className="text-xs font-bold text-foreground leading-tight line-clamp-2">{sectorB.sectorName}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
              {Math.round(sectorB.matchScore)}% affinita
            </p>
          </div>
        </div>

        <Link
          href="/settori"
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Riapri confronto <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div
      aria-label={`Confronto carriere${presentation?.priority === "primary" ? " azione principale" : ""}`}
      className={cn(
        "rounded-2xl border bg-card p-5 shadow-sm",
        presentation?.priority === "primary" ? "border-primary/35 bg-primary/5 shadow-primary/10" : "border-border",
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
          <Scale className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Confronto carriere
          </p>
          <p className="text-xs text-muted-foreground/70">I tuoi 2 settori più compatibili a confronto</p>
        </div>
      </div>

      {/* Column headers */}
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-center">
          <p className="text-xs font-bold text-primary leading-tight line-clamp-2">{sectorA!.sectorName}</p>
          <p className="mt-0.5 text-[11px] text-primary/70 font-semibold">
            {Math.round(sectorA!.matchScore)}% affinita
          </p>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted/30">
          <span className="text-[10px] font-black text-muted-foreground">VS</span>
        </div>
        <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-center">
          <p className="text-xs font-bold text-foreground leading-tight line-clamp-2">{sectorB.sectorName}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground font-semibold">
            {Math.round(sectorB.matchScore)}% affinita
          </p>
        </div>
      </div>

      {/* Metric rows */}
      <div className="rounded-xl border border-border/50 bg-muted/10 px-3 py-1">
        <MetricRow
          label="Stipendio"
          left={<span className="text-xs font-semibold text-foreground">{formatSalary(sectorA?.avgSalaryMin, sectorA?.avgSalaryMax)}</span>}
          right={<span className="text-xs font-semibold text-foreground">{formatSalary(sectorB?.avgSalaryMin, sectorB?.avgSalaryMax)}</span>}
        />
        <MetricRow
          label="Trend"
          left={
            <div className="flex items-center gap-1">
              <TrendIcon trend={sectorA?.trend} />
              <span className="text-xs capitalize text-foreground">{sectorA?.trend ?? "N/D"}</span>
            </div>
          }
          right={
            <div className="flex items-center gap-1">
              <TrendIcon trend={sectorB?.trend} />
              <span className="text-xs capitalize text-foreground">{sectorB?.trend ?? "N/D"}</span>
            </div>
          }
        />
        <MetricRow
          label="Automazione"
          left={<RiskChip risk={sectorA?.automationRisk} />}
          right={<RiskChip risk={sectorB?.automationRisk} />}
        />
        <MetricRow
          label="Autonomia"
          left={<ScoreBar value={sectorA?.autonomyScore} />}
          right={<ScoreBar value={sectorB?.autonomyScore} />}
        />
        <MetricRow
          label="Stabilità"
          left={<ScoreBar value={sectorA?.stabilityScore} />}
          right={<ScoreBar value={sectorB?.stabilityScore} />}
        />
      </div>

      <div className="mt-3 flex items-center justify-end">
        <Link
          href="/settori"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Esplora tutti i settori <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
