import { AppLogo } from "@/components/brand/AppLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  BookOpenText,
  BrainCircuit,
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
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";

type NavPhase = 'guest' | 'new-user' | 'indeciso' | 'dipendente' | 'autonomo' | 'azienda' | 'investitore';
type MobileNavItem = { href: string; icon?: LucideIcon | undefined; labelKey: string; source: string; brand?: boolean };

const NAV_SOURCES = {
  home: "Home",
  northStar: "NorthStar",
  bussola: "Bussola",
  test: "Test",
  areas: "Aree",
  choice: "Settore+ruolo",
  jobs: "Offerte",
  plan: "Piano",
  coach: "Coach AI",
  idea: "Idee",
  news: "News",
  partner: "Partner",
  social: "Social",
  howItWorks: "Come funziona",
  growthPersonal: "Crescita personale",
} as const;

function navItem(
  href: string,
  labelKey: keyof typeof NAV_SOURCES,
  icon?: LucideIcon,
  brand = false,
): MobileNavItem {
  return {
    href,
    icon,
    brand,
    labelKey: `nav.${labelKey}`,
    source: NAV_SOURCES[labelKey],
  };
}

const GROWTH_NAV_ITEM: MobileNavItem = {
  href: "/crescita",
  icon: Sparkles,
  labelKey: "nav.growthPersonal",
  source: NAV_SOURCES.growthPersonal,
};

const PHASE_ITEMS: Record<NavPhase, MobileNavItem[]> = {
  guest: [
    navItem("/", "home", Home),
    navItem("/test", "test", FlaskConical),
    navItem("/settori", "areas", Layers),
    GROWTH_NAV_ITEM,
    navItem("/come-funziona", "howItWorks", BookOpenText),
  ],
  "new-user": [
    navItem("/dashboard", "northStar", undefined, true),
    navItem("/test", "test", FlaskConical),
    navItem("/settori", "areas", Layers),
    navItem("/percorso", "plan", MapPin),
    GROWTH_NAV_ITEM,
    navItem("/social", "social", MessageCircle),
  ],
  indeciso: [
    navItem("/dashboard", "northStar", undefined, true),
    navItem("/bussola", "bussola", Compass),
    navItem("/settori", "choice", Layers),
    GROWTH_NAV_ITEM,
    navItem("/social", "social", MessageCircle),
  ],
  dipendente: [
    navItem("/dashboard", "northStar", undefined, true),
    navItem("/lavori", "jobs", MapPin),
    navItem("/coach", "coach", BrainCircuit),
    GROWTH_NAV_ITEM,
    navItem("/social", "social", MessageCircle),
  ],
  autonomo: [
    navItem("/dashboard", "northStar", undefined, true),
    navItem("/validatore-idea", "idea", Compass),
    navItem("/settori", "areas", Layers),
    GROWTH_NAV_ITEM,
    navItem("/social", "social", MessageCircle),
  ],
  azienda: [
    navItem("/dashboard", "northStar", undefined, true),
    navItem("/settori", "areas", Layers),
    navItem("/affiliazione", "partner", HandCoins),
    GROWTH_NAV_ITEM,
    navItem("/social", "social", MessageCircle),
  ],
  investitore: [
    navItem("/dashboard", "northStar", undefined, true),
    navItem("/settori", "areas", Layers),
    navItem("/news", "news", Newspaper),
    GROWTH_NAV_ITEM,
    navItem("/social", "social", MessageCircle),
  ],
};

function MobileBottomNavLink({
  item,
  isActive,
}: {
  item: MobileNavItem;
  isActive: boolean;
}) {
  const { i18n } = useTranslation();
  const activeLanguage = i18n.resolvedLanguage?.slice(0, 2) || i18n.language?.slice(0, 2) || "it";
  const label = useDynamicTranslation({
    locale: activeLanguage,
    source: item.source,
    key: item.labelKey,
    context: "Mobile bottom navigation label",
  });
  const Icon = item.icon;

  return (
    <Link href={item.href} aria-label={label}>
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
        {item.brand ? (
          <AppLogo
            decorative
            className={cn(
              "h-4 w-4 transition-all duration-200",
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
}

export function MobileBottomNav() {
  const { isLoggedIn, user } = useAuth();
  const [location] = useLocation();

  const phase: NavPhase = !isLoggedIn ? 'guest'
    : !user?.journeyType ? 'new-user'
    : ['indeciso', 'dipendente', 'autonomo', 'azienda', 'investitore'].includes(user.journeyType) ? user.journeyType as NavPhase
    : 'new-user';

  const navItems = PHASE_ITEMS[phase];

  return (
    <nav aria-label="Navigazione inferiore" className="fixed top-0 left-0 right-0 z-40 flex justify-center px-4 pt-2">
      <div className="flex items-center justify-around min-h-11 px-1 gap-0.5 w-full max-w-5xl bg-card/80 backdrop-blur-sm rounded-2xl border border-border/30">
        {navItems.map((item) => {
          const { href } = item;
          const isActive =
            href === "/"
              ? location === "/"
              : location === href || location.startsWith(href + "/");

          return <MobileBottomNavLink key={href} item={item} isActive={isActive} />;
        })}
      </div>
    </nav>
  );
}
