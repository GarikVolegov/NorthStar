/**
 * useAffiliateDashboard — Fase 4 Frontend Affiliate
 * FRONTEND_RULES.md: hook TanStack Query, nessun fetch diretto nei componenti.
 * API_RULES.md: token da AuthContext, endpoint /api/affiliate/*
 */
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ApiClientError, getJson, postJson } from '@/lib/apiClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const BASE = import.meta.env.BASE_URL || '/';

// ─── Tipi ────────────────────────────────────────────────────────────────────

export interface AffiliateReferral {
  id: string;
  referredUserName: string;
  referredUserEmail: string;
  status: 'pending' | 'confirmed' | 'paid' | 'cancelled';
  commissionAmount: number;   // in centesimi
  createdAt: string;          // ISO 8601
  paidAt?: string;
}

export interface AffiliateDashboardData {
  balance: number;            // saldo disponibile per ritiro, in centesimi
  pendingBalance: number;     // in attesa di conferma, in centesimi
  totalEarned: number;        // totale storico, in centesimi
  referralCode: string;       // es. "MARIO42"
  referralLink: string;       // URL completo con il codice
  qrCodeUrl: string;          // endpoint interno autenticato per il QR
  referrals: AffiliateReferral[];
  subscription: {
    plan: string;
    status: 'active' | 'paused' | 'suspended' | 'trialing' | 'canceled' | 'past_due';
    currentPeriodEnd: string | null;
  } | null;
  minWithdrawAmount: number;  // soglia minima ritiro, in centesimi
}

export interface WithdrawRequest {
  amount: number;  // in centesimi
}

// ─── Query key ───────────────────────────────────────────────────────────────

export const affiliateKeys = {
  dashboard: ['affiliate', 'dashboard'] as const,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export { formatCents };

function affiliateErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

// ─── Hook principale ─────────────────────────────────────────────────────────

export function useAffiliateDashboard() {
  const { token } = useAuth();

  return useQuery<AffiliateDashboardData>({
    queryKey: affiliateKeys.dashboard,
    queryFn: async () => {
      return getJson<AffiliateDashboardData>(`${BASE}api/affiliate/dashboard`);
    },
    enabled: !!token,
    staleTime: 60_000,          // 1 min — dati finanziari non troppo aggressivi
    refetchInterval: 60_000,    // refresh automatico ogni 60s
    retry: 2,
  });
}

// ─── Mutation: ritiro ────────────────────────────────────────────────────────

export function useAffiliateWithdraw() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<void, Error, WithdrawRequest>({
    mutationFn: async ({ amount }) => {
      try {
        await postJson(`${BASE}api/affiliate/withdraw`, { amount });
      } catch (error) {
        throw new Error(affiliateErrorMessage(error, 'Ritiro non riuscito'), {
          cause: error,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: affiliateKeys.dashboard });
      toast({
        title: '✅ Richiesta inviata',
        description: 'Il tuo ritiro è in elaborazione. Riceverai una notifica via email.',
      });
    },
    onError: (err) => {
      toast({
        title: 'Ritiro non riuscito',
        description: err.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Utility: copia link referral ────────────────────────────────────────────

export function useAffiliateCopyLink() {
  const { toast } = useToast();

  return async function copyLink(referralLink: string) {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast({
        title: '🔗 Link copiato!',
        description: 'Incollalo ovunque per guadagnare commissioni.',
      });
    } catch {
      // Fallback per browser senza clipboard API
      const el = document.createElement('textarea');
      el.value = referralLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      toast({ title: '🔗 Link copiato!' });
    }
  };
}
