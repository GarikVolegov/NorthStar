import { useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, LogIn, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import type { Persona } from "./homeTypes";

export function GuestPersonaHero({
  onLoginClick,
  personas,
  wendy,
}: {
  onLoginClick: () => void;
  personas: Persona[];
  wendy: { open: () => void };
}) {
  const { t } = useTranslation();
  const prefersReduced = useReducedMotion();
  const [, setLocation] = useLocation();

  return (
    <section
      id="per-chi"
      data-testid="guest-persona-section"
      className="border-b border-border bg-background py-14 md:py-20"
    >
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <div className="mb-8 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <Users className="h-3.5 w-3.5" />
            {t("home.audience.badge", { defaultValue: "Per chi e pensata" })}
          </div>
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">
            {t("home.audience.title", {
              defaultValue:
                "Scegli il punto di partenza solo dopo aver capito la mappa.",
            })}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {t("home.audience.subtitle", {
              defaultValue:
                "NorthStar accompagna bisogni diversi, ma parte sempre dalla stessa promessa: ridurre il rumore e trasformare le opzioni in una direzione leggibile.",
            })}
          </p>
        </div>

        <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-2 lg:grid-cols-5">
            {personas.map((persona, i) => {
              const Icon = persona.icon;
              return (
                <motion.div
                  key={persona.id}
                  initial={prefersReduced ? {} : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.06, duration: 0.35 }}
                  onClick={() => {
                    if (persona.ctaHref === "#wendy") {
                      wendy.open();
                    } else {
                      setLocation(persona.ctaHref);
                    }
                  }}
                  className={cn(
                    "group flex cursor-pointer flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 transition-all duration-200 active:scale-[0.98] lg:flex-col lg:items-start lg:p-5",
                    persona.borderClass,
                    "hover:border-primary/40 hover:bg-card/80 hover:shadow-lg hover:shadow-black/25",
                  )}
                >
                  <div className="shrink-0 w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:bg-primary/15 transition-colors">
                    <Icon
                      className={cn(
                        "w-4 h-4 lg:w-5 lg:h-5",
                        persona.accentClass,
                      )}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-sm leading-tight">
                      {persona.label}
                    </p>
                    <p
                      className={cn(
                        "text-xs font-medium mt-0.5 leading-snug",
                        persona.accentClass,
                      )}
                    >
                      {persona.tagline}
                    </p>
                    <div className="hidden lg:flex flex-wrap gap-1 mt-2">
                      {persona.tools.slice(0, 2).map((tool) => (
                        <span
                          key={tool}
                          className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div
                    className={cn(
                      "shrink-0 flex items-center gap-1 text-xs font-semibold",
                      persona.accentClass,
                    )}
                  >
                    <span className="hidden lg:inline">{persona.ctaLabel}</span>
                    <ChevronRight className="w-4 h-4 lg:w-3.5 lg:h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col items-stretch justify-center gap-2.5 pb-2 sm:flex-row sm:items-center">
            <Link href="/test" className="flex-1 sm:flex-initial">
              <div className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold text-sm rounded-full px-7 py-3 hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25">
                {t("home.startTest")} <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
            <button
              onClick={onLoginClick}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 border border-border text-muted-foreground font-semibold text-sm rounded-full px-7 py-3 hover:border-white/20 hover:text-foreground hover:bg-white/5 transition-all"
            >
              <LogIn className="w-4 h-4" />
              {t("home.alreadyAccount")}
            </button>
          </div>
      </div>
    </section>
  );
}

