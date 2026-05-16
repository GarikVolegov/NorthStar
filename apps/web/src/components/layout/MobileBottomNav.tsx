import { Link, useLocation } from "wouter";
import {
  Home,
  FlaskConical,
  Layers,
  Briefcase,
  User,
  LayoutDashboard,
  MapPin,
  BrainCircuit,
  Compass,
  HandCoins,
  Users,
  BookOpenText,
  Newspaper,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { NAV_LABELS } from "@/lib/constants";

type NavPhase = 'guest' | 'new-user' | 'indeciso' | 'dipendente' | 'autonomo' | 'azienda' | 'investitore';

const PHASE_ITEMS: Record<NavPhase, Array<{ href: string; icon: typeof Home; label: string }>> = {
  guest: [
    { href: "/", icon: Home, label: NAV_LABELS.home },
    { href: "/test", icon: FlaskConical, label: NAV_LABELS.test },
    { href: "/settori", icon: Layers, label: NAV_LABELS.aree },
    { href: "/chi-siamo", icon: Users, label: NAV_LABELS.chiSiamo },
    { href: "/come-funziona", icon: BookOpenText, label: NAV_LABELS.comeFunziona },
  ],
  "new-user": [
    { href: "/", icon: Home, label: NAV_LABELS.home },
    { href: "/test", icon: FlaskConical, label: NAV_LABELS.test },
    { href: "/settori", icon: Layers, label: NAV_LABELS.aree },
    { href: "/percorso", icon: MapPin, label: NAV_LABELS.piano },
    { href: "/profilo", icon: User, label: NAV_LABELS.profilo },
  ],
  indeciso: [
    { href: "/", icon: Home, label: NAV_LABELS.home },
    { href: "/test", icon: FlaskConical, label: NAV_LABELS.test },
    { href: "/settori", icon: Layers, label: NAV_LABELS.aree },
    { href: "/ruoli", icon: Briefcase, label: NAV_LABELS.lavori },
    { href: "/profilo", icon: User, label: NAV_LABELS.profilo },
  ],
  dipendente: [
    { href: "/", icon: Home, label: NAV_LABELS.home },
    { href: "/dashboard", icon: LayoutDashboard, label: NAV_LABELS.dashboard },
    { href: "/lavori", icon: MapPin, label: NAV_LABELS.offerte },
    { href: "/coach", icon: BrainCircuit, label: NAV_LABELS.coach },
    { href: "/profilo", icon: User, label: NAV_LABELS.profilo },
  ],
  autonomo: [
    { href: "/", icon: Home, label: NAV_LABELS.home },
    { href: "/dashboard", icon: LayoutDashboard, label: NAV_LABELS.dashboard },
    { href: "/validatore-idea", icon: Compass, label: NAV_LABELS.idea },
    { href: "/settori", icon: Layers, label: NAV_LABELS.aree },
    { href: "/profilo", icon: User, label: NAV_LABELS.profilo },
  ],
  azienda: [
    { href: "/", icon: Home, label: NAV_LABELS.home },
    { href: "/dashboard", icon: LayoutDashboard, label: NAV_LABELS.dashboard },
    { href: "/settori", icon: Layers, label: NAV_LABELS.aree },
    { href: "/affiliazione", icon: HandCoins, label: NAV_LABELS.partner },
    { href: "/profilo", icon: User, label: NAV_LABELS.profilo },
  ],
  investitore: [
    { href: "/", icon: Home, label: NAV_LABELS.home },
    { href: "/dashboard", icon: LayoutDashboard, label: NAV_LABELS.dashboard },
    { href: "/settori", icon: Layers, label: NAV_LABELS.aree },
    { href: "/news", icon: Newspaper, label: NAV_LABELS.news },
    { href: "/profilo", icon: User, label: NAV_LABELS.profilo },
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
        {navItems.map(({ href, icon: Icon, label }) => {
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
                <Icon
                  className="h-3.5 w-3.5 transition-all duration-200"
                  strokeWidth={isActive ? 2.5 : 1.75}
                />
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
