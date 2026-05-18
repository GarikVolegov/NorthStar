/**
 * AffiliateDashboard — Fase 4 Frontend Affiliate
 * FRONTEND_RULES.md: shadcn UI, Tailwind, Skeleton su ogni sezione,
 * nessun fetch diretto (tutto via hook), ErrorBoundary gestita dal parent.
 */
import { useState, useCallback, useRef } from 'react';
import {
  useAffiliateDashboard,
  useAffiliateWithdraw,
  useAffiliateCopyLink,
  formatCents,
} from '@/hooks/useAffiliateDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Copy, Check, AlertCircle, RefreshCw, TrendingUp, Clock, Wallet, Share2, Mail, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Simple QR code generator using Google Chart API (no dependencies needed)
function generateQRCodeUrl(text: string, size = 150): string {
  const encodedText = encodeURIComponent(text);
  return `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodedText}&choe=UTF-8`;
}

// ─── Sotto-componenti ─────────────────────────────────────────────────────────

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
  pending:   { label: 'In attesa',  variant: 'secondary' },
  confirmed: { label: 'Confermato', variant: 'default' },
  paid:      { label: 'Pagato',     variant: 'outline' },
  cancelled: { label: 'Cancellato', variant: 'outline' },
};

// ─── Componente principale ────────────────────────────────────────────────────

export function AffiliateDashboard() {
  const { data, isLoading, isError, error, refetch } = useAffiliateDashboard();
  const withdraw = useAffiliateWithdraw();
  const copyLink = useAffiliateCopyLink();

  const [copied, setCopied] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  async function handleCopy() {
    if (!data?.referralLink) return;
    await copyLink(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleWithdraw() {
    if (!data) return;
    withdraw.mutate(
      { amount: data.balance },
      { onSuccess: () => setWithdrawOpen(false) },
    );
  }

  // ── Stato di errore ────────────────────────────────────────────────────────
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

  // ── Sezione 1: Stats Bar ───────────────────────────────────────────────────
  const statsBar = isLoading ? (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatsCardSkeleton /><StatsCardSkeleton /><StatsCardSkeleton />
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
            In attesa
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

// ── Sezione 2: Referral Link Box ───────────────────────────────────────────
   const referralBox = isLoading ? (
     <Card>
       <CardHeader><Skeleton className="h-5 w-36" /></CardHeader>
       <CardContent className="flex gap-2">
         <Skeleton className="h-10 flex-1" />
         <Skeleton className="h-10 w-24" />
       </CardContent>
     </Card>
   ) : (
     <Card className="mb-6">
       <CardHeader>
         <CardTitle className="text-lg font-semibold">Il tuo link referral</CardTitle>
         <p className="text-sm text-muted-foreground mt-1">
           Condividi questo link per guadagnare commissioni sulle iscrizioni premium
         </p>
       </CardHeader>
       <CardContent className="space-y-4">
         {/* Link referral con copia migliorata */}
         <div className="space-y-3">
           <div className="flex items-center gap-2">
             <input
               readOnly
               value={data!.referralLink}
               className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-sm
                          text-muted-foreground cursor-text select-all focus:outline-none"
               onClick={(e) => (e.target as HTMLInputElement).select()}
             />
             <Button
               variant={copied ? 'default' : 'outline'}
               className="shrink-0 transition-colors"
               onClick={handleCopy}
             >
               {copied ? (
                 <><Check className="h-4 w-4 mr-2" />Copiato!</>
               ) : (
                 <><Copy className="h-4 w-4 mr-2" />Copia link</>
               )}
             </Button>
           </div>
           <p className="text-xs text-muted-foreground">
             Link copiato negli appunti! Incollalo dove vuoi per iniziare a guadagnare.
           </p>
         </div>
         
          {/* QR Code e Social Sharing */}
          <div className="grid grid-cols-1 gap-4">
            {/* QR Code Section */}
            <div className="space-y-3">
              <p className="font-medium">Scansiona con il tuo dispositivo</p>
              <div className="flex items-center justify-center">
                <img
                  src={generateQRCodeUrl(data!.referralLink, 180)}
                  alt="QR Code per il tuo link referral"
                  className="w-24 h-24 rounded border"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Scansiona per condividere facilmente dal tuo telefono
              </p>
            </div>
           
           {/* Social Sharing Section */}
           <div className="space-y-3">
             <p className="font-medium">Condividi direttamente</p>
             <div className="flex flex-wrap gap-2">
               <Button
                 variant="outline"
                 size="icon"
                 className="hover:bg-primary/10 text-primary transition-colors"
                 onClick={() => {
                   // WhatsApp sharing
                   const url = encodeURIComponent(data!.referralLink);
                   const text = encodeURIComponent("Guadagna con NorthStar! Iscriviti tramite il mio link referral:");
                   window.open(`https://wa.me/?text=${text}%20${url}`, '_blank');
                 }}
               >
                 <MessageCircle className="h-4 w-4" />
               </Button>
               <Button
                 variant="outline"
                 size="icon"
                 className="hover:bg-primary/10 text-primary transition-colors"
                 onClick={() => {
                   // Email sharing
                   const subject = encodeURIComponent("Guadagna con NorthStar - Link referral");
                   const body = encodeURIComponent(
                     "Ciao,\n\nTi invito a provare NorthStar, la piattaforma di orientamento professionale.\n\n" +
                     "Iscriviti tramite il mio link referral per supportarmi e guadagnare commissioni:\n\n" +
                     data!.referralLink +
                     "\n\nBuona giornata!"
                   );
                   window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
                 }}
               >
                 <Mail className="h-4 w-4" />
               </Button>
               <Button
                 variant="outline"
                 size="icon"
                 className="hover:bg-primary/10 text-primary transition-colors"
                 onClick={() => {
                   // Generic share (copia link)
                   handleCopy();
                 }}
               >
                 <Share2 className="h-4 w-4" />
               </Button>
             </div>
             <p className="text-xs text-muted-foreground text-center">
               Condividi su WhatsApp, Email o copia il link
             </p>
           </div>
         </div>
       </CardContent>
     </Card>
   );

  // ── Sezione 3: Tabella referral ────────────────────────────────────────────
  const referralsTable = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">I tuoi referral</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 3 }).map((_, i) => <ReferralRowSkeleton key={i} />)}
          </div>
        ) : data!.referrals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nessun referral ancora. Condividi il tuo link per iniziare a guadagnare!
          </p>
        ) : (
          <div className="divide-y">
            {data!.referrals.map((r) => {
              const { label, variant } = STATUS_LABELS[r.status] ?? STATUS_LABELS.pending;
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

  // ── Sezione 4: Withdraw Panel ──────────────────────────────────────────────
  const canWithdraw = !isLoading && data!.balance >= data!.minWithdrawAmount;

  const withdrawPanel = (
    <Card>
      <CardContent className="flex flex-col sm:flex-row items-start sm:items-center
                              justify-between gap-4 pt-6">
        <div>
          <p className="text-sm font-medium">Saldo disponibile per il ritiro</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading
              ? '...'
              : canWithdraw
                ? `Puoi richiedere il ritiro di ${formatCents(data!.balance)}`
                : `Soglia minima: ${formatCents(data?.minWithdrawAmount ?? 0)}`
            }
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
              <Button
                onClick={handleWithdraw}
                disabled={withdraw.isPending}
              >
                {withdraw.isPending ? 'Elaborazione...' : 'Conferma ritiro'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );

  // ── Layout finale ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {statsBar}
      {referralBox}
      {referralsTable}
      {withdrawPanel}
    </div>
  );
}
