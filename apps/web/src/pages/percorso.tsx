import { useAuth } from "@/contexts/AuthContext";
import { useWendy } from "@/contexts/WendyProvider";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-fetch";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Compass,
  HelpCircle,
  Rocket,
  Star,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

type JourneyType = "indeciso" | "dipendente" | "autonomo" | "azienda" | "investitore";

interface Persona {
  id: JourneyType;
  icon: React.ElementType;
  label: string;
  tagline: string;
  description: string;
  tools: string[];
  color: string;
  accent: string;
  border: string;
}

const PERSONAS: Persona[] = [
  {
    id: "indeciso",
    icon: HelpCircle,
    label: "Indeciso",
    tagline: "Non so ancora cosa fare",
    description:
      "Stai cercando la tua strada. Hai curiosità, idee confuse o semplicemente vuoi capire cosa ti appassiona davvero e dove potresti eccellere.",
    tools: ["Test di personalità", "Scegli settore e ruolo", "Coach AI", "Confronta carriere"],
    color: "from-[hsl(43 20% 9%)] to-[hsl(43 15% 13%)]",
    accent: "text-primary",
    border: "border-primary/40",
  },
  {
    id: "dipendente",
    icon: TrendingUp,
    label: "Dipendente che vuole crescere",
    tagline: "Ho un lavoro e voglio avanzare",
    description:
      "Sei impiegato e vuoi fare carriera, cambiare ruolo o passare a un settore migliore. Hai bisogno di strumenti concreti per crescere.",
    tools: ["Analisi competenze", "Simulatore colloquio", "Roadmap di carriera", "Candidature"],
    color: "from-growth/5 to-growth/10",
    accent: "text-growth",
    border: "border-growth/40",
  },
  {
    id: "autonomo",
    icon: Rocket,
    label: "Autonomo che vuole scalare",
    tagline: "Lavoro in proprio e voglio crescere",
    description:
      "Sei freelance, imprenditore o professionista autonomo. Vuoi scalare il tuo business, trovare nuovi clienti o validare un'idea.",
    tools: ["Idea", "Analisi mercato", "Roadmap business", "Coach AI"],
    color: "from-[hsl(43 20% 9%)] to-[hsl(43 18% 11%)]",
    accent: "text-primary",
    border: "border-primary/40",
  },
  {
    id: "azienda",
    icon: Building2,
    label: "Azienda in cerca di talenti",
    tagline: "Cerco professionisti qualificati",
    description:
      "Sei HR, recruiter o manager. Stai cercando i profili giusti per il tuo team e vuoi capire il mercato dei talenti italiano.",
    tools: ["Profili RIASEC", "Aree in crescita", "Analisi competenze", "Partner"],
    color: "from-growth/5 to-[hsl(43 20% 9%)]",
    accent: "text-growth",
    border: "border-growth/40",
  },
  {
    id: "investitore",
    icon: BarChart3,
    label: "Investitore",
    tagline: "Valuto opportunità di mercato",
    description:
      "Sei un investitore,           investitore o fondo. Vuoi capire i settori in crescita, i trend del mercato del lavoro italiano e le opportunità.",
    tools: ["Aree in crescita", "Analisi trend", "Report mercato", "Mappa conoscenze"],
    color: "from-[hsl(43 18% 11%)] to-[hsl(43 15% 13%)]",
    accent: "text-primary",
    border: "border-primary/40",
  },
];

const JOURNEY_DESTINATION: Record<JourneyType, string> = {
  indeciso: "/bussola",
  dipendente: "/dashboard",
  autonomo: "#wendy",
  azienda: "/settori",
  investitore: "/settori",
};

interface JourneySaveResponse {
  success: boolean;
  journeyType: JourneyType;
  journeyDecidedAt: string | null;
  journeyDecisionSource: string | null;
}

function isJourneyType(value: unknown): value is JourneyType {
  return (
    value === "indeciso" ||
    value === "dipendente" ||
    value === "autonomo" ||
    value === "azienda" ||
    value === "investitore"
  );
}

function getConfirmCopy(
  selected: JourneyType,
  saving: boolean,
  isCurrentConfirmedSelection: boolean,
) {
  if (saving) return "Salvataggio...";
  if (selected === "indeciso") return "Continua la mappa";
  if (isCurrentConfirmedSelection && selected === "dipendente") return "Continua in dashboard";
  if (isCurrentConfirmedSelection && selected === "autonomo") return "Apri Wendy";
  if (isCurrentConfirmedSelection) return "Vai ai settori";
  return "Inizia il tuo percorso";
}

async function readJourneySaveError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown; message?: unknown };
    const message =
      typeof body.error === "string"
        ? body.error
        : typeof body.message === "string"
          ? body.message
          : null;
    if (message) return message;
  } catch {
    // Ignore malformed error payloads and fall back to the status-aware copy.
  }

  if (response.status === 401) {
    return "Sessione scaduta. Accedi di nuovo prima di salvare il percorso.";
  }
  if (response.status === 400) {
    return "Scelta non valida. Seleziona di nuovo il profilo e riprova.";
  }
  return "Non sono riuscito a salvare il percorso. Riprova tra poco.";
}

export default function Percorso() {
  const { user, login, token } = useAuth();
  const [, setLocation] = useLocation();
  const wendy = useWendy();
  const userJourneyType = isJourneyType(user?.journeyType) ? user.journeyType : null;
  const [selected, setSelected] = useState<JourneyType | null>(
    userJourneyType
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!selected) return;

    if (isCurrentConfirmedSelection) {
      const dest = JOURNEY_DESTINATION[selected];
      if (dest === "#wendy") {
        wendy.open();
      } else {
        setLocation(dest);
      }
      return;
    }

    if (user && token) {
      setSaving(true);
      setSaveError(null);
      try {
        const response = await apiFetch(`${BASE}api/journey-type/me/journey-type`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ journeyType: selected }),
        });
        if (!response.ok) {
          throw new Error(await readJourneySaveError(response));
        }
        const saved = (await response.json()) as JourneySaveResponse;
        login({
          ...user,
          journeyType: saved.journeyType,
          journeyDecidedAt: saved.journeyDecidedAt,
          journeyDecisionSource: saved.journeyDecisionSource,
        }, token);
        toast({ title: "Piano salvato!", description: `Hai scelto: ${PERSONAS.find((p) => p.id === selected)?.label}` });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Non sono riuscito a salvare il percorso. Riprova tra poco.";
        setSaveError(message);
        toast({ title: "Salvataggio non riuscito", description: message, variant: "destructive" });
        return;
      } finally {
        setSaving(false);
      }
    }

    const dest = JOURNEY_DESTINATION[selected];
    if (dest === "#wendy") {
      wendy.open();
    } else {
      setLocation(dest);
    }
  }

  const selectedPersona = PERSONAS.find((p) => p.id === selected);
  const currentPersona = PERSONAS.find((p) => p.id === userJourneyType);
  const hasConfirmedJourney =
    Boolean(user?.journeyDecidedAt) && userJourneyType !== null && userJourneyType !== "indeciso";
  const hasSelectedJourney = userJourneyType !== null && userJourneyType !== "indeciso";
  const statusTitle = hasConfirmedJourney
    ? "Percorso confermato"
    : hasSelectedJourney
      ? "Percorso selezionato"
      : "Ancora in esplorazione";
  const statusCopy = hasConfirmedJourney
    ? `${currentPersona?.label ?? "Il tuo percorso"} e' attivo nel tuo pannello attivita. Il prossimo passo resta sempre in alto.`
    : hasSelectedJourney
      ? `${currentPersona?.label ?? "Il tuo percorso"} e' pronto: confermalo per salvare lo stato decisionale.`
      : "Puoi restare indeciso e usare la mappa di chiarezza: NorthStar ti terra' nel flusso reale, senza schermate morte.";
  const statusNextAction = hasSelectedJourney
    ? "Prossimo passo: pannello attivita"
    : "Prossimo passo: test di chiarezza";
  const isCurrentConfirmedSelection = hasConfirmedJourney && selected === userJourneyType;
  const confirmCopy = selected
    ? getConfirmCopy(selected, saving, isCurrentConfirmedSelection)
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="hero-navy py-10 md:py-16 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-3.5 py-1.5 mb-4 text-xs font-semibold text-primary">
            <Star className="w-3 h-3" />
            Il tuo percorso personale
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 leading-tight">
            Chi sei e cosa
            <span className="text-italic-serif text-primary"> vuoi raggiungere?</span>
          </h1>
          <p className="text-sm sm:text-base text-white/65 max-w-xl mx-auto">
            Seleziona il profilo che ti rappresenta di più. NorthStar personalizzerà gli strumenti
            e i consigli in base al tuo percorso.
          </p>
        </motion.div>
      </div>

      {/* Persona grid */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <section
          aria-label="Stato del percorso"
          className="mb-8 grid gap-4 rounded-xl border border-border bg-card p-4 shadow-sm md:grid-cols-[1fr_auto] md:items-center md:p-5"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {hasConfirmedJourney ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Compass className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {statusTitle}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {statusCopy}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground">
            {statusNextAction}
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PERSONAS.map((persona, i) => {
            const Icon = persona.icon;
            const isSelected = selected === persona.id;

            return (
              <motion.button
                key={persona.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
                onClick={() => {
                  setSelected(persona.id);
                  setSaveError(null);
                }}
                className={`text-left p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer group relative overflow-hidden ${
                  isSelected
                    ? `${persona.border} bg-gradient-to-br ${persona.color} shadow-lg shadow-black/30`
                    : "border-border bg-card hover:border-primary/30 hover:bg-card/80"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  </div>
                )}

                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${
                    isSelected
                      ? "bg-white/15"
                      : "bg-primary/10 group-hover:bg-primary/15"
                  } transition-colors`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      isSelected ? persona.accent : "text-primary"
                    } transition-colors`}
                  />
                </div>

                <h3
                  className={`font-bold text-base mb-1 ${
                    isSelected ? "text-white" : "text-foreground"
                  }`}
                >
                  {persona.label}
                </h3>
                <p
                  className={`text-xs font-semibold mb-3 ${
                    isSelected ? persona.accent : "text-primary"
                  }`}
                >
                  {persona.tagline}
                </p>
                <p
                  className={`text-sm leading-relaxed mb-4 ${
                    isSelected ? "text-white/80" : "text-muted-foreground"
                  }`}
                >
                  {persona.description}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {persona.tools.map((tool) => (
                    <span
                      key={tool}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isSelected
                          ? "bg-white/15 text-white/90"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Confirm CTA */}
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-10 flex flex-col items-center gap-3"
          >
            <p className="text-muted-foreground text-sm text-center max-w-sm">
              Hai scelto:{" "}
              <span className="font-semibold text-foreground">
                {selectedPersona?.label}
              </span>
              . Puoi cambiarlo in qualsiasi momento dal tuo profilo.
            </p>
            {saveError && (
              <div
                role="alert"
                aria-live="polite"
                className="max-w-sm rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive text-center"
              >
                {saveError}
              </div>
            )}
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex items-center gap-2 bg-primary text-primary-foreground font-bold px-8 py-3 rounded-full text-sm hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/25 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {confirmCopy}
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
