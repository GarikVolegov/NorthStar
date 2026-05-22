import { useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, LogIn, Star } from "lucide-react";
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
    <section className="relative w-full overflow-hidden">
      <div className="hero-navy py-10 md:py-18 px-4 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-80 rounded-full bg-primary/5 blur-[90px]" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.div
            initial={prefersReduced ? {} : { scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-3.5 py-1.5 text-xs font-semibold text-primary mb-4">
              <Star className="w-3 h-3" /> {t("home.hero.badge")}
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white leading-tight mb-3">
              {t("home.hero.heading")}{" "}
              <span className="text-italic-serif text-primary">
                {t("home.hero.headingHighlight")}
              </span>
            </h1>
            <p className="text-sm sm:text-base text-white/65 max-w-xl mx-auto">
              {t("home.hero.subtitle")}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="bg-background relative pb-2">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 pt-6 pb-4">
          <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
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
                    "group cursor-pointer rounded-2xl border border-border bg-card transition-all duration-200 active:scale-[0.98]",
                    persona.borderClass,
                    "hover:border-primary/40 hover:bg-card/80 hover:shadow-lg hover:shadow-black/25",
                    "flex flex-row lg:flex-col items-center lg:items-start gap-3 px-4 py-3.5 lg:p-5",
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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 mt-6 pb-2">
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
      </div>
    </section>
  );
}

