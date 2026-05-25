import { useAuth } from "@/contexts/AuthContext";
import { useOptionalWendy } from "@/contexts/WendyProvider";
import { useProactiveInsights } from "@/hooks/useProactiveInsights";
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
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "wouter";

type NavPhase = 'guest' | 'new-user' | 'indeciso' | 'dipendente' | 'autonomo' | 'azienda' | 'investitore';
type MobileNavItem = { href: string; icon?: LucideIcon; label: string; brand?: boolean };

const PHASE_ITEMS: Record<NavPhase, MobileNavItem[]> = {
  guest: [
    { href: "/", icon: Home, label: NAV_LABELS.home },
    { href: "/test", icon: FlaskConical, label: NAV_LABELS.test },
    { href: "/settori", icon: Layers, label: NAV_LABELS.aree },
    { href: "/chi-siamo", icon: Users, label: NAV_LABELS.chiSiamo },
    { href: "/come-funziona", icon: BookOpenText, label: NAV_LABELS.comeFunziona },
  ],
  "new-user": [
    { href: "/dashboard", label: NAV_LABELS.northStar, brand: true },
    { href: "/test", icon: FlaskConical, label: NAV_LABELS.test },
    { href: "/settori", icon: Layers, label: NAV_LABELS.aree },
    { href: "/percorso", icon: MapPin, label: NAV_LABELS.piano },
    { href: "/social", icon: MessageCircle, label: NAV_LABELS.social },
  ],
  indeciso: [
    { href: "/dashboard", label: NAV_LABELS.northStar, brand: true },
    { href: "/test", icon: FlaskConical, label: NAV_LABELS.test },
    { href: "/settori", icon: Layers, label: NAV_LABELS.aree },
    { href: "/ruoli", icon: Briefcase, label: NAV_LABELS.lavori },
    { href: "/social", icon: MessageCircle, label: NAV_LABELS.social },
  ],
  dipendente: [
    { href: "/dashboard", label: NAV_LABELS.northStar, brand: true },
    { href: "/lavori", icon: MapPin, label: NAV_LABELS.offerte },
    { href: "/coach", icon: BrainCircuit, label: NAV_LABELS.coach },
    { href: "/social", icon: MessageCircle, label: NAV_LABELS.social },
  ],
  autonomo: [
    { href: "/dashboard", label: NAV_LABELS.northStar, brand: true },
    { href: "/validatore-idea", icon: Compass, label: NAV_LABELS.idea },
    { href: "/settori", icon: Layers, label: NAV_LABELS.aree },
    { href: "/social", icon: MessageCircle, label: NAV_LABELS.social },
  ],
  azienda: [
    { href: "/dashboard", label: NAV_LABELS.northStar, brand: true },
    { href: "/settori", icon: Layers, label: NAV_LABELS.aree },
    { href: "/affiliazione", icon: HandCoins, label: NAV_LABELS.partner },
    { href: "/social", icon: MessageCircle, label: NAV_LABELS.social },
  ],
  investitore: [
    { href: "/dashboard", label: NAV_LABELS.northStar, brand: true },
    { href: "/settori", icon: Layers, label: NAV_LABELS.aree },
    { href: "/news", icon: Newspaper, label: NAV_LABELS.news },
    { href: "/social", icon: MessageCircle, label: NAV_LABELS.social },
  ],
};

export function MobileBottomNav() {
  const { isLoggedIn, user } = useAuth();
  const [location] = useLocation();
  const wendy = useOptionalWendy();
  const { unreadCount: insightsUnread } = useProactiveInsights();

  const phase: NavPhase = !isLoggedIn ? 'guest'
    : !user?.journeyType ? 'new-user'
    : ['indeciso', 'dipendente', 'autonomo', 'azienda', 'investitore'].includes(user.journeyType) ? user.journeyType as NavPhase
    : 'new-user';

  const navItems = PHASE_ITEMS[phase];
  // Wendy FAB available only for logged-in users (guest navigates marketing pages first).
  const showWendyFab = isLoggedIn && wendy;
  const wendyActive = Boolean(wendy?.isOpen || wendy?.isSpeaking || wendy?.phase === 'thinking' || wendy?.phase === 'listening');

  return (
    <nav aria-label="Navigazione inferiore" className="fixed top-0 left-0 right-0 z-40 flex justify-center px-4 pt-2">
      <div className="flex items-center justify-around min-h-11 px-1 gap-0.5 w-full max-w-5xl bg-card/80 backdrop-blur-sm rounded-2xl border border-border/30">
        {showWendyFab && (
          <button
            type="button"
            onClick={() => wendy.open()}
            aria-label={insightsUnread > 0 ? `Apri Wendy (${insightsUnread > 9 ? '9+' : insightsUnread} insight non letti)` : "Apri Wendy"}
            className="relative flex min-h-11 items-center gap-1.5 px-3 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 rounded-full"
          >
            <span className="relative flex h-5 w-5 items-center justify-center">
              <motion.span
                aria-hidden
                className={cn(
                  "absolute inset-0 rounded-full",
                  wendyActive ? "opacity-100" : "opacity-60",
                )}
                style={{
                  background:
                    "conic-gradient(from 0deg, #c19e4a, #7db89a, #5a9fd4, #9b80cc, #d96e66, #c19e4a)",
                  WebkitMask:
                    "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px))",
                  mask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px))",
                }}
                animate={wendyActive ? { rotate: 360 } : { rotate: 0 }}
                transition={wendyActive ? { duration: 2, repeat: Infinity, ease: "linear" } : { duration: 0 }}
              />
              {insightsUnread > 0 && (
                <span
                  aria-hidden
                  className="absolute -right-1 -top-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-semibold leading-none text-white shadow ring-2 ring-card"
                >
                  {insightsUnread > 9 ? "9+" : insightsUnread}
                </span>
              )}
            </span>
            <span
              className={cn(
                "text-[10px] md:text-xs font-semibold tracking-tight leading-none hidden sm:block",
                wendyActive ? "text-primary" : "text-muted-foreground/70",
              )}
            >
              Wendy
            </span>
          </button>
        )}
        {navItems.map(({ href, icon: Icon, label, brand }) => {
          const isActive =
            href === "/"
              ? location === "/"
              : location === href || location.startsWith(href + "/");

          return (
            <Link key={href} href={href} aria-label={label}>
              <div
                className={cn(
                  "relative flex min-h-11 items-center gap-1.5 h-full px-2.5 transition-all duration-200",
                  isActive ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="top-nav-indicator"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                {brand ? (
                  <img
                    src="/logo.svg"
                    alt=""
                    className={cn(
                      "h-4 w-4 rounded-full object-cover transition-all duration-200",
                      isActive ? "opacity-100" : "opacity-60",
                    )}
                  />
                ) : Icon ? (
                  <Icon
                    className="h-3.5 w-3.5 transition-all duration-200"
                    strokeWidth={isActive ? 2.5 : 1.75}
                  />
                ) : null}
                <span
                  className={cn(
                    "text-[10px] md:text-xs font-semibold tracking-tight leading-none hidden sm:block",
                    isActive ? "text-primary" : "text-muted-foreground/60"
                  )}
                >
                  {label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
