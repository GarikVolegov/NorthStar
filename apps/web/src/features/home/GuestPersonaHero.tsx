import { useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, LogIn, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import type { Persona } from "./homeTypes";

/* ── Treasure-map SVG ──────────────────────────────────────────────────────
   Animated dashed path from bottom-left → NorthStar compass (top-right).
   The path "illuminates" progressively (ns-treasure-reveal clip), then the
   compass spins and shines when the light arrives.
   mix-blend-mode: screen — the gold fuses with the navy without washing it out.
   isolation: isolate on the hero prevents the page aurora from bleeding in.
────────────────────────────────────────────────────────────────────────── */
function TreasureMap() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 600"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0.32,
        pointerEvents: "none",
        zIndex: 0,
        mixBlendMode: "screen",
      }}
    >
      <defs>
        <filter id="tm-rough" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="2.2" />
        </filter>
        <filter id="tm-parchment" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" />
          <feColorMatrix values="0 0 0 0 0.76  0 0 0 0 0.62  0 0 0 0 0.29  0 0 0 0.08 0" />
        </filter>
        <filter id="tm-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="tm-compassGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#e6c068" stopOpacity="0.55" />
          <stop offset="55%"  stopColor="#c19e4a" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#c19e4a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="tm-fadeMask" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor="white" stopOpacity="0.5" />
          <stop offset="60%"  stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0.4" />
        </linearGradient>
        <mask id="tm-bottomFade">
          <rect width="1440" height="600" fill="url(#tm-fadeMask)" />
        </mask>
        <clipPath id="tm-pathReveal">
          <rect className="ns-treasure-reveal" x="0" y="0" width="0" height="600" />
        </clipPath>
      </defs>

      {/* Parchment texture */}
      <rect width="1440" height="600" fill="url(#tm-parchment)" opacity="0.3" />

      <g mask="url(#tm-bottomFade)">
        {/* Dashed path — base layer (always dim) */}
        <g filter="url(#tm-rough)">
          <path
            d="M 80 510 Q 200 460,280 480 Q 360 500,420 440 Q 480 380,560 410
               Q 640 440,700 380 Q 760 320,860 340 Q 960 360,1020 300
               Q 1080 240,1180 220 Q 1240 210,1260 180"
            fill="none" stroke="#e6c068" strokeWidth="3.5"
            strokeLinecap="round" strokeDasharray="2 16" opacity="0.55"
          />
          {/* Bright overlay — grows left→right via clip */}
          <g clipPath="url(#tm-pathReveal)">
            <path
              d="M 80 510 Q 200 460,280 480 Q 360 500,420 440 Q 480 380,560 410
                 Q 640 440,700 380 Q 760 320,860 340 Q 960 360,1020 300
                 Q 1080 240,1180 220 Q 1240 210,1260 180"
              fill="none" stroke="#f5e1a8" strokeWidth="3.8"
              strokeLinecap="round" strokeDasharray="2 16" filter="url(#tm-glow)"
            />
          </g>
        </g>

        {/* Start marker */}
        <g transform="translate(80 510)" filter="url(#tm-rough)">
          <circle cx="0" cy="0" r="9" fill="none" stroke="#e6c068" strokeWidth="2" />
          <circle cx="0" cy="0" r="3.5" fill="#e6c068" />
          <text x="0" y="-22" textAnchor="middle" fill="#e6c068" fontSize="13" fontFamily="serif" fontStyle="italic" opacity="0.85">tu sei qui</text>
        </g>

        {/* Island 1 */}
        <g transform="translate(440 470)" filter="url(#tm-rough)" opacity="0.85">
          <path d="M-60 0 Q-40-25,0-20 Q50-15,60 5 Q50 25,0 28 Q-55 25,-60 0 Z" fill="none" stroke="#e6c068" strokeWidth="1.8" />
          <line x1="0" y1="-10" x2="0" y2="-30" stroke="#e6c068" strokeWidth="1.5" />
          <path d="M0-30 Q-10-36,-16-32 M0-30 Q10-36,16-32 M0-30 Q-6-40,-2-42 M0-30 Q6-40,2-42" fill="none" stroke="#e6c068" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M-30 5 L-18-8 L-6 5 Z" fill="none" stroke="#e6c068" strokeWidth="1.3" />
        </g>

        {/* Island 2 */}
        <g transform="translate(880 400)" filter="url(#tm-rough)" opacity="0.85">
          <path d="M-70 0 Q-50-22,0-18 Q60-14,70 10 Q50 28,0 30 Q-65 28,-70 0 Z" fill="none" stroke="#e6c068" strokeWidth="1.8" />
          <path d="M-40 8 L-28-10 L-16 5 L-4-14 L10 6 Z" fill="none" stroke="#e6c068" strokeWidth="1.3" />
        </g>

        {/* Pirate ship */}
        <g transform="translate(1080 510)" filter="url(#tm-rough)" opacity="0.8">
          <path d="M-38 0 Q-30 14,0 14 Q30 14,38 0 L30-2 L-30-2 Z" fill="none" stroke="#e6c068" strokeWidth="1.6" />
          <line x1="-12" y1="-2" x2="-12" y2="-28" stroke="#e6c068" strokeWidth="1.6" />
          <line x1="10"  y1="-2" x2="10"  y2="-22" stroke="#e6c068" strokeWidth="1.6" />
          <path d="M-12-28 L-2-10 L-22-10 Z" fill="none" stroke="#e6c068" strokeWidth="1.4" />
          <path d="M10-22 L18-8 L2-8 Z" fill="none" stroke="#e6c068" strokeWidth="1.4" />
          <path d="M-12-28 L-4-26 L-12-22 Z" fill="#e6c068" opacity="0.85" />
        </g>

        {/* Sea waves */}
        <g opacity="0.5" stroke="#e6c068" strokeWidth="1.3" fill="none" strokeLinecap="round" filter="url(#tm-rough)">
          <path d="M1000 550 q14-8 28 0 t28 0 t28 0 t28 0 t28 0" />
          <path d="M1140 540 q14-8 28 0 t28 0 t28 0" />
          <path d="M990 575 q14-8 28 0 t28 0 t28 0 t28 0 t28 0 t28 0" />
        </g>

        {/* Kraken */}
        <g transform="translate(1200 480)" opacity="0.6" stroke="#e6c068" strokeWidth="1.5" fill="none" filter="url(#tm-rough)" strokeLinecap="round">
          <path d="M0 0 q8-16,20-8 q8 6,14-2 q6-8,12 0" />
          <path d="M-4 6 q6-10,14-4" />
        </g>

        {/* Cardinal N */}
        <g transform="translate(1300 60)" opacity="0.55">
          <text textAnchor="middle" fill="#e6c068" fontSize="22" fontFamily="serif" fontStyle="italic">N</text>
          <line x1="0" y1="10" x2="0" y2="34" stroke="#e6c068" strokeWidth="1.5" />
          <path d="M-5 30 L0 38 L5 30 Z" fill="#e6c068" />
        </g>

        {/* Destination: NorthStar compass */}
        <g className="ns-treasure-compass" transform="translate(1260 180)">
          <circle className="ns-treasure-halo" cx="0" cy="0" r="72" fill="url(#tm-compassGlow)" />
          <circle cx="0" cy="0" r="44" fill="none" stroke="#e6c068" strokeWidth="2.5" />
          <g stroke="#e6c068" strokeWidth="1.6" strokeLinecap="round" opacity="0.8">
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i * Math.PI) / 6;
              return (
                <line
                  key={i}
                  x1={Math.cos(a) * 44} y1={Math.sin(a) * 44}
                  x2={Math.cos(a) * 50} y2={Math.sin(a) * 50}
                />
              );
            })}
          </g>
          <circle cx="0" cy="0" r="34" fill="none" stroke="#e6c068" strokeWidth="1" strokeDasharray="2 3" opacity="0.8" />
          <g className="ns-treasure-needle">
            <path d="M0-38 L8 0 L0 38 L-8 0 Z" fill="#e6c068" opacity="0.95" />
            <path d="M-38 0 L0-7 L38 0 L0 7 Z" fill="#c19e4a" opacity="0.75" />
          </g>
          <circle cx="0" cy="0" r="3.5" fill="#0e1018" stroke="#e6c068" strokeWidth="1.2" />
          <text x="0"   y="-58" textAnchor="middle" fill="#e6c068" fontSize="13" fontFamily="serif" fontStyle="italic">N</text>
          <text x="58"  y="4"   textAnchor="middle" fill="#e6c068" fontSize="13" fontFamily="serif" fontStyle="italic">E</text>
          <text x="0"   y="68"  textAnchor="middle" fill="#e6c068" fontSize="13" fontFamily="serif" fontStyle="italic">S</text>
          <text x="-58" y="4"   textAnchor="middle" fill="#e6c068" fontSize="13" fontFamily="serif" fontStyle="italic">O</text>
          <text x="0" y="100" textAnchor="middle" fill="#e6c068" fontSize="13" fontFamily="serif" fontStyle="italic" opacity="0.9">la tua rotta</text>
        </g>

        {/* Corner flourishes */}
        <g opacity="0.35" stroke="#e6c068" strokeWidth="1.2" fill="none" filter="url(#tm-rough)" strokeLinecap="round">
          <path d="M20 20 q30 0 30 30 q0-20 20-30" />
          <path d="M1420 20 q-30 0-30 30 q0-20-20-30" />
          <path d="M20 580 q30 0 30-30 q0 20 20 30" />
          <path d="M1420 580 q-30 0-30-30 q0 20-20 30" />
        </g>
      </g>
    </svg>
  );
}

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
      {/* Hero with treasure map — isolated so the page aurora doesn't bleed in */}
      <div
        style={{
          background: "#07090f",
          isolation: "isolate",
          padding: "112px 24px 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Treasure map SVG background */}
        <TreasureMap />

        {/* Hero shroud: dims the aurora underneath the copy */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            background:
              "linear-gradient(180deg, rgba(7,9,15,0.92) 0%, rgba(7,9,15,0.92) 65%, rgba(7,9,15,0.55) 88%, rgba(7,9,15,0) 100%)",
          }}
        />

        {/* Warm gold radial under the copy */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at 50% 35%, rgba(193,158,74,0.06) 0%, transparent 55%)",
            zIndex: 0,
            pointerEvents: "none",
          }}
        />

        {/* Gradient transition at bottom: hero fuses into page background */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 140,
            zIndex: 1,
            background: "linear-gradient(180deg, transparent 0%, rgba(7,9,15,0.6) 55%, transparent 100%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 720,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <motion.div
            initial={prefersReduced ? {} : { scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-3.5 py-1.5 text-xs font-semibold text-primary mb-7">
              <Star className="w-3 h-3" /> {t("home.hero.badge")}
            </div>
            <h1
              style={{
                fontSize: "clamp(2rem, 5vw, 3.5rem)",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#fff",
                lineHeight: 1.05,
                margin: 0,
              }}
            >
              {t("home.hero.heading")}{" "}
              <span
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontStyle: "italic",
                  fontWeight: 400,
                  color: "#c19e4a",
                  fontSize: "1.1em",
                }}
              >
                {t("home.hero.headingHighlight")}
              </span>
            </h1>
            <p
              style={{
                color: "rgba(255,255,255,0.65)",
                fontSize: 18,
                marginTop: 22,
                maxWidth: 540,
                marginLeft: "auto",
                marginRight: "auto",
                lineHeight: 1.6,
              }}
            >
              {t("home.hero.subtitle")}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Persona grid — liquid glass cards on the animated background */}
      <div className="relative" style={{ background: "transparent", paddingBottom: 8 }}>
        <div className="max-w-6xl mx-auto px-3 sm:px-4 pt-10 pb-4">
          <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
                    "ns-card ns-card-hover group",
                    persona.borderClass,
                    "flex flex-row lg:flex-col items-center lg:items-start gap-3 px-4 py-3.5 lg:p-5",
                  )}
                >
                  <div
                    className="shrink-0 w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center transition-colors"
                    style={{
                      background: "rgba(193,158,74,0.10)",
                      border: "1px solid rgba(193,158,74,0.20)",
                    }}
                  >
                    <Icon
                      className={cn("w-4 h-4 lg:w-5 lg:h-5", persona.accentClass)}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-sm leading-tight">
                      {persona.label}
                    </p>
                    <p className={cn("text-xs font-medium mt-0.5 leading-snug", persona.accentClass)}>
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

                  <div className={cn("shrink-0 flex items-center gap-1 text-xs font-semibold", persona.accentClass)}>
                    <span className="hidden lg:inline">{persona.ctaLabel}</span>
                    <ChevronRight className="w-4 h-4 lg:w-3.5 lg:h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 mt-10 pb-2">
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
