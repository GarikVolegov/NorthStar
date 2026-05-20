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

  const phase: NavPhase = !isLoggedIn ? 'guest'
    : !user?.journeyType ? 'new-user'
    : ['indeciso', 'dipendente', 'autonomo', 'azienda', 'investitore'].includes(user.journeyType) ? user.journeyType as NavPhase
    : 'new-user';

  const navItems = PHASE_ITEMS[phase];

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 flex justify-center px-4 pt-2">
      <div className="flex items-center justify-around h-9 md:h-10 px-1 gap-0.5 w-full max-w-5xl bg-card/80 backdrop-blur-sm rounded-2xl border border-border/30">
        {navItems.map(({ href, icon: Icon, label, brand }) => {
          const isActive =
            href === "/"
              ? location === "/"
              : location === href || location.startsWith(href + "/");

          return (
            <Link key={href} href={href}>
              <div
                className={cn(
                  "relative flex items-center gap-1.5 h-full px-2.5 transition-all duration-200",
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
