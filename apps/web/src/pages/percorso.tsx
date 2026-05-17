import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useWendy } from "@/contexts/WendyProvider";
import { apiFetch } from "@/lib/api-fetch";
import { toast } from "@/hooks/use-toast";
import {
  HelpCircle, TrendingUp, Rocket, Building2, BarChart3,
  ArrowRight, CheckCircle2, Star,
} from "lucide-react";

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
    tools: ["Test di personalità", "Esplora settori", "Coach AI", "Confronta carriere"],
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
  indeciso: "/test",
  dipendente: "/dashboard",
  autonomo: "#wendy",
  azienda: "/settori",
  investitore: "/settori",
};

export default function Percorso() {
  const { user, login, token } = useAuth();
  const [, setLocation] = useLocation();
  const wendy = useWendy();
  const [selected, setSelected] = useState<JourneyType | null>(
    (user?.journeyType as JourneyType) ?? null
  );
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (!selected) return;

    if (user && token) {
      setSaving(true);
      try {
        await apiFetch(`${BASE}api/profile/${user.id}/journey-type`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ journeyType: selected }),
        });
        login({ ...user, journeyType: selected }, token);
        toast({ title: "Piano salvato!", description: `Hai scelto: ${PERSONAS.find((p) => p.id === selected)?.label}` });
      } catch {
        toast({ title: "Errore", description: "Non è stato possibile salvare il piano.", variant: "destructive" });
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
                onClick={() => setSelected(persona.id)}
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
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex items-center gap-2 bg-primary text-primary-foreground font-bold px-8 py-3 rounded-full text-sm hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/25 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Salvataggio…" : "Inizia il tuo percorso"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
