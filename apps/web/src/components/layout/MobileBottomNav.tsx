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

type NavPhase = 'guest' | 'new-user' | 'indeciso' | 'dipendente' | 'autonomo' | 'azienda' | 'investitore';

const PHASE_ITEMS: Record<NavPhase, Array<{ href: string; icon: typeof Home; label: string }>> = {
  guest: [
    { href: "/", icon: Home, label: "Home" },
    { href: "/test", icon: FlaskConical, label: "Test" },
    { href: "/settori", icon: Layers, label: "Settori" },
    { href: "/chi-siamo", icon: Users, label: "Chi siamo" },
    { href: "/come-funziona", icon: BookOpenText, label: "Come funziona" },
  ],
  "new-user": [
    { href: "/", icon: Home, label: "Home" },
    { href: "/test", icon: FlaskConical, label: "Test" },
    { href: "/settori", icon: Layers, label: "Settori" },
    { href: "/percorso", icon: MapPin, label: "Percorso" },
    { href: "/profilo", icon: User, label: "Profilo" },
  ],
  indeciso: [
    { href: "/", icon: Home, label: "Home" },
    { href: "/test", icon: FlaskConical, label: "Test" },
    { href: "/settori", icon: Layers, label: "Settori" },
    { href: "/ruoli", icon: Briefcase, label: "Ruoli" },
    { href: "/profilo", icon: User, label: "Profilo" },
  ],
  dipendente: [
    { href: "/", icon: Home, label: "Home" },
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/lavori", icon: MapPin, label: "Lavori" },
    { href: "/coach", icon: BrainCircuit, label: "Coach AI" },
    { href: "/profilo", icon: User, label: "Profilo" },
  ],
  autonomo: [
    { href: "/", icon: Home, label: "Home" },
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/validatore-idea", icon: Compass, label: "Validatore" },
    { href: "/settori", icon: Layers, label: "Settori" },
    { href: "/profilo", icon: User, label: "Profilo" },
  ],
  azienda: [
    { href: "/", icon: Home, label: "Home" },
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/settori", icon: Layers, label: "Settori" },
    { href: "/affiliazione", icon: HandCoins, label: "Affiliazione" },
    { href: "/profilo", icon: User, label: "Profilo" },
  ],
  investitore: [
    { href: "/", icon: Home, label: "Home" },
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/settori", icon: Layers, label: "Settori" },
    { href: "/news", icon: Newspaper, label: "News" },
    { href: "/profilo", icon: User, label: "Profilo" },
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
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-card/92 backdrop-blur-xl border-t border-border/60" />

      <div className="relative flex items-stretch justify-around h-16 px-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive =
            href === "/"
              ? location === "/"
              : location === href || location.startsWith(href + "/");

          return (
            <Link key={href} href={href}>
              <div
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 h-full px-3 min-w-[58px] transition-all duration-200 active:scale-95",
                  isActive ? "text-primary" : "text-muted-foreground/60"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon
                  className="h-5 w-5 transition-all duration-200"
                  strokeWidth={isActive ? 2.5 : 1.75}
                />
                <span
                  className={cn(
                    "text-[10px] font-semibold tracking-tight leading-none",
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
