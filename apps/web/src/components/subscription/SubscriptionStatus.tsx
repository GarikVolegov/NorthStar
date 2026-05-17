/**
 * SubscriptionStatus — mostra piano corrente e CTA upgrade.
 *
 * Varianti:
 *   compact  → chip inline (per navbar / header)
 *   card     → card con dettagli e pulsante (per profilo / impostazioni)
 *   banner   → banner orizzontale leggero per reminder upgrade
 */
import { Link } from "wouter";
import { Crown, Zap, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";
import type { Plan } from "@/hooks/useSubscription";

// ── Plan metadata ─────────────────────────────────────────────────────────────

const PLAN_META: Record<Plan, {
  label:   string;
  icon:    typeof Zap;
  color:   string;
  bg:      string;
  border:  string;
  features: string[];
}> = {
  free: {
    label:    "Free",
    icon:     Check,
    color:    "text-muted-foreground",
    bg:       "bg-muted/30",
    border:   "border-border",
    features: [
      "10 messaggi Wendy al giorno",
      "1 piano di studio attivo",
      "Catalogo settori/ruoli (base)",
      "3 idee di business",
    ],
  },
  pro: {
    label:    "Pro",
    icon:     Zap,
    color:    "text-primary",
    bg:       "bg-primary/5",
    border:   "border-primary/30",
    features: [
      "Wendy illimitata + memoria lunga",
      "Modalità Focus per research",
      "RAG job market + segnali deboli",
      "Piani di studio illimitati",
      "Briefing settimanale",
      "Upload e analisi file",
    ],
  },
  team: {
    label:    "Team",
    icon:     Crown,
    color:    "text-amber-500",
    bg:       "bg-amber-500/5",
    border:   "border-amber-500/30",
    features: [
      "Tutto di Pro per il team",
      "Workspace condivisi",
      "Mentor/mentee mode",
      "Dashboard team aggregata",
      "Briefing giornaliero",
      "Supporto dedicato",
    ],
  },
};

// ── Compact chip ──────────────────────────────────────────────────────────────

export function SubscriptionChip({ className }: { className?: string }) {
  const { plan, isLoading } = useSubscription();
  if (isLoading) return null;

  const meta  = PLAN_META[plan];
  const Icon  = meta.icon;

  return (
    <Link href="/premium">
      <span className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border cursor-pointer transition-all hover:opacity-80",
        meta.bg, meta.border, meta.color, className,
      )}>
        <Icon className="h-3 w-3" />
        {meta.label}
      </span>
    </Link>
  );
}

// ── Status card ───────────────────────────────────────────────────────────────

interface SubscriptionStatusCardProps {
  className?: string;
}

export function SubscriptionStatusCard({ className }: SubscriptionStatusCardProps) {
  const { plan, isPro, isTeam, validUntil, isLoading } = useSubscription();
  if (isLoading) return <div className="h-32 rounded-xl bg-muted/30 animate-pulse" />;

  const meta = PLAN_META[plan];
  const Icon = meta.icon;

  const expiryText = validUntil
    ? `Rinnova il ${new Date(validUntil).toLocaleDateString("it-IT", { day: "numeric", month: "long" })}`
    : null;

  return (
    <div className={cn("rounded-xl border p-5 space-y-4", meta.bg, meta.border, className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", meta.bg, `border ${meta.border}`)}>
            <Icon className={cn("h-4 w-4", meta.color)} />
          </div>
          <div>
            <p className="font-bold text-sm text-foreground">Piano {meta.label}</p>
            {expiryText && <p className="text-xs text-muted-foreground">{expiryText}</p>}
          </div>
        </div>
        {plan === "free" && (
          <Link href="/premium">
            <Button size="sm" className="rounded-full gap-1.5 text-xs">
              <Zap className="h-3.5 w-3.5" /> Passa a Pro
            </Button>
          </Link>
        )}
        {plan === "pro" && (
          <Link href="/premium">
            <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
              Team <ChevronRight className="h-3 w-3" />
            </span>
          </Link>
        )}
      </div>

      {/* Features list */}
      <ul className="space-y-1.5">
        {meta.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
            <Check className={cn("h-3.5 w-3.5 shrink-0", meta.color)} />
            {f}
          </li>
        ))}
      </ul>

      {/* Upgrade prompt per Free */}
      {plan === "free" && (
        <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
          Con <strong className="text-primary">Pro</strong> sblocchi Wendy illimitata, RAG job market, segnali deboli e molto altro.{" "}
          <Link href="/premium" className="text-primary hover:underline font-semibold">Scopri tutti i vantaggi →</Link>
        </div>
      )}
    </div>
  );
}

// ── Upgrade banner ────────────────────────────────────────────────────────────

interface UpgradeBannerProps {
  message: string;
  className?: string;
}

export function UpgradeBanner({ message, className }: UpgradeBannerProps) {
  const { plan } = useSubscription();
  if (plan !== "free") return null;

  return (
    <div className={cn(
      "flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3",
      className,
    )}>
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary shrink-0" />
        <p className="text-sm text-foreground">{message}</p>
      </div>
      <Link href="/premium">
        <Button size="sm" variant="outline" className="rounded-full text-xs shrink-0 border-primary/30 text-primary hover:bg-primary/10">
          Upgrade
        </Button>
      </Link>
    </div>
  );
}
