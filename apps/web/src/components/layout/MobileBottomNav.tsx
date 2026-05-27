import { useAuth } from "@/contexts/AuthContext";
import { NAV_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  BookOpenText,
  BrainCircuit,
  Briefcase,
  Compass,
  FlaskConical,
  HandCoins,
  Home,
  Layers,
  MapPin,
  MessageCircle,
  Newspaper,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAppState } from "@/contexts/AppStateContext";

type NavPhase = 'guest' | 'new-user' | 'indeciso' | 'dipendente' | 'autonomo' | 'azienda' | 'investitore';
type MobileNavItem = { href: string; icon?: LucideIcon; label: string; brand?: boolean };

const GROWTH_NAV_ITEM: MobileNavItem = {
  href: "/crescita",
  icon: Sparkles,
  label: "Crescita personale",
};

const PHASE_ITEMS: Record<NavPhase, MobileNavItem[]> = {
  guest: [
    { href: "/", icon: Home, label: NAV_LABELS.home },
    { href: "/test", icon: FlaskConical, label: NAV_LABELS.test },
    { href: "/settori", icon: Layers, label: NAV_LABELS.aree },
    GROWTH_NAV_ITEM,
    { href: "/come-funziona", icon: BookOpenText, label: NAV_LABELS.comeFunziona },
  ],
  "new-user": [
    { href: "/dashboard", label: NAV_LABELS.northStar, brand: true },
    { href: "/test", icon: FlaskConical, label: NAV_LABELS.test },
    { href: "/settori", icon: Layers, label: NAV_LABELS.aree },
    { href: "/percorso", icon: MapPin, label: NAV_LABELS.piano },
    GROWTH_NAV_ITEM,
    { href: "/social", icon: MessageCircle, label: NAV_LABELS.social },
  ],
  indeciso: [
    { href: "/dashboard", label: NAV_LABELS.northStar, brand: true },
    { href: "/test", icon: FlaskConical, label: NAV_LABELS.test },
    { href: "/settori", icon: Layers, label: NAV_LABELS.aree },
    { href: "/ruoli", icon: Briefcase, label: NAV_LABELS.lavori },
    GROWTH_NAV_ITEM,
    { href: "/social", icon: MessageCircle, label: NAV_LABELS.social },
  ],
  dipendente: [
    { href: "/dashboard", label: NAV_LABELS.northStar, brand: true },
    { href: "/lavori", icon: MapPin, label: NAV_LABELS.offerte },
    { href: "/coach", icon: BrainCircuit, label: NAV_LABELS.coach },
    GROWTH_NAV_ITEM,
    { href: "/social", icon: MessageCircle, label: NAV_LABELS.social },
  ],
  autonomo: [
    { href: "/dashboard", label: NAV_LABELS.northStar, brand: true },
    { href: "/validatore-idea", icon: Compass, label: NAV_LABELS.idea },
    { href: "/settori", icon: Layers, label: NAV_LABELS.aree },
    GROWTH_NAV_ITEM,
    { href: "/social", icon: MessageCircle, label: NAV_LABELS.social },
  ],
  azienda: [
    { href: "/dashboard", label: NAV_LABELS.northStar, brand: true },
    { href: "/settori", icon: Layers, label: NAV_LABELS.aree },
    { href: "/affiliazione", icon: HandCoins, label: NAV_LABELS.partner },
    GROWTH_NAV_ITEM,
    { href: "/social", icon: MessageCircle, label: NAV_LABELS.social },
  ],
  investitore: [
    { href: "/dashboard", label: NAV_LABELS.northStar, brand: true },
    { href: "/settori", icon: Layers, label: NAV_LABELS.aree },
    { href: "/news", icon: Newspaper, label: NAV_LABELS.news },
    GROWTH_NAV_ITEM,
    { href: "/social", icon: MessageCircle, label: NAV_LABELS.social },
  ],
};

const NEWS_TICKERS = [
  "AI generativa: i 5 ruoli più richiesti nel 2026",
  "Stipendi nel tech italiano: +12% in 12 mesi",
  "Cybersecurity: profili junior introvabili",
  "Green jobs: il settore cresce del 18%",
];

/* ── PillNavbar (Design System v2) ───────────────────────────────────────
   Bottom-fixed pill with liquid glass treatment.
   On desktop: news ticker | Wendy prompt | profile/login
   On mobile: compact icon nav (same routes as before, pill style)
────────────────────────────────────────────────────────────────────────── */
export function MobileBottomNav() {
  const { isLoggedIn, user } = useAuth();
  const [location] = useLocation();
  const { setWendyOpen } = useAppState();

  const phase: NavPhase = !isLoggedIn ? 'guest'
    : !user?.journeyType ? 'new-user'
    : ['indeciso', 'dipendente', 'autonomo', 'azienda', 'investitore'].includes(user.journeyType)
      ? user.journeyType as NavPhase
      : 'new-user';

  const navItems = PHASE_ITEMS[phase];
  const initial = user?.name?.charAt(0).toUpperCase() ?? "?";
  const firstName = user?.name?.split(" ")[0] ?? "";

  return (
    <nav aria-label="Navigazione" className="fixed bottom-4 left-0 right-0 z-40 flex justify-center px-4" style={{ pointerEvents: "none" }}>
      <div
        className="ns-pill-nav"
        style={{
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 8px",
          height: 56,
          width: "100%",
          maxWidth: 1024,
        }}
      >
        {/* ── Desktop left: news ticker ── */}
        <Link
          href="/news"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 12px",
            height: 44,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.05)",
            borderRadius: 9999,
            flex: "1 1 0",
            minWidth: 0,
            maxWidth: 320,
            textDecoration: "none",
          }}
          className="hidden md:flex"
        >
          <Newspaper className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden", position: "relative", height: 20 }}>
            <div
              className="ns-marquee-track"
              style={{ position: "absolute", top: 0, left: 0, lineHeight: "20px" }}
            >
              {[0, 1].map((g) => (
                <span key={g} style={{ display: "inline-flex", gap: 28 }}>
                  {NEWS_TICKERS.map((t, i) => (
                    <span
                      key={i}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontWeight: 400,
                        fontSize: 13,
                        color: "var(--fg-muted, #a6aabf)",
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(193,158,74,0.6)", flexShrink: 0 }} />
                      {t}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </Link>

        {/* ── Desktop centre: Wendy prompt ── */}
        <button
          onClick={() => setWendyOpen(true)}
          className="hidden md:flex"
          style={{
            flex: "1 1 0",
            minWidth: 0,
            height: 48,
            background: "rgba(19,22,33,0.80)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 9999,
            alignItems: "center",
            gap: 12,
            padding: "0 14px",
            fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
            cursor: "pointer",
          }}
        >
          {/* Compass with animated needle */}
          <svg width="24" height="24" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" fill="none" stroke="#c19e4a" strokeWidth="1.4" opacity="0.85" />
            <g stroke="#c19e4a" strokeWidth="1.4" strokeLinecap="round" opacity="0.7">
              <line x1="12" y1="2.5" x2="12" y2="4.2" />
              <line x1="21.5" y1="12" x2="19.8" y2="12" />
              <line x1="12" y1="21.5" x2="12" y2="19.8" />
              <line x1="2.5" y1="12" x2="4.2" y2="12" />
            </g>
            <g className="ns-compass-needle">
              <path d="M12 12 L10.6 12 L12 4 L13.4 12 Z" fill="#d4ba7c" />
              <path d="M12 12 L10.6 12 L12 20 L13.4 12 Z" fill="#7d6827" />
            </g>
            <circle cx="12" cy="12" r="1.6" fill="#0e1018" stroke="#c19e4a" strokeWidth="0.8" />
          </svg>
          <span style={{
            flex: 1,
            textAlign: "left",
            fontFamily: "'Playfair Display', Georgia, serif",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 15,
            color: "rgba(212,186,124,0.88)",
          }}>
            Cerca o chiedi a Wendy…
          </span>
        </button>

        {/* ── Desktop right: profile or login ── */}
        {isLoggedIn ? (
          <Link
            href="/profilo"
            className="hidden md:flex"
            style={{
              height: 44,
              padding: "0 14px 0 6px",
              gap: 10,
              alignItems: "center",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 9999,
              color: "var(--fg, #e6e8ed)",
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "rgba(193,158,74,0.10)",
              border: "1px solid rgba(193,158,74,0.25)",
              color: "#c19e4a",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700,
              fontFamily: "'Playfair Display', Georgia, serif",
            }}>
              {initial}
            </div>
            <span style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 400, fontSize: 16, letterSpacing: "-0.005em",
            }}>
              {firstName}
            </span>
          </Link>
        ) : (
          <Link
            href="/login"
            className="hidden md:flex items-center"
            style={{
              height: 44, padding: "0 18px",
              background: "#c19e4a", color: "#0b0d12",
              borderRadius: 9999, fontWeight: 700, fontSize: 14,
              textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            Accedi
          </Link>
        )}

        {/* ── Mobile: icon row (all items, same routing logic) ── */}
        <div className="flex md:hidden items-center justify-around flex-1 h-full">
          {navItems.map(({ href, icon: Icon, label, brand }) => {
            const isActive = href === "/" ? location === "/" : location === href || location.startsWith(href + "/");
            return (
              <Link key={href} href={href} aria-label={label} style={{ textDecoration: "none" }}>
                <div className={cn(
                  "relative flex min-h-11 items-center gap-1.5 h-full px-2.5 transition-all duration-200",
                  isActive ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground",
                )}>
                  {isActive && (
                    <motion.div
                      layoutId="pill-nav-indicator"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  {brand ? (
                    <img
                      src="/logo.svg" alt=""
                      className={cn("h-4 w-4 rounded-full object-cover transition-all duration-200", isActive ? "opacity-100" : "opacity-60")}
                    />
                  ) : Icon ? (
                    <Icon className="h-3.5 w-3.5 transition-all duration-200" strokeWidth={isActive ? 2.5 : 1.75} />
                  ) : null}
                  <span className={cn(
                    "text-[10px] font-semibold tracking-tight leading-none hidden sm:block",
                    isActive ? "text-primary" : "text-muted-foreground/60",
                  )}>
                    {label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
