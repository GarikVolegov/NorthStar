import { AffiliateInviteCard } from "@/components/affiliate/AffiliateInviteCard";
import { SubscriptionChip } from "@/components/subscription/SubscriptionStatus";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { AuthUser } from "@/contexts/AuthContext";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import {
  JOURNEY_LABELS,
  LANGUAGE_LABELS,
  MOBILE_THEME_OPTIONS,
  prefetchRoute,
} from "@/components/layout/navbarConfig";
import {
  Brain,
  Bell,
  Briefcase,
  CheckCheck,
  Circle,
  Globe2,
  LogOut,
  MapPin,
  MoonStar,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import type { AffiliateInvitePreview } from "@/hooks/useAffiliateInvitePreview";

interface ProfileMenuProps {
  user: AuthUser;
  displayName: string;
  initial: string;
  profileBannerUrl: string | null;
  activeLanguage: string;
  theme: string | undefined;
  insightsUnread: number;
  affiliatePreview: AffiliateInvitePreview;
  affiliateLinkCopied: boolean;
  brandLogoUrl?: string;
  applicationsLabel: string;
  logoutLabel: string;
  onNavigate: (path: string) => void;
  onCopyAffiliate: () => void;
  onShareAffiliate: () => void;
  onThemeChange: (theme: string) => void;
  onLanguageChange: (language: string) => void;
  onSignOut: () => void;
}

function ProfileHeader({
  user,
  displayName,
  initial,
  profileBannerUrl,
  compact = false,
}: Pick<ProfileMenuProps, "user" | "displayName" | "initial" | "profileBannerUrl"> & {
  compact?: boolean;
}) {
  return (
    <div className="p-0 font-normal">
      <div className="h-12 overflow-hidden bg-muted">
        {profileBannerUrl ? (
          <img src={profileBannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.28),transparent_35%),linear-gradient(135deg,hsl(var(--muted)),hsl(var(--background)))]" />
        )}
      </div>
      <div className="px-3 pb-2 pt-2">
        <div className={compact ? "flex items-center gap-2" : "flex items-center gap-3"}>
          <span className={`${compact ? "h-11 w-11" : "h-10 w-10"} flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-primary/10 text-sm font-bold text-primary shadow-sm`}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </span>
          <div className={compact ? "min-w-0" : "min-w-0 flex-1"}>
            <span className={`${compact ? "text-[15px]" : "text-sm"} block truncate font-semibold leading-5 text-foreground`}>
              {displayName}
            </span>
            <span className={`${compact ? "text-[11px]" : "text-xs"} block truncate text-muted-foreground`}>
              {user.email}
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {user.journeyType && JOURNEY_LABELS[user.journeyType] && (
                <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 ${compact ? "text-[11px]" : "text-xs"} font-semibold ${JOURNEY_LABELS[user.journeyType]?.color ?? ""}`}>
                  {JOURNEY_LABELS[user.journeyType]?.label}
                </span>
              )}
              <SubscriptionChip />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeButtons({
  theme,
  onThemeChange,
  compact = false,
}: Pick<ProfileMenuProps, "theme" | "onThemeChange"> & { compact?: boolean }) {
  return (
    <div className={compact ? "grid min-w-0 flex-1 grid-cols-3 gap-1" : "ml-auto grid grid-cols-3 gap-1"}>
      {MOBILE_THEME_OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = (theme ?? "system") === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onThemeChange(option.value)}
            className={`${compact ? "min-h-9 px-1.5" : "min-h-7 px-2"} flex items-center justify-center gap-1 rounded-full border text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
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
  );
}

function LanguageButtons({
  activeLanguage,
  onLanguageChange,
  compact = false,
}: Pick<ProfileMenuProps, "activeLanguage" | "onLanguageChange"> & { compact?: boolean }) {
  return (
    <div className={compact ? "grid min-w-0 flex-1 grid-cols-5 gap-1" : "flex shrink-0 items-center gap-1"}>
      {SUPPORTED_LANGUAGES.map((code) => {
        const active = activeLanguage === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => onLanguageChange(code)}
            className={`${compact ? "min-h-9 px-1" : "min-h-7 px-2"} rounded-full border text-[10px] font-bold uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
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
  );
}

function AffiliateBlock({
  affiliatePreview,
  affiliateLinkCopied,
  onCopyAffiliate,
  onShareAffiliate,
  onNavigate,
}: Pick<
  ProfileMenuProps,
  "affiliatePreview" | "affiliateLinkCopied" | "onCopyAffiliate" | "onShareAffiliate" | "onNavigate"
>) {
  return (
    <AffiliateInviteCard
      preview={affiliatePreview}
      copied={affiliateLinkCopied}
      compact
      onCopy={onCopyAffiliate}
      onShare={onShareAffiliate}
      onOpenDashboard={() => onNavigate("/affiliazione/dashboard")}
      onPrefetchDashboard={() => prefetchRoute("/affiliazione/dashboard")}
    />
  );
}

const SOURCE_LABELS: Record<string, string> = {
  system: "Sistema",
  wendy: "Wendy",
  monthly_ritual: "Rito",
  calendar: "Calendario",
  agent: "Agente",
  pipeline: "Pipeline",
  social: "Social",
  proactive_insight: "Insight",
};

function notificationIcon(notification: AppNotification) {
  const className = "h-4 w-4";
  if (notification.iconKey === "moon-star" || notification.source === "monthly_ritual") {
    return <MoonStar className={`${className} text-primary`} />;
  }
  if (notification.source === "wendy" || notification.source === "proactive_insight") {
    return <Sparkles className={`${className} text-amber-500`} />;
  }
  if (notification.source === "social") {
    return <Users className={`${className} text-sky-500`} />;
  }
  return <Bell className={`${className} text-primary`} />;
}

function NotificationCenterBlock({
  compact = false,
  brandLogoUrl = "/logo.svg",
  onNavigate,
}: {
  compact?: boolean;
  brandLogoUrl?: string;
  onNavigate: (path: string) => void;
}) {
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    openNotification,
    dismiss,
  } = useNotifications();
  const visible = notifications.slice(0, compact ? 2 : 3);

  const open = (notification: AppNotification) => {
    markRead(notification.id);
    openNotification(notification.id);
    if (notification.ctaUrl) onNavigate(notification.ctaUrl);
  };

  return (
    <div className={compact ? "space-y-2 px-2 py-2" : "space-y-2 px-2 py-1.5"}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Bell className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notifiche</p>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {unreadCount > 9 ? "9+" : unreadCount} {unreadCount === 1 ? "nuova" : "nuove"}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            aria-label="Segna tutte le notifiche come lette"
          >
            <CheckCheck className="h-4 w-4" />
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-md border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          Nessuna nuova notifica.
        </div>
      ) : (
        <div className="space-y-1.5">
          {visible.map((notification) => {
            const unread = !notification.readAt;
            return (
              <div
                key={notification.id}
                className="rounded-md border border-border/70 bg-background/70 p-2"
              >
                <div className="flex items-start gap-2">
                  <span className="relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    {notificationIcon(notification)}
                    <img
                      src={brandLogoUrl}
                      alt=""
                      className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border border-background bg-card object-cover"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {unread && <Circle className="h-2 w-2 fill-primary text-primary" />}
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {SOURCE_LABELS[notification.source] ?? "NorthStar"}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-sm font-semibold leading-5 text-foreground">
                      {notification.title}
                    </p>
                    {notification.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {notification.body}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-1.5">
                      {notification.ctaUrl && notification.ctaLabel ? (
                        <button
                          type="button"
                          onClick={() => open(notification)}
                          className="inline-flex min-h-8 items-center rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                        >
                          {notification.ctaLabel}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markRead(notification.id)}
                          className="inline-flex min-h-8 items-center rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                        >
                          Letta
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => dismiss(notification.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                        aria-label={`Nascondi notifica ${notification.title}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DesktopItem({
  icon,
  children,
  onClick,
  className = "",
  path,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  className?: string;
  path?: string;
}) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      onMouseEnter={path ? () => prefetchRoute(path) : undefined}
      onFocus={path ? () => prefetchRoute(path) : undefined}
      className={`min-h-9 cursor-pointer ${className}`}
    >
      {icon}
      {children}
    </DropdownMenuItem>
  );
}

function MobileAction({
  icon,
  children,
  onClick,
  className = "text-foreground",
  path,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  className?: string;
  path?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={path ? () => prefetchRoute(path) : undefined}
      className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function NavbarDesktopProfileMenu(props: ProfileMenuProps) {
  const {
    user,
    displayName,
    initial,
    profileBannerUrl,
    insightsUnread,
    applicationsLabel,
    logoutLabel,
    onNavigate,
    onSignOut,
  } = props;

  return (
    <>
      <DropdownMenuLabel className="p-0 font-normal">
        <ProfileHeader
          user={user}
          displayName={displayName}
          initial={initial}
          profileBannerUrl={profileBannerUrl}
        />
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <NotificationCenterBlock
        {...(props.brandLogoUrl ? { brandLogoUrl: props.brandLogoUrl } : {})}
        onNavigate={onNavigate}
      />
      <DropdownMenuSeparator />
      <DesktopItem
        icon={<Settings className="mr-2 h-4 w-4 text-primary" />}
        path="/profilo"
        onClick={() => onNavigate("/profilo#impostazioni")}
      >
        Impostazioni profilo
      </DesktopItem>
      <DropdownMenuSeparator />
      {insightsUnread > 0 && (
        <>
          <DesktopItem
            icon={<Sparkles className="mr-2 h-4 w-4" />}
            className="text-amber-500 focus:text-amber-600"
            onClick={() => onNavigate("/dashboard")}
          >
            Wendy ha {insightsUnread > 9 ? "9+" : insightsUnread} insight
          </DesktopItem>
          <DropdownMenuSeparator />
        </>
      )}
      {!user.journeyType && (
        <DesktopItem
          icon={<MapPin className="mr-2 h-4 w-4 text-primary" />}
          path="/percorso"
          onClick={() => onNavigate("/percorso")}
        >
          Imposta percorso
        </DesktopItem>
      )}
      <DesktopItem
        icon={<Briefcase className="mr-2 h-4 w-4" />}
        onClick={() => onNavigate("/candidature")}
      >
        {applicationsLabel}
      </DesktopItem>
      <DesktopItem
        icon={<Brain className="mr-2 h-4 w-4" />}
        path="/wendy/memoria"
        className="text-sm text-muted-foreground"
        onClick={() => onNavigate("/wendy/memoria")}
      >
        Memoria di Wendy
      </DesktopItem>
      <DesktopItem
        icon={<Sparkles className="mr-2 h-4 w-4" />}
        path="/profilo/briefing"
        className="text-sm text-muted-foreground"
        onClick={() => onNavigate("/profilo/briefing")}
      >
        Briefing Wendy
      </DesktopItem>
      <DesktopItem
        icon={<Users className="mr-2 h-4 w-4" />}
        path="/workspace"
        className="text-sm text-muted-foreground"
        onClick={() => onNavigate("/workspace")}
      >
        Workspace
      </DesktopItem>
      <DropdownMenuSeparator />
      <div className="flex min-h-9 items-center gap-2 px-2 py-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tema</p>
        <ThemeButtons theme={props.theme} onThemeChange={props.onThemeChange} />
      </div>
      <DropdownMenuSeparator />
      <div className="flex min-h-9 items-center gap-2 px-2 py-1">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Globe2 className="h-4 w-4 shrink-0" />
          <span>Lingua</span>
        </div>
        <LanguageButtons activeLanguage={props.activeLanguage} onLanguageChange={props.onLanguageChange} />
      </div>
      <DropdownMenuSeparator />
      <AffiliateBlock {...props} />
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={onSignOut}
        className="min-h-9 cursor-pointer text-destructive focus:text-destructive"
      >
        <LogOut className="mr-2 h-4 w-4" />
        {logoutLabel}
      </DropdownMenuItem>
    </>
  );
}

export function NavbarMobileProfileMenu(props: ProfileMenuProps) {
  const {
    user,
    displayName,
    initial,
    profileBannerUrl,
    insightsUnread,
    applicationsLabel,
    logoutLabel,
    onNavigate,
    onSignOut,
  } = props;

  return (
    <>
      <ProfileHeader
        compact
        user={user}
        displayName={displayName}
        initial={initial}
        profileBannerUrl={profileBannerUrl}
      />
      <div className="h-px bg-border" />
      <NotificationCenterBlock
        compact
        {...(props.brandLogoUrl ? { brandLogoUrl: props.brandLogoUrl } : {})}
        onNavigate={onNavigate}
      />
      <div className="h-px bg-border" />
      <div className="px-2 py-1">
        <MobileAction
          icon={<Settings className="h-4 w-4 text-primary" />}
          path="/profilo"
          className="font-semibold text-foreground"
          onClick={() => onNavigate("/profilo#impostazioni")}
        >
          Impostazioni profilo
        </MobileAction>
        {insightsUnread > 0 && (
          <MobileAction
            icon={<Sparkles className="h-4 w-4" />}
            className="text-amber-500"
            onClick={() => onNavigate("/dashboard")}
          >
            Wendy ha {insightsUnread > 9 ? "9+" : insightsUnread} insight
          </MobileAction>
        )}
        {!user.journeyType && (
          <MobileAction
            icon={<MapPin className="h-4 w-4 text-primary" />}
            path="/percorso"
            onClick={() => onNavigate("/percorso")}
          >
            Imposta percorso
          </MobileAction>
        )}
        <MobileAction
          icon={<Briefcase className="h-4 w-4" />}
          onClick={() => onNavigate("/candidature")}
        >
          {applicationsLabel}
        </MobileAction>
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
                onClick={() => onNavigate(item.path)}
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
          <ThemeButtons compact theme={props.theme} onThemeChange={props.onThemeChange} />
        </div>
        <div className="flex min-h-9 items-center gap-2">
          <div className="flex w-16 shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Globe2 className="h-3.5 w-3.5 shrink-0" />
            <span>Lingua</span>
          </div>
          <LanguageButtons compact activeLanguage={props.activeLanguage} onLanguageChange={props.onLanguageChange} />
        </div>
      </div>
      <div className="h-px bg-border" />
      <AffiliateBlock {...props} />
      <div className="h-px bg-border" />
      <button
        type="button"
        onClick={onSignOut}
        className="mx-2 my-1 flex min-h-10 w-[calc(100%-1rem)] items-center gap-2 rounded-lg px-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        <LogOut className="h-4 w-4" />
        {logoutLabel}
      </button>
    </>
  );
}
