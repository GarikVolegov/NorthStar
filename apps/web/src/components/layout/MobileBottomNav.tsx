import { useTopNavigationLayout } from "@/hooks/useTopNavigationLayout";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  MessageCircle,
  Trophy,
  UserCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "wouter";

type MobileNavItem = { href: string; icon?: LucideIcon; label: string; brand?: boolean };

const SOCIAL_ITEMS: MobileNavItem[] = [
  { href: "/social/feed", icon: Sparkles, label: "Feed" },
  { href: "/social/leaderboard", icon: Trophy, label: "Leaderboard" },
  { href: "/social/chat", icon: MessageCircle, label: "Chat" },
  { href: "/social/profilo", icon: UserCircle, label: "Profilo" },
];

export function MobileBottomNav() {
  const [location, navigate] = useLocation();
  const { items: navItems } = useTopNavigationLayout();

  if (location.startsWith("/social")) {
    return <SocialSubNav location={location} onBack={() => {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      navigate("/dashboard");
    }} />;
  }

  return (
    <nav aria-label="Navigazione inferiore" className="fixed top-0 left-0 right-0 z-40 flex justify-center px-4 pt-2">
      <div className="flex items-center justify-around min-h-11 px-1 gap-0.5 w-full max-w-5xl bg-card/80 backdrop-blur-sm rounded-2xl border border-border/30">
        {navItems.map(({ href, icon: Icon, label, brand, logoUrl }) => {
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
                    src={typeof logoUrl === "string" ? logoUrl : "/logo.svg"}
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

function SocialSubNav({ location, onBack }: { location: string; onBack: () => void }) {
  return (
    <nav aria-label="Navigazione social" className="fixed top-0 left-0 right-0 z-40 flex justify-center px-4 pt-2">
      <div className="flex min-h-11 w-full max-w-5xl items-center justify-around gap-0.5 rounded-2xl border border-border/30 bg-card/80 px-1 backdrop-blur-sm">
        <button
          type="button"
          aria-label="Torna indietro"
          onClick={onBack}
          className="relative flex min-h-11 items-center gap-1.5 px-2.5 text-muted-foreground/70 transition-all duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden text-[10px] font-semibold leading-none tracking-tight sm:block md:text-xs">
            Indietro
          </span>
        </button>

        {SOCIAL_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = location === href || (href === "/social/feed" && location === "/social");

          return (
            <Link key={href} href={href} aria-label={label}>
              <div
                className={cn(
                  "relative flex min-h-11 items-center gap-1.5 px-2.5 transition-all duration-200",
                  isActive ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground",
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="top-nav-indicator"
                    className="absolute -bottom-1 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                {Icon ? (
                  <Icon className="h-3.5 w-3.5 transition-all duration-200" strokeWidth={isActive ? 2.5 : 1.75} />
                ) : null}
                <span
                  className={cn(
                    "hidden text-[10px] font-semibold leading-none tracking-tight sm:block md:text-xs",
                    isActive ? "text-primary" : "text-muted-foreground/60",
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
