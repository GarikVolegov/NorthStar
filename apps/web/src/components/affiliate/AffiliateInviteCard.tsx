import { Check, Copy, HandCoins, LayoutDashboard, Share2 } from "lucide-react";
import type { AffiliateInvitePreview } from "@/hooks/useAffiliateInvitePreview";

interface AffiliateInviteCardProps {
  preview: AffiliateInvitePreview;
  copied: boolean;
  compact?: boolean;
  onCopy: () => void;
  onShare: () => void;
  onOpenDashboard: () => void;
  onPrefetchDashboard?: () => void;
}

export function AffiliateInviteCard({
  preview,
  copied,
  compact = false,
  onCopy,
  onShare,
  onOpenDashboard,
  onPrefetchDashboard,
}: AffiliateInviteCardProps) {
  const hasLink = preview.status === "ready" && !!preview.referralLink;
  const actionLabel = preview.status === "loading"
    ? "Controllo link..."
    : preview.status === "error"
      ? "Riprova dalla dashboard"
      : "Attiva affiliazione";

  if (compact) {
    return (
      <div className="px-2 py-1.5">
        <button
          type="button"
          onClick={onOpenDashboard}
          onMouseEnter={onPrefetchDashboard}
          onFocus={onPrefetchDashboard}
          className="flex w-full items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HandCoins className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold leading-5 text-foreground">Invita amici</span>
            <span className="block truncate text-xs text-muted-foreground">
              {hasLink ? "20% sui rinnovi" : actionLabel}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1.5 text-[11px] font-bold text-primary-foreground">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </span>
        </button>
      </div>
    );
  }

  return (
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

        {hasLink ? (
          <div className="mt-3 space-y-2">
            <div className="rounded-md border bg-background px-2 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Codice</p>
              <p className="truncate font-mono text-xs font-semibold text-foreground">
                {preview.referralCode ?? preview.referralLink}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onCopy}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-md border bg-background px-2 text-xs font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiato" : "Copia"}
              </button>
              <button
                type="button"
                onClick={onShare}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-md border bg-background px-2 text-xs font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                <Share2 className="h-3.5 w-3.5" />
                Condividi
              </button>
            </div>
            <button
              type="button"
              onClick={onOpenDashboard}
              onMouseEnter={onPrefetchDashboard}
              onFocus={onPrefetchDashboard}
              className="flex min-h-10 w-full items-center justify-center rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              Dashboard affiliazione
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <button
              type="button"
              onClick={onOpenDashboard}
              onMouseEnter={onPrefetchDashboard}
              onFocus={onPrefetchDashboard}
              className="flex min-h-10 w-full items-center justify-center rounded-md border border-primary/30 bg-background px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              {actionLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
