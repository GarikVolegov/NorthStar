import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatCents,
  useAffiliateCopyLink,
  useAffiliateDashboard,
  useAffiliateWithdraw,
} from '@/hooks/useAffiliateDashboard';
import { apiFetch } from '@/lib/api-fetch';
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  Download,
  Mail,
  MessageCircle,
  RefreshCw,
  Share2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';

function StatsCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Skeleton className="h-4 w-28 mb-2" />
        <Skeleton className="h-8 w-20" />
      </CardContent>
    </Card>
  );
}

function ReferralRowSkeleton() {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="space-y-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  pending: { label: 'In attesa', variant: 'secondary' },
  confirmed: { label: 'Confermato', variant: 'default' },
  paid: { label: 'Pagato', variant: 'outline' },
  cancelled: { label: 'Cancellato', variant: 'outline' },
};

export function AffiliateDashboard() {
  const { data, isLoading, isError, error, refetch } = useAffiliateDashboard();
  const withdraw = useAffiliateWithdraw();
  const copyLink = useAffiliateCopyLink();

  const [copied, setCopied] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [qrObjectUrl, setQrObjectUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    setQrObjectUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });

    if (!data?.qrCodeUrl) {
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setQrLoading(true);

    apiFetch(data.qrCodeUrl)
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (!blob || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setQrObjectUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setQrObjectUrl(null);
      })
      .finally(() => {
        if (!cancelled) setQrLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [data?.qrCodeUrl]);

  async function handleCopy() {
    if (!data?.referralLink) return;
    await copyLink(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openWhatsAppShare() {
    if (!data?.referralLink) return;
    const url = encodeURIComponent(data.referralLink);
    const text = encodeURIComponent("Ti invito a provare NorthStar. Iscriviti tramite il mio link:");
    window.open(`https://wa.me/?text=${text}%20${url}`, '_blank');
  }

  function openEmailShare() {
    if (!data?.referralLink) return;
    const subject = encodeURIComponent("Invito NorthStar");
    const body = encodeURIComponent(
      "Ciao,\n\nTi invito a provare NorthStar, la piattaforma di orientamento professionale.\n\n" +
      "Iscriviti tramite il mio link:\n\n" +
      data.referralLink +
      "\n\nBuona giornata!"
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  }

  async function handleShare() {
    if (!data?.referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Invito NorthStar",
          text: "Ti invito a provare NorthStar. Iscriviti tramite il mio link.",
          url: data.referralLink,
        });
        return;
      } catch {
        // Browser desktop o share annullato: mostriamo le alternative esplicite.
      }
    }
    setShareOpen(true);
  }

  async function handleDownloadQr() {
    if (!data?.qrCodeUrl) return;
    const separator = data.qrCodeUrl.includes('?') ? '&' : '?';
    const response = await apiFetch(`${data.qrCodeUrl}${separator}download=1`);
    if (!response.ok) return;

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `northstar-referral-${data.referralCode}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleWithdraw() {
    if (!data) return;
    withdraw.mutate(
      { amount: data.balance },
      { onSuccess: () => setWithdrawOpen(false) },
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-muted-foreground text-center">
            {error?.message ?? 'Impossibile caricare la dashboard affiliazione.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Riprova
          </Button>
        </CardContent>
      </Card>
    );
  }

  const statsBar = isLoading ? (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatsCardSkeleton />
      <StatsCardSkeleton />
      <StatsCardSkeleton />
    </div>
  ) : (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <TrendingUp className="h-4 w-4" />
            Guadagnato totale
          </div>
          <p className="text-2xl font-bold">{formatCents(data!.totalEarned)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Clock className="h-4 w-4" />
            Riserva primo mese
          </div>
          <p className="text-2xl font-bold">{formatCents(data!.pendingBalance)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Wallet className="h-4 w-4" />
            Disponibile
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCents(data!.balance)}
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const referralBox = isLoading ? (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-72 max-w-full" />
        </div>
        <Skeleton className="aspect-square w-full rounded-md" />
      </CardContent>
    </Card>
  ) : (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Invita un amico</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Condividi link o QR personale e guadagna il 20% sugli abbonamenti rinnovati dagli amici invitati.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Codice personale</p>
              <p className="mt-1 break-all font-mono text-sm font-bold text-foreground">{data!.referralCode}</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="affiliate-referral-link" className="text-sm font-medium">Link personale</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="affiliate-referral-link"
                  readOnly
                  value={data!.referralLink}
                  className="min-h-11 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground cursor-text select-all focus:outline-none focus:ring-2 focus:ring-primary/70"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  variant={copied ? 'default' : 'outline'}
                  className="min-h-11 shrink-0 transition-colors"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copiato
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copia
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Le commissioni coprono prima una mensilita Premium; il resto diventa ritirabile.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="min-h-11"
                onClick={openWhatsAppShare}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={openEmailShare}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              <Button variant="outline" className="min-h-11" onClick={() => void handleShare()}>
                <Share2 className="h-4 w-4 mr-2" />
                Condividi
              </Button>
            </div>
          </div>

          <div className="rounded-md border bg-background p-4 text-center">
            <p className="text-sm font-medium">QR code personale</p>
            <div className="mt-3 flex aspect-square w-full items-center justify-center rounded-md border bg-white p-3">
              {qrLoading ? (
                <Skeleton className="h-full w-full rounded-sm" />
              ) : qrObjectUrl ? (
                <img
                  src={qrObjectUrl}
                  alt="QR code del tuo link referral NorthStar"
                  className="h-full w-full object-contain"
                />
              ) : (
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <Button
              variant="outline"
              className="mt-3 min-h-11 w-full"
              onClick={() => void handleDownloadQr()}
              disabled={!data?.qrCodeUrl}
            >
              <Download className="h-4 w-4 mr-2" />
              Scarica QR
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const referralsTable = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">I tuoi inviti</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 3 }).map((_, i) => <ReferralRowSkeleton key={i} />)}
          </div>
        ) : data!.referrals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nessun amico invitato ancora. Condividi link o QR per iniziare.
          </p>
        ) : (
          <div className="divide-y">
            {data!.referrals.map((r) => {
              const statusMeta =
                STATUS_LABELS[r.status] ?? STATUS_LABELS.pending ?? { label: r.status, variant: "outline" as const };
              const { label, variant } = statusMeta;
              return (
                <div key={r.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{r.referredUserName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={variant}>{label}</Badge>
                    <span className="text-sm font-semibold">
                      {formatCents(r.commissionAmount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const canWithdraw = !isLoading && data!.balance >= data!.minWithdrawAmount;

  const withdrawPanel = (
    <Card>
      <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6">
        <div>
          <p className="text-sm font-medium">Saldo disponibile per il ritiro</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading
              ? '...'
              : canWithdraw
                ? `Puoi richiedere il ritiro di ${formatCents(data!.balance)}`
                : `Soglia minima: ${formatCents(data?.minWithdrawAmount ?? 0)}`}
          </p>
        </div>

        <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canWithdraw || withdraw.isPending}>
              <Wallet className="h-4 w-4 mr-2" />
              Richiedi ritiro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conferma ritiro</DialogTitle>
              <DialogDescription>
                Stai per richiedere il ritiro di{' '}
                <strong>{!isLoading && formatCents(data!.balance)}</strong>.
                I fondi arriveranno sul tuo conto entro 3-5 giorni lavorativi.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setWithdrawOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleWithdraw} disabled={withdraw.isPending}>
                {withdraw.isPending ? 'Elaborazione...' : 'Conferma ritiro'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {statsBar}
      {referralBox}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Condividi il tuo invito</DialogTitle>
            <DialogDescription>
              Scegli un canale oppure copia il link personale.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button variant="outline" className="min-h-11" onClick={openWhatsAppShare}>
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
            <Button variant="outline" className="min-h-11" onClick={openEmailShare}>
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
            <Button variant="outline" className="min-h-11" onClick={() => void handleCopy()}>
              <Copy className="h-4 w-4 mr-2" />
              Copia link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {referralsTable}
      {withdrawPanel}
    </div>
  );
}
