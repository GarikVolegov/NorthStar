import {
  NavbarDesktopProfileMenu,
  NavbarMobileProfileMenu,
} from "@/components/layout/NavbarProfileMenus";
import { SearchDialog } from "@/components/search/SearchDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useWendy } from "@/contexts/WendyProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAffiliateInvitePreview } from "@/hooks/useAffiliateInvitePreview";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { useProactiveInsights } from "@/hooks/useProactiveInsights";
import {
  BASE,
  JOURNEY_CATEGORIES,
  type NavPhase,
  prefetchRoute,
} from "@/components/layout/navbarConfig";
import { apiFetch } from "@/lib/api-fetch";
import { getJson } from "@/lib/apiClient";
import { NAV_LABELS } from "@/lib/constants";
import { useReducedMotion } from "@/lib/motion";
import { useClerk } from "@clerk/react";
import { LazyMotion, domAnimation, m } from "framer-motion";
import {
  Menu,
  Newspaper,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";

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
      : ["indeciso", "dipendente", "autonomo", "azienda", "investitore"].includes(user.journeyType)
        ? (user.journeyType as NavPhase)
        : "new-user";

  useEffect(() => {
    const cats = JOURNEY_CATEGORIES[phase].join(",");

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

  const profileMenuProps = user
    ? {
        user,
        displayName,
        initial,
        profileBannerUrl,
        activeLanguage,
        theme,
        insightsUnread,
        affiliatePreview,
        affiliateLinkCopied,
        applicationsLabel: t("nav.applications"),
        logoutLabel: t("nav.logout"),
        onNavigate: goToProfilePath,
        onCopyAffiliate: () => void copyAffiliateLink(),
        onShareAffiliate: () => void shareAffiliateLink(),
        onThemeChange: setTheme,
        onLanguageChange: (language: string) => void i18n.changeLanguage(language),
        onSignOut: () => {
          setProfileMenuOpen(false);
          void signOut();
        },
      }
    : null;

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
      {profileMenuOpen && isMobile && profileMenuProps && (
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
          <NavbarMobileProfileMenu {...profileMenuProps} />
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
            aria-label={insightsUnread > 0 ? `Apri Wendy (${insightsUnread > 9 ? '9+' : insightsUnread} insight non letti)` : "Apri ricerca Wendy"}
            className="group relative h-12 min-w-0 flex-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            {insightsUnread > 0 && (
              <span
                aria-hidden
                className="absolute right-3 top-1.5 z-20 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white shadow-md ring-2 ring-card"
              >
                {insightsUnread > 9 ? "9+" : insightsUnread}
              </span>
            )}
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
                    {profileMenuProps ? (
                      <NavbarDesktopProfileMenu {...profileMenuProps} />
                    ) : null}
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
