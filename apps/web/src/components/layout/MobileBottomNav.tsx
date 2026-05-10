import { Link, useLocation } from "wouter";
import { Home, FlaskConical, Layers, Briefcase, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const NAV_ITEMS = [
  { href: "/",        icon: Home,         label: "Home"    },
  { href: "/test",    icon: FlaskConical, label: "Test"    },
  { href: "/settori", icon: Layers,       label: "Settori" },
  { href: "/lavori",  icon: Briefcase,    label: "Lavori"  },
  { href: "/profilo", icon: User,         label: "Profilo" },
];

export function MobileBottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-card/92 backdrop-blur-xl border-t border-border/60" />

      <div className="relative flex items-stretch justify-around h-16 px-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
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
