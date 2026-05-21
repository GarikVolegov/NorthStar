import { AffiliateInviteCard } from "@/components/affiliate/AffiliateInviteCard";
import { SearchDialog } from "@/components/search/SearchDialog";
import { SubscriptionChip } from "@/components/subscription/SubscriptionStatus";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useWendy } from "@/contexts/WendyProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAffiliateInvitePreview } from "@/hooks/useAffiliateInvitePreview";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { useProactiveInsights } from "@/hooks/useProactiveInsights";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { apiFetch } from "@/lib/api-fetch";
import { getJson } from "@/lib/apiClient";
import { NAV_LABELS } from "@/lib/constants";
import { useReducedMotion } from "@/lib/motion";
import { useClerk } from "@clerk/react";
import { LazyMotion, domAnimation, m } from "framer-motion";
import {
  Brain,
  Briefcase,
  Globe2,
  LogOut,
  MapPin,
  Menu,
  Monitor,
  Moon,
  Newspaper,
  Settings,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

const LANGUAGE_LABELS: Record<string, string> = {
  it: "Italiano",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

const MOBILE_THEME_OPTIONS = [
  { value: "system", label: "Auto", icon: Monitor },
  { value: "light", label: "Chiaro", icon: Sun },
  { value: "dark", label: "Scuro", icon: Moon },
] as const;

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

type NavPhase =
  | "guest"
  | "new-user"
  | "indeciso"
  | "dipendente"
  | "autonomo"
  | "azienda"
  | "investitore";

const PREFETCH_MAP: Record<string, () => Promise<unknown>> = {
  "/news": () => import("@/pages/news"),
  "/percorso": () => import("@/pages/percorso"),
  "/profilo": () => import("@/pages/profilo"),
  "/candidature": () => import("@/pages/applications"),
  "/dashboard": () => import("@/pages/dashboard"),
  "/affiliazione/dashboard": () => import("@/pages/affiliazione-dashboard"),
  "/wendy/memoria": () => import("@/pages/memoria-wendy"),
  "/profilo/briefing": () => import("@/pages/briefing"),
  "/workspace": () => import("@/pages/workspace"),
  "/sign-in": () => import("@/pages/sign-in"),
};

function prefetchRoute(path: string) {
  PREFETCH_MAP[path]?.();
}

export function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, isLoggedIn } = useAuth();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const prefersReduced = useReducedMotion();
  const search = useGlobalSearch();
  const wendy = useWendy();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();
  const [newsTitles, setNewsTitles] = useState<string[]>([]);
  const [profileBannerUrl, setProfileBannerUrl] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [affiliateLinkCopied, setAffiliateLinkCopied] = useState(false);
  const affiliatePreview = useAffiliateInvitePreview(
    profileMenuOpen,
    isLoggedIn && !!user?.id,
  );
  const { unreadCount: insightsUnread } = useProactiveInsights();
  const searchIsOpen = search.isOpen;
  const setSearchIsOpen = search.setIsOpen;

  const phase: NavPhase = !isLoggedIn
    ? "guest"
    : !user?.journeyType
      ? "new-user"
      : [
            "indeciso",
            "dipendente",
            "autonomo",
            "azienda",
            "investitore",
          ].includes(user.journeyType)
        ? (user.journeyType as NavPhase)
        : "new-user";

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
    const cats = (
      JOURNEY_CATEGORIES[phase] ??
      JOURNEY_CATEGORIES.guest ??
      []
    ).join(",");

    getJson<{ news?: Array<{ title: string }> }>(`${BASE}api/news?multi=true&categories=${cats}&perCategory=2`)
      .then((data) => {
        if (data?.news?.length) {
          setNewsTitles(data.news.map((item) => item.title));
        }
      })
      .catch(() => {});
  }, [phase]);

  const isWendyActive =
    wendy.phase === "thinking" || wendy.phase === "speaking";
  const displayName = user?.name || user?.email || NAV_LABELS.profilo;
  const initial = displayName.trim().charAt(0).toUpperCase() || "N";
  const activeLanguage =
    i18n.resolvedLanguage?.slice(0, 2) || i18n.language?.slice(0, 2) || "it";
  const mobileMenuScale = !isMobile
    ? 1
    : viewportHeight > 0 && viewportHeight < 640
      ? 0.78
      : viewportHeight > 0 && viewportHeight < 740
        ? 0.84
        : viewportHeight > 0 && viewportHeight < 860
          ? 0.9
          : 1;

  const goToProfilePath = (path: string) => {
    setProfileMenuOpen(false);
    setLocation(path);
  };

  useEffect(() => {
    if (!isLoggedIn || !user?.id) {
      setProfileBannerUrl(null);
      return;
    }

    let cancelled = false;
    apiFetch(`${BASE}api/profile/${user.id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { bannerUrl?: string | null } | null) => {
        if (!cancelled) setProfileBannerUrl(data?.bannerUrl ?? null);
      })
      .catch(() => {
        if (!cancelled) setProfileBannerUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user?.id]);

  useEffect(() => {
    if (!isMobile) {
      setViewportHeight(0);
      return;
    }

    const updateViewportHeight = () => setViewportHeight(window.innerHeight);
    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    window.addEventListener("orientationchange", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("orientationchange", updateViewportHeight);
    };
  }, [isMobile]);

  useEffect(() => {
    if (wendy.isOpen && !searchIsOpen) {
      setSearchIsOpen(true);
    }
  }, [searchIsOpen, setSearchIsOpen, wendy.isOpen]);

  const copyAffiliateLink = async () => {
    if (!affiliatePreview.referralLink) return;
    try {
      await navigator.clipboard.writeText(affiliatePreview.referralLink);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = affiliatePreview.referralLink;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setAffiliateLinkCopied(true);
    window.setTimeout(() => setAffiliateLinkCopied(false), 1800);
  };

  const shareAffiliateLink = async () => {
    if (!affiliatePreview.referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Invito NorthStar",
          text: "Iscriviti a NorthStar tramite il mio link.",
          url: affiliatePreview.referralLink,
        });
        return;
      } catch {
        // Se l'utente annulla lo share nativo, lasciamo disponibile la copia.
      }
    }
    await copyAffiliateLink();
  };

  const renderAffiliateInviteBlock = (compact = false) => (
    <AffiliateInviteCard
      preview={affiliatePreview}
      copied={affiliateLinkCopied}
      compact={compact}
      onCopy={() => void copyAffiliateLink()}
      onShare={() => void shareAffiliateLink()}
      onOpenDashboard={() => goToProfilePath("/affiliazione/dashboard")}
      onPrefetchDashboard={() => prefetchRoute("/affiliazione/dashboard")}
    />
  );

  const profileMenuBody = user ? (
    <>
      <DropdownMenuLabel className="p-0 font-normal">
        <div className="h-12 overflow-hidden bg-muted">
          {profileBannerUrl ? (
            <img
              src={profileBannerUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.28),transparent_35%),linear-gradient(135deg,hsl(var(--muted)),hsl(var(--background)))]" />
          )}
        </div>
        <div className="px-3 pb-2 pt-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-primary/10 text-sm font-bold text-primary shadow-sm">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initial
              )}
            </span>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-5 text-foreground">
                {displayName}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {user.email}
              </span>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {user.journeyType && JOURNEY_LABELS[user.journeyType] && (
                  <span
                    className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-semibold ${JOURNEY_LABELS[user.journeyType]?.color ?? ""}`}
                  >
                    {JOURNEY_LABELS[user.journeyType]?.label}
                  </span>
                )}
                <SubscriptionChip />
              </div>
            </div>
          </div>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => goToProfilePath("/profilo#impostazioni")}
        onMouseEnter={() => prefetchRoute("/profilo")}
        onFocus={() => prefetchRoute("/profilo")}
        className="min-h-9 cursor-pointer"
      >
        <Settings className="mr-2 h-4 w-4 text-primary" />
        Impostazioni profilo
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {insightsUnread > 0 && (
        <>
          <DropdownMenuItem
            onClick={() => goToProfilePath("/dashboard")}
            className="min-h-9 cursor-pointer text-amber-500 focus:text-amber-600"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Wendy ha {insightsUnread > 9 ? "9+" : insightsUnread} insight
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      )}
      {!user.journeyType && (
        <DropdownMenuItem
          onClick={() => goToProfilePath("/percorso")}
          onMouseEnter={() => prefetchRoute("/percorso")}
          className="min-h-9 cursor-pointer"
        >
          <MapPin className="mr-2 h-4 w-4 text-primary" />
          Imposta percorso
        </DropdownMenuItem>
      )}
      <DropdownMenuItem
        onClick={() => goToProfilePath("/candidature")}
        className="min-h-9 cursor-pointer"
      >
        <Briefcase className="mr-2 h-4 w-4" />
        {t("nav.applications")}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => goToProfilePath("/wendy/memoria")}
        onMouseEnter={() => prefetchRoute("/wendy/memoria")}
        className="min-h-9 cursor-pointer text-sm text-muted-foreground"
      >
        <Brain className="mr-2 h-4 w-4" />
        Memoria di Wendy
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => goToProfilePath("/profilo/briefing")}
        onMouseEnter={() => prefetchRoute("/profilo/briefing")}
        className="min-h-9 cursor-pointer text-sm text-muted-foreground"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        Briefing Wendy
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => goToProfilePath("/workspace")}
        onMouseEnter={() => prefetchRoute("/workspace")}
        className="min-h-9 cursor-pointer text-sm text-muted-foreground"
      >
        <Users className="mr-2 h-4 w-4" />
        Workspace
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <div className="flex min-h-9 items-center gap-2 px-2 py-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tema
        </p>
        <div className="ml-auto grid grid-cols-3 gap-1">
          {MOBILE_THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = (theme ?? "system") === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={`flex min-h-7 items-center justify-center gap-1 rounded-full border px-2 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <DropdownMenuSeparator />
      <div className="flex min-h-9 items-center gap-2 px-2 py-1">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Globe2 className="h-4 w-4 shrink-0" />
          <span>Lingua</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {SUPPORTED_LANGUAGES.map((code) => {
            const active = activeLanguage === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => void i18n.changeLanguage(code)}
                className={`min-h-7 rounded-full border px-2 text-[10px] font-bold uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
                aria-label={`Cambia lingua in ${LANGUAGE_LABELS[code] ?? code.toUpperCase()}`}
              >
                {code.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>
      <DropdownMenuSeparator />
      {renderAffiliateInviteBlock(true)}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => {
          setProfileMenuOpen(false);
          void signOut();
        }}
        className="min-h-9 cursor-pointer text-destructive focus:text-destructive"
      >
        <LogOut className="mr-2 h-4 w-4" />
        {t("nav.logout")}
      </DropdownMenuItem>
    </>
  ) : null;

  const profileMenuMobileBody = user ? (
    <>
      <div className="p-0 font-normal">
        <div className="h-12 overflow-hidden bg-muted">
          {profileBannerUrl ? (
            <img
              src={profileBannerUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.28),transparent_35%),linear-gradient(135deg,hsl(var(--muted)),hsl(var(--background)))]" />
          )}
        </div>
        <div className="px-3 pb-2 pt-2">
          <div className="flex items-center gap-2">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-primary/10 text-sm font-bold text-primary shadow-sm">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initial
              )}
            </span>
            <div className="min-w-0">
              <span className="block truncate text-[15px] font-semibold leading-5 text-foreground">
                {displayName}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {user.email}
              </span>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {user.journeyType && JOURNEY_LABELS[user.journeyType] && (
                  <span
                    className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold ${JOURNEY_LABELS[user.journeyType]?.color ?? ""}`}
                  >
                    {JOURNEY_LABELS[user.journeyType]?.label}
                  </span>
                )}
                <SubscriptionChip />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="h-px bg-border" />
      <div className="px-2 py-1">
        <button
          type="button"
          onClick={() => goToProfilePath("/profilo#impostazioni")}
          onMouseEnter={() => prefetchRoute("/profilo")}
          onFocus={() => prefetchRoute("/profilo")}
          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <Settings className="h-4 w-4 text-primary" />
          Impostazioni profilo
        </button>
        {insightsUnread > 0 && (
          <button
            type="button"
            onClick={() => goToProfilePath("/dashboard")}
            className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium text-amber-500 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <Sparkles className="h-4 w-4" />
            Wendy ha {insightsUnread > 9 ? "9+" : insightsUnread} insight
          </button>
        )}
        {!user.journeyType && (
          <button
            type="button"
            onClick={() => goToProfilePath("/percorso")}
            onMouseEnter={() => prefetchRoute("/percorso")}
            className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <MapPin className="h-4 w-4 text-primary" />
            Imposta percorso
          </button>
        )}
        <button
          type="button"
          onClick={() => goToProfilePath("/candidature")}
          className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <Briefcase className="h-4 w-4" />
          {t("nav.applications")}
        </button>
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          {[
            { label: "Memoria", icon: Brain, path: "/wendy/memoria" },
            { label: "Briefing", icon: Sparkles, path: "/profilo/briefing" },
            { label: "Workspace", icon: Users, path: "/workspace" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => goToProfilePath(item.path)}
                onMouseEnter={() => prefetchRoute(item.path)}
                className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg border border-border/70 bg-background/60 px-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="h-px bg-border" />
      <div className="space-y-1 px-2 py-1.5">
        <div className="flex min-h-9 items-center gap-2">
          <p className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tema
          </p>
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
            {MOBILE_THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = (theme ?? "system") === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={`flex min-h-9 items-center justify-center gap-1 rounded-full border px-1.5 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex min-h-9 items-center gap-2">
          <div className="flex w-16 shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Globe2 className="h-3.5 w-3.5 shrink-0" />
            <span>Lingua</span>
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-5 gap-1">
            {SUPPORTED_LANGUAGES.map((code) => {
              const active = activeLanguage === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => void i18n.changeLanguage(code)}
                  className={`min-h-9 rounded-full border px-1 text-[10px] font-bold uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label={`Cambia lingua in ${LANGUAGE_LABELS[code] ?? code.toUpperCase()}`}
                >
                  {code.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="h-px bg-border" />
      {renderAffiliateInviteBlock(true)}
      <div className="h-px bg-border" />
      <button
        type="button"
        onClick={() => {
          setProfileMenuOpen(false);
          void signOut();
        }}
        className="mx-2 my-1 flex min-h-10 w-[calc(100%-1rem)] items-center gap-2 rounded-lg px-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        <LogOut className="h-4 w-4" />
        {t("nav.logout")}
      </button>
    </>
  ) : null;

  return (
    <LazyMotion features={domAnimation} strict>
      {profileMenuOpen && isMobile && (
        <m.button
          type="button"
          aria-label="Chiudi menu profilo"
          className="fixed inset-0 z-[45] bg-background/35 backdrop-blur-md"
          initial={prefersReduced ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReduced ? {} : { opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setProfileMenuOpen(false)}
        />
      )}
      {profileMenuOpen && isMobile && user && (
        <m.div
          role="dialog"
          aria-modal="true"
          aria-label="Menu profilo"
          className="fixed left-1/2 top-1/2 z-[60] w-[min(348px,calc(100vw-24px))] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
          style={{
            transform: `translate(-50%, -50%) scale(${mobileMenuScale})`,
            transformOrigin: "center",
          }}
          initial={prefersReduced ? {} : { opacity: 0 }}
          animate={prefersReduced ? {} : { opacity: 1 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {profileMenuMobileBody}
        </m.div>
      )}
      <m.header
        className="fixed bottom-4 left-0 right-0 z-40 flex justify-center px-3 sm:px-4"
        initial={prefersReduced ? {} : { y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="pill-nav flex h-14 w-full max-w-5xl items-center gap-2 px-2">
          <Link
            href="/news"
            onMouseEnter={() => prefetchRoute("/news")}
            onFocus={() => prefetchRoute("/news")}
            aria-label="Apri le notizie NorthStar"
            className="hidden h-11 basis-1/2 items-center gap-2 overflow-hidden rounded-full border border-white/10 bg-white/5 px-3 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 md:flex"
          >
            <Newspaper className="h-4 w-4 shrink-0 text-primary" />
            <div className="relative h-5 min-w-0 flex-1 overflow-hidden">
              <m.div
                className="absolute flex whitespace-nowrap text-[11px] font-medium leading-5 text-muted-foreground"
                animate={newsTitles.length > 0 ? { x: ["0%", "-50%"] } : {}}
                transition={{
                  duration: 35,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                {[0, 1].map((group) => (
                  <span key={group} className="flex shrink-0 gap-7">
                    {newsTitles.length > 0
                      ? newsTitles.map((title, index) => (
                          <span
                            key={`${group}-${index}`}
                            className="flex items-center gap-2"
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                            <span className="max-w-[320px] truncate">
                              {title}
                            </span>
                          </span>
                        ))
                      : "Caricamento notizie..."}
                  </span>
                ))}
              </m.div>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => search.setIsOpen(true)}
            aria-label="Apri ricerca Wendy"
            className="group relative h-12 min-w-0 flex-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2">
              {isWendyActive ? (
                <m.div
                  className="h-5 w-5 rounded-full"
                  style={{
                    background:
                      "conic-gradient(from 0deg, #c19e4a, #7db89a, #5a9fd4, #9b80cc, #d96e66, #c19e4a)",
                    WebkitMask:
                      "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px))",
                    mask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px))",
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
              ) : (
                <img
                  src="/logo.svg"
                  alt=""
                  className="h-5 w-5 rounded-full object-cover opacity-40"
                />
              )}
            </div>
            {isWendyActive ? (
              <>
                <m.div
                  className="absolute inset-0 rounded-full opacity-40 blur-md"
                  style={{
                    background:
                      "conic-gradient(from 0deg, #c19e4a, #7db89a, #5a9fd4, #9b80cc, #d96e66, #c19e4a)",
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
                <m.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      "conic-gradient(from 0deg, #c19e4a, #7db89a, #5a9fd4, #9b80cc, #d96e66, #c19e4a)",
                    WebkitMask:
                      "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px))",
                    mask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px))",
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
              </>
            ) : null}
            <span
              className={`flex h-12 w-full items-center rounded-full border bg-card/80 pl-10 pr-3 text-left text-sm text-muted-foreground/80 shadow-sm backdrop-blur-xl transition-all group-hover:border-white/20 group-hover:bg-card/95 group-hover:text-foreground ${
                wendy.isOpen ? "border-primary/30" : "border-white/10"
              } ${isWendyActive ? "border-transparent" : ""}`}
            >
              <span className="min-w-0 flex-1 truncate">Chiedi a Wendy...</span>
              <kbd className="ml-2 hidden items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
                Cmd K
              </kbd>
            </span>
          </button>

          <div className="flex shrink-0 items-center">
            {isLoggedIn && user ? (
              <DropdownMenu
                open={profileMenuOpen}
                onOpenChange={setProfileMenuOpen}
              >
                <DropdownMenuTrigger asChild>
                  <m.button
                    type="button"
                    aria-label={`Apri menu profilo di ${displayName}`}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-0 text-sm font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 sm:w-auto sm:max-w-[14rem] sm:justify-start sm:gap-2 sm:px-2.5 md:max-w-[18rem]"
                    onPointerDown={(event) => {
                      if (!isMobile) return;
                      event.preventDefault();
                      setProfileMenuOpen((open) => !open);
                    }}
                    onMouseEnter={() => {
                      prefetchRoute("/candidature");
                      if (!user.journeyType) prefetchRoute("/percorso");
                      prefetchRoute("/affiliazione/dashboard");
                    }}
                    whileHover={prefersReduced ? {} : { scale: 1.02 }}
                    whileTap={prefersReduced ? {} : { scale: 0.98 }}
                  >
                    <Menu className="h-5 w-5 text-foreground sm:hidden" />
                    <span className="hidden h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/25 bg-primary/10 text-xs font-bold text-primary sm:flex">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initial
                      )}
                    </span>
                    <span className="hidden min-w-0 truncate sm:block">
                      {displayName}
                    </span>
                  </m.button>
                </DropdownMenuTrigger>
                {!isMobile && (
                  <DropdownMenuContent
                    side="top"
                    align="end"
                    sideOffset={16}
                    collisionPadding={{
                      top: 72,
                      bottom: 88,
                      left: 16,
                      right: 16,
                    }}
                    className="w-80 overflow-hidden border-border bg-card p-0 shadow-2xl"
                  >
                    {profileMenuBody}
                  </DropdownMenuContent>
                )}
              </DropdownMenu>
            ) : (
              <Link
                href="/sign-in"
                onMouseEnter={() => prefetchRoute("/sign-in")}
              >
                <button className="flex h-11 items-center rounded-full border border-primary/30 bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">
                  {t("nav.login")}
                </button>
              </Link>
            )}
          </div>
        </div>
      </m.header>

      <SearchDialog
        query={search.query}
        setQuery={search.setQuery}
        results={search.results}
        suggestions={search.suggestions}
        route={search.route}
        hasSemantic={search.hasSemantic}
        searchMode={search.searchMode}
        indexStatus={search.indexStatus}
        isLoading={search.isLoading}
        isOpen={search.isOpen}
        setIsOpen={search.setIsOpen}
        close={search.close}
        trackClick={search.trackClick}
      />
    </LazyMotion>
  );
}
