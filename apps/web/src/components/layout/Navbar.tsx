import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LazyMotion, domAnimation, m, AnimatePresence } from "framer-motion";
import {
  LogOut,
  User,
  LayoutDashboard,
  Menu,
  X,
  FlaskConical,
  Layers,
  BookOpenText,
  Newspaper,
  Crown,
  Briefcase,
  Users,
  Calendar,
  Globe,
  BrainCircuit,
  Compass,
  MapPin,
  HandCoins,
  Search,
  Sparkles,
  Brain,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useProactiveInsights } from "@/hooks/useProactiveInsights";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useReducedMotion } from "@/lib/motion";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { useLefty } from "@/hooks/useLefty";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, STORAGE_KEY } from "@/i18n";
import { SearchDialog } from "@/components/search/SearchDialog";
import { useWendy } from "@/contexts/WendyProvider";
import { NAV_LABELS } from "@/lib/constants";

const BASE = import.meta.env.BASE_URL || "/";

const LANG_LABELS: Record<string, string> = {
  it: "Italiano",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

const JOURNEY_LABELS: Record<string, { label: string; color: string }> = {
  indeciso: {
    label: "Indeciso",
    color: "text-primary bg-primary/10 border-primary/30",
  },
  dipendente: {
    label: "Dipendente",
    color: "text-growth bg-growth/10 border-growth/30",
  },
  autonomo: {
    label: "Autonomo",
    color: "text-primary bg-primary/10 border-primary/30",
  },
  azienda: {
    label: "Azienda",
    color: "text-growth bg-growth/10 border-growth/30",
  },
  investitore: {
    label: "Investitore",
    color: "text-primary bg-primary/10 border-primary/30",
  },
};

type NavPhase = 'guest' | 'new-user' | 'indeciso' | 'dipendente' | 'autonomo' | 'azienda' | 'investitore';

/**
 * Mappa path → factory di import dinamico.
 * Il browser esegue il fetch del chunk JS solo al primo hover;
 * le chiamate successive sono no-op perché il modulo è già in cache.
 */
const PREFETCH_MAP: Record<string, () => Promise<unknown>> = {
  "/test": () => import("@/pages/test"),
  "/settori": () => import("@/pages/settori"),
  "/ruoli": () => import("@/pages/ruoli"),
  "/lavori": () => import("@/pages/lavori"),
  "/crescita": () => import("@/pages/growth"),
  "/news": () => import("@/pages/news"),
  "/premium": () => import("@/pages/premium"),
  // Rotte autenticate
  "/percorso": () => import("@/pages/percorso"),
  "/profilo": () => import("@/pages/profilo"),
  "/candidature": () => import("@/pages/applications"),
  "/calendario": () => import("@/pages/calendar"),
  "/amici": () => import("@/pages/amici"),
  "/affiliazione/dashboard": () => import("@/pages/affiliazione-dashboard"),
  "/chi-siamo": () => import("@/pages/chi-siamo"),
  "/come-funziona": () => import("@/pages/come-funziona"),
  "/dashboard": () => import("@/pages/dashboard"),
  "/archivio": () => import("@/pages/grafo-conoscenza"),
  "/affiliazione": () => import("@/pages/affiliazione"),
};

function prefetchRoute(path: string) {
  PREFETCH_MAP[path]?.();
}

export function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, logout, isLoggedIn } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const [pendingFriends, setPendingFriends] = useState<number | null>(null);
  const prefersReduced = useReducedMotion();
  const search = useGlobalSearch();
  const wendy = useWendy();
  const { isLefty } = useLefty();
  const [newsTitles, setNewsTitles] = useState<string[]>([]);
  const { unreadCount: insightsUnread } = useProactiveInsights();

  const phase: NavPhase = !isLoggedIn ? 'guest'
    : !user?.journeyType ? 'new-user'
    : ['indeciso', 'dipendente', 'autonomo', 'azienda', 'investitore'].includes(user.journeyType) ? user.journeyType as NavPhase
    : 'new-user';

  const JOURNEY_CATEGORIES: Record<string, string[]> = {
    guest: ["technology", "business", "education"],
    "new-user": ["technology", "education", "general"],
    indeciso: ["education", "technology", "general"],
    dipendente: ["technology", "business", "education"],
    autonomo: ["business", "technology", "finance"],
    azienda: ["business", "finance", "technology"],
    investitore: ["finance", "business", "technology"],
  };

  useEffect(() => {
    const cats = (JOURNEY_CATEGORIES[phase] ?? JOURNEY_CATEGORIES.guest).join(",");
    const base = import.meta.env.BASE_URL || "/";
    fetch(`${base}api/news?multi=true&categories=${cats}&perCategory=2`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.news?.length) {
          setNewsTitles(data.news.map((n: { title: string }) => n.title));
        }
      })
      .catch(() => {});
  }, [phase]);

  const PHASE_LINKS: Record<NavPhase, Array<{ href: string; label: string; icon: LucideIcon }>> = {
    guest: [
      { href: "/chi-siamo", label: NAV_LABELS.chiSiamo, icon: Users },
      { href: "/come-funziona", label: NAV_LABELS.comeFunziona, icon: BookOpenText },
      { href: "/test", label: NAV_LABELS.test, icon: FlaskConical },
      { href: "/settori", label: NAV_LABELS.aree, icon: Layers },
    ],
    "new-user": [
      { href: "/test", label: NAV_LABELS.test, icon: FlaskConical },
      { href: "/settori", label: NAV_LABELS.aree, icon: Layers },
      { href: "/percorso", label: NAV_LABELS.piano, icon: MapPin },
    ],
    indeciso: [
      { href: "/test", label: NAV_LABELS.test, icon: FlaskConical },
      { href: "/settori", label: NAV_LABELS.aree, icon: Layers },
      { href: "/ruoli", label: NAV_LABELS.lavori, icon: Briefcase },
      { href: "/lavori", label: NAV_LABELS.offerte, icon: MapPin },
    ],
    dipendente: [
      { href: "/dashboard", label: NAV_LABELS.dashboard, icon: LayoutDashboard },
      { href: "/lavori", label: NAV_LABELS.offerte, icon: MapPin },
      { href: "/crescita", label: NAV_LABELS.crescita, icon: BookOpenText },
    ],
    autonomo: [
      { href: "/dashboard", label: NAV_LABELS.dashboard, icon: LayoutDashboard },
      { href: "/settori", label: NAV_LABELS.aree, icon: Layers },
      { href: "/news", label: NAV_LABELS.news, icon: Newspaper },
    ],
    azienda: [
      { href: "/dashboard", label: NAV_LABELS.dashboard, icon: LayoutDashboard },
      { href: "/settori", label: NAV_LABELS.aree, icon: Layers },
      { href: "/affiliazione", label: NAV_LABELS.partner, icon: HandCoins },
      { href: "/crescita", label: NAV_LABELS.crescita, icon: BookOpenText },
      { href: "/news", label: NAV_LABELS.news, icon: Newspaper },
    ],
    investitore: [
      { href: "/dashboard", label: NAV_LABELS.dashboard, icon: LayoutDashboard },
      { href: "/settori", label: NAV_LABELS.aree, icon: Layers },
      { href: "/archivio", label: NAV_LABELS.mappa, icon: Compass },
      { href: "/news", label: NAV_LABELS.news, icon: Newspaper },
      { href: "/crescita", label: NAV_LABELS.crescita, icon: BookOpenText },
    ],
  };

  const navLinks = PHASE_LINKS[phase];

  useState(() => {
    if (!user?.id) return;
    fetch(`${BASE}api/friends/${user.id}`)
      .then((res) => res.json())
      .then((data) =>
        setPendingFriends(
          Array.isArray(data.incoming) ? data.incoming.length : 0,
        ),
      )
      .catch(() => setPendingFriends(0));
  });

  const friendsBadge =
    pendingFriends && pendingFriends > 0 ? pendingFriends : null;

  // true se l'utente è un affiliato (campo opzionale — fallback: visibile a tutti i loggati)
  const isAffiliate = user ? (user.isAffiliate ?? true) : false;

  function changeLanguage(lang: string) {
    i18n.changeLanguage(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }

  const currentLang = i18n.language?.slice(0, 2).toUpperCase() ?? "IT";

  return (
    <LazyMotion features={domAnimation} strict>
      <m.header
        className="fixed bottom-4 left-0 right-0 z-40 flex justify-center px-4"
        initial={prefersReduced ? {} : { y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="pill-nav flex items-center h-10 md:h-11 px-1 gap-0.5 w-full max-w-5xl">
          {/* Logo — link to dashboard */}
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 shrink-0 px-1.5"
          >
            <div className="relative">
              <img
                src="/logo.svg"
                alt="NorthStar"
                className="h-7 w-7 rounded-full object-cover"
                style={{
                  filter: location === "/dashboard" || location.startsWith("/dashboard/")
                    ? "brightness(0) saturate(100%) sepia(60%) hue-rotate(5deg) brightness(85%)"
                    : "none",
                  opacity: location === "/dashboard" || location.startsWith("/dashboard/")
                    ? 1
                    : 0.85,
                }}
              />
              {(location === "/dashboard" || location.startsWith("/dashboard/")) && (
                <m.div
                  className="absolute -inset-1.5 rounded-full blur-sm opacity-40"
                  style={{
                    background: "conic-gradient(from 0deg, #c19e4a, #7db89a, #5a9fd4, #9b80cc, #d96e66, #c19e4a)",
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                />
              )}
            </div>
            <span
              className={`font-bold text-sm tracking-tight hidden sm:block transition-colors duration-200 ${
                location === "/dashboard" || location.startsWith("/dashboard/")
                  ? "text-primary"
                  : "text-foreground"
              }`}
            >
              NorthStar
            </span>
          </Link>

          {/* Scrolling news ticker — clickable, fills space between logo and search */}
          <Link
            href="/news"
            className="hidden md:flex items-center gap-1 flex-1 min-w-0 overflow-hidden hover:opacity-80 transition-opacity ml-1"
          >
            <Newspaper className="h-2.5 w-2.5 shrink-0 text-primary hidden sm:block" />
            <div className="relative overflow-hidden w-full h-4">
              <m.div
                className="absolute whitespace-nowrap flex text-[10px] sm:text-[11px] leading-none text-muted-foreground font-medium"
                animate={newsTitles.length > 0 ? { x: ["0%", "-50%"] } : {}}
                transition={{
                  duration: 35,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                <span className="flex gap-6 shrink-0">
                  {newsTitles.length > 0
                    ? newsTitles.map((t, i) => (
                        <span key={i} className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-primary/50 shrink-0" />
                          <span className="truncate max-w-[180px] sm:max-w-[280px]">{t}</span>
                        </span>
                      ))
                    : "Caricamento notizie..."}
                </span>
                <span className="flex gap-6 shrink-0">
                  {newsTitles.length > 0
                    ? newsTitles.map((t, i) => (
                        <span key={i} className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-primary/50 shrink-0" />
                          <span className="truncate max-w-[180px] sm:max-w-[280px]">{t}</span>
                        </span>
                      ))
                    : "Caricamento notizie..."}
                </span>
              </m.div>
            </div>
          </Link>

          {/* Search trigger */}
          <div className="hidden md:flex flex-[2] items-center px-3">
            <button
              onClick={() => search.setIsOpen(true)}
              className="relative w-full group"
            >
              <div className="absolute left-2.5 lefty:left-auto lefty:right-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                {wendy.phase === 'thinking' || wendy.phase === 'speaking' ? (
                  <m.div
                    className="h-5 w-5 rounded-full"
                    style={{
                      background: "conic-gradient(from 0deg, #c19e4a, #7db89a, #5a9fd4, #9b80cc, #d96e66, #c19e4a)",
                      WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px))",
                      mask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px))",
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  />
                ) : (
                  <img
                    src="/logo.svg"
                    alt=""
                    className="h-5 w-5 rounded-full object-cover opacity-30"
                  />
                )}
              </div>
              {wendy.phase === 'thinking' || wendy.phase === 'speaking' ? (
                <>
                  <m.div
                    className="absolute inset-0 rounded-full opacity-40 blur-md"
                    style={{
                      background: "conic-gradient(from 0deg, #c19e4a, #7db89a, #5a9fd4, #9b80cc, #d96e66, #c19e4a)",
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  />
                  <m.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: "conic-gradient(from 0deg, #c19e4a, #7db89a, #5a9fd4, #9b80cc, #d96e66, #c19e4a)",
                      WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px))",
                      mask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px))",
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  />
                </>
              ) : null}
              <span className={`flex items-center w-full pl-9 pr-4 lefty:pl-4 lefty:pr-9 py-2 rounded-full bg-white/5 border text-sm text-muted-foreground/50 text-left transition-all group-hover:bg-white/10 group-hover:border-white/20 ${wendy.isOpen ? 'border-primary/30' : 'border-white/10'} ${wendy.phase === 'thinking' || wendy.phase === 'speaking' ? 'border-transparent' : ''}`}>
                <span className="flex-1">{t("search.placeholder")}</span>
                <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </span>
            </button>
          </div>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {navLinks.map(({ href, label }) => {
              const isActive =
                location === href || location.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  onMouseEnter={() => prefetchRoute(href)}
                  onFocus={() => prefetchRoute(href)}
                  className={`relative text-xs font-semibold tracking-wide px-2.5 py-1 rounded-full transition-all duration-200 uppercase whitespace-nowrap ${
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="hidden md:flex items-center gap-1 ml-auto lefty:ml-0 lefty:mr-auto">
            {/* Language pill */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-xs font-semibold border border-white/10 rounded-full px-2 py-0.5 text-muted-foreground hover:text-foreground hover:border-white/20 transition-all">
                  <Globe className="h-3 w-3" />
                  {currentLang}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-36 bg-card border-border"
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  {t("nav.language")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <DropdownMenuItem
                    key={lang}
                    onClick={() => changeLanguage(lang)}
                    className={`cursor-pointer text-sm ${i18n.language?.startsWith(lang) ? "font-semibold text-primary" : ""}`}
                  >
                    {LANG_LABELS[lang]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {isLoggedIn && user ? (
              <>
                <NotificationBell userId={user.id} />
                {insightsUnread > 0 && (
                  <Link href="/dashboard">
                    <button
                      aria-label={`${insightsUnread} insight da Wendy`}
                      className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-amber-500/10 transition-colors"
                    >
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-4 h-4 rounded-full bg-amber-500 text-[10px] font-bold text-white px-1 leading-none">
                        {insightsUnread > 9 ? "9+" : insightsUnread}
                      </span>
                    </button>
                  </Link>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <m.button
                      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all"
                      onMouseEnter={() => {
                        prefetchRoute("/profilo");
                        prefetchRoute("/percorso");
                        prefetchRoute("/candidature");
                        if (isAffiliate)
                          prefetchRoute("/affiliazione/dashboard");
                      }}
                      whileHover={prefersReduced ? {} : { scale: 1.02 }}
                      whileTap={prefersReduced ? {} : { scale: 0.98 }}
                    >
                      <User className="h-3.5 w-3.5 text-primary" />
                      <span className="max-w-20 truncate">{user.name}</span>
                    </m.button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 bg-card border-border"
                  >
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-sm text-foreground">
                          {user.name}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </span>
                        {user.journeyType &&
                          JOURNEY_LABELS[user.journeyType] && (
                            <span
                              className={`inline-flex w-fit text-xs font-semibold px-2 py-0.5 rounded-full border mt-0.5 ${JOURNEY_LABELS[user.journeyType].color}`}
                            >
                              {JOURNEY_LABELS[user.journeyType].label}
                            </span>
                          )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setLocation("/percorso")}
                      className="cursor-pointer"
                    >
                      <MapPin className="h-4 w-4 mr-2 lefty:mr-0 lefty:ml-2 text-primary" /> Il mio
                      percorso
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setLocation("/profilo")}
                      className="cursor-pointer"
                    >
                      <LayoutDashboard className="h-4 w-4 mr-2 lefty:mr-0 lefty:ml-2" />{" "}
                      {t("nav.myProfile")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setLocation("/candidature")}
                      className="cursor-pointer"
                    >
                      <Briefcase className="h-4 w-4 mr-2 lefty:mr-0 lefty:ml-2" />{" "}
                      {t("nav.applications")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setLocation("/calendario")}
                      onMouseEnter={() => prefetchRoute("/calendario")}
                      className="cursor-pointer"
                    >
                      <Calendar className="h-4 w-4 mr-2 lefty:mr-0 lefty:ml-2" /> {t("nav.calendar")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => wendy.open()}
                      className="cursor-pointer"
                    >
                      <BrainCircuit className="h-4 w-4 mr-2 lefty:mr-0 lefty:ml-2 text-primary" /> Chiedi a Wendy
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setLocation("/wendy/memoria")}
                      onMouseEnter={() => prefetchRoute("/wendy/memoria")}
                      className="cursor-pointer text-xs text-muted-foreground"
                    >
                      <Brain className="h-4 w-4 mr-2 lefty:mr-0 lefty:ml-2" /> Memoria di Wendy
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5">
                      <p className="text-xs text-muted-foreground mb-1.5 font-semibold uppercase tracking-wide">Tema</p>
                      <ThemeToggle />
                    </div>
                    {/* Partner */}
                    {isAffiliate && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setLocation("/affiliazione/dashboard")}
                          onMouseEnter={() =>
                            prefetchRoute("/affiliazione/dashboard")
                          }
                          className="cursor-pointer text-primary focus:text-primary"
                        >
                          <HandCoins className="h-4 w-4 mr-2 lefty:mr-0 lefty:ml-2" /> {NAV_LABELS.partner}
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={logout}
                      className="text-destructive focus:text-destructive cursor-pointer"
                    >
                      <LogOut className="h-4 w-4 mr-2 lefty:mr-0 lefty:ml-2" /> {t("nav.logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <button
                  onClick={() => setLoginOpen(true)}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-2"
                >
                  {t("nav.login")}
                </button>
                <Link href="/test" onMouseEnter={() => prefetchRoute("/test")}>
                  <div className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-full px-3 py-1 hover:bg-primary/90 transition-colors">
                    {t("nav.startJourney")}
                  </div>
                </Link>
              </>
            )}
          </div>

          {/* Mobile search + right */}
          <div className="flex md:hidden items-center gap-1 flex-1 justify-end">
            <div
              className="relative flex-1 max-w-40 sm:max-w-55 cursor-pointer"
              onClick={() => search.setIsOpen(true)}
            >
              <span className="absolute left-2.5 lefty:left-auto lefty:right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <img src="/logo.svg" alt="" className="h-4 w-4 rounded-full object-cover opacity-40" />
              </span>
              <input
                readOnly
                type="text"
                placeholder="Cerca..."
                className="w-full pl-8 pr-2.5 lefty:pl-2.5 lefty:pr-8 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-all pointer-events-none"
              />
            </div>
            {isLoggedIn && user && <NotificationBell userId={user.id} />}

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <m.button
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-border hover:border-primary/40 hover:bg-primary/5 transition-all"
                  whileTap={prefersReduced ? {} : { scale: 0.9 }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {menuOpen ? (
                      <m.span
                        key="close"
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <X className="h-4 w-4 text-foreground" />
                      </m.span>
                    ) : (
                      <m.span
                        key="menu"
                        initial={{ rotate: 90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: -90, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <Menu className="h-4 w-4 text-foreground" />
                      </m.span>
                    )}
                  </AnimatePresence>
                </m.button>
              </SheetTrigger>

              <SheetContent
                side={isLefty ? "left" : "right"}
                className="w-72 p-0 flex flex-col bg-card border-border"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <Link
                  href="/"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2"
                >
                  <img
                    src="/logo.svg"
                    alt="NorthStar"
                    className="h-7 w-7 rounded-full object-cover"
                  />
                  <span className="font-bold text-sm text-foreground">
                    NorthStar
                  </span>
                </Link>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-1 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                  {navLinks.map(({ href, label, icon: Icon }, i) => {
                    const isActive = location === href;
                    return (
                      <m.div
                        key={href}
                        initial={prefersReduced ? {} : { opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: i * 0.04,
                          duration: 0.3,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      >
                        <Link
                          href={href}
                          onClick={() => setMenuOpen(false)}
                          onFocus={() => prefetchRoute(href)}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-wide transition-colors ${
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {label}
                        </Link>
                      </m.div>
                    );
                  })}

                  <div className="pt-3 px-4">
                    <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">
                      {t("nav.language")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <button
                          key={lang}
                          onClick={() => changeLanguage(lang)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors font-semibold ${
                            i18n.language?.startsWith(lang)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                          }`}
                        >
                          {lang.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </nav>

                <div className="px-5 pb-8 pt-4 border-t border-border space-y-2">
                  {isLoggedIn && user ? (
                    <>
                      <div className="flex items-center gap-3 px-1 mb-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate text-foreground">
                            {user.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setLocation("/profilo");
                          setMenuOpen(false);
                        }}
                        onMouseEnter={() => prefetchRoute("/profilo")}
                        className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                      >
                        <LayoutDashboard className="h-4 w-4" />{" "}
                        {t("nav.myProfile")}
                      </button>
                      <button
                        onClick={() => {
                          setLocation("/candidature");
                          setMenuOpen(false);
                        }}
                        onMouseEnter={() => prefetchRoute("/candidature")}
                        className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                      >
                        <Briefcase className="h-4 w-4" />{" "}
                        {t("nav.applications")}
                      </button>
                      <button
                        onClick={() => {
                          setLocation("/percorso");
                          setMenuOpen(false);
                        }}
                        onMouseEnter={() => prefetchRoute("/percorso")}
                        className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-primary hover:text-foreground hover:bg-primary/5 transition-colors font-semibold"
                      >
                        <MapPin className="h-4 w-4" /> {NAV_LABELS.piano}
                      </button>
                      <button
                        onClick={() => {
                          setLocation("/validatore-idea");
                          setMenuOpen(false);
                        }}
                        onMouseEnter={() => prefetchRoute("/validatore-idea")}
                        className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                      >
                        <Compass className="h-4 w-4" /> {NAV_LABELS.idea}
                      </button>
                      <button
                        onClick={() => {
                          setLocation("/amici");
                          setMenuOpen(false);
                        }}
                        onMouseEnter={() => prefetchRoute("/amici")}
                        className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                      >
                        <Users className="h-4 w-4" /> {t("nav.friends")}
                        {friendsBadge && (
                          <span className="ml-auto text-xs font-semibold text-primary">
                            {friendsBadge}
                          </span>
                        )}
                      </button>
                      {/* Wendy Insights (mobile) */}
                      {insightsUnread > 0 && (
                        <button
                          onClick={() => {
                            setLocation("/dashboard");
                            setMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-amber-500 hover:text-amber-600 hover:bg-amber-500/5 transition-colors font-semibold"
                        >
                          <Sparkles className="h-4 w-4" />
                          Wendy ha {insightsUnread} insight per te
                        </button>
                      )}
                      {/* Partner (mobile) */}
                      {isAffiliate && (
                        <button
                          onClick={() => {
                            setLocation("/affiliazione/dashboard");
                            setMenuOpen(false);
                          }}
                          onMouseEnter={() =>
                            prefetchRoute("/affiliazione/dashboard")
                          }
                          className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-primary hover:text-foreground hover:bg-primary/5 transition-colors font-semibold"
                        >
                          <HandCoins className="h-4 w-4" /> {NAV_LABELS.partner}
                        </button>
                      )}
                      {/* Theme toggle (mobile) */}
                      <div className="px-2 py-1">
                        <p className="text-xs text-muted-foreground mb-1.5 font-semibold uppercase tracking-wide px-2">Tema</p>
                        <ThemeToggle />
                      </div>
                      <button
                        onClick={() => {
                          logout();
                          setMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-destructive/80 hover:text-destructive hover:bg-destructive/5 transition-colors"
                      >
                        <LogOut className="h-4 w-4" /> {t("nav.logout")}
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/test"
                        onClick={() => setMenuOpen(false)}
                        onMouseEnter={() => prefetchRoute("/test")}
                        className="w-full flex items-center justify-center bg-primary text-primary-foreground text-sm font-bold rounded-full py-2.5 hover:bg-primary/90 transition-colors"
                      >
                        {t("nav.startFreeTest")}
                      </Link>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setTimeout(() => setLoginOpen(true), 150);
                        }}
                        className="w-full flex items-center justify-center border border-border text-sm font-semibold rounded-full py-2.5 text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
                      >
                        {t("nav.login")}
                      </button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </m.header>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      <SearchDialog
        query={search.query}
        setQuery={search.setQuery}
        results={search.results}
        suggestions={search.suggestions}
        route={search.route}
        hasSemantic={search.hasSemantic}
        isLoading={search.isLoading}
        isOpen={search.isOpen}
        setIsOpen={search.setIsOpen}
        close={search.close}
        trackClick={search.trackClick}
        aiTokens={search.aiTokens}
        aiStatus={search.aiStatus}
        aiSources={search.aiSources}
        isStreaming={search.isStreaming}
        sendFollowUp={search.sendFollowUp}
      />
    </LazyMotion>
  );
}
