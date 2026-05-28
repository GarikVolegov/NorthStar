import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Plan } from "@/hooks/useSubscription";
import { useSubscription } from "@/hooks/useSubscription";
import { usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { Check, Crown, LifeBuoy, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Link } from "wouter";

type PlanMeta = {
  label: string;
  eyebrow: string;
  description: string;
  icon: typeof Zap;
  color: string;
  bg: string;
  border: string;
  features: string[];
  action: {
    label: string;
    href: string;
    variant: "default" | "outline";
  };
};

const PLAN_META: Record<Plan, PlanMeta> = {
  free: {
    label: "Free",
    eyebrow: "Piano base",
    description: "Hai accesso agli strumenti essenziali per iniziare il percorso NorthStar.",
    icon: ShieldCheck,
    color: "text-muted-foreground",
    bg: "bg-muted/35",
    border: "border-border",
    features: [
      "10 messaggi Wendy al giorno",
      "1 piano di studio attivo",
      "Catalogo settori e ruoli base",
      "Prime idee di business",
    ],
    action: {
      label: "Passa a Pro",
      href: "/premium",
      variant: "default",
    },
  },
  pro: {
    label: "Pro",
    eyebrow: "Piano attivo",
    description: "Il tuo account include strumenti avanzati per analisi, ricerca e crescita.",
    icon: Zap,
    color: "text-primary",
    bg: "bg-primary/5",
    border: "border-primary/30",
    features: [
      "Wendy illimitata e memoria lunga",
      "Modalita Focus per research",
      "RAG job market e segnali deboli",
      "Piani di studio illimitati",
      "Briefing settimanale",
      "Upload e analisi file",
    ],
    action: {
      label: "Scopri Team",
      href: "/premium",
      variant: "outline",
    },
  },
  team: {
    label: "Team",
    eyebrow: "Piano team",
    description: "Il tuo workspace e' pronto per collaborazione, mentor e dashboard condivise.",
    icon: Crown,
    color: "text-primary",
    bg: "bg-primary/5",
    border: "border-primary/30",
    features: [
      "Tutto il piano Pro",
      "Workspace condivisi",
      "Mentor e mentee mode",
      "Dashboard team aggregata",
      "Briefing giornaliero",
      "Supporto dedicato",
    ],
    action: {
      label: "Contatta supporto",
      href: "/contatti",
      variant: "outline",
    },
  },
};

function formatRenewalDate(validUntil: string | null | undefined): string | null {
  if (!validUntil) return null;
  const date = new Date(validUntil);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
}

export default function Abbonamento() {
  const { plan, validUntil, isLoading } = useSubscription();
  const meta = PLAN_META[plan];
  const Icon = meta.icon;
  const renewalDate = formatRenewalDate(validUntil);

  usePageMeta({
    title: "Abbonamento | NorthStar",
    description: "Gestisci il tuo piano NorthStar e consulta i vantaggi inclusi nel tuo abbonamento.",
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 md:py-12" data-testid="subscription-management-loading">
        <Skeleton className="mb-3 h-8 w-64" />
        <Skeleton className="mb-8 h-5 w-full max-w-lg" />
        <Skeleton className="h-72 rounded-2xl" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <div className="mb-8 max-w-2xl">
        <Badge variant="outline" className="mb-4 border-primary/25 bg-primary/5 text-primary">
          Abbonamento
        </Badge>
        <h1 className="text-3xl font-bold tracking-normal text-foreground md:text-4xl">
          Gestione abbonamento
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          Controlla il piano attivo, i vantaggi inclusi e le prossime opzioni disponibili per il tuo account.
        </p>
      </div>

      <section className={cn("rounded-2xl border p-5 md:p-6", meta.bg, meta.border)}>
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-background/60", meta.border)}>
              <Icon className={cn("h-5 w-5", meta.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-muted-foreground">{meta.eyebrow}</p>
              <h2 className="mt-1 text-xl font-bold text-foreground">Piano {meta.label}</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{meta.description}</p>
              {renewalDate && (
                <p className="mt-3 inline-flex rounded-full border border-border/70 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                  Rinnovo previsto il {renewalDate}
                </p>
              )}
            </div>
          </div>

          <Button asChild variant={meta.action.variant} className="min-h-10 shrink-0 rounded-full">
            <Link href={meta.action.href}>{meta.action.label}</Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {meta.features.map((feature) => (
            <div key={feature} className="flex min-h-12 items-center gap-3 rounded-lg border border-border/70 bg-background/55 px-3 py-2">
              <Check className={cn("h-4 w-4 shrink-0", meta.color)} />
              <span className="text-sm text-foreground">{feature}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Hai bisogno di modifiche alla fatturazione?</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                La gestione completa di pagamento e cancellazione sara collegata al portale Stripe quando disponibile.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="min-h-10 shrink-0 rounded-full">
            <Link href="/contatti">
              <LifeBuoy className="h-4 w-4" /> Supporto
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
