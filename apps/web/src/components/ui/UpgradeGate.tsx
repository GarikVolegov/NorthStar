/**
 * UpgradeGate — wrapper per feature protette da piano.
 *
 * Se l'utente ha accesso: renderizza `children`.
 * Altrimenti: mostra `UpgradePromptCard` contestuale al piano richiesto.
 *
 * Uso:
 *   <UpgradeGate feature="wendy_focus_mode" plan="pro">
 *     <WendyFocusButton />
 *   </UpgradeGate>
 */
import { Button } from "@/components/ui/button";
import type { Plan } from "@/hooks/useSubscription";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";
import { Crown, Lock, Zap } from "lucide-react";
import { Link } from "wouter";

const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  pro:  "Pro",
  team: "Team",
};

const PLAN_COLORS: Record<Plan, { bg: string; border: string; icon: string; badge: string }> = {
  free: { bg: "bg-muted/30", border: "border-border", icon: "text-muted-foreground", badge: "" },
  pro:  { bg: "bg-primary/5", border: "border-primary/30", icon: "text-primary", badge: "bg-primary/10 text-primary border-primary/30" },
  team: { bg: "bg-amber-500/5", border: "border-amber-500/30", icon: "text-amber-500", badge: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
};

interface UpgradePromptProps {
  feature:      string;
  requiredPlan: Plan;
  compact?:     boolean;
  message?:     string;
}

export function UpgradePrompt({ feature, requiredPlan, compact = false, message }: UpgradePromptProps) {
  const colors = PLAN_COLORS[requiredPlan];
  const label  = PLAN_LABELS[requiredPlan];

  const defaultMessages: Record<string, string> = {
    wendy_focus_mode:    "La Modalità Focus è disponibile nel piano Pro — risposte approfondite e strutturate.",
    wendy_unlimited:     "Hai raggiunto il limite giornaliero. Passa a Pro per Wendy illimitata.",
    rag_search:          "Il knowledge base RAG con dati di mercato reali richiede il piano Pro.",
    weak_signals:        "I segnali deboli di professioni emergenti sono disponibili nel piano Pro.",
    workspace_shared:    "I workspace condivisi e il mentor/mentee mode sono nel piano Team.",
    file_upload:         "L'analisi di CV e documenti richiede il piano Pro.",
    unlimited_plans:     "Hai raggiunto il limite di piani di studio nel piano Free.",
  };

  const text = message ?? defaultMessages[feature] ?? `Questa funzione richiede il piano ${label}.`;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs", colors.bg, colors.border)}>
        <Lock className={cn("h-3.5 w-3.5 shrink-0", colors.icon)} />
        <span className="text-muted-foreground flex-1">{text}</span>
        <Link href="/premium">
          <span className={cn("px-2 py-0.5 rounded-full border text-xs font-semibold cursor-pointer", colors.badge)}>
            {label}
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border p-5 text-center space-y-3", colors.bg, colors.border)}>
      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mx-auto", colors.bg, `border ${colors.border}`)}>
        {requiredPlan === "team"
          ? <Crown className={cn("h-5 w-5", colors.icon)} />
          : <Zap  className={cn("h-5 w-5", colors.icon)} />
        }
      </div>
      <div>
        <p className="font-semibold text-sm text-foreground mb-1">{text}</p>
        <p className="text-xs text-muted-foreground">
          Sblocca questa e molte altre funzioni con il piano {label}.
        </p>
      </div>
      <Link href="/premium">
        <Button size="sm" className="rounded-full gap-2">
          {requiredPlan === "team" ? <Crown size={14} /> : <Zap size={14} />}
          Scopri il piano {label}
        </Button>
      </Link>
    </div>
  );
}

interface UpgradeGateProps {
  feature:      string;
  plan:         Plan;
  children:     React.ReactNode;
  compact?:     boolean;
  message?:     string;
  className?:   string;
}

export function UpgradeGate({ feature, plan, children, compact, message, className }: UpgradeGateProps) {
  const { canAccess, isLoading } = useSubscription();

  if (isLoading) return <div className={cn("animate-pulse rounded-lg bg-muted h-10", className)} />;
  if (canAccess(feature)) return <>{children}</>;

  return (
    <div className={className}>
      <UpgradePrompt
        feature={feature}
        requiredPlan={plan}
        {...(compact !== undefined ? { compact } : {})}
        {...(message !== undefined ? { message } : {})}
      />
    </div>
  );
}
