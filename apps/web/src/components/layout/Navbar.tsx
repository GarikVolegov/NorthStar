import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { LazyMotion, domAnimation, m } from "framer-motion";
import {
  Brain,
  Briefcase,
  Check,
  Copy,
  Globe2,
  HandCoins,
  LogOut,
  Menu,
  MapPin,
  Newspaper,
  Settings,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClerk } from "@clerk/react";
import { useAuth } from "@/contexts/AuthContext";
import { useProactiveInsights } from "@/hooks/useProactiveInsights";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SubscriptionChip } from "@/components/subscription/SubscriptionStatus";
import { useReducedMotion } from "@/lib/motion";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { SearchDialog } from "@/components/search/SearchDialog";
import { useWendy } from "@/contexts/WendyProvider";
import { NAV_LABELS } from "@/lib/constants";
import { apiFetch } from "@/lib/api-fetch";
import { useIsMobile } from "@/hooks/use-mobile";

const BASE = import.meta.env.BASE_URL || "/";

const LANGUAGE_LABELS: Record<string, string> = {
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

type AffiliateMenuState = {
  status: "idle" | "loading" | "ready" | "unavailable";
  referralCode: string | null;
  referralLink: string | null;
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
  const isMobile = useIsMobile();
  const [newsTitles, setNewsTitles] = useState<string[]>([]);
  const [profileBannerUrl, setProfileBannerUrl] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [affiliateMenu, setAffiliateMenu] = useState<AffiliateMenuState>({
    status: "idle",
    referralCode: null,
    referralLink: null,
  });
  const [affiliateLinkCopied, setAffiliateLinkCopied] = useState(false);
  const { unreadCount: insightsUnread } = useProactiveInsights();

  const phase: NavPhase = !isLoggedIn
    ? "guest"
    : !user?.journeyType
      ? "new-user"
      : ["indeciso", "dipendente", "autonomo", "azienda", "investitore"].includes(
            user.journeyType,
          )
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
    const cats = (JOURNEY_CATEGORIES[phase] ?? JOURNEY_CATEGORIES.guest).join(
      ",",
    );

    fetch(`${BASE}api/news?multi=true&categories=${cats}&perCategory=2`)
      .then((response) => response.json())
      .then((data) => {
        if (data?.news?.length) {
          setNewsTitles(data.news.map((item: { title: string }) => item.title));
        }
      })
      .catch(() => {});
  }, [phase]);

  const isAffiliate = user ? (user.isAffiliate ?? true) : false;
  const isWendyActive = wendy.phase === "thinking" || wendy.phase === "speaking";
  const displayName = user?.name || user?.email || NAV_LABELS.profilo;
  const initial = displayName.trim().charAt(0).toUpperCase() || "N";
  const activeLanguage = i18n.resolvedLanguage?.slice(0, 2) || i18n.language?.slice(0, 2) || "it";
  const mobileMenuScale = !isMobile
    ? 1
    : viewportHeight > 0 && viewportHeight < 640
      ? 0.88
      : viewportHeight > 0 && viewportHeight < 740
        ? 0.94
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
    if (!profileMenuOpen || !isLoggedIn || !user?.id) return;

    let cancelled = false;
    setAffiliateMenu((current) => ({
      status: current.status === "ready" ? "ready" : "loading",
      referralCode: current.referralCode,
      referralLink: current.referralLink,
    }));

    apiFetch(`${BASE}api/affiliate/dashboard`)
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{
          referralCode?: string | null;
          code?: string | null;
          referralLink?: string | null;
          link?: string | null;
        }>;
      })
      .then((data) => {
        if (cancelled) return;
        const referralCode = data?.referralCode ?? data?.code ?? null;
        const referralLink = data?.referralLink ?? data?.link ?? null;
        setAffiliateMenu(
          referralLink
            ? { status: "ready", referralCode, referralLink }
            : { status: "unavailable", referralCode: null, referralLink: null },
        );
      })
      .catch(() => {
        if (!cancelled) {
          setAffiliateMenu({ status: "unavailable", referralCode: null, referralLink: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, profileMenuOpen, user?.id]);

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

  const copyAffiliateLink = async () => {
    if (!affiliateMenu.referralLink) return;
    try {
      await navigator.clipboard.writeText(affiliateMenu.referralLink);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = affiliateMenu.referralLink;
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
    if (!affiliateMenu.referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Invito NorthStar",
          text: "Iscriviti a NorthStar tramite il mio link.",
          url: affiliateMenu.referralLink,
        });
        return;
      } catch {
        // Se l'utente annulla lo share nativo, lasciamo disponibile la copia.
      }
    }
    await copyAffiliateLink();
  };

  const renderAffiliateInviteBlock = () => (
    <div className="px-2 py-2">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HandCoins className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Invita amici</p>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              Condividi il tuo link di iscrizione e segui i referral dalla dashboard.
            </p>
          </div>
        </div>

        {affiliateMenu.status === "ready" && affiliateMenu.referralLink ? (
          <div className="mt-3 space-y-2">
            <div className="rounded-md border bg-background px-2 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Codice</p>
              <p className="truncate font-mono text-xs font-semibold text-foreground">
                {affiliateMenu.referralCode ?? affiliateMenu.referralLink}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void copyAffiliateLink()}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-md border bg-background px-2 text-xs font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                {affiliateLinkCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {affiliateLinkCopied ? "Copiato" : "Copia"}
              </button>
              <button
                type="button"
                onClick={() => void shareAffiliateLink()}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-md border bg-background px-2 text-xs font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                <Share2 className="h-3.5 w-3.5" />
                Condividi
              </button>
            </div>
            <button
              type="button"
              onClick={() => goToProfilePath("/affiliazione/dashboard")}
              onMouseEnter={() => prefetchRoute("/affiliazione/dashboard")}
              onFocus={() => prefetchRoute("/affiliazione/dashboard")}
              className="flex min-h-10 w-full items-center justify-center rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              Dashboard affiliazione
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => goToProfilePath("/affiliazione/dashboard")}
              onMouseEnter={() => prefetchRoute("/affiliazione/dashboard")}
              onFocus={() => prefetchRoute("/affiliazione/dashboard")}
              className="flex min-h-10 w-full items-center justify-center rounded-md border border-primary/30 bg-background px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              {affiliateMenu.status === "loading" ? "Controllo link..." : "Attiva affiliazione"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const profileMenuBody = user ? (
    <>
      <DropdownMenuLabel className="p-0 font-normal">
        <div className="h-14 overflow-hidden bg-muted sm:h-20">
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
        <div className="px-3 pb-2 pt-2 sm:pb-3 sm:pt-3">
          <div className="mb-2 flex items-center gap-2 sm:mb-3 sm:gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-primary/10 text-sm font-bold text-primary shadow-sm sm:h-14 sm:w-14 sm:border-4 sm:text-lg">
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
              <span className="block truncate text-sm font-semibold text-foreground">
                {displayName}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground sm:text-xs">
                {user.email}
              </span>
            </div>
          </div>
          {user.journeyType && JOURNEY_LABELS[user.journeyType] && (
            <span
              className={`mt-0.5 inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-semibold ${JOURNEY_LABELS[user.journeyType].color}`}
            >
              {JOURNEY_LABELS[user.journeyType].label}
            </span>
          )}
          <SubscriptionChip />
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => goToProfilePath("/profilo#impostazioni")}
        onMouseEnter={() => prefetchRoute("/profilo")}
        onFocus={() => prefetchRoute("/profilo")}
        className="min-h-10 cursor-pointer sm:min-h-11"
      >
        <Settings className="mr-2 h-4 w-4 text-primary" />
        Impostazioni profilo
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {insightsUnread > 0 && (
        <>
          <DropdownMenuItem
            onClick={() => goToProfilePath("/dashboard")}
            className="min-h-10 cursor-pointer text-amber-500 focus:text-amber-600"
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
          className="min-h-10 cursor-pointer"
        >
          <MapPin className="mr-2 h-4 w-4 text-primary" />
          Imposta percorso
        </DropdownMenuItem>
      )}
      <DropdownMenuItem
        onClick={() => goToProfilePath("/candidature")}
        className="min-h-10 cursor-pointer"
      >
        <Briefcase className="mr-2 h-4 w-4" />
        {t("nav.applications")}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => goToProfilePath("/wendy/memoria")}
        onMouseEnter={() => prefetchRoute("/wendy/memoria")}
        className="min-h-10 cursor-pointer text-xs text-muted-foreground"
      >
        <Brain className="mr-2 h-4 w-4" />
        Memoria di Wendy
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => goToProfilePath("/profilo/briefing")}
        onMouseEnter={() => prefetchRoute("/profilo/briefing")}
        className="min-h-10 cursor-pointer text-xs text-muted-foreground"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        Briefing Wendy
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => goToProfilePath("/workspace")}
        onMouseEnter={() => prefetchRoute("/workspace")}
        className="min-h-10 cursor-pointer text-xs text-muted-foreground"
      >
        <Users className="mr-2 h-4 w-4" />
        Workspace
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <div className="flex min-h-10 items-center justify-between gap-2 px-2 py-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tema
        </p>
        <ThemeToggle />
      </div>
      <DropdownMenuSeparator />
      <div className="flex min-h-10 items-center gap-2 px-2 py-1">
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
                className={`min-h-8 rounded-full border px-2 text-[10px] font-bold uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
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
      {renderAffiliateInviteBlock()}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => {
          setProfileMenuOpen(false);
          void signOut();
        }}
        className="min-h-10 cursor-pointer text-destructive focus:text-destructive"
      >
        <LogOut className="mr-2 h-4 w-4" />
        {t("nav.logout")}
      </DropdownMenuItem>
    </>
  ) : null;

  const profileMenuMobileBody = user ? (
    <>
      <div className="p-0 font-normal">
        <div className="h-14 overflow-hidden bg-muted">
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
          <div className="mb-2 flex items-center gap-2">
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
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">
                {displayName}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {user.email}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {user.journeyType && JOURNEY_LABELS[user.journeyType] && (
              <span
                className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-semibold ${JOURNEY_LABELS[user.journeyType].color}`}
              >
                {JOURNEY_LABELS[user.journeyType].label}
              </span>
            )}
            <SubscriptionChip />
          </div>
        </div>
      </div>
      <div className="h-px bg-border" />
      <button
        type="button"
        onClick={() => goToProfilePath("/profilo#impostazioni")}
        onMouseEnter={() => prefetchRoute("/profilo")}
        onFocus={() => prefetchRoute("/profilo")}
        className="flex min-h-10 w-full items-center gap-2 px-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        <Settings className="h-4 w-4 text-primary" />
        Impostazioni profilo
      </button>
      {insightsUnread > 0 && (
        <button
          type="button"
          onClick={() => goToProfilePath("/dashboard")}
          className="flex min-h-10 w-full items-center gap-2 px-2 text-left text-sm font-medium text-amber-500 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
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
          className="flex min-h-10 w-full items-center gap-2 px-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <MapPin className="h-4 w-4 text-primary" />
          Imposta percorso
        </button>
      )}
      <button
        type="button"
        onClick={() => goToProfilePath("/candidature")}
        className="flex min-h-10 w-full items-center gap-2 px-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        <Briefcase className="h-4 w-4" />
        {t("nav.applications")}
      </button>
      <button
        type="button"
        onClick={() => goToProfilePath("/wendy/memoria")}
        onMouseEnter={() => prefetchRoute("/wendy/memoria")}
        className="flex min-h-10 w-full items-center gap-2 px-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        <Brain className="h-4 w-4" />
        Memoria di Wendy
      </button>
      <button
        type="button"
        onClick={() => goToProfilePath("/profilo/briefing")}
        onMouseEnter={() => prefetchRoute("/profilo/briefing")}
        className="flex min-h-10 w-full items-center gap-2 px-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        <Sparkles className="h-4 w-4" />
        Briefing Wendy
      </button>
      <button
        type="button"
        onClick={() => goToProfilePath("/workspace")}
        onMouseEnter={() => prefetchRoute("/workspace")}
        className="flex min-h-10 w-full items-center gap-2 px-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        <Users className="h-4 w-4" />
        Workspace
      </button>
      <div className="h-px bg-border" />
      <div className="flex min-h-10 items-center justify-between gap-2 px-2 py-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tema
        </p>
        <ThemeToggle />
      </div>
      <div className="h-px bg-border" />
      <div className="flex min-h-10 items-center gap-2 px-2 py-1">
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
                className={`min-h-8 rounded-full border px-2 text-[10px] font-bold uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
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
      <div className="h-px bg-border" />
      {renderAffiliateInviteBlock()}
      <div className="h-px bg-border" />
      <button
        type="button"
        onClick={() => {
          setProfileMenuOpen(false);
          void signOut();
        }}
        className="flex min-h-10 w-full items-center gap-2 px-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
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
          className="fixed left-1/2 top-1/2 z-[60] w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
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
                            <span className="max-w-[320px] truncate">{title}</span>
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
            className="group relative h-11 min-w-0 flex-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
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
              className={`flex h-11 w-full items-center rounded-full border bg-white/5 pl-10 pr-3 text-left text-sm text-muted-foreground/70 transition-all group-hover:border-white/20 group-hover:bg-white/10 ${
                wendy.isOpen ? "border-primary/30" : "border-white/10"
              } ${isWendyActive ? "border-transparent" : ""}`}
            >
              <span className="min-w-0 flex-1 truncate">Parla con Wendy</span>
              <kbd className="ml-2 hidden items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
                Cmd K
              </kbd>
            </span>
          </button>

          <div className="flex shrink-0 items-center">
            {isLoggedIn && user ? (
              <DropdownMenu open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
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
                      if (isAffiliate) prefetchRoute("/affiliazione/dashboard");
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
                    <span className="hidden min-w-0 truncate sm:block">{displayName}</span>
                  </m.button>
                </DropdownMenuTrigger>
                {!isMobile && (
                <DropdownMenuContent
                  side="top"
                  align={isMobile ? "center" : "end"}
                  sideOffset={isMobile ? 22 : 8}
                  style={isMobile ? {
                    position: "fixed",
                    left: "50%",
                    top: "50%",
                    transform: `translate(-50%, -50%) scale(${mobileMenuScale})`,
                    transformOrigin: "center",
                    width: "min(360px, calc(100vw - 24px))",
                  } : undefined}
                  className="w-[calc(100vw-24px)] max-w-sm overflow-hidden border-border bg-card p-0 shadow-2xl sm:w-72"
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="h-14 overflow-hidden bg-muted sm:h-20">
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
                    <div className="px-3 pb-2 pt-2 sm:pb-3 sm:pt-3">
                      <div className="mb-2 flex items-center gap-2 sm:mb-3 sm:gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-primary/10 text-sm font-bold text-primary shadow-sm sm:h-14 sm:w-14 sm:border-4 sm:text-lg">
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
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {displayName}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground sm:text-xs">
                            {user.email}
                          </span>
                        </div>
                      </div>
                      {user.journeyType && JOURNEY_LABELS[user.journeyType] && (
                        <span
                          className={`mt-0.5 inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-semibold ${JOURNEY_LABELS[user.journeyType].color}`}
                        >
                          {JOURNEY_LABELS[user.journeyType].label}
                        </span>
                      )}
                      <SubscriptionChip />
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => goToProfilePath("/profilo#impostazioni")}
                    onMouseEnter={() => prefetchRoute("/profilo")}
                    onFocus={() => prefetchRoute("/profilo")}
                    className="min-h-10 cursor-pointer sm:min-h-11"
                  >
                    <Settings className="mr-2 h-4 w-4 text-primary" />
                    Impostazioni profilo
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {insightsUnread > 0 && (
                    <>
                      <DropdownMenuItem
                        onClick={() => goToProfilePath("/dashboard")}
                        className="min-h-10 cursor-pointer text-amber-500 focus:text-amber-600"
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
                      className="min-h-10 cursor-pointer"
                    >
                      <MapPin className="mr-2 h-4 w-4 text-primary" />
                      Imposta percorso
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => goToProfilePath("/candidature")}
                    className="min-h-10 cursor-pointer"
                  >
                    <Briefcase className="mr-2 h-4 w-4" />
                    {t("nav.applications")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => goToProfilePath("/wendy/memoria")}
                    onMouseEnter={() => prefetchRoute("/wendy/memoria")}
                    className="min-h-10 cursor-pointer text-xs text-muted-foreground"
                  >
                    <Brain className="mr-2 h-4 w-4" />
                    Memoria di Wendy
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => goToProfilePath("/profilo/briefing")}
                    onMouseEnter={() => prefetchRoute("/profilo/briefing")}
                    className="min-h-10 cursor-pointer text-xs text-muted-foreground"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Briefing Wendy
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => goToProfilePath("/workspace")}
                    onMouseEnter={() => prefetchRoute("/workspace")}
                    className="min-h-10 cursor-pointer text-xs text-muted-foreground"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Workspace
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="flex min-h-10 items-center justify-between gap-2 px-2 py-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Tema
                    </p>
                    <ThemeToggle />
                  </div>
                  <DropdownMenuSeparator />
                  <div className="flex min-h-10 items-center gap-2 px-2 py-1">
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
                            className={`min-h-8 rounded-full border px-2 text-[10px] font-bold uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
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
                  {renderAffiliateInviteBlock()}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut()}
                    className="min-h-10 cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {t("nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
                )}
              </DropdownMenu>
            ) : (
              <Link href="/sign-in" onMouseEnter={() => prefetchRoute("/sign-in")}>
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
        aiTokens={search.aiTokens}
        aiStatus={search.aiStatus}
        aiSources={search.aiSources}
        isStreaming={search.isStreaming}
        sendFollowUp={search.sendFollowUp}
      />
    </LazyMotion>
  );
}
